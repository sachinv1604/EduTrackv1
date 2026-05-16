const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Route = require('./src/models/Route');
const User = require('./src/models/User');

dotenv.config();

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const routes = await Route.find().populate('driverId', 'name email');
    console.log('\n--- Current Routes ---');
    routes.forEach(r => {
      console.log(`ID: ${r._id}`);
      console.log(`Name: ${r.name}`);
      console.log(`Registration No: ${r.registrationNo}`);
      console.log(`Driver: ${r.driverId ? r.driverId.name : 'None'} (${r.driverId ? r.driverId._id : ''})`);
      console.log(`Is Active: ${r.isActive}`);
      console.log(`Setup Mode: ${r.setupMode}`);
      console.log(`Last Updated: ${r.lastLocationUpdate}`);
      console.log('-------------------');
    });

    const drivers = await User.find({ role: 'driver' });
    console.log('\n--- Registered Drivers ---');
    drivers.forEach(d => {
        console.log(`ID: ${d._id}, Name: ${d.name}, Email: ${d.email}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

diagnose();
