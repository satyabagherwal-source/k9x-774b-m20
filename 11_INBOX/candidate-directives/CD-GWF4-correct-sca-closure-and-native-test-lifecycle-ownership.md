# Candidate Directive: [CD-GWF4] correct SCA closure and native test lifecycle ownership

<!-- PROVENANCE_START
{
  "source_repository": "matrixorigin/matrixone",
  "source_url": "https://github.com/matrixorigin/matrixone",
  "source_version": "f70c37b1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T17:14:23.392Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-matrixorigin-matrixone",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [matrixorigin/matrixone](https://github.com/matrixorigin/matrixone) (Revision: `f70c37b1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T17:14:23.392Z`  
> **Learning ID**: `learn-github-matrixorigin-matrixone`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/ci/static-analysis.cjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in matrixorigin/matrixone. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1893e5a`: ci): correct SCA closure and native test lifecycle ownership. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/ci/static-analysis.cjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
const inventoryFields = 'Name,ImportPath,Dir,Module,Imports,' +
  // Imports already resolves production, internal-test and external-test
  // variants. Keep those identities until traversal ends: a test importer does
  // not make its owner's unchanged production consumers affected.
    for (const imported of record.imports || []) {
      if (!variants.has(imported)) {
      if (!reverse.has(imported)) reverse.set(imported, new Set());
      reverse.get(imported).add(record.id);
  const production = new Set();
    if (!file.endsWith('_test.go')) production.add(owner);
  // A changed production source belongs to every active variant of its owner.
  const pending = [];
  for (const [id, owner] of variants) {
    if (production.has(owner)) pending.push(id);
  }
  const seen = new Set(pending);
  for (let i = 0; i < pending.length; i++) {
    for (const consumer of reverse.get(pending[i]) || []) {
      selected.add(variants.get(consumer));
        pending.push(consumer);
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
const inventoryFields = 'Name,ImportPath,Dir,Module,Imports,TestImports,XTestImports,' +
            testImports: p.TestImports || [], xTestImports: p.XTestImports || [],
    const owner = variants.get(record.id);
    for (const imported of [...(record.imports || []), ...(record.testImports || []),
      ...(record.xTestImports || [])]) {
      const dependency = variants.get(imported);
      if (!dependency) {
      if (!reverse.has(dependency)) reverse.set(dependency, new Set());
      reverse.get(dependency).add(owner);
  const production = [];
    if (!file.endsWith('_test.go')) production.push(owner);
  const seen = new Set(production);
  for (let i = 0; i < production.length; i++) {
    for (const consumer of reverse.get(production[i]) || []) {
      selected.add(consumer);
        production.push(consumer);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1893e5a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T17:14:23.390Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794762863390",
    "title": "correct SCA closure and native test lifecycle ownership",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "matrixorigin/matrixone",
    "source_uri": "https://github.com/matrixorigin/matrixone",
    "source_version": "HEAD",
    "content_hash": "fcf1056ddba88b12044d656a38a644d67a1504314ff0ddb50edd17df04b1d062"
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
        "Harvested/verified timestamp recorded: 2026-11-15T17:14:23.390Z"
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
  "auth_token": "e60589fe112df45a526807ca387d02fdff657af04742bc6a12a97ca3ea349b0f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
