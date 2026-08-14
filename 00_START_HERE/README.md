# AI-Builder-Brain

## Purpose

AI-Builder-Brain is a portable knowledge, reasoning, decision, workflow, verification, and learning system for AI-assisted product building.

It is not a dump of articles, prompts, code, or copied repositories.

Its purpose is to help an AI agent and the human builder:
- understand the current task and project,
- retrieve relevant knowledge,
- make explicit and reviewable decisions,
- execute work,
- verify the actual result,
- learn from real outcomes,
- and improve the Brain over time.

## Current status

This is the initial foundation version. It intentionally contains only the verified core operating model. Project-specific knowledge, skills, workflows, sources, and lessons are added only when they have a clear purpose and have been reviewed.

## Core lifecycle

Source or real experience
→ understand
→ extract
→ classify
→ verify
→ store
→ retrieve when relevant
→ apply
→ observe the real result
→ learn
→ verify the learning
→ update or reject the knowledge.

A source is not automatically knowledge.
A project-specific observation is not automatically a reusable rule.
A rule is not trusted merely because an AI generated it.

## Context principle

The Brain should provide the agent with relevant, high-signal context rather than indiscriminately loading everything. The agent should retrieve what is needed for the current task.

## Decision principle

Important decisions should preserve their context, rationale, and consequences. When a decision changes, the old decision should remain understandable rather than silently disappearing.

## Verification principle

The system must distinguish between:
- what a source says,
- what we infer,
- what we have actually tested,
- and what remains uncertain.

## Initial verified sources

1. Anthropic, "Effective context engineering for AI agents"
   https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

2. Martin Fowler, "Architecture Decision Record"
   https://martinfowler.com/bliki/ArchitectureDecisionRecord.html

3. Anthropic, "Demystifying evals for AI agents"
   https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents

These sources were used to verify the initial operating model. They are evidence for the foundation, not content to blindly copy into the Brain.

## Important boundary

This Brain is not the project itself.

Project code belongs to the project repository.
Project-specific decisions and lessons belong in the project context/learning system.
Reusable knowledge belongs in the appropriate Brain area only after review.
