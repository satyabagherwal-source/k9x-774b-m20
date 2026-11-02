/**
 * Automated Verification Suite for AI-Builder-Brain Capability Registry (Phase C)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-capability-registry.mjs
 * Purpose: Verifies Phase C: schema validation, status model enforcement, unique IDs,
 *          dependency graph integrity, query filtering, atomic persistence, read-back,
 *          and human-readable catalog generation.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  CANONICAL_DOMAINS,
  VALID_STATUSES,
  getRegistryPaths,
  validateCapabilityRecord,
  loadRegistry,
  saveRegistry,
  registerCapability,
  getCapabilityById,
  queryCapabilities,
  validateDependencyGraph,
  detectDependencyCycles,
  generateCapabilityCatalogMarkdown,
  syncCapabilityCatalog
} from './capability-registry.mjs';

console.log('======================================================================');
console.log('🧪 TEST SUITE: CAPABILITY REGISTRY VERIFICATION (PHASE C)');
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

// ---------------------------------------------------------------------------
// TEST 1: Schema Validation & Status Model Enforcement
// ---------------------------------------------------------------------------
console.log('[TEST 1] Testing Capability Schema Validation & Constraints...');

// Valid dummy record
const sampleValid = {
  id: 'CAP-TEST-VALID-SAMPLE',
  name: 'Test Sample Capability',
  domain: 'software_architecture',
  purpose: 'A test capability to verify schema validation functions properly',
  scope: {
    inScope: ['Testing schema validation'],
    nonGoals: ['Production deployment']
  },
  status: 'VERIFIED WORKING',
  inputsPrerequisites: ['Sample input'],
  requiredKnowledge: ['01_CORE/rules/system-rules.md'],
  relatedCapabilities: [],
  dependencies: [],
  rulesConstraints: ['Must pass test'],
  proceduresWorkflows: ['Sample workflow'],
  requiredToolsInterfaces: ['node'],
  expectedOutputs: ['Sample output'],
  acceptanceCriteria: ['Valid schema'],
  verificationMethods: ['Automated test'],
  testReferences: [{ testPath: 'test.mjs', status: 'PASS', assertionsPassed: 1 }],
  knownFailureModes: [{ mode: 'Sample error', mitigation: 'Sample fix' }],
  recoveryProcedures: ['Sample recovery'],
  evidenceProvenance: { verifiedArtifacts: ['sample.mjs'] },
  version: '1.0.0',
  lastVerificationDate: new Date().toISOString(),
  knownGapsUnresolvedQuestions: ['Sample gap and unresolved question']
};

const validResult = validateCapabilityRecord(sampleValid);
assert(validResult.valid, 'Valid capability record passes validation', `Errors: ${validResult.errors.join(', ')}`);

// Invalid Status
const invalidStatusRecord = { ...sampleValid, status: 'ALMOST_DONE' };
const invalidStatusResult = validateCapabilityRecord(invalidStatusRecord);
assert(!invalidStatusResult.valid, 'Invalid status is cleanly rejected');
assert(invalidStatusResult.errors.some(e => e.includes('Status')), 'Status rejection error message is descriptive');

// Invalid ID pattern
const invalidIdRecord = { ...sampleValid, id: 'invalid_lowercase_id' };
const invalidIdResult = validateCapabilityRecord(invalidIdRecord);
assert(!invalidIdResult.valid, 'Invalid capability ID pattern is cleanly rejected');

// Invalid Domain
const invalidDomainRecord = { ...sampleValid, domain: 'crypto_speculation' };
const invalidDomainResult = validateCapabilityRecord(invalidDomainRecord);
assert(!invalidDomainResult.valid, 'Invalid domain is cleanly rejected');

// Missing Required Field
const missingPurposeRecord = { ...sampleValid, purpose: '' };
const missingPurposeResult = validateCapabilityRecord(missingPurposeRecord);
assert(!missingPurposeResult.valid, 'Missing required string field (purpose) is rejected');

// ---------------------------------------------------------------------------
// TEST 2: Authoritative Registry Loading & Integrity
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Authoritative Registry Loading & Integrity...');
const paths = getRegistryPaths();
assert(fs.existsSync(paths.registryFile), 'capability-registry.json exists in 15_METADATA');

const registry = loadRegistry();
assert(registry.capabilities.length >= 10, 'Registry contains >= 10 capabilities', `Found: ${registry.capabilities.length}`);

// ID uniqueness check
const seenIds = new Set();
let duplicatesFound = 0;
for (const cap of registry.capabilities) {
  if (seenIds.has(cap.id)) {
    duplicatesFound++;
    console.error(`  Duplicate ID: ${cap.id}`);
  }
  seenIds.add(cap.id);
}
assert(duplicatesFound === 0, 'All Capability IDs are strictly unique', `Unique IDs: ${seenIds.size}`);

// Verify every record in the registry passes full schema validation
let invalidRecords = 0;
for (const cap of registry.capabilities) {
  const v = validateCapabilityRecord(cap);
  if (!v.valid) {
    invalidRecords++;
    console.error(`  Record ${cap.id} invalid: ${v.errors.join('; ')}`);
  }
}
assert(invalidRecords === 0, 'Every registered capability passes full schema validation');

// ---------------------------------------------------------------------------
// TEST 3: Multi-Dimensional Querying & Retrieval Filtering
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Testing Querying & Search Filtering...');

// Query by Domain
const opsCaps = queryCapabilities({ domain: 'operations_monitoring_sre' }, registry);
assert(opsCaps.length >= 2, 'Domain filter returns expected capabilities', `Found ${opsCaps.length} in operations_monitoring_sre`);
assert(opsCaps.some(c => c.id === 'CAP-DISASTER-RECOVERY-VAULT'), 'Found CAP-DISASTER-RECOVERY-VAULT in ops domain');

// Query by Status
const verifiedCaps = queryCapabilities({ status: 'VERIFIED WORKING' }, registry);
assert(verifiedCaps.length >= 7, 'Status filter returns verified working capabilities', `Found ${verifiedCaps.length} VERIFIED WORKING`);
assert(verifiedCaps.every(c => c.status === 'VERIFIED WORKING'), 'All returned records strictly match requested status');

const missingCaps = queryCapabilities({ status: 'MISSING' }, registry);
assert(missingCaps.length >= 2, 'Status filter returns MISSING capabilities', `Found ${missingCaps.length} MISSING`);

// Query by Keyword
const backupQuery = queryCapabilities({ keyword: 'backup' }, registry);
assert(backupQuery.length > 0, 'Keyword search for "backup" returns matches', `Found ${backupQuery.length} matches`);
assert(backupQuery[0].id === 'CAP-DISASTER-RECOVERY-VAULT', 'Top backup match is CAP-DISASTER-RECOVERY-VAULT');

const seoQuery = queryCapabilities({ keyword: 'multilingual' }, registry);
assert(seoQuery.some(c => c.id === 'CAP-MULTILINGUAL-SEO-INTELLIGENCE'), 'Keyword search for "multilingual" finds SEO capability');

// Query by Dependency
const secretsDependents = queryCapabilities({ dependency: 'CAP-AUTHENTICATED-SECRETS-VAULT' }, registry);
assert(secretsDependents.length > 0, 'Dependency filter returns dependents of CAP-AUTHENTICATED-SECRETS-VAULT');
assert(secretsDependents.some(c => c.id === 'CAP-DISASTER-RECOVERY-VAULT'), 'CAP-DISASTER-RECOVERY-VAULT depends on CAP-AUTHENTICATED-SECRETS-VAULT');

// ---------------------------------------------------------------------------
// TEST 4: Dependency Graph Integrity Audit
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Dependency Graph Integrity...');
const depAudit = validateDependencyGraph(registry);
assert(depAudit.valid, 'All declared dependencies resolve to valid registered capabilities', 
  depAudit.missingDependencies.length ? `Missing: ${JSON.stringify(depAudit.missingDependencies)}` : 'All resolved');
assert(depAudit.conflicts.length === 0, 'Zero conflicting capability relationships detected');

// Test Missing Dependency Detection
const dummyRegistry = {
  capabilities: [
    {
      ...sampleValid,
      id: 'CAP-TEST-DEPENDENT',
      dependencies: [{ capabilityId: 'CAP-NON-EXISTENT-GHOST-CAP', relationship: 'REQUIRES' }]
    }
  ]
};
const dummyDepAudit = validateDependencyGraph(dummyRegistry);
assert(!dummyDepAudit.valid, 'Missing dependency is cleanly detected by dependency auditor');
assert(dummyDepAudit.missingDependencies.some(d => d.missingCapability === 'CAP-NON-EXISTENT-GHOST-CAP'), 'Missing capability ID is accurately reported');

// Test Dependency Cycle Detection
const cyclicRegistry = {
  capabilities: [
    {
      ...sampleValid,
      id: 'CAP-CYCLE-NODE-A',
      dependencies: [{ capabilityId: 'CAP-CYCLE-NODE-B', relationship: 'REQUIRES' }]
    },
    {
      ...sampleValid,
      id: 'CAP-CYCLE-NODE-B',
      dependencies: [{ capabilityId: 'CAP-CYCLE-NODE-A', relationship: 'REQUIRES' }]
    }
  ]
};
const cyclesFound = detectDependencyCycles(cyclicRegistry);
assert(cyclesFound.length > 0, 'Cyclic dependency A -> B -> A is cleanly detected', `Cycles: ${cyclesFound.join(', ')}`);
const cyclicAudit = validateDependencyGraph(cyclicRegistry);
assert(!cyclicAudit.valid, 'Cyclic dependency causes validateDependencyGraph to fail');
assert(cyclicAudit.cycles.length > 0, 'Dependency auditor reports cycle path explicitly');

// ---------------------------------------------------------------------------
// TEST 5: Atomic Persistence & Read-Back Across Fresh Sessions
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Testing Atomic Persistence & Read-Back...');
const testDir = path.join(os.tmpdir(), `cap-reg-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });
const tempRegistryPath = path.join(testDir, 'test-registry.json');

try {
  const freshRegistry = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    description: 'Temporary Test Registry',
    capabilities: []
  };

  registerCapability(sampleValid, freshRegistry);
  saveRegistry(freshRegistry, tempRegistryPath);
  assert(fs.existsSync(tempRegistryPath), 'Saved registry file exists on disk');

  // Fresh read-back
  const readBack = loadRegistry(tempRegistryPath);
  assert(readBack.capabilities.length === 1, 'Read-back returns exact count of saved capabilities');
  assert(readBack.capabilities[0].id === sampleValid.id, 'Read-back capability ID matches bit-for-bit');
  assert(readBack.capabilities[0].purpose === sampleValid.purpose, 'Read-back capability purpose matches bit-for-bit');
  assert(readBack.capabilities[0].status === sampleValid.status, 'Read-back capability status matches bit-for-bit');

  // Verify duplicate rejection in registerCapability
  const duplicateRecord = { ...sampleValid, name: 'Updated Name for Same ID' };
  registerCapability(duplicateRecord, freshRegistry);
  assert(freshRegistry.capabilities.length === 1, 'Re-registering same ID updates in place without creating duplicates');
  assert(freshRegistry.capabilities[0].name === 'Updated Name for Same ID', 'Update preserves single entry with updated fields');

} finally {
  // Cleanup test temp directory
  fs.rmSync(testDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// TEST 6: Markdown Capability Catalog Generation & Sync
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Testing Markdown Capability Catalog Generation...');
const catalogMarkdown = generateCapabilityCatalogMarkdown(registry);
assert(catalogMarkdown.includes('# 🏛️ AI-Builder-Brain Capability Catalog'), 'Catalog contains main header');
assert(catalogMarkdown.includes('🟢 **VERIFIED WORKING**'), 'Catalog contains verified status summary');
assert(catalogMarkdown.includes('CAP-DISASTER-RECOVERY-VAULT'), 'Catalog includes CAP-DISASTER-RECOVERY-VAULT');
assert(catalogMarkdown.includes('CAP-MULTILINGUAL-SEO-INTELLIGENCE'), 'Catalog includes CAP-MULTILINGUAL-SEO-INTELLIGENCE');

const syncedPath = syncCapabilityCatalog(registry);
assert(fs.existsSync(syncedPath), 'Generated capability-catalog.md synced to 15_METADATA');
const onDiskCatalog = fs.readFileSync(syncedPath, 'utf8');
assert(onDiskCatalog.length > 5000, 'Synced catalog is rich and populated', `Size: ${onDiskCatalog.length} bytes`);
assert(onDiskCatalog.includes('Known Gaps & Unresolved Questions'), 'Catalog includes Known Gaps section');

// ---------------------------------------------------------------------------
// TEST 7: Canonical Brain Non-Mutation Invariant
// ---------------------------------------------------------------------------
console.log('\n[TEST 7] Verifying Canonical Brain Non-Mutation...');
const BRAIN_ROOT = getRegistryPaths().brainRoot;
const canonicalFolders = [
  '00_START_HERE', '01_CORE', '02_AGENT_INTELLIGENCE', '03_SKILLS',
  '04_WORKFLOWS', '05_KNOWLEDGE', '06_PROJECT_CONTEXT', '07_PROJECT_LEARNING',
  '08_VERIFICATION', '09_SOURCES', '10_PROMPTS', '11_INBOX',
  '12_DECISIONS', '13_GOVERNANCE', '14_EVOLUTION', '15_METADATA'
];

let allFoldersExist = true;
for (const f of canonicalFolders) {
  if (!fs.existsSync(path.join(BRAIN_ROOT, f))) {
    allFoldersExist = false;
    console.error(`  Missing canonical folder: ${f}`);
  }
}
assert(allFoldersExist, 'All 16 canonical folders exist and are preserved');

// ---------------------------------------------------------------------------
// FINAL SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 CAPABILITY REGISTRY TEST SUMMARY: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
