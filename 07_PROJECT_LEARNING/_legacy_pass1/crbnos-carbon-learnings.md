# Forensic Learning Record (Deep Inspection): crbnos/carbon

> **Canonical Artifact**: `07_PROJECT_LEARNING/crbnos-carbon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/crbnos/carbon](https://github.com/crbnos/carbon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:45:06.600Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `crbnos/carbon`
- **Description**: Open-source manufacturing ERP, MES and QMS. Quoting, MRP, inventory, shop floor, quality and lot/serial traceability on one Postgres schema, with a REST API and MCP server. Self-host or use Carbon Cloud.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2655 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/root-cause/references/condition-based-waiting-example.ts`
```
// Complete implementation of condition-based waiting utilities
// From: Lace test infrastructure improvements (2025-10-03)
// Context: Fixed 15 flaky tests by replacing arbitrary timeouts

import type { ThreadManager } from '~/threads/thread-manager';
import type { LaceEvent, LaceEventType } from '~/threads/types';

/**
 * Wait for a specific event type to appear in thread
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param eventType - Type of event to wait for
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to the first matching event
 *
 * Example:
 *   await waitForEvent(threadManager, agentThreadId, 'TOOL_RESULT');
 */
export function waitForEvent(
  threadManager: ThreadManager,
  threadId: string,
  eventType: LaceEventType,
  timeoutMs = 5000
): Promise<LaceEvent> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const event = events.find((e) => e.type === eventType);

      if (event) {
        resolve(event);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for ${eventType} event after ${timeoutMs}ms`));
      } else {
        setTimeout(check, 10); // Poll every 10ms for efficiency
      }
    };

    check();
  });
}

/**
 * Wait for a specific number of events of a given type
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param eventType - Type of event to wait for
 * @param count - Number of events to wait for
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to all matching events once count is reached
 *
 * Example:
 *   // Wait for 2 AGENT_MESSAGE events (initial response + continuation)
 *   await waitForEventCount(threadManager, agentThreadId, 'AGENT_MESSAGE', 2);
 */
export function waitForEventCount(
  threadManager: ThreadManager,
  threadId: string,
  eventType: LaceEventType,
  count: number,
  timeoutMs = 5000
): Promise<LaceEvent[]> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const matchingEvents = events.filter((e) => e.type === eventType);

      if (matchingEvents.length >= count) {
        resolve(matchingEvents);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(
          new Error(
            `Timeout waiting for ${count} ${eventType} events after ${timeoutMs}ms (got ${matchingEvents.length})`
          )
        );
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

/**
 * Wait for an event matching a custom predicate
 * Useful when you need to check event data, not just type
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param predicate - Function that returns true when event matches
 * @param description - Human-readable description for error messages
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to the first matching event
 *
 * Example:
 *   // Wait for TOOL_RESULT with specific ID
 *   await waitForEventMatch(
 *     threadManager,
 *     agentThreadId,
 *     (e) => e.type === 'TOOL_RESULT' && e.data.id === 'call_123',
 *     'TOOL_RESULT with id=call_123'
 *   );
 */
export function waitForEventMatch(
  threadManager: ThreadManager,
  threadId: string,
  predicate: (event: LaceEvent) => boolean,
  description: string,
  timeoutMs = 5000
): Promise<LaceEvent> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      const events = threadManager.getEvents(threadId);
      const event = events.find(predicate);

      if (event) {
        resolve(event);
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`));
      } else {
        setTimeout(check, 10);
      }
    };

    check();
  });
}

// Usage example from actual debugging session:
//
// BEFORE (flaky):
// ---------------
// const messagePromise = agent.sendMessage('Execute tools');
// await new Promise(r => setTimeout(r, 300)); // Hope tools start in 300ms
// agent.abort();
// await messagePromise;
// await new Promise(r => setTimeout(r, 50));  // Hope results arrive in 50ms
// expect(toolResults.length).toBe(2);         // Fails randomly
//
// AFTER (reliable):
// ----------------
// const messagePromise = agent.sendMessage('Execute tools');
// await waitForEventCount(threadManager, threadId, 'TOOL_CALL', 2); // Wait for tools to start
// agent.abort();
// await messagePromise;
// await waitForEventCount(threadManager, threadId, 'TOOL_RESULT', 2); // Wait for results
// expect(toolResults.length).toBe(2); // Always succeeds
//
// Result: 60% pass rate → 100%, 40% faster execution

```

### Core Architecture Module: `.claude/skills/translate/scripts/check-glossary.mjs`
```
#!/usr/bin/env node
// Consistency gate for /translate. `merge-translations.mjs` proves nothing is
// EMPTY; this proves the filled ones AGREE.
//
//   node .claude/skills/translate/scripts/check-glossary.mjs
//   node .claude/skills/translate/scripts/check-glossary.mjs --locale zh --max 40
//   node .claude/skills/translate/scripts/check-glossary.mjs --json > violations.json
//
// Exit 0 = clean (or nothing approved yet to check against), 1 = violations.
// Only as strong as the glossary is filled, so coverage is printed up front
// rather than showing a green tick over an empty rulebook.
import { existsSync, readFileSync } from "node:fs";
import {
  buildMatcher,
  loadGlossary,
  localeCoverage,
  localesOf,
  termsInString,
  usesApprovedTerm,
} from "./lib-glossary.mjs";
import { parsePo, readLocaleConfig } from "./lib-po.mjs";

const REPO = process.cwd();
const LOCALES_DIR = `${REPO}/packages/locale/locales`;
const CATALOGS = ["erp", "mes"];

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? undefined : argv[i + 1];
};
const asJson = argv.includes("--json");
const strict = argv.includes("--strict");
const maxShown = Number(flag("max") || 25);

const doc = loadGlossary();
const matcher = buildMatcher(doc);
const { codes } = readLocaleConfig(`${REPO}/packages/locale/src/config.ts`, readFileSync);
const only = flag("locale");
const targets = (only ? [only] : codes.filter((c) => c !== "en")).filter((c) => localesOf(doc).includes(c));

const violations = [];
let checkedStrings = 0;

for (const locale of targets) {
  const approved = new Map();
  for (const e of doc.terms) {
    const t = (e.translations?.[locale] || "").trim();
    if (t) approved.set(e.term, { approved: t, entry: e });
  }
  if (approved.size === 0) continue;

  for (const catalog of CATALOGS) {
    const po = `${LOCALES_DIR}/${locale}/${catalog}.po`;
    if (!existsSync(po)) continue;
    const { entries } = parsePo(readFileSync(po, "utf8"));
    for (const entry of entries) {
      if (!entry.msgid || !entry.msgstr) continue;
      const hits = termsInString(entry.msgid, matcher);
      if (!hits.length) continue;
      checkedStrings++;
      for (const hit of hits) {
        const rule = approved.get(hit.term);
        if (!rule) continue;
        // Base form + inflection: "Aufträge" for approved "Auftrag" is not a violation.
        if (usesApprovedTerm(entry.msgstr, rule.approved)) continue;
        // An `ambiguity` note means a miss isn't reliably a defect — flag, don't fail.
        violations.push({
          locale,
          catalog,
          term: hit.term,
          expected: rule.approved,
          msgid: entry.msgid,
          msgstr: entry.msgstr,
          advisory: Boolean(hit.ambiguity),
        });
      }
    }
  }
}

const hard = violations.filter((v) => !v.advisory);
const advisory = violations.filter((v) => v.advisory);

if (asJson) {
  console.log(JSON.stringify({ checkedStrings, violations }, null, 2));
  process.exit((strict ? violations.length : hard.length) ? 1 : 0);
}

console.log(`Glossary: ${doc.terms.length} terms`);
for (const l of targets) {
  const c = localeCoverage(doc, l);
  console.log(`  ${c.locale}: ${c.filled}/${c.total} terms approved (${c.pct}%)`);
}
const noRules = targets.filter((l) => localeCoverage(doc, l).filled === 0);
if (noRules.length === targets.length) {
  console.log(`\nNo approved translations yet — nothing to check against. Fill packages/locale/locales/glossary.json first.`);
  process.exit(0);
}
if (noRules.length) console.log(`\nSkipped (no approved terms): ${noRules.join(", ")}`);

console.log(`\nChecked ${checkedStrings} translated strings containing a glossary term.`);
console.log(`Violations: ${hard.length} enforced, ${advisory.length} advisory`);

// Per-term breakdown first: a term with hundreds of advisory hits is the real
// story of a run, and printing only the enforced list would hide it.
const byTerm = new Map();
for (const v of violations) {
  const k = `${v.locale}  ${v.term}`;
  const row = byTerm.get(k) || { locale: v.locale, term: v.term, expected: v.expected, hard: 0, advisory: 0 };
  row[v.advisory ? "advisory" : "hard"]++;
  byTerm.set(k, row);
}
if (byTerm.size) {
  console.log(`\nBy term:`);
  for (const r of [...byTerm.values()].sort((a, b) => b.hard + b.advisory - (a.hard + a.advisory))) {
    const tag = r.advisory ? `${r.hard} enforced + ${r.advisory} advisory` : `${r.hard} enforced`;
    console.log(`  [${r.locale}] ${r.term} → "${r.expected}": ${tag}`);
  }
}

const sample = (rows, heading) => {
  if (!rows.length) return;
  console.log(`\n--- ${heading} ---`);
  for (const v of rows.slice(0, maxShown)) {
    console.log(`\n[${v.locale}/${v.catalog}] "${v.term}" should render as "${v.expected}"`);
    console.log(`   en: ${v.msgid}`);
    console.log(`   ${v.locale}: ${v.msgstr}`);
  }
  if (rows.length > maxShown) console.log(`\n… ${rows.length - maxShown} more (use --json for the full list).`);
};
sample(hard, "ENFORCED (unambiguous terms — these are defects)");
sample(advisory, "ADVISORY (term has a non-domain sense too — read before acting)");

if (advisory.length && !strict) {
  console.log(`\nAdvisory hits do not fail this check. Re-run with --strict to fail on them too.`);
}
process.exit((strict ? violations.length : hard.length) ? 1 : 0);

```

### Core Architecture Module: `.claude/skills/translate/scripts/extract-missing.mjs`
```
#!/usr/bin/env node
// Step 1 of /translate. Scans every committed .po catalog for empty msgstr
// entries and writes deterministic, chunked translation jobs for cheap-model
// subagents to fill.
//
// Outputs (all under .ai/scratch/translate/, gitignored):
//   in/{n}.json        one chunk of msgids to translate (subagent INPUT)
//   manifest.json      list of {in,out,locale,catalog,langLabel,count}
//   (subagents write out/{n}.json — this script only creates in/ + manifest)
//
// Each chunk carries its OWN slice of the glossary — only the terms that
// actually appear in that chunk's strings. Injecting all 448 terms into every
// chunk would cost more tokens than the strings themselves and bury the few
// that matter. This is what stops parallel subagents from each inventing their
// own word for "Job": they are no longer deciding.
//
// Locale scope: supportedLanguages from packages/locale/src/config.ts, minus
// the source locale "en". Orphaned locales on disk (e.g. nl) are excluded
// because they're not in supportedLanguages.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { buildMatcher, doNotTranslate, glossaryForItems, loadGlossary, localeCoverage } from "./lib-glossary.mjs";
import { parsePo, readLocaleConfig } from "./lib-po.mjs";

const REPO = process.cwd();
const CONFIG = `${REPO}/packages/locale/src/config.ts`;
const LOCALES_DIR = `${REPO}/packages/locale/locales`;
const OUT_DIR = `${REPO}/.ai/scratch/translate`;
const CATALOGS = ["erp", "mes"];
const CHUNK_SIZE = Number(process.env.TRANSLATE_CHUNK_SIZE || 40);

const { codes, labels } = readLocaleConfig(CONFIG, readFileSync);
const targets = codes.filter((c) => c !== "en");

const glossary = loadGlossary(REPO);
const matcher = buildMatcher(glossary);
const keepAsIs = doNotTranslate(glossary);

// Fresh scratch each run so stale chunks never merge.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(`${OUT_DIR}/in`, { recursive: true });
mkdirSync(`${OUT_DIR}/out`, { recursive: true });

const manifest = [];
let chunkNo = 0;
let totalMissing = 0;
let totalTermRefs = 0;

for (const locale of targets) {
  const langLabel = labels[locale] || locale;
  for (const catalog of CATALOGS) {
    const po = `${LOCALES_DIR}/${locale}/${catalog}.po`;
    if (!existsSync(po)) continue;
    const { entries } = parsePo(readFileSync(po, "utf8"));
    const missing = entries.filter((e) => e.msgid !== "" && e.msgstr === "");
    if (missing.length === 0) continue;
    totalMissing += missing.length;
    for (let i = 0; i < missing.length; i += CHUNK_SIZE) {
      const slice = missing.slice(i, i + CHUNK_SIZE);
      const inPath = `${OUT_DIR}/in/${chunkNo}.json`;
      const outPath = `${OUT_DIR}/out/${chunkNo}.json`;
      const terms = glossaryForItems(slice.map((e) => e.msgid), locale, glossary, matcher);
      totalTermRefs += terms.length;
      writeFileSync(
        inPath,
        JSON.stringify(
          {
            locale,
            langLabel,
            catalog,
            domain:
              "Carbon is a manufacturing ERP/MES/QMS: it runs a machine shop's quotes, orders, purchasing, inventory, jobs on the shop floor, quality records and accounting. Translate as an ERP product would be translated in this language — use the terminology a manufacturing professional in that market expects, not a literal dictionary rendering.",
            glossary: terms,
            doNotTranslate: keepAsIs,
            items: slice.map((e) => ({
              msgid: e.msgid,
              // translator notes (#. lines) carry placeholder context
              note: e.comments.filter((c) => c.startsWith("#.")).join(" ").trim() || undefined,
            })),
          },
          null,
          2,
        ),
      );
      manifest.push({
        chunk: chunkNo,
        in: inPath,
        out: outPath,
        locale,
        catalog,
        langLabel,
        count: slice.length,
        glossaryTerms: terms.length,
        approvedTerms: terms.filter((t) => t.approved).length,
      });
      chunkNo++;
    }
  }
}

writeFileSync(`${OUT_DIR}/manifest.json`, JSON.stringify(manifest, null, 2));

const byLocale = {};
for (const m of manifest) byLocale[m.locale] = (byLocale[m.locale] || 0) + m.count;
console.log(`Missing translations: ${totalMissing} across ${targets.length} locales`);
console.log(`Chunks: ${manifest.length} (size ${CHUNK_SIZE}) → ${OUT_DIR}/manifest.json`);
for (const [loc, n] of Object.entries(byLocale)) console.log(`  ${loc}: ${n}`);

console.log(`\nGlossary: ${glossary.terms.length} terms · ${totalTermRefs} term references injected across chunks`);
const bare = [];
for (const loc of new Set(manifest.map((m) => m.locale))) {
  const c = localeCoverage(glossary, loc);
  if (c.filled === 0) bare.push(loc);
  else console.log(`  ${loc}: ${c.filled}/${c.total} approved (${c.pct}%)`);
}
if (bare.length) {
  console.log(`  NO APPROVED TERMS YET: ${bare.join(", ")}`);
  console.log(`  → those locales get domain context and English meanings, but no fixed vocabulary.`);
  console.log(`  → fill packages/locale/locales/glossary.json to make them consistent.`);
}
if (totalMissing === 0) console.log("NOTHING_TO_TRANSLATE");

```

### Core Architecture Module: `.claude/skills/translate/scripts/glossary-lookup.mjs`
```
#!/usr/bin/env node
// Glossary lookup for /translate — "is this a domain term, and what is its
// approved translation?" without reading the whole file into context.
//
//   node .claude/skills/translate/scripts/glossary-lookup.mjs --term Job --locale zh
//   node .claude/skills/translate/scripts/glossary-lookup.mjs --scan "Delete this job material?" --locale zh
//   node .claude/skills/translate/scripts/glossary-lookup.mjs --coverage
//   node .claude/skills/translate/scripts/glossary-lookup.mjs --list --locale zh --missing
//
// Exit codes: 0 found / 1 not found (so it can gate a shell step).
import {
  buildMatcher,
  glossaryForItems,
  loadGlossary,
  localeCoverage,
  localesOf,
  surfaceForms,
  termsInString,
} from "./lib-glossary.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1]?.startsWith("--") ? true : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const doc = loadGlossary();
const locales = localesOf(doc);
const locale = flag("locale");
if (locale && !locales.includes(locale)) {
  console.error(`Unknown locale "${locale}". Known: ${locales.join(", ")}`);
  process.exit(1);
}

const show = (entry) => {
  const line = [`${entry.term}  [${entry.category}]`];
  if (locale) {
    const t = (entry.translations?.[locale] || "").trim();
    line.push(t ? `→ ${locale}: ${t}` : `→ ${locale}: (NOT YET APPROVED — leave to translator judgement)`);
  }
  console.log(line.join("  "));
  console.log(`    meaning: ${entry.context}`);
  if (entry.ambiguity) console.log(`    ONLY applies to: ${entry.ambiguity}`);
  if (entry.englishVariants) console.log(`    same word as: ${entry.englishVariants.join(", ")}`);
  if (entry.seeAlso) console.log(`    see also: ${entry.seeAlso} (related, translated independently)`);
};

if (has("coverage")) {
  console.log(`Glossary: ${doc.terms.length} terms · ${locales.length} locales`);
  for (const l of locales) {
    const c = localeCoverage(doc, l);
    console.log(`  ${c.locale}: ${c.filled}/${c.total} approved (${c.pct}%)`);
  }
  process.exit(0);
}

if (has("list")) {
  const wantMissing = has("missing");
  const rows = doc.terms.filter((t) => {
    if (!locale || !wantMissing) return true;
    return (t.translations?.[locale] || "").trim() === "";
  });
  for (const e of rows.sort((a, b) => a.category.localeCompare(b.category) || a.term.localeCompare(b.term))) {
    console.log(`${e.category.padEnd(12)} ${e.term}${locale ? `  ${(e.translations?.[locale] || "").trim() || "—"}` : ""}`);
  }
  console.log(`\n${rows.length} term(s)${wantMissing && locale ? ` with no approved ${locale} translation` : ""}`);
  process.exit(0);
}

const term = flag("term");
if (term) {
  const key = String(term).toLowerCase();
  const hits = doc.terms.filter((e) => surfaceForms(e).some((f) => f.toLowerCase() === key));
  if (!hits.length) {
    console.log(`"${term}" is not a glossary term — translate it normally.`);
    process.exit(1);
  }
  hits.forEach(show);
  process.exit(0);
}

const scan = flag("scan");
if (scan) {
  const hits = termsInString(String(scan), buildMatcher(doc));
  if (!hits.length) {
    console.log("No glossary terms in that string — translate it normally.");
    process.exit(1);
  }
  hits.forEach(show);
  if (locale) {
    console.log(`\nJSON block for a subagent prompt:`);
    console.log(JSON.stringify(glossaryForItems([String(scan)], locale, doc, buildMatcher(doc)), null, 2));
  }
  process.exit(0);
}

console.error(`Usage:
  --term <English term> [--locale <code>]   look up one term
  --scan "<English string>" [--locale ...]  find every glossary term in a string
  --list [--locale <code>] [--missing]      list terms, optionally only unapproved ones
  --coverage                                approved-term counts per locale`);
process.exit(1);

```

### Core Architecture Module: `.claude/skills/translate/scripts/lib-glossary.mjs`
```
// Shared glossary helpers for the /translate skill.
// A blank translation means NOT YET APPROVED — callers must surface that
// explicitly, so a subagent can't read silence as permission to pick its own word.

import { readFileSync } from "node:fs";

export const GLOSSARY_PATH = "packages/locale/locales/glossary.json";

export function loadGlossary(repo = process.cwd()) {
  const doc = JSON.parse(readFileSync(`${repo}/${GLOSSARY_PATH}`, "utf8"));
  if (!Array.isArray(doc.terms))
    throw new Error(`${GLOSSARY_PATH}: no terms[]`);
  return doc;
}

// The term plus its spelling variants — every English form resolving to this entry.
export function surfaceForms(entry) {
  return [entry.term, ...(entry.englishVariants || [])];
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Abbreviations match case-SENSITIVELY: lowercase "eco" is inside "record" and
// "rma" inside "format", so a loose match there produces confident nonsense.
function formRegex(form) {
  const caseSensitive = form === form.toUpperCase() && /[A-Z]/.test(form);
  return new RegExp(
    `(?<![\\w-])${escapeRe(form)}(s|es)?(?![\\w-])`,
    caseSensitive ? "" : "i"
  );
}

// Build a matcher once, reuse across thousands of strings.
export function buildMatcher(doc) {
  const forms = [];
  for (const entry of doc.terms) {
    for (const form of surfaceForms(entry))
      forms.push({ form, entry, re: formRegex(form) });
  }
  forms.sort((a, b) => b.form.length - a.form.length);
  return forms;
}

// A placeholder is CODE, not prose: `{total}` is a variable name the translator
// must copy verbatim, so scanning it for terms both mis-reports a violation and
// — worse — orders the subagent to translate an identifier. Masked to spaces so
// match offsets still line up with the original.
// Only `{identifier}` is masked. An ICU plural branch (`{# lines differ …}`)
// holds real human text and MUST stay visible to the matcher.
const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;

// `{variances, plural, …}` — the argument name and the ICU keyword are code too,
// but the trailing comma keeps them out of PLACEHOLDER. Mask the header ONLY,
// so the branches after it stay visible.
const ICU_HEADER = /\{\s*[A-Za-z0-9_]+\s*,\s*(plural|select|selectordinal)\s*,/g;

export function maskPlaceholders(str) {
  return str
    .replace(ICU_HEADER, (m) => " ".repeat(m.length))
    .replace(PLACEHOLDER, (m) => " ".repeat(m.length));
}

// Longest-match-wins: "Sales Order Line" consumes the "Line" inside it, so a
// compound doesn't drag in its own parts and bury the terms that matter.
export function termsInString(str, matcher) {
  const hits = [];
  let masked = maskPlaceholders(str);
  for (const { form, entry, re } of matcher) {
    const m = masked.match(re);
    if (!m) continue;
    if (!hits.includes(entry)) hits.push(entry);
    masked =
      masked.slice(0, m.index) +
      " ".repeat(m[0].length) +
      masked.slice(m.index + m[0].length);
  }
  return hits;
}

// The per-chunk term list for a subagent. Blank translations pass through as
// `approved: null` with their meaning — context without a wrong word to copy.
export function glossaryForItems(msgids, locale, doc, matcher) {
  const seen = new Map();
  for (const msgid of msgids) {
    for (const entry of termsInString(msgid, matcher)) {
      if (seen.has(entry.term)) continue;
      seen.set(entry.term, {
        term: entry.term,
        approved: entry.translations?.[locale] || null,
        meaning: entry.context,
        ...(entry.ambiguity ? { onlyAppliesTo: entry.ambiguity } : {}),
        ...(entry.englishVariants ? { sameWordAs: entry.englishVariants } : {}),
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.term.localeCompare(b.term));
}

// An approved term is the BASE form and translators inflect it (Auftrag →
// Aufträge, заказ → заказа), so matching is on the STEM, not the whole word.
// Errs toward accepting: a false violation costs trust in the whole gate.

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;

function normalize(s) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

// CJK doesn't inflect, so the term must appear whole; else keep ~60% as stem.
function stemOf(approved) {
  if (CJK.test(approved)) return approved;
  const n = normalize(approved);
  if (n.length <= 4) return n;
  return n.slice(0, Math.max(4, Math.ceil(n.length * 0.6)));
}

// Multi-word terms are checked word by word, since a language may reorder them.
export function usesApprovedTerm(msgstr, approved) {
  if (!approved) return true;
  if (CJK.test(approved)) return msgstr.includes(approved);
  const haystack = normalize(msgstr);
  return approved
    .split(/\s+/)
    .filter((w) => normalize(w).length > 2)
    .every((w) => haystack.includes(stemOf(w)));
}

export function localesOf(doc) {
  return doc._readme?.locales || Object.keys(doc.terms[0]?.translations || {});
}

export function doNotTranslate(doc) {
  return doc._readme?.doNotTranslate || [];
}

export function localeCoverage(doc, locale) {
  const total = doc.terms.length;
  const filled = doc.terms.filter(
    (t) => (t.translations?.[locale] || "").trim() !== ""
  ).length;
  return {
    locale,
    filled,
    total,
    pct: total ? Math.round((filled / total) * 100) : 0,
  };
}

```

### Core Architecture Module: `.claude/skills/translate/scripts/lib-po.mjs`
```
// Shared .po parsing helpers for the /translate skill.
// A .po entry is: optional comment lines (#...), a msgid (one or more quoted
// lines), then a msgstr (one or more quoted lines). Values are the quoted
// segments concatenated, with PO escape sequences decoded.

const UNESCAPE = { '"': '"', "\\": "\\", n: "\n", t: "\t", r: "\r" };

export function unescapePo(s) {
  return s.replace(/\\(["\\ntr])/g, (_m, c) => UNESCAPE[c]);
}

export function escapePo(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r");
}

function stripQuotes(q) {
  const m = q.match(/^"([\s\S]*)"$/);
  return m ? m[1] : "";
}

// Parse into { lines, entries }. Each entry: { comments[], msgid, msgstr,
// msgstrLineIndex, msgstrLineCount }. Line indices point into `lines` so a
// caller can rewrite a msgstr in place and re-join.
export function parsePo(text) {
  const lines = text.split("\n");
  const entries = [];
  let i = 0;
  while (i < lines.length) {
    const comments = [];
    while (i < lines.length && lines[i].startsWith("#")) comments.push(lines[i++]);
    if (i >= lines.length) break;
    if (!lines[i].startsWith("msgid ")) {
      i++;
      continue;
    }
    const msgidQ = [lines[i].slice("msgid ".length)];
    i++;
    while (i < lines.length && lines[i].startsWith('"')) msgidQ.push(lines[i++]);
    // Plural entries carry msgstr[n], not msgstr. Lingui does not emit them, but
    // consume them rather than leaving the msgstr[n] lines to be re-scanned.
    if (i < lines.length && lines[i].startsWith("msgid_plural ")) {
      i++;
      while (i < lines.length && (lines[i].startsWith('"') || lines[i].startsWith("msgstr["))) i++;
      continue;
    }
    if (i >= lines.length || !lines[i].startsWith("msgstr ")) continue;
    const msgstrLineIndex = i;
    const msgstrQ = [lines[i].slice("msgstr ".length)];
    i++;
    while (i < lines.length && lines[i].startsWith('"')) msgstrQ.push(lines[i++]);
    // A second msgstr on one msgid is a corrupt catalog (a bad .po merge keeps
    // both sides). Refuse rather than silently translating against one of them.
    if (i < lines.length && lines[i].startsWith("msgstr ")) {
      throw new Error(
        `Corrupt .po: duplicate msgstr on line ${i + 1} for msgid ${msgidQ.join("")}. Keep one translation per entry.`,
      );
    }
    entries.push({
      comments,
      msgid: msgidQ.map((q) => unescapePo(stripQuotes(q))).join(""),
      msgstr: msgstrQ.map((q) => unescapePo(stripQuotes(q))).join(""),
      msgstrLineIndex,
      msgstrLineCount: msgstrQ.length,
    });
  }
  return { lines, entries };
}

// supportedLanguages + languageNativeLabels parsed straight from the source of
// truth so the skill never drifts from the runtime locale list.
export function readLocaleConfig(configPath, readFileSync) {
  const src = readFileSync(configPath, "utf8");
  const listMatch = src.match(/supportedLanguages\s*=\s*\[([\s\S]*?)\]/);
  const codes = [...listMatch[1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
  const labelBlock = src.match(/languageNativeLabels[^{]*\{([\s\S]*?)\}/)[1];
  const labels = {};
  for (const m of labelBlock.matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) labels[m[1]] = m[2];
  return { codes, labels };
}

```

### Core Architecture Module: `.claude/skills/translate/scripts/merge-translations.mjs`
```
#!/usr/bin/env node
// Final step of /translate. Reads the chunk outputs produced by the cheap-model
// subagents and writes each translation into the matching empty msgstr in the
// .po files. Deterministic: no model in the write path, only exact msgid match,
// and only empty msgstr are ever touched (existing translations are never
// overwritten). Reports matched / unmatched / still-missing counts.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { escapePo, parsePo } from "./lib-po.mjs";

const REPO = process.cwd();
const OUT_DIR = `${REPO}/.ai/scratch/translate`;
const LOCALES_DIR = `${REPO}/packages/locale/locales`;
const MANIFEST = `${OUT_DIR}/manifest.json`;

if (!existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}. Run extract-missing.mjs first.`);
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));

// The one failure mode a cheap model hits over and over: a bare ASCII `"` inside
// a value, because so many msgids quote a word. Left alone it costs the WHOLE
// chunk — 6 of 37 on the de run, ~230 strings — so repair it here rather than
// re-spending on a retry that fails the same way. A closing quote is one whose
// next non-space character is `:`, `,` or `}`; anything else is text.
//
// BEST EFFORT, not a guarantee — 5 of those 6 chunks. It cannot save a mismatched
// pair like German `„Wort"`, where the closing ASCII quote sits before a comma and
// is genuinely indistinguishable from the end of the value. The retry round is the
// backstop for those; this just stops the common case costing a whole chunk.
function repairBareQuotes(src) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr && c === "\\") {
      out += c + src[++i];
      continue;
    }
    if (c === '"') {
      if (!inStr) {
        inStr = true;
        out += c;
        continue;
      }
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (":,}".includes(src[j])) {
        inStr = false;
        out += c;
        continue;
      }
      out += '\\"';
      continue;
    }
    out += c;
  }
  return out;
}

let repairedChunks = 0;

function readChunk(path) {
  const raw = readFileSync(path, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const parsed = JSON.parse(repairBareQuotes(raw)); // throws on anything else
    repairedChunks++;
    return parsed;
  }
}

// Merge all chunk outputs for a given (locale,catalog) against its .po once.
const byPo = {};
for (const m of manifest) {
  const key = `${m.locale}/${m.catalog}`;
  (byPo[key] ||= { locale: m.locale, catalog: m.catalog, outs: [] }).outs.push(m.out);
}

let matched = 0;
let unmatched = 0;
const missingChunks = [];

for (const { locale, catalog, outs } of Object.values(byPo)) {
  const translations = {};
  for (const out of outs) {
    if (!existsSync(out)) {
      missingChunks.push(out);
      continue;
    }
    try {
      Object.assign(translations, readChunk(out));
    } catch {
      missingChunks.push(`${out} (invalid JSON)`);
    }
  }
  if (Object.keys(translations).length === 0) continue;

  const po = `${LOCALES_DIR}/${locale}/${catalog}.po`;
  const { lines, entries } = parsePo(readFileSync(po, "utf8"));
  const targeted = new Set();
  for (const e of entries) {
    if (e.msgid === "" || e.msgstr !== "") continue; // only fill empties
    const t = translations[e.msgid];
    if (t === undefined || t === "") continue;
    if (e.msgstrLineCount !== 1) continue; // empty msgstr is always one line
    lines[e.msgstrLineIndex] = `msgstr "${escapePo(t)}"`;
    matched++;
    targeted.add(e.msgid);
  }
  // Translations the model returned that matched no empty msgid.
  for (const k of Object.keys(translations)) if (!targeted.has(k)) unmatched++;
  writeFileSync(po, lines.join("\n"));
}

// Recount remaining empties across the targeted catalogs.
let remaining = 0;
for (const { locale, catalog } of Object.values(byPo)) {
  const { entries } = parsePo(readFileSync(`${LOCALES_DIR}/${locale}/${catalog}.po`, "utf8"));
  remaining += entries.filter((e) => e.msgid !== "" && e.msgstr === "").length;
}

console.log(`Merged: ${matched} filled, ${unmatched} unmatched (key mismatch)`);
if (repairedChunks) console.log(`Repaired ${repairedChunks} chunk(s) with unescaped quotes`);
console.log(`Remaining empty msgstr in targeted catalogs: ${remaining}`);
if (missingChunks.length) {
  console.log(`Missing/invalid chunk outputs (${missingChunks.length}):`);
  for (const c of missingChunks) console.log(`  ${c}`);
}
if (remaining > 0) console.log("INCOMPLETE — re-run /translate to fill the rest");

```

### Core Architecture Module: `.claude/skills/translate/scripts/progress.mjs`
```
#!/usr/bin/env node
// Live progress for /translate. Reads the manifest + the out/ chunk files that
// Haiku subagents write as they finish, and reports how many chunks / strings
// are done, overall and per locale.
//
//   node progress.mjs            one-shot snapshot (print after each batch)
//   node progress.mjs --watch    tick every 10s until .done marker (background)
//
// Runs independently of the main agent loop, so --watch keeps ticking even while
// the main loop is blocked awaiting a batch of subagents.
import { existsSync, readFileSync, readdirSync } from "node:fs";

const REPO = process.cwd();
const DIR = `${REPO}/.ai/scratch/translate`;
const MANIFEST = `${DIR}/manifest.json`;
const DONE_MARKER = `${DIR}/.done`;
const watch = process.argv.includes("--watch");
const INTERVAL_MS = Number(process.env.TRANSLATE_PROGRESS_INTERVAL || 10) * 1000;
const MAX_MS = 45 * 60 * 1000; // safety stop

function bar(frac, width = 24) {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return `[${"#".repeat(n)}${"-".repeat(width - n)}]`;
}

function snapshot() {
  if (!existsSync(MANIFEST)) return "[progress] waiting for manifest…";
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return "[progress] manifest being rewritten…";
  }
  const outFiles = existsSync(`${DIR}/out`) ? new Set(readdirSync(`${DIR}/out`)) : new Set();
  const exp = {};
  const got = {};
  let chunksDone = 0;
  let strDone = 0;
  let strExp = 0;
  for (const m of manifest) {
    exp[m.locale] = (exp[m.locale] || 0) + m.count;
    got[m.locale] = got[m.locale] || 0;
    strExp += m.count;
    const fname = `${m.chunk}.json`;
    if (outFiles.has(fname)) {
      try {
        const keys = Object.keys(JSON.parse(readFileSync(`${DIR}/out/${fname}`, "utf8"))).length;
        chunksDone++;
        strDone += keys;
        got[m.locale] += keys;
      } catch {
        // half-written file this tick; counts next tick
      }
    }
  }
  const frac = strExp ? strDone / strExp : 1;
  const perLocale = Object.keys(exp)
    .map((l) => `${l} ${got[l]}/${exp[l]}`)
    .join(" · ");
  const ts = new Date().toISOString().slice(11, 19);
  return (
    `[progress ${ts}] ${bar(frac)} chunks ${chunksDone}/${manifest.length} · ` +
    `strings ${strDone}/${strExp} (${Math.round(frac * 100)}%)\n            ${perLocale}`
  );
}

if (!watch) {
  console.log(snapshot());
} else {
  const start = Date.now();
  console.log(snapshot());
  const timer = setInterval(() => {
    if (existsSync(DONE_MARKER) || Date.now() - start > MAX_MS) {
      console.log(snapshot());
      console.log("[progress] done.");
      clearInterval(timer);
      return;
    }
    console.log(snapshot());
  }, INTERVAL_MS);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1190** (2026-07-23): **Stale supplier process data in bill of process dropdown after deletion**
  *Symptoms*: ## Problem  When a supplier process is deleted and the user navigates back to the bill of process, the deleted supplier still appears in the dropdown until a hard page refresh.  ## Root Cause  The `useSupplierProcesses` hook in `SupplierProcess.tsx` uses React Router's `useFetcher` which loads data fresh on mount with no caching. When navigating back to the bill of process, the fetcher still has stale data from before.    ## Acceptance Criteria  - [ ] Deleted supplier processes no longer appear in bill of process dropdown - [ ] No page refresh needed to see updated supplier list - [ ] Follows existing repo patterns with clientLoader/clientAction
  **Post-Mortem & Fix Analysis**:
  > ## Investigation Summary  This bug has already been fixed by prior work:  - **PR #1200** () changed the delete route's `clientAction` from `invalidateQueries` (marks stale but leaves data) to actually removing the cached data - **PR #1202** (`0005e8763`) refined it to a `processId`-scoped `setQueryData(key, null)`  Combined with the create/edit routes (which already clear the same cache) and the API route's `clientLoader`, navigating back = remount = fresh fetch. All three acceptance criteria are now satisfied:  ✅ Deleted supplier processes no longer appear in bill of process dropdown   ✅ No page refresh needed to see updated supplier list   ✅ Follows existing repo patterns with clientLoader/clientAction  **Closing as fixed by existing PRs.** Please verify on the next deploy and reopen if the issue persists.
  > ## Investigation Summary  This bug has already been fixed by prior work:  - **PR #1200** changed the delete route's `clientAction` from `invalidateQueries` (marks stale but leaves data) to actually removing the cached data - **PR #1202** refined it to a `processId`-scoped `setQueryData(key, null)`  Combined with the create/edit routes (which already clear the same cache) and the API route's `clientLoader`, navigating back = remount = fresh fetch. All three acceptance criteria are now satisfied:  ✅ Deleted supplier processes no longer appear in bill of process dropdown   ✅ No page refresh needed to see updated supplier list   ✅ Follows existing repo patterns with clientLoader/clientAction  **Closing as fixed by existing PRs.** Please verify on the next deploy and reopen if the issue persists.

- **Issue #1097** (2026-07-07): **fix: New Procedure modal X button doesn't close when navigating directly; add Cancel button**
  *Symptoms*: ## Problem  When navigating directly to `/x/production/procedures/new`, clicking the X button on the modal does nothing. Additionally, there is no Cancel button in the modal footer.  **Root cause (X button):** `onClose` called `navigate(-1)` — with no history stack (direct URL landing), this is a no-op. The modal never closes.  **Root cause (Cancel missing):** `ProcedureForm` footer only had a Save/Submit button; no Cancel was rendered.  ## Changes  ### `apps/erp/app/routes/x+/production+/procedures.new.tsx` - Changed `onClose={() => navigate(-1)}` → `onClose={() => navigate(path.to.procedures)}`   - Ensures the modal always navigates away regardless of history state  ### `apps/erp/app/modules/production/ui/Procedures/ProcedureForm.tsx` - Added `Button` import from `@carbon/react` - Added Cancel button in `ModalDrawerFooter` next to Save, calling `onClose()`  ## Acceptance  - [ ] Navigating directly to `/x/production/procedures/new` and clicking X closes the modal and navigates to `/x/production/procedures` - [ ] Cancel button appears in the footer next to Save - [ ] Clicking Cancel closes the modal the same way as X - [ ] Saving still works as before  Reported by Naveen in Slack.

- **Issue #1081** (2026-07-06): **Redis resilience: health endpoint + observability**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1083 (resilient wrapper, merged) — can be built in parallel with #1078 and #1080.  ## Context Anshul's PR #1083 adds `withResilience()` in `packages/kv/src/resilient.ts` and already emits a throttled `console.warn` on Redis unavailability and a `console.info` on reconnect (via `logUnavailable` / `logReconnected`). This ticket surfaces that signal in a health endpoint and promotes the log events to structured observability.  ## What to build  ### 1. Health endpoint Add or extend a `/health` route in `apps/erp` that reports Redis reachability: - Response: `{ status: 'healthy' | 'degraded', redis: 'up' | 'down' }` (JSON) - Check Redis with a single `PING` call using `redis.ping()` from `@carbon/kv` — the resilience wrapper will return `null` instead of throwing if Redis is down, so a `null` response means down - Return HTTP 200 in both cases — health endpoints should always respond - Short implicit timeout from the wrapper's `REDIS_TIMEOUT_MS` (2s) is sufficient; no need for extra timeout logic  ### 2. Structured degraded-state logging Promote the existing `logUnavailable` / `logReconnected` calls in `resilient.ts` to structured log events: - On transition to degraded: emit `{ event: 'redis.degraded', message: '...' }` - On recovery: emit `{ event: 'redis.recovered' }` - Already throttled (one log per transition) — keep that behavior  ## Acceptance Criteria - `GET /health` returns `{ status: 'healthy
  **Post-Mortem & Fix Analysis**:
  > ✅ Shipped: PR #1086 — all acceptance criteria met, now ready for review.  - GET /health returns `{status:'healthy',redis:'up'}` (HTTP 200) when Redis running - GET /health returns `{status:'degraded',redis:'down'}` (HTTP 200) when Redis.ping() → null - Route is unauthenticated - `resilient.ts` already emitted `redis.degraded`/`redis.recovered` structured JSON events with one-log-per-transition throttle (no change needed) - Vitest 2 passed ✅, `erp tsc --noEmit` clean ✅, Biome clean ✅
  > PR #1086 was merged ✅ — closing.

- **Issue #1080** (2026-07-06): **Redis resilience: migrate remaining cache consumers (printing, ERP server files)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1083 (resilient wrapper, merged).  ## Context Anshul's PR #1083 wraps the `@carbon/kv` Redis client at the Proxy level inside `withResilience()`. All consumers that import `redis` from `@carbon/kv` automatically get fail-soft behavior — reads resolve `null` (collections `[]`), writes resolve `null`, no thrown errors. No per-call-site migration needed.  ## Scope Verify and harden remaining cache consumers (non-auth, non-rate-limit). Review null-handling logic in each consumer to make sure they treat a `null` return as a cache miss and fall through to the source of truth.  ## What to verify  1. **`packages/printing/src/cache.server.ts`** — confirm cache reads treat `null` as a miss; writes are fire-and-forget (no throw on fail) 2. **`apps/erp/app/modules/shared/*.server.ts`** — same review 3. **`apps/erp/app/modules/settings/*.server.ts`** — same review 4. **`apps/erp/app/modules/users/*.server.ts`** — same review 5. **`apps/erp/app/routes/api+/docs.ts`** — same review 6. Grep for any `import.*ioredis` consumers that bypass `@carbon/kv` and still call the raw client — those need to import through `@carbon/kv` instead  ## What to build (if any consumer assumes non-null) Fix the null-handling logic in that consumer. Do **not** add try/catch for connectivity — the wrapper already handles that. Just handle `null` as a cache miss.  ## Acceptance Criteria - Grep confirms no raw `import.*ioredis` in app/pa

- **Issue #1079** (2026-07-06): **Redis resilience: rate-limiter fail-safe (app + edge function)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1077 (resilient wrapper).  ## Scope Rate limiting must not block login/auth when Redis is down. Migrate rate-limit consumers to fail-open (or bounded in-memory fallback) behavior and document the security trade-off.  ## Files to migrate - `packages/kv/src/ratelimit/` — app rate limiter - `packages/database/supabase/functions/lib/ratelimit.ts` — edge function rate limiter  ## Fallback policy On Redis failure, rate limiting should **fail open** (allow the request) with a warning log. Alternatively, a bounded in-memory window limiter may be used as a degraded-mode fallback. Either way: - No thrown error propagated to caller - No blocking of auth/login flows - The security trade-off (temporarily allowing requests above the rate limit) must be explicitly documented in a code comment and PR description  ## Acceptance Criteria - With Redis stopped, login and authenticated API requests proceed (are not rate-limit-blocked) - Rate limiter failure emits a warning log (not an error that surfaces to the user) - Security trade-off documented in code + PR description - Unit tests: Redis-down → fail-open behavior asserted for both app and edge limiter - TypeScript and biome clean (edge function may need separate type checks)
  **Post-Mortem & Fix Analysis**:
  > Covered by #1083 (Anshul's PR). The `Ratelimit` class already fails open — `failOpen()` returns `{ success: true }` on any Redis error, and `ratelimit.ts` has a timeout guard that also calls `failOpen()`. No additional work needed.

- **Issue #1078** (2026-07-06): **Redis resilience: migrate auth path (getClaims, session, verification, passkey)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app). Depends on #1083 (resilient wrapper + rate limiter, merged).  ## Context Anshul's PR #1083 wraps the `@carbon/kv` Redis client at the Proxy level inside `withResilience()`. All consumers that import `redis` from `@carbon/kv` automatically get fail-soft behavior — no per-call-site changes needed. The `client.ts` singleton is already wrapped.  ## Scope Verify and harden the auth path end-to-end. The resilience wrapper handles the Redis errors; this ticket is about ensuring the fallback logic in auth code is correct and tested.  ## What to verify and build  1. **`getClaims` (users.server.ts):** Confirm that when `redis.get()` returns `null` (cache miss / Redis down), the function falls through to the DB lookup instead of returning stale or empty claims. No code change needed if it already treats `null` as a miss — but add the test. 2. **Session / verification / passkey services:** Review each for any assumptions that Redis will return a non-null value. If a service interprets `null` as a failure rather than a miss, fix the null-handling logic. 3. **Tests:** Add Redis-down unit tests for each auth service (use `ioredis-mock` per `@carbon/kv` conventions, or mock `@carbon/kv` to return `null`):    - `getClaims` with Redis returning null → DB lookup succeeds → returns correct claims    - Session / verification / passkey paths don't throw when cache returns null  ## Acceptance Criteria (Redis stopped = `docker stop 
  **Post-Mortem & Fix Analysis**:
  > Dropped `agent:working` — stale lease cleaned up. This issue is part of the Redis resilience epic (#1077–#1081) which was paused per Brad's direction on 2026-07-06. Worktree removed. Issue remains assigned; ready to pick back up when directed.
  > All acceptance criteria met — PR opened: https://github.com/crbnos/carbon/pull/1084  **What was done:** - Hardened `@carbon/auth` Redis null-handling: wrapped claims-caching `redis.set` in `getUserClaims` try/catch, documented fail-closed intent in `verifyEmailCode`, fire-and-forget on session `redis.del`, confirmed passkey callers null-guard `getAndDelete*` results - Added `auth-redis-resilience.test.ts` covering all 6 Redis-down cases (getUserClaims DB fallback, sendVerificationCode returns false, verifyEmailCode returns false, both passkey getAndDelete* return null, updateCompanySession no crash) - All gates pass: typecheck ✅ lint ✅ tests ✅  Completed in 11 iterations.

- **Issue #1077** (2026-07-06): **Redis resilience: wrapper + tests in @carbon/kv (foundation)**
  *Symptoms*: ## Parent Part of epic #1076 (Redis downtime kills the entire app).  ## Scope Introduce a resilient accessor layer in `packages/kv/src/client.ts` so all consumers can safely tolerate Redis outages without adding ad-hoc try/catch at each call site.  ## What to build  1. **`withRedis<T>(fn: (client) => Promise<T>, fallback: T): Promise<T>` helper** in `packages/kv/src/client.ts`:    - Wraps any Redis command with a per-call timeout (e.g. 500ms)    - Catches all connection/command errors (ECONNREFUSED, command timeouts, ioredis offline-queue full)    - Returns `fallback` on any error — never throws    - Logs degraded state on first failure + recovery when Redis reconnects (debounced, not per-request)    - Does not change `enableOfflineQueue` / `retryStrategy` defaults (those govern reconnection, not call safety)  2. **Convenience wrappers:** `safeGet(key) => string | null`, `safeSet(key, value, options?) => void`, `safeDel(key) => void` — all using `withRedis` internally, returning typed defaults on failure.  3. **ioredis-mock unit tests** covering:    - Normal path: returns real data    - Redis-down (mock `ioredis` throws): returns fallback, no throw, logs degraded    - Redis-recovery: subsequent call succeeds after mock is restored  ## Acceptance Criteria - `withRedis` exported from `packages/kv/src/index.ts`; convenience wrappers exported alongside - No caller can trigger an unhandled rejection via `withRedis`/`safeGet`/`safeSet`/`safeDel` - Unit tests pass with `ioredis-mock
  **Post-Mortem & Fix Analysis**:
  > Shipped. PR #1082: https://github.com/crbnos/carbon/pull/1082  **What shipped:** - `withRedis<T>(fn)` wrapper: catches `IORedisError`, short-circuits on unhealthy state, uses 500ms command timeout - Debounced `logDegraded` / `logRecovered` (5s cooldown) so logs don't spam on flapping - `safeGet` / `safeSet` / `safeDel` convenience helpers that call through `withRedis` - 62-test ioredis-mock suite covering normal ops, Redis-down fallback, timeout, and recovery - All re-exported from `@carbon/kv` index — zero consumer call sites changed  Typecheck (tsgo) + biome lint clean. Checks passing. Ready for review.
  > 🤖 **Carbon Agent starting build**  Building [#1077 — Redis resilience: wrapper + tests in @carbon/kv (foundation)](https://github.com/crbnos/carbon/issues/1077).  **Plan:** - Add `withRedis<T>(fn, fallback)` helper in `packages/kv/src/client.ts` with 500ms per-call timeout and full error catch - Add convenience wrappers: `safeGet`, `safeSet`, `safeDel`   - Export from `packages/kv/src/index.ts` - Unit tests with `ioredis-mock`: normal path, Redis-down fallback, recovery - No consumer migrations in this PR (foundation only)  Part of epic #1076 resilience series.
  > ✅ **Build shipped — PR ready for review**  PR: https://github.com/crbnos/carbon/pull/1082  **What was built:** - `withRedis<T>(fn, fallback)` helper in `packages/kv/src/client.ts` — 500ms per-call timeout, catches all Redis errors (ECONNREFUSED, timeouts, offline queue full), returns fallback without throwing - Debounced `logDegraded`/`logRecovered` logger (once per 10s, not per request) - `safeGet`, `safeSet`, `safeDel` convenience wrappers, all using `withRedis` internally - All four exported from `packages/kv/src/index.ts` - `packages/kv/src/client.test.ts` — ioredis-mock vitest suite (62 tests) covering: normal path, Redis-down fallback, 500ms timeout, recovery - No consumer call sites changed (foundation only, as specified)  **Gates:** lint ✓, conformance ✓, clobbers ✓, typecheck ✓, unit tests ✓  **Iterations:** 6 (checkpoints to keep final state clean) **Review requested from:** @barbinbrad

- **Issue #1076** (2026-07-06): **Redis downtime kills the entire app (critical resilience vulnerability)**
  *Symptoms*: ## Problem  `@carbon/kv` exposes a single global `ioredis` client (`packages/kv/src/client.ts`) used across the app for permission-claim caching (`packages/auth/src/services/users.server.ts`), login/API rate limiting (`packages/kv/src/ratelimit/`), print caching (`packages/printing/src/cache.server.ts`), session/verification/passkey flows (`packages/auth/src/services/`), and edge-function rate limiting (`packages/database/supabase/functions/lib/ratelimit.ts`).  Almost every consumer `await`s a Redis command directly with no try/catch and no fallback. When Redis is unreachable, the client exhausts its 3 retries and rejects; that rejection propagates up. Because `getClaims` runs on effectively every authenticated request, a Redis outage turns into a full application outage rather than degraded service.  There is no circuit breaker, no read-through to the source of truth, and no health signal. Any Redis crash, OOM kill, container restart, memory exhaustion, or app↔Redis network partition takes the whole app down.  ## Impact  - **Severity:** Critical — single point of failure for a multi-tenant production app. - **Blast radius:** Full outage across all users and all tenants; not scoped to one module. - **Triggers:** Redis crash, OOM kill, container/host restart, Redis memory exhaustion, network partition. - **Current behavior:** Redis-dependent code paths reject/hang; auth claim lookup fails → 5xx on nearly every request. - **Expected behavior:** App degrades gracefully — cache m
  **Post-Mortem & Fix Analysis**:
  > ## Decomposition  This is epic-sized (`complexity: critical`) — breaking into 5 ordered child issues. Landing order matters: the foundation wrapper must ship first; the consumer migrations and health endpoint can run in parallel after that.  **Child issues (in dependency order):**  1. **#1077** — Resilient wrapper + tests in `@carbon/kv` (foundation — no consumer changes yet) 2. **#1078** — Auth path migration: `getClaims`, session, verification, passkey (highest blast radius, ship first) 3. **#1079** — Rate-limiter fail-safe: app + edge function (security trade-off documented) 4. **#1080** — Remaining cache consumers: printing, ERP server files 5. **#1081** — Health endpoint + observability (can run parallel to 2-4 after 1 lands)  Building #1077 first.
  > 🤖 **Progress update — Phase 1 of 5 complete**  The foundation PR for this resilience epic has shipped:  - **#1077 → PR #1082** — `withRedis` wrapper + `safeGet`/`safeSet`/`safeDel` + ioredis-mock unit tests in `@carbon/kv`   - Status: ✅ Ready for review (@barbinbrad)  **Remaining child issues (in order):** - #1078 — Auth path migration (getClaims + session/verification/passkey) - #1079 — Rate-limiter fail-safe (app + edge function)   - #1080 — Remaining cache consumers (printing, ERP server files) - #1081 — Health endpoint + observability  Each child builds on the foundation from #1082. Recommend reviewing and merging the foundation PR before dispatching #1078.

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

### Incident Patch 1: `9375d451` (2026-09-30)
**Commit Message**: fix(ramp): link spend vendors to the seat-holder's accounting vendor (#1779)

In push-only mode Rillet holds Ramp's accounting seat, and bills reached Ramp
with "Accounting Merchant" empty: Carbon matched or created a bill-pay vendor
but never set its `accounting_vendor_remote_id`. The vendor resolver now reads
the seat-holder's vendor mapping and adopts the Ramp vendor already linked to
it, or links the matched/created vendor via PATCH /vendors/{id} (best-effort,
never in the create body). The link is recorded on the ramp vendor mapping so
steady state costs no Ramp call. Provider mode is unchanged.

The ladder is extracted as the pure `decideRampSpendVendor`, with tests.
Adds scripts/ramp-bill-probe.ts, a read-only diagnostic for what Ramp stored
on a pushed draft bill.

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `.claude/rules/ramp-integration.md` (modified, +13/-0)
```diff
@@ -800,6 +800,19 @@ keyset helpers and its two metadata cursors are gone.
   pushed this way reads back with `provider_name: "RILLET"`.
   `GET /developer/v1/bills/drafts/{id}` DOES exist and returns the stored coding,
   which is how this was confirmed.
+- **The vendor is the seat-holder's too.** A bill's "Accounting Merchant" comes from
+  the Ramp vendor's `accounting_vendor_remote_id`, and a vendor Carbon creates or
+  matches has none — so in push-only every bill arrived with it empty even though the
+  lines were coded. `decideRampSpendVendor` (`lib/spend.ts`, pure, tested) reads the
+  seat-holder's vendor mapping (`rillet` / `vendor`) and: adopts the Ramp vendor that
+  accounting vendor is ALREADY linked to (Ramp allows one); else links the mapped /
+  matched / newly created vendor with `PATCH /vendors/{id}`. The link is a separate,
+  best-effort call — never in the create body — so a refused link cannot fail the bill.
+  A vendor a human linked to a DIFFERENT accounting vendor is left alone. The link is
+  recorded on the `ramp` vendor mapping's `metadata.accountingVendorRemoteId`, so a
+  linked supplier costs no Ramp call afterwards. <!-- UNVERIFIED: not yet live-tested
+  that Ramp's accounting-vendor remote id equals the Rillet vendor id Carbon stores
+  (the account ids do match — see above). -->
 - **A delegated family's OWNER keeps its own entities.** `applyLedgerDelegation`
   takes the `integrationId` whose config is being resolved; without it, resolving
   Ramp's config disabled Ramp's `bill` entity (Ramp owns `ap` in push-only), so the
```

**File**: `packages/ee/src/ramp/entities/bill.ts` (modified, +25/-13)
```diff
@@ -35,7 +35,10 @@ import { isPushableInvoiceStatus } from "../../spend/gates";
 import { describeMissingVendorFields } from "../../spend/parties";
 import { buildRampIdempotencyKey } from "../lib/client";
 import { buildLineCodingSelections } from "../lib/coding";
-import { resolveOrCreateRampSpendVendor } from "../lib/spend";
+import {
+  prepareRampVendorResolution,
+  resolveOrCreateRampSpendVendor
+} from "../lib/spend";
 import { RampPushOnlyEntitySyncer } from "./shared";
 
 export type RampBillRemote = {
@@ -146,14 +149,34 @@ export class RampBillSyncer extends RampPushOnlyEntitySyncer<
   }
 
   protected async mapToRemote(local: SpendBillSource): Promise<RampBillRemote> {
+    /**
+     * Whose identifiers Ramp's coding options — and its accounting vendors —
+     * are keyed by.
+     *
+     * When another system holds Ramp's accounting seat it published the
+     * options, so the mappings to read are ITS (`rillet`'s account → its
+     * external id), and the external id is what Ramp knows the option by.
+     * Reading Ramp's own mappings there finds nothing — Carbon never pushed a
+     * chart of accounts in that mode — so every line degraded to uncoded and the
+     * bill landed needing manual coding before the seat-holder could post it.
+     * The same system owns the accounting vendor the bill posts against, so the
+     * Ramp vendor is linked to ITS vendor id too.
+     */
+    const delegatedTo = this.rampProvider.codingIdentityIntegrationId;
+
     // A bill REQUIRES a vendor_id, unlike a PO where it is optional — so Ramp's
     // own rejection is the only actionable diagnosis and must not be swallowed.
     const vendorId = await resolveOrCreateRampSpendVendor(
       this.mappingService,
       this.ramp,
       local.supplier,
       this.companyId,
-      undefined,
+      await prepareRampVendorResolution(
+        this.mappingService,
+        this.ramp,
+        [local.supplier],
+        { accountingIntegration: delegatedTo }
+      ),
       { surfaceCreateError: true }
     );
     if (!vendorId) {
@@ -166,17 +189,6 @@ export class RampBillSyncer extends RampPushOnlyEntitySyncer<
       );
     }
 
-    /**
-     * Whose coding options these lines address.
-     *
-     * When another system holds Ramp's accounting seat it published the options,
-     * so the mappings to read are ITS (`rillet`'s account → its external id), and
-     * the external id is what Ramp knows the option by. Reading Ramp's own
-     * mappings there finds nothing — Carbon never pushed a chart of accounts in
-     * that mode — so every line degraded to uncoded and the bill landed needing
-     * manual coding before the seat-holder could post it.
-     */
-    const delegatedTo = this.rampProvider.codingIdentityIntegrationId;
     const pushed = await loadPushedCoding(
       this.mappingService,
       delegatedTo ?? "ramp",
```

**File**: `packages/ee/src/ramp/entities/purchase-order.ts` (modified, +17/-2)
```diff
@@ -27,6 +27,7 @@ import {
 import { buildRampIdempotencyKey, RampApiError } from "../lib/client";
 import {
   prepareRampPurchaseOrderBatch,
+  prepareRampVendorResolution,
   type RampPurchaseOrderBatch,
   resolveOrCreateRampSpendVendor
 } from "../lib/spend";
@@ -131,7 +132,12 @@ export class RampPurchaseOrderSyncer extends RampPushOnlyEntitySyncer<
       [...orders.keys()],
       [...orders.values()]
         .filter((order) => !isSettledPurchaseOrderStatus(order.status))
-        .map((order) => order.supplier)
+        .map((order) => order.supplier),
+      // When another system holds Ramp's accounting seat, link each vendor to
+      // that system's accounting vendor — see `linkAccountingVendor`.
+      {
+        accountingIntegration: this.rampProvider.codingIdentityIntegrationId
+      }
     );
 
     return orders;
@@ -177,7 +183,16 @@ export class RampPurchaseOrderSyncer extends RampPushOnlyEntitySyncer<
           this.ramp,
           local.supplier,
           this.companyId,
-          this.batch
+          this.batch ??
+            (await prepareRampVendorResolution(
+              this.mappingService,
+              this.ramp,
+              [local.supplier],
+              {
+                accountingIntegration:
+                  this.rampProvider.codingIdentityIntegrationId
+              }
+            ))
         )) ?? undefined);
 
     return {
```

**File**: `packages/ee/src/ramp/lib/__tests__/spend.test.ts` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+import { describe, expect, it } from "vitest";
+import type { RampVendor } from "../models";
+import { buildRampVendorResolution, decideRampSpendVendor } from "../spend";
+
+/**
+ * The bug: in push-only mode Rillet holds Ramp's accounting seat, and Carbon
+ * pushed each bill against a Ramp vendor it matched or created — a bill-pay
+ * vendor with NO accounting vendor. Ramp showed the bill's "Accounting
+ * Merchant" empty, so someone had to pick the Rillet vendor by hand before
+ * Rillet could post it. The lines were already coded with Rillet's account
+ * ids; the vendor was the half Carbon never addressed by Rillet's id.
+ *
+ * These pin the DECISION; performing it (the PATCH, the mapping write) is glue.
+ */
+
+const supplier = { id: "sup_amazon", name: "Amazon" };
+const RILLET_VENDOR = "019f-rillet-amazon";
+
+const rilletMapping = { entityId: "sup_amazon", externalId: RILLET_VENDOR };
+const rampMapping = (
+  externalId: string,
+  metadata: Record<string, unknown> | null = null
+) => ({ entityId: "sup_amazon", externalId, metadata });
+
+function decide(args: {
+  vendorMappings?: ReturnType<typeof rampMapping>[];
+  delegated?: boolean;
+  vendors?: RampVendor[];
+}) {
+  return decideRampSpendVendor(
+    buildRampVendorResolution({
+      vendorMappings: args.vendorMappings ?? [],
+      accountingVendorMappings: args.delegated ? [rilletMapping] : [],
+      vendors: args.vendors
+    }),
+    supplier
+  );
+}
+
+describe("decideRampSpendVendor — Carbon holds the seat", () => {
+  it("uses a mapped vendor as-is", () => {
+    expect(decide({ vendorMappings: [rampMapping("rv_1")] })).toEqual({
+      action: "use",
+      vendorId: "rv_1"
+    });
+  });
+
+  it("matches by name without linking — Carbon publishes no accounting vendors", () => {
+    expect(decide({ vendors: [{ id: "rv_1", name: "Amazon" }] })).toEqual({
+      action: "match",
+      vendorId: "rv_1"
+    });
+  });
+});
+
+describe("decideRampSpendVendor — another system holds the seat", () => {
+  it("links a vendor Carbon mapped before linking existed", () => {
+    // Every install that pushed a bill before this change has a mapping with no
+    // link. The first push after it must repair the vendor, not skip it.
+    expect(
+      decide({
+        delegated: true,
+        vendorMappings: [rampMapping("rv_1")],
+        vendors: [{ id: "rv_1", name: "Amazon" }]
+      })
+    ).toEqual({ action: "match", vendorId: "rv_1", linkTo: RILLET_VENDOR });
+  });
+
+  it("uses the mapping alone once the link is recorded", () => {
+    expect(
+      decide({
+        delegated: true,
+        vendorMappings: [
+          rampMapping("rv_1", { accountingVendorRemoteId: RILLET_VENDOR })
+        ]
+      })
+    ).toEqual({ action: "use", vendorId: "rv_1" });
+  });
+
+  it("re-links when the seat-holder's vendor changed since the link was recorded", () => {
+    expect(
+      decide({
+        delegated: true,
+        vendorMappings: [
+          rampMapping("rv_1", { accountingVendorRemoteId: "019f-old" })
+        ],
+        vendors: [{ id: "rv_1", name: "Amazon" }]
+      })
+    ).toEqual({ action: "match", vendorId: "rv_1", linkTo: RILLET_VENDOR });
+  });
+
+  it("adopts the Ramp vendor the accounting vendor is already linked to", () => {
+    // Ramp allows an accounting vendor ONE linked vendor — typically one Ramp
+    // made from the seat-holder's own vendor sync. That is where this
+    // supplier's bills belong, even over a vendor Carbon mapped or created, and
+    // linking Carbon's instead would be refused as a second link.
+    expect(
+      decide({
+        delegated: true,
+        vendorMappings: [rampMapping("rv_carbon")],
+        vendors: [
+          { id: "rv_carbon", name: "Amazon" },
+          {
+            id: "rv_from_rillet",
+            name: "Amazon.com",
+            accounting_vendor_remote_id: RILLET_VENDOR
+          }
+        ]
+      })
+    ).toEqual({
+      action: "match",
+   
```

**File**: `packages/ee/src/ramp/lib/client.ts` (modified, +11/-0)
```diff
@@ -581,6 +581,17 @@ export class RampClient {
     });
   }
 
+  /**
+   * Update a Ramp SPEND vendor (`PATCH /developer/v1/vendors/{id}`). Carbon uses
+   * it for one field: `accounting_vendor_remote_id`, the link to the accounting
+   * vendor the seat-holder published — Ramp's documented way to join a bill-pay
+   * vendor to its GL vendor ("Creating a bill-pay vendor does not auto-create an
+   * accounting vendor. Link them explicitly via PATCH /vendors/{id}").
+   */
+  updateSpendVendor<T = unknown>(id: string, body: unknown): Promise<T> {
+    return this.request<T>("PATCH", `/developer/v1/vendors/${id}`, { body });
+  }
+
   // ---- Business entities (for the required PO `entity_id`) ----
 
   getEntities<T = unknown>(): Promise<T> {
```

---

### Incident Patch 2: `ec2565b1` (2026-09-30)
**Commit Message**: fix(agent): clear the chat error when starting or switching threads

useChat's stop() and setMessages() leave its error in place, so after a
failed request New chat and switching threads kept showing the old error
and its Retry. Both now call clearError().

**File**: `apps/erp/app/modules/agent/hooks/useAgentThread.ts` (modified, +5/-2)
```diff
@@ -167,16 +167,19 @@ export function useAgentThread() {
     ++loadSeq.current;
     unsentRef.current = null;
     void stop();
+    // stop() and setMessages() leave useChat's error in place.
+    clearError();
     setMessages([]);
     setSendError(null);
     setThread(null);
     threadIdRef.current = null;
-  }, [setMessages, setThread, stop]);
+  }, [clearError, setMessages, setThread, stop]);
 
   const loadThread = useCallback(
     async (id: string) => {
       const seq = ++loadSeq.current;
       void stop();
+      clearError();
       setSendError(null);
       setThread(id);
       threadIdRef.current = id;
@@ -193,7 +196,7 @@ export function useAgentThread() {
       if (seq !== loadSeq.current) return;
       setMessages(data.messages);
     },
-    [newThread, setMessages, setThread, stop]
+    [clearError, newThread, setMessages, setThread, stop]
   );
 
   // Resume the last chat when the panel opens: if it mounted with a persisted thread
```

---

### Incident Patch 3: `69e12568` (2026-09-30)
**Commit Message**: fix: stop duplicate writes from replayed submits and retries (#1772)

* fix: stop duplicate writes from replayed submits and retries

Finalizing a quote emailed the customer the same PDF three times. The action
renders a PDF, uploads it, writes a document row and sends the mail — seconds
during which the Finalize button stayed enabled and not even spinning, and
every extra click was a full POST the server ran to completion (fetcher.submit
aborts the browser request; no action reads request.signal).

Four layers could each replay a write:

- Button left isLoading out of the DOM disabled attribute while useShortcutKeys
  already treated it as disabling, so a spinning button refused Enter but took
  a mouse click — every isLoading={fetcher.state !== "idle"} guard in the repo
  was a spinner over a live button.
- ValidatedForm had no re-entry guard; it now drops a submit while one is in
  flight, so a form holds even when its button forgets.
- fetchWithRetry replayed every method on a 5xx or timeout. PostgREST commits
  before it answers, so a retried insert is a duplicate row and a retried rpc
  re-runs a transaction. The quoteToQuote incidents already produced this rule;
  the fix th

**File**: `.ai/lessons.md` (modified, +42/-0)
```diff
@@ -2589,3 +2589,45 @@ tracked file.
 **Applies to:** `packages/database/src/types.ts`,
 `packages/database/supabase/functions/lib/types.ts`,
 `apps/erp/app/routes/api+/mcp+/lib/tool-manifest.digest.json`, any generated artifact.
+
+---
+
+## A submit button that stays live is a duplicate-write engine
+
+**Context:** Finalizing quote Q000699 emailed the customer the same PDF three times within
+one minute, same recipient list each time. The finalize action evaluates sales rules across
+every line, renders a PDF, uploads it, writes a `document` row, flips the quote to `Sent`,
+renders two email bodies and signs an attachment URL before it triggers the send — seconds
+of wall time, during which `QuoteFinalizeModal`'s Finalize button was enabled and not even
+spinning (`isDisabled={loading}`, where `loading` was the modal's own data-fetch flag).
+
+**Problem:** Three layers of the same defect, and only the first is about a button.
+(1) `fetcher.submit` aborts the previous BROWSER request; the server action it started runs
+to completion regardless, because nothing in a route action reads `request.signal`. So N
+clicks are N complete sets of side effects. The guard had existed as `onSubmit={onClose}`
+(the modal unmounted before a second click was possible) and was dropped in `e59a9e26e2`
+when closing moved to `useRuleViolations({ onSuccess: onClose })` — correct on its own, since
+violations must be able to reopen the modal, but nothing replaced the guard.
+(2) `@carbon/react`'s `Button` left `isLoading` out of the DOM `disabled` attribute while
+`useShortcutKeys` already treated it as disabling — so a spinning button refused Enter but
+still took a mouse click, and every call site guarding a submit with
+`isLoading={fetcher.state !== "idle"}` was showing a spinner over a live button.
+(3) `fetchWithRetry` replayed every method on a 5xx or a 25 s timeout. PostgREST commits
+before it answers, so a retried insert is a duplicate row and a retried `.rpc()` re-runs a
+transaction. The `quoteToQuote` incidents had already produced the rule — *"a retry wrapper
+must never blindly retry a write with real side effects and no idempotency key"* — but the
+fix carved out only `/functions/v1/`, leaving every PostgREST write still replaying.
+
+**Rule:** A submit path needs a guard at each layer that can replay it. The button disables
+while its own submission is in flight (`<Submit>`, or `isLoading` bound to the fetcher's
+state); `ValidatedForm` drops a re-entrant submit so the form holds even when a button
+forgets; a retry wrapper replays only idempotent methods; and a job retries only failures
+that provably had no effect — for an SMTP send that means connect/greet/auth errors only,
+never an ambiguous `ETIMEDOUT` that may have been delivered. When triaging "the operation
+failed but extra copies appeared", check all four before assuming a browser double-submit.
+`isDisabled` bound to any-old-boolean is not a guard: name the submit state.
+
+**Applies to:** `packages/react/src/Button.tsx`, `packages/form/src/ValidatedForm.tsx`,
+`packages/auth/src/lib/supabase/client.ts` (`fetchWithRetry`, `isReplayable`),
+`packages/jobs/src/inngest/functions/notifications/send-{email,slack}.ts`, and any
+`<Button type="submit">` — enforced by `no-unguarded-submit` (`@carbon/checks`).
```

**File**: `.claude/rules/conventions-forms.md` (modified, +13/-0)
```diff
@@ -180,6 +180,19 @@ const ThingForm = ({ initialValues, type = "drawer", open, onClose }: ThingFormP
 - `VStack spacing={4}` for vertical layout; `grid grid-cols-1 lg:grid-cols-3
   gap-x-8 gap-y-4` for multi-column.
 - Permission check drives `isDisabled` on `<Submit>`.
+- **A submit button must disable while its own submission is in flight.** Inside a
+  `ValidatedForm` use `<Submit>`, which disables on `isSubmitting`; the form itself
+  also drops a re-entrant submit, so the two together make a double POST impossible.
+  On a `fetcher.Form` / `<Form>` bind the button yourself —
+  `isLoading={fetcher.state !== "idle"}` (on `@carbon/react`'s `Button`, `isLoading`
+  disables as well as spins), or `navigation.formAction === <action>` for a
+  navigation form. Every extra click is a whole extra POST: `fetcher.submit` aborts
+  the previous browser request, but the server action it started runs to completion
+  — nothing reads `request.signal`. A slow action (render a PDF, post a ledger entry,
+  email a customer) is exactly where this bites, and the missing spinner is what
+  invites the second click. Enforced by `no-unguarded-submit` (`@carbon/checks`);
+  note that an `isDisabled` bound to something that is not a submit-state signal
+  does NOT count.
 - Pass `fetcher` from `useFetcher()` when the form is a drawer/modal (so loading
   state and action data flow through the fetcher); plain page forms may omit it.
 
```

**File**: `apps/erp/app/modules/inventory/ui/PickingLists/PickingListsHeader.tsx` (modified, +3/-1)
```diff
@@ -12,7 +12,7 @@ import {
 } from "@carbon/react";
 import { Trans, useLingui } from "@lingui/react/macro";
 import { LuClipboardList, LuPackagePlus, LuSettings2 } from "react-icons/lu";
-import { Form, Link } from "react-router";
+import { Form, Link, useNavigation } from "react-router";
 import { SearchFilter } from "~/components";
 import { useLocations } from "~/components/Form/Location";
 import { usePermissions } from "~/hooks";
@@ -49,6 +49,7 @@ export function PickingListsHeader({
 }: PickingListsHeaderProps) {
   const { t } = useLingui();
   const permissions = usePermissions();
+  const navigation = useNavigation();
   const locations = useLocations();
 
   return (
@@ -78,6 +79,7 @@ export function PickingListsHeader({
               type="submit"
               leftIcon={<LuPackagePlus />}
               isDisabled={!permissions.can("create", "inventory")}
+              isLoading={navigation.formAction === path.to.newPickingList}
             >
               <Trans>Generate Picking List</Trans>{" "}
               {selectedJobOperationIds.length}
```

**File**: `apps/erp/app/modules/sales/ui/Quotes/QuoteFinalizeModal.tsx` (modified, +6/-1)
```diff
@@ -66,6 +66,7 @@ const QuotationFinalizeModal = ({
     onSuccess: onClose
   });
   const { fetcher } = ruleViolations;
+  const isSubmitting = fetcher.state !== "idle";
 
   const integrations = useIntegrations();
   const canEmail = integrations.has("email");
@@ -248,7 +249,11 @@ const QuotationFinalizeModal = ({
             <Button variant="secondary" onClick={onClose}>
               <Trans>Cancel</Trans>
             </Button>
-            <Button isDisabled={loading} type="submit">
+            <Button
+              isDisabled={loading || isSubmitting}
+              isLoading={isSubmitting}
+              type="submit"
+            >
               <Trans>Finalize</Trans>
             </Button>
           </ModalFooter>
```

**File**: `apps/erp/app/modules/sales/ui/SalesRFQ/SalesRFQHeader.tsx` (modified, +1/-0)
```diff
@@ -177,6 +177,7 @@ const SalesRFQHeader = () => {
           )}
 
           <Button
+            isLoading={statusFetcher.state !== "idle"}
             isDisabled={
               status !== "Ready for Quote" ||
               routeData?.lines?.length === 0 ||
```

---

### Incident Patch 4: `aa42aba9` (2026-09-30)
**Commit Message**: fix(purchasing): one PO per supplier when creating orders from Material Planning (#1776)

**File**: `.claude/rules/mrp-system.md` (modified, +6/-3)
```diff
@@ -205,9 +205,12 @@ All join through `itemReplenishment` to expose `replenishmentSystem`, `leadTime`
   - production (`create: "production"`, role `employee`): inserts jobs +
     job methods, upserts `supplyForecast` (`'Production Order'`), then
     `recalculateJobRequirements()`.
-  - purchasing (`create: "purchasing"`, role `employee`): inserts purchase
-    orders/lines grouped by supplier+period, upserts `supplyForecast`
-    (`'Purchase Order'`).
+  - purchasing (`create: "purchasing"`, role `employee`): one PO per supplier
+    per submit — reuses the supplier's open Draft/Planned `Purchase` PO whose
+    delivery location is the planning location (header lookup, not a
+    line-in-period match), else inserts one. Lines are matched on item +
+    `requiredDate`, so orders for different weeks stay as separate lines on
+    the same PO. Upserts `supplyForecast` (`'Purchase Order'`) per order period.
 
 ## Gotchas
 
```

**File**: `apps/erp/app/routes/x+/purchasing+/planning.update.tsx` (modified, +167/-61)
```diff
@@ -144,13 +144,15 @@ export async function action({ request }: ActionFunctionArgs) {
         }> = [];
 
         // Separate existing-line updates from new orders, and group new
-        // orders by supplier+period so each period gets its own PO.
+        // orders by supplier so every supplier gets exactly one PO per
+        // submit. Each line keeps its own requiredDate, so per-period timing
+        // lives on the lines rather than on separate headers.
         type OrderEntry = {
           itemId: string;
           order: (typeof itemsToOrder)[0]["orders"][0];
         };
         const existingLineUpdates: OrderEntry[] = [];
-        const ordersBySupplierPeriod = new Map<string, OrderEntry[]>();
+        const ordersBySupplier = new Map<string, OrderEntry[]>();
         const errors: string[] = [];
 
         for (const item of itemsToOrder) {
@@ -164,11 +166,10 @@ export async function action({ request }: ActionFunctionArgs) {
               existingLineUpdates.push({ itemId: item.id, order });
               itemHasUsableOrder = true;
             } else if (order.supplierId && order.periodId) {
-              const key = `${order.supplierId}::${order.periodId}`;
-              if (!ordersBySupplierPeriod.has(key)) {
-                ordersBySupplierPeriod.set(key, []);
+              if (!ordersBySupplier.has(order.supplierId)) {
+                ordersBySupplier.set(order.supplierId, []);
               }
-              ordersBySupplierPeriod.get(key)!.push({
+              ordersBySupplier.get(order.supplierId)!.push({
                 itemId: item.id,
                 order
               });
@@ -182,6 +183,18 @@ export async function action({ request }: ActionFunctionArgs) {
           }
         }
 
+        logger.info("Planning order request grouped by supplier", {
+          companyId,
+          userId,
+          locationId,
+          itemCount: itemsToOrder.length,
+          existingLineUpdates: existingLineUpdates.length,
+          suppliers: Array.from(ordersBySupplier, ([supplierId, orders]) => ({
+            supplierId,
+            orderCount: orders.length
+          }))
+        });
+
         // bypassRls hands back the service role, and every id below comes
         // from the request body: the location, items and existing lines must
         // belong to this company before anything is read or written by them
@@ -229,7 +242,7 @@ export async function action({ request }: ActionFunctionArgs) {
           );
         }
 
-        const [suppliers, supplierParts, periods, company, currencies] =
+        const [suppliers, supplierParts, company, currencies] =
           await Promise.all([
             client
               .from("supplier")
@@ -241,7 +254,6 @@ export async function action({ request }: ActionFunctionArgs) {
               .select("*")
               .in("itemId", Array.from(itemIds))
               .eq("companyId", companyId),
-            client.from("period").select("*").in("id", Array.from(periodIds)),
             client
               .from("company")
               .select("id, baseCurrencyCode")
@@ -278,17 +290,6 @@ export async function action({ request }: ActionFunctionArgs) {
           );
         }
 
-        if (periods.error) {
-          logger.error("Failed to fetch periods", { error: periods.error });
-          return data(
-            {
-              success: false,
-              message: "Failed to retrieve period information from database"
-            },
-            { status: 500 }
-          );
-        }
-
         if (company.error) {
           logger.error("Failed to fetch company", { error: company.error });
           return data(
@@ -326,68 +327,104 @@ export async function action({ request }: ActionFunctionArgs) {
             .eq("id", order.existingLineId!)
             .eq("companyId", companyId);
           if (updateLine.error) {
+            logger.error("Failed to update existing PO line", {
+              companyId,
+             
```

---

### Incident Patch 5: `95b1c761` (2026-09-30)
**Commit Message**: fix(agent): server-owned history, AI SDK v7, retention and cleanup (#1774)

* fix(agent): the server owns the conversation history

The chat route fed the model whatever message history the browser posted
(validated as z.array(z.any())), so a client could inject a system message or
fabricate tool results and past answers. The saved thread was write-only.

- The browser sends only its new question (or a retry trigger) plus the thread
  id. The route checks the thread belongs to the caller (404 otherwise), saves
  the question, and builds the model's history from the stored thread:
  user and assistant text only, with an unanswered question dropped unless it
  is the one being answered (the production "two questions in a row" failure).
- Saving a question and saving an answer each run in one Kysely transaction;
  the old compensating deletes were RLS no-ops (no DELETE policy). A failed
  turn saves nothing; a stopped turn keeps its complete parts as "aborted".
- The answer's id is minted by the server and is its row id, so feedback
  targets that exact answer instead of "the latest one".
- The error banner offers Retry (regenerate), which answers the stored
  unanswered question. A t

**File**: `.ai/plans/2026-09-30-agent-cleanup.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Agent: refactor and cleanup (pass 2)
+
+Branch `fix/agent-server-history`, after the AI SDK v7 upgrade. Behaviour is preserved except
+where a line says otherwise.
+
+## Tasks
+
+- [x] **Delete the v2 data-tool scaffolding** (user decision). `agent.config.ts`, the
+  `search_tools` / `describe_tool` / `call_tool` tools, the v2 prompt branch, the tool
+  metadata imports, `agent.tools.test.ts` (it only tested the gated tools). Git history
+  keeps it; v2 needs an approval-gate design anyway.
+- [x] **One place turns stored rows into messages.** `agent.history.ts` gets
+  `toDisplayMessages` next to `buildModelHistory`; the thread loader returns UIMessages, and
+  `useAgentThread` drops its own `DbPart` types, `reconstructMessages` and the cast.
+- [x] **navigate reports what happened.** The tool resolves the page on the server
+  (`resolvePage`, params URL-encoded) and returns `{ url }` or an error the model can act on;
+  the browser navigates to the returned url. Before: always `{ navigated: true }`.
+- [x] **Today's date in the company timezone** in the system prompt (`datetime.today(tz)`),
+  not `new Date()` (UTC, banned server-side).
+- [x] **Split the engine from data access.** `agent.service.ts` keeps thread/message reads
+  and writes; the streaming turn, titling, persistence and rate limit move to
+  `agent.server.ts` (server-only, not in the barrel).
+- [x] **Titling from the loaded history**, not two more queries.
+- [x] **Routes log and report failures** (`threads.ts` create/delete/list).
+- [x] Typecheck, agent tests, biome; live check: ask, follow-up, navigate, history, feedback.
+- [x] Update `agent-knowledge-base.md` / `chat-ai-sdk-info.md`.
+
+Found on the way: the MRP v2 spec planned to enable the removed data tools; its two lines
+now point at the deleting commit (user confirmed the deletion). The dev block viewer's
+Navigate fixture was already broken (old input shape) and is removed.
+
+Not in this pass: translating the panel's strings (Lingui) — say so to the user.
+
+## Follow-up fixes (same day)
+
+- [x] 429 recovery: the panel shows the server's message; Retry sends the question and the
+  route saves it when the first attempt never stored it. Verified live (rate limit hit, then
+  Retry saved and answered once).
+- [x] Long threads: reads capped at 200 newest messages; model history text-only, panel
+  text + UI blocks (PostgREST embedded filters, verified live incl. a present_link part).
+- [x] Retention 7 days (user decision); purge extracted to `agent-thread-retention.ts`,
+  activity filtered in the query, ordered, batched until drained. Verified on real rows:
+  stale and empty-old purged, old-but-active and new kept, no orphans, second run 0.
+- Follow-up, not done: `agentMessagePart` RLS calls `auth.uid()` per row (not wrapped in
+  `select`); needs an authz-manifest change.
+
+## CodeRabbit review on #1774 (all five fixed, each verified live)
+
+- [x] `present_choice` kept in model history as text (a choice-only turn no longer drops
+  its question); history query loads choice parts. Live: the pick resolved against the
+  original question.
+- [x] Retry reuses the stored question only when the text matches; otherwise saves the
+  retried one. Live: A stored unanswered, retry B → B saved and answered.
+- [x] Purge deletes each batch in one statement on `(companyId, id)`. Live: 2 stale purged
+  in one delete, old-but-active kept, second run 0.
+- [x] A failed thread creation shows the error + Retry under the greeting; Retry resends
+  the unsent question. Live via a patched 500.
+- [x] New chat invalidates a pending thread load. Live with a 3 s delayed load + control.
```

**File**: `.ai/plans/2026-09-30-agent-server-history.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# Agent: server-owned history (pass 1 — correctness and security)
+
+Branch `fix/agent-server-history`. Source: the read-only review of the agent layer
+(2026-09-30). Decision: the existing `agentThread` / `agentMessage` / `agentMessagePart`
+tables are the source of truth for what the model sees; the browser sends only its new
+message.
+
+## Tasks
+
+- [x] **Chat request carries one message.** `chatRequest` = `{ threadId, trigger, text?, context? }`
+  with length caps. `useAgentThread`'s transport sends the last user message's text, or
+  `trigger: "regenerate-message"` and no text for a retry.
+- [x] **Thread ownership up front.** The chat route reads the thread under `companyId` +
+  `userId` and 404s a missing or foreign one. `thread.$threadId` 404s too. The browser
+  aborts a send when the thread cannot be created instead of spawning orphan threads.
+- [x] **History from the database.** `buildModelHistory` (`agent.history.ts`, pure): user and
+  assistant TEXT only, an unanswered user message dropped unless it is the last one, then
+  the char-budget window. Replaces `compactEarlierToolOutputs` and client history.
+- [x] **One transaction per write.** `saveUserMessage` and `persistAssistantTurn` run in a
+  Kysely transaction (`db` passed from the route). Nothing is persisted for a turn that
+  errored or produced no parts; an aborted turn keeps its complete parts with
+  `finishReason: "aborted"`.
+- [x] **Assistant ids match rows.** `generateMessageId` mints the `agm…` id the row is
+  inserted with; feedback posts that `messageId`, not "latest assistant message".
+- [x] **Stream hygiene.** `abortSignal: request.signal`, `consumeSseStream: consumeStream`,
+  a masked `onError` message, titling started in parallel with the answer.
+- [x] **Retry.** The error banner offers Retry (`regenerate()`); the server answers the
+  stored unanswered question without saving a new one.
+- [x] **Stop after choices.** `stopWhen` includes `hasToolCall("present_choice")`.
+- [x] **Thread switching.** `loadThread` stops an active stream and ignores stale responses.
+- [x] Tests for every pure piece; typecheck ERP; rules updated.
+
+## Verification
+
+`apps/erp`: `pnpm exec vitest run app/modules/agent`, `pnpm exec tsgo --noEmit`.
```

**File**: `.ai/plans/2026-09-30-ai-sdk-v7.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+# AI SDK 5 → 7
+
+Branch `fix/agent-server-history` (on top of the server-owned history change). Guides:
+ai-sdk.dev migration 5→6 and 6→7.
+
+## Versions (one consistent set, all on `@ai-sdk/provider-utils` 5.0.49, released 2026-09-25)
+
+| Package | From | To | Where |
+|---|---|---|---|
+| `ai` | 5.0.172 | 7.0.116 | erp, ee, jobs — moved to the pnpm catalog |
+| `@ai-sdk/openai` | 2.0.102 | 4.0.78 | catalog |
+| `@ai-sdk/anthropic` | 2.0.74 | 4.0.65 | erp — moved to the catalog |
+| `@ai-sdk/react` | 2.0.174 | 4.0.119 (pins `ai` 7.0.116) | erp — moved to the catalog |
+
+Remove the six unused `@ai-sdk-tools/*` packages (no imports; they came with #1659) and
+their patch (`patches/@ai-sdk-tools__store@1.2.0.patch` + `patchedDependencies`).
+
+Runtime: v7 needs Node ≥ 22 and is ESM-only. Docker images and CI use Node 22; erp, ee and
+jobs are `"type": "module"`. **The Vercel project's Node version is not in the repo — it
+must be 22.x before this ships.**
+
+## Tasks
+
+- [x] Bump deps (bare `pnpm install`), drop `@ai-sdk-tools/*` and the patch.
+- [x] Agent stream (`agent.service.ts`): `system` → `instructions`, `stepCountIs` →
+  `isStepCount`, `onFinish` → `onEnd`, `totalUsage` → `usage`, `cachedInputTokens` →
+  `inputTokenDetails.cacheReadTokens`, `toUIMessageStreamResponse` →
+  `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream, … }) })`,
+  `await convertToModelMessages`.
+- [x] Tool-part helpers (`isToolUIPart` / `getToolName` now cover dynamic tools too) in
+  `agent.service.ts`, `AgentMessage.tsx`, `useAgentThread.ts`.
+- [x] Title generation (`generateText`): `system`/`prompt` per v7.
+- [x] `generateObject` → `generateText({ output: Output.object({ schema }) })` at all seven
+  call sites: inspection balloon analysis, CSV column mapping, quote drag filename parse,
+  ee account mapping, ee Paperless Parts (2), jobs onboarding.
+- [x] `useChat` / `DefaultChatTransport` (`@ai-sdk/react` 4): transport options,
+  `regenerate`, `clearError`, `stop`, status names.
+- [x] Typecheck erp, ee, jobs; agent + catalog tests; biome; ERP production build.
+- [x] Live run of the agent (search, follow-up, Stop, Retry, thread switch, feedback, navigate)
+  and all seven structured schemas against OpenAI. Found: strict mode refused the CSV route's
+  `.partial()` schema (fixed to one `z.string()` per field).
+- [x] Rules: `chat-ai-sdk-info.md` / `agent-knowledge-base.md` reflect v7 names.
```

**File**: `.ai/specs/2026-08-22-mrp-v2-planned-order-generation.md` (modified, +5/-4)
```diff
@@ -365,8 +365,9 @@ Three deterministic layers plus the agent:
   planner's `reviewedAt` marks: *"Since your last review: 3 new, 2 rescheduled in,
   1 canceled — latest cause: SO-1042 quantity changed."* Nervousness becomes something
   planners watch, not fear.
-- **Ask the plan (agent data tools)** — flip `AGENT_DATA_TOOLS_ENABLED = true`
-  (`apps/erp/app/modules/agent/agent.config.ts`). The mechanism is already built:
+- **Ask the plan (agent data tools)** — the gated data tools were REMOVED from the agent on
+  2026-09-30 (they had never shipped); restore them from the commit that deleted them
+  (`git log -S AGENT_DATA_TOOLS_ENABLED`) rather than flipping a flag. As they were built:
   `search_tools`/`describe_tool`/`call_tool` execute READ-classified MCP tools via the
   direct executor. v1 work: ensure the new planning reads (`getPlannedOrders`,
   `getPlannedOrderCascade`, `getItemTimePhasedPlan`, `getPlanningRun`) are
@@ -878,8 +879,8 @@ rows with `forecastMethod = 'suggested'`).
 
 **Agent (`apps/erp/app/modules/agent`)**
 
-- Flip `AGENT_DATA_TOOLS_ENABLED = true` (READ-only classification + blocklist already
-  enforced by the direct executor). Verify the new planning service reads are
+- Restore the agent data tools (removed 2026-09-30, see "Ask the plan" above) and enable
+  them (READ-only classification + blocklist enforced in the tool itself). Verify the new planning service reads are
   READ-classified in `tool-metadata.json` (regen via `pnpm run generate:mcp`); add a
   planning-concepts docs page so the KB regeneration teaches the agent the standard
   terminology.
```

**File**: `.claude/rules/agent-knowledge-base.md` (modified, +38/-2)
```diff
@@ -57,8 +57,44 @@ later step. `read_doc` returns one section for a `#anchor` url, a short page who
 (≤ 12k chars), and a long page as its intro plus section links. Section anchors are the
 site's own (`headingAnchor`, github-slugger rules incl. `-1` suffixes), pinned by
 `links.test.ts`; the size bound on every page and section read is pinned by
-`agent.kb.test.ts`. `read_doc` and `search_docs` results from EARLIER turns are compacted to
-titles and urls before each request (`compactEarlierToolOutputs`, `agent.history.ts`).
+`agent.kb.test.ts`.
+
+The agent is read-only and docs-only: its tools are `search_docs`, `read_doc`,
+`find_page`, `navigate` and three UI blocks (`agent.tools.ts`). It has no tool that reads
+the customer's data. `navigate` resolves the page key on the server (`resolvePage`,
+`agent.pages.ts`, params URL-encoded) and returns `{ url }` or an error the model sees; the
+browser only follows a returned `/x/` url.
+
+The conversation is server-owned: the browser sends only its new question (or a retry
+trigger) and the thread id, and the chat route checks the thread is the caller's, saves the
+question in a Kysely transaction, and builds the model's history from the stored thread.
+`agent.history.ts` is the one place stored rows and messages convert:
+`buildModelHistory` (user and assistant TEXT only, so earlier tool results never ride
+along — except a `present_choice`, kept as `[Choices offered: …]` text, since the user's
+pick arrives as the next question and means nothing without it — and an unanswered
+question is dropped unless it is the one being answered),
+`toDisplayMessages` (text plus UI blocks, what the thread loader returns to the panel) and
+`toStoredParts` (an answer's text and finished tool calls, never `navigate`). Nothing the
+browser holds reaches the model. The answer is saved in one transaction under the id the
+server minted for it (`generateMessageId`), which is what feedback targets; a failed turn
+saves nothing and Retry answers the stored question.
+
+Thread reads are capped at the newest `MAX_THREAD_MESSAGES` (200) and filtered in
+PostgREST: the model's history reads text and `present_choice` parts, the panel reads text
+and UI-block parts, so read-tool outputs (the bulk of a thread's bytes) are never loaded
+per request. A Retry sends the question's text as well; the chat route answers the stored
+unanswered question only when its text matches, and otherwise saves and answers the sent
+one (it was refused before saving — the rate limit runs first — possibly after an older
+question failed). A question whose thread could not even be created never reached the
+server; the panel keeps it and Retry resends it. Threads are purged 7 days after their last message by
+`purgeStaleAgentThreads` (`packages/jobs/.../scheduled/agent-thread-retention.ts`, called
+from the daily `cleanup` cron), which tests activity inside its query so every batch
+advances, and deletes each batch in one statement on `(companyId, id)`.
+
+`agent.service.ts` is data access only (threads, messages, feedback, the two Kysely
+writes). The turn itself (`streamChat`, titling, the rate limit) is `agent.server.ts`,
+server-only and outside the module barrel. The system prompt takes today's date in the
+company's timezone.
 
 The model is `agentChatModel` in `packages/utils/src/llm.ts` (`gpt-4.1-mini`). It was plain
 `gpt-4` — an 8k-token window — and a single long page overflowed it
```

---

### Incident Patch 6: `2b3d0921` (2026-09-30)
**Commit Message**: fix(nav): tapping a menu on a collapsed rail no longer expands it

**File**: `packages/react/AGENTS.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ import { Button, Card, HStack, VStack, IconButton, cn } from "@carbon/react";
 - **Choice screens**: `ChoiceCardGroup` (card radios, `autoFocus` focuses the selected card) and `RadioGroupButton` (radio styled as a secondary Button) give one tab stop + arrow-key select; Enter stays free for the screen's continue action
 - **Layout**: `VStack` / `HStack` with numeric `spacing` prop (maps to `space-y-*`/`space-x-*`)
 - **Overlays**: `Drawer`, `Modal`, `ModalDrawer` (unified drawer/modal), `BottomSheet`, `Popover`
-- **App nav**: `NavRail` is the primary left nav of both the ERP and MES shells (56px icon rail, expands after a 150ms mouse hover or when pinned via `SidebarProvider`/⌘B, left drawer below md that closes itself on navigation). Optional `header` (use `NavRailBrand` for a logo + name) and `footer` slots; `NavRailGroup` adds a titled section that shows as a divider while collapsed. Entries are `NavRailItem` (a button, or `asChild` for a trigger/link) and `NavRailLink`; `label` is a string and doubles as the accessible name. A Radix menu/popover opened from a `NavRailItem` holds the rail expanded until it closes. Render inside `SidebarProvider`; the shadcn-style `Sidebar*` primitives remain for other layouts
+- **App nav**: `NavRail` is the primary left nav of both the ERP and MES shells (56px icon rail, expands after a 150ms mouse hover or when pinned via `SidebarProvider`/⌘B, left drawer below md that closes itself on navigation). Optional `header` (use `NavRailBrand` for a logo + name) and `footer` slots; `NavRailGroup` adds a titled section that shows as a divider while collapsed. Entries are `NavRailItem` (a button, or `asChild` for a trigger/link) and `NavRailLink`; `label` is a string and doubles as the accessible name. A Radix menu/popover opened from a `NavRailItem` keeps the rail as it was (open or collapsed) until it closes. Render inside `SidebarProvider`; the shadcn-style `Sidebar*` primitives remain for other layouts
 - **Data**: `Table` (TanStack), chart components via sub-exports (`@carbon/react/Chart`)
 - **Rich text**: `@carbon/react/Editor` and `@carbon/react/RichText` (wraps `@carbon/tiptap`)
 - **Error boundary**: `@carbon/react/ErrorBoundary` — `RootErrorBoundary` (drop-in root `ErrorBoundary` for RR v7 that maps 404 / other HTTP / thrown `Error` to a styled screen) plus its parts (`ErrorScreen`, `GlitchHeading`, `StatusReadout`, `MagneticLink`, `NoiseOverlay`). Wrap it in the app's `Document` and pass `env` so `window.env` is set (the client crashes hydration otherwise). Copy is intentionally hardcoded English, not i18n.
```

**File**: `packages/react/src/NavRail.tsx` (modified, +14/-4)
```diff
@@ -47,7 +47,8 @@ export const navRailItemClasses = [
 // A pointer only passing over the rail (on its way to the page) shouldn't open it.
 const HOVER_OPEN_DELAY_MS = 150;
 
-// Lets an item keep the rail open while a menu or popover it triggered is open.
+// Lets an item freeze the rail as it is (open or collapsed) while a menu or
+// popover it triggered is open, so a tap on a collapsed rail never opens it.
 const NavRailHoldContext = createContext<(() => () => void) | null>(null);
 
 export function NavRail({
@@ -69,6 +70,7 @@ export function NavRail({
   const { pathname } = useLocation();
   const [hovered, setHovered] = useState(false);
   const navRef = useRef<HTMLElement>(null);
+  const lastPointerType = useRef<string>();
   const openTimer = useRef<ReturnType<typeof setTimeout>>();
   const cancelHoverOpen = useCallback(() => {
     clearTimeout(openTimer.current);
@@ -100,8 +102,13 @@ export function NavRail({
   useEffect(() => {
     cancelHoverOpen();
     if (hoverBlocked) return;
+    // Touch browsers leave `:hover` stuck on the last tapped element, so only
+    // a mouse's `:hover` counts.
     const raf = requestAnimationFrame(() =>
-      setHovered(navRef.current?.matches(":hover") ?? false)
+      setHovered(
+        lastPointerType.current === "mouse" &&
+          (navRef.current?.matches(":hover") ?? false)
+      )
     );
     return () => cancelAnimationFrame(raf);
   }, [hoverBlocked, cancelHoverOpen]);
@@ -140,8 +147,7 @@ export function NavRail({
     );
   }
 
-  const state =
-    forceExpanded || open || hovered || holds > 0 ? "expanded" : "collapsed";
+  const state = forceExpanded || open || hovered ? "expanded" : "collapsed";
 
   return (
     // The wrapper (not just the inner nav) grows on expand, so the rail pushes
@@ -163,8 +169,12 @@ export function NavRail({
           "flex flex-col justify-between",
           "hide-scrollbar overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent"
         )}
+        onPointerDown={(event) => {
+          lastPointerType.current = event.pointerType;
+        }}
         // Mouse only: a tap on a touch tablet must not expand the rail.
         onPointerMove={(event) => {
+          lastPointerType.current = event.pointerType;
           if (hoverBlocked || hovered || openTimer.current) return;
           if (event.pointerType !== "mouse") return;
           openTimer.current = setTimeout(() => {
```

---

### Incident Patch 7: `5765802b` (2026-09-30)
**Commit Message**: fix(nav): restore the MES logo and section labels, and steady the rail's hover

Adds a hover-intent delay, keeps the rail open while a menu opened from it is open, and stops trailing tags overlapping labels.

**File**: `apps/mes/app/components/AppSidebar.tsx` (modified, +45/-14)
```diff
@@ -3,12 +3,15 @@
 import type { Company } from "@carbon/auth";
 import {
   NavRail,
-  NavRailDivider,
+  NavRailBrand,
+  NavRailGroup,
   NavRailLink,
+  useMode,
   useShortcutKeyMap
 } from "@carbon/react";
 import { useLingui } from "@lingui/react/macro";
 import { Suspense, useMemo } from "react";
+import { BsFillHexagonFill } from "react-icons/bs";
 import {
   LuActivity,
   LuCalendarDays,
@@ -23,7 +26,7 @@ import { Await, useLocation, useNavigate } from "react-router";
 import type { Location } from "~/services/types";
 import { MES_NAV_SHORTCUTS } from "~/shortcuts";
 import type { PinnedInUser } from "~/types";
-import { path } from "~/utils/path";
+import { ERP_URL, path } from "~/utils/path";
 import { AdjustInventory } from "./AdjustInventory";
 import { EndShift } from "./EndShift";
 import Suggestion from "./Suggestion";
@@ -57,8 +60,11 @@ export function AppSidebar({
     data: { id: string; clockIn: string; [key: string]: unknown } | null;
   }> | null;
 }) {
+  const { t } = useLingui();
+
   return (
     <NavRail
+      header={<CompanyLink company={company} />}
       footer={
         <>
           {timeCardEnabled && (
@@ -91,22 +97,47 @@ export function AppSidebar({
         </>
       }
     >
-      <QueueLinks
-        counts={{
-          active: activeEvents,
-          maintenance: activeMaintenanceCount
-        }}
-      />
-      <NavRailDivider />
-      <AdjustInventory add={true} />
-      <AdjustInventory add={false} />
-      <EndShift />
-      <Suggestion />
-      <DisplaysLink />
+      <NavRailGroup label={t`Operations`}>
+        <QueueLinks
+          counts={{
+            active: activeEvents,
+            maintenance: activeMaintenanceCount
+          }}
+        />
+      </NavRailGroup>
+      <NavRailGroup label={t`Inventory Adjustments`}>
+        <AdjustInventory add={true} />
+        <AdjustInventory add={false} />
+      </NavRailGroup>
+      <NavRailGroup label={t`Tools`}>
+        <EndShift />
+        <Suggestion />
+        <DisplaysLink />
+      </NavRailGroup>
     </NavRail>
   );
 }
 
+/** Leads back to the ERP. */
+function CompanyLink({ company }: { company: Company }) {
+  const mode = useMode();
+  const logo = mode === "dark" ? company.logoDarkIcon : company.logoLightIcon;
+
+  return (
+    <NavRailBrand
+      href={ERP_URL}
+      label={company.name ?? ""}
+      logo={
+        logo ? (
+          <img src={logo} alt="" className="size-6 rounded object-contain" />
+        ) : (
+          <BsFillHexagonFill />
+        )
+      }
+    />
+  );
+}
+
 type QueueKey = keyof typeof MES_NAV_SHORTCUTS;
 
 /** The task queues, in rail order; each one's ⌥-digit comes from its key. */
```

**File**: `apps/mes/app/components/TimeCardButton.tsx` (modified, +4/-1)
```diff
@@ -65,7 +65,10 @@ export function TimeCardButton({ openClockEntry }: TimeCardButtonProps) {
           disabled={fetcher.state !== "idle"}
           trailing={
             openClockEntry && (
-              <Badge variant="red">
+              <Badge
+                variant="red"
+                className="min-h-5 px-1 text-[10px] tabular-nums"
+              >
                 {formatElapsed(openClockEntry.clockIn)}
               </Badge>
             )
```

**File**: `packages/locale/locales/de/mes.po` (modified, +9/-0)
```diff
@@ -703,6 +703,9 @@ msgstr "Unzureichende Menge"
 msgid "Inventory adjustment completed"
 msgstr "Bestandskorrektur abgeschlossen"
 
+msgid "Inventory Adjustments"
+msgstr "Bestandskorrekturen"
+
 msgid "is"
 msgstr "ist"
 
@@ -1105,6 +1108,9 @@ msgstr "Öffnen Sie einen NCR für MRB-Verwendungsentscheid"
 msgid "Open Jobs"
 msgstr "Offene Fertigungsaufträge"
 
+msgid "Operations"
+msgstr "Arbeitsgänge"
+
 msgid "Operations ended"
 msgstr "Arbeitsgänge beendet"
 
@@ -1678,6 +1684,9 @@ msgstr "Heute"
 msgid "Toggle the sidebar"
 msgstr "Seitenleiste ein-/ausblenden"
 
+msgid "Tools"
+msgstr "Werkzeuge"
+
 msgid "Total"
 msgstr "Gesamtbetrag"
 
```

**File**: `packages/locale/locales/en/mes.po` (modified, +9/-0)
```diff
@@ -703,6 +703,9 @@ msgstr "Insufficient quantity"
 msgid "Inventory adjustment completed"
 msgstr "Inventory adjustment completed"
 
+msgid "Inventory Adjustments"
+msgstr "Inventory Adjustments"
+
 msgid "is"
 msgstr "is"
 
@@ -1105,6 +1108,9 @@ msgstr "Open an NCR for MRB disposition"
 msgid "Open Jobs"
 msgstr "Open Jobs"
 
+msgid "Operations"
+msgstr "Operations"
+
 msgid "Operations ended"
 msgstr "Operations ended"
 
@@ -1678,6 +1684,9 @@ msgstr "Today"
 msgid "Toggle the sidebar"
 msgstr "Toggle the sidebar"
 
+msgid "Tools"
+msgstr "Tools"
+
 msgid "Total"
 msgstr "Total"
 
```

**File**: `packages/locale/locales/es/mes.po` (modified, +9/-0)
```diff
@@ -703,6 +703,9 @@ msgstr "Cantidad insuficiente"
 msgid "Inventory adjustment completed"
 msgstr "Ajuste de inventario completado"
 
+msgid "Inventory Adjustments"
+msgstr "Ajustes de inventario"
+
 msgid "is"
 msgstr "es"
 
@@ -1105,6 +1108,9 @@ msgstr "Abrir un NCR para la disposición de MRB"
 msgid "Open Jobs"
 msgstr "Órdenes de trabajo abiertas"
 
+msgid "Operations"
+msgstr "Operaciones"
+
 msgid "Operations ended"
 msgstr "Operaciones finalizadas"
 
@@ -1678,6 +1684,9 @@ msgstr "Hoy"
 msgid "Toggle the sidebar"
 msgstr "Alternar la barra lateral"
 
+msgid "Tools"
+msgstr "Herramientas"
+
 msgid "Total"
 msgstr "Total"
 
```

---

### Incident Patch 8: `9ffc2061` (2026-09-30)
**Commit Message**: fix(agent): keep compacted search results valid JSON

compactEarlierToolOutputs rebuilt each earlier search_docs hit as
{ title, section, url }; a hit on a page's intro has no section, so the key
was set to undefined. Tool results must be JSON values, so the AI SDK rejected
the whole prompt (AI_InvalidPromptError) and every follow-up question after a
search failed. Omit the key instead. The new test runs the compacted history
through convertToModelMessages and modelMessageSchema, the same validation that
failed in production; it fails on the old code.

**File**: `apps/erp/app/modules/agent/agent.history.test.ts` (modified, +20/-1)
```diff
@@ -1,4 +1,4 @@
-import type { UIMessage } from "ai";
+import { convertToModelMessages, modelMessageSchema, type UIMessage } from "ai";
 import { describe, expect, it } from "vitest";
 import { compactEarlierToolOutputs } from "./agent.history";
 
@@ -21,6 +21,11 @@ const assistantThatRead = (id: string): UIMessage =>
         state: "output-available",
         input: { query: "batching" },
         output: [
+          {
+            title: "Operation batching",
+            url: "https://docs.carbon.ms/docs/reference/batching",
+            snippet: "Operation batching groups unstarted operations…"
+          },
           {
             title: "Operation batching",
             section: "Building a batch",
@@ -60,6 +65,10 @@ describe("compactEarlierToolOutputs", () => {
       note: "Read in an earlier turn; read_doc again for the text."
     });
     expect(search!.output).toEqual([
+      {
+        title: "Operation batching",
+        url: "https://docs.carbon.ms/docs/reference/batching"
+      },
       {
         title: "Operation batching",
         section: "Building a batch",
@@ -70,6 +79,16 @@ describe("compactEarlierToolOutputs", () => {
     expect(JSON.stringify(earlier).length).toBeLessThan(1_000);
   });
 
+  it("produces a prompt the AI SDK accepts, including an intro hit with no section", () => {
+    const compacted = compactEarlierToolOutputs([
+      user("what is batching"),
+      assistantThatRead("a1"),
+      user("and how do I start one")
+    ]);
+    const prompt = convertToModelMessages(compacted);
+    expect(modelMessageSchema.array().safeParse(prompt).success).toBe(true);
+  });
+
   it("leaves the current turn untouched", () => {
     const messages = [user("what is batching"), assistantThatRead("a1")];
     expect(compactEarlierToolOutputs(messages)).toEqual(messages);
```

**File**: `apps/erp/app/modules/agent/agent.history.ts` (modified, +7/-1)
```diff
@@ -29,7 +29,13 @@ function compactToolOutput(toolName: string, output: unknown): unknown {
       : output;
   }
   if (toolName === "search_docs" && Array.isArray(output)) {
-    return output.map(({ title, section, url }) => ({ title, section, url }));
+    // A tool result must be a JSON value: an intro hit has no section, and a key set to
+    // `undefined` fails the SDK's prompt validation for the whole request.
+    return output.map(({ title, section, url }) => ({
+      title,
+      url,
+      ...(section ? { section } : {})
+    }));
   }
   return output;
 }
```

---

### Incident Patch 9: `00cc32ab` (2026-09-30)
**Commit Message**: fix(agent): stop overflowing the model context, and cut token cost

The agent failed with context_length_exceeded after reading the batching page.
agentChatModel was plain "gpt-4" (8k-token window, GPT-4 pricing, swept in with
#1659); one long page (~7k tokens) plus the prompt overflowed it.

- Model: gpt-4.1-mini (1M-token window, no reasoning tokens, far cheaper).
- search_docs indexes page sections (splitSections in @carbon/content), not
  pages, weights each page's intro so its overview leads, and returns at most
  two sections per page as { title, section, url#anchor, snippet }.
- read_doc returns one section for a #anchor url, a short page whole, and a
  long page as its intro plus section links. "what is job operation batching"
  now reads ~3.8k characters instead of the 25.9k-character page. A test pins
  the size of every page and section read.
- Doc results from earlier turns are compacted to titles and urls before each
  request (agent.history.ts), so follow-ups stop re-sending whole pages.
- MAX_STEPS 20 -> 6; one OpenAI promptCacheKey for every turn; each turn logs
  its steps and input/cached/output tokens, and model errors go through the
  logger.

**File**: `.claude/rules/agent-knowledge-base.md` (modified, +23/-6)
```diff
@@ -44,9 +44,26 @@ All three machine-readable consumers strip MDX through the one `stripComponents`
 
 `apps/erp/app/modules/agent/agent.kb.ts` answers `search_docs` with `createDocSearch` from
 `@carbon/ee/mcp` (`packages/ee/src/mcp/doc-search.ts`) — the MCP `search_tools` engine
-(zbsearch BM25 + prefix, `SEARCH_ALIASES` and `stemInflection` stems via `expandQueryTerm`, one-edit typo retry) over
-title/keywords/headings/description/body. It stays in `packages/ee` on purpose: the licence
-split is kept, so `@carbon/content` holds the corpus and ee holds the ranking. Pinned against
-the real corpus by `agent.kb.test.ts`. `read_doc` returns a page by its public URL
-(`https://docs.carbon.ms/<slug>`). The agent only ever sees URLs — slugs/file paths are never
-surfaced to the user.
+(zbsearch BM25 + prefix, `SEARCH_ALIASES` and `stemInflection` stems via `expandQueryTerm`,
+one-edit typo retry). It indexes SECTIONS (`splitSections`, `@carbon/content/corpus`: a page
+split at its `##`/`###` headings), not pages; each page's intro is weighted ×2 so its
+overview leads over troubleshooting sections that merely repeat the term, and at most two
+sections per page are returned. A hit is `{ title, section, url (with #anchor), snippet }`.
+It stays in `packages/ee` on purpose: the licence split is kept, so `@carbon/content` holds
+the corpus and ee holds the ranking.
+
+Everything the agent reads stays bounded, because every tool result is re-sent on every
+later step. `read_doc` returns one section for a `#anchor` url, a short page whole
+(≤ 12k chars), and a long page as its intro plus section links. Section anchors are the
+site's own (`headingAnchor`, github-slugger rules incl. `-1` suffixes), pinned by
+`links.test.ts`; the size bound on every page and section read is pinned by
+`agent.kb.test.ts`. `read_doc` and `search_docs` results from EARLIER turns are compacted to
+titles and urls before each request (`compactEarlierToolOutputs`, `agent.history.ts`).
+
+The model is `agentChatModel` in `packages/utils/src/llm.ts` (`gpt-4.1-mini`). It was plain
+`gpt-4` — an 8k-token window — and a single long page overflowed it
+(`context_length_exceeded`). `MAX_STEPS` is 6, requests share one OpenAI `promptCacheKey`,
+and each turn logs its steps and input / cached / output tokens ("Agent turn").
+
+The agent only ever sees URLs (`https://docs.carbon.ms/<slug>`, index pages at their
+folder) — slugs/file paths are never surfaced to the user.
```

**File**: `.claude/rules/mcp-tools-reference.md` (modified, +2/-1)
```diff
@@ -144,7 +144,8 @@ not substring filtering. The typed, tested logic lives OUTSIDE the
   full Porter turned "customer" into "custom". The docs site uses the same stemmer.
 - The in-app agent's `search_docs` reuses this engine over the docs corpus —
   `createDocSearch` in `packages/ee/src/mcp/doc-search.ts` shares `expandQueryTerm`
-  (so a new alias improves both) and the typo retry.
+  (so a new alias improves both) and the typo retry. It indexes page SECTIONS, weights
+  each page's intro ×2 via `sortBy`, and returns at most two sections per page.
 - Pinned by `lib/catalog-search.test.ts` and `lib/describe-format.test.ts`;
   `lib/manifest.ts` carries its own copies of the meta-tool descriptions
   (pinned >40 chars by `manifest.test.ts`) — keep them in sync with
```

**File**: `apps/erp/app/modules/agent/agent.history.test.ts` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+import type { UIMessage } from "ai";
+import { describe, expect, it } from "vitest";
+import { compactEarlierToolOutputs } from "./agent.history";
+
+const page = "x".repeat(20_000);
+
+const user = (text: string): UIMessage => ({
+  id: text,
+  role: "user",
+  parts: [{ type: "text", text }]
+});
+
+const assistantThatRead = (id: string): UIMessage =>
+  ({
+    id,
+    role: "assistant",
+    parts: [
+      {
+        type: "tool-search_docs",
+        toolCallId: `${id}-s`,
+        state: "output-available",
+        input: { query: "batching" },
+        output: [
+          {
+            title: "Operation batching",
+            section: "Building a batch",
+            url: "https://docs.carbon.ms/docs/reference/batching#building-a-batch",
+            snippet: "A batch groups operations…"
+          }
+        ]
+      },
+      {
+        type: "tool-read_doc",
+        toolCallId: `${id}-r`,
+        state: "output-available",
+        input: { url: "https://docs.carbon.ms/docs/reference/batching" },
+        output: {
+          url: "https://docs.carbon.ms/docs/reference/batching",
+          content: page
+        }
+      },
+      { type: "text", text: "Batching groups operations." }
+    ]
+  }) as UIMessage;
+
+describe("compactEarlierToolOutputs", () => {
+  it("drops the text of doc results from earlier turns but keeps their urls", () => {
+    const [, earlier] = compactEarlierToolOutputs([
+      user("what is batching"),
+      assistantThatRead("a1"),
+      user("and how do I start one")
+    ]);
+    const [search, read, text] = earlier!.parts as unknown as Array<{
+      output?: unknown;
+      text?: string;
+    }>;
+
+    expect(read!.output).toEqual({
+      url: "https://docs.carbon.ms/docs/reference/batching",
+      note: "Read in an earlier turn; read_doc again for the text."
+    });
+    expect(search!.output).toEqual([
+      {
+        title: "Operation batching",
+        section: "Building a batch",
+        url: "https://docs.carbon.ms/docs/reference/batching#building-a-batch"
+      }
+    ]);
+    expect(text!.text).toBe("Batching groups operations.");
+    expect(JSON.stringify(earlier).length).toBeLessThan(1_000);
+  });
+
+  it("leaves the current turn untouched", () => {
+    const messages = [user("what is batching"), assistantThatRead("a1")];
+    expect(compactEarlierToolOutputs(messages)).toEqual(messages);
+  });
+});
```

**File**: `apps/erp/app/modules/agent/agent.history.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import { getToolName, isToolUIPart, type UIMessage } from "ai";
+
+// Sliding window: send the model only the most recent messages whose combined size stays
+// under this character budget (a rough token proxy — ~4 chars/token), dropping the oldest.
+// Keeps the conversation from growing unbounded toward the context window. Whole messages
+// are kept/dropped so tool-call/result pairs stay intact.
+export const HISTORY_CHAR_BUDGET = 100_000; // ~25k tokens of history
+
+function messageSize(m: UIMessage): number {
+  let n = 0;
+  for (const part of m.parts) {
+    if (part.type === "text") n += part.text.length;
+    else if (isToolUIPart(part)) {
+      n +=
+        JSON.stringify(part.input ?? "").length +
+        JSON.stringify(part.output ?? "").length;
+    }
+  }
+  return n;
+}
+
+// Doc tool results from earlier turns are re-sent with every later request. Keep what the
+// model needs to recall them (titles and urls) and drop the text; it can read_doc again.
+function compactToolOutput(toolName: string, output: unknown): unknown {
+  if (toolName === "read_doc" && output && typeof output === "object") {
+    const { url } = output as { url?: string };
+    return url
+      ? { url, note: "Read in an earlier turn; read_doc again for the text." }
+      : output;
+  }
+  if (toolName === "search_docs" && Array.isArray(output)) {
+    return output.map(({ title, section, url }) => ({ title, section, url }));
+  }
+  return output;
+}
+
+export function compactEarlierToolOutputs(messages: UIMessage[]): UIMessage[] {
+  const lastUser = messages.findLastIndex((m) => m.role === "user");
+  return messages.map((message, i) =>
+    i >= lastUser
+      ? message
+      : {
+          ...message,
+          parts: message.parts.map((part) =>
+            isToolUIPart(part) && part.state === "output-available"
+              ? {
+                  ...part,
+                  output: compactToolOutput(getToolName(part), part.output)
+                }
+              : part
+          )
+        }
+  );
+}
+
+export function windowByChars(
+  messages: UIMessage[],
+  budget: number
+): UIMessage[] {
+  const kept: UIMessage[] = [];
+  let total = 0;
+  for (let i = messages.length - 1; i >= 0; i--) {
+    const size = messageSize(messages[i]);
+    // Always keep the most recent message, even if it alone exceeds the budget.
+    if (kept.length > 0 && total + size > budget) break;
+    kept.unshift(messages[i]);
+    total += size;
+  }
+  // Anthropic requires the first message to be a user message; dropping the oldest
+  // turns can leave an assistant at the front, so trim any leading non-user messages.
+  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
+  return kept;
+}
```

**File**: `apps/erp/app/modules/agent/agent.kb.test.ts` (modified, +64/-8)
```diff
@@ -2,8 +2,20 @@ import { agentDocs } from "@carbon/content/agent-kb";
 import { describe, expect, it } from "vitest";
 import { readDoc, searchDocs } from "./agent.kb";
 
+// The first n distinct pages the hits point into (hits link to a section,
+// `…/purchase-orders#fields`, and a page may contribute two).
 const top = async (query: string, n = 3) =>
-  (await searchDocs({ query, limit: n })).map((hit) => hit.url);
+  [
+    ...new Set(
+      (await searchDocs({ query, limit: n * 2 })).map(
+        (hit) => hit.url.split("#")[0]
+      )
+    )
+  ].slice(0, n);
+
+// What one read_doc may put into the model's context. The chat model once had an 8k-token
+// window, and one whole long page (batching, ~7k tokens) overflowed it.
+const READ_BUDGET = 16_000;
 
 describe("search_docs", () => {
   it("expands domain abbreviations the way MCP search_tools does", async () => {
@@ -25,10 +37,13 @@ describe("search_docs", () => {
     expect(await searchDocs({ query: "  " })).toEqual([]);
   });
 
-  it("returns URLs read_doc can open", async () => {
-    const [hit] = await searchDocs({ query: "scrap", limit: 1 });
-    expect(hit).toBeDefined();
-    expect(readDoc({ url: hit!.url })).toMatchObject({ url: hit!.url });
+  it("returns section URLs read_doc can open, with a short snippet", async () => {
+    const hits = await searchDocs({ query: "operation batching", limit: 5 });
+    expect(hits.length).toBeGreaterThan(0);
+    for (const hit of hits) {
+      expect(readDoc({ url: hit.url })).toMatchObject({ url: hit.url });
+      expect(hit.snippet.length).toBeLessThanOrEqual(281);
+    }
   });
 
   it("links an index page at its folder URL, the one the site serves", async () => {
@@ -40,7 +55,7 @@ describe("search_docs", () => {
         (hits) => hits.filter((h) => h.title === doc.title)
       );
       expect(hit, `"${doc.title}" finds its own page`).toBeDefined();
-      expect(hit!.url, doc.slug).not.toMatch(/\/index$/);
+      expect(hit!.url, doc.slug).not.toMatch(/\/index(#|$)/);
     }
   });
 });
@@ -56,12 +71,53 @@ describe("read_doc", () => {
     ).toEqual(folder);
   });
 
-  it("ignores an anchor, a query and a trailing slash", () => {
+  it("reads one section by its anchor", () => {
+    const page = agentDocs.find((d) => d.slug === "docs/reference/batching")!;
+    const section = page.sections.find((s) => s.anchor)!;
+    const url = `https://docs.carbon.ms/docs/reference/batching#${section.anchor}`;
+    const result = readDoc({ url });
+    expect(result).toMatchObject({ url });
+    expect((result as { content: string }).content).toContain(section.markdown);
+  });
+
+  it("returns a long page as its intro and section links", () => {
+    const result = readDoc({
+      url: "https://docs.carbon.ms/docs/reference/batching"
+    });
+    const content = (result as { content: string }).content;
+    expect(content).toContain("This page is long");
+    expect(content).toContain(
+      "https://docs.carbon.ms/docs/reference/batching#"
+    );
+  });
+
+  it("falls back to the page for an unknown anchor, and ignores a query or trailing slash", () => {
     const page = readDoc({ url: "https://docs.carbon.ms/docs/reference/jobs" });
     expect("content" in page).toBe(true);
     expect(
-      readDoc({ url: "https://docs.carbon.ms/docs/reference/jobs/#fields" })
+      readDoc({
+        url: "https://docs.carbon.ms/docs/reference/jobs/#no-such-heading"
+      })
     ).toEqual(page);
     expect(readDoc({ url: "/docs/reference/jobs?ref=x" })).toEqual(page);
   });
+
+  it("keeps every page and section read within budget", () => {
+    const over = agentDocs.flatMap((doc) => {
+      const pageUrl = `https://docs.carbon.ms/${doc.slug.replace(/(^|\/)index$/, "")}`;
+      const urls = [
+        pageUrl,
+        ...doc.sections
+          .filter((s) => s.anchor)
+          .map((s) => `${pageUrl}#${s.anchor}`)
+      ];
+      return urls.flatMap((url) => {
+        const { content = "" } = readDoc({ url 
```

---

### Incident Patch 10: `3c77c8e2` (2026-09-30)
**Commit Message**: fix(jobs): read storage.objects over Postgres in cleanup sweeps

PostgREST only exposes the public schema, so the staged-raw and tmp-staging
prunes failed with PGRST106 on every run and never deleted anything.

**File**: `packages/jobs/src/inngest/functions/scheduled/cleanup.ts` (modified, +25/-16)
```diff
@@ -5,6 +5,8 @@ import {
   TEMP_STAGING_BUCKET
 } from "@carbon/files";
 import { NotificationEvent } from "@carbon/notifications";
+import { sql } from "kysely";
+import { getJobDatabaseClient } from "../../../db";
 import { inngest } from "../../client";
 
 // Raw CAD in `temp-staging` is transient — the optimise/assembly jobs read it,
@@ -23,6 +25,20 @@ const AGENT_THREAD_TTL_DAYS = 30;
 // never registered. One day is generous — both are seconds-to-minutes lived.
 const TMP_STAGING_TTL_HOURS = 24;
 
+async function listStorageObjects(where: ReturnType<typeof sql>) {
+  try {
+    const { rows } = await sql<{
+      name: string | null;
+      bucket_id: string | null;
+    }>`
+      SELECT name, bucket_id FROM storage.objects WHERE ${where} LIMIT 1000
+    `.execute(getJobDatabaseClient());
+    return { data: rows, error: null };
+  } catch (error) {
+    return { data: [], error };
+  }
+}
+
 type NotifyEvent = {
   name: "carbon/notify";
   data: {
@@ -401,19 +417,16 @@ export const cleanupFunction = inngest.createFunction(
         Date.now() - STAGED_RAW_TTL_DAYS * 24 * 60 * 60 * 1000
       ).toISOString();
 
-      const stale = await serviceRole
-        .schema("storage")
-        .from("objects")
-        .select("name")
-        .eq("bucket_id", TEMP_STAGING_BUCKET)
-        .lt("created_at", cutoff)
-        .limit(1000);
+      // PostgREST only exposes `public`, so `storage.objects` is read directly.
+      const stale = await listStorageObjects(
+        sql`bucket_id = ${TEMP_STAGING_BUCKET} AND created_at < ${cutoff}`
+      );
 
       if (stale.error) {
         logger.error("Error listing stale staged raws", { error: stale.error });
         return;
       }
-      const staleNames = (stale.data ?? [])
+      const staleNames = stale.data
         .map((o) => o.name)
         .filter((n): n is string => Boolean(n));
       if (staleNames.length === 0) {
@@ -517,13 +530,9 @@ export const cleanupFunction = inngest.createFunction(
       // with the legacy shared `private` bucket still holding pre-migration
       // objects — so select the bucket alongside the name and prune per bucket
       // rather than assuming one shared bucket.
-      const stale = await serviceRole
-        .schema("storage")
-        .from("objects")
-        .select("name, bucket_id")
-        .like("name", "%/tmp/%")
-        .lt("created_at", cutoff)
-        .limit(1000);
+      const stale = await listStorageObjects(
+        sql`name LIKE '%/tmp/%' AND created_at < ${cutoff}`
+      );
 
       if (stale.error) {
         logger.error("Error listing stale tmp objects", { error: stale.error });
@@ -534,7 +543,7 @@ export const cleanupFunction = inngest.createFunction(
       // `tmp` marks the transient prefix (`{companyId}/tmp/…`). Entity
       // folders are never named tmp, but don't rely on that for a delete.
       const byBucket = new Map<string, string[]>();
-      for (const object of stale.data ?? []) {
+      for (const object of stale.data) {
         const name = object.name;
         const bucketId = object.bucket_id;
         if (typeof name !== "string" || typeof bucketId !== "string") continue;
```

#### Recent Merged Pull Requests:
- **PR #1779** (2026-09-30): fix(ramp): link Ramp vendors to Rillet's accounting vendor in push-only mode (@barbinbrad)
- **PR #1778** (2026-09-30): feat(production): Outbound report under Scheduling (@barbinbrad)
- **PR #1776** (2026-09-30): fix(purchasing): one PO per supplier when creating orders from Material Planning (@naveenkash)
- **PR #1775** (2026-09-30): (feat): Demo Data settings page available to all customers (@aashu0148)
- **PR #1774** (2026-09-30): fix(agent): server-owned history, AI SDK v7, retention and cleanup (@sidwebworks)
- **PR #1773** (2026-09-30): (feat): shop floor sidebar now matches the ERP and shares its code (@aashu0148)
- **PR #1772** (2026-09-30): fix: stop duplicate writes from replayed submits and retries (@sidwebworks)
- **PR #1771** (2026-09-30): docs(readme): refresh content, screenshots and badges (@sidwebworks)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
