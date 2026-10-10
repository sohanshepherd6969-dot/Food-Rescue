const mongoose = require('mongoose');
const { CLAIM_STATUS } = require('../constants');

const pickupClaimSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodListing', required: true, index: true },
  donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: CLAIM_STATUS, default: 'claimed' },
  claimedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
});

module.exports = mongoose.model('PickupClaim', pickupClaimSchema);
