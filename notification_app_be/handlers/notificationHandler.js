'use strict';

const { Log } = require('../../logging_middleware/logger');
const { loadNotifications } = require('../services/notificationService');
const { getTopN } = require('../services/priorityService');

/** GET /api/notifications */
async function list(req, res) {
  await Log('backend', 'info', 'handler', 'GET /api/notifications — request received');

  try {
    const notifications = await loadNotifications();

    const { type, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
      await Log('backend', 'warn', 'handler', `invalid pagination params — page: ${page}, limit: ${limit}`);
      return res.status(400).json({ error: 'page and limit must be positive integers' });
    }

    let filtered = notifications;
    if (type) {
      const validTypes = ['Placement', 'Result', 'Event'];
      if (!validTypes.includes(type)) {
        await Log('backend', 'warn', 'handler', `invalid type filter: ${type}`);
        return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
      }
      filtered = notifications.filter((n) => n.Type === type);
      await Log('backend', 'debug', 'handler', `filtered by type=${type} — matched ${filtered.length}`);
    }

    const start = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(start, start + limitNum);

    await Log('backend', 'info', 'handler', `returning ${paginated.length} notifications (page ${pageNum})`);
    return res.json({ page: pageNum, limit: limitNum, total: filtered.length, notifications: paginated });
  } catch (err) {
    await Log('backend', 'error', 'handler', `list notifications failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

/** GET /api/notifications/priority?n=10 */
async function priority(req, res) {
  const n = parseInt(req.query.n) || 10;
  await Log('backend', 'info', 'handler', `GET /api/notifications/priority — n=${n}`);

  if (n < 1 || n > 100) {
    await Log('backend', 'warn', 'handler', `invalid n value: ${n}`);
    return res.status(400).json({ error: 'n must be between 1 and 100' });
  }

  try {
    const notifications = await loadNotifications();
    const top = getTopN(notifications, n);

    await Log('backend', 'info', 'handler', `priority inbox built — returning top ${top.length}`);
    return res.json({ count: top.length, notifications: top });
  } catch (err) {
    await Log('backend', 'error', 'handler', `priority fetch failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

/** GET /api/notifications/stats */
async function stats(req, res) {
  await Log('backend', 'info', 'handler', 'GET /api/notifications/stats — request received');

  try {
    const notifications = await loadNotifications();
    const byType = notifications.reduce((acc, n) => {
      acc[n.Type] = (acc[n.Type] || 0) + 1;
      return acc;
    }, {});

    await Log('backend', 'info', 'handler', `stats computed — total: ${notifications.length}`);
    return res.json({ total: notifications.length, byType });
  } catch (err) {
    await Log('backend', 'error', 'handler', `stats failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

/** GET /api/notifications/:id */
async function getById(req, res) {
  const { id } = req.params;
  await Log('backend', 'info', 'handler', `GET /api/notifications/${id}`);

  try {
    const notifications = await loadNotifications();
    const found = notifications.find((n) => n.ID === id);

    if (!found) {
      await Log('backend', 'warn', 'handler', `notification not found: ${id}`);
      return res.status(404).json({ error: 'Notification not found' });
    }

    await Log('backend', 'info', 'handler', `notification found: ${id}, type: ${found.Type}`);
    return res.json(found);
  } catch (err) {
    await Log('backend', 'error', 'handler', `getById failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { list, getById, priority, stats };
