const fs = require('fs');
const path = require('path');

async function fetch_gravatar(config) {
  const { endpoint } = config;
  const apiKey = process.env.GRAVATAR_API_KEY;

  const headers = { 'User-Agent': 'mattsfalco-website/1.0' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  console.log(`Fetching Gravatar profile from ${endpoint}...`);
  if (!apiKey) {
    console.log('  (No GRAVATAR_API_KEY set - using public endpoint with limited data)');
  }

  const res = await globalThis.fetch(endpoint, { headers });

  if (!res.ok) {
    throw new Error(`Gravatar API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  data._fetched_at = new Date().toISOString();
  return data;
}

module.exports = fetch_gravatar;
