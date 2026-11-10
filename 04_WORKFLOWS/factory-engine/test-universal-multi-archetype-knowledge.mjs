/**
 * AI-Builder-Brain Multi-Archetype & Brain Knowledge Injection Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-universal-multi-archetype-knowledge.mjs
 * Purpose: Empirically verifies that:
 *          1. Universal Code Assembler dynamically detects and constructs distinct archetypes:
 *             - CACHE_STORE (In-memory TTL cache with LRU eviction)
 *             - HEADLESS_API (RESTful router with RFC 7807 Problem Details)
 *             - CLI_TOOL (Command parser with flag handling and help generation)
 *             - CONTENT_ENGINE (Publishing engine with slugification and reading time)
 *          2. Master Brain Intelligence is explicitly queried, synthesized, and cited:
 *             - Rule 1670 (Negative Scope & Boundary Inversion)
 *             - Rule 1708 (Empirical Sandbox Verification)
 *             - Rule 1713 (Universal Construction Contract Traceability)
 *             - Rule 1715 (Universal Feedback & Learning Evolution)
 *             - Cross-Domain Guidelines from Domains A through M
 *          3. Every constructed archetype runs in an isolated sandbox and passes with Exit Code 0.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  detectCodeArchetype,
  constructUniversalProduct
} from './universal-code-assembler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_BASE = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'multi-archetype-test');

console.log('======================================================================');
console.log('🧠 TEST SUITE: MULTI-ARCHETYPE & MASTER BRAIN KNOWLEDGE INJECTION');
console.log('======================================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? ': ' + details : ''}`);
    failedTests++;
  }
}

async function runArchetypeTest(archetypeKey, goal, projectName) {
  console.log(`\n--- Testing Archetype: [${archetypeKey}] ---`);
  const targetDir = path.join(SANDBOX_BASE, archetypeKey.toLowerCase());
  
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const result = constructUniversalProduct(goal, targetDir, {
    name: projectName,
    language: 'javascript',
    brainRoot: BRAIN_ROOT
  });

  // 1. Archetype Classification
  assert(result.assemblyResult.archetype === archetypeKey, `Correctly classified as ${archetypeKey}`);
  assert(result.assemblyResult.brain_connected === true, 'Brain connected flag is TRUE');

  // 2. Brain Knowledge Manifest Verification
  const brainManifestPath = path.join(targetDir, 'src', 'core', 'brain-knowledge-manifest.json');
  assert(fs.existsSync(brainManifestPath), 'brain-knowledge-manifest.json exists');
  const brainManifest = JSON.parse(fs.readFileSync(brainManifestPath, 'utf-8'));
  assert(brainManifest.brain_connected === true, 'Brain manifest tracks active brain connection');
  assert(brainManifest.governing_rules.some(r => r.rule === 'Rule 1670'), 'Cites Rule 1670 Negative Scope Invariant');
  assert(brainManifest.governing_rules.some(r => r.rule === 'Rule 1708'), 'Cites Rule 1708 Empirical Verification');
  assert(brainManifest.governing_rules.some(r => r.rule === 'Rule 1713'), 'Cites Rule 1713 Contract Traceability');
  assert(brainManifest.applied_domain_letters.includes('G'), 'Applied Domain G (Architecture)');
  assert(brainManifest.applied_domain_letters.includes('H'), 'Applied Domain H (Technical Construction)');

  // 3. README Knowledge Citations
  const readmeContent = fs.readFileSync(path.join(targetDir, 'README.md'), 'utf-8');
  assert(readmeContent.includes('## 🧠 Master Brain Intelligence Applied'), 'README contains Master Brain Intelligence section');
  assert(readmeContent.includes('Rule 1670'), 'README cites Rule 1670');
  assert(readmeContent.includes('Rule 1708'), 'README cites Rule 1708');

  // 4. Live Sandbox Test Execution
  const verification = result.verificationResult;
  assert(verification.executed === true, 'Live test runner executed in sandbox');
  assert(verification.exitCode === 0, `All tests passed strictly with Exit Code 0 (Duration: ${verification.durationMs}ms)`);
  assert(verification.verified === true, 'Archetype verified state is TRUE');

  // Clean up
  fs.rmSync(targetDir, { recursive: true, force: true });
}

async function main() {
  try {
    if (fs.existsSync(SANDBOX_BASE)) {
      fs.rmSync(SANDBOX_BASE, { recursive: true, force: true });
    }
    fs.mkdirSync(SANDBOX_BASE, { recursive: true });

    // Archetype 1: CACHE_STORE
    await runArchetypeTest(
      'CACHE_STORE',
      'Build a high-performance in-memory key-value cache with TTL eviction',
      'QuickCache'
    );

    // Archetype 2: HEADLESS_API
    await runArchetypeTest(
      'HEADLESS_API',
      'Build a headless RESTful API router with RFC 7807 problem details',
      'NexusRouter'
    );

    // Archetype 3: CLI_TOOL
    await runArchetypeTest(
      'CLI_TOOL',
      'Build a CLI tool command dispatcher with argument parsing and help flags',
      'ToolCraft'
    );

    // Archetype 4: CONTENT_ENGINE
    await runArchetypeTest(
      'CONTENT_ENGINE',
      'Build a markdown content publisher and blog editorial engine',
      'ChronicleCMS'
    );

    // Clean up base
    fs.rmSync(SANDBOX_BASE, { recursive: true, force: true });
    console.log('\n🧹 [CLEANUP] Multi-archetype test sandbox purged cleanly.');

  } catch (err) {
    console.error('\n❌ Unexpected error:', err);
    failedTests++;
  }

  console.log('\n======================================================================');
  console.log(`🏁 MULTI-ARCHETYPE TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();

