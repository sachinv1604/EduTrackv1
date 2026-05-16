const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const fullReset = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const dbName = mongoose.connection.name;
    console.log(`Dropping database: ${dbName}...`);
    
    await mongoose.connection.db.dropDatabase();
    
    console.log(`Database "${dbName}" dropped successfully.`);
    console.log('You can now start the server and run tests for a clean slate.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error during database reset:', error.message);
    process.exit(1);
  }
};

fullReset();
