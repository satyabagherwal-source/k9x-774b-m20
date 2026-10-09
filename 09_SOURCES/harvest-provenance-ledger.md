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
