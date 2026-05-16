const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Route = require('../src/models/Route');

async function fix() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    // 1. Find the bus
    const route = await Route.findOne({ registrationNo: 'KA-25-F-1111' });
    if (!route) {
      console.log('Bus not found');
      process.exit(1);
    }

    // 2. WIPE THE GHOST DATA AND UNLOCK
    route.checkpoints = []; // Start fresh
    route.setupMode = true;
    route.isActive = false;
    route.lastDepartedCheckpointIndex = -1;
    route.arrivedAtCheckpoint = false;
    
    await route.save();
    console.log('--- REMOTE FIX SUCCESS ---');
    console.log('Bus KA-25-F-1111 has been WIPED and UNLOCKED.');
    console.log('Driver Arun will now see a blank Setup Mode screen.');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

fix();
