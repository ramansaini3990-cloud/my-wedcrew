import dotenv from 'dotenv';
import http from 'http';
import mongoose from 'mongoose';
import app from './src/app.js';
import connectDB from './src/config/database.js'; // Mongoose connection
import { initSocket, getIo } from './src/socket.js';
import { logCorsPolicy } from './src/config/cors.js';
import { logEmailPolicy } from './src/services/emailService.js';

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
  // Shows which mail adapter is live, and shouts if production would send nothing.
  logEmailPolicy();
});

/**
 * Graceful shutdown.
 *
 * Render (and Docker, and Ctrl+C) send SIGTERM/SIGINT and then SIGKILL a short
 * time later. Without this the process dies mid-request: in-flight payment
 * verifications and webhook settlements are cut off, and Mongoose connections
 * are left for the server to time out.
 *
 * Order matters - stop taking new work first, then hang up clients, then close
 * the database.
 */
let shuttingDown = false;

const shutdown = async (signal) => {
  // A second signal while already draining should not restart the sequence.
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received — draining.`);

  const done = (code) => {
    console.log(`[shutdown] complete — exiting (${code}).`);
    process.exit(code);
  };

  // Anything still open after this deadline is not worth waiting for; exiting
  // non-zero tells the platform the drain did not finish cleanly.
  const failsafe = setTimeout(() => {
    console.error('[shutdown] timed out after 10s — forcing exit.');
    done(1);
  }, 10_000);
  failsafe.unref();

  try {
    await new Promise((resolve) => {
      server.close(() => {
        console.log('[shutdown] HTTP server closed — no new connections.');
        resolve();
      });
    });

    try {
      getIo().close();
      console.log('[shutdown] Socket.IO closed.');
    } catch {
      console.log('[shutdown] Socket.IO was not initialised — nothing to close.');
    }

    await mongoose.connection.close(false);
    console.log('[shutdown] MongoDB connection closed.');

    clearTimeout(failsafe);
    done(0);
  } catch (error) {
    console.error('[shutdown] error while draining:', error.message);
    clearTimeout(failsafe);
    done(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
