/**
 * AI-Builder-Brain — Canonical Capability Registry Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\capability-registry.mjs
 * Purpose: Manages, validates, indexes, queries, and audits the capabilities of
 *          AI-Builder-Brain across the 20 Construction Intelligence domains.
 * 
 * Zero external dependencies. Native Node.js ES Module.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export const CANONICAL_DOMAINS = [
  'programming_languages',
  'software_architecture',
  'frontend_engineering',
  'backend_engineering',
  'databases',
  'infrastructure_deployment',
  'operating_systems_system_interfaces',
  'developer_tools_ides',
  'testing_reliability',
  'security_threat_modeling',
  'product_intelligence_ux',
  'design_art_typography_design_systems',
  'creative_intelligence_originality',
  'content_intelligence_information_architecture',
  'seo_intelligence',
  'accessibility_a11y',
  'performance_optimization',
  'legal_compliance',
  'operations_monitoring_sre',
  'evolution_continuous_improvement',
  'future_versioned_domains'
];

export const VALID_STATUSES = [
  'VERIFIED WORKING',
  'PARTIALLY IMPLEMENTED',
  'PRESENT BUT UNVERIFIED',
  'MISSING'
];

export function getRegistryPaths(customRoot = null) {
  const root = customRoot || BRAIN_ROOT;
  return {
    brainRoot: root,
    schemaFile: path.join(root, '15_METADATA', 'capability-schema.json'),
    registryFile: path.join(root, '15_METADATA', 'capability-registry.json'),
    catalogMarkdownFile: path.join(root, '15_METADATA', 'capability-catalog.md')
  };
}

/**
 * Validates a single capability record against the schema rules
 */
export function validateCapabilityRecord(record) {
  const errors = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Record must be a non-null object'] };
  }

  // Required top-level string fields
  const requiredStringFields = ['id', 'name', 'domain', 'purpose', 'status', 'version', 'lastVerificationDate'];
  for (const f of requiredStringFields) {
    if (!record[f] || typeof record[f] !== 'string') {
      errors.push(`Field '${f}' is required and must be a non-empty string`);
    }
  }

  // ID pattern
  if (record.id && !/^CAP-[A-Z0-9-]+$/.test(record.id)) {
    errors.push(`Capability ID '${record.id}' is invalid. Must match pattern ^CAP-[A-Z0-9-]+$`);
  }

  // Domain enum
  if (record.domain && !CANONICAL_DOMAINS.includes(record.domain)) {
    errors.push(`Domain '${record.domain}' is invalid. Must be one of: ${CANONICAL_DOMAINS.join(', ')}`);
  }

  // Status enum
  if (record.status && !VALID_STATUSES.includes(record.status)) {
    errors.push(`Status '${record.status}' is invalid. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Scope object
  if (!record.scope || typeof record.scope !== 'object') {
    errors.push(`Field 'scope' must be an object with inScope and nonGoals arrays`);
  } else {
    if (!Array.isArray(record.scope.inScope)) {
      errors.push(`Field 'scope.inScope' must be an array`);
    }
    if (!Array.isArray(record.scope.nonGoals)) {
      errors.push(`Field 'scope.nonGoals' must be an array`);
    }
  }

  // Required array fields
  const requiredArrayFields = [
    'inputsPrerequisites',
    'requiredKnowledge',
    'dependencies',
    'rulesConstraints',
    'proceduresWorkflows',
    'requiredToolsInterfaces',
    'expectedOutputs',
    'acceptanceCriteria',
    'verificationMethods',
    'testReferences',
    'knownFailureModes',
    'recoveryProcedures',
    'knownGapsUnresolvedQuestions'
  ];

  for (const f of requiredArrayFields) {
    if (!Array.isArray(record[f])) {
      errors.push(`Field '${f}' is required and must be an array`);
    }
  }

  // Dependencies validation
  if (Array.isArray(record.dependencies)) {
    for (let i = 0; i < record.dependencies.length; i++) {
      const dep = record.dependencies[i];
      if (!dep.capabilityId || typeof dep.capabilityId !== 'string') {
        errors.push(`Dependency at index ${i} missing valid 'capabilityId' string`);
      }
      if (!dep.relationship || !['REQUIRES', 'RECOMMENDS', 'CONFLICTS_WITH', 'SUPERSEDES', 'EXTENDS'].includes(dep.relationship)) {
        errors.push(`Dependency at index ${i} has invalid 'relationship': ${dep.relationship}`);
      }
    }
  }

  // Test references validation
  if (Array.isArray(record.testReferences)) {
    for (let i = 0; i < record.testReferences.length; i++) {
      const t = record.testReferences[i];
      if (!t.testPath || typeof t.testPath !== 'string') {
        errors.push(`Test reference at index ${i} missing 'testPath'`);
      }
      if (!t.status || !['PASS', 'FAIL', 'NOT RUN', 'PARTIAL'].includes(t.status)) {
        errors.push(`Test reference at index ${i} has invalid status '${t.status}'`);
      }
    }
  }

  // Evidence provenance
  if (!record.evidenceProvenance || typeof record.evidenceProvenance !== 'object') {
    errors.push(`Field 'evidenceProvenance' must be an object with verifiedArtifacts array`);
  } else if (!Array.isArray(record.evidenceProvenance.verifiedArtifacts)) {
    errors.push(`Field 'evidenceProvenance.verifiedArtifacts' must be an array`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Loads the capability registry from disk
 */
export function loadRegistry(customPath = null) {
  const p = customPath || getRegistryPaths().registryFile;
  if (!fs.existsSync(p)) {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      description: 'AI-Builder-Brain Canonical Capability Registry',
      capabilities: []
    };
  }
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/**
 * Saves registry atomically to disk
 */
export function saveRegistry(registry, customPath = null) {
  const p = customPath || getRegistryPaths().registryFile;
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  registry.lastUpdated = new Date().toISOString();
  const tmpPath = `${p}.tmp-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(registry, null, 2), 'utf8');
  fs.renameSync(tmpPath, p);
  return p;
}

/**
 * Registers or updates a capability in the registry
 */
export function registerCapability(record, registry) {
  const validation = validateCapabilityRecord(record);
  if (!validation.valid) {
    throw new Error(`Capability validation failed for ${record?.id || 'unknown'}:\n${validation.errors.join('\n')}`);
  }

  const existingIdx = registry.capabilities.findIndex(c => c.id === record.id);
  if (existingIdx >= 0) {
    registry.capabilities[existingIdx] = record;
  } else {
    registry.capabilities.push(record);
  }

  // Sort capabilities by ID deterministically
  registry.capabilities.sort((a, b) => a.id.localeCompare(b.id));
  return record;
}

/**
 * Retrieves a capability by stable ID
 */
export function getCapabilityById(id, registry) {
  return registry.capabilities.find(c => c.id === id) || null;
}

/**
 * Queries capabilities with flexible multi-dimensional filters
 */
export function queryCapabilities(filter = {}, registry = null) {
  const reg = registry || loadRegistry();
  let results = [...reg.capabilities];

  if (filter.domain) {
    results = results.filter(c => c.domain === filter.domain || (c.secondaryDomains && c.secondaryDomains.includes(filter.domain)));
  }

  if (filter.status) {
    results = results.filter(c => c.status === filter.status);
  }

  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase();
    results = results.filter(c => 
      c.id.toLowerCase().includes(kw) ||
      c.name.toLowerCase().includes(kw) ||
      c.purpose.toLowerCase().includes(kw) ||
      (c.scope?.inScope && c.scope.inScope.some(s => s.toLowerCase().includes(kw))) ||
      (c.requiredKnowledge && c.requiredKnowledge.some(k => k.toLowerCase().includes(kw)))
    );
  }

  if (filter.dependency) {
    results = results.filter(c => 
      c.dependencies && c.dependencies.some(d => d.capabilityId === filter.dependency)
    );
  }

  return results;
}

/**
 * Detects cycles in capability dependency graph (REQUIRES relationships)
 */
export function detectDependencyCycles(registry) {
  const adj = new Map();
  for (const c of registry.capabilities) {
    const requiredDeps = (c.dependencies || [])
      .filter(d => d.relationship === 'REQUIRES')
      .map(d => d.capabilityId);
    adj.set(c.id, requiredDeps);
  }

  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(node, pathArr) {
    visited.add(node);
    recStack.add(node);
    pathArr.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...pathArr]);
      } else if (recStack.has(neighbor)) {
        const cycleStartIndex = pathArr.indexOf(neighbor);
        const cyclePath = pathArr.slice(cycleStartIndex).concat(neighbor);
        cycles.push(cyclePath.join(' -> '));
      }
    }

    recStack.delete(node);
  }

  for (const capId of adj.keys()) {
    if (!visited.has(capId)) {
      dfs(capId, []);
    }
  }

  return cycles;
}

/**
 * Audits dependency graph across all registered capabilities
 */
export function validateDependencyGraph(registry) {
  const allIds = new Set(registry.capabilities.map(c => c.id));
  const missingDependencies = [];
  const conflicts = [];

  for (const cap of registry.capabilities) {
    for (const dep of cap.dependencies || []) {
      if (!allIds.has(dep.capabilityId)) {
        missingDependencies.push({
          sourceCapability: cap.id,
          missingCapability: dep.capabilityId,
          relationship: dep.relationship,
          rationale: dep.rationale || 'Required by source capability'
        });
      }

      if (dep.relationship === 'CONFLICTS_WITH' && allIds.has(dep.capabilityId)) {
        conflicts.push({
          sourceCapability: cap.id,
          conflictedCapability: dep.capabilityId
        });
      }
    }
  }

  const cycles = detectDependencyCycles(registry);

  return {
    valid: missingDependencies.length === 0 && cycles.length === 0,
    totalCapabilities: registry.capabilities.length,
    missingDependencies,
    conflicts,
    cycles
  };
}

/**
 * Generates human-readable Markdown Catalog from registry data
 */
export function generateCapabilityCatalogMarkdown(registry) {
  const now = new Date().toISOString();
  const caps = registry.capabilities;

  const statusCounts = {};
  for (const s of VALID_STATUSES) statusCounts[s] = 0;
  for (const c of caps) statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;

  let md = `# 🏛️ AI-Builder-Brain Capability Catalog
> **System:** Universal, AI-Agnostic Construction Intelligence Registry  
> **Total Registered Capabilities:** ${caps.length}  
> **Last Synchronized:** ${now}  

---

## 📊 Summary by Verification Status

| Status | Count | Description |
|---|---|---|
| 🟢 **VERIFIED WORKING** | ${statusCounts['VERIFIED WORKING']} | Empirically verified with automated test proof |
| 🟡 **PARTIALLY IMPLEMENTED** | ${statusCounts['PARTIALLY IMPLEMENTED']} | Core code operational, pipeline in active expansion |
| ⚪ **PRESENT BUT UNVERIFIED** | ${statusCounts['PRESENT BUT UNVERIFIED']} | Code or skill documentation present; formal tests pending |
| 🔴 **MISSING** | ${statusCounts['MISSING']} | Identified in universe taxonomy, planned for future phases |

---

## 🗂️ Capability Index by Domain

`;

  const domainGroups = {};
  for (const c of caps) {
    domainGroups[c.domain] = domainGroups[c.domain] || [];
    domainGroups[c.domain].push(c);
  }

  for (const domain of CANONICAL_DOMAINS) {
    const group = domainGroups[domain] || [];
    if (group.length === 0) continue;

    const domainTitle = domain.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    md += `### ${domainTitle} (${group.length})\n\n`;
    md += `| Capability ID | Name | Status | Purpose | Dependencies |\n`;
    md += `|---|---|---|---|---|\n`;

    for (const c of group) {
      const badge = c.status === 'VERIFIED WORKING' ? '🟢 `VERIFIED`' :
                    c.status === 'PARTIALLY IMPLEMENTED' ? '🟡 `PARTIAL`' :
                    c.status === 'PRESENT BUT UNVERIFIED' ? '⚪ `UNVERIFIED`' : '🔴 `MISSING`';
      const deps = (c.dependencies || []).map(d => `\`${d.capabilityId}\``).join(', ') || '*None*';
      md += `| **\`${c.id}\`** | ${c.name} | ${badge} | ${c.purpose} | ${deps} |\n`;
    }
    md += `\n`;
  }

  md += `---

## 📖 Detailed Capability Dossiers

`;

  for (const c of caps) {
    md += `### \`${c.id}\` — ${c.name}\n\n`;
    md += `- **Domain:** \`${c.domain}\`${c.secondaryDomains ? ' (' + c.secondaryDomains.join(', ') + ')' : ''}\n`;
    md += `- **Status:** **\`${c.status}\`**\n`;
    md += `- **Version:** \`${c.version}\` (Verified: \`${c.lastVerificationDate}\`)\n`;
    md += `- **Purpose:** ${c.purpose}\n\n`;

    md += `#### Scope\n`;
    md += `- **In Scope:** ${c.scope.inScope.join('; ')}\n`;
    md += `- **Non-Goals:** ${c.scope.nonGoals.join('; ')}\n\n`;

    if (c.dependencies && c.dependencies.length > 0) {
      md += `#### Dependencies\n`;
      for (const d of c.dependencies) {
        md += `- \`${d.relationship}\`: \`${d.capabilityId}\` ${d.rationale ? '(' + d.rationale + ')' : ''}\n`;
      }
      md += `\n`;
    }

    if (c.rulesConstraints && c.rulesConstraints.length > 0) {
      md += `#### Rules & Invariants\n`;
      for (const r of c.rulesConstraints) md += `- ${r}\n`;
      md += `\n`;
    }

    if (c.testReferences && c.testReferences.length > 0) {
      md += `#### Verification & Test Evidence\n`;
      for (const t of c.testReferences) {
        md += `- \`${t.status}\`: \`${t.testPath}\`${t.assertionsPassed ? ' (' + t.assertionsPassed + ' assertions passed)' : ''}\n`;
      }
      md += `\n`;
    }

    if (c.knownFailureModes && c.knownFailureModes.length > 0) {
      md += `#### Known Failure Modes & Recovery\n`;
      for (const f of c.knownFailureModes) {
        md += `- **Failure:** ${f.mode} $\\rightarrow$ **Recovery:** ${f.mitigation}\n`;
      }
      md += `\n`;
    }

    if (c.evidenceProvenance && c.evidenceProvenance.verifiedArtifacts) {
      md += `#### Provenance Artifacts\n`;
      for (const a of c.evidenceProvenance.verifiedArtifacts) md += `- \`${a}\`\n`;
      if (c.evidenceProvenance.gitCommit) md += `- Git Commit: \`${c.evidenceProvenance.gitCommit}\`\n`;
      md += `\n`;
    }

    if (c.knownGapsUnresolvedQuestions && c.knownGapsUnresolvedQuestions.length > 0) {
      md += `#### Known Gaps & Unresolved Questions\n`;
      for (const g of c.knownGapsUnresolvedQuestions) md += `- ⚠️ ${g}\n`;
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

/**
 * Synchronizes generated markdown catalog to disk
 */
export function syncCapabilityCatalog(registry, customPath = null) {
  const p = customPath || getRegistryPaths().catalogMarkdownFile;
  const md = generateCapabilityCatalogMarkdown(registry);
  fs.writeFileSync(p, md, 'utf8');
  return p;
}

