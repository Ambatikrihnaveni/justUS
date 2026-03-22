// ===========================================
// Couple Games Controller
// Handles all couple games functionality
// ===========================================

const {
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
} = require('../models/CoupleGame');
const Couple = require('../models/Couple');
const { recordInteraction } = require('./streakController');

// ===========================================
// Helper Functions
// ===========================================

const getRandomItem = (array, exclude = []) => {
    const available = array.filter(item => !exclude.includes(item.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
};

const getGameData = (gameType) => {
    switch (gameType) {
        case 'truth-or-dare':
            return { truths: TRUTH_QUESTIONS, dares: DARE_ACTIONS };
        case 'would-you-rather':
            return WOULD_YOU_RATHER;
        case 'never-have-i-ever':
            return NEVER_HAVE_I_EVER;
        case 'this-or-that':
            return THIS_OR_THAT;
        case '21-questions':
            return TWENTY_ONE_QUESTIONS;
        case 'love-trivia':
            return LOVE_TRIVIA;
        case 'couple-riddles':
            return COUPLE_RIDDLES;
        default:
            return null;
    }
};

// ===========================================
// Get Available Games
// ===========================================
const getAvailableGames = async (req, res) => {
    try {
        const games = [
            {
                id: 'truth-or-dare',
                name: 'Truth or Dare',
                emoji: '🎭',
                description: 'Classic game with romantic and fun twists',
                category: 'interactive',
                players: 2,
                minTime: '10 min'
            },
            {
                id: 'would-you-rather',
                name: 'Would You Rather',
                emoji: '🤔',
                description: 'Choose between two options and see if you match',
                category: 'choices',
                players: 2,
                minTime: '5 min'
            },
            {
                id: 'never-have-i-ever',
                name: 'Never Have I Ever',
                emoji: '🙈',
                description: 'Discover new things about each other',
                category: 'discovery',
                players: 2,
                minTime: '10 min'
            },
            {
                id: 'this-or-that',
                name: 'This or That',
                emoji: '⚡',
                description: 'Quick preferences - see how compatible you are',
                category: 'choices',
                players: 2,
                minTime: '3 min'
            },
            {
                id: '21-questions',
                name: '21 Questions',
                emoji: '💭',
                description: 'Deep questions to strengthen your bond',
                category: 'connection',
                players: 2,
                minTime: '15 min'
            },
            {
                id: 'love-trivia',
                name: 'Love Trivia',
                emoji: '❓',
                description: 'Test your knowledge about love and relationships',
                category: 'trivia',
                players: 2,
                minTime: '5 min'
            },
            {
                id: 'couple-riddles',
                name: 'Couple Riddles',
                emoji: '🧩',
                description: 'Solve romantic riddles together',
                category: 'puzzle',
                players: 2,
                minTime: '10 min'
            },
            {
                id: 'memory-match',
                name: 'Memory Match',
                emoji: '🧠',
                description: 'Match cards and test your memory',
                category: 'puzzle',
                players: 2,
                minTime: '5 min',
                realtime: false
            },
            // Real-time Multiplayer Games
            {
                id: 'tic-tac-toe',
                name: 'Tic Tac Toe',
                emoji: '⭕',
                description: 'Classic X and O game - play in real-time!',
                category: 'realtime',
                players: 2,
                minTime: '2 min',
                realtime: true
            },
            {
                id: 'connect-four',
                name: 'Connect Four',
                emoji: '🔴',
                description: 'Drop discs and connect 4 to win!',
                category: 'realtime',
                players: 2,
                minTime: '5 min',
                realtime: true
            },
            {
                id: 'rock-paper-scissors',
                name: 'Rock Paper Scissors',
                emoji: '✊',
                description: 'Best of 5 - choose at the same time!',
                category: 'realtime',
                players: 2,
                minTime: '2 min',
                realtime: true
            },
            {
                id: 'emoji-charades',
                name: 'Emoji Charades',
                emoji: '🎬',
                description: 'Guess movies & songs from emoji clues!',
                category: 'realtime',
                players: 2,
                minTime: '5 min',
                realtime: true
            },
            {
                id: 'word-association',
                name: 'Word Chain',
                emoji: '🔗',
                description: 'Quick word association game!',
                category: 'realtime',
                players: 2,
                minTime: '3 min',
                realtime: true
            },
            {
                id: 'speed-questions',
                name: 'Speed Questions',
                emoji: '⚡',
                description: '30 seconds to answer - both play at once!',
                category: 'realtime',
                players: 2,
                minTime: '5 min',
                realtime: true
            }
        ];

        res.json({
            success: true,
            games
        });
    } catch (error) {
        console.error('Get available games error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get games',
            error: error.message
        });
    }
};

// ===========================================
// Start New Game
// ===========================================
const startGame = async (req, res) => {
    try {
        const userId = req.user.id;
        const { gameType, settings = {} } = req.body;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Check for existing active game
        const existingGame = await CoupleGame.findOne({
            coupleId: couple._id,
            status: { $in: ['active', 'waiting'] }
        });

        if (existingGame) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active game. Please complete or end it first.',
                existingGame: {
                    id: existingGame._id,
                    gameType: existingGame.gameType
                }
            });
        }

        // Get first item for the game
        let currentItem = null;
        const usedIds = [];

        if (gameType === 'truth-or-dare') {
            const choice = Math.random() > 0.5 ? 'truth' : 'dare';
            const data = choice === 'truth' ? TRUTH_QUESTIONS : DARE_ACTIONS;
            let filtered = data;
            if (settings.category) {
                filtered = data.filter(item => item.category === settings.category);
            }
            if (settings.intensity) {
                filtered = filtered.filter(item => item.intensity === settings.intensity);
            }
            currentItem = getRandomItem(filtered.length ? filtered : data);
            currentItem = { ...currentItem, type: choice };
        } else if (gameType === 'would-you-rather') {
            currentItem = getRandomItem(WOULD_YOU_RATHER);
        } else if (gameType === 'never-have-i-ever') {
            currentItem = getRandomItem(NEVER_HAVE_I_EVER);
        } else if (gameType === 'this-or-that') {
            currentItem = getRandomItem(THIS_OR_THAT);
        } else if (gameType === '21-questions') {
            currentItem = getRandomItem(TWENTY_ONE_QUESTIONS);
        } else if (gameType === 'love-trivia') {
            currentItem = getRandomItem(LOVE_TRIVIA);
        } else if (gameType === 'couple-riddles') {
            const riddle = getRandomItem(COUPLE_RIDDLES);
            currentItem = { ...riddle, hintsUsed: 0 };
        } else if (gameType === 'memory-match') {
            // Memory match game - create card pairs
            const emojis = ['💕', '💖', '💗', '💓', '💝', '💘', '❤️', '🥰'];
            const cards = [...emojis, ...emojis]
                .sort(() => Math.random() - 0.5)
                .map((emoji, index) => ({
                    id: index,
                    emoji,
                    isFlipped: false,
                    isMatched: false
                }));
            currentItem = { cards, matchedPairs: 0, totalPairs: 8, moves: 0 };
        }

        // Real-time game initializations
        let boardState = null;
        let gameStatus = 'active';
        const isPartner1 = couple.partner1._id.toString() === userId;
        const partnerId = isPartner1 ? couple.partner2._id : couple.partner1._id;
        const partnerName = isPartner1 ? couple.partner2.name : couple.partner1.name;

        if (gameType === 'tic-tac-toe') {
            // 3x3 board, null = empty
            boardState = Array(9).fill(null);
            currentItem = { 
                board: boardState, 
                size: 3,
                winCombos: [
                    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
                    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
                    [0, 4, 8], [2, 4, 6] // diagonals
                ]
            };
            gameStatus = 'waiting-partner';
        } else if (gameType === 'connect-four') {
            // 7 cols x 6 rows, null = empty
            boardState = Array(42).fill(null);
            currentItem = { 
                board: boardState, 
                cols: 7, 
                rows: 6,
                lastMove: null
            };
            gameStatus = 'waiting-partner';
        } else if (gameType === 'rock-paper-scissors') {
            currentItem = { 
                currentRound: 1, 
                totalRounds: 5,
                choices: ['rock', 'paper', 'scissors'],
                emojis: { rock: '🪨', paper: '📄', scissors: '✂️' }
            };
            gameStatus = 'waiting-partner';
        } else if (gameType === 'emoji-charades') {
            const item = getRandomItem(EMOJI_CHARADES);
            currentItem = { 
                ...item, 
                isGuesser: false, // starter is the clue giver
                guessesLeft: 3,
                timeLimit: 60
            };
            gameStatus = 'waiting-partner';
        } else if (gameType === 'word-association') {
            const category = getRandomItem(WORD_CATEGORIES);
            currentItem = { 
                category: category.category,
                startWord: category.words[Math.floor(Math.random() * category.words.length)],
                wordsPlayed: [],
                timeLimit: 10, // seconds per word
                currentStreak: 0
            };
            gameStatus = 'waiting-partner';
        } else if (gameType === 'speed-questions') {
            // Mix of quick questions both answer simultaneously
            const questions = [
                ...WOULD_YOU_RATHER.slice(0, 5),
                ...THIS_OR_THAT.slice(0, 5)
            ].sort(() => Math.random() - 0.5);
            currentItem = {
                questions: questions.slice(0, 10),
                currentQuestionIndex: 0,
                timePerQuestion: 15
            };
            gameStatus = 'waiting-partner';
        }

        // Create game session
        const game = await CoupleGame.create({
            coupleId: couple._id,
            gameType,
            currentItem,
            boardState,
            status: gameStatus,
            settings: {
                category: settings.category || null,
                intensity: settings.intensity || null,
                questionCount: settings.questionCount || 10,
                roundsToWin: settings.roundsToWin || 3,
                timeLimit: settings.timeLimit || 30
            },
            players: {
                partner1: {
                    id: couple.partner1._id,
                    symbol: 'X',
                    color: '#ff6b9d'
                },
                partner2: {
                    id: couple.partner2._id,
                    symbol: 'O', 
                    color: '#4facfe'
                }
            },
            currentTurn: userId,
            startedBy: userId
        });

        // Record interaction for streak
        await recordInteraction(userId, couple._id, 'game');

        // Determine if this is a real-time game that needs partner
        const isRealtimeGame = ['tic-tac-toe', 'connect-four', 'rock-paper-scissors', 
                               'emoji-charades', 'word-association', 'speed-questions'].includes(gameType);

        res.json({
            success: true,
            game: {
                id: game._id,
                gameType: game.gameType,
                currentItem: game.currentItem,
                boardState: game.boardState,
                status: game.status,
                currentRound: game.currentRound,
                scores: game.scores,
                players: game.players,
                isYourTurn: true,
                yourSymbol: isPartner1 ? 'X' : 'O',
                needsPartner: isRealtimeGame
            },
            partner: {
                id: partnerId,
                name: partnerName
            }
        });
    } catch (error) {
        console.error('Start game error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start game',
            error: error.message
        });
    }
};

// ===========================================
// Get Active Game
// ===========================================
const getActiveGame = async (req, res) => {
    try {
        const userId = req.user.id;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const game = await CoupleGame.findOne({
            coupleId: couple._id,
            status: { $in: ['active', 'waiting', 'waiting-partner'] }
        });

        if (!game) {
            return res.json({
                success: true,
                game: null
            });
        }

        const isPartner1 = couple.partner1._id.toString() === userId;
        const partnerId = isPartner1 ? couple.partner2._id : couple.partner1._id;
        const partnerName = isPartner1 ? couple.partner2.name : couple.partner1.name;

        res.json({
            success: true,
            game: {
                id: game._id,
                gameType: game.gameType,
                currentItem: game.currentItem,
                status: game.status,
                currentRound: game.currentRound,
                scores: game.scores,
                responses: game.responses,
                isYourTurn: game.currentTurn?.toString() === userId,
                yourSymbol: isPartner1 ? 'X' : 'O',
                players: game.players
            },
            partner: {
                id: partnerId,
                name: partnerName
            }
        });
    } catch (error) {
        console.error('Get active game error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get game',
            error: error.message
        });
    }
};

// ===========================================
// Submit Response
// ===========================================
const submitResponse = async (req, res) => {
    try {
        const userId = req.user.id;
        const { gameId } = req.params;
        const { response, choice } = req.body; // choice for truth/dare selection

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const game = await CoupleGame.findById(gameId);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        const isPartner1 = couple.partner1._id.toString() === userId;
        const partnerId = isPartner1 ? couple.partner2._id : couple.partner1._id;

        // Handle response based on game type
        let result = { matched: false, message: '' };

        // Store response
        const existingResponseIndex = game.responses.findIndex(
            r => r.itemId === game.currentItem.id && r.itemType === game.gameType
        );

        if (existingResponseIndex >= 0) {
            // Update existing response
            if (isPartner1) {
                game.responses[existingResponseIndex].partner1Response = response;
            } else {
                game.responses[existingResponseIndex].partner2Response = response;
            }
        } else {
            // Add new response
            game.responses.push({
                itemId: game.currentItem.id,
                itemType: game.gameType,
                partner1Response: isPartner1 ? response : null,
                partner2Response: isPartner1 ? null : response,
                timestamp: new Date()
            });
        }

        // Check if both partners have responded
        const currentResponse = game.responses[game.responses.length - 1];
        const bothResponded = currentResponse.partner1Response !== null && 
                            currentResponse.partner2Response !== null;

        if (game.gameType === 'would-you-rather' || game.gameType === 'this-or-that') {
            if (bothResponded) {
                result.matched = currentResponse.partner1Response === currentResponse.partner2Response;
                result.message = result.matched ? "You both chose the same! 💕" : "Different choices - interesting! 🤔";
                if (result.matched) {
                    game.scores.partner1 += 1;
                    game.scores.partner2 += 1;
                }
            }
        }

        if (game.gameType === 'love-trivia') {
            const correctAnswer = game.currentItem.answer;
            const isCorrect = response === correctAnswer;
            if (isCorrect) {
                if (isPartner1) {
                    game.scores.partner1 += 1;
                } else {
                    game.scores.partner2 += 1;
                }
            }
            result.isCorrect = isCorrect;
            result.correctAnswer = correctAnswer;
        }

        if (game.gameType === 'couple-riddles') {
            const correctAnswer = game.currentItem.answer.toLowerCase();
            const isCorrect = response.toLowerCase().includes(correctAnswer.toLowerCase());
            if (isCorrect) {
                const points = Math.max(1, 3 - game.currentItem.hintsUsed);
                if (isPartner1) {
                    game.scores.partner1 += points;
                } else {
                    game.scores.partner2 += points;
                }
                result.points = points;
            }
            result.isCorrect = isCorrect;
            result.correctAnswer = game.currentItem.answer;
        }

        if (game.gameType === 'memory-match') {
            // Handle memory match card flip
            const { cardIndex } = req.body;
            if (cardIndex !== undefined) {
                game.currentItem.moves += 1;
                // Memory match logic is handled client-side for responsiveness
            }
        }

        // Move to next round or complete game
        let nextItem = null;
        let gameCompleted = false;

        if (bothResponded || ['truth-or-dare', '21-questions', 'never-have-i-ever'].includes(game.gameType)) {
            const responseCount = game.responses.length;
            
            if (responseCount >= game.settings.questionCount) {
                gameCompleted = true;
                game.status = 'completed';
                
                // Save to history
                await GameHistory.create({
                    coupleId: couple._id,
                    gameType: game.gameType,
                    finalScores: game.scores,
                    winner: game.scores.partner1 > game.scores.partner2 ? couple.partner1._id :
                            game.scores.partner2 > game.scores.partner1 ? couple.partner2._id : null,
                    totalRounds: responseCount,
                    responses: game.responses
                });
            } else {
                // Get next item
                const usedIds = game.responses.map(r => r.itemId);
                
                if (game.gameType === 'truth-or-dare') {
                    const choiceType = choice || (Math.random() > 0.5 ? 'truth' : 'dare');
                    const data = choiceType === 'truth' ? TRUTH_QUESTIONS : DARE_ACTIONS;
                    nextItem = getRandomItem(data, usedIds);
                    if (nextItem) nextItem = { ...nextItem, type: choiceType };
                } else {
                    const gameData = getGameData(game.gameType);
                    if (Array.isArray(gameData)) {
                        nextItem = getRandomItem(gameData, usedIds);
                    }
                }

                game.currentItem = nextItem;
                game.currentRound += 1;
                game.currentTurn = partnerId; // Switch turns
            }
        } else {
            // Waiting for partner
            game.status = 'waiting';
            game.currentTurn = partnerId;
        }

        await game.save();

        // Record interaction
        await recordInteraction(userId, couple._id, 'game');

        res.json({
            success: true,
            result,
            game: {
                id: game._id,
                gameType: game.gameType,
                currentItem: game.currentItem,
                status: game.status,
                currentRound: game.currentRound,
                scores: game.scores,
                isYourTurn: game.currentTurn?.toString() === userId
            },
            gameCompleted,
            partnerResponse: bothResponded ? {
                partner1: currentResponse.partner1Response,
                partner2: currentResponse.partner2Response
            } : null
        });
    } catch (error) {
        console.error('Submit response error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit response',
            error: error.message
        });
    }
};

// ===========================================
// Get Hint (for riddles)
// ===========================================
const getHint = async (req, res) => {
    try {
        const { gameId } = req.params;
        
        const game = await CoupleGame.findById(gameId);
        if (!game || game.gameType !== 'couple-riddles') {
            return res.status(400).json({
                success: false,
                message: 'Invalid game or game type'
            });
        }

        const hints = game.currentItem.hints || [];
        const hintsUsed = game.currentItem.hintsUsed || 0;

        if (hintsUsed >= hints.length) {
            return res.json({
                success: false,
                message: 'No more hints available'
            });
        }

        game.currentItem.hintsUsed = hintsUsed + 1;
        await game.save();

        res.json({
            success: true,
            hint: hints[hintsUsed],
            hintsRemaining: hints.length - hintsUsed - 1
        });
    } catch (error) {
        console.error('Get hint error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get hint',
            error: error.message
        });
    }
};

// ===========================================
// Skip/Next Question
// ===========================================
const skipQuestion = async (req, res) => {
    try {
        const userId = req.user.id;
        const { gameId } = req.params;
        const { choice } = req.body; // For truth-or-dare

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const game = await CoupleGame.findById(gameId);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Get next item
        const usedIds = game.responses.map(r => r.itemId).concat([game.currentItem?.id]);
        let nextItem = null;

        if (game.gameType === 'truth-or-dare') {
            const choiceType = choice || (Math.random() > 0.5 ? 'truth' : 'dare');
            const data = choiceType === 'truth' ? TRUTH_QUESTIONS : DARE_ACTIONS;
            nextItem = getRandomItem(data, usedIds);
            if (nextItem) nextItem = { ...nextItem, type: choiceType };
        } else {
            const gameData = getGameData(game.gameType);
            if (Array.isArray(gameData)) {
                nextItem = getRandomItem(gameData, usedIds);
            }
        }

        if (!nextItem) {
            return res.json({
                success: false,
                message: 'No more questions available'
            });
        }

        game.currentItem = nextItem;
        game.currentRound += 1;
        await game.save();

        res.json({
            success: true,
            game: {
                id: game._id,
                gameType: game.gameType,
                currentItem: game.currentItem,
                status: game.status,
                currentRound: game.currentRound,
                scores: game.scores
            }
        });
    } catch (error) {
        console.error('Skip question error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to skip question',
            error: error.message
        });
    }
};

// ===========================================
// End Game
// ===========================================
const endGame = async (req, res) => {
    try {
        const userId = req.user.id;
        const { gameId } = req.params;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const game = await CoupleGame.findById(gameId);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Save to history before deleting
        if (game.responses.length > 0) {
            await GameHistory.create({
                coupleId: couple._id,
                gameType: game.gameType,
                finalScores: game.scores,
                winner: game.scores.partner1 > game.scores.partner2 ? couple.partner1 :
                        game.scores.partner2 > game.scores.partner1 ? couple.partner2 : null,
                totalRounds: game.currentRound,
                responses: game.responses
            });
        }

        await CoupleGame.findByIdAndDelete(gameId);

        res.json({
            success: true,
            message: 'Game ended successfully',
            finalScores: game.scores
        });
    } catch (error) {
        console.error('End game error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to end game',
            error: error.message
        });
    }
};

// ===========================================
// Get Game History
// ===========================================
const getGameHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10 } = req.query;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const history = await GameHistory.find({ coupleId: couple._id })
            .sort({ completedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await GameHistory.countDocuments({ coupleId: couple._id });

        res.json({
            success: true,
            history,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get game history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get game history',
            error: error.message
        });
    }
};

// ===========================================
// Get Game Stats
// ===========================================
const getGameStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const history = await GameHistory.find({ coupleId: couple._id });

        // Calculate stats
        const stats = {
            totalGamesPlayed: history.length,
            gamesByType: {},
            partner1Wins: 0,
            partner2Wins: 0,
            draws: 0,
            totalScore: { partner1: 0, partner2: 0 },
            favoriteGame: null,
            lastPlayed: null
        };

        history.forEach(game => {
            // Count by type
            stats.gamesByType[game.gameType] = (stats.gamesByType[game.gameType] || 0) + 1;

            // Count wins
            if (game.winner) {
                if (game.winner.toString() === couple.partner1._id.toString()) {
                    stats.partner1Wins++;
                } else {
                    stats.partner2Wins++;
                }
            } else {
                stats.draws++;
            }

            // Total scores
            if (game.finalScores) {
                stats.totalScore.partner1 += game.finalScores.partner1 || 0;
                stats.totalScore.partner2 += game.finalScores.partner2 || 0;
            }
        });

        // Find favorite game
        const maxPlayed = Math.max(...Object.values(stats.gamesByType), 0);
        stats.favoriteGame = Object.keys(stats.gamesByType).find(
            key => stats.gamesByType[key] === maxPlayed
        ) || null;

        // Last played
        if (history.length > 0) {
            stats.lastPlayed = history[0].completedAt;
        }

        res.json({
            success: true,
            stats,
            partnerNames: {
                partner1: couple.partner1.name,
                partner2: couple.partner2.name
            }
        });
    } catch (error) {
        console.error('Get game stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get game stats',
            error: error.message
        });
    }
};

// ===========================================
// Join Game (for real-time multiplayer)
// ===========================================
const joinGame = async (req, res) => {
    try {
        const userId = req.user.id;
        const { gameId } = req.params;

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const game = await CoupleGame.findById(gameId);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        // Only allow joining if game is waiting for partner
        if (game.status !== 'waiting-partner') {
            return res.status(400).json({
                success: false,
                message: 'Game is not waiting for a partner'
            });
        }

        // Update game status to active
        game.status = 'active';
        await game.save();

        const isPartner1 = couple.partner1._id.toString() === userId;
        const partnerId = isPartner1 ? couple.partner2._id : couple.partner1._id;
        const partnerName = isPartner1 ? couple.partner2.name : couple.partner1.name;

        // Record interaction
        await recordInteraction(userId, couple._id, 'game');

        res.json({
            success: true,
            game: {
                id: game._id,
                gameType: game.gameType,
                currentItem: game.currentItem,
                boardState: game.boardState,
                status: game.status,
                currentRound: game.currentRound,
                scores: game.scores,
                players: game.players,
                isYourTurn: game.currentTurn?.toString() !== userId, // Joiner goes second
                yourSymbol: isPartner1 ? 'X' : 'O'
            },
            partner: {
                id: partnerId,
                name: partnerName
            }
        });
    } catch (error) {
        console.error('Join game error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join game',
            error: error.message
        });
    }
};

// ===========================================
// Make Move (for board games)
// ===========================================
const makeMove = async (req, res) => {
    try {
        const userId = req.user.id;
        const { gameId } = req.params;
        const { position, choice } = req.body; // position for board games, choice for RPS

        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }]
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        const game = await CoupleGame.findById(gameId);
        if (!game) {
            return res.status(404).json({
                success: false,
                message: 'Game not found'
            });
        }

        const isPartner1 = couple.partner1._id.toString() === userId;
        const partnerId = isPartner1 ? couple.partner2._id : couple.partner1._id;
        let result = { success: true };

        // Handle different game types
        if (game.gameType === 'tic-tac-toe') {
            // Verify it's this player's turn
            if (game.currentTurn?.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "It's not your turn"
                });
            }

            // Make move
            const board = game.currentItem.board;
            if (board[position] !== null) {
                return res.status(400).json({
                    success: false,
                    message: 'Position already taken'
                });
            }

            const symbol = isPartner1 ? 'X' : 'O';
            board[position] = symbol;
            game.currentItem.board = board;

            // Check for winner
            const winCombos = game.currentItem.winCombos;
            let winner = null;
            for (const combo of winCombos) {
                if (board[combo[0]] && 
                    board[combo[0]] === board[combo[1]] && 
                    board[combo[1]] === board[combo[2]]) {
                    winner = board[combo[0]];
                    break;
                }
            }

            // Check for draw
            const isDraw = !winner && board.every(cell => cell !== null);

            if (winner || isDraw) {
                game.status = 'completed';
                if (winner) {
                    if (winner === 'X') {
                        game.scores.partner1 += 1;
                    } else {
                        game.scores.partner2 += 1;
                    }
                }
                
                // Save history
                await GameHistory.create({
                    coupleId: couple._id,
                    gameType: game.gameType,
                    finalScores: game.scores,
                    winner: winner === 'X' ? couple.partner1._id : 
                            winner === 'O' ? couple.partner2._id : null,
                    totalRounds: 1,
                    responses: []
                });

                result.gameOver = true;
                result.winner = winner;
                result.isDraw = isDraw;
            } else {
                // Switch turns
                game.currentTurn = partnerId;
            }

            game.boardState = board;
            result.board = board;
            result.nextTurn = game.currentTurn;

        } else if (game.gameType === 'connect-four') {
            if (game.currentTurn?.toString() !== userId) {
                return res.status(400).json({
                    success: false,
                    message: "It's not your turn"
                });
            }

            const cols = game.currentItem.cols;
            const rows = game.currentItem.rows;
            const board = game.currentItem.board;
            const playerNum = isPartner1 ? 1 : 2;

            // Find lowest empty row in the column
            let row = -1;
            for (let r = rows - 1; r >= 0; r--) {
                if (board[r * cols + position] === null) {
                    row = r;
                    break;
                }
            }

            if (row === -1) {
                return res.status(400).json({
                    success: false,
                    message: 'Column is full'
                });
            }

            const idx = row * cols + position;
            board[idx] = playerNum;
            game.currentItem.board = board;
            game.currentItem.lastMove = { row, col: position };

            // Check for winner (4 in a row)
            const checkWin = (r, c, dr, dc) => {
                let count = 0;
                for (let i = 0; i < 4; i++) {
                    const nr = r + i * dr;
                    const nc = c + i * dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                        board[nr * cols + nc] === playerNum) {
                        count++;
                    }
                }
                return count === 4;
            };

            let winner = null;
            const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
            outer: for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    for (const [dr, dc] of directions) {
                        if (checkWin(r, c, dr, dc)) {
                            winner = playerNum;
                            break outer;
                        }
                    }
                }
            }

            const isDraw = !winner && board.every(cell => cell !== null);

            if (winner || isDraw) {
                game.status = 'completed';
                if (winner) {
                    if (winner === 1) game.scores.partner1 += 1;
                    else game.scores.partner2 += 1;
                }
                
                await GameHistory.create({
                    coupleId: couple._id,
                    gameType: game.gameType,
                    finalScores: game.scores,
                    winner: winner === 1 ? couple.partner1._id : 
                            winner === 2 ? couple.partner2._id : null,
                    totalRounds: 1,
                    responses: []
                });

                result.gameOver = true;
                result.winner = winner;
                result.isDraw = isDraw;
            } else {
                game.currentTurn = partnerId;
            }

            game.boardState = board;
            result.board = board;
            result.lastMove = game.currentItem.lastMove;
            result.nextTurn = game.currentTurn;

        } else if (game.gameType === 'rock-paper-scissors') {
            // Store choice
            if (isPartner1) {
                game.choices.partner1 = choice;
            } else {
                game.choices.partner2 = choice;
            }

            result.choiceRecorded = true;

            // If both have chosen, determine winner
            if (game.choices.partner1 && game.choices.partner2) {
                const p1 = game.choices.partner1;
                const p2 = game.choices.partner2;
                
                let roundWinner = 'draw';
                if (p1 !== p2) {
                    if ((p1 === 'rock' && p2 === 'scissors') ||
                        (p1 === 'paper' && p2 === 'rock') ||
                        (p1 === 'scissors' && p2 === 'paper')) {
                        roundWinner = 'partner1';
                        game.scores.partner1 += 1;
                    } else {
                        roundWinner = 'partner2';
                        game.scores.partner2 += 1;
                    }
                }

                game.rounds.push({
                    roundNumber: game.currentRound,
                    partner1Choice: p1,
                    partner2Choice: p2,
                    winner: roundWinner
                });

                result.roundResult = {
                    partner1Choice: p1,
                    partner2Choice: p2,
                    winner: roundWinner
                };

                // Check if game is over (best of 5)
                const winsNeeded = Math.ceil(game.currentItem.totalRounds / 2);
                if (game.scores.partner1 >= winsNeeded || game.scores.partner2 >= winsNeeded) {
                    game.status = 'completed';
                    
                    await GameHistory.create({
                        coupleId: couple._id,
                        gameType: game.gameType,
                        finalScores: game.scores,
                        winner: game.scores.partner1 > game.scores.partner2 ? couple.partner1._id : couple.partner2._id,
                        totalRounds: game.currentRound,
                        responses: game.rounds
                    });

                    result.gameOver = true;
                    result.finalWinner = game.scores.partner1 > game.scores.partner2 ? 'partner1' : 'partner2';
                } else {
                    // Reset for next round
                    game.choices.partner1 = null;
                    game.choices.partner2 = null;
                    game.currentRound += 1;
                }
            }
        }

        await game.save();

        res.json({
            success: true,
            result,
            game: {
                id: game._id,
                gameType: game.gameType,
                currentItem: game.currentItem,
                boardState: game.boardState,
                status: game.status,
                currentRound: game.currentRound,
                scores: game.scores,
                choices: game.choices,
                rounds: game.rounds,
                isYourTurn: game.currentTurn?.toString() === userId
            }
        });
    } catch (error) {
        console.error('Make move error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to make move',
            error: error.message
        });
    }
};

module.exports = {
    getAvailableGames,
    startGame,
    getActiveGame,
    submitResponse,
    getHint,
    skipQuestion,
    endGame,
    getGameHistory,
    getGameStats,
    joinGame,
    makeMove
};
