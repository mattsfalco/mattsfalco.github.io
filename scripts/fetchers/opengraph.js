/**
 * Open Graph metadata fetcher
 * Fetches OG tags (title, description, image, domain) from URLs found in linkedin.json
 * Used at build time to populate link preview cards with live data
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const TIMEOUT = 8000;
const MAX_REDIRECTS = 3;

/**
 * Fetch a URL and return the HTML body
 */
function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error('Too many redirects'));
    }

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const req = client.get(url, {
      timeout: TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OGFetcher/1.0)',
        'Accept': 'text/html',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        return resolve(fetchUrl(redirectUrl, redirectCount + 1));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => {
        body += chunk;
        // Only need the head section for OG tags
        if (body.length > 50000) {
          res.destroy();
          resolve(body);
        }
      });
      res.on('end', () => resolve(body));
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

/**
 * Extract OG metadata from HTML
 */
function parseOgTags(html) {
  const meta = {};
  // Match <meta property="og:..." content="..."> and <meta name="..." content="...">
  const regex = /<meta\s+(?:[^>]*?\s+)?(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?\s+content\s*=\s*["']([^"']*?)["'][^>]*?\/?>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    meta[match[1].toLowerCase()] = match[2];
  }

  // Also try reversed attribute order: content before property
  const regex2 = /<meta\s+(?:[^>]*?\s+)?content\s*=\s*["']([^"']*?)["'][^>]*?\s+(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi;
  while ((match = regex2.exec(html)) !== null) {
    const key = match[2].toLowerCase();
    if (!meta[key]) meta[key] = match[1];
  }

  // Fallback: extract <title>
  if (!meta['og:title']) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) meta['og:title'] = titleMatch[1].trim();
  }

  // Fallback: extract meta description
  if (!meta['og:description'] && !meta['description']) {
    const descMatch = html.match(/<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([^"']+)["']/i);
    if (descMatch) meta['description'] = descMatch[1];
  }

  // Extract favicon
  const iconMatch = html.match(/<link[^>]+rel\s*=\s*["'](?:shortcut )?icon["'][^>]+href\s*=\s*["']([^"']+)["']/i);
  if (iconMatch) meta['icon'] = iconMatch[1];

  return meta;
}

/**
 * Fetch OG metadata for a single URL
 */
async function fetchOgMetadata(url) {
  try {
    const html = await fetchUrl(url);
    const tags = parseOgTags(html);
    const parsed = new URL(url);

    return {
      title: tags['og:title'] || tags['twitter:title'] || '',
      description: tags['og:description'] || tags['twitter:description'] || tags['description'] || '',
      image: tags['og:image'] || tags['twitter:image'] || '',
      site_name: tags['og:site_name'] || '',
      icon: tags['icon'] || '',
      domain: parsed.hostname.replace(/^www\./, ''),
    };
  } catch (err) {
    console.log(`    Warning: Could not fetch OG data for ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Process all media items in linkedin.json, enriching with OG data
 * Only updates items that have a URL but are missing title/description/image
 */
async function enrichMediaItems(linkedinData) {
  const allMedia = [];

  // Collect all media items from featured, experience, and projects
  if (linkedinData.featured) {
    for (const item of linkedinData.featured) {
      if (item.url) allMedia.push(item);
    }
  }

  for (const exp of linkedinData.experience || []) {
    for (const item of exp.media || []) {
      if (item.url) allMedia.push(item);
    }
  }

  for (const proj of linkedinData.projects || []) {
    for (const item of proj.media || []) {
      if (item.url) allMedia.push(item);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = allMedia.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  console.log(`  Found ${unique.length} unique media URLs to enrich`);

  // Fetch OG data for items missing metadata
  const ogCache = {};
  for (const item of unique) {
    if (item.og_fetched) continue; // Already enriched

    console.log(`    Fetching OG: ${item.url}`);
    const og = await fetchOgMetadata(item.url);
    if (og) {
      ogCache[item.url] = og;
    }
  }

  // Apply OG data back to all media items (including duplicates)
  const applyOg = (item) => {
    const og = ogCache[item.url];
    if (!og) return;
    // Only fill in empty fields, don't overwrite manual data
    if (!item.title && og.title) item.title = og.title;
    if (!item.description && og.description) item.description = og.description;
    if (!item.image && og.image) item.image = og.image;
    if (!item.domain && og.domain) item.domain = og.domain;
    if (!item.site_name && og.site_name) item.site_name = og.site_name;
    if (!item.icon && og.icon) item.icon = og.icon;
    item.og_fetched = true;
  };

  if (linkedinData.featured) linkedinData.featured.forEach(applyOg);
  for (const exp of linkedinData.experience || []) {
    (exp.media || []).forEach(applyOg);
  }
  for (const proj of linkedinData.projects || []) {
    (proj.media || []).forEach(applyOg);
  }

  return linkedinData;
}

module.exports = { fetchOgMetadata, enrichMediaItems };
