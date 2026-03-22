// ===========================================
// Quiz Model
// Couple love quiz questions and answers
// ===========================================

const mongoose = require('mongoose');

// Predefined quiz questions
const QUIZ_QUESTIONS = [
    // About Partner
    { id: 1, question: "What is your partner's favorite food?", category: "favorites" },
    { id: 2, question: "What is your partner's favorite movie?", category: "favorites" },
    { id: 3, question: "What is your partner's favorite color?", category: "favorites" },
    { id: 4, question: "What is your partner's favorite song?", category: "favorites" },
    { id: 5, question: "What is your partner's biggest fear?", category: "deep" },
    { id: 6, question: "What is your partner's dream vacation destination?", category: "favorites" },
    { id: 7, question: "What is your partner's comfort food?", category: "favorites" },
    { id: 8, question: "What hobby does your partner enjoy most?", category: "lifestyle" },
    
    // Memories Together
    { id: 9, question: "Where did you first meet?", category: "memories" },
    { id: 10, question: "What was your first date like?", category: "memories" },
    { id: 11, question: "What song reminds you of each other?", category: "memories" },
    { id: 12, question: "What was the first gift you gave each other?", category: "memories" },
    { id: 13, question: "What is your favorite memory together?", category: "memories" },
    { id: 14, question: "Where did you have your first kiss?", category: "memories" },
    { id: 15, question: "What movie did you watch on your first date?", category: "memories" },
    
    // Personality & Habits
    { id: 16, question: "Who is messier?", category: "personality" },
    { id: 17, question: "Who is more romantic?", category: "personality" },
    { id: 18, question: "Who apologizes first after a fight?", category: "personality" },
    { id: 19, question: "Who is the better cook?", category: "personality" },
    { id: 20, question: "Who spends more time getting ready?", category: "personality" },
    { id: 21, question: "Who is more likely to cry during a movie?", category: "personality" },
    { id: 22, question: "Who is the early bird vs night owl?", category: "personality" },
    { id: 23, question: "Who said 'I love you' first?", category: "personality" },
    
    // Future & Dreams
    { id: 24, question: "Where do you see yourselves in 5 years?", category: "future" },
    { id: 25, question: "How many kids do you want (if any)?", category: "future" },
    { id: 26, question: "What's your dream home like?", category: "future" },
    { id: 27, question: "Where would you want to retire?", category: "future" },
    
    // Fun & Silly
    { id: 28, question: "If your partner was an animal, what would they be?", category: "fun" },
    { id: 29, question: "What superhero would your partner be?", category: "fun" },
    { id: 30, question: "What's your partner's guilty pleasure?", category: "fun" },
    { id: 31, question: "What's your partner's most annoying habit?", category: "fun" },
    { id: 32, question: "What makes your partner laugh the most?", category: "fun" },
    
    // Deep Connection
    { id: 33, question: "What do you admire most about your partner?", category: "deep" },
    { id: 34, question: "What's your partner's biggest dream?", category: "deep" },
    { id: 35, question: "What makes your relationship special?", category: "deep" },
    { id: 36, question: "What's one thing you want to do together?", category: "deep" },
    { id: 37, question: "What was a defining moment in your relationship?", category: "deep" },
    { id: 38, question: "What do you love most about your partner?", category: "deep" },
    { id: 39, question: "How did you know this was the one?", category: "deep" },
    { id: 40, question: "What's your partner's love language?", category: "deep" }
];

// Quiz schema
const quizSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Question details
    questionId: {
        type: Number,
        required: true
    },

    question: {
        type: String,
        required: true
    },

    category: {
        type: String,
        enum: ['favorites', 'memories', 'personality', 'future', 'fun', 'deep'],
        required: true
    },

    // Partner 1's answer
    answer1: {
        text: { type: String, default: null },
        answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        answeredAt: { type: Date, default: null }
    },

    // Partner 2's answer
    answer2: {
        text: { type: String, default: null },
        answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        answeredAt: { type: Date, default: null }
    },

    // Match result (calculated after both answer)
    isMatched: {
        type: Boolean,
        default: null
    },

    matchScore: {
        type: Number,
        default: null,
        min: 0,
        max: 100
    },

    // Status
    status: {
        type: String,
        enum: ['pending', 'waiting', 'completed'],
        default: 'pending'
    },

    // When the quiz was created
    createdAt: {
        type: Date,
        default: Date.now
    },

    // When both completed
    completedAt: {
        type: Date,
        default: null
    }
});

// Indexes
quizSchema.index({ coupleId: 1, createdAt: -1 });
quizSchema.index({ coupleId: 1, status: 1 });
quizSchema.index({ coupleId: 1, questionId: 1 });

// Static method to get questions
quizSchema.statics.getQuestions = function() {
    return QUIZ_QUESTIONS;
};

// Static method to get random questions
quizSchema.statics.getRandomQuestions = function(count = 5, excludeIds = []) {
    const available = QUIZ_QUESTIONS.filter(q => !excludeIds.includes(q.id));
    const shuffled = available.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};

// Static method to get questions by category
quizSchema.statics.getQuestionsByCategory = function(category) {
    return QUIZ_QUESTIONS.filter(q => q.category === category);
};

// Calculate match similarity
quizSchema.methods.calculateMatch = function() {
    if (!this.answer1.text || !this.answer2.text) {
        return null;
    }

    const a1 = this.answer1.text.toLowerCase().trim();
    const a2 = this.answer2.text.toLowerCase().trim();

    // Exact match
    if (a1 === a2) {
        return 100;
    }

    // Calculate similarity using Levenshtein-like approach
    const words1 = a1.split(/\s+/);
    const words2 = a2.split(/\s+/);
    
    let matchingWords = 0;
    words1.forEach(w1 => {
        if (words2.some(w2 => w1.includes(w2) || w2.includes(w1))) {
            matchingWords++;
        }
    });

    const similarity = (matchingWords / Math.max(words1.length, words2.length)) * 100;
    return Math.round(similarity);
};

const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;
