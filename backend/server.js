import dotenv from 'dotenv';
import http from 'http';
import app from './src/app.js';
import connectDB from './src/config/database.js'; // Mongoose connection
import { initSocket } from './src/socket.js';
import { logCorsPolicy } from './src/config/cors.js';

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
  // Surfaces the effective allow-list in deploy logs, so a misconfigured
  // CORS_ORIGINS is visible at boot rather than as a mystery 403 later.
  logCorsPolicy();
});
