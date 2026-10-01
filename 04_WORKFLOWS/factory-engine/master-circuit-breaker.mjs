import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const LOCKS_DIR = path.join(BRAIN_ROOT, '.harvest-locks');
const CIRCUIT_FILE = path.join(LOCKS_DIR, 'master-circuit-breaker.json');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');

// Supported Master Infrastructure Services
export const MASTER_SERVICES = {
  GITHUB_API: 'GITHUB_API',             // GitHub REST API (rate limit / quota)
  GITHUB_ACTIONS: 'GITHUB_ACTIONS',     // GitHub Actions runner minutes (2,000 mins/mo on private repo)
  HUGGINGFACE_API: 'HUGGINGFACE_API',   // Hugging Face REST endpoints
  AI_PROVIDERS: 'AI_PROVIDERS'          // AI Key Pool (Gemini, Groq, Claude, OpenAI, Ollama)
};

/**
 * Ensures lock directory exists
 */
function ensureLocksDir() {
  if (!fs.existsSync(LOCKS_DIR)) {
    fs.mkdirSync(LOCKS_DIR, { recursive: true });
  }
}

/**
 * Loads Master Circuit Breaker Registry
 */
export function loadMasterCircuits() {
  ensureLocksDir();
  if (fs.existsSync(CIRCUIT_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CIRCUIT_FILE, 'utf-8'));
    } catch (e) {}
  }
  return {
    GITHUB_API: {
      service: 'GITHUB_API',
      status: 'HEALTHY',
      remaining: 5000,
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
}

/**
 * Saves Master Circuit Breaker Registry and syncs with harvest-control.json
 */
export function saveMasterCircuits(registry) {
  ensureLocksDir();
  try {
    fs.writeFileSync(CIRCUIT_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[CIRCUIT ERROR] Failed to save circuit file:`, e.message);
  }

  // Sync to harvest-control.json
  if (fs.existsSync(CONTROL_PATH)) {
    try {
      const control = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
      control.masterCircuitBreakers = registry;
      control.lastUpdated = new Date().toISOString();
      fs.writeFileSync(CONTROL_PATH, JSON.stringify(control, null, 2), 'utf-8');
    } catch (e) {}
  }
}

/**
 * Inspects whether a specific service is available to make requests.
 * Automatic Recovery: If cooldown has passed, restores status to HEALTHY!
 * 
 * @param {string} serviceName - One of MASTER_SERVICES
 * @returns {{ available: boolean, status: string, waitSec: number, resetAt: string, reason: string }}
 */
export function checkServiceAvailability(serviceName) {
  const registry = loadMasterCircuits();
  const circuit = registry[serviceName] || {
    service: serviceName,
    status: 'HEALTHY',
    resetEpoch: 0,
    resetAt: null,
    reason: null
  };

  const now = Date.now();

  // Check if currently cooling down
  if (circuit.status !== 'HEALTHY' && circuit.resetEpoch) {
    if (now >= circuit.resetEpoch) {
      // Cooldown expired! Auto-reset to HEALTHY
      console.log(`\x1b[32m🟢 [MASTER CIRCUIT AUTO-RESET] ${serviceName} cooldown expired. Service restored to HEALTHY!\x1b[0m`);
      circuit.status = 'HEALTHY';
      circuit.resetEpoch = 0;
      circuit.resetAt = null;
      circuit.reason = null;
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
 * @param {string} serviceName
 * @param {number|Date} resetEpochOrDate - Unix epoch in ms, or Date object, or unix epoch in seconds
 * @param {string} reason
 * @param {object} extraMeta
 */
export function tripMasterCircuit(serviceName, resetEpochOrDate, reason, extraMeta = {}) {
  const registry = loadMasterCircuits();
  const circuit = registry[serviceName] || { service: serviceName };

  let epochMs = 0;
  if (resetEpochOrDate instanceof Date) {
    epochMs = resetEpochOrDate.getTime();
  } else if (typeof resetEpochOrDate === 'number') {
    // If passed in seconds (e.g. GitHub epoch 1711234567), convert to ms
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
 * Automatically inspects HTTP response headers and status codes.
 * If 403, 429, or x-ratelimit-remaining == 0 is detected, trips the circuit immediately.
 * 
 * @param {string} serviceName
 * @param {Headers|object} headers
 * @param {number} statusCode
 * @param {string} url
 */
export function inspectAndRecordHeaders(serviceName, headers, statusCode = 200, url = '') {
  if (!headers) return;

  const getHeader = (name) => {
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  const remaining = getHeader('x-ratelimit-remaining');
  const resetHeader = getHeader('x-ratelimit-reset');
  const retryAfter = getHeader('retry-after');

  const registry = loadMasterCircuits();
  const circuit = registry[serviceName] || { service: serviceName };

  if (remaining !== null && remaining !== undefined) {
    circuit.remaining = parseInt(remaining, 10);
  }

  // 1. Check for Rate Limit Exceeded or Quota Exhaustion
  const isRateLimited =
    statusCode === 429 ||
    (statusCode === 403 && remaining === '0') ||
    (remaining !== null && parseInt(remaining, 10) === 0);

  if (isRateLimited) {
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

    // Fallback: GitHub resets every hour, default 60 minutes
    if (!resetEpoch || resetEpoch <= Date.now()) {
      resetEpoch = Date.now() + 60 * 60 * 1000;
    }

    tripMasterCircuit(
      serviceName,
      resetEpoch,
      `Rate limit exceeded (HTTP ${statusCode} | Remaining: ${remaining || 0} | URL: ${url})`,
      { remaining: 0 }
    );
    return false;
  }

  // 2. Near-limit warning (< 5 remaining)
  if (remaining !== null && parseInt(remaining, 10) < 5 && parseInt(remaining, 10) > 0) {
    console.warn(`\x1b[33m⚠️ [MASTER CIRCUIT WARNING] ${serviceName} remaining requests low: ${remaining}\x1b[0m`);
  }

  saveMasterCircuits(registry);
  return true;
}

/**
 * Returns remaining milliseconds until reset for a service (0 if available)
 */
export function getServiceResetWaitMs(serviceName) {
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
