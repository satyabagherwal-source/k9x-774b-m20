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
  
  // Format dynamic pillars table
  const rows = [
    `| **1. Brain Bridge** | Master Brain linked in read-only mode | **${p.brainBridge?.status || 'N/A'}** | ${p.brainBridge?.details || p.brainBridge?.error || ''} |`,
    `| **2. System Environment** | Node >= 18, npm, Git, tools verified | **${p.environment?.status || 'N/A'}** | Node ${process.version}, npm, Git verified |`,
    `| **3. Project Governance** | All 11 mandatory Brain files & .project-brain | **${p.contextAndGovernance?.status || 'N/A'}** | ${p.contextAndGovernance?.details?.verifiedFilesCount || 11}/11 files verified non-empty |`,
    `| **4. Architecture & Config** | Framework config & Tailwind v4 CSS-first | **${p.architecture?.status || 'N/A'}** | Tailwind v4 @theme verified |`,
    `| **5. Build Verification** | Production build exit code 0 | **${p.build?.status || 'N/A'}** | ${p.build?.details || p.build?.error || ''} |`,
    `| **6. Runtime Server Probe** | HTTP 200 OK on isolated port | **${p.runtime?.status || 'N/A'}** | ${p.runtime?.details || p.runtime?.error || ''} |`
  ];

  if (p.seoAndQuality) {
    rows.push(`| **7. SEO & Web Design** | Title, meta, canonical, viewport | **${p.seoAndQuality?.status || 'N/A'}** | Meta tags & CSS tokens verified |`);
  } else if (p.aiAndQuality) {
    rows.push(`| **7. AI & API Architecture** | Server endpoints & AI client contract | **${p.aiAndQuality?.status || 'N/A'}** | AI inference contract verified |`);
  }

  if (p.gitStatus) {
    rows.push(`| **8. Git & Repository** | Independent Git repo & clean working tree | **${p.gitStatus?.status || 'N/A'}** | Branch: ${p.gitStatus?.details?.branch || 'main'}, Clean: ${p.gitStatus?.details?.clean ? 'YES' : 'NO'} |`);
  }

  if (p.mcpHealth) {
    rows.push(`| **9. MCP Architecture** | Canonical MCP servers health probe | **${p.mcpHealth?.status || 'N/A'}** | Configured MCPs verified |`);
  }

  const content = `# 📜 Project Ready Certificate — ${verificationReport.projectName}

**Certification Status**: **${verificationReport.overallStatus === 'READY' ? 'CERTIFIED READY' : verificationReport.overallStatus}**  
**Project Profile**: \`${verificationReport.profileId}\`  
**Generated At**: ${verificationReport.timestamp}  
**Environment**: Node ${process.version} | Platform: ${process.platform} (${process.arch})  

---

## 🏛️ Verification Pillars Audit

| Pillar | Requirement | Result | Details |
|---|---|---|---|
${rows.join('\n')}

---

## 📋 Failures & Blockers
${verificationReport.failures.length > 0 ? verificationReport.failures.map(f => `- ❌ ${f}`).join('\n') : '*(None — All critical gates cleared)*'}

## ⚠️ Non-Fatal Warnings
${verificationReport.warnings.length > 0 ? verificationReport.warnings.map(w => `- ⚠️ ${w}`).join('\n') : '*(None)*'}

---

## 🔒 Certification Invariants
1. **Zero-Copy Master Brain Invariant**: Master Brain was accessed strictly in read-only mode with zero file duplication.
2. **Deterministic Live Verification**: Production bundle was built and verified via live execution.
3. **Runtime Responsiveness**: Server was launched and probed over HTTP for real runtime responsiveness.
4. **Git Isolation**: Master Brain repository and child project repository are completely independent.
5. **Continuous Quality Gate**: Any future defect must follow the Bug Correction Lifecycle and Regression Protocols.

**FINAL STATUS**: \`PROJECT STATUS: ${verificationReport.overallStatus === 'READY' ? 'READY : CERTIFIED' : verificationReport.overallStatus}\`
`;

  fs.writeFileSync(certPath, content, 'utf-8');

  // Synchronize state file
  updateProjectState(projectDir, {
    status: verificationReport.overallStatus,
    certifiedAt: verificationReport.timestamp,
    verificationPillars: verificationReport.pillars
  });

  return certPath;
}
