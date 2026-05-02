'use strict';

require('dotenv').config();

const fetch = require('node-fetch');
const config = require('../logging_middleware/config');
const { authenticate } = require('../logging_middleware/auth');
const { Log, getToken } = require('../logging_middleware/logger');
const { getTopN, TopNHeap } = require('./services/priorityService');

const BASE = 'http://20.207.122.201/evaluation-service';

async function main() {
  await Log('backend', 'info', 'handler', 'priority inbox demo starting');

  await authenticate({
    email: config.email,
    name: config.name,
    rollNo: config.rollNo,
    accessCode: config.accessCode,
    clientID: config.clientID,
    clientSecret: config.clientSecret,
  });

  await Log('backend', 'info', 'service', 'fetching notifications for priority demo');

  const res = await fetch(`${BASE}/notifications`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    await Log('backend', 'error', 'service', `notification fetch failed — status: ${res.status}`);
    process.exit(1);
  }

  const { notifications } = await res.json();
  await Log('backend', 'info', 'service', `fetched ${notifications.length} notifications`);

  // --- Batch approach ---
  await Log('backend', 'debug', 'service', 'computing top-10 via batch sort');
  const top10 = getTopN(notifications, 10);

  process.stdout.write('\n=== Top 10 Priority Notifications (batch sort) ===\n\n');
  top10.forEach((n, i) => {
    process.stdout.write(`${i + 1}. [${n.Type.padEnd(9)}] ${n.Message.padEnd(30)} ${n.Timestamp}\n`);
  });

  await Log('backend', 'info', 'service', 'batch top-10 computed successfully');

  // --- Streaming heap approach ---
  await Log('backend', 'debug', 'service', 'computing top-10 via MinHeap (streaming insert)');
  const heap = new TopNHeap(10);
  for (const n of notifications) {
    heap.insert(n);
  }
  const heapTop = heap.getTop();

  process.stdout.write('\n=== Top 10 via MinHeap (streaming, O(log n) insert) ===\n\n');
  heapTop.forEach((n, i) => {
    process.stdout.write(`${i + 1}. [${n.Type.padEnd(9)}] ${n.Message.padEnd(30)} ${n.Timestamp}\n`);
  });

  await Log('backend', 'info', 'handler', 'priority inbox demo complete');
}

main().catch(async (err) => {
  await Log('backend', 'fatal', 'handler', `priority demo crashed: ${err.message}`);
  process.exit(1);
});
