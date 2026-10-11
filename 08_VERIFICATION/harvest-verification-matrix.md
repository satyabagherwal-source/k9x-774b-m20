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
| `CYCLE-20261011-FCYZ` | `2026-10-11T09:00:49.643Z` | `convaiinnovations/laya` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-convaiinnovations-laya-learnings.md` | Yes (`a683c478...`) |
| `CYCLE-20261011-OR5S` | `2026-10-11T09:08:07.936Z` | `Edge0/Audio8-ASR-Infinite` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-edge0-audio8-asr-infinite-learnings.md` | Yes (`25ecd6af...`) |
| `CYCLE-20261011-USCT` | `2026-10-11T09:12:49.421Z` | `abenzerps/Qwen-Image-2.1-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-gguf-learnings.md` | Yes (`3aebdece...`) |
| `CYCLE-20261011-ZNNB` | `2026-10-11T09:16:36.599Z` | `sentence-transformers/all-MiniLM-L6-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-all-minilm-l6-v2-learnings.md` | Yes (`44656e75...`) |
| `CYCLE-20261011-5AHK` | `2026-10-11T09:20:59.480Z` | `cross-encoder/ms-marco-MiniLM-L6-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cross-encoder-ms-marco-minilm-l6-v2-learnings.md` | Yes (`1e9c6bb4...`) |
| `CYCLE-20261011-A7U4` | `2026-10-11T09:24:49.324Z` | `BAAI/bge-small-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-small-en-v1.5-learnings.md` | Yes (`83b69df4...`) |
| `CYCLE-20261011-5YZO` | `2026-10-11T09:49:30.852Z` | `autotrust/GLM5.3-Flash-E224-DGX-Spark` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-glm5.3-flash-e224-dgx-spark-learnings.md` | Yes (`3807cf57...`) |
| `CYCLE-20261011-RMN4` | `2026-10-11T10:06:21.280Z` | `LiquidAI/d1-3B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-liquidai-d1-3b-learnings.md` | Yes (`57bfb6f6...`) |
| `CYCLE-20261011-WN5M` | `2026-10-11T10:10:15.226Z` | `Cactus-Compute/whistle` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cactus-compute-whistle-learnings.md` | Yes (`cb026f1e...`) |
| `CYCLE-20261011-6PCL` | `2026-10-11T10:18:04.629Z` | `Qwen/Qwen3.8-27B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3.8-27b-learnings.md` | Yes (`da90061c...`) |
| `CYCLE-20261011-BE6V` | `2026-10-11T10:21:43.447Z` | `black-forest-labs/FLUX.1-dev` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-black-forest-labs-flux.1-dev-learnings.md` | Yes (`4ea6f37b...`) |
| `CYCLE-20261011-F5VU` | `2026-10-11T10:24:39.306Z` | `FrancisRing/Prism` | Commit diff / Patch analysis | `VERIFIED` | `Rule 263, Rule 264` | Yes (`905b0422...`) |
| `CYCLE-20261011-J7YE` | `2026-10-11T10:27:48.614Z` | `orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF` | Commit diff / Patch analysis | `VERIFIED` | `Rule 265` | Yes (`6db6f53b...`) |
| `CYCLE-20261011-N11N` | `2026-10-11T10:30:46.283Z` | `autotrust/GEV-26B-Decide-NVFP4` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-gev-26b-decide-nvfp4-learnings.md` | Yes (`67189bce...`) |
| `CYCLE-20261011-RABJ` | `2026-10-11T10:34:04.927Z` | `SC117/Qwen3.8-Flash-Next-GSQ-RCO-abliterated-GGUF` | Commit diff / Patch analysis | `VERIFIED` | `Rule 266` | Yes (`4589ffd6...`) |
| `CYCLE-20261011-V1HV` | `2026-10-11T10:37:00.115Z` | `deepseek-ai/DeepSeek-R1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 267` | Yes (`c7287036...`) |
| `CYCLE-20261011-YP7F` | `2026-10-11T10:39:50.811Z` | `moonshotai/Kimi-K3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-moonshotai-kimi-k3-learnings.md` | Yes (`a878c735...`) |
| `CYCLE-20261011-3M2R` | `2026-10-11T10:43:40.035Z` | `stabilityai/stable-diffusion-xl-base-1.0` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-stabilityai-stable-diffusion-xl-base-1.0-learnings.md` | Yes (`a3d70fdb...`) |
| `CYCLE-20261011-7M63` | `2026-10-11T10:46:46.779Z` | `meta-llama/Llama-3.1-8B-Instruct` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-3.1-8b-instruct-learnings.md` | Yes (`689afaf3...`) |
| `CYCLE-20261011-BKS5` | `2026-10-11T10:49:51.605Z` | `XingChen-AGI/TeleOCR` | Commit diff / Patch analysis | `VERIFIED` | `Rule 268, Rule 269` | Yes (`7e3a1889...`) |
| `CYCLE-20261011-FAR8` | `2026-10-11T10:52:45.236Z` | `Qwen/Qwen-Image-2.1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 270` | Yes (`9f45356e...`) |
| `CYCLE-20261011-J27M` | `2026-10-11T10:55:40.786Z` | `Contrastive-LM/CLM-v0.1-8B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 271` | Yes (`93e41bd8...`) |
| `CYCLE-20261011-MPI0` | `2026-10-11T10:58:30.936Z` | `nvidia/Nemotron-3-Diarization` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nvidia-nemotron-3-diarization-learnings.md` | Yes (`73c65b4e...`) |
| `CYCLE-20261011-QMGY` | `2026-10-11T11:01:33.634Z` | `Lightricks/LTX-2.5` | Commit diff / Patch analysis | `VERIFIED` | `Rule 272, Rule 273` | Yes (`580ff7e3...`) |
| `CYCLE-20261011-UV2G` | `2026-10-11T11:04:51.400Z` | `prism-ml/Ternary-Bonsai-2-27B-gguf` | Commit diff / Patch analysis | `VERIFIED` | `Rule 274` | Yes (`924f18c6...`) |
| `CYCLE-20261011-YOUN` | `2026-10-11T11:07:49.967Z` | `Viggle/Qwen-Image-2.1-viggle-turbo` | Commit diff / Patch analysis | `VERIFIED` | `Rule 275` | Yes (`7f9ca8a9...`) |
| `CYCLE-20261011-2CP5` | `2026-10-11T11:10:40.841Z` | `Qwen/Qwen-Image-2.1-Turbo` | Commit diff / Patch analysis | `VERIFIED` | `Rule 276, Rule 277` | Yes (`f75ae718...`) |
| `CYCLE-20261011-5XZT` | `2026-10-11T11:13:28.409Z` | `XingChen-AGI/Xing4.0-29B-A4B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xingchen-agi-xing4.0-29b-a4b-learnings.md` | Yes (`3542477b...`) |
| `CYCLE-20261011-ACEY` | `2026-10-11T11:16:53.722Z` | `SupersonicLabs/Julia-1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 278, Rule 279` | Yes (`16b49b88...`) |
| `CYCLE-20261011-ECR4` | `2026-10-11T11:20:00.784Z` | `apple/LensVLM-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 280, Rule 281` | Yes (`ba8376cb...`) |
| `CYCLE-20261011-I0Y9` | `2026-10-11T11:22:52.113Z` | `Altworld/Hemmingway-1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 282, Rule 283` | Yes (`087b5559...`) |
| `CYCLE-20261011-2T59` | `2026-10-11T11:39:01.773Z` | `fastino/GLiNER2.5-Decide` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-fastino-gliner2.5-decide-learnings.md` | Yes (`c39dee82...`) |
| `CYCLE-20261011-6PAW` | `2026-10-11T11:42:03.416Z` | `ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-27b-gsq-rco-gguf-learnings.md` | Yes (`74066af1...`) |
| `CYCLE-20261011-AA30` | `2026-10-11T11:44:50.316Z` | `orcarouter/OrcaSAQ-2-27B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-orcarouter-orcasaq-2-27b-learnings.md` | Yes (`436c5819...`) |
| `CYCLE-20261011-DY0Q` | `2026-10-11T11:47:41.306Z` | `TaichuAI/ZDTaichu5.0-9B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-taichuai-zdtaichu5.0-9b-learnings.md` | Yes (`9a14c3d6...`) |
| `CYCLE-20261011-HIRY` | `2026-10-11T11:50:28.174Z` | `Phocinae/Phocinae-Largha-150M-v1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 284, Rule 285` | Yes (`0f116edf...`) |
| `CYCLE-20261011-LNHR` | `2026-10-11T11:53:40.911Z` | `Comfy-Org/Qwen-Image-2.1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 286, Rule 287` | Yes (`0d802a4b...`) |
| `CYCLE-20261011-PMZ1` | `2026-10-11T11:56:46.861Z` | `akhilaaa3/Jev-Omni` | Commit diff / Patch analysis | `VERIFIED` | `Rule 288, Rule 289` | Yes (`ad1ca98a...`) |
| `CYCLE-20261011-T3Y9` | `2026-10-11T11:59:28.833Z` | `XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xiaomimimo-mimo-v2.6-distill-qwen-9b-learnings.md` | Yes (`3c944c82...`) |
| `CYCLE-20261011-WXQ8` | `2026-10-11T12:02:27.392Z` | `inclusionAI/Ming-Image-0.1-Design` | Commit diff / Patch analysis | `VERIFIED` | `Rule 290, Rule 291` | Yes (`59f7c6d7...`) |
| `CYCLE-20261011-0O0U` | `2026-10-11T12:05:21.438Z` | `deepseek-ai/DeepSeek-V4.1-Flash` | Commit diff / Patch analysis | `VERIFIED` | `Rule 292` | Yes (`d7058691...`) |
| `CYCLE-20261011-48OR` | `2026-10-11T12:08:08.187Z` | `akatz-ai/MiniMax-H3-Character-Swap-LoRA` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-akatz-ai-minimax-h3-character-swap-lora-learnings.md` | Yes (`52668650...`) |
| `CYCLE-20261011-8JVR` | `2026-10-11T12:11:29.319Z` | `unsloth/Qwen-Image-2.1-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-qwen-image-2.1-gguf-learnings.md` | Yes (`8dd98140...`) |
| `CYCLE-20261011-CM48` | `2026-10-11T12:14:38.840Z` | `XiaomiMiMo/MiMo-V2.6-Pro-RL` | Commit diff / Patch analysis | `VERIFIED` | `Rule 293, Rule 294` | Yes (`3be2363f...`) |
| `CYCLE-20261011-GBCY` | `2026-10-11T12:17:31.522Z` | `orcarouter/OrcaSAQ-2-Cyber-27B-Uncensored-GGUF` | Commit diff / Patch analysis | `VERIFIED` | `Rule 295` | Yes (`1ea13e7c...`) |
| `CYCLE-20261011-JX3P` | `2026-10-11T12:20:19.669Z` | `Alissonerdx/BFS-Best-Face-Swap` | Commit diff / Patch analysis | `VERIFIED` | `Rule 296` | Yes (`dc0aeca6...`) |
| `CYCLE-20261011-NIG8` | `2026-10-11T12:23:07.304Z` | `ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ukisai-swift-1.5-qwen3.8-27b-gsq-rco-gguf-learnings.md` | Yes (`2b4224a8...`) |
| `CYCLE-20261011-R345` | `2026-10-11T12:25:54.053Z` | `nerkyor/Qwen3.8-27B-Coder390-EfficientThink-Opus5.5-GPT6Astra-Grok4.7-DSV4Pro-K3-SFT-RLOO-MTP-DFlash2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nerkyor-qwen3.8-27b-coder390-efficientthink-opus5.5-gpt6astra-grok4.7-dsv4pro-k3-sft-rloo-mtp-dflash2-learnings.md` | Yes (`435531ac...`) |
| `CYCLE-20261011-V139` | `2026-10-11T12:28:58.053Z` | `PSRben/VisionHOPE` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-psrben-visionhope-learnings.md` | Yes (`d25d1b04...`) |
| `CYCLE-20261011-Z21N` | `2026-10-11T12:32:05.915Z` | `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-Coder-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-flash-next-gsq-rco-coder-gguf-learnings.md` | Yes (`ca5ea950...`) |
| `CYCLE-20261011-2P3J` | `2026-10-11T12:34:55.759Z` | `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings.md` | Yes (`8b0bfd19...`) |
| `CYCLE-20261011-66EF` | `2026-10-11T12:37:38.151Z` | `facebook/sam3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-facebook-sam3-learnings.md` | Yes (`e51015cb...`) |
| `CYCLE-20261011-9O5Y` | `2026-10-11T12:40:21.142Z` | `unsloth/Qwen3.8-27B-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-qwen3.8-27b-gguf-learnings.md` | Yes (`ae6b0cb8...`) |
| `CYCLE-20261011-DHSU` | `2026-10-11T12:43:19.518Z` | `DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-davidau-qwen3.8-27b-turbo-fable-cold-fusion-735-882-heretic-uncensored-neo-coder-max-mtp-gguf-learnings.md` | Yes (`e87b4cce...`) |
| `CYCLE-20261011-HNZN` | `2026-10-11T12:46:34.163Z` | `canberkkkkkk/ema-lightning` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-canberkkkkkk-ema-lightning-learnings.md` | Yes (`54903a97...`) |
| `CYCLE-20261011-LSAN` | `2026-10-11T12:49:46.367Z` | `google/embeddinggemma-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-embeddinggemma-2-learnings.md` | Yes (`9af990d1...`) |
| `CYCLE-20261011-PC2R` | `2026-10-11T12:52:31.971Z` | `unsloth/embeddinggemma-2-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-embeddinggemma-2-gguf-learnings.md` | Yes (`1d53d3c2...`) |
| `CYCLE-20261011-T42G` | `2026-10-11T12:55:28.216Z` | `Cloudflare/clef` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cloudflare-clef-learnings.md` | Yes (`86f423a2...`) |
| `CYCLE-20261011-WUJX` | `2026-10-11T12:58:22.509Z` | `Cloudflare/clef-flash` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cloudflare-clef-flash-learnings.md` | Yes (`7a773876...`) |
| `CYCLE-20261011-0OZX` | `2026-10-11T13:01:21.933Z` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Commit diff / Patch analysis | `VERIFIED` | `Rule 297` | Yes (`5f2270e4...`) |
| `CYCLE-20261011-4I0T` | `2026-10-11T13:04:19.517Z` | `google-bert/bert-base-uncased` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-bert-bert-base-uncased-learnings.md` | Yes (`bd991783...`) |
| `CYCLE-20261011-8G0R` | `2026-10-11T13:07:23.547Z` | `google/electra-base-discriminator` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-electra-base-discriminator-learnings.md` | Yes (`70d47e80...`) |
| `CYCLE-20261011-C50Y` | `2026-10-11T13:10:15.922Z` | `BAAI/bge-m3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-m3-learnings.md` | Yes (`32e47265...`) |
| `CYCLE-20261011-FVVB` | `2026-10-11T13:13:10.679Z` | `Qwen/Qwen3-0.6B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-0.6b-learnings.md` | Yes (`bc5661c6...`) |
| `CYCLE-20261011-JNSJ` | `2026-10-11T13:16:06.835Z` | `google-t5/t5-small` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-t5-t5-small-learnings.md` | Yes (`bc95e041...`) |
| `CYCLE-20261011-N966` | `2026-10-11T13:18:54.510Z` | `Comfy-Org/MiniMax-H3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-comfy-org-minimax-h3-learnings.md` | Yes (`33c64250...`) |
| `CYCLE-20261011-RALF` | `2026-10-11T13:22:02.979Z` | `AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-atomicchat-qwen-image-2.1-turbo-uncensored-gguf-learnings.md` | Yes (`1971b557...`) |
| `CYCLE-20261011-VEI8` | `2026-10-11T13:25:14.672Z` | `timm/mobilenetv3_small_100.lamb_in1k` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-timm-mobilenetv3_small_100.lamb_in1k-learnings.md` | Yes (`20e7f6ab...`) |
| `CYCLE-20261011-Z1QZ` | `2026-10-11T13:28:04.763Z` | `amazon/chronos-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-amazon-chronos-2-learnings.md` | Yes (`001482e7...`) |
| `CYCLE-20261011-30ZK` | `2026-10-11T13:31:10.400Z` | `CompVis/stable-diffusion-v1-4` | Commit diff / Patch analysis | `VERIFIED` | `Rule 298` | Yes (`1faab220...`) |
| `CYCLE-20261011-6LIX` | `2026-10-11T13:33:56.985Z` | `meta-llama/Meta-Llama-3-8B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-meta-llama-3-8b-learnings.md` | Yes (`d0afebd8...`) |
| `CYCLE-20261011-ABH4` | `2026-10-11T13:36:50.584Z` | `microsoft/FrogNano-4B-2609` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-microsoft-frognano-4b-2609-learnings.md` | Yes (`88f58e2f...`) |
| `CYCLE-20261011-EJOB` | `2026-10-11T13:40:07.835Z` | `hexgrad/Kokoro-82M` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-hexgrad-kokoro-82m-learnings.md` | Yes (`a62df5c8...`) |
| `CYCLE-20261011-IN0W` | `2026-10-11T13:43:18.800Z` | `openai/whisper-large-v3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-whisper-large-v3-learnings.md` | Yes (`82a71283...`) |
| `CYCLE-20261011-MI7I` | `2026-10-11T13:46:19.182Z` | `black-forest-labs/FLUX.1-schnell` | Commit diff / Patch analysis | `VERIFIED` | `Rule 299, Rule 300, Rule 301` | Yes (`f2b42410...`) |
| `CYCLE-20261011-Q47I` | `2026-10-11T13:49:07.662Z` | `MiniMaxAI/MiniMax-H3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-minimaxai-minimax-h3-learnings.md` | Yes (`28558981...`) |
| `CYCLE-20261011-TS1B` | `2026-10-11T13:51:58.511Z` | `Qwen/Qwen3.8-Flash-Next` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3.8-flash-next-learnings.md` | Yes (`6f525079...`) |
| `CYCLE-20261011-XW4R` | `2026-10-11T13:55:10.443Z` | `deepseek-ai/DeepSeek-V4-Pro` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v4-pro-learnings.md` | Yes (`0da53bba...`) |
| `CYCLE-20261011-1TJR` | `2026-10-11T13:58:13.719Z` | `Tongyi-MAI/Z-Image-Turbo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-tongyi-mai-z-image-turbo-learnings.md` | Yes (`7891ae25...`) |
| `CYCLE-20261011-5S9K` | `2026-10-11T14:01:18.680Z` | `meta-llama/Meta-Llama-3-8B-Instruct` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-meta-llama-3-8b-instruct-learnings.md` | Yes (`3942f84e...`) |
| `CYCLE-20261011-9EYN` | `2026-10-11T14:04:08.063Z` | `openai/gpt-oss-120b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-gpt-oss-120b-learnings.md` | Yes (`6d6cfa04...`) |
| `CYCLE-20261011-D2NP` | `2026-10-11T14:06:58.741Z` | `zai-org/GLM-5.2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-zai-org-glm-5.2-learnings.md` | Yes (`60c11b15...`) |
| `CYCLE-20261011-HBMX` | `2026-10-11T14:10:17.001Z` | `stabilityai/stable-diffusion-3-medium` | Commit diff / Patch analysis | `VERIFIED` | `Rule 302, Rule 303, Rule 304` | Yes (`087218eb...`) |
| `CYCLE-20261011-L1MR` | `2026-10-11T14:13:10.659Z` | `bigscience/bloom` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-bigscience-bloom-learnings.md` | Yes (`02bddb54...`) |
| `CYCLE-20261011-OSMP` | `2026-10-11T14:16:05.617Z` | `openai/gpt-oss-20b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-gpt-oss-20b-learnings.md` | Yes (`d99a9126...`) |
| `CYCLE-20261011-SD5O` | `2026-10-11T14:18:52.188Z` | `meta-llama/Llama-2-7b-chat-hf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-2-7b-chat-hf-learnings.md` | Yes (`3f9d28c5...`) |
| `CYCLE-20261011-VZKS` | `2026-10-11T14:21:41.212Z` | `meta-llama/Llama-2-7b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-2-7b-learnings.md` | Yes (`2bfa1f96...`) |
| `CYCLE-20261011-ZMMX` | `2026-10-11T14:24:31.065Z` | `mistralai/Mixtral-8x7B-Instruct-v0.1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-mistralai-mixtral-8x7b-instruct-v0.1-learnings.md` | Yes (`1b1a9dbe...`) |
| `CYCLE-20261011-3KJH` | `2026-10-11T14:27:34.973Z` | `deepseek-ai/DeepSeek-V3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v3-learnings.md` | Yes (`4c33a4e2...`) |
| `CYCLE-20261011-7PJL` | `2026-10-11T14:30:48.081Z` | `baidu/Unlimited-OCR` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baidu-unlimited-ocr-learnings.md` | Yes (`a3e1fbfb...`) |
| `CYCLE-20261011-BABI` | `2026-10-11T14:33:34.974Z` | `Aleph-Alpha/Kolibri-1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-aleph-alpha-kolibri-1-learnings.md` | Yes (`64dfad1e...`) |
| `CYCLE-20261011-F4HP` | `2026-10-11T14:36:34.045Z` | `speridlabs/iris-3b` | Commit diff / Patch analysis | `VERIFIED` | `Rule 307, Rule 308` | Yes (`637d94aa...`) |
| `CYCLE-20261011-IOU7` | `2026-10-11T14:39:20.383Z` | `Qwen/Qwen3-4B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-4b-learnings.md` | Yes (`55dd1cf6...`) |
| `CYCLE-20261011-MDFS` | `2026-10-11T14:42:12.232Z` | `FermionResearch/Phonon-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-fermionresearch-phonon-2-learnings.md` | Yes (`8c3ba495...`) |
| `CYCLE-20261011-QG4U` | `2026-10-11T14:45:22.350Z` | `Infatoshi/GLM-5.3-UNCENSORED-EXL3-3.0bpw` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-infatoshi-glm-5.3-uncensored-exl3-3.0bpw-learnings.md` | Yes (`54dd9b9d...`) |
| `CYCLE-20261011-UKJI` | `2026-10-11T14:48:34.686Z` | `pablodawson/MiniMax-H3-360-Orbit-LoRA` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-pablodawson-minimax-h3-360-orbit-lora-learnings.md` | Yes (`a9830abc...`) |
| `CYCLE-20261011-YBHO` | `2026-10-11T14:51:29.580Z` | `Venastine-Research/Xing4.0-29B-A4B-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-venastine-research-xing4.0-29b-a4b-gguf-learnings.md` | Yes (`5e235bb6...`) |
| `CYCLE-20261011-20GW` | `2026-10-11T14:54:21.920Z` | `NaiveAI/Naive-N0.5-Flash` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-naiveai-naive-n0.5-flash-learnings.md` | Yes (`f791ecb6...`) |
| `CYCLE-20261011-5O2R` | `2026-10-11T14:57:12.483Z` | `openai/clip-vit-base-patch32` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-clip-vit-base-patch32-learnings.md` | Yes (`ed2542c9...`) |
| `CYCLE-20261011-9982` | `2026-10-11T14:59:59.858Z` | `sentence-transformers/all-mpnet-base-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-all-mpnet-base-v2-learnings.md` | Yes (`fd5029ef...`) |
| `CYCLE-20261011-DE2J` | `2026-10-11T15:03:12.763Z` | `BAAI/bge-reranker-v2-m3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-reranker-v2-m3-learnings.md` | Yes (`e76df3c6...`) |
| `CYCLE-20261011-HJND` | `2026-10-11T15:06:26.617Z` | `jonatasgrosman/wav2vec2-large-xlsr-53-japanese` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-jonatasgrosman-wav2vec2-large-xlsr-53-japanese-learnings.md` | Yes (`c2b29bb5...`) |
| `CYCLE-2026-10-11-STAGED` | `2026-10-11T15:08:41.230Z` | `canonical_task_execution` | Incident Autopsy | `UNCERTAIN` | Staged in `11_INBOX/candidate-directives/CD-092-stream---asynciterable-collection-b.md` | Pending |
| `CYCLE-20261011-PIHH` | `2026-10-11T15:12:38.357Z` | `FacebookAI/xlm-roberta-base` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-facebookai-xlm-roberta-base-learnings.md` | Yes (`3ff9ca7c...`) |
| `CYCLE-20261011-UIDW` | `2026-10-11T15:16:31.508Z` | `openai-community/gpt2` | Commit diff / Patch analysis | `VERIFIED` | `Rule 309, Rule 310` | Yes (`59d53925...`) |
| `CYCLE-20261011-XXPI` | `2026-10-11T15:19:11.334Z` | `Qwen/Qwen3-VL-8B-Instruct` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-vl-8b-instruct-learnings.md` | Yes (`cc581525...`) |
| `CYCLE-20261011-1J1U` | `2026-10-11T15:21:58.962Z` | `nomic-ai/nomic-embed-text-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nomic-ai-nomic-embed-text-v1.5-learnings.md` | Yes (`cc0472cd...`) |
| `CYCLE-20261011-5AWF` | `2026-10-11T15:24:55.023Z` | `ConwayResearch/Underdog-Saluki-27B-1.0` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-conwayresearch-underdog-saluki-27b-1.0-learnings.md` | Yes (`947ded8b...`) |
| `CYCLE-20261011-9DBC` | `2026-10-11T15:28:04.777Z` | `google/gemma-4-26B-A4B-it` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-gemma-4-26b-a4b-it-learnings.md` | Yes (`f479aebe...`) |
| `CYCLE-20261011-HKD0` | `2026-10-11T15:34:27.156Z` | `Infisical/infisical` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/infisical-infisical-learnings.md` | Yes (`42a79b45...`) |
| `CYCLE-2026-10-11-RESEARCH` | `2026-10-11T15:41:57.559Z` | `redis/redis` | Targeted Research Proof | `VERIFIED` | `Rule 311` in `05_KNOWLEDGE` | Yes |
| `CYCLE-2026-10-11-RESEARCH` | `2026-10-11T15:41:58.313Z` | `auth0/node-jsonwebtoken` | Targeted Research Proof | `VERIFIED` | `Rule 312` in `05_KNOWLEDGE` | Yes |
| `CYCLE-2026-10-11-STAGED` | `2026-10-11T15:42:26.376Z` | `canonical_task_execution` | Incident Autopsy | `UNCERTAIN` | Staged in `11_INBOX/candidate-directives/CD-093-stream---asynciterable-collection-b.md` | Pending |
| `CYCLE-20261011-RWLT` | `2026-10-11T15:42:29.585Z` | `test-org/gateway-verifier` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/test-org-gateway-verifier-learnings.md` | Yes (`66cec33e...`) |
| `CYCLE-20261011-RWX3` | `2026-10-11T15:42:29.991Z` | `test-org/rule-verifier` | Commit diff / Patch analysis | `VERIFIED` | `Rule 259` | Yes (`b918a8e3...`) |
| `CYCLE-2026-10-11-RESEARCH` | `2026-10-11T15:42:31.349Z` | `animir/node-rate-limiter-flexible` | Targeted Research Proof | `VERIFIED` | `Rule 313` in `05_KNOWLEDGE` | Yes |
| `CYCLE-20261011-0PRT` | `2026-10-11T15:49:20.633Z` | `intfloat/multilingual-e5-small` | Commit diff / Patch analysis | `VERIFIED` | `Rule 314, Rule 315` | Yes (`fa832a68...`) |
| `CYCLE-20261011-4ATN` | `2026-10-11T15:52:07.883Z` | `argmaxinc/whisperkit-coreml` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-argmaxinc-whisperkit-coreml-learnings.md` | Yes (`e9750dbe...`) |
| `CYCLE-20261011-7W13` | `2026-10-11T15:54:55.335Z` | `Qwen/Qwen3-8B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-8b-learnings.md` | Yes (`af0157e7...`) |
| `CYCLE-20261011-BVJT` | `2026-10-11T15:58:01.337Z` | `google/vit-base-patch16-224` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-vit-base-patch16-224-learnings.md` | Yes (`df22ddac...`) |
| `CYCLE-20261011-FWAT` | `2026-10-11T16:01:08.933Z` | `google/gemma-4-31B-it` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-gemma-4-31b-it-learnings.md` | Yes (`eadbcf54...`) |
| `CYCLE-20261011-JXF1` | `2026-10-11T16:04:17.005Z` | `BAAI/bge-base-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-base-en-v1.5-learnings.md` | Yes (`b0617730...`) |
| `CYCLE-20261011-NMTB` | `2026-10-11T16:07:09.887Z` | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-paraphrase-multilingual-mpnet-base-v2-learnings.md` | Yes (`132cfc48...`) |
| `CYCLE-20261011-R999` | `2026-10-11T16:09:58.941Z` | `Bingsu/adetailer` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-bingsu-adetailer-learnings.md` | Yes (`cb23db52...`) |
| `CYCLE-20261011-VJCW` | `2026-10-11T16:13:18.656Z` | `lilylilith/QI_2.1_AnyAngle` | Commit diff / Patch analysis | `VERIFIED` | `Rule 316, Rule 317, Rule 318` | Yes (`d1e4afcf...`) |
| `CYCLE-20261011-ZFUX` | `2026-10-11T16:16:20.745Z` | `BAAI/bge-large-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-large-en-v1.5-learnings.md` | Yes (`7140e35e...`) |

| `CYCLE-2026-10-11-RESEARCH` | `2026-10-11T16:20:12.611Z` | `temporalio/sdk-typescript` | Targeted Research Proof | `VERIFIED` | `Rule 319` in `05_KNOWLEDGE` | Yes |
| `CYCLE-2026-10-11-STAGED` | `2026-10-11T16:20:12.611Z` | `canonical_task_execution` | Incident Autopsy | `UNCERTAIN` | Staged in `11_INBOX/candidate-directives/CD-094-stream---asynciterable-collection-b.md` | Pending || `CYCLE-2026-10-11-STAGED` | `2026-10-11T16:21:54.935Z` | `canonical_task_execution` | Incident Autopsy | `UNCERTAIN` | Staged in `11_INBOX/candidate-directives/CD-095-stream---asynciterable-collection-b.md` | Pending |
| `CYCLE-20261011-3J6T` | `2026-10-11T16:19:31.685Z` | `zai-org/GLM-5.3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-zai-org-glm-5.3-learnings.md` | Yes (`ffdba1b5...`) |
| `CYCLE-20261011-77OU` | `2026-10-11T16:22:23.406Z` | `mudler/locate-anything.cpp-gguf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-mudler-locate-anything.cpp-gguf-learnings.md` | Yes (`2c9aa70c...`) |
| `CYCLE-20261011-ATPC` | `2026-10-11T16:25:11.904Z` | `jialinyyzz/humanizer` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-jialinyyzz-humanizer-learnings.md` | Yes (`a099339a...`) |
| `CYCLE-20261011-J8Z6` | `2026-10-11T16:31:44.946Z` | `autotrust/JEV-27B-VL` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-jev-27b-vl-learnings.md` | Yes (`70fe777f...`) |
| `CYCLE-20261011-MUTX` | `2026-10-11T16:34:33.237Z` | `autotrust/GEV-26B-Decide` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-gev-26b-decide-learnings.md` | Yes (`dc5fdfc1...`) |
| `CYCLE-20261011-QQ1B` | `2026-10-11T16:37:33.647Z` | `convaiinnovations/laya` | Commit diff / Patch analysis | `VERIFIED` | `Rule 320, Rule 321` | Yes (`e82f298a...`) |
| `CYCLE-20261011-U2YZ` | `2026-10-11T16:40:10.379Z` | `Edge0/Audio8-ASR-Infinite` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-edge0-audio8-asr-infinite-learnings.md` | Yes (`73fa854c...`) |
| `CYCLE-20261011-2JH7` | `2026-10-11T16:46:45.019Z` | `autonomous-ai/openharness` | Commit diff / Patch analysis | `VERIFIED` | `Rule 322` | Yes (`cca6e6e0...`) |
| `CYCLE-20261011-KQB4` | `2026-10-11T17:00:53.680Z` | `abenzerps/Qwen-Image-2.1-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-gguf-learnings.md` | Yes (`e0a13357...`) |
| `CYCLE-20261011-OVGS` | `2026-10-11T17:04:06.988Z` | `sentence-transformers/all-MiniLM-L6-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-all-minilm-l6-v2-learnings.md` | Yes (`c83c4b17...`) |
| `CYCLE-20261011-SYKV` | `2026-10-11T17:07:17.647Z` | `cross-encoder/ms-marco-MiniLM-L6-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cross-encoder-ms-marco-minilm-l6-v2-learnings.md` | Yes (`871a93fa...`) |
| `CYCLE-20261011-WVN0` | `2026-10-11T17:10:20.460Z` | `BAAI/bge-small-en-v1.5` | Commit diff / Patch analysis | `VERIFIED` | `Rule 314, Rule 323, Rule 324` | Yes (`23ad8bb4...`) |
| `CYCLE-20261011-0ENY` | `2026-10-11T17:13:05.086Z` | `autotrust/GLM5.3-Flash-E224-DGX-Spark` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-glm5.3-flash-e224-dgx-spark-learnings.md` | Yes (`fb2f6758...`) |
| `CYCLE-20261011-41T4` | `2026-10-11T17:15:55.048Z` | `LiquidAI/d1-3B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-liquidai-d1-3b-learnings.md` | Yes (`3cbf40cd...`) |
| `CYCLE-20261011-7SD3` | `2026-10-11T17:18:49.431Z` | `Cactus-Compute/whistle` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cactus-compute-whistle-learnings.md` | Yes (`6ac706a6...`) |
| `CYCLE-20261011-C20S` | `2026-10-11T17:22:08.572Z` | `Qwen/Qwen3.8-27B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3.8-27b-learnings.md` | Yes (`8586b5bc...`) |
| `CYCLE-20261011-G3OH` | `2026-10-11T17:25:17.345Z` | `black-forest-labs/FLUX.1-dev` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-black-forest-labs-flux.1-dev-learnings.md` | Yes (`085d0202...`) |
| `CYCLE-20261011-JVNQ` | `2026-10-11T17:28:13.574Z` | `FrancisRing/Prism` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-francisring-prism-learnings.md` | Yes (`d532018c...`) |
| `CYCLE-20261011-NU2E` | `2026-10-11T17:31:18.134Z` | `orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF` | Commit diff / Patch analysis | `VERIFIED` | `Rule 325, Rule 326, Rule 327` | Yes (`66a7e8c2...`) |
| `CYCLE-20261011-RDAF` | `2026-10-11T17:34:03.015Z` | `autotrust/GEV-26B-Decide-NVFP4` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-gev-26b-decide-nvfp4-learnings.md` | Yes (`0e3da3fb...`) |
| `CYCLE-20261011-VE8P` | `2026-10-11T17:37:10.873Z` | `SC117/Qwen3.8-Flash-Next-GSQ-RCO-abliterated-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sc117-qwen3.8-flash-next-gsq-rco-abliterated-gguf-learnings.md` | Yes (`ffe80c80...`) |
| `CYCLE-20261011-ZIF2` | `2026-10-11T17:40:22.910Z` | `deepseek-ai/DeepSeek-R1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-r1-learnings.md` | Yes (`f49579fb...`) |
| `CYCLE-20261011-38EC` | `2026-10-11T17:43:16.548Z` | `moonshotai/Kimi-K3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-moonshotai-kimi-k3-learnings.md` | Yes (`b0f8075e...`) |
| `CYCLE-20261011-6Z84` | `2026-10-11T17:46:11.284Z` | `stabilityai/stable-diffusion-xl-base-1.0` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-stabilityai-stable-diffusion-xl-base-1.0-learnings.md` | Yes (`cc5c86bf...`) |
| `CYCLE-20261011-AZ4N` | `2026-10-11T17:49:17.783Z` | `meta-llama/Llama-3.1-8B-Instruct` | Commit diff / Patch analysis | `VERIFIED` | `Rule 328, Rule 329, Rule 330` | Yes (`9f8e9770...`) |
| `CYCLE-20261011-EU00` | `2026-10-11T17:52:17.760Z` | `XingChen-AGI/TeleOCR` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xingchen-agi-teleocr-learnings.md` | Yes (`e4df0c4e...`) |
| `CYCLE-20261011-IWMB` | `2026-10-11T17:55:27.779Z` | `Qwen/Qwen-Image-2.1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen-image-2.1-learnings.md` | Yes (`3b2795fc...`) |
| `CYCLE-20261011-MQWV` | `2026-10-11T17:58:27.007Z` | `Contrastive-LM/CLM-v0.1-8B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-contrastive-lm-clm-v0.1-8b-learnings.md` | Yes (`e60fd09c...`) |
| `CYCLE-20261011-QFTG` | `2026-10-11T18:01:19.252Z` | `nvidia/Nemotron-3-Diarization` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nvidia-nemotron-3-diarization-learnings.md` | Yes (`0d3a5c0d...`) |
