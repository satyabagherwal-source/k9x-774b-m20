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
