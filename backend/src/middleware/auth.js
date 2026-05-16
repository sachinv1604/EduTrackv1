/**
 * Authentication & Authorization Middleware
 * 
 * Middleware functions act like "Security Guards" at the entrance 
 * of our API routes. They check the user's ID card (JWT) before 
 * letting them through.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * PROTECT Middleware
 * 
 * This function ensures that a user is logged in.
 * It looks for a "Bearer Token" in the Authorization header.
 * Example Header: Authorization: Bearer eyJhbGciOiJIUzI1Ni...
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check if the "Authorization" header exists and starts with "Bearer"
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 2. Extract the token from the string "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      /**
       * 3. VERIFY TOKEN
       * jwt.verify checks if the token is valid and hasn't expired.
       * If valid, it returns the data we hid inside (the User ID).
       */
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      /**
       * 4. ATTACH USER TO REQUEST
       * We find the user in the database and attach them to the "req" object.
       * This makes "req.user" available to all future controllers in the chain!
       * We exclude the passwordHash for security.
       */
      req.user = await User.findById(decoded.id).select('-passwordHash');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // 5. NEXT()
      // Tells Express to move to the next function (the Controller)
      next();
    } catch (error) {
      console.error('[AUTH] Token verification failed:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  // 6. GUARD: If no token was found at all
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * ROLE CHECK Middleware (Higher-Order Function)
 * 
 * This allows us to restrict routes to specific roles.
 * Usage: roleCheck(['admin', 'coordinator'])
 * 
 * @param {string[]} roles - Array of allowed roles
 */
const roleCheck = (roles) => {
  return (req, res, next) => {
    // req.user was previously populated by the "protect" middleware
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
  };
};

module.exports = { protect, roleCheck };
