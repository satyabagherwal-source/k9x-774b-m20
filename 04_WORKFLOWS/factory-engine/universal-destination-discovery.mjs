/**
 * 04_WORKFLOWS/factory-engine/universal-destination-discovery.mjs
 *
 * Universal Recursive Knowledge Destination Discovery Engine
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Dynamically traverses the canonical repository to discover all structural domains,
 * nested directories, registries, blueprints, and files. Automatically discovers newly
 * created destinations and maintains a comprehensive, queryable destination registry.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_BRAIN_ROOT = path.resolve(__dirname, '..', '..');

/**
 * 13 Canonical Intelligence Domains (A through M)
 */
export const INTELLIGENCE_DOMAINS = {
  'A': { id: 'human_need', name: 'Human & Need Intelligence' },
  'B': { id: 'market_competition', name: 'Market & Competitive Intelligence' },
  'C': { id: 'product_positioning', name: 'Product & Positioning Intelligence' },
  'D': { id: 'systems_architecture', name: 'Systems & Architecture Intelligence' },
  'E': { id: 'interaction_design', name: 'Interaction & UX Intelligence' },
  'F': { id: 'security_threat', name: 'Security & Threat Modeling Intelligence' },
  'G': { id: 'operations_sre', name: 'Operations, Reliability & SRE Intelligence' },
  'H': { id: 'technical_construction', name: 'Technical Construction Intelligence' },
  'I': { id: 'growth_distribution', name: 'Growth, SEO & Distribution Intelligence' },
  'J': { id: 'economics_pricing', name: 'Economics, Monetization & Pricing Intelligence' },
  'K': { id: 'quality_verification', name: 'Quality & Verification Intelligence' },
  'L': { id: 'adaptation_evolution', name: 'Adaptation & Ecosystem Evolution Intelligence' },
  'M': { id: 'governance_alignment', name: 'Governance, Human Intent & Safety Intelligence' }
};

/**
 * Structural Folder Profiles and Routing Eligibility Rules
 */
const STRUCTURAL_PROFILES = {
  '00_START_HERE': {
    domain: 'ONBOARDING',
    ownership: 'HUMAN_CURATION',
    routingEligibility: 'READ_ONLY_REFERENCE',
    acceptedSchemas: ['markdown_orientation_guide'],
    validationRequirements: ['MANUAL_REVIEW'],
    persistenceHandler: 'MANUAL_ONLY',
    indexingHandler: 'NONE'
  },
  '01_CORE': {
    domain: 'SYSTEM_CORE',
    ownership: 'TIER_1_HUMAN_DIRECTIVES',
    routingEligibility: 'HUMAN_APPROVAL_GATED',
    acceptedSchemas: ['markdown_operating_law', 'system_invariant'],
    validationRequirements: ['HUMAN_SIGNATURE', 'STAGED_IN_INBOX_FIRST'],
    persistenceHandler: 'HUMAN_GATE_ONLY',
    indexingHandler: 'INDEX_AS_CORE_RULE'
  },
  '02_AGENT_INTELLIGENCE': {
    domain: 'AGENT_SYSTEMS',
    ownership: 'AGENT_FLEET',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_agent_spec', 'agent_contract'],
    validationRequirements: ['SCHEMA_CHECK', 'READ_BACK_SHA256'],
    persistenceHandler: 'STANDALONE_MARKDOWN_WRITER',
    indexingHandler: 'INDEX_AS_AGENT_INTELLIGENCE'
  },
  '03_SKILLS': {
    domain: 'PROCEDURAL_CAPABILITIES',
    ownership: 'AGENT_FLEET',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_skill_playbook', 'procedural_guide'],
    validationRequirements: ['SCHEMA_CHECK', 'PROVENANCE_BLOCK', 'READ_BACK_SHA256'],
    persistenceHandler: 'STANDALONE_MARKDOWN_WRITER',
    indexingHandler: 'INDEX_AS_SKILL'
  },
  '04_WORKFLOWS': {
    domain: 'AUTOMATION_FACTORY',
    ownership: 'PROJECT_FACTORY',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['javascript_automation_engine', 'markdown_blueprint_spec'],
    validationRequirements: ['SYNTAX_CHECK', 'READ_BACK_SHA256'],
    persistenceHandler: 'BLUEPRINT_OR_WORKFLOW_WRITER',
    indexingHandler: 'INDEX_AS_WORKFLOW'
  },
  '05_KNOWLEDGE': {
    domain: 'CANONICAL_KNOWLEDGE',
    ownership: 'CENTRAL_BRAIN',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_invariant_rule', 'markdown_domain_intel', 'json_index'],
    validationRequirements: ['HIQV_GATE', 'PROVENANCE_BLOCK', 'READ_BACK_SHA256'],
    persistenceHandler: 'DUAL_MODE_WRITER', // Appends to patterns.md OR writes to domain-intelligence/
    indexingHandler: 'INDEX_AS_ENGINEERING_PATTERN_OR_DOMAIN'
  },
  '06_PROJECT_CONTEXT': {
    domain: 'PROJECT_STATE',
    ownership: 'CHILD_PROJECT_BRIDGE',
    routingEligibility: 'EPHEMERAL_BUILD_ONLY',
    acceptedSchemas: ['json_bridge_state', 'markdown_context'],
    validationRequirements: ['BRIDGE_SYNCHRONIZATION'],
    persistenceHandler: 'EPHEMERAL_BRIDGE_WRITER',
    indexingHandler: 'NONE'
  },
  '07_PROJECT_LEARNING': {
    domain: 'RAW_EXTRACTION_DOSSIERS',
    ownership: 'AUTOMATED_HARVESTER',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_forensic_dossier'],
    validationRequirements: ['CONTENT_HASH_VERIFY', 'READ_BACK_SHA256'],
    persistenceHandler: 'STANDALONE_DOSSIER_WRITER',
    indexingHandler: 'INDEX_AS_HARVESTED_DOSSIER'
  },
  '08_VERIFICATION': {
    domain: 'QUALITY_ASSURANCE',
    ownership: 'VERIFICATION_ENGINE',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_verification_protocol', 'markdown_audit_report', 'json_verification_log'],
    validationRequirements: ['READ_BACK_SHA256', 'SCHEMA_CHECK'],
    persistenceHandler: 'STANDALONE_OR_LEDGER_APPEND',
    indexingHandler: 'INDEX_AS_VERIFICATION_PROTOCOL'
  },
  '09_SOURCES': {
    domain: 'PROVENANCE_CATALOG',
    ownership: 'PROVENANCE_ENGINE',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_provenance_ledger', 'json_sources_catalog'],
    validationRequirements: ['LEDGER_APPEND_VERIFY', 'READ_BACK_SHA256'],
    persistenceHandler: 'LEDGER_APPEND_AND_CATALOG_WRITER',
    indexingHandler: 'INDEX_AS_SOURCE_ENTRY'
  },
  '10_PROMPTS': {
    domain: 'PROMPT_ENGINEERING',
    ownership: 'HUMAN_CURATION',
    routingEligibility: 'READ_ONLY_REFERENCE',
    acceptedSchemas: ['markdown_meta_prompt', 'instruction_template'],
    validationRequirements: ['PROMPT_SYNTAX_CHECK'],
    persistenceHandler: 'MANUAL_ONLY',
    indexingHandler: 'INDEX_AS_PROMPT'
  },
  '11_INBOX': {
    domain: 'QUARANTINE_AND_STAGING',
    ownership: 'GATEWAY_SAFETY_BUFFER',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_candidate_directive', 'json_inbox_registry'],
    validationRequirements: ['PAYLOAD_PRESERVATION', 'DIAGNOSTIC_REASON', 'READ_BACK_SHA256'],
    persistenceHandler: 'STANDALONE_INBOX_WRITER',
    indexingHandler: 'INDEX_AS_CANDIDATE_DIRECTIVE'
  },
  '12_DECISIONS': {
    domain: 'ARCHITECTURE_DECISIONS',
    ownership: 'CENTRAL_BRAIN',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['markdown_adr'],
    validationRequirements: ['SCHEMA_CHECK', 'READ_BACK_SHA256'],
    persistenceHandler: 'STANDALONE_ADR_WRITER',
    indexingHandler: 'INDEX_AS_ARCHITECTURE_DECISION'
  },
  '13_GOVERNANCE': {
    domain: 'GOVERNANCE_AND_POLICY',
    ownership: 'HUMAN_SIGNER_ONLY',
    routingEligibility: 'HUMAN_APPROVAL_GATED',
    acceptedSchemas: ['markdown_governance_protocol'],
    validationRequirements: ['HUMAN_SIGNATURE_TOKEN'],
    persistenceHandler: 'HUMAN_GATE_ONLY',
    indexingHandler: 'INDEX_AS_GOVERNANCE_POLICY'
  },
  '14_EVOLUTION': {
    domain: 'EVOLUTION_METRICS',
    ownership: 'EVOLUTION_ENGINE',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['json_yield_metrics', 'markdown_evolution_log'],
    validationRequirements: ['JSON_SCHEMA_VALIDATE', 'READ_BACK_SHA256'],
    persistenceHandler: 'METRICS_AGGREGATOR',
    indexingHandler: 'INDEX_AS_EVOLUTION_METRIC'
  },
  '15_METADATA': {
    domain: 'METADATA_AND_REGISTRIES',
    ownership: 'CENTRAL_BRAIN',
    routingEligibility: 'AUTOMATED_DIRECT_WRITE',
    acceptedSchemas: ['json_capability_registry', 'json_taxonomy'],
    validationRequirements: ['JSON_SCHEMA_VALIDATE', 'READ_BACK_SHA256'],
    persistenceHandler: 'REGISTRY_WRITER',
    indexingHandler: 'INDEX_AS_METADATA_CONTRACT'
  }
};

/**
 * Recursively scans directory structure to discover all destinations
 */
export function discoverCanonicalDestinations(brainRoot = DEFAULT_BRAIN_ROOT) {
  const root = path.resolve(brainRoot);
  const destinations = {};
  const discoveredFolders = [];
  const discoveredRegistries = [];
  const discoveredBlueprints = [];

  // 1. Scan Top-Level Directories
  const topItems = fs.readdirSync(root);
  for (const item of topItems) {
    const fullPath = path.join(root, item);
    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) continue;

    // Filter out node_modules, .git, and hidden tool dirs
    if (item === '.git' || item === 'node_modules' || item.startsWith('.project-brain')) continue;

    const profile = STRUCTURAL_PROFILES[item] || {
      domain: 'CUSTOM_EXTENSION',
      ownership: 'COMMUNITY_OR_PROJECT',
      routingEligibility: 'AUTOMATED_DIRECT_WRITE',
      acceptedSchemas: ['markdown_document'],
      validationRequirements: ['READ_BACK_SHA256'],
      persistenceHandler: 'STANDALONE_MARKDOWN_WRITER',
      indexingHandler: 'INDEX_AS_EXTENSION'
    };

    discoveredFolders.push(item);

    // Register top-level destination
    const topRel = item;
    destinations[topRel] = {
      destination_id: `DEST-${item}`,
      canonical_path: topRel,
      absolute_path: fullPath,
      name: item,
      level: 'TOP_LEVEL',
      domain: profile.domain,
      ownership: profile.ownership,
      routing_eligibility: profile.routingEligibility,
      accepted_schemas: profile.acceptedSchemas,
      validation_requirements: profile.validationRequirements,
      persistence_handler: profile.persistenceHandler,
      indexing_handler: profile.indexingHandler,
      is_directory: true,
      subdirectories_count: 0,
      files_count: 0,
      total_bytes: 0,
      nested_destinations: []
    };

    // 2. Recursive Scan of Subdirectories
    function walkSubdir(currentDir, parentRel) {
      let files = 0;
      let bytes = 0;
      let subdirs = 0;
      const childItems = fs.readdirSync(currentDir);

      for (const child of childItems) {
        const childFull = path.join(currentDir, child);
        const childStat = fs.statSync(childFull);
        const childRel = path.relative(root, childFull).replace(/\\/g, '/');

        if (childStat.isDirectory()) {
          subdirs++;
          const isBlueprint = childRel.includes('04_WORKFLOWS/blueprints/');
          const isDomainIntel = childRel.includes('05_KNOWLEDGE/domain-intelligence');
          const isInboxCandidates = childRel.includes('11_INBOX/candidate-directives');

          if (isBlueprint) {
            discoveredBlueprints.push(childRel);
          }

          // Register specialized nested destination
          destinations[childRel] = {
            destination_id: `DEST-${childRel.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
            canonical_path: childRel,
            absolute_path: childFull,
            name: child,
            level: 'NESTED_SUBDIRECTORY',
            parent_path: parentRel,
            domain: isDomainIntel ? 'DOMAIN_INTELLIGENCE_STORES' : (isBlueprint ? 'BLUEPRINT_TEMPLATES' : profile.domain),
            ownership: profile.ownership,
            routing_eligibility: isInboxCandidates ? 'AUTOMATED_DIRECT_WRITE' : profile.routingEligibility,
            accepted_schemas: isDomainIntel ? ['markdown_domain_intel'] : profile.acceptedSchemas,
            validation_requirements: profile.validationRequirements,
            persistenceHandler: isDomainIntel ? 'DOMAIN_INTEL_WRITER' : profile.persistenceHandler,
            indexingHandler: profile.indexingHandler,
            is_directory: true,
            subdirectories_count: 0,
            files_count: 0,
            total_bytes: 0,
            nested_destinations: []
          };

          destinations[parentRel]?.nested_destinations.push(childRel);

          const nestedStats = walkSubdir(childFull, childRel);
          destinations[childRel].subdirectories_count = nestedStats.subdirs;
          destinations[childRel].files_count = nestedStats.files;
          destinations[childRel].total_bytes = nestedStats.bytes;

          files += nestedStats.files;
          bytes += nestedStats.bytes;
          subdirs += nestedStats.subdirs;
        } else {
          files++;
          bytes += childStat.size;

          // Track specific registries and monolithic stores
          if (child.endsWith('-registry.json') || child.endsWith('-catalog.json') || child === 'knowledge-index.json' || child === 'engineering-patterns.md') {
            discoveredRegistries.push({
              path: childRel,
              size: childStat.size,
              last_modified: childStat.mtime.toISOString()
            });

            // Register specific high-value file sinks
            destinations[childRel] = {
              destination_id: `DEST-${childRel.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
              canonical_path: childRel,
              absolute_path: childFull,
              name: child,
              level: 'CANONICAL_FILE_SINK',
              parent_path: parentRel,
              domain: profile.domain,
              ownership: profile.ownership,
              routing_eligibility: profile.routingEligibility,
              accepted_schemas: child.endsWith('.json') ? ['json_registry'] : ['markdown_invariant_rule'],
              validation_requirements: profile.validationRequirements,
              persistenceHandler: child === 'engineering-patterns.md' ? 'SINGLE_FILE_APPEND' : 'ATOMIC_JSON_WRITER',
              indexingHandler: profile.indexingHandler,
              is_directory: false,
              files_count: 1,
              total_bytes: childStat.size
            };
            destinations[parentRel]?.nested_destinations.push(childRel);
          }
        }
      }
      return { files, bytes, subdirs };
    }

    const topStats = walkSubdir(fullPath, topRel);
    destinations[topRel].subdirectories_count = topStats.subdirs;
    destinations[topRel].files_count = topStats.files;
    destinations[topRel].total_bytes = topStats.bytes;
  }

  const result = {
    version: '1.0.0-universal',
    scan_timestamp: new Date().toISOString(),
    brain_root: root,
    total_destinations_discovered: Object.keys(destinations).length,
    canonical_top_level_folders: discoveredFolders,
    discovered_registries_count: discoveredRegistries.length,
    discovered_registries: discoveredRegistries,
    discovered_blueprints_count: discoveredBlueprints.length,
    discovered_blueprints: discoveredBlueprints,
    intelligence_domains: INTELLIGENCE_DOMAINS,
    destinations
  };

  return result;
}

/**
 * Saves and updates the Universal Destination Registry file atomically
 */
export function updateUniversalDestinationRegistry(brainRoot = DEFAULT_BRAIN_ROOT) {
  const root = path.resolve(brainRoot);
  const discovery = discoverCanonicalDestinations(root);
  const targetDir = path.join(root, '15_METADATA');
  fs.mkdirSync(targetDir, { recursive: true });

  const targetPath = path.join(targetDir, 'universal-destination-registry.json');
  const tmpPath = `${targetPath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(discovery, null, 2), 'utf-8');
  fs.renameSync(tmpPath, targetPath);

  console.log(`🧭 [DESTINATION DISCOVERY COMPLETE] Discovered ${discovery.total_destinations_discovered} destinations across ${discovery.canonical_top_level_folders.length} canonical domains.`);
  return discovery;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const res = updateUniversalDestinationRegistry();
  console.log(`Written to 15_METADATA/universal-destination-registry.json (${res.total_destinations_discovered} destinations).`);
}

