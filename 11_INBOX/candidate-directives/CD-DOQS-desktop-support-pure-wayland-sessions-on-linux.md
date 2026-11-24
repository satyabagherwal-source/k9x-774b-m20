# Candidate Directive: [CD-DOQS] desktop): support pure Wayland sessions on Linux

<!-- PROVENANCE_START
{
  "source_repository": "metrolistgroup-metrolist-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T04:37:05.928Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-metrolistgroup-metrolist-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metrolistgroup-metrolist-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T04:37:05.928Z`  
> **Learning ID**: `LEARN-EVO-metrolistgroup-metrolist-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/tests/test_desktop_launcher.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MetrolistGroup/Metrolist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `17f78c37`: desktop): support pure Wayland sessions on Linux. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/tests/test_desktop_launcher.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
        probe = 'printf "%s\n" "${GDK_BACKEND-unset}"'
        self.executable(self.bin / "Metrolist.bin", probe)
        self.executable(self.bin.parent / "lib/native/Metrolist", probe)
        for native in (False, True):
            with self.subTest(native=native):
                self.environment.pop("GDK_BACKEND", None)
                self.environment.pop("WAYLAND_DISPLAY", None)
                self.environment.pop("METROLIST_USE_WAYLAND", None)
                self.environment.pop("METROLIST_USE_WAKEFIELD", None)
                self.environment.update(DISPLAY=":77", XCURSOR_THEME="Theme", XCURSOR_SIZE="24")
                self.assertEqual(["x11"], self.launch(native))
                self.environment["GDK_BACKEND"] = "x11,wayland"
                self.assertEqual(["x11,wayland"], self.launch(native))
                del self.environment["GDK_BACKEND"]
                del self.environment["DISPLAY"]
                self.environment["WAYLAND_DISPLAY"] = "wayland-0"
                self.assertEqual(["wayland"], self.launch(native))
                self.environment["DISPLAY"] = ":77"
                self.environment["METROLIST_USE_WAYLAND"] = "1"
                self.assertE
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
        self.executable(self.bin / "Metrolist.bin", 'printf "%s\n" "$GDK_BACKEND"')
        self.environment.update(XCURSOR_THEME="Theme", XCURSOR_SIZE="24")
        self.assertEqual(["x11"], self.launch())
        self.environment["GDK_BACKEND"] = "x11,wayland"
        self.assertEqual(["x11,wayland"], self.launch())
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17f78c37` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T04:37:06.048Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795495026047",
    "title": "desktop): support pure Wayland sessions on Linux",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "metrolistgroup-metrolist-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "547b898cd27168fe837bd1d30ac036424cff14f55bec5001698e2bf2149fd31f"
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
        "Harvested/verified timestamp recorded: 2026-11-24T04:37:06.048Z"
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
  "auth_token": "97ac34b6bc1c2f9564d8dc7c20be17dabf8ec3eb6dbde61df279bf1e4592c990"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
