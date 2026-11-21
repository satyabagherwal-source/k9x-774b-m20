# Candidate Directive: [CD-W0MQ] Zero-Trust Write-Length Validation and State Poisoning Guard

<!-- PROVENANCE_START
{
  "source_repository": "rustls-rustls-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:52:07.206Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rustls-rustls-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls-rustls-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:52:07.206Z`  
> **Learning ID**: `LEARN-EVO-rustls-rustls-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When wrapping external, untyped, or platform-level I/O primitives (`write()`, `send()`, syscall wrappers), you MUST explicitly check that the returned written length $n$ satisfies $n \le \text{buffer.len()}$. If $n > \text{buffer.len()}$, you MUST immediately poison and purge the pending write buffer and terminate the session with a fatal error. You MUST NOT attempt to slice the buffer with $n$ or continue execution.

**WHY**:
External implementations of I/O traits (such as custom `std::io::Write` adapters, mocks, or buggy OS sockets) can return corrupted or malicious positive integers larger than the input slice. In systems that drain buffers via `output.drain(..n)`, an unchecked value triggers a panic (`index out of bounds`) or, in low-level/unsafe code, memory exposure and unbounded pointer out-of-bounds arithmetic. Draining an indeterminate number of bytes invalidates TLS record alignment, making recovery impossible.

**WHEN TO APPLY**:
Apply to all stream adapters, socket abstraction layers, byte deframers, and protocol buffer drains where an external I/O layer reports progress via a byte counter.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
/// Write the front of `output` to `io`, draining the bytes that were written.
/// Enforces defensive validation against illegal driver returns (RFC / POSIX violation).
pub fn safe_write_and_drain(
    io: &mut (impl std::io::Write + ?Sized),
    output: &mut Vec<u8>,
) -> std::io::Result<usize> {
    let n = io.write(output)?;
    if n > output.len() {
        let available = output.len();
        // Clear all pending bytes to avoid stale re-transmission
        // if the caller unsafely catches and ignores this error.
        output.clear();
        return Err(std::io::Error::other(format!(
            "illegal write() return value: reported {n} bytes written, but only {available} were available"
        )));
    }
    output.drain(..n);
    Ok(n)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly trusting the reported write count.
// Triggers panic on output.drain(..n) when n > output.len(),
// or causes slice slicing panic/undefined memory states.
pub fn unsafe_write_and_drain(io: &mut impl std::io::Write, output: &mut Vec<u8>) -> std::io::Result<usize> {
    let n = io.write(output)?;
    // If io is a buggy third-party pipe returning usize::MAX or corrupted integers:
    // This panics with "range end out of bounds" or slices out-of-bounds.
    output.drain(..n); 
    Ok(n)
}
```

**VERIFICATION METHOD**:
Mock test with a faulty `Write` implementation:
```rust

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:52:07.345Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294327345",
    "title": "Zero-Trust Write-Length Validation and State Poisoning Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls-rustls-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ab743b4c874c9f925d86df8311480ce18a46b22208f1646c08f6be5cfbef9953"
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:52:07.345Z"
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
  "auth_token": "aacd95bfaf917dd4748326823384d9f5559f70490c1f4c2107e8c306af04a318"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
