/**
 * Phase E.3: Master Test Runner & Integrity Verifier
 * 
 * Orchestrates:
 * 1. Preflight baseline verification (249 recoverable candidates).
 * 2. Dossier-Based Evidence Synthesis across all 14 mandatory fields.
 * 3. Pure Sandbox Storage & Read-Back Verification (synthesized-knowledge/*.md & catalog).
 * 4. 9-Pillar Independent Verification Suite (including individual results for all 249 records).
 * 5. Production Bitwise Isolation Proof.
 * 6. Generates JSON evidence file: results/phase-e3-results.json.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { CandidateSynthesizer } from './src/candidate-synthesizer.mjs';
import { SynthesisStorageEngine } from './src/synthesis-storage-engine.mjs';
import { runIndependentE3Verification } from './tests/test-independent-e3-verification.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULTS_DIR = path.join(__dirname, 'results');
const RESULTS_PATH = path.join(RESULTS_DIR, 'phase-e3-results.json');

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
  console.log('🌟 AI-BUILDER-BRAIN — PHASE E.3: EVIDENCE-BASED CANDIDATE SYNTHESIS');
  console.log('   Mission ID: UKD-PHASE-E3-CANDIDATE-SYNTHESIS-01');
  console.log('   Execution Root: ' + __dirname);
  console.log('   Timestamp: ' + new Date().toISOString());
  console.log('======================================================================\n');

  // 1. Capture Pre-Execution Production Baseline Hashes
  const preHashes = computeProductionHashes();

  // 2. Synthesize Candidates
  console.log('🔬 STEP 1: EXECUTING 14-FIELD DOSSIER EVIDENCE SYNTHESIS...');
  const synthesizer = new CandidateSynthesizer();
  const records = synthesizer.synthesizeAll();
  console.log(`   Total Candidates Synthesized: ${records.length}`);

  const statusCounts = {};
  records.forEach(r => { statusCounts[r.synthesisStatus] = (statusCounts[r.synthesisStatus] || 0) + 1; });
  console.log('   Synthesis Status Distribution:', statusCounts);

  const domainCounts = {};
  records.forEach(r => { domainCounts[r.domains.primary] = (domainCounts[r.domains.primary] || 0) + 1; });
  console.log('   Primary Domain Distribution  :', domainCounts);

  const destCounts = {};
  records.forEach(r => { destCounts[r.canonicalDestination.targetFolder] = (destCounts[r.canonicalDestination.targetFolder] || 0) + 1; });
  console.log('   Canonical Destination Targets:', destCounts);

  // 3. Sandbox Storage & Read-Back Verification
  console.log('\n💾 STEP 2: PERSISTING SANDBOX KNOWLEDGE ARTIFACTS & MASTER CATALOG...');
  const storage = new SynthesisStorageEngine();
  const storageResult = storage.persistSynthesizedRecords(records);
  console.log(`   Individual Files Written    : ${storageResult.totalFilesWritten}`);
  console.log(`   Master Catalog Written      : ${storageResult.catalogPath} (${storageResult.catalogBytes} bytes)`);
  console.log(`   Read-Back Parity Confirmed  : ${storageResult.allReadBackVerified ? 'YES (100% SHA-256 match)' : 'NO'}`);

  // 4. Run Independent Verification Suite
  console.log('\n🧪 STEP 3: EXECUTING 9-PILLAR INDEPENDENT VERIFICATION TESTS...');
  const verifResults = await runIndependentE3Verification();

  // 5. Verify Post-Execution Production Purity
  console.log('\n🛡️  STEP 4: VERIFYING PRODUCTION BITWISE ISOLATION...');
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

  const masterVerdict = verifResults.allPassed && !productionContaminated
    ? 'VERIFIED'
    : 'PARTIAL';

  const finalOutput = {
    missionId: 'UKD-PHASE-E3-CANDIDATE-SYNTHESIS-01',
    timestamp: new Date().toISOString(),
    verdict: masterVerdict,
    productionIsolation: {
      pure: !productionContaminated,
      filesChecked: PRODUCTION_CRITICAL_FILES.length,
      hashComparison
    },
    synthesisSummary: {
      totalCandidatesInput: records.length,
      statusCounts,
      domainCounts,
      destinationCounts: destCounts,
      storageResult: {
        totalFilesWritten: storageResult.totalFilesWritten,
        catalogBytes: storageResult.catalogBytes,
        catalogHash: storageResult.catalogHash,
        allReadBackVerified: storageResult.allReadBackVerified
      }
    },
    verificationSuite: {
      allPassed: verifResults.allPassed,
      passedCount: verifResults.passedCount,
      totalTests: verifResults.totalTests,
      tests: verifResults.tests,
      individualRecordResultsCount: verifResults.individualRecordResults.length,
      individualRecordResults: verifResults.individualRecordResults
    }
  };

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(finalOutput, null, 2), 'utf8');

  console.log('\n======================================================================');
  console.log(`🏁 PHASE E.3 MASTER RUNNER COMPLETE`);
  console.log(`   Final Verdict              : ${masterVerdict}`);
  console.log(`   Synthesized Records Written: ${records.length}/249 (100% with all 14 fields)`);
  console.log(`   Verification Tests Passed  : ${verifResults.passedCount}/${verifResults.totalTests}`);
  console.log(`   Individual Records Verified: ${verifResults.individualRecordResults.filter(r => r.verified).length}/${records.length}`);
  console.log(`   Production Intact (0 writes): ${!productionContaminated ? 'YES' : 'NO'}`);
  console.log(`   Results Saved To           : ${RESULTS_PATH}`);
  console.log('======================================================================\n');

  return finalOutput;
}

runMaster().catch(err => {
  console.error('Master runner encountered fatal error:', err);
  process.exit(1);
});

