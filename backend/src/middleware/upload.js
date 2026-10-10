const multer = require('multer');
const httpError = require('../utils/httpError');

// Keep the file in memory and stream it straight to Cloudinary (nothing written to disk).
module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(httpError(400, 'Only image files are allowed.')),
});
