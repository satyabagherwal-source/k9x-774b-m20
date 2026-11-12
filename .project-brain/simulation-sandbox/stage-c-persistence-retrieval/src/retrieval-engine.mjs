/**
 * retrieval-engine.mjs
 * 
 * Isolated BM25 Retrieval & Verification Engine for Stage C
 * Executes search queries against the test index and verifies
 * identity, provenance, domain, and hash integrity of returned records.
 */

import { tokenizeText } from './indexing-engine.mjs';

export class StageCRetrievalEngine {
  /**
   * @param {StageCIndexingEngine} indexingEngine 
   * @param {StageCPersistenceEngine} persistenceEngine 
   */
  constructor(indexingEngine, persistenceEngine) {
    this.indexingEngine = indexingEngine;
    this.persistenceEngine = persistenceEngine;
  }

  /**
   * Executes a ranked BM25 search query against the isolated index.
   * 
   * @param {string} queryString Search query text
   * @param {object} options Filter options: { domain, destination, limit, k1, b }
   * @returns {object} Search results with verified metadata
   */
  search(queryString, options = {}) {
    const startTime = Date.now();
    const queryTokens = tokenizeText(queryString);
    const index = this.indexingEngine.loadIndex();

    const N = index.total_docs;
    const avgdl = index.avg_doc_length || 1;
    const k1 = options.k1 ?? 1.2;
    const b = options.b ?? 0.75;
    const limit = options.limit ?? 10;
    const domainFilter = options.domain;
    const destinationFilter = options.destination;

    if (queryTokens.length === 0 || N === 0) {
      return {
        query: queryString,
        query_tokens: queryTokens,
        total_hits: 0,
        hits: [],
        execution_time_ms: Date.now() - startTime
      };
    }

    const docScores = {};
    const docMatchedTerms = {};

    for (const token of queryTokens) {
      const postings = index.inverted_index[token];
      if (!postings || postings.length === 0) continue;

      const n_t = postings.length;
      // Standard BM25 IDF
      const idf = Math.log(1 + (N - n_t + 0.5) / (n_t + 0.5));

      for (const posting of postings) {
        const docId = posting.doc_id;

        // Apply domain filter if specified
        if (domainFilter && index.doc_metadata[docId]?.domain_classification !== domainFilter) {
          continue;
        }

        // Apply destination filter if specified
        if (destinationFilter && index.doc_metadata[docId]?.proposed_canonical_destination !== destinationFilter) {
          continue;
        }

        const f_t_D = posting.term_frequency;
        const docLen = index.doc_lengths[docId] || avgdl;

        const numerator = f_t_D * (k1 + 1);
        const denominator = f_t_D + k1 * (1 - b + b * (docLen / avgdl));
        const termScore = idf * (numerator / denominator);

        docScores[docId] = (docScores[docId] || 0) + termScore;
        if (!docMatchedTerms[docId]) docMatchedTerms[docId] = [];
        docMatchedTerms[docId].push(token);
      }
    }

    // Rank candidates by descending score
    const rankedDocIds = Object.keys(docScores).sort((a, b) => docScores[b] - docScores[a]);
    const topDocIds = rankedDocIds.slice(0, limit);

    // Verify each hit with the persistence store
    const verifiedHits = [];
    for (let i = 0; i < topDocIds.length; i++) {
      const docId = topDocIds[i];
      const score = Number(docScores[docId].toFixed(4));
      const matched = docMatchedTerms[docId];
      const meta = index.doc_metadata[docId];

      // Read back from persistence store to verify disk integrity
      const storeResult = this.persistenceEngine.readRecord(docId);

      let recordVerificationStatus = 'VERIFIED';
      const verificationAnomalies = [];

      if (!storeResult.found) {
        recordVerificationStatus = 'FAILED_NOT_FOUND_ON_DISK';
        verificationAnomalies.push(`Doc ${docId} indexed but missing on disk`);
      } else if (!storeResult.valid) {
        recordVerificationStatus = 'FAILED_INTEGRITY_TAMPERED';
        verificationAnomalies.push(`Hash mismatch: expected ${storeResult.stored_hash}, got ${storeResult.current_hash}`);
      } else {
        const rec = storeResult.record;
        if (rec.domain_classification !== meta.domain_classification) {
          verificationAnomalies.push(`Domain mismatch: index=${meta.domain_classification}, store=${rec.domain_classification}`);
        }
        if (rec.proposed_canonical_destination !== meta.proposed_canonical_destination) {
          verificationAnomalies.push(`Destination mismatch: index=${meta.proposed_canonical_destination}, store=${rec.proposed_canonical_destination}`);
        }
        if (!rec.provenance?.upstream_repository) {
          verificationAnomalies.push('Missing provenance upstream repository');
        }
        if (!rec.evidence?.verification_status) {
          verificationAnomalies.push('Missing evidence verification status');
        }
        if (verificationAnomalies.length > 0) {
          recordVerificationStatus = 'PARTIAL_METADATA_MISMATCH';
        }
      }

      verifiedHits.push({
        rank: i + 1,
        candidate_id: docId,
        score,
        matched_terms: matched,
        title: meta?.title,
        domain: meta?.domain_classification,
        destination: meta?.proposed_canonical_destination,
        implementation_evidence_status: meta?.implementation_evidence_status,
        knowledge_transferability_status: meta?.knowledge_transferability_status,
        provenance: meta?.provenance,
        integrity_hash: meta?.integrity_hash,
        verification_status: recordVerificationStatus,
        verification_anomalies: verificationAnomalies
      });
    }

    return {
      query: queryString,
      query_tokens: queryTokens,
      total_hits: rankedDocIds.length,
      returned_hits: verifiedHits.length,
      hits: verifiedHits,
      execution_time_ms: Date.now() - startTime
    };
  }
}

