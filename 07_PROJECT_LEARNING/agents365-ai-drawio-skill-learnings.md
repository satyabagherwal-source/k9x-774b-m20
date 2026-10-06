# Forensic Learning Record (Deep Inspection): Agents365-ai/drawio-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/agents365-ai-drawio-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agents365-ai/drawio-skill](https://github.com/Agents365-ai/drawio-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:20:13.847Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agents365-ai/drawio-skill`
- **Description**: Agent skill that turns natural language, code, Terraform/K8s, SQL, OpenAPI, AsyncAPI, Protobuf and GraphQL sources into editable, tested draw.io architecture diagrams: incremental sync, multi-view projection, drift diff, CI architecture tests, whiteboard derasterize, interactive HTML/PPTX/Mermaid exports.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9945 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/drawio-skill/scripts/tfstate.py`
```
#!/usr/bin/env python3
"""Draw the cloud resources ACTUALLY deployed, from `terraform show -json`.

Where tfimports.py reads the *declared* config (`.tf` files), this reads the
*real* state: what Terraform recorded as provisioned. It is provider-agnostic
(the JSON is uniform across AWS / Azure / GCP), expands `count`/`for_each` into
their real instances, keeps module nesting, and reuses tfimports' icon resolver
so every resource shows its official cloud icon. The output feeds autolayout.py:

  terraform show -json | python3 tfstate.py - -o graph.json
  python3 autolayout.py graph.json -o deployed.drawio

Input is the JSON `terraform show -json` prints — from live state (no argument)
or a saved plan (`terraform show -json plan.tfplan`) — as a file path or `-` for
stdin. Nodes are the managed resource instances (data sources are ignored);
edges come from the dependencies Terraform recorded in state (`depends_on`).
`--group` boxes resources by their module; `--no-icons` forces plain boxes.

Usage: terraform show -json | python3 tfstate.py - [-o graph.json]
       [--direction TB|LR] [--group] [--no-reduce] [--no-icons]
"""
import argparse
import importlib.util
import json
import os
import sys


def load_tfimports():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tfimports.py")
    spec = importlib.util.spec_from_file_location("tfimports", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def walk_module(mod, out):
    """Collect (address, type, name, index, module_path, depends_on) for every
    managed resource, recursing into child modules."""
    addr = mod.get("address", "")                    # "" for root, else module.x[...]
    for r in mod.get("resources") or []:
        if r.get("mode") == "data":
            continue
        out.append((r.get("address"), r.get("type"), r.get("name"),
                    r.get("index"), addr, r.get("depends_on") or []))
    for child in mod.get("child_modules") or []:
        walk_module(child, out)


def main():
    ap = argparse.ArgumentParser(description="`terraform show -json` -> autolayout graph JSON.")
    ap.add_argument("input", help="`terraform show -json` output file, or - for stdin")
    ap.add_argument("-o", "--output", help="output JSON path (default: stdout)")
    ap.add_argument("--direction", default="TB", choices=["TB", "LR"])
    ap.add_argument("--group", action="store_true",
                    help="group resources into containers by module")
    ap.add_argument("--no-reduce", action="store_true",
                    help="keep every edge (skip transitive reduction)")
    ap.add_argument("--no-icons", action="store_true",
                    help="plain boxes instead of official cloud icons")
    args = ap.parse_args()

    if args.input == "-":
        text = sys.stdin.read()
    else:
        with open(args.input, encoding="utf-8") as f:
            text = f.read()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        sys.exit(f"error: input is not valid JSON ({exc}) — feed `terraform show -json`")
    # State: top-level "values"; saved plan: "planned_values".
    root = ((data.get("values") or data.get("planned_values") or {}).get("root_module")) or {}
    resources = []
    walk_module(root, resources)
    if not resources:
        sys.exit("error: no managed resources found in the Terraform state/plan")

    addresses = {r[0] for r in resources}

    def targets(dep):
        """Instance addresses a depends_on entry names. State records the
        un-indexed address (`aws_subnet.this`) for a resource with several
        instances (`aws_subnet.this[0]`), so expand by prefix too."""
        if dep in addresses:
            return {dep}
        return {a for a in addresses if a.startswith(dep + "[")}

    edges = sorted({(addr, t) for addr, _, _, _, _, deps in resources
                    for dep in deps for t in targets(dep) if t != addr})

    tf = load_tfimports()
    raw = len(edges)
    if not args.no_reduce and edges:
        edges = tf.transitive_reduce(list(addresses), edges)

    resolver = None if args.no_icons else tf.IconResolver()
    unmatched, nodes = [], []
    for addr, rtype, name, index, mpath, _ in resources:
        label = name if index is None else f"{name}[{index}]"
        node = {"id": addr, "label": label}
        icon = resolver.resolve(rtype) if resolver and rtype else None
        if icon:
            node.update(style=icon["style"], width=icon["w"], height=icon["h"])
        else:
            node["label"] = f"{label}\n{rtype}" if rtype else label
            if rtype:
                unmatched.append(rtype)
        if args.group and mpath:
            node["group"] = mpath
        nodes.append(node)

    graph = {"direction": args.direction, "nodes": nodes,
             "edges": [{"source": s, "target": t} for s, t in edges]}
    if resolver:
        # Icon labels render below the shape — reserve extra layout spacing.
        graph.update(ranksep=0.7, nodesep=0.6)
    out = json.dumps(graph, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(out)
        sys.stderr.write(f"wrote {args.output}\n")
    else:
        sys.stdout.write(out)
    note = "" if args.no_reduce else f" (reduced from {raw})"
    sys.stderr.write(f"{len(nodes)} resources, {len(edges)} edges{note}\n")
    if unmatched:
        sys.stderr.write("no icon for: " + ", ".join(sorted(set(unmatched))) + "\n")


if __name__ == "__main__":
    main()

```

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
                 f"(shape=cylinder3) or shapesearch.py '{args.query} database'")

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        for r in results:
            shown = r["style"] if len(r["style"]) < 160 else r["style"][:157] + "..."
            print(f"{r['brand']}  ({r['file']}, {r['w']}x{r['h']})\n  {shown}")


if __name__ == "__main__":
    main()

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
        add_edge(operation_id, channel_ids[channel_name], action, EVENT_EDGE, pointer)
        # In AsyncAPI 3, the channel reference identifies the connection but
        # does not mean that an operation uses every message on that channel.
        message_source = {
            key: value for key, value in operation.items() if key != "channel"
        }
        for schema_name in sorted(set(schema_refs(message_source, spec))):
            if schema_name in schema_ids:
                add_edge(
                    operation_id,
                    schema_ids[schema_name],
                    "payload",
                    SCHEMA_EDGE,
                    pointer,
                )

    for name, raw_schema in schemas.items():
        schema = raw_schema if isinstance(raw_schema, dict) else {}
        properties = schema.get("properties") or {}
        count = len(properties)
        label = name + (f"\n({count} field{'s' if count != 1 else ''})" if count else "")
        node = {
            "id": schema_ids[name],
            "label": label,
            "style": SCHEMA_STYLE,
            "width": max(140, 9 * len(name) + 20),
            "height": 40,
            "provenance": {"pointer": f"#/components/schemas/{pointer_token(name)}"},
        }
        if group:
            node["group"] = "schemas"
        nodes.append(node)
        for ref_name in sorted(set(schema_refs(schema, spec))):
            if ref_name in schema_ids:
                add_edge(schema_ids[name], schema_ids[ref_name], "", SCHEMA_EDGE)

    return {"direction": direction, "nodes": nodes, "edges": edges}


def main():
    parser = argparse.ArgumentParser(
        description="AsyncAPI 2/3 spec -> event architecture graph JSON."
    )
    parser.add_argument("spec", help="AsyncAPI 2/3 spec (.json, .yaml, or .yml)")
    parser.add_argument("-o", "--output", help="output JSON path (default: stdout)")
    parser.add_argument("--direction", default="LR", choices=["TB", "LR"])
    parser.add_argument(
        "--group",
        action="store_true",
  
```

### Core Architecture Module: `skills/drawio-skill/scripts/autolayout.py`
```
#!/usr/bin/env python3
"""Auto-layout a logical graph into draw.io XML using Graphviz.

Minimal layout pass for the drawio skill: takes a graph (nodes + edges as
JSON), runs `dot` to position the nodes, and emits a .drawio file with the
mxGeometry x/y filled in. draw.io routes the edges itself (orthogonal style).
This removes the manual-coordinate ceiling for medium/large diagrams.

Input JSON:
  {
    "direction": "TB",          # TB (top-bottom, default) or LR (left-right)
    "nodes": [
      {"id": "a", "label": "Service A", "style": "rounded=1;...",
       "width": 120, "height": 60}
    ],
    "edges": [
      {"source": "a", "target": "b", "label": "calls"}
    ]
  }
Only "id" is required per node; label defaults to id and style/width/height
have defaults. Node ids must be unique and must not be "0" or "1" (reserved
for the draw.io root cells). Requires Graphviz `dot` on PATH.

Usage: python3 autolayout.py graph.json [-o diagram.drawio]
"""
import argparse
import json
import os
import shlex
import subprocess
import sys
from xml.sax.saxutils import escape

DEFAULT_W, DEFAULT_H = 120, 60
NODE_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
EDGE_STYLE = "html=1;rounded=0;"
GROUP_STYLE = ("rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=#999999;"
               "verticalAlign=top;fontStyle=2;dashed=1;")
# Group colours come from the skill's own palette (styles/built-in/default.json)
# so there is a single source of truth, not a second list baked in here. When a
# grouped graph is laid out, each top-level group takes the next colour (cycled
# in a fixed, harmonious role order) so related modules read as a coloured
# cluster. Nodes that carry their own `style` keep it; only styleless grouped
# nodes are tinted. Disable with --mono.
_PALETTE_ORDER = ["primary", "success", "accent", "secondary", "warning", "danger", "neutral"]
_PALETTE_FILE = os.path.join(os.path.dirname(__file__), "..", "styles", "built-in", "default.json")
_FALLBACK_PALETTE = [("#dae8fc", "#6c8ebf"), ("#d5e8d4", "#82b366"), ("#ffe6cc", "#d79b00"),
                     ("#e1d5e7", "#9673a6"), ("#fff2cc", "#d6b656"), ("#f8cecc", "#b85450")]


def load_palette():
    """Ordered (fill, stroke) list from the default preset's palette; fall back
    to the same colours inline if the preset file can't be read."""
    try:
        with open(_PALETTE_FILE, encoding="utf-8") as fh:
            pal = json.load(fh)["palette"]
        colors = [(pal[r]["fillColor"], pal[r]["strokeColor"]) for r in _PALETTE_ORDER if r in pal]
        if colors:
            return colors
    except (OSError, KeyError, ValueError):
        pass
    return _FALLBACK_PALETTE


PALETTE = load_palette()
# Uniform container padding; the title sits in the top pad (verticalAlign=top).
# dot's cluster margin is set to this same value so each container box equals
# dot's cluster box — which dot guarantees never overlaps, at any nesting depth.
GROUP_PAD = 24


def attr(value):
    # Newlines in labels become &#xa; so draw.io renders a line break (a raw
    # newline inside an XML attribute is normalized to a space by parsers).
    return escape(str(value), {'"': "&quot;", "\n": "&#xa;"})


def dot_quote(value):
    # Wrap as a DOT double-quoted string, escaping backslash and quote so ids
    # with those characters can't corrupt the Graphviz input.
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def snap(value, grid=10):
    # Align to the grid the skill uses everywhere (multiples of 10).
    return int(round(value / grid) * grid)


def group_tree(nodes):
    """Parse hierarchical `group` paths ("a/b") into a container tree.

    Returns (gpath, direct, children, ordered):
      gpath[node_id] = tuple of path segments (the node's deepest container)
      direct[path]   = node ids whose group is exactly this path
      children[path] = child container paths
      ordered        = all container paths, shallow-to-deep (stable)
    """
    gpath, direct, paths = {}, {}, set()
    for node in nodes:
        g = node.get("group")
        if g is None or str(g).strip("/") == "":
            continue
        t = tuple(str(g).strip("/").split("/"))
        gpath[node["id"]] = t
        direct.setdefault(t, []).append(node["id"])
        for k in range(1, len(t) + 1):
            paths.add(t[:k])
    children = {}
    for p in sorted(paths):
        if len(p) > 1:
            children.setdefault(p[:-1], []).append(p)
    ordered = sorted(paths, key=lambda p: (len(p), p))
    return gpath, direct, children, ordered


def build_dot(graph):
    rankdir = "LR" if str(graph.get("direction", "TB")).upper() == "LR" else "TB"
    # Optional graph-level spacing (inches). Icon nodes render their label below
    # the shape, so importers emitting icons ask for extra rank/node separation.
    sep = "".join(f" {k}={float(graph[k]):.2f};" for k in ("ranksep", "nodesep") if k in graph)
    # splines=ortho makes dot route edges as orthogonal polylines; we replay
    # those bends as draw.io waypoints so edges go around nodes, not through them.
    lines = [f"digraph G {{ rankdir={rankdir};{sep} splines=ortho; node [shape=box fixedsize=true];"]
    # Group nodes into (possibly nested) clusters so dot keeps each group
    # together; a node's first appearance fixes its cluster, so list members
    # before the size attributes. The cluster margin reserves room for the
    # padded container boxes we draw below (extra on Y for the title strip) so
    # neighbouring boxes do not overlap.
    _, direct, children, ordered = group_tree(graph["nodes"])
    cidx = {p: i for i, p in enumerate(ordered)}

    def emit_cluster(p, pad):
        lines.append(f'{pad}subgraph cluster_{cidx[p]} {{ margin={GROUP_PAD};')
        for c in children.get(p, []):
            emit_cluster(c, pad + "  ")
        lines.extend(f'{pad}  {dot_quote(m)};' for m in direct.get(p, []))
        lines.append(pad + "}")

    for root in [p for p in ordered if len(p) == 1]:
        emit_cluster(root, "")
    for node in graph["nodes"]:
        # Pass our pixel sizes to dot as inches so it lays out at the real size.
        w = node.get("width", DEFAULT_W) / 72.0
        h = node.get("height", DEFAULT_H) / 72.0
        lines.append(f'{dot_quote(node["id"])} [width={w:.4f} height={h:.4f}];')
    for edge in graph.get("edges", []):
        lines.append(f'{dot_quote(edge["source"])} -> {dot_quote(edge["target"])};')
    lines.append("}")
    return "\n".join(lines)


def layout(dot_src):
    """Run `dot -Tplain`; return (height_in, {id: (xc, yc)}, {(src, dst): [(x, y), ...]}).

    Node coords are inches (bottom-left origin); each edge's value is the list
    of orthogonal control points dot computed for routing, endpoints included.
    """
    try:
        proc = subprocess.run(
            ["dot", "-Tplain"], input=dot_src,
            capture_output=True, text=True, check=True,
        )
    except FileNotFoundError:
        sys.exit("error: Graphviz `dot` not found on PATH (brew install graphviz)")
    except subprocess.CalledProcessError as exc:
        sys.exit(f"error: dot failed: {exc.stderr.strip()}")
    height, pos, edges = 0.0, {}, {}
    for line in proc.stdout.splitlines():
        tok = shlex.split(line)
        if not tok:
            continue
        if tok[0] == "graph":
            height = float(tok[3])                        # graph scale width height
        elif tok[0] == "node":
            pos[tok[1]] = (float(tok[2]), float(tok[3]))  # node name x y ...
        elif tok[0] == "edge":                            # edge tail head n x1 y1 ... xn yn
            n = int(tok[3])
            edges[(tok[1], tok[2])] = [
                (float(tok[4 + 2 * i]), float(tok[5 + 2 * i])) for i in range(n)
            ]
    return height, pos, edges


def group_style(stroke):
    """Container box styled with a group's colour (coloured border + title)."""
    return (f"rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor={stroke};"
            f"fontColor={stroke};verticalAlign=top;fontStyle=2;dashed=1;")


def page_cells(graph, height, pos, edge_pts, color=True):
    """The <root> child cells (everything after the two reserved cells) for one
    laid-out graph — reusable by multi-page generators (c4.py)."""
    nodes = graph["nodes"]
    # Absolute snapped rect for every placed node.
    rects = {}
    for node in nodes:
        nid = node["id"]
        if nid not in pos:
            continue
        w, h = node.get("width", DEFAULT_W), node.get("height", DEFAULT_H)
        xc, yc = pos[nid]
        x = snap(xc * 72 - w / 2)
        y = snap((height - yc) * 72 - h / 2)             # flip: dot origin is bottom-left
        rects[nid] = (x, y, w, h)
    # Parse the (possibly nested) group tree and assign each container a
    # collision-free id and a title (the path's last segment, or a member's groupLabel).
    gpath, direct, children, ordered = group_tree(nodes)
    # Assign each top-level group a palette colour, in order of first appearance.
    top_order = []
    for node in nodes:
        t = gpath.get(node["id"])
        if t and t[0] not in top_order:
            top_order.append(t[0])

    def gcolor(seg):
        return PALETTE[top_order.index(seg) % len(PALETTE)]

    used = {n["id"] for n in nodes}
    label_override = {}
    for node in nodes:
        if node["id"] in gpath and "groupLabel" in node:
            label_override.setdefault(gpath[node["id"]], str(node["groupLabel"]))
    gid, glabel = {}, {}
    for i, p in enumerate(ordered):
        cid = f"group_{i}"
        while cid in used:                               # never collide with a node id
            cid += "_"
        used.add(cid)
        gid[p] = cid
        glabel[p] = label_override.get(p, p[-1])
    # Container bounding box (members + nested children + uniform padding),
    # computed deepest-first so a parent can wrap its already-sized children.
    gbox = {}
    for p in sorted(or
```

### Core Architecture Module: `skills/drawio-skill/scripts/c4.py`
```
#!/usr/bin/env python3
"""C4 model diagrams: levels JSON -> one multi-page .drawio with drill-down.

Generates a C4 architecture diagram set (System Context -> Containers ->
Components, as many levels as you define) in a single `.drawio` file: one
page per level, official draw.io C4 shapes and colors, Graphviz placement
per page (via autolayout), and **drill-down links** — an element with a
`"children"` key becomes clickable and jumps to that level's page in
draw.io / the diagrams.net viewer.

  python3 c4.py c4.json -o architecture.drawio

Input JSON:
  {
    "title": "Internet Banking",
    "levels": [
      {
        "name": "System Context",
        "elements": [
          {"id": "customer", "type": "person", "label": "Personal Customer",
           "desc": "A customer of the bank"},
          {"id": "ibs", "type": "system", "label": "Internet Banking System",
           "desc": "Lets customers manage accounts", "children": "Containers"},
          {"id": "email", "type": "external", "label": "E-mail System",
           "desc": "Microsoft Exchange"}
        ],
        "relations": [
          {"from": "customer", "to": "ibs", "label": "Uses"},
          {"from": "ibs", "to": "email", "label": "Sends e-mail via"}
        ]
      },
      {
        "name": "Containers",
        "elements": [
          {"id": "spa", "type": "container", "label": "Single-Page App",
           "tech": "React", "desc": "Banking UI in the browser"},
          {"id": "api", "type": "container", "label": "API Application",
           "tech": "Java/Spring", "children": "Components"},
          {"id": "db", "type": "database", "label": "Database",
           "tech": "PostgreSQL"}
        ],
        "relations": [
          {"from": "spa", "to": "api", "label": "JSON/HTTPS"},
          {"from": "api", "to": "db", "label": "JDBC"}
        ]
      }
    ]
  }

Element types: person, system, external (greyed external system), container,
component, database. `tech` renders as the [Type: Tech] line, `desc` as the
description line — the standard C4 label. Element ids must be unique across
ALL levels (pages share one link namespace). Requires Graphviz `dot`.

Usage: python3 c4.py <c4.json> [-o out.drawio] [--direction TB|LR]
"""
import argparse
import importlib.util
import json
import os
import re
import sys

# Official draw.io C4 template styles (colors from c4model.com).
_BASE = "html=1;whiteSpace=wrap;fontSize=12;fontColor=#ffffff;align=center;"
STYLES = {
    "person": ("shape=mxgraph.c4.person2;" + _BASE +
               "fillColor=#083F75;strokeColor=#06315C;", 200, 180),
    "system": ("rounded=1;arcSize=10;" + _BASE +
               "fillColor=#1061B0;strokeColor=#0D5091;", 240, 120),
    "external": ("rounded=1;arcSize=10;" + _BASE +
                 "fillColor=#8C8496;strokeColor=#736782;", 240, 120),
    "container": ("rounded=1;arcSize=10;" + _BASE +
                  "fillColor=#23A2D9;strokeColor=#0E7DAD;", 240, 120),
    "component": ("rounded=1;arcSize=10;" + _BASE +
                  "fillColor=#63BEF2;strokeColor=#2086C9;", 240, 120),
    "database": ("shape=cylinder3;size=15;boundedLbl=1;" + _BASE +
                 "fillColor=#23A2D9;strokeColor=#0E7DAD;", 240, 120),
}
TYPE_WORD = {"person": "Person", "system": "Software System",
             "external": "Software System", "container": "Container",
             "component": "Component", "database": "Container"}
EDGE = ("endArrow=blockThin;endFill=1;endSize=10;html=1;fontSize=11;"
        "fontColor=#404040;strokeColor=#828282;labelBackgroundColor=#ffffff;"
        "rounded=0;")


def load_autolayout():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "autolayout.py")
    spec = importlib.util.spec_from_file_location("autolayout", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-") or "page"


def c4_label(el):
    """Standard C4 element label: Name / [Type: Tech] / description."""
    kind = TYPE_WORD.get(el.get("type", "system"), "Software System")
    bracket = f"[{kind}: {el['tech']}]" if el.get("tech") else f"[{kind}]"
    lines = [el.get("label", el["id"]), bracket]
    if el.get("desc"):
        lines.append(el["desc"])
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="C4 levels JSON -> multi-page draw.io.")
    ap.add_argument("input", help="C4 JSON file")
    ap.add_argument("-o", "--output", help="output .drawio path (default: stdout)")
    ap.add_argument("--direction", default="TB", choices=["TB", "LR"])
    args = ap.parse_args()
    with open(args.input, encoding="utf-8") as f:
        spec = json.load(f)
    levels = spec.get("levels") or []
    if not levels:
        sys.exit("error: no levels in input")
    al = load_autolayout()

    page_ids = {lv["name"]: slug(lv["name"]) for lv in levels}
    seen = set()
    pages = []
    for lv in levels:
        nodes = []
        for el in lv.get("elements", []):
            if el["id"] in seen:
                sys.exit(f"error: duplicate element id {el['id']!r} "
                         "(ids must be unique across all levels)")
            seen.add(el["id"])
            style, w, h = STYLES.get(el.get("type", "system"), STYLES["system"])
            node = {"id": el["id"], "label": c4_label(el), "style": style,
                    "width": w, "height": h}
            child = el.get("children")
            if child:
                if child not in page_ids:
                    sys.exit(f"error: element {el['id']!r} drills down to "
                             f"unknown level {child!r}")
                node["link"] = f"data:page/id,{page_ids[child]}"
            nodes.append(node)
        edges = [{"source": r["from"], "target": r["to"],
                  "label": r.get("label", ""), "style": EDGE}
                 for r in lv.get("relations", [])]
        graph = {"direction": args.direction, "nodes": nodes, "edges": edges,
                 "ranksep": 0.9, "nodesep": 0.5}
        height, pos, edge_pts = al.layout(al.build_dot(graph))
        pages.append(al.wrap_page(al.page_cells(graph, height, pos, edge_pts, color=False),
                                  page_id=page_ids[lv["name"]], name=lv["name"]))

    xml = "<mxfile>\n" + "".join(pages) + "</mxfile>\n"
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(xml)
        print(f"wrote {args.output} ({len(pages)} pages, {len(seen)} elements)",
              file=sys.stderr)
    else:
        sys.stdout.write(xml)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/drawio-skill/scripts/ciimports.py`
```
#!/usr/bin/env python3
"""Extract a CI pipeline (GitHub Actions / GitLab CI) as autolayout graph JSON.

GitHub Actions: every job becomes a node (label: name, runner, matrix size,
reusable-workflow target), `needs:` become edges, and each workflow gets a
trigger node (its `on:` events) feeding the jobs that have no `needs`. Given a
repo root, all of `.github/workflows/*.yml|yaml` are read and each workflow is
boxed in its own container.

GitLab CI (`.gitlab-ci.yml`, auto-detected): jobs become nodes grouped by
stage; edges come from `needs:`, and jobs without `needs` inherit the stage
DAG (every job of the previous stage), matching GitLab's execution order.

  python3 ciimports.py .                          # repo root -> all workflows
  python3 ciimports.py .github/workflows/ci.yml -o graph.json
  python3 autolayout.py graph.json -o pipeline.drawio

Requires PyYAML (pip install pyyaml).

Usage: python3 ciimports.py <repo-root | workflow.yml ...> [-o graph.json]
       [--direction TB|LR]
"""
import argparse
import json
import os
import sys

JOB_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;"
REUSE_STYLE = "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;"
TRIGGER_STYLE = "ellipse;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;"

GITLAB_RESERVED = {"stages", "variables", "workflow", "default", "include", "image",
                   "services", "before_script", "after_script", "cache", "pages"}


def find_workflows(path):
    """Workflow files for a path: file(s) as-is, a repo root via .github/workflows."""
    if os.path.isfile(path):
        return [path]
    wfdir = os.path.join(path, ".github", "workflows")
    files = sorted(os.path.join(wfdir, f) for f in os.listdir(wfdir)
                   if f.endswith((".yml", ".yaml"))) if os.path.isdir(wfdir) else []
    gitlab = os.path.join(path, ".gitlab-ci.yml")
    if os.path.isfile(gitlab):
        files.append(gitlab)
    if not files:
        sys.exit(f"error: no workflow files under {path}")
    return files


def matrix_size(strategy):
    n = 1
    matrix = (strategy or {}).get("matrix") or {}
    if not isinstance(matrix, dict):
        return 0                                # dynamic (fromJSON) — unknown
    for key, vals in matrix.items():
        if key not in ("include", "exclude") and isinstance(vals, list):
            n *= len(vals)
    n += len(matrix.get("include") or []) - len(matrix.get("exclude") or [])
    return max(n, 1)


def parse_actions(spec, wf_id, wf_name, group):
    """One GitHub Actions workflow -> (nodes, edges)."""
    nodes, edges = [], []
    # YAML 1.1 quirk: bare `on:` parses as boolean True
    on = spec.get("on", spec.get(True, {}))
    events = sorted(on) if isinstance(on, dict) else \
        ([on] if isinstance(on, str) else sorted(on or []))
    trig_id = f"{wf_id}//trigger"
    nodes.append({"id": trig_id, "label": "on: " + (", ".join(events) or "?"),
                  "style": TRIGGER_STYLE, "width": 160, "height": 50, "group": group})
    jobs = spec.get("jobs") or {}
    for jid, job in jobs.items():
        job = job or {}
        lines = [job.get("name") or jid]
        if job.get("uses"):
            lines.append("uses: " + os.path.basename(str(job["uses"])))
            style = REUSE_STYLE
        else:
            style = JOB_STYLE
            runner = job.get("runs-on")
            if runner:
                lines.append(str(runner if isinstance(runner, str) else ", ".join(runner)))
        n = matrix_size(job.get("strategy"))
        if n > 1:
            lines.append(f"matrix ×{n}")
        elif n == 0:
            lines.append("matrix (dynamic)")
        nodes.append({"id": f"{wf_id}//{jid}", "label": "\n".join(lines),
                      "style": style, "width": 180, "height": 60, "group": group})
        needs = job.get("needs") or []
        needs = [needs] if isinstance(needs, str) else needs
        for dep in needs:
            if dep in jobs:
                edges.append({"source": f"{wf_id}//{dep}", "target": f"{wf_id}//{jid}"})
        if not needs:
            edges.append({"source": trig_id, "target": f"{wf_id}//{jid}"})
    return nodes, edges


def parse_gitlab(spec, wf_id, group_prefix):
    """A .gitlab-ci.yml -> (nodes, edges); jobs grouped by stage."""
    stages = spec.get("stages") or ["build", "test", "deploy"]
    jobs = {k: v for k, v in spec.items()
            if isinstance(v, dict) and k not in GITLAB_RESERVED and not k.startswith(".")
            and ("script" in v or "trigger" in v or "extends" in v or "stage" in v)}
    nodes, edges = [], []
    by_stage = {}
    for jid, job in jobs.items():
        stage = job.get("stage") or "test"
        by_stage.setdefault(stage, []).append(jid)
        nodes.append({"id": f"{wf_id}//{jid}", "label": jid, "style": JOB_STYLE,
                      "width": 160, "height": 50,
                      "group": f"{group_prefix}{stage}"})
    order = [s for s in stages if s in by_stage]
    for jid, job in jobs.items():
        needs = [(n.get("job") if isinstance(n, dict) else n) for n in job.get("needs") or []]
        needs = [n for n in needs if n in jobs]
        if needs:
            edges.extend({"source": f"{wf_id}//{n}", "target": f"{wf_id}//{jid}"} for n in needs)
        else:                                   # stage DAG: all jobs of the previous stage
            stage = job.get("stage") or "test"
            i = order.index(stage) if stage in order else 0
            if i > 0:
                edges.extend({"source": f"{wf_id}//{p}", "target": f"{wf_id}//{jid}"}
                             for p in by_stage[order[i - 1]])
    return nodes, edges


def main():
    ap = argparse.ArgumentParser(description="CI pipeline -> autolayout graph JSON.")
    ap.add_argument("paths", nargs="+",
                    help="repo root, or workflow file(s) (.github/workflows/*.yml, .gitlab-ci.yml)")
    ap.add_argument("-o", "--output", help="output JSON path (default: stdout)")
    ap.add_argument("--direction", default="LR", choices=["TB", "LR"])
    args = ap.parse_args()

    try:
        import yaml
    except ImportError:
        sys.exit("error: PyYAML is required (pip install pyyaml)")

    files = [f for p in args.paths for f in find_workflows(p)]
    nodes, edges = [], []
    for path in files:
        with open(path, encoding="utf-8") as f:
            try:
                spec = yaml.safe_load(f) or {}
            except yaml.YAMLError as e:
                sys.stderr.write(f"warning: skipping {path}: {e}\n")
                continue
        wf_id = os.path.splitext(os.path.basename(path))[0]
        if os.path.basename(path) == ".gitlab-ci.yml" or (
                "jobs" not in spec and "stages" in spec):
            n, e = parse_gitlab(spec, wf_id, "stage: " if len(files) == 1
                                else f"{wf_id} / stage: ")
        elif spec.get("jobs"):
            wf_name = spec.get("name") or wf_id
            group = wf_name if len(files) > 1 else None
            n, e = parse_actions(spec, wf_id, wf_name, group)
        else:
            sys.stderr.write(f"warning: {path} has no jobs — skipped\n")
            continue
        nodes.extend(n)
        edges.extend(e)
    if not nodes:
        sys.exit("error: no CI jobs found")

    graph = {"direction": args.direction, "nodes": nodes, "edges": edges}
    text = json.dumps(graph, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(text)
        sys.stderr.write(f"wrote {args.output}\n")
    else:
        sys.stdout.write(text)
    sys.stderr.write(f"{len(nodes)} nodes, {len(edges)} edges from {len(files)} file(s)\n")


if __name__ == "__main__":
    main()

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

### Incident Patch 1: `75a7b8a4` (2026-09-14)
**Commit Message**: Merge pull request #132 from xiaoraoxiaorao/docs/rendered-output-pitfalls

docs: rendered-output pitfalls (diamond exits, pixel-exact pins, labels) + DOM verification workflow

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -18,6 +18,16 @@ semantic-ish versioning (the `metadata.version` field in
   `diagramctl.py build` (auto-detected from `.graphql` / `.gql`) and the MCP
   server.
 
+### Changed
+
+- **Rendered-output pitfalls documented**: `references/xml-authoring.md` gains a
+  decision-diamond section (outward vertex exits, or straight `edgeStyle=none`
+  lines from the lower edge midpoints; full-precision `entryX`/`exitX` pins;
+  `endArrow=block;endSize=8`; micro-labels only on the line), and
+  `references/troubleshooting.md` gains a DOM-verification workflow (dump the
+  viewer DOM and assert `<path d>` segments and label anchors) with two new
+  failure-mode rows. Creation workflow step 5 now points at that fallback.
+
 ## [3.3.0] - 2026-09-12
 
 ### Added
```

**File**: `skills/drawio-skill/SKILL.md` (modified, +5/-0)
```diff
@@ -87,6 +87,11 @@ commands are offline and stdlib-only.
 5. Export a draft PNG without embedded XML and inspect it visually. Fix obvious
    overlap, clipping, disconnected edges, edge-through-node routing, stacked
    edges, and unreadable labels. Stop automatic vision repair after two rounds.
+   When the drawio binary is unavailable or a visual check is inconclusive,
+   verify the renderer's own DOM instead (`--dump-dom` on the viewer URL, see
+   `references/troubleshooting.md`): read each edge's `<path>` segments and
+   label anchor coordinates directly — vision alone both misses geometry
+   defects and hallucinates new ones.
 6. Show the draft and apply targeted edits. Preserve existing geometry for
    local changes. Use `sync` for source-backed changes and write a reviewable
    output; use `--prune` only when deletion was requested.
```

**File**: `skills/drawio-skill/references/troubleshooting.md` (modified, +29/-0)
```diff
@@ -28,6 +28,8 @@ Read this when something looks wrong in the output (rendering, export, layout, e
 | WSL2: `drawio` / `draw.io` not found | The CLI lives on the Windows side. Use the Windows desktop exe via `/mnt/c`: `"/mnt/c/Program Files/draw.io/draw.io.exe"` (or per-user `"/mnt/c/Users/<you>/AppData/Local/Programs/draw.io/draw.io.exe"`). |
 | WSL2: opening an exported file fails with a `/mnt/c/...`-style path | `cmd.exe` can't resolve WSL paths — convert first: `cmd.exe /c start "" "$(wslpath -w diagram.drawio.png)"`. The empty `""` after `start` is the (required) window title. |
 | Browser URL opens to a blank/empty diagram (Windows/WSL2) | `cmd.exe`'s `start` treats `&` as a separator and drops everything after `#` — so the `#R…`/`#create=…` fragment (the whole diagram) is lost. Never pass the URL straight to `start`. Write a `.url` shortcut file and open *that* (see "WSL2 / Windows" below). |
+| `viewer.diagrams.net` intermittently drops connections (`ERR_CONNECTION_CLOSED`) during headless draft rendering | Retry in a loop with a fresh `--user-data-dir` per attempt, and gate each screenshot on a palette check: count pixels of a known fill color (e.g. the blue `#dae8fc`) and require thousands — an error page also "has colors", so a naive size/variance check passes it. |
+| Vision review approves a broken render (or hallucinates routing such as "the arrow wraps around the box") | Never let vision be the only gate for edge geometry. Verify the DOM: `--dump-dom` on the viewer URL, then parse `<path d="…">` per edge (straight? single intended segments? tip before the target border?) and `foreignObject` `padding-top/margin-left` for label anchors — see "Verifying the rendered output" below. |
 
 ## WSL2 / Windows specifics
 
@@ -61,3 +63,30 @@ cmd.exe /c start "" "$(wslpath -w "$TMP")"
 
 On native Windows the same `.url`-file trick applies (`start "" "%TEMP%\d.url"`).
 On macOS/Linux just `open "$URL"` / `xdg-open "$URL"` — no workaround needed.
+
+## Verifying the rendered output (viewer.diagrams.net)
+
+When the drawio binary is unavailable (or the render pipeline is flaky), verify
+geometry from the viewer's own output instead of eyeballing a screenshot:
+
+```bash
+URL=$(python3 <this-skill-dir>/scripts/encode_drawio_url.py diagram.drawio)
+msedge --headless=new --disable-gpu --user-data-dir="$(mktemp -d)" \
+  --virtual-time-budget=25000 --dump-dom "$URL" > dom.html
+# any recent Chromium works: `msedge` / `chromium` / `google-chrome`,
+# or the macOS app binary
+```
+
+Then check with a script, not by eye:
+
+- **Edge paths**: every stroke `<path d="M …">` should contain only the segments
+  you intended. A segment crossing a shape it does not terminate at, an
+  unexpected `Q` pair mid-segment (the 1–2 px S-wiggle from a misaligned
+  `entryX`), or an arrow tip past the target border are XML defects — fix the
+  file, don't re-route by hand.
+- **Label anchors**: label `foreignObject`s expose `padding-top: <y>px;
+  margin-left: <x>px`; assert each label box lands in empty space (no edge
+  segment, no shape boundary, no second label).
+- **Screenshot gating**: when a PNG is required, retry `ERR_CONNECTION_CLOSED`
+  with a fresh `--user-data-dir` and accept the file only after counting pixels
+  of a known palette fill — error pages pass naive "has content" checks.
```

**File**: `skills/drawio-skill/references/xml-authoring.md` (modified, +12/-0)
```diff
@@ -206,3 +206,15 @@ Rules: swatch colors come from the active palette (preset or the table above) wi
 - For tree/hierarchical layouts: assign nodes to layers (rows), connect only between adjacent layers to minimize crossings
 - For star/hub layouts: place the hub center, satellites around it — edges stay short and radial
 - When an edge must span multiple rows/columns, route it along the outer corridor, not through the middle of the diagram
+
+### Decision-diamond branches, pixel-exact pins, and labels
+
+Pitfalls verified from rendered output. `validate.py` does not catch any of them, and vision review both misses them and hallucinates new ones (it once described a clean diamond exit as "wrapping around the box" and approved a screenshot that was actually the browser error page).
+
+| Pitfall | Rule |
+| ------- | ---- |
+| Edge exits the rhombus's left/right side with its first segment heading *inward* (`exitX=0;exitY=0.25` with its target to the right at the same height): the elbow's horizontal run crosses the diamond's own interior. At the exact vertex (`exitY=0.5`) the router instead detours around the whole shape, which reads no better | Vertex exits must head outward (left vertex → left, right → right, top → up, bottom → down). When both branch targets sit *below* the decision (left and right), skip the elbow entirely: draw one straight line per branch with `edgeStyle=none` from the lower-left / lower-right **edge midpoint** (`exitX=0.25;exitY=0.75` / `exitX=0.75;exitY=0.75` — both points lie on the rhombus outline) to each target's top center. Symmetric, no right angle, nothing to cross. |
+| Vertical edge whose `entryX` is 1–2 px off the source's exit x (easy to hit when boxes snap to a 10 px grid) | Compute the pin with full precision: `entryX = (sourceCenterX − target.x) / target.width`, e.g. `0.0652`, `0.2027`. Style values accept more than two decimals. A 1–2 px mismatch renders as an S-shaped double curve (two `Q` bends) just before the arrowhead. |
+| `blockThin` arrowheads (~5×7 px) flush against the target border | Reviewers read the tip as "piercing the box". Use `endArrow=block;endSize=8` for main flow edges. |
+| Long labels auto-centered on their own edge | The white label chip visually severs the edge, and near a corner it can cut both segments. Keep only micro-labels (`Yes` / `No`) on the line; offset longer labels (`<mxPoint as="offset" x="…" y="…"/>`) into verified empty space, and shorten any label wider than the corridor it annotates. |
+| Trusting "it looks fine" | Confirm with renderer ground truth: render the viewer URL and `--dump-dom`, then read `<path d="…">` segments and label `foreignObject` `padding-top/margin-left` anchors (see `references/troubleshooting.md` → "Verifying the rendered output"). |
```

---

### Incident Patch 2: `a7e2d00b` (2026-09-14)
**Commit Message**: docs(changelog): note the rendered-output guidance under Unreleased

Feature PRs carry their bullet under Unreleased, and the release commit owns
the version bump.

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -18,6 +18,16 @@ semantic-ish versioning (the `metadata.version` field in
   `diagramctl.py build` (auto-detected from `.graphql` / `.gql`) and the MCP
   server.
 
+### Changed
+
+- **Rendered-output pitfalls documented**: `references/xml-authoring.md` gains a
+  decision-diamond section (outward vertex exits, or straight `edgeStyle=none`
+  lines from the lower edge midpoints; full-precision `entryX`/`exitX` pins;
+  `endArrow=block;endSize=8`; micro-labels only on the line), and
+  `references/troubleshooting.md` gains a DOM-verification workflow (dump the
+  viewer DOM and assert `<path d>` segments and label anchors) with two new
+  failure-mode rows. Creation workflow step 5 now points at that fallback.
+
 ## [3.3.0] - 2026-09-12
 
 ### Added
```

---

### Incident Patch 3: `c98197f7` (2026-09-14)
**Commit Message**: docs: add rendered-output DOM verification section and failure-mode rows

**File**: `skills/drawio-skill/references/troubleshooting.md` (modified, +92/-63)
```diff
@@ -1,63 +1,92 @@
-# Troubleshooting — Common Mistakes
-
-Read this when something looks wrong in the output (rendering, export, layout, edges) or when a CLI invocation fails. Most rows have a one-line fix.
-
-| Mistake | Fix |
-|---------|-----|
-| Missing `id="0"` and `id="1"` root cells | Always include both at the top of `<root>` |
-| Shapes not connected | `source` and `target` on edge must match existing shape `id` values |
-| Self-closing edge `mxCell` (`<mxCell ... edge="1" />`) | Use the expanded form with `<mxGeometry relative="1" as="geometry" />` child — self-closing edges won't render |
-| `--` inside XML comments | Illegal per XML spec — use single hyphens or rephrase |
-| Special characters in `value` | Use XML entities: `&amp;` `&lt;` `&gt;` `&quot;` |
-| Literal `\n` in label text | Use `&#xa;` for line breaks in `value` attributes |
-| Overlapping shapes | Scale spacing with complexity (200–350px); leave routing corridors |
-| Edges crossing through shapes | Add waypoints, distribute entry/exit points, or increase spacing |
-| Arrowhead overlaps bend | Final edge segment before target must be ≥20px — increase spacing or add waypoints |
-| Iteration loop never ends | After 5 rounds, suggest user open .drawio in draw.io desktop for fine-tuning |
-| `command not found: draw.io` after `brew install --cask drawio` | Homebrew installs the binary as `drawio` (no dot). Use `drawio --version`, not `draw.io --version`. The dot-name only exists inside the `.app` bundle (`/Applications/draw.io.app/Contents/MacOS/draw.io`) and on Windows (`draw.io.exe`). |
-| Export command not found on macOS | Try full path `/Applications/draw.io.app/Contents/MacOS/draw.io` |
-| Vision returns "Unable to resize image — dimensions exceed the 2576x2576px limit" | The preview PNG is too large for Claude's vision API. Re-export with `--width 2000` instead of `-s 2` (the flag is `--width`; there is no short `-w` — passing `-w 2000` silently breaks input-file parsing and drawio errors with "input file/directory not found"). For very tall-narrow diagrams that still overshoot, use `--height 2000` instead. |
-| Linux: blank/error output headlessly | Prefix command with `xvfb-run -a` |
-| Linux: `--no-sandbox` placed before input file (parsed as filename) | Move `--no-sandbox` to the very end of the command (drawio-desktop#249, #1056) |
-| Linux: `Failed to get 'appData' path` / `Home directory not accessible` | `export HOME=/tmp` before invoking drawio (drawio-desktop#127) |
-| Linux server: segfault / EGL / MESA `failed to load driver` errors | Add `--disable-gpu` (suppresses Chromium GL init when no GPU available) |
-| PDF export fails | Ensure Chromium is available (draw.io bundles it on desktop) |
-| Background color wrong in CLI export | Known CLI bug; add `--transparent` flag or set background via style |
-| Vision returns 400 "Could not process image" on draft PNG | Re-export the preview without `-e` (issue #8). Root cause is a truncated IEND chunk in `-e` PNGs, not the `zTXt` chunk itself — but skipping `-e` for the preview is the simplest fix. |
-| Final `-e` PNG won't open in image viewers / vision APIs | Run `python3 <this-skill-dir>/scripts/repair_png.py <path>`. draw.io CLI emits `-e` PNGs with an 8-byte truncation at IEND. SVG/PDF unaffected. |
-| WSL2: `drawio` / `draw.io` not found | The CLI lives on the Windows side. Use the Windows desktop exe via `/mnt/c`: `"/mnt/c/Program Files/draw.io/draw.io.exe"` (or per-user `"/mnt/c/Users/<you>/AppData/Local/Programs/draw.io/draw.io.exe"`). |
-| WSL2: opening an exported file fails with a `/mnt/c/...`-style path | `cmd.exe` can't resolve WSL paths — convert first: `cmd.exe /c start "" "$(wslpath -w diagram.drawio.png)"`. The empty `""` after `start` is the (required) window title. |
-| Browser URL opens to a blank/empty diagram (Windows/WSL2) | `cmd.exe`'s `start` treats `&` as a separator and drops everything after `#` — so the `#R…`/`#create=…` fragment (the whole diagram) is lost. Never pass the URL straight to `start`. Write a `.url` shortcut file and open *that* (see "WSL2 / Windows" below). |
-
-## WSL2 / Windows specifics
-
-**Locate the CLI.** Detect WSL2 with `grep -qi microsoft /proc/version`. On WSL2 the
-export CLI is the Windows desktop exe, reached through `/mnt/c` (quote the path —
-it contains a space):
-
-```bash
-"/mnt/c/Program Files/draw.io/draw.io.exe" --version
-# per-user install fallback:
-"/mnt/c/Users/$USER/AppData/Local/Programs/draw.io/draw.io.exe" --version
-```
-
-**Open a file.** Convert the WSL path to a Windows path first; `cmd.exe` cannot
-follow `/mnt/c/...`:
-
-```bash
-cmd.exe /c start "" "$(wslpath -w diagram.drawio.png)"
-```
-
-**Open a browser-fallback URL.** `cmd.exe /c start` strips the URL fragment
-(`&` ends the command, `#…` is dropped) — and the fragment carries the entire
-diagram. Write a `.url` shortcut and open it instead, so the URL survives intact:
-
-```bash
-URL=$(python3 <this-skill-dir>/scripts/encode_drawio_url.
```

---

### Incident Patch 4: `9e420789` (2026-09-14)
**Commit Message**: docs: add rendered-output pitfalls to xml-authoring (diamond exits, pixel-exact pins, labels)

**File**: `skills/drawio-skill/references/xml-authoring.md` (modified, +220/-208)
```diff
@@ -1,208 +1,220 @@
-# Authoring .drawio XML
-
-Read this **before hand-writing any `.drawio` XML** (workflow step 3). Skip it when a bundled generator writes the XML for you (`autolayout.py` + importers, `seqlayout.py`).
-
-### File skeleton
-
-```xml
-<?xml version="1.0" encoding="UTF-8"?>
-<mxfile host="drawio" version="26.0.0">
-  <diagram name="Page-1">
-    <mxGraphModel>
-      <root>
-        <mxCell id="0" />
-        <mxCell id="1" parent="0" />
-        <!-- user shapes start at id="2" -->
-      </root>
-    </mxGraphModel>
-  </diagram>
-</mxfile>
-```
-
-**Rules:**
-
-- `id="0"` and `id="1"` are required root cells — never omit them
-- User shapes start at `id="2"` and increment sequentially
-- All shapes have `parent="1"` (unless inside a container — then use container's id)
-- All text uses `html=1` in style for proper rendering
-- **Never use `--` inside XML comments** — it's illegal per XML spec and causes parse errors
-- Escape special characters in attribute values: `&amp;`, `&lt;`, `&gt;`, `&quot;`
-- **Multi-line text in labels:** use `&#xa;` for line breaks inside `value` attributes (not literal `\n`). Example: `value="Line 1&#xa;Line 2"`
-
-### Shape types (vertex)
-
-| Style keyword | Use for |
-| -------------- | --------- |
-| `rounded=0` | plain rectangle (default) |
-| `rounded=1` | rounded rectangle — services, modules |
-| `ellipse;` | circles/ovals — start/end, databases |
-| `rhombus;` | diamond — decision points |
-| `shape=mxgraph.aws4.resourceIcon;` | AWS icons |
-| `shape=cylinder3;` | cylinder — databases |
-| `swimlane;` | group/container with title bar |
-
-For **vendor/branded icons** (AWS/Azure/GCP/Cisco/Kubernetes) and any non-trivial shape, don't guess the `shape=mxgraph.*` name — a wrong name renders as a blank box. Run `python3 <this-skill-dir>/scripts/shapesearch.py "<keywords>"` to get the exact official style + size, or see `references/shapes.md` for the hand-writable cheatsheet. For **AI/LLM brand logos** (OpenAI, Claude, Gemini, …), which draw.io has none of, use `python3 <this-skill-dir>/scripts/aiicons.py "<brand>"`.
-
-### Required properties
-
-```xml
-<!-- Rectangle / rounded box -->
-<mxCell id="2" value="Label" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
-  <mxGeometry x="100" y="100" width="160" height="60" as="geometry" />
-</mxCell>
-
-<!-- Cylinder (database) -->
-<mxCell id="3" value="DB" style="shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;" vertex="1" parent="1">
-  <mxGeometry x="350" y="100" width="120" height="80" as="geometry" />
-</mxCell>
-
-<!-- Diamond (decision) -->
-<mxCell id="4" value="Check?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
-  <mxGeometry x="100" y="220" width="160" height="80" as="geometry" />
-</mxCell>
-```
-
-### Containers and groups
-
-For architecture diagrams with nested elements, use draw.io's parent-child containment — do **not** just place shapes on top of larger shapes.
-
-| Type | Style | When to use |
-| ------ | ------- | ------------- |
-| **Group** (invisible) | `group;pointerEvents=0;` | No visual border needed, container has no connections |
-| **Swimlane** (titled) | `swimlane;startSize=30;` | Container needs a visible title bar, or container itself has connections |
-| **Custom container** | Add `container=1;pointerEvents=0;` to any shape | Any shape acting as a container without its own connections |
-
-**Key rules:**
-
-- Add `pointerEvents=0;` to container styles that should not capture connections between children
-- Children set `parent="containerId"` and use coordinates **relative to the container**
-
-```xml
-<!-- Swimlane container -->
-<mxCell id="svc1" value="User Service" style="swimlane;startSize=30;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1">
-  <mxGeometry x="100" y="100" width="300" height="200" as="geometry"/>
-</mxCell>
-<!-- Child inside container — coordinates relative to parent -->
-<mxCell id="api1" value="REST API" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="svc1">
-  <mxGeometry x="20" y="40" width="120" height="60" as="geometry"/>
-</mxCell>
-<mxCell id="db1" value="Database" style="shape=cylinder3;whiteSpace=wrap;html=1;" vertex="1" parent="svc1">
-  <mxGeometry x="160" y="40" width="120" height="60" as="geometry"/>
-</mxCell>
-```
-
-### Connector (edge)
-
-**CRITICAL:** Every edge `mxCell` must contain a `<mxGeometry relative="1" as="geometry" />` child element. Self-closing edge cells (`<mxCell ... edge="1" ... />`) are **invalid** and will not render. Always use the expanded form.
-
-```xml
-<!-- Directed arrow — always include rounded, orthogonalLoop, jettySize for clean routing -->
-<mxCell id="10" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="2" target="3">
-  <mxGeometry relative="1" as="geom
```

---

### Incident Patch 5: `ccb3e094` (2026-09-13)
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

### Incident Patch 6: `a12b3a91` (2026-09-11)
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

### Incident Patch 7: `de9d6386` (2026-09-11)
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

### Incident Patch 8: `fa37b6f8` (2026-09-11)
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

### Incident Patch 9: `88cde5ed` (2026-09-11)
**Commit Message**: style: normalize formatting in drawiodiff + build_hero_gif

Black-style reformat (line wrapping, import spacing); no behavior change.

**File**: `examples/hero-demo/build_hero_gif.py` (modified, +78/-17)
```diff
@@ -5,6 +5,7 @@
 Needs: drawio CLI, ffmpeg, Pillow. Outputs are written next to this script and
 the final GIF lands in assets/hero-demo.gif.
 """
+
 import subprocess
 import sys
 import tempfile
@@ -27,19 +28,51 @@
 
 
 def run(cmd, cwd=ROOT):
-    subprocess.run([str(c) for c in cmd], check=True, cwd=cwd,
-                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
+    subprocess.run(
+        [str(c) for c in cmd],
+        check=True,
+        cwd=cwd,
+        stdout=subprocess.DEVNULL,
+        stderr=subprocess.DEVNULL,
+    )
 
 
 def build_diagrams(tmp):
     for name, tf in (("v1", "main.tf"), ("v2", "main-v2.tf")):
         graph = tmp / f"{name}.json"
-        run([sys.executable, SCRIPTS / "tfimports.py", HERE / tf,
-             "--direction", "LR", "-o", graph])
-        run([sys.executable, SCRIPTS / "autolayout.py", graph,
-             "-o", HERE / f"{name}.drawio"])
-        run(["drawio", "-x", "-f", "png", "--width", "1200",
-             "-o", tmp / f"{name}.png", HERE / f"{name}.drawio"])
+        run(
+            [
+                sys.executable,
+                SCRIPTS / "tfimports.py",
+                HERE / tf,
+                "--direction",
+                "LR",
+                "-o",
+                graph,
+            ]
+        )
+        run(
+            [
+                sys.executable,
+                SCRIPTS / "autolayout.py",
+                graph,
+                "-o",
+                HERE / f"{name}.drawio",
+            ]
+        )
+        run(
+            [
+                "drawio",
+                "-x",
+                "-f",
+                "png",
+                "--width",
+                "1200",
+                "-o",
+                tmp / f"{name}.png",
+                HERE / f"{name}.drawio",
+            ]
+        )
 
 
 def code_frame(path, highlight_from=None):
@@ -48,8 +81,10 @@ def code_frame(path, highlight_from=None):
     panel = (40, 40, W - 40, H - 40)
     d.rounded_rectangle(panel, radius=18, fill=PANEL)
     lines = path.read_text().splitlines()
-    start = next((i for i, ln in enumerate(lines)
-                  if highlight_from and highlight_from in ln), len(lines))
+    start = next(
+        (i for i, ln in enumerate(lines) if highlight_from and highlight_from in ln),
+        len(lines),
+    )
     per_col, line_h, col_w = 18, 23, 600
     for i, line in enumerate(lines):
         col, row = divmod(i, per_col)
@@ -93,8 +128,7 @@ def main():
         frames = [
             code_frame(HERE / "main.tf"),
             diagram_frame(tmp / "v1.png"),
-            code_frame(HERE / "main-v2.tf",
-                       highlight_from="# v2 adds"),
+            code_frame(HERE / "main-v2.tf", highlight_from="# v2 adds"),
             diagram_frame(tmp / "v2.png"),
         ]
         listfile = tmp / "frames.txt"
@@ -105,11 +139,38 @@ def main():
                 f.write(f"file '{p.name}'\nduration {HOLD_S}\n")
             f.write("file 'frame3.png'\n")
         palette = tmp / "palette.png"
-        run(["ffmpeg", "-y", "-f", "concat", "-i", listfile.name,
-             "-vf", "palettegen", "-update", "1", palette.name], cwd=tmp)
-        run(["ffmpeg", "-y", "-f", "concat", "-i", listfile.name,
-             "-i", palette.name,
-             "-lavfi", "fps=10 [x]; [x][1:v] paletteuse", OUT], cwd=tmp)
+        run(
+            [
+                "ffmpeg",
+                "-y",
+                "-f",
+                "concat",
+                "-i",
+                listfile.name,
+                "-vf",
+                "palettegen",
+                "-update",
+                "1",
+                palette.name,
+            ],
+            cwd=tmp,
+        )
+        run(
+            [
+                "ffmpeg",
+                "-y",
+                "-f",
+                "concat",
+                "-i",
+                listfile.name,
+                "-i",
+                palette.name,
+                "-lavfi",
+                "fps=10 [x]; [x][1:v] paletteuse",
+                OUT,
+            ],
+            cwd=tmp,
+        )
     print(f"wrote {OUT}")
 
 
```

**File**: `skills/drawio-skill/scripts/drawiodiff.py` (modified, +52/-30)
```diff
@@ -43,23 +43,24 @@
 Usage: python3 drawiodiff.py <old.drawio> <new.drawio> [-o diff.json]
        [--direction TB|LR] [--by-label]
 """
+
 import argparse
 import json
 import sys
 import xml.etree.ElementTree as ET
 
 STYLE = {
-    "added":   "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
+    "added": "rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;",
     "removed": "rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;dashed=1;",
     "changed": "rounded=1;whiteSpace=wrap;html=1;fillColor=#ffe6cc;strokeColor=#d79b00;",
-    "moved":   "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;",
-    "same":    "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;",
+    "moved": "rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;",
+    "same": "rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#999999;",
 }
 EDGE_STYLE = {
-    "added":    "endArrow=classic;html=1;strokeColor=#82b366;strokeWidth=2;",
-    "removed":  "endArrow=classic;html=1;strokeColor=#b85450;strokeWidth=2;dashed=1;",
+    "added": "endArrow=classic;html=1;strokeColor=#82b366;strokeWidth=2;",
+    "removed": "endArrow=classic;html=1;strokeColor=#b85450;strokeWidth=2;dashed=1;",
     "rerouted": "endArrow=classic;html=1;strokeColor=#d79b00;strokeWidth=2;",
-    "same":     "endArrow=classic;html=1;strokeColor=#999999;",
+    "same": "endArrow=classic;html=1;strokeColor=#999999;",
 }
 
 
@@ -90,20 +91,22 @@ def parse(path):
                 if inner is not None:
                     inner.set("id", child.get("id", ""))
                     cells.append(inner)
-                    labels[child.get("id")] = child.get("label") or child.get("value") or ""
-    parents = {c.get("parent") for c in cells}                # ids that have children
+                    labels[child.get("id")] = (
+                        child.get("label") or child.get("value") or ""
+                    )
+    parents = {c.get("parent") for c in cells}  # ids that have children
     nodes, edges = {}, set()
     for c in cells:
         cid = c.get("id")
         if c.get("edge") == "1":
             s, t = c.get("source"), c.get("target")
             if s and t:
                 edges.add((s, t))
-        elif c.get("vertex") == "1" and cid not in parents:   # leaf vertices only
+        elif c.get("vertex") == "1" and cid not in parents:  # leaf vertices only
             if "edgeLabel" in (c.get("style") or ""):
                 continue
             g = c.find("mxGeometry")
-            if g is not None and g.get("relative") == "1":    # edge-label child
+            if g is not None and g.get("relative") == "1":  # edge-label child
                 continue
             pos = None
             if g is not None:
@@ -128,7 +131,7 @@ def classify_rerouted(old_ek, new_ek, removed, added):
     rerouted = {(s, t) for (s, t) in new_only if (t, s) in old_only}
     for a, b in old_only:
         if (b, a) in new_only:
-            continue                                          # flip, handled above
+            continue  # flip, handled above
         if b in removed and a not in removed:
             cands = [(a, c) for (s, c) in new_only if s == a and c in added]
             if len(cands) == 1:
@@ -141,14 +144,19 @@ def classify_rerouted(old_ek, new_ek, removed, added):
 
 
 def main():
-    ap = argparse.ArgumentParser(description="Diff two .drawio files -> autolayout graph JSON.")
+    ap = argparse.ArgumentParser(
+        description="Diff two .drawio files -> autolayout graph JSON."
+    )
     ap.add_argument("old", help="baseline .drawio")
     ap.add_argument("new", help="updated .drawio")
     ap.add_argument("-o", "--output", help="output JSON path (default: stdout)")
     ap.add_argument("--direction", default="TB", choices=["TB", "LR"])
-    ap.add_argument("--by-label", action="store_true",
-                    help="match nodes by visible label instead of cell id "
-                         "(for hand-drawn diagrams with non-stable ids)")
+    ap.add_argument(
+        "--by-label",
+        action="store_true",
+        help="match nodes by visible label instead of cell id "
+        "(for hand-drawn diagrams with non-stable ids)",
+    )
     args = ap.parse_args()
 
     old_n, old_e = parse(args.old)
@@ -158,7 +166,9 @@ def keyed(nodes):
         """Map match-key -> label. By id (default) the key is the cell id and the
         value is its label; by label the key *is* the label."""
         if args.by_label:
-            return {lbl: lbl for lbl, _, _ in nodes.values()}, {i: lbl for i, (lbl, _, _) in nodes.items()}
+            return {lbl: lbl for lbl, _, _ in nodes.values()}, {
+                i: lbl for i, (lbl, _, _) in nodes.items()
+            }
         return {i: lbl for i, (lbl, _, _) in nodes.items()}, {i: i for i in nodes}
 
     old_keys, old_id2key = keyed(old_n)
@@ -168,29 +178,39 @@ de
```

---

### Incident Patch 10: `52efb289` (2026-09-09)
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

### Incident Patch 11: `eee63bdb` (2026-09-08)
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

### Incident Patch 12: `7364f06a` (2026-08-25)
**Commit Message**: test: cover dbxicons manifest integrity, resolution, and data-URI builder

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `tests/test_dbxicons.py` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+"""Tests for scripts/dbxicons.py (Databricks product icon resolver).
+
+Pure-function tests against the committed manifest plus one CLI --json check.
+No network — the data-URI builder is fed literal SVG bytes.
+"""
+import importlib.util
+import json
+import os
+import subprocess
+import sys
+import unittest
+
+ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
+SCRIPTS = os.path.join(ROOT, "skills", "drawio-skill", "scripts")
+DATA = os.path.join(ROOT, "skills", "drawio-skill", "data")
+
+
+def load(name):
+    path = os.path.join(SCRIPTS, name + ".py")
+    spec = importlib.util.spec_from_file_location(name, path)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def run(script, *args, **kw):
+    return subprocess.run(
+        [sys.executable, os.path.join(SCRIPTS, script), *args],
+        capture_output=True, text=True, **kw)
+
+
+class TestDbxIcons(unittest.TestCase):
+    @classmethod
+    def setUpClass(cls):
+        cls.m = load("dbxicons")
+        with open(os.path.join(DATA, "databricks-icons.json"), encoding="utf-8") as fh:
+            cls.manifest = json.load(fh)
+        cls.products = cls.manifest["products"]
+
+    def test_manifest_loads(self):
+        slugs = [p["slug"] for p in self.products]
+        self.assertEqual(len(slugs), 71)
+        self.assertEqual(len(slugs), len(set(slugs)))
+        self.assertRegex(self.manifest["pinnedRef"], r"^[0-9a-f]{40}$")
+
+    def test_every_category_exists(self):
+        for p in self.products:
+            self.assertIn(p["category"], self.manifest["categories"])
+            self.assertEqual(p["categoryColor"],
+                             self.manifest["categories"][p["category"]]["color"])
+
+    def test_manifest_carries_facts_only(self):
+        for p in self.products:
+            self.assertEqual(sorted(p), ["aliases", "category", "categoryColor",
+                                         "name", "slug"])
+
+    def test_exact_slug(self):
+        hits = self.m.resolve(self.products, "unity-catalog", 8)
+        self.assertEqual(len(hits), 1)
+        self.assertEqual(hits[0]["slug"], "unity-catalog")
+
+    def test_alias_resolution(self):
+        # Renamed products resolve by their former names, case-insensitively.
+        self.assertEqual(self.m.resolve(self.products, "DLT", 8)[0]["slug"],
+                         "spark-declarative-pipelines")
+        self.assertEqual(self.m.resolve(self.products, "delta live tables", 8)[0]["slug"],
+                         "spark-declarative-pipelines")
+        self.assertEqual(self.m.resolve(self.products, "Workflows", 8)[0]["slug"],
+                         "lakeflow-jobs")
+
+    def test_search_ranks_substring(self):
+        hits = self.m.search(self.products, "vector", 8)
+        self.assertTrue(hits)
+        self.assertEqual(hits[0]["slug"], "ai-search")
+
+    def test_unknown_product(self):
+        self.assertEqual(self.m.search(self.products, "definitelynotaproduct", 3), [])
+
+    def test_url_style(self):
+        p = self.m.resolve(self.products, "unity-catalog", 1)[0]
+        style = self.m.STYLE + f"{self.manifest['hostedBase']}/{self.m.icon_path(p, 'color')}"
+        self.assertTrue(style.startswith("shape=image"))
+        self.assertIn("image=https://oieduardorabelo.github.io/", style)
+        self.assertTrue(style.endswith("icons/svg/unity-catalog.svg"))
+        self.assertTrue(self.m.icon_path(p, "tile").startswith("icons/svg-tile/"))
+        self.assertTrue(self.m.icon_path(p, "outline").startswith("icons/svg-outline/"))
+
+    def test_data_uri_has_no_base64_marker(self):
+        # draw.io splits style values on ';' — a ';base64,' marker would
+        # truncate the image= value (issue #80).
+        uri = self.m.data_uri(b'<svg xmlns="http://www.w3.org/2000/svg"></svg>')
+        self.assertTrue(uri.startswith("data:image/svg+xml,"))
+        self.assertNotIn(";base64", uri)
+        self.assertNotIn(";", uri)
+
+    def test_parse_aka(self):
+        self.assertEqual(
+            self.m.parse_aka("Lakeflow Declarative Pipelines. Formerly Delta Live Tables (DLT)"),
+            ["Lakeflow Declarative Pipelines", "Delta Live Tables (DLT)"])
+        self.assertEqual(self.m.parse_aka("formerly A / B"), ["A", "B"])
+        self.assertEqual(self.m.parse_aka(None), [])
+
+    def test_cli_json(self):
+        cp = run("dbxicons.py", "DLT", "--json")
+        self.assertEqual(cp.returncode, 0, cp.stderr)
+        results = json.loads(cp.stdout)
+        self.assertEqual(results[0]["product"], "spark-declarative-pipelines")
+        self.assertTrue(results[0]["style"].startswith("shape=image"))
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 13: `ec0b52b3` (2026-08-23)
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

### Incident Patch 14: `ac77fe34` (2026-08-22)
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

### Incident Patch 15: `4d9b3116` (2026-08-21)
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

**File**: `skills/drawio-skill/scripts/pyimports.py` (modified, +4/-2)
```diff
@@ -61,7 +61,8 @@ def edges_of(name, path, modules):
     pkg = name if path.endswith("__init__.py") else name.rsplit(".", 1)[0] if "." in name else ""
     found = set()
     try:
-        tree = ast.parse(open(path, encoding="utf-8").read(), filename=path)
+        with open(path, encoding="utf-8") as f:
+            tree = ast.parse(f.read(), filename=path)
     except SyntaxError:
         return found
     for node in ast.walk(tree):
@@ -141,7 +142,8 @@ def node(m):
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

**File**: `skills/drawio-skill/scripts/rustimports.py` (modified, +6/-4)
```diff
@@ -37,8 +37,8 @@
 def crate_name(root):
     cargo = os.path.join(root, "Cargo.toml")
     if os.path.exists(cargo):
-        m = re.search(r'(?m)^\s*name\s*=\s*"([^"]+)"',
-                      open(cargo, encoding="utf-8", errors="ignore").read())
+        with open(cargo, encoding="utf-8", errors="ignore") as f:
+            m = re.search(r'(?m)^\s*name\s*=\s*"([^"]+)"', f.read())
         if m:
             return m.group(1)
     return "crate"
@@ -117,7 +117,8 @@ def edges_of(current, path, modules):
     """Intra-crate module paths used by the module at `current`."""
     found = set()
     try:
-        src = open(path, encoding="utf-8", errors="ignore").read()
+        with open(path, encoding="utf-8", errors="ignore") as f:
+            src = f.read()
     except OSError:
         return found
     for stmt in USE.findall(src):
@@ -191,7 +192,8 @@ def node(parts):
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

**File**: `skills/drawio-skill/scripts/tfstate.py` (modified, +5/-1)
```diff
@@ -60,7 +60,11 @@ def main():
                     help="plain boxes instead of official cloud icons")
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

#### Recent Merged Pull Requests:
- **PR #136** (2026-10-02): chore: simplify the SKILL.md routing description (@Agents365-ai)
- **PR #135** (2026-10-01): chore: hide the skill from automatic model invocation (@Agents365-ai)
- **PR #134** (2026-09-14): chore(release): v3.4.0 (@Agents365-ai)
- **PR #133** (2026-09-14): chore: stop syncing to 365-skills, keep this repo standalone (@Agents365-ai)
- **PR #132** (2026-09-14): docs: rendered-output pitfalls (diamond exits, pixel-exact pins, labels) + DOM verification workflow (@xiaoraoxiaorao)
- **PR #131** (2026-09-13): feat: add GraphQL SDL importer (graphqlerd.py) (#121) (@MannXo)
- **PR #130** (2026-09-11): chore(release): v3.3.0 (@Agents365-ai)
- **PR #128** (2026-09-11): feat: add Protocol Buffers importer (protoimports.py) (@Chirudeva-Reddy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
