# Candidate Directive: [CD-WWN5] Asymmetric State Machine Cache Eviction with Probe Loop Guard

<!-- PROVENANCE_START
{
  "source_repository": "juicedata-juicefs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T07:05:19.813Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-juicedata-juicefs-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata-juicefs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T07:05:19.813Z`  
> **Learning ID**: `LEARN-EVO-juicedata-juicefs-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing an automated degraded-state machine for I/O devices (transitioning through `Normal`, `Unstable`, `Down`), recovery from `Unstable` to `Normal` MUST require an absolute volume minimum of successful I/O probes alongside a strictly bounded error percentage. The probe loop MUST operate on a dedicated timer-guarded worker channel and enforce concurrency caps during instability.

**WHY**:
Failing storage drives (NVMe/SSD) exhibit intermittent burst latency and sporadic I/O faults. If a state machine switches back from `Unstable` to `Normal` merely based on an elapsed time window or zero errors during an idle phase, user read/write workloads will immediately slam the degraded drive, triggering systemic queue saturation, FUSE thread lockups, and unhandled I/O timeouts.

**WHEN TO APPLY**:
Local caching tiers, multi-tier storage engines, distributed block volume attachments, or remote storage drivers implementing automatic fail-over and circuit breaking.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Language: Go
// Location: pkg/chunk/disk_cache_state.go

func (dc *unstableDC) tick() {
    go dc.probe()
    go func() {
        ticker := time.NewTicker(tickDurForUnstable)
        defer ticker.Stop()

        for {
            select {
            case <-dc.stopCh:
                return
            case <-ticker.C:
                errCnt := atomic.LoadUint32(&dc.ioErrCnt)
                ioCnt := atomic.LoadUint32(&dc.ioCnt)
                
                // CRITICAL DUAL-CONDITION:
                // 1. Must satisfy a minimum sample count (ioCnt >= minIOSuccToNormal)
                // 2. Error percentage must be under threshold (float64(errCnt)/float64(ioCnt) <= maxIOErrPercentageToNormal)
                if ioCnt >= minIOSuccToNormal && float64(errCnt)/float64(ioCnt) <= maxIOErrPercentageToNormal {
                    dc.cache.event(eventToNormal)
                } else if time.Since(dc.startTime) >= maxDurToDown {
                    dc.cache.event(eventToDown)
                } else {
                    // Reset sliding window counters for next evaluation tick
                    atomic.StoreUint32(&dc.ioErrCnt, 0)
                    atomic.StoreUint32(&dc.ioCnt, 0)
                }
            }
        }
    }()
}

// Bounded concurrency throttling while in unstable state
func (dc *unstableDC) checkCacheOp() error {
    if dc.concurrency.Load() >= maxConcurrencyForUnstable {
        return errUnstableCoLimit

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:05:19.937Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158319937",
    "title": "Asymmetric State Machine Cache Eviction with Probe Loop Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata-juicefs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c13b7e57ac1c75fd7046e8b864485c5c4cbf758cbd97ed0508037cce0413746a"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-20T07:05:19.937Z"
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
  "auth_token": "505454097a8d8519d8d36cb7623f97f243dfb3a72d986f94333dd443e5895239"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
