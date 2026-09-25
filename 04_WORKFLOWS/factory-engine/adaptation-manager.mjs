import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectUpstreamVersion } from './change-detector.mjs';
import { analyzeImpact } from './impact-analyzer.mjs';
import { updateSourceMetadata } from './source-registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FACTORY_ROOT = path.resolve(__dirname, '..', '..');

export function executeAdaptationPipeline(sourceKey) {
  console.log(`\n============================================================`);
  console.log(`⚡ [Ecosystem Adaptation Pipeline] Processing: ${sourceKey}`);
  console.log(`============================================================`);

  // Step 1 & 2: Upstream detection
  console.log('Stage 1-4: Detecting upstream version and drift...');
  const changeReport = detectUpstreamVersion(sourceKey);
  console.log(`Current Configured : ${changeReport.currentConfiguredVersion}`);
  console.log(`Upstream Detected  : ${changeReport.detectedUpstreamVersion}`);
  console.log(`Drift Classification: ${changeReport.diffType}`);

  // Step 3: Impact Analysis
  console.log('\nStage 5-7: Conducting Impact and Compatibility Analysis...');
  const impact = analyzeImpact(changeReport);
  console.log(`Severity           : ${impact.severity}`);
  console.log(`Breaking Risk      : ${impact.breakingRisk}`);
  console.log(`Recommended Action : ${impact.actionRecommended}`);
  console.log(`Rationale          : ${impact.reason}`);

  // Step 4: Decision Routing
  const result = {
    sourceKey,
    changeReport,
    impact,
    timestamp: new Date().toISOString(),
    status: 'COMPLETED',
    decision: impact.actionRecommended
  };

  if (impact.actionRecommended === 'REVIEW_REQUIRED') {
    console.log('\nStage 10: Routing to Review Required Path (High Impact / Major Drift)...');
    const proposal = generateAdaptationProposal(sourceKey, changeReport, impact);
    console.log(`✅ Formal Proposal Queued: ${proposal.filename}`);
    console.log(`   Path: ${proposal.filePath}`);
    console.log('   Human builder review required before template or Master Brain update.');
    result.proposal = proposal;
    result.status = 'PROPOSAL_QUEUED_FOR_REVIEW';
  } else if (impact.actionRecommended === 'SANDBOX_VERIFY_AND_UPDATE') {
    console.log('\nStage 10: Routing to Safe Automated Sandbox Update...');
    const applied = applySafeUpdate(sourceKey, changeReport);
    result.applied = applied;
    result.status = applied.success ? 'SAFELY_ADAPTED' : 'ADAPTATION_FAILED';
  } else {
    console.log('\nStage 10: Source is already current. No adaptation needed.');
    result.status = 'UP_TO_DATE';
  }

  return result;
}

function generateAdaptationProposal(sourceKey, changeReport, impact) {
  const queueDir = path.join(FACTORY_ROOT, '.project-brain', 'promotion-queue');
  fs.mkdirSync(queueDir, { recursive: true });

  const num = String(fs.readdirSync(queueDir).filter(f => f.startsWith('PROPOSAL-')).length + 1).padStart(3, '0');
  const filename = `PROPOSAL-${num}-ecosystem-adaptation-${sourceKey}-${changeReport.detectedUpstreamVersion}.md`;
  const filePath = path.join(queueDir, filename);

  const content = `# Ecosystem Adaptation Proposal: ${impact.name} (${changeReport.detectedUpstreamVersion})

- **Proposal ID**: PROPOSAL-${num}
- **Technology**: ${sourceKey}
- **Detected Upstream Release**: ${changeReport.detectedUpstreamVersion}
- **Current Pinned Version**: ${changeReport.currentConfiguredVersion}
- **Drift Classification**: ${changeReport.diffType}
- **Impact Severity**: ${impact.severity} (Breaking Risk: ${impact.breakingRisk})
- **Date**: ${new Date().toISOString()}
- **Governance Requirement**: Human Builder Review Required (Dynamic Knowledge Governance Law)

---

## 1. Rationale & Impact Analysis
${impact.reason}

## 2. Affected Factory Components
${impact.affectedComponents.map(c => `- \`${c}\``).join('\n')}

## 3. Invariants to Verify Before Merge
${impact.invariantsToVerify.map(i => `- [ ] ${i}`).join('\n')}

## 4. Proposed Migration Plan
1. Review official upstream changelog: [${impact.name} Documentation](${changeReport.officialUrl})
2. Create test sandbox branch in Project Factory.
3. Update template \`package.json\` and config files.
4. Run live multi-layer verification suite (\`npm run verify\`).
5. Upon successful live verification, promote updated pattern to Master Brain (\`05_KNOWLEDGE/engineering-patterns.md\`).

---

## 5. Review & Authorization Sign-off
- [ ] Reviewed official breaking changes.
- [ ] Sandbox test completed with exit code 0.
- [ ] Approved for Master Brain knowledge synchronization.
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  return { filename, filePath, num };
}

function applySafeUpdate(sourceKey, changeReport) {
  const templatePackageJson = path.join(FACTORY_ROOT, 'templates', 'astro-tailwind-v4', 'package.json');
  if (!fs.existsSync(templatePackageJson)) {
    return { success: false, error: 'Template package.json not found' };
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(templatePackageJson, 'utf-8'));
    const sourcePkgName = changeReport.sourceKey === 'tailwindcss' ? 'tailwindcss' : changeReport.sourceKey;

    if (pkg.dependencies && pkg.dependencies[sourcePkgName]) {
      pkg.dependencies[sourcePkgName] = `^${changeReport.detectedUpstreamVersion}`;
    }

    fs.writeFileSync(templatePackageJson, JSON.stringify(pkg, null, 2), 'utf-8');

    // Update registry metadata
    updateSourceMetadata(sourceKey, {
      currentVersion: `^${changeReport.detectedUpstreamVersion}`,
      lastVerified: new Date().toISOString()
    });

    console.log(`✓ Template package.json safely updated for ${sourceKey} -> ^${changeReport.detectedUpstreamVersion}`);
    return { success: true, updatedVersion: `^${changeReport.detectedUpstreamVersion}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
