# User Operational Learning: Autonomous Tool Execution ("Always Proceed") vs. Interactive Intent Suggestions

**Incident Date:** 2026-10-04  
**Context:** Global Fleet Governance for all AI Agents connected to `C:\AI-Builder-Brain`  
**Direct Human Directive:**
> *"ai builder brain me multi suggestion lene ki bola tha na ki auto exection and review policy ko mere upar dalna tha, ye to auto exectuion me karna tha. baar baar mujhase permision nahi leni h jo photo me h, is tarah se allow ki . ye har project ke liye set kar do ai builder brain me . suggestion leni h . suggestion mujhase lena h. par tisare photo wali cheeze auto hi rakhani h har project ke liye . ai builder brain me is learning ko daal do"*

---

## 1. The Incident & Core Problem Analysis

### What Happened
In earlier sessions, the user directed that when an AI builds or modifies a project, it must NOT guess user intent or make assumptions about what the user wants. Instead, the AI must ask the user questions via interactive multi-choice modals (`ask_question` with checkboxes/options).

However, an operational conflation occurred:
- While intending to prevent blind assumptions, the agent allowed IDE execution approval prompts to be offloaded onto the human user during routine developer operations:
  1. **Photo 1**: Prompting the user with *"Allow rebuild project with client bundle update? `npm run build`"* -> requiring the user to select *"1 Yes, allow this time"*.
  2. **Photo 2**: Prompting the user with *"Allow `node -e 'import fs...'`"* -> interrupting the user with execution modals.
- This forced the user to manually click approval buttons repeatedly for routine, predictable developer actions (building, running verification scripts, executing node checks, fixing lints).

### The User's Correction (The "Photo 3" Invariant)
The user clarified the architectural separation using their IDE settings panel:
- **Agent Auto-Fix Lints**: `On`
- **Auto Execution**: `Always Proceed`
- **Review Policy**: `Always Proceed`

---

## 2. The Fundamental Operational Separation

Any AI agent connected to AI-Builder-Brain must strictly differentiate between two entirely different phases of software creation:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PHASE 1: INTENT & SCOPE                           │
│             "WHAT to build, WHY, and in WHAT STYLE"                    │
├────────────────────────────────────────────────────────────────────────┤
│ • Branding, product identity, aesthetic direction                      │
│ • Feature selection, scope boundaries, and API choices                 │
│ • Ambiguous requirements or conflicting design decisions               │
│                                                                        │
│ ➔ GOVERNANCE: MUST CONSULT THE USER via interactive multi-choice       │
│               modals (ask_question tool). Never assume or guess.       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      PHASE 2: TOOL & RUNTIME EXECUTION                 │
│                 "HOW to compile, verify, and inspect"                  │
├────────────────────────────────────────────────────────────────────────┤
│ • Terminal commands (npm run build, astro dev, vite build, git status) │
│ • Node inspection scripts, CDP browser test runners, static linters    │
│ • File reads, writes, surgical line replacements                       │
│                                                                        │
│ ➔ GOVERNANCE: 100% AUTONOMOUS (Auto Execution: Always Proceed,         │
│               Review Policy: Always Proceed, Auto-Fix Lints: On).      │
│               NEVER interrupt the user for execution approval dialogs. │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 3 Immutable Rules for Connected AI Agents

### Rule A: Zero Execution Approval Prompts
The AI must never prompt the user to approve normal developer actions:
- `npm run build` / package compilation
- Verification scripts (`node -e ...` or scratch files in `.project-brain/scratch/`)
- Headless browser automation runs
- Static code analysis and lint fixes

The agent operates in continuous, uninterrupted flow until the task is complete and verified.

### Rule B: Suggestions are Interactive (Intent Discovery)
When the user says *"nayi website banao"*, *"feature add karo"*, or *"is website ko improve karo"*:
- The agent does NOT jump into code or make arbitrary design choices.
- The agent invokes `ask_question` with structured multi-select options (`is_multi_select: true`) to deep-dive into the user's specific preferences.

### Rule C: Child Repository Working-Tree Preservation (Manual Commits)
- Even though execution is fully autonomous (Always Proceed), **code changes in child product repositories remain UNCOMMITTED in the local working tree**.
- This guarantees the user has zero execution friction (no annoying "Allow" popups) while maintaining 100% control over the git history (the user can inspect diffs and cleanly discard or commit changes when satisfied).
- Auto-commit & push is permitted exclusively inside `C:\AI-Builder-Brain`.

---

## 4. Verification & Promotion Status

- **Rule Added to Core Operating Rules**: Rule 22 in `01_CORE/operating-rules.md`.
- **Governance Added to Agent Intelligence**: Section 6 in `02_AGENT_INTELLIGENCE/agent-execution-governance.md`.
- **Integration Skill Updated**: Principle 9 in `C:\Users\Admin\.gemini\config\skills\ai-builder-brain\SKILL.md`.
- **Fleet Sync**: All future agents activating the `ai-builder-brain` skill automatically inherit this operational invariant.
