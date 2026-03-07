const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const sourcesPath = path.join(ROOT, 'data', 'sources.json');
  const { sources } = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));

  console.log(`Found ${sources.length} data source(s)\n`);

  for (const source of sources) {
    console.log(`--- ${source.name} (${source.type}) ---`);

    try {
      const fetcher = require(`./fetchers/${source.fetcher}.js`);
      const data = await fetcher(source.config);

      if (data === null) {
        console.log(`  Skipped (no update)\n`);
        continue;
      }

      const outputPath = path.join(ROOT, source.output);
      const existing = fs.existsSync(outputPath)
        ? fs.readFileSync(outputPath, 'utf-8')
        : '';

      const newContent = JSON.stringify(data, null, 2) + '\n';

      if (existing.trim() === newContent.trim()) {
        console.log(`  No changes detected\n`);
      } else {
        fs.writeFileSync(outputPath, newContent);
        console.log(`  Updated ${source.output}\n`);
      }
    } catch (err) {
      console.error(`  Error fetching ${source.name}: ${err.message}`);
      console.error(`  Keeping existing data\n`);
    }
  }

  // Enrich LinkedIn media with Open Graph metadata
  const linkedinPath = path.join(ROOT, 'data', 'linkedin.json');
  if (fs.existsSync(linkedinPath)) {
    console.log('\n--- Open Graph Enrichment ---');
    try {
      const { enrichMediaItems } = require('./fetchers/opengraph.js');
      const linkedinData = JSON.parse(fs.readFileSync(linkedinPath, 'utf-8'));
      const enriched = await enrichMediaItems(linkedinData);
      const enrichedContent = JSON.stringify(enriched, null, 2) + '\n';
      fs.writeFileSync(linkedinPath, enrichedContent);
      console.log('  OG enrichment complete\n');
    } catch (err) {
      console.error(`  OG enrichment error: ${err.message}\n`);
    }
  }

  console.log('Done fetching sources.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
