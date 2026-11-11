/**
 * Comprehensive Automated Verification Suite for HARV-DISC-01
 * Universal Multi-Source Discovery Scout & Acquisition Engine
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-universal-discovery-scout.mjs
 * Purpose:
 *   - Verifies all 13 universal source categories and domain alignments
 *   - Verifies source trust scoring, authority tiers, HTTPS and license gating
 *   - Verifies domain discovery priority and gap calculation
 *   - Verifies multi-source discovery across queries and domain filters
 *   - Verifies 8-axis candidate rule extraction and provenance preservation
 *   - Verifies end-to-end discovery-to-epistemic-promotion pipeline in isolated sandbox
 *   - 100% Sandbox Isolation: ZERO production contamination
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  UNIVERSAL_SOURCE_CATEGORIES,
  CURATED_DISCOVERY_SEEDS,
  evaluateUniversalSource,
  computeDomainDiscoveryPriorities,
  discoverUniversalSources,
  acquireAndExtractSourceKnowledge,
  executeUniversalDiscoveryPipeline
} from './universal-discovery-scout.mjs';

import {
  INTELLIGENCE_DOMAINS,
  loadDomainRegistry,
  getDomainStoragePaths
} from './domain-intelligence-engine.mjs';

import { KNOWLEDGE_STAGE } from './project-learning-promotion-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: HARV-DISC-01 UNIVERSAL DISCOVERY SCOUT (SANDBOX ISOLATED)');
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
// 1. Verify 13 Universal Source Categories
// ---------------------------------------------------------------------------
console.log('--- Phase 1: Universal Source Categories Structure & Invariants ---');

const expectedCategories = [
  'STANDARDS_AND_SPECIFICATIONS',
  'OFFICIAL_DOCUMENTATION',
  'RESEARCH_AND_ACADEMIA',
  'ENGINEERING_BLOGS',
  'SECURITY_ADVISORIES',
  'LEGAL_AND_REGULATORY',
  'DESIGN_AND_CREATIVE',
  'BUSINESS_AND_MARKET',
  'CONTENT_AND_DISTRIBUTION',
  'OPERATIONS_AND_INFRASTRUCTURE',
  'COMMUNITY_AND_EXPERT',
  'GIT_REPOSITORIES',
  'CHANGELOGS_AND_RELEASES'
];

assert(
  Object.keys(UNIVERSAL_SOURCE_CATEGORIES).length === 13,
  '13 Universal Source Categories defined',
  `Found: ${Object.keys(UNIVERSAL_SOURCE_CATEGORIES).length}`
);

for (const catId of expectedCategories) {
  const cat = UNIVERSAL_SOURCE_CATEGORIES[catId];
  assert(
    cat && cat.id === catId && cat.name && cat.authorityTier && typeof cat.baseTrustScore === 'number',
    `Category ${catId} metadata invariant`,
    `Tier: ${cat?.authorityTier}, BaseTrust: ${cat?.baseTrustScore}`
  );
}

// Check domain coverage across categories
const allCoveredDomains = new Set();
for (const cat of Object.values(UNIVERSAL_SOURCE_CATEGORIES)) {
  for (const d of cat.primaryDomains) allCoveredDomains.add(d);
}
assert(
  allCoveredDomains.size === 13,
  'All 13 domains (A through M) covered across universal source categories',
  `Covered: ${Array.from(allCoveredDomains).sort().join(',')}`
);

// ---------------------------------------------------------------------------
// 2. Curated Discovery Seeds Invariants
// ---------------------------------------------------------------------------
console.log('\n--- Phase 2: Curated Discovery Seeds across 13 Domains ---');

assert(
  CURATED_DISCOVERY_SEEDS.length >= 13,
  'At least 13 curated discovery seeds present',
  `Count: ${CURATED_DISCOVERY_SEEDS.length}`
);

const seedDomains = new Set(CURATED_DISCOVERY_SEEDS.map(s => s.domain));
for (const letter of Object.keys(INTELLIGENCE_DOMAINS)) {
  assert(
    seedDomains.has(letter),
    `Domain ${letter} (${INTELLIGENCE_DOMAINS[letter].name}) has at least one curated discovery seed`
  );
}

// ---------------------------------------------------------------------------
// 3. Source Trust & Evaluation Gate
// ---------------------------------------------------------------------------
console.log('\n--- Phase 3: Source Trust & Evaluation Gate ---');

// Test 3.1: Valid canonical standard seed
const validSeed = CURATED_DISCOVERY_SEEDS.find(s => s.id === 'SEED-F01'); // WCAG
const evalValid = evaluateUniversalSource(validSeed);
assert(evalValid.is_permitted === true, 'WCAG standard source passes evaluation');
assert(evalValid.trust_score >= 0.95, 'WCAG standard gets high trust score', `Score: ${evalValid.trust_score}`);
assert(evalValid.authority_tier === 'CANONICAL_STANDARD', 'WCAG gets CANONICAL_STANDARD tier');
assert(evalValid.target_domain === 'F', 'WCAG resolves target domain F');

// Test 3.2: Insecure non-HTTPS URL
const insecureSource = {
  title: 'Insecure Architecture Guide',
  url: 'http://insecure-specs.org/api',
  publisher: 'Insecure Org',
  category: 'STANDARDS_AND_SPECIFICATIONS',
  license: 'MIT'
};
const evalInsecure = evaluateUniversalSource(insecureSource);
assert(evalInsecure.is_permitted === false, 'Insecure HTTP source rejected');
assert(evalInsecure.rejection_reasons.includes('INSECURE_PROTOCOL_NON_HTTPS'), 'Flagged INSECURE_PROTOCOL_NON_HTTPS');

// Test 3.3: Missing URL
const noUrlSource = {
  title: 'Floating Guide',
  publisher: 'Ghost Publisher',
  category: 'OFFICIAL_DOCUMENTATION'
};
const evalNoUrl = evaluateUniversalSource(noUrlSource);
assert(evalNoUrl.is_permitted === false, 'Source with missing URL rejected');
assert(evalNoUrl.rejection_reasons.includes('MISSING_CANONICAL_URL'), 'Flagged MISSING_CANONICAL_URL');

// Test 3.4: Executable binary URL rejected
const exeSource = {
  title: 'Malicious Installer Guide',
  url: 'https://malicious.com/setup.exe',
  publisher: 'Sketchy Inc',
  category: 'COMMUNITY_AND_EXPERT'
};
const evalExe = evaluateUniversalSource(exeSource);
assert(evalExe.is_permitted === false, 'Executable binary URL rejected');
assert(evalExe.trust_score === 0.0, 'Executable binary trust score is zero');
assert(evalExe.rejection_reasons.includes('BINARY_EXECUTABLE_REJECTED'), 'Flagged BINARY_EXECUTABLE_REJECTED');

// Test 3.5: Proprietary non-open license rejected
const proprietarySource = {
  title: 'Secret Commercial Invariants',
  url: 'https://closed-corp.com/docs',
  publisher: 'Closed Corp',
  category: 'ENGINEERING_BLOGS',
  license: 'PROPRIETARY'
};
const evalProprietary = evaluateUniversalSource(proprietarySource);
assert(evalProprietary.is_permitted === false, 'Proprietary non-open source rejected');
assert(evalProprietary.rejection_reasons.includes('RESTRICTIVE_NON_OPEN_LICENSE'), 'Flagged RESTRICTIVE_NON_OPEN_LICENSE');

// Test 3.6: Missing publisher applies penalty
const noPubSource = {
  title: 'Anonymous Tips',
  url: 'https://open-tips.org/post',
  publisher: '',
  category: 'COMMUNITY_AND_EXPERT',
  license: 'CC-BY-4.0'
};
const evalNoPub = evaluateUniversalSource(noPubSource);
assert(evalNoPub.rejection_reasons.includes('ANONYMOUS_OR_MISSING_PUBLISHER'), 'Flagged ANONYMOUS_OR_MISSING_PUBLISHER');
assert(evalNoPub.trust_score < UNIVERSAL_SOURCE_CATEGORIES.COMMUNITY_AND_EXPERT.baseTrustScore, 'Penalty deducted from trust score');

// ---------------------------------------------------------------------------
// 4. Multi-Domain Discovery Priorities Engine
// ---------------------------------------------------------------------------
console.log('\n--- Phase 4: Domain Discovery Priorities & Gap Scores ---');

const priorities = computeDomainDiscoveryPriorities();
assert(Array.isArray(priorities) && priorities.length === 13, 'Priorities returned for all 13 domains');

// Verify ordering: descending gap score
for (let i = 1; i < priorities.length; i++) {
  assert(
    priorities[i - 1].gap_score >= priorities[i].gap_score,
    `Priorities correctly sorted descending: ${priorities[i-1].domain_letter} (${priorities[i-1].gap_score}) >= ${priorities[i].domain_letter} (${priorities[i].gap_score})`
  );
}

// ---------------------------------------------------------------------------
// 5. Multi-Source Discovery Engine
// ---------------------------------------------------------------------------
console.log('\n--- Phase 5: Multi-Source Discovery Engine ---');

// Test 5.1: Search by query token
const queryMatches = discoverUniversalSources('contrast');
assert(queryMatches.length >= 1, 'Search query "contrast" finds matching seeds', `Matches: ${queryMatches.length}`);
assert(queryMatches[0].domain === 'F', 'Query "contrast" resolved Domain F (Design)');

// Test 5.2: Filter by domain
const domainKMatches = discoverUniversalSources({ domain: 'K' });
assert(domainKMatches.length >= 1, 'Filter by domain K finds matching seeds', `Matches: ${domainKMatches.length}`);
assert(domainKMatches[0].domain === 'K', 'Matched seed is strictly Domain K (OWASP ASVS)');

// Test 5.3: Synthetic fallback candidate when no seed matches
const syntheticMatches = discoverUniversalSources({ query: 'nonexistent-xyz-random-12345', domain: 'B' });
assert(syntheticMatches.length === 1, 'Synthetic candidate generated when query yields no exact seeds');
assert(syntheticMatches[0].domain === 'B', 'Synthetic candidate assigned target domain B');

// ---------------------------------------------------------------------------
// 6. Knowledge Acquisition & 8-Axis Rule Extraction
// ---------------------------------------------------------------------------
console.log('\n--- Phase 6: Knowledge Acquisition & 8-Axis Rule Extraction ---');

const extraction = acquireAndExtractSourceKnowledge(validSeed);
assert(extraction.success === true, 'Knowledge extraction succeeded');
assert(extraction.stage === KNOWLEDGE_STAGE.EXTRACTED, 'Extraction marked as EXTRACTED stage');

const cand = extraction.candidate;
assert(cand.candidate_id && cand.candidate_id.startsWith('PLCAND-'), 'Candidate has canonical PLCAND- id');
assert(cand.title && cand.title.length > 5, 'Candidate has meaningful title');
assert(cand.universal_invariant && cand.universal_invariant.length > 10, 'Candidate has universal invariant');
assert(cand.why && cand.why.length > 10, 'Candidate has why explanation');
assert(cand.when_to_apply && cand.when_to_apply.length > 10, 'Candidate has when_to_apply trigger');
assert(cand.verified_implementation_pattern && cand.verified_implementation_pattern.length > 10, 'Candidate has implementation pattern');
assert(cand.negative_constraint && cand.negative_constraint.length > 10, 'Candidate has negative constraint');
assert(cand.verification_method && cand.verification_method.length > 10, 'Candidate has verification method');

// Verify Source Provenance
assert(cand.source_provenance && cand.source_provenance.source_uri === validSeed.url, 'Candidate source URI matches seed URL');
assert(cand.source_provenance.authority_tier === 'CANONICAL_STANDARD', 'Candidate preserves authority tier');
assert(cand.evidence && cand.evidence.verification_status === 'EMPIRICAL_CANONICAL', 'Candidate preserves verification evidence');

// ---------------------------------------------------------------------------
// 7. End-to-End Discovery to Epistemic Promotion (Isolated Sandbox)
// ---------------------------------------------------------------------------
console.log('\n--- Phase 7: End-to-End Discovery Pipeline (Isolated Sandbox) ---');

const tmpDir = path.join(os.tmpdir(), `brain-harv-disc-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

try {
  // Setup sandbox directories
  const sandboxKnowledgeDir = path.join(tmpDir, '05_KNOWLEDGE', 'domain-intelligence');
  fs.mkdirSync(sandboxKnowledgeDir, { recursive: true });

  // Initialize fresh mock domain registry in sandbox
  const mockRegistry = {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    records: {},
    domains: {}
  };
  for (const letter of Object.keys(INTELLIGENCE_DOMAINS)) {
    mockRegistry.domains[letter] = {
      id: INTELLIGENCE_DOMAINS[letter].id,
      name: INTELLIGENCE_DOMAINS[letter].name,
      record_ids: []
    };
  }
  fs.writeFileSync(
    path.join(sandboxKnowledgeDir, 'domain-registry.json'),
    JSON.stringify(mockRegistry, null, 2),
    'utf-8'
  );

  // Test 7.1: High-Impact Domain Staging Check (Domain G requires human review)
  const stagedReport = executeUniversalDiscoveryPipeline({
    query: 'RFC 7807',
    domain: 'G',
    dryRun: true,
    brainRoot: tmpDir
  });

  assert(stagedReport.total_sources_discovered >= 1, 'Discovered RFC 7807 seed');
  assert(stagedReport.sources_permitted >= 1, 'Permitted RFC 7807 source');
  assert(stagedReport.candidates_extracted >= 1, 'Extracted rule candidate');
  assert(stagedReport.staged_for_human.length >= 1, 'High-Impact Domain G correctly staged for human review');
  assert(
    stagedReport.staged_for_human[0].reasons[0].includes('HIGH_IMPACT_DOMAIN_STAGED'),
    'Safety invariant: High-Impact domain blocked from autonomous self-approval'
  );

  // Test 7.2: Dry-Run Pipeline on Autonomous Domain (Domain H: Technical Construction)
  const dryRunReport = executeUniversalDiscoveryPipeline({
    query: 'stream.pipeline',
    domain: 'H',
    dryRun: true,
    brainRoot: tmpDir
  });

  assert(dryRunReport.total_sources_discovered >= 1, 'Dry-run discovered stream.pipeline seed');
  assert(dryRunReport.sources_permitted >= 1, 'Dry-run permitted stream.pipeline source');
  assert(dryRunReport.candidates_extracted >= 1, 'Dry-run extracted rule candidate');
  assert(dryRunReport.promoted.length >= 1, 'Dry-run promoted item in report');
  assert(dryRunReport.promoted[0].dryRun === true, 'Promoted report item marked dryRun === true');

  // Verify that sandbox registry was NOT modified during dry-run
  const dryRegistry = JSON.parse(fs.readFileSync(path.join(sandboxKnowledgeDir, 'domain-registry.json'), 'utf-8'));
  assert(dryRegistry.domains.H.record_ids.length === 0, 'Dry-run wrote ZERO records to registry');

  // Test 7.3: Live Sandboxed Promotion
  const liveReport = executeUniversalDiscoveryPipeline({
    query: 'stream.pipeline',
    domain: 'H',
    dryRun: false,
    brainRoot: tmpDir
  });

  assert(liveReport.promoted.length >= 1, 'Live pipeline promoted candidate into sandbox registry');
  const liveRegistry = JSON.parse(fs.readFileSync(path.join(sandboxKnowledgeDir, 'domain-registry.json'), 'utf-8'));
  assert(liveRegistry.domains.H.record_ids.length >= 1, 'Sandbox Domain H registry now contains promoted record ID');

  const promotedId = liveRegistry.domains.H.record_ids[0];
  const recordContent = liveRegistry.records[promotedId];
  assert(recordContent !== undefined, `Promoted record ${promotedId} retrievable in sandbox registry`);
  assert(recordContent.domain_letter === 'H', 'Promoted record has domain H');
  assert(recordContent.provenance && recordContent.provenance.source_uri.includes('nodejs.org'), 'Promoted record has Node.js provenance');

  // Test 7.4: Duplicate Interception on Second Execution
  const dupReport = executeUniversalDiscoveryPipeline({
    query: 'stream.pipeline',
    domain: 'H',
    dryRun: false,
    brainRoot: tmpDir
  });

  assert(dupReport.skipped_duplicates.length >= 1, 'Second pipeline run correctly detects existing record as duplicate');
  assert(dupReport.skipped_duplicates[0].stage === KNOWLEDGE_STAGE.DUPLICATE_SKIPPED, 'Stage marked DUPLICATE_SKIPPED');
  assert(dupReport.promoted.length === 0, 'Zero duplicate records promoted on second run');

  // Test 7.5: Verify Production AI-Builder-Brain registry was completely untouched
  const prodRegistry = loadDomainRegistry(BRAIN_ROOT);
  const prodHasTempRecord = Object.values(prodRegistry.domains || {}).some(d => (d.record_ids || []).includes(promotedId));
  assert(!prodHasTempRecord, 'Strict Sandbox Isolation: Production registry has 0 temporary test records');

} finally {
  // Clean up sandbox
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (err) {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`📊 HARV-DISC-01 VERIFICATION SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 HARV-DISC-01 UNIVERSAL DISCOVERY SCOUT FULLY VERIFIED!\n');
  process.exit(0);
}
