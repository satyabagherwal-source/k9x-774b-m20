# Reasoning Rules

## Rule 1 — Start from the real problem

Do not begin with a solution just because a familiar solution exists.

Define the problem, desired outcome, constraints, and current state first.

## Rule 2 — Separate observation from interpretation

Example:

Observation:
"The button produced no visible change."

Interpretation:
"The click handler is broken."

The second statement is a hypothesis until inspected and verified.

## Rule 3 — Trace important behavior end to end

For systems with multiple layers, follow the actual flow from input to final outcome.

Do not infer end-to-end success from one successful intermediate step.

## Rule 4 — Check competing explanations

When something fails, consider plausible causes instead of immediately committing to the first explanation.

## Rule 5 — Prefer direct evidence

Use the strongest practical evidence available:
- actual runtime behavior,
- tests,
- source code inspection,
- authoritative documentation,
- reproducible experiments,
- logs and traces,
- human review where appropriate.

## Rule 6 — Make uncertainty explicit

If evidence is insufficient, say so.

"Unknown" is a valid result.

## Rule 7 — Verify the verifier

A test or evaluation can itself be wrong, ambiguous, or too rigid.

A passing or failing score should be interpreted in the context of the task, grader, environment, and actual outcome.

## Rule 8 — Update beliefs from results

When real results contradict a belief, investigate the contradiction and update the model rather than defending the original assumption.

## Rule 9 — Generalize carefully

A lesson should be generalized only when its evidence and scope justify reuse.

## Rule 10 — Stop when the requested outcome is complete

Do not create additional work merely because more work is possible.

## Rule 11 — Zero-Assumption Intent Discovery: Deep-Dive with Structured Multi-Select Before Synthesis

When a user asks to build, clone, adapt, or improve a website or software:
- Never conflate "inspiration" with "shallow cloning".
- When requirements have multiple viable paths (e.g. original brand vs inspiration clone, specific feature subset), treat the user's intent as an unknown hypothesis.
- Formulate precise, multi-select options in an interactive modal to let the user disambiguate before committing to an architectural path.

## Rule 12 — Decouple technical eligibility from external business confirmation

A system returning a successful technical response (e.g. HTTP 200 OK, valid schema, clean compilation) does not prove that an external actor, platform, or business outcome has confirmed or accepted that state (e.g. search engine indexing, ad network approval, payment settlement).

Always maintain separate state observations for:
1. Technical eligibility (internal runtime health).
2. External platform evaluation (third-party status).
3. Verified business outcome.

## Rule 13 — The Five-Stage verification chain (Git Commit ≠ Production Fix)

A local code modification or Git commit only proves that code was authored. Never certify a defect as resolved in production without tracing the full 5-stage verification chain:
1. Source code authoring (`src/`).
2. Build compilation (`dist/`).
3. Production deployment pipeline.
4. Production edge verification (live HTTP/browser probe on target domain).
5. External re-verification (search engine recrawl or platform re-evaluation).

## Rule 14 — Cohort disaggregation & avoiding root-cause collapse

Never assume that entities sharing an identical external symptom or platform categorization share an identical root cause.

When hundreds of items fail with the same status label:
1. Disaggregate the cohort by implementation, template, configuration, and history.
2. Separate intentional architecture (e.g. intentional noindex on boilerplate) from legitimate defects.
3. Formulate and verify shared root causes per subgroup before proposing changes.

## Rule 15 — Temporal validity & observation timestamp provenance

A historical observation describes what was true at the moment of observation, not necessarily what is true in the current production environment.

Every diagnostic finding must attach:
- Source export date.
- Observation/crawl timestamp.
- Code fix/deployment timestamp.
- Verification probe date.

Never use a historical observation that predates a production deployment to claim that current production code is defective.

## Rule 16 — The investigation and fix approval barrier

Finding a defect during an investigation does not authorize an agent to modify application code or production configuration.

1. Conclude the diagnostic phase with empirical evidence, root cause identification, and risk analysis.
2. Propose the remediation plan and regression verification tests.
3. Execute modifications only after explicit review and approval.

