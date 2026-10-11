import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export function generateFolderCoverageAudit() {
  const taxonomyPath = path.join(BRAIN_ROOT, '15_METADATA', 'knowledge-taxonomy.json');
  let taxonomy = {};
  if (fs.existsSync(taxonomyPath)) {
    try {
      taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
    } catch (e) {}
  }

  const folders = [
    '00_START_HERE',
    '01_CORE',
    '02_AGENT_INTELLIGENCE',
    '03_SKILLS',
    '04_WORKFLOWS',
    '05_KNOWLEDGE',
    '06_PROJECT_CONTEXT',
    '07_PROJECT_LEARNING',
    '08_VERIFICATION',
    '09_SOURCES',
    '10_PROMPTS',
    '11_INBOX',
    '12_DECISIONS',
    '13_GOVERNANCE',
    '14_EVOLUTION',
    '15_METADATA'
  ];

  const results = [];

  for (const folder of folders) {
    const fullPath = path.join(BRAIN_ROOT, folder);
    const exists = fs.existsSync(fullPath);
    let fileCount = 0;
    let lastModified = 'N/A';

    if (exists) {
      try {
        const files = fs.readdirSync(fullPath, { recursive: true });
        fileCount = files.filter(f => {
          try {
            return fs.statSync(path.join(fullPath, f)).isFile();
          } catch (e) {
            return false;
          }
        }).length;

        const stats = fs.statSync(fullPath);
        lastModified = stats.mtime.toISOString();
      } catch (e) {}
    }

    const meta = taxonomy.canonical_folders?.[folder] || {};
    const purpose = meta.purpose || 'Canonical Directory';
    const routingPolicy = meta.routing_policy || 'STANDARD';
    const isTarget = meta.harvester_target || false;

    let routingComponent = 'N/A';
    let status = 'HEALTHY';
    let explanation = '';

    switch (folder) {
      case '00_START_HERE':
        routingComponent = 'AGENT_BOOT_PROTOCOL.md, TASK_COMPLEXITY_ROUTER.md';
        explanation = 'Static boot & routing anchor. Updated only upon architectural protocol revision.';
        break;
      case '01_CORE':
        routingComponent = 'operating-rules.md, decision-rules.md';
        explanation = 'Core universal invariants (Rules 1-25+). Updated conditionally via tier-1 human directives.';
        break;
      case '02_AGENT_INTELLIGENCE':
        routingComponent = 'project-agent-boot-protocol.md';
        explanation = 'Agent reasoning governance. Updated conditionally when agent cognitive loop changes.';
        break;
      case '03_SKILLS':
        routingComponent = 'skills-registry, skill-runner.mjs';
        explanation = 'Agent technical playbooks. Updated when new framework capabilities are promoted.';
        break;
      case '04_WORKFLOWS':
        routingComponent = 'factory-engine/ (brain-learning-gateway, ai-provider-pool, zero-clone-harvester)';
        explanation = 'Active automation engine and pipelines. Execution scripts, schemas, and runners.';
        break;
      case '05_KNOWLEDGE':
        routingComponent = 'brain-learning-gateway.mjs (PATTERNS_PATH, INDEX_PATH)';
        explanation = 'Mandatory pipeline folder. Universal patterns (engineering-patterns.md) & knowledge-index.json.';
        break;
      case '06_PROJECT_CONTEXT':
        routingComponent = 'project-specific specifications';
        explanation = 'Active project mission definitions. Updated per active product project.';
        break;
      case '07_PROJECT_LEARNING':
        routingComponent = 'brain-learning-gateway.mjs (LEARNING_DIR)';
        explanation = 'Mandatory pipeline folder. Full forensic dossiers and repository incident post-mortems.';
        break;
      case '08_VERIFICATION':
        routingComponent = 'brain-learning-gateway.mjs (recordVerificationEvidence)';
        explanation = 'Mandatory pipeline folder. Empirical inspection matrix, test proofs, and verification logs.';
        break;
      case '09_SOURCES':
        routingComponent = 'brain-learning-gateway.mjs (recordSourceProvenance)';
        explanation = 'Mandatory pipeline folder. Provenance ledger, commit SHAs, line citations, and sources catalog.';
        break;
      case '10_PROMPTS':
        routingComponent = 'canonical agent master prompts';
        explanation = 'Master prompts for agents. Updated conditionally when new agent archetypes are added.';
        break;
      case '11_INBOX':
        routingComponent = 'brain-learning-gateway.mjs (stageUnverifiedCandidates)';
        explanation = 'Mandatory pipeline folder. Raw candidate directives & unverified findings staged for review.';
        break;
      case '12_DECISIONS':
        routingComponent = 'Architecture Decision Records (ADRs)';
        explanation = 'Formal architectural decisions. Updated when major system architecture shifts occur.';
        break;
      case '13_GOVERNANCE':
        routingComponent = 'data-classification, provider-usage-rules';
        explanation = 'Governance policies and provider usage constraints. Updated conditionally.';
        break;
      case '14_EVOLUTION':
        routingComponent = 'brain-learning-gateway.mjs (recordEvolutionMetrics)';
        explanation = 'Mandatory pipeline folder. Quantified harvest yield metrics and self-improvement logs.';
        break;
      case '15_METADATA':
        routingComponent = 'knowledge-taxonomy.json, brain-status.md';
        explanation = 'Taxonomies, schemas, catalogs, and brain status records. Canonical index.';
        break;
    }

    results.push({
      folder,
      exists,
      fileCount,
      purpose,
      routingPolicy,
      isHarvestTarget: isTarget,
      routingComponent,
      lastModified,
      explanation
    });
  }

  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const audit = generateFolderCoverageAudit();
  console.log('========================================================================================');
  console.log('🏛️  AI-BUILDER-BRAIN CANONICAL ARCHITECTURE FOLDER COVERAGE AUDIT');
  console.log('========================================================================================\n');
  console.table(audit.map(a => ({
    Folder: a.folder,
    Files: a.fileCount,
    PipelineTarget: a.isHarvestTarget ? 'YES' : 'CONDITIONAL',
    Policy: a.routingPolicy,
    RoutingComponent: a.routingComponent.slice(0, 35)
  })));
}
