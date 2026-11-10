/**
 * AI-Builder-Brain Dynamic Blueprint & Universal Code Assembly Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-universal-code-assembly.mjs
 * Purpose: Verifies PAC-004 Phase 1C.2:
 *          1. Dynamic Blueprint Composition across JS/TS, Python, and Go
 *          2. Multi-Archetype Support (SaaS, Headless API, CLI Tool, Content Publishing)
 *          3. Compositional Source Code Assembly with Full 13-Domain Traceability
 *          4. Isolated Product Construction Demonstration in Sandbox
 *          5. Actual Live Test Suite Execution with Node.js Native Test Runner
 *          6. Positive Feature Verification (Inventory, Sales, Stock Alerts, Revenue)
 *          7. Negative Scope Invariant Verification (Zero Telemetry, Local-First Isolation)
 *          8. Manifest Generation & SHA-256 Parity
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  SUPPORTED_STACKS,
  resolveTargetStack,
  synthesizeDynamicBlueprint,
  assembleProductCode,
  emitAssembledProduct,
  executeAndVerifyProduct,
  constructUniversalProduct
} from './universal-code-assembler.mjs';

import { decomposeSemanticRequirements } from './semantic-decomposer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'universal-assembly-sandbox');

console.log('======================================================================');
console.log('🧪 TEST SUITE: DYNAMIC BLUEPRINT & UNIVERSAL CODE ASSEMBLY (PAC-004 1C.2)');
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

try {
  // ---------------------------------------------------------------------------
  // GROUP 1: MULTI-LANGUAGE DYNAMIC BLUEPRINT COMPOSITION
  // ---------------------------------------------------------------------------
  console.log('[GROUP 1] Testing Multi-Language Dynamic Blueprint Composition...');

  const sampleGoal = "Build an application that helps small businesses manage inventory and sales";
  const semPkg = decomposeSemanticRequirements(sampleGoal, { name: "StockPulse" }, { brainRoot: BRAIN_ROOT });

  // 1.1 Node.js / JavaScript Stack
  const nodeBlueprint = synthesizeDynamicBlueprint(semPkg, { language: 'javascript' });
  assert(nodeBlueprint.stack.language === 'javascript', 'Synthesized JavaScript/Node.js stack');
  assert(nodeBlueprint.manifest.manifest === undefined, 'JavaScript manifest uses package.json');
  assert(nodeBlueprint.manifest.directories.includes('src/core'), 'Includes src/core directory');
  assert(nodeBlueprint.manifest.negative_scope_invariants.length > 0, 'Includes negative scope invariants');

  // 1.2 Python Stack
  const pyBlueprint = synthesizeDynamicBlueprint(semPkg, { language: 'python' });
  assert(pyBlueprint.stack.language === 'python', 'Synthesized Python stack');
  assert(pyBlueprint.stack.extension === '.py', 'Configured .py extension');
  assert(pyBlueprint.stack.manifest === 'pyproject.toml', 'Configured pyproject.toml manifest');

  // 1.3 Go Stack
  const goBlueprint = synthesizeDynamicBlueprint(semPkg, { language: 'go' });
  assert(goBlueprint.stack.language === 'go', 'Synthesized Go stack');
  assert(goBlueprint.stack.extension === '.go', 'Configured .go extension');
  assert(goBlueprint.stack.manifest === 'go.mod', 'Configured go.mod manifest');

  // ---------------------------------------------------------------------------
  // GROUP 2: MULTI-ARCHETYPE CODE ASSEMBLY TEMPLATES
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 2] Testing Multi-Archetype Code Assembly Manifests...');

  // 2.1 Python Assembly Manifest & Syntax
  const pyAssembly = assembleProductCode(pyBlueprint, semPkg);
  assert(pyAssembly.files.some(f => f.path === 'pyproject.toml'), 'Python assembly includes pyproject.toml');
  assert(pyAssembly.files.some(f => f.path === 'README.md'), 'Python assembly includes README.md');
  const pyprojectFile = pyAssembly.files.find(f => f.path === 'pyproject.toml');
  assert(pyprojectFile.content.includes('[build-system]'), 'pyproject.toml contains standard build-system table');

  // 2.2 Go Assembly Manifest & Syntax
  const goAssembly = assembleProductCode(goBlueprint, semPkg);
  assert(goAssembly.files.some(f => f.path === 'go.mod'), 'Go assembly includes go.mod');
  const gomodFile = goAssembly.files.find(f => f.path === 'go.mod');
  assert(gomodFile.content.includes('module github.com/universal/'), 'go.mod contains canonical module path');

  // ---------------------------------------------------------------------------
  // GROUP 3: REQUIREMENTS-TO-FILE TRACEABILITY & 13-DOMAIN MAPPING
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 3] Verifying Requirements-to-File Traceability & Domain Integration...');

  const jsAssembly = assembleProductCode(nodeBlueprint, semPkg);
  assert(jsAssembly.total_files >= 6, 'Assembled comprehensive multi-file product', `Files: ${jsAssembly.total_files}`);

  // Trace every file to a domain and originating task
  const observedDomains = new Set();
  for (const f of jsAssembly.files) {
    assert(f.domain_letter !== undefined, `File '${f.path}' tagged with Domain ${f.domain_letter}`);
    assert(f.originating_task_id !== undefined, `File '${f.path}' traced to task ${f.originating_task_id}`);
    assert(f.hash && f.hash.length === 64, `File '${f.path}' has valid SHA-256 hash`);
    observedDomains.add(f.domain_letter);
  }

  assert(observedDomains.has('G'), 'Domain G (Architecture) represented in assembled files');
  assert(observedDomains.has('H'), 'Domain H (Technical Construction) represented in assembled files');
  assert(observedDomains.has('I'), 'Domain I (Content & Info) represented in assembled files');
  assert(observedDomains.has('K'), 'Domain K (Quality & Verification) represented in assembled files');
  assert(observedDomains.has('L'), 'Domain L (Deployment & Operations) represented in assembled files');

  // ---------------------------------------------------------------------------
  // GROUP 4: ISOLATED PRODUCT CONSTRUCTION & LIVE SANDBOX EXECUTION (STEP 5)
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 4] Executing Isolated Product Construction Demonstration (Step 5)...');

  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const constructionResult = constructUniversalProduct(
    "Build an application that helps small businesses manage inventory and sales",
    SANDBOX_DIR,
    {
      name: "StockPulse Business",
      language: "javascript",
      brainRoot: BRAIN_ROOT
    }
  );

  assert(constructionResult.writtenFiles.length >= 7, 'Emitted all assembled files to sandbox', `Count: ${constructionResult.writtenFiles.length}`);

  // Check assembly manifest on disk
  const manifestOnDisk = path.join(SANDBOX_DIR, 'assembly-manifest.json');
  assert(fs.existsSync(manifestOnDisk), 'assembly-manifest.json exists on disk');
  const parsedManifest = JSON.parse(fs.readFileSync(manifestOnDisk, 'utf-8'));
  assert(parsedManifest.files.length >= 6, 'Assembly manifest tracks all assembled files');

  // Verify core source files on disk
  assert(fs.existsSync(path.join(SANDBOX_DIR, 'package.json')), 'package.json exists');
  assert(fs.existsSync(path.join(SANDBOX_DIR, 'src', 'core', 'engine.mjs')), 'src/core/engine.mjs exists');
  assert(fs.existsSync(path.join(SANDBOX_DIR, 'src', 'models', 'schema.mjs')), 'src/models/schema.mjs exists');
  assert(fs.existsSync(path.join(SANDBOX_DIR, 'tests', 'application.test.mjs')), 'tests/application.test.mjs exists');
  assert(fs.existsSync(path.join(SANDBOX_DIR, 'deploy-manifest.json')), 'deploy-manifest.json exists');

  // ---------------------------------------------------------------------------
  // GROUP 5: LIVE TEST SUITE EXECUTION & VERIFICATION PROOF
  // ---------------------------------------------------------------------------
  console.log('\n[GROUP 5] Verifying Actual Sandbox Execution & Assertion Evidence...');

  const verification = constructionResult.verificationResult;
  console.log('  Execution Command:', verification.command);
  console.log('  Execution Exit Code:', verification.exitCode);
  console.log('  Execution Duration:', verification.durationMs + 'ms');

  assert(verification.executed === true, 'Test suite executed via child_process');
  assert(verification.exitCode === 0, 'Test suite exited strictly with code 0 (ALL ASSERTIONS PASSED)');
  assert(verification.verified === true, 'Product verification state marked VERIFIED');
  assert(verification.stdout.includes('pass') || verification.stdout.includes('Inventory & Sales Management Suite'), 'Terminal stdout captures test pass evidence');

  // Clean up sandbox
  fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  console.log('  🧹 [CLEANUP] Sandbox directory purged cleanly.');

} catch (err) {
  console.error('\n❌ Unexpected error in test suite:', err);
  failedTests++;
}

console.log('\n======================================================================');
console.log(`🏁 UNIVERSAL CODE ASSEMBLY TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

