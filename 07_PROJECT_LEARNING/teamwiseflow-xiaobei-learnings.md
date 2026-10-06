# Forensic Learning Record (Deep Inspection): TeamWiseFlow/xiaobei

> **Canonical Artifact**: `07_PROJECT_LEARNING/teamwiseflow-xiaobei-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TeamWiseFlow/xiaobei](https://github.com/TeamWiseFlow/xiaobei))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:56:11.216Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TeamWiseFlow/xiaobei`
- **Description**: 为OPC/中小微企业量身打造的自媒体获客智能体
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 8576 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crews/content-producer/skills/expert-video/tools/collage-broll/scripts/run_render.py`
```
#!/usr/bin/env python3
"""Stage 10 render 批量调度——读 gen-jobs.json 逐条调公共 aigc-video-gen wrapper 走 i2v 模式（首尾帧插值）。

每个 job 字段：
  prompt         aigc-video-gen --prompt（中文声画同出描述）
  first_frame    首帧路径（纯色空场，720x1280）
  last_frame     尾帧路径（确认静帧裁到 720x1280，720P）
  output         输出 MP4 路径（相对 workspace，须在 output_videos/ 或 <platform>/outputs/ 下——aigc-video-gen 的 ensure_safe_output 要求）
  ratio          默认 9:16
  resolution     默认 720P
  duration       默认 5

aigc-video-gen wrapper 内部已带候选链 fallback + decisions.log 落盘，本脚本只做批量调度——
串行调（视频生成是异步轮询任务，并行调会撞平台并发限）。

Usage:
  python3 <skill-dir>/scripts/run_render.py --batch <project>/render/gen-jobs.json
  python3 <skill-dir>/scripts/run_render.py --batch <project>/render/gen-jobs.json --dry-run

Exit codes:
  0  全部 job 跑通
  1  参数错 / gen-jobs.json 不存在 / 格式错 / aigc-video-gen wrapper 不在 PATH
  2  部分 job 失败（stderr 报失败清单，已跑通的保留）
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

# 公共 wrapper——aigc-video-gen（PATH 化调用，不裸引用其下 scripts/gen.py）
WRAPPER = "aigc-video-gen"


def die(msg: str, code: int = 1) -> None:
    print(f"[error] {msg}", file=sys.stderr)
    sys.exit(code)


def run_one(job: dict, job_id: int, dry_run: bool) -> tuple[bool, str]:
    """调 aigc-video-gen wrapper i2v 跑一个 job. 返 (ok, detail)."""
    for required in ("prompt", "first_frame", "last_frame", "output"):
        if not job.get(required):
            return False, f"job {job_id} missing field: {required}"

    cmd = [
        WRAPPER,
        "--prompt", job["prompt"],
        "--image", job["first_frame"],        # i2v 首帧
        "--last-frame", job["last_frame"],    # i2v 尾帧
        "--ratio", job.get("ratio", "9:16"),
        "--resolution", job.get("resolution", "720P"),
        "--duration", str(job.get("duration", 5)),
        "--output", job["output"],
    ]

    if dry_run:
        print(f"[dry-run] job {job_id}: {' '.join(cmd[:4])} ... --output {job['output']}")
        return True, "dry-run skipped"

    print(f"[info] job {job_id}: aigc-video-gen i2v → {job['output']}")
    try:
        r = subprocess.run(cmd, timeout=1200)
        if r.returncode == 0:
            return True, f"ok exit 0 → {job['output']}"
        return False, f"aigc-video-gen exit {r.returncode} for job {job_id}（查 wrapper stderr + decisions.log）"
    except subprocess.TimeoutExpired:
        return False, f"aigc-video-gen timeout 1200s for job {job_id}"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stage 10 render 批量调度——读 gen-jobs.json 逐条调公共 aigc-video-gen wrapper 走 i2v（首尾帧插值）."
    )
    parser.add_argument("--batch", required=True, help="gen-jobs.json 路径")
    parser.add_argument("--dry-run", action="store_true", help="只打印不真调")
    args = parser.parse_args()

    if not shutil.which(WRAPPER):
        die(f"wrapper 不在 PATH: {WRAPPER}（确认公共 aigc-video-gen 已通过 apply-addons.sh 软链到 ~/.openclaw/bin）")

    batch_path = Path(args.batch).resolve()
    if not batch_path.is_file():
        die(f"gen-jobs.json 不存在: {batch_path}")

    try:
        jobs = json.loads(batch_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        die(f"gen-jobs.json 格式错: {e}")

    if not isinstance(jobs, list):
        die("gen-jobs.json 顶层数组不是 list")

    print(f"[info] batch: {batch_path} ({len(jobs)} jobs)")

    failures: list[tuple[int, str]] = []
    for i, job in enumerate(jobs):
        ok, detail = run_one(job, i, args.dry_run)
        print(detail)
        if not ok:
            failures.append((i, detail))

    if failures:
        print(f"\n[fail] {len(failures)} job(s) failed:", file=sys.stderr)
        for jid, det in failures:
            print(f"  job {jid}: {det}", file=sys.stderr)
        sys.exit(2)

    print(f"\n[ok] all {len(jobs)} jobs completed")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/render-shot.py`
```
#!/usr/bin/env python3
"""Stage 10 — render-shot：按 slot 渲染。

Usage:
  python3 scripts/render-shot.py <project_dir> [--shot-id shot-01] [--dry-run]

入：project_dir/storyboard/shot_decompose.json + characters/ + slots/asset-resolve.json
出：project_dir/render/shot-NN/ 下产物：
    first-frame.png（首帧静照，调 awk-img-gen 生成或素材裁切）
    last-frame.png（尾帧静照）
    gen*.mp4（aigc-video-gen i2v 产物，首尾帧插值；实际产出名不固定，gen.mp4 / gen-run-v01.mp4 / gen-v2.mp4 等，assemble 自动识别取最新）
    settings.log

按 variation_type 传参考图：
- static：传 1 张（first=last）
- dynamic：传 2 张（first + last）
- transition：跨机位慎用，传 2 张但可能跳镜
"""

import argparse
import json
import sys
from pathlib import Path

import _brief


def die(msg: str) -> None:
    print(f"[error] {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Stage 10 render-shot")
    parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
    parser.add_argument("--shot-id", default=None, help="只渲某镜，不传则提示 agent 逐镜跑")
    parser.add_argument("--dry-run", action="store_true", help="只打印调用计划不真渲")
    args = parser.parse_args()

    project = Path(args.project_dir).resolve()
    if _brief.collage_guard(project, "Stage 10 render-shot"):
        return
    decompose_path = project / "storyboard" / "shot_decompose.json"
    resolve_path = project / "slots" / "asset-resolve.json"
    if not decompose_path.is_file() or not resolve_path.is_file():
        die("前置缺失: shot_decompose.json 或 asset-resolve.json 不存在")

    render_dir = project / "render"
    render_dir.mkdir(parents=True, exist_ok=True)

    decompose = json.loads(decompose_path.read_text(encoding="utf-8"))
    shots_to_render = decompose.get("decompose", [])
    if args.shot_id:
        shots_to_render = [s for s in shots_to_render if s.get("shot_id") == args.shot_id]
        if not shots_to_render:
            die(f"未在 shot_decompose.json 找到 shot_id={args.shot_id}")

    if not shots_to_render:
        print(f"[info] shot_decompose.json 暂无镜头数据，agent 先填 storyboard/shot_decompose.json")
        return

    for shot in shots_to_render:
        sid = shot.get("shot_id")
        if not sid:
            continue
        shot_dir = render_dir / sid
        shot_dir.mkdir(parents=True, exist_ok=True)

        # checkpoint：产物齐则跳
        gen_mp4 = shot_dir / "gen-run-v01.mp4"
        if gen_mp4.is_file():
            print(f"[checkpoint] {sid} 已渲：{gen_mp4}")
            continue

        variation = shot.get("variation_type", "dynamic")
        plan = {
            "shot_id": sid,
            "first_frame_prompt": shot.get("first_frame"),
            "last_frame_prompt": shot.get("last_frame"),
            "variation_type": variation,
            "reference_images": 1 if variation == "static" else 2,
            "calls": [
                "awk-img-gen → first-frame.png",
                "awk-img-gen → last-frame.png" if variation != "static" else "(skip, same as first)",
                "aigc-video-gen i2v --first first-frame.png --last last-frame.png → gen-run-v01.mp4",
            ],
        }
        (shot_dir / "settings.log").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

        print(f"[plan] {sid} 渲染计划已落 {shot_dir}/settings.log")
        print(f"  - variation={variation} reference_images={plan['reference_images']}")
        if args.dry_run:
            print(f"  [dry-run] 不真调")
        else:
            print(f"  [next] agent 调 awk-img-gen + aigc-video-gen 落产物到 {shot_dir}/")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/it-engineer/skills/awada-channel-setup/scripts/apply-awada-config.py`
```
#!/usr/bin/env python3
"""apply-awada-config.py — 把 awada channel + customerDB hook 合并进运行中的 openclaw.json。

读同目录 ../openclaw-awada-sample.json 作模板，提示输入 awadaKey（必填）+ lane（可选），
合并进 ~/.openclaw/openclaw.json 的 channels.awada 与 plugins，原子写回（先备份）。
relayBaseUrl 缺省时回退到官方 relay 域名；platform 由 relay 按 lane 绑定推导，客户端不发。
不重启 Gateway（由调用方人工确认后执行）。
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import time
from pathlib import Path

DEFAULT_RELAY_BASE_URL = "https://relay.openclaw-for-business.com"

SAMPLE = Path(__file__).resolve().parent.parent / "openclaw-awada-sample.json"
TARGET = Path(os.path.expanduser("~/.openclaw/openclaw.json"))
WISEFLOW_ROOT = Path(os.path.expanduser(
    os.environ.get("WISEFLOW_PROJECT_ROOT", "~/wiseflow-pro")
)).resolve()


def deep_merge(base: dict, overlay: dict) -> dict:
    out = dict(base)
    for k, v in overlay.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def prompt(label: str, default: str) -> str:
    val = input(f"{label} [{default}]: ").strip()
    return val or default


def main() -> int:
    if not SAMPLE.exists():
        print(f"ERROR: sample not found: {SAMPLE}", file=sys.stderr)
        return 1
    if not TARGET.exists():
        print(f"ERROR: target not found: {TARGET}", file=sys.stderr)
        return 1

    sample = json.loads(SAMPLE.read_text(encoding="utf-8"))

    awada_key = prompt("awadaKey", "<AWADA_KEY>")
    lane = input("lane [留空=服务器默认 User]: ").strip()
    relay_base_url = prompt("relayBaseUrl", DEFAULT_RELAY_BASE_URL)

    sample.setdefault("channels", {}).setdefault("awada", {})
    sample["channels"]["awada"]["awadaKey"] = awada_key
    if lane:
        sample["channels"]["awada"]["lane"] = lane
    if relay_base_url and relay_base_url != DEFAULT_RELAY_BASE_URL:
        sample["channels"]["awada"]["relayBaseUrl"] = relay_base_url

    # 渲染占位符
    def render(obj):
        if isinstance(obj, str):
            return (obj
                    .replace("{WISEFLOW_PROJECT_ROOT}", str(WISEFLOW_ROOT))
                    .replace("{HOME}", os.path.expanduser("~")))
        if isinstance(obj, dict):
            return {k: render(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [render(x) for x in obj]
        return obj

    overlay = render(sample)

    # 备份
    ts = time.strftime("%Y%m%d-%H%M%S")
    bak = TARGET.with_suffix(f".json.bak-{ts}")
    shutil.copy2(TARGET, bak)
    print(f"backup: {bak}")

    cfg = json.loads(TARGET.read_text(encoding="utf-8"))
    cfg = deep_merge(cfg, overlay)

    # 原子写回
    tmp = TARGET.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, TARGET)
    print(f"updated: {TARGET}")
    print("next: 确认后执行 systemctl --user restart openclaw-gateway.service")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `crews/it-engineer/skills/icp-exemption/scripts/generate_pdf.py`
```
#!/usr/bin/env python3
"""
Apple 国区 ICP 豁免申请附件生成器
生成符合 Apple 要求的正式申请附件 PDF

前置依赖：
  - Python 3.8+
  - reportlab (pip install reportlab)
  - 中文字体包（如 fonts-wqy-zenhei），需提前安装
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape


def get_today_chinese():
    """返回今天的中文日期，如 2024年12月01日"""
    today = datetime.today()
    return f"{today.year}年{today.month:02d}月{today.day:02d}日"


def generate_pdf(team_id: str, name: str, app_id: str, date: str, output_path: str):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
        from reportlab.lib import colors
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import os
    except ImportError:
        print("错误：缺少 reportlab 库，请运行 pip install reportlab", file=sys.stderr)
        sys.exit(1)

    # Escape user input to prevent reportlab XML markup injection
    team_id = escape(team_id)
    name = escape(name)
    app_id = escape(app_id)
    date = escape(date)

    # Try to register a CJK font for Chinese characters
    font_name = "Helvetica"  # fallback
    bold_font_name = "Helvetica-Bold"

    cjk_fonts = [
        ("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", "WQYZenHei"),
        ("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", "WQYMicroHei"),
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", "NotoSansCJK"),
        ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", "NotoSansCJK"),
        ("/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", "NotoSansCJK"),
    ]

    for font_path, font_reg_name in cjk_fonts:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont(font_reg_name, font_path))
                font_name = font_reg_name
                bold_font_name = font_reg_name  # use same font for bold too
                break
            except Exception:
                continue

    if font_name == "Helvetica":
        print(
            "警告：未找到中文字体，PDF 中的中文可能无法正常显示。\n"
            "请安装中文字体包，例如：sudo apt-get install fonts-wqy-zenhei",
            file=sys.stderr,
        )

    # Page layout
    page_width, page_height = A4
    margin = 30 * mm

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=25 * mm,
        bottomMargin=25 * mm,
        title="Apple 国区 ICP 豁免申请附件",
        author=name,
    )

    # Styles
    def style(name_s, **kwargs):
        defaults = dict(fontName=font_name, fontSize=11, leading=18, spaceAfter=0, spaceBefore=0)
        defaults.update(kwargs)
        return ParagraphStyle(name_s, **defaults)

    title_style = style("Title", fontName=bold_font_name, fontSize=16, leading=26,
                        alignment=TA_CENTER, spaceBefore=0, spaceAfter=8)
    subtitle_style = style("Subtitle", fontSize=11, alignment=TA_CENTER, spaceAfter=4)
    section_header_style = style("SectionHeader", fontName=bold_font_name, fontSize=12,
                                  leading=20, spaceBefore=14, spaceAfter=4)
    body_style = style("Body", fontSize=11, leading=20, alignment=TA_JUSTIFY)
    info_key_style = style("InfoKey", fontName=bold_font_name, fontSize=11, leading=20)
    info_val_style = style("InfoVal", fontSize=11, leading=20)
    declaration_style = style("Declaration", fontSize=11, leading=22, alignment=TA_JUSTIFY)
    sign_label_style = style("SignLabel", fontName=bold_font_name, fontSize=11, leading=22)
    sign_val_style = style("SignVal", fontSize=11, leading=22)
    footer_style = style("Footer", fontSize=9, leading=14, alignment=TA_CENTER,
                          textColor=colors.grey)

    story = []

    # ── Title ──────────────────────────────────────────────
    story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("Apple 国区 ICP 豁免申请附件", title_style))
    story.append(Paragraph("App Store Connect 中国大陆地区 ICP 备案例外申请", subtitle_style))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.black))
    story.append(Spacer(1, 5 * mm))

    # ── 账户信息 ──────────────────────────────────────────
    story.append(Paragraph("一、账户信息", section_header_style))

    info_data = [
        [Paragraph("Team ID（团队 ID）", info_key_style),
         Paragraph(f"：{team_id}", info_val_style)],
        [Paragraph("账户持有人法定姓名", info_key_style),
         Paragraph(f"：{name}", info_val_style)],
    ]
    info_table = Table(info_data, colWidths=[65 * mm, None])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(info_table)

    # ── App 信息 ───────────────────────────────────────────
    story.append(Paragraph("二、App 信息", section_header_style))

    app_data = [
        [Paragraph("App ID（应用 ID）", info_key_style),
         Paragraph(f"：{app_id}", info_val_style)],
    ]
    app_table = Table(app_data, colWidths=[65 * mm, None])
    app_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(app_table)

    # ── 声明 ──────────────────────────────────────────────
    story.append(Paragraph("三、申请声明", section_header_style))

    declarations = [
        f"本人 {name}，Team ID 为 {team_id}，现就 App ID 为 {app_id} 的独立应用，向 Apple 申请中国大陆地区 ICP 备案豁免例外批准。本人声明如下：",
        "",
        "1. 本人有意就上述独立 App 向 Apple 申请例外批准。",
        "",
        "2. 本人已充分了解并遵守所有相关法律法规及 Apple 的相关政策要求，确认本 App 属于以下豁免情形之一：",
        "    • 完全离线应用，不进行任何网络通信；或",
        "    • 仅通过 iCloud 同步数据，不连接其他任何服务器；或",
        "    • 仅通过 Apple 内购（IAP）进行交易，无自建支付系统及其他联网功能。",
        "",
        "3. 本人确认所提交的所有信息真实、准确、完整，与 App Store Connect 账户信息完全一致。",
        "",
        "4. 如存在任何虚假陈述或误导信息，本人愿意承担由此产生的全部法律责任。",
    ]

    for line in declarations:
        if line == "":
            story.append(Spacer(1, 3 * mm))
        else:
            story.append(Paragraph(line, declaration_style))

    # ── 签署 ──────────────────────────────────────────────
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#aaaaaa")))
    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph("四、签署", section_header_style))
    story.append(Spacer(1, 2 * mm))

    # Signature area as a table
    sig_line = "_" * 20
    sign_data = [
        [Paragraph("手写签名：", sign_label_style),
         Paragraph(sig_line, sign_val_style),
         Paragraph("", sign_val_style)],
        [Paragraph("正楷姓名：", sign_label_style),
         Paragraph(name, sign_val_style),
         Paragraph("", sign_val_style)],
        [Paragraph("日　　期：", sign_label_style),
         Paragraph(date, sign_val_style),
         Paragraph("", sign_val_style)],
    ]
    sign_table = Table(sign_data, colWidths=[30 * mm, 80 * mm, None])
    sign_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(sign_table)

    story.append(Spacer(1, 10 * mm))

    # ── 注意事项 ─────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#aaaaaa")))
    story.append(Spacer(1, 4 * mm))
    notice_style = style("Notice", fontSize=9, leading=15, textColor=colors.HexColor("#555555"),
                          alignment=TA_JUSTIFY)
    story.append(Paragraph(
        "【注意事项】本附件仅供 Apple App Store Connect ICP 豁免申请使用。"
        "请在手写签名后将本文件扫描或拍照，作为附件上传至 App Store Connect 申诉流程中。"
        "如有多个 App 需要申请，请为每个 App 单独准备并提交一份附件。",
        notice_style
    ))

    story.append(Spacer(1, 5 * mm))
    story.append(Paragraph(
        f"本文件由 Apple ICP 豁免申请助手自动生成  ·  生成日期：{date}",
        footer_style
    ))

    doc.build(story)
    print(f"PDF 生成成功：{output_path}")


def main():
    parser = argparse.ArgumentParser(description="生成 Apple 国区 ICP 豁免申请附件 PDF")
    parser.add_argument("--team-id", required=True, help="Team ID（团队 ID）")
    parser.add_argument("--name", required=True, help="账户持有人法定姓名")
    parser.add_argument("--app-id", required=True, help="App ID")
    parser.add_argument("--date", default="", help="申请日期（留空则使用今天）")
    parser.add_argument("--output", default="",
                        help="输出路径（留空则保存到当前目录）")
    args = parser.parse_args()

    date = args.date if args.date else get_today_chinese()

    output_path = args.output
    if not output_path:
        output_path = str(Path.cwd() / "ICP豁免申请附件.pdf")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    generate_pdf(args.team_id, args.name, args.app_id, date, output_path)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/it-engineer/skills/work-channel-binding/scripts/apply-work-channel-binding.py`
```
#!/usr/bin/env python3
import argparse
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


VALID_CHANNELS = {"feishu", "wecom"}


def config_path() -> Path:
    return Path(
        os.environ.get(
            "OPENCLAW_CONFIG_PATH",
            Path.home() / ".openclaw" / "openclaw.json",
        )
    ).expanduser()


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)


def load_json_object(path: Path, label: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON in {label} {path}: {exc}") from exc
    except OSError as exc:
        raise SystemExit(f"cannot read {label} {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise SystemExit(f"{label} must be a JSON object: {path}")
    return payload


def ensure_dict(parent: dict[str, Any], key: str) -> dict[str, Any]:
    value = parent.get(key)
    if value is None:
        value = {}
        parent[key] = value
    if not isinstance(value, dict):
        raise SystemExit(f"config.{key} must be an object")
    return value


def ensure_list(parent: dict[str, Any], key: str) -> list[Any]:
    value = parent.get(key)
    if value is None:
        value = []
        parent[key] = value
    if not isinstance(value, list):
        raise SystemExit(f"config.{key} must be an array")
    return value


def validated_plan(plan: dict[str, Any]) -> tuple[str, list[dict[str, str]], list[dict[str, str]]]:
    version = plan.get("version")
    if version != 1:
        raise SystemExit("plan.version must be 1")
    channel = plan.get("channel")
    if channel not in VALID_CHANNELS:
        raise SystemExit("plan.channel must be feishu or wecom")

    raw_accounts = plan.get("accounts")
    if not isinstance(raw_accounts, list):
        raise SystemExit("plan.accounts must be an array")
    accounts: list[dict[str, str]] = []
    for index, item in enumerate(raw_accounts):
        if not isinstance(item, dict):
            raise SystemExit(f"plan.accounts[{index}] must be an object")
        account_id = item.get("accountId")
        app_id = item.get("appId")
        app_secret = item.get("appSecret")
        name = item.get("name") or account_id
        dm_policy = item.get("dmPolicy") or "open"
        group_policy = item.get("groupPolicy") or "open"
        for field, value in {
            "accountId": account_id,
            "appId": app_id,
            "appSecret": app_secret,
            "name": name,
            "dmPolicy": dm_policy,
            "groupPolicy": group_policy,
        }.items():
            if not isinstance(value, str) or not value.strip():
                raise SystemExit(f"plan.accounts[{index}].{field} must be a non-empty string")
        accounts.append(
            {
                "accountId": account_id.strip(),
                "name": name.strip(),
                "appId": app_id.strip(),
                "appSecret": app_secret,
                "dmPolicy": dm_policy.strip(),
                "groupPolicy": group_policy.strip(),
            }
        )

    raw_bindings = plan.get("bindings")
    if not isinstance(raw_bindings, list):
        raise SystemExit("plan.bindings must be an array")

    account_ids = {account["accountId"] for account in accounts}
    bindings: list[dict[str, str]] = []
    for index, item in enumerate(raw_bindings):
        if not isinstance(item, dict):
            raise SystemExit(f"plan.bindings[{index}] must be an object")
        agent_id = item.get("agentId")
        account_id = item.get("accountId")
        if not isinstance(agent_id, str) or not agent_id.strip():
            raise SystemExit(f"plan.bindings[{index}].agentId must be a non-empty string")
        if not isinstance(account_id, str) or not account_id.strip():
            raise SystemExit(f"plan.bindings[{index}].accountId must be a non-empty string")
        if account_id.strip() not in account_ids:
            raise SystemExit(f"plan.bindings[{index}].accountId has no matching account")
        bindings.append({"agentId": agent_id.strip(), "accountId": account_id.strip()})
    return channel, accounts, bindings


def binding_exists(
    bindings: list[Any],
    agent_id: str,
    channel: str,
    account_id: str,
) -> bool:
    for binding in bindings:
        if not isinstance(binding, dict):
            continue
        match = binding.get("match")
        if not isinstance(match, dict):
            continue
        if (
            binding.get("agentId") == agent_id
            and match.get("channel") == channel
            and match.get("accountId") == account_id
        ):
            return True
    return False


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply a confirmed work channel binding plan."
    )
    parser.add_argument("--plan-file", required=True)
    args = parser.parse_args()

    plan_path = Path(args.plan_file).expanduser()
    plan = load_json_object(plan_path, "plan")
    channel, plan_accounts, plan_bindings = validated_plan(plan)

    path = config_path()
    config = load_json_object(path, "openclaw config")
    backup = path.with_suffix(
        path.suffix
        + ".bak-"
        + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    )
    shutil.copy2(path, backup)

    channels = ensure_dict(config, "channels")
    channel_config = channels.setdefault(channel, {"enabled": True, "accounts": {}})
    if not isinstance(channel_config, dict):
        raise SystemExit(f"config.channels.{channel} must be an object")
    channel_config["enabled"] = True
    accounts_config = channel_config.setdefault("accounts", {})
    if not isinstance(accounts_config, dict):
        raise SystemExit(f"config.channels.{channel}.accounts must be an object")
    for account in plan_accounts:
        account_id = account["accountId"]
        accounts_config[account_id] = {
            **(accounts_config.get(account_id) if isinstance(accounts_config.get(account_id), dict) else {}),
            "name": account["name"],
            "appId": account["appId"],
            "appSecret": account["appSecret"],
            "dmPolicy": account["dmPolicy"],
            "groupPolicy": account["groupPolicy"],
        }

    plugins = ensure_dict(config, "plugins")
    plugin_entries = ensure_dict(plugins, "entries")
    plugin_config = plugin_entries.setdefault(channel, {"enabled": True})
    if not isinstance(plugin_config, dict):
        raise SystemExit(f"config.plugins.entries.{channel} must be an object")
    plugin_config["enabled"] = True

    bindings = ensure_list(config, "bindings")
    for item in plan_bindings:
        agent_id = item["agentId"]
        account_id = item["accountId"]
        if binding_exists(bindings, agent_id, channel, account_id):
            continue
        bindings.append(
            {
                "agentId": agent_id,
                "comment": f"{channel}:{account_id} -> {agent_id}",
                "match": {"channel": channel, "accountId": account_id},
            }
        )

    atomic_write_json(path, config)
    print(
        json.dumps(
            {"updated": str(path), "backup": str(backup), "channel": channel},
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/it-engineer/skills/work-channel-binding/scripts/check-work-channel-bindings.py`
```
#!/usr/bin/env python3
import json
import os
from pathlib import Path
from typing import Any


WORK_CHANNELS = {"feishu", "wecom"}


def config_path() -> Path:
    return Path(
        os.environ.get(
            "OPENCLAW_CONFIG_PATH",
            Path.home() / ".openclaw" / "openclaw.json",
        )
    ).expanduser()


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SystemExit(f"openclaw config not found: {path}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON in openclaw config {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise SystemExit(f"openclaw config must be a JSON object: {path}")
    return payload


def configured_accounts(channels: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    for channel in WORK_CHANNELS:
        channel_config = channels.get(channel)
        if not isinstance(channel_config, dict):
            continue
        accounts = channel_config.get("accounts")
        if not isinstance(accounts, dict):
            continue
        result[channel] = [
            {
                "accountId": account_id,
                "name": account.get("name") if isinstance(account, dict) else None,
                "hasAppId": bool(account.get("appId")) if isinstance(account, dict) else False,
                "hasAppSecret": bool(account.get("appSecret")) if isinstance(account, dict) else False,
                "dmPolicy": account.get("dmPolicy") if isinstance(account, dict) else None,
                "groupPolicy": account.get("groupPolicy") if isinstance(account, dict) else None,
            }
            for account_id, account in sorted(accounts.items())
        ]
    return result


def main() -> None:
    path = config_path()
    config = load_config(path)
    raw_agents = config.get("agents")
    raw_agents_list = raw_agents.get("list", []) if isinstance(raw_agents, dict) else []
    agents = {
        agent.get("id")
        for agent in raw_agents_list
        if isinstance(agent, dict) and agent.get("id")
    }
    bindings = config.get("bindings") if isinstance(config.get("bindings"), list) else []
    channels = config.get("channels") if isinstance(config.get("channels"), dict) else {}

    agent_bindings: dict[str, list[dict[str, Any]]] = {}
    for binding in bindings:
        if not isinstance(binding, dict):
            continue
        agent_id = binding.get("agentId")
        match = binding.get("match")
        if not isinstance(match, dict):
            continue
        channel = match.get("channel")
        account_id = match.get("accountId")
        if not agent_id or not channel:
            continue
        agent_bindings.setdefault(agent_id, []).append(
            {"channel": channel, "accountId": account_id}
        )

    summary = {
        "configPath": str(path),
        "agents": sorted(agents),
        "enabledChannels": sorted(
            name
            for name, value in channels.items()
            if isinstance(value, dict) and value.get("enabled") is not False
        ),
        "workChannelsConfigured": sorted(name for name in WORK_CHANNELS if name in channels),
        "workChannelAccounts": configured_accounts(channels),
        "bindings": agent_bindings,
        "itEngineerHasWorkBinding": any(
            item["channel"] in WORK_CHANNELS
            for item in agent_bindings.get("it-engineer", [])
        ),
        "hrbpEnabled": "hrbp" in agents,
        "hrbpHasWorkBinding": any(
            item["channel"] in WORK_CHANNELS for item in agent_bindings.get("hrbp", [])
        ),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/it-engineer/skills/work-channel-binding/scripts/complete-pending-followup.py`
```
#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path


def state_path() -> Path:
    return Path.home() / ".openclaw" / "workspace-main" / "pending-followup.json"


def atomic_write_json(path: Path, payload: dict) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def main() -> None:
    path = state_path()
    if not path.exists():
        print(json.dumps({"status": "none"}, ensure_ascii=False, indent=2))
        return
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["status"] = "completed"
    payload["completedAt"] = datetime.now(timezone.utc).isoformat()
    atomic_write_json(path, payload)
    print(json.dumps({"status": "completed", "message": payload.get("message")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/it-engineer/skills/work-channel-binding/scripts/prepare-work-channel-binding.py`
```
#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from typing import Any


def redacted_accounts(accounts: list[dict[str, str]]) -> list[dict[str, str]]:
    return [
        {
            "accountId": account["accountId"],
            "name": account.get("name", account["accountId"]),
            "appId": account.get("appId", ""),
            "appSecret": "***" if account.get("appSecret") else "",
            "dmPolicy": account.get("dmPolicy", "open"),
            "groupPolicy": account.get("groupPolicy", "open"),
        }
        for account in accounts
    ]


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a redacted work channel binding plan.")
    parser.add_argument("--channel", required=True, choices=["feishu", "wecom"])
    parser.add_argument("--plan-file", required=True)
    parser.add_argument("--account-id", action="append", default=[])
    parser.add_argument("--agent-id", action="append", default=[])
    parser.add_argument("--app-id", action="append", default=[])
    parser.add_argument("--app-secret", action="append", default=[])
    parser.add_argument("--account-name", action="append", default=[])
    parser.add_argument("--dm-policy", action="append", default=[])
    parser.add_argument("--group-policy", action="append", default=[])
    args = parser.parse_args()

    expected = len(args.account_id)
    for label, values in {
        "--agent-id": args.agent_id,
        "--app-id": args.app_id,
        "--app-secret": args.app_secret,
    }.items():
        if len(values) != expected:
            raise SystemExit(f"{label} must appear the same number of times as --account-id")
    if args.account_name and len(args.account_name) != expected:
        raise SystemExit("--account-name must appear the same number of times as --account-id when provided")
    if args.dm_policy and len(args.dm_policy) != expected:
        raise SystemExit("--dm-policy must appear the same number of times as --account-id when provided")
    if args.group_policy and len(args.group_policy) != expected:
        raise SystemExit("--group-policy must appear the same number of times as --account-id when provided")

    accounts: list[dict[str, str]] = []
    bindings: list[dict[str, str]] = []
    for index, account_id in enumerate(args.account_id):
        name = args.account_name[index] if args.account_name else account_id
        dm_policy = args.dm_policy[index] if args.dm_policy else "open"
        group_policy = args.group_policy[index] if args.group_policy else "open"
        accounts.append(
            {
                "accountId": account_id,
                "name": name,
                "appId": args.app_id[index],
                "appSecret": args.app_secret[index],
                "dmPolicy": dm_policy,
                "groupPolicy": group_policy,
            }
        )
        bindings.append(
            {"agentId": args.agent_id[index], "accountId": account_id, "channel": args.channel}
        )

    plan = {
        "version": 1,
        "channel": args.channel,
        "accounts": accounts,
        "bindings": bindings,
        "requiresGatewayRestart": True,
    }
    plan_path = Path(args.plan_file).expanduser()
    atomic_write_json(plan_path, plan)
    print(
        json.dumps(
            {
                "planFile": str(plan_path),
                "channel": args.channel,
                "accounts": redacted_accounts(accounts),
                "bindings": bindings,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `crews/it-engineer/skills/work-channel-binding/scripts/record-pending-followup.py`
```
#!/usr/bin/env python3
import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


def state_path() -> Path:
    return Path.home() / ".openclaw" / "workspace-main" / "pending-followup.json"


def atomic_write_json(path: Path, payload: dict) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Record a pending Main Agent followup.")
    parser.add_argument("--reason", default="gateway-restart")
    parser.add_argument("--message", default="Gateway 已重启。请发送一条消息测试新的 channel binding 是否生效。")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    payload = {
        "version": 1,
        "type": "gateway-restart-followup",
        "status": "pending",
        "reason": args.reason,
        "createdAt": now.isoformat(),
        "expiresAt": (now + timedelta(days=1)).isoformat(),
        "message": args.message,
    }
    path = state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(path, payload)
    print(json.dumps({"pendingFollowup": str(path), "status": "pending"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `awada/index.ts`
```
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/feishu";
import { awadaPlugin } from "./src/channel.js";
import { setAwadaRuntime } from "./src/runtime.js";
import { registerCustomerDb, type CustomerDbConfig } from "./src/customerdb.js";

export { monitorAwadaProvider } from "./src/monitor.js";
export { probeAwada } from "./src/probe.js";
export { sendTextToAwada, encodeAwadaTo, decodeAwadaTo } from "./src/send.js";
export { publishTextToAwada } from "./src/publisher.js";
export { awadaPlugin } from "./src/channel.js";

type AwadaPluginConfig = {
  /**
   * When set, activates the built-in CustomerDB feature:
   * injects customer context into LLM prompts and registers silent sales
   * commands (payment_success, club_join).
   *
   * Example openclaw.json:
   *   "plugins": {
   *     "entries": {
   *       "awada": {
   *         "config": {
   *           "customerdb": {
   *             "agentId": "sales-cs",
   *             "workspaceDir": "/home/user/.openclaw/workspace-sales-cs"
   *           }
   *         }
   *       }
   *     }
   *   }
   */
  customerdb?: CustomerDbConfig & { enabled?: boolean };
};

// Custom config schema that allows the `customerdb` field.
// Using emptyPluginConfigSchema() would reject any config key (additionalProperties: false).
const awadaConfigSchema = {
  safeParse(
    value: unknown,
  ): { success: true; data: unknown } | { success: false; error: string } {
    if (value === undefined) return { success: true, data: undefined };
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { success: false, error: "expected config object" };
    }
    const obj = value as Record<string, unknown>;
    const allowed = new Set(["customerdb"]);
    const extra = Object.keys(obj).filter((k) => !allowed.has(k));
    if (extra.length > 0) {
      return { success: false, error: `unknown config keys: ${extra.join(", ")}` };
    }
    return { success: true, data: obj };
  },
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      customerdb: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          agentId: { type: "string" },
          workspaceDir: { type: "string" },
        },
      },
    },
  },
};

const plugin = {
  id: "awada",
  name: "Awada",
  description: "Awada channel plugin — WeChat via Redis bridge",
  configSchema: awadaConfigSchema,
  register(api: OpenClawPluginApi) {
    setAwadaRuntime(api.runtime);
    api.registerChannel({ plugin: awadaPlugin });

    const pluginCfg = (api.pluginConfig ?? {}) as AwadaPluginConfig;
    const cdbCfg = pluginCfg.customerdb;
    if (cdbCfg && cdbCfg.enabled !== false && cdbCfg.agentId) {
      registerCustomerDb(api, cdbCfg);
    }
  },
};

export default plugin;

```

### Core Architecture Module: `awada/src/accounts.ts`
```
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk/channel-plugin-common";
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { AwadaConfig, ResolvedAwadaAccount } from "./types.js";

/** Official relay gateway endpoint — used when channels.awada.relayBaseUrl is not set. */
export const DEFAULT_RELAY_BASE_URL = "https://relay.openclaw-for-business.com";

function getAwadaCfg(cfg: ClawdbotConfig): AwadaConfig | undefined {
  return cfg.channels?.awada as AwadaConfig | undefined;
}

export function resolveAwadaAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string | null;
}): ResolvedAwadaAccount {
  const awadaCfg = getAwadaCfg(params.cfg);
  const accountId = params.accountId?.trim() || DEFAULT_ACCOUNT_ID;
  const enabled = awadaCfg?.enabled !== false;
  // relayBaseUrl defaults to the official relay domain; only awadaKey is truly required.
  // lane is optional — when omitted, the server defaults to the "User" lane.
  const relayBaseUrl = awadaCfg?.relayBaseUrl?.trim() || DEFAULT_RELAY_BASE_URL;
  const awadaKey = awadaCfg?.awadaKey?.trim() || undefined;
  const lane = awadaCfg?.lane?.trim() || "";
  const configured = Boolean(awadaKey);

  return {
    accountId,
    enabled,
    configured,
    relayBaseUrl,
    awadaKey,
    lane,
    config: awadaCfg ?? {},
  };
}

export function listAwadaAccountIds(_cfg: ClawdbotConfig): string[] {
  return [DEFAULT_ACCOUNT_ID];
}

export function resolveDefaultAwadaAccountId(_cfg: ClawdbotConfig): string {
  return DEFAULT_ACCOUNT_ID;
}

```

### Core Architecture Module: `awada/src/audio-transcribe.ts`
```
/**
 * Audio transcription via 公共 ASR 路由（与 crews/main/skills/_shared/asr.py 同优先级）。
 *
 * 供应商优先级（2026-09 拍板，凭据在哪家走哪家）：
 *   1. 火山录音文件极速版 — VOLC_ASR_APP_ID+VOLC_ASR_ACCESS_KEY（旧控制台双头）
 *      或 VOLC_ASR_APP_KEY（新控制台单头）
 *      POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
 *   2. 百炼业务空间 — WORKSPACE_ID + MODELSTUDIO_API_KEY/DASHSCOPE_API_KEY
 *      POST https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *   3. 百炼 agent plan — AWK_API_KEY
 *      POST https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 *      模型 qwen-audio-3.0-asr-flash（BAILIAN_ASR_MODEL 可覆盖）
 *
 * 某家失败自动落下一家；全部失败时 error 汇总各家原因。
 * 百炼以 base64 data URI 直传（编码后 ≤10MB，语音消息远低于此限）。
 */

const VOLC_ASR_ENDPOINT =
  "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
const BAILIAN_WS_BASE_TEMPLATE = "https://{wsid}.cn-beijing.maas.aliyuncs.com/api/v1";
const BAILIAN_AGENT_PLAN_BASE = "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1";
const BAILIAN_ASR_PATH = "/services/aigc/multimodal-generation/generation";
const BAILIAN_DEFAULT_ASR_MODEL = "qwen-audio-3.0-asr-flash";
const MAX_BAILIAN_B64_BYTES = 9 * 1024 * 1024;

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/x-wav",
  ogg: "audio/ogg",
  opus: "audio/opus",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  amr: "audio/amr",
};

export type TranscribeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

interface BailianEndpoint {
  base: string;
  apiKey: string;
  mode: "workspace" | "agent-plan";
}

function audioFormatHint(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext in AUDIO_MIME_BY_EXT ? ext : "wav";
}

function listBailianEndpoints(): BailianEndpoint[] {
  const endpoints: BailianEndpoint[] = [];
  const wsid = process.env.WORKSPACE_ID?.trim();
  if (wsid) {
    const key =
      process.env.MODELSTUDIO_API_KEY?.trim() ||
      process.env.DASHSCOPE_API_KEY?.trim();
    if (key) {
      endpoints.push({
        base: BAILIAN_WS_BASE_TEMPLATE.replace("{wsid}", wsid),
        apiKey: key,
        mode: "workspace",
      });
    }
  }
  const awkKey = process.env.AWK_API_KEY?.trim();
  if (awkKey) {
    endpoints.push({ base: BAILIAN_AGENT_PLAN_BASE, apiKey: awkKey, mode: "agent-plan" });
  }
  return endpoints;
}

async function transcribeVolc(
  audioBuffer: Buffer,
  fileName: string,
): Promise<TranscribeResult> {
  const appId = process.env.VOLC_ASR_APP_ID?.trim();
  const accessKey = process.env.VOLC_ASR_ACCESS_KEY?.trim();
  const appKey = process.env.VOLC_ASR_APP_KEY?.trim();
  const resourceId =
    process.env.VOLC_ASR_RESOURCE_ID?.trim() || "volc.bigasr.auc_turbo";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Api-Resource-Id": resourceId,
    "X-Api-Request-Id": crypto.randomUUID(),
    "X-Api-Sequence": "-1",
  };
  let uid: string;
  if (appId && accessKey) {
    headers["X-Api-App-Key"] = appId;
    headers["X-Api-Access-Key"] = accessKey;
    uid = appId;
  } else if (appKey) {
    headers["X-Api-Key"] = appKey;
    uid = appKey;
  } else {
    return { ok: false, error: "火山 ASR 凭据未配置" };
  }

  const body = {
    user: { uid },
    audio: {
      data: audioBuffer.toString("base64"),
      format: audioFormatHint(fileName),
    },
    request: {
      model_name: "bigmodel",
      show_utterances: false,
      enable_itn: true,
      enable_punc: true,
    },
  };

  try {
    const res = await fetch(VOLC_ASR_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const status = res.headers.get("X-Api-Status-Code") ?? "";
    if (status !== "20000000") {
      const msg = res.headers.get("X-Api-Message") ?? "";
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, error: `火山 ASR 失败 (status=${status}, msg=${msg}): ${snippet}` };
    }
    const json = (await res.json()) as { result?: { text?: string } };
    const text = json.result?.text?.trim() ?? "";
    if (!text) {
      return { ok: false, error: "火山 ASR 返回空文本" };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `火山 ASR 请求失败: ${String(err)}` };
  }
}

async function transcribeBailian(
  audioBuffer: Buffer,
  fileName: string,
  endpoint: BailianEndpoint,
): Promise<TranscribeResult> {
  if (audioBuffer.length * (4 / 3) > MAX_BAILIAN_B64_BYTES) {
    return {
      ok: false,
      error: `音频 ${audioBuffer.length} 字节超百炼 base64 上限（10MB）`,
    };
  }
  const fmt = audioFormatHint(fileName);
  const mime = AUDIO_MIME_BY_EXT[fmt] ?? "audio/x-wav";
  const model =
    process.env.BAILIAN_ASR_MODEL?.trim() || BAILIAN_DEFAULT_ASR_MODEL;

  const body = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              input_audio: {
                data: `data:${mime};base64,${audioBuffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    },
    parameters: { format: fmt },
  };

  try {
    const res = await fetch(`${endpoint.base}${BAILIAN_ASR_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-SSE": "disable",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        error: `百炼 ASR 失败 (${endpoint.mode}, HTTP ${res.status}): ${snippet}`,
      };
    }
    const json = (await res.json()) as { output?: { text?: string } };
    const text = json.output?.text?.trim() ?? "";
    if (!text) {
      return { ok: false, error: `百炼 ASR 返回空文本 (${endpoint.mode})` };
    }
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: `百炼 ASR 请求失败 (${endpoint.mode}): ${String(err)}` };
  }
}

function volcConfigured(): boolean {
  const appId = process.env.VOLC_ASR_APP_ID?.trim();
  const accessKey = process.env.VOLC_ASR_ACCESS_KEY?.trim();
  const appKey = process.env.VOLC_ASR_APP_KEY?.trim();
  return Boolean((appId && accessKey) || appKey);
}

/**
 * Transcribe an audio buffer: 火山 → 百炼业务空间 → 百炼 agent plan 依次尝试。
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  fileName: string,
): Promise<TranscribeResult> {
  const errors: string[] = [];

  if (volcConfigured()) {
    const result = await transcribeVolc(audioBuffer, fileName);
    if (result.ok) {
      return result;
    }
    errors.push(`火山: ${result.error}`);
  }

  for (const endpoint of listBailianEndpoints()) {
    const result = await transcribeBailian(audioBuffer, fileName, endpoint);
    if (result.ok) {
      return result;
    }
    errors.push(`百炼(${endpoint.mode}): ${result.error}`);
  }

  if (errors.length === 0) {
    return {
      ok: false,
      error:
        "ASR 凭证未配置：需 VOLC_ASR_APP_ID+VOLC_ASR_ACCESS_KEY 或 VOLC_ASR_APP_KEY（火山），" +
        "或 WORKSPACE_ID+MODELSTUDIO_API_KEY/DASHSCOPE_API_KEY（百炼业务空间），" +
        "或 AWK_API_KEY（百炼 agent plan）",
    };
  }
  return { ok: false, error: errors.join(" | ") };
}

/**
 * Fetch audio content from a URL and return as Buffer.
 */
export async function fetchAudioBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio: ${res.status} ${res.statusText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #395** (2026-01-30): **[Bug]: utils里面没有extract_xml_data函数**
  *Symptoms*: ### wiseflow version  当前master  ### Expected Behavior  utils里面添加函数  ### Current Behavior  core/wis/extraction_strategy.py文件中第10行从utils导入了extract_xml_data函数，但是utils.py中没有extract_xml_data函数，建议将core/wis/extractor.py中的extract_xml_data函数移动到utils.py文件中  ### Is this reproducible?  Yes  ### Inputs Causing the Bug  ```bash  ```  ### OS  win  ### Python version  3.12  ### Error logs & Screenshots (if applicable)  <img width="2152" height="1267" alt="Image" src="https://github.com/user-attachments/assets/d9638cf7-0299-468e-94cc-b6b32920b02f" />
  **Post-Mortem & Fix Analysis**:
  > fixed

- **Issue #323** (2025-04-07): **[Bug]: 通过podman部署后一段时间后，pb令牌失效后，错误日志剧增问题**
  *Symptoms*: ### wiseflow version  V3.9-patch3  ### Expected Behavior  我通过podman来部署wiseflow，产生两个容器core和pb，我通过pb web来配置采集设置，之后开始采集信息（我之前就部署过之前的版本，发现是可以运行和采集）  ### Current Behavior  我通过cursor辅助利用podman来部署后，添加了web和focus并激活了，在设置per_hour == 1后就没在关注了  ### Is this reproducible?  Yes  ### Inputs Causing the Bug  ```bash  ```  ### OS  宿主主机是ubuntu 24 通过podman 部署  ### Python version  3.12  ### Error logs & Screenshots (if applicable)  部署一天之后，我在使用其他应用的时候，关注到宿主主机存储使用已经从20%飙升90%，观察容器运行情况，发现core pb两个容器的cpu使用率奇高，借助claude-3.7-sonnet排查后，发现这一天的时间内剧增的是wiseflow错误日志，以下附上部分3.7-sonnet排查结论以供参考： wiseflow项目（59GB）占用分析： pb/pb_data目录：39GB core/work_dir目录：20GB  关于Wiseflow日志异常和数据库问题的分析 1. 日志产生过多的原因 我们发现了几个关键问题导致了日志文件异常增长： 权限错误循环： 从日志内容看，系统不断尝试请求 focus_points 数据但遇到 "Only superusers can perform this action" 权限错误，这个请求以极高频率不断重复，产生了大量错误日志。 重复请求模式： 日志文件中显示系统每小时（3600秒）定时执行一次任务，但同时会有很多API请求不断发送，特别是对 /api/collections/focus_points/records 的请求。 容器CPU占用高： 您观察到wiseflow相关容器CPU使用率极高，这表明程序可能陷入了某种循环或死循环状态。 2. SQLite数据库内容分析 数据库规模： auxiliary.db 大小达到39GB，主要包含一个名为 _logs 的表。 记录数量： 该表包含超过5240万条记录（52,423,256条）。 日志级别分布： 级别0（信息日志）: 283条 级别4（可能是警告）: 4条 级别8（错误日志）: 52,493,322条 - 几乎所有记录都是错误日志！ 日志内容： 大多数是针对 /api/collections/focus_points/records 的API请求，伴随着权限错误。 3. 根本原因推测 从收集到的信息推断，Wiseflow服务存在以下问题： 权限配置错误： Core容器尝试以非管理员身份访问需要超级用户权限的数据，导致大量403错误。 错误处理机制不当： 程序没有正确处理API请求失败的情况，而是持续重试，形成死循环。 日志记录过度： 系统将每个API请求（包括失败的）都记录到数据库中，而没有设置适当的日志轮转或限制机制。 数据库性能瓶颈： 随着日志记录的快速增长，数据库性能下降，导致访问延迟增加，进一步加剧了问题。  Wiseflow权限连接问题分析 问题根源 经过详细分析，我确定了导致系统产生大量日志和存储消耗的核心问题： 认证令牌过期问题：
  **Post-Mortem & Fix Analysis**:
  > @helloCplusplus0 thanks for the feedback! 之前也有很多人提过这个问题，and I believe we found one of the root cause!  for fast fix, we should make the change in core/util/pb_api.py  line 44 as follows: raise e
  > 我也遇到这个问题，日志跳得很快，依稀看到什么403错误
  > 嗯，可以试试看  branch 4.x 提供了快速的修复方案

- **Issue #286** (2025-03-26): **Logs for container: [/wiseflow-core-1] KeyError: 'tool_calls'**
  *Symptoms*: Logs for container: [/wiseflow-core-1] (http://XXXX:9000/#/containers/92cc97f01cb95cbfc569ee2db263025679daf82d8ed9572cd9fd2a8c9d37fd17/)  Traceback (most recent call last):   File "/app/run_task.py", line 36, in <module>     asyncio.run(schedule_task())   File "/usr/lib/python3.10/asyncio/runners.py", line 44, in run     return loop.run_until_complete(main)   File "/usr/lib/python3.10/asyncio/base_events.py", line 649, in run_until_complete     return future.result()   File "/app/run_task.py", line 32, in schedule_task     await asyncio.gather(*jobs)   File "/app/general_process.py", line 88, in main_process     search_intent, search_content = await run_v4_async(query, _logger=wiseflow_logger)   File "/app/utils/zhipu_search.py", line 39, in run_v4_async     result = result['choices'][0]['message']['tool_calls'] KeyError: 'tool_calls'
  **Post-Mortem & Fix Analysis**:
  > 没注册 zhipu 服务api 把
  > 有注册服务API ``` {         "request_id": "{% mock 'uuid' %}",         "tool": "web-search-pro",         "stream": false,         "messages": [         {             "role": "user",              "content": "两会"         }     ]     } ```  **"content": "两会"会出现以上问题，返回值为：** ``` {     "choices": [         {             "finish_reason": "stop",             "index": 0,             "message": {                 "content": "两会是对自1959年以来历年召开的中华人民共和国全国人民代表大会和中国人民政治协商会议的统称。由于两场会议会期基本重合，而且对于国家运作的重要程度都非常的高，故简称做“两会”。从省级地方到中央，各地的政协及人大的全体会议的会期全部基本重合，所以两会的名称可以同时适用于全国及各省（市、自治区）。",                 "role": "assistant"             }         }     ],     "created": 1741156479,     "id": "2025030514343877440121ff90434d",     "model": "web-search-pro",     "request_id": "2025030514343877440121ff90434d",     "usage": {         "completion_tokens": 0,         "prompt_tokens": 0,         "total_tokens": 0     } } ```  **当 "content": "小米"，正常**  ``` {     "choices": [         {             "finish_reason": "stop",       
  > thanks for the feedback It seems that regardless of keywords, if sensitive words are triggered, the returned result format will be inconsistent. I will fix this problem. Thanks again for pointing it out.

- **Issue #214** (2025-02-05): **运行即报错，提示 KeyError: 'media'**
  *Symptoms*: 应用版本 : 0.3.8 使用的API：Deepseek-chat 运行平台： windows11 with miniconda Env配置：  > LLM_API_KEY="sk-****" LLM_API_BASE="https://***" ZHIPU_API_KEY="******" #for the search tool PRIMARY_MODEL="deepseek-chat" #SECONDARY_MODEL="deepseek-reasoner" #use a secondary model to excute the filtering task for the cost saving #if not set, will use the primary model to excute the filtering task VL_MODEL="deepseek-chat" PB_API_AUTH="******|*****" ##your pb superuser account and password ##belowing is optional, go as you need #VERBOSE="true" ##for detail log info. If not need, remove this item. PROJECT_DIR="work_dir" #PB_API_BASE="" ##only use if your pb not run on 127.0.0.1:8090 #LLM_CONCURRENT_NUMBER=8 ##for concurrent llm requests, make sure your llm provider supports it(leave default is 1)   运行之后报错：  > (wiseflow) PS D:\wiseflow\core> python .\windows_run.py Starting PocketBase... 2025-01-24 23:06:37.194 | DEBUG    | utils.pb_api:__init__:12 - initializing pocketbase client: http://127.0.0.1:8090 2025-01-24 23:06:37.445 | INFO     | utils.pb_api:__init__:22 - pocketbase ready authenticated as admin - waruii@msn.com 2025-01-24 23:06:37.447 | INFO     | __main__:schedule_task:19 - task execute loop 1 2025-01-24 23:06:37.452 | DEBUG    | general_process:main_process:54 - new task initializing... 2025-01-24 23:06:37.452 | DEBUG    | general_process:main_process:58 - focus_id: d5v92136876jl34, focus_point: 猫咪饲养 的窍门, explanation: 仅限健康和行为相关的内容, search_engine: True 2025-01-24 23:06:38.300 | INFO     | ge
  **Post-Mortem & Fix Analysis**:
  > it's truely a bug, no every result from zhipu search tool has the 'media' key. I'll repair it tonight
  > Done  请拉取最新的代码

- **Issue #204** (2025-02-05): **wxbot -微信被登出**
  *Symptoms*: 在运行wxbot exe的时候，一直报错。最后尝试先启动微信，然后将微信的PID指定给wxbot，这样能开启listen，但是listen port是8080.   然后将_init_里端口改为了8080.  执行wxbot能获取到公众号消息，但是有一个报错  ![Image](https://github.com/user-attachments/assets/647bc12f-486b-471c-ae5a-25d14472b901) 执行三次之后，微信被登出  把这个code问题修复之后，微信依然被登出，看起来微信对这种访问方式是block的？  还是哪里有问题  
  **Post-Mortem & Fix Analysis**:
  > 看起来是个 bug，我将修复下
  > 我已经推送了修复代码，可以更新下再试。  如果还发生微信退出的情况，请贴出详细的 log，以及你的操作系统、环境信息、被登出时的提示  谢谢！
  > 已经没问题了，多谢~ 好奇之前是什么问题呢？

- **Issue #151** (2025-01-18): **按照首页视频配置pocketbase后接着python tasks.py  运行了 1个小时  ，没有任何数据有存储到了pocketbase的infos里面。**
  *Symptoms*: 大佬你好，就是如何才会有数据进入到 pocketbase的infos里面。我的操作步骤完全按照 首页视频配置的。   ![image](https://github.com/user-attachments/assets/1761c345-b18b-40e4-a643-86b0949bba17) ![image](https://github.com/user-attachments/assets/39da4d76-fa5c-4fdf-9831-7b049c109fd5) ![image](https://github.com/user-attachments/assets/dcc15369-ef47-456e-88e3-6653ab11aae9) ![image](https://github.com/user-attachments/assets/1a3adb89-89ed-4040-903d-691fd328a8d3) ![image](https://github.com/user-attachments/assets/22f36074-86d9-4ff1-9362-ca7506d1b9d9) 
  **Post-Mortem & Fix Analysis**:
  > 看日志，好像是一直卡在这个地方  result的值都是dict的，没出现过list ![image](https://github.com/user-attachments/assets/9bb9806f-527d-4dd4-b2ee-3c7c14dfef91) 
  > 就每次都是 failed to parse from llm output ![image](https://github.com/user-attachments/assets/c2743c24-672f-41c3-a61f-61951418fecc) 
  > 主模型用的什么？默认的 qwen2.5-7b 吗？

- **Issue #73** (2024-09-02): **general_crawler.py 第208行报错 KeyError: 'publish_time'**
  *Symptoms*: [core/scrapers/general_crawler.py](https://github.com/TeamWiseFlow/wiseflow/blob/master/core/scrapers/general_crawler.py)第208行  ```python date_str = extract_and_convert_dates(result['publish_time']) ```  报错 KeyError: 'publish_time'
  **Post-Mortem & Fix Analysis**:
  > ``` 2024-08-21 11:29:40.628 | INFO     | scrapers.general_crawler:general_crawler:152 - gne extract not good: {'title': '', 'author': '', 'publish_time': '', 'content': '%PDF-... 2024-08-21 11:29:40.631 | INFO     | scrapers.general_crawler:general_crawler:165 - https://....pdf content too long for llm parsing core-1  | Traceback (most recent call last): core-1  |   File "/app/tasks.py", line 32, in <module> core-1  |     asyncio.run(main()) core-1  |   File "/usr/local/lib/python3.10/asyncio/runners.py", line 44, in run core-1  |     return loop.run_until_complete(main) core-1  |   File "/usr/local/lib/python3.10/asyncio/base_events.py", line 649, in run_until_complete core-1  |     return future.result() core-1  |   File "/app/tasks.py", line 30, in main core-1  |     await schedule_pipeline(interval_seconds) core-1  |   File "/app/tasks.py", line 20, in schedule_pipeline core-1  |     await asyncio.gather(*[process_site(site, counter) for site in sites]) core-1  |   Fi
  > 另外, 出现错误后, 程序不能自动恢复运行.
  > #88  done

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

### Incident Patch 1: `6cd041ee` (2026-09-20)
**Commit Message**: fix: stabilize Douyin note links and prepare v5.7.2

Fix Bailian TTS subtitle text and narration ASR integration. Make note link recovery atomic with bounded search retries, centralize regression tests under test/, and update release notes and setup guidance.

**File**: `.gitignore` (modified, +0/-1)
```diff
@@ -24,7 +24,6 @@ __pycache__/
 patchright/
 patchright-v*/
 openclaw/
-tests/
 
 # addon crews copied into crews/ at install time — not tracked
 .pnpm-store/
```

**File**: `AGENTS.md` (modified, +6/-0)
```diff
@@ -1,3 +1,9 @@
+## 测试文件布局
+
+- 回归测试与测试夹具统一放在仓根 `test/`，按组件分目录；不要放在正式脚本或 skill 目录中。
+- 移动测试时同步更新导入路径、测试入口与运行说明；确认已无用途的测试可以删除。
+- 用于修改上游测试的补丁材料仍放在对应 `patches/` 补丁包内。
+
 ## Docker 部署规范
 
 - 用户态镜像、Compose service 和持久卷统一使用 **xiaobei** 命名；不得新增 `wiseflow-*` 镜像或卷名。
```

**File**: `CHANGELOG.md` (modified, +34/-0)
```diff
@@ -1,3 +1,37 @@
+# v5.7.2 (2026-09-20)
+
+### 视频制作流程与交接
+
+- **统一 Stage 0→15 制作流程**：所有视频制作均从 Brief 进入通用阶段链，保留 GATE A 剧本验收、GATE B 素材验收及成片技术自检。移除 `intent-router`；`story-develop` 仅用于 Brief 缺失或不清晰时的需求整理。
+- **类型 workflow 指导剧本生产与自检**：`reversal-ad`、`narration-video`、`collage-broll` 分别定义 Brief→script 的写作规则、检查项和制作约定；`script-write` / `script-self-eval` 按 workflow 生成对应模板。未指定类型时走通用分场剧本。
+- **明确口播与旁白分工**：口播稿由小贝提供或向用户取得，content-producer 原样落稿、不代写；真人录音走时间戳与画面排布；制作解说的旁白由 content-producer 编写并提交 GATE A。DNA 指导选题与 Brief，不延伸接管分镜制作。
+- **拼贴 B-roll 流程对齐**：按隐喻清单生成静帧并交给 `collage-broll render`；被裁剪的分镜、素材规划、逐镜渲染和拼接阶段加入 workflow 守卫，避免误走通用分镜链。
+- **改片与交付约定补齐**：修改单明确问题位置、预期效果与保留项；按受影响片段定向重做，保留上一版并记录修改。AIGC 转场补充选帧、景别、风格与帧率衔接要求，素材清单增加规格说明。
+
+### AIGC 供应商与百炼 Agent Plan
+
+- **百炼 Agent Plan 统一接入**：图像生成、TTS、ASR、声画视频生成支持通过 `AWK_API_KEY` 访问 `token-plan.cn-beijing.maas.aliyuncs.com`。默认百炼配置下，一个账号和 Key 即可覆盖文本、图像、语音与视频能力；同时保留业务空间 `WORKSPACE_ID` + `MODELSTUDIO_API_KEY` / `DASHSCOPE_API_KEY` 路线。
+- **图像生成收敛到百炼**：业务空间使用 `qwen-image-3.0-pro` → `qwen-image-3.0` → `qwen-image-2.0-pro-2026-06-22` 候选链；Agent Plan 使用 `wan2.7-image-pro` → `wan2.7-image`。支持文生图、参考图编辑与多图融合，封面及制作工具同步接入。
+- **TTS 增加百炼后端**：支持 `qwen-audio-3.0-tts-plus`，业务空间可回退 `qwen-audio-3.0-tts-flash`；保留火山豆包语音合成。支持普通音频下载、SSE 流式音频与字级时间戳，统一语速、响度、格式和音色处理，并自动执行 ASR 自检。
+- **ASR 统一路由**：按火山 → 百炼业务空间 → 百炼 Agent Plan 尝试已配置后端，失败时回退并汇总错误；百炼使用 `qwen-audio-3.0-asr-flash`，统一输出全文、句段与秒级词时间戳。视频转写、口播剪辑及旁白对齐共用该入口。
+- **视频生成支持 Agent Plan**：百炼 t2v / i2v / r2v 使用 `happyhorse-1.1` → `happyhorse-1.0` → `wan2.7` 对应模式候选链，保留火山 Seedance 与 MiniMax H3。仅配置百炼 `AWK_API_KEY` 时可直接生成，无需额外视频 Key；已有显式视频供应商凭据时仍按配置优先级选择。
+- **Agent Plan 真实调用验证与修复**：TTS 普通/流式、公共 ASR、文生图、三种视频模式及旁白对齐入口均完成实测；视频下载、音视频轨与完整解码通过。修复百炼流式 sentence-end 缺少句级文本时字幕为空的问题，以及旁白对齐的公共 ASR 导入路径错误、百炼结果被误标为火山来源的问题。i2v 实测按首帧比例输出，成片尺寸需检查实际媒体，不能仅依赖请求的 `ratio`。
+
+### 抖音图文音乐发布与作品跟踪
+
+- **新增抖音图文音乐发布**：`douyin-note-publish` 支持按序上传多图、填写标题与描述话题、读取上传后的实际推荐音乐并选曲；发布前复核配乐，发布后回收 `/note/<id>` 链接。仅在明确选择原声时跳过配乐流程。
+- **图文与视频分开路由**：视频入口改为 `douyin-video-publish`，与图文共享登录态和发布任务锁。修复输入框不兼容的选择器调用；发布结果待核实时只补取链接，避免自动重复发布。
+- **图文发布后取链修复**：兼容管理页将标题与正文合并展示的 DOM，在唯一候选的图文编辑页核验完整标题后返回链接。候选判定与点击合并为一次浏览器操作，修复两次检查间列表刷新导致直接退出的竞态；每轮搜索后等待 5 秒、轮询候选最多 30 秒，超时后间隔 3 秒重新搜索，最多 4 轮。保留多候选停止与禁止自动重发，已通过列表消失后恢复的浏览器回归，并用两条已发布作品复测取链。
+- **创作者侧指标与深度数据**：抖音取数接入创作者 `item/list`，优先采用创作者侧播放量并保留有效零值；兼容图文链接。`deep_metrics` 保存最新 JSON 及采集时间、来源，不累积历史快照。心跳按平台启用状态巡检，抖音聚焦最近 30 条作品，取数失败显式报告。
+
+### 平台兼容性修复
+
+- 视频号短标题统一无标点、以空格分隔；发布前准备 3:4 / 4:3 封面变体，增强封面编辑操作及 DNA 入库核验，视频描述字数改为建议值并以平台输入框为准。
+- 小红书软风控增加有界冷却与单次重试，安全限制不再直接判定为登录失效；发布正文中的字面量 `\\n` 归一化为真实换行。
+- 视频素材抓取跟进小红书 EF 系列视频分档兼容。
+
+---
+
 # v5.7.1 (2026-09-15)
 
 ### 第三方插件 pin 升级（openclaw-weixin 2.4.8 / wecom-openclaw-cli 1.1.1）
```

**File**: `README.md` (modified, +12/-9)
```diff
@@ -5,7 +5,7 @@
 - 微信公众号文章写作、排版与推送
 - 小红书/小绿书图文创作与发布
 - 图文海报生成
-- 短视频生成与多平台分发（支持视频号、抖音、小红书）
+- 视频生成与多平台分发（支持视频号、抖音、小红书）
 - Twitter/X、微博、知乎等平台发文
 - 微信朋友圈内容发布（通过企业微信接口）
 - 爆款视频追爆分析、仿写与再创作（支持抖音、B站和小红书视频链接）
@@ -32,13 +32,15 @@ xiaobei 由Wiseflow (原AI首席情报官）作者 bigbrother666sh 开发。
 
 ---
 
-## 🚀 **v5.7.1 更新**
+## 🚀 **V5.7.1~5.7.2 更新**
 
 - 小红书、抖音、视频号 DNA系统升级到2.0架构，Let's do this like an expert！
 - content producer 升级为专家系统，现在除了AIGC大片外，还可以复刻众多短视频平台流行的“套路”，更易获得平台推荐流量：
   > 效果展示，xiaobei的视频号：https://openclaw-for-business.com/xiaobei-wxchannel.jpg
 - xiaobei 可直接指挥content producer，用户可选择将brief出具、节点验收等委托xiaobei
-- 修复一键安装脚本中，openclaw-weixin不会自动升级的问题
+- 新增抖音平台图文音乐内容发布能力，支持多图上传、选择推荐配乐与发布链接回收。
+- AIGC 端点支持阿里云百炼 Agent Plan：现在无需去多个平台开通不同账号，最简只用初始安装时的百炼账号就可获得全部能力。
+- 修复一键安装脚本openclaw-weixin不会自动升级的问题
 
 详见 [CHANGELOG.md](CHANGELOG.md)
 
@@ -48,11 +50,11 @@ xiaobei 由Wiseflow (原AI首席情报官）作者 bigbrother666sh 开发。
 
 ### 0. 准备 API Key
 
-推荐开通 [阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..)——一个套餐覆盖 DeepSeek-V4-Flash、GLM-5.2、Qwen3.6-Flash 等主流模型，**无月限额、不限购**，xiaobei 默认主力模型 DeepSeek-V4-Flash 即走此通道。开通后获得 `AWK_API_KEY`，主力模型、视觉模型、替补模型**一个 key 全覆盖**。
+推荐开通 [阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..)——一个套餐覆盖**思考与对话、图像生成、TTS 语音合成、ASR 语音识别和视频生成**全部大模型能力，无需为这些能力分别准备其他供应商账号或 Key。
 
 > 💡 **套餐选择**：前期熟悉安装可选 **Lite 版 39 元/月**；正常使用建议 **Standard 版 139 元/月**。想继续使用火山CodePlan见下方 "模型费用说明"
 
-> 🎬 **想用视频生成能力？** 开通百炼Token Plan后，会免费获得一定额度的 `happyhorse-1.1` ，只需把对应 key（`MODELSTUDIO_API_KEY`）配置到 `daemon.env`。
+> 🎬 **想用视频生成能力？** 默认可直接复用百炼 `AWK_API_KEY` 调用 `happyhorse` 系列，也可通过配置 `MODELSTUDIO_API_KEY` 和 `WORKSPACE_ID`使用百炼平台的赠送额度和“节省计划“包。
 
 > 除了阿里云的`happyhorse`系列，我们现在也支持 minimax 的H3！详见下方[视频生成模型配置](#-视频生成模型配置)
 
@@ -161,21 +163,22 @@ irm https://raw.atomgit.com/wiseflow/xiaobei/raw/master/scripts/install-atomgit.
 >
 > xiaobei 底层基于 openclaw，建议先准备好大模型 API：
 >
-> - **主力模型（强烈推荐）**：[阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..) — 一个套餐覆盖 DeepSeek-V4-Flash、GLM-5.2、Qwen3.6-Flash 等主流模型，**无月限额、不限购**。前期熟悉安装可选 Lite 版 39 元/月，正常使用建议 Standard 版 139 元/月。开通后获得 `AWK_API_KEY`，xiaobei 默认主力模型 DeepSeek-V4-Flash 即走此通道。
+> - **主力模型（强烈推荐）**：[阿里云百炼「Token Plan」套餐](https://www.aliyun.com/benefit/ai/aistar?clubBiz=subTask..12766005..10274..) — 一个套餐已经可以覆盖xiaobei系统所需的所有大模型（思考与对话、图像生成、TTS 语音合成、ASR 语音识别和视频生成)。
 >
 > - **仍想用火山方舟 Coding Plan 的用户**：在默认配置模板基础上参考 [openclaw-awk.json](config-templates/openclaw-awk.json)，手动替换 `provider` 和 `agents.default` 字段即可。
 
 > **🎬 视频生成模型配置**
 >
-> AI 视频生成（`aigc-video-gen`，短视频制作与素材补充都会用到）需额外开通视频生成模型，并把对应 key 配置到 `daemon.env`（任选其一，百炼优先）：
+> AI 视频生成（`aigc-video-gen`，短视频制作与素材补充都会用到）默认复用百炼 `AWK_API_KEY`，走 Agent Plan 端点。也可按需配置百炼业务空间、火山或 MiniMax：
 >
 > | 平台 | 环境变量 | 模型 |
 > |------|---------|------|
-> | 阿里云百炼（优先） | `MODELSTUDIO_API_KEY`（或 `DASHSCOPE_API_KEY`） | `happyhorse-1.1-i2v` / `happyhorse-1.1-t2v` / `happyhorse-1.1-r2v` |
+> | 阿里云百炼 Agent Plan（默认） | `AWK_API_KEY` | `happyhorse-1.1-i2v` / `happyhorse-1.1-t2v` / `happyhorse-1.1-r2v` |
+> | 阿里云百炼业务空间（可选） | `WORKSPACE_ID` + `MODELSTUDIO_API_KEY`（或 `DASHSCOPE_API_KEY`） | 同上 |
 > | 火山引擎方舟 | `AWK_GEN_KEY` | `doubao-seedance-2-0-fast-260128` / `doubao-seedance-2-0-260128` / `doubao-seedance-2-0-mini-260615` |
 > | minimax海螺 | `MINIMAX_API_KEY` | `minimax-H3` |
 >
-> 若上述都没配则自动降级为 pexels/pixabay 免费素材模式（也得注册才能获得key，只不过是免费）。注意 `AWK_GEN_KEY` 与主力模型的 `AWK_API_KEY` 是一个 key，但必须在环境变量中以不同变量名称赋值，火山视频生成只认 `AWK_GEN_KEY`。申请成功后可以让小贝喊系统内置的IT Engineer帮你完成配置。
+> 只配置百炼 `AWK_API_KEY` 时自动走 Agent Plan；若已有其他视频凭据，自动选择顺序为 MiniMax → 火山 → 百炼业务空间 → 百炼 Agent Plan。均未配置时，小贝改用 pexels/pixabay 素材模式（仍需注册获取对应的免费 Key）。`AWK_GEN_KEY` 是火山视频生成凭据，与百炼 `AWK_API_KEY` 不可混用。需要调整配置时，可以让小贝调用内置 IT Engineer 协助。
 
 > **🧠 进阶：记忆增强与 dream（可选）**
 >
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/narration-align.py` (modified, +3/-3)
```diff
@@ -10,7 +10,7 @@
     {
       "text": "全文",
       "segments": [{"start": 0.0, "end": 2.3, "text": "第一句"}, ...],
-      "source": "tts-native" | "volc.bigasr.auc_turbo"
+      "source": "tts-native" | "asr"
     }
 
 路径优先级：
@@ -33,7 +33,7 @@
 
 # 注入 main 侧 _shared 到 sys.path，复用公共 ASR 路由（与 talking-head-cut/scripts/cut_plan.py 同范式）
 # 跨 crew 引用：content-producer → main/_shared，供应商路由 火山→百炼业务空间→百炼 agent plan，凭据同池无新增配置
-sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "crews" / "main" / "skills" / "_shared"))
+sys.path.insert(0, str(Path(__file__).resolve().parents[6] / "main" / "skills" / "_shared"))
 from asr import asr  # noqa: E402
 
 
@@ -146,7 +146,7 @@ def fallback_asr(narration: Path, out_path: Path) -> None:
     out = {
         "text": result.get("text", "") or "",
         "segments": segs,
-        "source": "volc.bigasr.auc_turbo",
+        "source": "asr",
     }
     out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/SKILL.md` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ douyin-note-publish get-note-link --title "图文标题"
 
 ## 分步与恢复
 
-中间态由脚本保存在同一浏览器 session / 页面；不要插入其他抖音任务。刷新后重新读取候选、选择并验证。`publish` 仅表示已跳转管理页，必须接 `get-note-link`，拿到链接才记录成功。取链刷新管理页，按完整标题定位唯一作品并进入图文编辑页，只读取 URL，不保存修改；不通过列表首条或置顶视频猜链接，不自动重新发布。
+中间态由脚本保存在同一浏览器 session / 页面；不要插入其他抖音任务。刷新后重新读取候选、选择并验证。`publish` 仅表示已跳转管理页，必须接 `get-note-link`，拿到链接才记录成功。取链最多刷新并搜索 4 次，每次搜索后先等 5 秒，再轮询候选最多 30 秒，超时后间隔 3 秒重新搜索。在管理页标题与正文合并区域定位唯一标题前缀候选，判定与点击在同一次浏览器操作中完成；列表刷新暂时为空时继续等待。进入图文编辑页核验完整标题一致后读取 URL，不保存修改。多个候选或编辑页标题不符时停止；不通过列表首条或置顶视频猜链接，不自动重新发布。
 
 `get-note-link` 完成后自动关闭 session；分步中途放弃时手动 `camoufox-cli --session douyin --persistent --json close`（有头时加 `--headed`）。
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/publish_douyin_note.py` (modified, +72/-15)
```diff
@@ -18,6 +18,10 @@ class LoginRequired(RuntimeError):
     pass
 
 
+class WaitTimeout(RuntimeError):
+    pass
+
+
 def check_login(b):
     url = b.eval('window.location.href') or ''
     if urlparse(url).path.rstrip('/') in ('/login', '/creator-micro/login'):
@@ -33,7 +37,7 @@ def wait_for(b, action, message, timeout=60):
         if value:
             return value
         time.sleep(1)
-    raise RuntimeError(message)
+    raise WaitTimeout(message)
 
 
 def click_text(b, text, selector='button,div,span,a,li,label'):
@@ -182,28 +186,81 @@ def fill(b, title, caption, declaration='ai'):
                 raise RuntimeError('AI 声明确认失败')
 
 
+def note_link_candidate(b, title, *, click=False):
+    # 管理页的标题区域实际展示标题+正文；搜索结果也可能包含无关作品。
+    # 前缀仅用于定位候选，最终必须在图文编辑页完整校验标题。
+    return b.eval(f'''(() => {{
+      const title={json.dumps(title)};
+      const nodes=[...document.querySelectorAll('[class*="info-title-text-"]')]
+        .filter(e=>{VISIBLE} && (e.textContent||'').trim().startsWith(title));
+      const actions=new Set();
+      for(const t of nodes) {{
+        const card=t.closest('[class*="info-title-operation-"]');
+        if(!card) continue;
+        const edits=[...card.querySelectorAll('button,a,span,div')].filter(e=>
+          {VISIBLE} && !e.children.length && e.textContent.trim()==='编辑作品');
+        if(edits.length===1) actions.add(edits[0]);
+      }}
+      const result={{titles:nodes.length,actions:actions.size}};
+      if(nodes.length===1 && actions.size===1) {{
+        if({json.dumps(click)}) [...actions][0].click();
+        result.status='unique';
+      }} else result.status=nodes.length>1 || actions.size>1 ? 'ambiguous' : 'missing';
+      return result;
+    }})()''')
+
+
+def wait_note_edit(b, title, timeout=30):
+    diagnostic = {}
+    def locate_and_click():
+        nonlocal diagnostic
+        # DOM 判定和点击在同一次 JS 执行内完成，列表刷新不能插入两者之间。
+        diagnostic = note_link_candidate(b, title, click=True)
+        if diagnostic['status'] == 'ambiguous':
+            raise RuntimeError(f'多个标题前缀候选，需人工核实，不能重发: {diagnostic}')
+        return diagnostic['status'] == 'unique'
+    try:
+        wait_for(b, locate_and_click, '作品列表尚未出现目标', timeout=timeout)
+    except WaitTimeout as exc:
+        raise WaitTimeout(f'作品列表等待超时: {diagnostic}') from exc
+
+
 def get_note_link(b, title):
+    if not title.strip():
+        raise ValueError('取链需要完整非空标题')
     b.command('open', MANAGE_URL)
-    b.command('reload')
-    check_login(b)
-    wait_for(b, lambda: b.eval('!!document.querySelector(\'input[placeholder*="搜索作品"]\')'), '管理页搜索框未出现')
-    fill_input(b, 'input[placeholder*="搜索作品"]', title)
-    b.command('press', 'Enter')
-    # Locate the smallest title-bearing card with one edit action; ambiguity fails closed.
-    js = f'''(() => {{const titles=[...document.querySelectorAll('*')].filter(e=>{VISIBLE} &&
-      (e.textContent||'').trim()==={json.dumps(title)} && !e.children.length);
-      const actions=new Set(); for(const t of titles) {{let p=t.parentElement;
-      for(let i=0;i<7 && p && p!==document.body;i++,p=p.parentElement) {{
-        const edits=[...p.querySelectorAll('button,a,span,div')].filter(e=>{VISIBLE} && !e.children.length && e.textContent.trim()==='编辑作品');
-        if(edits.length) {{if(edits.length===1) actions.add(edits[0]); break;}}
-      }}}} if(actions.size!==1) return false; [...actions][0].click(); return true;}})()'''
-    wait_for(b, lambda: b.eval(js), '未找到唯一同标题作品，需人工核实，不能重发')
+    attempts = 4
+    for attempt in range(attempts):
+        b.command('reload')
+        check_login(b)
+        wait_for(b, lambda: b.eval('!!document.querySelector(\'input[placeholder*="搜索作品"]\')'), '管理页搜索框未出现')
+        fill_input(b, 'input[placeholder*="搜索作品"]', title)
+        b.command('press', 'Enter')
+        # 等待搜索后的列表替换，避免立即点击尚未刷新的旧列表。
+        time.sleep(5)
+        try:
+            wait_note_edit(b, title)
+        except WaitTimeout as exc:
+            if attempt == attempts - 1:
+                raise RuntimeError(f'重新搜索{attempts}次仍未找到唯一作品，不能重发: {exc}') from exc
+            print(f'[retry] 取链搜索 {attempt + 1}/{attempts}: {exc}; 3秒后重新搜索', file=sys.stderr)
+            time.sleep(3)
+            continue
+        break
     def read_id():
         url = b.eval('window.location.href') or ''
         parsed = urlparse(url)
         mid = parse_qs(parsed.query).get('mid', [''])[0]
         return mid if parsed.hostname == 'creator.douyin.com' and parsed.path.endswith('/content/post/image') and re.fullmatch(r'\d{19}', mid) else None
     mid = wait_for(b, read_id, '未捕获图文编辑页 mid')
+    def read_title():
+        return b.eval(f'''(() => {{
+          const inputs=[...document.querySelectorAll('input[placeholder="添加作品标题"]')].filter(e=>{VISIBLE});
+          return inputs.length===1 && inputs[0].value ? {{title:inputs[0].value}} : null;
+        }})()''')
+    actual = wait_for(b, read_title, '图文编辑页标题未加载，链接待核实')
+    if actual['title'] != title:
+        raise RuntimeError(f'图文编
```

**File**: `patches/camoufox-cli/README.md` (modified, +2/-2)
```diff
@@ -82,8 +82,8 @@ cd patches/camoufox-cli && npm test
 ```
 
 Upstream tests are vendored unchanged. New tests:
-- `tests/cli.test.ts` — `upload` / `identity` arg parsing.
-- `tests/server-queue.test.ts` — fail-first queue + `close` bypass (mocks `execute`).
+- `../../test/camoufox-cli/cli.test.ts` — `upload` / `identity` arg parsing.
+- `../../test/camoufox-cli/server-queue.test.ts` — fail-first queue + `close` bypass (mocks `execute`).
 
 ## Attribution
 
```

---

### Incident Patch 2: `5b4e1123` (2026-09-19)
**Commit Message**: fix(douyin-note-publish): fill inputs without unsupported CLI selectors

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/check_fill_browser.py` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+"""Manual local-browser regression: python3 check_fill_browser.py (no account required)."""
+import importlib.util
+import json
+import subprocess
+import uuid
+from pathlib import Path
+from urllib.parse import quote
+
+path = Path(__file__).with_name('publish_douyin_note.py')
+spec = importlib.util.spec_from_file_location('note', path)
+note = importlib.util.module_from_spec(spec)
+spec.loader.exec_module(note)
+
+class LocalBrowser(note.Browser):
+    def command(self, *args, timeout=60):
+        p = subprocess.run(['camoufox-cli', '--session', session, '--json', *args],
+                           capture_output=True, text=True, timeout=timeout)
+        if p.returncode:
+            raise RuntimeError(p.stderr or p.stdout)
+        result = json.loads(p.stdout)
+        if result.get('ok') is False:
+            raise RuntimeError(str(result))
+        data = result.get('data')
+        return data['result'] if isinstance(data, dict) and 'result' in data else data
+
+session = 'note-regression-' + uuid.uuid4().hex[:10]
+b = LocalBrowser()
+html = '''<input placeholder="添加作品标题"><input placeholder="搜索作品"><div contenteditable="true"></div>
+<script>
+window.events=[]; window.state={};
+for(const e of document.querySelectorAll('input')) {
+  let tracked='';
+  Object.defineProperty(e,'value',{get(){return Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(this)},set(v){tracked=v;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(this,v)}});
+  for(const type of ['input','change']) e.addEventListener(type,()=>{
+    events.push(type); document.body.dataset.events=JSON.stringify(events); if(e.value!==tracked) {state[e.placeholder]=e.value; tracked=e.value; e.dataset.state=e.value;}
+  });
+  e.addEventListener('keydown',event=>{if(event.key==='Enter') document.body.dataset.searched=state[e.placeholder]});
+}
+</script>'''
+try:
+    b.command('open', 'data:text/html;charset=utf-8,' + quote(html))
+    title = '中文"反斜杠\\与emoji😀'
+    note.fill(b, title, '第一行\n第二行 #话题', 'none')
+    observed = b.eval('document.querySelector("input").dataset.state')
+    assert observed == title, repr(observed)
+    note.fill_input(b, 'input[placeholder*="搜索作品"]', title)
+    b.command('press', 'Enter')
+    assert b.eval('document.body.dataset.searched') == title
+    assert b.eval('JSON.parse(document.body.dataset.events)') == ['input', 'change', 'input', 'change']
+    note.fill_input(b, 'input[placeholder*="搜索作品"]', '')
+    assert b.eval('document.querySelectorAll("input")[1].dataset.state') == ''
+    for setup in [
+        'document.querySelector("input").disabled=true',
+        'document.querySelector("input").disabled=false; document.querySelector("input").readOnly=true',
+        'document.querySelector("input").readOnly=false; document.body.append(document.querySelector("input").cloneNode())',
+    ]:
+        b.eval(setup)
+        try:
+            note.fill_input(b, 'input[placeholder="添加作品标题"]', '不应写入')
+        except RuntimeError:
+            pass
+        else:
+            raise AssertionError('non-editable or ambiguous input accepted')
+    print('PASS: real camoufox CLI: title/caption, controlled input events, search Enter, escaping, clear, disabled/read-only/ambiguous guards')
+finally:
+    b.close()
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/publish_douyin_note.py` (modified, +28/-3)
```diff
@@ -138,10 +138,35 @@ def verify_music(b, name):
     }})()''')
 
 
+def fill_input(b, selector, value):
+    # camoufox-cli fill accepts snapshot refs only, not CSS selectors.
+    result = b.eval(f'''(() => {{
+      const inputs=[...document.querySelectorAll({json.dumps(selector)})].filter(e=>{VISIBLE});
+      if(inputs.length!==1) throw new Error('输入框缺失或不唯一');
+      const e=inputs[0];
+      if(!(e instanceof HTMLInputElement) || e.disabled || e.readOnly)
+        throw new Error('输入框不可编辑');
+      e.focus();
+      const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
+      setter.call(e,{json.dumps(value)});
+      e.dispatchEvent(new Event('input',{{bubbles:true}}));
+      e.dispatchEvent(new Event('change',{{bubbles:true}}));
+      return e.value==={json.dumps(value)};
+    }})()''')
+    if not result:
+        raise RuntimeError('输入框读回不一致')
+    # Read in a separate browser turn, after controlled-component updates.
+    if not b.eval(f'''(() => {{
+      const inputs=[...document.querySelectorAll({json.dumps(selector)})].filter(e=>{VISIBLE});
+      if(inputs.length!==1 || inputs[0].value!=={json.dumps(value)}) return false;
+      inputs[0].focus(); return true;
+    }})()'''):
+        raise RuntimeError('输入框更新后读回不一致')
+
+
 def fill(b, title, caption, declaration='ai'):
     check_login(b)
-    b.command('fill', 'input[placeholder="添加作品标题"]', title)
-    wait_for(b, lambda: b.eval(f'document.querySelector(\'input[placeholder="添加作品标题"]\')?.value === {json.dumps(title)}'), '标题读回不一致')
+    fill_input(b, 'input[placeholder="添加作品标题"]', title)
     js = f'''(() => {{const editors=[...document.querySelectorAll('div[contenteditable=true]')].filter(e=>{VISIBLE});
       if(editors.length!==1) return false; const e=editors[0]; e.focus();
       const r=document.createRange(); r.selectNodeContents(e); const s=window.getSelection(); s.removeAllRanges(); s.addRange(r);
@@ -162,7 +187,7 @@ def get_note_link(b, title):
     b.command('reload')
     check_login(b)
     wait_for(b, lambda: b.eval('!!document.querySelector(\'input[placeholder*="搜索作品"]\')'), '管理页搜索框未出现')
-    b.command('fill', 'input[placeholder*="搜索作品"]', title)
+    fill_input(b, 'input[placeholder*="搜索作品"]', title)
     b.command('press', 'Enter')
     # Locate the smallest title-bearing card with one edit action; ambiguity fails closed.
     js = f'''(() => {{const titles=[...document.querySelectorAll('*')].filter(e=>{VISIBLE} &&
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/scripts/test_publish_metrics.py` (modified, +15/-0)
```diff
@@ -43,6 +43,21 @@ def evaluate(js):
         result=note.get_note_link(b,'标题')
         self.assertEqual(result['url'],'https://www.douyin.com/note/7687034742688058662')
         self.assertIn(unittest.mock.call('reload'),b.command.call_args_list)
+        self.assertFalse(any(c.args[0] == 'fill' for c in b.command.call_args_list))
+        self.assertIn(unittest.mock.call('press', 'Enter'), b.command.call_args_list)
+
+    def test_fill_uses_eval_and_stops_on_rejected_input(self):
+        b = Mock()
+        b.eval.side_effect = ['https://creator.douyin.com/creator-micro/content/post/image', False]
+        with self.assertRaisesRegex(RuntimeError, '读回不一致'):
+            note.fill(b, '标题', '描述', 'none')
+        b.command.assert_not_called()
+
+    def test_fill_stops_when_controlled_input_reverts(self):
+        b = Mock()
+        b.eval.side_effect = [True, False]
+        with self.assertRaisesRegex(RuntimeError, '更新后读回不一致'):
+            note.fill_input(b, 'input', '标题')
 
     def test_fill_failure_stops_before_publish_and_closes(self):
         with patch.object(note,'validate'), patch.object(note,'Browser') as browser, \
```

---

### Incident Patch 3: `207457ad` (2026-09-19)
**Commit Message**: fix: refine Douyin note publishing and sync crawler compatibility

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -44,3 +44,4 @@ crews/main/db/
 
 # engagement 技能 probe 调试输出（dump 截图/HTML/innerText，不入仓）
 *-engagement-probe/
+docs/mediacrawlerpro-catchup-2026-09-19.md
```

**File**: `crews/main/HEARTBEAT.md` (modified, +5/-3)
```diff
@@ -74,7 +74,7 @@
 
 取数失败保留原始 stderr 和 exit code，继续下一平台；登录失效另记入 `EXPIRED_PLATFORMS`，不重登。`NOT_ON_FIRST_PAGE` 直接跳过，不补抓、不翻页。
 
-目前定时任务取数仅完整支持 expert 架构的四个平台（douyin、xhs、wx_channel、wx_mp）。其他平台直接跳过。
+目前定时任务取数仅支持已适配 expert 架构的四个平台（douyin、xhs、wx_channel、wx_mp），其他平台直接跳过。
 
 ---
 
@@ -88,14 +88,16 @@ content-calibrator eval --platform <platform> --check
 
 返回 JSON：`{dnas: [{dna_id, pending, triggered}]}`
 - 全部 `triggered=false` → 本轮评估跳过，不消耗后续 token
-- 有 `triggered=true` 的 DNA → 进入 Step 3a
+- 有 `triggered=true` 的 DNA → 进入 评估
 
 **对于douyin/wx_mp/wx_channel/xhs平台** → 走该平台专家包内的 review workflow
 
 > 触发的 DNA 属于哪个平台，就按该平台专家包的 review workflow 执行完整复盘（聚合、平台归因、写报告、标记全在 workflow 内；**workflow 不取数**——本轮数据已在 Step 1–2 采集就位）：
 
 > - **wx_mp** → expert-wx-mp 的 Review Workflow（`skills/expert-wx-mp/workflows/review.md`）
 > - **douyin** → expert-douyin 的 Review Workflow（`skills/expert-douyin/workflows/review.md`）
+> - **wx_channel** → expert-wx-channel 的 Review Workflow（`skills/expert-wx-channel/workflows/review.md`）
+> - **xhs** → expert-xhs 的 Review Workflow（`skills/expert-xhs/workflows/review.md`）
 
 **对于其他平台** → 尚未匹配DNA系统，直接跳过此步
 
@@ -128,7 +130,7 @@ content-calibrator eval --platform <platform> --check
    > ⚠️ 以下**取数端**登录态已失效，数据未能更新。请白天通知小贝重新登录：
    > - douyin（抖音）
    > - xhs-browse（小红书浏览端）
-   > - wechat-channel（微信视频号)
+   > - wx-channel（微信视频号)
 
 3. DNA 表现评估摘要（如有）：列出本轮评估的 DNA（平台 / dna-id / 覆盖篇数）+ 整体判定（改善 / 平稳 / 下滑）+ 关键归因；无触发 DNA 时写「无 DNA 达到评估阈值」并附各 DNA 待评估计数。
 4. **DNA 优化建议待确认（如有）**：列出评估报告中的逐条建议（建议内容 + 目标维度/template 部分 + 证据篇目）。**Agent 不得自动更新 DNA**。用户白天逐条确认后，指示走对应平台专家包的 style-dna workflow 回写 DNA。
```

**File**: `crews/main/skills/_shared/test-upstream-catchup.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import test from 'node:test'
+import assert from 'node:assert/strict'
+import { parseXhsNoteFromHtml, fetchXhsNoteFromHtml, XhsSecurityBlockError } from './xhs-html-note.ts'
+import { collectComments } from '../expert-douyin/tools/douyin-comments/scripts/fetch_comments.ts'
+
+function html(stream: unknown, extra='') {
+  return `<script>window.__INITIAL_STATE__=${JSON.stringify({note:{noteDetailMap:{abc:{note:{
+    type:'video',title:'Test',video:{media:{stream},capa:{duration:3}},
+  }}}}})}</script>${extra}`
+}
+
+test('XHS EF/unknown buckets, numeric strings and camel/snake keys', () => {
+  const note=parseXhsNoteFromHtml(html({h264:[], EF4:[null,{master_url:'https://cdn/720',height:'720'}],
+    EF7:[{masterUrl:'https://cdn/1080-low',height:1080,avgBitrate:'100'},
+      {master_url:'https://cdn/1080-high',height:'1080',avg_bitrate:'200'}],
+    unknown:[{masterUrl:'javascript:bad',height:4000}], metadata:{height:9000}}),'abc')!
+  assert.equal(note.videoUrl,'https://cdn/1080-high')
+  assert.equal(note.durationMs,3000)
+})
+test('XHS h265 survives empty h264; malformed buckets use og video', () => {
+  assert.equal(parseXhsNoteFromHtml(html({h264:[],h265:[{masterUrl:'//cdn/video'}]}),'abc')?.videoUrl,'https://cdn/video')
+  assert.equal(parseXhsNoteFromHtml(html({EF5:null},'<meta property="og:video" content="https://cdn/og">'),'abc')?.videoUrl,'https://cdn/og')
+})
+test('XHS content containing soft-block words is not a blocked page', () => {
+  const body=html({EF4:[{masterUrl:'https://cdn/ok'}]}).replace('Test','安全限制')
+  assert.equal(parseXhsNoteFromHtml(body,'abc')?.title,'安全限制')
+})
+test('OpenCLI soft-block cooldown stays bounded to one retry', async () => {
+  const originalFetch=globalThis.fetch
+  const originalTimeout=globalThis.setTimeout
+  let calls=0
+  globalThis.fetch=async () => {calls++; return new Response('安全限制',{status:200})}
+  globalThis.setTimeout=((callback: (...args: unknown[])=>void) => {
+    queueMicrotask(callback)
+    return 0
+  }) as unknown as typeof setTimeout
+  try {
+    await assert.rejects(fetchXhsNoteFromHtml('abc',{xsecToken:'token'}),XhsSecurityBlockError)
+    assert.equal(calls,2)
+  } finally {globalThis.fetch=originalFetch; globalThis.setTimeout=originalTimeout}
+})
+const item=(cid:string)=>({cid,text:cid})
+const page=(comments:unknown[],cursor=0,has_more=0,total=0)=>({ok:true,status:200,data:{status_code:0,comments,cursor,has_more,total}}) as any
+
+test('Douyin HTTP 200 empty body and status 8 are not expired login and do not retry',async()=>{
+  for (const response of [{ok:true,status:200,data:null}, {ok:true,status:200,data:{status_code:8}}]) {
+    let calls=0
+    const result=await collectComments('123',40,async()=>{calls++;return response})
+    assert.equal(result.ok,false)
+    assert.match(result.error!,/^COMMENT_API_UNAVAILABLE/)
+    assert.equal(calls,1)
+  }
+})
+test('Douyin deduplicates, retains partial comments and stops stalled cursor',async()=>{
+  let calls=0; const waits:number[]=[]
+  const result=await collectComments('123',40,async()=>++calls===1
+    ?page([item('a')],20,1,100):page([item('a')],20,1,100),async ms=>{waits.push(ms)})
+  assert.equal(result.ok,false)
+  assert.equal(result.fetched,1)
+  assert.match(result.error!,/PAGINATION_STALLED/)
+  assert.equal(calls,2)
+  assert.equal(waits.length,1)
+  assert.ok(waits[0]>=1000 && waits[0]<3000)
+})
+test('Douyin true empty is valid, positive-total empty is not',async()=>{
+  assert.equal((await collectComments('123',40,async()=>page([]))).ok,true)
+  assert.equal((await collectComments('123',40,async()=>page([],0,0,10))).ok,false)
+  assert.equal((await collectComments('123',40,async()=>({ok:true,status:200,data:{status_code:0,comments:[]}}))).ok,false)
+})
+test('Douyin keeps final page, marks limit truncation and preserves request failure',async()=>{
+  assert.equal((await collectComments('123',40,async()=>page([item('a')],0,0,1))).fetched,1)
+  assert.equal((await collectComments('123',1,async()=>page([item('a')],20,1,10))).truncated,true)
+  assert.match((await collectComments('123',40,async()=>{throw new Error('network')})).error!,/COMMENT_REQUEST_FAILED: network/)
+})
```

**File**: `crews/main/skills/_shared/xhs-html-note.ts` (modified, +19/-6)
```diff
@@ -183,13 +183,26 @@ export function parseXhsNoteFromHtml(html: string, noteId: string): XhsHtmlNote
   let videoUrl = ""
   const video = note?.video
   if (video) {
-    const h264 = video?.media?.stream?.h264 ?? video?.media?.stream?.h265 ?? []
-    videoUrl = h264[0]?.masterUrl ?? h264[0]?.master_url ?? ""
-    if (!videoUrl) {
-      // consumer.originVideoKey 是个 key，需拼域名——仅当无直链时作最后线索，此处不拼，留空走 og:video
-      const originKey = video?.consumer?.originVideoKey ?? video?.consumer?.origin_video_key
-      if (originKey) videoUrl = "" // 不直接用 key，交给 og:video
+    // Stream bucket names can change (h264/h265/av1 → EF*). Inspect every
+    // array bucket, retaining only usable URLs and sorting numeric quality fields.
+    const stream = video?.media?.stream
+    const quality = (value: unknown): number => {
+      const n = Number(value)
+      return Number.isFinite(n) && n > 0 ? n : 0
     }
+    const candidates = stream && typeof stream === "object"
+      ? Object.values(stream).flatMap(bucket => Array.isArray(bucket) ? bucket : [])
+          .filter(item => item && typeof item === "object")
+          .map(item => ({
+            url: [item.masterUrl, item.master_url].find(url =>
+              typeof url === "string" && /^(?:https?:)?\/\//.test(url)),
+            height: quality(item.height),
+            bitrate: quality(item.avgBitrate ?? item.avg_bitrate),
+          }))
+          .filter(item => item.url)
+          .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
+      : []
+    videoUrl = candidates[0]?.url ?? ""
   }
   if (!videoUrl && og.video) videoUrl = og.video
 
```

**File**: `crews/main/skills/expert-douyin/tools/_shared/publish-login.md` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+# 抖音发布：登录与异常处置
+
+`douyin-note-publish` 与 `douyin-video-publish` 共用本流程、login-manager 和唯一持久化 session `douyin`。每次发布先读本说明。发布工具不负责扫码登录，也没有 `login` 子命令；`login-manager --platform douyin` 负责用户登录后的导出与验证，不会代替用户登录。
+
+## 1. 打开创作者上传页并判断登录态
+
+按本次形态执行一个命令：
+
+- 图文：`douyin-note-publish open-page`
+- 视频：`douyin-video-publish open-page`
+
+用 `camoufox-cli --session douyin --persistent --json snapshot -i` 查看页面，必要时截图判断：
+
+- 用户头像 / 用户名及创作者上传界面已出现，无登录遮挡 → 继续对应工具的 `run`。
+- 跳登录页或出现要求登录的弹窗 → 进入下方登录流程，暂不上传。
+- 页面尚未加载、元素缺失或浏览器报错 → 保留错误，排查页面或环境；不能只凭无头像或 `open-page` 的 `ok=true` 判定登录成功/失效。
+
+浏览器持久化 profile 才是发布登录态来源；中央 cookie 文件存在、HTTP 探活通过均不能替代创作者页面检查。视频工具没有完整的自动登录判断；图文工具可识别跳登录页，页面内登录弹窗仍由 agent 检查。
+
+## 2. 首次登录或登录失效
+
+1. 先读 `login-manager` 技能，停止当前发布步骤，复用同一 session 有头打开：
+
+   ```bash
+   camoufox-cli --session douyin --persistent --headed --json open "https://creator.douyin.com/creator-micro/content/upload?enter_from=dou_web"
+   ```
+
+2. 告知用户在窗口里手动完成抖音创作者中心登录，等待用户确认；不盲轮询、不自行扫码。不在 heartbeat / isolated 定时任务里启动交互登录，那里只记录并跳过。
+3. 用户确认完成后执行：
+
+   ```bash
+   login-manager --platform douyin
+   ```
+
+   该命令导出 cookie 与 UA、验证、成功后写中央存储并 close session。失败时保留窗口，按 login-manager 的错误处理，不循环导出或重登。
+4. 成功后重新执行第 1 节对应的 `open-page`，由 agent 确认创作者页面已登录，再按第 3 节选择恢复步骤。默认发布以无头方式重新启动磁盘 profile。
+
+## 3. 运行中异常与恢复
+
+| 现象 | 操作 |
+| --- | --- |
+| 上传 / 填表前明确未登录，或 exit 2 | 停止发布，走第 2 节；成功后重新检查页面与未发布内容，再继续尚未执行的步骤 |
+| 已点击发布，之后登录失效 / 超时 / 取链失败 | 发布结果待核实。重登后先到管理页核实；图文可用 `douyin-note-publish get-note-link --title "完整标题"` 补取链接。不得直接重跑 `run` / `publish` |
+| login-manager exit 2（导出验证未通过） | 提醒用户人工核实账号与当前页面，停止本轮自动恢复；不反复重登 |
+| `session douyin 正忙` | 等已有任务完成后再操作，不起第二个 session，也不关闭别人的任务 |
+| 找不到 input / 按钮，页面未跳登录 | 保留 DOM / 超时错误，检查页面；不把所有浏览器错误当成登录失效 |
+| 需要实名认证 / 账号验证 | 交用户在原窗口处理，不自动绕过 |
+| 显示环境异常或风控限流 | 显示问题报告并停止，不改 DISPLAY 或搭显示栈；风控停止，30 分钟内不重试 |
+
+## 4. 会话纪律
+
+- 登录阶段的直接浏览器命令一致带 `--persistent --headed`。不要在等待用户登录时调用默认无头发布命令，以免 daemon 切模式重启窗口。
+- 图文发布需要用户监督时，所有图文子命令传 `--headed`，直接 camoufox-cli 操作也保持有头。视频发布 wrapper 默认无头：先完成 login-manager 导出关闭，再回无头发布流程。
+- 严禁 `cookies import` 或另建临时 session 导入 cookie 造会话；不在日志、作品目录或代码里记录 cookie。
+- `run` 完成后关闭 session。分步操作结束或放弃时关闭自己占用的 session；login-manager 失败保留的窗口交用户处理，不擅自关闭。
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-comments/SKILL.md` (modified, +9/-3)
```diff
@@ -9,9 +9,11 @@ description: 抓取抖音视频的评论列表（纯 HTTP + cookie + 签名，
 
 抓取指定抖音视频的评论，供对标分析、起号标签反推、评论动机解读使用。
 
-**输入**：视频 `aweme_id` 或视频链接（支持 `v.douyin.com` 短链，自动展开）。
+**输入**：作品 `aweme_id` 或视频 / 图文链接（支持 `v.douyin.com` 短链，自动展开）。
 **输出**：JSON（stdout，含评论全文、点赞数、回复数、用户昵称、IP 属地、日期）；`--output` 时额外落一份按点赞降序的 markdown 摘要。
 
+评论接口不可用时停止本轮抓取；空响应、非零状态码不等于登录失效，也不等于作品没有评论。只有成功响应中明确给出空评论列表、无后续页且总数为 0 才可按无评论处理。
+
 登录态复用中央存储导出的 douyin cookie + UA（与 `douyin` 持久化 session 同一登录态），纯 HTTP 请求，不启动浏览器。
 
 ## 使用方式
@@ -53,13 +55,17 @@ douyin-comments fetch \
 ## 必做约束
 
 - 只读抓取，不发表、不点赞、不回复任何评论。
+- 脚本翻页间隔 1–3 秒，评论去重；游标不前进或没有新增评论时停止，不重复请求同页。
 - 单次任务批量抓多条视频评论时逐条串行调用，控制总条数（每条 ≤ `--limit`），避免批量请求触风控。
 - 评论文本是用户原话，分析时按动机归类（喜欢内容价值 / 喜欢人物状态 / 喜欢形式设定 / 提出具体问题 / 非恶意吐槽），不要把评论数直接当内容质量。
 
 ### Exit codes
 
 | code | 含义 | 调用方动作 |
 |------|------|-----------|
-| `0` | 抓取成功（`truncated=true` 表示达到 limit 或分页中断，未抓全） | 继续分析 |
+| `0` | 抓取成功（`truncated=true` 表示达到 limit，未抓全） | 继续分析 |
 | `1` | 参数错 / 网络错 / 签名不可用（stderr 有原因） | 排查后重试；签名不可用交 IT engineer 配凭证 |
-| `2` | `SESSION_EXPIRED`——cookie 缺失或失效 | 走 `login-manager --platform douyin` 有头重登后重试 |
+| `2` | `SESSION_EXPIRED`——本地 cookie 缺失 | 走 `login-manager --platform douyin` 有头重登后重试 |
+| `3` | 评论接口不可用、请求中断或分页停滞；stdout 保留已抓取的部分评论和具体错误 | 停止本轮抖音评论采样，标记数据不可得或样本不完整；不重登、不立即重试 |
+
+exit 3 的部分结果不能当作完整评论分布。对标、起号或复盘继续使用已有作品证据，缺失的评论维度明确标注；如用户已有评论导出或截图，可据其补充。
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-comments/scripts/fetch_comments.ts` (modified, +65/-49)
```diff
@@ -17,12 +17,14 @@
  * Exit codes:
  *   0  成功
  *   1  一般错误（参数 / 网络 / 签名不可用）
- *   2  SESSION_EXPIRED — cookie 缺失或失效，调用方走 login-manager 重登
+ *   2  SESSION_EXPIRED — 本地 cookie 缺失，调用方走 login-manager
+ *   3  评论接口不可用 / 分页停滞，输出部分数据，不触发重登
  */
 
 import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs"
 import { dirname, join } from "path"
 import { homedir } from "os"
+import { pathToFileURL } from "url"
 
 // ─── Types ────────────────────────────────────────────────────────────────
 
@@ -145,7 +147,7 @@ function cookieHeader(dict: Record<string, string>): string {
 // ─── aweme_id 解析 ────────────────────────────────────────────────────────
 
 function extractAwemeId(url: string): string | null {
-  const match = url.match(/\/video\/(\d+)/)
+  const match = url.match(/\/(?:video|note)\/(\d+)/)
   return match ? match[1] : null
 }
 
@@ -206,54 +208,71 @@ async function fetchComments(awemeId: string, limit: number): Promise<FetchResul
   const ua = readUserAgent("douyin")
   const { douyinWebGet } = await import("../../../../_shared/douyin-web.ts")
 
+  return collectComments(awemeId, limit, (cursor, count) => douyinWebGet<CommentListResponse>(
+    COMMENT_URI, { aweme_id: awemeId, cursor, count, item_type: 0 }, cookieStr, ua,
+  ))
+}
+
+type CommentPage = { ok: boolean; status: number; data: CommentListResponse | null; text?: string }
+
+/** One bounded read per page. Endpoint failure is not proof of expired login. */
+export async function collectComments(
+  awemeId: string,
+  limit: number,
+  request: (cursor: number, count: number) => Promise<CommentPage>,
+  pause: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
+): Promise<FetchResult> {
   const comments: FlatComment[] = []
+  const seen = new Set<string>()
   let cursor = 0
   let total = 0
-  let truncated = false
-
+  const interrupted = (error: string): FetchResult => ({
+    ok: false, awemeId, total, fetched: comments.length, truncated: true, comments, error,
+  })
   while (comments.length < limit) {
-    const remaining = limit - comments.length
-    const count = Math.min(PAGE_SIZE, Math.max(remaining, 1))
-    let resp: Awaited<ReturnType<typeof douyinWebGet<CommentListResponse>>> | null = null
-
-    // status_code=8 为间歇鉴权抖动（同 douyin-video-publish work_list 的已知行为），重试 2 次
-    for (let attempt = 0; attempt < 3; attempt++) {
-      resp = await douyinWebGet<CommentListResponse>(
-        COMMENT_URI,
-        { aweme_id: awemeId, cursor, count, item_type: 0 },
-        cookieStr,
-        ua,
-      )
-      if (resp.data?.status_code !== 8) break
-      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
+    let resp: CommentPage
+    try {
+      resp = await request(cursor, Math.min(PAGE_SIZE, limit - comments.length))
+    } catch (e) {
+      return interrupted(`COMMENT_REQUEST_FAILED: ${(e as Error).message}`)
     }
-
-    const data = resp?.data
-    if (!resp?.ok || !data || data.status_code !== 0) {
-      const code = data?.status_code ?? resp?.status ?? "unknown"
-      // 登录态失效常见表现为非 0 状态码 + 空评论；首屏即失败按 SESSION_EXPIRED 交重登
-      if (comments.length === 0) {
-        return { ok: false, awemeId, total: 0, fetched: 0, truncated: false, comments: [], error: `SESSION_EXPIRED(comment list status_code=${code})` }
+    const data = resp.data
+    if (!resp.ok || !data || data.status_code !== 0 || !Array.isArray(data.comments)) {
+      return interrupted(`COMMENT_API_UNAVAILABLE: HTTP=${resp.status}, status_code=${data?.status_code ?? "missing"}`)
+    }
+    if (typeof data.total === "number" && data.total >= 0) total = data.total
+    const before = comments.length
+    for (const raw of data.comments) {
+      if (!raw || typeof raw !== "object") continue
+      const item = flatten(raw)
+      if (!item.text) continue
+      const key = item.cid || JSON.stringify([item.userName, item.text, item.createTime])
+      if (!seen.has(key)) {
+        seen.add(key)
+        comments.push(item)
       }
-      truncated = true
-      break
     }
-
-    total = data.total || total
-    const page = (data.comments || []).map(flatten).filter(c => c.text)
-    comments.push(...page)
-
     const hasMore = Boolean(data.has_more)
-    if (!hasMore || page.length === 0) break
-    cursor = typeof data.cursor === "number" ? data.cursor : cursor + count
-  }
-
-  if (comments.length > limit) {
-    comments.length = limit
-    truncated = true
+    if (!hasMore) {
+      // Explicit empty list + no-more + total=0 is valid; empty positive totals are ambiguous.
+      if (!comments.length && (data.total !== 0 || ![0, false].includes(data.has_more as number | boolean))) {
+        return interrupted("COMMENT_API_UNAVAILABLE: empty comments without explicit zero total and end-of-list")
+      }
+      const truncated = comments.length > limit
+      return { ok: true, awemeId, total, fetched: Math.min(comments.length, limit),
+        truncated, comments: comments.slice(0, limit) }
+   
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-note-publish/SKILL.md` (modified, +25/-7)
```diff
@@ -1,6 +1,6 @@
 ---
 name: douyin-note-publish
-description: 用持久化浏览器发布抖音图文，支持多图、描述话题、精确配乐与图文链接回收。
+description: 用持久化浏览器发布抖音图文，支持多图、描述话题、上传后读取推荐音乐并选曲与图文链接回收。
 ---
 
 # 图文发布工具
@@ -11,25 +11,43 @@ description: 用持久化浏览器发布抖音图文，支持多图、描述话
 
 - 图片：按传参顺序上传 1–35 张，jpg/jpeg/png/webp/bmp/tif，单张非空且 ≤50MB，建议 3:4 或 4:3。
 - 标题：1–20 字；描述（含内联 `#话题`）：≤1000 字。
-- `--music`：精确歌曲名；默认搜索，也可加 `--music-category "纯音乐"` 在分类中定位。不传则保留默认原声。重名或无法确认目标歌曲时停止，不猜歌。
+- 上传前只确定配乐风格或原声意图，不指定歌名。上传完成后读取页面实际推荐候选，根据内容选择合适配乐。
 - 默认声明 AI 生成；纯实拍且无需 AI 声明时显式传 `--declaration none`。
 - 成功返回 `url=https://www.douyin.com/note/<mid>`、`mid`、`content_id`。
 
+## 发布前置与登录异常（必做）
+
+先读并执行[共用登录流程](../_shared/publish-login.md)，图文与视频使用相同登录态和恢复步骤：
+
+1. `douyin-note-publish open-page`，用 snapshot / 截图检查头像、用户名及创作者页面。
+2. 未登录或运行中 exit 2：有头打开创作者中心，等用户完成登录，再执行 `login-manager --platform douyin` 导出验证；该命令本身不代用户登录。
+3. 验证成功后重新 `open-page` 并检查页面。若此前已点击发布，先核实管理页 / 补取链接，不重跑发布。
+
+同 session 的有头参数保持一致；登录期间不调用默认无头发布命令。详细命令、登录验证失败、限流及异常恢复见共用流程。
+
 ## 发布
 
-先 `douyin-note-publish open-page`，用页面头像、用户名或截图确认登录态，再调用：
+页面确认已登录后，按顺序执行；候选必须在上传完成后读取：
 
 ```bash
-douyin-note-publish run --images /path/cover.png /path/page2.png --title "图文标题" --caption "描述 #话题" --music "目标歌曲完整名"
+douyin-note-publish upload --images /path/cover.png /path/page2.png
+douyin-note-publish music-list
+# 阅读返回的 name / author / duration，根据作品内容选择候选，复制其 choice
+douyin-note-publish music-select --choice "上一步实际返回的choice"
+douyin-note-publish fill --title "图文标题" --caption "描述 #话题"
+douyin-note-publish publish
+douyin-note-publish get-note-link --title "图文标题"
 ```
 
-未登录时交 `login-manager --platform douyin` 有头重登，之后重新打开上传页。浏览器只复用持久化 session `douyin`，严禁 cookies import。需要有头操作时每次调用都传 `--headed`，直接 camoufox-cli 操作也保持同一模式，避免 daemon 重启。
+`upload` 等全部图片上传完成后才返回。`music-list` 打开音乐面板并读取当前候选，不预设歌名或搜索不存在的歌曲。需要其他分类时通过浏览器页面切换推荐 / 热门榜 / 纯音乐等实际可见分类，再运行 `music-list`。每次读取会更新候选编号；页面刷新、候选变化后必须重新读取。
+
+`music-select` 仅接受当前页面返回的 `choice`，校验歌曲名、作者、时长及对应卡片，激活后只点击该卡片内的“使用”，确认面板关闭且表单“修改音乐”旁显示目标歌曲。验证失败停止，不能继续发布。`publish` 再次核对已选配乐。
 
-`run` 内部完成切图文、批量上传、填表并读回校验、选曲并校验、AI 声明、发布、刷新管理页、按标题定位唯一作品、进入图文编辑页取 mid，最后关闭 session。脚本不会通过视频列表首条或置顶视频猜图文链接，也不会在出错后自动重新发布。
+只有明确决定使用原声时，跳过两个音乐命令，使用 `publish --original-sound`；也可调用 `run --original-sound --images ... --title ... --caption ...` 完成原声发布。不要为了省略选曲默认使用原声。`run` 不支持预先指定音乐。
 
 ## 分步与恢复
 
-可调用 `upload --images ...`、`fill --title ... --caption ... [--music ...]`、`publish`。分步之间中间态保留在同一 session；不要插入其他抖音任务。`publish` 仅表示已跳转管理页，必须接 `get-note-link --title "完整标题"`，拿到链接才记录成功。取链会进入编辑页，只读取 URL，不保存修改。
+中间态由脚本保存在同一浏览器 session / 页面；不要插入其他抖音任务。刷新后重新读取候选、选择并验证。`publish` 仅表示已跳转管理页，必须接 `get-note-link`，拿到链接才记录成功。取链刷新管理页，按完整标题定位唯一作品并进入图文编辑页，只读取 URL，不保存修改；不通过列表首条或置顶视频猜链接，不自动重新发布。
 
 `get-note-link` 完成后自动关闭 session；分步中途放弃时手动 `camoufox-cli --session douyin --persistent --json close`（有头时加 `--headed`）。
 
```

---

### Incident Patch 4: `421cdb47` (2026-09-16)
**Commit Message**: fix(video,全线): 回正 story-develop 口径——触发条件是 Brief 缺失/质量不足，非「未指定 workflow 默认入口」

用户澄清：story-develop 的产出是 Brief；Stage 0→15 是 CP 一切视频必走流程（无论指定什么
workflow），起点是 Brief；甲方没给 Brief 或 Brief 质量不足以完成 script 生产才调用 story-develop。

- CP 侧 SKILL.md / AGENTS.md / video-producer.sh / story-develop.md：「未指定 workflow 时
  默认从 story-develop 进入」的错误口径回正为「未指定时按通用制作流程做；Brief 创意不足
  以直接写剧本时先走 story-develop 收敛 Brief」；story-develop 何时触发恢复原始判据
  （甲方没给 Brief 或 Brief 创意不足以直接写 script.md，够用就不触发），顺手修掉原文
  行尾杂散反引号
- main 三平台 SKILL.md / video-dna-framework / build_style_profile / content-production：
  同步回正；main 侧保留一处新增语境「Brief 缺失或创意不足时 CP 会走 story-develop 与
  Brief owner 收敛 Brief」（让 main 看到 CP 反向提问时有上下文）
- 上一轮的其他修复（口播代写、脚本路线、只交 Brief、制作简报统一等）全部保留

README 上游借鉴列表补 gbro-collage-broll（MIT）引用：Collage B-roll workflow 的
方法论来源与移植口径说明

**File**: `README.md` (modified, +1/-0)
```diff
@@ -340,6 +340,7 @@ wiseflow/
 - html-video（nexu-io 的 HTML 视频渲染方案 — `video-producer` 的 Stage 10 静帧→成片渲染思路与素材组装约定参考自此） https://github.com/nexu-io/html-video
 - ViMax（HKUDS 的视频生成框架 — `video-producer` 的机位一致性约束与素材 slot 规划借鉴其镜头规划策略） https://github.com/HKUDS/ViMax
 - OpenMontage（calesthio 的开源蒙太奇剪辑方案 — `video-producer` 的 Stage 12 拼接成片+转场工作流借鉴其片段组装与节奏控制思路） https://github.com/calesthio/OpenMontage
+- gbro-collage-broll（MIT — 半调纸拼贴 B-roll 三闸门方法论 — `expert-video` 的 Collage B-roll workflow 移植自此：隐喻设计法、语义色场表、visual-spec schema、静帧/视频 QA 标准照搬，闸门映射为 GATE A/B、渲染栈换成 siliconflow-img-gen + aigc-video-gen i2v） https://github.com/pyang5166/gbro-collage-broll
 - agent-skills-launch-pack_（起号方法论知识来源） https://github.com/chenjin-cmd/agent-skills-launch-pack_
 
 ## Citation
```

**File**: `crews/content-producer/AGENTS.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 | 影视解说 / 剧情解说 + 突然反转插入品宣（"万万没想到"式） | `expert-video` | 通用制作流程 + Reversal Ad 细化 |
 | 甲方交付口播文案或真人口播录音，要合成声画 | `expert-video` | 通用制作流程 + Narration Video 细化 |
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | `expert-video` | 通用制作流程 + Collage B-roll 细化 |
-| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 先走 `story-develop` intake workflow（创意不清时与甲方收敛 Brief，够用则快速通过），再进 Stage 1 `script-write`，按通用制作流程出片（叙事 / 动效 / 蒙太奇手法由我据创意自定） |
+| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 只按通用制作流程走（叙事 / 动效 / 蒙太奇手法由我据创意自定）；Brief 缺失或创意不清时先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write` |
 | 已有素材要剪辑、修整、拼接、配音、烧字幕 | `expert-video` | 通用制作流程的 Stage 12 工具箱（只做几何级修整） |
 | "做网页/落地页/APP 界面/品牌视觉体系" | `expert-design` | Web Page / App UI / Brand Visual |
 
```

**File**: `crews/content-producer/skills/expert-video/SKILL.md` (modified, +4/-5)
```diff
@@ -56,7 +56,7 @@ metadata:
 | 层 | 是什么 | 怎么用 |
 |----|--------|--------|
 | **通用制作流程**（本文下方） | 我做**任何**视频制作工作都必须遵循的准则：Stage 0→15 阶段链、GATE A / GATE B 两闸门、返工与耗时上限、决策审计链、工作区与交付约定 | 永远适用，不因视频类型而跳过或替换 |
-| **workflow**（`workflows/*.md`） | 两类——**intake 类**（`story-develop`：Stage 0 创意模糊时与甲方对话收敛 Brief，**不是 `Brief.workflow` 取值**）；**type 类**（`narration-video` / `collage-broll` / `reversal-ad`：在通用制作流程之上细化某类视频的阶段裁剪、叙事套路、声音 / 画面规范、验收） | type 类：Brief 指定 `workflow` 时必读必用，冲突时以 workflow 为准但**闸门与护栏不让步**；intake 类：Brief 未指定 workflow 时进入（创意不足先收敛，够用快速通过） |
+| **workflow**（`workflows/*.md`） | 两类——**intake 类**（`story-develop`：Stage 0 创意模糊时与甲方对话收敛 Brief，**不是 `Brief.workflow` 取值**）；**type 类**（`narration-video` / `collage-broll` / `reversal-ad`：在通用制作流程之上细化某类视频的阶段裁剪、叙事套路、声音 / 画面规范、验收） | type 类：Brief 指定 `workflow` 时必读必用，冲突时以 workflow 为准但**闸门与护栏不让步**；intake 类：Brief 缺失或创意不足以直接写剧本时触发 |
 | **工具说明**（`tools/<工具>/SKILL.md`） | 每个子命令的入参、产物路径、退出码与旁路条件 | 调用前查；本文不重复参数细节 |
 
 > 通用制作流程**不是**与类型 workflow 并列的第四条路，也**不是**"Brief 没指定类型时的 fallback"。它是底座；类型 workflow 只在底座上细化，产出特定类型的视频。
@@ -72,10 +72,10 @@ metadata:
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | Collage B-roll | `collage-broll` | 隐喻清单即 script（GATE A 检）→ 静帧即素材（GATE B 检 contact sheet）→ Stage 10 `collage-broll render` 批量 i2v 组装；阶段裁剪表见 workflow |
 
 - Brief 指定了 `workflow`：**先读对应文档并直接采用**，不得替换成自创流程。
-- Brief 未指定 `workflow` 且无明确类型信号：走 `story-develop` intake workflow——创意不足以直接写剧本时与甲方收敛，够用则快速通过——再进 Stage 1 `script-write`。叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`。
+- Brief 未指定 `workflow`：仍走通用制作流程，叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`；Brief 创意不足以直接写剧本时，先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write`。
 - 已有素材只要剪辑、修整、拼接、配音、烧字幕：仍走通用制作流程，中间阶段按实际裁剪，重心落在 Stage 12 工具箱（只做几何级修整；语义级高光剪辑归甲方 main）。
 
-> `story-develop` 是 **intake 类 workflow**（Stage 0 创意澄清，**不是 `Brief.workflow` 取值**），与上表 type 类 workflow 正交：Brief 未指定 workflow 时默认从它进入——创意不足以直接写剧本先收敛，够用则快速通过——再按通用制作流程（+ 信号识别到的 type workflow）执行。详见 `workflows/story-develop.md`。
+> `story-develop` 是 **intake 类 workflow**（Stage 0 创意澄清，**不是 `Brief.workflow` 取值**），与上表 type 类 workflow 正交：甲方没给 Brief 或 Brief 创意不足以直接写剧本时走它收敛出 Brief，再按通用制作流程 + 对应 type workflow 执行。详见 `workflows/story-develop.md`。
 
 不属于我的活（交回甲方或转其他专家包）：
 
@@ -116,8 +116,7 @@ workflow 文档在技能包内，不是项目目录内容；项目目录只放 B
 
 ```
 Stage 0  Brief intake       读甲方 Brief，核对字段，缺口向 Brief owner 澄清；
-                            甲方未给 Brief，或 Brief 未指定 workflow → 走 story-develop intake workflow
-                            （workflows/story-develop.md；创意不足先收敛，够用快速通过）
+                            甲方未给 Brief 或 Brief 不足以直接写剧本时 → 走 story-develop intake workflow（workflows/story-develop.md）
 Stage 1  script-write       Brief 创意 → 分场剧本（同时间同地点分一场、可拍化描述、enhancer 润色）
                             基线生产从此开始。
 Stage 2  script-self-eval   脚本自评 N 维打分，任一维 <3 必返工（落稿锁定时只检查不改写）
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/video-producer.sh` (modified, +2/-2)
```diff
@@ -24,8 +24,8 @@ video-producer — 视频制作原子能力（wrapper，expert-video 包内工
 流程:
   通用制作流程（expert-video SKILL.md 的 Stage 0→15 + 两闸门）是做**任何**视频都要遵循的基准，
   不是"没指定类型时的备选"。Brief 指定 workflow 时，先读包内 workflows/<workflow>.md，
-  按其阶段裁剪调用下列子命令；未指定时先走 story-develop intake workflow
-  （workflows/story-develop.md：创意不清先收敛，够用快速通过），再进 script-write。
+  按其阶段裁剪调用下列子命令；未指定时只按通用制作流程走。Brief 创意不足以直接写剧本时，
+  先走 story-develop intake workflow（workflows/story-develop.md）与甲方收敛 Brief，再进 script-write。
 
 子命令（按阶段序）:
   reference-concepts   可选     吃甲方给的参考拆解报告出 2–3 差异化概念
```

**File**: `crews/content-producer/skills/expert-video/workflows/story-develop.md` (modified, +2/-3)
```diff
@@ -1,13 +1,12 @@
 # Workflow：Story Develop（Brief intake · 创意澄清）
 
-**这是 intake 类 workflow，不是 type 类 workflow。** type workflow（`narration-video` / `collage-broll` / `reversal-ad`）细化"某类视频怎么制作"，是 `Brief.workflow` 的取值；本 workflow 解决"甲方还没把创意讲清楚时，怎么和他对话把 Brief 收敛出来"，**不是 `Brief.workflow` 的取值**，也不与 type workflow 互斥。**Brief 未指定 workflow 时，Stage 0（Brief intake）默认从这里进入**，与任何 type workflow 正交可组合——收敛出 Brief 后，仍按通用制作流程 + 对应 type workflow 执行。
+**这是 intake 类 workflow，不是 type 类 workflow。** type workflow（`narration-video` / `collage-broll` / `reversal-ad`）细化"某类视频怎么制作"，是 `Brief.workflow` 的取值；本 workflow 解决"甲方还没把创意讲清楚时，怎么和他对话把 Brief 收敛出来"，**不是 `Brief.workflow` 的取值**，也不与 type workflow 互斥。它在 **Stage 0（Brief intake）** 阶段触发，与任何 type workflow 正交可组合——收敛出 Brief 后，仍按通用制作流程 + 对应 type workflow 执行。
 
 ## 何时触发
 
-- **Brief 未指定 `workflow` 且无明确类型信号**（"从零做视频""出一支完整视频"）：默认入口。
 - **模式 B（直接对接用户）**：用户没给 Brief，或只给了模糊想法（"做个短片""帮我策划一下"）。
 - **模式 A（Subagent 承制）**：main 的 Brief 缺关键字段（创意 / 核心传达不清、规格缺失），需向 Brief owner 澄清。
-- 创意足以直接写 `script.md` 时**快速通过**：确认 Brief 字段完整即直进 Stage 1，不硬走对话。
+- 触发判据：**甲方没给 Brief，或 Brief 的"创意"不足以直接写 `script.md`**。够用就不触发。
 
 > ❗ 本 workflow 是**澄清与收敛**，不是替甲方创作。选题方向、品牌事实、卖点承诺、CTA 口径归甲方；我只把甲方脑子里的创意问清楚、整理成 Brief，不自行脑补，也不反过来指挥甲方。
 
```

**File**: `crews/main/skills/expert-douyin/SKILL.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ metadata:
 
 素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门，仅用于 main 自做轻加工成品的自检；CP 成片质检在 CP 流程内完成）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
 
-**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播终稿一律由 main 写好并随 Brief 交付（`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写；真人口播时，指导用户录音并取得录音文件），CP 不重写。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 走其 story-develop intake workflow（创意不足先收敛，够用快速通过）后按通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
+**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播终稿一律由 main 写好并随 Brief 交付（`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写；真人口播时，指导用户录音并取得录音文件），CP 不重写。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 按其通用制作流程做；Brief 缺失或创意不足以直接写剧本时，CP 会走其 story-develop intake workflow 与 Brief owner 收敛 Brief。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
 
 ## 风格与 DNA
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/references/video-dna-framework.md` (modified, +2/-2)
```diff
@@ -103,12 +103,12 @@ DNA template = **Brief.md 正文模板 + 口播文案模板（可选）**，固
 | 影视解说 / 剧情解说 + 反转植入（「万万没想到」式） | Content Producer `expert-video` → **Reversal Ad** workflow | `reversal-ad` |
 | 口播类（真人口播出镜，或旁白 + 画面） | Content Producer `expert-video` → **Narration Video** workflow | `narration-video` |
 | 一句文稿转视觉隐喻的纸拼贴动画 | Content Producer `expert-video` → **Collage B-roll** workflow | `collage-broll` |
-| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 走其 story-develop intake 收敛创意后按通用制作流程做，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定 | 省略 |
+| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 按其通用制作流程做，据创意自定叙事 / 动效 / 蒙太奇手法 | 省略 |
 | 已有素材简单拼接、加旁白、烧字幕 | main `video-edit`（不委托 CP） | — |
 | 已有真人口播素材去口气词、剪高光 | main `talking-head-cut`（不委托 CP） | — |
 | 产品操作录屏 | main `ui-demo`（不委托 CP） | — |
 
-Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 走其 **story-develop** intake workflow 收敛创意（够用快速通过）后按**通用制作流程**做——通用制作流程是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
+Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 按其**通用制作流程**做——那是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定；Brief 缺失或创意不足以直接写剧本时，CP 会走其 story-develop intake workflow 与 Brief owner 收敛 Brief。
 
 ## Focus ID 表
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/scripts/build_style_profile.py` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@
     "topic-angle": "- 单篇观测：选题类型、选题入口（现象 / 问题 / 冲突 / 数据 / 热点 / 挑战 / 个人经历）、目标人群为什么要看完（理解 / 判断 / 行动 / 避坑 / 身份认同 / 情绪共鸣）。\n- 边界：只记本篇，不判断跨篇稳定性；不评价选题好坏。",
     "title-cover": "- 单篇观测：标题类型（痛点 / 数字 / 反差 / 悬念 / 身份点名 / 搜索长尾）、标题与描述原文、话题标签策略。\n- 视觉证据：封面或首帧必须由视觉模型读取图片，至少提取画面主体与场景、构图与画幅、色彩体系、光线与质感、风格与媒介、文字视觉与图文关系、品牌识别元素、避免项，并反推为可执行的 AIGC 提示词要素；无图片写「未提供」，不得凭正文或标题想象补齐。",
     "content-idea": "- 单篇观测：一句话创意内核、创意类型、展开逻辑（悬念 / 反转 / 递进 / 对比 / 清单 / 实测）、记忆点。\n- 可复用信号：这个创意套路换成别的主题还能怎么用。\n- 边界：只记创意层，不记创作细节（逐句台词、镜头表、脚本结构、转场与编码参数）。",
-    "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll；不属这三类就写「不指定类型 workflow」，由 CP 走其 story-develop intake 收敛创意后按通用制作流程自定手法），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
+    "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll；不属这三类就写「不指定类型 workflow」，由 CP 按通用制作流程据创意自定手法），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
     "production-spec": "- 单篇观测：横屏或竖屏、时长带、画面风格（色调、质感、字幕样式倾向、信息密度）、配音音色与声音形态（原声口播 / TTS / 旁白 / 纯画面字幕）、BGM 与音效倾向、封面规格。\n- 边界：只记规格与倾向，不规定镜头参数、逐镜设计、转场与编码细节——那些归 Content Producer。",
     "narration-script": "- 子模块（仅口播类作品启用）：起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束方式；CTA 的目标、位置与句式记在 `interaction-cta`），以及人称与语气、句长与语速、签名式表达。\n- 边界：非口播类或证据不足时写「未启用 / 未观测」；不得把单篇句式直接上升为规则。",
     "body-voice": "- 单篇观测：开头钩子（原文摘录）、正文组织方式（清单体 / 教程步骤 / 故事线 / 对比 / 观点输出）、分行与段落节奏、口语化程度与人称、emoji 与标点用法、签名式表达。\n- 证据边界：脚本统计只给句长 / 行数 / emoji / 标签等线索；口头禅与签名表达必须回读原文确认。",
```

---

### Incident Patch 5: `f01b8492` (2026-09-16)
**Commit Message**: fix(main,三平台): 按视频两条理念审计修正——堵口播代写口子、脚本路线归位 Brief 契约、story-develop 口径补齐

违背理念的实质修复：
- 删「口播子模块未启用时只给要点、由 CP 组织旁白」代写通道（xhs:192 / wx:226）——
  口播终稿一律由 main 写（子模块启用按其结构写，未启用按用户要求与 Brief 核心传达写），
  「不适用」仅限非口播类；三平台 SKILL.md 分工硬边界、style-dna 口播行、
  content-production spawn 段同步去条件化
- 脚本制作路线（douyin:24 / wx:24）：「根据 DNA 改脚本交 CP」改为用户脚本按素材处理
  （绝对路径进 Brief 素材清单），main 只调策略层不动分镜，需动分镜即改走 Brief 委托由 CP 重出
- 校验清单（build_style_profile.py ×3）：删「未启用时避免规定逐句口播」，改要求无论
  子模块是否启用口播类必附 voiceover.md 绝对路径或录音路径

story-develop 口径补齐（对齐 CP 侧新默认入口）：
- 三平台 SKILL.md / content-production Brief 模板与 spawn 段 / video-dna-framework
  路由表与尾段 / build_style_profile video-form scaffold：「未指定 workflow → CP 走
  story-develop intake 收敛创意（够用快速通过）后按通用制作流程做」

一致性清理：
- 「只交 Brief + 素材 + 口播」→「只交 Brief 一份（素材、口播均以绝对路径写在 Brief 内）」
- 「制作简报」统一为 Brief；Brief 模板 workflow 行「未指定」枚举值改「省略本字段」；
  douyin 采集表补 workflow 行；video-review 限定为 main 自做轻加工自检；
  wx editing 成片后流程措辞、style-dna 图文残句、account-setup 脚本简报→话术简报

**File**: `crews/main/skills/expert-douyin/SKILL.md` (modified, +2/-2)
```diff
@@ -43,9 +43,9 @@ metadata:
 
 跨领域通用技能：`viral-chaser`（抖音 / B站 / 小红书视频下载拆解，DNA 采样与仿写参考的取数主力）、`smart-search`（跨平台搜索，选题调研优先走社交平台，不用通用搜索引擎）、`content-calibrator`（DNA 表现评估）、`published-track`（发布记录与指标库）、`login-manager`（抖音登录态维护）。
 
-素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
+素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门，仅用于 main 自做轻加工成品的自检；CP 成片质检在 CP 流程内完成）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
 
-**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播文案由 main 按 `narration-script` 子模块写好并随 Brief 交付（真人口播时，指导用户录音并取得录音文件），CP 不重写策略文案。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 按其通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
+**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播终稿一律由 main 写好并随 Brief 交付（`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写；真人口播时，指导用户录音并取得录音文件），CP 不重写。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 走其 story-develop intake workflow（创意不足先收敛，够用快速通过）后按通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
 
 ## 风格与 DNA
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/references/video-dna-framework.md` (modified, +2/-2)
```diff
@@ -103,12 +103,12 @@ DNA template = **Brief.md 正文模板 + 口播文案模板（可选）**，固
 | 影视解说 / 剧情解说 + 反转植入（「万万没想到」式） | Content Producer `expert-video` → **Reversal Ad** workflow | `reversal-ad` |
 | 口播类（真人口播出镜，或旁白 + 画面） | Content Producer `expert-video` → **Narration Video** workflow | `narration-video` |
 | 一句文稿转视觉隐喻的纸拼贴动画 | Content Producer `expert-video` → **Collage B-roll** workflow | `collage-broll` |
-| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 按其通用制作流程做，据创意自定叙事 / 动效 / 蒙太奇手法 | 省略 |
+| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 走其 story-develop intake 收敛创意后按通用制作流程做，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定 | 省略 |
 | 已有素材简单拼接、加旁白、烧字幕 | main `video-edit`（不委托 CP） | — |
 | 已有真人口播素材去口气词、剪高光 | main `talking-head-cut`（不委托 CP） | — |
 | 产品操作录屏 | main `ui-demo`（不委托 CP） | — |
 
-Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 按其**通用制作流程**做——那是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
+Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 走其 **story-develop** intake workflow 收敛创意（够用快速通过）后按**通用制作流程**做——通用制作流程是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
 
 ## Focus ID 表
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/scripts/build_style_profile.py` (modified, +2/-2)
```diff
@@ -104,7 +104,7 @@
     "topic-angle": "- 单篇观测：选题类型、选题入口（现象 / 问题 / 冲突 / 数据 / 热点 / 挑战 / 个人经历）、目标人群为什么要看完（理解 / 判断 / 行动 / 避坑 / 身份认同 / 情绪共鸣）。\n- 边界：只记本篇，不判断跨篇稳定性；不评价选题好坏。",
     "title-cover": "- 单篇观测：标题类型（痛点 / 数字 / 反差 / 悬念 / 身份点名 / 搜索长尾）、标题与描述原文、话题标签策略。\n- 视觉证据：封面或首帧必须由视觉模型读取图片，至少提取画面主体与场景、构图与画幅、色彩体系、光线与质感、风格与媒介、文字视觉与图文关系、品牌识别元素、避免项，并反推为可执行的 AIGC 提示词要素；无图片写「未提供」，不得凭正文或标题想象补齐。",
     "content-idea": "- 单篇观测：一句话创意内核、创意类型、展开逻辑（悬念 / 反转 / 递进 / 对比 / 清单 / 实测）、记忆点。\n- 可复用信号：这个创意套路换成别的主题还能怎么用。\n- 边界：只记创意层，不记创作细节（逐句台词、镜头表、脚本结构、转场与编码参数）。",
-    "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll；不属这三类就写「不指定类型 workflow」，由 CP 按通用制作流程据创意自定手法），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
+    "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll；不属这三类就写「不指定类型 workflow」，由 CP 走其 story-develop intake 收敛创意后按通用制作流程自定手法），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
     "production-spec": "- 单篇观测：横屏或竖屏、时长带、画面风格（色调、质感、字幕样式倾向、信息密度）、配音音色与声音形态（原声口播 / TTS / 旁白 / 纯画面字幕）、BGM 与音效倾向、封面规格。\n- 边界：只记规格与倾向，不规定镜头参数、逐镜设计、转场与编码细节——那些归 Content Producer。",
     "narration-script": "- 子模块（仅口播类作品启用）：起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束方式；CTA 的目标、位置与句式记在 `interaction-cta`），以及人称与语气、句长与语速、签名式表达。\n- 边界：非口播类或证据不足时写「未启用 / 未观测」；不得把单篇句式直接上升为规则。",
     "body-voice": "- 单篇观测：开头钩子（原文摘录）、正文组织方式（清单体 / 教程步骤 / 故事线 / 对比 / 观点输出）、分行与段落节奏、口语化程度与人称、emoji 与标点用法、签名式表达。\n- 证据边界：脚本统计只给句长 / 行数 / emoji / 标签等线索；口头禅与签名表达必须回读原文确认。",
@@ -144,7 +144,7 @@
 }
 
 TEMPLATE_CHECKLISTS = {
-    "video": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 选题、标题 / 描述、封面是否来自 DNA 文档。\n- 内容创意是否落到可复用的创意原型，而不是照抄样本主题。\n- 视频形态是否明确指向 Content Producer `expert-video` 的某个 workflow，或 main 的某个素材加工技能。\n- Brief 是否只含制作所需信息（不含 DNA 内容），素材是否给了绝对路径与授权说明。\n- 口播类是否附口播文案（或真人口播录音路径）；口播子模块未启用时是否避免规定逐句口播。\n- 制作规格（横竖屏、时长带、画面风格、配音音色）是否尊重样本覆盖度；样本不足时是否标注未观测。\n- 业务植入是否落到位置 + 载体 + 衔接句（而不是只写「自然植入」），CTA 是否只有一个主行动、句式可执行且未越合规红线。\n- 用户输入是否已转译为具体执行规则。",
+    "video": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 选题、标题 / 描述、封面是否来自 DNA 文档。\n- 内容创意是否落到可复用的创意原型，而不是照抄样本主题。\n- 视频形态是否明确指向 Content Producer `expert-video` 的某个 workflow，或 main 的某个素材加工技能。\n- Brief 是否只含制作所需信息（不含 DNA 内容），素材是否给了绝对路径与授权说明。\n- 口播类是否附口播终稿（`voiceover.md` 绝对路径）或真人口播录音路径——无论口播子模块是否启用；「不适用」仅限非口播类视频。\n- 制作规格（横竖屏、时长带、画面风格、配音音色）是否尊重样本覆盖度；样本不足时是否标注未观测。\n- 业务植入是否落到位置 + 载体 + 衔接句（而不是只写「自然植入」），CTA 是否只有一个主行动、句式可执行且未越合规红线。\n- 用户输入是否已转译为具体执行规则。",
     "note": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 选题、标题与封面图组是否来自 DNA 文档。\n- 正文表达的每条规则是否可从 DNA 文档推导，未使用空泛形容词。\n- 图组数量、构图与视觉风格是否与 DNA 一致；视觉结论是否有图片证据。\n- 业务植入是否落到位置 + 载体 + 衔接句（而不是只写「软性推荐」），CTA 是否每篇只放一个主行动、句式可执行且未越合规红线。\n- 用户输入是否已转译为具体执行规则。",
 }
 
```

**File**: `crews/main/skills/expert-douyin/workflows/account-setup.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 新号起号、账号定位梳理、内容支柱搭建、默认 `dna-0` 初始化、老号接手与诊断走这个 Workflow。独立账号对标走 `account-benchmark.md`。
 
-起号拆成六件事：定位清楚、观看理由成立、标签稳定、内容有用、互动真实、复盘持续；平台功能入口、算法权重、处罚规则按待确认信息处理。产出要能直接执行：表格、清单、脚本简报、选题池或复盘动作，少写空泛建议，多给"下一条视频该怎么做"。
+起号拆成六件事：定位清楚、观看理由成立、标签稳定、内容有用、互动真实、复盘持续；平台功能入口、算法权重、处罚规则按待确认信息处理。产出要能直接执行：表格、清单、话术简报、选题池或复盘动作，少写空泛建议，多给"下一条视频该怎么做"。
 
 ## 入口判断
 
```

**File**: `crews/main/skills/expert-douyin/workflows/content-production.md` (modified, +7/-6)
```diff
@@ -20,8 +20,8 @@
 | 路线 | 判断 | 执行方 |
 | --- | --- | --- |
 | 素材组装 / 轻剪辑 | 用户手里有可用素材 | main 直接做：`video-edit` / `talking-head-cut` / `ui-demo` |
-| 从零制作 | 没有素材，需要出脚本、拍摄/生成画面 | main 出制作简报，委托 `content-producer` |
-| 脚本制作 | 用户已有脚本 | 根据dna对脚本做必要修改，提交用户确认后，脚本交 `content-producer` 制作 |
+| 从零制作 | 没有素材，需要出脚本、拍摄/生成画面 | main 出 Brief，委托 `content-producer` |
+| 脚本制作 | 用户已有脚本 | 用户脚本按素材处理（绝对路径写进 Brief 素材清单，必须保留的事实 / 结构要点写进 Brief 要求）；main 只调策略层（选题 / 口播口径 / 植入 / CTA），不改写脚本本体、不动分镜与画面执行——需动分镜即改走 Brief 委托，由 CP 重出 |
 
 ### 3. 抖音链接的意图判断
 
@@ -77,6 +77,7 @@ DNA template 是 main agent 的生产输入模板：
 | 项目 | 规则 |
 | --- | --- |
 | 制作路线 | 素材组装 / 从零制作 / 脚本制作，判断依据见 Step 0 |
+| workflow | 视频全案已确定形态时写 CP `expert-video` 支持的 workflow（reversal-ad / narration-video / collage-broll）；未确定则省略（省略 = CP 走其 story-develop intake 收敛后按通用制作流程做） |
 | 主题 / 方向 | 用户给了明确主题时不得另起炉灶，仅按 DNA template 细化选题和钩子 |
 | 素材 | 用户提供的视频片段、图片、录音、文案必须优先使用 |
 | 目标观众 | 未指定时按 `business_knowledge.md` 和 DNA 受众关系推导 |
@@ -187,14 +188,14 @@ DNA 约束的是选题与观看理由、标题与封面写法、内容创意原
 
 ### 路线 B / C：委托 content-producer 制作
 
-1. 产出**制作简报** `douyin/outputs/<video-name>/brief.md`（Brief 是 main / CP 的唯一交接物）：
+1. 产出 **Brief** `douyin/outputs/<video-name>/brief.md`（Brief 是 main / CP 的唯一交接物）：
 
 ```markdown
 # 抖音视频制作 Brief
 
 - 视频名 / slug：
 - platform：douyin
-- workflow：reversal-ad / narration-video / collage-broll / 未指定（未指定 = CP 按其通用制作流程做，据创意自定叙事 / 动效 / 蒙太奇手法）
+- workflow：reversal-ad / narration-video / collage-broll（视频形态未确定时省略本字段；省略 = CP 走其 story-develop intake workflow 收敛创意后按通用制作流程做，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定）
 - 选题与观看理由：
 - 核心传达：
 - 内容创意：创意原型 + 展开逻辑 + 记忆点（+ 反转设计，如为反转植入类）
@@ -216,9 +217,9 @@ Brief 硬性规则：
 - **素材给绝对路径**：main 负责素材准备（用户素材预处理、`ui-demo` 录屏、从 `campaign_assets/` 挑选），把绝对路径写进 Brief。
 - **甲乙方关系**：需求方向、品牌事实、发布文案归 main；制作方案、分镜、渲染参数归 CP。
 
-2. 口播类视频：按 DNA 的 `narration-script` 子模块写口播终稿 `douyin/outputs/<video-name>/voiceover.md`，Brief 里给绝对路径；真人口播时指导用户按口播稿录音，完成后向用户取得录音文件。
+2. 口播类视频：口播终稿一律由 main 写——`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写——落 `douyin/outputs/<video-name>/voiceover.md`，Brief 里给绝对路径；真人口播时指导用户按口播稿录音，完成后向用户取得录音文件。
 3. 参考模式下，把选题与创意结论写进 Brief 的「内容创意」段即可；`viral-chaser` 拆解报告是 main 的采样材料，**不作为 Brief 附件交给 CP**。
-4. spawn `content-producer` 委托制作：只交 Brief + 素材绝对路径 + 口播文案 / 录音；不指定 CP 的工作区与制作方案。
+4. spawn `content-producer` 委托制作：只交 Brief 一份——素材、口播文案 / 录音均已以绝对路径写在 Brief 内；不指定 CP 的工作区与制作方案。
 5. Brief 变更时更新版本并推送变更要点；已开工中间产物按新版取舍，弃用部分记入交付说明。
 6. CP 交付后，按其回报的绝对路径把成片与封面取回 `douyin/outputs/<video-name>/`（`video.mp4` / `cover.jpg`），并把交付说明要点记入作品目录。
 
```

**File**: `crews/main/skills/expert-douyin/workflows/style-dna.md` (modified, +1/-1)
```diff
@@ -156,7 +156,7 @@ douyin-style-profiler update \
 - **图文内容**：读取图文 DNA 文档与 template，main agent 直接生产。
 - **视频全案**：读取视频 DNA 文档与 template，main agent 产出 **Brief**（+ 口播类的口播文案）。Brief 写明选题与观看理由、标题与简介、内容创意、`workflow`（视频形态的制作指向）、制作规格（横竖屏 / 时长带 / 画面风格 / 配音音色）、素材清单与授权（绝对路径）、验收标准、闸门批准人。
 - **Brief 不含 DNA 信息**：Content Producer 看不到 main 的 DNA，只按 Brief 制作；也不要把 DNA 文档路径写进 Brief。
-- **口播类视频**：口播文案子模块启用时，口播终稿由 main agent 写好并随 Brief 交付；真人口播时由 main agent 指导用户录音并向用户取得录音文件。CP 不重写策略文案。
+- **口播类视频**：口播终稿一律由 main agent 写好并随 Brief 交付（`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写）；真人口播时由 main agent 指导用户录音并向用户取得录音文件。CP 不重写。
 - **工作区**：main 不替 CP 建工作区，也不指定项目目录；CP 自建工作区，双方 T3 权限可互访取文件。
 
 ## 对标接口
```

**File**: `crews/main/skills/expert-wx-channel/SKILL.md` (modified, +2/-2)
```diff
@@ -43,9 +43,9 @@ metadata:
 
 跨领域通用技能：`published-track`（发布记录与指标库）、`content-calibrator`（DNA 表现评估）、`smart-search`（跨平台搜索，选题调研优先社交平台）、`council`（定位决策辅助）、`siliconflow-img-gen`（封面图生成）。
 
-素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
+素材加工相关技能：`video-edit`（素材加工拼接）、`talking-head-cut`（口播轻剪辑）、`ui-demo`（产品操作录屏）、`video-review`（成片质检闸门，仅用于 main 自做轻加工成品的自检；CP 成片质检在 CP 流程内完成）、`siliconflow-img-gen`（封面图）、`pexels-footage` / `pixabay-footage`（免版权素材）。
 
-**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播文案由 main 按 `narration-script` 子模块写好并随 Brief 交付（真人口播时，指导用户录音并取得录音文件），CP 不重写策略文案。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 按其通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
+**视频全案分工硬边界**：除非是基于已有素材轻加工，否则视频全案的制作均应委托 `content-producer`。main 负责选题策划、按 DNA 出 **Brief**、拟定标题与简介、准备素材（用户素材预处理 / `ui-demo` 录屏 / 从 `campaign_assets/` 挑选，绝对路径写进 Brief）、监督推动 CP、成片后的发布与运营；口播类视频的口播终稿一律由 main 写好并随 Brief 交付（`narration-script` 子模块启用时按其结构写，未启用时按用户要求与 Brief 核心传达写；真人口播时，指导用户录音并取得录音文件），CP 不重写。Brief 指定 `workflow` 时 CP 必须采用；未指定时 CP 走其 story-develop intake workflow（创意不足先收敛，够用快速通过）后按通用制作流程做。Brief **不含 DNA 信息**，main 也不替 CP 建工作区（双方 T3 权限可互访取文件）。
 
 ## 平台速查
 
```

**File**: `crews/main/skills/expert-wx-channel/tools/wx-channel-style-profiler/references/video-dna-framework.md` (modified, +2/-2)
```diff
@@ -103,12 +103,12 @@ DNA template = **Brief.md 正文模板 + 口播文案模板（可选）**，固
 | 影视解说 / 剧情解说 + 反转植入（「万万没想到」式） | Content Producer `expert-video` → **Reversal Ad** workflow | `reversal-ad` |
 | 口播类（真人口播出镜，或旁白 + 画面） | Content Producer `expert-video` → **Narration Video** workflow | `narration-video` |
 | 一句文稿转视觉隐喻的纸拼贴动画 | Content Producer `expert-video` → **Collage B-roll** workflow | `collage-broll` |
-| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 按其通用制作流程做，据创意自定叙事 / 动效 / 蒙太奇手法 | 省略 |
+| 纯 AIGC 动画 / 剧情短片 / 蒙太奇拼接（需从零出脚本分镜） | Content Producer `expert-video` → **不指定类型 workflow**：CP 走其 story-develop intake 收敛创意后按通用制作流程做，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定 | 省略 |
 | 已有素材简单拼接、加旁白、烧字幕 | main `video-edit`（不委托 CP） | — |
 | 已有真人口播素材去口气词、剪高光 | main `talking-head-cut`（不委托 CP） | — |
 | 产品操作录屏 | main `ui-demo`（不委托 CP） | — |
 
-Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 按其**通用制作流程**做——那是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
+Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换成自创流程；未写时 CP 走其 **story-develop** intake workflow 收敛创意（够用快速通过）后按**通用制作流程**做——通用制作流程是 CP 所有视频工作的基准准则，不是与其他 workflow 并列的选项，也不是 fallback，叙事 / 动效 / 蒙太奇手法由 CP 据创意自定。
 
 ## Focus ID 表
 
```

---

### Incident Patch 6: `4fce7ff0` (2026-09-16)
**Commit Message**: fix(expert-video): 全仓对齐 Stage 0→15 新编号，清除旧阶段编号与 intent-router 留痕

- AGENTS.md / SKILL.md: Stage 0→14→0→15；script-write 由 Stage 3 改 Stage 1；
  工作区目录树内联编号(3/3b/4/5/6/7/8/9a/9b/14b)全部按新编号重排；
  跨领域技能引用 aigc-video-gen 8/10→7/10、siliconflow-img-gen 6/10/14a→5/10/14a
- video-producer.sh: help 全表重编号；GATE A 由 Stage 6 后改 Stage 5 后；
  motion-audit/make-cover 补 13b/14a 子标
- 12 个子脚本: docstring/argparse/报错/[next] 提示/JSON stub stage 字段全部对齐新编号；
  9a/9b/3b/11a/11b 旧子字母清除（11B/11C 保留为 mix-audio 场景字母）
- mix-audio.py: 三场景→四场景（正文补齐场景 D 甲方口播录音路径），与 SKILL.md 对齐
- reversal-ad.md: Stage 3 不重写策略文案 → Stage 1 不重写 voiceover.md 口播终稿
- main 三平台 video-dna-framework.md: 删「intent-router 档位分类已退役」历史注记
- character-register.py: 顺手修 docstring 错字（拱分→拆分）

**File**: `crews/content-producer/AGENTS.md` (modified, +2/-2)
```diff
@@ -11,15 +11,15 @@
 
 ## 能力方向路由
 
-**视频类铁律**：只要接的是视频制作活儿，`expert-video` 的**通用制作流程**（Stage 0→14 阶段链 + GATE A/B 两闸门 + 护栏 + 工作区与交付约定）**一律适用**——它是基准准则，不是"没匹配到类型时的备选"，也不与类型 workflow 并列。下表匹配到的类型 workflow 只是叠加在基准上的进一步细化。
+**视频类铁律**：只要接的是视频制作活儿，`expert-video` 的**通用制作流程**（Stage 0→15 阶段链 + GATE A/B 两闸门 + 护栏 + 工作区与交付约定）**一律适用**——它是基准准则，不是"没匹配到类型时的备选"，也不与类型 workflow 并列。下表匹配到的类型 workflow 只是叠加在基准上的进一步细化。
 
 | 入口信号 | 专家包 | 怎么做 |
 |---------|--------|--------|
 | Brief 指定 `workflow`（如 `reversal-ad`） | `expert-video` | 通用制作流程 + 读 Brief 指定的 `workflows/<值>.md`，按其阶段裁剪执行 |
 | 影视解说 / 剧情解说 + 突然反转插入品宣（"万万没想到"式） | `expert-video` | 通用制作流程 + Reversal Ad 细化 |
 | 甲方交付口播文案或真人口播录音，要合成声画 | `expert-video` | 通用制作流程 + Narration Video 细化 |
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | `expert-video` | 通用制作流程 + Collage B-roll 细化 |
-| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 只按通用制作流程走；创意不清时先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 3 `script-write`（叙事 / 动效 / 蒙太奇手法由我据创意自定，不再做三档分类） |
+| "从零做视频""出一支完整视频""按这个主题拍片子"（无匹配类型） | `expert-video` | 只按通用制作流程走；创意不清时先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write`（叙事 / 动效 / 蒙太奇手法由我据创意自定） |
 | 已有素材要剪辑、修整、拼接、配音、烧字幕 | `expert-video` | 通用制作流程的 Stage 12 工具箱（只做几何级修整） |
 | "做网页/落地页/APP 界面/品牌视觉体系" | `expert-design` | Web Page / App UI / Brand Visual |
 
```

**File**: `crews/content-producer/skills/expert-video/SKILL.md` (modified, +8/-8)
```diff
@@ -55,7 +55,7 @@ metadata:
 
 | 层 | 是什么 | 怎么用 |
 |----|--------|--------|
-| **通用制作流程**（本文下方） | 我做**任何**视频制作工作都必须遵循的准则：Stage 0→14 阶段链、GATE A / GATE B 两闸门、返工与耗时上限、决策审计链、工作区与交付约定 | 永远适用，不因视频类型而跳过或替换 |
+| **通用制作流程**（本文下方） | 我做**任何**视频制作工作都必须遵循的准则：Stage 0→15 阶段链、GATE A / GATE B 两闸门、返工与耗时上限、决策审计链、工作区与交付约定 | 永远适用，不因视频类型而跳过或替换 |
 | **workflow**（`workflows/*.md`） | 两类——**intake 类**（`story-develop`：Stage 0 创意模糊时与甲方对话收敛 Brief，**不是 `Brief.workflow` 取值**）；**type 类**（`narration-video` / `collage-broll` / `reversal-ad`：在通用制作流程之上细化某类视频的阶段裁剪、叙事套路、声音 / 画面规范、验收） | type 类：Brief 指定 `workflow` 时必读必用，冲突时以 workflow 为准但**闸门与护栏不让步**；intake 类：创意不足以直接写剧本时触发 |
 | **工具说明**（`tools/<工具>/SKILL.md`） | 每个子命令的入参、产物路径、退出码与旁路条件 | 调用前查；本文不重复参数细节 |
 
@@ -72,7 +72,7 @@ metadata:
 | "把这句口播做成拼贴 B-roll""纸拼贴动画""半调拼贴" | Collage B-roll | `collage-broll` | 一句文稿 → 一个视觉隐喻 → 静帧 → i2v，三道闸门与 Gate 3 批量调度 |
 
 - Brief 指定了 `workflow`：**先读对应文档并直接采用**，不得替换成自创流程。
-- Brief 未指定 `workflow`：仍走通用制作流程；创意不足以直接写剧本时，先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 3 `script-write`。叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`。
+- Brief 未指定 `workflow`：仍走通用制作流程；创意不足以直接写剧本时，先走 `story-develop` intake workflow 与甲方收敛 Brief，再进 Stage 1 `script-write`。叙事 / 动效 / 蒙太奇的处理手法由我据创意自定并记 `decisions.json`。
 - 已有素材只要剪辑、修整、拼接、配音、烧字幕：仍走通用制作流程，中间阶段按实际裁剪，重心落在 Stage 12 工具箱（只做几何级修整；语义级高光剪辑归甲方 main）。
 
 > `story-develop` 是 **intake 类 workflow**（Stage 0 创意澄清，**不是 `Brief.workflow` 取值**），与上表 type 类 workflow 正交：任何类型的视频，创意不清都先走它收敛 Brief，再按通用制作流程 + 对应 type workflow 执行。详见 `workflows/story-develop.md`。
@@ -93,19 +93,19 @@ output_videos/<topic-en-slug>/      # <project-dir>
 ├── brief.md                    # 甲方交付（拷贝入档）或 Stage 0 与用户定稿
 ├── voiceover.md                # 甲方交付的口播文案（如有）
 ├── reference/                  # 可选：甲方给的参考拆解报告与差异化概念
-├── script/                     # script.md(3) / self-eval.json(3b) / decisions.json(审计链)
-├── storyboard/                 # storyboard.json(4) / shot_decompose.json(5)
-├── characters/                 # registry.json(6) + <char-id>/{front,side,back}.png
+├── script/                     # script.md(1) / self-eval.json(2) / decisions.json(审计链)
+├── storyboard/                 # storyboard.json(3) / shot_decompose.json(4)
+├── characters/                 # registry.json(5) + <char-id>/{front,side,back}.png
 ├── gates/                      # gate-a.md / gate-b.md（含批准人与批准范围）
 ├── raw_materials/              # 甲方素材入库副本 + 授权记录
-├── slots/                      # slot-plan.json(7) / asset-resolve.json(8) / slideshow-risk.json(9a) / delivery-promise.json(9b)
+├── slots/                      # slot-plan.json(6) / asset-resolve.json(7) / slideshow-risk.json(8) / delivery-promise.json(9)
 ├── render/shot-NN/             # (10) first-frame.png / last-frame.png / shot.mp4
 ├── audio/                      # narration.mp3 / narration-segments.json / bgm.mp3 / subtitles.srt
 ├── artifacts/                  # (12) 按镜顺序的最终段 01_*.mp4 … NN_*.mp4
 ├── video.mp4                   # (12) 成片
 ├── review/                     # verdict.json(13a) / frames/ / motion-audit.json(13b)
 ├── cover.jpg                   # (14a)
-└── final-deliver.md            # (14b)
+└── final-deliver.md            # (15)
 ```
 
 workflow 文档在技能包内，不是项目目录内容；项目目录只放 Brief、素材、脚本、渲染与交付产物。
@@ -198,7 +198,7 @@ Stage 15 交付              回报成片 + 封面 + final-deliver.md 的绝对
 | `video-producer` | 阶段链全部原子能力（剧本 / 分镜、素材 slot 与解析、渲染、混音对齐、拼接合成、动效审计、封面）+ 后期处理（`normalize` **必跑**、`burn-srt` / `duck` / `denoise` / `interp` 可选，全部干湿分离不覆盖输入） | `video-producer <子命令>`；`video-producer help` 列全量 |
 | `collage-broll` | 纸拼贴 B-roll 的环境自检与 Gate 3 批量 i2v 调度（0 全通 / 1 参数错 / 2 部分失败，只重跑失败条目） | `collage-broll check-setup` / `collage-broll gate3 --batch <gen-jobs.json> [--dry-run]` |
 
-跨领域公共技能：`aigc-video-gen`（视频片段生成 / i2v 首尾帧插值，Stage 8/10；输出路径须落在 `output_videos/` 下，调用时 workdir 是 Content Producer workspace 根）、`siliconflow-img-gen`（静帧、角色三视图、封面，Stage 6/10/14a）、`awk-tts`（旁白 TTS，带字级时间戳，Stage 11B；`--enable-subtitle` 让火山流式 HTTP 原生返回时间戳）、`bgm-library`（ccMixter 免版税 + 自动 TASL 署名，商用安全，Stage 11C 优先）、`pexels-footage` / `pixabay-footage`（免版税素材与 BGM 搜索）、`video-review`（成片技术自检闸门，Stage 13a）、`video-edit subtitles`（main crew 暴露的烧字幕原子；不可用时向 Brief owner 报工具缺口，不手写 ffmpeg）。
+跨领域公共技能：`aigc-video-gen`（视频片段生成 / i2v 首尾帧插值，Stage 7/10；输出路径须落在 `output_videos/` 下，调用时 workdir 是 Content Producer workspace 根）、`siliconflow-img-gen`（静帧、角色三视图、封面，Stage 5/10/14a）、`awk-tts`（旁白 TTS，带字级时间戳，Stage 11B；`--enable-subtitle` 让火山流式 HTTP 原生返回时间戳）、`bgm-library`（ccMixter 免版税 + 自动 TASL 署名，商用安全，Stage 11C 优先）、`pexels-footage` / `pixabay-footage`（免版税素材与 BGM 搜索）、`video-review`（成片技术自检闸门，Stage 13a）、`video-edit subtitles`（main crew 暴露的烧字幕原子；不可用时向 Brief owner 报工具缺口，不手写 ffmpeg）。
 
 env 依赖：`AWK_API_KEY`（静帧 / 视频生成）、`VOLC_ASR_*`（`narration-align` 回退路径与甲方口播录音转写；旧控制台双头 `VOLC_ASR_APP_ID` + `VOLC_ASR_ACCESS_KEY`，或新控制台单头 `VOLC_ASR_APP_KEY`）。缺 env 时子命令 exit 2，补齐属 IT engineer 职责，不要静默降级。Python 依赖 `requests`、`Pillow`（`motion-graphics` 逐帧绘制）在仓根 `requirements.txt`。系统依赖：`motion-graphics` 需要 Noto Sans SC/CJK 字体（探测 `/usr/share/fonts/ope
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/asset-resolve.py` (modified, +5/-5)
```diff
@@ -1,10 +1,10 @@
 #!/usr/bin/env python3
-"""Stage 8 — asset-resolve：按 slot 拉素材（Fast path）。
+"""Stage 7 — asset-resolve：按 slot 拉素材（Fast path）。
 
 Usage:
   python3 scripts/asset-resolve.py <project_dir> [--source pexels|pixabay|both] [--no-confirm]
 
-入：project_dir/slots/slot-plan.json（Stage 7）
+入：project_dir/slots/slot-plan.json（Stage 6）
 出：project_dir/slots/asset-resolve.json（每 slot 选定素材 + rejected_picks 落盘）
     + 素材落 project_dir/raw_materials/
 
@@ -36,7 +36,7 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 8 asset-resolve")
+    parser = argparse.ArgumentParser(description="Stage 7 asset-resolve")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     parser.add_argument("--source", default="both", choices=["pexels", "pixabay", "both"])
     parser.add_argument("--no-confirm", action="store_true", help="agent 已人核完毕，不再呈交")
@@ -59,7 +59,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": 8,
+        "stage": 7,
         "source": args.source,
         "raw_materials_dir": str(raw_dir),
         "instruction": (
@@ -83,7 +83,7 @@ def main() -> None:
     }
     resolve_path.write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")
     print(f"[done] asset-resolve.json 模板已落：{resolve_path}")
-    print(f"[next] agent 跑 Fast path 填 picks → 跑 slideshow-risk（Stage 9a）")
+    print(f"[next] agent 跑 Fast path 填 picks → 跑 slideshow-risk（Stage 8）")
 
 
 if __name__ == "__main__":
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/character-register.py` (modified, +4/-4)
```diff
@@ -1,10 +1,10 @@
 #!/usr/bin/env python3
-"""Stage 6 — character-register：角色三视图 + static/dynamic features 拱分。
+"""Stage 5 — character-register：角色三视图 + static/dynamic features 拆分。
 
 Usage:
   python3 scripts/character-register.py <project_dir>
 
-入：project_dir/storyboard/shot_decompose.json（Stage 5）+ script.md（Stage 3 出场人物）
+入：project_dir/storyboard/shot_decompose.json（Stage 4）+ script.md（Stage 1 出场人物）
 出：project_dir/characters/registry.json（每个角色 static/dynamic features）
     + project_dir/characters/<char-id>/front.png + side.png + back.png（调 siliconflow-img-gen）
 
@@ -28,7 +28,7 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 6 character-register")
+    parser = argparse.ArgumentParser(description="Stage 5 character-register")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     args = parser.parse_args()
 
@@ -49,7 +49,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": 6,
+        "stage": 5,
         "characters": [],
         "instruction": (
             "agent 据 script.md 出场人物 + shot_decompose.json 列出所有出场角色，每个角色填 schema 并调 "
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/delivery-promise-lock.py` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env python3
-"""Stage 9b — delivery-promise-lock：交付承诺八类锁定 + motion_ratio 预估。
+"""Stage 9 — delivery-promise-lock：交付承诺八类锁定 + motion_ratio 预估。
 
 Usage:
   python3 scripts/delivery-promise-lock.py <project_dir>
@@ -32,7 +32,7 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 9b delivery-promise-lock")
+    parser = argparse.ArgumentParser(description="Stage 9 delivery-promise-lock")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     args = parser.parse_args()
 
@@ -52,7 +52,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": "9b",
+        "stage": "9",
         "promises": {
             "has_dialogue": None,
             "has_narration": None,
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/mix-audio.py` (modified, +15/-10)
```diff
@@ -1,14 +1,14 @@
 #!/usr/bin/env python3
-"""Stage 11 — mix-audio：配音配乐三场景分流。
+"""Stage 11 — mix-audio：配音配乐四场景分流。
 
 Usage:
   python3 scripts/mix-audio.py <project_dir>
 
 入：project_dir/script/script.md（含 delivery_cues / 对白 / 旁白标记）
 出：project_dir/audio/ 目录 + subtitles.srt 模板
-    （实际音频产物由 agent 按下方三场景路径生成）
+    （实际音频产物由 agent 按下方四场景路径生成）
 
-三场景分流（agent 按 script.md 实际内容判断走哪条）：
+四场景分流（agent 按 script.md 实际内容判断走哪条）：
 
   A. 人物对话 → 声画同出
      aigc-video-gen i2v 渲染时人物对白自带语音，不单独做 TTS。
@@ -17,7 +17,7 @@
   B. 旁白 → 一次性 TTS + ASR 对齐
      1. agent 把整片旁白词写好，一次性 TTS 生成 audio/narration.mp3
         （保证语音一致性，不要分段生成）
-     2. 跑 narration-align（Stage 11b）：
+     2. 跑 narration-align（Stage 11）：
         python3 scripts/narration-align.py <project_dir>
         → 调火山 ASR 极速版对 narration.mp3 转写，输出
         audio/narration-segments.json（utterance 级真实时间戳，秒）
@@ -30,7 +30,12 @@
        - pexels-footage / pixabay-footage 搜 background music
        - 静音占位（无 BGM 需求时）
 
-混合场景：A+B+C、B+C、A+C 均可能，agent 按 script.md 判断。
+  D. 甲方口播录音 → ASR 时间戳 → 按时间戳补素材
+     1. 甲方口播录音落 audio/voiceover.<ext>（Brief 给绝对路径；文案落稿锁定，不重写）
+     2. 跑 narration-align 拿 utterance 级真实时间戳
+     3. agent 拿时间戳按句排素材，assemble 时混入；不重配旁白
+
+混合场景：A/B/C/D 任意组合均可能，agent 按 script.md 与 Brief 判断。
 """
 
 import argparse
@@ -61,7 +66,7 @@ def main() -> None:
 
     print(f"[done] audio/ 目录已建 + subtitles.srt 模板已落")
     print()
-    print("=== 配音配乐三场景分流（agent 按 script.md 判断走哪条）===")
+    print("=== 配音配乐四场景分流（agent 按 script.md 判断走哪条）===")
     print()
     print("A. 人物对话 → 声画同出")
     print("   aigc-video-gen i2v 渲染时人物对白自带语音，不单独做 TTS。")
@@ -73,7 +78,7 @@ def main() -> None:
     print("      调 awk-tts 时加 --enable-subtitle，火山单向流式 HTTP 原生返回")
     print("      字级时间戳（sentence.words 带 startTime/endTime，秒），")
     print("      awk-tts 自动落盘 audio/narration.subtitle.json")
-    print("   2. 跑 narration-align（Stage 11b）：")
+    print("   2. 跑 narration-align（Stage 11）：")
     print("        python3 scripts/narration-align.py <project_dir>")
     print("      → 优先复用 narration.subtitle.json（TTS 原生字级时间戳，零额外调用）")
     print("      → 缺失时回退火山 ASR 极速版转写 narration.mp3")
@@ -87,10 +92,10 @@ def main() -> None:
     print("     - pexels-footage / pixabay-footage 搜 background music")
     print("     - 静音占位（无 BGM 需求时）")
     print()
-    print("混合场景：A+B+C、B+C、A+C 均可能，agent 按 script.md 判断。")
+    print("混合场景：A/B/C/D 任意组合均可能，agent 按 script.md 与 Brief 判断。")
     print()
-    print("D. 用户口播录音 → ASR 时间戳 → 按时间戳补素材")
-    print("   1. agent 把用户给的口播录音落 audio/voiceover.<ext>")
+    print("D. 甲方口播录音 → ASR 时间戳 → 按时间戳补素材")
+    print("   1. agent 把甲方给的口播录音落 audio/voiceover.<ext>（Brief 给绝对路径；文案落稿锁定，不重写）")
     print("   2. 调火山 ASR 极速版转写口播录音，拿 utterance 级真实时间戳")
     print("      （凭据复用 viral-chaser 同池 VOLC_ASR_*，与 narration-align 回退路径同一接口）")
     print("   3. agent 按时间戳把口播内容切成段，每段对应一个 shot 时长区间")
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/narration-align.py` (modified, +3/-3)
```diff
@@ -1,10 +1,10 @@
 #!/usr/bin/env python3
-"""Stage 11b — narration-align：旁白时间戳对齐。
+"""Stage 11 — narration-align：旁白时间戳对齐。
 
 Usage:
   python3 scripts/narration-align.py <project_dir>
 
-入：project_dir/audio/narration.mp3（Stage 11a 一次性 TTS 生成的整段旁白）
+入：project_dir/audio/narration.mp3（Stage 11 场景 B 一次性 TTS 生成的整段旁白）
     + project_dir/audio/narration.subtitle.json（awk-tts --enable-subtitle 落盘的 TTS 原生字级时间戳，优先复用）
 出：project_dir/audio/narration-segments.json
     {
@@ -153,7 +153,7 @@ def fallback_asr(narration: Path, out_path: Path) -> None:
 def main() -> None:
     load_env_file()
 
-    parser = argparse.ArgumentParser(description="Stage 11b narration-align")
+    parser = argparse.ArgumentParser(description="Stage 11 narration-align")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     parser.add_argument(
         "--audio",
```

**File**: `crews/content-producer/skills/expert-video/tools/video-producer/scripts/script-self-eval.py` (modified, +6/-6)
```diff
@@ -1,10 +1,10 @@
 #!/usr/bin/env python3
-"""Stage 3b — script-self-eval：剧本自评 N 维打分，任一维 <3 必返工。
+"""Stage 2 — script-self-eval：剧本自评 N 维打分，任一维 <3 必返工。
 
 Usage:
   python3 scripts/script-self-eval.py <project_dir>
 
-入：project_dir/script/script.md（Stage 3）
+入：project_dir/script/script.md（Stage 1）
 出：project_dir/script/self-eval.json（N 维分 1–5 + 总评 + 是否必返工）
 
 N 维（硬约束五条）：
@@ -38,14 +38,14 @@ def die(msg: str) -> None:
 
 
 def main() -> None:
-    parser = argparse.ArgumentParser(description="Stage 3b script-self-eval")
+    parser = argparse.ArgumentParser(description="Stage 2 script-self-eval")
     parser.add_argument("project_dir", help="项目目录（CP 自建工作区 output_videos/<topic-en-slug>/）")
     args = parser.parse_args()
 
     project = Path(args.project_dir).resolve()
     script_path = project / "script" / "script.md"
     if not script_path.is_file():
-        die(f"前置缺失: script.md 不存在，先跑 script-write（Stage 3）")
+        die(f"前置缺失: script.md 不存在，先跑 script-write（Stage 1）")
 
     eval_path = project / "script" / "self-eval.json"
     eval_path.parent.mkdir(parents=True, exist_ok=True)
@@ -58,7 +58,7 @@ def main() -> None:
         return
 
     stub = {
-        "stage": "3b",
+        "stage": "2",
         "dims": [
             {"key": k, "name": n, "criteria": c, "score": None, "note": ""}
             for k, n, c in EVAL_DIMS
@@ -69,7 +69,7 @@ def main() -> None:
     }
     eval_path.write_text(json.dumps(stub, ensure_ascii=False, indent=2), encoding="utf-8")
     print(f"[done] self-eval.json 模板已落：{eval_path}")
-    print(f"[next] agent 逐维打分 → 任一维 <3 必返工 → 全维 ≥3 跑 storyboard-build（Stage 4）")
+    print(f"[next] agent 逐维打分 → 任一维 <3 必返工 → 全维 ≥3 跑 storyboard-build（Stage 3）")
 
 
 if __name__ == "__main__":
```

---

### Incident Patch 7: `29ed864e` (2026-09-15)
**Commit Message**: fix(expert-xhs): xhs-publish body 字面量 \n 发布前归一化为真实换行

采纳 skill-workshop 提案 xhs-publish-body-newline-normalize-20260915：
agent 在 bash 双引号里传 --body 时 \n 是字面量「反斜杠+n」，脚本原样
透传 desc 导致小红书正文全是 \n 文本（09-15 实发事故）。

- publish_xhs.py：新增 normalize_body_newlines()，main() 在长度校验 /
  extract_topics 之前归一化（字面量 \n 占 2 字符先归一再校验才准；
  紧贴 #话题 的字面量 \n 非空白，会污染话题名分词）；\r\n 先于 \n
  替换避免残留字面量 \r
- SKILL.md：--body 换行传参规范（✅ 多行字符串 / $'...'，❌ 双引号
  字面量 \n），紧邻既有 --body 禁传路径警告
- 新增 test_publish_xhs.py：6 个回归测试（归一化语义 ×4 + 话题提取
  顺序 ×1 + main() 接线端到端 ×1），全部通过

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/SKILL.md` (modified, +14/-0)
```diff
@@ -84,6 +84,20 @@ xhs-publish --mode video --title "笔记标题" --body "正文内容" --video vi
 
 > **⚠️ `--body` 必须传实际文字，不能传文件路径或 `$(cat file)`**：exec sandbox 禁用 `$(...)` 命令替换，`--body post.md` 也会被当字面量字符串。把正文直接硬编码进命令。
 
+> **⚠️ `--body` 换行用真实换行，不要在双引号里写 `\n`**：bash 双引号内的 `\n` 是字面量「反斜杠+n」，发布后正文会全是 `\n` 文本。脚本已兜底把字面量 `\n` 自动归一化为真实换行，但传参仍首选真换行：
+>
+> ```bash
+> # ✅ 多行字符串：引号内直接回车换行
+> xhs-publish --mode image --title "标题" --body "第一行
+> 第二行" --images img.jpg
+>
+> # ✅ $'...' 转义：\n 被 bash 解释为真实换行
+> xhs-publish --mode image --title "标题" --body $'第一行\n第二行' --images img.jpg
+>
+> # ❌ 普通双引号里的 \n 是字面量，发布后正文全是 \n 文本
+> xhs-publish --mode image --title "标题" --body "第一行\n第二行" --images img.jpg
+> ```
+
 成功输出：
 
 ```json
```

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/scripts/publish_xhs.py` (modified, +14/-0)
```diff
@@ -132,6 +132,16 @@ def cookie_str(cookie_dict: dict) -> str:
     return "; ".join(f"{k}={v}" for k, v in cookie_dict.items())
 
 
+def normalize_body_newlines(body: str) -> str:
+    r"""把 body 里字面量 \n / \r\n（反斜杠+字母序列）归一化为真实换行。
+
+    Agent 在 bash 双引号里传 --body 时，引号内 \n 是字面量「反斜杠+n」而非真实换行，
+    原样透传会被小红书当普通文本展示，正文全是 \n 文本。
+    先替换 \r\n 再替换 \n，避免残留字面量 \r；已是真实换行的内容不受影响。
+    """
+    return body.replace("\\r\\n", "\n").replace("\\n", "\n")
+
+
 def extract_topics(body: str, extra_topics: list[str] | None = None) -> list[dict]:
     """Extract #话题 from body text, return AiToEarn-format hash_tag list.
 
@@ -717,6 +727,10 @@ def main() -> None:
     parser.add_argument("--cookie-file", type=Path, help="Cookie file path")
     args = parser.parse_args()
 
+    # 字面量 \n 归一化须在长度校验 / 话题提取之前：字面量 \n 占 2 字符，先归一化长度才准；
+    # 且紧贴 #话题 的 \n（非空白字符）会污染 extract_topics 的分词
+    args.body = normalize_body_newlines(args.body)
+
     if len(args.title) > 20:
         err_exit("TITLE_TOO_LONG: title exceeds 20 characters")
     if len(args.body) > 1000:
```

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/scripts/test_publish_xhs.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+"""Regression tests for publish_xhs body newline normalization."""
+
+from __future__ import annotations
+
+import importlib.util
+import io
+import sys
+import unittest
+from pathlib import Path
+from unittest import mock
+
+
+SCRIPT_PATH = Path(__file__).with_name("publish_xhs.py")
+SPEC = importlib.util.spec_from_file_location("publish_xhs", SCRIPT_PATH)
+assert SPEC and SPEC.loader
+publish_xhs = importlib.util.module_from_spec(SPEC)
+SPEC.loader.exec_module(publish_xhs)
+
+
+class NormalizeBodyNewlinesTests(unittest.TestCase):
+    def test_converts_literal_backslash_n_to_real_newline(self) -> None:
+        # bash 双引号里 --body "第一行\n第二行" 收到的就是字面量反斜杠+n
+        self.assertEqual(
+            publish_xhs.normalize_body_newlines("第一行\\n第二行"),
+            "第一行\n第二行",
+        )
+
+    def test_converts_literal_crlf_without_leaving_stray_cr(self) -> None:
+        self.assertEqual(publish_xhs.normalize_body_newlines("a\\r\\nb"), "a\nb")
+
+    def test_keeps_real_newlines_untouched(self) -> None:
+        self.assertEqual(publish_xhs.normalize_body_newlines("a\nb"), "a\nb")
+
+    def test_handles_mixed_literal_and_real_newlines(self) -> None:
+        self.assertEqual(publish_xhs.normalize_body_newlines("a\nb\\nc"), "a\nb\nc")
+
+    def test_normalizing_before_extraction_keeps_topic_names_clean(self) -> None:
+        # 字面量 \n 是非空白字符：不先归一化，extract_topics 会把 "职场\n第二行" 整个当话题名
+        raw = "#职场\\n第二行正文"
+        topics = publish_xhs.extract_topics(
+            publish_xhs.normalize_body_newlines(raw), None
+        )
+        self.assertEqual([t["name"] for t in topics], ["职场"])
+
+
+class MainBodyNormalizationTests(unittest.TestCase):
+    def test_main_publishes_body_with_real_newlines(self) -> None:
+        # 端到端守住 main() 的接线：字面量 \n 的 --body 到达发布函数时已是真实换行
+        argv = [
+            "publish_xhs.py",
+            "--mode", "image",
+            "--title", "标题",
+            "--body", "第一行\\n第二行",
+            "--images", "img.jpg",
+        ]
+        captured: dict = {}
+
+        def fake_publish(client, cookie_dict, ua, title, body, images, topics, private):
+            captured["body"] = body
+            return {"ok": True, "note_id": "x", "url": "u"}
+
+        with (
+            mock.patch.object(sys, "argv", argv),
+            mock.patch.object(publish_xhs, "load_cookies", return_value=({}, "UA")),
+            mock.patch.object(publish_xhs, "publish_image_note", side_effect=fake_publish),
+            mock.patch.object(sys, "stdout", new=io.StringIO()),
+        ):
+            publish_xhs.main()
+
+        self.assertEqual(captured["body"], "第一行\n第二行")
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 8: `b8882691` (2026-09-14)
**Commit Message**: fix(skills): publish_xhs.py _shared 路径解析——适配 D8 拆分后的嵌套布局

旧写法 parent×3 按拆分前 skills/xhs-publish/scripts/ 布局上溯到 skills/，
拆分后（skills/expert-xhs/tools/xhs-publish/scripts/）只到 tools/，
relay_sign import 落空。改 parents[4] 精确解析到 skills/_shared。
2026-09-14 小红书实际发布验证通过；备份文件（与 HEAD 一致）已清理。

**File**: `crews/main/skills/expert-xhs/tools/xhs-publish/scripts/publish_xhs.py` (modified, +3/-2)
```diff
@@ -16,8 +16,9 @@
 
 import requests
 
-# relay_sign 在 skills/_shared/，本脚本在 skills/xhs-publish/scripts/
-sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "_shared"))
+# relay_sign 在 skills/_shared/，本脚本在 skills/expert-xhs/tools/xhs-publish/scripts/
+# 向上 5 层（parents[4]）解析到 skills/，再拼 _shared
+sys.path.insert(0, str(Path(__file__).resolve().parents[4] / "_shared"))
 from relay_sign import xhs_headers  # noqa: E402
 
 LOGINS_DIR = Path.home() / ".openclaw" / "logins"
```

---

### Incident Patch 9: `aa1ba0d1` (2026-09-13)
**Commit Message**: fix(skills): twitter-post CJK 输入安全闸门 + 视频号登录对齐无头截 QR

twitter-post：CJK 正文禁用 type（逐字符按键流与 X Draft.js 异步处理竞态，
实测中文丢字+乱序），改 eval + execCommand insertText 整段插入；新增发布前
MATCH 校验闸门与发布后 profile 终验；「Something went wrong」先过闸门判因
（MISMATCH 重插 / MATCH 瞬时错误重试），替换原「优先精简正文」误判。含草稿
回填重复、占位符假警报、emoji 渲染为 img 三个坑。
expert-bd comment-engagement：X 评论同套 CJK 禁 type 规则，复用 twitter-post 闸门
browser-guide：微信视频号与公众号同模式无头截 QR 发用户扫码登录，渲染失败才
--headed 兜底；连带修正 docs 两处 spec 的旧说法

**File**: `crews/main/skills/expert-bd/workflows/comment-engagement.md` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
 
 ### Step 3: 逐内容互动
 
-对每个搜索到的内容，按配置的互动策略执行。通用要求：输入使用 `type` + `slowly: true`，不要用 `fill()`。
+对每个搜索到的内容，按配置的互动策略执行。通用要求：输入使用 `type` + `slowly: true`，不要用 `fill()`。**X/Twitter 例外**：评论/回复含中文/日文/韩文时**禁用 `type`**（camoufox-cli `type` 逐字符按键流与 X Draft.js 异步处理竞态，中文实测丢字+乱序）——按 `expert-twitter/tools/twitter-post/SKILL.md`「CJK 正文输入与校验闸门」改用 eval + `document.execCommand("insertText")` + 发布前校验 MATCH。X 回复应走平台表中 `twitter-post` Reply workflow，同样适用该闸门。
 
 #### 策略 A：直接留言（direct_comment）
 
```

**File**: `crews/main/skills/expert-twitter/tools/twitter-post/SKILL.md` (modified, +49/-16)
```diff
@@ -51,7 +51,35 @@ camoufox-cli --session twitter --persistent --headed --json open "https://x.com/
 ## 通用约束
 
 - 文件上传用 forked camoufox-cli 的 `upload` 命令（`camoufox-cli --session <s> --persistent --json upload <ref> <file>`，底层 Playwright `setInputFiles`，无需 DataTransfer hack）
-- 正文输入使用 `type` + `slowly: true`，不要用 `fill()`
+- 正文输入：**CJK（中文/日文/韩文）内容禁用 `type` 命令**——camoufox-cli `type` 逐字符按键流与 X 编辑器（Draft.js）异步处理存在竞态，中文实测丢字+乱序（2026-09-13 事故，首字被挪到结尾、中段整段消失，含分段 type+停顿仍错乱）。CJK 正文一律走下方「CJK 正文输入与校验闸门」的 eval + `document.execCommand("insertText")` 整段插入；纯 ASCII 短文本仍可用 `type`。**不要用 `fill()`**
+
+### CJK 正文输入与校验闸门
+
+含中文 / 日文 / 韩文的正文必须走本节的 insertText 方案 + 校验闸门；纯 ASCII 短文本可用 `type`，但**发布前校验闸门**与**发布后终验**对**所有正文**强制执行。
+
+**1. 清空回填草稿（open compose 后必做）**：X 重新打开 compose 页可能回填上次草稿，直接 insertText 会叠成两份：
+
+```bash
+camoufox-cli --session twitter --json eval '(function(){var el=document.querySelector("[data-testid=tweetTextarea_0]");if(!el){return "NO_BOX";}el.focus();var s=document.execCommand("selectAll",false);var d=document.execCommand("delete",false);return (s&&d)?"CLEARED":"CLEAR_FAILED";})()'
+```
+
+**2. 插入正文**（CJK 用 insertText 整段插入；正文含单引号或反斜杠时先转义，避免破坏命令引号）：
+
+```bash
+camoufox-cli --session twitter --json eval '(function(){var el=document.querySelector("[data-testid=tweetTextarea_0]");if(!el){return "NO_BOX";}el.focus();var ok=document.execCommand("insertText",false,"<正文>");return ok?"INSERTED":"EXEC_FAILED";})()'
+```
+
+**3. 发布前校验闸门（强制——点击 Post / Reply 之前必须执行，非 MATCH 一律不发布）**：
+
+```bash
+camoufox-cli --session twitter --json eval '(function(){var el=document.querySelector("[data-testid=tweetTextarea_0]");var t=el?el.innerText:"NO_BOX";var target="<正文>";return t===target?"MATCH":"MISMATCH:"+t;})()'
+```
+
+- **选择器必须精确匹配 `[data-testid=tweetTextarea_0]`**——`[data-testid^=tweetTextarea]` 前缀匹配会同时命中 `tweetTextarea_0_label`（占位符层），读到占位符文本、误报 MISMATCH。
+- **插入与校验必须分两次 eval 调用（间隔 ≥1s）**——写在同一 eval 里同步执行时，React 未及重渲染，innerText 会混入「What's happening?」占位符（占位符假警报）。MISMATCH 先看是否混有占位符再定性。
+- **emoji 是 `<img>` 不是丢字**：✅ 等 emoji 在 DOM 里渲染为 `<img>`，`innerText` 提取时只显示周围空格——校验按「剔除 img 节点后的文本」比对。
+
+**4. 发布后终验（强化，所有发布流程共用）**：点 Post 后导航 profile 页，读最新推文 `[data-testid=tweetText]` innerText 与 status 链接，与目标正文比对（剔除 emoji img 因素）后才算发布成功；不符立即走删除流程（More → Delete → confirmationSheetConfirm）。
 
 ### 字符计数规则（X 平台特殊）
 
@@ -88,22 +116,24 @@ camoufox-cli --session twitter --persistent --headed --json open "https://x.com/
 ```
 1. Navigate to https://x.com/compose/post
 2. Wait for the compose box to load
-3. Click into the text area and type the content
+3. 按「通用约束 → CJK 正文输入与校验闸门」输入正文（CJK 走 insertText；纯 ASCII 可 type）
    - Plain text only (no Markdown)
    - Max 280 characters for standard accounts
-4. Verify character count — trim if over limit
-5. **立即点击 "Post" 按钮——不要等待用户确认！**
-6. Wait for success confirmation (URL changes or "Your post was sent" toast)
-7. Extract and report the post URL
-8. **Parse stats**：
+4. **发布前校验闸门**：eval 校验正文返回 MATCH（通用约束 step 3；非 MATCH 一律不发布）
+5. Verify character count — trim if over limit
+6. **立即点击 "Post" 按钮——不要等待用户确认！**
+7. Wait for success confirmation (URL changes or "Your post was sent" toast)
+8. **发布后终验**（通用约束 step 4）：导航 profile 页比对最新推文正文，MATCH 才算发布成功；不符走删除重发
+9. Extract and report the post URL
+10. **Parse stats**：
    - snapshot eval: `JSON.stringify({
        retweet: document.querySelector('[data-testid="retweet"]')?.innerText,
        like: document.querySelector('[data-testid="like"]')?.innerText,
        reply: document.querySelector('[data-testid="reply"]')?.innerText,
        view: document.querySelector('[href*="/analytics"]')?.innerText,
        permalink: window.location.href
      })`
-9. Update frequency tracker
+11. Update frequency tracker
 ```
 
 ---
@@ -115,7 +145,7 @@ camoufox-cli --session twitter --persistent --headed --json open "https://x.com/
 2. Wait for the compose box to load
 3. Upload the image file using camoufox-cli upload（见下方选择器说明）
 4. Wait for image upload to complete (thumbnail / "Media" group appears)
-5. Click into the text area and type the caption
+5. 按「通用约束 → CJK 正文输入与校验闸门」输入 caption（CJK 走 insertText）；**发布前校验闸门**：eval 校验 MATCH 才点 Post（通用约束 step 3）
    - Plain text only (no Markdown)
    - Max 280 characters for standard accounts
 6. **立即点击 "Post" 按钮——不要等待用户确认！**
@@ -145,7 +175,7 @@ camoufox-cli --session twitter --persistent --json upload "[data-testid=fileInpu
 2. Click the media icon
 3. Upload the video file (MP4 recommended, max 512MB, max 2min 20sec)
 4. Wait for video processing — this can take 30–120 seconds or more for larger files. Look for the thumbnail preview to confirm completion.
-5. Click into the caption area and type the caption
+5. 按「通用约束 → CJK 正文输入与校验闸门」输入 caption（CJK 走 insertText）；**发布前校验闸门**：eval 校验 MATCH 才点 Post（通用约束 step 3）
    - Plain text only (no Markdown)
    - Max 280 characters for standard accounts
 6. **立即点击 "Post" 按钮——不要等待用户确认！**
@@ -160,11 +190,11 @@ camoufox-cli --session twitter --persistent --json upload "[data-testid=fileInpu
 
 ```
 1. Navigate
```

**File**: `docs/browser-stack-replacement-spec-2026-07.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@
 | 0 | **全线使用 forked camoufox-cli**，放弃 patchright 的 patch |
 | 1 | 涉及登录的自媒体平台，**每平台一个且只一个持久化 session**，必须顺次使用（fail-first 队列，见 §fork 改造清单） |
 | 2 | browser-guide 约定：需要用户配合过验证码的，**必须用 camoufox-cli 有头模式** |
-| 3 | login-manager 约定：wx-mp 登录可无头启动截图发 QR；**wechat-channel（视频号）/ douyin / twitter / xhs（xhs-publish \| xhs-browse）/ weibo / zhihu / xianyu 登录必须 有头模式**（扫码登录页无法无头截 QR；有头扫码一律 `--viewport 1920x1080` 强制桌面比例，camoufox 默认移动端比例二维码看不全） |
+| 3 | login-manager 约定：wx-mp 与 wechat-channel（视频号）登录可无头启动截图发 QR（2026-09-13 实测视频号无头 QR 可渲染，与 wx-mp 同模式）；douyin / twitter / xhs（xhs-publish \| xhs-browse）/ weibo / zhihu / xianyu 登录仍必须 有头模式（扫码登录页无法无头截 QR；有头扫码一律 `--viewport 1920x1080` 强制桌面比例，camoufox 默认移动端比例二维码看不全） |
 | 4 | login-manager 导出 cookie **同时导出 UA**；所有用中央 cookie 的脚本导入 cookie 同时导入 UA |
 | 5 | **严禁浏览器方案导入 cookie**（登录失效必须重新登录流程，见 §profile 丢失处理） |
 | 6 | 恢复 twitter-interact 脚本操作模式（参考 AiToEarn 上游，见 §twitter-interact） |
@@ -154,7 +154,7 @@ spike 文档 L30-33 已设计：
 | `douyin-publish` | 由脚本方案改为浏览器自动化方案：forked cli 持久化 session `douyin` + upload；有头登录 |
 | `weibo-publish` | forked cli 持久化 session `weibo` + upload；有头登录 |
 | `zhihu-publish` | forked cli 持久化 session `zhihu` + upload；有头登录 |
-| `wechat-channels-publish` | forked cli 持久化 session `wechat-channel` + upload；有头手动扫码登录（`--headed --viewport 1920x1080`，视频号扫码页无法无头截 QR） |
+| `wechat-channels-publish` | forked cli 持久化 session `wechat-channel` + upload；无头截图扫码登录（截 QR PNG 发用户扫码，渲染失败才 `--headed` 兜底） |
 | `viral-chaser` | 适配修改后的login-manager中央cookie格式，尤其是导入Cookie的时候，要同时导入UA。 |
 | `wx-mp-hunter` | 见 §6 收编 |
 | `xianyu-ops` | forked cli 持久化 session `xianyu`；有头登录 |
```

**File**: `docs/platform-login-and-browser-spec.md` (modified, +3/-3)
```diff
@@ -153,9 +153,9 @@ camoufox-cli --session wx_mp --persistent --json identity export ~/.openclaw/log
 
 **其他场景默认走 camoufox 持久化 session，不显式指定有头/无头**——camoufox-cli 默认行为即可（headless 是默认）。
 
-**browser-guide §1-B 那句「wechat-channel / wx-mp 可无头启动截图发 QR；douyin / twitter / xhs / weibo / zhihu / xianyu / reddit / youtube 登录必须有头模式」要改**：
-- wx-mp 那个无头特例只属于 wx-mp-hunter/engagement 的自有体系，不属于 login-manager 体系，不应在 browser-guide 里和 wechat-channel 并列提。
-- wechat-channel（视频号）扫码登录页**无法无头截 QR**，必须 `--headed --viewport 1920x1080` 弹窗手动扫码（同 weibo / xianyu），按现行 wechat-channels-publish 技能自有 SKILL.md 走。
+**browser-guide §1-B 有头/无头规则（2026-09-13 实测修正）**：
+- wx-mp 无头特例只属于 wx-mp-hunter/engagement 的自有体系，不属于 login-manager 体系，browser-guide 里与 wechat-channel 并列标注「按各自专家包约定走无头截 QR」。
+- wechat-channel（视频号）与 wx-mp 同模式：**无头截 QR 发用户扫码**（2026-09-13 实测无头二维码完整渲染可扫；此前「视频号无法无头截 QR、必须 --headed」说法是早期失败残留，同日有头窗口的二维码加载失败实为代理 fake-ip 拦截，与有头/无头模式无关）。按 wechat-channels-publish / wx-channel-engagement 技能自有 SKILL.md 的无头截图扫码登录流走；无头渲染失败才 `--headed` 兜底。
 
 ## 8. published-track 流程 2A·自动更新（定时任务用）取数方案
 
```

**File**: `skills/browser-guide/SKILL.md` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ camoufox-cli --session <name> [--persistent] [--headed] [--json] <command> [args
 
 - **`--session <name>`**：会话隔离单元，同名 session 共享一个 profile 目录。**涉及登录的平台用一个且只用一个持久化 session 名**。
 - **`--persistent`**：冻结指纹到 `~/.camoufox-cli/profiles/<name>/camoufox-cli.json`（首次生成后冻结）。持久化平台 session 必带；临时性 session（新闻等不登录站点）**不带**——走默认临时 profile，每次随机指纹，关闭自清。
-- **`--headed`**：有头模式。**需要用户配合过验证码、扫码、收短信的，或者填表场景，必须 `--headed`**。例外：**微信公众号 wx_mp** 可无头截含二维码区域截图发用户登录；**微信视频号 wechat-channel / 微博 / 闲鱼等扫码登录页无法无头截 QR，必须 `--headed` 弹窗让用户在浏览器里手动扫码**。其他场景，包括探活，都可以使用默认的无头模式。
-- **`--viewport <WxH>`**：固定窗口尺寸，如 `1920x1080`。camoufox 默认按指纹给**移动端窗口比例**，导致有头登录时二维码看不全；有头扫码登录（微博 / 闲鱼 / 视频号等）一律加 `--viewport 1920x1080` 强制桌面比例。业务无头操作无需此 flag。
+- **`--headed`**：有头模式。**需要用户配合过验证码、收短信的，或者填表场景，必须 `--headed`**。例外：**微信公众号 wx_mp 与微信视频号 wechat-channel** 可无头截图二维码发用户远程扫码（按各自专家包约定：截 QR PNG 发用户聊天窗口 → 用户手机扫码 → 轮询 URL 确认登录就位）；无头下二维码渲染失败（等 10s 仍无 QR img、截图空白或「加载失败」）才 teardown 换 `--headed` 弹窗兜底。**微博 / 闲鱼等扫码登录页维持必须 `--headed`** 弹窗让用户在浏览器里手动扫码。其他场景，包括探活，都可以使用默认的无头模式。
+- **`--viewport <WxH>`**：固定窗口尺寸，如 `1920x1080`。camoufox 默认按指纹给**移动端窗口比例**，导致有头登录时二维码看不全；`--headed` 兜底扫码登录（微博 / 闲鱼等）或窗口内容看不全时加 `--viewport 1920x1080` 强制桌面比例。业务无头操作无需此 flag。
 - **`--json`**：命令输出走 JSON 信封（`{ok, ...}` / `{error, ...}`），agent 解析稳定，推荐常带。
 - 命令集（含 `upload` / `identity export`）：
   `open / back / forward / reload / url / title / close / snapshot / click / fill / type / select / check / hover / press / text / eval / screenshot / pdf / scroll / wait / tabs / switch / close-tab / sessions / cookies / install / upload / identity`
```

---

### Incident Patch 10: `58edf56a` (2026-09-13)
**Commit Message**: fix(scripts): pnpm 版本守卫——对齐 openclaw 工作区 pin (pnpm 11)

pnpm 10.x 的 install CLI 不认 --fetch-retries（apply-addons.sh 依赖同步
直接 unknown argument 炸掉），新机装了 10.30.2 且 update.sh 零预检、
install.sh 的 install_pnpm() 只判断存在即跳过，报错完全没指向真因。

- update.sh: 步骤 1.5 加 pnpm 大版本预检（读 openclaw/package.json 的
  packageManager pin），缺失/过低给出明确升级命令；版本探测在 / 下做，
  避开 pnpm ≥11 manage-package-manager-versions 在带 pin 目录返回假版本
- install.sh: 定义 PNPM_VERSION（此前从未定义，真走到安装分支会执行
  npm install -g pnpm@ 空版本）；install_pnpm() 加 major 守卫，低于
  要求版本时升级而非跳过
- package.json: packageManager 从 4 月遗留的 10.30.2 对齐 11.2.2
  （hash 与 openclaw/package.json 同版本 pin 一致）

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 {
-  "packageManager": "pnpm@10.30.2+sha512.36cdc707e7b7940a988c9c1ecf88d084f8514b5c3f085f53a2e244c2921d3b2545bc20dd4ebe1fc245feec463bb298aecea7a63ed1f7680b877dc6379d8d0cb4"
+  "packageManager": "pnpm@11.2.2+sha512.36e6621fad506178936455e70247b8808ef4ec25797a9f437a93281a020484e2607f6a469a22e982987c3dbb8866e3071514ab10a4a1749e06edcd1ec118436f"
 }
```

**File**: `scripts/install.sh` (modified, +22/-3)
```diff
@@ -929,12 +929,31 @@ install_git() {
 # ═══════════════════════════════════════════════════════════════════
 # pnpm
 # ═══════════════════════════════════════════════════════════════════
+# 与 openclaw/package.json 的 packageManager pin 保持同步（apply-addons.sh 的依赖
+# 同步用了 pnpm 11 的 install CLI flags——如 --fetch-retries，pnpm 10.x 不认会炸）。
+# 升级 openclaw 换 pin 时此处要跟着改。
+PNPM_VERSION="${OPENCLAW_PNPM_VERSION:-11.2.2}"
+
+# 在无 packageManager pin 的目录下探测 pnpm 真实安装版本。
+# pnpm ≥11 默认开 manage-package-manager-versions，在带 pin 的目录里
+# `pnpm --version` 返回 pin 版本而非实际安装的版本，版本判断会被骗。
+pnpm_real_version() {
+    (cd / && pnpm --version 2>/dev/null) || true
+}
+
 install_pnpm() {
-    if command -v pnpm >/dev/null 2>&1; then
-        ui_success "pnpm already installed ($(pnpm --version 2>/dev/null || echo unknown))"
+    local required_major installed_major
+    required_major="${PNPM_VERSION%%.*}"
+    installed_major="$(pnpm_real_version | cut -d. -f1)"
+    if command -v pnpm >/dev/null 2>&1 && [ "${installed_major:-0}" -ge "$required_major" ]; then
+        ui_success "pnpm already installed ($(pnpm_real_version || echo unknown))"
         return 0
     fi
-    ui_info "Installing pnpm@${PNPM_VERSION} globally"
+    if command -v pnpm >/dev/null 2>&1; then
+        ui_info "Upgrading pnpm to ${PNPM_VERSION} (found $(pnpm_real_version || echo unknown); openclaw 工作区需要 pnpm ${required_major}+)"
+    else
+        ui_info "Installing pnpm@${PNPM_VERSION} globally"
+    fi
     # 用 corepack 路线（与 openclaw 仓 packageManager 对齐，最稳）
     if command -v corepack >/dev/null 2>&1; then
         run_required_step "Enabling corepack" corepack enable
```

**File**: `scripts/update.sh` (modified, +20/-0)
```diff
@@ -85,6 +85,26 @@ if [ ! -f "$PROJECT_ROOT/scripts/apply-addons.sh" ] || [ ! -d "$OPENCLAW_DIR" ];
   exit 1
 fi
 
+# ─── 1.5 pnpm 版本预检 ────────────────────────────────────────────────
+# openclaw 工作区按其 package.json 的 packageManager pin 要求 pnpm 大版本：
+# apply-addons.sh 的依赖同步传了 --fetch-retries 等 flag，只有 pnpm 11 的
+# install CLI 才认（pnpm 10.x 直接 unknown argument 炸掉）。
+# 注意 pnpm ≥11 默认开 manage-package-manager-versions，在带 pin 的目录里
+# `pnpm --version` 返回 pin 版本而非实际安装版本，须在无 pin 的 / 下探测。
+REQUIRED_PNPM_MAJOR="$(grep -m1 '"packageManager"' "$OPENCLAW_DIR/package.json" 2>/dev/null | grep -o 'pnpm@[0-9.]*' | head -1 | sed 's/^pnpm@//; s/\..*//')"
+: "${REQUIRED_PNPM_MAJOR:=11}"
+if ! command -v pnpm >/dev/null 2>&1; then
+  echo "❌ pnpm 未安装（openclaw 工作区需要 pnpm ${REQUIRED_PNPM_MAJOR}.x+）"
+  echo "   安装：npm install -g pnpm@${REQUIRED_PNPM_MAJOR} --registry=https://registry.npmmirror.com"
+  exit 1
+fi
+INSTALLED_PNPM_MAJOR="$( (cd / && pnpm --version 2>/dev/null) | cut -d. -f1)"
+if [ "${INSTALLED_PNPM_MAJOR:-0}" -lt "$REQUIRED_PNPM_MAJOR" ]; then
+  echo "❌ pnpm ${REQUIRED_PNPM_MAJOR}.x+ required (openclaw/package.json packageManager pin), found $(cd / && pnpm --version 2>/dev/null || echo unknown)"
+  echo "   升级：npm install -g pnpm@${REQUIRED_PNPM_MAJOR} --registry=https://registry.npmmirror.com"
+  exit 1
+fi
+
 ensure_openclaw_config() {
   if [ ! -f "$OPENCLAW_CONFIG_PATH" ]; then
     mkdir -p "$(dirname "$OPENCLAW_CONFIG_PATH")"
```

---

### Incident Patch 11: `73f66773` (2026-09-12)
**Commit Message**: fix(install): Windows ps1 补齐 openclaw-weixin 按版本比对升级逻辑

b1b7cb5 只改了 install.sh / install-atomgit.sh / docker-bootstrap.sh 三处 shell
实现，scripts/install.ps1 与 scripts/install-atomgit.ps1 的 Install-WeixinPlugin
仍是旧逻辑（plugins list 匹配到插件名即 return），pin bump（2.4.6 -> 2.4.8）后
Windows 老用户重跑安装器永远停在旧版。

改动（两文件同一份）:
- 新增 Get-WeixinInstalledVersion：主路径 `plugins list --json` 取
  id/name/version（stdout-only 捕获，沿用 Capture-Streamed 的 EAP Continue 模式
  规避 PS 5.1 NativeCommandError）；回落 $OPENCLAW_HOME\npm\projects\*\
  node_modules\<pkg>\package.json glob——与 bash 版 weixin_installed_version()
  逐分支对齐
- Install-WeixinPlugin 判定：已装 == pin -> 跳过；!= pin -> --force 升级；
  插件在但版本读不到 -> --force 按 pin 重装；失败提示同步带 --force
- 头部步骤注释补版本幂等说明
- ps1 侧无 vendor/bundled-tarball 路径（068f87e 的 update.sh 修法无 Windows
  对应物；Windows 升级即重跑安装器，更新路线装完后有 gateway restart 生效）

验证（便携 pwsh 7.6.6，Linux 侧）:
- Parser::ParseFile 两脚本 0 错误；新增块两文件逐字节一致；UTF-8 无 BOM +
  CRLF 保持不变；只用 PS 3.0+ 语法，5.1 兼容
- AST 抽取真实函数 + 假 openclaw 命令跑 6 场景全过：裸装（无 --force）/
  同版跳过（零安装调用）/ 2.4.6->2.4.8 --force 升级 / JSON 损坏走 glob 回落 /
  版本读不到走 --force 重装 / stderr 噪音不污染 JSON 主路径

顺带合入（48818d8 删除 swcr-register 后的引用清理，同批工作区改动）:
- expert-ir SKILL.md + workflows/project-applic

**File**: `crews/main/skills/expert-ir/SKILL.md` (modified, +5/-4)
```diff
@@ -1,6 +1,6 @@
 ---
 name: expert-ir
-description: 投资人关系（IR）专家。承接投资人发掘、融资沟通流水线（状态机跟进）、项目申报（认定/补贴/大赛/资质）的完整工作。零散的投资人记录、进展查询等操作也可以直接做。不涉及商务获客（找客户/“截流”/商业情报走 expert-bd）。
+description: 投资人关系（IR）专家。承接投资人发掘、融资沟通流水线（状态机跟进）、项目申报（认定/补贴/大赛）的完整工作。零散的投资人记录、进展查询等操作也可以直接做。不涉及商务获客（找客户/“截流”/商业情报走 expert-bd）。
 metadata:
   openclaw:
     emoji: 📈
@@ -18,7 +18,7 @@ metadata:
 | 融资材料 | Investor Materials | Pitch Deck / One-Pager / 投资人备忘录 / 财务模型 / 加速器申请材料 |
 | 投资人触达 | Investor Outreach | 冷邮件、暖介绍请求、跟进邮件、投资人更新等沟通文案 |
 | 融资流水线 | Investor Pipeline | 完整的融资沟通编排：发掘 → 材料 → 触达 → 跟进 → 状态机推进 |
-| 项目申报 | Project Application | 高企认定 / 加速器申请 / 政府补贴 / 软著商标专利配套 / 行业奖项：材料准备 + 时间线 + 状态跟踪 |
+| 项目申报 | Project Application | 高企认定 / 加速器申请 / 政府补贴 / 行业奖项：材料准备 + 时间线 + 状态跟踪 |
 
 ## 执行方式与定时任务
 
@@ -41,7 +41,7 @@ metadata:
 |------|------|------|
 | `ir-record` | 投资人档案 / 接触历史 / 项目申报数据库（状态机数据层） | `ir-record` |
 
-跨领域通用技能：`smart-search`（构造搜索 URL）、`browser-guide`（浏览器操作）、`email-ops`（邮件发送）、`market-research`（基金/竞品尽调）、`pitch-deck`（HTML 路演材料）、`council`（商业模式多视角复盘）、`swcr-register`（软著材料生成）。
+跨领域通用技能：`smart-search`（构造搜索 URL）、`browser-guide`（浏览器操作）、`email-ops`（邮件发送）、`market-research`（基金/竞品尽调）、`pitch-deck`（HTML 路演材料）、`council`（商业模式多视角复盘）。
 
 ## 数据与记录
 
@@ -54,7 +54,8 @@ metadata:
 ## 边界
 
 - 商业模式打磨（融资前的电梯版梳理 / 5 问结构化）：由 agent 结合 `business_knowledge.md` 直接与用户完成，多路径权衡用 `council`；打磨结论落 `MEMORY.md` 后才进入投资人接触。
-- 项目申报 / 补贴 / 创业大赛 → 包内 Project Application Workflow（数据落 `ir-record` 的 applications 表）；软著材料生成走顶层技能 `swcr-register`。
+- 项目申报 / 补贴 / 创业大赛 → 包内 Project Application Workflow（数据落 `ir-record` 的 applications 表）。
+- 软著 / 商标 / 专利等知识产权申报：不在职责范围，不承接。
 - 商务获客（找客户 / 评论区 / 情报）→ `expert-bd`。
 
 ## 红线
```

**File**: `crews/main/skills/expert-ir/workflows/project-application.md` (modified, +5/-9)
```diff
@@ -1,8 +1,10 @@
 # Project Application（项目申报）
 
-帮用户准备、跟踪各类外部申报项目：高新技术企业认定、加速器申请、政府补贴、资质认证（软著 / 商标 / 专利配套）、行业奖项。涵盖材料生成 + 时间线管理 + 状态跟踪。
+帮用户准备、跟踪各类外部申报项目：高新技术企业认定、加速器申请、政府补贴、行业奖项。涵盖材料生成 + 时间线管理 + 状态跟踪。
 
-**依赖**：`swcr-register`（软著材料）、`market-research`（行业数据 / 竞品分析）、Investor Materials Workflow（BP / One-Pager）、`ir-record`（applications 表状态跟踪）。
+软著 / 商标 / 专利等知识产权申报不在本 workflow 范围，不承接。
+
+**依赖**：`market-research`（行业数据 / 竞品分析）、Investor Materials Workflow（BP / One-Pager）、`ir-record`（applications 表状态跟踪）。
 
 ## 适用场景
 
@@ -11,18 +13,15 @@
 - "我想申请高新技术企业认定 / 专精特新 / 科技型中小企业"
 - "我看到 X 加速器在招创业团队，能帮我准备申请吗"
 - "政府有 Y 补贴项目，截止日期 Z，能帮我看下材料吗"
-- "我想申请软著 / 商标 / 专利"
 - "我要申报 X 行业奖项"
 
 ## 常见申报类型
 
 | 类型 | 典型材料 | 材料协作 |
 |------|---------|---------|
-| 高新技术企业认定 | 知识产权 + 研发费用 + 人员名单 + 财务审计 | `swcr-register` + `market-research` |
+| 高新技术企业认定 | 知识产权 + 研发费用 + 人员名单 + 财务审计 | `market-research` |
 | 加速器申请 | BP + One-Pager + 团队介绍 + 牵引数据 | Investor Materials Workflow（包内） |
 | 政府补贴 | 申报书 + 财务报表 + 项目实施方案 | `market-research`（行业数据）|
-| 软著登记 | 源程序文档 + 操作手册 | `swcr-register` |
-| 商标 / 专利 | 技术交底书 + 权利要求书 | 直接走，不委派 |
 | 行业奖项 | 案例描述 + 客户证言 + 量化数据 | `market-research`（行业 baseline）|
 
 ---
@@ -44,7 +43,6 @@
 
 | 材料 | 委派给 |
 |------|--------|
-| 软著材料（源程序 + 操作手册）| `swcr-register` |
 | 行业市场数据 / 竞品分析 | `market-research` |
 | BP / One-Pager | Investor Materials Workflow（包内） |
 
@@ -83,7 +81,6 @@ ir-record update-application --id <rowid> --status <new>
 
 ## 与其他环节的关系
 
-- **`swcr-register`**（顶层技能）：软著专用（频繁需要的子材料，合规性边界）
 - **`market-research`**（顶层技能）：行业数据（多个申报类型需要）
 - **Investor Materials Workflow**（包内）：加速器申请等需要 BP / One-Pager
 - **商业模式打磨**（IR 模式 1）：申报前先打磨商业模式（很多申报材料要先有清晰的商业故事）
@@ -111,6 +108,5 @@ ir-record update-application --id <rowid> --status <new>
 
 ## Notes
 
-- 软著 / 商标 / 专利的"材料生成"严格走 `swcr-register` skill（合规性边界）
 - 财务审计报告、税务证明等"硬材料"由用户/会计师提供，AI 不替生成
 - 申报通过率不承诺，AI 只保证材料齐整 / 表达清晰 / 时间线追踪
```

**File**: `docs/d21-symlink-skill.md` (modified, +4/-2)
```diff
@@ -160,7 +160,7 @@ login-manager check douyin   # wrapper 在 PATH 中
 | sales-cs-enablement | scripts/symlink_business_knowledge.py | wrapper → py（2026-08-27 转子命令分发器：`link` / `check-channel`，随 sales-cs-manager 专家包收纳至 `crews/main/skills/sales-cs-manager/tools/sales-cs-enablement/`） |
 | sales-cs-review | scripts/scan_feedback.py | wrapper → py（2026-08-27 随 sales-cs-manager 专家包收纳至 `crews/main/skills/sales-cs-manager/tools/sales-cs-review/`） |
 
-**C 类清单（多并列脚本，暂不加分发器 wrapper，维持 SKILL.md 绝对路径调用）**：bd-record（5）、info-record（4）、ir-record（11）、work-channel-binding（7）、customer-db（7）、pitch-deck（3）、video-product（6）、html-video（2，功能分裂）。（published-track、content-calibrator 已于 2026-08-21 转分发器 wrapper；swcr-register 已于 2026-08-27 转分发器 wrapper 并保持顶层位置（曾短暂折入 expert-bd/tools，同日移出），见变更历史。）
+**C 类清单（多并列脚本，暂不加分发器 wrapper，维持 SKILL.md 绝对路径调用）**：bd-record（5）、info-record（4）、ir-record（11）、work-channel-binding（7）、customer-db（7）、pitch-deck（3）、video-product（6）、html-video（2，功能分裂）。（published-track、content-calibrator 已于 2026-08-21 转分发器 wrapper，见变更历史。）
 
 > **为何 C 类不加**：分发器 wrapper（`<skill> <subcmd> ...` 呺由到对应脚本）是为每个 skill 单定制分发表，引入新子命令方言、agent 还要学一套；现 SKILL.md 已把 `./skills/<name>/scripts/<file>.sh` 绝对路径写死（CLAUDE.md 也强制要求），多并列脚本那种靠 SKILL.md 路径明文已治拼错。分发器是未来可选演进，本轮不做。
 
@@ -219,7 +219,9 @@ dev plan §Phase 7 续 写"验收"：
 
 - **2026-09-10**：`content-producer` 引入专家包，四个技能整合为两个包——`video-producer` / `collage-broll` 收纳进 `expert-video/tools/`（`pipelines/` 改造为 `expert-video/workflows/`，`dna-ad-video-pipeline.md` 重构为 `reversal-ad.md`），`design-full` 收纳进 `expert-design/tools/`，`manim-explainer` 删除。**PATH wrapper 名与子命令全部不变**（`video-producer <子命令>` / `design-full <init|pick>`），靠 `expose_skill_wrappers` 的 `*/tools/*/` 扫描层暴露；新增 `collage-broll <check-setup|gate3>` wrapper（原先 agent 直接拼 `scripts/run_gate3.py` 路径）。同时给 `expose_skill_wrappers` 与 `sync_crew_skills` 加**悬挂软链清理**（技能改名 / 收纳后，`~/.openclaw/bin` 与 `workspace-*/skills/` 里的旧软链会指向不存在的仓路径），并让 `collect_skill_script_commands` 扫 `skills/<skill>/tools/*/scripts/`（否则包内 `.sh` 脚本会从 ALLOWED_COMMANDS 掉出去）。
 
-- **2026-08-27**：`swcr-register` 加子命令分发器 wrapper（`swcr-register <code-doc|manual|form-info>`，-> scripts 下三个 Python 脚本），移出 C 类清单。同日随 expert-bd 专家包落地时曾折入 `expert-bd/tools/`，当天移出回归顶层 `crews/main/skills/swcr-register/`（软著属项目申报配套，非 BD 领域专属，跨包复用保持顶层）。wrapper 为 `SCRIPT_DIR` 自定位写法，与所在层级无关，移入移出均无需改动；`expert-bd/SKILL.md` 工具清单与 AGENTS.md 路由同步去除包内引用。同日 sales-cs-enablement / sales-cs-review 随 `sales-cs-manager` 专家包收纳至 tools/ 层（见 §4.2 表注与 §8.2 条目 21），sales-cs-enablement 转子命令分发器。
+- **2026-09-12**：`swcr-register` 技能删除（软著材料生成，产品定位调整），其 wrapper 与 expert-ir 侧引用、本文档 C 类清单注记一并清理。
+
+- **2026-08-27**：sales-cs-enablement / sales-cs-review 随 `sales-cs-manager` 专家包收纳至 tools/ 层（见 §4.2 表注与 §8.2 条目 21），sales-cs-enablement 转子命令分发器。
 
 - **2026-08-21**：数据直连 DNA 改造连带 wrapper 补强：`published-track`（C 类转分发器 wrapper：`published-track <record|update-metrics|fetch-metrics|query|query-pending|check-published|set-distribute-status|get-xhs-user-id|init-db|migrate-v3>`）与 `content-calibrator`（`content-calibrator <eval|query-metrics|init>`）落顶层分发器 wrapper，SKILL.md / HEARTBEAT.md / AGENTS.md / expert-wx-mp workflows 全部 PATH 化，agent 零路径拼接。继 video-edit 之后第 2、3 个分发器 wrapper。
 
```

**File**: `scripts/install-atomgit.ps1` (modified, +68/-5)
```diff
@@ -36,6 +36,7 @@
 #      manually later)
 #   7. camoufox-cli: .cmd shim + camoufox-cli install downloads Firefox
 #   8. openclaw-weixin plugin: openclaw plugins install ... --pin (npmmirror)
+#      idempotency by VERSION: skip only when installed == pin; --force upgrade otherwise
 #   9. Interactive prompt for AWK_API_KEY -> write daemon.env + setx user env var -> attempt
 #      openclaw daemon install
 #
@@ -481,6 +482,53 @@ function Install-CamoufoxCli {
 }
 
 # --- 9. openclaw-weixin plugin ---
+# Read the installed openclaw-weixin version; returns $null when unreadable.
+# Primary path: `plugins list --json` (fields id / name / version); fallback: the real
+# package.json under npm\projects\* (project dir names carry a hash, so glob).
+function Get-WeixinInstalledVersion([string]$pkg) {
+    # Capture stdout only (mirrors bash 2>/dev/null): stderr noise would break ConvertFrom-Json.
+    # EAP must be Continue here - under Stop, `2>$null` on a .cmd still throws
+    # NativeCommandError on Windows PowerShell 5.1 (same pitfall as Capture-Streamed above).
+    $prev = $ErrorActionPreference
+    $ErrorActionPreference = 'Continue'
+    try { $json = (& $ClawCmd plugins list --json 2>$null | Out-String) }
+    finally { $ErrorActionPreference = $prev }
+    if ($json) {
+        try {
+            foreach ($p in ($json | ConvertFrom-Json).plugins) {
+                if ($p.id -eq "openclaw-weixin" -or $p.name -eq $pkg) {
+                    if ($p.version) { return [string]$p.version }
+                    break
+                }
+            }
+        } catch { }
+    }
+    # Fallback: CLI/JSON unavailable - read the installed package.json directly
+    $projRoot = Join-Path $OpenclawHome "npm\projects"
+    if (Test-Path $projRoot) {
+        $pkgRel = $pkg.Replace("/", "\")
+        foreach ($dir in (Get-ChildItem $projRoot -Directory -ErrorAction SilentlyContinue)) {
+            $f = Join-Path $dir.FullName "node_modules\$pkgRel\package.json"
+            if (-not (Test-Path $f)) { continue }
+            try {
+                $v = (Get-Content $f -Raw | ConvertFrom-Json).version
+                if ($v) { return [string]$v }
+            } catch { }
+        }
+    }
+    return $null
+}
+
+# Install the openclaw-weixin plugin (the config template pre-populates the channel, but the
+# plugin itself needs `openclaw plugins install`). Pin comes from openclaw-weixin.version.json
+# in the tarball; registry is npmmirror.
+# Idempotency by VERSION, not by name: skip only when installed == pin; installed != pin ->
+# `--force` upgrade to pin. (The old logic merely matched the plugin name in `plugins list`
+# and returned, so after a pin bump existing installs stayed on the old version forever.)
+# --force = "Overwrite an existing installed plugin" (flag exists since 7.1-2). The upgrade
+# only replaces the package under npm\projects; login state in $OpenclawHome\openclaw-weixin\
+# is untouched, and the update route restarts the gateway afterwards so the new version takes
+# effect.
 function Install-WeixinPlugin {
     Write-Stage "Installing WeChat plugin"
     if (-not (Test-Path $ClawCmd)) { Write-Warn "openclaw wrapper not found: $ClawCmd; skipping"; return }
@@ -493,11 +541,26 @@ function Install-WeixinPlugin {
         } catch { Write-Warn "pin file parse failed, using default $pkg@$ver" }
     }
     $env:npm_config_registry = "https://registry.npmmirror.com"
-    $listOut = Capture-Streamed { & $ClawCmd plugins list }
-    if ($listOut -match "openclaw-weixin") { Write-Ok "openclaw-weixin plugin already installed"; return }
-    Invoke-Streamed { & $ClawCmd plugins install "$pkg@$ver" --pin }
-    if ($LASTEXITCODE -eq 0) { Write-Ok "openclaw-weixin plugin installed" }
-    else { Write-Warn "plugin install failed; you can run manually later: $ClawCmd plugins install $pkg@$ver --pin" }
+    # Idempotency check: skip only when installed version == pin
+    $installed = Get-WeixinInstalledVersion $pkg
+    $forceFlag = @()
+    if ($installed -and $installed -ceq $ver) { Write-Ok "openclaw-weixin plugin already installed ($ver)"; return }
+    if ($installed) {
+        Write-Host "  [i]  openclaw-weixin installed $installed, pin $ver -> --force upgrade" -ForegroundColor Yellow
+        $forceFlag = @("--force")
+    } else {
+        $listOut = Capture-Streamed { & $ClawCmd plugins list }
+        if ($listOut -match "openclaw-weixin") {
+            # Plugin present but version unreadable (CLI/JSON anomaly): force reinstall at pin
+            Write-Warn "openclaw-weixin installed but version unreadable; force reinstalling at pin $ver"
+            $forceFlag = @("--force")
+        }
+    }
+    $installArgs = @("plugins", "install", "$pkg@$ver", "--pin") + $forceFlag
+    $forceHint = if ($forceFlag) { " --force" } else { "" }
+    Invoke-Streamed { & $ClawCmd @installArgs }
+    if ($LASTEXITCODE -eq 0) { Write-Ok "openclaw-weixin plugin installed ($ver)" }
+    else { Write-Warn "plu
```

**File**: `scripts/install.ps1` (modified, +68/-5)
```diff
@@ -38,6 +38,7 @@
 #      manually later)
 #   7. camoufox-cli: .cmd shim + camoufox-cli install downloads Firefox
 #   8. openclaw-weixin plugin: openclaw plugins install ... --pin (npmmirror)
+#      idempotency by VERSION: skip only when installed == pin; --force upgrade otherwise
 #   9. Interactive prompt for AWK_API_KEY -> write daemon.env + setx user env var -> attempt
 #      openclaw daemon install
 #
@@ -498,6 +499,53 @@ function Install-CamoufoxCli {
 }
 
 # --- 9. openclaw-weixin plugin ---
+# Read the installed openclaw-weixin version; returns $null when unreadable.
+# Primary path: `plugins list --json` (fields id / name / version); fallback: the real
+# package.json under npm\projects\* (project dir names carry a hash, so glob).
+function Get-WeixinInstalledVersion([string]$pkg) {
+    # Capture stdout only (mirrors bash 2>/dev/null): stderr noise would break ConvertFrom-Json.
+    # EAP must be Continue here - under Stop, `2>$null` on a .cmd still throws
+    # NativeCommandError on Windows PowerShell 5.1 (same pitfall as Capture-Streamed above).
+    $prev = $ErrorActionPreference
+    $ErrorActionPreference = 'Continue'
+    try { $json = (& $ClawCmd plugins list --json 2>$null | Out-String) }
+    finally { $ErrorActionPreference = $prev }
+    if ($json) {
+        try {
+            foreach ($p in ($json | ConvertFrom-Json).plugins) {
+                if ($p.id -eq "openclaw-weixin" -or $p.name -eq $pkg) {
+                    if ($p.version) { return [string]$p.version }
+                    break
+                }
+            }
+        } catch { }
+    }
+    # Fallback: CLI/JSON unavailable - read the installed package.json directly
+    $projRoot = Join-Path $OpenclawHome "npm\projects"
+    if (Test-Path $projRoot) {
+        $pkgRel = $pkg.Replace("/", "\")
+        foreach ($dir in (Get-ChildItem $projRoot -Directory -ErrorAction SilentlyContinue)) {
+            $f = Join-Path $dir.FullName "node_modules\$pkgRel\package.json"
+            if (-not (Test-Path $f)) { continue }
+            try {
+                $v = (Get-Content $f -Raw | ConvertFrom-Json).version
+                if ($v) { return [string]$v }
+            } catch { }
+        }
+    }
+    return $null
+}
+
+# Install the openclaw-weixin plugin (the config template pre-populates the channel, but the
+# plugin itself needs `openclaw plugins install`). Pin comes from openclaw-weixin.version.json
+# in the tarball; registry is npmmirror.
+# Idempotency by VERSION, not by name: skip only when installed == pin; installed != pin ->
+# `--force` upgrade to pin. (The old logic merely matched the plugin name in `plugins list`
+# and returned, so after a pin bump existing installs stayed on the old version forever.)
+# --force = "Overwrite an existing installed plugin" (flag exists since 7.1-2). The upgrade
+# only replaces the package under npm\projects; login state in $OpenclawHome\openclaw-weixin\
+# is untouched, and the update route restarts the gateway afterwards so the new version takes
+# effect.
 function Install-WeixinPlugin {
     Write-Stage "Installing WeChat plugin"
     if (-not (Test-Path $ClawCmd)) { Write-Warn "openclaw wrapper not found: $ClawCmd; skipping"; return }
@@ -510,11 +558,26 @@ function Install-WeixinPlugin {
         } catch { Write-Warn "pin file parse failed, using default $pkg@$ver" }
     }
     $env:npm_config_registry = "https://registry.npmmirror.com"
-    $listOut = Capture-Streamed { & $ClawCmd plugins list }
-    if ($listOut -match "openclaw-weixin") { Write-Ok "openclaw-weixin plugin already installed"; return }
-    Invoke-Streamed { & $ClawCmd plugins install "$pkg@$ver" --pin }
-    if ($LASTEXITCODE -eq 0) { Write-Ok "openclaw-weixin plugin installed" }
-    else { Write-Warn "plugin install failed; you can run manually later: $ClawCmd plugins install $pkg@$ver --pin" }
+    # Idempotency check: skip only when installed version == pin
+    $installed = Get-WeixinInstalledVersion $pkg
+    $forceFlag = @()
+    if ($installed -and $installed -ceq $ver) { Write-Ok "openclaw-weixin plugin already installed ($ver)"; return }
+    if ($installed) {
+        Write-Host "  [i]  openclaw-weixin installed $installed, pin $ver -> --force upgrade" -ForegroundColor Yellow
+        $forceFlag = @("--force")
+    } else {
+        $listOut = Capture-Streamed { & $ClawCmd plugins list }
+        if ($listOut -match "openclaw-weixin") {
+            # Plugin present but version unreadable (CLI/JSON anomaly): force reinstall at pin
+            Write-Warn "openclaw-weixin installed but version unreadable; force reinstalling at pin $ver"
+            $forceFlag = @("--force")
+        }
+    }
+    $installArgs = @("plugins", "install", "$pkg@$ver", "--pin") + $forceFlag
+    $forceHint = if ($forceFlag) { " --force" } else { "" }
+    Invoke-Streamed { & $ClawCmd @installArgs }
+    if ($LASTEXITCODE -eq 0) { Write-Ok "openclaw-weixin plugin installed ($ver)" }
+    else { Write-Warn "plu
```

---

### Incident Patch 12: `b1d32d0e` (2026-09-12)
**Commit Message**: fix: update media sending instructions for awada in agent-skills.sh

**File**: `docs/openclaw-2026.9.3-upgrade-fact-finding.md` (removed, +0/-539)
```diff
@@ -1,539 +0,0 @@
-# openclaw 2026.9.3 升级事实调研
-
-> 落盘 2026-09-11 · 调研窗口 2026-09-10 06:23 – 2026-09-11 07:30（CST）
-> 当前基座：`2026.7.1-2`（`0790d9f593ad30c940ed93b5872a8cf6d6f3cf8c`，pin 在仓根 `openclaw.version`）
-> 调研目标：`2026.9.3`（`1391f7cd2d4`，tag `v2026.9.3`）；过渡候选：`extended-stable/2026.7.33`（tip `f619d7a9fa3`）
-> **本文只记事实与实测数据，不做决策**；待拍板项集中在 §10，施工方案另开文档。
-> 相关：[browser-stack-replacement-spec-2026-07.md](./browser-stack-replacement-spec-2026-07.md)（camoufox 双线栈 spec）、[browser-extension-replacement-research.md](./browser-extension-replacement-research.md)、`patches/browser-camoufox-pivot/README.md`
-
-## 证据口径
-
-| 标记 | 含义 |
-|---|---|
-| `[A]` | 2026-09-10 早会话内实测（pristine worktree `/tmp/oc93` 逐个 `git apply`、`git log --grep`、`ls-tree`），**本次落盘未复验**，仅记录当时结论 |
-| `[B]` | 2026-09-11 落盘时在 `/home/wukong/wiseflow/openclaw` 用 `v2026.7.1-2` / `v2026.9.3` 两个 tag 现场实测（可复跑，命令见附录 A） |
-| `[C]` | 上游文档 / release notes 原文（路径 + 行号以 9.3 tag 为准） |
-
----
-
-## 0. 摘要（先读这段）
-
-1. **不是"切版本 + 验 patch"能过的升级**：`v2026.7.1-2` **不是** `v2026.9.3` 的祖先，merge-base = `b81666ca6af`（2026-07-08），9.3 侧 **24,853** commits、7.1-2 侧独有 **224** `[B]`（今早 `[A]` 的数字已复算一致）。37 个 patch 里 **30 个要重做**（3777/4240 行），其中 9 个删除型 patch **全部硬失败** `[A]`。
-2. **awada 插件在 9.3 会加载即死**：`src/plugin-sdk/index.ts` 被删（裸导入 `openclaw/plugin-sdk` 从 exports 消失），`ClawdbotConfig` 全仓 0 命中（改名 `OpenClawConfig`）`[A]`。这是生产链路，优先级最高。
-3. **工具链硬门槛**：9.3 `engines.node = >=24.16.0 <25 || >=26.1.0`（**Node 22 / 25 支持被整条砍掉**），`packageManager = pnpm@12.3.4` `[B]`；我们 `build-dist.yml` 还锁 `24.15.0`（5 处）`[B]`。
-4. **用户两项核心诉求都不在 extended-stable/2026.7.33 上**：①发现本机已装 codex/claude code 当 provider（最低要 **9.1**）、②更低对话 token 消耗（要拿满得 **9.3**）`[A]`。→ ES 7.33 只能当过渡，不能当终点。
-5. **浏览器子系统在 9.3 是一次重写**：`extensions/browser` **567 files changed（+100,528 / −23,896）**，其中新增 263 / 修改 286 / 删除 18 `[B]`；工具入口 `browser-tool.ts` 从 1087 行缩到 439 行并被拆成 8 个模块 `[B]`。
-6. **浏览器协议层没有第四种**：仍是「自管 CDP / Chrome DevTools MCP / Chrome 扩展 relay」三种，且 **7.1-2 已全有** `[B][C]`。但 9.x 新增了两种**控制面**：Computer Use（`extensions/cua-computer`，0 → 39 文件）与 cloud worker 的 attached browser runtime（`src/worker/`，0 → 68 文件）`[B]`。
-7. **9.3 的浏览器新形态对我们几乎全是无关面**（extension / existing-session 要真人 Chrome，CUA 要 Mac/Windows，worker 是云场景）；真正有用的只有 `navigate` 内联 snapshot、`text`/`requests`/`errors`、能力裁剪三项——**都指向省 token / 省轮次** `[B][C]`。
-8. **已落地动作**：第三方插件 pin 已 bump（`openclaw-weixin` 2.4.6→2.4.8、`wecom-openclaw-cli` 1.1.0→1.1.1，commit `d5e112c`，已推 origin/master）；**基座 pin 一行未动** `[B]`。
-9. **量级估算**：4.5–7 人日（patch re-port 2–3.5 / awada 0.5–1 / 工具链 0.5 / 配置+doctor 0.5–1 / build+tsgo+冒烟 1）`[A]`。
-
----
-
-## 1. 版本线拓扑 `[A]`，其中祖先关系 / commit 计数 / ES tip 已于 `[B]` 复验
-
-| 线 | ref | 最新 commit | 状态 |
-|---|---|---|---|
-| 我们现在用的 | tag `v2026.7.1-2` = `origin/release/2026.7.1` 分支 tip | 2026-07-18（8/4 发布） | **已冻结**，不会再动 |
-| 延长稳定 7.x | `origin/extended-stable/2026.7.33` | `f619d7a9fa3`（2026-09-09）`[B]` | **活跃维护中**，版本号 2026.7.33 |
-| 延长稳定 6.x | `origin/extended-stable/2026.6.33`（tag 6.33/6.34） | 2026-09-08 | 活跃；npm `extended-stable` dist-tag 当前指向 **2026.6.34** |
-| 主稳定线 | `release/2026.8.1 → 8.2 → 9.1 → 9.2 → 9.3` | 2026-09-07/08 | 火车式，一周 1–2 个稳定版 |
-
-关键事实：
-
-- **`v2026.7.1-2` 是 `extended-stable/2026.7.33` 的直系祖先**（`git merge-base --is-ancestor` = **YES**），`git rev-list --count v2026.7.1-2..origin/extended-stable/2026.7.33` = **38**，我们侧 0 个独有 commit `[B]`。
-- **`v2026.7.1-2` 不是 `v2026.9.3` 的祖先**（`--is-ancestor` = **NO**）：merge-base = `b81666ca6af`（2026-07-08，`Fix container image upgrade migrations before gateway readiness (#101881)`）；9.3 侧 **24,853** commits，7.1-2 侧独有 **224** 个（多为 CI/QA）`[B]`。
-- 我们当年靠 7.1-1 / 7.1-2 拿到的修复**已随主线进 9.3**（按 PR 号核到：#108487 codex progress、#108652 memory sidecar、#108258 WSL EROFS、#107294 npm lock、#106065 SQLite WAL、#108336 plugin metadata）→ **没有丢修复** `[A]`。
-- **7.33 当时还没打 tag、没发 npm 包**（分支上全是 `package acceptance` / `release preflight` / `frozen upgrade baselines` 类收尾 commit）`[A]`。
-- 6.33/6.34 与 7.1-2 是**分叉**关系（merge-base 6/24，它侧 332 commit），我们 37 个 patch 里 **17 个目标文件已漂移** → 功能倒退 + 还要重做 patch，**不可选** `[A]`。
-- 上游文档明确：`openclaw update --channel extended-stable` **只对 package 安装生效，git checkout 会被拒**（`docs/install/development-channels.md:43`、`docs/install/updating.md:42-43`）`[C]`。我们是源码 clone + commit pin + 自己 build，所以对我们只是"pin 哪棵树"的问题，但意味着**不能靠 CLI 自动跟，必须自己 re-pin**（巡检项）。
-
-### 1.1 `package.json` 硬指标对比 `[B]`
-
-| 字段 | v2026.7.1-2 | v2026.9.3 |
-|---|---|---|
-| `version` | 2026.7.1 | 2026.9.3 |
-| `engines.node` | `>=22.22.3 <23 \|\| >=24.15.0 <25 \|\| >=25.9.0` | **`>=24.16.0 <25 \|\| >=26.1.0`** |
-| `packageManager` | `pnpm@11.2.2` | **`pnpm@12.3.4`** |
-
-> Node 22 与 25 两条线在 9.3 被整体移除；上游同时说明 Node 22/25/更早 24.x 存在 **SQLite 文本截断**问题（数据损坏级）`[A]`。
-
----
-
-## 2. 中间版本功能差异（7.1-2 → 9.3）`[A][C]`
-
-| 版本 | 发布 | 新功能要点 | 破坏性 |
-|---|---|---|---|
-| **8.1**（= OpenClaw 2.0） | 8/31 | 重建 Web 体验、onboarding 简化、memory/session 连续性、历史对话搜索、跨设备/云 worker 会话、durable 进度卡片、结构化提问卡片、chat 内 widgets/dashboards、私密凭据请求（masked prompt）、automation permission、音视频保真；**浏览器与 Computer Use 大改**（见 §
```

**File**: `scripts/lib/agent-skills.sh` (modified, +0/-1)
```diff
@@ -499,7 +499,6 @@ inject_media_send_guide() {
 
 - 飞书：`message(action="send", media="<绝对路径>")`（对于 HTML 类型文件，飞书要求先复制到 `/tmp/openclaw/`，再执行发送）。
 - `openclaw-weixin`：`message(action="send", media="<本地绝对路径或 HTTPS URL>")`，当前会话可不传 target。
-- `awada`： 不支持本地路径；当前回复用 `MEDIA:<HTTPS URL>`，预置云文件用 `message(action="sendAttachment", file_name="<文件名>")`。
 GUIDE
 }
 
```

---

### Incident Patch 13: `068f87e6` (2026-09-11)
**Commit Message**: fix(update): bundled openclaw-weixin tarball 安装补 --force

bundled 路径（vendor/openclaw-plugins/*.tgz，sha512 校验后安装）本来就每次都装、
没有幂等跳过，但 `plugins install <tgz>` 不带 --force 时在已装过该插件的实例上会失败，
进而触发紧随其后的 exit 1，把整次 update 打断。

--force = "Overwrite an existing installed plugin"（7.1-2 起就有该 flag），
与 install.sh / install-atomgit.sh / docker-bootstrap.sh 上一轮的修法保持一致。
成功日志带上 pin 版本号便于核对。

未动：update.sh 的在线路径（npx openclaw-weixin-cli install）——该 CLI 遇到固定版本
spec 会自行跳过升级，要修得改调用方式，按用户决定暂不处理；已记入
docs/openclaw-2026.9.3-upgrade-fact-finding.md §8.3 / §10-4。

**File**: `docs/openclaw-2026.9.3-upgrade-fact-finding.md` (modified, +3/-2)
```diff
@@ -429,7 +429,8 @@ commit **`d5e112c`**（`chore(deps): bump openclaw-weixin 2.4.6 -> 2.4.8, wecom-
 ### 8.3 已知坑：改了 pin，已装实例不会自动升 `[A]` → **install 路径已于 2026-09-12 修复 `[B]`**
 
 - ~~`scripts/install.sh`：`plugins list` 里已有 openclaw-weixin 就**直接 return，不比版本**~~ → **已修**：`install.sh` / `install-atomgit.sh` / `docker/docker-bootstrap.sh` 三处同源的 `install_weixin_plugin()` 改为**按版本判定**——新增 `weixin_installed_version()`（主路径 `plugins list --json` 取 `version`，回落到 `$OPENCLAW_HOME/npm/projects/*/node_modules/<pkg>/package.json`），已装 == pin 才跳过，不等则 `plugins install <pkg>@<pin> --pin --force`；版本读不到但插件在时也走 `--force`（正确性优先）。已用本机实例（已装 2.4.6 / pin 2.4.8）实测三条路径：主路径 ✓、回落路径 ✓、未安装返回非零 ✓，决策分支 `UPGRADE --force` / `SKIP` 均正确。
-- `scripts/update.sh`：**仍未修**。它走 `npx openclaw-weixin-cli@2.1.4 install`，该 CLI 读到 `plugins.installs[].spec` 是固定版本号时（我们正是用 `--pin` 装的）会打印「本地已安装插件为固定版本 2.4.6，跳过升级」直接 return；bundled tarball 路径（`update.sh:169`）也没带 `--force`。→ 走 `update.sh` 的实例仍需下面这条手动命令（或后续单独修 update.sh）。
+- `scripts/update.sh` bundled tarball 路径 → **已修**（2026-09-12）：`plugins install "$plugin_tgz"` 补上 `--force`。该路径本来就每次都装（无幂等跳过），缺 flag 时在已装实例上会失败并触发下面的 `exit 1`，把整次 update 打断。（注：仓内无 `vendor/openclaw-plugins/`，该路径只在带 vendor 的发行 tarball 里触发。）
+- `scripts/update.sh` 在线路径 → **仍未修**（按用户决定暂不动）。它走 `npx openclaw-weixin-cli@2.1.4 install`，该 CLI 读到 `plugins.installs[].spec` 是固定版本号时（我们正是用 `--pin` 装的）会打印「本地已安装插件为固定版本 2.4.6，跳过升级」直接 return。→ 走 `update.sh` 在线路径的实例仍需下面这条手动命令。
 
 → `update.sh` 路线 / 修复前已装的实例，仍需显式跑一次：
 
@@ -463,7 +464,7 @@ wecom 那条不受影响：`install-wecom-channel.sh` 按 pin 文件 `npm pack`
 | 1 | **基线选哪条** | (a) 直接迁 `2026.9.3`；(b) 先切 `extended-stable/2026.7.33`（pin `f619d7a9fa3`，或等它打 tag）过渡，再排期 9.3；(c) 暂不动；(d) **ES 7.33 + cherry-pick 9.3 省 token commit —— 已实测否决**（§6.5-2：5 个 commit 全部冲突，合计 153 个冲突文件次） | (a) 4.5–7 人日 `[A]`；(b) ≈半天，patch/awada 零漂移，但拿不到能力①② `[A]`；能力①最低 9.1、能力②要 9.3（§6.1） |
 | 2 | **portable Node 抬到哪** | 24.16+ / 直接 26（上游推荐 26） | 与 openclaw 版本解耦，留 7.x 也该做（§5.1）；改 `build-dist.yml` 5 处 + `ci.yml` + Docker 基础镜像钉死 |
 | 3 | **9.x 迁移的触发条件认不认** | 认 / 不认（改为现在就一次性做完） | 触发条件草案：生产出现"回复停在工具输出 / 重启后丢回复"（#133520 #133979 #138071 #138519 **均未 backport 到 ES 7.33**）；或 ES 7.33 停止提交；或需要 9.x 独有能力 |
-| 4 | ~~**`install.sh` 幂等判断要不要改**~~ | **已做（2026-09-12）**：install.sh / install-atomgit.sh / docker-bootstrap.sh 三处改为按版本判定 + `--force` 升级 | 详见 §8.3；**遗留**：`update.sh` 的 weixin-cli 路径与 bundled tarball 路径仍未带 `--force`，要不要一并修 |
+| 4 | ~~**`install.sh` 幂等判断要不要改**~~ | **已做（2026-09-12）**：install.sh / install-atomgit.sh / docker-bootstrap.sh 三处改为按版本判定 + `--force` 升级；`update.sh` 的 bundled tarball 路径也补了 `--force` | 详见 §8.3；**遗留（用户决定暂不动）**：`update.sh` 在线路径走 weixin-cli，遇固定版本 spec 会自行跳过 |
 | 5 | **浏览器路线** | (a) 按 9.3 新模块布局重画 pivot（05/03/04/09 + `del-*` 改 rm 清单 + 补 5 个新文件）；(b) 先在 7.1-2 上把"能力裁剪"等价实现到自有 adapter 层（半天量级，不需动基座）；(c) 评估 §7.8-4 的"MCP 桥零 patch"路线 | 见 §7.8；(a) 的工时已含在 #1 的 4.5–7 人日里 |
 | 6 | **是否先做"单轮 token 构成"实测 + 三档配置调参** | 做 / 不做 | 半天、立刻见效、与升级解耦（§6.3、§6.5-5：`contextPruning` / `skills.limits` / `compaction.*` 三档都是 7.1-2 已支持但我们没开）；也是判断能力② 收益基线的前置数据 |
 | 7 | **是否先实测百炼端点的 prompt cache 语义** | 做 / 不做 | 决定 9.3 那批 cache 修复对我们是否有价值（§6.5-4）；不做这一步，能力② 的收益无法量化 |
```

**File**: `scripts/update.sh` (modified, +5/-2)
```diff
@@ -166,8 +166,11 @@ install_weixin_channel() {
         }
       ' "$plugin_tgz" "$plugin_integrity"
     fi
-    if (cd "$OPENCLAW_DIR" && pnpm openclaw plugins install "$plugin_tgz"); then
-      echo "  ✅ bundled openclaw-weixin installed"
+    # --force = "Overwrite an existing installed plugin"（7.1-2 起就有该 flag）。
+    # bundled 路径本来就每次都装（不像 install.sh 有幂等跳过），缺这个 flag 时
+    # 在已装过该插件的实例上会失败，进而触发下面的 exit 1，把整次 update 打断。
+    if (cd "$OPENCLAW_DIR" && pnpm openclaw plugins install "$plugin_tgz" --force); then
+      echo "  ✅ bundled openclaw-weixin installed (${plugin_version})"
     else
       echo "❌ Bundled openclaw-weixin install failed"
       echo "   Re-run with --skip-weixin only if you intentionally want to configure the onboarding channel later."
```

---

### Incident Patch 14: `b1b7cb56` (2026-09-11)
**Commit Message**: fix(install): openclaw-weixin 幂等判断改为按版本比对，不等则 --force 升级

问题：install_weixin_plugin() 只用 `plugins list | grep openclaw-weixin` 判断，已装即
return，不比版本 -> bump pin（如 2.4.6 -> 2.4.8）后已装实例永远停在旧版，必须人工跑
`plugins install ... --pin --force` 才升得上去。

改动（三处同源实现一起改，避免裸机 / atomgit / docker 行为分叉）:
- scripts/install.sh、scripts/install-atomgit.sh、docker/docker-bootstrap.sh
- 新增 weixin_installed_version()：主路径 `plugins list --json` 取 version 字段，回落到
  $OPENCLAW_HOME/npm/projects/*/node_modules/<pkg>/package.json（目录名带 hash，只能 glob）
- 判定：已装 == pin -> 跳过；已装 != pin -> `plugins install <pkg>@<pin> --pin --force`；
  插件在但版本读不到 -> 也走 --force（正确性优先）
- docker 侧同理需要比版本：/root/.openclaw 是持久卷，镜像升级后插件包不会跟着 pin 走

实测（本机实例正好是「已装 2.4.6 / pin 2.4.8」的样本，只测判断逻辑不真装）:
- 主路径 plugins list --json -> 2.4.6 OK
- CLI 不可用时回落 glob -> 2.4.6 OK
- 未安装的包名 -> 空输出 + rc=1 OK
- 决策分支：pin=2.4.8 -> UPGRADE --force；pin=2.4.6 -> SKIP（不会无谓重装）OK
- bash -n 三个脚本均通过

未修（已记入 fact-finding §8.3 / §10-4）：scripts/update.sh 的在线路径走 weixin-cli，
遇到固定版本 spec 会自行跳过；bundled tarball 路径也没带 --force。

升级只换 npm/projects 下的包，登录态在 $OPENCLAW_HOME/openclaw-weixin/ 数据目录不受影响；
更新路线随后 refresh_gateway_env_only 会重启 gateway 使新版本生效。

**File**: `docker/docker-bootstrap.sh` (modified, +39/-6)
```diff
@@ -100,6 +100,30 @@ log "STEP 4 done"
 
 # ─── 预装 openclaw-weixin 插件（非致命，首启可补）────────────────
 # 与裸机 install.sh 的 install_weixin_plugin() 同源：读 pin 走在线 plugins install
+# 幂等：**已装版本 == pin 版本**才跳过；不等则 --force 升级到 pin。
+# 容器里 /root/.openclaw 是持久卷，镜像升级后插件包不会自己跟着 pin 走，所以这里必须比版本。
+weixin_installed_version() {
+    local pkg="$1" oc_home="${OPENCLAW_HOME:-/root/.openclaw}" v f
+    v="$((cd "$PROJECT_ROOT/openclaw" && pnpm openclaw plugins list --json) 2>/dev/null | python3 -c "
+import json, sys
+try:
+    d = json.load(sys.stdin)
+except Exception:
+    sys.exit(0)
+for p in d.get('plugins', []):
+    if p.get('id') == 'openclaw-weixin' or p.get('name') == '$pkg':
+        print(p.get('version') or '')
+        break
+" 2>/dev/null)"
+    if [ -n "$v" ]; then printf '%s\n' "$v"; return 0; fi
+    for f in "$oc_home"/npm/projects/*/node_modules/"$pkg"/package.json; do
+        [ -f "$f" ] || continue
+        v="$(python3 -c "import json;print(json.load(open('$f')).get('version',''))" 2>/dev/null)"
+        if [ -n "$v" ]; then printf '%s\n' "$v"; return 0; fi
+    done
+    return 1
+}
+
 install_weixin_plugin() {
     local pin_file="$PROJECT_ROOT/openclaw-weixin.version.json"
     local pkg ver
@@ -109,16 +133,25 @@ install_weixin_plugin() {
     fi
     pkg="${pkg:-@tencent-weixin/openclaw-weixin}"
     ver="${ver:-2.4.8}"
-    # 幂等检查
-    if (cd "$PROJECT_ROOT/openclaw" && pnpm openclaw plugins list 2>/dev/null | grep -q "openclaw-weixin"); then
-        log "openclaw-weixin plugin already installed"
+    # 幂等检查：已装版本 == pin 才跳过
+    local installed force_flag=""
+    installed="$(weixin_installed_version "$pkg" || true)"
+    if [ -n "$installed" ] && [ "$installed" = "$ver" ]; then
+        log "openclaw-weixin plugin already installed (${ver})"
         return 0
     fi
+    if [ -n "$installed" ]; then
+        log "openclaw-weixin 已装 ${installed}，pin=${ver} → --force 升级"
+        force_flag="--force"
+    elif (cd "$PROJECT_ROOT/openclaw" && pnpm openclaw plugins list 2>/dev/null | grep -q "openclaw-weixin"); then
+        log "⚠️ openclaw-weixin 已装但版本读不到；按 pin ${ver} 强制重装"
+        force_flag="--force"
+    fi
     log "installing openclaw-weixin plugin (${pkg}@${ver})"
-    if (cd "$PROJECT_ROOT/openclaw" && pnpm openclaw plugins install "${pkg}@${ver}" --pin); then
-        log "openclaw-weixin plugin installed"
+    if (cd "$PROJECT_ROOT/openclaw" && pnpm openclaw plugins install "${pkg}@${ver}" --pin $force_flag); then
+        log "openclaw-weixin plugin installed (${ver})"
     else
-        log "⚠️ openclaw-weixin 插件预装失败；首启可手动：pnpm openclaw plugins install ${pkg}@${ver} --pin"
+        log "⚠️ openclaw-weixin 插件预装失败；首启可手动：pnpm openclaw plugins install ${pkg}@${ver} --pin $force_flag"
     fi
 }
 log "STEP 5: installing openclaw-weixin plugin..."
```

**File**: `docs/openclaw-2026.9.3-upgrade-fact-finding.md` (modified, +5/-5)
```diff
@@ -426,12 +426,12 @@ commit **`d5e112c`**（`chore(deps): bump openclaw-weixin 2.4.6 -> 2.4.8, wecom-
 
 2.4.8 的**唯一代码改动**是把 `createTypingCallbacks` 的 import 从 `openclaw/plugin-sdk/channel-runtime` 换到 `openclaw/plugin-sdk/channel-message`——那是为适配 **8.1 删掉旧子路径**。对 7.1-2 已 build 的 `dist/` 做过运行时校验：11 个 `openclaw/plugin-sdk/*` 子路径全部存在于 7.1-2 的 `package.json` exports；18 个具名导入中 12 个 value import 全命中（含关键的 `channel-message :: createTypingCallbacks`），6 个 type-only import 在 `.d.ts` 中也都在。**不验这一步，微信通道有可能加载即挂。**
 
-### 8.3 已知坑：改了 pin，已装实例不会自动升 `[A]`
+### 8.3 已知坑：改了 pin，已装实例不会自动升 `[A]` → **install 路径已于 2026-09-12 修复 `[B]`**
 
-- `scripts/install.sh`：`plugins list` 里已有 openclaw-weixin 就**直接 return，不比版本**
-- `scripts/update.sh`：走 `npx openclaw-weixin-cli@2.1.4 install`，该 CLI 读到 `plugins.installs[].spec` 是固定版本号时（我们正是用 `--pin` 装的）会打印「本地已安装插件为固定版本 2.4.6，跳过升级」直接 return
+- ~~`scripts/install.sh`：`plugins list` 里已有 openclaw-weixin 就**直接 return，不比版本**~~ → **已修**：`install.sh` / `install-atomgit.sh` / `docker/docker-bootstrap.sh` 三处同源的 `install_weixin_plugin()` 改为**按版本判定**——新增 `weixin_installed_version()`（主路径 `plugins list --json` 取 `version`，回落到 `$OPENCLAW_HOME/npm/projects/*/node_modules/<pkg>/package.json`），已装 == pin 才跳过，不等则 `plugins install <pkg>@<pin> --pin --force`；版本读不到但插件在时也走 `--force`（正确性优先）。已用本机实例（已装 2.4.6 / pin 2.4.8）实测三条路径：主路径 ✓、回落路径 ✓、未安装返回非零 ✓，决策分支 `UPGRADE --force` / `SKIP` 均正确。
+- `scripts/update.sh`：**仍未修**。它走 `npx openclaw-weixin-cli@2.1.4 install`，该 CLI 读到 `plugins.installs[].spec` 是固定版本号时（我们正是用 `--pin` 装的）会打印「本地已安装插件为固定版本 2.4.6，跳过升级」直接 return；bundled tarball 路径（`update.sh:169`）也没带 `--force`。→ 走 `update.sh` 的实例仍需下面这条手动命令（或后续单独修 update.sh）。
 
-→ 部署/迁移时已装实例要显式跑一次：
+→ `update.sh` 路线 / 修复前已装的实例，仍需显式跑一次：
 
 ```bash
 cd openclaw && npm_config_registry=https://registry.npmmirror.com \
@@ -463,7 +463,7 @@ wecom 那条不受影响：`install-wecom-channel.sh` 按 pin 文件 `npm pack`
 | 1 | **基线选哪条** | (a) 直接迁 `2026.9.3`；(b) 先切 `extended-stable/2026.7.33`（pin `f619d7a9fa3`，或等它打 tag）过渡，再排期 9.3；(c) 暂不动；(d) **ES 7.33 + cherry-pick 9.3 省 token commit —— 已实测否决**（§6.5-2：5 个 commit 全部冲突，合计 153 个冲突文件次） | (a) 4.5–7 人日 `[A]`；(b) ≈半天，patch/awada 零漂移，但拿不到能力①② `[A]`；能力①最低 9.1、能力②要 9.3（§6.1） |
 | 2 | **portable Node 抬到哪** | 24.16+ / 直接 26（上游推荐 26） | 与 openclaw 版本解耦，留 7.x 也该做（§5.1）；改 `build-dist.yml` 5 处 + `ci.yml` + Docker 基础镜像钉死 |
 | 3 | **9.x 迁移的触发条件认不认** | 认 / 不认（改为现在就一次性做完） | 触发条件草案：生产出现"回复停在工具输出 / 重启后丢回复"（#133520 #133979 #138071 #138519 **均未 backport 到 ES 7.33**）；或 ES 7.33 停止提交；或需要 9.x 独有能力 |
-| 4 | **`install.sh` 幂等判断要不要改** | 改成"已装版本 ≠ pin 版本 → `--force` 升级" / 维持手动补装 | 十几行，根治 §8.3 的坑 |
+| 4 | ~~**`install.sh` 幂等判断要不要改**~~ | **已做（2026-09-12）**：install.sh / install-atomgit.sh / docker-bootstrap.sh 三处改为按版本判定 + `--force` 升级 | 详见 §8.3；**遗留**：`update.sh` 的 weixin-cli 路径与 bundled tarball 路径仍未带 `--force`，要不要一并修 |
 | 5 | **浏览器路线** | (a) 按 9.3 新模块布局重画 pivot（05/03/04/09 + `del-*` 改 rm 清单 + 补 5 个新文件）；(b) 先在 7.1-2 上把"能力裁剪"等价实现到自有 adapter 层（半天量级，不需动基座）；(c) 评估 §7.8-4 的"MCP 桥零 patch"路线 | 见 §7.8；(a) 的工时已含在 #1 的 4.5–7 人日里 |
 | 6 | **是否先做"单轮 token 构成"实测 + 三档配置调参** | 做 / 不做 | 半天、立刻见效、与升级解耦（§6.3、§6.5-5：`contextPruning` / `skills.limits` / `compaction.*` 三档都是 7.1-2 已支持但我们没开）；也是判断能力② 收益基线的前置数据 |
 | 7 | **是否先实测百炼端点的 prompt cache 语义** | 做 / 不做 | 决定 9.3 那批 cache 修复对我们是否有价值（§6.5-4）；不做这一步，能力② 的收益无法量化 |
```

**File**: `scripts/install-atomgit.sh` (modified, +48/-7)
```diff
@@ -24,6 +24,7 @@
 #   9. setup-crew.sh（裸跑，无 --force；--force 只用户手动修复用；crew 模板来自 WISEFLOW_ROOT/crews，workspace 落 OPENCLAW_HOME）
 #   10. camoufox-cli：npm install -g 本地 fork（ship 的 portable node）+ camoufox-cli install 下 Firefox
 #   11. openclaw-weixin 插件：openclaw plugins install @tencent-weixin/openclaw-weixin@<pin> --pin（npmmirror）
+#       幂等按**版本**判定：已装版本 == pin 才跳过，不等则 --force 升级到 pin
 #   12. 交互问 AWK_API_KEY → 写 gateway env（Linux daemon.env / Darwin service-env/ai.openclaw.gateway.env，均落 OPENCLAW_HOME）
 #       → openclaw daemon install + restart（唯一人工输入点；不走 onboard，小白友好）
 #   13. 打印访问指引
@@ -759,9 +760,39 @@ install_camoufox_cli() {
     ui_success "camoufox-cli ready"
 }
 
+# 读已装 openclaw-weixin 的版本号；读不到返回非零。
+# 优先 `plugins list --json`（字段 id / name / version），回落到 npm projects 下实装 package.json。
+weixin_installed_version() {
+    local claw_cmd="$1" pkg="$2" oc_home="${OPENCLAW_HOME:-$HOME/.openclaw}"
+    local v f
+    v="$("$claw_cmd" plugins list --json 2>/dev/null | python3 -c "
+import json, sys
+try:
+    d = json.load(sys.stdin)
+except Exception:
+    sys.exit(0)
+for p in d.get('plugins', []):
+    if p.get('id') == 'openclaw-weixin' or p.get('name') == '$pkg':
+        print(p.get('version') or '')
+        break
+" 2>/dev/null)"
+    if [[ -n "$v" ]]; then printf '%s\n' "$v"; return 0; fi
+    # 回落：CLI/JSON 不可用时直接读实装 package.json（目录名带 hash，只能 glob）
+    for f in "$oc_home"/npm/projects/*/node_modules/"$pkg"/package.json; do
+        [[ -f "$f" ]] || continue
+        v="$(python3 -c "import json;print(json.load(open('$f')).get('version',''))" 2>/dev/null)"
+        if [[ -n "$v" ]]; then printf '%s\n' "$v"; return 0; fi
+    done
+    return 1
+}
+
 # 装 openclaw-weixin 插件（config template 已预置 channel，但插件本体要 openclaw plugins install）
 # 读 tarball 内 openclaw-weixin.version.json 的 pin，走国内 npmmirror。
-# 幂等：openclaw plugins list 含 openclaw-weixin 则跳过。
+# 幂等：**已装版本 == pin 版本**才跳过；已装版本 ≠ pin 则 `--force` 升级到 pin。
+# （旧逻辑只 grep 插件名就 return，导致 bump pin 后已装实例永远停在旧版；
+#   `plugins install --force` = "Overwrite an existing installed plugin"，7.1-2 起就有该 flag。
+#   升级只换 npm/projects 下的包，登录态在 $OPENCLAW_HOME/openclaw-weixin/ 数据目录，不受影响。
+#   升级后需 gateway 重启才生效——更新路线在后面 refresh_gateway_env_only 里会重启。）
 install_weixin_plugin() {
     local claw_cmd="$WISEFLOW_ROOT/bin/openclaw"
     local pin_file="$WISEFLOW_ROOT/openclaw-weixin.version.json"
@@ -773,16 +804,26 @@ install_weixin_plugin() {
     fi
     pkg="${pkg:-@tencent-weixin/openclaw-weixin}"
     ver="${ver:-2.4.8}"
-    # 幂等检查：plugins list 已含则跳过
-    if "$claw_cmd" plugins list 2>/dev/null | grep -q "openclaw-weixin"; then
-        ui_success "openclaw-weixin plugin already installed"
+    # 幂等检查：已装版本 == pin 才跳过
+    local installed force_flag=""
+    installed="$(weixin_installed_version "$claw_cmd" "$pkg" || true)"
+    if [[ -n "$installed" && "$installed" == "$ver" ]]; then
+        ui_success "openclaw-weixin plugin already installed (${ver})"
         return 0
     fi
+    if [[ -n "$installed" ]]; then
+        ui_info "openclaw-weixin 已装 ${installed}，pin=${ver} → --force 升级"
+        force_flag="--force"
+    elif "$claw_cmd" plugins list 2>/dev/null | grep -q "openclaw-weixin"; then
+        # 插件在但版本读不到（CLI/JSON 异常）：按 pin 强制重装，保证与 pin 一致
+        ui_warn "openclaw-weixin 已装但版本读不到；按 pin ${ver} 强制重装"
+        force_flag="--force"
+    fi
     ui_info "Installing openclaw-weixin plugin (${pkg}@${ver}) via npmmirror"
-    if npm_config_registry=https://registry.npmmirror.com "$claw_cmd" plugins install "${pkg}@${ver}" --pin 2>/dev/null; then
-        ui_success "openclaw-weixin plugin installed"
+    if npm_config_registry=https://registry.npmmirror.com "$claw_cmd" plugins install "${pkg}@${ver}" --pin $force_flag 2>/dev/null; then
+        ui_success "openclaw-weixin plugin installed (${ver})"
     else
-        ui_warn "openclaw-weixin 插件安装失败；可后续手动：npm_config_registry=https://registry.npmmirror.com $claw_cmd plugins install ${pkg}@${ver} --pin"
+        ui_warn "openclaw-weixin 插件安装失败；可后续手动：npm_config_registry=https://registry.npmmirror.com $claw_cmd plugins install ${pkg}@${ver} --pin $force_flag"
     fi
 }
 
```

**File**: `scripts/install.sh` (modified, +48/-7)
```diff
@@ -20,6 +20,7 @@
 #   9. setup-crew.sh（裸跑，无 --force；--force 只用户手动修复用；crew 模板来自 WISEFLOW_ROOT/crews，workspace 落 OPENCLAW_HOME）
 #   10. camoufox-cli：npm install -g 本地 fork（ship 的 portable node）+ camoufox-cli install 下 Firefox
 #   11. openclaw-weixin 插件：openclaw plugins install @tencent-weixin/openclaw-weixin@<pin> --pin（npmmirror）
+#       幂等按**版本**判定：已装版本 == pin 才跳过，不等则 --force 升级到 pin
 #   12. 交互问 AWK_API_KEY → 写 gateway env（Linux daemon.env / Darwin service-env/ai.openclaw.gateway.env，均落 OPENCLAW_HOME）
 #       → openclaw daemon install + restart（唯一人工输入点；不走 onboard，小白友好）
 #   13. 打印访问指引
@@ -1071,9 +1072,39 @@ install_camoufox_cli() {
     ui_success "camoufox-cli ready"
 }
 
+# 读已装 openclaw-weixin 的版本号；读不到返回非零。
+# 优先 `plugins list --json`（字段 id / name / version），回落到 npm projects 下实装 package.json。
+weixin_installed_version() {
+    local claw_cmd="$1" pkg="$2" oc_home="${OPENCLAW_HOME:-$HOME/.openclaw}"
+    local v f
+    v="$("$claw_cmd" plugins list --json 2>/dev/null | python3 -c "
+import json, sys
+try:
+    d = json.load(sys.stdin)
+except Exception:
+    sys.exit(0)
+for p in d.get('plugins', []):
+    if p.get('id') == 'openclaw-weixin' or p.get('name') == '$pkg':
+        print(p.get('version') or '')
+        break
+" 2>/dev/null)"
+    if [[ -n "$v" ]]; then printf '%s\n' "$v"; return 0; fi
+    # 回落：CLI/JSON 不可用时直接读实装 package.json（目录名带 hash，只能 glob）
+    for f in "$oc_home"/npm/projects/*/node_modules/"$pkg"/package.json; do
+        [[ -f "$f" ]] || continue
+        v="$(python3 -c "import json;print(json.load(open('$f')).get('version',''))" 2>/dev/null)"
+        if [[ -n "$v" ]]; then printf '%s\n' "$v"; return 0; fi
+    done
+    return 1
+}
+
 # 装 openclaw-weixin 插件（config template 已预置 channel，但插件本体要 openclaw plugins install）
 # 读 tarball 内 openclaw-weixin.version.json 的 pin，走国内 npmmirror。
-# 幂等：openclaw plugins list 含 openclaw-weixin 则跳过。
+# 幂等：**已装版本 == pin 版本**才跳过；已装版本 ≠ pin 则 `--force` 升级到 pin。
+# （旧逻辑只 grep 插件名就 return，导致 bump pin 后已装实例永远停在旧版；
+#   `plugins install --force` = "Overwrite an existing installed plugin"，7.1-2 起就有该 flag。
+#   升级只换 npm/projects 下的包，登录态在 $OPENCLAW_HOME/openclaw-weixin/ 数据目录，不受影响。
+#   升级后需 gateway 重启才生效——更新路线在后面 refresh_gateway_env_only 里会重启。）
 install_weixin_plugin() {
     local claw_cmd="$WISEFLOW_ROOT/bin/openclaw"
     local pin_file="$WISEFLOW_ROOT/openclaw-weixin.version.json"
@@ -1085,16 +1116,26 @@ install_weixin_plugin() {
     fi
     pkg="${pkg:-@tencent-weixin/openclaw-weixin}"
     ver="${ver:-2.4.8}"
-    # 幂等检查：plugins list 已含则跳过
-    if "$claw_cmd" plugins list 2>/dev/null | grep -q "openclaw-weixin"; then
-        ui_success "openclaw-weixin plugin already installed"
+    # 幂等检查：已装版本 == pin 才跳过
+    local installed force_flag=""
+    installed="$(weixin_installed_version "$claw_cmd" "$pkg" || true)"
+    if [[ -n "$installed" && "$installed" == "$ver" ]]; then
+        ui_success "openclaw-weixin plugin already installed (${ver})"
         return 0
     fi
+    if [[ -n "$installed" ]]; then
+        ui_info "openclaw-weixin 已装 ${installed}，pin=${ver} → --force 升级"
+        force_flag="--force"
+    elif "$claw_cmd" plugins list 2>/dev/null | grep -q "openclaw-weixin"; then
+        # 插件在但版本读不到（CLI/JSON 异常）：按 pin 强制重装，保证与 pin 一致
+        ui_warn "openclaw-weixin 已装但版本读不到；按 pin ${ver} 强制重装"
+        force_flag="--force"
+    fi
     ui_info "Installing openclaw-weixin plugin (${pkg}@${ver}) via npmmirror"
-    if npm_config_registry=https://registry.npmmirror.com "$claw_cmd" plugins install "${pkg}@${ver}" --pin 2>/dev/null; then
-        ui_success "openclaw-weixin plugin installed"
+    if npm_config_registry=https://registry.npmmirror.com "$claw_cmd" plugins install "${pkg}@${ver}" --pin $force_flag 2>/dev/null; then
+        ui_success "openclaw-weixin plugin installed (${ver})"
     else
-        ui_warn "openclaw-weixin 插件安装失败；可后续手动：npm_config_registry=https://registry.npmmirror.com $claw_cmd plugins install ${pkg}@${ver} --pin"
+        ui_warn "openclaw-weixin 插件安装失败；可后续手动：npm_config_registry=https://registry.npmmirror.com $claw_cmd plugins install ${pkg}@${ver} --pin $force_flag"
     fi
 }
 
```

---

### Incident Patch 15: `53d4d19e` (2026-09-10)
**Commit Message**: fix(dna+expert-pack): 审核反馈修复——补业务植入 / CTA 两维、修 xhs 作品类型表、重写视频号 content-production

一、DNA 框架补两维（抖音 / 小红书 / 视频号，共 5 份框架）

- 新增 `biz-implant` 业务植入套路：是否植入、植入位置与时机、植入载体、方式原型
  （反转植入 / 痛点→方案 / 场景带入 / 实测对比 / 清单第 N 项 / 身份认同 / 口碑故事 /
  教程内嵌 / 硬广直给）、内容与业务的衔接句、植入密度与占比、品牌词出现方式。
- 新增 `interaction-cta` 互动引导与 CTA 套路（图文框架由原「互动引导与转化」升级而来）：
  行动目标与本篇主目标、CTA 位置与时机、句式与原文摘录、行动数量、诱因设计、
  与转化目标的对应、平台组件与合规边界。
- 与 `narration-script` 划界：口播子模块的「合」只记收束方式，CTA 目标与句式归
  `interaction-cta`；与 `video-form` 划界：形态层面的「影视解说 + 反转植入」记形态与
  制作指向，本维度记植入怎么设计。
- 聚合规则补硬要求：两维必须给出「位置 + 载体 + 原文摘录」三样证据，只写「自然植入」
  「引导关注」不算提取完成；无植入写「无植入（纯内容）」；平台红线记为必须避免项。
- 维度数：抖音 视频 10 / 图文 9，小红书 视频 11 / 图文 10，视频号 10。三份
  build_style_profile.py 的 DIMENSION_GROUPS / REPORT_DIMENSION_PROMPTS /
  TEMPLATE_STAGES / TEMPLATE_STAGE_FIELDS / TEMPLATE_CHECKLISTS 同步；template 新增
  「[业务植入与 CTA部分]」（图文侧取代原「互动与标签」段，话题标签策略仍在标题与封面段）。

二、删「统计与分词」

- 三个 style-profiler SKILL.md 的「## 统计与分词」段删除：分词（相邻二字组合）在脚本里
  算完从未渲染进 report 或 DNA 文档，属死代码；统计口径合并进「职责边界」一行。
- 脚本移除 extract_terms / terms / stable_terms / STOP_TERMS / ENGLISH_WORD_RE 及未使用的
  Counter、defaultdict、median 导入；同时删掉同样从未被读取的 weighted_coverage 聚合项。
- 框架文档里「高频词只是候选线索」相应改为「口头禅与签名表达必须回读原文确认」。

三、xhs-style-profiler 作品类

**File**: `crews/content-producer/skills/expert-video/SKILL.md` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ Workflow 文档在包内 `workflows/<字段值>.md`。Brief 指定了 `workflow`
 
 | 项 | 要求 |
 |----|------|
-| `brief.md` | 绝对路径。含视频类型/workflow、主题与观看理由、核心传达、时长与横竖屏、素材清单、封面要求、交付与验收、闸门批准人。**不含 DNA 信息**（甲方内部资产，本包不读也不用） |
+| `brief.md` | 绝对路径。含视频类型/workflow、主题与观看理由、核心传达、业务植入与 CTA（植入位置与方式、内容与业务的衔接句要求、CTA 主目标与句式）、时长与横竖屏、素材清单、封面要求、交付与验收、闸门批准人。**不含 DNA 信息**（甲方内部资产，本包不读也不用） |
 | 已有素材 | 绝对路径逐条列出，含来源与授权说明；本包只做入库校验与技术处理 |
 | 口播文案 | 有口播时由甲方出具（`voiceover.md`，绝对路径）。本包不重写策略文案，只做声画实现 |
 | 口播录音 | 明确真人口播时，甲方提供录音文件绝对路径 |
```

**File**: `crews/content-producer/skills/expert-video/workflows/reversal-ad.md` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@ Brief 里写 `workflow: reversal-ad` 时使用。本 workflow 只写这一类型
 | platform | douyin / wx_channel / xhs 等，用于画幅、时长带与合规边界 |
 | core_message | 本条必须传达的核心信息 |
 | product_points | 产品/服务事实、允许讲的能力、禁用承诺（只以 Brief 为准，不内置品牌事实） |
+| implant_cta | Brief「业务植入与 CTA」字段：植入位置与方式、内容与业务的衔接句要求、CTA 主目标与句式；未给时按本 workflow 默认（反转点 55%–76%、植入段单点深打、片尾一个主行动），并在 GATE A 说明 |
 | twist_variant | 任务指引式 / 双关置换式 / 身份彩蛋式 / 戏中戏式；未指定时由本包据素材与故事选定，并在 GATE A 说明理由 |
 | story_source | 解说正文的故事来源（开源片名 / 用户素材 / AIGC 生成） |
 | voiceover | 甲方交付口播终稿路径；未交付时写明由本包起草 |
```

**File**: `crews/main/skills/expert-douyin/SKILL.md` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ metadata:
 
 DNA 存储目录是 `douyin/dna/`。未指定 DNA 时默认使用并更新 `dna-0`（视频）；图文另建 dna-id（如 `dna-0-note`）。生产前同时读取 DNA 文档与 DNA template；对标分析先建立独立对标 DNA，不默认写入 `dna-0`。
 
-DNA 是**从一批作品样本提取并聚合出的内容生产规则集**：视频 8 维——选题与观看理由、标题与封面、内容创意、视频内容形态与制作指向、制作规格与视听倾向，加可选的口播文案子模块与账号运营子模块（简介写法、内容形式比例、发布习惯）；图文 8 维——选题、标题与封面图组、内容创意、正文表达与语气、图组视觉、互动引导与转化，加账号运营子模块。它指导 main agent 出图文内容或视频 Brief（+ 口播文案），不规定创作细节与成片制作。维度框架 v2 位于 `douyin-style-profiler` 的 `references/video-dna-framework.md` 与 `references/note-dna-framework.md`。
+DNA 是**从一批作品样本提取并聚合出的内容生产规则集**：视频 10 维——选题与观看理由、标题与封面、内容创意、**业务植入套路**、**互动引导与 CTA 套路**、视频内容形态与制作指向、制作规格与视听倾向，加可选的口播文案子模块与账号运营子模块（简介写法、内容形式比例、发布习惯）；图文 9 维——选题、标题与封面图组、内容创意、正文表达与语气、图组视觉、**业务植入套路**、**互动引导与 CTA 套路**，加账号运营子模块。它指导 main agent 出图文内容或视频 Brief（+ 口播文案），不规定创作细节与成片制作。维度框架 v2 位于 `douyin-style-profiler` 的 `references/video-dna-framework.md` 与 `references/note-dna-framework.md`。
 
 ## 数据与记录
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/SKILL.md` (modified, +13/-13)
```diff
@@ -1,6 +1,6 @@
 ---
 name: douyin-style-profiler
-description: 提取抖音作品 DNA：单篇作品（视频 / 图文）生成 report，按 dna-id 聚合选题、标题与封面、内容创意、视频形态与制作指向、制作规格、口播文案子模块与账号运营子模块，推导 main agent 的 Brief / 图文生产 template。
+description: 提取抖音作品 DNA：单篇作品（视频 / 图文）生成 report，按 dna-id 聚合选题、标题与封面、内容创意、业务植入套路、互动引导与 CTA 套路、视频形态与制作指向、制作规格、口播文案子模块与账号运营子模块，推导 main agent 的 Brief / 图文生产 template。
 metadata:
   openclaw:
     emoji: 🧬
@@ -33,7 +33,7 @@ DNA 的用途是指导 main agent 选题、包装、出内容或出视频制作
 DNA 文档 -> DNA template
 ```
 
-- **DNA report**：单篇作品的样本观测 + 维度提取结果（不是账号级结论，也不是模板）。
+- **DNA report**：单篇作品的样本观测 + 维度提取结果；跨篇共性与生产规则由聚合阶段给出，report 本身不是模板。
 - **DNA 文档**：聚合后的生产规则、样本覆盖度、子模块结论与用户输入转译区。
 - **DNA template**：main agent 的生产输入模板（视频 = Brief 正文 + 口播文案；图文 = 写作模板）。
 
@@ -55,11 +55,11 @@ douyin/dna/{dna-id}/
 
 - 抖音视频与图文都常见：先判作品类型再选框架，不要把图文笔记塞进视频 DNA。
 - 单篇 report 只提供候选信号，不判断跨篇稳定性；共性、偏好、孤例由聚合阶段判断。
-- 统计只做证据底座，不评分、不判定风格是否合格。
+- 脚本统计（句长、问句与人称密度、感叹号密度、口播密度；图文另有标题字数、正文行数、emoji 密度、话题标签数）只做证据底座，不评分、不判定风格是否合格；口头禅与签名式表达必须由 Agent 回读原文确认，不能凭统计直接下 DNA 结论。
 - 视觉维度必须有图片 / 关键帧证据，由视觉模型读取；缺失写「未提供」，不得凭文本想象补齐。
 - 口播文案子模块只在口播类作品启用；样本不足写「未启用」。
 - 账号运营子模块（简介写法、内容形式比例、发布习惯）只在样本来自对标账号批量提取时填写，且**不进 template**。
-- 不输出合规结论、账号权重或风格评分。
+- 不输出风格评分或账号权重；合规只记「必须避免项」（虚假承诺、利益诱导互动、隐藏站外联系方式、谐音绕检测），不出具合规审查结论。
 
 ## Report — 单篇提取
 
@@ -141,9 +141,10 @@ douyin-style-profiler update \
 1. 选题
 2. 标题与封面
 3. 内容创意
-4. 视频形态与制作指向
-5. 制作规格
-6. 口播文案
+4. 业务植入与 CTA
+5. 视频形态与制作指向
+6. 制作规格
+7. 口播文案
 
 **图文作品 template（= 图文写作模板）**
 
@@ -152,7 +153,7 @@ douyin-style-profiler update \
 3. 内容创意与结构
 4. 正文表达
 5. 图组
-6. 互动与标签
+6. 业务植入与 CTA
 
 - 开头两段（**选题**、**标题与封面**）跨平台通用。
 - 视频 template 的各段直接对应 Brief 正文字段；**Brief 不含 DNA 信息**（Content Producer 看不到 main 的 DNA），素材清单与授权、验收标准、闸门批准人按平台 Content Production Workflow 填。
@@ -191,6 +192,8 @@ narration-script：口播保持第三人称解说体，句长 10-15 字
 | `content-idea` | 内容创意 |
 | `video-form` | 视频内容形态与制作指向 |
 | `production-spec` | 制作规格与视听倾向 |
+| `biz-implant` | 业务植入套路 |
+| `interaction-cta` | 互动引导与 CTA 套路 |
 | `narration-script` | 口播文案子DNA |
 | `account-bio` | 账号简介写法 |
 | `content-mix-cadence` | 内容形式比例与发布习惯 |
@@ -204,16 +207,13 @@ narration-script：口播保持第三人称解说体，句长 10-15 字
 | `content-idea` | 内容创意 |
 | `body-voice` | 正文表达与语气 |
 | `imageset-visual` | 图组视觉风格 |
-| `interaction-cta` | 互动引导与转化 |
+| `biz-implant` | 业务植入套路 |
+| `interaction-cta` | 互动引导与 CTA 套路 |
 | `account-bio` | 账号简介写法 |
 | `content-mix-cadence` | 内容形式比例与发布习惯 |
 
 `--focus` 按作品类型校验：视频 report 不接受图文维度 ID，反之亦然。
 
-## 统计与分词
-
-脚本统计句长、问句与人称密度、感叹号密度、口播密度（视频）/ 标题字数、正文行数、emoji 密度、话题标签数（图文）等指标作为聚合证据底座；中文高频信号使用相邻二字组合，仅作候选线索。口头禅与签名式表达必须由 Agent 回读原文确认，分词结果不能直接当 DNA 结论。
-
 ## 参考资料
 
 - `references/video-dna-framework.md`（抖音视频作品 DNA 框架 v2：维度定义、制作指向映射、聚合边界与 Focus ID）
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/references/note-dna-framework.md` (modified, +14/-12)
```diff
@@ -1,11 +1,11 @@
 # 抖音图文作品 DNA 框架（v2）
 
-> 状态：v2（2026-09-10）。Focus ID、维度命名与 template 语义以本文件为准；调整维度必须升版本，并同步 `scripts/build_style_profile.py` 与工具 `SKILL.md`。
+> 状态：v2（2026-09-10 修订：补业务植入套路 `biz-implant` 与互动引导 / CTA 套路 `interaction-cta` 两维）。Focus ID、维度命名与 template 语义以本文件为准；调整维度必须升版本，并同步 `scripts/build_style_profile.py` 与工具 `SKILL.md`。
 > 抖音有两套框架：视频作品用 `video-dna-framework.md`，本文件是**图文作品**框架。
 
 ## 定位与边界
 
-DNA 不是「平台级 DNA」，也不是账号人设说明书，而是**从一批作品样本中提取、聚合出的内容生产规则集**。生产方式与其他平台完全一致，仍是三层产物：
+DNA 是**从一批作品样本中提取、聚合出的内容生产规则集**：它回答「这类作品怎么选、怎么包装、业务怎么植入、怎么引导行动」，不是账号人设说明书。生产方式与其他平台完全一致，仍是三层产物：
 
 ```text
 单篇作品 -> DNA report（本框架的维度逐项提取）
@@ -21,11 +21,11 @@ DNA 文档 -> DNA template
 
 | 进 DNA | 不进 DNA |
 |--------|----------|
-| 选题与观看理由、标题与封面写法、内容创意原型、正文表达与语气、图组视觉、互动引导与转化、（对标账号）账号运营子模块 | 创作细节、脚本结构、逐句台词、镜头表、转场与编码参数——那些归 Content Producer |
+| 选题与观看理由、标题与封面写法、内容创意原型、正文表达与语气、图组视觉、业务植入套路、互动引导与 CTA 套路、（对标账号）账号运营子模块 | 创作细节、脚本结构、逐句台词、镜头表、转场与编码参数——那些归 Content Producer |
 
 图文 DNA 的用途是指导 main agent 直接生产图文作品；template 就是图文写作模板。账号运营子模块（简介写法、内容形式比例、发布习惯）只写进 DNA 文档，**不进 template**。
 
-## 维度（8 维）
+## 维度（9 维）
 
 ### 一、选题与包装
 
@@ -47,28 +47,30 @@ DNA 文档 -> DNA template
 | 4 | `body-voice` | 正文表达与语气 | 开头钩子、正文组织方式（清单体 / 教程步骤 / 故事线 / 对比 / 观点输出）、分行与段落节奏、口语化程度与人称、emoji 与标点用法、签名式表达 |
 | 5 | `imageset-visual` | 图组视觉风格 | 图片数量与顺序、构图类型（产品展示 / 场景 / 文字卡片 / 对比图 / 过程图）、图文信息分工、色调与质感、版式一致性、文字视觉 |
 
-### 四、互动与转化
+### 四、业务植入与转化
 
 | # | ID | 维度 | 观测内容 |
 |---|----|------|----------|
-| 6 | `interaction-cta` | 互动引导与转化 | 评论 / 收藏 / 关注 / 进店 / 咨询等平台内行动的引导方式与位置、每篇行动引导数量、话题标签承载的意图、合规边界 |
+| 6 | `biz-implant` | 业务植入套路 | 是否有业务植入（纯内容 / 软植入 / 硬广直给）、植入位置（开头 / 中段某一步 / 结尾 / 图组某一图 / 评论区自评）、植入载体（案例与数据、清单第 N 项、教程步骤内嵌、痛点故事转折、对比实测、产品截图、体验记录）、植入方式原型（痛点→方案 / 场景带入 / 实测对比 / 清单第 N 项 / 身份认同 / 口碑故事 / 教程内嵌 / 硬广直给）、内容与业务的衔接句（转折句原文）、植入密度与占比（正文字数占比、品牌词与产品名出现次数与方式） |
+| 7 | `interaction-cta` | 互动引导与 CTA 套路 | 行动目标（评论 / 收藏 / 关注 / 进店 / 咨询 / 搜索品牌词）与本篇主目标、CTA 位置与时机（首段钩子后 / 正文中段 / 结尾 / 图组末图 / 评论区自评）、CTA 句式与原文摘录（命令式 / 提问式 / 利益式 / 身份式）、一篇放几个行动、诱因设计（利益点 / 情绪 / 身份认同 / 稀缺）、话题标签承载的意图、与业务转化目标的对应、合规边界 |
 
 ### 五、账号运营子模块（对标账号样本才有）
 
 | # | ID | 维度 | 观测内容 |
 |---|----|------|----------|
-| 7 | `account-bio` | 账号简介写法 | 账号昵称、简介写法、主页与置顶表达、对外承诺（仅对标账号样本可得） |
-| 8 | `content-mix-cadence` | 内容形式比例与发布习惯 | 图文 / 视频等内容形式比例、发布时间段与频率、内容形式混合节奏（如三篇图文对一篇视频）、栏目化节奏（仅对标账号批量样本可得） |
+| 8 | `account-bio` | 账号简介写法 | 账号昵称、简介写法、主页与置顶表达、对外承诺（仅对标账号样本可得） |
+| 9 | `content-mix-cadence` | 内容形式比例与发布习惯 | 图文 / 视频等内容形式比例、发布时间段与频率、内容形式混合节奏（如三篇图文对一篇视频）、栏目化节奏（仅对标账号批量样本可得） |
 
 ## Report 与聚合规则
 
 1. 单篇 report 先填「样本观测」：作品类型、样本来源、账号与简介、发布时间、数据线索、图片数量与来源、关键词与标签。缺失一律写「未观测」，不得编造。
 2. 单篇 report 不判断跨篇稳定性；聚合时区分高覆盖共性、高权重样本偏好、局部借鉴（focus）、孤例与例外，并标注样本覆盖度。
 3. 视觉维度（封面 / 首帧 / 图组）必须有图片证据，由视觉模型读取本地图片后反推 AIGC 复现要素；没有图片写「未提供」。
-4. 正文表达维度里的高频词、口头禅与签名表达只是候选线索，必须回读原文确认后才能进 DNA 文档。
+4. 正文表达维度里的口头禅与签名表达只是候选线索，必须回读原文确认后才能进 DNA 文档。
 5. 账号运营子模块（`account-bio`、`content-mix-cadence`）只在样本来自对标账号批量提取时填写；用户只提供单篇时写「未观测」。
 6. 脚本统计只作证据底座（标题字数、正文行数、句长、问句密度、emoji 密度、话题标签数），不生成总分、不判定风格是否合格。
-7. 高数据样本必须回读创意、结构与关键词再归因，不得把高阅读直接等同于风格好。
+7. 业务植入与 CTA 两个维度必须给出**位置 + 载体 + 原文摘录**三样证据；只写「自然植入」「引导关注」这类空泛结论不算提取完成。本篇没有业务植入时明确写「无植入（纯内容）」，不得留空；平台红线（虚假承诺、利益诱导互动、隐藏站外联系方式、谐音绕检测）一律记为必须避免项。
+8. 高数据样本必须回读创意、结构与关键词再归因，不得把高阅读直接等同于风格好。
 
 ## Template 语义
 
@@ -79,7 +81,7 @@ DNA template = **图文写作模板**，固定语义段如下（脚本 `build` /
 3. **[内容创意与结构部分]** — 创意原型、正文组织方式、信息密度、记忆点、避免
 4. **[正文表达部分]** — 开头钩子、推进方式、段落与分行节奏、人称与语气、emoji 与标点、签名式表达、必须做、避免
 5. **[图组部分]** — 图片数量与顺序、构图类型、色调与质感、版式一致性、文字视觉、AIGC 提示词要素
-6. **[互动与标签部分]** — 互动目标、引导方式、话题标签策略、合规边界
+6. **[业务植入与 CTA部分]** — 植入位置与时机、植入载体与方式原型、内容与业务的衔接句、植入密度与占比、CTA 主目标、CTA 位置与句式、诱因与合规红线、避免
 
 - 开头两段（**选题**、**标题与封面**）跨平台通用：任何生产都先解决「做什么」和「怎么命名、怎么呈现封面」。
 - `[图组部分]` 与 `[正文表达部分]` 是两条并行的生产轨道：图组规则管视觉，正文规则管文字。
@@ -96,7 +98,7 @@ DNA template = **图文写作模板**，固定语义段如下（脚本 `build` /
 | 选题与包装 | `topic-angle` `title-cover` |
 | 内容创意 | `content-idea` |
 | 正文与视觉 | `body-voice` `imageset-visual` |
-| 互动与转化 | `interaction-cta` |
+| 业务植入与转化 | `biz-implant` `interaction-cta` |
 | 账号运营子模块（对标账号样本才有） | `account-bio` `content-mix-cadence` |
 
 focus 校验按作品类型执行：视频 report 不接受图文维度 ID，反之亦然。
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/references/video-dna-framework.md` (modified, +23/-13)
```diff
@@ -1,11 +1,11 @@
 # 抖音视频作品 DNA 框架（v2）
 
-> 状态：v2（2026-09-10）。Focus ID、维度命名与 template 语义以本文件为准；调整维度必须升版本，并同步 `scripts/build_style_profile.py` 与工具 `SKILL.md`。
+> 状态：v2（2026-09-10 修订：补业务植入套路 `biz-implant` 与互动引导 / CTA 套路 `interaction-cta` 两维）。Focus ID、维度命名与 template 语义以本文件为准；调整维度必须升版本，并同步 `scripts/build_style_profile.py` 与工具 `SKILL.md`。
 > 抖音有两套框架：图文作品用 `note-dna-framework.md`，本文件是**视频作品**框架。
 
 ## 定位与边界
 
-DNA 不是「平台级 DNA」，也不是账号人设说明书，而是**从一批作品样本中提取、聚合出的内容生产规则集**。生产方式与其他平台完全一致，仍是三层产物：
+DNA 是**从一批作品样本中提取、聚合出的内容生产规则集**：它回答「这类作品怎么选、怎么包装、业务怎么植入、怎么引导行动」，不是账号人设说明书。生产方式与其他平台完全一致，仍是三层产物：
 
 ```text
 单篇作品 -> DNA report（本框架的维度逐项提取）
@@ -21,11 +21,11 @@ DNA 文档 -> DNA template
 
 | 进 DNA | 不进 DNA |
 |--------|----------|
-| 选题与观看理由、标题与封面写法、内容创意原型、视频内容形态与制作指向、制作规格与视听倾向、（口播类）口播文案子DNA、（对标账号）账号运营子模块 | 创作细节、脚本结构、逐句台词、镜头表、转场与编码参数——那些归 Content Producer |
+| 选题与观看理由、标题与封面写法、内容创意原型、业务植入套路、互动引导与 CTA 套路、视频内容形态与制作指向、制作规格与视听倾向、（口播类）口播文案子DNA、（对标账号）账号运营子模块 | 创作细节、脚本结构、逐句台词、镜头表、转场与编码参数——那些归 Content Producer |
 
 视频 DNA 的用途是指导 main agent 出具 **Brief.md** 与（口播类的）**口播文案**。template 就是 Brief 正文模板 + 口播文案模板（可选），不是成片制作模板。账号运营子模块（简介写法、内容形式比例、发布习惯）只写进 DNA 文档，**不进 template**。
 
-## 维度（8 维）
+## 维度（10 维）
 
 ### 一、选题与包装
 
@@ -47,18 +47,25 @@ DNA 文档 -> DNA template
 | 4 | `video-form` | 视频内容形态与制作指向 | 视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）+ 判定依据 + **制作指向**（见下方映射表） |
 | 5 | `production-spec` | 制作规格与视听倾向 | 横屏或竖屏、时长带、画面风格（色调、质感、字幕样式倾向、信息密度）、配音音色与声音形态（原声口播 / TTS / 旁白 / 纯画面字幕）、BGM 与音效倾向、封面规格 |
 
-### 四、口播文案子模块（可选，仅口播类启用）
+### 四、业务植入与转化
 
 | # | ID | 维度 | 观测内容 |
 |---|----|------|----------|
-| 6 | `narration-script` | 口播文案子DNA | 起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束与 CTA）、人称与语气、句长与语速、签名式表达——用于指导 main agent 写同类型视频的口播文案 |
+| 6 | `biz-implant` | 业务植入套路 | 是否有业务植入（纯内容 / 软植入 / 硬广直给）、植入位置与时机（前 3 秒 / 中段转折 / 结尾收束 / 反转点 / 评论区置顶 / 主页与组件）、植入载体（剧情道具、口播一句话、字幕卡片、场景背景、案例与数据、测评对象、购物车或留资组件、私信与主页引导）、植入方式原型（反转植入 / 痛点→方案 / 场景带入 / 实测对比 / 清单第 N 项 / 身份认同 / 口碑故事 / 教程内嵌 / 硬广直给）、内容与业务的衔接句（转折触发词原文）、植入密度与占比（时长占比、品牌词与产品名出现次数与方式）；形态层面的「影视解说 + 反转植入」在 `video-form` 记形态与制作指向，本维度记植入怎么设计 |
+| 7 | `interaction-cta` | 互动引导与 CTA 套路 | 行动目标（关注 / 评论关键词 / 私信 / 主页点击 / 搜索品牌词 / 购物车 / 直播预约 / 转发）与本篇主目标、CTA 出现位置与时机（口播收尾句 / 字幕卡 / 片尾贴片 / 描述区 / 评论区置顶）、CTA 句式与原文摘录（命令式 / 提问式 / 利益式 / 身份式 / 悬念式）、一篇放几个行动、诱因设计（利益点 / 情绪 / 身份认同 / 稀缺）、与业务转化目标的对应、平台组件挂载与合规边界 |
 
-### 五、账号运营子模块（对标账号样本才有）
+### 五、口播文案子模块（可选，仅口播类启用）
 
 | # | ID | 维度 | 观测内容 |
 |---|----|------|----------|
-| 7 | `account-bio` | 账号简介写法 | 账号昵称、简介写法、主页与置顶表达、对外承诺（仅对标账号样本可得） |
-| 8 | `content-mix-cadence` | 内容形式比例与发布习惯 | 图文 / 视频等内容形式比例、发布时间段与频率、内容形式混合节奏（如三篇图文对一篇视频）、栏目化节奏（仅对标账号批量样本可得） |
+| 8 | `narration-script` | 口播文案子DNA | 起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束方式；CTA 的目标、位置与句式记在 `interaction-cta`）、人称与语气、句长与语速、签名式表达——用于指导 main agent 写同类型视频的口播文案 |
+
+### 六、账号运营子模块（对标账号样本才有）
+
+| # | ID | 维度 | 观测内容 |
+|---|----|------|----------|
+| 9 | `account-bio` | 账号简介写法 | 账号昵称、简介写法、主页与置顶表达、对外承诺（仅对标账号样本可得） |
+| 10 | `content-mix-cadence` | 内容形式比例与发布习惯 | 图文 / 视频等内容形式比例、发布时间段与频率、内容形式混合节奏（如三篇图文对一篇视频）、栏目化节奏（仅对标账号批量样本可得） |
 
 ## Report 与聚合规则
 
@@ -68,7 +75,8 @@ DNA 文档 -> DNA template
 4. 口播文案子模块只在口播类作品启用；非口播类或样本不足写「未启用 / 未观测」，不得把单篇句式上升为规则。
 5. 账号运营子模块（`account-bio`、`content-mix-cadence`）只在样本来自对标账号批量提取时填写；用户只提供单篇时写「未观测」。
 6. 脚本统计只作证据底座（句长、问句密度、人称密度、感叹号密度、口播密度），不生成总分、不判定风格是否合格。
-7. 高数据样本必须回读创意、形态与包装再归因，不得把高播放直接等同于风格好。
+7. 业务植入与 CTA 两个维度必须给出**位置 + 载体 + 原文摘录**三样证据；只写「自然植入」「引导关注」这类空泛结论不算提取完成。本篇没有业务植入时明确写「无植入（纯内容）」，不得留空；平台红线（虚假承诺、利益诱导互动、隐藏站外联系方式、谐音绕检测）一律记为必须避免项。
+8. 高数据样本必须回读创意、形态与包装再归因，不得把高播放直接等同于风格好。
 
 ## Template 语义
 
@@ -77,9 +85,10 @@ DNA template = **Brief.md 正文模板 + 口播文案模板（可选）**，固
 1. **[选题部分]** — 选题角度推荐、选题需考虑的受众关联角度、内容支柱与系列关系、避免
 2. **[标题与封面部分]** — 标题类型、参考标题、封面或首帧风格、封面 AIGC 提示词要素、话题标签策略
 3. **[内容创意部分]** — 创意原型、展开逻辑、记忆点与反转设计、触发条件、避免
-4. **[视频形态与制作指向部分]** — 视频内容形态、制作指向、委托边界、未指定形态时
-5. **[制作规格部分]** — 横屏或竖屏、时长带、画面风格、配音音色与声音形态、BGM 与音效、字幕
-6. **[口播文案部分]** — 是否启用、起、承、转、合、人称与语气、句长与语速、签名式表达、必须做、避免
+4. **[业务植入与 CTA部分]** — 植入位置与时机、植入载体与方式原型、内容与业务的衔接句、植入密度与占比、CTA 主目标、CTA 位置与句式、诱因与合规红线、避免
+5. **[视频形态与制作指向部分]** — 视频内容形态、制作指向、委托边界、未指定形态时
+6. **[制作规格部分]** — 横屏或竖屏、时长带、画面风格、配音音色与声音形态、BGM 与音效、字幕
+7. **[口播文案部分]** — 是否启用、起、承、转、合、人称与语气、句长与语速、签名式表达、必须做、避免
 
 - 开头两段（**选题**、**标题与封面**）跨平台通用：任何生产都先解决「做什么」和「怎么命名、怎么呈现封面」。
 - `[视频形态与制作指向部分]` 的「制作指向」必须写下方映射表里的真实资源名，Brief 的 `workflow` 字段据此填写。
@@ -111,6 +120,7 @@ Brief 写了 `workflow` 时 Content Producer 必须直接采用，不得替换
 | 选题与包装 | `topic-angle` `title-cover` |
 | 内容创意 | `content-idea` |
 | 形态与规格 | `video-form` `production-spec` |
+| 业务植入与转化 | `biz-implant` `interaction-cta` |
 | 口播文案子模块（可选，仅口播类启用） | `narration-script` |
 | 账号运营子模块（对标账号样本才有） | `account-bio` `content-mix-cadence` |
 
```

**File**: `crews/main/skills/expert-douyin/tools/douyin-style-profiler/scripts/build_style_profile.py` (modified, +10/-70)
```diff
@@ -10,16 +10,13 @@
 脚本只做 scaffold 与统计证据底座：不评分、不判定风格合格，定性结论由 Agent 回读原文补齐。
 """
 import argparse, json, math, re, shutil
-from collections import Counter, defaultdict
 from datetime import datetime, timezone
 from pathlib import Path
-from statistics import median
 
 
 SENTENCE_SPLIT = re.compile(r"[。！？!?]+")
 PARAGRAPH_SPLIT = re.compile(r"\n\s*\n")
 TOKEN_RE = re.compile(r"[一-鿿A-Za-z0-9_]+")
-ENGLISH_WORD_RE = re.compile(r"[A-Za-z0-9_]+")
 SECOND_PERSON_RE = re.compile(r"你们?|you", re.IGNORECASE)
 FIRST_PERSON_RE = re.compile(r"我们?|I|we", re.IGNORECASE)
 QUESTION_RE = re.compile(r"[？?]")
@@ -71,14 +68,15 @@
         "选题与包装": [("topic-angle", "选题与观看理由"), ("title-cover", "标题与封面")],
         "内容创意": [("content-idea", "内容创意")],
         "形态与规格": [("video-form", "视频内容形态与制作指向"), ("production-spec", "制作规格与视听倾向")],
+        "业务植入与转化": [("biz-implant", "业务植入套路"), ("interaction-cta", "互动引导与 CTA 套路")],
         "口播文案子模块（可选，仅口播类启用）": [("narration-script", "口播文案子DNA")],
         "账号运营子模块（对标账号样本才有）": [("account-bio", "账号简介写法"), ("content-mix-cadence", "内容形式比例与发布习惯")],
     },
     "note": {
         "选题与包装": [("topic-angle", "选题与观看理由"), ("title-cover", "标题与封面图组")],
         "内容创意": [("content-idea", "内容创意")],
         "正文与视觉": [("body-voice", "正文表达与语气"), ("imageset-visual", "图组视觉风格")],
-        "互动与转化": [("interaction-cta", "互动引导与转化")],
+        "业务植入与转化": [("biz-implant", "业务植入套路"), ("interaction-cta", "互动引导与 CTA 套路")],
         "账号运营子模块（对标账号样本才有）": [("account-bio", "账号简介写法"), ("content-mix-cadence", "内容形式比例与发布习惯")],
     },
 }
@@ -108,10 +106,11 @@
     "content-idea": "- 单篇观测：一句话创意内核、创意类型、展开逻辑（悬念 / 反转 / 递进 / 对比 / 清单 / 实测）、记忆点。\n- 可复用信号：这个创意套路换成别的主题还能怎么用。\n- 边界：只记创意层，不记创作细节（逐句台词、镜头表、脚本结构、转场与编码参数）。",
     "video-form": "- 单篇观测：视频内容形态（口播 / 实拍拼接 / 影视解说+反转植入 / 纯 AIGC 动画 / 创意转场动效 / 录屏演示 / 图文卡片视频 / 混合）与判定依据（画面证据、口播占比、素材来源）。\n- 制作指向：必须落到真实存在的资源名——Content Producer `expert-video` 的某个 workflow（Reversal Ad / Narration Video / Collage B-roll / 通用阶段链），或 main 的素材加工技能（`video-edit` / `talking-head-cut` / `ui-demo`）；不得发明不存在的名字。",
     "production-spec": "- 单篇观测：横屏或竖屏、时长带、画面风格（色调、质感、字幕样式倾向、信息密度）、配音音色与声音形态（原声口播 / TTS / 旁白 / 纯画面字幕）、BGM 与音效倾向、封面规格。\n- 边界：只记规格与倾向，不规定镜头参数、逐镜设计、转场与编码细节——那些归 Content Producer。",
-    "narration-script": "- 子模块（仅口播类作品启用）：起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束与 CTA），以及人称与语气、句长与语速、签名式表达。\n- 边界：非口播类或证据不足时写「未启用 / 未观测」；不得把单篇句式直接上升为规则。",
+    "narration-script": "- 子模块（仅口播类作品启用）：起（从什么起步）、承（靠什么推进）、转（转折触发）、合（收束方式；CTA 的目标、位置与句式记在 `interaction-cta`），以及人称与语气、句长与语速、签名式表达。\n- 边界：非口播类或证据不足时写「未启用 / 未观测」；不得把单篇句式直接上升为规则。",
     "body-voice": "- 单篇观测：开头钩子（原文摘录）、正文组织方式（清单体 / 教程步骤 / 故事线 / 对比 / 观点输出）、分行与段落节奏、口语化程度与人称、emoji 与标点用法、签名式表达。\n- 证据边界：脚本统计只给句长 / 行数 / emoji / 标签等线索；口头禅与签名表达必须回读原文确认。",
     "imageset-visual": "- 单篇观测：图片数量与顺序、构图类型（产品展示 / 场景 / 文字卡片 / 对比图 / 过程图）、图文信息分工、色调与质感、版式一致性、文字视觉。\n- 视觉证据：必须由视觉模型读取本地图片并反推 AIGC 复现要素；无图片写「未提供」，不得凭正文想象补齐。",
-    "interaction-cta": "- 单篇观测：评论 / 收藏 / 关注 / 进店 / 咨询等平台内行动的引导方式与位置、每篇行动引导数量、话题标签承载的意图。\n- 合规边界：不隐藏站外联系方式、不绕平台检测、不以利益换互动，记为必须避免项。",
+    "biz-implant": "- 单篇观测：是否有业务植入（纯内容 / 软植入 / 硬广直给）、植入位置与时机、植入载体（剧情道具 / 口播一句话 / 字幕卡片 / 场景背景 / 案例与数据 / 清单第 N 项 / 教程步骤内嵌 / 产品截图 / 购物车或留资组件 / 主页与私信引导）、植入方式原型（反转植入 / 痛点→方案 / 场景带入 / 实测对比 / 身份认同 / 口碑故事 / 教程内嵌 / 硬广直给）、内容与业务的衔接句（原文摘录）、植入密度与占比、品牌词与产品名出现方式与频次。\n- 证据要求：位置 + 载体 + 原文摘录三样齐全；本篇无植入时写「无植入（纯内容）」，不得留空。\n- 边界：只记植入套路，不写逐句广告文案；形态层面的「影视解说 + 反转植入」由 `video-form` 记形态与制作指向。",
+    "interaction-cta": "- 单篇观测：行动目标（关注 / 评论 / 收藏 / 转发 / 私信 / 主页点击 / 进店 / 咨询 / 搜索品牌词 / 购物车 / 直播预约）与本篇主目标、CTA 出现位置与时机（口播收尾句 / 字幕卡 / 片尾贴片 / 描述区 / 正文结尾 / 图组末图 / 评论区）、CTA 句式与原文摘录（命令式 / 提问式 / 利益式 / 身份式 / 悬念式）、一篇放几个行动、诱因设计（利益点 / 情绪 / 身份认同 / 稀缺）、与业务转化目标的对应。\n- 合规边界：不隐藏站外联系方式、不绕平台检测、不以利益换互动，记为必须避免项。",
     "account-bio": "- 子模块（仅对标账号样本可得）：账号昵称、简介写法、主页与置顶表达、对外承诺。\n- 边界：用户提供的单篇样本无法观测时写「未观测」，不得推导。",
     "content-mix-cadence": "- 子模块（仅对标账号批量样本可得）：图文 / 视频等内容形式比例、发布时间段与频率、内容形式混合节奏（如三篇图文对一篇视频）、栏目化节奏。\n- 边界：必须由账号发布列表的批量样本推导；单篇样本只记本篇发布时间。",
 }
@@ -122,8 +121,8 @@
 }
 
 TEMPLATE_STAGES = {
-    "video": ("选题", "标题与封面", "内容创意", "视频形态与制作指向", "制作规格", "口播文案"),
-    "note": ("选题", "标题与封面", "内容创意与结构", "正文表达", "图组", "互动与标签"),
+    "video": ("选题", "标题与封面", "内容创意", "业务植入与 CTA", "视频形态与制作指向", "制作规格", "口播文案"),
+    "note": ("选题", "标题与封面", "内容创意与结构", "正文表达", "图组", "业务植入与 CTA"),
 }
 
 TEMPLATE_STAGE_FIELDS = {
@@ -133,10 +132,10 @@
     "视频形态与制作指向": ("视频内容形态", "制作指向", "委托边界", "未指定形态时"),
     "制作规格": ("横屏或竖屏", "时长带", "画面风格", "配音音色与声音形态", "BGM 与音效", "字幕"),
     "口播文案": ("是否启用", "起", "承", "转", "合", "人称与语气", "句长与语速", "签名式表达", "必须做", "避免"),
+    "业务植入与 CTA": ("植入位置与时机", "植入载体与方式原型", "内容与业务的衔接句", "植入密度与占比", "CTA 主目标", "CTA 位置与句式", "诱因与合规红线", "避免"),
     "内容创意与结构": ("创意原型", "正文组织方式", "信息密度", "记忆点", "避免"),
     "正文表达": ("开头钩子", "推进方式", "段落与分行节奏", "人称与语气", "emoji 与标点", "签名式表达", "必须做", "避免"),
     "图组": ("图片数量与顺序", "构图类型", "色调与质感", "版式一致性", "文字视觉", "AIGC 提示词要素"),
-    "互动与标签": ("互动目标", "引导方式", "话题标签策略", "合规边界"),
 }
 
 TEMPLATE_INTROS = {
@@ -145,8 +144,8 @@
 }
 
 TEMPLATE_CHECKLISTS = {
-    "video": "- 是否只用一个 DNA，且作品类型与该 DNA 的 `kind` 一致。\n- 
```

**File**: `crews/main/skills/expert-douyin/workflows/account-benchmark.md` (modified, +3/-3)
```diff
@@ -73,13 +73,13 @@ douyin/dna/{benchmark-dna-id}/{benchmark-dna-id}.dna.md
 douyin/dna/{benchmark-dna-id}/{benchmark-dna-id}.template.md
 ```
 
-对标 DNA template 用语义段与目标 DNA 一致：视频 = 选题、标题与封面、内容创意、视频形态与制作指向、制作规格、口播文案（可选）；图文 = 选题、标题与封面、内容创意与结构、正文表达、图组、互动与标签。每一部分都要能从对标 DNA 文档推导；账号运营子模块不进 template。
+对标 DNA template 用语义段与目标 DNA 一致：视频 = 选题、标题与封面、内容创意、业务植入与 CTA、视频形态与制作指向、制作规格、口播文案（可选）；图文 = 选题、标题与封面、内容创意与结构、正文表达、图组、业务植入与 CTA。每一部分都要能从对标 DNA 文档推导；账号运营子模块不进 template。
 
 ### Step 3 - 模式分析与差异化（agent 推理）
 
 基于对标 DNA 与样本数据，回答三个问题（不下没有证据的结论）：
 
-1. **它为什么有效**：对标账号的高表现内容在选题、标题包装、内容形式、发布节奏、高数据创意与互动设计上有什么共性？哪些信号在多条视频中稳定出现？
+1. **它为什么有效**：对标账号的高表现内容在选题、标题包装、内容形式、业务植入与 CTA、发布节奏、高数据创意与互动设计上有什么共性？哪些信号在多条视频中稳定出现？
 2. **相对表现**：同一账号内部，哪类内容明显高于其他条（用用户提供的互动数据判断；无数据时只做内容面分析，不编数据）。
 3. **差异化切入点**：我们的账号比对标强在哪、弱在哪？有哪些内容空白或人群空白可以切入？每个切入点说明依据和建议的验证方式（一条视频验证一个变量）。
 
@@ -100,7 +100,7 @@ douyin/dna/{base-dna-id}/{base-dna-id}.template.md
 
 比较必须覆盖两层：
 
-1. **DNA 文档**：逐个比较选题与观看理由、标题与封面、内容创意、视频形态与制作指向、制作规格、口播文案子模块，以及账号运营子模块（简介写法、内容形式比例、发布习惯）。
+1. **DNA 文档**：逐个比较选题与观看理由、标题与封面、内容创意、业务植入套路、互动引导与 CTA 套路、视频形态与制作指向、制作规格、口播文案子模块，以及账号运营子模块（简介写法、内容形式比例、发布习惯）。
 2. **template 语义段**：按作品类型逐项比较（视频看 Brief 相关段，图文看写作段）。
 
 每个维度和模板语义段都输出四类结论：
```

#### Recent Merged Pull Requests:
- **PR #477** (2026-09-20): v5.7.2 release (@bigbrother666sh)
- **PR #475** (2026-09-15): 5.71 release (@bigbrother666sh)
- **PR #474** (2026-08-30): 5.70 publish (@bigbrother666sh)
- **PR #472** (2026-08-15): fix: 5.6.6 (@bigbrother666sh)
- **PR #471** (2026-08-12): bug fix && docker deploy (@bigbrother666sh)
- **PR #470** (2026-08-10): 5.6.3 bugfix (@bigbrother666sh)
- **PR #469** (2026-08-07): update readme (@bigbrother666sh)
- **PR #468** (2026-08-06): v5.6.3：百炼主力 + Content Producer 正式发布 + 数据闭环 + install bug 修复 (@bigbrother666sh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
