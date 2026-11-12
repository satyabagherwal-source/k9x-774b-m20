/**
 * build-fixtures.mjs
 * 
 * Generates all Stage C test fixtures in fixtures/
 * Labels synthetic fixtures explicitly to preserve real-world boundary truth.
 */

import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = '.project-brain/simulation-sandbox/stage-c-persistence-retrieval/fixtures';

const fixtures = {
  // 1. Evidence-Backed Champions (Stage B.3 Proven)
  'candidate-cmtp-approved.json': {
    fixture_type: "STAGE_B3_EVIDENCE_FIXTURE",
    candidate_id: "CD-ZNND-CMTP",
    title: "Clamped Masked Temporal Pooling (CMTP)",
    content: "When pooling transformer token embeddings across sequence length, multiply token representations by the float attention mask, sum along dimension 1, clamp the divisor sum to min 1e-9, and divide. Divisor clamping strictly eliminates division-by-zero NaN vectors on empty or fully padded sequences.",
    summary: "Transformer sequence pooling with attention mask sum clamped to epsilon (1e-9) to guarantee finite zero vectors without NaN propagation.",
    actionable_instruction: "In PyTorch/ONNX pooling functions, calculate sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9) before tensor division. Never divide by unclamped mask sum.",
    tags: ["transformer", "pooling", "attention-mask", "clamp", "nan-prevention", "pytorch", "sentence-transformers"],
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://github.com/UKPLab/sentence-transformers",
      target_source_file: "sentence_transformers/models/Pooling.py",
      upstream_class: "Pooling",
      source_revision: "v2.2.2 / main",
      license: "Apache-2.0"
    },
    evidence: {
      evidence_type: "EMPIRICAL_PYTORCH_TENSOR_EXECUTION",
      verification_status: "DIRECTLY_VERIFIED",
      test_log: ".project-brain/simulation-sandbox/stage-b3-harness/actual-execution-logs/cmtp-mhup-pytorch-execution.log",
      empirical_proof: "Anti-pattern without clamp produced tensor([[nan, nan]]) while clamped implementation returned tensor([[0., 0.]])."
    }
  },

  'candidate-mhup-approved.json': {
    fixture_type: "STAGE_B3_EVIDENCE_FIXTURE",
    candidate_id: "CD-ZNND-MHUP",
    title: "Metric Hypersphere Unit Projection (MHUP)",
    content: "After temporal sequence pooling, embedding vectors must be projected onto a unit Euclidean hypersphere using L2 normalization (F.normalize(p=2, dim=1)). Unit hypersphere projection strictly enforces ||v||_2 = 1.0, making cosine similarity identical to inner dot product and removing sentence length magnitude bias.",
    summary: "Euclidean L2 unit projection normalizing embeddings to unit hypersphere so dot product equals cosine distance.",
    actionable_instruction: "Always normalize pooled embeddings with F.normalize(p=2, dim=1) prior to vector store insertion. Never index unnormalized embeddings in inner product vector databases.",
    tags: ["embeddings", "l2-normalization", "hypersphere", "cosine-distance", "dot-product", "vector-search", "similarity"],
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://github.com/UKPLab/sentence-transformers",
      target_source_file: "sentence_transformers/models/Normalize.py",
      upstream_class: "Normalize",
      source_revision: "v2.2.2 / main",
      license: "Apache-2.0"
    },
    evidence: {
      evidence_type: "EMPIRICAL_PYTORCH_TENSOR_EXECUTION",
      verification_status: "DIRECTLY_VERIFIED",
      test_log: ".project-brain/simulation-sandbox/stage-b3-harness/actual-execution-logs/cmtp-mhup-pytorch-execution.log",
      empirical_proof: "Normalized embeddings strictly satisfied ||v||_2 = 1.000000 and dot product equaled cosine distance (0.808290 == 0.808290)."
    }
  },

  'candidate-tokenizer-approved.json': {
    fixture_type: "STAGE_B3_EVIDENCE_FIXTURE",
    candidate_id: "CD-HE9Q-TOKENIZER",
    title: "Tokenizer Special Token Normalization Boundary",
    content: "In Hugging Face fast tokenizers, control tokens in added_tokens_decoder (such as <s>, </s>, <pad>) must specify special: true and normalized: false. Setting normalized: true causes token normalization to strip preceding whitespace, breaking sequence boundaries.",
    summary: "Fast tokenizer control tokens require normalized: false in added_tokens_decoder to avoid stripping adjacent whitespace.",
    actionable_instruction: "When writing tokenizer_config.json, verify that control tokens have special: true and normalized: false. Only structural tokens that participate in text normalization may have normalized: true.",
    tags: ["tokenizer", "huggingface", "special-tokens", "normalization-boundary", "added-tokens-decoder", "whitespace"],
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
    knowledge_transferability_status: "TRANSFERABLE_PRINCIPLE_CANDIDATE",
    provenance: {
      upstream_repository: "https://github.com/Nanbeige/Nanbeige",
      target_source_file: "tokenizer_config.json",
      license: "Apache-2.0"
    },
    evidence: {
      evidence_type: "CONFIGURATION_SCHEMA_CONTRACT_AUDIT",
      verification_status: "CONTRACT_VERIFIED",
      test_log: ".project-brain/simulation-sandbox/stage-b3-harness/actual-execution-logs/tokenizer-config-execution.log",
      empirical_proof: "Schema validation verified special: true, normalized: false contract."
    }
  },

  'candidate-gguf-pending.json': {
    fixture_type: "STAGE_B3_EVIDENCE_FIXTURE",
    candidate_id: "CD-8KGR-GGUF",
    title: "Binary Artifact Header and Version Compatibility",
    content: "Binary weight loaders must inspect the first 8 bytes of model files before memory mapping. The first 4 bytes must match magic bytes b'GGUF' and the next 4 bytes must indicate version >= 3. Held pending admission review due to absence of native C compiler.",
    summary: "GGUF binary format magic bytes and version contract validation before memory mapping.",
    actionable_instruction: "Assert header[:4] == b'GGUF' and header[4:8] >= 3 before mmap allocation.",
    tags: ["gguf", "binary-format", "header-validation", "llama-cpp", "deserialization"],
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "PENDING_APPROVAL",
    implementation_evidence_status: "STATIC_EVIDENCE_ONLY",
    knowledge_transferability_status: "TRANSFERABLE_PRINCIPLE_CANDIDATE",
    provenance: {
      upstream_repository: "https://github.com/ggerganov/llama.cpp",
      target_source_file: "ggml/src/ggml.c",
      license: "MIT"
    },
    evidence: {
      evidence_type: "BINARY_FORMAT_CONTRACT_CHECK",
      verification_status: "STATIC_ANALYSIS_ONLY",
      test_log: ".project-brain/simulation-sandbox/stage-b3-harness/actual-execution-logs/binary-gguf-header-execution.log"
    }
  },

  'candidate-ternary-pending.json': {
    fixture_type: "STAGE_B3_EVIDENCE_FIXTURE",
    candidate_id: "CD-UV2I-TERNARY",
    title: "Zero-Copy Low-Bit Computation (LUT Trit Unpacking)",
    content: "Dequantization of sub-4bit ternary weights uses constant lookup tables indexed by bitfield shifts to avoid GPU branch divergence. Held pending admission review due to absence of NVIDIA GPU/nvcc toolchain.",
    summary: "Constant-time LUT dequantization avoids GPU warp divergence during ternary matrix operations.",
    actionable_instruction: "Use constant-memory LUTs for sub-4bit unpacking; avoid conditional branches in inner loops.",
    tags: ["ternary", "lut", "dequantization", "cuda", "branch-divergence", "low-bit"],
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "PENDING_APPROVAL",
    implementation_evidence_status: "BLOCKED_BY_DEPENDENCY",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://github.com/prism-ml/Ternary-Bonsai",
      target_source_file: "kernels/ternary_gemm.cu",
      license: "Apache-2.0"
    },
    evidence: {
      evidence_type: "CUDA_KERNEL_STATIC_AUDIT",
      verification_status: "DEPENDENCY_BLOCKED",
      test_log: ".project-brain/simulation-sandbox/stage-b3-harness/actual-execution-logs/ternary-lut-execution.log"
    }
  },

  // 2. Synthetic Negative Test Fixtures (Strictly labeled SYNTHETIC_TEST_FIXTURE)
  'synthetic-unapproved.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    candidate_id: "FIXTURE-SYNTHETIC-UNAPPROVED",
    title: "Synthetic Unapproved Pattern Draft",
    content: "This is a synthetic draft candidate record that has not received human approval.",
    summary: "Synthetic unapproved candidate to test admission gate rejection.",
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "PENDING_APPROVAL",
    implementation_evidence_status: "STATIC_EVIDENCE_ONLY",
    knowledge_transferability_status: "INSUFFICIENT_EVIDENCE",
    provenance: {
      upstream_repository: "https://example.com/synthetic/repo",
      target_source_file: "src/synthetic.js"
    },
    evidence: {
      evidence_type: "SYNTHETIC_TEST",
      verification_status: "UNVERIFIED"
    }
  },

  'synthetic-missing-evidence.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    candidate_id: "FIXTURE-SYNTHETIC-NO-EVIDENCE",
    title: "Synthetic Pattern Lacking Evidence Block",
    content: "This synthetic record has no evidence block to verify validation rejection.",
    summary: "Synthetic record lacking evidence block.",
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "UNVERIFIED",
    knowledge_transferability_status: "INSUFFICIENT_EVIDENCE",
    provenance: {
      upstream_repository: "https://example.com/synthetic/repo",
      target_source_file: "src/synthetic.js"
    }
    // evidence block omitted intentionally
  },

  'synthetic-duplicate-reference.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    candidate_id: "FIXTURE-SYNTHETIC-DUPE-REF",
    title: "Synthetic Duplicate Reference Collision",
    content: "This synthetic record references CD-ZNND-CMTP as a duplicate reference to verify duplicate collision detection.",
    summary: "Synthetic record with duplicate reference collision.",
    domain_classification: "H",
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: ["CD-ZNND-CMTP"],
    approval_status: "APPROVED",
    implementation_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://example.com/synthetic/repo",
      target_source_file: "src/synthetic.js"
    },
    evidence: {
      evidence_type: "SYNTHETIC_TEST",
      verification_status: "CONTRACT_VERIFIED"
    }
  },

  'synthetic-invalid-domain.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    candidate_id: "FIXTURE-SYNTHETIC-BAD-DOMAIN",
    title: "Synthetic Record with Invalid Domain Z",
    content: "This synthetic record specifies domain Z to verify 13-domain taxonomy enforcement.",
    summary: "Synthetic record with invalid domain.",
    domain_classification: "Z", // Invalid domain
    proposed_canonical_destination: "05_KNOWLEDGE",
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://example.com/synthetic/repo",
      target_source_file: "src/synthetic.js"
    },
    evidence: {
      evidence_type: "SYNTHETIC_TEST",
      verification_status: "CONTRACT_VERIFIED"
    }
  },

  'synthetic-invalid-destination.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    candidate_id: "FIXTURE-SYNTHETIC-BAD-DEST",
    title: "Synthetic Record with Invalid Destination Folder",
    content: "This synthetic record specifies 99_NONEXISTENT_FOLDER to verify 16-canonical-folder enforcement.",
    summary: "Synthetic record with invalid destination.",
    domain_classification: "H",
    proposed_canonical_destination: "99_NONEXISTENT_FOLDER", // Invalid destination
    duplicate_references: [],
    approval_status: "APPROVED",
    implementation_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
    knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
    provenance: {
      upstream_repository: "https://example.com/synthetic/repo",
      target_source_file: "src/synthetic.js"
    },
    evidence: {
      evidence_type: "SYNTHETIC_TEST",
      verification_status: "CONTRACT_VERIFIED"
    }
  }
};

for (const [filename, content] of Object.entries(fixtures)) {
  const filePath = path.join(FIXTURES_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`Generated fixture: ${filename}`);
}

console.log('All 10 fixtures generated successfully.');

