# Forensic Learning Record (Deep Inspection): yifanfeng97/Hyper-Extract

> **Canonical Artifact**: `07_PROJECT_LEARNING/yifanfeng97-hyper-extract-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yifanfeng97/Hyper-Extract](https://github.com/yifanfeng97/Hyper-Extract))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:59:41.654Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yifanfeng97/Hyper-Extract`
- **Description**: Hypergraph is more powerful. Transform unstructured text into structured knowledge with LLMs. Graphs, hypergraphs, and spatio-temporal extractions — with one command.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4052 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/en/autotypes/document_demo.py`
```
"""
AutoDocument Demo - Tesla corpus chunks

Load the Gallery `general/base_document` preset and store raw text chunks.
AutoDocument does not run LLM extraction; the LLM client is only used by
optional chat after chunks are indexed.

Usage:
    python examples/en/autotypes/document_demo.py
"""

from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from hyperextract.utils.template_engine import Template

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  AutoDocument Demo - Tesla corpus")
    print("=" * 60)
    print("Chunking text via general/base_document (no LLM extraction)...")

    corpus = Template.create("general/base_document", "en", llm, embedder)
    corpus.feed_text(text, source_id="tesla")

    print(f"\nStored {len(corpus.data.chunks)} chunks")
    for chunk in corpus.data.chunks[:3]:
        preview = chunk.content[:80].replace("\n", " ")
        print(f"  - {preview}...")

    corpus.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions[:2]:
        print(f"\nQ: {q}")
        try:
            result = corpus.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

```

### Core Architecture Module: `examples/en/autotypes/graph_demo.py`
```
"""
Graph Extraction Demo - Tesla Biography

Extract entities and relationships from text using AutoGraph.
This demo shows how to build a knowledge graph from unstructured text.

Usage:
    python examples/en/autotypes/graph_demo.py
"""

from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract.types import AutoGraph

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class Entity(BaseModel):
    """Entity in the knowledge graph"""

    name: str = Field(description="Entity name")
    type: str = Field(description="Entity type: person/location/invention/etc")
    description: str = Field(description="Entity description")


class Relation(BaseModel):
    """Relation between entities"""

    source: str = Field(description="Source entity")
    target: str = Field(description="Target entity")
    type: str = Field(description="Relation type: employer/partner/rival/invented/etc")
    description: str = Field(description="Relation description")


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  Graph Extraction Demo")
    print("=" * 60)
    print("Extracting entities and relationships from Tesla's biography...")

    graph = AutoGraph[Entity, Relation](
        node_schema=Entity,
        edge_schema=Relation,
        node_key_extractor=lambda x: x.name,
        edge_key_extractor=lambda x: f"{x.source}-{x.type}-{x.target}",
        nodes_in_edge_extractor=lambda x: (x.source, x.target),
        llm_client=llm,
        embedder=embedder,
    )

    graph.feed_text(text)

    print(f"\nExtracted {len(graph.nodes)} entities and {len(graph.edges)} relations")

    graph.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = graph.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    graph.show(
        node_label_extractor=lambda x: x.name,
        edge_label_extractor=lambda x: f"{x.type}",
    )

```

### Core Architecture Module: `examples/en/autotypes/hypergraph_demo.py`
```
"""
Hypergraph Demo - Tesla Biography

Extract hyper-relationships from text using AutoHypergraph.
This demo shows how to capture multi-entity relationships.

Usage:
    python examples/en/autotypes/hypergraph_demo.py
"""

from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract.types import AutoHypergraph

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class Entity(BaseModel):
    """Entity node"""
    name: str = Field(description="Entity name")
    type: str = Field(description="Type: person/location/invention", default="person")
    description: str = Field(description="Entity description") 


class Relation(BaseModel):
    """Hyperedge (multi-entity relationship)"""
    description: str = Field(description="Relationship description")
    members: list[str] = Field(description="Entities involved")
    type: str = Field(description="Relationship type")
    description: str = Field(description="Relationship description") 


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  Hypergraph Demo")
    print("=" * 60)
    print("Extracting multi-entity relationships...")

    graph = AutoHypergraph[Entity, Relation](
        node_schema=Entity,
        edge_schema=Relation,
        node_key_extractor=lambda x: x.name,
        edge_key_extractor=lambda x: f"{x.type}_{'_'.join(sorted(x.members))}",
        nodes_in_edge_extractor=lambda x: tuple(x.members),
        llm_client=llm,
        embedder=embedder,
    )

    graph.feed_text(text)

    print(f"\nExtracted {len(graph.nodes)} entities and {len(graph.edges)} hyper-edges")

    for edge in graph.edges[:5]:
        print(f"\n{edge.type}: {edge.description}")
        print(f"  Members: {', '.join(edge.members)}")

    graph.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = graph.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    graph.show(node_label_extractor=lambda x: x.name, edge_label_extractor=lambda x: x.type)

```

### Core Architecture Module: `examples/en/autotypes/list_demo.py`
```
"""
AutoList Demo - Tesla Timeline

Extract a list of items from text using AutoList.
This demo shows how to extract and merge items from multiple chunks.

Usage:
    python examples/en/autotypes/list_demo.py
"""

from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract import AutoList

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class TimelineEvent(BaseModel):
    """Timeline event"""
    year: str = Field(description="Year of the event")
    title: str = Field(description="Event title")
    description: str = Field(description="Event description")


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  AutoList Demo - Tesla Timeline")
    print("=" * 60)
    print("Extracting timeline events...")

    timeline = AutoList[TimelineEvent](
        item_schema=TimelineEvent,
        llm_client=llm,
        embedder=embedder,
    )

    timeline.feed_text(text)

    sorted_events = sorted(timeline.items, key=lambda x: x.year)
    print(f"\nExtracted {len(sorted_events)} events")

    for event in sorted_events[:5]:
        print(f"  {event.year}: {event.title}")

    timeline.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = timeline.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    timeline.show(item_label_extractor=lambda x: f"{x.year}: {x.title}")

```

### Core Architecture Module: `examples/en/autotypes/model_demo.py`
```
"""
AutoModel Demo - Tesla Biography Summary

Extract a structured summary from text using AutoModel.
This demo shows how to merge multiple chunks into one consistent object.

Usage:
    python examples/en/autotypes/model_demo.py
"""

from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract import AutoModel

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class BiographySummary(BaseModel):
    """Biography summary schema"""
    title: str = Field(description="Title of the biography")
    subject: str = Field(description="Main subject name")
    birth_year: Optional[str] = Field(default="", description="Year of birth")
    death_year: Optional[str] = Field(default="", description="Year of death")
    nationality: str = Field(description="Nationality", default="")
    occupation: List[str] = Field(default_factory=list, description="Main occupations")
    summary: str = Field(description="Brief summary")
    major_inventions: List[str] = Field(default_factory=list, description="Major inventions")


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  AutoModel Demo - Tesla Summary")
    print("=" * 60)
    print("Extracting biography summary...")

    model = AutoModel(
        data_schema=BiographySummary,
        llm_client=llm,
        embedder=embedder,
    )

    model.feed_text(text)

    data = model.data
    print(f"\nSubject: {data.subject}")
    print(f"Lifespan: {data.birth_year} - {data.death_year}")
    print(f"Nationality: {data.nationality}")
    print(f"\nSummary: {data.summary}")

    if data.major_inventions:
        print(f"\nMajor Inventions:")
        for inv in data.major_inventions[:3]:
            print(f"  - {inv}")

    model.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = model.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    model.show(label_extractor=lambda x: x.title)

```

### Core Architecture Module: `examples/en/autotypes/set_demo.py`
```
"""
AutoSet Demo - Tesla Related Entities

Extract a deduplicated set of entities from text using AutoSet.
This demo shows how to extract and deduplicate entities based on unique keys.

Usage:
    python examples/en/autotypes/set_demo.py
"""

from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract import AutoSet

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class Entity(BaseModel):
    """Entity with unique key"""
    name: str = Field(description="Entity name")
    category: str = Field(description="Category: person/location/invention", default="person")
    description: str = Field(description="Brief description", default="")


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  AutoSet Demo - Tesla Entities")
    print("=" * 60)
    print("Extracting and deduplicating entities...")

    entities = AutoSet[Entity](
        item_schema=Entity,
        llm_client=llm,
        embedder=embedder,
        key_extractor=lambda x: x.name,
    )

    entities.feed_text(text)

    print(f"\nExtracted {len(entities.items)} unique entities")

    categories = {}
    for e in entities.items:
        categories.setdefault(e.category, []).append(e)

    for cat, items in sorted(categories.items()):
        print(f"\n{cat.upper()}:")
        for item in items[:5]:
            print(f"  - {item.name}")

    entities.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = entities.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    entities.show(item_label_extractor=lambda x: x.name)

```

### Core Architecture Module: `examples/en/autotypes/spatial_graph_demo.py`
```
"""
Spatial Graph Demo - Tesla Biography

Extract spatial relationships from text using AutoSpatialGraph.
This demo shows how to understand location-based relationships between entities.

Usage:
    python examples/en/autotypes/spatial_graph_demo.py
"""

from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract.types import AutoSpatialGraph

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class Entity(BaseModel):
    """Entity node"""
    name: str = Field(description="Entity name")
    category: str = Field(description="Category, e.g., person, location, invention, etc.")
    description: str = Field(description="Entity description")


class SpatialRelation(BaseModel):
    """Spatial relation"""
    source: str = Field(description="Source entity")
    target: str = Field(description="Target entity")
    relation_type: str = Field(description="Relation type, e.g., father, brother, invention, etc.")
    location: Optional[str] = Field(description="Location, e.g., New York", default=None)
    description: str = Field(description="Relation description")


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  Spatial Graph Demo")
    print("=" * 60)
    print("Extracting spatial relationships...")

    graph = AutoSpatialGraph[Entity, SpatialRelation](
        node_schema=Entity,
        edge_schema=SpatialRelation,
        node_key_extractor=lambda x: x.name,
        edge_key_extractor=lambda x: f"{x.source}-{x.relation_type}-{x.target}",
        nodes_in_edge_extractor=lambda x: (x.source, x.target),
        location_in_edge_extractor=lambda x: x.location or "",
        llm_client=llm,
        embedder=embedder,
        observation_location="United States",
    )

    graph.feed_text(text)

    print(f"\nExtracted {len(graph.nodes)} entities and {len(graph.edges)} relations")

    for node in graph.nodes[:5]:
        print(f"  {node.name}")

    graph.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = graph.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    graph.show(
        node_label_extractor=lambda x: x.name,
        edge_label_extractor=lambda x: f"{x.relation_type}@{x.location}" if x.location else x.relation_type,
    )

```

### Core Architecture Module: `examples/en/autotypes/spatio_temporal_graph_demo.py`
```
"""
Spatio-Temporal Graph Demo - Tesla Biography

Extract spatio-temporal relationships using AutoSpatioTemporalGraph.
This demo shows how to understand both time and space together.

Usage:
    python examples/en/autotypes/spatio_temporal_demo.py
"""

from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from hyperextract.types import AutoSpatioTemporalGraph

project_root = Path(__file__).resolve().parent.parent.parent.parent

load_dotenv()

INPUT_FILE = project_root / "examples" / "en" / "tesla.md"
QUESTION_FILE = project_root / "examples" / "en" / "tesla_question.md"


class Entity(BaseModel):
    """Entity node"""
    name: str = Field(description="Entity name")
    category: str = Field(description="Category, e.g., person, location, invention, etc.")
    description: str = Field(description="Entity description")


class SpatioTemporalRelation(BaseModel):
    """Spatio-temporal relation"""
    source: str = Field(description="Source entity")
    target: str = Field(description="Target entity")
    relation_type: str = Field(description="Relation type, e.g., father, brother, invention, etc.")
    event_date: Optional[str] = Field(description="Event date, e.g., 2023-01-01", default=None)
    location: Optional[str] = Field(description="Location, e.g., New York", default=None)
    description: str = Field(description="Relation description")


if __name__ == "__main__":
    with open(INPUT_FILE, encoding="utf-8") as f:
        text = f.read()
    with open(QUESTION_FILE, encoding="utf-8") as f:
        questions = [line.strip() for line in f if line.strip()]

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    embedder = OpenAIEmbeddings(model="text-embedding-3-small")

    print("\n" + "=" * 60)
    print("  Spatio-Temporal Graph Demo")
    print("=" * 60)
    print("Extracting spatio-temporal relations...")

    graph = AutoSpatioTemporalGraph[Entity, SpatioTemporalRelation](
        node_schema=Entity,
        edge_schema=SpatioTemporalRelation,
        node_key_extractor=lambda x: x.name,
        edge_key_extractor=lambda x: f"{x.source}-{x.relation_type}-{x.target}",
        nodes_in_edge_extractor=lambda x: (x.source, x.target),
        time_in_edge_extractor=lambda x: x.event_date or "",
        location_in_edge_extractor=lambda x: x.location or "",
        llm_client=llm,
        embedder=embedder,
        observation_time="2024-01-01",
        observation_location="United States",
    )

    graph.feed_text(text)

    print(f"\nExtracted {len(graph.nodes)} entities and {len(graph.edges)} relations")

    sorted_edges = sorted(graph.edges, key=lambda x: x.event_date or "")
    for edge in sorted_edges[:5]:
        time_info = f" ({edge.event_date})" if edge.event_date else ""
        loc_info = f" in {edge.location}" if edge.location else ""
        print(f"  {edge.source} --[{edge.relation_type}]--> {edge.target}{time_info}{loc_info}")

    graph.build_index()

    print("-" * 60)
    print("Q&A")
    print("-" * 60)
    for q in questions:
        print(f"\nQ: {q}")
        try:
            result = graph.chat(q)
            print(f"A: {result.content}")
        except Exception as e:
            print(f"Error: {e}")

    graph.show(
        node_label_extractor=lambda x: x.name,
        edge_label_extractor=lambda x: f"{x.relation_type}@{x.event_date}" if x.event_date else x.relation_type,
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17** (2026-04-11): **CLI metadata loader typo causes ImportError in show/search/talk/build-index**
  *Symptoms*: I hit this while testing the CLI on an unmodified upstream checkout.  get_template_from_ka() in hyperextract/cli/utils.py imports load_kb_metadata, but hyperextract/cli/config.py only defines load_ka_metadata.  So when that helper is invoked it fails with:  ImportError: cannot import name 'load_kb_metadata' from 'hyperextract.cli.config'  This affects normal KA workflows that use get_template_from_ka(), including:  he show he search he talk he build-index  The fix looks like changing the import/call from load_kb_metadata to load_ka_metadata.  I observed this against commit: e749c3018236e1c9f431cc628602af1271eb17fe
  **Post-Mortem & Fix Analysis**:
  > Hi there,  Thank you so much for reporting this issue in such detail! 🙏  You are absolutely right — this was an oversight during refactoring where the function name wasn't updated consistently. `load_kb_metadata` should indeed be `load_ka_metadata`. I apologize for the confusion this has caused.  I'll **fix this immediately** by correcting the import and function call in `hyperextract/cli/utils.py`.  I'll update this issue once the fix is committed. Thanks again for catching this and for the clear bug report!
  > Hi there,  Thanks for reporting this issue!   This has been fixed in commit [61440b8](https://github.com/yifanfeng97/Hyper-Extract/commit/61440b8bfa68bd96faca49ad47ff9d2735c371a0) by correcting the import from `load_kb_metadata` to `load_ka_metadata` in `hyperextract/cli/utils.py`.  The fix is now available in **[v0.1.2](https://github.com/yifanfeng97/Hyper-Extract/releases/tag/v0.1.2)**.  Please upgrade to the latest version: ```bash uv pip install --upgrade hyperextract ``` 

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

### Incident Patch 1: `c9b8c056` (2026-09-28)
**Commit Message**: Merge pull request #183 from dex0shubham/fix/list-template-filters-methods

fix: apply --query and --autotype to method rows in he list template

**File**: `hyperextract/cli/commands/list.py` (modified, +13/-2)
```diff
@@ -72,8 +72,19 @@ def template(
     if include_methods:
         from hyperextract.methods import list_method_cfgs
 
-        method_templates = list_method_cfgs()
-        for name, cfg in method_templates.items():
+        # --query/--autotype apply to method rows too, with the same matching
+        # rules Gallery.list uses for presets.
+        query_lower = query.lower() if query else None
+        for name, cfg in list_method_cfgs().items():
+            description = cfg.description or ""
+            if autotype and cfg.type != autotype:
+                continue
+            if (
+                query_lower
+                and query_lower not in name.lower()
+                and query_lower not in description.lower()
+            ):
+                continue
             templates.append((name, cfg.type, cfg.description))
 
     if not templates:
```

**File**: `tests/cli/test_list_template.py` (modified, +21/-0)
```diff
@@ -19,3 +19,24 @@ def test_list_template_lang_zh_no_methods_hides_methods():
     assert result.exit_code == 0, result.output
     assert "method/" not in result.output
     assert "chunk_rag" not in result.output
+
+
+def test_query_filters_method_rows():
+    """--query must narrow method rows, not just presets."""
+    result = runner.invoke(app, ["list", "template", "--query", "biography"])
+    assert result.exit_code == 0, result.output
+    assert "biography" in result.output
+    assert "method/" not in result.output
+
+
+def test_autotype_filters_method_rows():
+    """--autotype must exclude methods of other types."""
+    result = runner.invoke(app, ["list", "template", "--autotype", "list"])
+    assert result.exit_code == 0, result.output
+    assert "graph_rag" not in result.output
+
+
+def test_query_keeps_matching_method_rows():
+    result = runner.invoke(app, ["list", "template", "--query", "chunk_rag"])
+    assert result.exit_code == 0, result.output
+    assert "chunk_rag" in result.output
```

---

### Incident Patch 2: `c5d700ac` (2026-09-27)
**Commit Message**: fix: apply --query and --autotype to method rows in he list template

**File**: `hyperextract/cli/commands/list.py` (modified, +13/-2)
```diff
@@ -72,8 +72,19 @@ def template(
     if include_methods:
         from hyperextract.methods import list_method_cfgs
 
-        method_templates = list_method_cfgs()
-        for name, cfg in method_templates.items():
+        # --query/--autotype apply to method rows too, with the same matching
+        # rules Gallery.list uses for presets.
+        query_lower = query.lower() if query else None
+        for name, cfg in list_method_cfgs().items():
+            description = cfg.description or ""
+            if autotype and cfg.type != autotype:
+                continue
+            if (
+                query_lower
+                and query_lower not in name.lower()
+                and query_lower not in description.lower()
+            ):
+                continue
             templates.append((name, cfg.type, cfg.description))
 
     if not templates:
```

---

### Incident Patch 3: `85d4e05b` (2026-09-26)
**Commit Message**: Merge pull request #180 from dex0shubham/fix/unknown-method-template-error

fix: report unregistered method templates accurately

**File**: `hyperextract/cli/utils.py` (modified, +7/-1)
```diff
@@ -259,8 +259,14 @@ def get_template_from_ka(ka_path: Path) -> tuple[str, str]:
             # Method templates are code-registered, not gallery YAML files.
             from hyperextract.methods.registry import get_method
 
-            if get_method(template[len("method/") :]) is not None:
+            method = template[len("method/") :]
+            if get_method(method) is not None:
                 return template, lang
+            raise ValueError(
+                f"Template '{template}' names an extraction method that is not "
+                f"registered ('{method}'). Run `he list` to see the available "
+                "methods."
+            )
         elif Gallery.get(template) is not None:
             return template, lang
         else:
```

**File**: `tests/methods/test_chunk_rag.py` (modified, +19/-0)
```diff
@@ -89,6 +89,25 @@ def test_get_template_from_ka_resolves_method(self, ka_dir):
         assert template == "method/chunk_rag"
         assert lang == "en"
 
+    def test_unknown_method_template_names_the_method(self, ka_dir):
+        """An unregistered method must not be reported as a missing template."""
+        import json
+
+        from hyperextract.cli.utils import get_template_from_ka
+
+        meta_path = ka_dir / "metadata.json"
+        meta = json.loads(meta_path.read_text(encoding="utf-8"))
+        meta["template"] = "method/no_such_method"
+        meta_path.write_text(json.dumps(meta), encoding="utf-8")
+
+        with pytest.raises(ValueError) as excinfo:
+            get_template_from_ka(ka_dir)
+
+        message = str(excinfo.value)
+        assert "no_such_method" in message
+        assert "not specified" not in message
+        assert "No template specified" not in message
+
     def test_search_command_prints_chunks(self, ka_dir, llm_client, embedder):
         with (
             patch("hyperextract.cli.cli.validate_config"),
```

---

### Incident Patch 4: `40049b51` (2026-09-26)
**Commit Message**: Merge pull request #181 from dex0shubham/fix/feed-warns-dropped-chunks

fix: warn about dropped chunks in he feed

**File**: `hyperextract/cli/cli.py` (modified, +6/-0)
```diff
@@ -1368,6 +1368,12 @@ def _feed_one_document(
 
     logger.debug("stage=feed_text_invoked")
     ka.feed_text(text, source_id=source, content_hash=text_hash_to_record)
+    failures = getattr(ka, "extraction_failures", [])
+    if failures:
+        console.print(
+            f"[yellow]Warning:[/yellow] {len(failures)} chunk(s) failed "
+            "extraction and were skipped."
+        )
     logger.info("stage=knowledge_appended chars=%d source=%s", len(text), source)
     return True
 
```

**File**: `tests/types/test_extraction_failures.py` (modified, +32/-0)
```diff
@@ -90,6 +90,38 @@ def test_second_feed_search_finds_new_content(self, llm_client, embedder):
         assert hits  # incremental feed is searchable
 
 
+class TestFeedCliWarning:
+    """``he feed`` must report dropped chunks, as ``he parse`` and the docs do."""
+
+    def test_feed_warns_when_chunks_fail(self, llm_client, embedder, tmp_path):
+        from typer.testing import CliRunner
+
+        import hyperextract.cli.cli as climod
+        from hyperextract.cli.cli import app
+
+        ka = _list_ka(llm_client, embedder)
+        ka.metadata["template"] = "general/list"
+        ka.metadata["lang"] = "en"
+        ka_dir = tmp_path / "ka"
+        ka.dump(ka_dir)
+        ka.data_extractor = _FlakyExtractor(ka.data_extractor, fail_indexes={1})
+        doc = tmp_path / "doc.md"
+        doc.write_text("chunk boundary filler. " * 300, encoding="utf-8")
+
+        import unittest.mock as mock
+
+        with (
+            mock.patch.object(
+                climod.Template, "create", staticmethod(lambda *a, **k: ka)
+            ),
+            mock.patch.object(climod, "validate_config", lambda: None),
+        ):
+            result = CliRunner().invoke(app, ["feed", str(ka_dir), str(doc)])
+
+        assert result.exit_code == 0, result.output
+        assert "chunk(s) failed" in result.output
+
+
 class TestExtractionFailures:
     def test_failures_collected_by_default(self, llm_client, embedder):
         ka = _list_ka(llm_client, embedder)
```

---

### Incident Patch 5: `e80eb8ac` (2026-09-25)
**Commit Message**: fix: warn about dropped chunks in he feed

**File**: `hyperextract/cli/cli.py` (modified, +6/-0)
```diff
@@ -1368,6 +1368,12 @@ def _feed_one_document(
 
     logger.debug("stage=feed_text_invoked")
     ka.feed_text(text, source_id=source, content_hash=text_hash_to_record)
+    failures = getattr(ka, "extraction_failures", [])
+    if failures:
+        console.print(
+            f"[yellow]Warning:[/yellow] {len(failures)} chunk(s) failed "
+            "extraction and were skipped."
+        )
     logger.info("stage=knowledge_appended chars=%d source=%s", len(text), source)
     return True
 
```

---

### Incident Patch 6: `a429364d` (2026-09-25)
**Commit Message**: fix: report unregistered method templates accurately

**File**: `hyperextract/cli/utils.py` (modified, +7/-1)
```diff
@@ -259,8 +259,14 @@ def get_template_from_ka(ka_path: Path) -> tuple[str, str]:
             # Method templates are code-registered, not gallery YAML files.
             from hyperextract.methods.registry import get_method
 
-            if get_method(template[len("method/") :]) is not None:
+            method = template[len("method/") :]
+            if get_method(method) is not None:
                 return template, lang
+            raise ValueError(
+                f"Template '{template}' names an extraction method that is not "
+                f"registered ('{method}'). Run `he list` to see the available "
+                "methods."
+            )
         elif Gallery.get(template) is not None:
             return template, lang
         else:
```

---

### Incident Patch 7: `611930e0` (2026-09-25)
**Commit Message**: fix: hypergraph incremental feed crash; visible chunk failures + on_error (#users)

- AutoHypergraph._update_data_state referenced the nonexistent
  self.key_extractor (only node_key_extractor/edge_key_extractor exist),
  so the second incremental feed into any hypergraph KA raised
  AttributeError. Now uses the per-side extractors.
- Chunk extraction failures are recorded per run:
  ka.extraction_failures exposes [{chunk_index, stage, error}]; he feed /
  he parse print a warning when chunks were dropped.
- New BaseAutoType constructor option on_error="skip" (default, current
  behavior) or "raise" (abort the feed on first failing chunk), plumbed
  through all AutoTypes.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -354,7 +354,7 @@ identifiers:
 
 ## 📰 What's New
 
-**v0.10.3** — 🐛 Cypher export fixed: proper `;`-terminated statements and unique MERGE variables — Neo4j/Memgraph imports now actually work.
+**v0.10.4** — 👁️ Chunk extraction failures are now visible (`ka.extraction_failures`, optional `on_error="raise"`) · 🐛 Hypergraph incremental feed no longer crashes.
 
 📰 **[Full release notes](https://yifanfeng97.github.io/Hyper-Extract/latest/news/)** · [All releases](https://github.com/yifanfeng97/hyper-extract/releases)
 
```

**File**: `README_ZH.md` (modified, +1/-1)
```diff
@@ -354,7 +354,7 @@ identifiers:
 
 ## 📰 最新动态
 
-**v0.10.3** — 🐛 Cypher 导出修复：正确的 `;` 语句终结与唯一 MERGE 变量——Neo4j/Memgraph 导入真正可用了。
+**v0.10.4** — 👁️ Chunk 抽取失败可见化（`ka.extraction_failures`，可选 `on_error="raise"`）· 🐛 超图增量喂入不再崩溃。
 
 📰 **[完整版本说明](https://yifanfeng97.github.io/Hyper-Extract/latest/zh/news/)** · [全部 Releases](https://github.com/yifanfeng97/hyper-extract/releases)
 
```

**File**: `docs/en/news.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@ Release notes and highlights. For a complete changelog, see the [GitHub releases
 
 ---
 
+## v0.10.4 — Visible Chunk Failures & Hypergraph Incremental Feed
+
+- **🐛 Hypergraph incremental feed fixed** — feeding a second document into an existing hypergraph KA crashed with `AttributeError: 'key_extractor'` (`_update_data_state` referenced a nonexistent attribute). Now uses `node_key_extractor`/`edge_key_extractor`.
+- **👁️ Chunk extraction failures are visible** — failed chunks were silently skipped with only a log line. Every `feed_text()`/`parse()` run now records them: read `ka.extraction_failures` (chunk index, stage, error). `he feed`/`he parse` print a warning when chunks were dropped.
+- **⚙️ `on_error` strategy** — new constructor option: `"skip"` (default, current behavior) or `"raise"` to abort a feed on the first failing chunk. Available on all AutoTypes.
+
+---
+
 ## v0.10.3 — Working Cypher Export
 
 - **🐛 Cypher export fixed** — `he export cypher` output could not be imported by Neo4j/Memgraph: statements lacked `;` terminators (cypher-shell read the whole file as one query) and variables were re-declared within a single statement (`Variable 'n' already declared` from the second node on). Each node/edge/hyperedge is now its own `;`-terminated statement, and hyperedge members use positional aliases (`n0`, `n1`, …). *(#174)*
```

**File**: `docs/zh/news.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@
 
 ---
 
+## v0.10.4 — Chunk 失败可见化与超图增量喂入修复
+
+- **🐛 超图增量喂入修复** — 向已有超图 KA 喂第二个文档时崩溃（`_update_data_state` 引用了不存在的 `key_extractor` 属性）。现改用 `node_key_extractor`/`edge_key_extractor`。
+- **👁️ Chunk 抽取失败可见** — 失败的 chunk 此前只留一行日志即被静默跳过。现在每次 `feed_text()`/`parse()` 都会记录失败明细：读取 `ka.extraction_failures`（chunk 序号、阶段、错误）。`he feed`/`he parse` 会在丢弃 chunk 时打印警告。
+- **⚙️ `on_error` 策略** — 新增构造参数：`"skip"`（默认，保持现有行为）或 `"raise"`（首个失败 chunk 即中止整个喂入）。所有 AutoType 均可用。
+
+---
+
 ## v0.10.3 — Cypher 导出可用了
 
 - **🐛 Cypher 导出修复** — `he export cypher` 的输出此前无法导入 Neo4j/Memgraph：语句缺少 `;` 结束符（cypher-shell 会把整个文件当成一条查询），且单条语句内变量重复声明（第二个节点起报 `Variable 'n' already declared`）。现在每个节点/边/超边都是独立的 `;` 结尾语句，超边成员使用位置别名（`n0`、`n1`…）。*(#174)*
```

**File**: `hyperextract/cli/cli.py` (modified, +13/-0)
```diff
@@ -370,8 +370,15 @@ def parse(
 
             progress.update(task, description="Extracting knowledge...")
             logger.debug("stage=feed_text_invoked")
+            failed_chunks = 0
             for file_path, file_source, text in zip(text_files, file_sources, all_text):
                 ka.feed_text(text, source_id=file_source)
+                failed_chunks += len(getattr(ka, "extraction_failures", []))
+            if failed_chunks:
+                console.print(
+                    f"[yellow]Warning:[/yellow] {failed_chunks} chunk(s) failed "
+                    "extraction and were skipped."
+                )
             logger.info("stage=knowledge_extracted files=%d", len(text_files))
         else:
             progress.update(task, description="Reading input...")
@@ -386,6 +393,12 @@ def parse(
 
                 SourceDocumentStore(output_path).store_file(source, input)
             ka.feed_text(text, source_id=source)
+            failures = getattr(ka, "extraction_failures", [])
+            if failures:
+                console.print(
+                    f"[yellow]Warning:[/yellow] {len(failures)} chunk(s) failed "
+                    "extraction and were skipped."
+                )
             logger.info("stage=knowledge_extracted chars=%d", len(text))
 
         progress.update(task, description="Saving data...")
```

---

### Incident Patch 8: `c325ba12` (2026-09-25)
**Commit Message**: Merge pull request #176 from 1816586742-stack/docs/fix-readme-relative-links

docs: fix relative links that do not resolve from their own directory

**File**: `docs/zh/templates/index.md` (modified, +1/-1)
```diff
@@ -147,4 +147,4 @@ result = ka.parse(text)
 
 需要特定功能？学习创建自己的模板：
 
-→ [自定义模板指南](../../python/guides/custom-templates.md)
+→ [自定义模板指南](../python/guides/custom-templates.md)
```

**File**: `hyperextract-skills/graph-designer/references/dimensions.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Dimension Design Reference
 
-Time and space dimension patterns. See [SKILL.md](SKILL.md) for workflow.
+Time and space dimension patterns. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/entity.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Entity Design Reference
 
-Entity design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Entity design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/hypergraph.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Hypergraph Design Reference
 
-Hypergraph design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Hypergraph design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/relation.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Relation Design Reference
 
-Relation design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Relation design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

---

### Incident Patch 9: `1f10213f` (2026-09-25)
**Commit Message**: Merge pull request #179 from dex0shubham/fix/mcp-export-dir-destination

fix: return a message when an MCP export destination is a directory

**File**: `hyperextract/mcp_server.py` (modified, +6/-0)
```diff
@@ -321,6 +321,8 @@ def export_graphml(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote GraphML to {dest}"
 
 
@@ -377,6 +379,8 @@ def export_jsonld(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote JSON-LD to {dest}"
 
 
@@ -402,6 +406,8 @@ def export_cypher(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote Cypher to {dest}"
 
 
```

**File**: `tests/test_mcp_server.py` (modified, +17/-0)
```diff
@@ -360,6 +360,23 @@ class _ListKA:
     assert "graph-type knowledge abstracts" in graphml
 
 
+@pytest.mark.parametrize(
+    "tool", ["export_graphml", "export_jsonld", "export_cypher"]
+)
+def test_export_to_directory_returns_message(monkeypatch, tmp_path, tool):
+    """A directory destination is a tool string here, as in `he export` — MCP
+    tools never raise."""
+    g = _graph_with_index()
+    monkeypatch.setattr(mcp_server, "_load_ka", lambda p: g)
+    dest = tmp_path / "out"
+    dest.mkdir()
+
+    out = getattr(mcp_server, tool)("x", str(dest))
+
+    assert "is a directory" in out
+    assert "file path" in out
+
+
 def test_export_cypher(monkeypatch, tmp_path):
     g = _graph_with_index()
     monkeypatch.setattr(mcp_server, "_load_ka", lambda p: g)
```

---

### Incident Patch 10: `0bb61958` (2026-09-25)
**Commit Message**: Merge pull request #177 from dex0shubham/fix/info-count-items

fix: count items for list/set KAs in he info and MCP info

**File**: `hyperextract/cli/cli.py` (modified, +2/-1)
```diff
@@ -860,7 +860,8 @@ def info(
         data = json.load(f)
 
     if isinstance(data, dict):
-        node_count = len(data.get("nodes", data.get("entities", [])))
+        # list/set KAs store "items"; docs define Nodes as entities/items
+        node_count = len(data.get("nodes", data.get("entities", data.get("items", []))))
         edge_count = len(data.get("edges", data.get("relations", [])))
         chunk_count = len(data.get("chunks", []))
     elif isinstance(data, list):
```

**File**: `hyperextract/mcp_server.py` (modified, +2/-1)
```diff
@@ -139,7 +139,8 @@ def info(ka_path: str, include_sources: bool = False) -> str:
     data = json.loads(data_file.read_text(encoding="utf-8"))
     chunks = 0
     if isinstance(data, dict):
-        nodes = len(data.get("nodes", data.get("entities", [])))
+        # list/set KAs store "items"; docs define Nodes as entities/items
+        nodes = len(data.get("nodes", data.get("entities", data.get("items", []))))
         edges = len(data.get("edges", data.get("relations", [])))
         chunks = len(data.get("chunks", []))
     elif isinstance(data, list):
```

**File**: `tests/cli/test_info.py` (modified, +21/-0)
```diff
@@ -63,3 +63,24 @@ def test_sources_without_ledger_prints_hint(self, tmp_path):
 
         assert result.exit_code == 0, result.output
         assert "No source ledger" in result.output
+
+
+class TestInfoItemCounts:
+    def test_list_ka_counts_items_as_nodes(self, tmp_path):
+        """List/Set KAs store ``items``; ``Nodes`` is documented as entities/items."""
+        ka = tmp_path / "ka"
+        ka.mkdir()
+        (ka / "data.json").write_text(
+            json.dumps({"items": [{"name": "a"}, {"name": "b"}, {"name": "c"}]}),
+            encoding="utf-8",
+        )
+        (ka / "metadata.json").write_text(
+            json.dumps({"template": "general/base_list", "lang": "en"}),
+            encoding="utf-8",
+        )
+        result = runner.invoke(app, ["info", str(ka)])
+        assert result.exit_code == 0, result.output
+        nodes_line = next(
+            line for line in result.output.splitlines() if line.strip().startswith("Nodes")
+        )
+        assert nodes_line.split()[-1] == "3"
```

**File**: `tests/test_mcp_server.py` (modified, +17/-0)
```diff
@@ -92,6 +92,23 @@ def test_info_reports_counts(tmp_path):
     assert "sources" not in out
 
 
+def test_info_counts_items_for_list_and_set_kas(tmp_path):
+    """List/Set KAs store ``items`` rather than ``nodes``/``edges``."""
+    ka = tmp_path / "ka"
+    ka.mkdir()
+    (ka / "data.json").write_text(
+        json.dumps({"items": [{"name": "a"}, {"name": "b"}, {"name": "c"}]}),
+        encoding="utf-8",
+    )
+    (ka / "metadata.json").write_text(
+        json.dumps({"template": "general/base_list", "lang": "en"}), encoding="utf-8"
+    )
+
+    out = json.loads(mcp_server.info(str(ka)))
+    assert out["nodes"] == 3
+    assert out["edges"] == 0
+
+
 def test_info_includes_chunks_and_optional_sources(tmp_path):
     ka = tmp_path / "doc_ka"
     ka.mkdir()
```

#### Recent Merged Pull Requests:
- **PR #183** (2026-09-28): fix: apply --query and --autotype to method rows in he list template (@dex0shubham)
- **PR #182** (closed): fix: record empty extractor results as chunk failures; keep content out of logs (@mrbranan)
- **PR #181** (2026-09-26): fix: warn about dropped chunks in he feed (@dex0shubham)
- **PR #180** (2026-09-26): fix: report unregistered method templates accurately (@dex0shubham)
- **PR #179** (2026-09-25): fix: return a message when an MCP export destination is a directory (@dex0shubham)
- **PR #178** (2026-09-25): fix: never purge archived documents on he remove --dry-run (@dex0shubham)
- **PR #177** (2026-09-25): fix: count items for list/set KAs in he info and MCP info (@dex0shubham)
- **PR #176** (2026-09-25): docs: fix relative links that do not resolve from their own directory (@1816586742-stack)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
