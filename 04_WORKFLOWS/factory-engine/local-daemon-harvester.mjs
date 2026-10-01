import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { runMultiAgentFleet } from './multi-agent-fleet.mjs';
import {
  checkServiceAvailability,
  MASTER_SERVICES
} from './master-circuit-breaker.mjs';
import { runInternalKnowledgeSynthesis } from './internal-synthesizer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');
const LOG_FILE = path.join(BRAIN_ROOT, 'daemon-harvester.log');

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes between cycles
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (e) {}
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { cwd: BRAIN_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    const errOut = err.stderr ? err.stderr.toString().trim() : err.message;
    return `ERR: ${errOut}`;
  }
}

const PID_FILE = path.join(BRAIN_ROOT, '.harvest-locks', 'daemon.pid');

function acquireDaemonPidLock() {
  const locksDir = path.dirname(PID_FILE);
  if (!fs.existsSync(locksDir)) fs.mkdirSync(locksDir, { recursive: true });

  if (fs.existsSync(PID_FILE)) {
    try {
      const oldPid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      if (oldPid && !isNaN(oldPid) && oldPid !== process.pid) {
        // Check if process is alive
        try {
          process.kill(oldPid, 0);
          log(`⚠️ An active daemon instance (PID: ${oldPid}) is already running. Exiting redundant instance.`);
          process.exit(0);
        } catch (e) {
          log(`🧹 Cleaning up stale daemon PID lock (${oldPid}).`);
        }
      }
    } catch (e) {}
  }

  fs.writeFileSync(PID_FILE, String(process.pid), 'utf-8');

  const cleanup = () => {
    try {
      if (fs.existsSync(PID_FILE)) {
        const recorded = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
        if (recorded === process.pid) fs.unlinkSync(PID_FILE);
      }
    } catch (e) {}
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
}

async function startAutonomousDaemon() {
  log(`======================================================================`);
  log(`🤖 AI-BUILDER-BRAIN 24/7/365 LOCAL AUTONOMOUS LEARNING DAEMON STARTED`);
  log(`   Mode       : Quota-Aware Server-to-Server Learning Loop`);
  log(`   Cadence    : Every 5 minutes (Auto-Sleeps Until Reset on Quota Limits)`);
  log(`   Target Root: ${BRAIN_ROOT}`);
  log(`======================================================================`);

  let cycle = 1;

  while (true) {
    try {
      log(`\n🔄 [CYCLE #${cycle}] Initiating autonomous extraction cycle...`);

      // 1. Check if harvester is paused
      if (fs.existsSync(CONTROL_PATH)) {
        try {
          const control = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
          if (control.status === 'PAUSED') {
            log(`⏸️ Harvester status is PAUSED in harvest-control.json. Sleeping for 2 minutes...`);
            await sleep(120_000);
            continue;
          }
        } catch (e) {}
      }

      // 2. Master Circuit Breaker Check: Never hammer external services when quota is dead!
      const ghAvail = checkServiceAvailability(MASTER_SERVICES.GITHUB_API);
      if (!ghAvail.available) {
        log(`⏳ [MASTER SWITCH OFF] GitHub API quota is EXHAUSTED until ${ghAvail.resetAt} (${Math.round(ghAvail.waitSec / 60)}m left).`);
        log(`   Reason: ${ghAvail.reason}`);
        log(`👷 [INTERNAL PEER LABORER] While external GitHub is resting, running internal knowledge synthesis...`);
        try {
          await runInternalKnowledgeSynthesis();
        } catch (sErr) {
          log(`⚠️ Internal synthesis note: ${sErr.message}`);
        }

        // Sleep directly until the exact reset time instead of spin-looping!
        const sleepTimeMs = Math.max(5000, ghAvail.waitSec * 1000);
        log(`💤 [SAFE BACKOFF] Sleeping for ${Math.round(sleepTimeMs / 60000)} minutes until exact quota reset. Zero API requests will be sent.`);
        await sleep(sleepTimeMs);
        log(`🟢 [QUOTA RESTORED] Reset timestamp reached. Awakening daemon for fresh extraction cycle...`);
        continue;
      }

      // 2. Sync latest remote cloud intelligence first
      log(`📥 Pulling latest cloud updates from origin/main...`);
      const pullRes = runCmd('git pull --rebase origin main');
      log(`Git Pull: ${pullRes}`);

      // 3. Execute Multi-Agent Learning Fleet
      log(`🚀 Executing Multi-Agent Learning Fleet Swarm...`);
      await runMultiAgentFleet();

      // 4. Push verified learnings to GitHub
      log(`📤 Synchronizing live verified intelligence to remote repository...`);
      runCmd('git add .');
      const diff = runCmd('git diff --staged --quiet');
      if (diff.includes('ERR')) {
        // Staged changes exist
        runCmd('git commit -m "feat(daemon): 24/7 autonomous learning harvest cycle [skip ci]"');
        const pushRes = runCmd('git push origin main');
        log(`Git Push Result: ${pushRes}`);
      } else {
        log(`Working tree clean, all learnings already synced.`);
      }

      log(`✅ [CYCLE #${cycle} COMPLETE] Sleeping for ${INTERVAL_MS / 60000} minutes before next cycle...`);
    } catch (err) {
      log(`❌ [CYCLE #${cycle} ERROR] ${err.message}. Retrying in 1 minute...`);
      await sleep(60_000);
    }

    cycle++;
    await sleep(INTERVAL_MS);
  }
}

async function daemonSupervisor() {
  acquireDaemonPidLock();
  while (true) {
    try {
      await startAutonomousDaemon();
    } catch (err) {
      log(`💥 Daemon crashed unexpectedly: ${err.stack || err.message}`);
      log(`🔄 Supervisor auto-restarting daemon in 10 seconds...`);
      await sleep(10000);
    }
  }
}

daemonSupervisor().catch((err) => {
  log(`💥 Fatal Supervisor Crash: ${err.stack || err.message}`);
  process.exit(1);
});

