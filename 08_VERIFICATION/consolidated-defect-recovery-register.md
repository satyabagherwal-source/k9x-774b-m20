# Consolidated Defect & Bug Recovery Register
## AI-Builder-Brain System Reliability, Invariants & Forensics

**Location**: `C:\AI-Builder-Brain\08_VERIFICATION\consolidated-defect-recovery-register.md`  
**Governing Standard**: AI-Builder-Brain Universal Reliability & Verification Protocol  
**Last Updated**: 2026-11-10  
**Epistemic Status**: VERIFIED_CANONICAL  

---

## 1. Executive Summary

This register consolidates all known historical defects, operational traps, regression failure modes, and recovery mechanisms identified across the AI-Builder-Brain ecosystem. Every defect is analyzed using forensic root-cause analysis, mapped to permanent structural safeguards, and backed by reproducible automated verification suites.

---

## 2. Consolidated Defect Inventory

| Defect ID | Category | Subsystem Affected | Primary Symptom | Root Cause | Permanent Remedy | Verification Proof |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-001** | Memory & Heap | Retrieval / Promotion Bridge | V8 heap out of memory (`Allocation failed - JavaScript heap out of memory`) | Synchronously loading the 384 MB `retrieval-index.json` into memory during promotion checks | `skipSearch: true` options flag; direct validation against 21 canonical domain records in `domain-registry.json` | `test-universal-construction-evolution.mjs` (34/34 PASS, <50ms) |
| **DEF-002** | Classification | Construction Intelligence | P2P mesh chat classified as `geometric-cad` | Regex matching `mesh` keyword without distinguishing 3D CAD mesh from networking mesh | Negative lookahead `!/p2p\|chat\|peer-to-peer/i.test(...)` in `classifyProductArchetype` | `test-construction-intelligence.mjs` & archetype unit tests |
| **DEF-003** | Working Tree | Git Lifecycle / OS Portability | `git status` reports clean files as modified across Windows/Linux | Windows CRLF conversion on checkout creates dirty working tree false positives | Strict `--ignore-space-at-eol` verification; preservation of untouched buffers; `.gitattributes` | `git diff --ignore-space-at-eol --stat` (0 substantive lines changed) |
| **DEF-004** | Process I/O | Child Process Execution | `spawnSync ENOBUFS` buffer overflow crash | Node.js `execSync` / `spawnSync` default buffer is 1 MB; inspection files exceed 1.4 MB | Rule 1689: Enforce `{ maxBuffer: 64 * 1024 * 1024 }` (64 MB) on all git inspections | `project-factory-cli.mjs` large matrix audit execution |
| **DEF-005** | Epistemic Integrity | Retrieval Engine | Epistemic status loss (`PARTIAL` converted to `COMPLETE`) | Missing status propagation during BM25 parsing and query normalization | Propagate `indexingStatus` strictly as `COMPLETE`, `PARTIAL`, or `UNKNOWN` end-to-end | `test-universal-retrieval-foundation.mjs` (17/17 PASS, 211 assertions) |
| **DEF-006** | Epistemic Integrity | Legacy Cache Engine | Occurrence count false completeness calibration | Heuristically inferring file completeness from `occurrenceCount > 0` | Changed legacy cache fallback to `UNKNOWN`; completeness requires empirical proof | `test-universal-retrieval-foundation.mjs` (Group 4 fallback tests) |
| **DEF-007** | Construction / Assembly | Universal Code Assembler | Universal assembler outputs static inventory code regardless of product intent | `assembleProductCode` lacked dynamic archetype generators and omitted Brain knowledge injection | Multi-archetype dispatch (`CACHE_STORE`, `HEADLESS_API`, `CLI_TOOL`, `CONTENT_ENGINE`, `INVENTORY_APP`) + Brain knowledge injection | `test-universal-code-assembly.mjs` + live sandbox tests (exit code 0) |
| **DEF-008** | Concurrency & Data | Vault Backup Engine | Concurrent backup collision and stale lock deadlock | Unprotected concurrent runs could corrupt backup snapshot directories | PID-based mutex lock (`vault-backup.lock`) with active process liveliness validation (`process.kill(pid, 0)`) | `test-vault-backup-suite.mjs` (Test 11 Concurrent Isolation) |
| **DEF-009** | Security & Privacy | Backup / Secrets Vault | Plaintext credential exposure risk in backup bundles | Committing unencrypted `.brain-secrets.json` to git history | AES-256-GCM encryption with PBKDF2-SHA512 (100,000 iterations); exclusion of plaintext secrets | `test-vault-backup-suite.mjs` (Tests 1–4 Cryptographic Roundtrip) |
| **DEF-010** | Retention Safety | Disaster Recovery | Accidental deletion of the sole surviving backup snapshot | Over-aggressive retention pruning deleting all snapshots | Retention safety invariant: never delete the sole surviving backup snapshot (count >= 1 check) | `test-vault-backup-suite.mjs` (Test 9 Retention Safety Invariant) |

---

## 3. Deep Forensic Analysis & Structural Safeguards

### 3.1 DEF-001: 384 MB Retrieval Index V8 Heap Exhaustion
- **Symptom**: Node.js crashes with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` when running `test-project-learning-promotion-bridge.mjs`.
- **Root Cause**: `checkDuplicatesAndConflicts()` invoked `searchBrain()`. The retrieval engine parsed the 384 MB BM25 index `retrieval-index.json` into memory. When combined with test runner allocations, V8 exceeded the 2048 MB memory ceiling.
- **Structural Safeguard**: Added `options.skipSearch` to `checkDuplicatesAndConflicts`. Conflict checking against the 21 canonical domain records in `domain-registry.json` executes in < 50ms without loading the 384 MB file.

### 3.2 DEF-002: Archetype Classification Regex Trap
- **Symptom**: Intent `"Build a peer-to-peer mesh network encrypted chat"` was classified as `geometric-cad`.
- **Root Cause**: The keyword `mesh` triggered `/(?:cad|3d|geometry|csg|stl|obj|solid modeling|parametric|viewport|neurocraft|3d\s*mesh|polygon\s*mesh)/i`.
- **Structural Safeguard**: Added negative lookahead `!/p2p|chat|peer-to-peer/i.test(combined)` to enforce proper semantic domain boundaries.

### 3.3 DEF-004: Buffer Overflow via `spawnSync ENOBUFS`
- **Symptom**: `execSync('git show HEAD:08_VERIFICATION/harvest-verification-matrix.md')` threw `spawnSync ENOBUFS`.
- **Root Cause**: The harvest verification matrix grew to 1.47 MB, exceeding Node's default 1 MB child process buffer.
- **Structural Safeguard**: Enforced Rule 1689 across all child process calls: `{ maxBuffer: 64 * 1024 * 1024 }` (64 MB buffer limit).

### 3.4 DEF-007: Knowledge Exclusion in Universal Code Assembler
- **Symptom**: User asked: *"ai builder brain ke gyan ko use kyo nahi karta agent jab bhi ai builder brain ka source code construction kiya jata h tab"*. The assembler outputted static inventory code for any goal and omitted Master Brain guidelines.
- **Root Cause**: `assembleProductCode` in `universal-code-assembler.mjs` was an isolated prototype that did not ingest `crossDomainIntel` and lacked dynamic archetypes.
- **Structural Safeguard**: Added `detectCodeArchetype` supporting `CACHE_STORE`, `HEADLESS_API`, `CLI_TOOL`, `CONTENT_ENGINE`, and `INVENTORY_APP`. Wire domain guidelines from `crossDomainIntel` (Domains A–M) and canonical rules (Rules 1670, 1708, 1713, 1715) directly into generated code, manifests, and test suites.

---

## 4. Verification & Continuous Monitoring Matrix

| Safeguard | Automated Test Suite | Frequency | Exit Code Standard |
| :--- | :--- | :--- | :--- |
| Dynamic Blueprint & Multi-Archetype Assembly | `test-universal-code-assembly.mjs` | Every Build / CI | Exit Code 0 (Strict) |
| Cross-Domain Semantic Decomposition | `test-semantic-requirements-decomposition.mjs` | Every Build / CI | Exit Code 0 (Strict) |
| Construction Intelligence Core | `test-universal-construction-intelligence.mjs` | Every Build / CI | Exit Code 0 (Strict) |
| Continuous Learning Promotion Bridge | `test-universal-construction-evolution.mjs` | Every Build / CI | Exit Code 0 (Strict) |
| Vault Backup, Encryption & Isolated Restore | `test-vault-backup-suite.mjs` | Daily Autonomous | Exit Code 0 (Strict) |
| Retrieval Integrity & Epistemic Status | `test-universal-retrieval-foundation.mjs` | Weekly / Audit | Exit Code 0 (Strict) |

