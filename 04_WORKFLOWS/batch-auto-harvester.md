# Batch Auto-Harvester Workflow

> **Canonical Reference**: `AI-Builder-Brain/04_WORKFLOWS/batch-auto-harvester.md`  
> **Engine Executable**: `04_WORKFLOWS/factory-engine/batch-auto-harvester.mjs`  
> **Queue File**: `repos.txt` (Workspace root)  
> **Purpose**: 100% autonomous, zero-friction learning harvester for batches of GitHub repositories. Eliminates manual cloning, manual folder navigation, and tedious multi-turn prompting.

---

## 1. Executive Summary & User Experience

### The User's ONLY Job:
1. Paste GitHub repository URLs into `repos.txt` or directly in chat.
2. Say: **"In sabhi repos se harvest kar lo"** (or run `node 04_WORKFLOWS/factory-engine/batch-auto-harvester.mjs`).

### What the AI / Harvester Engine Does Autonomously:
1. **GitHub Pre-flight Sync**: Pulls remote updates (`git pull --rebase origin main`) on Master Brain so local and remote states are synchronized.
2. **Loop Over Repositories**:
   - **Full Clone**: Runs `git clone <url> <temp_dir>`. Performs a full clone so that the complete historical commits, tags, release milestones, and architecture bug fixes are extracted without omissions.
   - **8-Dimensional Investigation**: Deeply inspects code, manifests, architecture, and full commit history across:

     - D1: Architecture & Structural Boundaries
     - D2: Asynchronous State & Concurrency
     - D3: Error Boundaries, Recovery & Rollbacks
     - D4: Resource Lifecycle & Leak Defenses
     - D5: Boundary Deserialization & Encoding
     - D6: Cross-Platform & Runtime Gotchas
     - D7: Build, CI/CD, Deployment & Tooling
     - D8: Forensic Bug Fixes & Real Incidents
   - **Brain Integration**:
     - Writes detailed forensic record into `07_PROJECT_LEARNING/[repo]-learnings.md`.
     - Appends/refines universal engineering rules in `05_KNOWLEDGE/engineering-patterns.md`.
     - Updates domain playbooks in `03_SKILLS/`.
     - Updates `04_WORKFLOWS/factory-engine/sources-registry.json`.
     - Records event in `14_EVOLUTION/` and `15_METADATA/brain-status.md`.
   - **Autonomous Git Commit & Remote Push**: Automatically runs `git add .`, commits with clear provenance, and executes `git push origin main`.
   - **Immediate Temp Cleanup**: Deletes the shallow-cloned folder (`rmdir /s /q`) before proceeding to the next repo. **Zero disk space is retained.**
   - **Next Repo**: Advances to the next repository without waiting for user intervention.
3. **Completion Report**: Delivers an executive summary of all processed repos, rules added, and confirmation that all changes are live on GitHub.

---

## 2. Queue Configuration (`repos.txt`)

Place repository URLs in `c:\AI-Builder-Brain\repos.txt`:

```text
# AI-Builder-Brain Batch Auto-Harvester Queue
https://github.com/shadcn-ui/ui
https://github.com/tailwindlabs/tailwindcss
https://github.com/vllm-project/vllm
```

- Blank lines and lines starting with `#` are automatically ignored.
- Trailing slashes and `.git` extensions are normalized.

---

## 3. Invocation Methods

### Method A: Conversational (Any AI Agent)
Paste the URLs in chat or tell the agent:
> *"In sabhi repos se harvest kar lo"*  
> *"repos.txt mein jitne repos hain sabhi se learning harvest karke brain mein push kar do"*

The agent executes the loop autonomously using its tools or invokes the batch script.

### Method B: Standalone CLI
Run directly from PowerShell or terminal:

```bash
# Harvest all repos in repos.txt
node 04_WORKFLOWS/factory-engine/batch-auto-harvester.mjs

# Harvest specific repos passed as CLI arguments
node 04_WORKFLOWS/factory-engine/batch-auto-harvester.mjs https://github.com/shadcn-ui/ui https://github.com/vllm-project/vllm

# Harvest from a custom file
node 04_WORKFLOWS/factory-engine/batch-auto-harvester.mjs --file my-repos-list.txt
```

---

## 4. Architectural Safety Invariants

| Invariant | Enforcement Mechanism |
|---|---|
| **Full Clone for Complete Learning** | Performs full `git clone` to capture 100% of historical commits, tags, and architectural bug fixes without omissions. |
| **Sandboxed Directory** | Clones into `.temp-harvest/` (ignored in `.gitignore`) or OS tempdir. |
| **Guaranteed Immediate Cleanup** | Deletion runs in a `finally` block with Windows read-only attribute stripping, guaranteeing 0 bytes disk waste. |
| **Continuous Remote Sync** | Every repository harvest commits and pushes to GitHub (`origin main`) immediately. |
| **Non-Halting Batch** | A failure in one repository logs an error in the audit report and continues to the next without aborting the batch. |

