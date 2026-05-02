'use strict';

require('dotenv').config();

const fetch = require('node-fetch');
const { Log } = require('../logging_middleware/logger');

const BASE = 'http://20.207.122.201/evaluation-service';

async function fetchDepots(token) {
  await Log('backend', 'info', 'service', 'fetching depots from test server');

  const res = await fetch(`${BASE}/depots`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    await Log('backend', 'error', 'service', `depot fetch failed — status: ${res.status}`);
    throw new Error(`Depot API error: ${res.status}`);
  }

  const { depots } = await res.json();
  await Log('backend', 'info', 'service', `depot fetch successful — received ${depots.length} depots`);
  return depots;
}

async function fetchVehicles(token) {
  await Log('backend', 'info', 'service', 'fetching vehicles from test server');

  const res = await fetch(`${BASE}/vehicles`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    await Log('backend', 'error', 'service', `vehicle fetch failed — status: ${res.status}`);
    throw new Error(`Vehicle API error: ${res.status}`);
  }

  const { vehicles } = await res.json();
  await Log('backend', 'info', 'service', `vehicle fetch successful — received ${vehicles.length} tasks`);
  return vehicles;
}

module.exports = { fetchDepots, fetchVehicles };
