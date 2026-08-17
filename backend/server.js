import dotenv from 'dotenv';
import http from 'http';
import app from './src/app.js';
import connectDB from './src/config/database.js'; // Mongoose connection
import { initSocket } from './src/socket.js';

dotenv.config();

// Connect to MongoDB
await connectDB();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access on network: http://<YOUR_LOCAL_IP>:${PORT}`);
});
