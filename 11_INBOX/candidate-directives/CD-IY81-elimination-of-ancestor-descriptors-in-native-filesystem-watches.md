# Candidate Directive: [CD-IY81] Elimination of Ancestor Descriptors in Native Filesystem Watches

<!-- PROVENANCE_START
{
  "source_repository": "gitoxidelabs-gitoxide-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T02:51:31.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gitoxidelabs-gitoxide-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitoxidelabs-gitoxide-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T02:51:31.273Z`  
> **Learning ID**: `LEARN-EVO-gitoxidelabs-gitoxide-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Filesystem watchers monitoring deeply nested repositories **MUST NOT** register native kernel watches on ancestral directory paths above the verified canonical repository boundary (e.g., using macOS `kFSEventStreamCreateFlagWatchRoot` indiscriminately). Instead, watchers **MUST** resolve canonical physical roots, monitor only the reduced root paths, and validate root identity stability using periodic, non-scanning stat fences.

**WHY**:
Registering ancestor directory descriptors via OS-level APIs (such as Darwin's FSEvents `WatchRoot`) retains open file descriptors on all parent and sibling directories. In systems running concurrent repository workers, this leads to rapid file descriptor exhaustion (`EMFILE`), prevents clean unmounting of parent disks, and triggers duplicate cross-talk events when sibling directories are modified.

**WHEN TO APPLY**:
Filesystem event monitors, file watchers, language servers, and Git background workers across Linux (`inotify`), macOS (`FSEvents`), and Windows.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from gix-notify/src/backend/fsevents/mod.rs
// Loop guard with non-scanning stat check and timeout handling:
let mut checked = Instant::now();
loop {
    if options
        .root_check_interval
        .is_some_and(|interval| checked.elapsed() >= interval)
    {
        // Non-scanning O(1) inode/dev check on reduced roots
        let _ = check_roots(&mut stream, &sender);
        checked = Instant::now();
    }
    
    let timeout = options
        .root_check_interval
        .map(|interval| interval.saturating_sub(checked.elapsed()));
        
    let command = match timeout {
        Some(t) => receive.recv_timeout(t),
        None => receive.recv().map_err(|_| mpsc::RecvTimeoutError::Disconnected),
    };
    
    match command {
        Ok(Command::Replace(watches, reply)) => {
            // Explicit teardown of previous streams before recreation
            drop(stream.take());
            let replacement = Stream::new(&watches, sender.clone())?;
            stream = Some(replacement);
            let _ = reply.send(Ok(()));
        }
        Ok(Command::Synchronize { directory, generation, deadline, reply }) => {
            // Delivery fence with pre- and post-validation of root identities
            let result = check_roots(&mut stream, &sender).and_then(|()| {
                let s = stream.as_ref().ok_or(SynchronizeError::CoverageLost)?;
                let sync_res = s.synchronize_at(&directory, generation, deadline);
                check_roots(&mut stream, &sender)?;
                sync_res
            });

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:51:31.393Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794883891393",
    "title": "Elimination of Ancestor Descriptors in Native Filesystem Watches",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gitoxidelabs-gitoxide-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5702e7980b90d683e6b4886b4430b6a9343e90427a623225151c39c6ea45b072"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:51:31.393Z"
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
  "auth_token": "4b35589841278d28e29241a1576b5a6a3c7d01967819edf1ed1266c6bd658d82"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
