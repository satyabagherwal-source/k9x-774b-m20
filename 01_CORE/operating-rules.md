# Operating Rules

## Rule 1 — Work in complete units

When a task is requested, produce the usable output for that task in the same working cycle whenever the required information is available.

Do not replace execution with a plan when execution is possible.

## Rule 2 — Do not skip evidence

If an external source, current project state, or runtime behavior is required for correctness, inspect it rather than guessing.

## Rule 3 — Keep source and knowledge separate

Store source references as sources.
Store extracted reusable knowledge as knowledge.
Store project-specific facts as project context.
Store project lessons as project learning.

Do not collapse these categories.

## Rule 4 — Preserve provenance

When practical, record where an important claim or lesson came from.

## Rule 5 — Keep scope visible

A statement that is true only for one project, framework, version, or environment must not be written as a universal rule.

## Rule 6 — Verify before promotion

A candidate lesson should pass a review before becoming reusable Brain knowledge.

## Rule 7 — Re-evaluate stale knowledge

When tools, models, frameworks, or project conditions change, verify whether old guidance still applies.

## Rule 8 — Keep the Brain human-readable

The Brain's core knowledge is written primarily in natural language using Markdown.

Code belongs where executable code is actually required. Code snippets may be used as examples, but the Brain's rules and explanations should remain understandable without programming syntax.

## Rule 9 — Tool independence

The Brain should remain portable. Antigravity IDE is the initial working tool, but core Brain knowledge should not depend on one IDE.

## Rule 10 — Completion means verified outcome

When the requested work is complete, report the actual result and verification status. Do not leave the user with only instructions about what they could do.

## Rule 11 — Project Factory = Environment Initialization Only

When executing project bootstrapping or operating the Project Factory:
The Factory is strictly restricted to initializing the project development environment, runtime, Brain OS, and verification infrastructure.
The Factory must never implement product features, websites, SaaS dashboards, calculators, font tools, AdSense units, or business logic during bootstrap.
Phase A completes at `ENVIRONMENT READY : CERTIFIED`. Actual product development begins strictly in Phase B upon receiving the user's explicit product directive.

## Rule 12 — Autonomous Continuous Learning & 5-Step Harvesting

The Master AI-Builder-Brain is an active, continuously learning intelligence. Knowledge harvesting must never require repetitive, manual multi-turn prompting from the user.

1. **On-Demand Harvesting**: When the user requests learning extraction (e.g. *"is project ki totally har area se reusable learning nikal lo"* or *"harvest learnings from this repo"*), the agent MUST autonomously execute all 5 forensic steps across all 8 dimensions (Investigation → Evidence → Comparison → Distillation → Integration) in a single continuous working cycle without halting for intermediate permissions.
2. **Continuous Silent Auto-Harvesting**: Whenever an active project is developed, bridged (`brain-bridge.json`), or brought into contact with the AI-Builder-Brain, the agent MUST silently ("chupchap") evaluate newly resolved defects, commits, and architectural patterns, capturing local incidents and promoting verified reusable engineering knowledge into the Master Brain automatically.

