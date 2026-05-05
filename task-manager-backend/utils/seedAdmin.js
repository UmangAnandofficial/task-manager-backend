// Run with: node utils/seedAdmin.js
// Creates an admin user so you don't have to manually promote yourself.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const adminEmail = 'admin@taskmanager.com';
    const existing = await User.findOne({ email: adminEmail });

    if (existing) {
      console.log('Admin already exists:', adminEmail);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Admin User',
      email: adminEmail,
      password: 'admin123',
      role: 'admin',
    });

    console.log('✅ Admin created');
    console.log('Email:', admin.email);
    console.log('Password: admin123');
    console.log('⚠️  Change the password after first login!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
