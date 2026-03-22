// ===========================================
// Transcription Service
// Converts voice messages to text using OpenAI Whisper
// ===========================================

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Message = require('../models/Message');

// OpenAI Whisper API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

// ===========================================
// Check if transcription is available
// ===========================================

const isTranscriptionAvailable = () => {
    return !!OPENAI_API_KEY;
};

// ===========================================
// Transcribe Audio File
// ===========================================

const transcribeAudio = async (filePath) => {
    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    // Handle different file path formats
    let absolutePath = filePath;
    
    // If it's a URL (Cloudinary or external), we need to download it first
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        absolutePath = await downloadFile(filePath);
    } else if (filePath.startsWith('/uploads/')) {
        // Local upload path
        absolutePath = path.join(__dirname, '..', filePath);
    }

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
        throw new Error('Audio file not found');
    }

    // Create form data for OpenAI API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(absolutePath));
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // Auto-detect language, but hint English
    formData.append('response_format', 'json');

    try {
        const response = await axios.post(OPENAI_API_URL, formData, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            maxBodyLength: Infinity,
            timeout: 60000 // 60 second timeout
        });

        // Clean up downloaded file if it was temporary
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            fs.unlinkSync(absolutePath);
        }

        return {
            success: true,
            text: response.data.text,
            language: response.data.language
        };
    } catch (error) {
        console.error('Transcription error:', error.response?.data || error.message);
        
        // Clean up downloaded file if it was temporary
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            try { fs.unlinkSync(absolutePath); } catch (e) {}
        }

        throw new Error(error.response?.data?.error?.message || 'Transcription failed');
    }
};

// ===========================================
// Download File from URL (for Cloudinary files)
// ===========================================

const downloadFile = async (url) => {
    const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.webm`;
    const filePath = path.join(tempDir, fileName);

    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: 30000
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
    });
};

// ===========================================
// Process Voice Message Transcription
// Updates message with transcription result
// ===========================================

const processVoiceMessage = async (messageId) => {
    try {
        const message = await Message.findById(messageId);
        
        if (!message) {
            console.error('Message not found for transcription:', messageId);
            return;
        }

        if (message.type !== 'voice') {
            console.error('Message is not a voice message:', messageId);
            return;
        }

        // Check if transcription service is available
        if (!isTranscriptionAvailable()) {
            await Message.findByIdAndUpdate(messageId, {
                'transcription.status': 'not_available',
                'transcription.error': 'Transcription service not configured'
            });
            return;
        }

        // Update status to processing
        await Message.findByIdAndUpdate(messageId, {
            'transcription.status': 'processing'
        });

        // Perform transcription
        const result = await transcribeAudio(message.filePath);

        // Update message with transcription
        await Message.findByIdAndUpdate(messageId, {
            'transcription.text': result.text,
            'transcription.status': 'completed',
            'transcription.processedAt': new Date(),
            'transcription.error': null
        });

        console.log(`✅ Transcription completed for message ${messageId}`);

        // Emit socket event to notify clients
        const io = global.io;
        if (io) {
            const updatedMessage = await Message.findById(messageId)
                .populate('senderId', 'name avatar')
                .populate('receiverId', 'name avatar');
            
            io.to(message.senderId.toString()).emit('transcriptionComplete', {
                messageId,
                transcription: updatedMessage.transcription
            });
            io.to(message.receiverId.toString()).emit('transcriptionComplete', {
                messageId,
                transcription: updatedMessage.transcription
            });
        }

        return result;

    } catch (error) {
        console.error('Transcription processing error:', error.message);
        
        // Update message with error
        await Message.findByIdAndUpdate(messageId, {
            'transcription.status': 'failed',
            'transcription.error': error.message,
            'transcription.processedAt': new Date()
        });
    }
};

// ===========================================
// Queue Transcription (non-blocking)
// ===========================================

const queueTranscription = (messageId) => {
    // Mark as pending immediately
    Message.findByIdAndUpdate(messageId, {
        'transcription.status': 'pending'
    }).then(() => {
        // Process asynchronously (don't await)
        setImmediate(() => {
            processVoiceMessage(messageId).catch(err => {
                console.error('Async transcription error:', err.message);
            });
        });
    });
};

// ===========================================
// Retry Failed Transcription
// ===========================================

const retryTranscription = async (messageId) => {
    const message = await Message.findById(messageId);
    
    if (!message) {
        throw new Error('Message not found');
    }

    if (message.type !== 'voice') {
        throw new Error('Not a voice message');
    }

    if (message.transcription?.status === 'processing') {
        throw new Error('Transcription already in progress');
    }

    await processVoiceMessage(messageId);
    
    return Message.findById(messageId);
};

module.exports = {
    isTranscriptionAvailable,
    transcribeAudio,
    processVoiceMessage,
    queueTranscription,
    retryTranscription
};
