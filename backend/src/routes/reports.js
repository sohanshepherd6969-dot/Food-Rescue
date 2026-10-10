const router = require('express').Router();
const Report = require('../models/Report');
const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');

/* Any donor/distributor can report a listing or a user; the admin reviews it. */
router.post('/', requireAuth, requireRole('donor', 'distributor'), asyncHandler(async (req, res) => {
  const { targetType, targetListingId, targetUserId, reason } = req.body;
  if (!reason || !String(reason).trim()) throw httpError(400, 'Please describe the problem.');

  const doc = { reporterId: req.user._id, targetType, reason };
  if (targetType === 'listing') {
    const listing = await FoodListing.findById(targetListingId);
    if (!listing) throw httpError(404, 'Listing not found.');
    Object.assign(doc, { targetListingId: listing._id, targetUserId: listing.donorId });
  } else if (targetType === 'user') {
    if (!(await User.exists({ _id: targetUserId }))) throw httpError(404, 'User not found.');
    doc.targetUserId = targetUserId;
  } else {
    throw httpError(400, 'targetType must be listing or user.');
  }

  res.status(201).json({ report: await Report.create(doc) });
}));

module.exports = router;
