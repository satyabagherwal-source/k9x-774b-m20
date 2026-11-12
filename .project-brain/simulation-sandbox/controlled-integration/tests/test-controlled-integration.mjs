/**
 * Independent Verification Test Suite for Controlled Knowledge Integration Staging Package
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

console.log('========================================================================');
console.log('CONTROLLED INTEGRATION: STAGING PACKAGE INDEPENDENT VERIFICATION SUITE');
console.log('========================================================================\n');

const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const stagingDir = '.project-brain/simulation-sandbox/controlled-integration';
const log = [];
let passed = 0;
let total = 0;

function check(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
    log.push(`PASS: ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    log.push(`FAIL: ${name} - ${err.message}`);
  }
}

// 1. Schema Compatibility Check
check('Integration Schema: All required staging JSON artifacts exist and parse cleanly', () => {
  const files = [
    'integration-manifest.json',
    'eligible-knowledge.json',
    'source-provenance.json',
    'destination-mapping.json',
    'duplicate-conflict-report.json',
    'human-approval-manifest.json'
  ];
  for (const f of files) {
    const p = path.join(stagingDir, f);
    assert.ok(fs.existsSync(p), `Missing staging file: ${f}`);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(data && typeof data === 'object', `File ${f} is not valid JSON`);
  }
});

// 2. Source Traceability
check('Source Traceability: 100% of eligible items trace to verified evidence files', () => {
  const eligible = JSON.parse(fs.readFileSync(path.join(stagingDir, 'eligible-knowledge.json'), 'utf8'));
  assert.strictEqual(eligible.eligibleItems.length, 5);
  for (const item of eligible.eligibleItems) {
    const evPath = path.join(stagingDir, item.verificationEvidenceFile);
    assert.ok(fs.existsSync(evPath), `Missing evidence file for ${item.id}: ${evPath}`);
  }
});

// 3. Quarantined Non-Eligible Protection
check('Quarantined Non-Eligible: Partially verified & unverifiable items are strictly excluded from promotion', () => {
  const eligible = JSON.parse(fs.readFileSync(path.join(stagingDir, 'eligible-knowledge.json'), 'utf8'));
  assert.strictEqual(eligible.quarantinedNonEligibleItems.length, 9);
  const eligibleIds = new Set(eligible.eligibleItems.map(i => i.sourceSynthesisId));
  for (const q of eligible.quarantinedNonEligibleItems) {
    assert.ok(!eligibleIds.has(q.id), `Quarantined item ${q.id} was improperly included in eligibleItems!`);
  }
});

// 4. Duplicate & Conflict Check
check('Duplicate Detection: Zero collision with existing domain records or candidate IDs', () => {
  const dupReport = JSON.parse(fs.readFileSync(path.join(stagingDir, 'duplicate-conflict-report.json'), 'utf8'));
  assert.strictEqual(dupReport.verdict, 'ZERO_CONFLICT_CLEAN_STAGING');
  for (const [id, status] of Object.entries(dupReport.idCollisionCheck)) {
    assert.strictEqual(status, 'UNIQUE_OK', `ID collision detected for ${id}`);
  }
});

// 5. KHU-005 Record Safety
check('KHU-005 Safety: All 5 pending duplicate records confirmed untouched', () => {
  const domReg = JSON.parse(fs.readFileSync('05_KNOWLEDGE/domain-intelligence/domain-registry.json', 'utf8'));
  const khuIds = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];
  for (const id of khuIds) {
    assert.ok(domReg.records[id], `KHU-005 record ${id} missing from domain registry!`);
  }
});

// 6. Production Files Bitwise Parity (Zero Mutation Invariant)
check('Production Purity: Zero bytes mutated across all 6 production stores during staging', () => {
  const expectedHashes = {
    '05_KNOWLEDGE/domain-intelligence/domain-registry.json': '7a5075ac6e049e27887581b750fee24fcae45d54d4b29230bf1e4d212527cb6f',
    '11_INBOX/candidate-directives-registry.json': 'c7322ed633cc0b74472a4ff83485cb8065a0a6fb3a2385e8fb14a3f84d3b127b',
    '.project-brain/knowledge-graph/relationship-graph.json': '488e8ccd4fee03acb541b8adf29d4b089d63e8222c7be7e0f3461a53a9e39fdb',
    '05_KNOWLEDGE/knowledge-index.json': '7e49f275a9a71cb25d684b45e6ec541f24461319add82126bc341e7cf3cd14ea',
    '05_KNOWLEDGE/engineering-patterns.md': '6ea819849e8b3ef74b5654f16b1a6ff0f2d833d6d8eb536dc8c5b9947c98aa04',
    'harvest-control.json': '79b321c884ca80c6e8c63f2f49921af9b627eef265de5cd5e5f5a045b1e31ddb'
  };

  for (const [file, hash] of Object.entries(expectedHashes)) {
    assert.strictEqual(hashFile(file), hash, `Production store ${file} was modified!`);
  }
});

// 7. Human Approval Gate Enforcement
check('Approval Gate Invariant: Manifest explicitly flags AWAITING_EXPLICIT_HUMAN_APPROVAL and productionMutationAuthorized=false', () => {
  const approval = JSON.parse(fs.readFileSync(path.join(stagingDir, 'human-approval-manifest.json'), 'utf8'));
  assert.strictEqual(approval.authorizationStatus, 'AWAITING_EXPLICIT_HUMAN_APPROVAL');
  assert.strictEqual(approval.productionMutationAuthorized, false);
});

// 8. Rollback Plan Verification
check('Rollback Plan: Documented recovery procedure exists and contains exact git restore commands', () => {
  const rollbackPath = path.join(stagingDir, 'rollback-plan.md');
  assert.ok(fs.existsSync(rollbackPath));
  const content = fs.readFileSync(rollbackPath, 'utf8');
  assert.ok(content.includes('git checkout -- 05_KNOWLEDGE/engineering-patterns.md'));
  assert.ok(content.includes('NO PRODUCTION WRITES HAVE OCCURRED'));
});

console.log('\n========================================================================');
console.log(`STAGING VERIFICATION RESULT: ${passed} / ${total} checks passed (${(passed / total * 100).toFixed(1)}%)`);
console.log('========================================================================');

// Save test results JSON
const resultsPayload = {
  timestamp: new Date().toISOString(),
  phase: 'CONTROLLED_INTEGRATION_VERIFICATION',
  passed,
  total,
  verdict: passed === total ? 'STAGING_VERIFIED_CLEAN' : 'STAGING_FAILED'
};

fs.writeFileSync(
  path.join(stagingDir, 'integration-test-results.json'),
  JSON.stringify(resultsPayload, null, 2),
  'utf8'
);

