import fs from 'fs';
import path from 'path';

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));
const pending141 = e3Data.records.filter(r => r.synthesisStatus === 'SYNTHESIZED_PENDING_VERIFICATION');

console.log('Total pending candidates:', pending141.length);

// Group by repository
const byRepo = {};
for (const cand of pending141) {
  const repo = cand.sourceProvenance?.sourceRepo || 'unknown';
  if (!byRepo[repo]) byRepo[repo] = [];
  byRepo[repo].push(cand);
}

console.log('\n--- CANDIDATES BY REPOSITORY (Top 20) ---');
const sortedRepos = Object.entries(byRepo).sort((a, b) => b[1].length - a[1].length);
for (const [repo, cands] of sortedRepos.slice(0, 20)) {
  console.log(`${repo}: ${cands.length} candidates`);
}

// Group by primary domain
const byDom = {};
for (const cand of pending141) {
  const dom = cand.domains.primary;
  byDom[dom] = (byDom[dom] || 0) + 1;
}
console.log('\n--- CANDIDATES BY PRIMARY DOMAIN ---');
console.log(byDom);

// Let's inspect diverse candidates across repositories and domains
console.log('\n--- DIVERSE CANDIDATE SAMPLE ---');
const sample = [];
const seenRepos = new Set();
for (const cand of pending141) {
  const repo = cand.sourceProvenance?.sourceRepo;
  if (!seenRepos.has(repo) && sample.length < 25) {
    seenRepos.add(repo);
    sample.push({
      synthesisId: cand.synthesisId,
      directiveId: cand.directiveId,
      title: cand.clearTechnicalTitle,
      repo: repo,
      domain: cand.domains.primary,
      dossier: cand.sourceProvenance?.dossierPath
    });
  }
}

for (const s of sample) {
  console.log(`[${s.synthesisId}] "${s.title}" | Repo: ${s.repo} | Dom: ${s.domain} | Dossier: ${path.basename(s.dossier || '')}`);
}
