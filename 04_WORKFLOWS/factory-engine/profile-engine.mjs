/**
 * Universal Project Profile & Capability Resolution Engine
 * 
 * Location: C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\profile-engine.mjs
 * Purpose: Analyzes project intent, detects project type, and dynamically resolves
 *          architecture, tech stack, environment, MCPs, skills, knowledge, and verification pillars.
 */

import { resolveApplicableMCPs } from './mcp-registry.mjs';

export const PROJECT_CLASSES = {
  'seo-adsense-micro-website': {
    id: 'seo-adsense-micro-website',
    name: 'SEO & Google AdSense Micro Website',
    category: 'web-seo',
    description: 'High-performance static site built with Astro 5, Tailwind CSS v4 CSS-first design, complete SEO, sitemap, robots, schema markup, and AdSense readiness.',
    architecture: 'astro-static-ssg',
    language: 'TypeScript / Astro',
    runtime: 'Node.js',
    frontend: 'Astro 5 + HTML5 semantic components',
    backend: 'none-static',
    database: 'none',
    styling: 'Tailwind CSS v4 (@theme, CSS-first, OKLCH)',
    packageManager: 'npm',
    testing: 'Static build verification & dev server probe',
    linting: 'Astro ESLint',
    formatting: 'Prettier',
    buildSystem: 'astro build',
    deployment: 'Vercel / Cloudflare Pages',
    documentation: 'PROJECT_CONTEXT.md + design.md',
    blueprint: 'astro-tailwind-v4',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'vercel'],
    seoTooling: { enabled: true, canonical: true, sitemap: true, robots: true, schemaOrg: true },
    accessibilityTooling: { enabled: true, standard: 'WCAG AA' },
    performanceTooling: { target: 'Core Web Vitals 95+' },
    aiTooling: { enabled: false },
    requiredSkills: [
      '03_SKILLS/astro-adsense-mastery.md',
      '03_SKILLS/astro-architecture-and-seo.md',
      '03_SKILLS/tailwind-v4-css-first-design.md',
      '03_SKILLS/vercel-deployment-playbook.md',
      '03_SKILLS/agent-error-prevention-protocol.md'
    ],
    requiredKnowledge: [
      'Rule 9 (Canonical Uniformity & Edge Redirects)',
      'Rule 11 (Cross-Boundary SSR DOM Preservation)',
      'Rule 13 (Non-Destructive In-Place Preservation of UI/Math)'
    ],
    requiredWorkflows: [
      '04_WORKFLOWS/project-factory-workflow.md',
      '04_WORKFLOWS/git-github-autonomous-lifecycle.md'
    ],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'seoAndDesign', 'gitStatus'
    ]
  },

  'single-page-tool-website': {
    id: 'single-page-tool-website',
    name: 'Single-page Tool Website',
    category: 'web-tool',
    description: 'Interactive high-precision web tool or calculator with isolated domain math, responsive UI, zero layout shift, and SEO.',
    architecture: 'astro-static-or-vite',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'Astro / Reactive Client Island',
    backend: 'none-static',
    database: 'none',
    styling: 'Tailwind CSS v4 (@theme, CSS-first)',
    packageManager: 'npm',
    testing: 'Build verification + domain calculation math assertions',
    linting: 'ESLint',
    formatting: 'Prettier',
    buildSystem: 'astro build',
    deployment: 'Vercel',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_ARCHITECTURE.md',
    blueprint: 'astro-tailwind-v4',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'vercel'],
    seoTooling: { enabled: true, canonical: true, sitemap: true, robots: true },
    accessibilityTooling: { enabled: true, standard: 'WCAG AA' },
    performanceTooling: { target: 'Zero CLS, Instant calculation' },
    aiTooling: { enabled: false },
    requiredSkills: [
      '03_SKILLS/astro-architecture-and-seo.md',
      '03_SKILLS/tailwind-v4-css-first-design.md',
      '03_SKILLS/agent-error-prevention-protocol.md'
    ],
    requiredKnowledge: [
      'Rule 13 (Non-Destructive In-Place Preservation of Complex Mathematics)',
      'Rule 5 (Defensive Boundary Deserialization)',
      'Rule 12 (Cross-Platform Line-Ending Invariants)'
    ],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'seoAndDesign', 'gitStatus'
    ]
  },

  'micro-tool-website': {
    id: 'micro-tool-website',
    name: 'Micro Tool Website',
    category: 'web-tool',
    description: 'Suite of focused micro utilities sharing design tokens, shared layout, and high-ranking SEO pages.',
    architecture: 'astro-multi-route-ssg',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'Astro 5 + Islands',
    backend: 'none-static',
    database: 'none',
    styling: 'Tailwind CSS v4',
    packageManager: 'npm',
    testing: 'Build + Route verification',
    linting: 'ESLint',
    formatting: 'Prettier',
    buildSystem: 'astro build',
    deployment: 'Vercel',
    documentation: 'PROJECT_CONTEXT.md',
    blueprint: 'astro-tailwind-v4',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'vercel'],
    seoTooling: { enabled: true, canonical: true, sitemap: true, robots: true },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'Lighthouse 95+' },
    aiTooling: { enabled: false },
    requiredSkills: [
      '03_SKILLS/astro-adsense-mastery.md',
      '03_SKILLS/astro-architecture-and-seo.md',
      '03_SKILLS/tailwind-v4-css-first-design.md'
    ],
    requiredKnowledge: ['Rule 9', 'Rule 13'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'seoAndDesign', 'gitStatus'
    ]
  },

  'ai-saas': {
    id: 'ai-saas',
    name: 'Full-stack AI SaaS Application',
    category: 'ai-saas',
    description: 'Production-ready AI SaaS platform with React/TypeScript frontend, modern API backend, AI provider streaming/endpoints, database readiness, auth architecture, and live verification.',
    architecture: 'fullstack-ai-saas-modular',
    language: 'TypeScript / Node.js',
    runtime: 'Node.js (>= 18.0.0)',
    frontend: 'React 19 + Vite + Tailwind CSS v4',
    backend: 'Node.js / Express AI Service Engine',
    database: 'PostgreSQL / SQLite ready',
    styling: 'Tailwind CSS v4 (@theme, glassmorphism, dark mode)',
    packageManager: 'npm',
    testing: 'Build verification + live API endpoint probe + AI mock test',
    linting: 'TypeScript tsc + ESLint',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Vercel / Container / Node Host',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_ARCHITECTURE.md + PROJECT_DECISIONS.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'docker'],
    seoTooling: { enabled: true, landingMeta: true },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'Sub-100ms API response, streaming chunks' },
    aiTooling: { enabled: true, sdk: 'AI SDK / Model Client', streaming: true },
    requiredSkills: [
      '03_SKILLS/fullstack-ai-saas-architecture.md',
      '03_SKILLS/tailwind-v4-css-first-design.md',
      '03_SKILLS/universal-mcp-integration.md',
      '03_SKILLS/agent-error-prevention-protocol.md'
    ],
    requiredKnowledge: [
      'Rule 1 (Async In-Flight Fresh-State + Targeted Field Scoping)',
      'Rule 5 (Defensive Boundary Deserialization + Exception Isolation)',
      'Rule 6 (Interface & Build Contract Consistency)',
      'Rule 7 (Service-Level Input Preconditions + Domain Constraint Guards)',
      'Rule 8 (Collision-Resistant Entity Identity Generation)'
    ],
    requiredWorkflows: [
      '04_WORKFLOWS/project-factory-workflow.md',
      '04_WORKFLOWS/git-github-autonomous-lifecycle.md'
    ],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'fullstack-web-app': {
    id: 'fullstack-web-app',
    name: 'Full-stack Web Application',
    category: 'fullstack',
    description: 'Multi-tier web application with reactive frontend, REST API backend, state management, and robust verification.',
    architecture: 'fullstack-modular',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'React + Vite + Tailwind CSS v4',
    backend: 'Node API / Express',
    database: 'SQLite / PostgreSQL ready',
    styling: 'Tailwind CSS v4',
    packageManager: 'npm',
    testing: 'Build + API probe',
    linting: 'TypeScript tsc',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Vercel / Node Host',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_ARCHITECTURE.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'Smooth 60fps UI' },
    aiTooling: { enabled: false },
    requiredSkills: [
      '03_SKILLS/fullstack-ai-saas-architecture.md',
      '03_SKILLS/tailwind-v4-css-first-design.md',
      '03_SKILLS/agent-error-prevention-protocol.md'
    ],
    requiredKnowledge: ['Rule 1', 'Rule 5', 'Rule 6', 'Rule 7'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'saas': {
    id: 'saas',
    name: 'Software-as-a-Service (SaaS) Platform',
    category: 'saas',
    description: 'Production SaaS application with multi-tenant architecture, billing foundation, authentication, API layer, and dashboard UI.',
    architecture: 'fullstack-saas-modular',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'React + Vite + Tailwind CSS v4',
    backend: 'Node API Engine',
    database: 'PostgreSQL ready',
    styling: 'Tailwind CSS v4',
    packageManager: 'npm',
    testing: 'Build + Integration test suite',
    linting: 'TypeScript tsc + ESLint',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Vercel / Container',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_DECISIONS.md + PROJECT_ARCHITECTURE.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'docker'],
    seoTooling: { enabled: true },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'High concurrency, cached reads' },
    aiTooling: { enabled: false },
    requiredSkills: [
      '03_SKILLS/fullstack-ai-saas-architecture.md',
      '03_SKILLS/tailwind-v4-css-first-design.md'
    ],
    requiredKnowledge: ['Rule 1', 'Rule 2', 'Rule 5', 'Rule 7', 'Rule 8'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'micro-saas': {
    id: 'micro-saas',
    name: 'Micro-SaaS Application',
    category: 'saas',
    description: 'Hyper-focused subscription utility solving one clear problem with minimal operational overhead.',
    architecture: 'fullstack-micro-saas',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'React + Vite / Tailwind v4',
    backend: 'Node API',
    database: 'SQLite / Supabase ready',
    styling: 'Tailwind CSS v4',
    packageManager: 'npm',
    testing: 'Build + API probe',
    linting: 'TypeScript tsc',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Vercel',
    documentation: 'PROJECT_CONTEXT.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: true },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'Sub-second load' },
    aiTooling: { enabled: false },
    requiredSkills: ['03_SKILLS/fullstack-ai-saas-architecture.md'],
    requiredKnowledge: ['Rule 5', 'Rule 7'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'ai-application': {
    id: 'ai-application',
    name: 'Interactive AI Application',
    category: 'ai',
    description: 'Generative AI or machine-learning enabled interactive user application.',
    architecture: 'fullstack-ai-saas-modular',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'React + Vite + Tailwind v4',
    backend: 'Node AI Service',
    database: 'SQLite ready',
    styling: 'Tailwind CSS v4',
    packageManager: 'npm',
    testing: 'Build + AI endpoint mock probe',
    linting: 'TypeScript tsc',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Vercel',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_ARCHITECTURE.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'Streaming UI' },
    aiTooling: { enabled: true, sdk: 'AI SDK' },
    requiredSkills: [
      '03_SKILLS/fullstack-ai-saas-architecture.md',
      '03_SKILLS/universal-mcp-integration.md'
    ],
    requiredKnowledge: ['Rule 1', 'Rule 5', 'Rule 7'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'ai-agent': {
    id: 'ai-agent',
    name: 'Autonomous AI Agent System',
    category: 'ai-agent',
    description: 'Autonomous reasoning, planning, and tool-calling agent framework with persistent state and MCP connectivity.',
    architecture: 'ai-agent-engine',
    language: 'TypeScript / Node.js',
    runtime: 'Node.js',
    frontend: 'Optional Inspector UI',
    backend: 'Agent Loop Engine',
    database: 'Memory Graph + SQLite',
    styling: 'Tailwind CSS v4',
    packageManager: 'npm',
    testing: 'Agent step execution tests',
    linting: 'TypeScript tsc',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Node / Docker',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_ARCHITECTURE.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: false },
    performanceTooling: { target: 'Determinism and trace logging' },
    aiTooling: { enabled: true, agentic: true, toolCalling: true },
    requiredSkills: [
      '03_SKILLS/universal-mcp-integration.md',
      '03_SKILLS/agent-error-prevention-protocol.md'
    ],
    requiredKnowledge: ['Rule 1', 'Rule 2', 'Rule 3', 'Rule 5'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'api-backend-service': {
    id: 'api-backend-service',
    name: 'API & Backend Microservice',
    category: 'backend',
    description: 'Robust, headless backend service offering REST or GraphQL APIs, authentication, and data persistence.',
    architecture: 'api-microservice',
    language: 'TypeScript / Node.js',
    runtime: 'Node.js',
    frontend: 'none',
    backend: 'Express / Node REST API',
    database: 'PostgreSQL / SQLite ready',
    styling: 'none',
    packageManager: 'npm',
    testing: 'API route testing & HTTP 200 health probe',
    linting: 'TypeScript tsc',
    formatting: 'Prettier',
    buildSystem: 'tsc build',
    deployment: 'Container / Serverless',
    documentation: 'PROJECT_CONTEXT.md + OpenAPI specs',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'docker'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: false },
    performanceTooling: { target: 'Sub-50ms P99' },
    aiTooling: { enabled: false },
    requiredSkills: ['03_SKILLS/agent-error-prevention-protocol.md'],
    requiredKnowledge: ['Rule 1', 'Rule 5', 'Rule 7', 'Rule 8'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'heavy-web-app': {
    id: 'heavy-web-app',
    name: 'Heavy Web Application',
    category: 'fullstack',
    description: 'Complex, multi-domain web platform with rich state management, dashboards, real-time sync, and multi-tier APIs.',
    architecture: 'fullstack-ai-saas-modular',
    language: 'TypeScript',
    runtime: 'Node.js',
    frontend: 'React 19 + Vite + Tailwind v4',
    backend: 'Modular Node Service Engine',
    database: 'PostgreSQL ready',
    styling: 'Tailwind CSS v4 (@theme)',
    packageManager: 'npm',
    testing: 'Build + Live Server Probe',
    linting: 'TypeScript tsc + ESLint',
    formatting: 'Prettier',
    buildSystem: 'vite build',
    deployment: 'Vercel / Cloud Container',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_ARCHITECTURE.md + PROJECT_DECISIONS.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh', 'docker'],
    seoTooling: { enabled: true },
    accessibilityTooling: { enabled: true },
    performanceTooling: { target: 'Optimized bundle chunks, zero memory leaks' },
    aiTooling: { enabled: false },
    requiredSkills: [
      '03_SKILLS/fullstack-ai-saas-architecture.md',
      '03_SKILLS/tailwind-v4-css-first-design.md'
    ],
    requiredKnowledge: ['Rule 1', 'Rule 2', 'Rule 4', 'Rule 5', 'Rule 6', 'Rule 7'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'aiAndApiHealth', 'gitStatus'
    ]
  },

  'automation-system': {
    id: 'automation-system',
    name: 'Automation & Workflow System',
    category: 'tooling',
    description: 'Background automation pipeline, scheduled cron tasks, and integration scripts.',
    architecture: 'automation-cli-worker',
    language: 'TypeScript / Node.js / Python',
    runtime: 'Node.js',
    frontend: 'none',
    backend: 'Worker Pipeline',
    database: 'SQLite',
    styling: 'none',
    packageManager: 'npm',
    testing: 'Script dry-run and exit code verification',
    linting: 'ESLint / tsc',
    formatting: 'Prettier',
    buildSystem: 'npm run build',
    deployment: 'Server cron / GitHub Actions',
    documentation: 'PROJECT_CONTEXT.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: false },
    performanceTooling: { target: 'Low memory footprint' },
    aiTooling: { enabled: false },
    requiredSkills: ['03_SKILLS/agent-error-prevention-protocol.md'],
    requiredKnowledge: ['Rule 1', 'Rule 2', 'Rule 3'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'gitStatus'
    ]
  },

  'developer-tool': {
    id: 'developer-tool',
    name: 'Developer Tool / CLI Package',
    category: 'tooling',
    description: 'Command line interface, code generator, or library package designed for developers.',
    architecture: 'cli-package',
    language: 'TypeScript / Node.js',
    runtime: 'Node.js',
    frontend: 'none',
    backend: 'CLI Commands Engine',
    database: 'none',
    styling: 'none',
    packageManager: 'npm',
    testing: 'CLI execution and command help tests',
    linting: 'TypeScript tsc',
    formatting: 'Prettier',
    buildSystem: 'tsc build',
    deployment: 'npm registry / GitHub Releases',
    documentation: 'PROJECT_CONTEXT.md + README.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: false },
    performanceTooling: { target: 'Sub-500ms CLI startup' },
    aiTooling: { enabled: false },
    requiredSkills: ['03_SKILLS/git-github-lifecycle-skill.md'],
    requiredKnowledge: ['Rule 5', 'Rule 12'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'gitStatus'
    ]
  },

  'system-os-project': {
    id: 'system-os-project',
    name: 'System / OS Utility Project',
    category: 'system',
    description: 'Low-level system utility, OS automation daemon, or cross-platform tool.',
    architecture: 'system-daemon-or-cli',
    language: 'TypeScript / Node.js / Python',
    runtime: 'Node.js',
    frontend: 'none',
    backend: 'Daemon Service',
    database: 'none',
    styling: 'none',
    packageManager: 'npm',
    testing: 'Process spawn and signal verification',
    linting: 'ESLint',
    formatting: 'Prettier',
    buildSystem: 'npm run build',
    deployment: 'Local OS service',
    documentation: 'PROJECT_CONTEXT.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: false },
    performanceTooling: { target: 'Zero zombie processes' },
    aiTooling: { enabled: false },
    requiredSkills: ['03_SKILLS/agent-error-prevention-protocol.md'],
    requiredKnowledge: ['Rule 2', 'Rule 12'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'gitStatus'
    ]
  },

  'custom-unknown': {
    id: 'custom-unknown',
    name: 'Custom / Adaptive Project',
    category: 'custom',
    description: 'Custom project whose stack is determined strictly through requirements analysis rather than predetermined assumptions.',
    architecture: 'adaptive-requirements-first',
    language: 'Determined by requirements',
    runtime: 'Determined by requirements',
    frontend: 'Determined by requirements',
    backend: 'Determined by requirements',
    database: 'Determined by requirements',
    styling: 'Determined by requirements',
    packageManager: 'npm',
    testing: 'Live build and verification',
    linting: 'Standard',
    formatting: 'Standard',
    buildSystem: 'Dynamic build',
    deployment: 'Determined by requirements',
    documentation: 'PROJECT_CONTEXT.md + PROJECT_REQUIREMENTS.md + PROJECT_ARCHITECTURE.md',
    blueprint: 'fullstack-ai-saas',
    requiredTools: ['node', 'npm', 'git'],
    optionalTools: ['gh'],
    seoTooling: { enabled: false },
    accessibilityTooling: { enabled: false },
    performanceTooling: { target: 'Verified against requirements' },
    aiTooling: { enabled: false },
    requiredSkills: ['03_SKILLS/agent-error-prevention-protocol.md'],
    requiredKnowledge: ['Rule 5', 'Rule 6'],
    requiredWorkflows: ['04_WORKFLOWS/project-factory-workflow.md'],
    verificationPillars: [
      'brainBridge', 'environment', 'contextAndGovernance', 'architecture', 'build', 'runtime', 'gitStatus'
    ]
  }
};

/**
 * Detects the project class from CLI flags, prompt intent, or user description.
 */
export function detectProjectClass(inputs = {}) {
  const { type, intent, prompt, description, name } = inputs;

  // 1. Direct type match if specified
  if (type && PROJECT_CLASSES[type]) {
    return PROJECT_CLASSES[type];
  }

  // 2. Keyword matching across all text inputs
  const combinedText = [type, intent, prompt, description, name].filter(Boolean).join(' ').toLowerCase();

  if (/\b(adsense|seo|micro\s*website|affiliate|niche|blog|content\s*site)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['seo-adsense-micro-website'];
  }

  if (/\b(protractor|calculator|converter|single\s*page\s*tool|canvas\s*tool|geometry)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['single-page-tool-website'];
  }

  if (/\b(micro\s*tool|utilities\s*hub|tools\s*collection)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['micro-tool-website'];
  }

  if (/\b(ai\s*saas|ai\s*platform|ai\s*subscription|llm\s*saas|rag\s*saas)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['ai-saas'];
  }

  if (/\b(ai\s*agent|autonomous\s*agent|agentic|tool\s*calling\s*agent)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['ai-agent'];
  }

  if (/\b(ai\s*app|ai\s*application|generative\s*ai|llm\s*app|chatbot)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['ai-application'];
  }

  if (/\b(micro\s*saas|indie\s*saas)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['micro-saas'];
  }

  if (/\b(saas|subscription\s*platform|multi\s*tenant)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['saas'];
  }

  if (/\b(api\s*backend|microservice|rest\s*api|graphql\s*api|backend\s*service)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['api-backend-service'];
  }

  if (/\b(heavy\s*web|enterprise\s*web|dashboard\s*platform|complex\s*portal)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['heavy-web-app'];
  }

  if (/\b(fullstack|full-stack|frontend\s*and\s*backend|react\s*node)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['fullstack-web-app'];
  }

  if (/\b(automation|cron|worker\s*queue|workflow\s*engine|scraper)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['automation-system'];
  }

  if (/\b(cli|developer\s*tool|npm\s*package|library|generator)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['developer-tool'];
  }

  if (/\b(system\s*tool|os\s*service|daemon|kernel|low\s*level)\b/i.test(combinedText)) {
    return PROJECT_CLASSES['system-os-project'];
  }

  // 3. Fallback: If text is provided but doesn't map to a standard class, or no text provided
  if (combinedText.trim().length > 0) {
    // If it mentions Astro explicitly, use seo-adsense
    if (combinedText.includes('astro')) {
      return PROJECT_CLASSES['seo-adsense-micro-website'];
    }
    // If it mentions React or Fullstack or AI, use AI SaaS
    if (combinedText.includes('react') || combinedText.includes('ai') || combinedText.includes('saas')) {
      return PROJECT_CLASSES['ai-saas'];
    }
  }

  // Pure default for unspecified empty run
  return PROJECT_CLASSES['seo-adsense-micro-website'];
}

/**
 * Resolves the complete, validated project profile combining detected class,
 * MCPs, skills, knowledge, and overrides.
 */
export function resolveProjectProfile(inputs = {}) {
  const baseClass = detectProjectClass(inputs);
  const profile = JSON.parse(JSON.stringify(baseClass));

  // Resolve applicable MCPs from canonical MCP registry
  profile.applicableMCPs = resolveApplicableMCPs(profile.id);

  // Apply user-defined overrides if supplied
  if (inputs.overrides) {
    Object.assign(profile, inputs.overrides);
  }

  return profile;
}
