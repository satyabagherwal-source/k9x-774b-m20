# Multi-Agent Learning Fleet (AI-Builder-Brain Swarm)

The **Multi-Agent Learning Fleet** orchestrates multiple autonomous AI workers operating in parallel to scout, evaluate, extract, and ingest engineering intelligence into AI-Builder-Brain simultaneously without collisions.

---

## 1. Fleet Architecture & Domain Allocation

```
+---------------------------------------------------------------------------------------------------+
|                            MULTI-AGENT LEARNING FLEET ORCHESTRATOR                                |
+---------------------------------------------------------------------------------------------------+
                                                  |
         +-----------------------+----------------+----------------+-----------------------+
         |                       |                                 |                       |
         v                       v                                 v                       v
+-------------------+   +--------------------+            +--------------------+   +--------------------+
|   Agent Alpha     |   |    Agent Beta      |            |    Agent Gamma     |   |    Agent Delta     |
| (Domain: Agents)  |   | (Domain: Fullstack)|            | (Domain: High-Perf)|   | (Domain: HF-Models)|
+-------------------+   +--------------------+            +--------------------+   +--------------------+
         |                       |                                 |                       |
         | Lock: scout-ai-agents | Lock: scout-fullstack           | Lock: scout-high-perf | Lock: scout-hf     |
         v                       v                                 v                       v
[GitHub Search: Agents] [GitHub Search: UI]               [GitHub Search: Rust]    [Hugging Face Hub]
         |                       |                                 |                       |
         v                       v                                 v                       v
 [Quality Gate >=1.5k]   [Quality Gate >=4.0k]             [Quality Gate >=3.0k]   [Quality Gate >=500]
         |                       |                                 |                       |
         +-----------------------+----------------+----------------+-----------------------+
                                                  |
                                                  v
                                    [Target Locking: .harvest-locks/]
                                                  |
                                                  v
                               +-------------------------------------+
                               | Google Gemini Server-to-Server AI   |
                               | (Micro & Macro Forensic Synthesis)  |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               | Atomic Rebase-Retry Push Barrier    |
                               | (pushWithRebaseRetry / 0 Collision) |
                               +-------------------------------------+
                                                  |
                                                  v
                               +-------------------------------------+
                               | Canonical AI-Builder-Brain (GitHub) |
                               +-------------------------------------+
```

### 1.1 Worker Roster

| Agent ID | Codename | Target Technology Frontier | Quality Threshold |
| :--- | :--- | :--- | :--- |
| **Worker 1** | `Agent-Alpha` | **AI & Autonomous Agents**: Agent harnesses, runtime frameworks, tool-use systems, MCP servers | $\ge 1,500$ Stars |
| **Worker 2** | `Agent-Beta` | **Modern Full-Stack & UI**: Design systems, React 19, Next.js, Astro, Tailwind, state managers | $\ge 2,500$ Stars |
| **Worker 3** | `Agent-Gamma` | **High-Performance Systems**: Runtimes, CLI tooling, memory allocators in Rust, Zig, Go | $\ge 3,000$ Stars |
| **Worker 4** | `Agent-Delta` | **Hugging Face AI Models**: Foundation model architectures, open-weight reasoning models | $\ge 500$ Downloads |

---

## 2. Collision-Free Concurrency Guarantees

1. **Distributed Domain Locks**:
   - Each worker locks its assigned domain using `.harvest-locks/scout-domain-<domain>.lock` with a 20-minute auto-expiry TTL.
   - Workers never scout or query the same domain simultaneously.
2. **Target Locking**:
   - Before extracting intelligence from any repository, the agent acquires `.harvest-locks/<slug>.lock`.
   - If two agents encounter the same candidate, the second agent immediately skips to the next candidate.
3. **Dynamic Rule Auto-Increment**:
   - Universal engineering rules use `resolveNextRuleNumber()` dynamically at commit time, preventing duplicate Rule numbers (Rule 72, 73, 74...).
4. **Atomic Git Rebase-Retry Push Barrier**:
   - When multiple workers finish simultaneously, Git pushes use an exponential jitter retry loop with `git pull --rebase origin main` to guarantee zero merge conflicts and zero dropped commits.

---

## 3. How to Launch the Multi-Agent Fleet

### Mode A: Run Local Fleet on Laptop (Parallel Multi-Process)
Run all 4 agents in parallel across separate CPU cores:
```powershell
node 04_WORKFLOWS/factory-engine/harvester-control.mjs fleet
```
*(Or directly: `node 04_WORKFLOWS/factory-engine/multi-agent-fleet.mjs`)*

### Mode B: 24/7 Cloud Fleet on GitHub Actions (Zero Laptop Power Needed)
The GitHub Actions workflow runs all 4 agents in parallel cloud runners:
* **Schedule**: Automatically runs every 2 hours continuously in the cloud.
* **Manual Cloud Trigger**:
  ```powershell
  gh workflow run 24-7-cloud-harvester.yml
  ```
  Or trigger from the GitHub Actions web UI.
