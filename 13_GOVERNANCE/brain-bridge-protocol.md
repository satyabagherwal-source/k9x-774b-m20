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
   - **Inbound**: Master Brain supplies validated engineering patterns (Rules 1-14+), error prevention protocols, and SEO/UI skills.
   - **Outbound**: Real project incidents and verified fixes are recorded locally in `.project-brain/incidents/`, validated against evidence criteria, and prepared into promotion proposals in `.project-brain/promotion-queue/` for human review before updating Master Brain.

---

## 2. Canonical Bridge Configuration Schema (`brain-bridge.json`)

```json
{
  "bridgeVersion": "1.0.0",
  "projectName": "my-project",
  "createdAt": "2026-09-25T16:00:00.000Z",
  "masterBrainPath": "C:\\AI-Builder-Brain",
  "connected": true,
  "zeroCopyEnforced": true,
  "readOnlyEnforced": true,
  "indexedKnowledge": [
    "05_KNOWLEDGE/engineering-patterns.md",
    "03_SKILLS/astro-architecture-and-seo.md",
    "03_SKILLS/tailwind-v4-css-first-design.md",
    "03_SKILLS/vercel-deployment-playbook.md",
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
