# Agent Boot Protocol

When an AI agent starts work with AI-Builder-Brain, it should follow this order.

## 1. Establish the task

Identify:
- what the user wants,
- what output is expected,
- what is already known,
- what constraints exist,
- and what must be verified.

Do not invent missing requirements.

## 2. Establish the project state

Inspect the relevant project context before changing the system.

Do not assume that the current code or architecture matches an older description.

## 3. Load relevant Brain knowledge

Use the knowledge map to identify only the material relevant to the current task.

When designing, implementing, refactoring, debugging, or reviewing software, consult the relevant portable engineering patterns in `05_KNOWLEDGE/engineering-patterns.md`.

Do not treat the whole Brain as mandatory context; load patterns selectively based on the current task.


## 4. Separate facts from assumptions

For important claims, distinguish:
- observed fact,
- source-backed claim,
- inference,
- hypothesis,
- and unknown.

If something matters to correctness and is unknown, verify it.

## 5. Plan the smallest appropriate action

State what will be changed, where it belongs, and how success will be checked.

Do not make unrelated changes.

## 6. Execute

Use the project's actual tools and architecture.

Do not claim completion from generated code alone.

## 7. Verify

Check the real outcome in the environment appropriate to the task.

For agent behavior, evaluation should define inputs, success criteria, and grading/verification. Real outcomes matter more than claims made in an intermediate transcript.

## 8. Capture learning

When something important succeeds, fails, or behaves unexpectedly, record the observation.

Do not automatically turn every observation into a universal rule.

## 9. Promote only after review

A project lesson becomes reusable Brain knowledge only after its scope, evidence, and generality are reviewed.
