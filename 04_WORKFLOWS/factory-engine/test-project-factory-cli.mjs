/**
 * AI-Builder-Brain Project Factory CLI Integration Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-project-factory-cli.mjs
 * Purpose: Verifies PAC-004 Phase 1C.3:
 *          1. CLI Argument Parsing & Option Mapping
 *          2. Input Validation (Missing Goal, Unsupported Stack, Safety Boundary Enforcement)
 *          3. Dry-Run / Preview Mode (Full 13-Domain Decomposition, Zero Disk Mutations)
 *          4. Multi-Stack Synthesis (JavaScript/Node.js, Python, Go)
 *          5. End-to-End Isolated Live Construction Demonstration:
 *             "Build a small-business inventory and sales management application"
 *          6. Multi-File Code Assembly & Packaging Manifest Verification
 *          7. Automated Test Runner Execution & Empirical Verification (Exit Code 0)
 *          8. CONSTRUCTION_VERIFICATION_REPORT.md Generation & Section Integrity
 *          9. Bootstrap Engine CLI Delegation (--construct / --build-product)
 *          10. Clean Sandbox Teardown & Isolation Invariants
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  parseCliArguments,
  validateCliOptions,
  executeProjectFactoryCli
} from './project-factory-cli.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'cli-e2e-inventory-test');

console.log('======================================================================');
console.log('🧪 TEST SUITE: PROJECT FACTORY CLI INTEGRATION (PAC-004 1C.3)');
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

async function runSuite() {
  try {
    // ---------------------------------------------------------------------------
    // GROUP 1: CLI ARGUMENT PARSING & NORMALIZATION
    // ---------------------------------------------------------------------------
    console.log('[GROUP 1] Testing CLI Argument Parsing...');

    const parsedA = parseCliArguments([
      '--goal', 'Build a personal finance dashboard',
      '--target', 'C:\\Sandbox\\FinApp',
      '--name', 'FinApp',
      '--stack', 'typescript',
      '--dry-run'
    ]);

    assert(parsedA.goal === 'Build a personal finance dashboard', 'Parses --goal correctly');
    assert(parsedA.target === 'C:\\Sandbox\\FinApp', 'Parses --target correctly');
    assert(parsedA.name === 'FinApp', 'Parses --name correctly');
    assert(parsedA.stack === 'typescript', 'Parses --stack correctly');
    assert(parsedA.dryRun === true, 'Parses --dry-run flag');
    assert(parsedA.skipTests === false, 'Defaults --skip-tests to false');

    // Test aliases and positionals
    const parsedB = parseCliArguments(['--intent', 'Create a fast JSON cache', '--preview', '--skip-tests', '--json']);
    assert(parsedB.goal === 'Create a fast JSON cache', 'Parses --intent alias as goal');
    assert(parsedB.dryRun === true, 'Parses --preview alias as dryRun');
    assert(parsedB.skipTests === true, 'Parses --skip-tests flag');
    assert(parsedB.json === true, 'Parses --json flag');

    // ---------------------------------------------------------------------------
    // GROUP 2: INPUT VALIDATION & SAFETY BOUNDARIES
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 2] Testing Input Validation & Master Brain Safety Invariants...');

    // Missing goal
    const valMissing = validateCliOptions(parseCliArguments([]));
    assert(valMissing.valid === false, 'Rejects empty input without goal');
    assert(valMissing.errors.some(e => e.includes('MISSING_GOAL')), 'Emits MISSING_GOAL error code');

    // Short / trivial goal
    const valShort = validateCliOptions(parseCliArguments(['--goal', 'hi']));
    assert(valShort.valid === false, 'Rejects goal with less than 5 characters');

    // Unsupported stack
    const valStack = validateCliOptions(parseCliArguments(['--goal', 'Valid goal for testing', '--stack', 'cobol']));
    assert(valStack.valid === false, 'Rejects unsupported stack');
    assert(valStack.errors.some(e => e.includes('UNSUPPORTED_STACK')), 'Emits UNSUPPORTED_STACK error code');

    // Safety violation: Attempting to point target directly at Master Brain root
    const valBrainRoot = validateCliOptions(parseCliArguments(['--goal', 'Valid goal for testing', '--target', BRAIN_ROOT]));
    assert(valBrainRoot.valid === false, 'Blocks targeting Master Brain root directory (SAFETY_VIOLATION)');
    assert(valBrainRoot.errors.some(e => e.includes('SAFETY_VIOLATION')), 'Emits SAFETY_VIOLATION error code');

    // ---------------------------------------------------------------------------
    // GROUP 3: DRY-RUN / PREVIEW EXECUTION (ZERO DISK WRITES)
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 3] Verifying Dry-Run Preview Mode & Zero Disk Mutations...');

    const dryRunResult = await executeProjectFactoryCli([
      '--goal', 'Build a real-time event streaming processor',
      '--dry-run',
      '--target', SANDBOX_DIR
    ], { brainRoot: BRAIN_ROOT });

    assert(dryRunResult.success === true, 'Dry-run returns success: true');
    assert(dryRunResult.status === 'DRY_RUN_PREVIEW', 'Dry-run returns DRY_RUN_PREVIEW status');
    assert(dryRunResult.semanticPackage !== undefined, 'Dry-run executes full semantic decomposition');
    assert(dryRunResult.dynamicBlueprint !== undefined, 'Dry-run synthesizes dynamic blueprint');
    assert(dryRunResult.semanticPackage.constructionPlan.total_steps === 7, 'Dry-run generates complete 7-step DAG');
    assert(!fs.existsSync(SANDBOX_DIR), 'Dry-run strictly wrote ZERO files to disk');

    // ---------------------------------------------------------------------------
    // GROUP 4: MULTI-LANGUAGE STACK BLUEPRINT PREVIEW
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 4] Testing Multi-Language Stack Support via CLI...');

    const pyDryRun = await executeProjectFactoryCli([
      '--goal', 'Fast numeric matrix processing tool',
      '--stack', 'python',
      '--dry-run'
    ], { brainRoot: BRAIN_ROOT });

    assert(pyDryRun.dynamicBlueprint.stack.language === 'python', 'Synthesizes Python blueprint via --stack python');
    assert(pyDryRun.dynamicBlueprint.stack.manifest === 'pyproject.toml', 'Python blueprint specifies pyproject.toml');

    const goDryRun = await executeProjectFactoryCli([
      '--goal', 'Concurrent p2p gossip network node',
      '--stack', 'go',
      '--dry-run'
    ], { brainRoot: BRAIN_ROOT });

    assert(goDryRun.dynamicBlueprint.stack.language === 'go', 'Synthesizes Go blueprint via --stack go');
    assert(goDryRun.dynamicBlueprint.stack.manifest === 'go.mod', 'Go blueprint specifies go.mod');

    // ---------------------------------------------------------------------------
    // GROUP 5: LIVE END-TO-END CONSTRUCTION OF REAL PRODUCT
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 5] Executing Live End-to-End Product Construction in Isolated Sandbox...');
    console.log('  Product Goal: "Build a small-business inventory and sales management application"');

    if (fs.existsSync(SANDBOX_DIR)) {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    }

    const liveResult = await executeProjectFactoryCli([
      '--goal', 'Build a small-business inventory and sales management application',
      '--name', 'InventoryMaster',
      '--target', SANDBOX_DIR,
      '--stack', 'javascript'
    ], { brainRoot: BRAIN_ROOT });

    assert(liveResult.success === true, 'Live construction returned success: true');
    assert(liveResult.status === 'CONSTRUCTED_AND_VERIFIED', 'Live construction returned CONSTRUCTED_AND_VERIFIED status');
    assert(liveResult.writtenFilesCount >= 8, 'Generated expected suite of files across domains', `Count: ${liveResult.writtenFilesCount}`);

    // Verify key files on disk
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'package.json')), 'package.json exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'README.md')), 'README.md exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'src', 'core', 'engine.mjs')), 'src/core/engine.mjs exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'src', 'models', 'schema.mjs')), 'src/models/schema.mjs exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'src', 'index.mjs')), 'src/index.mjs exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'tests', 'application.test.mjs')), 'tests/application.test.mjs exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'deploy-manifest.json')), 'deploy-manifest.json exists on disk');
    assert(fs.existsSync(path.join(SANDBOX_DIR, 'assembly-manifest.json')), 'assembly-manifest.json exists on disk');

    // Verify Construction Intelligence artifacts on disk
    const constDir = path.join(SANDBOX_DIR, '.project-brain', 'construction');
    assert(fs.existsSync(path.join(constDir, 'semantic-requirements.json')), '.project-brain/construction/semantic-requirements.json exists');
    assert(fs.existsSync(path.join(constDir, 'construction-plan.json')), '.project-brain/construction/construction-plan.json exists');
    assert(fs.existsSync(path.join(constDir, 'problem-record.json')), '.project-brain/construction/problem-record.json exists');
    assert(fs.existsSync(path.join(constDir, 'business-feasibility.json')), '.project-brain/construction/business-feasibility.json exists');
    assert(fs.existsSync(path.join(constDir, 'prd-specification.json')), '.project-brain/construction/prd-specification.json exists');
    assert(fs.existsSync(path.join(constDir, 'CONSTRUCTION_SPECIFICATION.md')), '.project-brain/construction/CONSTRUCTION_SPECIFICATION.md exists');

    // ---------------------------------------------------------------------------
    // GROUP 6: EMPIRICAL TEST EXECUTION EVIDENCE
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 6] Verifying Live Test Execution & Assertion Evidence...');

    const verification = liveResult.verification;
    assert(verification.executed === true, 'Test suite was executed via child_process');
    assert(verification.exitCode === 0, 'Test runner exited strictly with code 0');
    assert(verification.verified === true, 'Verification marked verified: true');
    assert(verification.durationMs > 0, 'Test execution duration tracked');
    assert(verification.stdout.includes('Inventory & Sales Management Suite'), 'Terminal stdout captures test suite name');
    assert(verification.stdout.includes('pass'), 'Terminal stdout captures pass status');

    // ---------------------------------------------------------------------------
    // GROUP 7: CONSTRUCTION_VERIFICATION_REPORT.md AUDIT
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 7] Auditing CONSTRUCTION_VERIFICATION_REPORT.md Contents...');

    const reportPath = path.join(SANDBOX_DIR, 'CONSTRUCTION_VERIFICATION_REPORT.md');
    assert(fs.existsSync(reportPath), 'CONSTRUCTION_VERIFICATION_REPORT.md exists');

    const reportText = fs.readFileSync(reportPath, 'utf-8');
    assert(reportText.includes('Universal Product Construction & Verification Report'), 'Report contains canonical header');
    assert(reportText.includes('VERIFIED_WORKING'), 'Report confirms VERIFIED_WORKING status');
    assert(reportText.includes('1. Requirements Decomposition (Domains A, B, C)'), 'Report includes Domain A, B, C Section');
    assert(reportText.includes('2. Construction Plan DAG (Domains G & H)'), 'Report includes Domain G, H DAG Section');
    assert(reportText.includes('3. Empirical Verification Results (Domain K)'), 'Report includes Domain K Verification Section');
    assert(reportText.includes('4. Negative Scope Invariants Enforced'), 'Report includes Negative Scope Invariants Section');
    assert(reportText.includes('**Exit Code**: `0`'), 'Report records Exit Code 0 proof');

    // ---------------------------------------------------------------------------
    // GROUP 8: BOOTSTRAP ENGINE CLI DELEGATION
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 8] Testing Bootstrap Engine Delegation (--construct)...');

    const bootstrapCliOutput = execSync(
      `node 04_WORKFLOWS/factory-engine/bootstrap.mjs --construct --goal "Bootstrap CLI delegation probe" --dry-run`,
      { cwd: BRAIN_ROOT, encoding: 'utf-8' }
    );

    assert(bootstrapCliOutput.includes('DRY-RUN PREVIEW COMPLETE'), 'bootstrap.mjs --construct successfully delegates to project-factory-cli.mjs');
    assert(bootstrapCliOutput.includes('Planned Tasks:'), 'Delegated dry-run output contains planned tasks');

    // ---------------------------------------------------------------------------
    // GROUP 9: CLEANUP & TEARDOWN
    // ---------------------------------------------------------------------------
    console.log('\n[GROUP 9] Purging Test Sandbox...');
    if (fs.existsSync(SANDBOX_DIR)) {
      fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
    }
    assert(!fs.existsSync(SANDBOX_DIR), 'Sandbox directory purged cleanly');

  } catch (err) {
    console.error('\n❌ Unexpected error in test suite:', err);
    failedTests++;
  }

  console.log('\n======================================================================');
  console.log(`🏁 PROJECT FACTORY CLI TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
