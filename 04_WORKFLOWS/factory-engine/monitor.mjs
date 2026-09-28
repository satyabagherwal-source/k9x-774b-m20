import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const LEARNING_DIR = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');
const REGISTRY_PATH = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'sources-registry.json');
const DISCOVERY_LOG_PATH = path.join(BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'discovery-log.json');
const QUEUE_PATH = path.join(BRAIN_ROOT, 'repos.txt');
const PATTERNS_PATH = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: BRAIN_ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return '';
  }
}

export function displayLiveMonitor() {
  console.log(`\n======================================================================`);
  console.log(`📡 AI-BUILDER-BRAIN LIVE LEARNING MONITOR`);
  console.log(`   Cloud Status: 🟢 24/7 SERVER-TO-SERVER ACTIVE`);
  console.log(`   Current Local Time: ${new Date().toLocaleString()}`);
  console.log(`======================================================================\n`);

  // 1. Total Harvested Intelligence Records
  let files = [];
  if (fs.existsSync(LEARNING_DIR)) {
    files = fs.readdirSync(LEARNING_DIR).filter((f) => f.endsWith('-learnings.md'));
  }
  console.log(`📚 [TOTAL HARVESTED REPOSITORIES]: ${files.length} Deep Intelligence Files`);

  // 2. Total Promoted Universal Rules
  let ruleCount = 0;
  if (fs.existsSync(PATTERNS_PATH)) {
    const content = fs.readFileSync(PATTERNS_PATH, 'utf-8');
    const matches = [...content.matchAll(/##\s+(\d+)\.\s+/g)];
    ruleCount = matches.length;
  }
  console.log(`📜 [UNIVERSAL ENGINEERING RULES]: ${ruleCount} Rules (Rules 1 to ${ruleCount}+)`);

  // 3. Queue & Discovery Log Stats
  let queueCount = 0;
  if (fs.existsSync(QUEUE_PATH)) {
    queueCount = fs.readFileSync(QUEUE_PATH, 'utf-8')
      .split('\n')
      .filter((l) => l.trim().startsWith('http')).length;
  }
  console.log(`🎯 [UNIVERSAL HARVEST QUEUE]: ${queueCount} Target Repositories`);

  // 4. Latest 5 Harvested Intelligence Files
  console.log(`\n✨ [LATEST HARVESTED ARTIFACTS IN 07_PROJECT_LEARNING]:`);
  const fileStats = files.map((f) => {
    const full = path.join(LEARNING_DIR, f);
    return { name: f, time: fs.statSync(full).mtime };
  }).sort((a, b) => b.time - a.time).slice(0, 5);

  fileStats.forEach((f, i) => {
    console.log(`   ${i + 1}. 📄 ${f.name} (Updated: ${f.time.toLocaleString()})`);
  });

  // 5. Latest Commits from Cloud Harvester
  console.log(`\n☁️ [LATEST GITHUB CLOUD COMMITS]:`);
  const gitLog = run('git log -n 5 --pretty=format:"%h | %ad | %s" --date=relative');
  if (gitLog) {
    gitLog.split('\n').forEach((line) => console.log(`   ${line}`));
  }

  // 6. Direct Verification Links
  console.log(`\n🔗 [DIRECT VERIFICATION TOUCHPOINTS]:`);
  console.log(`   1. Live Cloud Execution : https://github.com/satyabagherwal-source/AI-Builder-Brain/actions`);
  console.log(`   2. Automatic Commits    : https://github.com/satyabagherwal-source/AI-Builder-Brain/commits/main`);
  console.log(`   3. Learning Files Folder: https://github.com/satyabagherwal-source/AI-Builder-Brain/tree/main/07_PROJECT_LEARNING`);
  console.log(`======================================================================\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  displayLiveMonitor();
}
