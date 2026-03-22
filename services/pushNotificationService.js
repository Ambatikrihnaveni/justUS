// ===========================================
// Push Notification Service
// Handles Firebase Cloud Messaging for push notifications
// ===========================================

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

const initializeFirebase = () => {
    if (firebaseInitialized) return true;
    
    try {
        // Check if service account is configured
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            firebaseInitialized = true;
            console.log('🔥 Firebase Admin SDK initialized');
            return true;
        } else if (process.env.FIREBASE_PROJECT_ID) {
            // Use individual environment variables
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
            firebaseInitialized = true;
            console.log('🔥 Firebase Admin SDK initialized');
            return true;
        } else {
            console.warn('⚠️ Firebase not configured - push notifications disabled');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error);
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
