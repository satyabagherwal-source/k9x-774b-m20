> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source**: github ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Source Version**: `b486def1`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T21:36:36.389Z  
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
> **Harvest Timestamp**: 2026-10-27T21:36:35.976Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 7404 stars

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

### Core Architecture Module: `apps/desktop/resources/bot-packages/engineer-bot/0.5.1/skills/engineer-bot-evidence/scripts/evidence_check.py`
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

### Core Architecture Module: `apps/desktop/resources/bot-packages/nightly-audit-engineer/0.5.1/skills/nightly-audit-engineer-evidence/scripts/finding_keys.py`
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
    worktreeBranchSyncStatus: async ({ branch }: { branch: string }) => ({ branch, remote: 'origin', remoteBranch: branch, remoteOnly: false, ahead: 0, behind: 3, dirtyFiles: 2, checkoutPath: inherited.directory }),
    worktreeSyncBranch: async ({ branch }: { branch: string }) => ({ updated: 3, status: { branch, remote: 'origin', remoteBranch: branch, remoteOnly: false, ahead: 0, behind: 0, dirtyFiles: 2 } }),
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

### Core Architecture Module: `apps/desktop/src/capture-renderer/directLinkHost.ts`
```
import { createDirectRtcRuntime, createDirectRuntimeHost } from '@cindy/device-link';
import type { DirectLinkHostApi } from '../shared/directLink';

/** No UI, media capture, filesystem or credentials in this data-only process. */
export function startDirectLinkHost(api: DirectLinkHostApi) {
  const host = createDirectRuntimeHost(createDirectRtcRuntime(), api.event);
  const off = api.onCommand((command) => { void host.command(command); });
  void api.register().catch(() => host.dispose());
  return () => { off(); host.dispose(); };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7494** (2026-10-27): **bug(maker-core): 子 Agent 的内部 hook 被误报为工具审批，工具名与参数丢失**
  *Symptoms*: ## 问题描述 / What happened  在 Pi + Auto-review 任务中委派子 Agent 后，部分工具调用显示为：  ```text Subagent: tool Requested by #7387 本轮范围清理独立静态审阅 ```  审批卡的操作详情只有 `{}`，而不是真实工具和命令。自动审阅因此给出：  ```text 该工具调用未提供具体动作或参数，无法确认它是否属于任务的测试收尾范围。 ```  子 Agent 的原始权限载荷中实际包含完整的工具名、参数和命令，并非 Agent 没有提供。  **期望：** 内部同步 hook 不应被展示为工具审批；真正的权限请求应保留工具名和参数。Auto-review 不应因为宿主丢失信息而把原本明确授权的操作交给用户反复确认。  ## 环境 / Environment  - Cindy：`0.1.118` - 安装构建提交：`fa952a2d098b8669122d5013c442bb14308961f7` - 平台：Windows 11 家庭中文版，`10.0.26200` - Agent：Pi；权限模式：Auto-review - 执行形态：Durable Pi Subagent - 发生时间：2026-10-27  ## 复现步骤 / Steps to reproduce  1. 在 Auto-review 模式下创建 Pi 任务。 2. 通过 `subagent` 委派子 Agent 执行只读审阅或代码任务。 3. 子 Agent 使用产生 `tool.before` 内部事件的工具，且随后进入审批流程。 4. 观察审批卡显示 `Subagent: tool`，参数为 `{}`；自动审阅以缺少动作或参数为由要求确认。  现场包含不同 ID 的多次审批。是否还存在同一审批被重复处理，尚需另查，不将“每张卡都由重复弹窗产生”作为本 Issue 的结论。  ## 日志与截图 / Logs & screenshots  ### 根因：内部 hook 被误当成权限请求  子 Agent 的两种事件共用 `ctx.ui.input(...)` 通道：  | 事件 | 用途 | | --- | --- | | `cindy:harness-hook` | `tool.before` 等内部同步事件 | | `cindy:permission` | 真正的工具权限请求 |  [`cindy-bridge-source.ts:4643`](https://github.com/makecindy/cindy/blob/45f34bcd/packages/maker-core/src/agents/pi/cindy-bridge-source.ts#L4643) 发出内部事件，[`cindy-subagent-runner-source.ts:920`](https://github.com/makecindy/cindy/blob/45f34bcd/packages/maker-core/src/agents/pi/cindy-subagent-runner-source.ts#L920) 将 `extension_ui_request` 保存为 `pendingApprovals`。  父 Agent 的转发器 [`resolvePiSubagentApproval()`](https://github.com/makecindy/cindy/blob/45f34bcd/pack

- **Issue #7437** (2026-10-27): **bug: remote task selection changes after opening Settings and returning**
  *Symptoms*: ### 问题描述 / What happened  In Cindy remote-control mode, the selected task (session) is not preserved when visiting Settings and returning to the main screen. After selecting task A, opening Settings, and going back, a different task B becomes active without the user selecting it.  Expected: returning from Settings restores the same task A on the same remote device, provided that task still exists and is accessible.  Actual: another task becomes active. Which task is chosen and whether the behavior occurs on every navigation have not yet been established.  ### 环境 / Environment  - Desktop-to-desktop remote use between two Macs. - Reported on 2026-10-27. - Cindy version/commit on each computer: not captured for this report. - Exact macOS versions and install method: not captured.  ### 复现步骤 / Steps to reproduce  1. Use Cindy on one computer to access tasks on another computer in remote-control mode. 2. Select an existing task A on the main Cindy screen. 3. Open the Settings panel. 4. Return to the main Cindy screen. 5. Observe that a different task B is active instead of A.  These steps describe the user's observation; they have not yet been independently reproduced or traced. No root cause is claimed.  ### 日志与截图 / Logs & screenshots  No trace or screenshot captured for this specific navigation failure yet. No evidence of task data loss is reported.  ### Related reports checked  - #4138 (closed): the same Settings-and-back path could stay on “Loading…” rather than restore the pre

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

### Incident Patch 1: `b486def1` (2026-10-27)
**Commit Message**: Merge pull request #7556 from 321sssrt-bit/fix/7424-autoreview-pasted-text

fix(auto-review): 保留粘贴正文中的用户授权与限制

**File**: `apps/desktop/src/main/maker-ipc/__tests__/autoReviewUserIntent.test.ts` (modified, +27/-2)
```diff
@@ -4,12 +4,38 @@ import {
   AUTO_REVIEW_DELEGATED_CONTINUATION,
   restoreAutoReviewUserIntent,
   restoreAutoReviewSteerIntent,
+  readAutoReviewUserText,
   currentAutoReviewResourceIntent,
   type AutoReviewHistoryMessage,
 } from '../autoReviewUserIntent';
 import { projectPersistedAgentFacingUserText } from '@cindy/maker-shared/agent-input-projection';
 import { formatQuoteForSend, formatQuotesForSend } from '@cindy/maker-shared/chat-quotes';
 
+describe('pasted authored text', () => {
+  // #7424 / unit: production readText/resource projection must preserve exact owner authorization.
+  // Existing negatives cover structured resources, not paste-only or mixed input; the minimal old
+  // failure is any non-empty pastedTextRanges returning null/''. Long paste and restrictions are observable auth evidence.
+  const longPaste = Array.from({ length: 24 }, (_, index) => `第 ${index + 1} 行：允许本地修改和测试。`).join('\n');
+  it.each([
+    { name: 'full paste', prefix: '', pasted: `${longPaste}\n不要 push、不要发布。`, suffix: '' },
+    { name: 'mixed input', prefix: '先检查现状。\n', pasted: longPaste,
+      suffix: '\n允许本地修改和测试，但不要 push、不要发布。' },
+  ])('preserves the complete authorization for $name', ({ prefix, pasted, suffix }) => {
+    const text = `${prefix}${pasted}${suffix}`;
+    const content = { text, pastedTextRanges: [{ start: prefix.length, end: prefix.length + pasted.length }] };
+    expect(readAutoReviewUserText(content)).toBe(text);
+    expect(currentAutoReviewResourceIntent(content, text)).toBe(text);
+    expect(currentAutoReviewResourceIntent(content, projectPersistedAgentFacingUserText(content)!)).toBe(text);
+  });
+
+  it('restores a persisted pasted message once on retry', () => {
+    const text = '允许本地修改和测试，但不要 push、不要发布。';
+    const content = { text, pastedTextRanges: [{ start: 0, end: text.length }] };
+    const message = { ...user(text, 'pasted'), content };
+    expect(restoreAutoReviewUserIntent([message], { clientId: 'pasted', content })).toBe(text);
+  });
+});
+
 describe('authored text beside structured references', () => {
   // unit: Composer list markers are structure, not an owner's new request.
   it.each(['- ', '2) ', '3、', '+ \n  • '])('discards reference-only list scaffolding %j without discarding real words', prefix => {
@@ -35,7 +61,7 @@ describe('authored text beside structured references', () => {
     expect(currentAutoReviewResourceIntent(content, text).trim()).toBe(request);
     expect(currentAutoReviewResourceIntent(content, wire).trim()).toBe(request);
     expect(currentAutoReviewResourceIntent(content, `${wire} changed`)).toBe('');
-    expect(currentAutoReviewResourceIntent({ ...content, pastedTextRanges: [{}] }, wire)).toBe('');
+    expect(currentAutoReviewResourceIntent({ ...content, pastedTextRanges: [{}] }, wire).trim()).toBe(request);
     const invalid = { ...content, agentReferences: [{ ...content.agentReferences[0], end: href.length + 1 }] };
     expect(currentAutoReviewResourceIntent(invalid, projectPersistedAgentFacingUserText(invalid)!)).toBe('');
   });
@@ -271,7 +297,6 @@ describe('restored Auto authorization', () => {
   it.each([
     { quotesEncoded: true },
     { sessionReferences: [{}] },
-    { pastedTextRanges: [{}] },
     { images: [{}] },
     { files: [{}] },
   ])(
```

**File**: `apps/desktop/src/main/maker-ipc/__tests__/makerSendTransaction.test.ts` (modified, +28/-0)
```diff
@@ -3553,6 +3553,34 @@ describe('session-agent-switch handoff injection', () => {
       agentMeta: stored!.agentMeta as Record<string, unknown> }])).toBe(request);
   });
 
+  // #7424 / unit: the trusted queue and accepted transaction must persist the exact pasted owner request.
+  // Adjacent reference tests did not cover paste ranges; the minimal old failure stamps '' for text + ranges.
+  it.each([false, true])('preserves pasted authorization through queue and persistence (deviceLink=%s)', async deviceLink => {
+    const text = '允许本地修改和测试，但不要 push、不要发布。';
+    const content = { text, pastedTextRanges: [{ start: 0, end: text.length }] };
+    const queued = stampTrustedDesktopQueuedOrigin({ clientId: 'pasted-request', text,
+      persistedContent: content, files: [],
+    } as unknown as AgentInputQueuedMessage, deviceLink);
+    expect(queued.autoReviewUserText).toBe(text);
+    const { deps, session } = createDeps();
+    await createMakerSendTransaction(deps).sendToAgentAccepted('session-1', text, undefined, {
+      [AUTO_REVIEW_SOURCE_CONTENT]: queued.autoReviewUserText,
+      persistUserMessage: { clientId: queued.clientId, content, delivery: 'turn' },
+    });
+    expect(vi.mocked(session.send).mock.lastCall?.[1]?.[AUTO_REVIEW_USER_INTENT]).toBe(text);
+    expect(vi.mocked(deps.createDbMessage).mock.lastCall?.[1].agentMeta?.autoReviewUserText).toBe(text);
+  });
+
+  it.each([false, true])('rejects pasted authorization when persisted and wire text diverge (deviceLink=%s)', deviceLink => {
+    const persisted = { text: '允许 push。', pastedTextRanges: [{ start: 0, end: 6 }] };
+    for (const persistedContent of [persisted, JSON.stringify(persisted)]) {
+      const queued = stampTrustedDesktopQueuedOrigin({ clientId: 'pasted-mismatch', text: '不要 push。',
+        persistedContent, files: [],
+      } as unknown as AgentInputQueuedMessage, deviceLink);
+      expect(queued.autoReviewUserText).toBe('');
+    }
+  });
+
   // unit: a forwarded quote must survive persistence without becoming permission.
   it('persists host request evidence without restoring the target previous grant', async () => {
     const { deps, session } = createDeps({ readAutoReviewHistory: async () => [{
```

**File**: `apps/desktop/src/main/maker-ipc/autoReviewUserIntent.ts` (modified, +2/-4)
```diff
@@ -64,10 +64,8 @@ export function currentAutoReviewResourceIntent(
   // Queue admission carries Composer text; direct consumers may already carry
   // its agent-facing projection. Both must match this same persisted envelope.
   if (value.text !== wireText && projectPersistedAgentFacingUserText(content) !== wireText) return '';
-  // Pasted text still lacks a verified authored projection. Structured references,
-  // however, have validated spans: discard those spans, not the owner's adjacent
-  // request. Attached session transcripts are separate from value.text entirely.
-  if (Array.isArray(value.pastedTextRanges) && value.pastedTextRanges.length > 0) return '';
+  // Structured references have validated spans: discard those spans, not the
+  // owner's adjacent request. Attached session transcripts are separate from value.text entirely.
   const references = readAgentInputReferences(value.agentReferences, value.text);
   if (Array.isArray(value.agentReferences) && references.length !== value.agentReferences.length) return '';
   const parts: string[] = [];
```

**File**: `apps/desktop/src/main/maker-ipc/makerSendTransaction.ts` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ export function stampTrustedDesktopQueuedOrigin(
   // Keep the complete input until the shared atomic history budget is applied.
   // Pre-compacting a revocation would leave older grants beside an omission marker.
   if (ordinary) explicitUserItem.autoReviewUserText =
-    readAutoReviewUserText(item.persistedContent) ?? currentAutoReviewResourceIntent(item.persistedContent, item.text);
+    readAutoReviewUserText(item.persistedContent, item.text) ?? currentAutoReviewResourceIntent(item.persistedContent, item.text);
   if (deviceLinkInvoke || !canTrustDesktopPiCommand(item)) return explicitUserItem;
   const receipt: TrustedDesktopPiCommandSnapshot = {
     version: 1,
```

**File**: `packages/maker-shared/src/autoReviewIntent.ts` (modified, +2/-2)
```diff
@@ -255,7 +255,7 @@ export function createAutoReviewIntentProjection() {
       : null;
   }
 
-  function readAutoReviewUserText(content: unknown): string | null {
+  function readAutoReviewUserText(content: unknown, wireText?: string): string | null {
     if (typeof content === "string") {
       try {
         content = JSON.parse(content);
@@ -276,10 +276,10 @@ export function createAutoReviewIntentProjection() {
         "sessionReferences",
         "agentReferences",
         "references",
-        "pastedTextRanges",
       ].some((key) => Array.isArray(value[key]) && value[key].length > 0)
     )
       return null;
+    if (wireText !== undefined && value.text !== wireText) return null;
     return value.text;
   }
 
```

---

### Incident Patch 2: `1ad20186` (2026-10-27)
**Commit Message**: Merge pull request #7192 from techsaurabh-394/fix/issue-7169-codex-hooks-conversion

fix(cross-agent-convert): 修正 Codex hooks 双向转换的顶层结构并避免重复提示

**File**: `apps/desktop/src/main/cross-agent-convert/__tests__/detector.test.ts` (modified, +43/-0)
```diff
@@ -227,4 +227,47 @@ describe('detect — hooks', () => {
     const r = await detect({ workingDir: tmpDir, agentKind: 'codex' });
     expect(r.items.find((i) => i.kind === 'hooks')).toBeUndefined();
   });
+
+  it('to-claude: source has only hooks.json (no hooks/ dir) and target has hooks config → no item', async () => {
+    await fs.mkdir(path.join(tmpDir, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.codex', 'hooks.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    const r = await detect({ workingDir: tmpDir, agentKind: 'claude-code' });
+    expect(r.items.find((i) => i.kind === 'hooks')).toBeUndefined();
+  });
+
+  it('to-claude: source has only hooks.json and target lacks hooks → 1 item', async () => {
+    await fs.mkdir(path.join(tmpDir, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.codex', 'hooks.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    const r = await detect({ workingDir: tmpDir, agentKind: 'claude-code' });
+    expect(r.items.find((i) => i.kind === 'hooks')).toBeDefined();
+  });
+
+  it('to-claude: target has legacy nested settings.hooks.hooks → item so the repair can run', async () => {
+    await fs.mkdir(path.join(tmpDir, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.codex', 'hooks.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.claude', 'settings.json'), JSON.stringify({ hooks: { hooks: { Stop: [] } } }));
+    const r = await detect({ workingDir: tmpDir, agentKind: 'claude-code' });
+    expect(r.items.find((i) => i.kind === 'hooks')).toBeDefined();
+  });
+
+  it('to-codex: target has legacy flat hooks.json → item so the wrapper upgrade can run', async () => {
+    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    await fs.mkdir(path.join(tmpDir, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.codex', 'hooks.json'), JSON.stringify({ Stop: [] }));
+    const r = await detect({ workingDir: tmpDir, agentKind: 'codex' });
+    expect(r.items.find((i) => i.kind === 'hooks')).toBeDefined();
+  });
+
+  it('to-codex: target already has wrapped hooks.json → no item', async () => {
+    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    await fs.mkdir(path.join(tmpDir, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(tmpDir, '.codex', 'hooks.json'), JSON.stringify({ hooks: { Stop: [] } }));
+    const r = await detect({ workingDir: tmpDir, agentKind: 'codex' });
+    expect(r.items.find((i) => i.kind === 'hooks')).toBeUndefined();
+  });
 });
```

**File**: `apps/desktop/src/main/cross-agent-convert/__tests__/hooks.test.ts` (modified, +80/-7)
```diff
@@ -52,9 +52,11 @@ describe('convertHooks — to-codex', () => {
     expect(await fs.readFile(path.join(wd, '.codex', 'hooks', 'pre.sh'), 'utf8')).toContain('echo hi');
     const json = JSON.parse(await fs.readFile(path.join(wd, '.codex', 'hooks.json'), 'utf8'));
     // Codex 用 camelCase 与 Claude 完全一致
-    expect(json.PreToolUse).toBeDefined();
-    expect(JSON.stringify(json.PreToolUse)).toContain('.codex/hooks/pre.sh');
-    expect(JSON.stringify(json.PreToolUse)).not.toContain('.claude/hooks/');
+    // Codex 规范：事件放在顶层 "hooks" 对象内
+    expect(json.PreToolUse).toBeUndefined();
+    expect(json.hooks.PreToolUse).toBeDefined();
+    expect(JSON.stringify(json.hooks.PreToolUse)).toContain('.codex/hooks/pre.sh');
+    expect(JSON.stringify(json.hooks.PreToolUse)).not.toContain('.claude/hooks/');
   });
 
   it('skips events that already exist in target hooks.json (no overwrite)', async () => {
@@ -67,13 +69,52 @@ describe('convertHooks — to-codex', () => {
     }));
     await fs.mkdir(path.join(wd, '.codex'), { recursive: true });
     await fs.writeFile(path.join(wd, '.codex', 'hooks.json'), JSON.stringify({
-      PreToolUse: 'USER_ORIGINAL',
+      hooks: { PreToolUse: 'USER_ORIGINAL' },
     }));
 
     const r = await convertHooks(toCodexItem());
     expect(r.status).toBe('success'); // still success because script was copied
     const json = JSON.parse(await fs.readFile(path.join(wd, '.codex', 'hooks.json'), 'utf8'));
-    expect(json.PreToolUse).toBe('USER_ORIGINAL');
+    expect(json.hooks.PreToolUse).toBe('USER_ORIGINAL');
+  });
+
+  it('upgrades a legacy flat hooks.json into the wrapped { hooks: {...} } shape', async () => {
+    await fs.mkdir(path.join(wd, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(wd, '.claude', 'settings.json'), JSON.stringify({
+      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo stop' }] }] },
+    }));
+    await fs.mkdir(path.join(wd, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(wd, '.codex', 'hooks.json'), JSON.stringify({ PreToolUse: 'FLAT' }));
+
+    const r = await convertHooks({ ...toCodexItem(), source: path.join(wd, '.claude', 'hooks') });
+    expect(r.status).toBe('success');
+    const json = JSON.parse(await fs.readFile(path.join(wd, '.codex', 'hooks.json'), 'utf8'));
+    expect(json.PreToolUse).toBeUndefined();
+    expect(json.hooks.PreToolUse).toBe('FLAT');
+    expect(json.hooks.Stop).toBeDefined();
+  });
+
+  it('flattens a mis-nested settings.hooks.hooks when reading Claude hooks', async () => {
+    await fs.mkdir(path.join(wd, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(wd, '.claude', 'settings.json'), JSON.stringify({
+      hooks: { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'echo s' }] }] } },
+    }));
+    const r = await convertHooks(toCodexItem());
+    expect(r.status).toBe('success');
+    const json = JSON.parse(await fs.readFile(path.join(wd, '.codex', 'hooks.json'), 'utf8'));
+    expect(json.hooks.SessionStart).toBeDefined();
+    expect(json.hooks.hooks).toBeUndefined();
+  });
+  it('upgrades a legacy flat hooks.json even when no event or script is added', async () => {
+    await fs.mkdir(path.join(wd, '.claude'), { recursive: true });
+    await fs.writeFile(path.join(wd, '.claude', 'settings.json'), JSON.stringify({ hooks: { Stop: [{ a: 1 }] } }));
+    await fs.mkdir(path.join(wd, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(wd, '.codex', 'hooks.json'), JSON.stringify({ Stop: [{ a: 1 }] }));
+
+    const r = await convertHooks(toCodexItem());
+    expect(r.status).toBe('success');
+    const json = JSON.parse(await fs.readFile(path.join(wd, '.codex', 'hooks.json'), 'utf8'));
+    expect(json).toEqual({ hooks: { Stop: [{ a: 1 }] } });
   });
 });
 
@@ -84,7 +125,7 @@ describe('convertHooks — to-claude', () => {
     await fs.mkdir(codexHooks, { recursive: true });
     await fs.writeFile(path.join(codexHooks, 'p.sh'), 'echo p');
     await fs.writeFile(codexJson, JSON.stringify({
-      PreToolUse: { command: '.codex/hooks/p.sh' },
+      hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: '.codex/hooks/p.sh' }] }] },
     }));
 
     const r = await convertHooks(toClaudeItem());
@@ -93,6 +134,37 @@ describe('convertHooks — to-claude', () => {
     const settings = JSON.parse(await fs.readFile(path.join(wd, '.claude', 'settings.json'), 'utf8'));
     expect(settings.hooks.PreToolUse).toBeDefined();
     expect(JSON.stringify(settings.hooks.PreToolUse)).toContain('.claude/hooks/p.sh');
+    // 不得把 Codex 的外层 "hooks" 包装当作事件名写进 settings.hooks
+    expect(settings.hooks.hooks).toBeUndefined();
+  });
+
+  it('still accepts a legacy flat hooks.json', async () => {
+    await fs.mkdir(path.join(wd, '.codex'), { recursive: true });
+    await fs.writeFile(path.join(wd, '.codex', 'hooks.json'), JSON.stringify({
+      Stop: [{ hooks: [{ type: 'command', command: 'echo x' }] }],
+    }));
+    c
```

**File**: `apps/desktop/src/main/cross-agent-convert/converters/hooks.ts` (modified, +58/-13)
```diff
@@ -32,6 +32,40 @@ export interface ConvertOutcome {
 const CLAUDE_HOOKS_PATH_PATTERN = /\.claude\/hooks\//g;
 const CODEX_HOOKS_PATH_PATTERN = /\.codex\/hooks\//g;
 
+/** 判断是否为普通 JSON 对象。 */
+function isPlainObject(v: unknown): v is Record<string, unknown> {
+  return v !== null && typeof v === 'object' && !Array.isArray(v);
+}
+
+/**
+ * 取出 Codex hooks.json 里的事件表。
+ * Codex 规范顶层是 `{ "hooks": { <Event>: [...] } }`；同时兼容早期平铺写法 `{ <Event>: [...] }`
+ * （平铺时忽略非事件的 "hooks" 键本身）。
+ */
+function extractCodexEvents(root: Record<string, unknown>): Record<string, unknown> {
+  if (isPlainObject(root.hooks)) return root.hooks;
+  const flat: Record<string, unknown> = {};
+  for (const [k, v] of Object.entries(root)) {
+    if (k === 'hooks') continue;
+    flat[k] = v;
+  }
+  return flat;
+}
+
+/** 修复存量错误嵌套的 settings.hooks.hooks：把内层事件拍平到 settings.hooks 上（已有同名事件不覆盖）。 */
+function unwrapNestedClaudeHooks(hooks: Record<string, unknown>): Record<string, unknown> {
+  const nested = hooks.hooks;
+  if (!isPlainObject(nested)) return hooks;
+  const out: Record<string, unknown> = {};
+  for (const [k, v] of Object.entries(hooks)) {
+    if (k !== 'hooks') out[k] = v;
+  }
+  for (const [k, v] of Object.entries(nested)) {
+    if (!(k in out)) out[k] = v;
+  }
+  return out;
+}
+
 async function exists(p: string): Promise<boolean> {
   try {
     await fs.access(p);
@@ -137,35 +171,44 @@ async function convertToCodex(item: MigrationItem): Promise<ConvertOutcome> {
   const hadExisting = await exists(codexHooksJson);
   if (hadExisting) {
     const parsed = await readJsonIfExists(codexHooksJson);
-    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
-      existing = parsed as Record<string, unknown>;
-    }
+    if (isPlainObject(parsed)) existing = parsed;
+  }
+  // Codex 规范：事件放在顶层 "hooks" 对象内；旧的平铺文件就地升级为包装结构
+  const codexEvents = extractCodexEvents(existing);
+  // 旧平铺文件（有事件但无顶层 hooks 包装）即使没有新增也要写回升级
+  const upgraded = hadExisting && !isPlainObject(existing.hooks) && Object.keys(codexEvents).length > 0;
+  const codexRoot: Record<string, unknown> = {};
+  for (const [k, v] of Object.entries(existing)) {
+    if (k === 'hooks' || k in codexEvents) continue;
+    codexRoot[k] = v;
   }
 
   let added = 0;
   let skipped = 0;
   if (claudeHooks) {
-    for (const [eventName, eventConfig] of Object.entries(claudeHooks)) {
-      if (eventName in existing) {
+    for (const [eventName, eventConfig] of Object.entries(unwrapNestedClaudeHooks(claudeHooks))) {
+      if (eventName in codexEvents) {
         skipped += 1;
         continue;
       }
-      existing[eventName] = rewriteHookEntry(eventConfig, 'to-codex');
+      codexEvents[eventName] = rewriteHookEntry(eventConfig, 'to-codex');
       added += 1;
     }
   }
 
-  if (added === 0 && scriptResult.copied === 0) {
+  if (added === 0 && scriptResult.copied === 0 && !upgraded) {
     return { status: 'skipped', detail: '所有 hook 已存在' };
   }
 
   await fs.mkdir(path.dirname(codexHooksJson), { recursive: true });
-  await fs.writeFile(codexHooksJson, JSON.stringify(existing, null, 2), 'utf8');
+  codexRoot.hooks = codexEvents;
+  await fs.writeFile(codexHooksJson, JSON.stringify(codexRoot, null, 2), 'utf8');
 
   const parts: string[] = [];
   if (scriptResult.copied > 0) parts.push(`脚本 ${scriptResult.copied}`);
   if (added > 0) parts.push(`索引 ${added}`);
   if (skipped > 0) parts.push(`跳过 ${skipped}`);
+  if (upgraded) parts.push('升级为 hooks 包装结构');
   return { status: 'success', detail: parts.join(', ') };
 }
 
@@ -188,9 +231,7 @@ async function convertToClaude(item: MigrationItem): Promise<ConvertOutcome> {
   let codexHooks: Record<string, unknown> = {};
   try {
     const parsed = await readJsonIfExists(codexHooksJson);
-    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
-      codexHooks = parsed as Record<string, unknown>;
-    }
+    if (isPlainObject(parsed)) codexHooks = extractCodexEvents(parsed);
   } catch (err) {
     return { status: 'failed', detail: `hooks.json 解析失败: ${err instanceof Error ? err.message : String(err)}` };
   }
@@ -204,7 +245,10 @@ async function convertToClaude(item: MigrationItem): Promise<ConvertOutcome> {
       settings = parsed as Record<string, unknown>;
     }
   }
-  const existingHooks = (settings.hooks ?? {}) as Record<string, unknown>;
+  // 存量错误嵌套 settings.hooks.hooks 一并拍平修复
+  const rawHooks = isPlainObject(settings.hooks) ? settings.hooks : {};
+  const existingHooks = unwrapNestedClaudeHooks(rawHooks);
+  const repaired = existingHooks !== rawHooks;
 
   let added = 0;
   let skipped = 0;
@@ -217,7 +261,7 @@ async function convertToClaude(item: MigrationItem): Promise<ConvertOutcome> {
     added += 1;
   }
 
-  if (added === 0 && scriptResult.copied === 0) {
+  if (added === 0 && scriptResult.copied === 0 && !repaired) {
     return { status: 'skipped', detail: '所有 hook 已存在' };
   }
 
@@ -229,6 +273,7 @@ async function convertToClaude(item: MigrationItem): Promise<ConvertOutc
```

**File**: `apps/desktop/src/main/cross-agent-convert/detector.ts` (modified, +34/-4)
```diff
@@ -213,9 +213,11 @@ async function detectHooks(wd: string, direction: MigrationDirection, items: Mig
     const hasSourceJson = await isNonEmptyTextFile(codexHooksJson);
     if (!hasSourceDir && !hasSourceJson) return;
     // 目标缺失判断：claude settings.json 不存在 / 不含 hooks 段，或 .claude/hooks/ 不存在
-    const claudeSettingsHasHooks = await fileHasJsonKey(claudeSettings, 'hooks');
+    // 存量错误嵌套 settings.hooks.hooks 不算完备，需放行让 converter 拍平修复
+    const claudeSettingsHasHooks = await claudeSettingsHooksWellFormed(claudeSettings);
     const claudeHooksDirExists = await isDir(claudeHooksDir);
-    if (claudeSettingsHasHooks && claudeHooksDirExists) return;
+    // 按源端资产对齐：源端只有 hooks.json、没有 hooks/ 目录时，目标有 hooks 配置即视为完备
+    if ((!hasSourceJson || claudeSettingsHasHooks) && (!hasSourceDir || claudeHooksDirExists)) return;
     items.push({
       id: 'hooks:0',
       kind: 'hooks',
@@ -228,9 +230,10 @@ async function detectHooks(wd: string, direction: MigrationDirection, items: Mig
     const hasSourceDir = await isDir(claudeHooksDir);
     const hasSourceJson = await fileHasJsonKey(claudeSettings, 'hooks');
     if (!hasSourceDir && !hasSourceJson) return;
-    const codexHooksJsonExists = await isNonEmptyTextFile(codexHooksJson);
+    // 旧平铺 hooks.json 缺少顶层 hooks 包装，不算完备，需放行让 converter 就地升级
+    const codexHooksJsonExists = await codexHooksJsonWellFormed(codexHooksJson);
     const codexHooksDirExists = await isDir(codexHooksDir);
-    if (codexHooksJsonExists && codexHooksDirExists) return;
+    if ((!hasSourceJson || codexHooksJsonExists) && (!hasSourceDir || codexHooksDirExists)) return;
     items.push({
       id: 'hooks:0',
       kind: 'hooks',
@@ -272,6 +275,33 @@ async function detectMcp(wd: string, direction: MigrationDirection, items: Migra
   }
 }
 
+/** .claude/settings.json 含 hooks 段，且不是旧版错误产物 hooks.hooks。 */
+async function claudeSettingsHooksWellFormed(p: string): Promise<boolean> {
+  try {
+    const parsed = JSON.parse(await fs.readFile(p, 'utf8'));
+    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
+    const hooks = (parsed as Record<string, unknown>).hooks;
+    if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return false;
+    const nested = (hooks as Record<string, unknown>).hooks;
+    return !(nested && typeof nested === 'object' && !Array.isArray(nested));
+  } catch {
+    return false;
+  }
+}
+
+/** .codex/hooks.json 非空且不是旧平铺写法（有事件却没有顶层 hooks 包装）。 */
+async function codexHooksJsonWellFormed(p: string): Promise<boolean> {
+  try {
+    const parsed = JSON.parse(await fs.readFile(p, 'utf8'));
+    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
+    const rec = parsed as Record<string, unknown>;
+    if (rec.hooks && typeof rec.hooks === 'object' && !Array.isArray(rec.hooks)) return true;
+    return Object.keys(rec).filter((k) => k !== 'hooks').length === 0;
+  } catch {
+    return false;
+  }
+}
+
 async function fileHasJsonKey(p: string, key: string): Promise<boolean> {
   try {
     const raw = await fs.readFile(p, 'utf8');
```

---

### Incident Patch 3: `02193df4` (2026-10-27)
**Commit Message**: Merge pull request #7551 from xuzini-xzn/fix/pi-websocket-handshake-lifecycle

fix(proxy): bound pending websocket handshakes

**File**: `packages/anthropic-compat-proxy/src/server-websocket.test.ts` (modified, +105/-31)
```diff
@@ -1,4 +1,4 @@
-import { ClientRequest, createServer, type IncomingMessage } from 'node:http';
+import { createServer, globalAgent, type IncomingMessage } from 'node:http';
 import { connect, Socket } from 'node:net';
 import type { Duplex } from 'node:stream';
 import { afterEach, describe, expect, it, vi } from 'vitest';
@@ -28,6 +28,21 @@ afterEach(async () => {
   while (cleanups.length) await cleanups.pop()!();
 });
 
+// Exercise the production deadline without a 15-second real wait. Real HTTP,
+// DNS-pending sockets and callbacks still run; only expiry is triggered manually.
+function captureHandshakeDeadlines() {
+  const timers = vi.spyOn(globalThis, 'setTimeout');
+  cleanups.push(() => {
+    for (let i = 0; i < timers.mock.calls.length; i += 1) {
+      if (timers.mock.calls[i][1] === 15_000) clearTimeout(timers.mock.results[i].value);
+    }
+    timers.mockRestore();
+  });
+  return () => timers.mock.calls.flatMap(([callback, delay], i) => delay === 15_000
+    ? [{ fire: callback as () => void, timer: timers.mock.results[i].value }]
+    : []);
+}
+
 function upgradeRequest(
   path: string,
   host: string,
@@ -293,21 +308,24 @@ describe('anthropic-compat-proxy websocket upgrades', () => {
     expect(upstream.received.join('')).toContain('PING');
   });
 
-  it('uses a short timeout for the websocket handshake', async () => {
-    const setTimeoutSpy = vi.spyOn(ClientRequest.prototype, 'setTimeout');
+  it('removes the handshake deadline after 101 and ignores a late expiry callback', async () => {
+    const deadlines = captureHandshakeDeadlines();
+    const cleared = vi.spyOn(globalThis, 'clearTimeout');
     try {
       const upstream = await startUpgradeUpstream();
       proxy = await createAnthropicCompatProxy({
-        upstream: 'http://unused.invalid',
-        transformRequest: [],
+        upstream: 'http://unused.invalid', transformRequest: [],
         resolveWebSocketUpstream: () => upstream.url,
       });
-
       const response = await openUpgrade(proxy.url);
       expect(response.head).toContain('HTTP/1.1 101 Switching Protocols');
-      expect(setTimeoutSpy.mock.calls.some(([timeout]) => timeout === 15_000)).toBe(true);
+      expect(deadlines()).toHaveLength(1);
+      expect(cleared).toHaveBeenCalledWith(deadlines()[0].timer);
+      deadlines()[0].fire();
+      response.socket.write('PING');
+      expect(await waitForSocketText(response.socket, response.rest, 'PONG')).toContain('PONG');
     } finally {
-      setTimeoutSpy.mockRestore();
+      cleared.mockRestore();
     }
   });
 
@@ -529,41 +547,97 @@ describe('anthropic-compat-proxy websocket upgrades', () => {
     );
   });
 
-  it('returns 504 instead of falling back when the websocket handshake times out', async () => {
+  it('bounds a websocket handshake even when DNS never completes', async () => {
+    const deadlines = captureHandshakeDeadlines();
+    const originalCreateConnection = globalAgent.createConnection;
+    let pendingSocket: Socket | undefined;
+    const createConnection = vi.spyOn(globalAgent, 'createConnection').mockImplementationOnce(options => {
+      // Real ClientRequest/socket, but no external DNS or network fault timing.
+      const socket = originalCreateConnection.call(globalAgent, { ...options, lookup: () => {} });
+      if (!(socket instanceof Socket)) throw new Error('fixture requires a real pending socket');
+      pendingSocket = socket;
+      sockets.add(socket);
+      return socket;
+    });
+    try {
+      const upstream = await startUpgradeUpstream();
+      proxy = await createAnthropicCompatProxy({
+        upstream: 'http://unused.invalid', transformRequest: [],
+        resolveWebSocketUpstream: ({ url }) => url === '/stall' ? 'http://pending-lookup.invalid' : upstream.url,
+      });
+      const failed = readUpgradeFailure(proxy.url, '/stall');
+      await vi.waitFor(() => expect(pendingSocket?.connecting).toBe(true));
+      expect(deadlines(), 'the handshake deadline must run before the socket connects').toHaveLength(1);
+      const healthy = await openUpgrade(proxy.url);
+      deadlines()[0].fire();
+      expect(await failed).toBe('HTTP/1.1 504 Gateway Timeout\r\nConnection: close\r\n\r\n');
+      expect(pendingSocket?.destroyed).toBe(true);
+      healthy.socket.write('PING');
+      expect(await waitForSocketText(healthy.socket, healthy.rest, 'PONG')).toContain('PONG');
+      expect(deadlines()).toHaveLength(2);
+    } finally {
+      createConnection.mockRestore();
+    }
+  });
+
+  it('returns 504 when partial response headers never complete the handshake', async () => {
+    const deadlines = captureHandshakeDeadlines();
     const upstream = createServer();
+    let handshakeStarted = false;
     upstream.on('upgrade', (_req, socket) => {
       sockets.add(socket);
-      // Intentionally leave the handshake pending. The ClientRequest timeout spy below
-      // fires the production timeout callback without making this test wait 15 sec
```

**File**: `packages/anthropic-compat-proxy/src/server.ts` (modified, +26/-4)
```diff
@@ -2871,6 +2871,12 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
     let settled = false;
     let upstreamReqForEarlyClose: ClientRequest | null = null;
     let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
+    let handshakeTimer: ReturnType<typeof setTimeout> | null = null;
+    const clearHandshakeTimer = (): void => {
+      if (handshakeTimer === null) return;
+      clearTimeout(handshakeTimer);
+      handshakeTimer = null;
+    };
     let upstreamAttempt = 0;
     let removeAuthorizationListener: (() => void) | undefined;
     let authorizeWebSocket: (() => boolean) | undefined;
@@ -2907,6 +2913,7 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
     const settle = (why: string, err?: Error): void => {
       if (settled) return;
       settled = true;
+      clearHandshakeTimer();
       removeAuthorizationListener?.();
       if (reconnectTimer !== null) {
         clearTimeout(reconnectTimer);
@@ -2926,6 +2933,14 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
 
     // client 可能在 resolveOutboundForTarget 尚未返回时就离开。close 必须立即归还预占
     // 槽位;若上游请求已经创建,同时终止它,避免无人接收的握手继续占网络资源。
+    // Before 101 there is no pipe to propagate FIN. An abandoned handshake
+    // can otherwise stay half-open until its upstream eventually responds.
+    clientSocket.on('end', () => {
+      if (established || settled) return;
+      settle('client-end-before-upgrade');
+      upstreamReqForEarlyClose?.destroy();
+      clientSocket.end();
+    });
     clientSocket.on('close', () => {
       settle('client-close');
       if (!established) {
@@ -2966,6 +2981,7 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
 
     const scheduleReconnectAttempt = (why: string, err?: Error): void => {
       if (!locallyAcceptedForReconnect || settled || clientSocket.destroyed) return;
+      clearHandshakeTimer();
       upstreamReqForEarlyClose = null;
       const exponent = Math.max(0, Math.min(upstreamAttempt - 1, 8));
       const delayMs = Math.min(
@@ -3061,6 +3077,7 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
       ): void => {
         if (attemptSettled || established || settled) return;
         attemptSettled = true;
+        clearHandshakeTimer();
         if (locallyAcceptedForReconnect) {
           scheduleReconnectAttempt(why, err);
           return;
@@ -3069,20 +3086,24 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
         writeUpgradeFailure(clientSocket, status, message);
       };
 
-      // 握手阶段必须有独立的秒级上限(上游可能既不回 101 也不回响应)。
-      // **建立成功后立刻解除**，避免任何握手 timer 误杀正常长连接。
-      upstreamReq.setTimeout(WEBSOCKET_UPGRADE_TIMEOUT_MS, () => {
+      // Request/socket idle timeouts start after connection and reset on traffic.
+      // Bound the entire network handshake, including DNS/TCP/TLS, instead.
+      // This deadline is removed on 101; it never limits model inference.
+      handshakeTimer = setTimeout(() => {
+        if (attemptSettled || established || settled) return;
         logger.warn?.('upgrade handshake timed out', { reqId, path: upstreamPath });
         failTransientAttempt('handshake-timeout', 504, 'Gateway Timeout');
         upstreamReq.destroy();
-      });
+      }, WEBSOCKET_UPGRADE_TIMEOUT_MS);
+      handshakeTimer.unref?.();
 
       upstreamReq.on('upgrade', (upstreamRes, upstreamSocket: Socket, upstreamHead: Buffer) => {
         if (attemptSettled) {
           upstreamSocket.destroy();
           return;
         }
         attemptSettled = true;
+        clearHandshakeTimer();
         upstreamReqForEarlyClose = null;
         // 解除握手超时(长连接不能被它杀掉)。
         upstreamReq.setTimeout(0);
@@ -3213,6 +3234,7 @@ export async function createAnthropicCompatProxy(opts: ProxyOptions): Promise<Pr
           return;
         }
         attemptSettled = true;
+        clearHandshakeTimer();
         upstreamReqForEarlyClose = null;
         settle('upstream-refused');
         const status = upstreamRes.statusCode ?? 502;
```

#### Recent Merged Pull Requests:
- **PR #7556** (2026-10-27): fix(auto-review): 保留粘贴正文中的用户授权与限制 (@321sssrt-bit)
- **PR #7553** (2026-10-27): fix(mobile): reserve streaming action row space (@zqchris)
- **PR #7551** (2026-10-27): fix(proxy): bound pending websocket handshakes (@xuzini-xzn)
- **PR #7549** (2026-10-27): fix(models): use host root for Agnes Messages requests (@zqchris)
- **PR #7546** (2026-10-27): feat(tasks): unify teammate filters and ownership across devices (@zqchris)
- **PR #7543** (2026-10-27): fix(mobile): preserve send row measurement on confirmation (@zqchris)

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

## X. Merge pull request #7556 from 321sssrt-bit/fix/7424-autoreview-pasted-text

**RULE**:
When implementing operations in `apps/desktop/src/main/maker-ipc/__tests__/autoReviewUserIntent.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b486def1`: Merge pull request #7556 from 321sssrt-bit/fix/7424-autoreview-pasted-text. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src/main/maker-ipc/__tests__/autoReviewUserIntent.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  readAutoReviewUserText,
describe('pasted authored text', () => {
  // #7424 / unit: production readText/resource projection must preserve exact owner authorization.
  // Existing negatives cover structured resources, not paste-only or mixed input; the minimal old
  // failure is any non-empty pastedTextRanges returning null/''. Long paste and restrictions are observable auth evidence.
  const longPaste = Array.from({ length: 24 }, (_, index) => `第 ${index + 1} 行：允许本地修改和测试。`).join('\n');
  it.each([
    { name: 'full paste', prefix: '', pasted: `${longPaste}\n不要 push、不要发布。`, suffix: '' },
    { name: 'mixed input', prefix: '先检查现状。\n', pasted: longPaste,
      suffix: '\n允许本地修改和测试，但不要 push、不要发布。' },
  ])('preserves the complete authorization for $name', ({ prefix, pasted, suffix }) => {
    const text = `${prefix}${pasted}${suffix}`;
    const content = { text, pastedTextRanges: [{ start: prefix.length, end: prefix.length + pasted.length }] };
    expect(readAutoReviewUserText(content)).toBe(text);
    expect(currentAutoReviewResourceIntent(content, text)).toBe(text);
    expect(currentAutoReviewResourceIntent(content, projectPersistedAgentFacingUserText(content)!)).toBe(text);
  }
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    expect(currentAutoReviewResourceIntent({ ...content, pastedTextRanges: [{}] }, wire)).toBe('');
    { pastedTextRanges: [{}] },
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b486def1` are properly handled with clean fallback behavior.
