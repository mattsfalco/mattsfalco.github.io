# mattfalco.com

Personal website for Matthew Falco — auto-synced from [Gravatar](https://gravatar.com/matthewstephenfalco) and [LinkedIn](https://www.linkedin.com/in/matthewstephenfalco).

## How It Works

A GitHub Actions workflow runs daily to fetch profile data from connected sources, rebuild the site from templates, and deploy to GitHub Pages. No backend or runtime required.

```
data sources → JSON files → Handlebars templates → static HTML → GitHub Pages
```

### Data Sources

| Source | Type | File | Update |
|--------|------|------|--------|
| Gravatar | API | `data/gravatar.json` | Auto (daily via GitHub Actions) |
| LinkedIn | Manual | `data/linkedin.json` | Edit the JSON file directly |

## Development

```bash
npm install              # install dependencies
npm run fetch            # fetch latest data from sources
npm run build            # build static site to dist/
```

## Adding a New Data Source

1. Create a fetcher in `scripts/fetchers/mysource.js`:
   ```js
   async function fetch_mysource(config) {
     // Fetch data and return as object, or null to skip
     const res = await fetch(config.endpoint);
     return await res.json();
   }
   module.exports = fetch_mysource;
   ```

2. Register it in `data/sources.json`:
   ```json
   {
     "name": "mysource",
     "type": "api",
     "fetcher": "mysource",
     "config": { "endpoint": "https://api.example.com/profile" },
     "output": "data/mysource.json",
     "schedule": "daily"
   }
   ```

3. Use the data in templates — it's available as `{{mysource.fieldName}}` after updating `scripts/build.js` to include it in the context.

## Adding Custom Pages

Drop a `.md` or `.html` file in `src/pages/`. It will be automatically wrapped in the site layout and built to `dist/`.

## Project Structure

```
├── .github/workflows/    # GitHub Actions (build + deploy)
├── data/                  # JSON data files (auto-fetched + manual)
├── scripts/
│   ├── build.js           # Static site builder
│   ├── fetch-sources.js   # Data source fetcher
│   └── fetchers/          # Pluggable fetcher modules
├── src/
│   ├── templates/         # Handlebars HTML templates
│   ├── css/               # Stylesheets
│   ├── assets/            # Static assets
│   └── pages/             # Custom pages (Markdown/HTML)
├── dist/                  # Built output (gitignored)
└── CNAME                  # Custom domain config
```

## Deployment

Merging to `master` triggers GitHub Actions to build and deploy. Set GitHub Pages source to **GitHub Actions** in repo Settings > Pages.

Optional: Add a `GRAVATAR_API_KEY` repo secret for richer Gravatar profile data.
