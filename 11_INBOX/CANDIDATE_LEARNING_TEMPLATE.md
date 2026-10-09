# Candidate Directive / Learning Specification Template

```yaml
id: "CD-XXX"
directive_title: "Clear, Actionable Principle Title"
source_type: "github_commit | closed_bug_issue | chat_master_prompt | rfc"
source_repo: "owner/repo"
source_commit: "40-character-sha"
date_staged: "YYYY-MM-DD"
trigger_tags: ["tag1", "tag2", "tag3"]
status: "STAGED_FOR_VERIFICATION" # Options: STAGED_FOR_VERIFICATION | VERIFIED | REJECTED | UNCERTAIN
```

---

## 1. Context & Discovered Phenomenon
*Detailed description of the bug, bottleneck, or architecture pattern observed in the source repository.*

---

## 2. Forensic Code Evidence
*Exact code snippet, commit diff, or line ranges where the invariant is proven.*

```diff
- // Vulnerable or flawed implementation
+ // Verified, safe architectural invariant
```

---

## 3. Universal Reusability Hypothesis
*Why is this pattern applicable across multiple projects, and not just a quirk of this specific repo?*

---

## 4. Proposed Routing Destination
*Where should this be promoted once verified?*
- Target File: `05_KNOWLEDGE/engineering-patterns.md` (Rule Candidate)
- Or: `07_PROJECT_LEARNING/[repo]-learnings.md` (Project Specific)
- Or: `03_SKILLS/[technology].md` (Skill Manual)

---

## 5. Verification Gate Criteria
- [ ] Reproducible with empirical test or commit diff
- [ ] Anti-pattern and negative constraints formulated
- [ ] Zero duplicate conflict with Rules 1-258+
- [ ] SHA-256 readback validation ready
