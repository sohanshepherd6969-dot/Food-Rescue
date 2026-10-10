const Review = require('../models/Review');

// Returns a Map: userId(string) -> { avg, count } for the ratings each user has received.
async function ratingsFor(userIds) {
  if (!userIds.length) return new Map();
  const rows = await Review.aggregate([
    { $match: { revieweeId: { $in: userIds } } },
    { $group: { _id: '$revieweeId', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { avg: Math.round(r.avg * 10) / 10, count: r.count }]));
}

module.exports = { ratingsFor };
