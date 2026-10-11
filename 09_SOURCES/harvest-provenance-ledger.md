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
