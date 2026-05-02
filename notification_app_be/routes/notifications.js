'use strict';

const express = require('express');
const { Log } = require('../../logging_middleware/logger');
const handler = require('../handlers/notificationHandler');

const router = express.Router();

// Request logger middleware for all notification routes
router.use(async (req, _res, next) => {
  await Log('backend', 'debug', 'middleware', `${req.method} ${req.originalUrl}`);
  next();
});

// Order matters — put /priority and /stats before /:id
router.get('/priority', handler.priority);
router.get('/stats', handler.stats);
router.get('/', handler.list);
router.get('/:id', handler.getById);

router.patch('/:id/read', async (req, res) => {
  const id = req.params.id;

  await Log(
    'backend',
    'info',
    'handler',
    `marking notification ${id} as read`
  );

  res.json({
    message: 'Notification marked as read',
    id,
  });
});
router.post('/', async (req, res) => {
  const { type, message } = req.body;

  await Log(
    'backend',
    'info',
    'handler',
    `creating notification: ${type}`
  );

  if (!type || !message) {
    await Log('backend', 'error', 'handler', 'invalid input');
    return res.status(400).json({ error: 'Invalid input' });
  }

  const newNotification = {
    id: Date.now().toString(), // simple id (fine for now)
    type,
    message,
    read: false,
    timestamp: new Date()
  };

  res.status(201).json({
    message: 'Notification created',
    data: newNotification
  });
});
module.exports = router;
