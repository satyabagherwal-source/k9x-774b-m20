# Decision Rules

## What counts as an important decision

A decision is important when changing it later would materially affect:
- architecture,
- data flow,
- security,
- user behavior,
- maintainability,
- cost,
- reliability,
- or future development.

## Record the context

For an important decision, preserve:
- the decision,
- the context,
- the reason,
- important alternatives considered,
- significant consequences,
- and conditions that could trigger reevaluation.

## Do not silently rewrite history

If a meaningful decision changes, preserve the earlier decision and record the newer decision as superseding it.

This keeps the reasoning history understandable.

## Prefer reversible decisions when appropriate

When two options are similarly suitable and one is easier to reverse safely, prefer the reversible option unless another requirement outweighs that advantage.

## Do not confuse preference with evidence

"AI agent prefers X" or "this feels cleaner" is not enough to establish an engineering decision.

## Verify consequential decisions

The more a decision affects the system, the stronger the verification should be.

For a technical architecture decision, practical evidence may include a prototype, tests, runtime behavior, documentation, or comparison of alternatives.
