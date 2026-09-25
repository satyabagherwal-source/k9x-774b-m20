#!/usr/bin/env node

/**
 * AI-Builder-Brain Native Project Factory Bootstrap Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\bootstrap.mjs
 * Purpose: Single-command deterministic bootstrap engine for new projects.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { resolveMasterBrainPath, inspectMasterBrain } from './brain-bridge.mjs';
import { checkEnvironment } from './env-checker.mjs';
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
const skipInstall = args.includes('--skip-install');
const skipGit = args.includes('--skip-git');

async function runBootstrap() {
  console.log(`\n============================================================`);
  console.log(`⚡ AI-BUILDER-BRAIN: NATIVE PROJECT FACTORY BOOTSTRAP`);
  console.log(`============================================================`);
  console.log(`Target Directory : ${resolvedTarget}`);
  console.log(`Project Name     : ${projectName}`);
  console.log(`Timestamp        : ${new Date().toISOString()}`);
  console.log(`------------------------------------------------------------\n`);

  // Step 1: Discover & Inspect Master Brain
  console.log(`[1/8] 🔍 Discovering Master AI-Builder-Brain...`);
  const brainPath = resolveMasterBrainPath();
  const brainAudit = inspectMasterBrain(brainPath);

  if (!brainAudit.connected) {
    console.error(`❌ FATAL: Canonical AI-Builder-Brain not found!`);
    process.exit(1);
  }
  console.log(`   ✅ Master Brain connected: ${brainPath}`);
  console.log(`   ✅ Verified ${brainAudit.presentFolders}/${brainAudit.totalFolders} canonical directories.`);

  // Step 2: Environment Pre-flight
  console.log(`\n[2/8] 💻 Checking System Environment...`);
  const env = checkEnvironment();
  console.log(`   Node.js : ${env.tools.node.version || 'NOT FOUND'} (${env.tools.node.status})`);
  console.log(`   npm     : ${env.tools.npm.version || 'NOT FOUND'} (${env.tools.npm.status})`);
  console.log(`   Git     : ${env.tools.git.version || 'NOT FOUND'} (${env.tools.git.status})`);
  console.log(`   GitHub  : ${env.tools.gh.status} (${env.tools.gh.details || 'N/A'})`);

  if (env.status === 'BLOCKED') {
    console.error(`❌ FATAL: Environment requirements not satisfied:`, env.errors);
    process.exit(1);
  }

  // Step 3: Scaffold Project from Golden Blueprint
  console.log(`\n[3/8] 🏗️ Scaffolding Project Structure from Golden Blueprint...`);
  const scaffoldResult = scaffoldProject(resolvedTarget, projectName, {
    masterBrainPath: brainPath,
    skipInstall: true // We control install explicitly next
  });
  console.log(`   ✅ Emitted ${scaffoldResult.filesCreated} files (Astro 5 + Tailwind v4 + Vercel + Design System).`);

  // Step 4: Establish Brain Bridge
  console.log(`\n[4/8] 🌉 Verifying Zero-Copy Brain Bridge...`);
  const bridgeFile = path.join(resolvedTarget, '.project-brain', 'brain-bridge.json');
  if (fs.existsSync(bridgeFile)) {
    console.log(`   ✅ Brain Bridge established at .project-brain/brain-bridge.json`);
    console.log(`   ✅ Strict read-only boundary enforced for Master Brain.`);
  }

  // Step 5: Install Dependencies
  if (!skipInstall) {
    console.log(`\n[5/8] 📦 Installing Dependencies (astro, tailwindcss, @tailwindcss/vite)...`);
    const { execSync } = await import('child_process');
    try {
      execSync('npm install', {
        cwd: resolvedTarget,
        stdio: 'inherit'
      });
      console.log(`   ✅ Dependencies installed successfully.`);
    } catch (err) {
      console.error(`   ⚠️ Dependency installation had issues: ${err.message}`);
    }
  } else {
    console.log(`\n[5/8] 📦 Skipping dependency installation (--skip-install).`);
  }

  // Step 6: Git Initialization & Initial Commit
  if (!skipGit) {
    console.log(`\n[6/8] 🌿 Initializing Independent Git Repository...`);
    const gitResult = setupGitRepository(resolvedTarget, projectName, {
      remoteUrl: getArg('--git-remote', null),
      createGhRepo: false // Safe default: do not auto-create remote unless authorized
    });
    console.log(`   Git Init : ${gitResult.initialized ? '✅ Initialized' : 'ℹ️ Already initialized'}`);
    console.log(`   Commit   : ${gitResult.committed ? '✅ Initial commit created' : 'ℹ️ ' + (gitResult.commitOutput || 'Clean')}`);
  } else {
    console.log(`\n[6/8] 🌿 Skipping Git initialization (--skip-git).`);
  }

  // Step 7: Live Multi-Layer Verification
  console.log(`\n[7/8] 🧪 Executing 7-Pillar Live Multi-Layer Verification Suite...`);
  const verification = await runComprehensiveVerification(resolvedTarget);

  console.log(`\n   --- Verification Results ---`);
  for (const [pillar, data] of Object.entries(verification.pillars)) {
    const icon = data.status === 'PASS' ? '✅' : (data.status === 'PARTIAL' ? '⚠️' : '❌');
    console.log(`   ${icon} ${pillar.padEnd(22)}: ${data.status}`);
  }

  // Step 8: Ready Certification
  console.log(`\n[8/8] 📜 Generating PROJECT_READY_CERTIFICATE.md...`);
  const certPath = generateReadyCertificate(resolvedTarget, verification);
  console.log(`   ✅ Certificate written to: ${certPath}`);

  // Final Status
  console.log(`\n============================================================`);
  if (verification.overallStatus === 'READY') {
    console.log(`🎉 PROJECT STATUS: READY : CERTIFIED`);
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
