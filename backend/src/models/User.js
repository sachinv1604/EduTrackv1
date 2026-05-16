/**
 * User Model
 * This model defines the structure of a "User" in our MongoDB database. 
 * We use Mongoose to interact with the database in a structured way.
 */
const mongoose = require('mongoose');

// The Schema defines the shape of the documents within a collection.
const userSchema = new mongoose.Schema({
  // Full name of the user (Student, Driver, etc.)
  name: {
    type: String,
    required: [true, 'Please provide a name'], // Ensures name is not empty
    trim: true // Removes leading and trailing whitespace
  },
  // Unique email address used for login and identification
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true, // Prevents duplicate emails in the database
    lowercase: true, // Stores all emails in lowercase for consistency
    // Regex validation to ensure the email format is correct
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  // Phone number for contact and tracking notifications
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    unique: true
  },
  // Role-based access control (RBAC). 
  // Determines what the user can see and do in the app.
  role: {
    type: String,
    // Enum restricts the value to only these 4 specific strings
    enum: {
      values: ['student', 'driver', 'coordinator', 'admin'],
      message: '{VALUE} is not a valid role'
    },
    default: 'student' // Most users will be students by default
  },
  // Encrypted password (never store plain-text passwords!)
  passwordHash: {
    type: String,
    required: [true, 'Please provide a password hash']
  },
  // Token for Firebase Cloud Messaging (Push Notifications)
  fcmToken: {
    type: String,
    default: null
  },
  // Array of Route IDs that a Student is interested in tracking
  subscribedRoutes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route' // Connects this ID back to the "Route" collection
  }],
  // For Drivers: The specific Route they are currently driving
  assignedRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null
  },
  // Administrative approval flag (e.g., for Drivers or Coordinators)
  isApproved: {
    type: Boolean,
    default: false
  },
  // For Students: The route they have asked to join
  requestedRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null
  }
}, {
  // Automatically adds "createdAt" and "updatedAt" fields to the document
  timestamps: true
});

// Create and export the Model based on the Schema
module.exports = mongoose.model('User', userSchema);
