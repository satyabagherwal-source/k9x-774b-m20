# Candidate Directive: [CD-TWN2] Off-Thread Snapshot Capture for UI Dispatch with Recovery Rollbacks

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/codewhale-hq/Codewhale",
  "source_version": "98e055e6",
  "license": "MIT",
  "timestamp": "2026-11-28T09:08:20.222Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale) (Revision: `98e055e6`).  
> **License**: MIT | **Timestamp**: `2026-11-28T09:08:20.222Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Resolving git and disk mentions inside synchronous key-press handler
fn on_enter_pressed(app: &mut App) {
    let text = app.input_box.drain();
    // BLOCKS EVENT LOOP: If git status takes 4 seconds on a 200k file repo, UI freezes!
    let expanded = app.resolve_git_mentions_blocking(&text); 
    app.send_to_engine(expanded);
}
```

**VERIFICATION METHOD**:
Integration test asserting that input fields preserve state across aborted resolution pipelines:
```rust
#[tokio::test]
async fn test_aborted_dispatch_preserves_input_draft() {
    let mut app = create_mock_tui_app();
    app.input = "Explain @unreadable_pipe".to_string();
    let prepare = app.prepare_dispatch();
    app.input.clear();
    
    // Simulate resolution failure
    let result = prepare.resolve_mentions_off_thread().await;
    assert!(result.is_err());
    let (_, rollback) = result.unwrap_err();
    app.input = rollback;
    
    assert_eq!(app.input, "Explain @unreadable_pipe");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:08:20.221Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795856900221",
    "title": "Off-Thread Snapshot Capture for UI Dispatch with Recovery Rollbacks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq/Codewhale",
    "source_uri": "https://github.com/codewhale-hq/Codewhale",
    "source_version": "HEAD",
    "content_hash": "0f9e9b5a1fca5c8df35f501bcf44097a4e0ddd15cca27a2bd4b0cb62e77be6da"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
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
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-28T09:08:20.221Z"
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
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "4102bd965c222bd849bd55b15b7d070c7669aa6153607719aed63bab5b4dd8ca"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
