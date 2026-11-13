# Agent Contract: Agent Contract: proof-system/canonical-rule-sentinel Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "proof-system/canonical-rule-sentinel",
  "source_url": "https://github.com/proof-system/canonical-rule-sentinel",
  "source_version": "commit-proof-1234",
  "license": "MIT",
  "timestamp": "2026-11-13T14:54:41.276Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-proof-system-canonical-rule-sentinel",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [proof-system/canonical-rule-sentinel](https://github.com/proof-system/canonical-rule-sentinel) (Revision: `commit-pro`).  
> **License**: MIT | **Timestamp**: `2026-11-13T14:54:41.276Z`  
> **Learning ID**: `learn-github-proof-system-canonical-rule-sentinel`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `proof-system-canonical-rule-sentinel-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
# Dossier

## 6. Net-New Universal Engineering Rules

### Single-Point-of-Truth Rule Invariant

**RULE**:
Every harvested intelligence invariant extracted from software repositories MUST be automatically appended to 05_KNOWLEDGE/engineering-patterns.md without diversion.

**WHY**:
Diverting rules away from engineering-patterns.md starves the primary knowledge base and causes retrieval engines to fail when seeking verified engineering patterns.

**WHEN TO APPLY**:
Apply to all automated harvesting, classification, and distribution gateways across the AI-Builder-Brain fleet.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function persistEngineeringRule(rule: EngineeringRule, patternsPath: string): void {
  fs.appendFileSync(patternsPath, formatRule(rule), 'utf-8');
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// BAD: Diverting rules into staging inbox or secondary folders only
if (rule.topic === 'feedback') {
  stageInInboxOnly(rule);
}
```

**VERIFICATION METHOD**:
Automated read-back verification asserting rule number and title existence in engineering-patterns.md.

## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
