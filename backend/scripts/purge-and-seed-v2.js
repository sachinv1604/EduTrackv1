const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');
const Route = require('../src/models/Route');
const CheckpointLog = require('../src/models/CheckpointLog');

const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const routesData = [
  {
    name: 'Mundgod - Varur',
    estimatedTime: 90,
    polyline: 'polyline_data_placeholder_1',
    registrationNo: 'KA-25-F-1111',
    capacity: 50,
    checkpoints: [],
    setupMode: true
  },
  {
    name: 'Hubli - Varur',
    estimatedTime: 45,
    polyline: 'polyline_data_placeholder_2',
    registrationNo: 'KA-25-F-2222',
    capacity: 60,
    checkpoints: [],
    setupMode: true
  },
  {
    name: 'Dharwad - Varur',
    estimatedTime: 75,
    polyline: 'polyline_data_placeholder_3',
    registrationNo: 'KA-25-F-3333',
    capacity: 50,
    checkpoints: [],
    setupMode: true
  },
  {
    name: 'Kalagatagi - Varur',
    estimatedTime: 60,
    polyline: 'polyline_data_placeholder_4',
    registrationNo: 'KA-25-F-4444',
    capacity: 55,
    checkpoints: [],
    setupMode: true
  }
];

async function purgeAndSeed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    // 1. Purge all except Admin
    console.log('Purging data...');
    await User.deleteMany({ role: { $ne: 'admin' } });
    await Route.deleteMany({});
    await CheckpointLog.deleteMany({});
    
    // Note: We don't delete Bus collection explicitly here because the model is gone,
    // but the collection might still exist in DB. 
    await mongoose.connection.collection('buses').drop().catch(() => console.log('Buses collection already gone or empty.'));

    // 2. Seed Routes (now containing Bus data)
    console.log('Seeding new routes...');
    await Route.insertMany(routesData);

    console.log('Database reset and seeded successfully with NEW architecture!');
    process.exit(0);
  } catch (err) {
    console.error('Error during purge and seed:', err);
    process.exit(1);
  }
}

purgeAndSeed();
