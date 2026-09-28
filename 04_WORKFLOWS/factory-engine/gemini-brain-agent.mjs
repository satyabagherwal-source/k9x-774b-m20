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

  const systemInstruction = `You are the Lead Autonomous AI Systems Architect for AI-Builder-Brain (Canonical Root: C:\\AI-Builder-Brain).
Your mission is to extract DEEP, RIGOROUS, ACTIONABLE engineering intelligence from software repositories.
You NEVER write fluff, generic summaries, or promotional text.
You extract:
1. MICRO-LEARNINGS: Exact edge-case traps, runtime gotchas, hidden concurrency races, memory leak vectors, serialization bugs, and framework pitfalls.
2. MACRO-ARCHITECTURAL PATTERNS: Structural boundaries, modular isolation, dependency inversion, and contract design.
3. UNIVERSAL ENGINEERING RULES: Highly opinionated, empirical rules (suitable for Rules 72+) with strict Negative Constraints and Verified Implementation Patterns.
4. REUSABLE CODE RECIPES: Concrete code snippets illustrating how to prevent the bug or implement the pattern.`;

  const prompt = `Perform an exhaustive, multi-dimensional forensic extraction on the following repository:

Target Repository: ${auditData.name} (${auditData.platform})
URL: ${auditData.target?.webUrl || auditData.name}
Language/Ecosystem: ${auditData.language}
Stars: ${auditData.stars || 0}
Topics: ${(auditData.topics || []).join(', ')}

OBSERVED COMMITS & FIXES:
${JSON.stringify(auditData.fixCommits || auditData.commits?.slice(0, 15), null, 2)}

OBSERVED CLOSED BUG ISSUES:
${JSON.stringify(auditData.closedIssues?.slice(0, 10), null, 2)}

OBSERVED CLOSED PULL REQUESTS:
${JSON.stringify(auditData.closedPRs?.slice(0, 10), null, 2)}

DISCOVERED CONFIGS/MANIFESTS:
${JSON.stringify(auditData.manifests || [], null, 2)}

TASK INSTRUCTIONS:
Structure your response in markdown with the following EXACT sections:

# Forensic Learning Record: ${auditData.name}

## 1. Executive Forensic Architecture & System Mechanics
Explain the exact technical problem this repo solves, its architectural boundaries, and critical subsystem abstractions.

## 2. Deep Micro-Learnings & Runtime Gotchas (Chhoti se Chhoti Aur Badi se Badi Learnings)
Detail at least 4-6 specific micro-level failure modes, edge cases, or bugs uncovered from the issues and commits:
- Failure Mode / Pitfall: What went wrong?
- Root Cause: Why did it happen?
- Exact Prevention / Fix: Code pattern or guard to prevent it.

## 3. 8-Dimensional Multi-Axis Forensic Analysis
- **D1: Structural Boundaries & Modularity**:
- **D2: Asynchronous State & Concurrency Defense**:
- **D3: Error Boundaries, Recovery & Rollback Protocols**:
- **D4: Resource Lifecycle & Leak Defenses (Memory, Sockets, Descriptors)**:
- **D5: Boundary Deserialization, Schemas & Input Sanitization**:
- **D6: Cross-Platform & Runtime Compatibility Gotchas (Windows/Linux/Node/Browser)**:
- **D7: Build, CI/CD, Deployment & Dependency Invariants**:
- **D8: Concrete Bug Fixes & Forensic Patches**:

## 4. Net-New Universal Engineering Rules (Candidates for Master Brain)
Provide 1 or 2 net-new Universal Engineering Rules in the exact standard format:
## X. [Rule Title]

**RULE**:
[Clear statement of invariant]

**WHY**:
[Forensic technical explanation of failure modes avoided]

**WHEN TO APPLY**:
[Target subsystems, languages, or architectural boundaries]

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

  const ruleRegex = /##\s+(?:X|\d+)\.\s*(.+?)\n([\s\S]*?)(?=\n##\s+(?:X|\d+)\.|\n##\s+5\.|\Z)/gi;
  let match;
  const promotedRules = [];

  while ((match = ruleRegex.exec(geminiText)) !== null) {
    const ruleTitle = match[1].trim();
    const ruleBody = match[2].trim();

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
