/**
 * Safe Autonomous Research Loop Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\autonomous-research-loop.mjs
 * Purpose: Integrates gap discovery, prioritization, targeted research,
 *          and empirical closure verification into a safe, bounded autonomous cycle.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverKnowledgeGaps, GAP_STATUS } from './gap-discovery-engine.mjs';
import { prioritizeKnowledgeGaps } from './gap-prioritizer.mjs';
import { conductTargetedResearch, TARGETED_RESEARCH_PROFILES } from './targeted-researcher.mjs';
import { verifyGapClosure } from './gap-closure-verifier.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const CHECKPOINTS_FILE = path.join(BRAIN_ROOT, '.project-brain', 'research-checkpoints.json');
const EVOLUTION_LOG_FILE = path.join(BRAIN_ROOT, '14_EVOLUTION', 'brain-evolution-log.md');

/**
 * Ensures research checkpoint directory and storage exist
 */
function ensureCheckpointStorage() {
  const dir = path.dirname(CHECKPOINTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(CHECKPOINTS_FILE)) {
    fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify({ version: '1.0.0', cycles: [] }, null, 2), 'utf-8');
  }
}

/**
 * Records a durable checkpoint for a research cycle
 */
export function recordResearchCheckpoint(cycleId, stage, payload = {}) {
  ensureCheckpointStorage();
  try {
    const db = JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf-8'));
    db.cycles.push({
      cycle_id: cycleId,
      stage,
      timestamp: new Date().toISOString(),
      payload
    });
    fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {}
}

/**
 * Executes a bounded, safe autonomous research cycle
 * 
 * @param {object} options - Cycle options (tokenBudget, targetGapId, dryRun)
 * @returns {object} Cycle execution summary
 */
export async function runAutonomousResearchCycle(options = {}) {
  const cycleId = `RESEARCH-CYCLE-${Date.now()}`;
  recordResearchCheckpoint(cycleId, 'INITIALIZED', { options });

  // 1. Discover Knowledge Gaps
  const discovery = discoverKnowledgeGaps(options);
  recordResearchCheckpoint(cycleId, 'GAPS_DISCOVERED', { totalGaps: discovery.discoveredCount, newGaps: discovery.newGapsCount });

  // 2. Prioritize Gaps
  const prioritization = prioritizeKnowledgeGaps(options);
  const targetGap = options.targetGapId
    ? prioritization.rankedGaps.find(g => g.gap_id === options.targetGapId)
    : (prioritization.rankedGaps.find(g => g.status === GAP_STATUS.OPEN && TARGETED_RESEARCH_PROFILES[g.domain]) || prioritization.topPriorityGap);

  if (!targetGap) {
    recordResearchCheckpoint(cycleId, 'NO_OPEN_GAPS', { message: 'All discovered gaps are resolved or none matched criteria.' });
    return {
      success: true,
      cycleId,
      message: 'No open knowledge gaps requiring research.',
      discovery,
      prioritization
    };
  }

  recordResearchCheckpoint(cycleId, 'GAP_SELECTED', {
    gap_id: targetGap.gap_id,
    domain: targetGap.domain,
    priority_score: targetGap.priority_score
  });

  // 3. Conduct Targeted Research & Codification
  const researchResult = conductTargetedResearch(targetGap, options);
  if (!researchResult.success) {
    recordResearchCheckpoint(cycleId, 'RESEARCH_STAGED', { reason: researchResult.reason });
    return {
      success: true,
      staged: true,
      cycleId,
      targetGap,
      researchResult
    };
  }

  recordResearchCheckpoint(cycleId, 'KNOWLEDGE_CODIFIED', {
    ruleId: researchResult.ruleId,
    ruleNumber: researchResult.ruleNumber,
    ruleTitle: researchResult.ruleTitle
  });

  // 4. Measure & Verify Gap Closure
  const closureVerification = verifyGapClosure(targetGap, researchResult, options);
  recordResearchCheckpoint(cycleId, 'CLOSURE_VERIFIED', {
    closed: closureVerification.closed,
    retrievalPassed: closureVerification.retrievalPassed,
    empiricalTestPassed: closureVerification.empiricalTestPassed
  });

  // 5. Append to Evolution Log
  if (closureVerification.closed && fs.existsSync(EVOLUTION_LOG_FILE)) {
    try {
      const logEntry = `\n- **${new Date().toISOString()}**: [TARGETED RESEARCH] Closed gap ${targetGap.gap_id} (${targetGap.domain}) by codifying **${researchResult.ruleId}** (${researchResult.ruleTitle}).\n`;
      fs.appendFileSync(EVOLUTION_LOG_FILE, logEntry, 'utf-8');
    } catch (e) {}
  }

  return {
    success: true,
    cycleId,
    targetGap,
    researchResult,
    closureVerification,
    discoverySummary: {
      totalGaps: discovery.discoveredCount,
      openGaps: prioritization.rankedGaps.filter(g => g.status === GAP_STATUS.OPEN).length
    }
  };
}
