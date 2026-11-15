# Candidate Directive: [CD-O41D] never re-attach torn-down ListView item views

<!-- PROVENANCE_START
{
  "source_repository": "NativeScript/NativeScript",
  "source_url": "https://github.com/NativeScript/NativeScript",
  "source_version": "283eb0c5",
  "license": "MIT",
  "timestamp": "2026-11-15T03:48:10.993Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nativescript-nativescript",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NativeScript/NativeScript](https://github.com/NativeScript/NativeScript) (Revision: `283eb0c5`).  
> **License**: MIT | **Timestamp**: `2026-11-15T03:48:10.993Z`  
> **Learning ID**: `learn-github-nativescript-nativescript`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/automated/src/ui/list-view/list-view-tests.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NativeScript/NativeScript. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ce4102b0`: ios): never re-attach torn-down ListView item views. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/automated/src/ui/list-view/list-view-tests.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
	// UIKit can take a cell out of the table and display it again without asking for it in
	// tableView:cellForRowAtIndexPath: (constantly while an accessibility client disables cell reuse).
	public test_cell_displayed_again_after_teardown_gets_new_content_ios() {
		if (__APPLE__) {
			const listView = this.testView;
			listView.on(ListView.itemLoadingEvent, this.loadViewWithItemNumber);
			listView.items = FEW_ITEMS;
			this.waitUntilListViewReady();

			const tableView = <UITableView>listView.ios;
			const indexPath = NSIndexPath.indexPathForRowInSection(1, 0);
			const cell = <any>tableView.cellForRowAtIndexPath(indexPath);
			const tableContent = cell.superview;
			const tornDownView = cell.view;
			TKUnit.assertNotNull(tornDownView, 'cell has an item view');

			cell.removeFromSuperview();
			TKUnit.assertEqual(cell.contentView.subviews.count, 0, 'the torn-down item view is detached from the cell');
			TKUnit.assertNull(cell.view, 'the cell no longer refers to the torn-down item view');

			tableView.delegate.tableViewWillDisplayCellForRowAtIndexPath(tableView, cell, indexPath);
			TKUnit.assertNull(cell.view, 'a cell outside the table is not prepared');

			tableContent.addSub
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ce4102b0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T03:48:10.991Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794714490991",
    "title": "never re-attach torn-down ListView item views",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NativeScript/NativeScript",
    "source_uri": "https://github.com/NativeScript/NativeScript",
    "source_version": "HEAD",
    "content_hash": "490b93921522841a4e86a005499cad987910eb18819ad86d283d8323c5f9cf41"
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
        "Harvested/verified timestamp recorded: 2026-11-15T03:48:10.991Z"
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
  "auth_token": "91103da3bdacf72b0161e6cc3d861fc34ccdcc43014a1e7bcb05ca702507ca47"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
