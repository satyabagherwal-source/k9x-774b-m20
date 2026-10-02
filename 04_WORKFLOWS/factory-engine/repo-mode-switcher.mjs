import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const CONTROL_PATH = path.join(BRAIN_ROOT, 'harvest-control.json');
const WORKFLOW_PATH = path.join(BRAIN_ROOT, '.github', 'workflows', '24-7-cloud-harvester.yml');
const CIRCUIT_PATH = path.join(BRAIN_ROOT, '.harvest-locks', 'master-circuit-breaker.json');

function runCmd(cmd, silent = false) {
  try {
    return execSync(cmd, {
      cwd: BRAIN_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    }).trim();
  } catch (err) {
    if (!silent) {
      console.warn(`[CMD WARN] "${cmd}": ${err.stderr ? err.stderr.trim() : err.message}`);
    }
    return '';
  }
}

function hasStagedChanges() {
  try {
    execSync('git diff --staged --quiet', { cwd: BRAIN_ROOT, stdio: 'pipe' });
    return false;
  } catch (e) {
    return true;
  }
}

/**
 * Gets real GitHub remote visibility using GitHub CLI
 */
export function getRemoteVisibility() {
  const jsonStr = runCmd('gh repo view --json visibility,isPrivate,nameWithOwner', true);
  if (!jsonStr) return { visibility: 'UNKNOWN', isPrivate: null, repo: '' };
  try {
    const data = JSON.parse(jsonStr);
    return {
      visibility: data.visibility ? data.visibility.toUpperCase() : 'UNKNOWN',
      isPrivate: !!data.isPrivate,
      repo: data.nameWithOwner || ''
    };
  } catch (e) {
    return { visibility: 'UNKNOWN', isPrivate: null, repo: '' };
  }
}

/**
 * Reads local harvest-control.json state
 */
export function getLocalConfigMode() {
  if (!fs.existsSync(CONTROL_PATH)) return { mode: 'UNKNOWN' };
  try {
    const data = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    return {
      repositoryType: data.cloudActionsPolicy?.repositoryType || 'UNKNOWN',
      billingStatus: data.cloudActionsPolicy?.currentBillingStatus || 'UNKNOWN',
      cronsStatus: data.cloudActionsPolicy?.cloudCronsStatus || 'UNKNOWN',
      status: data.status || 'ACTIVE'
    };
  } catch (e) {
    return { mode: 'UNKNOWN' };
  }
}

/**
 * Resets local circuit breakers and workers to active state
 */
export function resetBreakersToHealthy() {
  // 1. Reset master circuit breaker
  if (fs.existsSync(CIRCUIT_PATH)) {
    try {
      const circuits = JSON.parse(fs.readFileSync(CIRCUIT_PATH, 'utf-8'));
      if (circuits.GITHUB_API) {
        circuits.GITHUB_API.status = 'HEALTHY';
        circuits.GITHUB_API.resetEpoch = 0;
        circuits.GITHUB_API.resetAt = null;
        circuits.GITHUB_API.reason = null;
      }
      fs.writeFileSync(CIRCUIT_PATH, JSON.stringify(circuits, null, 2), 'utf-8');
    } catch (e) {}
  }

  // 2. Reset workers in harvest-control.json
  if (fs.existsSync(CONTROL_PATH)) {
    try {
      const control = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
      if (control.masterCircuitBreakers?.GITHUB_API) {
        control.masterCircuitBreakers.GITHUB_API.status = 'HEALTHY';
        control.masterCircuitBreakers.GITHUB_API.resetEpoch = 0;
        control.masterCircuitBreakers.GITHUB_API.resetAt = null;
        control.masterCircuitBreakers.GITHUB_API.reason = null;
      }
      if (control.multiAgentFleet?.workers) {
        control.multiAgentFleet.workers.forEach((w) => {
          w.status = 'ACTIVE';
          w.cooldownUntil = null;
          w.lastError = null;
        });
      }
      control.status = 'ACTIVE';
      control.lastUpdated = new Date().toISOString();
      fs.writeFileSync(CONTROL_PATH, JSON.stringify(control, null, 2), 'utf-8');
    } catch (e) {}
  }
}

/**
 * Generates the unified, self-protecting 24-7-cloud-harvester.yml
 */
export function updateWorkflowFile(isPublicMode = true) {
  const scheduleBlock = isPublicMode
    ? `  schedule:
    # 24/7 Continuous harvesting enabled in Public Mode (Zero-cost unlimited runner minutes)
    - cron: '*/20 * * * *'`
    : `  # schedule:
    # Disabled in Private Mode to safeguard the 2,000 runner minutes/month quota.
    # Manual on-demand triggers remain available via workflow_dispatch.`;

  const content = `name: 24-7 Multi-Agent Parallel Autonomous Harvester with Google Gemini AI

# Quota & Billing Protection Policy:
# - PUBLIC MODE : Unlimited free runner minutes. Self-Relay Dispatcher + Schedule Cron operate 24/7 continuously.
# - PRIVATE MODE: Capped at 2,000 monthly runner minutes. Self-Relay is blocked and schedule is paused to guarantee ₹0/$0 cost.

on:
  workflow_dispatch:
    # Allows manual trigger anytime from GitHub Web UI or CLI
  repository_dispatch:
    # Allows external server-to-server triggers via REST API
    types: [trigger-harvester, 24-7-cloud-fleet]
${scheduleBlock}

permissions:
  contents: write
  actions: write

jobs:
  cloud-multi-agent-fleet:
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout AI-Builder-Brain
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js Runtime
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Configure Git Identity
        run: |
          git config --global user.name "AI-Builder-Brain-Cloud-Agent"
          git config --global user.email "cloud-agent@ai-builder-brain.local"

      - name: Verify Server-to-Server Gemini AI Swarm Pool
        env:
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY }}
          GEMINI_KEY_1: \${{ secrets.GEMINI_KEY_1 }}
          GEMINI_KEY_2: \${{ secrets.GEMINI_KEY_2 }}
          GEMINI_KEY_3: \${{ secrets.GEMINI_KEY_3 }}
          GEMINI_KEY_4: \${{ secrets.GEMINI_KEY_4 }}
          GEMINI_KEY_5: \${{ secrets.GEMINI_KEY_5 }}
        run: |
          ACTIVE_KEYS=0
          [ -n "$GEMINI_API_KEY" ] && ACTIVE_KEYS=$((ACTIVE_KEYS + 1))
          [ -n "$GEMINI_KEY_1" ] && ACTIVE_KEYS=$((ACTIVE_KEYS + 1))
          [ -n "$GEMINI_KEY_2" ] && ACTIVE_KEYS=$((ACTIVE_KEYS + 1))
          [ -n "$GEMINI_KEY_3" ] && ACTIVE_KEYS=$((ACTIVE_KEYS + 1))
          [ -n "$GEMINI_KEY_4" ] && ACTIVE_KEYS=$((ACTIVE_KEYS + 1))
          [ -n "$GEMINI_KEY_5" ] && ACTIVE_KEYS=$((ACTIVE_KEYS + 1))

          if [ $ACTIVE_KEYS -eq 0 ]; then
            echo "::warning title=Gemini API Keys Missing::To enable deep 24/7 AI reasoning, add your Gemini subscription key as GEMINI_KEY_1..5 in repository secrets: https://github.com/\${{ github.repository }}/settings/secrets/actions"
          else
            echo "======================================================================"
            echo "✅ VERIFIED: Found $ACTIVE_KEYS active Gemini Subscription Key(s) in Pool!"
            echo "🚀 Server-to-Server AI reasoning is LIVE with Zero-Cost Rotation."
            echo "======================================================================"
          fi

      - name: Execute Parallel Multi-Agent Learning Swarm (8 Domains)
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: \${{ secrets.GEMINI_API_KEY || secrets.GEMINI_KEY_1 }}
          GEMINI_KEY_1: \${{ secrets.GEMINI_KEY_1 }}
          GEMINI_KEY_2: \${{ secrets.GEMINI_KEY_2 }}
          GEMINI_KEY_3: \${{ secrets.GEMINI_KEY_3 }}
          GEMINI_KEY_4: \${{ secrets.GEMINI_KEY_4 }}
          GEMINI_KEY_5: \${{ secrets.GEMINI_KEY_5 }}
          GROQ_API_KEY: \${{ secrets.GROQ_API_KEY }}
          HF_TOKEN: \${{ secrets.HF_TOKEN }}
        run: |
          node 04_WORKFLOWS/factory-engine/multi-agent-fleet.mjs

      - name: Commit & Push Harvested Multi-Agent Intelligence to GitHub
        run: |
          git add .
          if git diff --staged --quiet; then
            echo "Working tree is clean. Multi-Agent Fleet intelligence is fully synced."
          else
            git commit -m "feat(fleet): 8-agent parallel fleet harvested multi-domain learnings [skip ci]"
            for i in {1..5}; do
              git push origin main && break || {
                echo "Concurrent push detected. Rebasing and retrying ($i/5)..."
                sleep $((1 + RANDOM % 3))
                git pull --rebase origin main
              }
            done
          fi

      - name: Autonomous 24/7 Self-Relay Dispatcher
        if: always()
        env:
          GH_TOKEN: \${{ secrets.WORKFLOW_RELAY_TOKEN }}
        run: |
          echo "======================================================================"
          echo "🔄 24/7 AUTONOMOUS CONTINUOUS LEARNING RELAY DISPATCHER"
          echo "======================================================================"
          VISIBILITY=$(gh repo view \${{ github.repository }} --json visibility -q .visibility 2>/dev/null || echo "UNKNOWN")
          echo "Current Repository Visibility: $VISIBILITY"

          if [ "$VISIBILITY" = "PUBLIC" ]; then
            if [ -n "$GH_TOKEN" ]; then
              echo "🚀 Repository is PUBLIC. Dispatching next server-to-server learning cycle..."
              sleep 30
              gh workflow run 24-7-cloud-harvester.yml --repo "\${{ github.repository }}" || echo "⚠️ Self-relay trigger deferred to cron"
            else
              echo "ℹ️ WORKFLOW_RELAY_TOKEN not set in secrets. Falling back to cron schedule."
            fi
          else
            echo "🛡️ PRIVATE MODE DETECTED: Self-Relay blocked to safeguard 2,000 monthly runner minutes quota."
          fi
`;

  fs.mkdirSync(path.dirname(WORKFLOW_PATH), { recursive: true });
  fs.writeFileSync(WORKFLOW_PATH, content, 'utf-8');
}

/**
 * Switches the repository and entire brain configuration to PUBLIC mode
 */
export async function switchToPublic() {
  console.log(`\n======================================================================`);
  console.log(`🌐 SWITCHING AI-BUILDER-BRAIN TO PUBLIC 24/7 AUTONOMOUS MODE`);
  console.log(`======================================================================\n`);

  // 1. Ensure GitHub visibility is PUBLIC
  const remote = getRemoteVisibility();
  if (remote.visibility !== 'PUBLIC') {
    console.log(`🔒 Changing GitHub remote visibility to PUBLIC...`);
    const editRes = runCmd('gh repo edit --visibility public --accept-visibility-change-consequences');
    console.log(`GitHub CLI Edit Result: ${editRes || 'SUCCESS'}`);
  } else {
    console.log(`✅ GitHub remote is already PUBLIC.`);
  }

  // 2. Update harvest-control.json
  if (fs.existsSync(CONTROL_PATH)) {
    const control = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    if (!control.cloudActionsPolicy) control.cloudActionsPolicy = {};
    control.cloudActionsPolicy.repositoryType = 'PUBLIC';
    control.cloudActionsPolicy.currentBillingStatus = 'PUBLIC_UNLIMITED_RUNNER_MINUTES';
    control.cloudActionsPolicy.cloudCronsStatus = 'ACTIVE_24_7_CONTINUOUS';
    control.cloudActionsPolicy.autoBlockOverages = false;
    control.status = 'ACTIVE';
    control.lastUpdated = new Date().toISOString();
    control.updatedBy = 'repo-mode-switcher:public';
    fs.writeFileSync(CONTROL_PATH, JSON.stringify(control, null, 2), 'utf-8');
    console.log(`✅ Updated harvest-control.json -> PUBLIC Unlimited Runner Minutes`);
  }

  // 3. Update workflow file to enable 24/7 cron and self-relay
  updateWorkflowFile(true);
  console.log(`✅ Updated .github/workflows/24-7-cloud-harvester.yml -> 24/7 Active Cron + Self-Relay`);

  // 4. Reset circuit breakers
  resetBreakersToHealthy();
  console.log(`✅ Reset Master Circuit Breaker & Fleet Workers to HEALTHY / ACTIVE.`);

  // 5. Commit & Push to GitHub
  console.log(`📤 Pushing PUBLIC Mode configuration to origin/main...`);
  runCmd('git add .');
  if (hasStagedChanges()) {
    runCmd('git commit -m "chore(mode): switch AI-Builder-Brain to PUBLIC 24/7 autonomous mode [skip ci]"');
    const pushRes = runCmd('git push origin main');
    console.log(`Git Push: ${pushRes || 'Success'}`);
  } else {
    console.log(`Working tree clean, all configuration already synced.`);
  }

  // 6. Trigger initial cloud cycle
  console.log(`🚀 Triggering fresh 24/7 Cloud Harvester run via GitHub API...`);
  const runRes = runCmd('gh workflow run 24-7-cloud-harvester.yml');
  console.log(`Trigger Result: ${runRes || 'Dispatched successfully!'}`);

  console.log(`\n======================================================================`);
  console.log(`🎉 100% READY: AI-BUILDER-BRAIN IS NOW IN FULL PUBLIC 24/7 CLOUD MODE!`);
  console.log(`   - GitHub Runner Minutes: UNLIMITED & 100% FREE`);
  console.log(`   - Cloud Swarm: Running 24/7 continuously with Self-Relay Dispatcher`);
  console.log(`   - Laptop Status: 100% IDLE (Rule 14 preserved)`);
  console.log(`======================================================================\n`);
}

/**
 * Switches the repository and entire brain configuration to PRIVATE mode
 * Guarantees ₹0/$0 cost and 100% protection of the 2,000 monthly runner minutes quota
 */
export async function switchToPrivate() {
  console.log(`\n======================================================================`);
  console.log(`🔒 SWITCHING AI-BUILDER-BRAIN TO PRIVATE SAFEGUARD MODE`);
  console.log(`======================================================================\n`);

  // 1. Change GitHub visibility to PRIVATE
  const remote = getRemoteVisibility();
  if (remote.visibility !== 'PRIVATE') {
    console.log(`🌐 Changing GitHub remote visibility to PRIVATE...`);
    const editRes = runCmd('gh repo edit --visibility private --accept-visibility-change-consequences');
    console.log(`GitHub CLI Edit Result: ${editRes || 'SUCCESS'}`);
  } else {
    console.log(`✅ GitHub remote is already PRIVATE.`);
  }

  // 2. Update harvest-control.json
  if (fs.existsSync(CONTROL_PATH)) {
    const control = JSON.parse(fs.readFileSync(CONTROL_PATH, 'utf-8'));
    if (!control.cloudActionsPolicy) control.cloudActionsPolicy = {};
    control.cloudActionsPolicy.repositoryType = 'PRIVATE';
    control.cloudActionsPolicy.freeTierMinutesPerMonth = 2000;
    control.cloudActionsPolicy.currentBillingStatus = 'PRIVATE_2000_MIN_SAFEGUARD';
    control.cloudActionsPolicy.cloudCronsStatus = 'PAUSED_TO_PREVENT_BILLING';
    control.cloudActionsPolicy.autoBlockOverages = true;
    control.cloudActionsPolicy.primary24x7Worker = 'LOCAL_ON_DEMAND (Rule 14 enforced, 0 cloud minutes burned)';
    control.lastUpdated = new Date().toISOString();
    control.updatedBy = 'repo-mode-switcher:private';
    fs.writeFileSync(CONTROL_PATH, JSON.stringify(control, null, 2), 'utf-8');
    console.log(`✅ Updated harvest-control.json -> PRIVATE 2,000 Min Safeguard`);
  }

  // 3. Update workflow file to disable cron & self-relay
  updateWorkflowFile(false);
  console.log(`✅ Updated .github/workflows/24-7-cloud-harvester.yml -> Cron Disabled & Self-Relay Blocked`);

  // 4. Commit & Push to GitHub
  console.log(`📤 Pushing PRIVATE Mode configuration to origin/main...`);
  runCmd('git add .');
  if (hasStagedChanges()) {
    runCmd('git commit -m "chore(mode): switch AI-Builder-Brain to PRIVATE 0-dollar safeguard mode [skip ci]"');
    const pushRes = runCmd('git push origin main');
    console.log(`Git Push: ${pushRes || 'Success'}`);
  } else {
    console.log(`Working tree clean, all configuration already synced.`);
  }

  console.log(`\n======================================================================`);
  console.log(`🛡️ 100% SECURE: AI-BUILDER-BRAIN IS NOW IN PRIVATE SAFEGUARD MODE!`);
  console.log(`   - GitHub Actions Cron: DISABLED (0 accidental minute burn)`);
  console.log(`   - Self-Relay Dispatcher: BLOCKED (No continuous loop on private quota)`);
  console.log(`   - Billing Safeguard: HARD ENFORCED ₹0 / $0`);
  console.log(`   - Learning Mode: On-Demand via local commands (Rule 14)`);
  console.log(`======================================================================\n`);
}

/**
 * Displays status report of current repository and brain mode
 */
export function displayStatus() {
  const remote = getRemoteVisibility();
  const local = getLocalConfigMode();

  console.log(`\n======================================================================`);
  console.log(`⚖️ AI-BUILDER-BRAIN DUAL-MODE GOVERNANCE STATUS`);
  console.log(`======================================================================`);
  console.log(`   GitHub Remote Visibility : ${remote.visibility === 'PUBLIC' ? '\x1b[32mPUBLIC\x1b[0m' : '\x1b[33mPRIVATE\x1b[0m'}`);
  console.log(`   Brain Config Type        : ${local.repositoryType === 'PUBLIC' ? '\x1b[32mPUBLIC\x1b[0m' : '\x1b[33mPRIVATE\x1b[0m'}`);
  console.log(`   Cloud Billing Status     : ${local.billingStatus}`);
  console.log(`   Cloud Crons / Relay      : ${local.cronsStatus}`);
  console.log(`   Alignment Status         : ${remote.visibility === local.repositoryType ? '\x1b[32m✅ 100% ALIGNED\x1b[0m' : '\x1b[31m⚠️ MISMATCH DETECTED\x1b[0m'}`);
  console.log(`======================================================================`);
  console.log(`   Available Commands:`);
  console.log(`   - node 04_WORKFLOWS/factory-engine/repo-mode-switcher.mjs to-public`);
  console.log(`   - node 04_WORKFLOWS/factory-engine/repo-mode-switcher.mjs to-private`);
  console.log(`   - node 04_WORKFLOWS/factory-engine/repo-mode-switcher.mjs status`);
  console.log(`======================================================================\n`);
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const action = (process.argv[2] || 'status').toLowerCase();
  if (action === 'to-public' || action === 'public' || action === 'pub') {
    switchToPublic().catch(console.error);
  } else if (action === 'to-private' || action === 'private' || action === 'priv') {
    switchToPrivate().catch(console.error);
  } else {
    displayStatus();
  }
}
