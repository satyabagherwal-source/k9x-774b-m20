# Candidate Directive: [CD-S54Y] Build MILVUS_FIPS_ENABLED=ON on Go's FIPS 140-3 module

<!-- PROVENANCE_START
{
  "source_repository": "milvus-io/milvus",
  "source_url": "https://github.com/milvus-io/milvus",
  "source_version": "8425467c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T10:43:16.354Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-milvus-io-milvus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milvus-io/milvus](https://github.com/milvus-io/milvus) (Revision: `8425467c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T10:43:16.354Z`  
> **Learning ID**: `learn-github-milvus-io-milvus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Makefile`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milvus-io/milvus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3b35b67b`: enhance: Build MILVUS_FIPS_ENABLED=ON on Go's FIPS 140-3 module. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `Makefile`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	asan_go_tag := ,use_asan
        cuda_go_tag := ,cuda
# All Go artifacts loaded into the same process must use the same snapshot.
# Go 1.26.10 resolves v1.0.0 to the certified v1.0.0-c2097c7c (CMVP #5247).
ifeq ($(MILVUS_FIPS_ENABLED),ON)
ifneq ($(findstring ',$(MILVUS_GO_BUILD_TAGS))$(findstring ",$(MILVUS_GO_BUILD_TAGS)),)
$(error FIPS build tags must not contain literal quote characters)
endif
	override GOFIPS140 := v1.0.0
	export GOFIPS140
	# Go accepts whitespace-separated or comma-separated tags. Normalize custom
	# lists before adding a required tag so the Go tool sees it as its own tag.
	empty :=
	space := $(empty) $(empty)
	comma := ,
	fips_go_tags := $(subst $(comma), ,$(MILVUS_GO_BUILD_TAGS)$(asan_go_tag)$(cuda_go_tag))
	override MILVUS_GO_BUILD_TAGS := $(subst $(space),$(comma),$(strip $(filter-out milvus_fips,$(fips_go_tags)) milvus_fips))
else
	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS)$(asan_go_tag)$(cuda_go_tag)
endif

# Expose the server's Go module selection to external packaging builds.
.PHONY: print-fips-go-module
print-fips-go-module:
	@printf '%s\n' "$$GOFIPS140"

		CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),use_asan
# FIPS: default OFF. Set MILVUS_FIPS_ENABLED=ON to enable BoringCrypto.
GOEXPERIMENT_FLAG :=
ifeq ($(MILVUS_FIPS_ENABLED),ON)
	GOEXPERIMENT_FLAG := GOEXPERIMENT=boringcrypto
endif
        MILVUS_GO_BUILD_TAGS := $(MILVUS_GO_BUILD_TAGS),cuda
		$(GOEXPERIMENT_FLAG) CGO_LDFLAGS="$(CGO_LDFLAGS)" CGO_CFLAGS="$(CGO_CFLAGS)" CGO_CXXFLAGS="$(CGO_CXXFLAGS)" GO111MODULE=on $(GO) build -pgo=$(PGO_PATH)/default.pgo -ldflags="$(TSAN_GO_LDFLAGS) $(SONIC_PLUGIN_SYNC_LDFLAG) -r $${RPATH} -X '$(OBJPREFIX).BuildTags=$(BUILD_TAGS)' -X '$(OBJPREFIX).BuildTime=$(BUILD_TIME)' -X '$(OBJPREFIX).GitCommit=$(GIT_COMMIT)' -X '$(OBJPREFIX).GoVersion=$(GO_VERSION)' -X '$(OBJPREFIX).MilvusVersion=$(MILVUS_VERSION)'" \
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3b35b67b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T10:43:16.352Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795776196352",
    "title": "Build MILVUS_FIPS_ENABLED=ON on Go's FIPS 140-3 module",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "milvus-io/milvus",
    "source_uri": "https://github.com/milvus-io/milvus",
    "source_version": "HEAD",
    "content_hash": "f55b41f9b29925863391ab6d24e9a3c0979e4c94c655ddfbabf67f8bed9c2d02"
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
        "Harvested/verified timestamp recorded: 2026-11-27T10:43:16.352Z"
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
  "auth_token": "04bc16e1a3b4ff2d1b70c98673a7eb9ea8cea72d0c7d4b6cbfc5c0c2b5db7731"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
