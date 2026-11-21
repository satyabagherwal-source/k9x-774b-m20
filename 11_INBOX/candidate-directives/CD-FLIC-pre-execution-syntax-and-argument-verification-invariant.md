# Candidate Directive: [CD-FLIC] Pre-Execution Syntax and Argument Verification Invariant

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya/himalaya",
  "source_url": "https://github.com/pimalaya/himalaya",
  "source_version": "bf9f4e2a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T23:27:18.948Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pimalaya-himalaya",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya/himalaya](https://github.com/pimalaya/himalaya) (Revision: `bf9f4e2a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T23:27:18.948Z`  
> **Learning ID**: `learn-github-pimalaya-himalaya`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
pub struct CommandArgs {
    /// Target sequence set parsed and checked strictly during CLI argument derivation.
    #[arg(value_parser = clap::builder::ValueParser::new(SequenceRange::from_str))]
    pub sequence: SequenceRange,
}

pub fn execute_prevalidated(args: CommandArgs) -> Result<(), Box<dyn std::error::Error>> {
    // Secrets and network connections are ONLY accessed here, after args are guaranteed valid.
    let _secret = resolve_vault_secret()?;
    Ok(())
}

fn resolve_vault_secret() -> Result<String, Box<dyn std::error::Error>> {
    // External process call
    Ok("token".to_string())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Resolving secrets or establishing network state before verifying arguments
pub fn run_leaky(raw_sequence: &str) -> Result<(), Box<dyn std::error::Error>> {
    // BAD: Password prompt or IPC triggered before validating raw_sequence
    let client = connect_imap_and_prompt_keyring()?; 
    
    // If this fails, the user was prompted for their master password pointlessly
    let seq = raw_sequence.parse::<u32>()?; 
    client.fetch(seq)?;
    Ok(())
}
```

**VERIFICATION METHOD**:
Enforce via automated parser unit tests using `clap::Parser::try_parse_from`:
```rust
#[test]
fn test_invalid_arguments_abort_before_execution() {
    let bad_input = ["app", "fetch", "abc"];
    let result = CommandArgs::try_parse_from(&bad_input);
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.kind(), clap::error::ErrorKind::ValueValidation);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:27:18.946Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303638946",
    "title": "Pre-Execution Syntax and Argument Verification Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya/himalaya",
    "source_uri": "https://github.com/pimalaya/himalaya",
    "source_version": "HEAD",
    "content_hash": "1fb7578815af61f8d49ea4bce97ec71f487e6c2b7df2bbebbdd30d7505a05198"
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:27:18.946Z"
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
  "auth_token": "f39da30379d3d3da04db1cd17856f55a4a1955398759c715c35e9310e02863df"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
