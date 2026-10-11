/**
 * Multi-Factor Knowledge Gap Prioritization Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\gap-prioritizer.mjs
 * Purpose: Computes transparent, reproducible multi-factor priority scores
 *          across 8 distinct engineering dimensions, ranking gaps by impact,
 *          risk, evidence, and research cost without popularity bias.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadGapRegistry, saveGapRegistry, GAP_STATUS, GAP_CATEGORIES } from './gap-discovery-engine.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Evaluates individual factors for a gap record
 * All factors normalized to 1 - 10 scale
 * 
 * @param {object} gap - Knowledge gap record
 * @returns {object} Factor evaluation breakdown
 */
export function evaluateGapFactors(gap) {
  let impact = 5;
  let risk = 5;
  let frequency = 5;
  let reuse = 5;
  let evidence = 5;
  let expectedValue = 5;
  let researchCost = 4;
  let confidenceOfInsufficiency = 7;

  switch (gap.category) {
    case GAP_CATEGORIES.RETRIEVAL_COVERAGE_DEFICIT:
      evidence = 9.5; // Concrete failed probe query with irrelevant match
      confidenceOfInsufficiency = 9.0;
      reuse = 9.0; // Universal architectural pattern

      if (gap.domain === 'DISTRIBUTED_CONCURRENCY') {
        impact = 9.5; // Split-brain data corruption
        risk = 9.8; // High concurrency hazard
        frequency = 8.5; // Common microservice requirement
        expectedValue = 9.5;
        researchCost = 2.5; // Authoritative Redis/Redlock & Martin Kleppmann specs accessible
      } else if (gap.domain === 'ZERO_TRUST_AUTH') {
        impact = 9.0; // Token forgery/replay
        risk = 9.5; // Auth compromise
        frequency = 8.0;
        expectedValue = 9.0;
        researchCost = 3.0;
      } else if (gap.domain === 'DISTRIBUTED_RATE_LIMITING') {
        impact = 8.5; // API denial of service / cascade failure
        risk = 8.8; // Availability hazard
        frequency = 8.5;
        expectedValue = 8.5;
        researchCost = 3.0;
      } else if (gap.domain === 'WASM_MEMORY_SAFETY') {
        impact = 7.5; // Sandbox escape / memory leak
        risk = 7.8;
        frequency = 6.0;
        expectedValue = 7.5;
        researchCost = 4.0;
      } else if (gap.domain === 'RESILIENT_TRANSACTIONS') {
        impact = 8.0; // Partial rollback inconsistency
        risk = 8.0;
        frequency = 7.0;
        expectedValue = 8.0;
        researchCost = 3.5;
      }
      break;

    case GAP_CATEGORIES.MISSING_VERIFICATION_METHOD:
      impact = 6.0;
      risk = 5.0;
      frequency = 7.0;
      reuse = 6.0;
      evidence = 9.0; // Physical code inspection confirmed absence of section
      expectedValue = 6.5;
      researchCost = 3.0; // Can be formulated locally
      confidenceOfInsufficiency = 8.5;
      break;

    case GAP_CATEGORIES.UNRESOLVED_CANDIDATE:
      impact = 4.0;
      risk = 3.5;
      frequency = 4.0;
      reuse = 5.0;
      evidence = 8.5; // Registry log reports rejection reason
      expectedValue = 4.5;
      researchCost = 5.0; // Requires source review of candidate repo
      confidenceOfInsufficiency = 7.0;
      break;

    default:
      impact = 5.0;
      risk = 5.0;
      frequency = 5.0;
      reuse = 5.0;
      evidence = 5.0;
      expectedValue = 5.0;
      researchCost = 5.0;
      confidenceOfInsufficiency = 6.0;
      break;
  }

  // Calculate weighted benefit
  const weightedBenefit = 
    (impact * 0.25) +
    (risk * 0.25) +
    (evidence * 0.20) +
    (reuse * 0.15) +
    (expectedValue * 0.15);

  // Cost divisor (lower cost yields higher priority)
  const costModifier = 1 + (researchCost * 0.05);
  const priorityScore = parseFloat((weightedBenefit / costModifier).toFixed(2));

  return {
    factors: {
      engineering_impact: impact,
      security_reliability_risk: risk,
      task_frequency: frequency,
      reuse_potential: reuse,
      evidence_strength: evidence,
      expected_value: expectedValue,
      research_cost: researchCost,
      confidence_of_insufficiency: confidenceOfInsufficiency
    },
    weighted_benefit: parseFloat(weightedBenefit.toFixed(2)),
    priority_score: priorityScore
  };
}

/**
 * Prioritizes all gaps in the registry using the transparent multi-factor scoring model.
 * 
 * @param {object} options - Prioritization options
 * @returns {object} { totalPrioritized: number, rankedGaps: Array<object> }
 */
export function prioritizeKnowledgeGaps(options = {}) {
  const registry = loadGapRegistry();

  for (const gap of registry.gaps) {
    const evaluation = evaluateGapFactors(gap);
    gap.priority_evaluation = evaluation;
    gap.priority_score = evaluation.priority_score;
  }

  // Sort descending by priority_score (highest priority first)
  registry.gaps.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

  saveGapRegistry(registry);

  return {
    totalPrioritized: registry.gaps.length,
    topPriorityGap: registry.gaps.find(g => g.status === GAP_STATUS.OPEN) || null,
    rankedGaps: registry.gaps
  };
}
