const router = require('express').Router();
const User = require('../models/User');
const FoodListing = require('../models/FoodListing');
const PickupClaim = require('../models/PickupClaim');
const Report = require('../models/Report');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { REPORT_STATUS } = require('../constants');

// Every route below is admin-only, checked on the server.
router.use(requireAuth, requireRole('admin'));

const escape = (s) => String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const countBy = async (Model, field, match = {}) =>
  Object.fromEntries((await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }])).map((r) => [r._id, r.n]));

/* Overview numbers + simple analytics */
router.get('/stats', asyncHandler(async (req, res) => {
  const [usersByRole, listingsByStatus, listingsByArea, claimsByStatus, reportsByStatus, plates] = await Promise.all([
    countBy(User, 'role'),
    countBy(FoodListing, 'status'),
    countBy(FoodListing, 'area'),
    countBy(PickupClaim, 'status'),
    countBy(Report, 'status'),
    PickupClaim.aggregate([
      { $match: { status: 'completed' } },
      { $lookup: { from: 'foodlistings', localField: 'listingId', foreignField: '_id', as: 'l' } },
      { $group: { _id: null, plates: { $sum: { $sum: '$l.quantityPlates' } } } },
    ]),
  ]);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  res.json({
    totals: {
      users: sum(usersByRole),
      donors: usersByRole.donor || 0,
      distributors: usersByRole.distributor || 0,
      listings: sum(listingsByStatus),
      pickups: sum(claimsByStatus),
      openReports: reportsByStatus.open || 0,
      mealsRescued: plates[0]?.plates || 0,
    },
    usersByRole, listingsByStatus, listingsByArea, claimsByStatus, reportsByStatus,
  });
}));

/* Users */
router.get('/users', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escape(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { organizationName: rx }];
  }
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({ users: users.map((u) => u.toPublic()) });
}));

router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) throw httpError(400, 'Status must be active or suspended.');
  const user = await User.findById(req.params.id);
  if (!user) throw httpError(404, 'User not found.');
  if (user.role === 'admin') throw httpError(400, 'Admin accounts cannot be suspended here.');
  user.status = status;
  await user.save();
  res.json({ user: user.toPublic() });
}));

/* Listing moderation */
router.get('/listings', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.area) filter.area = req.query.area;
  let listings = await FoodListing.find(filter).populate('donorId', 'name organizationName email').sort({ createdAt: -1 }).lean();
  if (req.query.q) {
    const rx = new RegExp(escape(req.query.q), 'i');
    listings = listings.filter((l) => [l.title, l.donorId?.name, l.donorId?.organizationName].some((v) => v && rx.test(v)));
  }
  res.json({ listings });
}));

// Remove a listing from the marketplace. An active claim on it is cancelled.
router.post('/listings/:id/remove', asyncHandler(async (req, res) => {
  const listing = await FoodListing.findById(req.params.id);
  if (!listing) throw httpError(404, 'Listing not found.');
  if (listing.status === 'completed') throw httpError(409, 'Completed listings are kept for the record.');
  listing.status = 'removed';
  await listing.save();
  await PickupClaim.updateMany({ listingId: listing._id, status: 'claimed' }, { status: 'cancelled', cancelledAt: new Date() });
  res.json({ listing });
}));

/* Reports / complaints */
router.get('/reports', asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const reports = await Report.find(filter).sort({ createdAt: -1 })
    .populate('reporterId', 'name email role')
    .populate('targetUserId', 'name email role status')
    .populate('targetListingId', 'title status area')
    .lean();
  res.json({ reports });
}));

router.patch('/reports/:id', asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  if (status && !REPORT_STATUS.includes(status)) throw httpError(400, 'Invalid report status.');
  const update = {};
  if (status) update.status = status;
  if (adminNotes !== undefined) update.adminNotes = adminNotes;
  const report = await Report.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!report) throw httpError(404, 'Report not found.');
  res.json({ report });
}));

/* Pickup activity */
router.get('/claims', asyncHandler(async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const claims = await PickupClaim.find(filter).sort({ claimedAt: -1 }).limit(500)
    .populate('listingId', 'title area quantityPlates pricePerPlate')
    .populate('donorId', 'name organizationName')
    .populate('distributorId', 'name organizationName')
    .lean();
  res.json({ claims });
}));

module.exports = router;
