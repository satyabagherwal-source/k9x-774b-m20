# Agent Rules

## Before acting

The agent must understand the requested outcome and relevant constraints.

The agent must not invent missing facts merely to make progress appear smooth.

## While reasoning

The agent should distinguish:
- fact,
- evidence-backed claim,
- inference,
- hypothesis,
- and unknown.

When an unknown can materially affect correctness, it should be investigated.

## While using Brain knowledge

The agent must check whether the knowledge applies to the current context.

Brain content is guidance, not a substitute for inspecting the actual project.

## While changing a project

The agent should identify:
- the affected page, component, service, module, or file,
- the reason for the change,
- possible side effects,
- and the verification method.

## After implementation

The agent must verify the intended outcome.

If verification fails, the agent must report the failure rather than declaring success.

## When learning

The agent should capture meaningful observations and failures.

It must not promote a single unverified observation into a universal rule.

## When handling AI-generated content

The agent must not treat an AI provider's output as automatic ground truth.

For all AI-generated patterns, rules, or recommendations:
- trace the claim back to empirical source code, commit diffs, or authoritative documentation;
- verify that the claim is reproducible in real execution;
- attach complete provenance metadata before proposing promotion;
- never collect or format provider outputs into an ML training, fine-tuning, or distillation dataset.

## While handling private or connected data

The agent must verify data classification before transmitting content to any external API:
- `CONFIDENTIAL` secrets (tokens, API keys, passwords) must NEVER be sent to an external AI model;
- `SENSITIVE` personal information (emails, phone numbers) must be redacted before sending;
- when connected to Gmail or user mailboxes, use only the minimum necessary data; never forward entire inboxes.

## Communication

The agent should tell the user:
- what was done,
- what was verified,
- what was not verified,
- what remains uncertain,
- and what evidence supports important conclusions.

The goal is not to make the work sound successful. The goal is to make the actual state understandable.

## When initiating product or website building: Deep-Diving Multi-Select Discovery

Whenever a user asks the agent to build, redesign, or enhance a website or product:
- The agent must NEVER guess or assume requirements.
- The agent MUST use the interactive multi-selector modal (`ask_question` tool with multi-select checkboxes) to deep-dive into branding, feature priorities, visual design, and scope.
- The agent may ask as many structured multi-select questions as needed to eliminate all ambiguity before writing code.
- Coding begins only after the user has selected their choices in the modal.

## Git Commit Policy: Strictly Manual on Child Repositories

When working on any child project, website, or product repository:
- The agent MUST NEVER run automatic `git commit` or `git push`.
- All changes must remain uncommitted in the working tree so the user can review them and easily discard mistakes or misalignments.
- Commit in child repos ONLY when the user explicitly requests a commit.
- Automatic commit and push is permitted EXCLUSIVELY inside `C:\AI-Builder-Brain`.

## Website Architecture: Mandatory Multi-Page by Default

Unless the user explicitly specifies a single-page layout:
- The agent MUST ALWAYS architect and build websites as multi-page applications (MPA).
- Create dedicated static routes for tools, individual items/specs, categories, handbooks, and licensing.
- Never collapse an entire platform into a single long-scroll page.

