import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { DISCOVERY_DOMAINS, ensureQueueReplenished } from './auto-discovery-scout.mjs';
import { pushWithRebaseRetry } from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');

const ZERO_CLONE_SCRIPT = path.join(__dirname, 'zero-clone-harvester.mjs');
const SCOUT_SCRIPT = path.join(__dirname, 'auto-discovery-scout.mjs');

export const FLEET_ROSTER = [
  { id: 'Agent-Alpha', name: 'Alpha', domain: 'ai-agents', color: '\x1b[36m' }, // Cyan
  { id: 'Agent-Beta', name: 'Beta', domain: 'fullstack-ui', color: '\x1b[32m' }, // Green
  { id: 'Agent-Gamma', name: 'Gamma', domain: 'high-perf-systems', color: '\x1b[33m' }, // Yellow
  { id: 'Agent-Delta', name: 'Delta', domain: 'huggingface-ai-models', color: '\x1b[35m' }, // Magenta
  { id: 'Agent-Epsilon', name: 'Epsilon', domain: 'mobile-cross-platform', color: '\x1b[34m' }, // Blue
  { id: 'Agent-Zeta', name: 'Zeta', domain: 'devops-cloud-infrastructure', color: '\x1b[96m' }, // Bright Cyan
  { id: 'Agent-Eta', name: 'Eta', domain: 'cybersecurity-defenses', color: '\x1b[91m' }, // Bright Red
  { id: 'Agent-Theta', name: 'Theta', domain: 'database-storage-engines', color: '\x1b[92m' } // Bright Green
];

const RESET = '\x1b[0m';

/**
 * Returns workers array from harvest-control.json
 */
export function getFleetWorkers() {
  if (!fs.existsSync(CONTROL_PATH)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    return data.multiAgentFleet?.workers || [];
  } catch (e) {
    return [];
  }
}

/**
 * Inspects and maintains the isolated lifecycle of an individual worker.
 * If a worker's cooldown duration has passed, automatically resets it to ACTIVE!
 */
export function getWorkerLifecycle(workerId) {
  const workers = getFleetWorkers();
  const worker = workers.find((w) => w.id === workerId || w.domain === workerId);
  if (!worker) {
    return { id: workerId, status: 'ACTIVE', cooldownUntil: null };
  }

  // Auto-Recovery Check:
  // If worker is in COOLING_DOWN and its individual cooldown timestamp has passed, auto-reset to ACTIVE
  if (worker.status === 'COOLING_DOWN' && worker.cooldownUntil) {
    const expiresAt = new Date(worker.cooldownUntil).getTime();
    if (Date.now() >= expiresAt) {
      console.log(`\x1b[32m🟢 [AUTO-RESET] ${worker.id} (${worker.domain}) cooldown expired. Automatically restored to ACTIVE!\x1b[0m`);
      updateWorkerState(worker.id, {
        status: 'ACTIVE',
        cooldownUntil: null,
        lastError: null
      });
      worker.status = 'ACTIVE';
      worker.cooldownUntil = null;
      worker.lastError = null;
    }
  }

  return worker;
}

/**
 * Atomic update of worker state in harvest-control.json
 */
export function updateWorkerState(workerId, updates = {}) {
  if (!fs.existsSync(CONTROL_PATH)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    if (!data.multiAgentFleet) data.multiAgentFleet = {};
    if (!data.multiAgentFleet.workers) data.multiAgentFleet.workers = [];

    const idx = data.multiAgentFleet.workers.findIndex((w) => w.id === workerId || w.domain === workerId);
    if (idx !== -1) {
      data.multiAgentFleet.workers[idx] = {
        ...data.multiAgentFleet.workers[idx],
        ...updates
      };
    } else {
      data.multiAgentFleet.workers.push({
        id: workerId,
        domain: updates.domain || 'unknown',
        status: 'ACTIVE',
        cooldownUntil: null,
        totalHarvested: 0,
        ...updates
      });
    }

    fs.writeFileSync(CONTROL_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error(`[WORKER STATE ERROR] Failed to save worker state for ${workerId}:`, e.message);
    return false;
  }
}

/**
 * Updates status of a single worker without affecting any other workers
 */
export function setWorkerStatus(workerIdOrDomain, newStatus, durationMs = 0, reason = '') {
  const updates = {
    status: newStatus.toUpperCase()
  };
  if (newStatus.toUpperCase() === 'COOLING_DOWN') {
    updates.cooldownUntil = new Date(Date.now() + durationMs).toISOString();
    updates.lastError = reason || 'Rate Limit';
  } else {
    updates.cooldownUntil = null;
    if (newStatus.toUpperCase() === 'ACTIVE') {
      updates.lastError = null;
    }
  }
  return updateWorkerState(workerIdOrDomain, updates);
}

export function pauseWorker(workerIdOrDomain) {
  return setWorkerStatus(workerIdOrDomain, 'PAUSED');
}

export function resumeWorker(workerIdOrDomain) {
  return setWorkerStatus(workerIdOrDomain, 'ACTIVE');
}

/**
 * Trips isolated circuit breaker for ONLY this worker
 */
export function tripWorkerCooldown(workerIdOrDomain, durationMs = 900_000, reason = 'Rate limit encountered') {
  return setWorkerStatus(workerIdOrDomain, 'COOLING_DOWN', durationMs, reason);
}

export function pauseAllWorkers() {
  const workers = getFleetWorkers();
  workers.forEach((w) => pauseWorker(w.id));
}

export function resumeAllWorkers() {
  const workers = getFleetWorkers();
  workers.forEach((w) => resumeWorker(w.id));
}

/**
 * Spawns an autonomous worker agent for a specific domain.
 * Evaluates isolated cooldown and status: does NOT stop or wait if another agent is resting!
 */
export function spawnWorkerAgent(agentConfig) {
  return new Promise((resolve) => {
    // 1. Check isolated lifecycle of this specific worker
    const lifecycle = getWorkerLifecycle(agentConfig.id);

    if (lifecycle.status === 'PAUSED') {
      console.log(`${agentConfig.color}[${agentConfig.id}] ⏸️ Worker is PAUSED in harvest-control.json. Skipping this cycle (all other workers remain active).${RESET}`);
      return resolve({ agent: agentConfig.id, status: 'PAUSED', skipped: true });
    }

    if (lifecycle.status === 'COOLING_DOWN' && lifecycle.cooldownUntil) {
      const waitSec = Math.max(1, Math.round((new Date(lifecycle.cooldownUntil).getTime() - Date.now()) / 1000));
      const resetTime = new Date(lifecycle.cooldownUntil).toISOString().slice(11, 19);
      console.log(`${agentConfig.color}[${agentConfig.id}] ⏳ Worker in ISOLATED COOLDOWN until ${resetTime} (${waitSec}s left - ${lifecycle.lastError || 'Rate Limit'}). Skipping (other workers continue).${RESET}`);
      return resolve({ agent: agentConfig.id, status: 'COOLING_DOWN', waitSec, skipped: true });
    }

    console.log(`${agentConfig.color}[LAUNCHING ${agentConfig.id}] Assigned Domain: ${agentConfig.domain.toUpperCase()}${RESET}`);
    updateWorkerState(agentConfig.id, { lastActiveAt: new Date().toISOString() });

    const env = {
      ...process.env,
      AGENT_NAME: agentConfig.id,
      TARGET_DOMAIN: agentConfig.domain
    };

    // First scout domain for fresh top targets
    const scoutProc = fork(SCOUT_SCRIPT, [agentConfig.domain], {
      cwd: BRAIN_ROOT,
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    let scoutOutput = '';

    scoutProc.stdout?.on('data', (data) => {
      const line = data.toString();
      scoutOutput += line;
      process.stdout.write(`${agentConfig.color}[${agentConfig.id}:SCOUT] ${RESET}${line}`);
    });

    scoutProc.stderr?.on('data', (data) => {
      process.stderr.write(`${agentConfig.color}[${agentConfig.id}:SCOUT_ERR] ${RESET}${data.toString()}`);
    });

    scoutProc.on('close', (code) => {
      // Check if scout hit a rate limit
      if (scoutOutput.includes('RATE LIMIT EXCEEDED') || scoutOutput.includes('rate limit reached') || code === 42) {
        console.warn(`${agentConfig.color}[${agentConfig.id}] ⚠️ Scout encountered rate-limit. Placing ONLY this agent on 10m isolated cooldown.${RESET}`);
        tripWorkerCooldown(agentConfig.id, 600_000, 'Scout domain rate limit');
        return resolve({ agent: agentConfig.id, status: 'TRIPPED_COOLDOWN', code });
      }

      console.log(`${agentConfig.color}[${agentConfig.id}] Scout cycle complete (Code: ${code}). Proceeding to zero-clone extraction...${RESET}`);

      // Now run zero-clone harvester for this domain
      const harvestProc = fork(ZERO_CLONE_SCRIPT, [], {
        cwd: BRAIN_ROOT,
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      let harvestOutput = '';
      let harvestSuccessCount = 0;

      harvestProc.stdout?.on('data', (data) => {
        const line = data.toString();
        harvestOutput += line;
        if (line.includes('UNIVERSAL RULES PROMOTED') || line.includes('SUCCESSFUL') || line.includes('ZERO-CLONE BATCH COMPLETE')) {
          if (line.includes('Successful    : 1') || line.includes('Successful    : 2') || line.includes('UNIVERSAL RULES PROMOTED')) {
            harvestSuccessCount++;
          }
        }
        process.stdout.write(`${agentConfig.color}[${agentConfig.id}:HARVEST] ${RESET}${line}`);
      });

      harvestProc.stderr?.on('data', (data) => {
        process.stderr.write(`${agentConfig.color}[${agentConfig.id}:HARVEST_ERR] ${RESET}${data.toString()}`);
      });

      harvestProc.on('close', (hCode) => {
        // If harvester encountered rate limit, isolate this worker without affecting others
        if (harvestOutput.includes('RATE LIMIT EXCEEDED') || harvestOutput.includes('secondary rate limit') || hCode === 42) {
          console.warn(`${agentConfig.color}[${agentConfig.id}] ⚠️ Rate limit encountered. Placing ONLY ${agentConfig.id} on 15m cooldown. Other agents remain active!${RESET}`);
          tripWorkerCooldown(agentConfig.id, 900_000, 'GitHub/AI Rate Limit on Target');
          return resolve({ agent: agentConfig.id, status: 'RATE_LIMITED', code: hCode });
        }

        const currentWorker = getWorkerLifecycle(agentConfig.id);
        const updatedTotal = (currentWorker.totalHarvested || 0) + (harvestSuccessCount > 0 ? 1 : 0);

        updateWorkerState(agentConfig.id, {
          lastActiveAt: new Date().toISOString(),
          lastHarvestedAt: harvestSuccessCount > 0 ? new Date().toISOString() : currentWorker.lastHarvestedAt,
          totalHarvested: updatedTotal,
          lastError: null
        });

        console.log(`${agentConfig.color}[${agentConfig.id}] Learning cycle finished (Code: ${hCode}, Harvested: ${harvestSuccessCount}).${RESET}`);
        resolve({ agent: agentConfig.id, code: hCode, harvested: harvestSuccessCount });
      });
    });
  });
}

/**
 * Main Multi-Agent Fleet Orchestrator
 */
export async function runMultiAgentFleet(options = {}) {
  console.log(`\n======================================================================`);
  console.log(`🚀 AI-BUILDER-BRAIN MULTI-AGENT FLEET ORCHESTRATOR`);
  console.log(`   Mode: PARALLEL_MULTI_AGENT SWARM`);
  console.log(`   Fleet Size: ${FLEET_ROSTER.length} Parallel Autonomous Workers`);
  console.log(`   Circuit Breakers: INDEPENDENT PER-AGENT & PER-KEY ISOLATION`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`======================================================================\n`);

  console.log(`📋 [FLEET ROSTER STATUS REPORT]`);
  FLEET_ROSTER.forEach((agent, i) => {
    const lifecycle = getWorkerLifecycle(agent.id);
    let statusLabel = `\x1b[32mACTIVE\x1b[0m`;
    if (lifecycle.status === 'PAUSED') {
      statusLabel = `\x1b[90mPAUSED\x1b[0m`;
    } else if (lifecycle.status === 'COOLING_DOWN') {
      const waitSec = Math.max(1, Math.round((new Date(lifecycle.cooldownUntil).getTime() - Date.now()) / 1000));
      statusLabel = `\x1b[33mCOOLING_DOWN (${waitSec}s left)\x1b[0m`;
    }
    console.log(`   ${i + 1}. ${agent.id} -> Domain: ${agent.domain} | Status: ${statusLabel} | Harvested: ${lifecycle.totalHarvested || 0}`);
  });

  // Autonomous Self-Replenishing Guard: Ensure unharvested targets exist before launch
  try {
    await ensureQueueReplenished(15, 24);
  } catch (err) {
    console.warn(`[REPLENISH WARNING] Auto-replenish failed: ${err.message}. Proceeding with existing queue.`);
  }

  console.log(`\n⚡ Launching active agents simultaneously in parallel...\n`);

  const startTime = Date.now();
  const workerPromises = FLEET_ROSTER.map((agent) => spawnWorkerAgent(agent));

  const results = await Promise.allSettled(workerPromises);
  const elapsedSec = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n======================================================================`);
  console.log(`🏁 MULTI-AGENT FLEET CYCLE FINISHED`);
  console.log(`   Execution Duration: ${elapsedSec} seconds`);
  console.log(`   Evaluated Workers: ${results.length}`);
  results.forEach((res, i) => {
    const agent = FLEET_ROSTER[i];
    let statusText = 'SUCCESS';
    if (res.status === 'rejected') {
      statusText = `FAILED (${res.reason})`;
    } else {
      const val = res.value;
      if (val.skipped) {
        statusText = `SKIPPED (${val.status})`;
      } else if (val.status === 'RATE_LIMITED' || val.status === 'TRIPPED_COOLDOWN') {
        statusText = `COOLDOWN_TRIPPED (Isolated - others unaffected)`;
      }
    }
    console.log(`   - ${agent.id} [${agent.domain}]: ${statusText}`);
  });
  console.log(`======================================================================\n`);

  // Synchronize Master Brain with atomic rebase retry
  try {
    await pushWithRebaseRetry('feat(fleet): 8-agent parallel fleet synchronized state [skip ci]', 5, BRAIN_ROOT);
  } catch (err) {
    console.warn(`[FLEET SYNC WARNING] ${err.message}`);
  }
}

// CLI Execution Entry Point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMultiAgentFleet().catch((err) => {
    console.error('Fatal Multi-Agent Fleet error:', err);
    process.exit(1);
  });
}
