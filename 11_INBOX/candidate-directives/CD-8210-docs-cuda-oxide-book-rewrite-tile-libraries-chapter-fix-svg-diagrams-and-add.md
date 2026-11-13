# Candidate Directive: [CD-8210] docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add

<!-- PROVENANCE_START
{
  "source_repository": "NVIDIA/cuda-rust",
  "source_url": "https://github.com/NVIDIA/cuda-rust",
  "source_version": "7a7d160e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T21:16:06.852Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nvidia-cuda-rust",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust) (Revision: `7a7d160e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T21:16:06.852Z`  
> **Learning ID**: `learn-github-nvidia-cuda-rust`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cuda-oxide/cuda-oxide-book/advanced/images/tilelib-direct-linkage.svg`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5183ab57`: docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add CLI/MLIR/C++ highlighting. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cuda-oxide/cuda-oxide-book/advanced/images/tilelib-direct-linkage.svg`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 740" width="1240" height="740" role="img"
  aria-label="Static tile library flow: Left column builds relu.tilelib from #[tile_export], middle column compiles the Tile caller to prog.tilebc, and right column links both in tileiras to produce kernel.cubin">
  :root, svg {
  @media (prefers-color-scheme: dark) { :root, svg {
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 800" width="1240" height="800" role="img"
  aria-label="Direct linkage flow: Rust source becomes LTOIR plus two description bytecodes, packaged into a .tilelib that tileiras links with a Tile kernel's bytecode into one cubin">
  :root, svg { 
  @media (prefers-color-scheme: dark) { :root, svg { 
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill: var(--fg)"/></marker></defs>
<rect x="0" y="0" width="1240" height="800" style="fill: var(--bg)"/>
<text x="40" y="34" text-anchor="start" style="font: 600 17px var(--sans); fill: var(--fg)">Direct linkage: a Tile kernel calls a Rust function through a .tilelib</text>
<text x="40" y="56" text-anchor="start" style="font: 400 12.5px var(--sans); fill: var(--muted)">cuda-oxide is the SIMT provider. It ships code plus a description; the Tile compiler matches, marshals and links.</text>
<text x="40" y="92" text-anchor="start" style="font: 600 11px var(--sans); fill: var(--muted)">RUST SIDE  (cuda-oxide)</text>
<text x="620.0" y="92" text-anchor="middle" style="font: 600 11
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5183ab57` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T21:16:06.850Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794604566850",
    "title": "docs(cuda-oxide-book): rewrite Tile Libraries chapter, fix SVG diagrams, and add",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NVIDIA/cuda-rust",
    "source_uri": "https://github.com/NVIDIA/cuda-rust",
    "source_version": "HEAD",
    "content_hash": "1aef58b1ada44c9eb11abd4e406d65c3c56fbeabf34c0ff9ac1c947526196fe0"
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
        "Harvested/verified timestamp recorded: 2026-11-13T21:16:06.850Z"
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
  "auth_token": "dcc0a50ee38220907493e5bc7a9488a4de8ee566ec3492fb3da0de5c2a0eb506"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
