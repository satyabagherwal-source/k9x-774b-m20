/**
 * Automated Verification Suite for Hybrid Knowledge Retrieval Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-retrieval-engine.mjs
 * Purpose: Verifies Milestone 1: indexing, BM25 ranking, exact rule targeting, 
 *          token-budget enforcement, and sub-15ms query latency.
 */

import { buildSearchIndex, searchBrain, retrieveKnowledge } from './retrieval-engine.mjs';

console.log('======================================================================');
console.log('🧪 TEST SUITE: HYBRID KNOWLEDGE RETRIEVAL ENGINE (MILESTONE 1)');
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
// TEST 1: Index Building & Corpus Coverage
// ---------------------------------------------------------------------------
console.log('[TEST 1] Building and Verifying Inverted Index...');
const startTime = Date.now();
const index = buildSearchIndex(true); // force rebuild
const buildDuration = Date.now() - startTime;

assert(index.totalDocuments > 250, 'Corpus size is healthy', `Total indexed: ${index.totalDocuments} documents`);
assert(index.avgdl > 50, 'Average document length calculated', `avgdl: ${index.avgdl.toFixed(1)} tokens`);
assert(Object.keys(index.invertedIndex).length > 2000, 'Vocabulary size is rich', `Unique terms: ${Object.keys(index.invertedIndex).length}`);
assert(buildDuration < 2000, 'Initial index build is fast', `${buildDuration}ms`);

// ---------------------------------------------------------------------------
// TEST 2: Exact Rule Number Lookup
// ---------------------------------------------------------------------------
console.log('\n[TEST 2] Testing Exact Rule Number Intent...');
const rule15Search = searchBrain('Rule 15');
assert(rule15Search.results.length > 0, 'Rule 15 search returns results');
assert(rule15Search.results[0].id === 'Rule 15' || rule15Search.results[0].id === 'Core Rule 15', 
  'Top result is Rule 15', `Got: ${rule15Search.results[0].id} - ${rule15Search.results[0].title}`);

const rule24Search = searchBrain('Rule 24 multilingual');
assert(rule24Search.results.length > 0, 'Rule 24 search returns results');
assert(rule24Search.results[0].id === 'Rule 24' || rule24Search.results[0].id === 'Core Rule 24', 
  'Top result is Rule 24', `Got: ${rule24Search.results[0].id} - ${rule24Search.results[0].title}`);

// ---------------------------------------------------------------------------
// TEST 3: Semantic & Keyword Concept Relevance
// ---------------------------------------------------------------------------
console.log('\n[TEST 3] Testing Keyword & Concept Retrieval Relevance...');

// Query A: Windows line ending regex
const crlfQuery = searchBrain('CRLF regex Windows line endings');
assert(crlfQuery.results.length > 0, 'CRLF query returned matches');
const hasLineEndingRule = crlfQuery.results.some(r => r.fullContent.toLowerCase().includes('crlf') || r.fullContent.toLowerCase().includes('line'));
assert(hasLineEndingRule, 'Returned rules mention CRLF or line ending mechanics');

// Query B: Tailwind v4 theme styling
const tailwindQuery = searchBrain('Tailwind CSS v4 theme CSS-first OKLCH');
assert(tailwindQuery.results.length > 0, 'Tailwind query returned matches');
const topTailwind = tailwindQuery.results[0];
assert(topTailwind.title.toLowerCase().includes('tailwind') || topTailwind.fullContent.toLowerCase().includes('tailwind'),
  'Top match is Tailwind skill or pattern', `Got: ${topTailwind.title}`);

// Query C: SEO Hreflang Canonical
const seoQuery = searchBrain('Hreflang canonical sitemap multilingual indexing');
assert(seoQuery.results.length > 0, 'SEO query returned matches');
const topSeo = seoQuery.results[0];
assert(topSeo.title.toLowerCase().includes('multilingual') || topSeo.title.toLowerCase().includes('seo') || topSeo.title.toLowerCase().includes('language') || topSeo.title.toLowerCase().includes('canonical'),
  'Top match is Multilingual/SEO/Canonical pattern', `Got: ${topSeo.title}`);

// ---------------------------------------------------------------------------
// TEST 4: Token Budgeting & Packing Hard Bounds
// ---------------------------------------------------------------------------
console.log('\n[TEST 4] Testing Strict Token Budget Packing...');

const budget400 = retrieveKnowledge('concurrency race conditions locks', { maxTokens: 400, topK: 5 });
assert(budget400.estimatedTokens <= 400, 'Estimated tokens within 400 budget', `Actual: ${budget400.estimatedTokens} tokens`);
assert(budget400.returnedCount >= 1, 'Packed at least 1 item in small budget', `Packed: ${budget400.returnedCount}`);
assert(budget400.promptBlock.includes('<!-- === AI-BUILDER-BRAIN RETRIEVED INTELLIGENCE'), 'Prompt block formatted with delimiters');

const budget1200 = retrieveKnowledge('high performance memory allocators buffer', { maxTokens: 1200, topK: 5 });
assert(budget1200.estimatedTokens <= 1200, 'Estimated tokens within 1200 budget', `Actual: ${budget1200.estimatedTokens} tokens`);
assert(budget1200.returnedCount >= 2, 'Packed multiple items in 1200 budget', `Packed: ${budget1200.returnedCount}`);

// ---------------------------------------------------------------------------
// TEST 5: Query Latency Benchmark (Sub-15ms Guarantee)
// ---------------------------------------------------------------------------
console.log('\n[TEST 5] Benchmarking Query Latency (In-Memory Warm Cache)...');

const benchmarkQueries = [
  'Astro hydration SSR React component',
  'PostgreSQL schema migration connection pool',
  'TOCTOU file system race condition',
  'Memory buffer overflow zero-copy buffer',
  'Google Search Console 451 redirect loop',
  'WireGuard mesh ephemeral session rekeying',
  'Dark mode light mode local storage theme toggle',
  'Rule 25 daily auto harvesting persistence'
];

let totalLatency = 0;
for (const q of benchmarkQueries) {
  const t0 = Date.now();
  searchBrain(q, { topK: 3 });
  const lat = Date.now() - t0;
  totalLatency += lat;
}

const avgLatency = totalLatency / benchmarkQueries.length;
assert(avgLatency < 15, 'Average search latency is sub-15ms', `Average: ${avgLatency.toFixed(2)}ms across ${benchmarkQueries.length} queries`);

// ---------------------------------------------------------------------------
// TEST 6: Zero Result & Malformed Query Resilience
// ---------------------------------------------------------------------------
console.log('\n[TEST 6] Testing Edge Cases & Resilience...');

const emptyQuery = searchBrain('');
assert(emptyQuery.results.length === 0, 'Empty query returns 0 results cleanly without crash');

const gibberishQuery = searchBrain('xyzzyqwerty12345notarealwordever');
assert(gibberishQuery.results.length === 0, 'Gibberish query returns 0 results cleanly');

const punctuationQuery = retrieveKnowledge('!@#$%^&*()_+');
assert(punctuationQuery.returnedCount === 0, 'Punctuation query handled gracefully');

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`🏁 RETRIEVAL ENGINE VERIFICATION: ${passedTests} PASSED | ${failedTests} FAILED`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
