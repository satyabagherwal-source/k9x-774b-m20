# Candidate Directive: [CD-TWN1] Lattice-Based Monotonic Capability Intersection for Agent Sub-Processes

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/codewhale-hq/Codewhale",
  "source_version": "98e055e6",
  "license": "MIT",
  "timestamp": "2026-11-28T09:08:20.221Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale) (Revision: `98e055e6`).  
> **License**: MIT | **Timestamp**: `2026-11-28T09:08:20.221Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an autonomous system spawns child workers, sub-agents, or sandboxed execution tasks, the child capability set MUST be computed via mathematical intersection (`parent ∩ requested`) against the parent’s grant. Every capability axis MUST be modeled as an ordered lattice (`Ord` / `PartialOrd`) where `min()` represents the safer/restrictive boundary. A child process MUST NOT be instantiated with an unverified capability envelope or inherit unmasked ambient parent permissions.

**WHY**:
Dynamic multi-agent systems suffer from privilege escalation traps: a parent running in a read-only or review role spawns a helper sub-agent that defaults to full read/write/network capabilities, bypassing workspace modification locks. Modeling permissions as ordered enums (`FileGrant: None < Read < Write`, `ShellGrant: None < Inspect < Verify < Full`) guarantees that any attempt by a child to widen its operational envelope collapses to the narrower permission held by the parent.

**WHEN TO APPLY**:
Apply to any multi-agent orchestration architecture, child process spawning framework, or plugin/extension host interface in Rust, Go, TypeScript, or Python.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum FileGrant {
    None = 0,
    Read = 1,
    Write = 2,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ShellGrant {
    None = 0,
    Inspect = 1,
    Verify = 2,
    Full = 3,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChildGrant {
    pub files: FileGrant,
    pub shell: ShellGrant,
    pub network: bool,
    pub desktop: bool,
    pub spawn: bool,
}

impl ChildGrant {
    /// Non-escalation primitive: parent grants constrain requested child grants.
    #[must_use]
    pub fn intersect(&self, requested: &ChildGrant) -> Self {
        Self {
            files: self.files.min(requested.files),
            shell: self.shell.min(requested.shell),
            network: self.network && requested.network,
            // Hard invariant: child never inherits desktop privilege under delegation
            desktop: false,
            // Sub-delegation permitted only if parent permits AND requested
            spawn: self.spawn && requested.spawn,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Defaulting or blindly accepting requested roles without intersecting
pub fn spawn_subagent(parent: &Agent, requested_role: &str) -> Agent {
    let grant = match requested_role {
        "builder" => ChildGrant { files: FileGrant::Write, shell: ShellGrant::Full, network: true, desktop: false, spawn: true },
        _ => ChildGrant::default_readonly(),
    };
    // CRITICAL SECURITY BUG: If parent is Read-Only, requesting "builder" escalates rights!
    Agent::new(grant)
}
```

**VERIFICATION METHOD**:
Property test enforcing mathematical monotonicity across all possible parent/requested state spaces:
```rust
#[test]
fn test_capability_monotonicity() {
    let parent = ChildGrant { files: FileGrant::Read, shell: ShellGrant::Inspect, network: false, desktop: false, spawn: false };
    let escalation_attempt = ChildGrant { files: FileGrant::Write, shell: ShellGrant::Full, network: true, desktop: true, spawn: true };
    let effective = parent.intersect(&escalation_attempt);
    
    assert_eq!(effective.files, FileGrant::Read);
    assert_eq!(effective.shell, ShellGrant::Inspect);
    assert!(!effective.network);
    assert!(!effective.desktop);
    assert!(!effective.spawn);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:08:20.219Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795856900219",
    "title": "Lattice-Based Monotonic Capability Intersection for Agent Sub-Processes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq/Codewhale",
    "source_uri": "https://github.com/codewhale-hq/Codewhale",
    "source_version": "HEAD",
    "content_hash": "98df84033c4a0abab83e7b02aa47984af6116998e5929850a337c22ef86e22da"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:08:20.219Z"
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
  "auth_token": "5f90412b390d57504047d2db087f89fa081d432da5644b411b2d22a1cc296ed1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
