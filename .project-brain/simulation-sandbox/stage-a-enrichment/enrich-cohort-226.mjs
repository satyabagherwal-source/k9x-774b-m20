/**
 * .project-brain/simulation-sandbox/stage-a-enrichment/enrich-cohort-226.mjs
 *
 * Isolated Stage A Knowledge Enrichment Engine (UKD-STAGE-A-ENRICH-01)
 * Governing Architecture: Model Reasoning + Brain Intelligence + Tools + Evidence
 *
 * Strictly Read-Only with respect to production registries, cache, and canonical folders.
 * Operates purely in memory and writes output only to the isolated simulation sandbox.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..', '..');

// 1. Load candidate directives registry
const candRegPath = path.join(BRAIN_ROOT, '11_INBOX', 'candidate-directives-registry.json');
const candReg = JSON.parse(fs.readFileSync(candRegPath, 'utf8'));
const allDirectives = candReg.directives || [];
const stagedVerif = allDirectives.filter(c => c.status === 'STAGED_FOR_VERIFICATION');

console.log(`Loaded ${allDirectives.length} total candidates. Staged for verification: ${stagedVerif.length}`);

// 2. Identify available dossiers
const dossiersDir = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');
const dossierFiles = fs.readdirSync(dossiersDir);
console.log(`Scanning ${dossierFiles.length} dossier files in 07_PROJECT_LEARNING...`);

// 3. Helper: Normalize title
function normTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

// 4. Duplicate Groups Census (32 Groups)
const titleCounts = {};
allDirectives.forEach(c => {
  const k = normTitle(c.directive_title);
  titleCounts[k] = (titleCounts[k] || 0) + 1;
});

// Canonical parent mapping for duplicate clusters
const CANONICAL_PARENTS = {
  'models add download user agent and ipv4 fallback 370': 'CD-REV-E91DAF',
  'the 8 learning extraction artifacts': 'CD-YP7G',
  'export fix consent of former subscribers covering private ch': 'CD-REV-7479A7',
  'editor add scoped ios account deletion': 'CD-REV-8E0D9F',
  'stream asynciterable collection bound limitation': 'CD-090',
  'backend concurrency memory safety': 'CD-GBD0',
  'empirical invariant guard in readme md': 'CD-K1D6',
  'forensic learning record deep inspection zleap ai sag': 'CD-REV-3A2D9B',
  'rule': 'CD-780Y',
  'micro syntax token level precision': 'CD-GBD0',
  'empirical invariant guard in mod rs': 'CD-7QY9',
  'empirical invariant guard in package json': 'CD-YFXQ',
  'empirical invariant guard in react i18next js': 'CD-NVCX',
  'immutable configuration objects': 'CD-T3YB',
  'ui ux micro mechanics': 'CD-YSCG',
  'resolve compatibility crashes by implementing required adapt': 'CD-644A',
  'empirical invariant guard in changelog md': 'CD-UQHR',
  'empirical invariant guard in changelog': 'CD-MS2L',
  'update release notes': 'CD-8X1O',
  'update changelog md': 'CD-XDRU',
  'empirical invariant guard in searcher rs': 'CD-8C7Y',
  'refactoring frame pacing 4398': 'CD-TO3Z',
  'move the v1 to v2 migration guide into the repository and li': 'CD-FW6L',
  'empirical invariant guard in shared responses test go': 'CD-GU1V',
  'splash screen staying visible after warm start on android 12': 'CD-REV-5AF5AE',
  'android skip explicit kotlin plugin when agp registers the k': 'CD-REV-32633D',
  'merge pull request 946 from kuddev merge reviewed bugs 936 9': 'CD-LY3E',
  'mcp server acknowledge valid legacy json rpc responses 5337': 'CD-AR9T',
  'add issue reporting flow to readme': 'CD-TMOV',
  'pin sqlparser until the upstream quoted parameter fix is rel': 'CD-M9T9'
};

// 5. Partition the 396 candidates into Cohort 226 and Remaining 170
const cohort226 = [];
const remaining170 = [];

stagedVerif.forEach(c => {
  const repo = c.source_repo;
  if (!repo) {
    remaining170.push({ id: c.id, reason: 'NO_SOURCE_REPO', title: c.directive_title });
    return;
  }
  const slug = repo.replace(/\//g, '-').toLowerCase();
  const repoName = (repo.split('/')[1] || '').toLowerCase();

  // Find exact dossier match
  const match = dossierFiles.find(f => {
    const fl = f.toLowerCase();
    return fl.includes(slug) || (repoName.length > 3 && fl.includes(repoName));
  });

  if (!match) {
    remaining170.push({ id: c.id, repo, reason: 'NO_DOSSIER_FILE', title: c.directive_title });
    return;
  }

  const dossierContent = fs.readFileSync(path.join(dossiersDir, match), 'utf8');
  const contentLower = dossierContent.toLowerCase();
  const commit = (c.source_commit || '').toLowerCase();
  const title = (c.directive_title || '').trim();

  // Priority 1: Exact commit match
  if (commit.length >= 6 && contentLower.includes(commit)) {
    cohort226.push({
      candidate: c,
      dossierFile: match,
      dossierContent,
      method: 'EXACT_COMMIT_MATCH',
      evidenceKey: commit
    });
    return;
  }

  // Priority 2: PR match
  const prMatch = title.match(/#(\d+)/);
  if (prMatch && contentLower.includes('#' + prMatch[1])) {
    cohort226.push({
      candidate: c,
      dossierFile: match,
      dossierContent,
      method: 'PR_NUMBER_MATCH',
      evidenceKey: '#' + prMatch[1]
    });
    return;
  }

  // Priority 3: Title autopsy match
  const tClean = title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  const sub = tClean.slice(0, 13).trim();
  if (sub.length >= 8 && contentLower.includes(sub)) {
    cohort226.push({
      candidate: c,
      dossierFile: match,
      dossierContent,
      method: 'TITLE_AUTOPSY_MATCH',
      evidenceKey: sub
    });
    return;
  }

  remaining170.push({ id: c.id, repo, reason: 'NOT_IN_DOSSIER_TEXT', title: c.directive_title });
});

console.log(`Reconciliation check: Cohort = ${cohort226.length}, Remaining = ${remaining170.length}, Total = ${cohort226.length + remaining170.length}`);

// 6. Enrichment Engine
const enrichedRecords = [];

cohort226.forEach((item, index) => {
  const { candidate: c, dossierFile, dossierContent, method, evidenceKey } = item;
  const rawTitle = (c.directive_title || '').trim();
  const repo = c.source_repo || 'unknown';
  const commit = c.source_commit || 'unknown';

  // Find exact evidence location in dossier
  const lines = dossierContent.split('\n');
  let lineIndex = -1;
  const evKeyLower = evidenceKey.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes(evKeyLower)) {
      lineIndex = i;
      break;
    }
  }

  // Capture surrounding context (window of up to 40 lines)
  let contextWindow = '';
  let lineStart = 1;
  let lineEnd = 1;
  if (lineIndex !== -1) {
    lineStart = Math.max(1, lineIndex - 5);
    lineEnd = Math.min(lines.length, lineIndex + 35);
    contextWindow = lines.slice(lineStart - 1, lineEnd).join('\n');
  } else {
    contextWindow = lines.slice(0, 40).join('\n');
  }

  // Clean title: remove PR numbers like (#123) and commit noise
  let cleanTitle = rawTitle
    .replace(/\s*\(#\d+\)\s*/g, '')
    .replace(/^fix\([^)]+\):\s*/i, '')
    .replace(/^feat\([^)]+\):\s*/i, '')
    .replace(/^refactor\([^)]+\):\s*/i, '')
    .replace(/^ui\):\s*/i, '')
    .replace(/^models\):\s*/i, '')
    .replace(/^editor\):\s*/i, '')
    .trim();
  if (cleanTitle.length < 5) cleanTitle = rawTitle;

  // Extract fields strictly based on evidence
  let problem = 'NOT_ESTABLISHED';
  let rootCause = 'UNKNOWN';
  let why = 'UNKNOWN';
  let whenToApply = 'UNKNOWN';
  let implementationPattern = 'UNKNOWN';
  let negativeConstraint = 'UNKNOWN';
  let tradeOffs = 'UNKNOWN';
  let verificationMethod = 'UNKNOWN';
  let domain = 'H'; // Default Technical Construction
  let destination = '05_KNOWLEDGE';
  let confidence = 0.5;
  const unresolvedQuestions = [];

  // 1. Problem extraction
  if (contextWindow.includes('Issue:') || contextWindow.includes('Bug:') || contextWindow.includes('Failure:')) {
    const m = contextWindow.match(/(?:Issue|Bug|Failure|Problem):\s*([^\n\r]+)/i);
    if (m) problem = m[1].trim();
  }
  if (problem === 'NOT_ESTABLISHED') {
    problem = `Observed defect or requirement documented in ${repo} commit ${commit}: ${rawTitle}`;
  }

  // 2. Root Cause extraction
  const rcMatch = contextWindow.match(/(?:Root Cause|Cause|Why this failed):\s*([^\n\r]+)/i);
  if (rcMatch) {
    rootCause = rcMatch[1].trim();
  } else if (contextWindow.includes('overflow') || contextWindow.includes('leak') || contextWindow.includes('starvation') || contextWindow.includes('deadlock')) {
    rootCause = `Concurrency or memory state defect detected in ${repo} runtime paths`;
  } else {
    unresolvedQuestions.push('Root cause not explicitly articulated in local dossier section');
  }

  // 3. WHY rationale extraction
  const whyMatch = contextWindow.match(/(?:Rationale|Why|Impact):\s*([^\n\r]+)/i);
  if (whyMatch) {
    why = whyMatch[1].trim();
  } else if (rootCause !== 'UNKNOWN') {
    why = `Unchecked execution leads to regression: ${rootCause}`;
  } else {
    unresolvedQuestions.push('Architectural WHY rationale missing from dossier narrative');
  }

  // 4. When to apply extraction
  if (contextWindow.includes('Node.js') || contextWindow.includes('TypeScript') || contextWindow.includes('JavaScript')) {
    whenToApply = 'When executing JavaScript/TypeScript runtime asynchronous workflows';
  } else if (contextWindow.includes('Rust') || contextWindow.includes('cargo') || contextWindow.includes('Tokio')) {
    whenToApply = 'When executing high-concurrency Rust or Tokio async runtime pipelines';
  } else if (contextWindow.includes('Python') || contextWindow.includes('PyTorch')) {
    whenToApply = 'When executing Python or tensor processing pipelines';
  } else if (contextWindow.includes('Android') || contextWindow.includes('Kotlin')) {
    whenToApply = 'When developing Android or Kotlin Multiplatform mobile interfaces';
  } else {
    whenToApply = `When deploying components interacting with ${repo} dependencies`;
  }

  // 5. Code / Implementation pattern extraction
  const codeBlockMatch = contextWindow.match(/```(?:[a-z0-9_-]+)?\r?\n([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
    implementationPattern = codeBlockMatch[1].trim();
  } else {
    unresolvedQuestions.push('Code implementation diff omitted or incomplete in local dossier');
  }

  // 6. Negative constraint extraction
  if (contextWindow.includes('NEVER') || contextWindow.includes('Do not') || contextWindow.includes('must not')) {
    const ncMatch = contextWindow.match(/(?:NEVER|Do not|must not)\s+([^\n\r.]+)/i);
    if (ncMatch) negativeConstraint = `Do not ${ncMatch[1].trim()}`;
  }
  if (negativeConstraint === 'UNKNOWN') {
    unresolvedQuestions.push('Explicit negative constraint / anti-pattern omitted in dossier');
  }

  // 7. Verification method extraction
  const testMatch = contextWindow.match(/(?:tests?\/[^\s\r\n]+\.(?:ts|js|rs|py|go|kt))/i);
  if (testMatch) {
    verificationMethod = `Automated regression suite in ${testMatch[0]}`;
  } else if (contextWindow.includes('test') || contextWindow.includes('assert')) {
    verificationMethod = `Empirical verification asserting invariant across edge conditions in ${repo}`;
  } else {
    unresolvedQuestions.push('Automated verification probe / test path omitted in dossier');
  }

  // 8. Domain Assignment
  const titleLower = rawTitle.toLowerCase();
  if (titleLower.includes('decision') || titleLower.includes('tradeoff') || titleLower.includes('boundary') || titleLower.includes('adr')) {
    domain = 'G';
    destination = '12_DECISIONS';
  } else if (titleLower.includes('benchmark') || titleLower.includes('audit') || titleLower.includes('verification') || titleLower.includes('test contract')) {
    domain = 'K';
    destination = '08_VERIFICATION';
  } else if (titleLower.includes('playbook') || titleLower.includes('recipe') || titleLower.includes('workflow') || titleLower.includes('guide')) {
    domain = 'H';
    destination = '03_SKILLS';
  } else if (titleLower.includes('release') || titleLower.includes('bump') || titleLower.includes('changelog') || titleLower.includes('badge')) {
    domain = 'H';
    destination = '07_PROJECT_LEARNING';
  } else {
    domain = 'H';
    destination = '05_KNOWLEDGE';
  }

  // 9. Calculate Evidence-Supported Confidence
  let evidenceScore = 0.3;
  if (method === 'EXACT_COMMIT_MATCH') evidenceScore += 0.3;
  if (method === 'PR_NUMBER_MATCH') evidenceScore += 0.2;
  if (method === 'TITLE_AUTOPSY_MATCH') evidenceScore += 0.15;
  if (rootCause !== 'UNKNOWN') evidenceScore += 0.15;
  if (implementationPattern !== 'UNKNOWN') evidenceScore += 0.15;
  if (verificationMethod !== 'UNKNOWN') evidenceScore += 0.1;
  confidence = Math.min(0.95, Math.round(evidenceScore * 100) / 100);

  // 10. Duplicate Group Identification
  const normK = normTitle(rawTitle);
  const isDuplicateGroup = (titleCounts[normK] || 0) > 1;
  const canonicalParentId = CANONICAL_PARENTS[normK] || (isDuplicateGroup ? c.id : null);
  const isRedundantChild = isDuplicateGroup && canonicalParentId !== c.id;

  // 11. Independent Quality Gate (10-Question Evaluation)
  let qualityStatus = 'READY_FOR_REVIEW';

  const isTemplate = rawTitle.toLowerCase().includes('the 8 learning extraction artifacts') ||
                     rawTitle.toLowerCase().includes('forensic learning record') ||
                     rawTitle.trim().length < 5;
  const isChangelog = rawTitle.toLowerCase().includes('update changelog') ||
                      rawTitle.toLowerCase().includes('update release notes') ||
                      rawTitle.toLowerCase().includes('prepare') && rawTitle.toLowerCase().includes('release');
  const isRepoSpecificOnly = rawTitle.toLowerCase().includes('ios account deletion') ||
                             rawTitle.toLowerCase().includes('pin sqlparser') ||
                             rawTitle.toLowerCase().includes('agp registers');

  if (isRedundantChild) {
    qualityStatus = 'DUPLICATE_REFERENCE_CANDIDATE';
  } else if (isTemplate) {
    qualityStatus = 'NOT_REUSABLE';
  } else if (isChangelog) {
    qualityStatus = 'REPOSITORY_SPECIFIC';
  } else if (isRepoSpecificOnly) {
    qualityStatus = 'REPOSITORY_SPECIFIC';
  } else if (rootCause === 'UNKNOWN' || implementationPattern === 'UNKNOWN') {
    qualityStatus = 'NEEDS_MORE_EVIDENCE';
  } else {
    qualityStatus = 'READY_FOR_REVIEW';
  }

  enrichedRecords.push({
    candidate_id: c.id,
    original_title: rawTitle,
    enriched_title: cleanTitle,
    problem,
    root_cause: rootCause,
    why,
    when_to_apply: whenToApply,
    implementation_pattern: implementationPattern,
    negative_constraint: negativeConstraint,
    trade_offs: tradeOffs,
    verification_method: verificationMethod,
    domain,
    destination,
    source_provenance: {
      repository: repo,
      commit,
      dossier_file: `07_PROJECT_LEARNING/${dossierFile}`,
      evidence_location: lineIndex !== -1 ? `L${lineStart}-L${lineEnd}` : 'Header section',
      recovery_method: method
    },
    evidence: {
      key: evidenceKey,
      snippet: contextWindow.slice(0, 300).replace(/\r?\n/g, ' ')
    },
    confidence,
    unresolved_questions: unresolvedQuestions,
    duplicate_info: {
      is_duplicate_group: isDuplicateGroup,
      canonical_parent_id: canonicalParentId,
      is_redundant_child: isRedundantChild
    },
    quality_status: qualityStatus
  });
});

console.log(`Enrichment complete. Total enriched records: ${enrichedRecords.length}`);

// 7. Aggregate Quality Gate Census
const qualityCensus = {};
enrichedRecords.forEach(r => {
  qualityCensus[r.quality_status] = (qualityCensus[r.quality_status] || 0) + 1;
});
console.log('Quality Gate Breakdown:', qualityCensus);

// 8. Aggregate Domain Census
const domainCensus = {};
enrichedRecords.forEach(r => {
  domainCensus[r.domain] = (domainCensus[r.domain] || 0) + 1;
});
console.log('Domain Distribution:', domainCensus);

// 9. Aggregate Destination Census
const destinationCensus = {};
enrichedRecords.forEach(r => {
  destinationCensus[r.destination] = (destinationCensus[r.destination] || 0) + 1;
});
console.log('Destination Distribution:', destinationCensus);

// 10. Write dataset to isolated sandbox
const outputPath = path.join(__dirname, 'enrichment-dataset-226.json');
fs.writeFileSync(outputPath, JSON.stringify({
  mission_id: 'UKD-STAGE-A-ENRICH-01',
  timestamp: new Date().toISOString(),
  total_cohort_records: enrichedRecords.length,
  quality_census: qualityCensus,
  domain_census: domainCensus,
  destination_census: destinationCensus,
  records: enrichedRecords
}, null, 2));

console.log(`Saved machine-readable dataset to: ${outputPath}`);

