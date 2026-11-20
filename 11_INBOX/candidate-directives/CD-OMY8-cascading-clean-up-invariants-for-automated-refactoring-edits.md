# Candidate Directive: [CD-OMY8] Cascading Clean-up Invariants for Automated Refactoring Edits

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "202f6188",
  "license": "MIT",
  "timestamp": "2026-11-20T01:22:58.736Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `202f6188`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:22:58.736Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    // which breaks the build with TS2306.
    regex_replace(content, r"export\s*\{\s*a\s*\}", "");
}
```

**VERIFICATION METHOD**:
Execute end-to-end integration test with a barrel export pattern:
`index.ts -> barrel.ts (import { a } from './a'; export { a, b }) -> a.ts`.
Prune `a` from `index.ts`. Run fix pass 1, then fix pass 2. Verify `tsc` or `oxc` type-checking succeeds without `TS2306` or `TS2459`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:22:58.735Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137778735",
    "title": "Cascading Clean-up Invariants for Automated Refactoring Edits",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs/fallow",
    "source_uri": "https://github.com/fallow-rs/fallow",
    "source_version": "HEAD",
    "content_hash": "69e8e773281e838695988ce7e0338889961ee634c25fd68acb1a9ea9faca21a9"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:22:58.735Z"
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
  "auth_token": "8297cfdce7fb69032073c086a5ffd7ee3dca5b720e43ebe7061952f92b84128c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
