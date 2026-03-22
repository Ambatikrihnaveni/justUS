// ===========================================
// Push Notification Service
// Handles Firebase Cloud Messaging for push notifications
// ===========================================

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

// Helper to properly format the private key
const formatPrivateKey = (key) => {
    if (!key) return null;
    
    // If key is already properly formatted with real newlines, return it
    if (key.includes('-----BEGIN') && key.includes('\n')) {
        return key;
    }
    
    // Replace escaped newlines (\\n or \n as literal text) with actual newlines
    let formattedKey = key
        .replace(/\\\\n/g, '\n')  // Handle double-escaped \\n
        .replace(/\\n/g, '\n')    // Handle single-escaped \n
        .replace(/\n\n/g, '\n');  // Fix any double newlines
    
    // If the key doesn't have proper BEGIN/END markers after formatting, 
    // it might be the raw key without headers - wrap it
    if (!formattedKey.includes('-----BEGIN')) {
        formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`;
    }
    
    return formattedKey;
};

const initializeFirebase = () => {
    if (firebaseInitialized) return true;
    
    try {
        // Check if service account is configured as full JSON
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                // Also format the private key in the JSON object
                if (serviceAccount.private_key) {
                    serviceAccount.private_key = formatPrivateKey(serviceAccount.private_key);
                }
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                firebaseInitialized = true;
                console.log('🔥 Firebase Admin SDK initialized (from JSON)');
                return true;
            } catch (parseError) {
                console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseError.message);
                // Fall through to try individual env vars
            }
        }
        
        // Use individual environment variables
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
            const privateKey = formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY);
            
            if (!privateKey) {
                console.warn('⚠️ Firebase private key is empty or invalid');
                return false;
            }
            
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: privateKey
                })
            });
            firebaseInitialized = true;
            console.log('🔥 Firebase Admin SDK initialized (from env vars)');
            return true;
        }
        
        console.warn('⚠️ Firebase not configured - push notifications disabled');
        console.warn('   Set FIREBASE_SERVICE_ACCOUNT (JSON) or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY');
        return false;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error);
        // Don't crash the server - just disable push notifications
        return false;
    }
};

// Initialize on module load
initializeFirebase();

// ===========================================
// Send Push Notification
// ===========================================

const sendPushNotification = async (fcmToken, title, body, data = {}, options = {}) => {
    if (!firebaseInitialized) {
        console.log('⚠️ Firebase not initialized, skipping push notification');
        return false;
    }

    if (!fcmToken) {
        console.log('⚠️ No FCM token provided');
        return false;
    }

    try {
        const message = {
            token: fcmToken,
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            android: {
                priority: options.priority || 'high',
                notification: {
                    channelId: options.channelId || 'justus_messages',
                    priority: options.priority === 'max' ? 'max' : 'high',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    visibility: 'public',
                    icon: '@mipmap/ic_launcher',
                    color: '#ff6b9d'
                }
            },
            // For iOS (future support)
            apns: {
                headers: {
                    'apns-priority': '10'
                },
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('📲 Push notification sent:', response);
        return true;
    } catch (error) {
        console.error('❌ Failed to send push notification:', error);
        
        // Handle invalid token
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            return { invalidToken: true };
        }
        
        return false;
    }
};

// ===========================================
// Send Message Notification
// ===========================================

const sendMessageNotification = async (receiverFcmToken, senderName, messageText, messageType = 'text') => {
    let body = messageText;
    
    // Format message based on type
    switch (messageType) {
        case 'image':
            body = '📷 Sent a photo';
            break;
        case 'video':
            body = '🎥 Sent a video';
            break;
        case 'audio':
        case 'voice':
            body = '🎤 Sent a voice message';
            break;
        case 'gif':
            body = '🎭 Sent a GIF';
            break;
        case 'location':
            body = '📍 Shared location';
            break;
        case 'file':
            body = '📎 Sent a file';
            break;
        default:
            // Truncate long messages
            if (body && body.length > 100) {
                body = body.substring(0, 97) + '...';
            }
    }

    return sendPushNotification(
        receiverFcmToken,
        `💕 ${senderName}`,
        body,
        {
            type: 'message',
            messageType,
            senderName
        },
        {
            channelId: 'justus_messages',
            priority: 'high'
        }
    );
};

// ===========================================
// Send Call Notification (High Priority)
// ===========================================

const sendCallNotification = async (receiverFcmToken, callerName, callType = 'audio', callerId) => {
    if (!firebaseInitialized) {
        console.log('⚠️ Firebase not initialized, skipping call notification');
        return false;
    }

    if (!receiverFcmToken) {
        console.log('⚠️ No FCM token provided for call notification');
        return false;
    }

    try {
        const message = {
            token: receiverFcmToken,
            data: {
                type: 'incoming_call',
                callType,
                callerName,
                callerId: callerId?.toString() || '',
                timestamp: Date.now().toString()
            },
            android: {
                priority: 'high',
                ttl: 30000, // 30 seconds
                notification: {
                    channelId: 'justus_calls',
                    priority: 'max',
                    defaultSound: false,
                    sound: 'ringtone',
                    defaultVibrateTimings: true,
                    vibrateTimingsMillis: [0, 500, 200, 500],
                    visibility: 'public',
                    icon: '@mipmap/ic_launcher',
                    color: '#ff6b9d',
                    title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`,
                    body: `${callerName} is calling you...`,
                    // Full-screen intent for incoming calls
                    fullScreenIntent: {
                        launchActivity: 'com.justus.app.MainActivity',
                        highPriority: true
                    }
                }
            },
            apns: {
                headers: {
                    'apns-priority': '10',
                    'apns-push-type': 'voip'
                },
                payload: {
                    aps: {
                        sound: 'ringtone.caf',
                        badge: 1,
                        'content-available': 1
                    }
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('📞 Call notification sent:', response);
        return true;
    } catch (error) {
        console.error('❌ Failed to send call notification:', error);
        return false;
    }
};

// ===========================================
// Send Missed Call Notification
// ===========================================

const sendMissedCallNotification = async (receiverFcmToken, callerName, callType = 'audio') => {
    return sendPushNotification(
        receiverFcmToken,
        `📞 Missed ${callType === 'video' ? 'Video' : 'Voice'} Call`,
        `You missed a call from ${callerName}`,
        {
            type: 'missed_call',
            callType,
            callerName
        },
        {
            channelId: 'justus_calls',
            priority: 'high'
        }
    );
};

// ===========================================
// Check if Firebase is initialized
// ===========================================

const isFirebaseInitialized = () => firebaseInitialized;

module.exports = {
    initializeFirebase,
    sendPushNotification,
    sendMessageNotification,
    sendCallNotification,
    sendMissedCallNotification,
    isFirebaseInitialized
};
