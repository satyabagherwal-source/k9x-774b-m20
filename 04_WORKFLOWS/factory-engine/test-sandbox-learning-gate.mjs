import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  createLearningPackage,
  submitToBrainGateway,
  loadKnowledgeIndex,
  getBrainPaths,
  LEARNING_STATUS,
  LEARNING_STAGES
} from './brain-learning-gateway.mjs';
import { validateRuleCandidate } from './gemini-brain-agent.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MASTER_BRAIN_ROOT = path.resolve(__dirname, '..', '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function sha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function runSandboxVerificationGate() {
  console.log(`======================================================================`);
  console.log(`🔬 ISOLATED SANDBOX LEARNING INTEGRITY VERIFICATION (जाँच D)`);
  console.log(`   Master Brain Root: ${MASTER_BRAIN_ROOT}`);
  console.log(`   Timestamp        : ${new Date().toISOString()}`);
  console.log(`======================================================================\n`);

  // Step 0: Record Pre-Test Hashes of Master Brain Production Files
  const masterPatternsPath = path.join(MASTER_BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  const masterIndexPath = path.join(MASTER_BRAIN_ROOT, '05_KNOWLEDGE', 'knowledge-index.json');
  const masterLearningsPath = path.join(MASTER_BRAIN_ROOT, '07_PROJECT_LEARNING', 'ai-builder-brain-learnings.md');
  const masterControlPath = path.join(MASTER_BRAIN_ROOT, 'harvest-control.json');

  const preHashes = {
    patterns: sha256(masterPatternsPath),
    index: sha256(masterIndexPath),
    learnings: sha256(masterLearningsPath),
    control: sha256(masterControlPath)
  };

  console.log(`[STAGE 0] Baseline Production Hashes Recorded:`);
  console.log(`  - engineering-patterns.md : ${preHashes.patterns?.slice(0, 16)}...`);
  console.log(`  - knowledge-index.json    : ${preHashes.index?.slice(0, 16)}...`);
  console.log(`  - control.json            : ${preHashes.control?.slice(0, 16)}...\n`);

  // Step 1: Create Isolated Temporary Sandbox
  const sandboxRoot = path.join(os.tmpdir(), `ai-brain-sandbox-${Date.now()}`);
  fs.mkdirSync(sandboxRoot, { recursive: true });

  const dirs = [
    '01_CORE', '03_SKILLS', '05_KNOWLEDGE', '07_PROJECT_LEARNING',
    '08_VERIFICATION', '09_SOURCES', '11_INBOX', '14_EVOLUTION', '15_METADATA', '.project-brain'
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(sandboxRoot, d), { recursive: true });
  }

  // Copy minimal baseline files into sandbox
  fs.copyFileSync(masterPatternsPath, path.join(sandboxRoot, '05_KNOWLEDGE', 'engineering-patterns.md'));
  fs.copyFileSync(masterIndexPath, path.join(sandboxRoot, '05_KNOWLEDGE', 'knowledge-index.json'));

  const sandboxPaths = getBrainPaths(sandboxRoot);
  console.log(`[STAGE 1] Sandbox Initialized at: ${sandboxRoot}`);
  assert(fs.existsSync(sandboxPaths.patternsPath), "Sandbox engineering-patterns.md exists");
  assert(fs.existsSync(sandboxPaths.indexPath), "Sandbox knowledge-index.json exists");

  // Step 2: Negative Controls — Malformed Candidate Rejection
  console.log(`\n[STAGE 2] Negative Controls: Malformed & Trivial Candidate Rejection...`);
  const malformedShort = validateRuleCandidate("Premature Invariant", "Body too short");
  assert(!malformedShort.valid, "Malformed short candidate rejected (<200 chars)");

  const malformedMissingTags = validateRuleCandidate(
    "Missing Invariant Tags Rule Candidate",
    "This is a sufficiently long rule body that exceeds two hundred characters to satisfy the basic length requirement. However, it completely lacks the mandatory rule blocks and structured invariants like rule, why, when to apply, implementation pattern, and negative constraints.".repeat(2)
  );
  assert(!malformedMissingTags.valid, "Candidate missing mandatory **RULE** or **NEGATIVE CONSTRAINT** tags rejected");

  // Step 3: Genuinely New Rule Candidate Formulation (Passing All 6 Mandatory Tags)
  console.log(`\n[STAGE 3] Genuinely New Rule Formulation & Validation...`);
  const newRuleTitle = "Idempotent Atomic File Spinlock with Nonce Handshake";
  const newRuleBody = `
**RULE**:
When coordinating concurrent file operations across detached worker processes on non-POSIX filesystems without kernel lock semantics, processes MUST acquire mutual exclusion using atomic directory creation or atomic rename with a process-unique cryptographically random nonce, retrying with exponential backoff and randomized jitter, and MUST atomically clean up the lockfile upon task completion or abnormal termination.

**WHY**:
Standard file flags (\`wx\` / \`O_CREAT | O_EXCL\`) suffer from filesystem-specific race windows and stale handle locks (EBUSY / EPERM on Windows). Without an atomic nonce handshake, concurrent agents can concurrently clobber lock records or deadlock when a predecessor process dies before releasing an advisory lock.

**WHEN TO APPLY**:
Apply to all cross-agent rate limiters, file-based token buckets, shared discovery queues, and distributed checkpoint coordinators operating across parallel forked workers.

**VERIFIED IMPLEMENTATION PATTERN**:
\`\`\`javascript
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function acquireNonceFileLock(lockFilePath, maxAttempts = 20, ttlMs = 15000) {
  const nonce = \`\${process.pid}-\${Date.now()}-\${crypto.randomBytes(4).toString('hex')}\`;
  const tmpLock = \`\${lockFilePath}.\${nonce}.tmp\`;
  fs.writeFileSync(tmpLock, JSON.stringify({ pid: process.pid, nonce, created: Date.now() }), 'utf-8');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      fs.renameSync(tmpLock, lockFilePath);
      return { acquired: true, nonce, lockFile: lockFilePath };
    } catch (err) {
      if (fs.existsSync(lockFilePath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
          if (Date.now() - existing.created > ttlMs) {
            fs.unlinkSync(lockFilePath);
          }
        } catch (_) {}
      }
      const jitter = 50 + Math.floor(Math.random() * 100);
      await new Promise(r => setTimeout(r, jitter));
    }
  }
  try { fs.unlinkSync(tmpLock); } catch (_) {}
  return { acquired: false };
}
\`\`\`

**NEGATIVE CONSTRAINT**:
\`\`\`javascript
// ANTI-PATTERN: Direct existence check followed by write (RACE CONDITION)
if (!fs.existsSync(lockFile)) {
  fs.writeFileSync(lockFile, 'LOCKED'); // DEADLOCK: Two processes pass existsSync concurrently
}
\`\`\`

**VERIFICATION METHOD**:
Execute 10 concurrent forked Node processes attempting to acquire the lock simultaneously within a 5-second window. Assert that exactly one process holds the lock at any given moment and all operations complete without unhandled EBUSY/EPERM errors.
`;

  const validation = validateRuleCandidate(newRuleTitle, newRuleBody);
  assert(validation.valid, `Genuinely new rule candidate passes all 6 structural tag validations`);

  // Step 4: Create Learning Package with Full Provenance
  console.log(`\n[STAGE 4] Creating Sandbox Learning Package with Provenance...`);
  const testPkg = createLearningPackage({
    repository: "test-org/atomic-locker",
    platform: "github",
    slug: "test-org-atomic-locker",
    sourceUrl: "https://github.com/test-org/atomic-locker",
    sourceVersion: "e8f9a01234567890abcdef1234567890abcdef12",
    license: "MIT",
    aiProvider: "sandbox-verification-agent",
    dossierText: `# Forensic Dossier: test-org/atomic-locker\n\n- Source: https://github.com/test-org/atomic-locker\n- Commit: e8f9a012\n- Invariant: Atomic Nonce Lock Handshake`,
    candidateRules: [
      {
        title: newRuleTitle,
        body: newRuleBody
      }
    ]
  });

  assert(Boolean(testPkg.learning_id), `Learning ID generated: ${testPkg.learning_id}`);
  assert(Boolean(testPkg.content_hash), `Cryptographic content hash: ${testPkg.content_hash.slice(0, 16)}...`);

  // Step 5: Execute Promotion Pipeline strictly in Sandbox
  console.log(`\n[STAGE 5] Submitting Package to Brain Gateway (Sandbox Mode)...`);
  const result = await submitToBrainGateway(testPkg, { brainRoot: sandboxRoot });

  assert(result.success, `Gateway returned success: ${result.success}`);
  assert(result.status === LEARNING_STATUS.VERIFIED_LEARNING, `Gateway status is VERIFIED_LEARNING (got: ${result.status})`);
  assert(result.brain_write === true, `Dossier written to sandbox 07_PROJECT_LEARNING`);
  assert(result.brain_readback === true, `Dossier read-back SHA-256 verified`);
  assert(result.knowledge_index_updated === true, `Sandbox knowledge-index.json updated`);
  assert(result.promoted_rules.length > 0, `Rule promoted: ${result.promoted_rules.map(r => `Rule ${r.number}`).join(', ')}`);

  const promotedNumber = result.promoted_rules[0]?.number;
  console.log(`  -> Promoted Rule Number: ${promotedNumber}`);

  // Step 6: Verify Persistence and SHA-256 Read-Back in Sandbox
  console.log(`\n[STAGE 6] Verifying Sandbox Canonical Persistence & SHA-256 Read-Back...`);
  const sandboxPatterns = fs.readFileSync(sandboxPaths.patternsPath, 'utf-8');
  assert(sandboxPatterns.includes(`## ${promotedNumber}. ${newRuleTitle}`), `Rule header found in sandbox engineering-patterns.md`);
  assert(sandboxPatterns.includes("Idempotent Atomic File Spinlock with Nonce Handshake"), `Rule title found in sandbox patterns`);

  // Read-back sandbox index
  const sandboxIndex = loadKnowledgeIndex(sandboxRoot);
  assert(Boolean(sandboxIndex.items[testPkg.learning_id]), `Dossier item indexed in sandbox knowledge-index.json`);
  assert(Boolean(sandboxIndex.items[`rule-${promotedNumber}`]), `Top-level rule item 'rule-${promotedNumber}' indexed with dual-schema symmetry`);
  assert(sandboxIndex.items[`rule-${promotedNumber}`]?.title.includes(newRuleTitle), `Top-level rule index title matches candidate title`);

  // Step 7: Fresh-Process Retrieval Test (External Child Process)
  console.log(`\n[STAGE 7] Fresh-Process Retrieval Query Verification...`);
  const retrievalEngineUrl = pathToFileURL(path.join(MASTER_BRAIN_ROOT, '04_WORKFLOWS', 'factory-engine', 'retrieval-engine.mjs')).href;
  const retrievalProbeCode = `
    import { searchBrain } from '${retrievalEngineUrl}';
    const query = "Idempotent Atomic File Spinlock with Nonce Handshake";
    const res = searchBrain(query, { brainRoot: ${JSON.stringify(sandboxRoot)}, topK: 5 });
    const match = res.results.find(r => r.title && r.title.includes("Idempotent Atomic File Spinlock"));
    if (match) {
      console.log("MATCH_FOUND:" + match.rule_number + ":" + match.title + ":" + match.score);
      process.exit(0);
    } else {
      console.error("NO_MATCH_FOUND");
      process.exit(1);
    }
  `;

  const probe = spawnSync(process.execPath, ['--input-type=module', '-e', retrievalProbeCode], {
    encoding: 'utf-8',
    timeout: 10000
  });

  const stdout = (probe.stdout || '').trim();
  const stderr = (probe.stderr || '').trim();
  assert(probe.status === 0, `Fresh process exited with code 0 (Output: ${stdout || stderr})`);
  assert(stdout.includes("MATCH_FOUND"), `Fresh process retrieved newly promoted rule from sandbox`);
  assert(!stdout.includes("undefined"), `Fresh process output contains ZERO undefined tokens`);
  assert(stdout.includes(`MATCH_FOUND:${promotedNumber}:`), `Fresh process output contains exact promoted rule number (${promotedNumber})`);

  // Step 8: Duplicate Rejection & Idempotency Invariant
  console.log(`\n[STAGE 8] Duplicate Rejection & Idempotency Testing...`);
  const patternsBeforeDup = fs.readFileSync(sandboxPaths.patternsPath, 'utf-8');
  const dupResult = await submitToBrainGateway(testPkg, { brainRoot: sandboxRoot });
  assert(dupResult.success, `Duplicate submission handled gracefully`);
  assert(dupResult.already_indexed === true, `Duplicate detected and marked as already_indexed`);

  const patternsAfterDup = fs.readFileSync(sandboxPaths.patternsPath, 'utf-8');
  assert(patternsBeforeDup === patternsAfterDup, `Zero duplicate rules appended to engineering-patterns.md on repeat submission`);

  // Step 9: Production Repository Purity Proof (Zero Production Mutations)
  console.log(`\n[STAGE 9] Production Brain Zero-Mutation Mathematical Proof...`);
  const postHashes = {
    patterns: sha256(masterPatternsPath),
    index: sha256(masterIndexPath),
    learnings: sha256(masterLearningsPath),
    control: sha256(masterControlPath)
  };

  assert(preHashes.patterns === postHashes.patterns, `Master engineering-patterns.md UNTOUCHED (SHA-256 match)`);
  assert(preHashes.index === postHashes.index, `Master knowledge-index.json UNTOUCHED (SHA-256 match)`);
  assert(preHashes.learnings === postHashes.learnings, `Master ai-builder-brain-learnings.md UNTOUCHED (SHA-256 match)`);
  assert(preHashes.control === postHashes.control, `Master harvest-control.json UNTOUCHED (SHA-256 match)`);

  // Step 10: Sandbox Cleanup
  console.log(`\n[STAGE 10] Cleaning up temporary sandbox directory...`);
  try {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
    assert(!fs.existsSync(sandboxRoot), `Sandbox directory cleanly removed`);
  } catch (err) {
    console.warn(`Could not remove sandbox: ${err.message}`);
  }

  console.log(`\n======================================================================`);
  console.log(`🏁 SANDBOX VERIFICATION SUMMARY: ${passedTests} PASSED | ${failedTests} FAILED (Total: ${totalTests})`);
  console.log(`======================================================================`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSandboxVerificationGate().catch((err) => {
  console.error("CRITICAL FAILURE in runSandboxVerificationGate:", err);
  process.exit(1);
});
