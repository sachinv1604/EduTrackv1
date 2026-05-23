/**
 * OTP Model (Capitalized Casing for complete environment sync)
 * 
 * This model stores temporary 6-digit numeric OTPs generated during 
 * password resets. To prevent security vulnerabilities and clutter, 
 * we use MongoDB's native TTL (Time to Live) indexing. 
 * Expired OTP records are deleted automatically after 5 minutes (300 seconds).
 */
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  // The email address associated with the password reset request
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  // The secure hashed OTP (encrypted with bcrypt before storing)
  otp: {
    type: String,
    required: [true, 'OTP is required']
  },
  // The moment the OTP was generated
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Automatic self-deletion after 300s (5 minutes)
  }
}, {
  // Automatically manage timestamps if needed
  timestamps: true
});

module.exports = mongoose.model('Otp', otpSchema);
