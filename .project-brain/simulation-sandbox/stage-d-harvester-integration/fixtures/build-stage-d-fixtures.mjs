/**
 * build-stage-d-fixtures.mjs
 * 
 * Generates all Stage D test fixtures in fixtures/
 * Labels synthetic fixtures explicitly to preserve real-world boundary truth.
 */

import fs from 'fs';
import path from 'path';

const FIXTURES_DIR = '.project-brain/simulation-sandbox/stage-d-harvester-integration/fixtures';

const fixtures = {
  // 1. Cloud Harvester Realistic Payload (Zero-Clone format)
  'cloud-harvest-input.json': {
    fixture_type: "STAGE_D_CLOUD_HARVEST_FIXTURE",
    repository: "UKPLab/sentence-transformers",
    platform: "github",
    slug: "ukplab-sentence-transformers",
    sourceUrl: "https://github.com/UKPLab/sentence-transformers",
    sourceVersion: "v2.2.2-commit-7248ef",
    license: "Apache-2.0",
    aiProvider: "google-gemini-cloud-agent",
    dossierText: "# Intelligence Dossier: sentence-transformers\n\nIdentified mean pooling temporal invariant with attention mask clamp.",
    candidateRules: [
      {
        candidate_id: "CD-D-CLOUD-CMTP",
        title: "Clamped Masked Temporal Pooling (CMTP)",
        content: "When pooling transformer token representations, clamp attention mask sum divisor to min 1e-9 to prevent NaN division.",
        summary: "Transformer pooling with epsilon divisor clamp preventing division by zero.",
        actionable_instruction: "Calculate sum_mask = torch.clamp(mask.sum(1), min=1e-9) before division.",
        tags: ["transformer", "pooling", "attention-mask", "clamp", "pytorch"],
        implementation_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
        knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
        duplicate_references: [],
        approval_status: "APPROVED",
        target_source_file: "sentence_transformers/models/Pooling.py",
        evidence: {
          evidence_type: "EMPIRICAL_PYTORCH_TENSOR_EXECUTION",
          verification_status: "DIRECTLY_VERIFIED",
          harvest_origin: "CLOUD_HARVESTER"
        }
      }
    ],
    auditEvidence: {
      fixCommitsCount: 14,
      closedIssuesCount: 32,
      commitsSample: ["7248efa Fix division by zero on empty sequences"]
    }
  },

  // 2. Manual Harvester Realistic Payload (Batch git-clone format)
  'manual-harvest-input.json': {
    fixture_type: "STAGE_D_MANUAL_HARVEST_FIXTURE",
    rawUrl: "https://github.com/Nanbeige/Nanbeige",
    owner: "Nanbeige",
    repo: "Nanbeige",
    commitSha: "8a1b2c3d4e5f6789",
    license: "Apache-2.0",
    provider: "local-cli-synthesizer",
    text: "# Manual Forensic Extraction: Nanbeige Tokenizer\n\nControl tokens must maintain special: true and normalized: false.",
    rules: [
      {
        candidate_id: "CD-D-MANUAL-TOKENIZER",
        title: "Tokenizer Special Token Normalization Boundary",
        content: "Control tokens in added_tokens_decoder must specify special: true and normalized: false to avoid stripping preceding whitespace.",
        summary: "Fast tokenizer control tokens require normalized: false to preserve whitespace boundaries.",
        actionable_instruction: "Assert control tokens in added_tokens_decoder have normalized: false.",
        tags: ["tokenizer", "huggingface", "special-tokens", "normalization"],
        implementation_evidence_status: "CONFIGURATION_CONTRACT_TESTED",
        knowledge_transferability_status: "TRANSFERABLE_PRINCIPLE_CANDIDATE",
        duplicate_references: [],
        approval_status: "APPROVED",
        file_path: "tokenizer_config.json",
        evidence: {
          evidence_type: "CONFIGURATION_SCHEMA_CONTRACT_AUDIT",
          verification_status: "CONTRACT_VERIFIED",
          harvest_origin: "MANUAL_HARVESTER"
        }
      }
    ],
    fixCommits: ["Fix whitespace stripping defect on special tokens"],
    closedIssues: ["Issue #44: tokenizer strips space before control token"]
  },

  // 3. Equivalent Pair: Cloud Format Sample
  'equivalent-cloud-sample.json': {
    fixture_type: "STAGE_D_EQUIVALENT_TEST_FIXTURE",
    repository: "UKPLab/sentence-transformers",
    platform: "github",
    slug: "ukplab-sentence-transformers",
    sourceUrl: "https://github.com/UKPLab/sentence-transformers",
    sourceVersion: "v2.2.2",
    license: "Apache-2.0",
    aiProvider: "google-gemini-cloud-agent",
    dossierText: "Euclidean L2 Normalization projects vector embeddings onto unit hypersphere.",
    candidateRules: [
      {
        candidate_id: "CD-D-EQUIV-CLOUD-MHUP",
        title: "Metric Hypersphere Unit Projection (MHUP)",
        content: "Normalize pooled embeddings with F.normalize(p=2, dim=1) to project onto unit hypersphere so dot product equals cosine distance.",
        summary: "Euclidean L2 unit projection normalizing embeddings to unit hypersphere.",
        actionable_instruction: "Apply F.normalize(p=2, dim=1) prior to vector database insertion.",
        tags: ["embeddings", "l2-normalization", "hypersphere", "vector-search"],
        implementation_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
        knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
        duplicate_references: [],
        approval_status: "APPROVED",
        target_source_file: "sentence_transformers/models/Normalize.py",
        evidence: {
          evidence_type: "EMPIRICAL_PYTORCH_TENSOR_EXECUTION",
          verification_status: "DIRECTLY_VERIFIED",
          harvest_origin: "CLOUD_HARVESTER"
        }
      }
    ]
  },

  // 4. Equivalent Pair: Manual Format Sample (Same underlying knowledge invariant)
  'equivalent-manual-sample.json': {
    fixture_type: "STAGE_D_EQUIVALENT_TEST_FIXTURE",
    rawUrl: "https://github.com/UKPLab/sentence-transformers",
    owner: "UKPLab",
    repo: "sentence-transformers",
    commitSha: "v2.2.2",
    license: "Apache-2.0",
    provider: "local-cli-synthesizer",
    text: "Euclidean L2 Normalization projects vector embeddings onto unit hypersphere.",
    rules: [
      {
        candidate_id: "CD-D-EQUIV-MANUAL-MHUP",
        title: "Metric Hypersphere Unit Projection (MHUP)",
        content: "Normalize pooled embeddings with F.normalize(p=2, dim=1) to project onto unit hypersphere so dot product equals cosine distance.",
        summary: "Euclidean L2 unit projection normalizing embeddings to unit hypersphere.",
        actionable_instruction: "Apply F.normalize(p=2, dim=1) prior to vector database insertion.",
        tags: ["embeddings", "l2-normalization", "hypersphere", "vector-search"],
        implementation_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
        knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
        duplicate_references: [],
        approval_status: "APPROVED",
        file_path: "sentence_transformers/models/Normalize.py",
        evidence: {
          evidence_type: "EMPIRICAL_PYTORCH_TENSOR_EXECUTION",
          verification_status: "DIRECTLY_VERIFIED",
          harvest_origin: "MANUAL_HARVESTER"
        }
      }
    ]
  },

  // 5. Unapproved Input (Testing Staging in 11_INBOX)
  'synthetic-unapproved-input.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    repository: "example/unapproved-repo",
    sourceUrl: "https://github.com/example/unapproved-repo",
    sourceVersion: "1.0.0",
    license: "MIT",
    aiProvider: "unapproved-agent",
    dossierText: "Draft patterns that have not yet undergone human review.",
    candidateRules: [
      {
        candidate_id: "CD-D-UNAPPROVED-DRAFT",
        title: "Unapproved Candidate Pattern Draft",
        content: "This pattern has not been approved by a human engineer.",
        summary: "Unapproved pattern draft to test admission gate staging.",
        actionable_instruction: "Hold staged until review.",
        tags: ["draft", "unapproved"],
        implementation_evidence_status: "STATIC_EVIDENCE_ONLY",
        knowledge_transferability_status: "INSUFFICIENT_EVIDENCE",
        duplicate_references: [],
        approval_status: "PENDING_APPROVAL",
        target_source_file: "draft.py",
        evidence: {
          evidence_type: "STATIC_ANALYSIS",
          verification_status: "PENDING_REVIEW"
        }
      }
    ]
  },

  // 6. Duplicate Input (Testing Collision Detection)
  'synthetic-duplicate-input.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    repository: "UKPLab/sentence-transformers",
    sourceUrl: "https://github.com/UKPLab/sentence-transformers",
    sourceVersion: "v2.2.2",
    license: "Apache-2.0",
    aiProvider: "test-duplicate-agent",
    dossierText: "Duplicate attempt to persist CD-D-CLOUD-CMTP.",
    candidateRules: [
      {
        candidate_id: "CD-D-CLOUD-CMTP", // Collision with already persisted candidate!
        title: "Clamped Masked Temporal Pooling (CMTP)",
        content: "Duplicate content attempting to re-persist.",
        summary: "Duplicate candidate.",
        tags: ["duplicate"],
        implementation_evidence_status: "ORIGINAL_SOURCE_EXECUTED",
        knowledge_transferability_status: "TRANSFERABLE_PATTERN_CANDIDATE",
        duplicate_references: [],
        approval_status: "APPROVED"
      }
    ]
  },

  // 7. Malformed Input (Missing repository and source_url)
  'synthetic-malformed-input.json': {
    fixture_type: "SYNTHETIC_TEST_FIXTURE",
    synthetic_label: "DO_NOT_TREAT_AS_REAL_WORLD_KNOWLEDGE",
    // Missing repository and sourceUrl
    sourceVersion: "1.0.0",
    license: "MIT",
    dossierText: "Malformed input lacking identity fields.",
    candidateRules: []
  }
};

for (const [filename, content] of Object.entries(fixtures)) {
  const filePath = path.join(FIXTURES_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`Generated Stage D fixture: ${filename}`);
}

console.log('All 7 Stage D fixtures generated successfully.');

