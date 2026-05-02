'use strict';

require('dotenv').config();

const { Log } = require('../../logging_middleware/logger');
const { getToken } = require('../../logging_middleware/logger');
const { fetchDepots, fetchVehicles } = require('../api');
const { knapsack } = require('../knapsack');

/** GET /api/depots */
async function getDepots(req, res) {
  await Log('backend', 'info', 'handler', 'GET /api/depots — request received');
  try {
    const token = getToken();
    const depots = await fetchDepots(token);
    await Log('backend', 'info', 'handler', `GET /api/depots — returning ${depots.length} depots`);
    return res.json({ depots });
  } catch (err) {
    await Log('backend', 'error', 'handler', `GET /api/depots failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

/** GET /api/vehicles */
async function getVehicles(req, res) {
  await Log('backend', 'info', 'handler', 'GET /api/vehicles — request received');
  try {
    const token = getToken();
    const vehicles = await fetchVehicles(token);
    await Log('backend', 'info', 'handler', `GET /api/vehicles — returning ${vehicles.length} tasks`);
    return res.json({ vehicles });
  } catch (err) {
    await Log('backend', 'error', 'handler', `GET /api/vehicles failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/schedule
 * Optional query param: ?depotId=2  — schedule for a single depot
 */
async function getSchedule(req, res) {
  await Log('backend', 'info', 'handler', `GET /api/schedule — query: ${JSON.stringify(req.query)}`);

  try {
    const token = getToken();

    await Log('backend', 'debug', 'service', 'loading depots and vehicles for scheduling');
    const [depots, vehicles] = await Promise.all([fetchDepots(token), fetchVehicles(token)]);

    const depotIdFilter = req.query.depotId ? parseInt(req.query.depotId) : null;
    const targets = depotIdFilter
      ? depots.filter((d) => d.ID === depotIdFilter)
      : depots;

    if (!targets.length) {
      await Log('backend', 'warn', 'handler', `no depot found for depotId=${depotIdFilter}`);
      return res.status(404).json({ error: 'Depot not found' });
    }

    await Log('backend', 'info', 'service', `scheduling ${targets.length} depot(s) with ${vehicles.length} vehicle tasks`);

    const results = [];
    for (const depot of targets) {
      await Log('backend', 'debug', 'service', `processing depot ${depot.ID} — budget: ${depot.MechanicHours}h`);

      const { selectedTasks, totalImpact, totalDuration } = await knapsack(vehicles, depot.MechanicHours);

      results.push({
        depotID: depot.ID,
        budget: depot.MechanicHours,
        hoursUsed: totalDuration,
        hoursRemaining: depot.MechanicHours - totalDuration,
        totalImpact,
        tasksSelected: selectedTasks.length,
        selectedTasks: selectedTasks.map((t) => ({
          TaskID: t.TaskID,
          Duration: t.Duration,
          Impact: t.Impact,
        })),
      });
    }

    await Log('backend', 'info', 'handler', `schedule generated for ${results.length} depot(s)`);
    return res.json({ schedule: results });
  } catch (err) {
    await Log('backend', 'error', 'handler', `GET /api/schedule failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getDepots, getVehicles, getSchedule };
