# How To Use AI-Builder-Brain

## For the human builder

Before starting a project, make the Brain available to the AI agent.

Do not ask the agent to read every file blindly.

Give the agent the task and allow the Brain's map and rules to determine what knowledge is relevant.

During work:
1. Define the actual task.
2. Identify the relevant project context.
3. Retrieve only the knowledge needed for the task.
4. Make important decisions explicit.
5. Implement the smallest appropriate change.
6. Verify the real result.
7. Record meaningful failures, surprises, and successful patterns.
8. Promote a lesson into reusable Brain knowledge only when it survives review.

## For the AI agent

The agent must not treat Brain content as automatically correct.

For every important piece of guidance, determine:
- Is it a principle, rule, skill, workflow, decision, lesson, or project-specific fact?
- What evidence supports it?
- Does it apply to this task?
- Are there limitations or conflicting evidence?

## What not to do

Do not:
- copy random internet articles into the Brain,
- copy entire GitHub repositories into the Brain,
- turn every project-specific detail into a universal rule,
- create rules merely because an AI suggested them,
- claim a feature works because code exists,
- replace evidence with confidence.

## Antigravity first

The initial operating environment is Antigravity IDE.

This is a tooling choice, not a permanent architectural dependency. If another tool is introduced later, the Brain's core knowledge and operating principles should remain portable.
