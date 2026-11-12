import fs from 'fs';
import path from 'path';

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));
const pending141 = e3Data.records.filter(r => r.synthesisStatus === 'SYNTHESIZED_PENDING_VERIFICATION');

// List of target candidate IDs to inspect
const candidateIds = [
  'SYNTH-E3-014-CD-J7YF', // Context Length Clamping
  'SYNTH-E3-020-CD-V1HX', // MLA KV Cache Dimension Invariant
  'SYNTH-E3-029-CD-BKS6', // Deterministic Decoding for Extraction Tasks
  'SYNTH-E3-096-CD-DVLL', // Permutation-Invariant Multi-Choice Logit Aggregation
  'SYNTH-E3-106-CD-YKUY', // Unique Special Token ID Allocation
  'SYNTH-E3-108-CD-YKUY', // Patch Size Divisibility for Vision Encoder
  'SYNTH-E3-122-CD-X37I', // Partial RoPE Application
  'SYNTH-E3-134-CD-HBYI', // Nucleoid exception suites
  'SYNTH-E3-137-CD-644A', // OpenOPC Shadow Adapter
  'SYNTH-E3-141-CD-VR0E', // react-i18next explicit values vs defaultVariables
  'SYNTH-E3-143-CD-TBUZ', // Bitterbot payment authority
  'SYNTH-E3-153-CD-P49U'  // Turso concurrency & memory safety
];

for (const id of candidateIds) {
  const c = pending141.find(r => r.synthesisId === id);
  if (!c) {
    console.log(`Candidate ${id} NOT FOUND in pending141`);
    continue;
  }
  console.log('================================================================');
  console.log(`[${c.synthesisId}] "${c.clearTechnicalTitle}"`);
  console.log(`Repo: ${c.sourceProvenance.sourceRepo} | Domain: ${c.domains.primary}`);
  console.log(`Dossier: ${c.sourceProvenance.dossierPath}`);
  
  if (fs.existsSync(c.sourceProvenance.dossierPath)) {
    const raw = fs.readFileSync(c.sourceProvenance.dossierPath, 'utf8');
    console.log(`Dossier Length: ${raw.length} bytes`);
    
    // Look for matching sections or mentions of title keywords
    const keywords = c.clearTechnicalTitle.split(' ').filter(w => w.length > 3);
    const regex = new RegExp(keywords.slice(0, 3).join('|'), 'gi');
    const matches = [...raw.matchAll(regex)];
    console.log(`Keyword matches in dossier: ${matches.length}`);
    
    // Print snippet around first match
    if (matches.length > 0) {
      const idx = matches[0].index;
      const start = Math.max(0, idx - 150);
      const end = Math.min(raw.length, idx + 400);
      console.log('--- Dossier Snippet ---');
      console.log(raw.slice(start, end));
      console.log('-----------------------');
    }
  } else {
    console.log('Dossier file does not exist on disk!');
  }
}

