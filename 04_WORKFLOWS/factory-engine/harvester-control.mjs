import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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

  console.log(`[HARVESTER CONTROL] Status updated to: ${data.status}`);

  // Auto-sync status change to GitHub so Cloud Harvester receives it immediately
  try {
    run('git add harvest-control.json');
    run(`git commit -m "chore(harvester): set status to ${data.status}"`);
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

import { runAutoDiscoveryScout } from './auto-discovery-scout.mjs';

export function getHarvesterStatus() {
  if (!fs.existsSync(CONTROL_PATH)) {
    return { status: 'UNKNOWN' };
  }
  return JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const action = (process.argv[2] || 'status').toLowerCase();
  const domainParam = process.argv[3] || null;

  if (action === 'start' || action === 'chalu' || action === 'resume') {
    setHarvesterStatus('ACTIVE');
  } else if (action === 'stop' || action === 'pause' || action === 'ruk') {
    setHarvesterStatus('PAUSED');
  } else if (action === 'sync' || action === 'pull') {
    syncLocalWithCloud();
  } else if (action === 'discover' || action === 'scout' || action === 'khoj') {
    console.log(`[AUTONOMOUS DISCOVERY] Initiating scout across domains...`);
    runAutoDiscoveryScout({ domain: domainParam }).then((res) => {
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
    console.log(JSON.stringify(getHarvesterStatus(), null, 2));
  }
}
