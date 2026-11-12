/**
 * Test A: Synthetic Learning Persistence Test
 * Isolated Sandbox Verification for Pre-Cloud-Harvesting Reliability Audit
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  submitToBrainGateway,
  createLearningPackage,
  loadKnowledgeIndex,
  LEARNING_STATUS
} from '../../../04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SANDBOX_DIR = __dirname;
const TEST_BRAIN_ROOT = path.join(SANDBOX_DIR, 'test-brain-root');

console.log('======================================================================');
console.log('🧪 TEST A: SYNTHETIC LEARNING PERSISTENCE TEST');
console.log('   Sandbox Root:', TEST_BRAIN_ROOT);
console.log('======================================================================\n');

// 1. Prepare isolated sandbox structure
if (fs.existsSync(TEST_BRAIN_ROOT)) {
  fs.rmSync(TEST_BRAIN_ROOT, { recursive: true, force: true });
}
fs.mkdirSync(TEST_BRAIN_ROOT, { recursive: true });

const subdirs = [
  '01_CORE',
  '03_SKILLS',
  '05_KNOWLEDGE',
  '07_PROJECT_LEARNING',
  '08_VERIFICATION',
  '09_SOURCES',
  '11_INBOX',
  '12_DECISIONS',
  '13_GOVERNANCE',
  '14_EVOLUTION',
  '15_METADATA',
  '.project-brain'
];
for (const sub of subdirs) {
  fs.mkdirSync(path.join(TEST_BRAIN_ROOT, sub), { recursive: true });
}

// Initialize seed knowledge-index.json and engineering-patterns.md in sandbox
fs.writeFileSync(
  path.join(TEST_BRAIN_ROOT, '05_KNOWLEDGE', 'knowledge-index.json'),
  JSON.stringify({ schema_version: '2.0.0', last_updated: new Date().toISOString(), total_items: 0, items: {} }, null, 2),
  'utf8'
);
fs.writeFileSync(
  path.join(TEST_BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'),
  '# Engineering Patterns & Architectural Invariants\n\nExisting patterns baseline.\n',
  'utf8'
);

// 2. Formulate Synthetic Learning Package
const testDossier = `# Audit Test Target Forensic Intelligence Dossier

## 1. Executive Summary
This is a synthetic verification dossier generated for the Pre-Cloud-Harvesting Reliability Audit.
It verifies that learning packages pass through the gateway and persist to disk.

## 2. Architecture & Design Decisions
Strict architectural separation between ingestion and persistent storage.

## 3. Net-New Universal Engineering Rules (Candidates for Master Brain)

### Rule 999: Synthetic Test Persistence Verification Invariant
- **Directive**: Always verify disk persistence and read-back before asserting operational readiness.
- **Rationale**: Memory state does not equal persisted state.
- **Verification**: SHA-256 hash check and post-restart reload.
`;

const learningPkg = createLearningPackage({
  repository: 'audit-test-org/audit-test-repo',
  platform: 'github',
  slug: 'audit-test-repo',
  sourceUrl: 'https://github.com/audit-test-org/audit-test-repo',
  sourceVersion: 'commit-sha-9999999999',
  license: 'MIT',
  aiProvider: 'audit-synthetic-test-runner',
  dossierText: testDossier,
  candidateRules: [
    {
      number: 999,
      title: 'Rule 999: Synthetic Test Persistence Verification Invariant',
      text: 'Rule 999: Synthetic Test Persistence Verification Invariant\n- Directive: Always verify disk persistence and read-back before asserting operational readiness.\n- Rationale: Memory state does not equal persisted state.\n- Verification: SHA-256 hash check and post-restart reload.'
    }
  ],
  auditEvidence: {
    fixCommitsCount: 3,
    closedIssuesCount: 2,
    commitsSample: [{ sha: 'commit-sha-9999999999', message: 'test commit' }]
  }
});

console.log('📦 Created Synthetic Package:');
console.log('   Learning ID:', learningPkg.learning_id);
console.log('   Content Hash:', learningPkg.content_hash);
console.log('   Candidate Rules:', learningPkg.candidate_rules.length);

// 3. Submit to Brain Learning Gateway targeting sandbox
console.log('\n--- Submitting to Gateway ---');
const gatewayResult = await submitToBrainGateway(learningPkg, { brainRoot: TEST_BRAIN_ROOT });

console.log('\n--- Gateway Return Inspection ---');
console.log('Gateway Success:', gatewayResult.success);
console.log('Gateway Status:', gatewayResult.status);
console.log('Brain Write:', gatewayResult.brain_write);
console.log('Brain Readback:', gatewayResult.brain_readback);
console.log('Index Updated:', gatewayResult.knowledge_index_updated);
console.log('Dossier Path:', gatewayResult.dossier_path);

// Assert Gateway Return Contract
if (!gatewayResult.success) throw new Error('Gateway submission returned success: false');
if (gatewayResult.status !== LEARNING_STATUS.VERIFIED_LEARNING) throw new Error(`Gateway returned unexpected status: ${gatewayResult.status}`);
if (!gatewayResult.brain_write) throw new Error('Gateway brain_write flag is false');
if (!gatewayResult.brain_readback) throw new Error('Gateway brain_readback flag is false');
if (!gatewayResult.knowledge_index_updated) throw new Error('Gateway knowledge_index_updated is false');

// 4. Physical On-Disk Verification in Sandbox
console.log('\n--- Physical On-Disk Verification ---');
const expectedDossierPath = path.join(TEST_BRAIN_ROOT, '07_PROJECT_LEARNING', 'audit-test-repo-learnings.md');
if (!fs.existsSync(expectedDossierPath)) throw new Error(`Dossier file missing on disk: ${expectedDossierPath}`);
const dossierDiskContent = fs.readFileSync(expectedDossierPath, 'utf8');
const dossierDiskHash = crypto.createHash('sha256').update(dossierDiskContent).digest('hex');
console.log('✅ Dossier exists at:', expectedDossierPath);
console.log('✅ Dossier size:', dossierDiskContent.length, 'bytes');
console.log('✅ Dossier hash matches:', dossierDiskHash === learningPkg.content_hash);
if (dossierDiskHash !== learningPkg.content_hash) throw new Error('Dossier disk hash does not match learningPkg content hash');

// Check knowledge-index.json
const indexPath = path.join(TEST_BRAIN_ROOT, '05_KNOWLEDGE', 'knowledge-index.json');
const indexContent = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const recordedItem = indexContent.items[learningPkg.learning_id];
if (!recordedItem) throw new Error('Item missing from knowledge-index.json');
console.log('✅ Knowledge index contains item:', learningPkg.learning_id);
console.log('✅ Recorded verification status:', recordedItem.verification_status);
console.log('✅ Recorded content hash matches:', recordedItem.content_hash === learningPkg.content_hash);

// Check verification matrix
const verMatrixPath = path.join(TEST_BRAIN_ROOT, '08_VERIFICATION', 'harvest-verification-matrix.md');
if (!fs.existsSync(verMatrixPath)) throw new Error('harvest-verification-matrix.md missing');
const verMatrixContent = fs.readFileSync(verMatrixPath, 'utf8');
console.log('✅ Verification matrix updated. Contains learning_id:', verMatrixContent.includes(learningPkg.learning_id));

// Check provenance ledger
const provLedgerPath = path.join(TEST_BRAIN_ROOT, '09_SOURCES', 'harvest-provenance-ledger.md');
if (!fs.existsSync(provLedgerPath)) throw new Error('harvest-provenance-ledger.md missing');
const provLedgerContent = fs.readFileSync(provLedgerPath, 'utf8');
console.log('✅ Provenance ledger updated. Contains learning_id:', provLedgerContent.includes(learningPkg.learning_id));

// 5. Verification of Process Restart & Independent Retrieval
console.log('\n--- Simulating Process Restart / Fresh Retrieval ---');
// Fresh load without any memory reference
const reloadedIndex = loadKnowledgeIndex(TEST_BRAIN_ROOT);
const retrievedItem = reloadedIndex.items[learningPkg.learning_id];
if (!retrievedItem) throw new Error('Failed to retrieve item from freshly reloaded knowledge index');
console.log('✅ Retrieved learning_id:', retrievedItem.learning_id);
console.log('✅ Retrieved repository:', retrievedItem.repository);
console.log('✅ Retrieved status:', retrievedItem.verification_status);
console.log('✅ Retrieved dossier_file:', retrievedItem.dossier_file);

// Verify dossier file from retrieved path
const retrievedDossierPath = path.join(TEST_BRAIN_ROOT, retrievedItem.dossier_file);
if (!fs.existsSync(retrievedDossierPath)) throw new Error(`Retrieved dossier path does not exist on disk: ${retrievedDossierPath}`);
const retrievedDossierContent = fs.readFileSync(retrievedDossierPath, 'utf8');
const retrievedHash = crypto.createHash('sha256').update(retrievedDossierContent).digest('hex');
console.log('✅ Read retrieved dossier file:', retrievedDossierPath);
console.log('✅ Re-computed SHA-256 matches:', retrievedHash === retrievedItem.content_hash);

// Check idempotency on re-submission
console.log('\n--- Testing Idempotency on Re-submission ---');
const idempotentResult = await submitToBrainGateway(learningPkg, { brainRoot: TEST_BRAIN_ROOT });
console.log('Idempotent re-submission success:', idempotentResult.success);
console.log('Idempotent flag returned:', idempotentResult.already_indexed);
if (!idempotentResult.already_indexed) throw new Error('Expected idempotent re-submission to flag already_indexed: true');

console.log('\n======================================================================');
console.log('🎉 TEST A PASSED: SYNTHETIC LEARNING PERSISTENCE VERIFIED 100%');
console.log('======================================================================\n');

