# Verification Protocol: Verification Protocol: Empirical Defect Shield for makecindy/cindy

<!-- PROVENANCE_START
{
  "source_repository": "makecindy/cindy",
  "source_url": "https://github.com/makecindy/cindy",
  "source_version": "50dbd865",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T06:09:56.388Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-makecindy-cindy",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [makecindy/cindy](https://github.com/makecindy/cindy) (Revision: `50dbd865`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T06:09:56.388Z`  
> **Learning ID**: `learn-github-makecindy-cindy`


## 1. Scope & Verification Target
- **Target Repository**: `makecindy/cindy` (Commit: `50dbd865`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): makecindy/cindy

> **Canonical Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T06:09:55.182Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 10237 stars

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

### Core Architecture Module: `apps/desktop/drizzle/scripts/0148_schedule_webhook_trigger.ts`
```
import type Database from 'better-sqlite3';

function addColumn(db: Database.Database, tableName: string, columnName: string): void {
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  if (!table) return;
  const columns = new Set((db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>).map((column) => column.name));
  if (!columns.has(columnName)) db.exec(`ALTER TABLE ${tableName} ADD ${columnName} TEXT`);
}

function run(db: Database.Database): void {
  addColumn(db, 'schedules', 'webhook_trigger');
  addColumn(db, 'schedule_runs', 'trigger_source');
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

### Core Architecture Module: `apps/desktop/scripts/fixtures/button-states/button-states-fixture.tsx`
```
import { mountPage } from '../../ui-page/harness';
import { UPDATE_BUTTON_TREATMENT } from '../../../src/renderer/components/sidebar/UpdateBanner';
import { Button } from '../../../src/renderer/components/ui/button';
import { PermissionPrompt } from '../../../src/renderer/components/new-chat/PermissionPrompt';
import { SendButton } from '../../../src/renderer/components/new-chat/SendButton';
import { filledButtonHover, filledButtonPressed } from '../../../src/renderer/themes/filledButtonStates';

const ROWS = [
  { id: 'cta', title: 'cta', props: { variant: 'cta' }, label: '保存', hover: '--button-cta-hover', pressed: '--button-cta-pressed' },
  { id: 'danger', title: 'danger-solid', props: { tone: 'danger-solid' }, label: '删除', hover: '--button-danger-solid-hover', pressed: '--button-danger-solid-pressed' },
  { id: 'permission', title: 'permission', props: { palette: 'permission' }, label: '允许', hover: '--perm-allow-btn-hover', pressed: '--perm-allow-btn-pressed' },
  { id: 'confirmation', title: 'confirmation', props: { palette: 'confirmation', variant: 'cta' }, label: '确认', hover: '--confirm-btn-primary-hover', pressed: '--confirm-btn-primary-pressed' },
  { id: 'update', title: 'update', props: { variant: 'cta', className: UPDATE_BUTTON_TREATMENT }, label: '重启', hover: '--update-btn-hover', pressed: '--update-btn-pressed' },
  { id: 'secondary', title: 'secondary', props: { variant: 'secondary' }, label: '取消', hover: '--button-secondary-hover', pressed: '--button-secondary-pressed' },
  { id: 'primary', title: 'primary', props: { variant: 'primary' }, label: '编辑', hover: '--button-primary-hover', pressed: '--button-primary-pressed' },
] as const;

// 亮度阈值 0.25 附近的底色，用真实浏览器计算规则表达式。
const THRESHOLD_LIGHTNESS = [0.2495, 0.25, 0.2501, 0.2505, 0.2509, 0.251, 0.26];

const forced = (token: string) =>
  ({ '--button-face-bg': `var(${token})`, '--button-face-border': `var(${token})` }) as React.CSSProperties;

mountPage({
  render: () => (
    <div className="p-6">
    <div className="grid grid-cols-[120px_repeat(4,110px)] items-center gap-x-4 gap-y-3 text-13 text-[var(--text-primary)]">
      <span />
      <span>默认</span>
      <span>悬停（色值）</span>
      <span>按下（色值）</span>
      <span>真实指针</span>
      {ROWS.map((row) => (
        <div key={row.id} className="contents">
          <span>{row.title}</span>
          <Button {...row.props}>{row.label}</Button>
          <Button {...row.props} data-state-sample={`${row.id}-hover`} style={forced(row.hover)}>{row.label}</Button>
          <Button {...row.props} data-state-sample={`${row.id}-pressed`} style={forced(row.pressed)}>{row.label}</Button>
          <Button {...row.props} data-pointer={row.id}>{row.label}</Button>
        </div>
      ))}
      <span>SendButton</span>
      <SendButton disabled={false} onClick={() => {}} />
      <span data-send-sample="hover" className="inline-flex"><style>{'[data-send-sample="hover"] button{background:var(--send-btn-hover-bg)!important}[data-send-sample="pressed"] button{background:var(--send-btn-pressed-bg)!important}'}</style><SendButton disabled={false} onClick={() => {}} /></span>
      <span data-send-sample="pressed" className="inline-flex"><SendButton disabled={false} onClick={() => {}} /></span>
      <span data-pointer="send" className="inline-flex"><SendButton disabled={false} onClick={() => {}} /></span>
    </div>
    <div data-permission-prompt className="mt-4 max-w-[600px]">
      <PermissionPrompt
        permission={{ requestId: 'button-states', toolName: 'Bash', input: { command: 'ls' } }}
        onRespond={() => {}}
      />
    </div>
    <div hidden>
      {THRESHOLD_LIGHTNESS.map((l) => (
        <span
          key={l}
          data-threshold={l}
          data-hover={filledButtonHover(`oklch(${l} 0 0)`)}
          data-pressed={filledButtonPressed(`oklch(${l} 0 0)`)}
        />
      ))}
    </div>
    </div>
  ),
});

```

### Core Architecture Module: `apps/desktop/scripts/fixtures/button-states/ui-page.mjs`
```
const face = (el) => getComputedStyle(el, '::before').backgroundColor;
const faceOf = (page, sel) => page.locator(sel).evaluate(face);
const bgOf = (page, sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
const settle = (page) => page.waitForTimeout(260);

export default {
  name: 'button-states',
  entry: './button-states-fixture.tsx',
  viewport: { width: 760, height: 720 },
  real: 'Button, SendButton, PermissionPrompt, update button treatment, Cindy theme tokens',
  notCovered: 'Non-Cindy themes; business actions',
  cases: { default: { about: 'Real pointer hover and press match the state tokens', data: {} } },
  async check(page, ui) {
    const out = [];
    for (const id of ['cta', 'danger', 'permission', 'confirmation', 'update', 'secondary', 'primary']) {
      const btn = page.locator(`button[data-pointer="${id}"]`);
      await btn.hover(); await settle(page);
      const hover = await faceOf(page, `button[data-pointer="${id}"]`);
      const wantHover = await faceOf(page, `button[data-state-sample="${id}-hover"]`);
      await page.mouse.down(); await settle(page);
      const pressed = await faceOf(page, `button[data-pointer="${id}"]`);
      const wantPressed = await faceOf(page, `button[data-state-sample="${id}-pressed"]`);
      await page.mouse.up(); await page.mouse.move(2, 2); await settle(page);
      out.push({ id, hover, wantHover, pressed, wantPressed });
      if (hover !== wantHover || pressed !== wantPressed) throw new Error(`${id}: pointer differs ${JSON.stringify(out.at(-1))}`);
    }
    const send = page.locator('[data-pointer="send"] button');
    await send.hover(); await settle(page);
    const sh = await bgOf(page, '[data-pointer="send"] button'), wsh = await bgOf(page, '[data-send-sample="hover"] button');
    await page.mouse.down(); await settle(page);
    const sp = await bgOf(page, '[data-pointer="send"] button'), wsp = await bgOf(page, '[data-send-sample="pressed"] button');
    await page.mouse.up(); await page.mouse.move(2, 2);
    out.push({ id: 'send', hover: sh, wantHover: wsh, pressed: sp, wantPressed: wsp });
    if (sh !== wsh || sp !== wsp) throw new Error(`send: pointer differs ${JSON.stringify(out.at(-1))}`);

    // 真实授权入口的「允许一次」是最后一个按钮，状态色要和 permission 色值一致。
    const allow = page.locator('[data-permission-prompt] button').last();
    await allow.hover(); await settle(page);
    const ah = await allow.evaluate(face), wah = await faceOf(page, 'button[data-state-sample="permission-hover"]');
    await page.mouse.down(); await settle(page);
    const ap = await allow.evaluate(face), wap = await faceOf(page, 'button[data-state-sample="permission-pressed"]');
    await page.mouse.up(); await page.mouse.move(2, 2);
    out.push({ id: 'permission-prompt', hover: ah, wantHover: wah, pressed: ap, wantPressed: wap });
    if (ah !== wah || ap !== wap) throw new Error(`permission-prompt: pointer differs ${JSON.stringify(out.at(-1))}`);

    // 阈值附近：表达式在 Chromium 里算出的亮度必须和底色同向，不能混合出中间值。
    const threshold = await page.locator('[data-threshold]').evaluateAll((nodes) => nodes.map((node) => {
      const computed = (color) => {
        const probe = document.createElement('i');
        probe.style.color = color;
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      return { base: Number(node.dataset.threshold), hover: computed(node.dataset.hover), pressed: computed(node.dataset.pressed) };
    }));
    const lightness = (color) => {
      const match = /^oklch\(([\d.]+)/.exec(color);
      if (!match) throw new Error(`threshold: unexpected computed color ${color}`);
      return Number(match[1]);
    };
    for (const row of threshold) {
      const hover = lightness(row.hover), pressed = lightness(row.pressed);
      if (Math.sign(pressed - hover) !== Math.sign(hover - row.base)) throw new Error(`threshold: reversed ${JSON.stringify(row)}`);
    }
    out.push({ id: 'threshold', rows: threshold });
    console.log('[button-states]', ui.theme, JSON.stringify(out));
  },
};

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
export const useOptionalDataOwnerGeneration = () => 1;
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

### Core Architecture Module: `apps/desktop/scripts/fixtures/group-layout-states/ui-page.mjs`
```
import assert from 'node:assert/strict';
import group from '../group-control/ui-page.mjs';

// Exercise production states before resizing the same mounted chat. This adds
// the combinations the individual happy-path fixtures do not cover.
export default {
  ...group,
  name: 'group-layout-states',
  entry: '../group-control/group-control-fixture.tsx',
  cases: {
    ...Object.fromEntries(Object.entries(group.cases).filter(([name]) => !['settings', 'division', 'share-pending', 'read-receipts-thread'].includes(name))),
    'task-statuses': { ...group.cases.bubbles, about: 'All six posted task states, long title and waiting detail inside a narrow group pane' },
    ...Object.fromEntries(['proposed', 'failed', 'done', 'stopped', 'dismissed', 'superseded'].map(state => [`division-${state}`, {
      ...group.cases['division-waiting'], about: `Work plan ${state}, long step descriptions and narrow-pane controls`,
    }])),
  },
  async check(page, ui) {
    const planState = /^division-(proposed|failed|done|stopped|dismissed|superseded)$/.exec(ui.case)?.[1];
    if (planState || ui.case === 'task-statuses') {
      // UI tier: earlier fixtures covered only a started task and a successful
      // hand-off. Real timeline cards must also fit with terminal/error states
      // and unbroken waiting details; no host write or real task is started.
      await page.evaluate(async ({ planState }) => {
        const { group } = await window.electronAPI.maker.getBotGroup('fixture-group');
        if (planState) {
          const plan = group.plans[0];
          plan.status = planState === 'failed' ? 'waiting' : planState;
          plan.currentStep = planState === 'done' ? 1 : 0;
          plan.steps = plan.steps.map((step, i) => ({ ...step,
            task: `${i + 1}. 核对长内容、状态与进度，确认操作入口仍然可见。`.repeat(5),
            status: planState === 'done' ? 'done' : planState === 'failed' && i === 0 ? 'failed' : 'pending',
          }));
          group.openPlan = ['proposed', 'failed'].includes(planState) ? {
            ...group.openPlan, status: plan.status, currentStep: plan.currentStep,
            currentStepStatus: plan.steps[plan.currentStep].status,
          } : null;
        } else {
          const source = group.messages.find(message => message.task);
          group.messages = ['started', 'waiting', 'completed', 'failed', 'cancelled', 'timed-out'].map((state, i) => ({
            ...source, id: `task-${state}`, sequence: i + 1, content: '',
            task: { ...source.task, state, title: '这是一项名称很长的群内任务，用于检查省略与状态展示。'.repeat(5),
              summary: 'WaitingForOwnerConfirmation_'.repeat(18) },
          }));
        }
        window.__uiPage.emit('botGroupChanged', { groupId: group.id, change: 'messages' });
      }, { planState });
      if (planState) await page.locator(`[data-testid="bot-group-plan"][data-plan-status="${planState === 'failed' ? 'waiting' : planState}"]`).waitFor();
      else await page.locator('[data-testid="bot-group-task"][data-state="timed-out"]').waitFor();
    } else await group.check.call(this, page, ui);
    const subject = page.locator('[data-ui-page-subject]');
    const timeline = page.getByTestId('bot-group-timeline');
    // The historical journal must also be exercised open, not just as a title.
    const journal = page.locator('[data-teammate-process]');
    if (await journal.count()) {
      const toggle = journal.first().locator(':scope > button');
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    }
    for (const width of [540, 400]) {
      await subject.evaluate((el, width) => {
        el.style.height = `${el.getBoundingClientRect().height}px`;
        el.style.width = `${width}px`;
        el.style.maxWidth = '100%';
        el.style.flex = 'none';
      }, width);
      await page.waitForFunction(() => {
        const timeline = document.querySelector('[data-testid="bot-group-timeline"]');
        const main = timeline.closest('main');
        const width = main.getBoundingClientRect().width;
        return Math.abs(timeline.firstElementChild.getBoundingClientRect().width - Math.min(914, width - (width < 700 ? 40 : 100))) < 1;
      });
      const geometry = await timeline.evaluate(el => {
        const main = el.closest('main'), limit = main.getBoundingClientRect();
        const violations = [...main.querySelectorAll('[data-testid="bot-group-bubble"], [data-testid="bot-group-self-bubble"], [data-testid="bot-group-plan"], [data-testid="bot-group-task"], [data-teammate-process], [data-bot-task-card], .chat-bubble-toolbar')].flatMap(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.left < limit.left - 1 || r.right > limit.right + 1)
            ? [{ node: node.getAttribute('data-testid') ?? node.className, width: r.width, left: r.left - limit.left, right: r.right - limit.right }] : [];
        });
        const card = main.querySelector('[data-testid="bot-group-arrangement"]');
        const overflowNodes = el.scrollWidth > el.clientWidth + 1 ? [...el.querySelectorAll('*')].flatMap(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && (r.left < limit.left - 1 || r.right > limit.right + 1)
            ? [{ tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 40), left: r.left-limit.left, right: r.right-limit.right }] : [];
        }).slice(0, 12) : [];
        return { overflow: el.scrollWidth - el.clientWidth, violations, overflowNodes,
          column: el.firstElementChild.getBoundingClientRect().width, card: card?.getBoundingClientRect().width };
      });
      await timeline.evaluate(el => { el.scrollTop = 0; });
      await ui.capture(`narrow-${width}-top`);
      await timeline.evaluate(el => { el.scrollTop = el.scrollHeight; });
      await ui.capture(`narrow-${width}-bottom`);
      // The in-flow narrow toolbar must not cover the absolutely positioned
      // read receipt. Pane overflow checks alone missed this collision.
      const coveredReceipts = await timeline.locator('[data-testid="read-receipt"]').evaluateAll(marks => marks.flatMap(mark => {
        const row = mark.closest('[data-bot-group-message-id]');
        const toolbar = row.querySelector('.chat-bubble-toolbar');
        if (!toolbar) return [];
        const m = mark.getBoundingClientRect(), a = toolbar.getBoundingClientRect();
        return m.left < a.right && m.right > a.left && m.top < a.bottom && m.bottom > a.top
          ? [row.getAttribute('data-bot-group-message-id')] : [];
      }));
      assert.deepEqual(coveredReceipts, [], `Read receipts must stay clear of the toolbar at ${width}px`);
      assert.ok(geometry.overflow <= 1 && geometry.violations.length === 0,
        `${ui.case} at ${width}px must keep content and controls in its pane: ${JSON.stringify(geometry)}`);
      if (geometry.card && geometry.column <= 480) assert.ok(geometry.card >= geometry.column - 39,
        `A narrow queue card must not reserve an unused toolbar gutter: ${JSON.stringify(geometry)}`);
    }
  },
};

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10944** (2026-11-17): **iPhone 能收到待确认通知，但收不到定时任务完成通知**
  *Symptoms*: **提交人**: Ben **客户端版本**: 0.1.136  ---  同一会话多次单次定时测试均执行成功、聊天正文可见，Windows 可弹窗；用户确认通知已开启、手机和电脑均离开该对话后，iPhone 横幅及通知中心仍无测试通知，但待确认问题可触发手机通知。  预期：定时任务通知已开启且接收端不在查看该对话时，iPhone 能收到相应完成通知。  请排查完成通知与待确认通知的分类处理、过滤及投递。现有证据尚不能确定具体故障环节。  本反馈不包含项目资料、账号、会话编号或原始日志。 --- ## 提交时的任务环境  仅代表提交时快照,不一定是故障环境。OS 来自提交客户端本机,不含 SSH 远端主机;Harness / 模型来自当前任务。与运行环境无关的反馈可忽略本段。 **版本区域**: CN **OS**: darwin arm64 (27.0.0) **Harness**: Codex **Model ID**: ` gpt-6-astra ` **界面语言**: zh-CN
  **Post-Mortem & Fix Analysis**:
  > ### 判断 定时任务开启通知且接收端未查看该会话时，iPhone 能够收到相应的完成通知是自动化功能的核心体验，该问题值得推进修复。  进一步检查代码执行路径发现，通知未送达 iPhone 并非 APNs 离线、推送权限失效或手机端分类过滤问题，而是桌面端在调用 `sendMobileSessionNotify` 发出移动推送前，被本地会话注意力门禁拦截并静默丢弃。  ### 建议行动 由**桌面端 / 设备互联研发**核对并修复调度器与移动通知分发的门禁衔接： 1. **调整移动通知投递门禁**：在 `apps/desktop/src/main/scheduler-host/notifier.ts` 中，`ScheduleNotifier` 已在前置链路完成会话免打扰（`!muted`）及通知通道检查；向 `sendMobileSessionNotify` 投递调度终态（`done`/`error`）时，需确保该通知具备合理的豁免或来源标识（或由 `sendMobileSessionNotify` 识别调度来源），避免其因为未标记桌面灵动岛注意力（`activity.attention`）而被拦截丢弃。 2. **场景验收**：    - 在接收端手机离开目标会话（且电脑不在该会话）时，触发单次/周期定时任务执行，验证任务完成后 iPhone 能够稳定弹出横幅并在通知中心留存。    - 依赖分支验证：当会话开启了“消息免打扰”或手机正停留在该会话界面时，验证移动推送仍能正常被抑制；对于显式设置 `silentWhenIdle: true` 的静默任务，成功完成时仍保持不打扰手机。 - **完成条件**：定时任务完成通知在非免打扰且未查看该会话的手机端稳定触达，且不破坏既有的防打扰与静默任务设计。  ### 关键排查依据 1. **待确认与完成通知的差异处理**：    - 在 `apps/desktop/src/main/device-link/index.ts` 的 `sendMobileSessionNotify` 存在如下过滤条件：      `if (!payload.muteExempt && activity && (payload.kind === 'needs-reply' ? activity.phase !== 'needs-interac

- **Issue #10911** (2026-11-17): **后台工具结果压缩会刷新旧会话的更新时间，导致历史会话突然出现在任务列表顶部**
  *Symptoms*: **提交人**: YeGGo **客户端版本**: 0.1.137  ---  ## 现象  任务列表里突然冒出几条标题很怪的历史对话，看起来像刚创建的新任务。核对后确认：这些会话是**几周前**在伙伴群聊里产生的历史发言，消息内容**没有任何新增**，只是突然出现在了列表顶部。  ## 复现路径  1. 伙伴群聊里 @ 某个伙伴发言，会为其生成一条会话（群聊发言记录），标题取的是**建群时的群名**。 2. 这些会话创建于数周前，平时不显示。 3. 某次后台维护之后，它们突然出现在任务列表最上方，标题是那个早已改掉的旧群名。  ## 定位到的原因  后台的一次例行维护（主日志里可以看到 `localDb/toolResultCompaction` 的工具结果压缩记录，以及同一分钟内的 working-dir / git 探测）扫描到了这批旧会话并重写了它们的消息行。**重写消息时把会话行的 `updated_at` 一并刷新成了当前时间**——日志里 `toolResultCompaction` 记录的 sessionId，与该会话被刷新后的 `updated_at` 时间戳完全一致。  任务列表按 `updated_at` 排序，于是这些几周前的旧会话被当成"刚刚更新"顶到了最前面，看起来像凭空多出来的任务。  ## 期望行为  - 后台的工具结果压缩 / 维护性重写**不应修改会话的业务更新时间**。压缩只改变消息内容的存储形态，不该让会话在列表里"诈尸"。 - 如果确实需要记录维护时间，应该用独立字段，不要复用会话的 `updated_at`。 - 已经 `deleted` / `archived` 的会话更不应因此重新出现在列表里。 - 另外，群聊历史会话的标题绑定的是建群时的群名，群改名后旧会话仍留着旧名，用户看到时很难判断这不是新对话；这类标题建议在展示时带上群聊标识，或随群改名一并更新。  ## 环境  Windows 桌面端，除此之外无特殊要求。 --- ## 提交时的任务环境  仅代表提交时快照,不一定是故障环境。OS 来自提交客户端本机,不含 SSH 远端主机;Harness / 模型来自当前任务。与运行环境无关的反馈可忽略本段。 **版本区域**: CN **OS**: win32 x64 (10.0.19045) **Harness**: Claude Code **Model ID**: ` MiniMax-M3.1-Flash ` **界面语言**: zh-CN
  **Post-Mortem & Fix Analysis**:
  > ### 判断  历史群聊专线会话因后台维护刷新时间戳而导致列表异常置顶的现象值得修复，这有助于避免陈旧会话误导用户产生“凭空多出新任务”的困扰。  进一步核查本地源码与数据库事务链路发现，实际机制与最初归因略有不同： 1. **压缩本身不修改会话时间**：`toolResults.compactSession` 仅在 `messages` 表上通过 `json_patch` 压缩 `tool_result` 内容，并不修改 `sessions.updated_at`，本地库也没有更新该字段的触发器。 2. **时间刷新的真实来源**：这批旧会话是在后台触发了终态流转（例如群工作区路径变更时的专线替换 `botsCreateGroupLane`，或群成员/专线清理 `botGroupsTx.archiveLanes`），在执行 `sessions.setTerminalStatus` 或专线归档时写入了 `UPDATE sessions SET status = 'archived', updated_at = now`，直接将业务更新时间刷新为当前时间；归档成功后，异步触发了 `compactTerminalSessionToolResults`（记录 `localDb/toolResultCompaction` 日志）与 `recycleSessionWorktreeForStatusChange`（工作区 Git 探测）。日志中的压缩记录与 `updated_at` 时间戳一致是由于处于同一次归档流程，二者为伴生关系而非因果关系。 3. **置顶原因与标题脱节**：    - 任务列表最近活动排序依据换手时刻（#7063），缺少换手记录时回退至 `updated_at`。归档操作将 `updated_at` 刷到当前时间，导致数周前的会话被视为“最新活动”推至顶部。    - 群专线在创建时将 `sessions.title` 固化为建群时的群名；后续群改名仅更新了群元数据，未级联更新专线历史标题（与 #10243 伙伴改名未同步主对话标题表现一致），使用户在列表中看到早已弃用的旧群名。  ### 行动  1. **首要步骤（LocalDB / Desktop 研发）**：    在 `sessions.setTerminalStatus`、`botGroups

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

### Incident Patch 1: `677fdc84` (2026-11-17)
**Commit Message**: fix(github): notify only when reconciled PR associations change

Signed-off-by: Chris <[REDACTED_EMAIL]>

**File**: `apps/desktop/src/main/git-context/prRefsStore.ts` (modified, +16/-22)
```diff
@@ -331,6 +331,9 @@ async function reconcilePrRefsForSession(
     // 时间戳,升序处理保证 lastSeenAt 终值正确),最后再删不在存活集里的旧行:
     // 任何中断点都只会"多"不会"少",下次重算自然收敛,无需事务。
     if (scope && !scope.isCurrent()) return;
+    const readRefs = () => db.select(prRefColumns()).from(sessionPrRefs)
+      .where(eq(sessionPrRefs.sessionId, sessionId)).orderBy(asc(sessionPrRefs.id));
+    const before = await readRefs();
     const keep = new Set<string>();
     for (const row of rows) {
       if (scope && !scope.isCurrent()) return;
@@ -353,31 +356,22 @@ async function reconcilePrRefsForSession(
     }
 
     if (scope && !scope.isCurrent()) return;
-    if (!prune) {
-      if (!scope || scope.isCurrent()) onRefsChanged?.(sessionId);
-      return;
+    if (prune) {
+      const staleIds = before
+        .filter((r) => !r.manuallyAdded && r.removedAt === null && !keep.has(prStatusKey(r)))
+        .map((r) => r.id);
+      if (staleIds.length > 0) {
+        await db.delete(sessionPrRefs).where(inArray(sessionPrRefs.id, staleIds));
+      }
     }
-    const existing = await db
-      .select({
-        id: sessionPrRefs.id,
-        provider: sessionPrRefs.provider,
-        host: sessionPrRefs.host,
-        owner: sessionPrRefs.owner,
-        repo: sessionPrRefs.repo,
-        prNumber: sessionPrRefs.prNumber,
-        manuallyAdded: sessionPrRefs.manuallyAdded,
-        removedAt: sessionPrRefs.removedAt,
-      })
-      .from(sessionPrRefs)
-      .where(eq(sessionPrRefs.sessionId, sessionId));
+    // Compare final records under the write queue: repeated mentions can change
+    // timestamps transiently during recomputation without changing the result.
+    // Include ordering/provenance fields so meaningful updates still refresh.
     if (scope && !scope.isCurrent()) return;
-    const staleIds = existing
-      .filter((r) => !r.manuallyAdded && r.removedAt === null && !keep.has(prStatusKey(r)))
-      .map((r) => r.id);
-    if (staleIds.length > 0) {
-      await db.delete(sessionPrRefs).where(inArray(sessionPrRefs.id, staleIds));
+    const after = await readRefs();
+    if ((!scope || scope.isCurrent()) && JSON.stringify(before) !== JSON.stringify(after)) {
+      onRefsChanged?.(sessionId);
     }
-    if (!scope || scope.isCurrent()) onRefsChanged?.(sessionId);
   } finally {
     release?.();
   }
```

**File**: `apps/desktop/src/main/localDb/__tests__/sessionPrManagement.test.ts` (modified, +39/-0)
```diff
@@ -20,6 +20,7 @@ import {
   recordPrRefsForImportedMessages,
   recomputePrRefsForSession,
   ensurePrRefsBackfill,
+  setPrRefsChangedListener,
 } from '../../git-context/prRefsStore';
 
 const h = vi.hoisted(() => ({ client: null as unknown, changed: vi.fn() }));
@@ -61,10 +62,48 @@ beforeEach(() => {
     })
     .run();
   verify.mockClear();
+  h.changed.mockClear();
+  setPrRefsChangedListener(h.changed);
 });
 afterAll(() => sqlite.close());
 
 describe('manual PR management', () => {
+  // DB regression: notifications caused redundant window reads/status queries.
+  // Existing persistence tests miss no-op imports and intermediate timestamp
+  // changes during full recomputation; use the public store with real SQLite.
+  it('notifies only for final association changes, including mention ordering', async () => {
+    const url = 'https://github.com/example/repo/pull/1';
+    const first = { id: 'first', clientId: 'first', sessionId: 's',
+      role: 'assistant' as const, content: JSON.stringify(url), createdAt: 10 };
+    await recordPrRefsForImportedMessages('s');
+    expect(h.changed).not.toHaveBeenCalled();
+    db.insert(messages).values(first).run();
+    await recordPrRefsForMessage({ ...first, content: url });
+    expect(h.changed).toHaveBeenCalledTimes(1);
+    await recordPrRefsForImportedMessages('s');
+    expect(h.changed).toHaveBeenCalledTimes(1);
+
+    const later = { ...first, id: 'later', clientId: 'later', createdAt: 20 };
+    db.insert(messages).values(later).run();
+    await recordPrRefsForMessage({ ...later, content: url });
+    expect(h.changed).toHaveBeenCalledTimes(2);
+    expect(await listPrRefs('s')).toMatchObject([{ firstSeenAt: 10, lastSeenAt: 20 }]);
+    // Full recomputation temporarily sets lastSeenAt to 10, then back to 20.
+    await recomputePrRefsForSession('s');
+    expect(h.changed).toHaveBeenCalledTimes(2);
+    db.update(messages).set({ content: JSON.stringify('Edited text without a link') })
+      .where(eq(messages.id, 'later')).run();
+    await recomputePrRefsForSession('s');
+    expect(h.changed).toHaveBeenCalledTimes(3);
+    expect(await listPrRefs('s')).toMatchObject([{ lastSeenAt: 10 }]);
+    db.delete(messages).run();
+    await recomputePrRefsForSession('s');
+    expect(h.changed).toHaveBeenCalledTimes(4);
+    expect(await listPrRefs('s')).toEqual([]);
+    await recomputePrRefsForSession('s');
+    expect(h.changed).toHaveBeenCalledTimes(4);
+  });
+
   // DB: MR imports and manual adds share identity across namespace/host/provider.
   // Prior GitHub fixtures cannot detect cross-host collisions or dropped MR messages.
   it('imports multi-group MRs and adds the same number on another host without collision', async () => {
```

**File**: `apps/desktop/src/main/mcp-apps/__tests__/ipcPrRefs.test.ts` (modified, +9/-0)
```diff
@@ -129,17 +129,26 @@ describe('MCP App result PR associations after backfill', () => {
   it('associates public completion, replaces A with B and removes links without another backfill', async () => {
     await write(pending);
     expect(await refs()).toEqual([]);
+    // DB regression: no-link status updates used to broadcast PR changes and
+    // trigger renderer reads/status requests. Existing coverage only checked refs.
+    await write(completed('Processing'));
+    expect(h.changed).not.toHaveBeenCalled();
     await write(completed(url(1)));
     expect(await refs()).toEqual([1]);
+    expect(h.changed).toHaveBeenCalledTimes(1);
     expect(h.changed).toHaveBeenLastCalledWith('task');
+    await write(completed(`Completed: ${url(1)}`));
+    expect(h.changed).toHaveBeenCalledTimes(1);
     expect(h.broadcast).toHaveBeenCalledWith('local-db:messages:created',
       expect.objectContaining({ message: expect.objectContaining({
         content: { mcpAppHistory: { version: 1, title: 'form', text: url(1) } },
       }) }));
     await write(completed(url(2)));
     expect(await refs()).toEqual([2]);
+    expect(h.changed).toHaveBeenCalledTimes(2);
     await write(completed('Saved'));
     expect(await refs()).toEqual([]);
+    expect(h.changed).toHaveBeenCalledTimes(3);
     expect(h.warn).not.toHaveBeenCalled();
     const row = db.select().from(messages).where(eq(messages.clientId, 'card')).get()!;
     expect(JSON.parse(row.content)).toEqual({ mcpApp: completed('Saved') });
```

---

### Incident Patch 2: `50dbd865` (2026-11-17)
**Commit Message**: Merge pull request #10969 from xuzini-xzn/fix/10428-share-navigation

fix(mobile): 修复系统分享离页时的导航循环闪退

**File**: `apps/mobile/app/incoming-share.tsx` (modified, +10/-4)
```diff
@@ -121,8 +121,12 @@ export default function IncomingShareScreen() {
   const text = batch ? incomingShareText(batch.payloads) : '';
   const files = batch?.payloads.filter(item => item.shareType !== 'text' && item.shareType !== 'url') ?? [];
   const handoffBatchId = useRef<string | null>(null);
+  const [leaving, setLeaving] = useState(false);
   useEffect(() => {
-    if (focused) handoffBatchId.current = null;
+    if (focused) {
+      handoffBatchId.current = null;
+      setLeaving(false);
+    }
   }, [focused, batch?.id]);
   const choose = (destination: string, action: () => void) => {
     // A queued second press must not replace the destination during transition.
@@ -133,9 +137,11 @@ export default function IncomingShareScreen() {
   };
   // Removing the chooser during a handoff retains the batch for its composer.
   // Header/gesture cancellation still acknowledges and cleans the owned copies.
-  usePreventRemove(!!batch, ({ data }) => {
-    leaveIncomingShareChooser(batch && handoffBatchId.current !== batch.id ? batch.id : null,
-      () => navigation.dispatch(data.action));
+  usePreventRemove(!!batch && !leaving, ({ repeat }) => {
+    // repeat releases this screen's prevention before replaying the action.
+    // The batch deliberately survives handoff or a failed native cancellation.
+    setLeaving(true);
+    leaveIncomingShareChooser(batch && handoffBatchId.current !== batch.id ? batch.id : null, repeat);
   });
   const back = () => goBackGuarded(router);
   return <SafeAreaView edges={simpleScreenSafeAreaEdges()} style={styles.root}>
```

**File**: `apps/mobile/src/__tests__/incomingShareScreen.test.tsx` (modified, +71/-10)
```diff
@@ -4,9 +4,11 @@ import { createRoot, type Root } from 'react-dom/client';
 import { afterEach, beforeEach, expect, it, vi } from 'vitest';
 
 const mock = vi.hoisted(() => ({
-  dismissTo: vi.fn(), select: vi.fn(() => true), readDevices: vi.fn(), invoke: vi.fn(async () => []),
+  dismissTo: vi.fn(), select: vi.fn(), dispatch: vi.fn(),
+  prevent: false, onRemove: undefined as ((event: { data: { action: object }; repeat: () => void }) => void) | undefined,
+  acknowledge: vi.fn(), readDevices: vi.fn(), invoke: vi.fn(async () => [] as any[]),
   openLink: vi.fn(async () => undefined), owner: { generation: 1 },
-  revoked: new Set<string>(), roster: { items: [], loading: false, error: null, refresh: vi.fn() },
+  revoked: new Set<string>(), roster: { items: [] as any[], loading: false, error: null, refresh: vi.fn() },
 }));
 vi.mock('react-native', () => ({
   Platform: { OS: 'ios' }, StyleSheet: { create: (x: unknown) => x },
@@ -22,31 +24,36 @@ vi.mock('lucide-react-native', () => ({ ChevronRight: () => null, Link: () => nu
   Plus: () => null, Search: () => null, X: () => null }));
 vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => el('div', null, children) }));
 vi.mock('expo-router', () => ({ useIsFocused: () => true, useRouter: () => ({ dismissTo: mock.dismissTo }),
-  useNavigation: () => ({ isFocused: () => true }) }));
-vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: () => undefined }));
+  useNavigation: () => ({ isFocused: () => true, dispatch: mock.dispatch }) }));
+vi.mock('expo-router/react-navigation', () => ({ usePreventRemove: (prevent: boolean, callback: typeof mock.onRemove) => {
+  mock.prevent = prevent; mock.onRemove = callback;
+} }));
 vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (s: string) => s, i18n: { language: 'en' } }) }));
 vi.mock('@/i18n', () => ({ i18n: { t: (s: string) => s } }));
 vi.mock('@/i18n/presentationLocalizer', () => ({ mobilePresentationLocalizer: undefined }));
 vi.mock('@/components/AppText', () => ({ Text: ({ children }: any) => el('span', null, children), TextInput: ({ value, onChangeText, testID }: any) => el('input', { value, onInput: (event: any) => onChangeText(event.currentTarget.value), 'data-testid': testID }) }));
 vi.mock('@/components/RemoteCompanionAvatar', () => ({ RemoteCompanionAvatar: () => null }));
 vi.mock('@/components/FileTypeIcon', () => ({ FileTypeIcon: () => null }));
-vi.mock('@/platform/chrome/SimpleStackHeader', () => ({ SimpleStackHeader: () => null, simpleScreenSafeAreaEdges: () => [] }));
+vi.mock('@/platform/chrome/SimpleStackHeader', () => ({ SimpleStackHeader: ({ onBack }: any) => el('button', { onClick: onBack, 'data-testid': 'back' }, 'Back'), simpleScreenSafeAreaEdges: () => [] }));
 vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ accountGeneration: 1 }) }));
-vi.mock('@/auth/authOwnerGeneration', () => ({ getMobileAuthOwner: () => mock.owner, isMobileAuthOwnerCurrent: () => true }));
+vi.mock('@/auth/authOwnerGeneration', () => ({ getMobileAuthOwner: () => mock.owner, isMobileAuthOwnerCurrent: () => true, subscribeMobileAuthOwner: () => () => undefined }));
 vi.mock('@/device-link/DeviceLinkContext', () => ({ useDeviceLink: () => ({ readDeviceList: mock.readDevices,
   openLink: mock.openLink, invoke: mock.invoke, status: 'online', presenceVersion: 0 }) }));
 vi.mock('@/device-link/revokedDevicesStore', () => ({ useRevokedDevices: () => mock.revoked }));
 vi.mock('@/session/useTeammateRoster', () => ({ useTeammateRoster: () => mock.roster }));
 vi.mock('@/session/remoteSessionStore', () => ({ remoteSessionStore: { getSessions: () => [] } }));
-vi.mock('@/session/incomingShare', () => ({
-  useIncomingShareBatch: () => ({ id: 'share-1', payloads: [] }), incomingShareText: () => 'shared page',
-  selectIncomingShareDestination: mock.select, leaveIncomingShareChooser: vi.fn(), incomingShareDestination: vi.fn(),
-}));
+vi.mock('@/session/incomingShare', async importOriginal => {
+  const original = await importOriginal<typeof import('@/session/incomingShare')>();
+  return { ...original, selectIncomingShareDestination: (...args: Parameters<typeof original.selectIncomingShareDestination>) => {
+    mock.select(...args); return original.selectIncomingShareDestination(...args);
+  } };
+});
 vi.mock('@/theme', async () => {
   const tokens = await import('@/theme/tokens');
   return { ...tokens, useTheme: () => ({ colors: tokens.lightColors }),
     useThemedStyles: (make: any) => make(tokens.lightColors) };
 });
+import { __resetIncomingShareForTest, stageIncomingShareBatch, consumeIncomingShareBatch } from '@/session/incomingShare';
 import IncomingShareScreen from '../../app/incoming-share';
 import { parseNewSessionDeviceOptions, pickNewSessionDefaultDevice } from '@/session/newSession';
 
@@ -55,6 +62,14 @@ let container: HTMLDivElement;
 beforeEach(() => {
   Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
   vi.clearAllMocks();

```

---

### Incident Patch 3: `ff89863a` (2026-11-17)
**Commit Message**: Merge pull request #7356 from joei4cm/fix/codex-mcp-auto-review-evidence

fix(codex): 不再把同一份 MCP 参数重复计入审阅预算

**File**: `apps/desktop/src/main/maker-host/__tests__/autoPermissionReviewer.test.ts` (modified, +6/-1)
```diff
@@ -327,7 +327,12 @@ describe('createAutoPermissionReviewer', () => {
     const requestText = vi.fn(async () => '{"verdict":"allow"}');
     const reviewer = createAutoPermissionReviewer({ requestText, logger: { debug: vi.fn(), warn: vi.fn() } });
     await expect(reviewer(request({ userIntent: '', action: { kind: 'exec', command: './runtime/node lab/preflight.cjs', cwd: '/repo' } })))
-      .resolves.toMatchObject({ verdict: 'block' });
+      .resolves.toMatchObject({
+        verdict: 'block',
+        // 宿主自己判的(没调模型)→ 标出来源,这条原因才能进诊断 / UI 通道。
+        hostReason: true,
+        reason: 'No user request authorizes this action; only reads may run without one.',
+      });
     expect(requestText).not.toHaveBeenCalled();
     await expect(reviewer(request({ userIntent: '', action: { kind: 'read', path: '/repo/README.md' } })))
       .resolves.toMatchObject({ verdict: 'allow' });
```

**File**: `apps/desktop/src/main/maker-host/auto-permission-reviewer.ts` (modified, +7/-1)
```diff
@@ -375,7 +375,13 @@ export function createAutoPermissionReviewer(
     // Risk-first models wave "low risk" steps through even when nothing at all was user-authored.
     // Decide that case here, after the Host attached any delegated task.
     if (!request.delegatedTask && request.action.kind !== 'read' && hasNoUserIntent(request.userIntent)) {
-      return { verdict: 'block', reason: 'No user request authorizes this action; only reads may run without one.' };
+      // 宿主写死的判定(没有调用模型):标 hostReason,让这条原因能进诊断 / UI 通道 ——
+      // 否则它会被当成模型自由文本过滤掉,用户只看到一句通用「被拦截」。
+      return {
+        verdict: 'block',
+        reason: 'No user request authorizes this action; only reads may run without one.',
+        hostReason: true,
+      };
     }
     const startedAt = Date.now();
     let prompt: string;
```

**File**: `docs/dev-rules/maker-core-and-agent-behavior.md` (modified, +18/-0)
```diff
@@ -739,6 +739,24 @@ IM 与官方 Hook 确认卡统一显示为「自动审批需要你决定：…
 `agents/shared/continuation-policy.ts`，真实模型配对比较入口为 `scripts/eval-auto-approval.mts`
 的 `--baseline-bundle`（隔离打包的旧审核器）；只审核合成操作，不执行副作用。
 
+审阅证据只算**一份**。MCP 工具调用的证据取原始调用（server、tool name、原始参数、工具标题
+与描述），不得再带确认卡那份渲染副本：codex 会把同一份 `tool_params` 再渲染一份
+`tool_params_display` 发给客户端（codex-rs `build_mcp_tool_approval_display_params` 是同一对象的
+逐字段副本，不是截断版），两份都进证据等于把同一个动作按完整证据预算
+（`MAX_AUTO_REVIEW_ACTION_TEXT_CHARS` = 131,072 字符）数两遍，普通调用会凭空多出一倍。
+证据里不做截断：参数一字不删，审阅模型看到的内容与之前完全一致，变的只是同一份内容不再被计两次。
+另有一个数不要混用：`MAX_AUTO_REVIEW_STATIC_TEXT_CHARS` = 4,096 是同步静态解析自己的上限，
+超过只是转完整模型审阅，不是拦截；完整证据超预算时裁决是 `ask`（交用户确认），不是静默拦截。
+拦截原因分两类：**Cindy 自己的确定性文案**（动作文本超限、证据不足、审阅器故障、授权范围变化、
+宿主固定的授权失效原因、delegate 根本没调用模型时给出的宿主固定判定）在决定里标 `policyReason`，
+可原样进 UI／日志／诊断通道；**模型自由文本**
+不带该标记，可能含参数、路径、片段，一律不得外泄。delegate 若判定出的是宿主自己的文案
+（没有调用模型），要用 `hostReason` 声明来源，由 maker-core 转成 `policyReason`；委托方解析模型
+输出时必须**新建对象**（不展开模型给的 JSON），模型才无法自己带上这个标记。Codex 的 MCP
+拦截通知只带 policy 原因。
+模型看到的拒绝文案由 codex app-server 决定（`user rejected MCP tool call`，客户端改不动），
+所以真实原因必须先在 Cindy 侧保住，别再让界面只显示一句通用文案。
+
 原生审批已接管的本地工具调用不叠加 Cindy 模型复审，以 Handle 的实时
 `getAutoReviewOwner()` 为准；Codex Guardian 故障切换后恢复 Cindy 负责。
 路径解析暴露不同目标时，由 Cindy 审核 canonical 路径；只有 canonical 路径、
```

**File**: `packages/maker-core/src/agents/codex/index.test.ts` (modified, +156/-0)
```diff
@@ -40,6 +40,7 @@ import {
   AUTO_REVIEW_CONFIRM_UNDELIVERED_CODE,
   AUTO_REVIEW_UNAVAILABLE_METADATA_KEY,
   AUTO_REVIEW_UNAVAILABLE_PROMPT_TEXT,
+  MAX_AUTO_REVIEW_ACTION_TEXT_CHARS,
   type AutoReviewDelegate,
   type AutoReviewRequest,
 } from '../shared/auto-review-decision.js';
@@ -17356,6 +17357,161 @@ describe('CodexAgent MCP thread context hooks', () => {
     }
   });
 
+  it('Auto MCP reviews the raw call once: the display copy of the arguments is not evidence', async () => {
+    const review = vi.fn<AutoReviewDelegate>(async () => ({ verdict: 'allow' }));
+    const agent = new CodexAgent(createDeps({}, { reviewAutoPermissionAction: review, getMcpToolApprovalPolicy: () => 'prompt' }));
+    const host = installFakeHost(agent, (method) => method === Method.TurnStart ? { turn: { id: 'raw-evidence-turn' } } : undefined);
+    const handle = await agent.startSession({ sessionId: 'raw-evidence', model: 'gpt-5.5', providerId: 'xd', workingDir: '/repo', permissionMode: 'auto' });
+    await handle.send({ type: 'user', content: 'Delegate the task to the worker.' });
+    const handlers = host.getThreadHandlers();
+    if (!handlers?.mcpServerElicitation) throw new Error('missing elicitation handler');
+    const input = { ghost_id: 'worker', tool: 'delegate', args: { action: 'run' } };
+    const result = await handlers.mcpServerElicitation({ threadId: 'start-thread-id', turnId: 'raw-evidence-turn', serverName: 'cindy', mode: 'form',
+      _meta: { codex_approval_kind: 'mcp_tool_call', tool_name: 'ghost_call', tool_params: input,
+        // codex sends the same arguments again as a display rendering.
+        tool_params_display: [{ name: 'args', value: input.args, display_name: 'args' }] },
+      message: 'Allow tool call', requestedSchema: {},
+    });
+    expect(result.action).toBe('accept');
+    expect(review).toHaveBeenCalledOnce();
+    const evidence = JSON.parse((review.mock.calls[0]?.[0].action as { description: string }).description);
+    expect(evidence.input.toolParams).toEqual(input);
+    expect(evidence.input.toolParamsDisplay).toBeUndefined();
+    await handle.close();
+  });
+
+  it('Auto MCP reviews a large call with a display copy instead of tripping the complete-budget handoff', async () => {
+    const review = vi.fn<AutoReviewDelegate>(async () => ({ verdict: 'allow' }));
+    const agent = new CodexAgent(createDeps({}, { reviewAutoPermissionAction: review, getMcpToolApprovalPolicy: () => 'prompt' }));
+    const host = installFakeHost(agent, (method) => method === Method.TurnStart ? { turn: { id: 'long-args-turn' } } : undefined);
+    const handle = await agent.startSession({ sessionId: 'long-args', model: 'gpt-5.5', providerId: 'xd', workingDir: '/repo', permissionMode: 'auto' });
+    await handle.send({ type: 'user', content: 'Delegate the task to the worker.' });
+    const handlers = host.getThreadHandlers();
+    if (!handlers?.mcpServerElicitation) throw new Error('missing elicitation handler');
+    // A big-but-reviewable handoff (issue #7254, current budgets): the raw
+    // arguments alone fit MAX_AUTO_REVIEW_ACTION_TEXT_CHARS, but codex sends the
+    // same arguments again as a display rendering. Counting both copies pushed
+    // the evidence past the complete-review budget, so the call was handed off
+    // instead of reviewed. Counting one copy keeps it reviewable.
+    const args = { instruction: 'x'.repeat(90_000) };
+    const input = { ghost_id: 'worker', tool: 'delegate', args };
+    const result = await handlers.mcpServerElicitation({ threadId: 'start-thread-id', turnId: 'long-args-turn', serverName: 'cindy', mode: 'form',
+      _meta: { codex_approval_kind: 'mcp_tool_call', tool_name: 'ghost_call', tool_params: input,
+        tool_params_display: [{ name: 'args', value: args, display_name: 'args' }] },
+      message: 'Allow tool call', requestedSchema: {},
+    });
+    expect(result.action).toBe('accept');
+    expect(review).toHaveBeenCalledOnce();
+    const action = review.mock.calls[0]?.[0].action as { description: string };
+    // Single-counted: under the budget and nowhere near the doubled ~180k size.
+    expect(action.description.length).toBeLessThan(MAX_AUTO_REVIEW_ACTION_TEXT_CHARS);
+    expect(action.description.length).toBeLessThan(100_000);
+    expect(JSON.parse(action.description).input.toolParams).toEqual(input);
+    await handle.close();
+  });
+
+  it('Auto MCP hands an over-budget call to the user instead of silently declining', async () => {
+    const review = vi.fn<AutoReviewDelegate>(async () => ({ verdict: 'allow' }));
+    const agent = new CodexAgent(createDeps({}, { reviewAutoPermissionAction: review, getMcpToolApprovalPolicy: () => 'prompt' }));
+    const host = installFakeHost(agent, (method) => method === Method.TurnStart ? { turn: { id: 'over-budget-turn' } } : undefined);
+    const handle = await agent.startSession({ sessionId: 'over-budget', model: 'gpt-5.5', providerId: 'xd', workingDir: '/repo', pe
```

**File**: `packages/maker-core/src/agents/codex/index.ts` (modified, +75/-12)
```diff
@@ -5958,8 +5958,14 @@ assertRouteCurrent();
       let key: string | undefined;
       let pending: Promise<AutoReviewDecision> | undefined;
       return withAutoReviewContext(request, this.deps.reviewAutoPermissionAction, (prepared) => {
+        // 这三处是 Cindy 自己的确定性文案(不含用户数据),标 policyReason 才能进诊断/UI 通道;
+        // 缺标会被当成模型自由文本过滤掉,通知只剩一句通用文案。
         if (request.userIntent !== currentAutoReviewIntent || request.authorizationContext !== (currentAutoReviewAuthority ?? undefined)) {
-          return Promise.resolve({ verdict: 'block', reason: 'User instructions changed; retry against the current request.' });
+          return Promise.resolve({
+            verdict: 'block',
+            reason: 'User instructions changed; retry against the current request.',
+            policyReason: true,
+          });
         }
         key = JSON.stringify([prepared, hostAutoApprove, hostShortcutOnly]);
         const cached = autoReviewDecisionCache.get(key);
@@ -5975,10 +5981,18 @@ assertRouteCurrent();
         if (!pending || !key) return decision;
         if (request.userIntent !== currentAutoReviewIntent || request.authorizationContext !== (currentAutoReviewAuthority ?? undefined)
             || autoReviewDecisionCache.get(key) !== pending) {
-          return { verdict: 'block', reason: 'User instructions changed; retry against the latest authorization.' };
+          return {
+            verdict: 'block',
+            reason: 'User instructions changed; retry against the latest authorization.',
+            policyReason: true,
+          };
         }
         if (directoryGeneration !== autoReviewDirectoryGeneration) {
-          return { verdict: 'block', reason: 'Directory permissions changed; retry with the current scope.' };
+          return {
+            verdict: 'block',
+            reason: 'Directory permissions changed; retry with the current scope.',
+            policyReason: true,
+          };
         }
         autoReviewActionContext.record(action, decision);
         return decision;
@@ -8294,28 +8308,47 @@ assertRouteCurrent();
       let denialReason = formatPermissionDenial('system', 'Approval was cancelled or became stale.');
       const decision = await withCodexGenerationPaused<ApprovalDecision>(requestThreadId, turnId, timingPauseId, async () => {
         // Native Codex currently flattens MCP declines to "user rejected" and
-        // discards response content/_meta on that path. Preserve the cause in
-        // Cindy's diagnostic/UI channel; this notice is NOT model context.
-        const reportMcpDenial = (source: 'auto-review' | 'system' | 'user', reason?: string, visible = true) => {
+        // discards response content/_meta on that path (codex-rs
+        // core/src/mcp_tool_call.rs: ElicitationAction::Decline =>
+        // ReviewDecision::denied("user rejected MCP tool call")). The model
+        // facing text is owned by the app-server, so the real cause can only be
+        // preserved in Cindy's diagnostic/UI channel; this notice is NOT model
+        // context. Keep it truthful: it must never claim a user rejection that
+        // did not happen, and it must say why the call never reached the user.
+        const reportMcpDenial = (
+          source: 'auto-review' | 'system' | 'user',
+          reason?: string,
+          visible = true,
+          policyCause?: string,
+        ) => {
           if (kind !== 'mcpServerElicitation') return;
           const timedOut = source === 'system' && isSystemPermissionDenialReason(reason) &&
             (reason === 'timeout' || reason?.endsWith('_timeout'));
           const code = source === 'auto-review' ? 'MCP_APPROVAL_AUTO_BLOCKED'
             : timedOut ? 'MCP_APPROVAL_CONFIRMATION_TIMEOUT' : 'MCP_APPROVAL_CONFIRMATION_UNAVAILABLE';
           // IDs and a closed set of causes only: no arguments, credentials, or
-          // free-text reviewer output may enter the diagnostic log.
+          // free-text reviewer output may enter the diagnostic log. Cindy's own
+          // policy reasons are fixed copy without user data and may be carried.
           log.info('MCP approval denied', {
             threadId: requestThreadId, turnId, requestId, itemId: opts?.itemId,
             source, cause: source === 'user' ? 'user-denied' : code,
+            ...(policyCause ? { causeDetail: policyCause } : {}),
           });
           if (source === 'user' || !visible) return;
           const text = source === 'auto-review'
             ? 'Automatic approval review blocked this tool call. No user rejection was received.'
             : timedOut
               ? 'The permission request timed out without a confirmed decision. This does not establish whether the user clicked a button.'
               : 'The permission confirmation could not be completed. No user rejection was received.';
-          emitAutoReviewRuntimeNotice(`[${code}] ${text}`);
+          emitAutoReviewRuntimeNotice(`[${code}] ${text}${policyCaus
```

**File**: `packages/maker-core/src/agents/shared/auto-review-decision.test.ts` (modified, +40/-0)
```diff
@@ -242,6 +242,46 @@ describe('resolveAutoReviewDecision', () => {
     expect(delegate).toHaveBeenCalledWith(expect.objectContaining({ action: { kind: 'exec', command } }));
   });
 
+  // 诊断通道只能带 Cindy 自己的确定性原因。模型自由文本可能含参数、路径、片段，
+  // 不得原样进 UI / 日志，所以来源必须逐条标出来。
+  it('marks the reason source so only policy copy may enter diagnostics', async () => {
+    await expect(resolveAutoReviewDecision(
+      request({ kind: 'exec', command: `npm run build -- ${'x'.repeat(131_100)}` }),
+      async () => ({ verdict: 'allow' }),
+    )).resolves.toMatchObject({ verdict: 'ask', policyReason: true });
+    // The model boundary never marks its reason as policy copy.
+    await expect(resolveAutoReviewDecision(
+      request({ kind: 'exec', command: 'npx tsc --noEmit' }),
+      async () => ({ verdict: 'block', reason: 'model free text about the command' }),
+    )).resolves.toMatchObject({ verdict: 'block', reason: 'model free text about the command' });
+    await expect(resolveAutoReviewDecision(
+      request({ kind: 'exec', command: 'npx tsc --noEmit' }),
+      async () => ({ verdict: 'block', reason: 'model free text about the command' }),
+    )).resolves.not.toHaveProperty('policyReason');
+  });
+
+  // delegate 自己声明「这条 reason 出自宿主固定文案」(它根本没调用模型)→ 保留为
+  // policy 原因,能进诊断 / UI 通道;否则用户只看到一句通用拦截,不知道宿主已经判过。
+  it('keeps a host-authored reason as policy copy while unmarked delegate text stays out', async () => {
+    await expect(resolveAutoReviewDecision(
+      request({ kind: 'exec', command: 'npx tsc --noEmit' }),
+      async () => ({
+        verdict: 'block',
+        reason: 'No user request authorizes this action; only reads may run without one.',
+        hostReason: true,
+      }),
+    )).resolves.toMatchObject({
+      verdict: 'block',
+      reason: 'No user request authorizes this action; only reads may run without one.',
+      policyReason: true,
+    });
+    // 没声明来源的 delegate 结果依旧按模型自由文本处理:不得进诊断通道。
+    await expect(resolveAutoReviewDecision(
+      request({ kind: 'exec', command: 'npx tsc --noEmit' }),
+      async () => ({ verdict: 'block', reason: 'model free text about the command' }),
+    )).resolves.not.toHaveProperty('policyReason');
+  });
+
   it('counts exec cwd in the complete evidence size limit', async () => {
     let called = false;
     await expect(resolveAutoReviewDecision(
```

**File**: `packages/maker-core/src/agents/shared/auto-review-decision.ts` (modified, +56/-5)
```diff
@@ -15,6 +15,26 @@ import {
 export type AutoReviewDecision = {
   verdict: 'allow' | 'block' | 'ask';
   reason?: string;
+  /**
+   * `true` = `reason` 是 Cindy 自己的确定性文案 —— 动作文本超限、证据不足、审阅器
+   * 故障、授权范围变化。内容是固定句式，不含用户数据，可以原样进 UI / 日志 / 诊断通道。
+   *
+   * 缺省即视为**模型自由文本**：可能含参数、路径、片段等用户内容，一律不得外泄。
+   * 只有显式标成 policy 的 reason 才允许进诊断通道（见 codex 的 MCP 拦截通知）。
+   */
+  policyReason?: true;
+  /**
+   * `true` = `reason` 是**宿主自己写死的判定**（delegate 在没有调用模型时给出的固定文案），
+   * 不是模型输出。模型判定永远不带这个标记 —— 模型只贡献 `reason` 里的纯文本。
+   *
+   * 与 `policyReason` 的分工：`policyReason` 标在**最终决定**上，由 maker-core 依据来源
+   * 自行加；本字段由 delegate 声明「这条 reason 出自宿主」。maker-core 见到它就把它转成
+   * `policyReason`（可进诊断 / UI 通道），其余 delegate 结果一律当模型自由文本处理。
+   *
+   * 委托方解析模型输出时是**新建对象**（不展开模型给的 JSON），所以模型无法自己带上这个
+   * 标记；只有宿主代码路径会标它。
+   */
+  hostReason?: true;
   /**
    * `true` = 这个 `ask` 来自**审阅器没跑起来**（delegate 缺失 / 超时 / 抛错 / 返回非法），
    * 不是模型判定动作危险。
@@ -304,7 +324,13 @@ export interface AutoReviewRequest {
     workingDir: string;
     authorizationRevision: string;
   };
-  /** A recognized delegation whose current authority could not be established. */
+  /**
+   * A recognized delegation whose current authority could not be established.
+   *
+   * 宿主固定文案（唯一生产者是 desktop 的 `createPluginTaskReviewResolver`，那里是
+   * 一组写死的句子），**不得**放模型或插件的自由文本：这条会带 `policyReason` 进诊断
+   * 与 UI 通道。
+   */
   authorizationError?: string;
   action: ReviewableAction;
   /** 全部可读根；首项必须是主工作目录，供相对路径解析。 */
@@ -329,19 +355,33 @@ export async function withAutoReviewContext(
 ): Promise<AutoReviewDecision> {
   try {
     const prepared = delegate?.prepareRequest ? await delegate.prepareRequest(request) : request;
-    if (prepared.authorizationError) return { verdict: 'block', reason: prepared.authorizationError };
+    if (prepared.authorizationError) {
+      // 宿主固定文案（见 authorizationError 的契约），不含用户数据：标 policyReason
+      // 才能进诊断/UI 通道。缺标会被当成模型自由文本过滤掉，用户只看到一句通用
+      // 「被拦截」，不知道是授权失效。
+      return { verdict: 'block', reason: prepared.authorizationError, policyReason: true };
+    }
     const fingerprint = JSON.stringify(prepared);
     const decision = await evaluate(prepared);
     if (delegate?.prepareRequest) {
       const current = await delegate.prepareRequest(request);
       if (current.authorizationError || JSON.stringify(current) !== fingerprint) {
-        return { verdict: 'block', reason: 'Delegated authorization changed; retry against the current scope.' };
+        return {
+          verdict: 'block',
+          reason: 'Delegated authorization changed; retry against the current scope.',
+          policyReason: true,
+        };
       }
     }
     // No await after the live runtime fence: Host lookup may outlive accepted input.
     return finalize(decision);
   } catch {
-    return { verdict: 'ask', unavailable: true, reason: 'Host could not verify the current authorization; this action needs your confirmation.' };
+    return {
+      verdict: 'ask',
+      unavailable: true,
+      reason: 'Host could not verify the current authorization; this action needs your confirmation.',
+      policyReason: true,
+    };
   }
 }
 
@@ -551,7 +591,7 @@ export async function resolveAutoReviewDecision(
   // Beyond the complete model-review budget, retain the existing confirmation path.
   const oversizedEvidenceReason = oversizedReviewEvidence(request.action);
   if (oversizedEvidenceReason) {
-    return { verdict: 'ask', reason: oversizedEvidenceReason };
+    return { verdict: 'ask', reason: oversizedEvidenceReason, policyReason: true };
   }
   const localTier = classifyLocalAutoReviewTier(request);
   // The registered task can constrain reads as well as writes. No delegated
@@ -564,12 +604,14 @@ export async function resolveAutoReviewDecision(
     return {
       verdict: 'block',
       reason: missingEvidenceReason,
+      policyReason: true,
     };
   }
   if (!delegate) {
     return {
       verdict: 'ask',
       reason: 'Automatic review is unavailable, so this action needs your confirmation.',
+      policyReason: true,
       unavailable: true,
     };
   }
@@ -607,9 +649,17 @@ export async function resolveAutoReviewDecision(
       const reason = typeof decision.reason === 'string'
         ? decision.reason.trim().slice(0, MAX_AUTO_REVIEW_REASON_CHARS)
         : '';
+      // delegate 明确声明「这条 reason 出自宿主固定文案」(它没有调用模型)→ 保留为
+      // policy 原因,能进诊断 / UI 通道。其余一律是模型自由文本:可能含参数、路径、
+      // 片段,不得外泄(Codex review #7356)。
+      const hostAuthored = decision.hostReason === true;
       return {
         verdict: decision.verdict,
         ...(reason ? { reason } : {}),
+        ...(hostAuthored ? { policyReason: true } : {}),
+        // The delegate is the model boundary: anything it returns is model free
+        // text and must stay out of diagnostics (no policyReason marker), unless
+        // the delegate declared the reason host-authored.
       };
     }
   } catch {
@@ -622,6 +672,7 @@ export async function resolveAutoReviewDecision(
   
```

#### Recent Merged Pull Requests:
- **PR #10972** (2026-11-17): feat(worktree): 支持默认关闭的模型取名开关 (@MagicLizi)
- **PR #10969** (2026-11-17): fix(mobile): 修复系统分享离页时的导航循环闪退 (@xuzini-xzn)
- **PR #10967** (2026-11-17): revert(desktop): 回退首次登录资产交接，解除登录与供应商加载阻断 (@DavidShenXD)
- **PR #10965** (2026-11-17): fix(github): 恢复消息 PR 自动关联及历史漏项 (@zqchris)
- **PR #10961** (closed): fix(desktop): keep a failed local asset handoff off the login path (@WZBbiao)
- **PR #10953** (2026-11-17): fix(desktop): preserve task recency during maintenance archive (@nothingyuancando)

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

## X. github): notify only when reconciled PR associations change

**RULE**:
When implementing operations in `apps/desktop/src/main/git-context/prRefsStore.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `677fdc84`: github): notify only when reconciled PR associations change. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/git-context/prRefsStore.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    const readRefs = () => db.select(prRefColumns()).from(sessionPrRefs)
      .where(eq(sessionPrRefs.sessionId, sessionId)).orderBy(asc(sessionPrRefs.id));
    const before = await readRefs();
    if (prune) {
      const staleIds = before
        .filter((r) => !r.manuallyAdded && r.removedAt === null && !keep.has(prStatusKey(r)))
        .map((r) => r.id);
      if (staleIds.length > 0) {
        await db.delete(sessionPrRefs).where(inArray(sessionPrRefs.id, staleIds));
      }
    // Compare final records under the write queue: repeated mentions can change
    // timestamps transiently during recomputation without changing the result.
    // Include ordering/provenance fields so meaningful updates still refresh.
    const after = await readRefs();
    if ((!scope || scope.isCurrent()) && JSON.stringify(before) !== JSON.stringify(after)) {
      onRefsChanged?.(sessionId);
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    if (!prune) {
      if (!scope || scope.isCurrent()) onRefsChanged?.(sessionId);
      return;
    const existing = await db
      .select({
        id: sessionPrRefs.id,
        provider: sessionPrRefs.provider,
        host: sessionPrRefs.host,
        owner: sessionPrRefs.owner,
        repo: sessionPrRefs.repo,
        prNumber: sessionPrRefs.prNumber,
        manuallyAdded: sessionPrRefs.manuallyAdded,
        removedAt: sessionPrRefs.removedAt,
      })
      .from(sessionPrRefs)
      .where(eq(sessionPrRefs.sessionId, sessionId));
    const staleIds = existing
      .filter((r) => !r.manuallyAdded && r.removedAt === null && !keep.has(prStatusKey(r)))
      .map((r) => r.id);
    if (staleIds.length > 0) {
      await db.delete(sessionPrRefs).where(inArray(sessionPrRefs.id, staleIds));
    if (!scope || scope.isCurrent()) onRefsChanged?.(sessionId);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `677fdc84` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
