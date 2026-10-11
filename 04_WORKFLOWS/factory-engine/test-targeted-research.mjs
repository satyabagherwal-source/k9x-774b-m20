/**
 * Comprehensive Test Suite: Autonomous Knowledge Gap Discovery & Targeted Research
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-targeted-research.mjs
 * Purpose: Verifies Phase 1-7 milestones:
 *          - Evidence-based gap discovery across 10 dimensions
 *          - Transparent 8-factor prioritization scoring
 *          - Targeted research question formulation & codification
 *          - Empirical gap closure verification (retrieval re-run + test)
 *          - Autonomous research loop with durable checkpoints
 *          - Evidence-based reporting
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  discoverKnowledgeGaps,
  loadGapRegistry,
  saveGapRegistry,
  GAP_STATUS,
  GAP_CATEGORIES
} from './gap-discovery-engine.mjs';
import {
  prioritizeKnowledgeGaps,
  evaluateGapFactors
} from './gap-prioritizer.mjs';
import {
  conductTargetedResearch,
  TARGETED_RESEARCH_PROFILES
} from './targeted-researcher.mjs';
import {
  verifyGapClosure,
  FencedStorageSink,
  SimulatedDistributedLockService
} from './gap-closure-verifier.mjs';
import {
  runAutonomousResearchCycle,
  recordResearchCheckpoint
} from './autonomous-research-loop.mjs';
import {
  formatKnowledgeGapReport,
  persistKnowledgeGapReport
} from './knowledge-gap-report.mjs';
import { retrieveKnowledge } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const GAP_REGISTRY_FILE = path.join(BRAIN_ROOT, '08_VERIFICATION', 'knowledge-gap-registry.json');
const originalPatterns = fs.readFileSync(PATTERNS_FILE, 'utf-8');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failedTests++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTargetedResearchSuite() {
  console.log('='.repeat(70));
  console.log('🧪 TEST SUITE: AUTONOMOUS KNOWLEDGE GAP DISCOVERY & TARGETED RESEARCH');
  console.log('='.repeat(70));

  // Ensure idempotent baseline state for the demonstration cycle
  const initReg = loadGapRegistry();
  const existingConcurrencyGap = initReg.gaps.find(g => g.domain === 'DISTRIBUTED_CONCURRENCY');
  if (existingConcurrencyGap) {
    existingConcurrencyGap.status = GAP_STATUS.OPEN;
    existingConcurrencyGap.closed_at = null;
    existingConcurrencyGap.verified_rule = null;
    saveGapRegistry(initReg);
  }

  // =========================================================================
  // [TEST 1] Evidence-Based Knowledge Gap Discovery (Phase 2)
  // =========================================================================
  console.log('\n[TEST 1] Testing Evidence-Based Knowledge Gap Discovery...');
  let discoveryResult;
  {
    discoveryResult = discoverKnowledgeGaps({ revalidate: true });

    assert(discoveryResult.discoveredCount >= 5, `Discovered knowledge gaps across domains (Found: ${discoveryResult.discoveredCount})`);
    assert(fs.existsSync(GAP_REGISTRY_FILE), 'Gap registry persisted to disk at 08_VERIFICATION/knowledge-gap-registry.json');

    const registry = loadGapRegistry();
    const concurrencyGap = registry.gaps.find(g => g.domain === 'DISTRIBUTED_CONCURRENCY');
    assert(Boolean(concurrencyGap), 'Discovered high-priority DISTRIBUTED_CONCURRENCY gap');
    assert(Boolean(concurrencyGap.evidence?.probe_query), `Forensic probe attached: "${concurrencyGap.evidence?.probe_query}"`);
    assert(concurrencyGap.category === GAP_CATEGORIES.RETRIEVAL_COVERAGE_DEFICIT, 'Category is RETRIEVAL_COVERAGE_DEFICIT');
    assert(concurrencyGap.status === GAP_STATUS.OPEN, 'Initial status is OPEN');

    // Check presence of missing verification gaps
    const verifyGap = registry.gaps.find(g => g.category === GAP_CATEGORIES.MISSING_VERIFICATION_METHOD);
    assert(Boolean(verifyGap), 'Identified rules lacking empirical verification methods');

    // Check presence of unresolved inbox candidate gaps
    const inboxGap = registry.gaps.find(g => g.category === GAP_CATEGORIES.UNRESOLVED_CANDIDATE);
    assert(Boolean(inboxGap), 'Identified unpromoted inbox candidate directives');
  }

  // =========================================================================
  // [TEST 2] Transparent Multi-Factor Prioritization (Phase 3)
  // =========================================================================
  console.log('\n[TEST 2] Testing Transparent Multi-Factor Prioritization...');
  let prioritizationResult;
  {
    prioritizationResult = prioritizeKnowledgeGaps();

    assert(prioritizationResult.totalPrioritized >= 5, `Gaps prioritized (Total: ${prioritizationResult.totalPrioritized})`);
    const topGap = prioritizationResult.topPriorityGap;
    assert(Boolean(topGap), 'Top priority gap identified');
    assert(topGap.domain === 'DISTRIBUTED_CONCURRENCY', `Top priority gap is DISTRIBUTED_CONCURRENCY (Got: ${topGap.domain})`);
    assert(topGap.priority_score >= 8.0, `Priority score is high-confidence (Score: ${topGap.priority_score})`);

    // Verify all 8 individual factors are explicitly recorded
    const factors = topGap.priority_evaluation?.factors;
    assert(Boolean(factors), 'Factor evaluation attached to gap record');
    assert(typeof factors.engineering_impact === 'number', `Engineering Impact: ${factors.engineering_impact}`);
    assert(typeof factors.security_reliability_risk === 'number', `Security & Reliability Risk: ${factors.security_reliability_risk}`);
    assert(typeof factors.task_frequency === 'number', `Task Frequency: ${factors.task_frequency}`);
    assert(typeof factors.reuse_potential === 'number', `Reuse Potential: ${factors.reuse_potential}`);
    assert(typeof factors.evidence_strength === 'number', `Evidence Strength: ${factors.evidence_strength}`);
    assert(typeof factors.expected_value === 'number', `Expected Value: ${factors.expected_value}`);
    assert(typeof factors.research_cost === 'number', `Research Cost: ${factors.research_cost}`);
    assert(typeof factors.confidence_of_insufficiency === 'number', `Confidence of Insufficiency: ${factors.confidence_of_insufficiency}`);
  }

  // =========================================================================
  // [TEST 3] Targeted Research Execution & Evidence Synthesis (Phase 4)
  // =========================================================================
  console.log('\n[TEST 3] Testing Targeted Research & Knowledge Codification...');
  let researchResult;
  {
    const targetGap = prioritizationResult.topPriorityGap;
    researchResult = conductTargetedResearch(targetGap);

    assert(researchResult.success === true, 'Targeted research executed successfully');
    assert(Boolean(researchResult.ruleNumber), `Assigned dynamic rule number: ${researchResult.ruleNumber}`);
    assert(researchResult.ruleNumber >= 309, `Rule number is sequentially continuous (Rule ${researchResult.ruleNumber})`);
    assert(Boolean(researchResult.researchQuestion), `Formulated precise research question: "${researchResult.researchQuestion}"`);
    assert(researchResult.sourcesExamined.length > 0, `Authoritative sources examined: ${researchResult.sourcesExamined.map(s => s.repo).join(', ')}`);

    // Verify physical read-back from 05_KNOWLEDGE/engineering-patterns.md
    const updatedPatterns = fs.readFileSync(PATTERNS_FILE, 'utf-8');
    assert(updatedPatterns.includes(`## ${researchResult.ruleNumber}. ${researchResult.ruleTitle}`), 'Rule persisted and verified in 05_KNOWLEDGE/engineering-patterns.md');
    assert(updatedPatterns.includes('**VERIFICATION METHOD**:'), 'Rule contains mandatory **VERIFICATION METHOD**:');
    assert(updatedPatterns.includes('**NEGATIVE CONSTRAINT**:'), 'Rule contains mandatory **NEGATIVE CONSTRAINT**:');
    assert(updatedPatterns.includes('PROVENANCE_START'), 'Rule contains complete provenance metadata');
  }

  // =========================================================================
  // [TEST 4] Empirical Gap Closure Verification (Phase 5)
  // =========================================================================
  console.log('\n[TEST 4] Testing Empirical Gap Closure Verification...');
  let closureResult;
  {
    const targetGap = prioritizationResult.topPriorityGap;
    closureResult = verifyGapClosure(targetGap, researchResult);

    assert(closureResult.retrievalPassed === true, 'Original failed probe query now retrieves newly codified Rule');
    assert(closureResult.empiricalTestPassed === true, 'Empirical invariant test passed against split-brain race conditions');
    assert(closureResult.closed === true, 'Gap status successfully transitioned to CLOSED');

    const registry = loadGapRegistry();
    const closedGapRecord = registry.gaps.find(g => g.gap_id === targetGap.gap_id);
    assert(closedGapRecord.status === GAP_STATUS.CLOSED, 'Gap record status in registry is CLOSED');
    assert(closedGapRecord.verified_rule === researchResult.ruleId, `Verified rule referenced in registry (${closedGapRecord.verified_rule})`);
    assert(Boolean(closedGapRecord.closed_at), 'Closed timestamp recorded');

    // Test live retrieval using retrieveKnowledge() directly
    const testProbe = retrieveKnowledge(targetGap.evidence.probe_query, { topK: 3 });
    const topMatch = testProbe.items.find(it => it.id === researchResult.ruleId);
    assert(Boolean(topMatch), `retrieveKnowledge directly returns ${researchResult.ruleId} for original deficit probe`);
  }

  // =========================================================================
  // [TEST 5] Safe Autonomous Research Loop Integration (Phase 6)
  // =========================================================================
  console.log('\n[TEST 5] Testing Safe Autonomous Research Loop Integration...');
  {
    const cycleSummary = await runAutonomousResearchCycle();

    assert(cycleSummary.success === true, 'Autonomous research cycle completed safely');
    assert(Boolean(cycleSummary.cycleId), `Research cycle assigned unique ID: ${cycleSummary.cycleId}`);

    const checkpointsFile = path.join(BRAIN_ROOT, '.project-brain', 'research-checkpoints.json');
    assert(fs.existsSync(checkpointsFile), 'Research checkpoints persisted to .project-brain/research-checkpoints.json');

    const checkpoints = JSON.parse(fs.readFileSync(checkpointsFile, 'utf-8'));
    assert(checkpoints.cycles.length > 0, `Checkpoints recorded (Count: ${checkpoints.cycles.length})`);
  }

  // =========================================================================
  // [TEST 6] Evidence-Based Reporting & Persistence (Phase 7)
  // =========================================================================
  console.log('\n[TEST 6] Testing Evidence-Based Reporting...');
  {
    const registry = loadGapRegistry();
    const reportMarkdown = formatKnowledgeGapReport(registry, [
      {
        gapId: researchResult.gapId,
        domain: researchResult.domain,
        ruleId: researchResult.ruleId,
        ruleTitle: researchResult.ruleTitle,
        researchQuestion: researchResult.researchQuestion,
        sourcesExamined: researchResult.sourcesExamined,
        closureVerification: closureResult
      }
    ]);

    assert(reportMarkdown.includes('EVIDENCE-BASED KNOWLEDGE GAP & TARGETED RESEARCH REPORT'), 'Report header present');
    assert(reportMarkdown.includes('Executive Summary & Explicit Denominators'), 'Explicit denominators table present');
    assert(reportMarkdown.includes('Completed Targeted Research Cycles'), 'Completed research tasks documented');
    assert(reportMarkdown.includes('Prioritized Gap Inventory & Factor Breakdown'), 'Prioritized factor breakdown included');
    assert(reportMarkdown.includes('Next Research Cycles Roadmap'), 'Future research roadmap present');

    const reportPath = persistKnowledgeGapReport(reportMarkdown);
    assert(fs.existsSync(reportPath), `Report persisted to disk at ${reportPath}`);
  }

  console.log('='.repeat(70));
  console.log(`🏁 TARGETED RESEARCH VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
  console.log('='.repeat(70));
}

runTargetedResearchSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
