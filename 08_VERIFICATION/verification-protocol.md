# Verification Protocol

Verification is the gate between a claim and trusted reusable knowledge.

## Verification asks

For every important candidate learning:

- What exactly are we claiming?
- What evidence supports it?
- Is the evidence direct or indirect?
- Can the observation be reproduced?
- Does the evidence support the general statement or only the specific project case?
- What alternative explanations remain?
- What is still unknown?

## Evidence hierarchy

Use the strongest practical evidence available for the claim.

Typical evidence includes:
- actual runtime behavior,
- reproducible tests,
- source-code inspection,
- authoritative documentation,
- controlled experiments,
- logs/traces,
- independent confirmation.

The appropriate evidence depends on the claim.

## Verification result

A candidate learning must end in one of these states:

### VERIFIED
Evidence is sufficient for the stated scope.

### PARTIALLY_VERIFIED
Some part is supported, but important limitations or uncertainty remain.

### REJECTED
The evidence does not support the candidate claim.

### PROJECT_ONLY
The observation is valid for the project but should not be promoted to general Brain knowledge.

### NEEDS_MORE_EVIDENCE
The question is important, but current evidence is insufficient.

## Important rule

Verification does not mean proving an idea absolutely true. It means establishing what the available evidence justifies saying, with the correct scope and uncertainty.
