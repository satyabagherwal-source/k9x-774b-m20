> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/scrapecreators-social-media-research-skills-learnings.md`  
> **Source**: github ([https://github.com/ScrapeCreators/social-media-research-skills](https://github.com/ScrapeCreators/social-media-research-skills))  
> **Source Version**: `64ba7b4d`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T10:54:24.471Z  
> **Learning ID**: `learn-github-scrapecreators-social-media-research-skills`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): ScrapeCreators/social-media-research-skills

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
This repository solves the **Context Window Fragmentation** and **Tool Routing Ambiguity** problems inherent in Large Language Model (LLM) agent systems. Specifically, it addresses the inability of generic agents to distinguish between *data retrieval* (scraping APIs) and *data synthesis* (analyzing transcripts, mining comments, identifying outliers). It provides a structured "Skill" layer that maps natural language intent to specific, validated API workflows, ensuring the agent does not hallucinate data or misuse endpoints.

**Architectural Boundaries:**
The system is a **Declarative Knowledge Base** rather than an executable runtime. It consists of:
1.  **The Skill Layer (`skills/*/SKILL.md`)**: The core logic. Each skill is a self-contained Markdown document with YAML frontmatter defining metadata (name, description, version) and a body containing the prompt engineering instructions, API endpoint mappings, and output schemas.
2.  **The Plugin Manifest Layer (`.claude-plugin/`)**: The discovery mechanism. `marketplace.json` and `plugin.json` define the repository identity, versioning, and the directory path to the skills, enabling third-party agents (Claude Code, Cursor, etc.) to discover and load these capabilities.
3.  **The Validation Layer (`scripts/validate-skills.py`)**: The integrity guard. A lightweight Python script that enforces structural invariants on the Skill files (YAML validity, required keys, description length limits) to prevent malformed skills from breaking agent parsers.

**Critical Subsystem Abstractions:**
*   **The "Skill" Primitive**: A unit of capability defined by a strict contract: `name` (unique identifier), `description` (trigger condition, <1024 chars), and `body` (execution logic).
*   **The "Agent Skills Spec"**: An emerging standard (referenced in README) that allows cross-platform portability. The repo is designed to be agnostic to the specific LLM provider, relying on the standard `SKILL.md` format.
*   **The "ScrapeCreators API" Boundary**: The external dependency. The skills do not contain scraping logic; they contain *routing logic* that tells the agent *which* endpoint to call and *how* to interpret the response.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Declarative Skill Contract Integrity
**RULE**:
Any AI agent skill definition file (e.g., `SKILL.md`) MUST contain valid YAML frontmatter delimited by `---` fences, MUST include non-empty `name` and `description` fields, and the `description` field MUST NOT exceed 1024 characters. The body MUST NOT be empty.
**WHY**:
Agent frameworks parse the frontmatter to index skills for retrieval-augmented generation (RAG) or tool selection. Invalid YAML causes silent parsing failures or crashes in the agent's tool-loading loop. Excessively long descriptions bloat the context window, degrading the LLM's ability to select the correct skill. Empty bodies provide no executable instructions, leading to agent hallucination or idle loops.
**WHEN TO APPLY**:
When designing or validating any plugin/skill system for LLM agents, particularly those using Markdown-based configuration files.
**VERIFIED IMPLEMENTATION PATTERN**:
```python
import yaml
import re
from pathlib import Path

def validate_skill_file(path: Path) -> list[str]:
    errors = []
    text = path.read_text(encoding="utf-8")
    
    # 1. Check Frontmatter Fences
    if not text.startswith("---"):
        errors.append(f"{path.name}: missing opening frontmatter fence")
        return errors
        
    # 2. Extract Frontmatter
    m = re.search(r"\n---\s*\n", text[3:])
    if not m:
        errors.append(f"{path.name}: missing closing frontmatter fence")
        return errors
        
    end = m.start() + 3
    raw_yaml = text[3:end]
    
    # 3. Parse YAML
    try:
        fm = yaml.safe_load(raw_yaml)
    except Exception as exc:
        errors.append(f"{path.name}: invalid YAML: {exc}")
        return errors
        
    if not isinstance(fm, dict):
        errors.append(f"{path.name}: frontmatter is not a mapping")
        return errors

    # 4. Validate Required Keys
    for key in ["name", "description"]:
        if not fm.get(key):
            errors.append(f"{path.name}: missing {key}")
            
    # 5. Validate Description Length (Context Budget)
    if len(str(fm.get("description", ""))) > 1024:
        errors.append(f"{path.name}: description is longer than 1024 chars")
        
    # 6. Validate Body
    body = text[text.find("\n---", 3) + 5:].strip()
    if not body:
        errors.append(f"{path.name}: empty body")
        
    return errors
```
**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Skipping YAML validation or allowing unbounded descriptions
# This causes agent context overflow and parsing crashes
def bad_validate(path: Path):
    text = path.read_text()
    # No check for --- fences
    # No check for YAML syntax
    # No check for description length
    return True
```
**VERIFICATION METHOD**:
Run `python3 scripts/validate-skills.py` in CI. The script MUST exit with code 0 and print "Validated N skills". Any non-zero exit code MUST block the merge.

### 2. Repository Metadata Consistency
**RULE**:
The `repository` URL declared in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and all `skills/*/SKILL.md` frontmatter MUST be identical and MUST point to the canonical GitHub repository URL.
**WHY**:
Inconsistent repository URLs break the "install" workflow (`npx skills add <repo>`). If the metadata points to an old or renamed repository, users will fail to install the latest version, leading to version drift and security vulnerabilities (if the old repo is abandoned). It also breaks automated dependency tracking.
**WHEN TO APPLY**:
When renaming a repository, moving it to a new organization, or updating plugin manifests.
**VERIFIED IMPLEMENTATION PATTERN**:
```json
// .claude-plugin/plugin.json
{
  "repository": "https://github.com/ScrapeCreators/social-media-research-skills"
}

// skills/outlier-post-finder/SKILL.md
---
repository: https://github.com/ScrapeCreators/social-media-research-skills
---
```
**NEGATIVE CONSTRAINT**:
```json
// ANTI-PATTERN: Mismatched URLs
// plugin.json: "https://github.com/ScrapeCreators/agent-skills"
// SKILL.md: "https://github.com/ScrapeCreators/social-media-research-skills"
// This causes installation failures and confusion.
```
**VERIFICATION METHOD**:
A CI script that extracts the `repository` field from `plugin.json` and all `SKILL.md` files and asserts they are all equal.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Repository Rename Metadata Drift (BUG-RENAME-01)
- **Context**: Subsystem: Plugin Metadata & Skill Definitions. Files: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`, `skills/*/SKILL.md`.
- **What Was Expected**: After renaming the repository from `agent-skills` to `social-media-research-skills`, all internal references MUST be updated to the new URL to ensure successful installation and version tracking.
- **What Actually Happened**: The repository was renamed, but the metadata files still pointed to the old `agent-skills` URL. This would have caused `npx skills add` to fail or install the wrong/outdated package.
- **Evidence in Repo**: Commit `eb2f71e5` ("fix: point metadata to new repo"). The patch shows a 1-line change in 7 files, all updating the `repository` field.
- **Root Cause**: Manual repository rename on GitHub did not trigger an automated update of the internal metadata files. The developer had to manually find and replace the URL across all files.
- **Remediation Code Diff**:
```diff
- "repository": "https://github.com/ScrapeCreators/agent-skills"
+ "repository": "https://github.com/ScrapeCreators/social-media-research-skills"
```
- **Lesson**: Repository renames are a high-risk operation for plugin systems. A CI check MUST verify that all internal `repository` URLs match the current GitHub repository URL.

### Incident 2: Missing Root License (BUG-LICENSE-02)
- **Context**: Subsystem: Repository Governance. File: `LICENSE`.
- **What Was Expected**: The repository MUST have a root-level license file to be legally distributable and to be accepted by awesome-lists and package managers.
- **What Actually Happened**: Individual skills declared MIT in their frontmatter, but the repository itself had no `LICENSE` file. This created legal ambiguity and prevented automated license detection tools from identifying the repo's license.
- **Evidence in Repo**: Issue #6 ("Add repository-level MIT license"). The issue was closed after adding the `LICENSE` file.
- **Root Cause**: The developer focused on the skill-level metadata but overlooked the repository-level legal requirements.
- **Remediation Code Diff**:
```diff
+ MIT License
+
+ Copyright (c) 2026 ScrapeCreators
+
+ Permission is hereby granted, free of charge, to any person obtaining a copy
+ ...
```
- **Lesson**: Always include a root-level `LICENSE` file in any public repository, even if individual components declare their own licenses.

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **YAML Frontmatter Parsing**: The validator uses `re.search(r"\n---\s*\n", text[3:])` to find the closing fence. This is a **micro-invariant**: the closing fence MUST be on its own line, preceded by a newline. If the YAML ends with `---` without a trailing newline, the regex fails, and the skill is rejected. This prevents partial YAML parsing.
    *   **Description Length Check**: `len(str(fm.get("description", ""))) > 1024`. The use of `str()` ensures that if the description is not a string (e.g., a number or list), it is coerced to a string before length checking. This prevents `TypeError` in the validator.

2.  **Infinite Loop & Recursion Guards**:
    *   **Glob Pattern Safety**: `root.glob("skills/*/SKILL.md")` is a non-recursive glob. It does not descend into subdirectories, preventing infinite loops if a skill directory contains a symlink to the root. The `sorted()` call ensures deterministic ordering, which is critical for reproducible validation errors.

3.  **UI & UX Micro-Mechanics**:
    *   **N/A**: This is a backend/CLI repository. No UI components.

4.  **Backend Concurrency & Memory Safety**:
    *   **N/A**: The validator is a single-threaded script. No concurrency issues.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Null/Undefined Chaining**: The validator uses `fm.get(key)` instead of `fm[key]` to avoid `KeyError` if a required key is missing. It then checks `if not fm.get(key)` to catch both `None` and empty strings.
    *   **YAML Parsing Errors**: The `try...except Exception as exc` block around `yaml.safe_load` ensures that malformed YAML does not crash the validator but is reported as a validation error. This is a **fault boundary** that isolates parsing errors from the main validation loop.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: The repo is a **flat, modular skill library**. Each skill is an independent directory with a single `SKILL.md` file. There is no shared code between skills, ensuring complete decoupling. The plugin manifest acts as the entry point.
2.  **Core Abstractions**: The `SKILL.md` file is the core abstraction. It defines a contract: `name` (ID), `description` (trigger), `body` (logic). The `repository` field links the skill to its source of truth.
3.  **Error Handling**: The validator provides **fail-fast** error handling. It collects all errors and reports them at the end, rather than stopping at the first error. This allows developers to fix multiple issues in one pass.
4.  **Testing**: The `validate-skills.py` script is the primary test. It is a **structural test** that checks the integrity of the skill files. There are no unit tests for the skill logic itself, as the logic is in natural language.
5.  **Security**: The repo uses `SCRAPECREATORS_API_KEY` for authentication. The key is passed via environment variable, not hardcoded. The MIT license ensures legal clarity.
6.  **Performance**: The validator is O(N) where N is the number of skills. It reads each file once and parses the YAML. No caching is needed.
7.  **Deployment**: The repo is deployed via `npx skills add`. The plugin manifest is used by the agent framework to discover and load the skills.
8.  **Agent Patterns**: The skills use a **tool-calling pattern**. The agent reads the skill description, decides if it matches the user's intent, and then executes the instructions in the body. The body contains API endpoint mappings and output schemas.
9.  **Data Flow**: The data flow is: User Prompt -> Agent Intent Matching -> Skill Selection -> API Call (ScrapeCreators) -> Data Parsing -> Output Generation. The skill body defines the parsing and output logic.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: **Declarative Skill Definition**. A Markdown file with YAML frontmatter and a natural language body.
2.  **Rule**: **Skill Contract Integrity**. Every skill MUST have valid YAML, required keys, and a description <1024 chars.
3.  **Architecture Principle**: **Decoupled Skill Modules**. Each skill is independent, with no shared code. This allows for easy addition/removal of skills without affecting others.
4.  **Failure Mode**: **Metadata Drift**. Renaming the repository without updating internal metadata causes installation failures.
5.  **Reusable Skill**: **Skill Validation Script**. A Python script that checks the integrity of all skill files.
6.  **Decision**: **Markdown over JSON/YAML for Skill Logic**. Markdown is more readable for humans and LLMs, while YAML is used for metadata. This hybrid approach balances machine-readability and human-editability.
7.  **Anti-pattern**: **Hardcoded API Keys**. Never hardcode API keys in skill files. Use environment variables.
8.  **Verification Method**: **CI Validation**. Run `validate-skills.py` in CI to ensure all skills are valid before merging.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Create Skill Directory**: `mkdir skills/<skill-name>`
2.  **Create SKILL.md**: Add YAML frontmatter with `name`, `description`, `version`, `author`, `license`, `homepage`, `repository`.
3.  **Write Skill Body**: Describe the skill's purpose, API endpoints, and output schema in natural language.
4.  **Validate Skill**: Run `python3 scripts/validate-skills.py`. Ensure no errors.
5.  **Update Plugin Manifest**: Ensure `.claude-plugin/plugin.json` and `marketplace.json` point to the correct repository URL.
6.  **Add License**: Ensure a root-level `LICENSE` file exists.
7.  **Test Installation**: Run `npx skills add <repo>` to verify the skill is discoverable.
8.  **CI Check**: Ensure the validation script runs in CI and blocks merges on failure.