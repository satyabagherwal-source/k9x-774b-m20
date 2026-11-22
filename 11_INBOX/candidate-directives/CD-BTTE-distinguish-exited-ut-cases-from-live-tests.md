# Candidate Directive: [CD-BTTE] distinguish exited UT cases from live tests

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "7431a275",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T05:28:18.098Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `7431a275`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T05:28:18.098Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `optools/active_ut_incremental.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `96d0d018`: ci): distinguish exited UT cases from live tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `optools/active_ut_incremental.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
STATE_VERSION = 2
MAX_LIFECYCLE_LINE_BYTES = 1024 * 1024
TEST_START_ACTIONS = ("run", "pause", "cont")
TERMINAL_ACTIONS = ("pass", "fail", "skip")


    if not (
    ):
        return False

    def package_entry(entry):
        return (
            isinstance(entry, list) and len(entry) == 2
            and isinstance(entry[0], str)
            and type(entry[1]) is int and entry[1] > 0
        )

    def cases_entry(cases):
        return isinstance(cases, dict) and all(
            isinstance(entry, list) and len(entry) == 4
            and isinstance(entry[0], str) and isinstance(entry[1], str)
            and type(entry[2]) is int and entry[2] > 0
            and isinstance(entry[3], bool)
            for entry in cases.values()
        )

    return all(map(package_entry, state["packages"].values())) and all(
        map(cases_entry, state["cases"].values())
def apply_event(state, event, unfinished=None):
    packages, cases = state["packages"], state["cases"]
    invocation = packages.get(package)
            if invocation is None:
                packages[package] = [when, 1]
            else:
                invocation[1] += 1
        elif action in TERMINAL_ACTIONS:
     
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
    return (
        and all(isinstance(k, str) and isinstance(v, str) for k, v in state["packages"].items())
        and all(isinstance(v, list) and len(v) == 4 and all(isinstance(s, str) for s in v)
                for v in state["cases"].values())
def apply_event(state, event):
            state["packages"][package] = when
        elif action in ("pass", "fail", "skip"):
            state["packages"].pop(package, None)
        # Keep unfinished cases on a package failure, as the AWK oracle does.
    key = json.dumps([package, test])
    if action in ("run", "pause", "cont"):
        started = state["cases"].get(key, [package, test, action, when])[3]
        state["cases"][key] = [package, test, action, started]
    elif action in ("pass", "fail", "skip"):
        state["cases"].pop(key, None)
            line = stream.readline(1024 * 1024)
            oversized = not line.endswith(b"\n") and len(line) == 1024 * 1024
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `96d0d018` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T05:28:18.095Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795325298095",
    "title": "distinguish exited UT cases from live tests",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matrixorigin/matrixone",
    "source_uri": "https://github.com/matrixorigin/matrixone",
    "source_version": "HEAD",
    "content_hash": "7987e5e839cac55d0cb07d73a2ea9a11272ae9c3d58bfcdc12c2f3eca5c50d74"
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
        "Harvested/verified timestamp recorded: 2026-11-22T05:28:18.095Z"
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
  "auth_token": "985ddc2817c2a93a0b6ff06b5705d4d2fd45a34a9b71dd89f79a597adcb5d341"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
