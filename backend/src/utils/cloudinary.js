const cloudinary = require('cloudinary').v2;
const httpError = require('./httpError');

const configured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// Uploads an in-memory file (from multer) and resolves to { url, publicId }.
function uploadImage(buffer) {
  if (!configured) throw httpError(503, 'Image upload is not configured on the server (Cloudinary keys missing).');
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'foodrescue', resource_type: 'image', transformation: [{ width: 1200, crop: 'limit', quality: 'auto' }] },
      (err, result) => (err ? reject(httpError(502, 'Image upload failed: ' + err.message)) : resolve({ url: result.secure_url, publicId: result.public_id }))
    );
    stream.end(buffer);
  });
}

// Best-effort delete; a failed cleanup should not break the request.
async function deleteImage(publicId) {
  if (!configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('Cloudinary delete failed:', err.message);
  }
}

module.exports = { uploadImage, deleteImage, configured };
