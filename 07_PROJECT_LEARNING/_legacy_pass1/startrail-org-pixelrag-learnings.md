# Forensic Learning Record (Deep Inspection): StarTrail-org/PixelRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/startrail-org-pixelrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarTrail-org/PixelRAG](https://github.com/StarTrail-org/PixelRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:49:01.150Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarTrail-org/PixelRAG`
- **Description**: https://arxiv.org/abs/2606.28344. The end of web parsing. The beginning of scalable pixel-native search. link: https://pixelrag.ai/
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 10119 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `demos/agent_skill.py`
```
#!/usr/bin/env python3
"""PixelRAG Agent — Claude + tool_use for visual web search.

A real Anthropic agent that uses Claude to answer questions by searching
a visual Wikipedia index via PixelRAG. Claude decides when to call the
search tool and synthesizes answers from visual retrieval results.

Prerequisites:
    - ANTHROPIC_API_KEY env var set
    - pixelrag serve running on localhost:30001 (or set --endpoint)

Usage:
    # Interactive conversation with the agent
    python demos/agent_skill.py

    # Single question
    python demos/agent_skill.py "Who invented the telephone?"

    # Custom endpoint
    python demos/agent_skill.py --endpoint http://gpu-box:30001 "Eiffel Tower history"
"""

import argparse
import json
import sys
import urllib.request

import anthropic

SEARCH_TOOL = {
    "name": "pixelrag_search",
    "description": (
        "Search a visual Wikipedia index using natural language queries. "
        "Returns ranked results with article URLs and relevance scores. "
        "Use this tool to find information about any topic — it searches "
        "screenshot-based embeddings of Wikipedia articles, so it works well "
        "for both textual and visual content."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language search query",
            },
            "n_results": {
                "type": "integer",
                "description": "Number of results to return (default 5, max 20)",
                "default": 5,
            },
        },
        "required": ["query"],
    },
}

WEB_FETCH_TOOL = {
    "name": "web_fetch",
    "description": (
        "Fetch the text content of a URL. Use this to read Wikipedia articles "
        "or other web pages found via search. Returns the page text content."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "URL to fetch",
            },
        },
        "required": ["url"],
    },
}

TOOLS = [SEARCH_TOOL, WEB_FETCH_TOOL]

SYSTEM_PROMPT = """\
You are a research assistant with access to a visual Wikipedia search engine (PixelRAG).
When asked a question, use the pixelrag_search tool to find relevant Wikipedia articles,
then synthesize an answer from the results. You may search multiple times with different
queries to gather comprehensive information. Cite your sources with Wikipedia URLs.

If search results are insufficient, say so honestly rather than guessing."""


def execute_pixelrag_search(
    query: str, n_results: int = 5, endpoint: str = "http://localhost:30001"
) -> dict:
    """Call the PixelRAG search API."""
    body = json.dumps(
        {"queries": [{"text": query}], "n_docs": min(n_results, 20)}
    ).encode()
    req = urllib.request.Request(
        f"{endpoint}/search",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    hits = data.get("results", [{}])[0].get("hits", [])
    results = []
    for hit in hits:
        url = hit.get("url", "")
        slug = url.split("/wiki/")[-1] if "/wiki/" in url else ""
        title = slug.replace("_", " ") if slug else url
        results.append(
            {
                "title": title,
                "url": url,
                "score": round(hit["score"], 4),
                "tile": f"tile_{hit.get('tile_index', '?')}_chunk_{hit.get('chunk_index', '?')}",
            }
        )
    return {"query": query, "results": results, "count": len(results)}


def execute_web_fetch(url: str) -> dict:
    """Fetch text from a URL (simplified — returns first 4000 chars)."""
    req = urllib.request.Request(url, headers={"User-Agent": "PixelRAG-Agent/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8", errors="replace")

    # Strip HTML tags for a rough text extraction
    import re

    text = re.sub(r"<script[^>]*>.*?</script>", "", raw, flags=re.DOTALL)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return {"url": url, "content": text[:4000], "truncated": len(text) > 4000}


def handle_tool_call(tool_name: str, tool_input: dict, endpoint: str) -> str:
    """Execute a tool call and return the result as a string."""
    try:
        if tool_name == "pixelrag_search":
            result = execute_pixelrag_search(
                query=tool_input["query"],
                n_results=tool_input.get("n_results", 5),
                endpoint=endpoint,
            )
        elif tool_name == "web_fetch":
            result = execute_web_fetch(url=tool_input["url"])
        else:
            result = {"error": f"Unknown tool: {tool_name}"}
    except Exception as e:
        result = {"error": str(e)}
    return json.dumps(result)


def run_agent(
    question: str,
    endpoint: str,
    model: str = "claude-sonnet-4-20250514",
    verbose: bool = False,
) -> str:
    """Run the agent loop: send question → handle tool calls → return final answer."""
    client = anthropic.Anthropic()
    messages = [{"role": "user", "content": question}]

    while True:
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        if verbose:
            print(
                f"  [stop_reason={response.stop_reason}, usage={response.usage}]",
                file=sys.stderr,
            )

        if response.stop_reason == "end_turn":
            # Extract text from response
            text_parts = [b.text for b in response.content if b.type == "text"]
            return "\n".join(text_parts)

        # Handle tool use
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                if verbose:
                    print(
                        f"  [tool: {block.name}({json.dumps(block.input, ensure_ascii=False)})]",
                        file=sys.stderr,
                    )
                result = handle_tool_call(block.name, block.input, endpoint)
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    }
                )

        if not tool_results:
            # No tool calls and not end_turn — shouldn't happen, but handle gracefully
            text_parts = [b.text for b in response.content if b.type == "text"]
            return "\n".join(text_parts) if text_parts else "(no response)"

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})


def interactive(endpoint: str, model: str, verbose: bool):
    """Run interactive conversation loop."""
    print("PixelRAG Agent (Claude + visual search)")
    print(f"  endpoint: {endpoint}")
    print(f"  model:    {model}")
    print("  Type 'quit' to exit.\n")

    while True:
        try:
            question = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not question or question.lower() in ("quit", "exit", "q"):
            break

        print()
        try:
            answer = run_agent(question, endpoint, model, verbose)
            print(f"Agent: {answer}\n")
        except anthropic.APIError as e:
            print(f"API error: {e}\n")
        except Exception as e:
            print(f"Error: {e}\n")


def main():
    parser = argparse.ArgumentParser(
        description="PixelRAG Agent — Claude + visual web search"
    )
    parser.add_argumen
```

### Core Architecture Module: `demos/e2e/run.py`
```
#!/usr/bin/env python3
"""End-to-end demo: Wikipedia → visual search index → query.

Demonstrates the full PixelRAG pipeline via pixelrag index:
  source → ingest → chunk → embed → build index → serve → search

Run:
    cd pixelrag
    uv run python demos/e2e/run.py
    uv run python demos/e2e/run.py --limit 50
    uv run python demos/e2e/run.py --skip-build  # just serve existing index
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("e2e_demo")

DEFAULT_OUTPUT = Path(__file__).parent / "output"

SAMPLE_QUERIES = [
    "theory of relativity physics",
    "photosynthesis plants energy",
    "world war two history",
    "programming language computer",
    "solar system planets",
    "human brain neuroscience",
    "climate change global warming",
    "DNA genetics biology",
]


def search(query: str, port: int) -> list[dict]:
    body = json.dumps({"queries": [{"text": query}], "n_docs": 5}).encode()
    req = urllib.request.Request(
        f"http://localhost:{port}/search",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data.get("results", [{}])[0].get("hits", [])


def _generate_html_report(results: list[dict], html_path: Path) -> None:
    """Generate an HTML page showing search results with tile images."""
    import base64

    rows = []
    for r in results:
        query = r["query"]
        rows.append(f'<h2>Q: "{query}"</h2>')
        for i, h in enumerate(r.get("hits", [])[:3]):
            url = h.get("url", "")
            title = (
                url.split("/")[-1].replace("_", " ") if url else f"#{h['article_id']}"
            )
            score = h["score"]
            tile_html = ""
            tile_path = h.get("_tile_path")
            if tile_path and Path(tile_path).exists():
                data = Path(tile_path).read_bytes()
                ext = Path(tile_path).suffix.lstrip(".")
                b64 = base64.b64encode(data).decode()
                tile_html = f'<img src="data:image/{ext};base64,{b64}" style="max-width:600px;border:1px solid #ddd;border-radius:4px;">'
            rows.append(f"""
            <div style="margin:1em 0;padding:1em;border:1px solid #222;border-radius:8px;background:#111;">
              <div style="color:#4a9eff;font-weight:600;">{i + 1}. {score:.3f} — {title}</div>
              {f'<div style="margin-top:0.5em;">{tile_html}</div>' if tile_html else ""}
            </div>""")

    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PixelRAG E2E Results</title>
<style>body{{font-family:system-ui;background:#0a0a0a;color:#e0e0e0;max-width:800px;margin:2em auto;padding:0 1em;}}
h1{{color:#fff;}}h2{{color:#aaa;margin-top:2em;}}</style></head>
<body><h1>PixelRAG Search Results</h1>
{"".join(rows)}
</body></html>"""
    html_path.write_text(html)


def main() -> None:
    parser = argparse.ArgumentParser(description="PixelRAG E2E Demo")
    parser.add_argument("--limit", "-n", type=int, default=100)
    parser.add_argument(
        "--config", "-c", type=Path, default=Path(__file__).parent / "pixelrag.yaml"
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--device", default="cpu", choices=["cpu", "cuda"])
    parser.add_argument("--serve-port", type=int, default=31337)
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument(
        "--show-tiles",
        action="store_true",
        help="Display tile images in terminal (requires chafa)",
    )
    args = parser.parse_args()

    output = args.output.resolve()

    print("=" * 60)
    print("  PixelRAG End-to-End Demo")
    print("=" * 60)
    print(f"  Articles:  {args.limit}")
    print(f"  Device:    {args.device}")
    print(f"  Output:    {output}")
    print()

    # --- Build index ---
    if not args.skip_build:
        from pixelrag_index.config import load_config
        from pixelrag_index.pipelines import build

        config = load_config(str(args.config))
        if args.device:
            config.setdefault("embed", {})["device"] = args.device
        config["output"] = str(output)

        t0 = time.time()
        build(config, limit=args.limit)
        total_time = time.time() - t0
        print(f"\n  Pipeline completed in {total_time:.1f}s\n")

    # --- Serve + Search ---
    logger.info("Starting search API on :%d...", args.serve_port)
    env = os.environ.copy()
    env["PIXELRAG_INDEX_DIR"] = str(output)
    env["PIXELRAG_ARTICLES_JSON"] = str(output / "articles.json")
    serve_proc = subprocess.Popen(
        [sys.executable, "-m", "pixelrag_serve.api", "--port", str(args.serve_port)],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        for _ in range(120):
            try:
                urllib.request.urlopen(
                    f"http://localhost:{args.serve_port}/health", timeout=1
                )
                break
            except Exception:
                time.sleep(2)
        else:
            raise TimeoutError("Search API failed to start")

        print("=" * 60)
        print("  Search Results")
        print("=" * 60)

        all_results = []
        for query in SAMPLE_QUERIES:
            hits = search(query, args.serve_port)
            all_results.append({"query": query, "hits": hits})
            print(f'\n  Q: "{query}"')
            if not hits:
                print("    (no results)")
                continue
            for i, h in enumerate(hits[:3]):
                url = h.get("url", "")
                score = h["score"]
                # Extract readable title from URL
                if url:
                    title = (
                        url.split("/")[-1]
                        .replace("_", " ")
                        .replace("%22", '"')
                        .replace("%20", " ")
                    )
                    title = urllib.parse.unquote(title)
                else:
                    title = f"#{h['article_id']}"
                print(f"    {i + 1}. {score:.3f}  {title}")
                # Collect tile path for HTML report
                if args.show_tiles:
                    aid = h["article_id"]
                    ti = h.get("tile_index", 0)
                    ci = h.get("chunk_index", 0)
                    for candidate in [
                        output
                        / "tiles"
                        / f"{aid}.png.tiles"
                        / f"chunk_{ti:04d}_{ci:02d}.png",
                        output / "tiles" / f"{aid}.png.tiles" / f"tile_{ti:04d}.jpg",
                    ]:
                        if candidate.exists():
                            h["_tile_path"] = str(candidate)
                            break

        # Generate HTML results page with tile images
        if args.show_tiles:
            html_path = output / "results.html"
            _generate_html_report(all_results, html_path)
            print(f"\n  Results with images: file://{html_path}")

        print()
        print(f"Search API: http://localhost:{args.serve_port}")
        print(
            f"Try: curl -X POST http://localhost:{args.serve_port}/search "
            f"-H 'Content-Type: application/json' "
            f'-d \'{{"queries": [{{"text": "your query"}}], "n_docs": 5}}\''
        )

    finally:
        serve_proc.terminate()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `demos/render/run.py`
```
#!/usr/bin/env python3
"""Ingest demo: capture heterogeneous documents as tiled screenshots.

Demonstrates pixelshot rendering a mix of:
- Wikipedia article URLs (via CDP lean capture)
- Local HTML files (auto-detected, rendered via file:// URL)
- Could also handle PDFs (requires pdf2image)

Run:
    cd pixelrag
    uv run python demos/render/run.py
"""

import shutil
import time
from pathlib import Path

OUTPUT = Path("demos/render/output")

# --- Sample data ---

WIKI_URLS = [
    "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
    "https://en.wikipedia.org/wiki/Screenshot",
    "https://en.wikipedia.org/wiki/FAISS",
]

SAMPLE_HTML = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>
body {{ font-family: Georgia, serif; max-width: 800px; margin: 2em auto; padding: 0 1em; line-height: 1.6; }}
h1 {{ color: #1a1a2e; border-bottom: 2px solid #e2e2e2; padding-bottom: .3em; }}
table {{ border-collapse: collapse; width: 100%; margin: 1em 0; }}
th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
th {{ background: #f5f5f5; }}
.highlight {{ background: #fff3cd; padding: .2em .4em; border-radius: 3px; }}
</style></head>
<body>
<h1>{title}</h1>
<p>{body}</p>
{extra}
</body></html>"""


def create_sample_html(output_dir: Path) -> list[Path]:
    """Create sample HTML files to demonstrate local file ingestion."""
    html_dir = output_dir / "sample_html"
    html_dir.mkdir(parents=True, exist_ok=True)

    files = []

    # A simple article-style page
    p1 = html_dir / "visual_retrieval.html"
    p1.write_text(
        SAMPLE_HTML.format(
            title="Visual Document Retrieval",
            body=(
                "Visual document retrieval captures documents as images and uses "
                "vision-language models to embed them into a shared vector space. "
                "Unlike text-based retrieval which requires parsing, visual retrieval "
                "preserves <span class='highlight'>layout, tables, figures, and formatting</span> "
                "that text extraction often loses."
            ),
            extra="""
<h2>Comparison</h2>
<table>
<tr><th>Method</th><th>Preserves Layout</th><th>Handles Tables</th><th>Needs Parser</th></tr>
<tr><td>Text extraction</td><td>No</td><td>Partial</td><td>Yes</td></tr>
<tr><td>HTML rendering</td><td>Partial</td><td>Yes</td><td>Yes</td></tr>
<tr><td><b>Visual (screenshot)</b></td><td><b>Yes</b></td><td><b>Yes</b></td><td><b>No</b></td></tr>
</table>
""",
        )
    )
    files.append(p1)

    # A data-heavy page with tables
    p2 = html_dir / "benchmark_results.html"
    rows = "".join(
        f"<tr><td>Config {i}</td><td>{70 + i * 1.3:.1f}</td><td>{0.5 + i * 0.02:.2f}s</td><td>{'LoRA' if i % 2 else 'Base'}</td></tr>"
        for i in range(15)
    )
    p2.write_text(
        SAMPLE_HTML.format(
            title="PixelRAG Benchmark Results",
            body="Evaluation results across different configurations and model variants.",
            extra=f"""
<h2>SimpleQA Retrieval Scores</h2>
<table>
<tr><th>Configuration</th><th>Recall@1</th><th>Latency</th><th>Model</th></tr>
{rows}
</table>
""",
        )
    )
    files.append(p2)

    return files


def main() -> None:
    from pixelrag_render.render import render_file

    # Clean previous output
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    print("=" * 60)
    print("  PixelRAG Ingest Demo: Heterogeneous Documents")
    print("=" * 60)
    print()

    # --- Step 1: Create sample local HTML ---
    print("[1] Creating sample HTML files...")
    html_files = create_sample_html(OUTPUT)
    for f in html_files:
        print(f"    {f.name} ({f.stat().st_size / 1024:.1f} KB)")
    print()

    tiles_dir = OUTPUT / "tiles"
    tiles_dir.mkdir()
    all_results: list[tuple[str, int, float]] = []

    # --- Step 2: Render Wikipedia URLs ---
    print(f"[2] Rendering {len(WIKI_URLS)} Wikipedia articles (CDP backend)...")
    t0 = time.time()
    from pixelrag_render.render import render_urls

    url_tiles = render_urls(WIKI_URLS, str(tiles_dir), backend="cdp", workers=3)
    elapsed = time.time() - t0
    for td in url_tiles:
        n = len(list(td.glob("tile_*")))
        name = td.name.replace(".png.tiles", "")
        all_results.append((f"URL: {name}", n, elapsed / len(WIKI_URLS)))
    print(f"    {len(url_tiles)} pages rendered in {elapsed:.1f}s")
    print()

    # --- Step 3: Render local HTML files ---
    print(f"[3] Rendering {len(html_files)} local HTML files...")
    for html_file in html_files:
        t0 = time.time()
        result = render_file(str(html_file), str(tiles_dir), backend="cdp")
        elapsed = time.time() - t0
        for td in result:
            n = len(list(Path(td).glob("tile_*")))
            all_results.append((f"HTML: {html_file.name}", n, elapsed))
    print(f"    {len(html_files)} files rendered")
    print()

    # --- Summary ---
    print("=" * 60)
    print("  Results")
    print("=" * 60)
    total_tiles = 0
    for name, n_tiles, elapsed in all_results:
        total_tiles += n_tiles
        print(f"  {name:<45} {n_tiles:>3} tiles  {elapsed:.1f}s")
    print(f"  {'─' * 55}")
    print(f"  {'TOTAL':<45} {total_tiles:>3} tiles")
    print()

    # Show output structure
    print("Output structure:")
    for td in sorted(tiles_dir.iterdir()):
        if td.is_dir():
            tiles = list(td.glob("tile_*"))
            size = sum(t.stat().st_size for t in tiles) / 1024
            print(f"  {td.name}/")
            print(f"    {len(tiles)} tiles, {size:.0f} KB total")
    print()
    print(f"All output in: {tiles_dir}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `embed/src/pixelrag_embed/chunk.py`
```
#!/usr/bin/env python3
"""Pre-chunk tile images into model-sized pieces on disk.

For each article directory (*.png.tiles/), reads every tile_XXXX.png and splits
it into a grid of <=1024px-tall x <=viewport_width-wide chunks (writing
chunk_XXXX_YY.png files) plus a chunks.json manifest recording each chunk's
x_offset/y_offset/width/height. Narrow web tiles (<= viewport_width) keep their
old single-column height-strip layout; wider sources (PDFs, landscape pages) are
also split along the width so the embedder never has to drop an oversized chunk.

Usage:
    # Single shard
    python chunk_tiles.py --shard-dir /opt/dlami/nvme/kiwix_tiles/shard_100

    # All shards (parallel)
    python chunk_tiles.py --tiles-dir /opt/dlami/nvme/kiwix_tiles --workers 96

    # Force rechunk (overwrite existing chunks, compare tile hashes)
    python chunk_tiles.py --tiles-dir /opt/dlami/nvme/kiwix_tiles --workers 96 --force

    # Force rechunk + delete tiles after each shard
    python chunk_tiles.py --tiles-dir /opt/dlami/nvme/kiwix_tiles --workers 96 --force --delete-tiles

    # Dry run (count chunks without writing)
    python chunk_tiles.py --tiles-dir /opt/dlami/nvme/kiwix_tiles --dry-run
"""

import argparse
import hashlib
import json
import logging
import os
import shutil
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image
from tqdm import tqdm

Image.MAX_IMAGE_PIXELS = None  # some tiles exceed default 178M pixel limit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("chunk_tiles")

CHUNK_HEIGHT = 1024
MIN_CHUNK_HEIGHT = 28  # one Qwen3-VL patch; merge tiny tails into previous


def _compute_tile_hashes(article_dir: str, tile_names: list[str]) -> dict[str, str]:
    """Compute MD5 hashes for all tile files."""
    hashes = {}
    for tn in tile_names:
        tp = os.path.join(article_dir, tn)
        if os.path.exists(tp):
            h = hashlib.md5()
            with open(tp, "rb") as f:
                for block in iter(lambda: f.read(65536), b""):
                    h.update(block)
            hashes[tn] = h.hexdigest()
    return hashes


def chunk_article(article_dir: str, dry_run: bool = False, force: bool = False) -> dict:
    """Chunk all tiles in one article directory.

    Args:
        article_dir: Path to *.png.tiles/ directory.
        dry_run: If True, compute chunks but don't write files.
        force: If True, rechunk even if chunks.json exists (compare tile hashes).

    Returns:
        dict with chunking results, or None if up-to-date / skipped.
    """
    tiles_json = os.path.join(article_dir, "tiles.json")
    chunks_json = os.path.join(article_dir, "chunks.json")

    if not os.path.exists(tiles_json):
        return None

    with open(tiles_json) as f:
        raw = f.read().strip()
    if not raw:
        return None
    try:
        meta = json.loads(raw)
    except json.JSONDecodeError:
        # A truncated manifest (crash mid-write) must not take down the whole
        # shard/build — skip this article like other unreadable dirs.
        logger.warning("Corrupt tiles.json in %s — skipping", article_dir)
        return None

    tile_names = meta.get("tiles", [])
    if not tile_names:
        return None

    # Compute tile hashes (stored in manifest for future change detection)
    tile_hashes = _compute_tile_hashes(article_dir, tile_names)

    # If no tiles exist on disk, skip — never delete existing chunks without tiles to rechunk
    if not tile_hashes:
        return None

    if os.path.exists(chunks_json):
        try:
            with open(chunks_json) as f:
                old_manifest = json.load(f)
        except (json.JSONDecodeError, KeyError):
            old_manifest = None

        # Always verify chunk files actually exist on disk
        chunks_ok = old_manifest is not None and all(
            os.path.exists(os.path.join(article_dir, c["file"]))
            for c in old_manifest.get("chunks", [])
        )

        if chunks_ok:
            if not force:
                return None  # chunks exist, not forced, skip
            # Force: also check tile hashes
            old_hashes = old_manifest.get("tile_hashes", {})
            if old_hashes and old_hashes == tile_hashes:
                return None  # tiles unchanged and chunks exist, skip

        # Hashes differ or missing — delete old chunk files before rechunking
        if not dry_run:
            for f in os.listdir(article_dir):
                if f.startswith("chunk_") and f.endswith((".png", ".jpg", ".jpeg")):
                    os.unlink(os.path.join(article_dir, f))

    page_height = meta.get("page_height", 0)
    viewport_width = meta.get("viewport_width", 875)
    tile_height = meta.get("tile_height", 8192)
    article_id = meta.get("article_id")  # propagate from tiles.json into chunks.json

    chunks_info = []  # list of {tile, chunk_index, file, y_offset, height}
    files_written = 0

    for tile_name in tile_names:
        tile_path = os.path.join(article_dir, tile_name)
        if not os.path.exists(tile_path):
            continue

        try:
            img = Image.open(tile_path)
            w, h = img.size
        except Exception as e:
            logger.warning("Skipping corrupt tile %s: %s", tile_path, e)
            continue
        # Handle both .png and .jpg tile files
        tile_base = tile_name.replace("tile_", "")
        for ext in (".png", ".jpg", ".jpeg"):
            tile_base = tile_base.replace(ext, "")
        tile_idx = int(tile_base)

        # Fast path: web tiles (<= viewport_width) that fit one strip are copied
        # verbatim — byte-identical to the pre-2D-tiling behavior.
        if w <= viewport_width and h <= CHUNK_HEIGHT:
            chunk_name = f"chunk_{tile_idx:04d}_00.png"
            chunk_path = os.path.join(article_dir, chunk_name)
            if not dry_run:
                if tile_path.endswith(".png"):
                    shutil.copy2(tile_path, chunk_path)
                else:
                    img.save(chunk_path, format="PNG")
                files_written += 1
            img.close()
            chunks_info.append(
                {
                    "tile": tile_name,
                    "tile_index": tile_idx,
                    "chunk_index": 0,
                    "file": chunk_name,
                    "x_offset": 0,
                    "y_offset": 0,
                    "height": h,
                    "width": w,
                }
            )
            continue

        # 2D grid: CHUNK_HEIGHT-tall row strips x viewport_width-wide columns.
        # Columns are a full viewport_width each (the model's native width) with
        # the remainder in the last column — not evened out — so most content
        # lands at the in-distribution width the index was built on. chunk_index
        # is a flat row-major counter, so single-column tiles keep the same
        # 0, 1, 2, ... order (and identical crops) as before.
        chunk_idx = 0
        y = 0
        while y < h:
            ch = min(CHUNK_HEIGHT, h - y)
            # Discard tiny height tail (< 28px = one Qwen3-VL patch)
            if ch < MIN_CHUNK_HEIGHT:
                break

            x = 0
            while x < w:
                cw = min(viewport_width, w - x)
                if cw < MIN_CHUNK_HEIGHT:  # discard tiny right-edge sliver
                    break

                chunk_name = f"chunk_{tile_idx:04d}_{chunk_idx:02d}.png"
                chunk_path = os.path.join(article_dir, chunk_name)
                if not dry_run:
                    img.crop((x, y, x + cw, y + ch)).save(chunk_path, format="PNG")
                    files_written += 1

                chunks_info.append(
                    {
                        "tile": tile_name,
                        "tile_index": tile_idx,
                        "chunk_index": chunk_idx
```

### Core Architecture Module: `embed/src/pixelrag_embed/embed.py`
```
#!/usr/bin/env python3
"""Core embedding pipeline: scan tiles from a shard, embed with vLLM, write .npz.

Usage (single shard):
    uv run embed_tiles.py \
        --shard-dir /opt/dlami/nvme/wiki-screenshot/output_coordinated/shard_042 \
        --output-dir ./output/shard_042 --gpu-ids 0

Multi-GPU:
    uv run embed_tiles.py \
        --shard-dir .../shard_042 --output-dir ./output/shard_042 --gpu-ids 0,1,2,3

Chunk embedding (default, recommended):
    Each 8192px tile is pre-split into 1024px strips (chunks) by the tiling pipeline.
    Chunks are stored alongside tiles in *.png.tiles/chunks.json.
    Embedding chunks instead of full tiles reduces the visual token count ~8x,
    significantly improving throughput.

    uv run embed_tiles.py \
        --shard-dir .../shard_042 \
        --output-dir ./output/shard_042 \
        --gpu-ids 0,1,2,3 \
        --mode chunks          # default, can be omitted
        --backend sglang \
        --batch-size 128

    Output npz arrays per chunk:
        embeddings      float16  [N, D]   — embedding vector
        article_ids     int64    [N]      — Wikipedia article ID
        tile_indices    int32    [N]      — which 8192px tile (0-based)
        chunk_indices   int32    [N]      — which 1024px strip within tile (0-based)
        y_offsets       int32    [N]      — Y position of chunk top edge in page (px)
        tile_heights    int32    [N]      — actual chunk height (last chunk may be <1024px)
        page_heights    int32    [N]      — full page height (px)
        viewport_widths int32    [N]      — page render width (px, capped at 875)
        image_hashes    S32      [N]      — MD5 of source PNG (used for dedup & patching)
        tile_paths      S512     [N]      — absolute path to chunk PNG file
        shard_id        int32    scalar   — shard number

    Lookup key: (article_id, tile_index, chunk_index) — lexsorted in output.
"""

import argparse
import atexit
import hashlib
import io
import json
import logging

# Import multiprocessing at module level BEFORE atexit so mp's own
# _exit_function (which joins non-daemon children without timeout) is
# registered FIRST. Our _close_all_persistent_pools is registered last,
# so atexit LIFO order runs ours first — we force-kill stragglers before
# mp's handler can hang on them.
import multiprocessing
import multiprocessing.util  # noqa: F401
import os
import queue
import subprocess
import threading
import time
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import NamedTuple

import numpy as np
from PIL import Image
from tqdm import tqdm

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("embed_tiles")
logger.setLevel(logging.INFO)

_PERSISTENT_POOLS: dict[tuple, "PersistentGpuWorkerPool"] = {}


def resolve_gpu_ids(gpu_ids_arg: str) -> list[int]:
    """Resolve GPU IDs from CLI arg.

    Supports:
    - "all" / "auto": use all visible GPUs
    - comma-separated IDs, e.g. "0,1,2,3"
    """
    value = gpu_ids_arg.strip().lower()
    if value in {"all", "auto"}:
        visible = os.environ.get("CUDA_VISIBLE_DEVICES", "").strip()
        if visible:
            parts = [p.strip() for p in visible.split(",") if p.strip()]
            if parts:
                # Under CUDA_VISIBLE_DEVICES, local IDs are 0..N-1.
                return list(range(len(parts)))
        try:
            out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=index", "--format=csv,noheader"],
                text=True,
            )
            lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
            if lines:
                return list(range(len(lines)))
        except Exception:
            logger.warning(
                "Failed to detect GPUs via nvidia-smi; falling back to GPU 0"
            )
        return [0]

    return [int(g.strip()) for g in gpu_ids_arg.split(",") if g.strip()]


_RESIZE_FACTOR = 28  # Qwen3-VL patch alignment
_MAX_CHUNK_WIDTH = 875  # web viewport width; wider images (e.g. PDF tiles) are resized


def _smart_resize_pil(img: "Image.Image", max_pixels: int) -> "Image.Image":
    """Resize image to fit within max_pixels, preserving aspect ratio.

    Dimensions are rounded to multiples of 28 (Qwen3-VL patch alignment).
    """
    w, h = img.size
    if w * h <= max_pixels:
        return img
    scale = (max_pixels / (w * h)) ** 0.5
    new_w = max(round(w * scale / _RESIZE_FACTOR) * _RESIZE_FACTOR, _RESIZE_FACTOR)
    new_h = max(round(h * scale / _RESIZE_FACTOR) * _RESIZE_FACTOR, _RESIZE_FACTOR)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _clamp_width_pil(
    img: "Image.Image", max_width: int = _MAX_CHUNK_WIDTH
) -> "Image.Image":
    """Resize image so width <= max_width, preserving aspect ratio.

    Dimensions are rounded to multiples of 28 (Qwen3-VL patch alignment).
    Used for PDF tiles that render wider than the web viewport.
    """
    w, h = img.size
    if w <= max_width:
        return img
    scale = max_width / w
    new_w = max(round(w * scale / _RESIZE_FACTOR) * _RESIZE_FACTOR, _RESIZE_FACTOR)
    new_h = max(round(h * scale / _RESIZE_FACTOR) * _RESIZE_FACTOR, _RESIZE_FACTOR)
    return img.resize((new_w, new_h), Image.LANCZOS)


def save_npz(path: str, compressed: bool, **arrays) -> None:
    """Save npz with optional compression."""
    if compressed:
        np.savez_compressed(path, **arrays)
    else:
        np.savez(path, **arrays)


# ---------------------------------------------------------------------------
# Redirect filtering
# ---------------------------------------------------------------------------


def load_redirect_ids(path: str) -> set[int]:
    """Load redirect article IDs from a .redirects.json file.

    The file is a dict mapping article index (str) to target path (str).
    We only need the keys (indices of redirect articles).

    Args:
        path: Path to the .redirects.json file.

    Returns:
        Set of article indices that are client-side redirects.
    """
    with open(path, "r") as f:
        redirects = json.load(f)
    ids = {int(k) for k in redirects}
    logger.info("Loaded %d redirect IDs from %s", len(ids), path)
    return ids


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------


class TileInfo(NamedTuple):
    """Metadata for a single tile image (or a chunk of one)."""

    article_id: int
    tile_index: int
    tile_path: str
    page_height: int
    viewport_width: int
    tile_height: int
    chunk_index: int = 0  # 0 = whole tile or first chunk


class ChunkInfo(NamedTuple):
    """Metadata for a single chunk image (1024px strip of a tile)."""

    article_id: int
    tile_index: int
    chunk_index: int
    chunk_path: str
    page_height: int
    viewport_width: int
    y_offset: int
    chunk_height: int


def _image_path(ti: "TileInfo | ChunkInfo") -> str:
    """Return the image file path regardless of info type."""
    return ti.tile_path if isinstance(ti, TileInfo) else ti.chunk_path


# ---------------------------------------------------------------------------
# Tile scanning
# ---------------------------------------------------------------------------


def scan_shard_tiles(
    shard_dir: str,
    skip_article_ids: set[int] | None = None,
) -> list[TileInfo]:
    """Walk a shard directory and collect all completed tiles.

    Looks for ``*.png.tiles/tiles.json`` files with ``complete: true``.
    Each tile PNG listed in tiles.json becomes one TileInfo entry.

    Args:
        shard_dir: Path to a shard directory (e.g. output_coordinated/shard_042).
        skip_article_ids: Article IDs to skip (already embedded).

    Returns:
        Sorted list of TileInfo (by article_id, then tile_index).
    """
    shard_path = Path(shard_dir)
 
```

### Core Architecture Module: `embed/src/pixelrag_embed/embed_cpu.py`
```
#!/usr/bin/env python3
"""Local embedding: embed tile chunks using transformers on CPU or Apple MPS.

Works without CUDA — suitable for macOS (Apple Silicon), small-scale demos,
and testing.

Usage:
    # CPU (any platform)
    python -m pixelrag_embed.embed_cpu \
        --shard-dir ./tiles --output-dir ./embeddings

    # Apple Silicon GPU (macOS)
    python -m pixelrag_embed.embed_cpu \
        --shard-dir ./tiles --output-dir ./embeddings --device mps
"""

import argparse
import hashlib
import json
import logging
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("embed_local")

Image.MAX_IMAGE_PIXELS = None

_RESIZE_FACTOR = 28
_MAX_CHUNK_WIDTH = 875


def _clamp_width(img: Image.Image, max_width: int = _MAX_CHUNK_WIDTH) -> Image.Image:
    """Resize so width <= max_width, preserving aspect ratio (28px alignment)."""
    w, h = img.size
    if w <= max_width:
        return img
    scale = max_width / w
    new_w = max(round(w * scale / _RESIZE_FACTOR) * _RESIZE_FACTOR, _RESIZE_FACTOR)
    new_h = max(round(h * scale / _RESIZE_FACTOR) * _RESIZE_FACTOR, _RESIZE_FACTOR)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _resolve_device(device: str) -> str:
    """Resolve device string, auto-detecting MPS on macOS."""
    import torch

    if device == "auto":
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    return device


def scan_chunks(shard_dir: str) -> list[dict]:
    """Scan for chunk images in a shard directory.

    Looks for *.png.tiles/chunks.json files. Falls back to tiles.json if no chunks.
    """
    shard = Path(shard_dir)
    items = []

    for entry in sorted(shard.iterdir()):
        if not entry.is_dir():
            continue
        tile_dirs = []
        if entry.name.endswith(".png.tiles"):
            tile_dirs = [entry]
        else:
            tile_dirs = sorted(
                d
                for d in entry.iterdir()
                if d.is_dir() and d.name.endswith(".png.tiles")
            )

        for td in tile_dirs:
            chunks_json = td / "chunks.json"
            tiles_json = td / "tiles.json"

            # Read article_id from the manifest (written by the pipeline).
            # Fall back to parsing the directory name for backward compat
            # with indexes built before this change.
            article_id = None
            for mf in (chunks_json, tiles_json):
                if mf.exists() and article_id is None:
                    try:
                        article_id = json.loads(mf.read_text()).get("article_id")
                    except (json.JSONDecodeError, OSError):
                        pass
            if article_id is None:
                article_id_str = td.name.replace(".png.tiles", "")
                try:
                    article_id = int(article_id_str)
                except ValueError:
                    # Non-numeric dir name with no manifest article_id. Use a
                    # stable hash (builtin hash() is salted by PYTHONHASHSEED and
                    # would give a different id every build -> non-reproducible
                    # index). sha1 keeps the same id for the same dir name.
                    digest = hashlib.sha1(article_id_str.encode()).hexdigest()
                    article_id = int(digest[:8], 16)

            if chunks_json.exists():
                with open(chunks_json) as f:
                    manifest = json.load(f)
                for chunk_info in manifest.get("chunks", []):
                    chunk_path = td / chunk_info["file"]
                    if chunk_path.exists():
                        items.append(
                            {
                                "path": str(chunk_path),
                                "article_id": article_id,
                                "tile_index": chunk_info.get("tile_index", 0),
                                "chunk_index": chunk_info.get("chunk_index", 0),
                                "y_offset": chunk_info.get("y_offset", 0),
                                "height": chunk_info.get("height", 1024),
                            }
                        )
            elif tiles_json.exists():
                with open(tiles_json) as f:
                    manifest = json.load(f)
                for i, tile_name in enumerate(manifest.get("tiles", [])):
                    tile_path = td / tile_name
                    if tile_path.exists():
                        items.append(
                            {
                                "path": str(tile_path),
                                "article_id": article_id,
                                "tile_index": i,
                                "chunk_index": 0,
                                "y_offset": 0,
                                "height": 0,
                            }
                        )

    return items


def embed_items(
    items: list[dict],
    model_name: str,
    device: str = "cpu",
    instruction: str = "",
) -> np.ndarray:
    """Embed image items using transformers on the given device."""
    import torch
    from transformers import AutoProcessor, Qwen3VLForConditionalGeneration

    device = _resolve_device(device)
    dtype = torch.float32 if device == "cpu" else torch.float16

    logger.info("Loading model %s on %s (%s)...", model_name, device, dtype)
    processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)
    model = Qwen3VLForConditionalGeneration.from_pretrained(
        model_name,
        trust_remote_code=True,
        torch_dtype=dtype,
        attn_implementation="sdpa",
    ).eval()
    if device != "cpu":
        model = model.to(device)
    logger.info("Model loaded on %s", device)

    dim = model.config.text_config.hidden_size
    embeddings = np.zeros((len(items), dim), dtype=np.float16)

    prefix = f"Instruct: {instruction}\n" if instruction else ""

    for i, item in enumerate(tqdm(items, desc="Embedding")):
        img = Image.open(item["path"]).convert("RGB")
        img = _clamp_width(img)

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img},
                    {"type": "text", "text": prefix + "What is shown in this image?"},
                ],
            }
        ]

        text = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = processor(text=[text], images=[img], return_tensors="pt", padding=True)
        if device != "cpu":
            inputs = {
                k: v.to(device) if hasattr(v, "to") else v for k, v in inputs.items()
            }

        with torch.no_grad():
            outputs = model(**inputs, output_hidden_states=True)
            last_hidden = outputs.hidden_states[-1]
            seq_lens = inputs["attention_mask"].sum(dim=1)
            last_idx = seq_lens - 1
            pooled = last_hidden[0, last_idx[0]]
            pooled = pooled / pooled.norm()
            embeddings[i] = pooled.cpu().numpy().astype(np.float16)

        # tqdm covers interactive runs but never reaches log files; when
        # stderr is not a TTY (nohup/CI/redirects) emit a periodic record so
        # long embeds stay observable after the fact.
        if (i + 1) % 100 == 0 and not sys.stderr.isatty():
            logger.info("Embedded %d/%d", i + 1, len(items))

    return embeddings


def main():
    parser = argparse.ArgumentParser(description="Local embedding (CPU / MPS / CUDA)")
    parser.add_argument(
        "--shard-dir", required=True, help="Directory with *.png.tiles/ subdirs"
    )
    parser.add_argument("--output-dir", required=Tr
```

### Core Architecture Module: `embed/src/pixelrag_embed/index.py`
```
#!/usr/bin/env python3
"""Build a vector search index from embedding .npz shards.

Supports multiple backends:
  - ivf (default): FAISS IndexIVFFlat — fast build (~10 min), periodic rebuild for updates
  - diskann: DiskANN disk/memory index — see build_diskann.py

Steps:
  1. Merge all shard .npz files into a unified vectors + metadata
  2. Build the chosen index
  3. Test search

Usage:
    # Build IVF index (default)
    python indexing/build_index.py build \
        --embeddings-dir /opt/dlami/nvme/embeddings \
        --output-dir /opt/dlami/nvme/search_index

    # Build with custom nlist
    python indexing/build_index.py build \
        --embeddings-dir /opt/dlami/nvme/embeddings \
        --output-dir /opt/dlami/nvme/search_index \
        --nlist 8192 --nprobe 128

    # Test search
    python indexing/build_index.py test \
        --index-dir /opt/dlami/nvme/search_index \
        --nprobe 128
"""

import argparse
import json
import os
import sys
import time
import uuid
from functools import partial
from pathlib import Path

import numpy as np

# Unbuffered print so output shows up in logs/nohup immediately
print = partial(print, flush=True)


def _load_shards(embeddings_dir: str):
    """Load and deduplicate all shard .npz files. Yields (embeddings, metadata) per shard."""
    emb_dir = Path(embeddings_dir)
    shard_files = sorted(emb_dir.glob("shard_*.npz"))
    print(f"Found {len(shard_files)} shard files in {embeddings_dir}")
    if not shard_files:
        print("No shard files found!", file=sys.stderr)
        sys.exit(1)
    return shard_files


def _merge_all_shards(shard_files):
    """Single-pass: concat all shards, then numpy-vectorized global dedup.

    Returns dict of merged arrays + dim.
    """
    t0 = time.time()

    # First pass: quick count + dim check (mmap, no Python loop)
    total_raw = 0
    dim = None
    for sf in shard_files:
        with np.load(sf, mmap_mode="r") as data:
            n, d = data["embeddings"].shape
            if dim is None:
                dim = d
            assert d == dim, f"Dimension mismatch: {sf} has {d}, expected {dim}"
            total_raw += n
    print(f"Total raw vectors: {total_raw:,}, dim: {dim}")
    print(f"Allocating {total_raw * dim * 4 / 1e9:.1f} GB for float32 embeddings...")

    # Allocate output arrays
    all_emb = np.empty((total_raw, dim), dtype=np.float32)
    all_aids = np.empty(total_raw, dtype=np.int64)
    all_tiles = np.empty(total_raw, dtype=np.int32)
    all_chunks = np.empty(total_raw, dtype=np.int32)
    all_yoff = np.empty(total_raw, dtype=np.int32)
    all_theights = np.empty(total_raw, dtype=np.int32)

    # Concat all shards (no per-shard dedup — verified clean)
    row = 0
    for i, sf in enumerate(shard_files):
        with np.load(sf) as data:
            n = data["embeddings"].shape[0]
            all_emb[row : row + n] = data["embeddings"].astype(np.float32)
            all_aids[row : row + n] = data["article_ids"]
            all_tiles[row : row + n] = data["tile_indices"]
            all_chunks[row : row + n] = data["chunk_indices"]
            all_yoff[row : row + n] = data["y_offsets"]
            all_theights[row : row + n] = data["tile_heights"]
            row += n
        if (i + 1) % 100 == 0 or i == len(shard_files) - 1:
            print(
                f"  [{i + 1}/{len(shard_files)}] {row:,} vectors, {time.time() - t0:.0f}s"
            )

    print(f"Concat done: {row:,} vectors in {time.time() - t0:.0f}s")

    # Global dedup: numpy-vectorized unique on (article_id, tile, chunk)
    # Pack into single int64: article_id * 1e8 + tile * 1e4 + chunk
    print("Deduplicating...")
    t1 = time.time()
    keys = (
        all_aids[:row] * 100_000_000
        + all_tiles[:row].astype(np.int64) * 10_000
        + all_chunks[:row].astype(np.int64)
    )
    _, unique_idx = np.unique(keys, return_index=True)
    unique_idx.sort()  # preserve original order
    n_unique = len(unique_idx)
    n_dupes = row - n_unique
    print(
        f"Dedup done: {n_unique:,} unique, {n_dupes:,} duplicates removed in {time.time() - t1:.1f}s"
    )

    if n_dupes > 0:
        return {
            "embeddings": all_emb[unique_idx],
            "article_ids": all_aids[unique_idx],
            "tile_indices": all_tiles[unique_idx],
            "chunk_indices": all_chunks[unique_idx],
            "y_offsets": all_yoff[unique_idx],
            "tile_heights": all_theights[unique_idx],
            "dim": dim,
        }
    else:
        return {
            "embeddings": all_emb[:row],
            "article_ids": all_aids[:row],
            "tile_indices": all_tiles[:row],
            "chunk_indices": all_chunks[:row],
            "y_offsets": all_yoff[:row],
            "tile_heights": all_theights[:row],
            "dim": dim,
        }


def build_ivf(
    embeddings_dir: str,
    output_dir: str,
    nlist: int = 4096,
    nprobe: int = 128,
    train_sample: int = 500_000,
    metric: str = "ip",
    gpu_id: int = -1,
    pq_m: int = 0,
    pq_nbits: int = 8,
):
    """Build a FAISS IVF index — IVFFlat by default, IVFPQ when pq_m > 0.

    Args:
        nlist: number of IVF clusters (default 4096, good for ~30M vectors)
        nprobe: default search nprobe stored in the index
        train_sample: number of vectors to sample for K-means training
        metric: 'ip' (inner product / cosine for L2-normalized vectors) or 'l2'
        gpu_id: GPU to use for training (-1 = CPU only)
        pq_m: PQ sub-quantizers. 0 keeps the uncompressed IVFFlat index; >0 builds
            an IVFPQ index that stores pq_m bytes/vector (at nbits=8) instead of
            dim*4 — ~128x smaller for dim=2048, pq_m=64. Must divide dim evenly.
        pq_nbits: bits per PQ sub-quantizer (4 or 8), only used when pq_m > 0.
    """
    import faiss

    # Use all cores for FAISS CPU operations
    faiss.omp_set_num_threads(os.cpu_count())

    os.makedirs(output_dir, exist_ok=True)

    shard_files = _load_shards(embeddings_dir)

    print("\nMerging and deduplicating shards...")
    merged = _merge_all_shards(shard_files)
    embeddings = merged["embeddings"]
    dim = merged["dim"]
    n = embeddings.shape[0]
    print(f"Final: {n:,} × {dim}")

    # Save metadata
    metadata_path = os.path.join(output_dir, "metadata.npz")
    print(f"Saving metadata to {metadata_path}...")
    np.savez(
        metadata_path,
        article_ids=merged["article_ids"],
        tile_indices=merged["tile_indices"],
        chunk_indices=merged["chunk_indices"],
        y_offsets=merged["y_offsets"],
        tile_heights=merged["tile_heights"],
    )

    # Build IVF index
    metric_type = faiss.METRIC_INNER_PRODUCT if metric == "ip" else faiss.METRIC_L2

    # Auto-adjust nlist when dataset is smaller than configured nlist
    if n < nlist:
        nlist = max(1, n)

    # Train on a sample
    actual_train = min(train_sample, n)
    train_indices = np.random.choice(n, actual_train, replace=False)
    train_data = embeddings[train_indices]

    quantizer = faiss.IndexFlatIP(dim) if metric == "ip" else faiss.IndexFlatL2(dim)
    if pq_m > 0:
        if dim % pq_m != 0:
            raise ValueError(
                f"--pq-m ({pq_m}) must divide the embedding dim ({dim}) evenly"
            )
        # Pass metric_type explicitly: faiss.IndexIVFPQ defaults to METRIC_L2,
        # which is wrong for the IP-normalized embeddings this index uses.
        index = faiss.IndexIVFPQ(quantizer, dim, nlist, pq_m, pq_nbits, metric_type)
    else:
        index = faiss.IndexIVFFlat(quantizer, dim, nlist, metric_type)

    if gpu_id >= 0:
        # GPU-accelerated training: move CPU index to GPU, train, move back
        print(
            f"\nTraining IVF on GPU {gpu_id} (nlist={nlist}) on {actual_train:,} vectors..."
        )
        t0 = time.time()
        res = faiss.StandardGpuResources()
        gpu_index = faiss.index_cpu_to_gpu(res, gpu_id, index)
        gpu_index.train(train_data)
        print(f"G
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #162** (2026-09-27): **test(serve): repair department-filter tests left stale by the backend refactor**
  *Symptoms*: ## Problem  `tests/test_department_filter.py` has been failing for anyone with the `serve` extra installed since mid-July:  ``` E   AttributeError: module 'pixelrag_serve.api' has no attribute '_department_search_params' E   AttributeError: module 'pixelrag_serve.api' has no attribute '_department_positions' ```  Five tests, both names removed in 1a9ba75 ("feat: Vector search with Qdrant", #111) when department filtering moved into the `VectorBackend` abstraction: `_department_positions` became `_department_article_ids` (the backend now maps article ids to rows), and `_department_search_params` was folded into `FaissBackend.raw_search`. That commit added `tests/test_serve_backends.py` for the new contract but left this file pointing at the old one.  **Why CI stayed green.** A module-level `pytest.importorskip("faiss")` sits halfway down the file, so a core-only install skips the entire module:  ``` $ uv run --isolated --extra dev pytest tests/test_department_filter.py SKIPPED [1] could not import 'faiss': No module named 'faiss' 1 skipped ```  CI installs `--extra dev` only, so it has never run a single case in this file — including the five build-side cases defined *above* the gate, which need nothing heavier than `pixelrag_index.pipelines`.  **What was actually uncovered.** Three of the five weren't duplicated elsewhere:  | Stale test | Covered by test_serve_backends.py? | |---|---| | flat-index filter restricts hits | yes | | positions map articles to rows | yes, via the a
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22e9b78e5ef618c49ad8cd75710f0592333ca5c299%22%7D%2C%22id%22%3A%22QmNby7cyRZLvswjxmgVYc353VMDTw8u9Sq8Mg68XoDWN14%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A162%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #161** (2026-09-27): **fix(serve): bound /reconstruct and stop unknown ids becoming 500s**
  *Symptoms*: ## Problem  `/reconstruct` is public and unguarded — the last endpoint on the API without input bounds, after #122 (`n_docs`) and #154 (query images, batch size).  ```python class ReconstructRequest(BaseModel):     vector_ids: list[int | str]  @app.post("/reconstruct") async def reconstruct(req: ReconstructRequest):     return {"embeddings": _state["backend"].reconstruct(req.vector_ids)} ```  **1. Unbounded response.** Every id returns a full `dimension`-length float list, which serializes to roughly 40 KB of JSON at dim 2048. A request with 100 k ids asks the service to build a multi-GB response. The first call also runs `make_direct_map()` over the whole index — an allocation any anonymous caller can trigger.  **2. Uncaught errors become 500s.** `FaissBackend.reconstruct` does `self.index.reconstruct(int(v))` with no validation:  - a non-numeric id (the model explicitly allows `str`) raises   `ValueError: invalid literal for int()`; - an out-of-range id raises `RuntimeError: Error ... 'key < ntotal' failed`.  Both reach the client as an uncaught 500. `QdrantBackend.reconstruct` already returns `None` for an id it doesn't hold, and the `VectorBackend` protocol declares `list[list[float] | None]` — so FAISS was the odd one out, and the documented contract was the one it didn't honor.  ## Fix  `vector_ids: list[int | str] = Field(max_length=256)` — out of range returns 422. Real callers debug a handful of vectors at a time.  In `FaissBackend.reconstruct`, validate before recon
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%224cb2c90556c06d46903cb9de4861867046e56e0c%22%7D%2C%22id%22%3A%22QmdXkXPmy8QXkoPEfgmLdedepDFVUPtLSpnHqBNXut3vwj%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A161%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #160** (2026-09-27): **fix: cross-platform compatibility, config deep merge, and pipeline ro…**
  *Symptoms*: …bustness  - pipelines: use url2pathname for Windows file:// paths in _department_of - pipelines: use atomic replace for image tiles.json and safely close mmap handles - sources/local: standardize to RFC 8089 as_uri() format for file URLs - config: deep merge nested sections in load_config, enforce utf-8, and support backslashes - sources/web: specify utf-8 encoding for urls_file reading - render: forward extract_text for local HTML files in pixelshot CLI - sources/kiwix: cross-platform process termination fallback for Windows in _kill_proc - chunk: fix Windows shard_dir trailing slash parsing, ensure PNG format in fast path, and use atomic write - index: clamp nlist to vector count in build_faiss to prevent crash on small datasets - web: safely handle malformed URI components in agent-server and chat route - tests: unblock department build tests in core test suite and add regression tests
  **Post-Mortem & Fix Analysis**:
  > @smartworldarafath is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2224df1f8624012de57557f44f00b72fb4abd43114%22%7D%2C%22id%22%3A%22QmPqWyie2niFk6CfK57omyoVotnKXhrxqyJpQZsfFqxD6g%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A160%2C%22repo%22%3A%22PixelRAG%22%7D).  
  > Hi maintainers, I've resolved cross-platform issues and edge-case bugs across config, sources, and pipelines, verified all tests and Ruff formatting locally. Ready for review when you have a moment!

- **Issue #159** (2026-09-27): **feat(eval): add optional Atlas Cloud reader**
  *Symptoms*: ## Summary  - Add an opt-in `--atlascloud` evaluation reader using the existing OpenAI-compatible client, an isolated `ATLASCLOUD_API_KEY`, and unchanged catalog model IDs. - Avoid native Gemini routing when Atlas is explicitly selected; reject conflicting provider/endpoint options. - Disable automatic retries for this reader without changing other readers' retry behavior. - Document the optional reader in `eval/README.md` and add offline regression coverage. No default reader or main README changes.  ## Validation  - 35 focused tests passed (`test_eval_model_config.py`, `test_litellm_client.py`, `test_atlascloud_client.py`), including credentials, model routing, timeout/connection/429 handling, and existing-reader retries. - Full-repository `ruff check .` and `ruff format --check .` passed. - Real CLI help and all five Atlas/provider-or-endpoint conflict cases passed. - `uv build --no-sources` and `git diff --check` passed. - One real request through `run_bench.main()` with a single local text fixture and `openai/gpt-4.1-mini`: HTTP 200, expected answer `4`, result JSONL validated, one POST counted. Dataset loading alone was replaced by the fixture; routing, message construction, HTTP client and output writing were real.  The benchmark's unrelated retrieval-status probes returned 502 during the naive-mode smoke; generation still completed. Full browser/GPU/retrieval suites were not run. Locked core/eval installation was interrupted during the large browser dependency downloa
  **Post-Mortem & Fix Analysis**:
  > @binyangzhu000-sudo is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%221b42622e8efd1ab89247dc07622b614757c3ab46%22%7D%2C%22id%22%3A%22QmPMjd1qyAfc8XqjjoEtdQNExBF4Xt5sDon9occtUQvYjP%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A159%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #158** (2026-09-14): **docs: link community LangChain integration**
  *Symptoms*: ## Summary  - link the community-maintained `pixelrag-langchain` integration from the existing "Connect your own agent" section - point readers to both the PyPI package and its GitHub source  ## Validation  - `npm run typecheck` - `npm test` (10 tests passed) - `git diff --check`  Related to #128.
  **Post-Mortem & Fix Analysis**:
  > @navneet-singh2907 is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%2296467fe65675abc3a97e9de7cf493b5713b73294%22%7D%2C%22id%22%3A%22QmcGS6eKbac7G7dBgKxdtwdoSXiSdG44anscA1oPEf3XyJ%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A158%2C%22repo%22%3A%22PixelRAG%22%7D).  

- **Issue #157** (2026-09-09): **fix(opencode-plugin): default the tile directory inside the project**
  *Symptoms*: The `screenshot` tool defaulted `output` to `/tmp/pixelbrowse`, outside the project root, so reading the tiles hits opencode's `external_directory` permission. Under `opencode run` that is auto-rejected and the agent is left holding tile paths it cannot open; the TUI prompts on every screenshot instead.  ``` ! permission requested: external_directory (/tmp/pixelbrowse/..._sample.html.png.tiles/*); auto-rejecting ✗ Read /tmp/pixelbrowse/.../tile_0000.jpg failed Error: The user rejected permission to use this specific tool call. ```  `execute` now takes the `ToolContext` it is already passed and defaults to `<worktree>/.opencode/pixelbrowse`. Measured on opencode 1.18.29 with pixelshot from pixelrag 0.4.0: the same page and the same plugin read the tiles first try when `output` is project-local, and are rejected when it is `/tmp/pixelbrowse`.  README updated to match. 
  **Post-Mortem & Fix Analysis**:
  > [vc]: #FHN+8HOoFfhy53rD9TQnf7ZFZYAUnamNnka0Pwyxt3g=:eyJpc01vbm9yZXBvIjp0cnVlLCJ0eXBlIjoiZ2l0aHViIiwicHJvamVjdHMiOlt7Im5hbWUiOiJ3ZWIiLCJwcm9qZWN0SWQiOiJwcmpfbGI2cHVrT3BOYjliU0tKaG1DNlhMOENSTWw3UyIsImxpdmVGZWVkYmFjayI6eyJyZXNvbHZlZCI6MCwidW5yZXNvbHZlZCI6MCwidG90YWwiOjAsImxpbmsiOiJ3ZWItZ2l0LWZpeC1vcGVuY29kZS1wbHVnaW4tdGlsZS1kaXItYW5keWxpemZzLXByb2plY3RzLnZlcmNlbC5hcHAifSwiaW5zcGVjdG9yVXJsIjoiaHR0cHM6Ly92ZXJjZWwuY29tL2FuZHlsaXpmcy1wcm9qZWN0cy93ZWIvN0ZiTFFWeFU2aXhCU2pkZWt3SjVKOVQxZFJlOCIsInByZXZpZXdVcmwiOiJ3ZWItZ2l0LWZpeC1vcGVuY29kZS1wbHVnaW4tdGlsZS1kaXItYW5keWxpemZzLXByb2plY3RzLnZlcmNlbC5hcHAiLCJuZXh0Q29tbWl0U3RhdHVzIjoiREVQTE9ZRUQifV19 The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).  | Project | Deployment | Actions | Updated | | :--- | :----- | :------ | :------ | | <a href="https://vercel.com/andylizfs-projects/web"><sup><img src="https://vercel.com/api/www/avatar?projectId=prj_lb6pukOpNb9bSKJhmC6XL8CRMl7S&teamId=team_RFE

- **Issue #155** (2026-09-24): **feat(index): add IVF+PQ compression flag for the FAISS build**
  *Symptoms*: Closes #153.  ## Motivation  The FAISS backend uses `IndexIVFFlat`, storing every vector at full float32 precision — ~245 GB of RAM for a 30 M-vector corpus at dim 2048. That's out of reach for air-gapped or Docker-free deployments that can't run a Qdrant sidecar, even though Qdrant users can already compress via `--qdrant-quantization-config`. This adds the equivalent knob on the FAISS side.  ## Change  Opt-in `--pq-m` / `--pq-nbits` flags select `IndexIVFPQ` (Product Quantization) instead of `IndexIVFFlat`. At `pq_m=64, nbits=8` each vector shrinks from 8192 to 64 bytes (~128x, ~1.9 GB for 30 M vectors) for a typical small recall cost.  - **`embed/src/pixelrag_embed/index.py`** — `build_ivf` takes `pq_m` (default 0 =   unchanged IVFFlat) and `pq_nbits` (4 or 8). When `pq_m > 0` it builds   `IndexIVFPQ`; the existing `.train()` call trains the PQ codebooks too, so no   new training path. `summary.json` records `index_type` / `pq_m` / `pq_nbits`   so the served index is self-describing. - **`index/src/pixelrag_index/pipelines.py`** — forwards `index.pq_m` /   `index.pq_nbits` from `pixelrag.yaml` to the build command.  ```yaml index:   backend: faiss   pq_m: 64      # sub-quantizers; must divide the embedding dim evenly   pq_nbits: 8   # 4 or 8 (default 8) ```  ### One fix vs. the proposal  The issue's sketch was `faiss.IndexIVFPQ(quantizer, dim, nlist, pq_m, pq_nbits)`, which **defaults to `METRIC_L2`** — wrong for the IP-normalized embeddings this index uses, and a silent r
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22d754dfa0070eeed8253157bd1be498b78ce417bf%22%7D%2C%22id%22%3A%22QmVvimLHYb7yHZTBrqv2DKB2YNV3teoBqUkUTmeMsYXoEq%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A155%2C%22repo%22%3A%22PixelRAG%22%7D).  
  > @andylizf friendly ping on this one — CI is green now (lint, Tests, frontend build, plugin validate all pass; the only red check is the Vercel preview, which needs a team member to authorize the deploy from a fork).  This closes #153. The flags are opt-in, so the default `IndexIVFFlat` behavior is unchanged. Happy to adjust the defaults or the docs if you'd like it shaped differently. 

- **Issue #154** (2026-09-24): **fix(serve): bound query image decode and batch size to prevent OOM/DoS**
  *Symptoms*: ## Problem  The public `/search` endpoint accepts attacker-controlled query images and an unbounded batch, with no guards on either. In `_parse_queries` (`serve/src/pixelrag_serve/api.py`), each query's base64 `image` goes straight into:  ```python img_bytes = base64.b64decode(img_data) img = Image.open(io.BytesIO(img_bytes)).convert("RGB") ```  Three ways this is a trivial OOM/DoS on the public endpoint — the same class as the `n_docs` bound in #122:  1. **Decompression bomb.** A tiny base64 payload can decode to an enormous    canvas; `.convert("RGB")` then forces a huge allocation. Pillow's default    only *warns* up to ~179M px before throwing an **uncaught**    `DecompressionBombError` → HTTP 500. 2. **Unbounded payload.** No cap on the base64 string length or decoded bytes. 3. **Unbounded batch.** `queries: list[Query]` has no `max_length`, so a single    request can carry thousands of queries, multiplying (1) and (2).  Corrupt/invalid base64 also raises uncaught → 500 instead of a clean 400.  ## Fix  Declarative bounds plus a guarded decode, no behavior change for valid requests:  - `queries: list[Query] = Field(max_length=32)` — real callers send 1; 32 is   generous. - Cap the base64 payload (10 MB) before decoding. - Read the image dimensions from the header and reject over a pixel cap   (25 MP) **before** `.convert()` allocates — query images are downscaled far   below this for the VL model anyway. - Wrap the decode so any failure (bad base64, corrupt image, bomb) r
  **Post-Mortem & Fix Analysis**:
  > @dex0shubham is attempting to deploy a commit to the **andylizf's projects** Team on [Vercel](https://vercel.com).  A member of the Team first needs to [authorize it](https://vercel.com/git/authorize?team=andylizf's%20projects&slug=andylizfs-projects&teamId=team_RFEPteyojfPF6GJXZsfS6iJh&type=github&job=%7B%22headInfo%22%3A%7B%22sha%22%3A%22d7329f56b76facaf37f542472dd80ee270bf0b90%22%7D%2C%22id%22%3A%22QmTVmgRUAx6vJ3X31thdh1f4aXM8R3Zv55U6gk6EsZaRAY%22%2C%22org%22%3A%22StarTrail-org%22%2C%22prId%22%3A154%2C%22repo%22%3A%22PixelRAG%22%7D).  
  > @andylizf friendly ping on this one — CI is green now (lint, Tests, frontend build, plugin validate all pass; the only red check is the Vercel preview, which needs a team member to authorize the deploy from a fork).  This is the same class of fix as #122, applied to the other unbounded input on the public `/search` path: the base64 query image and the batch size. Happy to rebase or adjust the limits if you'd prefer different bounds. 
  > Thanks. Went through the diff and ran the new tests locally.  On main, 32 copies of a 36 MP image decode into about 3.4 GB of RGB buffers in a single request, and a 900 MP header or a malformed base64 string both raise uncaught and turn into a 500. On this branch those come back 400 and the oversized batch 422.  The bounds look right: 32 queries, 10 MB of base64, 25 MP read off the header before decode. Merging. 

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

### Incident Patch 1: `6e087f8d` (2026-09-27)
**Commit Message**: fix: cross-platform compatibility, config deep merge, and pipeline ro… (#160)

* fix: cross-platform compatibility, config deep merge, and pipeline robustness

- pipelines: use url2pathname for Windows file:// paths in _department_of
- pipelines: use atomic replace for image tiles.json and safely close mmap handles
- sources/local: standardize to RFC 8089 as_uri() format for file URLs
- config: deep merge nested sections in load_config, enforce utf-8, and support backslashes
- sources/web: specify utf-8 encoding for urls_file reading
- render: forward extract_text for local HTML files in pixelshot CLI
- sources/kiwix: cross-platform process termination fallback for Windows in _kill_proc
- chunk: fix Windows shard_dir trailing slash parsing, ensure PNG format in fast path, and use atomic write
- index: clamp nlist to vector count in build_faiss to prevent crash on small datasets
- web: safely handle malformed URI components in agent-server and chat route
- tests: unblock department build tests in core test suite and add regression tests

* style: format code with ruff and clean up unused imports

* fix(test): stop test_kiwix_kill_proc sending a real SIGTERM

The test passed a bare M

**File**: `embed/src/pixelrag_embed/chunk.py` (modified, +9/-3)
```diff
@@ -162,8 +162,12 @@ def chunk_article(article_dir: str, dry_run: bool = False, force: bool = False)
             chunk_name = f"chunk_{tile_idx:04d}_00.png"
             chunk_path = os.path.join(article_dir, chunk_name)
             if not dry_run:
-                shutil.copy2(tile_path, chunk_path)
+                if tile_path.endswith(".png"):
+                    shutil.copy2(tile_path, chunk_path)
+                else:
+                    img.save(chunk_path, format="PNG")
                 files_written += 1
+            img.close()
             chunks_info.append(
                 {
                     "tile": tile_name,
@@ -241,8 +245,10 @@ def chunk_article(article_dir: str, dry_run: bool = False, force: bool = False)
         manifest["article_id"] = article_id
 
     if not dry_run:
-        with open(chunks_json, "w") as f:
+        tmp_chunks = chunks_json + ".tmp"
+        with open(tmp_chunks, "w") as f:
             json.dump(manifest, f)
+        os.replace(tmp_chunks, chunks_json)
 
     return {
         "article_dir": article_dir,
@@ -344,7 +350,7 @@ def process_shard(
         tiles_deleted = _delete_tiles_in_shard(shard_dir)
 
     elapsed = time.time() - t0
-    shard_name = os.path.basename(shard_dir.rstrip("/"))
+    shard_name = os.path.basename(shard_dir.rstrip("/\\"))
     return {
         "shard": shard_name,
         "articles": total_articles,
```

**File**: `embed/src/pixelrag_embed/index.py` (modified, +4/-0)
```diff
@@ -195,6 +195,10 @@ def build_ivf(
     # Build IVF index
     metric_type = faiss.METRIC_INNER_PRODUCT if metric == "ip" else faiss.METRIC_L2
 
+    # Auto-adjust nlist when dataset is smaller than configured nlist
+    if n < nlist:
+        nlist = max(1, n)
+
     # Train on a sample
     actual_train = min(train_sample, n)
     train_indices = np.random.choice(n, actual_train, replace=False)
```

**File**: `index/src/pixelrag_index/config.py` (modified, +11/-3)
```diff
@@ -21,18 +21,26 @@ def load_config(path=None):
                 path = str(c)
                 break
     if path and os.path.exists(path):
-        with open(path) as f:
+        with open(path, encoding="utf-8") as f:
             config = yaml.safe_load(f) or {}
     else:
         config = {}
-    return {**DEFAULT_CONFIG, **config}
+    merged = {**DEFAULT_CONFIG, **config}
+    for section in ("ingest", "embed"):
+        if (
+            section in DEFAULT_CONFIG
+            and section in config
+            and isinstance(config[section], dict)
+        ):
+            merged[section] = {**DEFAULT_CONFIG[section], **config[section]}
+    return merged
 
 
 def make_source(config):
     source_config = dict(config.get("source", {}))
     source_type = source_config.pop("type", "local")
     # Expand ~ in any string values that look like paths
     for k, v in source_config.items():
-        if isinstance(v, str) and ("/" in v or "~" in v):
+        if isinstance(v, str) and ("/" in v or "\\" in v or "~" in v):
             source_config[k] = str(Path(v).expanduser())
     return SOURCES[source_type](**source_config)
```

**File**: `index/src/pixelrag_index/pipelines.py` (modified, +10/-7)
```diff
@@ -63,9 +63,10 @@ def _department_of(article: dict, source_root: str) -> str:
     if not raw:
         url = article.get("url") or ""
         if url.startswith("file://"):
-            from urllib.parse import unquote, urlparse
+            from urllib.parse import urlparse
+            from urllib.request import url2pathname
 
-            raw = unquote(urlparse(url).path)
+            raw = url2pathname(urlparse(url).path)
     if not raw or not source_root:
         return ""
     try:
@@ -291,8 +292,9 @@ def _repl(m: re.Match) -> str:
                     "tiles": ["tile_0000.jpg"],
                     "complete": True,
                 }
-                with open(tile_dir / "tiles.json", "w") as f:
-                    json.dump(manifest, f)
+                tmp_tiles = tile_dir / "tiles.json.tmp"
+                tmp_tiles.write_text(json.dumps(manifest))
+                os.replace(tmp_tiles, tile_dir / "tiles.json")
             except Exception as e:
                 logger.warning("  FAILED image %s: %s", doc.id, e)
         logger.info("  Rendered %d local images", len(image_docs))
@@ -441,9 +443,10 @@ def _repl(m: re.Match) -> str:
         import numpy as np
 
         npz_files = sorted(embeddings_dir.glob("shard_*.npz"))
-        total_vectors = sum(
-            np.load(f, mmap_mode="r")["embeddings"].shape[0] for f in npz_files
-        )
+        total_vectors = 0
+        for f in npz_files:
+            with np.load(f, mmap_mode="r") as data:
+                total_vectors += data["embeddings"].shape[0]
         nlist = min(4096, max(1, total_vectors // 40))
         logger.info(
             "Stage 4/4: Building FAISS index (%d vectors, nlist=%d)...",
```

**File**: `index/src/pixelrag_index/sources/kiwix.py` (modified, +16/-2)
```diff
@@ -233,19 +233,33 @@ def ensure_running(self) -> None:
             self._start_instance(idx)
 
     def _kill_proc(self, proc: subprocess.Popen) -> None:
+        if proc.poll() is not None:
+            return
         try:
-            os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
+            if hasattr(os, "killpg") and hasattr(os, "getpgid"):
+                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
+            else:
+                proc.terminate()
         except (OSError, ProcessLookupError):
             pass
         try:
             proc.wait(timeout=5)
         except subprocess.TimeoutExpired:
             try:
-                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
+                if (
+                    hasattr(os, "killpg")
+                    and hasattr(os, "getpgid")
+                    and hasattr(signal, "SIGKILL")
+                ):
+                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
+                else:
+                    proc.kill()
             except (OSError, ProcessLookupError):
                 pass
 
     def stop(self) -> None:
+        if not hasattr(self, "_procs"):
+            return
         for idx, proc in enumerate(self._procs):
             if proc is not None:
                 self._kill_proc(proc)
```

---

### Incident Patch 2: `7a484cbc` (2026-09-27)
**Commit Message**: fix(serve): bound /reconstruct and stop unknown ids becoming 500s (#161)

`ReconstructRequest.vector_ids` had no cap. Each id returns a full
`dimension`-length float list (~40 KB of JSON at dim 2048) and the first
call builds a direct map over the whole index, so a single request could
force a multi-GB response on the public endpoint — the same class as the
/search bounds in #122 and #154. Cap at 256 ids (out of range -> 422).

`FaissBackend.reconstruct` also did `self.index.reconstruct(int(v))` with
no validation: a non-numeric id raised ValueError and an out-of-range id
raised RuntimeError, both surfacing as uncaught 500s. Vectors are added
sequentially (`index.add`, no IDMap), so valid ids are 0..ntotal-1 —
anything else now yields None, which is the VectorBackend protocol's
documented `list[float] | None` and what QdrantBackend already returned.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `serve/src/pixelrag_serve/api.py` (modified, +8/-1)
```diff
@@ -639,8 +639,15 @@ async def departments():
     }
 
 
+# Bound for the public /reconstruct endpoint: every id returns a full
+# `dimension`-length float list, which serializes to ~40 KB of JSON at dim 2048,
+# and the first call builds a direct map over the whole index. Real callers
+# debug a handful of vectors at a time.
+_MAX_RECONSTRUCT_IDS = 256
+
+
 class ReconstructRequest(BaseModel):
-    vector_ids: list[int | str]
+    vector_ids: list[int | str] = Field(max_length=_MAX_RECONSTRUCT_IDS)
 
 
 @app.post("/reconstruct")
```

**File**: `serve/src/pixelrag_serve/backends.py` (modified, +17/-1)
```diff
@@ -163,7 +163,23 @@ def reconstruct(self, vids):
         if not self._direct_map_built and hasattr(self.index, "make_direct_map"):
             self.index.make_direct_map()
             self._direct_map_built = True
-        return [self.index.reconstruct(int(v)).tolist() for v in vids]
+        out = []
+        for v in vids:
+            # Vectors are added sequentially (index.add, no IDMap), so valid ids
+            # are 0..ntotal-1. An unknown or non-integer id yields None — the
+            # protocol's documented `list[float] | None`, and what QdrantBackend
+            # already does — instead of an uncaught ValueError/RuntimeError
+            # surfacing as a 500 on the public endpoint.
+            try:
+                i = int(v)
+            except (TypeError, ValueError):
+                out.append(None)
+                continue
+            if not 0 <= i < self.index.ntotal:
+                out.append(None)
+                continue
+            out.append(self.index.reconstruct(i).tolist())
+        return out
 
 
 class QdrantBackend:
```

**File**: `tests/test_serve_backends.py` (modified, +11/-0)
```diff
@@ -185,5 +185,16 @@ def test_reconstruct_round_trips(backend):
     np.testing.assert_allclose(np.asarray(vecs[1]), VECTORS[5], atol=1e-6)
 
 
+def test_reconstruct_unknown_id_is_none(backend):
+    # Both backends report an id they don't hold as None rather than raising —
+    # /reconstruct is public, so an unknown id must not become a 500.
+    assert backend.reconstruct([1, 10**6])[1:] == [None]
+
+
+def test_reconstruct_non_integer_id_is_none(faiss_backend):
+    # FAISS ids are integers; a non-numeric id is a client mistake, not a crash.
+    assert faiss_backend.reconstruct(["not-an-id"]) == [None]
+
+
 def test_k_zero_returns_empty(backend):
     assert backend.raw_search(VECTORS[0:1], 0) == [[]]
```

**File**: `tests/test_serve_reconstruct.py` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+"""Input bound on the public /reconstruct endpoint (OOM/DoS hardening).
+
+Every id returns a full `dimension`-length float list (~40 KB of JSON at dim
+2048) and the first call builds a direct map over the index, so an unbounded
+`vector_ids` list is the same class of trivial OOM as the /search bounds.
+"""
+
+import pytest
+
+pytest.importorskip("fastapi", reason="serve extra not installed")
+from pixelrag_serve.api import _MAX_RECONSTRUCT_IDS, ReconstructRequest
+from pydantic import ValidationError
+
+
+def test_vector_ids_are_capped():
+    ReconstructRequest(vector_ids=list(range(_MAX_RECONSTRUCT_IDS)))
+    with pytest.raises(ValidationError):
+        ReconstructRequest(vector_ids=list(range(_MAX_RECONSTRUCT_IDS + 1)))
```

---

### Incident Patch 3: `c0cfe7f7` (2026-09-24)
**Commit Message**: fix(serve): bound query image decode and batch size to prevent OOM/DoS (#154)

* fix(serve): bound query image decode and batch size to prevent OOM/DoS

* test(serve): skip image-input tests without serve extra, sort imports

CI's Tests job runs `uv sync --extra dev` only, so fastapi isn't
installed; skip like test_serve_backends does for faiss.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `serve/src/pixelrag_serve/api.py` (modified, +30/-3)
```diff
@@ -171,7 +171,9 @@ class Query(BaseModel):
 
 
 class SearchRequest(BaseModel):
-    queries: list[Query]
+    # Bounded: an unbounded batch multiplies every per-query cost (embedding,
+    # image decode) on the public endpoint. Real callers send 1; 32 is generous.
+    queries: list[Query] = Field(max_length=32)
     # Bounded: fetch_k = n_docs * 10 feeds FAISS search k, so an unbounded value
     # is a trivial OOM/DoS on the public endpoint. Largest real caller uses 10.
     n_docs: int = Field(default=10, ge=1, le=1000)
@@ -271,6 +273,12 @@ class StatusResponse(BaseModel):
 
 DEFAULT_INSTRUCTION = "Retrieve images or text relevant to the user's query."
 
+# Bounds for attacker-controlled query images on the public /search endpoint.
+# ~10 MB of base64 caps the payload/decode; 25 MP caps the decoded RGB canvas
+# (query images are downscaled far below this for the VL model anyway).
+_MAX_IMAGE_B64_LEN = 10 * 1024 * 1024
+_MAX_IMAGE_PIXELS = 25_000_000
+
 
 def _parse_queries(
     queries: list[Query], instruction: str | None = None
@@ -291,8 +299,27 @@ def _parse_queries(
             img_data = q.image
             if img_data.startswith("data:"):
                 img_data = img_data.split(",", 1)[-1]
-            img_bytes = base64.b64decode(img_data)
-            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
+            # Public endpoint: q.image is attacker-controlled. Bound the payload
+            # and the decoded canvas so an oversized blob or a tiny
+            # "decompression bomb" can't OOM the service, and turn any decode
+            # failure into a clean 400 instead of an uncaught 500.
+            if len(img_data) > _MAX_IMAGE_B64_LEN:
+                raise HTTPException(
+                    status_code=400,
+                    detail=f"image too large (max {_MAX_IMAGE_B64_LEN} base64 chars)",
+                )
+            try:
+                img = Image.open(io.BytesIO(base64.b64decode(img_data)))
+                if img.width * img.height > _MAX_IMAGE_PIXELS:
+                    raise HTTPException(
+                        status_code=400,
+                        detail=f"image too large (max {_MAX_IMAGE_PIXELS} pixels)",
+                    )
+                img = img.convert("RGB")
+            except HTTPException:
+                raise
+            except Exception:
+                raise HTTPException(status_code=400, detail="invalid image data")
             user_content.append({"type": "image", "image": img})
         if q.text:
             user_content.append({"type": "text", "text": q.text})
```

**File**: `tests/test_serve_image_input.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+"""Input bounds on the public /search endpoint (OOM/DoS hardening).
+
+`_parse_queries` decodes attacker-controlled base64 images and `SearchRequest`
+caps the batch size. A crafted request must not exhaust memory or turn an
+uncaught decode error into a 500 — the same public-endpoint hardening as the
+n_docs bound.
+"""
+
+import base64
+import io
+
+import pytest
+
+pytest.importorskip("fastapi", reason="serve extra not installed")
+from fastapi import HTTPException
+from PIL import Image
+from pixelrag_serve.api import Query, SearchRequest, _parse_queries
+from pydantic import ValidationError
+
+
+def _png_b64(w: int, h: int) -> str:
+    buf = io.BytesIO()
+    Image.new("RGB", (w, h)).save(buf, format="PNG")
+    return base64.b64encode(buf.getvalue()).decode()
+
+
+def test_queries_batch_is_capped():
+    SearchRequest(queries=[Query(text="ok")])  # small batch fine
+    with pytest.raises(ValidationError):
+        SearchRequest(queries=[Query(text="x")] * 33)
+
+
+def test_valid_image_decodes():
+    _, images = _parse_queries([Query(image=_png_b64(4, 4))])
+    assert images[0] is not None and images[0].mode == "RGB"
+
+
+def test_corrupt_image_is_400_not_500():
+    not_an_image = base64.b64encode(b"hello world, definitely not a png").decode()
+    with pytest.raises(HTTPException) as e:
+        _parse_queries([Query(image=not_an_image)])
+    assert e.value.status_code == 400
+
+
+def test_oversized_payload_is_400(monkeypatch):
+    monkeypatch.setattr("pixelrag_serve.api._MAX_IMAGE_B64_LEN", 16)
+    with pytest.raises(HTTPException) as e:
+        _parse_queries([Query(image=_png_b64(4, 4))])  # base64 longer than 16
+    assert e.value.status_code == 400
+
+
+def test_decompression_bomb_is_400(monkeypatch):
+    # A small image over a lowered pixel cap stands in for a bomb whose header
+    # claims a huge canvas — the guard must reject before .convert() allocates.
+    monkeypatch.setattr("pixelrag_serve.api._MAX_IMAGE_PIXELS", 100)
+    with pytest.raises(HTTPException) as e:
+        _parse_queries([Query(image=_png_b64(50, 50))])  # 2500 px > 100
+    assert e.value.status_code == 400
```

---

### Incident Patch 4: `0e22177a` (2026-09-09)
**Commit Message**: fix(opencode-plugin): default the tile directory inside the project (#157)

The screenshot tool defaulted output to /tmp/pixelbrowse, outside the
project root, so reading the tiles hits opencode's external_directory
permission. Under `opencode run` that is auto-rejected and the agent is
left holding tile paths it cannot open; the TUI prompts on every
screenshot instead.

execute now takes the ToolContext it is already passed and defaults to
<worktree>/.opencode/pixelbrowse. Measured on opencode 1.18.29 with
pixelshot from pixelrag 0.4.0: the same page and the same plugin read
the tiles first try when output is project-local, and are rejected when
it is /tmp/pixelbrowse.

**File**: `plugin/opencode/README.md` (modified, +1/-1)
```diff
@@ -33,7 +33,7 @@ opencode run "screenshot https://news.ycombinator.com and summarize the top stor
 
 The agent calls the `screenshot` tool with a URL (or a local HTML file, PDF, or image),
 gets back the tile image paths, and reads them visually. Optional tool args: `output`
-(tile directory, default `/tmp/pixelbrowse`) and `viewportWidth` (default 875; use 1280
+(tile directory, default `.opencode/pixelbrowse` inside the project) and `viewportWidth` (default 875; use 1280
 for desktop layouts).
 
 No MCP server, no backend — the plugin just calls `pixelshot` on your machine.
```

**File**: `plugin/opencode/index.js` (modified, +10/-4)
```diff
@@ -13,7 +13,7 @@ further down. Tiles are rendered at 1568px height for optimal vision-model reada
 
 If text or details are too small to read, crop the region of interest from a tile and
 re-read at full resolution. Pillow is always available (it's a pixelshot dependency):
-  python3 -c "from PIL import Image; Image.open('<tile>').crop((x1, y1, x2, y2)).save('/tmp/pixelbrowse/crop.png')"
+  python3 -c "from PIL import Image; Image.open('<tile>').crop((x1, y1, x2, y2)).save('<tile>.crop.png')"
 Crop to roughly 800x800 or smaller for maximum clarity.`
 
 const INSTALL_HINT =
@@ -55,16 +55,22 @@ export const PixelbrowsePlugin = async ({ $ }) => {
           output: tool.schema
             .string()
             .optional()
-            .describe("Output directory for tiles (default /tmp/pixelbrowse)"),
+            .describe(
+              "Output directory for tiles (default .opencode/pixelbrowse inside the project)"
+            ),
           viewportWidth: tool.schema
             .number()
             .optional()
             .describe(
               "Viewport width in px (default 875, mobile/article width). Use 1280 for desktop layouts."
             ),
         },
-        async execute(args) {
-          const output = args.output ?? "/tmp/pixelbrowse"
+        async execute(args, context) {
+          // Default inside the project: tiles written outside it trip opencode's
+          // external_directory permission, which auto-rejects under `opencode run`,
+          // so the agent gets tile paths it is not allowed to read.
+          const output =
+            args.output ?? join(context.worktree ?? context.directory, ".opencode", "pixelbrowse")
 
           try {
             await $`which pixelshot`.quiet()
```

---

### Incident Patch 5: `a9b9bc39` (2026-08-30)
**Commit Message**: fix(render): the PDF manifest's `complete` flag must mean something too (#152)

* fix(render): the PDF manifest's `complete` flag must mean something too

#141 made `complete` derived in both URL backends. The PDF backend writes the
same key into the same filename and still hardcodes it, so the claim #139
makes about the manifest contract still holds on this path: a consumer cannot
tell a whole document from a fragment of one.

render_pdf takes a `pages` selection. When it is given, only those pages are
written — and the manifest still said `complete: true`, with `total_pages`
reporting the size of the subset, so nothing in the directory distinguished
"this three-page document" from "three pages of some longer document".

- `complete` is now `pages is None`: only a whole-document render may claim it.
  An explicit range counts as a selection even when it happens to cover every
  page, because the backend has not checked it against the document's length.
- `requested_pages` records the selection, so a consumer can see what was asked
  for instead of being told out of band — the same move as recording
  `tile_height` in the URL manifests.

No in-repo caller passes `pages` today; it i

**File**: `render/src/pixelrag_render/backends/pdf.py` (modified, +9/-1)
```diff
@@ -113,7 +113,15 @@ def render_pdf(
         "dpi": dpi,
         "total_pages": len(saved_tiles),
         "tiles": saved_tiles,
-        "complete": True,
+        # The selection the render ran with, recorded for the same reason the
+        # URL manifests record their tile height: so a consumer reading
+        # tiles.json can see what was asked for rather than be told out of band.
+        "requested_pages": sorted(pages) if pages is not None else None,
+        # A page selection means these tiles are some of the document rather
+        # than all of it, and nothing here has checked the selection against
+        # the document's length. Only a whole-document render may claim to be
+        # complete — see #139 on what an unconditional flag costs downstream.
+        "complete": pages is None,
     }
     with open(tile_dir / "tiles.json", "w") as f:
         json.dump(manifest, f)
```

**File**: `tests/test_pdf_manifest.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+"""The PDF manifest's `complete` flag must mean what the URL manifests' does.
+
+#139 made the case that a manifest which always claims completeness is worse
+than no flag at all: a consumer cannot tell a whole capture from a fragment,
+so it reads the fragment as the whole. #141 fixed that for the two URL
+backends. The PDF backend writes the same key and still hardcodes it, so a
+caller that asked for a subset of pages gets a directory that claims to be the
+entire document.
+"""
+
+import json
+import shutil
+from pathlib import Path
+
+import pytest
+from PIL import Image
+from pixelrag_render import render_pdf
+
+# pdf2image ships in the optional `pdf` extra and needs poppler's rasteriser on
+# PATH; CI syncs only `--extra dev`. Skip rather than fail, matching how the
+# suite treats the other extras (see test_serve_backends.py).
+pytest.importorskip("pdf2image", reason="pdf extra not installed")
+
+pytestmark = pytest.mark.skipif(
+    shutil.which("pdftoppm") is None,
+    reason="poppler (pdftoppm) not on PATH; pdf2image cannot rasterise",
+)
+
+
+@pytest.fixture
+def three_page_pdf(tmp_path):
+    pdf = tmp_path / "doc.pdf"
+    pages = [Image.new("RGB", (612, 792), "white") for _ in range(3)]
+    pages[0].save(pdf, save_all=True, append_images=pages[1:])
+    return pdf
+
+
+def _manifest(tile_dirs):
+    return json.loads((Path(tile_dirs[0]) / "tiles.json").read_text())
+
+
+def test_pdf_manifest_reports_a_full_render_as_complete(three_page_pdf, tmp_path):
+    dirs = render_pdf(three_page_pdf, tmp_path / "out", dpi=50)
+    manifest = _manifest(dirs)
+
+    assert len(manifest["tiles"]) == 3
+    assert manifest["complete"] is True
+    assert manifest["requested_pages"] is None
+
+
+def test_pdf_manifest_reports_a_page_subset_as_incomplete(three_page_pdf, tmp_path):
+    """The whole point of the flag: two of three pages is not the document."""
+    dirs = render_pdf(three_page_pdf, tmp_path / "out", dpi=50, pages=[1, 3])
+    manifest = _manifest(dirs)
+
+    assert len(manifest["tiles"]) == 2, f"test setup rendered wrong: {manifest}"
+    assert manifest["complete"] is False
+    assert manifest["requested_pages"] == [1, 3]
+
+
+def test_pdf_manifest_records_a_full_page_range_as_incomplete(three_page_pdf, tmp_path):
+    """An explicit range that happens to cover everything is still a request.
+
+    The caller asked for specific pages; the backend has not checked them
+    against the document's length, so it must not claim to have captured the
+    document.
+    """
+    dirs = render_pdf(three_page_pdf, tmp_path / "out", dpi=50, pages=[1, 2, 3])
+    manifest = _manifest(dirs)
+
+    assert len(manifest["tiles"]) == 3
+    assert manifest["complete"] is False
+    assert manifest["requested_pages"] == [1, 2, 3]
```

---

### Incident Patch 6: `bba0e362` (2026-08-29)
**Commit Message**: fix: correct torch_dtype kwarg, help text default, and CLI backend choices (#123)

* fix: correct torch_dtype kwarg, help text default, and CLI backend choices

* review: keep dtype=dtype, finish the playwright removal

transformers is pinned at 4.57.1, where `torch_dtype` is the deprecated
spelling (modeling_utils warns "`torch_dtype` is deprecated! Use `dtype`
instead!"). serve/api.py's existing `dtype=dtype` is the current form, so
that hunk is reverted.

The --backend change was right — render_url() only dispatches "cdp" and
raises on anything else — but three docstrings and a CLI example still
advertised playwright. Removed those too.

---------

Co-authored-by: yichuan520030910320 <yichuan_wang@berkeley.edu>

**File**: `index/src/pixelrag_index/monitor.py` (modified, +1/-1)
```diff
@@ -737,7 +737,7 @@ def main():
         "--validate-max-fail-pct",
         type=float,
         default=5.0,
-        help="Exit(1) if Gemini fail percentage exceeds this (default: 10.0)",
+        help="Exit(1) if Gemini fail percentage exceeds this (default: 5.0)",
     )
     parser.add_argument(
         "--validate-interval",
```

**File**: `render/src/pixelrag_render/render.py` (modified, +4/-5)
```diff
@@ -33,8 +33,7 @@ def render_url(
     Args:
         url: URL to capture (http:// or https:// or file://).
         output_dir: Directory to write tile subdirectories into.
-        backend: Rendering backend: ``"cdp"`` (default, fastest) or
-                 ``"playwright"`` (full-featured).
+        backend: Rendering backend. Only ``"cdp"`` is implemented.
         tile_height: Maximum tile height in pixels (default 8192).
         quality: JPEG quality 1-100 (default 85).
         viewport_width: Browser viewport width in pixels (default 875).
@@ -73,7 +72,7 @@ def render_urls(
     Args:
         urls: URLs to capture.
         output_dir: Directory to write tile subdirectories into.
-        backend: ``"cdp"`` (default) or ``"playwright"``.
+        backend: Rendering backend. Only ``"cdp"`` is implemented.
         stems: Optional list of output directory stems (one per URL).
                If provided, tiles are written to ``{output_dir}/{stem}.png.tiles/``
                instead of deriving names from URLs. Useful for assigning
@@ -205,7 +204,7 @@ def main() -> None:
         pixelshot report.pdf --output ./tiles
 
         # Local HTML
-        pixelshot index.html --output ./tiles --backend playwright
+        pixelshot index.html --output ./tiles
 
         # URL file
         pixelshot urls.txt --output ./tiles
@@ -252,7 +251,7 @@ def main() -> None:
     )
     parser.add_argument(
         "--backend",
-        choices=["cdp", "playwright"],
+        choices=["cdp"],
         default="cdp",
         help="Browser backend for URL/HTML rendering (default: cdp).",
     )
```

---

### Incident Patch 7: `3688a5ea` (2026-08-29)
**Commit Message**: fix(serve): bound n_docs to prevent unbounded-search OOM/DoS (#122)

n_docs had no limit and fetch_k = n_docs * 10 feeds FAISS's search k, so a request with a huge n_docs triggers a massive allocation on the public endpoint. Constrain to 1..1000 via pydantic Field (largest real caller uses 10).

Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `serve/src/pixelrag_serve/api.py` (modified, +4/-2)
```diff
@@ -52,7 +52,7 @@
 from fastapi.middleware.cors import CORSMiddleware
 from fastapi.responses import FileResponse, Response
 from PIL import Image
-from pydantic import BaseModel
+from pydantic import BaseModel, Field
 
 _request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
     "request_id",
@@ -172,7 +172,9 @@ class Query(BaseModel):
 
 class SearchRequest(BaseModel):
     queries: list[Query]
-    n_docs: int = 10
+    # Bounded: fetch_k = n_docs * 10 feeds FAISS search k, so an unbounded value
+    # is a trivial OOM/DoS on the public endpoint. Largest real caller uses 10.
+    n_docs: int = Field(default=10, ge=1, le=1000)
     nprobe: int | None = None  # override default nprobe
     min_tile_height: int | None = None  # filter out small/blank chunks
     instruction: str | None = None  # override query embedding instruction
```

---

### Incident Patch 8: `7b47d34d` (2026-08-29)
**Commit Message**: fix(index): accept a single file as a source path (#130)

`LocalSource` walked the path with `rglob("*")` and `PDFSource` with
`glob("**/*.pdf")`. Both return nothing when the path points at a file
rather than a directory, so a single-document source silently yielded
zero documents and the run failed four stages later in `build-index`
with "No shard files found!".

This is the form the README documents:

    source:
      type: local
      path: ./paper.pdf

Branch on `is_file()` in both adapters so a path pointing straight at a
document is a single-item source. Directory traversal is unchanged, and
the single-file path keeps the same extension filtering as the directory
one.

Also note the `pdf` extra and poppler in the PDF quickstart — the
documented `pixelrag[index]` alone cannot render a PDF.

Verified on macOS (Apple Silicon, MPS): `pixelrag index build` against
assets/pixelrag-paper.pdf now builds a 35-vector index from either a file
or a directory path; before, the file form produced zero documents.

**File**: `README.md` (modified, +4/-1)
```diff
@@ -174,8 +174,11 @@ pixelrag serve --index-dir ./my_index --port 30001
 
 No GPU required — runs on macOS (Apple Silicon) or any machine with Python 3.10+.
 
+PDF rendering needs the `pdf` extra and poppler (`brew install poppler`, or
+`apt-get install poppler-utils` on Debian/Ubuntu).
+
 ```bash
-pip install 'pixelrag[index]'
+pip install 'pixelrag[index,pdf]'
 
 # 1. Grab a sample PDF (or use your own)
 curl -L -o paper.pdf https://raw.githubusercontent.com/StarTrail-org/PixelRAG/main/assets/pixelrag-paper.pdf
```

**File**: `index/src/pixelrag_index/sources/local.py` (modified, +7/-4)
```diff
@@ -1,4 +1,4 @@
-"""Local directory source — auto-detect file types."""
+"""Local source — a single file or a directory tree; auto-detect file types."""
 
 from pathlib import Path
 from typing import Iterator
@@ -20,10 +20,13 @@
 class LocalSource(Source):
     def __init__(self, path: str, **kwargs):
         self.path = Path(path)
+        # A path pointing straight at a document is a single-item source; rglob
+        # on a file yields nothing, so branch before walking.
+        candidates = (
+            [self.path] if self.path.is_file() else sorted(self.path.rglob("*"))
+        )
         self._files = [
-            f
-            for f in sorted(self.path.rglob("*"))
-            if f.is_file() and f.suffix.lower() in EXTENSIONS
+            f for f in candidates if f.is_file() and f.suffix.lower() in EXTENSIONS
         ]
 
     def __iter__(self) -> Iterator[Document]:
```

**File**: `index/src/pixelrag_index/sources/pdf.py` (modified, +8/-2)
```diff
@@ -1,4 +1,4 @@
-"""PDF directory source."""
+"""PDF source — a single .pdf file or a directory tree of them."""
 
 from pathlib import Path
 from typing import Iterator
@@ -9,7 +9,13 @@
 class PDFSource(Source):
     def __init__(self, path: str, **kwargs):
         self.path = Path(path)
-        self._files = sorted(self.path.glob("**/*.pdf"))
+        # A path pointing straight at a .pdf is a single-item source; the glob
+        # below only ever matches inside a directory.
+        self._files = (
+            [self.path]
+            if self.path.is_file() and self.path.suffix.lower() == ".pdf"
+            else sorted(self.path.glob("**/*.pdf"))
+        )
 
     def __iter__(self) -> Iterator[Document]:
         for pdf in self._files:
```

**File**: `tests/test_source_single_file.py` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+"""A source path may point straight at a document, not just a directory.
+
+`pixelrag index build --source ./paper.pdf` is the form the README documents,
+but both adapters used to walk the path as a directory — which silently
+yielded zero documents and failed several stages later at index build.
+"""
+
+import sys
+from pathlib import Path
+
+import pytest
+
+sys.path.insert(0, str(Path(__file__).parents[1] / "index" / "src"))
+from pixelrag_index.sources.local import LocalSource
+from pixelrag_index.sources.pdf import PDFSource
+
+
+@pytest.fixture
+def docs_dir(tmp_path):
+    (tmp_path / "paper.pdf").write_bytes(b"%PDF-1.4\n")
+    (tmp_path / "notes.md").write_text("# Notes")
+    (tmp_path / "ignored.csv").write_text("a,b,c")
+    nested = tmp_path / "sub"
+    nested.mkdir()
+    (nested / "deep.pdf").write_bytes(b"%PDF-1.4\n")
+    return tmp_path
+
+
+def test_pdf_source_accepts_a_single_file(docs_dir):
+    source = PDFSource(str(docs_dir / "paper.pdf"))
+    assert [d.id for d in source] == ["paper"]
+    assert len(source) == 1
+
+
+def test_local_source_accepts_a_single_file(docs_dir):
+    source = LocalSource(str(docs_dir / "notes.md"))
+    docs = list(source)
+    assert [d.id for d in docs] == ["notes"]
+    assert docs[0].metadata["type"] == "text"
+
+
+def test_local_source_single_file_still_filters_by_extension(docs_dir):
+    """An unsupported suffix yields nothing, matching directory behaviour."""
+    assert len(LocalSource(str(docs_dir / "ignored.csv"))) == 0
+
+
+def test_directory_traversal_is_unchanged(docs_dir):
+    """The directory path must keep recursing into sub-directories."""
+    assert {d.id for d in PDFSource(str(docs_dir))} == {"paper", "deep"}
+    assert {d.id for d in LocalSource(str(docs_dir))} == {"paper", "notes", "deep"}
```

---

### Incident Patch 9: `c4b11254` (2026-08-29)
**Commit Message**: fix(render): make the manifest's `complete` flag mean something (#141)

`complete` was written as a literal `True` on every capture, so nothing in
tiles.json could ever distinguish a full page from one viewport of it. The
signal that would have revealed the difference — a measured page height equal
to the emulated viewport (i.e. the tile height) — was neither warned about at
render time nor recorded in a form a later consumer could check, since the
tile height itself never made it into URL manifests.

This is independent of any particular truncation bug: the same silence held
for the height formula #131 fixed and will hold for whatever causes the next
one.

- `page_metrics.truncation_reason()` states the rule once, next to the shared
  measurement JS, so the standard and turbo backends agree on what a manifest
  means whichever Chrome the capture ran on.
- Both backends log a warning and write `complete: false` when the probe fell
  back or the height came back at exactly one viewport. The tiles are still
  captured and written — only the claim about them changes.
- URL manifests now record `tile_height` and `viewport_width`, so a consumer
  can redo the comparison instead of being

**File**: `plugin/commands/screenshot.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ allowed-tools: "Bash, Read"
 ---
 
 1. Run: `pixelshot $ARGUMENTS --output /tmp/pixelbrowse --tile-height 1568`
-2. The output tile is at `/tmp/pixelbrowse/<domain>.png.tiles/tile_0000.jpg` — read it directly with the Read tool. Do not ls.
+2. Read `/tmp/pixelbrowse/<domain>.png.tiles/tiles.json`, then read every tile it lists with the Read tool (they are `tile_NNNN.jpg` in that same directory, top of the page first). If the manifest says `"complete": false`, the page was only partly captured — report that alongside what you saw.
 3. If text is too small to read, crop with Pillow (always available — it's a pixelshot dependency):
    `python3 -c "from PIL import Image; Image.open('<tile>').crop((x1,y1,x2,y2)).save('/tmp/pixelbrowse/crop.png')"`
 4. Report what you see.
```

**File**: `plugin/skills/pixelbrowse/SKILL.md` (modified, +18/-3)
```diff
@@ -36,6 +36,8 @@ pixelshot document.pdf --output /tmp/pixelbrowse
 IMPORTANT: Always use `--tile-height 1568` for screenshots you will read visually.
 Claude's vision model downscales images with long edge > 1568px (Sonnet/Haiku) or 2576px (Opus).
 The default 8192px tile height will be downscaled and text becomes unreadable.
+Note that the tile height is also the emulated viewport height, so at 1568 an ordinary article
+is a dozen-plus tiles rather than one or two — the manifest tells you how many (see Workflow).
 
 IMPORTANT: Always use `--wait-network-idle` for URLs. Without it, JavaScript-heavy
 pages (most modern sites / single-page apps) are captured before they finish rendering
@@ -47,14 +49,27 @@ After rendering, read the tile images from the output directory to visually unde
 ## Workflow
 
 1. Run `pixelshot <url> --output /tmp/pixelbrowse --tile-height 1568 --wait-network-idle`
-2. Read `/tmp/pixelbrowse/<domain>.png.tiles/tile_0000.jpg` directly (no need to ls — the naming is deterministic)
-3. If the page is long, also read tile_0001.jpg, tile_0002.jpg, etc.
+2. Read `/tmp/pixelbrowse/<domain>.png.tiles/tiles.json` — the manifest of what was captured
+3. Read every tile it lists, in order, not just `tile_0000.jpg`
 
 Output path pattern: `/tmp/pixelbrowse/<sanitized-url>.png.tiles/tile_NNNN.jpg`
 - For `https://news.ycombinator.com` → `/tmp/pixelbrowse/news.ycombinator.com.png.tiles/tile_0000.jpg`
 - For `https://example.com/page` → `/tmp/pixelbrowse/example.com_page.png.tiles/tile_0000.jpg`
 
-Do NOT run `ls` — just read tile_0000.jpg. If it doesn't exist, the page had no content.
+Read `tiles.json` rather than `ls` (or guessing at tile numbers) — it is one file read and it
+answers both questions the tile files can't:
+
+```json
+{"url": "...", "page_height": 29184, "tile_height": 1568, "tiles": ["tile_0000.jpg", "..."], "complete": true}
+```
+
+- **`tiles`** — the full list. A long page is many tiles; reading only `tile_0000.jpg` on a
+  30,000px article means reading 5% of it. Read them all before summarising.
+- **`complete: false`** — the capture is not trustworthy: pixelshot could not measure the page,
+  so what you have is roughly one viewport of an unknown-length page. Say so in your answer
+  rather than presenting it as the whole page. Re-running with `--wait-network-idle` (if it was
+  omitted) or a different `--viewport-width` often fixes it.
+- **No `tiles.json` at all** — the render failed. That is an error to report, not an empty page.
 
 ## Crop & Zoom
 
```

**File**: `render/src/pixelrag_render/backends/cdp.py` (modified, +22/-4)
```diff
@@ -35,7 +35,7 @@
 
 from PIL import Image
 
-from .page_metrics import CONTENT_BOTTOM_JS
+from .page_metrics import CONTENT_BOTTOM_JS, truncation_reason
 
 logger = logging.getLogger("pixelrag_render.backends.cdp")
 
@@ -444,8 +444,13 @@ async def capture_url(
         },
     )
     try:
-        page_height = result["result"]["value"]
-    except (KeyError, TypeError):
+        page_height = int(result["result"]["value"])
+    except (KeyError, TypeError, ValueError):
+        page_height = 0
+    # A zero/negative height is as much a probe failure as a missing one, and
+    # would otherwise tile nothing at all while still claiming success.
+    height_measured = page_height > 0
+    if not height_measured:
         page_height = tile_h
 
     tiles = []
@@ -507,11 +512,24 @@ async def capture_url(
         idx += 1
         y += tile_h
 
+    reason = truncation_reason(page_height, tile_h, measured=height_measured)
+    if reason:
+        logger.warning(
+            "%s: %s — capturing what is on screen and marking the manifest incomplete",
+            url,
+            reason,
+        )
+
     manifest = {
         "url": url,
         "page_height": page_height,
+        # The geometry the capture ran at. Recorded so a consumer reading
+        # tiles.json later can redo the page_height/tile_height comparison
+        # itself instead of being told the tile height out of band.
+        "tile_height": tile_h,
+        "viewport_width": viewport_w,
         "tiles": tiles,
-        "complete": True,
+        "complete": reason is None,
     }
     with open(tile_dir / "tiles.json", "w") as f:
         json.dump(manifest, f)
```

**File**: `render/src/pixelrag_render/backends/fast_cdp.py` (modified, +22/-4)
```diff
@@ -34,7 +34,7 @@
 import urllib.request
 from pathlib import Path
 
-from .page_metrics import CONTENT_BOTTOM_JS
+from .page_metrics import CONTENT_BOTTOM_JS, truncation_reason
 
 logger = logging.getLogger("pixelrag_render.backends.fast_cdp")
 
@@ -492,9 +492,11 @@ async def worker_task(wi: int):
                         },
                     )
                     page_h = r["result"]["result"]["value"]
-                    if not page_h or page_h <= 0:
+                    height_measured = bool(page_h) and page_h > 0
+                    if not height_measured:
                         page_h = tile_height
                 except Exception:
+                    height_measured = False
                     page_h = tile_height
 
                 n_tiles = max(1, (page_h + tile_height - 1) // tile_height)
@@ -586,13 +588,29 @@ async def worker_task(wi: int):
                     n_written += 1
                     tile_names.append(f"tile_{t:04d}.jpg")
 
-                # Write manifest
+                # Write manifest. `complete` has to mean something here too —
+                # see page_metrics.truncation_reason; the standard path applies
+                # the identical rule, so a manifest reads the same whichever
+                # Chrome the capture happened to run on.
+                reason = truncation_reason(
+                    page_h, tile_height, measured=height_measured
+                )
+                if reason:
+                    logger.warning(
+                        "[w%d] %s: %s — marking the manifest incomplete",
+                        wi,
+                        art_path,
+                        reason,
+                    )
+
                 manifest = {
                     "path": art_path,
                     "url": target_url,
                     "page_height": page_h,
+                    "tile_height": tile_height,
+                    "viewport_width": VIEWPORT_WIDTH,
                     "tiles": tile_names,
-                    "complete": True,
+                    "complete": reason is None,
                 }
                 with open(tile_dir / "tiles.json", "w") as f:
                     json.dump(manifest, f)
```

**File**: `render/src/pixelrag_render/backends/page_metrics.py` (modified, +40/-4)
```diff
@@ -1,12 +1,14 @@
-"""Shared in-page measurement JS for the capture backends.
+"""Shared page measurement for the capture backends: the in-page JS, and the
+judgement about whether what it measured can be trusted.
 
 Kept in one place because both backends measure page height the same way and
 must agree: the standard (``cdp``) and turbo (``fast_cdp``) paths each embed
 this snippet, and a divergence between them silently changes how much of a page
-gets captured depending on which Chrome binary is installed.
+gets captured depending on which Chrome binary is installed. The same goes for
+what they then report in ``tiles.json``.
 
-No imports — a plain string constant, so either backend can use it without a
-dependency edge between them.
+No imports — a plain string constant and a pure function, so either backend can
+use them without a dependency edge between them.
 """
 
 # How tall is the document's *content*?
@@ -42,3 +44,37 @@
         return Math.ceil(bottom + offset);
     }
 """
+
+
+def truncation_reason(
+    page_height: int, tile_height: int, *, measured: bool
+) -> str | None:
+    """Why this capture must not be reported as complete — or ``None`` if it may.
+
+    ``tile_height`` is also the emulated viewport height (both backends pass it
+    to ``Emulation.setDeviceMetricsOverride``), which is what makes the two
+    checks below meaningful:
+
+    - The probe returned nothing usable, so the height fell back to the tile
+      height. Whatever the page actually was, one viewport of it was captured.
+    - The probe returned exactly the viewport height. Then it measured the
+      viewport rather than the content, and everything below the fold is
+      missing — the shape every truncation so far has taken (issues #124, #131,
+      #133), independent of which of them caused it.
+
+    The second check costs a false alarm on a page that happens to be exactly
+    ``tile_height`` tall. That is the right trade against the alternative,
+    which is reporting 5% of an article as the whole of it: a capture wrongly
+    flagged is re-run, a truncation never flagged is read and summarised.
+    """
+    if not measured:
+        return (
+            f"the page-height probe returned nothing, so the height fell back "
+            f"to the {tile_height}px tile height"
+        )
+    if page_height == tile_height:
+        return (
+            f"the measured page height ({page_height}px) is exactly the tile "
+            f"height, so the probe tracked the emulated viewport, not the content"
+        )
+    return None
```

---

### Incident Patch 10: `ef1bb43b` (2026-08-29)
**Commit Message**: fix(render): bound web-font readiness wait (#144)

**File**: `render/src/pixelrag_render/backends/cdp.py` (modified, +7/-1)
```diff
@@ -185,6 +185,9 @@ async def _cdp_send(ws, msg_id_ref: list, method: str, params: dict | None = Non
 # before giving up and capturing whatever is there. Keeps a hanging page from
 # stalling a worker.
 LOAD_TIMEOUT_MS = 12_000
+# Web-font loads are allowed a short grace period, but must not stall a render:
+# a server can leave a font response open indefinitely.
+FONT_TIMEOUT_MS = 2_000
 # The network is considered idle once at most NET_IDLE_MAX_INFLIGHT requests
 # have been in flight for NET_QUIET_MS (Puppeteer's "networkidle2" semantics).
 # Tolerating 2 in-flight requests is what makes this usable on arbitrary web
@@ -352,7 +355,10 @@ def _readiness_expr() -> str:
             const t = setTimeout(res, {LOAD_TIMEOUT_MS});
             window.addEventListener('load', () => {{ clearTimeout(t); res(); }}, {{ once: true }});
         }});
-        await document.fonts.ready;
+        await Promise.race([
+            document.fonts.ready,
+            new Promise(r => setTimeout(r, {FONT_TIMEOUT_MS})),
+        ]);
         // Let layout settle over two frames — but cap it: requestAnimationFrame
         // never ticks in some headless modes (e.g. google-chrome --headless=new
         // with no compositor frames scheduled), where awaiting rAF would hang.
```

**File**: `tests/test_render.py` (modified, +93/-0)
```diff
@@ -7,8 +7,15 @@
 """
 
 import json
+import os
+import signal
+import subprocess
+import sys
+import threading
+from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
 from pathlib import Path
 
+import pytest
 from pixelrag_render import render_file
 
 
@@ -63,3 +70,89 @@ def test_page_taller_than_a_viewport_bounded_body_is_fully_tiled(tmp_path):
         "content below the fold was never measured"
     )
     assert len(tiles) > 1, f"expected multiple tiles, got {[t.name for t in tiles]}"
+
+
+def test_hanging_web_font_does_not_stall_render(tmp_path):
+    """A font request that never finishes must not block the CDP renderer."""
+    release_font = threading.Event()
+
+    class Handler(BaseHTTPRequestHandler):
+        def do_GET(self):
+            if self.path == "/hanging.woff2":
+                self.send_response(200)
+                self.send_header("Content-Type", "font/woff2")
+                self.send_header("Content-Length", "1000000")
+                self.end_headers()
+                self.wfile.write(b"\0")
+                self.wfile.flush()
+                release_font.wait(timeout=60)
+                return
+
+            body = "".join(f"<p>line {i:03d}</p>" for i in range(200))
+            html = f"""<!doctype html>
+                <html><head><script>
+                window.addEventListener("load", () => {{
+                    const style = document.createElement("style");
+                    style.textContent = `@font-face {{
+                        font-family: HangingFont;
+                        src: url('/hanging.woff2') format('woff2');
+                    }} body {{ font-family: HangingFont; }}`;
+                    document.head.appendChild(style);
+                    document.fonts.load("16px HangingFont");
+                }});
+                </script></head><body>{body}</body></html>"""
+            payload = html.encode()
+            self.send_response(200)
+            self.send_header("Content-Type", "text/html; charset=utf-8")
+            self.send_header("Content-Length", str(len(payload)))
+            self.end_headers()
+            self.wfile.write(payload)
+
+        def log_message(self, _format, *_args):
+            pass
+
+    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+
+    output = tmp_path / "tiles"
+    url = f"http://127.0.0.1:{server.server_port}/"
+    script = (
+        "from pixelrag_render import render_url; import sys; "
+        "render_url(sys.argv[1], sys.argv[2], tile_height=300, "
+        "viewport_width=400, workers=1, turbo=False)"
+    )
+    proc = subprocess.Popen(
+        [sys.executable, "-c", script, url, str(output)],
+        stdout=subprocess.PIPE,
+        stderr=subprocess.PIPE,
+        text=True,
+        start_new_session=True,
+    )
+
+    try:
+        try:
+            stdout, stderr = proc.communicate(timeout=30)
+        except subprocess.TimeoutExpired:
+            os.killpg(proc.pid, signal.SIGTERM)
+            try:
+                stdout, stderr = proc.communicate(timeout=5)
+            except subprocess.TimeoutExpired:
+                os.killpg(proc.pid, signal.SIGKILL)
+                stdout, stderr = proc.communicate()
+            pytest.fail(
+                "render remained blocked by document.fonts.ready for 30 seconds\n"
+                f"stdout:\n{stdout[-2000:]}\nstderr:\n{stderr[-2000:]}"
+            )
+    finally:
+        release_font.set()
+        server.shutdown()
+        server.server_close()
+        thread.join(timeout=5)
+
+    assert proc.returncode == 0, f"stdout:\n{stdout}\nstderr:\n{stderr}"
+    manifests = list(output.rglob("tiles.json"))
+    assert len(manifests) == 1
+    manifest = json.loads(manifests[0].read_text())
+    assert manifest["page_height"] > 300
+    assert len(manifest["tiles"]) > 1
```

#### Recent Merged Pull Requests:
- **PR #162** (2026-09-27): test(serve): repair department-filter tests left stale by the backend refactor (@dex0shubham)
- **PR #161** (2026-09-27): fix(serve): bound /reconstruct and stop unknown ids becoming 500s (@dex0shubham)
- **PR #160** (2026-09-27): fix: cross-platform compatibility, config deep merge, and pipeline ro… (@smartworldarafath)
- **PR #159** (2026-09-27): feat(eval): add optional Atlas Cloud reader (@binyangzhu000-sudo)
- **PR #158** (2026-09-14): docs: link community LangChain integration (@navneet-singh2907)
- **PR #157** (2026-09-09): fix(opencode-plugin): default the tile directory inside the project (@andylizf)
- **PR #155** (2026-09-24): feat(index): add IVF+PQ compression flag for the FAISS build (@dex0shubham)
- **PR #154** (2026-09-24): fix(serve): bound query image decode and batch size to prevent OOM/DoS (@dex0shubham)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
