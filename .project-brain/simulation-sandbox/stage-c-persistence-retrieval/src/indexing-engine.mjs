/**
 * indexing-engine.mjs
 * 
 * Isolated Indexing Engine for Stage C
 * Constructs an inverted token index, BM25 term weights, domain facet index,
 * and destination facet index from persisted test store records.
 */

import fs from 'fs';
import path from 'path';

/**
 * Normalizes text into a clean token array.
 * @param {string} text 
 * @returns {string[]}
 */
export function tokenizeText(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

export class StageCIndexingEngine {
  /**
   * @param {string} indexDir Directory for isolated test index files
   */
  constructor(indexDir) {
    this.indexDir = indexDir;
    this.indexPath = path.join(indexDir, 'index.json');
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(this.indexDir)) {
      fs.mkdirSync(this.indexDir, { recursive: true });
    }
    if (!fs.existsSync(this.indexPath)) {
      this.clearIndex();
    }
  }

  clearIndex() {
    const emptyIndex = {
      index_version: "1.0.0-stage-c",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_docs: 0,
      total_terms: 0,
      avg_doc_length: 0,
      doc_lengths: {},
      inverted_index: {},
      domain_facets: {},
      destination_facets: {},
      doc_metadata: {}
    };
    fs.writeFileSync(this.indexPath, JSON.stringify(emptyIndex, null, 2), 'utf8');
    return emptyIndex;
  }

  loadIndex() {
    return JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
  }

  saveIndex(indexObj) {
    indexObj.updated_at = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(indexObj, null, 2), 'utf8');
  }

  /**
   * Adds or updates a single record in the index.
   * @param {object} record 
   */
  indexRecord(record) {
    const idx = this.loadIndex();
    const docId = record.candidate_id;

    // Remove existing occurrences if re-indexing
    this.removeRecordFromIndex(idx, docId);

    // Extract text from searchable fields
    const titleTokens = tokenizeText(record.title);
    const contentTokens = tokenizeText(record.content);
    const summaryTokens = tokenizeText(record.summary || '');
    const instructionTokens = tokenizeText(record.actionable_instruction || '');
    const tagTokens = tokenizeText((record.tags || []).join(' '));

    const allTokens = [
      ...titleTokens,
      ...titleTokens, // boost title
      ...contentTokens,
      ...summaryTokens,
      ...instructionTokens,
      ...tagTokens
    ];

    const docLength = allTokens.length;
    idx.doc_lengths[docId] = docLength;

    // Count term frequencies
    const tf = {};
    for (const term of allTokens) {
      tf[term] = (tf[term] || 0) + 1;
    }

    // Update inverted index
    for (const [term, freq] of Object.entries(tf)) {
      if (!idx.inverted_index[term]) {
        idx.inverted_index[term] = [];
      }
      idx.inverted_index[term].push({
        doc_id: docId,
        term_frequency: freq
      });
    }

    // Update facets
    const domain = record.domain_classification;
    if (domain) {
      if (!idx.domain_facets[domain]) idx.domain_facets[domain] = [];
      idx.domain_facets[domain].push(docId);
    }

    const destination = record.proposed_canonical_destination;
    if (destination) {
      if (!idx.destination_facets[destination]) idx.destination_facets[destination] = [];
      idx.destination_facets[destination].push(docId);
    }

    // Store quick document metadata for fast retrieval verification
    idx.doc_metadata[docId] = {
      candidate_id: docId,
      title: record.title,
      domain_classification: domain,
      proposed_canonical_destination: destination,
      implementation_evidence_status: record.implementation_evidence_status,
      knowledge_transferability_status: record.knowledge_transferability_status,
      provenance: record.provenance,
      integrity_hash: record.integrity_hash,
      stored_at: record.stored_at
    };

    // Update global metrics
    idx.total_docs = Object.keys(idx.doc_metadata).length;
    idx.total_terms = Object.keys(idx.inverted_index).length;
    const totalTokensAll = Object.values(idx.doc_lengths).reduce((a, b) => a + b, 0);
    idx.avg_doc_length = idx.total_docs > 0 ? (totalTokensAll / idx.total_docs) : 0;

    this.saveIndex(idx);
    return { doc_id: docId, indexed_terms_count: Object.keys(tf).length, total_tokens: docLength };
  }

  /**
   * Helper to remove a document from index structures.
   */
  removeRecordFromIndex(idx, docId) {
    if (!idx.doc_metadata[docId]) return;

    delete idx.doc_metadata[docId];
    delete idx.doc_lengths[docId];

    for (const term of Object.keys(idx.inverted_index)) {
      idx.inverted_index[term] = idx.inverted_index[term].filter(entry => entry.doc_id !== docId);
      if (idx.inverted_index[term].length === 0) {
        delete idx.inverted_index[term];
      }
    }

    for (const d of Object.keys(idx.domain_facets)) {
      idx.domain_facets[d] = idx.domain_facets[d].filter(id => id !== docId);
    }
    for (const dest of Object.keys(idx.destination_facets)) {
      idx.destination_facets[dest] = idx.destination_facets[dest].filter(id => id !== docId);
    }
  }

  /**
   * Rebuilds the entire index from an array of persisted records.
   * @param {Array<object>} records 
   */
  rebuildIndex(records) {
    this.clearIndex();
    const results = [];
    for (const record of records) {
      const res = this.indexRecord(record);
      results.push(res);
    }
    const finalIndex = this.loadIndex();
    return {
      rebuilt_at: new Date().toISOString(),
      records_indexed: results.length,
      total_terms: finalIndex.total_terms,
      total_docs: finalIndex.total_docs
    };
  }
}

