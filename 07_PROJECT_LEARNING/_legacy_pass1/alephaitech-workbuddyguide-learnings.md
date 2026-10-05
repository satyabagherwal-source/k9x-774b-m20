# Forensic Learning Record (Deep Inspection): AlephAITech/WorkBuddyGuide

> **Canonical Artifact**: `07_PROJECT_LEARNING/alephaitech-workbuddyguide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AlephAITech/WorkBuddyGuide](https://github.com/AlephAITech/WorkBuddyGuide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:14:08.166Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AlephAITech/WorkBuddyGuide`
- **Description**: A practical, open-source guide to mastering WorkBuddy through real-world workflows.开源的 WorkBuddy 实战蓝皮书：教程、真实工作流、Skills、MCP、自动化与多智能体实践。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3271 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `functions/api/internal/traffic-sync.ts`
```
import {
  syncTrafficArchive,
  type TrafficArchiveEnv,
} from "../../lib/traffic-archive";

interface Env extends TrafficArchiveEnv {
  TRAFFIC_SYNC_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (
    !context.env.TRAFFIC_SYNC_TOKEN ||
    context.request.headers.get("Authorization") !==
      `Bearer ${context.env.TRAFFIC_SYNC_TOKEN}`
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await syncTrafficArchive(context.env);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("Traffic archive sync failed", error);
    return json({ error: "Traffic archive sync failed" }, 502);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  return onRequestPost(context);
};

```

### Core Architecture Module: `functions/api/traffic.ts`
```
import {
  type AnalyticsEnv,
  type LiveTraffic,
  normalizeLiveTraffic,
  queryLiveTraffic,
} from "../lib/cloudflare-analytics";
import {
  type ArchiveTotals,
  type D1Database,
  formatShanghaiDate,
  getShanghaiDayStart,
  readArchiveTotals,
} from "../lib/traffic-archive";

interface Env extends AnalyticsEnv {
  TRAFFIC_DB: D1Database;
}

const PUBLIC_HOSTS = [
  "workbuddy-guide.pages.dev",
  "workbuddy.homes",
  "www.workbuddy.homes",
];

function json(body: unknown, status = 200, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache
        ? "public, s-maxage=300, stale-while-revalidate=600"
        : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function buildTrafficResponse(
  live: LiveTraffic,
  archive: ArchiveTotals,
  now: Date,
) {
  return {
    ...live,
    totalVisits: archive.visits + live.todayVisits,
    totalPageViews: archive.pageViews + live.todayPageViews,
    totalSince: archive.sinceDate,
    archivedThrough: archive.archivedThrough,
    updatedAt: now.toISOString(),
    archiveUpdatedAt: archive.updatedAt,
    timezone: "Asia/Shanghai",
    source: "cloudflare-rum+d1",
    stale: false,
    hosts: PUBLIC_HOSTS,
  };
}

export { getShanghaiDayStart, normalizeLiveTraffic };

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return json({ error: "Method not allowed" }, 405);
  }

  const now = new Date();
  const todayStart = getShanghaiDayStart(now);

  try {
    const [live, archive] = await Promise.all([
      queryLiveTraffic(context.env, todayStart, now),
      readArchiveTotals(context.env.TRAFFIC_DB, formatShanghaiDate(todayStart)),
    ]);
    const traffic = buildTrafficResponse(live, archive, now);

    return context.request.method === "HEAD"
      ? new Response(null, {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            "Content-Type": "application/json; charset=utf-8",
          },
        })
      : json(traffic, 200, true);
  } catch (error) {
    console.error("Unable to load public traffic metrics", error);
    return json({ error: "Traffic metrics are temporarily unavailable" }, 502);
  }
};

```

### Core Architecture Module: `functions/lib/cloudflare-analytics.ts`
```
export interface AnalyticsEnv {
  CF_ANALYTICS_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_WEB_ANALYTICS_SITE_TAG?: string;
  CF_ANALYTICS_MOCK?: string;
}

interface GraphQlGroup {
  count?: number;
  sum?: { visits?: number };
  avg?: { sampleInterval?: number };
}

interface GraphQlResponse {
  data?: {
    viewer?: {
      accounts?: Array<Record<string, GraphQlGroup[] | undefined>>;
    };
  };
  errors?: Array<{ message?: string }> | null;
}

export interface TrafficWindow {
  visits: number;
  pageViews: number;
  sampleInterval: number | null;
}

export interface LiveTraffic {
  todayVisits: number;
  todayPageViews: number;
  last24hVisits: number;
  last24hPageViews: number;
}

const CLOUDFLARE_GRAPHQL_ENDPOINT =
  "https://api.cloudflare.com/client/v4/graphql";

const LIVE_QUERY = `
  query PublicTraffic(
    $accountTag: string!
    $todayFilter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!
    $last24hFilter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        todayVisits: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: $todayFilter
        ) {
          count
          sum { visits }
          avg { sampleInterval }
        }
        last24hVisits: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: $last24hFilter
        ) {
          count
          sum { visits }
          avg { sampleInterval }
        }
      }
    }
  }
`;

const WINDOW_QUERY = `
  query TrafficWindow(
    $accountTag: string!
    $windowFilter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!
  ) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        window: rumPageloadEventsAdaptiveGroups(
          limit: 1
          filter: $windowFilter
        ) {
          count
          sum { visits }
          avg { sampleInterval }
        }
      }
    }
  }
`;

function analyticsFilter(siteTag: string, from: Date, to: Date) {
  return {
    siteTag,
    datetime_geq: from.toISOString(),
    datetime_lt: to.toISOString(),
  };
}

function visits(groups: GraphQlGroup[] = []): number {
  return Math.round(
    groups.reduce((total, group) => total + (group.sum?.visits ?? 0), 0),
  );
}

function pageViews(groups: GraphQlGroup[] = []): number {
  return Math.round(
    groups.reduce((total, group) => total + (group.count ?? 0), 0),
  );
}

function sampleInterval(groups: GraphQlGroup[] = []): number | null {
  if (!groups.length) return null;
  const total = groups.reduce(
    (sum, group) => sum + (group.avg?.sampleInterval ?? 0),
    0,
  );
  return total > 0 ? total / groups.length : null;
}

function getAccount(payload: GraphQlResponse) {
  if (payload.errors?.length) {
    throw new Error(
      payload.errors[0]?.message || "Cloudflare Analytics query failed",
    );
  }

  const account = payload.data?.viewer?.accounts?.[0];
  if (!account) {
    throw new Error("Cloudflare Web Analytics returned no account data");
  }

  return account;
}

async function queryCloudflare(
  env: AnalyticsEnv,
  query: string,
  variables: Record<string, unknown>,
): Promise<GraphQlResponse> {
  if (
    !env.CF_ANALYTICS_TOKEN ||
    !env.CF_ACCOUNT_ID ||
    !env.CF_WEB_ANALYTICS_SITE_TAG
  ) {
    throw new Error("Cloudflare Web Analytics credentials are not configured");
  }

  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare Analytics returned HTTP ${response.status}`);
  }

  return (await response.json()) as GraphQlResponse;
}

export function normalizeLiveTraffic(payload: GraphQlResponse): LiveTraffic {
  const account = getAccount(payload);

  return {
    todayVisits: visits(account.todayVisits),
    todayPageViews: pageViews(account.todayVisits),
    last24hVisits: visits(account.last24hVisits),
    last24hPageViews: pageViews(account.last24hVisits),
  };
}

export async function queryLiveTraffic(
  env: AnalyticsEnv,
  todayStart: Date,
  now: Date,
): Promise<LiveTraffic> {
  if (env.CF_ANALYTICS_MOCK) {
    return normalizeLiveTraffic(
      JSON.parse(env.CF_ANALYTICS_MOCK) as GraphQlResponse,
    );
  }

  const payload = await queryCloudflare(env, LIVE_QUERY, {
    accountTag: env.CF_ACCOUNT_ID,
    todayFilter: analyticsFilter(
      env.CF_WEB_ANALYTICS_SITE_TAG as string,
      todayStart,
      now,
    ),
    last24hFilter: analyticsFilter(
      env.CF_WEB_ANALYTICS_SITE_TAG as string,
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
      now,
    ),
  });

  return normalizeLiveTraffic(payload);
}

export async function queryTrafficWindow(
  env: AnalyticsEnv,
  from: Date,
  to: Date,
): Promise<TrafficWindow> {
  const payload = await queryCloudflare(env, WINDOW_QUERY, {
    accountTag: env.CF_ACCOUNT_ID,
    windowFilter: analyticsFilter(
      env.CF_WEB_ANALYTICS_SITE_TAG as string,
      from,
      to,
    ),
  });
  const groups = getAccount(payload).window;

  return {
    visits: visits(groups),
    pageViews: pageViews(groups),
    sampleInterval: sampleInterval(groups),
  };
}

```

### Core Architecture Module: `functions/lib/traffic-archive.ts`
```
import {
  type AnalyticsEnv,
  queryTrafficWindow,
  type TrafficWindow,
} from "./cloudflare-analytics";

export interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<Array<D1Result<T>>>;
}

export interface TrafficArchiveEnv extends AnalyticsEnv {
  TRAFFIC_DB: D1Database;
  TRAFFIC_HISTORY_START?: string;
}

export interface ArchiveTotals {
  visits: number;
  pageViews: number;
  sinceDate: string;
  throughDate: string;
  archivedThrough: string;
  updatedAt: string;
}

interface BaselineRow {
  since_date: string;
  through_date: string;
  visits: number;
  page_views: number;
  created_at: string;
}

interface TotalsRow {
  since_date: string;
  through_date: string;
  visits: number;
  page_views: number;
  archived_through: string | null;
  updated_at: string;
}

interface LatestDailyRow {
  max_date: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const RECENT_DAYS_TO_REFRESH = 7;
const MAX_ANALYTICS_WINDOW_DAYS = 92;

export function getShanghaiDayStart(now: Date): Date {
  const chinaNow = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  return new Date(
    Date.UTC(
      chinaNow.getUTCFullYear(),
      chinaNow.getUTCMonth(),
      chinaNow.getUTCDate(),
    ) - SHANGHAI_OFFSET_MS,
  );
}

export function formatShanghaiDate(date: Date): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function shanghaiDateStart(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid Asia/Shanghai date: ${date}`);
  }
  return new Date(`${date}T00:00:00+08:00`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function laterDate(first: Date, second: Date): Date {
  return first.getTime() > second.getTime() ? first : second;
}

export async function readArchiveTotals(
  db: D1Database,
  todayDate: string,
): Promise<ArchiveTotals> {
  const row = await db
    .prepare(
      `SELECT
        b.since_date,
        b.through_date,
        b.visits + COALESCE(SUM(d.visits), 0) AS visits,
        b.page_views + COALESCE(SUM(d.page_views), 0) AS page_views,
        MAX(d.date) AS archived_through,
        COALESCE(MAX(d.synced_at), b.created_at) AS updated_at
      FROM traffic_baseline b
      LEFT JOIN traffic_daily d
        ON d.date >= b.through_date AND d.date < ?1
      WHERE b.id = 1
      GROUP BY
        b.since_date,
        b.through_date,
        b.visits,
        b.page_views,
        b.created_at`,
    )
    .bind(todayDate)
    .first<TotalsRow>();

  if (!row) {
    throw new Error("Traffic history has not been initialized in D1");
  }

  return {
    visits: Number(row.visits),
    pageViews: Number(row.page_views),
    sinceDate: row.since_date,
    throughDate: row.through_date,
    archivedThrough:
      row.archived_through ??
      formatShanghaiDate(addDays(shanghaiDateStart(row.through_date), -1)),
    updatedAt: row.updated_at,
  };
}

async function sumWindows(
  env: TrafficArchiveEnv,
  from: Date,
  to: Date,
  loadWindow: typeof queryTrafficWindow,
): Promise<TrafficWindow> {
  let cursor = from;
  let totalVisits = 0;
  let totalPageViews = 0;
  let weightedSampleInterval = 0;
  let sampleWeight = 0;

  while (cursor < to) {
    const windowEnd = new Date(
      Math.min(
        to.getTime(),
        addDays(cursor, MAX_ANALYTICS_WINDOW_DAYS).getTime(),
      ),
    );
    const metrics = await loadWindow(env, cursor, windowEnd);
    totalVisits += metrics.visits;
    totalPageViews += metrics.pageViews;
    if (metrics.sampleInterval !== null) {
      weightedSampleInterval += metrics.sampleInterval * metrics.pageViews;
      sampleWeight += metrics.pageViews;
    }
    cursor = windowEnd;
  }

  return {
    visits: totalVisits,
    pageViews: totalPageViews,
    sampleInterval:
      sampleWeight > 0 ? weightedSampleInterval / sampleWeight : null,
  };
}

async function ensureBaseline(
  env: TrafficArchiveEnv,
  todayStart: Date,
  now: Date,
  loadWindow: typeof queryTrafficWindow,
): Promise<BaselineRow> {
  const existing = await env.TRAFFIC_DB.prepare(
    `SELECT since_date, through_date, visits, page_views, created_at
     FROM traffic_baseline WHERE id = 1`,
  ).first<BaselineRow>();
  if (existing) return existing;

  const sinceDate = env.TRAFFIC_HISTORY_START ?? "2026-07-10";
  const since = shanghaiDateStart(sinceDate);
  const refreshStart = addDays(todayStart, -RECENT_DAYS_TO_REFRESH);
  const through = laterDate(since, refreshStart);
  const baseline = await sumWindows(env, since, through, loadWindow);

  await env.TRAFFIC_DB.prepare(
    `INSERT INTO traffic_baseline (
       id, since_date, through_date, visits, page_views, source, created_at
     ) VALUES (1, ?1, ?2, ?3, ?4, 'cloudflare-rum', ?5)`,
  )
    .bind(
      sinceDate,
      formatShanghaiDate(through),
      baseline.visits,
      baseline.pageViews,
      now.toISOString(),
    )
    .run();

  return {
    since_date: sinceDate,
    through_date: formatShanghaiDate(through),
    visits: baseline.visits,
    page_views: baseline.pageViews,
    created_at: now.toISOString(),
  };
}

export interface ArchiveSyncResult {
  baselineCreated: boolean;
  syncedDates: string[];
  finalizedBefore: string;
}

export async function syncTrafficArchive(
  env: TrafficArchiveEnv,
  now = new Date(),
  loadWindow: typeof queryTrafficWindow = queryTrafficWindow,
): Promise<ArchiveSyncResult> {
  const todayStart = getShanghaiDayStart(now);
  const previousBaseline = await env.TRAFFIC_DB.prepare(
    "SELECT since_date FROM traffic_baseline WHERE id = 1",
  ).first<{ since_date: string }>();
  const baseline = await ensureBaseline(env, todayStart, now, loadWindow);
  const latestDaily = await env.TRAFFIC_DB.prepare(
    "SELECT MAX(date) AS max_date FROM traffic_daily",
  ).first<LatestDailyRow>();
  const recentRefreshStart = addDays(todayStart, -RECENT_DAYS_TO_REFRESH);
  const firstMissingDay = latestDaily?.max_date
    ? addDays(shanghaiDateStart(latestDaily.max_date), 1)
    : shanghaiDateStart(baseline.through_date);
  const refreshOrGapStart =
    firstMissingDay < recentRefreshStart ? firstMissingDay : recentRefreshStart;
  const refreshStart = laterDate(
    shanghaiDateStart(baseline.through_date),
    refreshOrGapStart,
  );
  const statements: D1PreparedStatement[] = [];
  const syncedDates: string[] = [];

  for (let day = refreshStart; day < todayStart; day = addDays(day, 1)) {
    const date = formatShanghaiDate(day);
    const metrics = await loadWindow(env, day, addDays(day, 1));
    syncedDates.push(date);
    statements.push(
      env.TRAFFIC_DB.prepare(
        `INSERT INTO traffic_daily (
           date, visits, page_views, status, sample_interval, synced_at
         ) VALUES (?1, ?2, ?3, 'provisional', ?4, ?5)
         ON CONFLICT(date) DO UPDATE SET
           visits = excluded.visits,
           page_views = excluded.page_views,
           status = excluded.status,
           sample_interval = excluded.sample_interval,
           synced_at = excluded.synced_at`,
      ).bind(
        date,
        metrics.visits,
        metrics.pageViews,
        metrics.sampleInterval,
        now.toISOString(),
      ),
    );
  }

  const finalizedBefore = formatShanghaiDate(recentRefreshStart);
  statements.push(
    env.TRAFFIC_DB.prepare(
      `UPDATE traffic_daily
       SET status = 'final'
       WHERE date < ?1 AND status != 'final'`,
    ).bind(finalizedBefore),
  );

  if (statements.length) {
    await env.TRAFFIC_DB.batch(statement
```

### Core Architecture Module: `scripts/download_feishu_wiki.py`
```
#!/usr/bin/env python3
"""Recursively export a Feishu Wiki tree with offline media."""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import mimetypes
import os
import re
import subprocess
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


MEDIA_TAGS = {"img", "image", "file", "source", "attachment", "whiteboard"}
INVALID_FILENAME = re.compile(r"[\x00-\x1f/\\]")


def cli_json(args: list[str], retries: int = 3) -> dict[str, Any]:
    command = ["lark-cli", *args, "--as", "user", "--format", "json"]
    last_error = ""
    for attempt in range(1, retries + 1):
        proc = subprocess.run(command, text=True, capture_output=True)
        if proc.returncode == 0:
            try:
                payload = json.loads(proc.stdout)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"CLI returned invalid JSON: {exc}\n{proc.stdout[:500]}") from exc
            if payload.get("ok", True):
                return payload
            last_error = json.dumps(payload, ensure_ascii=False)
        else:
            last_error = (proc.stderr or proc.stdout).strip()
        if attempt < retries:
            time.sleep(attempt)
    raise RuntimeError(f"Command failed: {' '.join(command[:3])}\n{last_error}")


def safe_name(value: str, fallback: str) -> str:
    value = INVALID_FILENAME.sub("／", value).strip().rstrip(".")
    return value or fallback


def extension_for(name: str, mime: str, kind: str) -> str:
    suffix = Path(name).suffix
    if suffix and len(suffix) <= 12:
        return suffix
    if kind == "whiteboard":
        return ".png"
    normalized = mime.split(";", 1)[0].strip().lower()
    aliases = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/svg+xml": ".svg",
        "application/pdf": ".pdf",
    }
    return aliases.get(normalized) or mimetypes.guess_extension(normalized) or ".bin"


@dataclass
class Node:
    data: dict[str, Any]
    parent: "Node | None" = None
    children: list["Node"] = field(default_factory=list)
    directory: Path | None = None

    @property
    def title(self) -> str:
        return str(self.data.get("title") or "未命名页面")

    @property
    def node_token(self) -> str:
        return str(self.data["node_token"])

    @property
    def obj_token(self) -> str:
        return str(self.data["obj_token"])


@dataclass
class Asset:
    page: Node
    kind: str
    token: str
    href: str
    output: Path


def crawl(root_url: str) -> tuple[Node, str]:
    root_payload = cli_json(["wiki", "+node-get", "--node-token", root_url])
    root_data = dict(root_payload["data"])
    root = Node(root_data)
    space_id = str(root_data["space_id"])

    def visit(parent: Node) -> None:
        if not parent.data.get("has_child"):
            return
        payload = cli_json(
            [
                "wiki",
                "+node-list",
                "--space-id",
                space_id,
                "--parent-node-token",
                parent.node_token,
                "--page-all",
                "--page-limit",
                "0",
            ]
        )
        for item in payload["data"].get("nodes", []):
            child = Node(dict(item), parent=parent)
            parent.children.append(child)
            visit(child)

    visit(root)
    return root, space_id


def assign_directories(root: Node, base: Path) -> None:
    root.directory = base / safe_name(root.title, root.node_token[:8])

    def visit(parent: Node) -> None:
        assert parent.directory is not None
        used: set[str] = set()
        for child in parent.children:
            candidate = safe_name(child.title, child.node_token[:8])
            key = candidate.casefold()
            if key in used:
                candidate = f"{candidate}__{child.node_token[:8]}"
            used.add(candidate.casefold())
            child.directory = parent.directory / candidate
            visit(child)

    visit(root)


def walk(root: Node) -> list[Node]:
    nodes: list[Node] = []

    def visit(node: Node) -> None:
        nodes.append(node)
        for child in node.children:
            visit(child)

    visit(root)
    return nodes


def parse_assets(node: Node, xml_content: str) -> list[Asset]:
    assert node.directory is not None
    assets: list[Asset] = []
    seen: set[tuple[str, str, str]] = set()
    try:
        tree = ET.fromstring(f"<root>{xml_content}</root>")
        elements = list(tree.iter())
    except ET.ParseError:
        elements = []

    for element in elements:
        kind = element.tag.rsplit("}", 1)[-1].lower()
        if kind not in MEDIA_TAGS:
            continue
        # The v2 fetch API already serializes inline whiteboards (for example,
        # Mermaid/SVG) into both source.xml and source.md. A thumbnail is only
        # needed when no inline representation exists.
        if kind == "whiteboard" and (element.text or "").strip():
            continue
        attrs = element.attrib
        token = str(
            attrs.get("token")
            or attrs.get("file_token")
            or attrs.get("file-token")
            or attrs.get("src")
            or ""
        )
        href = html.unescape(str(attrs.get("href") or attrs.get("url") or ""))
        if not token and not href:
            continue
        dedupe_key = (kind, token, href)
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        original_name = safe_name(str(attrs.get("name") or "asset"), "asset")
        mime = str(attrs.get("mime") or attrs.get("mime-type") or "")
        ext = extension_for(original_name, mime, kind)
        stem = safe_name(Path(original_name).stem, "asset")[:60]
        identity = (token or str(len(assets) + 1))[:10]
        filename = f"{len(assets) + 1:03d}_{stem}_{identity}{ext}"
        assets.append(
            Asset(
                page=node,
                kind=kind,
                token=token,
                href=href,
                output=node.directory / "assets" / filename,
            )
        )
    return assets


def replace_subpages(markdown: str, node: Node) -> str:
    if not node.children:
        return re.sub(r"<sub-page-list\b[^>]*>.*?</sub-page-list>", "", markdown, flags=re.S)
    lines: list[str] = []
    assert node.directory is not None
    for child in node.children:
        assert child.directory is not None
        relative = child.directory.relative_to(node.directory).as_posix() + "/index.md"
        href = urllib.parse.quote(relative, safe="/._-()")
        lines.append(f"- [{child.title}]({href})")
    replacement = "\n".join(lines)
    pattern = r"<sub-page-list\b[^>]*>.*?</sub-page-list>"
    if re.search(pattern, markdown, flags=re.S):
        return re.sub(pattern, replacement, markdown, flags=re.S)
    return markdown.rstrip() + "\n\n" + replacement + "\n"


def localize_markdown(markdown: str, node: Node, assets: list[Asset]) -> str:
    assert node.directory is not None
    result = replace_subpages(markdown, node)
    for asset in assets:
        relative = asset.output.relative_to(node.directory).as_posix()
        local_href = urllib.parse.quote(relative, safe="/._-()")
        if asset.href:
            result = result.replace(asset.href, local_href)
        if asset.kind == "whiteboard" and asset.token:
            pattern = rf"<whiteboard\b[^>]*(?:token|src)=[\"']{re.escape(asset.token)}[\"'][^>]*/?>"
            result = re.sub(pattern, f"![画板]({local_href})", result)
    return result


def export_page(node: Node) -> list[Asset]:
    assert node.directory is not None
    node.directory.mkdir(parents=True, exist_ok=True)
    print(f"[页面] {node.directory}", flush=True)
    if node.data.get("obj_type") not in {"doc", "docx"}:
        raise RuntimeErr
```

### Core Architecture Module: `workers/traffic-collector.ts`
```
interface Env {
  TRAFFIC_SYNC_URL: string;
  TRAFFIC_SYNC_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function triggerSync(env: Env) {
  if (!env.TRAFFIC_SYNC_TOKEN) {
    throw new Error("TRAFFIC_SYNC_TOKEN is not configured");
  }

  const response = await fetch(env.TRAFFIC_SYNC_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.TRAFFIC_SYNC_TOKEN}`,
      Accept: "application/json",
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Pages sync returned HTTP ${response.status}: ${body}`);
  }

  return body ? JSON.parse(body) : { ok: true };
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ) {
    context.waitUntil(triggerSync(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "workbuddy-traffic-collector" });
    }

    if (url.pathname !== "/sync" || request.method !== "POST") {
      return json({ error: "Not found" }, 404);
    }

    if (
      !env.TRAFFIC_SYNC_TOKEN ||
      request.headers.get("Authorization") !==
        `Bearer ${env.TRAFFIC_SYNC_TOKEN}`
    ) {
      return json({ error: "Unauthorized" }, 401);
    }

    try {
      return json(await triggerSync(env));
    } catch (error) {
      console.error("Traffic archive sync failed", error);
      return json({ error: "Traffic archive sync failed" }, 502);
    }
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #23** (2026-09-18): **[Bug]**
  *Symptoms*: ### 页面地址 / Page URL  https://workbuddy.homes/bluebook/%E7%AC%AC%E5%9B%9B%E7%AF%87%20%E5%B2%97%E4%BD%8D%E4%B8%8E%E8%A1%8C%E4%B8%9A%E8%90%BD%E5%9C%B0/%E7%AC%AC%2026%20%E7%AB%A0%20%E5%B2%97%E4%BD%8D%E8%B7%AF%E7%BA%BF%E5%9B%BE%EF%BC%9A%E4%B8%8D%E5%90%8C%E5%B2%97%E4%BD%8D%E5%A6%82%E4%BD%95%E6%8A%8A%20WorkBuddy%20%E7%94%A8%E6%B7%B1/  ### 问题描述 / Description  深色模式下，左边导航栏选中，你的主题色字体颜色不对  <img width="634" height="472" alt="Image" src="https://github.com/user-attachments/assets/98d4f796-428c-4fff-a14c-a7aae2e06cb0" />  ### 设备与浏览器 / Device and browser  mac+chrome

- **Issue #10** (2026-07-20): **[Bug]**
  *Symptoms*: ### 页面地址 / Page URL  https://workbuddy.homes/bluebook/  ### 问题描述 / Description  The dark mode cannot display the currently selected directory.  <img width="1920" height="911" alt="Image" src="https://github.com/user-attachments/assets/52b7ebea-7d2d-484a-b502-0f4c2ef1247f" />  ### 设备与浏览器 / Device and browser  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="2867" height="1500" alt="Image" src="https://github.com/user-attachments/assets/8be3bf42-4485-4418-b348-d25270a5051b" /> 该问题已定位解决，并且已经提交pr： https://github.com/AlephAITech/WorkBuddyGuide/pull/11

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

### Incident Patch 1: `e3053472` (2026-09-18)
**Commit Message**: Fix active sidebar text color in dark mode (#32)

**File**: `docs/.vitepress/theme/style.css` (modified, +4/-0)
```diff
@@ -808,6 +808,10 @@ button {
   background: var(--wb-acid);
 }
 
+.VPSidebarItem.is-active > .item .link > .text {
+  color: #11130e !important;
+}
+
 .VPSidebarItem.is-active > .item .link::before {
   position: absolute;
   top: 0;
```

---

### Incident Patch 2: `abd61e82` (2026-08-07)
**Commit Message**: Fix Cloudflare dependency lockfile

**File**: `package-lock.json` (modified, +458/-48)
```diff
@@ -1165,9 +1165,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1185,9 +1182,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1205,9 +1199,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1225,9 +1216,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1245,9 +1233,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1265,9 +1250,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1285,9 +1267,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1305,9 +1284,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1325,9 +1301,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1351,9 +1324,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1377,9 +1347,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1403,9 +1370,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1429,9 +1393,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1455,9 +1416,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1481,9 +1439,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1507,9 +1462,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -6300,6 +6252,420 @@
         }
       }
     },
+    "node_modules/vitest/node_modules/@esbuild/aix-ppc64": {
+      "version": "0.28.1",
+      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.28.1.tgz",
+      "integrity": "sha512-Svl7tq8k/08+p6CXPpRjQ1fKX+1odH/BQbb48fV6fj3CWHhsoIOoY87w1oHXm0qEpkIK3ZfVgp0hed3XBXzXMQ==",
+      "cpu": [
+        "ppc64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "aix"
+      ],
+      "peer": true,
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/vitest/node_modules/@esbuild/android-arm": {
+      "version": "0.28.1",
+      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.28.1.tgz",
+      "integrity": "sha512-0k2F129Xdio1TdJfzJ8sy1Q47vUD2NnwdhiAf7drUN1EBTfPf4hsFCtmMgu/6m8JSzsBrlmVjudMBQqOfG8usQ==",
+      "cpu": [
+        "arm"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional"
```

---

### Incident Patch 3: `8e5921a2` (2026-07-12)
**Commit Message**: fix sidebar chapter synchronization

**File**: `docs/.vitepress/sidebar.ts` (modified, +5/-5)
```diff
@@ -28,7 +28,7 @@ export const bluebookSidebar: DefaultTheme.Sidebar = {
     { text: "蓝皮书总览", link: "/bluebook/" },
     {
       text: "第一篇 · 使用手册",
-      collapsed: false,
+      collapsed: true,
       items: [
         item(part1, "本篇导读"),
         child(part1, "第 1 章 初识 WorkBuddy"),
@@ -46,7 +46,7 @@ export const bluebookSidebar: DefaultTheme.Sidebar = {
     },
     {
       text: "第二篇 · 实战案例",
-      collapsed: false,
+      collapsed: true,
       items: [
         item(part2, "本篇导读"),
         child(part2, "第 11 章 办公三件套：Word、Excel、PPT"),
@@ -64,7 +64,7 @@ export const bluebookSidebar: DefaultTheme.Sidebar = {
     },
     {
       text: "第三篇 · 进阶系统",
-      collapsed: false,
+      collapsed: true,
       items: [
         item(part3, "本篇导读"),
         child(part3, "第 22 章 打造skill：将书和视频蒸馏为可执行 Skill"),
@@ -75,7 +75,7 @@ export const bluebookSidebar: DefaultTheme.Sidebar = {
     },
     {
       text: "第四篇 · 岗位与行业",
-      collapsed: false,
+      collapsed: true,
       items: [
         item(part4, "本篇导读"),
         child(part4, "第 26 章 岗位路线图：不同岗位如何把 WorkBuddy 用深"),
@@ -84,7 +84,7 @@ export const bluebookSidebar: DefaultTheme.Sidebar = {
     },
     {
       text: "附录",
-      collapsed: false,
+      collapsed: true,
       items: [
         item(appendix, "附录导读"),
         child(appendix, "附录 A 常用指令模板"),
```

#### Recent Merged Pull Requests:
- **PR #32** (2026-09-18): Fix dark mode active sidebar text color (@liucongg)
- **PR #31** (closed): docs: link safety-reviewed WorkBuddy resource index (@liyangbing)
- **PR #30** (closed): docs: link the Awesome WorkBuddy directory (@liyangbing)
- **PR #28** (closed): docs: add OrcaRouter as a named external API provider in Chapter 9 (@bangla24bdrang-lab)
- **PR #27** (2026-09-18): Case: 朝霞带你游东莞——数据驱动的城市名片 (@0769-zhaoxia)
- **PR #17** (2026-07-26): Add case: 用 WorkBuddy 专家团吃透十年年报：一套可复用的上市公司深度研究方法 (@stephenlzc)
- **PR #16** (2026-07-25): Case: 用 WorkBuddy 清洗 119 份门店 Excel 并生成可交互运营看板 (@stephenlzc)
- **PR #13** (closed): fix 超链接样式错乱 (@LeoLeeTech)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
