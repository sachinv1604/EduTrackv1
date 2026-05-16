/**
 * User Controller
 * 
 * Manages user-specific data that isn't directly related to Identity/Login.
 * Key tasks: Push notification linking, User filtering by role, and the 
 * administrative "Approval" workflow.
 */
const User = require('../models/User');
const Route = require('../models/Route'); 

/**
 * @desc    Update FCM token for push notifications
 * @route   POST /api/users/fcm-token
 * @access  Private (Needs JWT)
 * 
 * WHY IS THIS HERE? 
 * This is the bridge between the App and Firebase.
 * Every time the mobile app starts, it receives a fresh "Push Token" from 
 * Google/Apple. We MUST save this in our database so the backend knows 
 * exactly which "Device ID" to target when the bus departs or a notice is sent.
 */
const updateFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ message: 'FCM token is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.fcmToken = fcmToken;
    await user.save();

    res.status(200).json({ message: 'FCM token updated successfully' });

  } catch (error) {
    console.error('[USER_FCM_UPDATE_ERR]', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * @desc    Get all students who are tracking a coordinator's route
 */
const getStudentsByRoute = async (req, res) => {
  try {
    const { assignedRoute } = req.user;

    if (!assignedRoute) {
      return res.status(400).json({ message: 'No route assigned to this coordinator' });
    }

    /**
     * FILTERING QUERY
     * We look for students whose "subscribedRoutes" array includes 
     * the coordinator's assigned route ID.
     */
    const students = await User.find({
      role: 'student',
      subscribedRoutes: assignedRoute 
    }).select('name email phone');

    res.status(200).json(students);
  } catch (error) {
    console.error('[USER_FETCH_STUDENTS_ERR]', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * @desc    Fetch lists of users by their role (Admin only)
 */
const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;

    /**
     * POLICY CHECK:
     * Admins manage staff (Drivers/Coordinators). 
     * Students are managed by Coordinators. 
     * This logic enforces that separation of duties.
     */
    if (req.user.role === 'admin' && role === 'student') {
      return res.status(403).json({ message: 'Admins manage staff; students are managed by coordinators.' });
    }

    // .select('-passwordHash') ensures we never send sensitive data to the UI
    const users = await User.find({ role }).select('-passwordHash');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Update a user's role (Admin only)
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    res.status(400).json({ message: 'Role update failed', error: error.message });
  }
};

/**
 * @desc    Get users waiting for approval
 * 
 * Admins see: Drivers/Coordinators waiting for access.
 * Coordinators see: Students waiting to join their specific bus.
 */
const getPendingApprovals = async (req, res) => {
  try {
    let query = { isApproved: false };

    if (req.user.role === 'admin') {
      // Admins handle high-level staff onboarding
      query.role = { $in: ['driver', 'coordinator'] };
    } else if (req.user.role === 'coordinator') {
      // Coordinators handle the registration of residents/students on their route
      if (!req.user.assignedRoute) {
        return res.status(400).json({ message: 'No route assigned to coordinator' });
      }
      query.role = 'student';
      query.requestedRoute = req.user.assignedRoute;
    } else {
      return res.status(403).json({ message: 'Unauthorized for approval queue' });
    }

    const pending = await User.find(query).select('name email phone role requestedRoute');
    res.status(200).json(pending);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

/**
 * @desc    Approve user and handle automatic assignments
 * 
 * This is a "Heavy Lifter" function. Approving a user isn't just toggling 
 * a boolean; it's about forming links between Users and Routes.
 */
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role-based authorization for approval
    if (req.user.role === 'coordinator' && user.role !== 'student') {
      return res.status(403).json({ message: 'Coordinators can only approve students' });
    }

    user.isApproved = true;

    /**
     * SIDE EFFECT: STUDENT AUTO-LINKING
     * Once a student is approved, we officially assign them to the 
     * route they requested. This allows them to see the bus on their map.
     */
    if (user.role === 'student') {
      let targetRouteId = user.requestedRoute;
      
      // If approved by a coordinator, strictly assign to THEIR route instead of the "requested" one
      if (req.user.role === 'coordinator' && req.user.assignedRoute) {
        targetRouteId = req.user.assignedRoute;
      }
      
      if (targetRouteId) {
        user.assignedRoute = targetRouteId;
        // Auto-subscribe them so they get departure notifications
        if (!user.subscribedRoutes.includes(targetRouteId)) {
          user.subscribedRoutes.push(targetRouteId);
        }
      }
    }

    /**
     * SIDE EFFECT: STAFF CROSS-LINKING
     * For Drivers/Coordinators, we must also update the "Route" document 
     * so that the bus "knows" who its driver/coordinator is.
     */
    if ((user.role === 'driver' || user.role === 'coordinator') && user.requestedRoute) {
      user.assignedRoute = user.requestedRoute;
      
      const route = await Route.findById(user.requestedRoute);
      if (route) {
        if (user.role === 'driver') {
          route.driverId = user._id;
        } else if (user.role === 'coordinator') {
          route.coordinatorId = user._id;
        }
        await route.save(); // Bidirectional link established!
      }
    }

    await user.save();

    res.status(200).json({
      _id: user._id,
      name: user.name,
      isApproved: user.isApproved
    });
  } catch (error) {
    res.status(400).json({ message: 'Approval failed', error: error.message });
  }
};

/**
 * @desc    Fetch personal profile (sanitized)
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  updateFCMToken,
  getStudentsByRoute,
  getUsersByRole,
  updateUserRole,
  getPendingApprovals,
  approveUser,
  getMe
};
