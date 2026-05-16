/**
 * File Upload Middleware (using Multer)
 * 
 * This middleware handles receiving files (images/PDFs) from the mobile app 
 * and saving them to the server's hard drive.
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * 1. DIRECTORY SETUP
 * We ensure the "uploads/notices" folder exists. 
 * If it doesn't, we create it automatically.
 */
const uploadDir = path.join(process.cwd(), 'uploads/notices');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * 2. STORAGE CONFIGURATION
 * Defines WHERE the file goes and WHAT it should be named.
 */
const storage = multer.diskStorage({
  // destination: Where to save the file
  destination: (req, file, cb) => {
    cb(null, 'uploads/notices');
  },
  // filename: How to name the file
  // We add a timestamp (Date.now()) to ensure no two files have the same name.
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

/**
 * 3. FILE FILTER (Security)
 * We check the file extension and the "mimetype" (the actual file data type) 
 * to ensure users only upload valid PDFs or Images.
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    // If it's a virus or an unsupported file, we reject it with an error.
    cb(new Error('Only PDF and image files are allowed!'), false);
  }
};

/**
 * 4. INITIALIZE MULTER
 * We combine the storage, limits, and filter into a single middleware.
 */
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit to prevent server overload
  fileFilter: fileFilter
});

module.exports = {
  upload
};
