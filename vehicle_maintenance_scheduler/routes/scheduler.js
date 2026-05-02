'use strict';

const express = require('express');
const { Log } = require('../../logging_middleware/logger');
const handler = require('../handlers/schedulerHandler');

const router = express.Router();

router.use(async (req, _res, next) => {
  await Log('backend', 'debug', 'route', `scheduler route hit: ${req.method} ${req.originalUrl}`);
  next();
});

router.get('/depots', handler.getDepots);
router.get('/vehicles', handler.getVehicles);
router.get('/schedule', handler.getSchedule);

module.exports = router;
