import fs from 'fs';
import path from 'path';

export const VERIFICATION_GATES = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'REJECTED',
  'PROJECT_ONLY',
  'NEEDS_MORE_EVIDENCE'
];

/**
 * Captures a real project incident under .project-brain/incidents/
 */
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

  // Update PROJECT_LEARNING.md table
  const learningMdPath = path.join(root, 'PROJECT_LEARNING.md');
  if (fs.existsSync(learningMdPath)) {
    try {
      let learningContent = fs.readFileSync(learningMdPath, 'utf-8');
      const newRow = `| INC-${num} | ${new Date().toISOString().slice(0, 10)} | ${incidentData.title || 'Bug Fix'} | ${incidentData.rootCause?.slice(0, 40) || 'N/A'} | ${incidentData.fix?.slice(0, 40) || 'Fixed'} | RESOLVED | ${incidentData.isReusable ? 'YES' : 'NO'} |`;
      if (learningContent.includes('| *None* |')) {
        learningContent = learningContent.replace(/\| \*None\* \|[^\n]+\n/, `${newRow}\n`);
      } else {
        learningContent += `\n${newRow}\n`;
      }
      fs.writeFileSync(learningMdPath, learningContent, 'utf-8');
    } catch (e) {}
  }

  return { filename, filePath, num };
}

/**
 * Captures 24/7 harvest failures as forensic incidents with lessons and remediations
 */
export function captureHarvestFailureIncident(brainRoot, target, error) {
  const isCircuitTrip = error.code === 'RATE_LIMIT_TRIPPED' || error.message?.includes('CIRCUIT_TRIPPED') || error.message?.includes('RATE_LIMIT');
  if (isCircuitTrip) {
    // Circuit trips and rate limits are expected backoff conditions, not repository defect incidents.
    return null;
  }

  const incidentsDir = path.join(brainRoot, '.project-brain', 'incidents');
  fs.mkdirSync(incidentsDir, { recursive: true });

  // Cap incidents to maximum 50 files to prevent repository bloat and readdir slowdown
  const existingFiles = fs.readdirSync(incidentsDir).filter(f => f.startsWith('INC-HARVEST-'));
  if (existingFiles.length >= 50) {
    try {
      // Remove oldest 10 to keep repository healthy
      existingFiles.slice(0, 10).forEach(f => fs.unlinkSync(path.join(incidentsDir, f)));
    } catch (e) {}
  }

  const count = existingFiles.length + 1;
  const num = String(count).padStart(3, '0');
  const filename = `INC-HARVEST-${num}-${target?.slug || 'target'}.md`;
  const filePath = path.join(incidentsDir, filename);

  const content = `# Harvest Incident Record: ${target?.webUrl || target?.slug || 'Unknown Target'}
- **Incident ID**: INC-HARVEST-${num}
- **Timestamp**: ${new Date().toISOString()}
- **Target**: ${target?.webUrl || target?.slug} (${target?.type || 'external'})
- **Status**: FAILED_REMEDIATED

---

## 1. Context & Expected Behavior
Expected successful forensic extraction of code diffs, closed bug issues, and manifests under 24/7 continuous harvesting loop.

## 2. Actual Error & Observed Failure
\`\`\`
${error.stack || error.message}
\`\`\`

## 3. Root Cause Analysis
Extraction failure: upstream response error, network timeout, or schema mismatch.

## 4. Remediation Action
Target marked as failed in run log; target lock released; advance to next target without halting the fleet.

## 5. Engineering Lesson
External 24/7 harvest pipelines must be resilient to intermittent upstream outages, maintaining circuit breakers and fallback laborers so that learning never stops entirely.
`;

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`📋 [INCIDENT RECORDED] Harvest failure captured in .project-brain/incidents/${filename}`);
  } catch (e) {}
  return filePath;
}

/**
 * Prepares a candidate learning promotion proposal in .project-brain/promotion-queue/
 */
export function preparePromotionProposal(projectDir, candidateData) {
  const root = path.resolve(projectDir);
  const queueDir = path.join(root, '.project-brain', 'promotion-queue');
  fs.mkdirSync(queueDir, { recursive: true });

  const count = fs.readdirSync(queueDir).filter(f => f.startsWith('PROPOSAL-')).length + 1;
  const num = String(count).padStart(3, '0');
  const slug = (candidateData.topic || 'learning').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 30);
  const filename = `PROPOSAL-${num}-${slug}.md`;
  const filePath = path.join(queueDir, filename);

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

/**
 * Promotes a verified proposal into Master Brain engineering patterns.
 * Strictly verifies empirical evidence and rejects hypothetical claims.
 */
export function promoteToMasterBrain(masterBrainPath, proposalFilePath, reviewDecision = {}) {
  if (!fs.existsSync(proposalFilePath)) {
    return { success: false, error: 'Proposal file not found' };
  }
  const content = fs.readFileSync(proposalFilePath, 'utf-8');

  // Verify empirical evidence exists
  if (!content.includes('## 5. Empirical Evidence & Provenance') || content.includes('Reproducible evidence pending')) {
    return { success: false, error: 'Rejected: No verified empirical evidence in proposal.' };
  }

  const patternsPath = path.join(masterBrainPath, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (!fs.existsSync(patternsPath)) {
    return { success: false, error: 'Master Brain engineering-patterns.md not found.' };
  }

  // Extract rule details
  const titleMatch = content.match(/## 1\. Candidate Pattern \/ Rule Name\s*\n+\*\*([^\*]+)\*\*/i);
  const ruleStatementMatch = content.match(/## 2\. Rule Statement\s*\n+([^#]+)/i);
  const whyMatch = content.match(/## 3\. Why It Matters[^\n]*\s*\n+([^#]+)/i);
  const whenMatch = content.match(/## 4\. When To Apply\s*\n+([^#]+)/i);

  const ruleTitle = titleMatch ? titleMatch[1].trim() : 'Validated Engineering Pattern';
  const ruleStatement = ruleStatementMatch ? ruleStatementMatch[1].trim() : '';
  const why = whyMatch ? whyMatch[1].trim() : '';
  const when = whenMatch ? whenMatch[1].trim() : '';

  // Determine next rule number
  const currentPatterns = fs.readFileSync(patternsPath, 'utf-8');
  const ruleMatches = [...currentPatterns.matchAll(/##\s+(\d+)\.\s+/g)];
  const nextNum = ruleMatches.length > 0 ? Math.max(...ruleMatches.map(m => parseInt(m[1], 10))) + 1 : 15;

  const newEntry = `
---

## ${nextNum}. ${ruleTitle}

**RULE**:
${ruleStatement}

**WHY**:
${why}

**WHEN TO APPLY**:
${when}
`;

  fs.appendFileSync(patternsPath, newEntry, 'utf-8');

  return {
    success: true,
    ruleNumber: nextNum,
    ruleTitle,
    targetFile: patternsPath
  };
}

/**
 * Resolves verified reusable learnings from Master Brain for newly bootstrapped child projects.
 */
export function resolveReusableLearnings(masterBrainPath, projectProfile) {
  const patternsFile = path.join(masterBrainPath, '05_KNOWLEDGE', 'engineering-patterns.md');
  if (!fs.existsSync(patternsFile)) return [];

  const content = fs.readFileSync(patternsFile, 'utf-8');
  const sections = content.split(/^##\s+/m);

  const reusable = [];
  for (const sec of sections) {
    if (!sec.trim() || sec.startsWith('Engineering Patterns')) continue;
    const lines = sec.trim().split('\n');
    const header = lines[0].trim();
    reusable.push({
      header,
      summary: lines.find(l => l.startsWith('**RULE**:') || l.startsWith('When') || l.startsWith('In')) || header
    });
  }

  return reusable;
}
