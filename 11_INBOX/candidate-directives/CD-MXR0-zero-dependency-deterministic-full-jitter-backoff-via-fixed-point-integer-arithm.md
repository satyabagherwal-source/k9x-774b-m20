# Candidate Directive: [CD-MXR0] Zero-Dependency Deterministic Full-Jitter Backoff via Fixed-Point Integer Arithmetic

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983-netwatch-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:06:56.870Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-matthart1983-netwatch-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983-netwatch-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:06:56.870Z`  
> **Learning ID**: `LEARN-EVO-matthart1983-netwatch-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Network backoff algorithms MUST compute exponential delay ceilings with arithmetic saturation and MUST scale entropy across the ceiling using fixed-point integer multiplication and bit shifts (`(entropy * (ceiling + 1)) >> 64`). Systems MUST NOT utilize floating-point arithmetic or modulo operations (`entropy % ceiling`) to derive jitter.

**WHY**:
1. **Modulo Bias & Range Clamping**: `entropy % ceiling` produces severe non-uniform distribution unless `ceiling` is a power of two. Worse, if entropy is supplied from monotonic clock sub-fractions (e.g., nanosecond registers) whose scale is narrower than the ceiling, modulo reduction pins retries into degenerate repeating sub-windows.
2. **Deterministic Reproducibility & Portability**: Eliminating floating-point instructions ensures identical cross-platform backoff sequences across bare-metal kernels, embedded microcontrollers (such as `armv5te`), and deterministic replay engines.
3. **Thundering Herd Shield**: Truncation or math overflows in backoff logic routinely cause delays to collapse to zero, causing fleet-wide concurrent retry stampedes against recovering backends.

**WHEN TO APPLY**:
- Telemetry forwarders, distributed RPC clients, background sync agents, autonomous reconnection loops, and rate-limited ingestion pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern derived from src/remote/queue.rs (Backoff)
use std::time::Duration;

pub struct Backoff {
    base: Duration,
    max: Duration,
    attempt: u32,
}

impl Backoff {
    pub const fn new(base: Duration, max: Duration) -> Self {
        Self { base, max, attempt: 0 }
    }

    pub fn reset(&mut self) {
        self.attempt = 0;
    }

    /// Computes full jitter in range [0, capped_ceiling] deterministically.
    /// `entropy` must be a uniform u64 (from CSPRNG, PRNG, or clock folding).
    pub fn fail(&mut self, entropy: u64) -> Duration {
        let capped = self.capped_ceiling();
        self.attempt = self.attempt.saturating_add(1);

        // Compute delay via 128-bit scaling without floats or modulo
        let ceil_nanos = capped.as_nanos().min(u64::MAX as u128);
        let jittered_nanos = ((entropy as u128).saturating_mul(ceil_nanos + 1)) >> 64;
        
        Duration::from_nanos(jittered_nanos as u64)
    }

    pub fn capped_ceiling(&self) -> Duration {
        // Safe left shift with ceiling saturation at 2^32
        let factor = 1u64.checked_shl(self.attempt.min(32)).unwrap_or(u64::MAX);
        let scaled = self.base.saturating_mul(factor.min(u32::MAX as u64) as u32);
        scaled.min(self.max)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:06:56.988Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794798416988",
    "title": "Zero-Dependency Deterministic Full-Jitter Backoff via Fixed-Point Integer Arithmetic",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matthart1983-netwatch-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "eac3ce27372bf066aace87cb421b251a5e1a360be6d7fa3065bf8d03886d4b8b"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:06:56.988Z"
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
  "auth_token": "aa22f92fb6449048cf32a2c3c9bc1a51477285d1a085031f666ee1c09735c7a9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
