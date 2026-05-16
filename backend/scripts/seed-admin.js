const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../src/models/User');

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    const adminEmail = 'admin@edutrack.com';
    const adminPassword = 'admin123';

    // Check if admin exists
    const adminExists = await User.findOne({ email: adminEmail });

    if (adminExists) {
      console.log('Admin already exists. Ensuring approval...');
      adminExists.isApproved = true;
      await adminExists.save();
      console.log('Admin approval updated.');
      process.exit();
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // Create admin
    await User.create({
      name: 'System Admin',
      email: adminEmail,
      phone: '0000000000',
      role: 'admin',
      passwordHash,
      collegeId: 'ADMIN-001',
      isApproved: true
    });

    console.log('Admin user created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    
    process.exit();
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
