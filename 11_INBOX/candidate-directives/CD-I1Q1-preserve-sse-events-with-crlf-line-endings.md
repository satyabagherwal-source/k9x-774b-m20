# Candidate Directive: [CD-I1Q1] preserve SSE events with CRLF line endings

<!-- PROVENANCE_START
{
  "source_repository": "higress-group/higress",
  "source_url": "https://github.com/higress-group/higress",
  "source_version": "879a6512",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T11:15:44.569Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-higress-group-higress",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [higress-group/higress](https://github.com/higress-group/higress) (Revision: `879a6512`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T11:15:44.569Z`  
> **Learning ID**: `learn-github-higress-group-higress`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `plugins/wasm-rust/src/event_stream.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in higress-group/higress. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `879a6512`: wasm-rust): preserve SSE events with CRLF line endings. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `plugins/wasm-rust/src/event_stream.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
/// CRLF is one logical line ending. An empty line, formed by two consecutive
/// logical line endings, terminates an event.
    skip_lf: bool,
    /// CRLF pairs are consumed together, including pairs split across updates.
    /// A delimiter ending in CR at the buffer boundary completes the event
    /// immediately. Waiting for the next byte to distinguish CR from CRLF
    /// would delay dispatch when that byte is not LF, or never arrives.
    /// `update` skips an optional following LF using `skip_lf`, so it does not
    /// become an extra line ending.
                self.skip_lf = self.processed_offset == self.buffer.len()
                    && self.buffer.last() == Some(&b'\r');
            i += self.is_eol(i).unwrap_or(1);
        let mut start = 0;
        if self.skip_lf && !data.is_empty() {
            if data[0] == b'\n' {
                start = 1;
            }
            self.skip_lf = false;
        }
        self.buffer.extend_from_slice(&data[start..]);
            self.is_eol(i + size1).map(|size2| size1 + size2)
        parser.update(b"event3\n\r\nevent4\r\n\r\n".to_vec());
        assert_eq!(parser.next(), Some(b"event5\r\nevent6".to_vec()));
        asser
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
/// According to spec, we must judge EOL twice before we can identify a complete event.
/// However, in the rules of event and field, there is an ambiguous grammar in the judgment of eol,
/// and it will bring ambiguity (whether the field ends). In order to eliminate this ambiguity,
/// we believe that CRLF as CR+LF belongs to event and field respectively.
    /// Next will consume all the data in the current buffer. However, if there is a valid event at the end of the buffer,
    /// it will return the event directly even if the data after the next `update` could be considered part of the same event
    /// (especially in cases where CRLF hits an ambiguous grammar).
    /// When this happens, the next call to next may return an empty event.
    ///
    /// ```
    /// let mut parser = EventStream::new();
    /// parser.update(...);
    /// loop {
    ///     match parser.next() {
    ///         None => {}
    ///         Some(event) => {
    ///             if !event.is_empty() {
    ///                 ...
    ///             }
    ///         }
    ///     }
    /// }
    /// ```
            i += 1;
        self.buffer.extend(data);
            match self.is_eol(i + size1) {
  
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `879a6512` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T11:15:44.567Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795691744567",
    "title": "preserve SSE events with CRLF line endings",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "higress-group/higress",
    "source_uri": "https://github.com/higress-group/higress",
    "source_version": "HEAD",
    "content_hash": "99688f7215971787cdf83caa36c6d063d0de291e638c3cf9dc9e84d54f761d86"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T11:15:44.567Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "c4ac5c30ae531b3aed0e08be49c35c51937c3951319a8acadd8881e326bfd2f3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
