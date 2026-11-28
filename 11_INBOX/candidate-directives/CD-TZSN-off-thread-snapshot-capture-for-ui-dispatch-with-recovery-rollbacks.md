# Candidate Directive: [CD-TZSN] Off-Thread Snapshot Capture for UI Dispatch with Recovery Rollbacks

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:08:24.181Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:08:24.181Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
A Terminal User Interface (TUI) or graphical event loop MUST NOT perform synchronous filesystem scans, git repository interrogations, or metadata stabilization on the main rendering/input thread. The UI thread MUST immediately capture an immutable snapshot of lightweight context pointers (`MentionContext`), perform an optimistic UI state transition (e.g., clearing input buffer, displaying draft), and offload resolution to a dedicated blocking/async worker pool. If the background resolution or downstream pipeline fails or cancels, the system MUST execute a pre-registered compensating rollback to restore the uncommitted user input.

**WHY**:
Evaluating mention tags (e.g., `@src/lib.rs`, `@git`, `@diff`) requires blocking directory scans, resolving symbolic links, and spawning external sub-processes (e.g., `git diff-index`). Executing this on the event loop starves terminal redrawing, drops keystrokes, breaks frame timing, and freezes the terminal. Furthermore, if background resolution aborts, the user's drafted prompt is permanently destroyed unless a formal recovery callback restores it.

**WHEN TO APPLY**:
Any interactive client application (terminal, desktop, or web) that accepts enriched tokens, attachments, or file paths within a prompt editor before network transmission.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;

#[derive(Clone, Debug)]
pub struct MentionContext {
    pub workspace: PathBuf,
    pub cwd: Option<PathBuf>,
    pub completion_index: Option<Arc<[String]>>,
}

pub struct UserDispatchPrepare {
    pub content: String,
    pub mention_context: Option<MentionContext>,
    pub rollback_draft: String,
}

impl UserDispatchPrepare {
    pub async fn resolve_mentions_off_thread(mut self) -> Result<String, (anyhow::Error, String)> {
        let Some(ctx) = self.mention_context.take() else {
            return Ok(self.content);
        };
        
        let raw_prompt = self.content.clone();
        let rollback = self.rollback_draft.clone();

        // Spawn to blocking thread pool; do not starve runtime event loop
        tokio::task::spawn_blocking(move || {
            let resolved = ctx.resolve_file_references(&raw_prompt)?;
            Ok(resolved)
        })
        .await
        .map_err(|join_err| (anyhow::anyhow!(join_err), rollback.clone()))?
        .map_err(|resolve_err| (resolve_err, rollback))
    }
}
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:08:24.311Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795856904311",
    "title": "Off-Thread Snapshot Capture for UI Dispatch with Recovery Rollbacks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq-codewhale-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3e3ae75ed384151070c5d224c6454875ab356fe3edf8a1880a11b20f0b5a1ad8"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-28T09:08:24.311Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "5c419cd377e8851a226ad40e8b7da4a1ec8a6e6ec5a6a6e0930f3e4ce1b063dc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
