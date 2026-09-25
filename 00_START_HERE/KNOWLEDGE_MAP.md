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

- **Project Bootstrap Master Prompt**: [10_PROMPTS/project-bootstrap-master-prompt.md](file:///C:/AI-Builder-Brain/10_PROMPTS/project-bootstrap-master-prompt.md) — The single canonical prompt to paste into any new empty project folder.
- **Native Project Factory Engine**: [04_WORKFLOWS/project-factory-workflow.md](file:///C:/AI-Builder-Brain/04_WORKFLOWS/project-factory-workflow.md) and [04_WORKFLOWS/factory-engine/bootstrap.mjs](file:///C:/AI-Builder-Brain/04_WORKFLOWS/factory-engine/bootstrap.mjs) — Complete autonomous scaffolding and bootstrap engine.
- **Golden Project Blueprints**: [04_WORKFLOWS/blueprints/astro-tailwind-v4/](file:///C:/AI-Builder-Brain/04_WORKFLOWS/blueprints/astro-tailwind-v4/) — Production templates for Astro 5, Tailwind v4, Vercel, and design systems.
- **Agent Intelligence & Boot Sequence**: [02_AGENT_INTELLIGENCE/project-agent-boot-protocol.md](file:///C:/AI-Builder-Brain/02_AGENT_INTELLIGENCE/project-agent-boot-protocol.md) and [02_AGENT_INTELLIGENCE/agent-execution-governance.md](file:///C:/AI-Builder-Brain/02_AGENT_INTELLIGENCE/agent-execution-governance.md).
- **Core Technology Skills**: [03_SKILLS/astro-architecture-and-seo.md](file:///C:/AI-Builder-Brain/03_SKILLS/astro-architecture-and-seo.md), [03_SKILLS/tailwind-v4-css-first-design.md](file:///C:/AI-Builder-Brain/03_SKILLS/tailwind-v4-css-first-design.md), [03_SKILLS/vercel-deployment-playbook.md](file:///C:/AI-Builder-Brain/03_SKILLS/vercel-deployment-playbook.md), [03_SKILLS/git-github-lifecycle-skill.md](file:///C:/AI-Builder-Brain/03_SKILLS/git-github-lifecycle-skill.md).
- **Portable Engineering Patterns**: [05_KNOWLEDGE/engineering-patterns.md](file:///C:/AI-Builder-Brain/05_KNOWLEDGE/engineering-patterns.md) — 14+ validated engineering rules.
- **Verification & Certification**: [08_VERIFICATION/project-ready-certification-protocol.md](file:///C:/AI-Builder-Brain/08_VERIFICATION/project-ready-certification-protocol.md) and [08_VERIFICATION/regression-verification-protocol.md](file:///C:/AI-Builder-Brain/08_VERIFICATION/regression-verification-protocol.md).
- **Brain Bridge & Bug Correction Governance**: [13_GOVERNANCE/brain-bridge-protocol.md](file:///C:/AI-Builder-Brain/13_GOVERNANCE/brain-bridge-protocol.md) and [13_GOVERNANCE/bug-correction-lifecycle-protocol.md](file:///C:/AI-Builder-Brain/13_GOVERNANCE/bug-correction-lifecycle-protocol.md).
- **Architectural Decisions**: [12_DECISIONS/ADR-001-native-project-factory-brain-integration.md](file:///C:/AI-Builder-Brain/12_DECISIONS/ADR-001-native-project-factory-brain-integration.md).
- **Project Learning & Provenance**: [07_PROJECT_LEARNING/](file:///C:/AI-Builder-Brain/07_PROJECT_LEARNING/).

