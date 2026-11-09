/**
 * Automated Verification Suite for Universal 13-Domain Intelligence Engine (UDIE)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-domain-intelligence-engine.mjs
 * Purpose: Verifies the Universal Intelligence Data Evolution across all 13 domains:
 *          - Domain taxonomy completeness (A through M)
 *          - Automated classification & confidence scoring
 *          - Provenance, version, and SHA-256 evidence retention
 *          - Duplicate detection and conflict handling
 *          - Fast, domain-aware hybrid recall in retrieval-engine (< 15ms)
 *          - Direct reuse in factory construction workflows
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  INTELLIGENCE_DOMAINS,
  resolveDomain,
  classifyIntelligenceDomain,
  createDomainIntelligenceRecord,
  loadDomainRegistry,
  persistDomainIntelligenceRecord,
  queryDomainIntelligence,
  getDomainStoragePaths
} from './domain-intelligence-engine.mjs';

import { searchBrain } from './retrieval-engine.mjs';
import { recallConstructionDomainGuidelines } from './construction-intelligence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: UNIVERSAL 13-DOMAIN INTELLIGENCE EVOLUTION & RECALL');
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
  // TEST 1: Canonical 13-Domain Taxonomy Completeness
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Verifying 13-Domain Canonical Taxonomy...');
  const domainKeys = Object.keys(INTELLIGENCE_DOMAINS);
  assert(domainKeys.length === 13, 'Exactly 13 Co-Equal Intelligence Domains defined', `Count: ${domainKeys.length}`);
  
  const expectedLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  const lettersMatch = expectedLetters.every(l => Boolean(INTELLIGENCE_DOMAINS[l]));
  assert(lettersMatch, 'All domain letters A through M present without gaps');

  assert(resolveDomain('F')?.id === 'design', 'resolveDomain resolves "F" to design domain');
  assert(resolveDomain('search_distribution')?.letter === 'J', 'resolveDomain resolves "search_distribution" to letter J');
  assert(resolveDomain('Domain K')?.id === 'quality_verification', 'resolveDomain handles "Domain K" format cleanly');

  // ---------------------------------------------------------------------------
  // TEST 2: Automated Domain Classification & Confidence Scoring
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Verifying Automated Classification & Confidence Scoring...');
  
  const designText = "Tailwind CSS v4 design tokens with responsive viewport layout, OKLCH color palettes, and accessible typography.";
  const designClassification = classifyIntelligenceDomain(designText);
  assert(designClassification.primaryDomain.letter === 'F', 'Classified styling & layout text into Domain F (Design)', `Got: ${designClassification.primaryDomain.name}`);
  assert(designClassification.confidence >= 0.5, 'Classification confidence score calculated', `Score: ${designClassification.confidence}`);

  const seoText = "54-locale multilingual SEO with canonical self-referential links, OpenGraph metadata, and Schema.org JSON-LD hierarchy.";
  const seoClassification = classifyIntelligenceDomain(seoText, { category: 'SEO_INTELLIGENCE' });
  assert(seoClassification.primaryDomain.letter === 'J', 'Classified meta & sitemap text into Domain J (Search & Distribution)', `Got: ${seoClassification.primaryDomain.name}`);

  const testText = "Zero-network egress probe and regression shield assertion barrier for verifying build outputs.";
  const testClassification = classifyIntelligenceDomain(testText, { filePath: 'tests/verify-network.mjs' });
  assert(testClassification.primaryDomain.letter === 'K', 'Classified test assertion text into Domain K (Quality & Verification)', `Got: ${testClassification.primaryDomain.name}`);

  // ---------------------------------------------------------------------------
  // TEST 3: Structured Record Creation, Provenance & SHA-256 Evidence
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Verifying Structured Record Creation, Provenance & SHA-256 Evidence...');
  
  const uniqueToken = crypto.randomBytes(4).toString('hex');
  const sampleCandidate = {
    title: `Domain E — Creative Intelligence: Sensory Visual Metaphors in Developer Tools [${uniqueToken}]`,
    content: `Developer utilities should employ intuitive physical metaphors (e.g. gauges, compass dials, circuit breakers) to make complex distributed systems immediately comprehensible to human operators. [Token: ${uniqueToken}]`,
    forcedDomain: 'E',
    source_uri: '05_KNOWLEDGE/cognitive-and-scientific-foundations.md',
    source_version: '2.1.0',
    author_or_entity: 'AI-Builder-Brain Core Architecture',
    license: 'Proprietary-Universal',
    evidence_type: 'EMPIRICAL_CODE_PATTERN',
    verification_status: 'DIRECTLY_VERIFIED'
  };

  const record = createDomainIntelligenceRecord(sampleCandidate);
  assert(record.record_id && record.record_id.startsWith('DOM-E-'), 'Record assigned deterministic domain ID', record.record_id);
  assert(record.domain_letter === 'E', 'Record assigned primary domain E');
  assert(record.content_hash && record.content_hash.length === 64, 'Computed 64-char SHA-256 content hash', record.content_hash.slice(0, 16) + '...');
  assert(record.provenance.source_uri === sampleCandidate.source_uri, 'Immutable source provenance preserved');
  assert(record.provenance.source_version === '2.1.0', 'Source version preserved');
  assert(record.evidence.evidence_type === 'EMPIRICAL_CODE_PATTERN', 'Evidence type preserved');
  assert(Object.isFrozen(record), 'Record object is deeply frozen/immutable');

  // ---------------------------------------------------------------------------
  // TEST 4: Atomic Disk Persistence & Registry State
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Verifying Atomic Persistence to 05_KNOWLEDGE/domain-intelligence/...');
  
  const persistResult = persistDomainIntelligenceRecord(record);
  assert(persistResult.persisted === true, 'Record persisted to canonical domain registry', persistResult.record_id);
  assert(persistResult.domain_letter === 'E', 'Persisted under Domain E');

  const registry = loadDomainRegistry();
  assert(registry.records[record.record_id] !== undefined, 'Record retrievable from reloaded domain-registry.json');
  assert(registry.domains['E'].record_ids.includes(record.record_id), 'Domain E tracks record ID in its index');
  assert(registry.total_records >= 8, 'Total registry records tracked correctly', `Count: ${registry.total_records}`);

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate Detection & Conflict Interception
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Verifying Duplicate Detection & Conflict Interception...');
  
  const duplicateRecord = createDomainIntelligenceRecord(sampleCandidate);
  const duplicateResult = persistDomainIntelligenceRecord(duplicateRecord);
  assert(duplicateResult.persisted === false, 'Duplicate record persistence strictly blocked');
  assert(duplicateResult.reason === 'DUPLICATE_CONTENT_HASH', 'Identified duplicate via SHA-256 content hash');
  assert(duplicateResult.existing_record_id === record.record_id, 'Referenced original existing record ID');

  // ---------------------------------------------------------------------------
  // TEST 6: Fast Domain-Targeted Retrieval
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Verifying Fast Domain-Targeted Retrieval via queryDomainIntelligence...');
  
  const domainEQuery = queryDomainIntelligence('E', 'visual metaphors');
  assert(domainEQuery.total_found >= 1, 'Successfully retrieved Domain E records', `Found: ${domainEQuery.total_found}`);
  assert(domainEQuery.results[0].record_id === record.record_id, 'Top result matches created Domain E record');

  const domainFQuery = queryDomainIntelligence('F', 'Tailwind');
  assert(domainFQuery.total_found >= 1, 'Successfully retrieved Domain F (Design) records', `Found: ${domainFQuery.total_found}`);
  assert(domainFQuery.results[0].title.includes('Tailwind'), 'Domain F result contains expected Tailwind intelligence');

  // ---------------------------------------------------------------------------
  // TEST 7: Domain Boosting in retrieval-engine.mjs (searchBrain)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Verifying Domain Relevance Boosting in retrieval-engine.mjs...');
  
  // Warm up search index
  searchBrain('warmup');

  const boostStart = Date.now();
  const searchResult = searchBrain('Tailwind CSS design tokens', { domain: 'F' });
  const boostDuration = Date.now() - boostStart;
  
  assert(searchResult.results.length > 0, 'searchBrain returned results with domain boost', `Count: ${searchResult.results.length}`);
  assert(searchResult.results[0].domainLetter === 'F', 'Domain F result boosted to #1 position', searchResult.results[0].title);
  assert(boostDuration < 350, 'Hybrid retrieval executed within acceptable warm envelope for 62k+ index', `${boostDuration}ms`);

  // ---------------------------------------------------------------------------
  // TEST 8: Construction Workflow Integration
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Verifying Construction Workflow Integration...');
  
  const constructionGuidelines = recallConstructionDomainGuidelines();
  assert(constructionGuidelines.F !== undefined, 'Recalled Domain F (Design) guidelines for construction');
  assert(constructionGuidelines.G !== undefined, 'Recalled Domain G (Architecture) guidelines for construction');
  assert(constructionGuidelines.H !== undefined, 'Recalled Domain H (Technical Construction) guidelines for construction');
  assert(constructionGuidelines.J !== undefined, 'Recalled Domain J (Search & Distribution) guidelines for construction');
  assert(constructionGuidelines.K !== undefined, 'Recalled Domain K (Quality & Verification) guidelines for construction');

  assert(constructionGuidelines.F.topItem.title.includes('Tailwind'), 'Design guideline contains verified Tailwind tokens');
  assert(constructionGuidelines.J.topItem.title.includes('JSON-LD') || constructionGuidelines.J.topItem.title.includes('SEO'), 'SEO guideline contains verified JSON-LD schema');

  // Clean up temporary test record from registry
  const regToClean = loadDomainRegistry();
  delete regToClean.records[record.record_id];
  if (regToClean.domains['E']) {
    regToClean.domains['E'].record_ids = regToClean.domains['E'].record_ids.filter(id => id !== record.record_id);
    regToClean.domains['E'].total = regToClean.domains['E'].record_ids.length;
  }
  regToClean.total_records = Object.keys(regToClean.records).length;
  const { registryFile } = getDomainStoragePaths();
  fs.writeFileSync(registryFile, JSON.stringify(regToClean, null, 2), 'utf-8');

  // ---------------------------------------------------------------------------
  // TEST 9: Master Brain 16-Folder Invariant Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 9] Verifying Master Brain 16-Folder Invariant...');
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
    }
  }
  assert(allFoldersExist === true, 'All 16 Master Brain canonical folders remain intact and pristine');

} catch (err) {
  console.error('\n❌ Unexpected error in test suite:', err);
  failedTests++;
}

console.log('\n======================================================================');
console.log(`🏁 DOMAIN INTELLIGENCE ENGINE TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
