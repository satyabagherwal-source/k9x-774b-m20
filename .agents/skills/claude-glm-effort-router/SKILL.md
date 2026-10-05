---
name: claude-glm-effort-router
description: Multi-LLM tiered effort router balancing frontier reasoning models (Claude/Gemini) with fast low-cost models (GLM/Groq/Ollama) to enforce hard cost envelopes and zero-downtime quotas.
---

# Multi-LLM Tiered Effort Router Skill

## Overview
Dispatches agentic tasks across a multi-provider LLM cascade based on task complexity. Ensures trivial tasks (syntax linter, formatting, basic unit tests) do not burn expensive frontier reasoning tokens, while critical tasks (architecture design, security boundary verification) receive maximum reasoning depth.

## Router Tier Hierarchy

| Tier | Task Type | Primary Model | Fallback Model | Token Envelope | Cost Envelope |
|---|---|---|---|---|---|
| **Tier 1 (Micro)** | Linting, AST formatting, docstring gen | Groq Llama-3.3 70B | Local Ollama | 1,024 | $0.00 |
| **Tier 2 (Standard)** | Unit tests, boilerplate, error translation | Gemini 2.0 Flash | Groq Llama-3.3 | 4,096 | $0.00 |
| **Tier 3 (Complex)** | Architectural refactor, subsystem design | Gemini 1.5 Pro | Claude 3.5 Sonnet | 8,192 | $0.00 - $0.03 |
| **Tier 4 (Critical)** | Security audit, invariant proof, concurrency | Claude 3.5 Sonnet | Gemini 1.5 Pro | 16,384 | $0.05 |

## Usage Pattern

```typescript
import { resolveEffortRoute, executeCascadeRequest } from './router';

async function dispatchAgentWork(taskName: string, complexity: 'MICRO' | 'STANDARD' | 'COMPLEX' | 'CRITICAL', prompt: string) {
  const route = resolveEffortRoute(complexity);
  return await executeCascadeRequest(route, prompt);
}
```

## Key Invariants
1. **Zero-Cost Preference**: Always attempt free-tier or locally hosted providers first for Tiers 1 and 2.
2. **Quota Isolation**: If a provider returns HTTP 429 or quota exhaustion, trigger that specific provider's circuit breaker without blocking alternative pool providers.
3. **Audit Trail**: Log model used, tokens consumed, and latency profile for every dispatch.
