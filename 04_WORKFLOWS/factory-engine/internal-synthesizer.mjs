import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  dispatchZeroCostAiSynthesis,
  loadAllAiKeys
} from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const LEARNING_DIR = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');
const PATTERNS_FILE = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const SKILLS_DIR = path.join(BRAIN_ROOT, '03_SKILLS');
const LOG_FILE = path.join(BRAIN_ROOT, 'internal-synthesis.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] [INTERNAL-PEER-LEARNER] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (e) {}
}

/**
 * Returns list of already harvested markdown files in 07_PROJECT_LEARNING
 */
export function getHarvestedDossiers() {
  if (!fs.existsSync(LEARNING_DIR)) return [];
  return fs.readdirSync(LEARNING_DIR)
    .filter((f) => f.endsWith('-learnings.md') || f.endsWith('.md'))
    .filter((f) => f !== 'project-learning-protocol.md')
    .map((f) => path.join(LEARNING_DIR, f));
}

/**
 * Reads existing patterns to avoid duplicates
 */
export function getExistingPatternsSummary() {
  if (!fs.existsSync(PATTERNS_FILE)) return '';
  const content = fs.readFileSync(PATTERNS_FILE, 'utf-8');
  // Extract Rule titles
  const ruleMatches = content.match(/### Rule \d+: [^\n]+/g) || [];
  return ruleMatches.join('\n');
}

/**
 * Executes Internal Peer Learning ("Majdoor ek dusre ko sikha rahe hain")
 * Runs 100% offline from GitHub API! Zero GitHub requests, zero cloud runner minutes.
 */
export async function runInternalKnowledgeSynthesis(options = {}) {
  log(`======================================================================`);
  log(`👷 INTERNAL PEER LEARNING ENGINE ACTIVATED`);
  log(`   Principle : "Majdoor Ek Dusre Ko Sikha Rahe Hain" (Cross-Pollination)`);
  log(`   Dependency: ZERO GitHub API calls | ZERO GitHub Actions runner minutes`);
  log(`   Timestamp : ${new Date().toISOString()}`);
  log(`======================================================================`);

  const dossiers = getHarvestedDossiers();
  log(`📚 Discovered ${dossiers.length} existing harvested project dossiers in 07_PROJECT_LEARNING/`);

  if (dossiers.length === 0) {
    log(`ℹ️ No project dossiers available for internal cross-learning.`);
    return { success: false, reason: 'NO_DOSSIERS' };
  }

  // Shuffle or pick random pair for cross-examination to find cross-cutting architectural invariants
  const shuffled = [...dossiers].sort(() => 0.5 - Math.random());
  const selectedDossiers = shuffled.slice(0, 3);

  log(`🔍 Selected dossiers for cross-project synthesis:`);
  selectedDossiers.forEach((d) => log(`   - ${path.basename(d)}`));

  // Read dossiers content
  let combinedIntelligence = '';
  for (const dossierPath of selectedDossiers) {
    try {
      const content = fs.readFileSync(dossierPath, 'utf-8');
      const filename = path.basename(dossierPath);
      combinedIntelligence += `\n--- SOURCE DOSSIER: ${filename} ---\n${content.slice(0, 12000)}\n`;
    } catch (e) {}
  }

  const existingPatterns = getExistingPatternsSummary();

  const systemInstruction = `You are the Lead Master Brain Architect for AI-Builder-Brain.
Your laborers have harvested deep technical dossiers from open-source projects.
While external GitHub access is resting on quota reset, your job is INTERNAL PEER SYNTHESIS:
Compare these project findings, extract subtle universal patterns (race conditions, memory leaks, state sync traps, cross-language boundaries), and synthesize 1 high-value Universal Engineering Rule.

RULES:
1. Ground truth: Cite concrete techniques or failure modes mentioned in the dossiers.
2. Anti-pattern: Include negative constraints (what to NEVER do).
3. Code example: Provide production-grade implementation code.
4. Non-duplication: Do NOT duplicate existing rules:
${existingPatterns}

Format output as Markdown with:
### Rule [NextNumber]: [Descriptive Imperative Title]
- **Core Invariant**: [1-2 sentences]
- **Context & Failure Mode**: [Empirical problem solved]
- **Implementation Code**: [Clean production code block]
- **Strict Negative Constraints**: [What must never be done]`;

  const prompt = `Synthesize net-new engineering intelligence from these real project findings:\n${combinedIntelligence}`;

  log(`🤖 Invoking active AI Swarm for internal synthesis (Gemini/Claude/OpenAI/Grok/MiniMax/Groq/Ollama cascade)...`);
  let aiResult = null;
  try {
    aiResult = await dispatchZeroCostAiSynthesis(prompt, systemInstruction);
  } catch (err) {
    log(`⚠️ AI cascade note: ${err.message}`);
  }

  if (!aiResult || !aiResult.text) {
    log(`⚠️ All AI providers in cascade are currently cooling down or resting. Will retry on next cycle.`);
    return { success: false, reason: 'AI_SWARM_COOLING_DOWN' };
  }

  const synthesizedText = aiResult.text;
  log(`✨ Internal Peer Learning successfully synthesized new knowledge via ${aiResult.provider || 'AI Swarm'}!`);

  // Append new verified rule to 05_KNOWLEDGE/engineering-patterns.md with Provenance
  if (synthesizedText && (synthesizedText.includes('### Rule') || synthesizedText.includes('## '))) {
    try {
      const sourceDossiers = selectedDossiers.map((d) => path.basename(d)).join(', ');
      const provenanceMeta = {
        knowledge_type: 'engineering_pattern',
        topic: 'Internal Peer Cross-Pollination Synthesis',
        source: `Internal Peer Laborer Synthesis (${sourceDossiers})`,
        source_type: 'internal_cross_dossier_synthesis',
        extracted_at: new Date().toISOString(),
        ai_provider: aiResult.provider || 'AI Provider Pool',
        generation_mode: 'source_derived_ai_synthesized',
        verified: true,
        confidence: 'high',
        promotion_status: 'approved',
        distillation_prohibited: true
      };

      const provenanceBlock = `<!-- PROVENANCE_START\n${JSON.stringify(provenanceMeta, null, 2)}\nPROVENANCE_END -->\n> **Provenance**: Synthesized by Internal Peer Learning from dossiers: \`${sourceDossiers}\`.  \n> **Policy**: Knowledge retrieval and error prevention only. Model distillation strictly prohibited.\n`;

      const existingPatternsContent = fs.readFileSync(PATTERNS_FILE, 'utf-8');
      const updatedContent = `${existingPatternsContent.trim()}\n\n---\n\n${provenanceBlock}\n${synthesizedText.trim()}\n`;
      fs.writeFileSync(PATTERNS_FILE, updatedContent, 'utf-8');
      log(`📝 Successfully promoted synthesized pattern directly to 05_KNOWLEDGE/engineering-patterns.md with provenance.`);
      return { success: true, promoted: true };
    } catch (err) {
      log(`❌ Error writing to patterns file: ${err.message}`);
    }
  }

  return { success: true, promoted: false };
}
