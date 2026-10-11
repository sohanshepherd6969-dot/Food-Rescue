require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const ensureAdmin = require('./src/utils/ensureAdmin');

const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing environment variables:', missing.join(', '), '- see .env.example');
  process.exit(1);
}

const app = express();

// CORS: allow the deployed frontend (CLIENT_ORIGIN, comma-separated) and local dev.
const allowed = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors((req, cb) => {
  const origin = req.headers.origin;
  // Same-origin: pages served by this server (browsers still send Origin on POST).
  const self = origin && origin.replace(/^https?:\/\//, '') === req.headers.host;
  const ok = !origin || self || allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (ok) return cb(null, { origin: true });
  cb(new Error('Not allowed by CORS: ' + origin));
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/listings', require('./src/routes/listings'));
app.use('/api/claims', require('./src/routes/claims'));
app.use('/api/reviews', require('./src/routes/reviews'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/stats', require('./src/routes/stats'));
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));

// Local convenience: serve the frontend from the same server (http://localhost:5000).
// In production the frontend is on Vercel; this does no harm there.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// One place that turns errors into JSON responses.
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';
  if (err.name === 'ValidationError') { status = 400; message = Object.values(err.errors).map((e) => e.message).join(' '); }
  if (err.name === 'CastError') { status = 400; message = 'Invalid id.'; }
  if (err.code === 'LIMIT_FILE_SIZE') { status = 400; message = 'Image must be 5 MB or smaller.'; }
  if (status >= 500) console.error(err);
  res.status(status).json({ message });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI)
  .then(ensureAdmin)
  .then(() => app.listen(PORT, () => console.log(`FoodRescue API running on http://localhost:${PORT}`)))
  .catch((err) => { console.error('Could not start:', err.message); process.exit(1); });
