async function fetch_linkedin(config) {
  // LinkedIn has no public API for profile scraping.
  // This fetcher simply reads the manually-maintained data/linkedin.json file.
  // To update: edit data/linkedin.json directly with your latest LinkedIn info.
  console.log('LinkedIn source is manually maintained.');
  console.log(`  Update data/linkedin.json when your profile changes.`);
  console.log(`  Profile: ${config.profile_url}`);
  return null; // null = no update, keep existing file
}

module.exports = fetch_linkedin;
