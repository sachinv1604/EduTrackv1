/**
 * EduTrack Backend: Main Entry Point (Server.js)
 * 
 * This is where the magic starts. We use Express (a Node.js framework) 
 * to create our API server.
 */
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

// 1. CONFIGURATION
// Load environment variables from the .env file (PORT, MONGO_URI, etc.)
// We use path.join to ensure it works even if we start from a different folder.
dotenv.config({ path: path.join(__dirname, '.env') });

// Import Route Handlers
const authRoutes = require('./src/routes/auth');
const routeRoutes = require('./src/routes/routes');
const busRoutes = require('./src/routes/buses');
const locationRoutes = require('./src/routes/location');
const trackingRoutes = require('./src/routes/tracking');
const noticeRoutes = require('./src/routes/notices');
const userRoutes = require('./src/routes/users');

// Initialize the Express app
const app = express();

/**
 * 2. MIDDLEWARE (The "Assembly Line")
 * Middleware functions run on every request before it reaches the routes.
 */

// Helmet: Security headers to protect against common web vulnerabilities
app.use(helmet());

// CORS: Cross-Origin Resource Sharing. 
// Allows our Mobile App (different origin) to talk to this server.
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(cors({
  origin: allowedOrigins
}));

// Rate Limiting: Prevent DDoS and brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', limiter);

// Body Parser: Converts raw JSON from the request into a JS Object (req.body)
app.use(express.json());

// GLOBAL LOGGER: Prints every request to the console for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next(); // Pass the request to the next function in line
});

// Basic Health Check Route (used to verify the server is alive)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

/**
 * 3. ROUTE MOUNTING
 * We group our APIs into logical sections.
 */

// Authentication (Login/Register)
app.use('/api/auth', authRoutes);

// Route & Bus Management
app.use('/api/routes', routeRoutes);
app.use('/api/buses', busRoutes);

// GPS & Real-time Tracking logic
app.use('/api/location', locationRoutes);
app.use('/api/tracking', trackingRoutes);

// Notice Broadcasting
app.use('/api/notices', noticeRoutes);

// User Profile & Approval management
app.use('/api/users', userRoutes);

// STATIC FILES: Serves uploaded images/PDFs from the /uploads folder
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/**
 * GLOBAL ERROR HANDLER
 * Catches unhandled synchronous errors to prevent the server from crashing.
 */
app.use((err, req, res, next) => {
  console.error('[GLOBAL_ERROR]', err.stack);
  res.status(500).json({ 
    message: 'Internal Server Error', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' 
  });
});

/**
 * 4. DATABASE & STARTUP
 */

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

// Verify that we have a database connection string before trying to connect
if (!MONGO_URI) {
  console.error('CRITICAL: MONGO_URI is not defined in .env');
  process.exit(1); // Stop the server immediately
}

// Connect to MongoDB using Mongoose
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('--- Connected to MongoDB successfully ---');
    
    // Once the DB is ready, start listening for network requests
    app.listen(PORT, () => {
      console.log(`--- EduTrack Server is running on port ${PORT} ---`);
    });
  })
  .catch((err) => {
    console.error('--- MongoDB connection error ---', err.message);
    process.exit(1); 
  });
