const fs = require('fs');
const path = require('path');

// LinkedIn DMA Member Data Portability API
// Available to EU/EEA members via https://developer.linkedin.com
// Scope: r_dma_portability_self_serve
const BASE_URL = 'https://api.linkedin.com/rest/memberSnapshotData';
const API_VERSION = '202312';

// Domains we care about for the personal website
const DOMAINS = [
  'PROFILE',
  'POSITIONS',
  'EDUCATION',
  'SKILLS',
  'CERTIFICATIONS',
  'LANGUAGES',
  'PROJECTS',
  'VOLUNTEERING_EXPERIENCES',
];

async function fetchDomain(domain, token) {
  const url = `${BASE_URL}?q=criteria&domain=${domain}`;
  const res = await globalThis.fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Linkedin-Version': API_VERSION,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn API ${res.status} for ${domain}: ${text}`);
  }

  const data = await res.json();
  const elements = data.elements || [];

  // Each domain returns one element with snapshotData array
  if (elements.length > 0 && elements[0].snapshotData) {
    return elements[0].snapshotData;
  }
  return [];
}

function parseProfile(snapshotData) {
  if (!snapshotData.length) return {};
  const p = snapshotData[0]; // Profile is a single record
  return {
    first_name: p['First Name'] || '',
    last_name: p['Last Name'] || '',
    headline: p['Headline'] || '',
    summary: p['Summary'] || '',
    industry: p['Industry'] || '',
    zip_code: p['Zip Code'] || '',
    geo_location: p['Geo Location'] || '',
    websites: p['Websites'] || '',
  };
}

function parsePositions(snapshotData) {
  return snapshotData.map((p) => ({
    company: p['Company Name'] || '',
    title: p['Title'] || '',
    description: p['Description'] || '',
    location: p['Location'] || '',
    start_date: p['Started On'] || '',
    end_date: p['Finished On'] || '',
    current: !p['Finished On'],
  }));
}

function parseEducation(snapshotData) {
  return snapshotData.map((e) => ({
    school: e['School Name'] || '',
    degree: e['Degree Name'] || '',
    field: e['Notes'] || '',
    start_date: e['Start Date'] || '',
    end_date: e['End Date'] || '',
    activities: e['Activities'] || '',
  }));
}

function parseSkills(snapshotData) {
  return snapshotData.map((s) => s['Name'] || s['Skill'] || '').filter(Boolean);
}

function parseCertifications(snapshotData) {
  return snapshotData.map((c) => ({
    name: c['Name'] || '',
    issuer: c['Authority'] || '',
    date: c['Started On'] || '',
    url: c['Url'] || '',
  }));
}

function parseLanguages(snapshotData) {
  return snapshotData.map((l) => ({
    language: l['Name'] || '',
    proficiency: l['Proficiency'] || '',
  }));
}

function parseProjects(snapshotData) {
  return snapshotData.map((p) => ({
    name: p['Title'] || '',
    description: p['Description'] || '',
    date: [p['Started On'], p['Finished On']].filter(Boolean).join(' - '),
    url: p['Url'] || '',
  }));
}

function parseVolunteer(snapshotData) {
  return snapshotData.map((v) => ({
    organization: v['Organization'] || '',
    role: v['Role'] || '',
    cause: v['Cause'] || '',
    description: v['Description'] || '',
    start_date: v['Started On'] || '',
    end_date: v['Finished On'] || '',
  }));
}

async function fetch_linkedin(config) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;

  if (!token) {
    console.log('No LINKEDIN_ACCESS_TOKEN set — keeping existing linkedin.json');
    console.log('  To enable: set up LinkedIn DMA Data Portability API');
    console.log('  (EU/EEA members only) and add token as GitHub secret.');
    console.log(`  Profile: ${config.profile_url}`);
    return null;
  }

  console.log('Fetching LinkedIn profile via DMA Data Portability API...');

  // Read existing data to preserve manual fields
  const existingPath = path.join(__dirname, '..', '..', 'data', 'linkedin.json');
  let existing = {};
  if (fs.existsSync(existingPath)) {
    existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
  }

  const result = {
    _source: config.profile_url,
    _updated_at: new Date().toISOString(),
    _note: 'Auto-fetched via LinkedIn DMA Data Portability API. Manual edits to fields not covered by the API will be preserved.',
  };

  for (const domain of DOMAINS) {
    try {
      console.log(`  Fetching ${domain}...`);
      const data = await fetchDomain(domain, token);

      switch (domain) {
        case 'PROFILE': {
          const profile = parseProfile(data);
          result.headline = profile.headline || existing.headline || '';
          result.summary = profile.summary || existing.summary || '';
          break;
        }
        case 'POSITIONS':
          result.experience = parsePositions(data);
          break;
        case 'EDUCATION':
          result.education = parseEducation(data);
          break;
        case 'SKILLS':
          result.skills = parseSkills(data);
          break;
        case 'CERTIFICATIONS':
          result.certifications = parseCertifications(data);
          break;
        case 'LANGUAGES':
          result.languages = parseLanguages(data);
          break;
        case 'PROJECTS':
          result.projects = parseProjects(data);
          break;
        case 'VOLUNTEERING_EXPERIENCES':
          result.volunteer = parseVolunteer(data);
          break;
      }
    } catch (err) {
      console.error(`  Warning: failed to fetch ${domain}: ${err.message}`);
      // Fall back to existing data for this field
      const fieldMap = {
        POSITIONS: 'experience',
        EDUCATION: 'education',
        SKILLS: 'skills',
        CERTIFICATIONS: 'certifications',
        LANGUAGES: 'languages',
        PROJECTS: 'projects',
        VOLUNTEERING_EXPERIENCES: 'volunteer',
      };
      const field = fieldMap[domain];
      if (field && existing[field]) {
        result[field] = existing[field];
      }
    }
  }

  // Preserve manually-added fields that the API doesn't cover
  if (existing.interests && !result.interests) {
    result.interests = existing.interests;
  }

  return result;
}

module.exports = fetch_linkedin;
