/**
 * Notice Model
 * 
 * This model represents announcements or broadcasts sent by Admin or Coordinators.
 * It is designed for "Targeted Broadcasting" — allowing a message to be 
 * private to one group or public to everyone.
 */
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
  // The headline of the announcement (e.g. "Holiday Tomorrow")
  title: {
    type: String,
    required: [true, 'Notice title is required'],
    trim: true
  },
  // The full body text of the message.
  content: {
    type: String,
    required: [true, 'Notice content is required']
  },
  // The administrator or coordinator who wrote the message.
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author identity is required']
  },
  /**
   * TARGETING (Roles)
   * If this array has values (e.g. ['driver']), only users with that 
   * role will see this notice in their feed.
   */
  targetRoles: {
    type: [String],
    enum: ['student', 'driver', 'coordinator', 'admin'],
    default: []
  },
  /**
   * TARGETING (Routes)
   * If this array has IDs, only users tracking those specific routes 
   * will receive the notification.
   */
  targetRoutes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  }],
  // The relative URL path to a file (image/PDF) hosted on our server.
  attachmentUrl: {
    type: String,
    default: null
  },
}, {
  // timestamps: true gives us 'createdAt' (The date the notice was sent).
  timestamps: true
});

module.exports = mongoose.model('Notice', noticeSchema);
