const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Route = require('./src/models/Route');
const User = require('./src/models/User');

dotenv.config();

async function resetArun() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Find Arun
    const arun = await User.findOne({ name: 'Arun' }); 
    if (!arun) {
      console.log('User "Arun" not found. Looking for any driver...');
    }

    // 2. Find the route assigned to Arun
    const routeId = arun ? arun._id : null;
    const query = routeId ? { driverId: routeId } : { name: 'Mundgod - Varur' };
    
    const route = await Route.findOne(query);
    if (!route) {
      console.log('Route not found for Arun or name Mundgod - Varur');
      process.exit(0);
    }

    console.log(`Resetting Route: ${route.name} (${route._id})`);
    
    // 3. Clear data and reset setup mode
    route.checkpoints = [];
    route.setupMode = true;
    route.isActive = false; // Stop any active trip reset
    route.polyline = '';
    route.lastDepartedCheckpointIndex = -1;
    route.arrivedAtCheckpoint = false;

    await route.save();
    console.log('SUCCESS: Route reset to SETUP MODE and checkpoints CLEARED.');
    console.log('Please RESTART your Node.js server if you haven\'t already.');
    
    process.exit(0);
  } catch (error) {
    console.error('ERROR Resetting Route:');
    console.error(error);
    process.exit(1);
  }
}

resetArun();
