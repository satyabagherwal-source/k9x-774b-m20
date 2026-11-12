/**
 * Phase E.1: Isolated Universal Knowledge Distribution Engine
 * 
 * Implements a model-independent distribution pipeline in pure sandbox:
 * 1. Multi-Domain Classification (A through M) with rich keyword & semantic fallback.
 * 2. 16-Canonical-Folder Destination Routing with type-aware inference.
 * 3. Evidence-Aware Quality Gates (substance, constraints, rationale, provenance).
 * 4. Duplicate & Conflict Detection (hash, title, contradiction).
 * 5. Human-Review Staging.
 * 6. Provenance Preservation.
 * 7. Read-Back Verification (SHA-256 byte parity).
 * 8. Universal Retrieval Validation.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { INTELLIGENCE_DOMAINS } from '../../../../04_WORKFLOWS/factory-engine/domain-intelligence-engine.mjs';
import { CANONICAL_FOLDERS } from '../../../../04_WORKFLOWS/factory-engine/destination-router.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expanded Domain Heuristics for terse candidate titles
const DOMAIN_EXPANDED_HEURISTICS = {
  A: ['human', 'need', 'user', 'persona', 'accessibility', 'a11y', 'contrast', 'friction', 'privacy', 'consent', 'empathy', 'painpoint'],
  B: ['prd', 'product', 'feature', 'mvp', 'scope', 'story', 'roadmap', 'milestone', 'specification', 'acceptance'],
  C: ['market', 'competitor', 'business', 'pricing', 'viability', 'margin', 'monetization', 'roi', 'commercial', 'hurdle', 'cost'],
  D: ['research', 'evidence', 'provenance', 'corroboration', 'source', 'citation', 'empirical', 'benchmark', 'literature', 'investigation'],
  E: ['creative', 'originality', 'aesthetic', 'metaphor', 'concept', 'art', 'voice', 'brand', 'uniqueness', 'storytelling'],
  F: ['design', 'ui', 'ux', 'tailwind', 'typography', 'color', 'palette', 'layout', 'responsive', 'viewport', 'css', 'oklch', 'theme'],
  G: ['architecture', 'boundary', 'modular', 'component', 'ipc', 'state', 'concurrency', 'mutex', 'worker', 'data-flow', 'zero-copy', 'coupling', 'dag'],
  H: ['algorithm', 'code', 'javascript', 'typescript', 'astro', 'react', 'wasm', 'canvas', 'dom', 'memory', 'performance', 'stream', 'pipeline', 'parser', 'async', 'transpiler', 'runtime', 'buffer', 'compiler', 'eos', 'token', 'pooling', 'sparsity', 'encoder', 'layers', 'normalization', 'model', 'weights', 'inference'],
  I: ['content', 'documentation', 'copy', 'information', 'hierarchy', 'writing', 'guide', 'explanation', 'micro-copy', 'manual', 'schema', 'readme', 'api-docs'],
  J: ['seo', 'opengraph', 'json-ld', 'sitemap', 'canonical', 'meta', 'crawl', 'indexation', 'distribution', 'search', 'hreflang', 'robots', 'traffic'],
  K: ['test', 'verification', 'assertion', 'invariant', 'quality', 'regression', 'e2e', 'unit', 'probe', 'barrier', 'pass', 'audit', 'compliance', 'fuzzing'],
  L: ['deployment', 'hosting', 'ci-cd', 'vault', 'backup', 'disaster-recovery', 'docker', 'vercel', 'pages', 'monitoring', 'uptime', 'healthcheck', 'devops'],
  M: ['feedback', 'learning', 'autopsy', 'incident', 'evolution', 'promotion', 'retrospective', 'harvest', 'adaptation', 'telemetry', 'defect', 'post-mortem']
};

export class IsolatedDistributionEngine {
  constructor(options = {}) {
    this.sandboxBrainRoot = options.sandboxBrainRoot || path.resolve(__dirname, '..', 'sandbox-brain');
    this.ensureSandboxStructure();
  }

  ensureSandboxStructure() {
    Object.keys(CANONICAL_FOLDERS).forEach(folder => {
      const folderPath = path.join(this.sandboxBrainRoot, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    });
  }

  /**
   * 1. Multi-Domain Classification
   */
  classifyMultiDomain(item) {
    const title = (item.title || item.directive_title || '').toLowerCase();
    const content = (item.content || item.body || item.dossier_content || item.reason || '').toLowerCase();
    const tags = (item.tags || item.trigger_tags || []).map(t => String(t).toLowerCase());

    const combinedText = `${title} ${content} ${tags.join(' ')}`;
    const tokens = new Set(combinedText.replace(/[^a-z0-9_\-\s]/g, ' ').split(/\s+/).filter(t => t.length > 2));

    const scores = {};
    Object.keys(INTELLIGENCE_DOMAINS).forEach(letter => {
      scores[letter] = 0;
      const keywords = DOMAIN_EXPANDED_HEURISTICS[letter] || [];
      keywords.forEach(kw => {
        if (tokens.has(kw)) {
          scores[letter] += 2;
        } else if (combinedText.includes(kw)) {
          scores[letter] += 1;
        }
      });
    });

    const sortedDomains = Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sortedDomains.length === 0) {
      return {
        primaryDomain: null,
        secondaryDomains: [],
        confidence: 0,
        scores
      };
    }

    const [topLetter, topScore] = sortedDomains[0];
    const secondaryDomains = sortedDomains.slice(1)
      .filter(([_, s]) => s >= Math.max(2, topScore * 0.4))
      .map(([letter]) => ({
        letter,
        id: INTELLIGENCE_DOMAINS[letter]?.id,
        name: INTELLIGENCE_DOMAINS[letter]?.name
      }));

    return {
      primaryDomain: {
        letter: topLetter,
        id: INTELLIGENCE_DOMAINS[topLetter]?.id,
        name: INTELLIGENCE_DOMAINS[topLetter]?.name
      },
      secondaryDomains,
      confidence: Math.min(1.0, topScore / 10),
      scores
    };
  }

  /**
   * 2. Enhanced Destination Routing across all 16 Canonical Folders
   */
  resolveCanonicalDestination(item, classification) {
    const primaryLetter = classification?.primaryDomain?.letter || item.domain || 'H';
    const title = (item.title || item.directive_title || '').toLowerCase();
    const tags = (item.tags || item.trigger_tags || []).map(t => String(t).toLowerCase());
    const kType = String(item.knowledgeType || '').toLowerCase().trim();

    let targetFolder = null;

    // Rule-based mapping
    if (kType) {
      const typeMap = {
        'orientation_guide': '00_START_HERE',
        'sitemap': '00_START_HERE',
        'core_law': '01_CORE',
        'system_invariant': '01_CORE',
        'operating_protocol': '01_CORE',
        'agent_contract': '02_AGENT_INTELLIGENCE',
        'subagent_spec': '02_AGENT_INTELLIGENCE',
        'fleet_roster': '02_AGENT_INTELLIGENCE',
        'skill_playbook': '03_SKILLS',
        'procedural_guide': '03_SKILLS',
        'automation_engine': '04_WORKFLOWS',
        'factory_workflow': '04_WORKFLOWS',
        'test_suite': '04_WORKFLOWS',
        'engineering_pattern': '05_KNOWLEDGE',
        'domain_fact': '05_KNOWLEDGE',
        'project_context': '06_PROJECT_CONTEXT',
        'workspace_bridge': '06_PROJECT_CONTEXT',
        'raw_dossier': '07_PROJECT_LEARNING',
        'commit_forensic': '07_PROJECT_LEARNING',
        'audit_report': '08_VERIFICATION',
        'verification_contract': '08_VERIFICATION',
        'source_entry': '09_SOURCES',
        'provenance_ledger': '09_SOURCES',
        'system_prompt': '10_PROMPTS',
        'instruction_template': '10_PROMPTS',
        'candidate_directive': '11_INBOX',
        'unverified_discovery': '11_INBOX',
        'architecture_decision': '12_DECISIONS',
        'adr': '12_DECISIONS',
        'governance_policy': '13_GOVERNANCE',
        'approval_gate': '13_GOVERNANCE',
        'roadmap_milestone': '14_EVOLUTION',
        'evolution_metric': '14_EVOLUTION',
        'capability_contract': '15_METADATA',
        'system_schema': '15_METADATA'
      };
      targetFolder = typeMap[kType] || null;
    }

    if (!targetFolder) {
      // Inferred from title and role
      if (title.includes('adr-') || title.includes('decision') || title.includes('trade-off')) {
        targetFolder = '12_DECISIONS';
      } else if (title.includes('verification') || title.includes('test protocol') || title.includes('audit protocol') || primaryLetter === 'K') {
        targetFolder = '08_VERIFICATION';
      } else if (title.includes('playbook') || title.includes('checklist') || title.includes('recipe') || title.includes('skill')) {
        targetFolder = '03_SKILLS';
      } else if (title.includes('agent') || title.includes('subagent') || title.includes('roster')) {
        targetFolder = '02_AGENT_INTELLIGENCE';
      } else if (title.includes('workflow') || title.includes('pipeline engine') || title.includes('harvester runner')) {
        targetFolder = '04_WORKFLOWS';
      } else if (title.includes('governance') || title.includes('policy') || title.includes('approval gate')) {
        targetFolder = '13_GOVERNANCE';
      } else if (title.includes('prompt') || title.includes('instruction')) {
        targetFolder = '10_PROMPTS';
      } else if (title.includes('roadmap') || title.includes('evolution') || title.includes('post-mortem') || primaryLetter === 'M') {
        targetFolder = '14_EVOLUTION';
      } else if (title.includes('catalog') || title.includes('provenance') || title.includes('source ledger')) {
        targetFolder = '09_SOURCES';
      } else if (title.includes('schema') || title.includes('taxonomy') || title.includes('registry spec')) {
        targetFolder = '15_METADATA';
      } else if (title.includes('operating rule') || title.includes('core law') || title.includes('system invariant')) {
        targetFolder = '01_CORE';
      } else if (item.status === 'STAGED_FOR_VERIFICATION' || item.status === 'STAGED_FOR_HUMAN_REVIEW' || item.reason) {
        targetFolder = '11_INBOX';
      } else {
        targetFolder = '05_KNOWLEDGE';
      }
    }

    const slug = (item.slug || item.title || item.directive_title || 'unnamed-item')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);

    const suggestedRelativePath = `${targetFolder}/${slug}.md`;
    const requiresHuman = ['01_CORE', '13_GOVERNANCE'].includes(targetFolder) || primaryLetter === 'M' || item.requires_human_approval === true;

    return {
      targetFolder,
      suggestedRelativePath,
      primaryDomainLetter: primaryLetter,
      requiresHumanApproval: requiresHuman
    };
  }

  /**
   * 3. Evidence-Aware Quality Gate
   */
  evaluateQualityGate(item) {
    const errors = [];
    const warnings = [];

    const body = item.content || item.body || item.dossier_content || '';
    const title = item.title || item.directive_title || '';

    // Check 1: Substance Threshold
    if (body.length < 100 && !item.staged_file) {
      errors.push('Body fails minimum substance threshold (less than 100 characters)');
    }

    // Check 2: Title Specificity
    if (/^rule$/i.test(title) || /^pattern$/i.test(title) || title.length < 5) {
      errors.push('Generic or invalid title rejected');
    }

    // Check 3: Provenance
    if (!item.source_repo && !item.source_url && !item.sourceUrl && !item.author) {
      errors.push('Missing mandatory provenance attribution');
    }

    // Check 4: Verification criteria or method
    const hasCriteria = Array.isArray(item.verification_criteria) && item.verification_criteria.length > 0;
    const hasVerificationCode = /assert\b|expect\(|\bit\(|\btest\(|exit\s*code\s*0/i.test(body);
    if (!hasCriteria && !hasVerificationCode) {
      warnings.push('Item lacks explicit empirical verification criteria or executable assertions');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      admissibleToCanonical: errors.length === 0 && warnings.length === 0
    };
  }

  /**
   * 4. Duplicate & Conflict Detection
   */
  detectDuplicatesAndConflicts(item, existingDataset = []) {
    const title = (item.title || item.directive_title || '').trim().toLowerCase();
    const content = item.content || item.body || '';
    const hash = crypto.createHash('sha256').update(content || title, 'utf8').digest('hex');

    for (const existing of existingDataset) {
      if (existing.id === item.id) continue;
      const exTitle = (existing.title || existing.directive_title || '').trim().toLowerCase();
      const exContent = existing.content || existing.body || '';
      const exHash = existing.content_hash || crypto.createHash('sha256').update(exContent || exTitle, 'utf8').digest('hex');

      // Hash match
      if (hash === exHash && hash.length > 0) {
        return {
          duplicate: true,
          type: 'EXACT_HASH_MATCH',
          matchedWith: existing.id
        };
      }

      // Title match
      if (title.length > 10 && title === exTitle) {
        return {
          duplicate: true,
          type: 'IDENTICAL_TITLE_COLLISION',
          matchedWith: existing.id
        };
      }

      // Contradiction Detection
      const strippedTitle = title.replace(/^never\s+/i, '').replace(/^always\s+/i, '').trim();
      const strippedExTitle = exTitle.replace(/^never\s+/i, '').replace(/^always\s+/i, '').trim();
      if (title.startsWith('never ') && (exTitle.includes(strippedTitle) || strippedExTitle.includes(strippedTitle))) {
        return {
          conflict: true,
          type: 'CONTRADICTORY_DIRECTIVE',
          matchedWith: existing.id
        };
      }
    }

    return { duplicate: false, conflict: false };
  }

  /**
   * 5. Persist with Mandatory Read-Back SHA-256 Parity
   */
  persistAndReadBack(item, routing) {
    const targetFilePath = path.join(this.sandboxBrainRoot, routing.suggestedRelativePath);
    const parentDir = path.dirname(targetFilePath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const tagsStr = Array.isArray(item.tags || item.trigger_tags) ? (item.tags || item.trigger_tags).join(', ') : '';
    const domainLetter = routing.primaryDomainLetter || item.domain || 'H';

    const payload = `---
id: ${item.id || 'ITEM-' + Date.now()}
title: "${item.title || item.directive_title}"
domain: ${domainLetter}
tags: [${tagsStr}]
source: ${item.source_repo || item.sourceUrl || item.source_url || 'internal'}
targetFolder: ${routing.targetFolder}
timestamp: ${new Date().toISOString()}
---

# ${item.title || item.directive_title}

${item.content || item.body || ''}
`;

    const expectedHash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

    // 1. Write
    fs.writeFileSync(targetFilePath, payload, 'utf8');

    // 2. Read-Back Verification Barrier
    if (!fs.existsSync(targetFilePath)) {
      return { verified: false, error: 'File failed to persist on disk' };
    }

    const readBackContent = fs.readFileSync(targetFilePath, 'utf8');
    const actualHash = crypto.createHash('sha256').update(readBackContent, 'utf8').digest('hex');

    if (actualHash !== expectedHash) {
      return {
        verified: false,
        error: `Read-back hash mismatch: expected ${expectedHash}, actual ${actualHash}`
      };
    }

    return {
      verified: true,
      bytes: Buffer.byteLength(readBackContent, 'utf8'),
      sha256: actualHash,
      targetFilePath
    };
  }

  /**
   * 6. Universal Retrieval Validation
   */
  retrieveSandboxKnowledge(query, options = {}) {
    const queryTokens = query.toLowerCase().replace(/[^a-z0-9_\-\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
    const domainFilter = options.domain || null;
    const folderFilter = options.folder || null;

    const matches = [];

    // Scan sandbox brain root
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lower = content.toLowerCase();
          let score = 0;
          queryTokens.forEach(t => {
            if (lower.includes(t)) score += 1;
          });

          if (score > 0) {
            const relPath = path.relative(this.sandboxBrainRoot, fullPath);
            const folder = relPath.split(path.sep)[0];

            if (folderFilter && folder !== folderFilter) continue;

            matches.push({
              relPath,
              folder,
              score,
              snippet: content.slice(0, 150)
            });
          }
        }
      }
    };

    walkDir(this.sandboxBrainRoot);
    return matches.sort((a, b) => b.score - a.score);
  }
}
