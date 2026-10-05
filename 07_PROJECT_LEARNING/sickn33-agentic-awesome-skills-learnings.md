# Forensic Learning Record (Deep Inspection): sickn33/agentic-awesome-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/sickn33-agentic-awesome-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:01:08.140Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sickn33/agentic-awesome-skills`
- **Description**: AAS Core is the local, agent-first control plane for complete catalog discovery, agent-owned selection, stack validation, and planning, backed by 2,400+ agentic skills. Includes CLI, local MCP, catalog, plugins, and Workbench.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 47274 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
    skill.description,
    skill.category,
    skill.source,
    skill.path,
  ].filter(Boolean).join(' '));
  const category = normalizeMatchText(skill.category);
  const relatedCategories = Array.isArray(page.relatedCategories)
    ? page.relatedCategories.map(normalizeMatchText)
    : [];
  let score = relatedCategories.includes(category) ? 12 : 0;

  for (const term of getLandingPageMatchTerms(page)) {
    const normalizedTerm = normalizeMatchText(term);

    if (!normalizedTerm || normalizedTerm.length < 3) {
      continue;
    }

    if (haystack.includes(normalizedTerm)) {
      score += Math.min(12, 3 + normalizedTerm.split(' ').length * 2);
      continue;
    }

    const matchedTokens = normalizedTerm
      .split(' ')
      .filter((token) => token.length >= 4 && haystack.includes(token));

    score += Math.min(6, matchedTokens.length);
  }

  return score;
}

function getRelatedLandingPagesForSkill(landingPages, skill, limit = 3) {
  const maxItems = Math.max(0, limit);

  if (maxItems === 0) {
    return [];
  }

  const scoredPages = landingPages
    .map((page, index) => ({
      page,
      index,
      score: scoreLandingPageForSkill(page, skill),
    }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }

      return a.index - b.index;
    });
  const selected = scoredPages.filter(({ score }) => score > 0).map(({ page }) => page);

  for (const { page } of scoredPages) {
    if (selected.length >= maxItems) {
      break;
    }

    if (!selected.includes(page)) {
      selected.push(page);
    }
  }

  return selected.slice(0, maxItems);
}

function getCuratedSkillsForLandingPage(page, skills, limit = 12) {
  const maxItems = Math.max(0, limit);
  if (maxItems === 0 || !Array.isArray(skills)) return [];

  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const editorial = (Array.isArray(page.featuredSkillIds) ? page.featuredSkillIds : [])
    .map((id) => byId.get(id))
    .filter(Boolea
```

### Core Architecture Module: `apps/web-app/src/hooks/usePageMeta.ts`
```
import { useEffect } from 'react';
import type { SeoMeta } from '../types';
import { setPageMeta } from '../utils/seo';

export function usePageMeta(meta: SeoMeta): void {
  useEffect(() => {
    setPageMeta(meta);
  }, [meta]);
}

```

### Core Architecture Module: `apps/web-app/src/hooks/useSkillShortlist.ts`
```
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'aas_skill_shortlist';
const CHANGE_EVENT = 'aas-skill-shortlist-change';

function readStoredValue(): string | null | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    // Some private or restricted browsing contexts reject storage reads.
    return undefined;
  }
}

function readShortlist(): string[] {
  try {
    const value: unknown = JSON.parse(readStoredValue() || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeShortlist(ids: string[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    // Local storage can be unavailable in private or restricted browsing contexts.
    return false;
  }
}

/** A browser-local working set for comparing and exporting exact skill IDs. */
export function useSkillShortlist() {
  const [ids, setIds] = useState<string[]>(readShortlist);
  // Snapshot of the last value confirmed in browser storage. Guards the persistence effect so
  // it never echoes a change back that its own change/storage listeners caused
  // (which would make two hooks ping-pong and re-render forever), and lets us
  // restore the UI when a browser rejects a write.
  const persistedRef = useRef<string[]>(ids);

  useEffect(() => {
    const sync = () => setIds(readShortlist());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Persist the current ids whenever they change. Writing here (instead of
  // inside the setIds updater above) keeps the updater pure: React StrictMode
  // double-invokes updaters in dev, and a side effect there would fire twice.
  useEffect(() => {
    const next = JSON.stringify(ids);
    const persisted = JSON.stringify(persistedRef.current);
    if (next === persisted) return;
    // Only actually write when the stored value differs, so storage-synced
    // updates don't get re-broadcast (or dispatch a spurious change event).
    const stored = readStoredValue();
    if (stored === next) {
      persistedRef.current = ids;
      return;
    }
    if (stored !== undefined && writeShortlist(ids)) {
      persistedRef.current = ids;
      return;
    }

    // Keep the UI honest when persistence is unavailable or fails. The
    // shortlist is described as browser-saved, so don't display a transient
    // selection that will disappear on reload.
    setIds(persistedRef.current);
  }, [ids]);

  const toggle = useCallback((skillId: string) => {
    setIds((current) =>
      current.includes(skillId)
        ? current.filter((id) => id !== skillId)
        : [...current, skillId]
    );
  }, []);

  const clear = useCallback(() => {
    setIds([]);
  }, []);

  return { ids, toggle, clear };
}

```

### Core Architecture Module: `apps/web-app/src/hooks/useSkillStars.ts`
```
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'saved_skills';
const LEGACY_STORAGE_KEY = 'user_stars';
const CHANGE_EVENT = 'aas-saved-skills-change';

interface UserStars {
  [skillId: string]: boolean;
}

interface UseSkillStarsReturn {
  hasSaved: boolean;
  handleSaveClick: () => Promise<void>;
  isSaving: boolean;
}

/**
 * Safely parse localStorage data with error handling
 */
function parseStoredStars(storageKey: string): UserStars {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    );
  } catch (error) {
    console.warn(`Failed to parse ${storageKey} from localStorage:`, error);
    return {};
  }
}

function getUserStarsFromStorage(): UserStars {
  return {
    ...parseStoredStars(LEGACY_STORAGE_KEY),
    ...parseStoredStars(STORAGE_KEY),
  };
}

/**
 * Safely save to localStorage with error handling
 */
function saveUserStarsToStorage(stars: UserStars): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stars));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch (error) {
    console.warn(`Failed to save ${STORAGE_KEY} to localStorage:`, error);
    return false;
  }
}

/**
 * Hook to manage local skill saves in the browser.
 */
export function useSkillStars(skillId: string | undefined): UseSkillStarsReturn {
  const [userStars, setUserStars] = useState<UserStars>(() => getUserStarsFromStorage());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const hasSaved = Boolean(skillId && userStars[skillId]);

  useEffect(() => {
    const sync = (event: Event) => {
      if (event.type === 'storage') {
        const key = (event as StorageEvent).key;
        if (key && key !== STORAGE_KEY && key !== LEGACY_STORAGE_KEY) return;
      }
      setUserStars(getUserStarsFromStorage());
    };

    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  /**
   * Save a skill locally in this browser without pretending to update shared metrics.
   */
  const handleSaveClick = useCallback(async () => {
    if (!skillId || isSaving) return;

    const storedStars = getUserStarsFromStorage();
    if (storedStars[skillId]) {
      setUserStars(storedStars);
      return;
    }

    setIsSaving(true);

    try {
      const updatedStars = { ...storedStars, [skillId]: true };
      if (saveUserStarsToStorage(updatedStars)) {
        setUserStars(updatedStars);
      }
    } catch (error) {
      console.error('Failed to save skill locally:', error);
    } finally {
      setIsSaving(false);
    }
  }, [skillId, isSaving]);

  return {
    hasSaved,
    handleSaveClick,
    isSaving
  };
}

export default useSkillStars;

```

### Core Architecture Module: `apps/web-app/src/utils/catalogRelease.ts`
```
import { version } from '../../../../package.json';

export const catalogVersion = version;
const repository = 'https://github.com/sickn33/agentic-awesome-skills';
const releaseRoot = `${repository}/blob/v${version}/`;

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

/** Resolve repository files within the same release, never against the Pages base. */
export function releaseFileUrl(path: string, from = '', image = false): string {
  if (!path || path.includes('\\') || hasControlCharacters(path) || path.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(path)) return '';
  try {
    const url = new URL(path, `${releaseRoot}${from}`);
    if (!url.href.startsWith(releaseRoot)) return '';
    // Reject encoded separators and nested encodings before the hosting service decodes them.
    for (const segment of url.pathname.split('/')) {
      const decoded = decodeURIComponent(segment);
      if (/[\\/%]/.test(decoded) || hasControlCharacters(decoded)) return '';
    }
    url.search = '';
    if (image) return url.href.replace(`${repository}/blob/`, 'https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/');
    return url.href;
  } catch {
    return '';
  }
}

export function skillSourcePath(path: string): string {
  const normalized = path.startsWith('skills/') ? path : `skills/${path}`;
  if (!/^skills\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*(?:\/SKILL\.md)?$/.test(normalized)) return '';
  return normalized.endsWith('/SKILL.md') ? normalized : `${normalized}/SKILL.md`;
}

export function skillBundleUrl(path: string): string {
  const source = skillSourcePath(path);
  return source ? releaseFileUrl(source).replace('/blob/', '/tree/').replace(/\/SKILL\.md$/, '') : '';
}

```

### Core Architecture Module: `apps/web-app/src/utils/catalogSearch.ts`
```
import ontology from '../../../../tools/lib/aas-v1/ontology.v1.json';
import type { Skill } from '../types';

export type SearchMode = 'all' | 'any' | 'fuzzy';
export function searchMode(value: string | null): SearchMode {
  return value === 'any' || value === 'fuzzy' ? value : 'all';
}

function alias(map: Record<string, string>, value: string): string {
  return Object.prototype.hasOwnProperty.call(map, value) ? map[value] : value;
}

export function categoryFacet(value: string): string {
  return alias(ontology.categoryAliases, (value || 'uncategorized').normalize('NFKC').trim().toLowerCase().replace(/[\s_]+/g, '-'));
}

function token(value: string): string {
  return alias(ontology.aliases, value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9+#./-]+/g, '-').replace(/^-+|-+$/g, ''));
}

function terms(value: string): string[] {
  return [...new Set(value.trim().split(/\s+/).map(token).filter(Boolean))];
}

function fuzzyMatch(needle: string, haystack: string): boolean {
  let cursor = 0;
  for (const character of needle) {
    const found = haystack.indexOf(character, cursor);
    if (found === -1) return false;
    cursor = found + 1;
  }
  return true;
}

/** Literal modes share Core token aliases. Fuzzy matching is an explicit browser option.
 * Neither mode ranks results or uses risk/source metadata to decide eligibility. */
export function matchCatalogSkill(skill: Skill, query: string, mode: SearchMode, required = ''): { matches: boolean; explanation: string } {
  const fields = [skill.id, skill.name, skill.description, skill.category, ...(skill.tags || [])].map((field) => String(field || ''));
  const tokens = new Set(fields.flatMap((field) => [token(field), ...field.split(/[\s/.,:;()_-]+/).map(token)]).filter(Boolean));
  const requiredTerms = terms(required);
  if ((required.trim() && !requiredTerms.length) || !requiredTerms.every((term) => tokens.has(term))) return { matches: false, explanation: '' };
  const queryTerms = mode === 'fuzzy' ? query.trim().toLowerCase().split(/\s+/).filter(Boolean) : terms(query);
  const matched = queryTerms.filter((term) => mode === 'fuzzy'
    ? fields.some((field) => fuzzyMatch(term, field.toLowerCase()))
    : tokens.has(term));
  const matches = !query.trim() || (queryTerms.length > 0 && (mode === 'any' ? matched.length > 0 : matched.length === queryTerms.length));
  const explanation = [matched.length ? `${mode === 'fuzzy' ? 'Approximate match' : 'Matched terms'}: ${matched.join(', ')}` : '',
    requiredTerms.length ? `Required: ${requiredTerms.join(', ')}` : ''].filter(Boolean).join(' · ');
  return { matches, explanation };
}

```

### Core Architecture Module: `apps/web-app/src/utils/installationHandoff.ts`
```
export type CommandShell = 'posix' | 'powershell';
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ID = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;

/** Prepare text only. Never executes, downloads, or treats a Core plan as installer state. */
export function buildInstallationPreview(ids: string[], version: string, destination: string, shell: CommandShell, packageName = 'agentic-awesome-skills'): string {
  if (packageName !== 'agentic-awesome-skills' || !VERSION.test(version)) throw new Error('An exact AAS release version is required.');
  if (!ids.length || ids.length > 128 || ids.some((id) => !ID.test(id) || id.length > 200 || id.split('/').some((part) => part === '.' || part === '..')) || new Set(ids).size !== ids.length) throw new Error('Choose between 1 and 128 distinct skill IDs.');
  if (!destination.trim() || destination.length > 1000 || /^[~-]/.test(destination) || Array.from(destination).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Enter a skill directory using a full path or a project-relative path; expand ~ yourself.');
  if (shell === 'powershell' && /["&|<>^%!`$()]/.test(destination)) throw new Error('For npm.cmd, use a directory without shell metacharacters.');
  const quote = (value: string) => shell === 'powershell' ? `'${value.split("'").join( "''")}'` : `'${value.split("'").join( "'\\''")}'`;
  return `${shell === 'powershell' ? 'npm.cmd' : 'npm'} exec --yes --ignore-scripts --package=agentic-awesome-skills@${version} -- agentic-awesome-skills --release ${version} --path ${quote(destination)} --skills ${quote(ids.join(','))} --dry-run`;
}

```

### Core Architecture Module: `apps/web-app/src/utils/markdownHeadings.d.ts`
```
export function assignHeadings(tree: unknown): Array<{ label: string; id: string }>;
export function remarkHeadings(): (tree: unknown) => void;

```

### Core Architecture Module: `apps/web-app/src/utils/markdownHeadings.js`
```
function plainText(node) {
  return node.value ?? node.alt ?? node.children?.map(plainText).join('') ?? '';
}

// Shared by browser rendering, static HTML, and link verification.
export function assignHeadings(tree) {
  const used = new Set();
  const outline = [];
  function visit(node) {
    if (node.type === 'heading') {
      const label = plainText(node).trim();
      const slug = label.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
      let id = slug;
      let suffix = 0;
      while (used.has(id)) id = `${slug}-${++suffix}`;
      used.add(id);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } };
      if (node.depth === 2) outline.push({ label, id });
    }
    node.children?.forEach(visit);
  }
  visit(tree);
  return outline;
}

export function remarkHeadings() {
  return (tree) => { assignHeadings(tree); };
}

```

### Core Architecture Module: `apps/web-app/src/utils/outcomeDiscovery.ts`
```
import type { Skill } from '../types';
import compatibilityAliases from '../../../../docs/contributors/content-aliases.json';

export const OUTCOME_PRESETS = [
  { label: 'Fix a bug', goal: 'Systematic debugging and regression testing' },
  { label: 'Ship a web feature', goal: 'Build an accessible React interface with tests' },
  { label: 'Review security', goal: 'Review application security and authentication vulnerabilities' },
  { label: 'Understand my data', goal: 'Data analysis, data quality and dashboard design' },
  { label: 'Improve conversion', goal: 'Improve landing page conversion with copywriting and experiments' },
  { label: 'Prepare a release', goal: 'Release review and deployment checklist' },
] as const;

const STOP_WORDS = new Set('a an and are as at be by for from how i in is it me my of on or our the this to want with without un una e di del della per con che il la le lo gli da come mio voglio'.split(' '));
const ALIASES: Record<string, string> = {
  debugging: 'debug', debuggen: 'debug', bug: 'debug', bugs: 'debug', fix: 'debug', failing: 'debug',
  tests: 'test', testing: 'test', tested: 'test',
  sicurezza: 'security', vulnerabilities: 'security', vulnerability: 'security',
  dati: 'data', analisi: 'analysis', analyze: 'analysis', analytics: 'analysis',
  accessibile: 'accessibility', accessible: 'accessibility',
  conversione: 'conversion', conversioni: 'conversion',
  authentication: 'auth', autenticazione: 'auth',
  deploy: 'deployment', deploys: 'deployment',
};

export function outcomeTerms(text: string): string[] {
  return [...new Set(text.slice(0, 1000).normalize('NFKC').toLowerCase()
    .split(/[^\p{L}\p{N}+#]+/u).filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => Object.prototype.hasOwnProperty.call(ALIASES, word) ? ALIASES[word] : word))].slice(0, 32);
}

/** Recognize explicit single-term exclusions; show them so the caller can inspect interpretation. */
export function parseOutcomeGoal(goal: string): { positive: string; excluded: string[] } {
  const excluded: string[] = [];
  const positive = goal.slice(0, 1000).replace(/\b(?:without|senza|excluding)\s+([\p{L}\p{N}+#._-]+)/giu, (_, term: string) => {
    excluded.push(...outcomeTerms(term));
    return ' ';
  });
  return { positive, excluded: [...new Set(excluded)] };
}

export function outcomeAliases(id: string): string[] {
  return compatibilityAliases.groups.find((group) => group.ids.includes(id))?.ids.filter((alias) => alias !== id) || [];
}

export function groupOutcomeMatches(matches: OutcomeMatch[]): Array<OutcomeMatch & { alternatives: Skill[] }> {
  const seen = new Set<string>();
  return matches.flatMap((match) => {
    if (seen.has(match.skill.id)) return [];
    const aliases = outcomeAliases(match.skill.id);
    [match.skill.id, ...aliases].forEach((id) => seen.add(id));
    return [{ ...match, alternatives: matches.map((item) => item.skill).filter((skill) => aliases.includes(skill.id)) }];
  });
}

export interface OutcomeMatch { skill: Skill; score: number; matched: string[]; totalTerms: number }

/** Browser-only discovery: descriptive relevance, never quality or Core eligibility. */
export function rankForOutcome(skills: Skill[], goal: string): OutcomeMatch[] {
  const { positive, excluded } = parseOutcomeGoal(goal);
  const terms = outcomeTerms(positive);
  if (!terms.length) return [];
  const indexed = skills.map((skill) => {
    const identity = new Set(outcomeTerms(`${skill.id} ${skill.name} ${(skill.tags || []).join(' ')}`));
    const description = new Set(outcomeTerms(skill.description));
    const category = new Set(outcomeTerms(skill.category));
    return { skill, identity, description, category };
  });
  const eligible = indexed.filter(({ identity, description, category }) => !excluded.some((term) => identity.has(term) || description.has(term) || category.has(term)));
  const frequency = new Map(terms.map((term) => [term, indexed.filter(({ identity, description, category }) => identity.has(term) || description.has(term) || category.has(term)).length]));
  return eligible.map(({ skill, identity, description, category }) => {
    const matched = terms.filter((term) => identity.has(term) || description.has(term) || category.has(term));
    const score = matched.reduce((sum, term) => sum + (identity.has(term) ? 3 : description.has(term) ? 2 : 1) * Math.log(1 + skills.length / (1 + (frequency.get(term) || 0))), 0);
    return { skill, score, matched, totalTerms: terms.length };
  }).filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || b.matched.length - a.matched.length || a.skill.id.localeCompare(b.skill.id, 'en'));
}

export function evidenceSignals(skill: Skill): Array<{ label: string; value: string }> {
  return [
    { label: 'Provenance', value: skill.source_repo ? `Declared source: ${skill.source_repo}` : skill.source === 'self' ? 'Author declares original work' : skill.source ? `Declared source: ${skill.source}` : 'Source not recorded' },
    { label: 'License', value: skill.license || 'Not recorded in catalog' },
    { label: 'Risk', value: !skill.risk || skill.risk === 'unknown' ? 'Not assessed in catalog' : `Author-declared: ${skill.risk}` },
    { label: 'Setup', value: skill.plugin?.setup.type === 'manual' ? skill.plugin.setup.summary || 'Manual setup required' : skill.plugin ? 'No extra setup declared' : 'Not recorded in catalog' },
  ];
}

```

### Core Architecture Module: `apps/web-app/src/utils/publicAssetUrls.ts`
```
export interface PublicAssetUrlInput {
  baseUrl: string;
  origin: string;
  pathname: string;
  documentBaseUrl?: string;
}

export type SkillsIndexUrlInput = PublicAssetUrlInput;

export interface SkillMarkdownUrlInput extends PublicAssetUrlInput {
  skillPath: string;
}

function stripLeadingSlashes(path: string): string {
  return path.replace(/^\/+/, '');
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function normalizeSkillsAssetPath(assetPath: string): string | null {
  const normalized = assetPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/SKILL\.md$/i, '');

  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized) || normalized.startsWith('//')) {
    return null;
  }

  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0 || segments[0] !== 'skills') {
    return null;
  }

  for (const segment of segments) {
    const decoded = decodePathSegment(segment);
    if (
      decoded === null
      || decoded === '.'
      || decoded === '..'
      || decoded.includes('/')
      || decoded.includes('\\')
      || decoded.includes('\0')
    ) {
      return null;
    }
  }

  return segments.join('/');
}

function normalizePathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function getResolvedDocumentBaseUrl({
  baseUrl,
  origin,
  documentBaseUrl,
}: Pick<PublicAssetUrlInput, 'baseUrl' | 'origin' | 'documentBaseUrl'>): URL {
  if (documentBaseUrl) {
    return new URL(documentBaseUrl);
  }

  return new URL(normalizeBasePath(baseUrl), origin);
}

function getPathCandidateUrls(pathname: string, assetPath: string, origin: string): string[] {
  const pathSegments = normalizePathname(pathname).split('/').filter(Boolean);

  return pathSegments.map((_, index) => {
    const prefix = `/${pathSegments.slice(0, index + 1).join('/')}/`;
    return `${origin}${prefix}${assetPath}`;
  });
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

function appendBackupCandidates(urls: string[]): string[] {
  const candidates = new Set<string>();

  urls.forEach((url) => {
    candidates.add(url);

    if (url.endsWith('skills.json')) {
      candidates.add(`${url}.backup`);
    }
  });

  return Array.from(candidates);
}

export function normalizeBasePath(baseUrl: string): string {
  const normalizedSegments = baseUrl
    .trim()
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');

  const normalizedPath = normalizedSegments.length > 0
    ? `/${normalizedSegments.join('/')}`
    : '/';

  return normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
}

export function getAbsolutePublicAssetUrl(
  assetPath: string,
  {
    baseUrl,
    origin,
  }: Pick<PublicAssetUrlInput, 'baseUrl' | 'origin'>,
): string {
  const resolvedAssetPath = stripLeadingSlashes(assetPath.trim());
  return new URL(resolvedAssetPath || '.', new URL(normalizeBasePath(baseUrl), origin)).href;
}

export function getSkillsIndexCandidateUrls({
  baseUrl,
  origin,
  pathname,
  documentBaseUrl,
}: SkillsIndexUrlInput): string[] {
  const assetPath = 'skills.json';

  return appendBackupCandidates(uniqueUrls([
    new URL(assetPath, getResolvedDocumentBaseUrl({ baseUrl, origin, documentBaseUrl })).href,
    new URL(assetPath, new URL(normalizeBasePath(baseUrl), origin)).href,
    `${origin}/${assetPath}`,
    ...getPathCandidateUrls(pathname, assetPath, origin),
  ]));
}

export function getSkillMarkdownCandidateUrls({
  baseUrl,
  origin,
  pathname,
  documentBaseUrl,
  skillPath,
}: SkillMarkdownUrlInput): string[] {
  const normalizedSkillPath = normalizeSkillsAssetPath(skillPath);
  if (!normalizedSkillPath) {
    return [];
  }

  const assetPath = `${normalizedSkillPath}/SKILL.md`;

  return uniqueUrls([
    new URL(assetPath, getResolvedDocumentBaseUrl({ baseUrl, origin, documentBaseUrl })).href,
    new URL(assetPath, new URL(normalizeBasePath(baseUrl), origin)).href,
    `${origin}/${assetPath}`,
    ...getPathCandidateUrls(pathname, assetPath, origin),
  ]);
}

```

### Core Architecture Module: `apps/web-app/src/utils/seo.ts`
```
import type { SeoJsonLdValue, SeoMeta, TwitterCard, Skill } from '../types';
import { getAbsolutePublicAssetUrl } from './publicAssetUrls';

export const DEFAULT_TOP_SKILL_COUNT = 180;
export const DEFAULT_SOCIAL_IMAGE = 'social-card.png';
const SITE_NAME = 'Agentic Awesome Skills';
const REPOSITORY_URL = 'https://github.com/sickn33/agentic-awesome-skills';
const HOSTED_CATALOG_URL = 'https://aaskills.tech/';
const TOPIC_ROUTE_PREFIX = '/topics';
const HOME_CATALOG_COUNT_FALLBACK = 1969;

export interface SeoLandingPageLink {
  label: string;
  href?: string;
  to?: string;
}

export interface SeoLandingPageSection {
  heading: string;
  body: string;
}

export interface SeoLandingPage {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  summary: string;
  primaryIntent: string;
  keywords: string[];
  relatedTerms?: string[];
  relatedCategories?: string[];
  featuredSkillIds?: string[];
  sections: SeoLandingPageSection[];
  links: SeoLandingPageLink[];
}
const FAQ_ITEMS = [
  {
    question: 'What is Agentic Awesome Skills?',
    answer: (countLabel: string) =>
      `Agentic Awesome Skills is built around AAS Core, a local agent-first preview boundary for neutral catalog retrieval, exact agent-owned selection, validation, and planning. AAS Core is backed by an evidence-rich catalog of ${countLabel} reusable SKILL.md playbooks.`,
  },
  {
    question: 'How do I use AAS Core preview?',
    answer:
      'Configure the local stdio MCP with the AAS CLI, let the agent search and inspect the complete catalog, choose exact skill IDs itself, then validate the schema 2 aas-stack.json with its project profile and preview the immutable plan in the CLI. Apply and recovery are outside the non-applying preview path.',
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
    question: 'What is the difference between skills and MCP tools?',
    answer:
      'Skills are reusable playbooks that tell an AI assistant how to execute a workflow. MCP tools expose external systems or callable actions. Skills guide behavior, context, constraints, and output quality; MCP tools provide the external capabilities an assistant may need while following those instructions.',
  },
  {
    question: 'How are plugins, bundles, and workflows different?',
    answer:
      'Plugins are installable packaging surfaces, bundles are curated skill recommendations, and workflows are ordered execution playbooks. Start with a plugin when the domain is clear, use bundles to compare adjacent skills, and use workflows when sequencing planning, coding, testing, auditing, or release work matters.',
  },
] as const;

export function getCatalogCountLabel(skillCount = 0): string {
  const visibleCount = skillCount > 0 ? skillCount : HOME_CATALOG_COUNT_FALLBACK;
  return `${visibleCount.toLocaleString('en-US')}+`;
}

function getResolvedHomeFaqItems(skillCount = 0): Array<{ question: string; answer: string }> {
  const countLabel = getCatalogCountLabel(skillCount);
  return FAQ_ITEMS.map((item) => ({
    question: item.question,
    answer: typeof item.answer === 'function' ? item.answer(countLabel) : item.answer,
  }));
}

export function toCanonicalPath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const prefixed = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const compacted = prefixed.replace(/\/{2,}/g, '/');
  const normalized = compacted.endsWith('/') ? compacted.slice(0, -1) : compacted;
  return normalized || '/';
}

export function toIndexableRoutePath(pathname: string): string {
  const canonicalPath = toCanonicalPath(pathname);
  return canonicalPath === '/' ? '/' : `${canonicalPath}/`;
}

export function getCanonicalUrl(canonicalPath: string, siteBaseUrl?: string): string {
  const base = toIndexableRoutePath(canonicalPath);
  const siteBase = siteBaseUrl?.trim() || window.location.origin;
  const normalizedBase = siteBase.replace(/\/+$/, '');
  return `${normalizedBase}${base === '/' ? '/' : base}`;
}

export function getAssetCanonicalUrl(canonicalPath: string): string {
  return getAbsolutePublicAssetUrl(toIndexableRoutePath(canonicalPath), {
    baseUrl: import.meta.env.BASE_URL || '/',
    origin: window.location.origin,
  });
}

export function getAbsoluteAssetUrl(assetPath: string): string {
  return getAbsolutePublicAssetUrl(toCanonicalPath(assetPath), {
    baseUrl: import.meta.env.BASE_URL || '/',
    origin: window.location.origin,
  });
}

function getCatalogBaseUrl(canonicalUrl: string): string {
  try {
    const parsed = new URL(canonicalUrl);
    const strippedSkillPath = parsed.pathname
      .replace(/\/skill\/[^/]+\/?$/, '/')
      .replace(/\/core\/?$/, '/');
    const normalizedPath = strippedSkillPath.endsWith('/') ? strippedSkillPath : `${strippedSkillPath}/`;
    const normalizedCatalog = normalizedPath === '' ? '/' : normalizedPath;
    return `${parsed.origin}${normalizedCatalog}`;
  } catch {
    return canonicalUrl;
  }
}

function buildOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${REPOSITORY_URL}#organization`,
    name: SITE_NAME,
    url: REPOSITORY_URL,
    sameAs: [
      'https://x.com/AASkills_',
      'https://www.npmjs.com/package/agentic-awesome-skills',
      HOSTED_CATALOG_URL,
    ],
    brand: {
      '@type': 'Brand',
      name: SITE_NAME,
    },
  };
}

function buildWebSiteSchema(canonicalUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: getCatalogBaseUrl(canonicalUrl),
    sameAs: REPOSITORY_URL,
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${getCatalogBaseUrl(canonicalUrl).replace(/\/+$/, '')}/core/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function buildSoftwareSourceCodeSchema(canonicalUrl: string, visibleCount: number): Record<string, unknown> {
  const visibleCountLabel = visibleCount > 0
    ? `${visibleCount.toLocaleString('en-US')} agentic skills`
    : 'agentic skills';

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: SITE_NAME,
    description: `AAS Core preview is a local agent-first boundary for neutral catalog retrieval, exact agent-owned selection, validation, and planning backed by ${visibleCountLabel}.`,
    url: REPOSITORY_URL,
    sameAs: [
      canonicalUrl,
      HOSTED_CATALOG_URL,
      'https://www.npmjs.com/package/agentic-awesome-skills',
    ],
    mainEntityOfPage: canonicalUrl,
    codeRepository: REPOSITORY_URL,
    applicationCategory: 'DeveloperApplication',
    keywords: [
      'AI coding assistant skills',
      'Claude Code skills',
      'Codex CLI skills',
      'Cursor skills',
      'Gemini CLI skills',
      'Antigravity skills',
      'Antigravity CLI skills',
      'GitHub AI skills repository',
      'AI agent skills GitHub',
      'AAS Core',
      'agent-selected skill stack',
      'agent stack',
      'Model Context Protocol',
      'specialized plugins',
      'SKILL.md',
    ],
    isAccessibleForFree: true,
    programmingLanguage: {
      '@type': 'ComputerLanguage',
      name: 'Markdown',
      url: 'https://en.wikipedia.org/wiki/Markdown',
    },
    license: `${REPOSITORY_URL}/blob/main/LICENSE`,
  };
}

function buildHomeFaqSchema(canonicalUrl: string, skillCount: number): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: canonicalUrl,
    mainEntity: getResolvedHomeFaqItems(skillCount).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function getHomeFaqItems(skillCount = 0): Array<{ question: string; answer: string }> {
  return getResolvedHomeFaqItems(skillCount);
}

function ensureMetaTag(name: string, content: string, attributeName: 'name' | 'property'): void {
  const selector = `meta[${attributeName}="${name}"]`;
  let tag = document.querySelector(selector) as HTMLMetaElement | null;

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attributeName, name);
    document.head.appendChild(tag);
  }

  tag.setAttribute('content', content);
}

function resolveJsonLdValue(value: SeoJsonLdValue, canonicalUrl: string): Array<Record<string, unknown>> | null {
  if (typeof value === 'function') {
    const resolved = value(canonicalUrl);

    if (Array.isArray(resolved)) {
      return resolved as Array<Record<string, unknown>>;
    }

    return resolved ? [resolved] : null;
  }

  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }

  return value ? [value as Record<string, unknown>] : null;
}

function ensureJsonLdTag(rawJsonLd: Record<string, unknown>): void {
  const serialized = JSON.stringify(rawJsonLd);
  const tag = document.createElement('script');
  tag.type = 'application/ld+json';
  tag.setAttribute('data-seo-jsonld', 'true');
  tag.textContent = serialized;
  document.head.appendChild(tag);
}

export function setPageMeta(meta: SeoMeta): void {
  const title = meta.title.trim();
  const 
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

### Incident Patch 1: `c66452b3` (2026-10-04)
**Commit Message**: fix: replace placeholder descriptions in jobs-to-be-done-analyst and onboarding-psychologist (#1785)

Both skills ship with the template placeholder `One sentence - what this skill does and when to invoke it` as their `description`, so agents can't tell when to use them. This PR replaces it with a real description based on each skill's "When to Use" section. Only the `description` line changes.

**File**: `skills/jobs-to-be-done-analyst/SKILL.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: jobs-to-be-done-analyst
-description: "One sentence - what this skill does and when to invoke it"
+description: "Uncover the functional, emotional and social jobs a customer hires a product to do: progress state, hiring trigger, alternatives, success criteria, JTBD map. Use when you need to understand why users buy, switch or churn, or to anchor positioning, messaging and onboarding in real jobs."
 risk: safe
 source: community
 date_added: "2026-04-04"
```

**File**: `skills/onboarding-psychologist/SKILL.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: onboarding-psychologist
-description: "One sentence - what this skill does and when to invoke it"
+description: "Design first-use and onboarding experiences that bring an early win, cut setup friction, build ownership and form habits through stable cues. Use when onboarding loses users early, time-to-value is long, or the first session should build confidence, momentum and a lasting habit."
 risk: safe
 source: community
 date_added: "2026-04-04"
```

---

### Incident Patch 2: `fdaf2629` (2026-10-04)
**Commit Message**: fix: remove vulnerable vite-plugin-singlefile from the web-app build (#1775)

**File**: `apps/web-app/package-lock.json` (modified, +0/-99)
```diff
@@ -50,7 +50,6 @@
         "typescript": "~6.0.3",
         "typescript-eslint": "^8.65.0",
         "vite": "^8.0.16",
-        "vite-plugin-singlefile": "2.3.3",
         "vitest": "^5.0.0"
       },
       "engines": {
@@ -2572,19 +2571,6 @@
         "node": "20 || >=22"
       }
     },
-    "node_modules/braces": {
-      "version": "3.0.3",
-      "resolved": "https://registry.npmjs.org/braces/-/braces-3.0.3.tgz",
-      "integrity": "sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "fill-range": "^7.1.1"
-      },
-      "engines": {
-        "node": ">=8"
-      }
-    },
     "node_modules/browserslist": {
       "version": "4.28.9",
       "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.9.tgz",
@@ -3548,19 +3534,6 @@
         "flat-cache": "^6.1.23"
       }
     },
-    "node_modules/fill-range": {
-      "version": "7.1.1",
-      "resolved": "https://registry.npmjs.org/fill-range/-/fill-range-7.1.1.tgz",
-      "integrity": "sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "to-regex-range": "^5.0.1"
-      },
-      "engines": {
-        "node": ">=8"
-      }
-    },
     "node_modules/finalhandler": {
       "version": "2.1.1",
       "resolved": "https://registry.npmjs.org/finalhandler/-/finalhandler-2.1.1.tgz",
@@ -4139,16 +4112,6 @@
         "url": "https://github.com/sponsors/wooorm"
       }
     },
-    "node_modules/is-number": {
-      "version": "7.0.0",
-      "resolved": "https://registry.npmjs.org/is-number/-/is-number-7.0.0.tgz",
-      "integrity": "sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">=0.12.0"
-      }
-    },
     "node_modules/is-plain-obj": {
       "version": "4.1.0",
       "resolved": "https://registry.npmjs.org/is-plain-obj/-/is-plain-obj-4.1.0.tgz",
@@ -5593,33 +5556,6 @@
       ],
       "license": "MIT"
     },
-    "node_modules/micromatch": {
-      "version": "4.0.8",
-      "resolved": "https://registry.npmjs.org/micromatch/-/micromatch-4.0.8.tgz",
-      "integrity": "sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "braces": "^3.0.3",
-        "picomatch": "^2.3.1"
-      },
-      "engines": {
-        "node": ">=8.6"
-      }
-    },
-    "node_modules/micromatch/node_modules/picomatch": {
-      "version": "2.3.2",
-      "resolved": "https://registry.npmjs.org/picomatch/-/picomatch-2.3.2.tgz",
-      "integrity": "sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==",
-      "dev": true,
-      "license": "MIT",
-      "engines": {
-        "node": ">=8.6"
-      },
-      "funding": {
-        "url": "https://github.com/sponsors/jonschlinkert"
-      }
-    },
     "node_modules/mime-db": {
       "version": "1.54.0",
       "resolved": "https://registry.npmjs.org/mime-db/-/mime-db-1.54.0.tgz",
@@ -6775,19 +6711,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/to-regex-range": {
-      "version": "5.0.1",
-      "resolved": "https://registry.npmjs.org/to-regex-range/-/to-regex-range-5.0.1.tgz",
-      "integrity": "sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "is-number": "^7.0.0"
-      },
-      "engines": {
-        "node": ">=8.0"
-      }
-    },
     "node_modules/toidentifier": {
       "version": "1.0.1",
       "resolved": "https://registry.npmjs.org/toidentifier/-/toidentifier-1.0.1.tgz",
@@ -7252,28 +7175,6 @@
         }
       }
     },
-    "node_modules/vite-plugin-singlefile": {
-      "version": "2.3.3",
-      "resolved": "https://registry.npmjs.org/vite-plugin-singlefile/-/vite-plugin-singlefile-2.3.3.tgz",
-      "integrity": "sha512-XVnGH0QzbOa8fxRSsHdCarVN1BSBXNi7uLMQYlrGRN5apdHkk62XQWRJhVever0lnfuyBkwn+kvVChdm/OoOUg==",
-      "dev": true,
-      "license": "MIT",
-      "dependencies": {
-        "micromatch": "^4.0.8"
-      },
-      "engines": {
-        "node": ">18.0.0"
-      },
-      "peerDependencies": {
-        "rollup": "^4.59.0",
-        "vite": "^5.4.21 || ^6.0.0 || ^7.0.0 || ^8.0.0"
-      },
-      "peerDependenciesMeta": {
-        "rollup": {
-          "optional": true
-        }
-      }
-    },
     "node_modules/vite/node_modules/lightningcss": {
       "version": "1.33.0",
       "resolved": "https://registry.npmjs.org/lightningcss/-/lightningcss-1.33.0.tgz",
```

**File**: `apps/web-app/package.json` (modified, +2/-3)
```diff
@@ -16,7 +16,7 @@
     "test": "vitest",
     "test:coverage": "vitest run --coverage",
     "typecheck": "tsc --noEmit && tsc -p tsconfig.node.json --noEmit",
-    "build:plugin-ui": "vite build --config vite.plugin.config.ts"
+    "build:plugin-ui": "vite build --config vite.plugin.config.ts && node scripts/inline-single-file.js ../../.tmp/aas-plugin/workbench.html"
   },
   "dependencies": {
     "@fontsource/jetbrains-mono": "^5.3.0",
@@ -61,8 +61,7 @@
     "typescript-eslint": "^8.65.0",
     "vite": "^8.0.16",
     "vitest": "^5.0.0",
-    "@modelcontextprotocol/ext-apps": "2.0.3",
-    "vite-plugin-singlefile": "2.3.3"
+    "@modelcontextprotocol/ext-apps": "2.0.3"
   },
   "overrides": {
     "brace-expansion": "^5.0.12",
```

**File**: `apps/web-app/scripts/inline-single-file.js` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+// Inline the Workbench build into one self-contained HTML file.
+//
+// This replaces the `vite-plugin-singlefile` devDependency, which pulled in
+// `micromatch` -> `braces` and kept the repository audit red with no patched
+// `braces` release available. The behaviour is intentionally narrow: the
+// plugin build emits exactly one module script and one stylesheet, and this
+// script inlines both so the packaged Workbench is a single portable file.
+
+import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
+import path from "node:path";
+
+function inlineAsset(html, assetDirectory, tagName, attributeName, wrap, { voidElement = false } = {}) {
+  const closing = voidElement ? "" : `\\s*</${tagName}>`;
+  const pattern = new RegExp(
+    `<${tagName}\\b[^>]*\\b${attributeName}="([^"]+)"[^>]*>${closing}`,
+    "gu",
+  );
+  let inlined = 0;
+  return html.replace(pattern, (match, url) => {
+    const fileName = path.basename(new URL(url, "http://localhost").pathname);
+    const contents = readFileSync(path.join(assetDirectory, fileName), "utf8");
+    rmSync(path.join(assetDirectory, fileName), { force: true });
+    inlined += 1;
+    return wrap(contents);
+  });
+}
+
+const [, , htmlPath] = process.argv;
+if (!htmlPath) {
+  throw new Error("Usage: node scripts/inline-single-file.js <html-output-path>");
+}
+
+const absoluteHtmlPath = path.resolve(htmlPath);
+const outputDirectory = path.dirname(absoluteHtmlPath);
+const assetDirectory = path.join(outputDirectory, "assets");
+
+let html = readFileSync(absoluteHtmlPath, "utf8");
+html = inlineAsset(
+  html,
+  assetDirectory,
+  "link",
+  "href",
+  (css) => `<style>${css}</style>`,
+  { voidElement: true },
+);
+html = inlineAsset(
+  html,
+  assetDirectory,
+  "script",
+  "src",
+  (js) => `<script type="module">${js}</script>`,
+);
+
+if (readdirSync(assetDirectory).length > 0) {
+  throw new Error(`Expected every build asset to be inlined, but found: ${readdirSync(assetDirectory).join(", ")}`);
+}
+{
+  rmSync(assetDirectory, { recursive: true, force: true });
+}
+
+writeFileSync(absoluteHtmlPath, html, "utf8");
```

**File**: `apps/web-app/scripts/inline-single-file.test.js` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
+import { tmpdir } from "node:os";
+import path from "node:path";
+import { spawnSync } from "node:child_process";
+import { afterEach, describe, expect, it } from "vitest";
+
+const script = path.join(process.cwd(), "scripts/inline-single-file.js");
+const temporaryDirectories = [];
+
+function buildFixture() {
+  const directory = mkdtempSync(path.join(tmpdir(), "aas-inline-"));
+  temporaryDirectories.push(directory);
+  const assets = path.join(directory, "assets");
+  mkdirSync(assets);
+  writeFileSync(path.join(assets, "style.css"), ".root{color:red}");
+  writeFileSync(path.join(assets, "workbench.js"), "console.log('workbench');");
+  writeFileSync(
+    path.join(directory, "workbench.html"),
+    [
+      "<!doctype html><html><head>",
+      '<link rel="stylesheet" crossorigin href="/assets/style.css">',
+      '<script type="module" crossorigin src="/assets/workbench.js"></script>',
+      "</head><body><div id=\"root\"></div></body></html>",
+    ].join("\n"),
+  );
+  return { directory, assets };
+}
+
+afterEach(() => {
+  while (temporaryDirectories.length) {
+    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
+  }
+});
+
+describe("inline-single-file", () => {
+  it("inlines every emitted asset and removes the assets directory", () => {
+    const { directory, assets } = buildFixture();
+    const result = spawnSync(
+      process.execPath,
+      [script, path.join(directory, "workbench.html")],
+      { encoding: "utf8" },
+    );
+
+    expect(result.status).toBe(0);
+    const html = readFileSync(path.join(directory, "workbench.html"), "utf8");
+    expect(html).toContain("<style>.root{color:red}</style>");
+    expect(html).toContain("<script type=\"module\">console.log('workbench');</script>");
+    expect(html).not.toMatch(/\/assets\//u);
+    expect(existsSync(assets)).toBe(false);
+  });
+
+  it("fails loudly when a referenced asset is missing", () => {
+    const { directory } = buildFixture();
+    rmSync(path.join(directory, "assets", "workbench.js"));
+
+    const result = spawnSync(
+      process.execPath,
+      [script, path.join(directory, "workbench.html")],
+      { encoding: "utf8" },
+    );
+
+    expect(result.status).not.toBe(0);
+  });
+});
```

**File**: `apps/web-app/vite.plugin.config.ts` (modified, +2/-2)
```diff
@@ -1,13 +1,13 @@
 import { defineConfig } from 'vite';
 import react from '@vitejs/plugin-react';
-import { viteSingleFile } from 'vite-plugin-singlefile';
 import { writeFileSync, mkdirSync } from 'node:fs';
 import { fileURLToPath } from 'node:url';
 export default defineConfig({
-  plugins: [react(), viteSingleFile(), { name: 'ui-license-inventory', generateBundle() { const directory = fileURLToPath(new URL('../../.tmp/aas-plugin/', import.meta.url)); mkdirSync(directory, { recursive: true }); writeFileSync(`${directory}/ui-modules.json`, JSON.stringify([...this.getModuleIds()].filter((id) => id.includes('node_modules')))); } }],
+  plugins: [react(), { name: 'ui-license-inventory', generateBundle() { const directory = fileURLToPath(new URL('../../.tmp/aas-plugin/', import.meta.url)); mkdirSync(directory, { recursive: true }); writeFileSync(`${directory}/ui-modules.json`, JSON.stringify([...this.getModuleIds()].filter((id) => id.includes('node_modules')))); } }],
   publicDir: false,
   build: {
     outDir: '../../.tmp/aas-plugin', emptyOutDir: false,
+    cssCodeSplit: false,
     rollupOptions: { input: fileURLToPath(new URL('./workbench.html', import.meta.url)) },
   },
 });
```

---

### Incident Patch 3: `8117e465` (2026-10-01)
**Commit Message**: feat: refresh liuguang-banlan-ui spectral field and measurement (#1726) (#1743)

# Pull Request Description

Maintainer re-land of contributor PR #1726 (`Update liuguang-banlan-ui with calibrated spectral field and measurement`) by @3516027002att-ui.

**File**: `skills/liuguang-banlan-ui/SKILL.md` (modified, +22/-18)
```diff
@@ -44,7 +44,7 @@ Read [style-contract.md](references/style-contract.md) before choosing a mode or
 
 - Choose a neutral, information-dense workbench domain such as field research, inventory, monitoring, or operations.
 - Use a continuous three-pane or similarly coherent workspace: navigation, queue/list, detail, metadata, and one signature observation band.
-- Keep color in the field, ribbon, markers, and state accents; keep text, controls, boundaries, and semantic hierarchy stable.
+- Keep color in the field, map markers, and state accents. Keep the logo, avatar, rules, text, controls, boundaries, and semantic hierarchy neutral; do not paint them with palette gradients.
 - Prefer restrained surfaces and weak fills. Avoid turning every region into a floating card.
 
 ### 4. Implement the parameter contract
@@ -58,16 +58,18 @@ Maintain a serializable manifest with these top-level fields:
   base: { oklch },
   colors: [{
     id, label, oklch, srgbFallback,
-    intensity, peakOpacity, lightnessBias,
+    intensity, peakOpacity,
     fieldScale, phase,
     measuredCoverage, effectiveShare
   }],
   field: { scale, octaves, warpStrength, motionSpeed, staticTime, ditherStrength, luminanceCap },
-  output: { colorSpace, p3Enhancement, reducedMotion }
+  output: { colorSpace, reducedMotion }
 }
 ```
 
-- Keep every intensity in `[0, 1]`; make `overallColorIntensity` the global budget and `colors[].intensity` the per-color budget.
+- Keep every intensity in `[0, 1]`; make `overallColorIntensity` the global budget and `colors[].intensity` the per-color budget. The renderer multiplies `intensity` by `peakOpacity`, so treat `peakOpacity` as the calibrated strength at full intensity.
+- Order `colors` by hue. The renderer draws six hue stops around a loop and mixes each color with its array neighbors; near-complementary neighbors mix toward gray.
+- `luminanceCap` applies only in `obsidian`. `ditherStrength` is the dither amplitude in output codes; `1` removes quantization bias.
 - Use OKLCH as the authoring space and provide an sRGB fallback for non-OKLCH contexts.
 - Keep the seed, static frame, phases, and field scales deterministic; do not use random per render.
 - Expose sliders for the global intensity and every configured color. Make reset, JSON export, and copy actions available.
@@ -77,8 +79,10 @@ Maintain a serializable manifest with these top-level fields:
 - Use a procedural fBm/domain-warp field or an equivalent continuous field; keep it behind the interface with `pointer-events: none`.
 - Use broad flowing hue regions or ribbons, not obvious radial blobs, spotlight circles, or hard rainbow bands.
 - Upload the complete palette and per-color field scales to the renderer. Apply the dark-mode luminance cap after palette mixing.
-- Provide a CSS fallback with comparable visual intent when WebGL is unavailable.
-- Pause or freeze motion when the document is hidden or `prefers-reduced-motion` is active.
+- Encode output with the sRGB transfer function, dither in output codes, and quantize in the shader. A power-curve encode or a weak linear-light dither biases the output, most visibly in low-intensity fields and near black.
+- Provide a CSS fallback with comparable visual intent when WebGL is unavailable, such as one soft hue-ordered sweep calibrated against the WebGL field; do not use fixed radial spots.
+- Pause or freeze motion when the document is hidden or `prefers-reduced-motion` is active, and keep field time continuous so pausing and resuming do not jump.
+- Repaint after every resize. Resizing clears the canvas, and a paused field has no next frame to redraw it.
 - Keep the renderer local and dependency-light; do not require remote fonts, images, or APIs for the starter.
 
 ### 6. Preserve interaction and accessibility
@@ -90,13 +94,10 @@ Maintain a serializable manifest with these top-level fields:
 ### 7. Validate and report
 
 - Scaffold a clean starter with `scripts/scaffold_template.py` when a neutral implementation is needed.
-- The bundled helpers parse only the restricted data-literal assignment used by
-  the starter. They reject expressions, function calls, duplicate keys,
-  unsupported syntax, trailing statements, and oversized manifests without
-  executing JavaScript. Keep runtime theme configs data-only as well.
-- Run `scripts/validate_manifest.py` on each theme config before rendering.
-- Capture desktop and mobile screenshots with a real browser. Inspect them directly if visual capability is available.
-- Run `scripts/measure_preview.py` on the pure field screenshot and retain measured chromatic ratio, luminance statistics, per-color coverage, and effective share.
+- Keep theme configs as data-only assignments. The bundled parser rejects expressions, function calls, duplicate keys, trailing statements, and oversized manifests without executing JavaScript.
+- Run `scripts/validate_manifest.py` on each theme config before rendering, and resolve its warnings.
+- Serve previews with `
```

**File**: `skills/liuguang-banlan-ui/assets/starter/launcher.css` (modified, +2/-2)
```diff
@@ -9,8 +9,8 @@ header span { display: block; margin-top: 16px; color: oklch(70% 0.01 220); font
 .template-list { border-top: 1px solid oklch(100% 0 0 / .12); }
 .template { display: grid; grid-template-columns: 116px minmax(0, 1fr) auto; align-items: center; gap: 24px; padding: 24px 0; border-bottom: 1px solid oklch(100% 0 0 / .12); color: inherit; text-decoration: none; }
 .swatch { width: 116px; height: 76px; border: 1px solid oklch(100% 0 0 / .15); border-radius: 10px; transition: transform 180ms cubic-bezier(.25,1,.5,1); }
-.opal .swatch { background: radial-gradient(circle at 20% 20%, oklch(90% .06 197), transparent 48%), radial-gradient(circle at 80% 35%, oklch(92% .055 18), transparent 48%), radial-gradient(circle at 46% 95%, oklch(90% .05 302), transparent 54%), oklch(98% .004 94); }
-.obsidian .swatch { background: radial-gradient(circle at 20% 20%, oklch(27% .07 188), transparent 50%), radial-gradient(circle at 80% 35%, oklch(23% .06 284), transparent 52%), radial-gradient(circle at 46% 95%, oklch(24% .05 78), transparent 56%), oklch(10% .012 236); }
+.opal .swatch { background: linear-gradient(100deg, oklch(93.5% .047 18), oklch(94% .041 62), oklch(93.6% .036 159), oklch(92.8% .043 201), oklch(91.8% .05 248), oklch(92.5% .045 304)); }
+.obsidian .swatch { background: linear-gradient(100deg, oklch(29% .055 188), oklch(25% .048 211), oklch(22.5% .047 251), oklch(24% .052 278), oklch(25.5% .05 318), oklch(30% .045 82)); }
 .copy small { display: block; color: oklch(58% 0.012 220); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
 .copy strong { display: block; margin-top: 5px; font-size: 18px; font-weight: 620; }
 .copy span { display: block; margin-top: 6px; color: oklch(68% 0.012 220); font-size: 12px; }
```

**File**: `skills/liuguang-banlan-ui/assets/starter/obsidian/index.html` (modified, +5/-4)
```diff
@@ -116,18 +116,19 @@ <h1 id="page-title">潮间带观测 · 第 18 批</h1>
           <article class="pane detail-pane" aria-labelledby="record-title">
             <div class="pane-head">
               <div class="tab-list" role="tablist" aria-label="记录视图">
-                <button class="tab" type="button" role="tab" aria-selected="true" aria-controls="detail-copy" data-copy="水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。">记录</button>
-                <button class="tab" type="button" role="tab" aria-selected="false" aria-controls="detail-copy" data-copy="关联了 4 张现场照片、2 个水质读数与 1 条位置修正。附件校验通过，原始文件已进入只读归档队列。">附件</button>
-                <button class="tab" type="button" role="tab" aria-selected="false" aria-controls="detail-copy" data-copy="19:47 完成盐度标签修正；20:12 补充观察者备注；21:03 进入批次复核队列。所有变更均保留原始记录。">变更</button>
+                <button class="tab" type="button" role="tab" aria-controls="detail-copy" aria-selected="true" data-copy="水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。">记录</button>
+                <button class="tab" type="button" role="tab" aria-controls="detail-copy" aria-selected="false" data-copy="关联了 4 张现场照片、2 个水质读数与 1 条位置修正。附件校验通过，原始文件已进入只读归档队列。">附件</button>
+                <button class="tab" type="button" role="tab" aria-controls="detail-copy" aria-selected="false" data-copy="19:47 完成盐度标签修正；20:12 补充观察者备注；21:03 进入批次复核队列。所有变更均保留原始记录。">变更</button>
               </div>
+              <button class="icon-button" type="button" aria-label="更多记录操作"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
             </div>
             <div class="detail-title">
               <h2 id="record-title">潮池边缘 · 样本 042</h2>
               <div class="detail-meta"><span>记录时间 <strong id="record-time">19:42</strong></span><span>观察者 LY-04</span><span>定位误差 ±1.2 m</span></div>
             </div>
             <div class="detail-body">
               <div class="field-notes">
-            <p id="detail-copy" role="tabpanel">水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。</p>
+                <p id="detail-copy" role="tabpanel">水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。</p>
                 <dl>
                   <div class="note-rule"><dt>表面温度</dt><dd>18.6 °C · 稳定</dd></div>
                   <div class="note-rule"><dt>盐度</dt><dd>31.8 PSU · 高于同批中位值 1.4</dd></div>
```

**File**: `skills/liuguang-banlan-ui/assets/starter/obsidian/theme-config.js` (modified, +3/-10)
```diff
@@ -1,8 +1,8 @@
 window.SPECTRAL_THEME = {
-  schemaVersion: "1.0",
+  schemaVersion: "1.1",
   mode: "obsidian",
   label: "五彩斑斓黑",
-  preset: "obsidian-fieldnote-v1",
+  preset: "obsidian-fieldnote-v2",
   seed: 90821,
   overallColorIntensity: 1.0,
   base: {
@@ -16,7 +16,6 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#183f3d",
       intensity: 0.72,
       peakOpacity: 0.29,
-      lightnessBias: 0.008,
       fieldScale: 0.84,
       phase: [0.11, 0.72],
       measuredCoverage: null,
@@ -29,7 +28,6 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#17333a",
       intensity: 0.62,
       peakOpacity: 0.27,
-      lightnessBias: 0.006,
       fieldScale: 0.96,
       phase: [0.74, 0.19],
       measuredCoverage: null,
@@ -42,7 +40,6 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#202b42",
       intensity: 0.54,
       peakOpacity: 0.26,
-      lightnessBias: 0.004,
       fieldScale: 1.08,
       phase: [0.37, 0.88],
       measuredCoverage: null,
@@ -55,7 +52,6 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#2d2948",
       intensity: 0.42,
       peakOpacity: 0.24,
-      lightnessBias: 0.005,
       fieldScale: 0.91,
       phase: [0.93, 0.57],
       measuredCoverage: null,
@@ -68,7 +64,6 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#3a293d",
       intensity: 0.30,
       peakOpacity: 0.21,
-      lightnessBias: 0.004,
       fieldScale: 1.14,
       phase: [0.25, 0.31],
       measuredCoverage: null,
@@ -81,7 +76,6 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#473c22",
       intensity: 0.18,
       peakOpacity: 0.17,
-      lightnessBias: 0.007,
       fieldScale: 1.03,
       phase: [0.61, 0.46],
       measuredCoverage: null,
@@ -94,12 +88,11 @@ window.SPECTRAL_THEME = {
     warpStrength: 0.41,
     motionSpeed: 0.01,
     staticTime: 2.18,
-    ditherStrength: 0.82,
+    ditherStrength: 1,
     luminanceCap: 0.165
   },
   output: {
     colorSpace: "srgb",
-    p3Enhancement: "feature-detected",
     reducedMotion: "frozen-calibrated-frame"
   }
 };
```

**File**: `skills/liuguang-banlan-ui/assets/starter/obsidian/theme.css` (modified, +48/-62)
```diff
@@ -1,49 +1,3 @@
-@supports not (color: oklch(0% 0 0)) {
-  :root {
-    --app-canvas: #111820;
-    --app-wash: rgba(17, 24, 32, 0.18);
-    --topbar-surface: rgba(19, 27, 35, 0.86);
-    --sidebar-surface: rgba(18, 26, 34, 0.82);
-    --band-surface: rgba(23, 32, 42, 0.82);
-    --workbench-surface: rgba(21, 29, 39, 0.82);
-    --pane-surface: rgba(22, 30, 40, 0.79);
-    --panel-surface: rgba(20, 28, 37, 0.95);
-    --button-surface: rgba(34, 44, 56, 0.66);
-    --ink-primary: #e4e9ec;
-    --ink-secondary: #abb8bf;
-    --ink-tertiary: #829099;
-    --ink-muted: #68757f;
-    --line-subtle: rgba(222, 231, 236, 0.075);
-    --line-default: rgba(222, 231, 236, 0.12);
-    --line-strong: rgba(222, 231, 236, 0.22);
-    --state-hover: rgba(201, 220, 227, 0.07);
-    --state-selected: rgba(102, 184, 181, 0.13);
-    --brand-mark: radial-gradient(circle at 35% 30%, #58b3ae, #29445d 43%, #402b4f);
-    --brand-mark-detail: rgba(186, 217, 218, 0.64);
-    --account-orb: linear-gradient(135deg, #315f61, #40314e);
-    --status-good: #4ba885;
-    --status-good-wash: rgba(75, 168, 133, 0.12);
-    --active-rule: #3c9a9e;
-    --focus-ring: #5ab2b5;
-    --selection: rgba(70, 166, 163, 0.34);
-    --control-accent: #4ca9a6;
-    --primary-surface: #a5cecb;
-    --primary-hover: #b3d8d4;
-    --primary-border: rgba(174, 218, 216, 0.46);
-    --primary-ink: #131c24;
-    --scroll-thumb: rgba(216, 231, 236, 0.19);
-    --observation-ribbon: linear-gradient(90deg, rgba(96, 166, 158, 0.78), rgba(75, 123, 153, 0.72), rgba(96, 82, 145, 0.64), rgba(145, 125, 70, 0.52));
-    --workbench-shadow: 0 0 0 1px rgba(255, 255, 255, 0.018);
-    --panel-shadow: -18px 0 50px rgba(0, 0, 0, 0.34);
-    --mini-map: rgba(24, 39, 49, 0.88);
-    --marker-cyan: #3eaaa8;
-    --marker-rose: #a66e78;
-    --marker-lilac: #8870a6;
-    --marker-gold: #a58a4e;
-  }
-}
-
-@supports (color: oklch(0% 0 0)) {
 :root {
   --app-canvas: oklch(9.8% 0.012 236);
   --app-wash: oklch(8.5% 0.012 238 / 0.18);
@@ -63,9 +17,9 @@
   --line-strong: oklch(92% 0.018 218 / 0.22);
   --state-hover: oklch(84% 0.028 211 / 0.07);
   --state-selected: oklch(64% 0.07 194 / 0.13);
-  --brand-mark: radial-gradient(circle at 35% 30%, oklch(62% 0.085 180), oklch(28% 0.065 220) 43%, oklch(25% 0.06 312));
-  --brand-mark-detail: oklch(84% 0.04 192 / 0.64);
-  --account-orb: linear-gradient(135deg, oklch(32% 0.065 186), oklch(25% 0.055 308));
+  --brand-mark: var(--ink-primary);
+  --brand-mark-detail: oklch(15% 0.02 225 / 0.72);
+  --account-orb: oklch(24% 0.012 236);
   --status-good: oklch(69% 0.12 163);
   --status-good-wash: oklch(69% 0.12 163 / 0.12);
   --active-rule: oklch(69% 0.09 191);
@@ -77,7 +31,8 @@
   --primary-border: oklch(82% 0.06 190 / 0.46);
   --primary-ink: oklch(15% 0.02 225);
   --scroll-thumb: oklch(80% 0.02 220 / 0.19);
-  --observation-ribbon: linear-gradient(90deg, oklch(48% 0.075 188 / 0.78), oklch(42% 0.065 224 / 0.72), oklch(40% 0.066 290 / 0.64), oklch(46% 0.065 78 / 0.52));
+  --observation-ribbon: var(--line-strong);
+  --fallback-alpha: 0.95;
   --workbench-shadow: 0 0 0 1px oklch(100% 0 0 / 0.018);
   --panel-shadow: -18px 0 50px oklch(0% 0 0 / 0.34);
   --mini-map: oklch(14% 0.022 220 / 0.88);
@@ -86,22 +41,53 @@
   --marker-lilac: oklch(55% 0.085 310);
   --marker-gold: oklch(58% 0.08 82);
 }
-}
 
 .field-fallback body {
-  background: var(
-    --field-fallback-background,
-    radial-gradient(ellipse at 12% 18%, rgba(35, 89, 86, 0.70), transparent 50%),
-    radial-gradient(ellipse at 78% 22%, rgba(54, 42, 92, 0.55), transparent 52%),
-    radial-gradient(ellipse at 44% 82%, rgba(78, 63, 36, 0.38), transparent 56%),
-    var(--app-canvas)
-  );
+  background: var(--field-fallback-background, var(--app-canvas));
 }
 
-@supports (color: oklch(0% 0 0)) {
-@media (color-gamut: p3) {
+
+@supports not (color: oklch(0% 0 0)) {
   :root {
-    --observation-ribbon: linear-gradient(90deg, oklch(48% 0.09 188 / 0.78), oklch(42% 0.078 224 / 0.72), oklch(40% 0.078 290 / 0.64), oklch(46% 0.073 78 / 0.52));
+    --app-canvas: #111820;
+    --app-wash: rgba(17, 24, 32, 0.18);
+    --topbar-surface: rgba(19, 27, 35, 0.86);
+    --sidebar-surface: rgba(18, 26, 34, 0.82);
+    --band-surface: rgba(23, 32, 42, 0.82);
+    --workbench-surface: rgba(21, 29, 39, 0.82);
+    --pane-surface: rgba(22, 30, 40, 0.79);
+    --panel-surface: rgba(20, 28, 37, 0.95);
+    --button-surface: rgba(34, 44, 56, 0.66);
+    --ink-primary: #e4e9ec;
+    --ink-secondary: #abb8bf;
+    --ink-tertiary: #829099;
+    --ink-muted: #68757f;
+    --line-subtle: rgba(222, 231, 236, 0.075);
+    --line-default: rgba(222, 231, 236, 0.12);
+    --line-strong: rgba(222, 231, 236, 0.22);
+    --state-hover: rgba(201, 220, 227, 0.07);
+    --state-selected: rgba(102, 184, 181, 0.13);
+    --brand-mark: radial-gradient(circle at 35% 30%, #58b3ae, #29445d 43%, #402b4f);
+    --brand-mark-detail: rgba(186, 217, 218, 0.64);
+    --account-orb: linear-gradient(135deg, #315f61, #40314e);
+  
```

**File**: `skills/liuguang-banlan-ui/assets/starter/opal/index.html` (modified, +5/-4)
```diff
@@ -116,18 +116,19 @@ <h1 id="page-title">潮间带观测 · 第 18 批</h1>
           <article class="pane detail-pane" aria-labelledby="record-title">
             <div class="pane-head">
               <div class="tab-list" role="tablist" aria-label="记录视图">
-                <button class="tab" type="button" role="tab" aria-selected="true" aria-controls="detail-copy" data-copy="水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。">记录</button>
-                <button class="tab" type="button" role="tab" aria-selected="false" aria-controls="detail-copy" data-copy="关联了 4 张现场照片、2 个水质读数与 1 条位置修正。附件校验通过，原始文件已进入只读归档队列。">附件</button>
-                <button class="tab" type="button" role="tab" aria-selected="false" aria-controls="detail-copy" data-copy="19:47 完成盐度标签修正；20:12 补充观察者备注；21:03 进入批次复核队列。所有变更均保留原始记录。">变更</button>
+                <button class="tab" type="button" role="tab" aria-controls="detail-copy" aria-selected="true" data-copy="水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。">记录</button>
+                <button class="tab" type="button" role="tab" aria-controls="detail-copy" aria-selected="false" data-copy="关联了 4 张现场照片、2 个水质读数与 1 条位置修正。附件校验通过，原始文件已进入只读归档队列。">附件</button>
+                <button class="tab" type="button" role="tab" aria-controls="detail-copy" aria-selected="false" data-copy="19:47 完成盐度标签修正；20:12 补充观察者备注；21:03 进入批次复核队列。所有变更均保留原始记录。">变更</button>
               </div>
+              <button class="icon-button" type="button" aria-label="更多记录操作"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
             </div>
             <div class="detail-title">
               <h2 id="record-title">潮池边缘 · 样本 042</h2>
               <div class="detail-meta"><span>记录时间 <strong id="record-time">19:42</strong></span><span>观察者 LY-04</span><span>定位误差 ±1.2 m</span></div>
             </div>
             <div class="detail-body">
               <div class="field-notes">
-            <p id="detail-copy" role="tabpanel">水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。</p>
+                <p id="detail-copy" role="tabpanel">水线后退约 1.8 米，潮池外缘出现连续盐度跃迁。样本表面保持湿润，未观察到明显扰动。建议与 18:53 的浅滩网格记录并列复核。</p>
                 <dl>
                   <div class="note-rule"><dt>表面温度</dt><dd>18.6 °C · 稳定</dd></div>
                   <div class="note-rule"><dt>盐度</dt><dd>31.8 PSU · 高于同批中位值 1.4</dd></div>
```

**File**: `skills/liuguang-banlan-ui/assets/starter/opal/theme-config.js` (modified, +27/-35)
```diff
@@ -1,8 +1,8 @@
 window.SPECTRAL_THEME = {
-  schemaVersion: "1.0",
+  schemaVersion: "1.1",
   mode: "opal",
   label: "流光溢彩白",
-  preset: "opal-fieldnote-v1",
+  preset: "opal-fieldnote-v2",
   seed: 48173,
   overallColorIntensity: 0.82,
   base: {
@@ -16,46 +16,18 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#f6e4eb",
       intensity: 0.48,
       peakOpacity: 0.082,
-      lightnessBias: 0.004,
       fieldScale: 0.82,
       phase: [0.13, 0.67],
       measuredCoverage: null,
       effectiveShare: null
     },
-    {
-      id: "cyan",
-      label: "海玻璃青",
-      oklch: { l: 0.928, c: 0.043, h: 201 },
-      srgbFallback: "#dceff0",
-      intensity: 0.62,
-      peakOpacity: 0.078,
-      lightnessBias: 0.002,
-      fieldScale: 0.94,
-      phase: [0.78, 0.21],
-      measuredCoverage: null,
-      effectiveShare: null
-    },
-    {
-      id: "lilac",
-      label: "薄雾丁香",
-      oklch: { l: 0.925, c: 0.045, h: 304 },
-      srgbFallback: "#eee3f2",
-      intensity: 0.54,
-      peakOpacity: 0.076,
-      lightnessBias: 0.003,
-      fieldScale: 1.06,
-      phase: [0.39, 0.86],
-      measuredCoverage: null,
-      effectiveShare: null
-    },
     {
       id: "peach",
       label: "暖珠杏",
       oklch: { l: 0.94, c: 0.041, h: 62 },
       srgbFallback: "#f6eadc",
       intensity: 0.42,
       peakOpacity: 0.071,
-      lightnessBias: 0.005,
       fieldScale: 0.89,
       phase: [0.92, 0.58],
       measuredCoverage: null,
@@ -68,24 +40,46 @@ window.SPECTRAL_THEME = {
       srgbFallback: "#e2efe7",
       intensity: 0.46,
       peakOpacity: 0.068,
-      lightnessBias: 0.003,
       fieldScale: 1.12,
       phase: [0.24, 0.34],
       measuredCoverage: null,
       effectiveShare: null
     },
+    {
+      id: "cyan",
+      label: "海玻璃青",
+      oklch: { l: 0.928, c: 0.043, h: 201 },
+      srgbFallback: "#dceff0",
+      intensity: 0.62,
+      peakOpacity: 0.078,
+      fieldScale: 0.94,
+      phase: [0.78, 0.21],
+      measuredCoverage: null,
+      effectiveShare: null
+    },
     {
       id: "blue",
       label: "远空蓝",
       oklch: { l: 0.918, c: 0.050, h: 248 },
       srgbFallback: "#d9e6f8",
       intensity: 0.56,
       peakOpacity: 0.090,
-      lightnessBias: 0.001,
       fieldScale: 0.98,
       phase: [0.63, 0.43],
       measuredCoverage: null,
       effectiveShare: null
+    },
+    {
+      id: "lilac",
+      label: "薄雾丁香",
+      oklch: { l: 0.925, c: 0.045, h: 304 },
+      srgbFallback: "#eee3f2",
+      intensity: 0.54,
+      peakOpacity: 0.076,
+      fieldScale: 1.06,
+      phase: [0.39, 0.86],
+      measuredCoverage: null,
+      effectiveShare: null
     }
   ],
   field: {
@@ -94,12 +88,10 @@ window.SPECTRAL_THEME = {
     warpStrength: 0.32,
     motionSpeed: 0.015,
     staticTime: 1.73,
-    ditherStrength: 0.65,
-    luminanceCap: 0.98
+    ditherStrength: 1
   },
   output: {
     colorSpace: "srgb",
-    p3Enhancement: "feature-detected",
     reducedMotion: "frozen-calibrated-frame"
   }
 };
```

**File**: `skills/liuguang-banlan-ui/assets/starter/opal/theme.css` (modified, +48/-62)
```diff
@@ -1,49 +1,3 @@
-@supports not (color: oklch(0% 0 0)) {
-  :root {
-    --app-canvas: #f7f7f4;
-    --app-wash: rgba(247, 247, 244, 0.18);
-    --topbar-surface: rgba(252, 252, 249, 0.76);
-    --sidebar-surface: rgba(250, 250, 247, 0.70);
-    --band-surface: rgba(251, 251, 248, 0.68);
-    --workbench-surface: rgba(252, 252, 249, 0.70);
-    --pane-surface: rgba(253, 253, 251, 0.66);
-    --panel-surface: rgba(250, 250, 247, 0.92);
-    --button-surface: rgba(255, 255, 255, 0.46);
-    --ink-primary: #293341;
-    --ink-secondary: #59616d;
-    --ink-tertiary: #808792;
-    --ink-muted: #9ba1aa;
-    --line-subtle: rgba(47, 55, 68, 0.075);
-    --line-default: rgba(47, 55, 68, 0.115);
-    --line-strong: rgba(43, 52, 66, 0.20);
-    --state-hover: rgba(255, 255, 255, 0.48);
-    --state-selected: rgba(213, 229, 238, 0.48);
-    --brand-mark: radial-gradient(circle at 35% 30%, #ffffff, #cfe5eb 42%, #e7d8ee);
-    --brand-mark-detail: rgba(58, 72, 84, 0.46);
-    --account-orb: linear-gradient(135deg, #cfe7e2, #e4d9ee);
-    --status-good: #328f70;
-    --status-good-wash: rgba(50, 143, 112, 0.13);
-    --active-rule: #477f91;
-    --focus-ring: #397d94;
-    --selection: rgba(131, 174, 194, 0.42);
-    --control-accent: #397b91;
-    --primary-surface: #29313e;
-    --primary-hover: #222936;
-    --primary-border: rgba(33, 40, 52, 0.70);
-    --primary-ink: #f7f7f4;
-    --scroll-thumb: rgba(42, 50, 64, 0.22);
-    --observation-ribbon: linear-gradient(90deg, rgba(221, 167, 174, 0.68), rgba(169, 216, 211, 0.72), rgba(204, 180, 220, 0.66), rgba(231, 207, 155, 0.62));
-    --workbench-shadow: 0 1px 2px rgba(35, 44, 58, 0.035), 0 8px 24px rgba(52, 62, 77, 0.035);
-    --panel-shadow: -12px 0 40px rgba(48, 56, 69, 0.10);
-    --mini-map: rgba(223, 236, 241, 0.62);
-    --marker-cyan: #6aaeb4;
-    --marker-rose: #d5969e;
-    --marker-lilac: #b997c5;
-    --marker-gold: #d9bb7c;
-  }
-}
-
-@supports (color: oklch(0% 0 0)) {
 :root {
   --app-canvas: oklch(98.2% 0.004 94);
   --app-wash: oklch(99% 0.003 92 / 0.18);
@@ -63,9 +17,9 @@
   --line-strong: oklch(26% 0.025 246 / 0.20);
   --state-hover: oklch(100% 0 0 / 0.48);
   --state-selected: oklch(91% 0.024 222 / 0.48);
-  --brand-mark: radial-gradient(circle at 35% 30%, oklch(100% 0 0), oklch(88% 0.055 201) 42%, oklch(86% 0.05 318));
-  --brand-mark-detail: oklch(40% 0.04 236 / 0.46);
-  --account-orb: linear-gradient(135deg, oklch(87% 0.05 198), oklch(91% 0.04 315));
+  --brand-mark: var(--ink-primary);
+  --brand-mark-detail: oklch(98% 0.004 95 / 0.72);
+  --account-orb: oklch(90% 0.006 240);
   --status-good: oklch(58% 0.11 158);
   --status-good-wash: oklch(58% 0.11 158 / 0.13);
   --active-rule: oklch(54% 0.08 216);
@@ -77,7 +31,8 @@
   --primary-border: oklch(25% 0.025 240 / 0.70);
   --primary-ink: oklch(98% 0.004 95);
   --scroll-thumb: oklch(35% 0.02 240 / 0.22);
-  --observation-ribbon: linear-gradient(90deg, oklch(72% 0.08 22 / 0.68), oklch(73% 0.07 193 / 0.72), oklch(72% 0.07 302 / 0.66), oklch(76% 0.07 75 / 0.62));
+  --observation-ribbon: var(--line-strong);
+  --fallback-alpha: 0.24;
   --workbench-shadow: 0 1px 2px oklch(20% 0.02 240 / 0.035), 0 8px 24px oklch(35% 0.03 240 / 0.035);
   --panel-shadow: -12px 0 40px oklch(30% 0.03 240 / 0.10);
   --mini-map: oklch(95% 0.014 204 / 0.62);
@@ -86,22 +41,53 @@
   --marker-lilac: oklch(68% 0.08 307);
   --marker-gold: oklch(72% 0.08 81);
 }
-}
 
 .field-fallback body {
-  background: var(
-    --field-fallback-background,
-    radial-gradient(ellipse at 12% 18%, rgba(207, 229, 235, 0.72), transparent 46%),
-    radial-gradient(ellipse at 78% 22%, rgba(239, 205, 210, 0.68), transparent 48%),
-    radial-gradient(ellipse at 44% 82%, rgba(225, 210, 238, 0.58), transparent 54%),
-    var(--app-canvas)
-  );
+  background: var(--field-fallback-background, var(--app-canvas));
 }
 
-@supports (color: oklch(0% 0 0)) {
-@media (color-gamut: p3) {
+
+@supports not (color: oklch(0% 0 0)) {
   :root {
-    --observation-ribbon: linear-gradient(90deg, oklch(72% 0.095 22 / 0.68), oklch(73% 0.085 193 / 0.72), oklch(72% 0.085 302 / 0.66), oklch(76% 0.082 75 / 0.62));
+    --app-canvas: #f7f7f4;
+    --app-wash: rgba(247, 247, 244, 0.18);
+    --topbar-surface: rgba(252, 252, 249, 0.76);
+    --sidebar-surface: rgba(250, 250, 247, 0.70);
+    --band-surface: rgba(251, 251, 248, 0.68);
+    --workbench-surface: rgba(252, 252, 249, 0.70);
+    --pane-surface: rgba(253, 253, 251, 0.66);
+    --panel-surface: rgba(250, 250, 247, 0.92);
+    --button-surface: rgba(255, 255, 255, 0.46);
+    --ink-primary: #293341;
+    --ink-secondary: #59616d;
+    --ink-tertiary: #808792;
+    --ink-muted: #9ba1aa;
+    --line-subtle: rgba(47, 55, 68, 0.075);
+    --line-default: rgba(47, 55, 68, 0.115);
+    --line-strong: rgba(43, 52, 66, 0.20);
+    --state-hover: rgba(255, 255, 255, 0.48);
+    --state-selected: rgba(213, 229, 238, 0.48);
+    --brand-mark: radial-gradient(circle at 35% 30%, #ffffff, #cfe5eb 42%, #e7d8ee);
+    --bra
```

---

### Incident Patch 4: `10c250ca` (2026-09-30)
**Commit Message**: fix(typescript-expert): remove shell=True from the diagnostic script (#1730)

# Pull Request Description

Harden the `typescript-expert` diagnostic script: it is the only executable command-injection finding in the canonical corpus, and an advisory SkillSpector static scan over all 2,032 skill roots flagged it as the single real `subprocess.run(..., shell=True)` surface in a shipped script.

`skills/typescript-expert/scripts/ts_diagnostic.py` ran every diagnostic through `subprocess.run(cmd, shell=True, ...)` with interpolated command strings, and built its `any`/assertion counts from `grep -r ... | wc -l` and `... | head -5` pipelines. A shell interpolation bug there would be a real command-injection vector for anyone running the script inside a project.

The change removes shell execution entirely:

- `run_cmd` now takes an argument list and calls `subprocess.run(args, ...)` with no `shell=True`.
- `npx tsc --noEmit`, `npx tsc --extendedDiagnostics --noEmit`, and the version checks pass explicit argv lists.
- The `grep | wc | head` pipelines are replaced by an in-process pure-Python scanner over `src/**` (`grep_source_count`), so counts no longer depend on shell tools and the out

**File**: `skills/typescript-expert/scripts/ts_diagnostic.py` (modified, +40/-19)
```diff
@@ -10,21 +10,42 @@
 import json
 from pathlib import Path
 
-def run_cmd(cmd: str) -> str:
-    """Run shell command and return output."""
+def run_cmd(args):
+    """Run a command as an argument list (no shell) and return its output."""
     try:
-        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
+        result = subprocess.run(args, capture_output=True, text=True)
         return result.stdout + result.stderr
     except Exception as e:
         return str(e)
 
+def grep_source_count(pattern: str, exclude: str | None = None) -> tuple[int, list[str]]:
+    """Count and sample lines containing ``pattern`` under ``src/``.
+
+    Pure-Python replacement for ``grep -r ... src/`` so no shell is involved.
+    """
+    root = Path("src")
+    if not root.is_dir():
+        return 0, []
+    matches: list[str] = []
+    for path in sorted(root.rglob("*")):
+        if path.suffix not in (".ts", ".tsx") or not path.is_file():
+            continue
+        try:
+            text = path.read_text(encoding="utf-8", errors="replace")
+        except OSError:
+            continue
+        for lineno, line in enumerate(text.splitlines(), start=1):
+            if pattern in line and (exclude is None or exclude not in line):
+                matches.append(f"{path}:{lineno}:{line}")
+    return len(matches), matches
+
 def check_versions():
     """Check TypeScript and Node versions."""
     print("\n📦 Versions:")
     print("-" * 40)
     
-    ts_version = run_cmd("npx tsc --version 2>/dev/null").strip()
-    node_version = run_cmd("node -v 2>/dev/null").strip()
+    ts_version = run_cmd(["npx", "tsc", "--version"]).strip()
+    node_version = run_cmd(["node", "-v"]).strip()
     
     print(f"  TypeScript: {ts_version or 'Not found'}")
     print(f"  Node.js: {node_version or 'Not found'}")
@@ -134,11 +155,12 @@ def check_type_errors():
     print("\n🔍 Type Check:")
     print("-" * 40)
     
-    result = run_cmd("npx tsc --noEmit 2>&1 | head -20")
+    result = run_cmd(["npx", "tsc", "--noEmit"])
+    lines = result.splitlines()
     if "error TS" in result:
         errors = result.count("error TS")
         print(f"  ❌ {errors}+ type errors found")
-        print(result[:500])
+        print("\n".join(lines[:20])[:500])
     else:
         print("  ✅ No type errors")
 
@@ -147,13 +169,11 @@ def check_any_usage():
     print("\n⚠️ 'any' Type Usage:")
     print("-" * 40)
     
-    result = run_cmd("grep -r ': any' --include='*.ts' --include='*.tsx' src/ 2>/dev/null | wc -l")
-    count = result.strip()
-    if count and count != "0":
+    count, matches = grep_source_count(": any")
+    if count:
         print(f"  ⚠️ Found {count} occurrences of ': any'")
-        sample = run_cmd("grep -rn ': any' --include='*.ts' --include='*.tsx' src/ 2>/dev/null | head -5")
-        if sample:
-            print(sample)
+        if matches:
+            print("\n".join(matches[:5]))
     else:
         print("  ✅ No explicit 'any' types found")
 
@@ -162,9 +182,8 @@ def check_type_assertions():
     print("\n⚠️ Type Assertions (as):")
     print("-" * 40)
     
-    result = run_cmd("grep -r ' as ' --include='*.ts' --include='*.tsx' src/ 2>/dev/null | grep -v 'import' | wc -l")
-    count = result.strip()
-    if count and count != "0":
+    count, _ = grep_source_count(" as ", exclude="import")
+    if count:
         print(f"  ⚠️ Found {count} type assertions")
     else:
         print("  ✅ No type assertions found")
@@ -174,9 +193,11 @@ def check_performance():
     print("\n⏱️ Type Check Performance:")
     print("-" * 40)
     
-    result = run_cmd("npx tsc --extendedDiagnostics --noEmit 2>&1 | grep -E 'Check time|Files:|Lines:|Nodes:'")
-    if result.strip():
-        for line in result.strip().split('\n'):
+    result = run_cmd(["npx", "tsc", "--extendedDiagnostics", "--noEmit"])
+    keys = ("Check time", "Files:", "Lines:", "Nodes:")
+    lines = [line for line in result.splitlines() if any(k in line for k in keys)]
+    if lines:
+        for line in lines:
             print(f"  {line}")
     else:
         print("  ⚠️ Could not measure performance")
```

---

### Incident Patch 5: `02ca42fe` (2026-09-30)
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
-| 1 | <a href="https://github.com/Prince-1652"><img src="https://github.com/Prince-1652.png?size=48" width="32" height="32" alt="" /></a> [@Prince-1652](https://github.com/Prince-1652) | 92 |
-| 2 | <a href="https://github.com/sohamganatra"><img src="https://github.com/sohamganatra.png?size=48" width="32" height="32" alt="" /></a> [@sohamganatra](https://github.com/sohamganatra) | 78 |
-| 3 | <a href="https://github.com/FrancoStino"><img src="https://github.com/FrancoStino.png?size=48" width="32" height="32" alt="" /></a> [@FrancoStino](https://github.com/FrancoStino) | 61 |
-| 4 | <a href="https://github.com/ProgramadorBrasil"><img src="https://github.com/ProgramadorBrasil.png?size=48" width="32" height="32" alt="" /></a> [@ProgramadorBrasil](https://github.com/ProgramadorBrasil) | 52 |
-| 5 | <a href="https://github.com/nikolasdehor"><img src="https://github.com/nikolasdehor.png?size=48" width="32" height="32" alt="" /></a> [@nikolasdehor](https://github.com/nikolasdehor) | 35 |
-| 6 | <a href="https://github.com/RamonRiosJr"><img src="https:
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
+    return authors
+
+
+def compute_skill_ranking(root: Path, pr_authors: dict[int, str]) -> list[tuple[str, int]]:
+    """Count each current canonical skill once, credited to its PR author."""
+    present = {
+        path for path in _run(["git", "ls-tree", "-r", "--name-only", "HEAD", "skills/"], root).splitlines()
+        if path.endswith("/SKILL.md")
+    }
+    log = _run(
+        ["git", "log", "HEAD", "--diff-filter=A", "--format=@@%s", "--name-only",
+         "--", "skills/*/SKILL.md"],
+        root,
+    )
+    seen: set[str] = set()
+    counts: Counter = Counter()
+    subject: str | None = None
+    for line in log.splitlines():
+        if line.startswith("@@"):
+            subject = line[2:]
+            continue
+        if not line.endswith("/SKILL.md") or line not in present or line in seen:
+            continue
+        seen.add(line)
+        match = PR_NUMBER_PATTERN.search(subject or "")
+        if not match:
+            continue
+        login = pr_author
```

**File**: `tools/scripts/tests/test_sync_top_contributors.py` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+import importlib.util
+import json
+import sys
+import unittest
+from pathlib import Path
+
+
+REPO_ROOT = Path(__file__).resolve().parents[3]
+TOOLS_SCRIPTS_DIR = REPO_ROOT / "tools" / "scripts"
+if str(TOOLS_SCRIPTS_DIR) not in sys.path:
+    sys.path.insert(0, str(TOOLS_SCRIPTS_DIR))
+
+
+def load_module(relative_path: str, module_name: str):
+    spec = importlib.util.spec_from_file_location(module_name, REPO_ROOT / relative_path)
+    module = importlib.util.module_from_spec(spec)
+    assert spec.loader is not None
+    sys.modules[module_name] = module
+    spec.loader.exec_module(module)
+    return module
+
+
+top = load_module(
+    "tools/scripts/sync_top_contributors.py",
+    "sync_top_contributors_test",
+)
+
+
+COMMIT_ROWS = [("alice", 12), ("bob", 9)]
+SKILL_ROWS = [("bob", 40), ("carol", 25)]
+
+
+class SyncTopContributorsTests(unittest.TestCase):
+    def test_section_is_replaced_between_its_own_headings(self):
+        readme = (
+            "# Title\n\n## Top Contributors\n\nstale\n\n"
+            "## Repo Contributors\n\nkeep me\n\n## Star History\n\ntail\n"
+        )
+        updated = top.update_top_contributors_section(readme, COMMIT_ROWS, SKILL_ROWS)
+        self.assertIn("### Most Commits", updated)
+        self.assertIn("### Most Skills Added", updated)
+        self.assertNotIn("stale", updated)
+        # Neighbouring sections must survive untouched.
+        self.assertIn("## Repo Contributors\n\nkeep me", updated)
+        self.assertIn("## Star History\n\ntail", updated)
+
+    def test_rendered_rows_keep_order_and_values(self):
+        updated = top.update_top_contributors_section(
+            "## Top Contributors\n\nx\n\n## Repo Contributors\n", COMMIT_ROWS, SKILL_ROWS
+        )
+        self.assertLess(updated.index("[@alice]"), updated.index("[@bob]"))
+        self.assertIn("| 1 |", updated)
+        self.assertIn("| 12 |", updated)
+        self.assertIn("| 40 |", updated)
+
+    def test_missing_section_fails_closed(self):
+        with self.assertRaises(ValueError):
+            top.update_top_contributors_section("# Title\n", COMMIT_ROWS, SKILL_ROWS)
+
+    def test_excluded_accounts_never_render(self):
+        rows = [(login, 1) for login in sorted(top.EXCLUDED_LOGINS)]
+        updated = top.update_top_contributors_section(
+            "## Top Contributors\n\nx\n\n## Repo Contributors\n", rows, rows
+        )
+        for login in top.EXCLUDED_LOGINS:
+            self.assertNotIn(f"[@{login}]", updated)
+
+    def test_maintainer_aliases_resolve_to_one_account(self):
+        self.assertEqual(top.login_from_email("184072420+sickn33@users.noreply.github.com"), "sickn33")
+        self.assertEqual(top.login_from_email("sickn33@users.noreply.github.com"), "sickn33")
+        self.assertEqual(top.login_from_email("niccolo.lucioli@hotmail.com"), "sickn33")
+        self.assertIsNone(top.login_from_email("someone@example.com"))
+
+    def test_copy_origin_is_not_treated_as_a_new_skill(self):
+        # Only the recorded first introduction counts; a later copy of an
+        # existing SKILL.md must not inflate a contributor's total.
+        self.assertTrue(hasattr(top, "compute_skill_ranking"))
+
+    def test_render_table_has_a_stable_header(self):
+        table = top.render_table(COMMIT_ROWS, "Commits")
+        self.assertEqual(table.splitlines()[0], "| # | Contributor | Commits |")
+        self.assertEqual(table.splitlines()[1], "|---:|---|---:|")
+        self.assertEqual(len(table.splitlines()), 4)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 6: `1e844421` (2026-09-30)
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
+- **Vercel production headers (#1685)** — tighten the hosted catalog's production response headers and document the intended policy.
+- **Contributor rendering (#1683)** — keep enough contrib.rocks headroom that the README shows every contributor instead of truncating the list.
+- **Maintainer documentation (#1707)** — align the canonical maintainer skill with the current CI workflow and the SkillSpector report interpretation.
+
+### Fixed
+
+- **Fork copy classification (#1709)** — a new `SKILL.md` that Git paired as a copy of an existing file was accepted or rejected depending on whether the similarity heuristic chose a canonical skill or a generated plugin mirror as the copy origin. The fork classifier now treats a copy origin as read-only, matching the documented source-only rule, while the destination still carries every path, mode, object, and size check and editing, renaming, or deleting that origin still fails closed.
+- **Fork run allowlist (#1714)** — the PR-only SkillSpector workflow was missing from the fork-run approval allowlist, so every fork pull request stalled on `action_required` w
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

**File**: `skills/telegram/assets/boilerplate/nodejs/package-lock.json` (modified, +3/-3)
```diff
@@ -349,9 +349,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

**File**: `skills/telegram/assets/boilerplate/nodejs/package.json` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@
     "ts-node-dev": "^2.0.0"
   },
   "overrides": {
+    "brace-expansion": "^1.1.21",
     "qs": "^6.16.0"
   }
 }
```

**File**: `skills/whatsapp-cloud-api/assets/boilerplate/nodejs/package-lock.json` (modified, +3/-3)
```diff
@@ -364,9 +364,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.18.tgz",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
```

---

### Incident Patch 7: `200ad77b` (2026-09-30)
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

**File**: `tools/scripts/tests/test_skillspector_advisory.py` (modified, +13/-0)
```diff
@@ -128,6 +128,19 @@ def test_workflow_uses_trusted_base_and_network_isolation(self):
         self.assertNotIn('requires_references', job)
         self.assertIn("steps.plan.outputs.count != '0'", job)
 
+    def test_workflow_is_approvable_for_fork_pull_requests(self):
+        # A read-only PR-only workflow that is missing from the merge:batch
+        # allowlist leaves every fork skill PR stuck on action_required with no
+        # required check able to run, so the allowlist and this workflow must
+        # stay aligned.
+        root = Path(__file__).resolve().parents[3]
+        merge_batch = (root / 'tools/scripts/merge_batch.cjs').read_text()
+        self.assertIn('".github/workflows/skillspector-advisory.yml"', merge_batch)
+        workflow = (root / '.github/workflows/skillspector-advisory.yml').read_text()
+        self.assertNotIn('secrets.', workflow)
+        self.assertNotIn('pull_request_target', workflow)
+        self.assertNotIn('workflow_run', workflow)
+
 
 if __name__ == '__main__':
     unittest.main()
```

---

### Incident Patch 8: `970f453a` (2026-09-29)
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

#### Recent Merged Pull Requests:
- **PR #1795** (2026-10-04): docs: correct 18.15.0 catalog skill count (@sickn33)
- **PR #1794** (2026-10-04): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1793** (2026-10-04): chore: release v18.15.0 (@sickn33)
- **PR #1792** (2026-10-04): docs: stage 18.15.0 changelog (@sickn33)
- **PR #1791** (2026-10-04): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1790** (2026-10-04): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1789** (2026-10-04): chore: synchronize canonical repository state (@github-actions[bot])
- **PR #1788** (2026-10-04): feat: add byagent skill for publishing agent pages with line comments (@anup-a)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
