const mongoose = require('mongoose');
const User = require('./src/models/User');
const Route = require('./src/models/Route');
const Bus = require('./src/models/Bus');
const CheckpointLog = require('./src/models/CheckpointLog');
const LocationLog = require('./src/models/LocationLog');
const Notice = require('./src/models/Notice');

console.log('--- Verifying Models (Extended) ---');

const models = [
  { name: 'User', model: User },
  { name: 'Route', model: Route },
  { name: 'Bus', model: Bus },
  { name: 'CheckpointLog', model: CheckpointLog },
  { name: 'LocationLog', model: LocationLog },
  { name: 'Notice', model: Notice }
];

try {
  models.forEach(m => {
    console.log(`${m.name} Model:`, m.model.modelName);
  });
  console.log('--- Verification Successful ---');
  process.exit(0);
} catch (error) {
  console.error('--- Verification Failed ---');
  console.error(error);
  process.exit(1);
}
