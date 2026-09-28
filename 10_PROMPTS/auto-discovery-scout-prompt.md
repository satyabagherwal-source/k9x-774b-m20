# Master Prompt: Autonomous Repository Discovery Scout

Use this prompt when instructing any AI agent (local or subagent) to autonomously discover and curate world-class open-source repositories into AI-Builder-Brain without human intervention.

---

## Agent Activation Command
> *"Scout the best open-source repositories across AI agents, fullstack UI, and high-performance systems and queue them for harvesting."*

---

## Autonomous Multi-Agent Protocol

1. **Check Concurrency Locks**:
   - Inspect `.harvest-locks/scout-domain-<domain>.lock`.
   - If another agent is scouting `ai-agents`, claim the next unallocated domain:
     - `fullstack-ui`
     - `high-perf-systems`
     - `huggingface-ai-models`

2. **Execute Autonomous Discovery**:
   ```bash
   node 04_WORKFLOWS/factory-engine/auto-discovery-scout.mjs [domain]
   ```

3. **Validate Quality Score & Gates**:
   - Stars $\ge 1,500$
   - Pushed within last 120 days
   - Non-fork, non-archived
   - Permissive license (MIT, Apache-2.0, BSD)
   - Deduplication: Must not exist in `sources-registry.json` or `repos.txt`

4. **Synchronize Queue**:
   - The scout automatically appends approved repositories to `repos.txt`.
   - The scout automatically records metadata into `04_WORKFLOWS/factory-engine/discovery-log.json`.
   - Commit and push to GitHub:
     ```bash
     git add repos.txt harvest-control.json 04_WORKFLOWS/factory-engine/discovery-log.json
     git commit -m "feat(scout): autonomously discovered top repositories [skip ci]"
     git push origin main
     ```

5. **Chain into Harvest**:
   - Immediately transition to Zero-Clone API Harvester (`node 04_WORKFLOWS/factory-engine/zero-clone-harvester.mjs`) to extract forensic fixes and patterns with 0 bytes cloned to disk.
