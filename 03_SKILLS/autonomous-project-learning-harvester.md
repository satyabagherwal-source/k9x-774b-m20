# Autonomous Project Learning Harvester Skill

> Canonical Reference: `AI-Builder-Brain/03_SKILLS/autonomous-project-learning-harvester.md`  
> Purpose: Equips AI agents with the autonomous ability to perform forensic codebase audits, harvest reusable engineering patterns across 8 dimensions, execute the 5-step pipeline without human micromanagement, and integrate validated knowledge into `AI-Builder-Brain`.

---

## 1. Skill Overview & Invocation Triggers

This skill activates when:
1. **User Trigger (Hindi/English)**:
   - *"is project ki totally har area se reusable learning nikal lo"*
   - *"is project se learning nikal lo"*
   - *"is repo ki learning extract karo"*
   - *"harvest all reusable learnings from this project/repo"*
2. **Bridge / Workspace Event**:
   - A child project connects to `C:\AI-Builder-Brain` via `.project-brain/brain-bridge.json`.
   - The user completes work or builds an active project, triggering silent background harvesting.

---

## 2. Autonomous Execution Directives

When this skill is triggered:
- **Rule 1 (Zero-Prompting Continuity)**: NEVER stop after step 1 to ask "Should I proceed to Step 2?". The agent must run Step 1 → Step 2 → Step 3 → Step 4 → Step 5 seamlessly.
- **Rule 2 (High Token Efficiency)**: Do not dump massive files (>300 lines) into context. Use targeted `grep_search` and 40–80 line slicing with `view_file`.
- **Rule 3 (Empirical Provenance Only)**: Every extracted pattern must cite its origin (git commit hash, PR, code file, line numbers, test assertions).
- **Rule 4 (Universal Generalization)**: Abstract project-specific names (e.g. replace `SQLiteSession` with *thread-affined resource handles*, or `ProtractorCanvas` with *high-precision coordinate transforms*).

---

## 3. Step-by-Step Forensic Execution Blueprint

### Phase 1: Git & Codebase Forensic Discovery
Run non-destructive discovery commands to uncover architectural milestones and bug resolutions:
```powershell
# 1. Inspect recent production fixes in git history
git log -n 50 --grep="fix" --pretty=format:"%h | %ad | %s" --date=short

# 2. Check commit details for complex bug fixes
git show --stat <commit-hash>
git show <commit-hash> -- <path/to/affected/file>
```

### Phase 2: Multi-Dimensional Scanning Matrix
Scan code for critical engineering patterns across the 8 dimensions:
1. **Concurrency & Async State**: Search for `async`, `await`, `lock`, `semaphore`, `mutex`, `re-fetch`.
2. **Resource Lifecycle**: Search for `.close()`, `.destroy()`, `clearInterval`, connection pools, thread handles.
3. **Rollback & Exception Safety**: Search for `rollback`, `transaction`, `try/catch`, `shield`, `budget`.
4. **Boundary Deserialization**: Search for `JSON.parse`, `json.loads`, SQL `LIKE`, sanitization.
5. **Cross-Platform & Hydration**: Search for `\r?\n`, CRLF, `data-label`, `trailingSlash`.
6. **Core Invariants**: Identify mission-critical business logic (math, SEO, ad viewability, layout).

### Phase 3: Differential Brain Comparison
Read and compare against:
- `C:\AI-Builder-Brain\05_KNOWLEDGE\engineering-patterns.md` (Check Rules 1–17+)
- `C:\AI-Builder-Brain\01_CORE\operating-rules.md`
- `C:\AI-Builder-Brain\03_SKILLS\`

Classify each finding as:
- Duplicate (already covered in Brain)
- Net-New Reusable Pattern
- Refinement to an Existing Brain Rule
- Repository-Specific (keep in project learning only)

### Phase 4: Distillation of Reusable Patterns
Format candidate rules into the canonical 3-part schema:
- **RULE**: Imperative mandate.
- **WHY**: Concrete catastrophe or bug prevented.
- **WHEN TO APPLY**: Exact triggering conditions and architectures.

### Phase 5: Direct Master Brain Integration
1. Write/update `C:\AI-Builder-Brain\07_PROJECT_LEARNING/[project-name]-learnings.md`.
2. Append newly verified universal rules to `C:\AI-Builder-Brain\05_KNOWLEDGE\engineering-patterns.md`.
3. If new skills were revealed, create/update `C:\AI-Builder-Brain\03_SKILLS/[skill-name].md`.
4. Record evolution progress in `C:\AI-Builder-Brain\14_EVOLUTION/` and `C:\AI-Builder-Brain\15_METADATA/brain-status.md`.
5. Deliver a clean, structured completion report to the user.

---

## 4. Silent Background Harvesting Mode

When operating in silent mode on a bridged project:
1. Monitor `.project-brain/incidents/` and git commit history during active development.
2. When a verified defect fix or architectural milestone occurs, evaluate it against the 5-step criteria.
3. Silently update the Master Brain (`07_PROJECT_LEARNING/` and `05_KNOWLEDGE/engineering-patterns.md` if universally applicable).
4. No conversational interruption or manual confirmation is required.
