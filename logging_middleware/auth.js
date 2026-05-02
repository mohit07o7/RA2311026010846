'use strict';

require('dotenv').config();

const fetch = require('node-fetch');
const { Log, setToken } = require('./logger');

const BASE = 'http://20.207.122.201/evaluation-service';

/**
 * Registers the user once. Server rejects duplicate registrations.
 */
async function register({ email, name, mobileNo, githubUsername, rollNo, accessCode }) {
  await Log('backend', 'info', 'auth', `initiating registration for: ${email}`);

  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, mobileNo, githubUsername, rollNo, accessCode }),
  });

  const data = await res.json();

  if (!res.ok) {
    await Log('backend', 'error', 'auth', `registration failed (${res.status}): ${JSON.stringify(data)}`);
    throw new Error('Registration failed');
  }

  await Log('backend', 'info', 'auth', `registration successful — clientID: ${data.clientID}`);
  return data;
}

/**
 * Fetches a Bearer token and injects it into the shared logger state.
 */
async function authenticate(credentials) {
  await Log('backend', 'info', 'auth', `authenticating: ${credentials.email}`);

  const res = await fetch(`${BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const data = await res.json();

  if (!res.ok) {
    await Log('backend', 'error', 'auth', `auth failed (${res.status}): ${JSON.stringify(data)}`);
    throw new Error('Authentication failed');
  }

  const token = data.access_token;
  setToken(token);

  await Log('backend', 'info', 'auth', `auth token acquired, expires: ${data.expires_in}`);
  return token;
}

module.exports = { register, authenticate };
