/**
 * AI-Builder-Brain Master Construction Integration Test Suite
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-master-construction-integration.mjs
 * Purpose: MASTER-CONSTRUCTION-01 Full-Circulation Integration Verification:
 *          System A (Dynamic Discovery) -> System B (Knowledge Graph & Epistemic Bridge)
 *          -> System C (Universal Retrieval with Graph Expansion)
 *          -> System D (15-Stage Construction Lifecycle & Product Assembly)
 *          -> Evolution Loop (Incident Feedback to Master Brain Evolution).
 * 
 * Strict Invariant:
 * Zero Production Mutation: Executed 100% inside an isolated temporary directory (os.tmpdir()).
 * Zero 63k-document production rebuild: Uses dedicated sandbox corpus fixtures.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  extractDynamicSourceCitations,
  queueDynamicDiscoveredSource,
  acquireAndProcessNextDiscoveredSource,
  loadDiscoveryQueue
} from './dynamic-source-discovery-engine.mjs';

import {
  loadDomainRegistry,
  persistDomainIntelligenceRecord,
  createDomainIntelligenceRecord
} from './domain-intelligence-engine.mjs';

import {
  loadKnowledgeGraph,
  persistKnowledgeGraph,
  ingestRegistryIntoKnowledgeGraph,
  traverseKnowledgeGraph,
  getExpandedContextForRecords,
  addGraphEdge,
  upsertGraphNode
} from './knowledge-relationship-graph.mjs';

import {
  searchBrain,
  searchBrainDetailed,
  buildSearchIndex
} from './retrieval-engine.mjs';

import {
  constructProjectLifecycle,
  executeStageVerification,
  verifyReleasePackaging,
  verifyDeploymentReadiness,
  verifyOperationsRunbook,
  verifyObservabilityConfig,
  ingestProjectIncidentFeedback,
  deriveEvolutionRoadmap
} from './project-lifecycle-engine.mjs';

import {
  promoteProjectLearningToMasterBrain,
  validateProjectLearningCandidate,
  KNOWLEDGE_STAGE
} from './project-learning-promotion-bridge.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🚀 MASTER INTEGRATION TEST: COMPLETE FOUR-SYSTEM CIRCULATION LOOP');
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
// Sandbox Setup with Dedicated Lightweight Fixtures
// ---------------------------------------------------------------------------
const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'master-construction-sandbox-'));

try {
  // Setup sandbox folders
  const sbKnowledgeDir = path.join(sandboxDir, '05_KNOWLEDGE', 'domain-intelligence');
  const sbCoreDir = path.join(sandboxDir, '01_CORE');
  const sbPatternsDir = path.join(sandboxDir, '05_KNOWLEDGE');
  const sbSkillsDir = path.join(sandboxDir, '03_SKILLS');
  const sbDossiersDir = path.join(sandboxDir, '07_PROJECT_LEARNING');
  const sbCacheDir = path.join(sandboxDir, '.project-brain', 'cache');

  fs.mkdirSync(sbKnowledgeDir, { recursive: true });
  fs.mkdirSync(sbCoreDir, { recursive: true });
  fs.mkdirSync(sbSkillsDir, { recursive: true });
  fs.mkdirSync(sbDossiersDir, { recursive: true });
  fs.mkdirSync(sbCacheDir, { recursive: true });

  // Minimal sandbox registry (Domain G Architecture anchor)
  const initialRegistry = {
    version: '1.0.0',
    total_records: 1,
    records: {
      'DOM-G-ARCH-01': {
        record_id: 'DOM-G-ARCH-01',
        title: 'Strict Isolation Boundaries',
        universal_invariant: 'All background pipelines must run within isolated fault boundaries.',
        summary: 'Prevents cascade failures across microservices and async threads.',
        domain_letter: 'G',
        domain_name: 'Architecture',
        primary_domain: { letter: 'G', name: 'Architecture' },
        secondary_domains: [{ letter: 'H', name: 'Technical Construction' }],
        confidence: 0.98,
        provenance: { source_uri: 'CANONICAL_SPEC' }
      }
    },
    domains: {
      G: { total: 1, record_ids: ['DOM-G-ARCH-01'] }
    }
  };
  fs.writeFileSync(path.join(sbKnowledgeDir, 'domain-registry.json'), JSON.stringify(initialRegistry, null, 2), 'utf-8');
  ingestRegistryIntoKnowledgeGraph(sandboxDir);

  // Minimal core rule
  fs.writeFileSync(path.join(sbCoreDir, 'operating-rules.md'), '## Rule 1 — Zero Leakage\nAlways isolate untrusted input.', 'utf-8');

  // Minimal engineering pattern
  fs.writeFileSync(path.join(sbPatternsDir, 'engineering-patterns.md'), '## 1. Declarative Error Boundaries\n**RULE**: Always wrap asynchronous execution.\n**WHY**: Prevents unhandled rejections.\n**WHEN TO APPLY**: All async tasks.', 'utf-8');

  // ---------------------------------------------------------------------------
  // STEP 1: System A — Dynamic Citation Extraction & Queue Management
  // ---------------------------------------------------------------------------
  console.log('[STEP 1: SYSTEM A] Dynamic Source Discovery & Enqueuing...');
  const sampleDossierContent = `
    # Forensic Investigation: W3C WCAG 2.1 Standard Analysis
    Authoritative specification: https://www.w3.org/TR/WCAG21/
    Related RFC: RFC 7807 for API problem details.
  `;
  const citations = extractDynamicSourceCitations(sampleDossierContent, { filePath: 'dossier-01.md' });
  assert(citations.length >= 2, 'Extracted external citations from dossier text (Count: 2)');

  const w3cCit = citations.find(c => c.url.includes('w3.org/TR/WCAG21'));
  assert(w3cCit !== undefined, 'Located W3C WCAG 2.1 specification citation');

  // Ground with domain title and invariant content
  w3cCit.domain = 'H';
  w3cCit.title = 'W3C Web Content Accessibility Guidelines (WCAG 2.1)';
  w3cCit.invariantSummary = 'User interface components must meet WCAG AA minimum 4.5:1 accessibility contrast ratio';

  const qRes = queueDynamicDiscoveredSource(w3cCit, { customRoot: sandboxDir });
  assert(qRes.queued === true, 'Enqueued W3C source into dynamic discovery queue');
  assert(qRes.category === 'STANDARDS_AND_SPECIFICATIONS', 'Classified as STANDARDS_AND_SPECIFICATIONS');
  assert(qRes.trustScore >= 0.95, 'Awarded canonical standards trust score');

  // ---------------------------------------------------------------------------
  // STEP 2: System A -> System B Pipeline Integration
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 2: SYSTEM A -> B] Acquisition, 4-Pillar Validation & Graph Sync...');
  const processRes = acquireAndProcessNextDiscoveredSource({
    customRoot: sandboxDir,
    verificationProof: {
      verified: true,
      exit_code: 0,
      evidence_type: 'W3C_SPECIFICATION_VERIFIED',
      test_suite: 'test-wcag-contrast.mjs'
    }
  });

  assert(processRes.processed === true, 'acquireAndProcessNextDiscoveredSource executed successfully');
  assert(processRes.candidateId && processRes.candidateId.startsWith('PLCAND-'), 'Generated valid candidate ID');
  assert(processRes.recordId && processRes.recordId.startsWith('DOM-'), 'Promoted candidate to canonical domain record');

  // Verify Sandbox Registry
  const sbReg = loadDomainRegistry(sandboxDir);
  assert(sbReg.records[processRes.recordId] !== undefined, 'Promoted record exists in sandbox domain-registry.json');
  assert(sbReg.total_records === 2, 'Registry total_records incremented to 2');

  // Verify System B Knowledge Relationship Graph Synchronized Automatically!
  const sbGraph = loadKnowledgeGraph(sandboxDir);
  assert(sbGraph.nodes[processRes.recordId] !== undefined, 'Knowledge Relationship Graph automatically synchronized node for new record');
  assert(sbGraph.statistics.total_nodes >= 2, 'Knowledge graph contains nodes for all promoted records');

  // ---------------------------------------------------------------------------
  // STEP 3: System C — Universal Retrieval with Graph Expansion
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 3: SYSTEM C] Universal Retrieval with Graph Expansion Recall...');

  // Build lightweight sandbox index
  const sbIndex = buildSearchIndex(true, sandboxDir);
  assert(sbIndex.totalDocuments > 0, 'Lightweight sandbox index built successfully');

  // Connect explicit cross-domain relationship edge between Promoted Record and DOM-G-ARCH-01
  const liveSbGraph = loadKnowledgeGraph(sandboxDir);
  addGraphEdge(liveSbGraph, {
    sourceId: processRes.recordId,
    targetId: 'DOM-G-ARCH-01',
    relationType: 'CONSTRAINED_BY_ARCHITECTURE',
    weight: 1.0,
    rationale: 'Accessibility UI components must run within isolated architectural view containers'
  });
  persistKnowledgeGraph(liveSbGraph, sandboxDir);

  // Query retrieval engine with expandGraph enabled
  const searchOutcome = searchBrainDetailed('accessibility contrast ratio', {
    brainRoot: sandboxDir,
    expandGraph: true
  });

  assert(searchOutcome.status === 'FOUND', 'searchBrainDetailed returned status FOUND');
  assert(searchOutcome.results.length > 0, 'Retrieved matching knowledge items');
  assert(searchOutcome.graphExpandedContext !== null, 'Graph-expanded context successfully populated');

  // Verify relationship path returned
  const graphContext = searchOutcome.graphExpandedContext;
  const hasArchEdge = graphContext.relationshipPaths.some(p => p.includes('CONSTRAINED_BY_ARCHITECTURE') && p.includes('DOM-G-ARCH-01'));
  assert(hasArchEdge, 'Graph traversal recalled connected architectural constraint (DOM-G-ARCH-01)');

  // ---------------------------------------------------------------------------
  // STEP 4: System D — Universal Project Construction & 15-Stage Lifecycle
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 4: SYSTEM D] Universal Project Construction & Lifecycle Manifests...');
  const targetProjectDir = path.join(sandboxDir, 'AccessibleAnalyticsDashboard');

  const lifecycleRes = constructProjectLifecycle(
    'Build an accessible analytics dashboard with WCAG AA contrast tokens and resilient telemetry',
    targetProjectDir,
    { customRoot: sandboxDir }
  );

  assert(lifecycleRes.success === true, 'constructProjectLifecycle completed with success: true');
  assert(lifecycleRes.stagesPrepared === 15, 'All 15 construction lifecycle stages prepared');

  // Execute and verify Stage 10 (Release)
  fs.writeFileSync(path.join(targetProjectDir, 'package.json'), JSON.stringify({
    name: 'accessible-analytics-dashboard',
    version: '0.1.0',
    type: 'module'
  }, null, 2), 'utf-8');

  const releaseRes = executeStageVerification('10_RELEASE', targetProjectDir);
  assert(releaseRes.verified === true, 'Stage 10 Release packaging verified');

  // Execute and verify Stage 11 (Deploy readiness - human approval barrier)
  const deployRes = executeStageVerification('11_DEPLOY', targetProjectDir, { humanAuthorized: false });
  assert(deployRes.requires_human_approval === true, 'Stage 11 Deployment strictly mandates human authorization');
  assert(deployRes.external_deployment_blocked === true, 'Stage 11 External deploy blocked without human token');

  // Execute and verify Stage 12 (Operate) and Stage 13 (Observe)
  const operateRes = executeStageVerification('12_OPERATE', targetProjectDir);
  assert(operateRes.verified === true, 'Stage 12 Operations runbook verified');

  const observeRes = executeStageVerification('13_OBSERVE', targetProjectDir);
  assert(observeRes.verified === true, 'Stage 13 Observability telemetry configuration verified');

  // ---------------------------------------------------------------------------
  // STEP 5: Evolution Loop — Incident Autopsy to Master Brain Knowledge Closure
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 5: EVOLUTION LOOP] Incident Feedback & Knowledge Evolution Closure...');
  const runtimeIncident = {
    errorSignature: 'CANVAS_COLOR_SPACE_DIVERGENCE',
    causalExplanation: 'Display P3 wide gamut displays caused color drift on standard sRGB contrast calculations',
    expectedInvariant: 'Color contrast checkers must convert color inputs to standard CIE 1931 XYZ space with D65 illuminant',
    derivedRule: 'Rule 1725 — CIE 1931 D65 Illuminant Conversion Invariant',
    domainLetter: 'F'
  };

  const feedbackRes = executeStageVerification('14_FEEDBACK', targetProjectDir, { incidentPayload: runtimeIncident });
  assert(feedbackRes.success === true, 'Stage 14 Incident autopsy recorded in project');

  const evoSummary = executeStageVerification('15_IMPROVE', targetProjectDir);
  assert(evoSummary.ready_for_master_brain_evolution === true, 'Stage 15 Derived evolution roadmap ready for Brain promotion');

  // Promote evolutionary learning into System B
  const evoCandidate = {
    candidate_id: 'PLCAND-EVO-D65',
    title: 'CIE 1931 D65 Illuminant Contrast Conversion',
    universal_invariant: runtimeIncident.expectedInvariant,
    why: runtimeIncident.causalExplanation,
    when_to_apply: 'All color contrast calculation pipelines',
    verified_implementation_pattern: 'Normalize display color space to linear sRGB before calculating relative luminance',
    negative_constraint: 'Never perform contrast division directly on raw P3 hex values',
    source_provenance: {
      source_name: 'AccessibleAnalyticsDashboard-Runtime',
      source_uri: 'incident://AccessibleAnalyticsDashboard/INC-COLOR-P3',
      observed_at: new Date().toISOString()
    },
    primary_domain: { letter: 'F', name: 'Design' }
  };

  const evoPromotion = promoteProjectLearningToMasterBrain(evoCandidate, {
    verified: true,
    exit_code: 0,
    evidence_type: 'RUNTIME_INCIDENT_REGRESSION_VERIFIED',
    test_suite: 'test-color-space.mjs'
  }, { brainRoot: sandboxDir });

  assert(evoPromotion.success === true, 'Evolutionary learning successfully promoted to sandbox Master Brain');
  const sbRegPostEvo = loadDomainRegistry(sandboxDir);
  assert(sbRegPostEvo.records[evoPromotion.record_id] !== undefined, 'Evolved record retrievable from domain registry');

  // Verify graph updated with evolved node
  const updatedGraph = loadKnowledgeGraph(sandboxDir);
  assert(updatedGraph.nodes[evoPromotion.record_id] !== undefined, 'Knowledge Relationship Graph immediately updated with evolutionary node');

  // ---------------------------------------------------------------------------
  // STEP 6: Strict Production Safety & Non-Contamination Verification
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 6: PRODUCTION SAFETY] Verifying Zero Production Registry Contamination...');
  const prodReg = loadDomainRegistry(BRAIN_ROOT);
  assert(prodReg.total_records === 45, 'Production registry count strictly preserved at 45 records');

  const zodIds = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];
  const zodIntact = zodIds.every(id => prodReg.records[id] !== undefined);
  assert(zodIntact === true, 'All 5 pending KHU-005 Zod records 100% intact in production registry');

  assert(!prodReg.records[processRes.recordId], 'Zero sandbox test records leaked into production registry');
  assert(!prodReg.records[evoPromotion.record_id], 'Zero evolution test records leaked into production registry');

} finally {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) { }
}

console.log('\n======================================================================');
console.log(`📊 MASTER INTEGRATION SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests === 0) {
  console.log('🎉 ALL FOUR SYSTEMS AND THE EVOLUTION LOOP ARE 100% INTEGRATED & VERIFIED!');
  process.exit(0);
} else {
  console.error('❌ Master Construction Integration test suite failed!');
  process.exit(1);
}
