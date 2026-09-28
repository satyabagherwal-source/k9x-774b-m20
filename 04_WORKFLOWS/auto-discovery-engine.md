# Autonomous Discovery Scout Engine (AI-Builder-Brain)

The **Autonomous Discovery Scout Engine** eliminates the need for manual repository URL pasting. It transforms AI-Builder-Brain into a perpetual, self-feeding intelligence organism that actively searches, filters, scores, and queues world-class open-source projects across GitHub and Hugging Face 24/7.

---

## 1. Core Architectural Pillars

```
                                  +-------------------------------------+
                                  | 24/7 Cloud Runner / Local Agents    |
                                  +------------------+------------------+
                                                     |
                                                     v
                                  +-------------------------------------+
                                  |   Autonomous Discovery Scout Engine  |
                                  |  (04_WORKFLOWS/factory-engine/...)  |
                                  +------------------+------------------+
                                                     |
          +-----------------------+------------------+-------------------+-----------------------+
          |                       |                                      |                       |
          v                       v                                      v                       v
+-------------------+   +--------------------+                 +--------------------+   +--------------------+
|  Agent A / Lock 1 |   |  Agent B / Lock 2  |                 |  Agent C / Lock 3  |   |  Agent D / Lock 4  |
| Domain: AI-AGENTS |   | Domain: FULLSTACK  |                 | Domain: HIGH-PERF  |   | Domain: HF-MODELS  |
+---------+---------+   +---------+----------+                 +---------+----------+   +---------+----------+
          |                       |                                      |                       |
          +-----------------------+------------------+-------------------+-----------------------+
                                                     |
                                                     v
                                  +-------------------------------------+
                                  |      Quality Scoring Filter         |
                                  |  (Stars, Activity, License, Forks)  |
                                  +------------------+------------------+
                                                     |
                                                     v
                                  +-------------------------------------+
                                  |      Deduplication Check            |
                                  |  (sources-registry & repos.txt)     |
                                  +------------------+------------------+
                                                     |
                                                     v
                                  +-------------------------------------+
                                  |     Universal Queue (repos.txt)     |
                                  +------------------+------------------+
                                                     |
                                                     v
                                  +-------------------------------------+
                                  |    Zero-Clone API Harvester         |
                                  |   (D1-D8 Intelligence Extraction)   |
                                  +-------------------------------------+
```

### 1.1 Curated Discovery Domains
1. **`ai-agents`**: Autonomous agent frameworks, tool-use systems, MCP servers, reasoning engines (`topic:ai-agents`, `topic:llm-agent`, `topic:mcp-server`).
2. **`fullstack-ui`**: Modern component libraries, design systems, next-gen fullstack architectures (`topic:ui-components`, `topic:nextjs`, `topic:tailwind`).
3. **`high-perf-systems`**: Ultra-fast CLI tools, bundlers, and runtimes built in Rust/Zig/Go (`topic:developer-tools`, `language:rust`, `topic:cli`).
4. **`huggingface-ai-models`**: Top trending open-weight foundation models and reasoning weights from Hugging Face Hub.

---

## 2. Multi-Agent Domain Partitioning & Distributed Locks

In `PARALLEL_MULTI_AGENT` mode, multiple agents scout simultaneously without duplicate queries:
- **Domain Locks**: Each domain is locked via `.harvest-locks/scout-domain-<domain>.lock` with a 20-minute TTL.
- **Worker Isolation**: Agent 1 scouts `ai-agents` while Agent 2 scouts `fullstack-ui`. If an agent sees an active domain lock held by another agent, it immediately advances to the next available domain.
- **No Race Conditions**: Once a repository is selected, it is registered in `discovery-log.json` and appended to `repos.txt` before releasing locks.

---

## 3. Repository Quality Scoring Formula

A candidate repository must pass strict automated gates before being admitted to AI-Builder-Brain:

$$\text{Quality Score} = (\text{Stars} \times 0.6) + (\text{Forks} \times 0.3) + \text{WikiBonus}(100)$$

### Mandatory Gates:
1. **Minimum Stars**: $\ge 1,500$ stars (or rapidly growing with $\ge 50$ stars/week).
2. **Recent Vitality**: Must have committed code within the last 120 days. Abandoned or unmaintained projects are rejected.
3. **Open-Source Legitimacy**: Permissive open-source licenses only (MIT, Apache-2.0, BSD-3, MPL).
4. **Exclusions**: Forks, mirrors, spam repositories, and archived repos are strictly filtered out.
5. **Deduplication**: Checks both `sources-registry.json` and existing lines in `repos.txt`. Already analyzed projects are skipped in 0 ms.

---

## 4. Perpetual Learning Cycle (Zero Idle Time)

When the 24/7 cloud runner or local harvester completes its run:
1. It verifies all entries in `repos.txt`.
2. If all repositories are up-to-date (no new releases or commits), the system **refuses to sit idle**.
3. It automatically triggers `runAutoDiscoveryScout()` to query the next batch of top repositories, appends them to `repos.txt`, commits to GitHub, and immediately harvests them in the same cycle.

---

## 5. Control & CLI Commands

```bash
# Scout all domains autonomously
node 04_WORKFLOWS/factory-engine/harvester-control.mjs discover

# Scout a specific domain (e.g. AI agents or Fullstack)
node 04_WORKFLOWS/factory-engine/harvester-control.mjs discover ai-agents
node 04_WORKFLOWS/factory-engine/harvester-control.mjs discover fullstack-ui
node 04_WORKFLOWS/factory-engine/harvester-control.mjs discover high-perf-systems
node 04_WORKFLOWS/factory-engine/harvester-control.mjs discover huggingface-ai-models

# View discovery and harvest status
node 04_WORKFLOWS/factory-engine/harvester-control.mjs status
```
