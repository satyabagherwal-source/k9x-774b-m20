---
id: "CD-094"
directive_title: "Stream & AsyncIterable Collection Bound Limitation"
source_type: "engineering_gap_feedback"
source_repo: "canonical_task_execution"
source_commit: "task-task1-collection-bound"
date_staged: "2026-10-11"
trigger_tags: ["engineering_gap","missing_knowledge","streams","async_iterators","collection_bounds"]
status: "STAGED_FOR_VERIFICATION"
---

# CD-094: Stream & AsyncIterable Collection Bound Limitation

## 1. Discovered Failure Mode & Root Cause
[MISSING_KNOWLEDGE] Rule 306 fails when applied to stream/async generators where .length is undefined upfront.

## 2. Forensic Code Evidence
```diff
- // Defective implementation:
- if (stream.length > MAX) // stream.length is undefined!
+ // Verified safe invariant:
+ Wrap async iterable in counting iterator or sliding buffer; abort as soon as count exceeds MAX_BOUND.
```

## 3. Universal Reusability Invariant
Wrap async iterable in counting iterator or sliding buffer; abort as soon as count exceeds MAX_BOUND.

## 4. Verification Gate Criteria
- [ ] Reproducible with empirical test or commit diff
- [ ] Anti-pattern and negative constraints formulated
- [ ] Verified via live build probe
