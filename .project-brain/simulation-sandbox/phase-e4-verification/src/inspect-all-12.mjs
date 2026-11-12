import fs from 'fs';

function inspectCandidate(dossierPath, terms) {
  if (!fs.existsSync(dossierPath)) return `MISSING: ${dossierPath}`;
  const text = fs.readFileSync(dossierPath, 'utf8');
  const results = [];
  for (const t of terms) {
    const idx = text.toLowerCase().indexOf(t.toLowerCase());
    if (idx !== -1) {
      results.push({
        term: t,
        snippet: text.slice(Math.max(0, idx - 80), Math.min(text.length, idx + 400)).replace(/\r?\n/g, ' ')
      });
    } else {
      results.push({ term: t, snippet: 'NOT FOUND' });
    }
  }
  return results;
}

console.log('--- 1. serpiq (extractJSON) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/manojahi-serpiq-learnings.md', ['extractJSON', 'sliceFirstBalancedObject']));

console.log('\n--- 2. Apple Silicon Guide (Anchor-Heading) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/mikeroyal-apple-silicon-guide-learnings.md', ['anchor', 'heading', 'table of contents']));

console.log('\n--- 3. Phocinae (Multi-Choice Logit) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-phocinae-phocinae-largha-150m-v1-learnings.md', ['outputs = model', 'logits', 'choice_token_ids']));

console.log('\n--- 4. MiniCPM-V (Patch Size Divisibility) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-1b-learnings.md', ['patch size', '14x14', 'divisibility']));

console.log('\n--- 5. MiniCPM-V (Partial RoPE) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-openbmb-minicpm-v-4.7-1b-learnings.md', ['rope', 'partial', 'head_dim']));

console.log('\n--- 6. DeepSeek-R1 (MLA KV Cache) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-r1-learnings.md', ['MLA', 'latent', 'kv cache', 'compression']));

console.log('\n--- 7. Qwen GGUF (Context Length Clamping) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-orcarouter-qwen3.8-flash-next-uncensored-gguf-learnings.md', ['context_length', 'clamping', 'gguf']));

console.log('\n--- 8. TeleOCR (Deterministic Decoding) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-xingchen-agi-teleocr-learnings.md', ['deterministic', 'temperature', 'sampling']));

console.log('\n--- 9. Nucleoid (Colon-free parser) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/nucleoidai-nucleoid-learnings.md', ['suite_body', 'colon', 'indent']));

console.log('\n--- 10. OpenOPC (Shadow Adapter) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/ahmadhassan-bted-openopc-shadow-adapter-learnings.md', ['adapter', 'methods', 'submitTask']));

console.log('\n--- 11. Qwen-Image Quantized (Binary Artifact Versioning) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-quantized-learnings.md', ['versioning', 'format', 'compatibility']));

console.log('\n--- 12. Turso Limbo (Drop Function & Concurrency) ---');
console.log(inspectCandidate('07_PROJECT_LEARNING/tursodatabase-limbo-learnings.md', ['DROP FUNCTION', 'CASCADE', 'concurrency']));

