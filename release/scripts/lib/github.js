/**
 * GitHub access checks shared by the release scripts.
 *
 * Every "GitHub publishing failed" up to v1.2.2 was the same thing: GH_TOKEN
 * in .env.local had a stray character in front of it, so GitHub answered 401
 * Bad credentials — but only AFTER a twenty-minute build, a version bump and a
 * pushed tag, which is why each release ended up being finished by hand.
 * Checking the token first turns that into a ten-second, clearly-worded stop.
 */
const { Octokit } = require('@octokit/rest');

/** The token from the environment, with stray whitespace/quotes removed. */
function getGitHubToken() {
  const raw = process.env.GH_TOKEN || '';
  return raw.trim().replace(/^['"]|['"]$/g, '');
}

function createOctokit() {
  return new Octokit({ auth: getGitHubToken() });
}

/**
 * Confirms the token authenticates AND can publish to the releases repo.
 * Returns a list of problems; empty means good to go.
 */
async function verifyGitHubAccess(config) {
  const problems = [];
  const token = getGitHubToken();

  if (!token) {
    return ['GH_TOKEN is not set in .env.local'];
  }
  // Classic tokens are ghp_ + 36 chars; fine-grained are github_pat_…
  if (!/^(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})$/.test(token)) {
    problems.push(
      `GH_TOKEN doesn't look like a GitHub token (starts "${token.slice(0, 4)}", ${token.length} chars). ` +
        'Classic tokens start "ghp_" and are 40 characters — check for a stray character when it was pasted.'
    );
  }

  const octokit = createOctokit();
  try {
    await octokit.rest.users.getAuthenticated();
  } catch (error) {
    if (error.status === 401) {
      problems.push('GitHub rejected GH_TOKEN (401 Bad credentials) — it is mistyped, revoked or expired.');
    } else {
      problems.push(`Could not reach GitHub to check GH_TOKEN: ${error.message}`);
    }
    return problems;
  }

  try {
    const { data: repo } = await octokit.rest.repos.get({
      owner: config.github.owner,
      repo: config.github.repo,
    });
    if (!repo.permissions?.push) {
      problems.push(
        `GH_TOKEN can read ${config.github.owner}/${config.github.repo} but cannot publish to it (needs push access).`
      );
    }
  } catch (error) {
    problems.push(
      `GH_TOKEN cannot see ${config.github.owner}/${config.github.repo} (${error.status ?? error.message}). ` +
        'A classic token needs the "repo" scope.'
    );
  }

  return problems;
}

module.exports = { getGitHubToken, createOctokit, verifyGitHubAccess };
