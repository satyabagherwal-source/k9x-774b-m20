# Bug Correction Lifecycle & Incident Learning Protocol

> Canonical reference: `AI-Builder-Brain/13_GOVERNANCE/bug-correction-lifecycle-protocol.md`  
> Purpose: Governs the forensic bug correction, regression prevention, and knowledge harvesting lifecycle across all projects created by AI-Builder-Brain.

---

## 1. The 11-Stage Bug Correction Pipeline

Every defect, bug report, or user correction must proceed through this exact forensic cycle:

```
[ 1. BUG REPORT / OBSERVED SYMPTOM ]
                 ↓
[ 2. CAPTURE IN LOCAL STATE ]
                 ↓
[ 3. DETERMINISTIC REPRODUCTION ]
                 ↓
[ 4. FORENSIC ROOT-CAUSE DIAGNOSIS ]
                 ↓
[ 5. SURGICAL IN-PLACE FIX ]
                 ↓
[ 6. COMPILE & TEST VERIFICATION ]
                 ↓
[ 7. RUNTIME & DOM VERIFICATION ]
                 ↓
[ 8. ZERO-REGRESSION AUDIT ]
                 ↓
[ 9. LOG LOCAL INCIDENT (INC-XXX.md) ]
                 ↓
[ 10. PROJECT LEARNING RECORD ]
                 ↓
[ 11. REUSABLE LEARNING PROPOSAL (PROPOSAL-XXX.md) ]
```

---

## 2. Stage Breakdown & Execution Rules

### Stage 1: Bug Report / Observed Symptom
- Capture the exact user complaint or observed anomaly without defensive bias.
- Differentiate what the user expected vs what actually happened.

### Stage 2: Capture in Local State
- Update `PROJECT_STATE.json` active issues log.
- Do not hide or minimize failures.

### Stage 3: Deterministic Reproduction
- Reproduce the bug using a minimal test script or live terminal probe.
- If it cannot be reproduced, gather direct runtime evidence before proceeding.

### Stage 4: Forensic Root-Cause Diagnosis
- Trace behavior end-to-end (Network -> Router -> SSR HTML -> Client JS / Canvas).
- Inspect surrounding context (30–60 lines).
- Avoid guessing or committing to the first superficial explanation.

### Stage 5: Surgical In-Place Fix
- Apply the smallest atomic patch that resolves the root cause.
- Adhere to the **Non-Destructive Invariant**: Do NOT refactor working modules, canvas mathematics, or visual layouts.

### Stage 6 & 7: Compile, Test & Runtime Verification
- Execute `npm run build` — must exit code 0.
- Probe running server or inspect `dist/` HTML/CSS artifacts.

### Stage 8: Zero-Regression Audit
- Ensure adjacent components, responsive styles, and ad containers remain intact.

### Stage 9 & 10: Local Incident & Project Learning Log
- Record incident under `.project-brain/incidents/INC-[ID]-[title].md` using the canonical 10-point learning protocol:
  1. Context & Feature
  2. Expected outcome
  3. Observed failure
  4. Evidence
  5. Root cause
  6. Action taken
  7. Verification evidence
  8. Candidate lesson
  9. Scope (project-specific vs reusable)
  10. Remaining uncertainties

### Stage 11: Reusable Learning Proposal
- If the pattern applies across other projects (e.g. Astro edge-redirect gotcha, Tailwind v4 theme token syntax), draft proposal in `.project-brain/promotion-queue/PROPOSAL-[ID]-[title].md` for review and promotion to Master Brain.
