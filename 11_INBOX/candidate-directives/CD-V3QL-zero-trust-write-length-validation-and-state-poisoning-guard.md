# Candidate Directive: [CD-V3QL] Zero-Trust Write-Length Validation and State Poisoning Guard

<!-- PROVENANCE_START
{
  "source_repository": "rustls/rustls",
  "source_url": "https://github.com/rustls/rustls",
  "source_version": "10bb7f9c",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T20:51:24.717Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rustls-rustls",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rustls/rustls](https://github.com/rustls/rustls) (Revision: `10bb7f9c`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T20:51:24.717Z`  
> **Learning ID**: `learn-github-rustls-rustls`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
#[test]
fn test_illegal_write_length_triggers_purge_and_error() {
    struct CorruptedWriter;
    impl std::io::Write for CorruptedWriter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            Ok(buf.len() + 10) // Illegal return!
        }
        fn flush(&mut self) -> std::io::Result<()> { Ok(()) }
    }

    let mut buf = vec![1, 2, 3, 4, 5];
    let res = safe_write_and_drain(&mut CorruptedWriter, &mut buf);
    assert!(res.is_err());
    assert!(buf.is_empty(), "Buffer must be purged to prevent invalid state re-use");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:51:24.714Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294284714",
    "title": "Zero-Trust Write-Length Validation and State Poisoning Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rustls/rustls",
    "source_uri": "https://github.com/rustls/rustls",
    "source_version": "HEAD",
    "content_hash": "02467be79fc4233c2bffe9148f14d506ed32ba2c848f94f3f9b74eb1f2b8e6e8"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:51:24.714Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "ceb7741fc7d59ce70011b41e3028a81802f1795f459e5b2d5e5849c385f5cb9e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
