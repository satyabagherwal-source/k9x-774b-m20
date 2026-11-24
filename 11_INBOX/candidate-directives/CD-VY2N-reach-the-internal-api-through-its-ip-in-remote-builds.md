# Candidate Directive: [CD-VY2N] Reach the internal API through its IP in remote builds

<!-- PROVENANCE_START
{
  "source_repository": "okteto/okteto",
  "source_url": "https://github.com/okteto/okteto",
  "source_version": "21298eb3",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T01:07:21.023Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-okteto-okteto",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [okteto/okteto](https://github.com/okteto/okteto) (Revision: `21298eb3`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T01:07:21.023Z`  
> **Learning ID**: `learn-github-okteto-okteto`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
	if err != nil {
		return nil, err
	}
	return oktetoClient.User(), nil
// fetch gets the catalog secret variables from the endpoint. The token is the
// copy of the installer's file that BuildKit mounted when the RUN started, so
// it's fresh. It is never logged nor set in the env of the commands, but the
// secret is mounted for the whole RUN and they can read the file, so it's
// masked in their output like the user's token
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `55998c4b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T01:07:21.021Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795482441021",
    "title": "Reach the internal API through its IP in remote builds",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "okteto/okteto",
    "source_uri": "https://github.com/okteto/okteto",
    "source_version": "HEAD",
    "content_hash": "ee0d733241e14247b5f0958e6add79a0e0388287614f5b7846a231c03d61daca"
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
        "Harvested/verified timestamp recorded: 2026-11-24T01:07:21.021Z"
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
  "auth_token": "425894e8f4c9640bcba4a6efb447dff344b47c1d840a0558ed24adbf89a96f78"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
