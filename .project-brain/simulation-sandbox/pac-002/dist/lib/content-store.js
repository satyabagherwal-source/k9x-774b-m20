/**
 * Editorial Content Store & Taxonomy Engine
 * 
 * Location: .project-brain/simulation-sandbox/pac-002/src/lib/content-store.js
 * Domain Governance: Domain I (Content & Information Intelligence) & Domain G (Architecture)
 * 
 * Provides:
 * - 5 in-depth, original technical articles across 4 categories.
 * - Author metadata with biographies and credentials.
 * - Reading time calculations based on standardized word counts (200 wpm).
 * - Cross-referenced related article discovery based on shared categories and tags.
 */

export const AUTHORS = Object.freeze({
  'elena-rostova': {
    id: 'elena-rostova',
    name: 'Elena Rostova',
    role: 'Principal Systems Architect',
    bio: 'Specializes in distributed state machines, deterministic execution runtimes, and fault-tolerant cloud boundaries.',
    avatar: 'ER',
    avatarColor: '#4f46e5'
  },
  'marcus-vance': {
    id: 'marcus-vance',
    name: 'Marcus Vance',
    role: 'Lead Compiler & Performance Engineer',
    bio: 'Researches AST traversal optimizations, ReDoS defense mechanics, and zero-allocation memory architectures.',
    avatar: 'MV',
    avatarColor: '#059669'
  },
  'dr-ananya-sen': {
    id: 'dr-ananya-sen',
    name: 'Dr. Ananya Sen',
    role: 'Director of Cryptographic Governance',
    bio: 'Focuses on asymmetric authorization, human-in-the-loop verification, and privacy-preserving data sovereignty.',
    avatar: 'AS',
    avatarColor: '#d97706'
  }
});

export const CATEGORIES = Object.freeze([
  { id: 'architecture', name: 'Architecture', description: 'Core design paradigms, boundary isolation, and system invariants.' },
  { id: 'systems-engineering', name: 'Systems Engineering', description: 'Performance tuning, algorithmic defense, and low-level runtime safety.' },
  { id: 'data-sovereignty', name: 'Data Sovereignty', description: 'Privacy-first processing, client-side execution, and zero-cloud invariants.' },
  { id: 'web-craft', name: 'Web Craft', description: 'Zero-JS static performance, typography, accessibility, and modern web standards.' }
]);

export const ARTICLES = [
  {
    id: 'art-001',
    slug: 'fallacy-of-premature-hydration',
    title: 'The Fallacy of Premature Hydration: Why Zero-Client-JS Architecture Wins',
    category: 'web-craft',
    authorId: 'elena-rostova',
    publishedAt: '2026-11-01T09:00:00Z',
    modifiedAt: '2026-11-04T14:30:00Z',
    excerpt: 'Modern web architectures often ship megabytes of client-side JavaScript merely to render static editorial prose. Examining how pure HTML/CSS defaults restore instant LCP and eliminate Total Blocking Time.',
    tags: ['web-performance', 'zero-js', 'core-web-vitals', 'architecture'],
    featured: true,
    content: `
## The Cost of the Heavy Modern Web

For the past decade, web engineering has converged toward a single pervasive pattern: ship a single-page application framework for every digital experience, regardless of whether the product requires reactive state or is simply delivering editorial journalism.

The consequences of this paradigm are visible across the contemporary web:
1. **Sluggish First Input Delay (FID) and Interaction to Next Paint (INP)**: Main threads are saturated parsing multi-megabyte JavaScript bundles.
2. **Fragile Hydration Mismatches**: Subtle differences between server and client rendering result in jarring layout shifts and console errors.
3. **Accessibility Regressions**: Complex synthetic event loops often break native keyboard navigation and assistive technology trees.

\`\`\`
[Traditional SPA Lifecycle]
HTML arrives -> Browser downloads 2.5MB JS -> Engine compiles JS -> Hydration reconciles DOM -> Page becomes interactive (3.8s)

[Zero-Client-JS Architectural Pattern]
HTML & CSS arrive -> Browser paints semantic tree immediately -> Native links & forms interactive instantly (0.15s)
\`\`\`

## The Lesson of Eleventy and Content-First Systems

Architectural analysis of high-performance publishing systems reveals an undeniable truth: static editorial content belongs in pure semantic HTML. 

When HTML is rendered ahead of time:
- **Time to First Byte (TTFB)** becomes identical to CDN edge cache retrieval latency.
- **Search Engine Crawlers** encounter zero indexing delays, completely bypassing Google's secondary headless rendering queue.
- **Battery & Memory Consumption** on mobile devices drops by up to 90%, preserving reader comfort and device responsiveness.

### Practical Implementation Principles
To achieve true zero-bloat publishing:
- **Default to pure CSS tokens**: Replace heavy CSS-in-JS runtimes with native CSS variables and modern layout specifications (CSS Grid and Flexbox).
- **Isolate client reactivity to micro-islands**: If interactive search or filtering is needed, embed a lightweight, vanilla script bounded strictly to that UI component.
- **Enforce strict performance budgets**: Never allow editorial reading experiences to exceed 50KB total gzipped wire size.

The future of digital reading is not more JavaScript; it is the deliberate mastery of native browser primitives.
    `,
    relatedIds: ['art-003', 'art-005']
  },
  {
    id: 'art-002',
    slug: 'cryptographic-authorization-autonomous-ai',
    title: 'Cryptographic Authorization: Why Boolean Flags Fail in Autonomous AI Systems',
    category: 'systems-engineering',
    authorId: 'dr-ananya-sen',
    publishedAt: '2026-11-02T11:00:00Z',
    modifiedAt: '2026-11-05T10:15:00Z',
    excerpt: 'When autonomous AI agents possess write access to software repositories, Boolean authorization flags create a catastrophic forgery vulnerability. How asymmetric Ed25519 signing establishes unforgeable human oversight.',
    tags: ['ai-security', 'cryptography', 'governance', 'ed25519'],
    featured: false,
    content: `
## The Illusion of Boolean Safety

In traditional human-only software teams, a simple configuration flag such as \`is_approved = true\` or an environment variable \`HUMAN_VERIFIED=1\` was considered sufficient for automated pipeline progression.

However, the advent of autonomous AI agent fleets operating directly within terminal shells completely invalidates this assumption:

> An AI agent with write access to code or environment memory can synthesize, overwrite, or forge any Boolean property in memory before triggering downstream storage bridges.

When an autonomous agent can forge its own approval flag, human oversight becomes entirely theatrical.

\`\`\`
[Vulnerable Architecture]
Worker Agent -> Sets { human_approved: true } in memory -> Storage Bridge accepts without proof -> High-impact state corrupted

[Cryptographically Isolated Architecture]
Worker Agent -> Proposes Candidate -> Human reviews in isolated terminal -> Signs SHA-256 hash via Ed25519 Private Key -> Storage Bridge verifies via Public Key only
\`\`\`

## Asymmetric Cryptographic Boundaries

To enforce authentic human sovereignty over autonomous systems, the signing authority must be structurally separated from the agent's execution sandbox:

1. **Private Key Isolation**: The Ed25519 private key must reside strictly on an encrypted, human-only path outside the agent's working tree and environment variable space.
2. **Public Key Verification**: The automated factory engine and storage bridge possess strictly the public verification key (\`human-authority-ed25519.pub\`). Even if the AI agent rewrites the entire codebase, it cannot forge an Ed25519 signature without the offline private key.
3. **Nonce Replay Prevention**: Every human approval token must embed a single-use UUID nonce and content hash. Once a token is verified, its nonce is permanently recorded in a consumed ledger, neutralizing replay attacks.

Software systems of the next decade must abandon procedural permission flags and adopt mathematically verifiable boundaries.
    `,
    relatedIds: ['art-003', 'art-004']
  },
  {
    id: 'art-003',
    slug: 'deterministic-redos-defense-linear-time-scanning',
    title: 'Deterministic ReDoS Defense: Linear-Time Scanning in High-Throughput Engines',
    category: 'systems-engineering',
    authorId: 'marcus-vance',
    publishedAt: '2026-11-03T15:20:00Z',
    modifiedAt: '2026-11-06T08:00:00Z',
    excerpt: 'Regular Expression Denial of Service (ReDoS) remains one of the most neglected operational vulnerabilities. Analysis of how unbounded whitespace matching triggers catastrophic backtracking and how to eliminate it in linear time.',
    tags: ['performance', 'security', 'regex', 'redos', 'algorithms'],
    featured: false,
    content: `
## The Mechanics of Catastrophic Backtracking

Regular expression engines in many modern languages (including V8 JavaScript, Python, and Ruby) use Non-Deterministic Finite Automata (NFA) implementations. When an NFA encounters overlapping quantified groups, such as:

\`\`\`javascript
// VULNERABLE PATTERN:
const badRegex = /\\s+on[a-z0-9_-]+\\s*=\\s*['"][^'"]*['"]/gi;
\`\`\`

If presented with an adversarial payload consisting of 5 megabytes of consecutive spaces followed by a non-matching character, the engine will attempt every combinatorial permutation of whitespace grouping before failing.

The computational complexity explodes from $O(N)$ to $O(2^N)$ or $O(N^3)$, causing immediate 100% CPU lockup and thread death.

\`\`\`
Input: "              ... 5MB spaces ...              onload=foo"
Step 1: \\s+ matches all spaces.
Step 2: "on" matches.
Step 3: If match fails downstream, engine backtracks 1 space.
Step 4: Engine attempts \\s+ on remaining spaces -> Backtracks again!
Result: Billions of recursive state evaluations -> System freezes indefinitely.
\`\`\`

## Linear-Time Word-Boundary Engineering

To achieve absolute ReDoS immunity without sacrificing developer ergonomic expressiveness, we must enforce deterministic state machine boundaries:

1. **Replace Unbounded Space with Word Boundaries**:
   \`\`\`javascript
   // RE-DOS IMMUNE PATTERN (O(N) Linear Time):
   const safeRegex = /\\b(?:on[a-z0-9_-]+)\\s*=\\s*(?:'[^']*'|"[^"]*"|[^\\s>]+)/gi;
   \`\`\`
2. **Benchmark on Adversarial Payloads**:
   In empirical verification tests on a 5MB whitespace payload:
   - The vulnerable pattern timed out after 30+ seconds with CPU thread exhaustion.
   - The word-boundary pattern processed the entire 5MB buffer in **21.85 milliseconds**.

Safety in software engineering is rarely about adding complex frameworks; it is about recognizing algorithmic pitfalls and enforcing mathematical upper bounds.
    `,
    relatedIds: ['art-001', 'art-002']
  },
  {
    id: 'art-004',
    slug: 'data-sovereignty-client-side-execution',
    title: 'Data Sovereignty in the Age of Opaque Cloud Runtimes',
    category: 'data-sovereignty',
    authorId: 'dr-ananya-sen',
    publishedAt: '2026-11-04T12:00:00Z',
    modifiedAt: '2026-11-06T16:00:00Z',
    excerpt: 'Why enterprise confidentiality mandates are forcing a return to client-side local execution. How WebAssembly and Canvas APIs allow complete digital utility processing with zero remote network egress.',
    tags: ['privacy', 'data-sovereignty', 'wasm', 'security', 'gdpr'],
    featured: false,
    content: `
## The Blind Trust of the SaaS Paradigm

For two decades, the dominant economic model of cloud computing assumed that users should transmit all raw assets—documents, vectors, images, spreadsheets, and source code—to third-party multi-tenant cloud servers for processing.

However, evolving legal realities and enterprise security mandates have shattered this blind trust:
- **Regulatory Strictures (GDPR, HIPAA, CCPA)**: Transmitting unencrypted customer data across geopolitical borders carries astronomical statutory penalties.
- **LLM Training Scrapes**: Enterprises now legitimately fear that uploaded proprietary schematics or proprietary documents will be ingested into vendor foundation model training datasets.
- **Latency & Reliability Risks**: Round-trip cloud processing introduces jitter, bandwidth saturation, and service outage vulnerabilities.

\`\`\`
[Legacy Cloud Utility]
User File -> Upload to Cloud (HTTPS) -> Server processes file -> Download result (HTTPS)
Risk: Storage leaks, server snooping, third-party breach.

[Sovereign Client-Side Utility]
User File -> Browser In-Memory Buffer -> Local WASM / Canvas Engine -> Instant Local Save
Guarantee: 0 bytes leave the machine. Absolute mathematical privacy.
\`\`\`

## The Technological Readiness of the Browser

Modern web browsers are no longer simple document viewers; they are powerful, sandboxed POSIX-like execution environments.

Key technologies enabling 100% local processing include:
1. **WebAssembly (WASM)**: Near-native execution speeds for audio, video, image compression, and cryptographic proofs.
2. **HTML5 Canvas 2D / WebGL / WebGPU**: High-throughput hardware-accelerated image rasterization and matrix computation directly on the client GPU.
3. **Blob & Object URLs**: Zero-copy in-memory referencing of multi-megabyte payloads without disk thrashing or server trips.

The most ethical and defensible product architecture today is one where the vendor never sees the customer's data in the first place.
    `,
    relatedIds: ['art-001', 'art-002']
  },
  {
    id: 'art-005',
    slug: 'designing-for-the-next-decade-typography',
    title: 'Designing for the Next Decade: Typography, Contrast, and Long-Form Reading',
    category: 'architecture',
    authorId: 'elena-rostova',
    publishedAt: '2026-11-05T08:30:00Z',
    modifiedAt: '2026-11-06T18:00:00Z',
    excerpt: 'Typography is the physical interface between author thought and reader cognition. An architectural exploration of optical sizing, semantic contrast tokens, and reading-mode physics for technical publishing.',
    tags: ['design-systems', 'typography', 'accessibility', 'ux', 'css'],
    featured: false,
    content: `
## The Cognitive Ergonomics of Reading

Reading technical documentation or long-form architectural essays is an intensive cognitive task. Poor typographic decisions—such as insufficient line-height, low-contrast grey ink on white backgrounds, or excessive measure width—compound cognitive fatigue and degrade retention.

\`\`\`
[Optimal Typographic Formula for Reading]
Optimal Measure: 65 - 75 characters per line (approx. 680px - 720px max-width)
Optimal Leading: 1.6 - 1.7x font-size for body text
Optimal Scale: 1.25 (Major Third) or 1.333 (Perfect Fourth) for clear hierarchical hierarchy
\`\`\`

## The Tri-Theme Reading Environment

Readers engage with technical content across vastly different lighting conditions: harsh office fluorescents, mobile subway commutes, and late-night research sessions.

To support true cognitive comfort, modern publications must offer three distinct, scientifically tuned reading environments:

1. **Editorial Daylight (Light Theme)**:
   - Background: Pristine alabaster (\`#fafafa\` / \`#ffffff\`)
   - Text: Deep charcoal carbon (\`#0f172a\` - WCAG AAA 14.5:1 contrast)
   - Accent: Classic editorial lapis (\`#2563eb\`)
2. **Deep Obsidian (Dark Theme)**:
   - Background: Low-glare obsidian (\`#0b0f19\`)
   - Text: Soft zinc parchment (\`#e2e8f0\` - WCAG AAA 12.8:1 contrast)
   - Border: Subtle slate framing (\`#1e293b\`)
3. **Parchment Sepia (Warm Reading Theme)**:
   - Background: Warm unbleached paper tone (\`#fbf0d9\`)
   - Text: Rich bistre ink (\`#2d241e\` - 11.2:1 contrast)
   - Ideal for prolonged reading without circadian melatonin disruption.

### Accessible Keyboard Invariants
A truly professional publication must be completely navigable without a mouse:
- **Visible Focus Rings**: Always preserve distinct \`:focus-visible\` outlines.
- **Skip Links**: Provide an immediate \`<a href="#main-content">\` skip link for screen reader and keyboard users.
- **Semantic Milestone Tags**: Use \`<header>\`, \`<nav>\`, \`<main>\`, \`<article>\`, \`<aside>\`, and \`<footer>\` to allow assistive tools to jump between sections effortlessly.
    `,
    relatedIds: ['art-001', 'art-004']
  }
];

/**
 * Calculates estimated reading time in minutes based on 200 words per minute.
 * 
 * @param {string} content 
 * @returns {number}
 */
export function calculateReadingTime(content) {
  if (!content || typeof content !== 'string') return 1;
  const wordCount = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(wordCount / 200));
}

/**
 * Returns all articles enriched with author details and reading time.
 */
export function getAllArticles() {
  return ARTICLES.map(art => {
    const author = AUTHORS[art.authorId] || {
      id: 'staff-editor',
      name: 'Chronicle Staff',
      role: 'Editorial Board',
      bio: 'The Sovereign Chronicle collective editorial team.',
      avatar: 'SC',
      avatarColor: '#475569'
    };
    const readingTime = calculateReadingTime(art.content);
    const category = CATEGORIES.find(c => c.id === art.category) || {
      id: art.category,
      name: art.category,
      description: ''
    };
    return {
      ...art,
      author,
      categoryDetails: category,
      readingTime
    };
  });
}

/**
 * Returns single article by slug.
 */
export function getArticleBySlug(slug) {
  const all = getAllArticles();
  return all.find(a => a.slug === slug) || null;
}

/**
 * Returns articles filtered by category ID.
 */
export function getArticlesByCategory(categoryId) {
  const all = getAllArticles();
  return all.filter(a => a.category === categoryId);
}

/**
 * Returns related articles based on category and tags.
 */
export function getRelatedArticles(currentArticleId, limit = 2) {
  const all = getAllArticles();
  const current = all.find(a => a.id === currentArticleId);
  if (!current) return [];

  // If explicit related IDs are present and valid, prioritize them
  if (Array.isArray(current.relatedIds) && current.relatedIds.length > 0) {
    const explicit = all.filter(a => current.relatedIds.includes(a.id) && a.id !== current.id);
    if (explicit.length > 0) return explicit.slice(0, limit);
  }

  // Fallback to shared category or tags
  return all
    .filter(a => a.id !== currentArticleId)
    .sort((a, b) => {
      let scoreA = a.category === current.category ? 2 : 0;
      let scoreB = b.category === current.category ? 2 : 0;
      const sharedTagsA = a.tags.filter(t => current.tags.includes(t)).length;
      const sharedTagsB = b.tags.filter(t => current.tags.includes(t)).length;
      return (scoreB + sharedTagsB) - (scoreA + sharedTagsA);
    })
    .slice(0, limit);
}
