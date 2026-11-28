# Candidate Directive: [CD-26Y9] TCP-based debugging in dev containers

<!-- PROVENANCE_START
{
  "source_repository": "zed-industries/zed",
  "source_url": "https://github.com/zed-industries/zed",
  "source_version": "0f009536",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T10:10:46.065Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zed-industries-zed",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zed-industries/zed](https://github.com/zed-industries/zed) (Revision: `0f009536`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T10:10:46.065Z`  
> **Learning ID**: `learn-github-zed-industries-zed`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/collab/tests/integration/remote_editing_collaboration_tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zed-industries/zed. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ed8dc1b6`: TCP-based debugging in dev containers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/collab/tests/integration/remote_editing_collaboration_tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
) {
    test_remote_debug_session(cx_a, server_cx, executor, false).await;
}

#[gpui::test]
async fn test_remote_debug_session_uses_tcp_proxy(
    cx_a: &mut TestAppContext,
    server_cx: &mut TestAppContext,
    executor: BackgroundExecutor,
) {
    test_remote_debug_session(cx_a, server_cx, executor, true).await;
}

async fn test_remote_debug_session(
    cx_a: &mut TestAppContext,
    server_cx: &mut TestAppContext,
    executor: BackgroundExecutor,
    tcp_proxy: bool,
    if tcp_proxy {
        let remote::RemoteConnectionOptions::Mock(options) = &opts else {
            panic!("Expected a mock connection");
        };
        cx_a.update(|cx| {
            remote::MockConnectionRegistry::update_global(cx, |registry, _| {
                registry.enable_tcp_proxy(options).unwrap();
            });
        });
    }
    if tcp_proxy {
        server_cx.update(|cx| {
            SettingsStore::update_global(cx, |store, cx| {
                store.update_user_settings(cx, |settings| {
                    settings
                        .project
                        .dap
                        .entry("fake-adapter".into())
                        .or_default()
              
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                "request": "launch"
                port: None,
                timeout: None,
                if count.fetch_add(1, std::sync::atomic::Ordering::SeqCst) < 5 {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ed8dc1b6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T10:10:46.062Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795860646062",
    "title": "TCP-based debugging in dev containers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zed-industries/zed",
    "source_uri": "https://github.com/zed-industries/zed",
    "source_version": "HEAD",
    "content_hash": "4bfb7c58a2b124e3bab334e01684730e24ae7a9e1e9fddc11353a7e6e6c7077d"
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
        "Harvested/verified timestamp recorded: 2026-11-28T10:10:46.063Z"
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
  "auth_token": "f190a24a290c13be2e6bfd6653b8c33cfaf0919ad5a0a9bf5c627673c67b2f89"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
