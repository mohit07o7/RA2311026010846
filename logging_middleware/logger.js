'use strict';

require('dotenv').config();

const axios = require('axios');

const LOG_API = 'http://20.207.122.201/evaluation-service/logs';

// Token is set after auth completes (via setToken)
let _token = null;

function setToken(token) {
  _token = token;
}

function getToken() {
  return _token;
}

/**
 * Log(stack, level, pkg, message)
 * Ships a structured log entry to the test server.
 * Falls back to stdout before auth completes.
 */
async function Log(stack, level, pkg, message) {
  const token = _token;

  // No token yet — print locally and return
  if (!token) {
    process.stdout.write(
      `[${new Date().toISOString()}] [${level.toUpperCase()}] [${pkg}] ${message}\n`
    );
    return;
  }

  try {
    const response = await axios.post(
      LOG_API,
      { stack, level, package: pkg, message },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    process.stdout.write(`[logger] ${response.data.message}\n`);
    return response.data;
  } catch (err) {
    const status = err.response ? err.response.status : 'network error';
    process.stdout.write(`[logger] log failed (${status}): ${err.message}\n`);
  }
}

// Backward-compatible exports — all other files use { Log, setToken, getToken }
module.exports = { Log, setToken, getToken };