# Project Brain Bridge Protocol

> Canonical reference: `AI-Builder-Brain/13_GOVERNANCE/brain-bridge-protocol.md`  
> Purpose: Governs the zero-copy, read-only interface connecting individual child projects to the central canonical Master Brain (`C:\AI-Builder-Brain`).

---

## 1. Architectural Principles

1. **Master AI-Builder-Brain Remains Canonical & Separate**:
   - Master Brain lives at its own dedicated location (e.g. `C:\AI-Builder-Brain`).
   - Child projects MUST NEVER copy the Master Brain directory into their repositories.
   - Child projects MUST NEVER silently or directly modify files in the Master Brain.

2. **Zero-Copy Knowledge Access via `.project-brain/`**:
   Every project maintains a minimal `.project-brain/` directory containing:
   - `brain-bridge.json`: Metadata, path reference, cached knowledge index, and health status.
   - `incidents/`: Verified defect logs and fixes (`INC-XXX.md`).
   - `lessons/`: Project-specific learnings.
   - `promotion-queue/`: Formatted candidate learnings queued for Master Brain review.

3. **Discovery & Fallback Hierarchy**:
   The Brain Bridge discovers Master Brain in this strict order:
   - Environment variable: `AI_BUILDER_BRAIN_PATH`
   - Config file: `.project-brain/brain-bridge.json` -> `masterBrainPath`
   - Canonical location: `C:\AI-Builder-Brain`
   - Workspace sibling search: `..\AI-Builder-Brain`
   - If unlocated, the Bridge transitions cleanly to `OFFLINE_LOCAL` mode without crashing the project.

4. **Selective Query Interface**:
   Instead of injecting hundreds of markdown files into the prompt, the agent queries specific topics selectively:
   - `brain query engineering-patterns <topic>`
   - `brain query skills <skill-name>`
   - `brain query rules <rule-type>`

5. **Two-Way Learning Highway**:
   - **Inbound**: Master Brain supplies validated engineering patterns (Rules 1-17+), error prevention protocols, and SEO/UI skills.
   - **Outbound**: Real project incidents and verified fixes are recorded locally in `.project-brain/incidents/`, validated against evidence criteria, and prepared into promotion proposals in `.project-brain/promotion-queue/` for human review before updating Master Brain.

6. **Autonomous Silent Auto-Harvest Engine**:
   - Whenever any child project connects to `C:\AI-Builder-Brain` via the bridge or comes into contact with the Brain OS, the bridge activates continuous background harvesting.
   - The agent quietly ("chupchap") audits newly resolved defects, commits, and architectural boundaries across the 8 dimensions using the 5-step pipeline, extracting reusable patterns and synchronizing them into the Master Brain automatically.
   - The developer does not need to issue manual harvesting prompts during project development or bridging.

---

## 2. Canonical Bridge Configuration Schema (`brain-bridge.json`)

```json
{
  "bridgeVersion": "1.1.0",
  "projectName": "my-project",
  "createdAt": "2026-09-27T10:00:00.000Z",
  "masterBrainPath": "C:\\AI-Builder-Brain",
  "connected": true,
  "zeroCopyEnforced": true,
  "readOnlyEnforced": true,
  "autoHarvest": {
    "enabled": true,
    "silentSync": true,
    "workflow": "04_WORKFLOWS/autonomous-knowledge-harvesting-workflow.md",
    "promptEngine": "10_PROMPTS/autonomous-5-step-learning-engine.md"
  },
  "indexedKnowledge": [
    "05_KNOWLEDGE/engineering-patterns.md",
    "03_SKILLS/astro-architecture-and-seo.md",
    "03_SKILLS/tailwind-v4-css-first-design.md",
    "03_SKILLS/vercel-deployment-playbook.md",
    "03_SKILLS/autonomous-project-learning-harvester.md",
    "02_AGENT_INTELLIGENCE/agent-execution-governance.md",
    "01_CORE/operating-rules.md"
  ],
  "learningPromotionWorkflow": {
    "protocol": "14_EVOLUTION/brain-evolution-protocol.md",
    "stagingDirectory": ".project-brain/promotion-queue",
    "targetInbox": "11_INBOX",
    "reviewRequired": true
  }
}
```

