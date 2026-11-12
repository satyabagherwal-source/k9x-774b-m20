/**
 * test-indexing-and-retrieval.mjs
 * 
 * Verifies inverted token indexing, BM25 ranked scoring, domain/destination faceting,
 * precision retrieval against stored champions, negative query rejection,
 * and live read-back verification of retrieved record identities and hashes.
 */

import fs from 'fs';
import path from 'path';
import { StageCPersistenceEngine } from '../src/persistence-engine.mjs';
import { StageCIndexingEngine } from '../src/indexing-engine.mjs';
import { StageCRetrievalEngine } from '../src/retrieval-engine.mjs';

const STORE_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-store';
const INDEX_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/test-index';
const RESULTS_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/results';

export function runIndexingAndRetrievalTests() {
  console.log('\n--- RUNNING INDEXING & RETRIEVAL TEST SUITE ---');

  const persistence = new StageCPersistenceEngine(STORE_DIR);
  const indexing = new StageCIndexingEngine(INDEX_DIR);
  const retrieval = new StageCRetrievalEngine(indexing, persistence);

  // Step 1: Rebuild index from all persisted records in store
  const storedRecords = persistence.listAllRecords();
  console.log(`[INDEX BUILD] Found ${storedRecords.length} records in test store. Indexing...`);
  const rebuildStats = indexing.rebuildIndex(storedRecords);
  console.log(`  Indexed docs: ${rebuildStats.records_indexed}, total unique terms: ${rebuildStats.total_terms}`);

  const testCases = [
    {
      test_id: "RETRIEVAL-1-CMTP-QUERY",
      description: "Ranked retrieval for transformer pooling attention mask clamp invariant",
      query: "transformer pooling attention mask zero division clamp",
      expected_top_candidate: "CD-ZNND-CMTP",
      expected_min_hits: 1,
      expected_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
      options: {}
    },
    {
      test_id: "RETRIEVAL-2-MHUP-QUERY",
      description: "Ranked retrieval for hypersphere L2 unit projection and cosine distance",
      query: "metric hypersphere unit projection l2 normalization dot product cosine distance",
      expected_top_candidate: "CD-ZNND-MHUP",
      expected_min_hits: 1,
      expected_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
      options: {}
    },
    {
      test_id: "RETRIEVAL-3-TOKENIZER-QUERY",
      description: "Ranked retrieval for tokenizer special token normalized false whitespace boundary",
      query: "tokenizer added tokens decoder special normalized false whitespace",
      expected_top_candidate: "CD-HE9Q-TOKENIZER",
      expected_min_hits: 1,
      expected_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
      options: {}
    },
    {
      test_id: "RETRIEVAL-4-NEGATIVE-UNRELATED-QUERY",
      description: "Zero hits expected for completely unrelated non-engineering query",
      query: "quantum culinary recipe sourdough baking hydration fermentation crust",
      expected_top_candidate: null,
      expected_min_hits: 0,
      expected_exact_hits: 0,
      options: {}
    },
    {
      test_id: "RETRIEVAL-5-DOMAIN-FILTERED-QUERY",
      description: "Retrieval filtered strictly by domain H",
      query: "pooling embeddings token",
      expected_top_candidate: "CD-ZNND-CMTP",
      expected_min_hits: 1,
      options: { domain: "H" }
    },
    {
      test_id: "RETRIEVAL-6-DOMAIN-FILTER-EXCLUSION",
      description: "Retrieval filtered by non-existent domain in store (Domain C)",
      query: "pooling embeddings token",
      expected_top_candidate: null,
      expected_exact_hits: 0,
      options: { domain: "C" }
    }
  ];

  const executionResults = [];

  for (const tc of testCases) {
    console.log(`\n[RUNNING ${tc.test_id}] Query: "${tc.query}"`);
    const searchResult = retrieval.search(tc.query, tc.options);

    let passed = true;
    const failures = [];

    if (tc.expected_exact_hits !== undefined) {
      if (searchResult.total_hits !== tc.expected_exact_hits) {
        passed = false;
        failures.push(`Expected exactly ${tc.expected_exact_hits} hits, but got ${searchResult.total_hits}`);
      }
    } else if (tc.expected_min_hits !== undefined) {
      if (searchResult.total_hits < tc.expected_min_hits) {
        passed = false;
        failures.push(`Expected at least ${tc.expected_min_hits} hits, but got ${searchResult.total_hits}`);
      }
    }

    if (tc.expected_top_candidate) {
      const topHit = searchResult.hits[0];
      if (!topHit) {
        passed = false;
        failures.push(`No hits returned, expected top candidate: ${tc.expected_top_candidate}`);
      } else {
        if (topHit.candidate_id !== tc.expected_top_candidate) {
          passed = false;
          failures.push(`Top candidate mismatch: expected ${tc.expected_top_candidate}, got ${topHit.candidate_id}`);
        }
        if (topHit.verification_status !== 'VERIFIED') {
          passed = false;
          failures.push(`Hit verification failed: ${topHit.verification_status}`);
        }
        if (tc.expected_evidence_status && topHit.implementation_evidence_status !== tc.expected_evidence_status) {
          passed = false;
          failures.push(`Evidence status mismatch: expected ${tc.expected_evidence_status}, got ${topHit.implementation_evidence_status}`);
        }
      }
    }

    console.log(`  Hits: ${searchResult.total_hits}, Top Hit: ${searchResult.hits[0]?.candidate_id || 'NONE'} (Score: ${searchResult.hits[0]?.score || 0})`);
    console.log(`  Verification: ${passed ? 'PASSED' : 'FAILED'}`);
    if (failures.length > 0) {
      console.log(`  Failures: ${failures.join('; ')}`);
    }

    executionResults.push({
      test_id: tc.test_id,
      description: tc.description,
      query: tc.query,
      options: tc.options,
      passed,
      failures,
      search_result: searchResult
    });
  }

  // Save Retrieval Results
  fs.writeFileSync(path.join(RESULTS_DIR, 'retrieval-test-results.json'), JSON.stringify(executionResults, null, 2), 'utf8');

  const allPassed = executionResults.every(r => r.passed);
  console.log(`\nINDEXING & RETRIEVAL SUITE COMPLETE: ${allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
  return { allPassed, executionResults, indexing, retrieval, persistence };
}

if (process.argv[1]?.endsWith('test-indexing-and-retrieval.mjs')) {
  runIndexingAndRetrievalTests();
}

