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
| `CYCLE-2026-10-11-STAGED` | `2026-10-11T16:20:12.611Z` | `canonical_task_execution` | Incident Autopsy | `UNCERTAIN` | Staged in `11_INBOX/candidate-directives/CD-094-stream---asynciterable-collection-b.md` | Pending |
| `CYCLE-2026-10-11-STAGED` | `2026-10-11T16:21:54.935Z` | `canonical_task_execution` | Incident Autopsy | `UNCERTAIN` | Staged in `11_INBOX/candidate-directives/CD-095-stream---asynciterable-collection-b.md` | Pending |
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
| `CYCLE-20261011-U4C6` | `2026-10-11T18:04:10.998Z` | `Lightricks/LTX-2.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-lightricks-ltx-2.5-learnings.md` | Yes (`422b6a3f...`) |
| `CYCLE-20261011-XVRX` | `2026-10-11T18:07:06.525Z` | `prism-ml/Ternary-Bonsai-2-27B-gguf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-prism-ml-ternary-bonsai-2-27b-gguf-learnings.md` | Yes (`34409b08...`) |
| `CYCLE-20261011-1VUG` | `2026-10-11T18:10:13.240Z` | `Viggle/Qwen-Image-2.1-viggle-turbo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-viggle-qwen-image-2.1-viggle-turbo-learnings.md` | Yes (`bd9abfed...`) |
| `CYCLE-20261011-5O89` | `2026-10-11T18:13:09.993Z` | `Qwen/Qwen-Image-2.1-Turbo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen-image-2.1-turbo-learnings.md` | Yes (`a8bab2d2...`) |
| `CYCLE-20261011-9BZ0` | `2026-10-11T18:16:00.732Z` | `XingChen-AGI/Xing4.0-29B-A4B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xingchen-agi-xing4.0-29b-a4b-learnings.md` | Yes (`5ce54a44...`) |
| `CYCLE-20261011-D8DT` | `2026-10-11T18:19:02.705Z` | `SupersonicLabs/Julia-1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 331, Rule 332` | Yes (`2893b874...`) |
| `CYCLE-20261011-GRP2` | `2026-10-11T18:21:47.702Z` | `apple/LensVLM-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 333, Rule 334, Rule 335` | Yes (`b97d3bec...`) |
| `CYCLE-20261011-KPOO` | `2026-10-11T18:24:51.720Z` | `Altworld/Hemmingway-1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 336, Rule 337, Rule 338` | Yes (`b3e0ca83...`) |
| `CYCLE-20261011-OMXE` | `2026-10-11T18:27:54.770Z` | `fastino/GLiNER2.5-Decide` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-fastino-gliner2.5-decide-learnings.md` | Yes (`3e90f904...`) |
| `CYCLE-20261011-SBCH` | `2026-10-11T18:30:46.385Z` | `ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-27b-gsq-rco-gguf-learnings.md` | Yes (`fffc86c0...`) |
| `CYCLE-20261011-W2WD` | `2026-10-11T18:33:42.061Z` | `orcarouter/OrcaSAQ-2-27B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-orcarouter-orcasaq-2-27b-learnings.md` | Yes (`ea6cbfae...`) |
| `CYCLE-20261011-ZYGM` | `2026-10-11T18:36:42.934Z` | `TaichuAI/ZDTaichu5.0-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 339, Rule 340, Rule 341` | Yes (`5e346f46...`) |
| `CYCLE-20261011-3KTY` | `2026-10-11T18:39:31.894Z` | `Phocinae/Phocinae-Largha-150M-v1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-phocinae-phocinae-largha-150m-v1-learnings.md` | Yes (`8bc273fc...`) |
| `CYCLE-20261011-7OOC` | `2026-10-11T18:42:43.500Z` | `Comfy-Org/Qwen-Image-2.1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-comfy-org-qwen-image-2.1-learnings.md` | Yes (`2ee3718b...`) |
| `CYCLE-20261011-BR5T` | `2026-10-11T18:45:53.345Z` | `akhilaaa3/Jev-Omni` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-akhilaaa3-jev-omni-learnings.md` | Yes (`4c93ec95...`) |
| `CYCLE-20261011-FO9B` | `2026-10-11T18:48:56.207Z` | `XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 342, Rule 343` | Yes (`e957d672...`) |
| `CYCLE-20261011-JE5H` | `2026-10-11T18:51:49.733Z` | `inclusionAI/Ming-Image-0.1-Design` | Commit diff / Patch analysis | `VERIFIED` | `Rule 290, Rule 344, Rule 345` | Yes (`6183d443...`) |
| `CYCLE-20261011-MZH8` | `2026-10-11T18:54:37.340Z` | `deepseek-ai/DeepSeek-V4.1-Flash` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v4.1-flash-learnings.md` | Yes (`694c9ec1...`) |
| `CYCLE-20261011-R4FJ` | `2026-10-11T18:57:50.383Z` | `akatz-ai/MiniMax-H3-Character-Swap-LoRA` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-akatz-ai-minimax-h3-character-swap-lora-learnings.md` | Yes (`e292e039...`) |
| `CYCLE-20261011-V2OR` | `2026-10-11T19:00:54.747Z` | `unsloth/Qwen-Image-2.1-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-qwen-image-2.1-gguf-learnings.md` | Yes (`d1c20e8a...`) |
| `CYCLE-20261011-YTE4` | `2026-10-11T19:03:49.324Z` | `XiaomiMiMo/MiMo-V2.6-Pro-RL` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xiaomimimo-mimo-v2.6-pro-rl-learnings.md` | Yes (`8a478644...`) |
| `CYCLE-20261011-2VZ2` | `2026-10-11T19:06:59.294Z` | `orcarouter/OrcaSAQ-2-Cyber-27B-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-orcarouter-orcasaq-2-cyber-27b-uncensored-gguf-learnings.md` | Yes (`f159c59c...`) |
| `CYCLE-20261011-6K67` | `2026-10-11T19:09:50.623Z` | `Alissonerdx/BFS-Best-Face-Swap` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-alissonerdx-bfs-best-face-swap-learnings.md` | Yes (`4992f44a...`) |
| `CYCLE-20261011-APGB` | `2026-10-11T19:13:04.091Z` | `ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ukisai-swift-1.5-qwen3.8-27b-gsq-rco-gguf-learnings.md` | Yes (`d9deb51e...`) |
| `CYCLE-20261011-EWOU` | `2026-10-11T19:16:20.094Z` | `nerkyor/Qwen3.8-27B-Coder390-EfficientThink-Opus5.5-GPT6Astra-Grok4.7-DSV4Pro-K3-SFT-RLOO-MTP-DFlash2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nerkyor-qwen3.8-27b-coder390-efficientthink-opus5.5-gpt6astra-grok4.7-dsv4pro-k3-sft-rloo-mtp-dflash2-learnings.md` | Yes (`2cc3b92b...`) |
| `CYCLE-20261011-ISTB` | `2026-10-11T19:19:21.695Z` | `PSRben/VisionHOPE` | Commit diff / Patch analysis | `VERIFIED` | `Rule 346, Rule 347` | Yes (`41640495...`) |
| `CYCLE-20261011-MDBV` | `2026-10-11T19:22:08.252Z` | `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-Coder-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-flash-next-gsq-rco-coder-gguf-learnings.md` | Yes (`9e7a88a2...`) |
| `CYCLE-20261011-Q2CO` | `2026-10-11T19:25:00.648Z` | `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings.md` | Yes (`22bf54a7...`) |
| `CYCLE-20261011-U513` | `2026-10-11T19:28:10.743Z` | `facebook/sam3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-facebook-sam3-learnings.md` | Yes (`c64c5be0...`) |
| `CYCLE-20261011-YC6M` | `2026-10-11T19:31:26.638Z` | `unsloth/Qwen3.8-27B-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-qwen3.8-27b-gguf-learnings.md` | Yes (`726dccea...`) |
| `CYCLE-20261011-25LO` | `2026-10-11T19:34:24.732Z` | `DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-davidau-qwen3.8-27b-turbo-fable-cold-fusion-735-882-heretic-uncensored-neo-coder-max-mtp-gguf-learnings.md` | Yes (`143518c0...`) |
| `CYCLE-20261011-5UA9` | `2026-10-11T19:37:16.689Z` | `canberkkkkkk/ema-lightning` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-canberkkkkkk-ema-lightning-learnings.md` | Yes (`928d3880...`) |
| `CYCLE-20261011-9KWX` | `2026-10-11T19:40:11.169Z` | `google/embeddinggemma-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-embeddinggemma-2-learnings.md` | Yes (`bfeb94c4...`) |
| `CYCLE-20261011-DTJW` | `2026-10-11T19:43:28.988Z` | `unsloth/embeddinggemma-2-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-embeddinggemma-2-gguf-learnings.md` | Yes (`8ad79b24...`) |
| `CYCLE-20261011-HS2M` | `2026-10-11T19:46:33.694Z` | `Cloudflare/clef` | Commit diff / Patch analysis | `VERIFIED` | `Rule 348, Rule 349, Rule 350` | Yes (`2de7ea9c...`) |
| `CYCLE-20261011-LEIL` | `2026-10-11T19:49:22.749Z` | `Cloudflare/clef-flash` | Commit diff / Patch analysis | `VERIFIED` | `Rule 351, Rule 352, Rule 353` | Yes (`ca4a76d5...`) |
| `CYCLE-20261011-PQQU` | `2026-10-11T19:52:45.222Z` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Commit diff / Patch analysis | `VERIFIED` | `Rule 354, Rule 355, Rule 356` | Yes (`2591a552...`) |
| `CYCLE-20261011-TC7Q` | `2026-10-11T19:55:33.014Z` | `google-bert/bert-base-uncased` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-bert-bert-base-uncased-learnings.md` | Yes (`f03f4cf0...`) |
| `CYCLE-20261011-XAL1` | `2026-10-11T19:58:37.525Z` | `google/electra-base-discriminator` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-electra-base-discriminator-learnings.md` | Yes (`52d137b7...`) |
| `CYCLE-20261011-10TV` | `2026-10-11T20:01:31.507Z` | `BAAI/bge-m3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-m3-learnings.md` | Yes (`4f599790...`) |
| `CYCLE-20261011-4RQT` | `2026-10-11T20:04:26.357Z` | `Qwen/Qwen3-0.6B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-0.6b-learnings.md` | Yes (`799fa207...`) |
| `CYCLE-20261011-8VYG` | `2026-10-11T20:07:38.440Z` | `google-t5/t5-small` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-t5-t5-small-learnings.md` | Yes (`8a47ed31...`) |
| `CYCLE-20261011-CO1R` | `2026-10-11T20:10:34.815Z` | `Comfy-Org/MiniMax-H3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-comfy-org-minimax-h3-learnings.md` | Yes (`1ab8aea5...`) |
| `CYCLE-20261011-GRR8` | `2026-10-11T20:13:46.244Z` | `AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-atomicchat-qwen-image-2.1-turbo-uncensored-gguf-learnings.md` | Yes (`2561532d...`) |
| `CYCLE-20261011-KIN4` | `2026-10-11T20:16:41.056Z` | `timm/mobilenetv3_small_100.lamb_in1k` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-timm-mobilenetv3_small_100.lamb_in1k-learnings.md` | Yes (`92a75a95...`) |
| `CYCLE-20261011-O8FF` | `2026-10-11T20:19:34.443Z` | `amazon/chronos-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-amazon-chronos-2-learnings.md` | Yes (`4628d901...`) |
| `CYCLE-20261011-SEP1` | `2026-10-11T20:22:49.189Z` | `CompVis/stable-diffusion-v1-4` | Commit diff / Patch analysis | `VERIFIED` | `Rule 357, Rule 358` | Yes (`fb4cc1d2...`) |
| `CYCLE-20261011-VWMP` | `2026-10-11T20:25:32.401Z` | `meta-llama/Meta-Llama-3-8B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-meta-llama-3-8b-learnings.md` | Yes (`daae7766...`) |
| `CYCLE-20261011-ZXNH` | `2026-10-11T20:28:40.349Z` | `microsoft/FrogNano-4B-2609` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-microsoft-frognano-4b-2609-learnings.md` | Yes (`ec42f504...`) |
| `CYCLE-20261011-40X3` | `2026-10-11T20:31:51.207Z` | `hexgrad/Kokoro-82M` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-hexgrad-kokoro-82m-learnings.md` | Yes (`9900ea23...`) |
| `CYCLE-20261011-7PEY` | `2026-10-11T20:34:42.922Z` | `openai/whisper-large-v3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-whisper-large-v3-learnings.md` | Yes (`5b10a1bd...`) |
| `CYCLE-20261011-CAOU` | `2026-10-11T20:38:17.118Z` | `black-forest-labs/FLUX.1-schnell` | Commit diff / Patch analysis | `VERIFIED` | `Rule 359, Rule 360, Rule 361` | Yes (`37806320...`) |
| `CYCLE-20261011-FPLR` | `2026-10-11T20:40:56.415Z` | `MiniMaxAI/MiniMax-H3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-minimaxai-minimax-h3-learnings.md` | Yes (`ca1ee206...`) |
| `CYCLE-20261011-JTJ6` | `2026-10-11T20:44:08.130Z` | `Qwen/Qwen3.8-Flash-Next` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3.8-flash-next-learnings.md` | Yes (`0ce50d4c...`) |
| `CYCLE-20261011-NLRO` | `2026-10-11T20:47:04.692Z` | `deepseek-ai/DeepSeek-V4-Pro` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v4-pro-learnings.md` | Yes (`39b86e5d...`) |
| `CYCLE-20261011-R4UZ` | `2026-10-11T20:49:49.403Z` | `Tongyi-MAI/Z-Image-Turbo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-tongyi-mai-z-image-turbo-learnings.md` | Yes (`c4dba01f...`) |
| `CYCLE-20261011-UVVP` | `2026-10-11T20:52:44.389Z` | `meta-llama/Meta-Llama-3-8B-Instruct` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-meta-llama-3-8b-instruct-learnings.md` | Yes (`730c4103...`) |
| `CYCLE-20261011-YK1X` | `2026-10-11T20:55:35.685Z` | `openai/gpt-oss-120b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-gpt-oss-120b-learnings.md` | Yes (`a4a39ef9...`) |
| `CYCLE-20261011-2BKV` | `2026-10-11T20:58:31.327Z` | `zai-org/GLM-5.2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-zai-org-glm-5.2-learnings.md` | Yes (`6f09bffe...`) |
| `CYCLE-20261011-6MIP` | `2026-10-11T21:01:52.129Z` | `stabilityai/stable-diffusion-3-medium` | Commit diff / Patch analysis | `VERIFIED` | `Rule 362, Rule 363, Rule 364` | Yes (`f44b1b2c...`) |
| `CYCLE-20261011-A36A` | `2026-10-11T21:04:33.682Z` | `bigscience/bloom` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-bigscience-bloom-learnings.md` | Yes (`24f015a9...`) |
| `CYCLE-20261011-EAN9` | `2026-10-11T21:07:49.989Z` | `openai/gpt-oss-20b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-gpt-oss-20b-learnings.md` | Yes (`b32500a0...`) |
| `CYCLE-20261011-HYVG` | `2026-10-11T21:10:41.356Z` | `meta-llama/Llama-2-7b-chat-hf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-2-7b-chat-hf-learnings.md` | Yes (`440c8709...`) |
| `CYCLE-20261011-LMUZ` | `2026-10-11T21:13:32.411Z` | `meta-llama/Llama-2-7b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-2-7b-learnings.md` | Yes (`1efbe262...`) |
| `CYCLE-20261011-PPYI` | `2026-10-11T21:16:43.050Z` | `mistralai/Mixtral-8x7B-Instruct-v0.1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-mistralai-mixtral-8x7b-instruct-v0.1-learnings.md` | Yes (`b96d5f0a...`) |
| `CYCLE-20261011-TD9O` | `2026-10-11T21:19:33.228Z` | `deepseek-ai/DeepSeek-V3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v3-learnings.md` | Yes (`88978d03...`) |
| `CYCLE-20261011-X9TH` | `2026-10-11T21:22:35.381Z` | `baidu/Unlimited-OCR` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baidu-unlimited-ocr-learnings.md` | Yes (`5576c26e...`) |
| `CYCLE-20261011-0ZYG` | `2026-10-11T21:25:29.224Z` | `Aleph-Alpha/Kolibri-1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-aleph-alpha-kolibri-1-learnings.md` | Yes (`c42ba147...`) |
| `CYCLE-20261011-50RB` | `2026-10-11T21:28:36.887Z` | `speridlabs/iris-3b` | Commit diff / Patch analysis | `VERIFIED` | `Rule 365, Rule 366, Rule 367` | Yes (`1f249f88...`) |
| `CYCLE-20261011-8J7Q` | `2026-10-11T21:31:20.774Z` | `Qwen/Qwen3-4B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-4b-learnings.md` | Yes (`8a040370...`) |
| `CYCLE-20261011-CP2W` | `2026-10-11T21:34:35.000Z` | `FermionResearch/Phonon-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-fermionresearch-phonon-2-learnings.md` | Yes (`8e584ffa...`) |
| `CYCLE-20261011-GFZU` | `2026-10-11T21:37:29.850Z` | `Infatoshi/GLM-5.3-UNCENSORED-EXL3-3.0bpw` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-infatoshi-glm-5.3-uncensored-exl3-3.0bpw-learnings.md` | Yes (`34bd7ef3...`) |
| `CYCLE-20261011-KGEG` | `2026-10-11T21:40:37.000Z` | `pablodawson/MiniMax-H3-360-Orbit-LoRA` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-pablodawson-minimax-h3-360-orbit-lora-learnings.md` | Yes (`6a798f97...`) |
| `CYCLE-20261011-O4RH` | `2026-10-11T21:43:28.541Z` | `Venastine-Research/Xing4.0-29B-A4B-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-venastine-research-xing4.0-29b-a4b-gguf-learnings.md` | Yes (`530430f8...`) |
| `CYCLE-20261011-RS8Y` | `2026-10-11T21:46:18.946Z` | `NaiveAI/Naive-N0.5-Flash` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-naiveai-naive-n0.5-flash-learnings.md` | Yes (`3a9e2058...`) |
| `CYCLE-20261011-VQ6B` | `2026-10-11T21:49:22.883Z` | `openai/clip-vit-base-patch32` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-clip-vit-base-patch32-learnings.md` | Yes (`86dd080f...`) |
| `CYCLE-20261011-ZT3S` | `2026-10-11T21:52:33.304Z` | `sentence-transformers/all-mpnet-base-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-all-mpnet-base-v2-learnings.md` | Yes (`e04c3f41...`) |
| `CYCLE-20261011-4017` | `2026-10-11T21:55:48.907Z` | `BAAI/bge-reranker-v2-m3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-reranker-v2-m3-learnings.md` | Yes (`e8cddf25...`) |
| `CYCLE-20261011-7MLJ` | `2026-10-11T21:58:38.119Z` | `jonatasgrosman/wav2vec2-large-xlsr-53-japanese` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-jonatasgrosman-wav2vec2-large-xlsr-53-japanese-learnings.md` | Yes (`cd6045de...`) |
| `CYCLE-20261011-BI3K` | `2026-10-11T22:01:38.912Z` | `FacebookAI/xlm-roberta-base` | Commit diff / Patch analysis | `VERIFIED` | `Rule 368, Rule 369` | Yes (`102d508e...`) |
| `CYCLE-20261011-FGJW` | `2026-10-11T22:04:43.532Z` | `openai-community/gpt2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-community-gpt2-learnings.md` | Yes (`4dc88b7e...`) |
| `CYCLE-20261011-J80M` | `2026-10-11T22:07:39.094Z` | `Qwen/Qwen3-VL-8B-Instruct` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-vl-8b-instruct-learnings.md` | Yes (`31b09193...`) |
| `CYCLE-20261011-ND5L` | `2026-10-11T22:10:52.377Z` | `nomic-ai/nomic-embed-text-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nomic-ai-nomic-embed-text-v1.5-learnings.md` | Yes (`a1ead13c...`) |
| `CYCLE-20261011-R5RT` | `2026-10-11T22:13:49.433Z` | `ConwayResearch/Underdog-Saluki-27B-1.0` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-conwayresearch-underdog-saluki-27b-1.0-learnings.md` | Yes (`218b4e6b...`) |
| `CYCLE-20261011-V0F1` | `2026-10-11T22:16:49.117Z` | `google/gemma-4-26B-A4B-it` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-gemma-4-26b-a4b-it-learnings.md` | Yes (`c5ca9b95...`) |
| `CYCLE-20261011-Z4XC` | `2026-10-11T22:20:01.584Z` | `intfloat/multilingual-e5-small` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-intfloat-multilingual-e5-small-learnings.md` | Yes (`edad5c5f...`) |
| `CYCLE-20261011-2T4R` | `2026-10-11T22:22:52.923Z` | `argmaxinc/whisperkit-coreml` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-argmaxinc-whisperkit-coreml-learnings.md` | Yes (`849ae816...`) |
| `CYCLE-20261011-6VKK` | `2026-10-11T22:26:02.708Z` | `Qwen/Qwen3-8B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-8b-learnings.md` | Yes (`136d3f86...`) |
| `CYCLE-20261011-AIX1` | `2026-10-11T22:28:52.933Z` | `google/vit-base-patch16-224` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-vit-base-patch16-224-learnings.md` | Yes (`d5f34f3a...`) |
| `CYCLE-20261011-E2F8` | `2026-10-11T22:31:38.180Z` | `google/gemma-4-31B-it` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-gemma-4-31b-it-learnings.md` | Yes (`ffe2dfe1...`) |
| `CYCLE-20261011-I7YU` | `2026-10-11T22:34:51.990Z` | `BAAI/bge-base-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-base-en-v1.5-learnings.md` | Yes (`7b0a3a2a...`) |
| `CYCLE-20261011-MATJ` | `2026-10-11T22:38:02.311Z` | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-paraphrase-multilingual-mpnet-base-v2-learnings.md` | Yes (`9dc97aa4...`) |
| `CYCLE-20261011-QNHT` | `2026-10-11T22:41:25.361Z` | `Bingsu/adetailer` | Commit diff / Patch analysis | `VERIFIED` | `Rule 370, Rule 371` | Yes (`6789d109...`) |
| `CYCLE-20261011-U8Z4` | `2026-10-11T22:44:13.168Z` | `lilylilith/QI_2.1_AnyAngle` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-lilylilith-qi_2.1_anyangle-learnings.md` | Yes (`830edd66...`) |
| `CYCLE-20261011-XUUW` | `2026-10-11T22:47:01.496Z` | `BAAI/bge-large-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-large-en-v1.5-learnings.md` | Yes (`ec0be189...`) |
| `CYCLE-20261011-1V0F` | `2026-10-11T22:50:08.319Z` | `zai-org/GLM-5.3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-zai-org-glm-5.3-learnings.md` | Yes (`929d4170...`) |
| `CYCLE-20261011-5X09` | `2026-10-11T22:53:17.529Z` | `mudler/locate-anything.cpp-gguf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-mudler-locate-anything.cpp-gguf-learnings.md` | Yes (`0be1b9c8...`) |
| `CYCLE-20261011-A4NL` | `2026-10-11T22:56:34.065Z` | `jialinyyzz/humanizer` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-jialinyyzz-humanizer-learnings.md` | Yes (`a746f64d...`) |
| `CYCLE-20261011-DVIU` | `2026-10-11T22:59:28.854Z` | `autotrust/JEV-27B-VL` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-jev-27b-vl-learnings.md` | Yes (`77104368...`) |
| `CYCLE-20261011-HK6H` | `2026-10-11T23:02:20.777Z` | `autotrust/GEV-26B-Decide` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-gev-26b-decide-learnings.md` | Yes (`6f6709f1...`) |
| `CYCLE-20261011-LQMU` | `2026-10-11T23:05:35.766Z` | `convaiinnovations/laya` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-convaiinnovations-laya-learnings.md` | Yes (`b5ff1a08...`) |
| `CYCLE-20261011-PI62` | `2026-10-11T23:08:31.418Z` | `Edge0/Audio8-ASR-Infinite` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-edge0-audio8-asr-infinite-learnings.md` | Yes (`13ff1623...`) |
| `CYCLE-20261011-TGJY` | `2026-10-11T23:11:35.950Z` | `abenzerps/Qwen-Image-2.1-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-abenzerps-qwen-image-2.1-uncensored-gguf-learnings.md` | Yes (`a7a12644...`) |
| `CYCLE-20261011-XE9D` | `2026-10-11T23:14:39.601Z` | `sentence-transformers/all-MiniLM-L6-v2` | Commit diff / Patch analysis | `VERIFIED` | `Rule 372, Rule 373` | Yes (`b42bf785...`) |
| `CYCLE-20261011-0YGM` | `2026-10-11T23:17:25.750Z` | `cross-encoder/ms-marco-MiniLM-L6-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cross-encoder-ms-marco-minilm-l6-v2-learnings.md` | Yes (`f010fa77...`) |
| `CYCLE-20261011-4ZJ0` | `2026-10-11T23:20:33.756Z` | `BAAI/bge-small-en-v1.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-small-en-v1.5-learnings.md` | Yes (`9b4e72ae...`) |
| `CYCLE-20261011-91K5` | `2026-10-11T23:23:43.013Z` | `autotrust/GLM5.3-Flash-E224-DGX-Spark` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-glm5.3-flash-e224-dgx-spark-learnings.md` | Yes (`5ff19330...`) |
| `CYCLE-20261011-D5P3` | `2026-10-11T23:26:54.999Z` | `LiquidAI/d1-3B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-liquidai-d1-3b-learnings.md` | Yes (`5e950374...`) |
| `CYCLE-20261011-GUH6` | `2026-10-11T23:29:47.082Z` | `Cactus-Compute/whistle` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-cactus-compute-whistle-learnings.md` | Yes (`ba4166b4...`) |
| `CYCLE-20261011-KM9S` | `2026-10-11T23:32:43.072Z` | `Qwen/Qwen3.8-27B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3.8-27b-learnings.md` | Yes (`3373ae29...`) |
| `CYCLE-20261011-OQBY` | `2026-10-11T23:35:54.958Z` | `black-forest-labs/FLUX.1-dev` | Commit diff / Patch analysis | `VERIFIED` | `Rule 374, Rule 375, Rule 376` | Yes (`4ffac111...`) |
| `CYCLE-20261011-SOT4` | `2026-10-11T23:38:59.608Z` | `FrancisRing/Prism` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-francisring-prism-learnings.md` | Yes (`5f192c09...`) |
| `CYCLE-20261011-WW52` | `2026-10-11T23:42:15.734Z` | `orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-orcarouter-qwen3.8-flash-next-uncensored-gguf-learnings.md` | Yes (`3586164f...`) |
| `CYCLE-20261011-0GPO` | `2026-10-11T23:45:02.364Z` | `autotrust/GEV-26B-Decide-NVFP4` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-autotrust-gev-26b-decide-nvfp4-learnings.md` | Yes (`16380150...`) |
| `CYCLE-20261011-47XG` | `2026-10-11T23:47:57.604Z` | `SC117/Qwen3.8-Flash-Next-GSQ-RCO-abliterated-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sc117-qwen3.8-flash-next-gsq-rco-abliterated-gguf-learnings.md` | Yes (`b33ef116...`) |
| `CYCLE-20261011-8E1J` | `2026-10-11T23:51:12.151Z` | `deepseek-ai/DeepSeek-R1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-r1-learnings.md` | Yes (`dcdc1983...`) |
| `CYCLE-20261011-C44M` | `2026-10-11T23:54:05.926Z` | `moonshotai/Kimi-K3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-moonshotai-kimi-k3-learnings.md` | Yes (`49bf2e2a...`) |
| `CYCLE-20261011-G93D` | `2026-10-11T23:57:18.985Z` | `stabilityai/stable-diffusion-xl-base-1.0` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-stabilityai-stable-diffusion-xl-base-1.0-learnings.md` | Yes (`7b1d6ea5...`) |
| `CYCLE-20261012-K7UN` | `2026-10-12T00:00:23.999Z` | `meta-llama/Llama-3.1-8B-Instruct` | Commit diff / Patch analysis | `VERIFIED` | `Rule 377, Rule 378, Rule 379` | Yes (`e477c277...`) |
| `CYCLE-20261012-NSTH` | `2026-10-12T00:03:11.141Z` | `XingChen-AGI/TeleOCR` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xingchen-agi-teleocr-learnings.md` | Yes (`11ee874f...`) |
| `CYCLE-20261012-RS9U` | `2026-10-12T00:06:17.058Z` | `Qwen/Qwen-Image-2.1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen-image-2.1-learnings.md` | Yes (`15f9ebd5...`) |
| `CYCLE-20261012-VKYR` | `2026-10-12T00:09:14.211Z` | `Contrastive-LM/CLM-v0.1-8B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-contrastive-lm-clm-v0.1-8b-learnings.md` | Yes (`8d185c29...`) |
| `CYCLE-20261012-ZPTC` | `2026-10-12T00:12:27.120Z` | `nvidia/Nemotron-3-Diarization` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nvidia-nemotron-3-diarization-learnings.md` | Yes (`4c241116...`) |
| `CYCLE-20261012-3GX6` | `2026-10-12T00:15:22.218Z` | `Lightricks/LTX-2.5` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-lightricks-ltx-2.5-learnings.md` | Yes (`659f2a6b...`) |
| `CYCLE-20261012-78XA` | `2026-10-12T00:18:18.478Z` | `prism-ml/Ternary-Bonsai-2-27B-gguf` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-prism-ml-ternary-bonsai-2-27b-gguf-learnings.md` | Yes (`fc8a2f0c...`) |
| `CYCLE-20261012-BCHX` | `2026-10-12T00:21:29.733Z` | `Viggle/Qwen-Image-2.1-viggle-turbo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-viggle-qwen-image-2.1-viggle-turbo-learnings.md` | Yes (`44358a9c...`) |
| `CYCLE-20261012-F4VX` | `2026-10-12T00:24:26.493Z` | `Qwen/Qwen-Image-2.1-Turbo` | Commit diff / Patch analysis | `VERIFIED` | `Rule 380, Rule 381, Rule 382` | Yes (`ad8c016e...`) |
| `CYCLE-20261012-J150` | `2026-10-12T00:27:28.260Z` | `XingChen-AGI/Xing4.0-29B-A4B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xingchen-agi-xing4.0-29b-a4b-learnings.md` | Yes (`7970cb5a...`) |
| `CYCLE-20261012-MRE6` | `2026-10-12T00:30:22.254Z` | `SupersonicLabs/Julia-1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-supersoniclabs-julia-1-learnings.md` | Yes (`b3e57691...`) |
| `CYCLE-20261012-QNIF` | `2026-10-12T00:33:23.847Z` | `apple/LensVLM-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 383, Rule 384, Rule 385` | Yes (`c3c6aab9...`) |
| `CYCLE-20261012-UT3D` | `2026-10-12T00:36:37.705Z` | `Altworld/Hemmingway-1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 386, Rule 387, Rule 388` | Yes (`835ddb7f...`) |
| `CYCLE-20261012-YD44` | `2026-10-12T00:39:23.620Z` | `fastino/GLiNER2.5-Decide` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-fastino-gliner2.5-decide-learnings.md` | Yes (`5bd42483...`) |
| `CYCLE-20261012-2I6Z` | `2026-10-12T00:42:36.827Z` | `ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-27b-gsq-rco-gguf-learnings.md` | Yes (`fdb6ee1e...`) |
| `CYCLE-20261012-68YB` | `2026-10-12T00:45:31.475Z` | `orcarouter/OrcaSAQ-2-27B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-orcarouter-orcasaq-2-27b-learnings.md` | Yes (`76acce05...`) |
| `CYCLE-20261012-A6SI` | `2026-10-12T00:48:35.298Z` | `TaichuAI/ZDTaichu5.0-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 389, Rule 390, Rule 391` | Yes (`bcae827d...`) |
| `CYCLE-20261012-EAFY` | `2026-10-12T00:51:46.654Z` | `Phocinae/Phocinae-Largha-150M-v1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-phocinae-phocinae-largha-150m-v1-learnings.md` | Yes (`049de265...`) |
| `CYCLE-20261012-I9QV` | `2026-10-12T00:54:52.375Z` | `Comfy-Org/Qwen-Image-2.1` | Commit diff / Patch analysis | `VERIFIED` | `Rule 392, Rule 393` | Yes (`1548b050...`) |
| `CYCLE-20261012-LVWS` | `2026-10-12T00:57:41.068Z` | `akhilaaa3/Jev-Omni` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-akhilaaa3-jev-omni-learnings.md` | Yes (`1c2fc639...`) |
| `CYCLE-20261012-PNEJ` | `2026-10-12T01:00:36.667Z` | `XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 394, Rule 395, Rule 396` | Yes (`8f1717fe...`) |
| `CYCLE-20261012-TAYW` | `2026-10-12T01:03:27.176Z` | `inclusionAI/Ming-Image-0.1-Design` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-inclusionai-ming-image-0.1-design-learnings.md` | Yes (`522d2df2...`) |
| `CYCLE-20261012-XF40` | `2026-10-12T01:06:39.168Z` | `deepseek-ai/DeepSeek-V4.1-Flash` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v4.1-flash-learnings.md` | Yes (`bd8edcbd...`) |
| `CYCLE-20261012-1HBT` | `2026-10-12T01:09:48.665Z` | `akatz-ai/MiniMax-H3-Character-Swap-LoRA` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-akatz-ai-minimax-h3-character-swap-lora-learnings.md` | Yes (`2093b707...`) |
| `CYCLE-20261012-56BF` | `2026-10-12T01:12:41.019Z` | `unsloth/Qwen-Image-2.1-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-qwen-image-2.1-gguf-learnings.md` | Yes (`923aacb9...`) |
| `CYCLE-20261012-8XHV` | `2026-10-12T01:15:36.211Z` | `XiaomiMiMo/MiMo-V2.6-Pro-RL` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-xiaomimimo-mimo-v2.6-pro-rl-learnings.md` | Yes (`f1982168...`) |
| `CYCLE-20261012-CZZX` | `2026-10-12T01:18:46.077Z` | `orcarouter/OrcaSAQ-2-Cyber-27B-Uncensored-GGUF` | Commit diff / Patch analysis | `VERIFIED` | `Rule 397, Rule 398, Rule 399` | Yes (`4cb9a993...`) |
| `CYCLE-20261012-GWXR` | `2026-10-12T01:21:48.735Z` | `Alissonerdx/BFS-Best-Face-Swap` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-alissonerdx-bfs-best-face-swap-learnings.md` | Yes (`484097e6...`) |
| `CYCLE-20261012-KYYF` | `2026-10-12T01:24:57.975Z` | `ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ukisai-swift-1.5-qwen3.8-27b-gsq-rco-gguf-learnings.md` | Yes (`843f3476...`) |
| `CYCLE-20261012-ON6Z` | `2026-10-12T01:27:49.355Z` | `nerkyor/Qwen3.8-27B-Coder390-EfficientThink-Opus5.5-GPT6Astra-Grok4.7-DSV4Pro-K3-SFT-RLOO-MTP-DFlash2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-nerkyor-qwen3.8-27b-coder390-efficientthink-opus5.5-gpt6astra-grok4.7-dsv4pro-k3-sft-rloo-mtp-dflash2-learnings.md` | Yes (`5f0a0c7e...`) |
| `CYCLE-20261012-SDJ0` | `2026-10-12T01:30:43.452Z` | `PSRben/VisionHOPE` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-psrben-visionhope-learnings.md` | Yes (`54da7e8e...`) |
| `CYCLE-20261012-W34F` | `2026-10-12T01:33:36.591Z` | `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-Coder-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-flash-next-gsq-rco-coder-gguf-learnings.md` | Yes (`57f265f2...`) |
| `CYCLE-20261012-09VO` | `2026-10-12T01:36:51.972Z` | `ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings.md` | Yes (`89ff961c...`) |
| `CYCLE-20261012-4GCF` | `2026-10-12T01:40:06.975Z` | `facebook/sam3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-facebook-sam3-learnings.md` | Yes (`05ba38f4...`) |
| `CYCLE-20261012-85TL` | `2026-10-12T01:42:59.961Z` | `unsloth/Qwen3.8-27B-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-qwen3.8-27b-gguf-learnings.md` | Yes (`6ab7a5ba...`) |
| `CYCLE-20261012-BPOS` | `2026-10-12T01:45:45.676Z` | `DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-davidau-qwen3.8-27b-turbo-fable-cold-fusion-735-882-heretic-uncensored-neo-coder-max-mtp-gguf-learnings.md` | Yes (`f4bd8840...`) |
| `CYCLE-20261012-FA7E` | `2026-10-12T01:48:32.234Z` | `canberkkkkkk/ema-lightning` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-canberkkkkkk-ema-lightning-learnings.md` | Yes (`d51c50f7...`) |
| `CYCLE-20261012-JEDX` | `2026-10-12T01:51:44.277Z` | `google/embeddinggemma-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-embeddinggemma-2-learnings.md` | Yes (`a9813a33...`) |
| `CYCLE-20261012-NHWE` | `2026-10-12T01:54:55.454Z` | `unsloth/embeddinggemma-2-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-unsloth-embeddinggemma-2-gguf-learnings.md` | Yes (`24d0e3ac...`) |
| `CYCLE-20261012-VJXI` | `2026-10-12T02:01:11.334Z` | `Cloudflare/clef` | Commit diff / Patch analysis | `VERIFIED` | `Rule 401, Rule 402, Rule 403` | Yes (`21386929...`) |
| `CYCLE-20261012-Z6YR` | `2026-10-12T02:04:01.155Z` | `Cloudflare/clef-flash` | Commit diff / Patch analysis | `VERIFIED` | `Rule 404, Rule 405, Rule 406` | Yes (`3181bdfb...`) |
| `CYCLE-20261012-2R8F` | `2026-10-12T02:06:47.391Z` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-sentence-transformers-paraphrase-multilingual-minilm-l12-v2-learnings.md` | Yes (`ff4074c5...`) |
| `CYCLE-20261012-6LQ1` | `2026-10-12T02:09:46.873Z` | `google-bert/bert-base-uncased` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-bert-bert-base-uncased-learnings.md` | Yes (`f375ba32...`) |
| `CYCLE-20261012-AYF6` | `2026-10-12T02:13:09.954Z` | `google/electra-base-discriminator` | Commit diff / Patch analysis | `VERIFIED` | `Rule 407, Rule 408` | Yes (`fd567dcb...`) |
| `CYCLE-20261012-EU7C` | `2026-10-12T02:16:11.112Z` | `BAAI/bge-m3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baai-bge-m3-learnings.md` | Yes (`763d16dd...`) |
| `CYCLE-20261012-IE6N` | `2026-10-12T02:18:56.975Z` | `Qwen/Qwen3-0.6B` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3-0.6b-learnings.md` | Yes (`f0657bcb...`) |
| `CYCLE-20261012-M4G7` | `2026-10-12T02:21:50.983Z` | `google-t5/t5-small` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-google-t5-t5-small-learnings.md` | Yes (`c3f78540...`) |
| `CYCLE-20261012-PV8L` | `2026-10-12T02:24:45.669Z` | `Comfy-Org/MiniMax-H3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-comfy-org-minimax-h3-learnings.md` | Yes (`2aa986d8...`) |
| `CYCLE-20261012-TXSC` | `2026-10-12T02:27:55.597Z` | `AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-atomicchat-qwen-image-2.1-turbo-uncensored-gguf-learnings.md` | Yes (`20800735...`) |
| `CYCLE-20261012-XOSN` | `2026-10-12T02:30:50.567Z` | `timm/mobilenetv3_small_100.lamb_in1k` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-timm-mobilenetv3_small_100.lamb_in1k-learnings.md` | Yes (`836882f8...`) |
| `CYCLE-20261012-1U9C` | `2026-10-12T02:34:04.272Z` | `amazon/chronos-2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-amazon-chronos-2-learnings.md` | Yes (`3be9a782...`) |
| `CYCLE-20261012-5MYU` | `2026-10-12T02:37:01.446Z` | `CompVis/stable-diffusion-v1-4` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-compvis-stable-diffusion-v1-4-learnings.md` | Yes (`aa76c071...`) |
| `CYCLE-20261012-9EM7` | `2026-10-12T02:39:57.247Z` | `meta-llama/Meta-Llama-3-8B` | Commit diff / Patch analysis | `VERIFIED` | `Rule 409, Rule 410, Rule 411` | Yes (`267dfe48...`) |
| `CYCLE-20261012-CZFU` | `2026-10-12T02:42:44.202Z` | `microsoft/FrogNano-4B-2609` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-microsoft-frognano-4b-2609-learnings.md` | Yes (`1d7caf38...`) |
| `CYCLE-20261012-H27U` | `2026-10-12T02:45:54.426Z` | `hexgrad/Kokoro-82M` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-hexgrad-kokoro-82m-learnings.md` | Yes (`46a3db03...`) |
| `CYCLE-20261012-L1WH` | `2026-10-12T02:49:00.641Z` | `openai/whisper-large-v3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-whisper-large-v3-learnings.md` | Yes (`e304598d...`) |
| `CYCLE-20261012-P6F0` | `2026-10-12T02:52:13.116Z` | `black-forest-labs/FLUX.1-schnell` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-black-forest-labs-flux.1-schnell-learnings.md` | Yes (`2b0f3bf7...`) |
| `CYCLE-20261012-SR0B` | `2026-10-12T02:54:59.771Z` | `MiniMaxAI/MiniMax-H3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-minimaxai-minimax-h3-learnings.md` | Yes (`acedc7a9...`) |
| `CYCLE-20261012-WG8D` | `2026-10-12T02:57:52.429Z` | `Qwen/Qwen3.8-Flash-Next` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-qwen-qwen3.8-flash-next-learnings.md` | Yes (`ec578ef9...`) |
| `CYCLE-20261012-0OGR` | `2026-10-12T03:01:09.723Z` | `deepseek-ai/DeepSeek-V4-Pro` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v4-pro-learnings.md` | Yes (`bb60761e...`) |
| `CYCLE-20261012-4VAD` | `2026-10-12T03:04:25.189Z` | `Tongyi-MAI/Z-Image-Turbo` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-tongyi-mai-z-image-turbo-learnings.md` | Yes (`36193f2c...`) |
| `CYCLE-20261012-8NH5` | `2026-10-12T03:07:21.689Z` | `meta-llama/Meta-Llama-3-8B-Instruct` | Commit diff / Patch analysis | `VERIFIED` | `Rule 412, Rule 413, Rule 414` | Yes (`fa8b726d...`) |
| `CYCLE-20261012-C8JO` | `2026-10-12T03:10:08.964Z` | `openai/gpt-oss-120b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-gpt-oss-120b-learnings.md` | Yes (`3bef4bb5...`) |
| `CYCLE-20261012-G5ME` | `2026-10-12T03:13:11.798Z` | `zai-org/GLM-5.2` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-zai-org-glm-5.2-learnings.md` | Yes (`ead0812b...`) |
| `CYCLE-20261012-JWEV` | `2026-10-12T03:16:06.487Z` | `stabilityai/stable-diffusion-3-medium` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-stabilityai-stable-diffusion-3-medium-learnings.md` | Yes (`5706bdd2...`) |
| `CYCLE-20261012-O1FQ` | `2026-10-12T03:19:19.622Z` | `bigscience/bloom` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-bigscience-bloom-learnings.md` | Yes (`2728d9dd...`) |
| `CYCLE-20261012-SE5F` | `2026-10-12T03:22:42.723Z` | `openai/gpt-oss-20b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-openai-gpt-oss-20b-learnings.md` | Yes (`fc97dd82...`) |
| `CYCLE-20261012-WHNV` | `2026-10-12T03:25:53.899Z` | `meta-llama/Llama-2-7b-chat-hf` | Commit diff / Patch analysis | `VERIFIED` | `Rule 415, Rule 416, Rule 417` | Yes (`13818198...`) |
| `CYCLE-20261012-2QO1` | `2026-10-12T03:30:45.505Z` | `meta-llama/Llama-2-7b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-meta-llama-llama-2-7b-learnings.md` | Yes (`8ac836e6...`) |
| `CYCLE-20261012-6LDF` | `2026-10-12T03:33:45.267Z` | `mistralai/Mixtral-8x7B-Instruct-v0.1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-mistralai-mixtral-8x7b-instruct-v0.1-learnings.md` | Yes (`f3ab4745...`) |
| `CYCLE-20261012-APHF` | `2026-10-12T03:36:57.219Z` | `deepseek-ai/DeepSeek-V3` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-deepseek-ai-deepseek-v3-learnings.md` | Yes (`73ea503c...`) |
| `CYCLE-20261012-EFVI` | `2026-10-12T03:39:51.390Z` | `baidu/Unlimited-OCR` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-baidu-unlimited-ocr-learnings.md` | Yes (`657faa58...`) |
| `CYCLE-20261012-I579` | `2026-10-12T03:42:44.181Z` | `Aleph-Alpha/Kolibri-1` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-aleph-alpha-kolibri-1-learnings.md` | Yes (`3b10c5dd...`) |
| `CYCLE-20261012-LTYN` | `2026-10-12T03:45:36.239Z` | `speridlabs/iris-3b` | Commit diff / Patch analysis | `PROJECT_ONLY` | `07_PROJECT_LEARNING/hf-speridlabs-iris-3b-learnings.md` | Yes (`40ed8500...`) |
