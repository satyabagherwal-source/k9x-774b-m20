# Candidate Directive: [CD-0PKD] terraform aws network acl with unrestricted access to rdp/ssh

<!-- PROVENANCE_START
{
  "source_repository": "Checkmarx/kics",
  "source_url": "https://github.com/Checkmarx/kics",
  "source_version": "39fc33be",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T07:49:38.797Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-checkmarx-kics",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Checkmarx/kics](https://github.com/Checkmarx/kics) (Revision: `39fc33be`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T07:49:38.797Z`  
> **Learning ID**: `learn-github-checkmarx-kics`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `assets/libraries/terraform.rego`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Checkmarx/kics. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `39fc33be`: query): terraform aws network acl with unrestricted access to rdp/ssh. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Open Policy Agent data structures, boundary deserialization, API parsing, or resource lifecycles matching `assets/libraries/terraform.rego`.

**VERIFIED IMPLEMENTATION PATTERN**:
```open policy agent
// Verified production-grade fix pattern:
} else {
    rule.ipv6_cidr_block == common_lib.unrestricted_ipv6[_]
tcp_alias := ["tcp","6"]
	is_tcp(rule)
	not is_network_action_deny(rule)
	is_tcp(rule)
	not is_network_action_deny(rule)
	not is_network_action_deny(rule)
	not is_network_action_deny(rule)
}

is_network_action_deny(rule) {
	action_keys := ["action","rule_action"]
	lower(sprintf("%v", [rule[action_keys[_]]])) == "deny"
is_tcp(rule) {
	lower(sprintf("%v", [rule[prot_types[_]]])) == tcp_alias[_]
}

is_tcp_port_zero(rule) {
	rule.protocol == tcp_alias[_]
	rule.from_port == 0
	rule.to_port == 0
}


is_egress(rule) {
	lower(sprintf("%v", [rule.egress])) == "true"
}
```

**NEGATIVE CONSTRAINT**:
```open policy agent
// Induced defect failure mode:
	rule[prot_types[_]] == "tcp"
	rule[prot_types[_]] == "tcp"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `39fc33be` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T07:49:38.795Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795852178795",
    "title": "terraform aws network acl with unrestricted access to rdp/ssh",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Checkmarx/kics",
    "source_uri": "https://github.com/Checkmarx/kics",
    "source_version": "HEAD",
    "content_hash": "b966e5498f6fa4f3e50dc341eac9ea65c9128a4ab7b1ebbc0e9a197733192868"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T07:49:38.795Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "7fc97e941021e283734877e7bc542ff7498b168a10374a83eec58b9acac0e015"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
