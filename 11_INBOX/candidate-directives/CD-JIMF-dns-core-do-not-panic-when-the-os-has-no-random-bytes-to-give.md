# Candidate Directive: [CD-JIMF] dns, core: do not panic when the OS has no random bytes to give

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh-bun-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T09:52:54.108Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oven-sh-bun-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh-bun-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T09:52:54.108Z`  
> **Learning ID**: `LEARN-EVO-oven-sh-bun-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/bun_core/util.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2e321d89`: dns, core: do not panic when the OS has no random bytes to give. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/bun_core/util.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Returns whether the system filled `bytes`.
#[must_use]
pub fn os_entropy(bytes: &mut [u8]) -> bool {
            if rc <= 0 {
                if rc < 0 && crate::ffi::errno() == libc::EINTR {
                static URANDOM: Once<std::fs::File> = Once::new();
                let file = URANDOM.get().or_else(|| {
                    let file = std::fs::File::open("/dev/urandom").ok()?;
                    Some(URANDOM.get_or_init(|| file))
                });
                return file.is_some_and(|mut f| f.read_exact(&mut bytes[filled..]).is_ok());
        true
        bytes.chunks_mut(256).all(|chunk| {
            unsafe { libc::getentropy(chunk.as_mut_ptr().cast(), chunk.len()) == 0 }
        })
        bytes.chunks_mut(u32::MAX as usize).all(|chunk| {
            unsafe { RtlGenRandom(chunk.as_mut_ptr(), chunk.len() as u32) != 0 }
        })
/// The clock stands in for as long as the OS has no seed to give.
    fn random_seed() -> Option<u64> {
                return Some(n);
            v = os_entropy(&mut buf).then(|| u64::from_ne_bytes(buf))?;
        Some(v)
        let prng = p
            .or_else(|| random_seed().map(rand::DefaultPrng::init));
        let Some(mut pr
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
pub fn os_entropy(bytes: &mut [u8]) {
            if rc < 0 {
                let err = crate::ffi::errno();
                if err == libc::EINTR {
                static URANDOM: Once<std::io::Result<std::fs::File>> = Once::new();

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T09:52:54.274Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795686774273",
    "title": "dns, core: do not panic when the OS has no random bytes to give",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oven-sh-bun-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "30d30b19c2b927b99edb79563b59acd8a2266117f887d437c6f9621f39431740"
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
        "Harvested/verified timestamp recorded: 2026-11-26T09:52:54.274Z"
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
  "auth_token": "9c94f00b097a512d774bfa2aea9f34405b955a633fa963883163333df1722c01"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
