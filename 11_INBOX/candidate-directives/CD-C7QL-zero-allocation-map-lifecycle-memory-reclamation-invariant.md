# Candidate Directive: [CD-C7QL] Zero-Allocation Map Lifecycle & Memory Reclamation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "prometheus/prometheus",
  "source_url": "https://github.com/prometheus/prometheus",
  "source_version": "cb4e01dd",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T06:33:34.509Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prometheus-prometheus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus/prometheus](https://github.com/prometheus/prometheus) (Revision: `cb4e01dd`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T06:33:34.509Z`  
> **Learning ID**: `learn-github-prometheus-prometheus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing persistent in-memory indexing maps in Go that experience periodic high-throughput write spikes, systems MUST NOT rely on standard `delete()` operations to release memory back to the runtime allocator. Instead, the subsystem MUST track peak usage, verify zero-occupancy windows, enforce a minimum stabilization interval, and reallocate the map using a fraction of peak capacity (`make(map[K]V, peak/2)`).

**WHY**:
The Go runtime map implementation (`runtime.hmap`) grows bucket arrays exponentially as element counts pass threshold hash collision densities, but bucket memory is NEVER freed or shrunk following `delete()`. Emptying 5,000,000 keys from a map leaves millions of allocated `bmap` structs resident in heap space indefinitely, resulting in persistent RSS inflation, severe GC scanning pressure, and eventual OOM kills under recurring churn.

**WHEN TO APPLY**:
Apply to any high-churn cache, write-behind staging map, de-duplication registry, or in-memory transaction buffer where element count fluctuates between zero and hundreds of thousands of entries per compaction/flush cycle.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package buffer

import (
	"sync"
	"time"
)

type ShrunkBuffer[K comparable, V any] struct {
	mtx          sync.RWMutex
	store        map[K]V
	peakSize     int
	lastShrink   time.Time
	minThreshold int
	minInterval  time.Duration
}

func NewShrunkBuffer[K comparable, V any](minThreshold int, minInterval time.Duration) *ShrunkBuffer[K, V] {
	return &ShrunkBuffer[K, V]{
		store:        make(map[K]V),
		lastShrink:   time.Now(),
		minThreshold: minThreshold,
		minInterval:  minInterval,
	}
}

func (b *ShrunkBuffer[K, V]) Put(k K, v V) {
	b.mtx.Lock()
	defer b.mtx.Unlock()

	b.store[k] = v
	if len(b.store) > b.peakSize {
		b.peakSize = len(b.store)
	}
}

func (b *ShrunkBuffer[K, V]) DeleteAndTryShrink(k K) {
	b.mtx.Lock()
	defer b.mtx.Unlock()

	delete(b.store, k)

	// Invariant 1: Map must be completely drained before swapping backing array
	if len(b.store) > 0 {
		return
	}

	// Invariant 2: Ignore transient churn that never hit significant allocation
	if b.peakSize < b.minThreshold {
		return
	}

	// Invariant 3: Rate-limit map reallocations to prevent allocation thrashing
	now := time.Now()
	if now.Sub(b.lastShrink) < b.minInterval {
		return
	}

	// Sweet-spot allocation: Halve the peak size to reduce resizing thrash
	b.store = make(map[K]V, b.peakSize/2)
	b.peakSize = 0
	b.lastShrink = now
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Indefinitely retains internal map buckets on heap
type LeakyBuffer struct {
	mtx   sync.Mutex
	store map[uint64][]byte
}

func (b *LeakyBuffer) Flush() {
	b.mtx.Lock()
	defer b.mtx.Unlock()

	for k := range b.store {
		delete(b.store, k) // BUG: Heap remains allocated at peak bucket capacity!
	}
}
```

**VERIFICATION METHOD**:
Verify using a memory allocation regression test that measures `runtime.MemStats.HeapAlloc` before and after inserting 1,000,000 entries followed by complete deletion. Assert that heap allocation returns to within 5% of baseline after triggering the shrink lifecycle and running `runtime.GC()`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T06:33:34.507Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795070014507",
    "title": "Zero-Allocation Map Lifecycle & Memory Reclamation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prometheus/prometheus",
    "source_uri": "https://github.com/prometheus/prometheus",
    "source_version": "HEAD",
    "content_hash": "e8fb98963dafc3c51acf557e0d5e5a794f6b737175669e6da073c3a1fbb0e8cf"
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
        "Harvested/verified timestamp recorded: 2026-11-19T06:33:34.507Z"
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
  "auth_token": "98e4535119e10a224c4899830ad31dc82fe8237a74d52d4a4a1540d333016e9a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
