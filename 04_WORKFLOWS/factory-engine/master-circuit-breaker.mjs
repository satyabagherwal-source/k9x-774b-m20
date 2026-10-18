import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGitHubToken } from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export function getLocksDir() {
  return process.env.CIRCUIT_LOCKS_DIR || process.env.HARVEST_LOCKS_DIR || path.join(BRAIN_ROOT, '.harvest-locks');
}

export function getCircuitFile() {
  return process.env.CIRCUIT_FILE || path.join(getLocksDir(), 'master-circuit-breaker.json');
}

export function getRateLimitLock() {
  return process.env.CIRCUIT_RATE_LIMIT_LOCK || path.join(getLocksDir(), 'shared-rate-limiter.json');
}

export function getControlPath() {
  return process.env.CIRCUIT_CONTROL_PATH || process.env.HARVEST_CONTROL_PATH || path.join(BRAIN_ROOT, 'harvest-control.json');
}

// Supported Master Infrastructure Services (Core REST and Search decoupled!)
export const MASTER_SERVICES = {
  GITHUB_REST_API: 'GITHUB_REST_API',       // GitHub Core REST API (5,000 req/hr authenticated)
  GITHUB_SEARCH_API: 'GITHUB_SEARCH_API',   // GitHub Search API (30 req/min authenticated)
  GITHUB_API: 'GITHUB_REST_API',           // Backward compatibility alias
  GITHUB_ACTIONS: 'GITHUB_ACTIONS',         // GitHub Actions runner minutes (2,000 mins/mo on private repo)
  HUGGINGFACE_API: 'HUGGINGFACE_API',       // Hugging Face REST endpoints
  AI_PROVIDERS: 'AI_PROVIDERS'              // AI Key Pool (Gemini, Groq, Claude, OpenAI, Ollama)
};

/**
 * Normalizes service name for backward compatibility
 */
export function normalizeServiceName(serviceName) {
  if (serviceName === 'GITHUB_API') return MASTER_SERVICES.GITHUB_REST_API;
  return serviceName || MASTER_SERVICES.GITHUB_REST_API;
}

/**
 * Ensures lock directory exists
 */
function ensureLocksDir() {
  const locksDir = getLocksDir();
  if (!fs.existsSync(locksDir)) {
    fs.mkdirSync(locksDir, { recursive: true });
  }
}

/**
 * Loads Master Circuit Breaker Registry
 */
export function loadMasterCircuits() {
  ensureLocksDir();
  let registry = {};
  const circuitFile = getCircuitFile();
  if (fs.existsSync(circuitFile)) {
    try {
      registry = JSON.parse(fs.readFileSync(circuitFile, 'utf-8'));
    } catch (e) {}
  }

  // Handle migration from legacy GITHUB_API to decoupled GITHUB_REST_API
  if (registry.GITHUB_API && !registry.GITHUB_REST_API) {
    registry.GITHUB_REST_API = {
      ...registry.GITHUB_API,
      service: MASTER_SERVICES.GITHUB_REST_API
    };
  }

  const defaultRegistry = {
    GITHUB_REST_API: {
      service: 'GITHUB_REST_API',
      status: 'HEALTHY',
      remaining: 5000,
      resetEpoch: 0,
      resetAt: null,
      trippedAt: null,
      reason: null,
      consecutiveBlocks: 0
    },
    GITHUB_SEARCH_API: {
      service: 'GITHUB_SEARCH_API',
      status: 'HEALTHY',
      remaining: 30,
      resetEpoch: 0,
      resetAt: null,
      trippedAt: null,
      reason: null,
      consecutiveBlocks: 0
    },
    GITHUB_ACTIONS: {
      service: 'GITHUB_ACTIONS',
      status: 'HEALTHY',
      resetEpoch: 0,
      resetAt: null,
      trippedAt: null,
      reason: null
    },
    HUGGINGFACE_API: {
      service: 'HUGGINGFACE_API',
      status: 'HEALTHY',
      resetEpoch: 0,
      resetAt: null,
      trippedAt: null,
      reason: null
    }
  };

  return {
    ...defaultRegistry,
    ...registry
  };
}

/**
 * Saves Master Circuit Breaker Registry and syncs with harvest-control.json
 */
export function saveMasterCircuits(registry) {
  ensureLocksDir();
  const circuitFile = getCircuitFile();
  try {
    fs.writeFileSync(circuitFile, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[CIRCUIT ERROR] Failed to save circuit file:`, e.message);
  }

  // Sync to harvest-control.json
  const controlPath = getControlPath();
  if (fs.existsSync(controlPath)) {
    try {
      const control = JSON.parse(fs.readFileSync(controlPath, 'utf-8'));
      control.masterCircuitBreakers = registry;
      control.lastUpdated = new Date().toISOString();
      fs.writeFileSync(controlPath, JSON.stringify(control, null, 2), 'utf-8');
    } catch (e) {}
  }
}

/**
 * Inspects whether a specific service is available to make requests.
 * Automatic Recovery: If cooldown has passed, restores status to HEALTHY!
 * 
 * @param {string} rawServiceName - One of MASTER_SERVICES
 * @returns {{ available: boolean, status: string, waitSec: number, resetAt: string, reason: string }}
 */
export function checkServiceAvailability(rawServiceName) {
  const serviceName = normalizeServiceName(rawServiceName);
  const registry = loadMasterCircuits();
  const circuit = registry[serviceName] || {
    service: serviceName,
    status: 'HEALTHY',
    resetEpoch: 0,
    resetAt: null,
    reason: null
  };

  const now = Date.now();

  // Check if currently cooling down or exhausted
  if (circuit.status !== 'HEALTHY' && circuit.resetEpoch) {
    if (now >= circuit.resetEpoch) {
      // Cooldown expired! Auto-reset to HEALTHY
      console.log(`\x1b[32m🟢 [MASTER CIRCUIT AUTO-RESET] ${serviceName} cooldown expired. Service restored to HEALTHY!\x1b[0m`);
      circuit.status = 'HEALTHY';
      circuit.resetEpoch = 0;
      circuit.resetAt = null;
      circuit.reason = null;
      circuit.isSecondaryRateLimit = false;
      registry[serviceName] = circuit;
      saveMasterCircuits(registry);
      return { available: true, status: 'HEALTHY', waitSec: 0, resetAt: null, reason: null };
    }

    const waitSec = Math.max(1, Math.round((circuit.resetEpoch - now) / 1000));
    return {
      available: false,
      status: circuit.status,
      waitSec,
      resetAt: circuit.resetAt,
      reason: circuit.reason
    };
  }

  return { available: true, status: 'HEALTHY', waitSec: 0, resetAt: null, reason: null };
}

/**
 * Trips a master circuit breaker, putting the service on hard lockdown until resetEpoch.
 * ZERO network requests will be permitted to this service until reset time.
 * 
 * @param {string} rawServiceName
 * @param {number|Date} resetEpochOrDate - Unix epoch in ms, or Date object, or unix epoch in seconds
 * @param {string} reason
 * @param {object} extraMeta
 */
export function tripMasterCircuit(rawServiceName, resetEpochOrDate, reason, extraMeta = {}) {
  const serviceName = normalizeServiceName(rawServiceName);
  const registry = loadMasterCircuits();
  const circuit = registry[serviceName] || { service: serviceName };

  let epochMs = 0;
  if (resetEpochOrDate instanceof Date) {
    epochMs = resetEpochOrDate.getTime();
  } else if (typeof resetEpochOrDate === 'number') {
    epochMs = resetEpochOrDate < 10000000000 ? resetEpochOrDate * 1000 : resetEpochOrDate;
  } else if (typeof resetEpochOrDate === 'string') {
    epochMs = new Date(resetEpochOrDate).getTime();
  }

  // Safety buffer: add 15 seconds to ensure remote server has fully rolled over its quota
  epochMs += 15000;

  const resetIso = new Date(epochMs).toISOString();
  const waitSec = Math.max(1, Math.round((epochMs - Date.now()) / 1000));
  const waitMin = Math.round(waitSec / 60);

  circuit.status = 'EXHAUSTED';
  circuit.resetEpoch = epochMs;
  circuit.resetAt = resetIso;
  circuit.trippedAt = new Date().toISOString();
  circuit.reason = reason || 'Quota or Rate Limit Exhausted';
  circuit.consecutiveBlocks = (circuit.consecutiveBlocks || 0) + 1;
  circuit.isSecondaryRateLimit = false;
  Object.assign(circuit, extraMeta);

  registry[serviceName] = circuit;
  saveMasterCircuits(registry);

  console.warn(`\n\x1b[41m\x1b[37m 🚨 [MASTER SWITCH TRIPPED] ${serviceName} QUOTA EXHAUSTED! \x1b[0m`);
  console.warn(`\x1b[31m   Status     : EXHAUSTED / FROZEN`);
  console.warn(`   Reason     : ${circuit.reason}`);
  console.warn(`   Reset Time : ${resetIso} (in ${waitMin} minutes / ${waitSec}s)`);
  console.warn(`   Directive  : ALL requests to ${serviceName} are BLOCKED until reset. Zero network calls permitted.\x1b[0m\n`);

  return circuit;
}

/**
 * Puts a service into short temporary cooldown for secondary rate limit / abuse detection
 * Does NOT freeze the primary 1-hour quota bucket.
 */
export function recordRateLimitSecondaryBackoff(rawServiceName, waitSec = 60, reason = 'Secondary Rate Limit Detected') {
  const serviceName = normalizeServiceName(rawServiceName);
  const registry = loadMasterCircuits();
  const circuit = registry[serviceName] || { service: serviceName };
  const waitMs = (parseInt(waitSec, 10) || 60) * 1000 + 1000;
  const epochMs = Date.now() + waitMs;
  const resetIso = new Date(epochMs).toISOString();

  circuit.status = 'COOLING_DOWN';
  circuit.resetEpoch = epochMs;
  circuit.resetAt = resetIso;
  circuit.trippedAt = new Date().toISOString();
  circuit.reason = reason;
  circuit.isSecondaryRateLimit = true;

  registry[serviceName] = circuit;
  saveMasterCircuits(registry);

  console.warn(`\x1b[33m⚠️ [SECONDARY RATE-LIMIT BACKOFF] ${serviceName} paused for ${Math.round(waitMs / 1000)}s until ${resetIso}. Reason: ${reason}\x1b[0m`);
  return circuit;
}

/**
 * Shared Atomic Rate Limiter and Inter-Request Pacing Queue
 * Enforces inter-request spacing and RPM limit across all child processes and parallel fleet agents.
 *
 * @param {string} rawServiceName - e.g. GITHUB_REST_API or GITHUB_SEARCH_API
 * @param {object} options - { minIntervalMs, maxRpm }
 */
export async function acquireSharedRateLimitToken(rawServiceName, options = {}) {
  const serviceName = normalizeServiceName(rawServiceName);
  const isSearch = serviceName === MASTER_SERVICES.GITHUB_SEARCH_API;
  const minIntervalMs = options.minIntervalMs ?? (isSearch ? 2000 : 250);
  const maxRpm = options.maxRpm ?? (isSearch ? 25 : 80);

  ensureLocksDir();
  const rateLimitLock = getRateLimitLock();
  const now = Date.now();
  // Resilient multi-process read with spin-retry
  let limiterState = { services: {} };
  for (let rAttempt = 0; rAttempt < 5; rAttempt++) {
    if (fs.existsSync(rateLimitLock)) {
      try {
        limiterState = JSON.parse(fs.readFileSync(rateLimitLock, 'utf-8'));
        break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 10 + Math.floor(Math.random() * 15)));
      }
    } else {
      break;
    }
  }

  if (!limiterState.services) limiterState.services = {};
  if (!limiterState.services[serviceName]) {
    limiterState.services[serviceName] = {
      lastRequestAt: 0,
      recentRequests: []
    };
  }

  const sState = limiterState.services[serviceName];
  // Filter out timestamps older than 60 seconds
  sState.recentRequests = (sState.recentRequests || []).filter(t => (now - t) < 60000);

  // 1. Sliding window RPM check
  if (sState.recentRequests.length >= maxRpm) {
    const oldest = sState.recentRequests[0];
    const waitTime = Math.max(100, 60000 - (now - oldest) + 50);
    console.warn(`[RATE LIMITER PACING] ${serviceName} reached sliding RPM limit (${sState.recentRequests.length}/${maxRpm}). Pausing ${waitTime}ms...`);
    await new Promise(r => setTimeout(r, waitTime));
    return acquireSharedRateLimitToken(serviceName, options);
  }

  // 2. Inter-request interval check
  const elapsedSinceLast = now - (sState.lastRequestAt || 0);
  if (elapsedSinceLast < minIntervalMs) {
    const waitInterval = minIntervalMs - elapsedSinceLast;
    await new Promise(r => setTimeout(r, waitInterval));
  }

  const actualNow = Date.now();
  sState.lastRequestAt = actualNow;
  sState.recentRequests.push(actualNow);

  // Resilient multi-process atomic write
  const tempPath = `${rateLimitLock}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  for (let wAttempt = 0; wAttempt < 5; wAttempt++) {
    try {
      fs.writeFileSync(tempPath, JSON.stringify(limiterState, null, 2), 'utf-8');
      fs.renameSync(tempPath, rateLimitLock);
      break;
    } catch (e) {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
      await new Promise(r => setTimeout(r, 15 + Math.floor(Math.random() * 20)));
    }
  }

  return true;
}

/**
 * Automatically inspects HTTP response headers and status codes.
 * Distinguishes Primary Quota Exhaustion from Secondary Rate Limits and 403 Forbidden.
 * Routes to GITHUB_SEARCH_API vs GITHUB_REST_API automatically.
 * 
 * @param {string} rawServiceName
 * @param {Headers|object} headers
 * @param {number} statusCode
 * @param {string} url
 */
export function inspectAndRecordHeaders(rawServiceName, headers, statusCode = 200, url = '') {
  if (!headers) return true;

  const getHeader = (name) => {
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  const resource = getHeader('x-ratelimit-resource');
  let targetService = normalizeServiceName(rawServiceName);

  // Auto-route to GITHUB_SEARCH_API if resource is search or url path is /search/
  if (url.includes('/search/') || resource === 'search') {
    targetService = MASTER_SERVICES.GITHUB_SEARCH_API;
  } else if (targetService === MASTER_SERVICES.GITHUB_REST_API || targetService === 'GITHUB_API') {
    targetService = MASTER_SERVICES.GITHUB_REST_API;
  }

  const remaining = getHeader('x-ratelimit-remaining');
  const resetHeader = getHeader('x-ratelimit-reset');
  const retryAfter = getHeader('retry-after');

  const registry = loadMasterCircuits();
  const circuit = registry[targetService] || { service: targetService };

  if (remaining !== null && remaining !== undefined) {
    circuit.remaining = parseInt(remaining, 10);
  }

  // 1. Primary Rate Limit Exceeded
  const isPrimaryLimit =
    (statusCode === 403 && remaining === '0') ||
    (remaining !== null && parseInt(remaining, 10) === 0);

  if (isPrimaryLimit) {
    let resetEpoch = null;
    if (resetHeader) {
      const rawReset = parseInt(resetHeader, 10);
      if (!isNaN(rawReset)) {
        resetEpoch = rawReset < 10000000000 ? rawReset * 1000 : rawReset;
      }
    } else if (retryAfter) {
      const waitSeconds = parseInt(retryAfter, 10) || 60;
      resetEpoch = Date.now() + waitSeconds * 1000;
    }

    if (!resetEpoch || resetEpoch <= Date.now()) {
      resetEpoch = Date.now() + (targetService === MASTER_SERVICES.GITHUB_SEARCH_API ? 60 * 1000 : 60 * 60 * 1000);
    }

    tripMasterCircuit(
      targetService,
      resetEpoch,
      `Primary rate limit exhausted (HTTP ${statusCode} | Remaining: 0 | Resource: ${resource || 'core'} | URL: ${url})`,
      { remaining: 0, resource: resource || 'core' }
    );
    return false;
  }

  // 2. Secondary Rate Limit / Abuse Mechanism or HTTP 429
  const isSecondaryLimit =
    statusCode === 429 ||
    (statusCode === 403 && (retryAfter || (remaining !== null && parseInt(remaining, 10) > 0)));

  if (isSecondaryLimit) {
    const waitSeconds = retryAfter ? (parseInt(retryAfter, 10) || 60) : 60;
    recordRateLimitSecondaryBackoff(
      targetService,
      waitSeconds,
      `Secondary rate limit or HTTP ${statusCode} backoff (Remaining: ${remaining || 'N/A'} | Resource: ${resource || 'unknown'} | URL: ${url})`
    );
    return false;
  }

  // 3. Near-limit warnings
  const limitThreshold = targetService === MASTER_SERVICES.GITHUB_SEARCH_API ? 3 : 20;
  if (remaining !== null && parseInt(remaining, 10) < limitThreshold && parseInt(remaining, 10) > 0) {
    console.warn(`\x1b[33m⚠️ [MASTER CIRCUIT WARNING] ${targetService} remaining requests low: ${remaining} (Threshold: ${limitThreshold})\x1b[0m`);
  }

  saveMasterCircuits(registry);
  return true;
}

/**
 * Returns remaining milliseconds until reset for a service (0 if available)
 */
export function getServiceResetWaitMs(rawServiceName) {
  const serviceName = normalizeServiceName(rawServiceName);
  const availability = checkServiceAvailability(serviceName);
  if (availability.available) return 0;
  return availability.waitSec * 1000;
}

/**
 * Human-readable status report of all master circuits
 */
export function getMasterCircuitsReport() {
  const registry = loadMasterCircuits();
  return Object.values(registry).map((c) => {
    const avail = checkServiceAvailability(c.service);
    return {
      service: c.service,
      status: avail.status,
      available: avail.available,
      remaining: c.remaining ?? 'N/A',
      waitSec: avail.waitSec,
      resetAt: avail.resetAt,
      reason: avail.reason
    };
  });
}

/**
 * Diagnostic helper to independently verify Local vs GitHub Actions Cloud authentication
 */
export function getGitHubAuthDiagnostics() {
  const token = getGitHubToken() || process.env.GITHUB_TOKEN || null;
  const isLocalGhCli = !process.env.GITHUB_TOKEN && !!token;
  const isCloudActions = !!process.env.GITHUB_ACTIONS || !!process.env.CI;

  return {
    authenticated: !!token,
    source: token ? (isLocalGhCli ? 'LOCAL_GH_CLI' : (isCloudActions ? 'GITHUB_ACTIONS_RUNNER' : 'ENV_GITHUB_TOKEN')) : 'UNAUTHENTICATED',
    masked: token ? '***REDACTED_SECRET***' : 'NONE',
    estimatedQuotaPerHour: token ? 5000 : 60,
    searchQuotaPerMinute: token ? 30 : 10
  };
}
