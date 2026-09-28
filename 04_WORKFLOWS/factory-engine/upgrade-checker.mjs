import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'sources-registry.json');

/**
 * Loads sources-registry.json safely
 */
export function getSourcesRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch (e) {
    return {};
  }
}

/**
 * Saves sources-registry.json safely
 */
export function saveSourcesRegistry(registry) {
  try {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`[WARN] Failed to write sources-registry.json: ${e.message}`);
  }
}

/**
 * Fast network probe: queries remote Git HEAD commit sha without cloning (0.3s runtime)
 */
export function fetchRemoteGitHead(cleanUrl) {
  try {
    const raw = execSync(`git ls-remote "${cleanUrl}" HEAD`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    }).trim();

    if (!raw) return null;
    const match = raw.match(/^([a-f0-9]+)\s+HEAD/i);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
}

/**
 * Queries Hugging Face API for latest model sha or lastModified
 */
export async function fetchHuggingFaceHead(apiUrl) {
  try {
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'AI-Builder-Brain-UpgradeChecker/1.0', Accept: 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha || data.lastModified || null;
  } catch (e) {
    return null;
  }
}

/**
 * Queries local project's current git commit hash
 */
export function fetchLocalProjectHead(projectPath) {
  try {
    if (!fs.existsSync(projectPath)) return null;
    return execSync('git rev-parse HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    }).trim();
  } catch (e) {
    return null;
  }
}

/**
 * Checks whether an external repository or local project needs harvesting
 * Returns: { shouldHarvest: boolean, reason: string, currentRevision, recordedRevision }
 */
export async function shouldHarvestSource(targetMeta, options = { force: false }) {
  if (options.force) {
    return { shouldHarvest: true, reason: 'FORCE_REQUESTED' };
  }

  const registry = getSourcesRegistry();
  const key = (targetMeta.repo || targetMeta.slug || targetMeta.name || '').toLowerCase();
  const entry = registry[key] || registry[targetMeta.slug] || null;

  // Check if an existing learning document exists in 07_PROJECT_LEARNING/
  const learningFile = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', `${targetMeta.slug || key}-learnings.md`);
  const hasLearningDoc = fs.existsSync(learningFile);

  const recordedRevision = entry?.revisionIdentifier || entry?.lastCommitSha || null;

  // If never harvested before, harvest is required
  if (!recordedRevision && !hasLearningDoc) {
    return {
      shouldHarvest: true,
      reason: 'NEW_UNHARVESTED_REPOSITORY',
      currentRevision: null,
      recordedRevision: null
    };
  }

  // 1. Probe current remote/local revision
  let currentRevision = null;
  if (targetMeta.type === 'huggingface' || targetMeta.apiUrl?.includes('huggingface.co')) {
    currentRevision = await fetchHuggingFaceHead(targetMeta.apiUrl);
  } else if (targetMeta.cleanUrl) {
    currentRevision = fetchRemoteGitHead(targetMeta.cleanUrl);
  } else if (targetMeta.isLocal && targetMeta.path) {
    currentRevision = fetchLocalProjectHead(targetMeta.path);
  }

  // If we could not fetch current revision (offline or API down), fall back to safe check
  if (!currentRevision) {
    if (hasLearningDoc) {
      return {
        shouldHarvest: false,
        reason: 'ALREADY_HARVESTED_AND_OFFLINE_PROBE_UNREACHABLE',
        currentRevision: null,
        recordedRevision
      };
    }
    return { shouldHarvest: true, reason: 'PROBE_UNREACHABLE_FIRST_RUN' };
  }

  // 2. Check if revision matches (either exact or prefix match e.g. 7-char sha vs full sha)
  if (recordedRevision) {
    const isMatch = currentRevision.startsWith(recordedRevision) || recordedRevision.startsWith(currentRevision);
    if (isMatch) {
      return {
        shouldHarvest: false,
        reason: 'UP_TO_DATE_NO_NEW_COMMITS',
        currentRevision,
        recordedRevision
      };
    } else {
      return {
        shouldHarvest: true,
        reason: 'UPSTREAM_UPGRADE_DETECTED',
        currentRevision,
        recordedRevision
      };
    }
  }

  // Has learning file but no recorded revision in registry: record and skip to save tokens
  return {
    shouldHarvest: false,
    reason: 'ALREADY_HARVESTED_DOCUMENT_EXISTS',
    currentRevision,
    recordedRevision: currentRevision
  };
}

/**
 * Updates the recorded revision in sources-registry.json
 */
export function recordSourceHarvest(key, revision, meta = {}) {
  const registry = getSourcesRegistry();
  const lowerKey = key.toLowerCase();

  registry[lowerKey] = {
    ...(registry[lowerKey] || {}),
    ...meta,
    revisionIdentifier: revision || registry[lowerKey]?.revisionIdentifier || 'unknown',
    lastChecked: new Date().toISOString(),
    lastVerified: new Date().toISOString()
  };

  saveSourcesRegistry(registry);
}
