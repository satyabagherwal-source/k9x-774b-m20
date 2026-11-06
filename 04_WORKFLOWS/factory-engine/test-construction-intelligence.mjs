/**
 * Automated Verification Suite for Construction Intelligence Engine (CIE)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-construction-intelligence.mjs
 * Purpose: Verifies the real construction integration bridging:
 *          - Domain A: Human & Need Intelligence (ProblemRecord)
 *          - Domain B: Product Intelligence (PRDSpecification & Negative Scope)
 *          - Domain C: Market & Business Intelligence (BusinessFeasibility)
 *          and downstream factory scaffolding into .project-brain/construction/
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  synthesizeProblemRecord,
  synthesizeMarketFeasibility,
  synthesizePRDSpecification,
  generateConstructionGuideMarkdown,
  synthesizeConstructionPackage,
  emitConstructionIntelligence
} from './construction-intelligence.mjs';
import { scaffoldProject } from './scaffold.mjs';
import { generateProjectBrainFiles } from './project-brain-schemas.mjs';
import { verifyProductGenerationBoundary } from './verifier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'construction-test-app');

console.log('======================================================================');
console.log('🧪 TEST SUITE: REAL CONSTRUCTION INTELLIGENCE INTEGRATION (DOMAINS A, B, C)');
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
  const sampleIntent = "Privacy-first client-side SVG to WebP image converter with zero server uploads, drag and drop, and instant offline conversion";
  const mockProfile = {
    id: "web-seo",
    name: "Static Content & SEO Web Portal",
    category: "web-seo",
    blueprint: "astro-tailwind-v4",
    architecture: "static-content-ssg",
    language: "JavaScript / TypeScript",
    runtime: "Node.js (>= 18.0.0)",
    frontend: "Astro v5 + Tailwind CSS v4",
    backend: "None (Static SSG / Client-Side)",
    database: "None (Local Content / In-Browser)",
    styling: "Tailwind CSS v4 (@theme, CSS-first)",
    packageManager: "npm",
    buildSystem: "astro build",
    deployment: "Vercel / Cloudflare Pages / Netlify",
    verificationPillars: ["build", "runtimeServer", "stylingTokens", "productGenerationBoundary"]
  };

  // ---------------------------------------------------------------------------
  // TEST 1: Domain A - Problem Record Synthesis
  // ---------------------------------------------------------------------------
  console.log('[TEST 1] Domain A: Synthesizing Human Need & Problem Record...');
  const problemRecord = synthesizeProblemRecord(sampleIntent, mockProfile);
  assert(problemRecord.problem_id && problemRecord.problem_id.startsWith('PROB-'), 'ProblemRecord has valid ID', problemRecord.problem_id);
  assert(problemRecord.problem_statement === sampleIntent, 'Problem statement preserves exact user intent');
  assert(problemRecord.target_user.primary_persona.length > 0, 'Target persona accurately derived', problemRecord.target_user.primary_persona);
  assert(problemRecord.pain_points.length >= 2, 'Pain points identified and cataloged', `Count: ${problemRecord.pain_points.length}`);
  assert(problemRecord.constraints.some(c => c.toLowerCase().includes('client-side')), 'Privacy & client-side boundary constraints enforced');
  assert(problemRecord.urgency_evaluation.severity === 'CRITICAL_SECURITY_RISK', 'Urgency evaluated as security/compliance critical');

  // ---------------------------------------------------------------------------
  // TEST 2: Domain C - Market & Business Feasibility Synthesis
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Domain C: Synthesizing Market & Commercial Feasibility...');
  const marketFeasibility = synthesizeMarketFeasibility(problemRecord, mockProfile);
  assert(marketFeasibility.feasibility_id && marketFeasibility.feasibility_id.startsWith('FEAS-'), 'Feasibility record has valid ID', marketFeasibility.feasibility_id);
  assert(marketFeasibility.feasibility_verdict === 'FEASIBLE', 'Feasibility verdict confirmed FEASIBLE');
  assert(marketFeasibility.competitor_matrix.length >= 2, 'Competitor matrix contains realistic market benchmarks', `Count: ${marketFeasibility.competitor_matrix.length}`);
  assert(marketFeasibility.value_proposition.toLowerCase().includes('zero-server') || marketFeasibility.value_proposition.toLowerCase().includes('in-browser'), 'Value proposition centers on in-browser privacy');
  assert(marketFeasibility.hurdle_rate_evaluation.gross_margin_potential.includes('90%+'), 'Hurdle rate confirms high margin potential from zero backend compute');

  // ---------------------------------------------------------------------------
  // TEST 3: Domain B - PRD Specification & Negative Scope
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Domain B: Synthesizing PRD Specification & Negative Scope...');
  const prd = synthesizePRDSpecification(problemRecord, marketFeasibility, mockProfile);
  assert(prd.prd_id && prd.prd_id.startsWith('PRD-'), 'PRDSpecification has valid ID', prd.prd_id);
  assert(prd.anchored_problem_id === problemRecord.problem_id, 'PRD anchors strictly to Domain A ProblemRecord');
  assert(prd.anchored_feasibility_id === marketFeasibility.feasibility_id, 'PRD anchors strictly to Domain C MarketFeasibility');
  assert(prd.mvp_scope.length >= 4, 'MVP Scope defined with required P0 features', `Count: ${prd.mvp_scope.length}`);
  assert(prd.negative_scope_exclusions.length >= 3, 'Non-negotiable Negative Scope explicitly defines what NOT to build', `Count: ${prd.negative_scope_exclusions.length}`);
  assert(prd.negative_scope_exclusions.some(e => e.feature_name.toLowerCase().includes('account') || e.feature_name.toLowerCase().includes('login')), 'Negative scope excludes user authentication overhead');
  assert(prd.user_stories.length >= 3, 'User stories defined with actionable acceptance criteria', `Count: ${prd.user_stories.length}`);

  // ---------------------------------------------------------------------------
  // TEST 4: Construction Specification Markdown Guide
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Construction Specification Markdown Synthesis...');
  const guideMd = generateConstructionGuideMarkdown(problemRecord, marketFeasibility, prd, mockProfile);
  assert(guideMd.includes('Human Need & Root Cause (Domain A)'), 'Guide contains Domain A human need section');
  assert(guideMd.includes('Value Proposition & Commercial Differentiation (Domain C)'), 'Guide contains Domain C commercial differentiation');
  assert(guideMd.includes('Strict MVP Scope — Features to Build (Domain B)'), 'Guide contains Domain B MVP features table');
  assert(guideMd.includes('Non-Negotiable Negative Scope — What NOT to Build (Domain B)'), 'Guide contains Domain B Negative Scope anti-bloat table');
  assert(guideMd.includes('Downstream Construction Guidelines (Domains F, G, H, J, K)'), 'Guide contains direct operational instructions for downstream construction');

  // ---------------------------------------------------------------------------
  // TEST 5: Unified Pipeline Synthesis & Disk Emission
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Construction Package Pipeline & Sandbox Emission...');
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  const pkg = synthesizeConstructionPackage(sampleIntent, mockProfile);
  const emittedFiles = emitConstructionIntelligence(SANDBOX_DIR, pkg);
  assert(emittedFiles.length === 4, 'Emitted all 4 construction intelligence artifacts to disk', `Count: ${emittedFiles.length}`);

  const probJsonPath = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'problem-record.json');
  const feasJsonPath = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'business-feasibility.json');
  const prdJsonPath = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'prd-specification.json');
  const guidePath = path.join(SANDBOX_DIR, '.project-brain', 'construction', 'CONSTRUCTION_SPECIFICATION.md');

  assert(fs.existsSync(probJsonPath), 'problem-record.json exists on disk');
  assert(fs.existsSync(feasJsonPath), 'business-feasibility.json exists on disk');
  assert(fs.existsSync(prdJsonPath), 'prd-specification.json exists on disk');
  assert(fs.existsSync(guidePath), 'CONSTRUCTION_SPECIFICATION.md exists on disk');

  // Validate parsed JSON
  const parsedPrd = JSON.parse(fs.readFileSync(prdJsonPath, 'utf-8'));
  assert(parsedPrd.prd_id === pkg.prdSpecification.prd_id, 'Persisted PRD JSON matches in-memory specification');

  // ---------------------------------------------------------------------------
  // TEST 6: Scaffolding Integration into Child Project
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing Scaffolding Integration with Construction Intelligence...');
  const scaffoldResult = scaffoldProject(SANDBOX_DIR, 'construction-test-app', {
    masterBrainPath: BRAIN_ROOT,
    profile: mockProfile,
    intent: sampleIntent,
    skipInstall: true
  });

  assert(scaffoldResult.constructionPackage !== null, 'Scaffolding produced constructionPackage object');
  assert(scaffoldResult.constructionFilesCreated === 4, 'Scaffolding emitted 4 construction intelligence files');
  assert(scaffoldResult.constructionPackage.feasibilityVerdict === 'FEASIBLE', 'Scaffolded project holds FEASIBLE verdict');

  // Verify PROJECT_CONTEXT.md enrichment
  const contextContent = fs.readFileSync(path.join(SANDBOX_DIR, 'PROJECT_CONTEXT.md'), 'utf-8');
  assert(contextContent.includes('Human Need & Problem Intelligence (Domain A)'), 'PROJECT_CONTEXT.md enriched with Domain A Problem Intelligence');
  assert(contextContent.includes('Commercial Feasibility & Value Proposition (Domain C)'), 'PROJECT_CONTEXT.md enriched with Domain C Commercial Feasibility');

  // Verify PROJECT_REQUIREMENTS.md enrichment
  const reqContent = fs.readFileSync(path.join(SANDBOX_DIR, 'PROJECT_REQUIREMENTS.md'), 'utf-8');
  assert(reqContent.includes('Strict MVP Scope (P0 Critical Features to Build)'), 'PROJECT_REQUIREMENTS.md enriched with P0 MVP Scope');
  assert(reqContent.includes('Non-Negotiable Negative Scope (What NOT to Build)'), 'PROJECT_REQUIREMENTS.md enriched with Negative Scope exclusions');

  // Verify PROJECT_STATE.json enrichment
  const stateObj = JSON.parse(fs.readFileSync(path.join(SANDBOX_DIR, 'PROJECT_STATE.json'), 'utf-8'));
  assert(stateObj.construction_intelligence && stateObj.construction_intelligence.synthesized === true, 'PROJECT_STATE.json tracks construction_intelligence status');
  assert(stateObj.construction_intelligence.problem_id.startsWith('PROB-'), 'PROJECT_STATE.json stores problem_id');
  assert(stateObj.construction_intelligence.mvp_features_count >= 4, 'PROJECT_STATE.json stores MVP features count');
  assert(stateObj.construction_intelligence.negative_scope_exclusions_count >= 3, 'PROJECT_STATE.json stores negative scope count');

  // ---------------------------------------------------------------------------
  // TEST 7: Product Generation Boundary Invariant (Rule 1670)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 7] Verifying Product Generation Boundary Invariant (Rule 1670)...');
  const boundaryCheck = verifyProductGenerationBoundary(SANDBOX_DIR, mockProfile);
  assert(boundaryCheck.status === 'PASS', 'Product Generation Boundary passes cleanly (0 product code generated in Phase A)', boundaryCheck.details);

  // ---------------------------------------------------------------------------
  // TEST 8: Master Brain 16-Folder Integrity
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 8] Verifying Master Brain 16-Folder Invariant...');
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

  // Cleanup sandbox
  fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  console.log('\n  🧹 [CLEANUP] Sandbox directory purged cleanly.');

} catch (err) {
  console.error('\n❌ Unexpected error in test suite:', err);
  failedTests++;
}

console.log('\n======================================================================');
console.log(`🏁 CONSTRUCTION INTELLIGENCE TEST SUITE: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
