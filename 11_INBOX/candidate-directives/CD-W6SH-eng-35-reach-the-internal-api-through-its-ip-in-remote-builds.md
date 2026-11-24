# Candidate Directive: [CD-W6SH] ENG-35: Reach the internal API through its IP in remote builds

<!-- PROVENANCE_START
{
  "source_repository": "okteto-okteto-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T01:07:32.170Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-okteto-okteto-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [okteto-okteto-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T01:07:32.170Z`  
> **Learning ID**: `LEARN-EVO-okteto-okteto-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cmd/remoterun/catalog.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in okteto/okteto. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `55998c4b`: ENG-35: Reach the internal API through its IP in remote builds. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/remoterun/catalog.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"net"
	"net/url"
	"github.com/okteto/okteto/pkg/constants"
// catalog secret variables from the endpoint through the internal IP of the
// Okteto API, with the token, or with the user's token when it's empty
type catalogSecretVariablesClientFactory func(endpoint, internalAPIIP, token string) (catalogSecretVariablesGetter, error)
	// internalAPIIP is the internal IP of the Okteto API that the CLI starting
	// the remote build passes on, empty when the installation doesn't publish it
	internalAPIIP string
// errCatalogSecretVariablesEndpointNotHTTPS is returned when the endpoint
// isn't https, so the request isn't sent. Only the first installations with
// catalog secret variables give an http endpoint, which remote builds can't
// reach
var errCatalogSecretVariablesEndpointNotHTTPS = errors.New("the catalog secret variables can't be fetched: the Okteto installation gives an endpoint that isn't https")

// internalAPIIPMissingError is returned when the remote build doesn't get a
// valid internal IP of the Okteto API to reach the endpoint through, so the
// request isn't sent
type internalAPIIPMissingError struct {
	hostname string
}

func (e internalAPIIPMissingError) Error() stri
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// catalog secret variables with the token, or with the user's token when it's
// empty
type catalogSecretVariablesClientFactory func(token string) (catalogSecretVariablesGetter, error)
// installations takes. It reaches the endpoint directly, ignoring the proxy
// env vars, with the TLS settings of the context
func newCatalogSecretVariablesClient(token string) (catalogSecretVariablesGetter, error) {
	opts := []okteto.Option{okteto.WithoutProxy()}
	oktetoClient, err := okteto.NewOktetoClient(opts...)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T01:07:32.320Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795482452320",
    "title": "ENG-35: Reach the internal API through its IP in remote builds",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "okteto-okteto-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0097d323a06080c51b0af43cb59a1cfdc7abed400099b5a787fdb00de6efd7ad"
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
        "Harvested/verified timestamp recorded: 2026-11-24T01:07:32.321Z"
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
  "auth_token": "6eece4c0047fabfb067cc3c12afb6f4a218b4e45366769c5cb40c1226438f0e1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
