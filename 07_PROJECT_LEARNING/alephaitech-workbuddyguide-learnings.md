# Forensic Learning Record (Deep Inspection): AlephAITech/WorkBuddyGuide

> **Canonical Artifact**: `07_PROJECT_LEARNING/alephaitech-workbuddyguide-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AlephAITech/WorkBuddyGuide](https://github.com/AlephAITech/WorkBuddyGuide))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:04:39.753Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AlephAITech/WorkBuddyGuide`
- **Description**: A practical, open-source guide to mastering WorkBuddy through real-world workflows.开源的 WorkBuddy 实战蓝皮书：教程、真实工作流、Skills、MCP、自动化与多智能体实践。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3319 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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
    await env.TRAFFIC_DB.batch(statements);
  }

  return {
    baselineCreated: !previousBaseline,
    syncedDates,
    finalizedBefore,
  };
}

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
        raise RuntimeError(f"Unsupported wiki object type: {node.data.get('obj_type')} ({node.title})")

    markdown_payload = cli_json(
        [
            "docs",
            "+fetch",
            "--api-version",
            "v2",
            "--doc",
            node.obj_token,
            "--doc-format",
            "markdown",
            "--detail",
            "simple",
        ]
    )
    xml_payload = cli_json(
        [
            "docs",
            "+fetch",
            "--api-version",
            "v2",
            "--doc",
            node.obj_token,
            "--doc-format",
            "xml",
            "--detail",
            "full",
        ]
    )
    markdown_doc = markdown_payload["data"]["document"]
    xml_doc = xml_payload["data"]["document"]
    source_markdown = str(markdown_doc.get("content") or "")
    source_xml = str(xml_doc.get("content") or "")
    assets = parse_assets(node, source_xml)

    (node.directory / "source.md").write_text(source_markdown, encoding="utf-8")
    (node.directory / "source.xml").write_text(source_xml, encoding="utf-8")
    (node.directory / "index.md").write_text(
        localize_markdown(source_markdown, node, assets), encoding="utf-8"
    )
    metadata = {
        **node.data,
        "markdown_revision_id": markdown_doc.get("revision_id"),
        "xml_revision_id": xml_doc.get("revision_id"),
        "asset_count": len(assets),
    }
    (node.directory / "metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return assets


def download_via_url(asset: Asset) -> None:
    asset.output.parent.mkdir(parents=True, exist_ok=True)
    temp = asset.output.with_suffix(asset.output.suffix + ".part")
    proc = subprocess.run(
        [
            "curl",
            "-L",
            "--fail",
            "--silent",
            "--show-error",
            "--retry",
            "2",
            "--output",
            str(temp),
            asset.href,
      
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
+      "optional": true,
+      "os": [
+        "android"
+      ],
+      "peer": true,
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/vitest/node_modules/@esbuild/android-arm64": {
+      "version": "0.28.1",
+      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.28.1.tgz",
+      "integrity": "sha512-34EGEbCIAgosYz6goLcopX6Mo7NyGv9tfwEM2/7Ce2VcVRk568iSvniGWcUXIy7wEDR1wzolcxcriFVrWYcwBg==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "android"
+      ],
+      "peer": true,
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/vitest/node_modules/@esbuild/android-x64": {
+      "version": "0.28.1",
+      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.28.1.tgz",
+      "integrity": "sha512-dbwY7ltSMDWsRatcRpCnES4F+im88OCUgGZjy52shC7GqHRE/cYlxNbB4Z4UpJswpcc4Qxd2oE/ufM0p61IKng==",
+      "c
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

---

### Incident Patch 4: `e2668d64` (2026-07-10)
**Commit Message**: Redesign homepage and theme with pixel-green UI

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `design-qa.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# WorkBuddy Guide Design QA
+
+## Visual sources
+
+- Selected reference: `/var/folders/hr/bjd54z9s0sx7mq1dgj_lbqtc0000gp/T/codex-clipboard-3ad16ffa-0bd1-4298-87cb-41a47c358f86.png`
+- Desktop homepage: `artifacts/design-qa/design-qa-home-1488.png`
+- Desktop chapter page: `artifacts/design-qa/design-qa-chapter-one-1488.png`
+- Mobile homepage: `artifacts/design-qa/design-qa-home-mobile-390.png`
+- Mobile chapter page: `artifacts/design-qa/design-qa-chapter-mobile-390.png`
+
+## Viewports and states
+
+- Desktop: 1488 x 1058, light theme
+- Mobile: 390 x 844, light theme
+- Core states checked: homepage navigation, chapter navigation, search entry, theme switch, responsive sidebar, primary calls to action
+
+## Iteration history
+
+### Pass 1
+
+- Finding: VitePress' default content container constrained the custom homepage to 1152 px, making the hero title wrap to four lines and weakening the reference composition.
+- Fix: removed the default homepage container width and padding while preserving the standard chapter content width.
+- Result: the desktop hero now fills the intended frame and the headline holds the reference's two-line composition.
+
+### Pass 2
+
+- Finding: shared chapter heading ornaments were also being applied inside homepage sections.
+- Fix: scoped the pixel heading ornament and chapter typography to document pages only.
+- Result: homepage section headings and chapter headings now each retain the intended hierarchy.
+
+### Pass 3
+
+- Typography: passed. Pixel display type is reserved for labels, metadata, and accents; Chinese reading text remains legible.
+- Layout and spacing: passed. Hero, value strip, route cards, task grid, side navigation, article body, and page navigation align consistently.
+- Color and contrast: passed. Acid green, ink black, and warm paper form a consistent high-contrast system in both page types.
+- Icons and imagery: passed. HackerNoon Pixel Icon Library is used for interface illustrations; existing chapter images remain real content assets.
+- Responsiveness: passed. At 390 px, both pages have no horizontal overflow, actions stack correctly, and chapter content remains readable.
+- Interactions: passed. Search, theme switching, primary CTAs, cards, and chapter navigation are available and preserve VitePress behavior.
+- Accessibility: passed. Semantic headings and landmarks are retained, icon buttons have accessible labels, visible focus styles are provided, tap targets are sized for mobile, and reduced-motion preferences are respected.
+
+## Acceptable differences from the reference
+
+- The closest matching open-source pixel face icon is used instead of reproducing the reference illustration exactly.
+- Navigation proportions were adapted to the project's existing information architecture and search behavior.
+
+## Result
+
+final result: passed
```

**File**: `docs/.vitepress/config.mts` (modified, +10/-9)
```diff
@@ -18,7 +18,7 @@ export default withMermaid(
       hostname: siteUrl,
     },
     head: [
-      ["meta", { name: "theme-color", content: "#5b5bd6" }],
+      ["meta", { name: "theme-color", content: "#d8f238" }],
       ["meta", { name: "author", content: "WorkBuddy Guide Contributors" }],
       [
         "meta",
@@ -50,16 +50,16 @@ export default withMermaid(
     mermaid: {
       theme: "base",
       themeVariables: {
-        primaryColor: "#eef0ff",
-        primaryTextColor: "#202038",
-        primaryBorderColor: "#6d6ddb",
-        lineColor: "#7777a8",
-        secondaryColor: "#f7f4ff",
-        tertiaryColor: "#f5f7fb",
+        primaryColor: "#eef6d1",
+        primaryTextColor: "#12140f",
+        primaryBorderColor: "#355e18",
+        lineColor: "#62675e",
+        secondaryColor: "#f5f7f0",
+        tertiaryColor: "#ffffff",
       },
     },
     themeConfig: {
-      siteTitle: "WorkBuddy 实战蓝皮书",
+      siteTitle: "WorkBuddy Guide",
       nav: [
         { text: "首页", link: "/" },
         { text: "开始阅读", link: "/bluebook/" },
@@ -93,7 +93,8 @@ export default withMermaid(
         text: "在 GitHub 上改进此页",
       },
       footer: {
-        message: "以真实任务为主线的 WorkBuddy 社区实战读本",
+        message:
+          '以真实任务为主线的 WorkBuddy 社区实战读本 · Pixel icons by <a href="https://pixeliconlibrary.com/" target="_blank" rel="noreferrer">HackerNoon</a>',
         copyright: "Copyright © 2026 WorkBuddy Guide Contributors",
       },
     },
```

**File**: `docs/.vitepress/theme/components/HomePage.vue` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+<template>
+  <main class="wb-home">
+    <section class="wb-hero" aria-labelledby="wb-hero-title">
+      <div class="wb-hero__stage">
+        <div class="wb-hero__copy">
+          <p class="wb-pixel-label">OPEN-SOURCE · 27 CHAPTERS · 2026</p>
+          <h1 id="wb-hero-title">从第一项任务，<br />到一支 AI 团队</h1>
+          <p class="wb-hero__summary">
+            一套以真实工作为主线的 WorkBuddy 实践路径。<br />
+            先用起来，再把一次成功沉淀为可复用的工作系统。
+          </p>
+          <div class="wb-hero__actions">
+            <a class="wb-button wb-button--primary" href="/bluebook/">
+              <span>开始阅读</span>
+              <i class="hn hn-arrow-right" aria-hidden="true"></i>
+            </a>
+            <a class="wb-button wb-button--outline" href="/reading-guide">查看阅读路线</a>
+          </div>
+        </div>
+
+        <div class="wb-hero__art" aria-label="WorkBuddy 像素图标组合">
+          <span class="wb-hero__monogram">WB_</span>
+          <span class="wb-icon-card wb-icon-card--buddy">
+            <i class="hn hn-face-grin" aria-hidden="true"></i>
+          </span>
+          <span class="wb-icon-card wb-icon-card--book">
+            <i class="hn hn-book" aria-hidden="true"></i>
+          </span>
+          <span class="wb-icon-card wb-icon-card--flow">
+            <i class="hn hn-sitemap" aria-hidden="true"></i>
+          </span>
+          <span class="wb-icon-card wb-icon-card--work">
+            <i class="hn hn-briefcase" aria-hidden="true"></i>
+          </span>
+          <div class="wb-hero__metrics" aria-label="蓝皮书内容规模">
+            <span><b>27</b> CHAPTERS</span>
+            <span><b>4</b> PARTS</span>
+            <span><b>∞</b> WORKFLOWS</span>
+          </div>
+        </div>
+      </div>
+
+      <div class="wb-value-strip" aria-label="蓝皮书价值">
+        <div class="wb-value-strip__item">
+          <i class="hn hn-check-box" aria-hidden="true"></i>
+          <span><b>真实任务</b><small>REAL TASKS</small></span>
+        </div>
+        <div class="wb-value-strip__item">
+          <i class="hn hn-refresh" aria-hidden="true"></i>
+          <span><b>可复现</b><small>REPRODUCIBLE</small></span>
+        </div>
+        <div class="wb-value-strip__item">
+          <i class="hn hn-handshake" aria-hidden="true"></i>
+          <span><b>社区共创</b><small>OPEN SOURCE</small></span>
+        </div>
+        <div class="wb-value-strip__item">
+          <i class="hn hn-grid" aria-hidden="true"></i>
+          <span><b>系统沉淀</b><small>WORK SYSTEM</small></span>
+        </div>
+      </div>
+    </section>
+
+    <section class="wb-section wb-reading" aria-labelledby="wb-reading-title">
+      <div class="wb-section__heading">
+        <div>
+          <p class="wb-pixel-label">READING PATH / 01—04</p>
+          <h2 id="wb-reading-title">四段路径，按你的目标进入</h2>
+        </div>
+        <p>从个人上手到组织落地，循序渐进，构建你的 WorkBuddy 工作系统。</p>
+      </div>
+
+      <div class="wb-reading-grid">
+        <a class="wb-reading-card" href="/bluebook/第一篇%20使用手册：先把%20WorkBuddy%20用起来/">
+          <span class="wb-reading-card__icon"><i class="hn hn-user" aria-hidden="true"></i></span>
+          <span class="wb-reading-card__content">
+            <small>PART 01 · CH. 01—10</small>
+            <strong>从 0 到 1：先把 WorkBuddy 用起来</strong>
+            <span>安装、界面、第一个任务、Skill、连接器、API 与自动化。</span>
+            <em><b>新手推荐</b><b>先完成一项任务</b></em>
+          </span>
+          <i class="hn hn-arrow-right wb-reading-card__arrow" aria-hidden="true"></i>
+        </a>
+
+        <a class="wb-reading-card" href="/bluebook/第二篇%20案例篇：从一项任务到一支%20AI%20团队/">
+          <span class="wb-reading-card__icon"><i class="hn hn-briefcase" aria-hidden="true"></i></span>
+          <span class="wb-reading-card__content">
+            <small>PART 02 · CH. 11—21</small>
+            <strong>进入真实案例：让任务开始流动</strong>
+            <span>办公、文件、远程、资讯、知识、会议、投资和内容增长。</span>
+            <em><b>11 个案例</b><b>任务驱动</b></em>
+          </span>
+          <i class="hn hn-arrow-right wb-reading-card__arrow" aria-hidden="true"></i>
+        </a>
+
+        <a class="wb-reading-card" href="/bluebook/第三篇%20进阶篇：把案例变成自己的工作系统/">
+          <span class="wb-reading-card__icon"><i class="hn hn-sitemap" aria-hidden="true"></i></span>
+          <span class="wb-reading-card__content">
+            <small>PART 03 · CH. 22—25</small>
+            <strong>把案例变成可复用的工作系统</strong>
+            <span>打造 Skill、多 Agent 系统设计与可靠的自动化工作流。</span>
+            <em><b>系统进阶</b><b>可靠自动化</b></em>
+          </span>
+          <i class="hn hn-arrow-right wb-reading-card__arrow" aria-hidden="true"></i>
+        </a>
+
+        <a class="wb-reading-card" href="/bluebook/第四篇%20岗位与行业落地/">
+          <span class="wb-reading-card__icon"><i class="hn hn-users" aria-hidden="true"></i></span>
+          <span class="wb-reading-card__content">
+            <small>PART 04 · CH. 26—27</small>
+            <strong>落到岗位与行业，组建 AI 团队</strong>
+            <span>从通用能力出发，设计适合不同岗位和行业的工作流。</span>
+            <em><b>团队落
```

**File**: `docs/.vitepress/theme/index.ts` (modified, +9/-1)
```diff
@@ -1,5 +1,13 @@
 import DefaultTheme from "vitepress/theme";
+import HomePage from "./components/HomePage.vue";
 
+import "@fontsource/silkscreen/400.css";
+import "@hackernoon/pixel-icon-library/fonts/iconfont.css";
 import "./style.css";
 
-export default DefaultTheme;
+export default {
+  extends: DefaultTheme,
+  enhanceApp({ app }) {
+    app.component("HomePage", HomePage);
+  },
+};
```

**File**: `docs/.vitepress/theme/style.css` (modified, +1133/-118)
```diff
@@ -1,208 +1,1223 @@
 :root {
-  --vp-c-brand-1: #5b5bd6;
-  --vp-c-brand-2: #6d6de3;
-  --vp-c-brand-3: #4848ba;
-  --vp-c-brand-soft: rgba(91, 91, 214, 0.14);
-  --vp-c-bg-alt: #f7f7fb;
-  --vp-c-divider: rgba(85, 82, 115, 0.14);
-  --vp-home-hero-name-color: transparent;
-  --vp-home-hero-name-background: linear-gradient(120deg, #4f46e5 10%, #7c3aed 56%, #2563eb 100%);
-  --vp-home-hero-image-background-image: radial-gradient(circle at center, rgba(91, 91, 214, 0.22), transparent 68%);
-  --vp-home-hero-image-filter: blur(44px);
+  --wb-acid: #d8f238;
+  --wb-acid-strong: #b9e52f;
+  --wb-acid-soft: #eef7bd;
+  --wb-ink: #11130e;
+  --wb-paper: #f5f7f0;
+  --wb-surface: #ffffff;
+  --wb-muted: #656b60;
+  --wb-line: #d7dbd0;
+  --wb-pixel: "Silkscreen", monospace;
+  --wb-body: "Avenir Next", Avenir, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
+  --wb-shadow: 4px 4px 0 var(--wb-ink);
+
+  --vp-c-brand-1: #355e18;
+  --vp-c-brand-2: #477622;
+  --vp-c-brand-3: #23420f;
+  --vp-c-brand-soft: rgba(216, 242, 56, 0.3);
+  --vp-c-bg: var(--wb-paper);
+  --vp-c-bg-alt: #edf0e8;
+  --vp-c-bg-elv: var(--wb-surface);
+  --vp-c-bg-soft: #eef1e9;
+  --vp-c-divider: var(--wb-line);
+  --vp-c-gutter: var(--wb-line);
+  --vp-c-text-1: var(--wb-ink);
+  --vp-c-text-2: var(--wb-muted);
+  --vp-c-text-3: #8a9084;
+  --vp-nav-bg-color: rgba(245, 247, 240, 0.92);
+  --vp-sidebar-bg-color: #f0f3eb;
+  --vp-code-block-bg: #161913;
+  --vp-code-line-highlight-color: rgba(216, 242, 56, 0.12);
+  --vp-custom-block-tip-bg: #eff7c9;
+  --vp-custom-block-tip-border: #355e18;
 }
 
 .dark {
-  --vp-c-brand-1: #aaa7ff;
-  --vp-c-brand-2: #8f8be8;
-  --vp-c-brand-3: #c8c5ff;
-  --vp-c-brand-soft: rgba(143, 139, 232, 0.18);
-  --vp-c-bg-alt: #171721;
-  --vp-c-divider: rgba(215, 211, 255, 0.12);
+  --wb-acid: #d8f238;
+  --wb-acid-strong: #c5e934;
+  --wb-acid-soft: #2b3218;
+  --wb-ink: #f3f5ed;
+  --wb-paper: #10120e;
+  --wb-surface: #181b15;
+  --wb-muted: #aeb4a7;
+  --wb-line: #343a2f;
+  --wb-shadow: 4px 4px 0 #d8f238;
+
+  --vp-c-brand-1: #d8f238;
+  --vp-c-brand-2: #c5e934;
+  --vp-c-brand-3: #e5f878;
+  --vp-c-brand-soft: rgba(216, 242, 56, 0.14);
+  --vp-c-bg: var(--wb-paper);
+  --vp-c-bg-alt: #151812;
+  --vp-c-bg-elv: var(--wb-surface);
+  --vp-c-bg-soft: #1c2019;
+  --vp-c-divider: var(--wb-line);
+  --vp-c-gutter: var(--wb-line);
+  --vp-c-text-1: var(--wb-ink);
+  --vp-c-text-2: var(--wb-muted);
+  --vp-c-text-3: #7f8678;
+  --vp-nav-bg-color: rgba(16, 18, 14, 0.92);
+  --vp-sidebar-bg-color: #141712;
+  --vp-code-block-bg: #090a08;
+  --vp-custom-block-tip-bg: #242b16;
+  --vp-custom-block-tip-border: #d8f238;
+}
+
+*,
+*::before,
+*::after {
+  box-sizing: border-box;
+}
+
+html {
+  scroll-behavior: smooth;
 }
 
 body {
-  font-family:
-    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
-    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
+  font-family: var(--wb-body);
+  font-feature-settings: "kern" 1;
+  background: var(--wb-paper);
+}
+
+::selection {
+  color: #0c0d0a;
+  background: var(--wb-acid);
+}
+
+a,
+button {
+  -webkit-tap-highlight-color: transparent;
+}
+
+/* Global navigation */
+.VPNav {
+  border-bottom: 1px solid var(--wb-line);
+}
+
+.VPNavBar {
+  height: 70px;
+  background: var(--vp-nav-bg-color) !important;
+  backdrop-filter: blur(14px);
+}
+
+.VPNavBar .container {
+  max-width: 1480px;
 }
 
 .VPNavBarTitle .title {
-  font-weight: 720;
-  letter-spacing: -0.02em;
+  gap: 10px;
+  border-bottom: 0;
+  font-size: 18px;
+  font-weight: 800;
+  letter-spacing: -0.03em;
+}
+
+.VPNavBarTitle .title::before {
+  color: var(--wb-ink);
+  font-family: iconfont !important;
+  font-size: 27px;
+  font-weight: 400;
+  content: "\f175";
 }
 
-.VPHomeHero {
+.VPNavBarMenuLink,
+.VPNavBarMenuGroup .text {
+  font-size: 15px;
+  font-weight: 650;
+}
+
+.VPNavBarMenuLink.active {
   position: relative;
-  overflow: hidden;
+  color: var(--wb-ink);
 }
 
-.VPHomeHero::before {
+.VPNavBarMenuLink.active::after {
   position: absolute;
-  inset: 24px 0 auto;
-  height: 420px;
-  background-image: radial-gradient(rgba(91, 91, 214, 0.16) 1px, transparent 1px);
-  background-size: 22px 22px;
-  mask-image: linear-gradient(to bottom, black, transparent 82%);
+  right: 12px;
+  bottom: 8px;
+  left: 12px;
+  height: 2px;
+  background: var(--wb-ink);
   content: "";
-  pointer-events: none;
 }
 
-.VPHomeHero .container,
-.VPHomeFeatures .container {
-  position: relative;
+.VPNavBarSearch .DocSearch-Button,
+.VPNavBarSearch button {
+  border: 1px solid var(--wb-line);
+  border-radius: 4px !important;
+  background: var(--wb-surface);
 }
 
-.VPHomeHero .name {
-  font-weight: 820;
-  letter-spacing: -0.045em;
+.VPSocialLink,
+.VPNavBarAppearance .VPSwitchAppearance {
+  color: var(--wb-ink);
 }
 
-.VPHomeHero .text {
-  max-width: 740px;
-  font-size: clamp(30px, 5vw, 54px);
-  line-height: 1.08;
-  letter-spacing: -0.035em;
+/* Homepage */
```

**File**: `docs/index.md` (modified, +3/-53)
```diff
@@ -1,57 +1,7 @@
 ---
 layout: home
-
-hero:
-  name: WorkBuddy 实战蓝皮书
-  text: 从第一项任务，到一支 AI 团队
-  tagline: 不是功能清单，而是一套以真实工作为主线的实践路径。先用起来，再把一次成功沉淀为可复用的工作系统。
-  actions:
-    - theme: brand
-      text: 开始阅读
-      link: /bluebook/
-    - theme: alt
-      text: 查看阅读路线
-      link: /reading-guide
-    - theme: alt
-      text: GitHub 共创
-      link: https://github.com/AlephMuYe/WorkBuddyGuide
-
-features:
-  - icon: "01"
-    title: 先完成第一项任务
-    details: 从下载、安装、登录和界面开始，跑通一次能检查、能复用的 WorkBuddy 任务。
-  - icon: "27"
-    title: 27 章真实工作场景
-    details: 覆盖办公、文件、资讯、知识、会议、投资、内容、GEO、Skill 与多 Agent。
-  - icon: "∞"
-    title: 从案例走向工作系统
-    details: 把一次成功变成自动化、团队协作、岗位路线图和行业工作流。
+title: WorkBuddy 实战蓝皮书
+description: 从第一项任务到一支 AI 团队，把 WorkBuddy 真正用进工作。
 ---
 
-<section class="home-section">
-  <p class="home-section__eyebrow">Reading path</p>
-  <h2>四段路径，按你的目标进入</h2>
-  <p class="home-section__intro">第一次接触 WorkBuddy，建议按顺序阅读；如果已经有明确任务，也可以直接进入对应案例，再回到进阶篇完成方法沉淀。</p>
-  <div class="reading-grid">
-    <a class="reading-card" href="/bluebook/%E7%AC%AC%E4%B8%80%E7%AF%87%20%E4%BD%BF%E7%94%A8%E6%89%8B%E5%86%8C%EF%BC%9A%E5%85%88%E6%8A%8A%20WorkBuddy%20%E7%94%A8%E8%B5%B7%E6%9D%A5/">
-      <span class="reading-card__number">PART 01</span>
-      <strong>先把 WorkBuddy 用起来</strong>
-      <span>安装、界面、第一个任务、Skill、连接器、API 与自动化。</span>
-    </a>
-    <a class="reading-card" href="/bluebook/%E7%AC%AC%E4%BA%8C%E7%AF%87%20%E6%A1%88%E4%BE%8B%E7%AF%87%EF%BC%9A%E4%BB%8E%E4%B8%80%E9%A1%B9%E4%BB%BB%E5%8A%A1%E5%88%B0%E4%B8%80%E6%94%AF%20AI%20%E5%9B%A2%E9%98%9F/">
-      <span class="reading-card__number">PART 02</span>
-      <strong>从任务进入真实案例</strong>
-      <span>办公、文件、远程、资讯、知识、会议、投资和内容增长。</span>
-    </a>
-    <a class="reading-card" href="/bluebook/%E7%AC%AC%E4%B8%89%E7%AF%87%20%E8%BF%9B%E9%98%B6%E7%AF%87%EF%BC%9A%E6%8A%8A%E6%A1%88%E4%BE%8B%E5%8F%98%E6%88%90%E8%87%AA%E5%B7%B1%E7%9A%84%E5%B7%A5%E4%BD%9C%E7%B3%BB%E7%BB%9F/">
-      <span class="reading-card__number">PART 03</span>
-      <strong>把案例变成工作系统</strong>
-      <span>打造 Skill、多 Agent 系统设计与可靠的自动化工作流。</span>
-    </a>
-    <a class="reading-card" href="/bluebook/%E7%AC%AC%E5%9B%9B%E7%AF%87%20%E5%B2%97%E4%BD%8D%E4%B8%8E%E8%A1%8C%E4%B8%9A%E8%90%BD%E5%9C%B0/">
-      <span class="reading-card__number">PART 04</span>
-      <strong>落到岗位与行业</strong>
-      <span>从通用能力出发，设计适合不同岗位和行业的工作流。</span>
-    </a>
-  </div>
-</section>
+<HomePage />
```

**File**: `docs/plans/2026-07-10-workbuddy-pixel-green-ui-design.md` (added, +494/-0)
```diff
@@ -0,0 +1,494 @@
+# WorkBuddy Guide 官网 UI 重设计方案
+
+> 目标：把当前偏 VitePress 默认风格的文档站，升级为具有明确品牌识别度的「高级编辑型 AI 知识站」。视觉参考用户提供的荧光黄绿色像素海报，但不把整站做成复古游戏界面。
+
+## 1. 结论先行
+
+推荐方向：**Editorial Pixel / 编辑型像素科技感**。
+
+- 用米白、白色和墨黑承担长文阅读与专业感。
+- 用荧光黄绿色建立品牌记忆，只出现在 Hero、主要按钮、当前状态和少量强调区。
+- 像素元素控制在整页视觉的 10%–15%，主要用于小图标、章节编号、装饰卡片和微动效。
+- 中文标题和正文坚持现代无衬线字体；像素字体只用于英文标签、数字、状态码，不能用于长段中文。
+- 保留现有 VitePress 的搜索、侧边栏、目录、深色模式、Markdown 内容和全部路由，不重做技术架构。
+
+最终应该让人感到：**这是一本来自 AI Agent 时代的开源工作手册，而不是一个套了绿色主题的默认文档站。**
+
+---
+
+## 2. 对当前站点的判断
+
+### 已有优势
+
+- 首页的信息顺序清楚：品牌主张 → 三个价值点 → 四段阅读路线。
+- 文档站核心能力完整：本地搜索、侧边栏、本页目录、上一篇/下一篇、深色模式。
+- 移动端基础结构可用，现有内容和路由不需要重写。
+- VitePress 默认主题适合继续扩展，没有必要换框架。
+
+### 主要问题
+
+- 紫色渐变、圆角卡片、点阵背景都很常见，缺少 WorkBuddy 自己的品牌特征。
+- 首页 Hero 左侧信息堆叠，右侧大面积留白，没有形成一个能被截图传播的主视觉。
+- 三张功能卡和四张阅读卡视觉权重接近，页面缺少强弱节奏。
+- 章节页几乎是默认文档站样式，侧边栏、正文、目录之间缺少精致的层级关系。
+- 圆角、渐变和阴影偏柔，和参考图的清脆像素感不一致。
+- 当前像素感只存在于点阵背景，并没有变成统一的品牌语言。
+
+---
+
+## 3. 三个可选方向
+
+| 方向 | 视觉特征 | 优点 | 风险 | 建议 |
+| --- | --- | --- | --- | --- |
+| A. 全幅像素海报 | 大面积荧光绿、超大像素字、强烈黑白对比 | 传播性最强，第一眼最像参考图 | 长文阅读容易疲劳，也容易像活动页或游戏站 | 不推荐整站采用 |
+| B. 编辑型像素科技感 | 米白阅读底色、荧光绿品牌区、现代排版、像素细节 | 兼顾高级感、识别度和阅读体验 | 对留白、字体层级和素材质量要求高 | **推荐** |
+| C. 暗色命令中心 | 石墨黑底、荧光绿状态、终端/控制台感 | 科技感强，适合开发者 | 不符合蓝皮书的长期阅读场景，中文密度高时压迫 | 只作为深色模式参考 |
+
+执行时直接采用 B，不需要再混合三套风格。
+
+---
+
+## 4. 品牌关键词与设计原则
+
+### 品牌关键词
+
+**开源、可靠、行动、系统、协作、未来感、可复现。**
+
+### 五条设计原则
+
+1. **先像一本好读的书，再像一个有个性的科技品牌。**
+2. **像素只做记忆点，不做阅读负担。**
+3. **绿色负责聚焦，黑白负责秩序。**
+4. **减少柔和渐变和胶囊按钮，增加清晰边界和硬朗结构。**
+5. **所有装饰都要服务于章节、路径或状态，不增加无意义噪声。**
+
+---
+
+## 5. 视觉系统
+
+### 5.1 色彩 Token
+
+#### 浅色模式
+
+| 用途 | 色值 | 使用规则 |
+| --- | --- | --- |
+| Brand Acid | `#D8F238` | Hero、主按钮、活动状态、大面积品牌块 |
+| Brand Acid Strong | `#BCE52E` | Hover、图表强调、深色模式中的次级品牌绿 |
+| Ink | `#12140F` | 标题、主要按钮、深色区域背景 |
+| Paper | `#F5F7F0` | 页面主背景，轻微偏暖，不用冷白灰 |
+| Surface | `#FFFFFF` | 卡片、正文、搜索框 |
+| Soft Green | `#EEF6D1` | 提示框、引用、浅强调区 |
+| Text Secondary | `#62675E` | 正文次级信息、描述 |
+| Line | `#D9DDD2` | 分隔线、卡片边框、表格线 |
+| Accessible Green | `#355E18` | 白底上的绿色文字和链接状态 |
+
+#### 深色模式
+
+| 用途 | 色值 |
+| --- | --- |
+| Background | `#0F110D` |
+| Surface | `#181B15` |
+| Surface Raised | `#20241C` |
+| Text Primary | `#F3F5ED` |
+| Text Secondary | `#AEB4A7` |
+| Line | `#33392E` |
+| Brand Acid | `#D8F238` |
+
+#### 禁止事项
+
+- 不用荧光绿作为白底小字号正文，因为对比度不足。
+- 不再使用紫蓝渐变作为品牌色。
+- 不用大面积绿色渐变；品牌绿尽量保持纯色和平面感。
+- 同一屏最多一个大面积绿色区域。
+
+### 5.2 字体与排版
+
+- 中文标题：`PingFang SC / Microsoft YaHei / system-ui`，字重 700–800。
+- 中文正文：系统无衬线，字重 400–500，章节正文行高 `1.8–1.9`。
+- 英文与数字：优先 `Inter Tight / Inter / system-ui`。
+- 像素字体：只用于 `PART 01`、`OPEN SOURCE`、`27 CHAPTERS`、编号和装饰词。可选择一款许可证清晰、支持英文和数字的像素字体，并本地托管。
+- 不让像素字体承担中文 H1、导航或正文。
+
+建议字号：
+
+| 场景 | 桌面端 | 移动端 |
+| --- | --- | --- |
+| 首页 H1 | `72–88px / 0.98` | `42–50px / 1.05` |
+| 首页副标题 | `20px / 1.7` | `17px / 1.7` |
+| 区块标题 | `40–48px` | `30–36px` |
+| 章节 H1 | `44–52px` | `34–40px` |
+| 正文 | `17–18px` | `16–17px` |
+| 像素标签 | `12–14px` | `11–12px` |
+
+### 5.3 圆角、边框和阴影
+
+- Hero 大容器：`8px`，不要夸张大圆角。
+- 普通卡片：`6–8px`。
+- 按钮：`4–6px`，取消胶囊形态。
+- 边框：`1px` 或 `1.5px`，使用 Ink/Line 色。
+- 重点卡片 Hover：使用 `4px 4px 0` 的克制硬阴影，避免柔软大模糊阴影。
+- 正文图片可以保留 `8px` 圆角，但不要每一层容器都圆角。
+
+### 5.4 像素资产规范
+
+需要一套真实素材，不要用 emoji、文本符号、临时 CSS 图形或随手画的线性图标代替。
+
+建议准备 6 个单色 1-bit 像素图标：
+
+1. 工作任务 / Cursor
+2. AI Agent / Buddy
+3. Skill / 工具箱
+4. Workflow / 节点连线
+5. Team / 多角色协作
+6. Book / 开源蓝皮书
+
+资产要求：
+
+- 黑色主体、透明背景，基于 `32×32` 或 `48×48` 网格绘制。
+- 输出 4 倍 PNG 或许可证清晰的 SVG；PNG 展示时启用像素化渲染，避免模糊。
+- Hero 中将图标放进白色方卡，允许 `±3deg` 的轻微旋转，模拟参考图的贴纸感。
+- 额外准备一张白色小方块点缀图案，用作 Hero 边缘装饰；不要全站重复铺满。
+- 图标必须语义清楚，避免骷髅、手柄、宇宙飞船等与产品无关的游戏化符号。
+
+---
+
+## 6. 首页结构方案
+
+### 6.1 顶部导航
+
+- 高度约 `64–68px`，白色/米白底，底部 1px 分隔线。
+- 左侧为 WorkBuddy Guide 字标 + 小型像素书本标志。
+- 中部或右侧保留：`首页 / 开始阅读 / 阅读指南 / 参与共创`。
+- 搜索入口从左侧移到右侧工具区，和深色模式、GitHub 同组。
+- 当前导航项不再用紫色文字，改成 Ink 字 + 下方 3px 荧光绿短线或绿色像素方块。
+- 移动端只保留字标、搜索、菜单；点击区域至少 `44×44px`。
+
+### 6.2 Hero：整站最重要的品牌画面
+
+Hero 使用一个居中的荧光绿大色块，桌面端最大宽度约 `1280px`、高度约 `540–600px`，内容分成 7:5 两列。
+
+左侧内容：
+
+```text
+OPEN-SOURCE · 27 CHAPTERS · 2026
+
+从第一项任务，
+到一支 AI 团队
+
+一套以真实工作为主线的 WorkBuddy 实践路径。
+先用起来，再把一次成功沉淀为可复用的工作系统。
+
+[ 开始阅读 → ]  [ 查看阅读路线 ]
+```
+
+右侧内容：
+
+- 3–4 张白色像素图标卡片，以错位、轻旋转方式悬浮在绿色区域内。
+- 中间可以出现一个大的 `WB_` 或 `WORK / SYSTEM` 像素标签，但不要覆盖中文主标题。
+- 右下角放 `27 CHAPTERS / 4 PARTS / ∞ WORKFLOWS` 三个数字信息，作为可信度和内容规模说明。
+
+Hero 视觉要求：
+
+- 中文主标题使用现代粗体，不用像素字体。
+- 主按钮用 Ink 黑底 + 白字；次按钮用透明底 + Ink 边框。
+- 不添加玻璃拟态、彩色光晕、3D 球体、人物 AI 插画。
+- 首屏必须在 1440×900 下完整看到标题、CTA 和至少两张像素卡片。
+
+### 6.3 价值条
+
+紧接 Hero 放一条黑底静态信息带，不做无限滚动跑马灯：
+
+`真实任务 REAL TASKS  ·  可复现 REPRODUCIBLE  ·  社区共创 OPEN SOURCE  ·  系统沉淀 WORK SYSTEM`
+
+作用是把视觉从绿色 Hero 过渡到米白内容区，并快速传达项目差异。
+
+### 6.4 四段阅读路线
+
+- 保留现有四段内容，但改成更像编辑排版的 2×2 大卡片。
+- 每张卡左上是像素标签 `PART 01`，右上是章节范围，如 `CH. 01–10`。
+- 标题 28–32px，描述最多两行。
+- 卡片底部增加一条可视化路径线，Hover 时由灰色变成荧光绿。
+- PART 01 作为推荐入口，可用浅绿色底；其他卡片保持白底。
+- 四张卡不要都用相同渐变。
+
+### 6.5 按任务进入
+
+增加一个实用型发现区，用已有章节生成 6 个入口，不增加新页面：
+
+- 办公文档
+- 文件与远程控制
+- 资讯与知识管理
+- 投资与专业分析
+- 视频与内容增长
+- Skill、多 Agent 与自动化
+
+每个入口由像素图标、标题、2–3 个关键词组成。桌面端 3×2，移动端横向可滚动或单列。这个区块的目的不是装饰，而是帮助“带着具体任务来的读者”更快进入对应章节。
+
+### 6.6 方法路径
+

```

**File**: `package-lock.json` (modified, +19/-39)
```diff
@@ -8,6 +8,8 @@
       "name": "workbuddy-guide",
       "version": "1.0.0",
       "devDependencies": {
+        "@fontsource/silkscreen": "^5.2.8",
+        "@hackernoon/pixel-icon-library": "^1.1.0",
         "mermaid": "11.16.0",
         "vitepress": "1.6.4",
         "vitepress-plugin-mermaid": "2.0.17"
@@ -794,6 +796,23 @@
         "node": ">=12"
       }
     },
+    "node_modules/@fontsource/silkscreen": {
+      "version": "5.2.8",
+      "resolved": "https://registry.npmjs.org/@fontsource/silkscreen/-/silkscreen-5.2.8.tgz",
+      "integrity": "sha512-PfVe2BRZdjY/UIEXsrpzCo/W8FIGo6jEEMHuQiKfma+E5LXb6WfFFBfCEsO89ZWOSwl2mLE1Yq0d8gagmcaBpQ==",
+      "dev": true,
+      "license": "OFL-1.1",
+      "funding": {
+        "url": "https://github.com/sponsors/ayuhito"
+      }
+    },
+    "node_modules/@hackernoon/pixel-icon-library": {
+      "version": "1.1.0",
+      "resolved": "https://registry.npmjs.org/@hackernoon/pixel-icon-library/-/pixel-icon-library-1.1.0.tgz",
+      "integrity": "sha512-VEdDskTYRc37quKh3LFt65nMtriJlxuov/ifOmlomAyfK2hty4IPdL6IIXNvATOaQwZYjlfyxJTCGO+JgWbgIw==",
+      "dev": true,
+      "license": "MIT"
+    },
     "node_modules/@iconify-json/simple-icons": {
       "version": "1.2.89",
       "resolved": "https://registry.npmjs.org/@iconify-json/simple-icons/-/simple-icons-1.2.89.tgz",
@@ -957,9 +976,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -974,9 +990,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -991,9 +1004,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1008,9 +1018,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1025,9 +1032,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1042,9 +1046,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1059,9 +1060,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1076,9 +1074,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1093,9 +1088,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1110,9 +1102,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1127,9 +1116,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1144,9 +1130,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1161,9 +1144,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
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
