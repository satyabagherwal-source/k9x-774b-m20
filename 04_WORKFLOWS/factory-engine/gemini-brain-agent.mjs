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
 * Call multi-provider AI pool with multi-key rotation and zero-cost fallback
 */
export async function callGeminiApi(prompt, systemInstruction = '') {
  return await dispatchZeroCostAiSynthesis(prompt, systemInstruction);
}

/**
 * Validates a rule candidate against strict schema and anti-corruption requirements.
 * Prevents agents from polluting or corrupting Master Brain knowledge base.
 */
export function validateRuleCandidate(ruleTitle, ruleBody) {
  if (!ruleTitle || typeof ruleTitle !== 'string' || ruleTitle.length < 5) {
    return { valid: false, reason: 'Invalid or missing rule title' };
  }

  // Reject generic headers or document structural titles
  if (/^(net-new|universal|forensic|executive|actionable|project|empirical|rule|checklist)/i.test(ruleTitle.trim())) {
    return { valid: false, reason: 'Generic header title rejected' };
  }

  if (!ruleBody || typeof ruleBody !== 'string' || ruleBody.trim().length < 200) {
    return { valid: false, reason: 'Rule body fails substance threshold (minimum 200 characters required)' };
  }

  // Mandatory fields check
  const hasRule = /\*\*RULE\*\*:?/i.test(ruleBody);
  const hasWhy = /\*\*WHY\*\*:?/i.test(ruleBody);
  const hasWhen = /\*\*WHEN TO APPLY\*\*:?/i.test(ruleBody);
  const hasPattern = /\*\*VERIFIED IMPLEMENTATION PATTERN\*\*:?/i.test(ruleBody);
  const hasNegative = /\*\*NEGATIVE CONSTRAINT\*\*:?/i.test(ruleBody);

  if (!hasRule) return { valid: false, reason: 'Missing mandatory **RULE** invariant' };
  if (!hasWhy) return { valid: false, reason: 'Missing mandatory **WHY** technical rationale' };
  if (!hasWhen) return { valid: false, reason: 'Missing mandatory **WHEN TO APPLY** context' };
  if (!hasPattern) return { valid: false, reason: 'Missing mandatory **VERIFIED IMPLEMENTATION PATTERN**' };
  if (!hasNegative) return { valid: false, reason: 'Missing mandatory **NEGATIVE CONSTRAINT** anti-pattern' };

  // Must contain verified code blocks
  const codeBlockCount = (ruleBody.match(/```/g) || []).length;
  if (codeBlockCount < 2) {
    return { valid: false, reason: 'Rule must contain at least one implementation code block and one negative constraint block' };
  }

  return { valid: true };
}

/**
 * Deep Intelligence Synthesis:
 * Implements the 9 Deep Learning Dimensions and extracts all 8 Learning Artifacts.
 */
export async function synthesizeIntelligenceWithGemini(auditData) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    console.warn(`⚠️ [GEMINI SERVER-TO-SERVER NOTICE] GEMINI_API_KEY is not configured.`);
    return null;
  }

  const systemInstruction = `You are the Lead Autonomous Systems Forensic Architect for AI-Builder-Brain (Canonical Root: C:\\AI-Builder-Brain).
Your mission is to perform an EXHAUSTIVE, FULL-SPECTRUM, DEEP FORENSIC LEARNING EXTRACTION ("totally puri learning nichod lena") from software repositories.
You NEVER write high-level summaries, promotional fluff, or generic bullet points.

CRITICAL ARCHITECTURAL MANDATES:
1. THE 9 DEEP LEARNING DIMENSIONS:
Analyze the target codebase across all 9 rigorous technical dimensions:
- 1. Architecture: Subsystem boundaries, decoupling, modular layout, state ownership.
- 2. Core Abstractions: Key types, traits, interfaces, domain primitives, invariant contracts.
- 3. Error Handling: Fault boundaries, error trees, retries, rollbacks, graceful degradation.
- 4. Testing: Property testing, mock invariants, integration harnesses, regression shields.
- 5. Security: Threat model, credential boundaries, sanitization, memory safety, least privilege.
- 6. Performance: Latency profiles, asymptotic complexity, caching, zero-copy, concurrency bottlenecks.
- 7. Deployment: CI/CD invariants, container constraints, reproducible builds, runtime flags.
- 8. Agent Patterns: Tooling interfaces, prompt chains, loop guards, context budget optimization.
- 9. Data Flow: Mutation lifecycles, streams, serializers, network protocol barriers.

2. THE 8 LEARNING EXTRACTION ARTIFACTS:
For every key insight, extract all 8 distinct learning artifacts:
- 1. Pattern: Verified, production-grade implementation pattern with concrete code.
- 2. Rule: Universal invariant (MUST / MUST NOT) to enforce across software systems.
- 3. Architecture Principle: High-level architectural law and structural trade-off.
- 4. Failure Mode: Precise technical breakdown of the bug/crash/exploit observed.
- 5. Reusable Skill: Step-by-step procedural workflow/checklist for an AI coding agent.
- 6. Decision: Engineering design trade-off and forensic rationale why alternatives were rejected.
- 7. Anti-pattern: Negative constraint with concrete "bad code" to NEVER write.
- 8. Verification Method: Concrete automated test, assert, lint, or check to prove compliance.`;

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

## 2. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)
For each real bug fix/incident discovered from the commits, patches, and issues, document:
### Incident X: [Specific Technical Title] (BUG-[SLUG]-0X)
- **Context**: Subsystem and file path
- **What Was Expected**: The required functional and invariant behavior
- **What Actually Happened**: The precise failure mode
- **Evidence in Repo**: Commit SHA, PR link, exact file path, and tests
- **Root Cause**: Deep forensic root-cause analysis
- **Remediation Code Diff**:
\`\`\`language
// - Buggy code / What failed
// + Fixed pattern / Safe invariant
\`\`\`
- **Lesson**: Generalized engineering invariant

## 3. The 9 Deep Learning Dimensions
Provide deep technical analysis across all 9 core dimensions:
1. **Architecture**: Subsystem layout, modular boundaries, decoupling strategy.
2. **Core Abstractions**: Foundational types, domain interfaces, invariant contracts.
3. **Error Handling**: Exception hierarchies, recovery barriers, rollback strategies.
4. **Testing**: Unit invariants, mock philosophies, automated regression shields.
5. **Security**: Threat mitigation, input sanitization, capability containment.
6. **Performance**: Allocation bottlenecks, memory caching, algorithmic optimizations.
7. **Deployment**: Container definitions, CI/CD pipeline invariants, runtime configs.
8. **Agent Patterns**: Autonomous tool integrations, execution loop bounds, memory caching.
9. **Data Flow**: Mutation lifecycle, serialization protocols, asynchronous pipelines.

## 4. The 8 Learning Extraction Artifacts
Synthesize the extracted intelligence into the 8 canonical artifacts:
1. **Pattern**: Production-grade verified pattern with complete code.
2. **Rule**: Strict universal invariant (MUST / MUST NOT).
3. **Architecture Principle**: Enduring architectural law.
4. **Failure Mode**: Concrete breakdown of observed failure mode.
5. **Reusable Skill**: Actionable step-by-step procedure for AI coding agents.
6. **Decision**: Architectural trade-off analysis and why chosen over alternatives.
7. **Anti-pattern**: Negative constraint with concrete code block of what NEVER to write.
8. **Verification Method**: Concrete test or assertion to prove invariant compliance.

## 5. Net-New Universal Engineering Rules (Candidates for Master Brain)
Provide 1 to 3 net-new Universal Engineering Rules in the exact standard format:
## X. [Rule Title]
**RULE**:
[Clear statement of invariant]
**WHY**:
[Forensic technical explanation of failure modes avoided]
**WHEN TO APPLY**:
[Target subsystems, languages, or architectural boundaries]
**VERIFIED IMPLEMENTATION PATTERN**:
\`\`\`language
// Complete, working pattern
\`\`\`
**NEGATIVE CONSTRAINT**:
\`\`\`language
// Anti-pattern to NEVER write
\`\`\`
**VERIFICATION METHOD**:
[Automated test, assertion, or linter rule to verify compliance]

## 6. Actionable Agent Skill & Implementation Checklist
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
 * Gated Master Brain Rule Promotion:
 * Prevents agents from corrupting the Master Brain by enforcing strict validation
 * before any rule can be appended to 05_KNOWLEDGE/engineering-patterns.md.
 */
export function promoteGeminiRulesToMasterBrain(geminiText, sourceRepoName) {
  if (!geminiText || !fs.existsSync(PATTERNS_PATH)) return [];

  const ruleRegex = /(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?\s*(.+?)\n([\s\S]*?)(?=(?:\n(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?|\n##\s+6\.|\n###\s+6\.|\Z))/gi;
  let match;
  const promotedRules = [];

  while ((match = ruleRegex.exec(geminiText)) !== null) {
    const ruleTitle = match[1].trim();
    const ruleBody = match[2].trim();

    // 1. Anti-Corruption Validation Gate
    const validation = validateRuleCandidate(ruleTitle, ruleBody);
    if (!validation.valid) {
      console.warn(`🛡️ [CORRUPTION GUARD] Rejected rule candidate "${ruleTitle}" from Master Brain: ${validation.reason}. Preserved in Project Learning record.`);
      continue;
    }

    // 2. Duplicate Detection
    const currentPatterns = fs.readFileSync(PATTERNS_PATH, 'utf-8');
    if (currentPatterns.toLowerCase().includes(ruleTitle.toLowerCase())) {
      console.log(`[RULE ALREADY EXISTS] Skipping duplicate rule: "${ruleTitle}"`);
      continue;
    }

    // 3. Gated Master Brain Mutation
    const nextRuleNum = resolveNextRuleNumber();
    const formattedRule = `\n\n---\n\n## ${nextRuleNum}. ${ruleTitle} (Harvested from ${sourceRepoName})\n\n${ruleBody}\n`;

    fs.appendFileSync(PATTERNS_PATH, formattedRule, 'utf-8');
    console.log(`🌟 [GATED PROMOTION VERIFIED] Rule ${nextRuleNum}: "${ruleTitle}" validated and safely promoted to Master Brain.`);
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
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: ${new Date().toISOString()}  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

`;

  fs.writeFileSync(filePath, header + geminiText, 'utf-8');
  console.log(`📄 [LEARNING RECORD SAVED] ${filePath}`);
  return filePath;
}
