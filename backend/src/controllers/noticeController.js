/**
 * Notice Controller
 * 
 * This is the "Communication Hub" of EduTrack. 
 * It handles the creation and distribution of announcements (Notices).
 * 
 * CORE FEATURES:
 * 1. Targeting: Sending notices only to specific groups (e.g. only Students on Route A).
 * 2. File Uploads: Attaching images or PDFs to notices.
 * 3. Push Notifications: Alerting phones in real-time.
 */
const Notice = require('../models/Notice');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/fcm');

/**
 * @desc    Create and broadcast new notice
 * @route   POST /api/notices
 * @access  Private (Admin, Coordinator)
 */
const createNotice = async (req, res) => {
  try {
    const { title, content, targetRoles, targetRoutes } = req.body;
    const authorId = req.user._id;

    /**
     * ATTACHMENT HANDLING (Multer)
     * If the user uploaded a file, Multer (in upload.js middleware) saved 
     * it and added 'filename' to the request. We store the URL path here.
     */
    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = `/uploads/notices/${req.file.filename}`;
    }

    /**
     * 1. DATABASE RECORD
     * NOTE: Multi-part form data (for files) sends arrays as JSON Strings. 
     * We must JSON.parse them back into Javascript Arrays for MongoDB.
     */
    const parsedRoutes = targetRoutes ? JSON.parse(targetRoutes) : [];
    const parsedRoles = targetRoles ? JSON.parse(targetRoles) : [];

    // v3 FEATURE: Delete any previous notices from this author or targeting these routes before saving
    if (parsedRoutes.length > 0) {
      await Notice.deleteMany({
        $or: [
          { targetRoutes: { $in: parsedRoutes } },
          { authorId: authorId }
        ]
      });
    } else {
      await Notice.deleteMany({ authorId: authorId });
    }

    const notice = await Notice.create({
      title,
      content,
      authorId,
      targetRoles: parsedRoles,
      targetRoutes: parsedRoutes,
      attachmentUrl
    });

    /**
     * 2. ASYNCHRONOUS BROADCAST
     * Sending 1,000 push notifications takes time. 
     * We trigger the broadcast in the "Background" and immediately send 
     * a success response to the HTTP client. This prevents the app 
     * from "Freezing" while waiting for the broadcast to finish.
     */
    broadcastNotice(notice); 

    res.status(201).json(notice);

  } catch (error) {
    console.error('[NOTICE_CREATE_ERR]', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * @desc    Get notices tailored for the CURRENT user
 * @route   GET /api/notices
 * @access  Private (Needs JWT)
 */
const getNotices = async (req, res) => {
  try {
    const { role, subscribedRoutes } = req.user;

    /**
     * MONGODB TARGETED QUERY (v3 Upgrade)
     * - Students strictly only see notices targeted to their subscribed routes from their coordinators.
     * - Other roles (driver, coordinator, admin) see role-targeted, route-targeted, or public notices.
     */
    let query = {};
    if (role === 'student') {
      query = { targetRoutes: { $in: subscribedRoutes } };
    } else {
      query = {
        $or: [
          { targetRoles: role },
          { targetRoutes: { $in: subscribedRoutes } },
          { 
            $and: [
              { targetRoles: { $size: 0 } },
              { targetRoutes: { $size: 0 } }
            ]
          }
        ]
      };
    }

    const notices = await Notice.find(query).sort({ createdAt: -1 }); // Newest announcements at the top!

    res.status(200).json(notices);

  } catch (error) {
    console.error('[NOTICE_FETCH_ERR]', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * Helper: Asynchronous broadcast logic
 * Finds all relevant devices (FCM tokens) and triggers the Firebase push.
 */
const broadcastNotice = async (notice) => {
  try {
    const { title, targetRoles, targetRoutes } = notice;

    /**
     * 1. FIND TARGET USERS
     * We look for users who match the filters AND have a recorded 
     * fcmToken for their phone.
     */
    const usersToNotify = await User.find({
      $or: [
        { role: { $in: targetRoles } },
        { subscribedRoutes: { $in: targetRoutes } }
      ],
      fcmToken: { $ne: null } 
    }).select('fcmToken'); // Optimisation: Only retrieve the token field.

    console.log(`[FCM_BROADCAST] Routing "${title}" to ${usersToNotify.length} devices.`);

    /**
     * 2. TRIGGER FCM
     * We loop through and fire off the notifications. 
     * Note: We use .catch on the inner calls to prevent one failed 
     * token from stopping the entire loop.
     */
    for (const user of usersToNotify) {
      sendPushNotification(
        user.fcmToken,
        `Broadcasting: ${title}`,
        'New update on EduTrack. Tap to view.',
        { noticeId: notice._id.toString() }
      ).catch(err => console.error(`[FCM_FAIL] Target ${user._id}: ${err.message}`));
    }

  } catch (error) {
    console.error('[FCM_BROADCAST_FATAL_ERR]', error);
  }
};

module.exports = {
  createNotice,
  getNotices
};
