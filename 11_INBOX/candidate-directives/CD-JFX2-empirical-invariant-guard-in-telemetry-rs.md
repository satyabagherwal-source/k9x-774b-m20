# Candidate Directive: [CD-JFX2] Empirical Invariant Guard in telemetry.rs

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai/rtk",
  "source_url": "https://github.com/rtk-ai/rtk",
  "source_version": "ef0b734b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T07:10:31.766Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rtk-ai-rtk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai/rtk](https://github.com/rtk-ai/rtk) (Revision: `ef0b734b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T07:10:31.766Z`  
> **Learning ID**: `learn-github-rtk-ai-rtk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/core/telemetry.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rtk-ai/rtk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ef0b734b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/core/telemetry.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use std::path::{Path, PathBuf};
    let _ = start_ping_if_due(telemetry_marker_path(), |marker| {
        let _ = send_ping(marker);
    });
}
/// The main-thread half of the ping: checks the marker and hands the work to a
/// thread so the CLI never blocks. It never writes the marker. Process exit
/// kills the thread, often before it connects, and a marker written here would
/// then skip the day's ping without sending it; `run_ping` claims it instead.
fn start_ping_if_due<W>(marker: PathBuf, work: W) -> Option<std::thread::JoinHandle<()>>
where
    W: FnOnce(&Path) + Send + 'static,
{
    if !ping_due(&marker) {
        return None;
    }
    Some(std::thread::spawn(move || work(&marker)))
}
/// The send-thread half: prepares the payload, then claims the marker, then
/// sends. Claiming last means a command that exits during preparation leaves
/// the ping for the next one, and re-checking at the claim means a process
/// that claimed in the meantime wins. Returns whether a request went out.
fn run_ping<P, E>(
    marker: &Path,
    prepare: impl FnOnce() -> P,
    send: impl FnOnce(P) -> Result<(), E>,
) -> Result<bool, E> {
    let payload = prepare();
    if !claim_ping(marke
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use std::path::PathBuf;
    // Check last ping time
    let marker = telemetry_marker_path();
    if let Ok(metadata) = std::fs::metadata(&marker)
        && let Ok(modified) = metadata.modified()
        && let Ok(elapsed) = modified.elapsed()
        && elapsed.as_secs() < PING_INTERVAL_SECS
    {
        return;
    }
    // Touch marker file immediately (before sending) to avoid double-ping
    touch_marker(&marker);
    // Spawn thread so we never block the CLI
    std::thread::spawn(|| {
        let _ = send_ping();
    });
fn send_ping() -> Result<(), Box<dyn std::error::Error>> {
    let payload = serde_json::json!({
    });

    let mut req = ureq::post(url);

    if let Some(token) = TELEMETRY_TOKEN {
        req = req.header("X-RTK-Token", token);
    }

    // 2 second timeout — if server is down, we move on
    http::global_timeout(req, std::time::Duration::from_secs(2)).send_json(&payload)?;

    Ok(())
fn touch_marker(path: &std::path::Path) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ef0b734b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T07:10:31.764Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795245031764",
    "title": "Empirical Invariant Guard in telemetry.rs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai/rtk",
    "source_uri": "https://github.com/rtk-ai/rtk",
    "source_version": "HEAD",
    "content_hash": "9e229baba1bac8c436b4763ce355d97b71e5dad2146efc689373f90e8306de74"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T07:10:31.764Z"
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
  "auth_token": "71f81088b08498e3854d9eb3918e597f4828c86e732d430b08943fd840c575d5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
