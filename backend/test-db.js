import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/User.js';

dotenv.config();

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully to:', mongoose.connection.name);
    
    // Seed admin if not exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log('Creating default admin user...');
      const bcryptModule = await import('bcryptjs');
      const bcrypt = bcryptModule.default || bcryptModule;
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      await User.create({
        role: 'admin',
        name: 'Admin',
        phone: '0000000000',
        email: 'admin@wedcrew.com',
        password: hashedPassword
      });
      console.log('Default admin created (admin@wedcrew.com / admin123).');
    } else {
      console.log('Admin user already exists.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
}

testConnection();
