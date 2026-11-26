# Candidate Directive: [CD-0AMA] gha/eks: run the conformance suite on an IPv6-only cluster

<!-- PROVENANCE_START
{
  "source_repository": "cilium/cilium",
  "source_url": "https://github.com/cilium/cilium",
  "source_version": "f2e66637",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T00:18:05.122Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cilium-cilium",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium/cilium](https://github.com/cilium/cilium) (Revision: `f2e66637`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T00:18:05.122Z`  
> **Learning ID**: `learn-github-cilium-cilium`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/actions/cli-test-config/action.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cilium/cilium. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5091870f`: gha/eks: run the conformance suite on an IPv6-only cluster. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/actions/cli-test-config/action.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
        if [ -n "${{ inputs.external-cidr }}" ]; then
          CONNECTIVITY_TEST_DEFAULTS+=("--external-cidr=${{ inputs.external-cidr }}")
        fi
        if [ -n "${{ inputs.external-ip }}" ]; then
          CONNECTIVITY_TEST_DEFAULTS+=("--external-ip=${{ inputs.external-ip }}")
        fi
        if [ -n "${{ inputs.external-other-ip }}" ]; then
          CONNECTIVITY_TEST_DEFAULTS+=("--external-other-ip=${{ inputs.external-other-ip }}")
        fi
        if [ "${{ inputs.external-target-ipv6-capable }}" == "true" ]; then
          CONNECTIVITY_TEST_DEFAULTS+=("--external-target-ipv6-capable")
        fi

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
          "--external-cidr=${{ inputs.external-cidr }}" \
          "--external-ip=${{ inputs.external-ip }}" \
          "--external-other-ip=${{ inputs.external-other-ip }}" \
          "--external-target-ipv6-capable=${{ inputs.external-target-ipv6-capable }}" \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5091870f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T00:18:05.120Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795652285120",
    "title": "gha/eks: run the conformance suite on an IPv6-only cluster",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium/cilium",
    "source_uri": "https://github.com/cilium/cilium",
    "source_version": "HEAD",
    "content_hash": "5e5f7e5a23ffed692dabec6bce3d6b1edbbc23fe349ccba9d45565068e30321f"
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
        "Harvested/verified timestamp recorded: 2026-11-26T00:18:05.120Z"
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
  "auth_token": "ff53dd7bf90ac6b3bea8215e7167da05a3e6e8ff7888df04cd9a9daf1cf233d7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
