# Daily Harvesting Verification Matrix & Evidence Ledger
### *Empirical Verification Protocol: Inspected, Verified, Rejected, and Uncertain Records*

> **Hard Invariant**:  
> Every automated harvesting cycle must log its verification findings here.  
> An AI claim or synthesis is **NEVER** accepted as verified without empirical citations (commit diffs, test suites, or runtime reproduction).

---

## 1. Verification Outcome Definitions

| Status | Definition | Routing Action |
| :--- | :--- | :--- |
| **`VERIFIED`** | Hypothesis supported by reproducible test suite, production commit patch, or live runtime execution. | Promoted to `05_KNOWLEDGE/engineering-patterns.md` with stable Rule number. |
| **`PARTIALLY_VERIFIED`** | Pattern holds in specific environments but has known edge cases or missing proofs. | Staged in `11_INBOX` or logged in `07_PROJECT_LEARNING` with explicit boundary scope. |
| **`REJECTED`** | Hypothesis disproven by code inspection, test failure, or demonstrated anti-pattern. | Logged below with rejection rationale. **Blocked from promotion.** |
| **`UNCERTAIN`** | Promising discovery, but insufficient empirical evidence or test coverage in source repo. | Kept in `11_INBOX/candidate-directives/` pending deeper inspection. |

---

## 2. Daily Harvesting Verification Log

| Cycle ID | Timestamp (UTC) | Source Inspected | Evidence Type | Verification Status | Promoted Target / Dossier | SHA-256 Verified |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `CYCLE-20261009-01` | `2026-10-09T03:32:36Z` | `oven-sh/bun` | Commit diff / hook runner | `VERIFIED` | `Rule 255` in `05_KNOWLEDGE` | Yes (`a4c3...`) |
| `CYCLE-20261009-02` | `2026-10-09T03:32:36Z` | `astral-sh/uv` | Lockfile parser / Wheel spec | `VERIFIED` | `Rule 256` in `05_KNOWLEDGE` | Yes (`b19e...`) |
| `CYCLE-20261009-03` | `2026-10-09T03:32:36Z` | `tailscale/tailscale` | WireGuard session rekeying | `VERIFIED` | `Rule 257` in `05_KNOWLEDGE` | Yes (`c74f...`) |
| `CYCLE-20261009-04` | `2026-10-09T03:32:36Z` | `tauri-apps/tauri` | IPC command allowlist test | `VERIFIED` | `Rule 258` in `05_KNOWLEDGE` | Yes (`d321...`) |
| `CYCLE-20261008-01` | `2026-10-08T16:52:27Z` | `expressjs/cors` | Middleware options test | `PROJECT_ONLY` | `07_PROJECT_LEARNING/expressjs-cors-learnings.md` | Yes (`7a64...`) |
| `CYCLE-20261008-02` | `2026-10-08T16:54:44Z` | `meta-llama/Llama-3.2-1B` | Model card & license config | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-3.2-1b-learnings.md` | Yes (`a4c3...`) |

---

## 3. Rejected & Uncertain Candidates Ledger

### Rejected Candidates
* **Candidate**: `Synthetic Model Distillation Pipeline`
  * *Claim*: Automatically compiling AI outputs to fine-tune competing models.
  * *Evidence Inspected*: Provider Terms of Service, evaluation leakage risks.
  * *Outcome*: **REJECTED** (Rule 17 Violation). Stored in `01_CORE/operating-rules.md` as strict negative constraint.
* **Candidate**: `Blind Regex HTML/CRLF Stripping in Batch Scripts`
  * *Claim*: Regex stripping of all `\r` without carriage return normalization.
  * *Evidence Inspected*: Windows Git Bash CRLF file corruption test suite.
  * *Outcome*: **REJECTED**. Rule 15 requires AST or stream-buffered platform-aware line normalization.

### Uncertain Candidates Staged in `11_INBOX`
* **Candidate**: `Zero-Hydration Micro-Island State Sync over BroadcastChannel`
  * *Source*: `withastro/astro` experimental issues.
  * *Status*: **UNCERTAIN**. Requires controlled multi-tab latency benchmarks across mobile WebKit before promotion to `05_KNOWLEDGE`. Staged in `11_INBOX/candidate-directives/`.

---
*Maintained under Rule 25 (AI-BUILDER-BRAIN Daily Auto-Harvesting Persistence Rule).*
| `CYCLE-20261011-OOKZ` | `2026-10-11T07:44:05.747Z` | `test-org/gateway-verifier` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-org-gateway-verifier-learnings.md` | Yes (`da33a3f8...`) |
| `CYCLE-20261011-OOUT` | `2026-10-11T07:44:06.101Z` | `test-org/rule-verifier` | Commit diff / Patch analysis | `VERIFIED` | `Rule 259` | Yes (`115032c5...`) |
| `CYCLE-20261011-0419` | `2026-10-11T07:52:58.989Z` | `shadcn-ui/ui` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/shadcn-ui-ui-learnings.md` | Yes (`a158393a...`) |
| `CYCLE-20261011-K7AG` | `2026-10-11T08:08:36.328Z` | `expressjs/cors` | Commit diff / Patch analysis | `VERIFIED` | `Rule 260` | Yes (`a23344a6...`) |
| `CYCLE-20261011-K8LK` | `2026-10-11T08:08:38.024Z` | `expressjs/cors` | Commit diff / Patch analysis | `VERIFIED` | `Rule 260` | Yes (`a23344a6...`) |
| `CYCLE-20261011-NDIK` | `2026-10-11T08:11:04.364Z` | `test-org/test-idempotent-repo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-e2e-idempotent-slug-learnings.md` | Yes (`f76b99ef...`) |
| `CYCLE-20261011-NDP7` | `2026-10-11T08:11:04.603Z` | `test-org/test-idempotent-repo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-e2e-idempotent-slug-learnings.md` | Yes (`f76b99ef...`) |
| `CYCLE-20261011-NEX6` | `2026-10-11T08:11:06.186Z` | `expressjs/cors` | Commit diff / Patch analysis | `VERIFIED` | `Rule 260` | Yes (`2ee3af3d...`) |
| `CYCLE-20261011-NFPG` | `2026-10-11T08:11:07.204Z` | `expressjs/cors` | Commit diff / Patch analysis | `VERIFIED` | `Rule 260` | Yes (`2ee3af3d...`) |
| `CYCLE-20261011-NPJT` | `2026-10-11T08:11:19.961Z` | `test-org/gateway-verifier` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-org-gateway-verifier-learnings.md` | Yes (`186dce14...`) |
| `CYCLE-20261011-NPTF` | `2026-10-11T08:11:20.307Z` | `test-org/rule-verifier` | Commit diff / Patch analysis | `VERIFIED` | `Rule 259` | Yes (`88d7aa2a...`) |
| `CYCLE-20261011-RI4B` | `2026-10-11T08:14:16.955Z` | `test-org/test-idempotent-repo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-e2e-idempotent-slug-learnings.md` | Yes (`70fd8c65...`) |
| `CYCLE-20261011-RI7Q` | `2026-10-11T08:14:17.078Z` | `test-org/test-idempotent-repo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-e2e-idempotent-slug-learnings.md` | Yes (`70fd8c65...`) |
| `CYCLE-20261011-RJD6` | `2026-10-11T08:14:18.570Z` | `expressjs/cors` | Commit diff / Patch analysis | `VERIFIED` | `Rule 260` | Yes (`cb5f2dfe...`) |
| `CYCLE-20261011-RKB4` | `2026-10-11T08:14:19.792Z` | `expressjs/cors` | Commit diff / Patch analysis | `VERIFIED` | `Rule 260` | Yes (`cb5f2dfe...`) |
| `CYCLE-20261011-WV6C` | `2026-10-11T08:18:27.156Z` | `slopus/happy` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/slopus-happy-learnings.md` | Yes (`9e32d3b0...`) |
| `CYCLE-20261011-AKCK` | `2026-10-11T08:29:06.308Z` | `colinhacks/zod` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/colinhacks-zod-learnings.md` | Yes (`17cb722a...`) |
| `CYCLE-20261011-GO9V` | `2026-10-11T08:33:51.331Z` | `Bingsu/adetailer` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-bingsu-adetailer-learnings.md` | Yes (`a9c1ede9...`) |
| `CYCLE-20261011-K1DR` | `2026-10-11T08:36:28.287Z` | `lilylilith/QI_2.1_AnyAngle` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-lilylilith-qi_2.1_anyangle-learnings.md` | Yes (`9951bec2...`) |
| `CYCLE-20261011-NOUZ` | `2026-10-11T08:39:18.683Z` | `BAAI/bge-large-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-large-en-v1.5-learnings.md` | Yes (`92cea6b7...`) |
| `CYCLE-20261011-SPIO` | `2026-10-11T08:43:12.816Z` | `zai-org/GLM-5.3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-zai-org-glm-5.3-learnings.md` | Yes (`f2842313...`) |
| `CYCLE-20261011-W714` | `2026-10-11T08:45:55.480Z` | `mudler/locate-anything.cpp-gguf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-mudler-locate-anything.cpp-gguf-learnings.md` | Yes (`81e0da70...`) |
| `CYCLE-20261011-1C9P` | `2026-10-11T08:49:55.549Z` | `jialinyyzz/humanizer` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-jialinyyzz-humanizer-learnings.md` | Yes (`efddf4d6...`) |
| `CYCLE-20261011-4YX4` | `2026-10-11T08:52:44.872Z` | `autotrust/JEV-27B-VL` | Commit diff / Patch analysis | `VERIFIED` | `Rule 261, Rule 262` | Yes (`4d03a067...`) |
| `CYCLE-20261011-A1LL` | `2026-10-11T08:56:41.625Z` | `autotrust/GEV-26B-Decide` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-gev-26b-decide-learnings.md` | Yes (`a8a1dd1b...`) |
