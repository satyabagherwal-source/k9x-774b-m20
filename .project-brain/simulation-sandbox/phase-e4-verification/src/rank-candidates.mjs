import fs from 'fs';
import path from 'path';

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));
const pending141 = e3Data.records.filter(r => r.synthesisStatus === 'SYNTHESIZED_PENDING_VERIFICATION');

const detailedCandidates = [];

for (const c of pending141) {
  const dPath = c.sourceProvenance?.dossierPath;
  if (!dPath || !fs.existsSync(dPath)) continue;
  
  const text = fs.readFileSync(dPath, 'utf8');
  
  // Search for the candidate's title or directiveId or core keywords in the dossier
  const titleClean = c.clearTechnicalTitle.replace(/[^\w\s]/g, ' ').trim();
  const words = titleClean.split(/\s+/).filter(w => w.length > 3);
  
  let matchCount = 0;
  for (const w of words) {
    const re = new RegExp('\\b' + w + '\\b', 'i');
    if (re.test(text)) matchCount++;
  }
  
  // Also check if text has explicit code blocks
  const codeBlocks = (text.match(/```/g) || []).length / 2;
  
  detailedCandidates.push({
    synthesisId: c.synthesisId,
    directiveId: c.directiveId,
    title: c.clearTechnicalTitle,
    repo: c.sourceProvenance.sourceRepo,
    domain: c.domains.primary,
    secondaryDomains: c.domains.secondary,
    dossierPath: dPath,
    wordsTotal: words.length,
    wordsMatched: matchCount,
    codeBlocks: Math.floor(codeBlocks),
    confidence: c.confidence,
    guidance: c.implementationGuidance,
    verificationMethod: c.verificationMethod
  });
}

// Sort by match ratio and code blocks
detailedCandidates.sort((a, b) => (b.wordsMatched / (b.wordsTotal || 1)) - (a.wordsMatched / (a.wordsTotal || 1)));

console.log('Top 30 candidates with best dossier correspondence:');
detailedCandidates.slice(0, 30).forEach((c, i) => {
  const ratio = (c.wordsMatched / (c.wordsTotal || 1)).toFixed(2);
  console.log(`${i+1}. [${c.synthesisId}] "${c.title}" | Repo: ${c.repo} | Dom: ${c.domain} | Ratio: ${ratio} | CodeBlocks: ${c.codeBlocks}`);
});

