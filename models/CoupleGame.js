// ===========================================
// Couple Games Model
// Games for couples to play together
// ===========================================

const mongoose = require('mongoose');

// ===========================================
// Truth or Dare Questions
// ===========================================
const TRUTH_QUESTIONS = [
    // Romantic
    { id: 1, text: "What was your first impression of me?", category: "romantic", intensity: "light" },
    { id: 2, text: "When did you first realize you loved me?", category: "romantic", intensity: "deep" },
    { id: 3, text: "What's your favorite physical feature of mine?", category: "romantic", intensity: "light" },
    { id: 4, text: "What's the most romantic dream you've had about us?", category: "romantic", intensity: "medium" },
    { id: 5, text: "What do you think makes our relationship special?", category: "romantic", intensity: "deep" },
    { id: 6, text: "What's one thing you want to do with me but haven't yet?", category: "romantic", intensity: "medium" },
    { id: 7, text: "What song makes you think of me?", category: "romantic", intensity: "light" },
    { id: 8, text: "What's the best gift I've ever given you?", category: "romantic", intensity: "light" },
    { id: 9, text: "If you could relive one moment with me, which would it be?", category: "romantic", intensity: "deep" },
    { id: 10, text: "What do you love most about our relationship?", category: "romantic", intensity: "deep" },
    
    // Fun
    { id: 11, text: "What's the most embarrassing thing you've done in front of me?", category: "fun", intensity: "light" },
    { id: 12, text: "What's your guilty pleasure you haven't told me about?", category: "fun", intensity: "medium" },
    { id: 13, text: "If you could have any superpower to use in our relationship, what would it be?", category: "fun", intensity: "light" },
    { id: 14, text: "What's the silliest thing that makes you happy?", category: "fun", intensity: "light" },
    { id: 15, text: "What's something you pretend to like but secretly don't?", category: "fun", intensity: "medium" },
    { id: 16, text: "What's the weirdest thing you find attractive about me?", category: "fun", intensity: "medium" },
    { id: 17, text: "What celebrity would you let me have a crush on?", category: "fun", intensity: "light" },
    { id: 18, text: "What's the cheesiest pick-up line you'd use on me?", category: "fun", intensity: "light" },
    { id: 19, text: "What's the most random thing that makes you think of me?", category: "fun", intensity: "light" },
    { id: 20, text: "What's your secret talent I don't know about?", category: "fun", intensity: "light" },
    
    // Deep
    { id: 21, text: "What's your biggest fear about our future?", category: "deep", intensity: "deep" },
    { id: 22, text: "What's something you've always wanted to tell me but haven't?", category: "deep", intensity: "deep" },
    { id: 23, text: "What do you admire most about me?", category: "deep", intensity: "deep" },
    { id: 24, text: "What's the hardest thing about being in a relationship?", category: "deep", intensity: "deep" },
    { id: 25, text: "What do you think I could do better as a partner?", category: "deep", intensity: "deep" },
    { id: 26, text: "What's your biggest insecurity?", category: "deep", intensity: "deep" },
    { id: 27, text: "What's the best advice you've received about love?", category: "deep", intensity: "medium" },
    { id: 28, text: "How do you envision our life in 10 years?", category: "deep", intensity: "deep" },
    { id: 29, text: "What's a sacrifice you'd make for me?", category: "deep", intensity: "deep" },
    { id: 30, text: "What makes you feel most loved by me?", category: "deep", intensity: "deep" }
];

const DARE_ACTIONS = [
    // Romantic
    { id: 1, text: "Write a love poem about your partner in 2 minutes", category: "romantic", intensity: "medium" },
    { id: 2, text: "Send your partner the most romantic text you can think of", category: "romantic", intensity: "light" },
    { id: 3, text: "Describe your perfect date in detail", category: "romantic", intensity: "light" },
    { id: 4, text: "Serenade your partner with a love song", category: "romantic", intensity: "medium" },
    { id: 5, text: "Give your partner a compliment for every letter in their name", category: "romantic", intensity: "medium" },
    { id: 6, text: "Write down 5 things you love about your partner", category: "romantic", intensity: "light" },
    { id: 7, text: "Plan a surprise date for next week right now", category: "romantic", intensity: "medium" },
    { id: 8, text: "Record a voice message saying why you love them", category: "romantic", intensity: "medium" },
    { id: 9, text: "Create a couple bucket list of 10 items", category: "romantic", intensity: "light" },
    { id: 10, text: "Write a one-paragraph love story about you two", category: "romantic", intensity: "medium" },
    
    // Fun
    { id: 11, text: "Do your best impression of your partner", category: "fun", intensity: "light" },
    { id: 12, text: "Let your partner post anything on your social media", category: "fun", intensity: "medium" },
    { id: 13, text: "Speak in an accent for the next 5 minutes", category: "fun", intensity: "light" },
    { id: 14, text: "Do a silly dance for your partner", category: "fun", intensity: "light" },
    { id: 15, text: "Let your partner give you a funny nickname for the day", category: "fun", intensity: "light" },
    { id: 16, text: "Try to make your partner laugh in 30 seconds", category: "fun", intensity: "light" },
    { id: 17, text: "Send your partner the ugliest selfie you can take", category: "fun", intensity: "light" },
    { id: 18, text: "Do 10 push-ups while saying 'I love you' each time", category: "fun", intensity: "medium" },
    { id: 19, text: "Tell a joke that will make your partner laugh", category: "fun", intensity: "light" },
    { id: 20, text: "Recreate your first photo together", category: "fun", intensity: "medium" }
];

// ===========================================
// Would You Rather Questions
// ===========================================
const WOULD_YOU_RATHER = [
    { id: 1, optionA: "Go on a fancy dinner date", optionB: "Have a cozy movie night at home", category: "dates" },
    { id: 2, optionA: "Receive a handwritten love letter", optionB: "Get a surprise gift", category: "romantic" },
    { id: 3, optionA: "Live in a big city together", optionB: "Live in a quiet countryside", category: "lifestyle" },
    { id: 4, optionA: "Travel the world together", optionB: "Build your dream home", category: "future" },
    { id: 5, optionA: "Know what your partner is thinking", optionB: "Feel what they're feeling", category: "deep" },
    { id: 6, optionA: "Always have breakfast in bed", optionB: "Always have candlelit dinners", category: "lifestyle" },
    { id: 7, optionA: "Go on an adventure vacation", optionB: "Have a relaxing beach vacation", category: "dates" },
    { id: 8, optionA: "Have your partner cook for you every day", optionB: "Go out to restaurants every day", category: "lifestyle" },
    { id: 9, optionA: "Relive your first date again", optionB: "Fast forward to your dream future", category: "romantic" },
    { id: 10, optionA: "Never argue again", optionB: "Never have secrets from each other", category: "deep" },
    { id: 11, optionA: "Have matching tattoos", optionB: "Have matching outfits for a day", category: "fun" },
    { id: 12, optionA: "Receive flowers every week", optionB: "Get one big surprise per month", category: "romantic" },
    { id: 13, optionA: "Always speak your mind", optionB: "Always keep the peace", category: "deep" },
    { id: 14, optionA: "Go back to the day you met", optionB: "Skip to 50 years from now", category: "romantic" },
    { id: 15, optionA: "Have a love song written about you", optionB: "Have a movie based on your love story", category: "fun" },
    { id: 16, optionA: "Always have perfect gifts for each other", optionB: "Always know the right thing to say", category: "romantic" },
    { id: 17, optionA: "Be able to read each other's love letters from the future", optionB: "Have a photo album that shows your happiest moments", category: "deep" },
    { id: 18, optionA: "Dance together every day", optionB: "Sing karaoke together every week", category: "fun" },
    { id: 19, optionA: "Have a pet that could talk about your relationship", optionB: "Have a robot that plans perfect dates", category: "fun" },
    { id: 20, optionA: "Never forget any anniversary", optionB: "Always give the perfect gift", category: "romantic" }
];

// ===========================================
// Never Have I Ever Questions
// ===========================================
const NEVER_HAVE_I_EVER = [
    { id: 1, text: "Never have I ever stalked my partner's social media before we dated", category: "fun" },
    { id: 2, text: "Never have I ever dreamed about my partner", category: "romantic" },
    { id: 3, text: "Never have I ever lied about liking something they made", category: "fun" },
    { id: 4, text: "Never have I ever forgotten an anniversary or birthday", category: "lifestyle" },
    { id: 5, text: "Never have I ever pretended to sleep to avoid a conversation", category: "fun" },
    { id: 6, text: "Never have I ever written something about my partner in my diary/journal", category: "romantic" },
    { id: 7, text: "Never have I ever talked about my partner to a stranger", category: "fun" },
    { id: 8, text: "Never have I ever cried happy tears because of my partner", category: "romantic" },
    { id: 9, text: "Never have I ever re-read old messages from my partner", category: "romantic" },
    { id: 10, text: "Never have I ever practiced saying 'I love you' in the mirror", category: "fun" },
    { id: 11, text: "Never have I ever made a playlist just for my partner", category: "romantic" },
    { id: 12, text: "Never have I ever pretended to like their friends", category: "fun" },
    { id: 13, text: "Never have I ever thought about our future kids' names", category: "deep" },
    { id: 14, text: "Never have I ever secretly planned a surprise", category: "romantic" },
    { id: 15, text: "Never have I ever felt jealous about something silly", category: "fun" }
];

// ===========================================
// This or That Options
// ===========================================
const THIS_OR_THAT = [
    { id: 1, optionA: "Morning cuddles", optionB: "Night cuddles", category: "romantic" },
    { id: 2, optionA: "Sweet texts", optionB: "Voice calls", category: "communication" },
    { id: 3, optionA: "Cooking together", optionB: "Ordering food", category: "lifestyle" },
    { id: 4, optionA: "Beach vacation", optionB: "Mountain adventure", category: "travel" },
    { id: 5, optionA: "Big wedding", optionB: "Small intimate ceremony", category: "future" },
    { id: 6, optionA: "Comedy movie", optionB: "Horror movie", category: "entertainment" },
    { id: 7, optionA: "Surprise gifts", optionB: "Planned gifts", category: "romantic" },
    { id: 8, optionA: "Dancing together", optionB: "Singing together", category: "fun" },
    { id: 9, optionA: "Coffee date", optionB: "Dinner date", category: "dates" },
    { id: 10, optionA: "Road trip", optionB: "Flight vacation", category: "travel" },
    { id: 11, optionA: "Game night", optionB: "Movie marathon", category: "entertainment" },
    { id: 12, optionA: "City life", optionB: "Country life", category: "lifestyle" },
    { id: 13, optionA: "Pet dog", optionB: "Pet cat", category: "lifestyle" },
    { id: 14, optionA: "Sunrise watching", optionB: "Sunset watching", category: "romantic" },
    { id: 15, optionA: "Formal dates", optionB: "Casual hangouts", category: "dates" }
];

// ===========================================
// 21 Questions  (Deep Connection)
// ===========================================
const TWENTY_ONE_QUESTIONS = [
    { id: 1, question: "What's your happiest memory with me?", category: "memories" },
    { id: 2, question: "What do you see when you imagine our future?", category: "future" },
    { id: 3, question: "What's something you want to experience with me?", category: "dreams" },
    { id: 4, question: "How do you prefer I show love to you?", category: "love-language" },
    { id: 5, question: "What's a dream you haven't shared with me yet?", category: "dreams" },
    { id: 6, question: "What moment made you fall deeper in love with me?", category: "romantic" },
    { id: 7, question: "What's something small I do that makes you happy?", category: "appreciation" },
    { id: 8, question: "Where do you see us living in the future?", category: "future" },
    { id: 9, question: "What tradition would you like us to start?", category: "goals" },
    { id: 10, question: "What's your favorite thing about our relationship?", category: "romantic" },
    { id: 11, question: "How can I support you better?", category: "growth" },
    { id: 12, question: "What adventure do you want us to go on?", category: "dreams" },
    { id: 13, question: "What's your favorite thing we do together?", category: "memories" },
    { id: 14, question: "How do you like to be comforted when you're sad?", category: "love-language" },
    { id: 15, question: "What's a goal you want us to achieve together?", category: "goals" },
    { id: 16, question: "What makes you feel most connected to me?", category: "romantic" },
    { id: 17, question: "What's something you appreciate about me that I might not know?", category: "appreciation" },
    { id: 18, question: "What does a perfect day with me look like?", category: "dreams" },
    { id: 19, question: "How do you feel our relationship has grown?", category: "growth" },
    { id: 20, question: "What would you want our love story to be remembered as?", category: "romantic" },
    { id: 21, question: "What makes you feel truly loved?", category: "love-language" }
];

// ===========================================
// Love Trivia Questions
// ===========================================
const LOVE_TRIVIA = [
    { id: 1, question: "What is traditionally given on a 25th wedding anniversary?", answer: "Silver", options: ["Gold", "Silver", "Diamond", "Pearl"], category: "traditions" },
    { id: 2, question: "What flower is commonly associated with Valentine's Day?", answer: "Red Rose", options: ["Tulip", "Red Rose", "Sunflower", "Lily"], category: "symbols" },
    { id: 3, question: "In which country did the concept of 'honeymoon' originate?", answer: "Scandinavia", options: ["France", "Italy", "Scandinavia", "England"], category: "history" },
    { id: 4, question: "What does the heart symbol historically represent?", answer: "Love and affection", options: ["Courage", "Love and affection", "Health", "Wisdom"], category: "symbols" },
    { id: 5, question: "Which month is considered the most popular for weddings?", answer: "June", options: ["February", "June", "December", "May"], category: "traditions" },
    { id: 6, question: "What is Cupid's mother's name in Roman mythology?", answer: "Venus", options: ["Athena", "Venus", "Juno", "Diana"], category: "mythology" },
    { id: 7, question: "What anniversary is celebrated with paper?", answer: "1st", options: ["1st", "5th", "10th", "15th"], category: "traditions" },
    { id: 8, question: "What bird symbolizes love and is often released at weddings?", answer: "Dove", options: ["Swan", "Dove", "Robin", "Sparrow"], category: "symbols" },
    { id: 9, question: "What gemstone is associated with love?", answer: "Ruby", options: ["Emerald", "Sapphire", "Ruby", "Diamond"], category: "symbols" },
    { id: 10, question: "In which hand should a wedding ring traditionally be worn?", answer: "Left", options: ["Left", "Right", "Either", "Depends on culture"], category: "traditions" },
    { id: 11, question: "What is the origin of the word 'honeymoon'?", answer: "Mead (honey wine) given to newlyweds", options: ["Sweet like honey", "Mead (honey wine) given to newlyweds", "Full moon celebrations", "Honey-colored destinations"], category: "history" },
    { id: 12, question: "What does a 50th wedding anniversary celebrate?", answer: "Golden Anniversary", options: ["Silver Anniversary", "Golden Anniversary", "Diamond Anniversary", "Platinum Anniversary"], category: "traditions" }
];

// ===========================================
// Couple Riddles
// ===========================================
const COUPLE_RIDDLES = [
    { id: 1, riddle: "I'm not alive, but I can grow. I don't have lungs, but I need your care. What am I?", answer: "Love", hints: ["It exists between couples", "It needs nurturing"] },
    { id: 2, riddle: "What can travel around the world while staying in a corner?", answer: "A stamp (on a love letter)", hints: ["Used for mail", "Romantic correspondence"] },
    { id: 3, riddle: "I am always arriving but never actually arrive. What am I?", answer: "Tomorrow (always something to look forward to together)", hints: ["Time related", "Future plans"] },
    { id: 4, riddle: "The more you share me, the more you have. What am I?", answer: "Love/Happiness", hints: ["An emotion", "Works better when shared"] },
    { id: 5, riddle: "I can be stolen, given, or broken, but I can never be touched. What am I?", answer: "A heart", hints: ["Romantic symbol", "Emotional center"] },
    { id: 6, riddle: "What has a ring but no finger?", answer: "A telephone (calling your love)", hints: ["Communication device", "Makes sound"] },
    { id: 7, riddle: "I go up and down but never move. What am I?", answer: "Temperature (of love/emotions)", hints: ["Can be measured", "Changes based on feelings"] },
    { id: 8, riddle: "What can fill a room but takes up no space?", answer: "Love/Light", hints: ["Intangible", "Creates atmosphere"] },
    { id: 9, riddle: "I'm always with you, sometimes in front, sometimes behind, but you can never see me. What am I?", answer: "The future (together)", hints: ["Time related", "Uncertain but present"] },
    { id: 10, riddle: "Two people are born at the same time, but they don't have the same birthday. How?", answer: "Different time zones (long-distance love)", hints: ["Geography related", "Earth's rotation"] }
];

// ===========================================
// Emoji Charades - Movies & Songs to guess
// ===========================================
const EMOJI_CHARADES = [
    // Movies
    { id: 1, answer: "Titanic", emojis: "🚢💔🧊", category: "movie", hint: "1997 blockbuster" },
    { id: 2, answer: "The Lion King", emojis: "🦁👑🌅", category: "movie", hint: "Disney classic" },
    { id: 3, answer: "Frozen", emojis: "❄️👸⛄", category: "movie", hint: "Let it go" },
    { id: 4, answer: "Finding Nemo", emojis: "🐠🔍🌊", category: "movie", hint: "Lost fish" },
    { id: 5, answer: "The Notebook", emojis: "📓💕👴👵", category: "movie", hint: "Romantic classic" },
    { id: 6, answer: "Star Wars", emojis: "⭐⚔️🌌", category: "movie", hint: "Space saga" },
    { id: 7, answer: "Harry Potter", emojis: "🧙‍♂️⚡🦉", category: "movie", hint: "Boy wizard" },
    { id: 8, answer: "Jurassic Park", emojis: "🦖🏞️😱", category: "movie", hint: "Dinosaur theme park" },
    { id: 9, answer: "The Little Mermaid", emojis: "🧜‍♀️🦀🌊", category: "movie", hint: "Under the sea" },
    { id: 10, answer: "Up", emojis: "🎈🏠👴", category: "movie", hint: "Pixar adventure" },
    // Songs
    { id: 11, answer: "Shape of You", emojis: "💃🕺❤️📐", category: "song", hint: "Ed Sheeran" },
    { id: 12, answer: "Firework", emojis: "🎆💥🌟", category: "song", hint: "Katy Perry" },
    { id: 13, answer: "Perfect", emojis: "💕👫✨", category: "song", hint: "Ed Sheeran ballad" },
    { id: 14, answer: "Bad Guy", emojis: "😈👧🖤", category: "song", hint: "Billie Eilish" },
    { id: 15, answer: "Umbrella", emojis: "☔🎤💃", category: "song", hint: "Rihanna" },
    // Love related
    { id: 16, answer: "Love Story", emojis: "💕📖👸🤴", category: "song", hint: "Romeo & Juliet theme" },
    { id: 17, answer: "Thinking Out Loud", emojis: "🤔💭🗣️💕", category: "song", hint: "Wedding favorite" },
    { id: 18, answer: "A Thousand Years", emojis: "💕🕐1️⃣0️⃣0️⃣0️⃣", category: "song", hint: "Twilight soundtrack" },
    { id: 19, answer: "Can't Help Falling in Love", emojis: "🚫🆘⬇️💕", category: "song", hint: "Elvis classic" },
    { id: 20, answer: "All of Me", emojis: "💯👤💕", category: "song", hint: "John Legend" }
];

// ===========================================
// Word Association Categories
// ===========================================
const WORD_CATEGORIES = [
    { id: 1, category: "Love Words", words: ["heart", "kiss", "hug", "romance", "passion", "adore", "cherish", "devotion"] },
    { id: 2, category: "Date Ideas", words: ["beach", "dinner", "movie", "picnic", "dance", "concert", "travel", "sunset"] },
    { id: 3, category: "Feelings", words: ["happy", "excited", "nervous", "calm", "grateful", "content", "thrilled", "peaceful"] },
    { id: 4, category: "Colors", words: ["red", "pink", "purple", "gold", "silver", "blue", "green", "white"] },
    { id: 5, category: "Animals", words: ["butterfly", "dove", "swan", "dolphin", "kitten", "puppy", "bunny", "bird"] }
];

// ===========================================
// Game Session Schema
// ===========================================
const gameSessionSchema = new mongoose.Schema({
    // Reference to the couple
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },

    // Game type
    gameType: {
        type: String,
        enum: [
            // Q&A Games
            'truth-or-dare', 'would-you-rather', 'never-have-i-ever', 
            'this-or-that', '21-questions', 'love-trivia', 'couple-riddles',
            // Real-time Multiplayer Games  
            'tic-tac-toe', 'connect-four', 'rock-paper-scissors',
            'emoji-charades', 'word-association', 'memory-match',
            'kiss-marry-avoid', 'speed-questions'
        ],
        required: true
    },

    // Current question/challenge
    currentItem: {
        type: mongoose.Schema.Types.Mixed
    },

    // Board state for board games (Tic Tac Toe, Connect Four)
    boardState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Choices for simultaneous games (Rock Paper Scissors)
    choices: {
        partner1: { type: String, default: null },
        partner2: { type: String, default: null }
    },

    // Game state
    status: {
        type: String,
        enum: ['waiting-partner', 'active', 'waiting', 'completed'],
        default: 'active'
    },

    // Scores (for trivia/riddles)
    scores: {
        partner1: { type: Number, default: 0 },
        partner2: { type: Number, default: 0 }
    },

    // Player symbols/colors
    players: {
        partner1: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            symbol: { type: String, default: 'X' },
            color: { type: String, default: '#ff6b9d' }
        },
        partner2: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            symbol: { type: String, default: 'O' },
            color: { type: String, default: '#4facfe' }
        }
    },

    // Responses for this session
    responses: [{
        itemId: Number,
        itemType: String,
        partner1Response: mongoose.Schema.Types.Mixed,
        partner2Response: mongoose.Schema.Types.Mixed,
        timestamp: { type: Date, default: Date.now }
    }],

    // Rounds for multi-round games
    rounds: [{
        roundNumber: Number,
        partner1Choice: mongoose.Schema.Types.Mixed,
        partner2Choice: mongoose.Schema.Types.Mixed,
        winner: String, // 'partner1', 'partner2', 'draw'
        timestamp: { type: Date, default: Date.now }
    }],

    // Settings
    settings: {
        category: String,
        intensity: String,
        questionCount: { type: Number, default: 10 },
        roundsToWin: { type: Number, default: 3 },
        timeLimit: { type: Number, default: 30 } // seconds per turn
    },

    // Current round
    currentRound: {
        type: Number,
        default: 1
    },

    // Who's turn (for turn-based games)
    currentTurn: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Started by
    startedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// ===========================================
// Game History Schema
// ===========================================
const gameHistorySchema = new mongoose.Schema({
    coupleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Couple',
        required: true
    },
    gameType: {
        type: String,
        required: true
    },
    finalScores: {
        partner1: Number,
        partner2: Number
    },
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    totalRounds: Number,
    responses: Array,
    completedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// ===========================================
// Exports
// ===========================================
const CoupleGame = mongoose.model('CoupleGame', gameSessionSchema);
const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

module.exports = {
    CoupleGame,
    GameHistory,
    TRUTH_QUESTIONS,
    DARE_ACTIONS,
    WOULD_YOU_RATHER,
    NEVER_HAVE_I_EVER,
    THIS_OR_THAT,
    TWENTY_ONE_QUESTIONS,
    LOVE_TRIVIA,
    COUPLE_RIDDLES,
    EMOJI_CHARADES,
    WORD_CATEGORIES
};
