# Knowledge Map

## The basic distinction

The Brain contains different kinds of information. They must not be mixed merely because they are all written in Markdown.

### Principle
A fundamental statement that guides many decisions.

Example:
"Verify actual behavior rather than inferring success from implementation."

### Rule
A concrete instruction that should normally be followed.

Example:
"Before declaring a feature complete, verify its expected behavior in the real running environment."

### Skill
A capability that an agent or builder can perform.

Example:
"Trace an event through the complete runtime flow."

### Workflow
A repeatable sequence for accomplishing a class of tasks.

Example:
"Investigate a production bug from symptom → reproduction → evidence → root cause → fix → regression verification."

### Decision
A deliberate choice made in a specific context.

A meaningful decision should preserve its context, rationale, and consequences.

### Pattern
A reusable solution structure observed across more than one situation, or supported strongly enough to justify reuse.

### Lesson
A conclusion extracted from an actual outcome, especially a failure or surprising result.

A lesson becomes reusable knowledge only after review.

### Evidence / Source
Material that supports a claim. A source is not itself a rule.

### Project Context
Facts that are true for one project and should not automatically become general Brain knowledge.

### Project Learning
Lessons discovered while building a specific project. Some may later be promoted into reusable Brain knowledge.

## Promotion rule

Information should move toward reusable Brain knowledge only when:
- it is understood,
- its scope is clear,
- evidence is available,
- it is useful beyond one isolated situation,
- and it has been reviewed.

If these conditions are not met, keep it as a source, observation, uncertainty, or project-specific learning instead of promoting it.

## Knowledge Destinations

- **Portable Engineering Patterns**: [05_KNOWLEDGE/engineering-patterns.md](file:///C:/AI-Builder-Brain/05_KNOWLEDGE/engineering-patterns.md) — Generalized, framework-agnostic rules for async execution, resource lifecycles, and software boundaries.
- **Project Learning & Provenance**: [07_PROJECT_LEARNING/website-change-monitor-learnings.md](file:///C:/AI-Builder-Brain/07_PROJECT_LEARNING/website-change-monitor-learnings.md) — Empirical evidence, incident reports, and audit logs from project evaluations.

