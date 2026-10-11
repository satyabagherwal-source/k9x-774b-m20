# Daily Harvesting Source Provenance Ledger
### *Cryptographic Source Attribution & Line-Level Audit Trail*

> **Hard Invariant**:  
> Every learning extracted during daily auto-harvesting must be permanently attributed to its original repository, commit hash, and file path.  
> Unattributed claims are classified as unverified and blocked from canonical promotion.

---

## 1. Provenance Schema Standard
Every entry in this ledger must capture:
- **Repository URL**: Full remote URL (`https://github.com/...`)
- **Commit SHA / Tag**: Exact commit hash or immutable release tag inspected
- **File & Line Range**: Specific source file path and line range containing the invariant
- **Harvest Timestamp**: ISO-8601 UTC timestamp of extraction
- **Linked Learning ID**: Corresponding ID in `05_KNOWLEDGE/knowledge-index.json` or `07_PROJECT_LEARNING/`

---

## 2. Active Provenance Entries

| Learning ID | Source Repository | Commit SHA / Tag | File & Line Provenance | Extraction Date |
| :--- | :--- | :--- | :--- | :--- |
| `learn-github-oven-sh-bun-rule255` | `https://github.com/oven-sh/bun` | `b3e89a1f` | `src/agent/hooks.zig#L45-L112` | 2026-10-09T03:32:36Z |
| `learn-github-astral-sh-uv-rule256` | `https://github.com/astral-sh/uv` | `7c210d94` | `crates/uv-resolver/src/resolver.rs#L210-L290` | 2026-10-09T03:32:36Z |
| `learn-github-tailscale-tailscale-rule257` | `https://github.com/tailscale/tailscale` | `41f8c2bb` | `wgengine/router/router_userspace.go#L88-L142` | 2026-10-09T03:32:36Z |
| `learn-github-tauri-apps-tauri-rule258` | `https://github.com/tauri-apps/tauri` | `a901e4cd` | `core/tauri/src/ipc/command.rs#L130-L195` | 2026-10-09T03:32:36Z |
| `learn-github-tokio-rs-tokio-rule253` | `https://github.com/tokio-rs/tokio` | `9d5e31a0` | `tokio-util/src/codec/length_delimited.rs#L310-L380` | 2026-10-08T18:10:00Z |
| `learn-github-duckdb-duckdb-rule254` | `https://github.com/duckdb/duckdb` | `e02fa871` | `src/execution/aggregate_hashtable.cpp#L415-L490` | 2026-10-08T18:10:00Z |
| `learn-github-sxyazi-yazi-rule252` | `https://github.com/sxyazi/yazi` | `fc391a02` | `yazi-core/src/manager/manager.rs#L120-L180` | 2026-10-08T17:45:00Z |
| `learn-github-expressjs-cors` | `https://github.com/expressjs/cors` | `5317ebe6` | `lib/index.js#L1-L200` | 2026-10-08T16:52:27Z |
| `learn-hf-meta-llama-llama-3.2-1b` | `https://huggingface.co/meta-llama/Llama-3.2-1B` | `v1.0.0` | `config.json`, `model.safetensors.index.json` | 2026-10-08T16:54:44Z |

---
*Maintained under Rule 4 (Preserve Provenance) and Rule 25 (AI-BUILDER-BRAIN Daily Auto-Harvesting Persistence Rule).*
| `learn-github-test-org-gateway-verifier-mv3ioo99` | `https://github.com/test-org/gateway-verifier` | `abc1234567` | Multi-dimensional audit evidence | 2026-10-11T07:44:05.753Z |
| `learn-github-test-org-rule-verifier-mv3iooq3` | `https://github.com/test-org/rule-verifier` | `HEAD` | Multi-dimensional audit evidence | 2026-10-11T07:44:06.106Z |
| `learn-github-shadcn-ui-ui-mv3j0403` | `https://github.com/shadcn-ui/ui` | `shadcn-ui-` | Multi-dimensional audit evidence | 2026-10-11T07:52:58.994Z |
| `learn-github-e2e-expressjs-cors-real-mv3jk707` | `https://github.com/expressjs/cors` | `5317ebe670` | Multi-dimensional audit evidence | 2026-10-11T08:08:36.333Z |
| `learn-github-e2e-expressjs-cors-real-mv3jk707` | `https://github.com/expressjs/cors` | `5317ebe670` | Multi-dimensional audit evidence | 2026-10-11T08:08:38.029Z |
| `learn-github-test-e2e-idempotent-slug-mv3jndcp` | `https://github.com/test-org/test-idempotent-repo` | `abc12345` | Multi-dimensional audit evidence | 2026-10-11T08:11:04.377Z |
| `learn-github-test-e2e-idempotent-slug-mv3jndcp` | `https://github.com/test-org/test-idempotent-repo` | `abc12345` | Multi-dimensional audit evidence | 2026-10-11T08:11:04.650Z |
| `learn-github-e2e-expressjs-cors-real-mv3jnepw` | `https://github.com/expressjs/cors` | `5317ebe670` | Multi-dimensional audit evidence | 2026-10-11T08:11:06.212Z |
| `learn-github-e2e-expressjs-cors-real-mv3jnepw` | `https://github.com/expressjs/cors` | `5317ebe670` | Multi-dimensional audit evidence | 2026-10-11T08:11:07.209Z |
| `learn-github-test-org-gateway-verifier-mv3jnpds` | `https://github.com/test-org/gateway-verifier` | `abc1234567` | Multi-dimensional audit evidence | 2026-10-11T08:11:19.966Z |
| `learn-github-test-org-rule-verifier-mv3jnpou` | `https://github.com/test-org/rule-verifier` | `HEAD` | Multi-dimensional audit evidence | 2026-10-11T08:11:20.313Z |
| `learn-github-test-e2e-idempotent-slug-mv3jrhym` | `https://github.com/test-org/test-idempotent-repo` | `abc12345` | Multi-dimensional audit evidence | 2026-10-11T08:14:16.961Z |
| `learn-github-test-e2e-idempotent-slug-mv3jrhym` | `https://github.com/test-org/test-idempotent-repo` | `abc12345` | Multi-dimensional audit evidence | 2026-10-11T08:14:17.084Z |
| `learn-github-e2e-expressjs-cors-real-mv3jrj6s` | `https://github.com/expressjs/cors` | `5317ebe670` | Multi-dimensional audit evidence | 2026-10-11T08:14:18.594Z |
| `learn-github-e2e-expressjs-cors-real-mv3jrj6s` | `https://github.com/expressjs/cors` | `5317ebe670` | Multi-dimensional audit evidence | 2026-10-11T08:14:19.797Z |
| `learn-github-slopus-happy-mv3jwv4i` | `https://github.com/slopus/happy` | `99f415fa` | Multi-dimensional audit evidence | 2026-10-11T08:18:27.157Z |
| `learn-github-colinhacks-zod-mv3kabi9` | `https://github.com/colinhacks/zod` | `284243fb` | Multi-dimensional audit evidence | 2026-10-11T08:29:06.345Z |
| `learn-huggingface-hf-bingsu-adetailer-mv3kgo7h` | `https://huggingface.co/Bingsu/adetailer` | `hf-bingsu-` | Multi-dimensional audit evidence | 2026-10-11T08:33:51.331Z |
| `learn-huggingface-hf-lilylilith-qi_2-1_anyangle-mv3kk1cj` | `https://huggingface.co/lilylilith/QI_2.1_AnyAngle` | `hf-lilylil` | Multi-dimensional audit evidence | 2026-10-11T08:36:28.288Z |
| `learn-huggingface-hf-baai-bge-large-en-v1-5-mv3knotg` | `https://huggingface.co/BAAI/bge-large-en-v1.5` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T08:39:18.684Z |
| `learn-huggingface-hf-zai-org-glm-5-3-mv3kspgb` | `https://huggingface.co/zai-org/GLM-5.3` | `hf-zai-org` | Multi-dimensional audit evidence | 2026-10-11T08:43:12.817Z |
| `learn-huggingface-hf-mudler-locate-anything-cpp-gguf-mv3kw6z4` | `https://huggingface.co/mudler/locate-anything.cpp-gguf` | `hf-mudler-` | Multi-dimensional audit evidence | 2026-10-11T08:45:55.480Z |
| `learn-huggingface-hf-jialinyyzz-humanizer-mv3l1c7c` | `https://huggingface.co/jialinyyzz/humanizer` | `hf-jialiny` | Multi-dimensional audit evidence | 2026-10-11T08:49:55.550Z |
| `learn-huggingface-hf-autotrust-jev-27b-vl-mv3l4ytp` | `https://huggingface.co/autotrust/JEV-27B-VL` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T08:52:44.872Z |
| `learn-huggingface-hf-autotrust-gev-26b-decide-mv3la1jq` | `https://huggingface.co/autotrust/GEV-26B-Decide` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T08:56:41.625Z |
| `learn-huggingface-hf-convaiinnovations-laya-mv3lfcux` | `https://huggingface.co/convaiinnovations/laya` | `hf-convaii` | Multi-dimensional audit evidence | 2026-10-11T09:00:49.644Z |
| `learn-huggingface-hf-edge0-audio8-asr-infinite-mv3lor3e` | `https://huggingface.co/Edge0/Audio8-ASR-Infinite` | `hf-edge0-a` | Multi-dimensional audit evidence | 2026-10-11T09:08:07.937Z |
| `learn-huggingface-hf-abenzerps-qwen-image-2-1-uncensored-gguf-mv3lusad` | `https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF` | `hf-abenzer` | Multi-dimensional audit evidence | 2026-10-11T09:12:49.422Z |
| `learn-huggingface-hf-sentence-transformers-all-minilm-l6-v2-mv3lznlb` | `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2` | `hf-sentenc` | Multi-dimensional audit evidence | 2026-10-11T09:16:36.600Z |
| `learn-huggingface-hf-cross-encoder-ms-marco-minilm-l6-v2-mv3m5af1` | `https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2` | `hf-cross-e` | Multi-dimensional audit evidence | 2026-10-11T09:20:59.481Z |
| `learn-huggingface-hf-baai-bge-small-en-v1-5-mv3ma7rs` | `https://huggingface.co/BAAI/bge-small-en-v1.5` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T09:24:49.325Z |
| `learn-huggingface-hf-autotrust-glm5-3-flash-e224-dgx-spark-mv3n5yx7` | `https://huggingface.co/autotrust/GLM5.3-Flash-E224-DGX-Spark` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T09:49:30.853Z |
| `learn-huggingface-hf-liquidai-d1-3b-mv3nrmky` | `https://huggingface.co/LiquidAI/d1-3B` | `hf-liquida` | Multi-dimensional audit evidence | 2026-10-11T10:06:21.280Z |
| `learn-huggingface-hf-cactus-compute-whistle-mv3nwn3d` | `https://huggingface.co/Cactus-Compute/whistle` | `hf-cactus-` | Multi-dimensional audit evidence | 2026-10-11T10:10:15.227Z |
| `learn-huggingface-hf-qwen-qwen3-8-27b-mv3o6paa` | `https://huggingface.co/Qwen/Qwen3.8-27B` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T10:18:04.630Z |
| `learn-huggingface-hf-black-forest-labs-flux-1-dev-mv3obe4d` | `https://huggingface.co/black-forest-labs/FLUX.1-dev` | `hf-black-f` | Multi-dimensional audit evidence | 2026-10-11T10:21:43.448Z |
| `learn-huggingface-hf-francisring-prism-mv3of5tu` | `https://huggingface.co/FrancisRing/Prism` | `hf-francis` | Multi-dimensional audit evidence | 2026-10-11T10:24:39.306Z |
| `learn-huggingface-hf-orcarouter-qwen3-8-flash-next-uncensored-gguf-mv3oj7wb` | `https://huggingface.co/orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF` | `hf-orcarou` | Multi-dimensional audit evidence | 2026-10-11T10:27:48.614Z |
| `learn-huggingface-hf-autotrust-gev-26b-decide-nvfp4-mv3on0zs` | `https://huggingface.co/autotrust/GEV-26B-Decide-NVFP4` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T10:30:46.284Z |
| `learn-huggingface-hf-sc117-qwen3-8-flash-next-gsq-rco-abliterated-gguf-mv3ora9g` | `https://huggingface.co/SC117/Qwen3.8-Flash-Next-GSQ-RCO-abliterated-GGUF` | `hf-sc117-q` | Multi-dimensional audit evidence | 2026-10-11T10:34:04.927Z |
| `learn-huggingface-hf-deepseek-ai-deepseek-r1-mv3ov1f6` | `https://huggingface.co/deepseek-ai/DeepSeek-R1` | `hf-deepsee` | Multi-dimensional audit evidence | 2026-10-11T10:37:00.116Z |
| `learn-huggingface-hf-moonshotai-kimi-k3-mv3oyp5u` | `https://huggingface.co/moonshotai/Kimi-K3` | `hf-moonsho` | Multi-dimensional audit evidence | 2026-10-11T10:39:50.811Z |
| `learn-huggingface-hf-stabilityai-stable-diffusion-xl-base-1-0-mv3p3m0j` | `https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0` | `hf-stabili` | Multi-dimensional audit evidence | 2026-10-11T10:43:40.036Z |
| `learn-huggingface-hf-meta-llama-llama-3-1-8b-instruct-mv3p7m42` | `https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct` | `hf-meta-ll` | Multi-dimensional audit evidence | 2026-10-11T10:46:46.780Z |
| `learn-huggingface-hf-xingchen-agi-teleocr-mv3pbkqe` | `https://huggingface.co/XingChen-AGI/TeleOCR` | `hf-xingche` | Multi-dimensional audit evidence | 2026-10-11T10:49:51.605Z |
| `learn-huggingface-hf-qwen-qwen-image-2-1-mv3pfapi` | `https://huggingface.co/Qwen/Qwen-Image-2.1` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T10:52:45.236Z |
| `learn-huggingface-hf-contrastive-lm-clm-v0-1-8b-mv3pj25w` | `https://huggingface.co/Contrastive-LM/CLM-v0.1-8B` | `hf-contras` | Multi-dimensional audit evidence | 2026-10-11T10:55:40.787Z |
| `learn-huggingface-hf-nvidia-nemotron-3-diarization-mv3pmpgf` | `https://huggingface.co/nvidia/Nemotron-3-Diarization` | `hf-nvidia-` | Multi-dimensional audit evidence | 2026-10-11T10:58:30.936Z |
| `learn-huggingface-hf-lightricks-ltx-2-5-mv3pqmef` | `https://huggingface.co/Lightricks/LTX-2.5` | `hf-lightri` | Multi-dimensional audit evidence | 2026-10-11T11:01:33.634Z |
| `learn-huggingface-hf-prism-ml-ternary-bonsai-2-27b-gguf-mv3puv08` | `https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf` | `hf-prism-m` | Multi-dimensional audit evidence | 2026-10-11T11:04:51.401Z |
| `learn-huggingface-hf-viggle-qwen-image-2-1-viggle-turbo-mv3pyot0` | `https://huggingface.co/Viggle/Qwen-Image-2.1-viggle-turbo` | `hf-viggle-` | Multi-dimensional audit evidence | 2026-10-11T11:07:49.968Z |
| `learn-huggingface-hf-qwen-qwen-image-2-1-turbo-mv3q2cna` | `https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T11:10:40.842Z |
| `learn-huggingface-hf-xingchen-agi-xing4-0-29b-a4b-mv3q5xxw` | `https://huggingface.co/XingChen-AGI/Xing4.0-29B-A4B` | `hf-xingche` | Multi-dimensional audit evidence | 2026-10-11T11:13:28.410Z |
| `learn-huggingface-hf-supersoniclabs-julia-1-mv3qaccp` | `https://huggingface.co/SupersonicLabs/Julia-1` | `hf-superso` | Multi-dimensional audit evidence | 2026-10-11T11:16:53.723Z |
| `learn-huggingface-hf-apple-lensvlm-9b-mv3qecp6` | `https://huggingface.co/apple/LensVLM-9B` | `hf-apple-l` | Multi-dimensional audit evidence | 2026-10-11T11:20:00.785Z |
| `learn-huggingface-hf-altworld-hemmingway-1-mv3qi0v0` | `https://huggingface.co/Altworld/Hemmingway-1` | `hf-altworl` | Multi-dimensional audit evidence | 2026-10-11T11:22:52.114Z |
| `learn-huggingface-hf-fastino-gliner2-5-decide-mv3r2t2q` | `https://huggingface.co/fastino/GLiNER2.5-Decide` | `hf-fastino` | Multi-dimensional audit evidence | 2026-10-11T11:39:01.773Z |
| `learn-huggingface-hf-ista-daslab-qwen3-8-27b-gsq-rco-gguf-mv3r6p89` | `https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` | `hf-ista-da` | Multi-dimensional audit evidence | 2026-10-11T11:42:03.417Z |
| `learn-huggingface-hf-orcarouter-orcasaq-2-27b-mv3raa0g` | `https://huggingface.co/orcarouter/OrcaSAQ-2-27B` | `hf-orcarou` | Multi-dimensional audit evidence | 2026-10-11T11:44:50.317Z |
| `learn-huggingface-hf-taichuai-zdtaichu5-0-9b-mv3rdxya` | `https://huggingface.co/TaichuAI/ZDTaichu5.0-9B` | `hf-taichua` | Multi-dimensional audit evidence | 2026-10-11T11:47:41.307Z |
| `learn-huggingface-hf-phocinae-phocinae-largha-150m-v1-mv3rhipt` | `https://huggingface.co/Phocinae/Phocinae-Largha-150M-v1` | `hf-phocina` | Multi-dimensional audit evidence | 2026-10-11T11:50:28.175Z |
| `learn-huggingface-hf-comfy-org-qwen-image-2-1-mv3rlnex` | `https://huggingface.co/Comfy-Org/Qwen-Image-2.1` | `hf-comfy-o` | Multi-dimensional audit evidence | 2026-10-11T11:53:40.914Z |
| `learn-huggingface-hf-akhilaaa3-jev-omni-mv3rpmwl` | `https://huggingface.co/akhilaaa3/Jev-Omni` | `hf-akhilaa` | Multi-dimensional audit evidence | 2026-10-11T11:56:46.862Z |
| `learn-huggingface-hf-xiaomimimo-mimo-v2-6-distill-qwen-9b-mv3rt3wo` | `https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B` | `hf-xiaomim` | Multi-dimensional audit evidence | 2026-10-11T11:59:28.834Z |
| `learn-huggingface-hf-inclusionai-ming-image-0-1-design-mv3rwxna` | `https://huggingface.co/inclusionAI/Ming-Image-0.1-Design` | `hf-inclusi` | Multi-dimensional audit evidence | 2026-10-11T12:02:27.393Z |
| `learn-huggingface-hf-deepseek-ai-deepseek-v4-1-flash-mv3s0nyl` | `https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash` | `hf-deepsee` | Multi-dimensional audit evidence | 2026-10-11T12:05:21.438Z |
| `learn-huggingface-hf-akatz-ai-minimax-h3-character-swap-lora-mv3s48mc` | `https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA` | `hf-akatz-a` | Multi-dimensional audit evidence | 2026-10-11T12:08:08.188Z |
| `learn-huggingface-hf-unsloth-qwen-image-2-1-gguf-mv3s8jsv` | `https://huggingface.co/unsloth/Qwen-Image-2.1-GGUF` | `hf-unsloth` | Multi-dimensional audit evidence | 2026-10-11T12:11:29.320Z |
| `learn-huggingface-hf-xiaomimimo-mimo-v2-6-pro-rl-mv3scm1v` | `https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL` | `hf-xiaomim` | Multi-dimensional audit evidence | 2026-10-11T12:14:38.841Z |
| `learn-huggingface-hf-orcarouter-orcasaq-2-cyber-27b-uncensored-gguf-mv3sgbac` | `https://huggingface.co/orcarouter/OrcaSAQ-2-Cyber-27B-Uncensored-GGUF` | `hf-orcarou` | Multi-dimensional audit evidence | 2026-10-11T12:17:31.523Z |
| `learn-huggingface-hf-alissonerdx-bfs-best-face-swap-mv3sjx1h` | `https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap` | `hf-alisson` | Multi-dimensional audit evidence | 2026-10-11T12:20:19.670Z |
| `learn-huggingface-hf-ukisai-swift-1-5-qwen3-8-27b-gsq-rco-gguf-mv3snier` | `https://huggingface.co/ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF` | `hf-ukisai-` | Multi-dimensional audit evidence | 2026-10-11T12:23:07.305Z |
| `learn-huggingface-hf-nerkyor-qwen3-8-27b-coder390-efficientthink-opus5-5-gpt6astra-grok4-7-dsv4pro-k3-sft-rloo-mtp-dflash2-mv3sr31t` | `https://huggingface.co/nerkyor/Qwen3.8-27B-Coder390-EfficientThink-Opus5.5-GPT6Astra-Grok4.7-DSV4Pro-K3-SFT-RLOO-MTP-DFlash2` | `hf-nerkyor` | Multi-dimensional audit evidence | 2026-10-11T12:25:54.054Z |
| `learn-huggingface-hf-psrben-visionhope-mv3sv11p` | `https://huggingface.co/PSRben/VisionHOPE` | `hf-psrben-` | Multi-dimensional audit evidence | 2026-10-11T12:28:58.054Z |
| `learn-huggingface-hf-ista-daslab-qwen3-8-flash-next-gsq-rco-coder-gguf-mv3sz1z4` | `https://huggingface.co/ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-Coder-GGUF` | `hf-ista-da` | Multi-dimensional audit evidence | 2026-10-11T12:32:05.916Z |
| `learn-huggingface-hf-ista-daslab-qwen3-8-flash-next-gsq-rco-gguf-mv3t2p10` | `https://huggingface.co/ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF` | `hf-ista-da` | Multi-dimensional audit evidence | 2026-10-11T12:34:55.760Z |
| `learn-huggingface-hf-facebook-sam3-mv3t66d0` | `https://huggingface.co/facebook/sam3` | `hf-faceboo` | Multi-dimensional audit evidence | 2026-10-11T12:37:38.152Z |
| `learn-huggingface-hf-unsloth-qwen3-8-27b-gguf-mv3t9o4j` | `https://huggingface.co/unsloth/Qwen3.8-27B-GGUF` | `hf-unsloth` | Multi-dimensional audit evidence | 2026-10-11T12:40:21.143Z |
| `learn-huggingface-hf-davidau-qwen3-8-27b-turbo-fable-cold-fusion-735-882-heretic-uncensored-neo-coder-max-mtp-gguf-mv3tdhqc` | `https://huggingface.co/DavidAU/Qwen3.8-27B-TURBO-Fable-Cold-Fusion-735-882-Heretic-Uncensored-NEO-CODER-MAX-MTP-GGUF` | `hf-davidau` | Multi-dimensional audit evidence | 2026-10-11T12:43:19.519Z |
| `learn-huggingface-hf-canberkkkkkk-ema-lightning-mv3thnwu` | `https://huggingface.co/canberkkkkkk/ema-lightning` | `hf-canberk` | Multi-dimensional audit evidence | 2026-10-11T12:46:34.165Z |
| `learn-huggingface-hf-google-embeddinggemma-2-mv3tls88` | `https://huggingface.co/google/embeddinggemma-2` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T12:49:46.368Z |
| `learn-huggingface-hf-unsloth-embeddinggemma-2-gguf-mv3tpc11` | `https://huggingface.co/unsloth/embeddinggemma-2-GGUF` | `hf-unsloth` | Multi-dimensional audit evidence | 2026-10-11T12:52:31.972Z |
| `learn-huggingface-hf-cloudflare-clef-mv3tt3zm` | `https://huggingface.co/Cloudflare/clef` | `hf-cloudfl` | Multi-dimensional audit evidence | 2026-10-11T12:55:28.217Z |
| `learn-huggingface-hf-cloudflare-clef-flash-mv3twuhc` | `https://huggingface.co/Cloudflare/clef-flash` | `hf-cloudfl` | Multi-dimensional audit evidence | 2026-10-11T12:58:22.510Z |
| `learn-huggingface-hf-sentence-transformers-paraphrase-multilingual-minilm-l12-v2-mv3u0oxd` | `https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | `hf-sentenc` | Multi-dimensional audit evidence | 2026-10-11T13:01:21.934Z |
| `learn-huggingface-hf-google-bert-bert-base-uncased-mv3u4hza` | `https://huggingface.co/google-bert/bert-base-uncased` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T13:04:19.518Z |
| `learn-huggingface-hf-google-electra-base-discriminator-mv3u8fz6` | `https://huggingface.co/google/electra-base-discriminator` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T13:07:23.548Z |
| `learn-huggingface-hf-baai-bge-m3-mv3uc4yp` | `https://huggingface.co/BAAI/bge-m3` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T13:10:15.923Z |
| `learn-huggingface-hf-qwen-qwen3-0-6b-mv3ufvt7` | `https://huggingface.co/Qwen/Qwen3-0.6B` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T13:13:10.680Z |
| `learn-huggingface-hf-google-t5-t5-small-mv3ujnq6` | `https://huggingface.co/google-t5/t5-small` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T13:16:06.836Z |
| `learn-huggingface-hf-comfy-org-minimax-h3-mv3un94r` | `https://huggingface.co/Comfy-Org/MiniMax-H3` | `hf-comfy-o` | Multi-dimensional audit evidence | 2026-10-11T13:18:54.510Z |
| `learn-huggingface-hf-atomicchat-qwen-image-2-1-turbo-uncensored-gguf-mv3uraji` | `https://huggingface.co/AtomicChat/Qwen-Image-2.1-Turbo-Uncensored-GGUF` | `hf-atomicc` | Multi-dimensional audit evidence | 2026-10-11T13:22:02.983Z |
| `learn-huggingface-hf-timm-mobilenetv3_small_100-lamb_in1k-mv3uvefu` | `https://huggingface.co/timm/mobilenetv3_small_100.lamb_in1k` | `hf-timm-mo` | Multi-dimensional audit evidence | 2026-10-11T13:25:14.673Z |
| `learn-huggingface-hf-amazon-chronos-2-mv3uz1oh` | `https://huggingface.co/amazon/chronos-2` | `hf-amazon-` | Multi-dimensional audit evidence | 2026-10-11T13:28:04.764Z |
| `learn-huggingface-hf-compvis-stable-diffusion-v1-4-mv3v30wu` | `https://huggingface.co/CompVis/stable-diffusion-v1-4` | `hf-compvis` | Multi-dimensional audit evidence | 2026-10-11T13:31:10.401Z |
| `learn-huggingface-hf-meta-llama-meta-llama-3-8b-mv3v6lgj` | `https://huggingface.co/meta-llama/Meta-Llama-3-8B` | `hf-meta-ll` | Multi-dimensional audit evidence | 2026-10-11T13:33:56.985Z |
| `learn-huggingface-hf-microsoft-frognano-4b-2609-mv3vabf1` | `https://huggingface.co/microsoft/FrogNano-4B-2609` | `hf-microso` | Multi-dimensional audit evidence | 2026-10-11T13:36:50.597Z |
| `learn-huggingface-hf-hexgrad-kokoro-82m-mv3vejmd` | `https://huggingface.co/hexgrad/Kokoro-82M` | `hf-hexgrad` | Multi-dimensional audit evidence | 2026-10-11T13:40:07.835Z |
| `learn-huggingface-hf-openai-whisper-large-v3-mv3vimz1` | `https://huggingface.co/openai/whisper-large-v3` | `hf-openai-` | Multi-dimensional audit evidence | 2026-10-11T13:43:18.801Z |
| `learn-huggingface-hf-black-forest-labs-flux-1-schnell-mv3vmi4l` | `https://huggingface.co/black-forest-labs/FLUX.1-schnell` | `hf-black-f` | Multi-dimensional audit evidence | 2026-10-11T13:46:19.184Z |
| `learn-huggingface-hf-minimaxai-minimax-h3-mv3vq45h` | `https://huggingface.co/MiniMaxAI/MiniMax-H3` | `hf-minimax` | Multi-dimensional audit evidence | 2026-10-11T13:49:07.663Z |
| `learn-huggingface-hf-qwen-qwen3-8-flash-next-mv3vtrzd` | `https://huggingface.co/Qwen/Qwen3.8-Flash-Next` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T13:51:58.512Z |
| `learn-huggingface-hf-deepseek-ai-deepseek-v4-pro-mv3vxw29` | `https://huggingface.co/deepseek-ai/DeepSeek-V4-Pro` | `hf-deepsee` | Multi-dimensional audit evidence | 2026-10-11T13:55:10.444Z |
| `learn-huggingface-hf-tongyi-mai-z-image-turbo-mv3w1tib` | `https://huggingface.co/Tongyi-MAI/Z-Image-Turbo` | `hf-tongyi-` | Multi-dimensional audit evidence | 2026-10-11T13:58:13.719Z |
| `learn-huggingface-hf-meta-llama-meta-llama-3-8b-instruct-mv3w5s7i` | `https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct` | `hf-meta-ll` | Multi-dimensional audit evidence | 2026-10-11T14:01:18.681Z |
| `learn-huggingface-hf-openai-gpt-oss-120b-mv3w9ew3` | `https://huggingface.co/openai/gpt-oss-120b` | `hf-openai-` | Multi-dimensional audit evidence | 2026-10-11T14:04:08.065Z |
| `learn-huggingface-hf-zai-org-glm-5-2-mv3wd2l6` | `https://huggingface.co/zai-org/GLM-5.2` | `hf-zai-org` | Multi-dimensional audit evidence | 2026-10-11T14:06:58.742Z |
| `learn-huggingface-hf-stabilityai-stable-diffusion-3-medium-mv3whbk4` | `https://huggingface.co/stabilityai/stable-diffusion-3-medium` | `hf-stabili` | Multi-dimensional audit evidence | 2026-10-11T14:10:17.002Z |
| `learn-huggingface-hf-bigscience-bloom-mv3wl1kr` | `https://huggingface.co/bigscience/bloom` | `hf-bigscie` | Multi-dimensional audit evidence | 2026-10-11T14:13:10.660Z |
| `learn-huggingface-hf-openai-gpt-oss-20b-mv3woskc` | `https://huggingface.co/openai/gpt-oss-20b` | `hf-openai-` | Multi-dimensional audit evidence | 2026-10-11T14:16:05.618Z |
| `learn-huggingface-hf-meta-llama-llama-2-7b-chat-hf-mv3wsd49` | `https://huggingface.co/meta-llama/Llama-2-7b-chat-hf` | `hf-meta-ll` | Multi-dimensional audit evidence | 2026-10-11T14:18:52.188Z |
| `learn-huggingface-hf-meta-llama-llama-2-7b-mv3wvzie` | `https://huggingface.co/meta-llama/Llama-2-7b` | `hf-meta-ll` | Multi-dimensional audit evidence | 2026-10-11T14:21:41.212Z |
| `learn-huggingface-hf-mistralai-mixtral-8x7b-instruct-v0-1-mv3wzmkj` | `https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1` | `hf-mistral` | Multi-dimensional audit evidence | 2026-10-11T14:24:31.066Z |
| `learn-huggingface-hf-deepseek-ai-deepseek-v3-mv3x3khf` | `https://huggingface.co/deepseek-ai/DeepSeek-V3` | `hf-deepsee` | Multi-dimensional audit evidence | 2026-10-11T14:27:34.974Z |
| `learn-huggingface-hf-baidu-unlimited-ocr-mv3x7ph4` | `https://huggingface.co/baidu/Unlimited-OCR` | `hf-baidu-u` | Multi-dimensional audit evidence | 2026-10-11T14:30:48.082Z |
| `learn-huggingface-hf-aleph-alpha-kolibri-1-mv3xbaa0` | `https://huggingface.co/Aleph-Alpha/Kolibri-1` | `hf-aleph-a` | Multi-dimensional audit evidence | 2026-10-11T14:33:34.975Z |
| `learn-huggingface-hf-speridlabs-iris-3b-mv3xf4f7` | `https://huggingface.co/speridlabs/iris-3b` | `hf-speridl` | Multi-dimensional audit evidence | 2026-10-11T14:36:34.046Z |
| `learn-huggingface-hf-qwen-qwen3-4b-mv3xiori` | `https://huggingface.co/Qwen/Qwen3-4B` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T14:39:20.384Z |
| `learn-huggingface-hf-fermionresearch-phonon-2-mv3xmdbo` | `https://huggingface.co/FermionResearch/Phonon-2` | `hf-fermion` | Multi-dimensional audit evidence | 2026-10-11T14:42:12.233Z |
| `learn-huggingface-hf-infatoshi-glm-5-3-uncensored-exl3-3-0bpw-mv3xqg2c` | `https://huggingface.co/Infatoshi/GLM-5.3-UNCENSORED-EXL3-3.0bpw` | `hf-infatos` | Multi-dimensional audit evidence | 2026-10-11T14:45:22.351Z |
| `learn-huggingface-hf-pablodawson-minimax-h3-360-orbit-lora-mv3xukgu` | `https://huggingface.co/pablodawson/MiniMax-H3-360-Orbit-LoRA` | `hf-pabloda` | Multi-dimensional audit evidence | 2026-10-11T14:48:34.687Z |
| `learn-huggingface-hf-venastine-research-xing4-0-29b-a4b-gguf-mv3xybf6` | `https://huggingface.co/Venastine-Research/Xing4.0-29B-A4B-GGUF` | `hf-venasti` | Multi-dimensional audit evidence | 2026-10-11T14:51:29.583Z |
| `learn-huggingface-hf-naiveai-naive-n0-5-flash-mv3y20ev` | `https://huggingface.co/NaiveAI/Naive-N0.5-Flash` | `hf-naiveai` | Multi-dimensional audit evidence | 2026-10-11T14:54:21.921Z |
| `learn-huggingface-hf-openai-clip-vit-base-patch32-mv3y5o08` | `https://huggingface.co/openai/clip-vit-base-patch32` | `hf-openai-` | Multi-dimensional audit evidence | 2026-10-11T14:57:12.484Z |
| `learn-huggingface-hf-sentence-transformers-all-mpnet-base-v2-mv3y996e` | `https://huggingface.co/sentence-transformers/all-mpnet-base-v2` | `hf-sentenc` | Multi-dimensional audit evidence | 2026-10-11T14:59:59.858Z |
| `learn-huggingface-hf-baai-bge-reranker-v2-m3-mv3yddzy` | `https://huggingface.co/BAAI/bge-reranker-v2-m3` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T15:03:12.764Z |
| `learn-huggingface-hf-jonatasgrosman-wav2vec2-large-xlsr-53-japanese-mv3yhjko` | `https://huggingface.co/jonatasgrosman/wav2vec2-large-xlsr-53-japanese` | `hf-jonatas` | Multi-dimensional audit evidence | 2026-10-11T15:06:26.619Z |
| `learn-cd-092` | `canonical_task_execution` | `task-task1-collection-bound` | `11_INBOX/candidate-directives/CD-092-stream---asynciterable-collection-b.md` | 2026-10-11T15:08:41.231Z |
| `learn-huggingface-hf-facebookai-xlm-roberta-base-mv3ypies` | `https://huggingface.co/FacebookAI/xlm-roberta-base` | `hf-faceboo` | Multi-dimensional audit evidence | 2026-10-11T15:12:38.358Z |
| `learn-huggingface-hf-openai-community-gpt2-mv3yuiaq` | `https://huggingface.co/openai-community/gpt2` | `hf-openai-` | Multi-dimensional audit evidence | 2026-10-11T15:16:31.509Z |
| `learn-huggingface-hf-qwen-qwen3-vl-8b-instruct-mv3yxxno` | `https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T15:19:11.337Z |
| `learn-huggingface-hf-nomic-ai-nomic-embed-text-v1-5-mv3z1izs` | `https://huggingface.co/nomic-ai/nomic-embed-text-v1.5` | `hf-nomic-a` | Multi-dimensional audit evidence | 2026-10-11T15:21:58.963Z |
| `learn-huggingface-hf-conwayresearch-underdog-saluki-27b-1-0-mv3z5aum` | `https://huggingface.co/ConwayResearch/Underdog-Saluki-27B-1.0` | `hf-conwayr` | Multi-dimensional audit evidence | 2026-10-11T15:24:55.023Z |
| `learn-huggingface-hf-google-gemma-4-26b-a4b-it-mv3z9d9l` | `https://huggingface.co/google/gemma-4-26B-A4B-it` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T15:28:04.778Z |
| `learn-github-infisical-infisical-mv3zhkae` | `https://github.com/Infisical/infisical` | `c40d5fd5` | Multi-dimensional audit evidence | 2026-10-11T15:34:27.157Z |
| `learn-research-311` | `redis/redis` | `targeted-research` | `05_KNOWLEDGE/engineering-patterns.md#Rule 311` | 2026-10-11T15:41:57.560Z |
| `learn-research-312` | `auth0/node-jsonwebtoken` | `targeted-research` | `05_KNOWLEDGE/engineering-patterns.md#Rule 312` | 2026-10-11T15:41:58.314Z |
| `learn-cd-093` | `canonical_task_execution` | `task-task1-collection-bound` | `11_INBOX/candidate-directives/CD-093-stream---asynciterable-collection-b.md` | 2026-10-11T15:42:26.377Z |
| `learn-github-test-org-gateway-verifier-mv3zrwa8` | `https://github.com/test-org/gateway-verifier` | `abc1234567` | Multi-dimensional audit evidence | 2026-10-11T15:42:29.590Z |
| `learn-github-test-org-rule-verifier-mv3zrwqz` | `https://github.com/test-org/rule-verifier` | `HEAD` | Multi-dimensional audit evidence | 2026-10-11T15:42:30.002Z |
| `learn-research-313` | `animir/node-rate-limiter-flexible` | `targeted-research` | `05_KNOWLEDGE/engineering-patterns.md#Rule 313` | 2026-10-11T15:42:31.350Z |
| `learn-huggingface-hf-intfloat-multilingual-e5-small-mv400pp8` | `https://huggingface.co/intfloat/multilingual-e5-small` | `hf-intfloa` | Multi-dimensional audit evidence | 2026-10-11T15:49:20.634Z |
| `learn-huggingface-hf-argmaxinc-whisperkit-coreml-mv404ar8` | `https://huggingface.co/argmaxinc/whisperkit-coreml` | `hf-argmaxi` | Multi-dimensional audit evidence | 2026-10-11T15:52:07.890Z |
| `learn-huggingface-hf-qwen-qwen3-8b-mv407vz0` | `https://huggingface.co/Qwen/Qwen3-8B` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T15:54:55.336Z |
| `learn-huggingface-hf-google-vit-base-patch16-224-mv40bvhc` | `https://huggingface.co/google/vit-base-patch16-224` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T15:58:01.338Z |
| `learn-huggingface-hf-google-gemma-4-31b-it-mv40fw8a` | `https://huggingface.co/google/gemma-4-31B-it` | `hf-google-` | Multi-dimensional audit evidence | 2026-10-11T16:01:08.935Z |
| `learn-huggingface-hf-baai-bge-base-en-v1-5-mv40jxd1` | `https://huggingface.co/BAAI/bge-base-en-v1.5` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T16:04:17.006Z |
| `learn-huggingface-hf-sentence-transformers-paraphrase-multilingual-mpnet-base-v2-mv40nmqt` | `https://huggingface.co/sentence-transformers/paraphrase-multilingual-mpnet-base-v2` | `hf-sentenc` | Multi-dimensional audit evidence | 2026-10-11T16:07:09.888Z |
| `learn-huggingface-hf-bingsu-adetailer-mv40r96p` | `https://huggingface.co/Bingsu/adetailer` | `hf-bingsu-` | Multi-dimensional audit evidence | 2026-10-11T16:09:58.942Z |
| `learn-huggingface-hf-lilylilith-qi_2-1_anyangle-mv40vjag` | `https://huggingface.co/lilylilith/QI_2.1_AnyAngle` | `hf-lilylil` | Multi-dimensional audit evidence | 2026-10-11T16:13:18.660Z |
| `learn-huggingface-hf-baai-bge-large-en-v1-5-mv40zfsc` | `https://huggingface.co/BAAI/bge-large-en-v1.5` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T16:16:20.746Z |

| `learn-research-319` | `temporalio/sdk-typescript` | `targeted-research` | `05_KNOWLEDGE/engineering-patterns.md#Rule 319` | 2026-10-11T16:20:12.724Z |
| `learn-cd-094` | `canonical_task_execution` | `task-task1-collection-bound` | `11_INBOX/candidate-directives/CD-094-stream---asynciterable-collection-b.md` | 2026-10-11T16:20:12.724Z || `learn-cd-095` | `canonical_task_execution` | `task-task1-collection-bound` | `11_INBOX/candidate-directives/CD-095-stream---asynciterable-collection-b.md` | 2026-10-11T16:21:54.936Z |
| `learn-huggingface-hf-zai-org-glm-5-3-mv413j49` | `https://huggingface.co/zai-org/GLM-5.3` | `hf-zai-org` | Multi-dimensional audit evidence | 2026-10-11T16:19:31.686Z |
| `learn-huggingface-hf-mudler-locate-anything-cpp-gguf-mv4177m8` | `https://huggingface.co/mudler/locate-anything.cpp-gguf` | `hf-mudler-` | Multi-dimensional audit evidence | 2026-10-11T16:22:23.407Z |
| `learn-huggingface-hf-jialinyyzz-humanizer-mv41atmq` | `https://huggingface.co/jialinyyzz/humanizer` | `hf-jialiny` | Multi-dimensional audit evidence | 2026-10-11T16:25:11.906Z |
| `learn-huggingface-hf-autotrust-jev-27b-vl-mv41j8wr` | `https://huggingface.co/autotrust/JEV-27B-VL` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T16:31:44.951Z |
| `learn-huggingface-hf-autotrust-gev-26b-decide-mv41mus8` | `https://huggingface.co/autotrust/GEV-26B-Decide` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T16:34:33.238Z |
| `learn-huggingface-hf-convaiinnovations-laya-mv41qpya` | `https://huggingface.co/convaiinnovations/laya` | `hf-convaii` | Multi-dimensional audit evidence | 2026-10-11T16:37:33.648Z |
| `learn-huggingface-hf-edge0-audio8-asr-infinite-mv41u2xc` | `https://huggingface.co/Edge0/Audio8-ASR-Infinite` | `hf-edge0-a` | Multi-dimensional audit evidence | 2026-10-11T16:40:10.380Z |
| `learn-github-autonomous-ai-openharness-mv422jff` | `https://github.com/autonomous-ai/openharness` | `efa72443` | Multi-dimensional audit evidence | 2026-10-11T16:46:45.020Z |
| `learn-huggingface-hf-abenzerps-qwen-image-2-1-uncensored-gguf-mv42kq8l` | `https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF` | `hf-abenzer` | Multi-dimensional audit evidence | 2026-10-11T17:00:53.682Z |
| `learn-huggingface-hf-sentence-transformers-all-minilm-l6-v2-mv42ove4` | `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2` | `hf-sentenc` | Multi-dimensional audit evidence | 2026-10-11T17:04:06.989Z |
| `learn-huggingface-hf-cross-encoder-ms-marco-minilm-l6-v2-mv42syia` | `https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2` | `hf-cross-e` | Multi-dimensional audit evidence | 2026-10-11T17:07:17.648Z |
| `learn-huggingface-hf-baai-bge-small-en-v1-5-mv42wvjy` | `https://huggingface.co/BAAI/bge-small-en-v1.5` | `hf-baai-bg` | Multi-dimensional audit evidence | 2026-10-11T17:10:20.461Z |
| `learn-huggingface-hf-autotrust-glm5-3-flash-e224-dgx-spark-mv430elb` | `https://huggingface.co/autotrust/GLM5.3-Flash-E224-DGX-Spark` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T17:13:05.087Z |
| `learn-huggingface-hf-liquidai-d1-3b-mv4341q9` | `https://huggingface.co/LiquidAI/d1-3B` | `hf-liquida` | Multi-dimensional audit evidence | 2026-10-11T17:15:55.049Z |
| `learn-huggingface-hf-cactus-compute-whistle-mv437sal` | `https://huggingface.co/Cactus-Compute/whistle` | `hf-cactus-` | Multi-dimensional audit evidence | 2026-10-11T17:18:49.432Z |
| `learn-huggingface-hf-qwen-qwen3-8-27b-mv43c1y3` | `https://huggingface.co/Qwen/Qwen3.8-27B` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T17:22:08.576Z |
| `learn-huggingface-hf-black-forest-labs-flux-1-dev-mv43g3lp` | `https://huggingface.co/black-forest-labs/FLUX.1-dev` | `hf-black-f` | Multi-dimensional audit evidence | 2026-10-11T17:25:17.347Z |
| `learn-huggingface-hf-francisring-prism-mv43jvl8` | `https://huggingface.co/FrancisRing/Prism` | `hf-francis` | Multi-dimensional audit evidence | 2026-10-11T17:28:13.576Z |
| `learn-huggingface-hf-orcarouter-qwen3-8-flash-next-uncensored-gguf-mv43ntz8` | `https://huggingface.co/orcarouter/Qwen3.8-Flash-Next-Uncensored-GGUF` | `hf-orcarou` | Multi-dimensional audit evidence | 2026-10-11T17:31:18.136Z |
| `learn-huggingface-hf-autotrust-gev-26b-decide-nvfp4-mv43rd7n` | `https://huggingface.co/autotrust/GEV-26B-Decide-NVFP4` | `hf-autotru` | Multi-dimensional audit evidence | 2026-10-11T17:34:03.017Z |
| `learn-huggingface-hf-sc117-qwen3-8-flash-next-gsq-rco-abliterated-gguf-mv43ve6m` | `https://huggingface.co/SC117/Qwen3.8-Flash-Next-GSQ-RCO-abliterated-GGUF` | `hf-sc117-q` | Multi-dimensional audit evidence | 2026-10-11T17:37:10.874Z |
| `learn-huggingface-hf-deepseek-ai-deepseek-r1-mv43zicx` | `https://huggingface.co/deepseek-ai/DeepSeek-R1` | `hf-deepsee` | Multi-dimensional audit evidence | 2026-10-11T17:40:22.911Z |
| `learn-huggingface-hf-moonshotai-kimi-k3-mv4438bt` | `https://huggingface.co/moonshotai/Kimi-K3` | `hf-moonsho` | Multi-dimensional audit evidence | 2026-10-11T17:43:16.549Z |
| `learn-huggingface-hf-stabilityai-stable-diffusion-xl-base-1-0-mv446z5h` | `https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0` | `hf-stabili` | Multi-dimensional audit evidence | 2026-10-11T17:46:11.285Z |
| `learn-huggingface-hf-meta-llama-llama-3-1-8b-instruct-mv44az1j` | `https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct` | `hf-meta-ll` | Multi-dimensional audit evidence | 2026-10-11T17:49:17.784Z |
| `learn-huggingface-hf-xingchen-agi-teleocr-mv44etxd` | `https://huggingface.co/XingChen-AGI/TeleOCR` | `hf-xingche` | Multi-dimensional audit evidence | 2026-10-11T17:52:17.762Z |
| `learn-huggingface-hf-qwen-qwen-image-2-1-mv44iwjo` | `https://huggingface.co/Qwen/Qwen-Image-2.1` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T17:55:27.780Z |
| `learn-huggingface-hf-contrastive-lm-clm-v0-1-8b-mv44mqua` | `https://huggingface.co/Contrastive-LM/CLM-v0.1-8B` | `hf-contras` | Multi-dimensional audit evidence | 2026-10-11T17:58:27.008Z |
| `learn-huggingface-hf-nvidia-nemotron-3-diarization-mv44qfqt` | `https://huggingface.co/nvidia/Nemotron-3-Diarization` | `hf-nvidia-` | Multi-dimensional audit evidence | 2026-10-11T18:01:19.253Z |
| `learn-huggingface-hf-lightricks-ltx-2-5-mv44u4a4` | `https://huggingface.co/Lightricks/LTX-2.5` | `hf-lightri` | Multi-dimensional audit evidence | 2026-10-11T18:04:10.999Z |
| `learn-huggingface-hf-prism-ml-ternary-bonsai-2-27b-gguf-mv44xvpe` | `https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf` | `hf-prism-m` | Multi-dimensional audit evidence | 2026-10-11T18:07:06.526Z |
| `learn-huggingface-hf-viggle-qwen-image-2-1-viggle-turbo-mv451vsw` | `https://huggingface.co/Viggle/Qwen-Image-2.1-viggle-turbo` | `hf-viggle-` | Multi-dimensional audit evidence | 2026-10-11T18:10:13.241Z |
| `learn-huggingface-hf-qwen-qwen-image-2-1-turbo-mv455o5m` | `https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo` | `hf-qwen-qw` | Multi-dimensional audit evidence | 2026-10-11T18:13:09.994Z |
| `learn-huggingface-hf-xingchen-agi-xing4-0-29b-a4b-mv459bwg` | `https://huggingface.co/XingChen-AGI/Xing4.0-29B-A4B` | `hf-xingche` | Multi-dimensional audit evidence | 2026-10-11T18:16:00.734Z |
| `learn-huggingface-hf-supersoniclabs-julia-1-mv45d8ac` | `https://huggingface.co/SupersonicLabs/Julia-1` | `hf-superso` | Multi-dimensional audit evidence | 2026-10-11T18:19:02.707Z |
| `learn-huggingface-hf-apple-lensvlm-9b-mv45grmj` | `https://huggingface.co/apple/LensVLM-9B` | `hf-apple-l` | Multi-dimensional audit evidence | 2026-10-11T18:21:47.703Z |
| `learn-huggingface-hf-altworld-hemmingway-1-mv45kpmr` | `https://huggingface.co/Altworld/Hemmingway-1` | `hf-altworl` | Multi-dimensional audit evidence | 2026-10-11T18:24:51.721Z |
| `learn-huggingface-hf-fastino-gliner2-5-decide-mv45omuu` | `https://huggingface.co/fastino/GLiNER2.5-Decide` | `hf-fastino` | Multi-dimensional audit evidence | 2026-10-11T18:27:54.771Z |
| `learn-huggingface-hf-ista-daslab-qwen3-8-27b-gsq-rco-gguf-mv45sbad` | `https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF` | `hf-ista-da` | Multi-dimensional audit evidence | 2026-10-11T18:30:46.387Z |
| `learn-huggingface-hf-orcarouter-orcasaq-2-27b-mv45w2u2` | `https://huggingface.co/orcarouter/OrcaSAQ-2-27B` | `hf-orcarou` | Multi-dimensional audit evidence | 2026-10-11T18:33:42.062Z |
| `learn-huggingface-hf-taichuai-zdtaichu5-0-9b-mv45zyde` | `https://huggingface.co/TaichuAI/ZDTaichu5.0-9B` | `hf-taichua` | Multi-dimensional audit evidence | 2026-10-11T18:36:42.935Z |
| `learn-huggingface-hf-phocinae-phocinae-largha-150m-v1-mv463krd` | `https://huggingface.co/Phocinae/Phocinae-Largha-150M-v1` | `hf-phocina` | Multi-dimensional audit evidence | 2026-10-11T18:39:31.896Z |
| `learn-huggingface-hf-comfy-org-qwen-image-2-1-mv467olr` | `https://huggingface.co/Comfy-Org/Qwen-Image-2.1` | `hf-comfy-o` | Multi-dimensional audit evidence | 2026-10-11T18:42:43.501Z |
| `learn-huggingface-hf-akhilaaa3-jev-omni-mv46br3m` | `https://huggingface.co/akhilaaa3/Jev-Omni` | `hf-akhilaa` | Multi-dimensional audit evidence | 2026-10-11T18:45:53.346Z |
| `learn-huggingface-hf-xiaomimimo-mimo-v2-6-distill-qwen-9b-mv46fo61` | `https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Distill-Qwen-9B` | `hf-xiaomim` | Multi-dimensional audit evidence | 2026-10-11T18:48:56.208Z |
| `learn-huggingface-hf-inclusionai-ming-image-0-1-design-mv46je2y` | `https://huggingface.co/inclusionAI/Ming-Image-0.1-Design` | `hf-inclusi` | Multi-dimensional audit evidence | 2026-10-11T18:51:49.735Z |
| `learn-huggingface-hf-deepseek-ai-deepseek-v4-1-flash-mv46mzeq` | `https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash` | `hf-deepsee` | Multi-dimensional audit evidence | 2026-10-11T18:54:37.341Z |
| `learn-huggingface-hf-akatz-ai-minimax-h3-character-swap-lora-mv46r4cy` | `https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA` | `hf-akatz-a` | Multi-dimensional audit evidence | 2026-10-11T18:57:50.384Z |
| `learn-huggingface-hf-unsloth-qwen-image-2-1-gguf-mv46v2n7` | `https://huggingface.co/unsloth/Qwen-Image-2.1-GGUF` | `hf-unsloth` | Multi-dimensional audit evidence | 2026-10-11T19:00:54.748Z |
| `learn-huggingface-hf-xiaomimimo-mimo-v2-6-pro-rl-mv46ytbg` | `https://huggingface.co/XiaomiMiMo/MiMo-V2.6-Pro-RL` | `hf-xiaomim` | Multi-dimensional audit evidence | 2026-10-11T19:03:49.325Z |
| `learn-huggingface-hf-orcarouter-orcasaq-2-cyber-27b-uncensored-gguf-mv472vwd` | `https://huggingface.co/orcarouter/OrcaSAQ-2-Cyber-27B-Uncensored-GGUF` | `hf-orcarou` | Multi-dimensional audit evidence | 2026-10-11T19:06:59.296Z |
| `learn-huggingface-hf-alissonerdx-bfs-best-face-swap-mv476k43` | `https://huggingface.co/Alissonerdx/BFS-Best-Face-Swap` | `hf-alisson` | Multi-dimensional audit evidence | 2026-10-11T19:09:50.624Z |
| `learn-huggingface-hf-ukisai-swift-1-5-qwen3-8-27b-gsq-rco-gguf-mv47apdo` | `https://huggingface.co/ukisai/Swift-1.5-Qwen3.8-27B-GSQ-RCO-GGUF` | `hf-ukisai-` | Multi-dimensional audit evidence | 2026-10-11T19:13:04.092Z |
| `learn-huggingface-hf-nerkyor-qwen3-8-27b-coder390-efficientthink-opus5-5-gpt6astra-grok4-7-dsv4pro-k3-sft-rloo-mtp-dflash2-mv47ewm0` | `https://huggingface.co/nerkyor/Qwen3.8-27B-Coder390-EfficientThink-Opus5.5-GPT6Astra-Grok4.7-DSV4Pro-K3-SFT-RLOO-MTP-DFlash2` | `hf-nerkyor` | Multi-dimensional audit evidence | 2026-10-11T19:16:20.095Z |
| `learn-huggingface-hf-psrben-visionhope-mv47isqm` | `https://huggingface.co/PSRben/VisionHOPE` | `hf-psrben-` | Multi-dimensional audit evidence | 2026-10-11T19:19:21.696Z |
| `learn-huggingface-hf-ista-daslab-qwen3-8-flash-next-gsq-rco-coder-gguf-mv47md9a` | `https://huggingface.co/ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-Coder-GGUF` | `hf-ista-da` | Multi-dimensional audit evidence | 2026-10-11T19:22:08.253Z |
| `learn-huggingface-hf-ista-daslab-qwen3-8-flash-next-gsq-rco-gguf-mv47q2a0` | `https://huggingface.co/ISTA-DASLab/Qwen3.8-Flash-Next-GSQ-RCO-GGUF` | `hf-ista-da` | Multi-dimensional audit evidence | 2026-10-11T19:25:00.649Z |
