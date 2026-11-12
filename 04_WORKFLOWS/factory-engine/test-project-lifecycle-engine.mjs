/**
 * AI-Builder-Brain Universal Project Construction Lifecycle Engine Test Suite
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-project-lifecycle-engine.mjs
 * Purpose: Verifies System D 15-Stage Construction Lifecycle:
 *          1. 15-Stage Canonical Schema & 13-Domain Coverage
 *          2. Full 15-Stage Lifecycle Preparation for Real Product Goal
 *          3. Brain Intelligence Guideline Ingestion & Provenance Tracking
 *          4. Structured JSON & Markdown Artifact Emission
 *          5. Negative Scope & Non-Negotiable Boundary Enforcement
 *          6. Project Isolation & Rule 1670 Compliance (Zero Master Brain Copy)
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import {
  CONSTRUCTION_LIFECYCLE_STAGES,
  recallStageDomainIntelligence,
  synthesizeStagePayload,
  constructProjectLifecycle,
  extractProductSummary,
  generateStageTasks,
  verifyStandardLifecycleStage,
  verifyProjectLifecyclePipeline,
  verifyReleasePackaging,
  verifyDeploymentReadiness,
  verifyOperationsRunbook,
  verifyObservabilityConfig,
  ingestProjectIncidentFeedback,
  deriveEvolutionRoadmap,
  executeStageVerification
} from './project-lifecycle-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: 15-STAGE UNIVERSAL PROJECT CONSTRUCTION LIFECYCLE');
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

const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-test-sandbox-'));

try {
  // ---------------------------------------------------------------------------
  // 1. Canonical 15-Stage Schema & Domain Coverage
  // ---------------------------------------------------------------------------
  console.log('--- Phase 1: Canonical 15-Stage Schema & 13-Domain Parity ---');
  assert(CONSTRUCTION_LIFECYCLE_STAGES.length === 15, 'Exactly 15 canonical construction stages defined');

  const expectedStageIds = [
    '01_DISCOVER', '02_DEFINE', '03_RESEARCH', '04_IMAGINE', '05_DESIGN',
    '06_ARCHITECT', '07_BUILD', '08_TEST', '09_VERIFY', '10_RELEASE',
    '11_DEPLOY', '12_OPERATE', '13_OBSERVE', '14_FEEDBACK', '15_IMPROVE'
  ];

  const actualStageIds = CONSTRUCTION_LIFECYCLE_STAGES.map(s => s.id);
  const allStagesPresent = expectedStageIds.every(id => actualStageIds.includes(id));
  assert(allStagesPresent, 'All 15 stage IDs match the required lifecycle definition');

  // Verify domain coverage across stages
  const coveredDomains = new Set();
  for (const s of CONSTRUCTION_LIFECYCLE_STAGES) {
    if (s.primaryDomain) coveredDomains.add(s.primaryDomain);
    if (Array.isArray(s.secondaryDomains)) {
      s.secondaryDomains.forEach(d => coveredDomains.add(d));
    }
  }

  const coreDomains = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  const allDomainsCovered = coreDomains.every(d => coveredDomains.has(d));
  assert(allDomainsCovered, 'All 13 Co-Equal Intelligence Domains (A through M) covered across stages');

  // ---------------------------------------------------------------------------
  // 2. Full 15-Stage Lifecycle Preparation for Real Product Directive
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 2: Full 15-Stage Lifecycle Preparation & Emission ---');
  const userGoal = 'Build an accessible, offline-first Markdown editor with live preview, WCAG AA contrast tokens, and zero network telemetry';
  const targetProjectDir = path.join(sandboxDir, 'AccessibleMarkdownEditor');

  const constructionRes = constructProjectLifecycle(userGoal, targetProjectDir, {
    customRoot: BRAIN_ROOT
  });

  assert(constructionRes.success === true, 'constructProjectLifecycle completed with success: true');
  assert(constructionRes.stagesPrepared === 15, 'All 15 stages prepared and generated');
  assert(fs.existsSync(constructionRes.lifecycleDir), '.project-brain/lifecycle directory created in target project');

  // ---------------------------------------------------------------------------
  // 3. Artifact Completeness & JSON Schema Verification (Tasks & Guidelines)
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 3: Artifact Completeness & JSON Schema Verification ---');
  const allTaskIds = new Set();
  const allTasks = [];

  const requiredTaskFields = [
    'id', 'stage_id', 'title', 'description', 'objective',
    'input_requirements', 'output_requirements', 'dependencies',
    'domain', 'required_brain_knowledge', 'acceptance_criteria',
    'verification_method', 'evidence_references', 'confidence',
    'human_approval_required', 'status'
  ];

  for (const stage of CONSTRUCTION_LIFECYCLE_STAGES) {
    const fileName = `${stage.id.toLowerCase().replace('_', '-')}.json`;
    const filePath = path.join(constructionRes.lifecycleDir, fileName);
    assert(fs.existsSync(filePath), `Stage manifest exists: ${fileName}`);

    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    assert(parsed.stage_id === stage.id, `Stage manifest ${fileName} contains valid stage_id`);
    assert(parsed.primary_domain === stage.primaryDomain, `Stage manifest matches primary domain ${stage.primaryDomain}`);
    assert(Array.isArray(parsed.brain_intelligence_guidelines), `Stage manifest contains brain_intelligence_guidelines array`);

    // Non-Empty Tasks Array Verification across all stages (specifically stages 01-09)
    assert(Array.isArray(parsed.tasks) && parsed.tasks.length > 0, `Stage ${stage.id} contains non-empty tasks array (Count: ${parsed.tasks?.length})`);

    // Strict 16-field Task Schema Verification
    for (const task of parsed.tasks) {
      allTaskIds.add(task.id);
      allTasks.push(task);

      const hasAllFields = requiredTaskFields.every(field => Object.prototype.hasOwnProperty.call(task, field));
      assert(hasAllFields, `Task ${task.id} conforms to strict 16-field lifecycle schema`);
      assert(task.stage_id === stage.id, `Task ${task.id} stage_id matches parent stage ${stage.id}`);
      assert(task.domain === stage.primaryDomain, `Task ${task.id} domain matches stage domain ${stage.primaryDomain}`);
      assert(typeof task.confidence === 'number' && task.confidence >= 0 && task.confidence <= 1, `Task ${task.id} has valid confidence score`);
      assert(typeof task.human_approval_required === 'boolean', `Task ${task.id} has boolean human_approval_required flag`);
      assert(Array.isArray(task.acceptance_criteria) && task.acceptance_criteria.length > 0, `Task ${task.id} has non-empty acceptance_criteria`);
    }
  }

  // Master index and guide
  const indexPath = path.join(constructionRes.lifecycleDir, 'project-lifecycle-index.json');
  assert(fs.existsSync(indexPath), 'project-lifecycle-index.json exists in lifecycle directory');
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  assert(indexData.stages.length === 15, 'Master index tracks all 15 stages');
  assert(typeof indexData.total_tasks_count === 'number' && indexData.total_tasks_count > 0, `Master index tracks total tasks count (${indexData.total_tasks_count})`);

  const guidePath = path.join(targetProjectDir, 'CONSTRUCTION_LIFECYCLE.md');
  assert(fs.existsSync(guidePath), 'CONSTRUCTION_LIFECYCLE.md guide exists in root of target project');
  const guideText = fs.readFileSync(guidePath, 'utf-8');
  assert(guideText.includes('15 Mandatory Construction Stages'), 'Markdown guide contains stages table');

  // ---------------------------------------------------------------------------
  // 4. Domain-Specific Invariants & Negative Scope
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 4: Stage Domain Invariants & Negative Scope ---');
  // Check Stage 2 (Define): Negative scope exclusions
  const definePath = path.join(constructionRes.lifecycleDir, '02-define.json');
  const defineData = JSON.parse(fs.readFileSync(definePath, 'utf-8'));
  assert(Array.isArray(defineData.p0_mvp_scope) && defineData.p0_mvp_scope.length > 0, 'Stage 2 defines P0 MVP Scope');
  assert(Array.isArray(defineData.negative_scope_exclusions) && defineData.negative_scope_exclusions.length > 0, 'Stage 2 defines non-negotiable Negative Scope');
  assert(defineData.negative_scope_exclusions.some(e => e.includes('cloud analytics') || e.includes('telemetry')), 'Negative scope excludes premature analytics');

  // Check Stage 5 (Design): WCAG AA tokens
  const designPath = path.join(constructionRes.lifecycleDir, '05-design.json');
  const designData = JSON.parse(fs.readFileSync(designPath, 'utf-8'));
  assert(designData.design_tokens !== undefined, 'Stage 5 defines design tokens');
  assert(designData.design_tokens.color_contrast_ratio.includes('4.5:1'), 'Stage 5 enforces 4.5:1 WCAG AA contrast ratio');

  // Check Stage 9 (Verify): Zero network invariant
  const verifyPath = path.join(constructionRes.lifecycleDir, '09-verify.json');
  const verifyData = JSON.parse(fs.readFileSync(verifyPath, 'utf-8'));
  assert(verifyData.verification_invariants.some(v => v.includes('Zero-network')), 'Stage 9 enforces zero-network isolation invariant');

  // ---------------------------------------------------------------------------
  // 5. Individual Project Context & Rule 1670 Compliance
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 5: Individual Project Context & Rule 1670 Compliance ---');
  // Target project should NOT contain Master Brain files
  assert(!fs.existsSync(path.join(targetProjectDir, '01_CORE')), 'Target project does NOT copy Master Brain 01_CORE');
  assert(!fs.existsSync(path.join(targetProjectDir, '05_KNOWLEDGE')), 'Target project does NOT copy Master Brain 05_KNOWLEDGE');
  assert(!fs.existsSync(path.join(targetProjectDir, '07_PROJECT_LEARNING')), 'Target project does NOT copy Master Brain 07_PROJECT_LEARNING');
  assert(!fs.existsSync(path.join(BRAIN_ROOT, '.project-brain', 'lifecycle')), 'Master Brain does NOT leak child project lifecycle artifacts');

  // ---------------------------------------------------------------------------
  // 6. Executable Stages 10-15 Workflows & Human Approval Verification
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 6: Executable Stages 10-15 Workflows & Human Approval ---');

  // Create mock package.json in target project
  fs.writeFileSync(path.join(targetProjectDir, 'package.json'), JSON.stringify({
    name: 'accessible-markdown-editor',
    version: '0.1.0',
    type: 'module'
  }, null, 2), 'utf-8');

  // 6.1 Stage 10 (Release)
  const relRes = verifyReleasePackaging(targetProjectDir);
  assert(relRes.verified === true, 'Stage 10 verifyReleasePackaging passed successfully');
  assert(relRes.semver_verified === true, 'Valid semver version confirmed');
  assert(relRes.tarball_ready === true, 'Tarball readiness confirmed');

  // 6.2 Stage 11 (Deploy) - Human Approval Gated
  const deployNoAuth = verifyDeploymentReadiness(targetProjectDir, { humanAuthorized: false });
  assert(deployNoAuth.verified === true, 'Stage 11 deployment specification verified');
  assert(deployNoAuth.requires_human_approval === true, 'Deployment mandates human approval');
  assert(deployNoAuth.external_deployment_blocked === true, 'External deploy blocked without human authorization');

  const deployWithAuth = verifyDeploymentReadiness(targetProjectDir, { humanAuthorized: true });
  assert(deployWithAuth.human_authorized === true, 'Human authorization accepted for deployment simulation');

  // 6.3 Stage 12 (Operate)
  const opRes = verifyOperationsRunbook(targetProjectDir);
  assert(opRes.verified === true, 'Stage 12 verifyOperationsRunbook verified');
  assert(opRes.health_probes_configured === true, 'Health probes configured');

  // 6.4 Stage 13 (Observe)
  const obsRes = verifyObservabilityConfig(targetProjectDir);
  assert(obsRes.verified === true, 'Stage 13 verifyObservabilityConfig verified');
  assert(obsRes.json_logging_standard === true, 'Structured JSON logging verified');

  // 6.5 Stage 14 (Feedback)
  const incidentMock = {
    errorSignature: 'REGEXP_BACKTRACKING_EXHAUSTION',
    causalExplanation: 'Unbounded regex catastrophic backtracking on nested bold tags',
    expectedInvariant: 'All markdown parsing regexes must enforce atomic possessive quantifiers or single-pass tokenization',
    derivedRule: 'Rule 1724 — Atomic Regex Tokenization Invariant',
    domainLetter: 'H'
  };
  const feedbackRes = ingestProjectIncidentFeedback(targetProjectDir, incidentMock);
  assert(feedbackRes.success === true, 'Stage 14 ingestProjectIncidentFeedback succeeded');
  assert(fs.existsSync(feedbackRes.incident_file), 'Incident autopsy recorded in .project-brain/incidents/');

  // 6.6 Stage 15 (Improve)
  const evoRoadmap = deriveEvolutionRoadmap(targetProjectDir);
  assert(evoRoadmap.unresolved_incidents_count === 1, 'Stage 15 detects recorded incident');
  assert(evoRoadmap.ready_for_master_brain_evolution === true, 'Ready for Master Brain evolution feedback');

  // 6.7 Unified Dispatcher
  const dispatchRes = executeStageVerification('10_RELEASE', targetProjectDir);
  assert(dispatchRes.stage === '10_RELEASE' && dispatchRes.verified === true, 'Unified executeStageVerification dispatched Stage 10 cleanly');

  // ---------------------------------------------------------------------------
  // 7. DAG Dependency Resolution, Stages 01-09 Verification & Multi-Product Generality
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 7: DAG Dependency Integrity, Pipeline Execution & Generality ---');

  // 7.1 DAG Dependency Integrity
  let allDependenciesValid = true;
  for (const task of allTasks) {
    if (task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        if (!allTaskIds.has(depId)) {
          allDependenciesValid = false;
          console.error(`Invalid dependency: Task ${task.id} depends on non-existent ${depId}`);
        }
      }
    }
  }
  assert(allDependenciesValid, 'Every task dependency points to a valid upstream task ID in the DAG');

  // Verify Stage 01 has zero external upstream dependencies (root of DAG)
  const stage01Tasks = allTasks.filter(t => t.stage_id === '01_DISCOVER');
  const stage01Root = stage01Tasks.find(t => t.id === 'TASK-01-DISCOVER-01');
  assert(stage01Root && stage01Root.dependencies.length === 0, 'Stage 01 initial task has 0 dependencies (DAG root)');
  assert(stage01Tasks.every(t => t.dependencies.every(d => d.startsWith('TASK-01'))), 'Stage 01 tasks have zero external upstream dependencies');

  // Verify Stage 02 depends on Stage 01
  const stage02Tasks = allTasks.filter(t => t.stage_id === '02_DEFINE');
  assert(stage02Tasks.some(t => t.dependencies.includes('TASK-01-DISCOVER-01')), 'Stage 02 Define tasks depend on Stage 01 Discover tasks');

  // 7.2 Stage 01-09 Verification via executeStageVerification
  const discRes = executeStageVerification('01_DISCOVER', targetProjectDir);
  assert(discRes.verified === true, 'Stage 01 executeStageVerification succeeded');
  assert(discRes.tasks_count > 0, 'Stage 01 tasks verified');

  const defRes = executeStageVerification('02_DEFINE', targetProjectDir);
  assert(defRes.verified === true, 'Stage 02 executeStageVerification succeeded');

  const desRes = executeStageVerification('05_DESIGN', targetProjectDir);
  assert(desRes.verified === true, 'Stage 05 executeStageVerification succeeded');

  const archRes = executeStageVerification('06_ARCHITECT', targetProjectDir);
  assert(archRes.verified === true, 'Stage 06 executeStageVerification succeeded');

  // 7.3 Missing Evidence & Artifact Detection (Stages 07 & 08)
  const emptyProjectDir = path.join(sandboxDir, 'EmptyProjectTest');
  constructProjectLifecycle('Empty Project Test', emptyProjectDir, { customRoot: BRAIN_ROOT });

  // Stage 07 without code should fail with MISSING_SOURCE_CODE_ARTIFACTS
  const buildNoCode = executeStageVerification('07_BUILD', emptyProjectDir);
  assert(buildNoCode.verified === false, 'Stage 07 correctly fails verification when source code is missing');
  assert(buildNoCode.issues.includes('MISSING_SOURCE_CODE_ARTIFACTS'), 'Stage 07 reports MISSING_SOURCE_CODE_ARTIFACTS');

  // Add source code and re-verify
  fs.mkdirSync(path.join(emptyProjectDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(emptyProjectDir, 'src', 'index.mjs'), 'export const ready = true;', 'utf-8');
  const buildWithCode = executeStageVerification('07_BUILD', emptyProjectDir);
  assert(buildWithCode.verified === true, 'Stage 07 verification succeeds once source code artifacts exist');

  // Stage 08 without tests should fail with MISSING_TEST_SUITE_ARTIFACTS
  const testNoTests = executeStageVerification('08_TEST', emptyProjectDir);
  assert(testNoTests.verified === false, 'Stage 08 correctly fails verification when test suite is missing');
  assert(testNoTests.issues.includes('MISSING_TEST_SUITE_ARTIFACTS'), 'Stage 08 reports MISSING_TEST_SUITE_ARTIFACTS');

  // Add tests and re-verify
  fs.mkdirSync(path.join(emptyProjectDir, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(emptyProjectDir, 'tests', 'index.test.mjs'), 'import test from "node:test";', 'utf-8');
  const testWithTests = executeStageVerification('08_TEST', emptyProjectDir);
  assert(testWithTests.verified === true, 'Stage 08 verification succeeds once test suite artifacts exist');

  // Stage 09 Verify succeeds
  const verifyRes = executeStageVerification('09_VERIFY', emptyProjectDir);
  assert(verifyRes.verified === true, 'Stage 09 verification succeeds with invariants and test suite present');

  // 7.4 Pipeline Execution & Prerequisite Failure Propagation
  const pipelineRes = verifyProjectLifecyclePipeline(emptyProjectDir, { humanAuthorized: true });
  assert(pipelineRes.total_stages_count === 15, 'Pipeline checked all 15 stages');
  assert(pipelineRes.verified_stages_count >= 9, 'Pipeline verified at least 9 stages');

  // Test failure propagation when an upstream manifest is deleted
  const brokenProjectDir = path.join(sandboxDir, 'BrokenPipelineTest');
  constructProjectLifecycle('Broken Pipeline Test', brokenProjectDir, { customRoot: BRAIN_ROOT });
  // Remove Stage 01 manifest
  fs.unlinkSync(path.join(brokenProjectDir, '.project-brain', 'lifecycle', '01-discover.json'));
  const brokenPipeline = verifyProjectLifecyclePipeline(brokenProjectDir);
  assert(brokenPipeline.success === false, 'Broken pipeline correctly reports success: false');
  assert(brokenPipeline.stage_results[0].status === 'MISSING_STAGE_MANIFEST', 'Stage 01 reports MISSING_STAGE_MANIFEST');
  assert(brokenPipeline.stage_results[1].status === 'BLOCKED_BY_PREREQUISITE', 'Stage 02 is blocked by failed Stage 01 prerequisite');
  assert(brokenPipeline.stage_results[5].status === 'BLOCKED_BY_PREREQUISITE', 'Downstream Stage 06 is blocked by upstream prerequisite failure');

  // 7.5 Multi-Product Generality (No IncidentLens Hardcoding)
  const telemetryGoal = 'DataPulse: Edge Telemetry Buffer and Alert Filter with ring-buffer storage and rate limiting';
  const telemetryDir = path.join(sandboxDir, 'DataPulseApp');
  const telemetryRes = constructProjectLifecycle(telemetryGoal, telemetryDir, { customRoot: BRAIN_ROOT });
  assert(telemetryRes.success === true, 'constructProjectLifecycle succeeded for distinct product goal');

  const dpDiscover = JSON.parse(fs.readFileSync(path.join(telemetryDir, '.project-brain', 'lifecycle', '01-discover.json'), 'utf-8'));
  assert(Array.isArray(dpDiscover.tasks) && dpDiscover.tasks.length > 0, 'DataPulse lifecycle has non-empty tasks in Stage 01');
  assert(dpDiscover.tasks[0].title.includes('DataPulse'), 'DataPulse tasks dynamically use product summary "DataPulse"');
  assert(!dpDiscover.tasks[0].title.includes('IncidentLens'), 'DataPulse tasks do NOT contain hardcoded "IncidentLens"');
  assert(!dpDiscover.tasks[0].title.includes('Markdown'), 'DataPulse tasks do NOT contain hardcoded "Markdown"');

} finally {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) { }
}

console.log('\n======================================================================');
console.log(`📊 LIFECYCLE ENGINE SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests === 0) {
  console.log('🎉 15-STAGE UNIVERSAL PROJECT CONSTRUCTION LIFECYCLE FULLY VERIFIED!');
  process.exit(0);
} else {
  console.error('❌ Project lifecycle engine test suite failed!');
  process.exit(1);
}

