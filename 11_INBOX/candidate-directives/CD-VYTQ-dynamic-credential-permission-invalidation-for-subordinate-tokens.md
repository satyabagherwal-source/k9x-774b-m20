# Candidate Directive: [CD-VYTQ] Dynamic Credential Permission Invalidation For Subordinate Tokens

<!-- PROVENANCE_START
{
  "source_repository": "Mintplex-Labs/anything-llm",
  "source_url": "https://github.com/Mintplex-Labs/anything-llm",
  "source_version": "2f6a451f",
  "license": "MIT",
  "timestamp": "2026-11-19T09:08:54.158Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mintplex-labs-anything-llm",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) (Revision: `2f6a451f`).  
> **License**: MIT | **Timestamp**: `2026-11-19T09:08:54.158Z`  
> **Learning ID**: `learn-github-mintplex-labs-anything-llm`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

  req.user = user;
  req.apiKey = apiKeyRecord;
  next();
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// CRITICAL SECURITY HOLE: Checking existence and suspension while ignoring role demotion
async function insecureApiKeyCheck(req, res, next) {
  const key = await prisma.api_keys.findUnique({
    where: { key: req.header("X-API-KEY") },
    include: { user: true }
  });
  // Demoted manager retains admin powers indefinitely!
  if (key && !key.user.suspended) return next();
  return res.status(403).send("Forbidden");
}
```

**VERIFICATION METHOD**:
Run an automated integration test with the following sequence:
1. Seed test database with a user in role `manager`.
2. Generate a browser extension API key for the user.
3. Assert `POST /api/browser-extension/embed-content` succeeds with HTTP 200.
4. Update user role in database to `default`.
5. Re-run identical `POST` request with identical key.
6. Assert request fails with HTTP 403 Forbidden.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T09:08:54.157Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795079334157",
    "title": "Dynamic Credential Permission Invalidation For Subordinate Tokens",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Mintplex-Labs/anything-llm",
    "source_uri": "https://github.com/Mintplex-Labs/anything-llm",
    "source_version": "HEAD",
    "content_hash": "dff0cd5bd8b043bc75c6c3ec5216be7e802c45e7a2796a61b0d53e0bd0d8a2cc"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T09:08:54.157Z"
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
  "auth_token": "6e2a3b5cb23e3b5a9362210bcd3d2908ba0681da9aad6686e0bae1c3b155b17b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
