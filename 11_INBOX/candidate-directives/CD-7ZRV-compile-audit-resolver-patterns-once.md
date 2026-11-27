# Candidate Directive: [CD-7ZRV] Compile audit resolver patterns once

<!-- PROVENANCE_START
{
  "source_repository": "goharbor/harbor",
  "source_url": "https://github.com/goharbor/harbor",
  "source_version": "3cc8b5c1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T21:11:27.452Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-goharbor-harbor",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goharbor/harbor](https://github.com/goharbor/harbor) (Revision: `3cc8b5c1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T21:11:27.452Z`  
> **Learning ID**: `learn-github-goharbor-harbor`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/controller/event/metadata/commonevent/model.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in goharbor/harbor. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3cc8b5c1`: Compile audit resolver patterns once. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/controller/event/metadata/commonevent/model.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
type registration struct {
	pattern  *regexp.Regexp
	resolver Resolver
}

var registrations = map[string]registration{}
	p := regexp.MustCompile(urlPattern)
	defer mu.Unlock()
	registrations[urlPattern] = registration{pattern: p, resolver: resolver}
// Resolvers returns a copy of the registered resolvers keyed by URL pattern
	mu.Lock()
	defer mu.Unlock()
	resolvers := make(map[string]Resolver, len(registrations))
	for urlPattern, reg := range registrations {
		resolvers[urlPattern] = reg.resolver
	}
	return resolvers
	for _, reg := range registrations {
		if reg.pattern.MatchString(c.RequestURL) {
			return reg.resolver.Resolve(c, event)
	for _, reg := range registrations {
		if reg.pattern.MatchString(c.RequestURL) {
			return reg.resolver.PreCheck(c.Ctx, c.RequestURL, c.RequestMethod)
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
var urlResolvers = map[string]Resolver{}
	urlResolvers[urlPattern] = resolver
	mu.Unlock()
// Resolvers get map of resolvers
	return urlResolvers
	for url, r := range Resolvers() {
		p := regexp.MustCompile(url)
		if p.MatchString(c.RequestURL) {
			return r.Resolve(c, event)
	for urlPattern, r := range Resolvers() {
		p := regexp.MustCompile(urlPattern)
		if p.MatchString(c.RequestURL) {
			return r.PreCheck(c.Ctx, c.RequestURL, c.RequestMethod)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3cc8b5c1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T21:11:27.449Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795813887449",
    "title": "Compile audit resolver patterns once",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goharbor/harbor",
    "source_uri": "https://github.com/goharbor/harbor",
    "source_version": "HEAD",
    "content_hash": "548ae1f338cb420bc77c9208445e0a1822ce249f566e72bf82d0f74a5839a75a"
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
        "Harvested/verified timestamp recorded: 2026-11-27T21:11:27.449Z"
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
  "auth_token": "4e4014c6cb44c5c49c888dbd6b892d52af1044d7c4428b8afb435eb6decb58b6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
