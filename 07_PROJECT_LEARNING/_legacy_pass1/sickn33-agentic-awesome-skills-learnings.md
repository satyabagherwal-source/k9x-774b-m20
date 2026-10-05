# Forensic Learning Record (Deep Inspection): sickn33/agentic-awesome-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/sickn33-agentic-awesome-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:02:39.235Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sickn33/agentic-awesome-skills`
- **Description**: AAS Core is the local, agent-first control plane for complete catalog discovery, agent-owned selection, stack validation, and planning, backed by 2,400+ agentic skills. Includes CLI, local MCP, catalog, plugins, and Workbench.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 47103 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web-app/eslint.config.js`
```
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'public/skills/**']),
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        projectService: true,
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])

```

### Core Architecture Module: `apps/web-app/postcss.config.js`
```
export default {
    plugins: {
        '@tailwindcss/postcss': {},
        autoprefixer: {},
    },
}

```

### Core Architecture Module: `apps/web-app/refresh-skills-plugin.d.ts`
```
import type { Plugin } from 'vite';

export default function refreshSkillsPlugin(): Plugin;

```

### Core Architecture Module: `apps/web-app/refresh-skills-plugin.js`
```
import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import crypto from 'crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const { resolveSafeRealPath } = require('../../tools/lib/symlink-safety');
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const UPSTREAM_REPO = 'https://github.com/sickn33/agentic-awesome-skills.git';
const UPSTREAM_NAME = 'upstream';
const REPO_TAR_URL = 'https://github.com/sickn33/agentic-awesome-skills/archive/refs/heads/main.tar.gz';
const REPO_ZIP_URL = 'https://github.com/sickn33/agentic-awesome-skills/archive/refs/heads/main.zip';
const COMMITS_API_URL = 'https://api.github.com/repos/sickn33/agentic-awesome-skills/commits/main';
const SHA_FILE = path.join(__dirname, '.last-sync-sha');
const ARCHIVE_ROOT = 'agentic-awesome-skills-main/';
const SAFE_SKILL_ASSET_RE = /^\/skills\/[A-Za-z0-9._/-]+$/;
const REFRESH_RATE_LIMIT_MS = 30_000;
const STATIC_RATE_LIMIT_MS = 25;

// ─── Utility helpers ───

const MIME_TYPES = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.yaml': 'text/yaml', '.yml': 'text/yaml', '.xml': 'text/xml',
    '.py': 'text/plain', '.sh': 'text/plain', '.bat': 'text/plain',
};

/** Check if git is available on this system. Cached after first check. */
let _gitAvailable = null;
function isGitAvailable() {
    if (_gitAvailable !== null) return _gitAvailable;
    try {
        execSync('git --version', { stdio: 'ignore' });
        // Also check we're inside a git repo
        execSync('git rev-parse --git-dir', { cwd: ROOT_DIR, stdio: 'ignore' });
        _gitAvailable = true;
    } catch {
        _gitAvailable = false;
    }
    return _gitAvailable;
}

function normalizeHost(hostValue = '') {
    return String(hostValue).trim().toLowerCase().replace(/^\[|\]$/g, '');
}

function isLoopbackHost(hostname) {
    const host = normalizeHost(hostname);
    return host === 'localhost'
        || host === '::1'
        || host.startsWith('127.');
}

function isLoopbackRemoteAddress(remoteAddress) {
    const address = normalizeHost(remoteAddress);
    return address === '::1'
        || address.startsWith('127.')
        || address.startsWith('::ffff:127.');
}

function getRequestHost(req) {
    const hostHeader = req.headers?.host || '';

    if (!hostHeader) {
        return '';
    }

    try {
        return new URL(`http://${hostHeader}`).hostname;
    } catch {
        return normalizeHost(hostHeader);
    }
}

function getRequestRemoteAddress(req) {
    return req.socket?.remoteAddress || req.connection?.remoteAddress || '';
}

function isDevLoopbackRequest(req) {
    return isLoopbackRemoteAddress(getRequestRemoteAddress(req));
}

function isTokenAuthorized(req) {
    const expectedToken = (process.env.SKILLS_REFRESH_TOKEN || '').trim();

    if (!expectedToken) {
        return true;
    }

    const providedToken = req.headers?.['x-skills-refresh-token'];
    if (typeof providedToken !== 'string' || !providedToken) {
        return false;
    }

    const expected = Buffer.from(expectedToken);
    const provided = Buffer.from(providedToken);

    if (expected.length !== provided.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, provided);
}

function isLocalSyncEnabled() {
    return process.env.ENABLE_LOCAL_SKILLS_SYNC === 'true';
}

function isPathInside(parentPath, childPath) {
    const relative = path.relative(parentPath, childPath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getSafeSkillAssetPath(url = '') {
    let pathname;
    try {
        pathname = new URL(url, 'http://localhost').pathname;
    } catch {
        return null;
    }
    if (!SAFE_SKILL_ASSET_RE.test(pathname)) return null;
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'skills' || parts.some((part) => part === '.' || part === '..')) return null;
    return path.join(ROOT_DIR, ...parts);
}

const staticRateLimit = rateLimit({
    windowMs: STATIC_RATE_LIMIT_MS,
    limit: 1,
    standardHeaders: false,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => `${ipKeyGenerator(getRequestRemoteAddress(req) || '127.0.0.1')}:${req.url || ''}`,
    handler: (_req, res) => {
        res.statusCode = 429;
        res.end('Rate limit exceeded');
    },
});

const refreshRateLimit = rateLimit({
    windowMs: REFRESH_RATE_LIMIT_MS,
    limit: 1,
    standardHeaders: false,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    keyGenerator: (req) => ipKeyGenerator(getRequestRemoteAddress(req) || '127.0.0.1'),
    handler: (_req, res) => {
        res.statusCode = 429;
        res.end(JSON.stringify({ success: false, error: 'Refresh rate limit exceeded' }));
    },
});

function normalizeArchiveEntryName(entryName) {
    return String(entryName || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function validateArchiveEntryName(entryName) {
    const normalized = normalizeArchiveEntryName(entryName);
    const parts = normalized.split('/').filter(Boolean);

    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        return false;
    }
    if (path.isAbsolute(normalized) || parts.some((part) => part === '..' || part === '.')) {
        return false;
    }
    return normalized === ARCHIVE_ROOT.slice(0, -1) || normalized.startsWith(ARCHIVE_ROOT);
}

function archiveEntryName(entry) {
    return typeof entry === 'string' ? entry : entry?.name;
}

function archiveEntryType(entry) {
    return typeof entry === 'string' ? '' : String(entry?.type || '');
}

function assertSafeArchiveEntries(entries, { rejectLinks = false, rejectSymlinks = rejectLinks } = {}) {
    for (const rawEntry of entries) {
        const entry = String(archiveEntryName(rawEntry) || '').trim();
        if (!entry) continue;
        const entryType = archiveEntryType(rawEntry);
        if (rejectSymlinks && typeof rawEntry === 'string' && /\s+->\s+/.test(entry)) {
            throw new Error(`Unsafe archive symlink entry: ${entry}`);
        }
        if (rejectLinks && (entryType === '1' || entryType === '2')) {
            throw new Error(`Unsafe archive link entry: ${entry}`);
        }
        if (!validateArchiveEntryName(entry)) {
            throw new Error(`Unsafe archive entry path: ${entry}`);
        }
    }
}

function readTarString(block, start, length) {
    const bytes = block.subarray(start, start + length);
    const end = bytes.indexOf(0);
    return bytes.subarray(0, end === -1 ? bytes.length : end).toString('utf8');
}

function readTarNumber(block, start, length) {
    const raw = readTarString(block, start, length).trim();
    return raw ? Number.parseInt(raw.replace(/\0/g, '').trim(), 8) || 0 : 0;
}

function parsePaxRecords(buffer) {
    const records = {};
    let offset = 0;

    while (offset < buffer.length) {
        const space = buffer.indexOf(0x20, offset);
        if (space === -1) break;
        const length = Number.parseInt(buffer.subarray(offset, space).toString('ascii'), 10);
        if (!Number.isInteger(length) || length <= 0 || offset + length > buffer.length) break;
        const record = buffer.subarray(space + 1, offset + length - 1).toString('utf8');
        const equals = record.indexOf('=');
        if (equals > 0) {
            records[record.slice(0, equals)] = record.slice(equals + 1);
        }
        offset += length;

```

### Core Architecture Module: `apps/web-app/scripts/generate-sitemap.js`
```
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocsMetadata, readReproducibleLastmod } from './docs-metadata.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SKILLS_JSON = path.join(PUBLIC_DIR, 'skills.json');
const SEO_LANDING_PAGES_JSON = path.join(ROOT_DIR, 'src', 'data', 'seoLandingPages.json');
const OUTPUT_PATH = path.join(PUBLIC_DIR, 'sitemap.xml');
const BASE_PATH =
  (process.env.VITE_BASE_PATH || '/').trim().replace(/\/+$/, '');
const NORMALIZED_BASE_PATH = BASE_PATH && BASE_PATH !== '/' ? BASE_PATH : '';
const DEFAULT_SITE_URL = 'https://aaskills.tech';

const SITE_URL = (process.env.SEO_SITE_URL || process.env.WEBSITE_BASE_URL || DEFAULT_SITE_URL).replace(/\/$/, '');
// Keep this curated: broad enough to form a crawlable catalog, well below the
// full library so thin/low-signal detail pages are not mass-submitted.
export const DEFAULT_TOP_SKILL_COUNT = 180;
const TOP_SKILL_COUNT = Number.parseInt(process.env.TOP_SKILL_COUNT || String(DEFAULT_TOP_SKILL_COUNT), 10);
// Derived from repository history rather than the wall clock: a wall-clock date
// makes every canonical-sync PR drift when the preview job runs on a later day.
const DEFAULT_LASTMOD = readReproducibleLastmod();

function getTopSkillCount() {
  return Number.isFinite(TOP_SKILL_COUNT) ? Math.max(TOP_SKILL_COUNT, 0) : DEFAULT_TOP_SKILL_COUNT;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getDateScore(dateValue) {
  if (!dateValue) return 0;

  const parsed = Date.parse(dateValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeSkillId(skillId) {
  return encodeURIComponent(String(skillId).trim());
}

function toIndexableRoutePath(pathName) {
  const normalized = String(pathName || '/').trim();
  if (!normalized || normalized === '/') {
    return '/';
  }

  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function selectTopSkillEntries(skills, topCount = TOP_SKILL_COUNT) {
  const max = Math.max(Number.parseInt(topCount, 10) || 0, 0);
  if (!Array.isArray(skills) || max === 0) {
    return [];
  }

  const sorted = [...skills]
    .map((skill, index) => ({
      id: skill.id,
      index,
      stars: Number(skill?.stars) || 0,
      date: getDateScore(skill?.date_added),
    }))
    .filter((item) => Boolean(item.id))
    .sort((a, b) => {
      if (a.stars !== b.stars) return b.stars - a.stars;
      if (a.date !== b.date) return b.date - a.date;

      const nameCompare = String(a.id).localeCompare(String(b.id), undefined, { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;

      return a.index - b.index;
    })
    .slice(0, max);

  const dedupedEntries = [];
  const seen = new Set();

  for (const item of sorted) {
    if (!item.id || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    dedupedEntries.push(`/skill/${normalizeSkillId(item.id)}`);
    if (dedupedEntries.length >= max) {
      break;
    }
  }

  return dedupedEntries;
}

export function getSeoLandingPaths() {
  if (!fs.existsSync(SEO_LANDING_PAGES_JSON)) {
    return [];
  }

  const raw = fs.readFileSync(SEO_LANDING_PAGES_JSON, 'utf-8');
  const pages = JSON.parse(raw);

  if (!Array.isArray(pages)) {
    return [];
  }

  return pages
    .map((page) => String(page?.slug || '').trim())
    .filter(Boolean)
    .map((slug) => toIndexableRoutePath(`/topics/${encodeURIComponent(slug)}`));
}

export function generateSitemapXml({ baseUrl, paths, lastmod = DEFAULT_LASTMOD, modifiedByPath = {} }) {
  const normalizedBase = String(baseUrl).replace(/\/$/, '');
  const uniquePaths = [...new Set(paths.map(toIndexableRoutePath))];

  const urlsXml = uniquePaths
    .map((pathName) => {
      const href = `${normalizedBase}${pathName}`;
      return `  <url>\n    <loc>${escapeXml(href)}</loc>\n    <lastmod>${escapeXml(modifiedByPath[pathName] || lastmod)}</lastmod>\n    <changefreq>${pathName === '/' ? 'daily' : 'weekly'}</changefreq>\n    <priority>${pathName === '/' ? '1.0' : '0.7'}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`;
}

function readSkillsCatalog() {
  if (!fs.existsSync(SKILLS_JSON)) {
    throw new Error(`Skills catalog not found at ${SKILLS_JSON}`);
  }

  const raw = fs.readFileSync(SKILLS_JSON, 'utf-8');
  return JSON.parse(raw);
}

export function buildSitemap(skills, topCount = TOP_SKILL_COUNT, baseUrl = SITE_URL) {
  const topSkillPaths = selectTopSkillEntries(skills, topCount);
  const landingPaths = getSeoLandingPaths();
  return generateSitemapXml({
    baseUrl,
    modifiedByPath: Object.fromEntries(Object.entries(getDocsMetadata()).map(([slug, meta]) => [toIndexableRoutePath(`/docs/${slug}/`), meta.modified.slice(0, 10)])),
    paths: [
      '/',
      toIndexableRoutePath('/core'),
      toIndexableRoutePath('/workbench'),
      toIndexableRoutePath('/plugins'),
      '/docs/',
      ...JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'src/data/docs.json'), 'utf8')).map((doc) => `/docs/${doc.slug}/`),
      ...landingPaths,
      ...topSkillPaths.map(toIndexableRoutePath),
    ],
  });
}

function writeSitemap() {
  const skills = readSkillsCatalog();
  const xml = buildSitemap(skills, getTopSkillCount(), SITE_URL);
  fs.writeFileSync(OUTPUT_PATH, xml, 'utf-8');
  console.log(`sitemap.xml generated at ${OUTPUT_PATH}`);
}

if (process.argv[1] && process.argv[1].endsWith('generate-sitemap.js')) {
  writeSitemap();
}

```

### Core Architecture Module: `apps/web-app/scripts/prerender-routes.js`
```
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectTopSkillEntries } from './generate-sitemap.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { getDocsMetadata } from './docs-metadata.js';
import { remarkHeadings } from '../src/utils/markdownHeadings.js';
import remarkGfm from 'remark-gfm';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const TEMPLATE_PATH = path.join(DIST_DIR, 'index.html');
const SKILLS_PATH = path.join(PUBLIC_DIR, 'skills.json');
const SEO_LANDING_PAGES_PATH = path.join(ROOT_DIR, 'src', 'data', 'seoLandingPages.json');

const HOME_CATALOG_COUNT_FALLBACK = 1969;
const PRERENDER_SOCIAL_IMAGE = 'social-card.png';
const SITE_NAME = 'Agentic Awesome Skills';
const REPOSITORY_URL = 'https://github.com/sickn33/agentic-awesome-skills';
const HOSTED_CATALOG_URL = 'https://aaskills.tech/';
const FAQ_ITEMS = [
  {
    question: 'What is Agentic Awesome Skills?',
    answer: (countLabel) =>
      `Agentic Awesome Skills is built around AAS Core, a local agent-first preview boundary for neutral catalog retrieval, exact agent-owned selection, validation, and planning. AAS Core is backed by an evidence-rich catalog of ${countLabel} reusable SKILL.md playbooks.`,
  },
  {
    question: 'How do I use AAS Core preview?',
    answer:
      'Configure the local stdio MCP with the AAS CLI, let the agent search and inspect the complete catalog, choose exact skill IDs itself, then validate the proposed aas-stack.json and preview its immutable plan in the CLI. Apply and recovery are outside the non-applying preview path.',
  },
  {
    question: 'Is Agentic Awesome Skills a GitHub repository?',
    answer:
      'Yes. The GitHub repository at https://github.com/sickn33/agentic-awesome-skills is the canonical source for AAS Core, its CLI and local MCP, the skill catalog, plugins, and documentation. The hosted site is a companion catalog and local artifact-review surface.',
  },
  {
    question: 'What are AAS specialized plugins?',
    answer:
      'AAS specialized plugins are focused, domain-specific distributions of the skill library. They package relevant skills for web apps, security, data analytics, documents, DevOps, QA, OSS maintenance, and agent or MCP work so users can start with the right surface instead of activating the entire catalog.',
  },
  {
    question: 'How are plugins, bundles, and workflows different?',
    answer:
      'Plugins are installable packaging surfaces, bundles are curated skill recommendations, and workflows are ordered execution playbooks. Start with a plugin when the domain is clear, use bundles to compare adjacent skills, and use workflows when sequencing planning, coding, testing, auditing, or release work matters.',
  },
];

function buildFaqItems(countLabel) {
  return FAQ_ITEMS.map((item) => ({
    question: item.question,
    answer: typeof item.answer === 'function' ? item.answer(countLabel) : item.answer,
  }));
}

function parseCount(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function getSiteBaseUrl() {
  const seoSiteUrl = (process.env.SEO_SITE_URL || '').trim().replace(/\/+$/, '');
  if (seoSiteUrl) {
    return seoSiteUrl;
  }

  return HOSTED_CATALOG_URL.replace(/\/+$/, '');
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function normalizeRoute(routePath) {
  const withLeadingSlash = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return withLeadingSlash === '//' ? '/' : withLeadingSlash;
}

function routeToUrl(routePath, siteBaseUrl) {
  const normalizedRoute = normalizeRoute(routePath);
  const normalizedBase = siteBaseUrl.replace(/\/+$/, '');
  const indexableRoute = normalizedRoute === '/' || normalizedRoute.endsWith('/')
    ? normalizedRoute
    : `${normalizedRoute}/`;
  return `${normalizedBase}${indexableRoute}`;
}

function routeToFilePath(routePath) {
  if (routePath === '/') {
    return path.join(DIST_DIR, 'index.html');
  }

  const normalized = normalizeRoute(routePath).replace(/^\//, '');
  const segments = normalized.split('/').filter(Boolean);

  return path.join(DIST_DIR, ...segments, 'index.html');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeScriptJson(value) {
  return String(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function removeExistingJsonLdScripts(html) {
  const marker = 'data-seo-jsonld="true"';
  let remaining = html;
  let lowered = html.toLowerCase();

  while (true) {
    const markerIndex = lowered.indexOf(marker);
    if (markerIndex === -1) {
      return remaining;
    }

    const openTagStart = lowered.lastIndexOf('<script', markerIndex);
    if (openTagStart === -1) {
      return remaining;
    }

    const openTagEnd = lowered.indexOf('>', markerIndex);
    if (openTagEnd === -1) {
      return remaining;
    }

    const closeTagStart = lowered.indexOf('</script', openTagEnd + 1);
    if (closeTagStart === -1) {
      return remaining;
    }

    const closeTagEnd = lowered.indexOf('>', closeTagStart + 8);
    if (closeTagEnd === -1) {
      return remaining;
    }

    remaining = `${remaining.slice(0, openTagStart)}${remaining.slice(closeTagEnd + 1)}`;
    lowered = remaining.toLowerCase();
  }
}

function replaceHtmlTag(html, pattern, replacement, insertionPoint) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html.replace(insertionPoint, `${replacement}\n${insertionPoint}`);
}

function setMetaTag(html, attributeName, attributeValue, content) {
  const attributeEscaped = escapeRegExp(attributeValue);
  const pattern = new RegExp(`<meta\\s+[^>]*${attributeName}=["']${attributeEscaped}["'][^>]*>`, 'i');
  const replacement = `<meta ${attributeName}="${attributeValue}" content="${escapeHtml(content)}" />`;
  return replaceHtmlTag(html, pattern, replacement, '</head>');
}

function setLinkTag(html, relation, href) {
  const pattern = new RegExp(`<link\\s+[^>]*rel=["']${escapeRegExp(relation)}["'][^>]*>`, 'i');
  const replacement = `<link rel="${relation}" href="${escapeHtml(href)}" />`;
  return replaceHtmlTag(html, pattern, replacement, '</head>');
}

function setTitleTag(html, title) {
  const pattern = /<title[^>]*>[\s\S]*?<\/title>/i;
  const replacement = `<title>${escapeHtml(title)}</title>`;
  return replaceHtmlTag(html, pattern, replacement, '</head>');
}

function setJsonLdTag(html, payload) {
  const cleaned = removeExistingJsonLdScripts(html);
  const tag = `<script type="application/ld+json" data-seo-jsonld="true">${escapeScriptJson(JSON.stringify(payload))}</script>`;
  return cleaned.replace('</head>', `\n${tag}\n</head>`);
}

function safeText(value) {
  return String(value || '').trim();
}

function normalizeMatchText(value) {
  return safeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getLandingPageMatchTerms(page) {
  return [
    page.slug,
    page.eyebrow,
    page.h1,
    page.summary,
    page.primaryIntent,
    ...(Array.isArray(page.keywords) ? page.keywords : []),
    ...(Array.isArray(page.relatedTerms) ? page.relatedTerms : []),
  ];
}

function scoreLandingPageForSkill(page, skill) {
  const haystack = normalizeMatchText([
    skill.id,
    skill.name,
    sk
```

### Core Architecture Module: `apps/web-app/scripts/verify-seo-assets.js`
```
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import sanitizeFilename from 'sanitize-filename';
import { getSeoLandingPaths } from './generate-sitemap.js';

const APP_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_SOCIAL_GUIDES = JSON.parse(fs.readFileSync(path.join(APP_ROOT_DIR, 'src/data/docs-social.json'), 'utf8'));
const REPO_ROOT_DIR = path.resolve(APP_ROOT_DIR, '..', '..');
const REPOSITORY_URL = 'https://github.com/sickn33/agentic-awesome-skills';
const PACKAGE_URL = 'https://www.npmjs.com/package/agentic-awesome-skills';
const EXPECTED_HOSTED_CATALOG_ROOT = 'https://aaskills.tech/';

function safeUserPath(pathValue, baseDir = process.cwd()) {
  const basePath = path.resolve(baseDir);
  const resolvedPath = path.resolve(basePath, String(pathValue ?? ''));
  const relativePath = path.relative(basePath, resolvedPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Path escapes allowed directory: ${pathValue}`);
  }
  const sanitizedSegments = [];
  for (const segment of relativePath.split(path.sep).filter(Boolean)) {
    const sanitizedSegment = sanitizeFilename(segment);
    if (sanitizedSegment !== segment || !sanitizedSegment) {
      throw new Error(`Unsafe path segment: ${segment}`);
    }
    sanitizedSegments.push(sanitizedSegment);
  }
  return path.resolve(basePath, ...sanitizedSegments);
}

function assertPlainFileInsideRoot(filePath, rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedFile = path.resolve(filePath);
  const relative = path.relative(resolvedRoot, resolvedFile);
  assert(
    relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative),
    `File must remain inside verification root: ${filePath}`,
  );
  const candidateAnchors = [REPO_ROOT_DIR, APP_ROOT_DIR, process.cwd(), os.tmpdir(), '/tmp']
    .map((candidate) => path.resolve(candidate))
    .filter((candidate, index, anchors) => anchors.indexOf(candidate) === index && fs.existsSync(candidate))
    .filter((candidate) => {
      const candidateRelative = path.relative(candidate, resolvedRoot);
      return !candidateRelative.startsWith(`..${path.sep}`) && candidateRelative !== '..' && !path.isAbsolute(candidateRelative);
    })
    .sort((left, right) => right.length - left.length);
  assert(candidateAnchors.length > 0, `Verification root is outside trusted filesystem anchors: ${resolvedRoot}`);
  const trustedAnchor = candidateAnchors[0];
  let current = trustedAnchor;
  const rootRelative = path.relative(trustedAnchor, resolvedRoot);
  for (const segment of rootRelative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    assert(!stat.isSymbolicLink(), `Verification path must not contain symlinks: ${current}`);
  }
  const rootStat = fs.lstatSync(resolvedRoot);
  assert(rootStat.isDirectory() && !rootStat.isSymbolicLink(), `Verification root must be a plain directory: ${resolvedRoot}`);
  current = resolvedRoot;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    assert(!stat.isSymbolicLink(), `Verification path must not contain symlinks: ${current}`);
  }
  const fileStat = fs.lstatSync(resolvedFile);
  assert(fileStat.isFile() && !fileStat.isSymbolicLink(), `Verification input must be a plain file: ${resolvedFile}`);
  const physicalRoot = fs.realpathSync(resolvedRoot);
  const physicalFile = fs.realpathSync(resolvedFile);
  const physicalRelative = path.relative(physicalRoot, physicalFile);
  assert(
    physicalRelative && !physicalRelative.startsWith(`..${path.sep}`) && physicalRelative !== '..' && !path.isAbsolute(physicalRelative),
    `Verification input escaped its physical root: ${resolvedFile}`,
  );
  return resolvedFile;
}

export function extractSitemapLocations(xmlText) {
  const raw = String(xmlText ?? '');
  const matches = raw.matchAll(/<loc>(.*?)<\/loc>/g);
  return [...matches].map((match) => match[1].trim()).filter(Boolean);
}

function parseCount(value, fallback = 0) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : fallback;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseCliArgs(argv) {
  const defaultMinSkillUrls = parseCount(
    process.env.PRERENDER_VERIFY_MIN_SKILL_URLS || process.env.PRERENDER_TOP_SKILL_COUNT || process.env.TOP_SKILL_COUNT,
    180,
  );
  const args = {
    sitemapPath: 'dist/sitemap.xml',
    robotsPath: 'dist/robots.txt',
    llmsPath: 'dist/llms.txt',
    manifestPath: 'dist/site.webmanifest',
    indexPath: 'dist/index.html',
    sourceIndexPath: 'index.html',
    socialImagePath: 'dist/social-card.png',
    distDir: 'dist',
    minSkillUrls: String(defaultMinSkillUrls),
    requireHostedUrl: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--artifacts-dir') {
      const value = argv[i + 1];
      if (value) {
        const artifactsDir = safeUserPath(value);
        args.sitemapPath = path.join(artifactsDir, 'sitemap.xml');
        args.robotsPath = path.join(artifactsDir, 'robots.txt');
        args.llmsPath = path.join(artifactsDir, 'llms.txt');
        args.manifestPath = path.join(artifactsDir, 'site.webmanifest');
        args.indexPath = path.join(artifactsDir, 'index.html');
        args.socialImagePath = path.join(artifactsDir, 'social-card.png');
        args.distDir = artifactsDir;
        i += 1;
      }
      continue;
    }

    if (arg === '--dist-dir' && argv[i + 1]) {
      args.distDir = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--sitemap' && argv[i + 1]) {
      args.sitemapPath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--robots' && argv[i + 1]) {
      args.robotsPath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--llms' && argv[i + 1]) {
      args.llmsPath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--manifest' && argv[i + 1]) {
      args.manifestPath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--index' && argv[i + 1]) {
      args.indexPath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--source-index' && argv[i + 1]) {
      args.sourceIndexPath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--social-image' && argv[i + 1]) {
      args.socialImagePath = safeUserPath(argv[i + 1]);
      i += 1;
      continue;
    }

    if (arg === '--min-skill-urls' && argv[i + 1]) {
      args.minSkillUrls = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--require-hosted-url') {
      args.requireHostedUrl = true;
    }
  }

  return args;
}

function getPackageReleaseMetadata() {
  const raw = readFile(path.join(REPO_ROOT_DIR, 'package.json'), REPO_ROOT_DIR);
  const pkg = JSON.parse(raw);
  assert(typeof pkg.version === 'string' && pkg.version.trim(), 'Root package.json must define version.');
  assert(
    Number.isInteger(pkg.aasCore?.includedFromMajor) && pkg.aasCore.includedFromMajor > 0,
    'Root package.json must define aasCore.includedFromMajor.',
  );
  const major = Number.parseInt(pkg.version.split('.')[0], 10);
  assert(Number.isInteger(major), 'Root package.json version must begin with a major number.');
  return {
    label: `V${pkg.version.trim()}`,
    coreIncluded: major >= pkg.aasCore.includedFromMajor,
  };
}

function extractMetaContent(htmlText, selectorType, selectorValue) {
  const document = new JSDOM(String(htmlText ?? '')).window.document;
  const match = [...document.querySelecto
```

### Core Architecture Module: `apps/web-app/src/App.tsx`
```
import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Link, NavLink, Route, Routes } from 'react-router';
import { Icon } from './components/ui/Icon';
import { toIndexableRoutePath } from './utils/seo';

const Landing = lazy(() => import('./pages/Landing'));
const Home = lazy(() => import('./pages/Home'));
const SkillDetail = lazy(() => import('./pages/SkillDetail'));
const Workbench = lazy(() => import('./pages/Workbench'));
const Plugins = lazy(() => import('./pages/Plugins'));
const Docs = lazy(() => import('./pages/Docs'));
const TopicLanding = lazy(() => import('./pages/TopicLanding'));
const NotFound = lazy(() => import('./pages/NotFound'));
const CatalogRouteProvider = lazy(() => import('./context/CatalogRouteProvider'));

function App(): React.ReactElement {
  const logoSrc = `${import.meta.env.BASE_URL}aas-wordmark.png`;

  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <div className="app-shell min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
        <header className="app-header">
          <div className="app-header__inner">
            <Link to="/" className="brand-link" aria-label="Agentic Awesome Skills home">
              <img
                src={logoSrc}
                alt="AAS"
                className="brand-link__logo"
              />
              <span className="brand-link__name">
                Agentic Awesome Skills
              </span>
            </Link>

            <nav className="app-nav" aria-label="Primary navigation">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}
              >
                Home
              </NavLink>
              <NavLink
                to={toIndexableRoutePath('/core')}
                className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}
              >
                Core
              </NavLink>
              <NavLink
                to={toIndexableRoutePath('/workbench')}
                className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}
              >
                Workbench
              </NavLink>
              <NavLink
                to={toIndexableRoutePath('/plugins')}
                className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}
              >
                Plugins
              </NavLink>
              <NavLink to="/docs/" className={({ isActive }) => `app-nav__link ${isActive ? 'is-active' : ''}`}>
                Docs
              </NavLink>
            </nav>

            <div className="app-header__actions">
              <a
                href="https://github.com/sickn33/agentic-awesome-skills"
                target="_blank"
                rel="noreferrer"
                className="github-link"
              >
                <Icon name="github" size={19} weight="fill" />
                <span>View on GitHub</span>
              </a>

              <details className="mobile-nav">
                <summary aria-label="Open navigation">Menu</summary>
                <nav aria-label="Mobile navigation">
                  <Link to="/">Home</Link>
                  <Link to={toIndexableRoutePath('/core')}>Core</Link>
                  <Link to={toIndexableRoutePath('/workbench')}>Workbench</Link>
                  <Link to={toIndexableRoutePath('/plugins')}>Plugins</Link>
                  <Link to="/docs/">Docs</Link>
                  <a href="https://github.com/sickn33/agentic-awesome-skills" target="_blank" rel="noreferrer">View on GitHub</a>
                </nav>
              </details>
            </div>
          </div>
        </header>

        <main className="app-main">
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--text-muted)]">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route element={<CatalogRouteProvider />}>
                <Route path="/" element={<Landing />} />
                <Route path="/core" element={<Home />} />
                <Route path="/topics/:slug" element={<TopicLanding />} />
                <Route path="/skill/:id" element={<SkillDetail />} />
              </Route>
              <Route path="/plugins" element={<Plugins />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/:slug" element={<Docs />} />
              <Route path="/workbench" element={<Workbench />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>

        <footer className="app-footer">
          <p>Independent, community-curated project. Review skills before use.</p>
          <nav aria-label="Footer navigation">
            <Link to="/docs/">Documentation</Link>
            <a href="https://github.com/sickn33/agentic-awesome-skills#contributing" target="_blank" rel="noreferrer">Contributing</a>
            <a href="https://github.com/sickn33/agentic-awesome-skills/blob/main/LICENSE" target="_blank" rel="noreferrer">License</a>
            <a href="https://github.com/sickn33/agentic-awesome-skills/blob/main/CODE_OF_CONDUCT.md" target="_blank" rel="noreferrer">Code of Conduct</a>
          </nav>
        </footer>
      </div>
    </Router>
  );
}

export default App;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1222** (2026-08-24): **[BUG] Unable to resolve npm release identity for 15.16.0: spawnSync npm.cmd EINVAL**
  *Symptoms*: I get error in installation using npm version 12.0.2.  $ npx agentic-awesome-skills --agy npm notice run npx npm notice run agentic-awesome-skills --agy Resolving npm release identity for 15.16.0… Error: Unable to resolve npm release identity for 15.16.0: spawnSync npm.cmd EINVAL  Thanks for the previous explanation at https://github.com/sickn33/agentic-awesome-skills/pull/1167, and sorry for my mistake in putting the issue in merged pr

- **Issue #1114** (2026-08-09): **Skill Folder Missing Referenced File**
  *Symptoms*: https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/context-driven-development/SKILL.md  References missing file: `resources/implementation-playbook.md`

- **Issue #1113** (2026-08-09): **Files In Multiple Languages**
  *Symptoms*: There are others but here is 1 came across recently forgot the others but I suggest having AI search entire repo for multiple languages in 1 file:  https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/context-guardian/SKILL.md
  **Post-Mortem & Fix Analysis**:
  > Another: https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/context-agent/SKILL.md
  > Has not been fixed or changes not pushed why is it closed?

- **Issue #1112** (2026-08-09): **Code Outside of Code Blocks**
  *Symptoms*: Good amount of the code is outside of code blocks in:  https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/conversation-memory/SKILL.md  Side Note:  First repo I see with 0 open issues by the way keep up the good work!  Also Not sure if I should open a issue about updating all files that reference other skills or files to actually link to the files not just reference the names.
  **Post-Mortem & Fix Analysis**:
  > Found another:  https://github.com/sickn33/agentic-awesome-skills/blob/main/skills/context-window-management/SKILL.md

- **Issue #795** (2026-07-09): **[BUG] Error install npx**
  *Symptoms*: The message error:  ``` npx agentic-awesome-skills npm warn Unknown user config "msvs_version". This will stop working in the next major version of npm. npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/agentic-awesome-skills - Not found npm error 404 npm error 404  The requested resource 'agentic-awesome-skills@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\xxx\AppData\Local\npm-cache\_logs\2026-07-09T07_22_06_355Z-debug-0.log ```
  **Post-Mortem & Fix Analysis**:
  > yeah I'm aware of this bug. tonight I will fix it. thanks for your patience!
  > Fixed by the v14.0.0 npm publish. agentic-awesome-skills is now available on npm and latest resolves to 14.0.0, so npx agentic-awesome-skills should no longer hit the registry 404 reported here.

- **Issue #793** (2026-07-09): **[BUG]**
  *Symptoms*: [pytest-skill](https://skillsmp.com/creators/sickn33/antigravity-awesome-skills/plugins-antigravity-awesome-skills-claude-skills-pytest-skill) is missing a reference file: > The SKILL.md mentions reference/playbook.md, but the API shows only SKILL.md at the top level. Let me check whether a reference subdirectory exists.
  **Post-Mortem & Fix Analysis**:
  > Fixed on main in 18f812ad9 by restoring pytest-skill/reference/playbook.md in the canonical skill and both plugin mirrors from the LambdaTest upstream source. Local checks run: npm run validate:references, npm run validate, npm run security:docs, and git diff --check.

- **Issue #636** (2026-05-31): **[BUG] EPERM / WinError 1314 Errors on Windows due to Missing Symlink Privileges in Security Tests**
  *Symptoms*: Description On Windows operating systems, creating symbolic links (fs.symlinkSync in Node or pathlib.Path.symlink_to in Python) requires elevated Administrator privileges or Developer Mode to be explicitly enabled. For standard developer environments, running the test suite throws EPERM (Node) / OSError: [WinError 1314] (Python) errors, making it impossible to pass tests locally.  Impacted Files tools/scripts/tests/jetski_gemini_loader.test.cjs tools/scripts/tests/copy_security.test.js tools/scripts/tests/symlink_safety.test.js tools/scripts/tests/skill_utils_security.test.js tools/scripts/tests/test_cleanup_synthetic_skill_sections.py Error Logs (Node.js) text Error: EPERM: operation not permitted, symlink 'C:\...\outside-symlink\secret.md' -> 'C:\...\skills\symlinked\SKILL.md'     at Object.symlinkSync (node:fs:1855:11)     at main (...\tools\scripts\tests\jetski_gemini_loader.test.cjs:114:8) Error Logs (Python) text OSError: [WinError 1314] Gereken ayrıcalık istemci tarafından sağlanmıyor: '...' -> '...'   File "...\tools\scripts\tests\test_cleanup_synthetic_skill_sections.py", line 178, in test_cleanup_skill_file_skips_symlinked_skill_markdown     skill_path.symlink_to(target) Proposed Fix Add graceful checks or try/catch wraps when creating symbolic links inside test files. If the OS is Windows and a symbolic link operation throws EPERM / WinError 1314, log a warning and skip the symlink-related checks rather than crashing the entire test suite.
  **Post-Mortem & Fix Analysis**:
  > Fixed in f6f5b751 by adding shared symlink test helpers for Node and Python tests. Symlink-related security assertions still run where symlink creation is available, and Windows environments without Developer Mode/Admin symlink privileges now skip those specific assertions instead of failing the whole suite with EPERM / WinError 1314. Verified with `npm run test` and `npm run validate`.

- **Issue #635** (2026-05-31): **[BUG] Windows-specific Test Failure due to CRLF Line Endings in**
  *Symptoms*: automation_workflows.test.js Description When running npm run test or npm run test:local on Windows, the test suite fails on automation_workflows.test.js due to line ending differences (\r\n vs \n). Windows Git configuration often checks out files with CRLF (\r\n) line endings, which causes strict multiline regular expression checks to fail.  Error Logs text AssertionError [ERR_ASSERTION]: repo hygiene workflow should support schedule and manual runs     at Object.<anonymous> (...\tools\scripts\tests\automation_workflows.test.js:200:8)   actual: 'name: Repo Hygiene\r\n' +     '\r\n' +     'on:\r\n' +     '  workflow_dispatch:\r\n' +     '  schedule:\r\n' +     '    - cron: "0 7 * * 1"\r\n' + ...   expected: /^on:\n  workflow_dispatch:\n  schedule:/m,   operator: 'match' Proposed Fix Normalize CRLF to LF line endings when reading file contents in the test's helper function. Update the readText function in   automation_workflows.test.js :  javascript function readText(relativePath) {   return fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n"); }
  **Post-Mortem & Fix Analysis**:
  > Fixed in f6f5b751 by normalizing CRLF to LF in the workflow-test file reader before applying strict multiline assertions. This keeps the test portable on Windows checkouts while preserving the same workflow contract checks. Verified with `npm run test` and `npm run validate`.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `02ca42fe` (2026-09-30)
**Commit Message**: fix: recompute the README Top Contributors rankings automatically (#1724)

# fix: recompute the README Top Contributors rankings automatically

**File**: `.github/MAINTENANCE.md` (modified, +5/-2)
```diff
@@ -118,7 +118,7 @@ Before ANY commit that adds/modifies skills, run the chain:
     ```bash
     npm run sync:repo-state
     ```
-    This wraps `chain + sync:web-assets + sync:contributors + audit:consistency` for a full local repo-state refresh; `chain` already generates the catalog.
+    This wraps `chain + sync:web-assets + sync:contributors + sync:top-contributors + audit:consistency` for a full local repo-state refresh; `chain` already generates the catalog.
     The scheduled GitHub Actions workflow `Repo Hygiene` runs this same sweep weekly to catch slow drift on `main`.
     It also enforces the frozen validation warning budget using the current maximum in `tools/config/validation-budget.json` (currently zero).
 
@@ -291,6 +291,7 @@ After every source batch, including a one-PR batch, verify that both README cred
 
 - `### Community Contributors` / `## Credits & Sources` for external repositories referenced by the merged work
 - `## Repo Contributors` for the human contributor list
+- `## Top Contributors` for the two ranked leaderboards, recomputed by `sync:top-contributors`
 
 Do not run a local generator after every individual merge. The trusted `main` workflow coalesces contributor and generated drift in the protected canonical-sync PR after the source batch.
 
@@ -301,7 +302,7 @@ Do not run a local generator after every individual merge. The trusted `main` wo
     ```
 
 2.  **Verify the canonical-sync handoff**:
-    - Let the trusted workflow run `sync:repo-state`, which includes `sync:contributors`, and open or update `automation/canonical-repo-state` when drift exists.
+    - Let the trusted workflow run `sync:repo-state`, which includes `sync:contributors` and `sync:top-contributors`, and open or update `automation/canonical-repo-state` when drift exists.
     - Verify that the protected canonical PR contains the expected `## Repo Contributors` update while preserving custom bot/app links.
     - Do not commit generated or contributor drift to an ordinary source PR and do not push it directly to `main`.
 
@@ -370,6 +371,8 @@ Locations to check:
 - **Credits & Sources**: This whole area is for **external repos and upstream sources**, split into Official vs Community.
 - **Repo Contributors**: Use this for **Pull Requests**.
   - _Rule_: "This user sent a PR." -> Add to `## Repo Contributors`.
+- **Top Contributors**: Two generated leaderboards: commit count and canonical skills introduced per contributor, both recomputed by `sync:top-contributors` and published through the canonical-sync PR.
+  - _Rule_: never hand-edit these tables; fix the generator or its excluded-account list instead.
 
 **Merge rule:** after every PR merge, check **both** `### Community Contributors` and `## Repo Contributors`. A merge is not fully done until both sections are either confirmed unchanged or updated and pushed.
 
```

**File**: `README.md` (modified, +17/-17)
```diff
@@ -590,16 +590,16 @@ Contributors ranked by the number of commits.
 
 | # | Contributor | Commits |
 |---:|---|---:|
-| 1 | <a href="https://github.com/munir-abbasi"><img src="https://github.com/munir-abbasi.png?size=48" width="32" height="32" alt="" /></a> [@munir-abbasi](https://github.com/munir-abbasi) | 34 |
-| 2 | <a href="https://github.com/Mohammad-Faiz-Cloud-Engineer"><img src="https://github.com/Mohammad-Faiz-Cloud-Engineer.png?size=48" width="32" height="32" alt="" /></a> [@Mohammad-Faiz-Cloud-Engineer](https://github.com/Mohammad-Faiz-Cloud-Engineer) | 33 |
-| 3 | <a href="https://github.com/WHOISABHISHEKADHIKARI"><img src="https://github.com/WHOISABHISHEKADHIKARI.png?size=48" width="32" height="32" alt="" /></a> [@WHOISABHISHEKADHIKARI](https://github.com/WHOISABHISHEKADHIKARI) | 24 |
+| 1 | <a href="https://github.com/WHOISABHISHEKADHIKARI"><img src="https://github.com/WHOISABHISHEKADHIKARI.png?size=48" width="32" height="32" alt="" /></a> [@WHOISABHISHEKADHIKARI](https://github.com/WHOISABHISHEKADHIKARI) | 36 |
+| 2 | <a href="https://github.com/munir-abbasi"><img src="https://github.com/munir-abbasi.png?size=48" width="32" height="32" alt="" /></a> [@munir-abbasi](https://github.com/munir-abbasi) | 34 |
+| 3 | <a href="https://github.com/Mohammad-Faiz-Cloud-Engineer"><img src="https://github.com/Mohammad-Faiz-Cloud-Engineer.png?size=48" width="32" height="32" alt="" /></a> [@Mohammad-Faiz-Cloud-Engineer](https://github.com/Mohammad-Faiz-Cloud-Engineer) | 33 |
 | 4 | <a href="https://github.com/zinzied"><img src="https://github.com/zinzied.png?size=48" width="32" height="32" alt="" /></a> [@zinzied](https://github.com/zinzied) | 24 |
 | 5 | <a href="https://github.com/Prince-1652"><img src="https://github.com/Prince-1652.png?size=48" width="32" height="32" alt="" /></a> [@Prince-1652](https://github.com/Prince-1652) | 17 |
-| 6 | <a href="https://github.com/ssumanbiswas"><img src="https://github.com/ssumanbiswas.png?size=48" width="32" height="32" alt="" /></a> [@ssumanbiswas](https://github.com/ssumanbiswas) | 15 |
-| 7 | <a href="https://github.com/FrancoStino"><img src="https://github.com/FrancoStino.png?size=48" width="32" height="32" alt="" /></a> [@FrancoStino](https://github.com/FrancoStino) | 13 |
-| 8 | <a href="https://github.com/Champbreed"><img src="https://github.com/Champbreed.png?size=48" width="32" height="32" alt="" /></a> [@Champbreed](https://github.com/Champbreed) | 10 |
-| 9 | <a href="https://github.com/Dokhacgiakhoa"><img src="https://github.com/Dokhacgiakhoa.png?size=48" width="32" height="32" alt="" /></a> [@Dokhacgiakhoa](https://github.com/Dokhacgiakhoa) | 10 |
-| 10 | <a href="https://github.com/sx4im"><img src="https://github.com/sx4im.png?size=48" width="32" height="32" alt="" /></a> [@sx4im](https://github.com/sx4im) | 10 |
+| 6 | <a href="https://github.com/beatra-ai"><img src="https://github.com/beatra-ai.png?size=48" width="32" height="32" alt="" /></a> [@beatra-ai](https://github.com/beatra-ai) | 16 |
+| 7 | <a href="https://github.com/ssumanbiswas"><img src="https://github.com/ssumanbiswas.png?size=48" width="32" height="32" alt="" /></a> [@ssumanbiswas](https://github.com/ssumanbiswas) | 15 |
+| 8 | <a href="https://github.com/FrancoStino"><img src="https://github.com/FrancoStino.png?size=48" width="32" height="32" alt="" /></a> [@FrancoStino](https://github.com/FrancoStino) | 13 |
+| 9 | <a href="https://github.com/sx4im"><img src="https://github.com/sx4im.png?size=48" width="32" height="32" alt="" /></a> [@sx4im](https://github.com/sx4im) | 10 |
+| 10 | <a href="https://github.com/Dokhacgiakhoa"><img src="https://github.com/Dokhacgiakhoa.png?size=48" width="32" height="32" alt="" /></a> [@Dokhacgiakhoa](https://github.com/Dokhacgiakhoa) | 10 |
 
 </td>
 <td valign="top" width="50%">
@@ -610,16 +610,16 @@ Contributors ranked by the number of skills they added.
 
 | # | Contributor | Skills added |
 |---:|---|---:|
-| 1 | <a href="https://github.com/Prince-1652"><img src="htt
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -27,11 +27,12 @@
     "sync:metadata": "node tools/scripts/run-python.js tools/scripts/sync_repo_metadata.py",
     "sync:github-about": "node tools/scripts/run-python.js tools/scripts/sync_repo_metadata.py --apply-github-about",
     "sync:contributors": "node tools/scripts/run-python.js tools/scripts/sync_contributors.py",
+    "sync:top-contributors": "node tools/scripts/run-python.js tools/scripts/sync_top_contributors.py",
     "sync:web-assets": "npm run app:setup && cd apps/web-app && npm run generate:sitemap",
     "chain": "npm run validate && npm run plugin-compat:sync && npm run index && npm run bundles:sync && npm run sync:metadata && npm run catalog && npm run build:aas-v1-catalog",
     "sync:all": "npm run chain",
     "sync:release-state": "npm run chain && npm run sync:web-assets && npm run audit:consistency && npm run check:warning-budget",
-    "sync:repo-state": "npm run chain && npm run sync:web-assets && npm run sync:contributors && npm run audit:consistency && npm run check:warning-budget",
+    "sync:repo-state": "npm run chain && npm run sync:web-assets && npm run sync:contributors && npm run sync:top-contributors && npm run audit:consistency && npm run check:warning-budget",
     "sync:repo-state:full": "npm run sync:repo-state && npm run sync:github-about && npm run audit:consistency:github",
     "catalog": "node tools/scripts/build-catalog.js",
     "build": "npm run chain",
```

**File**: `skills/antigravity-maintainer-batch-release/SKILL.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ Treat the repository root containing this skill as pull-request-only:
 - Never commit or push directly to `main`, even when the user says “push to main.” That phrase names the final target state.
 - Preserve unrelated dirty work. Use a clean temporary clone or a topic branch for maintainer changes.
 - Use `npm run merge:batch` for accepted source PRs. Do not substitute a raw merge API, generic GitHub skill, or generic push helper.
-- Let `automation/canonical-repo-state` own generated artifacts and contributor-credit convergence after the source batch.
+- Let `automation/canonical-repo-state` own generated artifacts and contributor-credit convergence after the source batch. That lane runs `sync:repo-state`, which now also recomputes the README `## Top Contributors` leaderboards through `sync:top-contributors`: never hand-edit those tables, and treat a stale ranking as a generator or exclusion-list defect instead.
 - Use `release:prepare` and `release:publish` for releases. They never authorize a direct `main` push.
 
 ## Source Checks
```

**File**: `tools/scripts/sync_top_contributors.py` (added, +251/-0)
```diff
@@ -0,0 +1,251 @@
+#!/usr/bin/env python3
+"""Synchronize the README Top Contributors rankings.
+
+Two rankings are maintained:
+
+* **Most Commits** - GitHub's own contributor count per account.
+* **Most Skills Added** - every current ``skills/**/SKILL.md`` counted once at
+  the commit that introduced it, resolved to the pull-request author so a
+  contributor who opened the PR is credited even when the squash commit carries
+  the maintainer's identity.
+
+Both rankings exclude the repository maintainer accounts and automation, and
+both are recomputed from Git history plus the GitHub API. The canonical-sync
+lane owns README.md, so this script is what keeps the tables current; it is
+invoked by ``npm run sync:repo-state``.
+
+When the GitHub API is unavailable (no ``gh``, no token, fork checkout) the
+ranking is left untouched instead of being blanked, so local runs and fork CI
+never publish an empty leaderboard.
+"""
+
+from __future__ import annotations
+
+import argparse
+import json
+import re
+import subprocess
+import sys
+from collections import Counter
+from pathlib import Path
+
+from _project_paths import find_repo_root
+from update_readme import configure_utf8_output, load_metadata
+
+TOP_CONTRIBUTORS_HEADING = "## Top Contributors"
+NEXT_SECTION_HEADING = "## Repo Contributors"
+TOP_N = 10
+
+# Maintainer handles and automation never appear in either ranking: the point
+# is to thank external contributors, and bot/infra commits would otherwise
+# dominate both tables.
+EXCLUDED_LOGINS = frozenset({
+    "sickn33",
+    "sck_0",
+    "sck000",
+    "github-actions[bot]",
+    "copilot-swe-agent[bot]",
+    "dependabot[bot]",
+})
+
+# Accounts whose commits are authored under a non-noreply address. Git cannot
+# resolve these on its own, so the mapping is explicit and reviewed.
+AUTHOR_LOGIN_OVERRIDES = {
+    "niccolo.lucioli@hotmail.com": "sickn33",
+}
+
+PR_NUMBER_PATTERN = re.compile(r"\(#(\d+)\)\s*$")
+NOREPLY_PATTERN = re.compile(r"^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$")
+
+
+class GithubUnavailable(RuntimeError):
+    """Raised when the GitHub API cannot be queried."""
+
+
+def _run(cmd: list[str], cwd: Path | None = None) -> str:
+    result = subprocess.run(cmd, cwd=str(cwd) if cwd else None,
+                            capture_output=True, text=True)
+    if result.returncode != 0:
+        raise GithubUnavailable(result.stderr.strip() or f"command failed: {' '.join(cmd)}")
+    return result.stdout
+
+
+def login_from_email(email: str) -> str | None:
+    match = NOREPLY_PATTERN.match(email or "")
+    if match:
+        return match.group(1)
+    return AUTHOR_LOGIN_OVERRIDES.get(email)
+
+
+def fetch_commit_ranking(repo: str) -> list[tuple[str, int]]:
+    """Return GitHub's contributor counts, highest first, maintainers removed."""
+    payload = json.loads(_run([
+        "gh", "api", f"repos/{repo}/contributors?per_page=100", "--paginate", "--slurp",
+    ]))
+    entries: list[dict] = []
+    for page in payload:
+        if isinstance(page, list):
+            entries.extend(item for item in page if isinstance(item, dict))
+    ranked = Counter()
+    for entry in entries:
+        login = entry.get("login")
+        if isinstance(login, str) and login and login not in EXCLUDED_LOGINS:
+            ranked[login] += int(entry.get("contributions") or 0)
+    return [(login, count) for login, count in ranked.most_common(TOP_N)]
+
+
+def fetch_pull_request_authors(repo: str) -> dict[int, str]:
+    """Map merged pull-request number to its author login."""
+    payload = json.loads(_run([
+        "gh", "pr", "list", "--repo", repo, "--state", "merged",
+        "--limit", "3000", "--json", "number,author",
+    ]))
+    authors: dict[int, str] = {}
+    for entry in payload:
+        number = entry.get("number")
+        author = (entry.get("author") or {}).get("login")
+        if isinstance(number, int) and isinstance(author, str) and author:
+            authors[number] = author
+  
```

---

### Incident Patch 2: `1e844421` (2026-09-30)
**Commit Message**: fix: resolve the open Dependabot advisories and stage the 18.10.0 changelog entry (#1719)

# fix: resolve the open Dependabot advisories and stage the 18.10.0 changelog entry

**File**: `CHANGELOG.md` (modified, +44/-0)
```diff
@@ -7,6 +7,50 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ---
 
+## [18.10.0] - 2026-09-30 - "SME Operations, 15 Official Beatra Skills, and Four New Advisories Closed"
+
+> Adds **124** reviewed skills - a complete SME operations catalog and fifteen official Beatra media skills - hardens the protected maintainer gates, closes ten Dependabot advisories, and ships **2,602** skills.
+
+A catalog release for Claude Code, Cursor, Codex CLI, Gemini CLI, and related AI coding assistants. It includes the complete protected maintainer batch merged after `18.9.0`, with existing installation interfaces preserved.
+
+### Start here
+
+- Install: `npx agentic-awesome-skills@18.10.0`
+- [Choose your tool](README.md#choose-your-tool)
+- [Best skills by tool](README.md#best-skills-by-tool)
+- [Bundles](docs/users/bundles.md)
+- [Workflows](docs/users/workflows.md)
+
+### Added
+
+- **SME operations catalog (#1688, #1689, #1690-#1698)** — **106** small-business operations skills covering people, finance, compliance, projects, knowledge, and reporting: onboarding and offboarding, payroll and expense accounting, credit-cycle analysis, contracts and policy libraries, capacity and workload planning, KPI and OKR tracking, recruitment and career development, and month-end close. Each is a self-contained Markdown workflow with explicit limitations and no bundled executables; the batch keeps every entry inside the repository's 500-line budget with detail in `references/`.
+- **Fifteen official Beatra media skills (#1473-#1487)** — `beatra`, `talking-avatar-video`, `suno-lyrics-to-song`, `ai-logo-maker`, `music-generation-studio`, `product-photo-studio`, `poster-design-studio`, `ecommerce-listing-image-set`, `ai-image-generation-studio`, `ai-podcast-voiceover`, `voiceover-narration-studio`, `ai-multilingual-dubbing`, `voice-cloning-studio`, `ai-photo-restyler`, and `viral-video-teardown-remake`. Each entry is a reviewed pointer, not the executable package: it pins the archive URL and SHA-256, requires digest verification and a manual inspection before activation, and disables the client's silent self-update before any other command. `risk: critical`, paid hosted work.
+- **mirrord (#1706)** — `mirrord` runs a local process inside a live Kubernetes pod's network, environment, and traffic so a change can be verified against real services without deploying. Asks before traffic-stealing or cluster-modifying steps. `risk: safe`.
+- **Busabase workspace (#1682)** — `busabase` covers authorized workspace record and knowledge operations, permission-aware ChangeRequests, and canonical-versus-pending readback through the hosted MCP server. `risk: critical`.
+- **Changelog entry (#1699)** — `changelog-entry` turns a commit range or pull request into a Keep a Changelog block, grouping conventional-commit types into Added, Changed, Deprecated, Removed, Fixed, and Security. `risk: safe`.
+
+### Changed
+
+- **SkillSpector advisory scans (#1703)** — add a PR-only, non-blocking SkillSpector workflow that waits for the exact-head `pr-evidence` result, then scans full changed skill directories from immutable Git refs with a pinned NVIDIA SkillSpector v2.12.0, a frozen dependency lock, no scanner credentials, and a Linux network namespace. Reports bind the base and head SHA and remain advisory; they satisfy no required check and change no merge authority.
+- **Dependency advisories (#1712)** — close ten open Dependabot alerts by resolving `brace-expansion` 1.1.21 and 5.0.12, `fast-uri` 3.1.8, and `ip-address` 10.7.2 in the root, catalog web app, and the `telegram` and `whatsapp-cloud-api` example lockfiles, using the override pattern already present in those manifests. The mirrored plugin copies are regenerated by the protected canonical-sync lane. `npm audit` reports zero vulnerabilities in all four manifests.
+- **Vercel production headers (#1685)** — tighten the hosted catalog's production response headers and document the i
```

**File**: `apps/web-app/package-lock.json` (modified, +9/-9)
```diff
@@ -2439,9 +2439,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.9.tgz",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -3346,9 +3346,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.7",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
-      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "funding": [
         {
           "type": "github",
@@ -3880,9 +3880,9 @@
       "license": "MIT"
     },
     "node_modules/ip-address": {
-      "version": "10.7.0",
-      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.0.tgz",
-      "integrity": "sha512-BGFsyJd5mpXp3rK6jIdADLNgpJUK1jnjzvYF8lK+VyDab9JAmqN0YOKDdP17HlgKb2+ehPgDc8EtnRLbGCAMhA==",
+      "version": "10.7.2",
+      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz",
+      "integrity": "sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

**File**: `apps/web-app/package.json` (modified, +4/-1)
```diff
@@ -61,7 +61,10 @@
     "vitest": "^5.0.0"
   },
   "overrides": {
-    "flatted": "^3.4.0"
+    "brace-expansion": "^5.0.12",
+    "fast-uri": "^3.1.8",
+    "flatted": "^3.4.0",
+    "ip-address": "^10.7.1"
   },
   "engines": {
     "node": "^22.22.2 || ^24.15.0 || >=26.0.0"
```

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -16,7 +16,7 @@
       "license": "MIT",
       "dependencies": {
         "ajv": "^8.20.0",
-        "fast-uri": "^3.1.6",
+        "fast-uri": "^3.1.8",
         "sanitize-filename": "^1.6.4",
         "yaml": "^2.9.0"
       },
@@ -54,9 +54,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.7",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.7.tgz",
-      "integrity": "sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "funding": [
         {
           "type": "github",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@
   },
   "dependencies": {
     "ajv": "^8.20.0",
-    "fast-uri": "^3.1.6",
+    "fast-uri": "^3.1.8",
     "sanitize-filename": "^1.6.4",
     "yaml": "^2.9.0"
   },
```

---

### Incident Patch 3: `200ad77b` (2026-09-30)
**Commit Message**: fix: allow the read-only SkillSpector workflow on fork pull requests (#1714)

# fix: allow the read-only SkillSpector workflow on fork pull requests

**File**: `.github/MAINTENANCE.md` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ The canonical maintainer skill contains the full [Current CI workflow](../skills
 
 - Source-only classification counts the destination of a Git copy as changed; its unchanged origin is not a generated-file mutation. Renames still count both paths. The fork classifier treats a copy origin as read-only in the same way: Git pairs a copy by similarity against any path already present in the base tree, so the origin's path class is not author-controlled and the same new canonical skill can otherwise pass or fail depending on which existing file Git happened to choose. Copy origins remain subject to raw-path, mode, object, size and total-budget checks, and editing, renaming or deleting that origin still fails closed. Raw records, blob safety, fork classification and exact-head review remain enforced independently.
 
-- `pr-policy` executes the fork-safety intake with code and dependencies materialized from the exact protected base before the dependent required jobs start. The classifier's `NODE_PATH` must point only at that protected-base worktree, never at pull-request-controlled `node_modules`. This is an early, unprivileged rejection of unsafe fork diffs; `merge:batch` still recomputes the trusted decision and remains the only fork-run approval and merge authority. The allowlist also covers browser source under `apps/web-app/src/**` (`.css`, `.ts`, `.tsx`), which cannot change dependencies, lockfiles, build configuration or generated assets: those fork runs may be approved, but the merge still requires an exact-head maintainer attestation.
+- `pr-policy` executes the fork-safety intake with code and dependencies materialized from the exact protected base before the dependent required jobs start. The classifier's `NODE_PATH` must point only at that protected-base worktree, never at pull-request-controlled `node_modules`. This is an early, unprivileged rejection of unsafe fork diffs; `merge:batch` still recomputes the trusted decision and remains the only fork-run approval and merge authority. The allowlist also covers browser source under `apps/web-app/src/**` (`.css`, `.ts`, `.tsx`), which cannot change dependencies, lockfiles, build configuration or generated assets: those fork runs may be approved, but the merge still requires an exact-head maintainer attestation. The approvable run allowlist additionally includes the PR-only `skillspector-advisory` workflow: `contents: read` and `checks: read`, no secrets, every action pinned to a full SHA, and its first job only waits for the exact-head `pr-evidence` result. A PR-only advisory workflow that is absent from the allowlist leaves every fork skill PR stuck on `action_required`, so keep the list aligned whenever a read-only fork workflow is added or renamed.
 - The reported `impact_profile` is shadow telemetry only. It does not skip, downgrade, or satisfy any required check.
 - For an ordinary source PR, `source-validation` performs the generated-state refresh once and publishes a manifest bound to the exact repository, workflow/run attempt, and PR head SHA. `artifact-preview` verifies that manifest and its digest; it does not regenerate the same source-PR tree.
 - For the protected canonical-sync PR, `pr-policy` reproduces the exact tree from trusted `main`, `source-validation` records a lightweight boundary, and `artifact-preview` confirms that regeneration leaves no drift. The merged commit still receives the explicit final `main` CI and CodeQL runs.
```

**File**: `docs/maintainers/merge-batch.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ Use `--dry-run` to exercise local classification without approving a run or merg
 ## CI Intake Contract
 
 - Before dependent required jobs do expensive setup or wait work, `pr-policy` runs the fork-safety classifier from the exact protected-base implementation and fails an unsafe fork diff early.
-- The intake allowlist also covers browser source under `apps/web-app/src/**` with `.css`, `.ts` or `.tsx` extensions. Those files cannot change dependencies, lockfiles, build configuration or generated assets, so their fork runs may be approved; every web-app source change still requires an exact-head maintainer attestation (`--reviewed-head`) before merge. The approvable run allowlist also includes the pinned read-only `aas-agent-first-preview` workflow (`contents: read`, no secrets, SHA-pinned actions), which is the preview lane that runs on `apps/web-app/**` pull requests.
+- The intake allowlist also covers browser source under `apps/web-app/src/**` with `.css`, `.ts` or `.tsx` extensions. Those files cannot change dependencies, lockfiles, build configuration or generated assets, so their fork runs may be approved; every web-app source change still requires an exact-head maintainer attestation (`--reviewed-head`) before merge. The approvable run allowlist also includes the pinned read-only `aas-agent-first-preview` workflow (`contents: read`, no secrets, SHA-pinned actions), which is the preview lane that runs on `apps/web-app/**` pull requests, and the PR-only `skillspector-advisory` workflow. SkillSpector declares only `contents: read` and `checks: read`, uses no secrets, pins every action to a full SHA, and its first job only waits for the exact-head `pr-evidence` result before the advisory scan starts; without that entry every fork skill PR stalls on `action_required`.
 - That CI result is fail-fast evidence, not merge authority. `merge:batch` independently recomputes the complete decision from trusted `main` and remains the only command allowed to approve fork runs or merge the PR.
 - `impact_profile` is shadow-only telemetry. It never skips a required job, test, review, or merge gate.
 - Normal source PRs generate derived preview state once in `source-validation`; `artifact-preview` verifies the exact-head manifest and digest instead of generating the tree again.
```

**File**: `skills/antigravity-maintainer-batch-release/SKILL.md` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ Review findings individually during the pilot. Missing `allowed-tools`, environm
    - Use the repository validation, test, docs-security, source-credit, reference, warning-budget, and targeted app checks required by the changed files.
    - Fix deterministic policy failures in the source; do not wait for them as if they were flaky CI.
    - For source-only changed paths, a Git copy changes only its destination; renames change both paths. Treat a Git copy origin as read-only in the fork classifier too: Git pairs a copy by similarity against any path already in the base tree, so that origin's path class is not author-controlled and the same new canonical skill must not pass or fail depending on which existing file Git chose. Keep its raw-record, mode, object, size and total-budget checks, and keep editing, renaming or deleting that origin as definite failures.
-   - Treat `pr-policy` fork classification from the exact protected-base implementation as an unprivileged fail-fast gate before dependent work, never as approval authority. Install and resolve every dependency used by that classifier from the same protected-base worktree; never expose it to pull-request-controlled `node_modules`. `merge:batch` must still recompute the current trusted decision before approving any fork run or merging. The intake allowlist also covers browser source under `apps/web-app/src/**` (`.css`, `.ts`, `.tsx`); those fork runs may be approved, but every web-app source change still requires an exact-head maintainer attestation before merge.
+   - Treat `pr-policy` fork classification from the exact protected-base implementation as an unprivileged fail-fast gate before dependent work, never as approval authority. Install and resolve every dependency used by that classifier from the same protected-base worktree; never expose it to pull-request-controlled `node_modules`. `merge:batch` must still recompute the current trusted decision before approving any fork run or merging. The intake allowlist also covers browser source under `apps/web-app/src/**` (`.css`, `.ts`, `.tsx`); those fork runs may be approved, but every web-app source change still requires an exact-head maintainer attestation before merge. Keep every read-only PR-only workflow that runs on fork pull requests in the approval allowlist too: a workflow missing from it leaves those PRs stuck on `action_required` with no gate to merge, even when the workflow itself declares only read permissions, uses no secrets, and pins its actions to full SHAs.
    - Treat `impact_profile` as shadow-only telemetry. It must not skip, downgrade, or satisfy any required check.
    - For ordinary source PRs, require `source-validation` to generate preview state once and `artifact-preview` to verify the manifest bound to the exact head and run identity. For canonical-sync PRs, rely on `pr-policy` exact-tree reproduction, keep `source-validation` lightweight, require `artifact-preview` to confirm no drift, and retain final CI and CodeQL on the merged `main` commit.
    - Keep timing observational and test sharding opt-in. Required CI must continue to run the full unsharded `npm run test`; deterministic local shards may be used only through `npm run test:local -- --shard-index N --shard-count M`.
```

**File**: `tools/scripts/merge_batch.cjs` (modified, +6/-0)
```diff
@@ -49,6 +49,12 @@ const APPROVAL_WORKFLOW_PATHS = new Set([
   // preview lane for `apps/web-app/**` PRs and must be approvable for fork
   // web-app source contributions alongside ci.yml.
   ".github/workflows/aas-agent-first-preview.yml",
+  // PR-only advisory scanner. It has no manual, push or privileged trigger,
+  // declares only `contents: read` and `checks: read`, uses no secrets, and
+  // pins every action to a full SHA. Its first job only waits for the
+  // exact-head `pr-evidence` result, so it must be approvable for fork PRs
+  // alongside the required workflows.
+  ".github/workflows/skillspector-advisory.yml",
   ".github/workflows/skill-review.yml",
 ]);
 
```

**File**: `tools/scripts/tests/merge_batch.test.js` (modified, +4/-0)
```diff
@@ -266,6 +266,10 @@ function runFixture(overrides = {}) {
     mergeBatch.approvalWorkflowPaths.has(".github/workflows/aas-agent-first-preview.yml"),
     "the pinned read-only AAS agent-first preview workflow must be approvable for fork web-app PRs",
   );
+  assert.ok(
+    mergeBatch.approvalWorkflowPaths.has(".github/workflows/skillspector-advisory.yml"),
+    "the pinned read-only SkillSpector advisory workflow must be approvable for fork skill PRs",
+  );
   const previewValid = mergeBatch.validateActionRequiredRuns(
     [runFixture({ path: ".github/workflows/aas-agent-first-preview.yml", workflow_id: 102 })],
     [workflowFixture({ id: 102, path: ".github/workflows/aas-agent-first-preview.yml" })],
```

---

### Incident Patch 4: `970f453a` (2026-09-29)
**Commit Message**: fix: treat a Git copy origin as read-only in fork classification (#1709)

# fix: treat a Git copy origin as read-only in fork classification

**File**: `.github/MAINTENANCE.md` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ Changed-skill evidence resolves canonical ownership from the changed path's ance
 
 The canonical maintainer skill contains the full [Current CI workflow](../skills/antigravity-maintainer-batch-release/SKILL.md#current-ci-workflow) and [SkillSpector report interpretation](../skills/antigravity-maintainer-batch-release/SKILL.md#skillspector-advisory-ci). `pr-policy` starts `source-validation` and `pr-evidence` in parallel; `artifact-preview` depends on `source-validation`, while the separate PR-only SkillSpector workflow waits for the same PR's exact-head `pr-evidence` result. Semantic review is a separate workflow. SkillSpector remains advisory, including for skill-only PRs; do not infer a complete scan from a green job, bootstrap, empty plan, or zero exit. A nonzero scanner exit can report findings rather than a scanner failure.
 
-- Source-only classification counts the destination of a Git copy as changed; its unchanged origin is not a generated-file mutation. Renames still count both paths. Raw records, blob safety, fork classification and exact-head review remain enforced independently.
+- Source-only classification counts the destination of a Git copy as changed; its unchanged origin is not a generated-file mutation. Renames still count both paths. The fork classifier treats a copy origin as read-only in the same way: Git pairs a copy by similarity against any path already present in the base tree, so the origin's path class is not author-controlled and the same new canonical skill can otherwise pass or fail depending on which existing file Git happened to choose. Copy origins remain subject to raw-path, mode, object, size and total-budget checks, and editing, renaming or deleting that origin still fails closed. Raw records, blob safety, fork classification and exact-head review remain enforced independently.
 
 - `pr-policy` executes the fork-safety intake with code and dependencies materialized from the exact protected base before the dependent required jobs start. The classifier's `NODE_PATH` must point only at that protected-base worktree, never at pull-request-controlled `node_modules`. This is an early, unprivileged rejection of unsafe fork diffs; `merge:batch` still recomputes the trusted decision and remains the only fork-run approval and merge authority. The allowlist also covers browser source under `apps/web-app/src/**` (`.css`, `.ts`, `.tsx`), which cannot change dependencies, lockfiles, build configuration or generated assets: those fork runs may be approved, but the merge still requires an exact-head maintainer attestation.
 - The reported `impact_profile` is shadow telemetry only. It does not skip, downgrade, or satisfy any required check.
```

**File**: `docs/maintainers/merge-batch.md` (modified, +4/-0)
```diff
@@ -46,6 +46,10 @@ Use `--dry-run` to exercise local classification without approving a run or merg
 - reject incomplete evidence coverage, deterministic quality/security/provenance regressions, and base/head drift
 - allow only exact `source_repo` transitions recorded in the trusted protected-base provenance exception ledger; unrecorded or malformed transitions still fail closed
 - for external PRs, poll for asynchronously-created fork runs and approve only runs waiting on `action_required` when every path, mode, object, size, and workflow identity is allowlisted
+- treat a Git copy origin as read-only, because Git pairs a copy by similarity
+  against any path already present in the base tree; the origin's path class is
+  not author-controlled, while its raw path, mode, object, size and total-budget
+  checks still apply and editing, renaming or deleting it still fails closed
 - for sensitive same-repository source changes, allow the guarded exception only when the PR author is the repository owner and the exact full head SHA is attested; collaborator-authored sensitive changes fail closed under the external safety policy
 - wait for the latest required checks bound to the exact head SHA
 - call GitHub's immediate squash-merge endpoint and continue only when it reports `merged: true`
```

**File**: `skills/antigravity-maintainer-batch-release/SKILL.md` (modified, +1/-1)
```diff
@@ -100,7 +100,7 @@ Review findings individually during the pilot. Missing `allowed-tools`, environm
    - Follow the **Current CI workflow** lanes below the source checks. Read available SkillSpector reports with their manifest states and exact-head bindings; never confuse a planning-only, partial, or green advisory run with complete semantic review.
    - Use the repository validation, test, docs-security, source-credit, reference, warning-budget, and targeted app checks required by the changed files.
    - Fix deterministic policy failures in the source; do not wait for them as if they were flaky CI.
-   - For source-only changed paths, a Git copy changes only its destination; renames change both paths. Preserve independent raw-record and blob safety checks and regressions for genuine generated-file mutations.
+   - For source-only changed paths, a Git copy changes only its destination; renames change both paths. Treat a Git copy origin as read-only in the fork classifier too: Git pairs a copy by similarity against any path already in the base tree, so that origin's path class is not author-controlled and the same new canonical skill must not pass or fail depending on which existing file Git chose. Keep its raw-record, mode, object, size and total-budget checks, and keep editing, renaming or deleting that origin as definite failures.
    - Treat `pr-policy` fork classification from the exact protected-base implementation as an unprivileged fail-fast gate before dependent work, never as approval authority. Install and resolve every dependency used by that classifier from the same protected-base worktree; never expose it to pull-request-controlled `node_modules`. `merge:batch` must still recompute the current trusted decision before approving any fork run or merging. The intake allowlist also covers browser source under `apps/web-app/src/**` (`.css`, `.ts`, `.tsx`); those fork runs may be approved, but every web-app source change still requires an exact-head maintainer attestation before merge.
    - Treat `impact_profile` as shadow-only telemetry. It must not skip, downgrade, or satisfy any required check.
    - For ordinary source PRs, require `source-validation` to generate preview state once and `artifact-preview` to verify the manifest bound to the exact head and run identity. For canonical-sync PRs, rely on `pr-policy` exact-tree reproduction, keep `source-validation` lightweight, require `artifact-preview` to confirm no drift, and retain final CI and CodeQL on the merged `main` commit.
```

**File**: `tools/lib/workflow-contract.js` (modified, +9/-6)
```diff
@@ -256,13 +256,16 @@ function classifyChangeRecords(records, options = {}) {
       let pathPolicy = classifyPathPolicy(filePath);
       const reviewedRoots = options.reviewedSkillRoots || [];
       const reviewedSupport = isReviewedSupportPath(filePath, reviewedRoots);
-      // A Git copy reads its origin; only its destination changes. The original
-      // side still passes raw-path, mode, object, size and total-budget checks.
-      const reviewedCopyOrigin = status === "C" && side === "old"
-        && isReviewedSupportPath(record.new_path || "", reviewedRoots);
-      if ((reviewedSupport || reviewedCopyOrigin) && validateRawRepoPath(filePath).safe) {
+      // A Git copy reads its origin; only its destination changes. Git pairs a
+      // copy by similarity against any path that already exists in the base
+      // tree, so the origin's own path class is not author-controlled and the
+      // pull request cannot mutate it. The original side still passes
+      // raw-path, mode, object, size and total-budget checks, and a matching
+      // deletion of that origin still fails closed through its own record.
+      const copyOrigin = status === "C" && side === "old";
+      if ((reviewedSupport || copyOrigin) && validateRawRepoPath(filePath).safe) {
         pathPolicy = { safe: true, sensitive: false, approvalSafe: true,
-          kind: reviewedSupport ? "skill_support" : "reviewed_copy_origin", reasons: [] };
+          kind: reviewedSupport ? "skill_support" : "copy_origin", reasons: [] };
       }
       paths.push({ record: index, side, path: filePath, ...pathPolicy });
       if (!pathPolicy.approvalSafe) {
```

**File**: `tools/scripts/tests/workflow_contracts.test.js` (modified, +73/-0)
```diff
@@ -571,6 +571,79 @@ for (const [filePath, reason] of [
   assert.strictEqual(policy.approvalSafe, true);
 }
 
+{
+  // Git pairs a copy by similarity against any path already present in the base
+  // tree, so the same new canonical SKILL.md can be reported as a copy of a
+  // canonical skill, of a generated plugin mirror, or of nothing at all. The
+  // read-only origin must be accepted in every case; the destination still
+  // carries the reviewed change. Observed on the Beatra skill PRs #1473-#1487.
+  const canonicalCopy = {
+    status: "C",
+    old_path: "skills/suno-lyrics-to-song/SKILL.md",
+    new_path: "skills/example/SKILL.md",
+    old_mode: "100644",
+    new_mode: "100644",
+    old_oid: OLD_OID,
+    new_oid: NEW_OID,
+    old_size: 100,
+    new_size: 100,
+  };
+  const pluginCopy = {
+    ...canonicalCopy,
+    old_path: "plugins/agentic-awesome-skills/skills/suno-lyrics-to-song/SKILL.md",
+  };
+  for (const [label, record] of [
+    ["canonical origin", canonicalCopy],
+    ["generated mirror origin", pluginCopy],
+  ]) {
+    const policy = classifyChangeRecords([record]);
+    assert.strictEqual(policy.approvalSafe, true, label);
+    assert.strictEqual(policy.requiresHumanReview, true, label);
+    assert.deepStrictEqual(policy.canonicalSkillChanges, ["skills/example/SKILL.md"], label);
+    const origin = policy.paths.find((entry) => entry.side === "old");
+    assert.strictEqual(origin.approvalSafe, true, label);
+    assert.strictEqual(origin.kind, "copy_origin", label);
+    assert.ok(!policy.reasons.some((entry) => entry.includes("old_unapproved_path")), label);
+  }
+
+  // A rename modifies the origin, and deleting or editing an unapproved path
+  // stays a definite failure: only the copy origin is read-only.
+  for (const [label, record, reason] of [
+    ["unapproved origin rename", { ...pluginCopy, status: "R" }, "old_unapproved_path"],
+    ["unapproved origin deletion", {
+      status: "D",
+      old_path: pluginCopy.old_path,
+      new_path: null,
+      old_mode: "100644",
+      new_mode: "000000",
+      old_oid: OLD_OID,
+      new_oid: ZERO_OID,
+      old_size: 100,
+    }, "old_unapproved_path"],
+    ["unapproved origin modification", {
+      status: "M",
+      old_path: pluginCopy.old_path,
+      new_path: pluginCopy.old_path,
+      old_mode: "100644",
+      new_mode: "100644",
+      old_oid: OLD_OID,
+      new_oid: NEW_OID,
+      old_size: 100,
+      new_size: 100,
+    }, "old_unapproved_path"],
+    ["copy origin executable mode", { ...pluginCopy, old_mode: "100755" }, "old_executable_mode"],
+    ["copy origin symlink mode", { ...pluginCopy, old_mode: "120000" }, "old_symlink_mode"],
+    ["copy origin unapproved destination", {
+      ...pluginCopy,
+      new_path: "plugins/agentic-awesome-skills/skills/other/SKILL.md",
+    }, "new_unapproved_path"],
+  ]) {
+    const policy = classifyChangeRecords([record]);
+    assert.strictEqual(policy.approvalSafe, false, label);
+    assert.ok(policy.reasons.some((entry) => entry.includes(reason)), `${label}: ${policy.reasons.join(",")}`);
+  }
+}
+
 {
   const policy = classifyChangeRecords([{
     status: "R",
```

---

### Incident Patch 5: `e9e24876` (2026-09-29)
**Commit Message**: fix: keep contrib.rocks headroom so the README shows every contributor (#1683)

# Pull Request Description

Fixes the `## Repo Contributors` image so it actually contains every contributor.

**The bug.** `CONTRIB_ROCKS_MAX` was `500`, and `max` is part of the image URL. contrib.rocks serves a cached image per exact URL for up to three days (`cache-control: public, max-age=259200`), so that URL stayed pinned to a stale avatar count. Right now it renders **362** avatars while the repository has **364** human contributors: `vanshyadav1408` (#1662) and `MohammadHijjawi97` (#1663), the two most recently credited contributors, are missing from the README image entirely.

**Not a transient cache miss.** The same `max=500` URL is deterministic across repeated requests, while `max=499` and `max=501` both return the current 364. Only the exact `500` URL is affected.

```
max=499   avatars=364
max=500   avatars=362   <-- stale, omits the two newest
max=501   avatars=364
```

**The change.** Raise `CONTRIB_ROCKS_MAX` to `2000`. Verified against the live service:

- `max=2000` renders all **364** avatars, with `MuratKaragozgil`, `vanshyadav1408`, and `MohammadHijjawi97` all present
- output dim

**File**: `tools/scripts/sync_contributors.py` (modified, +7/-1)
```diff
@@ -14,7 +14,13 @@
 
 CONTRIBUTOR_SECTION_HEADING = "## Repo Contributors"
 CONTRIBUTOR_SECTION_START = "We officially thank the following contributors for their help in making this repository awesome!\n\n"
-CONTRIB_ROCKS_MAX = 500
+# contrib.rocks serves a cached image per exact URL for up to three days
+# (cache-control: max-age=259200). A low `max` therefore pins the README to a
+# stale avatar count: at max=500 the image kept showing 362 avatars and omitted
+# the two most recent contributors after they were credited. Keep enough
+# headroom that the rendered grid is not the limiting factor as contributors
+# are added between cache refreshes.
+CONTRIB_ROCKS_MAX = 2000
 SPECIAL_LINK_OVERRIDES = {
     "Copilot": "https://github.com/apps/copilot-swe-agent",
     "github-actions[bot]": "https://github.com/apps/github-actions",
```

**File**: `tools/scripts/tests/test_sync_contributors.py` (modified, +16/-1)
```diff
@@ -62,7 +62,10 @@ def test_update_repo_contributors_section_renders_latest_contributors(self):
             ["alice", "github-actions[bot]", "Copilot", "new-user"],
         )
 
-        self.assertIn("https://contrib.rocks/image?repo=sickn33/agentic-awesome-skills&max=500", updated)
+        self.assertIn(
+            f"https://contrib.rocks/image?repo=sickn33/agentic-awesome-skills&max={sync_contributors.CONTRIB_ROCKS_MAX}",
+            updated,
+        )
         self.assertIn("https://github.com/sickn33/agentic-awesome-skills/graphs/contributors", updated)
         self.assertNotIn("- [@alice]", updated)
         self.assertNotIn("- [@new-user]", updated)
@@ -122,6 +125,18 @@ def test_parse_contributors_response_dedupes_and_sorts_order(self):
 
         self.assertEqual(contributors, ["alice", "bob", "github-actions[bot]"])
 
+    def test_contrib_rocks_max_keeps_headroom_over_stale_cache(self):
+        # contrib.rocks caches each exact URL for up to three days. A low max
+        # pinned the README image to a stale avatar count that omitted the two
+        # most recent contributors, so keep clear headroom above any currently
+        # plausible contributor total.
+        self.assertGreaterEqual(sync_contributors.CONTRIB_ROCKS_MAX, 1000)
+        rendered = sync_contributors.render_repo_contributors_section(
+            "sickn33/agentic-awesome-skills"
+        )
+        self.assertNotIn("max=500", rendered)
+        self.assertIn(f"max={sync_contributors.CONTRIB_ROCKS_MAX}", rendered)
+
 
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 6: `28759f14` (2026-09-29)
**Commit Message**: fix: resolve Bing homepage meta description warning (#1678)

# Pull Request Description

Shorten the homepage meta description flagged by Bing Webmaster Tools and keep the live SEO check aligned with the published copy.

**File**: `apps/web-app/scripts/prerender-routes.js` (modified, +2/-2)
```diff
@@ -426,8 +426,8 @@ function buildLandingMeta({ catalogCount, imageUrl, canonicalUrl }) {
   const countLabel = `${formattedCount}+`;
   const title = 'Agentic Awesome Skills | Agent-first skill catalog and AAS Core';
   const description = visibleCount > 0
-    ? `Open-source SKILL.md playbooks for Codex, Claude Code, Cursor, and compatible clients, backed by ${countLabel} cataloged skills. Explore AAS Core for search, agent-owned selection, validation, and plan preview.`
-    : 'Open-source SKILL.md playbooks for Codex, Claude Code, Cursor, and compatible clients. Explore AAS Core for catalog search, agent-owned selection, validation, and plan preview.';
+    ? `Open-source AI coding skills for Codex, Claude Code, Cursor, and more. Explore ${countLabel} playbooks and AAS Core catalog search, selection, and plan preview.`
+    : 'Open-source AI coding skills for Codex, Claude Code, Cursor, and more. Explore AAS Core catalog search, selection, and plan preview.';
   const catalogBaseUrl = canonicalUrl.replace(/\/$/, '');
 
   return {
```

**File**: `apps/web-app/src/utils/__tests__/seo.test.ts` (modified, +3/-1)
```diff
@@ -51,8 +51,10 @@ describe('SEO helpers', () => {
     const meta = buildLandingMeta(2445);
 
     expect(meta.title).toContain('Agentic Awesome Skills');
-    expect(meta.description).toContain('2,445+ cataloged skills');
+    expect(meta.description).toContain('2,445+ playbooks');
     expect(meta.description).toContain('AAS Core');
+    expect(meta.description).toContain('plan preview');
+    expect(meta.description.length).toBeLessThanOrEqual(160);
     expect(meta.canonicalPath).toBe('/');
     expect(meta.ogImage).toBe(DEFAULT_SOCIAL_IMAGE);
     expect(typeof meta.jsonLd).toBe('function');
```

**File**: `apps/web-app/src/utils/seo.ts` (modified, +2/-2)
```diff
@@ -382,8 +382,8 @@ export function buildLandingMeta(skillCount = 0): SeoMeta {
   const countLabel = getCatalogCountLabel(visibleCount);
   const title = 'Agentic Awesome Skills | Agent-first skill catalog and AAS Core';
   const description = visibleCount > 0
-    ? `Open-source SKILL.md playbooks for Codex, Claude Code, Cursor, and compatible clients, backed by ${countLabel} cataloged skills. Explore AAS Core for search, agent-owned selection, validation, and plan preview.`
-    : 'Open-source SKILL.md playbooks for Codex, Claude Code, Cursor, and compatible clients. Explore AAS Core for catalog search, agent-owned selection, validation, and plan preview.';
+    ? `Open-source AI coding skills for Codex, Claude Code, Cursor, and more. Explore ${countLabel} playbooks and AAS Core catalog search, selection, and plan preview.`
+    : 'Open-source AI coding skills for Codex, Claude Code, Cursor, and more. Explore AAS Core catalog search, selection, and plan preview.';
   return {
     title,
     description,
```

**File**: `tools/scripts/check-live-seo-geo.js` (modified, +8/-1)
```diff
@@ -71,7 +71,14 @@ function assertNotIncludes(text, snippet, label) {
 
 function assertLiveSeoDocuments({ home, plugins, sitemap, llms, robots }, expected) {
   assertIncludes(home, 'Agentic Awesome Skills | Agent-first skill catalog and AAS Core', 'home title');
-  assertIncludes(home, `backed by ${expected.countLabel} cataloged skills`, 'home description');
+  const description = home.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1];
+  if (!description) {
+    throw new Error('home description meta tag is missing');
+  }
+  assertIncludes(description, `Explore ${expected.countLabel} playbooks`, 'home description');
+  if (description.length > 160) {
+    throw new Error(`home description is ${description.length} characters; expected no more than 160`);
+  }
   assertIncludes(home, 'SoftwareSourceCode', 'home JSON-LD');
   assertIncludes(home, expected.countLabel, 'home');
   assertNotIncludes(home, 'prompt templates', 'home');
```

**File**: `tools/scripts/tests/check_live_seo_geo.test.js` (modified, +9/-1)
```diff
@@ -2,8 +2,9 @@ const assert = require('node:assert');
 const { assertLiveSeoDocuments } = require('../check-live-seo-geo');
 
 const expected = { countLabel: '1,987+', releaseLabel: 'V15.3.0', pluginCount: 21 };
+const description = 'Open-source AI coding skills for Codex, Claude Code, Cursor, and more. Explore 1,987+ playbooks and AAS Core catalog search, selection, and plan preview.';
 const documents = {
-  home: 'Agentic Awesome Skills | Agent-first skill catalog and AAS Core backed by 1,987+ cataloged skills SoftwareSourceCode FAQ specialized plugin',
+  home: `Agentic Awesome Skills | Agent-first skill catalog and AAS Core <meta name="description" content="${description}"> SoftwareSourceCode FAQ specialized plugin`,
   plugins: 'AAS Specialized Plugins | 21 AI coding workflow packs specialized plugin packs numberOfItems',
   sitemap: 'https://aaskills.tech/plugins',
   llms: 'https://aaskills.tech/plugins Current release: V15.3.0. 1,987+',
@@ -18,6 +19,13 @@ assert.throws(
   }, expected),
   /home title/,
 );
+assert.throws(
+  () => assertLiveSeoDocuments({
+    ...documents,
+    home: documents.home.replace(description, `${description} Add more words beyond the supported meta description length.`),
+  }, expected),
+  /no more than 160/,
+);
 assert.throws(
   () => assertLiveSeoDocuments({ ...documents, home: `${documents.home} prompt templates` }, expected),
   /stale snippet/,
```

---

### Incident Patch 7: `66afb462` (2026-09-29)
**Commit Message**: fix: align live SEO checks with catalog metadata (#1677)

**File**: `tools/scripts/check-live-seo-geo.js` (modified, +2/-3)
```diff
@@ -70,10 +70,9 @@ function assertNotIncludes(text, snippet, label) {
 }
 
 function assertLiveSeoDocuments({ home, plugins, sitemap, llms, robots }, expected) {
-  assertIncludes(home, `AAS Core Preview | Agent-first stacks backed by ${expected.countLabel} skills`, 'home');
+  assertIncludes(home, 'Agentic Awesome Skills | Agent-first skill catalog and AAS Core', 'home title');
+  assertIncludes(home, `backed by ${expected.countLabel} cataloged skills`, 'home description');
   assertIncludes(home, 'SoftwareSourceCode', 'home JSON-LD');
-  assertIncludes(home, 'FAQPage', 'home JSON-LD');
-  assertIncludes(home, 'specialized plugins', 'home');
   assertIncludes(home, expected.countLabel, 'home');
   assertNotIncludes(home, 'prompt templates', 'home');
 
```

**File**: `tools/scripts/tests/check_live_seo_geo.test.js` (modified, +3/-3)
```diff
@@ -3,7 +3,7 @@ const { assertLiveSeoDocuments } = require('../check-live-seo-geo');
 
 const expected = { countLabel: '1,987+', releaseLabel: 'V15.3.0', pluginCount: 21 };
 const documents = {
-  home: 'AAS Core Preview | Agent-first stacks backed by 1,987+ skills SoftwareSourceCode FAQPage specialized plugins',
+  home: 'Agentic Awesome Skills | Agent-first skill catalog and AAS Core backed by 1,987+ cataloged skills SoftwareSourceCode FAQ specialized plugin',
   plugins: 'AAS Specialized Plugins | 21 AI coding workflow packs specialized plugin packs numberOfItems',
   sitemap: 'https://aaskills.tech/plugins',
   llms: 'https://aaskills.tech/plugins Current release: V15.3.0. 1,987+',
@@ -14,9 +14,9 @@ assert.doesNotThrow(() => assertLiveSeoDocuments(documents, expected));
 assert.throws(
   () => assertLiveSeoDocuments({
     ...documents,
-    home: 'Agentic Awesome Skills GitHub | 1,987+ AI coding skills SoftwareSourceCode FAQPage specialized plugins',
+    home: 'Agentic Awesome Skills GitHub | 1,987+ AI coding skills SoftwareSourceCode FAQ specialized plugin',
   }, expected),
-  /AAS Core Preview/,
+  /home title/,
 );
 assert.throws(
   () => assertLiveSeoDocuments({ ...documents, home: `${documents.home} prompt templates` }, expected),
```

---

### Incident Patch 8: `c4fcb569` (2026-09-28)
**Commit Message**: fix: override ip-address to clear loki-mode lockfile advisories (#1675)

# Pull Request Description

Closes the four open Dependabot alerts for `ip-address` in the `loki-mode` example backend lockfile.

`express-rate-limit@8.7.0` pulls `ip-address@10.4.0`, which is affected by two moderate advisories:

- GHSA-rpw4-54j3-4h4q - `Address6.isLinkLocal()` matches all of `fe80::/64` instead of only `fe80::/10`
- GHSA-2vr4-cq9g-pvrc - the NAT64 local-use range `64:ff9b::/96` is not classified as local use

Both are fixed in `ip-address@10.5.1`. The lockfile now resolves `10.7.2`.

The change follows the override pattern already used in this `package.json` (`diff`, `path-to-regexp`, `qs`). The mirrored `plugins/agentic-awesome-skills-claude/**` copy is regenerated by the protected canonical-sync lane, so this PR touches only the canonical source.

**File**: `skills/loki-mode/examples/todo-app-generated/backend/package-lock.json` (modified, +3/-3)
```diff
@@ -933,9 +933,9 @@
       "license": "ISC"
     },
     "node_modules/ip-address": {
-      "version": "10.4.0",
-      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.4.0.tgz",
-      "integrity": "sha512-oSK96Grm3aP6OrS263xVxbNDGVL7rzBtYdpGqlDG8iQdoenDoTs/nkki+DflYbAEE8Xl6o5YxhxlrKvI3nqKXQ==",
+      "version": "10.7.2",
+      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz",
+      "integrity": "sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==",
       "license": "MIT",
       "engines": {
         "node": ">= 12"
```

**File**: `skills/loki-mode/examples/todo-app-generated/backend/package.json` (modified, +2/-1)
```diff
@@ -25,6 +25,7 @@
   "overrides": {
     "diff": "4.0.4",
     "path-to-regexp": "0.1.13",
-    "qs": "^6.16.0"
+    "qs": "^6.16.0",
+    "ip-address": "^10.5.1"
   }
 }
```

---

### Incident Patch 9: `6fc875bb` (2026-09-28)
**Commit Message**: fix: resolve relative installer --path against cwd once (#1673)

# Pull Request Description

Fixes #1670.

`resolveDir()` in `tools/bin/install.js` resolved a relative `--path` against the working directory twice:

```js
const root = path.isAbsolute(s) ? path.parse(path.resolve(s)).root : process.cwd();
const sanitizedSegments = path.resolve(s).slice(path.parse(path.resolve(s)).root.length)...
return path.resolve(root, ...sanitizedSegments);
```

For relative input, `path.resolve(s)` already contains the cwd, and the segments stripped only the leading `/`, so `root` (the cwd) was prepended a second time.

Before, from `/home/user/my-project`:

```
npx agentic-awesome-skills --path .agents/skills --dry-run
Custom: /home/user/my-project/home/user/my-project/.agents/skills
```

After:

```
Custom: /home/user/my-project/.agents/skills
```

Absolute and `~`-prefixed paths were already correct and are unchanged. The per-segment sanitization stays in place, so unsafe segments still fail closed with `Unsafe path segment:`.

**File**: `tools/bin/install.js` (modified, +8/-4)
```diff
@@ -21,10 +21,13 @@ const EXACT_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9
 function resolveDir(p) {
   if (!p) return null;
   const s = p.replace(/^~($|\/)/, HOME + "$1");
-  const root = path.isAbsolute(s) ? path.parse(path.resolve(s)).root : process.cwd();
-  const sanitizedSegments = path
-    .resolve(s)
-    .slice(path.parse(path.resolve(s)).root.length)
+  // Resolve the path exactly once. For relative input the resolved path
+  // already contains the working directory, so joining the extracted
+  // segments against cwd again would duplicate it.
+  const resolved = path.resolve(s);
+  const root = path.parse(resolved).root;
+  const sanitizedSegments = resolved
+    .slice(root.length)
     .split(path.sep)
     .filter(Boolean)
     .map((segment) => {
@@ -1403,6 +1406,7 @@ module.exports = {
   buildAntigravitySelectionMessage,
   printDryRunPlan,
   parseArgs,
+  resolveDir,
   printImplicitFullInstallWarning,
   printAuditReport,
   pruneRemovedEntries,
```

**File**: `tools/scripts/tests/installer_cli_args.test.js` (modified, +17/-0)
```diff
@@ -38,6 +38,23 @@ assert.throws(
 
 const version = spawnSync(process.execPath, [installerPath, '--version'], { encoding: 'utf8' });
 assert.strictEqual(version.status, 0, version.stderr);
+
+// Regression: a relative --path must resolve against the current working
+// directory exactly once. It previously extracted segments from the already
+// resolved path and then prefixed cwd again, doubling the install directory.
+assert.strictEqual(installer.resolveDir('.agents/skills'), path.resolve('.agents/skills'));
+assert.strictEqual(installer.resolveDir('project/.agents/skills'), path.resolve('project/.agents/skills'));
+assert.notStrictEqual(
+  installer.resolveDir('.agents/skills'),
+  path.resolve(process.cwd(), process.cwd().slice(1), '.agents', 'skills'),
+);
+assert.strictEqual(installer.resolveDir('/tmp/aas-absolute-target'), path.resolve('/tmp/aas-absolute-target'));
+assert.strictEqual(installer.resolveDir(null), null);
+assert.strictEqual(installer.resolveDir(''), null);
+// Traversal is normalized away instead of being re-joined against cwd.
+assert.strictEqual(installer.resolveDir('.agents/../skills'), path.resolve('skills'));
+// Segment sanitization still fails closed on characters it would strip.
+assert.throws(() => installer.resolveDir('agents/ba*d'), /Unsafe path segment/i);
 assert.strictEqual(version.stdout.trim(), packageVersion);
 assert.doesNotMatch(version.stdout, /Cloning repository/i);
 
```

---

### Incident Patch 10: `463b781e` (2026-09-28)
**Commit Message**: fix: refresh Jev Social runtime pin to v0.1.10 (#1656)

# Pull Request Description

Refresh the existing Jev Social catalog skill from its v0.1.8 runtime pin to the reviewed runtime commit included in v0.1.10.

This keeps the catalog workflow source-only and read-only while documenting the v0.1.10 boundaries that matter to users and reviewers:

- OpenRouter or an explicitly user-started loopback `/v1/systemone` decision provider;
- deterministic report generation with `OPENROUTER_REPORT_MODEL=off`;
- `SOCAI_TELEMETRY=0` for spawned `socai` children unless the user explicitly opts in with `1`;
- the distinction between provider configuration reported by `status` and actual connectivity first exercised by a research call;
- continued exclusion of automatic onboarding because its optional installer follows a moving `releases/latest` URL.

The executable and MIT-license references now use full runtime commit `baf3cd6aa4f9c881665c29ed29a10391f761760b`, which is an ancestor of the annotated `v0.1.10` release tag. I maintain Jev Social under `socai-io`. Codex assisted with the wording, source audit, tests, and review.

Generated catalogs, indexes, plugin mirrors, and marketplace artifacts

**File**: `skills/jev-social/SKILL.md` (modified, +11/-9)
```diff
@@ -11,15 +11,15 @@ author: socai-io
 tags: [social-media, research, instagram, tiktok, linkedin, browser-automation, jev]
 tools: [claude, codex]
 license: "MIT"
-license_source: "https://github.com/socai-io/jev-social/blob/5270e23cfd27aace9055669ee396926973baa241/LICENSE"
+license_source: "https://github.com/socai-io/jev-social/blob/baf3cd6aa4f9c881665c29ed29a10391f761760b/LICENSE"
 ---
 # Jev Social
 
 ## Overview
 
 Jev Social turns a natural-language social research goal into bounded Jev routing decisions, then delegates platform-read-only browser work to the local socai CLI. Use the captured posts, profiles, comments, videos, and opened details to produce a compact, source-linked report instead of exposing raw CLI output. "Read-only" means no social-account mutation; the CLI still writes private local run records and may download requested media.
 
-The executable examples below are pinned to the tested runtime commit included in Jev Social `v0.1.8`. A pin improves reproducibility but is not a trust guarantee; keep the package, browser data, and returned content inside the safety boundaries below.
+The executable examples below are pinned to the tested runtime commit included in Jev Social `v0.1.10`. A pin improves reproducibility but is not a trust guarantee; keep the package, browser data, and returned content inside the safety boundaries below.
 
 ## When to Use
 - Use when a user requests evidence-backed research on Instagram, TikTok, or LinkedIn and wants real public posts or profiles rather than a general web summary.
@@ -32,7 +32,7 @@ The executable examples below are pinned to the tested runtime commit included i
 The workflow requires:
 
 1. Node.js and `npx`.
-2. A configured Jev provider key in the user's approved local environment.
+2. A configured decision provider: either a user-provided OpenRouter API key with Jev access or a user-started TypeSafe-compatible server on the exact loopback `/v1/systemone` endpoint. OpenRouter calls may incur provider charges; the loopback provider does not require or receive the OpenRouter key. Set `OPENROUTER_REPORT_MODEL=off` when report generation must stay on the deterministic evidence path.
 3. An installed socai CLI with support for the requested platform.
 4. A Chrome session the user is already authorized to use.
 
@@ -45,19 +45,19 @@ If the exact pinned package is not already available locally, explain that the n
 Run the status command before every research task:
 
 ```bash
-npx github:socai-io/jev-social#5270e23cfd27aace9055669ee396926973baa241 status
+npx github:socai-io/jev-social#baf3cd6aa4f9c881665c29ed29a10391f761760b status
 ```
 
 Require all of the following before continuing:
 
-- Jev is configured without revealing the provider key.
+- The selected decision provider is configured without revealing its key or loopback endpoint. A configured local provider does not require an OpenRouter key. The status command does not probe provider connectivity; if the later research call cannot reach the provider, stop and report that runtime gate without exposing connection details.
 - socai is installed and executable.
 - The requested platform reports supported.
 - The browser boundary matches the user's existing authorized local session.
 
 Treat status output as local diagnostics. Never reproduce configuration paths, executable paths, environment values, credentials, CDP endpoints, or browser-profile details in the answer.
 
-If setup is missing, identify only the missing prerequisite and stop. Do not run this release's automatic onboarding or installer from the catalog skill: its optional socai installation path follows a moving `releases/latest` URL. Have the user configure the key and install a separately reviewed, pinned socai release outside this workflow. Never place an API key in a command, transcript, report, issue, or committed file.
+If setup is missing, identify only the missing prerequisite and stop. Do not run this release's automatic onboarding or inst
```

#### Recent Merged Pull Requests:
- **PR #1728** (closed): feat: add threews-3d-studio skill for text and image to 3D GLB generation (@nirholas)
- **PR #1725** (2026-09-30): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1724** (2026-09-30): fix: recompute the README Top Contributors rankings automatically (@sickn33)
- **PR #1723** (2026-09-30): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1721** (2026-09-30): chore: release v18.10.0 (@sickn33)
- **PR #1720** (2026-09-30): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1719** (2026-09-30): fix: resolve the open Dependabot advisories and stage the 18.10.0 changelog entry (@sickn33)
- **PR #1718** (2026-09-30): chore: synchronize canonical repository state (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
