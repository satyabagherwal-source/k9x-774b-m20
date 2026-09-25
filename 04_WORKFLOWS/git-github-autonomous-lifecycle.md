# Git & GitHub Autonomous Lifecycle Workflow

> Canonical reference: `AI-Builder-Brain/04_WORKFLOWS/git-github-autonomous-lifecycle.md`  
> Purpose: Detailed operational workflow for initializing local git repositories, managing conventional commits, and safely automating GitHub remote repositories during project bootstrap.

---

## 1. Local Initialization Phase

1. **Verify No Git Parent Pollution**:
   - Check if current directory is already inside a Git repository (`git rev-parse --is-inside-work-tree`).
   - If in empty folder, execute `git init -b main`.
2. **Apply Canonical `.gitignore`**:
   - Write standard `.gitignore` ensuring `node_modules/`, `dist/`, `.env`, and temporary files are excluded.
3. **Stage All Scaffolding Files**:
   - `git add .`
4. **Create Canonical Initial Commit**:
   - `git commit -m "feat: initial bootstrap from canonical AI-Builder-Brain"`

---

## 2. GitHub Remote Automation Phase

1. **Detect GitHub CLI**:
   - Run `gh --version`. If absent, flag GitHub integration as `SKIPPED_NO_CLI`.
2. **Detect GitHub Auth State**:
   - Run `gh auth status`.
   - If not authenticated, record status as `LOCAL_ONLY_AUTH_REQUIRED` and do not block local development.
3. **Create Remote Repository (When Authorized)**:
   - Command:
     ```bash
     gh repo create <project-name> --source=. --remote=origin --private --push
     ```
4. **Verify Remote Connection**:
   - Command: `git remote -v`
   - Command: `git branch -a`

---

## 3. Strict Boundary Rules

- **Master Brain Separation**: Child project git repositories must NEVER share git history, remotes, or commit trees with `C:\AI-Builder-Brain`.
- **Zero-Accidental Writes**: The automation engine must never run git push to `AI-Builder-Brain` from a child project context.
