# AI-Builder-Brain — Deferred Improvements Register

> **System:** AI-Builder-Brain Maintenance & Continuous Improvement  
> **Location:** `08_VERIFICATION/deferred-improvements-register.md`  
> **Purpose:** Persistent tracking of non-blocking technical improvements, formatting debts, performance tuning items, and deferred refinements discovered during audits and milestone checkpoints.  
> **Governance Rule:** This register must be reviewed and reconciled at every milestone completion and maintenance checkpoint.

---

## 📊 Summary Status

| Status | Count | Description |
|---|---|---|
| 🟢 **DONE** | 1 | Fully resolved and independently verified |
| 🟡 **IN PROGRESS** | 0 | Active remediation authorized and underway |
| ⚪ **OPEN** | 1 | Identified with empirical evidence, awaiting scheduled maintenance |
| 🔴 **BLOCKED** | 0 | Remediation blocked by prerequisite or dependency |

---

## 🗂️ Active Registry

| Issue ID | Severity | Title | File / Location | Status | Proposed Resolution |
|---|---|---|---|---|---|
| **`DIB-001`** | Low | Remove trailing whitespace | `04_WORKFLOWS/factory-engine/test-task-connector.mjs:132-134` | **DONE** | Strip trailing whitespace characters |
| **`DIB-002`** | Low | Retrieval Engine cold rebuild duration exceeds 2,000ms threshold | `04_WORKFLOWS/factory-engine/test-retrieval-engine.mjs:39` | **OPEN** | Profile serialization timing and adjust threshold or stream cache write |

---

## 📖 Detailed Improvement Dossiers

### `DIB-001` — Remove trailing whitespace in test-task-connector.mjs

- **Issue ID:** `DIB-001`
- **Short Title:** Remove trailing whitespace in test-task-connector.mjs
- **Exact File / Location:** `04_WORKFLOWS/factory-engine/test-task-connector.mjs` (lines 132–134)
- **Description & Evidence:**
  Running `git diff --check` reported whitespace errors on 3 lines introduced during Milestone D1 focused test additions:
  ```
  04_WORKFLOWS/factory-engine/test-task-connector.mjs:132: trailing whitespace.
  +const duplicateCapContract = { 
  04_WORKFLOWS/factory-engine/test-task-connector.mjs:133: trailing whitespace.
  +  ...validContract, 
  04_WORKFLOWS/factory-engine/test-task-connector.mjs:134: trailing whitespace.
  +  required_capabilities: ['CAP-DISASTER-RECOVERY-VAULT', 'CAP-DISASTER-RECOVERY-VAULT'] 
  ```
- **Severity & Priority:** Severity: `Low` | Priority: `Low` (Non-blocking cosmetic formatting)
- **Proposed Resolution:** Remove trailing space characters from lines 132, 133, and 134 without altering test logic or formatting.
- **Dependencies & Risks:** None. Test logic and contract definitions remain bit-for-bit identical.
- **Verification Required:**
  1. `git diff --check` exits with 0 (clean).
  2. Exact file diff inspection confirms only trailing whitespace was removed.
  3. `node 04_WORKFLOWS/factory-engine/test-task-connector.mjs` passes 44/44 assertions.
- **Status:** **DONE**
- **Completion Evidence:**
  - Resolved on 2026-11-02.
  - `git diff --check` executed and returned Exit Code `0` with zero whitespace warnings.
  - `git diff -- 04_WORKFLOWS/factory-engine/test-task-connector.mjs` confirmed exact removal of trailing spaces on lines 132–134.
  - `node 04_WORKFLOWS/factory-engine/test-task-connector.mjs` executed and passed 44/44 assertions (Exit Code `0`).

---

### `DIB-002` — Retrieval Engine cold index rebuild time exceeds 2,000ms threshold

- **Issue ID:** `DIB-002`
- **Short Title:** Retrieval Engine cold index rebuild duration exceeds 2,000ms threshold
- **Exact File / Location:** `04_WORKFLOWS/factory-engine/test-retrieval-engine.mjs` (line 39) & `retrieval-engine.mjs`
- **Description & Evidence:**
  Running `node 04_WORKFLOWS/factory-engine/test-retrieval-engine.mjs` results in 24 PASSED, 1 FAILED.
  Assertion failure: `Initial index build is fast: 2880ms` (threshold was `< 2000ms`).
  Root cause analysis: Corpus has expanded to 8,251 documents and 42,838 terms (49.73 MB cache file). Initial full build including 50 MB serialization and synchronous disk write takes ~2,880ms. Warm queries remain fast at 11.13ms.
- **Severity & Priority:** Severity: `Low` | Priority: `Medium`
- **Proposed Resolution:** Safe diagnostic profiling of parsing vs tokenization vs serialization vs disk writing; adjust cold build threshold to reflect 8,251-document corpus size or optimize JSON disk write to asynchronous stream.
- **Dependencies & Risks:** Must not modify existing knowledge files or break warm query latency (< 15ms).
- **Verification Required:** `test-retrieval-engine.mjs` passes 25/25 assertions.
- **Status:** **OPEN**
- **Completion Evidence:** *Diagnostic Profiling Conducted on 2026-11-03:*
  - In-memory parsing, tokenization, BM25 inverted index, and IDF calculation for 8,251 documents (6,414 patterns, 1,778 dossiers, 27 operating rules, 18 skills, 14 capabilities) measured at ~1,700ms.
  - Full in-memory index payload JSON serialization (`JSON.stringify` on ~50 MB package) and synchronous NTFS disk write take ~900ms.
  - Total cold rebuild duration: ~2,616ms (target < 2,000ms).
  - Warm in-memory cache retrieval latency verified at 7.75ms (threshold < 15ms).
  - In accordance with the governing rules, the 2,000ms threshold has NOT been weakened or altered. `DIB-002` remains **OPEN** for future streamed serialization / binary index caching.

---

## 🔄 Maintenance & Review Protocol

1. **Trigger Points:** Every milestone completion, reality audit, and routine maintenance session must inspect this register.
2. **Resolution Lifecycle:**
   - Identified $\rightarrow$ Logged with empirical evidence (`OPEN`)
   - Authorized for remediation $\rightarrow$ `IN PROGRESS`
   - Fixed & Independently Verified $\rightarrow$ `DONE` (with command and output proof)
   - Blocked by dependency $\rightarrow$ `BLOCKED` (with documented blocker)
3. **Immutability of Closed Items:** Resolved items are retained for historical auditability and never silently deleted.
