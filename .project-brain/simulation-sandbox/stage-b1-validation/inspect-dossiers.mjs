import fs from 'fs';

const dossiers = [
  '07_PROJECT_LEARNING/hf-sentence-transformers-all-minilm-l6-v2-learnings.md',
  '07_PROJECT_LEARNING/hf-prism-ml-ternary-bonsai-2-27b-gguf-learnings.md',
  '07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-quantized-learnings.md',
  '07_PROJECT_LEARNING/hf-nanbeige-nanbeige4.3-33b-learnings.md'
];

for (const d of dossiers) {
  console.log(`\n================================================================================`);
  console.log(`FILE: ${d}`);
  const content = fs.readFileSync(d, 'utf8');
  const lines = content.split('\n');
  const headings = lines.filter(l => l.startsWith('#'));
  console.log('Headings:', headings.slice(0, 15));
  console.log('Total lines:', lines.length);
}

