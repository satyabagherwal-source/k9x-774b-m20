/**
 * Test Suite: URE-003 — Cross-Repository Learning & Semantic Corroboration Engine
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-ure-003-cross-repo-corroboration.mjs
 * Purpose: Verifies multi-repository intelligence aggregation, semantic equivalence normalization,
 *          multi-source independent corroboration, duplication/mirror defense (non-inflation),
 *          contradiction/anti-pattern interception, context boundary preservation, HIQV quality gate
 *          with HMAC verification, sandbox canonical promotion, and live BM25 retrieval.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  corroborateMultiRepositoryPatterns,
  executeCrossRepositoryLearningPipeline,
  clusterCrossRepositoryPatterns,
  computePatternSemanticSimilarity,
  normalizePatternForComparison,
  CORROBORATION_STATUS,
  CORROBORATION_ENGINE_VERSION
} from './cross-repository-corroboration-engine.mjs';

import {
  analyzeRepository
} from './universal-repository-learning-engine.mjs';

import {
  validateHarvestedIntelligence,
  verifyReportIntegrity,
  VALIDATOR_DECISIONS
} from './harvested-intelligence-quality-validator.mjs';

import {
  INDEPENDENCE_TIERS,
  createEvidenceRecord,
  EVIDENCE_TYPES,
  VERIFICATION_METHODS,
  EVIDENCE_STATUS
} from './knowledge-intelligence-engine.mjs';

import { searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const FIXTURES_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'ure-003-fixtures');
const SANDBOX_ROOT = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'ure-003-test');

function sha256(content) {
  return crypto.createHash('sha256').update(String(content), 'utf8').digest('hex');
}

/**
 * Setup isolated test fixtures and sandbox brain
 */
function setupFixturesAndSandbox() {
  if (fs.existsSync(FIXTURES_ROOT)) {
    fs.rmSync(FIXTURES_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

  if (fs.existsSync(SANDBOX_ROOT)) {
    fs.rmSync(SANDBOX_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(SANDBOX_ROOT, { recursive: true });

  // Sandbox directories
  fs.mkdirSync(path.join(SANDBOX_ROOT, '05_KNOWLEDGE'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '07_PROJECT_LEARNING'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '08_VERIFICATION'), { recursive: true });
  fs.mkdirSync(path.join(SANDBOX_ROOT, '.project-brain', 'cache'), { recursive: true });

  // Copy template engineering-patterns.md
  const prodPatterns = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  const sandboxPatterns = path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (fs.existsSync(prodPatterns)) {
    fs.copyFileSync(prodPatterns, sandboxPatterns);
  } else {
    fs.writeFileSync(sandboxPatterns, '# Engineering Patterns\n\n## 1. Core Invariants\n', 'utf-8');
  }

  // =========================================================================
  // FIXTURE 1: repo-fastify-clean
  // Node.js Fastify microservice with graceful shutdown and health check
  // =========================================================================
  const fastifyDir = path.join(FIXTURES_ROOT, 'repo-fastify-clean');
  fs.mkdirSync(path.join(fastifyDir, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(fastifyDir, 'tests'), { recursive: true });

  fs.writeFileSync(path.join(fastifyDir, 'package.json'), JSON.stringify({
    name: 'payment-gateway-service',
    version: '1.2.0',
    description: 'High reliability financial transaction microservice with Fastify',
    type: 'module',
    main: 'src/index.mjs',
    dependencies: { fastify: '^4.26.0' },
    license: 'MIT'
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(fastifyDir, 'README.md'), `# Payment Gateway Service\nProduction financial transactions service.\n`, 'utf-8');

  fs.writeFileSync(path.join(fastifyDir, 'src', 'index.mjs'), `
import Fastify from 'fastify';
import { healthRoutes } from './routes/health.mjs';

const app = Fastify({ logger: true });
app.register(healthRoutes);

const shutdown = async (signal) => {
  console.log(\`Received \${signal}, closing active server sockets and draining connections...\`);
  await app.close();
  console.log('Server closed successfully.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
`, 'utf-8');

  fs.writeFileSync(path.join(fastifyDir, 'src', 'routes', 'health.mjs'), `
export async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    const isReady = true;
    if (!isReady) {
      return reply.status(503).send({ status: 'UNHEALTHY', reason: 'Collector buffer saturated' });
    }
    return reply.status(200).send({ status: 'HEALTHY' });
  });
}
`, 'utf-8');

  fs.writeFileSync(path.join(fastifyDir, 'tests', 'service.test.mjs'), `
import assert from 'assert';
console.log('Testing fastify payment gateway...');
assert.strictEqual(1, 1);
`, 'utf-8');

  // =========================================================================
  // FIXTURE 2: repo-express-clean
  // Node.js Express microservice with equivalent graceful shutdown (syntactically different!)
  // =========================================================================
  const expressDir = path.join(FIXTURES_ROOT, 'repo-express-clean');
  fs.mkdirSync(path.join(expressDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(expressDir, 'tests'), { recursive: true });

  fs.writeFileSync(path.join(expressDir, 'package.json'), JSON.stringify({
    name: 'order-processing-api',
    version: '3.1.0',
    description: 'Order routing and order status REST API with Express',
    type: 'module',
    main: 'src/server.mjs',
    dependencies: { express: '^4.19.0' },
    license: 'Apache-2.0'
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(expressDir, 'README.md'), `# Order Processing API\nHandles enterprise order fulfillment.\n`, 'utf-8');

  fs.writeFileSync(path.join(expressDir, 'src', 'server.mjs'), `
import express from 'express';
import http from 'http';

const app = express();
const server = http.createServer(app);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: Date.now() });
});

const handleTermination = (signal) => {
  console.log(\`[OrderAPI] Termination signal \${signal} intercepted. Draining active HTTP connections...\`);
  server.close((err) => {
    if (err) {
      console.error('Error closing server sockets:', err);
      process.exit(1);
    }
    console.log('[OrderAPI] Sockets drained cleanly. Exiting.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleTermination('SIGTERM'));
process.on('SIGINT', () => handleTermination('SIGINT'));

export { app, server };
`, 'utf-8');

  fs.writeFileSync(path.join(expressDir, 'tests', 'order.test.mjs'), `
import assert from 'assert';
console.log('Testing order API...');
assert.strictEqual(true, true);
`, 'utf-8');

  // =========================================================================
  // FIXTURE 3: repo-mirror-copy
  // Verbatim copy / fork of repo-fastify-clean to test anti-duplication defense
  // =========================================================================
  const mirrorDir = path.join(FIXTURES_ROOT, 'repo-mirror-copy');
  fs.mkdirSync(path.join(mirrorDir, 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(mirrorDir, 'tests'), { recursive: true });

  // Exactly identical content in src/index.mjs
  fs.writeFileSync(path.join(mirrorDir, 'package.json'), JSON.stringify({
    name: 'payment-gateway-mirror',
    version: '1.2.0',
    description: 'High reliability financial transaction microservice with Fastify (Fork)',
    type: 'module',
    main: 'src/index.mjs',
    dependencies: { fastify: '^4.26.0' },
    license: 'MIT'
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(mirrorDir, 'src', 'index.mjs'), fs.readFileSync(path.join(fastifyDir, 'src', 'index.mjs'), 'utf-8'), 'utf-8');
  fs.writeFileSync(path.join(mirrorDir, 'src', 'routes', 'health.mjs'), fs.readFileSync(path.join(fastifyDir, 'src', 'routes', 'health.mjs'), 'utf-8'), 'utf-8');

  // =========================================================================
  // FIXTURE 4: repo-contradictory
  // Anti-pattern repository with direct conflicting behavior (SIGTERM immediate exit)
  // =========================================================================
  const contraDir = path.join(FIXTURES_ROOT, 'repo-contradictory');
  fs.mkdirSync(path.join(contraDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(contraDir, 'package.json'), JSON.stringify({
    name: 'legacy-crash-service',
    version: '0.0.1',
    description: 'Legacy service with anti-pattern immediate abort',
    type: 'module',
    main: 'src/index.mjs',
    license: 'UNLICENSED'
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(contraDir, 'src', 'index.mjs'), `
import http from 'http';
const server = http.createServer();

// ANTI-PATTERN: Exit immediately on SIGTERM without closing or draining connections
process.on('SIGTERM', () => {
  console.log('Force killing process immediately!');
  process.exit(0);
});
process.on('SIGINT', () => {
  process.exit(0);
});
`, 'utf-8');

  // =========================================================================
  // FIXTURE 5: repo-lambda-context
  // Serverless AWS Lambda function context (valid alternative for stateless runtime)
  // =========================================================================
  const lambdaDir = path.join(FIXTURES_ROOT, 'repo-lambda-context');
  fs.mkdirSync(path.join(lambdaDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(lambdaDir, 'package.json'), JSON.stringify({
    name: 'image-resizer-lambda',
    version: '1.0.0',
    description: 'Serverless AWS Lambda image transformation function',
    type: 'module',
    main: 'src/handler.mjs',
    license: 'MIT'
  }, null, 2), 'utf-8');

  fs.writeFileSync(path.join(lambdaDir, 'src', 'handler.mjs'), `
export const handler = async (event, context) => {
  console.log('Serverless execution invocation started');
  // In serverless stateless runtime, execution freezes immediately after handler returns
  return { statusCode: 200, body: JSON.stringify({ message: 'Processed' }) };
};
`, 'utf-8');

  return { fastifyDir, expressDir, mirrorDir, contraDir, lambdaDir };
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 RUNNING TEST SUITE: URE-003 CROSS-REPOSITORY CORROBORATION ENGINE');
  console.log('======================================================================\n');

  const fixtures = setupFixturesAndSandbox();
  let assertionsPassed = 0;

  // Record initial production patterns hash to verify zero pollution
  const prodPatternsPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  const initialProdPatternsHash = fs.existsSync(prodPatternsPath)
    ? sha256(fs.readFileSync(prodPatternsPath, 'utf-8'))
    : null;

  // -------------------------------------------------------------------------
  // TEST 1: Semantic Equivalence Normalization & Concept Comparison
  // -------------------------------------------------------------------------
  console.log('Test 1: Semantic Equivalence Normalization & Concept Comparison...');
  {
    const patFastify = {
      title: 'Graceful Process Shutdown Signal Coordination',
      statement: 'Node.js server applications must register explicit SIGTERM and SIGINT listeners to close active HTTP connections and flush pending telemetry before process termination.',
      why: 'Prevents dropped in-flight client requests and socket hangs.',
      negative_constraint: 'process.exit(0) immediately upon receiving signal, abandoning active HTTP sockets without draining.',
      category: 'ENGINEERING_PATTERN',
      context_constraints: 'Node.js microservices and containerized daemons'
    };

    const patExpress = {
      title: 'Express Server Termination Signal Handling',
      statement: 'Ensure HTTP server listens to SIGTERM and drains all active client sockets with server.close() prior to process termination.',
      why: 'Avoid terminating connections while requests are being served.',
      negative_constraint: 'Do not exit process without calling server.close() to finish pending HTTP requests.',
      category: 'ENGINEERING_PATTERN',
      context_constraints: 'Express REST backend services'
    };

    const normFastify = normalizePatternForComparison(patFastify);
    const normExpress = normalizePatternForComparison(patExpress);

    assert(normFastify.concept_tags.includes('graceful_process_shutdown'), 'Fastify pattern must extract graceful_process_shutdown concept');
    assert(normExpress.concept_tags.includes('graceful_process_shutdown'), 'Express pattern must extract graceful_process_shutdown concept');
    assertionsPassed += 2;

    const sim = computePatternSemanticSimilarity(patFastify, patExpress);
    assert.strictEqual(sim.isEquivalent, true, 'Syntactically different shutdown implementations must be semantically equivalent');
    assert(sim.score >= 0.60, `Semantic similarity score must be >= 0.60 (got ${sim.score})`);
    assert(sim.sharedConcepts.includes('graceful_process_shutdown'), 'Shared concepts must contain graceful_process_shutdown');
    assertionsPassed += 3;

    // Distinct pattern check
    const patValidation = {
      title: 'Input Boundary Validation',
      statement: 'Validate all untrusted input at network boundaries using schema sanitization.',
      why: 'Prevent malformed payloads.',
      category: 'ENGINEERING_PATTERN'
    };
    const diffSim = computePatternSemanticSimilarity(patFastify, patValidation);
    assert.strictEqual(diffSim.isEquivalent, false, 'Unrelated patterns must NOT be equivalent');
    assertionsPassed += 1;

    console.log(`  ✓ Test 1 Passed: Similarity score ${sim.score}, isEquivalent=${sim.isEquivalent} (diffSim=${diffSim.score})`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Independent Corroboration Across Distinct Repositories
  // -------------------------------------------------------------------------
  console.log('\nTest 2: Independent Multi-Repository Corroboration (Fastify + Express)...');
  {
    const pkgFastify = analyzeRepository(fixtures.fastifyDir);
    const pkgExpress = analyzeRepository(fixtures.expressDir);

    assert(pkgFastify.reusable_construction_patterns.length >= 1, 'Fastify repo must yield at least 1 pattern');
    assert(pkgExpress.reusable_construction_patterns.length >= 1, 'Express repo must yield at least 1 pattern');
    assertionsPassed += 2;

    const corroboration = corroborateMultiRepositoryPatterns([pkgFastify, pkgExpress]);

    assert(corroboration.total_clusters >= 1, 'Must cluster patterns across repos');
    assert(corroboration.counts.corroborated >= 1, 'Must have at least 1 corroborated pattern across Fastify + Express');
    assert.strictEqual(corroboration.counts.conflicted, 0, 'Zero conflicts expected between compatible implementations');

    const shutdownRule = corroboration.corroborated_patterns[0];
    assert.strictEqual(shutdownRule.corroboration_status, CORROBORATION_STATUS.CORROBORATED, 'Status must be CORROBORATED');
    assert(shutdownRule.effective_sources_count >= 2, `Effective sources must be >= 2 (got ${shutdownRule.effective_sources_count})`);
    assert.strictEqual(shutdownRule.independence_tier, INDEPENDENCE_TIERS.INDEPENDENT, 'Independence tier must be INDEPENDENT');
    assert.strictEqual(shutdownRule.contributing_repositories.length, 2, 'Must have 2 contributing repositories');
    assertionsPassed += 7;

    console.log(`  ✓ Test 2 Passed: Corroborated across ${shutdownRule.contributing_repositories.join(' + ')} with ${shutdownRule.effective_sources_count} effective independent sources.`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Anti-Duplication & Mirror Defense (Non-Inflation Invariant)
  // -------------------------------------------------------------------------
  console.log('\nTest 3: Anti-Duplication & Mirror Defense (Fastify + Mirror Copy)...');
  {
    const pkgFastify = analyzeRepository(fixtures.fastifyDir);
    const pkgMirror = analyzeRepository(fixtures.mirrorDir);

    // Both repos contain identical code excerpt for shutdown
    const corroboration = corroborateMultiRepositoryPatterns([pkgFastify, pkgMirror]);

    assert.strictEqual(corroboration.counts.corroborated, 0, 'Mirrored copy must NOT achieve CORROBORATED status');
    assert(
      corroboration.counts.copied_or_mirrored >= 1 || corroboration.counts.single_source >= 1,
      'Duplicate content must be collapsed as COPIED_OR_MIRRORED or SINGLE_SOURCE'
    );

    const targetPattern = corroboration.copied_patterns[0] || corroboration.single_source_patterns[0];
    assert.strictEqual(targetPattern.effective_sources_count, 1, 'Effective sources must collapse to 1 for identical code excerpts');
    assertionsPassed += 3;

    console.log(`  ✓ Test 3 Passed: Duplicated/Mirrored repositories successfully collapsed to effective_sources=${targetPattern.effective_sources_count}. Non-inflation invariant verified!`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Contradiction & Anti-Pattern Interception
  // -------------------------------------------------------------------------
  console.log('\nTest 4: Contradiction & Anti-Pattern Interception (Fastify + Contradictory)...');
  {
    const pkgFastify = analyzeRepository(fixtures.fastifyDir);

    // Create candidate package for contradictory repo
    const pkgContradictory = {
      repository_manifest: {
        name: 'repo-contradictory',
        path: fixtures.contraDir,
        license: 'UNLICENSED'
      },
      reusable_construction_patterns: [{
        candidate_id: 'CAND-ANTI-SHUTDOWN',
        title: 'Graceful Process Shutdown Signal Coordination',
        statement: 'Never wait or drain connections on SIGTERM, terminate process immediately with process.exit(0).',
        why: 'Immediate abort without draining active client requests.',
        negative_constraint: 'Always drain active client sockets before process termination.',
        category: 'ENGINEERING_PATTERN',
        context_constraints: 'Node.js microservices',
        evidence_list: [
          createEvidenceRecord({
            claim_id: 'CLAIM-ANTI-SHUTDOWN',
            source_id: 'SRC-CONTRADICTORY',
            source_uri: 'src/index.mjs',
            supporting_excerpt: "process.on('SIGTERM', () => { process.exit(0); });",
            evidence_type: EVIDENCE_TYPES.CODE_IMPLEMENTATION,
            verification_method: VERIFICATION_METHODS.STATIC_ANALYSIS,
            verification_status: EVIDENCE_STATUS.VERIFIED
          })
        ]
      }]
    };

    const corroboration = corroborateMultiRepositoryPatterns([pkgFastify, pkgContradictory]);

    assert.strictEqual(corroboration.counts.conflicted, 1, 'Contradictory patterns must be identified as CONFLICTED');
    assert.strictEqual(corroboration.counts.corroborated, 0, 'Conflicted patterns must NEVER be corroborated');

    const conflictedRule = corroboration.conflicted_patterns[0];
    assert.strictEqual(conflictedRule.corroboration_status, CORROBORATION_STATUS.CONFLICTING, 'Status must be CONFLICTING');
    assert(conflictedRule.decision_reason.includes('Direct semantic contradiction detected'), 'Reason must explain conflict');
    assertionsPassed += 4;

    console.log(`  ✓ Test 4 Passed: Direct opposition successfully intercepted and quarantined: "${conflictedRule.decision_reason}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Context Boundary Preservation (Serverless vs Containerized Daemon)
  // -------------------------------------------------------------------------
  console.log('\nTest 5: Context Boundary Preservation (Container Server vs Lambda)...');
  {
    const pkgFastify = analyzeRepository(fixtures.fastifyDir);

    const pkgLambda = {
      repository_manifest: {
        name: 'repo-lambda-context',
        path: fixtures.lambdaDir,
        license: 'MIT'
      },
      reusable_construction_patterns: [{
        candidate_id: 'CAND-LAMBDA-SHUTDOWN',
        title: 'Serverless Execution Freeze Lifecycle Invariant',
        statement: 'In AWS Lambda serverless function context, do not register long-running SIGTERM listener loops, allow invocation freeze/thaw lifecycle to handle execution termination.',
        why: 'Serverless environments manage microVM freeze states automatically.',
        category: 'ENGINEERING_PATTERN',
        context_constraints: 'AWS Lambda serverless runtime context only',
        evidence_list: [
          createEvidenceRecord({
            claim_id: 'CLAIM-LAMBDA-SHUTDOWN',
            source_id: 'SRC-LAMBDA',
            source_uri: 'src/handler.mjs',
            supporting_excerpt: 'export const handler = async (event, context) => { return { statusCode: 200 }; };',
            evidence_type: EVIDENCE_TYPES.CODE_IMPLEMENTATION,
            verification_method: VERIFICATION_METHODS.STATIC_ANALYSIS,
            verification_status: EVIDENCE_STATUS.VERIFIED
          })
        ]
      }]
    };

    const corroboration = corroborateMultiRepositoryPatterns([pkgFastify, pkgLambda]);
    assert.strictEqual(corroboration.counts.conflicted, 0, 'Context divergence must NOT be treated as a false direct conflict');
    assertionsPassed += 1;

    console.log('  ✓ Test 5 Passed: Context boundary preserved without false conflict error.');
  }

  // -------------------------------------------------------------------------
  // TEST 6: HIQV Quality Gate & Sandbox Canonical Promotion
  // -------------------------------------------------------------------------
  console.log('\nTest 6: End-to-End Pipeline with HIQV Validation & Canonical Promotion...');
  {
    const pipelineReport = await executeCrossRepositoryLearningPipeline(
      [fixtures.fastifyDir, fixtures.expressDir],
      {
        brainRoot: SANDBOX_ROOT,
        allowCanonicalPromotion: true
      }
    );

    assert.strictEqual(pipelineReport.success, true, 'Pipeline must succeed');
    assert(pipelineReport.validated_corroborated_rules.length >= 1, 'Must have at least 1 validated corroborated rule');

    const rule = pipelineReport.validated_corroborated_rules[0];
    assert.strictEqual(rule.quality_validation.decision, VALIDATOR_DECISIONS.PASS, 'Corroborated rule must achieve HIQV PASS');
    assert(rule.quality_validation.confidence_score >= 0.70, `Confidence score must be >= 0.70 (got ${rule.quality_validation.confidence_score})`);

    // Verify HMAC Authenticity Token
    const authCheck = verifyReportIntegrity(rule, rule.evidenceList, rule.quality_validation);
    assert.strictEqual(authCheck.valid, true, 'HIQV validation report HMAC auth token must be authentic');

    // Verify promotion into sandbox patterns file
    const sandboxPatternsPath = path.join(SANDBOX_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
    const sandboxPatternsContent = fs.readFileSync(sandboxPatternsPath, 'utf-8');
    assert(
      sandboxPatternsContent.includes('Graceful Process Shutdown Signal Coordination') ||
      sandboxPatternsContent.includes('SIGTERM'),
      'Sandbox engineering-patterns.md must contain the promoted corroborated rule'
    );

    assertionsPassed += 6;
    console.log(`  ✓ Test 6 Passed: HIQV decision=${rule.quality_validation.decision}, auth_token authentic, rule promoted to sandbox engineering-patterns.md.`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Search Index Rebuild & Live BM25 Retrieval
  // -------------------------------------------------------------------------
  console.log('\nTest 7: Search Index Rebuild & Live BM25 Retrieval...');
  {
    const searchRes = await searchBrain('Graceful Process Shutdown', {
      brainRoot: SANDBOX_ROOT,
      limit: 5
    });

    assert(searchRes.results && searchRes.results.length > 0, 'Live BM25 retrieval must return matching documents');
    const matched = searchRes.results.some(r =>
      (r.title && r.title.toLowerCase().includes('shutdown')) ||
      (r.content && r.content.toLowerCase().includes('sigterm'))
    );
    assert.strictEqual(matched, true, 'Retrieved documents must match the promoted graceful shutdown pattern');
    assertionsPassed += 2;

    console.log(`  ✓ Test 7 Passed: Successfully retrieved promoted rule via BM25 search (${searchRes.results.length} matches).`);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Zero Production Pollution Invariant
  // -------------------------------------------------------------------------
  console.log('\nTest 8: Production Brain Protection Invariant...');
  {
    if (initialProdPatternsHash && fs.existsSync(prodPatternsPath)) {
      const currentProdPatternsHash = sha256(fs.readFileSync(prodPatternsPath, 'utf-8'));
      assert.strictEqual(
        currentProdPatternsHash,
        initialProdPatternsHash,
        'CRITICAL: Production 05_KNOWLEDGE/engineering-patterns.md must NEVER be modified during sandbox execution!'
      );
      assertionsPassed += 1;
    }
    console.log('  ✓ Test 8 Passed: Production 05_KNOWLEDGE/ untouched and 100% byte-for-byte identical.');
  }

  console.log('\n======================================================================');
  console.log(`🏆 ALL ${assertionsPassed} ASSERTIONS PASSED SUCCESSFULLY!`);
  console.log('======================================================================\n');

  return { assertionsPassed, success: true };
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:\n', err);
  process.exit(1);
});
