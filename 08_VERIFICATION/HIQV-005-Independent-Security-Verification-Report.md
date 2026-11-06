# HIQV-005 — Independent HMAC Security Verification Report

**Verification Date:** 2026-11-05T22:40:00+05:30  
**Audit Target:** Harvested Intelligence Quality Validator (HIQV-004) HMAC & Authenticity Layer  
**Auditor:** Antigravity (Independent Security Audit Protocol)  
**Final Audit Verdict:** **FAIL** (Critical Vulnerability & Signing Authority Exposure Confirmed)

---

## 1. Executive Summary

This independent security verification evaluated the authenticity, token generation, key lifecycle, and promotion gating delivered in **HIQV-004**.

The primary question asked:
> **Can an untrusted caller, module, or process manufacture or obtain a valid HIQV authentication token and thereby authorize a fabricated knowledge-quality PASS report?**

**Answer: YES.** 

An untrusted caller can completely bypass the HIQV validation gate and authorize a fabricated PASS report into canonical intelligence (`05_KNOWLEDGE/engineering-patterns.md`) through two reproducible mechanisms:
1. **Caller-Controlled Secret Injection:** Both `promoteToCanonicalPatterns` and `promoteValidatedRules` forward caller-supplied `options` directly into `verifyReportIntegrity`. Because `getValidatorSecret` respects `options.secret`, an attacker can sign a fabricated PASS report with an arbitrary secret, pass that same secret in `options.secret`, and achieve authorized canonical promotion without executing the 7-dimension quality validator.
2. **Exposed Signing Authority & Secret Accessor:** `brain-connector.mjs` and `harvested-intelligence-quality-validator.mjs` publicly export `generateReportAuthToken` and `getValidatorSecret`. Any caller in the runtime can invoke `getValidatorSecret()` directly to extract the genuine system key or invoke `generateReportAuthToken()` to forge valid tokens.

In accordance with **Section 8 (Stop Conditions)**, this vulnerability was captured and documented empirically. **Zero source code modifications were made; the system remains in a strict read-only audit state.**

---

## 2. Fresh Repository Reconnaissance

- **Working Directory:** `C:\AI-Builder-Brain`
- **Current Branch:** `main`
- **HEAD Commit:** `e05ac06baf085668e497bc10c05b0937d35bcbfa` (`live harvesting`)
- **Working Tree State:** Clean with respect to remote `origin/main`. Preserved existing unstaged modifications from prior tasks.
- **Production Knowledge Safety:** Verified zero modifications to `05_KNOWLEDGE/engineering-patterns.md` and production `.project-brain/task-checkpoints.json`.
- **Test Artifact Isolation:** All security audit test executions were strictly confined to `.project-brain/simulation-sandbox/hiqv-005/`.

---

## 3. Source Inspection & Call Site Inventory

| Function / Symbol | Source File Path | Line Range | Purpose & Findings |
|---|---|:---:|---|
| `getValidatorSecret` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 976–1004 | **VULNERABLE:** Resolves `options.secret` first before env or session key. |
| `generateReportAuthToken` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 1077–1081 | Computes HMAC-SHA256 over canonical payload. Accepts `options.secret`. |
| `computeReportCanonicalPayload` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 1047–1072 | Serializes decision, dims, score, action, title, content hash, ev_fp. |
| `computeCandidateHash` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 1010–1015 | SHA-256 over candidate title and substantive body. |
| `computeEvidenceItemHash` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 1021–1032 | SHA-256 over evidence ID, type, sources, and substantive content excerpt. |
| `computeEvidenceFingerprint` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 1038–1042 | Deterministic sort and digest of evidence item hashes. |
| `verifyReportIntegrity` | `04_WORKFLOWS/factory-engine/harvested-intelligence-quality-validator.mjs` | Lines 1095–1178 | Verifies token, replay, mutation, evidence. **Passes caller options to token generator.** |
| `brain-connector.mjs` Exports | `04_WORKFLOWS/factory-engine/brain-connector.mjs` | Lines 111–135 | **EXPOSED:** Re-exports `generateReportAuthToken` and `getValidatorSecret`. |
| `promoteToCanonicalPatterns` | `04_WORKFLOWS/factory-engine/knowledge-acquisition-pipeline.mjs` | Line 970 | **VULNERABLE CALL SITE:** `verifyReportIntegrity(candidate, evidenceList, validationReport, options)` passes unvalidated `options`. |
| `promoteValidatedRules` | `04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs` | Line 572 | **VULNERABLE CALL SITE:** `verifyReportIntegrity(rule, evidenceList, valReport, options)` passes unvalidated `options`. |
| `promoteCandidateToKnowledge` | `04_WORKFLOWS/factory-engine/feedback-loop.mjs` | Lines 172–249 | Internal self-healing promoter. Unhardened by HIQV (requires separate authorization). |

---

## 4. Critical Security Findings

### Finding 1: Caller-Controlled Secret Authorization Bypass (CRITICAL)
- **Source Code Vulnerability:**
  ```javascript
  // harvested-intelligence-quality-validator.mjs line 976
  export function getValidatorSecret(options = {}) {
    if (options.secret && typeof options.secret === 'string' && options.secret.length >= 16) {
      return options.secret;
    }
    // ...
  }
  ```
- **Exploitation Mechanism:**
  When `promoteToCanonicalPatterns` or `promoteValidatedRules` is invoked, callers pass an `options` dictionary. The gateway forwards `options` directly to `verifyReportIntegrity`, which forwards it to `generateReportAuthToken`, which calls `getValidatorSecret(options)`.
  An attacker can:
  1. Construct a completely fabricated PASS report for an adversarial backdoor rule.
  2. Sign the report with an arbitrary string (e.g. `'attacker-supplied-bogus-secret-99999999'`).
  3. Invoke `promoteToCanonicalPatterns(candidate, {}, { allowCanonicalPromotion: true, validationReport: fabricatedReport, secret: 'attacker-supplied-bogus-secret-99999999' })`.
  4. The verifier verifies the report using the attacker's secret, evaluates `timingSafeEqual` as `true`, and writes the exploit into `05_KNOWLEDGE/engineering-patterns.md`.

### Finding 2: Public Export of Signing Authority & Secret Material (HIGH)
- **Source Code Exposure:**
  In `brain-connector.mjs` (Lines 114–132):
  ```javascript
  export {
    // ...
    verifyReportIntegrity,
    generateReportAuthToken,
    computeReportCanonicalPayload,
    getValidatorSecret
  };
  ```
- **Impact:**
  Any script, plugin, or module importing `brain-connector.mjs` can call `getValidatorSecret()` directly to read the live 64-hex system session secret from memory/disk, or call `generateReportAuthToken()` directly to sign arbitrary payload dictionaries without executing HIQV's 7 evaluation dimensions.

### Finding 3: Same-OS-User Threat Model Limitations (MEDIUM)
- **Filesystem Reality on Windows:**
  - The secret is stored at `.project-brain/cache/.validator_session.key` with `mode: 0o600`.
  - On Windows NTFS, POSIX file permissions (like `0o600`) are not mapped to Windows ACLs.
  - Any process running under the same Windows user account (`Admin`) has full read/write access to `.project-brain/cache/.validator_session.key`.
  - **Limitation:** In a single-user local runtime, HMAC provides tamper resistance against network in-flight modifications, but cannot serve as a privilege boundary against local processes running under the same OS user.

### Finding 4: Canonical Payload Binding Analysis (LOW)
- **Bound Fields:** `validator_version`, `decision`, `recommended_action`, `confidence_score`, `item.title`, `item.content_hash`, `item.category`, `item.domain`, `item.source_id`, `item.source_uri`, `evidence_fingerprint`, and all 7 dimension statuses (`sr`, `eq`, `tc`, `re`, `cp`, `fr`, `dc`).
- **Unbound Fields:** `decision_reason`, `validated_at`, `confidence_justification`, and `evidence_references`.
- **Assessment:** All fields that govern the decision, score, and content binding are cryptographically included. The omitted fields are purely informational log strings.

---

## 5. Adversarial Proof of Concept (PoC) Evidence

Executed independently inside sandbox `.project-brain/simulation-sandbox/hiqv-005/audit-runner.mjs`:

```text
===========================================================================
🕵️‍♂️ HIQV-005: INDEPENDENT HMAC SECURITY AUDIT & TRUST BOUNDARY VERIFICATION
   Sandbox: C:\AI-Builder-Brain\.project-brain\simulation-sandbox\hiqv-005
===========================================================================

--- [TEST A] Caller-Controlled Secret Attack ---
Attacker Generated Token: d53255dc88825cac11b844cb5ed75bd514308d26ad98793ee52a1f482ae46438
Promotion Attempt Result with Attacker Secret: {
  promoted: true,
  ruleNumber: 2,
  title: 'Backdoor Authorization Via Caller Controlled Secret',
  readBackVerified: true,
  decision: 'PASS',
  ...
}
Was Backdoor Written to engineering-patterns.md?: true
🚨 [VULNERABILITY CONFIRMED: CRITICAL]
   An untrusted caller CAN supply options.secret to both sign and verify a fabricated report,
   completely bypassing HIQV and obtaining unauthorized canonical promotion!

🌟 [GATEWAY PROMOTION VERIFIED] Rule 3: "Direct Gateway Bypass Via Caller Secret" validated, appended, and verified via read-back.
Was gateway backdoor written?: true
```

Both promotion entry points (`promoteToCanonicalPatterns` and `promoteValidatedRules`) were successfully exploited using caller-controlled secrets.

---

## 6. Regression Test Suite Verification

All 4 relevant test suites were executed under read-only isolated conditions. All passed:

1. **`test-validation-report-authenticity.mjs`**
   - Command: `node 04_WORKFLOWS/factory-engine/test-validation-report-authenticity.mjs`
   - Output: `🏁 HIQV-004 AUTHENTICITY SUMMARY: 23 PASSED | 0 FAILED`
   - Exit Code: `0`
   - *Note on Test 10:* Tested key rotation by passing `secret: rotatedSecret` during verification only (which failed as expected). It did not test an attacker passing `secret` to both signer and gateway simultaneously.
2. **`test-live-harvesting-quality-gate.mjs`**
   - Command: `node 04_WORKFLOWS/factory-engine/test-live-harvesting-quality-gate.mjs`
   - Output: `🏁 HIQV-003 AUDIT & VERIFICATION SUMMARY: 63 PASSED | 0 FAILED`
   - Exit Code: `0`
3. **`test-quality-gate-integration.mjs`**
   - Command: `node 04_WORKFLOWS/factory-engine/test-quality-gate-integration.mjs`
   - Output: `🏁 QUALITY GATE INTEGRATION SUMMARY: 57 PASSED | 0 FAILED`
   - Exit Code: `0`
4. **`test-harvested-intelligence-quality-validator.mjs`**
   - Command: `node 04_WORKFLOWS/factory-engine/test-harvested-intelligence-quality-validator.mjs`
   - Output: `🏁 HIQV v0.1 VERIFICATION SUMMARY: 41 PASSED | 0 FAILED`
   - Exit Code: `0`

**Total Regression Assertions Passed:** 184 | **Failed:** 0.

---

## 7. Feedback Loop Trust Boundary Analysis

- **Module:** `04_WORKFLOWS/factory-engine/feedback-loop.mjs`
- **Function:** `promoteCandidateToKnowledge(candidateId, verificationEvidence)`
- **Trust Mechanism:** Verifies that candidate was staged in `11_INBOX/candidate-directives/`, checks `verificationEvidence.verified === true`, resolves next dynamic rule number, writes to `05_KNOWLEDGE/engineering-patterns.md`, and runs SHA-256 read-back check.
- **Reachability:** Reachable only via internal test and remediation runners (`test-persistent-learning.mjs`, `test-e2e-integration.mjs`, `test-feedback-memory.mjs`). Not referenced by Cloud Harvester (`zero-clone-harvester.mjs`).
- **Security Boundary Limitation:** Does not validate through HIQV (no prompt injection, dangerous security pattern, or opposition checks).
- **Status:** Left untouched per prompt instructions (requires separate architectural authorization).

---

## 8. Remaining Risks and Unresolved Questions

1. **Option Leakage in Gateway:** `options` passed to public gateway methods must never be forwarded to internal cryptographic verifiers. Verifiers must use strictly internal, unoverridable key material.
2. **Over-Exported Helper Functions:** Helper functions intended for internal verification (`generateReportAuthToken`, `getValidatorSecret`) should be kept private to `harvested-intelligence-quality-validator.mjs` and not exported in public facades like `brain-connector.mjs`.
3. **Process Privilege Boundary:** If the threat model assumes untrusted code running inside the same Node process or same OS user, HMAC cannot substitute for an isolated process/sandbox boundary.

---

## 9. Final Verdict & Stop Condition Notice

### **VERDICT: FAIL**

**Justification:**  
A reproducible attack allows an untrusted caller to authorize fabricated validation reports and obtain canonical promotion into `engineering-patterns.md` by supplying matching caller-controlled `options.secret`. Furthermore, signing authority and secret accessors are publicly exposed across module exports.

Per **Section 8 (Stop Conditions)**:
- The reproducible attack has been captured and recorded.
- Source evidence and terminal test output have been documented.
- **The audit is stopped immediately without applying implementation changes or silent repairs.**
- All production source files remain untouched and read-only.

