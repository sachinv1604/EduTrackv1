const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Route = require('./src/models/Route');

dotenv.config();

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const route = await Route.findOne();
    if (!route) {
      console.log('No routes found in database');
      process.exit(0);
    }

    console.log(`Found route: ${route.name} (${route._id})`);
    console.log('Attempting to add a test checkpoint...');

    route.checkpoints.push({
      name: 'Diagnostic Test',
      location: {
        type: 'Point',
        coordinates: [77.34, 12.56] // Dummy coordinates
      }
    });

    try {
      await route.save();
      console.log('SUCCESS: Route saved successfully');
    } catch (saveError) {
      console.error('FAILED: Route save error:');
      console.error(saveError);
      if (saveError.errors) {
        Object.keys(saveError.errors).forEach(key => {
          console.error(`- Field "${key}": ${saveError.errors[key].message}`);
        });
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('CRITICAL DIAGNOSTIC ERROR:');
    console.error(error);
    process.exit(1);
  }
}

diagnose();
