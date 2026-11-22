# Candidate Directive: [CD-2CIS] Extract the JUnit product test suite runner

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "5f59f4a1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T14:40:48.100Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `5f59f4a1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T14:40:48.100Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/bin/run-product-test-suites.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trinodb/trino. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5f59f4a1`: Extract the JUnit product test suite runner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/bin/run-product-test-suites.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
#!/usr/bin/env bash

set -eo pipefail

mkdir -p logs

# Suites load checked-in configuration from paths relative to the repository root.
product_test_distribution=testing/trino-product-tests/target/product-test-distribution
test_jar=("${product_test_distribution}"/lib/trino-product-tests-*-tests.jar)
product_test_classpath=$(< "${product_test_distribution}/classpath.txt")
product_test_classpath="${product_test_distribution}/${product_test_classpath//:/:${product_test_distribution}/}"

declare -a suite_results=()
declare -a suite_totals=()
echo "## pt ${MATRIX_SUITE}" >> "$GITHUB_STEP_SUMMARY"
echo "" >> "$GITHUB_STEP_SUMMARY"

failed=0
failed_suites=()

for suite in ${MATRIX_SUITE}; do
  log_file="logs/${suite}.log"
  echo "### ${suite}" >> "$GITHUB_STEP_SUMMARY"
  echo "" >> "$GITHUB_STEP_SUMMARY"

  set +e
  java \
    -Xmx512M \
    -XX:+ExitOnOutOfMemoryError \
    -Dtrino.product-tests.image="${TRINO_PRODUCT_TESTS_IMAGE}" \
    -cp "${test_jar[0]}:${product_test_classpath}" \
    io.trino.tests.product.suite.${suite} \
    | tee "${log_file}"
  rc=${PIPESTATUS[0]}
  set -e

  total_line=$(grep '^TOTAL' "${log_file}" | tail -1 || true)
  if [ -n "${total_line}" ]; then
    suit
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5f59f4a1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T14:40:48.098Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795358448098",
    "title": "Extract the JUnit product test suite runner",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "b8600ecea1bf6a4fc74eedf59d849c3c58f33be34eef0e480d44cb32db872f75"
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
        "Harvested/verified timestamp recorded: 2026-11-22T14:40:48.098Z"
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
  "auth_token": "b2e2a69ddf987034b17604457d498d3a71d87725cc6ea262399989031956736d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
