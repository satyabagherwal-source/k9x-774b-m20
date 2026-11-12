import fs from 'fs';
import path from 'path';

const e3Data = JSON.parse(fs.readFileSync('.project-brain/simulation-sandbox/phase-e3-synthesis/data/synthesized-candidates-249.json', 'utf8'));

const selectedIds = [
  {
    id: 'SYNTH-E3-164-CD-F2AV',
    mechanism: 'LLM Response Sanitization & Brace-Aware JSON Extraction',
    expectedCategory: 'VERIFIED_INDEPENDENTLY',
    rationale: 'Complete TypeScript source code present in dossier; directly executable; critical for reliable AI agent JSON outputs.'
  },
  {
    id: 'SYNTH-E3-179-CD-3H9L',
    mechanism: 'Documentation Heading-to-Anchor Slugification Invariant',
    expectedCategory: 'VERIFIED_INDEPENDENTLY',
    rationale: 'Clear algorithmic slugification rules in dossier; directly executable against real Markdown documents; essential for knowledge indexing.'
  },
  {
    id: 'SYNTH-E3-113-CD-8KGR',
    mechanism: 'Binary Model Artifact Magic Header & Format Verification',
    expectedCategory: 'VERIFIED_INDEPENDENTLY',
    rationale: 'Binary header format specifications (GGUF magic bytes vs Safetensors JSON header length) present; executable on binary buffers.'
  },
  {
    id: 'SYNTH-E3-108-CD-YKUY',
    mechanism: 'Vision Transformer Patch Divisibility & Spatial Clamping',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Exact mathematical divisibility rule (H % 14 === 0 && W % 14 === 0) and padding logic verifiable; full 1B weights unavailable offline.'
  },
  {
    id: 'SYNTH-E3-122-CD-X37I',
    mechanism: 'Partial Rotary Positional Embedding (Partial RoPE) Head Splitting',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Mathematical tensor slicing contract (d_rope=64, d_pass=64) verifiable; full model weights unavailable offline.'
  },
  {
    id: 'SYNTH-E3-020-CD-V1HX',
    mechanism: 'Multi-Head Latent Attention (MLA) KV Cache Compression Ratio',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Mathematical latent dimension projection invariant (d_c=512 vs 8192, 16x compression) verifiable; 671B model weights unavailable offline.'
  },
  {
    id: 'SYNTH-E3-096-CD-DVLL',
    mechanism: 'Permutation-Invariant Multi-Choice Logit Aggregation',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Python code snippet for fixed-vocabulary logit classification in dossier; logit aggregation logic verifiable; 150M weights unavailable offline.'
  },
  {
    id: 'SYNTH-E3-014-CD-J7YF',
    mechanism: 'Context Length Clamping & Allocation Envelope Boundary',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Sequence length boundary clamping formula verifiable; llama.cpp runtime binary unavailable offline.'
  },
  {
    id: 'SYNTH-E3-029-CD-BKS6',
    mechanism: 'Deterministic Decoding Configuration for Structured Extraction',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Decoding parameter contract (T=0, top_p=1.0) verifiable; TeleOCR vision-language runtime unavailable offline.'
  },
  {
    id: 'SYNTH-E3-137-CD-644A',
    mechanism: 'Software Adapter Interface Defense & Property Mapping',
    expectedCategory: 'PARTIALLY_VERIFIED',
    rationale: 'Defensive property conversion and interface compliance verifiable; industrial OPC server unavailable offline.'
  },
  {
    id: 'SYNTH-E3-134-CD-HBYI',
    mechanism: 'Colon-Free Indented Suite Parsing in Rust AST Parser',
    expectedCategory: 'NOT_INDEPENDENTLY_VERIFIABLE',
    rationale: 'Rust source code in dossier, but rustc compiler is not installed in current execution environment.'
  },
  {
    id: 'SYNTH-E3-153-CD-P49U',
    mechanism: 'SQL Schema Modification Dependency Order (DROP FUNCTION CASCADE)',
    expectedCategory: 'NOT_INDEPENDENTLY_VERIFIABLE',
    rationale: 'Dossier contains incident discussion and commit logs, but core Limbo database engine source is omitted from dossier.'
  }
];

const selectedRecords = [];
for (const s of selectedIds) {
  const rec = e3Data.records.find(r => r.synthesisId === s.id);
  if (!rec) throw new Error(`Candidate not found: ${s.id}`);
  selectedRecords.push({
    ...rec,
    selectionMetadata: {
      mechanism: s.mechanism,
      preTestExpectedCategory: s.expectedCategory,
      selectionRationale: s.rationale
    }
  });
}

const outputPath = '.project-brain/simulation-sandbox/phase-e4-verification/selected-candidates.json';
fs.writeFileSync(outputPath, JSON.stringify({
  count: selectedRecords.length,
  selectionCriteria: {
    maxAllowed: 12,
    domainDiversity: 'Covers Domains M, H, I, G, D',
    repoDiversity: '10 distinct upstream repositories',
    evidenceGrounding: '100% matched with on-disk forensic dossiers'
  },
  candidates: selectedRecords
}, null, 2));

console.log(`Successfully wrote ${selectedRecords.length} selected candidates to ${outputPath}`);

