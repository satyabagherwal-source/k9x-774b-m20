# Forensic Learning Record (Deep Inspection): rohitg00/ai-engineering-from-scratch

> **Canonical Artifact**: `07_PROJECT_LEARNING/rohitg00-ai-engineering-from-scratch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rohitg00/ai-engineering-from-scratch](https://github.com/rohitg00/ai-engineering-from-scratch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:04:28.525Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rohitg00/ai-engineering-from-scratch`
- **Description**: Learn it. Build it. Ship it for others.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 62088 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/certification.js`
```
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const SEO_START = '<!-- AIFS:CERTIFICATION-SEO:START -->';
const SEO_END = '<!-- AIFS:CERTIFICATION-SEO:END -->';
const FALLBACK_START = '<!-- AIFS:CERTIFICATION-FALLBACK:START -->';
const FALLBACK_END = '<!-- AIFS:CERTIFICATION-FALLBACK:END -->';
const CERTIFICATION_QUERY_NAMES = new Set(['id', 'track', 'legacy']);

let productionAssets;

function loadProductionAssets() {
  if (!productionAssets) {
    productionAssets = {
      template: fs.readFileSync(path.join(__dirname, '..', 'site', 'certification.html'), 'utf8'),
      manifest: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site', 'certification-seo.json'), 'utf8')),
    };
  }
  return productionAssets;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function queryValue(req, name) {
  const direct = req.query && req.query[name];
  if (Array.isArray(direct)) return '';
  if (typeof direct === 'string') return direct;
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams.get(name) || '';
  } catch (_) {
    return '';
  }
}

function queryNames(req) {
  const names = new Set();
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(function (name) { names.add(name); });
  }
  try {
    new URL(req.url || '/', 'http://localhost').searchParams.forEach(function (_, name) {
      names.add(name);
    });
  } catch (_) {}
  return names;
}

function hasUnknownQuery(req) {
  return Array.from(queryNames(req)).some(function (name) {
    return !CERTIFICATION_QUERY_NAMES.has(name);
  });
}

function validTrackId(value) {
  if (!value || value.includes('..') || value.includes('\\') || value.includes('\0')) return false;
  return /^[a-z0-9][a-z0-9._-]*$/i.test(value);
}

function trackAliases(entry) {
  if (!entry || typeof entry !== 'object') return [];
  const aliases = [entry.id, entry.slug, entry.examCode];
  if (typeof entry.id === 'string' && entry.id.startsWith('claude-')) {
    aliases.push(entry.id.slice('claude-'.length));
  }
  return aliases.filter(Boolean).map(function (value) { return String(value).toLowerCase(); });
}

function resolveTrack(tracks, requestedId) {
  if (!tracks || typeof tracks !== 'object' || !validTrackId(requestedId)) return null;
  const normalized = requestedId.toLowerCase();
  return Object.values(tracks).find(function (entry) {
    return trackAliases(entry).includes(normalized);
  }) || null;
}

function canonicalForTrack(trackId) {
  return `${ORIGIN}/certification?id=${encodeURIComponent(trackId)}`;
}

function replaceMarkedRegion(template, start, end, content) {
  const startIndex = template.indexOf(start);
  const endIndex = template.indexOf(end);
  if (
    startIndex < 0 ||
    endIndex < startIndex ||
    template.indexOf(start, startIndex + start.length) >= 0 ||
    template.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error('template-markers');
  }
  const bodyStart = startIndex + start.length;
  return `${template.slice(0, bodyStart)}\n${content}\n      ${template.slice(endIndex)}`;
}

function trackLessons(entry) {
  if (!Array.isArray(entry.lessons)) return [];
  return entry.lessons.filter(function (lesson) {
    return lesson && typeof lesson === 'object' && lesson.path && lesson.title;
  });
}

function certificationHead(entry, trackId) {
  const canonical = canonicalForTrack(trackId);
  const title = entry.seoTitle || `${entry.title} - AI Engineering from Scratch`;
  const description = entry.description || entry.excerpt || 'Free, independent certification preparation with ordered lessons and original practice.';
  const course = {
    '@type': 'Course',
    name: entry.title,
    description,
    url: canonical,
    inLanguage: 'en',
    isAccessibleForFree: true,
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      course,
      {
        '@type': 'CollectionPage',
        name: entry.title,
        description,
        url: canonical,
        mainEntity: course,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN },
          { '@type': 'ListItem', position: 2, name: 'Certifications', item: `${ORIGIN}/certifications.html` },
          { '@type': 'ListItem', position: 3, name: entry.title, item: canonical },
        ],
      },
    ],
  };

  return [
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description)}">`,
    `  <link rel="canonical" href="${escapeHtml(canonical)}">`,
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta property="og:image" content="${ORIGIN}/og-image.png?v=4">`,
    `  <meta property="og:url" content="${escapeHtml(canonical)}">`,
    '  <meta property="og:type" content="website">',
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escapeHtml(title)}">`,
    `  <meta name="twitter:description" content="${escapeHtml(description)}">`,
    `  <meta name="twitter:image" content="${ORIGIN}/og-image.png?v=4">`,
    `  <script type="application/ld+json" id="certificationJsonLd">${jsonForHtml(jsonLd)}</script>`,
  ].join('\n');
}

function certificationFallback(entry, trackId) {
  const lessons = trackLessons(entry);
  const visibleLessons = lessons.slice(0, 12);
  const lessonItems = visibleLessons.map(function (lesson) {
    const params = new URLSearchParams();
    params.set('path', lesson.path);
    params.set(
      /^certifications\/[a-z0-9][a-z0-9-]*\/lessons\//.test(lesson.path) ? 'track' : 'fromTrack',
      trackId
    );
    const href = `/lesson?${params.toString()}`;
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(lesson.title)}</a></li>`;
  }).join('');
  const remaining = lessons.length - visibleLessons.length;
  const excerpt = entry.excerpt || entry.description;

  return [
    '      <div class="cert-track-not-found-copy cert-seo-fallback" data-server-rendered="true">',
    '        <div class="cert-eyebrow">INDEPENDENT CERTIFICATION PREPARATION</div>',
    `        <h1>${escapeHtml(entry.title)}</h1>`,
    excerpt ? `        <p class="cert-track-summary">${escapeHtml(excerpt)}</p>` : '',
    entry.description && entry.description !== excerpt ? `        <p>${escapeHtml(entry.description)}</p>` : '',
    `        <p>This free community study path organizes ${lessons.length} practical lessons in a deliberate order, then connects them to original diagnostics and practice. It does not issue a credential or reproduce protected exam questions.</p>`,
    lessonItems ? `        <h2>Lessons in this path</h2><ol>${lessonItems}</ol>` : '',
    remaining > 0 ? `        <p>${remaining} more lessons continue in the interactive track.</p>` : '',
    `        <div class="cert-track-hero-actions"><a class="cert-action" href="/certifications.html">All certifications</a><a class="cert-action secondary" href="${escapeHtml(canonicalForTrack(trackId))}">Open interactive track</a></div>`,
    '      </div>',
  ].filter(Boolean).join('\n');
}

function errorPage(title, message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex"><title>${escapeHtml(title)} - AI Engineering from Scratch</title></head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><nav aria-label="Recovery links"><ul><li><a href="/certifications.html">Certific
```

### Core Architecture Module: `api/lesson.js`
```
const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://aiengineeringfromscratch.com';
const SEO_START = '<!-- AIFS:LESSON-SEO:START -->';
const SEO_END = '<!-- AIFS:LESSON-SEO:END -->';
const FALLBACK_START = '<!-- AIFS:LESSON-FALLBACK:START -->';
const FALLBACK_END = '<!-- AIFS:LESSON-FALLBACK:END -->';
const LESSON_QUERY_NAMES = new Set(['path', 'track', 'fromTrack', 'learningPath', 'lang', 'ttsTest', 'legacy']);
const LEARNING_PATH_ALIASES = Object.freeze({
  'mcp-engineering': 'model-context-protocol',
});

let productionAssets;

function loadProductionAssets() {
  if (!productionAssets) {
    const languageRegistry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'languages.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'site', 'lesson-seo.json'), 'utf8'));
    productionAssets = {
      template: fs.readFileSync(path.join(__dirname, '..', 'site', 'lesson.html'), 'utf8'),
      manifest,
      languageCodes: Array.isArray(languageRegistry.languages)
        ? languageRegistry.languages
          .filter(function (language) { return language.source || language.ci; })
          .map(function (language) { return String(language.code || ''); }).filter(Boolean)
        : [],
    };
  }
  return productionAssets;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function queryValue(req, name) {
  const direct = req.query && req.query[name];
  if (Array.isArray(direct)) return '';
  if (typeof direct === 'string') return direct;
  try {
    return new URL(req.url || '/', 'http://localhost').searchParams.get(name) || '';
  } catch (_) {
    return '';
  }
}

function queryNames(req) {
  const names = new Set();
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(function (name) { names.add(name); });
  }
  try {
    new URL(req.url || '/', 'http://localhost').searchParams.forEach(function (_, name) {
      names.add(name);
    });
  } catch (_) {}
  return names;
}

function rawUrlQuery(req) {
  const requestUrl = typeof req.url === 'string' ? req.url : '';
  const queryIndex = requestUrl.indexOf('?');
  if (queryIndex < 0) return null;
  const fragmentIndex = requestUrl.indexOf('#', queryIndex);
  return requestUrl.slice(queryIndex + 1, fragmentIndex < 0 ? undefined : fragmentIndex);
}

function isLocalRequest(req) {
  const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
  const forwardedHost = String(headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(headers.host || '').trim();
  try {
    const hostname = new URL(`http://${host || 'invalid'}`).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch (_) {
    return false;
  }
}

function hasQuery(req, name) {
  return queryNames(req).has(name);
}

function validLessonPath(value) {
  if (!value || value.includes('..') || value.includes('\\') || value.includes('\0')) return false;
  return /^(?:phases\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*|certifications\/[a-z0-9][a-z0-9-]*\/lessons\/[a-z0-9][a-z0-9-]*)$/.test(value);
}

function validTrackId(value) {
  return /^[a-z0-9][a-z0-9-]*$/.test(value || '');
}

function validLanguageCode(value) {
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(value || '');
}

function listedValue(values, value) {
  return Array.isArray(values) && values.includes(value);
}

function canonicalForLesson(lessonPath) {
  return `${ORIGIN}/lesson?path=${encodeURIComponent(lessonPath)}`;
}

function replaceMarkedRegion(template, start, end, content) {
  const startIndex = template.indexOf(start);
  const endIndex = template.indexOf(end);
  if (
    startIndex < 0 ||
    endIndex < startIndex ||
    template.indexOf(start, startIndex + start.length) >= 0 ||
    template.indexOf(end, endIndex + end.length) >= 0
  ) {
    throw new Error('template-markers');
  }
  const bodyStart = startIndex + start.length;
  return `${template.slice(0, bodyStart)}\n${content}\n  ${template.slice(endIndex)}`;
}

function contextLabel(context) {
  if (!context || typeof context !== 'object') return 'AI Engineering from Scratch';
  if (context.kind === 'course' && context.phaseName) {
    const phase = context.phaseId == null ? '' : `Phase ${String(context.phaseId).padStart(2, '0')}: `;
    return `${phase}${context.phaseName}`;
  }
  if (context.kind === 'certification') return context.programName || 'Independent certification preparation';
  return 'AI Engineering from Scratch';
}

function lessonHeading(entry, manifest) {
  const lessons = manifest && manifest.lessons && typeof manifest.lessons === 'object'
    ? Object.values(manifest.lessons)
    : [];
  const matchingTitles = lessons.filter(function (candidate) {
    return candidate && candidate.title === entry.title;
  });
  if (matchingTitles.length < 2) return entry.title;

  const label = contextLabel(entry.context).replace(/^Phase \d+: /, '');
  const sameLabelCount = matchingTitles.filter(function (candidate) {
    return contextLabel(candidate.context).replace(/^Phase \d+: /, '') === label;
  }).length;
  if (sameLabelCount === 1) return `${entry.title} - ${label}`;

  const seoHeading = String(entry.seoTitle || '').replace(/ - AI Engineering from Scratch$/, '');
  if (seoHeading && seoHeading !== entry.title) return seoHeading;
  return `${entry.title} - ${entry.path}`;
}

function lessonReference(ref) {
  if (!ref || typeof ref !== 'object' || !validLessonPath(ref.path)) return null;
  return {
    path: ref.path,
    title: String(ref.title || ref.path.split('/').pop().replace(/^\d+-/, '').replace(/-/g, ' ')),
  };
}

function lessonHead(entry, lessonPath, heading) {
  const canonical = canonicalForLesson(lessonPath);
  const title = entry.seoTitle || `${entry.title} - AI Engineering from Scratch`;
  const description = entry.description || entry.excerpt || 'A lesson from the AI Engineering from Scratch curriculum.';
  const courseName = contextLabel(entry.context);
  const breadcrumbParent = entry.context && entry.context.kind === 'certification'
    ? { name: 'Certifications', url: `${ORIGIN}/certifications.html` }
    : { name: 'Course catalog', url: `${ORIGIN}/catalog.html` };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'LearningResource',
        name: heading,
        headline: heading,
        description,
        url: canonical,
        mainEntityOfPage: canonical,
        inLanguage: 'en',
        isAccessibleForFree: true,
        isPartOf: {
          '@type': 'Course',
          name: courseName,
          url: entry.context && entry.context.kind === 'certification'
            ? `${ORIGIN}/certifications.html`
            : ORIGIN,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN },
          { '@type': 'ListItem', position: 2, name: breadcrumbParent.name, item: breadcrumbParent.url },
          { '@type': 'ListItem', position: 3, name: heading, item: canonical },
        ],
      },
    ],
  };

  return [
    `  <title>${escapeHtml(title)}</title>`,
    `  <meta name="description" content="${escapeHtml(description)}">`,
    `  <link rel="canonical" href="${escapeHtml(canonical)}">`,
    `  <meta property="og:title" content="${escapeHtml(title)}">`,
    `  <meta property="og:description" content="${escapeHtml(description)}">`,
    `  <meta property="og:image" content="${ORIGIN}/og-image.png?v=4">`,
    `  <meta property="og:url" content="${escapeHtml(canonical)}">`,
    '  <meta property="og:t
```

### Core Architecture Module: `api/markdown.js`
```
const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.join(__dirname, '..', 'site');
const HTML_BY_PATH = {
  '/': 'index.html',
  '/about': 'about.html',
  '/catalog': 'catalog.html',
  '/glossary': 'glossary.html',
  '/path': 'prereqs.html',
  '/roadmap': 'prereqs.html',
  '/developer': 'developer.html',
  '/docs': 'developer.html',
  '/contact': 'contact.html',
  '/privacy': 'privacy.html',
  '/sponsors': 'sponsors.html',
};

function parseAccept(header) {
  if (!header) return [{ type: 'text/html', q: 1 }];
  return header.split(',').map((part, index) => {
    const [rawType, ...params] = part.trim().toLowerCase().split(';');
    const qParam = params.find((param) => param.trim().startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
    return { type: rawType.trim(), q: Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0, index };
  }).filter((entry) => entry.type).sort((a, b) => {
    if (b.q !== a.q) return b.q - a.q;
    const specificity = (type) => type === '*/*' ? 0 : type.endsWith('/*') ? 1 : 2;
    return specificity(b.type) - specificity(a.type) || a.index - b.index;
  });
}

function qualityFor(accepted, mediaType) {
  const exact = accepted.find((entry) => entry.type === mediaType);
  if (exact) return exact.q;
  const wildcard = accepted.find((entry) => entry.type === `${mediaType.split('/')[0]}/*`)
    || accepted.find((entry) => entry.type === '*/*');
  return wildcard ? wildcard.q : 0;
}

function markdownFor(requestPath) {
  const llms = fs.readFileSync(path.join(SITE_ROOT, 'llms.txt'), 'utf8');
  if (requestPath === '/') return llms;
  return `# AI Engineering from Scratch\n\nCanonical page: https://aiengineeringfromscratch.com${requestPath}\n\nThe agent-oriented curriculum index is available at https://aiengineeringfromscratch.com/llms.txt.\n\n${llms}`;
}

module.exports = (req, res) => {
  const method = req.method || 'GET';
  function send(status, contentType, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.end(method === 'HEAD' ? undefined : body);
  }
  function problem(status, title, code, detail) {
    res.setHeader('Cache-Control', 'no-store');
    send(status, 'application/problem+json', JSON.stringify({
      type: 'about:blank', title, status, code, detail,
    }) + '\n');
  }

  const requestPath = String((req.query && req.query.path) || '/').split('?')[0] || '/';
  const accepted = parseAccept(req.headers.accept || '');
  const markdownQ = qualityFor(accepted, 'text/markdown');
  const htmlQ = qualityFor(accepted, 'text/html');
  res.setHeader('Vary', 'Accept, Accept-Encoding');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, must-revalidate');
  res.setHeader('X-API-Version', '1');

  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    problem(405, 'Method Not Allowed', 'method_not_allowed', 'Use GET or HEAD to read public resources.');
    return;
  }

  const file = Object.hasOwn(HTML_BY_PATH, requestPath) ? HTML_BY_PATH[requestPath] : null;
  if (!file) {
    res.setHeader('Cache-Control', 'no-store');
    if (markdownQ >= htmlQ && markdownQ > 0) {
      send(404, 'text/markdown', '# Page not found\n\nThis path does not exist.\n\nTry the [curriculum index](/llms.txt), [sitemap](/sitemap.xml), or [catalog](/catalog.html).\n');
    } else if (htmlQ > 0) {
      send(404, 'text/html', fs.readFileSync(path.join(SITE_ROOT, '404.html'), 'utf8'));
    } else {
      problem(404, 'Not Found', 'resource_not_found', 'Use /llms.txt or /sitemap.xml to discover public resources.');
    }
    return;
  }

  if (!markdownQ && !htmlQ) {
    problem(406, 'Not Acceptable', 'representation_not_supported', 'Request text/html or text/markdown.');
    return;
  }

  if (markdownQ >= htmlQ && markdownQ > 0) {
    send(200, 'text/markdown', markdownFor(requestPath));
    return;
  }

  send(200, 'text/html', fs.readFileSync(path.join(SITE_ROOT, file), 'utf8'));
};

```

### Core Architecture Module: `api/v1/markdown.js`
```
module.exports = require('../markdown.js');

```

### Core Architecture Module: `certifications/claude/lessons/00-certification-strategy/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/00-certification-strategy/docs/en.md
It validates a readiness packet and ranks domains by weighted weakness.
It uses only local JSON and never reconstructs confidential exam content.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONFIDENCE_MULTIPLIER = {"unseen": 1.5, "understood": 1.25, "practiced": 1.0, "timed": 0.8}
REQUIRED_DOMAIN_FIELDS = {"id", "weight", "allocatedHours", "confidence", "decisions", "artifact", "failureMode"}
REQUIRED_STAGES = {"orient", "build", "transfer", "simulate"}
REQUIRED_ERROR_TYPES = {
    "recall-gap",
    "stale-fact",
    "missed-constraint",
    "sequence-error",
    "surface-confusion",
    "evidence-failure",
    "overengineering",
}


def validate_plan(plan: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    guide = plan.get("guide")
    if not isinstance(guide, dict):
        errors.append("guide must be an object")
    else:
        if not str(guide.get("officialSource", "")).startswith("https://"):
            errors.append("guide officialSource must be HTTPS")
        if not _iso_date(guide.get("verifiedOn")):
            errors.append("guide verifiedOn must be an ISO date")
    domains = plan.get("domains")
    if not isinstance(domains, list) or len(domains) != 7:
        return errors + ["domains must contain exactly seven entries"]
    identifiers: set[str] = set()
    for index, domain in enumerate(domains):
        if not isinstance(domain, dict):
            errors.append(f"domains[{index}] must be an object")
            continue
        missing = REQUIRED_DOMAIN_FIELDS - set(domain)
        if missing:
            errors.append(f"domains[{index}] missing {', '.join(sorted(missing))}")
        identifier = domain.get("id")
        if not isinstance(identifier, str) or not identifier:
            errors.append(f"domains[{index}].id must be non-empty")
        elif identifier in identifiers:
            errors.append(f"duplicate domain id: {identifier}")
        identifiers.add(str(identifier))
        if domain.get("confidence") not in CONFIDENCE_MULTIPLIER:
            errors.append(f"domains[{index}].confidence is invalid")
        if not isinstance(domain.get("decisions"), list) or len(domain["decisions"]) < 2:
            errors.append(f"domains[{index}] needs at least two decisions")
        for field in ("artifact", "failureMode"):
            if not isinstance(domain.get(field), str) or not domain[field].strip():
                errors.append(f"domains[{index}].{field} must be non-empty")
    if round(sum(_number(item.get("weight")) for item in domains), 6) != 100:
        errors.append("domain weights must total 100")
    allocated = sum(_number(item.get("allocatedHours")) for item in domains)
    if round(allocated, 6) != round(_number(plan.get("totalHours")), 6):
        errors.append("allocated hours must equal totalHours")
    protocol = plan.get("practiceProtocol")
    if not isinstance(protocol, dict):
        errors.append("practiceProtocol must be an object")
    else:
        stages = protocol.get("stages")
        if not isinstance(stages, list):
            errors.append("practiceProtocol stages must be a list")
        else:
            stage_ids = {item.get("id") for item in stages if isinstance(item, dict)}
            if len(stages) != len(REQUIRED_STAGES) or stage_ids != REQUIRED_STAGES:
                errors.append("practiceProtocol must include orient, build, transfer, and simulate exactly once")
            if any(not str(item.get("exitEvidence", "")).strip() for item in stages if isinstance(item, dict)):
                errors.append("every practice stage needs exitEvidence")
        error_types = protocol.get("errorTaxonomy")
        if not isinstance(error_types, list) or set(error_types) != REQUIRED_ERROR_TYPES:
            errors.append("practiceProtocol errorTaxonomy is incomplete")
    return errors


def rank_domains(plan: dict[str, Any]) -> list[str]:
    errors = validate_plan(plan)
    if errors:
        raise ValueError("; ".join(errors))
    ranked = sorted(
        plan["domains"],
        key=lambda domain: domain["weight"] * CONFIDENCE_MULTIPLIER[domain["confidence"]],
        reverse=True,
    )
    return [domain["id"] for domain in ranked]


def build_report(plan: dict[str, Any]) -> dict[str, Any]:
    errors = validate_plan(plan)
    return {
        "valid": not errors,
        "errors": errors,
        "totalHours": plan.get("totalHours"),
        "studyOrder": rank_domains(plan) if not errors else [],
    }


def _number(value: Any) -> float:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else 0.0


def _iso_date(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return bool(__import__("datetime").date.fromisoformat(value))
    except ValueError:
        return False


def load_plan(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("plan root must be an object")
    return value


if __name__ == "__main__":
    artifact = Path(__file__).parents[1] / "outputs" / "readiness-plan.json"
    print(json.dumps(build_report(load_plan(artifact)), indent=2))

```

### Core Architecture Module: `certifications/claude/lessons/01-claude-product-and-model-landscape/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/01-claude-product-and-model-landscape/docs/en.md
It validates surface, model, and deployment decisions plus their dated evidence.
All measurements come from a local filled scenario rather than provider calls.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


DEPLOYMENT_PATHS = {
    "claude-enterprise-direct",
    "amazon-bedrock",
    "google-vertex-ai",
    "microsoft-foundry",
}
DEPLOYMENT_CRITERIA = {
    "cloudCommitment",
    "procurement",
    "dataBoundary",
    "identity",
    "seatsBudgets",
    "operationalControl",
}
OFFICIAL_DOC_PREFIXES = (
    "https://platform.claude.com/docs/",
    "https://support.claude.com/",
    "https://claude.com/docs/",
)


def validate_record(record: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not _iso_date(record.get("verifiedOn")):
        errors.append("verifiedOn must be an ISO date")
    if not isinstance(record.get("humanOwner"), str) or not record["humanOwner"].strip():
        errors.append("humanOwner is required")
    requirements = record.get("requirements")
    needed = {"recurrence", "publicFreshnessDays", "internalSource", "sensitivity", "output", "collaboration", "consequence"}
    if not isinstance(requirements, dict) or needed - set(requirements):
        errors.append("requirements are incomplete")
    surfaces = record.get("surfaceCandidates")
    if not isinstance(surfaces, list) or len(surfaces) < 2:
        errors.append("at least two surface candidates are required")
    else:
        ids = [item.get("id") for item in surfaces if isinstance(item, dict)]
        if len(ids) != len(set(ids)):
            errors.append("surface candidate ids must be unique")
        passing = [item for item in surfaces if isinstance(item, dict) and item.get("meetsConstraints") is True]
        if not passing:
            errors.append("at least one surface must meet constraints")
        elif record.get("selectedSurface") != min(passing, key=lambda item: item.get("complexity", 999))["id"]:
            errors.append("selectedSurface must be the smallest passing surface")
        if not any(item.get("meetsConstraints") is False and str(item.get("reason", "")).strip() for item in surfaces):
            errors.append("a rejected alternative with a reason is required")
    benchmark = record.get("modelBenchmark")
    gate = record.get("modelGate")
    if not isinstance(benchmark, list) or len(benchmark) < 2 or not isinstance(gate, dict):
        errors.append("model benchmark and gate are required")
    else:
        passing_models = [item for item in benchmark if _passes_model_gate(item, gate)]
        if not passing_models:
            errors.append("no model clears the gate")
        elif record.get("selectedModel") != min(passing_models, key=lambda item: item.get("costUnits", 999))["id"]:
            errors.append("selectedModel must be the least costly passing model")
    sources = record.get("officialSources")
    if not isinstance(sources, list) or len(sources) < 2 or not all(isinstance(source, str) and source.startswith("https://") for source in sources):
        errors.append("at least two HTTPS officialSources are required")
    matrix = record.get("deploymentMatrix")
    candidates = matrix.get("candidates") if isinstance(matrix, dict) else None
    candidate_ids = {
        candidate.get("id") for candidate in candidates or [] if isinstance(candidate, dict)
    }
    if not isinstance(candidates, list) or candidate_ids != DEPLOYMENT_PATHS or len(candidates) != 4:
        errors.append("deploymentMatrix must compare all four deployment paths")
    else:
        errors.extend(_validate_deployment_matrix(matrix, record.get("deploymentADR"), record.get("officialEvidence")))
    return errors


def recommend(record: dict[str, Any]) -> dict[str, str]:
    errors = validate_record(record)
    if errors:
        raise ValueError("; ".join(errors))
    return {
        "surface": record["selectedSurface"],
        "model": record["selectedModel"],
        "deployment": record["deploymentADR"]["selectedPath"],
        "owner": record["humanOwner"],
    }


def _passes_model_gate(candidate: Any, gate: dict[str, Any]) -> bool:
    return (
        isinstance(candidate, dict)
        and candidate.get("coverage", 0) >= gate.get("minimumCoverage", 1)
        and candidate.get("unsupportedClaims", 1) <= gate.get("maximumUnsupportedClaims", 0)
        and candidate.get("latencySeconds", float("inf")) <= gate.get("maximumLatencySeconds", 0)
    )


def _validate_deployment_matrix(matrix: dict[str, Any], adr: Any, evidence: Any) -> list[str]:
    errors: list[str] = []
    scenario = matrix.get("scenario")
    weights = matrix.get("weights")
    if not isinstance(scenario, dict) or not all(str(scenario.get(key, "")).strip() for key in {"workload"} | DEPLOYMENT_CRITERIA):
        errors.append("deployment scenario must state the workload and all decision criteria")
    if (
        not isinstance(weights, dict)
        or set(weights) != DEPLOYMENT_CRITERIA
        or not all(_valid_score(value) for value in weights.values())
    ):
        errors.append("deployment weights must score every criterion from 1 to 5")
        return errors

    scores: dict[str, int] = {}
    candidate_evidence: dict[str, set[str]] = {}
    for candidate in matrix["candidates"]:
        candidate_id = candidate["id"]
        ratings = candidate.get("ratings")
        if not isinstance(ratings, dict) or set(ratings) != DEPLOYMENT_CRITERIA:
            errors.append(f"{candidate_id} must rate every deployment criterion")
            continue
        if not all(
            isinstance(rating, dict)
            and _valid_score(rating.get("score"))
            and str(rating.get("reason", "")).strip()
            for rating in ratings.values()
        ):
            errors.append(f"{candidate_id} ratings need scores from 1 to 5 and reasons")
            continue
        expected = sum(weights[key] * ratings[key]["score"] for key in DEPLOYMENT_CRITERIA)
        if candidate.get("weightedScore") != expected:
            errors.append(f"{candidate_id} weightedScore must reconcile")
        scores[candidate_id] = expected
        evidence_ids = candidate.get("evidenceIds")
        if not isinstance(evidence_ids, list) or not evidence_ids or len(evidence_ids) != len(set(evidence_ids)):
            errors.append(f"{candidate_id} needs unique official evidence")
        else:
            candidate_evidence[candidate_id] = set(evidence_ids)

    selected = adr.get("selectedPath") if isinstance(adr, dict) else None
    if not scores or selected not in scores or scores[selected] != max(scores.values()):
        errors.append("deploymentADR selectedPath must have the highest weighted fit")
    if (
        not isinstance(adr, dict)
        or adr.get("status") != "accepted"
        or not str(adr.get("decision", "")).strip()
        or not _nonempty_strings(adr.get("rejectedAlternatives"))
        or not _nonempty_strings(adr.get("consequences"))
        or not _nonempty_strings(adr.get("reviewTriggers"))
    ):
        errors.append("deploymentADR needs an accepted decision, alternatives, consequences, and review triggers")

    evidence_by_id: dict[str, dict[str, Any]] = {}
    if not isinstance(evidence, list):
        errors.append("officialEvidence is required for deployment claims")
        return errors
    for item in evidence:
        if not isinstance(item, dict) or not str(item.get("id", "")).strip():
            errors.append("officialEvidence entries need ids")
            continue
        evidence_by_id[item["id"]] = item
        if (
            item.get("path") not in DEPLOYMENT_PATHS
            or not _iso_date(item.get("verifiedOn"))
            or not str(item.get("claim", "")).strip()
            or not _official_doc_url(item.get("sourceUrl"))
        ):
            errors.append(f
```

### Core Architecture Module: `certifications/claude/lessons/02-model-selection-and-token-economics/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/02-model-selection-and-token-economics/docs/en.md
It validates and summarizes a ten-case local model-routing benchmark.
It also validates repeated mode trials against dated support evidence and gates.
Rates are illustrative units, so no provider price or credential is required.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any


ALLOWED_RISKS = {"routine", "ambiguous", "conflicting-source", "consequential"}
SUPPORT_STATUSES = {"docs-supported", "docs-unsupported"}


def validate_benchmark(benchmark: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    candidates = benchmark.get("candidates")
    if not isinstance(candidates, list) or len(candidates) < 2 or len(candidates) != len(set(candidates)):
        errors.append("candidates must be a unique list with at least two models")
    cases = benchmark.get("cases")
    if not isinstance(cases, list) or len(cases) != 10:
        return errors + ["cases must contain exactly ten entries"]
    ids = [case.get("id") for case in cases if isinstance(case, dict)]
    if len(ids) != 10 or len(ids) != len(set(ids)):
        errors.append("case ids must be unique")
    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            errors.append(f"cases[{index}] must be an object")
            continue
        if case.get("riskClass") not in ALLOWED_RISKS:
            errors.append(f"cases[{index}] has an invalid riskClass")
        if case.get("chosenModel") not in (candidates or []):
            errors.append(f"cases[{index}] chooses an unknown model")
        if case.get("gatePassed") is not True:
            errors.append(f"cases[{index}] must pass the declared gate")
        if not isinstance(case.get("estimatedCostUnits"), (int, float)) or isinstance(case.get("estimatedCostUnits"), bool) or case["estimatedCostUnits"] <= 0:
            errors.append(f"cases[{index}] needs positive estimatedCostUnits")
        if not str(case.get("routingSignal", "")).strip():
            errors.append(f"cases[{index}] needs an observable routingSignal")
        if case.get("riskClass") == "consequential" and case.get("humanReview") is not True:
            errors.append(f"cases[{index}] consequential work must have humanReview")
    comparison = benchmark.get("routingComparison")
    routed = sum(case.get("estimatedCostUnits", 0) for case in cases if isinstance(case, dict))
    if not isinstance(comparison, dict) or comparison.get("routedCostUnits") != routed:
        errors.append("routedCostUnits must equal the case total")
    elif comparison.get("allCapableCostUnits", 0) <= routed:
        errors.append("allCapableCostUnits must exceed routedCostUnits")
    if not isinstance(comparison, dict) or not str(comparison.get("uncertainFallback", "")).strip():
        errors.append("uncertainFallback is required")
    return errors


def summarize(benchmark: dict[str, Any]) -> dict[str, Any]:
    errors = validate_benchmark(benchmark)
    if errors:
        raise ValueError("; ".join(errors))
    lanes = Counter(case["chosenModel"] for case in benchmark["cases"])
    comparison = benchmark["routingComparison"]
    return {
        "caseCount": len(benchmark["cases"]),
        "lanes": dict(sorted(lanes.items())),
        "costSavedUnits": comparison["allCapableCostUnits"] - comparison["routedCostUnits"],
        "humanReviewCases": sum(case["humanReview"] for case in benchmark["cases"]),
    }


def validate_mode_trials(experiment: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if experiment.get("measurementStatus") != "illustrative-not-live-provider-runs":
        errors.append("mode trials must identify illustrative measurements")
    if not str(experiment.get("settingSemantics", "")).strip():
        errors.append("mode trials must explain normalized setting labels")
    verified_on = experiment.get("verifiedOn")
    if not _iso_date(verified_on):
        errors.append("mode trials verifiedOn must be an ISO date")
    gate = experiment.get("gate")
    if not _valid_gate(gate):
        return errors + ["mode-trial gate is incomplete or invalid"]

    policy = experiment.get("verificationPolicy")
    sources = policy.get("sources") if isinstance(policy, dict) else None
    source_ids: set[str] = set()
    if (
        not isinstance(policy, dict)
        or policy.get("refreshBeforeExperiment") is not True
        or not str(policy.get("rule", "")).strip()
        or not isinstance(sources, list)
        or len(sources) < 4
    ):
        errors.append("current-doc verification policy and sources are required")
    else:
        for source in sources:
            if not isinstance(source, dict) or not str(source.get("id", "")).strip():
                errors.append("mode-trial sources need ids")
                continue
            source_ids.add(source["id"])
            if (
                source.get("verifiedOn") != verified_on
                or not str(source.get("claim", "")).strip()
                or not str(source.get("sourceUrl", "")).startswith("https://platform.claude.com/docs/")
            ):
                errors.append(f"source {source['id']} must be current, claimed, and official")
        if len(source_ids) != len(sources):
            errors.append("mode-trial source ids must be unique")

    configurations = experiment.get("configurations")
    if not isinstance(configurations, list) or len(configurations) < 3:
        return errors + ["at least three mode configurations are required"]
    configuration_ids = [item.get("id") for item in configurations if isinstance(item, dict)]
    if len(configuration_ids) != len(configurations) or len(configuration_ids) != len(set(configuration_ids)):
        errors.append("mode configuration ids must be unique")

    passing: list[dict[str, Any]] = []
    supported_count = 0
    unsupported_count = 0
    speeds: set[str] = set()
    efforts: set[str] = set()
    thinking_modes: set[str] = set()
    for index, configuration in enumerate(configurations):
        if not isinstance(configuration, dict):
            errors.append(f"configurations[{index}] must be an object")
            continue
        configuration_id = str(configuration.get("id", f"configurations[{index}]"))
        settings = configuration.get("settings")
        if (
            not isinstance(settings, dict)
            or set(settings) != {"speed", "effort", "thinking"}
            or not all(isinstance(value, str) and value.strip() for value in settings.values())
        ):
            errors.append(f"{configuration_id} must choose speed, effort, and thinking")
            continue
        speeds.add(settings["speed"])
        efforts.add(settings["effort"])
        thinking_modes.add(settings["thinking"])
        if not str(configuration.get("modelId", "")).strip() or not str(configuration.get("platform", "")).strip():
            errors.append(f"{configuration_id} needs a modelId and platform")

        support = configuration.get("support")
        support_status = support.get("status") if isinstance(support, dict) else None
        support_sources = support.get("sourceIds") if isinstance(support, dict) else None
        if (
            support_status not in SUPPORT_STATUSES
            or support.get("verifiedOn") != verified_on
            or not isinstance(support_sources, list)
            or not support_sources
            or any(source_id not in source_ids for source_id in support_sources)
        ):
            errors.append(f"{configuration_id} needs current official support evidence")
            continue

        runs = configuration.get("runs")
        if support_status == "docs-unsupported":
            unsupported_count += 1
            if runs != [] or not str(configuration.get("rejectionReason", "")).strip():
                errors.append(f"{configuration_id} unsup
```

### Core Architecture Module: `certifications/claude/lessons/03-prompting-and-task-decomposition/code/main.py`
```
"""Companion code for:
certifications/claude/lessons/03-prompting-and-task-decomposition/docs/en.md
It validates a prompt contract, stage gates, and adversarial case coverage.
The runner evaluates structure and evidence boundaries without a provider call.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


CONTRACT_FIELDS = {"outcome", "context", "task", "evidence", "constraints", "format", "acceptanceChecks"}
CASE_TYPES = {"normal", "missing-source", "conflict", "injection", "unauthorized"}


def validate_packet(packet: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    contract = packet.get("contract")
    if not isinstance(contract, dict) or CONTRACT_FIELDS - set(contract):
        errors.append("contract must contain all seven prompt-contract fields")
    else:
        for field in CONTRACT_FIELDS - {"acceptanceChecks"}:
            if not isinstance(contract.get(field), str) or len(contract[field].strip()) < 12:
                errors.append(f"contract.{field} must be concrete")
        checks = contract.get("acceptanceChecks")
        if not isinstance(checks, list) or len(checks) < 4 or not all(isinstance(item, str) and len(item.strip()) >= 12 for item in checks):
            errors.append("acceptanceChecks need at least four observable checks")
    hierarchy = packet.get("sourceHierarchy")
    if not isinstance(hierarchy, list) or len(hierarchy) < 2:
        errors.append("sourceHierarchy needs at least two sources")
    else:
        ranks = [item.get("rank") for item in hierarchy if isinstance(item, dict)]
        if ranks != list(range(1, len(hierarchy) + 1)):
            errors.append("sourceHierarchy ranks must be consecutive")
    stages = packet.get("stages")
    if not isinstance(stages, list) or len(stages) < 3:
        errors.append("at least three stages are required")
    else:
        for index, stage in enumerate(stages):
            if not isinstance(stage, dict) or any(not str(stage.get(field, "")).strip() for field in ("id", "input", "output", "gate")):
                errors.append(f"stages[{index}] needs id, input, output, and gate")
    if not isinstance(packet.get("uncertaintyBehavior"), str) or "not" not in packet["uncertaintyBehavior"].lower():
        errors.append("uncertaintyBehavior must define explicit abstention")
    cases = packet.get("evaluationCases")
    if not isinstance(cases, list):
        errors.append("evaluationCases must be a list")
    else:
        observed = {item.get("type") for item in cases if isinstance(item, dict)}
        if observed != CASE_TYPES:
            errors.append("evaluationCases must cover normal, missing-source, conflict, injection, and unauthorized")
        if any(not str(item.get("expected", "")).strip() for item in cases if isinstance(item, dict)):
            errors.append("every evaluation case needs an expected behavior")
    return errors


def score_packet(packet: dict[str, Any]) -> dict[str, Any]:
    errors = validate_packet(packet)
    return {
        "passed": not errors,
        "errors": errors,
        "contractFields": len(set(packet.get("contract", {})) & CONTRACT_FIELDS) if isinstance(packet.get("contract"), dict) else 0,
        "caseCoverage": sorted({case.get("type") for case in packet.get("evaluationCases", []) if isinstance(case, dict)}),
        "stageCount": len(packet.get("stages", [])) if isinstance(packet.get("stages"), list) else 0,
    }


def load_packet(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("packet root must be an object")
    return value


if __name__ == "__main__":
    path = Path(__file__).parents[1] / "outputs" / "prompt-contract-packet.json"
    print(json.dumps(score_packet(load_packet(path)), indent=2))

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #479** (2026-09-28): **Add a "Complete Lesson" button at the end of every lesson**
  *Symptoms*: ## Problem  Learners need a clear and consistent way to mark a lesson as completed after finishing its content.  Currently, progress tracking is visible on the website, but completing a lesson should be an explicit action available at the end of each lesson.  ## Proposed solution  Add a **"Complete Lesson"** button at the bottom of every lesson page.  When the learner clicks the button:  - Mark the current lesson as completed. - Persist the completion state locally. - Update the completed-lessons counter and progress bar. - Change the button state to something like **"Completed ✓"**. - Prevent duplicate completion actions if the lesson is already marked as completed.  ## Suggested UX  - Place the button after the final lesson section, quiz, exercise, or artifact. - Use a visually clear primary button style. - Show a short confirmation message after completion. - Allow learners to unmark a lesson later if needed.  ## Acceptance criteria  - Every lesson has a completion button at its end. - Clicking the button updates the lesson completion state. - Progress counters update immediately without requiring a page refresh. - Completion state remains available after reloading the website. - Completed lessons have a clear visual state. - The feature works on both desktop and mobile layouts.  ## Why this matters  A visible completion action gives learners a stronger sense of progress and makes it easier to follow the curriculum in sequence. 

- **Issue #476** (2026-09-24): **[bug] Error in the Dockerfile for the lesson `phases/00-setup-and-tooling/07-docker-for-ai` when running `docker build`**
  *Symptoms*: ## Where  phases/00-setup-and-tooling/07-docker-for-ai  ## What's wrong  Error running : docker build -t ai-dev -f phases/00-setup-and-tooling/07-docker-for-ai/code/Dockerfile .  ## Reproduce Done as described in the lesson.  ## Environment  - OS: MacBook Pro M2 Max  ## Screenshot or logs  Log:  [+] Building 113.1s (10/12)                                             docker:desktop-linux  => [internal] load build definition from Dockerfile                                    0.0s  => => transferring dockerfile: 1.50kB                                                  0.0s  => [internal] load metadata for docker.io/nvidia/cuda:12.4.1-devel-ubuntu22.04         1.8s  => [auth] nvidia/cuda:pull token for registry-1.docker.io                              0.0s  => [internal] load .dockerignore                                                       0.0s  => => transferring context: 2B                                                         0.0s  => [1/8] FROM docker.io/nvidia/cuda:12.4.1-devel-ubuntu22.04@sha256:da6791294b0b04d7  47.1s  => => resolve docker.io/nvidia/cuda:12.4.1-devel-ubuntu22.04@sha256:da6791294b0b04d7e  0.0s  => => sha256:59588f87dd82424f152239a2a3e72bb32880fceabd3c1f30c82721 88.23kB / 88.23kB  0.1s  => => sha256:8a791a9b45017619d9c8b0bac087727fe19db13c49d1782fa25f38b 2.17GB / 2.17GB  31.9s  => => sha256:4c60b5e7307e86fa82203b0c227d8001dce1fc4804fd49bbb2d42f6a 1.52kB / 1.52kB  0.4s  => => sha256:e37bdbfc55edc529a8d47b715f30651f78a56c0b59122e238b2eba69 1.68kB / 1.68kB 
  **Post-Mortem & Fix Analysis**:
  > Fixed in #477 and live. The Dockerfile now pins FROM --platform=linux/amd64: the CUDA base image has an arm64 variant that Docker Desktop picks on Apple Silicon, but the cu124 wheel index only ships x86_64 builds, so the torch layer failed. The lesson explains the emulation tradeoff and points Mac users at the native MPS path. Thanks for including the full log.

- **Issue #473** (2026-09-24): **[bug] Unzip not installed, causing issue to install nodejs**
  *Symptoms*: ## Where  - Phase / lesson: <-- Phase 1 · Step 3: Node.js with pnpm --> - File / URL: [<!-- [e.g. phases/04-computer-vision/06-object-detection-yolo/code/main.py or aiengineeringfromscratch.com/lesson.html?path=... --](https://aiengineeringfromscratch.com/lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment&learningPath=software-engineering-fundamentals#step-2-python-with-uv) -->](https://aiengineeringfromscratch.com/lesson?path=phases%2F00-setup-and-tooling%2F01-dev-environment&learningPath=software-engineering-fundamentals#step-2-python-with-uv)  ## What's wrong  Unable to install Node.js with pnpm, because the unzip was not installed   ## Reproduce 1. 2. 3.  ## Environment  - OS: Windows - Python / Node / other runtime version: Node.js - How you ran it (local, Colab, Docker, etc.): sudo apt install unzip -y (first run this)  ## Screenshot or logs  <img width="1210" height="557" alt="Image" src="https://github.com/user-attachments/assets/c7788121-5f40-4202-a364-969d60f92765" /> 
  **Post-Mortem & Fix Analysis**:
  > Looks like the issue is with the missing unzip utility blocking Node.js installation. I'd check if the unzip package is installed and properly configured in the environment setup. 
  > Fixed in #477 and live. unzip is now on the Step 1 apt line and Step 3 explains why the fnm installer stops without it. Thanks for the report.

- **Issue #440** (2026-08-30): **[bug] Hash and justify alignment issue**
  *Symptoms*: ## Where  - Phase / lesson: <!-- e.g. Phase 4 · 06-object-detection-yolo --> - File / URL: <!-- e.g. phases/04-computer-vision/06-object-detection-yolo/code/main.py or aiengineeringfromscratch.com/lesson.html?path=... -->  ## What's wrong  many sentence take break in middle of words with hash like in the picture instructions become in then we move on to the next line ,replaces become re this issue is across every text block and annoyingly obsturcts reading and understanding no normal course text even this github text box have this issue if you could try to fix it for course as well .  <img width="1280" height="800" alt="Image" src="https://github.com/user-attachments/assets/abd4e3f5-d576-47d9-95cf-5f6828589ad0" />  <img width="1280" height="800" alt="Image" src="https://github.com/user-attachments/assets/e578fe8a-3030-4220-9ed0-33364e34046d" />  ## Reproduce  1. 2. 3.  ## Environment  - OS: - Python / Node / other runtime version: - How you ran it (local, Colab, Docker, etc.):  ## Screenshot or logs  <!-- Drop a screenshot or paste the traceback if you have one. --> 

- **Issue #433** (2026-09-24): **[bug]**
  *Symptoms*: ## Where  - Phase / lesson: <!-- e.g. Phase 4 · 06-object-detection-yolo --> - File / URL: https://aiengineeringfromscratch.com/lesson.html?path=phases/02-ml-fundamentals/15-time-series  ## What's wrong  the colours of text font is not readable in dark mode of figures with highlighted backgrounds  <img width="726" height="632" alt="Image" src="https://github.com/user-attachments/assets/10cfdca3-57e9-4baa-8488-fdea0b319d5f" />  ## Environment  - OS: - Python / Node / other runtime version: - How you ran it (local, Colab, Docker, etc.):   
  **Post-Mortem & Fix Analysis**:
  > I'll fix it @rohitg00 
  > Fixed in #477 and live. The dark-mode fill remap only matched 6-digit hex, so diagrams using shorthand like fill:#dfd kept a pastel fill under light text. Shorthand is now expanded and remapped; the time-series diagrams render with dark fills in dark mode. Thanks for the screenshot.

- **Issue #407** (2026-08-23): **[bug]**
  *Symptoms*: ## Where  - Phase / lesson: all of them - File / URL: https://aiengineeringfromscratch.com/lesson.html?path=phases/02-ml-fundamentals/03-logistic-regression  ## What's wrong: i can not hear the audio from the website  When I click on the audio button to hear what is written, there is no sound.  

- **Issue #406** (2026-08-10): **[bug]**
  *Symptoms*: ## Where  - Phase / lesson: <!-- e.g. Phase 4 · 06-object-detection-yolo --> - File / URL: <!-- e.g. phases/04-computer-vision/06-object-detection-yolo/code/main.py or aiengineeringfromscratch.com/lesson.html?path=... -->  ## What's wrong  <!-- One-paragraph description. What did you expect vs. what you saw. -->  ## Reproduce  1. 2. 3.  ## Environment  - OS: - Python / Node / other runtime version: - How you ran it (local, Colab, Docker, etc.):  ## Screenshot or logs  <!-- Drop a screenshot or paste the traceback if you have one. --> 
  **Post-Mortem & Fix Analysis**:
  > sorry, I misclick the create button, I will close it.

- **Issue #405** (2026-08-23): **Cache-friendly layout is wrong in phase-11 15.prompt caching**
  *Symptoms*: ## Where  - Phase / lesson: Phase 11 · 15-llm-engineering - File / URL: https://aiengineeringfromscratch.com/lesson.html?path=phases/11-llm-engineering/15-prompt-caching#the-cache-friendly-layout ## What's wrong  There is last line in concept section which means caching is strictly prefix only if even one prefix token different then after the violate token everything not gone cache ``` The invariant. All three cache prefixes only. If any token differs between requests, everything after the first differing token is a miss. Put the stable parts at the top, the variable parts at the bottom. ```  So section: The cache friendly layout  why we have retrieved documents above from conversation history, if we get different documents from retrieval then conversation history also not gone cache! which must be cache ``` [retrieved documents]    <-- cache if reused, else don't [conversation history]   <-- cache up to last turn ```  ## Screenshot or logs  <img width="1917" height="871" alt="Image" src="https://github.com/user-attachments/assets/ad1f6242-a3c8-4b97-a5d5-2b1ab9a14737" /> 
  **Post-Mortem & Fix Analysis**:
  > @rohitg00 can you check this? this is quick fix!

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

### Incident Patch 1: `29c480a6` (2026-09-29)
**Commit Message**: fix(site): refresh cached assets and align project commands (#513)

* fix(site): revalidate pages and version deployed assets

* fix(projects): align setup cards and add copy feedback

* fix(site): keep desktop navigation compact and controls usable

**File**: `.github/workflows/curriculum.yml` (modified, +4/-0)
```diff
@@ -120,6 +120,10 @@ jobs:
         run: python3 scripts/test_skill_artifact_bundles.py
       - name: skill artifact bundles render as one lesson output
         run: node --test site/test_build_artifacts.js
+      - name: returning visitors receive updated site assets
+        run: node --test site/test_asset_cache.js
+      - name: command copying preserves keyboard focus
+        run: node --test site/test_project_copy.js
       - name: build the static site
         run: node site/build.js
       - name: dynamic lesson and certification routes preserve their public contracts
```

**File**: `api/certification.js` (modified, +2/-2)
```diff
@@ -211,7 +211,7 @@ function send(res, method, status, body, cacheControl) {
 
 function sendRedirect(res, method, trackId) {
   res.setHeader('Location', `/certification?id=${encodeURIComponent(trackId)}`);
-  send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+  send(res, method, 308, '', 'public, max-age=0, s-maxage=86400, must-revalidate');
 }
 
 function createHandler(options) {
@@ -251,7 +251,7 @@ function createHandler(options) {
       }
       let html = replaceMarkedRegion(template, SEO_START, SEO_END, certificationHead(entry, trackId));
       html = replaceMarkedRegion(html, FALLBACK_START, FALLBACK_END, certificationFallback(entry, trackId));
-      send(res, method, 200, html, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+      send(res, method, 200, html, 'public, max-age=0, s-maxage=86400, must-revalidate');
     } catch (_) {
       send(res, method, 500, errorPage('Certification page unavailable', 'The certification page could not be assembled. Continue from the certification index while this page is restored.'), 'no-store');
     }
```

**File**: `api/lesson.js` (modified, +3/-3)
```diff
@@ -355,7 +355,7 @@ function normalizedLessonLocation(req, lessonPath, entry, assets) {
 
 function sendRedirect(res, method, location) {
   res.setHeader('Location', location);
-  send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+  send(res, method, 308, '', 'public, max-age=0, s-maxage=86400, must-revalidate');
 }
 
 function createHandler(options) {
@@ -391,7 +391,7 @@ function createHandler(options) {
       const normalized = normalizedLessonLocation(req, lessonPath, entry, assets);
       if (normalized.needsRedirect) {
         res.setHeader('Location', normalized.location);
-        send(res, method, 308, '', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+        send(res, method, 308, '', 'public, max-age=0, s-maxage=86400, must-revalidate');
         return;
       }
       const contextParams = {};
@@ -401,7 +401,7 @@ function createHandler(options) {
       const heading = lessonHeading(entry, manifest);
       let html = replaceMarkedRegion(template, SEO_START, SEO_END, lessonHead(entry, lessonPath, heading));
       html = replaceMarkedRegion(html, FALLBACK_START, FALLBACK_END, lessonFallback(entry, lessonPath, contextParams, heading));
-      send(res, method, 200, html, 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+      send(res, method, 200, html, 'public, max-age=0, s-maxage=86400, must-revalidate');
     } catch (_) {
       send(res, method, 500, errorPage('Lesson page unavailable', 'The lesson page could not be assembled. Continue from the course catalog while this page is restored.'), 'no-store');
     }
```

**File**: `api/markdown.js` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ module.exports = (req, res) => {
   const markdownQ = qualityFor(accepted, 'text/markdown');
   const htmlQ = qualityFor(accepted, 'text/html');
   res.setHeader('Vary', 'Accept, Accept-Encoding');
-  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800');
+  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, must-revalidate');
   res.setHeader('X-API-Version', '1');
 
   if (method !== 'GET' && method !== 'HEAD') {
```

**File**: `site/header.js` (modified, +5/-31)
```diff
@@ -8,7 +8,6 @@
   var REPO = 'rohitg00/ai-engineering-from-scratch';
   var CACHE_KEY = 'gh:stars:' + REPO;
   var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
-  var COMPACT_HEADER_QUERY = '(max-width: 1400px)';
   var NARROW_HEADER_QUERY = '(max-width: 820px)';
   var NARRATION_VERSION = '20260829a';
   var UI_I18N_VERSION = '20260923a';
@@ -306,17 +305,10 @@
     tools.setAttribute('aria-label', 'Site tools');
     nav.appendChild(tools);
 
-    var toolAnchor = document.createComment('header-tools');
     var directChildren = Array.prototype.slice.call(inner.children);
     var search = directChildren.find(function (child) {
       return child.classList && child.classList.contains('search-toggle');
     });
-    var firstTool = directChildren.find(function (child) {
-      return child !== logo && child !== nav && child !== toggle && child !== priorityNav && child !== github && child !== search;
-    });
-    inner.insertBefore(toolAnchor, search ? search.nextSibling : (firstTool || null));
-
-    var compact = window.matchMedia ? window.matchMedia(COMPACT_HEADER_QUERY) : null;
     var narrow = window.matchMedia ? window.matchMedia(NARROW_HEADER_QUERY) : null;
     var open = false;
 
@@ -340,10 +332,6 @@
       });
     }
 
-    function restoreDesktopTools() {
-      while (tools.firstChild) inner.insertBefore(tools.firstChild, toolAnchor);
-    }
-
     function movePriorityLinksOut() {
       for (var i = 0; i < priorityEntries.length; i++) {
         priorityNav.appendChild(priorityEntries[i].link);
@@ -364,27 +352,18 @@
       header.classList.toggle('header-nav-open', open);
       toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
       toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
-      if (compact && compact.matches) nav.hidden = !open;
-      else nav.hidden = false;
+      nav.hidden = !open;
       if (restoreFocus && !open) toggle.focus();
     }
 
     function syncLayout() {
-      var isCompact = compact ? compact.matches : false;
       var isNarrow = narrow ? narrow.matches : false;
       var menuHadFocus = nav.contains(document.activeElement);
       var priorityHadFocus = priorityNav.contains(document.activeElement);
-      if (isCompact) {
-        if (isNarrow) restorePriorityLinks();
-        else movePriorityLinksOut();
-        moveToolsIntoMenu();
-        setOpen(false, menuHadFocus || (isNarrow && priorityHadFocus));
-      } else {
-        restorePriorityLinks();
-        setOpen(false, false);
-        restoreDesktopTools();
-        nav.hidden = false;
-      }
+      if (isNarrow) restorePriorityLinks();
+      else movePriorityLinksOut();
+      moveToolsIntoMenu();
+      setOpen(false, menuHadFocus || (isNarrow && priorityHadFocus));
     }
 
     toggle.addEventListener('click', function () { setOpen(!open, false); });
@@ -408,18 +387,13 @@
       }
     });
 
-    if (compact) {
-      if (typeof compact.addEventListener === 'function') compact.addEventListener('change', syncLayout);
-      else if (typeof compact.addListener === 'function') compact.addListener(syncLayout);
-    }
     if (narrow) {
       if (typeof narrow.addEventListener === 'function') narrow.addEventListener('change', syncLayout);
       else if (typeof narrow.addListener === 'function') narrow.addListener(syncLayout);
     }
 
     if (typeof MutationObserver === 'function') {
       var observer = new MutationObserver(function (mutations) {
-        if (!compact || !compact.matches) return;
         for (var i = 0; i < mutations.length; i++) {
           var added = mutations[i].addedNodes;
           for (var j = 0; j < added.length; j++) {
```

---

### Incident Patch 2: `d864ffe8` (2026-09-29)
**Commit Message**: fix: read readiness inputs as UTF-8 (#501)

**File**: `scripts/test_agent_readiness.py` (modified, +11/-11)
```diff
@@ -16,7 +16,7 @@
 def load_json_ld(path: Path) -> list[dict]:
     blocks = re.findall(
         r'<script\s+type="application/ld\+json"\s*>(.*?)</script>',
-        path.read_text(),
+        path.read_text(encoding="utf-8"),
         flags=re.IGNORECASE | re.DOTALL,
     )
     return [json.loads(block) for block in blocks]
@@ -63,7 +63,7 @@ def assert_legacy_redirect(paths: dict, route: str, parameter_name: str) -> None
 
 
 def main() -> None:
-    config = json.loads((ROOT / "vercel.json").read_text())
+    config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
     rewrites = config["rewrites"]
     markdown_rewrites = [r for r in rewrites if "has" in r and r["destination"] == "/llms.txt"]
     negotiator_rewrites = [r for r in rewrites if r.get("destination", "").startswith("/api/markdown")]
@@ -113,11 +113,11 @@ def main() -> None:
         assert (SITE / name).is_file(), f"missing {name}"
 
     for name in ("developer.html", "contact.html", "privacy.html"):
-        text = (SITE / name).read_text()
+        text = (SITE / name).read_text(encoding="utf-8")
         assert "AI Engineering from Scratch" in text
         assert len(" ".join(text.split())) > 500, f"{name} is too thin to be a trust page"
 
-    openapi = json.loads((SITE / "openapi.json").read_text())
+    openapi = json.loads((SITE / "openapi.json").read_text(encoding="utf-8"))
     assert openapi["openapi"].startswith("3.")
     assert "https://aiengineeringfromscratch.com" in openapi["servers"][0]["url"]
     paths = openapi["paths"]
@@ -146,7 +146,7 @@ def main() -> None:
     assert problem["properties"]["type"]["const"] == "about:blank"
     assert set(problem["required"]) == {"type", "title", "status", "code", "detail"}
     assert (ROOT / "api/v1/markdown.js").is_file()
-    assert "/api/v1/markdown" in (SITE / "developer.html").read_text()
+    assert "/api/v1/markdown" in (SITE / "developer.html").read_text(encoding="utf-8")
 
     def check_refs(value):
         if isinstance(value, dict):
@@ -165,7 +165,7 @@ def check_refs(value):
     redirect_response = openapi["components"]["responses"]["PermanentRedirect"]
     assert redirect_response["headers"]["Location"]["schema"]["type"] == "string"
 
-    lesson_manifest = json.loads((SITE / "lesson-seo.json").read_text())
+    lesson_manifest = json.loads((SITE / "lesson-seo.json").read_text(encoding="utf-8"))
     lessons = lesson_manifest["lessons"]
     assert len(lessons) >= 500, "lesson SEO manifest regressed to a generic shell"
     assert all(entry["path"] == lesson_path for lesson_path, entry in lessons.items())
@@ -177,7 +177,7 @@ def check_refs(value):
         for entry in lessons.values()
     )
 
-    certification_manifest = json.loads((SITE / "certification-seo.json").read_text())
+    certification_manifest = json.loads((SITE / "certification-seo.json").read_text(encoding="utf-8"))
     tracks = certification_manifest["tracks"]
     assert len(tracks) >= 4, "certification SEO manifest regressed to a generic shell"
     assert all(entry["id"] == track_id for track_id, entry in tracks.items())
@@ -189,7 +189,7 @@ def check_refs(value):
         for entry in tracks.values()
     )
 
-    sitemap = (SITE / "sitemap.xml").read_text()
+    sitemap = (SITE / "sitemap.xml").read_text(encoding="utf-8")
     assert sitemap.count("/lesson?path=") == len(lessons)
     sitemap_lessons = {
         unquote(value)
@@ -209,7 +209,7 @@ def check_refs(value):
         ),
     )
     for template_name, seo_marker, fallback_marker in templates_and_markers:
-        template = (SITE / template_name).read_text()
+        template = (SITE / template_name).read_text(encoding="utf-8")
         assert template.count(seo_marker) == 1
         assert template.count(fallback_marker) == 1
 
@@ -246,10 +246,10 @@ def check_refs(value):
     ):
         assert false_field not in identity_json
 
-    not_found = (SITE / "404.html").read_text()
+    not_found = (SITE / "404.html").read_text(encoding=
```

---

### Incident Patch 3: `a05d3925` (2026-09-27)
**Commit Message**: fix: repair broken lesson references and guard homepage storage (#495)

* fix(site): guard theme storage access on the homepage and about page

Reading or writing localStorage throws a SecurityError when storage is
blocked (strict privacy settings, some embedded webviews). site/app.js
read the saved theme outside any try/catch, before it registered its
DOMContentLoaded handler, so the throw stopped the whole homepage from
initializing. The about page's inline theme script had the same
unguarded read and write.

Wrap all four accesses the way the other pages already do and fall
back to the system theme. Bump the app.js cache key so browsers pick
up the fix, and give app.js its own release constant in the cache-key
test.

Fixes #490

* fix(lessons): repair dataset, model, and tool references that no longer resolve

Lesson snippets pointed at resources that are gone or never existed, so
they fail when a student runs them:

- wikimedia/wikipedia only ships 20231101.* configs; 20220301.en is gone
- MMAU-Pro lives at gamma-lab-umd/MMAU-Pro, with audio_path and answer
  fields; open-ended rows are filtered out of the exact-match score
- meta-llama/Llama-3-70B-Instruct is meta-llama/Meta-L

**File**: `phases/00-setup-and-tooling/09-data-management/docs/en.md` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ This downloads the IMDB movie review dataset. After the first download, it loads
 Some datasets are too large to fit on disk. Streaming loads them row by row without downloading the full thing.
 
 ```python
-dataset = load_dataset("wikimedia/wikipedia", "20220301.en", split="train", streaming=True)
+dataset = load_dataset("wikimedia/wikipedia", "20231101.en", split="train", streaming=True)
 
 for i, example in enumerate(dataset):
     print(example["title"])
```

**File**: `phases/01-math-foundations/07-bayes-theorem/docs/en.md` (modified, +1/-1)
```diff
@@ -469,6 +469,6 @@ Advantages over frequentist A/B testing:
 ## Further Reading
 
 - [3Blue1Brown: Bayes' theorem](https://www.youtube.com/watch?v=HZGCoVF3YvM) - visual explanation with the medical test example
-- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/notes2022fall/cs229-notes2.pdf) - naive Bayes and its connection to discriminative models
+- [Stanford CS229: Generative Learning Algorithms](https://cs229.stanford.edu/main_notes.pdf) - naive Bayes and its connection to discriminative models
 - [Think Bayes](https://greenteapress.com/wp/think-bayes/) - free book, Bayesian statistics with Python code
 - [scikit-learn Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html) - production implementations and when to use each variant
```

**File**: `phases/01-math-foundations/17-linear-systems/docs/en.md` (modified, +1/-1)
```diff
@@ -577,5 +577,5 @@ This lesson produces:
 
 - [MIT 18.06: Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) (Gilbert Strang) -- the definitive course on linear systems and matrix factorizations
 - [Numerical Linear Algebra](https://people.maths.ox.ac.uk/trefethen/text.html) (Trefethen & Bau) -- the standard reference for understanding numerical stability, conditioning, and why algorithms fail
-- [Matrix Computations](https://www.cs.cornell.edu/cv/GolubVanLoan4/golubandvanloan.htm) (Golub & Van Loan) -- the encyclopedic reference for every matrix algorithm
+- [Matrix Computations](https://www.press.jhu.edu/books/title/10678/matrix-computations) (Golub & Van Loan) -- the encyclopedic reference for every matrix algorithm
 - [3Blue1Brown: Inverse Matrices](https://www.3blue1brown.com/lessons/inverse-matrices) -- visual intuition for what solving Ax = b means geometrically
```

**File**: `phases/02-ml-fundamentals/11-ensemble-methods/docs/en.md` (modified, +1/-1)
```diff
@@ -349,7 +349,7 @@ This lesson produces `outputs/prompt-ensemble-selector.md` -- a prompt that help
 ## Further Reading
 
 - [Schapire & Freund: Boosting: Foundations and Algorithms](https://mitpress.mit.edu/9780262526036/) -- the book by AdaBoost's creators
-- [Friedman: Greedy Function Approximation: A Gradient Boosting Machine (2001)](https://statweb.stanford.edu/~jhf/ftp/trebst.pdf) -- the original gradient boosting paper
+- [Friedman: Greedy Function Approximation: A Gradient Boosting Machine (2001)](https://doi.org/10.1214/aos/1013203451) -- the original gradient boosting paper
 - [Chen & Guestrin: XGBoost (2016)](https://arxiv.org/abs/1603.02754) -- the XGBoost paper
 - [Wolpert: Stacked Generalization (1992)](https://www.sciencedirect.com/science/article/abs/pii/S0893608005800231) -- the original stacking paper
 - [scikit-learn Ensemble Methods](https://scikit-learn.org/stable/modules/ensemble.html) -- practical reference
```

**File**: `phases/04-computer-vision/01-image-fundamentals/docs/en.md` (modified, +1/-1)
```diff
@@ -440,7 +440,7 @@ This lesson produces:
 
 ## Further Reading
 
-- [Charles Poynton — A Guided Tour of Color Space](https://poynton.ca/PDFs/Guided_tour.pdf) — the clearest technical treatment of why there are so many color spaces and when each one matters
+- [Charles Poynton — A Guided Tour of Color Space](https://web.archive.org/web/20251220000525/https://poynton.ca/PDFs/Guided_tour.pdf) — the clearest technical treatment of why there are so many color spaces and when each one matters
 - [PyTorch Vision Transforms Docs](https://pytorch.org/vision/stable/transforms.html) — the full pipeline of transforms you will actually compose in production
 - [How JPEG Works (Colt McAnlis)](https://www.youtube.com/watch?v=F1kYBnY6mwg) — a sharp visual tour of chroma subsampling, DCT, and why JPEG encodes YCbCr rather than RGB
 - [ImageNet Preprocessing Conventions (torchvision models)](https://pytorch.org/vision/stable/models.html) — the source of truth for `mean=[0.485, 0.456, 0.406]` and why every model in the zoo expects it
```

---

### Incident Patch 4: `744520ac` (2026-09-27)
**Commit Message**: fix(site): refresh cached header for newsletter signup (#494)

**File**: `site/about.html` (modified, +1/-1)
```diff
@@ -205,7 +205,7 @@ <h2>Get involved</h2>
   </script>
   <script src="data.js?v=20260821c"></script>
   <script src="progress.js?v=20260822a"></script>
-  <script src="header.js?v=20260925a" defer></script>
+  <script src="header.js?v=20260927a" defer></script>
   <script src="cmdpalette.js?v=20260821a" defer></script>
   <script defer src="https://va.vercel-scripts.com/v1/script.js"></script>
 </body>
```

**File**: `site/assessment.html` (modified, +1/-1)
```diff
@@ -15,6 +15,6 @@
   <header class="site-header"><div class="header-inner"><a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a><nav class="header-nav"><a href="index.html#contents">Contents</a><a href="catalog.html">Catalog</a><a href="prereqs.html">Roadmap</a><a href="glossary.html">Glossary</a><a href="about.html">About</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github"><span>GitHub</span><span class="star-count" data-loading="true">…</span></a></nav><button class="search-toggle" type="button" data-cmd-palette aria-label="Search"><span aria-hidden="true">⌕</span></button><button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button></div></header>
   <main id="main" class="cert-page"><div class="cert-container" id="assessmentMount" aria-live="polite"><div class="cert-loading">Loading practice assessment...</div></div><aside class="cert-container cert-notice" id="assessmentProgramNotice"><strong>Independent practice</strong><p>This original practice is not affiliated with, endorsed by, sponsored by, or authorized by the certification provider. Results are course percentages, not official certification scores.</p></aside></main>
   <footer class="site-footer"><div class="container footer-inner"><p>Practice stays in your browser.</p><div class="footer-links"><a href="certifications.html">All certifications</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
-  <script src="build-meta.js?v=20260809a"></script><script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="content-source.js?v=20260808d"></script><script src="header.js?v=20260925a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925b" defer></script>
+  <script src="build-meta.js?v=20260809a"></script><script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="content-source.js?v=20260808d"></script><script src="header.js?v=20260927a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925b" defer></script>
 </body>
 </html>
```

**File**: `site/catalog.html` (modified, +1/-1)
```diff
@@ -931,7 +931,7 @@ <h1>Lesson Catalog</h1>
 
   <script src="data.js?v=20260821c"></script>
   <script src="progress.js?v=20260822a"></script>
-  <script src="header.js?v=20260925a" defer></script>
+  <script src="header.js?v=20260927a" defer></script>
   <script src="cmdpalette.js?v=20260821a" defer></script>
   <script>
     (function () {
```

**File**: `site/certification.html` (modified, +1/-1)
```diff
@@ -51,6 +51,6 @@
 
   <footer class="site-footer"><div class="container footer-inner"><p>AI Engineering from Scratch · open source · free forever.</p><div class="footer-links"><a href="certifications.html">All certifications</a><a href="catalog.html">Course catalog</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
 
-  <script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="header.js?v=20260925a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925b" defer></script>
+  <script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="header.js?v=20260927a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925b" defer></script>
 </body>
 </html>
```

**File**: `site/certifications.html` (modified, +1/-1)
```diff
@@ -220,7 +220,7 @@ <h2 id="methodTitle">Learn. Build. Decide under pressure.</h2>
   <script src="certification-data.js?v=20260925a"></script>
   <script src="progress.js?v=20260822a"></script>
   <script src="certification-progress.js?v=20260808c"></script>
-  <script src="header.js?v=20260925a" defer></script>
+  <script src="header.js?v=20260927a" defer></script>
   <script src="cmdpalette.js?v=20260821a" defer></script>
   <script src="certifications.js?v=20260925b" defer></script>
 </body>
```

---

### Incident Patch 5: `38ed3c95` (2026-09-25)
**Commit Message**: fix(site): show published exam facts on certification cards (#487)

Catalog cards show a track's first three exam facts: questions, time
limit, and passing score. The official MCPA page publishes only the
90-minute duration, so the MCPA card read "Not published" twice out of
three and looked broken. Cards now skip facts a track marks
unpublished and fill the row with the next published ones, so the
MCPA card shows its time limit, exam fee, and format. Claude cards are
unchanged, and the track page still lists every fact, including the
ones the provider does not publish.

**File**: `site/assessment.html` (modified, +1/-1)
```diff
@@ -15,6 +15,6 @@
   <header class="site-header"><div class="header-inner"><a href="index.html" class="logo"><span class="logo-icon" aria-hidden="true"></span> AI / FROM SCRATCH</a><nav class="header-nav"><a href="index.html#contents">Contents</a><a href="catalog.html">Catalog</a><a href="prereqs.html">Roadmap</a><a href="glossary.html">Glossary</a><a href="about.html">About</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener" class="header-github"><span>GitHub</span><span class="star-count" data-loading="true">…</span></a></nav><button class="search-toggle" type="button" data-cmd-palette aria-label="Search"><span aria-hidden="true">⌕</span></button><button class="theme-toggle" id="themeToggle" aria-label="Toggle theme" type="button"><span class="theme-icon" id="themeIcon">N</span></button></div></header>
   <main id="main" class="cert-page"><div class="cert-container" id="assessmentMount" aria-live="polite"><div class="cert-loading">Loading practice assessment...</div></div><aside class="cert-container cert-notice" id="assessmentProgramNotice"><strong>Independent practice</strong><p>This original practice is not affiliated with, endorsed by, sponsored by, or authorized by the certification provider. Results are course percentages, not official certification scores.</p></aside></main>
   <footer class="site-footer"><div class="container footer-inner"><p>Practice stays in your browser.</p><div class="footer-links"><a href="certifications.html">All certifications</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
-  <script src="build-meta.js?v=20260809a"></script><script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="content-source.js?v=20260808d"></script><script src="header.js?v=20260925a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925a" defer></script>
+  <script src="build-meta.js?v=20260809a"></script><script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="content-source.js?v=20260808d"></script><script src="header.js?v=20260925a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925b" defer></script>
 </body>
 </html>
```

**File**: `site/certification.html` (modified, +1/-1)
```diff
@@ -51,6 +51,6 @@
 
   <footer class="site-footer"><div class="container footer-inner"><p>AI Engineering from Scratch · open source · free forever.</p><div class="footer-links"><a href="certifications.html">All certifications</a><a href="catalog.html">Course catalog</a><a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener">GitHub</a><a href="sponsors.html">Sponsor us</a></div></div></footer>
 
-  <script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="header.js?v=20260925a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925a" defer></script>
+  <script src="data.js?v=20260821c"></script><script src="certification-data.js?v=20260925a"></script><script src="progress.js?v=20260822a"></script><script src="certification-progress.js?v=20260808c"></script><script src="header.js?v=20260925a" defer></script><script src="cmdpalette.js?v=20260821a" defer></script><script src="certifications.js?v=20260925b" defer></script>
 </body>
 </html>
```

**File**: `site/certifications.html` (modified, +1/-1)
```diff
@@ -222,6 +222,6 @@ <h2 id="methodTitle">Learn. Build. Decide under pressure.</h2>
   <script src="certification-progress.js?v=20260808c"></script>
   <script src="header.js?v=20260925a" defer></script>
   <script src="cmdpalette.js?v=20260821a" defer></script>
-  <script src="certifications.js?v=20260925a" defer></script>
+  <script src="certifications.js?v=20260925b" defer></script>
 </body>
 </html>
```

**File**: `site/certifications.js` (modified, +3/-3)
```diff
@@ -232,17 +232,17 @@
 
   function examFacts(track) {
     return [
-      { value: questions(track), label: 'Questions' },
+      { value: questions(track), label: 'Questions', unpublished: unpublished(track, 'itemCountPublished') },
       { value: String(minutes(track)).match(/^\d+$/) ? minutes(track) + ' min' : minutes(track), label: 'Time limit' },
-      { value: passing(track), label: 'Passing score' },
+      { value: passing(track), label: 'Passing score', unpublished: unpublished(track, 'passingScorePublished') },
       { value: price(track), label: 'Exam fee' },
       { value: examValue(track, ['format'], 'Closed book'), label: 'Format' },
       { value: examValue(track, ['validityMonths', 'validForMonths'], 'See provider'), label: 'Validity' },
     ];
   }
 
   function renderCardFacts(track, limit) {
-    return examFacts(track).slice(0, limit || 3).map(function (fact) {
+    return examFacts(track).filter(function (fact) { return !fact.unpublished; }).slice(0, limit || 3).map(function (fact) {
       var value = fact.value;
       if (fact.label === 'Validity' && typeof value === 'number') value += ' months';
       return '<div class="cert-card-fact"><strong>' + esc(value) + '</strong><span class="cert-fact-label">' + esc(fact.label) + '</span></div>';
```

---

### Incident Patch 6: `352b2eac` (2026-09-25)
**Commit Message**: fix(readme): rebuild the banner curriculum stack so every phase appears once (#486)

The banner's curriculum stack skipped Phase 11 (LLM Engineering), grouped
Generative AI and Multimodal under "LLMs · Transformers", drew
translucent layers whose edges showed through each other, and ran its
last label into the right edge past the 56px margin the header keeps.

The stack is now eight solid slabs with thickness, foundations at the
bottom and capstones on top, covering phases 00 to 19 exactly once and
in order: setup and math, ML and deep learning, vision, NLP, and
speech, transformers and generative AI, RL and LLMs, multimodal and
tools, agents and swarms, then production, safety, and capstones. Each
label sits on its slab's corner, and every label stays inside the
margin. The left column gains a certification line for the Claude and
MCPA preparation tracks, and the separators drop em and en dashes. The
count line is unchanged and still pinned by the build test.

**File**: `assets/banner.svg` (modified, +105/-61)
```diff
@@ -1,4 +1,4 @@
-<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="420" viewBox="0 0 1280 420" role="img" aria-label="AI Engineering from Scratch — reference manual banner">
+<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="420" viewBox="0 0 1280 420" role="img" aria-label="AI Engineering from Scratch: a reference manual in 20 phases, stacked from setup and math up to production, safety, and capstones">
   <defs>
     <pattern id="paper" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
       <circle cx="0" cy="0" r="1" fill="#1a1a1a" fill-opacity="0.08"/>
@@ -8,11 +8,9 @@
       <rect x="8" y="3" width="6" height="3" fill="#3553ff" fill-opacity="0.35"/>
     </pattern>
     <style>
-      .face { fill: rgba(53, 83, 255, 0.06); }
-      .face-strong { fill: rgba(53, 83, 255, 0.18); }
-      .stroke-bp { stroke: #3553ff; fill: none; stroke-linejoin: miter; stroke-linecap: square; }
-      .mono { font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace; }
-      .display { font-family: 'VT323', ui-monospace, monospace; font-weight: 400; }
+      .bp { stroke: #3553ff; fill: none; stroke-linejoin: round; stroke-linecap: round; }
+      .mono { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
+      .display { font-family: 'VT323', ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 400; }
       .serif { font-family: 'Source Serif 4', Georgia, serif; }
     </style>
   </defs>
@@ -21,12 +19,11 @@
   <rect width="1280" height="420" fill="url(#paper)"/>
 
   <g class="mono" font-size="11" letter-spacing="2.4" fill="#3553ff">
-    <text x="56" y="44">FIG_000  —  REFERENCE MANUAL  V1.0</text>
+    <text x="56" y="44">FIG_000  ·  REFERENCE MANUAL  V1.0</text>
   </g>
   <g class="mono" font-size="11" letter-spacing="2.4" fill="#7a7a78" text-anchor="end">
     <text x="1224" y="44">© 2026  ·  OPEN SOURCE  ·  MIT LICENSE</text>
   </g>
-
   <line x1="56" y1="64" x2="1224" y2="64" stroke="#3553ff" stroke-width="0.6" stroke-opacity="0.4"/>
 
   <g transform="translate(56, 110)">
@@ -40,71 +37,118 @@
   <g class="mono" font-size="11" letter-spacing="2.4" fill="#7a7a78">
     <text x="56" y="324">20 PHASES  ·  523 LESSONS  ·  396 SKILLS  ·  99 PROMPTS</text>
   </g>
+  <g class="mono" font-size="11" letter-spacing="2.4" fill="#3553ff">
+    <text x="56" y="350">CERTIFICATION PREP  ·  CLAUDE  ·  MCPA</text>
+  </g>
 
-  <line x1="780" y1="110" x2="780" y2="350" stroke="#3553ff" stroke-width="0.6" stroke-opacity="0.4" stroke-dasharray="3 3"/>
+  <line x1="780" y1="110" x2="780" y2="362" stroke="#3553ff" stroke-width="0.6" stroke-opacity="0.4" stroke-dasharray="3 3"/>
 
-  <g transform="translate(820, 130)">
-    <g class="mono" font-size="9" letter-spacing="2" fill="#3553ff">
-      <text x="0" y="-10">FIG_000.A  —  CURRICULUM STACK</text>
-    </g>
+  <g class="mono" font-size="9" letter-spacing="2" fill="#3553ff">
+    <text x="820" y="120">FIG_000.A  ·  CURRICULUM STACK</text>
+  </g>
 
-    <g transform="translate(8, 32)">
-      <polygon class="face" points="0,0 110,-26 200,-13 90,13"/>
-      <polygon class="stroke-bp" stroke-width="1.2" points="0,0 110,-26 200,-13 90,13"/>
+    <g>
+      <polygon points="834,330 924,310 1014,330 1014,338 924,358 834,338" fill="#fafaf5"/>
+      <polygon points="834,330 924,310 1014,330 924,350" fill="#3553ff" fill-opacity="0.05"/>
+      <polygon points="834,330 924,350 924,358 834,338" fill="#3553ff" fill-opacity="0.13"/>
+      <polygon points="924,350 1014,330 1014,338 924,358" fill="#3553ff" fill-opacity="0.19"/>
+      <polygon class="bp" points="834,330 924,310 1014,330 924,350" stroke-width="1.1"/>
+      <polyline class="bp" points="834,330 834,338 924,358 1014,338 1014,330" stroke-width="1.1"/>
+      <line class="bp" x1="924" y1="350" x2="924" y2="358" stroke-width="1.1"/>
     </g>
-    <g transform="translate(14, 60)">
-      <polygon class="face" points="0,0 110,-26 200,-13 90,13"/>
-      
```

---

### Incident Patch 7: `2341733d` (2026-09-25)
**Commit Message**: fix(readme): redraw the FIG_001 artifact icons so no label collides with geometry (#485)

The four "every lesson ships something" icons had collisions at README
size: the agent loop's arc ran through the TOOL box and its label, OBS
sat on its box edge with a detached arrowhead, the MCP labels hung
outside the rack at about 4px, and the skill icon ended in a stray plug
shape. The README also drew the 120-unit artwork at 96px, shrinking
every label by a fifth.

Each icon is redrawn on the same grid in the blueprint style: a
prompt page with a >_ line sent to the model, a SKILL.md file dropping
into an agent's skills tray, the agent loop as LLM to TOOL to OBS and
back, and an MCP server whose tools, resources, and prompts are labeled
inside its units with a two-way client link. Every label sits inside
its container with clearance, checked by bounding-box tests at 96, 120,
and 360px, and the README renders the icons at their native 120px.
The translated READMEs are regenerated.

**File**: `README.md` (modified, +4/-4)
```diff
@@ -381,10 +381,10 @@ Other curricula end with *"congratulations, you learned X."* Each lesson here en
 
 <table>
 <tr>
-<th align="left" width="25%"><img src="site/assets/figures/001-a-prompts.svg" width="96" height="96" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
-<th align="left" width="25%"><img src="site/assets/figures/001-b-skills.svg" width="96" height="96" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
-<th align="left" width="25%"><img src="site/assets/figures/001-c-agents.svg" width="96" height="96" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
-<th align="left" width="25%"><img src="site/assets/figures/001-d-mcp-servers.svg" width="96" height="96" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
+<th align="left" width="25%"><img src="site/assets/figures/001-a-prompts.svg" width="120" height="120" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
+<th align="left" width="25%"><img src="site/assets/figures/001-b-skills.svg" width="120" height="120" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
+<th align="left" width="25%"><img src="site/assets/figures/001-c-agents.svg" width="120" height="120" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
+<th align="left" width="25%"><img src="site/assets/figures/001-d-mcp-servers.svg" width="120" height="120" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
 </tr>
 <tr>
 <td valign="top">Paste into any AI assistant for expert-level help on a narrow task.</td>
```

**File**: `i18n/ar/README.md` (modified, +4/-4)
```diff
@@ -380,10 +380,10 @@ Other curricula end with *"congratulations, you learned X."* Each lesson here en
 
 <table>
 <tr>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="96" height="96" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="96" height="96" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="96" height="96" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="96" height="96" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="120" height="120" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="120" height="120" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="120" height="120" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="120" height="120" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
 </tr>
 <tr>
 <td valign="top">Paste into any AI assistant for expert-level help on a narrow task.</td>
```

**File**: `i18n/de/README.md` (modified, +4/-4)
```diff
@@ -380,10 +380,10 @@ Other curricula end with *"congratulations, you learned X."* Each lesson here en
 
 <table>
 <tr>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="96" height="96" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="96" height="96" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="96" height="96" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="96" height="96" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="120" height="120" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="120" height="120" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="120" height="120" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="120" height="120" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
 </tr>
 <tr>
 <td valign="top">Paste into any AI assistant for expert-level help on a narrow task.</td>
```

**File**: `i18n/es/README.md` (modified, +4/-4)
```diff
@@ -380,10 +380,10 @@ Other curricula end with *"congratulations, you learned X."* Each lesson here en
 
 <table>
 <tr>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="96" height="96" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="96" height="96" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="96" height="96" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="96" height="96" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="120" height="120" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="120" height="120" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="120" height="120" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="120" height="120" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
 </tr>
 <tr>
 <td valign="top">Paste into any AI assistant for expert-level help on a narrow task.</td>
```

**File**: `i18n/fr/README.md` (modified, +4/-4)
```diff
@@ -380,10 +380,10 @@ Other curricula end with *"congratulations, you learned X."* Each lesson here en
 
 <table>
 <tr>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="96" height="96" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="96" height="96" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="96" height="96" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
-<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="96" height="96" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-a-prompts.svg" width="120" height="120" alt="FIG_001.A prompts"/><br/><sub>FIG_001 · A</sub><br/><b>PROMPTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-b-skills.svg" width="120" height="120" alt="FIG_001.B skills"/><br/><sub>FIG_001 · B</sub><br/><b>SKILLS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-c-agents.svg" width="120" height="120" alt="FIG_001.C agents"/><br/><sub>FIG_001 · C</sub><br/><b>AGENTS</b></th>
+<th align="left" width="25%"><img src="../../site/assets/figures/001-d-mcp-servers.svg" width="120" height="120" alt="FIG_001.D MCP servers"/><br/><sub>FIG_001 · D</sub><br/><b>MCP SERVERS</b></th>
 </tr>
 <tr>
 <td valign="top">Paste into any AI assistant for expert-level help on a narrow task.</td>
```

---

### Incident Patch 8: `8050434e` (2026-09-24)
**Commit Message**: fix: repair lessons, harden security, and gate lesson tests and quiz bias (#480)

* fix(phase-13/06): bootstrap sys.path so the documented test command runs

The lesson doc says to run unittest discovery over code/tests, but the test
imported main with no path setup, so discovery from the lesson root failed
with ImportError. Insert the code directory on sys.path the way the later
protocol lessons already do. Passes from the lesson root and from code/.

* fix(phase-13/07): bootstrap sys.path so the documented test command runs

Discovery over code/tests failed with ImportError because the test imported
main with no path setup. Insert the code directory on sys.path to match the
later protocol lessons.

* fix(phase-13/08): bootstrap sys.path so the documented test command runs

The documented discovery command raised ImportError on import main. Add the
sys.path bootstrap used by the sibling lessons so the test runs from the
lesson root and from code/.

* fix(phase-13/09): bootstrap sys.path so the documented test command runs

The documented discovery command raised ImportError on import main. Add the
sys.path bootstrap used by the sibling lessons so the test runs from the
lesson root

**File**: `.github/workflows/curriculum.yml` (modified, +23/-0)
```diff
@@ -9,10 +9,12 @@ on:
       - "skills/**"
       - ".claude/skills/**"
       - "scripts/audit_lessons.py"
+      - "scripts/run_lesson_tests.py"
       - "scripts/audit_certifications.py"
       - "scripts/backfill_certification_references.py"
       - "scripts/debias_certification_questions.py"
       - "scripts/debias_quizzes.py"
+      - "scripts/check_quiz_bias.py"
       - "scripts/build_readme_i18n.py"
       - "scripts/readme_translations.py"
       - "scripts/build_catalog.py"
@@ -48,10 +50,12 @@ on:
       - "skills/**"
       - ".claude/skills/**"
       - "scripts/audit_lessons.py"
+      - "scripts/run_lesson_tests.py"
       - "scripts/audit_certifications.py"
       - "scripts/backfill_certification_references.py"
       - "scripts/debias_certification_questions.py"
       - "scripts/debias_quizzes.py"
+      - "scripts/check_quiz_bias.py"
       - "scripts/build_readme_i18n.py"
       - "scripts/readme_translations.py"
       - "scripts/build_catalog.py"
@@ -126,6 +130,8 @@ jobs:
         run: node --test site/test_ui_i18n.js
       - name: quiz answer positions are de-biased
         run: python3 scripts/debias_quizzes.py --check
+      - name: quiz answer lengths do not give away the answer
+        run: python3 scripts/check_quiz_bias.py --check
       - name: certification answer positions are de-biased
         run: python3 scripts/debias_certification_questions.py --check
       - name: README translations are in sync with English
@@ -140,6 +146,23 @@ jobs:
         # repo auto-loads them in Claude Code. They must never diverge.
         run: diff -r skills .claude/skills
 
+  lesson-tests:
+    name: lesson tests (stdlib)
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4
+        with:
+          persist-credentials: false
+      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065  # v5
+        with:
+          python-version: "3.12"
+      - name: run each lesson's own tests
+        # No scientific dependencies are installed here, so lessons that need
+        # one (torch, numpy, and the rest of the allowlist in the script) are
+        # skipped, not failed. The stdlib lessons run for real, which catches
+        # the class of breakage where a lesson cannot import its own module.
+        run: python3 scripts/run_lesson_tests.py
+
   readme-counts-sync:
     name: README counts auto-fix (main only)
     runs-on: ubuntu-latest
```

**File**: `AGENTS.md` (modified, +2/-0)
```diff
@@ -104,6 +104,8 @@ The `**Languages:**` field must match the languages with a `main.*` file in `cod
 
 Exactly 6 questions: 1 pre + 3 check + 2 post. `correct` is zero-indexed. The site renderer only understands this shape — legacy `q/choices/answer` schemas crash silently.
 
+Keep the distractors comparable in length to the correct option. When the correct answer is the longest by a wide margin, a reader can guess it without knowing the material. `scripts/check_quiz_bias.py --check` gates this, and `scripts/debias_quizzes.py` spreads the correct option across positions.
+
 ### Claude certification contract
 
 Certification lessons under `certifications/claude/lessons/` follow the same
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ names, logos, links, and tier assignments are managed by the maintainer. See
 1. Fork the repository
 2. Create a feature branch (`git checkout -b add-lesson-phase3-gradient-descent`)
 3. Make your changes
-4. Ensure all code runs
+4. Ensure all code runs. Run `python3 scripts/run_lesson_tests.py` to execute every lesson's own tests; lessons whose tests need a scientific dependency you have not installed are skipped, the rest run.
 5. Submit a pull request with a clear description
 
 ## Code of Conduct
```

**File**: `phases/11-llm-engineering/09-function-calling/code/function_calling.py` (modified, +17/-5)
```diff
@@ -1,3 +1,7 @@
+"""Function calling from scratch: a tool registry, the model-to-tool dispatch
+loop, and guarded tool implementations. See docs/en.md for the walkthrough."""
+
+import ast
 import json
 import math
 import re
@@ -101,10 +105,18 @@ def read_file(path):
 def run_code(code, language="python"):
     if language != "python":
         return {"error": True, "message": f"Language '{language}' not supported. Only 'python' is available."}
-    forbidden = ["import os", "import sys", "import subprocess", "exec(", "eval(", "__import__", "open("]
-    for pattern in forbidden:
-        if pattern in code:
-            return {"error": True, "message": f"Forbidden operation: {pattern}", "code": "SECURITY_VIOLATION"}
+    try:
+        tree = ast.parse(code)
+    except SyntaxError as e:
+        return {"error": True, "message": f"SyntaxError: {e}", "code": "SYNTAX_ERROR"}
+    unsafe_names = {"exec", "eval", "compile", "__import__", "open", "globals", "locals", "vars", "getattr", "setattr", "delattr"}
+    for node in ast.walk(tree):
+        if isinstance(node, (ast.Import, ast.ImportFrom)):
+            return {"error": True, "message": "Forbidden operation: import is not allowed", "code": "SECURITY_VIOLATION"}
+        if isinstance(node, ast.Attribute) and node.attr.startswith("__") and node.attr.endswith("__"):
+            return {"error": True, "message": "Forbidden operation: dunder attribute access is not allowed", "code": "SECURITY_VIOLATION"}
+        if isinstance(node, ast.Name) and node.id in unsafe_names:
+            return {"error": True, "message": f"Forbidden operation: {node.id} is not allowed", "code": "SECURITY_VIOLATION"}
     try:
         local_vars = {}
         exec(
@@ -184,7 +196,7 @@ def register_all_tools():
     )
     register_tool(
         "run_code",
-        "Execute Python code in a sandboxed environment. Set a 'result' variable to return output.",
+        "Run a small Python snippet behind a static-analysis guard and a restricted interpreter. This is a teaching filter, not real isolation. Set a 'result' variable to return output.",
         {
             "type": "object",
             "properties": {
```

**File**: `phases/11-llm-engineering/09-function-calling/code/main.ts` (modified, +2/-2)
```diff
@@ -141,7 +141,7 @@ function runCode(args: Readonly<Record<string, JsonValue>>): JsonValue {
   if (language !== "javascript") {
     return { error: true, message: "Language '" + language + "' not supported." };
   }
-  const FORBIDDEN = ["require(", "process.", "fs.", "child_process", "import ", "eval(", "Function("];
+  const FORBIDDEN = ["require(", "process.", "fs.", "child_process", "import ", "eval(", "Function(", "constructor", "globalThis"];
   for (const p of FORBIDDEN) {
     if (code.includes(p)) {
       return { error: true, message: "Forbidden operation: " + p, code: "SECURITY_VIOLATION" };
@@ -209,7 +209,7 @@ function registerAllTools(): void {
   );
   registerTool(
     "run_code",
-    "Execute JavaScript in a sandbox. Assign to 'result' to return output.",
+    "Run a small JavaScript snippet behind a denylist and a restricted evaluator. This is a teaching filter, not real isolation. Assign to 'result' to return output.",
     {
       type: "object",
       properties: {
```

---

### Incident Patch 9: `6e2a5868` (2026-09-24)
**Commit Message**: fix(scripts): seed quiz de-bias from a POSIX-normalized path (#466)

* fix(scripts): seed quiz de-bias from a POSIX-normalized path

`seed_for` seeded the option shuffle with the raw path from
`glob.glob("phases/*/*/quiz.json")`, which carries OS-native separators.
Windows therefore computed a different shuffle than Linux, so `--check`
reported 2098 questions as not de-biased and a bare `--fix` run rewrote
373 files into an arrangement the Linux CI gate then rejects.

Normalize the separator before hashing, mirroring
`debias_certification_questions.py`, which already seeds off
`path.relative_to(ROOT).as_posix()`. POSIX paths are unchanged, so the
committed arrangement and the CI gate are unaffected.

Verified on Windows: `--check` now reports 0 rewrites and the same
positional distribution as Linux (A 539, B 582, C 528, D 588), and
`seed_for` maps "a/b" and "a\b" to one seed. An assertion in `main()`
pins both forms so the gate fails if the normalization is ever lost.

* fix(scripts): keep quiz seeding change comment-free

**File**: `scripts/debias_quizzes.py` (modified, +6/-1)
```diff
@@ -36,7 +36,8 @@
 
 
 def seed_for(path, question_text):
-    h = hashlib.sha256(f"{path}\x00{question_text}".encode("utf-8")).hexdigest()
+    normalized = path.replace("\\", "/")
+    h = hashlib.sha256(f"{normalized}\x00{question_text}".encode("utf-8")).hexdigest()
     return int(h[:16], 16)
 
 
@@ -119,6 +120,10 @@ def main():
     ap.add_argument("--check", action="store_true", help="report only, do not write")
     args = ap.parse_args()
 
+    assert seed_for("phases/a/quiz.json", "q") == seed_for("phases\\a\\quiz.json", "q"), (
+        "seed_for must not depend on the platform path separator"
+    )
+
     pos = collections.Counter()
     total = 0
     changed_files = 0
```

---

### Incident Patch 10: `ddfbb4cd` (2026-09-24)
**Commit Message**: fix(phase-10/10): perplexity was different on every run (#358)

The simulated log-probs are seeded from the text so the same text scores the
same way, and STEP 3 compares Strong/Medium/Weak on that basis. hash() of a str
is salted per interpreter process, so the seed changed every run - three
consecutive runs gave Strong-model perplexity 1.20, 1.16, 1.13.

Seed from hashlib.sha256 instead. Three runs now produce byte-identical output,
and the Strong < Medium < Weak ordering the lesson relies on is preserved
(1.13 / 1.44 / 2.52).

Co-authored-by: thejesh23 <thejesh23@users.noreply.github.com>

**File**: `phases/10-llms-from-scratch/10-evaluation/code/main.py` (modified, +3/-2)
```diff
@@ -1,3 +1,4 @@
+import hashlib
 import json
 from collections import Counter
 
@@ -110,7 +111,7 @@ def perplexity(log_probs):
 
 
 def token_log_probs_simulated(text, model_quality=0.8):
-    np.random.seed(hash(text) % 2**31)
+    np.random.seed(int(hashlib.sha256(text.encode()).hexdigest()[:8], 16) % 2**31)
     tokens = text.split()
     log_probs = []
     for i, token in enumerate(tokens):
@@ -188,7 +189,7 @@ def demo_model_bad(prompt):
 
 
 def demo_model_random(prompt):
-    np.random.seed(hash(prompt) % 2**31)
+    np.random.seed(int(hashlib.sha256(prompt.encode()).hexdigest()[:8], 16) % 2**31)
     words = ["yes", "no", "maybe", "42", "Paris", "unknown", "error"]
     return words[np.random.randint(len(words))]
 
```

#### Recent Merged Pull Requests:
- **PR #520** (2026-09-30): fix(site): support clean page URLs across the site (@rohitg00)
- **PR #517** (closed): Sync/upstream 2026 10 (@yennanliu)
- **PR #513** (2026-09-29): fix(site): refresh cached assets and align project commands (@rohitg00)
- **PR #501** (2026-09-29): fix: read readiness inputs as UTF-8 (@dajiaohuang)
- **PR #497** (2026-09-29): feat(projects): add 48 builds and a 52-project roadmap (@rohitg00)
- **PR #495** (2026-09-27): fix: repair broken lesson references and guard homepage storage (@rohitg00)
- **PR #494** (2026-09-27): fix(site): refresh cached header for newsletter signup (@rohitg00)
- **PR #492** (2026-09-27): feat(site): add Substack newsletter signup (@rohitg00)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
