/**
 * Firebase Cloud Messaging (FCM) Utility
 * 
 * WHY IS THIS HERE? 
 * This is the "Voice" of the application. 
 * Standard HTTP requests (GET/POST) only work when the app is "Pulling" 
 * data while it is open. "Push" notifications allow the server to 
 * "Push" an alert to a phone even if the app is in the background or closed.
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Global flag to track if our connection to Google's servers is active.
let fcmInitialized = false;

/**
 * INITIALIZATION
 * To talk to Google, we need a "Service Account JSON". 
 * This is like a private username/password for our server.
 */
const initializeFCM = () => {
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (!serviceAccountPath) {
      console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_PATH missing. Notifications are disabled.');
      return;
    }

    const absolutePath = path.isAbsolute(serviceAccountPath) 
      ? serviceAccountPath 
      : path.join(process.cwd(), serviceAccountPath);

    if (!fs.existsSync(absolutePath)) {
      console.warn(`[FCM] Key file not found at ${absolutePath}. Notifications disabled.`);
      return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

    // The Admin SDK allows our server to act with full powers in Firebase.
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    fcmInitialized = true;
    console.log('[FCM] Firebase Connected!');
  } catch (error) {
    console.error('[FCM_INIT_ERR]', error.message);
  }
};

// Start the connection immediately when the server boots.
initializeFCM();

/**
 * SEND TO ONE (Direct Message)
 * 
 * @param {string} fcmToken - The "Phone Number" for push notifications.
 * @param {string} title - The big bold text (e.g. "SDM Bus 1")
 * @param {string} body - The small text (e.g. "Departed from SDM Main Gate")
 * @param {object} data - (Invisible) Key-value pairs to help the app navigate.
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmInitialized || !fcmToken) {
    console.log(`[FCM_OFFLINE] Notification skipped: ${title}`);
    return;
  }

  const message = {
    notification: { title, body },
    data, // This data can trigger logic inside the app (like opening a specific screen)
    token: fcmToken,
    android: {
      priority: 'high' // "High" means the phone will buzz immediately
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
          priority: 10
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('[FCM_SENT]', response);
    return response;
  } catch (error) {
    console.error('[FCM_SEND_ERR]', error);
    throw error;
  }
};

/**
 * SEND TO MANY (The "Broadcast")
 * Used for Notice distributions to hundreds of students at once.
 * 
 * @param {string[]} tokens - An array of dozens or hundreds of device tokens.
 */
const sendHighPriorityNotification = async (tokens, title, body, data = {}) => {
  if (!fcmInitialized || !tokens || tokens.length === 0) {
    console.warn(`[FCM_BATCH_OFFLINE] Skipping batch: ${title}`);
    return;
  }

  const message = {
    notification: { title, body },
    data,
    tokens, // Array of target devices
    android: {
      priority: 'high'
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
          priority: 10
        }
      }
    }
  };

  try {
    // sendEachForMulticast is optimized for batch delivery.
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM_BATCH_SENT] Success: ${response.successCount}, Failure: ${response.failureCount}`);
    return response;
  } catch (error) {
    console.error('[FCM_BATCH_ERR]', error);
    throw error;
  }
};

module.exports = {
  sendPushNotification,
  sendHighPriorityNotification
};
