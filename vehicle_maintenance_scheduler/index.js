'use strict';

const { authenticate } = require('../logging_middleware/auth');
const { Log } = require('../logging_middleware/logger');
const { fetchDepots, fetchVehicles } = require('./api');
const { knapsack } = require('./knapsack');

// Fill in your credentials (obtained during pre-test registration)
const CREDENTIALS = {
  email: process.env.CLIENT_EMAIL || 'your@email.edu',
  name: process.env.CLIENT_NAME || 'Your Name',
  rollNo: process.env.ROLL_NO || 'RA2311026010846',
  accessCode: process.env.ACCESS_CODE || 'YOUR_ACCESS_CODE',
  clientID: process.env.CLIENT_ID || 'YOUR_CLIENT_ID',
  clientSecret: process.env.CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
};

async function main() {
  await Log('backend', 'info', 'handler', 'vehicle maintenance scheduler starting');

  // Auth
  const token = await authenticate(CREDENTIALS);

  // Fetch data
  const [depots, vehicles] = await Promise.all([
    fetchDepots(token),
    fetchVehicles(token),
  ]);

  const results = [];

  for (const depot of depots) {
    await Log('backend', 'info', 'handler', `processing depot ${depot.ID} (budget: ${depot.MechanicHours}h)`);

    const { selectedTasks, totalImpact, totalDuration } = await knapsack(
      vehicles,
      depot.MechanicHours
    );

    results.push({
      depotID: depot.ID,
      budget: depot.MechanicHours,
      totalImpact,
      hoursUsed: totalDuration,
      hoursRemaining: depot.MechanicHours - totalDuration,
      selectedTasks: selectedTasks.map((t) => ({
        TaskID: t.TaskID,
        Duration: t.Duration,
        Impact: t.Impact,
      })),
    });
  }

  await Log('backend', 'info', 'handler', 'all depots scheduled — printing results');

  console.log(JSON.stringify(results, null, 2));

  await Log('backend', 'info', 'handler', 'vehicle maintenance scheduler complete');
}

main().catch(async (err) => {
  await Log('backend', 'fatal', 'handler', `scheduler crashed: ${err.message}`);
  process.exit(1);
});
