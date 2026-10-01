import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  getFleetWorkers,
  getWorkerLifecycle,
  pauseWorker,
  resumeWorker,
  pauseAllWorkers,
  resumeAllWorkers
} from './multi-agent-fleet.mjs';
import { getAllKeysCircuitReport } from './ai-provider-pool.mjs';
import { runAutoDiscoveryScout } from './auto-discovery-scout.mjs';
import { getMasterCircuitsReport } from './master-circuit-breaker.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: BRAIN_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return err.message;
  }
}

export function setHarvesterStatus(newStatus) {
  let data = {};
  if (fs.existsSync(CONTROL_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    } catch (e) {}
  }

  data.status = newStatus.toUpperCase();
  data.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONTROL_PATH, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`[HARVESTER CONTROL] Global Status updated to: ${data.status}`);

  // Auto-sync status change to GitHub so Cloud Harvester receives it immediately
  try {
    run('git add harvest-control.json');
    run(`git commit -m "chore(harvester): set global status to ${data.status}"`);
    run('git push origin main');
    console.log(`[GIT PUSH] Harvester ${data.status} status pushed to GitHub remote.`);
  } catch (err) {
    console.warn(`[GIT NOTICE] ${err.message}`);
  }

  return data;
}

export function syncLocalWithCloud() {
  console.log(`\n[SYNC] Pulling latest 24/7 cloud-harvested learnings from GitHub...`);
  try {
    const out = run('git pull --rebase origin main');
    console.log(`[SYNC RESULT] ${out}`);
    return true;
  } catch (err) {
    console.error(`[SYNC ERROR] ${err.message}`);
    return false;
  }
}

export function getHarvesterStatus() {
  if (!fs.existsSync(CONTROL_PATH)) {
    return { status: 'UNKNOWN' };
  }
  return JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
}

/**
 * Renders complete, human-readable terminal dashboard of all agents & API keys
 */
export function displayDashboard() {
  const control = getHarvesterStatus();
  const workers = getFleetWorkers();
  const keysReport = getAllKeysCircuitReport();

  console.log(`\n========================================================================================`);
  console.log(`🧠 AI-BUILDER-BRAIN: 24/7 AUTONOMOUS MULTI-AGENT & API POOL DASHBOARD`);
  console.log(`   Global Status    : ${control.status === 'ACTIVE' ? '\x1b[32mACTIVE\x1b[0m' : '\x1b[31mPAUSED\x1b[0m'}`);
  console.log(`   Concurrency Mode : ${control.concurrencyMode || 'PARALLEL_MULTI_AGENT'}`);
  console.log(`   Cloud Schedule   : Hourly at min 23 via GitHub Actions (24/7 Autonomous)`);
  console.log(`   Master Brain     : ${BRAIN_ROOT}`);
  console.log(`   Isolation Policy : Zero blanket ON/OFF. Each agent and key operates independently.`);
  console.log(`========================================================================================\n`);

  // 1. Swarm Multi-Agent Fleet Status
  console.log(`🤖 [SWARM MULTI-AGENT FLEET: 8 DOMAIN WORKERS]`);
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(
    `#`.padEnd(4) +
    `Agent ID`.padEnd(16) +
    `Assigned Domain`.padEnd(30) +
    `Status`.padEnd(20) +
    `Reset / Cooldown`.padEnd(22) +
    `Harvested`
  );
  console.log(`----------------------------------------------------------------------------------------`);

  workers.forEach((w, i) => {
    const lifecycle = getWorkerLifecycle(w.id);
    let statusStr = '\x1b[32mACTIVE\x1b[0m';
    let resetStr = 'Ready / Active';

    if (lifecycle.status === 'PAUSED') {
      statusStr = '\x1b[90mPAUSED\x1b[0m';
      resetStr = 'Manual Resume Req.';
    } else if (lifecycle.status === 'COOLING_DOWN') {
      const waitSec = Math.max(1, Math.round((new Date(lifecycle.cooldownUntil).getTime() - Date.now()) / 1000));
      statusStr = '\x1b[33mCOOLING_DOWN\x1b[0m';
      resetStr = `Auto in ${waitSec}s (${new Date(lifecycle.cooldownUntil).toISOString().slice(11, 19)})`;
    }

    console.log(
      `${i + 1}`.padEnd(4) +
      `${w.id}`.padEnd(16) +
      `${w.domain}`.padEnd(30) +
      statusStr.padEnd(29) + // ANSI codes take hidden bytes
      resetStr.padEnd(22) +
      `${lifecycle.totalHarvested || 0} repos`
    );
  });
  console.log(`----------------------------------------------------------------------------------------\n`);

  // 2. AI Provider Key Pool Status
  console.log(`🔑 [AI PROVIDER KEY POOL: MULTI-KEY ROTATION & CIRCUIT BREAKERS]`);
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(
    `#`.padEnd(4) +
    `Provider`.padEnd(18) +
    `Key Identifier`.padEnd(26) +
    `Circuit State`.padEnd(22) +
    `Cooldown Reset`.padEnd(20) +
    `Success/Fail`
  );
  console.log(`----------------------------------------------------------------------------------------`);

  if (keysReport.length === 0) {
    console.log(`   (No external keys registered in .brain-secrets.json or env. Structural fallback active)`);
  } else {
    keysReport.forEach((k, i) => {
      let stateStr = '\x1b[32mHEALTHY\x1b[0m';
      let resetStr = 'None (Serving)';

      if (k.status === 'RATE_LIMITED') {
        const waitSec = Math.max(1, Math.round((k.cooldownUntil - Date.now()) / 1000));
        stateStr = '\x1b[33mRATE_LIMITED\x1b[0m';
        resetStr = `In ${waitSec}s`;
      } else if (k.status === 'QUOTA_EXHAUSTED') {
        const waitSec = Math.max(1, Math.round((k.cooldownUntil - Date.now()) / 1000));
        stateStr = '\x1b[31mQUOTA_EXHAUSTED\x1b[0m';
        resetStr = `In ${Math.round(waitSec / 60)}m (${new Date(k.cooldownUntil).toISOString().slice(11, 19)})`;
      }

      console.log(
        `${i + 1}`.padEnd(4) +
        `${k.provider}`.padEnd(18) +
        `${k.label || k.id}`.padEnd(26) +
        stateStr.padEnd(31) +
        resetStr.padEnd(20) +
        `${k.totalSuccesses || 0} ok / ${k.consecutiveFailures || 0} err`
      );
    });
  }
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(`💡 Note: When one key or agent hits its limit, ONLY that item rests. Other agents continue uninterrupted!\n`);

  // 3. Master Infrastructure Circuits Status (The Master Switch)
  const masterCircuits = getMasterCircuitsReport();
  console.log(`⚡ [MASTER INFRASTRUCTURE CIRCUITS: QUOTA & RESET GATES]`);
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(
    `#`.padEnd(4) +
    `Service / Gate`.padEnd(22) +
    `Status`.padEnd(20) +
    `Remaining`.padEnd(16) +
    `Reset / Cooldown`.padEnd(26)
  );
  console.log(`----------------------------------------------------------------------------------------`);
  masterCircuits.forEach((c, i) => {
    let statusStr = c.available ? '\x1b[32mHEALTHY\x1b[0m' : '\x1b[31mEXHAUSTED\x1b[0m';
    let resetStr = c.available ? 'Ready / Active' : `Auto-Reset: ${c.resetAt?.slice(11, 19)} (${c.waitSec}s)`;
    if (c.service === 'GITHUB_ACTIONS' && !c.available) {
      resetStr = `Next Month (2026-11-01)`;
    }
    console.log(
      `${i + 1}`.padEnd(4) +
      `${c.service}`.padEnd(22) +
      statusStr.padEnd(29) +
      `${c.remaining}`.padEnd(16) +
      resetStr.padEnd(26)
    );
  });
  console.log(`----------------------------------------------------------------------------------------`);
  console.log(`🛡️ Master Switch Invariant: If a service quota is dead, dependent tasks sleep until exact reset.`);
  console.log(`========================================================================================\n`);
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const action = (process.argv[2] || 'status').toLowerCase();
  const targetParam = process.argv[3] || null;

  if (action === 'start' || action === 'chalu' || action === 'resume') {
    if (targetParam && targetParam !== 'all') {
      resumeWorker(targetParam);
      console.log(`▶️ [ISOLATED RESUME] Worker '${targetParam}' has been resumed to ACTIVE! All other agents unaffected.`);
      run('git add harvest-control.json');
      run(`git commit -m "chore(harvester): resume worker ${targetParam}"`);
      run('git push origin main');
    } else {
      setHarvesterStatus('ACTIVE');
      resumeAllWorkers();
      console.log(`▶️ [GLOBAL RESUME] All workers and engine resumed to ACTIVE!`);
    }
  } else if (action === 'stop' || action === 'pause' || action === 'ruk') {
    if (targetParam && targetParam !== 'all') {
      pauseWorker(targetParam);
      console.log(`⏸️ [ISOLATED PAUSE] Worker '${targetParam}' has been PAUSED. All other agents remain ACTIVE!`);
      run('git add harvest-control.json');
      run(`git commit -m "chore(harvester): pause worker ${targetParam}"`);
      run('git push origin main');
    } else {
      setHarvesterStatus('PAUSED');
      pauseAllWorkers();
      console.log(`⏸️ [GLOBAL PAUSE] All workers and engine PAUSED.`);
    }
  } else if (action === 'sync' || action === 'pull') {
    syncLocalWithCloud();
  } else if (action === 'discover' || action === 'scout' || action === 'khoj') {
    console.log(`[AUTONOMOUS DISCOVERY] Initiating scout across domains...`);
    runAutoDiscoveryScout({ domain: targetParam }).then((res) => {
      if (res.discovered > 0) {
        run('git add repos.txt harvest-control.json 04_WORKFLOWS/factory-engine/discovery-log.json');
        run(`git commit -m "feat(scout): autonomously discovered ${res.discovered} top repositories [skip ci]"`);
        run('git push origin main');
        console.log(`[GIT PUSH] Pushed newly scouted repositories to GitHub.`);
      }
    });
  } else if (action === 'fleet' || action === 'swarm' || action === 'multi') {
    import('./multi-agent-fleet.mjs').then((m) => m.runMultiAgentFleet());
  } else if (action === 'monitor' || action === 'live' || action === 'check' || action === 'dekh') {
    import('./monitor.mjs').then((m) => m.displayLiveMonitor());
  } else {
    displayDashboard();
  }
}
