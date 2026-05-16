const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Route = require('../src/models/Route');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function wipeAll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    console.log('Wiping all checkpoints and resetting all routes to SETUP MODE...');
    
    const result = await Route.updateMany(
      {}, 
      {
        $set: {
          checkpoints: [],
          setupMode: true,
          isActive: false,
          lastDepartedCheckpointIndex: -1,
          arrivedAtCheckpoint: false,
          nextCheckpointDistance: 0,
          nextCheckpointETA: 0,
          currentLocation: { type: 'Point', coordinates: [0, 0] }
        }
      }
    );

    console.log(`\nSUCCESS! Reset ${result.modifiedCount} routes.`);
    console.log('All drivers will now see a blank Initial Route Calibration screen.');
    
    process.exit(0);
  } catch (err) {
    console.error('FAILED to wipe data:', err);
    process.exit(1);
  }
}

wipeAll();
