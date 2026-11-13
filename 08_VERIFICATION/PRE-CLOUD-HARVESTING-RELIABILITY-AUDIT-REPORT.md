# AI-BUILDER-BRAIN — PRE-CLOUD-HARVESTING RELIABILITY AUDIT REPORT
**Mission ID:** `PRE-CLOUD-HARVESTING-RELIABILITY-AUDIT-01`  
**Date:** November 13, 2026  
**Auditor:** Antigravity Autonomous Systems Agent (Google DeepMind Team)  
**Repository:** `C:\AI-Builder-Brain`  
**Git Commit Baseline:** `bb6582fcf042ee335f8d271a5be6267bca7fb815` (Branch: `main`)  
**Audit Scope:** Automatic Learning Persistence, Knowledge Ingestion/Gateway Pipeline, and Automatic Vault Backup & Disaster Recovery Reliability.

---

## 1. Executive Summary

| Subsystem | Audit Status | Empirical Verdict | Readiness for 24/7 Cloud Harvesting |
| :--- | :--- | :--- | :--- |
| **Learning Ingestion & Storage Pipeline** | **VERIFIED** | Ingestion via `zero-clone-harvester.mjs` -> `brain-learning-gateway.mjs` enforces multi-barrier validation, disk write, SHA-256 read-back, dual-schema indexing, and reload persistence. Verified 100% in Test A. | **READY (Local)** / **DEPENDENT ON GIT PUSH (Cloud)** |
| **Local Automatic Backup Engine** | **VERIFIED** | Windows Task Scheduler (`AI-Builder-Brain-Daily-Vault-Backup`) executes daily at 02:00 AM. Generates 234 MB verified Git history bundle, AES-256-GCM encrypted secrets, 26,146 scoped files, auxiliary state archive, and SHA-256 manifest. Verified in Test B. | **READY** |
| **Remote Private Vault Synchronization** | **FAILED / UNRELIABLE** | The scheduled task exits with code `1` (`PARTIAL_SUCCESS`). Syncing 234 MB bundle to `satyabagherwal-source/ai-builder-brain-private-vault` times out over HTTPS (`HTTP 408` after ~55 minutes). Local backup succeeds, but offsite remote copy fails. | **NOT READY (Requires fix or waiver)** |
| **Disaster Recovery & Restorability** | **VERIFIED** | `scripts/disaster-recovery.mjs` was drill-tested in an isolated sandbox. Successfully restored commit `bb6582fcf` and 26,146 files. Side-by-side SHA-256 comparison confirmed 100% bit-for-bit equivalence across all canonical knowledge and code. | **READY** |
| **Overall Pre-Cloud-Harvesting Readiness** | **BLOCKED** | Learning persistence and local recovery are fully verified. However, offsite backup sync fails with network timeouts, and cloud ephemeral persistence carries risk if git push fails. **Cloud Harvesting is NOT started in this mission.** | **AWAITING EXPLICIT HUMAN AUTHORIZATION** |

---

## 2. Architecture & Pipeline Baseline

### 2.1 Learning Ingestion, Validation & Persistence Flow
```
[External Repos / Sources]
         │
         ▼
[04_WORKFLOWS/factory-engine/multi-agent-fleet.mjs]
         │ (Spawns worker child processes)
         ▼
[04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs]
         │
         ├─► runZeroCloneBatch()
         ├─► parseSourceUrl() & inspect commits/issues via GitHub/HF API
         ├─► formulate Intelligence Package with SHA-256 hash
         │
         ▼
[04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs] :: submitToBrainGateway()
         │
         ├─► Stage 0: Idempotency Check (bypasses redundant writes if hash matches)
         ├─► Stage 1: Validation Gate (validates structure, invariant rules, schema)
         ├─► Stage 2: Write Dossier to `07_PROJECT_LEARNING/${slug}-learnings.md`
         ├─► Stage 3: Read-back Verification (re-reads dossier, computes SHA-256)
         ├─► Stage 4: Rule Promotion to `05_KNOWLEDGE/engineering-patterns.md`
         ├─► Stage 5: Dual-Schema Update to `05_KNOWLEDGE/knowledge-index.json`
         ├─► Stage 6: Verification Matrix update (`08_VERIFICATION/harvest-verification-matrix.md`)
         ├─► Stage 7: Cryptographic Provenance (`09_SOURCES/harvest-provenance-ledger.md`)
         ├─► Stage 8: Unverified Rule Staging (`11_INBOX/candidate-directives-registry.json`)
         ├─► Stage 9: Evolution Metrics (`14_EVOLUTION/harvest-yield-metrics.json`)
         └─► Hard Invariant Assertion (Asserts all 9 stages succeeded; fails if any missed)
         │
         ▼
[04_WORKFLOWS/factory-engine/sources-registry.json] (Updated with verified learningId)
         │
         ▼
[Git Commit & Push Barrier]
         │ (GitHub Actions runner commits & pushes to origin/main)
         ▼
[Permanent Master Brain on GitHub Remote `origin/main`]
```

### 2.2 Vault Backup & Disaster Recovery Architecture
```
[Windows Task Scheduler: 'AI-Builder-Brain-Daily-Vault-Backup'] (Daily at 02:00 AM)
         │
         ▼
[scripts/run-vault-backup.ps1]
         │
         ▼
[04_WORKFLOWS/factory-engine/vault-backup-engine.mjs] :: executeVaultBackup()
         │
         ├─► Step 1: Pre-flight Git Invariant Verification (HEAD & branch check)
         ├─► Step 2: Git History Bundle (`brain-history.bundle`, HEAD + refs/heads/main)
         ├─► Step 3: Authenticated Secrets Encryption (`secrets.enc` via AES-256-GCM)
         ├─► Step 4: Snapshot Tree Copy (Copies all 26,000+ scoped files)
         ├─► Step 4b: Package Auxiliary State (`auxiliary-state.tar.gz` for uncommitted/untracked)
         ├─► Step 5: Final Snapshot Manifest (`backup-manifest.json` with file SHA-256 hashes)
         ├─► Step 6: Consistency Verification Check (compares disk vs snapshot hashes)
         ├─► Step 7: Remote Vault Push (`satyabagherwal-source/ai-builder-brain-private-vault`) ──► [HTTP 408 TIMEOUT!]
         ├─► Step 8: Retention Policy (keeps 7 daily snapshots; prunes oldest > 7)
         └─► Step 9: Final Status Record (`.project-brain/backups/vault-status.json`)
```

---

## 3. Automatic Learning Persistence Audit (Phase 2 Answers)

### Question 1: Exact entry point of new harvested knowledge (file + function)
- **Primary Orchestrator Entry**: `04_WORKFLOWS/factory-engine/multi-agent-fleet.mjs` spawns parallel worker processes running `zero-clone-harvester.mjs`.
- **Harvester Execution Function**: `04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs` inside `runZeroCloneBatch()` (lines 930–973).
- **Gateway Submission Entry Point**: `04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs` -> function `submitToBrainGateway(learningPackage, options)`.

### Question 2: Which component actually writes knowledge to disk?
1. **Dossier Writer**: `brain-learning-gateway.mjs` line 1067:
   `fs.writeFileSync(dossierPath, learningPackage.dossier_content, 'utf-8');` -> writes to `07_PROJECT_LEARNING/${slug}-learnings.md`.
2. **Rule Promotion Writer**: `brain-learning-gateway.mjs` line 761:
   `fs.appendFileSync(p.patternsPath, formattedRule, 'utf-8');` -> writes to `05_KNOWLEDGE/engineering-patterns.md`.
3. **Knowledge Index Writer**: `brain-learning-gateway.mjs` line 203:
   `fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');` (atomic rename) -> writes to `05_KNOWLEDGE/knowledge-index.json`.
4. **Verification Ledger Writer**: `brain-learning-gateway.mjs` lines 810, 833:
   Writes to `08_VERIFICATION/harvest-verification-matrix.md` and `harvest-verification-log.json`.
5. **Provenance Ledger Writer**: `brain-learning-gateway.mjs` lines 856, 873:
   Writes to `09_SOURCES/harvest-provenance-ledger.md` and `harvest-sources-catalog.json`.
6. **Candidate Staging Writer**: `brain-learning-gateway.mjs` line 921:
   Writes unpromoted rules to `11_INBOX/candidate-directives-registry.json`.
7. **Evolution Yield Writer**: `brain-learning-gateway.mjs` line 965:
   Writes to `14_EVOLUTION/harvest-yield-metrics.json`.
8. **Sources Registry Writer**: `zero-clone-harvester.mjs` line 801:
   Writes verification metadata to `04_WORKFLOWS/factory-engine/sources-registry.json`.
9. **Remote Persistence Writer**: `.github/workflows/24-7-cloud-harvester.yml` lines 81–95:
   `git commit` and `git push origin main`.

### Question 3: How does the system confirm the write succeeded?
- **Stage 3 File Read-back Barrier** (`brain-learning-gateway.mjs` lines 1081–1089): Calls `readBackVerifyFile(dossierPath, learningPackage.content_hash)`. It re-reads the file from disk, computes its SHA-256 hash, and compares it to the input hash.
- **Stage 5 Index Read-back Barrier** (`brain-learning-gateway.mjs` lines 1180–1184): Calls `loadKnowledgeIndex()` immediately after saving, verifying that `recordedItem.content_hash === learningPackage.content_hash` and `verification_status === 'VERIFIED_LEARNING'`.
- **Hard Invariant Assertion** (lines 1238–1255): Verifies that all 9 stage flags (`extracted`, `validated`, `brain_write`, `brain_readback`, `promoted_to_brain`, `knowledge_index_updated`, `verification_ledger_updated`, `source_provenance_updated`, `evolution_metrics_updated`) are strictly `true`. If any flag is missing or false, status is forced to `FAILED_PERSISTENCE`.
- **Cloud Remote Push Barrier** (`.github/workflows/24-7-cloud-harvester.yml` lines 103–108): Runs `git fetch origin main` and `git branch -r --contains HEAD | grep -q 'origin/main'` to confirm the commit is present on GitHub remote.

### Question 4: Is knowledge written to persistent canonical storage or temporary/ephemeral storage?
- All writes are targeted directly at canonical repository paths (`07_PROJECT_LEARNING/`, `05_KNOWLEDGE/`, `08_VERIFICATION/`, `09_SOURCES/`, `11_INBOX/`, `14_EVOLUTION/`).
- **Critical Risk in Cloud Harvester**: In GitHub Actions, the runner filesystem is ephemeral. If the job terminates before `git push origin main` succeeds (e.g. unhandled crash or push timeout), all local writes on the runner are destroyed. Persistence in cloud harvesting is strictly bounded by Git remote push success.

### Question 5: Are indices, registries, and graphs updated simultaneously?
- **Simultaneously Updated**:
  - `05_KNOWLEDGE/knowledge-index.json` (Knowledge index)
  - `04_WORKFLOWS/factory-engine/sources-registry.json` (Sources registry)
  - `11_INBOX/candidate-directives-registry.json` (Staged candidate directives)
  - `08_VERIFICATION/harvest-verification-matrix.md` & `verification-log.json`
  - `09_SOURCES/harvest-provenance-ledger.md` & `sources-catalog.json`
  - `14_EVOLUTION/harvest-yield-metrics.json`
- **NOT Simultaneously Updated**:
  - `15_METADATA/relationship-graph.json`
  - `15_METADATA/domain-registry.json`
  - These two files are NOT touched during `submitToBrainGateway()`. They require offline batch reconciliation passes (as executed in Phase E.1/E.2).

### Question 6: If the process is killed or restarted, can the system read back the knowledge?
- **YES (Local/Committed)**: Verified empirically in Test A. `loadKnowledgeIndex()` and `retrieval-engine.mjs` read directly from disk files. Fresh Node processes successfully read back the item, verified the dossier path, and confirmed bit-for-bit SHA-256 equivalence.
- **NO (Cloud runner before push)**: If a cloud runner process is terminated or crashes before `git push`, the changes are lost.

### Question 7: What happens if a write fails halfway?
- Partial failure during dossier write, rule promotion, or index update triggers the error catch blocks, which set `results.status = LEARNING_STATUS.FAILED_PERSISTENCE` and abort without marking the target verified.
- The target is NOT marked complete in `sources-registry.json`, preventing spurious completion marks.
- **Limitation**: There is no multi-file transactional rollback (write rollback). For example, if dossier write succeeds but index update fails, the dossier markdown file remains on disk as an unreferenced orphan file.

### Question 8: Is provenance recorded?
- **YES**: Recorded cryptographically in `09_SOURCES/harvest-provenance-ledger.md` (Learning ID, Target Repository, Source Platform, Source URL, Git Version/SHA, Content Hash, and UTC Timestamp), as well as in `09_SOURCES/sources-catalog.json` and `08_VERIFICATION/harvest-verification-matrix.md`.

---

## 4. Automatic Backup Audit (Phase 3 Answers)

### Question 1: Scheduler existence
- **Scheduler**: Windows Task Scheduler task `AI-Builder-Brain-Daily-Vault-Backup` is registered and present.
- Configured via `scripts/register-backup-schedule.ps1` to run powershell wrapper `scripts/run-vault-backup.ps1`.

### Question 2: Triggers
- **Trigger**: Daily at 02:00:30 AM local time.
- Settings: `StartWhenAvailable` enabled (runs when machine wakes up if missed during sleep).
- Manual trigger available via `scripts/run-vault-backup.ps1` or CLI `node 04_WORKFLOWS/factory-engine/vault-backup-engine.mjs`.

### Question 3: Operational status
- **Task Scheduler State**: `Ready`.
- **Last Run Time**: `11/12/2026 8:44:14 AM`.
- **LastTaskResult**: `1` (Non-zero exit code!).
- **Empirical Log Finding**: `.project-brain/backups/daily-backup.log` reveals:
  - Local steps (Bundle creation 233.6 MB, file copy 3,951 files, auxiliary archive 123.3 MB, manifest generation) all **SUCCEEDED** in 36 seconds.
  - Step 7 (Remote git push to `satyabagherwal-source/ai-builder-brain-private-vault`) ran for 3,301 seconds (~55 minutes) and failed with:
    `RPC failed; HTTP 408 curl 22 The requested URL returned error: 408` (remote end hung up / network timeout).
  - Overall status logged: `PARTIAL_SUCCESS`.

### Question 4: Storage location
- **Local Storage**: `.project-brain/backups/vault-snapshots/snapshot-YYYY-MM-DD_HH-mm-ss/`.
- **Remote Offsite Storage**: Private GitHub repository `satyabagherwal-source/ai-builder-brain-private-vault`.

### Question 5: Included and excluded stores
- Governed by `04_WORKFLOWS/factory-engine/vault-manifest.mjs` (`classifyPath()`):
  - **INCLUDED**: All 16 canonical folders (`00_START_HERE` through `15_METADATA`), `.agents/`, `.claude/`, `.github/`, `.harvest-locks/*.json`, `.project-brain/` (checkpoints, incidents, memory, retrieval cache), operational logs, `scripts/`, root configs/ledgers (`harvest-control.json`, `repos.txt`, `LEARNINGS.md`).
  - **EXCLUDED from tree**: `.brain-secrets.json` (encrypted separately), `.git` (captured separately in bundle), `.kilo/worktrees/`, `.harvest-locks/*.lock`, `.temp-harvest/`, `.shallow-clone/`, OS files (`.DS_Store`, `Thumbs.db`), `.tmp` files, `.project-brain/backups/`, `.project-brain/vault-remote-cache/`.

### Question 6: Latest backup timestamp and contents
- **Latest Automatic Snapshot on Disk**: `snapshot-2026-11-12_08-47-21` (Created: 2026-11-12 03:38 UTC / 09:08 AM IST).
  - Scoped Files: 3,951 files (1.18 GB).
  - Git Bundle: `brain-history.bundle` (233.6 MB, SHA-256 verified).
  - Auxiliary State: `auxiliary-state.tar.gz` (123.3 MB).
  - Secrets: `secrets.enc` (AES-256-GCM encrypted).
- **Latest Drill Snapshot (Test B)**: `snapshot-2026-11-13_01-33-59` (Created: 2026-11-13 01:34 AM IST).
  - Scoped Files: 26,146 files (1.88 GB).
  - Git Bundle: `brain-history.bundle` (234.40 MB).
  - Auxiliary State: `auxiliary-state.tar.gz` (293.70 MB).

### Question 7: Integrity checks
- **YES**:
  1. Full Git history validated via `git bundle verify`.
  2. SHA-256 digest computed for the bundle and stored in `backup-manifest.json`.
  3. Every individual scoped file has its streaming SHA-256 recorded in `manifest.files`.
  4. Consistency check compares source files against snapshot tree copies.
  5. Secrets authenticated via AES-256-GCM auth tag.

### Question 8: Automatic restore testing
- **Mechanisms**: `scripts/disaster-recovery.mjs` provides complete automated cloning, file syncing, secret decryption, and 100% SHA-256 verification.
- **Scheduler Integration**: NOT automated in the daily schedule. The daily schedule only creates the backup; it does not perform a restore drill. Restoration was verified independently in Test B.

### Question 9: Failure handling
- **Mutex Lock**: `acquireLock()` uses `.project-brain/backups/vault-backup.lock` with live PID detection to prevent concurrent collisions and auto-clear stale locks.
- **Non-Fatal Remote Errors**: If Step 7 remote push fails, the local snapshot is preserved, the error is logged to `vault-status.json`, and status is marked `PARTIAL_SUCCESS`.
- **Incomplete Snapshot Protection**: If an unhandled failure occurs during file copying, the snapshot folder lacks `backup-manifest.json`. Recovery tools automatically filter out folders missing this manifest.

### Question 10: Retention policy
- Enforced by `enforceRetentionPolicy()`:
  - Keeps 7 daily snapshots.
  - Invariant: Never deletes if `<= 1` snapshot exists.
  - Verified in Test B: Pruned expired snapshot `snapshot-2026-11-10_17-07-48`, maintaining exactly 7 daily snapshots.

---

## 5. Empirical Test Results (Phase 4)

### Test A: Synthetic Learning Persistence Test
- **Script**: `.project-brain/simulation-sandbox/pre-harvest-audit/test-persistence.mjs`
- **Sandbox Root**: `.project-brain/simulation-sandbox/pre-harvest-audit/test-brain-root`
- **Input Package**: Synthetic repository `audit-test-org/audit-test-repo` (ID: `learn-github-audit-test-org-audit-test-repo`, Hash: `992873f445b29cef...`)
- **Execution Log**:
  - Validation: PASSED
  - Dossier Write: `07_PROJECT_LEARNING/audit-test-repo-learnings.md` (1,459 bytes) -> PASSED
  - SHA-256 Read-back: Matches `992873f445b29cef...` -> PASSED
  - Rule Guard: Generic header rejected & staged to `11_INBOX/candidate-directives-registry.json` -> PASSED
  - Index Update: `05_KNOWLEDGE/knowledge-index.json` updated & read-back confirmed -> PASSED
  - Provenance: Written to `09_SOURCES/harvest-provenance-ledger.md` -> PASSED
  - Metrics: Written to `14_EVOLUTION/harvest-yield-metrics.json` -> PASSED
  - Process Reload Simulation: Reloaded index from disk in new memory scope, located record, read dossier from disk, verified SHA-256 match -> PASSED
  - Idempotency Test: Resubmission recognized existing verified hash and returned `already_indexed: true` without redundant writes -> PASSED
- **Test A Result**: **100% PASS**

### Test B: Automatic Backup & Disaster Recovery Drill
- **Script**: `.project-brain/simulation-sandbox/pre-harvest-audit/test-backup-restore.mjs`
- **Execution Log**:
  - Executed `executeVaultBackup({ skipRemote: true })`:
    - Branch: `main`, HEAD: `bb6582fcf042ee335f8d271a5be6267bca7fb815`
    - Bundle: 234.40 MB verified (SHA-256: `511be7805d62...`)
    - Scoped Files: 26,146 files (1,888,040,799 bytes, ~1.88 GB)
    - Auxiliary Archive: 21,531 files (293.70 MB)
    - Snapshot ID: `snapshot-2026-11-13_01-33-59`
    - Consistency Check: PASSED
    - Retention Policy: Pruned expired `snapshot-2026-11-10_17-07-48` -> PASSED
  - Executed `executeDisasterRecovery({ targetDir: 'pre-harvest-audit/restored-brain' })`:
    - Cloned Git repo from `brain-history.bundle` -> PASSED
    - Restored commit `bb6582fcf042ee335f8d271a5be6267bca7fb815` -> PASSED
    - Synced snapshot tree files -> PASSED
    - Decrypted `.brain-secrets.json` via AES-256-GCM -> PASSED
    - Integrity Verification: 100% SHA-256 verified across all 26,146 files -> PASSED
  - Side-by-Side SHA-256 Hash Verification (Live vs. Restored):
    1. `05_KNOWLEDGE/engineering-patterns.md`: Live `6ea819849e8b3ef7...` == Restored `6ea819849e8b3ef7...` (MATCH)
    2. `05_KNOWLEDGE/knowledge-index.json`: Live `7e49f275a9a71cb2...` == Restored `7e49f275a9a71cb2...` (MATCH)
    3. `LEARNINGS.md`: Live `6ce5dc8cad562797...` == Restored `6ce5dc8cad562797...` (MATCH)
    4. `04_WORKFLOWS/factory-engine/vault-backup-engine.mjs`: Live `5a1ef8492f442985...` == Restored `5a1ef8492f442985...` (MATCH)
    5. `04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs`: Live `23f3b02b723fc7fc...` == Restored `23f3b02b723fc7fc...` (MATCH)
    6. `harvest-control.json`: Live `79b321c884ca80c6...` == Restored `79b321c884ca80c6...` (MATCH)
  - Post-Test Cleanup: Restored drill directory safely removed -> PASSED
- **Test B Result**: **100% PASS**

---

## 6. Identified Gaps & Vulnerabilities

1. **Remote Vault Push HTTP 408 Timeout (High Severity)**:
   - Git bundle size is 234.4 MB. Pushing this payload over HTTPS to GitHub times out after 55 minutes, resulting in Windows Task Scheduler reporting exit code `1`.
   - Consequence: While local backup is 100% healthy, offsite disaster recovery in the private vault repo is incomplete.
2. **Ephemeral Cloud Harvester Ingestion Vulnerability (High Severity)**:
   - When the 24/7 Cloud Harvester runs in GitHub Actions (`ubuntu-24.04`), knowledge is extracted and saved to local disk on the ephemeral runner.
   - If `git push origin main` fails after 5 retries (due to race conditions or rebase errors), newly harvested intelligence is lost when the runner shuts down.
3. **Asynchronous Metadata Divergence (Medium Severity)**:
   - `15_METADATA/relationship-graph.json` and `15_METADATA/domain-registry.json` are not updated during `submitToBrainGateway()`.
   - Consequence: Relationship graphs and domain mappings lag behind newly harvested dossiers until manual or scheduled reconciliation runs.
4. **Lack of Automated Scheduled Restore Drills (Low Severity)**:
   - While `disaster-recovery.mjs` works perfectly when invoked manually, it is not part of the daily automated schedule. A corrupted snapshot could sit on disk undetected unless tested.

---

## 7. Remediation Recommendations

1. **Fix Remote Vault Sync**:
   - Split Git bundles into smaller 25 MB chunks or push using GitHub Releases / Git LFS to avoid HTTP 408 timeouts on HTTPS push.
   - Alternatively, add `--depth 1` shallow bundle options or increase git http buffer in `run-vault-backup.ps1`.
2. **Cloud Harvester Artifact Safeguard**:
   - Add an `actions/upload-artifact@v4` step in `.github/workflows/24-7-cloud-harvester.yml` if `git push` fails, ensuring that harvested dossiers are uploaded as GitHub workflow artifacts even if remote git sync fails.
3. **Automate Graph Sync**:
   - Add a lightweight post-harvest hook in `multi-agent-fleet.mjs` to refresh `relationship-graph.json` after batch completion.
4. **Scheduled Restore Drill**:
   - Schedule a weekly dry-run restore check in Windows Task Scheduler to confirm snapshot manifest validity.

---

## 8. Epistemic Readiness Classifications

- **Automatic Learning Persistence**: `VERIFIED`
- **Local Automatic Backup**: `VERIFIED`
- **Remote Vault Synchronization**: `FAILED` / `UNRELIABLE`
- **Disaster Recovery**: `VERIFIED`
- **Overall Operational Readiness**: `CONDITIONALLY READY (Local Only)` / `BLOCKED FOR CLOUD HARVESTING`

---

## 9. Final Policy Decision

In strict observance of user directives and safety protocols:
**24/7 Cloud Harvesting is NOT authorized or initiated in this mission.**
The system awaits human review of the remote vault sync timeout finding and explicit human authorization before activating cloud or live harvesting loops.

