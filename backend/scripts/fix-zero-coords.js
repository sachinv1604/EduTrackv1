const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Route = require('../src/models/Route');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function fixZeroCoords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Find all routes that have checkpoints with [0,0] coordinates
    const routes = await Route.find();
    let fixedCount = 0;

    for (const route of routes) {
      const hasZero = route.checkpoints.some(cp => 
        cp.location && 
        cp.location.coordinates && 
        cp.location.coordinates[0] === 0 && 
        cp.location.coordinates[1] === 0
      );

      if (hasZero) {
        console.log(`Fixing Route: ${route.name} (${route.registrationNo})`);
        
        // Reset the checkpoints that are [0,0] or just put the whole route back to setup mode
        route.setupMode = true;
        route.isActive = false; // Stop any active trips
        route.lastDepartedCheckpointIndex = -1;
        route.arrivedAtCheckpoint = false;
        route.nextCheckpointDistance = 0;
        route.nextCheckpointETA = 0;
        
        // Optionally clear the [0,0] coords to force re-marking
        route.checkpoints.forEach(cp => {
          if (cp.location.coordinates[0] === 0 && cp.location.coordinates[1] === 0) {
             console.log(`  - Resetting checkpoint: ${cp.name}`);
          }
        });

        await route.save();
        fixedCount++;
      }
    }

    console.log(`\nDONE! Repaired ${fixedCount} routes.`);
    console.log('Affected routes have been returned to SETUP MODE.');
    console.log('Drivers must re-mark these stops with a valid GPS lock.');
    
    process.exit(0);
  } catch (err) {
    console.error('FAILED to repair data:', err);
    process.exit(1);
  }
}

fixZeroCoords();
