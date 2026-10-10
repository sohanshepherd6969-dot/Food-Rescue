const mongoose = require('mongoose');
const { ROLES, AREAS } = require('../constants');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  organizationName: { type: String, trim: true, maxlength: 120 },
  phone: { type: String, trim: true, maxlength: 20 },
  area: { type: String, enum: AREAS, default: 'All Bangalore' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});

// Never send the password hash to the client.
userSchema.methods.toPublic = function () {
  const { _id, name, email, role, organizationName, phone, area, status, createdAt } = this;
  return { id: _id, name, email, role, organizationName, phone, area, status, createdAt };
};

module.exports = mongoose.model('User', userSchema);
