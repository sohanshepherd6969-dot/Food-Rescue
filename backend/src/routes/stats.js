const router = require('express').Router();
const User = require('../models/User');
const FoodListing = require('../models/FoodListing');
const PickupClaim = require('../models/PickupClaim');
const asyncHandler = require('../utils/asyncHandler');
const { FOOD_TYPES, KITCHEN_TYPES, LISTING_AREAS, AREAS, PRICES } = require('../constants');

/* Public impact numbers for the landing page (real counts from the database). */
router.get('/public', asyncHandler(async (req, res) => {
  const [donors, distributors, completed, available] = await Promise.all([
    User.countDocuments({ role: 'donor', status: 'active' }),
    User.countDocuments({ role: 'distributor', status: 'active' }),
    PickupClaim.aggregate([
      { $match: { status: 'completed' } },
      { $lookup: { from: 'foodlistings', localField: 'listingId', foreignField: '_id', as: 'l' } },
      { $group: { _id: null, plates: { $sum: { $sum: '$l.quantityPlates' } }, pickups: { $sum: 1 } } },
    ]),
    FoodListing.aggregate([
      { $match: { status: 'available', pickupDeadline: { $gt: new Date() } } },
      { $group: { _id: null, plates: { $sum: '$quantityPlates' } } },
    ]),
  ]);
  res.json({
    mealsRescued: completed[0]?.plates || 0,
    pickupsCompleted: completed[0]?.pickups || 0,
    activeDonors: donors,
    distributors,
    platesAvailableNow: available[0]?.plates || 0,
  });
}));

/* Dropdown options, so the frontend and backend use the same lists. */
router.get('/options', (req, res) => res.json({ FOOD_TYPES, KITCHEN_TYPES, LISTING_AREAS, AREAS, PRICES }));

module.exports = router;
