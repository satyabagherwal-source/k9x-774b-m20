/**
 * normalized-input.mjs
 * 
 * NormalizedHarvestInput Contract for Stage D Shared Harvesting Pipeline
 * Normalizes disparate payloads from Cloud Harvester and Manual Harvester
 * into a single unified schema.
 */

import crypto from 'crypto';

export const HARVEST_ORIGINS = {
  CLOUD: 'CLOUD_HARVESTER',
  MANUAL: 'MANUAL_HARVESTER',
  SYNTHETIC: 'SYNTHETIC_FIXTURE'
};

/**
 * Normalizes raw input from either Cloud or Manual harvesters into a unified payload.
 * @param {object} raw 
 * @param {string} origin 
 * @returns {object} NormalizedHarvestInput
 */
export function normalizeHarvestInput(raw, origin = HARVEST_ORIGINS.CLOUD) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('NormalizedHarvestInput requires a non-null raw input object');
  }

  const repo = raw.repository || (raw.owner && raw.repo ? `${raw.owner}/${raw.repo}` : '') || raw.name || 'unknown/repository';
  const sourceUrl = raw.sourceUrl || raw.rawUrl || (repo ? `https://github.com/${repo}` : '');
  const sourceVersion = raw.sourceVersion || raw.commitSha || raw.version || 'HEAD';
  const license = raw.license || 'UNKNOWN';
  const aiProvider = raw.aiProvider || raw.provider || 'system-harvester';
  const dossierText = raw.dossierText || raw.text || raw.content || '';
  const extractedAt = raw.extractedAt || new Date().toISOString();

  // Normalize candidate directives/rules
  const candidates = [];
  const rawRules = raw.candidateRules || raw.candidates || raw.rules || [];

  for (let i = 0; i < rawRules.length; i++) {
    const r = rawRules[i];
    const candidateId = r.candidate_id || r.id || `CD-${crypto.createHash('sha256').update(repo + (r.title || i)).digest('hex').substring(0, 8).toUpperCase()}`;
    candidates.push({
      candidate_id: candidateId,
      title: r.title || `Extracted Rule ${i + 1}`,
      content: r.content || r.body || '',
      summary: r.summary || (r.body ? r.body.substring(0, 200) : ''),
      actionable_instruction: r.actionable_instruction || r.instruction || '',
      tags: Array.isArray(r.tags) ? r.tags : [],
      implementation_evidence_status: r.implementation_evidence_status || 'STATIC_EVIDENCE_ONLY',
      knowledge_transferability_status: r.knowledge_transferability_status || 'TRANSFERABLE_PATTERN_CANDIDATE',
      duplicate_references: Array.isArray(r.duplicate_references) ? r.duplicate_references : [],
      approval_status: r.approval_status || 'PENDING_APPROVAL',
      provenance: {
        upstream_repository: sourceUrl,
        target_source_file: r.target_source_file || r.file_path || 'unknown',
        source_revision: sourceVersion,
        license,
        harvest_origin: origin,
        extracted_at: extractedAt
      },
      evidence: r.evidence || {
        evidence_type: 'HARVESTED_REPOSITORY_ANALYSIS',
        verification_status: 'UNVERIFIED',
        harvest_origin: origin
      }
    });
  }

  // Audit evidence metadata
  const auditEvidence = {
    fix_commits_count: raw.auditEvidence?.fixCommitsCount ?? (raw.fixCommits?.length || 0),
    closed_issues_count: raw.auditEvidence?.closedIssuesCount ?? (raw.closedIssues?.length || 0),
    sample_commits: raw.auditEvidence?.commitsSample || raw.commits?.slice(0, 5) || []
  };

  const payloadString = JSON.stringify({ repo, sourceUrl, sourceVersion, dossierText, candidates });
  const contentHash = crypto.createHash('sha256').update(payloadString).digest('hex');

  return {
    harvest_origin: origin,
    repository: repo,
    source_url: sourceUrl,
    source_version: sourceVersion,
    license,
    ai_provider: aiProvider,
    extracted_at: extractedAt,
    content_hash: contentHash,
    dossier_text: dossierText,
    candidate_directives: candidates,
    audit_evidence: auditEvidence
  };
}

