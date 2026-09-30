# Forensic Learning Record (Deep Inspection): Agents365-ai/drawio-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/agents365-ai-drawio-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agents365-ai/drawio-skill](https://github.com/Agents365-ai/drawio-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:37:12.950Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agents365-ai/drawio-skill`
- **Description**: Agent skill that turns natural language, code, Terraform/K8s, SQL, OpenAPI, AsyncAPI, Protobuf and GraphQL sources into editable, tested draw.io architecture diagrams: incremental sync, multi-view projection, drift diff, CI architecture tests, whiteboard derasterize, interactive HTML/PPTX/Mermaid exports.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9774 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/architecture-studio/codebase/checkout/__init__.py`
```
"""Tiny checkout package used by the Architecture Studio showcase."""

from checkout.gateway import handle_checkout

__all__ = ["handle_checkout"]

```

### Core Architecture Module: `examples/architecture-studio/codebase/checkout/gateway.py`
```
"""HTTP-facing checkout entrypoint."""

from checkout.orders import place_order


def handle_checkout(cart):
    return place_order(cart)

```

### Core Architecture Module: `examples/architecture-studio/codebase/checkout/orders.py`
```
"""Order orchestration."""

from checkout.payments import authorize
from checkout.persistence import save_order


def place_order(cart):
    authorization = authorize(cart)
    return save_order(cart, authorization)

```

### Core Architecture Module: `examples/architecture-studio/codebase/checkout/payments.py`
```
"""Payment adapter."""


def authorize(cart):
    return {"status": "authorized", "total": len(cart)}

```

### Core Architecture Module: `examples/architecture-studio/codebase/checkout/persistence.py`
```
"""Persistence adapter."""


def save_order(cart, authorization):
    return {"items": cart, "authorization": authorization}

```

### Core Architecture Module: `examples/architecture-studio/generate.py`
```
#!/usr/bin/env python3
"""Regenerate the drawio-skill 3.0 showcase artifacts."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DIAGRAMCTL = ROOT / "skills" / "drawio-skill" / "scripts" / "diagramctl.py"
VALIDATE = ROOT / "skills" / "drawio-skill" / "scripts" / "validate.py"


def run(*args: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(DIAGRAMCTL), *(str(arg) for arg in args)],
        check=True,
        text=True,
        capture_output=True,
    )


def manually_tune(path: Path) -> None:
    tree = ET.parse(path)
    holder = next(
        cell for cell in tree.getroot().iter() if cell.get("data-model-id") == "orders"
    )
    cell = holder.find("mxCell") if holder.tag == "UserObject" else holder
    if cell is None:
        raise RuntimeError("orders cell has no mxCell")
    holder.set("value" if holder.tag == "mxCell" else "label", "Orders (manual)")
    holder.set("data-properties", json.dumps({"owner": "platform-ops"}))
    cell.set("style", (cell.get("style") or "") + "shadow=1;strokeWidth=3;")
    geometry = cell.find("mxGeometry")
    if geometry is None:
        raise RuntimeError("orders cell has no geometry")
    geometry.set("x", "720")
    geometry.set("y", "210")
    ET.indent(tree.getroot(), space="  ")
    tree.write(path, encoding="unicode", xml_declaration=False)
    with path.open("a", encoding="utf-8") as stream:
        stream.write("\n")


def validate(path: Path) -> None:
    subprocess.run(
        [sys.executable, str(VALIDATE), str(path), "--strict"],
        check=True,
        text=True,
        capture_output=True,
    )


def write_json(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=HERE / "generated")
    args = parser.parse_args()
    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)

    run(
        "build",
        HERE / "codebase",
        "--from",
        "python",
        "--group",
        "--title",
        "Checkout codebase",
        "--ir-output",
        out / "codebase.ir.json",
        "-o",
        out / "codebase.drawio",
    )
    code_ir_path = out / "codebase.ir.json"
    code_ir = json.loads(code_ir_path.read_text(encoding="utf-8"))
    code_ir["metadata"]["created"] = "2026-09-01T00:00:00+00:00"
    code_ir["metadata"]["source"] = "examples/architecture-studio/codebase"
    for node in code_ir["nodes"]:
        node.get("provenance", {})["path"] = "examples/architecture-studio/codebase"
    write_json(code_ir_path, code_ir)
    run(
        "build",
        code_ir_path,
        "--from",
        "ir",
        "-o",
        out / "codebase.drawio",
    )

    run(
        "build",
        HERE / "sync-baseline.ir.json",
        "--from",
        "ir",
        "-o",
        out / "manual-layout.drawio",
    )
    manually_tune(out / "manual-layout.drawio")
    result = run(
        "sync",
        out / "manual-layout.drawio",
        HERE / "sync-source-v2.ir.json",
        "--from",
        "ir",
        "-o",
        out / "reconciled.drawio",
    )
    sync_result = json.loads(result.stdout)
    sync_result["output"] = "generated/reconciled.drawio"
    write_json(out / "sync-result.json", sync_result)

    model = HERE / "checkout.ir.json"
    run(
        "views",
        model,
        "--views",
        "executive,system,deployment,dataflow,security",
        "-o",
        out / "checkout-views.drawio",
    )
    run(
        "test",
        model,
        "--rules",
        HERE / "policy.yml",
        "-o",
        out / "policy-result.json",
    )
    run(
        "whatif",
        model,
        "--fail",
        "orders",
        "--drawio",
        out / "checkout-failure.drawio",
        "-o",
        out / "impact.json",
    )
    impact_path = out / "impact.json"
    impact = json.loads(impact_path.read_text(encoding="utf-8"))
    impact["drawio"] = "generated/checkout-failure.drawio"
    write_json(impact_path, impact)
    run(
        "story",
        model,
        "--fail",
        "orders",
        "--title",
        "Checkout failure walkthrough",
        "-o",
        out / "checkout-story.html",
    )

    for path in out.glob("*.drawio"):
        validate(path)
    print(f"generated showcase in {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `skills/drawio-skill/scripts/aiicons.py`
```
#!/usr/bin/env python3
"""Find AI / LLM brand logos (OpenAI, Claude, Gemini, ...) as draw.io styles.

draw.io's bundled shape libraries have no modern AI/LLM brand logos, so an
"LLM app architecture" renders as generic boxes. This resolves a brand name to a
draw.io `image` style that references the matching SVG from the lobe-icons set
(https://github.com/lobehub/lobe-icons, MIT) on the unpkg CDN.

  python3 aiicons.py "openai"
  python3 aiicons.py "claude" --json
  python3 aiicons.py "langchain" --variant mono --size 48

The icon is referenced by URL (data/lobe-icons.json carries only the name list,
not the assets), so draw.io fetches it from the CDN when the diagram is rendered
or opened. That means **network is required at render time**; an offline export
draws a blank box. Use --embed to fetch the SVG once and inline it as a
self-contained data URI instead (portable, no network at render time).

The logos are trademarks of their respective owners and are referenced here for
identification only — the same basis on which draw.io ships AWS/Azure icons.

Usage: python3 aiicons.py <query> [--limit N] [--variant color|mono|text]
                                  [--size PX] [--embed] [--json] [--list]
"""
import argparse
import base64
import json
import os
import re
import sys
import urllib.parse
import urllib.request

MANIFEST = os.path.join(os.path.dirname(__file__), "..", "data", "lobe-icons.json")
STYLE = ("shape=image;html=1;imageAspect=0;aspect=fixed;"
         "verticalLabelPosition=bottom;verticalAlign=top;image=")
_VARIANT = re.compile(r"-(?:color|text(?:-[a-z]{2})?|brand(?:-color)?)$")

# Common RAG/LLM data stores that lobe-icons lacks, mapped to simple-icons
# slugs (https://simpleicons.org, CC0). Served from the simple-icons CDN. Each
# slug below is verified to return HTTP 200 at https://cdn.simpleicons.org/<slug>.
_SIMPLEICONS_CDN = "https://cdn.simpleicons.org/"
_ALLOWED_HOSTS = {"unpkg.com", "cdn.simpleicons.org"}
_SUPPLEMENT = {
    "qdrant": "qdrant",
    "milvus": "milvus",
    "supabase": "supabase",
    "redis": "redis",
    "postgresql": "postgresql",
    "mongodb": "mongodb",
    "elasticsearch": "elasticsearch",
    "neo4j": "neo4j",
    "kafka": "apachekafka",
    "clickhouse": "clickhouse",
    "duckdb": "duckdb",
    "mysql": "mysql",
    "sqlite": "sqlite",
    "cassandra": "apachecassandra",
    "snowflake": "snowflake",
    "databricks": "databricks",
    "mariadb": "mariadb",
    "couchbase": "couchbase",
}


def families(icons):
    """base brand name -> set of its variant filenames (without .svg)."""
    fam = {}
    for name in icons:
        base = _VARIANT.sub("", name)
        fam.setdefault(base, set()).add(name)
    return fam


def squish(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def safe_url(url):
    """Reject a tampered manifest before emitting or fetching its URL."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in _ALLOWED_HOSTS:
        raise ValueError(f"refusing icon URL outside allowlist: {url}")
    return url


def fetch(url):
    return urllib.request.urlopen(safe_url(url), timeout=15).read()


def search(fam, query, limit):
    """Rank brand bases against the query (squished + per-token matching)."""
    q = squish(query)
    tokens = [t for t in re.findall(r"[a-z0-9]+", query.lower()) if t]
    scored = {}
    for base in fam:
        b = squish(base)
        s = 0
        if q and q == b:
            s = 100
        elif q and b.startswith(q):
            s = 60
        elif q and q in b:
            s = 40
        for t in tokens:
            if t == b:
                s = max(s, 90)
            elif len(t) >= 3 and b.startswith(t):
                s = max(s, 50)
            elif len(t) >= 3 and t in b:
                s = max(s, 30)
        if s:
            scored[base] = s
    return sorted(scored, key=lambda base: (-scored[base], base))[:limit]


def search_supplement(query):
    """Fall back to the simple-icons supplement (exact or substring match)."""
    q = squish(query)
    if not q:
        return None
    if q in _SUPPLEMENT:
        return q
    for brand in _SUPPLEMENT:
        if q in brand or brand in q:
            return brand
    return None


def pick_variant(base, variants, prefer):
    order = {"color": ["-color", "-brand-color", "", "-brand", "-text", "-text-cn"],
             "mono":  ["", "-brand", "-color", "-brand-color", "-text", "-text-cn"],
             "text":  ["-text", "-text-cn", "-brand", "-brand-color", "-color", ""]}[prefer]
    for suffix in order:
        cand = base + suffix
        if cand in variants:
            return cand
    return next(iter(sorted(variants)), None)


def main():
    ap = argparse.ArgumentParser(description="Find AI/LLM brand logos as draw.io styles (lobe-icons via CDN).")
    ap.add_argument("query", nargs="?", help='brand name, e.g. "openai" or "claude"')
    ap.add_argument("--limit", type=int, default=8)
    ap.add_argument("--variant", choices=["color", "mono", "text"], default="color")
    ap.add_argument("--size", type=int, default=48, help="cell width/height in px (icons are square)")
    ap.add_argument("--embed", action="store_true",
                    help="inline the SVG as a data URI (fetches it now; portable, no network at render time)")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--list", action="store_true", help="list all brand names and exit")
    args = ap.parse_args()

    if not os.path.exists(MANIFEST):
        sys.exit(f"error: manifest not found at {MANIFEST}")
    with open(MANIFEST, encoding="utf-8") as f:
        manifest = json.load(f)
    fam = families(manifest["icons"])
    cdn = safe_url(manifest["cdn"])

    if args.list:
        for base in sorted(fam):
            print(base)
        return
    if not args.query:
        ap.error("a query is required (or use --list)")

    matches = search(fam, args.query, args.limit)

    results = []
    if matches:
        for base in matches:
            file = pick_variant(base, fam[base], args.variant)
            url = f"{cdn}{file}.svg"
            if args.embed:
                try:
                    svg = fetch(url)
                except Exception as exc:                   # noqa: BLE001 - report and skip
                    sys.stderr.write(f"warning: could not fetch {url} ({exc})\n")
                    continue
                # Rewrite the 1em intrinsic size so draw.io scales the inlined SVG.
                svg = svg.replace(b'width="1em"', b'width="24"').replace(b'height="1em"', b'height="24"')
                # Marker-less base64: draw.io splits style values on ';', so a
                # ';base64,' marker would truncate the image= value (issue #80).
                image = "data:image/svg+xml," + base64.b64encode(svg).decode()
            else:
                image = url
            results.append({"brand": base, "file": file, "w": args.size, "h": args.size,
                            "style": STYLE + image})
    else:
        # lobe has no logo for this brand; fall back to the simple-icons supplement.
        brand = search_supplement(args.query)
        if brand:
            slug = _SUPPLEMENT[brand]
            url = _SIMPLEICONS_CDN + slug
            image = url
            if args.embed:
                try:
                    svg = fetch(url)
                    # Marker-less base64 (see issue #80 note above).
                    image = "data:image/svg+xml," + base64.b64encode(svg).decode()
                except Exception as exc:                   # noqa: BLE001 - keep the CDN URL
                    sys.stderr.write(f"warning: could not fetch {url} ({exc}); using CDN URL\n")
            results.append({"brand": brand, "file": f"simpleicons:{slug}",
                            "w": args.size, "h": args.size, "style": STYLE + image})

    if not results:
        sys.exit(f"no logo for {args.query!r} — for a data store try a cylinder "
             
```

### Core Architecture Module: `skills/drawio-skill/scripts/asyncapiimports.py`
```
#!/usr/bin/env python3
"""Turn an AsyncAPI 2/3 spec into an event-driven architecture graph.

Emits autolayout graph JSON with channel, publish/subscribe operation, and
message-payload schema nodes. JSON is supported with the standard library;
YAML additionally requires PyYAML.

Usage: python3 asyncapiimports.py <spec.json|spec.yaml> [-o graph.json]
       [--direction TB|LR] [--group]
"""
import argparse
import json
import os
import sys


CHANNEL_STYLE = (
    "shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;"
    "fillColor=#fff2cc;strokeColor=#d6b656;"
)
PUBLISH_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;"
SUBSCRIBE_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
SCHEMA_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;"
EVENT_EDGE = "edgeStyle=orthogonalEdgeStyle;html=1;rounded=0;fontSize=10;endArrow=open;"
SCHEMA_EDGE = (
    "edgeStyle=orthogonalEdgeStyle;html=1;rounded=0;fontSize=10;"
    "dashed=1;endArrow=open;strokeColor=#9673a6;"
)


def load_spec(path):
    """Parse JSON directly and YAML through the optional PyYAML dependency."""
    # pi-lens-ignore: ast-grep:unchecked-throwing-call-python
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    if path.lower().endswith((".yaml", ".yml")):
        try:
            import yaml
        except ImportError:
            sys.exit("error: spec is YAML but PyYAML is not installed (pip install pyyaml)")
        return yaml.safe_load(text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        try:
            import yaml
        except ImportError:
            sys.exit("error: could not parse spec as JSON (install PyYAML to read YAML)")
        return yaml.safe_load(text)


def resolve_ref(spec, ref):
    """Resolve an internal JSON Pointer, returning None for external refs."""
    if not isinstance(ref, str) or not ref.startswith("#/"):
        return None
    value = spec
    try:
        for part in ref[2:].split("/"):
            key = part.replace("~1", "/").replace("~0", "~")
            value = value[key]
    except (KeyError, TypeError):
        return None
    return value


def pointer_token(value):
    """Escape a mapping key for use as a JSON Pointer token."""
    return str(value).replace("~", "~0").replace("/", "~1")


def decode_pointer_token(value):
    return str(value).replace("~1", "/").replace("~0", "~")


def schema_refs(obj, spec, seen=None):
    """Yield component-schema names reachable through messages and payloads."""
    seen = set() if seen is None else seen
    if isinstance(obj, dict):
        ref = obj.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/components/schemas/"):
            name = ref.split("/")[-1].replace("~1", "/").replace("~0", "~")
            yield name
        if isinstance(ref, str) and ref not in seen:
            resolved = resolve_ref(spec, ref)
            if resolved is not None:
                seen.add(ref)
                yield from schema_refs(resolved, spec, seen)
        for key, value in obj.items():
            if key != "$ref":
                yield from schema_refs(value, spec, seen)
    elif isinstance(obj, list):
        for value in obj:
            yield from schema_refs(value, spec, seen)


def first_tag(obj):
    tags = obj.get("tags") if isinstance(obj, dict) else None
    if not isinstance(tags, list) or not tags:
        return None
    tag = tags[0]
    return tag.get("name") if isinstance(tag, dict) else str(tag)


def channel_group(name, channel):
    """Prefer a channel tag, falling back to the address/name prefix."""
    tag = first_tag(channel)
    if tag:
        return tag
    address = str(channel.get("address") or name).strip("/")
    return address.split("/", 1)[0] or "root"


def build(spec, group=False, direction="LR"):
    """Convert an AsyncAPI 2 or 3 mapping to autolayout graph JSON."""
    channels = spec.get("channels") or {}
    schemas = (spec.get("components") or {}).get("schemas") or {}
    nodes, edges, edge_keys = [], [], set()
    channel_ids = {name: f"channel:{name}" for name in channels}
    schema_ids = {name: f"schema:{name}" for name in schemas}

    def add_edge(source, target, label="", style=EVENT_EDGE, pointer=None):
        key = (source, target, label)
        if source == target or key in edge_keys:
            return
        edge_keys.add(key)
        edge = {"source": source, "target": target, "label": label, "style": style}
        if pointer:
            edge["provenance"] = {"pointer": pointer}
        edges.append(edge)

    for name, raw_channel in channels.items():
        channel = raw_channel if isinstance(raw_channel, dict) else {}
        address = str(channel.get("address") or name)
        node = {
            "id": channel_ids[name],
            "label": address,
            "style": CHANNEL_STYLE,
            "width": max(150, 8 * len(address) + 24),
            "height": 50,
            "provenance": {"pointer": f"#/channels/{pointer_token(name)}"},
        }
        if group:
            node["group"] = channel_group(name, channel)
        nodes.append(node)

    operations = []
    # AsyncAPI 2 keeps publish/subscribe operations under each channel.
    for channel_name, raw_channel in channels.items():
        channel = raw_channel if isinstance(raw_channel, dict) else {}
        for action in ("publish", "subscribe"):
            operation = channel.get(action)
            if isinstance(operation, dict):
                operations.append(
                    (
                        f"{channel_name}:{action}",
                        action,
                        channel_name,
                        operation,
                        f"#/channels/{pointer_token(channel_name)}/{action}",
                    )
                )

    # AsyncAPI 3 promotes operations to the top level and calls the actions
    # send/receive. A channel is referenced by JSON Pointer.
    for operation_name, raw_operation in (spec.get("operations") or {}).items():
        operation = raw_operation if isinstance(raw_operation, dict) else {}
        action = str(operation.get("action") or "")
        action = {"send": "publish", "receive": "subscribe"}.get(action, action)
        channel_ref = (operation.get("channel") or {}).get("$ref")
        channel_name = (
            decode_pointer_token(channel_ref.split("/")[-1])
            if isinstance(channel_ref, str)
            else None
        )
        if action in ("publish", "subscribe") and channel_name in channels:
            operations.append(
                (
                    operation_name,
                    action,
                    channel_name,
                    operation,
                    f"#/operations/{pointer_token(operation_name)}",
                )
            )

    for operation_name, action, channel_name, operation, pointer in operations:
        operation_id = f"operation:{operation_name}"
        raw_channel = channels[channel_name]
        channel = raw_channel if isinstance(raw_channel, dict) else {}
        # Without a summary or operationId (common in AsyncAPI 2), the channel
        # address reads better than the synthetic "channel:action" name.
        title = (
            operation.get("summary")
            or operation.get("operationId")
            or str(channel.get("address") or channel_name)
        )
        node = {
            "id": operation_id,
            "label": f"{action.upper()}\n{title}",
            "style": PUBLISH_STYLE if action == "publish" else SUBSCRIBE_STYLE,
            "width": max(150, 8 * len(str(title)) + 24),
            "height": 50,
            "provenance": {"pointer": pointer},
        }
        if group:
            node["group"] = first_tag(operation) or channel_group(channel_name, channel)
        nodes.append(node)
        add_edge(operation_id, channel_ids[channel_nam
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8** (2026-05-05): **cc中使用该skill后必定会报400**
  *Symptoms*: 如题，  <img width="1244" height="558" alt="Image" src="https://github.com/user-attachments/assets/968dd84d-d277-4866-bc7a-6dc526b76fa4" />  每次使用该skill均会出现400错误，但png以及draw.io文件均正常生成。esc+esc回退后可以正常对话，但若再次调用该skill则依旧会400。
  **Post-Mortem & Fix Analysis**:
  > 补充：使用的是cc最新版本、官方订阅、opusplan模式。
  > @nasymonk 感谢反馈！这个 bug 在 v1.4.2 已修复，已推到 `main`。  ## 根因  **不是 skill 的 bug，是 draw.io CLI 自身的 bug。** 当传 `-e` 导出 PNG 时，draw.io 写出的文件 IEND chunk 被截断 —— 只写了 4 字节长度域 `00 00 00 00`，缺少 `IEND` type + CRC 共 8 字节。结果：  - Anthropic vision API 拒绝（400 "Could not process image"） - 严格的 PNG 解码器（如 Pillow）也拒绝 - 但 macOS Preview / `file` / ImageMagick 容忍，所以肉眼看 PNG「正常」  之前 SKILL.md 错误地把锅甩给了嵌入的 `zTXt mxGraphModel` chunk —— 实测发现 zTXt 留着、只补回 IEND 8 字节，vision API 就接受了。  ## 修复方案  v1.4.2 在最终导出步骤后加了一段 IEND 修复脚本：  ```bash draw.io -x -f png -e -s 2 -o diagram.drawio.png input.drawio  python3 - "diagram.drawio.png" <<'PY' import sys p = sys.argv[1] data = open(p, 'rb').read() IEND = b'\x00\x00\x00\x00IEND\xaeB`\x82' if not data.endswith(IEND):     if data.endswith(b'\x00\x00\x00\x00'):         data = data[:-4]     open(p, 'wb').write(data + IEND)     print(f"repaired {p}") PY ```  `endswith(IEND)` 守卫让脚本对 draw.io 上游修 bug 后的输出自动 no-op，不会重复破坏。SVG/PDF 不受影响（无 IEND chunk）。  ## 验证  端到端实测： - 同源 `-e` PNG 未修复 → 400 - 同源 `-e` PNG 
  > 跟进：用 v1.4.2 实跑了一次端到端验证 ✅  ## 测试 Prompt  ``` 画一个简单的微服务架构图：一个 API Gateway 把请求路由到 Auth Service、 User Service、Order Service 三个后端，三个服务都连到同一个 PostgreSQL 数据库，Order Service 额外发消息到 RabbitMQ，Notification Worker 从 RabbitMQ 消费。横向布局。 ```  ## 流程走了完整 7 步  1. ✅ Step 1: `draw.io --version` → 29.7.8（macOS） 2. ✅ Step 2-3: 生成 `.drawio` XML（8 节点 + 8 条带标签的边） 3. ✅ Step 4: 预览 PNG 导出（**不带 `-e`**）—— vision API 正常读取 4. ✅ Step 5: vision 自检通过（无形状重叠、无边切割、布局正确） 5. ✅ Step 7: 最终 `-e` PNG 导出 + IEND 修复脚本    - draw.io 输出: 125647 字节（IEND 截断）    - 修复后: 125655 字节（补齐 IEND chunk） 6. ✅ **修复后的 `-e` PNG 再次过 vision API → 完全解析成功**  ## 结果图  ![microservices architecture](https://raw.githubusercontent.com/Agents365-ai/drawio-skill/main/docs/issue-8/microservices.drawio.png)  源文件 + 输出 PNG 已提交到仓库： - `.drawio` 源: [docs/issue-8/microservices.drawio](https://github.com/Agents365-ai/drawio-skill/blob/main/docs/issue-8/microservices.drawio) - `-e` 嵌入 PNG（已修复）: [docs/issue-8/microservices.drawio.png](https://github.com/Agents365-ai/drawio-sk

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

### Incident Patch 1: `ccb3e094` (2026-09-13)
**Commit Message**: fix: fold extend definitions into their base type (#131)

parse_sdl emits one entry per "extend" definition, so a schema with both
"type Foo" and "extend type Foo" produced two nodes with the same id and
diagramctl build failed validation with E-DUP-ID. merge_extends now folds
same-name definitions (fields, implements, union members) into the base
entry before the graph is built, covering extends that arrive from a
different schema file too. The CLI summary line now counts merged types.

Also guards the re.match in the implements scan (Optional per the type
stubs) and adds regression tests for in-file and cross-file extends.

**File**: `skills/drawio-skill/scripts/graphqlerd.py` (modified, +24/-2)
```diff
@@ -218,7 +218,8 @@ def parse_sdl(text, file_path=""):
                 segment = segment[: nxt.start()]
             entry["members"] = [p.strip() for p in segment.split("|") if p.strip()]
         elif kind != "scalar":
-            impl = re.match(r"[^\{\n]*", tail).group(0)
+            impl_m = re.match(r"[^\{\n]*", tail)
+            impl = impl_m.group(0) if impl_m else ""
             if "implements" in impl:
                 after = impl.split("implements", 1)[1].split("@")[0]
                 entry["implements"] = [
@@ -299,6 +300,26 @@ def render(ref):
     return defs
 
 
+def merge_extends(defs):
+    """Fold ``extend`` definitions into their base type.
+
+    GraphQL names are unique within a schema, so two entries sharing a name
+    are a base definition and its extends, possibly across different files.
+    Keeping both would emit two nodes with the same id.
+    """
+    merged, order = {}, []
+    for d in defs:
+        base = merged.get(d["name"])
+        if base is None:
+            merged[d["name"]] = d
+            order.append(d)
+        else:
+            base["fields"].extend(d["fields"])
+            base["implements"].extend(d["implements"])
+            base["members"].extend(d["members"])
+    return order
+
+
 def esc(text):
     """Escape HTML metacharacters for draw.io's html=1 labels.
 
@@ -321,6 +342,7 @@ def compute_dimensions(lines):
 
 def build(defs, group=False, direction="TB", show_types=True):
     """Definition dicts -> autolayout graph JSON."""
+    defs = merge_extends(defs)
     nodes, edges, seen_edges = [], [], set()
     known = {d["name"] for d in defs}
 
@@ -422,7 +444,7 @@ def main():
         sys.stdout.write(text)
 
     counts = {}
-    for d in defs:
+    for d in merge_extends(defs):
         counts[d["kind"]] = counts.get(d["kind"], 0) + 1
     summary = ", ".join("%d %ss" % (counts[k], k) for k in KINDS if k in counts)
     sys.stderr.write("%s, %d edges\n" % (summary, len(graph["edges"])))
```

**File**: `tests/test_graphqlerd.py` (modified, +25/-0)
```diff
@@ -213,6 +213,31 @@ def test_no_types_hides_the_field_types(self):
         self.assertIn("\nf", graph["nodes"][0]["label"])
         self.assertNotIn("String", graph["nodes"][0]["label"])
 
+    def test_extends_merge_into_a_single_node(self):
+        defs = self.importer.parse_sdl(
+            "type Foo { a: Int }\n"
+            "extend type Foo { b: String @deprecated }\n"
+            "interface Bar { c: ID! }\n"
+            "extend interface Bar implements Foo { d: Foo }"
+        )
+        graph = self.importer.build(defs)
+        self.assertEqual([n["id"] for n in graph["nodes"]], ["Foo", "Bar"])
+        labels = dict((n["id"], n["label"]) for n in graph["nodes"])
+        self.assertIn("a: Int", labels["Foo"])
+        self.assertIn("b: String (deprecated)", labels["Foo"])
+        self.assertIn(("Bar", "Foo", "implements"),
+                      set((e["source"], e["target"], e["label"])
+                          for e in graph["edges"]))
+
+    def test_extends_merge_across_schema_files(self):
+        base = self.importer.parse_sdl("union U = A | B\n", file_path="a.graphql")
+        ext = self.importer.parse_sdl("extend union U = C\n", file_path="b.graphql")
+        graph = self.importer.build(base + ext)
+        self.assertEqual([n["id"] for n in graph["nodes"]], ["U"])
+        members = [line for line in graph["nodes"][0]["label"].split("\n")
+                   if line in ("A", "B", "C")]
+        self.assertEqual(members, ["A", "B", "C"])
+
 
 class TestGraphqlErdIntrospection(unittest.TestCase):
     PAYLOAD = {
```

---

### Incident Patch 2: `a12b3a91` (2026-09-11)
**Commit Message**: fix(protoimports): comments in the tokenizer, html-safe labels, detection order

Three review follow-ups on the Protobuf importer:

- Comment handling moved into the tokenizer. Stripping `//` and `/* */`
  with regexes over the raw text cut a `//` inside a string literal, which
  also removed the brace that closed the message, so every message and
  service after a URL in an option or default was dropped silently.
- Node labels go through an HTML escape (the same convention as
  tubemap.py). Without it `map<string, Item>` rendered as `map`: draw.io
  treats `<string, Item>` as an unknown tag because the styles set html=1.
- `detect_source` checked `*.proto` first for a directory, ahead of
  go.mod / Cargo.toml / package.json / *.tf / workflow markers, so
  `diagramctl build ./my-go-service` produced a proto graph instead of the
  Go import graph for any repository that ships a schema. The check now
  runs after those markers.

Tests cover all three, including line numbers across block and trailing
comments and the fact that a directory with only .proto files still
auto-detects as proto.

**File**: `skills/drawio-skill/scripts/diagramctl.py` (modified, +4/-2)
```diff
@@ -81,8 +81,6 @@ def emit(value, output=None):
 def detect_source(path):
     p = Path(path)
     if p.is_dir():
-        if list(p.rglob("*.proto")):
-            return "proto"
         if list(p.rglob("*.tf")):
             return "terraform"
         if (p / "Cargo.toml").exists():
@@ -93,6 +91,10 @@ def detect_source(path):
             return "javascript"
         if (p / ".github" / "workflows").exists() or (p / ".gitlab-ci.yml").exists():
             return "ci"
+        # Last, because a .proto file is often one schema inside a project whose
+        # own language markers above describe the repository better.
+        if list(p.rglob("*.proto")):
+            return "proto"
         return "python"
     suffix = p.suffix.lower()
     if suffix == ".proto":
```

**File**: `skills/drawio-skill/scripts/protoimports.py` (modified, +23/-14)
```diff
@@ -53,6 +53,7 @@
 TOKEN_RE = re.compile(
     r"""
     (?P<STRING>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')
+  | (?P<COMMENT>//[^\n]*|/\*[\s\S]*?\*/)
   | (?P<NUM>-?[0-9]+(?:\.[0-9]+)?)
   | (?P<IDENT>[A-Za-z_][A-Za-z0-9_.]*)
   | (?P<SYM>[{}();=<>:,\[\]])
@@ -71,26 +72,18 @@ def __init__(self, kind, value, line):
         self.line = line
 
 
-def strip_comments(text):
-    def repl_block(m):
-        return "\n" * m.group(0).count("\n")
-
-    text = re.sub(r"/\*.*?\*/", repl_block, text, flags=re.DOTALL)
-    text = re.sub(r"//[^\n]*", "", text)
-    return text
-
-
 def tokenize(text):
     tokens = []
     line = 1
     pos = 0
-    text = strip_comments(text)
+    # Comments are matched by the tokenizer rather than stripped up front, so a
+    # `//` or `/*` inside a string literal (a URL, say) stays part of the string.
     for m in TOKEN_RE.finditer(text):
         kind = m.lastgroup
         val = m.group()
         line += text[pos:m.start()].count("\n")
         pos = m.start()
-        if kind != "WS":
+        if kind not in ("WS", "COMMENT"):
             tokens.append(Token(kind, val, line))
         line += val.count("\n")
         pos = m.end()
@@ -345,6 +338,20 @@ def parse_message(scope=""):
     }
 
 
+def esc(text):
+    """Escape HTML metacharacters for draw.io's html=1 labels.
+
+    Without it a field type such as `map<string, Item>` is swallowed as an
+    unknown HTML tag when draw.io renders the label.
+    """
+    return (
+        text.replace("&", "&amp;")
+        .replace("<", "&lt;")
+        .replace(">", "&gt;")
+        .replace('"', "&quot;")
+    )
+
+
 def compute_dimensions(lines):
     width = max(160, -(-max(7 * len(l) + 30 for l in lines) // 10) * 10)
     height = max(50, -(-(30 + 18 * len(lines)) // 10) * 10)
@@ -431,7 +438,7 @@ def add_edge(src, dst, style, label="", line=0, file_path=""):
             w, h = compute_dimensions(lines)
             node = {
                 "id": s["id"],
-                "label": "\n".join(lines),
+                "label": esc("\n".join(lines)),
                 "style": SERVICE_STYLE,
                 "width": w,
                 "height": h,
@@ -461,7 +468,7 @@ def add_edge(src, dst, style, label="", line=0, file_path=""):
             w, h = compute_dimensions(lines)
             node = {
                 "id": m["id"],
-                "label": "\n".join(lines),
+                "label": esc("\n".join(lines)),
                 "style": MESSAGE_STYLE,
                 "width": w,
                 "height": h,
@@ -488,7 +495,7 @@ def add_edge(src, dst, style, label="", line=0, file_path=""):
             w, h = compute_dimensions(lines)
             node = {
                 "id": e["id"],
-                "label": "\n".join(lines),
+                "label": esc("\n".join(lines)),
                 "style": ENUM_STYLE,
                 "width": w,
                 "height": h,
@@ -521,12 +528,14 @@ def main():
 
     parsed_list = []
     for fpath in files:
+        # pi-lens-ignore: ast-grep:unchecked-throwing-call-python
         with open(fpath, encoding="utf-8", errors="replace") as fh:
             parsed_list.append(parse_proto(fh.read(), file_path=fpath))
 
     graph = build(parsed_list, group=args.group, direction=args.direction)
     text = json.dumps(graph, indent=2, ensure_ascii=False)
     if args.output:
+        # pi-lens-ignore: ast-grep:unchecked-throwing-call-python
         with open(args.output, "w", encoding="utf-8") as fh:
             fh.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
```

**File**: `tests/test_protoimports.py` (modified, +59/-0)
```diff
@@ -9,10 +9,25 @@
 ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
 SCRIPT = os.path.join(ROOT, "skills", "drawio-skill", "scripts", "protoimports.py")
 DIAGRAMCTL = os.path.join(ROOT, "skills", "drawio-skill", "scripts", "diagramctl.py")
+sys.path.insert(0, os.path.dirname(DIAGRAMCTL))
+
+
+def load_bundled(name):
+    """Load a bundled script by path (the scripts directory is not a package)."""
+    path = os.path.join(os.path.dirname(DIAGRAMCTL), name + ".py")
+    spec = importlib.util.spec_from_file_location(name, path)
+    assert spec is not None and spec.loader is not None
+    module = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(module)
+    return module
+
+
+diagramctl = load_bundled("diagramctl")
 
 
 def load_importer():
     spec = importlib.util.spec_from_file_location("protoimports", SCRIPT)
+    assert spec is not None and spec.loader is not None
     module = importlib.util.module_from_spec(spec)
     spec.loader.exec_module(module)
     return module
@@ -127,6 +142,50 @@ def test_nested_messages_enums_and_maps(self):
         self.assertIn(("shop.Cart", "shop.Cart.State"), pairs)
         self.assertIn(("shop.Cart", "shop.Cart.Item"), pairs)
 
+    def test_comments_do_not_swallow_string_literals(self):
+        # A "//" inside a string used to be stripped as a comment, which also
+        # removed the brace that closed the message and dropped the rest of the
+        # file (URLs in options/defaults are the realistic case).
+        proto = '''
+        syntax = "proto3";
+        package demo;
+
+        /* block comment */
+        message Req { string url = 1 [default = "https://example.com/a"]; }
+        message Resp { string ok = 1; }  // trailing comment
+        service DemoService { rpc Get (Req) returns (Resp); }
+        '''
+        parsed = self.importer.parse_proto(proto, "demo.proto")
+        self.assertEqual(["Req", "Resp"], [m["name"] for m in parsed["messages"]])
+        self.assertEqual(["DemoService"], [s["name"] for s in parsed["services"]])
+        # Line numbers stay accurate across the block and trailing comments.
+        self.assertEqual([6, 7], [m["line"] for m in parsed["messages"]])
+
+    def test_map_types_survive_html_label_rendering(self):
+        proto = '''
+        syntax = "proto3";
+        package shop;
+        message Cart { map<string, Item> items = 1; }
+        message Item { string sku = 1; }
+        '''
+        parsed = self.importer.parse_proto(proto, "shop.proto")
+        graph = self.importer.build([parsed])
+        label = next(n for n in graph["nodes"] if n["id"] == "shop.Cart")["label"]
+        self.assertIn("items: map&lt;string, Item&gt;", label)
+
+    def test_directory_detection_keeps_project_language_markers(self):
+        with tempfile.TemporaryDirectory() as td:
+            with open(os.path.join(td, "go.mod"), "w", encoding="utf-8") as f:
+                f.write("module example.com/svc\n")
+            with open(os.path.join(td, "svc.proto"), "w", encoding="utf-8") as f:
+                f.write('syntax = "proto3";\nmessage A {}\n')
+            self.assertEqual("go", diagramctl.detect_source(td))
+
+        with tempfile.TemporaryDirectory() as td:
+            with open(os.path.join(td, "svc.proto"), "w", encoding="utf-8") as f:
+                f.write('syntax = "proto3";\nmessage A {}\n')
+            self.assertEqual("proto", diagramctl.detect_source(td))
+
     def test_cli_reads_file_and_directory(self):
         with tempfile.TemporaryDirectory() as td:
             p1 = os.path.join(td, "user.proto")
```

---

### Incident Patch 3: `de9d6386` (2026-09-11)
**Commit Message**: fix(asyncapiimports): channel fallback title, singular field labels

Two review follow-ups on the AsyncAPI importer:

- An AsyncAPI 2 operation with neither `summary` nor `operationId` (the
  official streetlights spec, for instance) used the synthetic
  "channel:action" name as its title, so the node read
  "SUBSCRIBE\n…/lighting/measured:subscribe". Fall back to the channel
  address instead.
- A single-property payload schema rendered as "(1 fields)"; match
  openapiimports.py and use the singular.

Also silences the pre-existing type and lint findings in the touched
files the way sibling importers do (assert the importlib spec, tag the
file reads with pi-lens-ignore), and adds assertions for both fixes.

**File**: `skills/drawio-skill/scripts/asyncapiimports.py` (modified, +15/-7)
```diff
@@ -30,6 +30,7 @@
 
 def load_spec(path):
     """Parse JSON directly and YAML through the optional PyYAML dependency."""
+    # pi-lens-ignore: ast-grep:unchecked-throwing-call-python
     with open(path, encoding="utf-8") as handle:
         text = handle.read()
     if path.lower().endswith((".yaml", ".yml")):
@@ -163,9 +164,8 @@ def add_edge(source, target, label="", style=EVENT_EDGE, pointer=None):
     # send/receive. A channel is referenced by JSON Pointer.
     for operation_name, raw_operation in (spec.get("operations") or {}).items():
         operation = raw_operation if isinstance(raw_operation, dict) else {}
-        action = {"send": "publish", "receive": "subscribe"}.get(
-            operation.get("action"), operation.get("action")
-        )
+        action = str(operation.get("action") or "")
+        action = {"send": "publish", "receive": "subscribe"}.get(action, action)
         channel_ref = (operation.get("channel") or {}).get("$ref")
         channel_name = (
             decode_pointer_token(channel_ref.split("/")[-1])
@@ -185,7 +185,15 @@ def add_edge(source, target, label="", style=EVENT_EDGE, pointer=None):
 
     for operation_name, action, channel_name, operation, pointer in operations:
         operation_id = f"operation:{operation_name}"
-        title = operation.get("summary") or operation.get("operationId") or operation_name
+        raw_channel = channels[channel_name]
+        channel = raw_channel if isinstance(raw_channel, dict) else {}
+        # Without a summary or operationId (common in AsyncAPI 2), the channel
+        # address reads better than the synthetic "channel:action" name.
+        title = (
+            operation.get("summary")
+            or operation.get("operationId")
+            or str(channel.get("address") or channel_name)
+        )
         node = {
             "id": operation_id,
             "label": f"{action.upper()}\n{title}",
@@ -195,8 +203,6 @@ def add_edge(source, target, label="", style=EVENT_EDGE, pointer=None):
             "provenance": {"pointer": pointer},
         }
         if group:
-            raw_channel = channels[channel_name]
-            channel = raw_channel if isinstance(raw_channel, dict) else {}
             node["group"] = first_tag(operation) or channel_group(channel_name, channel)
         nodes.append(node)
         add_edge(operation_id, channel_ids[channel_name], action, EVENT_EDGE, pointer)
@@ -218,7 +224,8 @@ def add_edge(source, target, label="", style=EVENT_EDGE, pointer=None):
     for name, raw_schema in schemas.items():
         schema = raw_schema if isinstance(raw_schema, dict) else {}
         properties = schema.get("properties") or {}
-        label = name + (f"\n({len(properties)} fields)" if properties else "")
+        count = len(properties)
+        label = name + (f"\n({count} field{'s' if count != 1 else ''})" if count else "")
         node = {
             "id": schema_ids[name],
             "label": label,
@@ -262,6 +269,7 @@ def main():
     graph = build(spec, args.group, args.direction)
     text = json.dumps(graph, indent=2)
     if args.output:
+        # pi-lens-ignore: ast-grep:unchecked-throwing-call-python
         with open(args.output, "w", encoding="utf-8") as handle:
             handle.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
```

**File**: `tests/test_asyncapiimports.py` (modified, +10/-1)
```diff
@@ -13,6 +13,7 @@
 
 def load_importer():
     spec = importlib.util.spec_from_file_location("asyncapiimports", SCRIPT)
+    assert spec is not None and spec.loader is not None
     module = importlib.util.module_from_spec(spec)
     spec.loader.exec_module(module)
     return module
@@ -36,7 +37,10 @@ def test_asyncapi_2_operations_channels_and_payload_schemas(self):
                         "summary": "Consume order",
                         "message": {"payload": {"$ref": "#/components/schemas/Audit"}},
                     },
-                }
+                },
+                "orders/shipped": {
+                    "publish": {"message": {"payload": {"type": "object"}}},
+                },
             },
             "components": {
                 "messages": {
@@ -59,6 +63,11 @@ def test_asyncapi_2_operations_channels_and_payload_schemas(self):
         self.assertEqual(by_id["channel:orders/created"]["group"], "orders")
         self.assertIn("fillColor=#d5e8d4", by_id["operation:orders/created:publish"]["style"])
         self.assertIn("fillColor=#dae8fc", by_id["operation:orders/created:subscribe"]["style"])
+        # No summary or operationId: fall back to the channel, not "channel:action".
+        self.assertEqual(
+            "PUBLISH\norders/shipped", by_id["operation:orders/shipped:publish"]["label"]
+        )
+        self.assertEqual("Audit\n(1 field)", by_id["schema:Audit"]["label"])
         self.assertIn(("operation:orders/created:publish", "channel:orders/created"), pairs)
         self.assertIn(("operation:orders/created:publish", "schema:Order"), pairs)
         self.assertIn(("operation:orders/created:subscribe", "schema:Audit"), pairs)
```

---

### Incident Patch 4: `fa37b6f8` (2026-09-11)
**Commit Message**: Merge pull request #124 from Agents365-ai/fix/version-test-3.2.3

test: align declared version with v3.2.3

**File**: `tests/test_skill_metadata.py` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ def test_declared_versions_match(self):
         assert metadata_match is not None
         metadata = json.loads(metadata_match.group(1))
 
-        self.assertEqual("3.2.1", metadata.get("version"))
+        self.assertEqual("3.2.3", metadata.get("version"))
         self.assertEqual(
             "https://github.com/Agents365-ai/drawio-skill", metadata.get("homepage")
         )
```

---

### Incident Patch 5: `52efb289` (2026-09-09)
**Commit Message**: Merge pull request #116 from Anai-Guo/fix/drawiodiff-incoming-repoint

fix(drawiodiff): NameError when an edge re-points its source

**File**: `skills/drawio-skill/scripts/drawiodiff.py` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ def classify_rerouted(old_ek, new_ek, removed, added):
             if len(cands) == 1:
                 rerouted.add(cands[0])
         elif a in removed and b not in removed:
-            cands = [(c, b) for (s, t) in new_only if t == b and s in added]
+            cands = [(s, b) for (s, t) in new_only if t == b and s in added]
             if len(cands) == 1:
                 rerouted.add(cands[0])
     return rerouted
```

**File**: `tests/test_scripts.py` (modified, +27/-0)
```diff
@@ -969,6 +969,33 @@ def test_drawiodiff_by_id(self):
             self.assertIn("b85450", estatus[("api", "cache")])  # removed
             self.assertIn("d79b00", estatus[("api", "worker")])  # rerouted
 
+    def test_drawiodiff_incoming_repoint_is_rerouted(self):
+        # Mirror of the case above, with the arrow the other way round: the
+        # (cache, api) edge re-points to (worker, api) — target kept, old
+        # source removed, new source added — so it is orange "rerouted" too.
+        old = self._drawio(
+            [("api", "api"), ("db", "db"), ("cache", "cache")],
+            [("db", "api"), ("cache", "api")],
+        )
+        new = self._drawio(
+            [("api", "api"), ("db", "db"), ("worker", "worker")],
+            [("db", "api"), ("worker", "api")],
+        )
+        with tempfile.TemporaryDirectory() as d:
+            self._write(os.path.join(d, "old.drawio"), old)
+            self._write(os.path.join(d, "new.drawio"), new)
+            graph = json.loads(
+                run(
+                    "drawiodiff.py",
+                    os.path.join(d, "old.drawio"),
+                    os.path.join(d, "new.drawio"),
+                ).stdout
+            )
+            estatus = {(e["source"], e["target"]): e["style"] for e in graph["edges"]}
+            self.assertIn("999999", estatus[("db", "api")])  # same
+            self.assertIn("b85450", estatus[("cache", "api")])  # removed
+            self.assertIn("d79b00", estatus[("worker", "api")])  # rerouted
+
     @staticmethod
     def _drawio_pos(nodes, edges):
         """.drawio XML from (id, label, x, y) nodes and (src, tgt) edges."""
```

---

### Incident Patch 6: `eee63bdb` (2026-09-08)
**Commit Message**: fix(drawiodiff): NameError when an edge re-points its source

classify_rerouted() handles two mirrored re-point cases. The first builds
its candidate list correctly:

    cands = [(a, c) for (s, c) in new_only if s == a and c in added]

The second unpacks each new edge as (s, t) but builds the pair from `c`,
which is not bound anywhere in that scope:

    cands = [(c, b) for (s, t) in new_only if t == b and s in added]

The comprehension only evaluates the element expression for items that pass
the filter, so this stays dormant until an old edge (a, b) has its *source*
removed while the target survives and a newly added node points at that same
target — i.e. exactly the situation the branch exists to classify. There it
raises `NameError: name 'c' is not defined`. classify_rerouted() is called
unconditionally from main() with no exception handling, so drawiodiff.py
aborts with a traceback and exit code 1 instead of emitting the graph.

The filter is already right (`t == b and s in added`); only the constructed
pair is wrong. `s` is the newly added source, so the pair is (s, b).

test_drawiodiff_by_id covers the outgoing direction ("source kept, old target
removed, new target added")

**File**: `skills/drawio-skill/scripts/drawiodiff.py` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ def classify_rerouted(old_ek, new_ek, removed, added):
             if len(cands) == 1:
                 rerouted.add(cands[0])
         elif a in removed and b not in removed:
-            cands = [(c, b) for (s, t) in new_only if t == b and s in added]
+            cands = [(s, b) for (s, t) in new_only if t == b and s in added]
             if len(cands) == 1:
                 rerouted.add(cands[0])
     return rerouted
```

**File**: `tests/test_scripts.py` (modified, +27/-0)
```diff
@@ -969,6 +969,33 @@ def test_drawiodiff_by_id(self):
             self.assertIn("b85450", estatus[("api", "cache")])  # removed
             self.assertIn("d79b00", estatus[("api", "worker")])  # rerouted
 
+    def test_drawiodiff_incoming_repoint_is_rerouted(self):
+        # Mirror of the case above, with the arrow the other way round: the
+        # (cache, api) edge re-points to (worker, api) — target kept, old
+        # source removed, new source added — so it is orange "rerouted" too.
+        old = self._drawio(
+            [("api", "api"), ("db", "db"), ("cache", "cache")],
+            [("db", "api"), ("cache", "api")],
+        )
+        new = self._drawio(
+            [("api", "api"), ("db", "db"), ("worker", "worker")],
+            [("db", "api"), ("worker", "api")],
+        )
+        with tempfile.TemporaryDirectory() as d:
+            self._write(os.path.join(d, "old.drawio"), old)
+            self._write(os.path.join(d, "new.drawio"), new)
+            graph = json.loads(
+                run(
+                    "drawiodiff.py",
+                    os.path.join(d, "old.drawio"),
+                    os.path.join(d, "new.drawio"),
+                ).stdout
+            )
+            estatus = {(e["source"], e["target"]): e["style"] for e in graph["edges"]}
+            self.assertIn("999999", estatus[("db", "api")])  # same
+            self.assertIn("b85450", estatus[("cache", "api")])  # removed
+            self.assertIn("d79b00", estatus[("worker", "api")])  # rerouted
+
     @staticmethod
     def _drawio_pos(nodes, edges):
         """.drawio XML from (id, label, x, y) nodes and (src, tgt) edges."""
```

---

### Incident Patch 7: `ec0b52b3` (2026-08-23)
**Commit Message**: Merge pull request #104 from rjain21/fix/embed-svg-images

Embed images in SVG exports

**File**: `skills/drawio-skill/SKILL.md` (modified, +1/-1)
```diff
@@ -247,7 +247,7 @@ xvfb-run -a --server-args="-screen 0 1280x1024x24" \
 # Running as root (CI / Docker)? Append --no-sandbox AT THE END (placing it earlier makes drawio treat it as the input filename)
 
 # SVG export (final — -e is safe; SVG is text)
-drawio -x -f svg -e -o diagram.svg input.drawio
+drawio -x -f svg -e --embed-svg-images -o diagram.svg input.drawio
 
 # PDF export (final)
 drawio -x -f pdf -e -o diagram.pdf input.drawio
```

**File**: `skills/drawio-skill/scripts/drawiohtml.py` (modified, +2/-1)
```diff
@@ -54,7 +54,8 @@ def rewrite_page_links(tree):
 
 def export_svg(drawio_file, index, out_svg):
     """Export one page (1-based index) to SVG via the draw.io CLI."""
-    r = subprocess.run(["drawio", "-x", "-f", "svg", "--page-index", str(index),
+    r = subprocess.run(["drawio", "-x", "-f", "svg", "--embed-svg-images",
+                        "--page-index", str(index),
                         "-o", out_svg, drawio_file], capture_output=True)
     return r.returncode == 0 and os.path.exists(out_svg)
 
```

**File**: `skills/drawio-skill/scripts/svgflow.py` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ def to_svg(path):
             return f.read()
     with tempfile.TemporaryDirectory() as tmp:
         out = os.path.join(tmp, "d.svg")
-        r = subprocess.run(["drawio", "-x", "-f", "svg", "-o", out, path],
+        r = subprocess.run(["drawio", "-x", "-f", "svg", "--embed-svg-images", "-o", out, path],
                            capture_output=True)
         if r.returncode != 0 or not os.path.exists(out):
             sys.exit("error: draw.io SVG export failed (is the draw.io CLI installed?)")
```

**File**: `tests/test_scripts.py` (modified, +31/-0)
```diff
@@ -17,6 +17,7 @@
 import subprocess
 import sys
 import tempfile
+import types
 import unittest
 import urllib.parse
 import zlib
@@ -848,6 +849,36 @@ def test_svgflow_reverse_flips_offset(self):
         out, _ = sf.animate(self.FLOW_SVG, 2, "8 2", reverse=True)
         self.assertIn("stroke-dashoffset:10", out)               # +(8+2), toward source
 
+    def test_svg_export_embeds_images(self):
+        # Without --embed-svg-images the CLI writes file:/// references to the
+        # icon files inside the draw.io application bundle, so vendor icons
+        # render only on the exporting machine. Assert the flag reaches argv.
+        for name, call in (
+            ("svgflow", lambda m: m.to_svg("d.drawio")),
+            ("drawiohtml", lambda m: m.export_svg("d.drawio", 1, "out.svg")),
+        ):
+            with self.subTest(script=name):
+                mod = load(name)
+                seen = []
+
+                def fake_run(argv, *a, **kw):
+                    seen.append(argv)
+                    return types.SimpleNamespace(returncode=1, stdout=b"", stderr=b"")
+
+                real_run, mod.subprocess.run = mod.subprocess.run, fake_run
+                try:
+                    try:
+                        call(mod)
+                    except SystemExit:
+                        pass            # export "fails"; argv is what matters
+                finally:
+                    mod.subprocess.run = real_run
+
+                self.assertTrue(seen, "the draw.io CLI was never invoked")
+                argv = seen[0]
+                self.assertIn("--embed-svg-images", argv)
+                self.assertEqual(argv[:4], ["drawio", "-x", "-f", "svg"])
+
     def test_drawio2mermaid_flowchart(self):
         # Reuses EXPLAIN_PAGE: container "Tier" with A/B, cylinder DB, edge a->c "reads".
         doc = ('<mxfile><diagram name="P1"><mxGraphModel><root>'
```

---

### Incident Patch 8: `ac77fe34` (2026-08-22)
**Commit Message**: Add a regression test for the SVG embed flag

Covers to_svg() in svgflow.py and export_svg() in drawiohtml.py, which
were previously untested — the existing svgflow tests exercise animate()
only.

The test replaces subprocess.run in each module, invokes the export
function, and asserts that the recorded argv contains
--embed-svg-images. Verified to fail when the flag is removed from
either call site.

**File**: `tests/test_scripts.py` (modified, +31/-0)
```diff
@@ -17,6 +17,7 @@
 import subprocess
 import sys
 import tempfile
+import types
 import unittest
 import urllib.parse
 import zlib
@@ -848,6 +849,36 @@ def test_svgflow_reverse_flips_offset(self):
         out, _ = sf.animate(self.FLOW_SVG, 2, "8 2", reverse=True)
         self.assertIn("stroke-dashoffset:10", out)               # +(8+2), toward source
 
+    def test_svg_export_embeds_images(self):
+        # Without --embed-svg-images the CLI writes file:/// references to the
+        # icon files inside the draw.io application bundle, so vendor icons
+        # render only on the exporting machine. Assert the flag reaches argv.
+        for name, call in (
+            ("svgflow", lambda m: m.to_svg("d.drawio")),
+            ("drawiohtml", lambda m: m.export_svg("d.drawio", 1, "out.svg")),
+        ):
+            with self.subTest(script=name):
+                mod = load(name)
+                seen = []
+
+                def fake_run(argv, *a, **kw):
+                    seen.append(argv)
+                    return types.SimpleNamespace(returncode=1, stdout=b"", stderr=b"")
+
+                real_run, mod.subprocess.run = mod.subprocess.run, fake_run
+                try:
+                    try:
+                        call(mod)
+                    except SystemExit:
+                        pass            # export "fails"; argv is what matters
+                finally:
+                    mod.subprocess.run = real_run
+
+                self.assertTrue(seen, "the draw.io CLI was never invoked")
+                argv = seen[0]
+                self.assertIn("--embed-svg-images", argv)
+                self.assertEqual(argv[:4], ["drawio", "-x", "-f", "svg"])
+
     def test_drawio2mermaid_flowchart(self):
         # Reuses EXPLAIN_PAGE: container "Tier" with A/B, cylinder DB, edge a->c "reads".
         doc = ('<mxfile><diagram name="P1"><mxGraphModel><root>'
```

---

### Incident Patch 9: `4d9b3116` (2026-08-21)
**Commit Message**: Merge pull request #103 from Abic7/security-fixes

security: fix resource leaks in file operations

**File**: `skills/drawio-skill/scripts/aiicons.py` (modified, +2/-1)
```diff
@@ -138,7 +138,8 @@ def main():
 
     if not os.path.exists(MANIFEST):
         sys.exit(f"error: manifest not found at {MANIFEST}")
-    manifest = json.load(open(MANIFEST, encoding="utf-8"))
+    with open(MANIFEST, encoding="utf-8") as f:
+        manifest = json.load(f)
     fam = families(manifest["icons"])
     cdn = manifest["cdn"]
 
```

**File**: `skills/drawio-skill/scripts/dockerimports.py` (modified, +5/-1)
```diff
@@ -69,7 +69,11 @@ def main():
                     help="group containers by compose project (else first network)")
     args = ap.parse_args()
 
-    text = sys.stdin.read() if args.input == "-" else open(args.input, encoding="utf-8").read()
+    if args.input == "-":
+        text = sys.stdin.read()
+    else:
+        with open(args.input, encoding="utf-8") as f:
+            text = f.read()
     try:
         data = json.loads(text)
     except json.JSONDecodeError as exc:
```

**File**: `skills/drawio-skill/scripts/goimports.py` (modified, +6/-3)
```diff
@@ -35,7 +35,8 @@ def module_path(root):
     gomod = os.path.join(root, "go.mod")
     if not os.path.exists(gomod):
         return None
-    m = MODULE.search(open(gomod, encoding="utf-8", errors="ignore").read())
+    with open(gomod, encoding="utf-8", errors="ignore") as f:
+        m = MODULE.search(f.read())
     return m.group(1) if m else None
 
 
@@ -61,7 +62,8 @@ def imports_of(files, modpath, pkgs):
     found = set()
     for path in files:
         try:
-            src = open(path, encoding="utf-8", errors="ignore").read()
+            with open(path, encoding="utf-8", errors="ignore") as f:
+                src = f.read()
         except OSError:
             continue
         specs = []
@@ -129,7 +131,8 @@ def node(ip):
     }
     text = json.dumps(graph, indent=2)
     if args.output:
-        open(args.output, "w", encoding="utf-8").write(text)
+        with open(args.output, "w", encoding="utf-8") as f:
+            f.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
     else:
         sys.stdout.write(text)
```

**File**: `skills/drawio-skill/scripts/jsimports.py` (modified, +4/-2)
```diff
@@ -77,7 +77,8 @@ def edges_of(mid, path, root, modules):
     """Intra-project modules imported by module `mid`."""
     found = set()
     try:
-        src = open(path, encoding="utf-8", errors="ignore").read()
+        with open(path, encoding="utf-8", errors="ignore") as f:
+            src = f.read()
     except OSError:
         return found
     for m in SPEC.finditer(src):
@@ -150,7 +151,8 @@ def node(m):
     }
     text = json.dumps(graph, indent=2)
     if args.output:
-        open(args.output, "w", encoding="utf-8").write(text)
+        with open(args.output, "w", encoding="utf-8") as f:
+            f.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
     else:
         sys.stdout.write(text)
```

**File**: `skills/drawio-skill/scripts/pyclasses.py` (modified, +4/-2)
```diff
@@ -59,7 +59,8 @@ def base_name(node):
 def classes_in(module, path):
     """Top-level classes of a module: list of (qualified_id, simple_name, [base names])."""
     try:
-        tree = ast.parse(open(path, encoding="utf-8").read(), filename=path)
+        with open(path, encoding="utf-8") as f:
+            tree = ast.parse(f.read(), filename=path)
     except SyntaxError:
         return []
     out = []
@@ -144,7 +145,8 @@ def node(cid):
     }
     text = json.dumps(graph, indent=2)
     if args.output:
-        open(args.output, "w", encoding="utf-8").write(text)
+        with open(args.output, "w", encoding="utf-8") as f:
+            f.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
     else:
         sys.stdout.write(text)
```

---

### Incident Patch 10: `92ea2a55` (2026-08-20)
**Commit Message**: security: fix resource leaks in file operations

Replace bare `open()` calls with `with` context managers across 10 Python
scripts to ensure files are properly closed even if exceptions occur. This
prevents resource leaks from unreleased file handles.

Fixed in:
- aiicons.py: manifest JSON loading
- dockerimports.py: stdin input handling
- goimports.py: module discovery and output writing
- jsimports.py: module edge scanning and output writing
- pyclasses.py: class introspection and output writing
- pyimports.py: import graph parsing and output writing
- rustimports.py: crate discovery, module scanning and output writing
- tfstate.py: terraform state input handling
- timelapse.py: graph JSON reading/writing and frame saving
- tubemap.py: metro JSON input handling

All subprocess calls already use list form (no shell injection risk).
No dangerous practices like shell=True, eval(), or pickle.load() found.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>

**File**: `skills/drawio-skill/scripts/aiicons.py` (modified, +2/-1)
```diff
@@ -138,7 +138,8 @@ def main():
 
     if not os.path.exists(MANIFEST):
         sys.exit(f"error: manifest not found at {MANIFEST}")
-    manifest = json.load(open(MANIFEST, encoding="utf-8"))
+    with open(MANIFEST, encoding="utf-8") as f:
+        manifest = json.load(f)
     fam = families(manifest["icons"])
     cdn = manifest["cdn"]
 
```

**File**: `skills/drawio-skill/scripts/dockerimports.py` (modified, +5/-1)
```diff
@@ -69,7 +69,11 @@ def main():
                     help="group containers by compose project (else first network)")
     args = ap.parse_args()
 
-    text = sys.stdin.read() if args.input == "-" else open(args.input, encoding="utf-8").read()
+    if args.input == "-":
+        text = sys.stdin.read()
+    else:
+        with open(args.input, encoding="utf-8") as f:
+            text = f.read()
     try:
         data = json.loads(text)
     except json.JSONDecodeError as exc:
```

**File**: `skills/drawio-skill/scripts/goimports.py` (modified, +6/-3)
```diff
@@ -35,7 +35,8 @@ def module_path(root):
     gomod = os.path.join(root, "go.mod")
     if not os.path.exists(gomod):
         return None
-    m = MODULE.search(open(gomod, encoding="utf-8", errors="ignore").read())
+    with open(gomod, encoding="utf-8", errors="ignore") as f:
+        m = MODULE.search(f.read())
     return m.group(1) if m else None
 
 
@@ -61,7 +62,8 @@ def imports_of(files, modpath, pkgs):
     found = set()
     for path in files:
         try:
-            src = open(path, encoding="utf-8", errors="ignore").read()
+            with open(path, encoding="utf-8", errors="ignore") as f:
+                src = f.read()
         except OSError:
             continue
         specs = []
@@ -129,7 +131,8 @@ def node(ip):
     }
     text = json.dumps(graph, indent=2)
     if args.output:
-        open(args.output, "w", encoding="utf-8").write(text)
+        with open(args.output, "w", encoding="utf-8") as f:
+            f.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
     else:
         sys.stdout.write(text)
```

**File**: `skills/drawio-skill/scripts/jsimports.py` (modified, +4/-2)
```diff
@@ -77,7 +77,8 @@ def edges_of(mid, path, root, modules):
     """Intra-project modules imported by module `mid`."""
     found = set()
     try:
-        src = open(path, encoding="utf-8", errors="ignore").read()
+        with open(path, encoding="utf-8", errors="ignore") as f:
+            src = f.read()
     except OSError:
         return found
     for m in SPEC.finditer(src):
@@ -150,7 +151,8 @@ def node(m):
     }
     text = json.dumps(graph, indent=2)
     if args.output:
-        open(args.output, "w", encoding="utf-8").write(text)
+        with open(args.output, "w", encoding="utf-8") as f:
+            f.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
     else:
         sys.stdout.write(text)
```

**File**: `skills/drawio-skill/scripts/pyclasses.py` (modified, +4/-2)
```diff
@@ -59,7 +59,8 @@ def base_name(node):
 def classes_in(module, path):
     """Top-level classes of a module: list of (qualified_id, simple_name, [base names])."""
     try:
-        tree = ast.parse(open(path, encoding="utf-8").read(), filename=path)
+        with open(path, encoding="utf-8") as f:
+            tree = ast.parse(f.read(), filename=path)
     except SyntaxError:
         return []
     out = []
@@ -144,7 +145,8 @@ def node(cid):
     }
     text = json.dumps(graph, indent=2)
     if args.output:
-        open(args.output, "w", encoding="utf-8").write(text)
+        with open(args.output, "w", encoding="utf-8") as f:
+            f.write(text)
         sys.stderr.write(f"wrote {args.output}\n")
     else:
         sys.stdout.write(text)
```

#### Recent Merged Pull Requests:
- **PR #134** (2026-09-14): chore(release): v3.4.0 (@Agents365-ai)
- **PR #133** (2026-09-14): chore: stop syncing to 365-skills, keep this repo standalone (@Agents365-ai)
- **PR #132** (2026-09-14): docs: rendered-output pitfalls (diamond exits, pixel-exact pins, labels) + DOM verification workflow (@xiaoraoxiaorao)
- **PR #131** (2026-09-13): feat: add GraphQL SDL importer (graphqlerd.py) (#121) (@MannXo)
- **PR #130** (2026-09-11): chore(release): v3.3.0 (@Agents365-ai)
- **PR #128** (2026-09-11): feat: add Protocol Buffers importer (protoimports.py) (@Chirudeva-Reddy)
- **PR #127** (2026-09-11): feat: add AsyncAPI architecture importer (@akkupratap323)
- **PR #126** (2026-09-11): chore(release): v3.2.4 (@Agents365-ai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
