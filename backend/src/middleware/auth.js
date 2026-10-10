const jwt = require('jsonwebtoken');
const User = require('../models/User');
const httpError = require('../utils/httpError');

// Reads "Authorization: Bearer <token>", loads the user and puts it on req.user.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw httpError(401, 'Please log in.');

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw httpError(401, 'Session expired. Please log in again.');
    }

    const user = await User.findById(payload.id);
    if (!user) throw httpError(401, 'Account not found.');
    if (user.status !== 'active') throw httpError(403, 'Your account is suspended. Contact the admin.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Usage: router.get('/x', requireAuth, requireRole('admin'), handler)
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(httpError(403, 'You do not have permission for this action.'));
  next();
};

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

module.exports = { requireAuth, requireRole, signToken };
