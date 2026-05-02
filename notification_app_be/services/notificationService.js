'use strict';

require('dotenv').config();

const fetch = require('node-fetch');
const { Log, getToken } = require('../../logging_middleware/logger');

const BASE = 'http://20.207.122.201/evaluation-service';

const cache = { notifications: [], lastFetched: null };
const CACHE_TTL_MS = 60_000;

async function loadNotifications() {
  const now = Date.now();

  if (cache.lastFetched && now - cache.lastFetched < CACHE_TTL_MS) {
    await Log('backend', 'debug', 'service', 'returning cached notifications (TTL not expired)');
    return cache.notifications;
  }

  const token = getToken();
  if (!token) {
    await Log('backend', 'error', 'service', 'no auth token available — cannot fetch notifications');
    throw new Error('Not authenticated');
  }

  await Log('backend', 'info', 'service', 'cache miss — fetching notifications from test server');

  const res = await fetch(`${BASE}/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    await Log('backend', 'error', 'service', `notification API returned ${res.status}`);
    throw new Error(`Notification API error: ${res.status}`);
  }

  const { notifications } = await res.json();

  cache.notifications = notifications;
  cache.lastFetched = now;

  await Log('backend', 'info', 'service', `notifications cached — count: ${notifications.length}`);
  return notifications;
}

module.exports = { loadNotifications };
