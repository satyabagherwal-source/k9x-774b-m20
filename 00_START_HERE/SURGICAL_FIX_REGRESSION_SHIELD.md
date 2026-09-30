# 🛡️ Surgical Fix & Anti-Regression Shield Protocol

> **The Cardinal Law of Maintenance**:  
> *"Ek cheez ko fix karne ke chakkar me doosri working cheez kabhi nahi tootni chahiye."*  
> (A bug fix or feature addition that breaks an existing working capability is a catastrophic regression. Zero collateral damage is mandatory.)

---

## 1. The 5 Anti-Regression Invariants

### Invariant 1: Zero Blast Radius (Strict Scope Containment)
- **Rule**: Touch **ONLY** the specific lines, function, or stylesheet block responsible for the defect or requested feature.
- **Negative Constraint**: Strictly FORBIDDEN from refactoring adjacent methods, re-formatting unrelated lines, changing indentation styles, or reordering imports while fixing an isolated issue.
- **Example**: If fixing a button click handler, do NOT rewrite the entire component layout, state management, or parent props.

### Invariant 2: Interface & Contract Freezing
- **Rule**: All existing function signatures, TypeScript interfaces, React prop types, API payload shapes, and export names are **FROZEN**.
- **Negative Constraint**: Never rename an exported function, add a required parameter without a default value, or change return types in existing shared modules.

### Invariant 3: Preservation of Past Bug Defenses & Comments
- **Rule**: Existing edge-case checks, null guards (`?.`), and comments are historical records of solved production issues.
- **Negative Constraint**: Never delete "strange-looking" checks, regex normalizations (e.g. `\r?\n`), or try/catch blocks assuming they are "redundant". They were placed there to fix real bugs.

### Invariant 4: Dual Verification Gate (The Before & After Proof)
Whenever fixing a bug or editing code in any project:
1. **Pre-Flight**: Verify the current state and reproduce the exact issue.
2. **Surgical Patch**: Apply minimal, localized patch using targeted diff replacement (5–20 lines max).
3. **Target Verification**: Confirm the reported bug is 100% fixed.
4. **Regression Verification**: Confirm that other routes, components, and pages still build and run cleanly (`npm run build`, `npm test`, or runtime check).

### Invariant 5: The Atomic Rollback Rule (Never Pile Bad Patches)
- If your patch fails to fix the issue or introduces a new error in a different component:
  - **DO NOT** write a 2nd, 3rd, or 4th speculative patch on top of the broken code.
  - **IMMEDIATELY REVERT** back to the last working baseline (`git restore <file>` or undo edit).
  - Re-examine the root cause from first principles.

---

## 2. Surgical Edit Checklist (Tool Usage Rules)

| Task | ❌ What Amateurs Do (Causes Regressions) | ✅ The Surgical Standard (Zero Regressions) |
| :--- | :--- | :--- |
| **Fixing 1 line in a 400-line file** | Overwrites the entire 400-line file with `write_to_file` (wipes out edge cases, imports, and comments). | Uses `replace_file_content` targeting only the 5–10 lines containing the defect. |
| **Fixing a CSS / Layout Bug** | Modifies global `index.css` or resets parent container styles (breaks all other pages). | Applies scoped utility classes or isolated component styles directly to the affected element. |
| **Fixing an API Route** | Changes the request/response JSON schema (breaks mobile app, frontend, and tests). | Maintains backward compatibility: keeps existing fields, adds optional new fields with default fallbacks. |
| **Updating Dependencies** | Blindly runs `npm update` or bumps major package versions. | Pinpoints the specific vulnerable package and tests build integrity immediately. |

---

## 3. Fast Incident Recovery Workflow

When a regression is detected:
```
[ Step 1: STOP IMMEDIATELY ] -> Do not generate more edits
              ↓
[ Step 2: REVERT TO BASELINE ] -> git checkout/restore affected file
              ↓
[ Step 3: ISOLATE ROOT CAUSE ] -> Check exact diff that broke the feature
              ↓
[ Step 4: APPLY SURGICAL FIX ] -> Fix ONLY the isolated root cause
              ↓
[ Step 5: VERIFY FULL BUILD ]  -> Full build & regression check passes
```
