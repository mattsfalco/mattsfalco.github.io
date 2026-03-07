async function fetch_github(config) {
  const { username } = config;
  const token = process.env.GITHUB_TOKEN;

  const headers = {
    'User-Agent': 'mattsfalco-website/1.0',
    'Accept': 'application/vnd.github+json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`Fetching GitHub profile for ${username}...`);

  // Fetch user profile
  const userRes = await globalThis.fetch(`https://api.github.com/users/${username}`, { headers });
  if (!userRes.ok) {
    throw new Error(`GitHub API returned ${userRes.status}: ${userRes.statusText}`);
  }
  const user = await userRes.json();

  // Fetch public repos (sorted by most recently updated)
  const reposRes = await globalThis.fetch(
    `https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`,
    { headers }
  );
  if (!reposRes.ok) {
    throw new Error(`GitHub repos API returned ${reposRes.status}: ${reposRes.statusText}`);
  }
  const allRepos = await reposRes.json();

  // Filter out forks, sort by stars then update date
  const repos = allRepos
    .filter((r) => !r.fork)
    .sort((a, b) => (b.stargazers_count - a.stargazers_count) || new Date(b.updated_at) - new Date(a.updated_at))
    .map((r) => ({
      name: r.name,
      description: r.description || '',
      url: r.html_url,
      language: r.language || '',
      stars: r.stargazers_count,
      forks: r.forks_count,
      updated_at: r.updated_at,
      topics: r.topics || [],
    }));

  return {
    username: user.login,
    name: user.name || '',
    bio: user.bio || '',
    url: user.html_url,
    avatar_url: user.avatar_url,
    public_repos: user.public_repos,
    followers: user.followers,
    repos,
    _fetched_at: new Date().toISOString(),
  };
}

module.exports = fetch_github;
