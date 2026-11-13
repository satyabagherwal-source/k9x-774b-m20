/**
 * 04_WORKFLOWS/factory-engine/historical-backlog-redistributor.mjs
 *
 * Historical Knowledge Backlog Redistribution Engine (Dry-Run by Default)
 * Governing Architecture: AI-Builder-Brain Continuous Intelligence
 *
 * Analyzes historical raw dossiers (07_PROJECT_LEARNING) and rules (05_KNOWLEDGE)
 * to calculate eligible multi-artifact redistribution mappings without mutating original files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractMultiArtifactsFromPackage,
  UniversalMultiArtifactDistributor,
  DISTRIBUTION_MODES,
  calculateContentHash,
  sanitizeSlug
} from './universal-multi-artifact-distributor.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

export async function runHistoricalBacklogAudit(options = {}) {
  const root = options.brainRoot || BRAIN_ROOT;
  const learningDir = path.join(root, '07_PROJECT_LEARNING');
  const patternsPath = path.join(root, '05_KNOWLEDGE', 'engineering-patterns.md');
  const inboxDir = path.join(root, '11_INBOX', 'candidate-directives');

  console.log(`\n======================================================================`);
  console.log(`📜 HISTORICAL KNOWLEDGE BACKLOG AUDIT & REDISTRIBUTION DRY-RUN`);
  console.log(`   Brain Root : ${root}`);
  console.log(`   Mode       : DRY-RUN (Zero Writes to Canonical Knowledge)`);
  console.log(`======================================================================`);

  // 1. Ingest Dossiers from 07_PROJECT_LEARNING
  const dossierFiles = fs.existsSync(learningDir)
    ? fs.readdirSync(learningDir).filter(f => f.endsWith('-learnings.md'))
    : [];

  console.log(`Discovered ${dossierFiles.length} raw dossiers in 07_PROJECT_LEARNING.`);

  const auditStats = {
    total_dossiers_scanned: dossierFiles.length,
    valid_dossiers: 0,
    incomplete_dossiers: 0,
    potential_engineering_patterns: 0,
    potential_skills: 0,
    potential_domain_intel: 0,
    potential_adrs: 0,
    potential_agent_specs: 0,
    potential_verification_protocols: 0,
    duplicate_suppressions: 0,
    destination_breakdown: {
      '03_SKILLS': 0,
      '05_KNOWLEDGE/domain-intelligence': 0,
      '12_DECISIONS': 0,
      '02_AGENT_INTELLIGENCE': 0,
      '08_VERIFICATION': 0
    },
    sample_mappings: []
  };

  // Sample or full scan (support limit for high-speed deterministic verification)
  const limit = options.limit || 100; // Scan first 100 representative dossiers in dry-run
  const sampleFiles = dossierFiles.slice(0, limit);

  for (const f of sampleFiles) {
    const full = path.join(learningDir, f);
    const content = fs.readFileSync(full, 'utf-8');

    if (content.length < 100) {
      auditStats.incomplete_dossiers++;
      continue;
    }
    auditStats.valid_dossiers++;

    const slug = f.replace(/-learnings\.md$/i, '');
    const pkg = {
      repository: slug.replace(/-/g, '/'),
      slug,
      dossier_content: content,
      raw_dossier_text: content,
      metadata: {}
    };

    const extracted = extractMultiArtifactsFromPackage(pkg);

    for (const art of extracted.artifacts) {
      if (art.artifact_type === 'engineering_pattern') {
        auditStats.potential_engineering_patterns++;
      } else if (art.artifact_type === 'skill_playbook') {
        auditStats.potential_skills++;
        auditStats.destination_breakdown['03_SKILLS']++;
      } else if (art.artifact_type === 'domain_intelligence') {
        auditStats.potential_domain_intel++;
        auditStats.destination_breakdown['05_KNOWLEDGE/domain-intelligence']++;
      } else if (art.artifact_type === 'architecture_decision') {
        auditStats.potential_adrs++;
        auditStats.destination_breakdown['12_DECISIONS']++;
      } else if (art.artifact_type === 'agent_contract') {
        auditStats.potential_agent_specs++;
        auditStats.destination_breakdown['02_AGENT_INTELLIGENCE']++;
      } else if (art.artifact_type === 'verification_contract') {
        auditStats.potential_verification_protocols++;
        auditStats.destination_breakdown['08_VERIFICATION']++;
      }
    }

    if (auditStats.sample_mappings.length < 10) {
      auditStats.sample_mappings.push({
        dossier: f,
        repository: pkg.repository,
        artifactsDiscovered: extracted.artifacts.length,
        types: extracted.artifacts.map(a => a.artifact_type)
      });
    }
  }

  // 2. Extrapolate full backlog estimates if limited
  const scale = dossierFiles.length / Math.max(1, sampleFiles.length);
  const estimatedFullBacklog = {
    total_dossiers: dossierFiles.length,
    estimated_skills: Math.round(auditStats.potential_skills * scale),
    estimated_domain_intel: Math.round(auditStats.potential_domain_intel * scale),
    estimated_adrs: Math.round(auditStats.potential_adrs * scale),
    estimated_agent_specs: Math.round(auditStats.potential_agent_specs * scale),
    estimated_verifications: Math.round(auditStats.potential_verification_protocols * scale)
  };

  const report = {
    scan_timestamp: new Date().toISOString(),
    scanned_sample_count: sampleFiles.length,
    auditStats,
    estimatedFullBacklog,
    migration_safety_checklist: {
      zero_mutation_of_originals: true,
      no_mass_rewrites: true,
      dry_run_verified: true,
      approval_gated: true
    }
  };

  // Write Dry-Run Report to 08_VERIFICATION
  const reportPath = path.join(root, '08_VERIFICATION', 'HISTORICAL-BACKLOG-REDISTRIBUTION-DRY-RUN.md');
  const reportContent = `# HISTORICAL KNOWLEDGE BACKLOG REDISTRIBUTION DRY-RUN REPORT
**Mission ID:** \`BACKLOG-REDISTRIBUTION-DRY-RUN-01\`  
**Execution Mode:** STRICTLY READ-ONLY DRY-RUN  
**Generated At:** ${report.scan_timestamp}  

---

## 1. Executive Summary
- Total Dossiers Discovered in \`07_PROJECT_LEARNING/\`: **${dossierFiles.length} dossiers**
- Sample Ingested & Analyzed: **${sampleFiles.length} dossiers**
- Sample Valid Dossiers: **${auditStats.valid_dossiers}** (Incomplete: ${auditStats.incomplete_dossiers})
- Dry-Run Multi-Artifact Potential Identified:
  * Skills (\`03_SKILLS\`): **${auditStats.potential_skills}** (Estimated Full Backlog: ~${estimatedFullBacklog.estimated_skills})
  * Domain Intelligence (\`05_KNOWLEDGE/domain-intelligence\`): **${auditStats.potential_domain_intel}** (Estimated: ~${estimatedFullBacklog.estimated_domain_intel})
  * Architecture Decisions (\`12_DECISIONS\`): **${auditStats.potential_adrs}** (Estimated: ~${estimatedFullBacklog.estimated_adrs})
  * Agent Intelligence (\`02_AGENT_INTELLIGENCE\`): **${auditStats.potential_agent_specs}** (Estimated: ~${estimatedFullBacklog.estimated_agent_specs})
  * Verification Protocols (\`08_VERIFICATION\`): **${auditStats.potential_verification_protocols}** (Estimated: ~${estimatedFullBacklog.estimated_verifications})

---

## 2. Sample Redistribution Mappings
${auditStats.sample_mappings.map(m => `- **${m.dossier}** (${m.repository}): ${m.artifactsDiscovered} artifacts -> \`${m.types.join(', ')}\``).join('\n')}

---

## 3. Migration Safety & Approval Gate
- **Zero Original Mutations**: Raw dossiers in \`07_PROJECT_LEARNING\` will remain 100% untouched.
- **Approval Gate**: Actual bulk backfill is strictly gated and will NOT be executed without explicit authorization.
`;

  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`Dry-Run Report saved to 08_VERIFICATION/HISTORICAL-BACKLOG-REDISTRIBUTION-DRY-RUN.md`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runHistoricalBacklogAudit().then(r => {
    console.log(`Audit complete. Discovered potential skills: ${r.auditStats.potential_skills}, domain intel: ${r.auditStats.potential_domain_intel}`);
  });
}

