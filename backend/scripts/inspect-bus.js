const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Route = require('../src/models/Route');

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  const route = await Route.findOne({ registrationNo: 'KA-25-F-1111' });
  if (!route) {
    console.log('Bus not found');
  } else {
    console.log('--- BUS INSPECTION ---');
    console.log('Name:', route.name);
    console.log('Active:', route.isActive);
    console.log('SetupMode:', route.setupMode);
    console.log('LastDeparted:', route.lastDepartedCheckpointIndex);
    console.log('Arrived:', route.arrivedAtCheckpoint);
    console.log('Checkpoints:', JSON.stringify(route.checkpoints, null, 2));
  }
  process.exit(0);
}

inspect();
