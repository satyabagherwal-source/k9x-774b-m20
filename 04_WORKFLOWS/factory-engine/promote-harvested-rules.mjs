import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  createLearningPackage,
  submitToBrainGateway,
  extractCandidateRulesFromText,
  LEARNING_STATUS,
  LEARNING_DIR,
  INBOX_REGISTRY_PATH
} from './brain-learning-gateway.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_ROOT = path.resolve(__dirname, '..', '..');

async function runPromotionPipeline() {
  console.log('======================================================================');
  console.log('🚀 PROMOTION PIPELINE: CONVAIINNOVATIONS/LAYA & COLINHACKS/ZOD');
  console.log('======================================================================');

  const targets = [
    {
      slug: 'hf-convaiinnovations-laya',
      repo: 'convaiinnovations/laya',
      platform: 'huggingface',
      sourceUrl: 'https://huggingface.co/convaiinnovations/laya',
      sourceVersion: 'hf-convaiinnovations-laya',
      license: 'Open-Source (Permissive)',
      aiProvider: 'google-gemini-cloud-agent',
      dossierFile: path.join(LEARNING_DIR, 'hf-convaiinnovations-laya-learnings.md')
    },
    {
      slug: 'colinhacks-zod',
      repo: 'colinhacks/zod',
      platform: 'github',
      sourceUrl: 'https://github.com/colinhacks/zod',
      sourceVersion: '284243fb',
      license: 'MIT',
      aiProvider: 'google-gemini-cloud-agent',
      dossierFile: path.join(LEARNING_DIR, 'colinhacks-zod-learnings.md')
    }
  ];

  const results = [];

  for (const t of targets) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`[TARGET] Processing: ${t.repo} (${t.platform})`);
    console.log(`----------------------------------------------------------------------`);

    if (!fs.existsSync(t.dossierFile)) {
      throw new Error(`Dossier file missing: ${t.dossierFile}`);
    }

    const dossierContent = fs.readFileSync(t.dossierFile, 'utf-8');
    const candidates = extractCandidateRulesFromText(dossierContent);
    console.log(`Discovered candidate rules in dossier: ${candidates.length}`);
    candidates.forEach((c, idx) => {
      console.log(`  [Candidate ${idx + 1}] "${c.title}" (${c.body.length} chars)`);
    });

    const pkg = createLearningPackage({
      repository: t.repo,
      platform: t.platform,
      slug: t.slug,
      sourceUrl: t.sourceUrl,
      sourceVersion: t.sourceVersion,
      license: t.license,
      aiProvider: t.aiProvider,
      dossierText: dossierContent,
      candidateRules: candidates
    });

    console.log(`Submitting package to canonical Brain Learning Gateway...`);
    const gatewayResult = await submitToBrainGateway(pkg);

    if (!gatewayResult.success) {
      console.error(`❌ Gateway submission failed for ${t.repo}:`, gatewayResult.errors);
      results.push({ target: t.repo, success: false, errors: gatewayResult.errors });
    } else {
      console.log(`✅ Gateway submission succeeded! Status: ${gatewayResult.status}`);
      console.log(`   Promoted Rules:`, gatewayResult.promoted_rules.map(r => `Rule ${r.number}: "${r.title}" (${r.status})`).join(', '));
      results.push({
        target: t.repo,
        success: true,
        status: gatewayResult.status,
        promotedRules: gatewayResult.promoted_rules
      });

      // Update 11_INBOX status for any promoted directive
      if (fs.existsSync(INBOX_REGISTRY_PATH) && gatewayResult.promoted_rules.length > 0) {
        try {
          const registry = JSON.parse(fs.readFileSync(INBOX_REGISTRY_PATH, 'utf-8'));
          let updated = false;
          for (const pr of gatewayResult.promoted_rules) {
            for (const d of registry.directives) {
              if (d.source_repo === t.repo && (d.directive_title === pr.title || d.directive_title.includes(pr.title))) {
                d.status = 'PROMOTED_CANONICAL_ACTIVE';
                d.promoted_rule = `Rule ${pr.number}`;
                d.promoted_date = new Date().toISOString().slice(0, 10);
                updated = true;
              }
            }
          }
          if (updated) {
            registry.last_updated = new Date().toISOString();
            fs.writeFileSync(INBOX_REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
            console.log(`📥 [INBOX UPDATED] Candidate directives marked as PROMOTED_CANONICAL_ACTIVE in 11_INBOX.`);
          }
        } catch (e) {
          console.warn(`Could not update inbox registry: ${e.message}`);
        }
      }
    }
  }

  console.log('\n======================================================================');
  console.log('🏁 PROMOTION SUMMARY');
  console.log('======================================================================');
  results.forEach(r => {
    console.log(`${r.target}: Success=${r.success}, Promoted=${(r.promotedRules || []).map(p => `Rule ${p.number} (${p.title})`).join(', ') || 'None'}`);
  });
}

runPromotionPipeline().catch(err => {
  console.error('FATAL PROMOTION ERROR:', err);
  process.exit(1);
});
