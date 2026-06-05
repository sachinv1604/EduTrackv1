/**
 * Authentication Controller
 * 
 * This file handles User Identity. It manages how users sign up, 
 * how they prove who they are (login), and how they manage their profiles.
 * 
 * CORE SECURITY CONCEPTS:
 * 1. BCrypt: A library for hashing passwords. We never store passwords as text.
 * 2. JWT (JSON Web Token): A digital "ID card" that identifies a logged-in user.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Otp = require('../models/OTP');
const { sendOtpEmail } = require('../utils/email');

/**
 * Helper: Generate JSON Web Token (JWT)
 * 
 * What is a JWT?
 * It's like a digital "Access Pass". Once a user logs in, we give them this 
 * encrypted string. They send it back in the header (Bearer token) of every 
 * future request to prove they are logged in without sending their password again.
 * 
 * @param {string} id - The MongoDB User ID to embed in the token
 */
const generateToken = (id) => {
  // We sign the ID payload with our secret key (from .env)
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d' // Token lasts for 30 days
  });
};

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    // SANITIZE INPUTS: Trim all string fields to eliminate trailing/leading spaces
    // This prevents Mongoose ValidatorError when user accidentally has a space in their email
    const name = req.body.name?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const phone = req.body.phone?.trim();
    const role = req.body.role;
    const password = req.body.password;
    const requestedRoute = req.body.requestedRoute;

    // 1. DUPLICATE CHECK: Email & Phone must be unique in our system.
    const userExists = await User.findOne({ 
      $or: [{ email }, { phone }] 
    });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email or phone' });
    }

    /**
     * 2. PASSWORD HASHING (Security 101)
     * NEVER store passwords in plain text. If the database is hacked, 
     * plain passwords would be stolen. 
     * 
     * Hashing is a one-way mathematical function that turns "password123" 
     * into a long string like "a8f3...". 
     * 
     * SALT: A random string added to the password BEFORE hashing to make 
     * rainbow-table attacks (pre-computed hash lists) impossible.
     */
    const salt = await bcrypt.genSalt(10); 
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. DATABASE INSERT
    const user = await User.create({
      name,
      email,
      phone,
      role: role || 'student', // Defaults to student if not provided
      passwordHash,
      requestedRoute,
      isApproved: false // THE GATEKEEPER: All new accounts start as "Inactive/Pending"
    });

    if (user) {
      res.status(201).json({
        message: 'Account created! Please wait for administrative approval before logging in.'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data provided' });
    }
  } catch (error) {
    console.error('[AUTH_REGISTER_ERROR]', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. FETCH USER: Find the record by email
    const user = await User.findOne({ email });

    /**
     * 2. BCrypt Comparison
     * Since we can't "Reverse" a hash to see the password, we take the 
     * typed password, hash it using the same salt, and see if the NEW hash 
     * matches the OLD hash in our database.
     */
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      
      /**
       * 3. THE APPROVAL LOCK
       * Even with a valid password, the system prevents access if 
       * isApproved is false. This allows admins to vet new signups.
       */
      if (!user.isApproved) {
        return res.status(403).json({ message: 'Your account is pending coordinator approval.' });
      }

      // 4. SUCCESS: Return user info + JWT
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        assignedRoute: user.assignedRoute,
        subscribedRoutes: user.subscribedRoutes,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('[AUTH_LOGIN_ERROR]', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
};

/**
 * @desc    Get Current User Profile
 * @route   GET /api/auth/me
 * @access  Private (Needs JWT)
 */
const getMe = async (req, res) => {
  try {
    /**
     * req.user was populated by the "protect" middleware 
     * by decoding the JWT and fetching the user from DB.
     */
    res.status(200).json(req.user);
  } catch (error) {
    console.error('[AUTH_ME_ERROR]', error);
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};

/**
 * @desc    Update My Profile
 * @route   PUT /api/auth/me
 * @access  Private
 */
const updateMe = async (req, res) => {
  try {
    const { name, phone, subscribedRoutes } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Conditional Updates: Only update fields if they were sent in the request
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (subscribedRoutes) user.subscribedRoutes = subscribedRoutes;

    const updatedUser = await user.save();
    
    res.status(200).json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      role: updatedUser.role,
      subscribedRoutes: updatedUser.subscribedRoutes
    });
  } catch (error) {
    console.error('[AUTH_UPDATE_ERROR]', error);
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
};

/**
 * @desc    Request Password Reset (Generates and sends OTP)
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const lowercaseEmail = email.toLowerCase().trim();

    // 1. Verify User Exists
    const user = await User.findOne({ email: lowercaseEmail });
    if (!user) {
      return res.status(404).json({ message: 'No registered account found with this email' });
    }

    // 2. Generate random 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Encrypt/Hash the OTP before storing it for absolute security (bcrypt)
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(rawOtp, salt);

    // 4. Clean up any existing OTPs for this email to avoid duplicates
    await Otp.deleteMany({ email: lowercaseEmail });

    // 5. Store OTP in database
    await Otp.create({
      email: lowercaseEmail,
      otp: hashedOtp
    });

    // 6. Send the email containing the raw OTP
    await sendOtpEmail(lowercaseEmail, rawOtp);

    res.status(200).json({ message: 'A secure 6-digit code has been sent to your email.' });
  } catch (error) {
    console.error('[AUTH_FORGOT_ERR]', error);
    res.status(500).json({ message: 'Error processing forgot password request', error: error.message });
  }
};

/**
 * @desc    Verify OTP and Reset Password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, OTP code, and new password are required' });
    }

    const lowercaseEmail = email.toLowerCase().trim();

    // 1. Fetch OTP record
    const otpRecord = await Otp.findOne({ email: lowercaseEmail });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Verification code has expired or is invalid' });
    }

    // 2. Verify OTP matches the hashed value
    const otpMatch = await bcrypt.compare(otp.trim(), otpRecord.otp);
    if (!otpMatch) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // 3. Fetch User
    const user = await User.findOne({ email: lowercaseEmail });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    // 4. Hashing new password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 5. Update user and clean up DB
    user.passwordHash = passwordHash;
    await user.save();
    
    // Wipe OTP record so it can never be used again
    await Otp.deleteMany({ email: lowercaseEmail });

    res.status(200).json({ message: 'Password has been reset successfully! You can now log in.' });
  } catch (error) {
    console.error('[AUTH_RESET_ERR]', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  forgotPassword,
  resetPassword
};
