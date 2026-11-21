# Candidate Directive: [CD-0YG3] infra): install a site's first edge without an archive (hotfix)

<!-- PROVENANCE_START
{
  "source_repository": "tuist-tuist-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T06:28:09.591Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tuist-tuist-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tuist-tuist-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T06:28:09.591Z`  
> **Learning ID**: `LEARN-EVO-tuist-tuist-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `infra/cluster-api-provider-tuist/internal/rackinstall/seed.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tuist/tuist. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a182e968`: infra): install a site's first edge without an archive (hotfix). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Elixir data structures, boundary deserialization, API parsing, or resource lifecycles matching `infra/cluster-api-provider-tuist/internal/rackinstall/seed.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```elixir
// Verified production-grade fix pattern:
	// EdgeFirstWANBusybox is the installer's busybox, copied onto the edge for
	// its arping: the first edge of a site installs with no route to an
	// archive, so the install can bring no package the image lacks.
	EdgeFirstWANBusybox = "/usr/local/sbin/tuist-busybox"
		"@BUSYBOX@", EdgeFirstWANBusybox,
  if @BUSYBOX@ arping -D -q -c 2 -w 3 -I "$dev" "${address%/*}" && ip addr add "$address" dev "$dev"; then
    if @BUSYBOX@ arping -q -c 2 -w 3 -I "$dev" "$gateway" && ip route add default via "$gateway" dev "$dev" metric "$metric"; then
    if @BUSYBOX@ arping -q -c 2 -w 3 -I "$dev" "$gateway"; then
	return fmt.Sprintf("    - install -D -m 0755 \"$(command -v busybox)\" /target%s\n"+
		"    - |\n      cat > /target%s <<'TUIST_EOF'\n%s      TUIST_EOF\n      chmod 755 /target%s\n"+
		EdgeFirstWANBusybox, EdgeFirstWANPath, indent(script, "      "), EdgeFirstWANPath, indent(unit, "      "))
```

**NEGATIVE CONSTRAINT**:
```elixir
// Induced defect failure mode:
    - iputils-arping
  if arping -D -q -c 2 -w 3 -I "$dev" "${address%/*}" && ip addr add "$address" dev "$dev"; then
    if arping -q -c 2 -w 3 -I "$dev" "$gateway" && ip route add default via "$gateway" dev "$dev" metric "$metric"; then
    if arping -q -c 2 -w 3 -I "$dev" "$gateway"; then
	return fmt.Sprintf("    - |\n      cat > /target%s <<'TUIST_EOF'\n%s      TUIST_EOF\n      chmod 755 /target%s\n"+
		EdgeFirstWANPath, indent(script, "      "), EdgeFirstWANPath, indent(unit, "      "))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a182e968` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:28:09.695Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795242489695",
    "title": "infra): install a site's first edge without an archive (hotfix)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tuist-tuist-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f181037fb8c4b978f2cbb7606bbe799490d2ebd348a46896694ecea16edecaf0"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:28:09.696Z"
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
  "auth_token": "096cecc51ac53ae752ce9c4250d530202f54b57ed19bddffee88cb7a1fe779c5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
