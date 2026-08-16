import dotenv from 'dotenv';
import app from './src/app.js';
import connectDB from './src/config/database.js'; // Mongoose connection

dotenv.config();

// Connect to MongoDB
await connectDB();

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access on network: http://<YOUR_LOCAL_IP>:${PORT}`);
});
