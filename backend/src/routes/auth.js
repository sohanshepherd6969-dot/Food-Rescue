const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, signToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const { PUBLIC_ROLES, AREAS } = require('../constants');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role, organizationName, phone, area } = req.body;

  if (!name || !email || !password || !role) throw httpError(400, 'Name, email, password and role are required.');
  // Public sign-up can only create donors and distributors, never an admin.
  if (!PUBLIC_ROLES.includes(role)) throw httpError(400, 'Choose Donor or Distributor.');
  if (!EMAIL_RE.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters.');
  if (area && !AREAS.includes(area)) throw httpError(400, 'Choose a valid area.');

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) throw httpError(409, 'An account with this email already exists.');

  const user = await User.create({
    name, email, role, organizationName, phone,
    area: area || 'All Bangalore',
    passwordHash: await bcrypt.hash(password, 10),
  });

  res.status(201).json({ token: signToken(user), user: user.toPublic() });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw httpError(400, 'Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw httpError(401, 'Wrong email or password.');
  if (user.status !== 'active') throw httpError(403, 'Your account is suspended. Contact the admin.');

  res.json({ token: signToken(user), user: user.toPublic() });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

// Profile edit: only these fields; role, email and status cannot be changed here.
router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const { name, organizationName, phone, area } = req.body;
  if (name !== undefined && !String(name).trim()) throw httpError(400, 'Name cannot be empty.');
  if (area !== undefined && !AREAS.includes(area)) throw httpError(400, 'Choose a valid area.');

  Object.assign(req.user, Object.fromEntries(
    Object.entries({ name, organizationName, phone, area }).filter(([, v]) => v !== undefined)
  ));
  await req.user.save();
  res.json({ user: req.user.toPublic() });
}));

module.exports = router;
