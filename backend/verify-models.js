const mongoose = require('mongoose');
const User = require('./src/models/User');
const Route = require('./src/models/Route');
const CheckpointLog = require('./src/models/CheckpointLog');
const LocationLog = require('./src/models/LocationLog');
const Notice = require('./src/models/Notice');
const Otp = require('./src/models/OTP');

console.log('--- Verifying Models (Extended) ---');

const models = [
  { name: 'User', model: User },
  { name: 'Route', model: Route },
  { name: 'CheckpointLog', model: CheckpointLog },
  { name: 'LocationLog', model: LocationLog },
  { name: 'Notice', model: Notice },
  { name: 'Otp', model: Otp }
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
