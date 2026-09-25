# Website & Project Bug Correction Lifecycle Skill

> **Location**: `AI-Builder-Brain/03_SKILLS/project-correction-and-regression.md`  
> **Purpose**: Guides agents through forensic bug correction, regression prevention, and knowledge harvesting in live web applications.

---

## 1. The Forensic Correction Pipeline

Every defect, regression, or user report must pass through this exact sequence:

```
[ 1. BUG REPORT ]
        ↓
[ 2. CAPTURE SYMPTOMS ]
        ↓
[ 3. REPRODUCE LOCALLY ]
        ↓
[ 4. FORENSIC ROOT CAUSE ]
        ↓
[ 5. SURGICAL MINIMAL FIX ]
        ↓
[ 6. BUILD & TEST ]
        ↓
[ 7. RUNTIME DOM VERIFY ]
        ↓
[ 8. ZERO-REGRESSION AUDIT ]
        ↓
[ 9. LOG INCIDENT (INC-XXX.md) ]
        ↓
[ 10. PROJECT LEARNING REGISTER ]
        ↓
[ 11. PROPOSE REUSABLE LEARNING (PROPOSAL-XXX.md) ]
```

---

## 2. Invariants During Bug Correction

1. **Non-Destructive Invariant**:
   Never rewrite entire files when a surgical patch suffices.
   Never touch working canvas mathematics, calculation formulas, or responsive ad wrappers.

2. **Cross-Platform String Safety**:
   Use `split(/\r?\n/)` to avoid dropping data across Windows CRLF and POSIX LF environments.

3. **Regression Audit**:
   Verify adjacent components and global styles before completing the task.
