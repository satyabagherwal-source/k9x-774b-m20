> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source**: github ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Source Version**: `ac785430`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T22:59:08.165Z  
> **Learning ID**: `learn-github-makecindy-cindy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): makecindy/cindy

> **Canonical Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-03T22:59:07.339Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9152 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/drizzle/scripts/0040_orca_multi_worker_phase1.ts`
```
import type Database from 'better-sqlite3';

/**
 * 0040_orca_multi_worker_phase1 — multi-worker Phase 1(从 GitLab MR !130 迁移,幂等版)。
 *
 * 背景:迁移到 GitHub 仓库时,GitLab 上 MR !130 的迁移占了 0039/0040/0041 三个 slot,
 * 与 GitHub main 已有的 0039_fearless_victor_mancha 撞号(自定义 migrator 按整数
 * schema_version 高水位线 seq>current 应用,撞号会被跳过 → 迁移永不执行)。这里把 GitLab
 * 原作者(苏曼)经 review 的 0039(multi_worker_phase1)+ 0040(rename_workflow_to_team)
 * + 0041(restore_active_team_unique)三条迁移**合并为一条** 0040,挂到 0039 之后。
 *
 * 起点(GitHub main / schema_version=39):orca_workflows 表 + orca_workers.workflow_id
 * 列、无 role/focused/idle_since 列;index 为 uniq_orca_workflows_active_lead_session_id /
 * idx_orca_workflows_status / uniq_orca_workers_session_id / idx_orca_workers_workflow_id /
 * idx_orca_workers_status。
 *
 * 终点(schema.ts):orca_teams 表 + orca_workers.team_id + role/focused/idle_since;
 * index 为 uniq_active_team_per_lead / idx_orca_teams_status / uniq_orca_workers_session_id /
 * uniq_orca_workers_focused_per_team / idx_orca_workers_team_id / idx_orca_workers_status。
 *
 * 全程幂等(目标态检查 + PRAGMA 守卫 + IF EXISTS/IF NOT EXISTS),可重复执行;rename 走
 * "已是目标态则跳过",兼容部分 dev DB 历史上已按旧序号跑过同款 rename 的情况。
 */

function tableExists(db: Database.Database, tableName: string): boolean {
  return (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName) !== undefined
  );
}

function tableColumnNames(db: Database.Database, tableName: string): Set<string> {
  return new Set(
    db
      .prepare(`PRAGMA table_info('${tableName}')`)
      .all()
      .map((row) => String((row as { name: unknown }).name)),
  );
}

function run(db: Database.Database): void {
  // ── 1. rename 表 orca_workflows → orca_teams(目标态检查幂等)──────────────
  if (tableExists(db, 'orca_workflows') && !tableExists(db, 'orca_teams')) {
    db.exec('ALTER TABLE `orca_workflows` RENAME TO `orca_teams`');
  }

  // ── 2. rename 列 orca_workers.workflow_id → team_id(目标态检查幂等)────────
  const colsBeforeRename = tableColumnNames(db, 'orca_workers');
  if (colsBeforeRename.has('workflow_id') && !colsBeforeRename.has('team_id')) {
    db.exec('ALTER TABLE `orca_workers` RENAME COLUMN `workflow_id` TO `team_id`');
  }

  // ── 3. orca_workers 新增列 role / focused / idle_since(PRAGMA 守卫幂等)─────
  const workerCols = tableColumnNames(db, 'orca_workers');
  if (!workerCols.has('role')) {
    db.exec(`ALTER TABLE orca_workers ADD COLUMN role text NOT NULL DEFAULT 'developer'`);
  }
  if (!workerCols.has('focused')) {
    db.exec(`ALTER TABLE orca_workers ADD COLUMN focused integer NOT NULL DEFAULT 0`);
  }
  if (!workerCols.has('idle_since')) {
    db.exec(`ALTER TABLE orca_workers ADD COLUMN idle_since integer`);
  }

  // ── 4. 丢弃 workflow 时代的旧 index(RENAME TABLE/COLUMN 后 index 名不变,需手动改名)──
  db.exec('DROP INDEX IF EXISTS `uniq_orca_workflows_active_lead_session_id`');
  db.exec('DROP INDEX IF EXISTS `idx_orca_workflows_status`');
  db.exec('DROP INDEX IF EXISTS `idx_orca_workers_workflow_id`');
  // 兜底:GitLab 历史中间态可能建过 per_workflow 版本的 focused 唯一索引
  db.exec('DROP INDEX IF EXISTS `uniq_orca_workers_focused_per_workflow`');

  // ── 5. backfill(自身幂等:UPDATE WHERE NULL/'' + 每个 team 首个 worker 恒定)──
  db.prepare(
    `UPDATE orca_workers SET role = 'developer' WHERE role IS NULL OR role = ''`,
  ).run();

  const groups = db
    .prepare(`SELECT DISTINCT team_id AS gid FROM orca_workers`)
    .all() as Array<{ gid: string }>;
  const selectFirst = db.prepare(
    `SELECT id FROM orca_workers WHERE team_id = ? ORDER BY created_at ASC LIMIT 1`,
  );
  const setFocused = db.prepare(`UPDATE orca_workers SET focused = 1 WHERE id = ?`);
  for (const { gid } of groups) {
    const first = selectFirst.get(gid) as { id: string } | undefined;
    if (first) setFocused.run(first.id);
  }

  // ── 6. 建 team 时代的新 index(IF NOT EXISTS 幂等;focused 唯一索引在 backfill 之后建)──
  db.exec('CREATE INDEX IF NOT EXISTS `idx_orca_teams_status` ON `orca_teams` (`status`)');
  db.exec('CREATE INDEX IF NOT EXISTS `idx_orca_workers_team_id` ON `orca_workers` (`team_id`)');
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS `uniq_orca_workers_focused_per_team` '
      + 'ON `orca_workers` (`team_id`) WHERE "orca_workers"."focused" = 1',
  );

  // ── 7. 恢复 active team 唯一约束:先按 lead 去重(保留最新一条,与读路径 dedup 同序),再建索引 ──
  db.exec(`
    UPDATE orca_teams
    SET status = 'cancelled',
        completed_at = CAST(strftime('%s', 'now') AS integer) * 1000,
        updated_at = CAST(strftime('%s', 'now') AS integer) * 1000
    WHERE id IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (
          PARTITION BY lead_session_id ORDER BY updated_at DESC, created_at DESC
        ) AS rn
        FROM orca_teams WHERE status = 'active'
      ) WHERE rn > 1
    )
  `);
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS `uniq_active_team_per_lead` '
      + 'ON `orca_teams` (`lead_session_id`) WHERE "orca_teams"."status" = \'active\'',
  );
}

module.exports = { run };

```

### Core Architecture Module: `apps/desktop/resources/bot-packages/engineer-bot/0.5.2/skills/engineer-bot-evidence/scripts/evidence_check.py`
```
#!/usr/bin/env python3
"""Original offline helper; Python 3.10+ standard library, stdin/stdout only."""
import sys
import json
import math
import hashlib
from datetime import date
from urllib.parse import urlsplit, urlunsplit

def require(ok, message):
    if not ok:
        raise ValueError(message)

def record(value, fields):
    require(isinstance(value, dict) and set(value) == set(fields.split()), "unexpected or missing fields")
    return value

def text(value):
    require(isinstance(value, str) and bool(value.strip()), "nonempty text required")
    return value.strip()

def items(value):
    require(isinstance(value, list) and len(value) <= 10000, "bounded array required")
    return value

def indexed(value):
    result = {}
    for row in items(value):
        require(isinstance(row, dict), "record required")
        key = text(row.get("id"))
        require(key not in result, "duplicate id: " + key)
        result[key] = row
    return result

def day(value):
    return date.fromisoformat(text(value))

def number(value):
    require(type(value) in (float, int) and math.isfinite(value), "finite number required")
    return value

def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "duplicate JSON key")
        out[key] = value
    return out

def compute(data):
    record(data, "head checks evidence")
    head = text(data["head"])
    checks = indexed(data["checks"])
    evidence = indexed(data["evidence"])
    blockers = []
    if not checks:
        blockers.append("NO_CHECKS")
    for key, row in sorted(checks.items()):
        record(row, "id head status")
        require(row["status"] in ("PASS", "FAIL", "NOT_RUN"), "invalid check status")
        if text(row["head"]) != head:
            blockers.append("STALE_CHECK:" + key)
        if row["status"] != "PASS":
            blockers.append(row["status"] + ":" + key)
    if not evidence:
        blockers.append("NO_EVIDENCE")
    for key, row in sorted(evidence.items()):
        record(row, "id head location")
        text(row["location"])
        if text(row["head"]) != head:
            blockers.append("STALE_EVIDENCE:" + key)
    return {"head": head, "status": "BLOCKED" if blockers else "REVIEWABLE",
            "blockers": blockers, "mergeAuthorized": False,
            "note": "Supplied evidence only; no CI or repository queried."}

if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(1048577)
        require(len(raw) <= 1048576, "input exceeds 1 MiB")
        data = json.loads(raw, object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
        print(json.dumps(compute(data), ensure_ascii=False, sort_keys=True, allow_nan=False))
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        print("INVALID_INPUT: " + str(exc), file=sys.stderr)
        raise SystemExit(2)

```

### Core Architecture Module: `apps/desktop/resources/bot-packages/nightly-audit-engineer/0.5.2/skills/nightly-audit-engineer-evidence/scripts/finding_keys.py`
```
#!/usr/bin/env python3
"""Original offline helper; Python 3.10+ standard library, stdin/stdout only."""
import sys
import json
import math
import hashlib
from datetime import date
from urllib.parse import urlsplit, urlunsplit

def require(ok, message):
    if not ok:
        raise ValueError(message)

def record(value, fields):
    require(isinstance(value, dict) and set(value) == set(fields.split()), "unexpected or missing fields")
    return value

def text(value):
    require(isinstance(value, str) and bool(value.strip()), "nonempty text required")
    return value.strip()

def items(value):
    require(isinstance(value, list) and len(value) <= 10000, "bounded array required")
    return value

def indexed(value):
    result = {}
    for row in items(value):
        require(isinstance(row, dict), "record required")
        key = text(row.get("id"))
        require(key not in result, "duplicate id: " + key)
        result[key] = row
    return result

def day(value):
    return date.fromisoformat(text(value))

def number(value):
    require(type(value) in (float, int) and math.isfinite(value), "finite number required")
    return value

def unique_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "duplicate JSON key")
        out[key] = value
    return out

def fingerprint(row):
    record(row, "area rule path rootCause evidence")
    values = [text(row[key]) for key in ("area", "rule", "path", "rootCause")]
    text(row["evidence"])
    require(not values[2].startswith("/") and ".." not in values[2].split("/"), "relative source path required")
    return hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()

def compute(data):
    record(data, "findings previouslySeen")
    seen = set()
    for key in items(data["previouslySeen"]):
        require(isinstance(key, str) and len(key) == 64 and all(c in "0123456789abcdef" for c in key), "invalid fingerprint")
        seen.add(key)
    current, duplicates = {}, []
    for row in items(data["findings"]):
        key = fingerprint(row)
        if key in current:
            duplicates.append(key)
        else:
            current[key] = {"fingerprint": key, "finding": row, "previouslySeen": key in seen}
    return {"findings": [current[k] for k in sorted(current)], "duplicateFingerprints": duplicates,
            "resolution": "NOT_INFERRED", "note": "Exact identity only; root cause and severity require review."}

if __name__ == "__main__":
    try:
        raw = sys.stdin.buffer.read(1048577)
        require(len(raw) <= 1048576, "input exceeds 1 MiB")
        data = json.loads(raw, object_pairs_hook=unique_object,
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))
        print(json.dumps(compute(data), ensure_ascii=False, sort_keys=True, allow_nan=False))
    except (ValueError, TypeError, KeyError, OverflowError) as exc:
        print("INVALID_INPUT: " + str(exc), file=sys.stderr)
        raise SystemExit(2)

```

### Core Architecture Module: `apps/desktop/resources/dmg/render-background.swift`
```
// DMG 安装窗口背景生成器(background.pdf 的唯一来源,改视觉先改这里再重新生成)。
//
// 再生成:在本目录(apps/desktop/resources/dmg)下执行
//   swift render-background.swift
// 直接产出 background.pdf,无需任何后处理。
//
// ── 为什么是 PDF(2026-07-20 实测结论,当时社区无人发现)──
// macOS 26 (Tahoe) Finder 对位图背景只按 1px=1pt 绘制且拒绝一切高清投喂
// (144dpi PNG/TIFF/JPEG/HEIC、多页 HiDPI TIFF、>990px 宽图全部静默不渲染),
// 位图背景在 Retina 上必然发虚。但 Finder 会按 Retina backing scale 光栅化
// **PDF 背景**:矢量元素无限清晰,PDF 内嵌的高清位图(914px 立绘 → 219pt 盒)
// 也能吃到 2x 密度——这是 macOS 26 上唯一的高清通道。
//
// ── PDF 上下文的两个坑(改动时别踩)──
// 1. sourceIn 等 blend mode 在 PDF 上下文不生效:mask 着色(如手写体)必须
//    先离屏渲染成位图再嵌入,本脚本 tintedScript() 即为此;
// 2. 超缓渐变(几个百分点亮度跨数百 pt)PDF 光栅化无抖动会出横向色带:
//    主底用纯色,渐变只用于短跨度、大色差的边缘渐白。
//
// ── 画布策略(同位图时代 v2)──
// 画布 900×610pt > 默认窗口 660×460;内容锚定左上 660×460 设计区,右/下延伸区
// 渐隐到纯白,与 Finder 窗口白底衔接,用户拉大窗口看到过渡而非接缝
// (Finder 按 1pt=1pt 左上锚定裁切绘制,不缩放)。
//
// 布局坐标与 scripts/ci/lib.mjs 的 createMacDMG settings 联动:窗口 660×460,
// 图标行中心 y=335(app x=175 / Applications x=485),箭头画在两图标之间;
// 品牌块按 SplashScreen.tsx 布局等比 0.48 缩放。改动要两边同步。
import AppKit

let W: CGFloat = 900, H: CGFloat = 610   // 画布 = PDF 页面(pt)
let DW: CGFloat = 660, DH: CGFloat = 460 // 设计区 = 默认窗口尺寸

// Splash 素材(与启动画面同源,高清:立绘 914²、字标 459×156、手写体 907×259)
let ASSETS = "../../src/renderer/assets/splash"

func img(_ name: String) -> NSImage {
    guard let i = NSImage(contentsOfFile: "\(ASSETS)/\(name)") else {
        fatalError("missing asset \(ASSETS)/\(name) — 请在 apps/desktop/resources/dmg 目录下运行")
    }
    return i
}

/// script.png 是 alpha mask,按 splash 浅色规格 #949AA2 离屏着色(PDF 里 sourceIn 无效)
func tintedScript() -> NSImage {
    let src = img("script.png")
    let w = 907, h = 259
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: w, pixelsHigh: h,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .calibratedRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    let ctx = NSGraphicsContext(bitmapImageRep: rep)!
    NSGraphicsContext.current = ctx
    src.draw(in: NSRect(x: 0, y: 0, width: w, height: h))
    ctx.cgContext.setBlendMode(.sourceIn)
    NSColor(calibratedRed: 0.580, green: 0.600, blue: 0.635, alpha: 1).setFill()
    NSRect(x: 0, y: 0, width: w, height: h).fill()
    NSGraphicsContext.restoreGraphicsState()
    let out = NSImage(size: NSSize(width: w, height: h))
    out.addRepresentation(rep)
    return out
}

let url = URL(fileURLWithPath: "background.pdf") as CFURL
var mediaBox = CGRect(x: 0, y: 0, width: W, height: H)
let cg = CGContext(url, mediaBox: &mediaBox, nil)!
cg.beginPDFPage(nil)
let ns = NSGraphicsContext(cgContext: cg, flipped: false)
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = ns
ns.imageInterpolation = .high

// 浅色 surface 纯色底(splash flat --surface 浅色系;不用渐变,防 PDF banding)
NSColor(calibratedRed: 0.929, green: 0.929, blue: 0.929, alpha: 1).setFill()
NSRect(x: 0, y: H - DH, width: W, height: DH).fill()
// 底部延伸带(y>460 才可见):渐隐到白,接 Finder 窗口白底
NSGradient(
    starting: NSColor(calibratedRed: 0.929, green: 0.929, blue: 0.929, alpha: 1),
    ending: NSColor.white
)!.draw(in: NSRect(x: 0, y: 0, width: W, height: H - DH), angle: -90)
// 右侧白色渐隐罩(x>660 才可见)
NSGradient(
    starting: NSColor(calibratedWhite: 1, alpha: 0),
    ending: NSColor(calibratedWhite: 1, alpha: 1)
)!.draw(in: NSRect(x: 680, y: 0, width: W - 680, height: H), angle: 0)

// 从顶部量的 rect → AppKit 坐标(画布顶 = 窗口顶)
func rectTop(_ x: CGFloat, _ topY: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
    NSRect(x: x, y: H - topY - h, width: w, height: h)
}

// ── 品牌块(SplashScreen.tsx 布局等比 0.48,块中心 x=330)──
let S: CGFloat = 0.48
let illusSize = 457 * S
let blockLeft = DW / 2 - illusSize / 2
let blockTop: CGFloat = 14

// 少女立绘(自带 alpha 渐隐,融进 surface 底)
img("illustration.webp").draw(in: rectTop(blockLeft, blockTop, illusSize, illusSize))

// CINDY 深色字标:叠在立绘下三分之一,水平居中
let wmW = 229.5 * S, wmH = 78 * S
img("wordmark-light.png").draw(in: rectTop(DW / 2 - wmW / 2, blockTop + 352.5 * S, wmW, wmH))

// 手写体 "Dream it Create it":字标右缘,略与字标底部交叠
let scW = 225.5 * S, scH = 89.5 * S
tintedScript().draw(in: rectTop(blockLeft + 352.25 * S, blockTop + 410 * S, scW, scH))

// ── 拖拽引导箭头(矢量;图标行中心 y=335)──
let ay = H - 335
let arrow = NSBezierPath()
arrow.lineWidth = 5.5
arrow.lineCapStyle = .round
arrow.lineJoinStyle = .round
arrow.move(to: NSPoint(x: 300, y: ay))
arrow.line(to: NSPoint(x: 360, y: ay))
arrow.move(to: NSPoint(x: 342, y: ay + 16))
arrow.line(to: NSPoint(x: 360, y: ay))
arrow.line(to: NSPoint(x: 342, y: ay - 16))
NSColor(calibratedWhite: 0.62, alpha: 1).setStroke()
arrow.stroke()

NSGraphicsContext.restoreGraphicsState()
cg.endPDFPage()
cg.closePDF()
print("wrote background.pdf")

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/cindy-ai-identity/state.ts`
```
import type { ProviderView } from '@cindy/model-providers';
import i18n from '../../../src/renderer/i18n';
import { cindyAiAccountName, cindyAiAccountLogoKind } from '../../../src/shared/cindyAiPresentation';

// Stubbed hooks are separate modules; share only this public fixture selector.
const fixtureState = globalThis as typeof globalThis & { __cindyAiScenario?: string };
export const setScenario = (value: string) => { fixtureState.__cindyAiScenario = value === 'default' ? 'personal' : value; };
const user = () => fixtureState.__cindyAiScenario === 'personal'
  ? { membershipKind: 'personal' as const, orgSlug: null, orgName: null }
  : { membershipKind: 'org' as const, orgSlug: fixtureState.__cindyAiScenario === 'xd' ? 'xd' : 'example', orgName: 'Example International Game Studio' };

export const useAuth = () => ({ mode: 'cloud', dataOwnerId: 'fixture', dataOwnerGeneration: 1, user: user() });
export const useOptionalAuthDeviceId = () => 'fixture-device';
export const useOptionalAuthUser = () => user();
export const useProviders = () => ({
  providers: [{
    id: 'xd', name: cindyAiAccountName(user(), key => i18n.t(key)), source: 'builtin',
    logoKind: cindyAiAccountLogoKind(user()),
    agents: ['codex'], auth: { method: 'managed' }, routing: { codex: {} }, connected: true,
    models: { codex: [{ id: 'auto', name: 'Auto', group: 'gpt', contextWindow: 272000, efforts: [] }] },
  } as ProviderView],
  providerOrder: ['xd'], ownerGeneration: 1, loading: false, refetch: async () => true,
});
export const useApiKey = () => ({ key: 'fixture-key', hasSavedKey: true, clearKey: async () => true });
export const useModelAccessStatus = () => ({ state: 'ok', source: 'server', accountTier: null, endpoint: null });
export const useModelAccessCreditUsageResult = () => ({ usage: null, loading: false, refresh: async () => {} });
export const useClaudeAccountUsageResult = () => ({ usage: null, unlimited: true, loading: false, refresh: async () => {} });
export const useXdAssetPrimaryAction = () => null;
export const isChatGptConnectionConnected = () => false;
export const useCodexAuth = () => ({ state: { kind: 'unauthenticated' }, recoveryCheck: 'idle', refresh: async () => {} });

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/orca-worker-project/ui-page.mjs`
```
import assert from 'node:assert/strict';
export default {
  name: 'orca-worker-project',
  entry: './worker-project-fixture.tsx',
  viewport: { width: 560, height: 640 },
  real: 'WorkerProjectField, selection hook, FolderPickerPopover, BranchWorktreeChip, RolePillDropdown, themes, fonts and five locales',
  notCovered:
    'Full Worker creation popover, model/device selection, native folder dialog, filesystem discovery, IPC and actual worktree creation',
  cases: {
    'attention-error': {
      about: 'Idle Worker with unhandled task error in tabs, both menus and collapsed trigger',
    },
    'attention-awaiting': {
      about: 'Waiting confirmation shown as blue avatar dots including collapsed trigger',
    },
    'attention-done': {
      about:
        'Completion unread stays green for unselected Worker and does not aggregate on trigger',
    },
    default: {
      about:
        'Inherited Lead worktree, new-worktree branch chooser, project search and dirty other project',
    },
    'same-repo': {
      about:
        'Browsing the main checkout preserves that selection; current-project row restores inherited worktree',
    },
    'browse-error': { about: 'Native folder dialog failure leaves the current project usable' },
    missing: { about: 'Missing directory explains why creation cannot continue' },
    empty: { about: 'Empty repository explains why worktree creation is unavailable' },
    detached: {
      about: 'Detached HEAD is displayed as a short SHA and allows choosing a real branch',
    },
    workers: { about: 'Worker project badge appears only for the other project' },
    dialogue: { about: 'Dialogue Lead hides checkbox until a Git project is selected' },
  },
  async ready(page) {
    await page.getByRole('button').first().waitFor();
  },
  async check(page, ui) {
    if (ui.case.startsWith('attention-')) {
      const key =
        ui.case === 'attention-error'
          ? 'errorBadgeAria'
          : ui.case === 'attention-awaiting'
            ? 'awaitingBadgeAria'
            : 'unread';
      const label = await ui.t(`orca.rolePill.${key}`);
      await page.getByTestId('attention-tabs').getByLabel(label).waitFor();
      const dropdown = page.getByTestId('attention-dropdown');
      if (ui.case !== 'attention-done') await dropdown.getByLabel(label).waitFor();
      await ui.capture('tabs-and-collapsed');
      await dropdown.getByRole('button', { name: /frontend/ }).click();
      // ERR 是行按钮的相邻徽章；蓝 / 绿点在按钮头像里。
      if (ui.case === 'attention-error') assert.equal(await dropdown.getByLabel(label).count(), 2);
      else
        await dropdown
          .getByRole('button', { name: /reviewer/ })
          .getByLabel(label)
          .waitFor();
      await ui.capture('dropdown-list');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: await ui.t('orca.rolePill.layoutMenuLabel') }).click();
      await ui.capture('layout-menu-list');
      return;
    }
    if (ui.case === 'workers') {
      await page.getByRole('button', { name: /frontend/ }).click();
      await page.getByText('design-system', { exact: true }).first().waitFor();
      await ui.capture('worker-project-badge');
      return;
    }
    const current = await ui.t('orca.workerProject.current');
    const checkbox = page.getByRole('checkbox');
    if (ui.case === 'same-repo') {
      await page.getByRole('button', { name: current, exact: true }).click();
      await page
        .getByRole('button', { name: await ui.t('newChat.folderPicker.browseProjectFolder') })
        .click();
      await page
        .getByText(await ui.t('orca.workerProject.direct', { project: 'cindy', branch: 'main' }))
        .waitFor();
      await ui.capture('explicit-main-checkout');
      await page.getByText(await ui.t('orca.workerProject.newWorktree'), { exact: true }).click();
      const sourceBranch = page.getByRole('button', {
        name: await ui.t('newChat.branchChip.label'),
        exact: true,
      });
      assert.equal(await sourceBranch.textContent(), 'main');
      await ui.capture('same-repo-source-branch');
      await page.getByRole('button', { name: 'cindy', exact: true }).click();
      await page.getByRole('button', { name: 'cindy /projects/cindy', exact: true }).click();
      await page.getByRole('button', { name: current, exact: true }).waitFor();
      await ui.capture('restored-inherited-worktree');
      return;
    }
    if (ui.case === 'browse-error') {
      await page.getByRole('button', { name: current, exact: true }).click();
      await page
        .getByRole('button', { name: await ui.t('newChat.folderPicker.browseProjectFolder') })
        .click();
      await page
        .getByRole('alert')
        .getByText(await ui.t('newChat.folderPicker.browseFailed'))
        .waitFor();
      await ui.capture('native-folder-error');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: current, exact: true }).waitFor();
      assert.equal(
        await page.getByText(await ui.t('ccAgent.common.loading'), { exact: true }).count(),
        0,
      );
      await ui.capture('native-folder-error-dismissed');
      return;
    }
    if (ui.case === 'missing') {
      assert.equal(await checkbox.count(), 0);
      await page
        .getByRole('status')
        .getByText(await ui.t('orca.workerProject.missingDirectory'))
        .waitFor();
      assert.equal(
        await page
          .getByText(
            await ui.t('orca.workerProject.notGit', { directory: '/projects/missing-project' }),
            { exact: true },
          )
          .count(),
        0,
      );
      await ui.capture('missing-directory');
      return;
    }
    if (ui.case === 'empty') {
      assert.equal(await checkbox.count(), 0);
      await page
        .getByText(await ui.t('orca.workerProject.emptyRepo', { directory: '/projects/cindy' }))
        .waitFor();
      await ui.capture('empty-repository');
      return;
    }
    const detachedLabel = await ui.t('orca.workerProject.detachedHead', { sha: 'abcdef01' });
    const sourceLabel = ui.case === 'detached' ? detachedLabel : 'feat/worker-project-picker';
    if (ui.case === 'dialogue') assert.equal(await checkbox.count(), 0);
    else {
      await page.getByText(await ui.t('orca.workerProject.newWorktree'), { exact: true }).click();
      await page
        .getByText(await ui.t('orca.workerProject.splitWarning', { branch: sourceLabel }))
        .waitFor();
      await ui.capture('new-worktree');
      await page
        .getByRole('button', { name: await ui.t('newChat.branchChip.label'), exact: true })
        .click();
      await page.getByRole('option', { name: 'main', exact: true }).waitFor();
      await ui.capture('branches');
      if (ui.case === 'detached') {
        await page.getByRole('option', { name: 'main', exact: true }).click();
        const branchButton = page.getByRole('button', {
          name: await ui.t('newChat.branchChip.label'),
          exact: true,
        });
        assert.equal(await branchButton.textContent(), 'main');
        await ui.capture('detached-pick-branch');
      } else await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: current, exact: true }).click();
    await page.getByRole('textbox').waitFor();
    assert.equal(
      await page.getByText(await ui.t('newChat.folderPicker.dialogue'), { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole('button', { name: await ui.t('newChat.folderPicker.removeFromList') })
        .count(),
      0,
    );
    await ui.capture('projects');
    await page.getByRole('textbox').fill('design-system');
    await page.getByText('design-system', { exact: true }).click();
    await page.getByText(await ui.t('orca.workerProject.dirty')).waitFor();
    assert.equal(await checkbox.isChecked(), false, 'project changes reset worktree selection');
    if (ui.case === 'detached') {
      await page
        .getByText(
          await ui.t('orca.workerProject.directDetached', {
            project: 'design-system',
            branch: detachedLabel,
          }),
        )
        .waitFor();
    }
    await ui.capture('other-project');
    await page.getByText(await ui.t('orca.workerProject.newWorktree'), { exact: true }).click();
    const rememberedBranch = page.getByRole('button', {
      name: await ui.t('newChat.branchChip.label'),
      exact: true,
    });
    assert.equal(await rememberedBranch.textContent(), 'release/v2');
    await ui.capture('remembered-source-branch');
  },
};

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/orca-worker-project/worker-project-fixture.tsx`
```
import { useEffect } from 'react';
import {
  addSessionAttention,
  clearSessionAttention,
} from '../../../src/renderer/lib/sessionAttentionStore';
import {
  markWorkerAttention,
  clearWorkerAttention,
} from '../../../src/renderer/features/cc-agent/lib/workerAttentionStore';
import {
  RolePillDropdown,
  WorkerListToolbar,
} from '../../../src/renderer/features/cc-agent/RolePillDropdown';
import type { WorkerInfo } from '../../../src/renderer/features/cc-agent/hooks/useWorkers';
import { mountPage } from '../../ui-page/harness';
import {
  WorkerProjectField,
  useWorkerProjectSelection,
} from '../../../src/renderer/features/cc-agent/WorkerProjectField';
import type {
  WorkerProjectContext,
  WorkerProjectInfo,
} from '../../../src/shared/orca-worker-project';

const inherited: WorkerProjectInfo = {
  directory: '/projects/cindy/.cindy-worktrees/worker-picker',
  baseRepo: '/projects/cindy',
  branch: 'feat/worker-project-picker',
  headState: 'branch',
  exists: true,
  dirty: true,
  isWorktree: true,
};
const projects = [
  'cindy',
  'design-system',
  'mobile-app',
  'website',
  'notes',
  'missing-project',
].map((name) => ({
  path: `/projects/${name}`,
  name,
  description: `/projects/${name}`,
  missing: name === 'missing-project',
}));
function Fixture() {
  const selection = useWorkerProjectSelection(true, 'fixture-lead', true);
  return (
    <main className="mx-auto w-full max-w-[440px] p-4">
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
        <WorkerProjectField selection={selection} disabled={false} />
      </div>
    </main>
  );
}
const workers: WorkerInfo[] = ['frontend', 'reviewer'].map((role, index) => ({
  workerId: role,
  sessionId: role,
  role,
  agent: 'codex',
  model: 'gpt-5',
  effort: 'high',
  label: null,
  status: 'idle',
  focused: index === 0,
  idleSince: null,
}));
function WorkersFixture() {
  return (
    <main className="mx-auto w-full max-w-[440px] p-4">
      <RolePillDropdown
        worker={workers[0]}
        workers={workers}
        selectedWorkerId="frontend"
        activeWorkerCount={2}
        onSwitchFocus={() => {}}
        onArchiveWorker={() => {}}
      />
    </main>
  );
}
/** 真实 store 驱动提醒，Worker 运行状态始终 idle，以覆盖原来的漏报。 */
function AttentionFixture({ kind }: { kind: 'error' | 'awaiting' | 'done' }) {
  useEffect(() => {
    if (kind === 'done') markWorkerAttention('reviewer');
    else addSessionAttention('reviewer', kind);
    return () => {
      clearSessionAttention('reviewer', { intent: 'explicit' });
      clearWorkerAttention('reviewer');
    };
  }, [kind]);
  return (
    <main className="mx-auto w-full max-w-[480px] space-y-12 p-5">
      <section data-testid="attention-tabs">
        <WorkerListToolbar
          worker={workers[0]}
          workers={workers}
          selectedWorkerId="frontend"
          activeWorkerCount={2}
          softLimit={5}
          hardLimit={8}
          clearAttentionWhenVisible={false}
          onSwitchFocus={() => {}}
          onArchiveWorker={() => {}}
          onOpenCreate={() => {}}
          onOpenSettings={() => {}}
        />
      </section>
      <section data-testid="attention-dropdown">
        <RolePillDropdown
          worker={workers[0]}
          workers={workers}
          selectedWorkerId="frontend"
          activeWorkerCount={2}
          onSwitchFocus={() => {}}
          onArchiveWorker={() => {}}
        />
      </section>
    </main>
  );
}
void mountPage({
  host: (ctx) => ({
    notificationMarkSessionAttention: async () => {},
    notificationClearSessionAttention: async () => {},
    showOpenDirectoryDialog: async () => {
      if (ctx.case === 'same-repo') return { canceled: false, path: '/projects/cindy' };
      throw new Error('fixture dialog unavailable');
    },
    localDb: {
      orcaWorkflows: {
        projectLabel: async (id: string) =>
          id === 'frontend' ? { name: 'design-system', path: '/projects/design-system' } : null,
        projectContext: async (
          _id: string,
          directory?: string,
        ): Promise<WorkerProjectContext | WorkerProjectInfo> => {
          const lead =
            ctx.case === 'missing'
              ? {
                  ...inherited,
                  directory: '/projects/missing-project',
                  baseRepo: null,
                  branch: null,
                  exists: false,
                  isWorktree: false,
                  dirty: false,
                }
              : ctx.case === 'dialogue'
                ? {
                    ...inherited,
                    baseRepo: null,
                    branch: null,
                    directory: '/tasks/dialogue',
                    isWorktree: false,
                  }
                : ctx.case === 'empty'
                  ? {
                      ...inherited,
                      directory: '/projects/cindy',
                      branch: null,
                      headState: 'unborn' as const,
                      isWorktree: false,
                    }
                  : ctx.case === 'detached'
                    ? {
                        ...inherited,
                        branch: 'abcdef0123456789abcdef0123456789abcdef0123',
                        headState: 'detached' as const,
                      }
                    : inherited;
          const selected = directory
            ? {
                ...inherited,
                directory,
                baseRepo: directory,
                branch: ctx.case === 'detached' ? lead.branch : 'main',
                headState: ctx.case === 'detached' ? lead.headState : ('branch' as const),
                isWorktree: false,
              }
            : lead;
          if (directory) return selected;
          return {
            recordedDirectory: ctx.case === 'dialogue' ? lead.directory : '/projects/cindy',
            inherited: lead,
            selected,
            dialogue: ctx.case === 'dialogue',
            projects,
          };
        },
      },
    },
    worktreeBranchSyncStatus: async ({ branch }: { branch: string }) => ({
      branch,
      remote: 'origin',
      remoteBranch: branch,
      remoteOnly: false,
      ahead: 0,
      behind: 3,
      dirtyFiles: 2,
      checkoutPath: inherited.directory,
    }),
    worktreeSyncBranch: async ({ branch }: { branch: string }) => ({
      updated: 3,
      status: {
        branch,
        remote: 'origin',
        remoteBranch: branch,
        remoteOnly: false,
        ahead: 0,
        behind: 0,
        dirtyFiles: 2,
      },
    }),
    getNewMakerWorktreeBranchPreference: async (baseRepo: string) =>
      ['/projects/design-system', '/projects/cindy'].includes(baseRepo)
        ? { baseRepo, sourceBranch: 'release/v2', revision: 1 }
        : null,
    worktreeListBranches: async () => ({
      remoteDefaultBranch: 'refs/remotes/origin/main',
      branches: ['main', 'feat/worker-project-picker', 'release/v2'],
    }),
  }),
  render: (ctx) => {
    if (ctx.case.startsWith('attention-')) {
      localStorage.setItem('orca-worker-list-layout-v1', 'tabs');
      return (
        <AttentionFixture
          kind={
            ctx.case === 'attention-error'
              ? 'error'
              : ctx.case === 'attention-awaiting'
                ? 'awaiting'
                : 'done'
          }
        />
      );
    }
    return ctx.case === 'workers' ? <WorkersFixture /> : <Fixture />;
  },
});

```

### Core Architecture Module: `apps/desktop/scripts/provider-ui-lifecycle-e2e.mjs`
```
import { assertProviderE2EProfile } from './provider-e2e-profile.mjs';
// Real Desktop UI, IPC, SQLite and loopback server; fake keys only.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url);
assert.ok(/CindyGlobal-dev2-provider-auto-detection-[^/]+\/cindy-local-v1\.db$/.test(process.env.E2E_DB??''));
const db=new (require('better-sqlite3'))(process.env.E2E_DB,{readonly:true});
const out=await fs.mkdtemp(path.join(os.tmpdir(),'cindy-provider-ui-lifecycle-'));
const wires=['openai-chat','openai-responses','anthropic-messages','google-generative-ai'];
const model='e2e-lifecycle-model';
const records=[],created=[],requests=[],held=[];
let desired=wires[0],hold=false,reject=false;
function frames(wire) {
  const events = wire === 'openai-responses' ? [
    { type: 'response.created', response: { id: 'reply' } },
    { type: 'response.output_item.added', output_index: 0, item: { id: 'msg', type: 'message', role: 'assistant', content: [] } },
    { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'OK' },
    { type: 'response.completed', response: { id: 'reply', status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 1 } } },
  ] : wire === 'anthropic-messages' ? [
    { type: 'message_start', message: { id: 'reply', model, role: 'assistant', type: 'message', content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
    { type: 'message_stop' },
  ] : wire === 'google-generative-ai' ? [{ candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }] }] : [{ id: 'reply', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' } }] },
    { id: 'reply', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }];
  return events;
}
const encode = events => events.map(e => `${e.type ? `event: ${e.type}\n` : ''}data: ${JSON.stringify(e)}\n\n`).join('');

const server=http.createServer(async(req,res)=>{
 const parts=[];for await(const p of req)parts.push(p);
 const url=new URL(req.url,'http://fixture');
 const json=(body,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))};
 if(req.method==='GET')return url.pathname.endsWith('/models')?json({data:[{id:model}]}):json({error:'not found'},404);
 const wire=url.pathname.endsWith('/chat/completions')?wires[0]:url.pathname.endsWith('/responses')?wires[1]:url.pathname.endsWith('/messages')?wires[2]:wires[3];
 const requestModel=JSON.parse(Buffer.concat(parts).toString()||'{}').model??decodeURIComponent(url.pathname.split('/models/')[1]?.split(':')[0]??'');
 if(requestModel!==model)return json({error:'unexpected model'},400);
 const row={path:url.pathname,wire,model:requestModel,engine:req.headers['x-e2e-engine'],closed:false,key:req.headers.authorization??req.headers['x-api-key']??req.headers['x-goog-api-key']};
 requests.push(row);res.on('close',()=>{row.closed=true});
 const respond=()=>{if(res.destroyed)return;if(reject||wire!==desired)return json({error:{code:'unsupported_protocol',message:'protocol not supported'}},400);res.writeHead(200,{'content-type':'text/event-stream'});res.end(encode(frames(wire)))};
 if(hold)held.push(respond);else respond();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,page;
const row=id=>db.prepare('SELECT * FROM custom_providers WHERE id=?').get(id.replace(/^custom:/,''));
const persist=async()=>fs.writeFile(path.join(out,'results.json'),JSON.stringify({records,created,requests},null,2));
async function record(name,details={}){records.push({name,pass:true,...details});await persist();if(await page.getByRole('dialog').count())await page.getByRole('dialog').screenshot({path:path.join(out,name+'.png')});console.log('PASS',name)}
async function closeDialog(){if(await page.getByRole('dialog').count()){await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})}}
async function open(name,base=origin+'/team/v1'){
 await closeDialog();await page.getByRole('button',{name:'添加供应商',exact:true}).click();await page.getByText('自定义端点',{exact:true}).click();
 await page.getByPlaceholder('我的 AI 供应商').fill(name);await page.getByPlaceholder('API 密钥',{exact:true}).fill('fake-lifecycle-key');await page.getByPlaceholder('https://api.myprovider.com/v1').fill(base);
 await page.getByText(model+' 自动识别',{exact:true}).waitFor();
}
async function success(){await page.getByText(/^连接成功（/).waitFor()}
async function test(){await page.getByRole('dialog').getByRole('button',{name:'测试连接',exact:true}).click()}
async function save(name){await page.getByRole('button',{name:'保存供应商',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 const provider=await page.evaluate(async name=>(await window.electronAPI.maker.listProviders()).providers.find(p=>p.name===name),name);assert.ok(provider);created.push(provider.id);await persist();return provider}
async function edit(name){await page.getByRole('button').filter({hasText:name}).first().click();await page.getByRole('button',{name:'更多操作',exact:true}).click();await page.getByRole('menuitem',{name:'编辑连接设置',exact:true}).click();await page.getByPlaceholder('我的 AI 供应商').waitFor()}
try{
 browser=await chromium.connectOverCDP(process.env.E2E_CDP_URL ?? 'http://127.0.0.1:19427');await assertProviderE2EProfile(browser,process.env.E2E_DB);page=browser.contexts()[0].pages().find(p=>p.url().includes('/#/settings'));assert.ok(page);page.setDefaultTimeout(15000);
 for(const action of ['legacy','id'].includes(process.env.E2E_ONLY)?[]:['stop','close','address','key']){
  await open('E2E lifecycle '+action);desired=wires[0];hold=true;const start=requests.length;await test();
  while(requests.length===start)await page.waitForTimeout(20);
  if(action==='stop')await page.getByRole('button',{name:'停止测试',exact:true}).click();
  if(action==='close')await closeDialog();
  if(action==='address')await page.getByPlaceholder('https://api.myprovider.com/v1').fill(origin+'/new/v1');
  if(action==='key')await page.getByPlaceholder('API 密钥',{exact:true}).fill('fake-new-key');
  await page.waitForTimeout(250);assert.equal(requests[start].closed,true,'old request must be aborted');
  hold=false;
  if(action==='close')await open('E2E lifecycle reopen');
  await test();await success();const before=await page.getByPlaceholder('https://api.myprovider.com/v1').inputValue();
  for(const release of held.splice(0))release();await page.waitForTimeout(300);
  assert.equal(await page.getByPlaceholder('https://api.myprovider.com/v1').inputValue(),before);await success();
  assert.equal(requests.length-start,2);if(action==='key')assert.equal(requests.at(-1).key,'Bearer fake-new-key');if(action==='address')assert.equal(requests.at(-1).path,'/new/v1/chat/completions');await record('cancel-'+action,{requests:requests.slice(start)});
 }
 for(const wire of ['legacy','id'].includes(process.env.E2E_ONLY)?[]:wires){
  desired=wire;const name='E2E auto '+wires.indexOf(wire)+' '+Date.now();await open(name);const start=requests.length;await test();await success();
  assert.deepEqual(requests.slice(start).map(r=>r.wire),wires.slice(0,wires.indexOf(wire)+1));
  const base=await page.getByPlaceholder('https://api.myprovider.com/v1').inputValue();const again=requests.length;await test();await success();assert.equal(requests.length-again,1);assert.equal(requests.at(-1).wire,wire);
  const p=await save(name);const stored=JSON.parse(row(p.id).runtimes);assert.equal(stored.pi.wireProtocol,wire);assert.equal(stored.pi.baseUrl,base);assert.equal(stored.pi.models[0].route.wireProtocol,wire);
  await page.reload();await page.getByRole('button',{name:'添加供应商',exact:true}).waitFor();await edit(name);assert.equal(await page.getByPlaceholder('https://api.myprovider.com/v1').inputValue(),base);
  const last=requests.length;await test();await success();assert.equal(requests.length-last,1);assert.equal(requests.at(-1).wire,wire);await closeDialog();
  const result=await page.evaluate(id=>window.electronAPI.maker.testProviderConnection({kind:'saved',providerId:id,agent:'pi'}),p.id);assert.equal(result.ok,true,JSON.stringify(result));assert.equal(requests.at(-1).wire,wire);
  await record('auto-save-reopen-call-'+wire,{base,stored});
 }
 if(!['legacy','id'].includes(process.env.E2E_ONLY)){desired=wires[0];const manual='E2E manual '+Date.now();await open(manual);const count=requests.length;const manualProvider=await save(manual);assert.equal(requests.length,count);assert.equal(JSON.parse(row(manualProvider.id).runtimes).pi.wireProtocol,wires[0]);await record('manual-save-without-probe');}
 if(!process.env.E2E_ONLY||process.env.E2E_ONLY==='id'){
  desired=wires[0];
  const prefix=('E2E long '+Date.now()+' ').padEnd(40,'a');
  for(const ending of ['', ' first', ' second']){
   const name=prefix+ending;await open(name);const p=await save(name);
   assert.ok(p.id.length<=40);assert.equal(row(p.id).name,name);
   await page.reload();await page.getByRole('button',{name:'添加供应商',exact:true}).waitFor();await edit(name);
   assert.equal(await page.getByPlaceholder('我的 AI 供应商').inputValue(),name);
   await page.getByRole('button',{name:'保存',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(row(p.id).name,name,'editing preserves the ID and display
```

### Core Architecture Module: `apps/desktop/scripts/render-recovery/renderer.js`
```
// Synthetic content only. No continuous animation/DOM updates: those would prevent
// the delayed frame eviction that electron/electron#42378 describes.
let clicks = 0;
let timerTicks = 0;
const visibilityEvents = [];
setInterval(() => {
  timerTicks += 1;
}, 1000);
document.addEventListener('visibilitychange', () => {
  visibilityEvents.push({ at: Date.now(), state: document.visibilityState });
});
document.getElementById('input').addEventListener('click', (event) => {
  if (!event.isTrusted) return;
  clicks += 1;
  event.currentTarget.textContent = `Input probe: ${clicks}`;
});
window.readProbe = () => ({
  clicks,
  timerTicks,
  visibility: document.visibilityState,
  visibilityEvents,
});
window.probeFrame = () =>
  new Promise((resolve) => {
    const startedAt = performance.now();
    const raf = requestAnimationFrame(() => {
      clearTimeout(timeout);
      resolve({ arrived: true, elapsedMs: performance.now() - startedAt });
    });
    const timeout = setTimeout(() => {
      cancelAnimationFrame(raf);
      resolve({ arrived: false, elapsedMs: performance.now() - startedAt });
    }, 2500);
  });

```

### Core Architecture Module: `apps/desktop/scripts/render-recovery/run.mjs`
```
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const outputDir = process.env.RENDER_PROBE_OUTPUT
  ? path.resolve(process.env.RENDER_PROBE_OUTPUT)
  : await mkdtemp(path.join(os.tmpdir(), 'cindy-render-results-'));
const installDir = process.env.RENDER_PROBE_ELECTRON_DIR;
const require = createRequire(
  installDir ? path.join(path.resolve(installDir), 'package.json') : import.meta.url,
);
const electron = require('electron');
const env = {
  ...process.env,
  RENDER_PROBE_OUTPUT: outputDir,
  RENDER_PROBE_IDLE_SECONDS: process.env.RENDER_PROBE_IDLE_SECONDS ?? '900',
  RENDER_PROBE_HIDDEN_SECONDS: process.env.RENDER_PROBE_HIDDEN_SECONDS ?? '3',
  RENDER_PROBE_SCENARIO: process.env.RENDER_PROBE_SCENARIO ?? 'minimize',
  RENDER_PROBE_SURFACE: process.env.RENDER_PROBE_SURFACE ?? 'window',
};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
const idleSeconds = Number(env.RENDER_PROBE_IDLE_SECONDS);
const hiddenSeconds = Number(env.RENDER_PROBE_HIDDEN_SECONDS);
if (
  !Number.isInteger(idleSeconds) ||
  idleSeconds < 1 ||
  idleSeconds > 1800 ||
  !Number.isInteger(hiddenSeconds) ||
  hiddenSeconds < 1 ||
  hiddenSeconds > 8100
) {
  throw new Error('Invalid probe durations: idle 1..1800, hidden 1..8100 seconds');
}
const profile = await mkdtemp(path.join(os.tmpdir(), 'cindy-render-probe-'));
env.RENDER_PROBE_PROFILE = profile;
await mkdir(outputDir, { recursive: true });
// A reused local output directory must not supply evidence from an earlier run.
for (const file of ['report.json', 'events.jsonl', 'baseline.png', 'after-idle.png']) {
  await rm(path.join(outputDir, file), { force: true });
}
process.stdout.write(`Render probe output: ${outputDir}\n`);
const child = spawn(electron, [fileURLToPath(new URL('./main.cjs', import.meta.url))], {
  env,
  stdio: 'inherit',
});
const timeout = setTimeout(() => child.kill(), (idleSeconds + hiddenSeconds + 90) * 1000);
const exitCode = await new Promise((resolve) => {
  child.once('error', () => resolve(2));
  child.once('close', (code) => resolve(code ?? 2));
});
clearTimeout(timeout);
let resultExitCode = exitCode;
try {
  const report = JSON.parse(await readFile(path.join(outputDir, 'report.json'), 'utf8'));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== 'passed' && resultExitCode === 0) resultExitCode = 2;
  if (process.env.GITHUB_STEP_SUMMARY) {
    const final = report.samples?.at(-1);
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `Electron ${report.electron}: **${report.status}**`,
        '',
        `Scenario: ${report.scenario}; surface: ${report.surface}; idle: ${idleSeconds}s; hidden: ${hiddenSeconds}s.`,
        '',
        `Final pixels: ${final?.pixelsMatch ?? 'unknown'}; input: ${final?.inputResponded ?? 'unknown'}; rAF: ${final?.frame?.arrived ?? 'unknown'}.`,
        '',
        'Synthetic Electron fixture only. A pass does not prove Cindy #5627 is fixed.',
        '',
      ].join('\n'),
    ).catch((error) => {
      // A CI summary failure must not overwrite the original diagnostic report.
      process.stderr.write(`Could not write step summary: ${error.message}\n`);
    });
  }
} catch {
  resultExitCode = 2;
  process.stderr.write('Electron probe exited without a report; result is inconclusive.\n');
  await writeFile(
    path.join(outputDir, 'report.json'),
    JSON.stringify(
      {
        status: 'inconclusive',
        error: 'Electron probe exited without a report',
        exitCode,
      },
      null,
      2,
    ),
  );
}
try {
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
} catch {
  /* Runner teardown also removes its temporary profile. */
}
process.exitCode = resultExitCode;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8571** (2026-11-03): **bug: Windows 缺少 VC++ 运行库时覆盖安装失败，卸载钩子误报“无法停止远程桌面服务”**
  *Symptoms*: ### 问题描述 / What happened  在未安装 Microsoft Visual C++ x64 运行库的 Windows 上，用完整安装包覆盖安装 Cindy 会失败：  1. 安装进度中连续 5 次弹出「Cindy 解除安装」：    > Could not stop the Cindy remote desktop service. Run the uninstaller as administrator and try again. 2. 随后弹出「Cindy 无法关闭。请手动关闭它，然后单击重试以继续。」 3. 选择「取消」后提示 `Failed to uninstall old application files. Please try running the installer again.: 2`，安装器退出。  机器上并没有注册任何 Cindy 远程桌面服务。实际原因是卸载钩子调用的 `cindy-windows-desktop-host.exe` 缺少 `VCRUNTIME140.dll`，无法启动。补装 VC++ x64 运行库后，同一安装包可以正常覆盖安装。  期望行为：缺少 VC++ 运行库不应阻断覆盖安装或卸载；即使失败，提示也应指向真实原因，而不是让用户以管理员身份重试。  该问题最初来自用户反馈：选择「为所有用户安装」覆盖安装时出现同一弹窗；另有一例出现在安装 0.1.115 时。下面是在 Windows Sandbox 中的复现结果。  ### 环境 / Environment  - Cindy 版本或 commit：0.2.119（相关卸载逻辑自 v0.1.78-beta 起存在，当前 `main` 未变） - 平台与版本：Windows Sandbox，Windows build 26100，x64；未安装 VC++ x64 运行库（没有 `System32\vcruntime140.dll`，也没有 `HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64`） - 安装方式：完整安装包，「仅为我安装」，默认目录  ### 复现步骤 / Steps to reproduce  1. 在未安装 VC++ x64 运行库的 Windows 上运行 0.2.119 安装包，选择「仅为我安装」。首次安装成功，没有弹窗。 2. 不启动 Cindy，再次运行同一安装包，仍选择「仅为我安装」覆盖安装。 3. 出现上述弹窗；选择「取消」后安装失败。  对照：安装微软官方 `VC_redist.x64.exe`（14.44.35211.0）后重复第 2 步，没有弹窗，安装完成。  ### 日志与截图 / Logs & screenshots  | 检查项 | 未装运行库 | 补装运行库后 | | --- | --- | --- | | `resources\tools\remote-desktop\cindy-windows-desktop-host.exe --status` | 系统提示找不到 `VCRUNTIME140.dll`，退出码 `-1073741515`（`0xC0000135`） | 输出 `missing`，退出码 `0` | | 覆盖安装 | 失败，安装器退出码 `2` | 成功，安装器退出码 `0` | | `CindyRemoteDesktop-*` 服务 | 无 | 无 |  **1. 未装运行库时，直接运行 helper：找

- **Issue #8549** (2026-11-03): **用 /cindy:learn 触发 Learn 时报错 "Pinned Claude Skill does not match the user invocation."**
  *Symptoms*: **提交人**: halftrue **客户端版本**: 0.1.121  ---  ## 现象  在 Claude Code 引擎的任务里，输入 `/cindy:learn`（不论是否带参数）并发送，回复立即结束，界面显示「回复未完成」，错误详情：  ``` Pinned Claude Skill does not match the user invocation. ```  连续试了 3 次（1 次不带参数，2 次带说明文字），每次都在约 1 ms 内失败，模型请求还没发出去，Learn 也没有启动。  ## 复现步骤  1. 打开一个使用 Claude Code 引擎的任务 2. 在输入框输入 `/cindy:learn`，后面可以跟任意说明文字，也可以不跟 3. 发送  **期望**：启动 Learn 流程。 **实际**：报上述错误，Learn 没有启动。  ## 排查结果  - 从本地消息记录看，输入框把 `/cindy:learn` 识别成了 slash 命令（`slashCommandRanges` 覆盖了 `/cindy:learn`），给消息附上了 `cindyLearnInvocation`，固定的是内置的 `learn/SKILL.md`（frontmatter `name: learn`）。 - 主进程的 `preparePinnedClaudeSkillInvocation` 用下面这个正则校验用户输入：   ```js   new RegExp(`^/(?:skill:)?${escapeRegExp(name)}(?:\\s+([\\s\\S]*))?$`, "i")   ```   它只接受 `/learn` 和 `/skill:learn`，不接受 `cindy:` 插件命名空间前缀，所以抛出了这个错误。 - 也就是说，输入框接受并识别的写法（`/cindy:learn`）和主进程校验允许的写法不一致。Claude Code 引擎的 Skill 列表里，这个 Skill 显示为 `cindy:learn`，用户很容易照这个名字输入。  ## 临时绕过  手动输入 `/learn …`，去掉 `cindy:` 前缀。  ## 可能的修复方向  - 主进程校验也接受 `cindy:` 命名空间前缀；或者 - 输入框只把 `/learn` 识别成 Learn 命令，不把 `/cindy:learn` 当作已固定的 Learn 调用。  ## 出问题时的环境  - Cindy 0.1.121 - 任务引擎：Claude Code --- ## 提交时的任务环境  仅代表提交时快照,不一定是故障环境。OS 来自提交客户端本机,不含 SSH 远端主机;Harness / 模型来自当前任务。与运行环境无关的反馈可忽略本段。 **OS**: darwin arm64 (27.2.0) **Harness**: Claude Code **Model ID**: ` claude-opus-5-5 ` **界面语言**: zh-CN
  **Post-Mortem & Fix Analysis**:
  > ### 判断  更新：@DavidShenXD 已针对本缺陷提交了修复 PR #8609，接替并扩展了此前在途 PR #7448 的范围，覆盖 Claude Code 与 Pi 引擎对 `/cindy:learn` 命名空间调用的完整支持、宿主环境说明旁路以及切换引擎后的交接文本延迟处理。  支持通过 `/cindy:learn` 显式调用内置 Learn 技能是既定的命名空间设计，用于明确指定官方技能并防止同名覆盖。目前 PR #8609 已统一 Claude Code 校验正则、Pi 运行时命令匹配、环境说明与 `pendingHandoff` 旁路逻辑，并通过了 496 项定向单测/集成测试与 6 项 mock 验证（Codex 评审已无残留意见）；真实模型完整端到端流程待随新构建进一步验证。  ### 行动  1. **首要步骤（Maintainer / Reviewer）**：评审并合并修复 PR #8609。关注全量 CI 门禁结果，重点核对 commit `0906869577` 中针对交接前缀延后消费的事务处理逻辑，确认与既有持久消费状态保持一致。 2. **后续验收（QA / 提报人）**：仅当包含 #8609 修复的构建发布后，在 Claude Code（及 Pi）任务中分别输入无参数 `/cindy:learn`、带说明文本以及 `hub:market:<slug>` 参数进行原场景复测，确认 Learn 流程正常启动且未报 `Pinned Claude Skill does not match the user invocation.`。 3. **临时规避**：在包含修复的版本发布前，桌面端非机器人会话可直接输入无前缀的 `/learn …` 正常唤起。  ### 技术依据与基线核查  - **核查基线**：主干最新快照 `d832a087878d36f48b9ea3b779254d660c1f4d32`。 - **校验与派发链路缺口**：   - `packages/maker-core/src/agents/claude-code/pinned-skill-invocation.ts` 中校验正则原仅接受 `/learn` 与 `/skill:learn`，未涵盖 `cindy:` 前缀；   - `apps/desktop/src/m
  > 已提交修复 PR：https://github.com/makecindy/cindy/pull/8609。  修复包含 Claude Code 和 Pi 的 /cindy:learn 调用，并补齐宿主发送链的环境说明旁路。403 项定向测试、相关类型检查和 6/6 mock 验收通过；真实模型完整 Learn 工作流未验收。  PR 已登记 PRwatch，后续评审与 CI 反馈由当前任务跟进。  <!-- pr-watch:submit:makecindy/cindy#8609 -->

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

### Incident Patch 1: `4f2d83c7` (2026-11-03)
**Commit Message**: Merge pull request #7766 from fancyboi999/fix/7748-mcp-app-tool-timeout

fix(mcp-apps): relay progress for bounded long tool calls

**File**: `apps/desktop/src/main/mcp-apps/__tests__/interop.test.ts` (modified, +201/-2)
```diff
@@ -4,10 +4,13 @@ import { App } from '@modelcontextprotocol/ext-apps';
 import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
 import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
+import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
 import {
   CallToolResultSchema,
   type CallToolResult,
   type JSONRPCMessage,
+  type ServerRequest,
+  type ServerNotification,
 } from '@modelcontextprotocol/sdk/types.js';
 import {
   createMockAppServer,
@@ -92,11 +95,13 @@ async function fixture(
     appModes?: ('inline' | 'fullscreen')[];
     duringResource?: 'result' | 'cancelled' | 'clear' | 'server';
     revisionKey?: () => string;
+    source?: typeof endpoint;
   } = {},
 ) {
   const config = {
     id: 'example',
-    url: transport === 'http' ? endpoint.url : endpoint.sseUrl,
+    url:
+      transport === 'http' ? (options.source ?? endpoint).url : (options.source ?? endpoint).sseUrl,
     transport,
   };
   let owner: object = {};
@@ -188,14 +193,16 @@ async function fixture(
   app.onteardown = teardown;
   const viewTransport = new TestViewTransport(host, document.viewId, 'renderer:1', openLink);
   await app.connect(viewTransport);
+  const apps = [app];
   cleanups.push(async () => {
     await host.reset();
-    await app.close();
+    await Promise.all(apps.map((view) => view.close()));
     await connection.close();
   });
   return {
     host,
     app,
+    apps,
     viewTransport,
     client,
     card,
@@ -222,7 +229,199 @@ async function fixture(
   };
 }
 
+/** Real SDK requests with server completion controlled independently of the Host clock. */
+async function controlledToolFixture(transport: 'http' | 'sse' = 'http') {
+  const calls: {
+    extra: RequestHandlerExtra<ServerRequest, ServerNotification>;
+    resolve(result: CallToolResult): void;
+  }[] = [];
+  const source = await startMockAppServer({
+    createServer: () => {
+      const server = createMockAppServer();
+      server.registerTool(
+        'controlled_tool',
+        { inputSchema: {}, _meta: { ui: { visibility: ['app'] } } },
+        async (_args, extra) =>
+          new Promise<CallToolResult>((resolve) => calls.push({ extra, resolve })),
+      );
+      return server;
+    },
+  });
+  cleanups.push(async () => {
+    calls.forEach(({ resolve }) => resolve({ content: [] }));
+    await source.close();
+  });
+  return { f: await fixture(transport, { source }), calls };
+}
+
 describe('official MCP Apps interoperability', () => {
+  it.each(['http', 'sse'] as const)(
+    'routes concurrent %s View progress by request, preserving its values',
+    async (transport) => {
+      const { f, calls } = await controlledToolFixture(transport);
+      const document = await f.host.open('renderer:2', 'task', 'card', { platform: 'desktop' });
+      const second = new App({ name: 'Second View', version: '1' }, {}, { autoResize: false });
+      second.onteardown = async () => ({});
+      f.apps.push(second);
+      await second.connect(new TestViewTransport(f.host, document.viewId, 'renderer:2'));
+      const firstProgress = vi.fn(),
+        secondProgress = vi.fn();
+      const firstResult = f.app.callServerTool(
+        { name: 'controlled_tool', arguments: {}, _meta: { requestLabel: 'first' } },
+        { onprogress: firstProgress },
+      );
+      const secondResult = second.callServerTool(
+        { name: 'controlled_tool', arguments: {}, _meta: { requestLabel: 'second' } },
+        { onprogress: secondProgress },
+      );
+      const results = Promise.allSettled([firstResult, secondResult]);
+      await vi.waitFor(() => expect(calls).toHaveLength(2));
+      const first = calls.find((call) => call.extra._meta?.requestLabel === 'first')!;
+      const other = calls.find((call) => call.extra._meta?.requestLabel === 'second')!;
+      expect(first.extra._meta?.progressToken).not.toBe(other.extra._meta?.progressToken);
+      await other.extra.sendNotification({
+        method: 'notifications/progress',
+        params: {
+          progressToken: other.extra._meta!.progressToken!,
+          progress: 2.5,
+          total: 10,
+          message: 'second',
+        },
+      });
+      await vi.waitFor(() =>
+        expect(secondProgress).toHaveBeenCalledWith({
+          progress: 2.5,
+          total: 10,
+          message: 'second',
+        }),
+      );
+      expect(firstProgress).not.toHaveBeenCalled();
+      first.resolve({ content: [{ type: 'text', text: 'first' }] });
+      other.resolve({ content: [{ type: 'text', text: 'second' }] });
+      expect(await results).toEqual([
+        { status: 'fulfilled', value: { content: [{ type: 'text', text: 'first' }] } },
+        { status: 'fulfilled', value: { content: [{ type: 'text', text: 'second' }] } },
+      ]);
+    },
+  );
+
+  it.each([true, false])(
+    'finishes a 90-second tool
```

**File**: `apps/desktop/src/main/mcp-apps/__tests__/viewAuthorization.test.ts` (modified, +74/-12)
```diff
@@ -7,6 +7,7 @@ import { GhostPipeDispatcher } from '../../cindy-brain/pipeDispatcher.js';
 import type { InstalledGhost } from '../../../shared/ghost.js';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 import { AppBridge } from '@modelcontextprotocol/ext-apps/app-bridge';
+import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
 import type { JSONRPCMessage, Notification } from '@modelcontextprotocol/sdk/types.js';
 import type { McpAppRecord } from '../../../shared/mcpApps.js';
 import { AppConnection, type AppServerConfig } from '../connection.js';
@@ -188,14 +189,18 @@ async function fixture(caller = 'renderer:1', plugin = false, html = '<p>Form</p
         appCapabilities: {},
       },
     });
-    await vi.waitFor(() =>
-      expect(outgoing).toContainEqual(expect.objectContaining({ id: 1, result: expect.anything() })),
+    await vi.waitFor(
+      () =>
+        expect(outgoing).toContainEqual(expect.objectContaining({ id: 1, result: expect.anything() })),
+      { interval: 1 },
     );
     await dispatch({ jsonrpc: '2.0', method: 'ui/notifications/initialized' });
-    await vi.waitFor(() =>
-      expect(outgoing).toContainEqual(
-        expect.objectContaining({ method: 'ui/notifications/tool-input' }),
-      ),
+    await vi.waitFor(
+      () =>
+        expect(outgoing).toContainEqual(
+          expect.objectContaining({ method: 'ui/notifications/tool-input' }),
+        ),
+      { interval: 1 },
     );
     outgoing.length = 0;
   }
@@ -490,25 +495,82 @@ describe('MCP App upstream result authorization', () => {
     expect(f.methods.tools).toHaveBeenCalledOnce();
   });
 
+  it('retains the latest tool progress while the card authorization read is pending', async () => {
+    const f = await fixture();
+    const result = deferred<unknown>();
+    f.methods.callTool.mockReturnValueOnce(result.promise);
+    await f.dispatch({
+      jsonrpc: '2.0',
+      id: 2,
+      method: 'tools/call',
+      params: { ...requests[0][1], _meta: { progressToken: 'view-local-token' } },
+    });
+    await vi.waitFor(() => expect(f.methods.callTool).toHaveBeenCalledOnce());
+    const options = f.methods.callTool.mock.calls[0][2] as RequestOptions;
+    const authorization = deferred<McpAppRecord>();
+    f.readCard.mockReturnValueOnce(authorization.promise);
+    options.onprogress?.({ progress: 1 });
+    await vi.waitFor(() => expect(f.readCard.mock.results.at(-1)?.value).toBe(authorization.promise));
+    options.onprogress?.({ progress: 2 });
+    options.onprogress?.({ progress: 3, total: 10, message: 'latest' });
+    authorization.resolve(await f.readCard());
+    await vi.waitFor(() =>
+      expect(f.outgoing).toContainEqual({
+        jsonrpc: '2.0',
+        method: 'notifications/progress',
+        params: { progressToken: 'view-local-token', progress: 3, total: 10, message: 'latest' },
+      }),
+    );
+    expect(
+      f.outgoing.filter(
+        (message) => 'method' in message && message.method === 'notifications/progress',
+      ),
+    ).toHaveLength(1);
+    result.resolve(requests[0][3]);
+    await vi.waitFor(() =>
+      expect(f.outgoing).toContainEqual(expect.objectContaining({ id: 2, result: requests[0][3] })),
+    );
+  });
+
   it.each(['card', 'owner', 'server', 'config'] as const)(
-    'discards a completed App tool result after %s revocation without replaying it',
+    'discards App tool progress and results after %s revocation without replaying it',
     async (revocation) => {
       const f = await fixture();
       const pending = deferred<unknown>();
       f.methods.callTool.mockReturnValueOnce(pending.promise);
-      await f.dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: requests[0][1] });
+      await f.dispatch({
+        jsonrpc: '2.0',
+        id: 2,
+        method: 'tools/call',
+        params: { ...requests[0][1], _meta: { progressToken: 'view-local-token' } },
+      });
       await vi.waitFor(() => expect(f.methods.callTool).toHaveBeenCalledOnce());
+      const options = f.methods.callTool.mock.calls[0][2] as RequestOptions;
+      options.onprogress?.({ progress: 1, total: 2, message: 'authorized progress' });
+      await vi.waitFor(() =>
+        expect(f.outgoing).toContainEqual({
+          jsonrpc: '2.0',
+          method: 'notifications/progress',
+          params: {
+            progressToken: 'view-local-token',
+            progress: 1,
+            total: 2,
+            message: 'authorized progress',
+          },
+        }),
+      );
+      f.outgoing.length = 0;
       f.revoke(revocation);
+      options.onprogress?.({ progress: 2, total: 2, message: marker });
+      await new Promise<void>((resolve) => setImmediate(resolve));
+      expect(JSON.stringify(f.outgoing)).not.toContain(marker);
       pending.resolve(requests[0][3]);
       await vi.waitFor(() => expect(f.outgoing).toContainEqual(expect.objectContaining({ id: 2 })));
-      expect(f.outgoing).
```

**File**: `apps/desktop/src/main/mcp-apps/host.ts` (modified, +58/-1)
```diff
@@ -18,6 +18,8 @@ import {
   type JSONRPCMessage,
   type Tool,
   type CallToolResult,
+  type Progress,
+  type ProgressNotification,
 } from '@modelcontextprotocol/sdk/types.js';
 import type { McpAppRecord, McpAppDocument } from '../../shared/mcpApps.js';
 import { hasExecutionComputerFile, MCP_APP_LINK_GRANT_MS, type McpAppLinkAuthorization } from '../../shared/mcpApps.js';
@@ -34,6 +36,10 @@ import {
   MCP_APPS_MAX_REMOTE_BYTES,
 } from './protocol.js';
 
+// A fixed total budget: server progress may renew the View's idle timer, but
+// must not keep a Main-owned tool request alive indefinitely.
+const MCP_APP_TOOL_TIMEOUT_MS = 30 * 60_000;
+
 export interface McpAppsHostDeps {
   pluginFiles?: PluginFileAccess;
   owner(): object | undefined;
@@ -557,10 +563,61 @@ export class McpAppsHost {
           // The one-use ticket below binds identity; it does not grant approval.
           await this.deps.authorizeTool(sessionId, target, params.arguments ?? {}, extra.signal, { clientId, serverId: record.serverId, title: record.tool.title ?? record.tool.name });
           const client = await currentClient(extra.signal);
+          if (!config.plugin) {
+            const token = params._meta?.progressToken;
+            let active = true;
+            let forwarding = false;
+            let pendingProgress: Progress | undefined;
+            try {
+              return (await currentResult(
+                client.callTool(params, CallToolResultSchema, {
+                  signal: extra.signal,
+                  timeout: MCP_APP_TOOL_TIMEOUT_MS,
+                  // The SDK allocates a connection-scoped token when onprogress is
+                  // registered. View-local tokens can collide on this shared client.
+                  onprogress:
+                    token === undefined
+                      ? undefined
+                      : (update) => {
+                          if (!active || extra.signal.aborted) return;
+                          pendingProgress = update;
+                          if (forwarding) return;
+                          forwarding = true;
+                          // Retain only the latest update while authorization is
+                          // checked, rather than queueing unbounded server progress.
+                          void (async () => {
+                            try {
+                              while (active && !extra.signal.aborted && pendingProgress) {
+                                await assertCurrent();
+                                if (!active || extra.signal.aborted) return;
+                                const latest = pendingProgress;
+                                pendingProgress = undefined;
+                                const notification: ProgressNotification = {
+                                  method: 'notifications/progress',
+                                  params: { ...latest, progressToken: token },
+                                };
+                                // AppBridge 1.7's helper type omits core MCP progress.
+                                await scopedTransport.send({ jsonrpc: '2.0', ...notification });
+                              }
+                            } catch {
+                              // Revoked Views must not receive late progress.
+                              pendingProgress = undefined;
+                            } finally {
+                              forwarding = false;
+                            }
+                          })();
+                        },
+                }),
+                extra.signal,
+              )) as CallToolResult;
+            } finally {
+              active = false;
+              pendingProgress = undefined;
+            }
+          }
           const invoke = (ticket?: string) => currentResult(client.callTool({ ...params,
             ...(ticket ? { _meta: { ...params._meta, [PLUGIN_PAGE_TICKET]: ticket } } : {}),
           }, CallToolResultSchema, { signal: extra.signal, ...(config.plugin ? { timeout: GHOST_PIPE_CALL_MAX_TOTAL_MS } : {}) }), extra.signal) as Promise<CallToolResult>;
-          if (!config.plugin) return invoke();
           const token = params._meta?.progressToken;
           const progress = createPageProgressRelay(async (value, progressSignal) => {
             await assertCurrent();
```

**File**: `docs/mcp-apps.md` (modified, +11/-0)
```diff
@@ -178,6 +178,17 @@ iOS 另保留显式顶层请求拦截；可信 proxy 同时检查实际 `event.o
 凭证留在 Main 的现有密钥存储中，不进入 iframe。Claude Code、Codex、Pi 都通过同一
 Host facade 调用自定义 MCP；支持 Apps 的工具执行时生成独立卡片，历史卡片可重新连接。
 不支持 UI 扩展的普通 MCP 保持文本工具使用方式。
+
+App 发起的 `tools/call` 在 Host 到 MCP server 这一段有 30 分钟总时限；服务端进度不会
+延长这个总时限。Host 按单次请求映射进度 token，再将原始进度值、总量与消息转发给
+发起的 View。不同 View 可以使用相同的本地 token，不会互相接收进度。
+检查归属期间积压的进度只保留最新一条，避免高频上报造成无界队列。
+`@modelcontextprotocol/ext-apps@1.7.5` 的 `app.callServerTool(params, options)` 默认注册
+进度回调并启用 `resetTimeoutOnProgress`，因此服务端持续报告进度时，App 的默认
+60 秒等待时限会续期。服务端不报告进度时，App 应通过 `options.timeout` 显式设置
+所需等待时间（单位为毫秒）；App 自己的超时或取消仍会传递给对应的上游请求。
+Host 不生成虚构的服务端进度，也不自动重放超时的工具调用。
+
 模型侧 facade 继承下游 harness 实际声明的 client capabilities（含其他 extensions），
 再追加 Apps extension；roots、sampling、elicitation 与普通服务器回调只返回产生该
 连接的 harness，客户端通知（如 roots/list_changed）沿同一连接转发。回调返回前
```

---

### Incident Patch 2: `ac785430` (2026-11-03)
**Commit Message**: Merge pull request #8630 from makecindy/dash/mobile-swiftui-host-containment

fix(mobile): 推迟 SwiftUI 宿主的控制器挂接，修复 iOS 安全区更新时闪退

**File**: `dependency-patches/README.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@
 | 依赖 | 用途 |
 | --- | --- |
 | `expo-image-manipulator@57.0.14` | 修复 iOS HDR / 10-bit HEIC 图片在方向归一化时因原生 `CGContext` 参数不兼容而抛出 `ERR_IMAGE_CONTEXT_LOST`；正常方向直接复用原图，其余方向交给 `UIGraphicsImageRenderer`。同类问题与真机验证见 [`tloncorp/tlon-apps#5951`](https://github.com/tloncorp/tlon-apps/pull/5951)，待 Expo 上游提供等价修复后移除。 |
+| `expo-modules-core@57.0.18` | 修复 iOS 偶发闪退（`NSFastEnumerationMutation`，栈在 `-[UIViewController _recursiveUpdateContentOverlayInsetsFromParentIfNecessary]`，无 App 帧）。SwiftUI 宿主视图（`@expo/ui` 的 `Host`）挂上 / 卸下窗口时会同步 `addChild` / `removeFromParent`；而 UIKit 在状态栏或安全区变化时正遍历父控制器的子控制器，若此时有 `unstable_Immediate` 状态提交让 Fabric 当场挂载，子控制器列表就在遍历中被改动。远程桌面叠层渲染在导航栈外，它的 SwiftUI 宿主直接挂在根控制器下，画中画期间一直在。补丁让视图仍同步挂上 / 卸下，控制器的父子关系改到下一轮主线程再同步，并沿用上游对「父控制器视图不包含宿主」时跳过 containment 的判断。同一机制见 [`react-native-screens#4811`](https://github.com/software-mansion/react-native-screens/issues/4811)、[`#4168`](https://github.com/software-mansion/react-native-screens/issues/4168)。改变 iOS 原生指纹，需随冷更发版；升级 expo-modules-core 时核查上游是否已有等价修复。 |
 | `expo-paste-input@0.2.2` | 优化移动端粘贴图片的处理时序，将耗时的解码、压缩和写盘移出 UI 线程，并补充加载中与失败事件。 |
 | `expo-router@57.0.17` | `Stack.Toolbar.Menu` 子菜单透传 `subtitle`，让 iOS 顶栏菜单的一级行在标题下显示当前值（如「任务信息」下显示已选项）。配合下方 `react-native-screens` 补丁生效。 |
 | `harmonyos-sans-sc-webfont-splitted` | 移除依赖按语言全局覆盖 `font-family` 的规则，由 Cindy 自己决定界面字体。 |
```

**File**: `dependency-patches/expo-modules-core@57.0.18.patch` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+diff --git a/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift b/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift
+index cdaa69f6667fc2969302b89bb194d38ab6c2e841..0cc13f37b6742e640c725dbf7570b423cf08bc53 100644
+--- a/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift
++++ b/ios/Core/Views/SwiftUI/SwiftUIHostingView.swift
+@@ -222,27 +222,84 @@ extension ExpoSwiftUI {
+       }
+       #endif
+ 
++      #if os(iOS) || os(tvOS)
++      // Cindy patch: Fabric can mount inline while UIKit is enumerating a parent's
++      // childViewControllers (an `unstable_Immediate` state commit during safe area / status bar
++      // propagation). Changing containment there aborts the app with NSFastEnumerationMutation,
++      // so the view moves now and the controller containment follows on the next main-queue turn.
++      if window != nil {
++        addSubview(hostingController.view)
++        setupHostingViewConstraints()
++      } else {
++        hostingController.view.removeFromSuperview()
++      }
++      scheduleContainmentSync()
++      #else
+       if window != nil, let parentController = reactViewController() {
+-        #if !os(macOS)
+-        if parentController as? UINavigationController == nil && parentController as? UITabBarController == nil {
+-          // Swift automatically adds the hostingController in the correct place when the parentController
+-          // is UINavigationController, since it's children are supposed to be only screens.
+-          // Similarly, for UITabBarController we expect its children to be only tabs.
+-          parentController.addChild(hostingController)
+-        }
+-        #else
+         parentController.addChild(hostingController)
+-        #endif
+         addSubview(hostingController.view)
+-        #if os(iOS) || os(tvOS)
+-        hostingController.didMove(toParent: parentController)
+-        #endif
+         setupHostingViewConstraints()
+       } else {
+         hostingController.view.removeFromSuperview()
+         hostingController.removeFromParent()
+       }
++      #endif
++    }
++
++    #if os(iOS) || os(tvOS)
++    private var containmentSyncScheduled = false
++
++    private func scheduleContainmentSync() {
++      guard !containmentSyncScheduled else {
++        return
++      }
++      containmentSyncScheduled = true
++      // Capture the controller strongly: if this view is released before the block runs, the
++      // controller must still leave its parent instead of staying behind as a stale child.
++      let controller = hostingController
++      DispatchQueue.main.async { [weak self] in
++        guard let self else {
++          Self.moveHostingController(controller, to: nil)
++          return
++        }
++        self.containmentSyncScheduled = false
++        Self.moveHostingController(controller, to: self.containmentParent())
++      }
++    }
++
++    /**
++     The controller that should contain the hosting controller right now, or `nil` when the view is
++     off-window or UIKit manages containment itself (navigation and tab bar controllers only take
++     screens and tabs as children).
++     */
++    private func containmentParent() -> UIViewController? {
++      guard window != nil, let parentController = reactViewController() else {
++        return nil
++      }
++      if parentController is UINavigationController || parentController is UITabBarController {
++        return nil
++      }
++      // UIKit throws when a child controller's view is outside its parent's view.
++      guard parentController.viewIfLoaded.map({ isDescendant(of: $0) }) ?? false else {
++        return nil
++      }
++      return parentController
++    }
++
++    private static func moveHostingController(_ controller: UIViewController, to parent: UIViewController?) {
++      if controller.parent === parent {
++        return
++      }
++      if controller.parent != nil {
++        controller.willMove(toParent: nil)
++        controller.removeFromParent()
++      }
++      if let parent {
++        parent.addChild(controller)
++        controller.didMove(toParent: parent)
++      }
+     }
++    #endif
+ 
+ #if os(macOS)
+     public override func reactViewController() -> NSViewController? {
```

**File**: `package.json` (modified, +2/-1)
```diff
@@ -69,7 +69,8 @@
       "@expo/cli@57.0.25": "dependency-patches/@expo__cli@57.0.25.patch",
       "react-native-screens@4.26.2": "dependency-patches/react-native-screens@4.26.2.patch",
       "expo-router@57.0.17": "dependency-patches/expo-router@57.0.17.patch",
-      "react-native-gesture-handler@2.32.0": "dependency-patches/react-native-gesture-handler@2.32.0.patch"
+      "react-native-gesture-handler@2.32.0": "dependency-patches/react-native-gesture-handler@2.32.0.patch",
+      "expo-modules-core@57.0.18": "dependency-patches/expo-modules-core@57.0.18.patch"
     },
     "allowUnusedPatches": true
   },
```

**File**: `pnpm-lock.yaml` (modified, +14/-11)
```diff
@@ -25,6 +25,9 @@ patchedDependencies:
   expo-image-manipulator@57.0.14:
     hash: 78594ca2235bdbbee2665f37b86d4e1e892733c4f9bd38fa7085338b90486e2b
     path: dependency-patches/expo-image-manipulator@57.0.14.patch
+  expo-modules-core@57.0.18:
+    hash: b74a771fc7f42cfafdb72af6b5a791bb93ea041bce1488dbbde2b88f2c674dcc
+    path: dependency-patches/expo-modules-core@57.0.18.patch
   expo-paste-input@0.2.2:
     hash: 53be555646735a171c1624f074ef30e5ca897a7b8893724bc2d0d51682f769d8
     path: dependency-patches/expo-paste-input@0.2.2.patch
@@ -842,7 +845,7 @@ importers:
         version: file:apps/mobile/modules/xdt-ios-action-sheet
       xdt-ios-app-distribution:
         specifier: file:./modules/xdt-ios-app-distribution
-        version: file:apps/mobile/modules/xdt-ios-app-distribution(expo-modules-core@57.0.18(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(expo@57.0.23)
+        version: file:apps/mobile/modules/xdt-ios-app-distribution(expo-modules-core@57.0.18(patch_hash=b74a771fc7f42cfafdb72af6b5a791bb93ea041bce1488dbbde2b88f2c674dcc)(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(expo@57.0.23)
       xdt-mobile-realtime-audio:
         specifier: file:./modules/xdt-mobile-realtime-audio
         version: file:apps/mobile/modules/xdt-mobile-realtime-audio
@@ -851,10 +854,10 @@ importers:
         version: file:apps/mobile/modules/xdt-screenshot-monitor
       xdt-tapdb:
         specifier: file:./modules/xdt-tapdb
-        version: file:apps/mobile/modules/xdt-tapdb(expo-modules-core@57.0.18(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(expo@57.0.23)
+        version: file:apps/mobile/modules/xdt-tapdb(expo-modules-core@57.0.18(patch_hash=b74a771fc7f42cfafdb72af6b5a791bb93ea041bce1488dbbde2b88f2c674dcc)(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(expo@57.0.23)
       xdt-wechat-login:
         specifier: file:./modules/xdt-wechat-login
-        version: file:apps/mobile/modules/xdt-wechat-login(expo-modules-core@57.0.18(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(expo@57.0.23)
+        version: file:apps/mobile/modules/xdt-wechat-login(expo-modules-core@57.0.18(patch_hash=b74a771fc7f42cfafdb72af6b5a791bb93ea041bce1488dbbde2b88f2c674dcc)(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(expo@57.0.23)
     devDependencies:
       '@types/react':
         specifier: ~19.2.0
@@ -18135,7 +18138,7 @@ snapshots:
       - supports-color
       - typescript
 
-  expo-modules-core@57.0.18(react-native-worklets@0.10.1(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3))(react-native@0.86.3(@babel/core@7.29.7)(@react-native/metro-config@0.86.3(@babel/core@7.29.7))(@types/react@19.2.17)(react@19.2.3))(react@19.2.3):
+  expo-modules-core@57.0.18(patch_hash=b74a771fc7f42cfafdb7
```

---

### Incident Patch 3: `592b6f85` (2026-11-03)
**Commit Message**: Merge pull request #8408 from yan-xdt/fix/direct-peer-capacity-recovery

fix(device-link): 扩展直连容量并完善恢复机制

**File**: `apps/desktop/src/main/device-link/__tests__/directLink.test.ts` (modified, +26/-0)
```diff
@@ -56,6 +56,32 @@ it('does not create a late session after the authenticated owner was suspended d
   expect(fake.commands).toHaveLength(0);
 });
 
+// Capacity regression, unit tier: the lazy Desktop adapter must expose one shared
+// pool and claim a released slot synchronously when an admission callback runs.
+// The shared-package bridge tests cannot catch a wrapper dropping those hooks.
+it('uses the desktop budget and synchronously claims a released native slot', async () => {
+  const before = fake.starts, sessions = [];
+  let replacement: ReturnType<typeof desktopDirectRuntime.create> | undefined;
+  let opening: Promise<string> | undefined;
+  let cancel: (() => void) | undefined;
+  try {
+    for (let i = 0; i < 64; i++) {
+      const session = desktopDirectRuntime.create(`capacity-${i}`, events(), { kind: i < 8 ? 'device' : 'share' });
+      sessions.push(session); await session.offer();
+    }
+    expect(fake.starts).toBe(before + 1);
+    expect(() => desktopDirectRuntime.create('overflow', events(), { kind: 'share' })).toThrow('DIRECT_CAPACITY_FULL');
+    cancel = desktopDirectRuntime.capacity!.wait('share', () => {
+      replacement = desktopDirectRuntime.create('replacement', events(), { kind: 'share' });
+      opening = replacement.offer();
+    });
+    sessions[8].close();
+    await Promise.resolve();
+    expect(desktopDirectRuntime.capacity!.snapshot()).toMatchObject({ active: 64, queued: 0 });
+    await expect(opening).resolves.toBe('fixture-sdp');
+  } finally { cancel?.(); replacement?.close(); sessions.forEach(session => session.close()); }
+});
+
 it('releases active paths after a renderer crash and bounds automatic process restarts', async () => {
   vi.useFakeTimers();
   const observer = events(), session = desktopDirectRuntime.create('one', observer);
```

**File**: `apps/desktop/src/main/device-link/__tests__/dispatchWeakNetwork.test.ts` (modified, +85/-2)
```diff
@@ -14,6 +14,8 @@ import { sharedTaskGuestPeer } from '@cindy/device-link';
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
 import {
   DeviceLinkClient,
+  createDirectRuntimeBridge,
+  createDirectRuntimeHost,
   SHARED_TASK_CAPABILITY,
   DeviceLinkError,
   DEVICE_LINK_CAPABILITY_HISTORY_VIEW_V1,
@@ -25,6 +27,8 @@ import {
   TASK_MIGRATION_ESTIMATE_TIMEOUT_MS,
   resolveRemoteInvokeTimeoutMs,
   type Envelope,
+  type DirectRuntime,
+  type DirectRuntimeEvents,
 } from '@cindy/device-link';
 
 vi.mock('electron', () => ({
@@ -76,7 +80,9 @@ import {
   setOrdinaryPeerLinkAcceptedListener,
   setDispatchPresenceOfflineCheck,
   wireInboundDispatch,
+  hasRemoteInvokeWorkForPeer,
 } from '../dispatch';
+import { __testing as invokeRegistry } from '../invoke-registry';
 import * as subscriptions from '../subscriptions';
 import { tapWindowBroadcast, tapRemoteModelCatalogChange } from '../broadcast-tap';
 import { remoteDesktop } from '../../remote-desktop';
@@ -152,6 +158,7 @@ class DispatchTestWs {
 }
 
 class DispatchTestRelay {
+  constructor(private readonly asyncDelivery = false) {}
   private readonly sockets = new Map<string, DispatchTestWs>();
   private holdPredicate: ((senderId: string, envelope: Envelope) => boolean) | null = null;
   private readonly held: Array<{ senderId: string; envelope: Envelope }> = [];
@@ -179,6 +186,7 @@ class DispatchTestRelay {
   }
 
   route(senderId: string, socket: DispatchTestWs, envelope: Envelope): void {
+    if (envelope.kind === 'ping') { socket.push({ v: PROTOCOL_VERSION, kind: 'pong' }); return; }
     if (envelope.kind === 'hello') {
       socket.push({
         v: PROTOCOL_VERSION,
@@ -215,12 +223,16 @@ class DispatchTestRelay {
   private deliver(senderId: string, envelope: Envelope): void {
     const destination = envelope.dst ? this.sockets.get(envelope.dst) : undefined;
     if (!destination) return;
-    destination.push({ ...envelope, src: senderId });
+    const deliver = () => destination.push({ ...envelope, src: senderId });
+    if (this.asyncDelivery) queueMicrotask(deliver);
+    else deliver();
   }
 }
 
-function makeDispatchTestClient(relay: DispatchTestRelay, deviceId: string): DeviceLinkClient {
+function makeDispatchTestClient(relay: DispatchTestRelay, deviceId: string,
+  options: Pick<ConstructorParameters<typeof DeviceLinkClient>[0], 'directRuntime' | 'isPeerBusy'> = {}): DeviceLinkClient {
   return new DeviceLinkClient({
+    ...options,
     getWsUrl: () => 'ws://test/api/device-link/ws',
     getToken: async () => 'jwt-token',
     getHello: () => ({
@@ -500,6 +512,8 @@ describe('[2] outbox 离线不自旋,上线事件驱动投递', () => {
     ).toBe(true);
     expect(__testing.remoteInvokeResultOutboxSize()).toBe(1);
     expect(sendInvokeResult).toHaveBeenCalledTimes(1);
+    expect(hasRemoteInvokeWorkForPeer('ctrl-a')).toBe(true);
+    expect(hasRemoteInvokeWorkForPeer('ctrl-other')).toBe(false);
 
     // 离线期间多轮慢扫描:不再尝试发送(无 NOT_CONNECTED 自旋)
     vi.advanceTimersByTime(20_000);
@@ -512,6 +526,7 @@ describe('[2] outbox 离线不自旋,上线事件驱动投递', () => {
     expect(sendInvokeResult).toHaveBeenCalledTimes(2);
     expect(__testing.remoteInvokeResultOutboxSize()).toBe(0);
     expect(diagnosticLog.warn).toHaveBeenCalledWith(expect.stringContaining('request=req-1 queueMessages=1'));
+    expect(hasRemoteInvokeWorkForPeer('ctrl-a')).toBe(false);
     expect(diagnosticLog.info).toHaveBeenCalledWith(expect.stringContaining('request=req-1 queuedMs=20000'));
     expect(JSON.stringify(diagnosticLog.warn.mock.calls)).not.toContain('PRIVATE_RESPONSE_BODY');
     expect(JSON.stringify(diagnosticLog.info.mock.calls)).not.toContain('PRIVATE_RESPONSE_BODY');
@@ -782,6 +797,74 @@ describe('[5] orphan 截止时间按 channel 收窄', () => {
 });
 
 describe('[6] active controller 生命周期与故障半径', () => {
+  // Unit, #8408 idle-retirement contract: transport ACKs do not cover the lifetime
+  // of fire-and-forget host execution. Previous RTC tests returned handler promises
+  // to transport, hiding this gap. One >5-minute compact, one idle neighbor and one
+  // waiter must retire only the idle neighbor; the active result stays on direct.
+  it('protects a long-running inbound dispatch while reclaiming an idle neighbor for a waiter', async () => {
+    const pairs = new Map<string, Array<{ events: DirectRuntimeEvents; closed: boolean }>>();
+    const runtime = (maxPeers = 16): DirectRuntime => {
+      const bridge = createDirectRuntimeBridge({ maxPeers });
+      const native: DirectRuntime = { create(id, events) {
+        const row = { events, closed: false }, pair = pairs.get(id) ?? [];
+        pairs.set(id, pair); pair.push(row);
+        return { offer: async () => id, accept: async () => id,
+          answer: async () => { queueMicrotask(() => pair.forEach(p => { if (!p.closed) p.events.open(); })); },
+          send: text => { queueMicrotask(() => { const other = pair.find(p => p !== row && !p.closed); other?.events.message(text); }); },
+          bu
```

**File**: `apps/desktop/src/main/device-link/directLink.ts` (modified, +8/-5)
```diff
@@ -1,12 +1,13 @@
 import { ipcMain } from 'electron';
 import { createDirectRuntimeBridge, type DirectRuntime, type DirectRuntimeSession,
-  type DirectRuntimeEvents } from '@cindy/device-link';
+  type DirectRuntimeEvents, DIRECT_LINK_DESKTOP_MAX_PEERS, DIRECT_LINK_DESKTOP_RESERVED_PEERS } from '@cindy/device-link';
 import { DIRECT_LINK_LOCAL } from '../../shared/directLink';
 import { DesktopCaptureWindow } from '../remote-desktop/captureWindow';
 import { createLogger } from '../logger';
 
 const log = createLogger('device-link:direct');
-const bridge = createDirectRuntimeBridge();
+const bridge = createDirectRuntimeBridge({ maxPeers: DIRECT_LINK_DESKTOP_MAX_PEERS,
+  reservedPeers: DIRECT_LINK_DESKTOP_RESERVED_PEERS });
 let detach: (() => void) | undefined;
 let starting: Promise<void> | undefined;
 let epoch = 0;
@@ -61,14 +62,16 @@ function ensureStarted(): Promise<void> {
 
 /** Startup is deferred until a capable, authorized peer actually needs a LAN path. */
 export const desktopDirectRuntime: DirectRuntime = {
-  create(id: string, events: DirectRuntimeEvents): DirectRuntimeSession {
+  capacity: bridge.runtime.capacity,
+  create(id: string, events: DirectRuntimeEvents, options): DirectRuntimeSession {
     const generation = epoch;
-    let session: DirectRuntimeSession | undefined;
+    // Capacity wake callbacks synchronously claim their slot once the process exists.
+    let session: DirectRuntimeSession | undefined = detach ? bridge.runtime.create(id, events, options) : undefined;
     let closed = false;
     const get = async () => {
       await ensureStarted();
       if (closed || generation !== epoch) throw new Error('DIRECT_RUNTIME_CLOSED');
-      return session ??= bridge.runtime.create(id, events);
+      return session ??= bridge.runtime.create(id, events, options);
     };
     return {
       offer: async () => (await get()).offer(),
```

**File**: `apps/desktop/src/main/device-link/dispatch.ts` (modified, +5/-0)
```diff
@@ -3324,6 +3324,11 @@ function remoteInvokeAdmissionState(src: string): { messages: number; bytes: num
   return { messages, bytes };
 }
 
+/** Host work outlives the reliable frame ACK, including replies waiting in outbox. */
+export function hasRemoteInvokeWorkForPeer(src: string): boolean {
+  return remoteInvokeAdmissionState(src).messages > 0;
+}
+
 function sendRequestIdReuseError(
   client: DeviceLinkClient,
   src: string,
```

**File**: `apps/desktop/src/main/device-link/index.ts` (modified, +2/-0)
```diff
@@ -98,6 +98,7 @@ import { MAKER_PUSH } from '../maker-ipc/channels.js';
 import { createDnsFallbackLookup } from './dnsFallbackLookup';
 import {
   wireInboundDispatch,
+  hasRemoteInvokeWorkForPeer,
   setControllersChangedListener,
   setOrdinaryPeerLinkAcceptedListener,
   setRemoteInvokeBusyChangedListener,
@@ -773,6 +774,7 @@ export function initDeviceLinkService(options: DeviceLinkServiceOptions = {}): v
   client = new RoutedDeviceLinkClient({
     ...connectionOptions,
     directRuntime: desktopDirectRuntime,
+    isPeerBusy: hasRemoteInvokeWorkForPeer,
     getWsUrl: wsUrl,
     // 自建中转用中转凭证(CindyRelay),官方中转用账号 token(Bearer);两者每次建连前同一轮取值。
     authorizationScheme: () => (activeSelfHostedRelay() ? 'CindyRelay' : 'Bearer'),
```

**File**: `apps/desktop/src/main/device-link/providerShareCrossRegion.ts` (modified, +2/-1)
```diff
@@ -304,7 +304,8 @@ function createClient(rt: Runtime, state: RegionState): DeviceLinkClient {
   const client = new DeviceLinkClient({
     // The capture process is shared with the local-region client. A cross-region
     // socket closing must only close its own sessions, never suspend that process.
-    directRuntime: { create: (id, events) => desktopDirectRuntime.create(id, events) },
+    directRuntime: { capacity: desktopDirectRuntime.capacity,
+      create: (id, events, options) => desktopDirectRuntime.create(id, events, options) },
     getWsUrl: () => wsUrl,
     authorizationScheme: 'ProviderShareGuest',
     getToken: async () => {
```

**File**: `apps/mobile/src/__tests__/textColorDiscipline.test.ts` (modified, +8/-0)
```diff
@@ -231,6 +231,14 @@ function reconcile(found: Map<string, number>, debt: Map<string, number>, fix: s
 }
 
 describe('text color discipline', () => {
+  // Guard regression: encoded document assets contain long word runs. Restarting
+  // the named-style matcher at every character exhausted CI's normal 5s budget.
+  // Keep scanning the whole input and still report the text token after the asset.
+  it('scans text colors after a long encoded asset within the normal guard deadline', () => {
+    const source = `const asset = "${'A'.repeat(160_000)}";\nconst ink = colors.border;\n<Text style={{ color: ink }} />`;
+    expect(scanTextColors(source)).toEqual([{ where: 'inline', token: 'border' }]);
+  });
+
   it('scans style arrays, conditional branches, bare theme paths and named styles used on <Text>', () => {
     const tokens = (src: string) => scanTextColors(src).map((f) => f.token);
     expect(tokens('<Text style={[styles.label, { color: colors.border }]} />')).toEqual(['border']);
```

**File**: `docs/dev-rules/protocol-compatibility.md` (modified, +34/-0)
```diff
@@ -485,6 +485,40 @@ stream 匹配后才处理；信令不进入业务可靠 FIFO，也不走直连
 区间随机错峰（含 60 秒封顶档），避免多个 peer 同时失败后集中重新协商。平均间隔约为
 原固定档位的 90%；稳定连接满 60 秒后重置退避，撤权、断链或停止时仍取消待重试。
 
+直连容量是本机传输资源预算，独立于供应商组的执行并发上限。Desktop 一个数据进程的所有
+客户端（含跨区域连接）合计最多 64 个实际协商中／已打开的 peer；同账号设备与供应商分享
+各保留 8 个名额，余下 48 个共享，因此单类最多 56 个。Mobile 维持原有 16 个、不设分类预留。
+分类不赋予权限：分享仍须通过原有 capability、可靠握手和许可检查，见
+[`provider-sharing-direct-execution.md`](../product-rules/provider-sharing-direct-execution.md)。
+`directCapacity.ts` 是预算与排队判据正本，Main/WebView bridge 与生成的浏览器 runtime
+同步支持桌面硬上限；平台只能选择不超过它的预算，不增能力位、不改 relay 信令格式。
+
+满额时业务继续走 relay；有界等待队列按类内 FIFO、类间轮转补建，不驱逐健康通道。
+释放名额后自动唤醒等待者，再次核验当前授权与 stream；入站 offer 最多保留 15 秒，
+撤权／换代／过期后不得补建。失败尝试立即释放物理名额，重试状态不占直连容量。
+每个客户端最多保留 256 个候选、同一数据进程最多 256 个等待者；无业务活动的失败／等待状态
+在 5 分钟后回收（正在进行的请求例外），新业务可以再触发尝试。有等待者时每分钟检查长期
+空闲通道：至少 5 分钟无收发、没有在途请求、接收处理或缓冲时才让出名额。无压力时保留已建立
+的通道，分享许可续期不因本机空闲策略而换通道。
+Desktop 还通过 `isPeerBusy` 接入 dispatch 的执行中请求和待发回包，不能把可靠帧已 ACK
+误当作宿主业务已完成；这只阻止空闲回收，不延后 ACK 或阻塞后续 stop／steer／push。
+
+匿名诊断仅记录固定 reason、kind、active/limit/queued、分类占用与预留数，以及完整 peer key 的 SHA-256 前 16 位；
+每个 peer 的同一 reason 每分钟最多一次，不输出原始 scoped key、SDP、IP 或错误对象。
+旧 Mobile 宿主没有 WebCrypto 时记 `peerHash=unavailable`，不退回明文 ID。容量满、队列满、
+协商超时、网络失败、runtime 故障与空闲让出分别记录；不会把 `channel-closed` 猜成网络失败。
+自建中转沿用已有签名 push 的不透明转发，不需改服务端；共享客户端测试、relay 测试和
+`pnpm --filter @cindy/device-link-relay run interop` 同时验证。
+
+本地容量／吞吐复现：`node scripts/direct-link-smoke.mjs <Chrome路径> --capacity`。
+64 是本机浏览器压测后的初始桌面预算，不等于跨机器、长时间高负载或手机真机验收；
+单 peer 帧／缓冲上限保持不变，更多 PeerConnection 会增加 CPU、内存和网络资源占用。
+2026-11-02 的 Windows / Node 22.22.3 本机 Chromium 记录：64 条通道建立 541ms，
+8 轮合计 52 MiB UTF-8 正文传输 3466ms，20ms 定时探针观察到最大延迟 78ms；第 65 条
+释放后补建，其余 63 条保留原通道。这些是一次本机 fixture 测量，不作为生产性能保证。
+另已通过共享客户端全套、桌面适配器与跨区域测试、自建 relay 测试／互通、两个独立
+Electron 进程的 IPC/WebRTC smoke，以及 Desktop、Mobile 和共享包类型检查；真机长时压测待补。
+
 数据通道 `device-link-v1` 只使用可靠有序 SCTP；同一完整 envelope 拆为不超过 16 KiB 的
 二进制片，首字节 0/1 表示续片/末片，剩余字节是 UTF-8。单条最多 `MAX_FRAME_BYTES`，
 重组有字节、分片数和超时边界；在原可靠层接收之前重组，序号、去重与 ACK 语义不变。
```

#### Recent Merged Pull Requests:
- **PR #8633** (closed): fix(agent-island): 隐藏指令不进入任务活动预览 (@zqchris)
- **PR #8630** (2026-11-03): fix(mobile): 推迟 SwiftUI 宿主的控制器挂接，修复 iOS 安全区更新时闪退 (@dashhuang)
- **PR #8627** (2026-11-03): fix(quota): 费用明细不再把额度卡片撑宽 (@dashhuang)
- **PR #8621** (2026-11-03): fix(desktop): 静态链接 Windows 远程桌面组件运行库 (@DavidShenXD)
- **PR #8614** (2026-11-03): fix(desktop): 补齐排队消息落库前授权拒绝的原因日志 (@zcinta0514)
- **PR #8613** (2026-11-03): fix(desktop): 动态壁纸中断时保留静态背景并恢复播放 (@zcinta0514)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Merge pull request #7766 from fancyboi999/fix/7748-mcp-app-tool-timeout

**RULE**:
When implementing operations in `apps/desktop/src/main/mcp-apps/__tests__/interop.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4f2d83c7`: Merge pull request #7766 from fancyboi999/fix/7748-mcp-app-tool-timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/mcp-apps/__tests__/interop.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
  type ServerRequest,
  type ServerNotification,
    source?: typeof endpoint;
    url:
      transport === 'http' ? (options.source ?? endpoint).url : (options.source ?? endpoint).sseUrl,
  const apps = [app];
    await Promise.all(apps.map((view) => view.close()));
    apps,
/** Real SDK requests with server completion controlled independently of the Host clock. */
async function controlledToolFixture(transport: 'http' | 'sse' = 'http') {
  const calls: {
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>;
    resolve(result: CallToolResult): void;
  }[] = [];
  const source = await startMockAppServer({
    createServer: () => {
      const server = createMockAppServer();
      server.registerTool(
        'controlled_tool',
        { inputSchema: {}, _meta: { ui: { visibility: ['app'] } } },
        async (_args, extra) =>
          new Promise<CallToolResult>((resolve) => calls.push({ extra, resolve })),
      );
      return server;
    },
  });
  cleanups.push(async () => {
    calls.forEach(({ resolve }) => resolve({ content: [] }));
    await source.close();
  });
  retur
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    url: transport === 'http' ? endpoint.url : endpoint.sseUrl,
    await app.close();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4f2d83c7` are properly handled with clean fallback behavior.
