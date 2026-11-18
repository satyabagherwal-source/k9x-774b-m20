# Candidate Directive: [CD-2BVB] python tooling is subpar, call the right pre-installed python

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "fbc8b20d",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T22:57:59.447Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `fbc8b20d`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T22:57:59.447Z`  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/m1_tests.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fbc8b20d`: python tooling is subpar, call the right pre-installed python. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/m1_tests.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      # Indicate which python3 binary to use
      - name: Set python executable for macOS
        run: |
          version="$(make python_min_version)"
          echo "PYTHON_EXE=python${version}" >> "${GITHUB_ENV}"

      - name: Node setup
        run: |
          # Resolve the Node major pinned in the Makefile to its most recent release: the cache key
          # below and all the make recipes of this job then use that exact release, so a new Node
          # release invalidates the cache instead of being shadowed by a cached older one.
          echo "NODE_VERSION=$(make node_latest_version)" >> "${GITHUB_ENV}"

      - name: Node cache restoration
        id: node-cache
        uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 #v6.1.0
        with:
          path: |
            .nvm
            .npm
          key: node-${{ runner.os }}-${{ runner.arch }}-${{ env.NODE_VERSION }}

      - name: Install Node
        if: steps.node-cache.outputs.cache-hit != 'true'
        run: |
          make install_node

      - name: Node cache save
        uses: actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 #v6.1.0
        if: steps.node-cache.outputs.cache-
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      - name: Override NVM_DIR for proper node detection on this runner
        run: |
          echo "NVM_DIR=${HOME}/.nvm" >> "${GITHUB_ENV}"

      - name: Setup Python
        uses: ./.github/actions/setup_python

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fbc8b20d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T22:57:59.445Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795042679445",
    "title": "python tooling is subpar, call the right pre-installed python",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "1ae1b3ca37f2057e1e725c891e83cb60bcb18891d7340c2e1b4806217af8913b"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T22:57:59.445Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "6137048a41acaf59a24b54bcf8efc7300fd6089017863623fc31a333227a5680"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
