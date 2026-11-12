import fs from 'fs';
import path from 'path';

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));
const pending141 = e3Data.records.filter(r => r.synthesisStatus === 'SYNTHESIZED_PENDING_VERIFICATION');

const candidateIds = [
  'SYNTH-E3-134-CD-HBYI', // Nucleoid exception suites
  'SYNTH-E3-137-CD-644A', // OpenOPC Shadow Adapter
  'SYNTH-E3-141-CD-VR0E', // react-i18next explicit values vs defaultVariables
  'SYNTH-E3-143-CD-TBUZ', // Bitterbot payment authority
  'SYNTH-E3-153-CD-P49U'  // Turso concurrency & memory safety
];

for (const id of candidateIds) {
  const c = pending141.find(r => r.synthesisId === id);
  if (!c) {
    console.log(`Candidate ${id} NOT FOUND`);
    continue;
  }
  console.log('================================================================');
  console.log(`[${c.synthesisId}] "${c.clearTechnicalTitle}"`);
  console.log(`Repo: ${c.sourceProvenance.sourceRepo} | Domain: ${c.domains.primary}`);
  console.log(`Dossier: ${c.sourceProvenance.dossierPath}`);
  
  if (fs.existsSync(c.sourceProvenance.dossierPath)) {
    const raw = fs.readFileSync(c.sourceProvenance.dossierPath, 'utf8');
    console.log(`Dossier Length: ${raw.length} bytes`);
    
    // Look for first 600 characters of section 2, 3 or code block
    const codeMatch = raw.match(/```[a-z]*\n([\s\S]*?)```/);
    if (codeMatch) {
      console.log('--- Sample Code Block from Dossier ---');
      console.log(codeMatch[0].slice(0, 500));
      console.log('--------------------------------------');
    }
    console.log('--- Executive Summary / Key Insight ---');
    console.log(raw.slice(0, 600));
  }
}

