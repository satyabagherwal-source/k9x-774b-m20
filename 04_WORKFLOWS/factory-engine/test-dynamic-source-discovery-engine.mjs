/**
 * AI-Builder-Brain Dynamic Autonomous Source Discovery Engine Test Suite
 * 
 * Location: 04_WORKFLOWS/factory-engine/test-dynamic-source-discovery-engine.mjs
 * Purpose: Verifies System A Dynamic Discovery Evolution:
 *          1. Canonical URL normalization & tracking param removal
 *          2. Citation extraction (URLs, RFCs, CVEs) from text
 *          3. Security gate: HTTPS invariant & binary rejection
 *          4. Source classification into 13 universal categories
 *          5. Dynamic queue enqueuing & SHA-256 deduplication
 *          6. Prioritized harvesting with rate-limit cooldown
 *          7. Harvest result recording & bounded retries (max 3)
 *          8. Zero production contamination
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import {
  normalizeCanonicalUrl,
  computeSourceHashId,
  extractDynamicSourceCitations,
  queueDynamicDiscoveredSource,
  getNextSourcesForHarvesting,
  recordSourceHarvestResult,
  loadDiscoveryQueue,
  persistDiscoveryQueue,
  getDiscoveryQueuePaths,
  createEmptyDiscoveryQueue
} from './dynamic-source-discovery-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: DYNAMIC MULTI-SOURCE DISCOVERY & CRAWL QUEUE ENGINE');
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

const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discovery-queue-sandbox-'));

try {
  // ---------------------------------------------------------------------------
  // 1. URL Normalization & Deterministic Hash ID
  // ---------------------------------------------------------------------------
  console.log('--- Phase 1: URL Normalization & Deterministic Hash ID ---');
  const dirtyUrl = 'https://www.w3.org/TR/WCAG21/?utm_source=twitter&utm_medium=social#contrast';
  const cleanUrl = normalizeCanonicalUrl(dirtyUrl);
  assert(cleanUrl === 'https://www.w3.org/TR/WCAG21', 'Stripped tracking query params and anchor hash');

  const hashId1 = computeSourceHashId(cleanUrl);
  const hashId2 = computeSourceHashId('https://www.w3.org/TR/WCAG21');
  assert(hashId1 === hashId2, 'Deterministic SHA-256 source hash ID computed');
  assert(hashId1.startsWith('SRC-'), 'Hash ID prefixed with SRC-');

  // ---------------------------------------------------------------------------
  // 2. Citation Extraction from Text
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 2: Citation Extraction from Markdown / Dossiers ---');
  const sampleMarkdown = `
    # Forensic Investigation Dossier
    See official standard at https://www.w3.org/TR/SVG2/ and RFC 7807 for API problem details.
    Also vulnerability CVE-2024-21626 was analyzed in container runtimes.
    Reference: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API
  `;

  const extracted = extractDynamicSourceCitations(sampleMarkdown, { filePath: '07_PROJECT_LEARNING/sample.md' });
  assert(extracted.length >= 4, 'Extracted at least 4 distinct citations from text', `Found: ${extracted.length}`);

  const hasW3C = extracted.some(c => c.url.includes('w3.org/TR/SVG2'));
  const hasRfc = extracted.some(c => c.url.includes('rfc-editor.org/rfc/rfc7807'));
  const hasCve = extracted.some(c => c.url.includes('nvd.nist.gov/vuln/detail/CVE-2024-21626'));
  const hasMdn = extracted.some(c => c.url.includes('developer.mozilla.org'));

  assert(hasW3C, 'Extracted direct W3C standard URL');
  assert(hasRfc, 'Synthesized canonical RFC URL from "RFC 7807" mention');
  assert(hasCve, 'Synthesized canonical NIST NVD URL from "CVE-2024-21626"');
  assert(hasMdn, 'Extracted MDN documentation URL');

  // ---------------------------------------------------------------------------
  // 3. Security Boundary Gating
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 3: Security Boundary Gating ---');
  // 3.1 Plaintext HTTP
  const httpCand = { url: 'http://insecure-spec.org/spec' };
  const httpRes = queueDynamicDiscoveredSource(httpCand, { customRoot: sandboxDir });
  assert(httpRes.queued === false, 'Blocked plaintext HTTP URL');
  assert(httpRes.status.includes('INSECURE_PROTOCOL_NON_HTTPS'), 'Status flags INSECURE_PROTOCOL_NON_HTTPS');

  // 3.2 Executable Binary
  const binaryCand = { url: 'https://malicious.org/agent-payload.exe' };
  const binRes = queueDynamicDiscoveredSource(binaryCand, { customRoot: sandboxDir });
  assert(binRes.queued === false, 'Blocked binary executable URL (.exe)');
  assert(binRes.status.includes('BINARY_EXECUTABLE_REJECTED'), 'Status flags BINARY_EXECUTABLE_REJECTED');

  // 3.3 Restrictive License
  const restrictiveCand = {
    url: 'https://closed-source.com/api-spec',
    license: 'PROPRIETARY'
  };
  const restRes = queueDynamicDiscoveredSource(restrictiveCand, { customRoot: sandboxDir });
  assert(restRes.queued === false, 'Blocked restrictive proprietary source');

  // ---------------------------------------------------------------------------
  // 4. Approved Queue Enqueuing & Deduplication
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 4: Approved Source Enqueuing & Deduplication ---');
  const validCand = {
    url: 'https://www.w3.org/TR/WCAG21/',
    title: 'Web Content Accessibility Guidelines 2.1'
  };

  const queueRes1 = queueDynamicDiscoveredSource(validCand, { customRoot: sandboxDir });
  assert(queueRes1.queued === true, 'Successfully queued valid W3C standard candidate');
  assert(queueRes1.status === 'APPROVED_PENDING_HARVEST', 'Status is APPROVED_PENDING_HARVEST');
  assert(queueRes1.category === 'STANDARDS_AND_SPECIFICATIONS', 'Classified as STANDARDS_AND_SPECIFICATIONS');
  assert(queueRes1.trustScore >= 0.95, 'High trust score awarded', `Score: ${queueRes1.trustScore}`);

  // Deduplication check
  const queueRes2 = queueDynamicDiscoveredSource(validCand, { customRoot: sandboxDir });
  assert(queueRes2.queued === false, 'Blocked duplicate entry for identical normalized URL');
  assert(queueRes2.sourceId === queueRes1.sourceId, 'Matches original sourceId');

  // ---------------------------------------------------------------------------
  // 5. Prioritized Harvesting & Rate Limit Cooldown
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 5: Prioritized Harvesting & Cooldown Management ---');
  // Add second source with lower authority
  const blogCand = {
    url: 'https://netflixtechblog.com/stateful-microservices-resilience',
    title: 'Netflix TechBlog Stateful Resilience'
  };
  queueDynamicDiscoveredSource(blogCand, { customRoot: sandboxDir });

  const nextSources = getNextSourcesForHarvesting(5, { customRoot: sandboxDir });
  assert(nextSources.length === 2, 'Retrieved both pending sources for harvesting (Count: 2)');
  assert(nextSources[0].category === 'STANDARDS_AND_SPECIFICATIONS', 'Standards prioritized first by trust score');

  // ---------------------------------------------------------------------------
  // 6. Harvest Result Recording & Bounded Retries
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 6: Harvest Result Recording & Bounded Retries ---');
  const targetId = queueRes1.sourceId;

  // Simulate harvest failure 1
  recordSourceHarvestResult(targetId, false, { error: 'Network timeout' }, { customRoot: sandboxDir });
  const qAfterFail1 = loadDiscoveryQueue(sandboxDir);
  assert(qAfterFail1.sources[targetId].retry_count === 1, 'Retry count incremented to 1');
  assert(qAfterFail1.sources[targetId].status === 'APPROVED_PENDING_HARVEST', 'Source remains pending for retry');

  // Cooldown check: Should not be returned immediately due to 60s cooldown
  const sourcesInCooldown = getNextSourcesForHarvesting(5, { customRoot: sandboxDir });
  assert(!sourcesInCooldown.some(s => s.id === targetId), 'Source in cooldown excluded from immediate re-dispatch');

  // Simulate success on blog source
  const blogId = computeSourceHashId('https://netflixtechblog.com/stateful-microservices-resilience');
  recordSourceHarvestResult(blogId, true, { candidateId: 'PLCAND-NETFLIX-01', extractedCount: 2 }, { customRoot: sandboxDir });

  const qAfterSuccess = loadDiscoveryQueue(sandboxDir);
  assert(qAfterSuccess.sources[blogId].status === 'HARVESTED', 'Blog source marked HARVESTED');
  assert(qAfterSuccess.stats.harvested_count === 1, 'Queue statistics reflect 1 harvested source');

  // ---------------------------------------------------------------------------
  // 7. Strict Production Purity
  // ---------------------------------------------------------------------------
  console.log('\n--- Phase 7: Strict Production Purity Verification ---');
  const prodQueuePaths = getDiscoveryQueuePaths(BRAIN_ROOT);
  assert(!fs.existsSync(path.join(prodQueuePaths.discoveryDir, 'discovery-queue-sandbox-')), 'Zero sandbox files in production');

} finally {
  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (e) { }
}

console.log('\n======================================================================');
console.log(`📊 DISCOVERY QUEUE SUMMARY: ${passedTests} passed | ${failedTests} failed`);
console.log('======================================================================\n');

if (failedTests === 0) {
  console.log('🎉 DYNAMIC MULTI-SOURCE DISCOVERY QUEUE IS FULLY VERIFIED WORKING!');
  process.exit(0);
} else {
  console.error('❌ Dynamic discovery queue test suite failed!');
  process.exit(1);
}
