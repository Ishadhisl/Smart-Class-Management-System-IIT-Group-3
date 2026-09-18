const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

// Image-upload middleware for *display* assets: promotion flyers, achievement photos,
// student/teacher profile photos. Kept separate from ./uploadMiddleware (which stays on
// local disk for documents, exam spreadsheets and other files that get read/unlinked
// locally right after upload).
//
// Files land on the local ./uploads folder, which is a persistent disk in production.

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.gif'];
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXT.includes(ext)) return cb(null, true);
  cb(new Error('අනුමත නොකරන ලද ගොනු වර්ගයකි. (Images only: PNG, JPG, WEBP)'), false);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

// Normalise what multer returned into a URL/path the frontend can render.
imageUpload.publicUrl = (file) => {
  if (!file) return null;
  return `/uploads/${file.filename}`;
};

module.exports = imageUpload;
