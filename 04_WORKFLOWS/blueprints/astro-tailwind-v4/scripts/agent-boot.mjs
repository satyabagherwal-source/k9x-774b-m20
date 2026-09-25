import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('⚡ [Agent Boot] Booting project environment...');

const root = process.cwd();
const bridgeConfig = path.join(root, '.project-brain', 'brain-bridge.json');
const contextFile = path.join(root, 'PROJECT_CONTEXT.md');
const rulesFile = path.join(root, 'PROJECT_RULES.md');
const stateFile = path.join(root, 'PROJECT_STATE.json');

const checks = [];

// 1. Brain Bridge Check
if (fs.existsSync(bridgeConfig)) {
  const bridge = JSON.parse(fs.readFileSync(bridgeConfig, 'utf-8'));
  const masterPath = bridge.masterBrainPath;
  const masterExists = fs.existsSync(masterPath);
  checks.push({
    name: 'Brain Bridge',
    status: masterExists ? 'READY' : 'OFFLINE_FALLBACK',
    details: masterExists ? `Connected to ${masterPath}` : 'Master Brain path not accessible'
  });
} else {
  checks.push({ name: 'Brain Bridge', status: 'BLOCKED', details: 'Missing .project-brain/brain-bridge.json' });
}

// 2. Project Context & Rules Check
checks.push({
  name: 'Project Context',
  status: fs.existsSync(contextFile) ? 'READY' : 'BLOCKED',
  details: fs.existsSync(contextFile) ? 'PROJECT_CONTEXT.md present' : 'Missing PROJECT_CONTEXT.md'
});

checks.push({
  name: 'Project Rules',
  status: fs.existsSync(rulesFile) ? 'READY' : 'BLOCKED',
  details: fs.existsSync(rulesFile) ? 'PROJECT_RULES.md present' : 'Missing PROJECT_RULES.md'
});

// 3. Project State Check
checks.push({
  name: 'Project State',
  status: fs.existsSync(stateFile) ? 'READY' : 'BLOCKED',
  details: fs.existsSync(stateFile) ? 'PROJECT_STATE.json present' : 'Missing PROJECT_STATE.json'
});

// Output Summary
console.log('\n========================================');
console.log('AGENT BOOT REPORT');
console.log('========================================');
let isBlocked = false;
checks.forEach(c => {
  const symbol = c.status === 'READY' ? '✅' : (c.status === 'OFFLINE_FALLBACK' ? '⚠️' : '❌');
  console.log(`${symbol} ${c.name.padEnd(20)}: ${c.status} (${c.details})`);
  if (c.status === 'BLOCKED') isBlocked = true;
});
console.log('========================================');

const overallStatus = isBlocked ? 'BLOCKED' : 'READY';
console.log(`PROJECT BOOT STATUS: ${overallStatus}\n`);
process.exit(isBlocked ? 1 : 0);
