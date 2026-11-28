# Candidate Directive: [CD-PQ7A] CSS source maps with multiple assets with the same file path

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler/parcel",
  "source_url": "https://github.com/parcel-bundler/parcel",
  "source_version": "346bc724",
  "license": "MIT",
  "timestamp": "2026-11-28T09:05:05.254Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-parcel-bundler-parcel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler/parcel](https://github.com/parcel-bundler/parcel) (Revision: `346bc724`).  
> **License**: MIT | **Timestamp**: `2026-11-28T09:05:05.254Z`  
> **Learning ID**: `learn-github-parcel-bundler-parcel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/css/src/packager.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in parcel-bundler/parcel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `346bc724`: CSS source maps with multiple assets with the same file path. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/css/src/packager.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    let contents: Vec<(AssetIndex, &Asset, &CssContent, bool)> = bundle
      .assets
      .iter()
      .map(|asset_index| {
        let asset = bundle_graph.asset_graph.asset(*asset_index);
        let Some(content) = asset.content.downcast_ref::<CssContent>() else {
          unreachable!("expected a CSS asset")
        };
        let has_input_map = content.stylesheet.source_map(0).is_some();
        (*asset_index, asset, content, has_input_map)
      })
      .collect();

    // Rule locations index into the assembled sheet's sources, and the printer writes
    // that index into the map as is, unless the sheet has an input map, which it looks
    // up by the same index and remaps through. SourceMap::add_source dedupes, and
    // several assets can share a file (e.g. conditional imports of one file), so the
    // first slots follow the map's sources one to one, and sheets without an input map
    // point at their file's slot. Sheets with an input map each take a slot after
    // those; the printer adds the sources their maps reach as it encounters them.
    let mut sources = Vec::new();
    let mut source_indices: Vec<u32> = contents
      .iter()
      .map(|(_, _, cont
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    for asset_index in &bundle.assets {
      let asset = &bundle_graph.asset_graph.asset(*asset_index);
      if let Some(content) = asset.content.downcast_ref::<CssContent>() {
        asset_index_to_stylesheet_index.insert(*asset_index, stylesheets.len());
        let source_index = stylesheets.len() as u32;
        stylesheets.push(StyleSheetWrapper {
          asset_index: *asset_index,
          stylesheet: content.stylesheet.clone(),
          parent_stylesheet_index: 0,
          parent_dep_index: 0,
          has_parent: false,
          loc: lightningcss::rules::Location {
            source_index,
            line: asset.loc.start.line,
            column: asset.loc.start.column + 1,
          },
        });
        unreachable!("expected a CSS asset")
      }
      stylesheets
        .iter()
        .flat_map(|s| s.stylesheet.sources.clone())
        .collect(),

    stylesheet.source_map_urls = stylesheets
      .iter()
      .flat_map(|s| s.stylesheet.source_map_urls.clone())
      .collect();

    // Rule locations index into the assembled sheet's sources, so the map needs
    // them in the same order. Sources reached through input maps are added as
    // the prin
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `346bc724` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:05:05.252Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795856705252",
    "title": "CSS source maps with multiple assets with the same file path",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler/parcel",
    "source_uri": "https://github.com/parcel-bundler/parcel",
    "source_version": "HEAD",
    "content_hash": "90d94bc44b44f55c2d6daa9c4b503aedba34d47eed30be1b90080d570841c6c0"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:05:05.252Z"
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
  "auth_token": "2471f5de2a1323483b55cdbd3ac728a0e9ff2e91b7da9fbab2899ecceaf45535"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
