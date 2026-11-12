# Agentic Knowledge Gateway (`agentic-kgw`)

> A robust, zero-external-dependency CLI and reusable core library for safe AI/LLM structured output extraction, document indexing, and model artifact inspection.

---

## 1. Overview & Architecture

Modern LLMs frequently introduce formatting noise: conversational preambles ("Here is the requested output:"), markdown code blocks (````json ... ````), and trailing commentary. Furthermore, model serving architectures require strict defensive boundaries to prevent buffer overflows, out-of-context memory leaks, and non-deterministic extraction drift.

`agentic-kgw` solves these challenges by packaging verified, evidence-grounded engineering patterns extracted directly from forensic software autopsies in **AI-Builder-Brain**:
1. **Brace-Aware JSON Extractor:** Grounded in Pattern `SYNTH-E3-164-CD-F2AV` (from `manojahi/serpiq`).
2. **GitHub-Standard Heading Slugifier:** Grounded in Pattern `SYNTH-E3-179-CD-3H9L` (from `mikeroyal/Apple-Silicon-Guide`).
3. **Safe Binary Model Header Inspector:** Grounded in Pattern `SYNTH-E3-113-CD-8KGR` (from `abenzerps/Qwen-Image-2.1-Uncensored-Quantized`).
4. **Context Clamping & Extraction Guard:** Grounded in Patterns `SYNTH-E3-014-CD-J7YF` and `SYNTH-E3-029-CD-BKS6`.

---

## 2. CLI Usage

The gateway provides a unified, cross-platform CLI:

```bash
# 1. Display Gateway Help & Version
node bin/cli.mjs help
node bin/cli.mjs version

# 2. Extract JSON from conversational / fenced LLM output
node bin/cli.mjs extract-json "Here is your JSON: {\"status\": \"ok\", \"id\": 101} Hope this helps!"
node bin/cli.mjs extract-json --file responses/llm-output.txt --pretty

# 3. Slugify Markdown Headings into URL Anchors
node bin/cli.mjs slugify "## 1. Quick Start Guide & Setup (v2)!"
# Output: 1-quick-start-guide--setup-v2

# 4. Generate Table of Contents from Markdown File
node bin/cli.mjs slugify --file README.md

# 5. Safely Inspect Binary Model Files (GGUF / Safetensors)
node bin/cli.mjs inspect-artifact models/model.gguf
node bin/cli.mjs inspect-artifact models/weights.safetensors --max-header-mb 50

# 6. Validate Deterministic Generation Configuration
node bin/cli.mjs validate-config "{\"temperature\": 0.0, \"do_sample\": false, \"repetition_penalty\": 1.05}"
```

### Exit Codes:
- `0`: Success
- `1`: Parsing failure, corrupted binary artifact, or validation violation
- `2`: CLI usage / argument syntax error

---

## 3. Reusable Core Library API

`agentic-kgw` can be imported as an ES Module in any Node.js application:

```javascript
import {
  extractJSON,
  ExtractJSONError,
  slugifyHeading,
  generateTableOfContents,
  inspectModelBinaryEnvelope,
  clampContext,
  validateExtractionConfig
} from 'agentic-kgw';

// 1. Safe JSON Extraction
try {
  const result = extractJSON(rawLlmString);
  console.log('Parsed Object:', result);
} catch (err) {
  if (err instanceof ExtractJSONError) {
    console.error('Failed to parse:', err.message, 'Raw preview:', err.raw);
  }
}

// 2. Heading to URL Anchor
const anchor = slugifyHeading('### What\'s New in v2.0?');
// Returns: "whats-new-in-v20"

// 3. Binary Artifact Inspection
const buffer = fs.readFileSync('model.safetensors');
const metadata = inspectModelBinaryEnvelope(buffer);
// Returns: { format: 'SAFETENSORS', headerSize: 12480, metadataKeys: [...], status: 'VALID' }
```

---

## 4. Security & Defensive Invariants
- **Zero External Dependencies:** Built 100% on native Node.js core libraries (`fs`, `path`, `crypto`, `buffer`). Zero supply-chain attack vectors.
- **Memory Overflow Defense:** Restricts untrusted Safetensors header parsing to configurable limits (default 25 MB). Blocks memory exhaustion attacks before allocation.
- **Brace Slicing Invariance:** Tracks string literal boundaries and escape slashes to prevent internal `{` or `}` inside text fields from prematurely closing the JSON slice.

---

## 5. Verification & Testing
Run the complete unit, adversarial, and CLI integration suite:
```bash
node tests/test-runner.mjs
```
33 / 33 test checks passing (100.0%).

