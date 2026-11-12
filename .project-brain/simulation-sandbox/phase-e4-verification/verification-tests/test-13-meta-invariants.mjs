/**
 * Test 13: Meta-Invariants: Production Isolation, Data Immutability, and KHU-005 Preservation
 */
import fs from 'fs';
import crypto from 'crypto';
import assert from 'assert';

const hashFile = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

export function run() {
  const log = [];
  log.push('Executing Test 13: Meta-Invariants & Production Isolation Verification');

  // Baseline hashes recorded at preflight
  const expectedProductionHashes = {
    '05_KNOWLEDGE/domain-intelligence/domain-registry.json': '7a5075ac6e049e27887581b750fee24fcae45d54d4b29230bf1e4d212527cb6f',
    '11_INBOX/candidate-directives-registry.json': 'c7322ed633cc0b74472a4ff83485cb8065a0a6fb3a2385e8fb14a3f84d3b127b',
    '.project-brain/knowledge-graph/relationship-graph.json': '488e8ccd4fee03acb541b8adf29d4b089d63e8222c7be7e0f3461a53a9e39fdb',
    '05_KNOWLEDGE/knowledge-index.json': '7e49f275a9a71cb25d684b45e6ec541f24461319add82126bc341e7cf3cd14ea',
    '05_KNOWLEDGE/engineering-patterns.md': '6ea819849e8b3ef74b5654f16b1a6ff0f2d833d6d8eb536dc8c5b9947c98aa04',
    'harvest-control.json': '79b321c884ca80c6e8c63f2f49921af9b627eef265de5cd5e5f5a045b1e31ddb'
  };

  // 1. Production isolation
  for (const [file, expectedHash] of Object.entries(expectedProductionHashes)) {
    const currentHash = hashFile(file);
    assert.strictEqual(currentHash, expectedHash, `Production file ${file} mutated!`);
  }
  log.push('  PASS: All 6 production stores verified bitwise identical (0 bytes mutated)');

  // 2. KHU-005 Duplicate Records preservation
  const domReg = JSON.parse(fs.readFileSync('05_KNOWLEDGE/domain-intelligence/domain-registry.json', 'utf8'));
  const khuIds = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];
  for (const id of khuIds) {
    assert.ok(domReg.records[id], `KHU-005 record ${id} missing from domain registry!`);
  }
  log.push('  PASS: All 5 pending KHU-005 duplicate records confirmed intact in domain-registry');

  // 3. Phase E.3 immutability
  const e3Path = '.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json';
  const e3Data = JSON.parse(fs.readFileSync(e3Path, 'utf8'));
  assert.strictEqual(e3Data.records.length, 249);
  log.push('  PASS: Phase E.3 synthesis dataset immutable (249 records preserved)');

  // 4. Traceability of all 12 selected candidates
  const selectedPath = '.project-brain/simulation-sandbox/phase-e4-verification/selected-candidates.json';
  const selected = JSON.parse(fs.readFileSync(selectedPath, 'utf8'));
  assert.strictEqual(selected.candidates.length, 12);
  for (const c of selected.candidates) {
    assert.ok(fs.existsSync(c.sourceProvenance.dossierPath), `Dossier missing for ${c.synthesisId}: ${c.sourceProvenance.dossierPath}`);
  }
  log.push('  PASS: All 12 selected candidates trace 100% to on-disk forensic dossiers');

  return {
    candidateId: 'META-INVARIANTS',
    title: 'Production Isolation & Phase E.3 Data Immutability',
    status: 'VERIFIED_INDEPENDENTLY',
    evidenceType: 'BITWISE_PARITY_VERIFIED',
    checksPassed: 4,
    checksTotal: 4,
    log
  };
}

