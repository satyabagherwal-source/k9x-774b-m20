import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { DISCOVERY_DOMAINS, ensureQueueReplenished, isDeeplyHarvested } from './auto-discovery-scout.mjs';
import { pushWithRebaseRetry, sanitizeHarvestControl } from './concurrency-coordinator.mjs';
import {
  checkServiceAvailability,
  tripMasterCircuit,
  MASTER_SERVICES
} from './master-circuit-breaker.mjs';
import { runInternalKnowledgeSynthesis } from './internal-synthesizer.mjs';
import { parseSourceUrl } from './zero-clone-harvester.mjs';
import { getSourcesRegistry } from './upgrade-checker.mjs';

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
  { id: 'Agent-Theta', name: 'Theta', domain: 'database-storage-engines', color: '\x1b[92m' }, // Bright Green
  { id: 'Agent-Iota', name: 'Iota', domain: 'cognitive-neuroscience-systems', color: '\x1b[95m' } // Bright Magenta
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
    try {
      sanitizeHarvestControl(BRAIN_ROOT);
      const data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
      return data.multiAgentFleet?.workers || [];
    } catch (e2) {
      return [];
    }
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
    let data;
    try {
      data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    } catch (parseErr) {
      sanitizeHarvestControl(BRAIN_ROOT);
      data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    }
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
 * Resolves a dedicated, non-overlapping target for a worker agent.
 * Checks unharvested targets matching the agent's domain first,
 * then falls back to general unharvested backlog if domain is 100% harvested.
 */
export function getTargetForWorker(agentConfig, assignedSlugs = new Set()) {
  const queuePath = path.join(BRAIN_ROOT, 'repos.txt');
  if (!fs.existsSync(queuePath)) return null;

  const raw = fs.readFileSync(queuePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  let currentDomain = 'general';
  const domainTargets = [];
  const generalBacklog = [];
  const domainNextPass = [];
  const generalNextPass = [];

  const registry = getSourcesRegistry();

  for (const line of lines) {
    const trimmed = line.trim();
    const domainMatch = trimmed.match(/^#\s*\[([A-Z0-9_-]+)\]/i);
    if (domainMatch) {
      currentDomain = domainMatch[1].toLowerCase();
      continue;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = parseSourceUrl(trimmed);
      if (!parsed) continue;

      if (assignedSlugs.has(parsed.slug)) continue;

      // 1. Unharvested repos (Priority 1: First Pass)
      if (!isDeeplyHarvested(parsed.slug, BRAIN_ROOT)) {
        if (currentDomain === agentConfig.domain.toLowerCase()) {
          domainTargets.push(parsed);
        } else {
          generalBacklog.push(parsed);
        }
      } else {
        // 2. Harvested repos: Enqueued for Round-Robin Next Learning Pass
        const key = (parsed.slug || parsed.repo || '').toLowerCase();
        const entry = registry[key] || registry[parsed.slug] || null;
        const lastCheckedEpoch = entry?.lastChecked ? new Date(entry.lastChecked).getTime() : 0;
        const item = { ...parsed, lastCheckedEpoch };

        if (currentDomain === agentConfig.domain.toLowerCase()) {
          domainNextPass.push(item);
        } else {
          generalNextPass.push(item);
        }
      }
    }
  }

  // Priority 1: Pick brand-new unharvested targets first
  let chosen = domainTargets[0] || generalBacklog[0] || null;

  // Priority 2: Next Learning Line (All harvested repos queued in FIFO rotation)
  if (!chosen) {
    domainNextPass.sort((a, b) => a.lastCheckedEpoch - b.lastCheckedEpoch);
    generalNextPass.sort((a, b) => a.lastCheckedEpoch - b.lastCheckedEpoch);

    // Cooldown window between re-probing the same repo (15 minutes)
    const RECHECK_COOLDOWN_MS = 15 * 60 * 1000;
    const now = Date.now();

    const candidate = domainNextPass[0] || generalNextPass[0] || null;
    if (candidate && (now - candidate.lastCheckedEpoch >= RECHECK_COOLDOWN_MS)) {
      chosen = candidate;
    }
  }

  if (chosen) {
    assignedSlugs.add(chosen.slug);
  }
  return chosen;
}

let isFleetScoutingActive = false;

/**
 * Spawns an autonomous worker agent for a specific domain with dedicated target isolation.
 * Evaluates isolated cooldown and status: does NOT stop or wait if another agent is resting!
 */
export function spawnWorkerAgent(agentConfig, assignedSlugs = new Set()) {
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

    // 2. Master Circuit Breaker Check: Respect Central Dependency Switch
    if (agentConfig.domain !== 'huggingface-ai-models') {
      const ghAvail = checkServiceAvailability(MASTER_SERVICES.GITHUB_API);
      if (!ghAvail.available) {
        console.log(`${agentConfig.color}[${agentConfig.id}] ⏳ GITHUB MASTER SWITCH IS OFF until ${ghAvail.resetAt} (${ghAvail.waitSec}s left). Worker safely parked (will auto-wake on reset).${RESET}`);
        return resolve({ agent: agentConfig.id, status: 'WAITING_FOR_GITHUB_RESET', waitSec: ghAvail.waitSec, skipped: true });
      }
    } else {
      const hfAvail = checkServiceAvailability(MASTER_SERVICES.HUGGINGFACE_API);
      if (!hfAvail.available) {
        console.log(`${agentConfig.color}[${agentConfig.id}] ⏳ HF MASTER SWITCH IS OFF until ${hfAvail.resetAt}. Worker safely parked.${RESET}`);
        return resolve({ agent: agentConfig.id, status: 'WAITING_FOR_HF_RESET', skipped: true });
      }
    }

    // 3. Resolve Dedicated Target for this Worker
    let target = getTargetForWorker(agentConfig, assignedSlugs);

    // If no unharvested target found anywhere, check if we should scout
    if (!target) {
      if (isFleetScoutingActive) {
        console.log(`${agentConfig.color}[${agentConfig.id}] Scouting already underway by another agent. Passing to avoid concurrent GitHub search rate limits.${RESET}`);
        return resolve({ agent: agentConfig.id, status: 'SCOUT_ALREADY_ACTIVE', skipped: true });
      }
      isFleetScoutingActive = true;
      console.log(`${agentConfig.color}[${agentConfig.id}] Domain ${agentConfig.domain} and queue fully harvested. Single-flight scouting fresh repos...${RESET}`);
      const scoutProc = fork(SCOUT_SCRIPT, [agentConfig.domain], {
        cwd: BRAIN_ROOT,
        env: { ...process.env, AGENT_NAME: agentConfig.id, TARGET_DOMAIN: agentConfig.domain },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      let scoutOutput = '';
      scoutProc.stdout?.on('data', (data) => {
        scoutOutput += data.toString();
        process.stdout.write(`${agentConfig.color}[${agentConfig.id}:SCOUT] ${RESET}${data.toString()}`);
      });
      scoutProc.stderr?.on('data', (data) => {
        process.stderr.write(`${agentConfig.color}[${agentConfig.id}:SCOUT_ERR] ${RESET}${data.toString()}`);
      });

      scoutProc.on('close', (code) => {
        isFleetScoutingActive = false;
        if (scoutOutput.includes('RATE LIMIT EXCEEDED') || scoutOutput.includes('rate limit reached') || code === 42) {
          if (agentConfig.domain !== 'huggingface-ai-models') {
            tripMasterCircuit(MASTER_SERVICES.GITHUB_API, Date.now() + 600_000, 'GitHub Search Rate Limit in Scout');
          }
          tripWorkerCooldown(agentConfig.id, 600_000, 'Scout domain rate limit');
          return resolve({ agent: agentConfig.id, status: 'TRIPPED_COOLDOWN', code });
        }
        target = getTargetForWorker(agentConfig, assignedSlugs);
        if (!target) {
          return resolve({ agent: agentConfig.id, status: 'NO_TARGETS_AVAILABLE', harvested: 0 });
        }
        executeHarvest(target);
      });
      return;
    }

    executeHarvest(target);

    function executeHarvest(targetObj) {
      console.log(`${agentConfig.color}[LAUNCHING ${agentConfig.id}] Domain: ${agentConfig.domain.toUpperCase()} -> Harvesting Target: ${targetObj.webUrl}${RESET}`);
      updateWorkerState(agentConfig.id, { lastActiveAt: new Date().toISOString() });

      const env = {
        ...process.env,
        AGENT_NAME: agentConfig.id,
        TARGET_DOMAIN: agentConfig.domain
      };

      // Run zero-clone harvester directly on the dedicated target URL
      const harvestProc = fork(ZERO_CLONE_SCRIPT, [targetObj.webUrl], {
        cwd: BRAIN_ROOT,
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      let harvestOutput = '';
      let harvestSuccessCount = 0;
      let verifiedResult = null;

      // Listen for structured machine-readable result payload over IPC channel
      harvestProc.on('message', (msg) => {
        if (msg && msg.type === 'HARVEST_RESULT' && msg.result) {
          const res = msg.result;
          if (
            res.status === 'VERIFIED_LEARNING' &&
            res.verification?.storage === true &&
            res.verification?.readBack === true &&
            res.verification?.index === true
          ) {
            verifiedResult = res;
            harvestSuccessCount++;
            console.log(`${agentConfig.color}[${agentConfig.id}:IPC VERIFIED] Machine-readable learning verified: ${res.learningId} (SHA-256: ${res.contentHash?.slice(0, 16)}...)${RESET}`);
          } else {
            console.warn(`${agentConfig.color}[${agentConfig.id}:IPC REJECTED] Machine-readable learning rejected with status: ${res.status}${RESET}`);
          }
        }
      });

      harvestProc.stdout?.on('data', (data) => {
        const line = data.toString();
        harvestOutput += line;
        process.stdout.write(`${agentConfig.color}[${agentConfig.id}:HARVEST] ${RESET}${line}`);
      });

      harvestProc.stderr?.on('data', (data) => {
        process.stderr.write(`${agentConfig.color}[${agentConfig.id}:HARVEST_ERR] ${RESET}${data.toString()}`);
      });

      harvestProc.on('close', (hCode) => {
        // If harvester encountered genuine API rate limit, trip Master Circuit Breaker
        if (harvestOutput.includes('RATE LIMIT EXCEEDED') || harvestOutput.includes('secondary rate limit') || harvestOutput.includes('MASTER CIRCUIT BREAKER ENGAGED') || hCode === 42) {
          console.warn(`${agentConfig.color}[${agentConfig.id}] ⚠️ Rate limit encountered. Tripping Master Circuit Breaker.${RESET}`);
          if (agentConfig.domain !== 'huggingface-ai-models') {
            tripMasterCircuit(MASTER_SERVICES.GITHUB_API, Date.now() + 900_000, 'GitHub REST Rate Limit in Zero-Clone');
          }
          tripWorkerCooldown(agentConfig.id, 900_000, 'GitHub/AI Rate Limit on Target');
          return resolve({ agent: agentConfig.id, target: targetObj.slug, status: 'RATE_LIMITED', code: hCode });
        }

        const isVerified = harvestSuccessCount > 0 && verifiedResult !== null;
        const currentWorker = getWorkerLifecycle(agentConfig.id);
        const updatedTotal = (currentWorker.totalHarvested || 0) + (isVerified ? 1 : 0);

        updateWorkerState(agentConfig.id, {
          lastActiveAt: new Date().toISOString(),
          lastHarvestedAt: isVerified ? new Date().toISOString() : currentWorker.lastHarvestedAt,
          totalHarvested: updatedTotal,
          lastError: isVerified ? null : (hCode === 0 ? null : `Process exited with code ${hCode}`)
        });

        const statusLabel = isVerified
          ? 'VERIFIED_LEARNING'
          : (harvestOutput.includes('SKIP: NO UPGRADE DETECTED') ? 'SKIPPED_UP_TO_DATE' : 'FAILED_PERSISTENCE');

        console.log(`${agentConfig.color}[${agentConfig.id}] Learning cycle finished for ${targetObj.slug} (Status: ${statusLabel}, Code: ${hCode}, Verified: ${harvestSuccessCount}).${RESET}`);
        resolve({
          agent: agentConfig.id,
          target: targetObj.slug,
          code: hCode,
          harvested: isVerified ? 1 : 0,
          status: statusLabel,
          verifiedResult
        });
      });
    }
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

  // Master Switch Dependency Gate & Internal Peer Laborer Activation
  const ghAvail = checkServiceAvailability(MASTER_SERVICES.GITHUB_API);
  if (ghAvail.available) {
    try {
      await ensureQueueReplenished(15, 24);
    } catch (err) {
      console.warn(`[REPLENISH WARNING] Auto-replenish failed: ${err.message}. Proceeding with existing queue.`);
    }
  } else {
    console.log(`\n⏳ [GITHUB QUOTA SLEEP] GitHub API Master Switch is OFF until ${ghAvail.resetAt} (${ghAvail.waitSec}s remaining).`);
    console.log(`👷 [INTERNAL PEER LEARNING ENGAGED] While external GitHub is resting, laborers are teaching each other: synthesizing cross-project intelligence from harvested dossiers!`);
    try {
      await runInternalKnowledgeSynthesis();
    } catch (synthErr) {
      console.warn(`[INTERNAL SYNTHESIS WARNING] ${synthErr.message}`);
    }
  }

  console.log(`\n⚡ Launching active agents with respectful inter-agent stagger...\n`);

  const startTime = Date.now();
  const assignedSlugs = new Set();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Stagger worker launches by 2500ms to avoid concurrent burst spikes
  const workerPromises = FLEET_ROSTER.map(async (agent, i) => {
    if (i > 0) {
      await sleep(i * 2500);
    }
    return spawnWorkerAgent(agent, assignedSlugs);
  });

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
      } else if (val.status === 'VERIFIED_LEARNING' || val.harvested > 0) {
        statusText = `VERIFIED_LEARNING (${val.target})`;
      } else if (val.status === 'SKIPPED_UP_TO_DATE') {
        statusText = `SKIPPED_UP_TO_DATE (${val.target})`;
      } else {
        statusText = `FAILED_PERSISTENCE (${val.target || 'idle'})`;
      }
    }
    console.log(`   - ${agent.id} [${agent.domain}]: ${statusText}`);
  });
  console.log(`======================================================================\n`);

  // Synchronize Master Brain with atomic rebase retry
  try {
    const pushRes = await pushWithRebaseRetry('feat(fleet): multi-agent parallel fleet harvested intelligence [skip ci]', 5, BRAIN_ROOT);
    if (!pushRes.success) {
      console.error(`❌ [FAILED_PERSISTENCE] Remote git push failed after maximum retries! Ephemeral runner state would be lost.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ [FAILED_PERSISTENCE] Remote git push error: ${err.message}`);
    process.exit(1);
  }
}

// CLI Execution Entry Point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMultiAgentFleet().catch((err) => {
    console.error('Fatal Multi-Agent Fleet error:', err);
    process.exit(1);
  });
}
