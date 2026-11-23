# Candidate Directive: [CD-RD13] meta: keep an O_TMPFILE inode alive after linkat

<!-- PROVENANCE_START
{
  "source_repository": "juicedata-juicefs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T16:11:54.292Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-juicedata-juicefs-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata-juicefs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T16:11:54.292Z`  
> **Learning ID**: `LEARN-EVO-juicedata-juicefs-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T16:11:54.418Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795450314418",
    "title": "meta: keep an O_TMPFILE inode alive after linkat",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata-juicefs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "45f4af55ae5f38fbd71d0261a2a0c775f425ca92ce33668b469f3dfbd37f8622"
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
        "Harvested/verified timestamp recorded: 2026-11-23T16:11:54.419Z"
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
  "auth_token": "89a79aacbb491c31ed28eab0973c93b2a62c613ee1c06287bbde91b59f1f4acb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
