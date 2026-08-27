const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

// Image-upload middleware for *display* assets: promotion flyers, achievement photos,
// student/teacher profile photos. Kept separate from ./uploadMiddleware (which stays on
// local disk for documents, exam spreadsheets and other files that get read/unlinked
// locally right after upload).
//
// When CLOUDINARY_URL is set (production on an ephemeral-filesystem host like Render's
// free tier), files go to Cloudinary and survive redeploys. Otherwise they land on the
// local ./uploads folder exactly as before — zero behaviour change for local dev.

const CLOUDINARY_URL = process.env.CLOUDINARY_URL;

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif'];
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXT.includes(ext)) return cb(null, true);
  cb(new Error('අනුමත නොකරන ලද ගොනු වර්ගයකි. (Images only: PNG, JPG, WEBP)'), false);
};

let storage;
if (CLOUDINARY_URL) {
  // eslint-disable-next-line global-require
  const { v2: cloudinary } = require('cloudinary');
  // eslint-disable-next-line global-require
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary.config({ secure: true }); // reads CLOUDINARY_URL from env
  storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder: 'scms',
      allowed_formats: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
      transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
    },
  });
  console.log('🖼️  imageUpload: using Cloudinary storage');
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
    },
  });
}

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

// Normalise what the storage returned into a URL/path the frontend can render.
// Cloudinary  -> file.path is an absolute https:// URL (used verbatim by every
//               frontend getImageUrl helper). Local disk -> "/uploads/<filename>".
imageUpload.publicUrl = (file) => {
  if (!file) return null;
  if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
  return `/uploads/${file.filename}`;
};

module.exports = imageUpload;
