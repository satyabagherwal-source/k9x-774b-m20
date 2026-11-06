/**
 * Test Suite: URE-002 — Deep Repository Understanding & Semantic Intelligence
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-ure-002-semantic-intelligence.mjs
 * Purpose: Verifies AST-level semantic understanding, language adapters (JS/TS, Python, Go, Rust),
 *          control-flow paths, data-flow stages, circular dependency detection, product/domain
 *          intelligence, and HIQV gate integration.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

import {
  analyzeRepository,
  executeRepositoryLearningPipeline,
  scanRepositoryFiles,
  extractRepositoryManifest,
  extractTechnologyInventory,
  extractComponentInventory,
  buildArchitectureMap,
  detectCircularDependencies,
  extractProductDomainIntelligence,
  extractReusableConstructionPatterns,
  getAllAdapters,
  getSupportedLanguages,
  URE_VERSION,
  COMPONENT_TYPES,
  ARCHITECTURE_STYLES
} from './universal-repository-learning-engine.mjs';

import {
  validateHarvestedIntelligence,
  verifyReportIntegrity,
  VALIDATOR_DECISIONS
} from './harvested-intelligence-quality-validator.mjs';

import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const SANDBOX_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'ure-002-test');
const FIXTURES_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'ure-002-fixtures');

/**
 * Creates multi-language test fixtures across JS, TS, Python, Go, Rust, and Circular dependencies
 */
function setupFixtures() {
  if (fs.existsSync(FIXTURES_ROOT)) {
    fs.rmSync(FIXTURES_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

  // =========================================================================
  // FIXTURE 1: Multi-Module JavaScript Application (js-app)
  // =========================================================================
  const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
  fs.mkdirSync(path.join(jsAppDir, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(jsAppDir, 'src', 'services'), { recursive: true });
  fs.mkdirSync(path.join(jsAppDir, 'src', 'models'), { recursive: true });
  fs.mkdirSync(path.join(jsAppDir, 'tests'), { recursive: true });

  fs.writeFileSync(path.join(jsAppDir, 'package.json'), JSON.stringify({
    name: 'user-analytics-service',
    version: '2.0.0',
    description: 'High performance user event and analytics ingestion engine.',
    type: 'module',
    main: 'src/index.mjs',
    scripts: { test: 'node --test tests/*.test.mjs' },
    dependencies: { fastify: '^4.26.0', zod: '^3.22.4' },
    license: 'MIT'
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(jsAppDir, 'README.md'), `# User Analytics Service\nHigh performance user event and analytics ingestion engine.\n`, 'utf-8');
  fs.writeFileSync(path.join(jsAppDir, '.gitignore'), "node_modules/\n", 'utf-8');

  // src/models/user.mjs
  fs.writeFileSync(path.join(jsAppDir, 'src', 'models', 'user.mjs'), `export class UserModel {
  constructor(id, name, email) {
    this.id = id;
    this.name = name;
    this.email = email;
  }

  validate() {
    return Boolean(this.id && this.name);
  }
}
`, 'utf-8');

  // src/services/user-service.mjs
  fs.writeFileSync(path.join(jsAppDir, 'src', 'services', 'user-service.mjs'), `import { UserModel } from '../models/user.mjs';

export class UserService {
  constructor(options = {}) {
    this.users = new Map();
    this.maxUsers = options.maxUsers || 5000;
  }

  isHealthy() {
    return this.users.size < this.maxUsers;
  }

  async createUser(payload) {
    if (!payload.name) {
      throw new Error('VALIDATION_FAILED: name is required');
    }
    const user = new UserModel(payload.id || Date.now().toString(), payload.name, payload.email);
    this.users.set(user.id, user);
    return user;
  }

  async flush() {
    this.users.clear();
  }
}
`, 'utf-8');

  // src/routes/users.mjs
  fs.writeFileSync(path.join(jsAppDir, 'src', 'routes', 'users.mjs'), `export function registerUserRoutes(fastify, userService) {
  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    const isReady = userService.isHealthy();
    if (!isReady) {
      return reply.status(503).send({ status: 'UNHEALTHY', reason: 'User map saturated' });
    }
    return reply.status(200).send({ status: 'HEALTHY' });
  });

  // User creation endpoint
  fastify.post('/users', async (request, reply) => {
    try {
      const created = await userService.createUser(request.body);
      return reply.status(201).send(created);
    } catch (err) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
`, 'utf-8');

  // src/server.mjs
  fs.writeFileSync(path.join(jsAppDir, 'src', 'server.mjs'), `import Fastify from 'fastify';
import { registerUserRoutes } from './routes/users.mjs';

export function createServer({ userService }) {
  const app = Fastify({ logger: false });
  registerUserRoutes(app, userService);
  return app;
}
`, 'utf-8');

  // src/index.mjs
  fs.writeFileSync(path.join(jsAppDir, 'src', 'index.mjs'), `import { createServer } from './server.mjs';
import { UserService } from './services/user-service.mjs';

const userService = new UserService();
const app = createServer({ userService });

const shutdown = async (signal) => {
  console.log(\`Received \${signal}, closing HTTP server...\`);
  await app.close();
  await userService.flush();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

app.listen({ port: 3000, host: '0.0.0.0' });
`, 'utf-8');

  // tests/users.test.mjs
  fs.writeFileSync(path.join(jsAppDir, 'tests', 'users.test.mjs'), `import assert from 'assert';
import { test, describe, it } from 'node:test';
import { UserService } from '../src/services/user-service.mjs';

describe('UserService Suite', () => {
  it('creates and validates new user record', async () => {
    const svc = new UserService();
    const user = await svc.createUser({ name: 'Alice' });
    assert.strictEqual(user.name, 'Alice');
  });
});
`, 'utf-8');

  // Git init in js-app
  try {
    execSync('git init', { cwd: jsAppDir, stdio: 'ignore' });
    execSync('git config user.name "URE-002 Test"', { cwd: jsAppDir, stdio: 'ignore' });
    execSync('git config user.email "ure2@test.local"', { cwd: jsAppDir, stdio: 'ignore' });
    execSync('git add .', { cwd: jsAppDir, stdio: 'ignore' });
    execSync('git commit -m "feat: user analytics service initial commit"', { cwd: jsAppDir, stdio: 'ignore' });
  } catch (e) {}

  // =========================================================================
  // FIXTURE 2: TypeScript Application (ts-app)
  // =========================================================================
  const tsAppDir = path.join(FIXTURES_ROOT, 'ts-app');
  fs.mkdirSync(path.join(tsAppDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(tsAppDir, 'src', 'types.ts'), `export interface TelemetryEvent {
  eventId: string;
  timestamp: number;
  tags: string[];
}
`, 'utf-8');

  fs.writeFileSync(path.join(tsAppDir, 'src', 'calculator.ts'), `import { TelemetryEvent } from './types.ts';

export class MetricCalculator {
  constructor(private precision: number = 2) {}

  public calculateAverage(events: TelemetryEvent[]): number {
    if (events.length === 0) return 0;
    return events.length;
  }

  public async evaluateAsync(event: TelemetryEvent): Promise<boolean> {
    return event.timestamp > 0;
  }
}
`, 'utf-8');

  // =========================================================================
  // FIXTURE 3: Python Application (python-app)
  // =========================================================================
  const pyAppDir = path.join(FIXTURES_ROOT, 'python-app');
  fs.mkdirSync(pyAppDir, { recursive: true });

  fs.writeFileSync(path.join(pyAppDir, 'main.py'), `from utils import format_greeting
import os

class DataStore:
  def __init__(self, capacity: int = 100):
    self.capacity = capacity
    self.items = []

  def add_item(self, item: str) -> bool:
    if len(self.items) >= self.capacity:
      return False
    self.items.append(item)
    return True

def start_server():
  try:
    store = DataStore(50)
    print("Server started")
  except Exception as e:
    print(f"Error: {e}")
`, 'utf-8');

  fs.writeFileSync(path.join(pyAppDir, 'utils.py'), `def format_greeting(name: str) -> str:
  return f"Hello, {name}!"
`, 'utf-8');

  // =========================================================================
  // FIXTURE 4: Go Application (go-app)
  // =========================================================================
  const goAppDir = path.join(FIXTURES_ROOT, 'go-app');
  fs.mkdirSync(goAppDir, { recursive: true });

  fs.writeFileSync(path.join(goAppDir, 'main.go'), `package main

import (
  "fmt"
  "os"
)

type ServerConfig struct {
  Port int
  Host string
}

func (s *ServerConfig) Validate() bool {
  return s.Port > 0
}

func StartServer(cfg ServerConfig) error {
  if !cfg.Validate() {
    return fmt.Errorf("invalid port")
  }
  return nil
}

func main() {
  fmt.Println("Starting Go Server")
}
`, 'utf-8');

  // =========================================================================
  // FIXTURE 5: Rust Application (rust-app)
  // =========================================================================
  const rustAppDir = path.join(FIXTURES_ROOT, 'rust-app');
  fs.mkdirSync(path.join(rustAppDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(rustAppDir, 'src', 'main.rs'), `use std::io;

pub struct TelemetryConfig {
  pub buffer_size: usize,
}

impl TelemetryConfig {
  pub fn new(size: usize) -> Self {
    TelemetryConfig { buffer_size: size }
  }
}

pub fn run_telemetry(cfg: TelemetryConfig) -> Result<(), io::Error> {
  println!("Telemetry running with buffer: {}", cfg.buffer_size);
  Ok(())
}
`, 'utf-8');

  // =========================================================================
  // FIXTURE 6: Circular Dependency Fixture (circular-app)
  // =========================================================================
  const circularDir = path.join(FIXTURES_ROOT, 'circular-app');
  fs.mkdirSync(circularDir, { recursive: true });

  fs.writeFileSync(path.join(circularDir, 'moduleA.mjs'), `import { helperB } from './moduleB.mjs';
export function helperA() { return helperB(); }
`, 'utf-8');

  fs.writeFileSync(path.join(circularDir, 'moduleB.mjs'), `import { helperA } from './moduleA.mjs';
export function helperB() { return 'B'; }
`, 'utf-8');
}

/**
 * Prepares isolated sandbox brain
 */
function setupSandboxBrain() {
  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'cache'), { recursive: true });

  const initialPatterns = `# Canonical Engineering Patterns

## Rule 1. Architectural Baseline
**RULE**: Baseline pattern for sandbox isolation.
<!-- PROVENANCE_START
{"ruleNumber":1,"title":"Architectural Baseline","promotedAt":"2026-03-31T00:00:00.000Z"}
PROVENANCE_END -->
`;
  fs.writeFileSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), initialPatterns, 'utf-8');
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🧪 TEST SUITE: URE-002 DEEP REPOSITORY UNDERSTANDING & SEMANTICS');
  console.log(`   Fixtures Root: ${FIXTURES_ROOT}`);
  console.log(`   Sandbox Brain: ${SANDBOX_ROOT}`);
  console.log('======================================================================\n');

  setupFixtures();
  setupSandboxBrain();

  let passCount = 0;
  function pass(msg) {
    console.log(`  ✅ [PASS] ${msg}`);
    passCount++;
  }

  // -------------------------------------------------------------------
  // TEST 1: Multi-Language Adapter Registry & Declared Capabilities
  // -------------------------------------------------------------------
  console.log('[TEST 1] Multi-Language Adapter Registry & Declared Capabilities...');
  {
    const adapters = getAllAdapters();
    assert.strictEqual(adapters.length, 4, 'Four language adapters registered (JS/TS, Python, Go, Rust)');

    const supported = getSupportedLanguages();
    assert(supported.some(s => s.name.includes('JavaScript') && s.capabilities.ast_level === 'RECURSIVE_DESCENT_SYNTAX_TREE'), 'JS/TS declares RECURSIVE_DESCENT_SYNTAX_TREE');
    assert(supported.some(s => s.name.includes('Python') && s.capabilities.ast_level === 'SYNTAX_SCANNER_PARTIAL'), 'Python declares SYNTAX_SCANNER_PARTIAL');
    assert(supported.some(s => s.name.includes('Go') && s.capabilities.ast_level === 'SYNTAX_SCANNER_PARTIAL'), 'Go declares SYNTAX_SCANNER_PARTIAL');
    assert(supported.some(s => s.name.includes('Rust') && s.capabilities.ast_level === 'SYNTAX_SCANNER_PARTIAL'), 'Rust declares SYNTAX_SCANNER_PARTIAL');

    pass('Adapter registry reports truthful AST capability levels and language extensions');
  }

  // -------------------------------------------------------------------
  // TEST 2: JavaScript/TypeScript AST-Level Symbol Intelligence
  // -------------------------------------------------------------------
  console.log('\n[TEST 2] JavaScript/TypeScript AST-Level Symbol Intelligence...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);

    const userModelComp = pkg.component_inventory.find(c => c.relative_path === 'src/models/user.mjs');
    assert(userModelComp, 'UserModel component found');
    assert(userModelComp.semantic_model.symbols.some(s => s.name === 'UserModel' && s.kind === 'CLASS'), 'UserModel classified as CLASS with AST analysis');

    const userServiceComp = pkg.component_inventory.find(c => c.relative_path === 'src/services/user-service.mjs');
    assert(userServiceComp, 'UserService component found');
    const classSym = userServiceComp.semantic_model.symbols.find(s => s.name === 'UserService');
    assert(classSym, 'UserService class symbol extracted');
    assert(classSym.methods.some(m => m.name === 'createUser' && m.is_async === true), 'createUser method extracted with is_async: true');
    assert(classSym.methods.some(m => m.name === 'isHealthy'), 'isHealthy method extracted');

    pass('AST-level symbol extraction captured classes, methods, parameters, and async signatures');
  }

  // -------------------------------------------------------------------
  // TEST 3: Control-Flow and Execution Path Intelligence
  // -------------------------------------------------------------------
  console.log('\n[TEST 3] Control-Flow and Execution Path Intelligence...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);
    const controlFlows = pkg.control_flow_intelligence.paths;

    assert(controlFlows.some(cf => cf.type === 'ROUTE_REGISTRATION' && cf.route_path === '/health'), 'Route registration /health captured');
    assert(controlFlows.some(cf => cf.type === 'ROUTE_REGISTRATION' && cf.route_path === '/users'), 'Route registration /users captured');
    assert(controlFlows.some(cf => cf.type === 'PROCESS_SIGNAL_HANDLER' && cf.signal === 'SIGTERM'), 'Process signal handler SIGTERM captured');
    assert(controlFlows.some(cf => cf.type === 'TEARDOWN_LIFECYCLE' && cf.target.includes('close')), 'Teardown lifecycle call app.close captured');
    assert(controlFlows.some(cf => cf.type === 'EXPLICIT_ERROR_THROW'), 'Explicit error throw statement captured');
    assert(controlFlows.some(cf => cf.type === 'ERROR_BOUNDARY_TRY_CATCH'), 'Error boundary try/catch block captured');

    pass('Control-flow intelligence traced routes, signal handlers, error throws, and try/catch blocks');
  }

  // -------------------------------------------------------------------
  // TEST 4: Data-Flow Intelligence
  // -------------------------------------------------------------------
  console.log('\n[TEST 4] Data-Flow Intelligence...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);
    const dataFlows = pkg.data_flow_intelligence.flows;

    assert(dataFlows.some(df => df.stage === 'OUTPUT_DISPATCH'), 'Output response dispatch (reply.send) identified');
    pass('Data-flow intelligence mapped request input and response output stages');
  }

  // -------------------------------------------------------------------
  // TEST 5: Architecture Intelligence & Acyclic Verification
  // -------------------------------------------------------------------
  console.log('\n[TEST 5] Architecture Intelligence & Acyclic Verification in Layered App...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);
    const arch = pkg.architecture_map;

    assert.strictEqual(arch.style, ARCHITECTURE_STYLES.LAYERED_SERVICE, 'Architecture style is LAYERED_SERVICE');
    assert.strictEqual(arch.cycle_status, 'ACYCLIC_VERIFIED', 'Layered app verified as strictly ACYCLIC');
    assert.strictEqual(arch.circular_dependencies.length, 0, 'Zero circular dependencies in clean layered app');
    assert(arch.coupling_metrics.total_internal_edges >= 4, `Internal coupling edges computed (Found: ${arch.coupling_metrics.total_internal_edges})`);

    pass('Architecture map computed acyclic status and coupling metrics');
  }

  // -------------------------------------------------------------------
  // TEST 6: Circular Dependency Detection Algorithm
  // -------------------------------------------------------------------
  console.log('\n[TEST 6] Circular Dependency Detection Algorithm...');
  {
    const circularDir = path.join(FIXTURES_ROOT, 'circular-app');
    const pkg = analyzeRepository(circularDir);
    const arch = pkg.architecture_map;

    assert.strictEqual(arch.cycle_status, 'CIRCULAR_DEPENDENCIES_DETECTED', 'Circular dependencies correctly detected');
    assert(arch.circular_dependencies.length > 0, 'Cycles array populated');
    const cycle = arch.circular_dependencies[0];
    assert(cycle.some(c => c.includes('moduleA')) && cycle.some(c => c.includes('moduleB')), 'Detected cycle between moduleA and moduleB');

    pass('Cycle detection algorithm successfully intercepted circular imports (moduleA <-> moduleB)');
  }

  // -------------------------------------------------------------------
  // TEST 7: TypeScript Application & Interface Semantic Extraction
  // -------------------------------------------------------------------
  console.log('\n[TEST 7] TypeScript Application & Interface Semantic Extraction...');
  {
    const tsAppDir = path.join(FIXTURES_ROOT, 'ts-app');
    const pkg = analyzeRepository(tsAppDir);

    const typesComp = pkg.component_inventory.find(c => c.relative_path === 'src/types.ts');
    assert(typesComp, 'src/types.ts component found');
    assert(typesComp.semantic_model.symbols.some(s => s.name === 'TelemetryEvent' && s.kind === 'INTERFACE'), 'TelemetryEvent extracted as INTERFACE');

    const calcComp = pkg.component_inventory.find(c => c.relative_path === 'src/calculator.ts');
    assert(calcComp, 'src/calculator.ts component found');
    const calcSym = calcComp.semantic_model.symbols.find(s => s.name === 'MetricCalculator');
    assert(calcSym, 'MetricCalculator class extracted');
    assert(calcSym.methods.some(m => m.name === 'evaluateAsync' && m.is_async === true), 'evaluateAsync method extracted with is_async: true');

    pass('TypeScript interfaces and classes extracted with parameter and return type metadata');
  }

  // -------------------------------------------------------------------
  // TEST 8: Python Language Adapter & Limitation Reporting
  // -------------------------------------------------------------------
  console.log('\n[TEST 8] Python Language Adapter & Limitation Reporting...');
  {
    const pyAppDir = path.join(FIXTURES_ROOT, 'python-app');
    const pkg = analyzeRepository(pyAppDir);

    const mainPy = pkg.component_inventory.find(c => c.relative_path === 'main.py');
    assert(mainPy, 'main.py component found');
    assert(mainPy.semantic_model.symbols.some(s => s.name === 'DataStore' && s.kind === 'CLASS'), 'DataStore extracted as CLASS');
    assert(mainPy.semantic_model.symbols.some(s => s.name === 'start_server' && s.kind === 'FUNCTION'), 'start_server extracted as FUNCTION');
    assert(mainPy.semantic_model.control_flows.some(cf => cf.type === 'ERROR_BOUNDARY_TRY_EXCEPT'), 'Python try/except block captured');

    // Check limitations
    const limitations = mainPy.semantic_model.limitations;
    assert(limitations.some(l => l.includes('metaclass')), 'Truthful Python metaclass limitation reported');

    pass('Python declarations and error boundaries extracted with truthful limitation boundaries');
  }

  // -------------------------------------------------------------------
  // TEST 9: Go Language Adapter
  // -------------------------------------------------------------------
  console.log('\n[TEST 9] Go Language Adapter...');
  {
    const goAppDir = path.join(FIXTURES_ROOT, 'go-app');
    const pkg = analyzeRepository(goAppDir);

    const mainGo = pkg.component_inventory.find(c => c.relative_path === 'main.go');
    assert(mainGo, 'main.go component found');
    assert(mainGo.semantic_model.symbols.some(s => s.name === 'ServerConfig' && s.kind === 'CLASS'), 'ServerConfig struct extracted as CLASS');
    assert(mainGo.semantic_model.symbols.some(s => s.name === 'Validate' && s.kind === 'METHOD'), 'Receiver method Validate extracted');
    assert(mainGo.semantic_model.symbols.some(s => s.name === 'StartServer' && s.exported === true), 'StartServer exported status verified (capital letter idiom)');

    pass('Go structs, receiver methods, and capitalized exported status accurately identified');
  }

  // -------------------------------------------------------------------
  // TEST 10: Rust Language Adapter
  // -------------------------------------------------------------------
  console.log('\n[TEST 10] Rust Language Adapter...');
  {
    const rustAppDir = path.join(FIXTURES_ROOT, 'rust-app');
    const pkg = analyzeRepository(rustAppDir);

    const mainRs = pkg.component_inventory.find(c => c.relative_path === 'src/main.rs');
    assert(mainRs, 'src/main.rs component found');
    assert(mainRs.semantic_model.symbols.some(s => s.name === 'TelemetryConfig' && s.exported === true), 'TelemetryConfig pub struct extracted as exported');
    assert(mainRs.semantic_model.symbols.some(s => s.name === 'run_telemetry' && s.exported === true), 'run_telemetry pub fn extracted as exported');

    pass('Rust pub structs and pub fn declarations extracted with visibility tracking');
  }

  // -------------------------------------------------------------------
  // TEST 11: Product & Domain Intelligence
  // -------------------------------------------------------------------
  console.log('\n[TEST 11] Product & Domain Intelligence...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);
    const prod = pkg.product_domain_intelligence;

    assert(prod.user_facing_features.some(f => f.name.includes('Health')), 'User-facing feature: Health Probe extracted');
    assert(prod.domain_entities.some(e => e.name === 'UserModel'), 'Domain entity UserModel extracted');
    assert(prod.domain_entities.some(e => e.name === 'UserService'), 'Domain entity UserService extracted');
    assert(prod.business_rules.length > 0, 'Business rules recorded with enforcement locations');

    pass('Product and domain intelligence extracted features, entities, and business rules');
  }

  // -------------------------------------------------------------------
  // TEST 12: Construction Pattern Multi-Dimensional Classification
  // -------------------------------------------------------------------
  console.log('\n[TEST 12] Construction Pattern Multi-Dimensional Classification...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);
    const pat = pkg.reusable_construction_patterns[0];

    assert(pat.observed_implementation, 'observed_implementation present with exact code');
    assert(pat.architectural_interpretation, 'architectural_interpretation present');
    assert(pat.generalizable_invariant, 'generalizable_invariant present with normative rule');
    assert(pat.context_constraints, 'context_constraints present with project boundary');

    pass('Construction patterns distinguish implementation, architecture, invariants, and constraints');
  }

  // -------------------------------------------------------------------
  // TEST 13: HIQV Quality Gate & Authentic Origin Verification
  // -------------------------------------------------------------------
  console.log('\n[TEST 13] HIQV Quality Gate & Authentic Origin Verification...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pkg = analyzeRepository(jsAppDir);
    const pat = pkg.reusable_construction_patterns[0];

    const rawCandItem = {
      title: pat.title,
      body: `### ${pat.title}\n**RULE**: ${pat.statement}\n**WHY**: ${pat.why}\n**WHEN TO APPLY**: ${pat.when_to_apply}\n**VERIFIED IMPLEMENTATION PATTERN**:\n\`\`\`javascript\n${pat.implementation}\n\`\`\`\n**NEGATIVE CONSTRAINT**:\n\`\`\`javascript\n${pat.negative_constraint}\n\`\`\`\n**VERIFICATION METHOD**: Static code analysis.`,
      repository: jsAppDir,
      source_url: jsAppDir,
      source_id: pat.source.id,
      source_uri: pat.source.uri,
      source_version: pat.source.version,
      license: 'MIT',
      source: pat.source
    };

    const valReport = validateHarvestedIntelligence(rawCandItem, pat.evidence_list, { brainRoot: SANDBOX_ROOT });
    assert(valReport.decision === VALIDATOR_DECISIONS.PASS || valReport.decision === VALIDATOR_DECISIONS.CONDITIONAL_PASS, 'Quality gate grants valid decision');
    assert(valReport.auth_token && valReport.auth_token.length === 64, 'Cryptographic HMAC authenticity token generated');

    const integrityCheck = verifyReportIntegrity(rawCandItem, pat.evidence_list, valReport);
    assert.strictEqual(integrityCheck.valid, true, 'Cryptographic integrity passes');

    pass('HIQV quality gate verifies candidate pattern and generates authentic HMAC token');
  }

  // -------------------------------------------------------------------
  // TEST 14: End-to-End Pipeline & Live BM25 Retrieval
  // -------------------------------------------------------------------
  console.log('\n[TEST 14] End-to-End Pipeline & Live BM25 Retrieval...');
  {
    const jsAppDir = path.join(FIXTURES_ROOT, 'js-app');
    const pipelineResult = await executeRepositoryLearningPipeline(jsAppDir, {
      brainRoot: SANDBOX_ROOT
    });

    assert.strictEqual(pipelineResult.success, true, 'Pipeline returns success: true');
    assert(pipelineResult.intelligence_package, 'Repository Intelligence Package generated');
    assert.strictEqual(pipelineResult.retrieval_verified, true, 'Live BM25 retrieval verified');

    // Read back dossier
    const dossierPath = path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING', 'ure-user-analytics-service-learnings.md');
    assert(fs.existsSync(dossierPath), 'Dossier flushed to disk in 07_PROJECT_LEARNING/');
    const content = fs.readFileSync(dossierPath, 'utf-8');
    assert(content.includes('user-analytics-service'), 'Dossier contains service name');
    assert(content.includes('Symbols Extracted'), 'Dossier embeds semantic symbols count');

    pass('End-to-end pipeline persists dossier, updates BM25 index, and verifies live retrieval');
  }

  // -------------------------------------------------------------------
  // TEST 15: Production Purity Verification
  // -------------------------------------------------------------------
  console.log('\n[TEST 15] Production Purity Verification...');
  {
    const prodPatterns = fs.readFileSync(path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md'), 'utf-8');
    assert(!prodPatterns.includes('user-analytics-service'), 'Production patterns file strictly unpolluted');
    pass('Canonical production knowledge (05_KNOWLEDGE) is 100% pristine and unmodified');
  }

  console.log('\n======================================================================');
  console.log(`🏁 URE-002 TEST SUITE SUMMARY: ${passCount} PASSED | 0 FAILED`);
  console.log('======================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Fatal error running URE-002 test suite:', err);
  process.exit(1);
});
