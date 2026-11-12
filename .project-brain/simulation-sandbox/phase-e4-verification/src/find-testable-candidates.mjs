import fs from 'fs';
import path from 'path';

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));
const pending141 = e3Data.records.filter(r => r.synthesisStatus === 'SYNTHESIZED_PENDING_VERIFICATION');

console.log('Inspecting parent dossier contents for potential testable candidates...');

const candidatesWithDossierSnippets = [];

for (const cand of pending141) {
  const dossierPath = cand.sourceProvenance?.dossierPath;
  if (!dossierPath || !fs.existsSync(dossierPath)) continue;
  
  const content = fs.readFileSync(dossierPath, 'utf8');
  
  // Check if dossier contains code blocks or concrete technical rules
  const codeBlockCount = (content.match(/```/g) || []).length / 2;
  const hasDiffOrAssert = /assert|diff|def |function |const |class |import /i.test(content);
  
  // Also check if candidate title is not boilerplate
  const isBoilerplate = /8 Learning Extraction|Fixes in README|Run refreshVersions|docs\(changelog\)|Add files via upload/i.test(cand.clearTechnicalTitle);
  
  if (!isBoilerplate && (codeBlockCount > 0 || hasDiffOrAssert)) {
    candidatesWithDossierSnippets.push({
      synthesisId: cand.synthesisId,
      directiveId: cand.directiveId,
      title: cand.clearTechnicalTitle,
      repo: cand.sourceProvenance.sourceRepo,
      commit: cand.sourceProvenance.sourceCommit,
      domain: cand.domains.primary,
      codeBlocks: Math.floor(codeBlockCount),
      dossierPath: dossierPath,
      dossierSize: content.length,
      originalProblem: cand.originalProblem.slice(0, 150),
      technicalPrinciple: cand.technicalPrinciple.slice(0, 150),
      negativeConstraints: cand.negativeConstraints.slice(0, 150),
      verificationMethod: cand.verificationMethod.slice(0, 150)
    });
  }
}

console.log(`Found ${candidatesWithDossierSnippets.length} non-boilerplate candidates with code/technical content in dossier.`);

// Sort by diversity of repository & technical depth
console.log('\nTop 25 candidates:');
candidatesWithDossierSnippets.slice(0, 25).forEach((c, i) => {
  console.log(`${i+1}. [${c.synthesisId}] "${c.title}" | Repo: ${c.repo} | Dom: ${c.domain} | CodeBlocks: ${c.codeBlocks}`);
});

