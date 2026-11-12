import fs from 'fs';

const synth = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/stage-b-synthesis/stage-b-synthesis-dataset-197.json', 'utf8'));
const cd = JSON.parse(fs.readFileSync('11_INBOX/candidate-directives-registry.json', 'utf8'));

const champions = synth.records.filter(r => r.final_classification.startsWith('EVIDENCE_SUPPORTED'));

console.log('Total Stage B Champions:', champions.length);

const cdMap = new Map((cd.directives || []).map(d => [d.directive_id || d.id, d]));

for (let i = 0; i < champions.length; i++) {
  const c = champions[i];
  const cdOrig = cdMap.get(c.candidate_id);
  console.log(`\n================================================================================`);
  console.log(`CHAMPION ${i + 1}: [${c.candidate_id}] ${c.synthesized_title}`);
  console.log(`Stage B Classification: ${c.final_classification}`);
  console.log(`Repo: ${c.source_provenance?.repository}`);
  console.log(`Commit: ${c.source_provenance?.commit}`);
  console.log(`Dossier File: ${c.source_provenance?.dossier_file}`);
  console.log(`Files Changed: ${JSON.stringify(c.files_changed)}`);
  console.log(`Original Directive Title: ${cdOrig?.title || cdOrig?.directive_title || 'N/A'}`);
  
  // Check if dossier file exists on disk
  if (c.source_provenance?.dossier_file && fs.existsSync(c.source_provenance.dossier_file)) {
    const dossierContent = fs.readFileSync(c.source_provenance.dossier_file, 'utf8');
    console.log(`Dossier File Size: ${dossierContent.length} bytes`);
    
    // Check if the candidate ID or title appears in the dossier
    const hasCandidateId = dossierContent.includes(c.candidate_id);
    const hasTitleSnippet = dossierContent.toLowerCase().includes(c.original_title.toLowerCase().slice(0, 20));
    console.log(`Candidate ID found in dossier: ${hasCandidateId}`);
    console.log(`Original title snippet found in dossier: ${hasTitleSnippet}`);
  } else {
    console.log(`Dossier File Exists: FALSE (Path: ${c.source_provenance?.dossier_file})`);
  }
}

