# Candidate Directive: [CD-MIG8] Integrate recorder quiet-window guard with explicit retry and stale speech clean

<!-- PROVENANCE_START
{
  "source_repository": "1jehuang-jcode-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T03:13:17.925Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-1jehuang-jcode-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [1jehuang-jcode-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T03:13:17.925Z`  
> **Learning ID**: `LEARN-EVO-1jehuang-jcode-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/jcode-voice/src/continuous.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d0b8d7a8`: Integrate recorder quiet-window guard with explicit retry and stale speech cleanup. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/jcode-voice/src/continuous.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[derive(Default)]
struct QuietWindow {
    since: Option<Instant>,
    last: Option<Instant>,
}
impl QuietWindow {
    fn observe(&mut self, now:Instant, voiced:bool) {
        if voiced || self.last.is_some_and(|last| now.duration_since(last) > Duration::from_millis(200)) {self.since=None;}
        self.last=Some(now);
        if !voiced {self.since.get_or_insert(now);}
    }
    fn ready(&self, now:Instant)->bool {
        self.last.is_some_and(|last|now.duration_since(last)<=Duration::from_millis(200)) && self.since.is_some_and(|at|now.duration_since(at)>=Duration::from_millis(250))
    }
}
    quiet: QuietWindow,
    ) -> Result<Self, VoiceError> {
        Self::start_auto_with_budget(cancel, key, recorder, config, ContinuousBudget::default())
    }

    /// Keep the same ledger when a user explicitly retries a stopped listener.
    pub fn start_auto_with_budget(
        cancel: Arc<AtomicBool>, key: &str, recorder: &str, config: ContinuousConfig,
        budget: ContinuousBudget,
            quiet: QuietWindow::default(),
                            budget,
        output.quiet = QuietWindow::default();
        let mut output = self.events.lock().unwrap_or_else(|e| e.into_inn
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    quiet_since: Option<Instant>,
    ) -> Result<Self, VoiceError> {
        Self::start_auto_with_budget(cancel, key, recorder, config, ContinuousBudget::default())

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:13:18.050Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795144398050",
    "title": "Integrate recorder quiet-window guard with explicit retry and stale speech clean",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "1jehuang-jcode-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "83413a070d4cdff967bd62bff1e3ba0eab2f74996761593b177121dd80e4b164"
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:13:18.051Z"
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
  "auth_token": "6bfd3562cc2bc5fb524fb4623b2eee21f152b9008f4697c0ca381ee8aceff9c6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
