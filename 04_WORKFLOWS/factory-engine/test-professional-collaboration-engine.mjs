/**
 * AI-Builder-Brain Universal Professional Collaboration Engine Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-professional-collaboration-engine.mjs
 * Purpose: Verifies Mission UPI-001 (Universal Professional Intelligence Expansion):
 *          1. 26-Discipline Taxonomy & Role Capability Models (Disciplines A through Z)
 *          2. Bidirectional Domain <-> Discipline Mapping (Domains A through M)
 *          3. Automated Multidisciplinary Inference across diverse complex product scenarios
 *          4. Workstream DAG Decomposition with dependency validation & phase ordering
 *          5. Cross-Discipline Conflict Resolution Engine (Trade-off matrices)
 *          6. Professional Collaboration Manifest Synthesis & Artifact Emission
 *          7. Deliverable Quality Gate Verification with Isolated Sandbox Simulation
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  DOMAIN_TO_DISCIPLINE_MAP,
  BASELINE_UNIVERSAL_DISCIPLINES,
  loadProfessionalRegistry,
  getDisciplineByCode,
  getDisciplineByName,
  inferRequiredDisciplines,
  decomposeMultidisciplinaryWorkstreams,
  resolveCrossDisciplineConflicts,
  synthesizeProfessionalCollaborationManifest,
  emitProfessionalCollaborationManifest,
  verifyMultidisciplinaryDeliverables,
  orchestrateMultidisciplinaryTeam
} from './professional-collaboration-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');
const SANDBOX_DIR = path.resolve(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'upce-verification');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

function cleanupSandbox() {
  if (fs.existsSync(SANDBOX_DIR)) {
    fs.rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
}

async function runTests() {
  console.log('======================================================================');
  console.log('AI-BUILDER-BRAIN UNIVERSAL PROFESSIONAL COLLABORATION ENGINE TEST SUITE');
  console.log('======================================================================\n');

  cleanupSandbox();
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Professional Registry Integrity across 26 Disciplines (A through Z)
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Verifying Professional Registry Integrity across 26 Disciplines (A-Z)...');
    const registry = loadProfessionalRegistry();
    assert(registry !== null && typeof registry === 'object', 'Professional registry loaded successfully');
    assert(registry.total_disciplines === 26, `Registry reports total_disciplines === 26 (found ${registry.total_disciplines})`);
    
    const disciplineKeys = Object.keys(registry.disciplines);
    assert(disciplineKeys.length === 26, `Exactly 26 discipline codes present (found ${disciplineKeys.length})`);

    const expectedLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const allLettersPresent = expectedLetters.every(letter => disciplineKeys.includes(letter));
    assert(allLettersPresent, 'All 26 letters (A through Z) are represented in discipline keys');

    // Sample checks for deep role capability models
    for (const letter of ['A', 'B', 'G', 'I', 'M', 'R', 'S', 'T', 'W', 'Z']) {
      const disc = getDisciplineByCode(letter);
      assert(disc.code === letter, `Discipline ${letter} has matching code`);
      assert(disc.roles && disc.roles.length > 0, `Discipline ${letter} contains at least 1 detailed role model`);
      const role = disc.roles[0];
      assert(typeof role.role_title === 'string' && role.role_title.length > 5, `Role in ${letter} has valid title: ${role.role_title}`);
      assert(Array.isArray(role.responsibilities) && role.responsibilities.length >= 2, `Role in ${letter} has responsibilities`);
      assert(Array.isArray(role.decision_frameworks) && role.decision_frameworks.length >= 2, `Role in ${letter} has decision frameworks`);
      assert(Array.isArray(role.deliverables) && role.deliverables.length >= 2, `Role in ${letter} has defined deliverables`);
      assert(role.collaboration_interfaces && role.collaboration_interfaces.inputs_from && role.collaboration_interfaces.outputs_to, `Role in ${letter} has inputs/outputs collaboration interfaces`);
      assert(Array.isArray(role.verification_procedures) && role.verification_procedures.length >= 2, `Role in ${letter} has empirical verification procedures`);
    }

    // Lookup by name
    const pmDiscipline = getDisciplineByName('Product, Business, Strategy and Management');
    assert(pmDiscipline !== null && pmDiscipline.code === 'A', 'getDisciplineByName correctly retrieves Discipline A');

    // -------------------------------------------------------------------------
    // TEST 2: Bidirectional 13-Domain <-> 26-Discipline Mapping Integrity
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifying Bidirectional Domain <-> Discipline Mapping...');
    const domainKeys = Object.keys(DOMAIN_TO_DISCIPLINE_MAP);
    assert(domainKeys.length === 13, `All 13 canonical domains (A-M) are mapped (found ${domainKeys.length})`);
    
    const canonicalDomains = 'ABCDEFGHIJKLM'.split('');
    const allDomainsPresent = canonicalDomains.every(d => domainKeys.includes(d));
    assert(allDomainsPresent, 'Canonical domains A through M are strictly mapped');

    // Check that every mapped discipline code is valid (in A-Z)
    let totalMappedCodes = 0;
    for (const [dom, discList] of Object.entries(DOMAIN_TO_DISCIPLINE_MAP)) {
      assert(Array.isArray(discList) && discList.length > 0, `Domain ${dom} maps to at least one discipline`);
      for (const code of discList) {
        assert(expectedLetters.includes(code), `Discipline code '${code}' in Domain ${dom} is valid`);
        totalMappedCodes++;
      }
    }
    assert(totalMappedCodes >= 26, `Total mapped discipline instances across domains is ${totalMappedCodes} (>= 26)`);

    // Verify reverse mapping: every discipline has a valid primary_domain in A-M
    for (const letter of expectedLetters) {
      const disc = getDisciplineByCode(letter);
      assert(canonicalDomains.includes(disc.primary_domain), `Discipline ${letter} primary_domain '${disc.primary_domain}' is in canonical A-M`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Automated Discipline Inference across Diverse Real-World Scenarios
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Verifying Automated Discipline Inference across Scenarios...');

    // Scenario A: Regulated Telehealth SaaS
    const telehealthGoal = 'HIPAA-compliant Telehealth Doctor Patient Consultation Platform with encrypted video, patient medical records, and Stripe billing';
    const telehealthDisciplines = inferRequiredDisciplines(telehealthGoal, { executionEnvironment: 'FULLSTACK_CLOUD_MANAGED' });
    const telehealthCodes = telehealthDisciplines.map(d => d.code);
    assert(telehealthCodes.includes('A'), 'Telehealth: Activates Product (A)');
    assert(telehealthCodes.includes('B'), 'Telehealth: Activates Fullstack (B)');
    assert(telehealthCodes.includes('R'), 'Telehealth: Activates Security & Privacy (R)');
    assert(telehealthCodes.includes('W'), 'Telehealth: Activates Legal & Compliance (W)');
    assert(telehealthCodes.includes('Y'), 'Telehealth: Activates Healthcare Industry Vertical (Y)');
    assert(telehealthCodes.includes('S'), 'Telehealth: Activates QA & Testing (S)');
    assert(telehealthCodes.includes('T'), 'Telehealth: Activates DevOps & Cloud (T)');

    // Scenario B: 3D WebGL Physics Game
    const gameGoal = 'Browser 3D space flight simulation game using WebGL, custom physics engine, particle shaders, and procedural galaxy generator';
    const gameDisciplines = inferRequiredDisciplines(gameGoal, { executionEnvironment: 'CLIENT_BROWSER_ONLY' });
    const gameCodes = gameDisciplines.map(d => d.code);
    assert(gameCodes.includes('I'), 'Game: Activates 2D/3D Graphics & Simulation (I)');
    assert(gameCodes.includes('J'), 'Game: Activates Game Design & Development (J)');
    assert(gameCodes.includes('K'), 'Game: Activates Math, Algorithms & Physics (K)');
    assert(gameCodes.includes('B'), 'Game: Activates Frontend/Fullstack (B)');
    assert(gameCodes.includes('G'), 'Game: Activates UI/UX Design (G)');

    // Scenario C: High-Throughput FinTech Distributed Ledger
    const fintechGoal = 'Distributed transaction ledger with Raft consensus, ACID PostgreSQL storage, cryptographic signatures, and fraud detection';
    const fintechDisciplines = inferRequiredDisciplines(fintechGoal, { executionEnvironment: 'FULLSTACK_CLOUD_MANAGED' });
    const fintechCodes = fintechDisciplines.map(d => d.code);
    assert(fintechCodes.includes('E'), 'FinTech: Activates Distributed Systems Architecture (E)');
    assert(fintechCodes.includes('F'), 'FinTech: Activates Database & Storage (F)');
    assert(fintechCodes.includes('R'), 'FinTech: Activates Cybersecurity & Cryptography (R)');
    assert(fintechCodes.includes('W'), 'FinTech: Activates Compliance/Financial Regulation (W)');

    // Scenario D: Local CLI Systems Utility
    const cliGoal = 'High-performance command-line POSIX utility in Rust for low-level memory tracing and binary inspection';
    const cliDisciplines = inferRequiredDisciplines(cliGoal, { executionEnvironment: 'CLI_LOCAL_RUNTIME' });
    const cliCodes = cliDisciplines.map(d => d.code);
    assert(cliCodes.includes('D'), 'CLI: Activates Systems, OS & Kernel Engineering (D)');
    assert(cliCodes.includes('O'), 'CLI: Activates Technical Documentation (O)');
    assert(cliCodes.includes('S'), 'CLI: Activates QA & Reliability (S)');

    // -------------------------------------------------------------------------
    // TEST 4: Multidisciplinary DAG Workstream Decomposition
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Verifying Workstream DAG Decomposition...');
    const workstreams = decomposeMultidisciplinaryWorkstreams(telehealthDisciplines);
    assert(Array.isArray(workstreams) && workstreams.length >= 6, `Decomposed into ${workstreams.length} distinct multidisciplinary workstreams (>= 6)`);

    // Verify all workstreams have valid structure
    const workstreamIds = new Set();
    for (const ws of workstreams) {
      assert(typeof ws.id === 'string' && ws.id.startsWith('WS-'), `Workstream ID '${ws.id}' follows convention`);
      assert(typeof ws.phase === 'string', `Workstream '${ws.id}' has a phase: ${ws.phase}`);
      assert(typeof ws.role === 'string', `Workstream '${ws.id}' assigned to role: ${ws.role}`);
      assert(Array.isArray(ws.deliverables) && ws.deliverables.length > 0, `Workstream '${ws.id}' has concrete deliverables`);
      workstreamIds.add(ws.id);
    }

    // Verify DAG dependencies are valid and non-dangling
    let totalDependenciesChecked = 0;
    for (const ws of workstreams) {
      for (const dep of ws.dependencies) {
        assert(workstreamIds.has(dep), `Dependency '${dep}' for workstream '${ws.id}' exists in DAG`);
        totalDependenciesChecked++;
      }
    }
    assert(totalDependenciesChecked > 0, `Checked ${totalDependenciesChecked} valid dependencies across workstreams`);

    // Verify phase sequence
    const phaseIndices = workstreams.map(w => parseInt(w.phase.slice(0, 2), 10));
    let isMonotonic = true;
    for (let i = 1; i < phaseIndices.length; i++) {
      if (phaseIndices[i] < phaseIndices[i - 1]) {
        isMonotonic = false;
        break;
      }
    }
    assert(isMonotonic, 'Workstream tasks strictly follow monotonic phase sequence');

    // -------------------------------------------------------------------------
    // TEST 5: Cross-Discipline Conflict Resolution Engine
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Verifying Cross-Discipline Conflict Resolution...');
    const conflicts = resolveCrossDisciplineConflicts(telehealthDisciplines);
    assert(Array.isArray(conflicts) && conflicts.length >= 2, `Identified and resolved ${conflicts.length} cross-discipline trade-offs`);

    for (const conf of conflicts) {
      assert(typeof conf.conflict_id === 'string', `Conflict has ID: ${conf.conflict_id}`);
      assert(typeof conf.resolved_decision === 'string' && conf.resolved_decision.length > 10, `Conflict ${conf.conflict_id} has concrete resolved decision`);
      assert(typeof conf.policy_applied === 'string', `Conflict ${conf.conflict_id} cites governing policy`);
      assert(typeof conf.governing_action === 'string', `Conflict ${conf.conflict_id} mandates actionable implementation guardrail`);
      assert(typeof conf.residual_risk === 'string', `Conflict ${conf.conflict_id} documents residual risk`);
    }

    // Test specific trade-off: Security vs Velocity
    const secConflict = conflicts.find(c => c.conflict_id === 'CONF-01-SEC-VS-VELOCITY');
    assert(secConflict !== undefined, 'Security vs Velocity conflict is recognized and resolved');
    assert(secConflict.policy_applied === 'Security & Safety First', 'Enforces Security & Safety First policy');

    // -------------------------------------------------------------------------
    // TEST 6: Manifest Synthesis & Disk Emission
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] Verifying Collaboration Manifest Synthesis & Emission...');
    const manifest = synthesizeProfessionalCollaborationManifest(
      telehealthGoal,
      telehealthDisciplines,
      workstreams,
      conflicts
    );

    assert(manifest.manifest_id.startsWith('MANIFEST-UPI-'), `Manifest ID follows standard: ${manifest.manifest_id}`);
    assert(manifest.metrics.total_active_disciplines === telehealthDisciplines.length, 'Metrics capture active disciplines');
    assert(manifest.metrics.total_workstreams === workstreams.length, 'Metrics capture workstream count');
    assert(manifest.metrics.total_expected_deliverables > 0, `Captured ${manifest.metrics.total_expected_deliverables} expected deliverables`);
    assert(manifest.metrics.canonical_domains_covered.length >= 5, `Covers ${manifest.metrics.canonical_domains_covered.length} canonical domains`);

    // Emit to isolated sandbox
    const emission = emitProfessionalCollaborationManifest(manifest, SANDBOX_DIR);
    assert(fs.existsSync(emission.jsonPath), `Collaboration manifest JSON emitted at: ${emission.jsonPath}`);
    assert(fs.existsSync(emission.mdPath), `Collaboration manifest Markdown emitted at: ${emission.mdPath}`);

    // Verify contents
    const emittedJson = JSON.parse(fs.readFileSync(emission.jsonPath, 'utf8'));
    assert(emittedJson.manifest_id === manifest.manifest_id, 'Emitted JSON matches in-memory manifest ID');
    const mdContent = fs.readFileSync(emission.mdPath, 'utf8');
    assert(mdContent.includes('# Universal Professional Collaboration Manifest'), 'Emitted Markdown contains valid header');
    assert(mdContent.includes('Active Multidisciplinary Disciplines & Roles'), 'Emitted Markdown contains discipline table');

    // -------------------------------------------------------------------------
    // TEST 7: Deliverable Quality Gate Verifier
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Verifying Deliverable Quality Gate in Isolated Sandbox...');
    
    // First run against empty sandbox -> expect FAIL / MISSING
    const emptyVerification = verifyMultidisciplinaryDeliverables(SANDBOX_DIR, manifest);
    assert(emptyVerification.status === 'FAILED', 'Quality gate correctly returns FAILED when deliverables are missing');
    assert(emptyVerification.failed_count === manifest.expected_deliverables.length, 'All deliverables flagged as missing');

    // Now populate simulated valid deliverables into sandbox
    for (const item of manifest.expected_deliverables) {
      const fullPath = path.resolve(SANDBOX_DIR, item.deliverable_name);
      const parentDir = path.dirname(fullPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(fullPath, `# Simulated Multidisciplinary Deliverable\nRole: ${item.role}\nDiscipline: ${item.discipline_code}\nTimestamp: ${new Date().toISOString()}\nContent: Verified mock implementation meeting contract.\n`, 'utf8');
    }

    // Second run against populated sandbox -> expect VERIFIED
    const populatedVerification = verifyMultidisciplinaryDeliverables(SANDBOX_DIR, manifest);
    assert(populatedVerification.status === 'VERIFIED', 'Quality gate correctly returns VERIFIED when all deliverables exist');
    assert(populatedVerification.passed_count === manifest.expected_deliverables.length, `100% of deliverables passed (${populatedVerification.passed_count}/${manifest.expected_deliverables.length})`);
    assert(populatedVerification.failed_count === 0, 'Zero failed deliverables');

    // -------------------------------------------------------------------------
    // TEST 8: High-Level End-to-End Orchestrator
    // -------------------------------------------------------------------------
    console.log('\n[TEST 8] Verifying High-Level orchestrateMultidisciplinaryTeam()...');
    const e2eResult = orchestrateMultidisciplinaryTeam('Autonomous Solar Farm Monitoring Platform with IoT sensors, ML anomaly detection, and a11y dashboard', {
      targetDir: SANDBOX_DIR,
      intentAnalysis: { executionEnvironment: 'FULLSTACK_CLOUD_MANAGED' }
    });

    assert(e2eResult.manifest !== undefined, 'E2E orchestrator returns manifest');
    assert(e2eResult.emission !== null && fs.existsSync(e2eResult.emission.jsonPath), 'E2E orchestrator writes manifest to targetDir');
    assert(e2eResult.metrics.total_active_disciplines >= 7, `E2E activated ${e2eResult.metrics.total_active_disciplines} disciplines`);

    // -------------------------------------------------------------------------
    // TEST 9: Robustness, Negative Scope & Error Handling
    // -------------------------------------------------------------------------
    console.log('\n[TEST 9] Verifying Error Handling & Robustness...');
    let threwOnInvalidCode = false;
    try {
      getDisciplineByCode('INVALID_CODE_999');
    } catch (e) {
      threwOnInvalidCode = true;
    }
    assert(threwOnInvalidCode, 'getDisciplineByCode throws clear error on invalid discipline code');

    const emptyGoalDisciplines = inferRequiredDisciplines('');
    assert(emptyGoalDisciplines.length >= BASELINE_UNIVERSAL_DISCIPLINES.length, 'Empty goal still activates baseline professional disciplines (A, B, G, S, O)');

    let threwOnInvalidManifest = false;
    try {
      verifyMultidisciplinaryDeliverables(SANDBOX_DIR, {});
    } catch (e) {
      threwOnInvalidManifest = true;
    }
    assert(threwOnInvalidManifest, 'verifyMultidisciplinaryDeliverables throws on malformed manifest');

  } finally {
    cleanupSandbox();
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED:      ${passedTests}`);
  console.log(`FAILED:      ${failedTests}`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();

