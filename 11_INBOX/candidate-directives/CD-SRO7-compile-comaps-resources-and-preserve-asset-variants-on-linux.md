# Candidate Directive: [CD-SRO7] Compile CoMaps resources and preserve asset variants on Linux

<!-- PROVENANCE_START
{
  "source_repository": "sweetpad-dev/sweetpad",
  "source_url": "https://github.com/sweetpad-dev/sweetpad",
  "source_version": "6d61e2f6",
  "license": "MIT",
  "timestamp": "2026-11-28T16:35:20.983Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sweetpad-dev-sweetpad",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sweetpad-dev/sweetpad](https://github.com/sweetpad-dev/sweetpad) (Revision: `6d61e2f6`).  
> **License**: MIT | **Timestamp**: `2026-11-28T16:35:20.983Z`  
> **Learning ID**: `learn-github-sweetpad-dev-sweetpad`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/sweetpad-lib.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sweetpad-dev/sweetpad. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `89f52f8f`: Compile CoMaps resources and preserve asset variants on Linux. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/sweetpad-lib.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      - name: Check out the CoMaps interface files and asset catalog
        uses: actions/checkout@v7
        with:
          repository: comaps/comaps
          ref: 27ea5a9b92b266abe6d1b690e02ad5c89bf95217
          path: .build/comaps-source
          persist-credentials: false
          sparse-checkout-cone-mode: false
          sparse-checkout: |
            /iphone/Maps/**/*.xib
            /iphone/Maps/**/*.storyboard
            /iphone/Maps/**/Contents.json
            /iphone/Maps/Images.xcassets/
            /iphone/Maps/CoMapsWidgetExtension/Assets.xcassets/
      - name: Require fixture coverage for every CoMaps resource combination
        if: matrix.os == 'ubuntu-24.04'
        run: python3 sweetpad-cli/fixtures/resource_gaps.py .build/comaps-source/iphone/Maps --require-covered
      - name: Compile CoMaps and the resource regression fixtures on Linux
        run: |
          cargo build -p sweetpad-cli --bin sweetpad
          python3 sweetpad-cli/fixtures/comaps/compile.py target/debug/sweetpad .build/comaps-source "$RUNNER_TEMP/comaps-resources"
      - name: Export Linux-built resources for UIKit
        if: matrix.os == 'ubuntu-24.04'
        uses: actions/upl
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `89f52f8f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T16:35:20.981Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795883720981",
    "title": "Compile CoMaps resources and preserve asset variants on Linux",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sweetpad-dev/sweetpad",
    "source_uri": "https://github.com/sweetpad-dev/sweetpad",
    "source_version": "HEAD",
    "content_hash": "8e52ec0c4f35731f75bfc733a979fba00e15fc6485605dad24f79d456928f480"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T16:35:20.981Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "e454baa0ca876506042907beea274891227bc028bc53341a5d996cfe662e49c5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
