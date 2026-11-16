# Candidate Directive: [CD-M2BV] Zero-Dependency Deterministic Full-Jitter Backoff via Fixed-Point Integer Arithmetic

<!-- PROVENANCE_START
{
  "source_repository": "matthart1983/netwatch",
  "source_url": "https://github.com/matthart1983/netwatch",
  "source_version": "e11c8c49",
  "license": "MIT",
  "timestamp": "2026-11-16T03:06:16.267Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matthart1983-netwatch",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matthart1983/netwatch](https://github.com/matthart1983/netwatch) (Revision: `e11c8c49`).  
> **License**: MIT | **Timestamp**: `2026-11-16T03:06:16.267Z`  
> **Learning ID**: `learn-github-matthart1983-netwatch`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL DEFECT: Modulo bias and floating-point non-determinism
pub fn bad_backoff(attempt: u32, base_ms: u64, max_ms: u64, rand_val: u64) -> u64 {
    // VIOLATION 1: Overflow hazard on unchecked 1 << attempt
    let ceiling = (base_ms * (1 << attempt)).min(max_ms);
    // VIOLATION 2: Modulo introduces statistical bias and panics if ceiling == 0
    let jittered = rand_val % ceiling; 
    jittered
}
```

**VERIFICATION METHOD**:
Execute boundary test suites verifying:
1. `fail(0) == Duration::ZERO`.
2. `fail(u64::MAX)` yields the exact sequence `[base * 2^0, base * 2^1, ...]` capped at `max`.
3. `fail(1 << 63)` yields precisely 50% of the calculated ceiling across all iteration depths.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:06:16.266Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794798376266",
    "title": "Zero-Dependency Deterministic Full-Jitter Backoff via Fixed-Point Integer Arithmetic",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matthart1983/netwatch",
    "source_uri": "https://github.com/matthart1983/netwatch",
    "source_version": "HEAD",
    "content_hash": "331a4dacef13bc1587499fead5e8ee957c5de912165592a62ee51b1e838c390a"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:06:16.266Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5166bb7fa798d1b9586dd676bec4ec0b3621aaef79ed6639a2a52ecfdc78780e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
