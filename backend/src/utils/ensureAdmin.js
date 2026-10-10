const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Creates the Super Admin from ADMIN_EMAIL / ADMIN_PASSWORD (env) if it doesn't exist yet.
// Public sign-up can never create an admin; this is the only way one is made.
module.exports = async function ensureAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin account created.');
  const email = ADMIN_EMAIL.toLowerCase().trim();
  if (await User.exists({ email })) return;
  await User.create({ name: 'Super Admin', email, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10) });
  console.log('Super Admin account created for', email);
};
