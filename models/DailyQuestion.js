// ===========================================
// DailyQuestion Model
// Stores the pool of daily relationship questions
// ===========================================

const mongoose = require('mongoose');

const dailyQuestionSchema = new mongoose.Schema({
    // The question text
    question: {
        type: String,
        required: [true, 'Question text is required'],
        trim: true,
        maxlength: [500, 'Question cannot exceed 500 characters']
    },

    // Category of the question
    category: {
        type: String,
        enum: ['memories', 'dreams', 'preferences', 'feelings', 'fun', 'deep', 'future', 'gratitude'],
        default: 'feelings'
    },

    // Order/day number (optional, for sequential questions)
    dayNumber: {
        type: Number,
        default: null
    },

    // Is this question active/available
    isActive: {
        type: Boolean,
        default: true
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
dailyQuestionSchema.index({ isActive: 1, dayNumber: 1 });

// Static method to get today's question
dailyQuestionSchema.statics.getTodaysQuestion = async function() {
    // Calculate day number since a fixed start date
    const startDate = new Date('2024-01-01');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    // Get total active questions
    const totalQuestions = await this.countDocuments({ isActive: true });
    
    if (totalQuestions === 0) {
        return null;
    }
    
    // Cycle through questions based on day
    const questionIndex = daysSinceStart % totalQuestions;
    
    // Get the question at this index (use find with skip/limit since findOne doesn't support skip)
    const questions = await this.find({ isActive: true })
        .sort({ dayNumber: 1, createdAt: 1 })
        .skip(questionIndex)
        .limit(1);
    
    return questions[0] || null;
};

// Static method to seed initial questions
dailyQuestionSchema.statics.seedQuestions = async function() {
    const existingCount = await this.countDocuments();
    
    if (existingCount > 0) {
        return { message: 'Questions already exist', count: existingCount };
    }

    const questions = [
        // Memories
        { question: "What's your favorite memory of us together?", category: 'memories', dayNumber: 1 },
        { question: "What moment made you realize you loved me?", category: 'memories', dayNumber: 2 },
        { question: "What's the funniest thing that's happened to us?", category: 'memories', dayNumber: 3 },
        { question: "What was our best date ever?", category: 'memories', dayNumber: 4 },
        { question: "What's a small moment with me that you'll never forget?", category: 'memories', dayNumber: 5 },
        
        // Dreams & Future
        { question: "Where do you see us in 5 years?", category: 'future', dayNumber: 6 },
        { question: "What's a dream vacation you want us to take together?", category: 'dreams', dayNumber: 7 },
        { question: "What's something new you want us to try together?", category: 'dreams', dayNumber: 8 },
        { question: "What does your ideal weekend with me look like?", category: 'dreams', dayNumber: 9 },
        { question: "What's a goal you want us to achieve together this year?", category: 'future', dayNumber: 10 },
        
        // Feelings
        { question: "What do you love most about me?", category: 'feelings', dayNumber: 11 },
        { question: "What makes you feel most loved by me?", category: 'feelings', dayNumber: 12 },
        { question: "When do you feel closest to me?", category: 'feelings', dayNumber: 13 },
        { question: "What's something I do that always makes you smile?", category: 'feelings', dayNumber: 14 },
        { question: "How can I make you feel more appreciated?", category: 'feelings', dayNumber: 15 },
        
        // Preferences
        { question: "What's your favorite way to spend time together?", category: 'preferences', dayNumber: 16 },
        { question: "What's your favorite meal that I make or we share?", category: 'preferences', dayNumber: 17 },
        { question: "What song reminds you of us?", category: 'preferences', dayNumber: 18 },
        { question: "What's your favorite thing about our relationship?", category: 'preferences', dayNumber: 19 },
        { question: "Morning cuddles or night cuddles?", category: 'preferences', dayNumber: 20 },
        
        // Fun
        { question: "If we could have any superpower as a couple, what would it be?", category: 'fun', dayNumber: 21 },
        { question: "What movie character couple are we most like?", category: 'fun', dayNumber: 22 },
        { question: "What's your favorite inside joke we have?", category: 'fun', dayNumber: 23 },
        { question: "If we won the lottery, what's the first thing we'd do?", category: 'fun', dayNumber: 24 },
        { question: "What's the weirdest thing you love about me?", category: 'fun', dayNumber: 25 },
        
        // Deep
        { question: "What's something you've never told anyone but me?", category: 'deep', dayNumber: 26 },
        { question: "What fears do you have about our future?", category: 'deep', dayNumber: 27 },
        { question: "What's the hardest thing you've overcome together?", category: 'deep', dayNumber: 28 },
        { question: "What lesson has our relationship taught you?", category: 'deep', dayNumber: 29 },
        { question: "What do you think makes us work as a couple?", category: 'deep', dayNumber: 30 },
        
        // Gratitude
        { question: "What are you most grateful for about our relationship?", category: 'gratitude', dayNumber: 31 },
        { question: "What sacrifice has your partner made that you appreciate?", category: 'gratitude', dayNumber: 32 },
        { question: "What's something your partner does that you never thanked them for?", category: 'gratitude', dayNumber: 33 },
        { question: "How has your partner helped you grow as a person?", category: 'gratitude', dayNumber: 34 },
        { question: "What would you miss most if your partner wasn't here?", category: 'gratitude', dayNumber: 35 },
        
        // More questions
        { question: "What's a habit of mine that you find adorable?", category: 'feelings', dayNumber: 36 },
        { question: "What's something you want to learn together?", category: 'dreams', dayNumber: 37 },
        { question: "What's the best advice you'd give to other couples?", category: 'deep', dayNumber: 38 },
        { question: "What's your favorite photo of us?", category: 'memories', dayNumber: 39 },
        { question: "What's a surprise I gave you that you loved?", category: 'memories', dayNumber: 40 },
        { question: "What do you daydream about when you think of us?", category: 'dreams', dayNumber: 41 },
        { question: "What's a tradition you want us to start?", category: 'future', dayNumber: 42 },
        { question: "What's the best text I ever sent you?", category: 'memories', dayNumber: 43 },
        { question: "What makes our love story unique?", category: 'deep', dayNumber: 44 },
        { question: "What's one thing you want more of in our relationship?", category: 'feelings', dayNumber: 45 },
        { question: "What nickname do you secretly love being called?", category: 'fun', dayNumber: 46 },
        { question: "What's the most romantic thing I've done for you?", category: 'memories', dayNumber: 47 },
        { question: "What do you think about right before you fall asleep?", category: 'feelings', dayNumber: 48 },
        { question: "What's your love language and how can I speak it better?", category: 'deep', dayNumber: 49 },
        { question: "What's something about me that still surprises you?", category: 'feelings', dayNumber: 50 }
    ];

    await this.insertMany(questions);
    return { message: 'Questions seeded successfully', count: questions.length };
};

const DailyQuestion = mongoose.model('DailyQuestion', dailyQuestionSchema);

module.exports = DailyQuestion;
