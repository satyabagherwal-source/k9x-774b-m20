import fs from 'fs';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { DISCOVERY_DOMAINS } from './auto-discovery-scout.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const ZERO_CLONE_SCRIPT = path.join(__dirname, 'zero-clone-harvester.mjs');
const SCOUT_SCRIPT = path.join(__dirname, 'auto-discovery-scout.mjs');

const FLEET_ROSTER = [
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
 * Spawns an autonomous worker agent for a specific domain
 */
function spawnWorkerAgent(agentConfig) {
  return new Promise((resolve) => {
    console.log(`${agentConfig.color}[LAUNCHING ${agentConfig.id}] Assigned Domain: ${agentConfig.domain.toUpperCase()}${RESET}`);

    const env = {
      ...process.env,
      AGENT_NAME: agentConfig.id,
      TARGET_DOMAIN: agentConfig.domain
    };

    // First scout domain for fresh top targets, then invoke zero-clone harvester
    const scoutProc = fork(SCOUT_SCRIPT, [agentConfig.domain], {
      cwd: BRAIN_ROOT,
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    let output = '';

    scoutProc.stdout?.on('data', (data) => {
      const line = data.toString();
      output += line;
      process.stdout.write(`${agentConfig.color}[${agentConfig.id}] ${RESET}${line}`);
    });

    scoutProc.stderr?.on('data', (data) => {
      process.stderr.write(`${agentConfig.color}[${agentConfig.id}:ERR] ${RESET}${data.toString()}`);
    });

    scoutProc.on('close', (code) => {
      console.log(`${agentConfig.color}[${agentConfig.id}] Scout cycle complete (Code: ${code}). Proceeding to zero-clone extraction...${RESET}`);

      // Now run zero-clone harvester for this domain
      const harvestProc = fork(ZERO_CLONE_SCRIPT, [], {
        cwd: BRAIN_ROOT,
        env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      harvestProc.stdout?.on('data', (data) => {
        process.stdout.write(`${agentConfig.color}[${agentConfig.id}:HARVEST] ${RESET}${data.toString()}`);
      });

      harvestProc.stderr?.on('data', (data) => {
        process.stderr.write(`${agentConfig.color}[${agentConfig.id}:HARVEST_ERR] ${RESET}${data.toString()}`);
      });

      harvestProc.on('close', (hCode) => {
        console.log(`${agentConfig.color}[${agentConfig.id}] Learning cycle finished (Code: ${hCode}).${RESET}`);
        resolve({ agent: agentConfig.id, code: hCode });
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
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`======================================================================\n`);

  console.log(`📋 [FLEET ROSTER ACTIVATED]`);
  FLEET_ROSTER.forEach((agent, i) => {
    console.log(`   ${i + 1}. ${agent.id} -> Domain: ${agent.domain} (${DISCOVERY_DOMAINS[agent.domain]?.name || ''})`);
  });
  console.log(`\n⚡ Launching all ${FLEET_ROSTER.length} agents simultaneously in parallel...\n`);

  const startTime = Date.now();
  const workerPromises = FLEET_ROSTER.map((agent) => spawnWorkerAgent(agent));

  const results = await Promise.allSettled(workerPromises);
  const elapsedSec = Math.round((Date.now() - startTime) / 1000);

  console.log(`\n======================================================================`);
  console.log(`🏁 MULTI-AGENT FLEET MISSION COMPLETE`);
  console.log(`   Execution Duration: ${elapsedSec} seconds`);
  console.log(`   Active Workers: ${results.length}`);
  results.forEach((res, i) => {
    const agent = FLEET_ROSTER[i];
    const status = res.status === 'fulfilled' ? 'SUCCESS' : `FAILED (${res.reason})`;
    console.log(`   - ${agent.id} [${agent.domain}]: ${status}`);
  });
  console.log(`======================================================================\n`);
}

// CLI Execution Entry Point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runMultiAgentFleet().catch((err) => {
    console.error('Fatal Multi-Agent Fleet error:', err);
    process.exit(1);
  });
}
