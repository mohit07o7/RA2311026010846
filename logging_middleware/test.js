'use strict';

require('dotenv').config();

const { authenticate } = require('./auth');
const { Log } = require('./logger');

const config = require('./config');

async function runTest() {
  // Step 1: get token from auth API
  await authenticate({
    email: config.email,
    name: config.name,
    rollNo: config.rollNo,
    accessCode: config.accessCode,
    clientID: config.clientID,
    clientSecret: config.clientSecret,
  });

  // Step 2: now Log() will ship to the test server
  await Log('backend', 'info', 'service', 'logger test — middleware working correctly');
  await Log('backend', 'debug', 'utils', 'debug log test');
  await Log('backend', 'warn', 'handler', 'warn log test');
  await Log('backend', 'error', 'handler', 'error log test');
}

runTest().catch((err) => {
  process.stderr.write(`Test failed: ${err.message}\n`);
  process.exit(1);
});