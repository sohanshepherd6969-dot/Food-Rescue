const router = require('express').Router();
const FoodListing = require('../models/FoodListing');
const PickupClaim = require('../models/PickupClaim');
const Review = require('../models/Review');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');

const LISTING_FIELDS = 'title imageUrl quantityPlates pricePerPlate foodType kitchenType area pickupDeadline status';

// Marks which claims the current user has already rated.
async function withMyReview(claims, userId) {
  const reviews = await Review.find({ claimId: { $in: claims.map((c) => c._id) }, reviewerId: userId }).lean();
  const byClaim = new Map(reviews.map((r) => [String(r.claimId), r]));
  return claims.map((c) => ({ ...c, myReview: byClaim.get(String(c._id)) || null }));
}

/* Distributor claims a listing.
   One atomic update flips the listing from 'available' to 'claimed'. If two distributors
   click at the same time, only one update matches; the other gets 409. */
router.post('/', requireAuth, requireRole('distributor'), asyncHandler(async (req, res) => {
  const { listingId } = req.body;
  if (!listingId) throw httpError(400, 'listingId is required.');

  const listing = await FoodListing.findOneAndUpdate(
    { _id: listingId, status: 'available', pickupDeadline: { $gt: new Date() } },
    { status: 'claimed' },
    { new: true }
  );
  if (!listing) {
    const exists = await FoodListing.exists({ _id: listingId });
    throw httpError(exists ? 409 : 404, exists ? 'Sorry, this food was already claimed or is no longer available.' : 'Listing not found.');
  }

  try {
    const claim = await PickupClaim.create({ listingId: listing._id, donorId: listing.donorId, distributorId: req.user._id });
    res.status(201).json({ claim, listing });
  } catch (err) {
    await FoodListing.updateOne({ _id: listing._id, status: 'claimed' }, { status: 'available' }); // roll back
    throw err;
  }
}));

/* Distributor: my pickups (?status=claimed|completed|cancelled) */
router.get('/mine', requireAuth, requireRole('distributor'), asyncHandler(async (req, res) => {
  const filter = { distributorId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const claims = await PickupClaim.find(filter).sort({ claimedAt: -1 })
    .populate('listingId', LISTING_FIELDS).populate('donorId', 'name organizationName phone').lean();
  res.json({ claims: await withMyReview(claims, req.user._id) });
}));

/* Donor: pickup requests on my listings */
router.get('/donor', requireAuth, requireRole('donor'), asyncHandler(async (req, res) => {
  const filter = { donorId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const claims = await PickupClaim.find(filter).sort({ claimedAt: -1 })
    .populate('listingId', LISTING_FIELDS).populate('distributorId', 'name organizationName phone').lean();
  res.json({ claims: await withMyReview(claims, req.user._id) });
}));

// Loads a claim the current user is part of (as its distributor or donor).
async function myClaim(req) {
  const claim = await PickupClaim.findById(req.params.id);
  if (!claim) throw httpError(404, 'Pickup not found.');
  const me = String(req.user._id);
  if (me !== String(claim.distributorId) && me !== String(claim.donorId)) throw httpError(403, 'This is not your pickup.');
  return claim;
}

/* Mark collected: claimed -> completed (distributor or donor). */
router.post('/:id/complete', requireAuth, requireRole('distributor', 'donor'), asyncHandler(async (req, res) => {
  const claim = await myClaim(req);
  const updated = await PickupClaim.findOneAndUpdate(
    { _id: claim._id, status: 'claimed' },
    { status: 'completed', completedAt: new Date() },
    { new: true }
  );
  if (!updated) throw httpError(409, `This pickup is already ${claim.status}.`);
  await FoodListing.updateOne({ _id: claim.listingId, status: 'claimed' }, { status: 'completed' });
  res.json({ claim: updated });
}));

/* Cancel before completion: claim -> cancelled, listing goes back to available. */
router.post('/:id/cancel', requireAuth, requireRole('distributor', 'donor'), asyncHandler(async (req, res) => {
  const claim = await myClaim(req);
  const updated = await PickupClaim.findOneAndUpdate(
    { _id: claim._id, status: 'claimed' },
    { status: 'cancelled', cancelledAt: new Date() },
    { new: true }
  );
  if (!updated) throw httpError(409, `This pickup is already ${claim.status} and cannot be cancelled.`);
  await FoodListing.updateOne({ _id: claim.listingId, status: 'claimed' }, { status: 'available' });
  res.json({ claim: updated });
}));

module.exports = router;
