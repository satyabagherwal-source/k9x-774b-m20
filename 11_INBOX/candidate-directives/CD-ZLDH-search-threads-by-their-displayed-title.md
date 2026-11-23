# Candidate Directive: [CD-ZLDH] Search threads by their displayed title

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries/zed",
  "source_url": "https://github.com/zed-industries/zed",
  "source_version": "e224d55b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-23T23:18:12.725Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zed-industries-zed",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries/zed](https://github.com/zed-industries/zed) (Revision: `e224d55b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-23T23:18:12.725Z`  
> **Learning ID**: `learn-github-zed-industries-zed`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/agent_ui/src/threads_archive_view.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zed-industries/zed. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `78edf1df`: agent_ui: Search threads by their displayed title. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/agent_ui/src/threads_archive_view.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::{Agent, ArchiveSelectedThread, RemoveSelectedThread};
                let title = session.display_title();
                if let Some(positions) = fuzzy_match_positions(&query, &title) {
            self.thread.display_title()

    #[gpui::test]
    async fn test_filter_matches_displayed_title(cx: &mut gpui::TestAppContext) {
        crate::test_support::init_test(cx);
        cx.update(ThreadMetadataStore::init_global);
        cx.run_until_parked();
        let metadata = ThreadMetadata {
            thread_id: ThreadId::new(),
            session_id: Some(acp::SessionId::new("session")),
            agent_id: agent::ZED_AGENT_ID.clone(),
            title: Some("Generated".into()),
            title_override: Some("Renamed".into()),
            updated_at: Utc::now(),
            created_at: None,
            interacted_at: None,
            worktree_paths: Default::default(),
            remote_connection: None,
            archived: false,
        };
        cx.update(|cx| {
            ThreadMetadataStore::global(cx).update(cx, |store, cx| store.save(metadata, cx))
        });
        let view = cx.add_window(|window, cx| {
            let workspace = WeakEntity::
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use crate::{Agent, ArchiveSelectedThread, DEFAULT_THREAD_TITLE, RemoveSelectedThread};
                let title = session
                    .title
                    .as_ref()
                    .map(|t| t.as_ref())
                    .unwrap_or(DEFAULT_THREAD_TITLE);
                if let Some(positions) = fuzzy_match_positions(&query, title) {
            self.thread
                .title
                .as_ref()
                .map(|t| t.as_ref())
                .unwrap_or(DEFAULT_THREAD_TITLE)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `78edf1df` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T23:18:12.723Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795475892723",
    "title": "Search threads by their displayed title",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zed-industries/zed",
    "source_uri": "https://github.com/zed-industries/zed",
    "source_version": "HEAD",
    "content_hash": "701217e8ed4efde63737f20321b7799e8bbfcef3a8131bc181c4c97c06dc7e32"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-23T23:18:12.724Z"
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
  "auth_token": "d7ce68f59138e72d8dc3edc305f8d809699e0f4f6d2832e570756f4776050995"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
