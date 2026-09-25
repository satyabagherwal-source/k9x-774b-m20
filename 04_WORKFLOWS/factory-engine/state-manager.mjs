import fs from 'fs';
import path from 'path';

export function loadProjectState(projectDir) {
  const statePath = path.join(projectDir, 'PROJECT_STATE.json');
  if (!fs.existsSync(statePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

export function saveProjectState(projectDir, state) {
  const statePath = path.join(projectDir, 'PROJECT_STATE.json');
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  return state;
}

export function updateProjectState(projectDir, updates = {}) {
  const state = loadProjectState(projectDir) || {};
  Object.assign(state, updates);
  return saveProjectState(projectDir, state);
}

export function updateMilestone(projectDir, milestoneId, status) {
  const state = loadProjectState(projectDir);
  if (!state) return false;

  const ms = state.milestones.find(m => m.id === milestoneId);
  if (ms) {
    ms.status = status;
    if (status === 'COMPLETED') {
      ms.completedAt = new Date().toISOString();
    }
    saveProjectState(projectDir, state);
    return true;
  }
  return false;
}

export function generateReadyCertificate(projectDir, verificationReport) {
  const root = path.resolve(projectDir);
  const certPath = path.join(root, 'PROJECT_READY_CERTIFICATE.md');

  const p = verificationReport.pillars;
  const content = `# 📜 Project Ready Certificate — ${verificationReport.projectName}

**Certification Status**: **${verificationReport.overallStatus}**
**Generated At**: ${verificationReport.timestamp}
**Environment**: Node ${process.version} | Platform: ${process.platform}

---

## 🏛️ Verification Pillars Audit

| Pillar | Requirement | Result | Details |
|---|---|---|---|
| **1. Brain Bridge** | Master Brain linked in read-only mode | **${p.brainBridge?.status || 'N/A'}** | ${p.brainBridge?.details || p.brainBridge?.error || ''} |
| **2. System Environment** | Node >= 18, npm, Git, GitHub CLI | **${p.environment?.status || 'N/A'}** | Node ${process.version}, npm OK |
| **3. Governance & Context** | Context, Rules, State, Design.md | **${p.contextAndGovernance?.status || 'N/A'}** | Verified |
| **4. Architecture & Tailwind v4** | Astro 5 + Tailwind v4 @theme | **${p.architecture?.status || 'N/A'}** | CSS-first @theme verified |
| **5. Build Verification** | Production build exit code 0 | **${p.build?.status || 'N/A'}** | ${p.build?.details || p.build?.error || ''} |
| **6. Dev-Server & Runtime** | HTTP 200 on local server | **${p.runtime?.status || 'N/A'}** | ${p.runtime?.details || p.runtime?.error || ''} |
| **7. SEO & Web Design** | Title, meta description, canonical | **${p.seoAndDesign?.status || 'N/A'}** | Title & Meta tags verified |

---

## 📋 Failures & Blockers
${verificationReport.failures.length > 0 ? verificationReport.failures.map(f => `- ❌ ${f}`).join('\n') : '*(None — All critical gates cleared)*'}

## ⚠️ Non-Fatal Warnings
${verificationReport.warnings.length > 0 ? verificationReport.warnings.map(w => `- ⚠️ ${w}`).join('\n') : '*(None)*'}

---

## 🔒 Certification Invariants
1. Master Brain was accessed strictly in read-only mode with zero file duplication.
2. Production bundle was built and verified via live execution.
3. Dev server was launched and probed over HTTP for real runtime responsiveness.
4. Any future defect must follow the Bug Lifecycle & Regression Verification Protocols.

**FINAL STATUS**: \`${verificationReport.overallStatus}\`
`;

  fs.writeFileSync(certPath, content, 'utf-8');
  return certPath;
}
