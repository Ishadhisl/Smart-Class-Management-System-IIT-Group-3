const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

// Ensure the uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.mp4', '.avi', '.mov', '.mkv', '.webp', '.heic', '.heif'];
    const ext = path.extname(file.originalname).toLowerCase();
    // Extension AND declared MIME must both look like a document/image/video - a renamed
    // .html/.js/.exe fails one of the two.
    const mime = String(file.mimetype || '');
    const mimeOk = mime.startsWith('image/') || mime.startsWith('video/')
      || mime === 'application/pdf' || mime === 'application/msword' || mime === 'application/vnd.ms-excel'
      || mime.startsWith('application/vnd.openxmlformats-officedocument') || mime === 'application/octet-stream';
    if (allowedExtensions.includes(ext) && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('අනුමත නොකරන ලද ගොනු වර්ගයකි. (Invalid file type)'), false);
    }
  }
});

module.exports = upload;