import fs from 'fs';

const targets = [
  { id: 'SYNTH-E3-164-CD-F2AV', name: 'serpiq extractJSON' },
  { id: 'SYNTH-E3-134-CD-HBYI', name: 'Nucleoid colon-free parser' },
  { id: 'SYNTH-E3-020-CD-V1HX', name: 'DeepSeek-R1 MLA KV Cache' },
  { id: 'SYNTH-E3-108-CD-YKUY', name: 'MiniCPM-V Patch Divisibility' },
  { id: 'SYNTH-E3-122-CD-X37I', name: 'MiniCPM-V Partial RoPE' },
  { id: 'SYNTH-E3-096-CD-DVLL', name: 'Phocinae Multi-Choice Logit' },
  { id: 'SYNTH-E3-014-CD-J7YF', name: 'Qwen GGUF Context Clamping' },
  { id: 'SYNTH-E3-029-CD-BKS6', name: 'TeleOCR Deterministic Decoding' },
  { id: 'SYNTH-E3-137-CD-644A', name: 'OpenOPC Shadow Adapter' },
  { id: 'SYNTH-E3-179-CD-3H9L', name: 'Apple Silicon Anchor Heading' },
  { id: 'SYNTH-E3-113-CD-8KGR', name: 'Qwen-Image Format Invariant' },
  { id: 'SYNTH-E3-153-CD-P49U', name: 'Turso Concurrency & Drop Function' }
];

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));

for (const t of targets) {
  const c = e3Data.records.find(r => r.synthesisId === t.id);
  if (!c) {
    console.log(`[NOT FOUND] ${t.id}`);
    continue;
  }
  const dPath = c.sourceProvenance.dossierPath;
  const exists = fs.existsSync(dPath);
  console.log(`\n======================================================`);
  console.log(`ID: ${c.synthesisId} | Directive: ${c.directiveId}`);
  console.log(`Title: "${c.clearTechnicalTitle}"`);
  console.log(`Repo: ${c.sourceProvenance.sourceRepo} | Commit: ${c.sourceProvenance.sourceCommit}`);
  console.log(`Domain: ${c.domains.primary} (${c.domains.primaryName}) | Dest: ${c.canonicalDestination.targetFolder}`);
  console.log(`Dossier (${exists ? 'EXISTS' : 'MISSING'}): ${dPath}`);
  
  if (exists) {
    const raw = fs.readFileSync(dPath, 'utf8');
    const codeMatches = [...raw.matchAll(/```([a-z0-9_-]*)\r?\n([\s\S]*?)```/gi)];
    console.log(`Dossier size: ${raw.length} bytes | Code blocks: ${codeMatches.length}`);
    if (codeMatches.length > 0) {
      console.log(`Sample code block language: ${codeMatches[0][1] || 'none'}`);
      console.log(`Sample snippet: ${codeMatches[0][2].slice(0, 180).replace(/\r?\n/g, ' ')}...`);
    }
  }
}
