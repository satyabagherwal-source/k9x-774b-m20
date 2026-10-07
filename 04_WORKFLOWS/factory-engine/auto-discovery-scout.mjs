import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { getSourcesRegistry } from './upgrade-checker.mjs';
import { acquireTargetLock, releaseTargetLock } from './concurrency-coordinator.mjs';
import {
  checkServiceAvailability,
  inspectAndRecordHeaders,
  MASTER_SERVICES
} from './master-circuit-breaker.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const QUEUE_PATH = path.join(BRAIN_ROOT, 'repos.txt');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');
const DISCOVERY_LOG_PATH = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'discovery-log.json');
const CURSOR_PATH = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'discovery-cursor.json');
const LOCKS_DIR = path.join(BRAIN_ROOT, '.harvest-locks');

const USER_AGENT = 'AI-Builder-Brain-AutonomousScout/2.0';

/**
 * Verified Top-Tier Tech Organizations (Highest Trust Tier)
 */
export const TRUSTED_ORGANIZATIONS = new Set([
  'google', 'googleworkspace', 'microsoft', 'facebook', 'meta-llama', 'vercel',
  'cloudflare', 'apache', 'rust-lang', 'golang', 'apple', 'openai', 'anthropic',
  'deepseek-ai', 'mistralai', 'huggingface', 'tensorflow', 'pytorch', 'alibaba',
  'tencent', 'bytedance', 'docker', 'kubernetes', 'elastic', 'hashicorp',
  'tailwindlabs', 'shadcn-ui', 'astral-sh', 'oven-sh', 'denoland', 'nodejs',
  'fastapi', 'tiangolo', 'pydantic', 'reduxjs', 'facebookresearch', 'vllm-project',
  'huggingface', 'langchain-ai', 'run-llama', 'ollama', 'radix-ui', 'tanstack'
]);

/**
 * Strict Anti-Spam Keywords: Immediate disqualification if present in name or description
 */
const SPAM_KEYWORDS = [
  'crack', 'keygen', 'cheat', 'cheats', 'exploit', 'botnet', 'ddos', 'airdrop',
  'free-nitro', 'token-stealer', 'grabber', 'stealer', 'cryptostealer',
  'crypto-drainer', 'drainer', 'free-followers', 'casino', 'gambling',
  'betting', 'iptv-m3u', 'adult', 'leak', 'leaks', 'generator', 'serial-key',
  'bypass-tool', 'free-download', 'hack-tool', 'roblox-script', 'fortnite-cheat',
  'spammer', 'mass-dm', 'cracked-software'
];

/**
 * Non-Code Patterns: Markdown link farms, book lists, and resource collections without executable architectures
 */
const NON_CODE_PATTERNS = [
  /^awesome-/i, /-awesome$/i, /free-programming-books/i, /public-apis/i,
  /interview-questions/i, /cheatsheet/i, /roadmap/i, /books/i, /resources/i,
  /curated-list/i, /learning-path/i
];

/**
 * Curated discovery domains with high-signal, multi-tiered queries for endless rotation
 */
export const DISCOVERY_DOMAINS = {
  'ai-agents': {
    name: 'AI & Autonomous Agent Architectures',
    type: 'github',
    queries: [
      'topic:ai-agents stars:>1500 sort:stars',
      'topic:llm-agent stars:>1000 sort:stars',
      'topic:mcp-server stars:>300 sort:stars',
      '"autonomous agent" language:python stars:>2000 sort:stars',
      'topic:rag language:python stars:>1500 sort:stars',
      'topic:langchain OR topic:autogen OR topic:crewai stars:>1500 sort:stars',
      '"agent workflow" language:typescript stars:>1000 sort:stars',
      'topic:multi-agent stars:>800 sort:stars'
    ]
  },
  'fullstack-ui': {
    name: 'Modern Full-Stack & UI Design Systems',
    type: 'github',
    queries: [
      'topic:ui-components language:typescript stars:>3000 sort:stars',
      'topic:nextjs "design-system" stars:>1500 sort:stars',
      'topic:tailwind topic:components stars:>2000 sort:stars',
      'topic:react-components language:typescript stars:>2500 sort:stars',
      'topic:design-system language:typescript stars:>2000 sort:stars',
      'topic:svelte OR topic:vue stars:>2500 sort:stars',
      'topic:web-framework language:typescript stars:>3000 sort:stars'
    ]
  },
  'high-perf-systems': {
    name: 'High-Performance Developer Tooling & Runtimes',
    type: 'github',
    queries: [
      'topic:developer-tools language:rust stars:>2500 sort:stars',
      'topic:cli language:rust stars:>3000 sort:stars',
      'topic:runtime language:zig OR language:rust stars:>1500 sort:stars',
      'topic:async language:rust stars:>2000 sort:stars',
      'language:go topic:system stars:>2500 sort:stars',
      'topic:compiler language:rust OR language:c++ stars:>2000 sort:stars',
      'topic:wasm OR topic:webassembly stars:>1500 sort:stars'
    ]
  },
  'huggingface-ai-models': {
    name: 'Trending Foundation Models & AI Weights',
    type: 'huggingface',
    sorts: ['trendingScore', 'downloads', 'likes']
  },
  'mobile-cross-platform': {
    name: 'Mobile & Cross-Platform Native Architecture',
    type: 'github',
    queries: [
      'topic:react-native stars:>2500 sort:stars',
      'topic:flutter "architecture" stars:>2000 sort:stars',
      'topic:kotlin-multiplatform stars:>1000 sort:stars',
      'topic:swiftui stars:>1500 sort:stars',
      'topic:mobile language:dart OR language:kotlin stars:>2000 sort:stars'
    ]
  },
  'devops-cloud-infrastructure': {
    name: 'Cloud-Native & Distributed Infrastructure',
    type: 'github',
    queries: [
      'topic:kubernetes "controller" stars:>1500 sort:stars',
      'topic:docker "developer-tool" stars:>1500 sort:stars',
      'topic:cloud-native language:go stars:>2000 sort:stars',
      'topic:observability language:go OR language:rust stars:>1500 sort:stars',
      'topic:infrastructure-as-code stars:>2000 sort:stars',
      'topic:service-mesh OR topic:proxy stars:>1500 sort:stars'
    ]
  },
  'cybersecurity-defenses': {
    name: 'Application Security & Cryptography Defenses',
    type: 'github',
    queries: [
      'topic:security "zero-trust" stars:>1000 sort:stars',
      'topic:cryptography language:rust stars:>1500 sort:stars',
      'topic:authentication language:typescript OR language:go stars:>1500 sort:stars',
      'topic:appsec OR topic:vulnerability-scanner stars:>1000 sort:stars',
      'topic:identity OR topic:oauth stars:>1500 sort:stars'
    ]
  },
  'database-storage-engines': {
    name: 'High-Throughput Databases & Vector Storage',
    type: 'github',
    queries: [
      'topic:vector-database stars:>1500 sort:stars',
      'topic:database language:rust stars:>2500 sort:stars',
      'topic:sqlite OR topic:embedded-database stars:>1000 sort:stars',
      'topic:key-value-store language:go OR language:rust stars:>1500 sort:stars',
      'topic:storage-engine language:c++ OR language:rust stars:>1500 sort:stars',
      'topic:distributed-database stars:>2000 sort:stars'
    ]
  },
  'cognitive-neuroscience-systems': {
    name: 'Cognitive Architectures, Neuroscience & Science Systems',
    type: 'github',
    queries: [
      'topic:cognitive-architecture stars:>500 sort:stars',
      'topic:neuroscience language:python OR language:rust stars:>800 sort:stars',
      'topic:neuro-symbolic stars:>500 sort:stars',
      'topic:computational-neuroscience OR topic:brain-computer-interface stars:>500 sort:stars',
      'topic:formal-verification language:rust OR language:c++ stars:>800 sort:stars'
    ]
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polite HTTP Fetch with Rate-Limit & Backoff Handling
 */
async function compliantFetch(url, customHeaders = {}) {
  const isGithub = url.includes('api.github.com');
  const isHf = url.includes('huggingface.co');

  // Master Circuit Breaker Pre-flight: Never query if circuit is in cooldown
  if (isGithub) {
    const avail = checkServiceAvailability(MASTER_SERVICES.GITHUB_API);
    if (!avail.available) {
      console.warn(`[SCOUT PRE-FLIGHT BLOCKED] GitHub API is on cooldown until ${avail.resetAt} (${avail.waitSec}s left). Skipping query to prevent API ban.`);
      return null;
    }
  } else if (isHf) {
    const avail = checkServiceAvailability(MASTER_SERVICES.HUGGINGFACE_API);
    if (!avail.available) {
      console.warn(`[SCOUT PRE-FLIGHT BLOCKED] Hugging Face API is on cooldown until ${avail.resetAt}. Skipping.`);
      return null;
    }
  }

  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...customHeaders
  };

  const token = process.env.GITHUB_TOKEN;
  if (token && isGithub) {
    headers['Authorization'] = `token ${token}`;
  }

  const hfToken = process.env.HF_TOKEN;
  if (hfToken && isHf) {
    headers['Authorization'] = `Bearer ${hfToken}`;
  }

  try {
    const res = await fetch(url, { headers });

    // Inspect headers & trip circuit if limit reached
    if (isGithub) {
      const isHealthy = inspectAndRecordHeaders(MASTER_SERVICES.GITHUB_API, res.headers, res.status, url);
      if (!isHealthy) {
        console.warn(`[SCOUT CIRCUIT TRIPPED] GitHub API rate limit reached. All queries paused until reset.`);
        return null;
      }
    } else if (isHf) {
      const isHealthy = inspectAndRecordHeaders(MASTER_SERVICES.HUGGINGFACE_API, res.headers, res.status, url);
      if (!isHealthy) {
        return null;
      }
    }

    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[SCOUT FETCH ERROR] ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Persistent Discovery Cursor: Remembers current page and query index per domain
 */
export function getDiscoveryCursor() {
  if (fs.existsSync(CURSOR_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CURSOR_PATH, 'utf-8'));
    } catch (e) {}
  }

  // Initialize fresh cursor state
  const defaultCursor = {
    domains: {},
    huggingFace: { sortIndex: 0, page: 1 },
    totalAutoDiscovered: 0,
    lastReplenishedAt: null
  };

  for (const domain of Object.keys(DISCOVERY_DOMAINS)) {
    defaultCursor.domains[domain] = { queryIndex: 0, page: 1 };
  }

  return defaultCursor;
}

export function saveDiscoveryCursor(cursor) {
  try {
    fs.writeFileSync(CURSOR_PATH, JSON.stringify(cursor, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`[WARN] Failed to save discovery cursor: ${e.message}`);
  }
}

/**
 * Strict Trust & Anti-Spam Gate: Evaluates whether a repository is reputable and worthy of Master Brain
 */
export function evaluateRepositoryTrust(item, type = 'github') {
  if (!item) return { trusted: false, reason: 'NULL_ITEM' };

  if (type === 'github') {
    // 1. Hard Disqualifiers
    if (item.fork && (item.stargazers_count || 0) < 15000) {
      return { trusted: false, reason: 'UNVERIFIED_FORK' };
    }
    if (item.archived || item.disabled) {
      return { trusted: false, reason: 'ARCHIVED_OR_DISABLED' };
    }
    if ((item.size || 0) < 25) {
      return { trusted: false, reason: 'EMPTY_OR_TRIVIAL_REPO' };
    }

    const name = (item.name || '').toLowerCase();
    const fullName = (item.full_name || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const combinedText = `${name} ${fullName} ${desc}`;

    // 2. Anti-Spam / Scam / Malware Keyword Blacklist
    for (const kw of SPAM_KEYWORDS) {
      if (combinedText.includes(kw)) {
        return { trusted: false, reason: `SPAM_KEYWORD_MATCH: ${kw}` };
      }
    }

    // 3. Non-Code Link Aggregator Rejection (Skip plain markdown list repositories)
    for (const pattern of NON_CODE_PATTERNS) {
      if (pattern.test(name) || pattern.test(fullName)) {
        return { trusted: false, reason: 'NON_CODE_RESOURCE_LIST' };
      }
    }

    // 4. Must have a real programming language (Not pure markdown or empty)
    if (!item.language && !TRUSTED_ORGANIZATIONS.has(item.owner?.login?.toLowerCase())) {
      return { trusted: false, reason: 'NO_PROGRAMMING_LANGUAGE_DETECTED' };
    }

    // 5. Starfarm Detection: High stars but zero engagement and brand-new
    const ageDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 60 && (item.stargazers_count || 0) > 500 && (item.open_issues_count || 0) === 0 && (item.forks_count || 0) < 3) {
      return { trusted: false, reason: 'SUSPECTED_BOT_STARFARM' };
    }

    // 6. Quality & Trust Score Calculation
    const stars = item.stargazers_count || 0;
    const forks = item.forks_count || 0;
    const openIssues = item.open_issues_count || 0;
    const ownerName = (item.owner?.login || '').toLowerCase();

    let score = Math.round(stars * 0.5 + forks * 0.3 + Math.min(openIssues * 2, 200));

    // Verified Org Trust Bonus
    if (TRUSTED_ORGANIZATIONS.has(ownerName)) {
      score += 1000;
    }
    // License verification
    if (item.license && item.license.key) {
      score += 150;
    }
    // Has documentation / wiki
    if (item.has_wiki || item.has_pages) {
      score += 100;
    }

    // Minimum Quality Threshold: 400 score
    if (score < 400 && stars < 1000) {
      return { trusted: false, reason: 'BELOW_QUALITY_THRESHOLD' };
    }

    return { trusted: true, score, verifiedOrg: TRUSTED_ORGANIZATIONS.has(ownerName) };
  }

  if (type === 'huggingface') {
    if (item.private) return { trusted: false, reason: 'PRIVATE_MODEL' };
    const likes = item.likes || 0;
    const downloads = item.downloads || 0;
    if (likes < 15 && downloads < 300) {
      return { trusted: false, reason: 'INSUFFICIENT_COMMUNITY_ADOPTION' };
    }
    const score = likes * 10 + Math.min(downloads, 2000);
    return { trusted: true, score };
  }

  return { trusted: false, reason: 'UNKNOWN_TYPE' };
}

/**
 * Load list of already known repositories (both registry and repos.txt)
 */
export function getKnownRepositories() {
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
 * Scouts GitHub for top repositories in a specific domain using persistent cursor and Trust Gate
 */
async function scoutGitHubDomain(domainKey, domainConfig, knownRepos, maxCandidates = 3, cursor = null) {
  const candidates = [];
  const domainCursor = cursor?.domains?.[domainKey] || { queryIndex: 0, page: 1 };
  const queries = domainConfig.queries || [];

  if (queries.length === 0) return candidates;

  // Master Switch Check: Do not attempt any search queries if GitHub is resting
  const ghAvail = checkServiceAvailability(MASTER_SERVICES.GITHUB_API);
  if (!ghAvail.available) {
    console.log(`⏳ [SCOUT PAUSED] GitHub API Master Switch is OFF until ${ghAvail.resetAt} (${ghAvail.waitSec}s left). Skipping domain search.`);
    return candidates;
  }

  let queryIdx = domainCursor.queryIndex % queries.length;
  let page = domainCursor.page || 1;
  let attempts = 0;

  while (candidates.length < maxCandidates && attempts < queries.length * 2) {
    // Re-check master switch on every query
    if (!checkServiceAvailability(MASTER_SERVICES.GITHUB_API).available) {
      console.log(`⏳ [SCOUT HALTED] GitHub API entered cooldown. Breaking query loop.`);
      break;
    }

    attempts++;
    const currentQuery = queries[queryIdx];
    const encodedQuery = encodeURIComponent(currentQuery);
    const searchUrl = `https://api.github.com/search/repositories?q=${encodedQuery}&per_page=15&page=${page}`;

    console.log(`🔍 [SCOUTING GITHUB] Domain: ${domainKey} | Query [${queryIdx + 1}/${queries.length}]: "${currentQuery}" | Page: ${page}`);

    const data = await compliantFetch(searchUrl);
    await sleep(1500); // Respect search API rate limits

    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      // If circuit was tripped, abort immediately
      if (!checkServiceAvailability(MASTER_SERVICES.GITHUB_API).available) {
        break;
      }
      // Query exhausted or no results: move to next query and reset page to 1
      queryIdx = (queryIdx + 1) % queries.length;
      page = 1;
      continue;
    }

    for (const item of data.items) {
      if (candidates.length >= maxCandidates) break;

      const htmlUrl = item.html_url;
      const fullName = (item.full_name || '').toLowerCase();

      // Filter 1: Ignore already known or previously processed repos
      if (knownRepos.has(htmlUrl.toLowerCase()) || knownRepos.has(fullName)) {
        continue;
      }

      // Filter 2: Pass through Strict Trust & Anti-Spam Gate
      const trustVerdict = evaluateRepositoryTrust(item, 'github');
      if (!trustVerdict.trusted) {
        // Silently skip spam / non-code / low quality
        continue;
      }

      const candidate = {
        name: item.name,
        fullName: item.full_name,
        url: item.html_url,
        type: 'github',
        domain: domainKey,
        description: item.description || 'No description provided',
        stars: item.stargazers_count || 0,
        forks: item.forks_count || 0,
        openIssues: item.open_issues_count || 0,
        language: item.language || 'Unknown',
        qualityScore: trustVerdict.score,
        verifiedOrg: trustVerdict.verifiedOrg,
        discoveredAt: new Date().toISOString()
      };

      candidates.push(candidate);
      knownRepos.add(htmlUrl.toLowerCase());
      knownRepos.add(fullName);
      console.log(`   ✨ [DISCOVERED TRUSTED REPO] ${item.full_name} (${candidate.stars} ⭐, Lang: ${candidate.language}, Score: ${candidate.qualityScore}${candidate.verifiedOrg ? ' [VERIFIED ORG]' : ''})`);
    }

    // Advance cursor page
    page++;
    if (page > 8) {
      // Advance to next query after 8 pages (approx 120 repos per query)
      queryIdx = (queryIdx + 1) % queries.length;
      page = 1;
    }
  }

  // Update cursor state
  if (cursor?.domains?.[domainKey]) {
    cursor.domains[domainKey].queryIndex = queryIdx;
    cursor.domains[domainKey].page = page;
  }

  return candidates;
}

/**
 * Scouts Hugging Face for trending, downloaded, and liked foundational models
 */
async function scoutHuggingFaceModels(knownRepos, maxCandidates = 3, cursor = null) {
  const candidates = [];
  const sorts = ['trendingScore', 'downloads', 'likes'];
  const hfCursor = cursor?.huggingFace || { sortIndex: 0, page: 1 };

  let sortIdx = hfCursor.sortIndex % sorts.length;
  const currentSort = sorts[sortIdx];

  const endpoint = `https://huggingface.co/api/models?sort=${currentSort}&direction=-1&limit=30`;
  console.log(`🔍 [SCOUTING HUGGING FACE] Sort: ${currentSort} (Batch size: 30)...`);

  const data = await compliantFetch(endpoint);
  await sleep(1500);

  if (Array.isArray(data)) {
    for (const item of data) {
      if (candidates.length >= maxCandidates) break;

      const modelId = item.id || item.modelId;
      if (!modelId) continue;

      const url = `https://huggingface.co/${modelId}`;
      const lowerUrl = url.toLowerCase();
      const lowerId = modelId.toLowerCase();

      if (knownRepos.has(lowerUrl) || knownRepos.has(lowerId)) continue;

      const trustVerdict = evaluateRepositoryTrust(item, 'huggingface');
      if (!trustVerdict.trusted) continue;

      const downloads = item.downloads || 0;
      const likes = item.likes || 0;

      const candidate = {
        name: modelId,
        fullName: modelId,
        url,
        type: 'huggingface',
        domain: 'huggingface-ai-models',
        description: `Verified Hugging Face Model: ${modelId} (${likes} likes, ${downloads} downloads)`,
        likes,
        downloads,
        qualityScore: trustVerdict.score,
        discoveredAt: new Date().toISOString()
      };

      candidates.push(candidate);
      knownRepos.add(lowerUrl);
      knownRepos.add(lowerId);
      console.log(`   ✨ [DISCOVERED AI MODEL] ${modelId} (${likes} ❤️, ${downloads} ⬇️, Score: ${candidate.qualityScore})`);
    }
  }

  // Advance Hugging Face cursor sort index
  if (cursor?.huggingFace) {
    cursor.huggingFace.sortIndex = (sortIdx + 1) % sorts.length;
  }

  return candidates;
}

/**
 * Appends newly discovered repositories to repos.txt and discovery-log.json
 */
export function appendDiscoveredToQueue(candidates) {
  if (!candidates || candidates.length === 0) return 0;

  const newLines = [];
  newLines.push(`\n# --- Automatically Discovered by AI Scout Engine [${new Date().toISOString()}] ---`);

  for (const cand of candidates) {
    const verifiedTag = cand.verifiedOrg ? ' [VERIFIED ORG]' : '';
    newLines.push(`# [${cand.domain.toUpperCase()}] ${cand.fullName} (${cand.qualityScore} score${verifiedTag}) - ${cand.description.slice(0, 80)}`);
    newLines.push(cand.url);
  }

  fs.appendFileSync(QUEUE_PATH, newLines.join('\n') + '\n', 'utf-8');
  console.log(`📝 [QUEUE UPDATED] Added ${candidates.length} top trusted repositories to repos.txt.`);

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

export function parseSourceUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const cleaned = rawUrl.trim();
  if (!cleaned || cleaned.startsWith('#')) return null;

  const ghMatch = cleaned.match(/https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i);
  if (ghMatch) {
    const owner = ghMatch[1];
    const repo = ghMatch[2].replace(/\.git$/i, '').replace(/\/+$/, '');
    return {
      type: 'github',
      owner,
      repo,
      slug: `${owner}-${repo}`.toLowerCase(),
      apiUrl: `https://api.github.com/repos/${owner}/${repo}`,
      webUrl: `https://github.com/${owner}/${repo}`
    };
  }

  const hfMatch = cleaned.match(/https?:\/\/huggingface\.co\/([^\/\s]+)\/([^\/\s#?]+)/i);
  if (hfMatch) {
    const owner = hfMatch[1];
    const model = hfMatch[2].replace(/\/+$/, '');
    return {
      type: 'huggingface',
      owner,
      repo: model,
      slug: `hf-${owner}-${model}`.toLowerCase(),
      apiUrl: `https://huggingface.co/api/models/${owner}/${model}`,
      webUrl: `https://huggingface.co/${owner}/${model}`
    };
  }

  return null;
}

export function isDeeplyHarvested(slug, brainRoot = BRAIN_ROOT) {
  if (!slug) return false;
  const learningFile = path.join(brainRoot, '07_PROJECT_LEARNING', `${slug}-learnings.md`);
  if (!fs.existsSync(learningFile)) return false;
  try {
    const stats = fs.statSync(learningFile);
    if (stats.size < 25000) return false; // Surface/shallow extraction requiring deep re-harvest
    const content = fs.readFileSync(learningFile, 'utf-8');
    return content.includes('```diff') || content.includes('### Core Architecture Module:');
  } catch (e) {
    return false;
  }
}

/**
 * Counts repositories in repos.txt that need harvesting
 * (Both completely unharvested repos and surface-only extractions < 25KB needing deep restart)
 */
export function getUnharvestedQueueCount() {
  if (!fs.existsSync(QUEUE_PATH)) return 0;
  const rawText = fs.readFileSync(QUEUE_PATH, 'utf-8');
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

  let unharvested = 0;

  for (const url of lines) {
    const parsed = parseSourceUrl(url);
    if (!parsed) continue;

    if (!isDeeplyHarvested(parsed.slug, BRAIN_ROOT)) {
      unharvested++;
    }
  }

  return unharvested;
}

/**
 * Autonomous Self-Replenishing Queue Guard:
 * Ensures queue ALWAYS has fresh unharvested top repositories.
 * If unharvested count falls below buffer, immediately discovers next batch!
 */
export async function ensureQueueReplenished(minBuffer = 15, targetBatch = 24) {
  const currentUnharvested = getUnharvestedQueueCount();
  console.log(`📊 [QUEUE BUFFER INSPECTION] Current Unharvested Targets: ${currentUnharvested} (Minimum Buffer: ${minBuffer})`);

  if (currentUnharvested >= minBuffer) {
    console.log(`✅ [QUEUE HEALTHY] Sufficient unharvested targets ready for fleet processing.`);
    return { replenished: false, currentUnharvested };
  }

  console.log(`⚡ [AUTO-REPLENISH ACTIVATING] Unharvested targets below buffer (${currentUnharvested} < ${minBuffer}). Scouting fresh batch of ${targetBatch} repositories...`);

  const perDomain = Math.max(2, Math.ceil(targetBatch / Object.keys(DISCOVERY_DOMAINS).length));
  const scoutResult = await runAutoDiscoveryScout({ maxPerDomain: perDomain });

  const updatedCount = getUnharvestedQueueCount();
  console.log(`🎉 [QUEUE REPLENISHED] Queue buffer now at ${updatedCount} unharvested high-value targets.`);

  return {
    replenished: true,
    added: scoutResult.discovered,
    totalUnharvested: updatedCount
  };
}

/**
 * Main Autonomous Discovery Orchestrator
 */
export async function runAutoDiscoveryScout(options = {}) {
  console.log(`\n======================================================================`);
  console.log(`🔭 AI-BUILDER-BRAIN AUTONOMOUS DISCOVERY SCOUT ENGINE v2.0`);
  console.log(`   Mode: Multi-Agent Parallel Domain Scout with Persistent Cursor`);
  console.log(`   Filter: STRICT Anti-Spam & Verified Trust Gate`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`======================================================================`);

  if (!isAutoDiscoveryEnabled()) {
    console.log(`⏸️ [SCOUT PAUSED] Auto-discovery is currently disabled in harvest-control.json.`);
    return { discovered: 0, items: [] };
  }

  const knownRepos = getKnownRepositories();
  const cursor = getDiscoveryCursor();
  const agentId = options.agentId || `agent-${process.env.AGENT_NAME || process.pid}`;
  const targetDomain = options.domain || null;
  const maxPerDomain = options.maxPerDomain || 3;

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
        candidates = await scoutGitHubDomain(domainKey, domainConfig, knownRepos, maxPerDomain, cursor);
      } else if (domainConfig.type === 'huggingface') {
        candidates = await scoutHuggingFaceModels(knownRepos, maxPerDomain, cursor);
      }

      allDiscovered.push(...candidates);
    } catch (err) {
      console.error(`   ❌ [SCOUT ERROR] ${domainKey}: ${err.message}`);
    } finally {
      releaseDomainLock(domainKey);
    }
  }

  cursor.totalAutoDiscovered = (cursor.totalAutoDiscovered || 0) + allDiscovered.length;
  cursor.lastReplenishedAt = new Date().toISOString();
  saveDiscoveryCursor(cursor);

  if (allDiscovered.length > 0) {
    appendDiscoveredToQueue(allDiscovered);
    console.log(`\n🎉 [SCOUT COMPLETE] Successfully discovered & queued ${allDiscovered.length} top trusted repositories!`);
  } else {
    console.log(`\n✨ [SCOUT STATUS] All top candidates in current page window are already known. Cursor advanced for next cycle.`);
  }

  return { discovered: allDiscovered.length, items: allDiscovered };
}

// CLI Execution Entry Point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2);
  if (args.includes('--replenish')) {
    ensureQueueReplenished(15, 24).catch((err) => {
      console.error('Fatal Queue Replenish error:', err);
      process.exit(1);
    });
  } else {
    const domainArg = args.find((a) => !a.startsWith('--')) || null;
    runAutoDiscoveryScout({ domain: domainArg }).catch((err) => {
      console.error('Fatal Auto-Discovery Scout error:', err);
      process.exit(1);
    });
  }
}
