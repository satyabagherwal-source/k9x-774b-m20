# Candidate Directive: [CD-R9HH] keep an O_TMPFILE inode alive after linkat

<!-- PROVENANCE_START
{
  "source_repository": "juicedata/juicefs",
  "source_url": "https://github.com/juicedata/juicefs",
  "source_version": "6118713b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T16:11:49.829Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-juicedata-juicefs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata/juicefs](https://github.com/juicedata/juicefs) (Revision: `6118713b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T16:11:49.829Z`  
> **Learning ID**: `learn-github-juicedata-juicefs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/meta/base_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in juicedata/juicefs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6118713b`: meta: keep an O_TMPFILE inode alive after linkat. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/meta/base_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"slices"
	testLinkOpenUnlinkedFile(t, m)
// testLinkOpenUnlinkedFile follows what O_TMPFILE and linkat do: the file
// must keep its new name after the last close, and its length counts once,
// in the directory it was linked into.
func testLinkOpenUnlinkedFile(t *testing.T, m Meta) {
	m.getBase().sid = 0
	if err := m.NewSession(true); err != nil {
		t.Fatalf("new session: %s", err)
	}
	defer m.CloseSession()
	ctx := Background()
	var tmpdir, dir, inode Ino
	var attr = &Attr{}
	if st := m.Mkdir(ctx, 1, "tmpdir", 0755, 022, 0, &tmpdir, attr); st != 0 {
		t.Fatalf("mkdir tmpdir: %s", st)
	}
	if st := m.Mkdir(ctx, 1, "linkdir", 0755, 022, 0, &dir, attr); st != 0 {
		t.Fatalf("mkdir linkdir: %s", st)
	}
	if st := m.Create(ctx, tmpdir, "tmpfile", 0644, 022, 0, &inode, attr); st != 0 {
		t.Fatalf("create tmpfile: %s", st)
	}
	if st := m.Unlink(ctx, tmpdir, "tmpfile", true); st != 0 {
		t.Fatalf("unlink tmpfile: %s", st)
	}
	var sliceId uint64
	if st := m.NewSlice(ctx, &sliceId); st != 0 {
		t.Fatalf("new slice: %s", st)
	}
	if st := m.Write(ctx, inode, 0, 0, Slice{Id: sliceId, Size: 8192, Len: 8192}, time.Now()); st != 0 {
		t.Fatalf("write tmpfile: %s", st)
	}
	if st := m.SetXattr(ctx,
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6118713b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T16:11:49.826Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795450309826",
    "title": "keep an O_TMPFILE inode alive after linkat",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata/juicefs",
    "source_uri": "https://github.com/juicedata/juicefs",
    "source_version": "HEAD",
    "content_hash": "0c161d3856db6af40316962c65e1bcfee480e4bfd77b24344dce06bcf2644e63"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-23T16:11:49.826Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a6cccc0900cf7f6d199d85a07bde3ca7b8d07821fb7e768d4c8a0a85606bc658"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
