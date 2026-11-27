# Candidate Directive: [CD-BRBC] Atomic Work-Claim Invariant in Parallel Rayon Graph Traversals

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:34:32.545Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:34:32.545Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When traversing cyclical or diamond dependency graphs inside parallel scopes (such as `rayon::scope`), worker threads MUST atomically test and claim ownership of a node ID or canonical path *prior* to spawning asynchronous work tasks. Subsystem scanners MUST NOT delegate deduplication checks downstream to child tasks or rely on non-atomic read-then-spawn pipelines.

**WHY**:
In a multithreaded Rayon scheduler, thread-pool work stealing causes uncoordinated downstream tasks to race. If checking whether a task has already been scheduled occurs *inside* the child task rather than at the scheduling call-site, multiple parents that discover the same node will concurrently spawn redundant sub-trees. This leads to duplicate disk I/O, cache thrashing, high memory allocation, and potential non-termination if circular dependencies are resolved slower than Rayon distributes child tasks.

**WHEN TO APPLY**:
Apply to any multi-threaded crawler, dependency scanner, AST visitor, or file traversal system utilizing Rayon, Tokio, or worker thread pools traversing shared DAGs or cyclic graphs.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use camino::{Utf8Path, Utf8PathBuf};
use rayon::Scope;
use scc::HashSet;

pub struct ScanContext<'a> {
    pub scheduled: &'a HashSet<Utf8PathBuf>,
}

pub fn traverse_dependencies<'a>(
    s: &Scope<'a>,
    ctx: &'a ScanContext<'a>,
    dependency_path: Utf8PathBuf,
) {
    // ATOMIC PRE-CONDITION: Must test and acquire claim in the concurrent set
    // prior to submitting work to the Rayon scheduler.
    // .insert() returns true ONLY for the first thread that registers the key.
    if !ctx.scheduled.pin().insert(dependency_path.clone()) {
        return;
    }

    s.spawn(move |child_scope| {
        let child_dependencies = resolve_direct_imports(&dependency_path);
        for child_path in child_dependencies {
            // Recurse using the same atomic claim invariant
            traverse_dependencies(child_scope, ctx, child_path);
        }
    });
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Spawning work before claiming/checking.
// Leads to thread races where multiple tasks spawn redundant indexers.
pub fn buggy_traverse<'a>(s: &Scope<'a>, scheduled: &'a Mutex<HashSet<Utf8PathBuf>>, path: Utf8PathBuf) {
    s.spawn(move |child_scope| {
        // RACE CONDITION: Multiple threads already spawned for the same path
        let mut lock = scheduled.lock().unwrap();

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:34:32.707Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772072707",
    "title": "Atomic Work-Claim Invariant in Parallel Rayon Graph Traversals",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs-biome-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6abad5740a905f041863720d65bee73e1982bf244a9c5bdd75b1b373c8e2c471"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:34:32.708Z"
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
  "auth_token": "a4a568aa8ee6685364935355991d399bc37ed453d4a2afa78b1444a382c96d82"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
