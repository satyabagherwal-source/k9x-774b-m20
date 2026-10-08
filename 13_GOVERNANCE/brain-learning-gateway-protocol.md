# Brain Learning Gateway Protocol & Read-Back Verification Architecture

> **Canonical Document**: `13_GOVERNANCE/brain-learning-gateway-protocol.md`  
> **Status**: ACTIVE & STRICTLY ENFORCED  
> **Authority**: Tier-1 Human Directive & Master Brain Integrity Guard  
> **Governing Module**: [`04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs)  

---

## 1. Problem Statement & Core Architectural Rationale

In autonomous cloud harvesting, the primary failure mode is **premature completion signaling** where an agent or cloud worker extracts intelligence, runs AI analysis, outputs `"Learning Complete"` in terminal logs or UI, but **fails to durably persist and verify the knowledge in the Master Brain**.

### The Anti-Pattern (Prohibited by Law)
```text
GitHub Repository
      ↓
Repository Read
      ↓
AI Analysis
      ↓
Learning Generated
      ↓
"Learning Complete" (False Positives)
      ✕ [FAILED: Not durably written or verified in AI-Builder-Brain]
```

### The Canonical Pipeline (Mandatory & Invariant)
```text
GitHub / Hugging Face Source
      ↓
Harvest & Extract
      ↓
Normalize & Source Mapping
      ↓
Validate (Structure & Negative Constraints)
      ↓
Candidate Learning Package (SHA-256 Content Hash)
      ↓
Brain Learning Gateway
      ↓
Durable Dossier Storage (`07_PROJECT_LEARNING/`)
      ↓
READ-BACK VERIFICATION (Dossier Hash Match)
      ↓
Gated Rule Promotion (`05_KNOWLEDGE/engineering-patterns.md`)
      ↓
READ-BACK VERIFICATION (Rule Existence & Numbering)
      ↓
Canonical Knowledge Index Update (`05_KNOWLEDGE/knowledge-index.json`)
      ↓
READ-BACK VERIFICATION (Index Hash Match)
      ↓
Checkpoint Update (`.project-brain/harvest-checkpoints.json`)
      ↓
Status: "VERIFIED"
```

---

## 2. The Hard Invariant

The AI agent and cloud workers are **strictly prohibited from declaring learning success** until every stage is confirmed via disk read-back.

```text
LEARNING_SUCCESS =
  extraction_success
  AND validation_success
  AND brain_write_success
  AND brain_readback_success
  AND index_update_success
```

If **any single stage** fails:

```text
LEARNING_STATUS = FAILED_PERSISTENCE (or FAILED_READBACK / FAILED_VALIDATION)
```

The system **MUST NEVER** emit `COMPLETED` or `SUCCESS` when persistence is partial or unverified.

---

## 3. The 5 Discrete Lifecycle States

Every learning target progresses through five explicit, non-overlapping lifecycle states:

| State | Definition | Gate Condition |
| :--- | :--- | :--- |
| **`DISCOVERED`** | Source repository URL identified in queue (`repos.txt`) or via Scout. | Target parsed and added to queue. |
| **`EXTRACTED`** | Raw diffs, issues, ASTs, and AI analysis extracted from source. | Learning package created; status is `EXTRACTED_ONLY — NOT STORED IN AI-BUILDER-BRAIN`. |
| **`VALIDATED`** | Content substance checked ($\ge 100$ chars body), evidence verified, rule syntax validated. | Structure conforms to Brain schema. |
| **`PROMOTED`** | Written to `07_PROJECT_LEARNING/` and universal rules appended to `05_KNOWLEDGE/engineering-patterns.md`. | Physical files mutated. |
| **`VERIFIED`** | All written files read back from disk, SHA-256 hashes verified, canonical index updated, and read-back confirmed. | **Hard Invariant fully satisfied.** |

If a target has `extracted = true` but `promoted_to_brain = false` or `brain_readback = false`, the system states:
> `EXTRACTED_ONLY — NOT STORED IN AI-BUILDER-BRAIN`

---

## 4. Architectural Separation: Cloud Worker vs. Brain Learning Gateway

Cloud harvesters and remote workers **must never write haphazardly to random brain files**.

The **Brain Learning Gateway** acts as an immutable transactional gatekeeper:

```text
Cloud Harvester / Local Agent
              ↓
  Immutable Learning Package
  (SHA-256 Content Hash, Unique ID)
              ↓
    Brain Learning Gateway
              ↓
  ┌───────────────────────────┐
  │ 1. Schema Validation      │
  │ 2. Deduplication Check    │
  │ 3. Storage Write          │
  │ 4. Read-Back Verification │
  │ 5. Rule Promotion         │
  │ 6. Rule Read-Back         │
  │ 7. Knowledge Index Update │
  │ 8. Index Read-Back        │
  │ 9. Checkpoint Save        │
  └───────────────────────────┘
              ↓
   status: "VERIFIED"
```

This guarantees that even if a worker crashes mid-execution, an API times out, or an AI model is swapped, **the Brain's structural integrity remains unbroken**.

---

## 5. Cryptographic Verification & Read-Back Protocol

### A. Learning Package Envelope
Every package is assigned a deterministic identifier and a cryptographic SHA-256 checksum:
```json
{
  "learning_id": "learn-github-owner-repo-mup0xyz",
  "repository": "owner/repo",
  "platform": "github",
  "source_version": "commit-e49f8b2d",
  "content_hash": "a1b2c3d4...",
  "stage": "VERIFIED",
  "status": "VERIFIED",
  "extracted": true,
  "validated": true,
  "promoted_to_brain": true,
  "brain_write": true,
  "brain_readback": true,
  "knowledge_index_updated": true
}
```

### B. Three-Tier Read-Back Verification
1. **Tier 1 (Dossier Read-Back)**:
   Immediately after writing `07_PROJECT_LEARNING/[slug]-learnings.md`, the file is read back from disk using `fs.readFileSync`. The SHA-256 hash of the read bytes is computed and compared against `content_hash`. Any mismatch trips `FAILED_READBACK`.
2. **Tier 2 (Rule Read-Back)**:
   After appending a universal pattern to `05_KNOWLEDGE/engineering-patterns.md`, the patterns file is read back from disk to verify that `## <number>. <title>` exists and is retrievable.
3. **Tier 3 (Index Read-Back)**:
   After saving `05_KNOWLEDGE/knowledge-index.json`, the index is re-read and parsed to assert that `items[learning_id]` exists and holds the identical `content_hash`.

---

## 6. Transactional State & Checkpoint Recovery

Job states are persisted in `.project-brain/harvest-checkpoints.json`:
```json
{
  "checkpoints": {
    "owner/repo": {
      "repository": "owner/repo",
      "learning_id": "learn-github-owner-repo-mup0xyz",
      "stage": "VERIFIED",
      "status": "VERIFIED",
      "last_updated": "2026-10-08T..."
    }
  }
}
```

If a job terminates unexpectedly:
1. `checkpoint = last_verified_stage` is preserved.
2. Upon restart, the harvester inspects the checkpoint:
   - If `stage === 'VERIFIED'`, the repo is recognized as learned and skipped (0 tokens/bytes burned).
   - If `stage === 'EXTRACTED'` or `stage === 'VALIDATED'`, the gateway resumes precisely from the unverified persistence stage without re-fetching remote APIs.
