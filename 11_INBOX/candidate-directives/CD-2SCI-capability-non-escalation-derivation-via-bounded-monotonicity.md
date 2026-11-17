# Candidate Directive: [CD-2SCI] Capability Non-Escalation Derivation via Bounded Monotonicity

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/codewhale-hq/Codewhale",
  "source_version": "9c7cb976",
  "license": "MIT",
  "timestamp": "2026-11-17T19:54:43.074Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale) (Revision: `9c7cb976`).  
> **License**: MIT | **Timestamp**: `2026-11-17T19:54:43.074Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Child agent authorization MUST be modeled as a monotonic lattice intersection where child permissions are strictly derived from parent permissions via operations bounded by `Ord::min` or Boolean conjunction (`&&`). Child profiles MUST NEVER accept unconstrained raw string lists or explicit role names to expand permissions beyond the parent's ambient grant.

**WHY**:
Allowing sub-agents to declare standalone role boundaries causes privilege escalation: an unprivileged `Scout` agent could spawn a `Builder` agent capable of arbitrary workspace mutations or network exfiltration unless derivation algebraically intersects against the parent's actual authority.

**WHEN TO APPLY**:
Multi-agent orchestrators, LLM sub-agent spawning, plugin permission boundaries, dynamic role delegation frameworks.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum FileGrant {
    None,
    Read,
    Write,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ShellGrant {
    None,
    Inspect,
    Verify,
    Full,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorityProfile {
    pub files: FileGrant,
    pub shell: ShellGrant,
    pub network: bool,
    pub spawn: bool,
    pub allowed_tools: Option<Vec<String>>,
}

impl AuthorityProfile {
    #[must_use]
    pub fn derive_child(&self, requested: &AuthorityProfile) -> Self {
        // Enforce monotonic non-escalation across every authority axis
        let files = self.files.min(requested.files);
        let shell = self.shell.min(requested.shell);
        let network = self.network && requested.network;
        let spawn = self.spawn && requested.spawn;

        // Tool scope intersection
        let allowed_tools = match (&self.allowed_tools, &requested.allowed_tools) {
            (Some(parent_tools), Some(child_tools)) => {
                let filtered: Vec<String> = child_tools
                    .iter()
                    .filter(|tool| parent_tools.contains(tool))
                    .cloned()
                    .collect();
                Some(filtered)
            }
            (Some(parent_tools), None) => Some(parent_tools.clone()),
            (None, Some(child_tools)) => Some(child_tools.clone()),
            (None, None) => None,
        };

        Self {
            files,
            shell,
            network,
            spawn,
            allowed_tools,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Trusting requested child role blindly without parent intersection
pub fn spawn_child(parent: &Worker, requested_role: FleetRole) -> Worker {
    // BUG: If parent is read-only, spawning a Builder escalates to write access
    let grant = ChildGrant::for_role(&requested_role);
    Worker::new(grant)
}
```

**VERIFICATION METHOD**:
Implement property-based tests verifying the non-escalation invariant:
$\forall (P, R), \text{derive\_child}(P, R) \le P$ across all dimensions (`files`, `shell`, `network`, `spawn`).

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:54:43.074Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794945283074",
    "title": "Capability Non-Escalation Derivation via Bounded Monotonicity",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq/Codewhale",
    "source_uri": "https://github.com/codewhale-hq/Codewhale",
    "source_version": "HEAD",
    "content_hash": "f10b476d91a3790555aeb1146483070f3cdaa1dbebb01dd690b9f36e49e1354c"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:54:43.074Z"
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
  "auth_token": "585bd6df3e27147f5ab35a7e711a59d4f5922a7919f7c25d20d2f60eb4eaec4e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
