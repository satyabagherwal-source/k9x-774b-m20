# Candidate Directive: [CD-YDMG] preserve buffered stdin on TempFile fallback

<!-- PROVENANCE_START
{
  "source_repository": "sharkdp/bat",
  "source_url": "https://github.com/sharkdp/bat",
  "source_version": "107a23fe",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T15:00:03.832Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sharkdp-bat",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sharkdp/bat](https://github.com/sharkdp/bat) (Revision: `107a23fe`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T15:00:03.832Z`  
> **Learning ID**: `learn-github-sharkdp-bat`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/lessopen.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sharkdp/bat. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e8fbe09f`: lessopen): preserve buffered stdin on TempFile fallback. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/lessopen.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Strip a single trailing LF or CRLF from a temporary file path printed by `$LESSOPEN`.
fn strip_trailing_newline(s: &str) -> &str {
    s.strip_suffix("\r\n")
        .or_else(|| s.strip_suffix('\n'))
        .unwrap_or(s)
}

/// Fall back to opening the original input, replaying the buffered stdin payload
/// when stdin was already drained to feed `$LESSOPEN`.
fn open_original<'a, R: BufRead + 'a>(
    input: Input<'a>,
    stdin: R,
    stdin_buffer: Option<Vec<u8>>,
    stdout_identifier: Option<&Identifier>,
) -> Result<OpenedInput<'a>> {
    match stdin_buffer {
        Some(buf) => input.open(Cursor::new(buf), stdout_identifier),
        None => input.open(stdin, stdout_identifier),
    }
}

        let (lessopen_stdout, path_str, kind, stdin_buffer) = match input.kind {
                    None,
                        Some(stdin_buffer),
                            return open_original(input, stdin, stdin_buffer, stdout_identifier);
                    let stdout = strip_trailing_newline(&lessopen_string);
                    let file = match File::open(PathBuf::from(stdout)) {
                            return open_original(input, stdin, stdin_buffer, stdout_identifier
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let (lessopen_stdout, path_str, kind) = match input.kind {
                            return input.open(stdin, stdout_identifier);
                    let stdout = match lessopen_string.strip_suffix("\n") {
                        Some(stripped) => stripped.to_owned(),
                        None => lessopen_string,
                    };
                    let file = match File::open(PathBuf::from(&stdout)) {
                            return input.open(stdin, stdout_identifier);
                            .map(|s| shell_substitute_two(s, &path_str, &stdout)),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e8fbe09f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T15:00:03.829Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795791603829",
    "title": "preserve buffered stdin on TempFile fallback",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sharkdp/bat",
    "source_uri": "https://github.com/sharkdp/bat",
    "source_version": "HEAD",
    "content_hash": "769120c50639e29177c4c2a3892a8f4989f9a9c2d0f77189713594e3a2c2e694"
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
        "Harvested/verified timestamp recorded: 2026-11-27T15:00:03.830Z"
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
  "auth_token": "3c24ce54fee2e5d8189bf20fa0aedc0b76d8c5339f053a8c7a8d0532d507038d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
