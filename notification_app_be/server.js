'use strict';

require('dotenv').config();

const express = require('express');
const config = require('../logging_middleware/config');
const { Log } = require('../logging_middleware/logger');
const { authenticate } = require('../logging_middleware/auth');
const notificationRoutes = require('./routes/notifications');

const app = express();
app.use(express.json());

// Health check — always available
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-app-be' }));

// Notification routes
app.use('/api/notifications', notificationRoutes);

// 404
app.use(async (req, res) => {
  await Log('backend', 'warn', 'route', `404: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(async (err, _req, res, _next) => {
  await Log('backend', 'error', 'middleware', `unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = config.port || 3000;

async function start() {
  process.stdout.write(`[INFO] Starting notification server on port ${PORT}...\n`);

  // Start listening immediately — don't wait for auth
  const server = app.listen(PORT, () => {
    process.stdout.write(`[INFO] Server ready at http://localhost:${PORT}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(
        `\n[ERROR] Port ${PORT} is already in use.\nTo free it, run:\n\n  lsof -ti :${PORT} | xargs kill -9\n\nThen retry: npm run dev\n\n`
      );
    } else {
      process.stderr.write(`[ERROR] Server error: ${err.message}\n`);
    }
    process.exit(1);
  });

  // Authenticate in background — logger starts shipping logs once token arrives
  try {
    await Log('backend', 'info', 'config', 'server listening, starting auth in background');
    await authenticate({
      email: config.email,
      name: config.name,
      rollNo: config.rollNo,
      accessCode: config.accessCode,
      clientID: config.clientID,
      clientSecret: config.clientSecret,
    });
    await Log('backend', 'info', 'config', `auth complete — logs now ship to test server`);
  } catch (err) {
    process.stderr.write(`[WARN] Auth failed: ${err.message} — server still running, logs will be local only\n`);
  }
}

start();
