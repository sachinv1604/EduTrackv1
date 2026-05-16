const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Route = require('./src/models/Route');

dotenv.config();

async function checkState() {
  await mongoose.connect(process.env.MONGO_URI);
  const route = await Route.findOne({ name: 'Mundgod - Varur' });
  
  if (route) {
    console.log('--- ROUTE STATE ---');
    console.log(`Name: ${route.name}`);
    console.log(`Setup Mode: ${route.setupMode}`);
    console.log(`Is Active: ${route.isActive}`);
    console.log(`Arrived At Checkpoint: ${route.arrivedAtCheckpoint}`);
    console.log(`Last Departed Index: ${route.lastDepartedCheckpointIndex}`);
    console.log(`Total Checkpoints: ${route.checkpoints.length}`);
    route.checkpoints.forEach((cp, i) => {
      console.log(`  [${i}] ${cp.name} - Coordinates: [${cp.location.coordinates[1]}, ${cp.location.coordinates[0]}]`);
    });
  } else {
    console.log('Route not found');
  }
  process.exit(0);
}

checkState();
