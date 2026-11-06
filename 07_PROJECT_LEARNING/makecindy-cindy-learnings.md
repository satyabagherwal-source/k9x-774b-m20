> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/makecindy-cindy-learnings.md`  
> **Source**: github ([https://github.com/makecindy/cindy](https://github.com/makecindy/cindy))  
> **Source Version**: `fc0d9c4c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T23:09:32.239Z  
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
> **Harvest Timestamp**: 2026-11-05T23:09:32.231Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `makecindy/cindy`
- **Description**: Consider it done. The open-source AI agent that works out of the box · 想到，就能做到。开源、开箱即用的 AI Agent。
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9343 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9021** (2026-11-05): **Linux 同机多个系统账号同时运行 Cindy 时，附件临时目录冲突导致传图失败（EPERM）**
  *Symptoms*: **提交人**: Br1efx **客户端版本**: 0.1.125  ---  ## 现象  在同一台 Linux 机器上，两个不同的系统账号各自运行一份 Cindy。从另一台设备远程控制其中一个账号的 Cindy 并发送图片附件时失败，报错：  ``` Error invoking remote method 'device-link:invoke': Error: [DEVICE_LINK_MEDIA_TRANSFER_FAILED] EPERM: operation not permitted, chmod '/tmp/cindy-attachments' ```  ## 原因  附件临时根目录是 `app.getPath("temp")/cindy-attachments`，在 Linux 上默认就是 `/tmp/cindy-attachments`，所有系统账号共用同一个路径。  先启动的账号创建了该目录，权限为 `drwx------`（属主为该账号）。另一个账号的 Cindy 之后既无法 chmod，也无法在其中写入，于是附件传输失败。删除该目录也不能根本解决：重新创建后会轮到另一个账号出同样的问题。  ## 复现步骤  1. 在一台 Linux 机器上用系统账号 A 登录并启动 Cindy，触发一次附件传输（使 `/tmp/cindy-attachments` 被 A 创建）。 2. 用系统账号 B 登录同一台机器并启动 Cindy。 3. 从另一台已登录同一 Cindy 账号的设备远程控制账号 B 的 Cindy，在对话中发送一张图片。 4. 出现上述 EPERM 报错，图片发送失败。  ## 期望  不同系统账号运行的 Cindy 互不影响，附件临时目录不会因其他账号先创建而不可用。  ## 临时绕过  给受影响账号的 Cindy 设置独立的 `TMPDIR` 环境变量后再启动（例如指向该账号家目录下的缓存目录），附件临时目录就不再落在共享的 `/tmp` 下。  ## 环境  - 系统：Linux（同一台机器上两个系统账号各运行一份 Cindy） - 场景：通过另一台设备的远程连接（device-link）发送图片附件时出现 --- ## 相关日志  提交客户端本机最近 2 小时的运行日志摘录，不代表已定位故障，也不包含 SSH 远端或手机日志。已按来源和字段白名单过滤并脱敏；不读取对话正文或原始请求响应。 ```text - 2026-11-05T11:17:58.067Z [WARN] [main/device-link] dropped 1 discardable pending frame(s) (best-effort push [REDACTED:path] - 2026-11-05T11:45:27.490Z [INFO] [main/updateService] Poll timer fires - 2026-11-05T11:45:27.491Z [INFO] [main/manifestService] Fetching (release channel): [REDACTED:url]<redacted:url-query-value> - 2026-11-05T11:45:28.517Z [INFO] [main/manifestService] Fetched OK: app.version=0.1.126, hotfix=none - 2026-11-05T11:45:28.517Z [INFO

- **Issue #8954** (2026-11-05): **bug(desktop): 文件浏览器读取失败提示在窄面板下被裁切**
  *Symptoms*: ## 问题描述  在文件浏览器中，文件读取失败的提示包含较长的文件路径。缩窄面板后，部分错误文字被裁切，无法完整阅读。  移动任务到另一个目录可以触发这个提示：原来打开的文件在新目录中不存在时，会显示 `ENOENT`。本单只记录错误提示的显示问题，不将文件不存在时的报错本身作为缺陷。  ## 环境  - 系统：Windows 11 - Cindy：0.1.126（CN） - 入口：任务中的文件浏览器  ## 复现步骤  1. 准备两个文件夹：「切换对照项目」和「20目录项目」。在「切换对照项目」中放一个「仅对照项目.txt」，「20目录项目」中不放这个文件。目录路径较长时更容易观察到。 2. 新建任务时，选择「切换对照项目」作为文件目录。 3. 打开文件浏览器，点击「仅对照项目.txt」，确认文件内容正常显示。 4. 点击任务旁的三个点，选择「移动任务」。 5. 选择「20目录项目」。文件树正常切换到新目录，预览区显示文件读取失败提示。 6. 缩窄文件浏览器面板，观察错误提示的文字。  ## 实际结果  - 较宽面板下，错误提示能显示较完整。 - 缩窄后，长路径的一部分超出可见区域并被裁切，不能完整阅读。 - 点击新目录中存在的文件，可以恢复正常预览。 - 普通长文本文件预览正常，没有出现同样的裁切问题。  ## 预期结果  错误提示应根据面板宽度合理换行；对于较长路径，也应能通过换行、滚动或详情查看等方式完整阅读，不应直接裁掉文字。  ## 日志与截图  提示内容包含：  ```text 读取文件失败：Error: ENOENT: no such file or directory, realpath ```  后面跟随新目录下不存在的「仅对照项目.txt」的路径。  **图 1：较宽面板。**任务已移动到「20目录项目」，右侧文件树正常显示新目录，原来打开的「仅对照项目.txt」显示读取失败提示；此时错误文字和路径显示较完整。  <img width="1237" height="1301" alt="较宽面板下的文件读取失败提示" src="https://github.com/user-attachments/assets/26f99190-623c-4798-8f22-43aa946576c6" />  **图 2：缩窄面板后。**同一条错误提示中的长路径超出预览区域，部分文字被裁切，无法完整阅读。重点对比两张图中间的错误提示区域。  <img width="680" height="1340" alt="窄面板下长错误提示被裁切" src="https://github.com/user-attachments/assets/b9214707-b4a0-4d1e-8a65-f349bc6f8f11" />  ## 相关记录  在 PR #8793 的文件树恢复测试过程中发现。本单是错误提示的布局问题，尚不能确定与该 PR 的改动有关。  ## 影响  影响错误信息的可读性，不阻断继续浏览其他文件。重新选择有效文件后可以正常使用。
  **Post-Mortem & Fix Analysis**:
  > ### 判断  更新：提报者补充图注进一步明确了长路径裁切发生在中间预览区的错误展示节点。文件读取失败提示在窄面板下应保持完整可读；当前现象属于错误占位容器缺少连续字符串断行规则与溢出保护，导致 Windows 反斜杠等长路径溢出父级边界，值得进行轻量样式修复。  进一步检查发现，文件浏览器中普通文本预览依赖 CodeMirror 自带的折行与滚动机制，因此缩窄时表现正常；而读取失败（如移动任务导致原打开文件不存在触发 `ENOENT`）走的是 `FileBodyView` 的独立静态文本分支。该分支缺少强制换行与纵向滚动，叠加父级容器的隐藏溢出，引发了裁切。  ### 行动  **首要行动（前端开发）**： - 修改 `apps/desktop/src/renderer/features/cc-agent/workdir-browse/FileBodyView.tsx` 中 `content.kind === 'error'` 分支的容器样式：   1. 补充 `break-all`（或 `[overflow-wrap:anywhere]`），确保 Windows/POSIX 连续长路径及错误信息在容器边界处自动折行；   2. 容器补充 `overflow-y-auto` 与适度内边距，确保超长错误信息在极窄面板或垂直空间不足时可纵向滚动完整阅读；   3. 增加 `select-text`，确保用户能够完整选中并复制错误提示及路径文本。 - **完成条件**：在 Windows / macOS 客户端任务侧栏文件浏览器中，打开包含深层多级目录的不存在文件触发读取失败，将面板宽度拖至 200px 以下，验证错误信息能根据容器宽度正常换行并完整阅读，纵向超长时可正常滚动，不再出现文字水平裁切。  ### 关键证据  1. **容器样式缺失换行规则**：静态核对主干快照（`b8dae3974df`），`FileBodyView.tsx` 中 `content.kind === 'error'` 的渲染节点为 `<div className="flex h-full w-full items-center justify-center px-8 text-center text-13 text-[var(--cmd-palette-item-meta)]" title
  > <!-- pr-watch-merged:makecindy/cindy#8999 --> @zjiang208-cpu 关联 PR #8999 已合并，本 Issue 已处理完成并关闭。如发现问题请继续反馈。

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

### Incident Patch 1: `a9ea6286` (2026-11-05)
**Commit Message**: fix(computer): retain input failure diagnostics and align recovery advice

Assisted-by: Cindy (https://cindy.app)
Signed-off-by: Dash <[REDACTED_EMAIL]>

**File**: `packages/lizi-mcps/src/computer/README.md` (modified, +14/-0)
```diff
@@ -71,6 +71,20 @@ is usually redundant.
   Electron / browser targets. `set_value` was verified on Cindy's own composer:
   the field updates and its send button enables, without focus.
 
+## Input failure advice
+
+For `type_text`, `background_unavailable` and `type_text_incomplete` preserve
+error codes and structured progress/uncertainty, but replace driver recovery
+prose with Cindy MCP guidance. The driver may suggest pixel-targeted typing or
+foreground retries; Cindy's `type_text` schema does not accept `x/y` and a refusal
+must not trigger an automatic route change. Inspect web-content fields with
+`get_window_state`; `set_value` with a fresh element token is the supported text
+route when continuing is appropriate. After incomplete typing, do not resend the
+text or suffix without inspecting what happened. Observation success is not
+input completion. This applies to both thrown errors and returned refusals.
+See [result.ts](result.ts) and the MCP-entry regressions in
+[computerMcpServer.test.ts](computerMcpServer.test.ts).
+
 ## CUA 0.37 compatibility
 
 On 2026-10-22, a read-only native check reproduced `typed_output_mismatch`
```

**File**: `packages/lizi-mcps/src/computer/computerMcpServer.test.ts` (modified, +35/-0)
```diff
@@ -500,6 +500,41 @@ describe('createComputerMcpServer', () => {
     await h.cleanup();
   });
 
+  // CU-018: driver errors suggested unsupported x/y or a foreground retry.
+  // Unit: real MCP entry, both returned refusals and thrown adapter errors;
+  // verify guidance and partial-delivery evidence without dispatching another input.
+  it.each(['throw', 'return'] as const)('normalizes input failure advice (%s)', async mode => {
+    for (const code of ['background_unavailable', 'type_text_incomplete']) {
+      const progress = { completed_chars: 2, remaining_chars: 3 };
+      const rawMessage = 'Use pixel-targeted type_text (x,y) or delivery_mode:"foreground"; retry only the remaining suffix';
+      const deps: ComputerMcpDeps = { getStatus: vi.fn(), callTool: vi.fn(async name => {
+        if (name !== 'type_text') return { windows: [] };
+        if (mode === 'throw') throw Object.assign(new Error(rawMessage), {
+          code, outcomeUnknown: true, inputProgress: progress,
+        });
+        return { ok: false, code, message: rawMessage, hint: rawMessage,
+          next_call: { tool: 'type_text', arguments: { x: 1, y: 2 } },
+          outcome_unknown: true, input_progress: progress };
+      }) };
+      const h = await makeHarness(deps);
+      try {
+        const result = await h.client.callTool({ name: 'call_tool', arguments: {
+          name: 'type_text', args: { pid: 123, text: 'hello' },
+        } });
+        const payload = textPayload(result) as { data: { message: string } };
+        expect(payload).toMatchObject({ ok: false, errorCode: code,
+          data: { outcome_unknown: true, input_progress: progress } });
+        expect(payload.data.message).toContain('get_window_state');
+        expect(payload.data.message).toContain(code === 'background_unavailable' ? 'set_value' : 'Do not resend');
+        expect(JSON.stringify(payload)).not.toContain(rawMessage);
+        expect(payload.data).not.toHaveProperty('next_call');
+        const calls = vi.mocked(deps.callTool).mock.calls;
+        expect(calls.filter(([name]) => name === 'type_text')).toHaveLength(1);
+        expect(calls.map(([name]) => name)).toEqual(mode === 'throw' ? ['type_text', 'list_windows'] : ['type_text']);
+      } finally { await h.cleanup(); }
+    }
+  });
+
   it('dispatches zoom with cua-driver 0.5 region bounds', async () => {
     const deps: ComputerMcpDeps = {
       getStatus: vi.fn(),
```

**File**: `packages/lizi-mcps/src/computer/result.ts` (modified, +16/-0)
```diff
@@ -78,3 +78,19 @@ export function computerResultOutcome(
   }
   return { ok: true };
 }
+
+/** Driver recovery prose may advertise parameters/routes the Cindy MCP does not expose. */
+export function normalizeInputFailureAdvice(name: string, code: string | undefined, data: unknown): unknown {
+  if (name !== 'type_text' || !data || typeof data !== 'object' || Array.isArray(data)) return data;
+  let message: string;
+  if (code === 'background_unavailable') {
+    message = 'Background text input was refused. Stop and report the refusal; do not switch to foreground or shell-simulated input to bypass it. For Electron/browser/web-content fields, use get_window_state to inspect the target; set_value with a fresh element_token is the supported text route when continuing is appropriate. Cindy type_text does not accept x/y.';
+  } else if (code === 'type_text_incomplete') {
+    message = 'Text input did not complete; some characters may already have been delivered. Do not resend the text or its suffix, switch delivery modes, or use shell-simulated input. Stop and report the incomplete input. Use get_window_state to inspect the current field before deciding how to continue; a successful observation does not mean the input completed.';
+  } else {
+    return data;
+  }
+  // Replace conflicting recovery prose, not the error code, progress or uncertainty.
+  const { hint: _hint, next_call: _nextCall, summary: _summary, escalation: _escalation, ...evidence } = data as Record<string, unknown>;
+  return { ...evidence, message };
+}
```

**File**: `packages/lizi-mcps/src/computer/server.ts` (modified, +4/-4)
```diff
@@ -24,7 +24,7 @@ import {
 } from "./tools.js";
 import { logToolResultErrorCode } from "../tool-error-telemetry.js";
 import { WindowSnapshotTracker } from "./snapshot-tracker.js";
-import { computerResultOutcome, isUnavailableWindowObservation } from "./result.js";
+import { computerResultOutcome, isUnavailableWindowObservation, normalizeInputFailureAdvice } from "./result.js";
 import {
   canLocateRunningApp,
   exactInstalledAppBundle,
@@ -762,7 +762,7 @@ export function createComputerMcpServer(
           ...outcome,
           tool: name,
           ...(snapshotId ? { snapshot_id: snapshotId } : {}),
-          data: withoutDuplicateElements(name, data),
+          data: normalizeInputFailureAdvice(name, outcome.ok ? undefined : outcome.errorCode, withoutDuplicateElements(name, data)),
           ...(recovery ? { recovery } : {}),
           ...(postcheck ? { postcheck } : {}),
           ...(observation ? { observation } : {}),
@@ -945,7 +945,7 @@ export function createComputerMcpServer(
                 },
               }
             : {}),
-          data: {
+          data: normalizeInputFailureAdvice(name, errorCode, {
             message: err instanceof Error ? err.message : String(err),
             ...((err as { inputProgress?: unknown })?.inputProgress
               ? { input_progress: (err as { inputProgress: unknown }).inputProgress }
@@ -960,7 +960,7 @@ export function createComputerMcpServer(
                     ?? "Rediscover the target PID/window, then take fresh get_window_state before acting. Do not reuse old element references or automatically switch to a similar window.",
                 }
               : {}),
-          },
+          }),
         },
         true,
       );
```

**File**: `packages/maker-shared/src/__tests__/toolResultCompaction.test.ts` (modified, +16/-0)
```diff
@@ -83,6 +83,22 @@ describe('tool result diagnostics', () => {
     },
   );
 
+  // CU-008 weekly audit: real fixed codes were reduced to {ok:false} on archive.
+  // Unit: exercise extraction and persisted-marker reads, including a second pass.
+  it.each(['element_outside_target_window', 'type_text_incomplete', 'select_menu_would_raise_window'])(
+    'retains the audited input failure without retaining its private message: %s', errorCode => {
+      const diagnostics = extractToolResultDiagnostics({
+        ok: false, errorCode, data: { message: 'PRIVATE', outcome_unknown: true },
+      });
+      expect(diagnostics).toEqual({ ok: false, errorCode, outcomeUnknown: true });
+      const persisted = JSON.stringify({ type: 'tool_result_compacted', version: 1,
+        originalBytes: 100, compactedAt: 1, diagnostics });
+      const first = parseToolResultCompactionMarker(persisted);
+      expect(first?.diagnostics).toEqual(diagnostics);
+      expect(parseToolResultCompactionMarker(JSON.stringify(first))?.diagnostics).toEqual(diagnostics);
+    },
+  );
+
   it('drops private and unrecognized fields when reading a marker', () => {
     const marker = { type: 'tool_result_compacted', version: 1, originalBytes: 200, compactedAt: 1 };
     expect(parseToolResultCompactionMarker({ ...marker, diagnostics: {
```

**File**: `packages/maker-shared/src/toolResultCompaction.ts` (modified, +1/-0)
```diff
@@ -45,6 +45,7 @@ export function sanitizeToolResultDiagnostics(value: unknown): ToolResultDiagnos
       'window_id_not_found', 'window_not_found', 'stale_element_token',
       'screenshot_context_missing', 'capture_expired', 'typed_output_mismatch',
       'background_unavailable', 'browser_consent_required',
+      'element_outside_target_window', 'type_text_incomplete', 'select_menu_would_raise_window',
       'ACT_INVALID_REQUEST', 'BROWSER_UNAVAILABLE', 'BROWSER_NOT_CONNECTED',
       'BROWSER_RUNTIME_ACTION_FAILED', 'BROWSER_RUNTIME_INVALID_REQUEST', 'TIMEOUT',
     ],
```

---

### Incident Patch 2: `399e72f4` (2026-11-05)
**Commit Message**: fix(mobile): restore the saved PR after a failed first lookup

A first lookup that failed left an empty entry that hydration treated as
a confirmed "no PR" and skipped. Track whether a lookup actually
succeeded and only skip hydration for those.

Assisted-by: Cindy (https://cindy.app)
Signed-off-by: Dash <[REDACTED_EMAIL]>

**File**: `apps/mobile/src/__tests__/homeDisplaySettings.test.ts` (modified, +8/-0)
```diff
@@ -451,6 +451,14 @@ describe('home PR cache', () => {
       await vi.waitFor(() => expect(readHomeSessionPr(raced)).toEqual({ ref, status: merged }));
       await vi.advanceTimersByTimeAsync(0);
 
+      // 首查整体失败(连引用都没取到)后读回:空值不是「确认没有 PR」,读回的结果要补上。
+      prStoreTesting.reset();
+      const failed = homeSessionPrCacheKey('5', 'd', 's');
+      refreshHomeSessionPr(failed, async () => { throw new Error('offline'); }, { now: 4_000, persist: { ...persist, scope: '5' } });
+      await vi.advanceTimersByTimeAsync(0);
+      await hydrateHomeSessionPr('5', 'u1');
+      expect(readHomeSessionPr(failed)).toEqual({ ref, status: merged });
+
       // 另一个账号读不到。
       prStoreTesting.reset();
       await hydrateHomeSessionPr('2', 'u2');
```

**File**: `apps/mobile/src/session/homeSessionPrStore.ts` (modified, +6/-2)
```diff
@@ -46,6 +46,8 @@ interface Entry {
   fetchedAt: number;
   refreshKey: string | undefined;
   inflight: boolean;
+  /** 本次运行里有一次查询成功返回(含「没有 PR」)。查询失败留下的空值不算,读回仍可补上。 */
+  confirmed?: boolean;
   persist?: HomeSessionPrPersistTarget;
 }
 
@@ -104,6 +106,7 @@ export function refreshHomeSessionPr(
     refreshKey: options.refreshKey,
     value: entry?.value ?? null,
     persist: options.persist ?? entry?.persist,
+    confirmed: entry?.confirmed,
   };
   entries.delete(key);
   entries.set(key, next);
@@ -114,6 +117,7 @@ export function refreshHomeSessionPr(
       // 读回的上次结果可能在本次查询在途时才种入(冷启动已在线),load 拿到的 previous 里没有它:
       // 状态查询失败的这一轮不能用 null 覆盖已读回的状态。
       next.value = keepKnownStatus(value, next.value);
+      next.confirmed = true;
       if (next.persist) schedulePersist(next.persist.scope, next.persist.userId);
     })
     // 失败保留上次结果:网络抖动不该让已显示的 PR 号消失;下一个刷新周期再试。
@@ -236,8 +240,8 @@ export function hydrateHomeSessionPr(scope: string, userId: string): Promise<voi
       for (const row of parseStoredRows(raw).reverse()) {
         const key = homeSessionPrCacheKey(scope, row.deviceId, row.sessionId, row.related);
         const entry = entries.get(key);
-        // 已有结果(含查到「没有 PR」)以本次运行为准;只补还在等首查的任务。
-        if (entry && (entry.value || !entry.inflight)) continue;
+        // 已有结果(含查到「没有 PR」)以本次运行为准;首查还在途或失败过的任务才补上读回的结果。
+        if (entry && (entry.value || entry.confirmed)) continue;
         const persist = { scope, userId, deviceId: row.deviceId, sessionId: row.sessionId, related: row.related };
         if (entry) {
           // 在途的首查还没回来:先显示上次结果,查到后照常覆盖;查询失败则保留它。
```

---

### Incident Patch 3: `9755b8ad` (2026-11-05)
**Commit Message**: fix(mobile): keep hydrated PR status when the first lookup races it

On a cold start with the device already online, the first refresh can start
before the saved result is read back. If its status lookup failed, the
loader returned a null status and overwrote the hydrated one. Carry the
entry's latest known status for the same PR when committing a result.

Assisted-by: Cindy (https://cindy.app)
Signed-off-by: Dash <[REDACTED_EMAIL]>

**File**: `apps/mobile/src/__tests__/homeDisplaySettings.test.ts` (modified, +8/-0)
```diff
@@ -443,6 +443,14 @@ describe('home PR cache', () => {
       expect(refreshHomeSessionPr(key, load, { now: 2_000, persist: { ...persist, scope: '1' } })).toBe(0);
       expect(load).toHaveBeenCalledWith({ ref, status: merged });
 
+      // 冷启动已在线:首查在读回之前就开始,状态查询失败也不能把读回的状态覆盖成空。
+      prStoreTesting.reset();
+      const raced = homeSessionPrCacheKey('4', 'd', 's');
+      const hydrating = hydrateHomeSessionPr('4', 'u1');
+      refreshHomeSessionPr(raced, async () => { await hydrating; return { ref, status: null }; }, { now: 3_000, persist: { ...persist, scope: '4' } });
+      await vi.waitFor(() => expect(readHomeSessionPr(raced)).toEqual({ ref, status: merged }));
+      await vi.advanceTimersByTimeAsync(0);
+
       // 另一个账号读不到。
       prStoreTesting.reset();
       await hydrateHomeSessionPr('2', 'u2');
```

**File**: `apps/mobile/src/session/homeSessionPrStore.ts` (modified, +17/-1)
```diff
@@ -111,7 +111,9 @@ export function refreshHomeSessionPr(
   void load(next.value)
     .then((value) => {
       if (entries.get(key) !== next) return;
-      next.value = value;
+      // 读回的上次结果可能在本次查询在途时才种入(冷启动已在线),load 拿到的 previous 里没有它:
+      // 状态查询失败的这一轮不能用 null 覆盖已读回的状态。
+      next.value = keepKnownStatus(value, next.value);
       if (next.persist) schedulePersist(next.persist.scope, next.persist.userId);
     })
     // 失败保留上次结果:网络抖动不该让已显示的 PR 号消失;下一个刷新周期再试。
@@ -123,6 +125,20 @@ export function refreshHomeSessionPr(
   return 0;
 }
 
+/** 同一 PR 这一轮没拿到状态时沿用已有状态(含 additional 里的各条);换了 PR 则不沿用。 */
+function keepKnownStatus(value: HomeSessionPrInfo | null, known: HomeSessionPrInfo | null): HomeSessionPrInfo | null {
+  if (!value || !known) return value;
+  const knownRows = [known, ...(known.additional ?? [])];
+  const fill = (row: HomeSessionPrInfo): HomeSessionPrInfo => {
+    if (row.status) return row;
+    const status = knownRows.find((item) => prStatusKey(item.ref) === prStatusKey(row.ref))?.status ?? null;
+    return status ? { ...row, status } : row;
+  };
+  const filled = fill(value);
+  if (!value.additional) return filled;
+  return { ...filled, additional: value.additional.map(fill) };
+}
+
 export async function loadHomeSessionPr(
   invoke: Invoke,
   deviceId: string,
```

#### Recent Merged Pull Requests:
- **PR #9074** (2026-11-05): feat(mobile): iOS 原生输入框滚到头再拖即可调高 (@dashhuang)
- **PR #9073** (2026-11-05): fix(computer): 补齐输入失败诊断并统一恢复建议 (@dashhuang)
- **PR #9071** (2026-11-05): feat(desktop): 记录各进程内存并支持主进程堆采样，排查内存泄漏 (@dashhuang)
- **PR #9070** (2026-11-05): docs(readme): soften the star history heading (@dashhuang)
- **PR #9069** (2026-11-05): fix(mobile): 首页任务的 PR 关联和状态在重开 App 后先显示上次结果 (@dashhuang)
- **PR #9059** (2026-11-05): fix(scheduler): 修复自动化到期继续触发并整理配置界面 (@DavidShenXD)

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

## X. computer): retain input failure diagnostics and align recovery advice

**RULE**:
When implementing operations in `packages/lizi-mcps/src/computer/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in makecindy/cindy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a9ea6286`: computer): retain input failure diagnostics and align recovery advice. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/lizi-mcps/src/computer/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
## Input failure advice

For `type_text`, `background_unavailable` and `type_text_incomplete` preserve
error codes and structured progress/uncertainty, but replace driver recovery
prose with Cindy MCP guidance. The driver may suggest pixel-targeted typing or
foreground retries; Cindy's `type_text` schema does not accept `x/y` and a refusal
must not trigger an automatic route change. Inspect web-content fields with
`get_window_state`; `set_value` with a fresh element token is the supported text
route when continuing is appropriate. After incomplete typing, do not resend the
text or suffix without inspecting what happened. Observation success is not
input completion. This applies to both thrown errors and returned refusals.
See [result.ts](result.ts) and the MCP-entry regressions in
[computerMcpServer.test.ts](computerMcpServer.test.ts).

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a9ea6286` are properly handled with clean fallback behavior.
