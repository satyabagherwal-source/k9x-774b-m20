/**
 * persistence-engine.mjs
 * 
 * Isolated Persistence & Read-Back Verification Engine for Stage C
 * Strictly operates within the simulation-sandbox test-store directory.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { validateCandidateRecord } from './candidate-schema.mjs';

/**
 * Computes deterministic SHA-256 hash of an object using sorted keys.
 * Recursively sorts keys for nested objects.
 * @param {object} obj 
 * @returns {string} SHA-256 hex digest
 */
export function computeCanonicalHash(obj) {
  function canonicalize(val) {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(canonicalize);
    }
    const sortedObj = {};
    for (const key of Object.keys(val).sort()) {
      sortedObj[key] = canonicalize(val[key]);
    }
    return sortedObj;
  }
  const canonicalObj = canonicalize(obj);
  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj)).digest('hex');
}

export class StageCPersistenceEngine {
  /**
   * @param {string} storeDir Absolute or relative path to isolated test store
   */
  constructor(storeDir) {
    this.storeDir = storeDir;
    this.registryPath = path.join(storeDir, 'store-registry.json');
    this.ensureInitialized();
  }

  ensureInitialized() {
    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }
    if (!fs.existsSync(this.registryPath)) {
      const initialRegistry = {
        store_version: "1.0.0-stage-c",
        created_at: new Date().toISOString(),
        records_count: 0,
        records: {}
      };
      fs.writeFileSync(this.registryPath, JSON.stringify(initialRegistry, null, 2), 'utf8');
    }
  }

  getRegistry() {
    return JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
  }

  saveRegistry(reg) {
    reg.records_count = Object.keys(reg.records).length;
    reg.updated_at = new Date().toISOString();
    fs.writeFileSync(this.registryPath, JSON.stringify(reg, null, 2), 'utf8');
  }

  /**
   * Persists an approved candidate record into the isolated test store.
   * Performs schema validation, approval enforcement, duplicate checks,
   * atomic file writing, immediate read-back, and bitwise integrity verification.
   * 
   * @param {object} candidate 
   * @returns {object} Execution result with status and metrics
   */
  persistCandidate(candidate) {
    // Step 1: Strict Schema & Metadata Validation
    const schemaValidation = validateCandidateRecord(candidate);
    if (!schemaValidation.valid) {
      return {
        success: false,
        status: 'VALIDATION_FAILED',
        candidate_id: candidate?.candidate_id,
        errors: schemaValidation.errors
      };
    }

    // Step 2: Human Approval Status Enforcement (Admission Gate)
    if (candidate.approval_status !== 'APPROVED') {
      return {
        success: false,
        status: 'UNAPPROVED_RECORD_REJECTED',
        candidate_id: candidate.candidate_id,
        reason: `Record has approval_status '${candidate.approval_status}'. Only APPROVED candidates may be persisted.`
      };
    }

    const reg = this.getRegistry();

    // Step 3: Duplicate Candidate ID Check
    if (reg.records[candidate.candidate_id]) {
      return {
        success: false,
        status: 'DUPLICATE_ID_REJECTED',
        candidate_id: candidate.candidate_id,
        reason: `Candidate ID '${candidate.candidate_id}' already exists in the test store.`
      };
    }

    // Step 4: Duplicate References Check
    if (candidate.duplicate_references && candidate.duplicate_references.length > 0) {
      const conflictingDuplicates = [];
      for (const dupeId of candidate.duplicate_references) {
        if (reg.records[dupeId]) {
          conflictingDuplicates.push(dupeId);
        }
      }
      if (conflictingDuplicates.length > 0) {
        return {
          success: false,
          status: 'DUPLICATE_REFERENCE_DETECTED',
          candidate_id: candidate.candidate_id,
          conflicting_duplicates: conflictingDuplicates,
          reason: `Candidate claims duplicate references that already exist in store: ${conflictingDuplicates.join(', ')}`
        };
      }
    }

    // Step 5: Construct Canonical Base Record and Compute Integrity Hash
    const storedAt = new Date().toISOString();
    const basePayload = {
      candidate_id: candidate.candidate_id,
      title: candidate.title,
      content: candidate.content,
      summary: candidate.summary || '',
      actionable_instruction: candidate.actionable_instruction || '',
      tags: candidate.tags || [],
      domain_classification: candidate.domain_classification,
      proposed_canonical_destination: candidate.proposed_canonical_destination,
      duplicate_references: candidate.duplicate_references || [],
      approval_status: candidate.approval_status,
      implementation_evidence_status: candidate.implementation_evidence_status,
      knowledge_transferability_status: candidate.knowledge_transferability_status,
      provenance: candidate.provenance,
      evidence: candidate.evidence,
      persistence_status: 'PERSISTED',
      stored_at: storedAt
    };

    const integrityHash = computeCanonicalHash(basePayload);

    const recordToPersist = {
      ...basePayload,
      integrity_hash: integrityHash,
      readback_verified: false
    };

    const recordFilePath = path.join(this.storeDir, `${candidate.candidate_id}.json`);
    const recordJson = JSON.stringify(recordToPersist, null, 2);

    // Step 6: Atomic Disk Persistence
    fs.writeFileSync(recordFilePath, recordJson, 'utf8');

    // Step 7: Immediate Read-Back and Integrity Verification
    if (!fs.existsSync(recordFilePath)) {
      return {
        success: false,
        status: 'PERSISTENCE_WRITE_FAILED',
        candidate_id: candidate.candidate_id,
        reason: 'File was not written to disk'
      };
    }

    const readbackRaw = fs.readFileSync(recordFilePath, 'utf8');
    let readbackObj;
    try {
      readbackObj = JSON.parse(readbackRaw);
    } catch (err) {
      return {
        success: false,
        status: 'READBACK_PARSE_FAILED',
        candidate_id: candidate.candidate_id,
        error: err.message
      };
    }

    // Step 8: Bitwise & Field-by-Field Equality Verification
    const readbackBase = {
      candidate_id: readbackObj.candidate_id,
      title: readbackObj.title,
      content: readbackObj.content,
      summary: readbackObj.summary || '',
      actionable_instruction: readbackObj.actionable_instruction || '',
      tags: readbackObj.tags || [],
      domain_classification: readbackObj.domain_classification,
      proposed_canonical_destination: readbackObj.proposed_canonical_destination,
      duplicate_references: readbackObj.duplicate_references || [],
      approval_status: readbackObj.approval_status,
      implementation_evidence_status: readbackObj.implementation_evidence_status,
      knowledge_transferability_status: readbackObj.knowledge_transferability_status,
      provenance: readbackObj.provenance,
      evidence: readbackObj.evidence,
      persistence_status: readbackObj.persistence_status,
      stored_at: readbackObj.stored_at
    };

    const computedReadbackHash = computeCanonicalHash(readbackBase);

    if (computedReadbackHash !== integrityHash || readbackObj.integrity_hash !== integrityHash) {
      return {
        success: false,
        status: 'READBACK_HASH_MISMATCH',
        candidate_id: candidate.candidate_id,
        expected_hash: integrityHash,
        actual_hash: computedReadbackHash,
        file_hash: readbackObj.integrity_hash
      };
    }

    // Verify key fields match
    const criticalFields = ['candidate_id', 'title', 'content', 'domain_classification', 'proposed_canonical_destination'];
    for (const field of criticalFields) {
      if (readbackObj[field] !== candidate[field]) {
        return {
          success: false,
          status: 'READBACK_FIELD_MISMATCH',
          candidate_id: candidate.candidate_id,
          field,
          expected: candidate[field],
          actual: readbackObj[field]
        };
      }
    }

    // Step 9: Finalize Registry Entry
    reg.records[candidate.candidate_id] = {
      candidate_id: candidate.candidate_id,
      title: candidate.title,
      domain: candidate.domain_classification,
      destination: candidate.proposed_canonical_destination,
      file_path: recordFilePath,
      integrity_hash: integrityHash,
      stored_at: storedAt,
      readback_verified: true
    };
    this.saveRegistry(reg);

    // Update in-place to mark readback verified on disk
    recordToPersist.readback_verified = true;
    fs.writeFileSync(recordFilePath, JSON.stringify(recordToPersist, null, 2), 'utf8');

    return {
      success: true,
      status: 'PERSISTED_AND_READBACK_VERIFIED',
      candidate_id: candidate.candidate_id,
      file_path: recordFilePath,
      integrity_hash: integrityHash,
      record: recordToPersist
    };
  }

  /**
   * Reads a record by ID and asserts integrity.
   * @param {string} candidateId 
   * @returns {object}
   */
  readRecord(candidateId) {
    const reg = this.getRegistry();
    const entry = reg.records[candidateId];
    if (!entry) {
      return { found: false, error: `Record '${candidateId}' not found in test store registry.` };
    }

    if (!fs.existsSync(entry.file_path)) {
      return { found: false, error: `Record file '${entry.file_path}' does not exist on disk.` };
    }

    const raw = fs.readFileSync(entry.file_path, 'utf8');
    let obj;
    try {
      obj = JSON.parse(raw);
    } catch (e) {
      return { found: true, valid: false, error: `Corrupted JSON: ${e.message}` };
    }

    // Verify hash integrity against stored entry and computed content
    const basePayload = {
      candidate_id: obj.candidate_id,
      title: obj.title,
      content: obj.content,
      summary: obj.summary || '',
      actionable_instruction: obj.actionable_instruction || '',
      tags: obj.tags || [],
      domain_classification: obj.domain_classification,
      proposed_canonical_destination: obj.proposed_canonical_destination,
      duplicate_references: obj.duplicate_references || [],
      approval_status: obj.approval_status,
      implementation_evidence_status: obj.implementation_evidence_status,
      knowledge_transferability_status: obj.knowledge_transferability_status,
      provenance: obj.provenance,
      evidence: obj.evidence,
      persistence_status: obj.persistence_status,
      stored_at: obj.stored_at
    };

    const computedHash = computeCanonicalHash(basePayload);
    const hashValid = (computedHash === entry.integrity_hash && obj.integrity_hash === entry.integrity_hash);

    return {
      found: true,
      valid: hashValid,
      record: obj,
      stored_hash: entry.integrity_hash,
      current_hash: computedHash,
      tampered: !hashValid
    };
  }

  /**
   * Returns all persisted records.
   * @returns {Array<object>}
   */
  listAllRecords() {
    const reg = this.getRegistry();
    const results = [];
    for (const id of Object.keys(reg.records)) {
      const readResult = this.readRecord(id);
      if (readResult.found && readResult.valid) {
        results.push(readResult.record);
      }
    }
    return results;
  }
}
