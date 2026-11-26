# Candidate Directive: [CD-IWL6] wasm-rust): preserve SSE events with CRLF line endings

<!-- PROVENANCE_START
{
  "source_repository": "higress-group-higress-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T11:16:24.430Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-higress-group-higress-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [higress-group-higress-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T11:16:24.430Z`  
> **Learning ID**: `LEARN-EVO-higress-group-higress-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T11:16:24.568Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795691784568",
    "title": "wasm-rust): preserve SSE events with CRLF line endings",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "higress-group-higress-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0803d8fc7f867554940a0677480f10cec43086f5d709cb5d760c638e46894980"
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
        "Harvested/verified timestamp recorded: 2026-11-26T11:16:24.569Z"
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
  "auth_token": "05ad6991e4e7e205c8bfe39f787a57ad98a2d1192f05ba7e63fb9b265bb372a3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
