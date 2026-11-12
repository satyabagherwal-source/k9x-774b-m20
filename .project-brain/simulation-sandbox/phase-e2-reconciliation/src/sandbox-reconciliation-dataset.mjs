/**
 * Phase E.2: Sandbox Reconciliation Dataset Builder
 * 
 * Compiles the complete 697-candidate reconciliation dataset in pure sandbox:
 * 1. Preserves 100% of all 697 candidate directives with zero deletion.
 * 2. Attaches duplicate group analysis & classifications (33 groups, 125 instances).
 * 3. Attaches rejected candidate evidence recovery data (394 records).
 * 4. Injects 13-domain classification & 16-folder proposed destinations.
 * 5. Formulates proposed merge recommendations purely as review artifacts.
 * 6. Asserts 100% preservation of all 5 pending KHU-005 Zod records.
 * 
 * STRICT INVARIANT: ZERO production modifications. ZERO automatic merges or deletions.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { analyzeDuplicateGroups } from './duplicate-analyzer.mjs';
import { recoverRejectedCandidates } from './rejected-candidate-recoverer.mjs';
import { IsolatedDistributionEngine } from '../../phase-e-distribution/src/isolated-distribution-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

export function buildReconciliationDataset() {
  const candPath = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
  const domPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');

  const candData = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const domData = JSON.parse(fs.readFileSync(domPath, 'utf8'));

  const directives = candData.directives || [];
  const domRecords = Array.isArray(domData) ? domData : (domData.records ? Object.values(domData.records) : Object.values(domData));

  // Run Sub-Analyses
  const duplicateAnalysis = analyzeDuplicateGroups();
  const recoveryAnalysis = recoverRejectedCandidates();
  const engine = new IsolatedDistributionEngine();

  // Create lookup maps
  const dupeItemMap = new Map();
  duplicateAnalysis.duplicateGroups.forEach(grp => {
    grp.itemIds.forEach(id => {
      dupeItemMap.set(id, {
        groupId: grp.groupId,
        groupTitle: grp.title,
        category: grp.category,
        totalInGroup: grp.itemCount,
        rationale: grp.rationale,
        recommendation: grp.recommendation
      });
    });
  });

  const recoveryMap = new Map();
  recoveryAnalysis.recoveredRecords.forEach(rec => {
    recoveryMap.set(rec.id, rec);
  });

  // Verify KHU-005 records intact
  const khu005Ids = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];
  const khu005Preserved = khu005Ids.every(id => domRecords.some(r => r.id === id || r.record_id === id));

  // Build reconciled records
  const reconciledRecords = directives.map((d, index) => {
    // 1. Classification & Routing
    const classification = engine.classifyMultiDomain({
      title: d.directive_title || d.title,
      content: d.reason || '',
      tags: d.trigger_tags || []
    });

    const routing = engine.resolveCanonicalDestination({
      title: d.directive_title || d.title,
      content: d.reason || '',
      tags: d.trigger_tags || [],
      status: d.status,
      knowledgeType: d.source_type === 'chat_master_prompt' ? 'core_law' : 'candidate_directive'
    }, classification);

    // 2. Duplicate Information
    const dupeInfo = dupeItemMap.get(d.id) || {
      groupId: null,
      category: 'UNIQUE_RECORD',
      totalInGroup: 1,
      recommendation: 'STANDALONE_RECORD'
    };

    // 3. Recovery Information
    const recInfo = recoveryMap.get(d.id) || null;

    return {
      reconciliationIndex: index + 1,
      directiveId: d.id,
      title: d.directive_title || d.title,
      status: d.status || 'STAGED_FOR_VERIFICATION',
      sourceType: d.source_type || 'UNKNOWN',
      provenance: {
        sourceRepo: d.source_repo || null,
        sourceCommit: d.source_commit || null,
        author: d.author || null,
        dateStaged: d.date_staged || null,
        stagedFile: d.staged_file || null,
        learningId: d.learning_id || null,
        parentDossier: recInfo?.sourceProvenance?.dossierPath || null
      },
      duplicateAnalysis: {
        isDuplicateInstance: dupeInfo.groupId !== null,
        groupId: dupeInfo.groupId,
        duplicateCategory: dupeInfo.category,
        groupItemCount: dupeInfo.totalInGroup,
        recommendation: dupeInfo.recommendation
      },
      evidenceRecovery: recInfo ? {
        gatewayRejectionReason: recInfo.gatewayRejectionReason,
        rejectionCategory: recInfo.rejectionCategory,
        missingEvidence: recInfo.missingEvidence,
        recoveryConfidence: recInfo.confidence,
        recommendedDisposition: recInfo.recommendedDisposition
      } : {
        gatewayRejectionReason: null,
        rejectionCategory: 'NOT_REJECTED_CLEAN_CANDIDATE',
        missingEvidence: null,
        recoveryConfidence: 1.0,
        recommendedDisposition: 'ACTIVE_CANDIDATE_DIRECTIVE'
      },
      proposedTaxonomy: {
        primaryDomain: classification.primaryDomain?.letter || 'UNCLASSIFIED',
        primaryDomainName: classification.primaryDomain?.name || 'Unclassified Candidate',
        secondaryDomains: classification.secondaryDomains.map(s => s.letter),
        confidence: classification.confidence,
        targetCanonicalFolder: routing.targetFolder,
        suggestedRelativePath: routing.suggestedRelativePath,
        requiresHumanApproval: routing.requiresHumanApproval
      }
    };
  });

  const dataset = {
    metadata: {
      missionId: 'UKD-PHASE-E2-CANDIDATE-RECONCILIATION-01',
      timestamp: new Date().toISOString(),
      governingPrinciples: [
        'ZERO_DELETION_OF_RAW_CANDIDATES',
        'ZERO_AUTOMATIC_MERGES_WITHOUT_HUMAN_SIGN_OFF',
        'PROVENANCE_IMMUTABILITY',
        'KHU_005_PRESERVATION'
      ],
      totalCandidatesInput: directives.length,
      totalCandidatesReconciled: reconciledRecords.length,
      khu005Intact: khu005Preserved,
      duplicateGroupsIdentified: duplicateAnalysis.duplicateGroupsCount,
      excessDuplicateInstances: duplicateAnalysis.excessDuplicateInstances,
      rejectedCandidatesAnalyzed: recoveryAnalysis.totalRejected
    },
    duplicateSummary: {
      categoryCounts: duplicateAnalysis.categoryCounts,
      groups: duplicateAnalysis.duplicateGroups
    },
    recoverySummary: {
      reasonCensus: recoveryAnalysis.reasonCensus,
      dispositionCounts: recoveryAnalysis.dispositionCounts,
      dossierBackingRate: recoveryAnalysis.dossierBackingRate
    },
    reconciledRecords
  };

  const outPath = path.join(__dirname, '..', 'data', 'reconciliation-dataset-697.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf8');

  return {
    outPath,
    recordCount: reconciledRecords.length,
    dataset
  };
}

