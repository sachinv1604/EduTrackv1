const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
console.log('ENV FIREBASE_SERVICE_ACCOUNT_PATH:', serviceAccountPath);

if (!serviceAccountPath) {
  console.log('Error: Path is not defined in env.');
  process.exit(1);
}

const absolutePath = path.isAbsolute(serviceAccountPath) 
  ? serviceAccountPath 
  : path.join(process.cwd(), serviceAccountPath);

console.log('Resolved Absolute Path:', absolutePath);
console.log('File Exists?', fs.existsSync(absolutePath));

if (fs.existsSync(absolutePath)) {
  try {
    const content = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
    console.log('File content read successfully. Project ID:', content.project_id);
    const admin = require('firebase-admin');
    admin.initializeApp({
      credential: admin.credential.cert(content)
    });
    console.log('Firebase successfully initialized!');
  } catch (err) {
    console.error('Initialization error:', err.message);
  }
}
