# Candidate Directive: [CD-FLKS] Merge fix/428-figure-real-forgery: the README figure's red edge is a forgery oo-

<!-- PROVENANCE_START
{
  "source_repository": "fabio-rovai/open-ontologies",
  "source_url": "https://github.com/fabio-rovai/open-ontologies",
  "source_version": "c2b64e1b",
  "license": "MIT",
  "timestamp": "2026-11-21T15:31:25.564Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fabio-rovai-open-ontologies",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fabio-rovai/open-ontologies](https://github.com/fabio-rovai/open-ontologies) (Revision: `c2b64e1b`).  
> **License**: MIT | **Timestamp**: `2026-11-21T15:31:25.564Z`  
> **Learning ID**: `learn-github-fabio-rovai-open-ontologies`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fabio-rovai/open-ontologies. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2154f1bb`: Merge fix/428-figure-real-forgery: the README figure's red edge is a forgery oo-cert really refused. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **The README figure's red edge is a forged claim, and the refusal it
  reports is a real run of `oo-cert`** (#428). `docs/assets/knowledge-graph.py`
  took one of the derived subClassOf edges, every one of which `oo-cert`
  accepts, chose it by where it landed in the layout and drew it as the
  forgery, so the figure painted a certified entailment red and stated a
  refusal no checker had made. It now forges a new claim `s subClassOf X`, X a
  class the closure does not reach from s, as `demo/build_certified_graph.py`
  does: a derived line of s is copied with its conclusion changed to X,
  appended to a copy of the certificate, and `oo-cert` is run on it
  (`--oo-cert PATH`, default `lean/.lake/build/bin/oo-cert`). Nothing is
  written unless `oo-cert` accepts the certificate and exits 1 on the copy,
  naming the forged line and its rule, and the rule and exit code on the
  figure are read from that report. On ies-core the forgery is
  `SetOfRepresentations subClassOf Sign`, refused at line 265 as an `rdfs11`
  step, drawn beside the 257 derived edges, which all stay certified. The
  legend counts the ontology's edges only, as the Studio legend has since
  #425: 420 asserted, 25
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2154f1bb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T15:31:25.562Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795275085562",
    "title": "Merge fix/428-figure-real-forgery: the README figure's red edge is a forgery oo-",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fabio-rovai/open-ontologies",
    "source_uri": "https://github.com/fabio-rovai/open-ontologies",
    "source_version": "HEAD",
    "content_hash": "53d4a0034ed0fbd224fc8bc737f068692610ee013d86ed61beb843a6bf0e57b4"
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
        "Harvested/verified timestamp recorded: 2026-11-21T15:31:25.562Z"
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
  "auth_token": "cb98c22176e7b2d1bd9dec90b65aba04ce85608f89218c3f012124179737902e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
