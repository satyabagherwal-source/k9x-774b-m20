# Candidate Directive: [CD-BNT1] Atomic Work-Claim Invariant in Parallel Rayon Graph Traversals

<!-- PROVENANCE_START
{
  "source_repository": "biomejs/biome",
  "source_url": "https://github.com/biomejs/biome",
  "source_version": "c199c75a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T09:34:28.165Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-biomejs-biome",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs/biome](https://github.com/biomejs/biome) (Revision: `c199c75a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T09:34:28.165Z`  
> **Learning ID**: `learn-github-biomejs-biome`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        if lock.contains(&path) {
            return;
        }
        lock.insert(path.clone());
        drop(lock);

        // Heavy I/O and further redundant spawns already executed!
        process_path(&path);
    });
}
```

**VERIFICATION METHOD**:
Implement a single-threaded deterministic test harness using a mock file system (`MemoryFileSystem`) equipped with atomic access counters (`AtomicUsize` or `Mutex<FxHashMap<Path, usize>>`). Assert that the invocation count for opening and indexing any given file is strictly equal to `1`, regardless of whether imports are arranged in diamond patterns or reciprocal cycles.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:34:28.163Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772068163",
    "title": "Atomic Work-Claim Invariant in Parallel Rayon Graph Traversals",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs/biome",
    "source_uri": "https://github.com/biomejs/biome",
    "source_version": "HEAD",
    "content_hash": "d2806f4429ec047794603632ca1a27fe872b722782ec7fe86a7d07d2aeaf8bad"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:34:28.163Z"
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
  "auth_token": "a7935ab7982e25724302d79d1597baa6c96aace631220b4ff3e9d1a94e7ed52b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
