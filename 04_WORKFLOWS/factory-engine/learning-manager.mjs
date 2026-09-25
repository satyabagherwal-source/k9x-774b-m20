import fs from 'fs';
import path from 'path';

export const VERIFICATION_GATES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'REJECTED',
  'PROJECT_ONLY',
  'NEEDS_MORE_EVIDENCE'
];

export function captureIncident(projectDir, incidentData) {
  const root = path.resolve(projectDir);
  const incidentsDir = path.join(root, '.project-brain', 'incidents');
  fs.mkdirSync(incidentsDir, { recursive: true });

  const count = fs.readdirSync(incidentsDir).filter(f => f.startsWith('INC-')).length + 1;
  const num = String(count).padStart(3, '0');
  const slug = (incidentData.title || 'incident').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30);
  const filename = `INC-${num}-${slug}.md`;
  const filePath = path.join(incidentsDir, filename);

  const content = `# Incident Record: ${incidentData.title || 'Untitled Incident'}

- **Incident ID**: INC-${num}
- **Timestamp**: ${new Date().toISOString()}
- **Environment**: Node ${process.version} | OS: ${process.platform}
- **Status**: ${incidentData.status || 'RESOLVED_WITH_EVIDENCE'}
- **Verification Gate**: ${incidentData.gate || 'PROJECT_ONLY'}

---

## 1. Context & Expected Behavior
${incidentData.expected || 'What was expected to happen.'}

## 2. Actual Behavior & Observed Symptoms
${incidentData.actual || 'What actually happened, including exact error messages and logs.'}

## 3. Empirical Evidence
\`\`\`
${incidentData.evidence || 'Command output, logs, or reproduction steps.'}
\`\`\`

## 4. Root Cause Analysis
${incidentData.rootCause || 'Underlying defect mechanism (e.g. hydration mismatch, CRLF line ending issue, CSS cascade conflict).'}

## 5. Non-Destructive Invariant Fix
${incidentData.fix || 'Exact changes made, ensuring no existing calculation math or responsive layouts were harmed.'}

## 6. Verification Outcome
${incidentData.verificationOutcome || 'Verified via live build and runtime test.'}

## 7. Reusability Assessment
- **Is this potentially reusable across other projects?**: ${incidentData.isReusable ? 'YES' : 'NO'}
- **Proposed Candidate Rule**: ${incidentData.candidateRule || 'N/A'}
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  return { filename, filePath, num };
}

export function preparePromotionProposal(projectDir, candidateData) {
  const root = path.resolve(projectDir);
  const queueDir = path.join(root, '.project-brain', 'promotion-queue');
  fs.mkdirSync(queueDir, { recursive: true });

  const count = fs.readdirSync(queueDir).filter(f => f.startsWith('PROPOSAL-')).length + 1;
  const num = String(count).padStart(3, '0');
  const slug = (candidateData.topic || 'learning').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30);
  const filename = `PROPOSAL-${num}-${slug}.md`;
  const filePath = path.join(queueDir, filename);

  // Formatted strictly according to AI-Builder-Brain/14_EVOLUTION/brain-evolution-protocol.md
  const content = `# Candidate Learning Promotion Proposal

- **Proposal ID**: PROPOSAL-${num}
- **Origin Project**: ${path.basename(root)}
- **Date**: ${new Date().toISOString()}
- **Target Master Brain Destination**: ${candidateData.targetDestination || '05_KNOWLEDGE/engineering-patterns.md'}
- **Verification State**: ${candidateData.verificationState || 'VERIFIED'}
- **Human Review Required**: YES (Per Brain Evolution Protocol: No silent auto-commits)

---

## 1. Candidate Pattern / Rule Name
**${candidateData.ruleName || 'Proposed Pattern Name'}**

## 2. Rule Statement
${candidateData.ruleStatement || 'Exact formulation of the rule.'}

## 3. Why It Matters (Defect Prevention)
${candidateData.why || 'Prevents specific recurring failure modes.'}

## 4. When To Apply
${candidateData.whenToApply || 'Specific architectural, framework, or operational boundary.'}

## 5. Empirical Evidence & Provenance
- **Originating Incident**: ${candidateData.originIncident || 'INC-001'}
- **Reproducible Evidence**:
\`\`\`
${candidateData.evidence || 'Verified log lines or test results'}
\`\`\`

## 6. Boundary Conditions & Limitations
${candidateData.limitations || 'Conditions where this rule does not apply or could produce side effects.'}

---

## 7. Promotion Checklist for Human Builder
- [ ] Observation is thoroughly understood and reproducible.
- [ ] Evidence supports the generalized claim, not merely an isolated project quirk.
- [ ] Formulated in clear, human-readable markdown without unnecessary programming syntax.
- [ ] No conflict with existing Master Brain rules in 01_CORE or 05_KNOWLEDGE.
- [ ] Approved for Master Brain merge.
`;

  fs.writeFileSync(filePath, content, 'utf-8');
  return { filename, filePath, num };
}
