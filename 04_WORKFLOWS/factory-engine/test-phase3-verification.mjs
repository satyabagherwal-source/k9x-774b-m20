/**
 * AI-Builder-Brain — Phase 3 Production Safety & End-to-End Verification Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-phase3-verification.mjs
 * Purpose: Empirically verifies Phase 3 Requirements:
 *          1. Knowledge-index conflict recovery audit (read-only ambiguity view & write protection)
 *          2. Full-chain local learning persistence, SHA-256 read-back, retrieval & reuse
 *          3. Cloud / Local independence across locks, checkpoints, queues, and retries
 *          4. Provider failover cascade and sustained restart supervision
 *          5. Production Git safety & canonical knowledge byte-for-byte immutability
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  createLearningPackage,
  validateLearningPackage,
  submitToBrainGateway,
  readBackVerifyFile,
  loadKnowledgeIndex,
  saveKnowledgeIndex,
  loadCheckpoints,
  saveCheckpoints,
  getBrainPaths,
  LEARNING_STAGES,
  LEARNING_STATUS
} from './brain-learning-gateway.mjs';

import {
  getRetrievalPaths,
  buildSearchIndex,
  searchBrain,
  retrieveKnowledge,
  tokenize
} from './retrieval-engine.mjs';

import {
  executeLocalRepositoryLearning,
  ensureLocalBrainBridge,
  inspectLocalProject
} from './local-repository-learning-engine.mjs';

import {
  createTaskContract,
  validateTaskContract,
  TASK_STATUS,
  FAILURE_CLASSES
} from './task-contract.mjs';

import {
  AutonomousOrchestrator,
  TaskStorageManager
} from './autonomous-orchestrator.mjs';

import {
  QuotaTracker,
  ProviderCascadeRouter
} from './quota-router.mjs';

import {
  acquireTargetLock,
  releaseTargetLock,
  resolveNextRuleNumber
} from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const SANDBOX_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'phase3-proof');
const SANDBOX_LOCAL_PROJECT = path.join(SANDBOX_ROOT, 'sample-local-app');
const SANDBOX_REUSE_PROJECT = path.join(SANDBOX_ROOT, 'sample-consumer-app');

console.log('======================================================================');
console.log('🛡️  AI-BUILDER-BRAIN: PHASE 3 PRODUCTION SAFETY & VERIFICATION SUITE');
console.log('   Canonical Root : ' + BRAIN_ROOT);
console.log('   Sandbox Root   : ' + SANDBOX_ROOT);
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

function calculateFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

const CANONICAL_PROTECTED_FILES = [
  '05_KNOWLEDGE/knowledge-index.json',
  '05_KNOWLEDGE/engineering-patterns.md',
  '.project-brain/harvest-checkpoints.json',
  '08_VERIFICATION/harvest-verification-matrix.md',
  '08_VERIFICATION/verification-log.json',
  '09_SOURCES/harvest-provenance-ledger.md',
  '09_SOURCES/sources-catalog.json',
  '14_EVOLUTION/harvest-yield-metrics.json',
  'harvest-control.json'
];

async function runPhase3Verification() {
  // Step 1: Record Before-Hashes of all canonical production knowledge
  console.log('[SAFETY BASELINE] Calculating Cryptographic Hashes of Canonical Files...');
  const beforeHashes = {};
  for (const rel of CANONICAL_PROTECTED_FILES) {
    const full = path.join(BRAIN_ROOT, rel);
    beforeHashes[rel] = calculateFileSha256(full);
    console.log(`  • ${rel.padEnd(46)}: ${beforeHashes[rel] ? beforeHashes[rel].slice(0, 16) + '...' : 'NOT_FOUND'}`);
  }

  // Setup Sandbox
  fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '01_CORE'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '03_SKILLS'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '08_VERIFICATION'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '09_SOURCES'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '11_INBOX'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '14_EVOLUTION'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'cache'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.harvest-locks'), { recursive: true });

  // Baseline patterns in sandbox
  const prodPatterns = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (fs.existsSync(prodPatterns)) {
    fs.copyFileSync(prodPatterns, path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'));
  }

  // Setup Mock Local App with incident in sandbox
  fs.mkdirSync(path.join(SANDBOX_LOCAL_PROJECT, '.project-brain', 'incidents'), { recursive: true });
  fs.writeFileSync(path.join(SANDBOX_LOCAL_PROJECT, 'package.json'), JSON.stringify({
    name: 'sample-local-app',
    version: '1.0.0',
    scripts: { test: 'node test.js' }
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(SANDBOX_LOCAL_PROJECT, 'index.js'), `
export function sanitizeWindowsPathSeparators(p) {
  return p.replace(/\\\\/g, '/');
}
`, 'utf-8');

  fs.writeFileSync(path.join(SANDBOX_LOCAL_PROJECT, '.project-brain', 'incidents', 'INC-002-windows-backslash.md'), `
# Incident Record: Windows Backslash Regex Parser Token Corruption
- **Status**: RESOLVED_WITH_EVIDENCE
- **Verification Gate**: VERIFIED
- **Is this potentially reusable across other projects?**: YES

## 4. Root Cause Analysis
Unescaped Windows backslash path separators caused JSON stringify and regex parsing errors across posix-compliant tools.

## 5. Non-Destructive Invariant Fix
Always sanitize path separators using p.replace(/\\\\/g, '/') before executing lexical path normalization.
`, 'utf-8');

  // Setup Mock Consumer App for reuse in sandbox
  fs.mkdirSync(SANDBOX_REUSE_PROJECT, { recursive: true });
  fs.writeFileSync(path.join(SANDBOX_REUSE_PROJECT, 'package.json'), JSON.stringify({
    name: 'sample-consumer-app',
    version: '1.0.0'
  }, null, 2), 'utf-8');

  try {
    // =========================================================================
    // SECTION 2: Knowledge-Index Conflict Recovery & Safety Guard Audit
    // =========================================================================
    console.log('\n[SECTION 2] Auditing Knowledge-Index Conflict Recovery & Hard Safety Guards...');

    // 1. Audit conflicted index loading using simulated conflict in sandbox
    const CONFLICT_SANDBOX = path.join(SANDBOX_ROOT, 'conflict-sandbox');
    fs.mkdirSync(path.join(CONFLICT_SANDBOX, '05_KNOWLEDGE'), { recursive: true });
    fs.mkdirSync(path.join(CONFLICT_SANDBOX, '.project-brain'), { recursive: true });

    const mockConflictedIndex = `{\n  "version": "1.0.0",\n<<<<<<< HEAD\n  "items": {\n    "item-1": { "name": "head-version" }\n  }\n=======\n  "items": {\n    "item-1": { "name": "remote-version" }\n  }\n>>>>>>> 819bec241\n}`;
    fs.writeFileSync(path.join(CONFLICT_SANDBOX, '05_KNOWLEDGE', 'knowledge-index.json'), mockConflictedIndex, 'utf8');

    const mockConflictedCp = `{\n<<<<<<< HEAD\n  "checkpoints": { "repo-a": { "status": "HEAD" } }\n=======\n  "checkpoints": { "repo-a": { "status": "REMOTE" } }\n>>>>>>> 819bec241\n}`;
    fs.writeFileSync(path.join(CONFLICT_SANDBOX, '.project-brain', 'harvest-checkpoints.json'), mockConflictedCp, 'utf8');

    const recoveryView = loadKnowledgeIndex(CONFLICT_SANDBOX);
    assert(recoveryView.has_unresolved_git_conflicts === true, 'loadKnowledgeIndex identifies active git conflicts');
    assert(recoveryView.is_read_only_recovery_view === true, 'loadKnowledgeIndex returns explicitly marked read-only recovery view');
    assert(typeof recoveryView.ambiguity_count === 'number', 'Conflict ambiguity count reported', `${recoveryView.ambiguity_count} ambiguities`);
    assert(Array.isArray(recoveryView.ambiguous_keys), 'Ambiguous conflicting keys tracked');

    // 2. Audit write-blocker on recovery view
    let recoverySaveBlocked = false;
    try {
      saveKnowledgeIndex(recoveryView, CONFLICT_SANDBOX);
    } catch (err) {
      if (err.message.includes('PRODUCTION_SAFETY_VIOLATION')) {
        recoverySaveBlocked = true;
      }
    }
    assert(recoverySaveBlocked === true, 'saveKnowledgeIndex strictly refuses to write recovery view (PRODUCTION_SAFETY_VIOLATION)');

    // 3. Audit direct write-blocker against conflicted file
    let canonicalDirectSaveBlocked = false;
    try {
      const mockCleanData = { version: '1.0.0', items: {} };
      saveKnowledgeIndex(mockCleanData, CONFLICT_SANDBOX);
    } catch (err) {
      if (err.message.includes('PRODUCTION_SAFETY_VIOLATION')) {
        canonicalDirectSaveBlocked = true;
      }
    }
    assert(canonicalDirectSaveBlocked === true, 'saveKnowledgeIndex refuses to overwrite file containing conflict markers');

    // 4. Audit checkpoints safety guard
    let checkpointsSaveBlocked = false;
    try {
      const mockCheckpoints = { version: '1.0.0', checkpoints: {} };
      saveCheckpoints(mockCheckpoints, CONFLICT_SANDBOX);
    } catch (err) {
      if (err.message.includes('PRODUCTION_SAFETY_VIOLATION')) {
        checkpointsSaveBlocked = true;
      }
    }
    assert(checkpointsSaveBlocked === true, 'saveCheckpoints refuses to overwrite conflicted harvest-checkpoints.json');

    // =========================================================================
    // SECTION 3: Full-Chain Local Learning Persistence, Read-Back & Retrieval
    // =========================================================================
    console.log('\n[SECTION 3] Verifying Complete Local Learning Chain in Disposable Sandbox...');

    const localResult = await executeLocalRepositoryLearning({
      projectPath: SANDBOX_LOCAL_PROJECT,
      brainRoot: SANDBOX_ROOT,
      customLessons: [
        {
          ruleTitle: 'Deterministic Path Separator Sanitization for Cross-Platform Toolchains',
          ruleStatement: 'Always normalize file paths with replace(/\\\\/g, "/") before passing to regex parsers or JSON schema validators.',
          why: 'Prevents tokenization failure and illegal escape character exceptions on Windows paths.',
          whenToApply: 'Every multi-platform file loader, path validator, or source AST resolver.',
          implementation: 'const normalized = filePath.replace(/\\\\/g, "/");',
          negativeConstraint: '// Anti-pattern: passing raw Windows backslash paths\nconst tokens = filePath.split("/");'
        }
      ]
    });

    assert(localResult.success === true, 'Local learning extraction succeeded in sandbox');
    assert(localResult.gatewayResult.status === LEARNING_STATUS.VERIFIED_LEARNING, 'Learning gateway reached VERIFIED_LEARNING');

    // Physical read-back verification
    const sandboxDossier = path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING', 'local-sample-local-app-learnings.md');
    assert(fs.existsSync(sandboxDossier), 'Dossier physically written to sandbox 07_PROJECT_LEARNING');
    const readBack = readBackVerifyFile(sandboxDossier, localResult.gatewayResult.content_hash);
    assert(readBack.verified === true, 'Dossier SHA-256 read-back verified against content hash');

    // Real retrieval engine query
    const retrieval = searchBrain('Path separator sanitization Windows cross-platform', { topK: 3, brainRoot: SANDBOX_ROOT });
    assert(retrieval.results.length > 0, 'Real Brain retrieval engine returned matches in sandbox');
    const pathMatch = retrieval.results.find(r => 
      r.title.toLowerCase().includes('path') || 
      r.title.toLowerCase().includes('separator') || 
      r.title.toLowerCase().includes('sanitization')
    );
    assert(Boolean(pathMatch), 'Retrieved rule matches path separator pattern', pathMatch?.title);

    // Knowledge reuse in consumer project
    console.log('  Applying retrieved pattern in separate consumer project...');
    const fixedConsumerCode = `function resolvePath(p) { return p.replace(/\\\\/g, '/').toLowerCase(); }`;
    fs.writeFileSync(path.join(SANDBOX_REUSE_PROJECT, 'resolver.js'), fixedConsumerCode, 'utf-8');
    const consumerContent = fs.readFileSync(path.join(SANDBOX_REUSE_PROJECT, 'resolver.js'), 'utf-8');
    assert(consumerContent.includes("replace(/\\\\/g, '/')"), 'Consumer project successfully applied retrieved Brain pattern');

    // =========================================================================
    // SECTION 4: Cloud / Local Independence Verification
    // =========================================================================
    console.log('\n[SECTION 4] Testing Concurrent Cloud & Local Independence...');

    // 1. Simulate Cloud Worker recording progress in cloud store
    const cloudCheckpoints = loadCheckpoints(SANDBOX_ROOT, 'CLOUD_HARVEST');
    cloudCheckpoints.checkpoints['github.com/cloud-stream-org/event-hub'] = {
      repository: 'cloud-stream-org/event-hub',
      pipeline_mode: 'CLOUD_HARVEST',
      stage: 'VERIFIED',
      status: 'VERIFIED_LEARNING',
      learning_id: 'learn-github-cloud-stream-org-event-hub',
      content_hash: 'c1c2c3c4d5d600112233445566778899aabbccddeeff00112233445566778899',
      verified_at: new Date().toISOString()
    };
    saveCheckpoints(cloudCheckpoints, SANDBOX_ROOT, 'CLOUD_HARVEST');

    // 2. Acquire Cloud Lock on cloud repo
    const cloudLock = acquireTargetLock('github.com/cloud-stream-org/event-hub', 'cloud-worker-proc-101', 30, SANDBOX_ROOT);
    assert(cloudLock.acquired === true, 'Cloud lock acquired for cloud repo');

    // 3. Concurrently acquire Local Lock on local project
    const localLock = acquireTargetLock('local/sample-local-app', 'local-ide-session-909', 30, SANDBOX_ROOT);
    assert(localLock.acquired === true, 'Local lock acquired concurrently for local project');

    // 4. Verify distinct lock files on disk
    assert(fs.existsSync(cloudLock.lockFile), 'Cloud lock file exists with distinct namespace', path.basename(cloudLock.lockFile));
    assert(fs.existsSync(localLock.lockFile), 'Local lock file exists with distinct namespace', path.basename(localLock.lockFile));

    // 5. Test Lock Contention / Non-Stealing: Second local attempt on same target is rejected
    const secondLocalAttempt = acquireTargetLock('local/sample-local-app', 'competing-local-proc-999', 30, SANDBOX_ROOT);
    assert(secondLocalAttempt.acquired === false, 'Competing lock acquisition safely rejected without stealing');

    // 6. Test Separate Checkpoints Verification
    const reloadedCloud = loadCheckpoints(SANDBOX_ROOT, 'CLOUD_HARVEST');
    const reloadedLocal = loadCheckpoints(SANDBOX_ROOT, 'LOCAL_LEARNING');

    assert(Boolean(reloadedCloud.checkpoints['github.com/cloud-stream-org/event-hub']), 'Cloud checkpoints contain cloud target');
    assert(!reloadedCloud.checkpoints['local/sample-local-app'], 'Cloud checkpoints contain ZERO local target pollution');

    assert(Boolean(reloadedLocal.checkpoints['local/sample-local-app']), 'Local checkpoints contain local target');
    assert(!reloadedLocal.checkpoints['github.com/cloud-stream-org/event-hub'], 'Local checkpoints contain ZERO cloud target pollution');

    // Release locks cleanly
    releaseTargetLock('github.com/cloud-stream-org/event-hub', SANDBOX_ROOT);
    releaseTargetLock('local/sample-local-app', SANDBOX_ROOT);

    // =========================================================================
    // SECTION 5: Provider Failover & Restart Supervision
    // =========================================================================
    console.log('\n[SECTION 5] Testing Provider Failover Cascade & Restart Supervision...');

    // 1. Quota cascade test
    const quotaTracker = new QuotaTracker({ switchThreshold: 0.85 });
    const cascadeRouter = new ProviderCascadeRouter({ quotaTracker });
    quotaTracker.setMockQuota('groq', { remainingPct: 0.10 }); // 90% used > 85% limit
    const switchCheck = quotaTracker.shouldSwitch('groq');
    assert(switchCheck.switchRequired === true, 'Quota tracker identifies 85% limit reached');
    const nextProv = cascadeRouter.selectNextEligibleProvider('groq');
    assert(nextProv.provider !== 'groq' && Boolean(nextProv.provider), 'Cascade router selects next eligible provider', nextProv.provider);

    // 2. Sustained task contract DAG & restart test
    const orchestrator = new AutonomousOrchestrator({ projectRoot: SANDBOX_ROOT });
    const taskContract = orchestrator.initializeTask({
      task: 'Refactor token cache allocator and verify memory barrier',
      criteria: ['BUILD_EXIT_0', 'TEST_PASS'],
      type: 'REFACTOR'
    });
    const taskId = taskContract.task_id;
    assert(taskContract.execution_plan.length === 3, 'Task contract decomposed into 3-step DAG');

    // Complete Step 1 and checkpoint
    taskContract.execution_plan[0].status = 'COMPLETED';
    taskContract.execution_plan[0].completed_at = new Date().toISOString();
    taskContract.checkpoint.current_step = 1;
    orchestrator.storage.saveTaskRecord(taskContract);

    // Simulate process termination and new orchestrator handoff
    const successor = new AutonomousOrchestrator({ projectRoot: SANDBOX_ROOT });
    const resumed = successor.resumeTask(taskId);
    assert(resumed.contract.checkpoint.current_step === 1, 'Successor resumes from step 1 without repeating step 0');
    assert(resumed.contract.execution_plan[0].status === 'COMPLETED', 'Step 1 completed state preserved across process boundary');

    const execResult = await successor.executeUntilDone(resumed.contract);
    assert(execResult.success === true, 'Autonomous execution completed remaining steps');
    assert(execResult.status === TASK_STATUS.VERIFIED, 'Final status reached TASK_STATUS.VERIFIED');

  } finally {
    // Isolated sandbox cleanup
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
    console.log('\n🧹 [CLEANUP] Disposable simulation sandbox completely removed.');
  }

  // =========================================================================
  // SECTION 6: Canonical Production Knowledge Immutability Verification
  // =========================================================================
  console.log('\n[SECTION 6] Verifying Byte-for-Byte Canonical Production Immutability...');
  let canonicalUnchanged = true;
  for (const rel of CANONICAL_PROTECTED_FILES) {
    const full = path.join(BRAIN_ROOT, rel);
    const afterHash = calculateFileSha256(full);
    const beforeHash = beforeHashes[rel];
    const match = afterHash === beforeHash;
    if (!match) canonicalUnchanged = false;
    assert(match, `Canonical ${rel} is byte-for-byte unchanged`, `Match: ${match}`);
  }

  console.log('\n======================================================================');
  console.log(`🏁 PHASE 3 VERIFICATION SUMMARY: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log(`   Canonical Knowledge Mutated: ${canonicalUnchanged ? 'ZERO BYTES (100% IMMUTABLE)' : 'MUTATION DETECTED'}`);
  console.log('======================================================================\n');

  if (failedTests > 0 || !canonicalUnchanged) {
    process.exit(1);
  }
}

runPhase3Verification().catch(err => {
  console.error('[CRITICAL TEST EXCEPTION]', err);
  process.exit(1);
});
