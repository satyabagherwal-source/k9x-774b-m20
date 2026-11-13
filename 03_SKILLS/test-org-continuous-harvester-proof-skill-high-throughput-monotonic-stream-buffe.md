# Skill: High-Throughput Monotonic Stream Buffer Management

<!-- PROVENANCE_START
{
  "source_repository": "test-org/continuous-harvester-proof",
  "source_url": "https://github.com/test-org/continuous-harvester-proof",
  "source_version": "HEAD",
  "license": "MIT",
  "timestamp": "2026-11-13T12:53:49.836Z",
  "ai_provider": "gemini-2.5-pro",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-TEST-LIVE-1794574429836",
  "canonical_classification": "skill_playbook"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [test-org/continuous-harvester-proof](https://github.com/test-org/continuous-harvester-proof) (Revision: `HEAD`).  
> **License**: MIT | **Timestamp**: `2026-11-13T12:53:49.836Z`  
> **Learning ID**: `LEARN-TEST-LIVE-1794574429836`


## 1. Skill Overview & Purpose
Procedural playbook defining verified operational and implementation patterns for **test-org/continuous-harvester-proof**.
- **Canonical Domain**: Domain D (Research & Knowledge Intelligence)
- **Model Independence**: Universal (Applies across Claude, Gemini, GPT, and Local agents)

## 2. Prerequisites & Technical Boundary
- Runtime ecosystem: Verified against test-org/continuous-harvester-proof revision `HEAD`.
- Required security tier: Sanitized against PII/secrets.

## 3. Step-by-Step Procedural Workflow
# Skill: High-Throughput Monotonic Stream Buffer Management

## Purpose
Guidance on configuring ring buffers with zero-copy stream deserialization.

## Step-by-Step Procedure
1. Allocate circular array with power-of-two size.
2. Apply bitwise masking on index increment.
3. Assert monotonic sequence ordering before commit.

## 4. Empirical Verification & Quality Gate
```bash
node scripts/verify-execution.mjs --target "test-org-continuous-harvester-proof"
```
