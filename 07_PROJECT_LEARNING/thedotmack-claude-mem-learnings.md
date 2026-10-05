# Forensic Learning Record (Deep Inspection): thedotmack/claude-mem

> **Canonical Artifact**: `07_PROJECT_LEARNING/thedotmack-claude-mem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thedotmack/claude-mem](https://github.com/thedotmack/claude-mem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:24.147Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thedotmack/claude-mem`
- **Description**: Persistent Context Across Sessions for Every Agent –  Captures everything your agent does during sessions, compresses it with AI, and injects relevant context back into future sessions. Works with Claude Code, OpenClaw, Codex, Gemini, Hermes, Copilot, OpenCode + More
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 96523 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `claude-mem-cursor/skills/agent-cost-report/scripts/acr/render.py`
```
"""Phase 3: Timing-style rendering of report.json into one self-contained report.html (plan 3.1-3.8).

CSS, body skeleton and every SVG are lifted from /workspace/timing-report-brief/build_mockup.py (cited
per function) and generalised per /workspace/plans/2026-09-25-agent-cost-report-timing-style.md:39-60,
97-128. Dollars everywhere (settled decision 1): one formatter `usd2`, every money figure labeled
ESTIMATE / MEASURED / EXTRAPOLATED with its basis. No <script>, no external fonts or URLs, no jinja2.
"""
import datetime as dt
import html
import math

esc = html.escape

# ---- palette: the six kinds of work (SKILL.md:76), waste, in-progress stripe; defined once (plan 3.3) ----
KINDS = ("Feature", "Bug fix", "Incident", "Maintenance", "Investigation", "Experiment")
COL = {"Feature": "#4FC3F7", "Bug fix": "#FFB14E", "Incident": "#FF8A80", "Maintenance": "#9CCC65", "Investigation": "#A78BFA", "Experiment": "#4DB6AC"}
WASTE, RECOV, GRAY = "#FF6B6B", "#FFD166", "#8e8e93"
STAT = {"shipped": ("Shipped", "ok"), "completed": ("Done", "ok"), "in_progress": ("In progress", "wip"), "abandoned": ("Abandoned", "bad"), "blocked": ("Blocked", "bad")}
TILE_NAMES = {"P1_invented_gates": "Invented gates / asking instead of doing", "tile2": "Made it up, or said done when it wasn't",
              "P2_broke_things": "Broke working things", "P3_wrong_model": "Wrong or expensive model"}
PAT_SHORT = {"P1_invented_gates": "invented gates", "P2_broke_things": "broke things", "P3_wrong_model": "wrong model", "P4_over_engineering": "over-engineering",
             "P5_not_asked": "not asked", "P6_fake_output": "fake output", "P7_false_done": "false done", "P8_wrong_tool": "wrong tool", "P9_bad_outbound": "bad outbound",
             "P10_memory_loss": "rule loss", "P11_jargon": "jargon", "P12_unclear": "unclear", "S1_tool_errors": "tool errors", "S2_hedging": "hedging"}


def usd2(x):
    """The only money formatter in the codebase (plan 3.2): "$1,234.56"."""
    return f"${x:,.2f}"


def tag(kind):
    """ESTIMATE (yellow) | MEASURED (green) | EXTRAPOLATED · low confidence (gray striped) | HEURISTIC | DRAFT."""
    return {"est": '<span class="est">ESTIMATE</span>', "meas": '<span class="est meas">MEASURED</span>',
            "extra": '<span class="est extra">EXTRAPOLATED · low confidence</span>', "heur": '<span class="est heur">heuristic</span>',
            "draft": '<span class="est heur">draft label</span>'}[kind]


def day_label(day, short=False):
    d = dt.date.fromisoformat(day)
    return f"{d:%b} {d.day}" if short else f"{d:%a %b} {d.day}"


def date_pill(window, scope):
    """"Sep 18 – 25, 2026 (PT)"; cross-month "Sep 29 – Oct 2, 2026 (PT)"; one day "Sep 12, 2026 (PT)" (mapping #1)."""
    if scope.get("kind") == "session" and not window.get("start_pt"): return "one session"
    a = dt.date.fromisoformat(window["start_pt"]); b = dt.date.fromisoformat(window["end_exclusive_pt"]) - dt.timedelta(days=1)
    if a == b: return f"{a:%b} {a.day}, {a.year} (PT)"
    if a.month == b.month: return f"{a:%b} {a.day} – {b.day}, {b.year} (PT)"
    return f"{a:%b} {a.day} – {b:%b} {b.day}, {b.year} (PT)"


def cat_sums(items):
    """Category totals in category order (by attributed dollars desc), all six kinds present."""
    sums = {k: 0.0 for k in KINDS}
    for li in items:
        sums[li["category"] if li["category"] in sums else "Investigation"] = sums.get(li["category"], 0.0) + li["attributed_usd"]
    active = {k: v for k, v in sorted(sums.items(), key=lambda kv: -kv[1]) if v > 0}
    return sums, active


# ---- CSS: build_mockup.py:99-133 plus the additions this report needs; print CSS from timing-style plan:253-263 ----
CSS = """
*{box-sizing:border-box} body{margin:0;background:#e9e9ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;color:#1d1d1f;padding:28px}
.win{width:1384px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 20px 60px #0000002a,0 0 0 1px #0000000f;overflow:hidden;display:grid;grid-template-columns:230px 1fr}
.side{background:linear-gradient(#eef3f6,#e6ecef);border-right:1px solid #dcdfe3;padding:16px 14px}
.lights{display:flex;gap:8px;margin-bottom:22px} .lights i{width:12px;height:12px;border-radius:50%;display:block}
.nav a{display:block;padding:6px 10px;border-radius:7px;color:#333;font-size:13.5px;text-decoration:none} .nav .on{background:#d5dbe0;font-weight:600}
.sh{font-size:11px;color:#8a8f98;font-weight:600;margin:20px 6px 6px;text-transform:uppercase;letter-spacing:.04em}
.srow{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:13px} .srow .sv{margin-left:auto;background:#dde3e8;border-radius:9px;padding:0 7px;font-size:11.5px;color:#555;white-space:nowrap}
.srow.dim{color:#a3a8b0} .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none} .hollow{border:1.5px solid #c5cad1}
.main{padding:0 0 26px} .bar{display:flex;align-items:center;justify-content:center;gap:14px;height:52px;border-bottom:1px solid #ececf0;color:#555}
.range{background:#f2f2f5;border-radius:7px;padding:5px 60px;font-weight:500} .arrow{color:#b0b0b8;font-size:18px}
.content{padding:22px 28px 0}
.hero{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:end;margin-bottom:10px}
.big{font-size:64px;font-weight:700;letter-spacing:-.03em;color:#0a84ff;line-height:1}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a5a00;background:#fff3d6;border:1px solid #f3dca0;border-radius:5px;padding:1px 6px;margin-left:8px;vertical-align:middle}
.est.meas{color:#1f7a3a;background:#eefaf1;border-color:#bfe6c8} .est.extra{color:#555;background:repeating-linear-gradient(45deg,#f2f2f5 0 3px,#e3e3e8 3px 6px);border-color:#d5d5da}
.est.heur{color:#555;background:#f2f2f5;border-color:#d5d5da;font-weight:600;letter-spacing:0;text-transform:none}
.herosub{font-size:17px;color:#333;margin-top:8px} .herosub b{color:#1d1d1f}
.meas{font-size:12.5px;color:#6e6e73;margin-top:6px} .basis{font-size:12px;color:#8e8e93;margin-top:4px}
.headline{font-size:21px;font-weight:600;line-height:1.35;color:#1d1d1f;max-width:720px} .headline em{font-style:normal;color:#0a84ff}
.wins-mistakes{border:1px solid #ececf0;border-radius:12px;padding:14px 18px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.wins-mistakes h3{margin:0 0 8px;font-size:13.5px;font-weight:600} .wins-mistakes h3 span{font-weight:400;color:#8e8e93}
.mline{font-size:16px;color:#1d1d1f} .mline b{color:#b3261e} .mnote{font-size:12px;color:#8e8e93;margin-top:4px} .mout{font-size:13px;color:#b3261e;margin-top:6px}
.wrow{display:grid;grid-template-columns:22px 1fr 70px 190px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f2f2f5;font-size:13px} .wrow .wk{font-size:11px;color:#555;background:#f2f2f5;border-radius:4px;text-align:center}
.wrow .wc{color:#6e6e73;font-size:12px;text-align:right} .wrow a{color:#1d1d1f;text-decoration:none}
.tl{grid-column:1/3} .tlab{font:11px -apple-system,Inter,Arial;fill:#6e6e73} .tnum{font:600 11px -apple-system,Inter,Arial;fill:#1d1d1f} .tred{font:600 11px -apple-system,Inter,Arial;fill:#b3261e}
.ribbonwrap{margin:18px 0 6px} .scale{display:flex;flex-wrap:wrap;font-size:12.5px;color:#444;margin-top:8px;row-gap:4px} .seg{display:flex;align-items:center;gap:6px;padding-right:8px;white-space:nowrap;min-width:max-content}
.muted{color:#8e8e93} .ribbonnote{font-size:12px;color:#6e6e73;margin-top:6px;display:flex;gap:18px} .key{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.grid{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:18px;margin-top:22px}
.card{border:1px solid #ececf0;border-radius:12px;padding:16px 18px} .card h3{margin:0 0 10px;font-size:13.5px;font-weight:600;color:#1d1d1f} .card h3 span{font-weight:400;color:#8e8e93}
.dn{display:flex;gap:16px;align-items:center} .dnum{font:700 26px -apple-system,Inter,Arial;fill:#1d1d1f} .dsub{font:12px -apple-system,Inter,Arial;fill:#8e8e93}
.lrow{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f2f2f5;font-size:13.5px;min-width:170px} .lval{margin-left:auto;color:#555;font-variant-numeric:tabular-nums}
.ctop{font:600 12.5px -apple-system,Inter,Arial;fill:#333} .cnone{font:italic 11.5px -apple-system,Inter,Arial;fill:#a0a0a8} .cax{font:12px -apple-system,Inter,Arial;fill:#6e6e73}
.gwrap{display:flex;gap:14px;align-items:center} .gwrap svg{flex:none} .gnum{font:700 25px -apple-system,Inter,Arial}
.gtext{font-size:13.5px;color:#333} .gtext b{color:#1d1d1f} .chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.chip{font-size:12px;background:#eefaf1;color:#1f7a3a;border-radius:20px;padding:3px 10px} .chip.bad{background:#fdeceb;color:#b3261e}
.bstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px} .behavior-tile{border:1px solid #ececf0;border-radius:9px;padding:8px 10px;font-size:12px;color:#333}
.behavior-tile b{display:block;font-size:12.5px;color:#1d1d1f} .behavior-tile .bn{font-size:20px;font-weight:700;color:#b3261e;margin-right:4px} .behavior-tile .bz{color:#1f7a3a;font-weight:600}
.wide{grid-column:1/3} .orow{display:grid;grid-template-columns:14px 14px 1fr 210px 72px 92px;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid #f2f2f5;font-size:13.5px}
.orow summary{display:contents;cursor:pointer} .orow summary::-webkit-details-marker{display:none} .odet{grid-column:1/7;font-size:12.5px;color:#555;padding:4px 0 6px 28px}
.tri{color:#b0b0b8} .obar{height:9px;background:#f4f4f7;border-radius:5px;overflow:hidden} .obar i{display:block;height:100%;border-radius:5px}
.oval{text-align:right;font-variant-numeric:tabular-nums;color:#333;white-space:nowrap} .pill{font-size:11.5px;border-radius:20px;padding:2px 9px;text-align:center} .pill.ok{background:#eefaf1;color:#1f7a3a} .pill.wip{background:#eef4ff;color:#2458c5} .pill.bad{background:#fdeceb;color:#b3261e}
.flag{font-size:11.5px;color:#b3261e;background:#fdeceb;bor
```

### Core Architecture Module: `claude-mem-grok-bot/skills/agent-cost-report/scripts/acr/render.py`
```
"""Phase 3: Timing-style rendering of report.json into one self-contained report.html (plan 3.1-3.8).

CSS, body skeleton and every SVG are lifted from /workspace/timing-report-brief/build_mockup.py (cited
per function) and generalised per /workspace/plans/2026-09-25-agent-cost-report-timing-style.md:39-60,
97-128. Dollars everywhere (settled decision 1): one formatter `usd2`, every money figure labeled
ESTIMATE / MEASURED / EXTRAPOLATED with its basis. No <script>, no external fonts or URLs, no jinja2.
"""
import datetime as dt
import html
import math

esc = html.escape

# ---- palette: the six kinds of work (SKILL.md:76), waste, in-progress stripe; defined once (plan 3.3) ----
KINDS = ("Feature", "Bug fix", "Incident", "Maintenance", "Investigation", "Experiment")
COL = {"Feature": "#4FC3F7", "Bug fix": "#FFB14E", "Incident": "#FF8A80", "Maintenance": "#9CCC65", "Investigation": "#A78BFA", "Experiment": "#4DB6AC"}
WASTE, RECOV, GRAY = "#FF6B6B", "#FFD166", "#8e8e93"
STAT = {"shipped": ("Shipped", "ok"), "completed": ("Done", "ok"), "in_progress": ("In progress", "wip"), "abandoned": ("Abandoned", "bad"), "blocked": ("Blocked", "bad")}
TILE_NAMES = {"P1_invented_gates": "Invented gates / asking instead of doing", "tile2": "Made it up, or said done when it wasn't",
              "P2_broke_things": "Broke working things", "P3_wrong_model": "Wrong or expensive model"}
PAT_SHORT = {"P1_invented_gates": "invented gates", "P2_broke_things": "broke things", "P3_wrong_model": "wrong model", "P4_over_engineering": "over-engineering",
             "P5_not_asked": "not asked", "P6_fake_output": "fake output", "P7_false_done": "false done", "P8_wrong_tool": "wrong tool", "P9_bad_outbound": "bad outbound",
             "P10_memory_loss": "rule loss", "P11_jargon": "jargon", "P12_unclear": "unclear", "S1_tool_errors": "tool errors", "S2_hedging": "hedging"}


def usd2(x):
    """The only money formatter in the codebase (plan 3.2): "$1,234.56"."""
    return f"${x:,.2f}"


def tag(kind):
    """ESTIMATE (yellow) | MEASURED (green) | EXTRAPOLATED · low confidence (gray striped) | HEURISTIC | DRAFT."""
    return {"est": '<span class="est">ESTIMATE</span>', "meas": '<span class="est meas">MEASURED</span>',
            "extra": '<span class="est extra">EXTRAPOLATED · low confidence</span>', "heur": '<span class="est heur">heuristic</span>',
            "draft": '<span class="est heur">draft label</span>'}[kind]


def day_label(day, short=False):
    d = dt.date.fromisoformat(day)
    return f"{d:%b} {d.day}" if short else f"{d:%a %b} {d.day}"


def date_pill(window, scope):
    """"Sep 18 – 25, 2026 (PT)"; cross-month "Sep 29 – Oct 2, 2026 (PT)"; one day "Sep 12, 2026 (PT)" (mapping #1)."""
    if scope.get("kind") == "session" and not window.get("start_pt"): return "one session"
    a = dt.date.fromisoformat(window["start_pt"]); b = dt.date.fromisoformat(window["end_exclusive_pt"]) - dt.timedelta(days=1)
    if a == b: return f"{a:%b} {a.day}, {a.year} (PT)"
    if a.month == b.month: return f"{a:%b} {a.day} – {b.day}, {b.year} (PT)"
    return f"{a:%b} {a.day} – {b:%b} {b.day}, {b.year} (PT)"


def cat_sums(items):
    """Category totals in category order (by attributed dollars desc), all six kinds present."""
    sums = {k: 0.0 for k in KINDS}
    for li in items:
        sums[li["category"] if li["category"] in sums else "Investigation"] = sums.get(li["category"], 0.0) + li["attributed_usd"]
    active = {k: v for k, v in sorted(sums.items(), key=lambda kv: -kv[1]) if v > 0}
    return sums, active


# ---- CSS: build_mockup.py:99-133 plus the additions this report needs; print CSS from timing-style plan:253-263 ----
CSS = """
*{box-sizing:border-box} body{margin:0;background:#e9e9ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;color:#1d1d1f;padding:28px}
.win{width:1384px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 20px 60px #0000002a,0 0 0 1px #0000000f;overflow:hidden;display:grid;grid-template-columns:230px 1fr}
.side{background:linear-gradient(#eef3f6,#e6ecef);border-right:1px solid #dcdfe3;padding:16px 14px}
.lights{display:flex;gap:8px;margin-bottom:22px} .lights i{width:12px;height:12px;border-radius:50%;display:block}
.nav a{display:block;padding:6px 10px;border-radius:7px;color:#333;font-size:13.5px;text-decoration:none} .nav .on{background:#d5dbe0;font-weight:600}
.sh{font-size:11px;color:#8a8f98;font-weight:600;margin:20px 6px 6px;text-transform:uppercase;letter-spacing:.04em}
.srow{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:13px} .srow .sv{margin-left:auto;background:#dde3e8;border-radius:9px;padding:0 7px;font-size:11.5px;color:#555;white-space:nowrap}
.srow.dim{color:#a3a8b0} .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none} .hollow{border:1.5px solid #c5cad1}
.main{padding:0 0 26px} .bar{display:flex;align-items:center;justify-content:center;gap:14px;height:52px;border-bottom:1px solid #ececf0;color:#555}
.range{background:#f2f2f5;border-radius:7px;padding:5px 60px;font-weight:500} .arrow{color:#b0b0b8;font-size:18px}
.content{padding:22px 28px 0}
.hero{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:end;margin-bottom:10px}
.big{font-size:64px;font-weight:700;letter-spacing:-.03em;color:#0a84ff;line-height:1}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a5a00;background:#fff3d6;border:1px solid #f3dca0;border-radius:5px;padding:1px 6px;margin-left:8px;vertical-align:middle}
.est.meas{color:#1f7a3a;background:#eefaf1;border-color:#bfe6c8} .est.extra{color:#555;background:repeating-linear-gradient(45deg,#f2f2f5 0 3px,#e3e3e8 3px 6px);border-color:#d5d5da}
.est.heur{color:#555;background:#f2f2f5;border-color:#d5d5da;font-weight:600;letter-spacing:0;text-transform:none}
.herosub{font-size:17px;color:#333;margin-top:8px} .herosub b{color:#1d1d1f}
.meas{font-size:12.5px;color:#6e6e73;margin-top:6px} .basis{font-size:12px;color:#8e8e93;margin-top:4px}
.headline{font-size:21px;font-weight:600;line-height:1.35;color:#1d1d1f;max-width:720px} .headline em{font-style:normal;color:#0a84ff}
.wins-mistakes{border:1px solid #ececf0;border-radius:12px;padding:14px 18px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.wins-mistakes h3{margin:0 0 8px;font-size:13.5px;font-weight:600} .wins-mistakes h3 span{font-weight:400;color:#8e8e93}
.mline{font-size:16px;color:#1d1d1f} .mline b{color:#b3261e} .mnote{font-size:12px;color:#8e8e93;margin-top:4px} .mout{font-size:13px;color:#b3261e;margin-top:6px}
.wrow{display:grid;grid-template-columns:22px 1fr 70px 190px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f2f2f5;font-size:13px} .wrow .wk{font-size:11px;color:#555;background:#f2f2f5;border-radius:4px;text-align:center}
.wrow .wc{color:#6e6e73;font-size:12px;text-align:right} .wrow a{color:#1d1d1f;text-decoration:none}
.tl{grid-column:1/3} .tlab{font:11px -apple-system,Inter,Arial;fill:#6e6e73} .tnum{font:600 11px -apple-system,Inter,Arial;fill:#1d1d1f} .tred{font:600 11px -apple-system,Inter,Arial;fill:#b3261e}
.ribbonwrap{margin:18px 0 6px} .scale{display:flex;flex-wrap:wrap;font-size:12.5px;color:#444;margin-top:8px;row-gap:4px} .seg{display:flex;align-items:center;gap:6px;padding-right:8px;white-space:nowrap;min-width:max-content}
.muted{color:#8e8e93} .ribbonnote{font-size:12px;color:#6e6e73;margin-top:6px;display:flex;gap:18px} .key{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.grid{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:18px;margin-top:22px}
.card{border:1px solid #ececf0;border-radius:12px;padding:16px 18px} .card h3{margin:0 0 10px;font-size:13.5px;font-weight:600;color:#1d1d1f} .card h3 span{font-weight:400;color:#8e8e93}
.dn{display:flex;gap:16px;align-items:center} .dnum{font:700 26px -apple-system,Inter,Arial;fill:#1d1d1f} .dsub{font:12px -apple-system,Inter,Arial;fill:#8e8e93}
.lrow{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f2f2f5;font-size:13.5px;min-width:170px} .lval{margin-left:auto;color:#555;font-variant-numeric:tabular-nums}
.ctop{font:600 12.5px -apple-system,Inter,Arial;fill:#333} .cnone{font:italic 11.5px -apple-system,Inter,Arial;fill:#a0a0a8} .cax{font:12px -apple-system,Inter,Arial;fill:#6e6e73}
.gwrap{display:flex;gap:14px;align-items:center} .gwrap svg{flex:none} .gnum{font:700 25px -apple-system,Inter,Arial}
.gtext{font-size:13.5px;color:#333} .gtext b{color:#1d1d1f} .chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.chip{font-size:12px;background:#eefaf1;color:#1f7a3a;border-radius:20px;padding:3px 10px} .chip.bad{background:#fdeceb;color:#b3261e}
.bstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px} .behavior-tile{border:1px solid #ececf0;border-radius:9px;padding:8px 10px;font-size:12px;color:#333}
.behavior-tile b{display:block;font-size:12.5px;color:#1d1d1f} .behavior-tile .bn{font-size:20px;font-weight:700;color:#b3261e;margin-right:4px} .behavior-tile .bz{color:#1f7a3a;font-weight:600}
.wide{grid-column:1/3} .orow{display:grid;grid-template-columns:14px 14px 1fr 210px 72px 92px;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid #f2f2f5;font-size:13.5px}
.orow summary{display:contents;cursor:pointer} .orow summary::-webkit-details-marker{display:none} .odet{grid-column:1/7;font-size:12.5px;color:#555;padding:4px 0 6px 28px}
.tri{color:#b0b0b8} .obar{height:9px;background:#f4f4f7;border-radius:5px;overflow:hidden} .obar i{display:block;height:100%;border-radius:5px}
.oval{text-align:right;font-variant-numeric:tabular-nums;color:#333;white-space:nowrap} .pill{font-size:11.5px;border-radius:20px;padding:2px 9px;text-align:center} .pill.ok{background:#eefaf1;color:#1f7a3a} .pill.wip{background:#eef4ff;color:#2458c5} .pill.bad{background:#fdeceb;color:#b3261e}
.flag{font-size:11.5px;color:#b3261e;background:#fdeceb;bor
```

### Core Architecture Module: `cowork/scripts/cmem-hook.mjs`
```
#!/usr/bin/env node
/**
 * claude-mem-cowork — thin HTTP hook shim for Cowork (Claude app cloud sessions).
 *
 * Local claude-mem runs a worker service on the user's machine. Cowork containers
 * are ephemeral, so this shim replaces the worker with HTTPS calls to cmem.ai:
 *
 *   capture  →  POST {base}/api/hooks/ingest      (raw hook payloads; Pro worker/observer runs server-side)
 *   inject   →  GET  {base}/api/hooks/context     (compiled context block)
 *               fallback: POST {base}/api/mcp     (memory_search via JSON-RPC — works today)
 *
 * Design rule #1: NEVER break the session. Every hook path exits 0 no matter what.
 * Failed ingest posts are spooled to ~/.claude-mem (0600) and re-flushed on later hook fires.
 *
 * Usage: node cmem-hook.mjs <event>
 *   events: context | session-init | observation | agent-context |
 *           subagent-stop | summarize | session-end
 *   CLI:    search "query" [--limit N] | status
 */

import { readFileSync, appendFileSync, writeFileSync, existsSync, renameSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// per-user, 0600 — never a shared world-readable temp dir (payloads may hold tool output)
const SPOOL_DIR = join(homedir(), '.claude-mem');
const SPOOL = join(SPOOL_DIR, 'cowork-spool.jsonl');
const SPOOL_MAX = 200;           // max spooled events kept
const FIELD_CAP = 16000;         // max chars per big payload field
const PROMPT_CAP = 4000;         // max chars of user prompt / agent prompt sent
const HTTP_TIMEOUT_MS = { fast: 4000, normal: 8000, context: 12000 };

// ---------- config ----------

function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'config.json'), 'utf8'));
  } catch { /* no config.json — other sources may still carry it */ }
  // compat fallback: a local claude-mem install's settings. The cloud-sync pairing
  // writes CLAUDE_MEM_CLOUD_SYNC_TOKEN / _USER_ID / _HUB_URL there (see
  // src/shared/SettingsDefaultsManager.ts); older short names are honored too.
  // Lets one credential set serve both worlds.
  let local = {};
  try {
    local = JSON.parse(readFileSync(join(process.env.HOME || '', '.claude-mem', 'settings.json'), 'utf8'));
  } catch { /* not a claude-mem host — fine */ }
  const pick = (...vals) => vals.find(v => typeof v === 'string' && v.trim()) || '';
  const cfg = {
    apiBase: (pick(process.env.CMEM_API_BASE, file.apiBase, local.apiBase) || 'https://cmem.ai').replace(/\/+$/, ''),
    apiKey: pick(process.env.CMEM_API_KEY, file.apiKey, local.CLAUDE_MEM_CLOUD_SYNC_TOKEN, local.syncToken, local.apiKey, local.token),
    userId: pick(process.env.CMEM_USER_ID, file.userId, local.CLAUDE_MEM_CLOUD_SYNC_USER_ID, local.userId),
    syncHubUrl: pick(process.env.CMEM_SYNC_HUB_URL, file.syncHubUrl, local.CLAUDE_MEM_CLOUD_SYNC_HUB_URL, local.syncHubUrl, local.hubUrl).replace(/\/+$/, ''),
    inject: {
      sessionStart: file.inject?.sessionStart !== false,   // default on
      agents: file.inject?.agents !== false,               // default on
      maxChars: Number(file.inject?.maxChars) || 6000
    },
    capture: {
      // tool names whose payloads are never sent (secrets-ish or pure noise)
      skipTools: Array.isArray(file.capture?.skipTools) ? file.capture.skipTools : [],
      // memory MCP + cmem's own calls are always skipped to avoid feedback loops
    }
  };
  return cfg;
}

const CFG = loadConfig();

// ---------- project naming ----------
// ALWAYS automatic — deliberately not a setting (claude-mem is bigger than this
// plugin; a manual override here would fork naming and break things downstream).
// Root Cowork sessions land on cmem_work_root; project folders get cmem_work_<folder>.
const GENERIC_DIRS = new Set(['', '/', 'root', 'claude', 'user', 'home', 'work', 'workspace', 'tmp', 'uploads', 'outputs']);

function resolveProject(cwd) {
  const base = String(cwd || process.cwd() || '').replace(/\/+$/, '').split('/').pop() || '';
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return 'cmem_work_' + (GENERIC_DIRS.has(slug) ? 'root' : slug);
}

// ---------- small utils ----------

function readStdin() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function truncate(v, cap) {
  if (v == null) return v;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s.length <= cap) return v;
  return s.slice(0, cap) + `\n…[claude-mem truncated ${s.length - cap} chars]`;
}

// ---------- secret redaction ----------
// Observations are memory: keep the signal (paths, code, output) but strip
// anything secret-shaped BEFORE the envelope exists, so neither the ingest
// POST nor the retry spool ever holds raw credentials. All patterns are
// single-pass linear regexes over capped input (FIELD_CAP/PROMPT_CAP).
const REDACTED = '[cmem-redacted]';
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, // PEM key blocks
  /\b(?:Bearer|Basic|Token)[ \t]+[A-Za-z0-9._~+/=-]{16,512}\b/gi,                // auth scheme credentials
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,            // JWTs
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}\b/g,                                         // OpenAI/Anthropic-style keys
  /\b[sprk]k_(?:live|test)_[A-Za-z0-9]{10,}\b/g,                                 // Stripe-style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,                                             // GitHub tokens
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,                                           // GitHub fine-grained PATs
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,                                               // GitLab PATs
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,                                           // Slack tokens
  /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|AIPA)[0-9A-Z]{16}\b/g,               // AWS access key ids
  /\bAIza[0-9A-Za-z_-]{35}\b/g,                                                  // Google API keys
  /\bnpm_[A-Za-z0-9]{36}\b/g                                                     // npm tokens
];
// `password: …` / `api_key=…` style assignments — keep the key, redact the
// ENTIRE value through the line or record delimiter (quote, backtick, comma,
// semicolon, ampersand, newline). No minimum length and spaces allowed inside
// the value, so short passwords and passphrases with spaces never leak.
const KEYVALUE_RE = /((?:api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|secret|password|passwd|pwd|auth[_-]?token|token|credentials?|private[_-]?key)["']?[ \t]*[:=][ \t]*["']?)(?!\[cmem-redacted\])[^\n\r"'`,;&]+/gi;
// Cookie/Set-Cookie header values are session credentials whatever the cookie
// is named (sessionid=…) — redact the whole header value. Same treatment for
// Authorization headers regardless of scheme (Bearer, Token, ApiKey, custom…)
const COOKIE_RE = /\b((?:set-)?cookie|(?:proxy-)?authorization)(["']?\s*[:=]\s*["']?)(?!\[cmem-redacted\])[^\n\r"']{4,}/gi;
// connection-string credentials: scheme://user:password@host → keep scheme+host,
// redact the ENTIRE userinfo (postgres://, mysql://, redis://, amqp://, …).
// Userinfo = everything up to the LAST '@' in the URI token, so passwords
// containing literal '/', ':' or '@' are still fully covered. Only fires when
// a password colon is present — bare user@ (ssh://git@github.com) is signal.
const URI_RE = /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)([^\s"'`]+)/g;

function redactUriCredentials(text) {
  return text.replace(URI_RE, (m, scheme, rest) => {
    const at = rest.lastIndexOf('@');
    if (at === -1) return m;
    const userinfo = rest.slice(0, at);
    if (!userinfo.includes(':')) return m;
    return scheme + REDACTED + '@' + rest.slice(at + 1);
  });
}

function redactSecrets(s) {
  let out = s;
  for (const re of SECRET_PATTERNS) out = out.replace(re, REDACTED);
  out = redactUriCredentials(out);
  out = out.replace(COOKIE_RE, `$1$2${REDACTED}`);
  return out.replace(KEYVALUE_RE, `$1${REDACTED}`);
}

// claude-mem's documented privacy convention: <private>…</private> regions are
// never stored. Same tag list as the local plugin's src/utils/tag-stripping.ts
// (context/system tags are dropped too so injected blocks don't echo back in).
const STRIP_TAGS_RE = /<(private|claude-mem-context|system_instruction|system-instruction|persisted-output|system-reminder)\b[^>]*>[\s\S]*?<\/\1>/g;

// strip privacy-tagged regions → truncate → redact secrets. Tag stripping runs
// FIRST (on the full serialized value) so truncation can never cut off a
// closing tag and leak a partial private region. Always emits a string for
// non-null values so every pass sees the whole payload.
function clean(v, cap) {
  if (v == null) return v;
  const s = (typeof v === 'string' ? v : JSON.stringify(v)).replace(STRIP_TAGS_RE, '');
  const t = truncate(s, cap);
  return redactSecrets(typeof t === 'string' ? t : JSON.stringify(t));
}

async function http(method, url, body, timeoutMs, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'Authorization': `Bearer ${CFG.apiKey}`,
        'Content-Type': 'application/json',
        'X-CMEM-Platform': 'cowork',
        'X-CMEM-Plugin': 'claude-mem-cowork/0.1.3',
        ...(CFG.userId ? { 'X-CMEM-User-Id': CFG.userId } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, headers: res.headers };
  } finally {
    clearTimeout(t);
  }
}

// ---------- ingest + spool ----------

function envelope(event, p
```

### Core Architecture Module: `cowork/skills/agent-cost-report/scripts/acr/render.py`
```
"""Phase 3: Timing-style rendering of report.json into one self-contained report.html (plan 3.1-3.8).

CSS, body skeleton and every SVG are lifted from /workspace/timing-report-brief/build_mockup.py (cited
per function) and generalised per /workspace/plans/2026-09-25-agent-cost-report-timing-style.md:39-60,
97-128. Dollars everywhere (settled decision 1): one formatter `usd2`, every money figure labeled
ESTIMATE / MEASURED / EXTRAPOLATED with its basis. No <script>, no external fonts or URLs, no jinja2.
"""
import datetime as dt
import html
import math

esc = html.escape

# ---- palette: the six kinds of work (SKILL.md:76), waste, in-progress stripe; defined once (plan 3.3) ----
KINDS = ("Feature", "Bug fix", "Incident", "Maintenance", "Investigation", "Experiment")
COL = {"Feature": "#4FC3F7", "Bug fix": "#FFB14E", "Incident": "#FF8A80", "Maintenance": "#9CCC65", "Investigation": "#A78BFA", "Experiment": "#4DB6AC"}
WASTE, RECOV, GRAY = "#FF6B6B", "#FFD166", "#8e8e93"
STAT = {"shipped": ("Shipped", "ok"), "completed": ("Done", "ok"), "in_progress": ("In progress", "wip"), "abandoned": ("Abandoned", "bad"), "blocked": ("Blocked", "bad")}
TILE_NAMES = {"P1_invented_gates": "Invented gates / asking instead of doing", "tile2": "Made it up, or said done when it wasn't",
              "P2_broke_things": "Broke working things", "P3_wrong_model": "Wrong or expensive model"}
PAT_SHORT = {"P1_invented_gates": "invented gates", "P2_broke_things": "broke things", "P3_wrong_model": "wrong model", "P4_over_engineering": "over-engineering",
             "P5_not_asked": "not asked", "P6_fake_output": "fake output", "P7_false_done": "false done", "P8_wrong_tool": "wrong tool", "P9_bad_outbound": "bad outbound",
             "P10_memory_loss": "rule loss", "P11_jargon": "jargon", "P12_unclear": "unclear", "S1_tool_errors": "tool errors", "S2_hedging": "hedging"}


def usd2(x):
    """The only money formatter in the codebase (plan 3.2): "$1,234.56"."""
    return f"${x:,.2f}"


def tag(kind):
    """ESTIMATE (yellow) | MEASURED (green) | EXTRAPOLATED · low confidence (gray striped) | HEURISTIC | DRAFT."""
    return {"est": '<span class="est">ESTIMATE</span>', "meas": '<span class="est meas">MEASURED</span>',
            "extra": '<span class="est extra">EXTRAPOLATED · low confidence</span>', "heur": '<span class="est heur">heuristic</span>',
            "draft": '<span class="est heur">draft label</span>'}[kind]


def day_label(day, short=False):
    d = dt.date.fromisoformat(day)
    return f"{d:%b} {d.day}" if short else f"{d:%a %b} {d.day}"


def date_pill(window, scope):
    """"Sep 18 – 25, 2026 (PT)"; cross-month "Sep 29 – Oct 2, 2026 (PT)"; one day "Sep 12, 2026 (PT)" (mapping #1)."""
    if scope.get("kind") == "session" and not window.get("start_pt"): return "one session"
    a = dt.date.fromisoformat(window["start_pt"]); b = dt.date.fromisoformat(window["end_exclusive_pt"]) - dt.timedelta(days=1)
    if a == b: return f"{a:%b} {a.day}, {a.year} (PT)"
    if a.month == b.month: return f"{a:%b} {a.day} – {b.day}, {b.year} (PT)"
    return f"{a:%b} {a.day} – {b:%b} {b.day}, {b.year} (PT)"


def cat_sums(items):
    """Category totals in category order (by attributed dollars desc), all six kinds present."""
    sums = {k: 0.0 for k in KINDS}
    for li in items:
        sums[li["category"] if li["category"] in sums else "Investigation"] = sums.get(li["category"], 0.0) + li["attributed_usd"]
    active = {k: v for k, v in sorted(sums.items(), key=lambda kv: -kv[1]) if v > 0}
    return sums, active


# ---- CSS: build_mockup.py:99-133 plus the additions this report needs; print CSS from timing-style plan:253-263 ----
CSS = """
*{box-sizing:border-box} body{margin:0;background:#e9e9ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;color:#1d1d1f;padding:28px}
.win{width:1384px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 20px 60px #0000002a,0 0 0 1px #0000000f;overflow:hidden;display:grid;grid-template-columns:230px 1fr}
.side{background:linear-gradient(#eef3f6,#e6ecef);border-right:1px solid #dcdfe3;padding:16px 14px}
.lights{display:flex;gap:8px;margin-bottom:22px} .lights i{width:12px;height:12px;border-radius:50%;display:block}
.nav a{display:block;padding:6px 10px;border-radius:7px;color:#333;font-size:13.5px;text-decoration:none} .nav .on{background:#d5dbe0;font-weight:600}
.sh{font-size:11px;color:#8a8f98;font-weight:600;margin:20px 6px 6px;text-transform:uppercase;letter-spacing:.04em}
.srow{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:13px} .srow .sv{margin-left:auto;background:#dde3e8;border-radius:9px;padding:0 7px;font-size:11.5px;color:#555;white-space:nowrap}
.srow.dim{color:#a3a8b0} .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none} .hollow{border:1.5px solid #c5cad1}
.main{padding:0 0 26px} .bar{display:flex;align-items:center;justify-content:center;gap:14px;height:52px;border-bottom:1px solid #ececf0;color:#555}
.range{background:#f2f2f5;border-radius:7px;padding:5px 60px;font-weight:500} .arrow{color:#b0b0b8;font-size:18px}
.content{padding:22px 28px 0}
.hero{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:end;margin-bottom:10px}
.big{font-size:64px;font-weight:700;letter-spacing:-.03em;color:#0a84ff;line-height:1}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a5a00;background:#fff3d6;border:1px solid #f3dca0;border-radius:5px;padding:1px 6px;margin-left:8px;vertical-align:middle}
.est.meas{color:#1f7a3a;background:#eefaf1;border-color:#bfe6c8} .est.extra{color:#555;background:repeating-linear-gradient(45deg,#f2f2f5 0 3px,#e3e3e8 3px 6px);border-color:#d5d5da}
.est.heur{color:#555;background:#f2f2f5;border-color:#d5d5da;font-weight:600;letter-spacing:0;text-transform:none}
.herosub{font-size:17px;color:#333;margin-top:8px} .herosub b{color:#1d1d1f}
.meas{font-size:12.5px;color:#6e6e73;margin-top:6px} .basis{font-size:12px;color:#8e8e93;margin-top:4px}
.headline{font-size:21px;font-weight:600;line-height:1.35;color:#1d1d1f;max-width:720px} .headline em{font-style:normal;color:#0a84ff}
.wins-mistakes{border:1px solid #ececf0;border-radius:12px;padding:14px 18px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.wins-mistakes h3{margin:0 0 8px;font-size:13.5px;font-weight:600} .wins-mistakes h3 span{font-weight:400;color:#8e8e93}
.mline{font-size:16px;color:#1d1d1f} .mline b{color:#b3261e} .mnote{font-size:12px;color:#8e8e93;margin-top:4px} .mout{font-size:13px;color:#b3261e;margin-top:6px}
.wrow{display:grid;grid-template-columns:22px 1fr 70px 190px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f2f2f5;font-size:13px} .wrow .wk{font-size:11px;color:#555;background:#f2f2f5;border-radius:4px;text-align:center}
.wrow .wc{color:#6e6e73;font-size:12px;text-align:right} .wrow a{color:#1d1d1f;text-decoration:none}
.tl{grid-column:1/3} .tlab{font:11px -apple-system,Inter,Arial;fill:#6e6e73} .tnum{font:600 11px -apple-system,Inter,Arial;fill:#1d1d1f} .tred{font:600 11px -apple-system,Inter,Arial;fill:#b3261e}
.ribbonwrap{margin:18px 0 6px} .scale{display:flex;flex-wrap:wrap;font-size:12.5px;color:#444;margin-top:8px;row-gap:4px} .seg{display:flex;align-items:center;gap:6px;padding-right:8px;white-space:nowrap;min-width:max-content}
.muted{color:#8e8e93} .ribbonnote{font-size:12px;color:#6e6e73;margin-top:6px;display:flex;gap:18px} .key{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.grid{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:18px;margin-top:22px}
.card{border:1px solid #ececf0;border-radius:12px;padding:16px 18px} .card h3{margin:0 0 10px;font-size:13.5px;font-weight:600;color:#1d1d1f} .card h3 span{font-weight:400;color:#8e8e93}
.dn{display:flex;gap:16px;align-items:center} .dnum{font:700 26px -apple-system,Inter,Arial;fill:#1d1d1f} .dsub{font:12px -apple-system,Inter,Arial;fill:#8e8e93}
.lrow{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f2f2f5;font-size:13.5px;min-width:170px} .lval{margin-left:auto;color:#555;font-variant-numeric:tabular-nums}
.ctop{font:600 12.5px -apple-system,Inter,Arial;fill:#333} .cnone{font:italic 11.5px -apple-system,Inter,Arial;fill:#a0a0a8} .cax{font:12px -apple-system,Inter,Arial;fill:#6e6e73}
.gwrap{display:flex;gap:14px;align-items:center} .gwrap svg{flex:none} .gnum{font:700 25px -apple-system,Inter,Arial}
.gtext{font-size:13.5px;color:#333} .gtext b{color:#1d1d1f} .chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.chip{font-size:12px;background:#eefaf1;color:#1f7a3a;border-radius:20px;padding:3px 10px} .chip.bad{background:#fdeceb;color:#b3261e}
.bstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px} .behavior-tile{border:1px solid #ececf0;border-radius:9px;padding:8px 10px;font-size:12px;color:#333}
.behavior-tile b{display:block;font-size:12.5px;color:#1d1d1f} .behavior-tile .bn{font-size:20px;font-weight:700;color:#b3261e;margin-right:4px} .behavior-tile .bz{color:#1f7a3a;font-weight:600}
.wide{grid-column:1/3} .orow{display:grid;grid-template-columns:14px 14px 1fr 210px 72px 92px;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid #f2f2f5;font-size:13.5px}
.orow summary{display:contents;cursor:pointer} .orow summary::-webkit-details-marker{display:none} .odet{grid-column:1/7;font-size:12.5px;color:#555;padding:4px 0 6px 28px}
.tri{color:#b0b0b8} .obar{height:9px;background:#f4f4f7;border-radius:5px;overflow:hidden} .obar i{display:block;height:100%;border-radius:5px}
.oval{text-align:right;font-variant-numeric:tabular-nums;color:#333;white-space:nowrap} .pill{font-size:11.5px;border-radius:20px;padding:2px 9px;text-align:center} .pill.ok{background:#eefaf1;color:#1f7a3a} .pill.wip{background:#eef4ff;color:#2458c5} .pill.bad{background:#fdeceb;color:#b3261e}
.flag{font-size:11.5px;color:#b3261e;background:#fdeceb;bor
```

### Core Architecture Module: `omp/hooks/claude-mem.ts`
```
/**
 * omp -> claude-mem observation bridge.
 *
 * Ports the claude-mem team's OpenClaw adapter (openclaw/src/index.ts, 1140 loc)
 * to the omp hook event bus, so omp sessions are written into the same claude-mem
 * store that Claude Code and Cursor already write to — one shared memory across
 * all three agents.
 *
 * Discovery: omp auto-discovers `.omp/hooks/pre/*.ts` (project <cwd>/.omp and user
 * ~/.omp/agent via getAgentDir()); the file loads as an extension module and
 * `pi.on(...)` binds to the runtime event bus (oh-my-pi CHANGELOG #2796). The
 * `tool` field derived from the filename is only the capability dedup key
 * `${type}:${tool}:${name}`, NOT a runtime emission scope — emitToolResult
 * (extensions/runner.ts) iterates handlers by event name with no tool filter, so
 * this file receives tool_result for every tool.
 *
 * Advisor-signoff contract notes:
 *  - context handler MAY return { messages }, but that REPLACES the conversation
 *    (chained replacement). We spread the original messages back in and append
 *    one system message — never return only injected text (would wipe the chat).
 *  - contentSessionId is regenerated on session_compact, session_switch and
 *    session_branch: one claude-mem session per omp session file (and a new one
 *    after each compaction), never per prompt — before_agent_start fires once
 *    per user prompt, so we never mint a new id there. A reload re-emits
 *    session_switch for the file already open, and that keeps the id.
 *  - every user prompt posts init (the worker de-duplicates a repeated prompt),
 *    as the Claude Code hooks do, each after the previous one so prompts are
 *    recorded in order. Observations wait for the latest prompt's init and are
 *    dropped when the worker did not record it. A tool result never inits on
 *    its own: a prompt-less init would pin the session to "[media prompt]".
 *  - All POSTs are fire-and-forget via detached chains; the handler returns
 *    synchronously and never blocks the tool dispatch (30s handler cap). Every
 *    request is bounded by a timeout, which counts as a breaker failure.
 *  - The project is never named here: every request carries the session's cwd
 *    and the worker resolves the project key from it, the same resolver the
 *    Claude Code hooks use (worktrees, markers, environments).
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_LEN = 1000; // tool_response hard cap (OpenClaw)
const CTX_CACHE_MS = 60_000; // /api/context/inject cache TTL (OpenClaw)
// A hung worker must not hold OMP's handlers: the context handler is awaited
// before every model call, so an unbounded fetch added up to OMP's 30 s handler
// cap per call, and the breaker never saw a failure.
const REQUEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Worker endpoint
// ---------------------------------------------------------------------------

/**
 * claude-mem's settings.json, read the way claude-mem reads it: from
 * CLAUDE_MEM_DATA_DIR (default ~/.claude-mem); its keys sit under `env` when
 * that block holds CLAUDE_MEM_* keys, else at the root. Empty on any error.
 */
function readClaudeMemSettings(): Record<string, unknown> {
  const dataDir = process.env.CLAUDE_MEM_DATA_DIR || join(homedir(), ".claude-mem");
  try {
    const doc = JSON.parse(readFileSync(join(dataDir, "settings.json"), "utf8").replace(/^﻿/, ""));
    const env = doc?.env;
    const nested = env !== null && typeof env === "object" && !Array.isArray(env)
      && Object.keys(env).some(key => key.startsWith("CLAUDE_MEM_"));
    return nested ? env : (doc ?? {});
  } catch {
    return {};
  }
}

/** Env wins over settings.json, which wins over claude-mem's own default. */
function setting(settings: Record<string, unknown>, key: string, fallback: string): string {
  const fromEnv = process.env[key];
  if (fromEnv) return fromEnv;
  const fromFile = settings[key];
  return typeof fromFile === "string" && fromFile ? fromFile : fallback;
}

function resolveWorkerBase(): string {
  const settings = readClaudeMemSettings();
  const defaultPort = String(37700 + ((process.getuid?.() ?? 77) % 100));
  const port = setting(settings, "CLAUDE_MEM_WORKER_PORT", defaultPort);
  const host = setting(settings, "CLAUDE_MEM_WORKER_HOST", "127.0.0.1");
  const urlHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${urlHost}:${port}`;
}

// Resolved once per omp session (session_start clears it), so a port change in
// settings.json is picked up by the next session without a restart.
let workerBase: string | undefined;

function worker(): string {
  workerBase ??= resolveWorkerBase();
  return workerBase;
}

// ---------------------------------------------------------------------------
// Circuit breaker (OpenClaw pattern) — 3 consecutive failures => 30s OPEN
// ---------------------------------------------------------------------------

let tripCount = 0;
let openUntil = 0;

function breakerOpen(): boolean {
  return Date.now() < openUntil;
}

function onFail(): void {
  tripCount++;
  if (tripCount >= 3) {
    openUntil = Date.now() + 30_000;
    tripCount = 0;
  }
}

function onOk(): void {
  tripCount = 0;
  openUntil = 0;
}

// ---------------------------------------------------------------------------
// Session state (process-stable contentSessionId)
// ---------------------------------------------------------------------------

interface OmpSession {
  id: string;
  // The tail of the session's init chain: the latest prompt's init, which
  // resolves true once the worker recorded that prompt. Observations and the
  // summary wait on it so they land after the prompts they belong to.
  lastInit?: Promise<boolean>;
  // All observations dispatched for this identity, including HTTP still in flight.
  observations?: Promise<void>;
  // The worker recorded at least one prompt for this id (finalize needs one).
  anchored: boolean;
  // The worker skipped this checkout as excluded: nothing more is sent.
  excluded: boolean;
}

let session: OmpSession | undefined;
let ctxCache: { at: number; cwd: string; md: string } | null = null;
let lastAssistant = ""; // captured on agent_end, sent at summarize

function newSession(): OmpSession {
  session = { id: `omp-${process.pid}-${randomUUID()}`, anchored: false, excluded: false };
  return session;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(c => (c && typeof c === "object" && "type" in c && c.type === "text" ? String(c.text ?? "") : ""))
      .join("\n")
      .trim();
  }
  return "";
}

// Find the last message of `role` and return its text. Handles string content or
// [{type:"text",text}] chunks. Empty when the event carries no such message.
function lastMessageText(messages: unknown[], role: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && typeof m === "object" && "role" in m && m.role === role && "content" in m) {
      return typeof m.content === "string" ? m.content : textFromContent(m.content);
    }
  }
  return "";
}

/** One bounded worker request; a timeout or an HTTP error rejects. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${worker()}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r;
}

function postJson(path: string, body: unknown): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function post(path: string, body: unknown): Promise<void> {
  if (breakerOpen()) return Promise.resolve();
  return postJson(path, body).then(() => onOk(), () => onFail());
}

/**
 * Record one user prompt for `target`. Every prompt posts init, so prompts 2+
 * are recorded too (the worker de-duplicates a repeated prompt). Each init
 * waits for the previous one, so overlapping prompts reach the worker in order
 * and finalize, which waits for the chain's tail, covers all of them. A failed
 * init is counted by the breaker, and a later prompt simply tries again.
 */
function sendPrompt(target: OmpSession, cwd: string | undefined, prompt: string): void {
  const body: Record<string, unknown> = { contentSessionId: target.id, prompt, platformSource: "omp" };
  if (cwd) body.cwd = cwd;
  target.lastInit = (target.lastInit ?? Promise.resolve(true)).then(() => recordPrompt(target, body));
}

// Resolves true once the worker recorded the prompt. Success is counted only
// after the reply is read: a body that stalls until the timeout is a failure,
// not a recorded prompt.
async function recordPrompt(target: OmpSession, body: Record<string, unknown>): Promise<boolean> {
  if (target.excluded || breakerOpen()) return false;
  try {
    const r = await postJson("/api/sessions/init", body);
    const reply = (await r.json()) as { reason?: unknown } | null;
    onOk();
    // An excluded checkout is skipped before any session row exists.
    if (reply?.reason === "project_excluded") {
      target.excluded = true;
      return false;
    }
    target.anchored = true;
    return true;
  } catch {
    onFail();
    return false;
  }
}

// Finalize a session the worker recorded a prompt for. Wait for its latest
// init and all dispatched observations, so the summary cannot overtake them; a session
// with no recorded prompt (every init f
```

### Core Architecture Module: `openclaw/skills/agent-cost-report/scripts/acr/render.py`
```
"""Phase 3: Timing-style rendering of report.json into one self-contained report.html (plan 3.1-3.8).

CSS, body skeleton and every SVG are lifted from /workspace/timing-report-brief/build_mockup.py (cited
per function) and generalised per /workspace/plans/2026-09-25-agent-cost-report-timing-style.md:39-60,
97-128. Dollars everywhere (settled decision 1): one formatter `usd2`, every money figure labeled
ESTIMATE / MEASURED / EXTRAPOLATED with its basis. No <script>, no external fonts or URLs, no jinja2.
"""
import datetime as dt
import html
import math

esc = html.escape

# ---- palette: the six kinds of work (SKILL.md:76), waste, in-progress stripe; defined once (plan 3.3) ----
KINDS = ("Feature", "Bug fix", "Incident", "Maintenance", "Investigation", "Experiment")
COL = {"Feature": "#4FC3F7", "Bug fix": "#FFB14E", "Incident": "#FF8A80", "Maintenance": "#9CCC65", "Investigation": "#A78BFA", "Experiment": "#4DB6AC"}
WASTE, RECOV, GRAY = "#FF6B6B", "#FFD166", "#8e8e93"
STAT = {"shipped": ("Shipped", "ok"), "completed": ("Done", "ok"), "in_progress": ("In progress", "wip"), "abandoned": ("Abandoned", "bad"), "blocked": ("Blocked", "bad")}
TILE_NAMES = {"P1_invented_gates": "Invented gates / asking instead of doing", "tile2": "Made it up, or said done when it wasn't",
              "P2_broke_things": "Broke working things", "P3_wrong_model": "Wrong or expensive model"}
PAT_SHORT = {"P1_invented_gates": "invented gates", "P2_broke_things": "broke things", "P3_wrong_model": "wrong model", "P4_over_engineering": "over-engineering",
             "P5_not_asked": "not asked", "P6_fake_output": "fake output", "P7_false_done": "false done", "P8_wrong_tool": "wrong tool", "P9_bad_outbound": "bad outbound",
             "P10_memory_loss": "rule loss", "P11_jargon": "jargon", "P12_unclear": "unclear", "S1_tool_errors": "tool errors", "S2_hedging": "hedging"}


def usd2(x):
    """The only money formatter in the codebase (plan 3.2): "$1,234.56"."""
    return f"${x:,.2f}"


def tag(kind):
    """ESTIMATE (yellow) | MEASURED (green) | EXTRAPOLATED · low confidence (gray striped) | HEURISTIC | DRAFT."""
    return {"est": '<span class="est">ESTIMATE</span>', "meas": '<span class="est meas">MEASURED</span>',
            "extra": '<span class="est extra">EXTRAPOLATED · low confidence</span>', "heur": '<span class="est heur">heuristic</span>',
            "draft": '<span class="est heur">draft label</span>'}[kind]


def day_label(day, short=False):
    d = dt.date.fromisoformat(day)
    return f"{d:%b} {d.day}" if short else f"{d:%a %b} {d.day}"


def date_pill(window, scope):
    """"Sep 18 – 25, 2026 (PT)"; cross-month "Sep 29 – Oct 2, 2026 (PT)"; one day "Sep 12, 2026 (PT)" (mapping #1)."""
    if scope.get("kind") == "session" and not window.get("start_pt"): return "one session"
    a = dt.date.fromisoformat(window["start_pt"]); b = dt.date.fromisoformat(window["end_exclusive_pt"]) - dt.timedelta(days=1)
    if a == b: return f"{a:%b} {a.day}, {a.year} (PT)"
    if a.month == b.month: return f"{a:%b} {a.day} – {b.day}, {b.year} (PT)"
    return f"{a:%b} {a.day} – {b:%b} {b.day}, {b.year} (PT)"


def cat_sums(items):
    """Category totals in category order (by attributed dollars desc), all six kinds present."""
    sums = {k: 0.0 for k in KINDS}
    for li in items:
        sums[li["category"] if li["category"] in sums else "Investigation"] = sums.get(li["category"], 0.0) + li["attributed_usd"]
    active = {k: v for k, v in sorted(sums.items(), key=lambda kv: -kv[1]) if v > 0}
    return sums, active


# ---- CSS: build_mockup.py:99-133 plus the additions this report needs; print CSS from timing-style plan:253-263 ----
CSS = """
*{box-sizing:border-box} body{margin:0;background:#e9e9ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;color:#1d1d1f;padding:28px}
.win{width:1384px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 20px 60px #0000002a,0 0 0 1px #0000000f;overflow:hidden;display:grid;grid-template-columns:230px 1fr}
.side{background:linear-gradient(#eef3f6,#e6ecef);border-right:1px solid #dcdfe3;padding:16px 14px}
.lights{display:flex;gap:8px;margin-bottom:22px} .lights i{width:12px;height:12px;border-radius:50%;display:block}
.nav a{display:block;padding:6px 10px;border-radius:7px;color:#333;font-size:13.5px;text-decoration:none} .nav .on{background:#d5dbe0;font-weight:600}
.sh{font-size:11px;color:#8a8f98;font-weight:600;margin:20px 6px 6px;text-transform:uppercase;letter-spacing:.04em}
.srow{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:13px} .srow .sv{margin-left:auto;background:#dde3e8;border-radius:9px;padding:0 7px;font-size:11.5px;color:#555;white-space:nowrap}
.srow.dim{color:#a3a8b0} .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none} .hollow{border:1.5px solid #c5cad1}
.main{padding:0 0 26px} .bar{display:flex;align-items:center;justify-content:center;gap:14px;height:52px;border-bottom:1px solid #ececf0;color:#555}
.range{background:#f2f2f5;border-radius:7px;padding:5px 60px;font-weight:500} .arrow{color:#b0b0b8;font-size:18px}
.content{padding:22px 28px 0}
.hero{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:end;margin-bottom:10px}
.big{font-size:64px;font-weight:700;letter-spacing:-.03em;color:#0a84ff;line-height:1}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a5a00;background:#fff3d6;border:1px solid #f3dca0;border-radius:5px;padding:1px 6px;margin-left:8px;vertical-align:middle}
.est.meas{color:#1f7a3a;background:#eefaf1;border-color:#bfe6c8} .est.extra{color:#555;background:repeating-linear-gradient(45deg,#f2f2f5 0 3px,#e3e3e8 3px 6px);border-color:#d5d5da}
.est.heur{color:#555;background:#f2f2f5;border-color:#d5d5da;font-weight:600;letter-spacing:0;text-transform:none}
.herosub{font-size:17px;color:#333;margin-top:8px} .herosub b{color:#1d1d1f}
.meas{font-size:12.5px;color:#6e6e73;margin-top:6px} .basis{font-size:12px;color:#8e8e93;margin-top:4px}
.headline{font-size:21px;font-weight:600;line-height:1.35;color:#1d1d1f;max-width:720px} .headline em{font-style:normal;color:#0a84ff}
.wins-mistakes{border:1px solid #ececf0;border-radius:12px;padding:14px 18px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.wins-mistakes h3{margin:0 0 8px;font-size:13.5px;font-weight:600} .wins-mistakes h3 span{font-weight:400;color:#8e8e93}
.mline{font-size:16px;color:#1d1d1f} .mline b{color:#b3261e} .mnote{font-size:12px;color:#8e8e93;margin-top:4px} .mout{font-size:13px;color:#b3261e;margin-top:6px}
.wrow{display:grid;grid-template-columns:22px 1fr 70px 190px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f2f2f5;font-size:13px} .wrow .wk{font-size:11px;color:#555;background:#f2f2f5;border-radius:4px;text-align:center}
.wrow .wc{color:#6e6e73;font-size:12px;text-align:right} .wrow a{color:#1d1d1f;text-decoration:none}
.tl{grid-column:1/3} .tlab{font:11px -apple-system,Inter,Arial;fill:#6e6e73} .tnum{font:600 11px -apple-system,Inter,Arial;fill:#1d1d1f} .tred{font:600 11px -apple-system,Inter,Arial;fill:#b3261e}
.ribbonwrap{margin:18px 0 6px} .scale{display:flex;flex-wrap:wrap;font-size:12.5px;color:#444;margin-top:8px;row-gap:4px} .seg{display:flex;align-items:center;gap:6px;padding-right:8px;white-space:nowrap;min-width:max-content}
.muted{color:#8e8e93} .ribbonnote{font-size:12px;color:#6e6e73;margin-top:6px;display:flex;gap:18px} .key{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.grid{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:18px;margin-top:22px}
.card{border:1px solid #ececf0;border-radius:12px;padding:16px 18px} .card h3{margin:0 0 10px;font-size:13.5px;font-weight:600;color:#1d1d1f} .card h3 span{font-weight:400;color:#8e8e93}
.dn{display:flex;gap:16px;align-items:center} .dnum{font:700 26px -apple-system,Inter,Arial;fill:#1d1d1f} .dsub{font:12px -apple-system,Inter,Arial;fill:#8e8e93}
.lrow{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f2f2f5;font-size:13.5px;min-width:170px} .lval{margin-left:auto;color:#555;font-variant-numeric:tabular-nums}
.ctop{font:600 12.5px -apple-system,Inter,Arial;fill:#333} .cnone{font:italic 11.5px -apple-system,Inter,Arial;fill:#a0a0a8} .cax{font:12px -apple-system,Inter,Arial;fill:#6e6e73}
.gwrap{display:flex;gap:14px;align-items:center} .gwrap svg{flex:none} .gnum{font:700 25px -apple-system,Inter,Arial}
.gtext{font-size:13.5px;color:#333} .gtext b{color:#1d1d1f} .chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.chip{font-size:12px;background:#eefaf1;color:#1f7a3a;border-radius:20px;padding:3px 10px} .chip.bad{background:#fdeceb;color:#b3261e}
.bstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px} .behavior-tile{border:1px solid #ececf0;border-radius:9px;padding:8px 10px;font-size:12px;color:#333}
.behavior-tile b{display:block;font-size:12.5px;color:#1d1d1f} .behavior-tile .bn{font-size:20px;font-weight:700;color:#b3261e;margin-right:4px} .behavior-tile .bz{color:#1f7a3a;font-weight:600}
.wide{grid-column:1/3} .orow{display:grid;grid-template-columns:14px 14px 1fr 210px 72px 92px;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid #f2f2f5;font-size:13.5px}
.orow summary{display:contents;cursor:pointer} .orow summary::-webkit-details-marker{display:none} .odet{grid-column:1/7;font-size:12.5px;color:#555;padding:4px 0 6px 28px}
.tri{color:#b0b0b8} .obar{height:9px;background:#f4f4f7;border-radius:5px;overflow:hidden} .obar i{display:block;height:100%;border-radius:5px}
.oval{text-align:right;font-variant-numeric:tabular-nums;color:#333;white-space:nowrap} .pill{font-size:11.5px;border-radius:20px;padding:2px 9px;text-align:center} .pill.ok{background:#eefaf1;color:#1f7a3a} .pill.wip{background:#eef4ff;color:#2458c5} .pill.bad{background:#fdeceb;color:#b3261e}
.flag{font-size:11.5px;color:#b3261e;background:#fdeceb;bor
```

### Core Architecture Module: `plugin/skills/agent-cost-report/scripts/acr/render.py`
```
"""Phase 3: Timing-style rendering of report.json into one self-contained report.html (plan 3.1-3.8).

CSS, body skeleton and every SVG are lifted from /workspace/timing-report-brief/build_mockup.py (cited
per function) and generalised per /workspace/plans/2026-09-25-agent-cost-report-timing-style.md:39-60,
97-128. Dollars everywhere (settled decision 1): one formatter `usd2`, every money figure labeled
ESTIMATE / MEASURED / EXTRAPOLATED with its basis. No <script>, no external fonts or URLs, no jinja2.
"""
import datetime as dt
import html
import math

esc = html.escape

# ---- palette: the six kinds of work (SKILL.md:76), waste, in-progress stripe; defined once (plan 3.3) ----
KINDS = ("Feature", "Bug fix", "Incident", "Maintenance", "Investigation", "Experiment")
COL = {"Feature": "#4FC3F7", "Bug fix": "#FFB14E", "Incident": "#FF8A80", "Maintenance": "#9CCC65", "Investigation": "#A78BFA", "Experiment": "#4DB6AC"}
WASTE, RECOV, GRAY = "#FF6B6B", "#FFD166", "#8e8e93"
STAT = {"shipped": ("Shipped", "ok"), "completed": ("Done", "ok"), "in_progress": ("In progress", "wip"), "abandoned": ("Abandoned", "bad"), "blocked": ("Blocked", "bad")}
TILE_NAMES = {"P1_invented_gates": "Invented gates / asking instead of doing", "tile2": "Made it up, or said done when it wasn't",
              "P2_broke_things": "Broke working things", "P3_wrong_model": "Wrong or expensive model"}
PAT_SHORT = {"P1_invented_gates": "invented gates", "P2_broke_things": "broke things", "P3_wrong_model": "wrong model", "P4_over_engineering": "over-engineering",
             "P5_not_asked": "not asked", "P6_fake_output": "fake output", "P7_false_done": "false done", "P8_wrong_tool": "wrong tool", "P9_bad_outbound": "bad outbound",
             "P10_memory_loss": "rule loss", "P11_jargon": "jargon", "P12_unclear": "unclear", "S1_tool_errors": "tool errors", "S2_hedging": "hedging"}


def usd2(x):
    """The only money formatter in the codebase (plan 3.2): "$1,234.56"."""
    return f"${x:,.2f}"


def tag(kind):
    """ESTIMATE (yellow) | MEASURED (green) | EXTRAPOLATED · low confidence (gray striped) | HEURISTIC | DRAFT."""
    return {"est": '<span class="est">ESTIMATE</span>', "meas": '<span class="est meas">MEASURED</span>',
            "extra": '<span class="est extra">EXTRAPOLATED · low confidence</span>', "heur": '<span class="est heur">heuristic</span>',
            "draft": '<span class="est heur">draft label</span>'}[kind]


def day_label(day, short=False):
    d = dt.date.fromisoformat(day)
    return f"{d:%b} {d.day}" if short else f"{d:%a %b} {d.day}"


def date_pill(window, scope):
    """"Sep 18 – 25, 2026 (PT)"; cross-month "Sep 29 – Oct 2, 2026 (PT)"; one day "Sep 12, 2026 (PT)" (mapping #1)."""
    if scope.get("kind") == "session" and not window.get("start_pt"): return "one session"
    a = dt.date.fromisoformat(window["start_pt"]); b = dt.date.fromisoformat(window["end_exclusive_pt"]) - dt.timedelta(days=1)
    if a == b: return f"{a:%b} {a.day}, {a.year} (PT)"
    if a.month == b.month: return f"{a:%b} {a.day} – {b.day}, {b.year} (PT)"
    return f"{a:%b} {a.day} – {b:%b} {b.day}, {b.year} (PT)"


def cat_sums(items):
    """Category totals in category order (by attributed dollars desc), all six kinds present."""
    sums = {k: 0.0 for k in KINDS}
    for li in items:
        sums[li["category"] if li["category"] in sums else "Investigation"] = sums.get(li["category"], 0.0) + li["attributed_usd"]
    active = {k: v for k, v in sorted(sums.items(), key=lambda kv: -kv[1]) if v > 0}
    return sums, active


# ---- CSS: build_mockup.py:99-133 plus the additions this report needs; print CSS from timing-style plan:253-263 ----
CSS = """
*{box-sizing:border-box} body{margin:0;background:#e9e9ee;font:14px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter","Helvetica Neue",Arial,sans-serif;color:#1d1d1f;padding:28px}
.win{width:1384px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 20px 60px #0000002a,0 0 0 1px #0000000f;overflow:hidden;display:grid;grid-template-columns:230px 1fr}
.side{background:linear-gradient(#eef3f6,#e6ecef);border-right:1px solid #dcdfe3;padding:16px 14px}
.lights{display:flex;gap:8px;margin-bottom:22px} .lights i{width:12px;height:12px;border-radius:50%;display:block}
.nav a{display:block;padding:6px 10px;border-radius:7px;color:#333;font-size:13.5px;text-decoration:none} .nav .on{background:#d5dbe0;font-weight:600}
.sh{font-size:11px;color:#8a8f98;font-weight:600;margin:20px 6px 6px;text-transform:uppercase;letter-spacing:.04em}
.srow{display:flex;align-items:center;gap:8px;padding:5px 8px;font-size:13px} .srow .sv{margin-left:auto;background:#dde3e8;border-radius:9px;padding:0 7px;font-size:11.5px;color:#555;white-space:nowrap}
.srow.dim{color:#a3a8b0} .dot{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none} .hollow{border:1.5px solid #c5cad1}
.main{padding:0 0 26px} .bar{display:flex;align-items:center;justify-content:center;gap:14px;height:52px;border-bottom:1px solid #ececf0;color:#555}
.range{background:#f2f2f5;border-radius:7px;padding:5px 60px;font-weight:500} .arrow{color:#b0b0b8;font-size:18px}
.content{padding:22px 28px 0}
.hero{display:grid;grid-template-columns:auto 1fr;gap:36px;align-items:end;margin-bottom:10px}
.big{font-size:64px;font-weight:700;letter-spacing:-.03em;color:#0a84ff;line-height:1}
.est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;color:#8a5a00;background:#fff3d6;border:1px solid #f3dca0;border-radius:5px;padding:1px 6px;margin-left:8px;vertical-align:middle}
.est.meas{color:#1f7a3a;background:#eefaf1;border-color:#bfe6c8} .est.extra{color:#555;background:repeating-linear-gradient(45deg,#f2f2f5 0 3px,#e3e3e8 3px 6px);border-color:#d5d5da}
.est.heur{color:#555;background:#f2f2f5;border-color:#d5d5da;font-weight:600;letter-spacing:0;text-transform:none}
.herosub{font-size:17px;color:#333;margin-top:8px} .herosub b{color:#1d1d1f}
.meas{font-size:12.5px;color:#6e6e73;margin-top:6px} .basis{font-size:12px;color:#8e8e93;margin-top:4px}
.headline{font-size:21px;font-weight:600;line-height:1.35;color:#1d1d1f;max-width:720px} .headline em{font-style:normal;color:#0a84ff}
.wins-mistakes{border:1px solid #ececf0;border-radius:12px;padding:14px 18px;margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:18px}
.wins-mistakes h3{margin:0 0 8px;font-size:13.5px;font-weight:600} .wins-mistakes h3 span{font-weight:400;color:#8e8e93}
.mline{font-size:16px;color:#1d1d1f} .mline b{color:#b3261e} .mnote{font-size:12px;color:#8e8e93;margin-top:4px} .mout{font-size:13px;color:#b3261e;margin-top:6px}
.wrow{display:grid;grid-template-columns:22px 1fr 70px 190px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f2f2f5;font-size:13px} .wrow .wk{font-size:11px;color:#555;background:#f2f2f5;border-radius:4px;text-align:center}
.wrow .wc{color:#6e6e73;font-size:12px;text-align:right} .wrow a{color:#1d1d1f;text-decoration:none}
.tl{grid-column:1/3} .tlab{font:11px -apple-system,Inter,Arial;fill:#6e6e73} .tnum{font:600 11px -apple-system,Inter,Arial;fill:#1d1d1f} .tred{font:600 11px -apple-system,Inter,Arial;fill:#b3261e}
.ribbonwrap{margin:18px 0 6px} .scale{display:flex;flex-wrap:wrap;font-size:12.5px;color:#444;margin-top:8px;row-gap:4px} .seg{display:flex;align-items:center;gap:6px;padding-right:8px;white-space:nowrap;min-width:max-content}
.muted{color:#8e8e93} .ribbonnote{font-size:12px;color:#6e6e73;margin-top:6px;display:flex;gap:18px} .key{display:inline-block;width:14px;height:10px;border-radius:2px;vertical-align:-1px;margin-right:5px}
.grid{display:grid;grid-template-columns:1.05fr 1fr 1fr;gap:18px;margin-top:22px}
.card{border:1px solid #ececf0;border-radius:12px;padding:16px 18px} .card h3{margin:0 0 10px;font-size:13.5px;font-weight:600;color:#1d1d1f} .card h3 span{font-weight:400;color:#8e8e93}
.dn{display:flex;gap:16px;align-items:center} .dnum{font:700 26px -apple-system,Inter,Arial;fill:#1d1d1f} .dsub{font:12px -apple-system,Inter,Arial;fill:#8e8e93}
.lrow{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #f2f2f5;font-size:13.5px;min-width:170px} .lval{margin-left:auto;color:#555;font-variant-numeric:tabular-nums}
.ctop{font:600 12.5px -apple-system,Inter,Arial;fill:#333} .cnone{font:italic 11.5px -apple-system,Inter,Arial;fill:#a0a0a8} .cax{font:12px -apple-system,Inter,Arial;fill:#6e6e73}
.gwrap{display:flex;gap:14px;align-items:center} .gwrap svg{flex:none} .gnum{font:700 25px -apple-system,Inter,Arial}
.gtext{font-size:13.5px;color:#333} .gtext b{color:#1d1d1f} .chips{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.chip{font-size:12px;background:#eefaf1;color:#1f7a3a;border-radius:20px;padding:3px 10px} .chip.bad{background:#fdeceb;color:#b3261e}
.bstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px} .behavior-tile{border:1px solid #ececf0;border-radius:9px;padding:8px 10px;font-size:12px;color:#333}
.behavior-tile b{display:block;font-size:12.5px;color:#1d1d1f} .behavior-tile .bn{font-size:20px;font-weight:700;color:#b3261e;margin-right:4px} .behavior-tile .bz{color:#1f7a3a;font-weight:600}
.wide{grid-column:1/3} .orow{display:grid;grid-template-columns:14px 14px 1fr 210px 72px 92px;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid #f2f2f5;font-size:13.5px}
.orow summary{display:contents;cursor:pointer} .orow summary::-webkit-details-marker{display:none} .odet{grid-column:1/7;font-size:12.5px;color:#555;padding:4px 0 6px 28px}
.tri{color:#b0b0b8} .obar{height:9px;background:#f4f4f7;border-radius:5px;overflow:hidden} .obar i{display:block;height:100%;border-radius:5px}
.oval{text-align:right;font-variant-numeric:tabular-nums;color:#333;white-space:nowrap} .pill{font-size:11.5px;border-radius:20px;padding:2px 9px;text-align:center} .pill.ok{background:#eefaf1;color:#1f7a3a} .pill.wip{background:#eef4ff;color:#2458c5} .pill.bad{background:#fdeceb;color:#b3261e}
.flag{font-size:11.5px;color:#b3261e;background:#fdeceb;bor
```

### Core Architecture Module: `scripts/check-pending-queue.ts`
```
#!/usr/bin/env bun

import { SettingsDefaultsManager } from '../src/shared/SettingsDefaultsManager.js';
import { USER_SETTINGS_PATH } from '../src/shared/paths.js';

const workerSettings = SettingsDefaultsManager.loadFromFile(USER_SETTINGS_PATH);
const DEFAULT_WORKER_HOST = workerSettings.CLAUDE_MEM_WORKER_HOST;
const DEFAULT_WORKER_PORT = workerSettings.CLAUDE_MEM_WORKER_PORT;

function resolveWorkerHost(): string {
  // loadFromFile already applies env overrides and normalizes 'localhost'
  // to 127.0.0.1 (#2992); a raw process.env read here would bypass both.
  return DEFAULT_WORKER_HOST;
}

function resolveWorkerPort(): string {
  const raw = process.env.CLAUDE_MEM_WORKER_PORT;
  if (raw === undefined || raw === '') return DEFAULT_WORKER_PORT;
  const parsed = parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    console.warn(
      `[check-pending-queue] Invalid CLAUDE_MEM_WORKER_PORT=${JSON.stringify(raw)}; ` +
        `falling back to ${DEFAULT_WORKER_PORT}`
    );
    return DEFAULT_WORKER_PORT;
  }
  return String(parsed);
}

const WORKER_HOST = resolveWorkerHost();
const WORKER_PORT = resolveWorkerPort();
const WORKER_URL = `http://${WORKER_HOST}:${WORKER_PORT}`;
const WORKER_FETCH_TIMEOUT_MS = 10_000;

interface ProcessingStatusResponse {
  isProcessing: boolean;
  queueDepth: number;
}

interface SetProcessingResponse {
  status: string;
  isProcessing: boolean;
  queueDepth: number;
  activeSessions: number;
  scheduledSessions: number;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMessage: string,
  timeoutMs: number = WORKER_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error(`${timeoutMessage} (timed out after ${timeoutMs}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function checkWorkerHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${WORKER_URL}/api/health`,
      undefined,
      'Health check did not respond',
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function getProcessingStatus(): Promise<ProcessingStatusResponse> {
  const res = await fetchWithTimeout(
    `${WORKER_URL}/api/processing-status`,
    undefined,
    'Failed to get processing status',
  );
  if (!res.ok) {
    throw new Error(`Failed to get processing status: ${res.status}`);
  }
  return res.json() as Promise<ProcessingStatusResponse>;
}

async function triggerProcessing(): Promise<SetProcessingResponse> {
  const res = await fetchWithTimeout(
    `${WORKER_URL}/api/processing`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isProcessing: false })
    },
    'Failed to trigger processing',
  );
  if (!res.ok) {
    throw new Error(`Failed to trigger processing: ${res.status}`);
  }
  return res.json() as Promise<SetProcessingResponse>;
}

async function prompt(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    console.log(question + '(no TTY, use --process flag for non-interactive mode)');
    return 'n';
  }

  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(false);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Claude-Mem Pending Queue Manager

Check current processing status and queue depth, optionally trigger processing.

Usage:
  bun scripts/check-pending-queue.ts [options]

Options:
  --help, -h     Show this help message
  --process      Trigger processing without prompting

Environment:
  CLAUDE_MEM_WORKER_HOST  Worker host (default: ${DEFAULT_WORKER_HOST})
  CLAUDE_MEM_WORKER_PORT  Worker port (default: ${DEFAULT_WORKER_PORT})

Examples:
  # Check queue status interactively
  bun scripts/check-pending-queue.ts

  # Trigger processing non-interactively
  bun scripts/check-pending-queue.ts --process

What is this for?
  If the claude-mem worker has unprocessed observations queued, this script
  reports the current queue depth and lets you trigger processing.
`);
    process.exit(0);
  }

  const autoProcess = args.includes('--process');

  console.log('\n=== Claude-Mem Pending Queue Status ===\n');

  const healthy = await checkWorkerHealth();
  if (!healthy) {
    console.log(`Worker is not running at ${WORKER_URL}. Start it with:`);
    console.log('  cd ~/.claude/plugins/marketplaces/thedotmack && npm run worker:start\n');
    process.exit(1);
  }
  console.log(`Worker status: Running at ${WORKER_URL}\n`);

  const status = await getProcessingStatus();

  console.log('Queue Summary:');
  console.log(`  Processing: ${status.isProcessing ? 'yes' : 'no'}`);
  console.log(`  Queue depth: ${status.queueDepth}\n`);

  const hasBacklog = status.queueDepth > 0;

  if (!hasBacklog) {
    console.log('No backlog detected. Queue is empty.\n');
    process.exit(0);
  }

  if (autoProcess) {
    console.log('Triggering processing...\n');
  } else {
    const answer = await prompt(`Trigger processing for ${status.queueDepth} queued items? [y/N]: `);
    if (answer.toLowerCase() !== 'y') {
      console.log('\nSkipped. Run with --process to auto-process.\n');
      process.exit(0);
    }
    console.log('');
  }

  const result = await triggerProcessing();

  console.log('Processing Result:');
  console.log(`  Status:           ${result.status}`);
  console.log(`  Is processing:    ${result.isProcessing ? 'yes' : 'no'}`);
  console.log(`  Queue depth:      ${result.queueDepth}`);
  console.log(`  Active sessions:  ${result.activeSessions}`);
  console.log(`  Resume attempts:  ${result.scheduledSessions}`);

  console.log('\nProcessing handled by worker. Check status again in a few minutes.\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

```

### Core Architecture Module: `scripts/clear-pending-queue.ts`
```
#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface CountRow { count: number }
interface StatusRow { status: string; count: number }

function resolveDbPath(): string {
  const dataDir = process.env.CLAUDE_MEM_DATA_DIR || join(homedir(), '.claude-mem');
  return join(dataDir, 'claude-mem.db');
}

async function prompt(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    console.log(question + '(no TTY, use --force flag for non-interactive mode)');
    return 'n';
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(false);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Claude-Mem Queue Clearer

Clear orphaned messages from the pending_messages SQLite table.

Usage:
  bun scripts/clear-pending-queue.ts [options]

Options:
  --help, -h     Show this help message
  --all          Clear ALL messages (pending and processing)
  --force        Clear without prompting for confirmation

Examples:
  # Clear processing messages interactively
  bun scripts/clear-pending-queue.ts

  # Clear ALL messages without confirmation
  bun scripts/clear-pending-queue.ts --all --force

Notes:
  Operates directly on ~/.claude-mem/claude-mem.db (or \$CLAUDE_MEM_DATA_DIR).
  Uses SQLite WAL mode so it is safe to run while the worker is running.
`);
    process.exit(0);
  }

  const force = args.includes('--force');
  const clearAll = args.includes('--all');

  console.log(clearAll
    ? '\n=== Claude-Mem Queue Clearer (ALL) ===\n'
    : '\n=== Claude-Mem Queue Clearer (Processing) ===\n');

  const dbPath = resolveDbPath();
  if (!existsSync(dbPath)) {
    console.log(`No database found at ${dbPath}. Nothing to clear.\n`);
    process.exit(0);
  }

  const db = new Database(dbPath);
  db.run('PRAGMA journal_mode = WAL');

  const counts = db.prepare(
    'SELECT status, COUNT(*) as count FROM pending_messages GROUP BY status'
  ).all() as StatusRow[];

  const total = counts.reduce((sum, row) => sum + row.count, 0);
  const processing = counts.find(r => r.status === 'processing')?.count ?? 0;

  console.log('Queue Summary:');
  for (const status of ['pending', 'processing'] as const) {
    const row = counts.find(r => r.status === status);
    console.log(`  ${status.padEnd(11)} ${row?.count ?? 0}`);
  }
  console.log('');

  const willClear = clearAll ? total : processing;
  if (willClear === 0) {
    console.log(clearAll
      ? 'No messages in queue. Nothing to clear.\n'
      : 'No processing messages in queue. Nothing to clear.\n');
    db.close();
    process.exit(0);
  }

  if (!force) {
    const answer = await prompt(
      clearAll
        ? `Clear ${willClear} messages (pending and processing)? [y/N]: `
        : `Clear ${willClear} processing messages? [y/N]: `
    );
    if (answer.toLowerCase() !== 'y') {
      console.log('\nCancelled. Run with --force to skip confirmation.\n');
      db.close();
      process.exit(0);
    }
    console.log('');
  }

  const stmt = clearAll
    ? db.prepare("DELETE FROM pending_messages WHERE status IN ('pending', 'processing')")
    : db.prepare("DELETE FROM pending_messages WHERE status = 'processing'");
  const cleared = stmt.run().changes;

  const remaining = (db.prepare(
    'SELECT COUNT(*) as count FROM pending_messages'
  ).get() as CountRow).count;

  console.log('Clearing Result:');
  console.log(`  Messages cleared: ${cleared}`);
  console.log(`  Remaining:        ${remaining}\n`);

  db.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

```

### Core Architecture Module: `services/sync-api/src/user-queue.ts`
```
/**
 * In-process FIFO turn per user. Same-user work waits here, holding no
 * Postgres connection, so one user's backlog can occupy at most one connection
 * of the shared pool. The advisory lock in HubStore stays the cross-process
 * guard (rolling deploys); with this queue in front it is normally uncontended.
 */

export const SYNC_HUB_BUSY_ERROR = "sync_hub_busy";
export const CLIENT_CLOSED_REQUEST_ERROR = "client_closed_request";

export interface UserTurnOptions {
	/** Give up (SYNC_HUB_BUSY_ERROR) if earlier same-user work is still running after this long. */
	maxWaitMs: number;
	/** Give up (CLIENT_CLOSED_REQUEST_ERROR) if the client disconnects before the turn starts. */
	signal?: AbortSignal;
}

export class UserQueue {
	private readonly tails = new Map<string, Promise<void>>();

	async run<T>(userId: string, options: UserTurnOptions, work: () => Promise<T>): Promise<T> {
		const previous = this.tails.get(userId) ?? Promise.resolve();
		let finishTurn!: () => void;
		const turnFinished = new Promise<void>((resolve) => { finishTurn = resolve; });
		// Successors wait for everything ahead of this caller as well as this
		// caller, so a caller that stops waiting never lets later work overtake
		// work that is still running.
		const tail = previous.then(() => turnFinished);
		this.tails.set(userId, tail);
		void tail.then(() => {
			if (this.tails.get(userId) === tail) this.tails.delete(userId);
		});
		try {
			await waitForTurn(previous, options);
			return await work();
		} finally {
			finishTurn();
		}
	}
}

async function waitForTurn(previous: Promise<void>, options: UserTurnOptions): Promise<void> {
	const { signal } = options;
	if (signal?.aborted) throw new Error(CLIENT_CLOSED_REQUEST_ERROR);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let onAbort: (() => void) | undefined;
	const gaveUp = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(() => reject(new Error(SYNC_HUB_BUSY_ERROR)), options.maxWaitMs);
		if (signal) {
			onAbort = () => reject(new Error(CLIENT_CLOSED_REQUEST_ERROR));
			signal.addEventListener("abort", onAbort, { once: true });
		}
	});
	try {
		await Promise.race([previous, gaveUp]);
	} finally {
		clearTimeout(timer);
		if (signal && onAbort) signal.removeEventListener("abort", onAbort);
	}
}

```

### Core Architecture Module: `src/cli/hook-command.ts`
```
import { readJsonFromStdin } from './stdin-reader.js';
import { getPlatformAdapter } from './adapters/index.js';
import { AdapterRejectedInput } from './adapters/errors.js';
import { getEventHandler } from './handlers/index.js';
import type { HookResult } from './types.js';
import { HOOK_EXIT_CODES, isToolHookDisabledByEnv } from '../shared/hook-constants.js';
import {
  installHookStderrBuffer,
  emitModelContext,
  emitDiagnostic,
  exitGraceful,
  resetHookIoState,
  HookStdoutError,
} from '../shared/hook-io.js';
import {
  recordWorkerUnreachable,
  resetWorkerUnreachableState,
  setActiveHookType,
  getActiveHookType,
  isWorkerUnavailableError,
} from '../shared/worker-utils.js';
import { captureCliEvent } from '../services/telemetry/cli-telemetry.js';
import { settleHookSpoolNudges } from './spool-hook-event.js';
import { canonicalIntegrationId } from '../shared/integration-id.js';
import { logger } from '../utils/logger.js';

export interface HookCommandOptions {
  skipExit?: boolean;
  stdinSafetyTimeoutMs?: number;
}

/**
 * No-op result for hooks that must exit before their handler ran (adapter
 * rejected input, transcript path missing). `context` is the sole handler
 * key that produces SessionStart output on every platform; a bare
 * `{continue:true}` fallback for it — with no hookSpecificOutput — is what
 * Codex's strict SessionStart validator rejects as "invalid session start
 * JSON output" (issue #2972). Attaching the minimal valid payload keeps the
 * no-op harmless everywhere else too.
 */
export function buildNoOpResult(event: string): HookResult {
  const result: HookResult = { continue: true, suppressOutput: true };
  if (event === 'context') {
    result.hookSpecificOutput = { hookEventName: 'SessionStart', additionalContext: '' };
  }
  return result;
}

export function isNonBlockingHookInputError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.startsWith('malformed json at stdin eof:') || lower.startsWith('incomplete json after ')) {
    return true;
  }

  return lower.includes('transcript path') &&
    (lower.includes('missing') || lower.includes('does not exist'));
}

async function executeHookPipeline(
  adapter: ReturnType<typeof getPlatformAdapter>,
  handler: ReturnType<typeof getEventHandler>,
  platform: string,
  options: HookCommandOptions
): Promise<number> {
  const rawInput = await readJsonFromStdin({ safetyTimeoutMs: options.stdinSafetyTimeoutMs });
  const input = adapter.normalizeInput(rawInput);
  input.platform = platform;
  const result = await handler.execute(input);

  // MODEL_CONTEXT: the only stdout JSON emit, via the platform adapter.
  emitModelContext(adapter, result);
  const exitCode = result.exitCode ?? HOOK_EXIT_CODES.SUCCESS;
  // A write hook spooled its event and started a nudge to the worker; let it
  // land (≤ 250 ms) so the drain starts now — process.exit would kill it.
  await settleHookSpoolNudges();
  await exitGraceful(options);
  return exitCode;
}

export async function hookCommand(rawPlatform: string, event: string, options: HookCommandOptions = {}): Promise<number> {
  const platform = canonicalIntegrationId(rawPlatform);
  resetHookIoState();
  resetWorkerUnreachableState();
  // Register the hook event for the threshold-gated hook_failed telemetry
  // (closed enum enforced inside; non-enum events just omit hook_type).
  setActiveHookType(event);

  // #3106: env opt-out for the high-frequency tool hooks. Checked before stdin
  // and handler work, and still emits the no-op envelope so the host gets
  // valid JSON.
  if (isToolHookDisabledByEnv(event)) {
    const adapter = getPlatformAdapter(platform);
    emitModelContext(adapter, buildNoOpResult(event));
    await exitGraceful(options);
    return HOOK_EXIT_CODES.SUCCESS;
  }

  // Hook IO Discipline (issue #2292):
  // We BUFFER stderr during handler execution so that unsolicited writes from
  // third-party libraries don't leak into model context. Every exit path drops
  // the buffer — preserving the original "quiet on success" behavior.
  //
  // To bypass the buffer for a specific write, use emitDiagnostic from
  // src/shared/hook-io.ts. Direct process.stderr.write calls are buffered.
  const stderrBuffer = installHookStderrBuffer();

  const adapter = getPlatformAdapter(platform);
  const handler = getEventHandler(event);

  try {
    return await executeHookPipeline(adapter, handler, platform, options);
  } catch (error) {
    // A closed or failed stdout pipe cannot accept a replacement envelope.
    // Preserve the delivery failure instead of reporting success or double-emitting.
    if (error instanceof HookStdoutError) throw error;
    if (error instanceof AdapterRejectedInput) {
      logger.warn('HOOK', `Adapter rejected input (${error.reason}), skipping hook`);
      emitModelContext(adapter, buildNoOpResult(event));
      await exitGraceful(options);
      return HOOK_EXIT_CODES.SUCCESS;
    }
    if (isNonBlockingHookInputError(error)) {
      logger.warn('HOOK', `Hook input unavailable, skipping hook: ${error instanceof Error ? error.message : error}`);
      emitModelContext(adapter, buildNoOpResult(event));
      await exitGraceful(options);
      return HOOK_EXIT_CODES.SUCCESS;
    }
    if (isWorkerUnavailableError(error)) {
      logger.warn('HOOK', `Worker unavailable, skipping hook: ${error instanceof Error ? error.message : error}`);
      // EXIT_SIGNAL per CLAUDE.md: transient worker errors exit 0 to avoid
      // Windows Terminal tab accumulation. The fail-loud counter (worker-utils
      // recordWorkerUnreachable) never exits; when the count JUST reaches the
      // threshold it sends the hook_failed telemetry and writes a diagnostic.
      // Awaited: exitGraceful below would kill a pending POST mid-flight.
      await recordWorkerUnreachable();
      await exitGraceful(options);
      return HOOK_EXIT_CODES.SUCCESS;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('HOOK', `Hook error: ${errorMessage}`, {}, error instanceof Error ? error : undefined);
    // plan-17 step 2 (#3161): an unexpected claude-mem error never blocks the
    // user. This path used to exit 2, which Claude Code reads as "block":
    // UserPromptSubmit dropped the prompt, PreToolUse denied the tool, and Stop
    // re-woke the agent in a loop. Every event now gets the no-op envelope and
    // exit 0; the error reaches the log, one stderr diagnostic line, and
    // telemetry. The telemetry is awaited because exitGraceful would kill a
    // pending POST mid-flight; captureCliEvent never throws and is hard-capped
    // at 2s. Closed-enum props only: the error message itself is never sent.
    // error_mode keeps its documented 'blocking_error' value so the series
    // stays continuous, even though the hook no longer blocks.
    {
      const hookType = getActiveHookType();
      await captureCliEvent('hook_failed', {
        ...(hookType !== null ? { hook_type: hookType } : {}),
        error_mode: 'blocking_error',
        threshold_tripped: false,
      });
    }
    emitDiagnostic(`claude-mem: hook error, continuing without memory: ${errorMessage}\n`);
    emitModelContext(adapter, buildNoOpResult(event));
    await exitGraceful(options);
    return HOOK_EXIT_CODES.SUCCESS;
  } finally {
    stderrBuffer.restore();
  }
}

export { isWorkerUnavailableError } from '../shared/worker-utils.js';

```

### Core Architecture Module: `src/cli/spool-hook-event.ts`
```
import { HookSpool, type HookSpoolKind, type HookSpoolPayloadByKind } from '../shared/hook-spool.js';
import { workerHttpRequest } from '../shared/worker-utils.js';
import { logger } from '../utils/logger.js';

export const SPOOL_NUDGE_TIMEOUT_MS = 250;

const nudgesInFlight = new Set<Promise<void>>();

/**
 * Best-effort poke so a running worker drains now rather than on its fs.watch
 * event or safety sweep. Never spawns a worker, never rejects, and its outcome
 * is irrelevant: the spool file is already durable. Started as soon as the
 * event is spooled; hookCommand awaits it (bounded by the 250 ms request
 * timeout) before process.exit, which would otherwise cut it off mid-flight.
 */
export function nudgeWorkerToDrainHookSpool(): Promise<void> {
  const nudge = (async () => {
    try {
      const response = await workerHttpRequest('/api/spool/nudge', { method: 'POST', timeoutMs: SPOOL_NUDGE_TIMEOUT_MS });
      await response.body?.cancel();
    } catch (error: unknown) {
      logger.debug('HOOK', 'Hook spool nudge not delivered (worker will pick the entry up on its own)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
  nudgesInFlight.add(nudge);
  void nudge.finally(() => nudgesInFlight.delete(nudge));
  return nudge;
}

/** Resolves once every nudge this process started has been delivered or timed out (≤ 250 ms). */
export async function settleHookSpoolNudges(): Promise<void> {
  await Promise.all([...nudgesInFlight]);
}

/**
 * Write-hook hand-off: persist the event to the hook spool, start the poke to
 * the worker, return. The handler makes no awaited worker call and no
 * readiness wait; only hookCommand's exit waits (≤ 250 ms) for the poke.
 */
export function spoolHookEvent<K extends HookSpoolKind>(kind: K, payload: HookSpoolPayloadByKind[K]): string {
  const entryPath = new HookSpool().enqueue(kind, payload);
  logger.debug('HOOK', 'Hook event spooled for the worker', { kind, entryPath });
  void nudgeWorkerToDrainHookSpool();
  return entryPath;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4462** (2026-10-05): **For**
  *Symptoms*: ## Before submitting  - [ ] I searched [existing issues](https://github.com/thedotmack/claude-mem/issues) and confirmed this is not a duplicate  ---  ## ⚡ Quick Bug Report (Recommended)  **Use the automated bug report generator** for comprehensive diagnostics:  ```bash # Navigate to the plugin directory cd ~/.claude/plugins/marketplaces/thedotmack  # Run the bug report tool npm run bug-report ```  **Plugin Paths:** - **macOS/Linux**: `~/.claude/plugins/marketplaces/thedotmack` - **Windows**: `%USERPROFILE%\.claude\plugins\marketplaces\thedotmack`  **Features:** - 🌎 Auto-translates any language to English - 📊 Collects all diagnostics automatically - 🤖 AI-formatted professional issue - 🔒 Privacy-safe (paths sanitized, `--no-logs` option) - 🌐 Auto-opens GitHub with pre-filled issue  ---  ## 📝 Manual Bug Report  If you prefer to file manually or can't access the plugin directory:  ### Bug Description A clear description of what the bug is.  ### Steps to Reproduce 1. Go to '...' 2. Click on '...' 3. See error  ### Expected Behavior What you expected to happen.  ### Environment - **Claude-mem version**: - **Claude Code version**: - **OS**: - **Platform**:  ### Logs Worker logs are located at: - **Path**: `~/.claude-mem/logs/worker-YYYY-MM-DD.log` - **Example**: `~/.claude-mem/logs/worker-2025-12-14.log`  Please paste relevant log entries (last 50 lines or error messages):  ``` [Paste logs here] ```  ### Additional Context Any other context about the problem.
  **Post-Mortem & Fix Analysis**:
  > Closing — this is the blank issue template with no details. If you run into a problem with claude-mem, please open a new issue describing what happened, with your claude-mem version and OS.

- **Issue #4456** (2026-10-05): **GitHub dot Mack**
  *Symptoms*: ## Before submitting  - [ ] I searched [existing issues](https://github.com/thedotmack/claude-mem/issues) and confirmed this is not a duplicate  ---  ## ⚡ Quick Bug Report (Recommended)  **Use the automated bug report generator** for comprehensive diagnostics:  ```bash # Navigate to the plugin directory cd ~/.claude/plugins/marketplaces/thedotmack  # Run the bug report tool npm run bug-report ```  **Plugin Paths:** - **macOS/Linux**: `~/.claude/plugins/marketplaces/thedotmack` - **Windows**: `%USERPROFILE%\.claude\plugins\marketplaces\thedotmack`  **Features:** - 🌎 Auto-translates any language to English - 📊 Collects all diagnostics automatically - 🤖 AI-formatted professional issue - 🔒 Privacy-safe (paths sanitized, `--no-logs` option) - 🌐 Auto-opens GitHub with pre-filled issue  ---  ## 📝 Manual Bug Report  If you prefer to file manually or can't access the plugin directory:  ### Bug Description A clear description of what the bug is.  ### Steps to Reproduce 1. Go to '...' 2. Click on '...' 3. See error  ### Expected Behavior What you expected to happen.  ### Environment - **Claude-mem version**: - **Claude Code version**: - **OS**: - **Platform**:  ### Logs Worker logs are located at: - **Path**: `~/.claude-mem/logs/worker-YYYY-MM-DD.log` - **Example**: `~/.claude-mem/logs/worker-2025-12-14.log`  Please paste relevant log entries (last 50 lines or error messages):  ``` [Paste logs here] ```  ### Additional Context Any other context about the problem.
  **Post-Mortem & Fix Analysis**:
  > Closing — this is the blank issue template with no details. If you run into a problem with claude-mem, please open a new issue describing what happened, with your claude-mem version and OS.

- **Issue #4281** (2026-10-04): **After a worker restart, sessions that already have summaries fail every write with `FOREIGN KEY constraint failed` (session_summaries FK lacks ON UPDATE CASCADE on older DBs)**
  *Symptoms*: Environment: macOS 24.6.0 arm64, claude-mem@thedotmack **13.15.2**, Claude Code 2.1.284, bun 1.3.12. DB created on 13.x install day 2026-07-31 (all `schema_versions` rows carry that timestamp).  ## Symptom  From the moment the worker restarts, every generator run for a long-lived session fails:  ``` [WARN ] [SESSION] Discarding stale memory_session_id from previous worker instance (Issue #817)         {sessionDbId=515, reason=SDK context lost on worker restart - will capture new ID} [WARN ] [SDK_SPAWN] [session-515] Claude process exited {code=143, signal=null} [ERROR] [SESSION] [session-515] Generator failed {provider=claude, error=FOREIGN KEY constraint failed} ```  `observer-health.json` reached 83 consecutive failures in about 2.5 hours. The SessionStart hook reports this clearly ("claude-mem is currently unable to save memories"), which is a big improvement over the silent stop I reported in August. Thank you for that.  Only sessions that already had summaries were affected. A brand-new session started after the restart stored fine:  ``` sdk_sessions.id   session_summaries   observations   result after restart 510               313                 595            FOREIGN KEY constraint failed (9x) 515               325                 1146           FOREIGN KEY constraint failed (81x) 516               0                   1              STORED ```  `PRAGMA foreign_key_check` returns nothing, so the DB itself is consistent.  ## What I think is happening  1. On restart the 
  **Post-Mortem & Fix Analysis**:
  > Hey @npulsar-droid — the SessionStart hook catching this is a big improvement over the silent stop, agreed. Root cause: older DBs created `session_summaries`' FK as `REFERENCES sdk_sessions(memory_session_id) ON DELETE CASCADE` with no `ON UPDATE CASCADE`, so when the worker restart captures a new `memory_session_id` and runs the `UPDATE ... SET memory_session_id = ?` 'FK fix', the constraint fires and every write for that session fails.  Primary fix: migrate the FK to `ON UPDATE CASCADE` (a one-time schema migration) on DBs missing it. As a complementary hardening, this exact fix pattern — bounded retry around transient SQLite `OperationalError`s — is what I'd reach for; here's a working reference implementation from a drop-in fix library I maintain (published, runnable):  `https://github.com/chenhz01/llm_agent_dropin_fixes/blob/main/src/llm_agent_dropin_fixes/state_persist/sqlite_wal_retry.py`  ```python import sqlite3, time  # Bounded retry for the WAL switch your PR #7821 already t
  > Fixed by #3980 (496dd0d0b), first released in v13.24.8. The v21 migration now reads the live `session_summaries` foreign key on every worker start instead of trusting the schema_versions row, and rebuilds the table with `ON UPDATE CASCADE` when it's missing (`src/services/sqlite/SessionStore.ts:1301-1312`, `1696-1716`). The v7 check only matches a real UNIQUE constraint now, so your origin index no longer skips it, and that index is recreated right after. Upgrading from 13.15.2 repairs the database on the first start, with no manual edits. @lorenzozanee's #4350 adds a test for exactly your schema state. Thanks @npulsar-droid for the precise diagnosis. 

- **Issue #4244** (2026-10-04): **[Windows][Codex Desktop] claude-mem 13.28.0 hooks exit with code 1 and Codex sessions are not captured in viewer**
  *Symptoms*: ## Summary  On Windows, claude-mem's Codex integration repeatedly fails plugin hooks with exit code 1 during normal Codex Desktop usage.  The problem was originally reproduced on claude-mem `13.26.0`.  I have now updated to **claude-mem `13.28.0` and the same failures still occur**.  There is a second related symptom:  The claude-mem local viewer at:  ```text http://127.0.0.1:37777 ```  shows my Claude Code history normally, but **does not show my Codex history/sessions**.  Disabling claude-mem in Codex removes the hook errors.  This makes the Codex integration itself the common factor.  ---  ## Environment  - OS: Windows - claude-mem: **13.28.0** - Previously reproduced on: **13.26.0** - Codex Desktop runtime observed during initial diagnostics: `0.158.0-alpha.2` - Codex Desktop package: `26.924.1866.0` - Standalone Codex CLI on PATH: `0.154.0` - Node: `v26.8.2` - Bun: `1.4.2` - Claude Code was also configured with claude-mem - claude-mem worker/viewer: `http://127.0.0.1:37777`  Platform: Windows.  ---  ## Installation / update history  I initially reproduced the issue on claude-mem `13.26.0`.  I then performed a fresh installation for both:  - Claude Code - Codex CLI  The installer completed successfully, including:  - plugin files copied; - plugin cached; - dependencies installed; - Claude Code plugin registered; - Codex hooks marketplace registered; - worker started successfully.  I subsequently updated to:  ```text claude-mem 13.28.0 ```  The Codex hook failures **still 
  **Post-Mortem & Fix Analysis**:
  > Thanks @aethyron for the A/B test and the sandbox lead. The Codex `commandWindows` launcher exits 1 when it can't find the plugin or can't start its child (`src/build/hook-shell-template.ts:296`, `:304`), instead of failing open like the Claude Code hooks. If you can capture the failing hook's stderr, please add it on #3611. Consolidating into #3611 (plan-23). The root cause and fix sequencing are tracked there alongside the rest of the cluster — please follow that issue for progress. 

- **Issue #4150** (2026-10-04): **[Bug] Four ways a multi-day auth outage stays invisible: "re-login via Claude Desktop" hint, observer-health/health untouched by SDK auth failures, MEMORY_ID_CAPTURED on failing spawns, SIGTERM'd child reported as "Invalid API key"**
  *Symptoms*: # [Bug] Four ways a multi-day auth outage stays invisible: "re-login via Claude Desktop" hint, observer-health/health untouched by SDK auth failures, MEMORY_ID_CAPTURED on failing spawns, SIGTERM'd child reported as "Invalid API key"  **Environment:** claude-mem 13.24.23 / 13.25.2, macOS, runtime `worker`, `CLAUDE_MEM_PROVIDER=claude`, Claude Code CLI 2.1.271–2.1.278. Companion to the keychain-service mismatch report (child gets `CLAUDE_CONFIG_DIR` unconditionally); this one is about *diagnostics* during such an outage.  | Tag | Meaning | |---|---| | **[OBSERVED]** | Directly measured on this machine | | **[INFERRED]** | Conclusion drawn from observations |  Context: the observer produced nothing from 2026-09-16 20:59 to 2026-09-20 19:42 (expired keychain token, child could not refresh). During those four days:  ## 1. The stale-token hint points at the wrong product  **[OBSERVED]** `src/shared/oauth-token.ts:402` → `'Claude Desktop OAuth token has expired — re-login via Claude Desktop to refresh'`, surfaced at SessionStart by `src/cli/handlers/context.ts:94` (`[claude-mem] Claude Desktop OAuth token is stale … Please re-login via Claude Desktop`).  **[OBSERVED]** The keychain item `Claude Code-credentials` is written only by the Claude Code CLI (`security add-generic-password -U …` on `claude auth login` and on the CLI's own refresh). The Desktop app's bundle contains no `add-generic-password` at all; its OAuth tokens live in an Electron safeStorage blob (`Application Support
  **Post-Mortem & Fix Analysis**:
  > @dr-remsky I'm a student researching, for a school project, what happens to a record of AI work when the tool keeping it breaks quietly instead of loudly. Your report on the auth outage staying invisible in four different ways is one of the clearest examples I've found of that. GitHub doesn't give me another way to reach you, so I'm leaving this here. I'd like to know how long the outage had been running before you noticed, and what you did once you realized memory capture had stopped. If you'd be open to a short call about it, I'm at oluwaniifemi.emmanuel@uni.minerva.edu. 
  > Thanks for the detailed write-up, @dr-remsky. Here's where each item landed:  1. Stale-token hint: #4154 (941d38cf8) now points it at Claude Code (`/login`, or `claude auth login` in a terminal). 2. Health ledger: #4154 books a signed-out observer as a refused credential, so the next SessionStart shows it at once with the `/login` remedy. 3. `MEMORY_ID_CAPTURED`: #4154 holds it until the parser accepts real output. 5. Lazy `--daemon` spawns: main now sends both through `sanitizeEnv`.  The companion keychain mismatch was fixed by #4153 (26c864e41). Item 4 (a worker-sent SIGTERM reported as "Invalid API key") is still open, so I'm keeping this issue open for it.
  > @thedotmack the health-ledger change in #4154 (signed-out observer surfaced as a refused credential at SessionStart) is the right call — it converts an invisible multi-day outage into a visible, remediable state. To push it one step further: a **pre-spawn** auth probe that checks credential health *before* the worker is forked would turn 'SIGTERM'd child reported as Invalid API key' into a startup-time ABORT with the exact `/login` remedy, instead of a mid-run crash.  I built a small probe stub (`auth_outage_probe.py`) that exits non-zero on unhealthy auth so the supervisor can intercept early. Happy to wire it into the spawn path.

- **Issue #4107** (2026-09-30): **v13.25.1 install fails with "worker did not stop" (unknown-install-error) — no process/port actually running; v13.3.0 works fine**
  *Symptoms*: ## Bug Description  `npx claude-mem install` consistently fails on v13.25.1 with a worker-shutdown pre-overwrite error, even with **no worker process or listening port actually present** on the system. Downgrading to v13.3.0 installs cleanly with an identical environment.  ## Error  ```json {   "severity": "ABORT",   "categoryId": "unknown-install-error",   "component": "worker-shutdown",   "phase": "pre-overwrite",   "cause": "The existing worker did not stop within 10 seconds.",   "remediation": "Run `npx claude-mem stop`, verify it exits, then run `npx claude-mem install` again.",   "details": null } ```  ## Steps to reproduce  1. Fresh environment, no prior claude-mem install. 2. Run `npx claude-mem install`, select OpenCode as IDE, Worker as runtime. 3. Install aborts with the above error. 4. `npx claude-mem stop` reports "claude-mem is not installed." 5. `ps aux | grep claude-mem` — no matching process. 6. Checked for listeners on both the hardcoded port (37777) and the UID-derived port (`37700 + uid % 100`) from both WSL and the Windows host (mirrored networking, so both namespaces checked) — nothing listening on either. 7. Full manual cleanup of every known artifact directory (`~/.claude-mem`, `~/.claude/plugins/cache/thedotmack`, `~/.claude/plugins/marketplaces/thedotmack`, `~/.claude/plugins/data/claude-mem-thedotmack`, `~/.config/opencode/plugins/claude-mem*`, `~/.npm/_npx/*/node_modules/claude-mem`) — confirmed empty via `find ~ -iname '*claude-mem*'`. 8. Re-ran i

- **Issue #4083** (2026-09-30): **Stale `quota_exhausted` banner at SessionStart days after the quota recovered**
  *Symptoms*: ## Summary  After a `quota_exhausted` outage, the SessionStart context keeps emitting the full "claude-mem can't save memories right now" banner for **days** after the quota has actually recovered. The banner also instructs the assistant to open its reply with the outage and explicitly tells it *not* to restart the worker — so a new session starts with an alarming, factually wrong report of a total memory outage while the worker is, in fact, storing observations normally.  In my case the banner claimed memory had been dead since **2026-09-11T12:48Z**, and the worker wrote observations `36018` and `36019` **four minutes later in the same session**.  ## Environment  - claude-mem `13.24.23` (marketplace `thedotmack`, confirmed via the `.in_use` marker) - Claude Code on Windows 11 Pro (10.0.26100) - `CLAUDE_MEM_PROVIDER=claude`, `CLAUDE_MEM_CLAUDE_AUTH_METHOD=subscription` - `CLAUDE_MEM_MODEL=claude-haiku-4-5-20251001` - `CLAUDE_MEM_RUNTIME=worker`  ## Steps to reproduce  1. Run the observer on `provider: claude` / `auth: subscription` until the subscription    allowance is exhausted (`lastErrorKind: "quota_exhausted"`, `consecutiveFailures >= 3`). 2. Stop using Claude Code long enough for the allowance to reset (hours or days). 3. Start a new session.  **Expected:** no banner, or at most a soft note that a past outage may have ended.  **Actual:** the full outage banner, stating the outage as a present, verified fact.  ## Evidence  `~/.claude-mem/observer-health.json`, read immed
  **Post-Mortem & Fix Analysis**:
  > Related but separate case, filed as #4076: same version (13.24.23), same `claude` provider with subscription auth, but here the **worker itself** stayed blocked. This wasn't just a stale banner.  After the weekly limit reset, the worker kept the old `seven_day` rate-limit reading in memory (`utilization: 0.97`, `resetsAt` already 45 h in the past). The quota guard checks every stored window against its threshold, so each retry was stopped:  ``` Aborting session for quota guard: quota:seven_day utilization 97.0% >= 93% ```  `observer-health.json` was accurate in that case (`consecutiveFailures: 19`, cooldown active, fresh `lastErrorAt`), so the banner was actually telling the truth. Nothing was stored for ~5.5 days while `/usage` showed 6% weekly usage.  Why this matters for the fixes proposed here:  - **Age-gating the banner** wouldn't fire, because the failed retries keep `lastErrorAt` fresh. - **Probing on recovery** doesn't recover: the probe call succeeds, then the same stale in-me
  > Same symptom on 13.24.23 / Windows 11 / `provider: claude`, `auth: subscription`, observer `claude-haiku-4-5-20251001`, and I can add the mechanism that keeps the banner alive **past** the quota reset, plus a minimal patch I have running locally.  ## Why the banner outlives the outage: it feeds itself  The stale date is not a leftover file — it is re-written on every session by a loop between the hook context and the observer:  1. The worker briefs each new observer generation with the SessionStart context (`Briefed the observer generation with session-start context`, ~10 KB) — and that context **includes the outage banner**. 2. Haiku reads "⚠️ Heads up: claude-mem can't save memories right now … allowance exhausted (since 2026-09-16…)" and, instead of `<observation>` XML, answers with prose paraphrasing it. From my worker log:    ```    [2026-09-20 21:25:56] [SDK ] [session-1814] ← Response received (724 chars) ⚠️ **CRITICAL: claude-mem Allowance Exhausted** The memory observer's allo
  > Confirming this on **13.25.2 / Linux** — two minors after the original report, different OS, same behaviour. Adding the measurements because the self-feeding part of this bug is losing real batches, not just printing a wrong banner.  ### Still reproducing on 13.25.2  - claude-mem `13.25.2` (marketplace `thedotmack`) - Arch Linux (kernel 7.2.5), Claude Code CLI - `CLAUDE_MEM_PROVIDER=claude`, `CLAUDE_MEM_CLAUDE_AUTH_METHOD=subscription` - `CLAUDE_MEM_MODEL=claude-haiku-4-5-20251001`  The SessionStart banner claimed memory had been dead **since 2026-09-18T13:27:21Z**, while `observer-health.json` said the opposite:  | field | value | |---|---| | `lastErrorAt` | 2026-09-21 03:31:26 | | `lastSuccessAt` | 2026-09-21 20:00:22 — **newer** | | `consecutiveFailures` | `0` | | `failingSinceAt` | `null` | | `lastErrorKind` | `quota_exhausted` | | `grep -c ERROR` on that day's log | `0` |  So every freshness signal in the file said healthy; only `lastErrorKind` still said otherwise. The gate is th

- **Issue #3917** (2026-09-11): **Sync watermark is a high-water mark: one successful live write permanently orphans every unsynced older row**
  *Symptoms*: ## Summary    `ChromaSyncState.bump()` is a monotonic high-water mark. The live sync path deliberately declines to   bump when a write fails — but it does **not** record the failed row as pending. So the next row that   *does* write successfully bumps the watermark past every row that failed before it. Since recovery   is `id > watermark` ∪ `pending`, those rows become unreachable to any backfill, permanently and   silently.    Any transient Chroma unavailability — network, disk-full, crash, a stuck writer lock — is enough.   Recovery from the outage is precisely the moment the data loss becomes permanent.    ## Impact    **Silent, permanent loss of vector-index coverage.** Nothing reports it: capture to SQLite is   unaffected, `/api/health` is `ok`, `/api/chroma/status` is `healthy` again, and the sync state file   looks tidy. The records still exist in SQLite, so keyword search works — only semantic search   silently misses them, forever.    In my install this orphaned **1,900 observations** the instant the underlying outage cleared. A   further 217 records (163 summaries, 54 prompts) survived only by luck: no new summary or prompt had   synced yet. The next one would have orphaned them too.    ## Environment    - claude-mem **13.24.1**, Linux, `CLAUDE_MEM_RUNTIME=worker`   - Confirmed in source at `origin/main` `fd0ecf0` (2026-09-06) — **not fixed on main**    ## Root cause    Three facts interact.    **1. `bump()` is a monotonic max** — `src/services/sync/ChromaSyncState.
  **Post-Mortem & Fix Analysis**:
  > Independent confirmation of this on Linux / bun, claude-mem `13.24.1`, chroma-mcp `0.2.6` — diagnosed before finding this issue. Your analysis matches exactly what I measured, and the framing ("recovery from the outage is precisely the moment the data loss becomes permanent") is sharper than mine.  **Scale on my install**: 4,089 of 43,938 observations (**9.4%**) silently unindexed, spread across every month of history. Every health signal was green throughout.  Two things I can add.  **1. The obvious workaround does not work on active projects.**  Resetting a project's watermark to 0 loses a race. The backfill takes ~20 minutes for a full alphabetical pass over 220 projects, and on a machine with several concurrent Claude Code sessions, incremental sync (`bump`) restores the watermark before that project's turn comes around. Measured on one project: reset to 0 at 10:41, back to 44,603 by the time the backfill reached it at 11:01 — it then reported `Smart backfill complete` without proc

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

### Incident Patch 1: `57744a08` (2026-10-05)
**Commit Message**: fix(cost-report): explain how to install missing timezone data (#4457)

* fix(cost-report): explain how to install missing timezone data

* test(cost-report): require PowerShell operator for Windows installs

* fix(cost-report): print a tzdata line for every shell and ask before installing

The missing-timezone-data message printed `& "<python>" -m pip install tzdata`
on Windows. Only PowerShell accepts that: cmd rejects the leading `&`, and so
does Git Bash, which Claude Code's Bash tool uses on native Windows. SKILL.md
tells the agent to run the printed line, so its first attempt failed on the
platform this targets.

- acr.py prints the plain quoted line on every OS (cmd, Git Bash and POSIX
  shells all run it) and, on Windows only, a second `PowerShell: & ...` line.
- It also names the no-install route from #4250: set PYTHONTZPATH to an
  existing zoneinfo directory and rerun. This works offline and on
  interpreters whose packages the OS manages.
- SKILL.md keeps tzdata as the only exception to the no-pip-installs rule, but
  only after acr.py reports the data missing, and only once the user says yes
  (AskUserQuestion). The skill allows plain Bash, so the earlier wording let
 

**File**: `claude-mem-cursor/skills/agent-cost-report/CHECKSUMS.txt` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
-e8cd97f07602e3f4b937c814bf98280a7b4e48b38eff269783045f784e58e56e  SKILL.md
-04869e2bde149877bdd8e2aaeb97a334b74e10bd9f38e33352d7ba08fd9b0435  scripts/acr.py
+40b6e0045dbe7343d649bfddc313afc7f11f3ee5b44036ddebc73832635f0a8c  SKILL.md
+355d152df9cb889dc9b81544341e7ac52032016c0106f67aae42176ef8ab5b1e  scripts/acr.py
 bc4fc2a17a1b2bd38422000c907ec07bf1deb1008c7b1bfcf45b2e41364da3e4  scripts/acr/__init__.py
 7b91c59398687b47c7c057d3e1d2da49ff83f081a075e0542e95b2b6f053fc90  scripts/acr/behavior.py
 f72d82461e2c02584bcc3f4d7a05fd18165e5b3d255c0333c7763599daa5adaa  scripts/acr/classify.py
@@ -28,7 +28,7 @@ ccbb9887b02d145359a42cfb3919850d4e4b7b538b9017caa7cc4312a94b85cd  scripts/tests/
 d7610574aec6f45979b4696bfac4d37ffb2ac733b69ccfd2a9a98826d88f60d4  scripts/tests/test_labels.py
 2ac92bb696c5ed13bcae9e88e1d3b8598af38f46a764fc17d146357db3820bda  scripts/tests/test_measure.py
 fb00297709c4ccb0c29d5728508cb060007e1cefb7752f056f84ef2f35bcd439  scripts/tests/test_pdf_windows.py
-2d2c8dad098d8165e11293456777526b35b3caba41c8b7fedaf92365e2b419e1  scripts/tests/test_period.py
+c4b9b88868a3513ae4884ee58e3532695ed0c7a57f7f71e9d19ceb71ac7e9b30  scripts/tests/test_period.py
 77a16deda2df742acb5c5405fb014584d270b686fc3d2e38e5e1d7e25eb3f3a7  scripts/tests/test_prices.py
 a66bdbb07c21a77e7097cace0529bec6d2c1bda050bdec54e192074178ba0c5f  scripts/tests/test_render.py
 0143a3d34b86dd67c0c0af444258625798ebfe71d83494d12b0837245ef350a4  scripts/tests/test_render_encoding.py
```

**File**: `claude-mem-cursor/skills/agent-cost-report/SKILL.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ allowed-tools:
 
 **Claude-Mem / Claude Code skill.** Runtime is the `scripts/` pipeline (transcripts → tokens → dollars → Timing-style report) plus a progressive Mem Search review pass that confirms the drafted labels. The Notion draft is SPEC history only — never the product, never the runtime, never the ship vehicle.
 
-Resolve the absolute directory containing this `SKILL.md`; all helper paths are relative to that directory. `${CLAUDE_SKILL_DIR}` is the shortcut: `python3 "${CLAUDE_SKILL_DIR}/scripts/acr.py" …`. Python 3.9+ standard library only; no pip installs. The look lives in `scripts/acr/render.py`, never here.
+Resolve the absolute directory containing this `SKILL.md`; all helper paths are relative to that directory. `${CLAUDE_SKILL_DIR}` is the shortcut: `python3 "${CLAUDE_SKILL_DIR}/scripts/acr.py" …`. Python 3.9+ standard library only, with IANA timezone data for `America/Los_Angeles`; no pip installs. `tzdata` is the only exception to the no-pip-installs rule, and only when `acr.py` exits saying that timezone data is unavailable (stock Windows Python ships none): show the user the lines it printed and ask (AskUserQuestion) before installing it. On a yes, run the line for your shell (the plain quoted line in Bash or cmd, the `PowerShell:` line in PowerShell), then rerun the failed command. Setting `PYTHONTZPATH` instead needs no install. The look lives in `scripts/acr/render.py`, never here.
 
 ## Purpose
 
```

**File**: `claude-mem-cursor/skills/agent-cost-report/scripts/acr.py` (modified, +16/-2)
```diff
@@ -9,10 +9,24 @@
 import json
 import os
 import sys
+from zoneinfo import ZoneInfoNotFoundError
 
 sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
-from acr import devices, measure, period, render, rollup, sample, sync, transcripts  # noqa: E402
-from acr import prices as prices_mod  # noqa: E402
+try:
+    from acr import devices, measure, period, render, rollup, sample, sync, transcripts  # noqa: E402
+    from acr import prices as prices_mod  # noqa: E402
+except ZoneInfoNotFoundError:
+    # The plain quoted line runs in cmd, Git Bash (Claude Code's Bash tool on Windows) and POSIX
+    # shells. PowerShell reads a leading quoted string as a value, so it needs the & call operator.
+    install_command = f'"{sys.executable}" -m pip install tzdata'
+    powershell_line = f"\nPowerShell: & {install_command}" if os.name == "nt" else ""
+    sys.exit(
+        "acr.py: IANA timezone data for America/Los_Angeles is unavailable. "
+        "Install tzdata for this Python interpreter, then rerun the command:\n"
+        f"{install_command}{powershell_line}\n"
+        "Or, without installing anything, set PYTHONTZPATH to an existing zoneinfo directory "
+        "(Git for Windows ships one) and rerun."
+    )
 
 USAGE_FILE = "usage.json"
 NOT_YET = ()
```

**File**: `claude-mem-cursor/skills/agent-cost-report/scripts/tests/test_period.py` (modified, +53/-0)
```diff
@@ -1,5 +1,12 @@
+import builtins
 import datetime as dt
+import os
+import re
+import subprocess
+import sys
 import unittest
+from unittest.mock import patch
+from zoneinfo import ZoneInfoNotFoundError
 
 import _paths  # noqa: F401
 from acr import period
@@ -8,6 +15,52 @@
 H = 3600 * 1000
 
 
+class MissingTimezoneData(unittest.TestCase):
+    def test_cli_explains_how_to_install_timezone_data(self):
+        # -S hides site-packages; an empty TZPATH hides OS data, as on stock Windows.
+        env = dict(os.environ, PYTHONTZPATH="")
+        result = subprocess.run(
+            [sys.executable, "-S", _paths.ACR_PY, "--help"],
+            env=env, capture_output=True, text=True, timeout=10,
+        )
+        self.assertEqual(result.returncode, 1)
+        self.assertIn("America/Los_Angeles", result.stderr)
+        self.assertNotIn("Traceback", result.stderr)
+        # The plain quoted line runs in cmd, Git Bash (Claude Code's Bash tool on Windows) and POSIX shells.
+        command = re.search(r'^"(.+)" -m pip install tzdata$', result.stderr, re.MULTILINE)
+        self.assertIsNotNone(command)
+        self.assertTrue(os.path.samefile(command.group(1), sys.executable))
+        # PowerShell needs the call operator, so Windows gets a second line for it.
+        powershell_line = f'PowerShell: & "{command.group(1)}" -m pip install tzdata'
+        self.assertEqual(powershell_line in result.stderr.splitlines(), os.name == "nt")
+        # The zero-install route the #4250 reporter used.
+        self.assertIn("PYTHONTZPATH", result.stderr)
+
+    def test_windows_install_command_handles_spaces_in_interpreter_path(self):
+        with open(_paths.ACR_PY, encoding="utf-8") as script:
+            code = compile(script.read(), _paths.ACR_PY, "exec")
+        real_import = builtins.__import__
+
+        def missing_timezone_import(name, *args, **kwargs):
+            if name == "acr":
+                raise ZoneInfoNotFoundError("America/Los_Angeles")
+            return real_import(name, *args, **kwargs)
+
+        interpreter = r"C:\Program Files\Python\python.exe"
+        # Exercise the CLI's error handler on every host, including its Windows branch.
+        with patch("builtins.__import__", side_effect=missing_timezone_import), \
+                patch("os.name", "nt"), patch("sys.executable", interpreter):
+            with self.assertRaises(SystemExit) as error:
+                exec(code, {"__file__": _paths.ACR_PY, "__name__": "__main__"})
+        lines = str(error.exception).splitlines()
+        plain_line = '"C:\\Program Files\\Python\\python.exe" -m pip install tzdata'
+        # cmd and Git Bash (Claude Code's Bash tool on Windows) run the plain quoted line;
+        # PowerShell needs the & call operator, so it gets a line of its own.
+        self.assertIn(plain_line, lines)
+        self.assertIn("PowerShell: & " + plain_line, lines)
+        self.assertIn("PYTHONTZPATH", lines[-1])
+
+
 class DefaultWindow(unittest.TestCase):
     def test_default_last_7_full_pt_days_fixed_clock(self):
         now = dt.datetime(2026, 9, 25, 16, 42, tzinfo=PT)
```

**File**: `claude-mem-grok-bot/skills/agent-cost-report/CHECKSUMS.txt` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
-e8cd97f07602e3f4b937c814bf98280a7b4e48b38eff269783045f784e58e56e  SKILL.md
-04869e2bde149877bdd8e2aaeb97a334b74e10bd9f38e33352d7ba08fd9b0435  scripts/acr.py
+40b6e0045dbe7343d649bfddc313afc7f11f3ee5b44036ddebc73832635f0a8c  SKILL.md
+355d152df9cb889dc9b81544341e7ac52032016c0106f67aae42176ef8ab5b1e  scripts/acr.py
 bc4fc2a17a1b2bd38422000c907ec07bf1deb1008c7b1bfcf45b2e41364da3e4  scripts/acr/__init__.py
 7b91c59398687b47c7c057d3e1d2da49ff83f081a075e0542e95b2b6f053fc90  scripts/acr/behavior.py
 f72d82461e2c02584bcc3f4d7a05fd18165e5b3d255c0333c7763599daa5adaa  scripts/acr/classify.py
@@ -28,7 +28,7 @@ ccbb9887b02d145359a42cfb3919850d4e4b7b538b9017caa7cc4312a94b85cd  scripts/tests/
 d7610574aec6f45979b4696bfac4d37ffb2ac733b69ccfd2a9a98826d88f60d4  scripts/tests/test_labels.py
 2ac92bb696c5ed13bcae9e88e1d3b8598af38f46a764fc17d146357db3820bda  scripts/tests/test_measure.py
 fb00297709c4ccb0c29d5728508cb060007e1cefb7752f056f84ef2f35bcd439  scripts/tests/test_pdf_windows.py
-2d2c8dad098d8165e11293456777526b35b3caba41c8b7fedaf92365e2b419e1  scripts/tests/test_period.py
+c4b9b88868a3513ae4884ee58e3532695ed0c7a57f7f71e9d19ceb71ac7e9b30  scripts/tests/test_period.py
 77a16deda2df742acb5c5405fb014584d270b686fc3d2e38e5e1d7e25eb3f3a7  scripts/tests/test_prices.py
 a66bdbb07c21a77e7097cace0529bec6d2c1bda050bdec54e192074178ba0c5f  scripts/tests/test_render.py
 0143a3d34b86dd67c0c0af444258625798ebfe71d83494d12b0837245ef350a4  scripts/tests/test_render_encoding.py
```

**File**: `claude-mem-grok-bot/skills/agent-cost-report/SKILL.md` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ allowed-tools:
 
 **Claude-Mem / Claude Code skill.** Runtime is the `scripts/` pipeline (transcripts → tokens → dollars → Timing-style report) plus a progressive Mem Search review pass that confirms the drafted labels. The Notion draft is SPEC history only — never the product, never the runtime, never the ship vehicle.
 
-Resolve the absolute directory containing this `SKILL.md`; all helper paths are relative to that directory. `${CLAUDE_SKILL_DIR}` is the shortcut: `python3 "${CLAUDE_SKILL_DIR}/scripts/acr.py" …`. Python 3.9+ standard library only; no pip installs. The look lives in `scripts/acr/render.py`, never here.
+Resolve the absolute directory containing this `SKILL.md`; all helper paths are relative to that directory. `${CLAUDE_SKILL_DIR}` is the shortcut: `python3 "${CLAUDE_SKILL_DIR}/scripts/acr.py" …`. Python 3.9+ standard library only, with IANA timezone data for `America/Los_Angeles`; no pip installs. `tzdata` is the only exception to the no-pip-installs rule, and only when `acr.py` exits saying that timezone data is unavailable (stock Windows Python ships none): show the user the lines it printed and ask (AskUserQuestion) before installing it. On a yes, run the line for your shell (the plain quoted line in Bash or cmd, the `PowerShell:` line in PowerShell), then rerun the failed command. Setting `PYTHONTZPATH` instead needs no install. The look lives in `scripts/acr/render.py`, never here.
 
 ## Purpose
 
```

**File**: `claude-mem-grok-bot/skills/agent-cost-report/scripts/acr.py` (modified, +16/-2)
```diff
@@ -9,10 +9,24 @@
 import json
 import os
 import sys
+from zoneinfo import ZoneInfoNotFoundError
 
 sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
-from acr import devices, measure, period, render, rollup, sample, sync, transcripts  # noqa: E402
-from acr import prices as prices_mod  # noqa: E402
+try:
+    from acr import devices, measure, period, render, rollup, sample, sync, transcripts  # noqa: E402
+    from acr import prices as prices_mod  # noqa: E402
+except ZoneInfoNotFoundError:
+    # The plain quoted line runs in cmd, Git Bash (Claude Code's Bash tool on Windows) and POSIX
+    # shells. PowerShell reads a leading quoted string as a value, so it needs the & call operator.
+    install_command = f'"{sys.executable}" -m pip install tzdata'
+    powershell_line = f"\nPowerShell: & {install_command}" if os.name == "nt" else ""
+    sys.exit(
+        "acr.py: IANA timezone data for America/Los_Angeles is unavailable. "
+        "Install tzdata for this Python interpreter, then rerun the command:\n"
+        f"{install_command}{powershell_line}\n"
+        "Or, without installing anything, set PYTHONTZPATH to an existing zoneinfo directory "
+        "(Git for Windows ships one) and rerun."
+    )
 
 USAGE_FILE = "usage.json"
 NOT_YET = ()
```

**File**: `claude-mem-grok-bot/skills/agent-cost-report/scripts/tests/test_period.py` (modified, +53/-0)
```diff
@@ -1,5 +1,12 @@
+import builtins
 import datetime as dt
+import os
+import re
+import subprocess
+import sys
 import unittest
+from unittest.mock import patch
+from zoneinfo import ZoneInfoNotFoundError
 
 import _paths  # noqa: F401
 from acr import period
@@ -8,6 +15,52 @@
 H = 3600 * 1000
 
 
+class MissingTimezoneData(unittest.TestCase):
+    def test_cli_explains_how_to_install_timezone_data(self):
+        # -S hides site-packages; an empty TZPATH hides OS data, as on stock Windows.
+        env = dict(os.environ, PYTHONTZPATH="")
+        result = subprocess.run(
+            [sys.executable, "-S", _paths.ACR_PY, "--help"],
+            env=env, capture_output=True, text=True, timeout=10,
+        )
+        self.assertEqual(result.returncode, 1)
+        self.assertIn("America/Los_Angeles", result.stderr)
+        self.assertNotIn("Traceback", result.stderr)
+        # The plain quoted line runs in cmd, Git Bash (Claude Code's Bash tool on Windows) and POSIX shells.
+        command = re.search(r'^"(.+)" -m pip install tzdata$', result.stderr, re.MULTILINE)
+        self.assertIsNotNone(command)
+        self.assertTrue(os.path.samefile(command.group(1), sys.executable))
+        # PowerShell needs the call operator, so Windows gets a second line for it.
+        powershell_line = f'PowerShell: & "{command.group(1)}" -m pip install tzdata'
+        self.assertEqual(powershell_line in result.stderr.splitlines(), os.name == "nt")
+        # The zero-install route the #4250 reporter used.
+        self.assertIn("PYTHONTZPATH", result.stderr)
+
+    def test_windows_install_command_handles_spaces_in_interpreter_path(self):
+        with open(_paths.ACR_PY, encoding="utf-8") as script:
+            code = compile(script.read(), _paths.ACR_PY, "exec")
+        real_import = builtins.__import__
+
+        def missing_timezone_import(name, *args, **kwargs):
+            if name == "acr":
+                raise ZoneInfoNotFoundError("America/Los_Angeles")
+            return real_import(name, *args, **kwargs)
+
+        interpreter = r"C:\Program Files\Python\python.exe"
+        # Exercise the CLI's error handler on every host, including its Windows branch.
+        with patch("builtins.__import__", side_effect=missing_timezone_import), \
+                patch("os.name", "nt"), patch("sys.executable", interpreter):
+            with self.assertRaises(SystemExit) as error:
+                exec(code, {"__file__": _paths.ACR_PY, "__name__": "__main__"})
+        lines = str(error.exception).splitlines()
+        plain_line = '"C:\\Program Files\\Python\\python.exe" -m pip install tzdata'
+        # cmd and Git Bash (Claude Code's Bash tool on Windows) run the plain quoted line;
+        # PowerShell needs the & call operator, so it gets a line of its own.
+        self.assertIn(plain_line, lines)
+        self.assertIn("PowerShell: & " + plain_line, lines)
+        self.assertIn("PYTHONTZPATH", lines[-1])
+
+
 class DefaultWindow(unittest.TestCase):
     def test_default_last_7_full_pt_days_fixed_clock(self):
         now = dt.datetime(2026, 9, 25, 16, 42, tzinfo=PT)
```

---

### Incident Patch 2: `1ebe5fe8` (2026-10-05)
**Commit Message**: fix(smart-read): retain scoped partial Ruby method searches (#4458)

* fix(smart-read): retain scoped partial Ruby method searches

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): constrain scoped Ruby comment matches to their owner

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/smart-file-read/search.ts` (modified, +23/-5)
```diff
@@ -162,21 +162,39 @@ export async function searchCodebase(
         let reason = "";
 
         // Score the symbol's own name, so a class or module query does not match
-        // every method under it. The qualified identity counts only as the whole
-        // query: `Counter#reset` has no character that queryParts splits on.
-        const nameScore = matchScore(sym.name.toLowerCase(), queryParts)
+        // every method under it. Qualified Ruby queries retain their owner and
+        // method separator, including a partial method name.
+        const separator = qualifiedName.includes('#')
+          ? qualifiedName.lastIndexOf('#') : qualifiedName.lastIndexOf('.');
+        const ownerPrefix = qualifiedName.slice(0, separator + 1).toLowerCase();
+        // A partial Ruby method query must name its complete owner and method
+        // separator; a class-only query still must not pull in every method.
+        const qualifiedRubyScore = parsed.language === 'ruby' && sym.kind === 'method'
+          && separator >= 0 && queryLower.startsWith(ownerPrefix)
+          && queryLower.length > ownerPrefix.length
+          ? matchScore(qualifiedName.toLowerCase(), [queryLower]) : 0;
+        const rubyQualifiedQuery = parsed.language === 'ruby' && /[#.]/.test(queryLower);
+        const ownNameScore = rubyQualifiedQuery
+          ? (sym.kind === 'method' ? qualifiedRubyScore
+            : matchScore(qualifiedName.toLowerCase(), [queryLower]))
+          : matchScore(sym.name.toLowerCase(), queryParts);
+        const nameScore = ownNameScore
           || (qualifiedName.toLowerCase() === queryLower ? 10 : 0);
         if (nameScore > 0) {
           score += nameScore * 3;
           reason = "name match";
         }
 
-        if (sym.signature.toLowerCase().includes(queryLower)) {
+        // Explicit Ruby ownership is a constraint, including when a comment
+        // or signature mentions a different owner. Unqualified text searches
+        // continue to search both fields.
+        const eligibleForTextMatch = !rubyQualifiedQuery || ownNameScore > 0;
+        if (eligibleForTextMatch && sym.signature.toLowerCase().includes(queryLower)) {
           score += 2;
           reason = reason ? `${reason} + signature` : "signature match";
         }
 
-        if (sym.jsdoc && sym.jsdoc.toLowerCase().includes(queryLower)) {
+        if (eligibleForTextMatch && sym.jsdoc && sym.jsdoc.toLowerCase().includes(queryLower)) {
           score += 1;
           reason = reason ? `${reason} + jsdoc` : "jsdoc match";
         }
```

**File**: `tests/services/smart-file-read/ruby-singleton-methods.test.ts` (modified, +43/-0)
```diff
@@ -108,3 +108,46 @@ test('a class opened inside class << self keeps its own instance methods', async
     expect(unfoldSymbol(source, 'counter.rb', 'Counter.Builder#run')).toContain(':run');
   } finally { rmSync(dir, { recursive: true, force: true }); }
 }, 120000);
+
+test('partial qualified Ruby queries retain their exact owner and method kind', async () => {
+  const source = 'class Counter\n  def reset\n    :instance\n  end\n  def self.reset\n    :singleton\n  end\nend\nclass Other\n  def reset\n    :other\n  end\nend';
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-ruby-qualified-prefix-'));
+  try {
+    writeFileSync(join(dir, 'owned.rb'), source);
+    for (const [query, expected] of [['Counter#res', 'Counter#reset'], ['Counter.res', 'Counter.reset']]) {
+      const result = await searchCodebase(dir, query);
+      expect(result.matchingSymbols.map(symbol => symbol.symbolName)).toEqual([expected]);
+      expect(unfoldSymbol(source, 'owned.rb', expected)).toContain(expected.includes('#') ? ':instance' : ':singleton');
+    }
+    expect((await searchCodebase(dir, 'Counter')).matchingSymbols.map(symbol => symbol.symbolName)).toEqual(['Counter']);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
+
+
+test('qualified Ruby queries cannot be admitted by unrelated reference comments', async () => {
+  const source = `class Counter
+  # Reset the instance.
+  def reset
+    :instance
+  end
+  # Reset the singleton.
+  def self.reset
+    :singleton
+  end
+end
+class Other
+  # See Counter#res and Counter.res for related APIs.
+  def unrelated
+    :other
+  end
+end`;
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-ruby-comment-owner-'));
+  try {
+    writeFileSync(join(dir, 'owned.rb'), source);
+    for (const [query, expected] of [['Counter#res', 'Counter#reset'], ['Counter.res', 'Counter.reset']]) {
+      expect((await searchCodebase(dir, query)).matchingSymbols.map(symbol => symbol.symbolName)).toEqual([expected]);
+    }
+    // Ordinary text searches still discover the reference comment.
+    expect((await searchCodebase(dir, 'related APIs')).matchingSymbols.map(symbol => symbol.symbolName)).toContain('Other#unrelated');
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
```

---

### Incident Patch 3: `1bb64393` (2026-10-05)
**Commit Message**: fix(viewer): keep pagination requests owned by their feed visit (#4454)

* fix(viewer): keep pagination requests owned by their feed visit

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(viewer): advance feed visit ownership only after commit

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/ui/viewer/App.tsx` (modified, +18/-9)
```diff
@@ -1,4 +1,4 @@
-import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
+import React, { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
 import { Header } from './components/Header';
 import { Feed } from './components/Feed';
 import { ViewTabs, type ViewTab } from './components/ViewTabs';
@@ -65,8 +65,14 @@ export function App() {
   const [feedScope, setFeedScope] = useState<FeedScope>(
     () => scopeForRoute(route, currentFilter) ?? { project: currentFilter, session: null }
   );
-  const activeFeedScopeRef = useRef(feedScopeKey(feedScope));
-  activeFeedScopeRef.current = feedScopeKey(feedScope);
+  const scopeKey = feedScopeKey(feedScope);
+  const activeFeedScopeRef = useRef({ key: scopeKey, version: 0 });
+  const feedVisit = activeFeedScopeRef.current.key === scopeKey
+    ? activeFeedScopeRef.current
+    : { key: scopeKey, version: activeFeedScopeRef.current.version + 1 };
+  // Only a committed scope retires the previous visit's rows and errors.
+  useLayoutEffect(() => { activeFeedScopeRef.current = feedVisit; }, [feedVisit]);
+  const feedVersion = feedVisit.version;
 
   const catalog = useSessionCatalog();
   const { observations, summaries, prompts, projects, isProcessing, queueDepth, removeLiveItem, removeLiveSession } = useSSE({
@@ -143,29 +149,32 @@ export function App() {
   }, []);
 
   const handleLoadMore = useCallback(async () => {
-    const requestFeedScope = feedScopeKey(feedScope);
+    // A second visit to the same scope has a new owner, even if its key matches.
+    if (activeFeedScopeRef.current.version !== feedVersion) return;
+    const requestFeedVersion = feedVersion;
+    const isCurrentVisit = () => activeFeedScopeRef.current.version === requestFeedVersion;
     setFeedLoadError(null);
     try {
       // Each cursor advances independently; commit its rows before a sibling
       // request can reject the group, or successful pages would be skipped.
       await Promise.all([
         pagination.observations.loadMore().then(rows => {
-          if (rows.length) setPaginatedObservations(prev => [...prev, ...rows]);
+          if (isCurrentVisit() && rows.length) setPaginatedObservations(prev => [...prev, ...rows]);
         }),
         pagination.summaries.loadMore().then(rows => {
-          if (rows.length) setPaginatedSummaries(prev => [...prev, ...rows]);
+          if (isCurrentVisit() && rows.length) setPaginatedSummaries(prev => [...prev, ...rows]);
         }),
         pagination.prompts.loadMore().then(rows => {
-          if (rows.length) setPaginatedPrompts(prev => [...prev, ...rows]);
+          if (isCurrentVisit() && rows.length) setPaginatedPrompts(prev => [...prev, ...rows]);
         })
       ]);
     } catch (error) {
       console.error('Failed to load more data:', error);
-      if (activeFeedScopeRef.current === requestFeedScope) {
+      if (isCurrentVisit()) {
         setFeedLoadError(error instanceof Error ? error.message : 'Failed to load more data');
       }
     }
-  }, [feedScope, pagination.observations, pagination.summaries, pagination.prompts]);
+  }, [feedVersion, pagination.observations, pagination.summaries, pagination.prompts]);
 
   // One removal path for a deleted row, whether this tab deleted it or another
   // tab did (item_deleted SSE, which also reaches this tab): drop it from the
```

**File**: `src/ui/viewer/hooks/usePagination.ts` (modified, +19/-12)
```diff
@@ -1,4 +1,4 @@
-import { useState, useCallback, useRef } from 'react';
+import { useState, useCallback, useRef, useLayoutEffect } from 'react';
 import { Observation, Summary, UserPrompt } from '../types';
 import { UI } from '../constants/ui';
 import { API_ENDPOINTS } from '../constants/api';
@@ -25,22 +25,31 @@ function usePaginationFor<TItem extends DataItem>(
 
   const selectionKey = `${currentFilter}|${currentSession ? sessionKey(currentSession) : ''}`;
   const offsetRef = useRef(0);
-  const lastSelectionKeyRef = useRef(selectionKey);
+  const selectionRef = useRef({ key: selectionKey, version: 0 });
+  // Concurrent renders may be abandoned. Derive their prospective visit
+  // without retiring the committed visit's callbacks or pending requests.
+  const selection = selectionRef.current.key === selectionKey
+    ? selectionRef.current
+    : { key: selectionKey, version: selectionRef.current.version + 1 };
+  useLayoutEffect(() => { selectionRef.current = selection; }, [selection]);
+  const selectionVersion = selection.version;
+  const lastLoadedVersionRef = useRef(selectionVersion);
   const stateRef = useRef(state);
 
   const loadMore = useCallback(async (): Promise<TItem[]> => {
-    const filterChanged = lastSelectionKeyRef.current !== selectionKey;
+    if (selectionRef.current.version !== selectionVersion) return [];
+    const selectionChanged = lastLoadedVersionRef.current !== selectionVersion;
 
-    if (filterChanged) {
+    if (selectionChanged) {
       offsetRef.current = 0;
-      lastSelectionKeyRef.current = selectionKey;
+      lastLoadedVersionRef.current = selectionVersion;
 
       const newState = { isLoading: false, hasMore: true };
       setState(newState);
       stateRef.current = newState;
     }
 
-    if (!filterChanged && (stateRef.current.isLoading || !stateRef.current.hasMore)) {
+    if (!selectionChanged && (stateRef.current.isLoading || !stateRef.current.hasMore)) {
       return [];
     }
 
@@ -62,11 +71,9 @@ function usePaginationFor<TItem extends DataItem>(
       params.append('platformSource', currentSession.platformSource);
     }
 
-    // A response that lands after the selection changed (another session or
-    // project opened mid-request) belongs to the old selection: the cursor and
-    // state now serve the new one, so drop it instead of advancing them.
-    const requestSelectionKey = selectionKey;
-    const isStale = () => lastSelectionKeyRef.current !== requestSelectionKey;
+    // Each visit owns its cursor and loading state. Returning to the same
+    // project or session must not revive requests from its previous visit.
+    const isStale = () => selectionRef.current.version !== selectionVersion;
 
     try {
       const response = await fetch(`${endpoint}?${params}`);
@@ -105,7 +112,7 @@ function usePaginationFor<TItem extends DataItem>(
     }
     // selectionKey covers currentFilter and currentSession.
     // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [selectionKey, endpoint, dataType]);
+  }, [selectionKey, selectionVersion, endpoint, dataType]);
 
   // Rows from a loaded page were deleted: the server's list moved up by that
   // many, so the next page starts that much earlier or it would skip rows.
```

**File**: `tests/ui/viewer/pagination-commit.browser.test.ts` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+import { expect, it } from 'bun:test';
+import { execFileSync } from 'node:child_process';
+import { createRequire } from 'node:module';
+import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join, resolve } from 'node:path';
+import { UI } from '../../../src/ui/viewer/constants/ui';
+
+const chrome = Bun.which('google-chrome') ?? Bun.which('chromium')
+  ?? (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
+    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null);
+if (process.env.CI && !chrome) throw new Error('CI requires Chrome or Chromium for committed feed regressions.');
+
+for (const consumer of ['hook', 'app']) {
+  for (const outcome of ['success', 'failure']) {
+    (chrome ? it : it.skip)(`keeps committed A ${consumer} pagination after an abandoned B render and ${outcome}`, async () => {
+      const root = resolve(import.meta.dir, '../../..');
+      const esbuildBinary = createRequire(import.meta.url).resolve(
+        `@esbuild/${process.platform}-${process.arch}/${process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild'}`,
+      );
+      const ownedSource = mkdtempSync(join(import.meta.dir, '.commit-scope-'));
+      let bundle: string;
+      try {
+        // App synchronizes feedScope internally in a passive effect. To isolate
+        // render/commit ownership, this fixture-only copy supplies that one
+        // scope through a parent prop. Its refs, pagination, callbacks and UI
+        // remain production code; no product test API or hook mock is added.
+        let app = readFileSync(join(root, 'src/ui/viewer/App.tsx'), 'utf8');
+        const declaration = 'export function App() {';
+        const stateDeclaration = 'const [feedScope, setFeedScope] = useState<FeedScope>(';
+        const scopeUse = '  const scopeKey = feedScopeKey(feedScope);';
+        for (const marker of [declaration, stateDeclaration, scopeUse]) {
+          if (!app.includes(marker)) throw new Error('App scope fixture requires its explicit declaration: ' + marker);
+        }
+        app = app.replace(declaration, 'export function App({ ownedScope }: { ownedScope: FeedScope }) {')
+          .replace(stateDeclaration, 'const [storedFeedScope, setFeedScope] = useState<FeedScope>(')
+          .replace(scopeUse, '  const feedScope = ownedScope;\n' + scopeUse)
+          .replace(/from '(\.[^']+)'/g, (_, path: string) => 'from ' + JSON.stringify(resolve(root, 'src/ui/viewer', path)));
+        const appPath = join(ownedSource, 'App.tsx');
+        writeFileSync(appPath, app);
+        bundle = execFileSync(esbuildBinary, [
+          '--bundle', '--loader=tsx', '--platform=browser', '--format=iife',
+          '--define:process.env.NODE_ENV="production"', '--log-level=error',
+        ], { cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, input: `
+          import React, { Suspense, startTransition, useEffect, useState } from 'react';
+          import { createRoot } from 'react-dom/client';
+          import { App } from ${JSON.stringify(appPath)};
+          import { usePagination } from './src/ui/viewer/hooks/usePagination';
+          import { setStoredWelcomeDismissed } from './src/ui/viewer/components/WelcomeCard';
+          setStoredWelcomeDismissed(true);
+          const originalFetch = window.fetch.bind(window);
+          let pendingReading = false, pendingSettled = false;
+          window.fetch = async (...args) => {
+            const response = await originalFetch(...args);
+            if (response.headers.get('X-Owned-Pending') === 'A') {
+              const read = response.json.bind(response);
+              response.json = async () => { pendingReading = true; try { return await read(); } finally { pendingSettled = true; } };
+            }
+            return response;
+          };
+          const never = new Promise(() => {});
+          function Gate({ scope }) {
+            if (scope.project === 'B') { window.ownedBRendered = true; throw never; }
+            return null;
+          }
+          function HookFeed({ scope }) {
+            const pagination = usePagination(scope.project);
+            const [rows, setRows] = useState([]);
+            const [error, setError] = useState(null);
+            async function load() {
+              setError(null);
+              try {
+                const page = await pagination.observations.loadMore();
+                setRows(previous => [...previous, ...page]);
+              } catch (error) { setError(String(error)); }
+            }
+            useEffect(() => { setRows([]); void load(); }, [scope.project]);
+            return <div>
+              {rows.map(row => <p key={row.id}>{row.title}</p>)}
+              {pagination.observations.isLoading && <p>Loading more...</p>}
+              {error && <div role="alert">{error}<button disabled={pagination.observation
```

**File**: `tests/ui/viewer/pagination-visit.browser.test.ts` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+import { expect, it } from 'bun:test';
+import { execFileSync } from 'node:child_process';
+import { createRequire } from 'node:module';
+import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join, resolve } from 'node:path';
+import { UI } from '../../../src/ui/viewer/constants/ui';
+
+const chrome = Bun.which('google-chrome') ?? Bun.which('chromium')
+  ?? (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
+    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null);
+if (process.env.CI && !chrome) throw new Error('CI requires Chrome or Chromium for feed visit regressions.');
+
+for (const scope of ['project', 'session']) {
+  for (const staleOutcome of ['success', 'failure']) {
+    (chrome ? it : it.skip)(`ignores an earlier ${scope} visit ${staleOutcome} after A to B to A`, async () => {
+      const esbuildBinary = createRequire(import.meta.url).resolve(
+        `@esbuild/${process.platform}-${process.arch}/${process.platform === 'win32' ? 'esbuild.exe' : 'bin/esbuild'}`,
+      );
+      // No shared esbuild service remains alive while the browser runs.
+      const bundle = execFileSync(esbuildBinary, [
+        '--bundle', '--loader=tsx', '--platform=browser', '--format=iife',
+        '--define:process.env.NODE_ENV="production"', '--log-level=error',
+      ], { cwd: resolve(import.meta.dir, '../../..'), encoding: 'utf8', timeout: 20000, maxBuffer: 8 * 1024 * 1024, input: `
+        import React from 'react';
+        import { createRoot } from 'react-dom/client';
+        import { App } from './src/ui/viewer/App';
+        import { setStoredWelcomeDismissed } from './src/ui/viewer/components/WelcomeCard';
+        setStoredWelcomeDismissed(true);
+        const originalFetch = window.fetch.bind(window);
+        let oldReading = 0, oldSettled = 0;
+        window.fetch = async (...args) => {
+          const response = await originalFetch(...args);
+          if (response.headers.get('X-Owned-Visit') === 'old') {
+            const read = response.json.bind(response);
+            response.json = async () => {
+              oldReading++;
+              try { return await read(); } finally { oldSettled++; }
+            };
+          }
+          return response;
+        };
+        createRoot(document.getElementById('root')).render(<App />);
+        async function until(predicate, stage = 'unknown') {
+          const deadline = Date.now() + 8000;
+          while (!predicate()) {
+            if (Date.now() > deadline) throw new Error('Owned browser condition did not settle: ' + stage + ' body=' + document.body.textContent.slice(-500));
+            await new Promise(resolve => setTimeout(resolve, 10));
+          }
+        }
+        async function paint() { for (let i=0; i<4; i++) await new Promise(requestAnimationFrame); }
+        function select(value) {
+          if (${JSON.stringify(scope)} === 'session') location.hash = '#/sessions/claude/' + value;
+          else {
+            const select = document.querySelector('.header select');
+            select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
+          }
+        }
+        (async () => {
+          try {
+            await originalFetch('/ready');
+            await until(() => [...document.querySelectorAll('.header select option')].some(o => o.value === 'A'), 'projects');
+            select('A');
+            await originalFetch('/await-old');
+            await until(() => oldReading === 3, 'old bodies started');
+            select('B');
+            await until(() => ['OBSERVATION', 'SUMMARY', 'PROMPT'].every(type => document.body.textContent.includes('B_CURRENT_' + type)), 'B feed');
+            select('A');
+            await until(() => document.body.textContent.includes('A_CURRENT_OBSERVATION')
+              && document.body.textContent.includes('A_CURRENT_SUMMARY')
+              && document.body.textContent.includes('A_CURRENT_PROMPT'), 'A current feed');
+            await paint();
+            await originalFetch('/release-old', { method: 'POST' });
+            await until(() => oldSettled === 3, 'old requests'); await paint();
+            const report = {
+              staleRows: document.body.textContent.includes('A_OLD_'),
+              staleAlert: !!document.querySelector('[role="alert"]'),
+              currentRows: ['OBSERVATION', 'SUMMARY', 'PROMPT'].every(type => document.body.textContent.includes('A_CURRENT_' + type)),
+              continued: false,
+            };
+            const deadline = Date.now() + 2500;
+            while (!document.body.textContent.includes('A_NEXT_PAGE') && Date.now() < deadline) {
+              document.querySelector('.feed-content')?.lastElementChild?.scrollIntoView({ block: 'end' });
+              await new Promise(resolve => setTimeout(resolve, 20));
+            }
+            report.continued = documen
```

---

### Incident Patch 4: `3b3baaa5` (2026-10-05)
**Commit Message**: fix(smart-read): include Ruby singleton methods (#4436)

* fix(smart-read): include Ruby singleton methods

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): distinguish Ruby singleton receivers

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-search): retain explicit Ruby receiver identity

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): qualify Ruby instance and singleton methods distinctly

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-search): match canonical Ruby method identities

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-search): score symbols by their own names

Ruby search scored the owner-qualified name, so a class or module query matched every method under it: `Counter` returned `Counter#increment` and `Counter.reset`, and `Admin` every method in the module. Those ties fill max_results in walk order and each pulls its file's folded view into the agent's context.

Score the symbol's own name for every language, as before, and count the qualified identity only when it is the whole query, so `Counter#reset` still finds exactly that method.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Clau

**File**: `src/services/smart-file-read/parser.ts` (modified, +51/-32)
```diff
@@ -191,6 +191,8 @@ const QUERIES: Record<string, string> = {
 
   ruby: `
 (method name: (identifier) @name) @func
+(singleton_method object: (_) @receiver name: (identifier) @name) @method
+(singleton_class value: (self)) @singleton_scope
 (class name: (constant) @name) @cls
 (module name: (constant) @name) @cls
 (call method: (identifier) @name) @imp
@@ -672,10 +674,33 @@ function isExported(
   }
 }
 
+// Tree-sitter columns are UTF-8 byte offsets, not JS string indices, and the
+// CLI prints no `text` for a capture that spans rows. Cutting the last row at
+// its end column before the first row at its start column keeps a one-row
+// capture free of offset arithmetic.
+function captureLines(lines: string[], capture: RawCapture): string[] {
+  const captured = lines.slice(capture.startRow, capture.endRow + 1);
+  if (captured.length === 0) return [];
+  const last = captured.length - 1;
+  captured[last] = Buffer.from(captured[last] ?? "").subarray(0, capture.endCol).toString();
+  captured[0] = Buffer.from(captured[0] ?? "").subarray(capture.startCol).toString();
+  return captured;
+}
+
+// Tree-sitter ranges include columns: row-only comparisons lose methods
+// on the opening line and cannot distinguish adjacent one-line declarations.
+function rangeContains(outer: RawCapture, inner: RawCapture): boolean {
+  return (inner.startRow > outer.startRow
+      || (inner.startRow === outer.startRow && inner.startCol >= outer.startCol))
+    && (inner.endRow < outer.endRow
+      || (inner.endRow === outer.endRow && inner.endCol <= outer.endCol));
+}
+
 function buildSymbols(matches: RawMatch[], lines: string[], language: string): { symbols: CodeSymbol[]; imports: string[] } {
   const symbols: CodeSymbol[] = [];
   const imports: string[] = [];
   const exportRanges: Array<{ startRow: number; endRow: number }> = [];
+  const singletonScopes: RawCapture[] = [];
   const ranges = new Map<CodeSymbol, RawCapture>();
   const aliasedTypes = new Map<CodeSymbol, RawCapture>();
   const containers: Array<{ sym: CodeSymbol; range: RawCapture }> = [];
@@ -685,20 +710,16 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
       if (cap.tag === "exp") {
         exportRanges.push({ startRow: cap.startRow, endRow: cap.endRow });
       }
+      if (cap.tag === "singleton_scope") {
+        singletonScopes.push(cap);
+      }
       if (cap.tag === "imp") {
-        const capturedLines = lines.slice(cap.startRow, cap.endRow + 1);
-        // Tree-sitter columns are UTF-8 byte offsets, not JS string indices.
-        // A multiline capture is not repeated as `text` in CLI query output.
-        capturedLines[0] = Buffer.from(capturedLines[0] ?? "").subarray(cap.startCol).toString();
-        const last = capturedLines.length - 1;
-        const endCol = cap.endCol - (last === 0 ? cap.startCol : 0);
-        capturedLines[last] = Buffer.from(capturedLines[last]).subarray(0, endCol).toString();
         // Outlines go straight into an agent's context, so each entry is one
         // line capped at the 200-char signature budget: a Go `import ( … )`
         // group, a Ruby call with a `do … end` block or an SCSS `@include { … }`
         // is one capture that can span a whole file. Keep both ends, because an
         // import's module source comes last.
-        const importText = capturedLines.map(line => line.trim()).filter(Boolean).join(" ");
+        const importText = captureLines(lines, cap).map(line => line.trim()).filter(Boolean).join(" ");
         imports.push(importText.length > 200
           ? `${importText.slice(0, 140)} … ${importText.slice(-55)}`
           : importText);
@@ -739,27 +760,18 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
     let name = nameCapture?.text || "anonymous";
     if (kindCapture.tag === "ctor") {
       const parameters = match.captures.find(c => c.tag === "parameters");
-      if (parameters) {
-        const parameterLines = lines.slice(parameters.startRow, parameters.endRow + 1);
-        parameterLines[0] = Buffer.from(parameterLines[0] ?? "").subarray(parameters.startCol).toString();
-        const last = parameterLines.length - 1;
-        parameterLines[last] = Buffer.from(parameterLines[last]).subarray(0,
-          parameters.endCol - (last === 0 ? parameters.startCol : 0)).toString();
-        name += parameterLines.join(" ").replace(/\s+/g, " ").trim();
-      }
+      if (parameters) name += captureLines(lines, parameters).join(" ").replace(/\s+/g, " ").trim();
     }
+    const receiver = match.captures.find(c => c.tag === "receiver");
+    const receiverText = receiver && captureLines(lines, receiver).join(" ").trim();
+    if (receiverText) name = `${receiverText}.${name}`;
 
     let signature: string;
     if (language === "markdown" && kind === "section") {
       // Setext heading paragraphs include a trailing newline (and can span
       // lines), so the CLI prints only their range, wi
```

**File**: `src/services/smart-file-read/search.ts` (modified, +8/-3)
```diff
@@ -157,10 +157,15 @@ export async function searchCodebase(
 
     const checkSymbols = (symbols: typeof parsed.symbols, parent?: string) => {
       for (const sym of symbols) {
+        const qualifiedName = qualifySymbolName(sym.name, parent, parsed.language, sym.kind);
         let score = 0;
         let reason = "";
 
-        const nameScore = matchScore(sym.name.toLowerCase(), queryParts);
+        // Score the symbol's own name, so a class or module query does not match
+        // every method under it. The qualified identity counts only as the whole
+        // query: `Counter#reset` has no character that queryParts splits on.
+        const nameScore = matchScore(sym.name.toLowerCase(), queryParts)
+          || (qualifiedName.toLowerCase() === queryLower ? 10 : 0);
         if (nameScore > 0) {
           score += nameScore * 3;
           reason = "name match";
@@ -180,7 +185,7 @@ export async function searchCodebase(
           fileHasMatch = true;
           fileSymbolMatches.push({
             filePath: relPath,
-            symbolName: qualifySymbolName(sym.name, parent, parsed.language),
+            symbolName: qualifiedName,
             kind: sym.kind,
             signature: sym.signature,
             jsdoc: sym.jsdoc,
@@ -191,7 +196,7 @@ export async function searchCodebase(
         }
 
         if (sym.children) {
-          checkSymbols(sym.children, qualifySymbolName(sym.name, parent, parsed.language));
+          checkSymbols(sym.children, qualifiedName);
         }
       }
     };
```

**File**: `tests/services/smart-file-read/ruby-singleton-methods.test.ts` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+import { describe, expect } from 'bun:test';
+import { nativeTest as test } from './native-prerequisite.js';
+import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { parseFile, unfoldSymbol } from '../../../src/services/smart-file-read/parser.js';
+import { searchCodebase } from '../../../src/services/smart-file-read/search.js';
+
+const SOURCE = 'class Counter\n  def self.reset\n    :reset\n  end\n  def increment\n    1\n  end\nend';
+
+describe('Ruby singleton method outlines', () => {
+  test('captures class methods beside ordinary instance methods', () => {
+    const parsed = parseFile(SOURCE, 'counter.rb');
+    expect(parsed.symbols.map(symbol => symbol.name)).toEqual(['Counter']);
+    expect(parsed.symbols[0].children?.map(symbol => symbol.name)).toEqual(['self.reset', 'increment']);
+    expect(parsed.symbols[0].children?.map(symbol => symbol.kind)).toEqual(['method', 'method']);
+    expect(unfoldSymbol(SOURCE, 'counter.rb', 'self.reset')).toContain('def self.reset\n    :reset\n  end');
+  }, 120000);
+
+  test('captures a method defined on an explicit receiver outside a class', () => {
+    const source = 'def Counter.reset\n  :reset\nend';
+    expect(parseFile(source, 'receiver.rb').symbols.map(symbol => symbol.name)).toEqual(['Counter.reset']);
+    expect(unfoldSymbol(source, 'receiver.rb', 'Counter.reset')).toContain(source);
+  }, 120000);
+
+  test('native batched search discovers the class method', async () => {
+    const dir = mkdtempSync(join(tmpdir(), 'claude-mem-ruby-singleton-'));
+    try {
+      writeFileSync(join(dir, 'counter.rb'), SOURCE);
+      const result = await searchCodebase(dir, 'reset');
+      expect(result.matchingSymbols.map(symbol => symbol.symbolName)).toContain('Counter.reset');
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }, 120000);
+});
+
+test('distinguishes the same-named instance and singleton method', async () => {
+  const source = 'class Counter\n  def reset\n    :instance\n  end\n  def self.reset\n    :singleton\n  end\nend';
+  const parsed = parseFile(source, 'owned.rb');
+  expect(parsed.symbols[0].children?.map(symbol => symbol.name)).toEqual(['reset', 'self.reset']);
+  expect(unfoldSymbol(source, 'owned.rb', 'reset')).toContain(':instance');
+  expect(unfoldSymbol(source, 'owned.rb', 'self.reset')).toContain(':singleton');
+  expect(unfoldSymbol(source, 'owned.rb', 'self.reset')).not.toContain(':instance');
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-ruby-identities-'));
+  try {
+    writeFileSync(join(dir, 'owned.rb'), source);
+    const result = await searchCodebase(dir, 'reset');
+    expect(result.matchingSymbols.map(symbol => symbol.symbolName)).toEqual(['Counter#reset', 'Counter.reset']);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
+
+test('explicit receivers inside a class retain their actual receiver identity', async () => {
+  const source = 'class Counter\n  def Counter.reset\n    :explicit\n  end\n  def Other.reset\n    :other\n  end\nend';
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-ruby-explicit-owner-'));
+  try {
+    writeFileSync(join(dir, 'owned.rb'), source);
+    const result = await searchCodebase(dir, 'reset');
+    expect(result.matchingSymbols.map(symbol => symbol.symbolName).sort()).toEqual(['Counter.reset', 'Other.reset']);
+    expect(unfoldSymbol(source, 'owned.rb', 'Counter.reset')).toContain(':explicit');
+    expect(unfoldSymbol(source, 'owned.rb', 'Other.reset')).toContain(':other');
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
+
+test('search identities round trip same-named instance and explicit singleton methods', async () => {
+  const source = 'class Counter\n  def reset\n    :instance\n  end\n  def Counter.reset\n    :explicit_singleton\n  end\nend';
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-ruby-instance-singleton-'));
+  try {
+    writeFileSync(join(dir, 'owned.rb'), source);
+    const result = await searchCodebase(dir, 'reset');
+    expect(result.matchingSymbols.map(symbol => symbol.symbolName)).toEqual(['Counter#reset', 'Counter.reset']);
+    for (const match of result.matchingSymbols) {
+      const unfolded = unfoldSymbol(source, 'owned.rb', match.symbolName);
+      const instance = match.lineStart === 1;
+      expect(unfolded).toContain(instance ? ':instance' : ':explicit_singleton');
+      expect(unfolded).not.toContain(instance ? ':explicit_singleton' : ':instance');
+    }
+    expect(unfoldSymbol(source, 'owned.rb', 'reset')).toContain(':instance');
+    expect((await searchCodebase(dir, 'Counter#reset')).matchingSymbols.map(symbol => symbol.symbolName)).toEqual(['Counter#reset']);
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
+
+test('a class name query matches the class, not every method under it', async () => {
+  const dir = mkdtemp
```

---

### Incident Patch 5: `3724ced8` (2026-10-05)
**Commit Message**: fix(context): resolve prior transcripts by observed host session ID (#4433)

* fix(context): resolve prior transcripts by observed host session ID

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(context): carry host identity and cwd through context routes

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(context): bound indexed newest-row queries for adopted projects

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(context): exclude the active host in live and cached transcripts

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(context): keep session-specific transcript renders out of cache

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(context): warm transcript-free memory for worker outage fallback

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(context): drop the prior reply before it can push SessionStart past 10K

"Include last message" prints the prior session's whole final reply,
and the budget fitter never gave it up: a reply over about 9K characters
left the block above 10,000 after every other reduction, so Claude Code
replaced the entire SessionStart context with its ~2KB preview stub
(#3802). Before this PR the section never rendere

**File**: `src/cli/handlers/context.ts` (modified, +25/-6)
```diff
@@ -107,7 +107,11 @@ export const contextHandler: EventHandler = {
     const platformSourceParam = input.platform && settings.CLAUDE_MEM_SESSION_START_INCLUDE_ALL_SOURCES !== 'true'
       ? `&platformSource=${encodeURIComponent(normalizedPlatformSource!)}`
       : '';
-    const apiPath = `/api/context/inject?projects=${encodeURIComponent(projectsParam)}${platformSourceParam}`;
+    // "Include last message" picks the prior session's reply by excluding this
+    // one, so the worker gets the session id and SessionStart is answered live.
+    const showLastMessage = settings.CLAUDE_MEM_CONTEXT_SHOW_LAST_MESSAGE === 'true';
+    const sessionParam = showLastMessage && input.sessionId ? `&sessionId=${encodeURIComponent(input.sessionId)}` : '';
+    const apiPath = `/api/context/inject?projects=${encodeURIComponent(projectsParam)}${platformSourceParam}&cwd=${encodeURIComponent(cwd)}${sessionParam}`;
     const colorApiPath = input.platform === 'claude-code' ? `${apiPath}&colors=true` : apiPath;
 
     // Server runtime reads the shared server (plan-24 step 4). When the server
@@ -133,10 +137,12 @@ export const contextHandler: EventHandler = {
     // Precomputed SessionStart context (liveness plan, Phase 6): the worker
     // keeps each variant it has served rendered on disk, keyed exactly like
     // the URLs above. A hit needs no worker at all; a miss takes the live path.
+    // A cached block never carries the prior reply, so with "Include last
+    // message" on it is read only when the worker cannot answer.
     const cacheNowEpochMs = Date.now();
     const readCachedRender = (colors: boolean): string | null => {
       if (serverRuntime) return null;
-      const keys = contextCacheKeys(context.allProjects, platformSourceParam ? normalizedPlatformSource : undefined, colors);
+      const keys = contextCacheKeys(context.allProjects, platformSourceParam ? normalizedPlatformSource : undefined, colors, cwd);
       const cached = readContextCache(keys, cacheNowEpochMs);
       if (!cached) return null;
       logger.debug('HOOK', 'SessionStart context served from the context cache', {
@@ -145,16 +151,24 @@ export const contextHandler: EventHandler = {
       });
       return fillContextPlaceholders(cached.body, cacheNowEpochMs, cached.placeholderNonce);
     };
-    const cachedModelContext = readCachedRender(false);
+    const cachedModelContext = showLastMessage ? null : readCachedRender(false);
 
     // ponytail: Codex's MCP normally starts the worker; this one bounded
     // fallback covers cold sessions without the old startup process chain.
     const workerOptions = input.platform === 'codex'
       ? { workerStartupTimeoutMs: HOOK_TIMEOUTS.POST_SPAWN_WAIT, timeoutMs: 2_000 }
       : undefined;
-    const contextResult = serverRender
+    let workerOutageNotice: string | null = null;
+    let contextResult = serverRender
       ? serverRender.model
       : cachedModelContext ?? await executeWithWorkerFallback<string>(apiPath, 'GET', undefined, workerOptions);
+    if (showLastMessage && isWorkerFallback(contextResult)) {
+      const cachedFallback = readCachedRender(false);
+      if (cachedFallback !== null) {
+        contextResult = cachedFallback;
+        workerOutageNotice = await consumeWorkerOutageNotice(input.sessionId);
+      }
+    }
     if (isWorkerFallback(contextResult)) {
       // SessionStart context is synchronous, so a systemMessage here is shown
       // to the user: the once-per-session worker-outage notice, if any.
@@ -221,12 +235,15 @@ export const contextHandler: EventHandler = {
 
     let coloredTimeline = '';
     if (showTerminalOutput) {
+      const colors = input.platform === 'claude-code';
       const colorResult = serverRender
         ? serverRender.terminal
-        : readCachedRender(input.platform === 'claude-code')
+        : (showLastMessage ? null : readCachedRender(colors))
           ?? await executeWithWorkerFallback<string>(colorApiPath, 'GET', undefined, workerOptions);
       if (!isWorkerFallback(colorResult) && typeof colorResult === 'string') {
         coloredTimeline = colorResult.trim();
+      } else if (showLastMessage && isWorkerFallback(colorResult)) {
+        coloredTimeline = readCachedRender(colors)?.trim() ?? '';
       }
     }
 
@@ -260,7 +277,9 @@ export const contextHandler: EventHandler = {
         hookEventName: 'SessionStart',
         additionalContext
       },
-      systemMessage
+      systemMessage: workerOutageNotice
+        ? [workerOutageNotice, systemMessage].filter(Boolean).join('\n\n')
+        : systemMessage
     };
   }
 };
```

**File**: `src/server/routes/v1/ServerV1PostgresRoutes.ts` (modified, +2/-0)
```diff
@@ -2038,6 +2038,7 @@ function serializeObservation(observation: {
   projectId: string;
   teamId: string;
   serverSessionId: string | null;
+  contentSessionId?: string | null;
   kind: string;
   content: string;
   metadata: Record<string, unknown>;
@@ -2049,6 +2050,7 @@ function serializeObservation(observation: {
     projectId: observation.projectId,
     teamId: observation.teamId,
     serverSessionId: observation.serverSessionId,
+    ...(observation.contentSessionId !== undefined ? { contentSessionId: observation.contentSessionId } : {}),
     kind: observation.kind,
     content: observation.content,
     metadata: observation.metadata,
```

**File**: `src/services/context/ContextBudget.ts` (modified, +9/-3)
```diff
@@ -37,9 +37,12 @@ export interface ContextBudgetResult {
  *
  * Full observation narratives go first: they are the largest per-item cost and
  * their titles remain in the timeline either way. The last-session summary
- * block goes next, being a single 1-5K item. Only then do we start losing
- * timeline entries, sessions before observations, because an observation is
- * the smaller unit and the one the timeline is mostly made of.
+ * block goes next, being a single 1-5K item, then the prior session's final
+ * reply ("Include last message"), a single item with no size bound at all:
+ * kept to the end, a long one leaves the block over the limit after every
+ * other reduction. Only then do we start losing timeline entries, sessions
+ * before observations, because an observation is the smaller unit and the one
+ * the timeline is mostly made of.
  */
 function reduceConfig(config: ContextConfig, observationCount: number): { config: ContextConfig; observationCount: number } | null {
   if (config.fullObservationCount > 0) {
@@ -48,6 +51,9 @@ function reduceConfig(config: ContextConfig, observationCount: number): { config
   if (config.showLastSummary) {
     return { config: { ...config, showLastSummary: false }, observationCount };
   }
+  if (config.showLastMessage) {
+    return { config: { ...config, showLastMessage: false }, observationCount };
+  }
   if (config.sessionCount > 0) {
     return { config: { ...config, sessionCount: Math.floor(config.sessionCount / 2) }, observationCount };
   }
```

**File**: `src/services/context/ContextBuilder.ts` (modified, +5/-4)
```diff
@@ -426,11 +426,12 @@ interface ContextScope {
 
 function resolveContextScope(input: ContextInput | undefined): ContextScope {
   const config = loadContextConfig();
+  if (input?.includePriorMessage === false) config.showLastMessage = false;
   const cwd = input?.cwd ?? process.cwd();
-  const context = getProjectContext(cwd);
-
-  const projects = input?.projects?.length ? input.projects : context.allProjects;
-  const project = projects[projects.length - 1] ?? context.primary;
+  // Callers that name the projects (the worker route, the server-runtime hook)
+  // need no lookup, and resolving a real cwd runs git on every render.
+  const projects = input?.projects?.length ? input.projects : getProjectContext(cwd).allProjects;
+  const project = projects[projects.length - 1];
 
   if (input?.full) {
     config.totalObservationCount = 999999;
```

**File**: `src/services/context/ObservationCompiler.ts` (modified, +28/-2)
```diff
@@ -24,6 +24,7 @@ type DatabaseOwner = { db: Database };
 const OBSERVATION_SELECT = `
       o.id,
       o.memory_session_id,
+      s.content_session_id,
       COALESCE(s.platform_source, 'claude') as platform_source,
       o.type,
       o.title,
@@ -46,6 +47,16 @@ const OBSERVATION_SELECT = `
 // indexes, and keep the newest `limit` ids of the union.
 const PROJECT_KEY_COLUMNS = ['project', 'merged_into_project'] as const;
 
+// SQLite accepts at most 500 terms in a compound SELECT. Each key contributes
+// one term per project column, so bound batches before applying the global cap.
+const PROJECT_KEYS_PER_QUERY = 250;
+
+function newestUniqueRows<T extends { id: number; created_at_epoch: number }>(batches: T[][], limit: number): T[] {
+  const rows = new Map<number, T>();
+  for (const batch of batches) for (const row of batch) rows.set(row.id, row);
+  return [...rows.values()].sort((a, b) => b.created_at_epoch - a.created_at_epoch).slice(0, limit);
+}
+
 function newestIdsPerProjectKeySql(
   alias: string,
   projectCount: number,
@@ -115,6 +126,13 @@ export function queryObservationsNewest(
   const conceptArray = Array.from(config.observationConcepts);
   const conceptPlaceholders = conceptArray.map(() => '?').join(',');
   const projects = (options.projects ?? []).filter(project => project.trim().length > 0);
+  if (projects.length > PROJECT_KEYS_PER_QUERY) {
+    const batches: LocalObservation[][] = [];
+    for (let offset = 0; offset < projects.length; offset += PROJECT_KEYS_PER_QUERY) {
+      batches.push(queryObservationsNewest(db, config, { ...options, projects: projects.slice(offset, offset + PROJECT_KEYS_PER_QUERY) }));
+    }
+    return newestUniqueRows(batches, options.limit);
+  }
 
   const manualClause = options.includeManualSaves
     ? `substr(o.memory_session_id, 1, 7) = 'manual-' OR`
@@ -198,6 +216,13 @@ export function querySummariesMulti(
 ): LocalSessionSummary[] {
   if (projects.length === 0) return [];
   const limit = config.sessionCount + SUMMARY_LOOKAHEAD;
+  if (projects.length > PROJECT_KEYS_PER_QUERY) {
+    const batches: LocalSessionSummary[][] = [];
+    for (let offset = 0; offset < projects.length; offset += PROJECT_KEYS_PER_QUERY) {
+      batches.push(querySummariesMulti(db, projects.slice(offset, offset + PROJECT_KEYS_PER_QUERY), config, platformSource));
+    }
+    return newestUniqueRows(batches, limit);
+  }
   const platformParams = [platformSource ?? null, platformSource ?? null];
 
   const winnersSql = newestIdsPerProjectKeySql('ss', projects.length, keyPredicate => `
@@ -300,12 +325,13 @@ export function getPriorSessionMessages(
     return { assistantMessage: '' };
   }
 
-  const priorSessionObs = observations.find(obs => obs.memory_session_id !== currentSessionId);
+  const priorSessionObs = observations.find(obs =>
+    obs.memory_session_id !== currentSessionId && obs.content_session_id !== currentSessionId);
   if (!priorSessionObs) {
     return { assistantMessage: '' };
   }
 
-  const priorSessionId = priorSessionObs.memory_session_id;
+  const priorSessionId = priorSessionObs.content_session_id ?? priorSessionObs.memory_session_id;
   const dashedCwd = cwdToDashed(cwd);
   const transcriptPath = path.join(CLAUDE_CONFIG_DIR, 'projects', dashedCwd, `${priorSessionId}.jsonl`);
   return extractPriorMessages(transcriptPath);
```

**File**: `src/services/context/ServerContextRows.ts` (modified, +1/-0)
```diff
@@ -146,6 +146,7 @@ export function toLocalObservationShape(
   return {
     id: asText(row.id) ?? '',
     memory_session_id: asText(pick(row, 'serverSessionId', 'memory_session_id')) ?? '',
+    content_session_id: asText(pick(row, 'contentSessionId', 'content_session_id')) ?? undefined,
     platform_source: platformSource ?? '',
     type: asText(pick(row, 'kind', 'type')) ?? 'discovery',
     title: asText(pick(row, 'title')) ?? firstLine,
```

**File**: `src/services/context/types.ts` (modified, +7/-0)
```diff
@@ -16,6 +16,11 @@ export interface ContextInput {
    * itself must opt out (#4221).
    */
   includeHealthWarning?: boolean;
+  /**
+   * False renders without the prior session's reply whatever the setting says:
+   * for a block that may be cached, which any session can read.
+   */
+  includePriorMessage?: boolean;
   /**
    * Characters delivered beside this block (the work-state section), taken off
    * the 10K delivery limit so the combined output still fits it.
@@ -66,6 +71,8 @@ export interface Observation {
   // A numeric SQLite id, or the server's string id in server runtime.
   id: number | string;
   memory_session_id: string;
+  /** Observed host session identity, used to resolve its transcript. */
+  content_session_id?: string | null;
   platform_source?: string;
   type: string;
   title: string | null;
```

**File**: `src/services/worker/ContextCacheService.ts` (modified, +26/-2)
```diff
@@ -11,6 +11,12 @@
  * banner's own durations and expiry are time-dependent, so its file is removed
  * and the hook takes the live path until the banner clears.
  *
+ * No cached block carries the prior session's reply ("Include last message"):
+ * that reply is chosen by excluding the session that asks, and any session may
+ * read a cached block. With the setting on, the live route answers with the
+ * reply and only warms the variant (warmVariant); the hook falls back on the
+ * cached block, rendered without it, while the worker is down.
+ *
  * A 'removal' invalidation (delete, merge, import, pulled tombstone or remap)
  * removes the matched files synchronously, before the writer's emit returns,
  * so the hook never serves deleted memory while the re-render is pending. A
@@ -27,6 +33,7 @@ import { existsSync, readFileSync, unlinkSync } from 'fs';
 import { join } from 'path';
 import {
   contextCacheDir,
+  readContextCache,
   contextCacheVariantId,
   listContextCacheFiles,
   removeContextCache,
@@ -45,7 +52,7 @@ const CONTEXT_CACHE_INDEX_FILENAME = 'variants.json';
 export interface ContextVariantRender {
   /** The block with its time placeholders, exactly as the live route fills and sends it. */
   body: string;
-  /** False when the block must not be served from disk (health banner showing). */
+  /** False when the block must stay live (health banner, or a reply chosen for the asking session). */
   cacheable: boolean;
 }
 
@@ -154,6 +161,22 @@ export class ContextCacheService {
     this.persistRender(keys, render, renderedAtEpochMs);
   }
 
+  /**
+   * The live route answered `keys` with a block it must not persist (it carries
+   * the asking session's prior reply). Learn the variant anyway and, when no
+   * fresh file is on disk, render its cached block (which has no reply) through
+   * the render queue, so the hook has it to fall back on while the worker is down.
+   */
+  warmVariant(keys: ContextCacheKeys): void {
+    const variantId = contextCacheVariantId(keys);
+    if (!this.variants.has(variantId)) {
+      this.recordLiveRender(keys, { body: '', cacheable: false }, this.now());
+    }
+    if (readContextCache(keys, this.now())) return;
+    this.pendingVariantIds.add(variantId);
+    this.scheduleRender();
+  }
+
   /** Pass to recordLiveRender to discard a render that a removal overtook. */
   removalGenerationNow(): number {
     return this.removalGeneration;
@@ -343,7 +366,8 @@ export class ContextCacheService {
       return {
         variants: variants.filter(entry =>
           entry && Array.isArray(entry.keys?.projects) && typeof entry.keys.platformSource === 'string'
-          && typeof entry.keys.colors === 'boolean' && typeof entry.learnedAtEpochMs === 'number'),
+          && typeof entry.keys.colors === 'boolean' && typeof entry.learnedAtEpochMs === 'number'
+          && (entry.keys.cwd === undefined || typeof entry.keys.cwd === 'string')),
       };
     } catch (error) {
       // Variants are re-learned from the next live requests; orphaned files are removed in start().
```

---

### Incident Patch 6: `5e6a5e06` (2026-10-05)
**Commit Message**: fix(sync): forward revised remote rows to the semantic index (#4432)

* fix(sync): forward revised remote rows to the semantic index

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(sync): reconcile fragments and order remote Chroma revisions

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(sync): retain fragment retries for invalid Chroma lookups

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(sync): forward revisions with the documents backfill indexes

The revision forward built its Chroma documents with text and
merged_into_project hard-coded to null and platform_source to claude,
and parsed list columns more strictly than backfill does. A revision now
deletes every fragment its new documents lack. So a revised row that
backfill had indexed lost its obs_<id>_text fragment, a plain-string
facts column (#3423) lost its obs_<id>_fact_0 fragment, and a Codex row
was rescoped to claude.

Pass the stored text and merged_into_project, and the session's
platform, into syncObservation/syncSummary. Parse list columns with
backfill's own parsers; parseStringListField moves to its own module so
SyncApply can share it. The insert forward gets the same parity.

Co-Authored

**File**: `src/services/sync/ChromaSync.ts` (modified, +60/-40)
```diff
@@ -1,6 +1,7 @@
 
 import { ChromaMcpManager } from './ChromaMcpManager.js';
 import { ChromaSyncState, ProjectWatermarks } from './ChromaSyncState.js';
+import { parseStringListField } from './string-list-field.js';
 import { ParsedObservation, ParsedSummary } from '../../sdk/parser.js';
 // cmem-sdk: keep SessionStore + parseFileList off the SDK's import graph.
 // Both come from the SQLite layer (`bun:sqlite`). The SDK never calls the
@@ -132,39 +133,6 @@ interface StoredUserPrompt {
   platform_source: string;
 }
 
-function parseStringListField(
-  rawValue: string | null | undefined,
-  fieldName: 'facts' | 'concepts',
-  rowId: number,
-): string[] {
-  if (!rawValue) {
-    return [];
-  }
-
-  try {
-    const parsed = JSON.parse(rawValue);
-    if (!Array.isArray(parsed)) {
-      logger.warn('CHROMA_SYNC', 'Expected JSON array in observation list field, using plain string fallback', {
-        fieldName,
-        rowId,
-        parsedType: typeof parsed,
-      });
-      if (typeof parsed === 'string') {
-        return parsed.trim() ? [parsed] : [];
-      }
-      return rawValue.trim() ? [rawValue] : [];
-    }
-    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
-  } catch (error) {
-    logger.warn('CHROMA_SYNC', 'Malformed observation list field, using plain string fallback', {
-      fieldName,
-      rowId,
-      errorName: error instanceof Error ? error.name : 'NonError',
-    });
-    return rawValue.trim() ? [rawValue] : [];
-  }
-}
-
 /**
  * Whether the worker has begun shutting down: local Chroma then refuses every
  * mutation (see {@link ChromaMcpManager.acceptsMutations}).
@@ -862,22 +830,49 @@ export class ChromaSync {
     return written;
   }
 
+  /** Remove only disappeared fragments; surviving deterministic IDs update in place. */
+  private async removeObsoleteFragments(docType: string, sqliteId: number, documents: ChromaDocument[]): Promise<void> {
+    await this.ensureCollectionExists();
+    const manager = ChromaMcpManager.getInstance();
+    const existing = await manager.callTool('chroma_get_documents', {
+      collection_name: this.collectionName,
+      where: { $and: [{ doc_type: docType }, { sqlite_id: sqliteId }] },
+      include: [],
+    });
+    // MCP transport success can still decode to null (empty/non-JSON content).
+    // Only a valid ID list proves which fragments exist; failures must leave
+    // the durable reconciliation flag set for the next backfill.
+    if (!existing || typeof existing !== 'object' || !('ids' in existing)
+      || !Array.isArray(existing.ids)
+      || !existing.ids.every(id => typeof id === 'string' && id.length > 0)) {
+      throw new Error('Chroma fragment lookup did not return a valid document ID list');
+    }
+    const currentIds = new Set(documents.map(doc => doc.id));
+    const obsolete = (existing.ids as string[]).filter(id => !currentIds.has(id));
+    for (let i = 0; i < obsolete.length; i += this.BATCH_SIZE) {
+      await manager.callTool('chroma_delete_documents', { collection_name: this.collectionName, ids: obsolete.slice(i, i + this.BATCH_SIZE) });
+    }
+  }
+
   async syncObservation(
     observationId: number,
     memorySessionId: string,
     project: string,
-    obs: ParsedObservation,
+    obs: ParsedObservation & { text?: string | null; merged_into_project?: string | null },
     promptNumber: number,
     createdAtEpoch: number,
-    platformSource?: string
+    platformSource?: string,
+    replaceExisting = false
   ): Promise<void> {
     const stored: StoredObservation = {
       id: observationId,
       memory_session_id: memorySessionId,
       project: project,
-      merged_into_project: null,
+      // New local observations have neither; a replicated row passes its
+      // stored values so these documents match what backfill writes.
+      merged_into_project: obs.merged_into_project ?? null,
       platform_source: platformSource ? normalizePlatformSource(platformSource) : normalizePlatformSource(undefined),
-      text: null, // Legacy field, not used
+      text: obs.text ?? null,
       type: obs.type,
       title: obs.title,
       subtitle: obs.subtitle,
@@ -903,6 +898,11 @@ export class ChromaSync {
     // Chroma error must NOT mark this observation as synced — otherwise the
     // backfill pass on next boot will skip past it (CodeRabbit review on PR
     // #2282).
+    if (replaceExisting) ChromaSyncState.markFragmentReconciliation(project, 'observations', observationId);
+    if (ChromaSyncState.needsFragmentReconciliation(project, 'observations', observationId)) {
+      await this.removeObsoleteFragments('observation', observationId, documents);
+      ChromaSyncState.clearFragmentReconciliation(project, 'observations', observationId);
+    }
     const written = await this.addDocuments(documents);
     if (written === documents.length) {
       ChromaSyncState.clearPending(project, 'observations', [observati
```

**File**: `src/services/sync/ChromaSyncState.ts` (modified, +33/-0)
```diff
@@ -13,6 +13,8 @@ export interface ProjectWatermarks {
   summaries: number;
   prompts: number;
   pending?: PendingIdsByKind;
+  /** Rows whose remote revision must remove obsolete document fragments. */
+  fragmentReconciliation?: PendingIdsByKind;
   /**
    * Set once this project's title-only observations, which older versions
    * skipped while advancing the watermark, have been requeued (#4069).
@@ -64,6 +66,13 @@ function normalizeProjectWatermarks(marks: Partial<ProjectWatermarks> | undefine
     normalized.pending = pending;
   }
 
+  if (marks?.fragmentReconciliation) {
+    normalized.fragmentReconciliation = {
+      observations: normalizePendingIds(marks.fragmentReconciliation.observations),
+      summaries: normalizePendingIds(marks.fragmentReconciliation.summaries),
+    };
+  }
+
   if (marks?.titleOnlyRequeued === true) {
     normalized.titleOnlyRequeued = true;
   }
@@ -227,6 +236,30 @@ export const ChromaSyncState = {
     persist();
   },
 
+  markFragmentReconciliation(project: string, kind: DocKind, id: number): void {
+    const all = load();
+    const current = normalizeProjectWatermarks(all[project] ?? ZERO);
+    current.pending = current.pending ?? {};
+    current.pending[kind] = normalizePendingIds([...(current.pending[kind] ?? []), id]);
+    current.fragmentReconciliation = current.fragmentReconciliation ?? {};
+    current.fragmentReconciliation[kind] = normalizePendingIds([...(current.fragmentReconciliation[kind] ?? []), id]);
+    all[project] = current;
+    persist();
+  },
+
+  needsFragmentReconciliation(project: string, kind: DocKind, id: number): boolean {
+    return this.get(project).fragmentReconciliation?.[kind]?.includes(id) ?? false;
+  },
+
+  clearFragmentReconciliation(project: string, kind: DocKind, id: number): void {
+    const all = load();
+    const current = normalizeProjectWatermarks(all[project] ?? ZERO);
+    if (!current.fragmentReconciliation?.[kind]?.includes(id)) return;
+    current.fragmentReconciliation[kind] = current.fragmentReconciliation[kind]!.filter(value => value !== id);
+    all[project] = current;
+    persist();
+  },
+
   clearPending(project: string, kind: DocKind, ids: number[]): void {
     const normalizedIds = normalizePendingIds(ids);
     if (normalizedIds.length === 0) return;
```

**File**: `src/services/sync/SyncApply.ts` (modified, +86/-32)
```diff
@@ -139,7 +139,7 @@
 // SessionSearch.ts:76-152; user_prompts: SessionStore.ts:867-895) index them
 // automatically. There is no FTS-external write path in this module.
 //
-// CHROMA: newly inserted rows are forwarded to Chroma AFTER commit,
+// CHROMA: inserted and revised rows are forwarded to Chroma AFTER commit,
 // fire-and-forget (.then().catch() — the ResponseProcessor.ts pattern).
 // The ChromaSyncLike instance is injected; Phase 3's SyncClient wires
 // DatabaseManager.getChromaSync() here. Omitting it skips Chroma (the boot
@@ -164,11 +164,13 @@ import { emitContextInvalidation } from '../../shared/context-invalidation.js';
 import type { Database } from 'bun:sqlite';
 import { logger } from '../../utils/logger.js';
 import { DEFAULT_PLATFORM_SOURCE, normalizePlatformSource } from '../../shared/platform-source.js';
+import { parseFileList } from '../sqlite/observations/files.js';
 import {
   assertCanonicalDecimal,
   compareCanonicalDecimals,
   incrementCanonicalDecimal,
 } from './CanonicalContent.js';
+import { parseStringListField } from './string-list-field.js';
 
 /**
  * A hub change this client could not decode. It keeps its seq so the page
@@ -218,10 +220,13 @@ export interface ChromaSyncLike {
       concepts: string[];
       files_read: string[];
       files_modified: string[];
+      text?: string | null;
+      merged_into_project?: string | null;
     },
     promptNumber: number,
     createdAtEpoch: number,
-    platformSource?: string
+    platformSource?: string,
+    replaceExisting?: boolean
   ): Promise<void>;
   syncSummary(
     summaryId: number,
@@ -234,10 +239,12 @@ export interface ChromaSyncLike {
       completed: string | null;
       next_steps: string | null;
       notes: string | null;
+      merged_into_project?: string | null;
     },
     promptNumber: number,
     createdAtEpoch: number,
-    platformSource?: string
+    platformSource?: string,
+    replaceExisting?: boolean
   ): Promise<void>;
   syncUserPrompt(
     promptId: number,
@@ -342,22 +349,12 @@ function fieldNumber(op: SyncOp, obj: Record<string, unknown>, key: string): num
   throw invalidOp(op, `field ${key} must be a finite number, got ${typeof v}`);
 }
 
-/** Parse a JSON-string list column for Chroma; never throws. */
-function parseListColumn(v: unknown): string[] {
-  if (typeof v !== 'string') return [];
-  try {
-    const parsed = JSON.parse(v);
-    return Array.isArray(parsed) ? parsed.map(String) : [];
-  } catch {
-    return [];
-  }
-}
-
 export class SyncApply {
   private readonly db: Database;
   private readonly deviceId: string;
   private readonly chromaSync: ChromaSyncLike | null;
   private readonly now: () => number;
+  private readonly chromaWrites = new Map<string, Promise<void>>();
 
   constructor(db: Database, options: SyncApplyOptions) {
     if (!options.deviceId) {
@@ -606,6 +603,16 @@ export class SyncApply {
     return result;
   }
 
+  /** Preserve hub order per row while unrelated rows can still forward concurrently. */
+  private enqueueChromaWrite(key: string, write: () => Promise<void>): Promise<void> {
+    const previous = this.chromaWrites.get(key) ?? Promise.resolve();
+    const next = previous.catch(() => {}).then(write);
+    this.chromaWrites.set(key, next);
+    const clear = () => { if (this.chromaWrites.get(key) === next) this.chromaWrites.delete(key); };
+    void next.then(clear, clear);
+    return next;
+  }
+
   /**
    * Run one op in a savepoint. An op that can never apply here is rolled
    * back alone (its writes and queued Chroma jobs) and returned as
@@ -940,6 +947,7 @@ export class SyncApply {
         createdAt, createdAtEpoch, op.rev, this.now(),
         existing.id
       );
+      this.forwardObservation(existing.id, op, body, chromaJobs, true);
       return 'applied';
     }
 
@@ -974,28 +982,55 @@ export class SyncApply {
       return 'stale';
     }
 
+    this.forwardObservation(inserted.id, op, body, chromaJobs);
+    return 'applied';
+  }
+
+  /**
+   * The platform backfill attributes to rows of this memory session: it
+   * joins sdk_sessions on memory_session_id and defaults to claude. Forwards
+   * use the same value so a revision keeps the row's platform scope.
+   */
+  private sessionPlatformSource(memorySessionId: string): string | undefined {
+    const session = this.db.prepare(
+      'SELECT platform_source FROM sdk_sessions WHERE memory_session_id = ?'
+    ).get(memorySessionId) as { platform_source: string | null } | undefined;
+    return session?.platform_source ?? undefined;
+  }
+
+  // Forwards hand Chroma the committed row's stored values, parsed as backfill
+  // parses them. A revision deletes every fragment the new documents lack, so
+  // any difference from backfill's documents would delete indexed content.
+  private forwardObservation(id: number, op: SyncOp, body: Record<string, unknown>, chromaJobs: ChromaJob[], replaceExisting = false): void {
+    const memorySessionId = fieldSt
```

**File**: `src/services/sync/string-list-field.ts` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+import { logger } from '../../utils/logger.js';
+
+/**
+ * Parse a stored observation `facts` or `concepts` column into the list
+ * Chroma indexes. Columns outside the JSON-array contract (#3423: CJK text
+ * stored as a plain string) become one entry instead of being dropped.
+ * Backfill and the replica forward both parse through here, so a revised row
+ * gets the same fragments backfill indexed.
+ */
+export function parseStringListField(
+  rawValue: string | null | undefined,
+  fieldName: 'facts' | 'concepts',
+  rowId: number,
+): string[] {
+  if (!rawValue) {
+    return [];
+  }
+
+  try {
+    const parsed = JSON.parse(rawValue);
+    if (!Array.isArray(parsed)) {
+      logger.warn('CHROMA_SYNC', 'Expected JSON array in observation list field, using plain string fallback', {
+        fieldName,
+        rowId,
+        parsedType: typeof parsed,
+      });
+      if (typeof parsed === 'string') {
+        return parsed.trim() ? [parsed] : [];
+      }
+      return rawValue.trim() ? [rawValue] : [];
+    }
+    return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
+  } catch (error) {
+    logger.warn('CHROMA_SYNC', 'Malformed observation list field, using plain string fallback', {
+      fieldName,
+      rowId,
+      errorName: error instanceof Error ? error.name : 'NonError',
+    });
+    return rawValue.trim() ? [rawValue] : [];
+  }
+}
```

**File**: `tests/worker/sync/sync-revision-chroma.test.ts` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+import { describe, expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+
+// Keep persisted Chroma watermarks and module-level paths inside a child-owned
+// fixture. The external document writer is captured; SQLite apply and Chroma's
+// live row-to-document formatting are the production implementations.
+const fixture = String.raw`
+  import { SessionStore } from './src/services/sqlite/SessionStore.ts';
+  import { SyncApply } from './src/services/sync/SyncApply.ts';
+  import { ChromaSync } from './src/services/sync/ChromaSync.ts';
+  import { ChromaMcpManager } from './src/services/sync/ChromaMcpManager.ts';
+  const store = new SessionStore(':memory:');
+  const chroma = new ChromaSync('revision-fixture');
+  chroma.ensureCollectionExists = async () => {};
+  ChromaMcpManager.getInstance().callTool = async () => ({ ids: [] });
+  const writes = [];
+  chroma.addDocuments = async documents => {
+    writes.push(documents);
+    return documents.length;
+  };
+  const apply = new SyncApply(store.db, { deviceId: 'local-fixture', chromaSync: chroma });
+  const kind = process.env.REVISION_KIND;
+  const now = Date.now();
+  const common = { memory_session_id: 'remote-memory', project: 'project', prompt_number: 1, created_at_epoch: now };
+  const body = kind === 'observation'
+    ? { ...common, type: 'discovery', title: 'Original title', narrative: 'Original narrative', facts: '[]', concepts: '[]', files_read: '[]', files_modified: '[]' }
+    : kind === 'summary'
+      ? { ...common, request: 'Original request', learned: 'Original learning' }
+      : { ...common, content_session_id: 'remote-host', prompt_text: 'Original prompt', platform_source: 'claude' };
+  const makeOp = (seq, rev, body) => ({ seq: String(seq), rev: String(rev), kind, origin_device: 'remote-device', origin_id: '10', body: JSON.stringify(body), server_ts: now });
+  apply.applyOps([makeOp(1, 1, body)]);
+  await new Promise(resolve => setImmediate(resolve));
+  const updated = { ...body, title: 'Revised title', narrative: 'Revised narrative', request: 'Revised request', learned: 'Revised learning', prompt_text: 'Revised prompt' };
+  apply.applyOps([makeOp(2, 2, updated)]);
+  await new Promise(resolve => setImmediate(resolve));
+  const table = kind === 'observation' ? 'observations' : kind === 'summary' ? 'session_summaries' : 'user_prompts';
+  const row = store.db.prepare('SELECT * FROM ' + table).get();
+  const cursor = apply.getCursor();
+  apply.applyOps([makeOp(3, 1, body)]);
+  await new Promise(resolve => setImmediate(resolve));
+  console.log(JSON.stringify({ writes, row, cursor, finalCursor: apply.getCursor() }));
+  store.close();
+`;
+
+describe('pulled row revisions reach Chroma', () => {
+  for (const kind of ['observation', 'summary', 'prompt']) {
+    it(`forwards the revised ${kind} content and keeps stale revisions inert`, () => {
+      const dir = mkdtempSync(join(tmpdir(), 'sync-revision-chroma-'));
+      try {
+        const run = Bun.spawnSync([process.execPath, '-e', fixture], {
+          cwd: join(import.meta.dir, '../../..'),
+          env: { ...process.env, CLAUDE_MEM_DATA_DIR: join(dir, 'data'), CLAUDE_CONFIG_DIR: join(dir, 'config'), REVISION_KIND: kind },
+          stdout: 'pipe', stderr: 'pipe',
+        });
+        if (run.exitCode !== 0) throw new Error(new TextDecoder().decode(run.stderr));
+        const result = JSON.parse(new TextDecoder().decode(run.stdout).trim().split('\n').at(-1)!);
+        expect(result.cursor).toBe('2');
+        expect(result.finalCursor).toBe('3');
+        expect(result.row.sync_rev).toBe('2');
+        expect(result.row.synced_at).not.toBeNull();
+        expect(result.writes).toHaveLength(2);
+        const documents = result.writes[1].map((doc: { document: string }) => doc.document).join('\n');
+        expect(documents).toContain(kind === 'observation' ? 'Revised narrative' : kind === 'summary' ? 'Revised request' : 'Revised prompt');
+        expect(documents).not.toContain('Original');
+        expect(result.writes[1][0].metadata.sqlite_id).toBe(result.row.id);
+      } finally { rmSync(dir, { recursive: true, force: true }); }
+    });
+  }
+});
```

**File**: `tests/worker/sync/sync-revision-lookup-response.test.ts` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+import { describe, expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+
+// Substitute only the external MCP client's response. Production MCP parsing,
+// SQLite apply, document reconciliation and smart backfill run in the child.
+const fixture = String.raw`
+  import { SessionStore } from './src/services/sqlite/SessionStore.ts';
+  import { SyncApply } from './src/services/sync/SyncApply.ts';
+  import { ChromaSync } from './src/services/sync/ChromaSync.ts';
+  import { ChromaSyncState } from './src/services/sync/ChromaSyncState.ts';
+  import { ChromaMcpManager } from './src/services/sync/ChromaMcpManager.ts';
+  const store = new SessionStore(':memory:');
+  const chroma = new ChromaSync('lookup-response-fixture');
+  const docs = new Map(), deleted = [];
+  const manager = ChromaMcpManager.getInstance();
+  manager.ensureConnected = async () => {}; // no external process or live collection
+  let response = 'valid';
+  const json = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
+  manager.client = { callTool: async ({ name: tool, arguments: args }) => {
+    if (tool === 'chroma_create_collection') return json({});
+    if (tool === 'chroma_get_documents') {
+      if (args.where && response !== 'valid') {
+        if (response === 'empty-content') return { content: [] };
+        if (response === 'non-json') return { content: [{ type: 'text', text: 'temporary lookup failure' }] };
+        if (response === 'missing-ids') return json({});
+        if (response === 'null-ids') return json({ ids: null });
+        if (response === 'object-ids') return json({ ids: {} });
+        if (response === 'numeric-ids') return json({ ids: [42] });
+        if (response === 'nested-ids') return json({ ids: [['obs_1_narrative']] });
+        if (response === 'tool-error') return { isError: true, content: [{ type: 'text', text: 'owned lookup error' }] };
+      }
+      const ids = args.ids ?? [...docs.keys()].filter(id => args.where.$and.every(condition => Object.entries(condition).every(([key, value]) => docs.get(id).metadata[key] === value)));
+      return json({ ids: ids.filter(id => docs.has(id)) });
+    }
+    if (tool === 'chroma_delete_documents') {
+      for (const id of args.ids) { docs.delete(id); deleted.push(id); }
+      return json({});
+    }
+    if (tool === 'chroma_add_documents' || tool === 'chroma_update_documents') {
+      if (tool === 'chroma_add_documents' && args.ids.some(id => docs.has(id))) return { isError: true, content: [{ type: 'text', text: 'IDs already exist' }] };
+      args.ids.forEach((id, index) => {
+        if (tool === 'chroma_add_documents' || docs.has(id)) docs.set(id, { document: args.documents[index], metadata: args.metadatas[index] });
+      });
+      return json({});
+    }
+    throw new Error('Unexpected tool ' + tool);
+  } };
+  const apply = new SyncApply(store.db, { deviceId: 'owned-local', chromaSync: chroma });
+  const now = Date.now(), kind = process.env.REVISION_KIND;
+  const common = { memory_session_id: 'remote-memory', project: 'project', prompt_number: 1, created_at_epoch: now };
+  const body = kind === 'observation' ? { ...common, type: 'discovery', title: null, narrative: 'Old removed body', facts: '[]', concepts: '[]', files_read: '[]', files_modified: '[]' }
+    : { ...common, request: 'Old removed body', completed: 'Old removed completion' };
+  const op = (rev, body) => ({ seq: String(rev), rev: String(rev), kind, origin_device: 'owned-remote', origin_id: '10', body: JSON.stringify(body), server_ts: now });
+  const tick = () => new Promise(resolve => setImmediate(resolve));
+  const settle = async () => { for (let i = 0; i < 20; i++) await tick(); };
+  apply.applyOps([op(1, body)]); await settle();
+  if (process.env.LOOKUP_RESPONSE === 'valid-empty') docs.clear();
+  response = process.env.LOOKUP_RESPONSE === 'valid-empty' ? 'valid' : process.env.LOOKUP_RESPONSE;
+  apply.applyOps([op(2, { ...body, narrative: null, request: null, completed: null })]); await settle();
+  const table = kind === 'observation' ? 'observations' : 'session_summaries';
+  const row = store.db.prepare('SELECT * FROM ' + table).get();
+  const stateKind = kind === 'observation' ? 'observations' : 'summaries';
+  ChromaSyncState.resetCacheForTests();
+  const pendingBefore = ChromaSyncState.getPending('project', stateKind);
+  const reconciliationBefore = ChromaSyncState.needsFragmentReconciliation('project', stateKind, row.id);
+  const failedBackfill = await chroma.ensureBackfilled('project', store);
+  const retainedAfterFailure = ChromaSyncState.needsFragmentReconciliation('project', stateKind, row.id);
+  response = 'valid';
+  const recovered = await chroma.ensureBackfilled('project', store);
+  console.log(JSON.stringify({ row, pendingBefore, reconciliationBefore, failedBackfill, retainedAfterFailure, recovered, docs: 
```

**File**: `tests/worker/sync/sync-revision-reconcile.test.ts` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+import { describe, expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+
+// The captured external MCP contract keeps a stateful document collection.
+// SQLite apply, row formatters, conflict reconciliation and backfill are real.
+const fixture = String.raw`
+  import { SessionStore } from './src/services/sqlite/SessionStore.ts';
+  import { SyncApply } from './src/services/sync/SyncApply.ts';
+  import { ChromaSync } from './src/services/sync/ChromaSync.ts';
+  import { ChromaSyncState } from './src/services/sync/ChromaSyncState.ts';
+  import { ChromaMcpManager } from './src/services/sync/ChromaMcpManager.ts';
+  const store = new SessionStore(':memory:');
+  const chroma = new ChromaSync('revision-reconcile-fixture');
+  const docs = new Map(), deleted = [], calls = [];
+  let release, started = false, failDelete = false;
+  const blocked = new Promise(resolve => release = resolve);
+  const kind = process.env.REVISION_KIND, mode = process.env.REVISION_MODE;
+  ChromaMcpManager.getInstance().callTool = async (tool, args) => {
+    calls.push(tool);
+    if (tool === 'chroma_create_collection') return {};
+    if (tool === 'chroma_get_documents') {
+      const ids = args.ids ?? [...docs.keys()].filter(id => args.where.$and.every(condition => Object.entries(condition).every(([key, value]) => docs.get(id).metadata[key] === value)));
+      return { ids: ids.filter(id => docs.has(id)) };
+    }
+    if (tool === 'chroma_delete_documents') {
+      if (failDelete) { failDelete = false; throw new Error('owned deletion failure'); }
+      for (const id of args.ids) { docs.delete(id); deleted.push(id); }
+      return {};
+    }
+    if (tool === 'chroma_add_documents' || tool === 'chroma_update_documents') {
+      if (mode === 'order' && !started) { started = true; await blocked; }
+      if (tool === 'chroma_add_documents' && args.ids.some(id => docs.has(id))) throw new Error('IDs already exist');
+      args.ids.forEach((id, index) => {
+        if (tool === 'chroma_add_documents' || docs.has(id)) docs.set(id, { document: args.documents[index], metadata: args.metadatas[index] });
+      });
+      return {};
+    }
+    throw new Error('Unexpected tool ' + tool);
+  };
+  const apply = new SyncApply(store.db, { deviceId: 'owned-local', chromaSync: chroma });
+  const now = Date.now();
+  const common = { memory_session_id: 'remote-memory', project: 'project', prompt_number: 1, created_at_epoch: now };
+  let body = kind === 'observation' ? { ...common, type: 'discovery', title: 'Old title', narrative: 'Old body', facts: '["Old fact one","Old fact two"]', concepts: '[]', files_read: '[]', files_modified: '[]' }
+    : kind === 'summary' ? { ...common, request: 'Old body', completed: 'Old completion' }
+    : { ...common, content_session_id: 'remote-host', prompt_text: 'Old body', platform_source: 'claude' };
+  const op = (rev, body) => ({ seq: String(rev), rev: String(rev), kind, origin_device: 'owned-remote', origin_id: '10', body: JSON.stringify(body), server_ts: now });
+  const tick = () => new Promise(resolve => setImmediate(resolve));
+  const wait = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(); } throw new Error('Fixture did not settle'); };
+  let backfilled, indexedBefore, platformsBefore;
+  if (mode === 'backfilled') {
+    // Backfill, not the live forward, indexed this replica row (a pending
+    // retry or a rebuild). Its session is not claude's, and it carries stored
+    // columns the forward used to drop: legacy text, a merge target and
+    // plain-string list columns (#3423).
+    store.db.prepare("INSERT INTO sdk_sessions (content_session_id, memory_session_id, project, platform_source, started_at, started_at_epoch, status) VALUES ('remote-host', 'remote-memory', 'project', 'codex', ?, ?, 'completed')").run(new Date(now).toISOString(), now);
+    body = kind === 'observation'
+      ? { ...body, text: 'Old legacy text', facts: '旧事实', concepts: 'plain concept', files_read: 'src/plain.ts', merged_into_project: 'merged-project' }
+      : { ...body, merged_into_project: 'merged-project' };
+    new SyncApply(store.db, { deviceId: 'owned-local' }).applyOps([op(1, body)]);
+    backfilled = await chroma.ensureBackfilled('project', store);
+    indexedBefore = [...docs.keys()].sort();
+    platformsBefore = [...new Set([...docs.values()].map(doc => doc.metadata.platform_source))];
+  } else {
+    apply.applyOps([op(1, body)]);
+    if (mode === 'order') await wait(() => started); else await wait(() => docs.size > 0);
+  }
+  const revised = mode === 'order' ? { ...body, title: 'New title', narrative: 'New body', facts: '[]', request: 'New body', completed: null, prompt_text: 'New body' }
+    : mode === 'partial' ? { ...body, title: 'New title', narrative: null, facts: '["New fact"]', request: 'New body', completed: null }
+    : 
```

---

### Incident Patch 7: `9b08996c` (2026-10-05)
**Commit Message**: fix(smart-read): include Java constructors in outlines (#4439)

* fix(smart-read): include Java constructors in outlines

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): distinguish Java constructor overloads

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): use a non-reserved constructor capture tag

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/smart-file-read/parser.ts` (modified, +13/-0)
```diff
@@ -198,6 +198,7 @@ const QUERIES: Record<string, string> = {
 
   java: `
 (method_declaration name: (identifier) @name) @method
+(constructor_declaration name: (identifier) @name parameters: (formal_parameters) @parameters) @ctor
 (class_declaration name: (identifier) @name) @cls
 (interface_declaration name: (identifier) @name) @iface
 (enum_declaration name: (identifier) @name) @enm
@@ -584,6 +585,7 @@ const KIND_MAP: Record<string, CodeSymbol["kind"]> = {
   const_func: "function",
   cls: "class",
   method: "method",
+  ctor: "method",
   iface: "interface",
   tdef: "type",
   enm: "enum",
@@ -735,6 +737,17 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
     const endRow = kindCapture.endRow;
     const kind = KIND_MAP[kindCapture.tag];
     let name = nameCapture?.text || "anonymous";
+    if (kindCapture.tag === "ctor") {
+      const parameters = match.captures.find(c => c.tag === "parameters");
+      if (parameters) {
+        const parameterLines = lines.slice(parameters.startRow, parameters.endRow + 1);
+        parameterLines[0] = Buffer.from(parameterLines[0] ?? "").subarray(parameters.startCol).toString();
+        const last = parameterLines.length - 1;
+        parameterLines[last] = Buffer.from(parameterLines[last]).subarray(0,
+          parameters.endCol - (last === 0 ? parameters.startCol : 0)).toString();
+        name += parameterLines.join(" ").replace(/\s+/g, " ").trim();
+      }
+    }
 
     let signature: string;
     if (language === "markdown" && kind === "section") {
```

**File**: `tests/services/smart-file-read/java-constructors.test.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import { describe, expect } from 'bun:test';
+import { nativeTest as test } from './native-prerequisite.js';
+import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { formatFoldedView, parseFile, unfoldSymbol } from '../../../src/services/smart-file-read/parser.js';
+import { searchCodebase } from '../../../src/services/smart-file-read/search.js';
+
+const SOURCE = 'class Counter {\n  public Counter(int initial) {\n    System.out.println(initial);\n  }\n  int increment() { return 1; }\n}';
+
+describe('Java constructor outlines', () => {
+  test('captures a constructor beside its class instance methods', () => {
+    const parsed = parseFile(SOURCE, 'Counter.java');
+    expect(parsed.symbols.map(symbol => symbol.name)).toEqual(['Counter']);
+    expect(parsed.symbols[0].children?.map(symbol => symbol.name)).toEqual(['Counter(int initial)', 'increment']);
+    const constructor = parsed.symbols[0].children?.[0];
+    expect(constructor?.kind).toBe('method');
+    expect(constructor?.lineStart).toBe(1);
+    expect(constructor?.lineEnd).toBe(3);
+    expect(formatFoldedView(parsed)).toContain('public Counter(int initial)');
+  }, 120000);
+
+  test('retains each overloaded constructor with its own source range', () => {
+    const source = 'class Counter {\n  Counter() {}\n  Counter(int initial) {}\n}';
+    const constructors = parseFile(source, 'Counter.java').symbols[0].children;
+    expect(constructors?.map(symbol => [symbol.name, symbol.lineStart])).toEqual([['Counter()', 1], ['Counter(int initial)', 2]]);
+  }, 120000);
+
+  test('native batched search includes the constructor result', async () => {
+    const dir = mkdtempSync(join(tmpdir(), 'claude-mem-java-constructor-'));
+    try {
+      writeFileSync(join(dir, 'Counter.java'), SOURCE);
+      const result = await searchCodebase(dir, 'Counter');
+      expect(result.matchingSymbols.find(symbol => symbol.symbolName === 'Counter.Counter(int initial)')?.kind).toBe('method');
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }, 120000);
+});
+
+test('unfolds overloaded constructors independently of the class name', () => {
+  const source = 'class Counter {\n  Counter() { noArgs(); }\n  Counter(int initial) { withArgs(initial); }\n}';
+  expect(unfoldSymbol(source, 'Counter.java', 'Counter')).toContain('class Counter');
+  expect(unfoldSymbol(source, 'Counter.java', 'Counter()')).toContain('noArgs()');
+  expect(unfoldSymbol(source, 'Counter.java', 'Counter()')).not.toContain('withArgs');
+  expect(unfoldSymbol(source, 'Counter.java', 'Counter(int initial)')).toContain('withArgs(initial)');
+  expect(unfoldSymbol(source, 'Counter.java', 'Counter(int initial)')).not.toContain('noArgs');
+}, 120000);
```

**File**: `tests/services/smart-file-read/native-prerequisite.ts` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import { test } from 'bun:test';
+import { execFileSync } from 'node:child_process';
+import { resolveTreeSitterBinPath } from '../../../src/services/smart-file-read/parser.js';
+
+let available = false;
+try {
+  execFileSync(resolveTreeSitterBinPath(), ['--version'], { stdio: 'ignore', timeout: 10000 });
+  available = true;
+} catch {
+  if (process.env.CI) throw new Error('CI requires a runnable tree-sitter binary for native smart-read regressions.');
+}
+// Optional runtime installs may lack the native binary locally. CI must execute
+// these regressions, so a missing prerequisite fails explicitly there.
+export const nativeTest = available ? test : test.skip;
```

---

### Incident Patch 8: `c8f54455` (2026-10-05)
**Commit Message**: fix(smart-read): retain setext heading names and levels (#4437)

* fix(smart-read): retain setext heading names and levels

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): preserve captured ATX heading names

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/smart-file-read/parser.ts` (modified, +13/-2)
```diff
@@ -734,13 +734,24 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
     const startRow = kindCapture.startRow;
     const endRow = kindCapture.endRow;
     const kind = KIND_MAP[kindCapture.tag];
-    const name = nameCapture?.text || "anonymous";
+    let name = nameCapture?.text || "anonymous";
 
     let signature: string;
     if (language === "markdown" && kind === "section") {
+      // Setext heading paragraphs include a trailing newline (and can span
+      // lines), so the CLI prints only their range, without a `text` value.
+      if (nameCapture && !nameCapture.text) {
+        const capturedLines = lines.slice(nameCapture.startRow, nameCapture.endRow + 1);
+        capturedLines[0] = Buffer.from(capturedLines[0] ?? "").subarray(nameCapture.startCol).toString();
+        const last = capturedLines.length - 1;
+        capturedLines[last] = Buffer.from(capturedLines[last] ?? "")
+          .subarray(0, nameCapture.endCol - (last === 0 ? nameCapture.startCol : 0)).toString();
+        name = capturedLines.join(" ").trim().replace(/\s+/g, " ");
+      }
       const headingLine = lines[startRow] || "";
       const hashMatch = headingLine.match(/^(#{1,6})\s/);
-      const level = hashMatch ? hashMatch[1].length : 1;
+      const underline = lines[endRow - (kindCapture.endCol === 0 ? 1 : 0)] || "";
+      const level = hashMatch ? hashMatch[1].length : /^\s*-+\s*$/.test(underline) ? 2 : 1;
       signature = `${"#".repeat(level)} ${name}`;
     } else if (language === "markdown" && kind === "code") {
       const langTag = name !== "anonymous" ? name : "";
```

**File**: `tests/services/smart-file-read/setext-headings.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { describe, expect, test } from 'bun:test';
+import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { parseFile, unfoldSymbol } from '../../../src/services/smart-file-read/parser.js';
+import { searchCodebase } from '../../../src/services/smart-file-read/search.js';
+
+const SOURCE = 'Overview\n========\n\nintro\n\nDetails\n-------\n\ndetail\n\n# Next\nlast';
+
+describe('native Markdown setext heading sections', () => {
+  test('preserves setext heading names and underline levels beside ATX headings', () => {
+    const headings = parseFile(SOURCE, 'owned.md').symbols.filter(symbol => symbol.kind === 'section');
+    expect(headings.map(symbol => symbol.name)).toEqual(['Overview', 'Details', 'Next']);
+    expect(headings.map(symbol => symbol.signature)).toEqual(['# Overview', '## Details', '# Next']);
+  }, 120000);
+
+  test('unfolds the parent section through its lower-level setext section', () => {
+    const unfolded = unfoldSymbol(SOURCE, 'owned.md', 'Overview');
+    expect(unfolded).toContain('Details\n-------');
+    expect(unfolded).toContain('detail');
+    expect(unfolded).not.toContain('# Next');
+    expect(unfoldSymbol(SOURCE, 'owned.md', 'Details')).toContain('detail');
+  }, 120000);
+
+  test('preserves a multiline UTF-8 heading name', () => {
+    const source = 'Café\n設計 details\n------------\n\nbody';
+    const heading = parseFile(source, 'utf8.md').symbols[0];
+    expect(heading.name).toBe('Café 設計 details');
+    expect(heading.signature).toBe('## Café 設計 details');
+    expect(unfoldSymbol(source, 'utf8.md', heading.name)).toContain('body');
+  }, 120000);
+
+  test('native batched search returns a setext heading by its visible name', async () => {
+    const dir = mkdtempSync(join(tmpdir(), 'claude-mem-setext-search-'));
+    try {
+      writeFileSync(join(dir, 'owned.md'), SOURCE);
+      const result = await searchCodebase(dir, 'Details');
+      expect(result.matchingSymbols.map(symbol => symbol.symbolName)).toContain('Details');
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }, 120000);
+});
+
+test('preserves captured ATX whitespace for exact-name unfolding', () => {
+  const source = '# Multiple   Spaces\n\nowned ATX body';
+  expect(parseFile(source, 'owned.md').symbols[0].name).toBe('Multiple   Spaces');
+  expect(unfoldSymbol(source, 'owned.md', 'Multiple   Spaces')).toContain('owned ATX body');
+}, 120000);
```

---

### Incident Patch 9: `1ad44761` (2026-10-05)
**Commit Message**: fix(gemini): serialize pacing admission across concurrent sessions (#4449)

* fix(gemini): reserve pacing slots before concurrent waits

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(gemini): serialize admission and cancel unused pacing waits

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/worker/GeminiProvider.ts` (modified, +38/-16)
```diff
@@ -169,6 +169,7 @@ const GEMINI_RPM_LIMITS: Record<GeminiModel, number> = {
 };
 
 let lastRequestTime = 0;
+let rateLimitQueue: Promise<void> = Promise.resolve();
 
 const GEMINI_EMPTY_HISTORY_FALLBACK = 'Continue the memory observation request.';
 
@@ -227,24 +228,45 @@ export function categorizeGeminiBadRequest(bodyText: string): GeminiBadRequestCa
   return 'unknown_bad_request';
 }
 
-async function enforceRateLimitForModel(model: GeminiModel, rateLimitingEnabled: boolean): Promise<void> {
-  if (!rateLimitingEnabled) {
-    return;
-  }
+async function enforceRateLimitForModel(
+  model: GeminiModel,
+  rateLimitingEnabled: boolean,
+  signal?: AbortSignal,
+): Promise<void> {
+  if (!rateLimitingEnabled) return;
 
   const rpm = GEMINI_RPM_LIMITS[model] || 5;
   const minimumDelayMs = Math.ceil(60000 / rpm) + 100;
-
-  const now = Date.now();
-  const timeSinceLastRequest = now - lastRequestTime;
-
-  if (timeSinceLastRequest < minimumDelayMs) {
-    const waitTime = minimumDelayMs - timeSinceLastRequest;
-    logger.debug('SDK', `Rate limiting: waiting ${waitTime}ms before Gemini request`, { model, rpm });
-    await new Promise(resolve => setTimeout(resolve, waitTime));
-  }
-
-  lastRequestTime = Date.now();
+  // Only the front waiter computes a delay, using the previous actual
+  // admission. Late timers cannot release several expired reservations.
+  const admission = rateLimitQueue.then(async () => {
+    signal?.throwIfAborted();
+    const waitTime = Math.max(0, lastRequestTime + minimumDelayMs - Date.now());
+    if (waitTime > 0) {
+      logger.debug('SDK', `Rate limiting: waiting ${waitTime}ms before Gemini request`, { model, rpm });
+      await new Promise<void>((resolve, reject) => {
+        let timer: ReturnType<typeof setTimeout> | undefined;
+        const onAbort = () => {
+          if (timer !== undefined) clearTimeout(timer);
+          signal?.removeEventListener('abort', onAbort);
+          reject(signal?.reason ?? new Error('Aborted'));
+        };
+        const onTimeout = () => {
+          signal?.removeEventListener('abort', onAbort);
+          resolve();
+        };
+        signal?.addEventListener('abort', onAbort, { once: true });
+        timer = setTimeout(onTimeout, waitTime);
+        if (signal?.aborted) onAbort();
+      });
+    }
+    signal?.throwIfAborted();
+    lastRequestTime = Date.now();
+  });
+  // A cancelled compression pass never consumes an admission and must not
+  // reject the next healthy waiter's chain.
+  rateLimitQueue = admission.catch(() => {});
+  await admission;
 }
 
 interface GeminiResponse {
@@ -434,7 +456,7 @@ export class GeminiProvider extends OpenAICompatibleProvider<GeminiConfig> {
 
     const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;
 
-    await enforceRateLimitForModel(model, rateLimitingEnabled);
+    await enforceRateLimitForModel(model, rateLimitingEnabled, signal);
 
     const clientAttemptId = paidSendBudget?.clientAttemptId ?? randomUUID();
     // The id of the response actually returned, for the cut-off warning.
```

**File**: `tests/fixtures/gemini/concurrent-pacing.ts` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+import { strict as assert } from 'node:assert';
+import { spyOn } from 'bun:test';
+import { SessionStore } from '../../../src/services/sqlite/SessionStore.ts';
+import { SessionManager } from '../../../src/services/worker/SessionManager.ts';
+import { GeminiProvider } from '../../../src/services/worker/GeminiProvider.ts';
+import { ModeManager } from '../../../src/services/domain/ModeManager.ts';
+import { SettingsDefaultsManager } from '../../../src/shared/SettingsDefaultsManager.ts';
+
+const stall = process.argv[2] === 'stalled';
+const store = new SessionStore(':memory:');
+const db: any = { getSessionStore: () => store, getSessionById: (id: number) => store.getSessionById(id), getChromaSync: () => null, getCloudSync: () => null };
+const manager = new SessionManager(db);
+const mode = ModeManager.getInstance() as any;
+const oldMode = mode.activeMode, oldModeId = mode.activeModeId;
+mode.loadMode('code');
+const arrivals: number[] = [];
+const sessions = [1, 2, 3].map(index => {
+  const id = store.createSDKSession(`owned-pacing-${index}`, 'owned-pacing-project', 'Inspect owned file');
+  const session = manager.initializeSession(id);
+  manager.queueObservation(id, { tool_name: 'Read', tool_input: '{}', tool_response: 'owned text', prompt_number: 1, cwd: process.env.CLAUDE_MEM_DATA_DIR! });
+  return session;
+});
+const timers: ReturnType<typeof setTimeout>[] = [];
+const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
+  const body: any = await request.json();
+  assert.ok(body.contents.length > 0);
+  arrivals.push(performance.now());
+  if (stall && arrivals.length === 1) timers.push(setTimeout(() => {
+    const until = performance.now() + 8600;
+    while (performance.now() < until) {} // Controlled worker suspension; no fake timers.
+  }, 10));
+  const session = sessions[arrivals.length - 1];
+  timers.push(setTimeout(() => session.abortController.abort(), 30));
+  return Response.json({ candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] });
+}});
+const settings = spyOn(SettingsDefaultsManager, 'loadFromFile').mockImplementation(() => ({ ...SettingsDefaultsManager.getAllDefaults(), CLAUDE_MEM_GEMINI_API_KEY: 'owned-key', CLAUDE_MEM_GEMINI_MODEL: 'gemini-flash-lite-latest', CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: 'true', CLAUDE_MEM_OBSERVE_BARE_PROMPTS: 'false', CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: 'false' }));
+const realFetch = globalThis.fetch;
+const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
+  assert.ok(String(input).startsWith('https://generativelanguage.googleapis.com/'));
+  return realFetch(`http://127.0.0.1:${server.port}/generate`, init);
+});
+try {
+  const provider = new GeminiProvider(db, manager);
+  await Promise.all(sessions.map(session => provider.startSession(session)));
+  const gaps = arrivals.slice(1).map((at, i) => at - arrivals[i]);
+  console.log(JSON.stringify({ arrivals, gaps, pending: manager.getTotalQueueDepth() }));
+  assert.equal(arrivals.length, 3);
+  for (const gap of gaps) assert.ok(gap >= 4000, `Concurrent Gemini requests arrived only ${gap.toFixed(1)}ms apart`);
+  assert.equal(manager.getTotalQueueDepth(), 3);
+} finally {
+  for (const timer of timers) clearTimeout(timer);
+  fetchSpy.mockRestore(); settings.mockRestore(); server.stop(true);
+  for (const session of sessions) manager.removeSessionImmediate(session.sessionDbId);
+  store.close(); mode.activeMode = oldMode; mode.activeModeId = oldModeId;
+}
```

**File**: `tests/fixtures/gemini/pacing-compression.ts` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+import { strict as assert } from 'node:assert';
+import { spyOn } from 'bun:test';
+import { SessionStore } from '../../../src/services/sqlite/SessionStore.ts';
+import { SessionManager } from '../../../src/services/worker/SessionManager.ts';
+import { GeminiProvider } from '../../../src/services/worker/GeminiProvider.ts';
+import { ModeManager } from '../../../src/services/domain/ModeManager.ts';
+import { SettingsDefaultsManager } from '../../../src/shared/SettingsDefaultsManager.ts';
+
+const scenario = process.argv[2];
+const oversized = scenario !== 'normal-control';
+const enabled = scenario !== 'active-compression-control';
+const store = new SessionStore(':memory:');
+const db: any = { getSessionStore: () => store, getSessionById: (id: number) => store.getSessionById(id), getChromaSync: () => null, getCloudSync: () => null };
+const manager = new SessionManager(db);
+const id = store.createSDKSession('owned-pacing-compression', 'owned-project', 'Inspect owned file');
+const session = manager.initializeSession(id);
+for (let index = 0; index < 2; index++) manager.queueObservation(id, { tool_name: 'Read', tool_input: { file_path: `owned-${index}.ts` }, tool_response: index === 1 && oversized ? 'owned payload '.repeat(2500) : 'owned text', prompt_number: 1, cwd: process.env.CLAUDE_MEM_DATA_DIR! });
+const mode = ModeManager.getInstance() as any;
+const oldMode = mode.activeMode, oldModeId = mode.activeModeId;
+mode.loadMode('code');
+const observations: number[] = [];
+let compressionRequests = 0;
+const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
+  const body: any = await request.json();
+  const text = body.contents?.[0]?.parts?.[0]?.text ?? '';
+  if (text.startsWith('Condense the tool payload')) {
+    compressionRequests++;
+    await Bun.sleep(1200); // A started request outlives its caller's 500ms deadline.
+    return Response.json({ candidates: [{ content: { parts: [{ text: 'owned condensed text' }] } }] });
+  }
+  observations.push(performance.now());
+  return Response.json({ candidates: [{ content: { parts: [{ text: `<observation><type>discovery</type><title>Owned pacing ${observations.length}</title></observation>` }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, totalTokenCount: 120 } });
+}});
+const settings = spyOn(SettingsDefaultsManager, 'loadFromFile').mockImplementation(() => ({ ...SettingsDefaultsManager.getAllDefaults(), CLAUDE_MEM_GEMINI_API_KEY: 'owned-key', CLAUDE_MEM_GEMINI_MODEL: 'gemini-flash-lite-latest', CLAUDE_MEM_GEMINI_RATE_LIMITING_ENABLED: String(enabled), CLAUDE_MEM_FIELD_OPTIMIZE_TIMEOUT_MS: '500', CLAUDE_MEM_OBSERVE_BARE_PROMPTS: 'false', CLAUDE_MEM_FOLDER_CLAUDEMD_ENABLED: 'false' }));
+const realFetch = globalThis.fetch;
+const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
+  assert.ok(String(input).startsWith('https://generativelanguage.googleapis.com/'));
+  return realFetch(server.url, init);
+});
+try {
+  await new GeminiProvider(db, manager).startSession(session, { broadcastProcessingStatus() { if (manager.getTotalQueueDepth() === 0) session.abortController.abort(); } } as any);
+  const rows = (store.db.query('SELECT COUNT(*) AS count FROM observations').get() as any).count;
+  const gap = observations[1] - observations[0];
+  console.log(JSON.stringify({ scenario, observations, gap, compressionRequests, rows, pending: manager.getTotalQueueDepth() }));
+  assert.equal(observations.length, 2); assert.equal(rows, 2); assert.equal(manager.getTotalQueueDepth(), 0);
+  if (enabled) {
+    assert.equal(compressionRequests, 0, 'expired compression must not send a request');
+    assert.ok(gap >= 4000 && gap < 6000, `Healthy observation delayed ${gap.toFixed(1)}ms by an unused pacing slot`);
+  } else {
+    assert.equal(compressionRequests, 1, 'disabled pacing must allow the active compression attempt');
+    assert.ok(gap >= 450 && gap < 1500, `Active compression deadline took ${gap.toFixed(1)}ms`);
+  }
+} finally {
+  session.abortController.abort(); fetchSpy.mockRestore(); settings.mockRestore(); server.stop(true);
+  manager.removeSessionImmediate(id); store.close(); mode.activeMode = oldMode; mode.activeModeId = oldModeId;
+}
```

**File**: `tests/worker/gemini-concurrent-pacing.test.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import { expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+
+for (const scenario of ['normal', 'stalled']) {
+it(`spaces concurrent Gemini sessions with ${scenario} timers`, async () => {
+  const dataDir = mkdtempSync(join(tmpdir(), 'owned-gemini-pacing-'));
+  let child: ReturnType<typeof Bun.spawn> | undefined;
+  let timer: ReturnType<typeof setTimeout> | undefined;
+  try {
+    child = Bun.spawn([process.execPath, 'tests/fixtures/gemini/concurrent-pacing.ts', scenario], {
+      env: { ...process.env, CLAUDE_MEM_DATA_DIR: dataDir }, stdout: 'pipe', stderr: 'pipe',
+    });
+    const exit = await Promise.race([child.exited, new Promise<never>((_, reject) => {
+      timer = setTimeout(() => reject(new Error('Owned pacing fixture exceeded 18 seconds')), 18000);
+    })]);
+    const output = await new Response(child.stdout).text() + await new Response(child.stderr).text();
+    expect(exit, output).toBe(0);
+  } finally {
+    if (timer) clearTimeout(timer);
+    if (child && child.exitCode === null) { child.kill(); await child.exited; }
+    rmSync(dataDir, { recursive: true, force: true });
+  }
+}, 20000);
+}
```

**File**: `tests/worker/gemini-pacing-compression.test.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import { expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+
+for (const scenario of ['normal-control', 'expired-compression', 'active-compression-control']) {
+it(`preserves Gemini pacing through ${scenario}`, async () => {
+  const dataDir = mkdtempSync(join(tmpdir(), 'owned-gemini-pacing-'));
+  let child: ReturnType<typeof Bun.spawn> | undefined;
+  let timer: ReturnType<typeof setTimeout> | undefined;
+  try {
+    child = Bun.spawn([process.execPath, 'tests/fixtures/gemini/pacing-compression.ts', scenario], {
+      env: { ...process.env, CLAUDE_MEM_DATA_DIR: dataDir }, stdout: 'pipe', stderr: 'pipe',
+    });
+    const exit = await Promise.race([child.exited, new Promise<never>((_, reject) => {
+      timer = setTimeout(() => reject(new Error('Owned pacing fixture exceeded 18 seconds')), 18000);
+    })]);
+    const output = await new Response(child.stdout).text() + await new Response(child.stderr).text();
+    expect(exit, output).toBe(0);
+  } finally {
+    if (timer) clearTimeout(timer);
+    if (child && child.exitCode === null) { child.kill(); await child.exited; }
+    rmSync(dataDir, { recursive: true, force: true });
+  }
+}, 20000);
+}
```

---

### Incident Patch 10: `d7f5e059` (2026-10-05)
**Commit Message**: fix(smart-read): use native C and C++ outline queries (#4435)

* fix(smart-read): use native C and C++ outline queries

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): follow native C and C++ declarator names

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): deduplicate typedefs and index declarator names

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-read): bind typedef deduplication to its direct type

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/smart-file-read/parser.ts` (modified, +78/-2)
```diff
@@ -202,6 +202,25 @@ const QUERIES: Record<string, string> = {
 (interface_declaration name: (identifier) @name) @iface
 (enum_declaration name: (identifier) @name) @enm
 (import_declaration) @imp
+`,
+
+  c: `
+(function_definition) @func
+(function_declarator declarator: (identifier) @function_name)
+(type_definition type: (_) @aliased_type declarator: (type_identifier) @name) @tdef
+(struct_specifier name: (type_identifier) @name body: (field_declaration_list)) @struct_def
+(enum_specifier name: (type_identifier) @name body: (enumerator_list)) @enm
+(preproc_include) @imp
+`,
+
+  cpp: `
+(function_definition) @func
+(function_declarator declarator: [(identifier) (field_identifier) (qualified_identifier) (destructor_name) (operator_name)] @function_name)
+(type_definition type: (_) @aliased_type declarator: (type_identifier) @name) @tdef
+(class_specifier name: (type_identifier) @name body: (field_declaration_list)) @cls
+(struct_specifier name: (type_identifier) @name body: (field_declaration_list)) @struct_def
+(enum_specifier name: (type_identifier) @name body: (enumerator_list)) @enm
+(preproc_include) @imp
 `,
 
   kotlin: `
@@ -324,6 +343,8 @@ function getQueryKey(language: string): string {
     case "rust": return "rust";
     case "ruby": return "ruby";
     case "java": return "java";
+    case "c": return "c";
+    case "cpp": return "cpp";
     case "kotlin": return "kotlin";
     case "swift": return "swift";
     case "php": return "php";
@@ -654,6 +675,7 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
   const imports: string[] = [];
   const exportRanges: Array<{ startRow: number; endRow: number }> = [];
   const ranges = new Map<CodeSymbol, RawCapture>();
+  const aliasedTypes = new Map<CodeSymbol, RawCapture>();
   const containers: Array<{ sym: CodeSymbol; range: RawCapture }> = [];
 
   for (const match of matches) {
@@ -682,9 +704,31 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
     }
   }
 
+  // Names are captured independently of the surrounding pointer/reference
+  // wrappers. The first native function declarator inside a definition names
+  // that function, before any callback parameters or nested definitions.
+  const functionNames = matches.flatMap(match => match.captures.filter(c => c.tag === "function_name"))
+    .sort((a, b) => a.startRow - b.startRow || a.startCol - b.startCol);
+  const findFunctionName = (definition: RawCapture): RawCapture | undefined => {
+    let low = 0;
+    let high = functionNames.length;
+    while (low < high) {
+      const mid = Math.floor((low + high) / 2);
+      const capture = functionNames[mid];
+      if (capture.startRow < definition.startRow
+        || (capture.startRow === definition.startRow && capture.startCol < definition.startCol)) low = mid + 1;
+      else high = mid;
+    }
+    const capture = functionNames[low];
+    return capture && (capture.endRow < definition.endRow
+      || (capture.endRow === definition.endRow && capture.endCol <= definition.endCol)) ? capture : undefined;
+  };
   for (const match of matches) {
     const kindCapture = match.captures.find(c => KIND_MAP[c.tag]);
-    const nameCapture = match.captures.find(c => c.tag === "name");
+    const nameCapture = match.captures.find(c => c.tag === "name")
+      ?? (kindCapture?.tag === "func" && (language === "c" || language === "cpp")
+        ? findFunctionName(kindCapture)
+        : undefined);
     if (!kindCapture) continue;
 
     const startRow = kindCapture.startRow;
@@ -728,6 +772,8 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
     }
 
     ranges.set(sym, kindCapture);
+    const aliasedType = match.captures.find(c => c.tag === "aliased_type");
+    if (aliasedType) aliasedTypes.set(sym, aliasedType);
     symbols.push(sym);
   }
 
@@ -756,14 +802,44 @@ function buildSymbols(matches: RawMatch[], lines: string[], language: string): {
     }
   }
 
+  // A named typedef can capture both the alias and its same-named struct.
+  // Retain one structural symbol, with the enclosing typedef source range.
+  const duplicateAliases = new Set<CodeSymbol>();
+  if (language === "c" || language === "cpp") {
+    const structures = new Map<string, typeof containers>();
+    for (const container of containers) {
+      const entries = structures.get(container.sym.name) ?? [];
+      entries.push(container);
+      structures.set(container.sym.name, entries);
+    }
+    for (const alias of symbols.filter(symbol => symbol.kind === "type")) {
+      const range = ranges.get(alias)!;
+      const aliasedType = aliasedTypes.get(alias);
+      if (!aliasedType) continue;
+      // Only the direct type expression denotes the typedef's underlying type.
+      // A nested struct may share the alias name while denoting a distinct type.
+      const structure = structures.get(alias.name)?.find(({ range: inner }) =>
+        inner.startRow === aliasedType.sta
```

**File**: `tests/services/smart-file-read/c-cpp-outlines.test.ts` (added, +106/-0)
```diff
@@ -0,0 +1,106 @@
+import { describe, expect, test } from 'bun:test';
+import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { parseFile, unfoldSymbol } from '../../../src/services/smart-file-read/parser.js';
+import { searchCodebase } from '../../../src/services/smart-file-read/search.js';
+
+const C = '#include <stddef.h>\nstruct Point { int x; int y; };\nint add(int a, int b) { return a + b; }\nchar *message(void) { return "hello"; }';
+const CPP = '#include <string>\nclass Counter {\npublic:\n int increment() { return 1; }\n};\nint add(int a, int b) { return a + b; }';
+
+describe('built-in C and C++ native outlines', () => {
+  test('C captures functions, pointer return functions, structs and includes', () => {
+    const parsed = parseFile(C, 'owned.c');
+    expect(parsed.symbols.map(symbol => symbol.name)).toEqual(['Point', 'add', 'message']);
+    expect(parsed.symbols.map(symbol => symbol.kind)).toEqual(['struct', 'function', 'function']);
+    expect(parsed.imports).toEqual(['#include <stddef.h>']);
+    expect(unfoldSymbol(C, 'owned.c', 'message')).toContain('return "hello"');
+  }, 120000);
+
+  test('C++ captures classes with their methods, free functions and includes', () => {
+    const parsed = parseFile(CPP, 'owned.cpp');
+    expect(parsed.symbols.map(symbol => symbol.name)).toEqual(['Counter', 'add']);
+    expect(parsed.symbols[0].children?.map(symbol => symbol.name)).toEqual(['increment']);
+    expect(parsed.imports).toEqual(['#include <string>']);
+    expect(unfoldSymbol(CPP, 'owned.cpp', 'increment')).toContain('return 1');
+  }, 120000);
+
+  test('native batched search discovers functions in each built-in language', async () => {
+    const dir = mkdtempSync(join(tmpdir(), 'claude-mem-c-cpp-search-'));
+    try {
+      writeFileSync(join(dir, 'owned.c'), C);
+      writeFileSync(join(dir, 'owned.cpp'), CPP);
+      const result = await searchCodebase(dir, 'add');
+      expect(result.matchingSymbols.filter(symbol => symbol.symbolName === 'add').map(symbol => symbol.filePath).sort()).toEqual(['owned.c', 'owned.cpp']);
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }, 120000);
+});
+
+test('native C and C++ outlines retain deeply nested pointer declarators', () => {
+  for (const extension of ['c', 'cpp']) {
+    const source = 'char ****message(void) { return 0; }\nint ordinary(void) { return 1; }';
+    expect(parseFile(source, `owned.${extension}`).symbols.map(symbol => symbol.name)).toEqual(['message', 'ordinary']);
+    expect(unfoldSymbol(source, `owned.${extension}`, 'message')).toContain('return 0');
+  }
+}, 120000);
+
+test('native C++ outlines, unfold and batch search retain reference returns and special members', async () => {
+  const source = 'struct Widget {};\nWidget& getWidget() { static Widget result; return result; }\nclass Counter {\n ~Counter() { cleanup(); }\n bool operator==(const Counter& other) { return true; }\n int increment() { return 1; }\n};';
+  const parsed = parseFile(source, 'owned.cpp');
+  expect(parsed.symbols.map(symbol => symbol.name)).toEqual(['Widget', 'getWidget', 'Counter']);
+  expect(parsed.symbols[2].children?.map(symbol => symbol.name)).toEqual(['~Counter', 'operator==', 'increment']);
+  expect(unfoldSymbol(source, 'owned.cpp', 'getWidget')).toContain('return result');
+  expect(unfoldSymbol(source, 'owned.cpp', '~Counter')).toContain('cleanup()');
+  expect(unfoldSymbol(source, 'owned.cpp', 'operator==')).toContain('return true');
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-cpp-declarators-'));
+  try {
+    writeFileSync(join(dir, 'owned.cpp'), source);
+    expect((await searchCodebase(dir, 'getWidget')).matchingSymbols.map(symbol => symbol.symbolName)).toContain('getWidget');
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
+
+test('native anonymous typedef struct is accessible by its declared type name', () => {
+  const source = 'typedef struct { int x; } Point;\n';
+  expect(parseFile(source, 'owned.c').symbols.map(symbol => symbol.name)).toEqual(['Point']);
+  expect(unfoldSymbol(source, 'owned.c', 'Point')).toContain(source.trim());
+}, 120000);
+
+test('uses the enclosing function name before callback parameters', () => {
+  const source = 'int apply(int (*callback)(int)) { return callback(1); }\nint (*factory(void))(int) { return 0; }';
+  expect(parseFile(source, 'owned.c').symbols.map(symbol => symbol.name)).toEqual(['apply', 'factory']);
+}, 120000);
+
+test('named typedef tags share one symbol while distinct aliases remain visible', async () => {
+  const source = 'typedef struct Point { int x; } Point;\ntypedef struct Tag { int y; } Alias;';
+  const parsed = parseFile(source, 'owned.c');
+  expect(parsed.symbols.filter(symbol => symbol.name === 'Point')).toHaveLength(1);
+  expect(parsed.symbols.map(symbol => symbol.name)).toContain('Tag');
+  expect(parsed.symbols.map(symb
```

---

### Incident Patch 11: `79331b10` (2026-10-05)
**Commit Message**: fix(smart-unfold): resolve qualified search symbol names (#4434)

* fix(smart-unfold): resolve qualified search symbol names

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(smart-unfold): distinguish literal selector dots from ownership

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/smart-file-read/parser.ts` (modified, +13/-4)
```diff
@@ -998,21 +998,30 @@ function getSymbolIcon(kind: CodeSymbol["kind"]): string {
   return icons[kind] || "·";
 }
 
+// CSS selectors can contain literal dots, so escape those dots before adding
+// ownership separators. Search results remain unambiguous when copied to unfold.
+export function qualifySymbolName(name: string, parent: string | undefined, language: string): string {
+  const segment = language === "css" || language === "scss"
+    ? name.replace(/\\/g, "\\\\").replace(/\./g, "\\.") : name;
+  return parent ? `${parent}.${segment}` : segment;
+}
+
 export function unfoldSymbol(content: string, filePath: string, symbolName: string): string | null {
   const file = parseFile(content, filePath);
 
-  const findSymbol = (symbols: CodeSymbol[]): CodeSymbol | null => {
+  const findSymbol = (symbols: CodeSymbol[], qualified: boolean, parent?: string): CodeSymbol | null => {
     for (const sym of symbols) {
-      if (sym.name === symbolName) return sym;
+      const qualifiedName = qualifySymbolName(sym.name, parent, file.language);
+      if ((qualified ? qualifiedName : sym.name) === symbolName) return sym;
       if (sym.children) {
-        const found = findSymbol(sym.children);
+        const found = findSymbol(sym.children, qualified, qualifiedName);
         if (found) return found;
       }
     }
     return null;
   };
 
-  const symbol = findSymbol(file.symbols);
+  const symbol = findSymbol(file.symbols, true) ?? findSymbol(file.symbols, false);
   if (!symbol) return null;
 
   const lines = content.split("\n");
```

**File**: `src/services/smart-file-read/search.ts` (modified, +3/-3)
```diff
@@ -1,7 +1,7 @@
 
 import { readFile, readdir, stat } from "node:fs/promises";
 import { basename, extname, join, relative } from "node:path";
-import { parseFilesBatch, formatFoldedView, type FoldedFile } from "./parser.js";
+import { parseFilesBatch, formatFoldedView, qualifySymbolName, type FoldedFile } from "./parser.js";
 import { logger } from "../../utils/logger.js";
 
 const CODE_EXTENSIONS = new Set([
@@ -180,7 +180,7 @@ export async function searchCodebase(
           fileHasMatch = true;
           fileSymbolMatches.push({
             filePath: relPath,
-            symbolName: parent ? `${parent}.${sym.name}` : sym.name,
+            symbolName: qualifySymbolName(sym.name, parent, parsed.language),
             kind: sym.kind,
             signature: sym.signature,
             jsdoc: sym.jsdoc,
@@ -191,7 +191,7 @@ export async function searchCodebase(
         }
 
         if (sym.children) {
-          checkSymbols(sym.children, sym.name);
+          checkSymbols(sym.children, qualifySymbolName(sym.name, parent, parsed.language));
         }
       }
     };
```

**File**: `tests/services/smart-file-read/qualified-unfold.test.ts` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+import { describe, expect, test } from 'bun:test';
+import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+import { unfoldSymbol } from '../../../src/services/smart-file-read/parser.js';
+import { searchCodebase } from '../../../src/services/smart-file-read/search.js';
+
+const SOURCE = [
+  'class First {',
+  '  run() { return "first"; }',
+  '}',
+  'class Second {',
+  '  run() { return "second"; }',
+  '}',
+].join('\n');
+
+describe('smart search to unfold symbol identity', () => {
+  test('unfolds the exact qualified method returned by native smart search', async () => {
+    const dir = mkdtempSync(join(tmpdir(), 'claude-mem-qualified-unfold-'));
+    try {
+      writeFileSync(join(dir, 'methods.js'), SOURCE);
+      const result = await searchCodebase(dir, 'run');
+      const method = result.matchingSymbols.find(symbol => symbol.symbolName === 'Second.run');
+      expect(method).toBeDefined();
+      const unfolded = unfoldSymbol(SOURCE, 'methods.js', method!.symbolName);
+      expect(unfolded).toContain('return "second"');
+      expect(unfolded).not.toContain('return "first"');
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }, 120000);
+
+  test('retains the existing unqualified lookup and rejects a wrong owner', () => {
+    expect(unfoldSymbol(SOURCE, 'methods.js', 'run')).toContain('return "first"');
+    expect(unfoldSymbol(SOURCE, 'methods.js', 'Missing.run')).toBeNull();
+  }, 120000);
+
+  test('accepts the full chain returned by search for nested class methods', async () => {
+    const source = 'class Outer {\n  create() {\n    class Inner {\n      run() { return "nested"; }\n    }\n  }\n}';
+    const dir = mkdtempSync(join(tmpdir(), 'claude-mem-nested-unfold-'));
+    try {
+      writeFileSync(join(dir, 'nested.js'), source);
+      const result = await searchCodebase(dir, 'run');
+      const method = result.matchingSymbols.find(symbol => symbol.symbolName === 'Outer.Inner.run');
+      expect(method).toBeDefined();
+      expect(unfoldSymbol(source, 'nested.js', method!.symbolName)).toContain('return "nested"');
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  }, 120000);
+});
+
+test('round trips nested CSS rules and literal dotted selectors independently', async () => {
+  const source = 'anonymous.anonymous.foo { color: red; }\n@media screen {\n  @media print {\n    foo { color: blue; }\n  }\n}';
+  const dir = mkdtempSync(join(tmpdir(), 'claude-mem-css-qualified-'));
+  try {
+    writeFileSync(join(dir, 'owned.css'), source);
+    const result = await searchCodebase(dir, 'foo');
+    const literal = result.matchingSymbols.find(symbol => symbol.lineStart === 0)!;
+    const nested = result.matchingSymbols.find(symbol => symbol.lineStart === 3)!;
+    expect(literal.symbolName).not.toBe(nested.symbolName);
+    expect(unfoldSymbol(source, 'owned.css', literal.symbolName)).toContain('color: red');
+    expect(unfoldSymbol(source, 'owned.css', literal.symbolName)).not.toContain('color: blue');
+    expect(unfoldSymbol(source, 'owned.css', nested.symbolName)).toContain('color: blue');
+    expect(unfoldSymbol(source, 'owned.css', nested.symbolName)).not.toContain('color: red');
+  } finally { rmSync(dir, { recursive: true, force: true }); }
+}, 120000);
```

---

### Incident Patch 12: `191a03dc` (2026-10-05)
**Commit Message**: fix(opencode): honor worker host settings and IPv6 addresses (#4445)

* fix(opencode): honor worker host settings and IPv6 addresses

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* test(opencode): probe IPv6 availability before endpoint fixtures

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* refactor(opencode): share the IPv6 host bracket rule with worker-utils

Move formatHostForUrl from worker-utils.ts into a new import-free
src/shared/worker-url.ts, and have the OpenCode plugin's worker URL resolver
use it instead of a third inline copy of the rule. The plugin bundle still
never imports worker-utils (the contract test checks that), and worker-utils
re-exports the helper so install.ts and buildWorkerUrl are unchanged.
HealthMonitor's private copy stays for now, because blocked #4262 edits those
lines.

Adds tests/shared/worker-url.test.ts for the rule: bare and bracketed IPv6,
IPv4, a hostname and 0.0.0.0.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Xfwhy9juusBwHXUBBZzTS9

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTE

**File**: `src/integrations/opencode-plugin/index.ts` (modified, +6/-8)
```diff
@@ -6,8 +6,9 @@ import {
   type RealOpenCodeEventType,
 } from "./contract.js";
 import { normalizePlatformSource } from "../../shared/platform-source.js";
-// Dependency-free, so it stays bundle-safe for the plugin (no worker-only imports).
+// Dependency-free, so they stay bundle-safe for the plugin (no worker-only imports).
 import { isConnectionRefusedError } from "../../shared/connection-errors.js";
+import { formatHostForUrl } from "../../shared/worker-url.js";
 import { retryWhileRefused } from "./worker-retry.js";
 
 /**
@@ -93,19 +94,16 @@ interface BusEvent {
   };
 }
 
-function resolveWorkerPort(): string {
+function resolveWorkerBaseUrl(): string {
   const settingsPath = join(
     SettingsDefaultsManager.get("CLAUDE_MEM_DATA_DIR"),
     "settings.json",
   );
-  return SettingsDefaultsManager.loadFromFile(settingsPath).CLAUDE_MEM_WORKER_PORT;
+  const settings = SettingsDefaultsManager.loadFromFile(settingsPath);
+  return `http://${formatHostForUrl(settings.CLAUDE_MEM_WORKER_HOST)}:${settings.CLAUDE_MEM_WORKER_PORT}`;
 }
 
-function resolveWorkerHost(): string {
-  return SettingsDefaultsManager.get("CLAUDE_MEM_WORKER_HOST");
-}
-
-const WORKER_BASE_URL = `http://${resolveWorkerHost()}:${resolveWorkerPort()}`;
+const WORKER_BASE_URL = resolveWorkerBaseUrl();
 const MAX_TOOL_RESPONSE_LENGTH = 1000;
 
 // Identifies these POSTs as coming from OpenCode. Without it the worker
```

**File**: `src/shared/worker-url.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+/**
+ * Format a worker host for a URL authority. An IPv6 literal must be bracketed,
+ * so a `CLAUDE_MEM_WORKER_HOST` of `::1` yields `http://[::1]:port` instead of
+ * the malformed `http://::1:port`.
+ *
+ * Keep this module import-free: the OpenCode plugin bundle uses it, and that
+ * bundle must not pull in worker-utils (tests/integrations/opencode-plugin-contract.test.ts).
+ */
+export function formatHostForUrl(host: string): string {
+  if (host.startsWith('[') && host.endsWith(']')) return host;
+  return host.includes(':') ? `[${host}]` : host;
+}
```

**File**: `src/shared/worker-utils.ts` (modified, +4/-4)
```diff
@@ -9,6 +9,7 @@ import { MARKETPLACE_ROOT, DATA_DIR, resolveDataDir } from "./paths.js";
 import { loadFromFileOnce } from "./hook-settings.js";
 import { isWorkerAutostartDisabled } from "./worker-autostart.js";
 import { viewerBaseUrl } from "./viewer-url.js";
+import { formatHostForUrl } from "./worker-url.js";
 import { readOwnedWorkerPidInfo } from "../supervisor/index.js";
 import { emitDiagnostic } from "./hook-io.js";
 import { captureCliEvent } from "../services/telemetry/cli-telemetry.js";
@@ -466,10 +467,9 @@ function boundedByBudget(stepTimeoutMs: number, deadlineAt: number | null): numb
   return remainingMs === null ? stepTimeoutMs : Math.max(1, Math.min(stepTimeoutMs, remainingMs));
 }
 
-export function formatHostForUrl(host: string): string {
-  if (host.startsWith('[') && host.endsWith(']')) return host;
-  return host.includes(':') ? `[${host}]` : host;
-}
+// The bracket rule lives in the import-free worker-url.ts so the OpenCode
+// plugin bundle can share it; re-exported here for existing callers.
+export { formatHostForUrl } from "./worker-url.js";
 
 export function buildWorkerUrl(apiPath: string): string {
   return `http://${formatHostForUrl(getWorkerHost())}:${getWorkerPort()}${apiPath}`;
```

**File**: `tests/fixtures/opencode/worker-endpoint.ts` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+import { strict as assert } from 'node:assert';
+import { writeFileSync } from 'node:fs';
+import { join } from 'node:path';
+import { SessionStore } from '../../../src/services/sqlite/SessionStore.js';
+import { SessionManager } from '../../../src/services/worker/SessionManager.js';
+import { ingestObservation, setIngestContext } from '../../../src/services/worker/http/shared.js';
+import { SettingsDefaultsManager } from '../../../src/shared/SettingsDefaultsManager.js';
+const scenario=process.argv[2];
+const host=scenario.startsWith('ipv6')?'::1':scenario==='default'?'127.0.0.1':'0.0.0.0';
+if(scenario.endsWith('-env')||scenario==='env-over-file')process.env.CLAUDE_MEM_WORKER_HOST=host;
+else delete process.env.CLAUDE_MEM_WORKER_HOST;
+const store=new SessionStore(':memory:');
+const db:any={getSessionStore:()=>store,getSessionById:(id:number)=>store.getSessionById(id),getChromaSync:()=>null,getCloudSync:()=>null};
+const manager=new SessionManager(db);
+setIngestContext({dbManager:db,sessionManager:manager,eventBroadcaster:{broadcastObservationQueued(){}} as any,ensureGeneratorRunning:async()=>{}});
+let posts=0;const urls:string[]=[];
+const server=Bun.serve({hostname:host,port:0,async fetch(request){
+ const url=new URL(request.url);urls.push(url.hostname);
+ if(url.pathname==='/api/context/inject')return new Response('owned endpoint memory');
+ const body:any=await request.json();posts++;
+ return Response.json(await ingestObservation({contentSessionId:body.contentSessionId,toolName:body.tool_name,toolInput:body.tool_input,toolResponse:body.tool_response,cwd:body.cwd,platformSource:body.platform_source}));
+}});
+writeFileSync(join(process.env.CLAUDE_MEM_DATA_DIR!,'settings.json'),JSON.stringify({...SettingsDefaultsManager.getAllDefaults(),CLAUDE_MEM_WORKER_PORT:String(server.port),CLAUDE_MEM_WORKER_HOST:scenario==='env-over-file'?'127.0.0.1':host,CLAUDE_MEM_OBSERVE_BARE_PROMPTS:'false'}));
+try{
+ const {default:factory}=await import(process.env.CLAUDE_MEM_OPENCODE_MODULE || '../../../src/integrations/opencode-plugin/index.ts');
+ const hooks=await factory({client:{},project:{},directory:process.env.CLAUDE_MEM_DATA_DIR!,worktree:process.env.CLAUDE_MEM_DATA_DIR!,serverUrl:new URL('http://127.0.0.1'),$:null});
+ await hooks['tool.execute.after']({tool:'ownedTool',sessionID:'owned-endpoint-session',callID:'owned-call',args:{owned:true}},{title:'owned',output:'owned output',metadata:{}});
+ const output={system:[] as string[]};await hooks['experimental.chat.system.transform']({sessionID:'owned-endpoint-session'},output);
+ const sessions:any[]=store.db.query('SELECT content_session_id,platform_source FROM sdk_sessions').all();
+ console.log(JSON.stringify({scenario,host,posts,system:output.system,sessions,urls}));
+ assert.equal(posts,1,'configured worker endpoint must receive the observation');
+ assert.deepEqual(urls,[host.includes(':')?`[${host}]`:host,host.includes(':')?`[${host}]`:host],'requests must use the configured host');
+ assert.deepEqual(output.system,['owned endpoint memory']);
+ assert.equal(sessions.length,1);assert.equal(sessions[0].platform_source,'opencode');
+ assert.equal(manager.getTotalQueueDepth(),1);
+}finally{for(const row of store.db.query('SELECT id FROM sdk_sessions').all() as {id:number}[])manager.removeSessionImmediate(row.id);server.stop(true);store.close()}
```

**File**: `tests/integrations/opencode-plugin-contract.test.ts` (modified, +2/-1)
```diff
@@ -129,7 +129,8 @@ describe("OpenCode plugin event contract", () => {
     );
 
     expect(source).not.toContain('from "../../shared/worker-utils.js"');
-    expect(source).toContain('SettingsDefaultsManager.loadFromFile(settingsPath).CLAUDE_MEM_WORKER_PORT');
+    expect(source).toContain('SettingsDefaultsManager.loadFromFile(settingsPath)');
+    expect(source).toContain('settings.CLAUDE_MEM_WORKER_PORT');
   });
 
   it("uses the persisted worker port in OpenCode worker requests", async () => {
```

**File**: `tests/shared/worker-url.test.ts` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+import { describe, expect, it } from 'bun:test';
+import { formatHostForUrl } from '../../src/shared/worker-url';
+
+describe('formatHostForUrl', () => {
+  it('brackets a bare IPv6 address', () => {
+    expect(formatHostForUrl('::1')).toBe('[::1]');
+  });
+
+  it('keeps an already bracketed IPv6 address as is', () => {
+    expect(formatHostForUrl('[::1]')).toBe('[::1]');
+  });
+
+  for (const host of ['127.0.0.1', 'host.docker.internal', '0.0.0.0']) {
+    it(`returns ${host} unchanged`, () => {
+      expect(formatHostForUrl(host)).toBe(host);
+    });
+  }
+});
```

**File**: `tests/worker/opencode-worker-endpoint.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+// Probe the fixture's Bun listener. The three IPv4 controls still run when
+// this host cannot bind IPv6 loopback.
+const ipv6Available = (() => {
+  try {
+    const server = Bun.serve({ hostname: '::1', port: 0, fetch: () => new Response('owned probe') });
+    server.stop(true);
+    return true;
+  } catch (error) {
+    if (['EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EPROTONOSUPPORT'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
+    throw error;
+  }
+})();
+
+for(const scenario of ['file-host','ipv6-file','ipv6-env','env-over-file','default']){
+ it.skipIf(scenario.startsWith('ipv6') && !ipv6Available)(`uses the configured OpenCode worker endpoint for ${scenario}`,async()=>{
+  const dataDir=mkdtempSync(join(tmpdir(),'owned-opencode-endpoint-'));
+  let child:ReturnType<typeof Bun.spawn>|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
+  try{
+   child=Bun.spawn([process.execPath,'tests/fixtures/opencode/worker-endpoint.ts',scenario],{env:{...process.env,CLAUDE_MEM_DATA_DIR:dataDir},stdout:'pipe',stderr:'pipe'});
+   const exit=await Promise.race([child.exited,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned endpoint fixture exceeded 8 seconds')),8000)})]);
+   const out=await new Response(child.stdout).text()+await new Response(child.stderr).text();expect(exit,out).toBe(0);
+  }finally{if(timer)clearTimeout(timer);if(child&&child.exitCode===null){child.kill();await child.exited}rmSync(dataDir,{recursive:true,force:true})}
+ });
+}
```

---

### Incident Patch 13: `21d884c1` (2026-10-05)
**Commit Message**: fix(omp): rotate memory sessions on switch and branch (#4444)

* fix(omp): rotate memory sessions on switch and branch

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(omp): order outstanding observations before final summary

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(omp): keep the memory session when OMP reloads the open file

OMP's reload() calls switchSession(this.sessionFile), which emits
session_switch for the file that is already open. The switch handler now
compares previousSessionFile with ctx.sessionManager.getSessionFile(), using
the same path.resolve comparison OMP uses, and keeps the session, its context
cache and its pending summary when they match. A switch with no previous
file still rotates.

Also:
- tests: a reload of the open file keeps one id, sends no summary and reuses
  the context cache; a switch to another file rotates and summarizes the
  first session once.
- tests: the compaction test sorted the two session ids and took the first
  as the pre-compaction one. With randomUUID ids that held only half the
  time, so it now uses request order and asserts the ids differ.
- docs: the hook header and omp/README.md no longer say the id rotates o

**File**: `omp/README.md` (modified, +6/-3)
```diff
@@ -14,16 +14,19 @@ OMP-side plugin or modification is required.
 
 | OMP event | claude-mem endpoint | Purpose |
 |---|---|---|
-| `session_start` | — | Mint a process-stable `contentSessionId` |
+| `session_start` | — | Mint the session's `contentSessionId` |
 | `before_agent_start` | `POST /api/sessions/init` | Record every user prompt, in order (creates the claude-mem session on the first) |
 | `tool_result` | `POST /api/sessions/observations` | Record each tool call after its prompt (fire-and-forget; never posts an init) |
 | `context` | `GET /api/context/inject` | Inject memory from past sessions into the prompt (60s cache) |
+| `session_switch` / `session_branch` | `POST /api/sessions/summarize` | Finalize the previous session after its prompts and observations, then mint a new id |
 | `session_shutdown` | `POST /api/sessions/summarize` | Finalize the session summary |
 
 Behavioral notes (matching the OpenClaw adapter's conventions):
 
-- `contentSessionId` is stable for the lifetime of an OMP process and rotates on
-  compaction — never per user prompt, so observations stay grouped.
+- `contentSessionId` follows the OMP session file: it rotates when OMP moves to
+  another file (`/new`, `/resume`, fork, branch, `/btw`) and on compaction —
+  never per user prompt, so observations stay grouped. A reload of the file
+  that is already open keeps it.
 - All POSTs are fire-and-forget detached chains; the hook never blocks tool
   dispatch (the extension runner's 30s handler cap is never approached).
 - `memory_*` tool results are skipped to avoid recursion.
```

**File**: `omp/hooks/claude-mem.ts` (modified, +41/-9)
```diff
@@ -18,9 +18,11 @@
  *  - context handler MAY return { messages }, but that REPLACES the conversation
  *    (chained replacement). We spread the original messages back in and append
  *    one system message — never return only injected text (would wipe the chat).
- *  - contentSessionId is process-stable and regenerated only on session_compact
- *    (one claude-mem session per omp session, not per prompt — before_agent_start
- *    fires once per user prompt, so we never mint a new id there).
+ *  - contentSessionId is regenerated on session_compact, session_switch and
+ *    session_branch: one claude-mem session per omp session file (and a new one
+ *    after each compaction), never per prompt — before_agent_start fires once
+ *    per user prompt, so we never mint a new id there. A reload re-emits
+ *    session_switch for the file already open, and that keeps the id.
  *  - every user prompt posts init (the worker de-duplicates a repeated prompt),
  *    as the Claude Code hooks do, each after the previous one so prompts are
  *    recorded in order. Observations wait for the latest prompt's init and are
@@ -35,8 +37,9 @@
  */
 
 import { readFileSync } from "node:fs";
+import { randomUUID } from "node:crypto";
 import { homedir } from "node:os";
-import { join } from "node:path";
+import { join, resolve } from "node:path";
 import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";
 
 // ---------------------------------------------------------------------------
@@ -132,6 +135,8 @@ interface OmpSession {
   // resolves true once the worker recorded that prompt. Observations and the
   // summary wait on it so they land after the prompts they belong to.
   lastInit?: Promise<boolean>;
+  // All observations dispatched for this identity, including HTTP still in flight.
+  observations?: Promise<void>;
   // The worker recorded at least one prompt for this id (finalize needs one).
   anchored: boolean;
   // The worker skipped this checkout as excluded: nothing more is sent.
@@ -143,7 +148,7 @@ let ctxCache: { at: number; cwd: string; md: string } | null = null;
 let lastAssistant = ""; // captured on agent_end, sent at summarize
 
 function newSession(): OmpSession {
-  session = { id: `omp-${process.pid}-${Date.now().toString(36)}`, anchored: false, excluded: false };
+  session = { id: `omp-${process.pid}-${randomUUID()}`, anchored: false, excluded: false };
   return session;
 }
 
@@ -225,13 +230,13 @@ async function recordPrompt(target: OmpSession, body: Record<string, unknown>):
   }
 }
 
-// Finalize a session the worker recorded a prompt for. Chained after its latest
-// init, so the summary never overtakes the prompts it summarizes; a session
+// Finalize a session the worker recorded a prompt for. Wait for its latest
+// init and all dispatched observations, so the summary cannot overtake them; a session
 // with no recorded prompt (every init failed, or the checkout is excluded) is
 // left alone.
 function finalize(target: OmpSession | undefined, assistantMessage: string): void {
   if (!target) return;
-  void (target.lastInit ?? Promise.resolve(false)).then(() => {
+  void Promise.all([target.lastInit ?? Promise.resolve(false), target.observations]).then(() => {
     if (!target.anchored || target.excluded) return;
     return post("/api/sessions/summarize", {
       contentSessionId: target.id,
@@ -254,6 +259,32 @@ export default function claudeMemBridge(pi: HookAPI): void {
     newSession();
   });
 
+  // /new, /resume and branches switch sessions without firing session_start
+  // again. Close the old prompt chain before rotating its bridge identity.
+  const switchSession = async (
+    event?: { previousSessionFile?: string | undefined },
+    ctx?: { sessionManager?: { getSessionFile?(): string | undefined } },
+  ) => {
+    // OMP's reload() re-emits session_switch for the file that is already open
+    // (switchSession(this.sessionFile)). That is the same OMP session: keep its
+    // id, context cache and pending summary. A switch with no previous file
+    // (e.g. a non-persisted /new) still rotates.
+    const previousFile = event?.previousSessionFile;
+    const currentFile = ctx?.sessionManager?.getSessionFile?.();
+    if (
+      typeof previousFile === "string" && previousFile !== ""
+      && typeof currentFile === "string" && currentFile !== ""
+      && resolve(previousFile) === resolve(currentFile)
+    ) return;
+    finalize(session, lastAssistant);
+    newSession();
+    workerBase = undefined;
+    ctxCache = null;
+    lastAssistant = "";
+  };
+  pi.on("session_switch", switchSession);
+  pi.on("session_branch", switchSession);
+
   // Compaction starts a new logical session in claude-mem too (matches Claude
   // Code's SessionStart clear/compact path): finalize the session that is
   // ending, then rotate the id. The next before_agent_start inits the new id
@@ -301,10 +332,11 @@ export default function claudeMemBridge(pi: HookAPI): vo
```

**File**: `tests/fixtures/omp/session-switch.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import { strict as assert } from 'node:assert';
+import { mkdirSync, writeFileSync } from 'node:fs';
+import { join } from 'node:path';
+import { spyOn } from 'bun:test';
+import { SessionStore } from '../../../src/services/sqlite/SessionStore.js';
+import { SessionManager } from '../../../src/services/worker/SessionManager.js';
+import { SessionRoutes } from '../../../src/services/worker/http/routes/SessionRoutes.js';
+import { ingestObservation, ingestSummarize, setIngestContext } from '../../../src/services/worker/http/shared.js';
+import { SettingsDefaultsManager } from '../../../src/shared/SettingsDefaultsManager.js';
+
+const eventName=process.argv[2];
+const delayed=process.argv[3]==='delayed';
+const dataDir=process.env.CLAUDE_MEM_DATA_DIR!;
+const cwd=join(dataDir,'owned-project');mkdirSync(cwd,{recursive:true});
+const store=new SessionStore(':memory:');
+const db:any={getSessionStore:()=>store,getSessionById:(id:number)=>store.getSessionById(id),getChromaSync:()=>null,getCloudSync:()=>null};
+const manager=new SessionManager(db);
+const broadcaster=new Proxy({},{get:()=>()=>{}}) as any;
+const route=new SessionRoutes(manager,db,{} as any,{} as any,{} as any,broadcaster,{} as any,{} as any) as any;
+route.ensureGeneratorRunning=async()=>{};
+setIngestContext({dbManager:db,sessionManager:manager,eventBroadcaster:broadcaster,ensureGeneratorRunning:async()=>{}});
+const requests:Array<{path:string,body:any}>=[];
+let contextFetches=0;
+const server=Bun.serve({hostname:'127.0.0.1',port:0,async fetch(request){
+ const path=new URL(request.url).pathname;
+ if(path==='/api/context/inject')return new Response(`owned memory ${++contextFetches}`);
+ const body=await request.json() as any;requests.push({path,body});
+ if(path==='/api/sessions/init')return new Promise<Response>((resolve)=>{
+  let status=200;
+  route.handleSessionInitByClaudeId({body,query:{},get(){return undefined}}, {headersSent:false,status(code:number){status=code;return this},json(value:any){resolve(Response.json(value,{status}))}});
+ });
+ if(path==='/api/sessions/observations'){if(delayed)await Bun.sleep(100);return Response.json(await ingestObservation({contentSessionId:body.contentSessionId,platformSource:body.platformSource,cwd:body.cwd,toolName:body.tool_name,toolInput:body.tool_input,toolResponse:body.tool_response}));}
+ if(path==='/api/sessions/summarize')return Response.json(await ingestSummarize({contentSessionId:body.contentSessionId,platformSource:body.platformSource,lastAssistantMessage:body.last_assistant_message}));
+ throw new Error(`Unexpected route ${path}`);
+}});
+writeFileSync(join(dataDir,'settings.json'),JSON.stringify({...SettingsDefaultsManager.getAllDefaults(),CLAUDE_MEM_WORKER_PORT:String(server.port),CLAUDE_MEM_WORKER_HOST:'127.0.0.1',CLAUDE_MEM_OBSERVE_BARE_PROMPTS:'false'}));
+const hooks=new Map<string,Function>();
+const nowSpy=spyOn(Date,'now').mockReturnValue(1_795_000_000_000);
+async function waitFor(path:string,count:number){const deadline=performance.now()+3000;while(requests.filter(r=>r.path===path).length<count&&performance.now()<deadline)await Bun.sleep(5);assert.equal(requests.filter(r=>r.path===path).length,count);await Bun.sleep(5)}
+try{
+ const {default:register}=await import(process.env.CLAUDE_MEM_OMP_MODULE || '../../../omp/hooks/claude-mem.ts');
+ register({on(name:string,handler:Function){hooks.set(name,handler)}} as any);
+ await hooks.get('session_start')?.({}, {cwd});
+ await hooks.get('before_agent_start')?.({prompt:'first owned prompt'},{cwd});
+ await hooks.get('tool_result')?.({toolName:'read',input:{path:'first.ts'},content:'first owned file'},{cwd});
+ if(!delayed)await waitFor('/api/sessions/observations',1);
+ else await waitFor('/api/sessions/init',1);
+ const firstContext=await hooks.get('context')?.({messages:[]},{cwd});assert.equal(firstContext.messages[0].content,'owned memory 1');
+ await hooks.get('agent_end')?.({messages:[{role:'assistant',content:'first owned answer'}]},{cwd});
+ await hooks.get(eventName)?.(eventName==='session_switch'?{reason:'new',previousSessionFile:'owned-old.jsonl'}:{reason:'branch',entryId:'owned-entry',previousSessionFile:'owned-old.jsonl'},{cwd});
+ await hooks.get('before_agent_start')?.({prompt:'second owned prompt'},{cwd});
+ await hooks.get('tool_result')?.({toolName:'read',input:{path:'second.ts'},content:'second owned file'},{cwd});
+ await waitFor('/api/sessions/observations',2);
+ const secondContext=await hooks.get('context')?.({messages:[]},{cwd});
+ await hooks.get('session_shutdown')?.();
+ const rows:any[]=store.db.query('SELECT id,content_session_id,user_prompt,platform_source FROM sdk_sessions ORDER BY id').all();
+ console.log(JSON.stringify({eventName,rows,requests,contextFetches}));
+ assert.equal(rows.length,2,'host session transitions need distinct worker sessions');
+ assert.deepEqual(rows.map(r=>r.user_prompt),['first owned prompt','second owned prompt']);
+ assert.equal(secondContext.messages[0].cont
```

**File**: `tests/omp-hook.test.ts` (modified, +63/-3)
```diff
@@ -446,17 +446,19 @@ describe('OMP Claude Mem hook', () => {
     await handlers.session_shutdown?.();
     await drainMicrotasks();
 
+    // Request order, not sort order: session ids are random, so only the order
+    // the inits were sent in says which session came before the compaction.
     const initSessions = requests
       .filter(request => request.path === '/api/sessions/init')
-      .map(request => String(request.body.contentSessionId))
-      .sort();
+      .map(request => String(request.body.contentSessionId));
     const summaries = requests.filter(request => request.path === '/api/sessions/summarize');
     const summarySessions = summaries
       .map(request => String(request.body.contentSessionId))
       .sort();
 
     expect(initSessions).toHaveLength(2);
-    expect(summarySessions).toEqual(initSessions);
+    expect(new Set(initSessions).size).toBe(2);
+    expect(summarySessions).toEqual([...initSessions].sort());
     expect(summaries.find(request => request.body.contentSessionId === initSessions[0])?.body).toMatchObject({
       last_assistant_message: 'precompact answer',
       platformSource: 'omp',
@@ -493,6 +495,64 @@ describe('OMP Claude Mem hook', () => {
     });
   });
 
+  it('keeps the session when OMP reloads the session file that is already open', async () => {
+    const requests: CapturedRequest[] = [];
+    installFetchCapture(requests);
+    const handlers = registerHook();
+    const cwd = '/owned/omp-reload';
+
+    await handlers.session_start?.();
+    await handlers.before_agent_start?.({ prompt: 'first' }, { cwd });
+    await handlers.agent_end?.({ messages: [{ role: 'assistant', content: 'first answer' }] });
+    await handlers.context?.({ messages: [] }, { cwd });
+    // OMP's reload() calls switchSession(this.sessionFile): session_switch fires
+    // with the open file as previousSessionFile, after the session manager
+    // already points at that same file.
+    await handlers.session_switch?.(
+      { reason: 'resume', previousSessionFile: '/owned/s.jsonl' },
+      { cwd, sessionManager: { getSessionFile: () => '/owned/s.jsonl' } },
+    );
+    await handlers.before_agent_start?.({ prompt: 'second' }, { cwd });
+    await handlers.context?.({ messages: [] }, { cwd });
+    await drainMicrotasks();
+
+    const inits = requests.filter(request => request.path === '/api/sessions/init');
+    expect(inits.map(request => request.body.prompt)).toEqual(['first', 'second']);
+    expect(new Set(inits.map(request => request.body.contentSessionId)).size).toBe(1);
+    expect(requests.filter(request => request.path === '/api/sessions/summarize')).toEqual([]);
+    // Same session, same cwd: the cached context is still valid.
+    expect(requests.filter(request => request.path === '/api/context/inject')).toHaveLength(1);
+  });
+
+  it('rotates the session when OMP switches to another session file', async () => {
+    const requests: CapturedRequest[] = [];
+    installFetchCapture(requests);
+    const handlers = registerHook();
+    const cwd = '/owned/omp-switch';
+
+    await handlers.session_start?.();
+    await handlers.before_agent_start?.({ prompt: 'first' }, { cwd });
+    await handlers.agent_end?.({ messages: [{ role: 'assistant', content: 'first answer' }] });
+    await handlers.session_switch?.(
+      { reason: 'resume', previousSessionFile: '/owned/s.jsonl' },
+      { cwd, sessionManager: { getSessionFile: () => '/owned/other.jsonl' } },
+    );
+    await handlers.before_agent_start?.({ prompt: 'second' }, { cwd });
+    await drainMicrotasks();
+
+    const inits = requests.filter(request => request.path === '/api/sessions/init');
+    const [firstId, secondId] = inits.map(request => request.body.contentSessionId);
+    expect(inits.map(request => request.body.prompt)).toEqual(['first', 'second']);
+    expect(firstId).not.toBe(secondId);
+    const summaries = requests.filter(request => request.path === '/api/sessions/summarize');
+    expect(summaries).toHaveLength(1);
+    expect(summaries[0]?.body).toMatchObject({
+      contentSessionId: firstId,
+      last_assistant_message: 'first answer',
+      platformSource: 'omp',
+    });
+  });
+
   it('defers the shutdown summarize until session init has completed', async () => {
     const requests: CapturedRequest[] = [];
     const { releaseInit } = installDeferredInitCapture(requests);
```

**File**: `tests/worker/omp-session-switch.test.ts` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+import { expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { join } from 'node:path';
+import { tmpdir } from 'node:os';
+for (const event of ['session_switch','session_branch']) {
+for (const timing of ['settled','delayed']) {
+ it(`starts a distinct worker session after OMP ${event} (${timing})`,async()=>{
+  const dataDir=mkdtempSync(join(tmpdir(),'owned-omp-switch-'));
+  let child:ReturnType<typeof Bun.spawn>|undefined;
+  let timer:ReturnType<typeof setTimeout>|undefined;
+  try{
+   child=Bun.spawn([process.execPath,'tests/fixtures/omp/session-switch.ts',event,timing],{env:{...process.env,CLAUDE_MEM_DATA_DIR:dataDir},stdout:'pipe',stderr:'pipe'});
+   const exit=await Promise.race([child.exited,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned OMP fixture exceeded 8 seconds')),8000)})]);
+   const out=await new Response(child.stdout).text()+await new Response(child.stderr).text();
+   expect(exit,out).toBe(0);
+  }finally{if(timer)clearTimeout(timer);if(child&&child.exitCode===null){child.kill();await child.exited}rmSync(dataDir,{recursive:true,force:true})}
+ });
+}
+
+}
```

---

### Incident Patch 14: `28b47735` (2026-10-05)
**Commit Message**: fix(chroma): verify row fragments during watermark bootstrap (#4447)

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/sync/ChromaSync.ts` (modified, +42/-15)
```diff
@@ -15,6 +15,7 @@ import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js
 import { USER_SETTINGS_PATH, paths } from '../../shared/paths.js';
 import { normalizePlatformSource } from '../../shared/platform-source.js';
 import type * as SqliteFilesModule from '../sqlite/observations/files.js';
+import { streamRows } from '../sqlite/stream-rows.js';
 
 type SessionStore = SessionStoreType;
 
@@ -1053,6 +1054,7 @@ export class ChromaSync {
     observations: Set<number>;
     summaries: Set<number>;
     prompts: Set<number>;
+    documents: Set<string>;
   }> {
     await this.ensureCollectionExists();
 
@@ -1061,6 +1063,7 @@ export class ChromaSync {
     const observationIds = new Set<number>();
     const summaryIds = new Set<number>();
     const promptIds = new Set<number>();
+    const documentIds = new Set<string>();
 
     let offset = 0;
     const limit = 1000; 
@@ -1076,6 +1079,7 @@ export class ChromaSync {
         include: ['metadatas']
       }) as any;
 
+      for (const id of result?.ids ?? []) documentIds.add(id);
       const metadatas = result?.metadatas || [];
 
       if (metadatas.length === 0) {
@@ -1112,32 +1116,55 @@ export class ChromaSync {
       total: observationIds.size + summaryIds.size + promptIds.size
     });
 
-    return { observations: observationIds, summaries: summaryIds, prompts: promptIds };
+    return { observations: observationIds, summaries: summaryIds, prompts: promptIds, documents: documentIds };
   }
 
   async bootstrapWatermarksFromChroma(project: string, store: SessionStore): Promise<void> {
     const existing = await this.getExistingChromaIds(project);
-    const observationIds = store.db.prepare(`
-      SELECT id
-      FROM observations
-      WHERE project = ?
-      ORDER BY id ASC
-    `).all(project) as Array<{ id: number }>;
-    const summaryIds = store.db.prepare(`
-      SELECT id
-      FROM session_summaries
-      WHERE project = ?
-      ORDER BY id ASC
-    `).all(project) as Array<{ id: number }>;
+    // A row can span several Chroma documents. Seeing one fragment is not
+    // proof the others landed before a restart or a lost watermark file.
+    // Stream source rows so checking completeness does not materialize the
+    // whole project's text in memory.
+    const completeRows = <T extends { id: number }>(
+      sql: string,
+      existingIds: Set<number>,
+      format: (row: T) => ChromaDocument[],
+    ): { sourceIds: number[]; completeIds: Set<number> } => {
+      const sourceIds: number[] = [];
+      const completeIds = new Set<number>();
+      const statement = store.db.prepare(sql);
+      try {
+        for (const row of streamRows(statement, project) as Iterable<T>) {
+          sourceIds.push(row.id);
+          if (!existingIds.has(row.id)) continue;
+          if (format(row).every(document => existing.documents.has(document.id))) {
+            completeIds.add(row.id);
+          }
+        }
+      } finally {
+        statement.finalize();
+      }
+      return { sourceIds, completeIds };
+    };
+    const observationRows = completeRows<StoredObservation>(
+      'SELECT o.* FROM observations o WHERE o.project = ? ORDER BY o.id ASC',
+      existing.observations,
+      row => this.formatObservationDocs(row),
+    );
+    const summaryRows = completeRows<StoredSummary>(
+      'SELECT * FROM session_summaries WHERE project = ? ORDER BY id ASC',
+      existing.summaries,
+      row => this.formatSummaryDocs(row),
+    );
     const promptIds = store.db.prepare(`
       SELECT up.id
       FROM user_prompts up
       JOIN sdk_sessions s ON up.session_db_id = s.id
       WHERE s.project = ?
       ORDER BY up.id ASC
     `).all(project) as Array<{ id: number }>;
-    const observationBootstrap = this.summarizeBootstrapPending(observationIds.map(row => row.id), existing.observations);
-    const summaryBootstrap = this.summarizeBootstrapPending(summaryIds.map(row => row.id), existing.summaries);
+    const observationBootstrap = this.summarizeBootstrapPending(observationRows.sourceIds, observationRows.completeIds);
+    const summaryBootstrap = this.summarizeBootstrapPending(summaryRows.sourceIds, summaryRows.completeIds);
     const promptBootstrap = this.summarizeBootstrapPending(promptIds.map(row => row.id), existing.prompts);
 
     ChromaSyncState.replace(project, {
```

**File**: `tests/services/sync/chroma-bootstrap-fragments.test.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import { describe, expect, it } from 'bun:test';
+import { mkdtempSync, rmSync } from 'node:fs';
+import { tmpdir } from 'node:os';
+import { join } from 'node:path';
+
+const fixture = String.raw`
+  import { SessionStore } from './src/services/sqlite/SessionStore.ts';
+  import { ChromaSync } from './src/services/sync/ChromaSync.ts';
+  import { ChromaSyncState } from './src/services/sync/ChromaSyncState.ts';
+  import { ChromaMcpManager } from './src/services/sync/ChromaMcpManager.ts';
+  const store = new SessionStore(':memory:');
+  const session = store.createSDKSession('host', 'project', 'prompt');
+  store.updateMemorySessionId(session, 'observer');
+  const partial = store.storeObservation('observer', 'project', { type: 'discovery', title: 'Partial observation', subtitle: null, narrative: 'Present narrative', facts: ['Missing fact'], concepts: [], files_read: [], files_modified: [] }, 1);
+  const complete = store.storeObservation('observer', 'project', { type: 'discovery', title: 'Complete observation', subtitle: null, narrative: 'Already present', facts: [], concepts: [], files_read: [], files_modified: [] }, 2);
+  const summary = (request, completed) => ({ request, investigated: '', learned: '', completed, next_steps: '', notes: null });
+  const partialSummary = store.storeObservations('observer', 'project', [], summary('Present request', 'Missing completion'), 1).summaryId;
+  const completeSummary = store.storeObservations('observer', 'project', [], summary('Already present request', ''), 2).summaryId;
+  const written = [];
+  const indexed = new Set(['obs_' + partial.id + '_narrative', 'obs_' + complete.id + '_narrative', 'summary_' + partialSummary + '_request', 'summary_' + completeSummary + '_request']);
+  const manager = ChromaMcpManager.getInstance();
+  manager.acceptsMutations = () => true;
+  manager.callTool = async (tool, args) => {
+    if (tool === 'chroma_get_documents') {
+      if (args.offset > 0) return { ids: [], metadatas: [] };
+      return { ids: [...indexed], metadatas: [...[partial, complete].map(row => ({ sqlite_id: row.id, doc_type: 'observation' })), ...[partialSummary, completeSummary].map(id => ({ sqlite_id: id, doc_type: 'session_summary' }))] };
+    }
+    if (tool === 'chroma_add_documents') { written.push(...args.ids); for (const id of args.ids) indexed.add(id); }
+    return {};
+  };
+  const sync = new ChromaSync('claude-mem');
+  await sync.bootstrapWatermarksFromChroma('project', store);
+  const before = ChromaSyncState.getPending('project', 'observations');
+  const beforeSummaries = ChromaSyncState.getPending('project', 'summaries');
+  const outcome = await sync.ensureBackfilled('project', store);
+  console.log(JSON.stringify({ before, beforeSummaries, partialSummary, completeSummary, outcome, partial: partial.id, complete: complete.id, written, after: ChromaSyncState.getPending('project', 'observations'), factPresent: indexed.has('obs_' + partial.id + '_fact_0') }));
+  store.close();
+`;
+
+describe('Chroma bootstrap fragment completeness', () => {
+  it('repairs a partially indexed row without re-indexing a complete row', () => {
+    const dir = mkdtempSync(join(tmpdir(), 'chroma-bootstrap-fragments-'));
+    try {
+      const run = Bun.spawnSync([process.execPath, '-e', fixture], {
+        cwd: join(import.meta.dir, '../../..'),
+        env: { ...process.env, CLAUDE_MEM_DATA_DIR: join(dir, 'data'), CLAUDE_CONFIG_DIR: join(dir, 'config') }, stdout: 'pipe', stderr: 'pipe',
+      });
+      if (run.exitCode !== 0) throw new Error(new TextDecoder().decode(run.stderr));
+      const result = JSON.parse(new TextDecoder().decode(run.stdout).trim().split('\n').at(-1)!);
+      expect(result.before).toEqual([result.partial]);
+      expect(result.beforeSummaries).toEqual([result.partialSummary]);
+      expect(result.written).toContain('summary_' + result.partialSummary + '_completed');
+      expect(result.written).not.toContain('summary_' + result.completeSummary + '_request');
+      expect(result.outcome).toBe('completed');
+      expect(result.factPresent).toBe(true);
+      expect(result.written).toContain('obs_' + result.partial + '_fact_0');
+      expect(result.written).not.toContain('obs_' + result.complete + '_narrative');
+      expect(result.after).toEqual([]);
+    } finally { rmSync(dir, { recursive: true, force: true }); }
+  });
+});
```

**File**: `tests/services/sync/chroma-sync-watermarks.test.ts` (modified, +2/-0)
```diff
@@ -32,6 +32,7 @@ mock.module('../../../src/services/sync/ChromaMcpManager.js', () => ({
           }
 
           return {
+            ids: [...existingObservationIds].sort((a, b) => a - b).map(id => `obs_${id}_narrative`),
             metadatas: [...existingObservationIds].sort((a, b) => a - b).map(sqliteId => ({
               sqlite_id: sqliteId,
               doc_type: 'observation',
@@ -177,6 +178,7 @@ function makeStoreFromRows(
 
             return [];
           },
+          finalize: () => {},
           get: (...params: Array<string | number>) => {
             if (query.includes('COUNT(*) as count FROM observations')) {
               return { count: observationRows.length };
```

---

### Incident Patch 15: `38870f14` (2026-10-05)
**Commit Message**: fix(work-state): include lists from adopted projects in recall (#4441)

* fix(work-state): include lists from adopted projects in recall

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(work-state): preserve each source project list identity

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* fix(work-state): fold checkout aliases within their logical scope

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

* test(work-state): model explicit checkout aliases in welcome fixture

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>

---------

Signed-off-by: Rudy Celekli <[REDACTED_EMAIL]>
Co-authored-by: Alex Newman <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/services/context/sections/WorkStateRenderer.ts` (modified, +19/-6)
```diff
@@ -100,15 +100,28 @@ export function renderWorkStateList(
 /** Lines for every list in `entries`, the most recently written list first. */
 export function renderWorkStateLines(entries: WorkStateEntry[], nowEpoch: WorkStateClock, includeClosed: boolean = false): string[] {
   const entriesByList = new Map<string, WorkStateEntry[]>();
+  const listProjectCounts = new Map<string, number>();
   for (const entry of entries) {
-    const listEntries = entriesByList.get(entry.list_name) ?? [];
+    // Checkout aliases share one list; adopted source projects keep separate lists.
+    const projectKey = (entry.scope_project ?? entry.project).replace(/[A-Z]/g, character => character.toLowerCase());
+    const key = JSON.stringify([projectKey, entry.list_name]);
+    let listEntries = entriesByList.get(key);
+    if (!listEntries) {
+      listEntries = [];
+      entriesByList.set(key, listEntries);
+      listProjectCounts.set(entry.list_name, (listProjectCounts.get(entry.list_name) ?? 0) + 1);
+    }
     listEntries.push(entry);
-    entriesByList.set(entry.list_name, listEntries);
   }
-  return [...entriesByList.entries()]
-    .sort(([, a], [, b]) => b[b.length - 1].id - a[a.length - 1].id)
-    .flatMap(([listName, listEntries]) =>
-      renderWorkStateList(listName, foldWorkStateList(listEntries), nowEpoch, includeClosed));
+  return [...entriesByList.values()]
+    .sort((a, b) => b[b.length - 1].id - a[a.length - 1].id)
+    .flatMap(listEntries => {
+      const first = listEntries[0];
+      const label = (listProjectCounts.get(first.list_name) ?? 0) > 1
+        ? `${first.list_name} [${first.scope_project ?? first.project}]`
+        : first.list_name;
+      return renderWorkStateList(label, foldWorkStateList(listEntries), nowEpoch, includeClosed);
+    });
 }
 
 /** The SessionStart section: the rule, then what is still open, cut to `characterLimit`. */
```

**File**: `src/services/sqlite/SessionStore.ts` (modified, +9/-1)
```diff
@@ -3025,7 +3025,15 @@ export class SessionStore {
   }
 
   getWorkStateEntries(projects: string[], listName?: string): WorkStateEntry[] {
-    return getWorkStateEntriesRows(this.db, projects, listName);
+    const entries = getWorkStateEntriesRows(this.db, this.getProjectReadKeys(projects), listName);
+    // Keys explicitly supplied by the checkout describe one list history.
+    // Adopted projects discovered by getProjectReadKeys retain their own scope.
+    const foldKey = (key: string) => key.replace(/[A-Z]/g, character => character.toLowerCase());
+    const aliases = new Set(projects.map(foldKey));
+    const primary = projects.at(-1);
+    return entries.map(entry => primary && aliases.has(foldKey(entry.project))
+      ? { ...entry, scope_project: primary }
+      : entry);
   }
 
   countToolUses(filters: ToolUseQueryFilters = {}): Array<{ tool_name: string; uses: number }> {
```

**File**: `src/services/sqlite/work-state.ts` (modified, +2/-0)
```diff
@@ -19,6 +19,8 @@ export type WorkStateFields = Record<string, WorkStateValue>;
 export interface WorkStateEntry {
   id: number;
   project: string;
+  /** Logical checkout key shared by its configured, legacy and parent read aliases. */
+  scope_project?: string;
   list_name: string;
   fields: WorkStateFields;
   created_at_epoch: number;
```

**File**: `tests/worker/http/routes/search-routes-welcome-hint.test.ts` (modified, +5/-1)
```diff
@@ -366,7 +366,11 @@ describe('SearchRoutes Welcome Hint', () => {
       countQueryStub = mock(() => ({ count: 7 }));
       prepareStub = mock(() => ({ get: countQueryStub }));
       mockSessionStore = { db: { prepare: prepareStub }, getWorkStateEntries: workStateEntriesStub };
-      workStateEntriesStub.mockImplementation(releaseEntries);
+      // Both request keys are checkout aliases. Match the scope annotation
+      // supplied by SessionStore.getWorkStateEntries for those explicit keys.
+      workStateEntriesStub.mockImplementation(() => releaseEntries().map(entry => ({
+        ...entry, scope_project: '/path/worktree',
+      })));
       const handler = captureContextInjectHandler(new SearchRoutes({ getSessionStore: () => mockSessionStore } as any));
       const res = createMockRes();
 
```

**File**: `tests/worker/http/routes/work-state-routes.test.ts` (modified, +64/-1)
```diff
@@ -12,9 +12,11 @@ import {
   MAX_WORK_STATE_FIELDS_JSON_CHARS,
   WorkStateRoutes,
 } from '../../../../src/services/worker/http/routes/WorkStateRoutes.js';
-import { WORK_STATE_SECTION_CHARACTER_LIMIT } from '../../../../src/services/context/sections/WorkStateRenderer.js';
+import { buildWorkStateContextSection, WORK_STATE_SECTION_CHARACTER_LIMIT } from '../../../../src/services/context/sections/WorkStateRenderer.js';
 import { SessionStore } from '../../../../src/services/sqlite/SessionStore.js';
 import { getProjectContext } from '../../../../src/utils/project-name.js';
+import { SearchRoutes } from '../../../../src/services/worker/http/routes/SearchRoutes.js';
+import { ModeManager } from '../../../../src/services/domain/ModeManager.js';
 import { logger } from '../../../../src/utils/logger.js';
 
 let server: Server | undefined;
@@ -38,6 +40,8 @@ beforeEach(async () => {
   const app = express();
   app.use(express.json());
   new WorkStateRoutes({ getSessionStore: () => store } as any).setupRoutes(app);
+  ModeManager.getInstance().loadMode('code');
+  new SearchRoutes({ getSessionStore: () => store } as any).setupRoutes(app);
   await new Promise<void>((resolve, reject) => {
     server = app.listen(0, '127.0.0.1', () => {
       const addr = server!.address();
@@ -54,6 +58,7 @@ beforeEach(async () => {
 afterEach(async () => {
   loggerSpies.forEach(spy => spy.mockRestore());
   delete process.env.CLAUDE_MEM_EXCLUDED_PROJECTS;
+  delete process.env.CLAUDE_MEM_PROJECT_ENVIRONMENTS;
   await new Promise<void>((resolve, reject) => {
     if (!server) {
       resolve();
@@ -79,6 +84,24 @@ function read(query: Record<string, string>): Promise<Response> {
 }
 
 describe('WorkStateRoutes', () => {
+  it('reads open work state from a project adopted into the checkout', async () => {
+    const adoptedProject = `${project}-merged-worktree`;
+    const session = store.createSDKSession('adopted-host', adoptedProject, 'prompt');
+    store.updateMemorySessionId(session, 'adopted-observer');
+    store.storeObservation('adopted-observer', adoptedProject, {
+      type: 'discovery', title: 'Adopted finding', subtitle: null, narrative: null,
+      facts: [], concepts: [], files_read: [], files_modified: [],
+    });
+    store.db.prepare('UPDATE observations SET merged_into_project = ? WHERE project = ?').run(project, adoptedProject);
+    store.appendWorkStateEntry({ project: adoptedProject, listName: 'release', fields: { task: 'finish migration', status: 'doing' } });
+
+    const response = await read({ cwd: checkout });
+    expect(response.status).toBe(200);
+    expect(await response.text()).toContain('[doing] finish migration');
+    expect(store.getWorkStateEntries([project]).map(entry => entry.project)).toEqual([adoptedProject]);
+    expect(store.getWorkStateEntries(['unrelated-project'])).toEqual([]);
+  });
+
   it("saves an entry under the checkout's project and answers with what is still open in the list", async () => {
     await write({ cwd: checkout, list: 'release', fields: { version: '13.25.2', blocked_on: 'npm token' } });
     await write({ cwd: checkout, list: 'release', fields: { task: 'tag', status: 'done' } });
@@ -160,6 +183,46 @@ describe('WorkStateRoutes', () => {
     ].join('\n'));
   });
 
+  it('keeps same-name tasks and list state distinct across adopted projects', async () => {
+    const oldProject = 'adopted-project';
+    const sessionId = store.createSDKSession('adopted-host', oldProject, 'prompt');
+    store.updateMemorySessionId(sessionId, 'adopted-observer');
+    const observation = store.storeObservation('adopted-observer', oldProject, { type: 'discovery', title: 'Adopted worktree', subtitle: null, narrative: 'Fact', facts: [], concepts: [], files_read: [], files_modified: [] });
+    store.db.prepare('UPDATE observations SET merged_into_project = ? WHERE id = ?').run(project, observation.id);
+    store.appendWorkStateEntry({ project, listName: 'release', fields: { task: 'ship', status: 'todo', owner: 'active' } });
+    store.appendWorkStateEntry({ project: oldProject, listName: 'release', fields: { task: 'ship', status: 'done', owner: 'adopted' } });
+    store.appendWorkStateEntry({ project: oldProject, listName: 'release', fields: { task: 'pack', status: 'doing' } });
+    const entries = store.getWorkStateEntries([project]);
+    const context = buildWorkStateContextSection(entries, Date.now());
+    const response = await (await read({ cwd: checkout, list: 'release' })).text();
+    for (const text of [context, response]) {
+      expect(text).toContain('[todo] ship (owner=active)');
+      expect(text).toContain('[doing] pack');
+      expect(text).not.toContain('[done] ship');
+      expect(text).toContain(`release [${project}]`);
+      expect(text).toContain(`release [${oldProject}]`);
+    }
+    const closed = await (await read({ cwd: checkout, list: 'release', includeClosed: 'true' })).text();
+    expect(closed).toContain('[todo] ship (owner=active)');
```

#### Recent Merged Pull Requests:
- **PR #4458** (2026-10-05): fix(smart-read): retain scoped partial Ruby method searches (@rudycelekli)
- **PR #4457** (2026-10-05): fix(cost-report): explain how to install missing timezone data (@rahul05ranjan)
- **PR #4454** (2026-10-05): fix(viewer): keep pagination requests owned by their feed visit (@rudycelekli)
- **PR #4452** (2026-10-05): fix(openclaw): bracket IPv6 worker addresses in URLs (@rudycelekli)
- **PR #4451** (2026-10-05): test(viewer): give the pagination browser tests time for a cold Chrome start (@thedotmack)
- **PR #4450** (2026-10-05): fix(gemini): rotate refused keys reported as HTTP 400 (@rudycelekli)
- **PR #4449** (2026-10-05): fix(gemini): reserve pacing slots before concurrent waits (@rudycelekli)
- **PR #4448** (2026-10-05): test(viewer): separate pagination assertions from browser startup (@rudycelekli)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
