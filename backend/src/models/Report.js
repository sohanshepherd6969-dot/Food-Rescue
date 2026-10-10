const mongoose = require('mongoose');
const { REPORT_STATUS } = require('../constants');

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['listing', 'user'], required: true },
  targetListingId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodListing' },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  status: { type: String, enum: REPORT_STATUS, default: 'open' },
  adminNotes: { type: String, trim: true, maxlength: 1000, default: '' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Report', reportSchema);
