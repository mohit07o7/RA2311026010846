// 'use strict';

// require('dotenv').config();

// const express = require('express');
// const config = require('../logging_middleware/config');
// const { Log } = require('../logging_middleware/logger');
// const { authenticate } = require('../logging_middleware/auth');
// const schedulerRoutes = require('./routes/scheduler');

// const app = express();
// app.use(express.json());

// app.use(async (req, _res, next) => {
//   await Log('backend', 'debug', 'middleware', `incoming: ${req.method} ${req.path}`);
//   next();
// });

// // server.js
// const app = require("./app");

// app.listen(3000, () => {
//   console.log("Server running on port 3000");
// });

// // Health check — always available
// app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'vehicle-maintenance-scheduler' }));

// app.use('/api', schedulerRoutes);

// app.use(async (req, res) => {
//   await Log('backend', 'warn', 'route', `404: ${req.method} ${req.path}`);
//   res.status(404).json({ error: 'Not found' });
// });

// app.use(async (err, _req, res, _next) => {
//   await Log('backend', 'error', 'middleware', `unhandled error: ${err.message}`);
//   res.status(500).json({ error: 'Internal server error' });
// });

// // Scheduler runs on 3001 so it doesn't conflict with the notification server on 3000
// const PORT = parseInt(process.env.SCHEDULER_PORT) || 3001;

// async function start() {
//   process.stdout.write(`[INFO] Starting vehicle scheduler on port ${PORT}...\n`);

//   const server = app.listen(PORT, () => {
//     process.stdout.write(`[INFO] Scheduler ready at http://localhost:${PORT}\n`);
//   });

//   server.on('error', (err) => {
//     if (err.code === 'EADDRINUSE') {
//       process.stderr.write(
//         `\n[ERROR] Port ${PORT} is already in use.\nTo free it:\n\n  lsof -ti :${PORT} | xargs kill -9\n\n`
//       );
//     } else {
//       process.stderr.write(`[ERROR] ${err.message}\n`);
//     }
//     process.exit(1);
//   });

//   // Auth in background
//   try {
//     await authenticate({
//       email: config.email,
//       name: config.name,
//       rollNo: config.rollNo,
//       accessCode: config.accessCode,
//       clientID: config.clientID,
//       clientSecret: config.clientSecret,a
//     });
//     await Log('backend', 'info', 'config', 'scheduler auth complete — ready to schedule');
//   } catch (err) {
//     process.stderr.write(`[WARN] Auth failed: ${err.message} — server running, logs are local only\n`);
//   }
// }

// start();
'use strict';

require('dotenv').config();

const express = require('express');
const config = require('../logging_middleware/config');
const { Log } = require('../logging_middleware/logger');
const { authenticate } = require('../logging_middleware/auth');
const schedulerRoutes = require('./routes/scheduler');

const app = express();
app.use(express.json());

// Request logging middleware
app.use(async (req, _res, next) => {
  await Log('backend', 'debug', 'middleware', `incoming: ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vehicle-maintenance-scheduler' });
});

// Routes
app.use('/api', schedulerRoutes);

// 404 handler
app.use(async (req, res) => {
  await Log('backend', 'warn', 'route', `404: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(async (err, _req, res, _next) => {
  await Log('backend', 'error', 'middleware', `unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// Use port 3001 (important)
const PORT = parseInt(process.env.SCHEDULER_PORT) || 3001;

async function start() {
  process.stdout.write(`[INFO] Starting vehicle scheduler on port ${PORT}...\n`);

  const server = app.listen(PORT, () => {
    process.stdout.write(`[INFO] Scheduler ready at http://localhost:${PORT}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(
        `\n[ERROR] Port ${PORT} is already in use.\nTo free it:\n\n  lsof -ti :${PORT} | xargs kill -9\n\n`
      );
    } else {
      process.stderr.write(`[ERROR] ${err.message}\n`);
    }
    process.exit(1);
  });

  // Auth in background
  try {
    await authenticate({
      email: config.email,
      name: config.name,
      rollNo: config.rollNo,
      accessCode: config.accessCode,
      clientID: config.clientID,
      clientSecret: config.clientSecret,
    });

    await Log('backend', 'info', 'config', 'scheduler auth complete — ready to schedule');
  } catch (err) {
    process.stderr.write(`[WARN] Auth failed: ${err.message} — server running, logs are local only\n`);
  }
}

start();