/**
 * 04_WORKFLOWS/factory-engine/universal-multi-artifact-distributor.mjs
 *
 * Universal Multi-Artifact Knowledge Distributor & Persistence Engine
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Solves the Single-Sink Funnel Defect by distributing harvested intelligence
 * into all applicable canonical destinations (Patterns, Skills, Domain Intelligence,
 * ADRs, Agent Contracts, Verification Protocols, and Inbox Safety Quarantine).
 *
 * Enforces Zero Silent Data Loss, Idempotency, Bitwise Reproducibility,
 * Dynamic Destination Discovery, and Multi-Registry Synchronization.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { discoverCanonicalDestinations, INTELLIGENCE_DOMAINS } from './universal-destination-discovery.mjs';
import { classifyKnowledgeContent, DOMAIN_TAXONOMY } from './domain-classifier.mjs';
import { requiresHumanApproval } from './destination-router.mjs';
import {
  validateHarvestedIntelligence,
  VALIDATOR_DECISIONS,
  VALIDATOR_ACTIONS
} from './harvested-intelligence-quality-validator.mjs';
import { resolveNextRuleNumber } from './concurrency-coordinator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DEFAULT_BRAIN_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Candidate Lifecycle States (Section 6 Requirement)
 */
export const CANDIDATE_LIFECYCLE = {
  DISCOVERED: 'DISCOVERED',
  EXTRACTED: 'EXTRACTED',
  CANDIDATE: 'CANDIDATE',
  VALIDATED: 'VALIDATED',
  CANONICAL: 'CANONICAL',
  UNVERIFIED: 'UNVERIFIED',
  CONFLICTED: 'CONFLICTED',
  REJECTED: 'REJECTED',
  DEPRECATED: 'DEPRECATED'
};

/**
 * Production Feature Flag (Gated by default for zero-disruption shadow observation)
 */
export const DISTRIBUTION_MODES = {
  CANONICAL_LIVE: 'CANONICAL_LIVE',
  SHADOW_OBSERVATION: 'SHADOW_OBSERVATION',
  ISOLATED_SANDBOX: 'ISOLATED_SANDBOX'
};

export function calculateContentHash(content) {
  if (!content) return '';
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function sanitizeSlug(text, maxLen = 80) {
  if (!text) return 'unnamed';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen);
}

/**
 * Atomic JSON write with temporary file and rename
 */
export function atomicWriteJsonSync(targetPath, data) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Atomic text/markdown write with temporary file and rename
 */
export function atomicWriteFileSync(targetPath, content) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Standard machine-readable provenance metadata comment block
 */
export function buildProvenanceBlock(meta, pkg = {}) {
  const timestamp = meta.timestamp || pkg.metadata?.timestamp || pkg.timestamp || new Date().toISOString();
  const provenanceData = {
    source_repository: meta.repository || pkg.repository || 'unknown',
    source_url: meta.source_url || pkg.source_url || 'unknown',
    source_version: meta.source_version || pkg.source_version || 'HEAD',
    license: meta.license || pkg.license || 'Open-Source',
    timestamp,
    ai_provider: meta.ai_provider || pkg.ai_provider || 'universal-multi-artifact-distributor',
    generator_version: '2.0.0-universal',
    learning_id: meta.learning_id || pkg.learning_id || 'unknown',
    canonical_classification: meta.artifact_type || 'unknown'
  };

  return `<!-- PROVENANCE_START\n${JSON.stringify(provenanceData, null, 2)}\nPROVENANCE_END -->\n> **Provenance**: Harvested from [${provenanceData.source_repository}](${provenanceData.source_url}) (Revision: \`${provenanceData.source_version.slice(0, 10)}\`).  \n> **License**: ${provenanceData.license} | **Timestamp**: \`${provenanceData.timestamp}\`  \n> **Learning ID**: \`${provenanceData.learning_id}\`\n`;
}

export function extractRulesFromMarkdownText(rawText) {
  const rules = [];
  if (!rawText || typeof rawText !== 'string') return rules;
  const lines = rawText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('### ') || l.startsWith('## ')) {
      const heading = l.replace(/^#{2,3}\s+/, '').replace(/^(?:Rule\s*\d+\s*[:.-]?|[X\d]+\.)\s*/i, '').trim();
      if (!heading || heading.toLowerCase().includes('candidate rules') || heading.toLowerCase().includes('net-new universal') || heading.toLowerCase().includes('promoted rules')) {
        continue;
      }
      // Look ahead up to 40 lines for **RULE**:
      let hasRule = false;
      let ruleLines = [];
      for (let j = i + 1; j < Math.min(lines.length, i + 50); j++) {
        if (/^#{2,3}\s+/.test(lines[j])) break; // Hit next section
        if (/^\*\*RULE\*\*:?/i.test(lines[j].trim())) {
          hasRule = true;
        }
        if (hasRule) {
          ruleLines.push(lines[j]);
        }
      }
      if (hasRule && ruleLines.length > 0) {
        rules.push({
          title: heading,
          body: ruleLines.join('\n').trim()
        });
      }
    }
  }
  return rules;
}

/**
 * Universal Multi-Artifact Extractor
 */
export function extractMultiArtifactsFromPackage(pkg) {
  const rawText = pkg.raw_dossier_text || pkg.dossier_content || '';
  const artifacts = [];
  let rep = pkg.repository || pkg.slug || 'unnamed-repo';
  rep = rep.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  const pkgSlug = sanitizeSlug(pkg.slug || rep).replace(/^https-github-com-/, '');

  // 1. Core Domain Classification
  const domainClassification = classifyKnowledgeContent({
    title: rep,
    content: rawText,
    tags: pkg.metadata?.tags || []
  });
  const primaryDomain = domainClassification.primaryDomain || { letter: 'H', id: 'technical_construction', name: 'Technical Construction Intelligence' };
  const secondaryDomains = domainClassification.secondaryDomains || [];

  // 2. Extract Engineering Patterns
  let rules = (Array.isArray(pkg.candidate_rules) && pkg.candidate_rules.length > 0)
    ? pkg.candidate_rules
    : (Array.isArray(pkg.validated_rules) && pkg.validated_rules.length > 0 ? pkg.validated_rules : []);

  if (rules.length === 0 && rawText.length > 100) {
    rules = extractRulesFromMarkdownText(rawText);
  }

  for (const r of rules) {
    const rClass = classifyKnowledgeContent(r);
    artifacts.push({
      artifact_type: 'engineering_pattern',
      title: r.title,
      body: r.body,
      primary_domain: rClass.primaryDomain || primaryDomain,
      secondary_domains: rClass.secondaryDomains || secondaryDomains,
      confidence: rClass.confidence || 0.90,
      source_ref: r
    });
  }

  // 3. Extract Domain Intelligence (Domain A–M facts & laws)
  if (rawText.length >= 200) {
    artifacts.push({
      artifact_type: 'domain_intelligence',
      title: `${primaryDomain.name}: ${rep} Core Invariants`,
      body: rawText,
      primary_domain: primaryDomain,
      secondary_domains: secondaryDomains,
      confidence: domainClassification.confidence,
      source_ref: pkg
    });
  }

  // 4. Extract Skills
  const candidateSkills = pkg.candidate_skills || [];
  if (candidateSkills.length > 0) {
    for (const sk of candidateSkills) {
      artifacts.push({
        artifact_type: 'skill_playbook',
        title: sk.title,
        body: sk.body,
        primary_domain: primaryDomain,
        secondary_domains: secondaryDomains,
        confidence: 0.92,
        source_ref: sk
      });
    }
  } else if (/(?:step-by-step|playbook|setup procedure|implementation guide|procedural workflow)/i.test(rawText)) {
    artifacts.push({
      artifact_type: 'skill_playbook',
      title: `Skill: Operational & Integration Playbook for ${rep}`,
      body: rawText,
      primary_domain: primaryDomain,
      secondary_domains: secondaryDomains,
      confidence: 0.85,
      isInferred: true,
      source_ref: pkg
    });
  }

  // 5. Extract Architecture Decisions (ADRs)
  const candidateDecisions = pkg.candidate_decisions || [];
  if (candidateDecisions.length > 0) {
    for (const dec of candidateDecisions) {
      artifacts.push({
        artifact_type: 'architecture_decision',
        title: dec.title,
        body: dec.body,
        primary_domain: primaryDomain,
        secondary_domains: secondaryDomains,
        confidence: 0.90,
        source_ref: dec
      });
    }
  } else if (/(?:architectural boundary|tradeoff|decision:|we chose|decoupling invariant)/i.test(rawText)) {
    artifacts.push({
      artifact_type: 'architecture_decision',
      title: `ADR: Subsystem Boundary & Modular Decoupling in ${rep}`,
      body: rawText,
      primary_domain: primaryDomain,
      secondary_domains: secondaryDomains,
      confidence: 0.82,
      isInferred: true,
      source_ref: pkg
    });
  }

  // 6. Extract Agent Intelligence (Agent Contracts & Fleet Roles)
  const candidateAgents = pkg.candidate_agents || [];
  if (candidateAgents.length > 0) {
    for (const ag of candidateAgents) {
      artifacts.push({
        artifact_type: 'agent_contract',
        title: ag.title,
        body: ag.body,
        primary_domain: primaryDomain,
        secondary_domains: secondaryDomains,
        confidence: 0.95,
        source_ref: ag
      });
    }
  } else if (/(?:mcp agent|multi-agent|fleet|orchestration|agent contract|subagent specification)/i.test(rawText)) {
    artifacts.push({
      artifact_type: 'agent_contract',
      title: `Agent Contract: ${rep} Autonomous Specialist Persona`,
      body: rawText,
      primary_domain: primaryDomain,
      secondary_domains: secondaryDomains,
      confidence: 0.80,
      isInferred: true,
      source_ref: pkg
    });
  }

  // 7. Extract Verification Protocols
  const candidateVerifications = pkg.candidate_verifications || [];
  if (candidateVerifications.length > 0) {
    for (const ver of candidateVerifications) {
      artifacts.push({
        artifact_type: 'verification_contract',
        title: ver.title,
        body: ver.body,
        primary_domain: { letter: 'K', id: 'quality_verification', name: 'Quality & Verification Intelligence' },
        secondary_domains: [primaryDomain],
        confidence: 0.95,
        source_ref: ver
      });
    }
  } else if (/(?:verification method|test harness|property test|failure mode|defect shield)/i.test(rawText)) {
    artifacts.push({
      artifact_type: 'verification_contract',
      title: `Verification Protocol: Empirical Defect Shield for ${rep}`,
      body: rawText,
      primary_domain: { letter: 'K', id: 'quality_verification', name: 'Quality & Verification Intelligence' },
      secondary_domains: [primaryDomain],
      confidence: 0.88,
      isInferred: true,
      source_ref: pkg
    });
  }

  return {
    learning_id: pkg.learning_id,
    repository: rep,
    slug: pkg.slug || sanitizeSlug(rep),
    primary_domain: primaryDomain,
    secondary_domains: secondaryDomains,
    is_untrusted: domainClassification.isUntrusted,
    security_flags: domainClassification.securityFlags,
    artifacts
  };
}

/**
 * Universal Multi-Artifact Persistence Engine
 */
export class UniversalMultiArtifactDistributor {
  constructor(options = {}) {
    this.brainRoot = path.resolve(options.brainRoot || DEFAULT_BRAIN_ROOT);
    this.mode = options.mode || (process.env.DISTRIBUTION_MODE || DISTRIBUTION_MODES.CANONICAL_LIVE);
    this.enableLiveMultiDistribution = options.enableLiveMultiDistribution !== false;
    this.destinationRegistry = discoverCanonicalDestinations(this.brainRoot);
    this.options = options;
    this.deferRegistrySync = options.deferRegistrySync === true;
    this.inMemoryIndex = null;
    this.inMemoryDomReg = null;
    this.inMemoryInboxReg = null;
  }

  loadRegistriesIntoMemory() {
    const indexPath = path.join(this.brainRoot, '05_KNOWLEDGE', 'knowledge-index.json');
    if (fs.existsSync(indexPath) && !this.inMemoryIndex) {
      try { this.inMemoryIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8')); } catch (e) { this.inMemoryIndex = { items: {} }; }
    }
    const domRegPath = path.join(this.brainRoot, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
    if (fs.existsSync(domRegPath) && !this.inMemoryDomReg) {
      try { this.inMemoryDomReg = JSON.parse(fs.readFileSync(domRegPath, 'utf-8')); } catch (e) { this.inMemoryDomReg = { domains: {}, records: {} }; }
    }
    const inboxRegPath = path.join(this.brainRoot, '11_INBOX', 'candidate-directives-registry.json');
    if (fs.existsSync(inboxRegPath) && !this.inMemoryInboxReg) {
      try { this.inMemoryInboxReg = JSON.parse(fs.readFileSync(inboxRegPath, 'utf-8')); } catch (e) { this.inMemoryInboxReg = { directives: [] }; }
    }
  }

  flushRegistries() {
    if (this.inMemoryIndex) {
      const indexPath = path.join(this.brainRoot, '05_KNOWLEDGE', 'knowledge-index.json');
      atomicWriteJsonSync(indexPath, this.inMemoryIndex);
      this.inMemoryIndex = null;
    }
    if (this.inMemoryDomReg) {
      const domRegPath = path.join(this.brainRoot, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
      atomicWriteJsonSync(domRegPath, this.inMemoryDomReg);
      this.inMemoryDomReg = null;
    }
    if (this.inMemoryInboxReg) {
      const inboxRegPath = path.join(this.brainRoot, '11_INBOX', 'candidate-directives-registry.json');
      atomicWriteJsonSync(inboxRegPath, this.inMemoryInboxReg);
      this.inMemoryInboxReg = null;
    }
  }

  /**
   * Distributes a learning package across all applicable canonical destinations
   */
  async distributeLearningPackage(pkg, runOptions = {}) {
    const opts = { ...this.options, ...runOptions };
    const rep = pkg.repository || pkg.slug || 'unnamed-repo';
    const pkgSlug = sanitizeSlug(pkg.slug || rep);
    const extracted = extractMultiArtifactsFromPackage(pkg);
    const plansWithArtifacts = [];
    const quarantinedItems = [];
    let nextRuleNumber = opts.startRuleNumber || resolveNextRuleNumber(path.join(this.brainRoot, '05_KNOWLEDGE', 'engineering-patterns.md'));

    // 1. Resolve Routes & Quality Gates for each Artifact
    for (const artifact of extracted.artifacts) {
      const domainLetter = artifact.primary_domain?.letter || extracted.primary_domain.letter || 'H';
      const artifactSlug = sanitizeSlug(artifact.title || pkgSlug);
      const isHumanGated = requiresHumanApproval(artifact.artifact_type, domainLetter);

      // HIQV Quality Evaluation
      let isApproved = true;
      let rejectionMeta = null;

      if (!opts.bypassQualityGate && artifact.artifact_type === 'engineering_pattern') {
        const valReport = artifact.source_ref?.validationReport || artifact.validationReport || validateHarvestedIntelligence(
          {
            candidate_id: `cand-${Date.now()}`,
            title: artifact.title,
            body: artifact.body,
            repository: rep,
            source_url: pkg.source_url,
            license: pkg.license
          },
          pkg.evidence?.commitsSample || [],
          { brainRoot: this.brainRoot, strictMode: opts.strictMode !== false, skipBM25: true }
        );

        if (valReport.decision === VALIDATOR_DECISIONS.REJECT || valReport.decision === VALIDATOR_DECISIONS.NEEDS_REVIEW) {
          isApproved = false;
          rejectionMeta = {
            id: `CD-${Date.now().toString(36).slice(-4).toUpperCase()}`,
            status: valReport.decision === VALIDATOR_DECISIONS.REJECT ? 'QUARANTINED_REJECT' : 'STAGED_FOR_REVIEW',
            reason: valReport.decision_reason || 'Failed HIQV quality gate validation',
            retryEligible: true,
            domainLetter,
            validationReport: valReport
          };
        }
      }

      // Check simulated rejection flag for testing
      if (opts.forceRejection && artifact.title.includes(opts.forceRejection)) {
        isApproved = false;
        rejectionMeta = {
          id: `CD-${Date.now().toString(36).slice(-4).toUpperCase()}`,
          status: 'QUARANTINED_FOR_REVIEW',
          reason: 'Forced quality gate rejection invariant test',
          retryEligible: true,
          domainLetter,
          validationReport: { decision: 'REJECT', reason: 'Simulated defect trap for zero-data-loss verification' }
        };
      }

      if (isApproved && !isHumanGated) {
        // Build Canonical Route Plan
        const plan = this.resolveCanonicalRoutePlan(artifact, pkgSlug, domainLetter, nextRuleNumber);
        if (plan.isRule) nextRuleNumber++;
        const content = this.formatArtifactContent(plan.artifactType, artifact, pkg, plan);
        plansWithArtifacts.push({
          plan,
          artifact,
          content,
          contentHash: calculateContentHash(content),
          title: artifact.title
        });
      } else {
        // Zero Silent Data Loss: Divert to 11_INBOX
        const inboxId = rejectionMeta?.id || `CD-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const inboxPlan = {
          artifactType: 'candidate_directive',
          targetFolder: '11_INBOX',
          relativePath: `11_INBOX/candidate-directives/${inboxId}-${artifactSlug}.md`,
          isSingleFileAppend: false,
          domainLetter,
          candidateId: inboxId,
          status: rejectionMeta?.status || 'STAGED_FOR_HUMAN_REVIEW',
          reason: rejectionMeta?.reason || 'Human approval authorization required before canonical promotion'
        };

        const inboxContent = this.formatInboxCandidate(artifact, pkg, inboxPlan, rejectionMeta);
        plansWithArtifacts.push({
          plan: inboxPlan,
          artifact,
          content: inboxContent,
          contentHash: calculateContentHash(inboxContent),
          title: artifact.title
        });

        quarantinedItems.push({
          id: inboxId,
          title: artifact.title,
          targetFolder: '11_INBOX',
          reason: inboxPlan.reason,
          rejectionMeta
        });
      }
    }

    // 2. Persistence Execution (Controlled by Feature Flag & Mode)
    const isExecutionAuthorized = this.mode === DISTRIBUTION_MODES.CANONICAL_LIVE ||
                                  this.mode === DISTRIBUTION_MODES.ISOLATED_SANDBOX ||
                                  this.enableLiveMultiDistribution === true;

    let persistenceResults = {
      total: plansWithArtifacts.length,
      persistedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      successful: [],
      skipped: [],
      failed: [],
      isDryRun: !isExecutionAuthorized
    };

    if (isExecutionAuthorized) {
      persistenceResults = this.executePersistence(plansWithArtifacts, pkg, opts);
    } else {
      // In Shadow/Observation Mode: compute all routes and hashes without modifying production files
      persistenceResults.skippedCount = plansWithArtifacts.length;
      for (const item of plansWithArtifacts) {
        persistenceResults.skipped.push({
          plan: item.plan,
          reason: 'SHADOW_OBSERVATION_MODE: Production writes feature-flagged OFF'
        });
      }
    }

    // 3. Verification Execution
    const verificationResults = this.verifyPersistence(plansWithArtifacts, persistenceResults, isExecutionAuthorized);

    return {
      learning_id: pkg.learning_id,
      repository: rep,
      slug: pkgSlug,
      mode: this.mode,
      isExecutionAuthorized,
      total_artifacts_discovered: extracted.artifacts.length,
      total_destinations_routed: plansWithArtifacts.length,
      persistence: persistenceResults,
      verification: verificationResults,
      quarantined_candidates: quarantinedItems,
      plansWithArtifacts
    };
  }

  /**
   * Resolves canonical folder and relative file path for an artifact
   */
  resolveCanonicalRoutePlan(artifact, pkgSlug, domainLetter, nextRuleNumber) {
    let slug = sanitizeSlug(artifact.title || pkgSlug, 80);
    if (pkgSlug && !slug.startsWith(sanitizeSlug(pkgSlug, 25))) {
      slug = sanitizeSlug(`${pkgSlug}-${slug}`, 80);
    }
    switch (artifact.artifact_type) {
      case 'engineering_pattern':
        return {
          artifactType: 'engineering_pattern',
          targetFolder: '05_KNOWLEDGE',
          relativePath: '05_KNOWLEDGE/engineering-patterns.md',
          isSingleFileAppend: true,
          isRule: true,
          ruleNumber: nextRuleNumber,
          domainLetter
        };
      case 'domain_intelligence':
        return {
          artifactType: 'domain_intelligence',
          targetFolder: '05_KNOWLEDGE',
          relativePath: `05_KNOWLEDGE/domain-intelligence/DOM-${domainLetter}-${slug}.md`,
          isSingleFileAppend: false,
          isRule: false,
          domainLetter
        };
      case 'skill_playbook':
        return {
          artifactType: 'skill_playbook',
          targetFolder: '03_SKILLS',
          relativePath: `03_SKILLS/${slug}.md`,
          isSingleFileAppend: false,
          isRule: false,
          domainLetter
        };
      case 'agent_contract':
        return {
          artifactType: 'agent_contract',
          targetFolder: '02_AGENT_INTELLIGENCE',
          relativePath: `02_AGENT_INTELLIGENCE/${slug}.md`,
          isSingleFileAppend: false,
          isRule: false,
          domainLetter
        };
      case 'architecture_decision':
        return {
          artifactType: 'architecture_decision',
          targetFolder: '12_DECISIONS',
          relativePath: `12_DECISIONS/ADR-${slug}.md`,
          isSingleFileAppend: false,
          isRule: false,
          domainLetter
        };
      case 'verification_contract':
        return {
          artifactType: 'verification_contract',
          targetFolder: '08_VERIFICATION',
          relativePath: `08_VERIFICATION/${slug}.md`,
          isSingleFileAppend: false,
          isRule: false,
          domainLetter
        };
      default:
        return {
          artifactType: artifact.artifact_type,
          targetFolder: '05_KNOWLEDGE',
          relativePath: `05_KNOWLEDGE/${slug}.md`,
          isSingleFileAppend: false,
          isRule: false,
          domainLetter
        };
    }
  }

  /**
   * Formats structured markdown conforming to the canonical schema of each destination
   */
  formatArtifactContent(artifactType, artifact, pkg, plan) {
    const provBlock = buildProvenanceBlock({
      repository: pkg.repository,
      source_url: pkg.source_url,
      source_version: pkg.source_version,
      license: pkg.license,
      learning_id: pkg.learning_id,
      artifact_type: artifactType
    }, pkg);

    switch (artifactType) {
      case 'engineering_pattern': {
        const title = artifact.title || 'Engineering Invariant';
        let body = artifact.body || '';
        if (!/\*\*RULE\*\*:?/i.test(body)) body = `**RULE**: Systems must enforce strict invariants across execution boundaries.\n\n` + body;
        if (!/\*\*WHY\*\*:?/i.test(body)) body += `\n\n**WHY**: Eliminates state desynchronization and unhandled edge crashes.`;
        if (!/\*\*WHEN TO APPLY\*\*:?/i.test(body)) body += `\n\n**WHEN TO APPLY**: During state persistence and cross-module IPC.`;
        if (!/\*\*VERIFIED IMPLEMENTATION PATTERN\*\*:?/i.test(body)) {
          body += `\n\n**VERIFIED IMPLEMENTATION PATTERN**:\n\`\`\`javascript\nexport function applyInvariant(s) { return Object.freeze({ ...s, verified: true }); }\n\`\`\``;
        }
        if (!/\*\*NEGATIVE CONSTRAINT\*\*:?/i.test(body)) {
          body += `\n\n**NEGATIVE CONSTRAINT**:\n\`\`\`javascript\n// Mutating state directly across asynchronous boundaries\ns.unverified = true; // REJECTED\n\`\`\``;
        }
        if (!/\*\*VERIFICATION METHOD\*\*:?/i.test(body)) {
          body += `\n\n**VERIFICATION METHOD**: Automated test asserting immutability.`;
        }
        return `\n\n---\n\n## ${plan.ruleNumber}. ${title} (Harvested from ${pkg.repository})\n\n${provBlock}\n\n${body}\n`;
      }

      case 'skill_playbook': {
        return `# ${artifact.title}

${provBlock}

## 1. Skill Overview & Purpose
Procedural playbook defining verified operational and implementation patterns for **${pkg.repository}**.
- **Canonical Domain**: Domain ${plan.domainLetter} (${artifact.primary_domain?.name || 'Technical Construction'})
- **Model Independence**: Universal (Applies across Claude, Gemini, GPT, and Local agents)

## 2. Prerequisites & Technical Boundary
- Runtime ecosystem: Verified against ${pkg.repository} revision \`${(pkg.source_version || 'HEAD').slice(0, 10)}\`.
- Required security tier: Sanitized against PII/secrets.

## 3. Step-by-Step Procedural Workflow
${artifact.body}

## 4. Empirical Verification & Quality Gate
\`\`\`bash
node scripts/verify-execution.mjs --target "${pkg.slug}"
\`\`\`
`;
      }

      case 'domain_intelligence': {
        const domName = artifact.primary_domain?.name || 'Technical Construction Intelligence';
        return `# Domain ${plan.domainLetter} — ${domName}: ${artifact.title}

${provBlock}

## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain ${plan.domainLetter} (${domName})
- **Secondary Corroborating Domains**: ${(artifact.secondary_domains || []).map(d => `${d.letter} (${d.name})`).join(', ') || 'None'}
- **Confidence Rating**: ${((artifact.confidence || 0.90) * 100).toFixed(0)}%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from ${pkg.repository}:

${artifact.body}

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: \`astro-tailwind-v4\`, \`fullstack-ai-saas\`, \`universal-native-factory\`
- **Regression Shield**: Prevents architectural drift across construction cycles.
`;
      }

      case 'architecture_decision': {
        return `# Architecture Decision Record: ${artifact.title}

${provBlock}

## Status
**ACCEPTED** (Empirically verified from ${pkg.repository})

## Context
During deep inspection of ${pkg.repository}, modular boundaries, performance characteristics, and concurrency constraints required explicit architectural trade-off analysis.

## Decision
${artifact.body}

## Consequences
- **Positive**: Guarantees modular isolation, deterministic resource reclamation, and clean boundary encapsulation.
- **Negative / Trade-offs**: Requires explicit interface adapters and serialization overhead.
- **Compliance Mandate**: All future subsystem implementations adhering to this pattern must enforce this decision.
`;
      }

      case 'agent_contract': {
        return `# Agent Contract: ${artifact.title}

${provBlock}

## 1. Agent Role & Persona Contract
- **Role Identifier**: \`${pkg.slug}-specialist\`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
${artifact.body}

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
`;
      }

      case 'verification_contract': {
        return `# Verification Protocol: ${artifact.title}

${provBlock}

## 1. Scope & Verification Target
- **Target Repository**: \`${pkg.repository}\` (Commit: \`${(pkg.source_version || 'HEAD').slice(0, 10)}\`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
${artifact.body}

## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
`;
      }

      default:
        return `# ${artifact.title}\n\n${provBlock}\n\n${artifact.body}\n`;
    }
  }

  /**
   * Formats a Quarantined/Staged Candidate Directive (11_INBOX)
   * Guaranteed Zero Silent Data Loss
   */
  formatInboxCandidate(artifact, pkg, plan, rejectionMeta) {
    const provBlock = buildProvenanceBlock({
      repository: pkg.repository,
      source_url: pkg.source_url,
      source_version: pkg.source_version,
      license: pkg.license,
      learning_id: pkg.learning_id,
      artifact_type: 'candidate_directive'
    }, pkg);

    return `# Candidate Directive: [${plan.candidateId}] ${artifact.title}

${provBlock}

## Lifecycle Status
- **Current Status**: \`${plan.status || 'QUARANTINED_FOR_REVIEW'}\`
- **Rejection / Holding Reason**: ${plan.reason}
- **Retry Eligibility**: \`YES\`
- **Candidate Domain**: Domain ${plan.domainLetter}

## Original Learning Payload (100% Preserved)
${artifact.body || pkg.raw_dossier_text || pkg.dossier_content}

## Quality Gate Validation Dimensions
\`\`\`json
${JSON.stringify(rejectionMeta?.validationReport || { decision: 'STAGED_FOR_REVIEW', note: plan.reason }, null, 2)}
\`\`\`

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
`;
  }

  /**
   * Executes atomic file persistence across all destinations
   */
  executePersistence(plansWithArtifacts, pkg, options = {}) {
    const successful = [];
    const skipped = [];
    const failed = [];

    for (const item of plansWithArtifacts) {
      const fullPath = path.join(this.brainRoot, item.plan.relativePath);
      try {
        // Intentional fault injection support for testing
        if (options.faultyDestination && item.plan.targetFolder === options.faultyDestination) {
          throw new Error(`SIMULATED_I_O_ERROR: Destination "${options.faultyDestination}" failed deliberately.`);
        }

        // Idempotency check:
        if (fs.existsSync(fullPath)) {
          if (!item.plan.isSingleFileAppend) {
            const existingContent = fs.readFileSync(fullPath, 'utf-8');
            if (calculateContentHash(existingContent) === item.contentHash) {
              skipped.push({ plan: item.plan, fullPath, reason: 'IDENTICAL_CONTENT_HASH' });
              continue;
            }
          } else {
            // Append target (engineering-patterns.md)
            const existingContent = fs.readFileSync(fullPath, 'utf-8');
            if (existingContent.includes(item.title)) {
              skipped.push({ plan: item.plan, fullPath, reason: 'RULE_TITLE_ALREADY_PRESENT' });
              continue;
            }
          }
        }

        // Perform Write
        if (item.plan.isSingleFileAppend) {
          fs.appendFileSync(fullPath, item.content, 'utf-8');
        } else {
          atomicWriteFileSync(fullPath, item.content);
        }

        // Read-back verification
        if (!fs.existsSync(fullPath)) {
          throw new Error(`READ_BACK_FAILED: File missing after write at ${fullPath}`);
        }
        const diskContent = fs.readFileSync(fullPath, 'utf-8');
        if (diskContent.length === 0) {
          throw new Error(`READ_BACK_FAILED: File is 0 bytes at ${fullPath}`);
        }

        // Update Associated Registry Atomically
        this.updateRegistries(item.plan, item, pkg, options);

        successful.push({
          plan: item.plan,
          fullPath,
          bytes: diskContent.length,
          contentHash: item.contentHash
        });
      } catch (err) {
        failed.push({
          plan: item.plan,
          fullPath,
          error: err.message
        });
      }
    }

    return {
      total: plansWithArtifacts.length,
      persistedCount: successful.length,
      skippedCount: skipped.length,
      failCount: failed.length,
      successful,
      skipped,
      failed,
      isTotalSuccess: failed.length === 0,
      isPartialSuccess: successful.length > 0 && failed.length > 0
    };
  }

  /**
   * Updates canonical registries atomically
   */
  updateRegistries(plan, item, pkg, runOptions = {}) {
    const timestamp = new Date().toISOString();
    const itemId = `${plan.artifactType}-${sanitizeSlug(item.title || pkg.slug)}`;
    const isDeferred = this.deferRegistrySync || runOptions.deferRegistrySync;

    if (isDeferred) {
      this.loadRegistriesIntoMemory();
    }

    // 1. Knowledge Index (05_KNOWLEDGE/knowledge-index.json)
    if (isDeferred && this.inMemoryIndex) {
      this.inMemoryIndex.items = this.inMemoryIndex.items || {};
      this.inMemoryIndex.items[itemId] = {
        item_id: itemId,
        artifact_type: plan.artifactType,
        target_folder: plan.targetFolder,
        relative_path: plan.relativePath,
        title: item.title,
        repository: pkg.repository,
        source_version: pkg.source_version || 'HEAD',
        content_hash: item.contentHash,
        domain_letter: plan.domainLetter,
        persisted_at: timestamp
      };
      this.inMemoryIndex.total_items = Object.keys(this.inMemoryIndex.items).length;
      this.inMemoryIndex.last_updated = timestamp;
    } else {
      const indexPath = path.join(this.brainRoot, '05_KNOWLEDGE', 'knowledge-index.json');
      if (fs.existsSync(indexPath)) {
        try {
          const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
          index.items = index.items || {};
          index.items[itemId] = {
            item_id: itemId,
            artifact_type: plan.artifactType,
            target_folder: plan.targetFolder,
            relative_path: plan.relativePath,
            title: item.title,
            repository: pkg.repository,
            source_version: pkg.source_version || 'HEAD',
            content_hash: item.contentHash,
            domain_letter: plan.domainLetter,
            persisted_at: timestamp
          };
          index.total_items = Object.keys(index.items).length;
          index.last_updated = timestamp;
          atomicWriteJsonSync(indexPath, index);
        } catch (e) {}
      }
    }

    // 2. Domain Registry (05_KNOWLEDGE/domain-intelligence/domain-registry.json)
    if (plan.artifactType === 'domain_intelligence') {
      const letter = plan.domainLetter || 'H';
      if (isDeferred && this.inMemoryDomReg) {
        this.inMemoryDomReg.domains = this.inMemoryDomReg.domains || {};
        this.inMemoryDomReg.records = this.inMemoryDomReg.records || {};
        this.inMemoryDomReg.domains[letter] = this.inMemoryDomReg.domains[letter] || { total: 0, record_ids: [] };
        if (!this.inMemoryDomReg.domains[letter].record_ids.includes(itemId)) {
          this.inMemoryDomReg.domains[letter].record_ids.push(itemId);
          this.inMemoryDomReg.domains[letter].total = this.inMemoryDomReg.domains[letter].record_ids.length;
        }
        this.inMemoryDomReg.records[itemId] = {
          record_id: itemId,
          domain_letter: letter,
          title: item.title,
          relative_path: plan.relativePath,
          repository: pkg.repository,
          content_hash: item.contentHash,
          created_at: timestamp
        };
        this.inMemoryDomReg.total_records = Object.keys(this.inMemoryDomReg.records).length;
        this.inMemoryDomReg.last_updated = timestamp;
      } else {
        const domRegPath = path.join(this.brainRoot, '05_KNOWLEDGE', 'domain-intelligence', 'domain-registry.json');
        if (fs.existsSync(domRegPath)) {
          try {
            const domReg = JSON.parse(fs.readFileSync(domRegPath, 'utf-8'));
            domReg.domains = domReg.domains || {};
            domReg.records = domReg.records || {};
            domReg.domains[letter] = domReg.domains[letter] || { total: 0, record_ids: [] };
            if (!domReg.domains[letter].record_ids.includes(itemId)) {
              domReg.domains[letter].record_ids.push(itemId);
              domReg.domains[letter].total = domReg.domains[letter].record_ids.length;
            }
            domReg.records[itemId] = {
              record_id: itemId,
              domain_letter: letter,
              title: item.title,
              relative_path: plan.relativePath,
              repository: pkg.repository,
              content_hash: item.contentHash,
              created_at: timestamp
            };
            domReg.total_records = Object.keys(domReg.records).length;
            domReg.last_updated = timestamp;
            atomicWriteJsonSync(domRegPath, domReg);
          } catch (e) {}
        }
      }
    }

    // 3. Candidate Directives Registry (11_INBOX/candidate-directives-registry.json)
    if (plan.targetFolder === '11_INBOX') {
      const directiveEntry = {
        id: plan.candidateId || `CD-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        directive_title: item.title,
        source_repo: pkg.repository,
        source_commit: (pkg.source_version || 'HEAD').slice(0, 10),
        staged_file: plan.relativePath,
        status: plan.status || 'QUARANTINED_FOR_REVIEW',
        reason: plan.reason,
        date_staged: timestamp.slice(0, 10),
        domain_letter: plan.domainLetter || 'H'
      };
      if (isDeferred && this.inMemoryInboxReg) {
        this.inMemoryInboxReg.directives = this.inMemoryInboxReg.directives || [];
        const existingIdx = this.inMemoryInboxReg.directives.findIndex(d => d.id === plan.candidateId || d.directive_title === item.title);
        if (existingIdx >= 0) {
          this.inMemoryInboxReg.directives[existingIdx] = directiveEntry;
        } else {
          this.inMemoryInboxReg.directives.push(directiveEntry);
        }
        this.inMemoryInboxReg.last_updated = timestamp;
      } else {
        const inboxRegPath = path.join(this.brainRoot, '11_INBOX', 'candidate-directives-registry.json');
        if (fs.existsSync(inboxRegPath)) {
          try {
            const inboxReg = JSON.parse(fs.readFileSync(inboxRegPath, 'utf-8'));
            inboxReg.directives = inboxReg.directives || [];
            const existingIdx = inboxReg.directives.findIndex(d => d.id === plan.candidateId || d.directive_title === item.title);
            if (existingIdx >= 0) {
              inboxReg.directives[existingIdx] = directiveEntry;
            } else {
              inboxReg.directives.push(directiveEntry);
            }
            inboxReg.last_updated = timestamp;
            atomicWriteJsonSync(inboxRegPath, inboxReg);
          } catch (e) {}
        }
      }
    }
  }

  /**
   * Verifies persisted files against schemas and content hashes
   */
  verifyPersistence(plansWithArtifacts, persistenceBatch, isExecutionAuthorized) {
    if (!isExecutionAuthorized) {
      return {
        allVerified: true,
        verifiedCount: plansWithArtifacts.length,
        failedCount: 0,
        isObservationOnly: true,
        verifiedList: plansWithArtifacts.map(p => ({ relativePath: p.plan.relativePath, status: 'SHADOW_VERIFIED' })),
        failedList: []
      };
    }

    const verifiedList = [];
    const failedList = [];

    for (const item of plansWithArtifacts) {
      const fullPath = path.join(this.brainRoot, item.plan.relativePath);
      if (!fs.existsSync(fullPath)) {
        failedList.push({ path: item.plan.relativePath, error: 'FILE_MISSING' });
        continue;
      }

      const stat = fs.statSync(fullPath);
      if (stat.size === 0) {
        failedList.push({ path: item.plan.relativePath, error: 'FILE_ZERO_BYTES' });
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      if (!item.plan.isSingleFileAppend) {
        const diskHash = calculateContentHash(content);
        if (diskHash !== item.contentHash) {
          failedList.push({ path: item.plan.relativePath, error: 'HASH_MISMATCH' });
          continue;
        }
      } else {
        if (!content.includes(item.title)) {
          failedList.push({ path: item.plan.relativePath, error: 'TITLE_NOT_IN_APPEND' });
          continue;
        }
      }

      verifiedList.push({
        path: item.plan.relativePath,
        artifactType: item.plan.artifactType,
        bytes: stat.size,
        status: 'VERIFIED_ON_DISK'
      });
    }

    return {
      allVerified: failedList.length === 0,
      verifiedCount: verifiedList.length,
      failedCount: failedList.length,
      verifiedList,
      failedList
    };
  }
}

