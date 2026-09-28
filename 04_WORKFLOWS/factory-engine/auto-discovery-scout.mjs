import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getSourcesRegistry } from './upgrade-checker.mjs';
import { acquireTargetLock, releaseTargetLock } from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const QUEUE_PATH = path.join(BRAIN_ROOT, 'repos.txt');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');
const DISCOVERY_LOG_PATH = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'discovery-log.json');
const LOCKS_DIR = path.join(BRAIN_ROOT, '.harvest-locks');

const USER_AGENT = 'AI-Builder-Brain-AutoDiscoveryScout/1.0';

/**
 * Curated discovery domains with high-signal queries targeting world-class architectures
 */
export const DISCOVERY_DOMAINS = {
  'ai-agents': {
    name: 'AI & Autonomous Agent Architectures',
    type: 'github',
    queries: [
      'topic:ai-agents stars:>2000 sort:stars',
      'topic:llm-agent stars:>1500 sort:stars',
      '"autonomous agents" language:python stars:>3000 sort:stars',
      'topic:mcp-server stars:>500 sort:stars'
    ]
  },
  'fullstack-ui': {
    name: 'Modern Full-Stack & UI Design Systems',
    type: 'github',
    queries: [
      'topic:ui-components language:typescript stars:>4000 sort:stars',
      'topic:nextjs "design-system" stars:>2500 sort:stars',
      'topic:tailwind topic:components stars:>3000 sort:stars'
    ]
  },
  'high-perf-systems': {
    name: 'High-Performance Developer Tooling & Runtimes',
    type: 'github',
    queries: [
      'topic:developer-tools language:rust stars:>3000 sort:stars',
      'topic:cli language:rust stars:>4000 sort:stars',
      'topic:runtime language:zig stars:>1000 sort:stars'
    ]
  },
  'huggingface-ai-models': {
    name: 'Trending Foundation Models & AI Weights',
    type: 'huggingface',
    endpoints: [
      'https://huggingface.co/api/models?sort=trending&limit=10',
      'https://huggingface.co/api/models?sort=downloads&direction=-1&limit=10'
    ]
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Safe fetch with rate limit handling
 */
async function compliantFetch(url, customHeaders = {}) {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...customHeaders
  };

  const token = process.env.GITHUB_TOKEN;
  if (token && url.includes('api.github.com')) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const res = await fetch(url, { headers });

    const remaining = res.headers.get('x-ratelimit-remaining');
    const resetTime = res.headers.get('x-ratelimit-reset');

    if (remaining !== null && parseInt(remaining, 10) < 5) {
      console.warn(`[SCOUT RATE LIMIT] Remaining: ${remaining}. Pausing respectfully.`);
      await sleep(3000);
    }

    if (res.status === 403 && remaining === '0') {
      console.warn(`[SCOUT RATE LIMIT EXCEEDED] Pausing search queries.`);
      return null;
    }

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SCOUT FETCH ERROR] ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Load list of already known repositories
 */
function getKnownRepositories() {
  const known = new Set();

  // 1. From sources-registry.json
  const registry = getSourcesRegistry();
  for (const [key, val] of Object.entries(registry)) {
    known.add(key.toLowerCase());
    if (val.officialUrl) {
      known.add(val.officialUrl.toLowerCase().replace(/\/$/, ''));
    }
  }

  // 2. From repos.txt
  if (fs.existsSync(QUEUE_PATH)) {
    const lines = fs.readFileSync(QUEUE_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        known.add(trimmed.toLowerCase().replace(/\/$/, ''));
        const parts = trimmed.split('/');
        if (parts.length >= 2) {
          const slug = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`.toLowerCase();
          known.add(slug);
        }
      }
    }
  }

  return known;
}

/**
 * Check if auto-discovery is enabled in harvest-control.json
 */
export function isAutoDiscoveryEnabled() {
  if (!fs.existsSync(CONTROL_PATH)) return true;
  try {
    const config = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    return config.autoDiscovery?.enabled !== false;
  } catch (e) {
    return true;
  }
}

/**
 * Acquire domain lock for multi-agent parallelism
 */
function acquireDomainLock(domainKey, agentId) {
  if (!fs.existsSync(LOCKS_DIR)) {
    fs.mkdirSync(LOCKS_DIR, { recursive: true });
  }

  const lockFile = path.join(LOCKS_DIR, `scout-domain-${domainKey}.lock`);
  if (fs.existsSync(lockFile)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
      const ageMinutes = (Date.now() - new Date(lockData.lockedAt).getTime()) / (1000 * 60);
      if (ageMinutes < 20) {
        return { acquired: false, holder: lockData.agentId };
      }
    } catch (e) {}
  }

  const lockContent = {
    domain: domainKey,
    agentId: agentId || `agent-scout-${process.pid}`,
    lockedAt: new Date().toISOString()
  };

  fs.writeFileSync(lockFile, JSON.stringify(lockContent, null, 2), 'utf-8');
  return { acquired: true };
}

function releaseDomainLock(domainKey) {
  const lockFile = path.join(LOCKS_DIR, `scout-domain-${domainKey}.lock`);
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
    } catch (e) {}
  }
}

/**
 * Scouts GitHub for top repositories in a specific domain
 */
async function scoutGitHubDomain(domainKey, domainConfig, knownRepos, maxCandidates = 3) {
  const candidates = [];
  const minStars = 1500;

  for (const query of domainConfig.queries) {
    if (candidates.length >= maxCandidates) break;

    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://api.github.com/search/repositories?q=${encodedQuery}&per_page=10`;
    console.log(`🔍 [SCOUTING GITHUB] Querying: "${query}"...`);

    const data = await compliantFetch(searchUrl);
    await sleep(2000); // Respect search API rate limits

    if (!data || !Array.isArray(data.items)) continue;

    for (const item of data.items) {
      if (candidates.length >= maxCandidates) break;

      const htmlUrl = item.html_url;
      const fullName = item.full_name.toLowerCase();

      // Filter: Ignore already known/harvested repositories
      if (knownRepos.has(htmlUrl.toLowerCase()) || knownRepos.has(fullName)) {
        continue;
      }

      // Filter: Ignore forks and archived repos
      if (item.fork || item.archived) continue;

      // Filter: Minimum stars requirement
      if ((item.stargazers_count || 0) < minStars) continue;

      // Filter: Activity check - must have been updated in last 120 days
      const lastPushed = new Date(item.pushed_at).getTime();
      const daysSincePush = (Date.now() - lastPushed) / (1000 * 60 * 60 * 24);
      if (daysSincePush > 120) continue;

      // Quality Score Calculation
      const stars = item.stargazers_count || 0;
      const forks = item.forks_count || 0;
      const openIssues = item.open_issues_count || 0;
      const qualityScore = Math.round(stars * 0.6 + forks * 0.3 + (item.has_wiki ? 100 : 0));

      const candidate = {
        name: item.name,
        fullName: item.full_name,
        url: item.html_url,
        type: 'github',
        domain: domainKey,
        description: item.description || 'No description',
        stars,
        forks,
        openIssues,
        language: item.language || 'Unknown',
        qualityScore,
        discoveredAt: new Date().toISOString()
      };

      candidates.push(candidate);
      knownRepos.add(htmlUrl.toLowerCase());
      knownRepos.add(fullName);
      console.log(`   ✨ [DISCOVERED BEST REPO] ${item.full_name} (${stars} ⭐, Lang: ${candidate.language}, Score: ${qualityScore})`);
    }
  }

  return candidates;
}

/**
 * Scouts Hugging Face for trending AI models
 */
async function scoutHuggingFaceModels(knownRepos, maxCandidates = 2) {
  const candidates = [];
  const endpoint = 'https://huggingface.co/api/models?sort=trending&limit=15';
  console.log(`🔍 [SCOUTING HUGGING FACE] Querying trending AI models...`);

  const data = await compliantFetch(endpoint);
  await sleep(1500);

  if (!Array.isArray(data)) return candidates;

  for (const item of data) {
    if (candidates.length >= maxCandidates) break;

    const modelId = item.id || item.modelId;
    if (!modelId) continue;

    const url = `https://huggingface.co/${modelId}`;
    const lowerUrl = url.toLowerCase();
    const lowerId = modelId.toLowerCase();

    if (knownRepos.has(lowerUrl) || knownRepos.has(lowerId)) continue;

    // Filter: Model must have downloads or likes
    const downloads = item.downloads || 0;
    const likes = item.likes || 0;
    if (downloads < 500 && likes < 50) continue;

    const candidate = {
      name: modelId,
      fullName: modelId,
      url,
      type: 'huggingface',
      domain: 'huggingface-ai-models',
      description: `Trending Hugging Face Model: ${modelId} (${likes} likes, ${downloads} downloads)`,
      likes,
      downloads,
      qualityScore: likes * 10 + Math.min(downloads, 1000),
      discoveredAt: new Date().toISOString()
    };

    candidates.push(candidate);
    knownRepos.add(lowerUrl);
    knownRepos.add(lowerId);
    console.log(`   ✨ [DISCOVERED AI MODEL] ${modelId} (${likes} ❤️, ${downloads} ⬇️)`);
  }

  return candidates;
}

/**
 * Appends newly discovered repositories to repos.txt
 */
export function appendDiscoveredToQueue(candidates) {
  if (!candidates || candidates.length === 0) return 0;

  let existingContent = '';
  if (fs.existsSync(QUEUE_PATH)) {
    existingContent = fs.readFileSync(QUEUE_PATH, 'utf-8');
  }

  const newLines = [];
  newLines.push(`\n# --- Automatically Discovered by AI Scout Engine [${new Date().toISOString()}] ---`);

  for (const cand of candidates) {
    newLines.push(`# [${cand.domain.toUpperCase()}] ${cand.fullName} (${cand.qualityScore} score) - ${cand.description.slice(0, 80)}`);
    newLines.push(cand.url);
  }

  fs.appendFileSync(QUEUE_PATH, newLines.join('\n') + '\n', 'utf-8');
  console.log(`📝 [QUEUE UPDATED] Added ${candidates.length} top repositories to repos.txt.`);

  // Append to discovery log
  let log = [];
  if (fs.existsSync(DISCOVERY_LOG_PATH)) {
    try {
      log = JSON.parse(fs.readFileSync(DISCOVERY_LOG_PATH, 'utf-8'));
    } catch (e) {}
  }
  log.push(...candidates);
  fs.writeFileSync(DISCOVERY_LOG_PATH, JSON.stringify(log, null, 2), 'utf-8');

  return candidates.length;
}

/**
 * Main Autonomous Discovery Orchestrator
 */
export async function runAutoDiscoveryScout(options = {}) {
  console.log(`\n======================================================================`);
  console.log(`🔭 AI-BUILDER-BRAIN AUTONOMOUS DISCOVERY SCOUT ENGINE`);
  console.log(`   Mode: Multi-Agent Parallel Domain Scout`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`======================================================================`);

  if (!isAutoDiscoveryEnabled()) {
    console.log(`⏸️ [SCOUT PAUSED] Auto-discovery is currently disabled in harvest-control.json.`);
    return { discovered: 0, items: [] };
  }

  const knownRepos = getKnownRepositories();
  const agentId = options.agentId || `agent-${process.env.AGENT_NAME || process.pid}`;
  const targetDomain = options.domain || null;
  const maxPerDomain = options.maxPerDomain || 2;

  const domainsToScout = targetDomain
    ? [targetDomain]
    : Object.keys(DISCOVERY_DOMAINS);

  const allDiscovered = [];

  for (const domainKey of domainsToScout) {
    const domainConfig = DISCOVERY_DOMAINS[domainKey];
    if (!domainConfig) continue;

    console.log(`\n📡 [SCOUT DOMAIN] ${domainConfig.name} (${domainKey})...`);

    // Domain Lock for Multi-Agent Safety
    const lockResult = acquireDomainLock(domainKey, agentId);
    if (!lockResult.acquired) {
      console.log(`   🔒 [LOCKED BY ANOTHER AGENT] Domain ${domainKey} currently scouted by ${lockResult.holder}. Skipping.`);
      continue;
    }

    try {
      let candidates = [];
      if (domainConfig.type === 'github') {
        candidates = await scoutGitHubDomain(domainKey, domainConfig, knownRepos, maxPerDomain);
      } else if (domainConfig.type === 'huggingface') {
        candidates = await scoutHuggingFaceModels(knownRepos, maxPerDomain);
      }

      allDiscovered.push(...candidates);
    } catch (err) {
      console.error(`   ❌ [SCOUT ERROR] ${domainKey}: ${err.message}`);
    } finally {
      releaseDomainLock(domainKey);
    }
  }

  if (allDiscovered.length > 0) {
    appendDiscoveredToQueue(allDiscovered);
    console.log(`\n🎉 [SCOUT COMPLETE] Successfully discovered ${allDiscovered.length} world-class repositories!`);
  } else {
    console.log(`\n✨ [SCOUT STATUS] All top candidates in scanned domains are already indexed or queue is saturated.`);
  }

  return { discovered: allDiscovered.length, items: allDiscovered };
}

// CLI Execution Entry Point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const domainArg = process.argv[2] || null;
  runAutoDiscoveryScout({ domain: domainArg }).catch((err) => {
    console.error('Fatal Auto-Discovery Scout error:', err);
    process.exit(1);
  });
}
