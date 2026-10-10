const router = require('express').Router();
const PickupClaim = require('../models/PickupClaim');
const Review = require('../models/Review');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { ratingsFor } = require('../utils/ratings');

/* Distributor rates the donor after a completed pickup (1–5 stars).
   One-way: donors are rated on their food; distributors are not rated. */
router.post('/', requireAuth, requireRole('distributor'), asyncHandler(async (req, res) => {
  const { claimId, comment } = req.body;
  const rating = Number(req.body.rating);
  if (!claimId) throw httpError(400, 'claimId is required.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw httpError(400, 'Rating must be 1 to 5 stars.');

  const claim = await PickupClaim.findById(claimId);
  if (!claim) throw httpError(404, 'Pickup not found.');
  if (String(req.user._id) !== String(claim.distributorId)) throw httpError(403, 'You can only rate your own pickups.');
  if (claim.status !== 'completed') throw httpError(409, 'You can rate only after the pickup is completed.');

  try {
    const review = await Review.create({
      claimId: claim._id,
      listingId: claim.listingId,
      reviewerId: req.user._id,
      revieweeId: claim.donorId,
      rating,
      comment,
    });
    res.status(201).json({ review });
  } catch (err) {
    if (err.code === 11000) throw httpError(409, 'You already rated this pickup.');
    throw err;
  }
}));

/* My ratings: donors see ratings received (with average); distributors see ratings they gave. */
router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
  const populate = (q) => q.populate('listingId', 'title imageUrl').sort({ createdAt: -1 }).lean();
  const [received, given, summary] = await Promise.all([
    populate(Review.find({ revieweeId: req.user._id }).populate('reviewerId', 'name organizationName')),
    populate(Review.find({ reviewerId: req.user._id }).populate('revieweeId', 'name organizationName')),
    ratingsFor([req.user._id]),
  ]);
  res.json({ received, given, average: summary.get(String(req.user._id)) || null });
}));

module.exports = router;
