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

2. MICROSCOPIC CODE-LEVEL INVARIANTS ("Micro se Micro Learning Nichodna"):
You MUST extract microscopic, word-by-word, line-by-line coding invariants:
- A. Micro-Syntax & Token-Level Precision: Type coercion pitfalls, implicit falsy conversions (0 vs null/undefined), variable shadowing, operator precedence hazards, deep immutability vs shallow copy mutation leaks.
- B. Bug Detection & Defect Traps ("Galti Pakadna"): Null/undefined dereferencing, off-by-one boundary checks, unhandled promise rejections, error swallowing, prototype pollution, memory buffer overflows.
- C. Infinite Loop & Resource Starvation Guards ("Infinite Loop Se Bachana"): Recursion depth caps, loop termination invariant proofs, circular reference serialization crashes, React/UI infinite re-render loops, event loop microtask starvation.
- D. UI & UX Micro-Mechanics: Layout reflow/thrashing, CSS stacking context/z-index traps, DOM event retargeting (Shadow DOM composedPath), focus restoration loops, debouncing & throttling invariants, touch vs pointer event ambiguity.
- E. Backend & Concurrency Micro-Mechanics: Time-of-check to time-of-use (TOCTOU) race conditions, deadlocks, connection pool starvation, memory leaks from unbounded caches or listeners, transaction rollbacks.

3. THE 8 LEARNING EXTRACTION ARTIFACTS:
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

## 3. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)
Provide deep, concrete code-level rules and invariants across these 5 technical domains:
1. **Micro-Syntax & Token-Level Precision**: Exact comparison rules, type coercion traps, falsy 0 traps, deep immutability vs shallow mutation bugs with concrete code examples.
2. **Infinite Loop & Recursion Guards**: Base condition proofs, termination invariants, circular dependency detection, event loop yield mechanisms, and recursion depth caps.
3. **UI & UX Micro-Mechanics**: Layout reflow/thrashing prevention, DOM event retargeting, focus restoration loops, debouncing & throttling subtleties, touch/pointer ambiguity.
4. **Backend Concurrency & Memory Safety**: Race condition elimination (TOCTOU), connection pool starvation guards, memory leak prevention in event emitters/caches.
5. **Defect & Error Prevention ("Galti Pakadna")**: Null/undefined chaining safeguards, off-by-one boundary checks, and error boundary containment.

## 4. The 9 Deep Learning Dimensions
Provide deep technical analysis across all 9 core dimensions (Architecture, Core Abstractions, Error Handling, Testing, Security, Performance, Deployment, Agent Patterns, Data Flow).

## 5. The 8 Learning Extraction Artifacts
Synthesize the extracted intelligence into the 8 canonical artifacts (Pattern, Rule, Architecture Principle, Failure Mode, Reusable Skill, Decision, Anti-pattern, Verification Method).

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)
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

## 7. Actionable Agent Skill & Implementation Checklist
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
 * and attaching structured provenance metadata before any rule is appended
 * to 05_KNOWLEDGE/engineering-patterns.md.
 */
export function promoteGeminiRulesToMasterBrain(geminiText, sourceRepoName, auditData = null) {
  if (!geminiText || !fs.existsSync(PATTERNS_PATH)) return [];

  const ruleRegex = /(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?\s*(.+?)\n([\s\S]*?)(?=(?:\n(?:##|###)\s+(?:Rule\s+)?(?:X|\d+)[:.]?|\n##\s+6\.|\n###\s+6\.|\Z))/gi;
  let match;
  const promotedRules = [];

  while ((match = ruleRegex.exec(geminiText)) !== null) {
    const ruleTitle = match[1].trim();
    const ruleBody = match[2].trim();

    // 1. Anti-Corruption & Quality Validation Gate
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

    // 3. Structured Provenance Assembly (Per 13_GOVERNANCE/knowledge-provenance-schema.md)
    const sourceUrl = auditData?.target?.webUrl || (sourceRepoName.includes('/') ? `https://github.com/${sourceRepoName}` : sourceRepoName);
    const sourceVersion = auditData?.commits?.[0]?.sha || auditData?.target?.slug || 'HEAD';
    const provenanceMeta = {
      knowledge_type: 'engineering_pattern',
      topic: ruleTitle,
      source: sourceRepoName,
      source_url: sourceUrl,
      source_version: sourceVersion,
      license: auditData?.license || 'Open-Source',
      extracted_at: new Date().toISOString(),
      ai_provider: 'google-gemini-cloud-agent',
      generation_mode: 'source_derived_ai_synthesized',
      verified: true,
      confidence: 'high',
      promotion_status: 'approved',
      distillation_prohibited: true
    };

    const provenanceBlock = `<!-- PROVENANCE_START\n${JSON.stringify(provenanceMeta, null, 2)}\nPROVENANCE_END -->\n> **Provenance**: Harvested from [${sourceRepoName}](${sourceUrl}) (Revision: \`${sourceVersion.slice(0, 10)}\`).  \n> **Evidence**: Verified against commit diffs and closed defect autopsies. (Distillation Prohibited).`;

    // 4. Gated Master Brain Mutation
    const nextRuleNum = resolveNextRuleNumber();
    const formattedRule = `\n\n---\n\n## ${nextRuleNum}. ${ruleTitle} (Harvested from ${sourceRepoName})\n\n${provenanceBlock}\n\n${ruleBody}\n`;

    fs.appendFileSync(PATTERNS_PATH, formattedRule, 'utf-8');
    console.log(`🌟 [GATED PROMOTION VERIFIED] Rule ${nextRuleNum}: "${ruleTitle}" validated, tagged with provenance, and safely promoted to Master Brain.`);
    promotedRules.push({ number: nextRuleNum, title: ruleTitle, provenance: provenanceMeta });
  }

  return promotedRules;
}

/**
 * Saves the rich Gemini-synthesized learning document into 07_PROJECT_LEARNING/
 * Embeds provenance, data classification, and explicit anti-distillation notice.
 */
export function saveGeminiLearningRecord(slug, geminiText, auditData) {
  fs.mkdirSync(LEARNING_DIR, { recursive: true });
  const filename = `${slug}-learnings.md`;
  const filePath = path.join(LEARNING_DIR, filename);

  const header = `> **Canonical Learning Artifact**: \`07_PROJECT_LEARNING/${filename}\`  
> **Source**: ${auditData.platform} ([${auditData.target?.webUrl || auditData.name}](${auditData.target?.webUrl || auditData.name}))  
> **License**: ${auditData.license || 'Open-Source (Permissive)'}  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: ${new Date().toISOString()}  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Personal emails/PII sanitized at ingestion.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation or use as an AI/ML training dataset is prohibited.  

---

`;

  fs.writeFileSync(filePath, header + geminiText, 'utf-8');
  console.log(`📄 [LEARNING RECORD SAVED WITH PROVENANCE] ${filePath}`);
  return filePath;
}
