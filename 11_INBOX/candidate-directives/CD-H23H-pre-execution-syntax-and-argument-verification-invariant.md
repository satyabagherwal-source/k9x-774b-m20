# Candidate Directive: [CD-H23H] Pre-Execution Syntax and Argument Verification Invariant

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya-himalaya-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T23:28:26.969Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pimalaya-himalaya-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya-himalaya-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T23:28:26.969Z`  
> **Learning ID**: `LEARN-EVO-pimalaya-himalaya-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
CLI argument parsing MUST validate syntactic, semantic, and domain-level grammar constraints prior to invoking any credential resolvers, keyrings, file handles, or network sockets. If an argument is malformed, the process MUST exit immediately with an invalid-usage status code without triggering side effects.

**WHY**:
Invoking external secret providers (such as `pass`, `1Password`, `gpg-agent`, or system keyrings) or initiating TLS handshakes before verifying user input exposes credentials, spawns unnecessary sub-processes, causes IPC deadlocks in non-interactive environments, and slows down immediate user feedback.

**WHEN TO APPLY**:
Apply in all CLI applications, daemon commands, and RPC gateways where command-line arguments (e.g., message sequence ranges, UUIDs, email addresses, CIDR blocks) can be validated syntactically before runtime execution contexts are established.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use clap::Parser;
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SequenceRange {
    pub start: u32,
    pub end: Option<u32>,
}

impl FromStr for SequenceRange {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = s.split(':').collect();
        match parts.as_slice() {
            [single] => {
                let n = single.parse::<u32>().map_err(|e| format!("Invalid sequence id `{single}`: {e}"))?;
                Ok(SequenceRange { start: n, end: Some(n) })
            }
            [start, "*"] => {
                let n = start.parse::<u32>().map_err(|e| format!("Invalid range start `{start}`: {e}"))?;
                Ok(SequenceRange { start: n, end: None })
            }
            [start, end] => {
                let s_num = start.parse::<u32>().map_err(|e| format!("Invalid range start `{start}`: {e}"))?;
                let e_num = end.parse::<u32>().map_err(|e| format!("Invalid range end `{end}`: {e}"))?;
                if s_num > e_num {
                    return Err(format!("Start range `{s_num}` cannot exceed end range `{e_num}`"));
                }
                Ok(SequenceRange { start: s_num, end: Some(e_num) })
            }
            _ => Err(format!("Invalid sequence format `{s}`: expected `<id>`, `<id>:*`, or `<start>:<end>`")),
        }
    }
}

#[derive(Parser, Debug)]
#[command(name = "client")]

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:28:27.096Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303707096",
    "title": "Pre-Execution Syntax and Argument Verification Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya-himalaya-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a1a1afa0206d018030ea87d6c957e70dd6ef3968b539bb5f1d1f8034e231d478"
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:28:27.097Z"
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
  "auth_token": "046af6b3aa2ee7300d50269de9fe5fbb4b8555bd4aa630f24ff205de031bec1d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
