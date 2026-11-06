/**
 * Cross-Repository Learning & Semantic Corroboration Engine (URE v0.3)
 *
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\cross-repository-corroboration-engine.mjs
 * Purpose: Aggregates candidate engineering patterns across multiple independent repositories,
 *          performs semantic equivalence normalization, detects independent vs mirrored/copied
 *          sources, evaluates contextual divergence vs direct conflicts, and gates canonical
 *          promotion via HIQV (Harvested Intelligence Quality Validator).
 *
 * Zero external runtime dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  analyzeRepository,
  URE_VERSION
} from './universal-repository-learning-engine.mjs';

import {
  validateHarvestedIntelligence,
  verifyReportIntegrity,
  VALIDATOR_DECISIONS,
  DIMENSION_STATUS
} from './harvested-intelligence-quality-validator.mjs';

import {
  createEvidenceRecord,
  validateEvidenceRecord,
  evaluateEvidenceCorroboration,
  assessContextualContradiction,
  INDEPENDENCE_TIERS,
  EVIDENCE_TYPES,
  EVIDENCE_STATUS,
  VERIFICATION_METHODS
} from './knowledge-intelligence-engine.mjs';

import { detectDirectiveOpposition } from './knowledge-acquisition-pipeline.mjs';
import { getBrainPaths, promoteValidatedRules } from './brain-learning-gateway.mjs';
import { buildSearchIndex, searchBrain } from './retrieval-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const CORROBORATION_ENGINE_VERSION = '0.3.0';

/**
 * Corroboration status classifications
 */
export const CORROBORATION_STATUS = {
  CORROBORATED: 'CORROBORATED',             // >= 2 independent sources, zero direct conflict
  SINGLE_SOURCE: 'SINGLE_SOURCE',           // 1 effective source (retained as CONDITIONAL_PASS)
  COPIED_OR_MIRRORED: 'COPIED_OR_MIRRORED', // Multiple repos but collapsed due to mirroring / fork
  CONFLICTING: 'CONFLICTING',               // Opposing directive detected (quarantined)
  CONTEXT_DIVERGENT: 'CONTEXT_DIVERGENT'    // Divergent runtime context (preserved boundary)
};

/**
 * SHA-256 helper
 */
function sha256(str) {
  return crypto.createHash('sha256').update(String(str), 'utf8').digest('hex');
}

/**
 * Normalizes pattern candidate text and extracts core invariant concepts
 *
 * @param {object} pattern - Candidate pattern from repository analysis
 * @returns {object} Normalized pattern representation
 */
export function normalizePatternForComparison(pattern = {}) {
  const title = (pattern.title || '').trim();
  const statement = (pattern.statement || pattern.rule || pattern.generalizable_invariant || '').trim();
  const why = (pattern.why || '').trim();
  const negative = (pattern.negative_constraint || '').trim();
  const category = (pattern.category || 'ENGINEERING_PATTERN').trim();
  const context = (pattern.context_constraints || '').trim();

  // Combine key text for semantic token extraction
  const fullText = `${title} ${statement} ${why} ${negative} ${context}`.toLowerCase();

  // Extract concept tags
  const conceptTags = new Set();

  if (/(?:sigterm|sigint|graceful|shutdown|socket|connection[s]?\s+drain|process\.on)/i.test(fullText)) {
    conceptTags.add('graceful_process_shutdown');
  }
  if (/(?:health|readiness|liveness|probe|503|200\s+ok|buffer\s+saturated|queue\s+threshold)/i.test(fullText)) {
    conceptTags.add('readiness_health_probe');
  }
  if (/(?:circuit[_\s-]?breaker|fallback|trip|half[_\s-]?open|failure\s+threshold)/i.test(fullText)) {
    conceptTags.add('circuit_breaker_resilience');
  }
  if (/(?:schema|zod|validation|sanitize|boundary|untrusted\s+input)/i.test(fullText)) {
    conceptTags.add('input_boundary_validation');
  }
  if (/(?:rate[_\s-]?limit|token[_\s-]?bucket|throttl|429)/i.test(fullText)) {
    conceptTags.add('rate_limiting_concurrency');
  }
  if (/(?:retry|exponential[_\s-]?backoff|jitter|transient\s+error)/i.test(fullText)) {
    conceptTags.add('retry_with_backoff');
  }
  if (/(?:idempotency|idempotent|replay|dedup)/i.test(fullText)) {
    conceptTags.add('idempotent_operation');
  }

  // Extract runtime environment context
  const runtimeContext = [];
  if (/(?:serverless|lambda|cloud\s+function|edge\s+worker|stateless\s+invocation)/i.test(fullText)) {
    runtimeContext.push('serverless');
  }
  if (/(?:daemon|microservice|container|kubernetes|long[_\s-]?running|docker)/i.test(fullText)) {
    runtimeContext.push('containerized_daemon');
  }
  if (/(?:cli|command[_\s-]?line|one[_\s-]?shot|batch\s+script)/i.test(fullText)) {
    runtimeContext.push('cli_tool');
  }

  // Significant word tokens (length >= 4, excluding common stopwords)
  const stopwords = new Set([
    'this', 'that', 'with', 'from', 'when', 'then', 'must', 'should', 'have',
    'will', 'node', 'code', 'file', 'path', 'test', 'repo', 'using', 'return',
    'application', 'service', 'system', 'before', 'after', 'where', 'which'
  ]);

  const rawTokens = fullText
    .replace(/[^a-z0-9_\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !stopwords.has(t));

  const uniqueTokens = Array.from(new Set(rawTokens));

  return {
    raw_pattern: pattern,
    title,
    statement,
    why,
    negative_constraint: negative,
    category,
    context_constraints: context,
    concept_tags: Array.from(conceptTags),
    runtime_context: runtimeContext,
    tokens: uniqueTokens
  };
}

/**
 * Computes semantic similarity between two pattern candidates
 *
 * @param {object} patA - First pattern
 * @param {object} patB - Second pattern
 * @returns {object} Similarity assessment { score, isEquivalent, sharedConcepts, reason }
 */
export function computePatternSemanticSimilarity(patA, patB) {
  const normA = normalizePatternForComparison(patA);
  const normB = normalizePatternForComparison(patB);

  // 1. Concept Tag Intersection
  const sharedConcepts = normA.concept_tags.filter(c => normB.concept_tags.includes(c));
  const hasSharedConcept = sharedConcepts.length > 0;

  // 2. Token Jaccard Index
  const setA = new Set(normA.tokens);
  const setB = new Set(normB.tokens);

  const intersection = normA.tokens.filter(t => setB.has(t));
  const union = new Set([...normA.tokens, ...normB.tokens]);
  const jaccard = union.size > 0 ? intersection.length / union.size : 0.0;

  // 3. Category match
  const categoryMatch = normA.category.toLowerCase() === normB.category.toLowerCase();

  // Weighted overall semantic similarity score
  let score = 0.0;
  if (hasSharedConcept) {
    score += 0.65; // Dominant weight: share identical invariant concept tag
  }
  score += jaccard * 0.25;
  if (categoryMatch) {
    score += 0.10;
  }

  // Equivalence determination
  // Must share at least one core engineering concept tag and score >= 0.60
  const isEquivalent = hasSharedConcept && score >= 0.60;

  return {
    score: Math.min(1.0, Number(score.toFixed(3))),
    isEquivalent,
    sharedConcepts,
    jaccard: Number(jaccard.toFixed(3)),
    reason: isEquivalent
      ? `Semantically equivalent invariant: shared concept [${sharedConcepts.join(', ')}] with score ${score.toFixed(2)}`
      : `Distinct patterns: score ${score.toFixed(2)} (shared concepts: ${sharedConcepts.length})`
  };
}

/**
 * Groups candidate patterns from multiple repository intelligence packages into semantic clusters
 *
 * @param {Array<object>} repoPackages - List of URE intelligence packages
 * @param {object} options - Options
 * @returns {Array<object>} List of pattern clusters
 */
export function clusterCrossRepositoryPatterns(repoPackages = [], options = {}) {
  // Collect all patterns with their source repo metadata
  const allCandidates = [];

  for (const pkg of repoPackages) {
    const repoManifest = pkg.repository_manifest || { name: 'unknown-repo', path: '' };
    const patterns = pkg.reusable_construction_patterns || [];

    for (const pat of patterns) {
      allCandidates.push({
        ...pat,
        repo_name: repoManifest.name,
        repo_path: repoManifest.path,
        repo_license: repoManifest.license,
        repo_vcs: repoManifest.vcs
      });
    }
  }

  const clusters = [];

  for (const cand of allCandidates) {
    let matchedCluster = null;

    for (const cluster of clusters) {
      // Compare against representative pattern in cluster
      const sim = computePatternSemanticSimilarity(cluster.representative, cand);
      if (sim.isEquivalent) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.patterns.push(cand);
      if (cand.concept_tags) {
        for (const t of cand.concept_tags) matchedCluster.concept_tags.add(t);
      }
    } else {
      const norm = normalizePatternForComparison(cand);
      clusters.push({
        cluster_id: `CLUSTER-${sha256(cand.title + cand.statement).slice(0, 8)}`,
        title: cand.title,
        statement: cand.statement,
        representative: cand,
        concept_tags: new Set(norm.concept_tags),
        patterns: [cand]
      });
    }
  }

  // Convert Set to Array
  return clusters.map(c => ({
    ...c,
    concept_tags: Array.from(c.concept_tags)
  }));
}

/**
 * Cross-analyzes patterns across multiple repositories, validates multi-source
 * corroboration, collapses mirrored/forked sources, and detects contradictions.
 *
 * @param {Array<object>} repoPackages - Array of repository intelligence packages
 * @param {object} options - Options
 * @returns {object} Corroboration results
 */
export function corroborateMultiRepositoryPatterns(repoPackages = [], options = {}) {
  const clusters = clusterCrossRepositoryPatterns(repoPackages, options);

  const corroboratedPatterns = [];
  const singleSourcePatterns = [];
  const copiedPatterns = [];
  const conflictedPatterns = [];
  const contextDivergentPatterns = [];

  for (const cluster of clusters) {
    const clusterPatterns = cluster.patterns;
    const clusterTitle = cluster.title;

    // 1. Gather all evidence records across all repositories in this cluster
    const aggregatedEvidence = [];
    const contributingRepos = new Set();

    for (const p of clusterPatterns) {
      contributingRepos.add(p.repo_name);
      if (Array.isArray(p.evidence_list)) {
        for (const ev of p.evidence_list) {
          aggregatedEvidence.push(ev);
        }
      }
    }

    // 2. Perform Phase F Evidence Corroboration Assessment
    const claimId = `CLAIM-${cluster.cluster_id}`;
    const corroborationReport = evaluateEvidenceCorroboration(claimId, aggregatedEvidence, options);

    // 3. Contradiction & Opposition Assessment
    // Compare patterns against each other within cluster and against external anti-patterns
    let hasDirectConflict = false;
    let conflictDetail = null;
    let hasContextDivergence = false;
    let contextDivergenceDetail = null;

    // Inspect each pair of patterns in cluster for internal opposition
    for (let i = 0; i < clusterPatterns.length; i++) {
      for (let j = i + 1; j < clusterPatterns.length; j++) {
        // Check runtime environment context divergence first
        const normA = normalizePatternForComparison(clusterPatterns[i]);
        const normB = normalizePatternForComparison(clusterPatterns[j]);
        const runtimeA = normA.runtime_context;
        const runtimeB = normB.runtime_context;
        const isDisjointRuntime = (
          (runtimeA.includes('serverless') && !runtimeB.includes('serverless') && runtimeB.includes('containerized_daemon')) ||
          (runtimeB.includes('serverless') && !runtimeA.includes('serverless') && runtimeA.includes('containerized_daemon')) ||
          (runtimeA.includes('cli_tool') && !runtimeB.includes('cli_tool') && runtimeB.includes('containerized_daemon')) ||
          (runtimeB.includes('cli_tool') && !runtimeA.includes('cli_tool') && runtimeA.includes('containerized_daemon'))
        );

        if (isDisjointRuntime) {
          hasContextDivergence = true;
          contextDivergenceDetail = `Disjoint runtime execution environments: [${runtimeA.join(',')}] vs [${runtimeB.join(',')}]`;
          continue; // Context divergence explains the difference; do not treat as an opposing contradiction!
        }

        const contra = assessContextualContradiction(clusterPatterns[i], clusterPatterns[j], options);
        if (contra.conflict && contra.conflict_type === 'CONFIRMED_DIRECT_CONFLICT') {
          hasDirectConflict = true;
          conflictDetail = {
            patA: clusterPatterns[i].title,
            patB: clusterPatterns[j].title,
            reason: contra.reason
          };
          break;
        } else if (contra.conflict_type === 'DIFFERENT_CONTEXT_OR_VERSION') {
          hasContextDivergence = true;
          contextDivergenceDetail = contra.reason;
        }

        // Additional semantic negative constraint check:
        // Does pattern A's negative constraint forbid pattern B's prescribed behavior (or vice versa)?
        const negA = (clusterPatterns[i].negative_constraint || '').toLowerCase();
        const stmtB = (clusterPatterns[j].statement || clusterPatterns[j].rule || '').toLowerCase();
        const negB = (clusterPatterns[j].negative_constraint || '').toLowerCase();
        const stmtA = (clusterPatterns[i].statement || clusterPatterns[i].rule || '').toLowerCase();

        const aForbidsB = (
          (negA.includes('process.exit') && stmtB.includes('process.exit(0)') && (stmtB.includes('never') || stmtB.includes('without drain') || stmtB.includes('immediately'))) ||
          (negA.includes('always drain') && stmtB.includes('never drain')) ||
          (stmtB.includes('never drain') && stmtA.includes('drain'))
        );
        const bForbidsA = (
          (negB.includes('process.exit') && stmtA.includes('process.exit(0)') && (stmtA.includes('never') || stmtA.includes('without drain') || stmtA.includes('immediately'))) ||
          (negB.includes('always drain') && stmtA.includes('never drain')) ||
          (stmtA.includes('never drain') && stmtB.includes('drain'))
        );

        if (aForbidsB || bForbidsA) {
          hasDirectConflict = true;
          conflictDetail = {
            patA: clusterPatterns[i].title,
            patB: clusterPatterns[j].title,
            reason: `Direct anti-pattern opposition: Pattern prescribes behavior explicitly forbidden by negative constraint: ${aForbidsB ? negA.slice(0, 80) : negB.slice(0, 80)}`
          };
          break;
        }
      }
      if (hasDirectConflict) break;
    }

    // 4. Determine Corroboration Classification
    let status = CORROBORATION_STATUS.SINGLE_SOURCE;
    let decisionReason = '';

    if (hasDirectConflict) {
      status = CORROBORATION_STATUS.CONFLICTING;
      decisionReason = `Direct semantic contradiction detected: ${conflictDetail.reason}`;
    } else if (hasContextDivergence) {
      status = CORROBORATION_STATUS.CONTEXT_DIVERGENT;
      decisionReason = `Divergent runtime contexts preserved: ${contextDivergenceDetail}`;
    } else if (corroborationReport.is_corroborated && corroborationReport.effective_sources >= 2) {
      status = CORROBORATION_STATUS.CORROBORATED;
      decisionReason = `Corroborated across ${corroborationReport.effective_sources} independent repositories (${Array.from(contributingRepos).join(', ')})`;
    } else if (corroborationReport.independence_tier === INDEPENDENCE_TIERS.COPIED_OR_MIRRORED || corroborationReport.copied_groups.length > 0) {
      status = CORROBORATION_STATUS.COPIED_OR_MIRRORED;
      decisionReason = `Collapsing duplicated sources: identical code or mirror detected (${corroborationReport.copied_groups.length} copied groups)`;
    } else {
      status = CORROBORATION_STATUS.SINGLE_SOURCE;
      decisionReason = `Single-source supported from ${contributingRepos.values().next().value || 'unknown repo'}`;
    }

    // 5. Synthesize Unified Pattern Representation
    const rep = cluster.representative;
    const implementations = clusterPatterns.map(p => ({
      repo: p.repo_name,
      observed: p.observed_implementation || p.implementation,
      source_uri: p.source?.uri || ''
    }));

    const unifiedCandidate = {
      candidate_id: cluster.cluster_id,
      title: rep.title,
      statement: rep.statement,
      why: rep.why,
      when_to_apply: rep.when_to_apply,
      category: rep.category || 'ENGINEERING_PATTERN',
      context_constraints: rep.context_constraints || '',
      negative_constraint: rep.negative_constraint || '',
      corroboration_status: status,
      decision_reason: decisionReason,
      effective_sources_count: corroborationReport.effective_sources,
      independence_tier: corroborationReport.independence_tier,
      contributing_repositories: Array.from(contributingRepos),
      implementations,
      evidence_list: aggregatedEvidence,
      corroboration_report: corroborationReport
    };

    // Classify into appropriate output collection
    switch (status) {
      case CORROBORATION_STATUS.CORROBORATED:
        corroboratedPatterns.push(unifiedCandidate);
        break;
      case CORROBORATION_STATUS.CONFLICTING:
        conflictedPatterns.push(unifiedCandidate);
        break;
      case CORROBORATION_STATUS.COPIED_OR_MIRRORED:
        copiedPatterns.push(unifiedCandidate);
        break;
      case CORROBORATION_STATUS.CONTEXT_DIVERGENT:
        contextDivergentPatterns.push(unifiedCandidate);
        break;
      case CORROBORATION_STATUS.SINGLE_SOURCE:
      default:
        singleSourcePatterns.push(unifiedCandidate);
        break;
    }
  }

  return {
    engine_version: CORROBORATION_ENGINE_VERSION,
    total_repositories: repoPackages.length,
    total_candidate_patterns: repoPackages.reduce((sum, p) => sum + (p.reusable_construction_patterns?.length || 0), 0),
    total_clusters: clusters.length,
    counts: {
      corroborated: corroboratedPatterns.length,
      single_source: singleSourcePatterns.length,
      copied_or_mirrored: copiedPatterns.length,
      conflicted: conflictedPatterns.length,
      context_divergent: contextDivergentPatterns.length
    },
    corroborated_patterns: corroboratedPatterns,
    single_source_patterns: singleSourcePatterns,
    copied_patterns: copiedPatterns,
    conflicted_patterns: conflictedPatterns,
    context_divergent_patterns: contextDivergentPatterns
  };
}

/**
 * End-to-End Cross-Repository Learning & Corroboration Pipeline
 *
 * Ingests multiple repository paths, extracts patterns and evidence, validates
 * cross-repository corroboration, applies HIQV quality gating, promotes confirmed
 * patterns (with explicit authorization in sandbox), updates retrieval index,
 * and verifies live BM25 retrieval.
 *
 * @param {Array<string>} repoPaths - List of repository directory paths
 * @param {object} options - Pipeline options
 * @returns {Promise<object>} Complete pipeline execution report
 */
export async function executeCrossRepositoryLearningPipeline(repoPaths = [], options = {}) {
  const brainRoot = options.brainRoot || BRAIN_ROOT;
  const startTime = Date.now();

  console.log(`\n======================================================================`);
  console.log(`🧠 CROSS-REPOSITORY CORROBORATION & LEARNING ENGINE (URE v0.3)`);
  console.log(`   Repositories to Analyze: ${repoPaths.length}`);
  console.log(`   Brain Target           : ${brainRoot}`);
  console.log(`   Canonical Promotion    : ${options.allowCanonicalPromotion === true ? 'AUTHORIZED (SANDBOX)' : 'WITHHELD'}`);
  console.log(`======================================================================\n`);

  // Step 1: Analyze each repository independently using URE
  console.log(`[STEP 1/5] Extracting Static Intelligence from ${repoPaths.length} Repositories...`);
  const repoPackages = [];

  for (const repoPath of repoPaths) {
    console.log(`  🔍 Analyzing: ${repoPath}...`);
    const pkg = analyzeRepository(repoPath, options);
    console.log(`     ✓ "${pkg.repository_manifest.name}" (${pkg.extraction_metadata.files_scanned_count} files, ${pkg.reusable_construction_patterns.length} patterns)`);
    repoPackages.push(pkg);
  }

  // Step 2: Cross-Repository Semantic Corroboration
  console.log(`\n[STEP 2/5] Running Cross-Repository Semantic Corroboration & Independence Verification...`);
  const corroborationResult = corroborateMultiRepositoryPatterns(repoPackages, options);
  console.log(`  ✓ Total Clusters Identified: ${corroborationResult.total_clusters}`);
  console.log(`  ✓ Independently Corroborated : ${corroborationResult.counts.corroborated}`);
  console.log(`  ✓ Single-Source Candidates   : ${corroborationResult.counts.single_source}`);
  console.log(`  ✓ Copied / Mirrored (Collapsed): ${corroborationResult.counts.copied_or_mirrored}`);
  console.log(`  ✓ Direct Conflicts Quarantined : ${corroborationResult.counts.conflicted}`);
  console.log(`  ✓ Context Divergent Boundaries: ${corroborationResult.counts.context_divergent}`);

  // Step 3: HIQV Quality Gate Validation
  console.log(`\n[STEP 3/5] HIQV Validation & HMAC Token Generation for Corroborated Patterns...`);
  const validatedCorroboratedRules = [];

  for (const cand of corroborationResult.corroborated_patterns) {
    const rawCandItem = {
      title: cand.title,
      body: `### ${cand.title}\n**RULE**: ${cand.statement}\n**WHY**: ${cand.why}\n**WHEN TO APPLY**: ${cand.when_to_apply}\n**CORROBORATED ACROSS**: ${cand.contributing_repositories.join(', ')}\n**NEGATIVE CONSTRAINT**:\n\`\`\`javascript\n${cand.negative_constraint}\n\`\`\`\n**MULTI-REPO VERIFICATION**:\nIndependently corroborated with reproducible evidence across ${cand.contributing_repositories.length} repositories.`,
      repository: cand.contributing_repositories.join('; '),
      source_url: `multi-repo://${cand.contributing_repositories.join('+')}`,
      source_id: `CORROBORATED-${cand.candidate_id}`,
      source_uri: `cross-repo-evidence://${cand.candidate_id}`,
      source_version: '1.0.0',
      license: 'MIT',
      source: {
        id: `CORROBORATED-${cand.candidate_id}`,
        uri: `cross-repo://${cand.contributing_repositories.join('/')}`
      }
    };

    // Validate with full multi-source evidence
    const valReport = validateHarvestedIntelligence(rawCandItem, cand.evidence_list, { brainRoot });
    console.log(`  🔍 Pattern: "${cand.title}" -> HIQV Decision: ${valReport.decision} (Confidence: ${valReport.confidence_score})`);

    // Verify HMAC Authenticity Token
    const authCheck = verifyReportIntegrity(rawCandItem, cand.evidence_list, valReport);
    console.log(`     HMAC Authenticity: ${authCheck.valid ? 'AUTHENTIC' : 'INVALID'}`);

    rawCandItem.quality_validation = valReport;
    rawCandItem.evidenceList = cand.evidence_list;
    rawCandItem.corroboration = cand;
    validatedCorroboratedRules.push(rawCandItem);
  }

  // Also validate single-source patterns (must result in CONDITIONAL_PASS or WARN)
  const validatedSingleSourceRules = [];
  for (const cand of corroborationResult.single_source_patterns) {
    const rawCandItem = {
      title: cand.title,
      body: `### ${cand.title}\n**RULE**: ${cand.statement}`,
      repository: cand.contributing_repositories[0] || 'unknown',
      source_id: `SRC-${cand.candidate_id}`,
      source_uri: `repo://${cand.contributing_repositories[0]}`,
      source: { id: `SRC-${cand.candidate_id}`, uri: `repo://${cand.contributing_repositories[0]}` }
    };
    const valReport = validateHarvestedIntelligence(rawCandItem, cand.evidence_list, { brainRoot });
    rawCandItem.quality_validation = valReport;
    validatedSingleSourceRules.push(rawCandItem);
  }

  // Step 4: Canonical Promotion & Learning Dossier Staging
  console.log(`\n[STEP 4/5] Canonical Promotion & Learning Dossier Staging...`);
  const promotionResults = [];

  if (options.allowCanonicalPromotion === true) {
    // Only patterns that earned full PASS from HIQV and are CORROBORATED are eligible for promotion
    const eligibleForPromotion = validatedCorroboratedRules.filter(r =>
      r.quality_validation.decision === VALIDATOR_DECISIONS.PASS &&
      r.corroboration.corroboration_status === CORROBORATION_STATUS.CORROBORATED
    );

    console.log(`  Eligible for Canonical Promotion: ${eligibleForPromotion.length}`);

    if (eligibleForPromotion.length > 0) {
      const learningPackage = {
        package_id: `LP-CROSS-REPO-${Date.now()}`,
        validated_rules: eligibleForPromotion,
        metadata: { brainRoot }
      };

      const promoResult = promoteValidatedRules(learningPackage, { brainRoot });
      console.log(`  ✓ Canonical Promotion Result: ${promoResult.success ? 'SUCCESS' : 'FAILED'} (Promoted: ${promoResult.promoted?.length || 0})`);
      promotionResults.push(promoResult);
    }
  } else {
    console.log(`  ℹ Canonical Promotion withheld (staging mode).`);
  }

  // Format Cross-Repository Synthesis Dossier
  const dossierLines = [
    `# Cross-Repository Corroboration Dossier`,
    `- **Date**: ${new Date().toISOString()}`,
    `- **Repositories Analyzed**: ${repoPackages.map(p => p.repository_manifest.name).join(', ')}`,
    `- **Total Clusters**: ${corroborationResult.total_clusters}`,
    `- **Independently Corroborated**: ${corroborationResult.counts.corroborated}`,
    `- **Collapsing Mirrored / Copied**: ${corroborationResult.counts.copied_or_mirrored}`,
    `- **Direct Conflicts Quarantined**: ${corroborationResult.counts.conflicted}`,
    `- **Context Divergences**: ${corroborationResult.counts.context_divergent}\n`,
    `## 1. Independently Corroborated Patterns (HIQV PASS)`
  ];

  for (const r of validatedCorroboratedRules) {
    dossierLines.push(`### ${r.title}`);
    dossierLines.push(`- **HIQV Decision**: ${r.quality_validation.decision}`);
    dossierLines.push(`- **Supporting Repos**: ${r.corroboration.contributing_repositories.join(', ')}`);
    dossierLines.push(`- **Effective Sources**: ${r.corroboration.effective_sources_count}`);
    dossierLines.push(`- **HMAC Token**: \`${r.quality_validation.auth_token?.slice(0, 16)}...\`\n`);
  }

  if (corroborationResult.conflicted_patterns.length > 0) {
    dossierLines.push(`## 2. Quarantined Conflicting Patterns (REJECTED)`);
    for (const c of corroborationResult.conflicted_patterns) {
      dossierLines.push(`### [QUARANTINED] ${c.title}`);
      dossierLines.push(`- **Reason**: ${c.decision_reason}\n`);
    }
  }

  const dossierContent = dossierLines.join('\n');
  const dossierDir = path.join(brainRoot, '07_PROJECT_LEARNING');
  if (fs.existsSync(dossierDir)) {
    const dossierPath = path.join(dossierDir, `cross-repo-corroboration-${Date.now()}.md`);
    fs.writeFileSync(dossierPath, dossierContent, 'utf-8');
    console.log(`  ✓ Persisted Synthesis Dossier: ${dossierPath}`);
  }

  // Step 5: Update Index & Live BM25 Retrieval Verification
  console.log(`\n[STEP 5/5] Rebuilding Search Index & Verifying Live BM25 Retrieval...`);
  let retrievalVerification = { verified: false };

  try {
    const indexResult = await buildSearchIndex({ brainRoot });
    console.log(`  ✓ Search Index rebuilt: ${indexResult.totalDocuments} documents`);

    // Verify search retrieval for corroborated pattern
    if (validatedCorroboratedRules.length > 0) {
      const targetQuery = validatedCorroboratedRules[0].title;
      const searchRes = await searchBrain(targetQuery, { brainRoot, limit: 3 });
      const found = searchRes.results?.some(r =>
        (r.title && r.title.toLowerCase().includes(targetQuery.toLowerCase().slice(0, 15))) ||
        (r.content && r.content.toLowerCase().includes(targetQuery.toLowerCase().slice(0, 15)))
      );
      retrievalVerification = {
        verified: Boolean(found),
        query: targetQuery,
        matches_found: searchRes.results?.length || 0
      };
      console.log(`  ✓ BM25 Retrieval Verification for "${targetQuery.slice(0, 30)}...": ${found ? 'PASS' : 'FAIL'}`);
    } else {
      retrievalVerification = { verified: true, note: 'No corroborated patterns to query' };
    }
  } catch (err) {
    console.log(`  ⚠ Index/Retrieval verification error: ${err.message}`);
    retrievalVerification = { verified: false, error: err.message };
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n✓ Cross-Repository Learning Pipeline complete in ${durationMs}ms`);

  return {
    success: true,
    engine_version: CORROBORATION_ENGINE_VERSION,
    duration_ms: durationMs,
    corroboration: corroborationResult,
    validated_corroborated_rules: validatedCorroboratedRules,
    validated_single_source_rules: validatedSingleSourceRules,
    canonical_promotions: promotionResults,
    retrieval_verification: retrievalVerification
  };
}
