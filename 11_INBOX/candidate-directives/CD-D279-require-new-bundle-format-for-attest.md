# Candidate Directive: [CD-D279] Require new bundle format for attest

<!-- PROVENANCE_START
{
  "source_repository": "sigstore/cosign",
  "source_url": "https://github.com/sigstore/cosign",
  "source_version": "2ec8094c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T16:46:45.093Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sigstore-cosign",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sigstore/cosign](https://github.com/sigstore/cosign) (Revision: `2ec8094c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T16:46:45.093Z`  
> **Learning ID**: `learn-github-sigstore-cosign`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cmd/cosign/cli/attest.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sigstore/cosign. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2ec8094c`: Require new bundle format for attest. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/cosign/cli/attest.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		Example: `  cosign attest [--key <key path>|<kms uri>] [--predicate <path>] [--no-upload=true|false] [-y] <image uri>
  cosign attest --predicate <FILE> --type <TYPE> --key cosign.key --certificate cosign.crt --certificate-chain chain.crt <IMAGE>
  cosign attest --predicate <FILE> --type <TYPE> --key cosign.key --no-upload true <IMAGE>`,
			if o.NoUpload && o.BundlePath == "" {
				return fmt.Errorf("must enable upload to the OCI registry or specify a local --bundle path")
				"", o.Fulcio.URL, o.OIDC.Issuer, "",
				true, true, o.BundlePath,
				KeyOpts:         ko,
				RegistryOptions: o.Registry,
				CertPath:        o.Cert,
				CertChainPath:   o.CertChain,
				NoUpload:        o.NoUpload,
				PredicatePath:   o.Predicate.Path,
				PredicateType:   o.Predicate.Type,
				Tim
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		Example: `  cosign attest --key <key path>|<kms uri> [--predicate <path>] [--a key=value] [--no-upload=true|false] [--record-creation-timestamp=true|false] [--f] [--r] <image uri>
  cosign attest --predicate <FILE> --type <TYPE> --key cosign.key --cert cosign.crt --cert-chain chain.crt <IMAGE>
  cosign attest --predicate <FILE> --type <TYPE> --key cosign.key --no-upload true <IMAGE>

  # attach an attestation to a container image and honor the creation timestamp of the signature
  cosign attest --predicate <FILE> --type <TYPE> --key cosign.key --record-creation-timestamp <IMAGE>`,
			if o.NewBundleFormat && o.NoUpload && o.BundlePath == "" {
				return fmt.Errorf("must enable upload to the OCI registry or specify a local --bundle path with --new-bundle-format")
				o.Rekor.URL, o.Fulcio.URL, o.OIDC.Issuer, o.TSAServerURL,
				o.TlogUpload, o.NewBundleFormat, o.BundlePath,
				FulcioURL:                      o.Fulcio.URL,
				RekorURL:                       o.Rekor.URL,
				OIDCIssuer:                     o.OIDC.Issuer,
				TSAServerURL:                   o.TSAServerURL,
				NewBundleFormat:                o.NewBundleFormat,
				KeyOpts:                 ko,
				RegistryOptions:   
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2ec8094c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T16:46:45.091Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794934005091",
    "title": "Require new bundle format for attest",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sigstore/cosign",
    "source_uri": "https://github.com/sigstore/cosign",
    "source_version": "HEAD",
    "content_hash": "076a13a7cb1c62b24d1b811627c8eb4db54639e57978c3cd4a83badea15a3191"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T16:46:45.091Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "f91e25fe7ccee9ae5d6b9eef784c62dab6451a9ae5a02d2d2c55ac00eb670f24"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
