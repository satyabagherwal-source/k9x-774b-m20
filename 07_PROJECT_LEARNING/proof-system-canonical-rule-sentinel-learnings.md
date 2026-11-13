> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/proof-system-canonical-rule-sentinel-learnings.md`  
> **Source**: github ([https://github.com/proof-system/canonical-rule-sentinel](https://github.com/proof-system/canonical-rule-sentinel))  
> **Source Version**: `commit-proof`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T14:54:38.467Z  
> **Learning ID**: `learn-github-proof-system-canonical-rule-sentinel`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

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