# Candidate Directive: [CD-7FWW] Preserve marker identity across equivalent platform expressions

<!-- PROVENANCE_START
{
  "source_repository": "astral-sh/uv",
  "source_url": "https://github.com/astral-sh/uv",
  "source_version": "7f396534",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T21:22:19.088Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-astral-sh-uv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [astral-sh/uv](https://github.com/astral-sh/uv) (Revision: `7f396534`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T21:22:19.088Z`  
> **Learning ID**: `learn-github-astral-sh-uv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/uv-pep508/src/marker/algebra.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in astral-sh/uv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7424870a`: Preserve marker identity across equivalent platform expressions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/uv-pep508/src/marker/algebra.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
mod platform;
    platform: platform::Cache,
                let flags = platform::node_flags(&node);
                let id = NodeId::new(self.shared.nodes.push(node), flags);
        // This tests the two diagrams over their full domains, including impossible
        // platform combinations. Callers can supply the valid platform domain explicitly.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    /// The [`NodeId`] for the disjunction of known, mutually incompatible markers.
    exclusions: Option<NodeId>,
                let id = NodeId::new(self.shared.nodes.push(node), false);
        // Determine whether the conjunction _could_ contain a conflict.
        //
        // As an optimization, we only have to perform this check at the top-level, since these
        // variables are given higher priority in the tree. In other words, if they're present, they
        // _must_ be at the top; and if they're not at the top, we know they aren't present in any
        // children.
        let conflicts = x.var.is_conflicting_variable() && y.var.is_conflicting_variable();

        // If the node includes known incompatibilities, map it to `false`.
        let node = if conflicts {
            let exclusions = self.exclusions();
            if self.disjointness(node, exclusions.not()) {
                NodeId::FALSE
            } else {
                node
            }
        } else {
            node
        };

    /// Returns `true` if there is no environment in which both marker trees can apply,
    /// i.e. their conjunction is always `false`.
    pub(crate) fn is_disjoin
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7424870a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T21:22:19.086Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794950539086",
    "title": "Preserve marker identity across equivalent platform expressions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "astral-sh/uv",
    "source_uri": "https://github.com/astral-sh/uv",
    "source_version": "HEAD",
    "content_hash": "18a5cc35e3f8e611cef2bed21b92828d2f8504d28b6f4916a0a422e7a787f79b"
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
        "Harvested/verified timestamp recorded: 2026-11-17T21:22:19.086Z"
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
  "auth_token": "917d839ffa8be1143f4a86a143e2ea8021eb0b60132d36eb4328c7211b26454e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
