# Git & GitHub Autonomous Lifecycle Skill

> Canonical reference: `AI-Builder-Brain/03_SKILLS/git-github-lifecycle-skill.md`  
> Purpose: Governs autonomous git repository initialization, branch management, atomic commits, GitHub CLI remote setup, and push verification for newly bootstrapped child projects.

---

## 1. Local Git Initialization Standard

Every new project created by the native factory must have its own independent Git repository:

```bash
git init -b main
```

### Mandatory `.gitignore`:
Must prevent polluting repository with build artifacts, logs, or local environment files:
```gitignore
# Dependencies
node_modules/

# Production output
dist/

# Environment files
.env
.env.*
!.env.example

# OS and Editor artifacts
.DS_Store
Thumbs.db
.vscode/*
!.vscode/settings.json
.idea/

# Local cache & logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.astro/

# Staging
.project-brain/scratch/
```

---

## 2. Commit Message Conventions

Follow Conventional Commits:
- `feat: initial bootstrap from canonical AI-Builder-Brain`
- `feat(ui): add hero section and glassmorphic cards`
- `fix(seo): enforce trailing slash on canonical tags`
- `refactor(styles): migrate tokens to OKLCH in @theme`

---

## 3. GitHub Remote Setup & Authorization Gating

1. **Check CLI Authentication**:
   ```bash
   gh auth status
   ```
2. **If Authorized**:
   - Create private/public GitHub repository:
     ```bash
     gh repo create <project-name> --source=. --remote=origin --private --push
     ```
   - Verify remote link:
     ```bash
     git remote -v
     git branch -vv
     ```
3. **If Authorization Pending / Denied**:
   - Keep local git repository fully initialized with clean commit history.
   - Do NOT fail the bootstrap; record status in `PROJECT_STATE.json` as `GITHUB_REMOTE_PENDING` and inform builder.
