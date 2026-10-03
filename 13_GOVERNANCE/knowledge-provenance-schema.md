# Knowledge Provenance Specification & Schema

> **Canonical Location**: `13_GOVERNANCE/knowledge-provenance-schema.md`  
> **Status**: MANDATORY & ACTIVELY ENFORCED  
> **Purpose**: Establishes the authoritative standard for recording origin, lineage, verification evidence, and AI provider attribution for all knowledge stored inside AI-Builder-Brain.

---

## 1. Provenance Invariant

Every promoted knowledge item in `05_KNOWLEDGE/engineering-patterns.md`, every dossier in `07_PROJECT_LEARNING/`, and every skill in `03_SKILLS/` must maintain unbroken provenance.

The Brain rejects unverified synthetic claims. Every engineering pattern must answer:
1. *Where did this knowledge come from?* (Source repository, documentation portal, or production incident).
2. *What is the exact version or commit SHA?* (Reproducible state).
3. *What concrete evidence proves it?* (Commit diff, test suite, closed bug autopsy).
4. *What AI provider assisted in synthesis, if any?* (Attribution).
5. *Is it source-derived or AI-inferred?* (Epistemic status).
6. *Who or what verified it?* (Human reviewer or automated verification gate).

---

## 2. Canonical JSON Provenance Schema

When serialized in metadata registries or embedded in dossiers, the provenance object conforms to this structure:

```json
{
  "$schema": "https://ai-builder-brain.local/schemas/provenance-v1.json",
  "knowledge_type": "engineering_pattern",
  "topic": "Subprocess Lifecycles & Termination Barriers",
  "source": "ollama/ollama",
  "source_url": "https://github.com/ollama/ollama",
  "source_type": "github_repository",
  "source_version": "commit-e49f8b2d",
  "license": "MIT",
  "extracted_at": "2026-10-04T01:00:00.000Z",
  "ai_provider": "google-gemini-2.0-flash",
  "generation_mode": "source_derived_ai_synthesized",
  "evidence": [
    {
      "type": "commit_diff",
      "reference": "e49f8b2d",
      "file": "server/lifecycle.go",
      "summary": "Added SIGKILL fallback after 5s SIGTERM grace period to prevent zombie runner processes"
    },
    {
      "type": "issue_autopsy",
      "reference": "ISSUE-1482",
      "summary": "Runner deadlock on model unload under high concurrency"
    }
  ],
  "verified": true,
  "confidence": "high",
  "reviewer": "Automated_Evidence_Gate_v2",
  "promotion_status": "approved",
  "distillation_prohibited": true
}
```

---

## 3. Human-Readable Markdown Provenance Format

For rules appended to [`05_KNOWLEDGE/engineering-patterns.md`](file:///c:/AI-Builder-Brain/05_KNOWLEDGE/engineering-patterns.md), the provenance block is formatted directly above the rule body:

```markdown
<!-- PROVENANCE_START
{
  "knowledge_type": "engineering_pattern",
  "topic": "[Rule Title]",
  "source": "[Repo/Doc Name]",
  "source_url": "[URL]",
  "source_version": "[Commit/Version]",
  "extracted_at": "[ISO-8601]",
  "ai_provider": "[Provider or None]",
  "generation_mode": "source_derived_ai_synthesized | human_curated",
  "verified": true,
  "confidence": "high | medium",
  "promotion_status": "approved"
}
PROVENANCE_END -->

> **Provenance**: Harvested from [`[Source Name]`]([Source URL]) (`[Version]`) on `[Date]`.  
> **Evidence**: Verified against commit diffs and test suites.  
> **Provider**: `[AI Provider]` (Synthesized for engineering pattern retrieval; non-distillation invariant enforced).
```

---

## 4. Verification & Audit Invariants

1. **Rejection of Unreferenced Synthetics**:
   If an AI-generated candidate rule fails to cite at least one verified file path, commit SHA, or official documentation URL, it is rejected by `validateRuleCandidate()` and **cannot be promoted**.
2. **Anti-Distillation Header**:
   Every provenance record contains `"distillation_prohibited": true`.
