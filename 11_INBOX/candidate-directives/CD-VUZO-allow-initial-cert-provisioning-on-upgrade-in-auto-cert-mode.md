# Candidate Directive: [CD-VUZO] allow initial cert provisioning on upgrade in auto cert mode

<!-- PROVENANCE_START
{
  "source_repository": "karmada-io/karmada",
  "source_url": "https://github.com/karmada-io/karmada",
  "source_version": "12a8e01c",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T14:57:04.164Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-karmada-io-karmada",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [karmada-io/karmada](https://github.com/karmada-io/karmada) (Revision: `12a8e01c`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T14:57:04.164Z`  
> **Learning ID**: `learn-github-karmada-io-karmada`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `charts/karmada/templates/_helpers.tpl`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in karmada-io/karmada. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ceba46ce`: helm): allow initial cert provisioning on upgrade in auto cert mode. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `charts/karmada/templates/_helpers.tpl`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

{{/*
Generates the auto mode certificates into /opt/certs and fills them into the
cert, kubeconfig and webhook-cert manifests under /opt/configs.
*/}}
{{- define "karmada.certs.generate" -}}
mkdir -p /opt/certs
cp -r -L /opt/mount/* /opt/configs/
openssl req -x509 -sha256 -new -nodes -days {{ .Values.certs.auto.rootCAExpiryDays }} -newkey rsa:{{ .Values.certs.auto.rsaSize }} -keyout "/opt/certs/server-ca.key" -out "/opt/certs/server-ca.crt" -subj "/C=xx/ST=x/L=x/O=x/OU=x/CN=ca/emailAddress=x/"
openssl req -x509 -sha256 -new -nodes -days {{ .Values.certs.auto.rootCAExpiryDays }} -newkey rsa:{{ .Values.certs.auto.rsaSize }} -keyout "/opt/certs/front-proxy-ca.key" -out "/opt/certs/front-proxy-ca.crt" -subj "/C=xx/ST=x/L=x/O=x/OU=x/CN=ca/emailAddress=x/"
echo '{"signing":{"default":{"expiry":{{ printf `"%s"` .Values.certs.auto.expiry }},"usages":["signing","key encipherment","client auth","server auth"]}}}' > "/opt/certs/server-ca-config.json"
echo '{"CN":"system:admin","hosts":{{ include "karmada.certHosts" . }},"names":[{"O":"system:masters"}],"key":{"algo":"rsa","size":{{ .Values.certs.auto.rsaSize }}}}' | cfssl gencert -ca=/opt/certs/server-ca.crt -ca-key=/opt/certs/server-ca.key 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ceba46ce` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T14:57:04.162Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795013824162",
    "title": "allow initial cert provisioning on upgrade in auto cert mode",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "karmada-io/karmada",
    "source_uri": "https://github.com/karmada-io/karmada",
    "source_version": "HEAD",
    "content_hash": "aa802040c02aba5256b46e15aa21c65ee7831aece774ebc9c1d18d4644e6cff4"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-18T14:57:04.162Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8996eb0c879e1650c7b7b90093f3c57be5f34c04f13a40d8e10a2fc235bcd45f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
