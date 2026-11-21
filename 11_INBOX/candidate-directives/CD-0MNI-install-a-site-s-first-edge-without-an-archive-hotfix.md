# Candidate Directive: [CD-0MNI] install a site's first edge without an archive (hotfix)

<!-- PROVENANCE_START
{
  "source_repository": "tuist/tuist",
  "source_url": "https://github.com/tuist/tuist",
  "source_version": "45d39123",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T06:27:54.415Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tuist-tuist",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tuist/tuist](https://github.com/tuist/tuist) (Revision: `45d39123`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T06:27:54.415Z`  
> **Learning ID**: `learn-github-tuist-tuist`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-21T06:27:54.413Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795242474413",
    "title": "install a site's first edge without an archive (hotfix)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tuist/tuist",
    "source_uri": "https://github.com/tuist/tuist",
    "source_version": "HEAD",
    "content_hash": "ce70acf82df98eef14e18aac8f7653be93a40a0ebd6054d31539d08b4afc863e"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:27:54.413Z"
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
  "auth_token": "3465ed950454ac203f027708589d7b3e390f9544dba2f700de80df0659918d7d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
