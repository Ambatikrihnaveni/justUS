// ===========================================
// Love Story Controller
// Handles story generation and management
// ===========================================

const LoveStory = require('../models/LoveStory');
const Couple = require('../models/Couple');
const TimelineEvent = require('../models/TimelineEvent');
const Message = require('../models/Message');
const User = require('../models/User');

// ===========================================
// Story Generation Templates
// ===========================================

const STORY_TEMPLATES = {
    romantic: {
        opening: [
            "Every great love story begins with a moment that changes everything.",
            "Some stories are written in the stars, and ours was destined to be extraordinary.",
            "In the tapestry of life, our threads were always meant to intertwine."
        ],
        firstMeet: [
            "On {date}, fate brought us together for the first time. {location}It was a moment that would change both our lives forever.",
            "Our story began on {date}{location} — a day that would become the first chapter of our greatest adventure.",
            "The universe conspired to bring us together on {date}.{location} From that moment, nothing would ever be the same."
        ],
        milestone: [
            "As our love grew stronger, we reached a beautiful milestone: {event}. It was {date}, a day etched in our hearts.",
            "On {date}, we celebrated {event} — another precious moment in our journey together.",
            "{event} marked a special chapter on {date}, proving that our love continues to blossom."
        ],
        closing: [
            "And so our story continues, written one day at a time, with love as our guide.",
            "This is just the beginning. Every day together adds a new beautiful page to our love story.",
            "Our journey together is far from over — the best chapters are yet to be written."
        ]
    },
    playful: {
        opening: [
            "Buckle up, because this love story is quite the ride! 🎢",
            "Warning: This story contains excessive amounts of love, laughter, and happily-ever-after vibes!",
            "Once upon a time (but way cooler than any fairy tale)..."
        ],
        firstMeet: [
            "Plot twist! On {date}, we crossed paths{location} and BAM — sparks flew everywhere!",
            "So there we were on {date}{location} — totally unaware that we'd just met our favorite person!",
            "{date} was just another day... until it wasn't!{location} That's when the magic started ✨"
        ],
        milestone: [
            "Level unlocked! 🎮 On {date}, we achieved {event}!",
            "Achievement earned: {event}! We hit this milestone on {date} and it was AMAZING!",
            "Adding {event} to our highlight reel! This epic moment happened on {date}."
        ],
        closing: [
            "And they lived adorably ever after... (spoiler: that's us!) 💕",
            "To be continued... because our adventure never stops! 🚀",
            "The end? Nah, this is just the beginning of forever! 💫"
        ]
    },
    poetic: {
        opening: [
            "Like verses in an endless poem, our love unfolds with beauty untold.",
            "Two souls dancing through time, finding rhythm in each other's rhyme.",
            "In the garden of life, love bloomed between us like the rarest flower."
        ],
        firstMeet: [
            "When {date} dawned,{location} two hearts began their eternal dance, not knowing the symphony they would create together.",
            "On {date}, the universe whispered our names together for the first time.{location} And so began our poetry.",
            "{date} — the day when two wandering souls found their home in each other's eyes.{location}"
        ],
        milestone: [
            "Like petals unfolding, {event} graced our journey on {date}, painting our story with deeper hues of love.",
            "On {date}, {event} added another verse to our love poem — beautiful, timeless, ours.",
            "The chapter of {event} opened on {date}, each word written in the ink of devotion."
        ],
        closing: [
            "And thus we write on, two pens sharing one heart, one story, one eternal love.",
            "Our poem has no ending, only infinite verses of tomorrow's love.",
            "In the book of life, our pages remain forever intertwined, forever beautiful."
        ]
    },
    classic: {
        opening: [
            "This is the story of two people who found in each other everything they had been searching for.",
            "What follows is a testament to love — genuine, enduring, and true.",
            "Some love stories become legends. This is ours."
        ],
        firstMeet: [
            "It was {date} when our paths first crossed.{location} In that moment, something extraordinary began.",
            "On {date},{location} we met for the first time. Little did we know, this was the beginning of forever.",
            "Our story commenced on {date}.{location} From that day forward, our lives would be beautifully intertwined."
        ],
        milestone: [
            "On {date}, we marked an important milestone: {event}. It represented another step in our journey together.",
            "{event} came to pass on {date}, strengthening the foundation of our love.",
            "The occasion of {event} on {date} added another precious memory to our collection."
        ],
        closing: [
            "And so our story continues, grounded in love and looking toward a bright future together.",
            "This chapter closes, but our story endures — timeless and ever-growing.",
            "What we have built together stands as a testament to the power of true love."
        ]
    },
    modern: {
        opening: [
            "Real talk: our love story is pretty amazing, and here's how it all went down.",
            "Let's be honest — finding 'the one' seemed impossible. Then everything changed.",
            "In a world of swipes and DMs, we found something real. Here's our story."
        ],
        firstMeet: [
            "Fast forward to {date}{location} — that's when we actually met and things got interesting.",
            "So {date} happened.{location} We connected, and honestly? It just felt right from the start.",
            "On {date},{location} we finally crossed paths. No games, no pretense — just genuine connection."
        ],
        milestone: [
            "Major moment alert: {event} went down on {date}. Total relationship upgrade!",
            "{date} brought us {event}. Another win for team us!",
            "Can we talk about {event}? Because {date} was seriously next level for us."
        ],
        closing: [
            "The story's still being written, but honestly? We're loving every chapter.",
            "That's us — imperfect, real, and totally in love. Here's to whatever comes next.",
            "Our story isn't a fairy tale, it's better. It's real, it's ours, and it's ongoing."
        ]
    }
};

const EVENT_ICONS = {
    'first_meet': '💫',
    'first_date': '🌹',
    'first_kiss': '💋',
    'first_trip': '✈️',
    'moved_in': '🏠',
    'engagement': '💍',
    'wedding': '💒',
    'anniversary': '🎉',
    'milestone': '⭐',
    'travel': '🌍',
    'achievement': '🏆',
    'special_moment': '💖',
    'custom': '💕'
};

// ===========================================
// Helper Functions
// ===========================================

const getRandomTemplate = (templates) => {
    return templates[Math.floor(Math.random() * templates.length)];
};

const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
};

const calculateDaysTogether = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
};

const extractFavoriteWords = (messages) => {
    const wordCount = {};
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
        'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
        'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
        'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
        'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until',
        'while', 'although', 'though', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours',
        'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its',
        'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
        'those', 'am', 'been', 'being', 'get', 'got', 'ok', 'okay', 'yeah', 'yes', 'no',
        'like', 'just', 'know', 'think', 'want', 'going', 'see', 'come', 'go', 'make']);
    
    const loveWords = new Set(['love', 'miss', 'beautiful', 'amazing', 'wonderful', 'perfect',
        'happy', 'forever', 'always', 'together', 'heart', 'darling', 'sweetheart', 'honey',
        'babe', 'baby', 'dear', 'precious', 'special', 'incredible', 'awesome', 'fantastic']);

    messages.forEach(msg => {
        if (msg.type === 'text' && msg.message) {
            const words = msg.message.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
            words.forEach(word => {
                if (!stopWords.has(word)) {
                    wordCount[word] = (wordCount[word] || 0) + 1;
                    // Boost love-related words
                    if (loveWords.has(word)) {
                        wordCount[word] += 2;
                    }
                }
            });
        }
    });

    return Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
};

// ===========================================
// Generate Love Story
// ===========================================

const generateStory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { style = 'romantic' } = req.body;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        // Get partner names
        const partner1Name = couple.partner1?.name || 'Partner 1';
        const partner2Name = couple.partner2?.name || 'Partner 2';

        // Get timeline events
        const timelineEvents = await TimelineEvent.find({ coupleId: couple._id })
            .sort({ eventDate: 1 });

        // Get messages for stats
        const messages = await Message.find({
            $or: [
                { senderId: couple.partner1._id, receiverId: couple.partner2._id },
                { senderId: couple.partner2._id, receiverId: couple.partner1._id }
            ]
        }).select('message type createdAt');

        // Get photo count
        const photoCount = await Message.countDocuments({
            $or: [
                { senderId: couple.partner1._id, receiverId: couple.partner2._id },
                { senderId: couple.partner2._id, receiverId: couple.partner1._id }
            ],
            type: 'image'
        });

        // Calculate stats
        const daysTogether = calculateDaysTogether(couple.firstMeetDate || couple.createdAt);
        const favoriteWords = extractFavoriteWords(messages);

        // Get templates for the selected style
        const templates = STORY_TEMPLATES[style] || STORY_TEMPLATES.romantic;

        // Build the story chapters
        const chapters = [];
        let chapterOrder = 0;

        // Opening chapter
        chapters.push({
            title: 'Prologue',
            content: getRandomTemplate(templates.opening),
            icon: '📖',
            order: chapterOrder++
        });

        // First meeting chapter (if we have the date)
        if (couple.firstMeetDate) {
            let locationText = '';
            if (couple.firstDateLocation) {
                locationText = ` at ${couple.firstDateLocation}, `;
            } else {
                locationText = ' ';
            }
            
            const meetContent = getRandomTemplate(templates.firstMeet)
                .replace('{date}', formatDate(couple.firstMeetDate))
                .replace('{location}', locationText);

            chapters.push({
                title: 'Where It All Began',
                content: meetContent,
                eventDate: couple.firstMeetDate,
                icon: '💫',
                order: chapterOrder++
            });
        }

        // Timeline events as chapters
        for (const event of timelineEvents) {
            const eventContent = getRandomTemplate(templates.milestone)
                .replace('{date}', formatDate(event.eventDate))
                .replace('{event}', event.title.toLowerCase());

            let fullContent = eventContent;
            if (event.description) {
                fullContent += ` ${event.description}`;
            }

            chapters.push({
                title: event.title,
                content: fullContent,
                eventDate: event.eventDate,
                icon: EVENT_ICONS[event.eventType] || '💕',
                order: chapterOrder++
            });
        }

        // Important dates from couple profile
        if (couple.engagementDate) {
            const engagementContent = getRandomTemplate(templates.milestone)
                .replace('{date}', formatDate(couple.engagementDate))
                .replace('{event}', 'our engagement');

            chapters.push({
                title: 'The Proposal',
                content: engagementContent,
                eventDate: couple.engagementDate,
                icon: '💍',
                order: chapterOrder++
            });
        }

        if (couple.weddingDate) {
            const weddingContent = getRandomTemplate(templates.milestone)
                .replace('{date}', formatDate(couple.weddingDate))
                .replace('{event}', 'our wedding day');

            chapters.push({
                title: 'The Big Day',
                content: weddingContent,
                eventDate: couple.weddingDate,
                icon: '💒',
                order: chapterOrder++
            });
        }

        // Statistics chapter
        const statsChapter = `Over ${daysTogether.toLocaleString()} days together, we've shared ${messages.length.toLocaleString()} messages and captured ${photoCount.toLocaleString()} photos. `;
        const wordsChapter = favoriteWords.length > 0 
            ? `Our favorite words to each other include "${favoriteWords.slice(0, 3).map(w => w.word).join('", "')}" — each one a small testament to our love.`
            : '';

        chapters.push({
            title: 'By the Numbers',
            content: statsChapter + wordsChapter,
            icon: '📊',
            order: chapterOrder++
        });

        // Closing chapter
        chapters.push({
            title: 'To Be Continued...',
            content: getRandomTemplate(templates.closing),
            icon: '💕',
            order: chapterOrder++
        });

        // Sort chapters by date where applicable
        chapters.sort((a, b) => {
            if (a.order === 0) return -1; // Prologue always first
            if (b.order === 0) return 1;
            if (a.title === 'By the Numbers') return 1; // Stats near end
            if (b.title === 'By the Numbers') return -1;
            if (a.title === 'To Be Continued...') return 1; // Closing always last
            if (b.title === 'To Be Continued...') return -1;
            if (a.eventDate && b.eventDate) {
                return new Date(a.eventDate) - new Date(b.eventDate);
            }
            return a.order - b.order;
        });

        // Generate full story text
        const generatedStory = chapters.map(ch => 
            `## ${ch.icon} ${ch.title}\n\n${ch.content}`
        ).join('\n\n');

        // Create or update love story document
        let loveStory = await LoveStory.findOne({ coupleId: couple._id });

        if (!loveStory) {
            loveStory = new LoveStory({
                coupleId: couple._id,
                title: couple.coupleName 
                    ? `${couple.coupleName}'s Love Story`
                    : `${partner1Name} & ${partner2Name}'s Love Story`
            });
        }

        loveStory.generatedStory = generatedStory;
        loveStory.chapters = chapters;
        loveStory.style = style;
        loveStory.lastGenerated = new Date();
        loveStory.stats = {
            totalDaysTogether: daysTogether,
            totalMessages: messages.length,
            totalEvents: timelineEvents.length,
            totalPhotos: photoCount,
            favoriteWords
        };

        await loveStory.save();

        res.json({
            success: true,
            data: {
                story: loveStory,
                partnerNames: { partner1: partner1Name, partner2: partner2Name }
            }
        });

    } catch (error) {
        console.error('Generate story error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate love story'
        });
    }
};

// ===========================================
// Get Love Story
// ===========================================

const getStory = async (req, res) => {
    try {
        const userId = req.user._id;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        }).populate('partner1 partner2', 'name');

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        let loveStory = await LoveStory.findOne({ coupleId: couple._id });

        // If no story exists, return empty with couple info
        if (!loveStory) {
            return res.json({
                success: true,
                data: {
                    story: null,
                    partnerNames: {
                        partner1: couple.partner1?.name || 'Partner 1',
                        partner2: couple.partner2?.name || 'Partner 2'
                    },
                    hasStory: false
                }
            });
        }

        res.json({
            success: true,
            data: {
                story: loveStory,
                partnerNames: {
                    partner1: couple.partner1?.name || 'Partner 1',
                    partner2: couple.partner2?.name || 'Partner 2'
                },
                hasStory: true
            }
        });

    } catch (error) {
        console.error('Get story error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get love story'
        });
    }
};

// ===========================================
// Update/Edit Love Story
// ===========================================

const updateStory = async (req, res) => {
    try {
        const userId = req.user._id;
        const { title, editedStory, chapters } = req.body;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        let loveStory = await LoveStory.findOne({ coupleId: couple._id });

        if (!loveStory) {
            return res.status(404).json({
                success: false,
                message: 'Love story not found. Generate one first.'
            });
        }

        // Update fields
        if (title) loveStory.title = title;
        if (editedStory !== undefined) {
            loveStory.editedStory = editedStory;
            loveStory.isCustomized = true;
        }
        if (chapters) {
            loveStory.chapters = chapters;
            loveStory.isCustomized = true;
        }

        loveStory.lastEdited = new Date();
        await loveStory.save();

        res.json({
            success: true,
            message: 'Love story updated successfully',
            data: { story: loveStory }
        });

    } catch (error) {
        console.error('Update story error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update love story'
        });
    }
};

// ===========================================
// Add Custom Chapter
// ===========================================

const addChapter = async (req, res) => {
    try {
        const userId = req.user._id;
        const { title, content, eventDate, icon = '💕' } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        let loveStory = await LoveStory.findOne({ coupleId: couple._id });

        if (!loveStory) {
            return res.status(404).json({
                success: false,
                message: 'Love story not found. Generate one first.'
            });
        }

        // Add new chapter
        const newChapter = {
            title,
            content,
            eventDate: eventDate ? new Date(eventDate) : null,
            icon,
            order: loveStory.chapters.length
        };

        loveStory.chapters.push(newChapter);
        loveStory.isCustomized = true;
        loveStory.lastEdited = new Date();
        await loveStory.save();

        res.json({
            success: true,
            message: 'Chapter added successfully',
            data: { chapter: newChapter, story: loveStory }
        });

    } catch (error) {
        console.error('Add chapter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add chapter'
        });
    }
};

// ===========================================
// Delete Chapter
// ===========================================

const deleteChapter = async (req, res) => {
    try {
        const userId = req.user._id;
        const { chapterIndex } = req.params;

        // Find couple
        const couple = await Couple.findOne({
            $or: [{ partner1: userId }, { partner2: userId }],
            isComplete: true
        });

        if (!couple) {
            return res.status(404).json({
                success: false,
                message: 'Couple not found'
            });
        }

        let loveStory = await LoveStory.findOne({ coupleId: couple._id });

        if (!loveStory) {
            return res.status(404).json({
                success: false,
                message: 'Love story not found'
            });
        }

        const index = parseInt(chapterIndex);
        if (index < 0 || index >= loveStory.chapters.length) {
            return res.status(400).json({
                success: false,
                message: 'Invalid chapter index'
            });
        }

        loveStory.chapters.splice(index, 1);
        loveStory.isCustomized = true;
        loveStory.lastEdited = new Date();
        await loveStory.save();

        res.json({
            success: true,
            message: 'Chapter deleted successfully',
            data: { story: loveStory }
        });

    } catch (error) {
        console.error('Delete chapter error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete chapter'
        });
    }
};

// ===========================================
// Get Story Styles
// ===========================================

const getStyles = async (req, res) => {
    try {
        const styles = [
            { id: 'romantic', name: 'Romantic', emoji: '💕', description: 'Classic and heartfelt' },
            { id: 'playful', name: 'Playful', emoji: '🎉', description: 'Fun and lighthearted' },
            { id: 'poetic', name: 'Poetic', emoji: '✨', description: 'Artistic and eloquent' },
            { id: 'classic', name: 'Classic', emoji: '📜', description: 'Timeless and elegant' },
            { id: 'modern', name: 'Modern', emoji: '💫', description: 'Contemporary and real' }
        ];

        res.json({
            success: true,
            data: { styles }
        });

    } catch (error) {
        console.error('Get styles error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get styles'
        });
    }
};

module.exports = {
    generateStory,
    getStory,
    updateStory,
    addChapter,
    deleteChapter,
    getStyles
};
