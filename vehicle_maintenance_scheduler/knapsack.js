'use strict';

const { Log } = require('../logging_middleware/logger');

/**
 * 0/1 Knapsack — maximises total Impact within a mechanic-hour budget.
 *
 * Space-optimised DP with keep table for backtracking.
 * Time:  O(n * W)
 * Space: O(n * W) for keep table
 */
async function knapsack(tasks, budget) {
  const n = tasks.length;

  await Log('backend', 'debug', 'service', `knapsack started — tasks: ${n}, budget: ${budget}h`);

  if (budget <= 0 || n === 0) {
    await Log('backend', 'warn', 'service', 'knapsack called with empty tasks or zero budget');
    return { selectedTasks: [], totalImpact: 0, totalDuration: 0 };
  }

  const dp = new Array(budget + 1).fill(0);
  const keep = Array.from({ length: n }, () => new Array(budget + 1).fill(false));

  for (let i = 0; i < n; i++) {
    const { Duration: w, Impact: v } = tasks[i];
    if (w > budget) continue; // skip tasks that can never fit

    for (let cap = budget; cap >= w; cap--) {
      if (dp[cap - w] + v > dp[cap]) {
        dp[cap] = dp[cap - w] + v;
        keep[i][cap] = true;
      }
    }
  }

  // Backtrack to recover selected tasks
  const selected = [];
  let cap = budget;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i][cap]) {
      selected.push(tasks[i]);
      cap -= tasks[i].Duration;
    }
  }

  const totalImpact = dp[budget];
  const totalDuration = selected.reduce((s, t) => s + t.Duration, 0);

  await Log(
    'backend', 'info', 'service',
    `knapsack complete — selected: ${selected.length}, impact: ${totalImpact}, hours used: ${totalDuration}/${budget}`
  );

  return { selectedTasks: selected, totalImpact, totalDuration };
}

module.exports = { knapsack };
