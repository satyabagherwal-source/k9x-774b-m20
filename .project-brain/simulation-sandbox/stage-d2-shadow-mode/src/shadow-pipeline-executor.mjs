/**
 * Shadow Pipeline Executor
 * 
 * Executes the Stage D shared pipeline in NON-WRITING SHADOW MODE.
 * Performs normalization, provenance resolution, 13-domain classification,
 * 16-canonical-folder destination routing, duplicate detection, and approval evaluation.
 * 
 * STRICT INVARIANT: ZERO writes to canonical production stores.
 * Writes sanitized trace files solely to shadow-traces directory.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { normalizeHarvestInput, HARVEST_ORIGINS } from '../../stage-d-harvester-integration/src/normalized-input.mjs';
import { ProvenanceResolver } from '../../stage-d-harvester-integration/src/provenance-resolver.mjs';
import { HumanApprovalGate } from '../../stage-d-harvester-integration/src/approval-gate.mjs';
import { classifyKnowledgeContent } from '../../../../04_WORKFLOWS/factory-engine/domain-classifier.mjs';
import { resolveDestination } from '../../../../04_WORKFLOWS/factory-engine/destination-router.mjs';
import { sanitizeData } from './secret-sanitizer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TRACE_DIR = path.resolve(__dirname, '..', 'shadow-traces');

export const SHADOW_STATUS = {
  SHADOW_VERIFIED: 'SHADOW_VERIFIED',
  SHADOW_DUPLICATE: 'SHADOW_DUPLICATE',
  SHADOW_STAGED_UNAPPROVED: 'SHADOW_STAGED_UNAPPROVED',
  SHADOW_REJECTED: 'SHADOW_REJECTED'
};

export class ShadowPipelineExecutor {
  constructor(options = {}) {
    this.traceDir = options.traceDir || DEFAULT_TRACE_DIR;
    this.provenanceResolver = new ProvenanceResolver();
    this.approvalGate = new HumanApprovalGate();
    this.existingIndex = options.existingIndex || null;
    this.existingRegistry = options.existingRegistry || null;

    if (!fs.existsSync(this.traceDir)) {
      fs.mkdirSync(this.traceDir, { recursive: true });
    }
  }

  /**
   * Executes the shadow pipeline against raw or normalized input.
   * @param {object} input - Raw learning package or normalized input
   * @param {object} options - Execution options (origin, writeTrace, customTraceDir)
   * @returns {object} Shadow execution result
   */
  async execute(input, options = {}) {
    const startTime = Date.now();
    const traceId = `trace-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const origin = options.origin || HARVEST_ORIGINS.CLOUD;

    let normalized;
    const errors = [];

    // 1. Normalization
    try {
      normalized = input.normalized ? input : normalizeHarvestInput(input, origin);
      if (input.content_hash) normalized.content_hash = input.content_hash;
      if (input.learning_id) normalized.learning_id = input.learning_id;
      if (input.metadata) normalized.metadata = input.metadata;
      if (input.approval_status) normalized.approval_status = input.approval_status;
      if (input.requires_human_approval !== undefined) normalized.requires_human_approval = input.requires_human_approval;
      if (input.candidates) normalized.candidates = input.candidates;
      if (!normalized.candidates && normalized.candidate_directives) {
        normalized.candidates = normalized.candidate_directives;
      }
      if (input.dossier_content && !normalized.dossier_text) {
        normalized.dossier_text = input.dossier_content;
      }
      if (input.source_url) normalized.source_url = input.source_url;
      // Preserve any credential test properties for sanitization audit
      if (input.apiKey) normalized.apiKey = input.apiKey;
      if (input.client_secret) normalized.client_secret = input.client_secret;
      if (input.token) normalized.token = input.token;
    } catch (normErr) {
      const failedResult = {
        trace_id: traceId,
        timestamp: new Date().toISOString(),
        execution_duration_ms: Date.now() - startTime,
        status: SHADOW_STATUS.SHADOW_REJECTED,
        error: `Normalization error: ${normErr.message}`,
        success: false
      };
      this._persistTrace(failedResult, options);
      return failedResult;
    }

    // 2. Cryptographic Provenance Resolution
    const provResult = this.provenanceResolver.resolve(normalized);
    if (!provResult.valid) {
      errors.push(...provResult.errors);
    }

    // 3. 13-Domain Classification
    const classification = classifyKnowledgeContent(normalized);

    // 4. 16-Canonical-Folder Destination Routing
    const routing = resolveDestination(normalized);

    // 5. Duplicate Detection
    const duplicateCheck = this._checkDuplicate(normalized, options);

    // 6. Approval Evaluation for Candidate Items
    let approvalEvaluation = null;
    if (normalized.candidates && normalized.candidates.length > 0) {
      approvalEvaluation = normalized.candidates.map(cand => {
        return {
          candidate_id: cand.candidate_id || cand.id,
          eval: this.approvalGate.evaluate(cand, routing)
        };
      });
    } else {
      approvalEvaluation = [{
        candidate_id: normalized.learning_id,
        eval: this.approvalGate.evaluate(normalized, routing)
      }];
    }

    // 7. Resolve Final Shadow Status
    let shadowStatus = SHADOW_STATUS.SHADOW_VERIFIED;
    if (errors.length > 0 && (!normalized.source_url || !normalized.repository)) {
      shadowStatus = SHADOW_STATUS.SHADOW_REJECTED;
    } else if (duplicateCheck.is_duplicate) {
      shadowStatus = SHADOW_STATUS.SHADOW_DUPLICATE;
    } else if (approvalEvaluation.some(a => !a.eval.admitted_to_canonical)) {
      shadowStatus = SHADOW_STATUS.SHADOW_STAGED_UNAPPROVED;
    }

    const durationMs = Date.now() - startTime;

    const shadowResult = {
      trace_id: traceId,
      timestamp: new Date().toISOString(),
      origin,
      repository: normalized.repository,
      learning_id: normalized.learning_id,
      content_hash: normalized.content_hash,
      execution_duration_ms: durationMs,
      shadow_status: shadowStatus,
      success: shadowStatus !== SHADOW_STATUS.SHADOW_REJECTED,
      payload_audit: {
        source_url: normalized.source_url,
        dossier_text: normalized.dossier_text ? normalized.dossier_text.substring(0, 1000) : '',
        apiKey: normalized.apiKey,
        client_secret: normalized.client_secret,
        token: normalized.token
      },
      classification: {
        primary_domain: classification.primaryDomain?.letter || 'H',
        primary_domain_name: classification.primaryDomain?.name || 'Technical Construction Intelligence',
        confidence: classification.confidence,
        secondary_domains: (classification.secondaryDomains || []).map(s => s.letter || s)
      },
      routing: {
        destination_folder: routing.targetFolder,
        suggested_path: routing.suggestedRelativePath,
        requires_human_approval: routing.requiresHumanApproval
      },
      duplicate_detection: duplicateCheck,
      approval_evaluation: approvalEvaluation,
      provenance_completeness: {
        valid: provResult.valid,
        fingerprint: provResult.provenance?.fingerprint || null,
        errors: provResult.errors || []
      },
      errors
    };

    // 8. Persist Sanitized Trace (NON-WRITING to canonical folders; trace file ONLY)
    if (options.writeTrace !== false) {
      this._persistTrace(shadowResult, options);
    }

    return shadowResult;
  }

  _checkDuplicate(normalized, options) {
    const existingIndex = options.existingIndex || this.existingIndex;
    const existingRegistry = options.existingRegistry || this.existingRegistry;

    // Check by content hash
    if (existingIndex && existingIndex.items) {
      for (const [id, item] of Object.entries(existingIndex.items)) {
        if (item.content_hash && item.content_hash === normalized.content_hash) {
          return {
            is_duplicate: true,
            duplicate_type: 'CONTENT_HASH_EXACT',
            matched_id: id,
            matched_repo: item.repository
          };
        }
      }
    }

    // Check by slug / repo match with identical hash
    if (existingRegistry && existingRegistry.records) {
      const records = Array.isArray(existingRegistry.records) 
        ? existingRegistry.records 
        : Object.values(existingRegistry.records);
      for (const rec of records) {
        if (rec.content_hash && rec.content_hash === normalized.content_hash) {
          return {
            is_duplicate: true,
            duplicate_type: 'REGISTRY_HASH_MATCH',
            matched_id: rec.id || rec.record_id,
            matched_repo: rec.repository
          };
        }
      }
    }

    // If candidate explicitly carries duplicate reference
    if (normalized.metadata && normalized.metadata.is_duplicate) {
      return {
        is_duplicate: true,
        duplicate_type: 'METADATA_DECLARED_DUPLICATE',
        matched_id: normalized.metadata.parent_id || null,
        matched_repo: normalized.repository
      };
    }

    return {
      is_duplicate: false,
      duplicate_type: null,
      matched_id: null,
      matched_repo: null
    };
  }

  _persistTrace(traceData, options) {
    try {
      const traceDir = options.traceDir || this.traceDir;
      if (!fs.existsSync(traceDir)) {
        fs.mkdirSync(traceDir, { recursive: true });
      }

      // Strictly sanitize secrets before writing
      const sanitized = sanitizeData(traceData);
      const filename = `${sanitized.trace_id || 'trace-' + Date.now()}.json`;
      const filePath = path.join(traceDir, filename);

      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
      return filePath;
    } catch (err) {
      // Never throw on trace write failure in shadow mode
      console.warn(`[SHADOW EXECUTOR] Failed to persist shadow trace: ${err.message}`);
      return null;
    }
  }
}
