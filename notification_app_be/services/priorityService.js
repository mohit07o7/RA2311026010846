'use strict';

/**
 * Priority Inbox — returns the top-n most important notifications.
 *
 * Scoring:
 *   type weight:  Placement=3, Result=2, Event=1
 *   recency score = 1 / (1 + minutes_ago)   — normalised between 0 and 1
 *   final score = typeWeight + recencyScore
 *
 * We use a min-heap of size n so new notifications can be inserted in O(log n).
 */

const TYPE_WEIGHT = { Placement: 3, Result: 2, Event: 1 };

function score(notification) {
  const weight = TYPE_WEIGHT[notification.Type] ?? 0;
  const ageMs = Date.now() - new Date(notification.Timestamp).getTime();
  const ageMin = ageMs / 60_000;
  const recency = 1 / (1 + ageMin);
  return weight + recency;
}

/**
 * Returns top-n notifications sorted by priority (highest first).
 * No DB query — works entirely in memory.
 *
 * @param {Array} notifications - full list
 * @param {number} n            - how many to return (default 10)
 */
function getTopN(notifications, n = 10) {
  if (!notifications.length) return [];

  // Score every notification
  const scored = notifications.map((notif) => ({
    ...notif,
    _score: score(notif),
  }));

  // Partial sort via a simple min-heap would be O(k log n);
  // for clarity we use sort here — acceptable for in-memory data
  scored.sort((a, b) => b._score - a._score);

  return scored.slice(0, n).map(({ _score, ...notif }) => notif);
}

/**
 * MinHeap — used when notifications arrive as a stream
 * and we need to maintain the top-n list efficiently.
 */
class MinHeap {
  constructor() {
    this._data = [];
  }

  size() {
    return this._data.length;
  }

  peek() {
    return this._data[0];
  }

  push(item) {
    this._data.push(item);
    this._bubbleUp(this._data.length - 1);
  }

  pop() {
    const top = this._data[0];
    const last = this._data.pop();
    if (this._data.length) {
      this._data[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._data[parent]._score <= this._data[i]._score) break;
      [this._data[parent], this._data[i]] = [this._data[i], this._data[parent]];
      i = parent;
    }
  }

  _siftDown(i) {
    const n = this._data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this._data[l]._score < this._data[smallest]._score) smallest = l;
      if (r < n && this._data[r]._score < this._data[smallest]._score) smallest = r;
      if (smallest === i) break;
      [this._data[smallest], this._data[i]] = [this._data[i], this._data[smallest]];
      i = smallest;
    }
  }
}

/**
 * Maintains top-n as new notifications stream in.
 * Insert: O(log n)
 */
class TopNHeap {
  constructor(n) {
    this.n = n;
    this.heap = new MinHeap();
  }

  insert(notification) {
    const scored = { ...notification, _score: score(notification) };
    if (this.heap.size() < this.n) {
      this.heap.push(scored);
    } else if (scored._score > this.heap.peek()._score) {
      this.heap.pop();
      this.heap.push(scored);
    }
  }

  getTop() {
    return [...this.heap._data]
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...n }) => n);
  }
}

module.exports = { getTopN, TopNHeap, score };
