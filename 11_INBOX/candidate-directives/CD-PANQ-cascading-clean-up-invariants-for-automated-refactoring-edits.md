# Candidate Directive: [CD-PANQ] Cascading Clean-up Invariants for Automated Refactoring Edits

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs-fallow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:23:29.349Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fallow-rs-fallow-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs-fallow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:23:29.349Z`  
> **Learning ID**: `LEARN-EVO-fallow-rs-fallow-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an automated code-fixer removes a symbol from an export specifier list (`export { a, b }`), it MUST track the removed local name, compute the total intra-file reference count for that identifier, and atomically prune the associated `import` declaration if and only if all intra-file usages were exhausted by the removed export specifier.

**WHY**:
Export-list re-exports (`import { a } from './a'; export { a };`) bind local identifier references. If an automated fix removes `a` from the export list but leaves the `import`, the symbol becomes an unused local import. Subsequent dead-code passes will treat the origin export in `./a` as unreferenced, prune `./a`, and leave the kept import dangling, causing TypeScript compile failures `TS2306` ("Module has no exported member") or `TS2459`.

**WHEN TO APPLY**:
AST/CST automated refactoring tools, dead-code removers, and tree-shakers performing surgical text edits on ECMAScript/TypeScript source code.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub fn plan_import_removals(
    path: &Path,
    content: &str,
    line_ending: &str,
    removed_references: &FxHashMap<String, usize>,
) -> Vec<ImportRemoval> {
    if removed_references.is_empty() {
        return Vec::new();
    }
    let Some(found) = import_bindings(path, content) else {
        return Vec::new();
    };
    let line_starts = compute_line_starts(content, line_ending);

    found.declarations.iter().filter_map(|declaration| {
        let removable: Vec<bool> = declaration.bindings.iter().map(|binding| {
            removed_references.get(&binding.local).is_some_and(|removed_count| {
                // Invariant: Prune import ONLY when all references in the module
                // were accounted for by the pruned export list entries.
                found.reference_counts.get(&binding.local) == Some(removed_count)
            })
        }).collect();

        if !removable.contains(&true) {
            return None;
        }

        plan_declaration(content, line_ending, &line_starts, declaration, &removable)
    }).collect()
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER delete export specifiers in isolation without resolving binding consumers
pub fn remove_export_specifiers(content: &mut String, to_remove: &[String]) {
    // ANTI-PATTERN: Deleting export { a } leaves `import { a } from './a'` in place.
    // The next lint/fix run deletes `export function a() {}` from './a.ts',

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:23:29.462Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137809462",
    "title": "Cascading Clean-up Invariants for Automated Refactoring Edits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "487b40c17bd63def5e602e3af00799eae0038a740590c28217dec9d6bfe826c5"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:23:29.462Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "ea38716a49bc88f99703170bbfad2685108ca983bb6d1c2a69282c35ca6d4799"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
