/**
 * shared-pipeline.mjs
 * 
 * Shared Harvesting Pipeline Core Engine for Stage D
 * Unifies Cloud and Manual harvesting paths under one deterministic contract:
 * DISCOVER -> EXTRACT -> CLASSIFY -> VALIDATE -> DUPLICATE CHECK ->
 * APPROVAL GATE -> ROUTE -> PERSIST -> READ-BACK -> INDEX -> RETRIEVE -> VERIFY.
 */

import fs from 'fs';
import path from 'path';
import { ProvenanceResolver } from './provenance-resolver.mjs';
import { HumanApprovalGate } from './approval-gate.mjs';
import { PipelineAuditLogger } from './audit-logger.mjs';

// Reuse existing production classifier and destination router (4 levels up to repo root)
import { classifyKnowledgeContent } from '../../../../04_WORKFLOWS/factory-engine/domain-classifier.mjs';
import { resolveDestination } from '../../../../04_WORKFLOWS/factory-engine/destination-router.mjs';

// Reuse verified Stage C persistence, indexing, and retrieval engines (2 levels up to simulation-sandbox)
import { StageCPersistenceEngine } from '../../stage-c-persistence-retrieval/src/persistence-engine.mjs';
import { StageCIndexingEngine } from '../../stage-c-persistence-retrieval/src/indexing-engine.mjs';
import { StageCRetrievalEngine } from '../../stage-c-persistence-retrieval/src/retrieval-engine.mjs';
import { validateCandidateRecord } from '../../stage-c-persistence-retrieval/src/candidate-schema.mjs';

export class SharedHarvestingPipeline {
  /**
   * @param {object} config Configuration paths for sandbox isolation
   */
  constructor(config = {}) {
    this.sandboxRoot = config.sandboxRoot || path.resolve('.project-brain/simulation-sandbox/stage-d-harvester-integration');
    this.storeDir = config.storeDir || path.join(this.sandboxRoot, 'test-store');
    this.inboxDir = config.inboxDir || path.join(this.storeDir, 'inbox');
    this.indexDir = config.indexDir || path.join(this.sandboxRoot, 'test-index');
    this.resultsDir = config.resultsDir || path.join(this.sandboxRoot, 'results');

    this.provenanceResolver = new ProvenanceResolver();
    this.approvalGate = new HumanApprovalGate();
    this.auditLogger = new PipelineAuditLogger(this.resultsDir);

    this.persistenceEngine = new StageCPersistenceEngine(this.storeDir);
    this.indexingEngine = new StageCIndexingEngine(this.indexDir);
    this.retrievalEngine = new StageCRetrievalEngine(this.indexingEngine, this.persistenceEngine);

    if (!fs.existsSync(this.inboxDir)) {
      fs.mkdirSync(this.inboxDir, { recursive: true });
    }
  }

  /**
   * Core processing contract for any NormalizedHarvestInput.
   * Executed identically whether invoked by Cloud Harvester or Manual Harvester.
   * 
   * @param {object} normalizedInput 
   * @returns {object} Pipeline execution summary
   */
  async processHarvest(normalizedInput) {
    const startTime = Date.now();
    const errors = [];
    const executionTrail = [];

    // Step 1: Provenance Resolution
    const provRes = this.provenanceResolver.resolve(normalizedInput);
    if (!provRes.valid) {
      errors.push(...provRes.errors);
      return this._finalizeFailure(normalizedInput, errors, startTime, 'PROVENANCE_FAILED');
    }
    executionTrail.push({ stage: 'PROVENANCE_RESOLVED', provenance: provRes.provenance });

    // Step 2: 13-Domain Classification
    const classification = classifyKnowledgeContent(normalizedInput);
    const domainLetter = classification.primaryDomain?.letter || 'H';
    const domainName = classification.primaryDomain?.name || 'Technical Construction Intelligence';
    executionTrail.push({
      stage: 'DOMAIN_CLASSIFIED',
      domain_letter: domainLetter,
      domain_name: domainName,
      confidence: classification.confidence
    });

    // Step 3: 16-Canonical Destination Routing
    const routing = resolveDestination(normalizedInput);
    const targetFolder = routing.targetFolder || '05_KNOWLEDGE';
    executionTrail.push({
      stage: 'DESTINATION_ROUTED',
      target_folder: targetFolder,
      requires_approval: routing.requiresHumanApproval
    });

    // Step 4 to 10: Process each candidate directive
    const persistedRecords = [];
    const stagedInboxRecords = [];
    const rejectedRecords = [];
    const retrievalVerifications = [];

    for (const candidate of normalizedInput.candidate_directives) {
      // Enrich candidate with resolved domain and destination
      candidate.domain_classification = domainLetter;
      candidate.proposed_canonical_destination = targetFolder;

      // Duplicate Check against Store
      const storeReg = this.persistenceEngine.getRegistry();
      if (storeReg.records[candidate.candidate_id]) {
        rejectedRecords.push({
          candidate_id: candidate.candidate_id,
          reason: 'DUPLICATE_ID_REJECTED',
          message: `Candidate ${candidate.candidate_id} already exists in test store.`
        });
        continue;
      }

      // Human Approval Gate Check
      const approvalDecision = this.approvalGate.evaluate(candidate, routing);

      if (approvalDecision.admitted_to_canonical) {
        // Persist to Canonical Store with Read-Back
        const persistResult = this.persistenceEngine.persistCandidate(candidate);
        if (!persistResult.success) {
          rejectedRecords.push({
            candidate_id: candidate.candidate_id,
            reason: persistResult.status,
            errors: persistResult.errors || [persistResult.reason]
          });
          continue;
        }

        persistedRecords.push(persistResult.record);

        // Index in Inverted Index
        this.indexingEngine.indexRecord(persistResult.record);

        // Real Retrieval Verification
        const searchRes = this.retrievalEngine.search(candidate.title, { domain: domainLetter });
        const topHit = searchRes.hits[0];
        const isRetrieved = topHit && topHit.candidate_id === candidate.candidate_id && topHit.verification_status === 'VERIFIED';

        retrievalVerifications.push({
          candidate_id: candidate.candidate_id,
          query: candidate.title,
          retrieved: isRetrieved,
          rank: topHit ? topHit.rank : -1,
          score: topHit ? topHit.score : 0,
          verification_status: topHit ? topHit.verification_status : 'NOT_FOUND'
        });
      } else {
        // Stage in 11_INBOX (Never lost silently!)
        const inboxFilePath = path.join(this.inboxDir, `${candidate.candidate_id}.json`);
        const inboxPayload = {
          ...candidate,
          staged_at: new Date().toISOString(),
          admission_decision: approvalDecision,
          staging_status: 'STAGED_IN_INBOX_PENDING_HUMAN_APPROVAL'
        };
        fs.writeFileSync(inboxFilePath, JSON.stringify(inboxPayload, null, 2), 'utf8');

        stagedInboxRecords.push({
          candidate_id: candidate.candidate_id,
          file_path: inboxFilePath,
          decision: approvalDecision
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const isOverallSuccess = (persistedRecords.length > 0 || stagedInboxRecords.length > 0) && errors.length === 0;

    const summary = {
      success: isOverallSuccess,
      status: isOverallSuccess ? 'VERIFIED_HARVEST_CYCLE' : 'HARVEST_CYCLE_WITH_REJECTIONS',
      harvest_origin: normalizedInput.harvest_origin,
      repository: normalizedInput.repository,
      source_revision: normalizedInput.source_version,
      errors: errors,
      domain_classification: {
        letter: domainLetter,
        name: domainName,
        confidence: classification.confidence
      },
      destination_routing: {
        target_folder: targetFolder,
        suggested_path: routing.suggestedRelativePath
      },
      metrics: {
        duration_ms: durationMs,
        candidates_total: normalizedInput.candidate_directives.length,
        candidates_persisted: persistedRecords.length,
        candidates_staged_inbox: stagedInboxRecords.length,
        candidates_rejected: rejectedRecords.length,
        retrieval_verified_count: retrievalVerifications.filter(v => v.retrieved).length
      },
      persisted_records: persistedRecords.map(r => ({ id: r.candidate_id, title: r.title, hash: r.integrity_hash })),
      staged_inbox_records: stagedInboxRecords,
      rejected_records: rejectedRecords,
      retrieval_verifications: retrievalVerifications,
      execution_trail: executionTrail
    };

    // Audit Log Entry
    this.auditLogger.logExecution({
      origin: normalizedInput.harvest_origin,
      repository: normalizedInput.repository,
      status: summary.status,
      metrics: summary.metrics,
      errors: errors,
      duration_ms: durationMs
    });

    return summary;
  }

  _finalizeFailure(normalizedInput, errors, startTime, status) {
    const durationMs = Date.now() - startTime;
    const failSummary = {
      success: false,
      status,
      harvest_origin: normalizedInput?.harvest_origin || 'UNKNOWN',
      repository: normalizedInput?.repository || 'UNKNOWN',
      errors: errors || [],
      duration_ms: durationMs
    };
    this.auditLogger.logExecution({
      origin: failSummary.harvest_origin,
      repository: failSummary.repository,
      status,
      errors: errors || [],
      duration_ms: durationMs
    });
    return failSummary;
  }
}
