/**
 * Phase E.1: Baseline Metrics Extractor
 * 
 * Analyzes the existing candidate dataset (697 directives) and production
 * domain registry (74 records) to measure:
 * 1. Exact candidate counts & hashes.
 * 2. 13-domain classification coverage.
 * 3. Unclassified records & root causes.
 * 4. Multi-domain applicability.
 * 5. Proposed destination distribution under legacy router.
 * 6. Domain concentration.
 * 7. Duplicate and conflict rates.
 * 8. Evidence completeness.
 * 9. Unsuitable records for canonical promotion.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { classifyKnowledgeContent } from '../../../../04_WORKFLOWS/factory-engine/domain-classifier.mjs';
import { resolveDestination } from '../../../../04_WORKFLOWS/factory-engine/destination-router.mjs';
import { INTELLIGENCE_DOMAINS } from '../../../../04_WORKFLOWS/factory-engine/domain-intelligence-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..', '..');

export function extractBaselineMetrics() {
  const candPath = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
  const domPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
  const indexPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'knowledge-index.json');
  const graphPath = path.join(BRAIN_ROOT, '.project-brain', 'knowledge-graph', 'relationship-graph.json');
  const patternsPath = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
  const controlPath = path.join(BRAIN_ROOT, 'harvest-control.json');

  const hashFile = (p) => {
    if (!fs.existsSync(p)) return 'MISSING';
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  };

  const hashes = {
    candidateRegistry: { path: '11_INBOX/candidate-directives-registry.json', sha256: hashFile(candPath), size: fs.existsSync(candPath) ? fs.statSync(candPath).size : 0 },
    domainRegistry: { path: '05_KNOWLEDGE/domain-intelligence/domain-registry.json', sha256: hashFile(domPath), size: fs.existsSync(domPath) ? fs.statSync(domPath).size : 0 },
    knowledgeIndex: { path: '05_KNOWLEDGE/knowledge-index.json', sha256: hashFile(indexPath), size: fs.existsSync(indexPath) ? fs.statSync(indexPath).size : 0 },
    relationshipGraph: { path: '.project-brain/knowledge-graph/relationship-graph.json', sha256: hashFile(graphPath), size: fs.existsSync(graphPath) ? fs.statSync(graphPath).size : 0 },
    engineeringPatterns: { path: '05_KNOWLEDGE/engineering-patterns.md', sha256: hashFile(patternsPath), size: fs.existsSync(patternsPath) ? fs.statSync(patternsPath).size : 0 },
    harvestControl: { path: 'harvest-control.json', sha256: hashFile(controlPath), size: fs.existsSync(controlPath) ? fs.statSync(controlPath).size : 0 }
  };

  const candData = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const domData = JSON.parse(fs.readFileSync(domPath, 'utf8'));
  const directives = candData.directives || [];
  const domRecords = Array.isArray(domData)
    ? domData
    : (Array.isArray(domData.records)
      ? domData.records
      : (domData.records ? Object.values(domData.records) : Object.values(domData)));

  // 1. Candidate Counts & Statuses
  const statusCounts = {};
  const sourceTypeCounts = {};
  let withStagedFile = 0;
  let withSourceRepo = 0;
  let withSourceCommit = 0;
  let withRejectionReason = 0;
  let withVerificationCriteria = 0;
  const rejectionReasons = {};

  directives.forEach(d => {
    statusCounts[d.status || 'NO_STATUS'] = (statusCounts[d.status || 'NO_STATUS'] || 0) + 1;
    sourceTypeCounts[d.source_type || 'UNKNOWN'] = (sourceTypeCounts[d.source_type || 'UNKNOWN'] || 0) + 1;
    const fullStagedPath = d.staged_file ? path.join(BRAIN_ROOT, d.staged_file) : null;
    if (fullStagedPath && fs.existsSync(fullStagedPath)) withStagedFile++;
    if (d.source_repo) withSourceRepo++;
    if (d.source_commit) withSourceCommit++;
    if (d.verification_criteria && d.verification_criteria.length > 0) withVerificationCriteria++;
    if (d.reason) {
      withRejectionReason++;
      rejectionReasons[d.reason] = (rejectionReasons[d.reason] || 0) + 1;
    }
  });

  // 2. Candidate 13-Domain Classification & Unclassified Analysis
  const domainCounts = {};
  Object.keys(INTELLIGENCE_DOMAINS).forEach(l => { domainCounts[l] = 0; });
  let unclassifiedCount = 0;
  let multiDomainCount = 0;
  const secondaryDomainCounts = {};
  Object.keys(INTELLIGENCE_DOMAINS).forEach(l => { secondaryDomainCounts[l] = 0; });

  const unclassifiedSamples = [];

  directives.forEach(d => {
    let body = '';
    const fullStagedPath = d.staged_file ? path.join(BRAIN_ROOT, d.staged_file) : null;
    if (fullStagedPath && fs.existsSync(fullStagedPath)) {
      body = fs.readFileSync(fullStagedPath, 'utf8');
    }

    const input = {
      title: d.directive_title || d.title || '',
      content: body || d.reason || '',
      tags: d.trigger_tags || []
    };

    const res = classifyKnowledgeContent(input);
    const primary = res.primaryDomain?.letter || null;

    if (primary) {
      domainCounts[primary] = (domainCounts[primary] || 0) + 1;
    } else {
      unclassifiedCount++;
      if (unclassifiedSamples.length < 10) {
        unclassifiedSamples.push({
          id: d.id,
          title: d.directive_title || d.title,
          reason: d.reason || 'None',
          hasStagedFile: Boolean(fullStagedPath && fs.existsSync(fullStagedPath))
        });
      }
    }

    if (res.secondaryDomains && res.secondaryDomains.length > 0) {
      multiDomainCount++;
      res.secondaryDomains.forEach(s => {
        const letter = s.letter || s;
        if (secondaryDomainCounts[letter] !== undefined) {
          secondaryDomainCounts[letter]++;
        }
      });
    }
  });

  // 3. Candidate Legacy Destination Folder Routing
  const legacyFolderCounts = {};
  directives.forEach(d => {
    let body = '';
    const fullStagedPath = d.staged_file ? path.join(BRAIN_ROOT, d.staged_file) : null;
    if (fullStagedPath && fs.existsSync(fullStagedPath)) {
      body = fs.readFileSync(fullStagedPath, 'utf8');
    }
    const input = {
      title: d.directive_title || d.title || '',
      content: body || d.reason || '',
      tags: d.trigger_tags || [],
      staged_file: d.staged_file,
      status: d.status
    };
    const res = resolveDestination(input);
    const target = res.targetFolder || 'UNROUTED';
    legacyFolderCounts[target] = (legacyFolderCounts[target] || 0) + 1;
  });

  // 4. Duplicate and Conflict Rates
  const titles = new Map();
  let duplicateTitleInstances = 0;
  directives.forEach(d => {
    const t = (d.directive_title || d.title || '').trim().toLowerCase();
    if (!t) return;
    if (titles.has(t)) {
      titles.get(t).push(d.id);
      duplicateTitleInstances++;
    } else {
      titles.set(t, [d.id]);
    }
  });

  const duplicateGroups = [];
  for (const [title, ids] of titles.entries()) {
    if (ids.length > 1) {
      duplicateGroups.push({ title, count: ids.length, ids });
    }
  }

  // 5. Production Domain Registry Baseline
  const domRegCounts = {};
  Object.keys(INTELLIGENCE_DOMAINS).forEach(l => { domRegCounts[l] = 0; });
  domRecords.forEach(r => {
    const letter = r.domain || r.domain_letter || 'UNKNOWN';
    domRegCounts[letter] = (domRegCounts[letter] || 0) + 1;
  });

  // 6. KHU-005 Verification
  const khu005Ids = ['DOM-H-94C4B932', 'DOM-H-2007DF83', 'DOM-H-7D0B9F17', 'DOM-H-C2A738D4', 'DOM-H-1B2AC6F8'];
  const khu005Found = khu005Ids.map(id => {
    const rec = domRecords.find(r => r.id === id || r.record_id === id);
    return { id, preserved: Boolean(rec), title: rec?.title || null };
  });

  return {
    timestamp: new Date().toISOString(),
    hashes,
    candidateTotal: directives.length,
    statusCounts,
    sourceTypeCounts,
    evidenceCompleteness: {
      withStagedFile,
      withSourceRepo,
      withSourceCommit,
      withVerificationCriteria,
      withRejectionReason,
      rejectionReasons
    },
    candidateClassification: {
      domainCounts,
      unclassifiedCount,
      multiDomainCount,
      secondaryDomainCounts,
      unclassifiedSamples
    },
    legacyFolderRouting: legacyFolderCounts,
    duplicates: {
      uniqueTitles: titles.size,
      duplicateTitleInstances,
      duplicateGroupCount: duplicateGroups.length,
      topDuplicates: duplicateGroups.sort((a, b) => b.count - a.count).slice(0, 10)
    },
    domainRegistry: {
      totalRecords: domRecords.length,
      domainCounts: domRegCounts,
      khu005Status: khu005Found,
      khu005Intact: khu005Found.every(k => k.preserved)
    }
  };
}
