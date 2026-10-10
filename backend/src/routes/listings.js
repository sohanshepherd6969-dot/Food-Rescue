const router = require('express').Router();
const FoodListing = require('../models/FoodListing');
const PickupClaim = require('../models/PickupClaim');
const Review = require('../models/Review');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { uploadImage, deleteImage } = require('../utils/cloudinary');
const { ratingsFor } = require('../utils/ratings');
const mongoose = require('mongoose');
const { PRICES, FOOD_TYPES, KITCHEN_TYPES, LISTING_AREAS } = require('../constants');

const DONOR_FIELDS = 'name organizationName area';

// Checks and converts form fields. `partial` = edit (only validate what was sent).
function parseListingInput(body, partial = false) {
  const out = {};
  const has = (k) => body[k] !== undefined && body[k] !== '';
  const need = (k, label) => { if (!partial && !has(k)) throw httpError(400, `${label} is required.`); return has(k); };

  if (need('title', 'Food name')) out.title = String(body.title).trim();
  if (has('description')) out.description = String(body.description).trim();

  if (need('quantityPlates', 'Quantity')) {
    const q = Number(body.quantityPlates);
    if (!Number.isInteger(q) || q < 1 || q > 5000) throw httpError(400, 'Quantity must be a whole number of plates (1–5000).');
    out.quantityPlates = q;
  }
  if (need('pricePerPlate', 'Price per plate')) {
    const p = Number(body.pricePerPlate);
    if (!PRICES.includes(p)) throw httpError(400, 'Price must be Free, Rs 5 or Rs 10 per plate.');
    out.pricePerPlate = p;
  }
  if (need('foodType', 'Food type')) {
    if (!FOOD_TYPES.includes(body.foodType)) throw httpError(400, 'Invalid food type.');
    out.foodType = body.foodType;
  }
  if (need('kitchenType', 'Kitchen type')) {
    if (!KITCHEN_TYPES.includes(body.kitchenType)) throw httpError(400, 'Invalid kitchen type.');
    out.kitchenType = body.kitchenType;
  }
  if (need('area', 'Area')) {
    if (!LISTING_AREAS.includes(body.area)) throw httpError(400, 'Invalid area.');
    out.area = body.area;
  }
  if (need('pickupDeadline', 'Pickup deadline')) {
    const d = new Date(body.pickupDeadline);
    if (Number.isNaN(d.getTime())) throw httpError(400, 'Invalid pickup deadline.');
    if (d <= new Date()) throw httpError(400, 'Pickup deadline must be in the future.');
    out.pickupDeadline = d;
  }
  return out;
}

// Adds donorRating { avg, count } to each listing (plain objects).
async function withDonorRatings(listings) {
  const ids = [...new Set(listings.map((l) => String(l.donorId?._id || l.donorId)))];
  const ratings = await ratingsFor(ids.map((id) => new mongoose.Types.ObjectId(id)));
  return listings.map((l) => ({ ...l, donorRating: ratings.get(String(l.donorId?._id || l.donorId)) || null }));
}

/* ---------- Marketplace (any logged-in user; distributors use it) ---------- */
// Query: area, price=all|free|paid, foodType, kitchenType, q, sort=newest|rating|free|price
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { area, price, foodType, kitchenType, q, sort = 'newest' } = req.query;
  const filter = { status: 'available', pickupDeadline: { $gt: new Date() } };

  if (area && area !== 'All Bangalore') filter.area = area;
  if (price === 'free') filter.pricePerPlate = 0;
  if (price === 'paid') filter.pricePerPlate = { $gt: 0 };
  if (foodType && foodType !== 'All') filter.foodType = foodType;
  if (kitchenType && kitchenType !== 'Any') filter.kitchenType = kitchenType;
  let listings = await FoodListing.find(filter).populate('donorId', DONOR_FIELDS).lean();

  // Text search over food name, description, area and donor name / organisation.
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    listings = listings.filter((l) =>
      [l.title, l.description, l.area, l.donorId?.name, l.donorId?.organizationName].some((v) => v && rx.test(v)));
  }

  listings = await withDonorRatings(listings);

  const newest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
  if (sort === 'rating') {
    // Rated donors first (highest first); unrated after, newest first.
    listings.sort((a, b) => {
      if (a.donorRating && !b.donorRating) return -1;
      if (!a.donorRating && b.donorRating) return 1;
      if (a.donorRating && b.donorRating && b.donorRating.avg !== a.donorRating.avg) return b.donorRating.avg - a.donorRating.avg;
      return newest(a, b);
    });
  } else if (sort === 'free') {
    listings.sort((a, b) => (a.pricePerPlate === 0) === (b.pricePerPlate === 0) ? newest(a, b) : a.pricePerPlate === 0 ? -1 : 1);
  } else if (sort === 'price') {
    listings.sort((a, b) => a.pricePerPlate - b.pricePerPlate || newest(a, b));
  } else {
    listings.sort(newest);
  }

  res.json({ listings });
}));

/* ---------- Donor: own listings ---------- */
router.get('/mine', requireAuth, requireRole('donor'), asyncHandler(async (req, res) => {
  const listings = await FoodListing.find({ donorId: req.user._id }).sort({ createdAt: -1 }).lean();
  // Attach the current (non-cancelled) claim so the donor can see who is collecting.
  const claims = await PickupClaim.find({ listingId: { $in: listings.map((l) => l._id) }, status: { $ne: 'cancelled' } })
    .populate('distributorId', 'name organizationName phone').lean();
  const byListing = new Map(claims.map((c) => [String(c.listingId), c]));
  res.json({ listings: listings.map((l) => ({ ...l, claim: byListing.get(String(l._id)) || null })) });
}));

/* ---------- Single listing ---------- */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const listing = await FoodListing.findById(req.params.id).populate('donorId', DONOR_FIELDS + ' phone').lean();
  if (!listing) throw httpError(404, 'Listing not found.');

  const isOwner = String(listing.donorId?._id) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  // Removed/cancelled listings are only visible to their donor and the admin.
  if (['removed', 'cancelled'].includes(listing.status) && !isOwner && !isAdmin) throw httpError(404, 'Listing not found.');

  const [withRating] = await withDonorRatings([listing]);
  withRating.donorListingCount = await FoodListing.countDocuments({ donorId: listing.donorId._id });

  if (isOwner || isAdmin) {
    const claims = await PickupClaim.find({ listingId: listing._id })
      .populate('distributorId', 'name organizationName phone').sort({ claimedAt: -1 }).lean();
    const reviews = await Review.find({ claimId: { $in: claims.map((c) => c._id) }, reviewerId: req.user._id }).lean();
    withRating.claims = claims.map((c) => ({ ...c, myReview: reviews.find((r) => String(r.claimId) === String(c._id)) || null }));
  } else if (req.user.role === 'distributor') {
    withRating.myClaim = await PickupClaim.findOne({ listingId: listing._id, distributorId: req.user._id, status: { $ne: 'cancelled' } }).lean();
  }
  // Donor phone is only shared with the owner, admin, or the distributor who claimed it.
  if (!isOwner && !isAdmin && !withRating.myClaim) delete withRating.donorId.phone;

  res.json({ listing: withRating });
}));

/* ---------- Donor: create / edit / cancel ---------- */
router.post('/', requireAuth, requireRole('donor'), upload.single('image'), asyncHandler(async (req, res) => {
  const data = parseListingInput(req.body);
  if (!req.file) throw httpError(400, 'A food photo is required.');

  const img = await uploadImage(req.file.buffer);
  try {
    const listing = await FoodListing.create({ ...data, donorId: req.user._id, imageUrl: img.url, imagePublicId: img.publicId });
    res.status(201).json({ listing });
  } catch (err) {
    await deleteImage(img.publicId); // don't leave an orphan image behind
    throw err;
  }
}));

router.put('/:id', requireAuth, requireRole('donor'), upload.single('image'), asyncHandler(async (req, res) => {
  const listing = await FoodListing.findOne({ _id: req.params.id, donorId: req.user._id });
  if (!listing) throw httpError(404, 'Listing not found (you can only edit your own listings).');
  if (listing.status !== 'available') throw httpError(409, `This listing is ${listing.status} and can no longer be edited.`);

  const data = parseListingInput(req.body, true);
  let oldPublicId = null;
  if (req.file) {
    const img = await uploadImage(req.file.buffer);
    oldPublicId = listing.imagePublicId;
    data.imageUrl = img.url;
    data.imagePublicId = img.publicId;
  }

  // Only update while still available, so an edit can't race a claim.
  const updated = await FoodListing.findOneAndUpdate({ _id: listing._id, status: 'available' }, data, { new: true, runValidators: true });
  if (!updated) {
    if (data.imagePublicId) await deleteImage(data.imagePublicId);
    throw httpError(409, 'This listing was just claimed and can no longer be edited.');
  }
  if (oldPublicId) await deleteImage(oldPublicId);
  res.json({ listing: updated });
}));

router.post('/:id/cancel', requireAuth, requireRole('donor'), asyncHandler(async (req, res) => {
  const updated = await FoodListing.findOneAndUpdate(
    { _id: req.params.id, donorId: req.user._id, status: 'available' },
    { status: 'cancelled' },
    { new: true }
  );
  if (!updated) throw httpError(409, 'Only your own listings that are still available can be cancelled.');
  res.json({ listing: updated });
}));

module.exports = router;
