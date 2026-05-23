const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');
const Route = require('../src/models/Route');

dotenv.config();

const purgeAndSeed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    // 1. Purge Data
    console.log('Purging Users (except Admin)...');
    await User.deleteMany({ role: { $ne: 'admin' } });
    
    console.log('Purging Routes...');
    await Route.deleteMany({});
    
    console.log('Database cleared successfully!');

    // 2. Seed Routes
    const varurLoc = [75.2465, 15.2285]; // Varur [lng, lat]
    
    const routesData = [
      {
        name: 'Mundgod - Varur',
        checkpoints: [
          { order: 0, name: 'Mundgod Bus Stand', location: { type: 'Point', coordinates: [75.0294, 14.9702] } },
          { order: 1, name: 'Tadas', location: { type: 'Point', coordinates: [75.1200, 15.0800] } },
          { order: 2, name: 'Varur College', location: { type: 'Point', coordinates: varurLoc } }
        ],
        estimatedTime: 90,
        polyline: 'placeholder_polyline_mundgod'
      },
      {
        name: 'Hubli - Varur',
        checkpoints: [
          { order: 0, name: 'Hubli CBT', location: { type: 'Point', coordinates: [75.1239, 15.3647] } },
          { order: 1, name: 'Gabbur Cross', location: { type: 'Point', coordinates: [75.1500, 15.3200] } },
          { order: 2, name: 'Varur College', location: { type: 'Point', coordinates: varurLoc } }
        ],
        estimatedTime: 45,
        polyline: 'placeholder_polyline_hubli'
      },
      {
        name: 'Dharwad - Varur',
        checkpoints: [
          { order: 0, name: 'Dharwad Bus Stand', location: { type: 'Point', coordinates: [75.0078, 15.4589] } },
          { order: 1, name: 'Hubli Bypass', location: { type: 'Point', coordinates: [75.1000, 15.3800] } },
          { order: 2, name: 'Varur College', location: { type: 'Point', coordinates: varurLoc } }
        ],
        estimatedTime: 65,
        polyline: 'placeholder_polyline_dharwad'
      },
      {
        name: 'Kalghatgi - Varur',
        checkpoints: [
          { order: 0, name: 'Kalghatgi Town', location: { type: 'Point', coordinates: [74.9723, 15.1812] } },
          { order: 1, name: 'Tadas Cross', location: { type: 'Point', coordinates: [75.1000, 15.1500] } },
          { order: 2, name: 'Varur College', location: { type: 'Point', coordinates: varurLoc } }
        ],
        estimatedTime: 55,
        polyline: 'placeholder_polyline_kalghatgi'
      }
    ];

    console.log('Seeding Routes...');
    await Route.insertMany(routesData);
    console.log('Routes seeded successfully!');

    process.exit();
  } catch (error) {
    console.error('Error during purge and seed:', error);
    process.exit(1);
  }
};

purgeAndSeed();
