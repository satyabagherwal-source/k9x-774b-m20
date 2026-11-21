# Candidate Directive: [CD-IHBR] check repository policy before skipping a shared Maven mirror

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity/trivy",
  "source_url": "https://github.com/aquasecurity/trivy",
  "source_version": "edf9f5c1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T02:57:50.391Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aquasecurity-trivy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity/trivy](https://github.com/aquasecurity/trivy) (Revision: `edf9f5c1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T02:57:50.391Z`  
> **Learning ID**: `learn-github-aquasecurity-trivy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/dependency/parser/java/pom/mirror_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aquasecurity/trivy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `edf9f5c1`: java): check repository policy before skipping a shared Maven mirror. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/dependency/parser/java/pom/mirror_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// Repositories with different release and snapshot policies can share one mirror.
// The mirror is requested for an artifact that only the second repository accepts.
func Test_fetchPOMFromRemoteRepositories_mirrorPolicy(t *testing.T) {
	releasesURL, err := url.Parse("https://releases.example.com/maven2/")
	require.NoError(t, err)
	snapshotsURL, err := url.Parse("https://snapshots.example.com/maven2/")
	require.NoError(t, err)
	releasesRepo := repository{id: "releases", url: *releasesURL, releaseEnabled: true}
	snapshotsRepo := repository{id: "snapshots", url: *snapshotsURL, snapshotEnabled: true}

	tests := []struct {
		name      string
		repos     []repository
		snapshot  bool
		version   string
		wantPaths []string
	}{
		{
			name:     "snapshot artifact, release-only repository first",
			repos:    []repository{releasesRepo, snapshotsRepo},
			snapshot: true,
			version:  "1.0.0-SNAPSHOT",
			wantPaths: []string{
				"/com/example/example-api/1.0.0-SNAPSHOT/maven-metadata.xml",
				"/com/example/example-api/1.0.0-SNAPSHOT/example-api-1.0.0-SNAPSHOT.pom",
			},
		},
		{
			name:    "release artifact, snapshot-only repository first",
			repos:   []repository{snapshotsRepo, relea
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `edf9f5c1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:57:50.389Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795229870389",
    "title": "check repository policy before skipping a shared Maven mirror",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity/trivy",
    "source_uri": "https://github.com/aquasecurity/trivy",
    "source_version": "HEAD",
    "content_hash": "dc46e6810b3490060138153ad85c214069240ff6b3f42ba9d6fabc2236ec548a"
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
        "Harvested/verified timestamp recorded: 2026-11-21T02:57:50.389Z"
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
  "auth_token": "e2725eb87ca986a2aea2296214ceaad2c704296bbcf9ddfc493054baaa088a75"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
