import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveNextRuleNumber } from './concurrency-coordinator.mjs';
import { dispatchZeroCostAiSynthesis, loadAllAiKeys } from './ai-provider-pool.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

const PATTERNS_PATH = path.join(BRAIN_ROOT, '05_KNOWLEDGE', 'engineering-patterns.md');
const SKILLS_DIR = path.join(BRAIN_ROOT, '03_SKILLS');
const LEARNING_DIR = path.join(BRAIN_ROOT, '07_PROJECT_LEARNING');

/**
 * Resolves Gemini API Key from environment or local brain config
 */
export function getGeminiApiKey() {
  const pool = loadAllAiKeys().gemini;
  return pool.length > 0 ? pool[0] : null;
}

/**
 * Call Google Gemini REST API directly server-to-server with multi-key rotation and zero-cost fallback
 */
export async function callGeminiApi(prompt, systemInstruction = '') {
  return await dispatchZeroCostAiSynthesis(prompt, systemInstruction);
}

/**
 * Deep Intelligence Synthesis: Prompts Gemini to perform 8-dimensional extraction,
 * micro-learning discovery, and universal engineering rule formulation.
 */
export async function synthesizeIntelligenceWithGemini(auditData) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn(`⚠️ [GEMINI SERVER-TO-SERVER NOTICE] GEMINI_API_KEY is not configured.`);
    console.warn(`   To enable 100% autonomous server-to-server Gemini AI reasoning on GitHub Actions:`);
    console.warn(`   Add your free Google AI Studio API key as a secret named 'GEMINI_API_KEY' in GitHub Repository Secrets:`);
    console.warn(`   https://github.com/satyabagherwal-source/AI-Builder-Brain/settings/secrets/actions`);
    return null;
  }

  const systemInstruction = `You are the Lead Autonomous Systems Forensic Architect for AI-Builder-Brain (Canonical Root: C:\\AI-Builder-Brain).
Your mission is to perform an EXHAUSTIVE, FULL-SPECTRUM, DEEP FORENSIC LEARNING EXTRACTION ("totally puri learning nichod lena") from software repositories.
You NEVER write high-level summaries, promotional fluff, or generic bullet points.

CRITICAL MANDATES:
1. FORENSIC REAL INCIDENTS (Incidents 1 to 5+):
Based directly on the provided git commit patches, issue post-mortems, and code diffs, extract at least 4 to 8 REAL, CONCRETE PRODUCTION INCIDENTS.
For EACH incident, you MUST provide:
- Incident Title & ID: e.g. Incident 1: [Specific Technical Description] (BUG-[REPO]-01)
- Context & Subsystem: Exact file path, component, or subsystem
- What Was Expected: Required architectural and runtime invariant
- What Actually Happened: Concrete forensic failure mode (race condition, memory leak, use-after-free, stale cache, type coercion, deadlock, etc.)
- Evidence in Repo: Commit SHA, PR #, File path and line numbers
- Root Cause: Concrete technical breakdown of the flawed assumption
- Remediation Code Diff: Markdown code block showing before (-) and after (+) or fixed pattern
- Lesson & Invariant: Universal lesson learned
- Promotion Decision: Rule candidate for Master Brain or Brain refinement

2. 8-DIMENSIONAL DEEP SWEEP (D1 to D8):
Analyze all 8 dimensions with concrete technical depth based on the code files, manifests, and patches.

3. NET-NEW UNIVERSAL ENGINEERING RULES:
Formulate 1 to 3 battle-tested Universal Engineering Rules in the exact standard format:
## X. [Rule Title]
**RULE**:
[Clear statement of invariant]
**WHY**:
[Forensic technical explanation of failure modes avoided]
**WHEN TO APPLY**:
[Target subsystems, languages, or architectural boundaries]
**VERIFIED IMPLEMENTATION PATTERN**:
\`\`\`language
// Complete, working, production-grade pattern
\`\`\`
**NEGATIVE CONSTRAINT**:
\`\`\`language
// Anti-pattern to NEVER write
\`\`\`

4. ACTIONABLE AGENT SKILL & CHECKLIST:
Provide a step-by-step verification checklist for any AI coding agent building similar systems.`;

  const prompt = `Perform an exhaustive, multi-dimensional forensic extraction ("totally puri learning nichod lena") on the following repository:

Target Repository: ${auditData.name} (${auditData.platform})
URL: ${auditData.target?.webUrl || auditData.name}
Language/Ecosystem: ${auditData.language}
Stars: ${auditData.stars || 0}
Topics: ${(auditData.topics || []).join(', ')}

======================================================================
1. OBSERVED PRODUCTION COMMIT PATCHES & CODE DIFFS:
======================================================================
${JSON.stringify(auditData.deepFixPatches || auditData.fixCommits || [], null, 2)}

======================================================================
2. OBSERVED CLOSED BUG ISSUES & DEVELOPER POST-MORTEMS:
======================================================================
${JSON.stringify(auditData.closedIssues || [], null, 2)}

======================================================================
3. CORE ARCHITECTURAL SOURCE CODE SNIPPETS:
======================================================================
${JSON.stringify(auditData.discoveredSourceSnippets || {}, null, 2)}

======================================================================
4. MANIFESTS, CONFIGS & CI/CD INVARIANTS:
======================================================================
${JSON.stringify(auditData.discoveredManifests || auditData.manifests || [], null, 2)}

======================================================================
5. REPOSITORY DIRECTORY TREE STRUCTURE:
======================================================================
${JSON.stringify(auditData.treeSample || [], null, 2)}

TASK INSTRUCTIONS:
Structure your response in markdown with the following EXACT canonical sections:

# Project Learning Record (Full-Spectrum Forensic Harvest): ${auditData.name}

## 1. Executive Forensic Architecture & System Mechanics
Explain the exact technical problem this repo solves, its architectural boundaries, and critical subsystem abstractions.

## 2. Forensic Incident & Learning Records (Incident 1 to 5+)
For each real bug fix/incident discovered from the commits, patches, and issues, document:
### Incident X: [Specific Technical Title] (BUG-[SLUG]-0X)
- **Context**: Subsystem and file path
- **What Was Expected**: The required functional and invariant behavior
- **What Actually Happened**: The precise failure mode
- **Evidence in Repo**: Commit SHA, PR link, exact file path, and tests
- **Root Cause**: Deep forensic root-cause analysis
- **Remediation & Code Diff**:
\`\`\`language
// - Buggy code / What failed
// + Fixed pattern / Safe invariant
\`\`\`
- **Lesson**: Generalized engineering invariant
- **Promotion Decision**: Promoted as Universal Rule candidate or Brain refinement

## 3. 8-Dimensional Multi-Axis Forensic Deep Sweep
- **D1: Architecture & Structural Boundaries**:
- **D2: Asynchronous State & Concurrency Defense**:
- **D3: Error Boundaries, Recovery & Rollback Protocols**:
- **D4: Resource Lifecycle & Leak Defenses (Memory, Sockets, Descriptors)**:
- **D5: Boundary Deserialization, Schemas & Input Sanitization**:
- **D6: Cross-Platform & Runtime Compatibility Gotchas (Windows/Linux/Node/Browser)**:
- **D7: Build, CI/CD, Deployment & Dependency Invariants**:
- **D8: Concrete Bug Fixes & Forensic Patches**:

## 4. Net-New Universal Engineering Rules (Candidates for Master Brain)
Provide 1 to 3 net-new Universal Engineering Rules in the exact standard format:
## X. [Rule Title]
**RULE**:
**WHY**:
**WHEN TO APPLY**:
**VERIFIED IMPLEMENTATION PATTERN**:
\`\`\`language
// Complete, working pattern
\`\`\`
**NEGATIVE CONSTRAINT**:
\`\`\`language
// Anti-pattern to NEVER write
\`\`\`

## 5. Actionable Agent Skill & Implementation Checklist
Provide a step-by-step verification checklist for any AI coding agent building similar systems.`;

  try {
    const result = await callGeminiApi(prompt, systemInstruction);
    return result;
  } catch (err) {
    console.error(`[GEMINI SYNTHESIS FAILED] ${err.message}`);
    return null;
  }
}

/**
 * Parses Gemini output to extract net-new rules and promotes them to 05_KNOWLEDGE/engineering-patterns.md
 */
export function promoteGeminiRulesToMasterBrain(geminiText, sourceRepoName) {
  if (!geminiText || !fs.existsSync(PATTERNS_PATH)) return [];

  const ruleRegex = /(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?\s*(.+?)\n([\s\S]*?)(?=(?:\n(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?|\n##\s+5\.|\n###\s+5\.|\Z))/gi;
  let match;
  const promotedRules = [];

  while ((match = ruleRegex.exec(geminiText)) !== null) {
    const ruleTitle = match[1].trim();
    const ruleBody = match[2].trim();

    // Skip section headers or invalid titles
    if (/^(net-new|universal|forensic|executive|actionable|project|empirical)/i.test(ruleTitle)) continue;

    // Check if rule already exists to avoid duplicates
    const currentPatterns = fs.readFileSync(PATTERNS_PATH, 'utf-8');
    if (currentPatterns.toLowerCase().includes(ruleTitle.toLowerCase())) {
      console.log(`[RULE ALREADY EXISTS] Skipping duplicate rule: "${ruleTitle}"`);
      continue;
    }

    const nextRuleNum = resolveNextRuleNumber();
    const formattedRule = `\n\n---\n\n## ${nextRuleNum}. ${ruleTitle} (Harvested from ${sourceRepoName})\n\n${ruleBody}\n`;

    fs.appendFileSync(PATTERNS_PATH, formattedRule, 'utf-8');
    console.log(`🌟 [PROMOTED UNIVERSAL RULE] Appended Rule ${nextRuleNum}: "${ruleTitle}" to engineering-patterns.md`);
    promotedRules.push({ number: nextRuleNum, title: ruleTitle });
  }

  return promotedRules;
}

/**
 * Saves the rich Gemini-synthesized learning document into 07_PROJECT_LEARNING/
 */
export function saveGeminiLearningRecord(slug, geminiText, auditData) {
  fs.mkdirSync(LEARNING_DIR, { recursive: true });
  const filename = `${slug}-learnings.md`;
  const filePath = path.join(LEARNING_DIR, filename);

  const header = `> **Canonical Learning Artifact**: \`07_PROJECT_LEARNING/${filename}\`  
> **Source**: ${auditData.platform} ([${auditData.target?.webUrl || auditData.name}](${auditData.target?.webUrl || auditData.name}))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: ${new Date().toISOString()}  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

`;

  fs.writeFileSync(filePath, header + geminiText, 'utf-8');
  console.log(`📄 [GEMINI LEARNING RECORD SAVED] ${filePath}`);
  return filePath;
}
