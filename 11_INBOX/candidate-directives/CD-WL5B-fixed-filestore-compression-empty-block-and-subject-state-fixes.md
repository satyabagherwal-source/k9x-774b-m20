# Candidate Directive: [CD-WL5B] [FIXED] Filestore compression, empty block and subject state fixes

<!-- PROVENANCE_START
{
  "source_repository": "nats-io/nats-server",
  "source_url": "https://github.com/nats-io/nats-server",
  "source_version": "a0385c9a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T17:20:56.591Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nats-io-nats-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nats-io/nats-server](https://github.com/nats-io/nats-server) (Revision: `a0385c9a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T17:20:56.591Z`  
> **Learning ID**: `learn-github-nats-io-nats-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `server/filestore.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nats-io/nats-server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `20df9dfc`: [FIXED] Filestore compression, empty block and subject state fixes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/filestore.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		firstWithMsgs := fs.state.Msgs == 0 && mb.msgs > 0
		if fs.state.FirstSeq == 0 || firstWithMsgs || (fseq < fs.state.FirstSeq && mb.first.ts != 0) {
		if lseq := atomic.LoadUint64(&mb.last.seq); lseq > fs.state.LastSeq || (lseq == fs.state.LastSeq && mb.last.ts != 0) {
	// Without messages the first sequence comes after the last, not where an empty block starts.
	if fs.state.Msgs == 0 {
		fs.state.FirstSeq = fs.state.LastSeq + 1
		fs.state.FirstTime = time.Time{}
	}
		buf, err := mb.loadBlock(nil)
		if err != nil {
			return err
		}
		// An empty block has nothing to convert, it only needs new keys.
		if len(buf) == 0 {
			recycleMsgBlockBuf(buf)
			return fs.genEncryptionKeysForBlock(mb)
		}
	// An empty block has nothing to convert.
	if len(buf) == 0 {
		recycleMsgBlockBuf(buf)
		return nil
	}
	var alg StoreCompression
	if buf, alg, err = mb.decode(buf); err != nil {
	// Remember how the block is stored on disk, since it isn't recovered otherwise.
	mb.cmp = alg
		// A compressed block can't be appended to, new records would be written uncompressed.
		// It ends up as the last block if the one after it was empty and got removed above.
		fs.lmb.mu.RLock()
		compressed := fs.lmb.cm
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		if fs.state.FirstSeq == 0 || (fseq < fs.state.FirstSeq && mb.first.ts != 0) {
		if lseq := atomic.LoadUint64(&mb.last.seq); lseq >= fs.state.LastSeq {
		buf, _ := mb.loadBlock(nil)
	if buf, err = mb.decompressIfNeeded(buf); err != nil {
		go func() {
			fs.mu.Lock()
			defer fs.mu.Unlock()
			if !wc {
				if info, ok := fs.psim.Find(stringToBytes(filter)); ok {
					if i > info.fblk {
						info.fblk = i
					}
				}
			} else {
				fs.psim.Match(stringToBytes(filter), func(subj []byte, psi *psi) {
					if i > psi.fblk {
						psi.fblk = i
					}
				})
			}
		}()
		if mb = fs.bim[stop]; mb != nil {
			_, _, l, err := mb.filteredPending(filter, wc, 0)
			if err != nil {
				return err
			}
			ss.Last = l
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `20df9dfc` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T17:20:56.589Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795195256589",
    "title": "[FIXED] Filestore compression, empty block and subject state fixes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nats-io/nats-server",
    "source_uri": "https://github.com/nats-io/nats-server",
    "source_version": "HEAD",
    "content_hash": "c45afd434ed97b5194903ee36243ac8e9ba840a164ee8d6803a419d77b3b8ed8"
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:20:56.589Z"
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
  "auth_token": "de94f24cb45daf900d344de3e02269c1d1b6d1da7137782a214f1b6055a437ac"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
