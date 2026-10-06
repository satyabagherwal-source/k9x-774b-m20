# Forensic Learning Record (Deep Inspection): NirDiamant/GenAI_Agents

> **Canonical Artifact**: `07_PROJECT_LEARNING/nirdiamant-genai_agents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NirDiamant/GenAI_Agents](https://github.com/NirDiamant/GenAI_Agents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:48:36.629Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NirDiamant/GenAI_Agents`
- **Description**: 50+ tutorials and implementations for Generative AI Agent techniques, from basic conversational bots to complex multi-agent systems.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 24474 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `all_agents_tutorials/scripts/mcp_server.py`
```
"""
This script demonstrates how to create a simple MCP server that fetches
the current price of a cryptocurrency using the CoinGecko API.
It uses the FastMCP library to create the server and handle requests.
"""
import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3"

# Create our MCP server with a descriptive name
mcp = FastMCP("crypto_price_tracker")

# Now let's define our first tool - getting the current price of a cryptocurrency
@mcp.tool()
async def get_crypto_price(crypto_id: str, currency: str = "usd") -> str:
    """
    Get the current price of a cryptocurrency in a specified currency.
    
    Parameters:
    - crypto_id: The ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum')
    - currency: The currency to display the price in (default: 'usd')
    
    Returns:
    - Current price information as a formatted string
    """
    # Construct the API URL
    url = f"{COINGECKO_BASE_URL}/simple/price"
    
    # Set up the query parameters
    params = {
        "ids": crypto_id,
        "vs_currencies": currency
    }
    
    try:
        # Make the API call
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()  # Raise an exception for HTTP errors
            
            # Parse the response
            data = response.json()
            
            # Check if we got data for the requested crypto
            if crypto_id not in data:
                return f"Cryptocurrency '{crypto_id}' not found. Please check the ID and try again."
            
            # Format and return the price information
            price = data[crypto_id][currency]
            return f"The current price of {crypto_id} is {price} {currency.upper()}"
            
    except httpx.HTTPStatusError as e:
        return f"API Error: {e.response.status_code} - {e.response.text}"
    except Exception as e:
        return f"Error fetching price data: {str(e)}"

# You can add more tools here, following the same pattern as above

# Run the MCP server
# This will start the server and listen for incoming requests
if __name__ == "__main__":
    mcp.run()
```

### Core Architecture Module: `data/grocery_management_agents_system/input/extract_items.js`
```
import { ocr } from 'llama-ocr';
import fs from 'fs/promises';

// Fetch the API key from the environment variable
const apiKey = process.env.LLAMA_OCR_API_KEY;

async function getMarkdownAndSave() {
  try {
    const markdown = await ocr({
      filePath: "g1.png",
      apiKey: apiKey
    });

    // Save the extracted markdown to a file
    const filePath = "../extracted/grocery_receipt.md";
    await fs.writeFile(filePath, markdown, "utf8");

    console.log(`Markdown saved to ${filePath}`);
  } catch (error) {
    console.error("Error saving markdown:", error);
  }
}

// Call the function
getMarkdownAndSave();
```

### Core Architecture Module: `scripts/validate_notebook.py`
```
#!/usr/bin/env python3
"""Validate explicitly selected tutorial notebooks before contribution."""

import argparse
import json
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Iterable, List
from urllib.parse import unquote, urlparse


REQUIRED_SECTIONS = (
    "Overview",
    "Detailed Explanation",
    "Required Packages",
    "Implementation",
    "Usage Example",
    "Comparison",
    "Additional Considerations",
    "References",
)
HEADING_RE = re.compile(r"^#{1,6}\s+(.+?)\s*$", re.MULTILINE)
IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Finding:
    code: str
    message: str


class ImageSourceParser(HTMLParser):
    """Collect image sources from notebook HTML fragments."""

    def __init__(self) -> None:
        super().__init__()
        self.sources: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple]) -> None:
        if tag.lower() != "img":
            return
        source = dict(attrs).get("src")
        if source:
            self.sources.append(source)


def source_text(cell: Dict[str, Any]) -> str:
    """Return a cell's source whether nbformat stored it as a string or list."""
    source = cell.get("source", "")
    return "".join(source) if isinstance(source, list) else str(source)


def normalize_heading(value: str) -> str:
    """Normalize display punctuation so template headings compare by words."""
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def has_valid_source(cell: Dict[str, Any]) -> bool:
    """Return whether a cell source follows the nbformat string shape."""
    source = cell.get("source", "")
    return isinstance(source, str) or (
        isinstance(source, list) and all(isinstance(part, str) for part in source)
    )


def validate_notebook(path: Path) -> List[Finding]:
    """Return all contribution-readiness findings for one notebook path."""
    try:
        notebook = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        return [Finding("NB001", f"cannot read notebook JSON: {exc}")]

    if (
        not isinstance(notebook, dict)
        or notebook.get("nbformat") != 4
        or not isinstance(notebook.get("cells"), list)
        or not all(
            isinstance(cell, dict) and has_valid_source(cell)
            for cell in notebook["cells"]
        )
    ):
        return [Finding("NB001", "expected an nbformat 4 notebook with a cells list")]

    findings: List[Finding] = []
    cells = notebook["cells"]

    for index, cell in enumerate(cells, start=1):
        if cell.get("cell_type") != "code":
            continue
        if cell.get("outputs") or cell.get("execution_count") is not None:
            findings.append(
                Finding("NB002", f"cell {index} has outputs or an execution count")
            )
        previous = cells[index - 2] if index > 1 else {}
        if (
            previous.get("cell_type") != "markdown"
            or HEADING_RE.search(source_text(previous)) is None
        ):
            findings.append(
                Finding("NB003", f"cell {index} needs a preceding markdown description")
            )

    markdown_text = "\n".join(
        source_text(cell) for cell in cells if cell.get("cell_type") == "markdown"
    )
    headings = {normalize_heading(match) for match in HEADING_RE.findall(markdown_text)}
    for section in REQUIRED_SECTIONS:
        normalized = normalize_heading(section)
        if normalized not in headings:
            findings.append(Finding("NB004", f"missing required section: {section}"))

    html_parser = ImageSourceParser()
    html_parser.feed(markdown_text)
    image_targets = [*IMAGE_RE.findall(markdown_text), *html_parser.sources]
    for target in image_targets:
        candidate = target.split(maxsplit=1)[0]
        try:
            parsed = urlparse(candidate)
        except ValueError as exc:
            findings.append(Finding("NB005", f"invalid image target: {target} ({exc})"))
            continue
        if parsed.scheme or parsed.netloc or candidate.startswith(("#", "data:")):
            continue
        resolved = (path.parent / unquote(parsed.path)).resolve()
        try:
            resolved.relative_to(REPO_ROOT.resolve())
        except ValueError:
            findings.append(
                Finding("NB005", f"local image is outside repository root: {target}")
            )
            continue
        if not resolved.is_file():
            findings.append(Finding("NB005", f"local image does not exist: {target}"))

    return findings


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check selected tutorial notebooks against CONTRIBUTING.md."
    )
    parser.add_argument("notebooks", nargs="+", type=Path)
    return parser.parse_args(argv)


def main(argv: Iterable[str] = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    failed = False
    for path in args.notebooks:
        findings = validate_notebook(path)
        if findings:
            failed = True
            print(f"FAIL {path}")
            for finding in findings:
                print(f"  {finding.code} {finding.message}")
        else:
            print(f"PASS {path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #170** (2026-09-28): **Add Read vs Write: What One AI Answer Costs (#57) + the energy film**
  *Symptoms*: Adds tutorial #57, the companion notebook to the DiamantAI film Why AI Uses So Much Energy (It's Not the Thinking) (https://www.youtube.com/watch?v=w6FgmAtt7oo&list=PLBrpE2PttR2k), and features the film in the README with tracked playlist links.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/170"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `6160abbb-d1bf-4379-b888-b16c10fca252` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from the base of the PR a
  > <h3>PR Summary by Qodo</h3>  Add tutorial #57 on AI inference time and energy costs  <code>✨ Enhancement</code> <code>📝 Documentation</code> <code>🕐 40+ Minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Add a local notebook measuring prompt reading, answer generation, KV-cache growth, batching, and >  optional energy use. >• Add a diagram explaining the measurement workflow. >• Feature the companion energy film and link tutorial #57 throughout the README. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   Story["Story text"] --> Prefill["Prompt prefill"] --> Cache[("KV cache")] --> Decode["Token decode"] --> Results["Cost results"]   Batch["Batch questions"] --> Decode   Meter["Power sensor"] --> Results   Prefill --> Results ```  </dd> </dl>  </details>     <details> <summary
  > <h3>Code Review by Qodo</h3>  <code>🐞 Bugs (3)</code>  <code>📘 Rule violations (0)</code>  <code>📜 Skill insights (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <br/>  <img src="https://img.shields.io/badge/High-634FD1?style=flat-square" height="20px" alt="Action required">  <details> <summary>  1.  Long-chat costs measure changing depths <code>🐞 Bug</code> <code>≡ Correctness</code></summary>  <br/>  > <details open> ><summary>Description</summary> ><br/> > ><pre> ><b><i>write_at_depths</i></b> reuses a mutable KV cache for its warm-up and every timed repeat, so the repeats >run at progressively longer depths than the length recorded for the row. With the default settings, >those probes also advance <b><i>fed</i></b> by 100 tokens before the next book slice, replacing part of the >intended story prefix with generated tokens. ></pre> ></details>  > <details> ><summary>Code</summary> ><br/> > ><code>[all_ag

- **Issue #169** (2026-09-27): **Add Tenuo to Governance & Safety Resources**
  *Symptoms*: ## What this adds  One row in the Governance & Safety Resources table for [Tenuo](https://github.com/tenuo-ai/tenuo). The intro line changes from "tool helps" to "tools help" now that there are two entries.  ## Why it fits  AgentContract covers what an agent must and must not do. Tenuo covers a narrower question: which tools an agent may call, with which arguments, and for how long. Grants are signed warrants that can only narrow when a supervisor delegates to a worker, and they are checked before the tool runs. There are adapters for LangGraph, CrewAI, OpenAI Agents SDK, Google ADK, AutoGen, and MCP.  ## Scope  README only: 1 table row and 1 word change in the intro.  Disclosure: I work on Tenuo (Apache-2.0). Happy to change the wording or placement.   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Updated the Governance & Safety Resources section to cover multiple open-source tools. It now includes Tenuo, with information about task-scoped authorization, signed warrants, delegation limits, supported integrations, and related links. The existing AgentContract entry remains.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/169"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `e68057c8-73ae-4818-b4fa-06e6ae14ad8d`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 078d6d544e15c0e758c2533b422fd13ed2d15593 and b0e6a5cb7287cbffc
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can describe a rule in plain language on the Rules page and Qodo drafts it for you</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img src="htt
  > <h3>PR Summary by Qodo</h3>  Add Tenuo to Governance &amp; Safety Resources  <code>📝 Documentation</code> <code>🕐 Less than 10 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Add Tenuo as a task-scoped agent authorization resource, with website, GitHub, and PyPI links. >• Pluralize the section introduction to reflect its two listed tools. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   README["README.md"] --> Table["Governance table"] --> Tenuo["Tenuo entry"] --> Links{{"Tenuo links"}}   Table --> AgentContract["AgentContract entry"] ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >Adding a row to the existing governance table is the most direct approach. A separate section would duplicate the table&#x27;s purpose for

- **Issue #168** (2026-09-27): **Add evidence-grounded social research agent tutorial**
  *Symptoms*: ## Summary  - add a self-contained, standard-library notebook for evidence-grounded social research - separate code-owned typed decisions, read-only adapters, validation, evidence state, and report rendering - demonstrate complete, partial, empty, and blocked outcomes with a clearly synthetic four-record fixture - add an accessible architecture SVG and index the tutorial in both README catalogue views - document an optional immutable Jev Social v0.1.9 path for real Instagram, TikTok, and LinkedIn evidence  ## Why this is a separate tutorial  The existing One-Step Decision Router tutorial focuses on classification, calibration, temperature scaling, and confidence gates. This tutorial starts after that boundary: it shows how a typed decision is connected to untrusted browser results without letting discovery cards, access barriers, or raw payloads silently become report evidence.  The program owns every action choice and enforces record limits, platform and URL policy, byte bounds, canonical-source deduplication, an evidence floor, and complete/partial/blocked terminal states. The renderer receives only accepted evidence.  ## Validation  - `python scripts/validate_notebook.py all_agents_tutorials/evidence_grounded_social_research_agent.ipynb` — pass - all eight code cells executed top-to-bottom — complete four-source report plus blocked and partial branches pass their assertions - `python -m unittest discover -s tests -v` — 40 passed, 2 skipped because the notebook-pinned optio
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/168"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `bef6414c-9a26-45d1-ad6c-89314f3062c9`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 6603916ffc7ac898c8c8e2c44bec87e39b318559 and 3548d44cac5bd6de2
  > <h3>PR Summary by Qodo</h3>  Add evidence-grounded social research agent tutorial  <code>✨ Enhancement</code> <code>📝 Documentation</code> <code>🕐 40+ Minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds an offline tutorial separating typed decisions, read-only discovery, validated evidence, and >  reporting. >• Demonstrates complete, partial, empty, and blocked outcomes with synthetic social records. >• Documents pinned Jev Social usage and indexes the tutorial with accessible architecture. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   G["Research Goal"] --> D["Typed Decision"] --> A["Action Space"] --> S["Social Adapter"] --> V{"Evidence Valid?"}   V -->|Accepted| L["Evidence Ledger"] --> R["Source Report"]   V -->|Rejected or blocked| T["Blocked / Partial"]   D -->|L
  > <h3>Code Review by Qodo</h3>  <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📜 Skill insights (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <br/>  <img src="https://img.shields.io/badge/Medium-634FD1?style=flat-square" height="20px" alt="Remediation recommended">  <details> <summary>  1.  <s>Invalid decisions crash the research loop</s> <code>✓ Resolved</code> <code>🐞 Bug</code> <code>☼ Reliability</code></summary>  <br/>  > <details open> ><summary>Description</summary> ><br/> > ><pre> ><b><i>validate_decision</i></b> accesses <b><i>decision.choice</i></b> and compares <b><i>decision.confidence</i></b> without first >validating that the provider returned a <b><i>Decision</i></b> with a numeric confidence. A provider returning ><b><i>None</i></b>, a different object, or a non-numeric confidence raises <b><i>AttributeError</i></b> or <b><i>TypeError</i></b> at >route or action selection

- **Issue #167** (2026-09-24): **Add One-Step Decision Router tutorial (#56) + the Jev film**
  *Symptoms*: Adds tutorial #56, **One-Step Decision Router**: route messages by reading an open LLM's decision in one forward pass, then check whether its confidence can be trusted (reliability table, ECE, temperature scaling, confidence gate). Runs on Qwen3 via Transformers, no API key.  Companion to the new DiamantAI film **The AI That Knows the Answer Before It Speaks [Jev Explained]** (https://www.youtube.com/watch?v=Fo2kisJx92Y&list=PLBrpE2PttR2k), now featured at the top of the README; the while-loop film moves into the video row.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/167"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `019a3f67-b57e-4539-b899-aa348a8bd72a` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from the base of the PR a
  > <h3>PR Summary by Qodo</h3>  Add one-step LLM decision routing and calibration tutorial  <code>✨ Enhancement</code> <code>📝 Documentation</code> <code>🕐 40+ Minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds an open-model router using first-token probabilities from one forward pass. >• Demonstrates calibration, temperature scaling, and confidence-gated human escalation on banking77. >• Features the companion Jev film and tutorial throughout the README. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   D["Banking77 Data"] --> C["Temperature Scaling"] --> G{"Confidence Gate"}   M["Customer Message"] --> R["Qwen3 Router"] --> G   G -->|Above threshold| A["Automatic Route"]   G -->|Below threshold| H["Human Review"] ```  </dd> </dl>  </details>     <details> <summary>High-Lev
  > <h3>Code Review by Qodo</h3>  <code>🐞 Bugs (3)</code>  <code>📘 Rule violations (0)</code>  <code>📜 Skill insights (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <br/>  <img src="https://img.shields.io/badge/High-634FD1?style=flat-square" height="20px" alt="Action required">  <details> <summary>  1.  The tutorial stops before routing <code>🐞 Bug</code> <code>≡ Correctness</code></summary>  <br/>  > <details open> ><summary>Description</summary> ><br/> > ><pre> ><b><i>MAP[&quot;payments&quot;]</i></b> misspells <b><i>reverted_card_payment</i></b> and <b><i>refund_not_showing_up</i></b>, and the mapping >omits the Banking77 <b><i>cash_withdrawal</i></b> category. When the deterministic sample contains those labels, >exact-string mapping produces null teams and the following assertion stops execution before the >model loads. ></pre> ></details>  > <details> ><summary>Code</summary> ><br/> > ><code>[all_agents_

- **Issue #157** (2026-09-08): **Index the while-loop tutorial (it was in the repo but in no list)**
  *Symptoms*: ## What  `all_agents_tutorials/agent_while_loop_from_scratch.ipynb` has been in the repo since the film shipped, but it was reachable **only** from the "🎬 Prefer video?" caption at the very top. It had no row in the numbered table and no entry in the categorised sections — so a reader browsing tutorials never saw it.  The table also stopped at **54** while the header already claimed **"55 tutorials"**. This closes that gap.  - Row **#55** (🌱 Beginner) in the index table - Detail entry in the Beginner-Friendly section, matching the existing Overview / Implementation / Additional Resources format - The video sits under **Additional Resources**, routed through the shared `rag-techniques-tracker` with a playlist-context target (`&list=`), consistent with the other tracked CTAs. Redirect verified: `302 → https://www.youtube.com/watch?v=FN1n_NVD9KM&list=PLBrpE2PttR2k`  ## Why this placement  Click-tracker data (Firestore `clicks_by_link`, normalised to clicks/day): for the same video on the same page, the **per-tutorial entry earns ~1.9× the hero tile** and ~5× a link buried in the notebook. The hero tile at the top of this README is already doing well — 4.39 clicks/day — but a reader who scrolls to the tutorial list currently finds nothing.  ## Scope  Purely additive — **12 insertions, 0 deletions**. No book, course, newsletter or sponsor block is touched, and no existing row, link or CTA is moved or reworded.  ## Not included  Two other notebooks are also missing from the index
  **Post-Mortem & Fix Analysis**:
  > <h3>PR Summary by Qodo</h3>  Index the while-loop agent tutorial in the README  <code>📝 Documentation</code> <code>🕐 Less than 5 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Add the while-loop tutorial as entry 55 in the main index. >• Document it in Beginner-Friendly Agents with overview and implementation guidance. >• Link its playlist-context video through the shared click tracker. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   Reader["Tutorial Reader"] --> README["Main README"] --> Index["Tutorial Index"] --> Notebook["While Loop Notebook"]   README --> Beginner["Beginner Section"] --> Notebook   Beginner --> Tracker["Click Tracker"] --> Video["YouTube Playlist"] ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/> 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/157#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/157#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  README.md adds tutorial 55, “Agent From Scratch: The While Loop,” with a table entry, implementation details, retry behavior, rule placement examples, and a YouTube link.  ### Changes  **While Loop Tutorial**  |Layer / File(s)|Summary| |---|---| |**Add tu
  > <h3>Code Review by Qodo</h3>  <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📜 Skill insights (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <br/>  <img src="https://img.shields.io/badge/Low-634FD1?style=flat-square" height="20px" alt="Informational">  <details> <summary>  1.  <s>Readers see the tutorial index jump from 3 to 55</s> <code>✓ Resolved</code> <code>🐞 Bug</code> <code>⚙ Maintainability</code></summary>  <br/>  > <details open> ><summary>Description</summary> ><br/> > ><pre> >The new tutorial is numbered <b><i>55</i></b> while it is inserted immediately after Beginner-Friendly entries >1–3 and before Framework Tutorial entry 4. Readers browsing the categorized sections therefore >encounter the final tutorial number before most of tutorials 4–54, making the index order confusing >and harder to use. ></pre> ></details>  > <details> ><summary>Code</summary> ><br/> > ><code>[READ

- **Issue #151** (2026-10-01): **Bump the minor-and-patch group across 1 directory with 52 updates**
  *Symptoms*: Bumps the minor-and-patch group with 52 updates in the / directory:  | Package | From | To | | --- | --- | --- | | [aiohappyeyeballs](https://github.com/aio-libs/aiohappyeyeballs) | `2.4.0` | `2.7.1` | | [aiosignal](https://github.com/aio-libs/aiosignal) | `1.3.1` | `1.4.0` | | [annotated-types](https://github.com/annotated-types/annotated-types) | `0.7.0` | `0.8.0` | | [anyio](https://github.com/agronholm/anyio) | `4.4.0` | `4.14.2` | | [charset-normalizer](https://github.com/jawah/charset_normalizer) | `3.3.2` | `3.5.1` | | [click](https://github.com/pallets/click) | `8.1.7` | `8.5.0` | | [comm](https://github.com/ipython/comm) | `0.2.2` | `0.2.3` | | [debugpy](https://github.com/microsoft/debugpy) | `1.8.5` | `1.8.21` | | [decorator](https://github.com/micheles/decorator) | `5.1.1` | `5.3.1` | | [executing](https://github.com/alexmojaki/executing) | `2.1.0` | `2.2.1` | | [frozenlist](https://github.com/aio-libs/frozenlist) | `1.4.1` | `1.8.0` | | [greenlet](https://github.com/python-greenlet/greenlet) | `3.0.3` | `3.5.5` | | [h11](https://github.com/python-hyper/h11) | `0.14.0` | `0.16.0` | | [httpcore](https://github.com/encode/httpcore) | `1.0.5` | `1.0.9` | | [httpx](https://github.com/encode/httpx) | `0.27.2` | `0.28.1` | | [idna](https://github.com/kjd/idna) | `3.8` | `3.19` | | [jedi](https://github.com/davidhalter/jedi) | `0.19.1` | `0.20.0` | | [jiter](https://github.com/pydantic/jiter) | `0.5.0` | `0.16.0` | | [joblib](https://github.com/joblib/joblib) | `1.4.2` |
  **Post-Mortem & Fix Analysis**:
  > Looks like these dependencies are updatable in another way, so this is no longer needed.

- **Issue #148** (2026-08-31): **README: feature the while-loop agents video + companion notebook**
  *Symptoms*: Adds the new video as the lead tile of the YouTube rail (tracker link carrying the `&list=` playlist context) and links the companion notebook merged in #147.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <h3>PR Summary by Qodo</h3>  Feature while-loop agents video and companion notebook  <code>📝 Documentation</code> <code>🕐 Less than 5 minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Features the while-loop agents video as the YouTube rail’s lead tile. >• Preserves playlist context through the existing tracked YouTube link. >• Links viewers directly to the companion agent notebook. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   README["README video rail"] --> Tile["Lead video tile"] --> Tracker["Views tracker"] --> YouTube["YouTube playlist"]   Tile --> Notebook["Companion notebook"] ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> <dd>  <br/>  >The direct README feature tile is appropriate because it follows the existing video rai
  >  <h3>Code Review by Qodo</h3> <code>🐞 Bugs (0)</code>  <code>📘 Rule violations (0)</code>  <code>📎 Requirement gaps (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <img src="https://www.qodo.ai/wp-content/uploads/2025/06/qodo-anteater.svg" width="20%">  <h3>Great, no issues found!</h3> Qodo reviewed your code and found no material issues that require review  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">    <!-- qodo-daily-tip:start -->  <details> <summary><strong>Tip of the day</strong></summary>  <br/>  <pre>💡 Did you know, you can type &#x27;qodo, fix this&#x27; on a finding and the fix lands right on your PR</pre>  <a href="https://docs.qodo.ai/tips-and-tricks">More tips ↗</a> | <a href="https://app.qodo.ai/configurations?tab=display-preferences">Customize Qodo ↗</a> | <a href="https://docs.qodo.ai">Qodo docs ↗</a>  </details>  <img src="ht

- **Issue #147** (2026-08-31): **Tutorial: AI agents are just while loops — the smallest real agent, the spiral, and where a rule has to live**
  *Symptoms*: Companion notebook to the upcoming DiamantAI video **"AI Agents Are Just While Loops. That's the Scary Part."**  `all_agents_tutorials/agent_while_loop_from_scratch.ipynb` — fully self-contained and runnable with a standard `ANTHROPIC_API_KEY`:  1. The smallest working agent: one model, three tools, one `while` loop (~80 lines) 2. A real run — watch the transcript grow, then freeze it and read the agent's entire "mind" 3. **The trap**: invoice reads fail with *temporarily unavailable, try again* → the agent spirals, re-trying a dead call at full price per lap (real run transcripts included) 4. Fix #1 — the never-repeat rule in the **system prompt**: read, then ignored 5. Fix #2 — the same sentence **in the loop as code**: blocked once, recovered next turn  The one idea, demonstrated rather than asserted: *a rule in the prompt is advice; a rule in the loop is physics.*  Merges at video publish (the film's repo link points here).  🤖 Generated with [Claude Code](https://claude.com/claude-code)  <!-- This is an auto-generated comment: release notes by coderabbit.ai --> ## Summary by CodeRabbit  * **New Features**   * Added a hands-on tutorial demonstrating how to build a minimal AI agent with a while loop.   * Includes file listing, file reading, and command execution tools.   * Demonstrates handling transient failures and preventing repeated failed tool calls.   * Provides runnable examples, explanations, and expected outputs using sample invoice files.   * Updated the introduc
  **Post-Mortem & Fix Analysis**:
  > <h3>PR Summary by Qodo</h3>  Add minimal agent-loop and retry-guard tutorial  <code>✨ Enhancement</code> <code>📝 Documentation</code> <code>🕐 10-20 Minutes</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <details> <summary>AI Description</summary>  <dl> <dd> <br/>  ><pre> >• Adds a self-contained notebook building a minimal Anthropic tool-calling agent loop. >• Demonstrates retry spirals caused by transient tool failures and transcript accumulation. >• Contrasts prompt guidance with code-enforced repeat blocking and turn caps. ></pre>  </dd> </dl>  </details>  <details> <summary>Diagram</summary>  <dl> <dd>  <br/>  ```mermaid graph TD   Q["User Question"] --> L["Agent Loop"] --> M["Claude API"] --> D{"Tool Calls?"}   D -->|Yes| G["Retry Guard"] --> T["Tool Dispatcher"] --> X["Transcript"] --> L   D -->|No| A["Final Answer"] ```  </dd> </dl>  </details>     <details> <summary>High-Level Assessment</summary>  <dl> 
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/GenAI_Agents/pull/147)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `4f839985-a265-4ca9-b1e0-2462ceb5638c`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between f6ff9c8e8c39369e180081aca01ecd1c724fdfc1 and f458b29bd574de93f603f34ee37ef18610982ae2.
  > <h3>Code Review by Qodo</h3>  <code>🐞 Bugs (3)</code>  <code>📘 Rule violations (0)</code>  <code>📜 Skill insights (0)</code>  <img src="https://www.qodo.ai/wp-content/uploads/2025/11/light-grey-line.svg" height="10%" alt="Grey Divider">  <br/>  <img src="https://img.shields.io/badge/High-634FD1?style=flat-square" height="20px" alt="Action required">  <details> <summary>  1.  Model gets unrestricted shell <code>🐞 Bug</code> <code>⛨ Security</code></summary>  <br/>  > <details open> ><summary>Description</summary> ><br/> > ><pre> ><b><i>run_tool</i></b> passes the model-generated command directly to <b><i>subprocess.run(..., shell=True)</i></b>, >allowing an unpredictable model response to read secrets, modify files, or execute destructive >commands with the notebook process&#x27;s permissions. The timeout does not constrain command >capabilities, and the tool is wired directly into every agent turn without validation or >confirmation. ></pre> ></details>  > <details> ><summary>Code<

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

### Incident Patch 1: `cd2ee862` (2026-09-08)
**Commit Message**: Index the while-loop tutorial (it was in the repo but in no list) (#157)

* docs(readme): index the while-loop tutorial — it was in the repo but in no list

agent_while_loop_from_scratch.ipynb has been in all_agents_tutorials since the film shipped, but it
was reachable only from the "Prefer video?" caption at the top: it had no row in the numbered table
and no entry in the categorised sections. The table stopped at 54 while the header already claimed
"55 tutorials" — this closes that gap.

Adds the row (#55, Beginner) and the detail entry, following the existing format, with the video
under "Additional Resources" routed through the shared tracker with a playlist-context target.

Purely additive: 12 insertions, 0 deletions, and nothing in the book, course or newsletter blocks is
touched.

* fix(readme): put the detail entry last, so the categorised index still reads in order

Review caught a real one: entry 55 sat directly after Beginner entries 1-3 and before Framework
entry 4, so a reader browsing the sections saw 3 -> 55 -> 4.

The repo's actual convention is that the detail entries ascend GLOBALLY and a new one is appended to
the last section, while the TABLE row carries the tr

**File**: `README.md` (modified, +12/-0)
```diff
@@ -225,6 +225,7 @@ Below is a comprehensive overview of our GenAI agent implementations, organized
 | 52 | 🎨 **Creative**   | [Social Media Publishing Agent](all_agents_tutorials/social_media_publishing_agent_publora_langgraph.ipynb) | LangGraph  | Per-platform generation, self-review loop, publishing via Publora API        |
 | 53 | 🔍 **QA**         | [Human-in-the-Loop Approval Agent](all_agents_tutorials/human_in_the_loop_approval_agent.ipynb) | LangGraph | Risk-based approval, in-process checkpoints, auditable tool execution        |
 | 54 | 🔍 **QA**         | [Trace-Based Agent Evaluation](all_agents_tutorials/trace_based_agent_evaluation.ipynb) | Python | Deterministic trace scoring, case diagnostics, regression quality gates     |
+| 55 | 🌱 **Beginner**   | [Agent From Scratch: The While Loop](all_agents_tutorials/agent_while_loop_from_scratch.ipynb) | Pure Python | The minimal agent loop, tool calls, the retry trap, where a rule must live   |
 
 Explore our extensive list of GenAI agent implementations, sorted by categories:
 
@@ -764,6 +765,17 @@ Explore our extensive list of GenAI agent implementations, sorted by categories:
     #### Trace-Based Evaluation Implementation 🛠️
     Defines framework-neutral trace and test-case contracts, explicit weighted checks, suite metrics, and a CI-friendly quality gate. A deterministic baseline demonstrates routing and argument regressions, while an improved agent passes the same frozen cases and thresholds.
 
+55. **[Agent From Scratch: The While Loop](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/agent_while_loop_from_scratch.ipynb)**
+
+   #### Overview 🔎
+   The smallest real agent — one model, three tools, and a single `while` loop — built with no framework at all, then pushed until it breaks. Shows what every agent framework is wrapping, why the transcript *is* the agent's entire memory, and the retry trap a failing tool builds for itself.
+
+   #### Implementation 🛠️
+   Pure Python against a chat-completions API: three small tools the loop promises to execute, a conversation re-sent in full on every turn, and a frozen run where each file read returns "temporarily unavailable". The same one-sentence fix is then placed twice — once in the system prompt, once inside the loop — to show why only one of the two placements actually holds.
+
+    #### Additional Resources 📚
+    - **[YouTube Explanation](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=youtube-while-loop-table&target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DFN1n_NVD9KM%26list%3DPLBrpE2PttR2k&retarget=0&text=youtube-while-loop-table)**
+
 ### 🌟 Special Advanced Technique 🌟
 
 45. **[Sophisticated Controllable Agent for Complex RAG Tasks 🤖](https://github.com/NirDiamant/Controllable-RAG-Agent)**
```

---

### Incident Patch 2: `b7b329f2` (2026-08-31)
**Commit Message**: README: feature the while-loop agents video + companion notebook (#148)

Playlist-context deep link via the views tracker; notebook link inline.

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +8/-0)
```diff
@@ -67,6 +67,14 @@ One `npm install` adds the module's AI assistant to your Claude Code, and it gui
 
 *I break these ideas down into short, one-idea-per-episode explainers on YouTube.*
 
+<p align="center">
+  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&amp;click=youtube-readme-loop&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DFN1n_NVD9KM%26list%3DPLBrpE2PttR2k&amp;retarget=0&amp;text=youtube-readme-loop">
+    <img src="https://img.youtube.com/vi/FN1n_NVD9KM/maxresdefault.jpg" width="60%" alt="">
+    <br><b>🆕 AI Agents Are Just While Loops. That's the Scary Part.</b>
+  </a><br>
+  <sub>the smallest real agent, the trap it builds for itself, and where a rule has to live — <a href="all_agents_tutorials/agent_while_loop_from_scratch.ipynb">run the agent from the video</a></sub>
+</p>
+
 <table>
 <tr>
 <td width="33%" align="center" valign="top">
```

---

### Incident Patch 3: `281018a8` (2026-08-31)
**Commit Message**: Tutorial: AI agents are just while loops — the smallest real agent, the spiral, and where a rule has to live (#147)

* Add tutorial: the smallest real agent — a while loop, the spiral trap, and where a rule has to live

Companion notebook to the DiamantAI video 'AI Agents Are Just While Loops.
That's the Scary Part.' Builds a working agent in ~80 lines (one model, three
tools, one loop), springs a polite-failure trap to show the transcript
poisoning itself, then contrasts the never-repeat rule written as prompt
advice (ignored) vs enforced in the loop (recovers next turn).

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

* Link the notebook to the published video (playlist deep link)

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `all_agents_tutorials/agent_while_loop_from_scratch.ipynb` (added, +322/-0)
```diff
@@ -0,0 +1,322 @@
+{
+ "cells": [
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "# AI Agents Are Just While Loops (That's the Scary Part)\n",
+    "\n",
+    "**The smallest real AI agent \u2014 one model, three tools, one `while` loop \u2014 plus the trap it builds for itself, and the one-sentence fix that only works when you write it in the right place.**\n",
+    "\n",
+    "This is the companion notebook to the [DiamantAI](https://www.youtube.com/@DiamantAI) video **[AI Agents Are Just While Loops. That's the Scary Part.](https://www.youtube.com/watch?v=FN1n_NVD9KM&list=PLBrpE2PttR2k)** Everything the film shows \u2014 the invoice run, the spiral, the rule that gets ignored in the prompt and obeyed in the loop \u2014 runs live here, in about 80 lines of Python.\n",
+    "\n",
+    "## The one idea\n",
+    "\n",
+    "An AI agent is **a text file with an engine attached**. The model remembers nothing between turns; the loop re-sends the whole conversation every time, so *the transcript is the agent's entire mind* \u2014 and a mind that trusts whatever is written in it can fill up with its own mistakes. That has one practical consequence, and you'll watch it happen below: **a rule written into the prompt is advice; a rule written into the loop is physics.**\n",
+    "\n",
+    "## Overview\n",
+    "\n",
+    "1. Build the smallest working agent: one model, three tools, a `while` loop\n",
+    "2. Run it on a real question and watch the transcript grow\n",
+    "3. **Spring the trap** \u2014 make a tool fail politely and watch the agent spiral\n",
+    "4. Fix attempt #1: the rule in the **system prompt** (spoiler: ignored)\n",
+    "5. Fix attempt #2: the same rule **in the loop as code** (recovers on the next turn)\n",
+    "\n",
+    "**Requirements:** `pip install anthropic`, and an `ANTHROPIC_API_KEY` in your environment. Each full run costs a few cents.\n"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## 1. Setup \u2014 a folder of invoices for the agent to work on\n",
+    "\n",
+    "The agent needs a real job. We'll give it the same one from the film: three invoices in a folder, and one question \u2014 *which of these is overdue, and by how much?*\n"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "import os, json, subprocess\n",
+    "from pathlib import Path\n",
+    "\n",
+    "os.environ.setdefault(\"AGENT_TODAY\", \"2026-08-30\")   # the \"today\" the agent reasons against\n",
+    "\n",
+    "Path(\"invoices\").mkdir(exist_ok=True)\n",
+    "Path(\"invoices/invoice-august.txt\").write_text(\n",
+    "    \"INVOICE 2026-041\\nClient: Meridian Systems\\nAmount due: $4,200\\nDue date: 2026-08-19\\nStatus: unpaid\\n\")\n",
+    "Path(\"invoices/invoice-september.txt\").write_text(\n",
+    "    \"INVOICE 2026-052\\nClient: Meridian Systems\\nAmount due: $1,850\\nDue date: 2026-09-15\\nStatus: unpaid\\n\")\n",
+    "Path(\"invoices/invoice-october.txt\").write_text(\n",
+    "    \"INVOICE 2026-063\\nClient: Northwind Ltd\\nAmount due: $980\\nDue date: 2026-10-02\\nStatus: unpaid\\n\")\n",
+    "print(sorted(os.listdir(\"invoices\")))\n"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## 2. Three tiny tools\n",
+    "\n",
+    "The model only ever writes text. The trick that turns writing into doing is a promise **your code** makes: whatever the model asks for in a structured format (a *tool call*), your program will actually run \u2014 and paste the result back into the conversation.\n",
+    "\n",
+    "Note the two knobs on `run_tool`: `FLAKY` (the trap we'll spring in section 4) and the `failed_calls` guard (the fix we'll enable in section 6). Both are off for now.\n"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "TOOLS = [\n",
+    "    {\"name\": \"list_files\", \"description\": \"List the files in a folder.\",\n",
+    "     \"input_schema\": {\"type\": \"object\", \"properties\": {\"path\": {\"type\": \"string\"}}, \"required\": [\"path\"]}},\n",
+    "    {\"name\": \"read_file\", \"description\": \"Read a text file and return its contents.\",\n",
+    "     \"input_schema\": {\"type\": \"object\", \"properties\": {\"path\": {\"type\": \"string\"}}, \"required\": [\"path\"]}},\n",
+    "    {\"name\": \"run_command\", \"description\": \"Run a shell command and return stdout+stderr.\",\n",
+    "     \"input_schema\": {\"type\": \"object\", \"properties\": {\"command\": {\"type\": \"string\"}}, \"required\": [\"command\"]}},\n",
+    "]\n",
+    "\n",
+    "FLAKY = False          # section 4 flips this: invoice reads start failing politely\n",
+    "GUARD = False          # section 6 flips this: the never-repeat rule, enforced by the LOOP\n",
+    "failed_calls = set()   # every (tool, args) pair that has already
```

---

### Incident Patch 4: `93d85277` (2026-08-28)
**Commit Message**: Add trace-based agent evaluation tutorial (#135)

* feat: add trace-based agent evaluation tutorial

* fix: harden trace evaluation failure handling

* docs: disambiguate trace evaluation headings

* fix: preserve exception latency in trace metrics

---------

Co-authored-by: Nir Diamant <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +10/-1)
```diff
@@ -41,7 +41,7 @@ One `npm install` adds the module's AI assistant to your Claude Code, and it gui
 
 </div>
 
-> **Recently added:** Human-in-the-Loop Approval Agent, Document Intake Agent, HR AI Assistant, Art Tourguide with LightRAG, Contextual Quoting System | **54 tutorials** and growing
+> **Recently added:** Trace-Based Agent Evaluation, Human-in-the-Loop Approval Agent, Document Intake Agent, HR AI Assistant, Art Tourguide with LightRAG | **55 tutorials** and growing
 
 ## 📫 Stay Updated!
 
@@ -212,6 +212,7 @@ Below is a comprehensive overview of our GenAI agent implementations, organized
 | 51 | 📊 **Analysis**   | [Document Intake Agent](all_agents_tutorials/document_intake_agent_langgraph.ipynb) | LangGraph  | Office docs to LLM-ready markdown, conversion as a tool call                 |
 | 52 | 🎨 **Creative**   | [Social Media Publishing Agent](all_agents_tutorials/social_media_publishing_agent_publora_langgraph.ipynb) | LangGraph  | Per-platform generation, self-review loop, publishing via Publora API        |
 | 53 | 🔍 **QA**         | [Human-in-the-Loop Approval Agent](all_agents_tutorials/human_in_the_loop_approval_agent.ipynb) | LangGraph | Risk-based approval, in-process checkpoints, auditable tool execution        |
+| 54 | 🔍 **QA**         | [Trace-Based Agent Evaluation](all_agents_tutorials/trace_based_agent_evaluation.ipynb) | Python | Deterministic trace scoring, case diagnostics, regression quality gates     |
 
 Explore our extensive list of GenAI agent implementations, sorted by categories:
 
@@ -743,6 +744,14 @@ Explore our extensive list of GenAI agent implementations, sorted by categories:
     #### Implementation 🛠️
     Combines deterministic risk and argument policies with LangGraph interrupts and a notebook-local LangGraph 0.2.76 dependency. Its `InMemorySaver` supports resume only during the Python process lifetime; production restart recovery requires a persistent checkpointer. The tutorial verifies that paused and rejected actions never execute and that reviewer-edited arguments are revalidated.
 
+54. **[Trace-Based Agent Evaluation without an LLM Judge](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/trace_based_agent_evaluation.ipynb)**
+
+    #### Trace-Based Evaluation Overview 🔎
+    An offline evaluation harness that scores what an agent actually did: tool choice, arguments, evidence use, errors, and latency. It produces reproducible case diagnostics without paying for or calibrating a second model as judge.
+
+    #### Trace-Based Evaluation Implementation 🛠️
+    Defines framework-neutral trace and test-case contracts, explicit weighted checks, suite metrics, and a CI-friendly quality gate. A deterministic baseline demonstrates routing and argument regressions, while an improved agent passes the same frozen cases and thresholds.
+
 ### 🌟 Special Advanced Technique 🌟
 
 45. **[Sophisticated Controllable Agent for Complex RAG Tasks 🤖](https://github.com/NirDiamant/Controllable-RAG-Agent)**
```

**File**: `all_agents_tutorials/trace_based_agent_evaluation.ipynb` (added, +460/-0)
```diff
@@ -0,0 +1,460 @@
+{
+ "cells": [
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "# Trace-Based Agent Evaluation without an LLM Judge\n",
+    "\n",
+    "## Overview\n",
+    "\n",
+    "A final answer can look plausible even when an agent called the wrong tool, sent the wrong arguments, ignored its evidence, or exceeded a latency budget. This tutorial evaluates the *execution trace* instead of asking another language model for a subjective score. It produces reproducible per-case diagnostics and a suite-level quality gate suitable for local regression tests or CI.\n",
+    "\n",
+    "Everything runs offline with the Python standard library. The two agents are deterministic fixtures: one contains realistic routing mistakes, while the improved version demonstrates the same cases after the defects are corrected."
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## Detailed Explanation\n",
+    "\n",
+    "### What a trace tells us\n",
+    "\n",
+    "A useful trace records ordered tool calls, structured evidence, structured claims, a canonical rendered answer, latency, and any execution error. A test case declares the complete tool contract and evidence. The adapter renders the final answer from claims, removing independently generated prose as a second source of truth.\n",
+    "\n",
+    "### Agent Architecture\n",
+    "\n",
+    "![Trace-Based Agent Evaluation](../images/trace-based-agent-evaluation.svg)\n",
+    "\n",
+    "The evaluator is deliberately outside the agent. It consumes a trace through a small data contract, so the same scorer can compare a LangGraph workflow, a custom loop, or a hosted agent as long as each adapter emits the required fields."
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## Required Packages\n",
+    "\n",
+    "### No installation required\n",
+    "\n",
+    "The implementation uses `dataclasses`, `statistics`, and other Python standard-library modules."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "from dataclasses import dataclass\n",
+    "from math import ceil\n",
+    "from time import perf_counter\n",
+    "from typing import Any, Callable, Dict, List, Optional"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## Implementation\n",
+    "\n",
+    "### Define evaluation cases and trace contracts\n",
+    "\n",
+    "Each case specifies only behavior that can be checked deterministically. `expected_calls` describes the complete allowed call sequence, while `expected_evidence` is compared with structured tool evidence and structured claims. The adapter derives a canonical answer from those claims so contradictory prose cannot receive credit."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "@dataclass(frozen=True)\n",
+    "class EvalCase:\n",
+    "    \"\"\"Frozen tool-sequence, evidence, and latency expectations for one prompt.\"\"\"\n",
+    "    case_id: str\n",
+    "    prompt: str\n",
+    "    expected_calls: List[Dict[str, Any]]\n",
+    "    expected_evidence: Dict[str, Any]\n",
+    "    max_latency_ms: int\n",
+    "\n",
+    "\n",
+    "@dataclass(frozen=True)\n",
+    "class AgentTrace:\n",
+    "    \"\"\"Framework-neutral record of one agent execution.\"\"\"\n",
+    "    answer: str\n",
+    "    tool_calls: List[Dict[str, Any]]\n",
+    "    evidence: Dict[str, Any]\n",
+    "    claims: Dict[str, Any]\n",
+    "    latency_ms: int\n",
+    "    error: Optional[str] = None\n",
+    "\n",
+    "\n",
+    "@dataclass(frozen=True)\n",
+    "class TraceScore:\n",
+    "    \"\"\"Deterministic check results and weighted total for one case.\"\"\"\n",
+    "    case_id: str\n",
+    "    total: float\n",
+    "    checks: Dict[str, bool]\n",
+    "    failed_checks: List[str]"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "### Build a small regression dataset\n",
+    "\n",
+    "The suite covers weather and order lookup with different argument shapes. Expected values are literal fixtures, which keeps the evaluator independent from agent implementation."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "EVAL_CASES = [\n",
+    "    EvalCase(\n",
+    "        case_id=\"weather-paris\",\n",
+    "        prompt=\"What is the weather in Paris?\",\n",
+    "        expected_calls=[{\"name\": \"get_weather\", \"args\": {\"city\": \"Paris\"}}],\n",
+    "        expected_evidence={\"temperature\": \"18 C\"},\n",
+    "        max_latency_ms=500,\n",
+    "    ),\n",
+    "    EvalCase(\n",
+    "        case_id=\"weather-tokyo\",\n",
+    "        prompt=\"Do I need an umbrella in Tokyo?\",\n",
+    "        expected_calls=[{
```

**File**: `images/trace-based-agent-evaluation.svg` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="520" viewBox="0 0 1100 520" role="img" aria-labelledby="title desc">
+  <title id="title">Trace-based agent evaluation architecture</title>
+  <desc id="desc">Evaluation cases run through an agent adapter. Recorded answers, structured claims, tool calls, evidence, latency, and errors are scored and aggregated into a regression gate.</desc>
+  <defs>
+    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#475569"/></marker>
+    <style>.box{rx:16;stroke-width:2}.title{font:600 20px system-ui,sans-serif;fill:#0f172a}.text{font:15px system-ui,sans-serif;fill:#334155}.edge{stroke:#475569;stroke-width:3;fill:none;marker-end:url(#arrow)}</style>
+  </defs>
+  <rect width="1100" height="520" rx="28" fill="#f8fafc"/>
+  <text x="550" y="48" text-anchor="middle" class="title" font-size="27">Deterministic Trace Evaluation Pipeline</text>
+  <rect class="box" x="45" y="180" width="185" height="125" fill="#dbeafe" stroke="#2563eb"/>
+  <text x="138" y="220" text-anchor="middle" class="title">Eval cases</text><text x="138" y="251" text-anchor="middle" class="text">tool contract</text><text x="138" y="277" text-anchor="middle" class="text">evidence + budget</text>
+  <rect class="box" x="285" y="180" width="185" height="125" fill="#ede9fe" stroke="#7c3aed"/>
+  <text x="378" y="220" text-anchor="middle" class="title">Agent adapter</text><text x="378" y="251" text-anchor="middle" class="text">any framework</text><text x="378" y="277" text-anchor="middle" class="text">same trace contract</text>
+  <rect class="box" x="525" y="90" width="215" height="305" fill="#ecfeff" stroke="#0891b2"/>
+  <text x="633" y="130" text-anchor="middle" class="title">Recorded trace</text>
+  <rect x="555" y="155" width="155" height="38" rx="8" fill="#cffafe"/><text x="633" y="180" text-anchor="middle" class="text">final answer</text>
+  <rect x="555" y="207" width="155" height="38" rx="8" fill="#cffafe"/><text x="633" y="232" text-anchor="middle" class="text">tool + arguments</text>
+  <rect x="555" y="259" width="155" height="38" rx="8" fill="#cffafe"/><text x="633" y="284" text-anchor="middle" class="text">evidence + claims</text>
+  <rect x="555" y="311" width="155" height="38" rx="8" fill="#cffafe"/><text x="633" y="336" text-anchor="middle" class="text">latency + error</text>
+  <rect class="box" x="795" y="105" width="250" height="180" fill="#fef3c7" stroke="#d97706"/>
+  <text x="920" y="145" text-anchor="middle" class="title">Per-case checks</text><text x="920" y="178" text-anchor="middle" class="text">tool · arguments</text><text x="920" y="207" text-anchor="middle" class="text">evidence · latency</text><text x="920" y="245" text-anchor="middle" class="text">explicit weighted score</text>
+  <rect class="box" x="795" y="330" width="250" height="115" fill="#dcfce7" stroke="#16a34a"/>
+  <text x="920" y="370" text-anchor="middle" class="title">Suite quality gate</text><text x="920" y="401" text-anchor="middle" class="text">metrics + all regressions</text>
+  <path class="edge" d="M230 243 H285"/><path class="edge" d="M470 243 H525"/><path class="edge" d="M740 205 H795"/><path class="edge" d="M920 285 V330"/>
+  <text x="550" y="485" text-anchor="middle" class="text">No judge model: the same trace and thresholds always produce the same result</text>
+</svg>
```

**File**: `tests/test_trace_based_agent_evaluation.py` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+import json
+import unittest
+from pathlib import Path
+
+
+REPO_ROOT = Path(__file__).resolve().parents[1]
+NOTEBOOK = REPO_ROOT / "all_agents_tutorials" / "trace_based_agent_evaluation.ipynb"
+
+
+def load_notebook_namespace() -> dict:
+    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
+    namespace = {"__name__": "notebook_under_test"}
+    for cell in notebook["cells"]:
+        if cell.get("cell_type") != "code":
+            continue
+        source = "".join(cell.get("source", []))
+        if source.lstrip().startswith(("!", "%")):
+            continue
+        exec(compile(source, str(NOTEBOOK), "exec"), namespace)
+    return namespace
+
+
+class TraceEvaluationTests(unittest.TestCase):
+    @classmethod
+    def setUpClass(cls):
+        cls.ns = load_notebook_namespace()
+
+    def test_perfect_trace_receives_full_credit(self):
+        case = self.ns["EvalCase"](
+            case_id="weather-paris",
+            prompt="What is the weather in Paris?",
+            expected_calls=[{"name": "get_weather", "args": {"city": "Paris"}}],
+            expected_evidence={"temperature": "18 C"},
+            max_latency_ms=500,
+        )
+        trace = self.ns["AgentTrace"](
+            answer="temperature: 18 C",
+            tool_calls=[{"name": "get_weather", "args": {"city": "Paris"}}],
+            evidence={"temperature": "18 C"},
+            claims={"temperature": "18 C"},
+            latency_ms=120,
+            error=None,
+        )
+
+        score = self.ns["score_trace"](case, trace)
+
+        self.assertEqual(score.total, 1.0)
+        self.assertEqual(score.failed_checks, [])
+
+    def test_wrong_arguments_and_ungrounded_answer_lose_independent_credit(self):
+        case = self.ns["EvalCase"](
+            case_id="weather-paris",
+            prompt="What is the weather in Paris?",
+            expected_calls=[{"name": "get_weather", "args": {"city": "Paris"}}],
+            expected_evidence={"temperature": "18 C"},
+            max_latency_ms=500,
+        )
+        trace = self.ns["AgentTrace"](
+            answer="Paris is sunny.",
+            tool_calls=[{"name": "get_weather", "args": {"city": "London"}}],
+            evidence={},
+            claims={},
+            latency_ms=120,
+            error=None,
+        )
+
+        score = self.ns["score_trace"](case, trace)
+
+        self.assertEqual(score.total, 0.5)
+        self.assertEqual(score.failed_checks, ["arguments", "evidence"])
+
+    def test_errors_fail_every_execution_check(self):
+        case = self.ns["EVAL_CASES"][0]
+        trace = self.ns["AgentTrace"](
+            answer="",
+            tool_calls=[],
+            evidence={},
+            claims={},
+            latency_ms=50,
+            error="timeout",
+        )
+
+        score = self.ns["score_trace"](case, trace)
+
+        self.assertEqual(score.total, 0.0)
+        self.assertIn("error", score.failed_checks)
+        self.assertEqual(score.checks, {"tool": False, "arguments": False, "evidence": False, "latency": False})
+
+    def test_empty_error_string_still_means_execution_failed(self):
+        case = self.ns["EVAL_CASES"][0]
+        trace = self.ns["AgentTrace"](
+            answer="temperature: 18 C",
+            tool_calls=[{"name": "get_weather", "args": {"city": "Paris"}}],
+            evidence={"temperature": "18 C"},
+            claims={"temperature": "18 C"},
+            latency_ms=120,
+            error="",
+        )
+
+        score = self.ns["score_trace"](case, trace)
+
+        self.assertEqual(score.total, 0.0)
+        self.assertIn("error", score.failed_checks)
+
+    def test_agent_exception_becomes_failed_trace_and_suite_continues(self):
+        def raising_agent(case):
+            if case.case_id == "weather-tokyo":
+                raise TimeoutError("provider timed out")
+            return self.ns["improved_agent"](case)
+
+        report = self.ns["evaluate_suite"](raising_agent, self.ns["EVAL_CASES"])
+
+        self.assertEqual(report["case_count"], 4)
+        failed = next(run for run in report["runs"] if run["score"].case_id == "weather-tokyo")
+        self.assertEqual(failed["score"].total, 0.0)
+        self.assertEqual(failed["trace"].error, "TimeoutError: provider timed out")
+        self.assertGreaterEqual(failed["trace"].latency_ms, 1)
+
+    def test_empty_suite_is_rejected_with_clear_error(self):
+        with self.assertRaisesRegex(ValueError, "at least one evaluation case"):
+            self.ns["evaluate_suite"](self.ns["improved_agent"], [])
+
+    def test_contradictory_claim_does_not_receive_evidence_credit(self):
+        case = self.ns["EVAL_CASES"][2]
+        trace = self.ns["AgentTrace"](
+            answer="Order A-100 has not shipped.",
+            tool_calls=[{"name": "lookup_order", "args": {"order_id": "A-100"}}],
+            evidence={"status": "shipped"},
+            claims={"status": "shipped"},
+            latency_ms=90,
+
```

---

### Incident Patch 5: `02706cda` (2026-08-28)
**Commit Message**: Add human-in-the-loop approval agent tutorial (#134)

* feat: add human-in-the-loop approval agent tutorial

* fix: enforce approval boundaries and durable state

**File**: `README.md` (modified, +10/-1)
```diff
@@ -41,7 +41,7 @@ One `npm install` adds the module's AI assistant to your Claude Code, and it gui
 
 </div>
 
-> **Recently added:** Document Intake Agent, HR AI Assistant, Art Tourguide with LightRAG, Contextual Quoting System, ML/DS Assistant | **53 tutorials** and growing
+> **Recently added:** Human-in-the-Loop Approval Agent, Document Intake Agent, HR AI Assistant, Art Tourguide with LightRAG, Contextual Quoting System | **54 tutorials** and growing
 
 ## 📫 Stay Updated!
 
@@ -211,6 +211,7 @@ Below is a comprehensive overview of our GenAI agent implementations, organized
 | 50 | 💼 **Business**   | [Contextual Quoting System](all_agents_tutorials/contextual_quoting_agentic_system.ipynb) | LangGraph  | Multi-agent quoting, RAG + structured data                                   |
 | 51 | 📊 **Analysis**   | [Document Intake Agent](all_agents_tutorials/document_intake_agent_langgraph.ipynb) | LangGraph  | Office docs to LLM-ready markdown, conversion as a tool call                 |
 | 52 | 🎨 **Creative**   | [Social Media Publishing Agent](all_agents_tutorials/social_media_publishing_agent_publora_langgraph.ipynb) | LangGraph  | Per-platform generation, self-review loop, publishing via Publora API        |
+| 53 | 🔍 **QA**         | [Human-in-the-Loop Approval Agent](all_agents_tutorials/human_in_the_loop_approval_agent.ipynb) | LangGraph | Risk-based approval, in-process checkpoints, auditable tool execution        |
 
 Explore our extensive list of GenAI agent implementations, sorted by categories:
 
@@ -734,6 +735,14 @@ Explore our extensive list of GenAI agent implementations, sorted by categories:
     #### Implementation 🛠️
     A LangGraph workflow (fetch_connections → generate → review → publish) with a bounded revise loop: a deterministic length check plus an LLM critic send failing drafts back to the generator with targeted feedback. Publishing goes through Publora's REST API (one create-post call per platform, each with an idempotency key so a call's network retry is safe), with a dry-run mode that creates drafts so nothing goes live while experimenting.
 
+53. **[Human-in-the-Loop Approval Agent with LangGraph](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/human_in_the_loop_approval_agent.ipynb)**
+
+    #### Overview 🔎
+    A safe tool-using agent that executes low-risk reads automatically but pauses consequential writes before any side effect. Reviewers can approve, reject, or replace arguments, with every transition recorded for audit.
+
+    #### Implementation 🛠️
+    Combines deterministic risk and argument policies with LangGraph interrupts and a notebook-local LangGraph 0.2.76 dependency. Its `InMemorySaver` supports resume only during the Python process lifetime; production restart recovery requires a persistent checkpointer. The tutorial verifies that paused and rejected actions never execute and that reviewer-edited arguments are revalidated.
+
 ### 🌟 Special Advanced Technique 🌟
 
 45. **[Sophisticated Controllable Agent for Complex RAG Tasks 🤖](https://github.com/NirDiamant/Controllable-RAG-Agent)**
```

**File**: `all_agents_tutorials/human_in_the_loop_approval_agent.ipynb` (added, +531/-0)
```diff
@@ -0,0 +1,531 @@
+{
+ "cells": [
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "# Human-in-the-Loop Approval Agent with LangGraph\n",
+    "\n",
+    "## Overview\n",
+    "\n",
+    "Agents become risky when a model can move money, send messages, or mutate records without a deliberate checkpoint. This tutorial builds a small approval agent that classifies a proposed tool call, executes low-risk reads automatically, and pauses high-risk writes before any side effect. A reviewer can approve, reject, or replace the arguments; every transition is recorded in an audit log.\n",
+    "\n",
+    "The example uses deterministic policies and simulated tools so it is safe to run without an API key. In a production agent, an LLM or planner would propose the same structured `action`, while the policy and approval boundary remain deterministic."
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## Detailed Explanation\n",
+    "\n",
+    "### Why approval belongs before the tool\n",
+    "\n",
+    "A chat confirmation after a tool call is only a notification. A real approval gate must checkpoint the proposed action, stop execution, accept a reviewer decision, validate any edited arguments, and resume from the same state. Restart recovery additionally requires a persistent checkpointer. The policy below deliberately separates *planning* from *authorization*: a model may suggest a refund, but code decides whether a human must authorize it.\n",
+    "\n",
+    "### Agent Architecture\n",
+    "\n",
+    "![Human-in-the-Loop Approval Agent](../images/human-in-the-loop-approval-agent.svg)\n",
+    "\n",
+    "The safe boundary is the edge between the approval gate and tool execution. Rejection never crosses that boundary; modification crosses it only after the replacement arguments pass the same validation as the original proposal."
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## Required Packages\n",
+    "\n",
+    "### Install LangGraph\n",
+    "\n",
+    "The policy core uses only the Python standard library. This notebook pins LangGraph 0.2.76 for its interrupt/resume API; the repository-wide requirements retain an older version for existing tutorials. Run the notebook in its own environment. Focused graph tests explicitly skip unless this exact notebook version is installed."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "!pip install -q \"langgraph==0.2.76\""
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## Implementation\n",
+    "\n",
+    "### Imports and decision schema\n",
+    "\n",
+    "The reviewer response is a constrained value rather than free-form prose. `modify` requires replacement arguments, while `approve` and `reject` preserve the original action."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "from copy import deepcopy\n",
+    "from dataclasses import dataclass\n",
+    "from datetime import datetime, timezone\n",
+    "from math import isfinite\n",
+    "from typing import Any, Dict, Optional\n",
+    "\n",
+    "\n",
+    "@dataclass(frozen=True)\n",
+    "class ApprovalDecision:\n",
+    "    \"\"\"A reviewer's constrained response to one paused action.\"\"\"\n",
+    "    decision: str\n",
+    "    reviewer: str\n",
+    "    reason: str = \"\"\n",
+    "    modified_args: Optional[Dict[str, Any]] = None\n",
+    "\n",
+    "    def __post_init__(self) -> None:\n",
+    "        \"\"\"Validate the decision vocabulary and modification payload.\"\"\"\n",
+    "        if self.decision not in {\"approve\", \"reject\", \"modify\"}:\n",
+    "            raise ValueError(\"decision must be approve, reject, or modify\")\n",
+    "        if self.decision == \"modify\" and self.modified_args is None:\n",
+    "            raise ValueError(\"modify requires modified_args\")"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "### Define deterministic tool policies\n",
+    "\n",
+    "Only explicitly allowlisted reads are low risk. Every refund is a mutating action and requires approval, regardless of amount. Validation is code, not an LLM judgment, so invalid amounts cannot be smuggled through a reviewer edit."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "def validate_action(action: Dict[str, Any]) -> None:\n",
+    "    \"\"\"Reject unsupported tools and malformed tool arguments.\"\"\"\n",
+    "    tool = action.get(\"tool\")\n",
+    "    args = action.get(\"args\", {})\n",
+    "    if not isinstance(args, dict):\n",
+    "        raise ValueError(\"action args must be a dictionary\")\n",
+    "    if tool == \"lookup_order\":\n",
+    "        unexpected =
```

**File**: `images/human-in-the-loop-approval-agent.svg` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="500" viewBox="0 0 1100 500" role="img" aria-labelledby="title desc">
+  <title id="title">Human-in-the-loop approval agent architecture</title>
+  <desc id="desc">A proposed tool call passes through validation and risk policy. Low-risk calls execute, while high-risk calls pause for approval, rejection, or modified arguments.</desc>
+  <defs>
+    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#475569"/></marker>
+    <style>
+      .box{rx:18;stroke-width:2}.label{font:600 20px system-ui,sans-serif;fill:#0f172a}.small{font:15px system-ui,sans-serif;fill:#334155}.edge{stroke:#475569;stroke-width:3;fill:none;marker-end:url(#arrow)}
+    </style>
+  </defs>
+  <rect width="1100" height="500" rx="28" fill="#f8fafc"/>
+  <text x="550" y="50" text-anchor="middle" class="label" font-size="26">Human-in-the-Loop Approval Boundary</text>
+  <rect class="box" x="45" y="185" width="190" height="110" fill="#dbeafe" stroke="#2563eb"/>
+  <text x="140" y="225" text-anchor="middle" class="label">Proposed action</text><text x="140" y="255" text-anchor="middle" class="small">tool + arguments</text>
+  <rect class="box" x="295" y="185" width="190" height="110" fill="#ede9fe" stroke="#7c3aed"/>
+  <text x="390" y="225" text-anchor="middle" class="label">Policy gate</text><text x="390" y="255" text-anchor="middle" class="small">validate + classify</text>
+  <rect class="box" x="555" y="70" width="220" height="110" fill="#dcfce7" stroke="#16a34a"/>
+  <text x="665" y="112" text-anchor="middle" class="label">Low risk</text><text x="665" y="142" text-anchor="middle" class="small">continue automatically</text>
+  <rect class="box" x="555" y="310" width="220" height="130" fill="#fef3c7" stroke="#d97706"/>
+  <text x="665" y="350" text-anchor="middle" class="label">Human review</text><text x="665" y="380" text-anchor="middle" class="small">approve · reject · modify</text><text x="665" y="408" text-anchor="middle" class="small">in-process checkpoint</text>
+  <rect class="box" x="850" y="185" width="205" height="110" fill="#cffafe" stroke="#0891b2"/>
+  <text x="952" y="225" text-anchor="middle" class="label">Simulated tool</text><text x="952" y="255" text-anchor="middle" class="small">side effect + receipt</text>
+  <path class="edge" d="M235 240 H295"/><path class="edge" d="M485 220 C520 190 520 125 555 125"/><path class="edge" d="M775 125 C825 125 810 220 850 230"/>
+  <path class="edge" d="M485 260 C520 290 520 375 555 375"/><path class="edge" d="M775 375 C825 375 810 270 850 250"/>
+  <text x="510" y="145" class="small">low</text><text x="505" y="346" class="small">high</text>
+  <path d="M775 405 H835" stroke="#dc2626" stroke-width="3"/><text x="805" y="430" text-anchor="middle" class="small" fill="#dc2626">reject → stop</text>
+  <rect x="300" y="462" width="500" height="25" rx="12" fill="#e2e8f0"/><text x="550" y="480" text-anchor="middle" class="small">Every proposal, decision, edit, and execution is appended to the audit log</text>
+</svg>
```

**File**: `tests/test_hitl_approval_agent.py` (added, +268/-0)
```diff
@@ -0,0 +1,268 @@
+import json
+import sys
+import types
+import unittest
+from importlib.metadata import PackageNotFoundError, version
+from pathlib import Path
+
+
+REPO_ROOT = Path(__file__).resolve().parents[1]
+NOTEBOOK = REPO_ROOT / "all_agents_tutorials" / "human_in_the_loop_approval_agent.ipynb"
+TUTORIAL_LANGGRAPH_VERSION = "0.2.76"
+
+
+def has_compatible_langgraph() -> bool:
+    """Run integration tests only with the version pinned by the notebook."""
+    try:
+        installed_version = version("langgraph")
+    except PackageNotFoundError:
+        return False
+    return installed_version == TUTORIAL_LANGGRAPH_VERSION
+
+
+def load_notebook_namespace(include_langgraph: bool = False) -> dict:
+    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
+    module_name = "notebook_under_test_full" if include_langgraph else "notebook_under_test_core"
+    module = types.ModuleType(module_name)
+    sys.modules[module_name] = module
+    namespace = module.__dict__
+    for cell in notebook["cells"]:
+        if cell.get("cell_type") != "code":
+            continue
+        if (
+            not include_langgraph
+            and "requires-langgraph" in cell.get("metadata", {}).get("tags", [])
+        ):
+            continue
+        source = "".join(cell.get("source", []))
+        if source.lstrip().startswith(("!", "%")) or "IPython.display" in source:
+            continue
+        exec(compile(source, str(NOTEBOOK), "exec"), namespace)
+    return namespace
+
+
+class HumanApprovalAgentTests(unittest.TestCase):
+    @classmethod
+    def setUpClass(cls):
+        cls.ns = load_notebook_namespace()
+
+    def test_low_risk_action_executes_without_an_approval_request(self):
+        state = self.ns["run_until_pause"](
+            self.ns["new_request"]("lookup_order", {"order_id": "A-100"})
+        )
+
+        self.assertEqual(state["status"], "completed")
+        self.assertIsNone(state["approval_request"])
+        self.assertEqual(state["audit_log"][-1]["event"], "tool_executed")
+
+    def test_high_risk_action_pauses_before_any_side_effect(self):
+        state = self.ns["run_until_pause"](
+            self.ns["new_request"](
+                "issue_refund", {"order_id": "A-100", "amount": 240}
+            )
+        )
+
+        self.assertEqual(state["status"], "awaiting_approval")
+        self.assertEqual(state["approval_request"]["risk"], "high")
+        self.assertNotIn("tool_result", state)
+        self.assertFalse(any(e["event"] == "tool_executed" for e in state["audit_log"]))
+
+    def test_small_mutating_refund_also_pauses_before_side_effect(self):
+        state = self.ns["run_until_pause"](
+            self.ns["new_request"](
+                "issue_refund", {"order_id": "A-100", "amount": 80}
+            )
+        )
+
+        self.assertEqual(state["status"], "awaiting_approval")
+        self.assertNotIn("tool_result", state)
+
+    def test_planned_refund_cannot_call_tool_dispatcher_directly(self):
+        planned = self.ns["new_request"](
+            "issue_refund", {"order_id": "A-100", "amount": 80}
+        )
+
+        with self.assertRaises(PermissionError):
+            self.ns["execute_tool"](planned)
+
+    def test_approve_resumes_and_executes_the_original_action(self):
+        paused = self.ns["run_until_pause"](
+            self.ns["new_request"](
+                "issue_refund", {"order_id": "A-100", "amount": 240}
+            )
+        )
+        completed = self.ns["resume_with_decision"](
+            paused, self.ns["ApprovalDecision"]("approve", reviewer="ops@example.com")
+        )
+
+        self.assertEqual(completed["status"], "completed")
+        self.assertEqual(completed["tool_result"]["refunded"], 240)
+        self.assertEqual(completed["audit_log"][-1]["reviewer"], "ops@example.com")
+
+    def test_reject_finishes_without_executing_the_action(self):
+        paused = self.ns["run_until_pause"](
+            self.ns["new_request"](
+                "issue_refund", {"order_id": "A-100", "amount": 240}
+            )
+        )
+        rejected = self.ns["resume_with_decision"](
+            paused,
+            self.ns["ApprovalDecision"](
+                "reject", reviewer="ops@example.com", reason="Policy exception required"
+            ),
+        )
+
+        self.assertEqual(rejected["status"], "rejected")
+        self.assertNotIn("tool_result", rejected)
+        self.assertFalse(any(e["event"] == "tool_executed" for e in rejected["audit_log"]))
+
+    def test_modify_revalidates_and_executes_reviewer_arguments(self):
+        paused = self.ns["run_until_pause"](
+            self.ns["new_request"](
+                "issue_refund", {"order_id": "A-100", "amount": 240}
+            )
+        )
+        modified = self.ns["resume_with_decision"](
+            paused,
+            self.ns["ApprovalDecision"](
+                "modify",
+                reviewer="ops@example.com",
+                modified_ar
```

---

### Incident Patch 6: `28828033` (2026-07-12)
**Commit Message**: Merge pull request #113 from octo-patch/fix/issue-95-fetch-article-content

fix: fetch actual article content instead of search snippets (fixes #95)

**File**: `all_agents_tutorials/search_the_internet_and_summarize.ipynb` (modified, +5/-79)
```diff
@@ -65,30 +65,10 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 10,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
-   "source": [
-    "import os\n",
-    "from langchain_community.tools import DuckDuckGoSearchResults\n",
-    "from langchain_openai import ChatOpenAI\n",
-    "from langchain_core.prompts import PromptTemplate\n",
-    "from pydantic import BaseModel, Field\n",
-    "from typing import List, Dict, Any, Tuple, Optional\n",
-    "import re\n",
-    "import nltk\n",
-    "from dotenv import load_dotenv\n",
-    "\n",
-    "# Download necessary NLTK data\n",
-    "nltk.download('punkt', quiet=True)\n",
-    "nltk.download('stopwords', quiet=True)\n",
-    "\n",
-    "# Load environment variables\n",
-    "load_dotenv()\n",
-    "\n",
-    "# Set OpenAI API key\n",
-    "os.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')"
-   ]
+   "source": "import os\nimport requests\nfrom bs4 import BeautifulSoup\nfrom langchain_community.tools import DuckDuckGoSearchResults\nfrom langchain_openai import ChatOpenAI\nfrom langchain_core.prompts import PromptTemplate\nfrom pydantic import BaseModel, Field\nfrom typing import List, Dict, Any, Tuple, Optional\nimport re\nimport nltk\nfrom dotenv import load_dotenv\n\n# Download necessary NLTK data\nnltk.download('punkt', quiet=True)\nnltk.download('stopwords', quiet=True)\n\n# Load environment variables\nload_dotenv()\n\n# Set OpenAI API key\nos.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')"
   },
   {
    "cell_type": "markdown",
@@ -139,64 +119,10 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 15,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
-   "source": [
-    "def parse_search_results(results_string: str) -> List[dict]:\n",
-    "    \"\"\"Parse a string representation of search results into a list of dictionaries.\"\"\"\n",
-    "    results = []\n",
-    "    entries = results_string.split(', snippet: ')\n",
-    "    for entry in entries[1:]:  # Skip the first split as it's empty\n",
-    "        parts = entry.split(', title: ')\n",
-    "        if len(parts) == 2:\n",
-    "            snippet = parts[0]\n",
-    "            title_link = parts[1].split(', link: ')\n",
-    "            if len(title_link) == 2:\n",
-    "                title, link = title_link\n",
-    "                results.append({\n",
-    "                    'snippet': snippet,\n",
-    "                    'title': title,\n",
-    "                    'link': link\n",
-    "                })\n",
-    "    return results\n",
-    "\n",
-    "\n",
-    "def perform_web_search(query: str, specific_site: Optional[str] = None) -> Tuple[List[str], List[Tuple[str, str]]]:\n",
-    "    \"\"\"Perform a web search based on a query, optionally including a specific website.\"\"\"\n",
-    "    try:\n",
-    "        if specific_site:\n",
-    "            specific_query = f\"site:{specific_site} {query}\"\n",
-    "            print(f\"Searching for: {specific_query}\")\n",
-    "            specific_results = search.invoke(specific_query)\n",
-    "            print(f\"Specific search results: {specific_results}\")\n",
-    "            specific_parsed = parse_search_results(specific_results)\n",
-    "            \n",
-    "            general_query = f\"-site:{specific_site} {query}\"\n",
-    "            print(f\"Searching for: {general_query}\")\n",
-    "            general_results = search.invoke(general_query)\n",
-    "            print(f\"General search results: {general_results}\")\n",
-    "            general_parsed = parse_search_results(general_results)\n",
-    "            \n",
-    "            combined_results = (specific_parsed + general_parsed)[:3]\n",
-    "        else:\n",
-    "            print(f\"Searching for: {query}\")\n",
-    "            web_results = search.invoke(query)\n",
-    "            print(f\"Web results: {web_results}\")\n",
-    "            combined_results = parse_search_results(web_results)[:3]\n",
-    "        \n",
-    "        web_knowledge = [result.get('snippet', '') for result in combined_results]\n",
-    "        sources = [(result.get('title', 'Untitled'), result.get('link', '')) for result in combined_results]\n",
-    "        \n",
-    "        print(f\"Processed web_knowledge: {web_knowledge}\")\n",
-    "        print(f\"Processed sources: {sources}\")\n",
-    "        return web_knowledge, sources\n",
-    "    except Exception as e:\n",
-    "        print(f\"Error in perform_web_search: {str(e)}\")\n",
-    "        import traceback\n",
-    "        traceback.print_exc()\n",
-    "        return [], []"
-   ]
+   "source": "def parse_search_results(results_string: str) -> List[dict]:\n    \"\"\"Parse a string representation of search results into a list of dictionaries.\"\"\"\n    results = []\n    entries = results_string.split(', snippet: ')\n    for entry in entries[1:]:  # Skip the first split as it's empty\n        part
```

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ pyzmq==26.2.0
 pywin32==306; platform_system == "Windows"
 regex==2024.7.24
 requests==2.32.3
+beautifulsoup4==4.12.3
 six==1.16.0
 sniffio==1.3.1
 SQLAlchemy==2.0.34
```

---

### Incident Patch 7: `28e05d29` (2026-06-03)
**Commit Message**: Auto-apply RAGKING via ?code=, frame as GitHub-community offer, fix rating

- RAG book links now use /rag-made-simple?code=RAGKING so the 33% launch
  discount auto-applies at checkout for the GitHub community.
- Reword the coupon copy as a GitHub-community offer.
- Correct the book rating to 4.6 stars.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +6/-6)
```diff
@@ -14,14 +14,14 @@ Welcome to one of the most extensive and dynamic collections of Generative AI (G
 
 ## 📖 Books in the DiamantAI Series
 
-<a href="https://diamant-ai.com/rag-made-simple"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="500"></a>
+<a href="https://diamant-ai.com/rag-made-simple?code=RAGKING"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="500"></a>
 
-**[RAG Made Simple](https://diamant-ai.com/rag-made-simple)** - the production reference for RAG systems
+**[RAG Made Simple](https://diamant-ai.com/rag-made-simple?code=RAGKING)** - the production reference for RAG systems
 22 techniques explained with intuition, comparisons, and diagrams. Essential reading for agent builders whose agents need to retrieve and ground responses on real data.
-*1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.4 stars*
-**PDF + EPUB · 33% off at checkout with code RAGKING (launch offer)**
+*1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.6 stars*
+**PDF + EPUB · GitHub community offer: 33% off with code RAGKING**
 
-👉 [**Get RAG Made Simple (33% off with code RAGKING)**](https://diamant-ai.com/rag-made-simple)
+👉 [**Get RAG Made Simple (33% off with code RAGKING)**](https://diamant-ai.com/rag-made-simple?code=RAGKING)
 
 ---
 
@@ -670,7 +670,7 @@ Explore our extensive list of GenAI agent implementations, sorted by categories:
     #### Implementation 🛠️
     Features ChromaDB for RAG, SQLite for structured data, Pydantic schemas for validation, and a coordinated workflow of specialized agents (retriever, reasoning, classification, quote generation) using OpenAI + Groq. One of the most production-relevant multi-agent implementations in this collection.
 
-> 📖 **Want to understand the RAG techniques powering these agents?** [RAG Made Simple](https://diamant-ai.com/rag-made-simple) covers 22 RAG techniques visually. Now 33% off with code RAGKING for the launch.
+> 📖 **Want to understand the RAG techniques powering these agents?** [RAG Made Simple](https://diamant-ai.com/rag-made-simple?code=RAGKING) covers 22 RAG techniques visually. Now 33% off for the GitHub community with code RAGKING.
 
 ### 🌟 Special Advanced Technique 🌟
 
```

---

### Incident Patch 8: `f6bf48e7` (2026-05-31)
**Commit Message**: Fix README centering: close banner div so body reads left-aligned

The earlier 'demote jobs section' change left the opening <div align=center>
by the banner while moving its closing </div> to the bottom jobs panel, so
the entire README body rendered centered. Close the div right after the
banner (keeps the hero centered) and drop the stray </div> at the bottom,
restoring left-aligned body text and the left-aligned jobs panel.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -40,6 +40,8 @@ Welcome to one of the most extensive and dynamic collections of Generative AI (G
 
 <img src="images/collective-banner.png" alt="DiamantAI Collective - AI engineering jobs" width="600">
 
+</div>
+
 ## 🏆 Sponsors
 
 <div align="center">
@@ -739,8 +741,6 @@ To begin exploring and building GenAI agents:
 
 ---
 
-</div>
-
 ## Contributing
 
 We welcome contributions from the community! If you have a new technique or improvement to suggest:
```

---

### Incident Patch 9: `d02c64e6` (2026-05-30)
**Commit Message**: docs(readme): cross-link Agent Memory Techniques repo

Add a link to the Agent Memory Techniques notebooks so readers of this repo
discover the agent-memory tutorials.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +3/-0)
```diff
@@ -124,6 +124,9 @@ Related deep dives: [Your first AI agent](https://diamant-ai.com/blog/your-first
 
 🖋️ Explore my **[Prompt Engineering Techniques guide](https://github.com/NirDiamant/Prompt_Engineering)** for an extensive collection of prompting strategies, from fundamental concepts to advanced methods, improving your ability to communicate effectively with AI language models.
 
+
+🧠 Give your agents memory with **[Agent Memory Techniques](https://github.com/NirDiamant/Agent_Memory_Techniques)** — 30 runnable notebooks on conversation buffers, vector stores, knowledge graphs, episodic and semantic memory, plus Mem0, MemGPT/Letta, Zep, and Graphiti.
+
 ## A Community-Driven Knowledge Hub
 
 **This repository grows stronger with your contributions!** Join our vibrant communities - the central hubs for shaping and advancing this project together 🤝
```

---

### Incident Patch 10: `251298a8` (2026-05-23)
**Commit Message**: docs: refresh book promo - fix stale pricing, add Prompt Engineering cross-promo (#116)

The "From the Same Author" section advertised RAG Made Simple at "$0.99 launch
price (goes up soon)". The Kindle price was raised to $9.99 on May 16.
Visitors clicking through saw a different price than promised.

This repo also wasn't cross-promoting the Prompt Engineering companion book.

Changes:
- Replace stale launch pricing with current: Kindle $9.99, Paperback $24.99
- Use verifiable social proof: 1,500+ sold, hit #1 at launch, 4.4 stars
- Restructure as "Books in the DiamantAI Series" with both titles
- Add Prompt Engineering cross-promo (also tracked with diamantai-genai-20 tag)
- Preserve all existing tracker URLs and affiliate tags

**File**: `README.md` (modified, +14/-5)
```diff
@@ -14,14 +14,23 @@ Welcome to one of the most extensive and dynamic collections of Generative AI (G
 
 <div align="center">
 
-## 📖 From the Same Author
+## 📖 Books in the DiamantAI Series
 
-<a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="#1 Best Seller in Generative AI on Amazon - Click to buy" width="500"></a>
+<a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="500"></a>
 
-**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=RAG%20Made%20Simple)** — **#1 Best Seller on Amazon in Generative AI.**
-22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$0.99** launch price (goes up soon).
+**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=RAG%20Made%20Simple)** - the production reference for RAG systems
+22 techniques explained with intuition, comparisons, and diagrams. Essential reading for agent builders whose agents need to retrieve and ground responses on real data.
+*1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.4 stars*
+**Kindle $9.99 · Paperback $24.99 · Free with Kindle Unlimited**
 
-### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=Get%20the%20book%20on%20Amazon)
+👉 [**Get RAG Made Simple on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=Get%20RAG%20Made%20Simple)
+
+---
+
+**[Prompt Engineering: Master the Art of AI Interaction](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-pe&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0DZ85RPB5%3Ftag%3Ddiamantai-genai-20&text=Prompt%20Engineering)** - the prompting foundation
+22 hands-on prompting techniques. The companion to RAG Made Simple. The prompting layer that determines how well your agents behave.
+
+👉 [**See Prompt Engineering on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-pe-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0DZ85RPB5%3Ftag%3Ddiamantai-genai-20&text=See%20Prompt%20Engineering)
 
 </div>
 
```

---

### Incident Patch 11: `b13ecf07` (2026-04-19)
**Commit Message**: fix: fetch actual article content instead of search snippets in notebook 26 (fixes #95)

Previously, perform_web_search() only passed the short DuckDuckGo snippet
(a 1-2 sentence excerpt) to the summarizer. This caused the AI to summarize
search result previews rather than the full article text.

Add fetch_article_content() which fetches and extracts the full article text
from each result URL using requests + BeautifulSoup, with a graceful fallback
to the original snippet if the URL is inaccessible (paywalled, timeout, etc.).
Also add the required imports (requests, BeautifulSoup) to the imports cell.

**File**: `all_agents_tutorials/search_the_internet_and_summarize.ipynb` (modified, +5/-79)
```diff
@@ -65,30 +65,10 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 10,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
-   "source": [
-    "import os\n",
-    "from langchain_community.tools import DuckDuckGoSearchResults\n",
-    "from langchain_openai import ChatOpenAI\n",
-    "from langchain_core.prompts import PromptTemplate\n",
-    "from pydantic import BaseModel, Field\n",
-    "from typing import List, Dict, Any, Tuple, Optional\n",
-    "import re\n",
-    "import nltk\n",
-    "from dotenv import load_dotenv\n",
-    "\n",
-    "# Download necessary NLTK data\n",
-    "nltk.download('punkt', quiet=True)\n",
-    "nltk.download('stopwords', quiet=True)\n",
-    "\n",
-    "# Load environment variables\n",
-    "load_dotenv()\n",
-    "\n",
-    "# Set OpenAI API key\n",
-    "os.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')"
-   ]
+   "source": "import os\nimport requests\nfrom bs4 import BeautifulSoup\nfrom langchain_community.tools import DuckDuckGoSearchResults\nfrom langchain_openai import ChatOpenAI\nfrom langchain_core.prompts import PromptTemplate\nfrom pydantic import BaseModel, Field\nfrom typing import List, Dict, Any, Tuple, Optional\nimport re\nimport nltk\nfrom dotenv import load_dotenv\n\n# Download necessary NLTK data\nnltk.download('punkt', quiet=True)\nnltk.download('stopwords', quiet=True)\n\n# Load environment variables\nload_dotenv()\n\n# Set OpenAI API key\nos.environ[\"OPENAI_API_KEY\"] = os.getenv('OPENAI_API_KEY')"
   },
   {
    "cell_type": "markdown",
@@ -139,64 +119,10 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 15,
+   "execution_count": null,
    "metadata": {},
    "outputs": [],
-   "source": [
-    "def parse_search_results(results_string: str) -> List[dict]:\n",
-    "    \"\"\"Parse a string representation of search results into a list of dictionaries.\"\"\"\n",
-    "    results = []\n",
-    "    entries = results_string.split(', snippet: ')\n",
-    "    for entry in entries[1:]:  # Skip the first split as it's empty\n",
-    "        parts = entry.split(', title: ')\n",
-    "        if len(parts) == 2:\n",
-    "            snippet = parts[0]\n",
-    "            title_link = parts[1].split(', link: ')\n",
-    "            if len(title_link) == 2:\n",
-    "                title, link = title_link\n",
-    "                results.append({\n",
-    "                    'snippet': snippet,\n",
-    "                    'title': title,\n",
-    "                    'link': link\n",
-    "                })\n",
-    "    return results\n",
-    "\n",
-    "\n",
-    "def perform_web_search(query: str, specific_site: Optional[str] = None) -> Tuple[List[str], List[Tuple[str, str]]]:\n",
-    "    \"\"\"Perform a web search based on a query, optionally including a specific website.\"\"\"\n",
-    "    try:\n",
-    "        if specific_site:\n",
-    "            specific_query = f\"site:{specific_site} {query}\"\n",
-    "            print(f\"Searching for: {specific_query}\")\n",
-    "            specific_results = search.invoke(specific_query)\n",
-    "            print(f\"Specific search results: {specific_results}\")\n",
-    "            specific_parsed = parse_search_results(specific_results)\n",
-    "            \n",
-    "            general_query = f\"-site:{specific_site} {query}\"\n",
-    "            print(f\"Searching for: {general_query}\")\n",
-    "            general_results = search.invoke(general_query)\n",
-    "            print(f\"General search results: {general_results}\")\n",
-    "            general_parsed = parse_search_results(general_results)\n",
-    "            \n",
-    "            combined_results = (specific_parsed + general_parsed)[:3]\n",
-    "        else:\n",
-    "            print(f\"Searching for: {query}\")\n",
-    "            web_results = search.invoke(query)\n",
-    "            print(f\"Web results: {web_results}\")\n",
-    "            combined_results = parse_search_results(web_results)[:3]\n",
-    "        \n",
-    "        web_knowledge = [result.get('snippet', '') for result in combined_results]\n",
-    "        sources = [(result.get('title', 'Untitled'), result.get('link', '')) for result in combined_results]\n",
-    "        \n",
-    "        print(f\"Processed web_knowledge: {web_knowledge}\")\n",
-    "        print(f\"Processed sources: {sources}\")\n",
-    "        return web_knowledge, sources\n",
-    "    except Exception as e:\n",
-    "        print(f\"Error in perform_web_search: {str(e)}\")\n",
-    "        import traceback\n",
-    "        traceback.print_exc()\n",
-    "        return [], []"
-   ]
+   "source": "def parse_search_results(results_string: str) -> List[dict]:\n    \"\"\"Parse a string representation of search results into a list of dictionaries.\"\"\"\n    results = []\n    entries = results_string.split(', snippet: ')\n    for entry in entries[1:]:  # Skip the first split as it's empty\n        part
```

---

### Incident Patch 12: `bc344e75` (2026-04-15)
**Commit Message**: Revert RAG book promotion back to $0.99 launch pricing (#112)

The book was briefly raised to $9.99 to prep for a Kindle Countdown Deal, but KDP's 30-day list price stability rule blocked the countdown. Price restored to $0.99 for the remainder of the launch window.

PE Book countdown banner (where present) remains since PE is still on its Kindle Countdown Deal at $2.99 through April 21.

Co-authored-by: NirDiamant <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ Welcome to one of the most extensive and dynamic collections of Generative AI (G
 <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="#1 Best Seller in Generative AI on Amazon - Click to buy" width="500"></a>
 
 **[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=RAG%20Made%20Simple)** — **#1 Best Seller on Amazon in Generative AI.**
-22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$9.99** on Amazon.
+22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$0.99** launch price (goes up soon).
 
 ### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=Get%20the%20book%20on%20Amazon)
 
```

---

### Incident Patch 13: `fa9f14f3` (2026-04-10)
**Commit Message**: Clean up README formatting (fix dashes, normalize spacing)



---

### Incident Patch 14: `2afb690c` (2026-04-10)
**Commit Message**: Add 5 new agent tutorials to README (HR, ML Assistant, Art Tourguide, Gutenberg, Contextual Quoting) + book CTA with tracking

**File**: `README.md` (modified, +43/-0)
```diff
@@ -626,6 +626,49 @@ Explore our extensive list of GenAI agent implementations, sorted by categories:
     #### Additional Resources 📚
     - **[YouTube Explanation](https://www.youtube.com/watch?v=qi35mGGkCtg)**
 
+
+46. **[HR AI Assistant](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/HR_AI-Assistant.ipynb)**
+
+    #### Overview 🔎
+    An AI-powered recruitment assistant using LangGraph-based workflow for requirements gathering, job description generation, LinkedIn candidate search, and CV analysis.
+
+    #### Implementation 🛠️
+    Leverages LangChain and LangGraph to orchestrate a multi-step recruitment pipeline with structured state management, OpenAI for language generation, and automated candidate evaluation workflows.
+
+47. **[AI-Driven ML and Data Science Assistant](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/ai_driven_ml_and_datascience_assistant.ipynb)**
+
+    #### Overview 🔎
+    A comprehensive ML assistant using LangGraph + OpenAI that loads datasets, performs preprocessing, feature engineering, model training, evaluation, and visualization through an agentic workflow.
+
+    #### Implementation 🛠️
+    Utilizes LangGraph for orchestrating ML pipeline tools including data preprocessing, model selection, hyperparameter tuning, and results visualization. Demonstrates end-to-end agentic ML workflows with Kaggle dataset integration.
+
+48. **[Art Tourguide with LightRAG](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/art_agent.ipynb)**
+
+    #### Overview 🔎
+    An interactive art tour guide using LightRAG (knowledge-graph RAG) and LangGraph for conversational exploration of art collections with structured data retrieval.
+
+    #### Implementation 🛠️
+    Combines LightRAG for knowledge-graph-based retrieval with LangGraph agent chains, interactive widget UI, and custom art data preparation. Demonstrates a novel application of graph-based RAG in a creative domain.
+
+49. **[Project Gutenberg Conversational Helper](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/Gutenbergs_Sage.ipynb)**
+
+    #### Overview 🔎
+    A conversational agent for exploring Project Gutenberg texts using local LLMs via Ollama, with vector store RAG through Chroma/Pinecone and named entity recognition with spaCy.
+
+    #### Implementation 🛠️
+    Leverges LangGraph + Ollama for fully local LLM inference, multi-user support with session management, NER-enhanced retrieval, and dual vector store integration (Chroma for local, Pinecone for cloud).
+
+50. **[Contextual Quoting Agentic System](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/contextual_quoting_agentic_system.ipynb)**
+
+    #### Overview 🔎
+    A sophisticated multi-agent system for insurance/business quoting using LangGraph with RAG, specialized agents for retrieval, reasoning, classification, and quote generation.
+
+    #### Implementation 🛠️
+    Features ChromaDB for RAG, SQLite for structured data, Pydantic schemas for validation, and a coordinated workflow of specialized agents (retriever, reasoning, classification, quote generation) using OpenAI + Groq. One of the most production-relevant multi-agent implementations in this collection.
+
+> 📖 **Want to understand the RAG techniques powering these agents?** [RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=genai-agents--readme-book-cta&click=book-buy-amazon-readme-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-genai-20&text=RAG%20Made%20Simple) covers 22 RAG techniques visually. Free with Kindle Unlimited.
+
 ### 🌟 Special Advanced Technique 🌟
 
 45. **[Sophisticated Controllable Agent for Complex RAG Tasks 🤖](https://github.com/NirDiamant/Controllable-RAG-Agent)**
```

---

### Incident Patch 15: `4653b908` (2026-04-10)
**Commit Message**: Add Art Tourguide agent with LightRAG

Add an Art Tourguide using LightRAG

**File**: `all_agents_tutorials/art_agent.ipynb` (added, +1240/-0)
```diff
@@ -0,0 +1,1240 @@
+{
+ "cells": [
+  {
+   "cell_type": "markdown",
+   "metadata": {
+    "id": "-y6gO0VbS9IJ",
+    "vscode": {
+     "languageId": "plaintext"
+    }
+   },
+   "source": [
+    "<a href=\"https://colab.research.google.com/github/MichaelDeng03/GenAI_Agents/blob/main/all_agents_tutorials/art_agent.ipynb\" target=\"_parent\"><img src=\"https://colab.research.google.com/assets/colab-badge.svg\" alt=\"Open In Colab\"/></a>"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {
+    "id": "7YY34qHKS9IK",
+    "vscode": {
+     "languageId": "plaintext"
+    }
+   },
+   "source": [
+    "# Interactive Art Agent\n",
+    "This tutorial will walk through the creation of an AI Agent that helps you explore and learn art!\n",
+    "\n",
+    "### Overview\n",
+    "For knowledge retrieval, this tutorial uses [LightRAG](https://github.com/HKUDS/LightRAG) which is knowledge graph based RAG implementation. Compared to GraphRAG, LightRAG is more accurate for single topic datasets, and uses 1,000x less tokens for retrieval. Furthermore, documents can be added to LightRAG incrementally without rebuilding the knowledge graph. See the full results in the [paper](https://arxiv.org/abs/2410.05779).\n",
+    "\n",
+    "For the agent itself, we use LangGraph.\n",
+    "\n",
+    "### Outline\n",
+    "0. [Setup](#setup)\n",
+    "1. [Data Preparation + RAG](#data-preparation--rag)\n",
+    "2. [Agent Creation](#agent-creation)\n",
+    "3. [Final App](#final-app)"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {
+    "id": "xyLfhm3lS9IK",
+    "vscode": {
+     "languageId": "plaintext"
+    }
+   },
+   "source": [
+    "### Setup"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {
+    "id": "XL-vDTEVS9IK"
+   },
+   "source": [
+    "#### Environment\n",
+    "\n",
+    "This tutorial uses openai embedding models. While there are alternatives, we recommend using the openai models for the best results."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {
+    "id": "h7U51nLOS9IL"
+   },
+   "outputs": [],
+   "source": [
+    "!uv venv\n",
+    "!uv pip install lightrag-hku aioboto3 numpy ollama openai tenacity aioboto3 transformers torch tiktoken nano_vectordb neo4j oracledb textract setuptools pyvis sqlalchemy langchain_community langchain_openai sqlmodel ipywidgets==7.7.1 asyncio markdown langgraph -q"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {
+    "id": "yWViZHIaktSX"
+   },
+   "outputs": [],
+   "source": [
+    "import os\n",
+    "\n",
+    "os.environ['OPENAI_API_KEY'] = ..."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {
+    "id": "n0xrObVQS9IL"
+   },
+   "outputs": [],
+   "source": [
+    "import ipywidgets as widgets\n",
+    "\n",
+    "import random\n",
+    "from typing_extensions import TypedDict\n",
+    "\n",
+    "from langgraph.graph import StateGraph, END\n",
+    "from langchain_core.runnables.graph import MermaidDrawMethod\n",
+    "\n",
+    "from IPython.display import display, Image as IPImage\n",
+    "\n",
+    "\n",
+    "from io import BytesIO\n",
+    "from PIL import Image as PILImage\n",
+    "\n",
+    "import markdown\n",
+    "\n",
+    "import requests\n",
+    "from PIL import Image as PILImage\n",
+    "from ipywidgets import widgets\n",
+    "import markdown\n",
+    "import json"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {
+    "id": "9GsEmGJZS9IL",
+    "vscode": {
+     "languageId": "plaintext"
+    }
+   },
+   "source": [
+    "### Data Preparation + RAG"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {
+    "id": "DGtEqWCiS9IL"
+   },
+   "source": [
+    "#### Data Preparation\n",
+    "\n",
+    "We scraped data from [wikiart](https://wikiart.org/) using a combination of requests and beautiful soup.\n",
+    "\n",
+    "We provide a preprocessed, limited dataset of this data for the tutorial found in `data/artinfo.json`.\n",
+    "\n",
+    "Preprocessed data for each artwork looks like:\n",
+    "\n",
+    "```plaintext\n",
+    "Artwork Name: {artwork_name}\n",
+    "Artwork Genre: {genre_list}\n",
+    "Artwork Media: {media_list}\n",
+    "Wikiart URL: https://www.wikiart.org{wikiart_slug}\n",
+    "\n",
+    "Wikipedia Article:\n",
+    "{wiki_article}\n",
+    "```\n"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": 4,
+   "metadata": {
+    "colab": {
+     "base_uri": "https://localhost:8080/"
+    },
+    "id": "CMUufJG7S9IM",
+    "outputId": "ada7e745-ad71-4d57-fe1d-fe50a37bd318"
+   },
+   "outputs": [
+    {
+     "name": "stdout",
+     "output_type": "stream",
+     "text": [
+      "78\n",
+      "\n",
+      "Artist: Frederick McCubbin\n",
+      "Artwork Name: Down on his luck\n",
+      "Artwork Genre: genre painting\n",
+      "Artwork Media: canvas,oil\n",
+      "Wikiart URL: https://www.wikiart.org/en/frederick-mccubbin/d
```

#### Recent Merged Pull Requests:
- **PR #170** (2026-09-28): Add Read vs Write: What One AI Answer Costs (#57) + the energy film (@NirDiamant)
- **PR #169** (closed): Add Tenuo to Governance & Safety Resources (@d8joseph)
- **PR #168** (closed): Add evidence-grounded social research agent tutorial (@IRONICBo)
- **PR #167** (2026-09-24): Add One-Step Decision Router tutorial (#56) + the Jev film (@NirDiamant)
- **PR #157** (2026-09-08): Index the while-loop tutorial (it was in the repo but in no list) (@NirDiamant)
- **PR #151** (closed): Bump the minor-and-patch group across 1 directory with 52 updates (@dependabot[bot])
- **PR #148** (2026-08-31): README: feature the while-loop agents video + companion notebook (@NirDiamant)
- **PR #147** (2026-08-31): Tutorial: AI agents are just while loops — the smallest real agent, the spiral, and where a rule has to live (@NirDiamant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
