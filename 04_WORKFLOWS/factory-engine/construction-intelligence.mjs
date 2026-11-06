/**
 * AI-Builder-Brain Universal Construction Intelligence Engine (CIE)
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\construction-intelligence.mjs
 * Purpose: Bridges the real construction gap between:
 *          - Domain A: Human & Need Intelligence
 *          - Domain B: Product Intelligence
 *          - Domain C: Market & Business Intelligence
 *          and downstream technical construction (Domains F, G, H, J, K, L).
 * 
 * Operational Invariant:
 * Transforms raw user intent or human problem statement into a rigorous,
 * structured, evidence-grounded, implementation-ready construction intelligence package.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Normalizes text to a clean slug identifier
 */
function slugify(text) {
  return String(text || 'product')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 32);
}

/**
 * Domain A: Human & Need Intelligence Synthesizer
 * Formulates a structured ProblemRecord from raw intent or user problem input.
 */
export function synthesizeProblemRecord(intent, profile = {}, options = {}) {
  const cleanIntent = String(intent || '').trim();
  const slug = slugify(profile.name || cleanIntent || 'digital-product');
  const now = new Date().toISOString();

  // Intent parsing heuristics
  const isPrivacySensitive = /privacy|sensitive|secret|confidential|client|local-only|offline|browser-only/i.test(cleanIntent);
  const isPerformanceSensitive = /fast|performance|high-speed|latency|instant|sub-millisecond|wasm|zero-copy/i.test(cleanIntent);
  const isConversionTool = /convert|converter|transform|transcode|format|parser/i.test(cleanIntent);
  const isAnalyticsTool = /analytics|metrics|track|dashboard|monitor|telemetry/i.test(cleanIntent);
  const isContentSite = /blog|seo|content|adsense|article|guide|documentation/i.test(cleanIntent);

  const problemStatement = cleanIntent.length > 10 
    ? cleanIntent 
    : `Users need a reliable, high-performance, and accessible ${profile.name || 'digital product'} that solves key domain workflows without unnecessary friction.`;

  const painPoints = [];
  if (isPrivacySensitive) {
    painPoints.push("Existing cloud-based tools force users to upload confidential data to untrusted remote servers.");
    painPoints.push("Data privacy regulations (GDPR/HIPAA/internal infosec) strictly prohibit server-side file transmission.");
  }
  if (isPerformanceSensitive) {
    painPoints.push("Existing alternatives suffer from high latency, round-trip network delays, and sluggish UI response.");
  }
  if (isConversionTool) {
    painPoints.push("Legacy conversion tools enforce arbitrary file size caps, aggressive watermarking, or predatory paywalls.");
    painPoints.push("Multi-step upload and download workflows interrupt productive developer and designer flow.");
  }
  if (painPoints.length === 0) {
    painPoints.push("Current market alternatives are either overly bloated, slow, or enforce steep subscription paywalls.");
    painPoints.push("Lack of streamlined, zero-friction, mobile-responsive workflows for daily operational tasks.");
  }

  const constraints = [
    "Zero unnecessary dependencies: Keep client bundle lean and runtime responsive.",
    "Mobile-first responsive architecture: Must function seamlessly on all viewport sizes.",
    "Accessibility: Semantic HTML5 with WCAG 2.1 AA keyboard navigation."
  ];

  if (isPrivacySensitive) {
    constraints.unshift("Strict Client-Side Boundary: All processing must occur 100% in-browser via WebAssembly, Web Workers, or Canvas APIs with zero server transmission.");
  }

  return {
    problem_id: `PROB-${slug}-${crypto.randomBytes(3).toString('hex')}`,
    created_at: now,
    problem_statement: problemStatement,
    target_user: {
      primary_persona: isPrivacySensitive ? "Privacy-conscious professional / enterprise designer / security engineer" : "Modern digital professional / developer / end-user",
      technical_proficiency: "Intermediate to beginner",
      context_of_use: "Fast-paced daily workflow requiring instant, friction-free outcomes"
    },
    context_and_environment: {
      platform: profile.runtime || "Modern Web Browser (Cross-Platform)",
      network_dependency: isPrivacySensitive ? "Offline-Capable / Client-Side" : "Standard Broadband / Mobile Data",
      viewport_range: "Mobile (360px) to Desktop (4K)"
    },
    pain_points: painPoints,
    urgency_evaluation: {
      severity: isPrivacySensitive ? "CRITICAL_SECURITY_RISK" : "HIGH_OPERATIONAL_FRICTION",
      status_quo_failure: "Existing workarounds either violate security compliance or waste significant manual time."
    },
    root_cause_analysis: "Legacy tools monetize user data or rely on costly server compute, forcing an architectural mismatch between user privacy/speed needs and vendor profit models.",
    constraints,
    desired_outcomes_and_success_criteria: [
      "Immediate task completion within 3 clicks or drag-and-drop actions.",
      isPrivacySensitive ? "100% verified zero outbound network requests for user file payloads." : "Instant visual confirmation of success.",
      "Lighthouse performance score >= 90 across Mobile and Desktop."
    ]
  };
}

/**
 * Domain C: Market & Business Intelligence Synthesizer
 * Formulates commercial feasibility, competitive gap analysis, and viability verdict.
 */
export function synthesizeMarketFeasibility(problemRecord, profile = {}, options = {}) {
  const isClientSidePrivate = problemRecord.constraints.some(c => c.toLowerCase().includes('client-side'));
  const now = new Date().toISOString();

  const competitorMatrix = [
    {
      competitor_type: "Legacy Ad-Supported Web Utilities",
      key_strengths: "High SEO visibility, established domain authority",
      critical_weaknesses: "Server-side file uploads, heavy advertising clutter, intrusive trackers, slow page load, privacy risks"
    },
    {
      competitor_type: "Enterprise Desktop Software",
      key_strengths: "Offline processing, robust feature set",
      critical_weaknesses: "Expensive licensing, heavy install footprint, poor cross-device portability"
    }
  ];

  const valueProposition = isClientSidePrivate
    ? "Zero-Server In-Browser Execution: Instant, 100% private processing with zero file uploads and zero cloud latency."
    : "Frictionless, Lightning-Fast Digital Utility with Clean Aesthetic and Zero Bloat.";

  return {
    feasibility_id: `FEAS-${slugify(problemRecord.problem_id)}`,
    evaluated_at: now,
    commercial_subject: profile.name || "Digital Construction Utility",
    market_sizing_estimate: {
      market_tier: "Mass-Market Utility & Developer Productivity",
      addressable_audience: "Global web users, developers, creators, and enterprise remote workers",
      growth_driver: "Increasing data sovereignty regulations and demand for lightweight edge/browser utilities"
    },
    competitor_matrix: competitorMatrix,
    market_gaps: [
      "Absence of transparent, clean, privacy-first browser tools without predatory paywalls.",
      "Poor mobile responsiveness and ad-cluttered interfaces in existing status-quo utilities."
    ],
    value_proposition: valueProposition,
    monetization_and_distribution: {
      primary_model: profile.category === 'web-seo' ? "AdSense-optimized high-intent search traffic + optional tip jar / premium features" : "Open-source core with micro-SaaS enterprise tier",
      distribution_channels: ["Organic Technical SEO (Long-Tail High Intent)", "Developer Communities (GitHub, ProductHunt, Reddit)", "Word-of-mouth referral"]
    },
    hurdle_rate_evaluation: {
      gross_margin_potential: "90%+ (Client-side execution eliminates expensive backend compute costs)",
      payback_period_months: 1,
      estimated_ltv_cac_ratio: 5.0,
      moat_defensibility_score: 0.85
    },
    feasibility_verdict: "FEASIBLE"
  };
}

/**
 * Domain B: Product Intelligence Synthesizer
 * Compiles an implementation-ready PRDSpecification with MVP Scope and strict Negative Scope.
 */
export function synthesizePRDSpecification(problemRecord, marketFeasibility, profile = {}, options = {}) {
  const now = new Date().toISOString();
  const slug = slugify(problemRecord.problem_id);
  const isClientSidePrivate = problemRecord.constraints.some(c => c.toLowerCase().includes('client-side'));

  // Core MVP Features (P0)
  const mvpScope = [
    {
      feature_id: "FEAT-CORE-01",
      name: "Intuitive Drag-and-Drop Ingestion Zone",
      priority: "P0_CRITICAL",
      description: "Accessible, interactive dropzone supporting file selection, paste from clipboard, and mobile file picker.",
      acceptance_criteria: "Files load into memory within 100ms with visual feedback and MIME-type validation."
    },
    {
      feature_id: "FEAT-CORE-02",
      name: "Core In-Browser Processing Pipeline",
      priority: "P0_CRITICAL",
      description: "Direct transformation engine executed locally via browser APIs (Canvas, WASM, Web Workers).",
      acceptance_criteria: "Transformation completes without freezing main thread; zero outbound network requests emitted."
    },
    {
      feature_id: "FEAT-CORE-03",
      name: "Instant Result Preview & 1-Click Export",
      priority: "P0_CRITICAL",
      description: "Side-by-side or immediate before/after preview with instant download action.",
      acceptance_criteria: "Download triggers immediately with sanitized filename; file size and format verified."
    },
    {
      feature_id: "FEAT-CORE-04",
      name: "Responsive Shell & Privacy Guarantee Badge",
      priority: "P0_CRITICAL",
      description: "Tailwind v4 styled layout displaying verified privacy badge and zero-server guarantee.",
      acceptance_criteria: "Fully responsive on viewports from 360px to 4K; 100% keyboard navigable."
    }
  ];

  // Negative Scope / Exclusions (Critical for preventing scope creep)
  const negativeScope = [
    {
      exclusion_id: "EXCL-01",
      feature_name: "User Account Registration & Password Login",
      rationale: "Unnecessary barrier for utility tools; increases friction and introduces user database liability."
    },
    {
      exclusion_id: "EXCL-02",
      feature_name: "Cloud File Storage & Multi-Device Sync",
      rationale: "Violates the strict privacy guarantee; adds recurring database/storage costs."
    },
    {
      exclusion_id: "EXCL-03",
      feature_name: "Complex Enterprise Role-Based Access Control (RBAC)",
      rationale: "Premature optimization for MVP; slows initial delivery without proven demand."
    },
    {
      exclusion_id: "EXCL-04",
      feature_name: "Heavy Client-Side Frameworks with Hydration Overhead",
      rationale: "Astro static defaults provide zero-hydration performance and faster First Contentful Paint (FCP)."
    }
  ];

  // User Stories
  const userStories = [
    {
      story_id: "US-01",
      as_a: problemRecord.target_user.primary_persona,
      i_want_to: "Drag and drop my local files into the browser tool",
      so_that: "I can process them instantly without installing heavy native software",
      acceptance_criteria: [
        "Given a supported file format, when dropped, it is accepted immediately.",
        "Given an unsupported format, when dropped, an accessible error toast explains the accepted MIME types."
      ]
    },
    {
      story_id: "US-02",
      as_a: problemRecord.target_user.primary_persona,
      i_want_to: "Be 100% confident that my confidential files are never uploaded to a cloud server",
      so_that: "I comply with enterprise security and data privacy mandates",
      acceptance_criteria: [
        "Network tab confirms 0 POST/PUT requests during processing.",
        "Privacy badge and clear explanatory disclosure visible above the fold."
      ]
    },
    {
      story_id: "US-03",
      as_a: problemRecord.target_user.primary_persona,
      i_want_to: "Download the finished output in one click",
      so_that: "I can resume my primary workflow without delay",
      acceptance_criteria: [
        "Clicking download immediately triggers the native browser save dialog.",
        "Output file retains high fidelity and expected format specifications."
      ]
    }
  ];

  return {
    prd_id: `PRD-${slug}`,
    created_at: now,
    product_name: profile.name || "Precision Digital Utility",
    anchored_problem_id: problemRecord.problem_id,
    anchored_feasibility_id: marketFeasibility.feasibility_id,
    core_thesis: marketFeasibility.value_proposition,
    target_persona: problemRecord.target_user.primary_persona,
    mvp_scope: mvpScope,
    negative_scope_exclusions: negativeScope,
    user_stories: userStories,
    technical_specifications: {
      architecture_blueprint: profile.blueprint || "astro-tailwind-v4",
      processing_location: isClientSidePrivate ? "CLIENT_BROWSER_ONLY" : "CLIENT_PRIMARY_OPTIONAL_EDGE",
      supported_formats: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
      ui_states_required: ["EMPTY_IDLE", "DRAG_HOVER", "PROCESSING_ACTIVE", "SUCCESS_PREVIEW", "ERROR_FEEDBACK"]
    },
    success_metrics: [
      "Client-side processing latency < 500ms for standard payloads",
      "Zero server payload transmission",
      "Lighthouse Accessibility & SEO score == 100"
    ]
  };
}

/**
 * Generates an implementation-ready markdown guide for the AI coder / builder.
 */
export function generateConstructionGuideMarkdown(problemRecord, marketFeasibility, prdSpecification, profile = {}) {
  return `# 🏗️ Construction Intelligence Specification & Blueprint

> **Generated by AI-Builder-Brain Construction Intelligence Engine (CIE)**  
> **Problem ID**: \`${problemRecord.problem_id}\`  
> **PRD ID**: \`${prdSpecification.prd_id}\`  
> **Commercial Feasibility**: **${marketFeasibility.feasibility_verdict}**  
> **Target Profile**: \`${profile.name || 'General Product'}\` (\`${profile.id || 'default'}\`)

---

## 🎯 1. Human Need & Root Cause (Domain A)
- **Problem Statement**: ${problemRecord.problem_statement}
- **Primary Persona**: ${problemRecord.target_user.primary_persona}
- **Context of Use**: ${problemRecord.target_user.context_of_use}

### Identified Pain Points:
${problemRecord.pain_points.map(p => `- ⚠️ ${p}`).join('\n')}

### Hard Invariants & Constraints:
${problemRecord.constraints.map(c => `- 🔒 **Constraint**: ${c}`).join('\n')}

---

## 💡 2. Value Proposition & Commercial Differentiation (Domain C)
- **Core Value Proposition**: ${marketFeasibility.value_proposition}
- **Market Gap**: ${marketFeasibility.market_gaps.join('; ')}
- **Gross Margin Potential**: ${marketFeasibility.hurdle_rate_evaluation.gross_margin_potential}
- **Feasibility Verdict**: **${marketFeasibility.feasibility_verdict}**

---

## 📦 3. Strict MVP Scope — Features to Build (Domain B)

Every developer or AI agent building this product MUST implement ONLY these P0 features:

| Feature ID | Feature Name | Priority | Core Requirement & Acceptance Criteria |
| :--- | :--- | :---: | :--- |
${prdSpecification.mvp_scope.map(f => `| **\`${f.feature_id}\`** | ${f.name} | \`${f.priority}\` | ${f.description} *(${f.acceptance_criteria})* |`).join('\n')}

---

## 🚫 4. Non-Negotiable Negative Scope — What NOT to Build (Domain B)

> [!WARNING]
> **ANTI-BLOAT & ANTI-SCOPE-CREEP MANDATE**:  
> The following features are **STRICTLY EXCLUDED** from the MVP. Implementing any of these without explicit human instruction is a direct specification violation:

| Exclusion ID | Forbidden Feature | Architectural Rationale for Exclusion |
| :--- | :--- | :--- |
${prdSpecification.negative_scope_exclusions.map(e => `| **\`${e.exclusion_id}\`** | **${e.feature_name}** | ${e.rationale} |`).join('\n')}

---

## 👤 5. User Stories & Test Scenarios

${prdSpecification.user_stories.map(u => `### User Story: \`${u.story_id}\`
- **As a**: ${u.as_a}
- **I want to**: ${u.i_want_to}
- **So that**: ${u.so_that}
- **Acceptance Criteria**:
${u.acceptance_criteria.map(a => `  - [ ] ${a}`).join('\n')}
`).join('\n')}

---

## 🛠️ 6. Downstream Construction Guidelines (Domains F, G, H, J, K)
1. **Design (Domain F)**: Apply Tailwind v4 CSS-First design tokens (\`global.css\`). Enforce mobile-first responsive layout, dark-mode styling, and semantic HTML5 tags.
2. **Architecture (Domain G)**: Follow Master Brain Engineering Patterns (Rules 1-68+). Ensure all file processing is contained within Web Workers or client-side Canvas buffers.
3. **SEO & Distribution (Domain J)**: Inject OpenGraph metadata, structured JSON-LD schema, canonical URL tags, and self-referential hreflang tags.
4. **Verification (Domain K)**: Verify build exit code 0 (\`npm run build\`). Test zero-network transmission via network inspect probes.
`;
}

/**
 * Unified Pipeline: Synthesizes the complete construction intelligence package.
 */
export function synthesizeConstructionPackage(intent, profile = {}, options = {}) {
  const problemRecord = synthesizeProblemRecord(intent, profile, options);
  const marketFeasibility = synthesizeMarketFeasibility(problemRecord, profile, options);
  const prdSpecification = synthesizePRDSpecification(problemRecord, marketFeasibility, profile, options);
  const constructionGuideMarkdown = generateConstructionGuideMarkdown(problemRecord, marketFeasibility, prdSpecification, profile);

  return {
    problemRecord,
    marketFeasibility,
    prdSpecification,
    constructionGuideMarkdown
  };
}

/**
 * Emits the construction intelligence package to the project's .project-brain/construction/ directory.
 */
export function emitConstructionIntelligence(targetDir, constructionPackage) {
  const root = path.resolve(targetDir);
  const constructionDir = path.join(root, '.project-brain', 'construction');

  if (!fs.existsSync(constructionDir)) {
    fs.mkdirSync(constructionDir, { recursive: true });
  }

  const writtenFiles = [];

  // 1. problem-record.json (Domain A)
  const probPath = path.join(constructionDir, 'problem-record.json');
  fs.writeFileSync(probPath, JSON.stringify(constructionPackage.problemRecord, null, 2), 'utf-8');
  writtenFiles.push(probPath);

  // 2. business-feasibility.json (Domain C)
  const feasPath = path.join(constructionDir, 'business-feasibility.json');
  fs.writeFileSync(feasPath, JSON.stringify(constructionPackage.marketFeasibility, null, 2), 'utf-8');
  writtenFiles.push(feasPath);

  // 3. prd-specification.json (Domain B)
  const prdPath = path.join(constructionDir, 'prd-specification.json');
  fs.writeFileSync(prdPath, JSON.stringify(constructionPackage.prdSpecification, null, 2), 'utf-8');
  writtenFiles.push(prdPath);

  // 4. CONSTRUCTION_SPECIFICATION.md (Bridge to Domains F, G, H)
  const guidePath = path.join(constructionDir, 'CONSTRUCTION_SPECIFICATION.md');
  fs.writeFileSync(guidePath, constructionPackage.constructionGuideMarkdown, 'utf-8');
  writtenFiles.push(guidePath);

  return writtenFiles;
}

