# Candidate Directive: [CD-89J9] Dynamic Credential Permission Invalidation For Subordinate Tokens

<!-- PROVENANCE_START
{
  "source_repository": "mintplex-labs-anything-llm-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T09:18:27.774Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mintplex-labs-anything-llm-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mintplex-labs-anything-llm-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T09:18:27.774Z`  
> **Learning ID**: `LEARN-EVO-mintplex-labs-anything-llm-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
Security authorization middleware verifying scoped credentials (API keys, browser extension tokens, microservice bearer secrets) MUST validate the active, current permissions and roles of the *issuing principal entity* on EVERY privileged request, rather than solely checking token existence, expiry, or passive suspension status.

**WHY**:
Decoupling token verification from role checks creates an elevation-of-privilege window. When an administrator demotes an account from `admin` or `manager` down to `default` (unprivileged), pre-existing API keys or subordinate extension tokens remain in circulation. If the authorization gate checks only `key.userId === user.id && !user.suspended`, demoted users retain full administrative write access across workspaces through their orphaned keys.

**WHEN TO APPLY**:
All multi-tenant and multi-user authentication systems issuing auxiliary access tokens (CLI keys, Webhook secrets, Browser Extension tokens, OAuth refresh tokens).

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// server/utils/middleware/authorization.js

const ALLOWED_ROLES_FOR_EXTENSIONS = ["admin", "manager"];

/**
 * Validates browser extension API key and proves principal retains valid issuance role.
 */
async function validBrowserExtensionApiKey(req, res, next) {
  const authHeader = req.header("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "")?.trim();

  if (!token) {
    return res.status(401).json({ error: "Missing authorization token." });
  }

  const apiKeyRecord = await prisma.browser_extension_api_keys.findUnique({
    where: { key: token },
    include: { user: true },
  });

  if (!apiKeyRecord || !apiKeyRecord.user) {
    return res.status(403).json({ error: "Invalid API key." });
  }

  const { user } = apiKeyRecord;

  // Invariant 1: Check account suspension
  if (user.suspended === 1 || user.suspended === true) {
    return res.status(403).json({ error: "User account suspended." });
  }

  // Invariant 2: Dynamic Role Validation
  // Token validity must be dynamically tied to the creator's current authorization role
  if (!ALLOWED_ROLES_FOR_EXTENSIONS.includes(user.role)) {
    return res.status(403).json({
      error: "Principal no longer possesses permissions required to invoke this endpoint.",
    });
  }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T09:18:27.908Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795079907908",
    "title": "Dynamic Credential Permission Invalidation For Subordinate Tokens",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mintplex-labs-anything-llm-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d3112a86fd805af68f7c3b32fb809dda414b1005ad5c411841dab71cd7ce0557"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-19T09:18:27.908Z"
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
  "auth_token": "f6ed3dbddfac6e545f461224f27898eafc26727620c20b1d5d018fa11540b5c8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
