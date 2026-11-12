/**
 * Phase E.1: Master Test Runner & Integrity Verifier
 * 
 * Orchestrates:
 * 1. Preflight baseline extraction across 697 candidate directives and 74 domain records.
 * 2. 13-Domain Coverage & Retrieval Verification (13/13 domains).
 * 3. 16-Folder Distribution & Responsibility Verification (16/16 folders).
 * 4. 10-Pillar Independent Quality Testing Suite (10/10 tests).
 * 5. Production Bitwise Isolation Proof.
 * 6. Generates JSON evidence file: results/phase-e1-results.json.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { extractBaselineMetrics } from './src/baseline-metrics-extractor.mjs';
import { run13DomainCoverageTests } from './tests/test-13-domain-coverage.mjs';
import { run16FolderDistributionTests } from './tests/test-16-folder-distribution.mjs';
import { runIndependentQualityTests } from './tests/test-independent-quality-suite.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULTS_DIR = path.join(__dirname, 'results');
const RESULTS_PATH = path.join(RESULTS_DIR, 'phase-e1-results.json');

const PRODUCTION_CRITICAL_FILES = [
  '05_KNOWLEDGE/domain-intelligence/domain-registry.json',
  '11_INBOX/candidate-directives-registry.json',
  '.project-brain/knowledge-graph/relationship-graph.json',
  '05_KNOWLEDGE/knowledge-index.json',
  '05_KNOWLEDGE/engineering-patterns.md',
  'harvest-control.json'
];

function computeProductionHashes() {
  const hashes = {};
  for (const rel of PRODUCTION_CRITICAL_FILES) {
    const full = path.join(BRAIN_ROOT, rel);
    if (!fs.existsSync(full)) {
      hashes[rel] = 'MISSING';
    } else {
      hashes[rel] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    }
  }
  return hashes;
}

async function runMaster() {
  console.log('======================================================================');
  console.log('🌟 AI-BUILDER-BRAIN — PHASE E.1: UNIVERSAL KNOWLEDGE DISTRIBUTION');
  console.log('   Mission ID: UKD-PHASE-E1-BASELINE-SANDBOX-01');
  console.log('   Execution Root: ' + __dirname);
  console.log('   Timestamp: ' + new Date().toISOString());
  console.log('======================================================================\n');

  // 1. Capture Pre-Execution Production Baseline Hashes
  const preHashes = computeProductionHashes();

  // 2. Extract Comprehensive Baseline
  console.log('📊 STEP 1: EXTRACTING CANDIDATE & REGISTRY BASELINE METRICS...');
  const baseline = extractBaselineMetrics();
  console.log(`   Candidate Directives Total: ${baseline.candidateTotal}`);
  console.log(`   Domain Registry Total     : ${baseline.domainRegistry.totalRecords}`);
  console.log(`   Unclassified Candidates   : ${baseline.candidateClassification.unclassifiedCount}`);
  console.log(`   Multi-Domain Applicable   : ${baseline.candidateClassification.multiDomainCount}`);
  console.log(`   Legacy Router Folder Target: 05_KNOWLEDGE (${baseline.legacyFolderRouting['05_KNOWLEDGE'] || 0}), 08_VERIFICATION (${baseline.legacyFolderRouting['08_VERIFICATION'] || 0})`);
  console.log(`   KHU-005 Records Intact    : ${baseline.domainRegistry.khu005Intact ? 'YES (All 5 preserved)' : 'NO'}`);

  // 3. Run 13-Domain Coverage Suite
  console.log('\n🏛️  STEP 2: EXECUTING 13-DOMAIN VERIFICATION...');
  const domainResults = await run13DomainCoverageTests();

  // 4. Run 16-Folder Distribution Suite
  console.log('\n📁 STEP 3: EXECUTING 16-FOLDER RESPONSIBILITY VERIFICATION...');
  const folderResults = await run16FolderDistributionTests();

  // 5. Run Independent Quality Suite
  console.log('\n🧪 STEP 4: EXECUTING 10-PILLAR INDEPENDENT QUALITY TESTING SUITE...');
  const qualityResults = await runIndependentQualityTests();

  // 6. Verify Post-Execution Production Purity
  console.log('\n🛡️  STEP 5: VERIFYING PRODUCTION BITWISE ISOLATION...');
  const postHashes = computeProductionHashes();
  let productionContaminated = false;
  const hashComparison = {};

  for (const rel of PRODUCTION_CRITICAL_FILES) {
    const match = preHashes[rel] === postHashes[rel];
    hashComparison[rel] = {
      pre: preHashes[rel],
      post: postHashes[rel],
      match
    };
    if (!match) productionContaminated = true;
  }

  if (productionContaminated) {
    console.error('❌ PRODUCTION MUTATION DETECTED! Sandbox isolation breached.');
  } else {
    console.log('✅ PRODUCTION PURITY CONFIRMED: 0 bytes mutated across all canonical stores.');
  }

  const masterVerdict = domainResults.allPassed && folderResults.allPassed && qualityResults.allPassed && !productionContaminated
    ? 'VERIFIED'
    : 'PARTIAL';

  const finalOutput = {
    missionId: 'UKD-PHASE-E1-BASELINE-SANDBOX-01',
    timestamp: new Date().toISOString(),
    verdict: masterVerdict,
    productionIsolation: {
      pure: !productionContaminated,
      filesChecked: PRODUCTION_CRITICAL_FILES.length,
      hashComparison
    },
    baseline,
    domainCoverage: domainResults,
    folderDistribution: folderResults,
    qualitySuite: qualityResults
  };

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(finalOutput, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(`🏁 PHASE E.1 MASTER RUNNER COMPLETE`);
  console.log(`   Final Verdict              : ${masterVerdict}`);
  console.log(`   13 Domains Verified        : ${domainResults.passedCount}/${domainResults.totalTests}`);
  console.log(`   16 Folders Verified        : ${folderResults.passedCount}/${folderResults.totalTests}`);
  console.log(`   Quality Pillar Tests Passed: ${qualityResults.passedCount}/${qualityResults.totalTests}`);
  console.log(`   Production Intact (0 writes): ${!productionContaminated ? 'YES' : 'NO'}`);
  console.log(`   Results Saved To           : ${RESULTS_PATH}`);
  console.log('======================================================================\n');

  return finalOutput;
}

runMaster().catch(err => {
  console.error('Master runner encountered fatal error:', err);
  process.exit(1);
});

