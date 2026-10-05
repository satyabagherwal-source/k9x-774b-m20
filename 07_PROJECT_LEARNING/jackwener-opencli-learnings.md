# Forensic Learning Record (Deep Inspection): jackwener/OpenCLI

> **Canonical Artifact**: `07_PROJECT_LEARNING/jackwener-opencli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jackwener/OpenCLI](https://github.com/jackwener/OpenCLI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:21:00.949Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jackwener/OpenCLI`
- **Description**: Make Any Website into CLI & Use your logged-in browser by AI agent. 
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 29858 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `autoresearch/engine.ts`
```
/**
 * AutoResearch Engine — Karpathy's 8-phase autonomous iteration loop.
 *
 * Phase 0: Precondition checks (git clean, no locks)
 * Phase 1: Review (read scope files + log + git history)
 * Phase 2: Ideate (select next change based on history)
 * Phase 3: Modify (one atomic change — delegated to caller)
 * Phase 4: Commit (git add + commit with experiment prefix)
 * Phase 5: Verify (run verify command, extract metric)
 * Phase 5.5: Guard (optional regression check)
 * Phase 6: Decide (keep/discard/crash + rollback)
 * Phase 7: Log (append TSV)
 * Phase 8: Repeat
 */

import { execSync, execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { type AutoResearchConfig, type IterationResult, type IterationStatus, extractMetric } from './config.js';
import { Logger } from './logger.js';

export interface EngineCallbacks {
  /** Called at Phase 2-3: review context, ideate, and make ONE change.
   *  Return a one-sentence description of what was changed, or null to skip. */
  modify(context: ModifyContext): Promise<string | null>;

  /** Called when engine needs to report status */
  onStatus?(msg: string): void;
}

export interface ModifyContext {
  iteration: number;
  bestMetric: number;
  currentMetric: number;
  recentLog: IterationResult[];
  gitLog: string;
  scopeFiles: string[];
  consecutiveDiscards: number;
  stuckHint: string | null;
}

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');

function exec(cmd: string, opts?: { timeout?: number; cwd?: string }): string {
  try {
    return execSync(cmd, {
      cwd: opts?.cwd ?? ROOT,
      timeout: opts?.timeout ?? 120_000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    }).trim();
  } catch (err: any) {
    return err.stdout?.trim() ?? err.message ?? '';
  }
}

function execStrict(cmd: string, opts?: { timeout?: number }): string {
  return execSync(cmd, {
    cwd: ROOT,
    timeout: opts?.timeout ?? 120_000,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: process.env,
  }).trim();
}

export class Engine {
  private config: AutoResearchConfig;
  private logger: Logger;
  private callbacks: EngineCallbacks;
  private bestMetric: number = 0;
  private currentMetric: number = 0;
  private iteration: number = 0;

  constructor(config: AutoResearchConfig, logPath: string, callbacks: EngineCallbacks) {
    this.config = config;
    this.logger = new Logger(logPath);
    this.callbacks = callbacks;
  }

  private log(msg: string): void {
    this.callbacks.onStatus?.(msg);
  }

  /** Phase 0: Precondition checks */
  private checkPreconditions(): void {
    // Git repo exists
    try { execStrict('git rev-parse --git-dir'); }
    catch { throw new Error('Not a git repository'); }

    // Clean working tree
    const status = exec('git status --porcelain');
    if (status) throw new Error(`Working tree not clean:\n${status}`);

    // No stale locks
    if (existsSync(join(ROOT, '.git', 'index.lock'))) {
      throw new Error('Stale .git/index.lock found — remove it first');
    }

    // Not detached HEAD
    try { execStrict('git symbolic-ref HEAD'); }
    catch { throw new Error('Detached HEAD — checkout a branch first'); }
  }

  /** Phase 5: Run verify command and extract metric */
  private runVerify(): number | null {
    this.log('  verify...');
    const output = exec(this.config.verify, { timeout: 300_000 });
    return extractMetric(output);
  }

  /** Phase 5.5: Run guard command */
  private runGuard(): boolean {
    if (!this.config.guard) return true;
    this.log('  guard...');
    try {
      execStrict(this.config.guard, { timeout: 300_000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Phase 4: Commit changes */
  private commit(description: string): string | null {
    if (!this.config.scope.length) return null; // no scope = nothing to stage
    // Stage only files matching scope globs (avoid staging unrelated changes)
    // Use execFileSync to bypass shell glob expansion so git handles pathspecs directly
    execFileSync('git', ['add', '--', ...this.config.scope], {
      cwd: ROOT, timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const diff = exec('git diff --cached --quiet; echo $?');
    if (diff === '0') return null; // no changes

    try {
      execStrict(`git commit -m "experiment(browser): ${description.replace(/"/g, '\\"')}"`);
      return exec('git rev-parse --short HEAD');
    } catch {
      // Hook failure
      exec('git reset HEAD');
      return 'hook-blocked';
    }
  }

  /** Phase 6: Rollback */
  private safeRevert(): void {
    try {
      execStrict('git revert HEAD --no-edit');
    } catch {
      exec('git revert --abort');
      exec('git reset --hard HEAD~1');
    }
  }

  /** Get stuck hint when >5 consecutive discards */
  private getStuckHint(discards: number): string | null {
    if (discards < 5) return null;
    const hints = [
      'Re-read ALL scope files from scratch. Try a completely different approach.',
      'Review entire results log — what worked before? Try combining successful changes.',
      'Try the OPPOSITE of what has been failing.',
      'Try a radical architectural change instead of incremental tweaks.',
      'Simplify — remove complexity rather than adding it.',
    ];
    return hints[Math.min(discards - 5, hints.length - 1)];
  }

  /** Run the main loop */
  async run(): Promise<IterationResult[]> {
    const results: IterationResult[] = [];

    // Phase 0: Preconditions
    this.log('Phase 0: Precondition checks...');
    this.checkPreconditions();

    // Initialize logger
    this.logger.init(this.config);

    // Baseline measurement
    this.log('Measuring baseline...');
    const baseline = this.runVerify();
    if (baseline == null) throw new Error('Verify command returned no metric for baseline');
    this.bestMetric = baseline;
    this.currentMetric = baseline;

    const baselineCommit = exec('git rev-parse --short HEAD');
    const baselineResult: IterationResult = {
      iteration: 0,
      commit: baselineCommit,
      metric: baseline,
      delta: 0,
      guard: this.config.guard ? (this.runGuard() ? 'pass' : 'fail') : '-',
      status: 'baseline',
      description: `initial state — ${this.config.metric} ${baseline}`,
    };
    this.logger.append(baselineResult);
    results.push(baselineResult);
    this.log(`Baseline: ${this.config.metric} = ${baseline}`);

    // Main loop
    const maxIter = this.config.iterations ?? Infinity;
    for (this.iteration = 1; this.iteration <= maxIter; this.iteration++) {
      this.log(`\n━━━ Iteration ${this.iteration}${maxIter < Infinity ? `/${maxIter}` : ''} ━━━`);

      // Phase 1: Review
      const gitLog = exec('git log --oneline -20');
      const recentLog = this.logger.readLast(20);
      const scopeFiles = this.config.scope;
      const consecutiveDiscards = this.logger.consecutiveDiscards();

      // Phase 2-3: Ideate + Modify (delegated to callback)
      const context: ModifyContext = {
        iteration: this.iteration,
        bestMetric: this.bestMetric,
        currentMetric: this.currentMetric,
        recentLog,
        gitLog,
        scopeFiles,
        consecutiveDiscards,
        stuckHint: this.getStuckHint(consecutiveDiscards),
      };

      let description: string | null;
      try {
        description = await this.callbacks.modify(context);
      } catch (err: any) {
        this.log(`  modify error: ${err.message}`);
        const result: IterationResult = {
          iteration: this.iteration,
          commit: '-',
          metric: this.currentMetric,
          delta: 0,
          guard: '-',
          status: 'crash',
          description: `modify crashed: ${err.message?.slice(0, 80)}`,
        };
        this.logger.append(result);
        results.push(result);
        continue;
      }

      if (!description) {
        const result: IterationResult = {
          iteration: this.iteration,
          commit: '-',
          metric: this.currentMetric,
          delta: 0,
          guard: '-',
          status: 'no-op',
          description: 'no changes made',
        };
        this.logger.append(result);
        results.push(result);
        continue;
      }

      // Phase 4: Commit
      this.log(`  commit: ${description}`);
      const commitHash = this.commit(description);
      if (!commitHash) {
        const result: IterationResult = {
          iteration: this.iteration,
          commit: '-',
          metric: this.currentMetric,
          delta: 0,
          guard: '-',
          status: 'no-op',
          description: `no diff after: ${description}`,
        };
        this.logger.append(result);
        results.push(result);
        continue;
      }
      if (commitHash === 'hook-blocked') {
        const result: IterationResult = {
          iteration: this.iteration,
          commit: '-',
          metric: this.currentMetric,
          delta: 0,
          guard: '-',
          status: 'hook-blocked',
          description: `hook rejected: ${description}`,
        };
        this.logger.append(result);
        results.push(result);
        continue;
      }

      // Phase 5: Verify
      const metric = this.runVerify();
      if (metric == null) {
        this.log('  verify crashed — reverting');
        this.safeRevert();
        const result: IterationResult = {
          iteration: this.iteration,
          commit: '-',
          metric: this.currentMetric,
          delta: 0,
          guard: '-',
          status: 'crash',
          description: `verify crashed: ${description}`,
        };
        this.logger.append(result);
        results.push(result);
        continue;
      }

      const improved = this.config.direction === 'higher'
        ? metric > this.bestMetric
        : metric < this.bestMetric;
      const delta = +(metric - this.bestMetric).toFixed(4);
     
```

### Core Architecture Module: `clis/12306/utils.js`
```
/**
 * 12306 (中国铁路) shared helpers.
 *
 * - Station lookup: parses the public `station_name.js` bundle into
 *   structured records.
 * - Cookie session: 12306's query endpoints reject anonymous requests
 *   with `HTTP 302 -> error.html`, so callers must hit `/otn/leftTicket/init`
 *   first to mint the JSESSIONID / route / BIGipServerotn cookies.
 * - Query endpoint rotation: 12306 rotates the train-query endpoint
 *   name (queryO / queryZ / queryA / queryG / ...) every few weeks.
 *   When the wrong name is hit, the server returns
 *   `{"c_url":"leftTicket/queryG","c_name":"CLeftTicketUrl","status":false}`
 *   pointing to the current correct name; retry once with that name.
 */
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

const STATION_BUNDLE_URL = 'https://kyfw.12306.cn/otn/resources/js/framework/station_name.js';
const INIT_URL = 'https://kyfw.12306.cn/otn/leftTicket/init';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATION_CODE_RE = /^[A-Z]{2,4}$/;

/**
 * Parse the `station_name.js` bundle into a station record array.
 *
 * Bundle format (single line, `@`-delimited records, each `|`-delimited):
 *   `var station_names ='@bjb|北京北|VAP|beijingbei|bjb|0|0357|北京|||...';`
 *
 * Per-record fields (positional):
 *   [0] short pinyin alias  (e.g. `bjb`)
 *   [1] Chinese station name (e.g. `北京北`)
 *   [2] telecode (3-4 uppercase letters, e.g. `VAP`) - this is the
 *       wire format 12306 uses for `from_station` / `to_station`.
 *   [3] full pinyin           (e.g. `beijingbei`)
 *   [4] short alias           (duplicate of [0] usually)
 *   [5] index/rank
 *   [6] city code
 *   [7] city name             (e.g. `北京`)
 */
export function parseStationBundle(text) {
    const match = text.match(/'([^']+)'/);
    if (!match) {
        throw new CommandExecutionError('Failed to parse 12306 station_name.js: source string not found');
    }
    const raw = match[1];
    const records = raw.split('@').filter(Boolean);
    const stations = [];
    for (const r of records) {
        const parts = r.split('|');
        if (parts.length < 8 || !parts[2]) continue;
        stations.push({
            short: parts[0] || '',
            name: parts[1] || '',
            code: parts[2] || '',
            pinyin: parts[3] || '',
            abbr: parts[4] || '',
            city: parts[7] || '',
        });
    }
    if (stations.length === 0) {
        throw new CommandExecutionError('Failed to parse 12306 station_name.js: no station records found');
    }
    return stations;
}

/**
 * Resolve a user-supplied station identifier to a telecode.
 *
 * Accepts Chinese name (`上海虹桥`), telecode (`AOH`), pinyin
 * (`shanghaihongqiao`), short alias (`shh`), or city name with a
 * preference for the city's main station.
 */
export function resolveStation(stations, input) {
    const trimmed = String(input ?? '').trim();
    if (!trimmed) throw new ArgumentError('station must not be empty');
    if (STATION_CODE_RE.test(trimmed)) {
        const exact = stations.find((s) => s.code === trimmed);
        if (exact) return exact;
        throw new ArgumentError(`Unknown 12306 station telecode "${trimmed}"`);
    }
    const lower = trimmed.toLowerCase();
    const exactName = stations.find((s) => s.name === trimmed);
    if (exactName) return exactName;
    const exactPinyin = stations.find((s) => s.pinyin === lower);
    if (exactPinyin) return exactPinyin;
    const exactAbbr = stations.find((s) => s.abbr === lower || s.short === lower);
    if (exactAbbr) return exactAbbr;
    throw new ArgumentError(`Unknown 12306 station "${trimmed}"`, 'Try the Chinese name (上海虹桥), the 3-4 letter telecode (AOH), or full pinyin (shanghaihongqiao).');
}

export function validateDate(value) {
    if (!DATE_RE.test(String(value ?? ''))) {
        throw new ArgumentError(`date must be YYYY-MM-DD, got "${value}"`);
    }
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
        throw new ArgumentError(`date "${value}" is not a real calendar date`);
    }
    return value;
}

export function normalizeLimit(value, defaultValue, max) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) {
        throw new ArgumentError(`limit must be a positive integer (1-${max})`);
    }
    if (n > max) {
        throw new ArgumentError(`limit must be <= ${max}`);
    }
    return n;
}

/** Extract Set-Cookie header values into a single `Cookie:` header string. */
export function buildCookieHeader(setCookieHeaders) {
    if (!Array.isArray(setCookieHeaders) || setCookieHeaders.length === 0) return '';
    return setCookieHeaders
        .map((line) => line.split(';')[0])
        .filter(Boolean)
        .join('; ');
}

export async function fetchStationBundle(fetchImpl = fetch) {
    const resp = await fetchImpl(STATION_BUNDLE_URL, {
        headers: { 'User-Agent': UA },
    });
    if (!resp.ok) {
        throw new CommandExecutionError(`Failed to fetch 12306 station bundle: HTTP ${resp.status}`);
    }
    return parseStationBundle(await resp.text());
}

/** Mint a 12306 anonymous session by hitting /otn/leftTicket/init. */
export async function mintSession(fetchImpl = fetch) {
    const resp = await fetchImpl(INIT_URL, {
        headers: { 'User-Agent': UA },
        redirect: 'follow',
    });
    if (!resp.ok) {
        throw new CommandExecutionError(`Failed to mint 12306 session: HTTP ${resp.status}`);
    }
    const setCookies = typeof resp.headers.getSetCookie === 'function'
        ? resp.headers.getSetCookie()
        : resp.headers.raw?.()['set-cookie'] || [];
    const cookieHeader = buildCookieHeader(setCookies);
    if (!cookieHeader) {
        throw new CommandExecutionError('12306 init returned no session cookies');
    }
    return cookieHeader;
}

/**
 * Twelve-row train query record (LEFT_TICKET_DTO).
 *
 * 12306 returns each train as a `|`-separated string with ~36 fields.
 * Positions used here come from the public web client; unused
 * positions are documented inline so future maintainers can extend
 * the row shape without re-reverse-engineering.
 */
export function parseTrainRecord(line, stationByCode) {
    const f = line.split('|');
    if (f.length < 33) return null;
    return {
        train_no: f[2] || '',
        code: f[3] || '',
        from_station: stationByCode.get(f[6])?.name || f[6] || '',
        to_station: stationByCode.get(f[7])?.name || f[7] || '',
        from_code: f[6] || '',
        to_code: f[7] || '',
        start_time: f[8] || '',
        arrive_time: f[9] || '',
        duration: f[10] || '',
        available: (f[1] || '').trim() === '预订' || (f[11] || '').trim() === 'Y',
        business_seat: f[32] || '',
        first_seat: f[31] || '',
        second_seat: f[30] || '',
        soft_sleeper: f[23] || '',
        hard_sleeper: f[28] || '',
        hard_seat: f[29] || '',
        no_seat: f[26] || '',
    };
}

/**
 * Mask helpers for sensitive identity fields rendered by 12306.
 *
 * 12306 already masks ID numbers and mobile numbers server-side
 * (`xxxx***********xxx` / `138****xxxx`); these helpers handle the
 * remaining fields (email, real Chinese name) so the adapter never
 * leaks unmasked PII without an explicit `--include-sensitive` opt-in.
 */
export function maskEmail(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    const at = v.indexOf('@');
    if (at <= 0) return v;
    const local = v.slice(0, at);
    const domain = v.slice(at);
    if (local.length <= 2) return local[0] + '*' + domain;
    return local[0] + '*'.repeat(Math.max(1, local.length - 2)) + local.slice(-1) + domain;
}

export function maskMobile(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (/\*/.test(v)) return v;
    if (v.length < 7) return v.replace(/.(?=.)/g, '*');
    return v.slice(0, 3) + '*'.repeat(v.length - 7) + v.slice(-4);
}

export function maskChineseName(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.length === 1) return v;
    if (v.length === 2) return v[0] + '*';
    return v[0] + '*'.repeat(v.length - 2) + v.slice(-1);
}

export function unwrapEvaluateResult(value) {
    if (
        value
        && typeof value === 'object'
        && !Array.isArray(value)
        && Object.prototype.hasOwnProperty.call(value, 'session')
        && Object.prototype.hasOwnProperty.call(value, 'data')
    ) {
        return value.data;
    }
    return value;
}

export function requireEvaluateObject(value, label) {
    const payload = unwrapEvaluateResult(value);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new CommandExecutionError(`12306 ${label} returned a malformed browser payload`);
    }
    return payload;
}

export function isAuthLikePayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const parts = [];
    if (Array.isArray(payload.messages)) parts.push(...payload.messages);
    if (payload.message) parts.push(payload.message);
    if (payload.msg) parts.push(payload.msg);
    if (payload.validateMessages && typeof payload.validateMessages === 'object') {
        parts.push(...Object.values(payload.validateMessages).flat());
    }
    const text = parts.map((item) => String(item ?? '')).join(' ');
    return /未登录|登录|请登录|身份|认证|session|Session|login/i.test(text);
}

/**
 * Detect the 12306 login marker by reading `document.cookie` from the
 * current adapter page. Cannot use `page.getCookies({url})` here:
 * 12306 sets the auth cookie `tk` and `JSESSIONID` with `Path=/otn`,
 * and CDP `Network.getCookies` with a bare URL filter excludes
 * cook
```

### Core Architecture Module: `clis/1point3acres/utils.js`
```
/**
 * Shared helpers for 一亩三分地 (1point3acres.com) adapters.
 *
 * Site is a Discuz!X PHP BBS that serves GBK-encoded HTML.
 * - Thread listings:  /bbs/forum.php?mod=guide&view={hot|new|digest|newthread}
 * - Forum:            /bbs/forum-<fid>-<page>.html
 * - Thread detail:    /bbs/thread-<tid>-<page>-1.html
 * - User profile:     /bbs/space-uid-<uid>.html  or  /bbs/space-username-<name>.html
 * - Search:           /bbs/search.php?mod=forum  (COOKIE — guests get an alert page)
 */
import { AuthRequiredError, ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const BASE = 'https://www.1point3acres.com/bbs';

/**
 * Validate `limit` per typed-fail-fast convention (no silent clamp).
 * Throws ArgumentError on non-positive / non-integer / out-of-range input.
 */
export function normalizeLimit(value, defaultValue, maxValue, label = 'limit') {
    const limit = normalizePositiveInteger(value, defaultValue, label);
    if (limit > maxValue) {
        throw new ArgumentError(`${label} must be <= ${maxValue}`);
    }
    return limit;
}

/** Validate a positive integer argument without silently flooring/clamping. */
export function normalizePositiveInteger(value, defaultValue, label = 'value', { min = 1 } = {}) {
    const raw = value ?? defaultValue;
    const limit = Number(raw);
    if (!Number.isInteger(limit) || limit <= 0) {
        throw new ArgumentError(`${label} must be a positive integer`);
    }
    if (limit < min) {
        throw new ArgumentError(`${label} must be >= ${min}`);
    }
    return limit;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0 Safari/537.36';

/** Fetch a GBK-encoded Discuz page and return decoded UTF-8 HTML. */
export async function fetchHtml(url, { headers = {}, cookie = '' } = {}) {
    let res;
    try {
        res = await fetch(url, {
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                ...(cookie ? { Cookie: cookie } : {}),
                ...headers,
            },
            redirect: 'follow',
        });
    } catch (error) {
        throw new CommandExecutionError(`1point3acres request failed: ${error?.message || error}`);
    }
    if (!res.ok) {
        throw new CommandExecutionError(`1point3acres request failed: HTTP ${res.status} ${res.statusText} from ${url}`);
    }
    const buf = await res.arrayBuffer();
    return new TextDecoder('gbk').decode(buf);
}

/** Pull cookie string from the live browser session for this domain.
 *  Discuz auth cookies (4Oaf_61d6_*, session) are HttpOnly and set on the
 *  root domain `.1point3acres.com`, so we need `getCookies` (not document.cookie)
 *  AND we need to query both host + root domain and merge.
 */
export async function getCookie(page) {
    if (!page) return '';
    const seen = new Map();
    if (typeof page.getCookies === 'function') {
        for (const opts of [{ domain: 'www.1point3acres.com' }, { domain: '.1point3acres.com' }]) {
            try {
                const cookies = await page.getCookies(opts);
                for (const c of cookies || []) {
                    if (!seen.has(c.name)) seen.set(c.name, c.value);
                }
            } catch { /* try next */ }
        }
    }
    if (seen.size > 0) {
        return [...seen].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    try {
        const result = await page.evaluate('document.cookie');
        return typeof result === 'string' ? result : '';
    } catch {
        return '';
    }
}

/** Detect the "you are a guest" alert page that Discuz returns for protected actions. */
export function assertNotGuestAlert(html, domain = 'www.1point3acres.com') {
    if (/<title>提示信息 \| 一亩三分地<\/title>/.test(html) && /无法进行此操作/.test(html)) {
        throw new AuthRequiredError(domain, '需要登录一亩三分地后再使用该命令');
    }
}

const ENTITY_MAP = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
    '&quot;': '"', '&#39;': "'", '&apos;': "'",
};

/** Decode HTML entities (numeric + common named). */
export function decodeEntities(s) {
    if (!s) return '';
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, m => ENTITY_MAP[m] || m);
}

/** Strip HTML tags and collapse whitespace, returning plain text. */
export function stripHtml(html) {
    if (!html) return '';
    return decodeEntities(
        String(html)
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|tr)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
    ).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Truncate text to n characters with ellipsis. */
export function truncate(s, n = 300) {
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
}

/** Extract all <tbody id="normalthread_*"> blocks from a forum/guide page. */
export function parseThreadRows(html) {
    const rows = [];
    const re = /<tbody id="(normalthread|stickthread)_(\d+)"[^>]*>([\s\S]*?)<\/tbody>/g;
    let m;
    while ((m = re.exec(html))) {
        const [, kind, tid, inner] = m;
        rows.push({ kind, tid, inner });
    }
    return rows;
}

/** Parse a single Discuz thread row (inner HTML of the tbody). */
export function parseThreadRow({ kind, tid, inner }) {
    const titleMatches = [...inner.matchAll(/<a [^>]*class="[^"]*\bxst\b[^"]*"[^>]*>([^<]+)<\/a>/g)];
    const title = titleMatches.length
        ? decodeEntities(titleMatches[titleMatches.length - 1][1].trim())
        : '';

    const forumMatch = inner.match(/<a href="forum-(\d+)-1\.html"[^>]*target="_blank"[^>]*>([^<]+)<\/a>/);
    const fid = forumMatch ? forumMatch[1] : '';
    const forumName = forumMatch ? decodeEntities(forumMatch[2].trim()) : '';

    // <td class="by"> blocks; first with <cite> = author, last with <cite> = last reply
    const byBlocks = [...inner.matchAll(/<td class="by"[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    const readCite = (block) => {
        const m = block.match(/<cite[^>]*>([\s\S]*?)<\/cite>/);
        if (!m) return '';
        return decodeEntities(m[1].replace(/<[^>]+>/g, '').trim());
    };
    const readTime = (block) => {
        const titleM = block.match(/<span [^>]*title="([^"]+)"[^>]*>/);
        if (titleM) return titleM[1].trim();
        const plainA = block.match(/<em>[\s\S]*?<a [^>]*>\s*([^<]+?)\s*<\/a>/);
        if (plainA) return decodeEntities(plainA[1].trim());
        const plainSpan = block.match(/<em>[\s\S]*?<span[^>]*>\s*([^<]+?)\s*<\/span>/);
        if (plainSpan) return decodeEntities(plainSpan[1].trim());
        const bare = block.match(/<em>\s*([^<]+?)\s*<\/em>/);
        return bare ? decodeEntities(bare[1].trim()) : '';
    };
    let authorBlock = '';
    let lastBlock = '';
    for (const b of byBlocks) {
        if (/<cite/.test(b)) {
            if (!authorBlock) authorBlock = b;
            lastBlock = b;
        }
    }
    const author = authorBlock ? readCite(authorBlock) : '';
    const postTime = authorBlock ? readTime(authorBlock) : '';
    const lastReplyUser = lastBlock && lastBlock !== authorBlock ? readCite(lastBlock) : '';
    const lastReplyTime = lastBlock && lastBlock !== authorBlock ? readTime(lastBlock) : '';

    const numMatch = inner.match(/<td class="num"[^>]*>\s*<a[^>]*class="xi2"[^>]*>(\d+)<\/a>(?:\s*<em>(\d+)<\/em>)?/);
    const replies = numMatch ? Number(numMatch[1]) : 0;
    const views = numMatch && numMatch[2] ? Number(numMatch[2]) : 0;
    return {
        tid,
        kind,
        title,
        author,
        forum: forumName,
        fid,
        replies,
        views,
        postTime,
        lastReplyUser,
        lastReplyTime,
        url: `${BASE}/thread-${tid}-1-1.html`,
    };
}

/** Quick one-shot listing parser used by hot/latest/digest/forum. */
export function parseThreadList(html) {
    return parseThreadRows(html).map(parseThreadRow).filter(t => t.title);
}

/**
 * Parse Discuz search results page (different HTML shape than forum listings).
 * Each hit is <li class="pbw" id="TID"> containing h3 > a[href*="tid=TID"],
 * <p class="xg1">N 个回复 - M 次查看</p>, and a time/author/forum <p>.
 */
export function parseSearchList(html) {
    const items = [];
    const re = /<li class="pbw" id="(\d+)">([\s\S]*?)<\/li>/g;
    let m;
    while ((m = re.exec(html))) {
        const [, tid, inner] = m;
        const titleMatch = inner.match(/<h3[^>]*>\s*<a [^>]*>([\s\S]*?)<\/a>/);
        const titleRaw = titleMatch ? titleMatch[1] : '';
        const title = decodeEntities(titleRaw.replace(/<[^>]+>/g, '')).trim();
        if (!title) continue;

        const statsMatch = inner.match(/<p class="xg1">\s*([\d,]+)\s*个回复\s*-\s*([\d,]+)\s*次查看\s*<\/p>/);
        const replies = statsMatch ? Number(statsMatch[1].replace(/,/g, '')) : 0;
        const views = statsMatch ? Number(statsMatch[2].replace(/,/g, '')) : 0;

        const metaMatch = inner.match(/<p>\s*<span>([^<]+)<\/span>[\s\S]*?<a [^>]*space-uid-\d+[^>]*>([^<]+?)<\/a>[\s\S]*?<a [^>]*href="forum-(\d+)-[^"]*"[^>]*>([^<]+?)<\/a>/);
        const postTime = metaMatch ? decodeEntities(metaMatch[1].trim()) : '';
        const author = metaMatch ? decodeEntities(metaMatch[2].trim()) : '';
        const fid = metaMatch ? metaMatch[3] : '';
        const forumName = metaMatch ? decodeEntities(metaMatch[4].trim()) : '';

        items.push({
            tid, title, author, forum: forumName, fid,
            replies, views, postTime,
            // Search pages don't show lastReplyTime separately — surface postTime instead.
            lastReplyUser: '', lastReplyTime: postTime,
            url: `${BASE}/thread-${tid}-1-1.html`,
        });
    }
    return items;
}

export { UA };

```

### Core Architecture Module: `clis/51job/utils.js`
```
/**
 * 51job shared utilities.
 *
 * Key design points:
 * - we.51job.com is protected by Aliyun WAF — bare `curl` / Node-side fetch
 *   gets a slider CAPTCHA HTML page. Only browser-context fetch (page.evaluate)
 *   with the session's cookies survives the challenge.
 * - `document.cookie` exposes the anti-bot cookies (`acw_sc__v2`, `ssxmod_itna`
 *   etc.) — no HttpOnly/login needed for public pages.
 * - API (`we.51job.com/api/job/search-pc`) is same-origin when we've navigated
 *   to `https://we.51job.com/...`, so fetch inside page.evaluate works.
 * - Detail / company pages live on `jobs.51job.com` and render data into the
 *   DOM (SSR), so adapters for those navigate and scrape.
 */

import { CliError } from '@jackwener/opencli/errors';

export const WE_ORIGIN = 'https://we.51job.com';
export const JOBS_ORIGIN = 'https://jobs.51job.com';

/**
 * City name / alias → 6-digit jobArea code. `000000` is the national bucket.
 * Covers the 40 largest cities the search UI surfaces. Unknown input passed
 * as-is if it's already 6 digits; otherwise fall back to `000000` (all).
 */
export const CITY_CODES = {
    '全国': '000000', 'all': '000000',
    '北京': '010000', 'beijing': '010000',
    '上海': '020000', 'shanghai': '020000',
    '广州': '030200', 'guangzhou': '030200',
    '深圳': '040000', 'shenzhen': '040000',
    '武汉': '180200', 'wuhan': '180200',
    '西安': '200200', "xi'an": '200200', 'xian': '200200',
    '杭州': '080200', 'hangzhou': '080200',
    '南京': '070200', 'nanjing': '070200',
    '成都': '090200', 'chengdu': '090200',
    '苏州': '070300', 'suzhou': '070300',
    '重庆': '060000', 'chongqing': '060000',
    '天津': '050000', 'tianjin': '050000',
    '长沙': '190200', 'changsha': '190200',
    '郑州': '170200', 'zhengzhou': '170200',
    '青岛': '120300', 'qingdao': '120300',
    '合肥': '150200', 'hefei': '150200',
    '厦门': '110300', 'xiamen': '110300',
    '无锡': '070400', 'wuxi': '070400',
    '济南': '120200', 'jinan': '120200',
    '佛山': '030700', 'foshan': '030700',
    '东莞': '030800', 'dongguan': '030800',
    '宁波': '080300', 'ningbo': '080300',
    '福州': '110200', 'fuzhou': '110200',
    '昆明': '250200', 'kunming': '250200',
    '大连': '230300', 'dalian': '230300',
    '沈阳': '230200', 'shenyang': '230200',
    '哈尔滨': '220200', 'haerbin': '220200', 'harbin': '220200',
    '石家庄': '160200', 'shijiazhuang': '160200',
    '贵阳': '260200', 'guiyang': '260200',
    '南宁': '100200', 'nanning': '100200',
    '南昌': '130200', 'nanchang': '130200',
    '长春': '240200', 'changchun': '240200',
    '太原': '210200', 'taiyuan': '210200',
    '兰州': '280200', 'lanzhou': '280200',
    '乌鲁木齐': '310200', 'urumqi': '310200',
    '海口': '270200', 'haikou': '270200',
    '香港': '330000', 'hongkong': '330000', 'hk': '330000',
};

/** Salary bucket code (matches 51job's `salary` filter). */
export const SALARY_CODES = {
    '不限': '',
    '2千以下': '01', '2-3千': '02', '3-4.5千': '03',
    '4.5-6千': '04', '6-8千': '05', '8k-1万': '06', '8-10k': '06',
    '1-1.5万': '07', '10-15k': '07',
    '1.5-2万': '08', '15-20k': '08',
    '2-3万': '09', '20-30k': '09',
    '3-5万': '10', '30-50k': '10',
    '5万以上': '11', '50k以上': '11',
};

/** Work experience bucket. */
export const WORKYEAR_CODES = {
    '不限': '',
    '在校生': '01', '应届': '02', '1年以下': '03',
    '1-3年': '04', '3-5年': '05', '5-7年': '06',
    '7-10年': '07', '10年以上': '08',
};

/** Degree bucket. */
export const DEGREE_CODES = {
    '不限': '',
    '初中及以下': '01', '高中/中技/中专': '02', '高中': '02',
    '大专': '03', '本科': '04', '硕士': '05', '博士': '06',
};

/** Company ownership type. */
export const COMPANY_TYPE_CODES = {
    '不限': '',
    '外资': '01', '欧美': '0101', '日韩': '0102',
    '合资': '02', '国企': '03', '民营': '04',
    '上市公司': '05', '创业公司': '06', '事业单位': '07',
    '非营利': '08', '政府': '09',
};

/** Company headcount bucket. */
export const COMPANY_SIZE_CODES = {
    '不限': '',
    '少于50': '01', '50以下': '01',
    '50-150': '02', '150-500': '03',
    '500-1000': '04', '1000-5000': '05',
    '5000-10000': '06', '10000以上': '07',
};

/** Sort strategy. */
export const SORT_CODES = {
    '综合': '0', 'relevance': '0', 'default': '0',
    '最新': '1', 'new': '1', 'newest': '1',
    '薪资': '2', 'salary': '2', 'pay': '2',
    '距离': '9', 'distance': '9',
};

export function resolveCity(input) {
    if (!input) return '000000';
    const s = String(input).trim();
    if (!s || s === '全国' || s.toLowerCase() === 'all') return '000000';
    if (/^\d{6}$/.test(s)) return s;
    const key = s.toLowerCase();
    if (CITY_CODES[s] !== undefined) return CITY_CODES[s];
    if (CITY_CODES[key] !== undefined) return CITY_CODES[key];
    for (const [name, code] of Object.entries(CITY_CODES)) {
        if (typeof name === 'string' && name.includes(s)) return code;
    }
    throw new CliError('INVALID_ARGUMENT', `Unknown city/area "${s}"`, 'Use a supported city name like "杭州" or a 6-digit city code');
}

export function resolveCode(input, table, fallback = '') {
    if (input === undefined || input === null || input === '') return fallback;
    const s = String(input).trim();
    if (table[s] !== undefined) return table[s];
    const key = s.toLowerCase();
    if (table[key] !== undefined) return table[key];
    if (Object.values(table).includes(s)) return s;
    for (const [k, v] of Object.entries(table)) {
        if (typeof k === 'string' && k.includes(s)) return v;
    }
    return fallback;
}

export function requirePage(page) {
    if (!page) throw new CliError('INTERNAL_ERROR', 'Browser page required (adapter must set browser: true)');
}

/**
 * Navigate the page to a URL and give the SPA a moment to settle. Reuses
 * existing session cookies — first call on a fresh browser may trigger the
 * Aliyun WAF interstitial, which the headless Chromium solves automatically
 * because the JS that sets `acw_sc__v2` runs in the page.
 */
export async function navigateTo(page, url, waitSeconds = 2) {
    await page.goto(url);
    await page.wait({ time: waitSeconds });
}

/**
 * Browser-context fetch: execute `fetch(url, { credentials: 'include' })`
 * inside the page so cookies apply and WAF sees a real browser. Returns
 * parsed JSON; throws on network / parse / status failure.
 */
export async function pageFetchJson(page, url, opts = {}) {
    const method = opts.method ?? 'GET';
    const body = opts.body ?? null;
    const timeout = opts.timeout ?? 15000;
    const headers = opts.headers ?? {};
    const script = `
        async () => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), ${timeout});
            try {
                const resp = await fetch(${JSON.stringify(url)}, {
                    method: ${JSON.stringify(method)},
                    credentials: 'include',
                    headers: ${JSON.stringify({ Accept: 'application/json', ...headers })},
                    ${body !== null ? `body: ${JSON.stringify(body)},` : ''}
                    signal: ctrl.signal,
                });
                const text = await resp.text();
                return { ok: resp.ok, status: resp.status, text };
            } catch (e) {
                return { ok: false, status: 0, text: '', error: String(e && e.message || e) };
            } finally {
                clearTimeout(timer);
            }
        }
    `;
    const res = await page.evaluate(script);
    if (res.error) throw new CliError('HTTP_ERROR', `51job fetch failed: ${res.error}`);
    if (!res.ok) throw new CliError('HTTP_ERROR', `51job HTTP ${res.status}`);
    if (res.text.trim().startsWith('<')) {
        throw new CliError('ANTI_BOT', '51job returned HTML (likely Aliyun WAF slider). Refresh browser session.');
    }
    try {
        return JSON.parse(res.text);
    } catch (e) {
        throw new CliError('API_ERROR', `51job invalid JSON: ${res.text.slice(0, 200)}`);
    }
}

/**
 * Build the canonical search-pc URL. All optional filters default to empty
 * (no constraint). `scene=7` + `source=1` match what the real SPA sends.
 */
export function buildSearchUrl(params) {
    const qs = new URLSearchParams();
    qs.set('api_key', '51job');
    qs.set('timestamp', String(Date.now()));
    qs.set('keyword', params.keyword ?? '');
    qs.set('searchType', '2');
    qs.set('function', params.function ?? '');
    qs.set('industry', params.industry ?? '');
    qs.set('jobArea', params.jobArea ?? '000000');
    qs.set('jobArea2', params.jobArea2 ?? '');
    qs.set('landmark', params.landmark ?? '');
    qs.set('metro', params.metro ?? '');
    qs.set('salary', params.salary ?? '');
    qs.set('workYear', params.workYear ?? '');
    qs.set('degree', params.degree ?? '');
    qs.set('companyType', params.companyType ?? '');
    qs.set('companySize', params.companySize ?? '');
    qs.set('jobType', params.jobType ?? '');
    qs.set('issueDate', params.issueDate ?? '');
    qs.set('sortType', params.sortType ?? '0');
    qs.set('pageNum', String(params.pageNum ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    qs.set('source', '1');
    qs.set('scene', '7');
    return `${WE_ORIGIN}/api/job/search-pc?${qs.toString()}`;
}

/**
 * Map a raw search-pc `resultbody.job.items[i]` into the canonical row shape
 * we expose to the user. Kept here so `search` and `hot` stay aligned.
 */
export function mapJobItem(it, rank) {
    const area = it.jobAreaLevelDetail || {};
    return {
        rank,
        jobId: String(it.jobId ?? ''),
        title: it.jobName ?? '',
        salary: it.provideSalaryString ?? '',
        salaryMin: Number(it.jobSalaryMin ?? 0) || 0,
        salaryMax: Number(it.jobSalaryMax ?? 0) || 0,
        city: area.cityString ?? it.jobAreaString ?? '',
        district: area.districtString ?? '',
        workYear: it.workYearString ?? '',
        degree: it.degreeString ?? '',
        tags: Array.isArray(it.jobTags) ? it.jobTags.join(',') : '',
        company: it.companyName ?? '',
        companyFull: it.fullCompanyName ?? '',
        companyType: it.companyTypeString ?? '',
        companySi
```

### Core Architecture Module: `clis/apple-podcasts/utils.js`
```
/**
 * Shared Apple Podcasts utilities.
 *
 * Uses the public iTunes Search API — no API key required.
 * https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */
import { CliError } from '@jackwener/opencli/errors';
const BASE = 'https://itunes.apple.com';
export async function itunesFetch(path) {
    const resp = await fetch(`${BASE}${path}`);
    if (!resp.ok) {
        throw new CliError('FETCH_ERROR', `iTunes API HTTP ${resp.status}`, 'Check your search term or podcast ID');
    }
    return resp.json();
}
/** Format milliseconds to mm:ss. Returns '-' for missing input. */
export function formatDuration(ms) {
    if (!ms || !Number.isFinite(ms))
        return '-';
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
/** Format ISO date string to YYYY-MM-DD. Returns '-' for missing input. */
export function formatDate(iso) {
    if (!iso)
        return '-';
    return iso.slice(0, 10);
}

```

### Core Architecture Module: `clis/arxiv/utils.js`
```
/**
 * arXiv adapter utilities.
 *
 * arXiv exposes a public Atom/XML API — no key required.
 * https://info.arxiv.org/help/api/index.html
 */
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
export const ARXIV_BASE = 'https://export.arxiv.org/api/query';
const ARXIV_CATEGORY_PATTERN = /^[a-z]+(?:-[a-z]+)*(?:\.[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)?$/;
export async function arxivFetch(params) {
    const resp = await fetch(`${ARXIV_BASE}?${params}`);
    if (!resp.ok) {
        throw new CommandExecutionError(`arXiv API HTTP ${resp.status}`, 'Check your search term or paper ID');
    }
    return resp.text();
}
export function normalizeArxivLimit(value, defaultValue, maxValue, label = 'limit') {
    const raw = value ?? defaultValue;
    const limit = Number(raw);
    if (!Number.isInteger(limit) || limit <= 0) {
        throw new ArgumentError(`arxiv ${label} must be a positive integer`);
    }
    if (limit > maxValue) {
        throw new ArgumentError(`arxiv ${label} must be <= ${maxValue}`);
    }
    return limit;
}
export function normalizeArxivCategory(value) {
    const category = String(value || '').trim();
    if (!ARXIV_CATEGORY_PATTERN.test(category)) {
        throw new ArgumentError(`Invalid arXiv category "${value}". Examples: cs.CL, cs.LG, math.PR, q-bio.NC, physics.comp-ph`);
    }
    return category;
}
/** Decode the small set of XML entities arXiv emits in text fields. */
function decodeEntities(s) {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'");
}
/** Extract the text content of the first matching XML tag. */
function extract(xml, tag) {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return m ? m[1].trim() : '';
}
/** Extract all text contents of a repeated XML tag. */
function extractAll(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    const results = [];
    let m;
    while ((m = re.exec(xml)) !== null)
        results.push(m[1].trim());
    return results;
}
/** Extract the value of a named attribute from the first matching tag (open or self-closing). */
function extractAttr(xml, tag, attr) {
    const m = xml.match(new RegExp(`<${tag}\\b[^>]*?\\b${attr}="([^"]*)"`));
    return m ? m[1] : '';
}
/** Extract all values of a named attribute across repeated tags. */
function extractAllAttr(xml, tag, attr) {
    const re = new RegExp(`<${tag}\\b[^>]*?\\b${attr}="([^"]*)"`, 'g');
    const out = [];
    let m;
    while ((m = re.exec(xml)) !== null)
        out.push(m[1]);
    return out;
}
/** Find the href of the first <link> tag matching a given rel. */
function findLinkHref(xml, rel) {
    const re = /<link\b([^>]*)\/?>/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        const attrs = m[1];
        if (new RegExp(`\\brel="${rel}"`).test(attrs)) {
            const h = attrs.match(/\bhref="([^"]*)"/);
            if (h)
                return h[1];
        }
    }
    return '';
}
/** Parse Atom XML feed into structured entries. */
export function parseEntries(xml) {
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    const entries = [];
    let m;
    while ((m = entryRe.exec(xml)) !== null) {
        const e = m[1];
        const rawId = extract(e, 'id');
        const arxivId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
        const pdf = findLinkHref(e, 'related') || `https://arxiv.org/pdf/${arxivId}`;
        entries.push({
            id: arxivId,
            title: decodeEntities(extract(e, 'title').replace(/\s+/g, ' ')),
            authors: decodeEntities(extractAll(e, 'name').join(', ')),
            abstract: decodeEntities(extract(e, 'summary').replace(/\s+/g, ' ')),
            published: extract(e, 'published').slice(0, 10),
            updated: extract(e, 'updated').slice(0, 10),
            primary_category: extractAttr(e, 'arxiv:primary_category', 'term'),
            categories: extractAllAttr(e, 'category', 'term').join(', '),
            comment: decodeEntities(extract(e, 'arxiv:comment').replace(/\s+/g, ' ')),
            pdf,
            url: `https://arxiv.org/abs/${arxivId}`,
        });
    }
    return entries;
}

```

### Core Architecture Module: `clis/autohome/score.js`
```
/**
 * autohome score — 口碑 (owner-rating) summary for a car series.
 *
 * Reads `__NEXT_DATA__.props.pageProps.baseData` (+ `qualityData`) from the
 * koubei page `k.autohome.com.cn/<seriesId>`: overall rating, per-dimension
 * scores, level, guide price, the reliability PPH (每百辆车故障数), and the
 * competitor comparison. All unsigned, login-free. Returns a key/value sheet.
 *
 * Note: Autohome's per-review TEXT list loads from a separate signed XHR and
 * is intentionally not scraped — this command surfaces the aggregate only.
 */

import { cli, Strategy } from '@jackwener/opencli/registry';
import {
    AH_KOUBEI_BASE,
    SCORE_COLUMNS,
    CommandExecutionError,
    EmptyResultError,
    assertPlainObject,
    ahFetch,
    clean,
    extractPageProps,
    normalizeSeriesId,
} from './utils.js';

/** Number or null. */
function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Pure parser: koubei pageProps → field/value rows. Exported for unit tests.
 */
export function parseScore(pp, seriesId) {
    const bd = assertPlainObject(pp?.baseData, 'autohome baseData');
    const qd = (pp && pp.qualityData) || {};

    const competitors = (Array.isArray(bd.cmpSeriesScore) ? bd.cmpSeriesScore : [])
        .map((c) => {
            const name = clean(c.seriesname || c.seriesName);
            const s = c.average || c.score;
            return name ? `${name}(${s})` : '';
        })
        .filter(Boolean)
        .slice(0, 4)
        .join(', ');

    const fields = [
        ['series_id', String(seriesId)],
        ['name', clean(bd.seriesname)],
        ['brand', clean(bd.brandName)],
        ['level', clean(bd.levelname)],
        ['guide_price', bd.pricerange ? `${clean(bd.pricerange)}万` : ''],
        ['overall', num(bd.average ?? bd.seriesAverage)],
    ];

    for (const axis of (Array.isArray(bd.seriesScoreList) ? bd.seriesScoreList : [])) {
        const label = clean(axis.typeName);
        if (label) fields.push([label, num(axis.score)]);
    }

    fields.push(['pph_每百车故障', num(qd.pph)]);
    fields.push(['review_users', num(qd.userCount)]);
    fields.push(['competitors', competitors]);
    fields.push(['url', `${AH_KOUBEI_BASE}/${seriesId}`]);

    return fields.map(([field, value]) => ({ field, value }));
}

cli({
    site: 'autohome',
    name: 'score',
    access: 'read',
    aliases: ['koubei', 'rating'],
    description: '汽车之家车系口碑评分（总分 + 各维度 + 故障率PPH + 竞品对比，免登录）',
    strategy: Strategy.PUBLIC,
    browser: false,
    args: [
        { name: 'series_id', required: true, positional: true, help: '车系 ID（来自 brand 的 series_id，或 k.autohome.com.cn/<id> URL）' },
    ],
    columns: SCORE_COLUMNS,
    func: async (args) => {
        const seriesId = normalizeSeriesId(args.series_id);
        const html = await ahFetch(`${AH_KOUBEI_BASE}/${seriesId}`, `score ${seriesId}`);
        const pp = extractPageProps(html);
        if (!pp) {
            throw new CommandExecutionError(
                `autohome score ${seriesId}`,
                'No koubei data found — the series id may be wrong, or Autohome changed its page.',
            );
        }
        const rows = parseScore(pp, seriesId);
        const map = Object.fromEntries(rows.map((r) => [r.field, r.value]));
        if (!map.name && map.overall == null) {
            throw new EmptyResultError(
                `autohome score ${seriesId}`,
                'This series has no koubei rating yet.',
            );
        }
        return rows;
    },
});

```

### Core Architecture Module: `clis/autohome/utils.js`
```
/**
 * Shared helpers for the 汽车之家 (Autohome) adapter.
 *
 * Autohome's keyword-search and per-trim-config JSON APIs are app-signature
 * gated (and the config page additionally uses CSS font-glyph obfuscation),
 * so those are deliberately NOT used — they cannot be read reliably without a
 * browser running Autohome's signing code, and faking partial data would be
 * worse than omitting it. Two sources ARE clean, no-login, plain-HTTP:
 *
 *   1. The brand catalog `grade/carhtml/<INITIAL>.html` — every series of a
 *      brand with its 指导价 (guide price), keyed by the brand's pinyin
 *      initial letter (hence the BRAND_INITIAL map below).
 *   2. The 口碑 page `k.autohome.com.cn/<seriesId>` — a Next.js page whose
 *      `__NEXT_DATA__.props.pageProps.baseData` carries the aggregate owner
 *      rating (overall + per-dimension), level, price, competitors, and the
 *      reliability PPH (每百辆车故障数).
 *
 * So the adapter searches by BRAND (you almost always know the brand) and
 * reads ratings by seriesId — both unsigned, both login-free.
 */

import {
    ArgumentError,
    CommandExecutionError,
    EmptyResultError,
} from '@jackwener/opencli/errors';

export const AH_BASE = 'https://www.autohome.com.cn';
export const AH_KOUBEI_BASE = 'https://k.autohome.com.cn';

const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export const BRAND_COLUMNS = ['series_id', 'name', 'price', 'url'];
export const SCORE_COLUMNS = ['field', 'value'];

/**
 * 中文品牌名 → 车系目录页的拼音首字母 (grade/carhtml/<X>.html).
 * Covers the brands people actually search; unknown brands raise a clear
 * error rather than guessing the wrong page.
 */
export const BRAND_INITIAL = {
    奥迪: 'A', 阿斯顿马丁: 'A', 阿尔法罗密欧: 'A', 阿维塔: 'A', 埃安: 'A', 极狐: 'A',
    宝马: 'B', 奔驰: 'B', 比亚迪: 'B', 别克: 'B', 本田: 'B', 标致: 'B', 保时捷: 'B', 宝骏: 'B', 北京: 'B', 北汽: 'B', 宾利: 'B', 北京现代: 'B',
    长安: 'C', 长城: 'C', 长安启源: 'C', 长安欧尚: 'C', 传祺: 'C',
    大众: 'D', 东风: 'D', 道奇: 'D', 东风风行: 'D', 东风小康: 'D',
    法拉利: 'F', 福特: 'F', 丰田: 'F', 菲亚特: 'F', 福田: 'F', 方程豹: 'F', 飞凡: 'F',
    广汽: 'G', 广汽丰田: 'G', 广汽本田: 'G', 高合: 'G',
    哈弗: 'H', 红旗: 'H', 海马: 'H', 悍马: 'H', 哈飞: 'H', 华晨: 'H',
    吉利: 'J', 捷豹: 'J', 极氪: 'J', 江淮: 'J', 几何: 'J', 捷途: 'J', 金杯: 'J', 江铃: 'J', 吉普: 'J', 极石: 'J',
    凯迪拉克: 'K', 克莱斯勒: 'K', 开瑞: 'K', 凯翼: 'K',
    兰博基尼: 'L', 路虎: 'L', 雷克萨斯: 'L', 林肯: 'L', 铃木: 'L', 劳斯莱斯: 'L', 雷诺: 'L', 理想: 'L', 领克: 'L', 零跑: 'L', 路特斯: 'L', 岚图: 'L', 猎豹: 'L',
    马自达: 'M', 迈巴赫: 'M', 名爵: 'M', 玛莎拉蒂: 'M', 迈凯伦: 'M',
    哪吒: 'N',
    欧拉: 'O',
    奇瑞: 'Q', 起亚: 'Q',
    日产: 'R', 荣威: 'R',
    斯巴鲁: 'S', 斯柯达: 'S', 三菱: 'S', 上汽大通: 'S', 思皓: 'S', 赛力斯: 'S', smart: 'S',
    特斯拉: 'T', 腾势: 'T', 坦克: 'T',
    沃尔沃: 'W', 五菱: 'W', 蔚来: 'W', 威马: 'W', 魏牌: 'W', 问界: 'W',
    现代: 'X', 雪佛兰: 'X', 雪铁龙: 'X', 小鹏: 'X', 星途: 'X', 小米: 'X',
    英菲尼迪: 'Y', 一汽: 'Y', 野马: 'Y', 仰望: 'Y',
    智己: 'Z', 中华: 'Z', 众泰: 'Z',
};

/** Resolve a brand name to its catalog initial letter. */
export function resolveBrandInitial(brandArg) {
    const raw = String(brandArg || '').trim();
    if (!raw) throw new ArgumentError('brand must be a non-empty value');
    // single A-Z letter passes through (advanced: fetch a whole letter page)
    if (/^[A-Za-z]$/.test(raw)) return raw.toUpperCase();
    const key = raw.replace(/[·\s]/g, '');
    if (BRAND_INITIAL[key]) return BRAND_INITIAL[key];
    if (BRAND_INITIAL[raw]) return BRAND_INITIAL[raw];
    throw new ArgumentError(
        'brand',
        `unknown brand '${brandArg}'. Pass a known Chinese brand name (e.g. 宝马 / 比亚迪 / 理想) or a single A-Z catalog letter.`,
    );
}

/** Normalize a series id: a bare number or an autohome URL containing it. */
export function normalizeSeriesId(rawInput) {
    const raw = String(rawInput || '').trim();
    if (!raw) throw new ArgumentError('series_id must be a non-empty value');
    const m = raw.match(/\/(?:s)?(\d+)(?:\/|$|\.)/) || raw.match(/^s?(\d+)$/);
    if (!m) {
        throw new ArgumentError(`'${rawInput}' does not look like an autohome series id (a number, or a k.autohome.com.cn/<id> URL)`);
    }
    return m[1];
}

export function clean(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
}

export function requireLimit(value, def, max) {
    const raw = value == null || value === '' ? def : value;
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isInteger(n) || n < 1 || n > max) {
        throw new ArgumentError(`limit must be an integer between 1 and ${max}`);
    }
    return n;
}

export function requireStableId(value, label) {
    const id = String(value ?? '').trim();
    if (!/^\d+$/.test(id)) throw new CommandExecutionError(`${label} did not include a stable numeric id.`);
    return id;
}

export function requireText(value, label) {
    const text = clean(value);
    if (!text) throw new CommandExecutionError(`${label} did not include a stable text value.`);
    return text;
}

export function assertPlainObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new CommandExecutionError(`${label} returned an unexpected payload shape; expected an object.`);
    }
    return value;
}

/** Fetch an Autohome page as text. The grade + koubei pages are UTF-8. */
export async function ahFetch(url, contextHint) {
    let resp;
    try {
        resp = await fetch(url, {
            headers: {
                'User-Agent': UA,
                Referer: `${AH_BASE}/`,
                'Accept-Language': 'zh-CN,zh;q=0.9',
            },
        });
    } catch (err) {
        throw new CommandExecutionError(`autohome ${contextHint} network error: ${err?.message || err}`);
    }
    if (!resp.ok) {
        throw new CommandExecutionError(`autohome ${contextHint} HTTP ${resp.status}`);
    }
    return resp.text();
}

/** Extract __NEXT_DATA__ pageProps from a koubei page (pure, testable). */
export function extractPageProps(html) {
    const m = String(html || '').match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
        const data = JSON.parse(m[1]);
        return (data && data.props && data.props.pageProps) || null;
    } catch {
        return null;
    }
}

export { ArgumentError, CommandExecutionError, EmptyResultError };

```

### Core Architecture Module: `clis/bbc/utils.js`
```
// Shared helpers for the bbc adapters that hit BBC's public RSS feeds.
import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';

export const BBC_FEED_BASE = 'https://feeds.bbci.co.uk/news';
const UA = 'opencli-bbc-adapter (+https://github.com/jackwener/opencli)';

const HTML_ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ',
};

export function decodeHtmlEntities(value) {
    return String(value ?? '')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g, (m) => HTML_ENTITIES[m] || m);
}

/** Extract `<tag>…</tag>` (CDATA-aware) from a block. */
export function extractRssTag(block, tag) {
    const cdata = block.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`));
    if (cdata) return cdata[1];
    const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
    return plain ? plain[1] : '';
}

export function parseRssItems(xml) {
    const out = [];
    const re = /<item[^>]*>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = re.exec(String(xml || ''))) !== null) {
        const block = m[1];
        out.push({
            title: decodeHtmlEntities(extractRssTag(block, 'title')).trim(),
            description: decodeHtmlEntities(extractRssTag(block, 'description')).trim(),
            link: decodeHtmlEntities(extractRssTag(block, 'link')).trim(),
            pubDate: decodeHtmlEntities(extractRssTag(block, 'pubDate')).trim(),
            guid: decodeHtmlEntities(extractRssTag(block, 'guid')).trim(),
        });
    }
    return out;
}

export function requireBoundedInt(value, defaultValue, maxValue, label = 'limit') {
    const raw = value ?? defaultValue;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
        throw new ArgumentError(`bbc ${label} must be a positive integer`);
    }
    if (n > maxValue) {
        throw new ArgumentError(`bbc ${label} must be <= ${maxValue}`);
    }
    return n;
}

export async function bbcFetchRss(path, label) {
    const url = `${BBC_FEED_BASE}/${path}`;
    let resp;
    try {
        resp = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml' } });
    }
    catch (err) {
        throw new CommandExecutionError(
            `${label} request failed: ${err?.message ?? err}`,
            'Check that feeds.bbci.co.uk is reachable from this network.',
        );
    }
    if (!resp.ok) {
        throw new CommandExecutionError(`${label} returned HTTP ${resp.status} (${url})`);
    }
    return resp.text();
}

/** Convert RFC-822 pubDate to ISO `YYYY-MM-DD`; empty string on parse failure. */
export function pubDateToIso(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

```

### Core Architecture Module: `clis/bilibili/utils.js`
```
/**
 * Bilibili shared helpers: WBI signing, authenticated fetch, nav data, UID resolution.
 */
import https from 'node:https';
import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

const EXACT_BVID_RE = /^BV[0-9A-Za-z]{10}$/;
const VIDEO_HOSTS = new Set(['bilibili.com', 'www.bilibili.com', 'm.bilibili.com']);

/**
 * Parse one exact, case-sensitive BVID or a trusted bilibili.com video URL.
 * Unlike the legacy short-link resolver, this is synchronous and never treats
 * malformed input as a b23.tv network lookup.
 */
export function parseBvidOrVideoUrl(value) {
    const raw = String(value ?? '').trim();
    if (EXACT_BVID_RE.test(raw)) return raw;

    let parsed;
    try {
        parsed = new URL(raw);
    }
    catch {
        throw new ArgumentError('Expected an exact BVID or bilibili.com video URL, for example BV1xx411c7mD');
    }
    if (!VIDEO_HOSTS.has(parsed.hostname) || parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
        throw new ArgumentError('Expected a trusted HTTPS bilibili.com video URL without credentials or a custom port');
    }
    const match = parsed.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10})\/?$/);
    if (!match) {
        throw new ArgumentError('Bilibili video URL did not contain an exact case-sensitive BVID');
    }
    return match[1];
}
/**
 * Resolve Bilibili short URL / short code to BV ID.
 * Supports: BV1MV9NBtENN, XYzsqGa, b23.tv/XYzsqGa, https://b23.tv/XYzsqGa
 */
export function resolveBvid(input) {
    const trimmed = String(input).trim();
    if (/^BV[A-Za-z0-9]+$/i.test(trimmed)) {
        return Promise.resolve(trimmed);
    }
    try {
        const parsed = new URL(trimmed);
        if (/(\.|^)bilibili\.com$/i.test(parsed.hostname)) {
            const match = parsed.pathname.match(/\/(?:video|bangumi\/play)\/(BV[A-Za-z0-9]+)/i);
            if (match) {
                return Promise.resolve(match[1]);
            }
        }
    }
    catch {
        // Non-URL inputs fall through to b23.tv short-code resolution.
    }
    const shortCode = trimmed.replace(/^https?:\/\//, '').replace(/^(www\.)?b23\.tv\//, '');
    if (!/^[A-Za-z0-9]+$/.test(shortCode)) {
        return Promise.reject(new Error(`Cannot resolve BV ID from invalid b23.tv short code: ${trimmed}`));
    }
    const url = 'https://b23.tv/' + shortCode;
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            const location = res.headers.location;
            if (location) {
                const match = location.match(/\/video\/(BV[A-Za-z0-9]+)/);
                if (match) {
                    res.resume();
                    resolve(match[1]);
                    return;
                }
            }
            res.resume();
            reject(new Error(`Cannot resolve BV ID from short URL: ${trimmed}`));
        });
        req.on('error', reject);
        req.setTimeout(4000, () => { req.destroy(); reject(new Error(`Timeout resolving short URL: ${trimmed}`)); });
    });
}
/**
 * 解析 --page 选集序号（分P / 视频选集）。
 * 缺省/空串 → null（不下钻，保持整集默认 P1 旧行为）。
 * 非正十进制整数 → 抛 ArgumentError（参数错误，不静默吞）。
 */
export function parsePageArg(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') {
        if (Number.isSafeInteger(value) && value >= 1) return value;
        throw new ArgumentError(`--page must be a positive decimal integer, got: ${value}`);
    }
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        throw new ArgumentError(`--page must be a positive decimal integer, got: ${String(value)}`);
    }
    const n = Number(value);
    if (!Number.isSafeInteger(n)) {
        throw new ArgumentError(`--page is too large: ${value}`);
    }
    return n;
}

function readApiPositiveInteger(value, label) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) {
        return value;
    }
    if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
        const n = Number(value);
        if (Number.isSafeInteger(n)) return n;
    }
    throw new CommandExecutionError(`Bilibili view API returned a malformed ${label}`);
}

/**
 * 从 view API 的 data.pages 数组取第 N 集（1-based）。
 * page/cid 都以 view API 的 pages[] 为 source-of-truth；缺失、重复或畸形都 fail closed。
 * 返回该集 raw 对象（含 cid / part(分集标题) / page / duration）。
 */
export function selectVideoPart(viewData, pageNum) {
    const pages = Array.isArray(viewData?.pages) ? viewData.pages : null;
    if (!pages || pages.length === 0) {
        throw new CommandExecutionError('Bilibili view API did not return pages[] for --page selection');
    }
    const matches = [];
    for (const entry of pages) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new CommandExecutionError('Bilibili view API returned a malformed pages[] entry');
        }
        const apiPage = readApiPositiveInteger(entry.page, 'page number');
        if (apiPage === pageNum) {
            matches.push(entry);
        }
    }
    if (matches.length > 1) {
        throw new CommandExecutionError(`Bilibili view API returned duplicate page entries for p=${pageNum}`);
    }
    const part = matches[0];
    if (!part) {
        const total = pages.length || viewData?.videos || 1;
        throw new CommandExecutionError(`分P 序号超出范围：p=${pageNum}（该视频共 ${total} 集）`);
    }
    readApiPositiveInteger(part.cid, `cid for p=${pageNum}`);
    return part;
}

const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52,
];
export function stripHtml(s) {
    return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}
export function payloadData(payload) {
    return payload?.data ?? payload;
}
async function getNavData(page) {
    return page.evaluate(`
    async () => {
      const res = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' });
      return await res.json();
    }
  `);
}
async function getWbiKeys(page) {
    const nav = await getNavData(page);
    const wbiImg = nav?.data?.wbi_img ?? {};
    const imgUrl = wbiImg.img_url ?? '';
    const subUrl = wbiImg.sub_url ?? '';
    const imgKey = imgUrl.split('/').pop()?.split('.')[0] ?? '';
    const subKey = subUrl.split('/').pop()?.split('.')[0] ?? '';
    return { imgKey, subKey };
}
function getMixinKey(imgKey, subKey) {
    const raw = imgKey + subKey;
    return MIXIN_KEY_ENC_TAB.map(i => raw[i] || '').join('').slice(0, 32);
}
async function md5(text) {
    const { createHash } = await import('node:crypto');
    return createHash('md5').update(text).digest('hex');
}
export async function wbiSign(page, params) {
    const { imgKey, subKey } = await getWbiKeys(page);
    const mixinKey = getMixinKey(imgKey, subKey);
    const wts = Math.floor(Date.now() / 1000);
    const sorted = {};
    const allParams = { ...params, wts: String(wts) };
    for (const key of Object.keys(allParams).sort()) {
        sorted[key] = String(allParams[key]).replace(/[!'()*]/g, '');
    }
    // Bilibili WBI verification expects %20 for spaces, not + (URLSearchParams default).
    // Using + causes signature mismatch → CORS-blocked error response → TypeError: Failed to fetch.
    const query = new URLSearchParams(sorted).toString().replace(/\+/g, '%20');
    const wRid = await md5(query + mixinKey);
    sorted.w_rid = wRid;
    return sorted;
}
export async function apiGet(page, path, opts = {}) {
    const baseUrl = 'https://api.bilibili.com';
    let params = opts.params ?? {};
    if (opts.signed) {
        params = await wbiSign(page, params);
    }
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString().replace(/\+/g, '%20');
    const url = `${baseUrl}${path}?${qs}`;
    return fetchJson(page, url);
}
export async function fetchJson(page, url) {
    const urlJs = JSON.stringify(url);
    return page.evaluate(`
    async () => {
      const res = await fetch(${urlJs}, { credentials: "include" });
      return await res.json();
    }
  `);
}
/**
 * Bilibili write APIs return a JSON envelope `{ code, message, data }`. A non-zero
 * `code` carries either an auth/permission failure (login expired, CSRF rejected,
 * forbidden) or an application-level error (rate limit, validation, etc.). These
 * two helpers route the envelope to the right typed error so every write adapter
 * surfaces login problems as `AuthRequiredError`, not a generic execution error.
 */
export function isAuthLikeBilibiliError(code, message) {
    return code === -101 || code === -111 || code === -403 || /csrf|登录|账号|权限|forbidden|permission|login/i.test(String(message ?? ''));
}

export function requireOkPayload(payload, label) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.hasOwn(payload, 'code')) {
        throw new CommandExecutionError(`Bilibili ${label} API returned a malformed payload`);
    }
    if (payload.code !== 0) {
        const message = payload.message ?? 'unknown error';
        if (isAuthLikeBilibiliError(payload.code, message)) {
            throw new AuthRequiredError('bilibili.com', `Bilibili ${label} API requires login or permission: ${message} (${payload.code})`);
        }
        throw new CommandExecutionError(`Bilibili ${label} API failed: ${message} (${payload.code})`);
    }
    return payload.data;
}

/**
 * POST form-encoded params to a Bilibili API endpoint.
 * Runs inside the logged-in browser context and auto-attaches the bili_jct CSRF token,
 * which Bilibili requires on every authenticated write request.
 */
export async function apiPost(page, path, opts = {}) {
    const params = opts.params ?? {};
    const stringified = Object.fr
```

### Core Architecture Module: `clis/bloomberg/utils.js`
```
import { CliError } from '@jackwener/opencli/errors';
export const BLOOMBERG_FEEDS = {
    main: 'https://feeds.bloomberg.com/news.rss',
    markets: 'https://feeds.bloomberg.com/markets/news.rss',
    economics: 'https://feeds.bloomberg.com/economics/news.rss',
    industries: 'https://feeds.bloomberg.com/industries/news.rss',
    tech: 'https://feeds.bloomberg.com/technology/news.rss',
    politics: 'https://feeds.bloomberg.com/politics/news.rss',
    opinions: 'https://feeds.bloomberg.com/bview/news.rss',
    green: 'https://feeds.bloomberg.com/green/news.rss',
    crypto: 'https://feeds.bloomberg.com/crypto/news.rss',
    pursuits: 'https://feeds.bloomberg.com/pursuits/news.rss',
};
// Note: the Businessweek RSS feed (feeds.bloomberg.com/businessweek/news.rss) is now served
// empty by Bloomberg, so the `businessweek` command reads the section page instead (see
// businessweek.js). Other sections still publish working RSS feeds.
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; opencli)';
// Bloomberg's edge occasionally serves a transient empty/non-OK RSS response under load; a
// couple of quick retries turn those intermittent misses into a successful fetch instead of a
// hard NOT_FOUND. A feed that is genuinely empty still surfaces NOT_FOUND after the retries.
export async function fetchBloombergFeed(name, limit = 1) {
    const feedUrl = BLOOMBERG_FEEDS[name];
    if (!feedUrl) {
        throw new CliError('ARGUMENT', `Unknown Bloomberg feed: ${name}`);
    }
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
        const resp = await fetch(feedUrl, {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
        });
        if (!resp.ok) {
            lastError = new CliError('FETCH_ERROR', `Bloomberg RSS HTTP ${resp.status}`, 'Bloomberg may be temporarily unavailable; try again later.');
            continue;
        }
        const xml = await resp.text();
        const items = parseBloombergRss(xml);
        if (items.length) {
            const count = Math.max(1, Math.min(Number(limit) || 1, 20));
            return items.slice(0, count);
        }
        lastError = new CliError('NOT_FOUND', 'Bloomberg RSS feed returned no items', 'Bloomberg may have changed the feed format.');
    }
    throw lastError;
}
export function parseBloombergRss(xml) {
    const items = [];
    const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml))) {
        const block = match[1];
        const title = extractTagText(block, 'title');
        const summary = extractTagText(block, 'description');
        const link = extractTagText(block, 'link') || extractTagText(block, 'guid');
        const mediaLinks = extractMediaLinksFromRssItem(block);
        if (!title || !link)
            continue;
        items.push({
            title,
            summary,
            link,
            mediaLinks,
        });
    }
    return items;
}
export function normalizeBloombergLink(input) {
    const raw = String(input || '').trim();
    if (!raw) {
        throw new CliError('ARGUMENT', 'A Bloomberg link is required');
    }
    if (raw.startsWith('/'))
        return `https://www.bloomberg.com${raw}`;
    return raw;
}
export function validateBloombergLink(input) {
    const normalized = normalizeBloombergLink(input);
    let url;
    try {
        url = new URL(normalized);
    }
    catch {
        throw new CliError('ARGUMENT', `Invalid Bloomberg link: ${input}`, 'Pass a full https://www.bloomberg.com/... URL or a relative Bloomberg path.');
    }
    if (!/(?:\.|^)bloomberg\.com$/i.test(url.hostname)) {
        throw new CliError('ARGUMENT', `Expected a bloomberg.com link, got: ${url.hostname}`, 'Pass a Bloomberg article URL from bloomberg.com.');
    }
    return url.toString();
}
export function renderStoryBody(body) {
    const blocks = Array.isArray(body?.content) ? body.content : [];
    const parts = blocks
        .map((block) => renderBlock(block, 0))
        .map((part) => normalizeBlockText(part))
        .filter(Boolean);
    return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function extractStoryMediaLinks(story) {
    const urls = new Set();
    collectMediaUrls(story?.ledeImageUrl, urls);
    collectMediaUrls(story?.socialImageUrl, urls);
    collectMediaUrls(story?.lede, urls);
    collectMediaUrls(story?.imageAttachments, urls);
    collectMediaUrls(story?.videoAttachments, urls);
    const mediaBlocks = Array.isArray(story?.body?.content)
        ? story.body.content.filter((block) => block?.type === 'media')
        : [];
    collectMediaUrls(mediaBlocks, urls);
    return [...urls];
}
function renderBlock(block, depth) {
    if (!block || typeof block !== 'object')
        return '';
    switch (block.type) {
        case 'paragraph':
            return renderInlineNodes(block.content || []);
        case 'heading': {
            const text = renderInlineNodes(block.content || []);
            if (!text)
                return '';
            const level = Number(block.data?.level ?? block.data?.weight ?? 2);
            const prefix = level <= 1 ? '# ' : level === 2 ? '## ' : '### ';
            return `${prefix}${text}`;
        }
        case 'blockquote': {
            const text = renderInlineNodes(block.content || []);
            if (!text)
                return '';
            return text.split('\n').map((line) => line ? `> ${line}` : '>').join('\n');
        }
        case 'list':
            return renderListBlock(block, depth);
        case 'tabularData':
            return renderTabularDataBlock(block);
        case 'media':
            return renderMediaBlock(block);
        case 'inline-newsletter':
        case 'newsletter':
        case 'ad':
            return '';
        default: {
            if (Array.isArray(block.content) && block.content.length > 0) {
                const inlineText = renderInlineNodes(block.content);
                if (inlineText)
                    return inlineText;
                const nested = block.content.map((child) => renderBlock(child, depth + 1)).filter(Boolean);
                if (nested.length)
                    return nested.join('\n');
            }
            return extractGenericText(block);
        }
    }
}
function renderInlineNodes(nodes) {
    return nodes.map((node) => renderInlineNode(node)).join('');
}
function renderInlineNode(node) {
    if (node == null)
        return '';
    if (typeof node === 'string')
        return decodeXmlEntities(node);
    switch (node.type) {
        case 'text':
            return decodeXmlEntities(node.value || '');
        case 'linebreak':
            return '\n';
        case 'link':
        case 'entity':
        case 'strong':
        case 'emphasis':
        case 'italic':
        case 'underline':
        case 'span':
            if (Array.isArray(node.content) && node.content.length > 0) {
                return renderInlineNodes(node.content);
            }
            return decodeXmlEntities(node.value || '');
        default:
            if (Array.isArray(node.content) && node.content.length > 0) {
                return renderInlineNodes(node.content);
            }
            if (typeof node.value === 'string')
                return decodeXmlEntities(node.value);
            return '';
    }
}
function renderListBlock(block, depth) {
    const items = Array.isArray(block.content) ? block.content : [];
    if (!items.length)
        return '';
    const listStyle = String(block.subType || block.data?.style || block.data?.listType || '');
    const ordered = /\bordered\b|\bnumber(?:ed)?\b/i.test(listStyle);
    let index = 1;
    return items
        .map((item) => {
        const prefix = ordered ? `${index++}. ` : '- ';
        return renderListItem(item, prefix, depth);
    })
        .filter(Boolean)
        .join('\n');
}
function renderListItem(item, prefix, depth) {
    const indent = '  '.repeat(depth);
    const body = normalizeBlockText(renderListItemBody(item, depth + 1));
    if (!body)
        return '';
    const lines = body.split('\n');
    const head = `${indent}${prefix}${lines[0]}`;
    if (lines.length === 1)
        return head;
    const continuationIndent = `${indent}${' '.repeat(prefix.length)}`;
    const tail = lines.slice(1).map((line) => `${continuationIndent}${line}`).join('\n');
    return `${head}\n${tail}`;
}
function renderListItemBody(item, depth) {
    if (!item || typeof item !== 'object')
        return '';
    if (item.type === 'list-item' && Array.isArray(item.content)) {
        const parts = item.content
            .map((child) => child?.type === 'paragraph'
            ? renderInlineNodes(child.content || [])
            : renderBlock(child, depth))
            .map((part) => normalizeBlockText(part))
            .filter(Boolean);
        return parts.join('\n');
    }
    return renderBlock(item, depth);
}
function renderTabularDataBlock(block) {
    const rows = block?.data?.rows ?? block?.data?.table?.rows ?? block?.content;
    if (!Array.isArray(rows) || !rows.length) {
        return extractGenericText(block.data || block.content || block);
    }
    const lines = rows
        .map((row) => extractGenericText(row))
        .map((line) => normalizeBlockText(line))
        .filter(Boolean);
    return lines.join('\n');
}
function renderMediaBlock(block) {
    const candidates = [
        block?.data?.chart?.caption,
        block?.data?.attachment?.caption,
        block?.data?.attachment?.title,
        block?.data?.attachment?.subtitle,
        block?.data?.video?.caption,
    ];
    const caption = candidates
        .map((value) => normalizeBlockText(stripHtml(String(value || ''))))
        .find(Boolean);
    return caption || '';
}
function extractGenericText(value) {
    const parts = [];
    collectText(value, p
```

### Core Architecture Module: `clis/boss/utils.js`
```
import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';

// ── Constants ───────────────────────────────────────────────────────────────
const BOSS_DOMAIN = 'www.zhipin.com';
const CHAT_URL = `https://${BOSS_DOMAIN}/web/chat/index`;
const COOKIE_EXPIRED_CODES = new Set([7, 37]);
const COOKIE_EXPIRED_MSG = 'Cookie 已过期！请在当前 Chrome 浏览器中重新登录 BOSS 直聘。';
const AMBIGUOUS_AUTH_CODE = 37;
const ENVIRONMENT_REJECTED_MARKERS = ['环境存在异常', '环境异常', 'abnormal environment'];
const RECRUITER_ONLY_MSG = '该命令仅支持招聘端（BOSS 端）账号，请使用招聘者账号登录后重试。';
const DEFAULT_TIMEOUT = 15_000;
// ── Core helpers ────────────────────────────────────────────────────────────
/**
 * Assert that page is available (non-null).
 */
export function requirePage(page) {
    if (!page)
        throw new CommandExecutionError('Browser page required');
}
export function readPositiveInteger(raw, name, fallback, max) {
    const value = raw === undefined || raw === null || raw === '' ? fallback : Number(raw);
    if (!Number.isInteger(value) || value < 1) {
        throw new ArgumentError(`boss ${name} must be a positive integer`);
    }
    if (max !== undefined && value > max) {
        throw new ArgumentError(`boss ${name} must be <= ${max}`);
    }
    return value;
}
export function readRequiredString(raw, name) {
    const value = String(raw ?? '').trim();
    if (!value) {
        throw new ArgumentError(`boss ${name} cannot be empty`);
    }
    return value;
}
/**
 * Navigate to BOSS chat page and wait for it to settle.
 * This establishes the cookie context needed for subsequent API calls.
 */
export async function navigateToChat(page, waitSeconds = 2) {
    await page.goto(CHAT_URL);
    await page.wait({ time: waitSeconds });
}
/**
 * Navigate to a custom BOSS page (for search/detail that use different pages).
 */
export async function navigateTo(page, url, waitSeconds = 1) {
    await page.goto(url);
    await page.wait({ time: waitSeconds });
}
/**
 * Check if an API response indicates cookie expiry and throw a clear error.
 * Call this after every BOSS API response with a non-zero code.
 */
export function checkAuth(data) {
    if (COOKIE_EXPIRED_CODES.has(data.code)) {
        throw new AuthRequiredError(BOSS_DOMAIN, COOKIE_EXPIRED_MSG);
    }
}
function checkEnvironment(data) {
    const message = String(data.message || '').toLowerCase();
    if (data.code === AMBIGUOUS_AUTH_CODE &&
        ENVIRONMENT_REJECTED_MARKERS.some((marker) => message.includes(marker.toLowerCase()))) {
        throw new CommandExecutionError(`Boss rejected the current browser environment: ${data.message || 'Unknown error'} (code=${data.code})`, '重新登录通常无法解决此问题。请保留当前页面，稍后重试，并在问题持续时上报完整错误信息。');
    }
}
/**
 * Map BOSS code=24 ("请切换身份后再试") to a typed AuthRequiredError.
 * Recruiter-only commands (recommend, joblist, stats, resume, mark,
 * exchange, invite, greet, batchgreet) have no geek-side equivalent;
 * surfacing this as a generic COMMAND_EXEC hides what the user must do.
 * chatlist / chatmsg avoid this path by using `allowNonZero: true` and
 * branching to the geek-side fetch when they see code 24.
 */
function checkRecruiterSide(data) {
    if (data.code === IDENTITY_MISMATCH_CODE) {
        throw new AuthRequiredError(BOSS_DOMAIN, RECRUITER_ONLY_MSG);
    }
}
/**
 * Throw if the API response is not code 0.
 * Checks for cookie expiry first, then identity mismatch, then throws
 * with the provided message.
 */
export function assertOk(data, errorPrefix) {
    if (!data || typeof data !== 'object') {
        throw new CommandExecutionError(`${errorPrefix ? `${errorPrefix}: ` : ''}Boss API returned malformed response`);
    }
    if (data.code === 0)
        return;
    checkEnvironment(data);
    checkAuth(data);
    checkRecruiterSide(data);
    const prefix = errorPrefix ? `${errorPrefix}: ` : '';
    throw new CommandExecutionError(`${prefix}${data.message || 'Unknown error'} (code=${data.code})`);
}
/**
 * Make a credentialed XHR request via page.evaluate().
 *
 * This is the single XHR template — no more copy-pasting the same 15-line
 * XMLHttpRequest boilerplate across every adapter.
 *
 * @returns Parsed JSON response
 * @throws On network error, timeout, JSON parse failure, or cookie expiry
 */
export async function bossFetch(page, url, opts = {}) {
    const method = opts.method ?? 'GET';
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const body = opts.body ?? null;
    // Build the evaluate script. We use JSON.stringify for safe interpolation.
    const script = `
    async () => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(${JSON.stringify(method)}, ${JSON.stringify(url)}, true);
        xhr.withCredentials = true;
        xhr.timeout = ${timeout};
        xhr.setRequestHeader('Accept', 'application/json');
        ${method === 'POST' ? `xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');` : ''}
        xhr.onload = () => {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch(e) { reject(new Error('JSON parse failed: ' + xhr.responseText.substring(0, 200))); }
        };
        xhr.onerror = () => reject(new Error('Network Error'));
        xhr.ontimeout = () => reject(new Error('Timeout'));
        xhr.send(${body ? JSON.stringify(body) : 'null'});
      });
    }
  `;
    let data;
    try {
        data = await page.evaluate(script);
    } catch (error) {
        if (error instanceof AuthRequiredError || error instanceof CommandExecutionError) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new CommandExecutionError(`Boss API request failed: ${message}`);
    }
    if (!data || typeof data !== 'object') {
        throw new CommandExecutionError('Boss API returned malformed response');
    }
    // Auto-check auth unless caller opts out
    if (!opts.allowNonZero && data.code !== 0) {
        assertOk(data);
    }
    return data;
}
// ── Convenience helpers ─────────────────────────────────────────────────────
/**
 * Fetch the boss friend (chat) list.
 */
export async function fetchFriendList(page, opts = {}) {
    const pageNum = opts.pageNum ?? 1;
    const jobId = opts.jobId ?? '0';
    const url = `https://${BOSS_DOMAIN}/wapi/zprelation/friend/getBossFriendListV2.json?page=${pageNum}&status=0&jobId=${jobId}`;
    const data = await bossFetch(page, url, { allowNonZero: opts.allowNonZero });
    if (opts.allowNonZero && data.code !== 0) return data;
    const list = data.zpData?.friendList;
    if (!Array.isArray(list)) {
        throw new CommandExecutionError('Boss friend list response did not include zpData.friendList');
    }
    return list;
}
/**
 * Fetch the recommended candidates (greetRecSortList).
 */
export async function fetchRecommendList(page) {
    const url = `https://${BOSS_DOMAIN}/wapi/zprelation/friend/greetRecSortList`;
    const data = await bossFetch(page, url);
    const list = data.zpData?.friendList;
    if (!Array.isArray(list)) {
        throw new CommandExecutionError('Boss recommend response did not include zpData.friendList');
    }
    return list;
}
/**
 * Find a friend by encryptUid, searching through friend list and optionally greet list.
 * Returns null if not found.
 */
export async function findFriendByUid(page, encryptUid, opts = {}) {
    const maxPages = opts.maxPages ?? 1;
    const checkGreetList = opts.checkGreetList ?? false;
    // Search friend list pages
    for (let p = 1; p <= maxPages; p++) {
        const result = await fetchFriendList(page, { pageNum: p, allowNonZero: opts.allowNonZero });
        if (opts.allowNonZero && !Array.isArray(result)) {
            return { friend: null, code: result.code };
        }
        const friends = Array.isArray(result) ? result : [];
        const found = friends.find((f) => f.encryptUid === encryptUid);
        if (found)
            return opts.allowNonZero ? { friend: found, code: 0 } : found;
        if (friends.length === 0)
            break;
    }
    // Optionally check greet list
    if (checkGreetList) {
        const greetList = await fetchRecommendList(page);
        const found = greetList.find((f) => f.encryptUid === encryptUid);
        if (found)
            return opts.allowNonZero ? { friend: found, code: 0 } : found;
    }
    return opts.allowNonZero ? { friend: null, code: 0 } : null;
}
// ── UI automation helpers ───────────────────────────────────────────────────
/**
 * Click on a candidate in the chat list by their numeric UID.
 * @returns true if clicked, false if not found
 */
export async function clickCandidateInList(page, numericUid) {
    const uid = String(numericUid).replace(/[^0-9]/g, ''); // sanitize to digits only
    const result = await page.evaluate(`
    async () => {
      const uid = ${JSON.stringify(uid)};
      const item = document.querySelector('#_' + uid + '-0') || document.querySelector('[id^="_' + uid + '"]');
      if (item) {
        item.click();
        return { clicked: true };
      }
      const items = document.querySelectorAll('.geek-item');
      for (const el of items) {
        if (el.id && el.id.startsWith('_' + uid)) {
          el.click();
          return { clicked: true };
        }
      }
      return { clicked: false };
    }
  `);
    return result.clicked;
}
/**
 * Type a message into the chat editor and send it.
 * @returns true if sent successfully
 */
export async function typeAndSendMessage(page, text) {
    const typed = await page.evaluate(`
    async () => {
      const selectors = [
        '.chat-editor [contenteditable="true"]',
        '.chat-input [contenteditable="true"]',
        '.message-editor [contenteditable="true"]',
        '.chat-conversation [contenteditable="true"]',
        '[contenteditable="true"]',
        'textarea',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2434** (2026-08-29): **[Bug]: Omni 1.1 Flash: Flow job-list / flow job-status fail with client error 400**
  *Symptoms*: ### Description  Google Flow shipped a UI + model-lineup change on 2026-08-29. After it, `opencli flow job-list` and `opencli flow job-status` fail with `client error 400`, so **any polling workflow breaks** — but `flow gen` and `flow job-download` both still work.  ### Steps to Reproduce  ## Steps to reproduce  ```bash opencli flow credits            # works opencli flow models             # works opencli flow project-current    # works opencli flow project-list       # works  opencli flow job-list --limit 2       # FAILS: client error 400 opencli flow job-status --mediaId <any valid mediaId>   # FAILS: client error 400 ```  ### Actual output  ``` ok: false error:   code: UNKNOWN   message: client error 400   exitCode: 1 # AutoFix: re-run with --trace=retain-on-failure for trace artifact ```  ### Expected Behavior  ### Expected  A job list / job status.  ## The key detail: generation is NOT broken, only the job-query surface  This is what makes the bug easy to misdiagnose. Full sequence on a working account:  ```bash $ opencli flow gen --prompt "Medium shot, static. She lifts one hand from the table." \     --refs ./still.png --length 4 --aspect 16:9 --yes true - 状态: ✅ 已提交   消耗积分: 15   余额: 105   ok: true   mediaId: 4ea974f5-----------------03f6e827323d   model_raw: abra_r2v_4s  $ opencli flow job-status --mediaId 4ea974f5-----------------03f6e827323d   client error 400                       # ← broken  $ opencli flow job-download --mediaId 4ea974f5-----------------03f6e82732

- **Issue #2240** (2026-08-28): **[Bug]: doubao/ask times out after 90 seconds on v1.8.6 while Browser Bridge is connected**
  *Symptoms*: ### Description  On macOS, `opencli doubao ask` consistently times out after 90 seconds even though the OpenCLI daemon and Browser Bridge extension are connected.  Before running the command, I manually opened the Doubao chat page in the same connected Chrome profile and confirmed that the normal chat interface and message input were visible.  The test did not use `opencli doubao login`, automatic browser navigation, file uploads, or project data.  After 90 seconds, the command returned:  ```text ok: false error:   code: TIMEOUT   message: doubao/ask timed out after 90s   help: Try again, or increase timeout with --timeout <seconds> (or OPENCLI_BROWSER_COMMAND_TIMEOUT for the global default)   exitCode: 75 ```  The status command reported a connected page but could not determine the login state:  ```text opencli doubao status -f json  Status: Connected Login: Unknown Url: https://www.doubao.com/chat/ ```  `opencli doubao whoami -f json` exited with code `77` without returning a parseable account object.  The timeout may be caused by:  * a Doubao DOM or selector change; * the prompt not being inserted or submitted; * the response or completion state not being detected; * an unrecognized authentication or verification state; * the adapter selecting an unexpected page or session.  Possibly related issues:  * #1478: previous Doubao message selector drift after a DOM change; * #1894: Doubao verification challenge detection.  This symptom differs from #1894 because OpenCLI did not 
  **Post-Mortem & Fix Analysis**:
  > 关闭为已被更精确的当前版本复现取代。#2400 在 CLI 1.8.7 / extension 1.0.23 上复现了相同的 `doubao ask` 超时，并把根因缩小到 about:blank 租约页与被领养豆包标签之间的执行目标分裂，同时提供了稳定 workaround。#2240 只记录了 1.8.6 的泛化超时且没有更窄证据，继续并行保留会把同一故障拆成两条模糊队列；后续统一在 #2400 跟进。

- **Issue #2211** (2026-07-31): **[Bug]: opencli drains stdin at startup, silently breaking `while read` loops & pipelines (even `--version`/`--help`)**
  *Symptoms*: # [Bug] `opencli` consumes stdin at startup, silently breaking `while read` loops and shell pipelines (even `--version` / `--help`)  ## 环境 (Environment)  - opencli: `@jackwener/opencli` v1.8.5 (`opencli --version` → `1.8.5`) - Shim: `/usr/local/bin/opencli` → `BROWSERBRIDGE_MANAGED_SHIM` → `/Applications/OpenCLIApp.app/Contents/MacOS/opencli-app` (OpenCLIApp v0.1.36, Mach-O arm64) - OS: macOS 26.2 (arm64) - Shell: `/bin/sh`, tested with both `sh` and `bash` — same result  ## 现象 (Summary)  Every `opencli` invocation **unconditionally consumes all remaining stdin at process startup**, even for commands that never read input (e.g. `--version`, `--help`). When opencli is invoked inside a classic `while read` loop that itself reads from a pipe (or a file via stdin), the child process drains the shared stdin, so the loop's `read` hits EOF and the loop **silently terminates after the first iteration**.  I hit this while batch-fetching 17 Bilibili video summaries in a loop — only 1 of 17 ran, with no error at all. That silent partial execution is the dangerous part: no exit code, no warning, just "fewer items than expected".  ## 最小复现 (Minimal reproduction)  ```sh seq 3 | while read -r i; do   echo "iter $i start"   opencli --version   echo "iter $i end" done ```  **Actual output (bug):**  ``` iter 1 start 1.8.5 iter 1 end ```  Only **1 of 3** iterations executes. Same with `opencli --help`, same with any real command (e.g. `opencli doctor`).  **Control (no stdin-reading command):**  

- **Issue #2139** (2026-08-25): **[Bug]: OPENCLI_DAEMON_PORT is no longer supported (received 19825)**
  *Symptoms*: ### Description  ```shell > opencli doctor  error: OPENCLI_DAEMON_PORT is no longer supported (received 19825). The OpenCLI Chrome extension can only connect to localhost:19825. Unset OPENCLI_DAEMON_PORT and rerun opencli. ``` I have installed the latest OpenCLI APP and Chrome Exetention.  <img width="1989" height="200" alt="Image" src="https://github.com/user-attachments/assets/322fd8f4-966c-47c2-98b5-b963db2bfc93" />  <img width="980" height="680" alt="Image" src="https://github.com/user-attachments/assets/6af22cf6-7a42-484a-90a5-51d437abb8ff" />  <img width="318" height="214" alt="Image" src="https://github.com/user-attachments/assets/c68bb47d-16c9-4e3f-a470-36166a53941c" />  ### Steps to Reproduce  1. Run `opencli doctor` 2. See error   ### Expected Behavior  connect successfully  ### OpenCLI Version  can't execute  ### Node.js Version  20.x  ### Operating System  macOS  ### Logs / Screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > hey opencli team, whats the fix for this?? pls do proper testing, so this is so much waste of time for us?? 
  > Some findings from debugging this on macOS (OpenCLIApp 0.1.35, pkg install) that may help people who are stuck, plus one thing the app team may want to pick up:  **Root cause is already fixed on the CLI side in v1.8.6** (PR #2074, "tolerate OPENCLI_DAEMON_PORT at the default port"), but **OpenCLIApp 0.1.35 still bundles CLI 1.8.5**, so app-managed installs stay broken until an app release ships with a tolerant core. Two details we verified:  - The injection comes from the app **server process**: quitting/restarting the app doesn't help, and deleting `browserBridge.daemonPort` from `~/Library/Application Support/BrowserBridge/state.json` doesn't either — the server regenerates it on startup and injects `OPENCLI_DAEMON_PORT=19825` into every CLI child it spawns. - The menu-bar panel's "extension not connected" / "daemon not running" warning is **misleading**: the panel health-checks through the same broken managed path, so it stays yellow even when the daemon and extension are actually f
  > Resolved in the desktop distribution: OpenCLIApp v0.1.36 explicitly fixed the inherited  failure, and the current v0.1.38 release bundles OpenCLI 1.8.6, whose core tolerates the default injected port. Closing as completed. Please update OpenCLIApp if an older app-managed runtime is still installed.

- **Issue #2108** (2026-08-25): **# [Bug] File upload (`browser upload` / `page.uploadFiles`) fails with `-32000 "Not allowed"` on all sites via the extension bridge**
  *Symptoms*: ### Description  ## Summary `opencli browser <session> upload` and the adapter-facing `page.uploadFiles()` / `page.setFileInput()` fail on **every** site with a real `<input type=file>`. The Browser Bridge calls CDP `DOM.setFileInputFiles` directly with a `nodeId`, which Chrome rejects for **chrome.debugger-attached** debuggers since Chrome 72 (Chromium #928255). This makes file/image attachment non-functional for all adapters (Perplexity, ChatGPT, Gemini, Google AI Mode, etc.).  `opencli browser <session> upload` and the adapter-facing page.uploadFiles() / page.setFileInput() fail on EVERY site that has a real <input type=file>, with CDP error {"code":-32000,"message":"Not allowed"}. The input resolves fine (uploadFiles' own "not_file_input" guard passes) — only the final DOM.setFileInputFiles call is rejected. Tried both nodeId and backendNodeId; both fail.  Root cause: Chromium #928255 — since Chrome 72, DOM.setFileInputFiles is "Not allowed" when the debugger is attached via chrome.debugger (extensions) and called directly. It only works via the file-chooser interception flow. This blocks file/image attachment for ALL adapters (perplexity ask --attach, chatgpt image --image, project-file-add, etc.).  ## Environment - opencli v1.8.6, extension v1.0.22, Chrome 149, macOS - Browser Bridge (chrome.debugger extension), single connected profile  ## Reproduction ​```bash opencli --profile <p> browser ppx open "https://www.perplexity.ai" opencli --profile <p> browser ppx upload "
  **Post-Mortem & Fix Analysis**:
  > Adding a +1 from a fully automated / headless setup.  **Reproduced on opencli v1.8.7, Linux, Chrome 151, extension v1.0.22.** `opencli browser <s> upload "input[type=file]" <file>` → `{"code":-32000,"message":"Not allowed"}`, and the same happens through the adapter-facing `page.uploadFiles()` / `page.setFileInput()` path. The `<input type=file>` resolves fine (the `not_file_input` guard passes); only the final `DOM.setFileInputFiles` call is rejected.  **Why a "real" fix matters here:** a growing share of users drive Chrome **headless / CI / non-interactive**, where there is no human at the keyboard to open the native file-chooser dialog. When `DOM.setFileInputFiles` is refused under a `chrome.debugger` attachment (Chromium #928255), those sessions simply have no way to attach a file at all — so this single gate breaks image/file attachment for every adapter in headless automation, not just for interactive users who could click through the dialog manually.  **Workaround I can confirm 
  > Status update: this was fixed in #2125 (merged 2026-07-13). The Browser Bridge no longer calls `DOM.setFileInputFiles` with a bare nodeId — since extension **v1.0.23** it uses the file-chooser interception flow that Chromium requires for `chrome.debugger`-attached debuggers (`Page.setInterceptFileChooserDialog` → programmatic click → `Page.fileChooserOpened` → `DOM.setFileInputFiles` with the event's `backendNodeId`), which is exactly the path crbug 928255 left open.  Both reproductions in this thread report **extension v1.0.22**, which predates the fix. Please update the extension:  - **Manual/unpacked installs**: download `opencli-extension-v1.0.23.zip` from the [v1.8.7 release](https://github.com/jackwener/OpenCLI/releases/tag/v1.8.7) and reload (I verified this artifact contains the interception flow). - **Chrome Web Store installs**: chrome://extensions → Developer mode → Update, and check the version shows 1.0.23.  After updating, `opencli browser <session> upload` / `page.upload
  > Resolved by #2125 and shipped in v1.8.7 with Browser Bridge extension v1.0.23. The extension now uses the required file-chooser interception flow ( →  →  with the event ) instead of the rejected bare-node path. Both reports here used extension v1.0.22. Closing as completed; please reopen with a v1.0.23 reproduction if it persists.

- **Issue #2102** (2026-08-25): **[Bug]: Windows: OpenCLIApp CLI shim returns no output for commands**
  *Symptoms*: ### Description  On Windows, after installing OpenCLIApp, every openclicommand invoked from PowerShell produces zero output and no error​ — the prompt returns immediately: ```cmd PS> opencli --help PS> opencli --version PS> opencli list PS> opencli hackernews top --limit 5 ``` All silent. However, opencli doctor(invoked through the app's internal channel, not the shim) reports the runtime is healthy — Node found, daemon running, extension connected, OpenCLI runtime @jackwener/opencli@1.8.5resolved correctly at D:\01Software\OpenCLIApp\node_modules\@jackwener\opencli\dist\src\main.js. Root cause:​ The opencli.cmdshim under WindowsApps(C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\opencli.cmd) is an app-managed stub, but it fails to forward execution to the OpenCLIApp-managed Node runtime. When the stub can't launch the backing process (PATH conflict / execution policy / stub logic edge case), it exits silently with no stderr, making the failure invisible to the user.   ### Steps to Reproduce  1. Install OpenCLIApp desktop on Windows (v0.1.35, Store or installer). 2. Confirm opencliresolves to the WindowsApps stub: ```cmd Get-Command opencli # Path: C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\opencli.cmd ``` 3. Run any CLI command: ```cmd opencli --help opencli --version opencli list ``` 4. Observe: no stdout, no stderr, immediate return. 5. Compare with opencli doctor(works — it goes through the app's own channel, bypassing the shim): ```cmd Server status: runnin
  **Post-Mortem & Fix Analysis**:
  > Can confirm this on **OpenCLIApp 0.1.37 / Windows 11 ARM64 (Surface Pro X)**.  The app-managed shim is:  ```bat @echo off REM OPENCLIAPP_MANAGED_SHIM "%LOCALAPPDATA%\OpenCLIApp\opencli-app.exe" __opencli_shim %* ```  `opencli --version` / `opencli doctor` return immediately with **zero stdout and zero stderr**, matching this issue.  While debugging it I also found a separate ARM64 packaging problem: `%LOCALAPPDATA%\OpenCLIApp\node_modules\node\bin\node` has the magic bytes `CF FA ED FE` (Mach-O), so the bundled Node executable cannot run on Windows ARM64. With that runtime, nothing listens on port 19825 and the Edge/Chromium Browser Bridge v1.0.22 stays on `Reconnecting...`.  I replaced it with the official **Node.js v24.16.0 win-arm64 `node.exe`** and invoked the packaged OpenCLI runtime directly. That restored the daemon and bridge:  ```text opencli v1.8.6 doctor (node v24.16.0) [OK] Daemon: running on port 19825 (v1.8.6) [OK] Extension: connected (v1.0.22) [OK] Connectivity: connect
  > Resolved in OpenCLIApp v0.1.38. The Windows packaging fix now bundles the target Windows Node runtime, flattens app command results so stdout/stderr reach the managed shim, preserves non-zero install failures, and validates the installed batch shim path. v0.1.38 is the current desktop release. Closing as completed; please reopen with v0.1.38 diagnostics if output is still lost.
  > Confirmed fixed on OpenCLIApp 0.1.38 / Windows 11 ARM64 (Surface Pro X).  "opencli --version", "opencli doctor", and "opencli list" now return stdout normally through the managed WindowsApps shim. The bundled Node runtime is also correctly executable on Windows ARM64 ("v24.16.0"), and the daemon starts successfully on port 19825.  Thanks for the fix!

- **Issue #2072** (2026-07-03): **[Bug]: OpenCLI daemon not reachable on 127.0.0.1:19825: Connection refused (os error 61)**
  *Symptoms*: ### Description  MacOS 26.5.2 (25F84)  Chrome 149.0.7827.156 (arm64) OpenCLIApp 0.1.35 OpenCLI 1.0.21  the daemon cannot run till I run the script below: /Applications/OpenCLIApp.app/Contents/Resources/node_modules/node/bin/node \   /Applications/OpenCLIApp.app/Contents/Resources/node_modules/@jackwener/opencli/dist/src/daemon.js ℹ  [daemon] Listening on http://127.0.0.1:19825 ℹ  [daemon] Extension connected ℹ  [ext] [opencli] Connected to daemon ℹ  [daemon] Extension profile connected: *********  ### Steps to Reproduce  opencli doctor error: OPENCLI_DAEMON_PORT is no longer supported (received 19825). The OpenCLI Chrome extension can only connect to localhost:19825. Unset OPENCLI_DAEMON_PORT and rerun opencli.   ### Expected Behavior  can run smoothly  ### OpenCLI Version  no chance  ### Node.js Version  20.x  ### Operating System  macOS  ### Logs / Screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate of #2068 — same root cause: OpenCLIApp injects `OPENCLI_DAEMON_PORT=19825` into the environment of the CLI it manages, and CLI v1.8.5 hard-rejects the variable even when it carries the default port value, so the daemon never starts (your manual `node .../daemon.js` works precisely because it bypasses the injected env). Tracking the fix in #2068: the CLI will tolerate the variable when it equals the default 19825, and OpenCLIApp will stop injecting it.
  > thank you mate and please confirm when it will be released on https://opencli.info/download

- **Issue #2071** (2026-08-25): **[Bug]: div包裹svg，两个都标记数字，点击事件绑定在div上，svg没有绑定点击事件，在执行click时点击的是svg，导致事件无法触发**
  *Symptoms*: ### Description  [Bug]: div包裹svg，两个都标记数字，点击事件绑定在div上，svg没有绑定点击事件，在执行click时点击的是svg，导致事件无法触发  ### Steps to Reproduce  1. Run `opencli ...` 2. ... 3. See error   ### Expected Behavior  执行click时可知道点击div而非svg，从而触发点击事件  ### OpenCLI Version  1.8.4  ### Node.js Version  22.x  ### Operating System  macOS  ### Logs / Screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 小红书搜索文本，点击右下角的放大镜
  > 已由 #2126 修复并随 v1.8.7 发布。browser click 现在会做命中测试；当实际命中的是没有点击处理器的 SVG/子节点时，会重新定位到可点击祖先，并在结果中返回 click_method、hit、retargeted，不再把未触发的点击静默报成成功。现关闭为已完成；若新版本仍可复现，请附 trace 重新打开。

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

### Incident Patch 1: `2c598f58` (2026-08-30)
**Commit Message**: fix: javascript.lang.security.detect-child-process.detect-child-process security vulnerability (#2318)

Automated security fix generated by OrbisAI Security

**File**: `clis/spotify/spotify.js` (modified, +8/-3)
```diff
@@ -4,7 +4,7 @@ import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
 import { createServer } from 'http';
 import { homedir } from 'os';
 import { join } from 'path';
-import { exec } from 'child_process';
+import { execFile } from 'child_process';
 import { assertSpotifyCredentialsConfigured, getFirstSpotifyTrack, mapSpotifyTrackResults, parseDotEnv, resolveSpotifyCredentials, } from './utils.js';
 // ── Credentials ───────────────────────────────────────────────────────────────
 // Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET as environment variables,
@@ -99,8 +99,13 @@ async function findTrackUri(query) {
     return track;
 }
 function openBrowser(url) {
-    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
-    exec(cmd);
+    if (process.platform === 'win32') {
+        execFile('cmd', ['/c', 'start', '', url]);
+    } else if (process.platform === 'darwin') {
+        execFile('open', [url]);
+    } else {
+        execFile('xdg-open', [url]);
+    }
 }
 // ── Commands ──────────────────────────────────────────────────────────────────
 cli({
```

---

### Incident Patch 2: `48712502` (2026-08-29)
**Commit Message**: fix(xiaohongshu): stop ask breaking on webpack chunk renumbering, and stop it spending a note search per call (#2420)

* fix(xiaohongshu): locate 点点 conversation store by fingerprint, not a hardcoded module id

webpackRequire(6404) throws "Cannot read properties of undefined (reading
'call')" once Xiaohongshu renumbers its webpack chunks, which it did
(6404 -> 32914). Every `ask` call then fails in ~4s, before any chat happens.
Reported in #2408.

A hardcoded numeric module id has no contract with the site, so patching in the
new number only resets the clock until the next redeploy. This tries the known
ids first (zero scan cost in the common case), then locates the module by what
it *is*: scan webpackRequire.m for a factory whose source mentions both
createConversation and sendMessage. On a live page that is 1 candidate out of
~1600 modules. The scan only calls .toString(), which has no side effects; a
candidate is executed only after its source matches the fingerprint.

Tests execute the generated page script against a fake webpack runtime, so the
lookup is exercised rather than asserted as a substring - including the case
that matters: a store sitting at an id in neither the kno

**File**: `clis/xiaohongshu/ask.js` (modified, +54/-3)
```diff
@@ -263,7 +263,41 @@ export function buildAskEvaluateJs(query, timeoutSeconds, sourceLimit) {
           let webpackRequire;
           window.webpackChunkxhs_pc_web.push([[Date.now()], {}, (req) => { webpackRequire = req; }]);
           if (!webpackRequire) return { ok: false, error: 'webpack_require_unavailable', page_url: location.href };
-          const mod = webpackRequire(6404);
+          // Locate the conversation store module.
+          //
+          // A hardcoded webpack module id has no contract with the site: Xiaohongshu
+          // renumbers chunks on redeploys, and when it does, webpackRequire(<stale id>)
+          // throws "Cannot read properties of undefined (reading 'call')" from webpack's
+          // own runtime and every ask fails. That already happened once (6404 -> 32914).
+          //
+          // So: try known ids first (zero scan cost in the common case), then fall back
+          // to locating the module by what it *is* rather than by its number. The scan
+          // only calls .toString() on factory functions, which has no side effects; a
+          // candidate is executed only after its source matches the fingerprint.
+          const looksLikeConversationModule = (candidate) => (
+            candidate
+            && typeof candidate.t === 'function'
+            && candidate.G
+            && typeof candidate.G.AiChat === 'string'
+          );
+          let mod = null;
+          for (const knownId of [32914, 6404]) {
+            try {
+              const candidate = webpackRequire(knownId);
+              if (looksLikeConversationModule(candidate)) { mod = candidate; break; }
+            } catch { /* id absent from this build */ }
+          }
+          if (!mod) {
+            for (const id of Object.keys(webpackRequire.m || {})) {
+              let source = '';
+              try { source = webpackRequire.m[id].toString(); } catch { continue; }
+              if (!source.includes('createConversation') || !source.includes('sendMessage')) continue;
+              try {
+                const candidate = webpackRequire(id);
+                if (looksLikeConversationModule(candidate)) { mod = candidate; break; }
+              } catch { /* not loadable, keep looking */ }
+            }
+          }
           const useConversationStore = mod?.t;
           const scenes = mod?.G || { AiChat: 'aiChat' };
           if (typeof useConversationStore !== 'function') {
@@ -406,8 +440,25 @@ export const command = cli({
         const query = requirePrompt(kwargs?.query);
         const timeout = parseAskTimeout(kwargs?.timeout);
         const sourceLimit = parseAskLimit(kwargs?.['source-limit']);
-        const keyword = encodeURIComponent(query);
-        await page.goto(`https://${XHS_WEB_HOST}/search_result?keyword=${keyword}&source=web_search_result_notes`);
+        // Enter through 点点's own page, not search_result?keyword=<query>.
+        //
+        // Two reasons, both measured 2026-08-28 on a live logged-in session:
+        //
+        // 1. Cost. Loading search_result?keyword=... fires a real note search
+        //    (so.xiaohongshu.com/api/sns/web/v2/search/notes) before any chat happens —
+        //    a search request spent purely as a side effect of the URL chosen to reach
+        //    a chat store. /ai_chat serves the same conversation store and fires zero
+        //    search/notes for the whole page lifetime.
+        // 2. Risk control. #1224 documented that direct navigation to
+        //    search_result?keyword=... triggers Xiaohongshu's security verification in
+        //    the automation browser; xiaohongshu/search was reworked away from that
+        //    exact pattern. ask still used it.
+        //
+        // Controlled A/B, identical query ("清迈 咖啡馆 推荐"), same session, minutes apart:
+        //    search_result -> 1238 chars, 5 sources, 1x search/notes
+        //    /ai_chat      -> 1195 chars, 5 sources, 0x search/notes
+        // The navigation contributes nothing to answer quality or citation count.
+        await page.goto(`https://${XHS_WEB_HOST}/ai_chat`);
         await page.wait?.(1);
         const raw = unwrapEvaluateResult(await page.evaluate(buildAskEvaluateJs(query, timeout, sourceLimit)));
         if (!raw || typeof raw !== 'object') {
```

**File**: `clis/xiaohongshu/ask.test.js` (modified, +71/-1)
```diff
@@ -197,7 +197,10 @@ describe('xiaohongshu ask', () => {
 
         const result = await cmd.func(page, { query: '上海露营需要注意什么？', timeout: 30, 'source-limit': 10 });
 
-        expect(page.goto).toHaveBeenCalledWith(expect.stringContaining('https://www.xiaohongshu.com/search_result?keyword='));
+        // 点点's own page, never search_result?keyword=... — that URL costs a real
+        // note search on load and is the pattern #1224 tied to security verification.
+        expect(page.goto).toHaveBeenCalledWith('https://www.xiaohongshu.com/ai_chat');
+        expect(page.goto).not.toHaveBeenCalledWith(expect.stringContaining('search_result'));
         expect(page.evaluate.mock.calls[0][0]).toContain('window.webpackChunkxhs_pc_web');
         expect(result).toMatchObject({
             answer: '答案正文',
@@ -265,3 +268,70 @@ describe('xiaohongshu ask', () => {
         expect(script).not.toContain('rounds[rounds.length - 1]');
     });
 });
+
+// Executes the generated page script against a fake webpack runtime, so the module
+// lookup is exercised for real rather than asserted as a substring. The point is the
+// module id: Xiaohongshu renumbers chunks on redeploys (6404 -> 32914 broke every ask),
+// so the lookup has to survive an id nobody has seen before.
+async function runAskScriptAgainstFakeRuntime({ moduleId, answer = '答案正文' }) {
+    const msgId = 'msg-1';
+    const store = {
+        switchScene: () => {},
+        clearConversation: () => {},
+        createConversation: () => {},
+        sendMessage: async () => msgId,
+        getSceneRounds: () => [{ aiMessage: { msgId, isFinished: true, text: answer } }],
+        agent: {
+            getResponseReferences: async () => ({
+                baseInfo: { totalCnt: 'ai总结7篇笔记生成' },
+                items: [{ id: '69d6fc08000000001f007646', title: '来源标题', nickName: '作者A' }],
+            }),
+        },
+    };
+    // toString() of this factory carries the fingerprint the scan looks for.
+    const conversationFactory = () => ({ marker: 'createConversation sendMessage' });
+    const decoyFactory = () => ({ marker: 'unrelated module' });
+    // moduleId === null models a build where the store is simply not present at all.
+    const exportsById = moduleId === null
+        ? {}
+        : { [moduleId]: { t: () => store, G: { AiChat: 'aiChat', Onebox: 'onebox' } } };
+    const webpackRequire = (id) => {
+        if (!(id in exportsById)) throw new TypeError("Cannot read properties of undefined (reading 'call')");
+        return exportsById[id];
+    };
+    webpackRequire.m = moduleId === null
+        ? { 4242: decoyFactory }
+        : { 4242: decoyFactory, [moduleId]: conversationFactory };
+
+    const priorWindow = globalThis.window;
+    const priorLocation = globalThis.location;
+    globalThis.window = {
+        webpackChunkxhs_pc_web: { push: ([, , cb]) => cb(webpackRequire) },
+    };
+    globalThis.location = { href: 'https://www.xiaohongshu.com/ai_chat' };
+    try {
+        return await (0, eval)(buildAskEvaluateJs('测试问题', 5, 5));
+    } finally {
+        globalThis.window = priorWindow;
+        globalThis.location = priorLocation;
+    }
+}
+
+describe('xiaohongshu ask conversation-store lookup', () => {
+    it('uses the known module id when the build still has it', async () => {
+        const result = await runAskScriptAgainstFakeRuntime({ moduleId: 32914 });
+        expect(result).toMatchObject({ ok: true, answer: '答案正文' });
+        expect(result.sources).toHaveLength(1);
+    });
+
+    it('still finds the store after Xiaohongshu renumbers the chunk', async () => {
+        // An id in neither the known list nor any previous build.
+        const result = await runAskScriptAgainstFakeRuntime({ moduleId: 778899 });
+        expect(result).toMatchObject({ ok: true, answer: '答案正文' });
+    });
+
+    it('reports conversation_store_missing when no module matches, instead of throwing', async () => {
+        const result = await runAskScriptAgainstFakeRuntime({ moduleId: null });
+        expect(result).toMatchObject({ ok: false, error: 'conversation_store_missing' });
+    });
+});
```

---

### Incident Patch 3: `2a6929f8` (2026-08-29)
**Commit Message**: fix(linux-do): use current session for whoami (#2397)

* fix(linux-do): use current session for whoami

* test(linux-do): use generic identity fixture

**File**: `clis/linux-do/auth.js` (modified, +18/-9)
```diff
@@ -14,31 +14,40 @@ async function verifyLinuxDoIdentity(page) {
   await page.wait(2);
   const probe = await page.evaluate(`(async () => {
     try {
-      const u = document.querySelector('meta[name="current-user-username"]')?.getAttribute('content') || '';
-      if (!u) return { kind: 'auth', detail: 'Linux.do meta[current-user-username] missing — anonymous' };
-      const r = await fetch('/u/' + encodeURIComponent(u) + '.json', {
+      const r = await fetch('/session/current.json', {
         credentials: 'include',
         headers: { Accept: 'application/json' },
       });
       if (r.status === 401 || r.status === 403) {
-        return { kind: 'auth', detail: 'Linux.do /u/<self>.json HTTP ' + r.status };
+        return { kind: 'auth', detail: 'Linux.do /session/current.json HTTP ' + r.status };
       }
       if (!r.ok) return { kind: 'http', httpStatus: r.status };
       const d = await r.json();
-      const user = d?.user;
-      if (!user || !user.id) return { kind: 'auth', detail: 'Linux.do /u/<self>.json missing user.id' };
-      return { ok: true, user_id: String(user.id), username: String(user.username || u), name: String(user.name || '') };
+      const user = d?.current_user;
+      if (!user || !user.id || !user.username) {
+        return { kind: 'auth', detail: 'Linux.do /session/current.json missing current_user' };
+      }
+      return {
+        ok: true,
+        user_id: String(user.id),
+        username: String(user.username),
+        name: String(user.name || ''),
+      };
     } catch (e) {
       return { kind: 'exception', detail: String(e && e.message || e) };
     }
   })()`);
   if (probe?.kind === 'auth') throw new AuthRequiredError('linux.do', probe.detail);
-  if (probe?.kind === 'http') throw new CommandExecutionError(`HTTP ${probe.httpStatus} from Linux.do /u/<self>.json`);
+  if (probe?.kind === 'http') throw new CommandExecutionError(`HTTP ${probe.httpStatus} from Linux.do /session/current.json`);
   if (probe?.kind === 'exception') throw new CommandExecutionError(`Linux.do whoami failed: ${probe.detail}`);
-  if (!probe?.ok) throw new CommandExecutionError(`Unexpected Linux.do probe: ${JSON.stringify(probe)}`);
+  if (!probe?.ok || !probe.user_id || !probe.username) {
+    throw new CommandExecutionError(`Unexpected Linux.do probe: ${JSON.stringify(probe)}`);
+  }
   return { user_id: probe.user_id, username: probe.username, name: probe.name };
 }
 
+export const __test__ = { verifyLinuxDoIdentity };
+
 registerSiteAuthCommands({
   site: 'linux-do',
   domain: 'linux.do',
```

**File**: `clis/linux-do/auth.test.js` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+import { describe, expect, it, vi } from 'vitest';
+import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
+import { __test__ } from './auth.js';
+
+function makePage({ cookies = [{ name: '_t', value: 'session' }], probe } = {}) {
+  return {
+    getCookies: vi.fn().mockResolvedValue(cookies),
+    goto: vi.fn().mockResolvedValue(undefined),
+    wait: vi.fn().mockResolvedValue(undefined),
+    evaluate: vi.fn().mockResolvedValue(probe),
+  };
+}
+
+describe('linux-do auth identity probe', () => {
+  it('uses Discourse session/current.json instead of the removed username meta tag', async () => {
+    const page = makePage({
+      probe: { ok: true, user_id: '42', username: 'alice', name: '' },
+    });
+
+    await expect(__test__.verifyLinuxDoIdentity(page)).resolves.toEqual({
+      user_id: '42',
+      username: 'alice',
+      name: '',
+    });
+
+    const script = page.evaluate.mock.calls[0][0];
+    expect(script).toContain('/session/current.json');
+    expect(script).toContain('current_user');
+    expect(script).not.toContain('current-user-username');
+    expect(script).not.toContain("fetch('/u/'");
+  });
+
+  it('fails before navigation when the Linux.do session cookie is missing', async () => {
+    const page = makePage({ cookies: [] });
+
+    await expect(__test__.verifyLinuxDoIdentity(page)).rejects.toBeInstanceOf(AuthRequiredError);
+    expect(page.goto).not.toHaveBeenCalled();
+  });
+
+  it.each([
+    [{ kind: 'auth', detail: 'anonymous' }, AuthRequiredError],
+    [{ kind: 'http', httpStatus: 500 }, CommandExecutionError],
+    [{ kind: 'exception', detail: 'boom' }, CommandExecutionError],
+    [{ ok: true, username: 'alice', name: '' }, CommandExecutionError],
+  ])('maps malformed and failed probes to typed errors', async (probe, errorType) => {
+    const page = makePage({ probe });
+    await expect(__test__.verifyLinuxDoIdentity(page)).rejects.toBeInstanceOf(errorType);
+  });
+});
```

---

### Incident Patch 4: `75c85e57` (2026-08-29)
**Commit Message**: fix(xiaohongshu): retry once through a cooldown on risk-control soft blocks (#1825) (#2207)

Reading XHS note-detail pages (note / comments / download) back-to-back trips
velocity-based risk control: a soft block that redirects to
website-login/error?error_code=300017/300031 or renders "安全限制" /
"访问链接异常" (#1825, #962). Today the first block fails the command outright,
and an unattended loop keeps hammering — which escalates the risk state toward
the account-violation / ban path (#842, #677).

XHS soft blocks are frequently transient per-request challenges, so a single
reload after a real cooldown recovers many of them. Add a shared
`readXhsDetailPage` helper that navigates, settles, extracts, and — only on a
security block — waits one long randomized cooldown (8–18s) and reloads exactly
ONCE before surfacing SECURITY_BLOCK. The single-retry cap is structural (a
guarded `if`, no caller-tunable retry count) so it can never devolve into a
hammer loop; `retryOnBlock: false` opts into the previous fail-fast behavior.

note / comments / download now share this helper, replacing three copies of the
inline securityBlock detection. This does NOT throttle request velocity across
separate CLI 

**File**: `clis/xiaohongshu/comments.js` (modified, +12/-9)
```diff
@@ -6,8 +6,9 @@
  * the --with-replies flag.
  */
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { AuthRequiredError, CliError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
 import { parseNoteId, buildNoteUrl } from './note-helpers.js';
+import { readXhsDetailPage } from './risk-control.js';
 
 const XHS_PROFILE_HREF_SELECTOR = '.author-wrapper a[href*="/user/profile/"], a.name[href*="/user/profile/"], a.user-name[href*="/user/profile/"], a[href*="/user/profile/"]';
 
@@ -300,17 +301,19 @@ export const command = cli({
         const withReplies = Boolean(kwargs['with-replies']);
         const raw = String(kwargs['note-id']);
         const noteId = parseNoteId(raw);
-        await page.goto(buildNoteUrl(raw, { commandName: 'xiaohongshu comments' }));
-        await page.wait({ time: 2 + Math.random() * 3 });
-        const data = await page.evaluate(buildCommentsExtractJs(withReplies, limit));
+        // readXhsDetailPage paces the navigation and retries once through a
+        // cooldown if risk control soft-blocks the page (throws SECURITY_BLOCK
+        // when still blocked after the retry).
+        const data = await readXhsDetailPage(page, {
+            url: buildNoteUrl(raw, { commandName: 'xiaohongshu comments' }),
+            extractJs: buildCommentsExtractJs(withReplies, limit),
+            securityHelp: /^https?:\/\//.test(raw)
+                ? 'The page may be temporarily restricted. Try again later or from a different session.'
+                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.',
+        });
         if (!data || typeof data !== 'object') {
             throw new EmptyResultError('xiaohongshu/comments', 'Unexpected evaluate response');
         }
-        if (data.securityBlock) {
-            throw new CliError('SECURITY_BLOCK', 'Xiaohongshu security block: the note detail page was blocked by risk control.', /^https?:\/\//.test(raw)
-                ? 'The page may be temporarily restricted. Try again later or from a different session.'
-                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.');
-        }
         if (data.loginWall) {
             throw new AuthRequiredError('www.xiaohongshu.com', 'Note comments require login');
         }
```

**File**: `clis/xiaohongshu/download.js` (modified, +13/-8)
```diff
@@ -9,7 +9,8 @@
 import { cli, Strategy } from '@jackwener/opencli/registry';
 import { formatCookieHeader } from '@jackwener/opencli/download';
 import { downloadMedia } from '@jackwener/opencli/download/media-download';
-import { CliError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { readXhsDetailPage } from './risk-control.js';
 import { buildNoteUrl, parseNoteId } from './note-helpers.js';
 /**
  * Build the media-extraction IIFE. The note id is interpolated as a default
@@ -219,14 +220,18 @@ export const command = cli({
         const rawInput = String(kwargs['note-id']);
         const output = kwargs.output;
         const noteId = parseNoteId(rawInput);
-        await page.goto(buildNoteUrl(rawInput, { allowShortLink: true, commandName: 'xiaohongshu download' }));
-        await page.wait({ time: 1 + Math.random() * 2 });
-        const data = await page.evaluate(buildDownloadExtractJs(noteId));
-        if (data?.securityBlock) {
-            throw new CliError('SECURITY_BLOCK', 'Xiaohongshu security block: the note detail page was blocked by risk control.', /^https?:\/\//.test(rawInput)
+        // readXhsDetailPage paces the navigation and retries once through a
+        // cooldown if risk control soft-blocks the page (throws SECURITY_BLOCK
+        // when still blocked after the retry).
+        const data = await readXhsDetailPage(page, {
+            url: buildNoteUrl(rawInput, { allowShortLink: true, commandName: 'xiaohongshu download' }),
+            extractJs: buildDownloadExtractJs(noteId),
+            securityHelp: /^https?:\/\//.test(rawInput)
                 ? 'The page may be temporarily restricted. Try again later or from a different session.'
-                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.');
-        }
+                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.',
+            settleMinS: 1,
+            settleMaxS: 3,
+        });
         if (!data || typeof data !== 'object' || !Array.isArray(data.media)) {
             throw new CommandExecutionError('Xiaohongshu media extraction returned malformed payload.');
         }
```

**File**: `clis/xiaohongshu/note.js` (modified, +12/-9)
```diff
@@ -7,8 +7,9 @@
  * Requires a full Xiaohongshu note URL with xsec_token.
  */
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { AuthRequiredError, CliError, EmptyResultError } from '@jackwener/opencli/errors';
+import { AuthRequiredError, EmptyResultError } from '@jackwener/opencli/errors';
 import { parseNoteId, buildNoteUrl } from './note-helpers.js';
+import { readXhsDetailPage } from './risk-control.js';
 /**
  * Host-agnostic IIFE that scrapes note title / author / counts / tags from a
  * rendered note detail page. Exported so the rednote adapter can reuse the
@@ -77,17 +78,19 @@ export const command = cli({
         const raw = String(kwargs['note-id']);
         const noteId = parseNoteId(raw);
         const url = buildNoteUrl(raw, { commandName: 'xiaohongshu note' });
-        await page.goto(url);
-        await page.wait({ time: 2 + Math.random() * 3 });
-        const data = await page.evaluate(NOTE_EXTRACT_JS);
+        // readXhsDetailPage paces the navigation and retries once through a
+        // cooldown if risk control soft-blocks the page (throws SECURITY_BLOCK
+        // when still blocked after the retry).
+        const data = await readXhsDetailPage(page, {
+            url,
+            extractJs: NOTE_EXTRACT_JS,
+            securityHelp: /^https?:\/\//.test(raw)
+                ? 'The page may be temporarily restricted. Try again later or from a different session.'
+                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.',
+        });
         if (!data || typeof data !== 'object') {
             throw new EmptyResultError('xiaohongshu/note', 'Unexpected evaluate response');
         }
-        if (data.securityBlock) {
-            throw new CliError('SECURITY_BLOCK', 'Xiaohongshu security block: the note detail page was blocked by risk control.', /^https?:\/\//.test(raw)
-                ? 'The page may be temporarily restricted. Try again later or from a different session.'
-                : 'Try using a full URL from search results (with xsec_token) instead of a bare note ID.');
-        }
         if (data.loginWall) {
             throw new AuthRequiredError('www.xiaohongshu.com', 'Note content requires login');
         }
```

**File**: `clis/xiaohongshu/risk-control.js` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import { CliError } from '@jackwener/opencli/errors';
+
+/**
+ * Xiaohongshu risk-control pacing shared by the note / comments / download
+ * detail-page commands.
+ *
+ * XHS gates note-detail navigation behind velocity-based risk control: reading a
+ * run of notes back-to-back trips a soft block that redirects to
+ * `website-login/error?error_code=300017` / `300031` or renders "安全限制" /
+ * "访问链接异常" (issues #1825, #962). Those soft blocks are frequently transient
+ * per-request challenges — a single reload after a real cooldown clears many of
+ * them. So instead of failing on the first block, retry ONCE after a long
+ * randomized cooldown.
+ *
+ * The retry is deliberately capped at one: hammering a hot risk state is exactly
+ * what escalates it toward the account-violation / ban path (#842, #677). This
+ * helper only makes each read gentler and recovers transient blocks — it does
+ * NOT cap request velocity across separate CLI invocations (that needs
+ * session-level throttling, tracked as a follow-up).
+ */
+
+/** Randomized delay in seconds within [minS, maxS]. `rand` is injectable for tests. */
+export function jitterSeconds(minS, maxS, rand = Math.random) {
+    return minS + rand() * (maxS - minS);
+}
+
+/** A detail-page extract payload signals risk control via `securityBlock: true`. */
+export function isSecurityBlock(data) {
+    return Boolean(data && typeof data === 'object' && !Array.isArray(data) && data.securityBlock);
+}
+
+/**
+ * Navigate to a XHS detail page and run `extractJs`, retrying once through a long
+ * randomized cooldown when risk control soft-blocks the page. Returns the extract
+ * payload (never a security-block payload — that path throws SECURITY_BLOCK after
+ * the single retry is exhausted). Callers keep their own loginWall / notFound /
+ * shape handling on the returned payload.
+ *
+ * @param {object} page Browser Bridge page handle.
+ * @param {object} opts
+ * @param {string} opts.url            Fully-built note/detail URL to navigate to.
+ * @param {string} opts.extractJs      Page-side extraction IIFE returning `{ securityBlock, ... }`.
+ * @param {string} [opts.securityHelp] Hint attached to the thrown SECURITY_BLOCK error.
+ * @param {number} [opts.settleMinS]   Min settle delay after navigation (seconds).
+ * @param {number} [opts.settleMaxS]   Max settle delay after navigation (seconds).
+ * @param {boolean} [opts.retryOnBlock] Do the single cooldown reload on a soft block (default true); false = fail fast.
+ * @param {number} [opts.cooldownMinS] Min cooldown before the retry (seconds).
+ * @param {number} [opts.cooldownMaxS] Max cooldown before the retry (seconds).
+ * @param {() => number} [opts.rand]   Injectable RNG for deterministic tests.
+ */
+export async function readXhsDetailPage(page, {
+    url,
+    extractJs,
+    securityHelp,
+    settleMinS = 2,
+    settleMaxS = 5,
+    retryOnBlock = true,
+    cooldownMinS = 8,
+    cooldownMaxS = 18,
+    rand = Math.random,
+} = {}) {
+    const readOnce = async () => {
+        await page.goto(url);
+        await page.wait({ time: jitterSeconds(settleMinS, settleMaxS, rand) });
+        return page.evaluate(extractJs);
+    };
+
+    let data = await readOnce();
+    // At most ONE retry — a single `if`, never a loop. Hammering a hot risk state
+    // is exactly what escalates it toward account-violation / ban (#842, #677),
+    // so the one-cooldown-reload cap is enforced structurally, not by a caller's
+    // choice of retry count.
+    if (retryOnBlock && isSecurityBlock(data)) {
+        await page.wait({ time: jitterSeconds(cooldownMinS, cooldownMaxS, rand) });
+        data = await readOnce();
+    }
+
+    if (isSecurityBlock(data)) {
+        throw new CliError(
+            'SECURITY_BLOCK',
+            'Xiaohongshu security block: the note detail page was blocked by risk control.',
+            securityHelp,
+        );
+    }
+    return data;
+}
+
+export const __test__ = { jitterSeconds, isSecurityBlock, readXhsDetailPage };
```

**File**: `clis/xiaohongshu/risk-control.test.js` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import { describe, expect, it, vi } from 'vitest';
+import { CliError } from '@jackwener/opencli/errors';
+import { __test__ } from './risk-control.js';
+
+const { jitterSeconds, isSecurityBlock, readXhsDetailPage } = __test__;
+
+function makePage(evaluateResults) {
+    let i = 0;
+    return {
+        goto: vi.fn().mockResolvedValue(undefined),
+        wait: vi.fn().mockResolvedValue(undefined),
+        evaluate: vi.fn().mockImplementation(() =>
+            Promise.resolve(evaluateResults[Math.min(i++, evaluateResults.length - 1)])),
+    };
+}
+
+describe('xiaohongshu risk-control jitterSeconds', () => {
+    it('stays within [min, max] and tracks rand', () => {
+        expect(jitterSeconds(2, 5, () => 0)).toBe(2);
+        expect(jitterSeconds(2, 5, () => 1)).toBe(5);
+        expect(jitterSeconds(2, 5, () => 0.5)).toBe(3.5);
+        const v = jitterSeconds(8, 18); // real Math.random
+        expect(v).toBeGreaterThanOrEqual(8);
+        expect(v).toBeLessThanOrEqual(18);
+    });
+});
+
+describe('xiaohongshu risk-control isSecurityBlock', () => {
+    it('is true only for a plain object flagged securityBlock', () => {
+        expect(isSecurityBlock({ securityBlock: true })).toBe(true);
+        expect(isSecurityBlock({ securityBlock: false })).toBe(false);
+        expect(isSecurityBlock({})).toBe(false);
+        expect(isSecurityBlock(null)).toBe(false);
+        expect(isSecurityBlock(undefined)).toBe(false);
+        expect(isSecurityBlock([{ securityBlock: true }])).toBe(false); // arrays are not payloads
+        expect(isSecurityBlock('securityBlock')).toBe(false);
+    });
+});
+
+describe('xiaohongshu risk-control readXhsDetailPage', () => {
+    const url = 'https://www.xiaohongshu.com/search_result/abc?xsec_token=tok';
+    const extractJs = '(() => ({}))()';
+
+    it('returns the payload on first read without any cooldown when not blocked', async () => {
+        const page = makePage([{ title: 'ok', securityBlock: false }]);
+        const data = await readXhsDetailPage(page, { url, extractJs, rand: () => 0.5 });
+        expect(data).toEqual({ title: 'ok', securityBlock: false });
+        expect(page.goto).toHaveBeenCalledTimes(1);
+        expect(page.evaluate).toHaveBeenCalledTimes(1);
+        // only the settle wait, no cooldown
+        expect(page.wait).toHaveBeenCalledTimes(1);
+    });
+
+    it('recovers a transient soft-block with a single cooldown retry', async () => {
+        const page = makePage([{ securityBlock: true }, { title: 'recovered', securityBlock: false }]);
+        const data = await readXhsDetailPage(page, { url, extractJs, rand: () => 0.5 });
+        expect(data).toEqual({ title: 'recovered', securityBlock: false });
+        // re-navigated + re-extracted exactly once more
+        expect(page.goto).toHaveBeenCalledTimes(2);
+        expect(page.evaluate).toHaveBeenCalledTimes(2);
+        // a long cooldown wait happened between the two reads: 8 + 0.5*(18-8) = 13
+        expect(page.wait).toHaveBeenCalledWith({ time: 13 });
+    });
+
+    it('throws SECURITY_BLOCK (with the hint) when still blocked after the one retry — never hammers', async () => {
+        const page = makePage([{ securityBlock: true }, { securityBlock: true }, { securityBlock: true }]);
+        await expect(readXhsDetailPage(page, {
+            url,
+            extractJs,
+            securityHelp: 'Try again later or from a different session.',
+            rand: () => 0.5,
+        })).rejects.toMatchObject({
+            code: 'SECURITY_BLOCK',
+            hint: 'Try again later or from a different session.',
+        });
+        // exactly one retry — goto/evaluate called twice, not more
+        expect(page.goto).toHaveBeenCalledTimes(2);
+        expect(page.evaluate).toHaveBeenCalledTimes(2);
+    });
+
+    it('fails fast without a retry when retryOnBlock is false', async () => {
+        const page = makePage([{ securityBlock: true }, { title: 'never reached', securityBlock: false }]);
+        await expect(readXhsDetailPage(page, { url, extractJs, retryOnBlock: false, rand: () => 0.5 }))
+            .rejects.toBeInstanceOf(CliError);
+        // no cooldown reload — exactly one navigation/extraction
+        expect(page.goto).toHaveBeenCalledTimes(1);
+        expect(page.evaluate).toHaveBeenCalledTimes(1);
+    });
+
+    it('respects custom settle bounds (download uses 1-3s)', async () => {
+        const page = makePage([{ media: [], securityBlock: false }]);
+        await readXhsDetailPage(page, { url, extractJs, settleMinS: 1, settleMaxS: 3, rand: () => 0 });
+        // settle = 1 + 0*(3-1) = 1
+        expect(page.wait).toHaveBeenCalledWith({ time: 1 });
+    });
+
+    it('passes non-block malformed payloads straight through (caller handles them)', async () => {
+        const page = makePage([null]);
+        const data = await readXhsDetailPage(page, { url, extractJs, rand: () => 0.5 });
+        expect(data).toBeNull();
+      
```

---

### Incident Patch 5: `1c66cc9e` (2026-08-29)
**Commit Message**: fix(errors): duck-typing for cross-package CliError in toEnvelope (#2388)

* fix(errors): duck-typing for cross-package CliError in toEnvelope

Plugins resolve their own copy of @jackwener/opencli (own node_modules), so
 fails across package copies and every plugin error
degrades to code: UNKNOWN with the hint lost. Switch to shape-based detection
(code + message strings, optional hint) — real CliError instances behave
identically, plain Errors still map to UNKNOWN.

Also serializes error-like plain objects carrying code/message. Adds tests
for the cross-package shape, plain-object passthrough, and UNKNOWN fallback.

* fix(errors): require exitCode when duck-typing CliError

The shape check accepted any object with string code+message, which also
matches Node system errors (ENOENT, ECONNREFUSED, EACCES) and library
errors carrying a string code. Those would surface their errno as the
envelope code, widening the machine-readable contract callers switch on:

  before this commit: ENOENT -> code "ENOENT"
  intended/base:      ENOENT -> code "UNKNOWN"

CliError's constructor always assigns exitCode (defaulting to
GENERIC_ERROR) while Node system errors never do, so requiring a numeric


**File**: `src/errors.test.ts` (modified, +42/-0)
```diff
@@ -119,6 +119,48 @@ describe('toEnvelope', () => {
     expect(envelope.error.message).toBe('string error');
   });
 
+
+  it('passes through cross-package CliError copies (duck-typed shape)', () => {
+    // Simulates a CliError thrown by a plugin that resolves its own copy of
+    // @jackwener/opencli — different class identity, same shape.
+    class ForeignCliError extends Error {
+      code = 'INVALID_ARGS';
+      hint: string | undefined;
+      // A real CliError always assigns exitCode in its constructor, so a
+      // faithful cross-package copy carries it too.
+      exitCode = 2;
+      constructor(message: string, hint?: string) {
+        super(message);
+        this.name = 'CliError';
+        this.hint = hint;
+      }
+    }
+    const envelope = toEnvelope(new ForeignCliError('bad file', 'pass a real path'));
+    expect(envelope.error.code).toBe('INVALID_ARGS');
+    expect(envelope.error.help).toBe('pass a real path');
+    expect(envelope.error.message).toBe('bad file');
+  });
+
+  it('does not treat a bare {code,message} object as a CliError', () => {
+    // No exitCode => not CliError-shaped. Accepting these would let any
+    // foreign string `code` into the envelope contract.
+    const envelope = toEnvelope({ code: 'FORBIDDEN', message: 'scope violation' });
+    expect(envelope.error.code).toBe('UNKNOWN');
+  });
+
+  it('keeps Node system errors as UNKNOWN instead of surfacing their errno', () => {
+    // fs/net errors have a string `code` and `message` but no exitCode.
+    // Reporting `ENOENT` as the envelope code would widen the machine-readable
+    // contract that callers switch on.
+    const enoent = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });
+    expect(toEnvelope(enoent).error.code).toBe('UNKNOWN');
+  });
+
+  it('keeps UNKNOWN for Errors without a code', () => {
+    const envelope = toEnvelope(new Error('random failure'));
+    expect(envelope.error.code).toBe('UNKNOWN');
+  });
+
   it('serializes deep cause chains without stack overflow', () => {
     // Build a 20-level deep cause chain — should truncate at depth 10
     let deepErr: Error = new Error('root');
```

**File**: `src/errors.ts` (modified, +22/-5)
```diff
@@ -257,14 +257,31 @@ export function toEnvelope(err: unknown): ErrorEnvelope {
     receiptPath: traceReceipt.receiptPath,
     status: traceReceipt.status,
   } : undefined;
-  if (err instanceof CliError) {
+  // Duck typing: accept own CliError instances AND cross-package copies that
+  // carry the same shape. `instanceof` fails when the throwing module resolves
+  // a different copy of @jackwener/opencli (e.g. a plugin with its own
+  // node_modules) — those errors used to degrade to UNKNOWN and lose `hint`.
+  //
+  // `exitCode` is the discriminator: CliError's constructor always assigns it
+  // (defaulting to GENERIC_ERROR), while Node system errors carry a string
+  // `code` (ENOENT, ECONNREFUSED, EACCES) and a string `message` but never an
+  // `exitCode`. Without this check those would be reported with their errno as
+  // the envelope `code`, silently widening the contract that callers switch on.
+  const isCliErrorLike =
+    err !== null &&
+    typeof err === 'object' &&
+    typeof (err as any).code === 'string' &&
+    typeof (err as any).message === 'string' &&
+    typeof (err as any).exitCode === 'number';
+  if (err instanceof CliError || isCliErrorLike) {
+    const e = err as any;
     return {
       ok: false,
       error: {
-        code: err.code,
-        message: err.message,
-        ...(err.hint ? { help: err.hint } : {}),
-        exitCode: err.exitCode,
+        code: e.code,
+        message: e.message,
+        ...(typeof e.hint === 'string' && e.hint ? { help: e.hint } : {}),
+        exitCode: e.exitCode ?? EXIT_CODES.GENERIC_ERROR,
         ...(cause ? { cause } : {}),
       },
       ...(trace ? { trace } : {}),
```

---

### Incident Patch 6: `4e8109b6` (2026-08-29)
**Commit Message**: fix: honor manual CDP endpoint for web adapters (#2148)

**File**: `src/runtime.test.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { BrowserBridge, CDPBridge } from './browser/index.js';
+import { getBrowserFactory } from './runtime.js';
+
+describe('getBrowserFactory', () => {
+  afterEach(() => {
+    vi.unstubAllEnvs();
+  });
+
+  it('uses BrowserBridge for regular sites by default', () => {
+    expect(getBrowserFactory('xianyu')).toBe(BrowserBridge);
+  });
+
+  it('uses CDPBridge when OPENCLI_CDP_ENDPOINT is configured', () => {
+    vi.stubEnv('OPENCLI_CDP_ENDPOINT', 'http://127.0.0.1:9333');
+
+    expect(getBrowserFactory('xianyu')).toBe(CDPBridge);
+  });
+});
```

**File**: `src/runtime.ts` (modified, +4/-2)
```diff
@@ -7,10 +7,12 @@ import { DEFAULT_BROWSER_COMMAND_TIMEOUT, DEFAULT_BROWSER_CONNECT_TIMEOUT } from
 export { DEFAULT_BROWSER_COMMAND_TIMEOUT, DEFAULT_BROWSER_CONNECT_TIMEOUT };
 
 /**
- * Returns the appropriate browser factory based on site type.
- * Uses CDPBridge for registered Electron apps, otherwise BrowserBridge.
+ * Returns the appropriate browser factory based on explicit configuration and site type.
+ * A manual CDP endpoint takes precedence, registered Electron apps use CDPBridge,
+ * and all other sites use BrowserBridge.
  */
 export function getBrowserFactory(site?: string): new () => IBrowserFactory {
+  if (process.env.OPENCLI_CDP_ENDPOINT) return CDPBridge;
   if (site && isElectronApp(site)) return CDPBridge;
   return BrowserBridge;
 }
```

---

### Incident Patch 7: `25dece3f` (2026-08-29)
**Commit Message**: fix(pipeline): reject invalid concurrency limits (#2407)

**File**: `src/pipeline/steps/fetch.test.ts` (modified, +15/-1)
```diff
@@ -1,5 +1,5 @@
 import { afterEach, describe, expect, it, vi } from 'vitest';
-import { CliError } from '../../errors.js';
+import { ArgumentError, CliError } from '../../errors.js';
 import type { IPage } from '../../types.js';
 import { stepFetch } from './fetch.js';
 
@@ -92,6 +92,20 @@ describe('stepFetch', () => {
     expect(jsonMock).not.toHaveBeenCalled();
   });
 
+  it('rejects invalid browser batch concurrency before evaluating page code', async () => {
+    const page = {
+      evaluate: vi.fn(),
+    } as unknown as IPage;
+
+    await expect(stepFetch(
+      page,
+      { url: 'https://api.example.com/items/${{ item.id }}', concurrency: 0 },
+      [{ id: 1 }],
+      {},
+    )).rejects.toBeInstanceOf(ArgumentError);
+    expect(page.evaluate).not.toHaveBeenCalled();
+  });
+
   it('stringifies non-Error batch browser failures consistently', async () => {
     vi.stubGlobal('fetch', vi.fn().mockRejectedValue('socket hang up'));
 
```

**File**: `src/pipeline/steps/fetch.ts` (modified, +4/-1)
```diff
@@ -2,7 +2,7 @@
  * Pipeline step: fetch — HTTP API requests.
  */
 
-import { CliError, getErrorMessage } from '../../errors.js';
+import { ArgumentError, CliError, getErrorMessage } from '../../errors.js';
 import { log } from '../../logger.js';
 import type { IPage } from '../../types.js';
 import { render } from '../template.js';
@@ -95,6 +95,9 @@ export async function stepFetch(page: IPage | null, params: unknown, data: unkno
   // Per-item fetch when data is array and URL references item
   if (Array.isArray(data) && urlTemplate.includes('item')) {
     const concurrency = typeof paramObject.concurrency === 'number' ? paramObject.concurrency : 5;
+    if (!Number.isInteger(concurrency) || concurrency < 1) {
+      throw new ArgumentError(`Concurrency limit must be a positive integer. Received: "${String(concurrency)}"`);
+    }
 
     // Render all URLs upfront
     const renderedHeaders: Record<string, string> = {};
```

**File**: `src/utils.test.ts` (modified, +13/-1)
```diff
@@ -1,11 +1,12 @@
 import { describe, it, expect } from 'vitest';
 import {
+  mapConcurrent,
   parseJsonOrThrowLoginWall,
   throwIfLoginWall,
   BROWSER_JSON_SNIFF_FN,
   type LoginWallSignal,
 } from './utils.js';
-import { LoginWallError } from './errors.js';
+import { ArgumentError, LoginWallError } from './errors.js';
 
 function makeResponse(body: string, opts: { status?: number; contentType?: string; url?: string } = {}): Response {
   return new Response(body, {
@@ -14,6 +15,17 @@ function makeResponse(body: string, opts: { status?: number; contentType?: strin
   });
 }
 
+describe('mapConcurrent', () => {
+  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
+    'rejects invalid concurrency limit %s instead of skipping work',
+    async (limit) => {
+      const worker = async (value: number) => value * 2;
+
+      await expect(mapConcurrent([1, 2], limit, worker)).rejects.toBeInstanceOf(ArgumentError);
+    },
+  );
+});
+
 describe('parseJsonOrThrowLoginWall', () => {
   it('returns parsed JSON on a normal application/json response', async () => {
     const res = makeResponse(JSON.stringify({ hello: 'world', n: 42 }));
```

**File**: `src/utils.ts` (modified, +5/-1)
```diff
@@ -5,7 +5,7 @@
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import TurndownService from 'turndown';
-import { LoginWallError } from './errors.js';
+import { ArgumentError, LoginWallError } from './errors.js';
 
 /** Type guard: checks if a value is a non-null, non-array object. */
 export function isRecord(value: unknown): value is Record<string, unknown> {
@@ -18,6 +18,10 @@ export async function mapConcurrent<T, R>(
   limit: number,
   fn: (item: T, index: number) => Promise<R>,
 ): Promise<R[]> {
+  if (!Number.isInteger(limit) || limit < 1) {
+    throw new ArgumentError(`Concurrency limit must be a positive integer. Received: "${String(limit)}"`);
+  }
+
   const results: R[] = new Array(items.length);
   let index = 0;
 
```

---

### Incident Patch 8: `49907e53` (2026-08-28)
**Commit Message**: fix(dribbble): distinguish empty states from selector drift (#2423)

* fix(dribbble): distinguish empty states from drift

* fix(dribbble): handle promoted and nested list items

---------

Co-authored-by: OpenCLI-sol <[REDACTED_EMAIL]>

**File**: `clis/dribbble/dribbble.test.js` (modified, +169/-1)
```diff
@@ -126,6 +126,32 @@ describe('dribbble production DOM extractors', () => {
         }]);
     });
 
+    it('skips explicit promoted cards and keeps canonical absolute shot URLs', async () => {
+        const page = pageFor(`
+          <main id="content">
+            <li id="screenshot-ad" data-thumbnail-id="ad">
+              <a href="https://sponsor.example/campaign">Sponsored design</a>
+              <a href="/advertise">Advertise</a>
+            </li>
+            <li id="screenshot-27611165" data-thumbnail-id="27611165">
+              <img alt="Cabin seat map" src="https://cdn.example/shot.png">
+              <a href="https://dribbble.com/shots/27611165-Pick-Your-Seat">View shot</a>
+              <a href="/shots/27611165-Pick-Your-Seat/bucketings/new">Save shot</a>
+              <div class="user-information"><a href="/mondaysys">Mondaysys</a></div>
+            </li>
+          </main>
+        `, 'https://dribbble.com/search/shots/popular?q=mobile');
+
+        await expect(command('shot').func(page, {
+            query: 'mobile', sort: 'popular', limit: 1,
+        })).resolves.toEqual([expect.objectContaining({
+            rank: 1,
+            id: '27611165',
+            title: 'Cabin seat map',
+            url: 'https://dribbble.com/shots/27611165-Pick-Your-Seat',
+        })]);
+    });
+
     it('extracts the exact profile heading and rich about fields without badge text', () => {
         const payload = runInDom(extractProfileRow, `
           <div class="profile-masthead" data-profile-masthead-container>
@@ -245,6 +271,148 @@ describe('dribbble production DOM extractors', () => {
             'https://dribbble.com/shots/999999999')).toMatchObject({ ok: true, empty: true });
     });
 
+    it('distinguishes an explicit empty shot page from shot-card selector drift', async () => {
+        const emptyPage = pageFor(`
+          <body id="search-results">
+            <div id="wrap"><div class="no-results">No results found</div></div>
+            <main id="content"></main>
+          </body>
+        `,
+            'https://dribbble.com/search/shots/popular?q=missing');
+        await expect(command('shot').func(emptyPage, {
+            query: 'missing', sort: 'popular', limit: 1,
+        })).rejects.toMatchObject({ code: 'EMPTY_RESULT' });
+
+        const driftPage = pageFor('<main id="content"></main>',
+            'https://dribbble.com/search/shots/popular?q=mobile');
+        await expect(command('shot').func(driftPage, {
+            query: 'mobile', sort: 'popular', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+
+        const unrelatedMarkerPage = pageFor(`
+          <div class="no-results">Unrelated component</div><main id="content"></main>
+        `, 'https://dribbble.com/search/shots/popular?q=mobile');
+        await expect(command('shot').func(unrelatedMarkerPage, {
+            query: 'mobile', sort: 'popular', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+    });
+
+    it('distinguishes completed empty designer results from card selector drift', async () => {
+        const emptyPage = pageFor(`
+          <div class="designer-search-results">
+            <drb-infinite-scroll data-designer-search-infinite-scroll disabled></drb-infinite-scroll>
+          </div>
+        `, 'https://dribbble.com/hire?keywords=missing');
+        await expect(command('designer').func(emptyPage, {
+            query: 'missing', limit: 1,
+        })).rejects.toMatchObject({ code: 'EMPTY_RESULT' });
+
+        const driftPage = pageFor('<div class="designer-search-results"></div>',
+            'https://dribbble.com/hire?keywords=product');
+        await expect(command('designer').func(driftPage, {
+            query: 'product', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+    });
+
+    it('distinguishes empty profile tabs from service and collection selector drift', async () => {
+        const emptyService = pageFor(`
+          <li class="services active empty"><a href="/vin-jake/services">Services</a></li>
+          <main id="content"></main>
+        `, 'https://dribbble.com/vin-jake/services');
+        await expect(command('service').func(emptyService, {
+            designer: 'vin-jake', query: '', limit: 1,
+        })).rejects.toMatchObject({ code: 'EMPTY_RESULT' });
+
+        const driftService = pageFor('<main id="content"></main>', 'https://dribbble.com/halolab/services');
+        await expect(command('service').func(driftService, {
+            designer: 'halolab', query: '', limit: 1,
+        })).rejects.toMatchObject({ code: 'COMMAND_EXEC' });
+
+        const emptyCollection = pageFor(`
+          <li class="collections active empty"><a href="/vin-jake/collections">Collections</a></li>
+          <main></main>
+        `, 'https://dribbble.com/vin-jake/collections');
+        await expect(command('collection').func(emptyCollection, {
+            designer: 'vin-jake', limit:
```

**File**: `clis/dribbble/utils.js` (modified, +88/-24)
```diff
@@ -124,15 +124,44 @@ export function extractShotRows(limit) {
     if (!root) {
         return { ok: false, reason: 'shot result root was not found', title: document.title || '' };
     }
+    const searchEmpty = /^\/search\/shots\/(?:following|popular|recent)\/?$/.test(document.location.pathname)
+        && document.body?.id === 'search-results'
+        && document.querySelector('#wrap > .no-results');
+    const portfolioEmpty = /^\/[A-Za-z0-9_-]+\/(?:shots|likes)\/?$/.test(document.location.pathname)
+        && root.querySelector('.empty-shots-list');
+    if (cards.length === 0 && !searchEmpty && !portfolioEmpty) {
+        return { ok: false, reason: 'shot cards and the empty-state marker were not found', title: document.title || '' };
+    }
 
-    const rows = cards.map((el, index) => {
-        const shotLink = [...el.querySelectorAll('a[href]')]
-            .find((anchor) => /^\/shots\/\d+(?:-|\/|$)/.test(anchor.getAttribute('href') || ''));
-        if (!shotLink) return null;
+    const parsedCards = cards.map((el) => {
+        const anchors = [...el.querySelectorAll('a[href]')];
+        const shotLink = anchors.find((anchor) => {
+            try {
+                const target = new URL(anchor.getAttribute('href') || '', location.href);
+                return /(^|\.)dribbble\.com$/i.test(target.hostname)
+                    && /^\/shots\/\d+(?:-[^/]+)?\/?$/.test(target.pathname);
+            } catch {
+                return false;
+            }
+        });
+        if (!shotLink) {
+            const hasOutboundTarget = anchors.some((anchor) => {
+                try {
+                    return !/(^|\.)dribbble\.com$/i.test(
+                        new URL(anchor.getAttribute('href') || '', location.href).hostname,
+                    );
+                } catch {
+                    return false;
+                }
+            });
+            const isPromoted = hasOutboundTarget
+                && anchors.some((anchor) => /^\/advertise\/?$/.test(anchor.getAttribute('href') || ''));
+            return { promoted: isPromoted };
+        }
         const profileLink = el.querySelector('.user-information a[href], a[data-search-profile-clicked][href]');
         const image = el.querySelector('img');
-        return {
-            rank: index + 1,
+        const row = {
+            rank: 0,
             id: clean(el.getAttribute('data-thumbnail-id') || el.id.replace(/^screenshot-/, '')),
             title: clean(el.querySelector('.shot-title')?.textContent || image?.getAttribute('alt') || ''),
             designer: clean(profileLink?.textContent || ''),
@@ -141,9 +170,19 @@ export function extractShotRows(limit) {
             imageUrl: clean(image?.currentSrc || image?.getAttribute('src') || image?.getAttribute('data-src') || ''),
             url: new URL(shotLink.getAttribute('href'), location.href).href,
         };
-    }).filter((row) => row && row.id && row.title && row.url);
+        return { row };
+    });
+    if (parsedCards.some((card) => !card.promoted && (!card.row || !card.row.id || !card.row.title || !card.row.url))) {
+        return { ok: false, reason: 'one or more shot cards were missing required identity fields' };
+    }
+    const parsedRows = parsedCards
+        .flatMap((card) => card.row ? [card.row] : [])
+        .map((row, index) => ({ ...row, rank: index + 1 }));
+    if (parsedRows.length === 0 && cards.length > 0) {
+        return { ok: false, reason: 'shot results contained only promoted cards' };
+    }
 
-    return { ok: true, rows: rows.slice(0, limit) };
+    return { ok: true, rows: parsedRows.slice(0, limit) };
 }
 
 export function extractDesignerRows(limit) {
@@ -157,8 +196,11 @@ export function extractDesignerRows(limit) {
     if (!root) {
         return { ok: false, reason: 'designer result root was not found', title: document.title || '' };
     }
+    if (cards.length === 0 && !root.querySelector('[data-designer-search-infinite-scroll][disabled]')) {
+        return { ok: false, reason: 'designer cards and the completed empty-state marker were not found', title: document.title || '' };
+    }
 
-    const rows = cards.map((el, index) => {
+    const parsedRows = cards.map((el, index) => {
         const profilePath = el.getAttribute('data-profile-path') || '';
         const subheading = [...el.querySelectorAll('.user-card-profile__subheading-item')]
             .map((item) => clean(item.textContent))
@@ -186,9 +228,12 @@ export function extractDesignerRows(limit) {
             url: profilePath ? new URL(profilePath, document.location.href).href : '',
             avatarUrl: clean(el.querySelector('img')?.src || ''),
         };
-    }).filter((row) => row.username && row.name && row.url);
+    });
+    if (parsedRows.some((row) => !row.username || !row.name || !row.url)) {
+        return { ok: false, reason: 'one or more designer cards were missing required identity fields' };
+    }
 
-    return { ok: true, rows: row
```

---

### Incident Patch 9: `439945fd` (2026-08-28)
**Commit Message**: chore(pack): prune @mixmark-io/domino's vendored test suite on install (#2411)

turndown pulls in @mixmark-io/domino, which publishes its full test suite
to npm: 959 files / 7 MB, ~94% of the package's file count. Upstream has
been unmaintained since 2024 (mixmark-io/domino#2), so remove the test
directory in our postinstall instead. Runs before the CI early-return so
packaged app bundles (OpenCLIApp stages node_modules into Resources/)
shrink as well. Best-effort: resolution failure or a missing dir never
fails the install.

Co-authored-by: exe.dev user <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `scripts/postinstall.js` (modified, +22/-2)
```diff
@@ -15,9 +15,10 @@
  * the main source tree) so that it can run without a build step.
  */
 
-import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
-import { join } from 'node:path';
+import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
+import { join, dirname } from 'node:path';
 import { homedir } from 'node:os';
+import { createRequire } from 'node:module';
 
 
 // ── Completion script content ──────────────────────────────────────────────
@@ -71,9 +72,28 @@ function ensureDir(dir) {
   }
 }
 
+// ── Prune vendored test suites ─────────────────────────────────────────────
+
+function pruneVendoredTests() {
+  // @mixmark-io/domino (pulled in via turndown) publishes its entire test
+  // suite to npm: 959 files / 7 MB, ~94% of the package. Upstream is
+  // unmaintained (mixmark-io/domino#2 has been open since 2024), so remove
+  // the dead weight here. Nothing at runtime touches domino/test.
+  try {
+    const require = createRequire(import.meta.url);
+    const dominoDir = dirname(require.resolve('@mixmark-io/domino/package.json'));
+    rmSync(join(dominoDir, 'test'), { recursive: true, force: true });
+  } catch {
+    // Best-effort; never fail the install.
+  }
+}
+
 // ── Main ───────────────────────────────────────────────────────────────────
 
 function main() {
+  // Prune runs everywhere, including CI, so packaged app bundles shrink too.
+  pruneVendoredTests();
+
   // Skip in CI environments
   if (process.env.CI || process.env.CONTINUOUS_INTEGRATION) {
     return;
```

---

### Incident Patch 10: `c9fb444c` (2026-08-28)
**Commit Message**: chore(pack): exclude test files and fixtures from npm package (#2410)

The published tarball ships 601 compiled *.test.js files, ~100 *.test.d.ts,
stray *.test.ts sources, and clis/**/__fixtures__/ HTML snapshots — none of
which are used at runtime. Excluding them shrinks the package from 2340 to
1638 files and from 14.0 MB to 9.2 MB unpacked (tarball 3.1 MB -> 2.2 MB),
which noticeably speeds up npm install.

Verified with npm pack --dry-run against the extracted 1.8.7 tarball
contents: no .test.* or __fixtures__ entries remain.

Co-authored-by: exe.dev user <[REDACTED_EMAIL]>
Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `package.json` (modified, +3/-1)
```diff
@@ -37,7 +37,9 @@
     "cli-manifest.json",
     "scripts/",
     "README.md",
-    "LICENSE"
+    "LICENSE",
+    "!**/*.test.*",
+    "!**/__fixtures__/"
   ],
   "scripts": {
     "dev": "tsx src/main.ts",
```

---

### Incident Patch 11: `50902ffe` (2026-08-26)
**Commit Message**: fix(browser): preserve structured network captures (#2406)

* fix(browser): preserve structured network captures

* test(browser): cover direct CDP request capture

* fix(browser): redact credential-shaped request values

* fix(browser): redact bare CSRF request fields

---------

Co-authored-by: OpenCLI-sol <[REDACTED_EMAIL]>

**File**: `skills/opencli-adapter-author/references/api-discovery.md` (modified, +4/-2)
```diff
@@ -57,7 +57,7 @@ opencli browser network
 - `shape` — response body 的路径→类型映射（不含原 body，省 token）
 - `status / url / method / ct / size`
 
-静态资源 / 埋点 / 追踪默认已过滤。默认会保留 JSON / XML / plain text / `text/javascript` 这类 API 响应；如果你确定浏览器 DevTools 里有目标请求但这里缺失，用 `--all` 查一遍是否被 content-type 或 URL 噪音过滤挡掉。
+静态资源 / 埋点 / 追踪默认已过滤。默认会保留 JSON / XML / plain text / `text/javascript`，也会识别 `text/x-component` 与明确的 `/rsc-action/` React Server Component 流。如果你确定浏览器 DevTools 里有目标请求但这里缺失，用 `--all` 查一遍是否被其他 content-type 或 URL 噪音过滤挡掉。capture queue 是破坏性读取；Core 会先缓存本批原始条目再做展示过滤，所以紧接着的空 `--all` 仍可复用该 session 的 raw cache，而不是永久丢掉被隐藏的条目。
 
 如果是冷启动，先看 `opencli browser analyze <url>` 里的 `api_candidates`：
 
@@ -102,11 +102,13 @@ opencli browser network --detail <key>
 
 capture 会持久化到 `~/.opencli/cache/browser-network/<session>.json`（默认 TTL 24h），所以 `--detail` 即使跨多条其他命令也还在。
 
+`--detail` 还会在 capture provider 支持时返回 `request`：method 仍在顶层；headers 中 cookie、Authorization、CSRF/XSRF、token/key/secret/session 等值会替换为 `<redacted>`；可安全识别的 JSON object / URL-encoded form 会保留结构，位置数组、opaque 或截断 body 只保留 kind、shape、full size、truncated/omitted 状态。不要因为 body 被安全省略就拿 URL 单独 replay——这说明请求合同仍不完整。
+
 这也意味着私有页面的 response 可能落在本地 cache。侦察结束要删除相关 session capture 并释放 browser session；不要依赖 24h TTL 代替清理。
 
 ### 关键 request headers
 
-`browser network` 当前只抓响应（body + status + ct），抓不到请求头。要看请求头就在 DevTools Network 面板里点这条 request，或用 `browser eval` 手动 `fetch(url)` 复现一次观察浏览器发出去的头：
+先用 `browser network --detail <key>` 看脱敏后的 request headers / body shape；不要打印或复制 credential 原值。旧 capture provider 若没有返回 `request`，再去 DevTools Network 面板核字段名，或用页面自然动作重新 capture，不能用 `browser eval` 猜造一份缺 header/body 的 URL-only 请求：
 
 | 看到 | 含义 | 对应策略 |
 |------|------|---------|
```

**File**: `skills/opencli-adapter-author/references/deep-recon.md` (modified, +8/-0)
```diff
@@ -34,6 +34,8 @@ Never paste credentials or response bodies into the ledger. Store structural fac
 
 Dynamic evidence proves that a request occurred. Static scanning expands recall to lazy pagination, detail, search, and routes that this session did not trigger. Neither alone proves a production contract.
 
+Do not equate “structured” with JSON. React Server Components (`text/x-component`), streamed HTML fragments, protobuf-like payloads, and positional arrays may carry the authoritative data. Preserve their content type, request context, truncation state, and structural shape even when the default network view would normally hide them.
+
 jsluice is optional and stays outside adapter runtime. Feed it script text through stdin, keep source locations, and treat `EXPR` as unknown. Do not persist suspected secret values. A candidate becomes useful only after dynamic occurrence or a safe replay verifies its shape and semantics.
 
 ## 4. Attribute requests with causal diffs
@@ -74,6 +76,8 @@ A read contract must prove all of these:
 5. **Auth boundary**: cookies/CSRF/origin/runtime requirements are explicit and do not leak secrets.
 6. **Failure semantics**: auth, HTTP, malformed/truncated body, repeated cursor/page, timeout, and partial data fail typed.
 
+Replay the complete request contract, not a URL-shaped fragment. A captured URL returning 4xx/5xx does not reject the underlying endpoint when headers, body, cookies, runtime action identifiers, or page-owned signing were omitted. Record the missing context and use `INTERCEPT` until it can be reproduced safely; never guess absent request fields from a bundle string.
+
 A direct API-backed write contract additionally must prove:
 
 1. target identity is deterministically bound in the request;
@@ -90,13 +94,17 @@ A direct API-backed write contract additionally must prove:
 Browser capture queues may be destructive drains. Before relying on them:
 
 - install capture before the action and drain stale entries;
+- cache the raw selected capture before applying display-only MIME, static-resource, or shape filters;
 - allow in-flight responses to settle;
 - treat bodyless or truncated relevant entries as possible data loss;
+- inspect non-JSON structured streams with request method, safely redacted headers, body shape, and size/truncation metadata;
 - merge all relevant completed responses in the action window;
 - identify pages/cursors by content, not arrival order alone;
 - deduplicate by stable entity ID;
 - reject repeated pages/cursors and page-cap exhaustion rather than return accumulated partial rows.
 
+Never copy authorization, cookies, CSRF/XSRF values, API keys, session identifiers, or token-bearing request bodies into output, ledgers, fixtures, or site memory. Redact keyed values; if a positional or opaque body cannot be sanitized confidently, preserve only its kind, shape, full size, and truncation/omission state.
+
 A cached page may render without a fresh request. A DOM fallback is valid only when it is strictly scoped to the target container, preserves the public columns, and can distinguish empty state from structure drift. Do not silently switch to a weaker page-wide selector.
 
 ## 8. Choose strategy per command
```

**File**: `src/browser/cdp.test.ts` (modified, +41/-2)
```diff
@@ -3,10 +3,12 @@ import { beforeEach, describe, expect, it, vi } from 'vitest';
 const { MockWebSocket } = vi.hoisted(() => {
   class MockWebSocket {
     static OPEN = 1;
+    static lastInstance: MockWebSocket | undefined;
     readyState = 1;
     private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
 
     constructor(_url: string) {
+      MockWebSocket.lastInstance = this;
       queueMicrotask(() => this.emit('open'));
     }
 
@@ -22,7 +24,7 @@ const { MockWebSocket } = vi.hoisted(() => {
       this.readyState = 3;
     }
 
-    private emit(event: string, ...args: unknown[]): void {
+    emit(event: string, ...args: unknown[]): void {
       for (const handler of this.handlers.get(event) ?? []) {
         handler(...args);
       }
@@ -36,7 +38,7 @@ vi.mock('ws', () => ({
   WebSocket: MockWebSocket,
 }));
 
-import { CDPBridge } from './cdp.js';
+import { CDPBridge, CDP_REQUEST_BODY_CAPTURE_LIMIT } from './cdp.js';
 
 describe('CDPBridge cookies', () => {
   beforeEach(() => {
@@ -96,4 +98,41 @@ describe('CDPBridge cookies', () => {
       ['Page.getLayoutMetrics', {}],
     ]);
   });
+
+  it('captures request headers and bounded post data on direct CDP pages', async () => {
+    vi.stubEnv('OPENCLI_CDP_ENDPOINT', 'ws://127.0.0.1:9222/devtools/page/1');
+
+    const bridge = new CDPBridge();
+    const fullBody = 'x'.repeat(CDP_REQUEST_BODY_CAPTURE_LIMIT + 5);
+    vi.spyOn(bridge, 'send').mockImplementation(async (method: string) => {
+      if (method === 'Network.getRequestPostData') return { postData: fullBody };
+      return {};
+    });
+
+    const page = await bridge.connect();
+    await page.startNetworkCapture?.();
+    MockWebSocket.lastInstance?.emit('message', Buffer.from(JSON.stringify({
+      method: 'Network.requestWillBeSent',
+      params: {
+        requestId: 'request-1',
+        request: {
+          method: 'POST',
+          url: 'https://example.test/rsc-action/actions/pagination',
+          headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
+          hasPostData: true,
+        },
+      },
+    })));
+
+    const entries = await page.readNetworkCapture?.() as Array<Record<string, unknown>>;
+    expect(entries).toHaveLength(1);
+    expect(entries[0]).toMatchObject({
+      method: 'POST',
+      requestHeaders: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' },
+      requestBodyKind: 'string',
+      requestBodyFullSize: fullBody.length,
+      requestBodyTruncated: true,
+    });
+    expect(String(entries[0].requestBodyPreview)).toHaveLength(CDP_REQUEST_BODY_CAPTURE_LIMIT);
+  });
 });
```

**File**: `src/browser/cdp.ts` (modified, +44/-1)
```diff
@@ -46,6 +46,7 @@ const CDP_SEND_TIMEOUT = 30_000;
 // surface `responseBodyFullSize` + `responseBodyTruncated` so downstream layers
 // can tell the agent what happened instead of lying about the payload.
 export const CDP_RESPONSE_BODY_CAPTURE_LIMIT = 8 * 1024 * 1024;
+export const CDP_REQUEST_BODY_CAPTURE_LIMIT = 1 * 1024 * 1024;
 
 export class CDPBridge implements IBrowserFactory {
   private _ws: WebSocket | null = null;
@@ -191,6 +192,11 @@ class CDPPage extends CDPBasePage {
   private _networkCapturePattern = '';
   private _networkEntries: Array<{
     url: string; method: string; responseStatus?: number;
+    requestHeaders?: Record<string, string>;
+    requestBodyKind?: string;
+    requestBodyPreview?: string;
+    requestBodyFullSize?: number;
+    requestBodyTruncated?: boolean;
     responseContentType?: string;
     responsePreview?: string;
     responseBodyFullSize?: number;
@@ -313,14 +319,51 @@ class CDPPage extends CDPBasePage {
 
       // Step 1: Record request method/url on requestWillBeSent
       this.bridge.on('Network.requestWillBeSent', (params: unknown) => {
-        const p = params as { requestId: string; request: { method: string; url: string }; timestamp: number };
+        const p = params as {
+          requestId: string;
+          request: {
+            method: string;
+            url: string;
+            headers?: Record<string, unknown>;
+            postData?: string;
+            hasPostData?: boolean;
+          };
+          timestamp: number;
+        };
         if (!this._networkCapturePattern || p.request.url.includes(this._networkCapturePattern)) {
+          const rawBody = typeof p.request.postData === 'string' ? p.request.postData : '';
+          const bodyTruncated = rawBody.length > CDP_REQUEST_BODY_CAPTURE_LIMIT;
           const idx = this._networkEntries.push({
             url: p.request.url,
             method: p.request.method,
+            requestHeaders: Object.fromEntries(
+              Object.entries(p.request.headers ?? {}).map(([name, value]) => [name, String(value)]),
+            ),
+            requestBodyKind: p.request.hasPostData ? 'string' : 'empty',
+            requestBodyPreview: bodyTruncated ? rawBody.slice(0, CDP_REQUEST_BODY_CAPTURE_LIMIT) : rawBody,
+            requestBodyFullSize: rawBody.length,
+            requestBodyTruncated: bodyTruncated,
             timestamp: Date.now(),
           }) - 1;
           this._pendingRequests.set(p.requestId, idx);
+
+          if (p.request.hasPostData && p.request.postData === undefined) {
+            const requestBodyFetch = this.bridge.send('Network.getRequestPostData', { requestId: p.requestId }).then((result: unknown) => {
+              const postData = (result as { postData?: string } | undefined)?.postData;
+              if (typeof postData !== 'string') return;
+              const truncated = postData.length > CDP_REQUEST_BODY_CAPTURE_LIMIT;
+              this._networkEntries[idx].requestBodyPreview = truncated
+                ? postData.slice(0, CDP_REQUEST_BODY_CAPTURE_LIMIT)
+                : postData;
+              this._networkEntries[idx].requestBodyFullSize = postData.length;
+              this._networkEntries[idx].requestBodyTruncated = truncated;
+            }).catch(() => {
+              // Some request types do not expose post data.
+            }).finally(() => {
+              this._pendingBodyFetches.delete(requestBodyFetch);
+            });
+            this._pendingBodyFetches.add(requestBodyFetch);
+          }
         }
       });
 
```

**File**: `src/browser/network-cache.ts` (modified, +3/-0)
```diff
@@ -13,6 +13,7 @@
 import * as fs from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
+import type { SafeNetworkRequest } from './network-request.js';
 
 export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
 
@@ -32,6 +33,8 @@ export interface CachedNetworkEntry {
     body_truncated?: boolean;
     body_full_size?: number;
     timestamp?: number;
+    /** Sanitized request context; credential values and opaque bodies are omitted. */
+    request?: SafeNetworkRequest;
 }
 
 export interface NetworkCacheFile {
```

**File**: `src/browser/network-request.test.ts` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+import { describe, expect, it } from 'vitest';
+import { sanitizeCapturedRequest, sanitizeCapturedUrl } from './network-request.js';
+
+describe('network request sanitization', () => {
+    it('redacts sensitive headers and nested JSON fields while preserving shape', () => {
+        const request = sanitizeCapturedRequest({
+            headers: {
+                'Content-Type': 'application/json',
+                Authorization: 'Bearer live-secret',
+                Cookie: 'sid=live-cookie',
+                'X-CSRF': 'bare-header-csrf',
+                'X-Trace-Id': 'trace-1',
+                'X-Runtime-Id': 'a'.repeat(48),
+            },
+            bodyKind: 'string',
+            bodyPreview: JSON.stringify({
+                query: 'timeline',
+                variables: { cursor: 'next', csrfToken: 'live-csrf', csrf: 'bare-body-csrf' },
+            }),
+            bodyFullSize: 91,
+        });
+
+        expect(request).toMatchObject({
+            headers: {
+                'Content-Type': 'application/json',
+                Authorization: '<redacted>',
+                Cookie: '<redacted>',
+                'X-CSRF': '<redacted>',
+                'X-Trace-Id': 'trace-1',
+                'X-Runtime-Id': '<redacted>',
+            },
+            body_kind: 'json',
+            body: {
+                query: 'timeline',
+                variables: { cursor: 'next', csrfToken: '<redacted>', csrf: '<redacted>' },
+            },
+            body_full_size: 91,
+            redacted: true,
+        });
+        expect(request?.body_shape?.['$.variables.csrfToken']).toBe('string');
+        expect(JSON.stringify(request)).not.toContain('live-secret');
+        expect(JSON.stringify(request)).not.toContain('live-cookie');
+        expect(JSON.stringify(request)).not.toContain('live-csrf');
+        expect(JSON.stringify(request)).not.toContain('bare-header-csrf');
+        expect(JSON.stringify(request)).not.toContain('bare-body-csrf');
+    });
+
+    it('redacts form credentials and preserves repeated safe fields', () => {
+        const request = sanitizeCapturedRequest({
+            headers: { 'content-type': 'application/x-www-form-urlencoded' },
+            bodyKind: 'string',
+            bodyPreview: 'q=opencli&tag=one&tag=two&access_token=secret&xsrf=bare-form-xsrf',
+        });
+
+        expect(request?.body_kind).toBe('form');
+        expect(request?.body).toEqual({
+            q: 'opencli',
+            tag: ['one', 'two'],
+            access_token: '<redacted>',
+            xsrf: '<redacted>',
+        });
+        expect(request?.redacted).toBe(true);
+    });
+
+    it('omits positional and truncated bodies but keeps their shape and size', () => {
+        const positional = sanitizeCapturedRequest({
+            bodyKind: 'string',
+            bodyPreview: JSON.stringify(['opaque-runtime-token', { cursor: 'next' }]),
+        });
+        expect(positional?.body_kind).toBe('json');
+        expect(positional?.body_omitted).toBe(true);
+        expect(positional?.body_shape?.['$']).toBe('array(2)');
+        expect(positional).not.toHaveProperty('body');
+
+        const truncated = sanitizeCapturedRequest({
+            bodyKind: 'string',
+            bodyPreview: '{"partial":',
+            bodyFullSize: 50_000,
+            bodyTruncated: true,
+        });
+        expect(truncated).toMatchObject({
+            body_kind: 'opaque',
+            body_full_size: 50_000,
+            body_truncated: true,
+            body_omitted: true,
+        });
+    });
+
+    it('redacts credential-shaped URL query parameters', () => {
+        const url = sanitizeCapturedUrl('https://api.example.test/rsc-action?page=2&csrf_token=secret&xsrf=bare-query-xsrf');
+        expect(url).toContain('page=2');
+        expect(url).toContain('csrf_token=%3Credacted%3E');
+        expect(url).toContain('xsrf=%3Credacted%3E');
+        expect(url).not.toContain('secret');
+        expect(url).not.toContain('bare-query-xsrf');
+    });
+});
```

**File**: `src/browser/network-request.ts` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+import { inferShape, type Shape } from './shape.js';
+
+const REDACTED = '<redacted>';
+
+export interface SafeNetworkRequest {
+    headers?: Record<string, string>;
+    body_kind?: 'empty' | 'json' | 'form' | 'opaque';
+    body?: unknown;
+    body_shape?: Shape;
+    body_full_size?: number;
+    body_truncated?: boolean;
+    body_omitted?: boolean;
+    redacted?: boolean;
+}
+
+export interface CapturedRequestMetadata {
+    headers?: unknown;
+    bodyKind?: unknown;
+    bodyPreview?: unknown;
+    bodyFullSize?: unknown;
+    bodyTruncated?: unknown;
+}
+
+function normalizedName(name: string): string {
+    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
+}
+
+function isSensitiveName(name: string): boolean {
+    const normalized = normalizedName(name);
+    return normalized === 'authorization'
+        || normalized === 'proxyauthorization'
+        || normalized === 'cookie'
+        || normalized === 'setcookie'
+        || normalized === 'sapisid'
+        || normalized === 'sid'
+        || normalized === 'liat'
+        || normalized === 'jsessionid'
+        || normalized === 'password'
+        || normalized === 'passwd'
+        || normalized === 'apikey'
+        || normalized === 'auth'
+        || normalized === 'authentication'
+        || normalized === 'credential'
+        || normalized === 'credentials'
+        || normalized === 'signature'
+        || normalized === 'sig'
+        || normalized === 'csrf'
+        || normalized === 'xcsrf'
+        || normalized === 'xsrf'
+        || normalized === 'xxsrf'
+        || normalized === 'clientsecret'
+        || normalized.endsWith('authorization')
+        || normalized.endsWith('cookie')
+        || normalized.endsWith('apikey')
+        || normalized.endsWith('password')
+        || normalized.endsWith('passwd')
+        || normalized.endsWith('token')
+        || normalized.endsWith('secret')
+        || normalized.endsWith('sessionid');
+}
+
+function isCredentialLikeValue(value: string): boolean {
+    const trimmed = value.trim();
+    return /^(?:bearer|basic)\s+\S+/i.test(trimmed)
+        || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)
+        || /^[a-f0-9]{32,}$/i.test(trimmed)
+        || /^[A-Za-z0-9_-]{48,}$/.test(trimmed);
+}
+
+function sanitizeHeaders(raw: unknown): { headers?: Record<string, string>; redacted: boolean } {
+    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { redacted: false };
+    const headers: Record<string, string> = {};
+    let redacted = false;
+    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
+        const stringValue = String(value);
+        if (isSensitiveName(name) || isCredentialLikeValue(stringValue)) {
+            headers[name] = REDACTED;
+            redacted = true;
+        } else {
+            headers[name] = stringValue;
+        }
+    }
+    return { ...(Object.keys(headers).length > 0 ? { headers } : {}), redacted };
+}
+
+function redactObject(value: unknown): { value: unknown; redacted: boolean } {
+    if (Array.isArray(value)) {
+        let redacted = false;
+        const next = value.map((item) => {
+            const result = redactObject(item);
+            redacted ||= result.redacted;
+            return result.value;
+        });
+        return { value: next, redacted };
+    }
+    if (typeof value === 'string' && isCredentialLikeValue(value)) {
+        return { value: REDACTED, redacted: true };
+    }
+    if (!value || typeof value !== 'object') return { value, redacted: false };
+
+    let redacted = false;
+    const next: Record<string, unknown> = {};
+    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
+        if (isSensitiveName(key)) {
+            next[key] = REDACTED;
+            redacted = true;
+            continue;
+        }
+        const result = redactObject(item);
+        next[key] = result.value;
+        redacted ||= result.redacted;
+    }
+    return { value: next, redacted };
+}
+
+function formBody(raw: string): { body: Record<string, string | string[]>; redacted: boolean } {
+    const values = new URLSearchParams(raw);
+    const body: Record<string, string | string[]> = {};
+    let redacted = false;
+    for (const [key, value] of values.entries()) {
+        const safeValue = isSensitiveName(key) || isCredentialLikeValue(value) ? REDACTED : value;
+        redacted ||= safeValue === REDACTED;
+        const previous = body[key];
+        if (previous === undefined) body[key] = safeValue;
+        else if (Array.isArray(previous)) previous.push(safeValue);
+        else body[key] = [previous, safeValue];
+    }
+    return { body, redacted };
+}
+
+function headerValue(headers: Record<string, string> | undefined, name: string): string {
+    if (!headers) return '';
+    const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
+    return match?.[1] ?? '';
+}
+
+/**
```

**File**: `src/cli.test.ts` (modified, +106/-0)
```diff
@@ -1996,6 +1996,112 @@ describe('browser network command', () => {
     expect(out.entries[0].shape['$.messages']).toBe('array(1)');
   });
 
+  it('treats React Server Component responses as API-like traffic', async () => {
+    browserState.page!.readNetworkCapture = vi.fn().mockResolvedValue([
+      {
+        url: 'https://www.linkedin.com/flagship-web/rsc-action/actions/pagination',
+        method: 'POST',
+        responseStatus: 200,
+        responseContentType: 'text/x-component',
+        responsePreview: '1:{"posts":[{"id":"p1"}]}',
+      },
+      {
+        url: 'https://www.linkedin.com/flagship-web/rsc-action/actions/detail',
+        method: 'POST',
+        responseStatus: 200,
+        responseContentType: 'text/html',
+        responsePreview: '<rsc-stream>',
+      },
+    ]);
+    const program = createProgram('', '');
+
+    await program.parseAsync(['node', 'opencli', 'browser', '--session', 'test', 'network']);
+
+    const out = lastJsonLog();
+    expect(out.count).toBe(2);
+    expect(out.filtered_out).toBe(0);
+    expect(out.entries.map((entry: any) => entry.key)).toEqual([
+      'POST www.linkedin.com/flagship-web/rsc-action/actions/pagination',
+      'POST www.linkedin.com/flagship-web/rsc-action/actions/detail',
+    ]);
+  });
+
+  it('caches the raw drained batch before display filtering so a later --all can recover it', async () => {
+    browserState.page!.readNetworkCapture = vi.fn()
+      .mockResolvedValueOnce([
+        {
+          url: 'https://example.com/page-fragment',
+          method: 'GET',
+          responseStatus: 200,
+          responseContentType: 'text/html',
+          responsePreview: '<main>hidden from default output</main>',
+        },
+      ])
+      .mockResolvedValueOnce([]);
+    const program = createProgram('', '');
+
+    await program.parseAsync(['node', 'opencli', 'browser', '--session', 'test', 'network']);
+    expect(lastJsonLog()).toMatchObject({ count: 0, filtered_out: 1 });
+
+    consoleLogSpy.mockClear();
+    await program.parseAsync(['node', 'opencli', 'browser', '--session', 'test', 'network', '--all']);
+
+    const out = lastJsonLog();
+    expect(out.count).toBe(1);
+    expect(out.cache_reused).toBe(true);
+    expect(out.entries[0].key).toBe('GET example.com/page-fragment');
+  });
+
+  it('--detail exposes sanitized request context without credential values', async () => {
+    browserState.page!.readNetworkCapture = vi.fn().mockResolvedValue([
+      {
+        url: 'https://www.linkedin.com/flagship-web/rsc-action/actions/pagination?csrf_token=url-secret',
+        method: 'POST',
+        requestHeaders: {
+          'Content-Type': 'application/json',
+          Cookie: 'li_at=cookie-secret',
+          'X-CSRF-Token': 'header-secret',
+          'X-Trace-Id': 'trace-1',
+        },
+        requestBodyKind: 'string',
+        requestBodyPreview: JSON.stringify({ variables: { cursor: 'next', accessToken: 'body-secret' } }),
+        requestBodyFullSize: 123,
+        requestBodyTruncated: false,
+        responseStatus: 200,
+        responseContentType: 'text/x-component',
+        responsePreview: '1:{"posts":[]}',
+      },
+    ]);
+    const program = createProgram('', '');
+
+    await program.parseAsync(['node', 'opencli', 'browser', '--session', 'test', 'network']);
+    consoleLogSpy.mockClear();
+    await program.parseAsync([
+      'node', 'opencli', 'browser', '--session', 'test', 'network',
+      '--detail', 'POST www.linkedin.com/flagship-web/rsc-action/actions/pagination',
+    ]);
+
+    const out = lastJsonLog();
+    expect(out.url).toContain('csrf_token=%3Credacted%3E');
+    expect(out.request).toMatchObject({
+      headers: {
+        'Content-Type': 'application/json',
+        Cookie: '<redacted>',
+        'X-CSRF-Token': '<redacted>',
+        'X-Trace-Id': 'trace-1',
+      },
+      body_kind: 'json',
+      body: { variables: { cursor: 'next', accessToken: '<redacted>' } },
+      body_full_size: 123,
+      redacted: true,
+    });
+    expect(out.request.body_shape['$.variables.accessToken']).toBe('string');
+    expect(JSON.stringify(out)).not.toContain('url-secret');
+    expect(JSON.stringify(out)).not.toContain('cookie-secret');
+    expect(JSON.stringify(out)).not.toContain('header-secret');
+    expect(JSON.stringify(out)).not.toContain('body-secret');
+  });
+
   it('--raw emits full bodies inline for every entry', async () => {
     const program = createProgram('', '');
 
```

---

### Incident Patch 12: `c2964f95` (2026-08-26)
**Commit Message**: fix(output): keep markdown rows intact for multi-line cells (#2375)

renderMarkdown escaped pipes but not newlines, so a cell containing a
line break terminated the table row and broke the markdown structure.
Render embedded newlines as <br>, matching how renderCsv already
handles multi-line values.

**File**: `src/output.test.ts` (modified, +20/-2)
```diff
@@ -32,9 +32,9 @@ describe('output TTY detection', () => {
 
   it('respects explicit -f json even in non-TTY', () => {
     Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
-    render([{ name: 'alice' }], { fmt: 'json' });
+    render([{ name: 'alice', note: 'line 1\nline 2' }], { fmt: 'json' });
     const out = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
-    expect(JSON.parse(out)).toEqual([{ name: 'alice' }]);
+    expect(JSON.parse(out)).toEqual([{ name: 'alice', note: 'line 1\nline 2' }]);
   });
 
   it('shows elapsed time when elapsed is 0', () => {
@@ -60,6 +60,24 @@ describe('output TTY detection', () => {
     expect(out).not.toContain('| markdown |');
   });
 
+  it('keeps markdown records on one physical row across embedded line breaks', () => {
+    render([
+      { id: 'mixed', cell: 'left|right\r\nmiddle\n\nlast\rtail' },
+      { id: 'null', cell: null },
+      { id: 'undefined', cell: undefined },
+    ], { fmt: 'md', columns: ['id', 'cell'] });
+
+    const lines = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
+    expect(lines).toEqual([
+      '| id | cell |',
+      '| --- | --- |',
+      '| mixed | left\\|right<br>middle<br><br>last<br>tail |',
+      '| null |  |',
+      '| undefined |  |',
+    ]);
+    expect(lines.every((line: string) => !/[\r\n]/.test(line))).toBe(true);
+  });
+
   it('escapes pipe characters in markdown table cells', () => {
     render([{ name: 'a|b', score: 10 }], { fmt: 'md', columns: ['name', 'score'] });
     const out = logSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
```

**File**: `src/output.ts` (modified, +4/-1)
```diff
@@ -124,7 +124,10 @@ function renderMarkdown(data: unknown, opts: RenderOptions): void {
   console.log('| ' + columns.join(' | ') + ' |');
   console.log('| ' + columns.map(() => '---').join(' | ') + ' |');
   for (const row of rows) {
-    console.log('| ' + columns.map(c => String((row as Record<string, unknown>)[c] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |');
+    console.log('| ' + columns.map(c => String((row as Record<string, unknown>)[c] ?? '')
+      .replace(/\|/g, '\\|')
+      // Any embedded line break would split the physical table row.
+      .replace(/\r\n?|\n/g, '<br>')).join(' | ') + ' |');
   }
 }
 
```

---

### Incident Patch 13: `0a4a863b` (2026-08-25)
**Commit Message**: fix(linkedin): make sent invitations and thread snapshots accurate (#2395)

* fix(linkedin): use accurate invitation and thread sources

* fix(linkedin): preserve thread discovery budget

---------

Co-authored-by: OpenCLI-sol <[REDACTED_EMAIL]>

**File**: `cli-manifest.json` (modified, +4/-4)
```diff
@@ -23207,10 +23207,10 @@
   {
     "site": "linkedin",
     "name": "thread-snapshot",
-    "description": "Load a LinkedIn messaging thread, scroll for available history, and return a full context snapshot",
+    "description": "Load a LinkedIn messaging thread and return a structured conversation snapshot",
     "access": "read",
     "domain": "www.linkedin.com",
-    "strategy": "ui",
+    "strategy": "cookie",
     "browser": true,
     "args": [
       {
@@ -23224,7 +23224,7 @@
         "type": "number",
         "default": 30,
         "required": false,
-        "help": "Maximum upward scroll attempts to load older messages"
+        "help": "Maximum upward scroll attempts used to request older message pages"
       },
       {
         "name": "json",
@@ -23244,7 +23244,7 @@
     "type": "js",
     "modulePath": "linkedin/thread-snapshot.js",
     "sourceFile": "linkedin/thread-snapshot.js",
-    "navigateBefore": true
+    "navigateBefore": "https://www.linkedin.com"
   },
   {
     "site": "linkedin",
```

**File**: `clis/linkedin/sent-invitations.js` (modified, +53/-15)
```diff
@@ -1,5 +1,5 @@
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
+import { AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
 import { unwrapEvaluateResult } from './shared.js';
 
 const LINKEDIN_DOMAIN = 'www.linkedin.com';
@@ -19,35 +19,61 @@ function buildSentInvitationsScript() {
         .replace(/^(view\s+)?profile\s+of\s+/i, '')
         .replace(/\s*(?:View profile|LinkedIn|Pending|Sent|Withdraw).*$/i, ''));
     };
-    const cards = Array.from(document.querySelectorAll('li, div, section, article')).filter((el) => {
+    const explicitEmpty = /(?:no|don't have any|haven't sent any)\s+(?:pending\s+)?(?:sent\s+)?invitations?/i.test(text)
+      || /暂无(?:已发送|待处理)?邀请/.test(text);
+    const cards = Array.from(document.querySelectorAll('[role="listitem"], li, article')).filter((el) => {
       if (!el || el.offsetParent === null) return false;
-      const t = clean(el.innerText || el.textContent || '');
-      return t && /withdraw/i.test(t) && t.length < 1200;
+      const profileLink = el.querySelector('a[href*="/in/"]');
+      const actions = Array.from(el.querySelectorAll('a, button'));
+      const withdraw = actions.find((action) => {
+        const label = clean(action.getAttribute('aria-label') || action.innerText || action.textContent || '');
+        return /^withdraw(?:\s+invitation\s+sent\s+to\b|$)/i.test(label);
+      });
+      return Boolean(profileLink && withdraw);
     });
-    const byName = new Map();
+    const byProfile = new Map();
+    let malformedCount = 0;
     for (const card of cards) {
       const raw = card.innerText || card.textContent || '';
-      if (!/withdraw/i.test(raw)) continue;
       const lines = raw.split(/\n+/).map(clean).filter(Boolean);
       const link = card.querySelector('a[href*="/in/"]');
+      const withdraw = Array.from(card.querySelectorAll('a, button')).find((action) => {
+        const label = clean(action.getAttribute('aria-label') || action.innerText || action.textContent || '');
+        return /^withdraw(?:\s+invitation\s+sent\s+to\b|$)/i.test(label);
+      });
+      const withdrawLabel = clean(withdraw ? (withdraw.getAttribute('aria-label') || '') : '');
+      const actionName = cleanName((withdrawLabel.match(/^withdraw\s+invitation\s+sent\s+to\s+(.+)$/i) || [])[1] || '');
       const linkName = cleanName(link ? (link.innerText || link.textContent || link.getAttribute('aria-label') || '') : '');
-      const name = linkName
+      const name = actionName
+        || linkName
         || cleanName(lines.find((line) => !/^(pending|sent|withdraw|message|view profile|invitation|invited|ago|manage|received)\b/i.test(line)) || '');
-      if (!name) continue;
       const hrefAttr = link ? (link.getAttribute('href') || '') : '';
       const profile_url = hrefAttr ? new URL(hrefAttr, location.origin).toString().replace(/[?#].*$/, '') : '';
       const invited_date_text = clean((raw.match(/(?:Sent|Invited)\s+(?:\d+\s+\w+\s+ago|yesterday|today)/i) || [''])[0]);
-      const key = name.toLowerCase();
-      const existing = byName.get(key);
+      if (!name || !profile_url) {
+        malformedCount += 1;
+        continue;
+      }
+      const key = profile_url.toLowerCase();
+      const existing = byProfile.get(key);
       if (!existing) {
-        byName.set(key, { name, profile_url, invited_date_text });
+        byProfile.set(key, { name, profile_url, invited_date_text });
       } else {
-        if (!existing.profile_url && profile_url) existing.profile_url = profile_url;
         if (!existing.invited_date_text && invited_date_text) existing.invited_date_text = invited_date_text;
       }
     }
-    const rows = Array.from(byName.values());
-    return { url: href, title: document.title || '', authRequired, warning, count: rows.length, rows, bodyText: text.slice(0, 1000) };
+    const rows = Array.from(byProfile.values());
+    return {
+      url: href,
+      title: document.title || '',
+      authRequired,
+      warning,
+      explicitEmpty,
+      candidateCount: cards.length,
+      malformedCount,
+      count: rows.length,
+      rows,
+    };
   })()`;
 }
 
@@ -72,7 +98,19 @@ cli({
     if (result?.warning) {
       throw new CommandExecutionError('LinkedIn warning/restriction state visible on sent invitations page.');
     }
-    const rows = Array.isArray(result?.rows) ? result.rows : [];
+    if (!result || typeof result !== 'object' || Array.isArray(result) || !Array.isArray(result.rows)) {
+      throw new CommandExecutionError('LinkedIn sent invitations returned a malformed extraction payload.');
+    }
+    if (result.malformedCount > 0) {
+      throw new CommandExecutionError('LinkedIn sent invitations contained a malformed invitation card.');
+    }
+    const rows = result.rows;
+    if (rows.length === 0) {
+      if (result.explicitEmpty) {
+        throw new Emp
```

**File**: `clis/linkedin/sent-invitations.test.js` (modified, +14/-16)
```diff
@@ -13,19 +13,20 @@ describe('linkedin sent-invitations command', () => {
     expect(command.columns).toEqual(['rank', 'name', 'profile_url', 'invited_date_text']);
   });
 
-  it('extracts clean names and dedupes invitation cards by profile url', () => {
+  it('scopes extraction to semantic invitation rows and ignores navigation labels', () => {
     const dom = new JSDOM(`<!doctype html><body>
+      <header>
+        <a href="/in/olga-magere/">0 notifications</a>
+        <a href="/in/olga-magere/">Home</a>
+        <button>Withdraw</button>
+      </header>
       <ul>
-        <li>
-          <a href="/in/olga-magere/?miniProfileUrn=x"><span>Olga Magere</span></a>
-          <span>Pending</span><button>Withdraw</button><span>Sent 2 weeks ago</span>
-        </li>
-        <li>
-          <a href="/in/olga-magere/?trk=dup"><span>Olga Magere</span></a>
-          <span>Pending</span><button>Withdraw</button><span>Sent 2 weeks ago</span>
-        </li>
-        <li>
-          <div>Sam Founder\nSent yesterday\nWithdraw</div>
+        <li role="listitem">
+          <a href="/in/olga-magere/?miniProfileUrn=x"><span aria-label="Olga Magere's profile picture"></span></a>
+          <p>Olga Magere</p>
+          <span>Pending</span>
+          <button aria-label="Withdraw invitation sent to Olga Magere">Withdraw</button>
+          <span>Sent 2 weeks ago</span>
         </li>
       </ul>
     </body>`, { url: 'https://www.linkedin.com/mynetwork/invitation-manager/sent/' });
@@ -40,17 +41,14 @@ describe('linkedin sent-invitations command', () => {
       Object.defineProperty(dom.window.HTMLElement.prototype, 'offsetParent', { get() { return dom.window.document.body; }, configurable: true });
       const run = Function(`return ${buildSentInvitationsScript()}`);
       const result = run();
+      expect(result.candidateCount).toBe(1);
+      expect(result.malformedCount).toBe(0);
       expect(result.rows).toEqual([
         {
           name: 'Olga Magere',
           profile_url: 'https://www.linkedin.com/in/olga-magere/',
           invited_date_text: 'Sent 2 weeks ago',
         },
-        {
-          name: 'Sam Founder',
-          profile_url: '',
-          invited_date_text: 'Sent yesterday',
-        },
       ]);
       expect(result.rows[0]).not.toHaveProperty('raw');
     } finally {
```

**File**: `clis/linkedin/thread-snapshot.js` (modified, +292/-78)
```diff
@@ -1,6 +1,11 @@
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { ArgumentError, AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
-import { canonicalizeLinkedInThreadUrl, normalizeWhitespace, unwrapEvaluateResult } from './shared.js';
+import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import {
+  canonicalizeLinkedInThreadUrl,
+  normalizeWhitespace,
+  requireLinkedInCookie,
+  unwrapEvaluateResult,
+} from './shared.js';
 
 const LINKEDIN_DOMAIN = 'www.linkedin.com';
 
@@ -25,17 +30,13 @@ function parseMaxScrolls(value) {
   return scrolls;
 }
 
-function buildThreadSnapshotScript(maxScrolls) {
-  const scrolls = maxScrolls;
+function buildThreadApiDiscoveryScript(maxScrolls) {
   return String.raw`(async () => {
-    const marker = '__OPENCLI_LINKEDIN_THREAD_SNAPSHOT__';
-    void marker;
     const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
-    const clean = (s) => String(s || '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
-    const text = document.body ? (document.body.innerText || '') : '';
-    const authRequired = /\b(sign in|log in|join linkedin)\b/i.test(text)
-      || /linkedin\.com\/(login|checkpoint|authwall)/i.test(location.href)
-      || /captcha|verification required/i.test(text);
+    const pageText = document.body ? (document.body.innerText || '') : '';
+    const authRequired = /\b(sign in|log in|join linkedin)\b/i.test(pageText)
+      || /linkedin\.com\/(login|checkpoint|authwall|uas)/i.test(location.href)
+      || /captcha|verification required/i.test(pageText);
 
     const selectors = [
       '.msg-s-message-list',
@@ -46,88 +47,265 @@ function buildThreadSnapshotScript(maxScrolls) {
     ];
     let scroller = null;
     for (const selector of selectors) {
-      const el = document.querySelector(selector);
-      if (el && (el.scrollHeight > el.clientHeight || selector === 'main')) { scroller = el; break; }
+      const element = document.querySelector(selector);
+      if (element && (element.scrollHeight > element.clientHeight || selector === 'main')) {
+        scroller = element;
+        break;
+      }
     }
     scroller = scroller || document.scrollingElement || document.documentElement;
+
     let previousHeight = -1;
     let stable = 0;
-    for (let i = 0; i < ${scrolls}; i += 1) {
+    let attempts = 0;
+    for (let index = 0; index < ${maxScrolls}; index += 1) {
+      attempts += 1;
       scroller.scrollTop = 0;
       window.scrollTo(0, 0);
       await sleep(750);
       const height = scroller.scrollHeight || document.body.scrollHeight || 0;
-      if (height === previousHeight) stable += 1; else stable = 0;
+      if (height === previousHeight) stable += 1;
+      else stable = 0;
       previousHeight = height;
       if (stable >= 3) break;
     }
     await sleep(1000);
 
-    const headerCandidates = [];
-    const headerSelectors = [
-      '.msg-thread__link-to-profile',
-      '.msg-thread__link-to-profile span[aria-hidden="true"]',
-      '.msg-entity-lockup__entity-title',
-      '.msg-conversation-card__participant-names',
-      'main h1',
-      'main h2',
-      '[data-anonymize="person-name"]',
-      'a[href*="/in/"] span[aria-hidden="true"]',
-      'a[href*="/in/"]'
-    ];
-    for (const selector of headerSelectors) {
-      for (const el of Array.from(document.querySelectorAll(selector)).slice(0, 8)) {
-        const value = clean(el.innerText || el.textContent || el.getAttribute('aria-label'));
-        if (value && value.length <= 120 && !/^(message|messaging|send|profile|view profile)$/i.test(value)) {
-          headerCandidates.push(value);
-        }
-      }
-    }
-
+    const threadId = (location.pathname.match(/^\/messaging\/thread\/([^/]+)\/?$/i) || [])[1] || '';
+    const apiUrls = [];
     const seen = new Set();
-    const messages = [];
-    const nodes = Array.from(document.querySelectorAll('.msg-s-message-list__event, .msg-s-event-listitem, [data-event-urn], .msg-s-message-list-content'));
-    for (const [nodeIndex, el] of nodes.entries()) {
-      const raw = clean(el.innerText || el.textContent);
-      if (!raw || seen.has(raw)) continue;
-      seen.add(raw);
-      const lines = raw.split(/\n+/).map(clean).filter(Boolean);
-      const speaker = lines.length > 1 && lines[0].length <= 120 ? lines[0] : '';
-      messages.push({ index: messages.length, nodeIndex, speaker, text: raw });
-    }
-
-    const refreshedText = document.body ? (document.body.innerText || '') : '';
-    const fallbackLines = refreshedText.split(/\n+/).map(clean).filter(Boolean);
-    const latestMessageText = messages.length
-      ? messages[messages.length - 1].text
-      : ([...fallbackLines].reverse().find((line) => !/^(send|reply|write a message|press enter to send)$/i.test(line)) || '');
+    for (const entry of performance.getEntriesByType('resource')) {
+      const ur
```

**File**: `clis/linkedin/thread-snapshot.test.js` (modified, +163/-23)
```diff
@@ -3,13 +3,83 @@ import { getRegistry } from '@jackwener/opencli/registry';
 import { ArgumentError, CommandExecutionError } from '@jackwener/opencli/errors';
 import './thread-snapshot.js';
 
-const { parseMaxScrolls } = await import('./thread-snapshot.js').then((m) => m.__test__);
+const {
+  parseMaxScrolls,
+  parseThreadPages,
+  validateThreadApiUrls,
+} = await import('./thread-snapshot.js').then((module) => module.__test__);
 
-function makeFakePage(snapshot) {
+const THREAD_URL = 'https://www.linkedin.com/messaging/thread/2-abc/';
+const API_URL = 'https://www.linkedin.com/voyager/api/voyagerMessagingGraphQL/graphql?queryId=messengerMessages.abc123&variables=(conversationUrn:urn%3Ali%3Amsg_conversation%3A%28urn%3Ali%3Afsd_profile%3Aowner%2C2-abc%29)';
+const OWNER_URN = 'urn:li:fsd_profile:owner';
+const OWNER_PARTICIPANT = `urn:li:msg_messagingParticipant:${OWNER_URN}`;
+const OTHER_PARTICIPANT = 'urn:li:msg_messagingParticipant:urn:li:fsd_profile:other';
+
+function participant(entityUrn, hostIdentityUrn, firstName, lastName) {
+  return {
+    entityUrn,
+    hostIdentityUrn,
+    participantType: {
+      member: {
+        firstName: { text: firstName },
+        lastName: { text: lastName },
+      },
+    },
+    $type: 'com.linkedin.messenger.MessagingParticipant',
+  };
+}
+
+function message(entityUrn, senderUrn, deliveredAt, text) {
+  return {
+    entityUrn,
+    '*sender': senderUrn,
+    deliveredAt,
+    body: { text },
+    $type: 'com.linkedin.messenger.Message',
+  };
+}
+
+function normalizedPage(included, refs = included.filter((entity) => entity.$type === 'com.linkedin.messenger.Message').map((entity) => entity.entityUrn)) {
+  return {
+    data: {
+      data: {
+        messengerMessagesBySyncToken: {
+          metadata: { shouldClearCache: true },
+          '*elements': refs,
+        },
+      },
+    },
+    included,
+  };
+}
+
+function liveFixturePages() {
+  return [{
+    url: API_URL,
+    json: normalizedPage([
+      participant(OWNER_PARTICIPANT, OWNER_URN, 'Jie', 'Wen'),
+      participant(OTHER_PARTICIPANT, 'urn:li:fsd_profile:other', 'Neha', 'Rudraraju'),
+      message('urn:li:msg_message:2', OWNER_PARTICIPANT, 200, 'safe-send test from hermes. pls ignore :)'),
+      message('urn:li:msg_message:1', OTHER_PARTICIPANT, 100, 'damn i just saw ur msg sry sry'),
+    ]),
+  }];
+}
+
+function makeFakePage({ discovery, fetched } = {}) {
   return {
     goto: vi.fn(async () => undefined),
     wait: vi.fn(async () => undefined),
-    evaluate: vi.fn(async () => snapshot),
+    getCookies: vi.fn(async () => [{ name: 'JSESSIONID', value: '"ajax:123"' }]),
+    evaluate: vi.fn()
+      .mockResolvedValueOnce(discovery || {
+        url: THREAD_URL,
+        title: 'Messaging | LinkedIn',
+        authRequired: false,
+        apiUrls: [API_URL],
+        scrollAttempts: 4,
+        scrollStable: true,
+      })
+      .mockResolvedValueOnce(fetched || { pages: liveFixturePages() }),
   };
 }
 
@@ -22,45 +92,89 @@ describe('linkedin thread-snapshot command', () => {
     expect(() => parseMaxScrolls(1.5)).toThrow('--max-scrolls must be an integer between 0 and 80');
   });
 
-  it('registers as a read command for loading full thread context', () => {
+  it('registers as a read command for structured thread context', () => {
     const command = getRegistry().get('linkedin/thread-snapshot');
     expect(command).toBeDefined();
     expect(command.access).toBe('read');
     expect(command.columns).toEqual(expect.arrayContaining(['thread_url', 'recipient', 'message_count', 'latest_text']));
   });
 
-  it('opens messaging first, then exact thread, and returns extracted messages', async () => {
+  it('opens the exact thread, discovers the live API, and returns deduped chronological messages', async () => {
     const command = getRegistry().get('linkedin/thread-snapshot');
-    const page = makeFakePage({
-      url: 'https://www.linkedin.com/messaging/thread/abc/',
-      headerNames: ['Neha Rudraraju'],
-      latestMessageText: 'safe-send test from hermes. pls ignore :)',
-      messages: [
-        { index: 0, speaker: 'Neha Rudraraju', text: 'damn i just saw ur msg sry sry' },
-        { index: 1, speaker: 'Me', text: 'safe-send test from hermes. pls ignore :)' },
-      ],
-    });
+    const page = makeFakePage();
 
     const rows = await command.func(page, {
-      'thread-url': 'https://www.linkedin.com/messaging/thread/abc/',
+      'thread-url': THREAD_URL,
       'max-scrolls': 8,
       json: false,
     });
 
-    expect(page.goto).toHaveBeenNthCalledWith(1, 'https://www.linkedin.com/messaging/');
-    expect(page.goto).toHaveBeenNthCalledWith(2, 'https://www.linkedin.com/messaging/thread/abc/');
+    expect(page.goto).toHaveBeenCalledTimes(1);
+    expect(page.goto).toHaveBeenCalledWith(THREAD_URL);
+    expect(page.getCookies).toHaveBeenCalledWith({ url: 'https://www.linkedin.com' });
     expect(rows[0]).toMatchObject({
-      thread_url: 'https://www
```

---

### Incident Patch 14: `64e6f0e3` (2026-08-25)
**Commit Message**: fix(ctrip): read structured flight results (#2393)

Co-authored-by: OpenCLI-sol <[REDACTED_EMAIL]>

**File**: `cli-manifest.json` (modified, +1/-1)
```diff
@@ -9108,7 +9108,7 @@
     "description": "搜索携程一程机票（按出发/到达 IATA 三字码 + 日期）",
     "access": "read",
     "domain": "flights.ctrip.com",
-    "strategy": "cookie",
+    "strategy": "intercept",
     "browser": true,
     "args": [
       {
```

**File**: `clis/ctrip/ctrip.test.js` (modified, +128/-56)
```diff
@@ -51,7 +51,7 @@ import {
     WAIT_FOR_HOTEL_DETAIL_JS,
 } from './utils.js';
 
-function createPageMock(evaluateResults) {
+function createPageMock(evaluateResults, networkCaptures = []) {
     const evaluate = vi.fn();
     for (const result of evaluateResults) {
         evaluate.mockResolvedValueOnce(result);
@@ -63,6 +63,10 @@ function createPageMock(evaluateResults) {
         scroll: vi.fn().mockResolvedValue(undefined),
         autoScroll: vi.fn().mockResolvedValue(undefined),
         getCookies: vi.fn().mockResolvedValue([]),
+        startNetworkCapture: vi.fn().mockResolvedValue(true),
+        readNetworkCapture: vi.fn()
+            .mockResolvedValueOnce([])
+            .mockResolvedValueOnce(networkCaptures),
     };
 }
 
@@ -558,24 +562,45 @@ describe('ctrip hotel-search command (registry-level)', () => {
 describe('ctrip flight command (registry-level)', () => {
     const cmd = getRegistry().get('ctrip/flight');
 
-    const FLIGHT_RAW = {
-        airline: '厦门航空',
-        flightNo: 'MF8561',
-        aircraft: '空客321(中)',
-        departureTime: '07:50',
-        departureAirport: '大兴国际机场',
-        arrivalTime: '09:45',
-        arrivalAirport: '浦东国际机场',
-        terminal: 'T2',
-        price: 487,
-        currency: '¥',
-        cabin: '经济舱',
-    };
+    function itinerary({
+        id = 'MF8561_1', airline = '厦门航空', flightNo = 'MF8561', aircraft = '空客321(中)',
+        departure = '2026-06-15 07:50:00', departureAirport = '大兴国际机场',
+        arrival = '2026-06-15 09:45:00', arrivalAirport = '浦东国际机场', terminal = 'T2',
+        price = 487, cabin = 'Y', legs,
+    } = {}) {
+        const flightList = legs || [{
+            flightNo,
+            aircraftName: aircraft,
+            departureDateTime: departure,
+            departureAirportName: departureAirport,
+            arrivalDateTime: arrival,
+            arrivalAirportName: arrivalAirport,
+            arrivalTerminal: terminal,
+        }];
+        return {
+            itineraryId: id,
+            flightSegments: [{ airlineName: airline, flightList }],
+            priceList: [{ sortPrice: price, adultPrice: price, cabin }],
+        };
+    }
 
-    it('declares Strategy.COOKIE + browser:true + navigateBefore:false + access:read', () => {
+    function batchPayload(flightItineraryList, { finished = true, status = 0, msg = 'success' } = {}) {
+        return { status, msg, data: { context: { finished }, flightItineraryList } };
+    }
+
+    function batchCapture(payload, overrides = {}) {
+        return {
+            url: 'https://flights.ctrip.com/international/search/api/search/batchSearch?v=1',
+            responseStatus: 200,
+            responsePreview: JSON.stringify(payload),
+            ...overrides,
+        };
+    }
+
+    it('declares Strategy.INTERCEPT + browser:true + navigateBefore:false + access:read', () => {
         expect(cmd.access).toBe('read');
         expect(cmd.browser).toBe(true);
-        expect(String(cmd.strategy)).toContain('cookie');
+        expect(String(cmd.strategy)).toContain('intercept');
         expect(cmd.navigateBefore).toBe(false);
         expect(cmd.domain).toBe('flights.ctrip.com');
     });
@@ -590,63 +615,80 @@ describe('ctrip flight command (registry-level)', () => {
             .rejects.toMatchObject({ code: 'ARGUMENT', message: expect.stringContaining('--date') });
         await expect(cmd.func(page, { from: 'PEK', to: 'SHA', date: '2026-06-15', limit: 0 }))
             .rejects.toMatchObject({ code: 'ARGUMENT', message: expect.stringContaining('--limit') });
+        expect(page.startNetworkCapture).not.toHaveBeenCalled();
         expect(page.goto).not.toHaveBeenCalled();
     });
 
-    it('throws AuthRequired when captcha gate is detected', async () => {
+    it('throws AuthRequired when no capture arrives behind a captcha gate', async () => {
         const page = createPageMock(['captcha']);
         await expect(cmd.func(page, { from: 'PEK', to: 'SHA', date: '2026-06-15', limit: 5 }))
             .rejects.toThrow('Ctrip is asking for a captcha');
         expect(page.evaluate).toHaveBeenCalledTimes(1);
     });
 
-    it('throws EmptyResultError when DOM extraction returns no flights', async () => {
-        const page = createPageMock(['content', 0, []]);
+    it('throws TimeoutError when no capture arrives without a captcha', async () => {
+        const page = createPageMock(['timeout']);
         await expect(cmd.func(page, { from: 'PEK', to: 'SHA', date: '2026-06-15', limit: 5 }))
-            .rejects.toMatchObject({ code: 'EMPTY_RESULT' });
+            .rejects.toMatchObject({ code: 'TIMEOUT', message: expect.stringContaining('Ctrip flight API capture') });
     });
 
-    it('throws CommandExecutionError when visible cards render but parser finds no flight anchors', async () => {
-        const page = createPageMock(['content', 2, []]);
+    it('throws EmptyResultError only for a completed empty search', async () => {
+        const page 
```

**File**: `clis/ctrip/flight.js` (modified, +165/-75)
```diff
@@ -1,66 +1,154 @@
 /**
  * 携程机票 oneway search — domestic + international flight search by route + date.
  *
- * Unlike `hotel-search`, the flight rows are NOT in `__NEXT_DATA__` — they
- * arrive via a post-load XHR that the daemon network buffer currently can't
- * capture (see MEMORY `daemon_capture_pipeline_bug_2026_05_07`). We instead
- * extract from the rendered `.flight-item` cards, which Ctrip migrated the flight
- * list to and which omit a text flight number, using a position-anchored innerText
- * parser (see `buildFlightExtractJs` in utils).
+ * Flight rows arrive in the page's natural `batchSearch` response. Capture that
+ * response through CDP so Ctrip remains responsible for request parameters,
+ * trace ids, risk controls, and session state; do not reconstruct its request.
  *
  * Round-trip search lives in the sibling `flight-round` command; advanced filters
  * (airline whitelist, cabin selection beyond 全舱位) remain out of scope here.
  */
-import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError, TimeoutError } from '@jackwener/opencli/errors';
 import { cli, Strategy } from '@jackwener/opencli/registry';
-import { buildFlightExtractJs, buildScrollUntilJs, parseIataCode, parseIsoDate, parseStrictIntegerRange } from './utils.js';
+import { parseIataCode, parseIsoDate, parseStrictIntegerRange } from './utils.js';
 
 const MIN_LIMIT = 1;
 const MAX_LIMIT = 50;
 const DEFAULT_LIMIT = 20;
-
-// Ctrip migrated the flight list to `.flight-item` cards (which omit a text flight
-// number), so the command reads those with the flight-number requirement relaxed.
-const FLIGHT_CARD_SELECTOR = '.flight-item';
+const CAPTURE_PATTERN = '/international/search/api/search/batchSearch';
+const CAPTURE_TIMEOUT_SECONDS = 12;
+const WAIT_FOR_BATCH_CAPTURE_JS = `
+  new Promise((resolve) => {
+    const detect = () => {
+      if (location.pathname.includes('captcha') || /验证码|verify the human|安全验证/i.test(document.body?.innerText || '')) return 'captcha';
+      if (document.querySelector('.flight-item')) return 'content';
+      return null;
+    };
+    const found = detect();
+    if (found) return resolve(found);
+    const observer = new MutationObserver(() => {
+      const result = detect();
+      if (result) { observer.disconnect(); resolve(result); }
+    });
+    observer.observe(document.documentElement, { childList: true, subtree: true });
+    setTimeout(() => { observer.disconnect(); resolve('timeout'); }, ${CAPTURE_TIMEOUT_SECONDS * 1000});
+  })
+`;
 
 function parseFlightLimit(raw) {
     return parseStrictIntegerRange('limit', raw, DEFAULT_LIMIT, MIN_LIMIT, MAX_LIMIT);
 }
 
-/**
- * Wait for the flight cards to finish rendering, or detect a captcha/login
- * redirect. The post-load XHR settles 1-3s after navigation and the cards fill in
- * progressively, so this polls the count of cards carrying a time + price and
- * resolves `content` only once that count has held steady, rather than firing on
- * the first card and under-reading the rest.
- */
-const WAIT_FOR_FLIGHTS_JS = `
-  new Promise((resolve) => {
-    const isCaptcha = () => location.pathname.includes('captcha') || /验证码|verify the human/i.test(document.body?.innerText || '');
-    const fullCount = () => [...document.querySelectorAll('.flight-item')]
-      .filter((el) => { const t = el.textContent || ''; return /\\d{1,2}:\\d{2}/.test(t) && /[¥$€£]/.test(t); }).length;
-    let last = -1;
-    let stable = 0;
-    let elapsed = 0;
-    const iv = setInterval(() => {
-      elapsed += 400;
-      if (isCaptcha()) { clearInterval(iv); return resolve('captcha'); }
-      const c = fullCount();
-      if (c > 0 && c === last) {
-        if (++stable >= 2) { clearInterval(iv); return resolve('content'); }
-      } else { last = c; stable = 0; }
-      if (elapsed >= 18000) { clearInterval(iv); return resolve('timeout'); }
-    }, 400);
-  })
-`;
+function cleanString(value) {
+    return typeof value === 'string' ? value.trim() : '';
+}
+
+function timePart(value) {
+    const match = cleanString(value).match(/(?:^|\s)([0-2]\d:[0-5]\d)(?::[0-5]\d)?$/);
+    return match?.[1] || '';
+}
+
+function cabinLabel(value) {
+    const labels = { Y: '经济舱', S: '超级经济舱', C: '公务舱', F: '头等舱' };
+    const codes = [...new Set(cleanString(value).toUpperCase().match(/[YSCF]/g) || [])];
+    return codes.length > 0 ? codes.map((code) => labels[code]).join('/') : (cleanString(value) || null);
+}
+
+function parseBatchSearchCaptures(entries) {
+    if (!Array.isArray(entries)) {
+        throw new CommandExecutionError('Ctrip flight network capture returned malformed entries');
+    }
+    const captured = entries.filter((entry) => String(entry?.url || '').includes(CAPTURE_PATTERN));
+    if (captured.length === 0) return null;
+
+    const byId = new Map();
+    let finished = false;
+    for (const entry of ca
```

---

### Incident Patch 15: `cee47139` (2026-08-24)
**Commit Message**: fix(nowcoder): validate mixed post entities (#2218)

Co-authored-by: jackwener <[REDACTED_EMAIL]>

**File**: `cli-manifest.json` (modified, +39/-14)
```diff
@@ -26539,7 +26539,7 @@
   {
     "site": "nowcoder",
     "name": "detail",
-    "description": "Post detail view (supports ID / UUID / URL)",
+    "description": "Content or moment detail (use an ID or URL returned by search/experience)",
     "access": "read",
     "domain": "www.nowcoder.com",
     "strategy": "cookie",
@@ -26550,12 +26550,19 @@
         "type": "str",
         "required": true,
         "positional": true,
-        "help": "Post ID, UUID, or URL"
+        "help": "Numeric content ID, moment UUID, or canonical URL"
       }
     ],
     "columns": [
+      "post_type",
+      "id",
+      "uuid",
+      "entity_id",
+      "url",
       "title",
       "author",
+      "author_id",
+      "author_url",
       "school",
       "content",
       "likes",
@@ -26567,12 +26574,12 @@
     "type": "js",
     "modulePath": "nowcoder/detail.js",
     "sourceFile": "nowcoder/detail.js",
-    "navigateBefore": "https://www.nowcoder.com"
+    "navigateBefore": false
   },
   {
     "site": "nowcoder",
     "name": "experience",
-    "description": "Interview experience posts",
+    "description": "Interview experience content and moment posts",
     "access": "read",
     "domain": "www.nowcoder.com",
     "strategy": "cookie",
@@ -26583,30 +26590,38 @@
         "type": "int",
         "default": 1,
         "required": false,
-        "help": "Page number"
+        "help": "Page number (1-1000)"
       },
       {
         "name": "limit",
         "type": "int",
         "default": 15,
         "required": false,
-        "help": "Number of items"
+        "help": "Number of posts (1-50)"
       }
     ],
     "columns": [
       "rank",
+      "post_type",
+      "id",
+      "uuid",
+      "entity_id",
+      "url",
       "title",
       "author",
+      "author_id",
+      "author_url",
       "school",
+      "content",
       "likes",
       "comments",
       "views",
-      "id"
+      "time"
     ],
     "type": "js",
     "modulePath": "nowcoder/experience.js",
     "sourceFile": "nowcoder/experience.js",
-    "navigateBefore": "https://www.nowcoder.com"
+    "navigateBefore": false
   },
   {
     "site": "nowcoder",
@@ -26897,7 +26912,7 @@
   {
     "site": "nowcoder",
     "name": "search",
-    "description": "Full-text search",
+    "description": "Search content and moment posts",
     "access": "read",
     "domain": "www.nowcoder.com",
     "strategy": "cookie",
@@ -26913,30 +26928,40 @@
       {
         "name": "type",
         "type": "str",
-        "default": "all",
+        "default": "post",
         "required": false,
-        "help": "Search type (all/post/question/user/job)"
+        "help": "Post search scope (post/all)"
       },
       {
         "name": "limit",
         "type": "int",
         "default": 10,
         "required": false,
-        "help": "Number of results"
+        "help": "Number of posts (1-50)"
       }
     ],
     "columns": [
       "rank",
+      "post_type",
+      "id",
+      "uuid",
+      "entity_id",
+      "url",
       "title",
       "author",
+      "author_id",
+      "author_url",
       "school",
       "content",
-      "id"
+      "likes",
+      "comments",
+      "views",
+      "time"
     ],
     "type": "js",
     "modulePath": "nowcoder/search.js",
     "sourceFile": "nowcoder/search.js",
-    "navigateBefore": "https://www.nowcoder.com"
+    "navigateBefore": false
   },
   {
     "site": "nowcoder",
```

**File**: `clis/nowcoder/detail.js` (modified, +23/-53)
```diff
@@ -1,62 +1,32 @@
-import { cli } from '@jackwener/opencli/registry';
+import { cli, Strategy } from '@jackwener/opencli/registry';
+import {
+    fetchNowcoderData,
+    parseNowcoderPostTarget,
+    projectNowcoderDetail,
+} from './posts.js';
 
 cli({
     site: 'nowcoder',
     name: 'detail',
     access: 'read',
-    description: 'Post detail view (supports ID / UUID / URL)',
+    description: 'Content or moment detail (use an ID or URL returned by search/experience)',
     domain: 'www.nowcoder.com',
+    strategy: Strategy.COOKIE,
+    browser: true,
+    navigateBefore: false,
     args: [
-        { name: 'id', positional: true, required: true, help: 'Post ID, UUID, or URL' },
-    ],
-    columns: ['title', 'author', 'school', 'content', 'likes', 'comments', 'views', 'time', 'location'],
-    pipeline: [
-        { navigate: 'https://www.nowcoder.com' },
-        { evaluate: `(async () => {
-  const raw = \${{ args.id | json }};
-  const base = 'https://gw-c.nowcoder.com';
-  const strip = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
-
-  let id = raw;
-  const urlMatch = raw.match(/discuss\\/(\\d+)/);
-  if (urlMatch) id = urlMatch[1];
-
-  let data = null;
-
-  if (/[a-f]/.test(id) && id.length > 20) {
-    const r = await fetch(base + '/api/sparta/detail/moment-data/detail/' + id, {credentials: 'include'});
-    const d = await r.json();
-    if (d.success && d.data) data = d.data;
-  }
-
-  if (!data && /^\\d+$/.test(id)) {
-    const r = await fetch(base + '/api/sparta/detail/content-data/detail/' + id, {credentials: 'include'});
-    const d = await r.json();
-    if (d.success && d.data) data = d.data;
-  }
-
-  if (!data && /^\\d+$/.test(id)) {
-    const r = await fetch(base + '/api/sparta/detail/moment-data/detail/' + id, {credentials: 'include'});
-    const d = await r.json();
-    if (d.success && d.data) data = d.data;
-  }
-
-  if (!data) throw new Error('Post not found: ' + id);
-
-  const user = data.userBrief || {};
-  const freq = data.frequencyData || {};
-  return [{
-    title: data.title || '(untitled)',
-    author: user.nickname || '',
-    school: user.educationInfo || '',
-    content: strip(data.content || '').substring(0, 500),
-    likes: freq.likeCnt || 0,
-    comments: freq.commentCnt || freq.totalCommentCnt || 0,
-    views: freq.viewCnt || 0,
-    time: data.createdAt ? new Date(data.createdAt).toISOString().slice(0, 19) : '',
-    location: data.ip4Location || '',
-  }];
-})()
-` },
+        { name: 'id', positional: true, required: true, help: 'Numeric content ID, moment UUID, or canonical URL' },
     ],
+    columns: ['post_type', 'id', 'uuid', 'entity_id', 'url', 'title', 'author', 'author_id', 'author_url', 'school', 'content', 'likes', 'comments', 'views', 'time', 'location'],
+    func: async (page, args) => {
+        const target = parseNowcoderPostTarget(args.id);
+        const endpoint = target.post_type === 'content' ? 'content-data' : 'moment-data';
+        const data = await fetchNowcoderData(
+            page,
+            `https://gw-c.nowcoder.com/api/sparta/detail/${endpoint}/detail/${encodeURIComponent(target.value)}`,
+            { timeoutMs: 15_000 },
+            'Nowcoder detail request',
+        );
+        return [projectNowcoderDetail(data, target)];
+    },
 });
```

**File**: `clis/nowcoder/experience.js` (modified, +29/-28)
```diff
@@ -1,37 +1,38 @@
-import { cli } from '@jackwener/opencli/registry';
+import { cli, Strategy } from '@jackwener/opencli/registry';
+import {
+    fetchNowcoderData,
+    projectNowcoderFeed,
+    requirePositiveInt,
+} from './posts.js';
 
 cli({
     site: 'nowcoder',
     name: 'experience',
     access: 'read',
-    description: 'Interview experience posts',
+    description: 'Interview experience content and moment posts',
     domain: 'www.nowcoder.com',
+    strategy: Strategy.COOKIE,
+    browser: true,
+    navigateBefore: false,
     args: [
-        { name: 'page', type: 'int', default: 1, help: 'Page number' },
-        { name: 'limit', type: 'int', default: 15, help: 'Number of items' },
-    ],
-    columns: ['rank', 'title', 'author', 'school', 'likes', 'comments', 'views', 'id'],
-    pipeline: [
-        { navigate: 'https://www.nowcoder.com' },
-        { evaluate: `(async () => {
-  const page = \${{ args.page }};
-  const limit = \${{ args.limit }};
-  const r = await fetch('https://gw-c.nowcoder.com/api/sparta/home/tab/content?tabId=818&categoryType=1&pageNo=' + page + '&pageSize=' + limit, {credentials: 'include'});
-  const d = await r.json();
-  if (!d.success) throw new Error(d.msg || 'API failed');
-  return (d.data?.records || []).map((item, i) => ({
-    rank: i + 1,
-    title: item.contentData?.title || '',
-    author: item.userBrief?.nickname || '',
-    school: item.userBrief?.educationInfo || '',
-    likes: item.frequencyData?.likeCnt || 0,
-    comments: item.frequencyData?.commentCnt || 0,
-    views: item.frequencyData?.viewCnt || 0,
-    id: item.contentData?.uuid || item.contentData?.id || item.contentId || '',
-  }));
-})()
-` },
-        { filter: 'item.title' },
-        { limit: '${{ args.limit }}' },
+        { name: 'page', type: 'int', default: 1, help: 'Page number (1-1000)' },
+        { name: 'limit', type: 'int', default: 15, help: 'Number of posts (1-50)' },
     ],
+    columns: ['rank', 'post_type', 'id', 'uuid', 'entity_id', 'url', 'title', 'author', 'author_id', 'author_url', 'school', 'content', 'likes', 'comments', 'views', 'time'],
+    func: async (page, args) => {
+        const pageNumber = requirePositiveInt(args.page ?? 1, 'page', 1000);
+        const limit = requirePositiveInt(args.limit ?? 15, 'limit', 50);
+        const url = new URL('https://gw-c.nowcoder.com/api/sparta/home/tab/content');
+        url.searchParams.set('tabId', '818');
+        url.searchParams.set('categoryType', '1');
+        url.searchParams.set('pageNo', String(pageNumber));
+        url.searchParams.set('pageSize', String(limit));
+        const data = await fetchNowcoderData(
+            page,
+            url.toString(),
+            { timeoutMs: 15_000 },
+            'Nowcoder experience request',
+        );
+        return projectNowcoderFeed(data.records, limit, 'experience');
+    },
 });
```

**File**: `clis/nowcoder/posts.js` (added, +261/-0)
```diff
@@ -0,0 +1,261 @@
+import {
+    ArgumentError,
+    AuthRequiredError,
+    CommandExecutionError,
+    EmptyResultError,
+} from '@jackwener/opencli/errors';
+
+const CONTENT_FEED_TYPE = 250;
+const CONTENT_ENTITY_TYPE = 8;
+const MOMENT_TYPE = 74;
+const UUID_PATTERN = /^[0-9a-f]{32}$/i;
+const NUMERIC_ID_PATTERN = /^[1-9]\d*$/;
+const NAMED_ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
+
+function isRecord(value) {
+    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
+}
+
+function requiredId(value, label) {
+    const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
+    if (typeof id !== 'string' || !NUMERIC_ID_PATTERN.test(id)) throw new CommandExecutionError(`Nowcoder returned a malformed ${label}`);
+    return id;
+}
+
+function requiredUuid(value, label) {
+    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new CommandExecutionError(`Nowcoder returned a malformed ${label}`);
+    return value.toLowerCase();
+}
+
+function optionalText(value, label) {
+    if (value == null) return '';
+    if (typeof value !== 'string') throw new CommandExecutionError(`Nowcoder returned a malformed ${label}`);
+    return value.trim();
+}
+
+function decodeEntities(value) {
+    return value.replace(/&(#x[0-9a-f]+|#\d+|nbsp|amp|lt|gt|quot|apos);/gi, (match, entity) => {
+        const normalized = entity.toLowerCase();
+        if (NAMED_ENTITIES[normalized] != null) return NAMED_ENTITIES[normalized];
+        const radix = normalized.startsWith('#x') ? 16 : 10;
+        const codePoint = Number.parseInt(normalized.slice(radix === 16 ? 2 : 1), radix);
+        return Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
+            ? String.fromCodePoint(codePoint)
+            : match;
+    });
+}
+
+function cleanBody(html, label) {
+    if (typeof html !== 'string') throw new CommandExecutionError(`Nowcoder returned a malformed ${label}`);
+    const withoutUnsafe = html.replace(/<\s*(?:script|style)\b[^>]*>[\s\S]*?<\s*\/\s*(?:script|style)\s*>/gi, '');
+    const preBlocks = [];
+    const protectedHtml = withoutUnsafe.replace(/<\s*pre\b[^>]*>([\s\S]*?)<\s*\/\s*pre\s*>/gi, (_match, body) => {
+        let token = `\u0000NOWCODER_PRE_${preBlocks.length}\u0000`;
+        while (withoutUnsafe.includes(token)) token += '_';
+        const text = decodeEntities(body
+            .replace(/<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_image, doubleQuoted, singleQuoted) => `\n${doubleQuoted ?? singleQuoted ?? ''}\n`)
+            .replace(/<\s*br\s*\/?>/gi, '\n')
+            .replace(/<[^>]+>/g, ''))
+            .replace(/\r\n?/g, '\n')
+            .split('\n')
+            .map((line) => line.replace(/[\t ]+$/g, ''))
+            .join('\n')
+            .replace(/^\n+|\n+$/g, '');
+        preBlocks.push({ token, text });
+        return `\n${token}\n`;
+    });
+    let text = decodeEntities(protectedHtml
+        .replace(/<img\b[^>]*\balt\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>/gi, (_match, doubleQuoted, singleQuoted) => `\n${doubleQuoted ?? singleQuoted ?? ''}\n`)
+        .replace(/<\s*br\s*\/?>/gi, '\n')
+        .replace(/<\s*li\b[^>]*>/gi, '\n- ')
+        .replace(/<\s*\/\s*(?:p|div|li|ol|ul|pre|blockquote|h[1-6]|tr)\s*>/gi, '\n')
+        .replace(/<\s*(?:p|div|ol|ul|pre|blockquote|h[1-6]|tr)\b[^>]*>/gi, '\n')
+        .replace(/<\s*\/\s*(?:td|th)\s*>/gi, '\t')
+        .replace(/<[^>]+>/g, ''))
+        .replace(/\r\n?/g, '\n')
+        .split('\n')
+        .map((line) => line.replace(/[\t ]+/g, ' ').trim())
+        .join('\n')
+        .replace(/^\s+|\s+$/g, '')
+        .replace(/\n{3,}/g, '\n\n');
+    for (const block of preBlocks) text = text.replace(block.token, block.text);
+    return text;
+}
+
+function isoTime(value, label) {
+    if (!Number.isSafeInteger(value) || value <= 0) throw new CommandExecutionError(`Nowcoder returned a malformed ${label}`);
+    const date = new Date(value);
+    if (Number.isNaN(date.getTime())) throw new CommandExecutionError(`Nowcoder returned a malformed ${label}`);
+    return date.toISOString();
+}
+
+function metric(frequency, key) {
+    const value = frequency[key];
+    if (!Number.isSafeInteger(value) || value < 0) throw new CommandExecutionError(`Nowcoder returned a malformed frequencyData.${key}`);
+    return value;
+}
+
+function authorFields(userBrief, expectedId, label) {
+    if (!isRecord(userBrief)) throw new CommandExecutionError(`Nowcoder returned malformed ${label} authorship`);
+    const authorId = requiredId(userBrief.userId, `${label} userBrief.userId`);
+    if (authorId !== requiredId(expectedId, `${label} author id`)) throw new CommandExecutionError(`Nowcoder returned mismatched ${label} authorship`);
+    return {
+        author: optionalText(userBrief.nickname, `${label} author nickname`),
+        author_id: authorId,
+        author_url: `https://www.nowcoder.com/users/${authorId}`,
```

**File**: `clis/nowcoder/posts.test.js` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+import { readFileSync } from 'node:fs';
+import { describe, expect, it, vi } from 'vitest';
+import { getRegistry } from '@jackwener/opencli/registry';
+import { ArgumentError, AuthRequiredError, CommandExecutionError, EmptyResultError } from '@jackwener/opencli/errors';
+import './detail.js';
+import './experience.js';
+import './search.js';
+
+const detail = getRegistry().get('nowcoder/detail');
+const experience = getRegistry().get('nowcoder/experience');
+const search = getRegistry().get('nowcoder/search');
+const CONTENT_ID = '912885704667987968';
+const CONTENT_UUID = '162ac6f4410646009f97bf18012870c3';
+const MOMENT_ID = '2882961';
+const MOMENT_UUID = '24e01f1d510a486b92efa795b4835669';
+
+function pageWith(data, envelope = {}) {
+    return {
+        goto: vi.fn().mockResolvedValue(undefined),
+        fetchJson: vi.fn().mockResolvedValue({ success: true, code: 0, msg: 'OK', data, ...envelope }),
+    };
+}
+
+function feed(kind, includeOuterId = true) {
+    const content = kind === 'content';
+    const id = content ? CONTENT_ID : MOMENT_ID;
+    const post = content ? {
+        id, uuid: CONTENT_UUID, authorId: '646661816', entityId: 1662830, entityType: 8,
+        title: '长文章', content: '<p>内容摘要 &amp; 题解</p>', createTime: Date.parse('2026-08-01T12:00:00+08:00'),
+    } : {
+        id: Number(id), uuid: MOMENT_UUID, userId: 125006155,
+        title: '一面记录', content: '动态正文', createdAt: Date.parse('2026-08-01T20:00:00+08:00'),
+    };
+    return {
+        ...(includeOuterId ? { contentId: id } : {}),
+        contentType: content ? 250 : 74,
+        userBrief: content
+            ? { userId: 646661816, nickname: '内容作者', educationInfo: '示例大学' }
+            : { userId: 125006155, nickname: '动态作者', educationInfo: null },
+        contentData: content ? post : null,
+        momentData: content ? null : post,
+        frequencyData: { likeCnt: content ? 4 : 1, commentCnt: 3, viewCnt: content ? 20 : 5 },
+    };
+}
+
+function detailData(kind) {
+    const content = kind === 'content';
+    return {
+        id: content ? CONTENT_ID : Number(MOMENT_ID),
+        uuid: content ? CONTENT_UUID : MOMENT_UUID,
+        entityId: content ? 1662830 : Number(MOMENT_ID),
+        entityType: content ? 8 : 74,
+        ...(content ? { authorId: 646661816 } : { userId: 125006155 }),
+        title: content ? '长面经' : '一面记录',
+        content: content ? '不应读取的备用字段' : '动态正文',
+        richText: content
+            ? '<h2>步骤</h2>\n  <ol>\n    <li>第一项<br>续行</li>\n    <li><pre>  x &lt; y\n    z</pre></li>\n  </ol>\n  <img alt="流程图"><script>leak</script>'
+            : '不应读取',
+        ...(content
+            ? { createTime: Date.parse('2026-08-01T12:00:00+08:00') }
+            : { createdAt: Date.parse('2026-08-01T20:00:00+08:00') }),
+        userBrief: content
+            ? { userId: 646661816, nickname: '内容作者', educationInfo: '示例大学' }
+            : { userId: 125006155, nickname: '动态作者', educationInfo: null },
+        frequencyData: { likeCnt: 4, commentCnt: 3, viewCnt: 20 },
+        ip4Location: content ? '上海' : '广东',
+    };
+}
+
+describe('Nowcoder mixed post entity contract', () => {
+    it('keeps mixed search/experience order with exact identity, route, author, and timestamp mappings', async () => {
+        const searchPage = pageWith({ records: [feed('content', false), feed('moment', false)] });
+        const rows = await search.func(searchPage, { query: '面试', type: 'post', limit: 2 });
+        expect(rows).toMatchObject([
+            { rank: 1, post_type: 'content', id: CONTENT_ID, uuid: CONTENT_UUID, entity_id: '1662830', url: `https://www.nowcoder.com/discuss/${CONTENT_ID}`, author_id: '646661816', content: '内容摘要 & 题解', time: '2026-08-01T04:00:00.000Z' },
+            { rank: 2, post_type: 'moment', id: MOMENT_UUID, uuid: MOMENT_UUID, entity_id: MOMENT_ID, url: `https://www.nowcoder.com/feed/main/detail/${MOMENT_UUID}`, author_id: '125006155', time: '2026-08-01T12:00:00.000Z' },
+        ]);
+        expect(searchPage.fetchJson).toHaveBeenCalledWith(expect.stringContaining('/pc/search'), expect.objectContaining({ body: { query: '面试', type: 'post', page: 1, pageSize: 2 } }));
+        expect(searchPage.goto).toHaveBeenCalledTimes(1);
+
+        const experiencePage = pageWith({ records: [feed('moment'), feed('content')] });
+        const experienceRows = await experience.func(experiencePage, { page: 3, limit: 2 });
+        expect(experienceRows.map(({ post_type, id, rank }) => ({ post_type, id, rank }))).toEqual([
+            { post_type: 'moment', id: MOMENT_UUID, rank: 1 },
+            { post_type: 'content', id: CONTENT_ID, rank: 2 },
+        ]);
+        expect(experiencePage.fetchJson.mock.calls[0][0]).toContain('pageNo=3');
+        expect(experiencePage.goto).toHaveBeenCalledTimes(1);
+    });
+
+    it('routes each detail type directly and cleans only its source-specific complete body field', async () => {
+        const contentPage = pageWith(detailData(
```

**File**: `clis/nowcoder/search.js` (modified, +30/-40)
```diff
@@ -1,50 +1,40 @@
-import { cli } from '@jackwener/opencli/registry';
+import { cli, Strategy } from '@jackwener/opencli/registry';
+import { ArgumentError } from '@jackwener/opencli/errors';
+import {
+    fetchNowcoderData,
+    projectNowcoderFeed,
+    requirePositiveInt,
+} from './posts.js';
 
 cli({
     site: 'nowcoder',
     name: 'search',
     access: 'read',
-    description: 'Full-text search',
+    description: 'Search content and moment posts',
     domain: 'www.nowcoder.com',
+    strategy: Strategy.COOKIE,
+    browser: true,
+    navigateBefore: false,
     args: [
         { name: 'query', positional: true, required: true, help: 'Search keyword' },
-        { name: 'type', type: 'str', default: 'all', help: 'Search type (all/post/question/user/job)' },
-        { name: 'limit', type: 'int', default: 10, help: 'Number of results' },
-    ],
-    columns: ['rank', 'title', 'author', 'school', 'content', 'id'],
-    pipeline: [
-        { navigate: 'https://www.nowcoder.com' },
-        { evaluate: `(async () => {
-  const query = \${{ args.query | json }};
-  const type = \${{ args.type | json }};
-  const limit = \${{ args.limit }};
-  const strip = (html) => (html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
-  const r = await fetch('https://gw-c.nowcoder.com/api/sparta/pc/search', {
-    method: 'POST',
-    credentials: 'include',
-    headers: {'Content-Type': 'application/json'},
-    body: JSON.stringify({query, type, page: 1, pageSize: limit})
-  });
-  const d = await r.json();
-  if (!d.success) throw new Error(d.msg || 'search failed');
-  return (d.data?.records || []).map((item, i) => {
-    const data = item.data || {};
-    const moment = data.momentData || {};
-    const contentData = data.contentData || {};
-    const user = data.userBrief || {};
-    const uuid = moment.uuid || contentData.uuid || '';
-    const id = data.contentId || '';
-    return {
-      rank: i + 1,
-      title: moment.title || contentData.title || user.nickname || '',
-      author: user.nickname || '',
-      school: user.educationInfo || '',
-      content: strip(moment.content || contentData.content || ''),
-      id: uuid || id,
-    };
-  }).filter(r => r.title);
-})()
-` },
-        { limit: '${{ args.limit }}' },
+        { name: 'type', type: 'str', default: 'post', help: 'Post search scope (post/all)' },
+        { name: 'limit', type: 'int', default: 10, help: 'Number of posts (1-50)' },
     ],
+    columns: ['rank', 'post_type', 'id', 'uuid', 'entity_id', 'url', 'title', 'author', 'author_id', 'author_url', 'school', 'content', 'likes', 'comments', 'views', 'time'],
+    func: async (page, args) => {
+        const query = typeof args.query === 'string' ? args.query.trim() : '';
+        if (!query) throw new ArgumentError('nowcoder search requires a non-empty query');
+        const type = args.type ?? 'post';
+        if (type !== 'all' && type !== 'post') {
+            throw new ArgumentError('nowcoder search --type must be all or post');
+        }
+        const limit = requirePositiveInt(args.limit ?? 10, 'limit', 50);
+        const data = await fetchNowcoderData(
+            page,
+            'https://gw-c.nowcoder.com/api/sparta/pc/search',
+            { method: 'POST', body: { query, type, page: 1, pageSize: limit }, timeoutMs: 15_000 },
+            'Nowcoder search request',
+        );
+        return projectNowcoderFeed(data.records, limit, 'search', type === 'all');
+    },
 });
```

**File**: `docs/adapters/browser/nowcoder.md` (modified, +13/-4)
```diff
@@ -13,15 +13,15 @@
 | `opencli nowcoder creators` | Top content creators leaderboard |
 | `opencli nowcoder companies` | Hot companies for interview prep |
 | `opencli nowcoder jobs` | Career category listing |
-| `opencli nowcoder search <query>` | Full-text search (type: all/post/question/user/job) |
+| `opencli nowcoder search <query>` | Search content and moment posts (type: post/all; default: post) |
 | `opencli nowcoder suggest <query>` | Search suggestions |
 | `opencli nowcoder experience` | Interview experience posts |
 | `opencli nowcoder referral` | Internal referral posts |
 | `opencli nowcoder salary` | Salary disclosure posts |
 | `opencli nowcoder papers` | Interview question bank by company & job |
 | `opencli nowcoder practice` | Categorized practice questions with progress |
 | `opencli nowcoder notifications` | Unread message summary |
-| `opencli nowcoder detail <id>` | Post detail view (supports ID / UUID / URL) |
+| `opencli nowcoder detail <id>` | Content or moment detail (numeric ID, UUID, or canonical URL) |
 
 ## Usage Examples
 
@@ -38,8 +38,8 @@ opencli nowcoder suggest "java"
 # Browse interview experience posts
 opencli nowcoder experience --limit 10
 
-# View a specific post detail (using UUID from list commands)
-opencli nowcoder detail 2b6b64d4adb34ea3838e832ae4447ab1
+# View a specific post detail (use the ID or URL returned by list commands)
+opencli nowcoder detail 912885704667987968
 
 # Interview question bank for Java at Huawei
 opencli nowcoder papers --job 11002 --company 239
@@ -61,3 +61,12 @@ opencli nowcoder hot -v
 
 - **Public commands** (hot, trending, topics, recommend, creators, companies, jobs): No login required
 - **Cookie commands** (all others): Chrome running and **logged into** nowcoder.com, [Browser Bridge extension](/guide/browser-bridge) installed
+
+## Post identity
+
+Nowcoder post feeds contain two distinct entities. `search` and `experience` identify them from the service's `contentType` discriminator and return `post_type`, a round-trippable `id`, `uuid`, `entity_id`, canonical `url`, stable author fields, and the entity's creation time.
+
+- `content` uses a numeric `id`, `/discuss/<id>`, the content-data detail endpoint, and `createTime`.
+- `moment` uses its 32-character UUID as `id`, `/feed/main/detail/<uuid>`, the moment-data detail endpoint, and `createdAt`.
+
+Pass the returned `id` or `url` to `nowcoder detail`. A content UUID is metadata and is not a valid `/discuss/` identifier; a moment's numeric `entity_id` is not accepted by the moment detail endpoint.
```

#### Recent Merged Pull Requests:
- **PR #2561** (closed): fix(claude): read identity from /api/account instead of the analytics cookie (@crimsonsunset)
- **PR #2539** (2026-09-24): Remove site sitemaps and external CLI hub (@jackwener)
- **PR #2516** (closed): fix(xiaohongshu): recover detail-page reads from bridge Navigation rejected races (@davidxifeng)
- **PR #2502** (closed): fix(cli): reject unknown -f/--format values (@lorenzozanee)
- **PR #2501** (closed): fix(browser): retry navigate once on Navigation rejected (Chromium 152+) (@lorenzozanee)
- **PR #2500** (closed): fix(browser): remove owned tab directly on explicit close-window (@lorenzozanee)
- **PR #2499** (closed): fix(browser): keep debugger attached across navigate on Chromium 152+ (@lorenzozanee)
- **PR #2498** (closed): fix(browser): surface WSL guidance in doctor when extension is disconnected (@lorenzozanee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
