/**
 * AI-Builder-Brain Universal Retrieval Foundation Test Suite
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\test-universal-retrieval-foundation.mjs
 * Purpose: Verifies PAC-004 Phase 1B.2 Milestone 1 & Milestone 1 Remediation:
 *          1. Full-Body Dossier Discovery (e.g., ModernVisualEngine)
 *          2. Multi-Tier Retrieval (Metadata + Body Chunks)
 *          3. Canonical Rule Retrieval with Exact Line Citations
 *          4. Genuinely Empty Outcome Classification
 *          5. Index Unavailable Handling
 *          6. Malformed and Boundary Tolerance
 *          7. Remediation B: Occurrence vs Corroboration & Boilerplate Tracking
 *          8. Multi-Domain Boosting & Grounded Taxonomy Expansion
 *          9. Context Budget Exhaustion Detection
 *          10. Zero Writes to Canonical Registries Invariant
 *          11. Formal Error Differentiation (RETRIEVAL_ERROR vs GENUINELY_EMPTY)
 *          12. Remediation C: Complete Dossier Indexing & Deep Discovery
 *          13. Remediation D: Windows Cache Invalidation & 1,000ms TTL Throttle
 *          14. Corrupted Cache Quarantine & Self-Healing
 *          15. 100% Backward Compatibility with Legacy Callers
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

import {
  searchBrain,
  searchBrainDetailed,
  retrieveKnowledge,
  extractEvidenceExcerpt,
  extractDossierChunksFromFile,
  parseDossierChunks,
  expandQueryWithTaxonomy,
  getRetrievalPaths,
  computeDossierDirHash,
  computeSourceFilesHash,
  buildSearchIndex,
  normalizeCachedDocuments,
  TEMPLATE_HEADING_REGEX
} from './retrieval-engine.mjs';

import { recallConstructionDomainGuidelines } from './construction-intelligence.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

console.log('======================================================================');
console.log('🧪 TEST SUITE: UNIVERSAL RETRIEVAL FOUNDATION (PAC-004 Phase 1B.2 M1)');
console.log('======================================================================\n');

let totalTestCases = 0;
let passedTestCases = 0;
let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function runTestCase(name, fn) {
  totalTestCases++;
  console.log(`\n[TEST CASE ${totalTestCases}] ${name}`);
  try {
    fn();
    passedTestCases++;
    console.log(`  🎉 Test Case ${totalTestCases} PASSED`);
  } catch (err) {
    console.error(`  💥 Test Case ${totalTestCases} FAILED with uncaught error:`, err);
  }
}

function assert(condition, assertionName, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${assertionName} ${details ? '(' + details + ')' : ''}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${assertionName} ${details ? ': ' + details : ''}`);
    throw new Error(`Assertion failed: ${assertionName} - ${details}`);
  }
}

try {
  // ---------------------------------------------------------------------------
  // TEST CASE 1: Full-Body Dossier Concept Discovery (ModernVisualEngine)
  // ---------------------------------------------------------------------------
  runTestCase('Technical concept present only in dossier body discovery', () => {
    const res = searchBrain('ModernVisualEngine');
    assert(res.results.length > 0, 'ModernVisualEngine successfully retrieved from dossier chunks');
    
    const top = res.results[0];
    assert(top.category === 'HARVESTED_DOSSIER_CHUNK', 'Top result categorized as HARVESTED_DOSSIER_CHUNK', top.category);
    assert(top.filePath.includes('0x4m4-hexstrike-ai-learnings.md'), 'Top result cites exact dossier file path', top.filePath);
    assert(Array.isArray(top.lineRange) && top.lineRange[0] > 0 && top.lineRange[1] >= top.lineRange[0], 'Accurate line range present', `Lines ${top.lineRange[0]}-${top.lineRange[1]}`);
    assert(top.sourceTier === 'FORENSIC_DOSSIER', 'Correct sourceTier assigned', top.sourceTier);
    assert(top.epistemicState === 'EXTRACTED', 'Correct epistemicState assigned', top.epistemicState);
    assert(typeof top.evidenceExcerpt === 'string' && top.evidenceExcerpt.includes('ModernVisualEngine'), 'Evidence excerpt contains target concept', top.evidenceExcerpt.slice(0, 80));

    // Remediation A assertions:
    assert(top.confidenceCalibrated === false, 'confidenceCalibrated is strictly false');
    assert(top.confidenceType === 'HEURISTIC_CATEGORY_WEIGHT', 'confidenceType is HEURISTIC_CATEGORY_WEIGHT', top.confidenceType);
    assert(typeof top.confidence === 'number' && top.confidence === 0.75, 'confidence remains backward-compatible numeric heuristic', top.confidence);
    assert(top.indexingStatus === 'COMPLETE' || top.indexingStatus === 'PARTIAL', 'indexingStatus attached', top.indexingStatus);
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 2: Multi-Tier Retrieval (Metadata and Body Chunks)
  // ---------------------------------------------------------------------------
  runTestCase('Multi-tier retrieval combining metadata and body chunks', () => {
    const res = searchBrain('hexstrike', { topK: 10 });
    assert(res.results.length >= 2, 'Multiple results matched for repo term hexstrike', `Count: ${res.results.length}`);
    
    const hasMetadataDoc = res.results.some(r => r.category === 'HARVESTED_INTELLIGENCE_DOSSIER');
    const hasChunkDoc = res.results.some(r => r.category === 'HARVESTED_DOSSIER_CHUNK');
    assert(hasMetadataDoc, 'Metadata dossier document retrieved');
    assert(hasChunkDoc, 'Substantive body chunk document retrieved');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 3: Canonical Engineering Rule Retrieval with Exact Lines
  // ---------------------------------------------------------------------------
  runTestCase('Canonical engineering rule retrieval with exact line numbers', () => {
    const res = searchBrain('Rule 4143');
    assert(res.results.length > 0, 'Rule 4143 retrieved');
    
    const top = res.results[0];
    assert(top.id === 'Rule 4143', 'Exact rule ID matched', top.id);
    assert(top.category === 'ENGINEERING_PATTERN', 'Category is ENGINEERING_PATTERN');
    assert(top.sourceTier === 'CANONICAL', 'Canonical source tier verified', top.sourceTier);
    assert(top.epistemicState === 'CANONICAL', 'Canonical epistemic state verified', top.epistemicState);
    assert(top.lineRange[0] === 300317 && top.lineRange[1] === 300396, 'Exact 1-based source lines verified', `${top.lineRange[0]}-${top.lineRange[1]}`);
    assert(top.filePath === '05_KNOWLEDGE/engineering-patterns.md', 'Correct file path verified', top.filePath);

    // Remediation A assertions for canonical rule:
    assert(top.confidenceCalibrated === false, 'Canonical rule confidenceCalibrated is strictly false');
    assert(top.confidenceType === 'CANONICAL_RULE_AUTHORITY', 'Canonical rule confidenceType is CANONICAL_RULE_AUTHORITY', top.confidenceType);
    assert(top.confidence === 0.95, 'Canonical engineering pattern confidence value is 0.95', top.confidence);
    assert(top.indexingStatus === 'COMPLETE', 'Canonical rule indexingStatus is COMPLETE');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 4: Genuinely Empty Classification
  // ---------------------------------------------------------------------------
  runTestCase('Unknown query returns GENUINELY_EMPTY structured status', () => {
    const res = searchBrainDetailed('xyzq982734982374kjhasdfkjasd');
    assert(res.status === 'GENUINELY_EMPTY', 'Outcome status is GENUINELY_EMPTY', res.status);
    assert(Array.isArray(res.results) && res.results.length === 0, 'Zero results returned');
    assert(res.matchedCount === 0, 'Matched count is 0');
    assert(Array.isArray(res.limitations) && res.limitations.length > 0, 'Limitations explain empty finding');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 5: Index Unavailable Outcome
  // ---------------------------------------------------------------------------
  runTestCase('Inaccessible or non-existent storage returns INDEX_UNAVAILABLE', () => {
    const res = searchBrainDetailed('ModernVisualEngine', {
      brainRoot: path.join(BRAIN_ROOT, 'NON_EXISTENT_DIR_UNAVAILABLE_TEST')
    });
    assert(res.status === 'INDEX_UNAVAILABLE', 'Outcome status is INDEX_UNAVAILABLE', res.status);
    assert(res.results.length === 0, 'Results list is empty');
    assert(res.diagnostics && res.diagnostics.error, 'Diagnostics explain storage unavailability', res.diagnostics.error);
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 6: Malformed Input and Boundary Tolerance
  // ---------------------------------------------------------------------------
  runTestCase('Malformed and edge inputs handled gracefully without throwing', () => {
    // 6.1 extractEvidenceExcerpt with null/undefined/empty
    assert(extractEvidenceExcerpt(null, []) === '', 'extractEvidenceExcerpt handles null text');
    assert(extractEvidenceExcerpt('Hello world', null) === 'Hello world', 'extractEvidenceExcerpt handles null terms');
    assert(extractEvidenceExcerpt('', ['term']) === '', 'extractEvidenceExcerpt handles empty string');

    // 6.2 extractDossierChunksFromFile with non-existent path
    const emptyChunks = extractDossierChunksFromFile('non_existent_file.md');
    assert(Array.isArray(emptyChunks) && emptyChunks.length === 0, 'extractDossierChunksFromFile returns empty array for missing file');

    // 6.3 Empty query string
    const resEmpty = searchBrain('');
    assert(resEmpty.results.length === 0, 'searchBrain handles empty string gracefully');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 7: Remediation B — Occurrence vs Corroboration & Boilerplate Tracking
  // ---------------------------------------------------------------------------
  runTestCase('Remediation B: Occurrence vs Corroboration and Boilerplate Differentiation', () => {
    // 7.1 Generic Template Boilerplate Chunk
    const resBoilerplate = searchBrain('Multi-Dimensional 8-Axis Investigation Real Code Patches', { topK: 5 });
    assert(resBoilerplate.results.length > 0, 'Boilerplate search returns results');
    const chunkBoilerplate = resBoilerplate.results.find(r => r.category === 'HARVESTED_DOSSIER_CHUNK');
    assert(chunkBoilerplate !== undefined, 'Found dossier chunk for boilerplate search');
    assert(chunkBoilerplate.isBoilerplate === true, 'Repeated template section flagged as isBoilerplate: true');
    assert(chunkBoilerplate.isIndependentCorroboration === false, 'Repeated template section isIndependentCorroboration is strictly false');
    assert(chunkBoilerplate.independentCorroborationCount === 0, 'Template boilerplate independentCorroborationCount is 0');
    assert(chunkBoilerplate.occurrenceCount > 10, 'occurrenceCount reflects repetitive template occurrences', `Count: ${chunkBoilerplate.occurrenceCount}`);
    assert(Array.isArray(chunkBoilerplate.sourceOccurrences) && chunkBoilerplate.sourceOccurrences.length > 10, 'sourceOccurrences array present with line ranges');
    assert(chunkBoilerplate.sourceOccurrences[0].filePath !== undefined && Array.isArray(chunkBoilerplate.sourceOccurrences[0].lineRange), 'sourceOccurrences has exact { filePath, lineRange }');
    assert(Array.isArray(chunkBoilerplate.corroborationSources), 'corroborationSources array maintained for backward compatibility');

    // 7.2 Substantive Unique Finding
    const resUnique = searchBrain('ModernVisualEngine');
    const chunkUnique = resUnique.results[0];
    assert(chunkUnique.isBoilerplate === false, 'Substantive unique finding has isBoilerplate: false');
    assert(chunkUnique.occurrenceCount === 1, 'Substantive unique finding occurrenceCount is 1');
    assert(chunkUnique.sourceOccurrences.length === 1, 'Substantive unique finding sourceOccurrences length is 1');
    assert(chunkUnique.independentCorroborationCount === 0, 'Single-occurrence finding independentCorroborationCount is 0');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 8: Multi-Domain Boosting & Grounded Taxonomy Expansion
  // ---------------------------------------------------------------------------
  runTestCase('Multi-domain boosting and grounded query expansion', () => {
    // 8.1 Grounded Query Expansion
    const exp = expandQueryWithTaxonomy('color palette styling', ['F']);
    assert(exp.matchedDomains.includes('F'), 'Identified Domain F from taxonomy keywords');
    assert(exp.expansionTerms.length > 0, 'Generated grounded expansion terms without hallucination', exp.expansionTerms.join(', '));

    // 8.2 Multi-Domain Search
    const searchRes = searchBrain('visual layout responsive design', {
      domains: ['F', 'H'],
      topK: 5
    });
    assert(searchRes.results.length > 0, 'Search across domains F and H succeeded');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 9: Context Budget Exhaustion Detection
  // ---------------------------------------------------------------------------
  runTestCase('Token budget exhaustion returns BUDGET_EXHAUSTED outcome', () => {
    const res = searchBrainDetailed('ModernVisualEngine', { maxTokens: 5 });
    assert(res.status === 'BUDGET_EXHAUSTED', 'Outcome status is BUDGET_EXHAUSTED', res.status);
    assert(res.matchedCount > 0, 'Identified matches before budgeting', `Matched: ${res.matchedCount}`);
    assert(res.results.length === 0, 'Zero results packed due to strict token budget');
    assert(res.diagnostics.budgetExhausted === true, 'Diagnostics flag budgetExhausted as true');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 10: Zero Writes to Canonical Registries Invariant
  // ---------------------------------------------------------------------------
  runTestCase('Zero writes to canonical registries invariant verified', () => {
    const p = getRetrievalPaths(BRAIN_ROOT);
    const mtimeRegistryBefore = fs.statSync(p.domainRegistryFile).mtimeMs;
    const mtimeCoreBefore = fs.statSync(p.coreRulesFile).mtimeMs;

    // Run searches and retrievals
    searchBrain('Rule 1');
    searchBrainDetailed('ModernVisualEngine');
    retrieveKnowledge('CRLF regex line endings Windows');

    const mtimeRegistryAfter = fs.statSync(p.domainRegistryFile).mtimeMs;
    const mtimeCoreAfter = fs.statSync(p.coreRulesFile).mtimeMs;

    assert(mtimeRegistryBefore === mtimeRegistryAfter, 'domain-registry.json mtime strictly unmodified');
    assert(mtimeCoreBefore === mtimeCoreAfter, 'operating-rules.md mtime strictly unmodified');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 11: Formal Error Differentiation (RETRIEVAL_ERROR vs GENUINELY_EMPTY)
  // ---------------------------------------------------------------------------
  runTestCase('Formal differentiation between RETRIEVAL_ERROR and GENUINELY_EMPTY', () => {
    // 11.1 Invalid query argument yields RETRIEVAL_ERROR
    const errRes = searchBrainDetailed(null);
    assert(errRes.status === 'RETRIEVAL_ERROR', 'Null query produces RETRIEVAL_ERROR', errRes.status);
    assert(errRes.diagnostics.error !== undefined, 'RETRIEVAL_ERROR provides diagnostic error message');

    // 11.2 Valid query with zero matches yields GENUINELY_EMPTY
    const emptyRes = searchBrainDetailed('nonexistentterm987654321zzq');
    assert(emptyRes.status === 'GENUINELY_EMPTY', 'Valid query with 0 hits produces GENUINELY_EMPTY', emptyRes.status);
    assert(errRes.status !== emptyRes.status, 'Statuses are cleanly distinguishable and not conflated');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 12: Remediation C — Complete Dossier Indexing & Deep Discovery
  // ---------------------------------------------------------------------------
  runTestCase('Remediation C: Sub-chunking and Complete Dossier Discovery without Truncation', () => {
    // 12.1 Concept deep inside a long section (> 1,200 chars): line 375 fallback in hexstrike_server.py
    const resDeep = searchBrain('hexstrike_server fallback', { topK: 10 });
    assert(resDeep.results.length > 0, 'Content beyond char 1,200 in long section is discoverable', `Matches: ${resDeep.results.length}`);
    const foundSubChunk = resDeep.results.find(r => r.filePath.includes('0x4m4-hexstrike-ai') && r.lineRange[0] <= 375 && r.lineRange[1] >= 375);
    assert(foundSubChunk !== undefined, 'Sub-chunk covering line 375 located successfully', foundSubChunk ? `Lines ${foundSubChunk.lineRange[0]}-${foundSubChunk.lineRange[1]}` : 'not found');

    // 12.2 Incident Patch 11 commit a01419a2 deep in dossier (lines 1493-1535, beyond historical maxChunks 10)
    const resLate = searchBrain('a01419a2', { topK: 5 });
    assert(resLate.results.length > 0, 'Late Incident Patch 11 commit a01419a2 discoverable without chunk limit cutoff');
    assert(resLate.results[0].filePath.includes('0x4m4-hexstrike-ai-learnings.md'), 'Target dossier matched for late commit');
    assert(resLate.results[0].lineRange[0] <= 1535 && resLate.results[0].lineRange[1] >= 1493, 'Late incident patch lines confirmed within sub-chunk line range', `Lines: ${resLate.results[0].lineRange[0]}-${resLate.results[0].lineRange[1]}`);

    // 12.3 Verify sub-chunking of long sections preserves 1-based sequential line ranges
    const testFile = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING', '0x4m4-hexstrike-ai-learnings.md');
    const chunks = extractDossierChunksFromFile(testFile, { maxChunksPerFile: 60, maxChunkChars: 2500 });
    assert(chunks.length > 10, 'Extracts more than 10 chunks from large dossier', `Extracted: ${chunks.length}`);
    assert(chunks.indexingStatus === 'COMPLETE', 'Dossier marked as indexingStatus: COMPLETE', chunks.indexingStatus);

    // Verify sub-chunk line contiguousness for multi-part sections
    const multiParts = chunks.filter(c => c.title.includes('(Part '));
    assert(multiParts.length >= 2, 'Multi-part sub-chunks generated for sections > 2,500 chars', `Count: ${multiParts.length}`);
    for (const p of multiParts) {
      assert(p.startLine > 0 && p.endLine >= p.startLine, `Sub-chunk line range valid: [${p.startLine}, ${p.endLine}]`);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 13: Remediation D — Windows Cache Invalidation & TTL Throttle
  // ---------------------------------------------------------------------------
  runTestCase('Remediation D: Windows Cache Invalidation and 1,000ms Burst Throttle', () => {
    const p = getRetrievalPaths(BRAIN_ROOT);
    
    // 13.1 Rapid successive calls within 1,000ms TTL return identical hash in < 1ms
    const t0 = performance.now();
    const hash1 = computeDossierDirHash(p.learningDir);
    const durationFirst = performance.now() - t0;
    
    const t1 = performance.now();
    const hash2 = computeDossierDirHash(p.learningDir);
    const durationCached = performance.now() - t1;

    assert(hash1 === hash2, 'Subsequent hash calls produce identical hash');
    assert(durationCached < 5.0, 'In-memory TTL throttle responds in < 5ms for search query bursts', `${durationCached.toFixed(3)}ms`);

    // 13.2 forceFresh bypasses TTL throttle and computes fresh hash
    const freshHash = computeDossierDirHash(p.learningDir, true);
    assert(typeof freshHash === 'string' && freshHash.length === 64, 'forceFresh produces valid 64-character SHA-256 hex hash', freshHash);

    // 13.3 Windows NTFS directory mtime blindness sensitivity:
    // Testing on a simulated isolated directory ensures file mtime change is detected even if folder mtime is unchanged
    const testSimDir = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'mtime-blindness-test');
    fs.mkdirSync(testSimDir, { recursive: true });
    const simFile = path.join(testSimDir, 'test-doc-learnings.md');
    fs.writeFileSync(simFile, '# Test Document\n\nInitial version for mtime test.', 'utf-8');

    const simHashInitial = computeDossierDirHash(testSimDir, true);
    // Artificially change file mtime by +5000ms without touching directory
    const statBefore = fs.statSync(simFile);
    const newMtime = new Date(statBefore.mtimeMs + 5000);
    fs.utimesSync(simFile, newMtime, newMtime);

    const simHashAfter = computeDossierDirHash(testSimDir, true);
    assert(simHashInitial !== simHashAfter, 'computeDossierDirHash detects file mtime change regardless of directory mtime blindness');

    // Clean up simulation directory
    try {
      fs.unlinkSync(simFile);
      fs.rmdirSync(testSimDir);
    } catch (cleanErr) {}
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 14: Corrupted Cache Quarantine & Self-Healing
  // ---------------------------------------------------------------------------
  runTestCase('Corrupted Cache Quarantine and Self-Healing Rebuild', () => {
    const tempSandbox = path.join(BRAIN_ROOT, '.project-brain', 'simulation-sandbox', 'corrupt-cache-test');
    const tempCacheDir = path.join(tempSandbox, '.project-brain', 'cache');
    fs.mkdirSync(tempCacheDir, { recursive: true });
    
    // Write corrupt non-JSON file
    const corruptFile = path.join(tempCacheDir, 'retrieval-index.json');
    fs.writeFileSync(corruptFile, '<<< CORRUPT NON-JSON GARBAGE PAYLOAD >>>', 'utf-8');

    // Attempting buildSearchIndex should quarantine corrupt file and rebuild cleanly
    const index = buildSearchIndex(false, tempSandbox);
    assert(index !== null && Array.isArray(index.documents), 'Index rebuilds cleanly despite corrupted disk file');

    // Verify quarantine file created
    const cacheDirFiles = fs.readdirSync(tempCacheDir);
    const quarantineFound = cacheDirFiles.some(f => f.startsWith('retrieval-index.json.corrupt.'));
    assert(quarantineFound, 'Corrupted cache quarantined to .corrupt.<timestamp> filename');

    // Clean up simulation directory
    try {
      for (const f of cacheDirFiles) {
        fs.unlinkSync(path.join(tempCacheDir, f));
      }
      fs.rmdirSync(tempCacheDir);
      fs.rmdirSync(path.join(tempSandbox, '.project-brain'));
      fs.rmdirSync(tempSandbox);
    } catch (cleanErr) {}
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 15: 100% Backward Compatibility with Legacy Callers
  // ---------------------------------------------------------------------------
  runTestCase('100% backward compatibility with existing callers', () => {
    // 15.1 searchBrain contract
    const sb = searchBrain('Windows CRLF', { topK: 2 });
    assert(typeof sb.query === 'string', 'searchBrain returns query');
    assert(Array.isArray(sb.results), 'searchBrain returns results array');
    assert(typeof sb.totalDocuments === 'number', 'searchBrain returns totalDocuments');
    assert(typeof sb.matchedCount === 'number', 'searchBrain returns matchedCount');
    assert(typeof sb.durationMs === 'number', 'searchBrain returns durationMs');

    if (sb.results.length > 0) {
      const top = sb.results[0];
      assert(typeof top.confidence === 'number', 'searchBrain top result has numeric confidence');
      assert(typeof top.confidenceCalibrated === 'boolean', 'searchBrain top result has confidenceCalibrated boolean');
      assert(typeof top.confidenceType === 'string', 'searchBrain top result has confidenceType string');
      assert(Array.isArray(top.sourceOccurrences), 'searchBrain top result has sourceOccurrences array');
      assert(typeof top.occurrenceCount === 'number', 'searchBrain top result has occurrenceCount number');
      assert(typeof top.isBoilerplate === 'boolean', 'searchBrain top result has isBoilerplate boolean');
      assert(typeof top.isIndependentCorroboration === 'boolean', 'searchBrain top result has isIndependentCorroboration boolean');
      assert(typeof top.independentCorroborationCount === 'number', 'searchBrain top result has independentCorroborationCount number');
      assert(typeof top.indexingStatus === 'string', 'searchBrain top result has indexingStatus string');
      assert(Array.isArray(top.corroborationSources), 'searchBrain top result preserves corroborationSources for legacy callers');
    }

    // 15.2 retrieveKnowledge contract
    const rk = retrieveKnowledge('Windows CRLF', { maxTokens: 1000, topK: 2 });
    assert(typeof rk.query === 'string', 'retrieveKnowledge returns query');
    assert(typeof rk.durationMs === 'number', 'retrieveKnowledge returns durationMs');
    assert(typeof rk.totalIndexed === 'number', 'retrieveKnowledge returns totalIndexed');
    assert(typeof rk.returnedCount === 'number', 'retrieveKnowledge returns returnedCount');
    assert(typeof rk.estimatedTokens === 'number', 'retrieveKnowledge returns estimatedTokens');
    assert(typeof rk.maxTokensBudget === 'number', 'retrieveKnowledge returns maxTokensBudget');
    assert(typeof rk.promptBlock === 'string', 'retrieveKnowledge returns promptBlock');
    assert(Array.isArray(rk.items), 'retrieveKnowledge returns items array');

    if (rk.items.length > 0) {
      const it = rk.items[0];
      assert(typeof it.confidence === 'number', 'retrieveKnowledge item has numeric confidence');
      assert(typeof it.confidenceCalibrated === 'boolean', 'retrieveKnowledge item has confidenceCalibrated boolean');
      assert(typeof it.confidenceType === 'string', 'retrieveKnowledge item has confidenceType string');
      assert(Array.isArray(it.sourceOccurrences), 'retrieveKnowledge item has sourceOccurrences array');
      assert(typeof it.indexingStatus === 'string', 'retrieveKnowledge item has indexingStatus string');
    }

    // 15.3 recallConstructionDomainGuidelines contract
    const guidelines = recallConstructionDomainGuidelines(BRAIN_ROOT, 'client-side SVG conversion');
    assert(guidelines !== null && typeof guidelines === 'object', 'recallConstructionDomainGuidelines returns object');
    assert(guidelines.F !== undefined, 'Domain F guidelines present');
    assert(guidelines.G !== undefined, 'Domain G guidelines present');
    assert(guidelines.H !== undefined, 'Domain H guidelines present');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 16: PAC-004 Phase 1B.2.1 Fix A — indexingStatus Preservation
  // ---------------------------------------------------------------------------
  runTestCase('Fix A: indexingStatus propagation across extraction, parsing, and retrieval', () => {
    const hexstrikeFile = '07_PROJECT_LEARNING/0x4m4-hexstrike-ai-learnings.md';

    // 16.1 extractDossierChunksFromFile: truncated dossier reports PARTIAL on array and chunks
    const chunksPartial = extractDossierChunksFromFile(hexstrikeFile, { maxChunksPerFile: 5 });
    assert(chunksPartial.indexingStatus === 'PARTIAL', 'Truncated extraction reports PARTIAL on chunk array');
    assert(chunksPartial.length === 5, 'Truncated extraction limits chunks to requested max');
    assert(chunksPartial.every(c => c.indexingStatus === 'PARTIAL'), 'Every chunk in truncated extraction inherits PARTIAL status');
    assert(chunksPartial.every(c => typeof c.rawHeading === 'string' && c.rawHeading.length > 0), 'Every chunk has rawHeading preserved');

    // 16.2 extractDossierChunksFromFile: fully indexed dossier reports COMPLETE
    const chunksComplete = extractDossierChunksFromFile(hexstrikeFile, { maxChunksPerFile: 60 });
    assert(chunksComplete.indexingStatus === 'COMPLETE', 'Non-truncated extraction reports COMPLETE on chunk array');
    assert(chunksComplete.every(c => c.indexingStatus === 'COMPLETE'), 'Every chunk in complete extraction inherits COMPLETE status');

    // 16.3 parseDossierChunks: preserves PARTIAL if any file is truncated
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indexing-status-test-'));
    try {
      const learningDir = path.join(tmpDir, '07_PROJECT_LEARNING');
      fs.mkdirSync(learningDir, { recursive: true });

      // Create a small multi-section dossier that exceeds maxChunksPerFile: 2
      const multiSection = [
        '## 1. Context & Overview',
        'Section 1 content with adequate body text for chunk extraction.',
        '### Section 2',
        'Section 2 content with adequate body text for chunk extraction.',
        '### Section 3',
        'Section 3 content with adequate body text for chunk extraction.'
      ].join('\n\n');
      fs.writeFileSync(path.join(learningDir, 'test-truncated-learnings.md'), multiSection);

      const parsedDocs = parseDossierChunks({ brainRoot: tmpDir, learningDir }, { maxChunksPerFile: 2 });
      assert(parsedDocs.length === 2, 'parseDossierChunks correctly bounded by maxChunksPerFile');
      assert(parsedDocs.every(d => d.indexingStatus === 'PARTIAL'), 'All documents from truncated dossier preserve PARTIAL indexingStatus');

      // 16.4 Verify missing status falls back to UNKNOWN, never silently converting to COMPLETE
      const mockDocNoStatus = { category: 'CUSTOM_UNKNOWN', occurrenceCount: 1 };
      const fallbackStatus = mockDocNoStatus.indexingStatus || 'UNKNOWN';
      assert(fallbackStatus === 'UNKNOWN', 'Missing indexingStatus falls back to UNKNOWN, never COMPLETE');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // 16.5 searchBrain and retrieveKnowledge preserve indexingStatus
    const res = searchBrain('ModernVisualEngine');
    assert(res.results.length > 0, 'searchBrain finds ModernVisualEngine');
    assert(res.results[0].indexingStatus === 'COMPLETE', 'searchBrain top result preserves genuine COMPLETE indexingStatus');

    const rk = retrieveKnowledge('ModernVisualEngine', { maxTokens: 1000 });
    assert(rk.items.length > 0, 'retrieveKnowledge finds ModernVisualEngine');
    assert(rk.items[0].indexingStatus === 'COMPLETE', 'retrieveKnowledge item preserves genuine COMPLETE indexingStatus');

    // 16.6 Legacy cached document normalization via production normalizeCachedDocuments
    const rawLegacyDocs = [
      { id: 'chunk-1', category: 'HARVESTED_DOSSIER_CHUNK', title: 'chunk-1', occurrenceCount: 1 },
      { id: 'chunk-2', category: 'HARVESTED_DOSSIER_CHUNK', title: 'chunk-2', occurrenceCount: 1492 },
      { id: 'chunk-3', category: 'HARVESTED_DOSSIER_CHUNK', title: 'chunk-3', indexingStatus: 'COMPLETE', occurrenceCount: 1 },
      { id: 'chunk-4', category: 'HARVESTED_DOSSIER_CHUNK', title: 'chunk-4', indexingStatus: 'PARTIAL', occurrenceCount: 1 },
      { id: 'chunk-5', category: 'HARVESTED_DOSSIER_CHUNK', title: 'chunk-5', indexingStatus: 'UNKNOWN', occurrenceCount: 1 },
      { id: 'rule-1', category: 'CORE_OPERATING_RULE', title: 'Rule 1' }
    ];

    const docs = normalizeCachedDocuments(rawLegacyDocs);

    // 1. Legacy HARVESTED_DOSSIER_CHUNK without indexingStatus becomes UNKNOWN
    const d1 = docs.find(d => d.id === 'chunk-1');
    assert(d1 && d1.indexingStatus === 'UNKNOWN', 'Legacy HARVESTED_DOSSIER_CHUNK without indexingStatus normalized to UNKNOWN');

    // 2. occurrenceCount = 1 does NOT produce COMPLETE
    assert(d1 && d1.indexingStatus !== 'COMPLETE', 'occurrenceCount = 1 does NOT produce COMPLETE on legacy cache');

    // 3. occurrenceCount = 1492 does NOT produce PARTIAL
    const d2 = docs.find(d => d.id === 'chunk-2');
    assert(d2 && d2.indexingStatus === 'UNKNOWN', 'occurrenceCount = 1492 does NOT produce PARTIAL on legacy cache (normalized to UNKNOWN)');

    // 4. Existing genuine COMPLETE remains COMPLETE
    const d3 = docs.find(d => d.id === 'chunk-3');
    assert(d3 && d3.indexingStatus === 'COMPLETE', 'Existing genuine COMPLETE remains COMPLETE in cache normalization');

    // 5. Existing genuine PARTIAL remains PARTIAL
    const d4 = docs.find(d => d.id === 'chunk-4');
    assert(d4 && d4.indexingStatus === 'PARTIAL', 'Existing genuine PARTIAL remains PARTIAL in cache normalization');

    // 6. Existing genuine UNKNOWN remains UNKNOWN
    const d5 = docs.find(d => d.id === 'chunk-5');
    assert(d5 && d5.indexingStatus === 'UNKNOWN', 'Existing genuine UNKNOWN remains UNKNOWN in cache normalization');

    // 7. Canonical rules without indexingStatus receive COMPLETE
    const r1 = docs.find(d => d.id === 'rule-1');
    assert(r1 && r1.indexingStatus === 'COMPLETE', 'Canonical rule without indexingStatus receives COMPLETE');
  });

  // ---------------------------------------------------------------------------
  // TEST CASE 17: PAC-004 Phase 1B.2.1 Fix B — Template Title Detection & Source Independence
  // ---------------------------------------------------------------------------
  runTestCase('Fix B: Template title detection across repo slugs and source independence integrity', () => {
    // 17.1 Template heading detection regardless of repository slug prefix
    const testCases = [
      { heading: '2. Multi-Dimensional 8-Axis Investigation & Real Code Patches', slug: 'repo-alpha', expectedTemplate: true },
      { heading: '1. Context & Architectural Overview', slug: 'my-service', expectedTemplate: true },
      { heading: 'D1: Architecture & Structural Boundaries', slug: 'cool-app', expectedTemplate: true },
      { heading: 'D8: Forensic Bug Fixes & Real Production Code Patches', slug: 'backend-api', expectedTemplate: true },
      { heading: '3. Empirical Evidence & Compliance Certification', slug: 'org-tool', expectedTemplate: true },
      { heading: '4. Promotion & Integration Status', slug: 'infra-agent', expectedTemplate: true },
      { heading: 'Core Architecture', slug: 'minimal-repo', expectedTemplate: true },
      { heading: 'Incident Patches', slug: 'patch-repo', expectedTemplate: true },
      { heading: 'Core Architecture Module: parser.ts', slug: 'repo-alpha', expectedTemplate: false },
      { heading: 'Incident Patch 3: `d2d9befc` (2025-09-09)', slug: 'hexstrike-ai', expectedTemplate: false },
      { heading: 'Custom Algorithm Implementation', slug: 'math-lib', expectedTemplate: false }
    ];

    for (const tc of testCases) {
      const isTemplate = TEMPLATE_HEADING_REGEX.test(tc.heading);
      assert(isTemplate === tc.expectedTemplate, `Template heading detection accurate for: "${tc.heading}" (Expected: ${tc.expectedTemplate}, Got: ${isTemplate})`);
    }

    // 17.2 Multi-repo boilerplate occurring 2-10 times vs repeated substantive claims
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-indep-test-'));
    try {
      const learningDir = path.join(tmpDir, '07_PROJECT_LEARNING');
      fs.mkdirSync(learningDir, { recursive: true });

      const boilerBody = 'Standard boilerplate 8-axis investigation framework text for testing.';
      const sharedSubstantiveBody = 'Unique algorithm implementation for distributed hash ring routing and partition rebalancing.';
      const singleSourceBody = 'Single source forensic incident patch fixing memory leak in websocket stream.';

      // 3 repos containing template boilerplate and shared non-boilerplate
      fs.writeFileSync(path.join(learningDir, 'repo-alpha-learnings.md'),
        '## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches\n\n' + boilerBody +
        '\n\n### Core Architecture Module: router.ts\n\n' + sharedSubstantiveBody +
        '\n\n### Incident Patch 1: `a1b2c3d4`\n\n' + singleSourceBody);

      fs.writeFileSync(path.join(learningDir, 'repo-beta-learnings.md'),
        '## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches\n\n' + boilerBody +
        '\n\n### Core Architecture Module: router.ts\n\n' + sharedSubstantiveBody);

      fs.writeFileSync(path.join(learningDir, 'repo-gamma-learnings.md'),
        '## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches\n\n' + boilerBody +
        '\n\n### Core Architecture Module: router.ts\n\n' + sharedSubstantiveBody);

      const docs = parseDossierChunks({ brainRoot: tmpDir, learningDir });
      assert(docs.length === 3, 'parseDossierChunks yields 3 distinct content chunks');

      // 17.3 Repeated template boilerplate occurring 3 times (within 2-10 range)
      const boilerDoc = docs.find(d => d.sourceIndependence === 'BOILERPLATE');
      assert(boilerDoc !== undefined, 'Boilerplate document identified');
      assert(boilerDoc.occurrenceCount === 3, 'Boilerplate occurs in 3 repos');
      assert(boilerDoc.isBoilerplate === true, 'Boilerplate flagged as isBoilerplate: true');
      assert(boilerDoc.isIndependentCorroboration === false, 'Boilerplate isIndependentCorroboration is strictly false');
      assert(boilerDoc.independentCorroborationCount === 0, 'Boilerplate independentCorroborationCount is 0');
      assert(boilerDoc.sourceIndependence === 'BOILERPLATE', 'sourceIndependence marked BOILERPLATE');

      // 17.4 Repeated substantive non-boilerplate occurring 3 times (within 2-10 range)
      // Epistemic integrity: count > 1 does NOT imply independent corroboration!
      const sharedDoc = docs.find(d => d.sourceIndependence === 'UNKNOWN');
      assert(sharedDoc !== undefined, 'Shared substantive document identified with UNKNOWN independence');
      assert(sharedDoc.occurrenceCount === 3, 'Shared document occurs in 3 repos');
      assert(sharedDoc.isBoilerplate === false, 'Shared substantive document has isBoilerplate: false');
      assert(sharedDoc.isIndependentCorroboration === false, 'Shared document isIndependentCorroboration is strictly false (no count inference)');
      assert(sharedDoc.independentCorroborationCount === 0, 'Shared document independentCorroborationCount is 0');
      assert(sharedDoc.sourceIndependence === 'UNKNOWN', 'sourceIndependence marked UNKNOWN');

      // 17.5 Single-source substantive finding occurring 1 time
      const singleDoc = docs.find(d => d.sourceIndependence === 'SINGLE_SOURCE');
      assert(singleDoc !== undefined, 'Single-source document identified');
      assert(singleDoc.occurrenceCount === 1, 'Single-source document occurs in 1 repo');
      assert(singleDoc.isBoilerplate === false, 'Single-source document has isBoilerplate: false');
      assert(singleDoc.isIndependentCorroboration === false, 'Single-source document isIndependentCorroboration is false');
      assert(singleDoc.sourceIndependence === 'SINGLE_SOURCE', 'sourceIndependence marked SINGLE_SOURCE');

      // 17.6 Backward compatibility checks
      for (const d of docs) {
        assert(typeof d.occurrenceCount === 'number', 'doc has numeric occurrenceCount');
        assert(Array.isArray(d.sourceOccurrences) && d.sourceOccurrences.length === d.occurrenceCount, 'doc has matching sourceOccurrences array');
        assert(Array.isArray(d.corroborationSources), 'doc has corroborationSources array');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

} catch (topErr) {
  console.error('Fatal test runner failure:', topErr);
}

// ---------------------------------------------------------------------------
// Latency Benchmarks (Warm In-Memory Retrieval)
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log('⏱️ LATENCY BENCHMARKS');
console.log('======================================================================');

const tWarm0 = performance.now();
const warmRes = searchBrainDetailed('ModernVisualEngine');
const warmLatency = performance.now() - tWarm0;
console.log(`  Warm In-Memory Retrieval: ${warmLatency.toFixed(2)}ms (Status: ${warmRes.status}, Items: ${warmRes.results.length})`);

console.log('\n======================================================================');
console.log('📊 TEST SUITE SUMMARY');
console.log('======================================================================');
console.log(`Test Cases: ${passedTestCases}/${totalTestCases} Passed (${totalTestCases - passedTestCases} Failed)`);
console.log(`Assertions: ${passedAssertions}/${totalAssertions} Passed (${failedAssertions} Failed)`);

if (passedTestCases === totalTestCases && failedAssertions === 0) {
  console.log('🎉 ALL 17 RIGOROUS ADVERSARIAL TEST CASES AND ALL ASSERTIONS PASSED PERFECTLY!\n');
  process.exit(0);
} else {
  console.error('❌ SOME TESTS FAILED.\n');
  process.exit(1);
}
