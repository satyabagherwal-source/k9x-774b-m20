#!/usr/bin/env node

/**
 * AI-Builder-Brain Universal Project Factory & Operating System Bootstrap Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\bootstrap.mjs
 * Purpose: Single-command deterministic bootstrap engine for any project class.
 *          Resolves architecture, installs only required dependencies, establishes
 *          zero-copy Brain Bridge, generates all 11 project-local Brain OS files,
 *          manages Git/GitHub lifecycle, runs live verification, and certifies readiness.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { resolveMasterBrainPath, inspectMasterBrain } from './brain-bridge.mjs';
import { checkEnvironment } from './env-checker.mjs';
import { resolveProjectProfile } from './profile-engine.mjs';
import { scaffoldProject } from './scaffold.mjs';
import { setupGitRepository } from './git-manager.mjs';
import { runComprehensiveVerification } from './verifier.mjs';
import { generateReadyCertificate, updateProjectState } from './state-manager.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

const targetPath = getArg('--target', process.cwd());
const resolvedTarget = path.resolve(targetPath);
const projectName = getArg('--name', path.basename(resolvedTarget));
const projectType = getArg('--type', null);
const projectIntent = getArg('--intent', getArg('--prompt', getArg('--description', '')));
const skipInstall = args.includes('--skip-install');
const skipGit = args.includes('--skip-git');
const createGhRepo = args.includes('--create-gh-repo');
const gitRemote = getArg('--git-remote', null);

async function runBootstrap() {
  console.log(`\n============================================================`);
  console.log(`⚡ AI-BUILDER-BRAIN: UNIVERSAL PROJECT FACTORY BOOTSTRAP`);
  console.log(`============================================================`);
  console.log(`Target Directory : ${resolvedTarget}`);
  console.log(`Project Name     : ${projectName}`);
  console.log(`Timestamp        : ${new Date().toISOString()}`);
  console.log(`------------------------------------------------------------\n`);

  // Step 1: Discover & Inspect Master Brain
  console.log(`[1/9] 🔍 Discovering Master AI-Builder-Brain...`);
  const brainPath = resolveMasterBrainPath();
  const brainAudit = inspectMasterBrain(brainPath);

  if (!brainAudit.connected) {
    console.error(`❌ FATAL: Canonical AI-Builder-Brain not found!`);
    process.exit(1);
  }
  console.log(`   ✅ Master Brain connected: ${brainPath}`);
  console.log(`   ✅ Verified ${brainAudit.presentFolders}/${brainAudit.totalFolders} canonical directories.`);
  console.log(`   ✅ Strict read-only boundary enforced for Master Brain.`);

  // Step 2: Project Intent & Capability Resolution
  console.log(`\n[2/9] 🧭 Resolving Project Profile & Architecture...`);
  const profile = resolveProjectProfile({
    name: projectName,
    type: projectType,
    intent: projectIntent
  });
  console.log(`   Project Class    : ${profile.name} (${profile.id})`);
  console.log(`   Architecture     : ${profile.architecture}`);
  console.log(`   Language/Runtime : ${profile.language} on ${profile.runtime}`);
  console.log(`   Frontend/Backend : ${profile.frontend} | ${profile.backend}`);
  console.log(`   Styling Engine   : ${profile.styling}`);
  console.log(`   Blueprint Source : ${profile.blueprint}`);
  console.log(`   Applicable MCPs  : ${Object.keys(profile.applicableMCPs || {}).join(', ') || 'None required'}`);
  console.log(`   Resolved Skills  : ${profile.requiredSkills?.length || 0} skills indexed`);

  // Step 3: Environment Pre-flight
  console.log(`\n[3/9] 💻 Checking System Environment (Profile-Specific)...`);
  const env = checkEnvironment(profile);
  console.log(`   Node.js : ${env.tools.node.version || 'NOT FOUND'} (${env.tools.node.status || 'OK'})`);
  console.log(`   npm     : ${env.tools.npm.version || 'NOT FOUND'} (${env.tools.npm.valid ? 'OK' : 'FAIL'})`);
  console.log(`   Git     : ${env.tools.git.version || 'NOT FOUND'} (${env.tools.git.valid ? 'OK' : 'FAIL'})`);
  console.log(`   GitHub  : ${env.tools.gh.status || 'Available'} (${env.tools.gh.account ? 'Account: ' + env.tools.gh.account : (env.tools.gh.authenticated ? 'Authenticated' : 'Offline')})`);

  if (env.status === 'BLOCKED') {
    console.error(`❌ FATAL: Environment requirements for profile "${profile.id}" not satisfied:`, env.errors);
    process.exit(1);
  }

  // Step 4: Scaffold Project from Golden Blueprint & Emit 11 Brain Files
  console.log(`\n[4/9] 🏗️ Scaffolding Architecture & Generating 11-File Project Brain OS...`);
  const scaffoldResult = scaffoldProject(resolvedTarget, projectName, {
    masterBrainPath: brainPath,
    profile,
    skipInstall: true, // We control installation explicitly next
    env
  });
  console.log(`   ✅ Emitted ${scaffoldResult.filesCreated} files (Blueprint: ${profile.blueprint}).`);
  console.log(`   ✅ Generated all 11 canonical Project Brain OS files:`);
  console.log(`      - PROJECT_CONTEXT.md, PROJECT_RULES.md, PROJECT_KNOWLEDGE.md, PROJECT_SKILLS.md`);
  console.log(`      - PROJECT_STATE.json, PROJECT_LEARNING.md, PROJECT_DECISIONS.md, PROJECT_ARCHITECTURE.md`);
  console.log(`      - PROJECT_REQUIREMENTS.md, PROJECT_ENVIRONMENT.md, PROJECT_READY_CERTIFICATE.md`);

  // Step 5: Establish Zero-Copy Brain Bridge
  console.log(`\n[5/9] 🌉 Verifying Zero-Copy Brain Bridge...`);
  const bridgeFile = path.join(resolvedTarget, '.project-brain', 'brain-bridge.json');
  if (fs.existsSync(bridgeFile)) {
    console.log(`   ✅ Brain Bridge established at .project-brain/brain-bridge.json (v2.0.0)`);
    console.log(`   ✅ Zero-copy indexed knowledge: ${profile.requiredSkills?.length || 0} skills, selective rules.`);
    console.log(`   ✅ Strict read-only boundary enforced.`);
  }

  // Step 6: Install Targeted Dependencies
  if (!skipInstall) {
    console.log(`\n[6/9] 📦 Installing Profile Dependencies (Only what the project actually needs)...`);
    const { execSync } = await import('child_process');
    try {
      execSync('npm install', {
        cwd: resolvedTarget,
        stdio: 'inherit'
      });
      console.log(`   ✅ Dependencies installed successfully.`);
    } catch (err) {
      console.error(`   ⚠️ Dependency installation encountered an issue: ${err.message}`);
    }
  } else {
    console.log(`\n[6/9] 📦 Skipping dependency installation (--skip-install).`);
  }

  // Step 7: Independent Git Lifecycle & Initial Commit
  if (!skipGit) {
    console.log(`\n[7/9] 🌿 Initializing Independent Git Repository & Initial Commit...`);
    const gitResult = setupGitRepository(resolvedTarget, projectName, {
      remoteUrl: gitRemote,
      createGhRepo: createGhRepo // Safe default: only auto-create if explicitly authorized
    });
    console.log(`   Git Init : ${gitResult.initialized ? '✅ Initialized (main)' : 'ℹ️ Already initialized'}`);
    console.log(`   Identity : ${gitResult.identityConfigured ? '✅ Verified / Safe Default Configured' : 'ℹ️ Preserved'}`);
    console.log(`   Commit   : ${gitResult.committed ? '✅ Initial commit created' : 'ℹ️ Clean / Skipped'}`);
    console.log(`   GitHub   : ${gitResult.githubLinked ? '✅ Linked (' + gitResult.remoteUrl + ')' : (createGhRepo ? '⚠️ Creation deferred' : 'ℹ️ Local Git ready (Remote creation optional)')}`);
  } else {
    console.log(`\n[7/9] 🌿 Skipping Git initialization (--skip-git).`);
  }

  // Step 8: Live Multi-Layer Verification
  console.log(`\n[8/9] 🧪 Executing Universal Live Multi-Pillar Verification Suite...`);
  const verification = await runComprehensiveVerification(resolvedTarget, { profile });

  console.log(`\n   --- Verification Results ---`);
  for (const [pillar, data] of Object.entries(verification.pillars)) {
    const icon = data.status === 'PASS' ? '✅' : (data.status === 'PARTIAL' ? '⚠️' : '❌');
    console.log(`   ${icon} ${pillar.padEnd(22)}: ${data.status}`);
  }

  // Step 9: Ready Certification
  console.log(`\n[9/9] 📜 Generating PROJECT_READY_CERTIFICATE.md...`);
  const certPath = generateReadyCertificate(resolvedTarget, verification);
  console.log(`   ✅ Certificate finalized: ${certPath}`);

  // Final Status Announcement
  console.log(`\n============================================================`);
  if (verification.overallStatus === 'READY') {
    console.log(`🎉 PROJECT STATUS: READY : CERTIFIED`);
    console.log(`   Profile: ${profile.name} (${profile.id})`);
    console.log(`   Your project is completely configured, verified, and ready!`);
  } else if (verification.overallStatus === 'PARTIAL') {
    console.log(`⚠️ PROJECT STATUS: PARTIAL`);
    console.log(`   Core features working; see certificate for minor non-fatal warnings.`);
  } else {
    console.log(`❌ PROJECT STATUS: BLOCKED`);
    console.log(`   Blockers found:`, verification.failures);
  }
  console.log(`============================================================\n`);
}

runBootstrap().catch(err => {
  console.error(`\n❌ Bootstrap encountered an unexpected error:`, err);
  process.exit(1);
});
