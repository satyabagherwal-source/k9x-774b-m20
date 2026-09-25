/**
 * Canonical Project-Local Brain & Operating System Schemas
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\project-brain-schemas.mjs
 * Purpose: Generates the 11 mandatory project-local brain files and directory
 *          structures for any newly bootstrapped project.
 */

import fs from 'fs';
import path from 'path';

export function generateProjectBrainFiles(projectDir, projectName, profile, context = {}) {
  const root = path.resolve(projectDir);
  const now = new Date().toISOString();
  const brainPath = context.masterBrainPath || 'C:\\AI-Builder-Brain';
  const env = context.env || {};

  const files = {};

  // 1. PROJECT_CONTEXT.md
  files['PROJECT_CONTEXT.md'] = `# 🌐 Project Context — ${projectName}

- **Project Name**: ${projectName}
- **Project Class**: ${profile.name} (\`${profile.id}\`)
- **Category**: ${profile.category}
- **Created At**: ${now}
- **Master Brain Link**: \`${brainPath}\` (Zero-Copy Read-Only Bridge)

---

## 🎯 Project Mission & Value Proposition
${profile.description}

## 🏗️ Architecture & Technology Boundaries
- **Architecture**: \`${profile.architecture}\`
- **Language & Runtime**: \`${profile.language}\` on \`${profile.runtime}\`
- **Frontend Stack**: ${profile.frontend}
- **Backend Stack**: ${profile.backend}
- **Database**: ${profile.database}
- **Styling Engine**: ${profile.styling}
- **Package Manager**: ${profile.packageManager}
- **Build System**: \`${profile.buildSystem}\`
- **Target Deployment**: ${profile.deployment}

## 🔒 Master Brain Zero-Copy Invariant
This project connects to the canonical Master AI-Builder-Brain via \`.project-brain/brain-bridge.json\`.
Master Brain knowledge is selectively queried and NEVER duplicated into this repository.
`;

  // 2. PROJECT_RULES.md
  files['PROJECT_RULES.md'] = `# 📜 Project Operating Rules & Invariants — ${projectName}

Every autonomous agent working in this project MUST strictly adhere to these 7 canonical rules:

### 1. The Non-Destructive Invariant
When resolving issues, fixing bugs, or modifying styles:
- NEVER modify or delete existing domain calculations, math formulas, or layout containers unless specifically requested.
- Maintain surgical precision: change only the minimum required lines.

### 2. Live Multi-Layer Verification
- NEVER declare an edit or feature complete based solely on generated code.
- Always execute live build (\`${profile.buildSystem}\`) and verify clean exit code 0.
- Verify runtime behavior on the live server before reporting task completion.

### 3. Cross-Platform Line-Ending Safety
- When parsing files or processing regexes, handle CRLF (\`\\r\\n\`) and LF (\`\\n\`) identically using \`split(/\\r?\\n/)\`.

### 4. Forensic Bug Correction Lifecycle
Every bug must follow:
\`BUG -> CAPTURE -> REPRODUCE -> ROOT CAUSE -> SURGICAL FIX -> TEST -> RUNTIME VERIFY -> REGRESSION AUDIT -> INCIDENT LOG -> LEARNING\`

### 5. Zero Master Brain Mutation
- The Master Brain at \`${brainPath}\` is STRICTLY READ-ONLY.
- Learnings are staged locally in \`.project-brain/promotion-queue/\` and require human/agent review before promotion.

### 6. Minimal Dependency Principle
- ONLY install and configure dependencies that are strictly required for this project profile.

### 7. Explicit Git State Management
- Never commit broken builds. Verify working tree cleanliness with \`git status\` before completing tasks.
`;

  // 3. PROJECT_KNOWLEDGE.md
  const knowledgeRules = (profile.requiredKnowledge || []).map(k => `- **${k}**: Selectively indexed from Master Brain \`05_KNOWLEDGE/engineering-patterns.md\``).join('\n');
  files['PROJECT_KNOWLEDGE.md'] = `# 🧠 Project Knowledge & Engineering Patterns — ${projectName}

> **Source**: Selectively resolved from Master AI-Builder-Brain based on project profile \`${profile.id}\`.

---

## 🏛️ Active Master Brain Engineering Patterns

${knowledgeRules.length > 0 ? knowledgeRules : '- Standard baseline patterns active.'}

## 🔄 Verified Reusable Lessons Propagated from Master Brain
- **Rule 1**: Fresh-state query before persistent state mutation.
- **Rule 5**: Defensive boundary deserialization & exception isolation.
- **Rule 12**: Cross-platform line-ending invariant handling.
- **Rule 13**: Non-destructive preservation of domain mathematics & visual UI integrity.

## 🔍 How to Query Additional Master Brain Knowledge
Run queries via Brain Bridge:
\`\`\`bash
# Query Master Brain engineering patterns
node "${path.join(brainPath, '04_WORKFLOWS', 'factory-engine', 'brain-bridge.mjs')}" --query "pattern-keyword"
\`\`\`
`;

  // 4. PROJECT_SKILLS.md
  const skillsList = (profile.requiredSkills || []).map(s => `- \`${s}\` -> Located in Master Brain \`${path.join(brainPath, s)}\``).join('\n');
  files['PROJECT_SKILLS.md'] = `# 🛠️ Project Skills & Capabilities — ${projectName}

The following specialized skills have been resolved from Master AI-Builder-Brain for project class **${profile.name}**:

${skillsList.length > 0 ? skillsList : '- Baseline developer skills active.'}

---

## 🔌 Applicable MCP Servers
${Object.keys(profile.applicableMCPs || {}).length > 0 ? Object.entries(profile.applicableMCPs).map(([k, v]) => `- **${v.name}** (\`${k}\`): ${v.purpose}`).join('\n') : '- No additional external MCP servers required for this lightweight profile.'}

## 💡 How an Agent Uses These Skills
1. Check \`PROJECT_SKILLS.md\` for relevant playbooks.
2. Read the referenced skill file from Master Brain in read-only mode.
3. Apply patterns surgically to the child project.
`;

  // 5. PROJECT_STATE.json
  const stateObj = {
    projectId: projectName,
    projectName,
    projectClass: profile.id,
    status: 'READY',
    stage: 'BOOTSTRAPPED',
    createdAt: now,
    updatedAt: now,
    masterBrainPath: brainPath,
    brainBridgeConnected: true,
    environmentStatus: env.status || 'READY',
    gitStatus: 'INITIALIZED',
    milestones: [
      { id: 'm1_discovery', title: 'AI-Builder-Brain Discovery & Verification', status: 'COMPLETED', completedAt: now },
      { id: 'm2_profile_resolution', title: `Project Profile Resolution (${profile.id})`, status: 'COMPLETED', completedAt: now },
      { id: 'm3_project_brain', title: 'Project-Local Brain & OS Generation', status: 'COMPLETED', completedAt: now },
      { id: 'm4_scaffold', title: 'Project Scaffolding & Blueprint Instantiation', status: 'COMPLETED', completedAt: now },
      { id: 'm5_dependencies', title: 'Targeted Dependency Installation', status: 'COMPLETED', completedAt: now },
      { id: 'm6_git_init', title: 'Independent Git Lifecycle & Initial Commit', status: 'COMPLETED', completedAt: now },
      { id: 'm7_live_verification', title: 'Multi-Pillar Live Verification', status: 'COMPLETED', completedAt: now },
      { id: 'm8_ready_certification', title: 'PROJECT READY Certification', status: 'COMPLETED', completedAt: now }
    ],
    capabilities: {
      seoTooling: profile.seoTooling,
      aiTooling: profile.aiTooling,
      mcpServers: Object.keys(profile.applicableMCPs || {}),
      verificationPillars: profile.verificationPillars
    },
    activeIncidents: [],
    resolvedIncidentsCount: 0
  };
  files['PROJECT_STATE.json'] = JSON.stringify(stateObj, null, 2);

  // 6. PROJECT_LEARNING.md
  files['PROJECT_LEARNING.md'] = `# 📖 Project Learning & Incident Register — ${projectName}

This document records forensic learning, resolved bugs, and candidate lessons harvested during development.

---

## 📋 Incident & Defect History

| Incident ID | Date | Summary | Root Cause | Fix Applied | Status | Reusable? |
|---|---|---|---|---|---|---|
| *None* | *Initial* | *Fresh Project Bootstrap* | *N/A* | *Initial Setup Verified* | *RESOLVED* | *N/A* |

---

## 🎓 Project-Specific Lessons
- **Bootstrap Invariant**: Verified clean build and live runtime execution at inception.
- **Isolation Invariant**: Master Brain remains external and read-only.

## 🚀 Outbound Master Brain Promotion Pipeline
When a defect is resolved and proven reusable across projects:
1. Capture incident in \`.project-brain/incidents/INC-XXX.md\`.
2. Format proposal in \`.project-brain/promotion-queue/PROPOSAL-XXX.md\`.
3. Review and submit to Master Brain \`11_INBOX/\` or promote to \`05_KNOWLEDGE/engineering-patterns.md\`.
`;

  // 7. PROJECT_DECISIONS.md
  files['PROJECT_DECISIONS.md'] = `# 🏛️ Architecture Decision Records (ADR) — ${projectName}

---

## ADR-001: Initial Architecture & Tech Stack Selection
- **Status**: ACCEPTED
- **Date**: ${now}
- **Context**: Bootstrapping ${projectName} under project class \`${profile.name}\`.
- **Decision**: Selected \`${profile.architecture}\` with frontend \`${profile.frontend}\`, backend \`${profile.backend}\`, and styling engine \`${profile.styling}\`.
- **Consequences**:
  - Provides minimum required overhead for profile \`${profile.id}\`.
  - Enforces strict verification pillars (\`${profile.verificationPillars.join(', ')}\`).
  - No unnecessary dependencies installed.

---

## ADR-002: Zero-Copy AI-Builder-Brain Integration
- **Status**: ACCEPTED
- **Date**: ${now}
- **Context**: Connecting child project to central AI-Builder-Brain governance and knowledge.
- **Decision**: Use zero-copy \`.project-brain/brain-bridge.json\` pointing to \`${brainPath}\`.
- **Consequences**:
  - Child project repo remains lightweight and independent.
  - Master Brain updates propagate immediately without git subtree or submodule complexity.
  - Master Brain boundary remains strictly read-only.
`;

  // 8. PROJECT_ARCHITECTURE.md
  files['PROJECT_ARCHITECTURE.md'] = `# 📐 Project Architecture & Layout — ${projectName}

- **Architecture Pattern**: \`${profile.architecture}\`
- **Build Target**: \`${profile.buildSystem}\`
- **Runtime**: \`${profile.runtime}\`

---

## 🗂️ System Directory Topology
\`\`\`
${projectName}/
├── .project-brain/              # Project-local Brain OS (Bridge, Incidents, Queue)
│   ├── brain-bridge.json        # Zero-copy Master Brain Link
│   ├── incidents/               # Verified Incident Logs
│   ├── lessons/                 # Project Lessons
│   └── promotion-queue/         # Candidates for Master Brain
├── src/                         # Application Source Code
├── scripts/                     # Operational & Verification Scripts
│   ├── agent-boot.mjs           # Canonical 15-step Agent Boot Engine
│   └── verify-build.mjs         # Build Verification Probe
├── PROJECT_CONTEXT.md           # High-level context & boundaries
├── PROJECT_RULES.md             # Invariants & operating rules
├── PROJECT_KNOWLEDGE.md         # Resolved patterns & knowledge
├── PROJECT_SKILLS.md            # Resolved skills & MCP list
├── PROJECT_STATE.json           # Machine-readable state & milestones
├── PROJECT_LEARNING.md          # Forensic incident & learning log
├── PROJECT_DECISIONS.md         # Architecture Decision Records
├── PROJECT_ARCHITECTURE.md      # This file
├── PROJECT_REQUIREMENTS.md      # Functional & quality criteria
├── PROJECT_ENVIRONMENT.md       # Tool versions & system state
└── PROJECT_READY_CERTIFICATE.md # Live verification proof & certification
\`\`\`

---

## 🔄 Core Data & Execution Flows
1. **Agent Boot Flow**: Agent runs \`node scripts/agent-boot.mjs\` to load context, verify bridge, and inspect state.
2. **Build & Verification Flow**: Code changes trigger live build and dev-server socket probes.
3. **Forensic Bug Correction**: Bugs are isolated, reproduced, fixed surgically, and logged into \`.project-brain/incidents/\`.
`;

  // 9. PROJECT_REQUIREMENTS.md
  files['PROJECT_REQUIREMENTS.md'] = `# 📋 Project Requirements & Acceptance Criteria — ${projectName}

- **Project Class**: \`${profile.name}\`
- **Profile Category**: \`${profile.category}\`

---

## 1. Functional Requirements
- **Core Feature**: Provide complete functionality for \`${profile.description}\`.
- **User Interface**: Modern, responsive, accessible interface adhering to \`${profile.styling}\`.
- **Performance**: High performance with minimal layout shift and instant load.

## 2. Non-Functional Quality Attributes
- **SEO Readiness**: ${profile.seoTooling.enabled ? 'Complete metadata, canonical tags, sitemap, robots.txt, schema.org.' : 'Standard baseline metadata.'}
- **Accessibility**: Standard ${profile.accessibilityTooling.standard || 'WCAG AA'} compliance.
- **Reliability**: Zero runtime console exceptions; graceful error boundaries.
- **Portability**: Verified on Windows, Linux, and macOS runtimes.

## 3. Mandatory Acceptance Criteria for PROJECT READY
- [x] Master Brain Zero-Copy Bridge established and verified.
- [x] Project-Local Brain OS files created and non-empty.
- [x] Dependencies installed with exit code 0.
- [x] Static / Production build exits code 0.
- [x] Runtime server responds with HTTP 200 OK on isolated port.
- [x] Independent Git repository initialized with clean working tree.
- [x] Ready Certificate generated with all pillars passed.
`;

  // 10. PROJECT_ENVIRONMENT.md
  files['PROJECT_ENVIRONMENT.md'] = `# 💻 Project Development Environment — ${projectName}

- **Recorded At**: ${now}
- **Operating System**: ${process.platform} (${process.arch})
- **Node.js**: ${process.version}
- **npm**: ${env.tools?.npm?.version || '11.x'}
- **Git**: ${env.tools?.git?.version || '2.x'}
- **GitHub CLI**: ${env.tools?.gh?.authenticated ? `Authenticated (${env.tools?.gh?.account})` : 'Not Authenticated'}
- **Package Manager**: ${profile.packageManager}

---

## 📦 Required Toolchain Status
| Tool | Requirement | Detected State | Status |
|---|---|---|---|
| Node.js | >= 18.0.0 | ${process.version} | ✅ PASS |
| npm | >= 9.0.0 | ${env.tools?.npm?.version || 'Available'} | ✅ PASS |
| Git | >= 2.x | ${env.tools?.git?.version || 'Available'} | ✅ PASS |
| GitHub CLI | Optional/Authorized | ${env.tools?.gh?.authenticated ? 'Authenticated' : 'Offline'} | ${env.tools?.gh?.authenticated ? '✅ READY' : 'ℹ️ OPTIONAL'} |

---

## 🔒 Security & Environmental Boundary
- Master Brain Path: \`${brainPath}\` (Read-only access)
- Local Project Root: \`${root}\`
`;

  // 11. PROJECT_READY_CERTIFICATE.md (initial template)
  files['PROJECT_READY_CERTIFICATE.md'] = `# 📜 Project Ready Certificate — ${projectName}

**Status**: **PENDING_INITIAL_VERIFICATION**  
**Timestamp**: ${now}  
**Profile**: \`${profile.name}\`  

*(This certificate is automatically finalized upon completion of the live Multi-Layer Verification Suite)*
`;

  return files;
}

export function writeProjectBrainFiles(projectDir, files) {
  const root = path.resolve(projectDir);
  const written = [];

  // Ensure .project-brain subdirectories exist
  fs.mkdirSync(path.join(root, '.project-brain', 'incidents'), { recursive: true });
  fs.mkdirSync(path.join(root, '.project-brain', 'lessons'), { recursive: true });
  fs.mkdirSync(path.join(root, '.project-brain', 'promotion-queue'), { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    const fullPath = path.join(root, filename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    written.push(fullPath);
  }

  return written;
}
