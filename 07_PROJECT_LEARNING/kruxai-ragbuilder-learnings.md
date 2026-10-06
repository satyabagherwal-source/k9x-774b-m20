# Forensic Learning Record (Deep Inspection): KruxAI/ragbuilder

> **Canonical Artifact**: `07_PROJECT_LEARNING/kruxai-ragbuilder-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KruxAI/ragbuilder](https://github.com/KruxAI/ragbuilder))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:09:58.018Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KruxAI/ragbuilder`
- **Description**: A toolkit to create optimal Production-readyRetrieval Augmented Generation(RAG) setup for your data
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1538 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `byor/__init__.py`
```
# Minimal initialization for the package
# You might leave this empty, or you could dynamically load modules here 
# but don't execute any logic.

# For example, to dynamically load modules you could:
import os
import importlib

module_dir = os.path.dirname(__file__)

for filename in os.listdir(module_dir):
    if filename.endswith('.py') and filename != '__init__.py':
        module_name = filename[:-3]
        importlib.import_module(f'.{module_name}', package=__name__)

```

### Core Architecture Module: `byor/myrag.py`
```
from langchain_community.llms import Ollama
from langchain_community.document_loaders import WebBaseLoader
from langchain_community.embeddings import OllamaEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from operator import itemgetter
from langchain import hub
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableParallel, RunnableLambda
from langchain.retrievers import MergerRetriever
from langchain.retrievers.document_compressors import DocumentCompressorPipeline

def rag_pipeline():
    try:
        def format_docs(docs):
            return "\\n".join(doc.page_content for doc in docs) 
        
        llm = Ollama(model='llama3.1:latest',base_url='http://localhost:11434')
        
        loader = WebBaseLoader('https://ashwinaravind.github.io/')
        docs = loader.load()
        
        embedding = OllamaEmbeddings(model='mxbai-embed-large:latest',base_url='http://localhost:11434')
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=1600, chunk_overlap=200)
        splits=splitter.split_documents(docs)
        c=Chroma.from_documents(documents=splits, embedding=embedding, collection_name='testindex-ragbuilder',)
        retrievers=[]
        retriever=c.as_retriever(search_type='similarity', search_kwargs={'k': 5})
        retrievers.append(retriever)
        retriever=MergerRetriever(retrievers=retrievers)
        prompt = hub.pull("rlm/rag-prompt")
        rag_chain = (
            RunnableParallel(context=retriever, question=RunnablePassthrough())
                .assign(context=itemgetter("context") | RunnableLambda(format_docs))
                .assign(answer=prompt | llm | StrOutputParser())
                .pick(["answer", "context"]))
        return rag_chain
    except Exception as e:
        print(f"An error occurred: {e}")

```

### Core Architecture Module: `demo/Friends/friends_golden_data_generator.py`
```
import logging
from dataclasses import dataclass
from pathlib import Path
import typing as t
import re
import pandas as pd
import numpy as np
from tqdm import tqdm
from sklearn.metrics.pairwise import cosine_similarity
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import json
import copy

from ragas.testset import TestsetGenerator, TestsetSample, Testset
from ragas.testset.synthesizers import default_query_distribution
from ragas.testset.persona import Persona
from ragas.testset.graph import KnowledgeGraph, Node, NodeType
from ragas.testset.transforms.extractors import NERExtractor, SummaryExtractor, ThemesExtractor, EmbeddingExtractor
from ragas.embeddings.base import BaseRagasEmbeddings
from ragas.llms.base import BaseRagasLLM

from openai import OpenAI, RateLimitError, APIError
from nemo_curator import OpenAIClient
from ragas.testset.transforms import apply_transforms, Parallel
from ragas.testset.transforms.relationship_builders.traditional import JaccardSimilarityBuilder
from ragas.testset.synthesizers import SingleHopSpecificQuerySynthesizer
from ragas.testset.synthesizers.multi_hop import (
    MultiHopAbstractQuerySynthesizer,
    MultiHopSpecificQuerySynthesizer
)
from ragas.testset.transforms.relationship_builders.traditional import OverlapScoreBuilder
from ragas.testset.transforms.relationship_builders.cosine import SummaryCosineSimilarityBuilder
from ragas.testset.transforms.filters import CustomNodeFilter
from ragas.run_config import RunConfig
from ragas.testset.synthesizers.single_hop.prompts import QueryAnswerGenerationPrompt as SingleHopPrompt
from ragas.testset.synthesizers.multi_hop.prompts import QueryAnswerGenerationPrompt as MultiHopPrompt


logger = logging.getLogger(__name__)

run_config = RunConfig(
    timeout=180,
    max_retries=10,
    max_wait=60,
    exception_types=(Exception, RateLimitError), 
    log_tenacity=True 
)

@dataclass
class SyntheticDataConfig:
    """Configuration for synthetic data generation"""
    initial_testset_size: int = 10
    quality_threshold: float = 1.5  # Minimum average score to keep a Q&A pair
    semantic_similarity_threshold: float = 0.85  # Threshold for deduplication
    batch_size: int = 10
    cache_dir: Path = Path("cache")
    reward_model_name: str = "nvidia/nemotron-4-340b-reward"
    output_dir: Path = Path("output")

@dataclass
class EvaluatedSample:
    """Wrapper class to hold TestsetSample with its evaluation metrics"""
    sample: TestsetSample
    scores: dict
    avg_score: float

    @property
    def question(self) -> str:
        return self.sample.eval_sample.user_input
        
    @property
    def answer(self) -> str:
        return self.sample.eval_sample.reference

    def to_dict(self) -> dict:
        """Convert to dictionary for DataFrame creation"""
        return {
            "question": self.question,
            "answer": self.answer,
            "synthesizer": self.sample.synthesizer_name,
            "avg_score": self.avg_score,
            **self.scores  # Unpack individual scores
        }

def parse_episode_info(filename: str) -> tuple[int, list[int]]:
    """Extract season and episode numbers from filename"""
    # Remove file extension
    filename = Path(filename).stem
    
    # Extract season number (first two digits)
    season = int(filename[:2])
    
    # Extract episode number(s)
    episode_part = filename[2:]
    episodes = []
    
    # Handle multi-episode files (e.g., "0212-0213")
    if '-' in episode_part:
        start, end = episode_part.split('-')
        episodes = list(range(int(start), int(end) + 1))
    else:
        episodes = [int(episode_part)]
        
    return season, episodes

@dataclass
class RLConfig:
    """Configuration for RL loop"""
    num_iterations: int = 3
    min_samples_per_iteration: int = 10
    exemplar_score_threshold: float = 1.6
    max_exemplars_per_iteration: int = 3
#     exemplar_template: str = """
# High-quality example Q&A pairs to learn from:

# {exemplars}

# Additional Instructions:
# 1. Learn from the style and depth of these examples
# 2. Focus on {focus_area} while maintaining similar quality
# 3. Ensure questions are diverse and non-repetitive
# 4. Maintain factual accuracy based on the show's content
# """
    exemplar_template: str = """
High-quality example Q&A pairs to learn from:

{exemplars}

Additional Instructions:
1. Learn from the style and depth of these examples
2. Ensure questions are diverse and non-repetitive
3. Maintain factual accuracy based on the show's content
"""

class RAGSyntheticDataGenerator:
    def __init__(
        self,
        llm: BaseRagasLLM,
        embedding_model: BaseRagasEmbeddings,
        reward_api_key: str,
        config: SyntheticDataConfig = None,
        rl_config: RLConfig = None
    ):
        self.llm = llm
        self.embedding_model = embedding_model
        self.config = config or SyntheticDataConfig()
        self.rl_config = rl_config or RLConfig()

        self.ner_extractor = NERExtractor(
            llm=llm,
            max_num_entities=15
        )
        
        # Initialize reward model client
        self.reward_client = OpenAIClient(
            OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=reward_api_key,
            )
        )
        
        # Create directories
        self.config.cache_dir.mkdir(parents=True, exist_ok=True)
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.multi_hop_distribution = [
            (MultiHopAbstractQuerySynthesizer(llm=self.llm), 0.4),
            (MultiHopSpecificQuerySynthesizer(llm=self.llm), 0.4),
            (SingleHopSpecificQuerySynthesizer(llm=self.llm), 0.2)
        ]
        
        # Store original prompts
        self.single_hop_prompt = SingleHopPrompt()
        self.multi_hop_prompt = MultiHopPrompt()
        
    def load_transcripts(self, transcript_dir: Path) -> t.List[dict]:
        """Load transcripts from directory"""
        logger.info(f"Loading transcripts from {transcript_dir}")
        transcripts = []
        
        for file_path in tqdm(list(transcript_dir.glob("*.txt"))):
            # Parse season and episode info from filename
            season, episodes = parse_episode_info(file_path.name)
            
            # Read transcript
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Create transcript entry
            transcripts.append({
                "content": content,
                "season": season,
                "episodes": episodes,
                "filename": file_path.name
            })
            
        logger.info(f"Loaded {len(transcripts)} transcripts")
        return transcripts
        
    async def build_knowledge_graph(self, transcripts: list[dict]) -> KnowledgeGraph:
        """Build knowledge graph with relationships for multi-hop queries"""
        logger.info("Building knowledge graph...")
        kg = KnowledgeGraph()
        
        # Create nodes with additional properties
        for transcript in tqdm(transcripts, desc="Creating nodes"):
            node = Node(
                type=NodeType.DOCUMENT,
                properties={
                    "page_content": transcript["content"],
                    "season": transcript["season"],
                    "episode": transcript["episodes"],
                    "filename": transcript["filename"]
                }
            )
            kg.nodes.append(node)
        
        # Define transforms 
        transforms=[
            # 1. Extract core properties
            Parallel(
                NERExtractor(llm=self.llm, max_num_entities=25),
                SummaryExtractor(llm=self.llm)
            ),
            
            # 2. Generate embeddings from summaries
            EmbeddingExtractor(
                embed_property_name="summary", 
                property_name="summary_embedding", 
                embedding_model=self.embedding_model
            ),
            
            # 3. Extract themes
            ThemesExtractor(llm=self.llm),
            
            # 4. Build relationships
            Parallel(
                OverlapScoreBuilder(
                    property_name="entities",
                    distance_threshold=0.75,
                    threshold=0.01,
                    filter_nodes=lambda node: bool(node.get_property("entities"))
                ),
                SummaryCosineSimilarityBuilder(
                    property_name="summary_embedding",
                    new_property_name="summary_similarity",
                    threshold=0.2,
                    filter_nodes=lambda node: bool(node.get_property("summary_embedding"))
                )
            ),
            
            # 5. Filter invalid nodes
            CustomNodeFilter(
                llm=self.llm,
                filter_nodes=lambda node: all([
                    node.get_property("summary"),
                    node.get_property("summary_embedding"),
                    node.get_property("entities")
                ])
            )
        ]

        try:
            await apply_transforms(kg, transforms, run_config=run_config)    
        except Exception as e:
            logger.error(f"Error applying transforms: {e}", exc_info=True)
            raise
        
        kg.save(f"friends_kg_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.json")
        logger.info(f"Created KG with {len(kg.nodes)} nodes and {len(kg.relationships)} relationships")
        return kg
        
    def get_base_prompt(self, synthesizer_name: str) -> str:
        """Get base prompt based on synthesizer type"""
        if "multi_hop" in synthesizer_name.lower():
            return self.multi_hop_prompt.instruction
        return self.single_hop_prompt.instruction

    def format_exemplar(self, sample: EvaluatedSample)
```

### Core Architecture Module: `demo/Friends/transcript_preprocessor.py`
```
from bs4 import BeautifulSoup
import re
from pathlib import Path
import logging
import chardet

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TranscriptCleaner:
    def __init__(self, input_dir: str, output_dir: str):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def clean_text(self, text: str) -> str:
        """Clean individual text segments."""
        # Remove extra whitespace
        text = ' '.join(text.split())
        # Remove any remaining HTML entities
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&nbsp;', ' ', text)
        return text.strip()
    
    def get_specified_encoding(self, file_path: Path) -> str | None:
        """Extract charset from meta tag if specified."""
        try:
            # First read a small portion of the file to check for meta charset
            with open(file_path, 'rb') as f:
                # Read first 1024 bytes which typically contain the head section
                raw_content = f.read(1024)
                
            # Look for charset in meta tag in raw bytes
            charset_match = re.search(br'charset=([\w-]+)', raw_content, re.IGNORECASE)
            if charset_match:
                return charset_match.group(1).decode('ascii').lower()
            
            return None
                
        except Exception as e:
            logger.warning(f"Error reading charset from {file_path.name}: {str(e)}")
            return None

    def get_file_encoding(self, file_path: Path) -> str:
        """Get file encoding, first from meta tag, then using chardet."""
        # Try to get specified encoding first
        specified_encoding = self.get_specified_encoding(file_path)
        if specified_encoding:
            logger.info(f"Using specified encoding for {file_path.name}: {specified_encoding}")
            return specified_encoding
        
        # Fallback to chardet
        logger.info(f"No encoding specified in {file_path.name}, detecting encoding...")
        with open(file_path, 'rb') as f:
            raw_data = f.read()
        
        result = chardet.detect(raw_data)
        encoding = result['encoding']
        confidence = result['confidence']
        
        logger.info(f"Detected encoding for {file_path.name}: {encoding} (confidence: {confidence:.2f})")
        return encoding
    
    def process_file(self, file_path: Path) -> str:
        """Process single transcript file."""
        encoding = self.get_file_encoding(file_path)

        with open(file_path, 'r', encoding=encoding) as f:
            soup = BeautifulSoup(f, 'html.parser')
            
        # Extract title
        title = soup.title.string if soup.title else file_path.stem
        cleaned_content = [f"Episode: {title}\n\n"]
        
        # Process all paragraphs
        for p in soup.find_all('p'):
            text = p.get_text(strip=True)
            if not text:
                continue
                
            # Skip transcriber information
            if any(skip in text.lower() for skip in ['transcribed by:', 'written by:']):
                continue
            
            # Clean and format the text
            text = self.clean_text(text)
            
            # Handle scene descriptions
            if text.startswith('[') and text.endswith(']'):
                cleaned_content.append(f"\n{text}\n")
            
            # Handle dialogue
            elif ':' in text:
                speaker, dialogue = text.split(':', 1)
                cleaned_content.append(f"{speaker.strip()}: {dialogue.strip()}")
            
            # Handle other content
            else:
                cleaned_content.append(text)
        
        return '\n'.join(cleaned_content)
    
    def process_all_files(self):
        """Process all transcript files in the input directory."""
        for file_path in self.input_dir.glob('*.html'):
            try:
                logger.info(f"Processing {file_path.name}")
                cleaned_content = self.process_file(file_path)
                
                # Save cleaned content
                output_file = self.output_dir / f"{file_path.stem}.txt"
                with open(output_file, 'w', encoding='utf-8') as f:
                    f.write(cleaned_content)
                    
            except Exception as e:
                logger.error(f"Error processing {file_path.name}: {str(e)}")

if __name__ == "__main__":
    cleaner = TranscriptCleaner(
        input_dir="path/to/friends/transcripts",
        output_dir="path/to/output/cleaned_transcripts"
    )
    cleaner.process_all_files()
```

### Core Architecture Module: `scripts/audit_dependencies.py`
```
"""Fail on new dependency advisories; document narrowly scoped unresolved risks."""
import json
import subprocess
import sys

# No patched upstream versions at the time of the security patch. See SECURITY.md.
EXCEPTIONS = {
    ("ragas", "GHSA-95ww-475f-pr4f"),
    ("diskcache", "GHSA-w8v5-vhqr-4h9v"),
    ("chromadb", "GHSA-f4j7-r4q5-qw2c"),
    ("chromadb", "GHSA-36p7-vc44-83pf"),
    ("chromadb", "GHSA-xph7-9rjv-w5fr"),
    ("chromadb", "GHSA-2wm9-hf6c-p5cr"),
}

result = subprocess.run([sys.executable, "-m", "pip_audit", "--format=json", "--progress-spinner=off"], capture_output=True, text=True)
if result.returncode not in {0, 1}:
    sys.exit(result.stderr or "Dependency audit failed")
try:
    report = json.loads(result.stdout)
except json.JSONDecodeError:
    sys.exit(result.stderr or "Dependency audit returned no report")
unexpected = []
for dependency in report["dependencies"]:
    for finding in dependency.get("vulns", []):
        identifiers = {finding["id"], *finding.get("aliases", [])}
        known = any((dependency["name"], identifier) in EXCEPTIONS for identifier in identifiers)
        # Once a fix exists, the old exception must no longer suppress the finding.
        accepted = known and not finding.get("fix_versions")
        print(f"{'DOCUMENTED' if accepted else 'ACTION REQUIRED'}: {dependency['name']} {finding['id']}")
        if not accepted:
            unexpected.append(finding)
sys.exit(bool(unexpected))

```

### Core Architecture Module: `start_server.py`
```
import argparse
from  ragbuilder import RAGBuilder,DataIngestOptionsConfig,RetrievalOptionsConfig,RetrievalOptionsConfig

def main():
    parser = argparse.ArgumentParser(description='Start the RAG server.')
    parser.add_argument('--input_source', type=str, required=True, help='Path to the input source.')
    # parser.add_argument('--test_dataset', type=str, default=None, help='Name of the test dataset.')
    args = parser.parse_args()

    builder = RAGBuilder.from_source_with_defaults(
        input_source=args.input_source,
        # test_dataset=args.test_dataset
    )
    builder.optimize()
    builder.serve()

if __name__ == "__main__":
    main()
```

### Core Architecture Module: `telemetry-collector/src/index.js`
```
const EVENTS = new Set(["installation_started", "run_started", "run_completed", "run_failed", "error"]);
const MODULES = new Set(["ragbuilder", "data_ingest", "retriever", "generation", "eval_data_generation", "ui"]);
const FIELDS = new Set(["event", "module", "installation_id", "version"]);
const MAX_BODY = 1024;

export function validateEvent(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return false;
  if (Object.keys(value).some(key => !FIELDS.has(key))) return false;
  return EVENTS.has(value.event) && MODULES.has(value.module)
    && typeof value.installation_id === "string" && /^a-[a-f0-9]{32}$/.test(value.installation_id)
    && typeof value.version === "string" && /^[A-Za-z0-9.+_-]{1,80}$/.test(value.version);
}

async function readEvent(request) {
  if (!request.body) throw new Error("Missing body");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) throw new Error("Body too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));
}

export class DailyBudget {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const {installation_id} = await request.json();
    const configuredLimit = Number(this.env.DAILY_EVENT_LIMIT);
    const limit = Number.isInteger(configuredLimit) && configuredLimit > 0 ? Math.min(configuredLimit, 1000) : 1000;
    const day = new Date().toISOString().slice(0, 10);
    const allowed = await this.ctx.storage.transaction(async storage => {
      let budget = await storage.get("budget");
      if (!budget || budget.day !== day) budget = {day, total: 0, installations: {}};
      const count = budget.installations[installation_id] || 0;
      if (budget.total >= limit || count >= 50) return false;
      budget.total += 1;
      budget.installations[installation_id] = count + 1;
      await storage.put("budget", budget);
      return true;
    });
    return new Response(null, {status: allowed ? 204 : 429});
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health") return new Response(null, {status: 204});
    if (request.method !== "POST" || path !== "/events") return new Response(null, {status: 404});
    if (!env.HONEYCOMB_API_KEY) return new Response(null, {status: 503});
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return new Response(null, {status: 415});
    }
    if (Number(request.headers.get("content-length")) > MAX_BODY) return new Response(null, {status: 413});
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!(await env.CLIENT_LIMIT.limit({key: ip})).success) return new Response(null, {status: 429});
    let event;
    try { event = await readEvent(request); }
    catch { return new Response(null, {status: 400}); }
    if (!validateEvent(event)) return new Response(null, {status: 400});
    try {
      const budget = env.BUDGET.get(env.BUDGET.idFromName("global"));
      const allowance = await budget.fetch(new Request("https://budget/", {
        method: "POST", body: JSON.stringify({installation_id: event.installation_id}),
      }));
      if (allowance.status !== 204) return new Response(null, {status: 429});
      // Consume the budget before forwarding. Failures do not retry or refund it.
      const upstream = await fetch(`https://api.honeycomb.io/1/events/${encodeURIComponent(env.HONEYCOMB_DATASET)}`, {
        // Workers supports manual redirects; never forward the key to a redirect target.
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(3000),
        headers: {"Content-Type": "application/json", "X-Honeycomb-Team": env.HONEYCOMB_API_KEY},
        body: JSON.stringify({...event, "service.name": "ragbuilder"}),
      });
      const ok = upstream.ok;
      await upstream.body?.cancel();
      return new Response(null, {status: ok ? 204 : 502});
    } catch {
      return new Response(null, {status: 503});
    }
  },
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #92** (2026-10-02): **Harden RAGBuilder security and prepare private-key usage collector**
  *Symptoms*: RAGBuilder currently distributes a shared Honeycomb key and has unsafe paths through generated Python, document downloads, and unauthenticated network access. This patch removes distributed analytics credentials, adds a Cloudflare Workers Free usage collector, hardens application inputs and access controls, upgrades vulnerable core dependencies.  Application changes include escaped Python arguments and chat HTML, loopback defaults, token authentication for network access, cross-origin and DNS-rebinding protections, bounded public-IP downloads with pinned DNS and redirect validation, confined UI source directories, and non-root container execution. Legacy LangChain imports and Ragas evaluation result handling are updated for the patched dependency versions.  Validation: 31 offline Python security and compatibility tests and 9 collector tests pass. The staged source secret scan found no leaks. The wheel builds and includes UI/prompt resources. Compose configuration and the Worker deployment dry run pass. npm audit reports no vulnerabilities. The Python audit reports only the explicitly documented unresolved upstream advisories in SECURITY.md. Docker runtime and paid-model integrations have not been tested. The production collector, Durable Object budget access, default Python telemetry client, and Honeycomb ingestion have been exercised successfully.  ## Spec review The evaluation CSV download bypass and Ragas result compatibility findings were fixed and rechecked. No re

- **Issue #87** (2025-05-12): **Ragbuilder v2**
  *Symptoms*: Upgrade to ragas 0.2.14

- **Issue #86** (2025-02-03): **Demo - Friends transcripts**
  *Symptoms*: 

- **Issue #82** (2024-11-15): **milvus index fix**
  *Symptoms*: 

- **Issue #81** (2024-11-05): **Fix retriever duplication**
  *Symptoms*: Bug fix and a few other edge case handling.

- **Issue #78** (2024-10-25): **Update README.md**
  *Symptoms*: 

- **Issue #77** (2024-10-24): **Bug fixes**
  *Symptoms*:  - Retriever selection bug  - BGE re-ranker type fix  - Some other minor fixes.

- **Issue #76** (2024-12-31): **SDK Library v0**
  *Symptoms*: SDK Library v0 The notebook `ragbuilder_sdk_demo.ipynb` shows a demo example.
  **Post-Mortem & Fix Analysis**:
  > New SDK that allows for module-wise optimization.  ## Basic Usage:  ````python from ragbuilder import RAGBuilder  # Initialize and optimize builder = RAGBuilder.from_source_with_defaults(input_source='data.pdf') results = builder.optimize()  # Run a query through the complete pipeline response = results.invoke("What is HNSW?")  # View optimization summary print(results.summary()) ````   ## Advanced Configuration  For fine-grained control, you can customize every aspect:  ````python from ragbuilder.config import (     DataIngestOptionsConfig,     RetrievalOptionsConfig,     GenerationOptionsConfig )  # Configure data ingestion data_ingest_config = DataIngestOptionsConfig(     input_source="data.pdf",     document_loaders=[         {"type": "pymupdf"},         {"type": "unstructured"}     ],     chunking_strategies=[{         "type": "RecursiveCharacterTextSplitter",         "chunker_kwargs": {"separators": ["\n\n", "\n", " ", ""]}     }],     chu

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

### Incident Patch 1: `53048034` (2026-10-02)
**Commit Message**: Merge pull request #92 from KruxAI/codex/security-maintenance

Harden RAGBuilder security and prepare private-key usage collector

**File**: `.env-Sample` (modified, +9/-3)
```diff
@@ -1,7 +1,6 @@
 # Description: Environment variables for the project. Rename to .env file for use
 OPENAI_API_KEY=XXXXXXXXX
 MISTRAL_API_KEY=XXXXXXXXX
-MIXPANEL_TOKEN=XXXXXXXXX
 HUGGINGFACEHUB_API_TOKEN=XXXXXXXXX
 COHERE_API_KEY=XXXXXXXXX
 JINA_API_KEY=XXXXXXXXX
@@ -25,8 +24,15 @@ RUN_CONFIG_MAX_RETRIES=10
 RUN_CONFIG_IS_ASYNC="true"
 NEO4J_URI=bolt://localhost:7687## use bolt://neo4j:7687 if using docker for ragbuilder
 NEO4J_USERNAME=neo4j
-NEO4J_PASSWORD=ragbuilder
+NEO4J_PASSWORD=
 NEO4J_LOAD=true # set to false if graph is already loaded and you don't want to reload
 SAMPLING_RATIO=0.10 # Sampling ratio: If set to 0.10, ~10% of original data will be sampled, and used for RAG building.
 SAMPLING_SIZE_THRESHOLD=750_000 # If your source data is larger than this threshold, RAGBuilder will default to sampling.
-SAMPLING_FILE_SIZE_THRESHOLD=500_000 # When sampling directories, individual files that are larger this threshold, will be sampled at file level.
\ No newline at end of file
+SAMPLING_FILE_SIZE_THRESHOLD=500_000 # When sampling directories, individual files that are larger this threshold, will be sampled at file level.
+# Local server defaults. Network binding requires a random token of at least 32 characters.
+RAGBUILDER_HOST=127.0.0.1
+RAGBUILDER_API_TOKEN=
+# UI file access is confined to this directory (defaults to the working directory).
+RAGBUILDER_DATA_ROOT=
+# Usage telemetry is enabled by default. Set false to disable it.
+# The collector URL is built into the released package; override only for self-hosting.
```

**File**: `.github/workflows/security.yml` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+name: Security checks
+
+on:
+  pull_request:
+  push:
+    branches: [main]
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+jobs:
+  python:
+    runs-on: macos-latest
+    strategy:
+      matrix:
+        python: ['3.10', '3.12']
+    env:
+      ENABLE_ANALYTICS: 'false'
+      RAGAS_DO_NOT_TRACK: 'true'
+      ANONYMIZED_TELEMETRY: 'false'
+      HF_HUB_OFFLINE: '1'
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
+      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5
+        with:
+          python-version: ${{ matrix.python }}
+      - run: python -m pip install -r requirements.lock pytest pip-audit
+      - run: python -m pip wheel --no-deps . --wheel-dir dist
+      - run: python -m pip install --no-deps dist/*.whl
+      - run: python -m pytest -c tests/security/pytest.ini tests/security
+      - run: python scripts/audit_dependencies.py
+  collector:
+    runs-on: ubuntu-latest
+    defaults:
+      run:
+        working-directory: telemetry-collector
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
+      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
+        with:
+          node-version: '22'
+      - run: npm ci
+      - run: npm test
+      - run: npm run check
+      - run: npm audit --audit-level=high
+  secrets:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
+      - name: Scan current source for secrets
+        run: |
+          curl -fsSL -o /tmp/gitleaks.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
+          echo '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  /tmp/gitleaks.tar.gz' | sha256sum --check
+          tar -xzf /tmp/gitleaks.tar.gz -C /tmp gitleaks
+          /tmp/gitleaks dir . --redact --no-banner
```

**File**: `.gitignore` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+.env
+.env.*
+!.env-Sample
+*.pem
+*.key
+__pycache__/
+*.py[cod]
+.venv/
+venv/
+.pytest_cache/
+*.egg-info/
+build/
+dist/
+logs/
+*.db
+*.sqlite*
+output/
+src/ragbuilder/_version.py
+node_modules/
+.wrangler/
+.dev.vars
+.dev.vars.*
```

**File**: `Dockerfile` (modified, +6/-50)
```diff
@@ -1,53 +1,9 @@
-# Use an official Python runtime as a parent image
-FROM python:3.12.3-slim
-
-# Install required system dependencies
-RUN apt-get update && apt-get install -y \
-    build-essential \
-    libjpeg-dev \
-    libmagic-dev \
-    zlib1g-dev \
-    libopenjp2-7-dev \
-    libpng-dev \
-    libpoppler-cpp-dev \
-    pkg-config \
-    gcc \
-    git \
-    libqpdf-dev \
-    libgl1-mesa-glx \
-    libglib2.0-0 \
-    && rm -rf /var/lib/apt/lists/*
-
-# Set the working directory in the container
+FROM python:3.12-slim
 WORKDIR /ragbuilder
-
-# Copy the current directory contents into the container at /ragbuilder
-COPY . /ragbuilder
-
- 
-# Install pip and upgrade setuptools and wheel
-RUN pip install --upgrade pip setuptools wheel
-
-# RUN pip install --use-pep517 -r requirements.txt
-# RUN python3 -m build 
-RUN pip install dist/*.gz
-# Delete all files in the current directory
-WORKDIR /
-
-# Optionally, you can delete hidden files and directories as well
-RUN rm -rf /ragbuilder/*
-
-WORKDIR /ragbuilder
-
-COPY LICENSE /ragbuilder/LICENSE
-COPY .env-Sample /ragbuilder/.env-Sample
-COPY README.md /ragbuilder/README.md
-
-
-
-# Make port 80 available to the world outside this container
+COPY pyproject.toml requirements.lock README.md LICENSE ./
+COPY src ./src
+ARG SETUPTOOLS_SCM_PRETEND_VERSION=0.0.0
+RUN pip install --no-cache-dir -r requirements.lock . && useradd --create-home --uid 10001 ragbuilder && chown -R ragbuilder:ragbuilder /ragbuilder
+USER ragbuilder
 EXPOSE 8005
-
-
-# Run app.py when the container launches
 CMD ["ragbuilder"]
```

**File**: `README.md` (modified, +15/-6)
```diff
@@ -1,3 +1,5 @@
+> **Maintenance status:** RAGBuilder is no longer actively maintained. This repository is kept for reference. Ongoing updates and support are not planned.
+
 ![RagBuilder logo](./assets/ragbuilder_dark.png#gh-dark-mode-only)
 ![RagBuilder logo](./assets/ragbuilder_light.png#gh-light-mode-only)
 
@@ -320,16 +322,23 @@ generator = builder.generation.get_generator()
 
 ## Usage Analytics
 
-We collect anonymous usage metrics to improve RAGBuilder:
-- Number of optimization runs
-- Success/failure rates
-- No personal or business data is collected
+Basic usage telemetry is enabled by default. It sends the event type, RAGBuilder version, component name, and a random installation ID through our Cloudflare collector to Honeycomb. It does not send documents, prompts, model responses, file paths, API keys, or exception messages. Cloudflare receives the connection IP address to apply traffic limits; the collector does not forward it to Honeycomb. Telemetry is best effort and does not affect a run if unavailable.
+
+To opt out, set `ENABLE_ANALYTICS=false` in your environment or `.env` before starting RAGBuilder.
+
+## Security and local use
+
+Python 3.10 or newer is required. The UI and SDK server listen on `127.0.0.1` by default. To bind another address, set `RAGBUILDER_API_TOKEN` to a random value of at least 32 characters. The browser prompts for username `ragbuilder` and that token as the password; API clients can use `Authorization: Bearer <token>`. Use TLS through a trusted reverse proxy for remote access. This is a tool for trusted operators, not a public service.
+
+The UI only accepts local files inside `RAGBUILDER_DATA_ROOT` (the working directory by default). Use a dedicated data directory. URL inputs allow only public HTTP(S) addresses on ports 80/443, validate redirects, and limit downloads to 20 MiB. Local LLM and database integrations are separate from document URL inputs.
+
+Docker Compose builds this checkout, binds published ports to localhost, and requires `NEO4J_PASSWORD` and `RAGBUILDER_API_TOKEN`. Set those values in `.env` before running `docker compose up --build`. Changing the Neo4j environment variable does not rotate the password in an existing database volume.
 
-To opt-out set `ENABLE_ANALYTICS=False` in `.env`:
+See [SECURITY.md](SECURITY.md) for remaining dependency risks and [collector deployment instructions](telemetry-collector/README.md). Older installations must be upgraded; changing this repository cannot patch them.
 
 ## Contributing
 
-We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
+The source remains available for reference and forks. There is no commitment to review contributions or provide support.
 
 ## License
 
```

**File**: `SECURITY.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# Security and maintenance
+
+RAGBuilder is no longer actively maintained. Ongoing fixes and support are not guaranteed. Use it only with trusted operators and data. Do not expose the UI, an unauthenticated API, or a database directly to the internet.
+
+## Security patch
+
+This patch removes the shared Honeycomb and Mixpanel credentials, routes minimal usage events through a bounded collector, escapes generated Python arguments and displayed chat content, restricts document downloads, confines UI file access, and requires authentication for network access. It also upgrades vulnerable dependencies and moves legacy LangChain imports to `langchain-classic`.
+
+Python 3.10 or newer is required. Use `requirements.lock` for the tested dependency set. Existing saved Python pipelines, databases, notebooks, vector stores, and caches remain trusted executable inputs. Do not load artifacts supplied by an untrusted party. These changes do not retrofit previously generated Python pipelines or already installed releases.
+
+## Remaining upstream advisories
+
+As of October 1, 2026, the dependency audit still reports the advisories below with no published fixed version. They are not claimed to be fixed by this patch. The audit script records these specific exceptions and fails on other findings.
+
+| Dependency | Advisory | Exposure and mitigation |
+| --- | --- | --- |
+| Ragas 0.4.3 | [CVE-2026-6587](https://github.com/advisories/GHSA-95ww-475f-pr4f) | The affected multimodal faithfulness collection is not used by RAGBuilder's text evaluation paths. Do not add or invoke multimodal metrics on untrusted inputs. |
+| DiskCache 5.6.3, a Ragas dependency | [CVE-2025-69872](https://github.com/advisories/GHSA-w8v5-vhqr-4h9v) | Pickle deserialization is unsafe if another user can write the cache. RAGBuilder does not configure a DiskCache backend. Keep all cache directories private and do not import untrusted caches. |
+| ChromaDB | [CVE-2026-45829](https://github.com/advisories/GHSA-f4j7-r4q5-qw2c), [CVE-2026-45833](https://github.com/advisories/GHSA-36p7-vc44-83pf), [CVE-2026-45831](https://github.com/advisories/GHSA-xph7-9rjv-w5fr), [CVE-2026-45830](https://github.com/advisories/GHSA-2wm9-hf6c-p5cr) | These affect the Chroma server and authorization boundary. The default RAGBuilder integration uses local Chroma, not a hosted Chroma server. Do not expose a Chroma server, enable `trust_remote_code`, or rely on its affected authorization for tenant isolation. |
+
+`langchain-community` is pinned to 0.4.1 because 0.4.2 removes a VertexAI compatibility module still imported by Ragas 0.4.3. The pinned version includes the XXE fix identified in the repository audit. Re-run the audit when changing this pin.
+
+## Deployment boundaries
+
+- Keep the default localhost binding. For remote access use a strong `RAGBUILDER_API_TOKEN` and HTTPS through a trusted reverse proxy. The token grants operator access, not isolated access for multiple tenants.
+- Set `RAGBUILDER_DATA_ROOT` to a dedicated directory containing only documents intended for processing. Selected directories must not contain hidden files, hidden directories, or symlinks to hidden or out-of-root content. The SDK is a local programming interface and retains caller-directed filesystem access.
+- Document and prompt URL downloads use public IP addresses only, pin the resolved address, validate each redirect, verify TLS, and cap decoded response size at 20 MiB. HTTP proxy environment settings are not used for these downloads.
+- Set `NEO4J_PASSWORD` before deploying Compose. For an existing Neo4j volume, rotate the database password through Neo4j itself; changing `.env` alone does not rotate it.
+- Disable the previously published Honeycomb key and revoke any matching historical OpenAI key in the provider consoles. Removing source text cannot revoke credentials or erase old clones, releases, and Git history.
+- Keep secrets out of commits, images, notebooks, and logs. GitHub secret scanning and push protection should stay enabled.
+
+## Verification
+
+Run `python -m pytest -c tests/security/pytest.ini tests/security` and `npm test --prefix telemetry-collector`. The tests use synthetic data and do not call paid model APIs or send real telemetry. Run `python scripts/audit_dependencies.py` after installing `pip-audit`; its explicit exceptions are the unresolved advisories above.
+
+The GitHub Actions workflow at `.github/workflows/security.yml` runs these checks on pull requests and pushes to `main`.
```

**File**: `docker-compose.yml` (modified, +12/-11)
```diff
@@ -1,28 +1,29 @@
-version: "3.8"
-
 services:
   neo4j:
     build: ./neo4j
     ports:
-      - "7474:7474"
-      - "7687:7687"
+      - "127.0.0.1:7474:7474"
+      - "127.0.0.1:7687:7687"
     environment:
-      NEO4J_AUTH: "neo4j/ragbuilder"
-      NEO4J_apoc_export_file_enabled: "true"
-      NEO4J_apoc_import_file_enabled: "true"
+      NEO4J_AUTH: "neo4j/${NEO4J_PASSWORD:?Set a strong NEO4J_PASSWORD}"
+      NEO4J_apoc_export_file_enabled: "false"
+      NEO4J_apoc_import_file_enabled: "false"
       NEO4J_apoc_import_file_use__neo4j__config: "true"
-      NEO4J_dbms_security_procedures_unrestricted: "apoc.*"
     volumes:
       - ./data:/data
     networks:
       - custom-network
 
   ragbuilder:
-    image: ashwinzyx/ragbuilder:latest
+    build: .
+    environment:
+      RAGBUILDER_HOST: "0.0.0.0"
+      RAGBUILDER_API_TOKEN: "${RAGBUILDER_API_TOKEN:?Set a random token of at least 32 characters}"
     ports:
-      - "55003:8005"
+      - "127.0.0.1:55003:8005"
     volumes:
-      - .:/ragbuilder
+      - ./data:/ragbuilder/data
+      - ./output:/ragbuilder/output
     env_file:
       - .env
     depends_on:
```

**File**: `neo4j/Dockerfile` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ FROM neo4j:5.22.0
 
 
 ENV NEO4JLABS_PLUGINS '[ "apoc" ]'
-ENV NEO4J_dbms_security_procedures_unrestricted apoc.*
 
 COPY ./apoc-5.22.0-core.jar /var/lib/neo4j/plugins
 
```

---

### Incident Patch 2: `ca20531d` (2026-10-01)
**Commit Message**: Activate security CI after workflow authorization

**File**: `SECURITY.md` (modified, +1/-1)
```diff
@@ -33,4 +33,4 @@ As of October 1, 2026, the dependency audit still reports the advisories below w
 
 Run `python -m pytest -c tests/security/pytest.ini tests/security` and `npm test --prefix telemetry-collector`. The tests use synthetic data and do not call paid model APIs or send real telemetry. Run `python scripts/audit_dependencies.py` after installing `pip-audit`; its explicit exceptions are the unresolved advisories above.
 
-The GitHub Actions workflow is prepared at `scripts/security-workflow.yml`. To activate it, move it to `.github/workflows/security.yml` and push using GitHub credentials with the `workflow` permission. The current automation login lacks that permission, so CI has not been activated by this patch.
+The GitHub Actions workflow at `.github/workflows/security.yml` runs these checks on pull requests and pushes to `main`.
```

---

### Incident Patch 3: `8e7ce14d` (2026-10-01)
**Commit Message**: Verify built package resources and evaluation compatibility in CI

**File**: `.github/workflows/security.yml` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@ jobs:
       - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5
         with:
           python-version: ${{ matrix.python }}
-      - run: python -m pip install -r requirements.lock -e . pytest pip-audit
+      - run: python -m pip install -r requirements.lock pytest pip-audit
+      - run: python -m pip wheel --no-deps . --wheel-dir dist
+      - run: python -m pip install --no-deps dist/*.whl
       - run: python -m pytest -c tests/security/pytest.ini tests/security
       - run: python scripts/audit_dependencies.py
   collector:
```

**File**: `SECURITY.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ As of October 1, 2026, the dependency audit still reports the advisories below w
 ## Deployment boundaries
 
 - Keep the default localhost binding. For remote access use a strong `RAGBUILDER_API_TOKEN` and HTTPS through a trusted reverse proxy. The token grants operator access, not isolated access for multiple tenants.
-- Set `RAGBUILDER_DATA_ROOT` to a dedicated directory containing only documents intended for processing. The SDK is a local programming interface and retains caller-directed filesystem access.
+- Set `RAGBUILDER_DATA_ROOT` to a dedicated directory containing only documents intended for processing. Selected directories must not contain hidden files, hidden directories, or symlinks to hidden or out-of-root content. The SDK is a local programming interface and retains caller-directed filesystem access.
 - Document and prompt URL downloads use public IP addresses only, pin the resolved address, validate each redirect, verify TLS, and cap decoded response size at 20 MiB. HTTP proxy environment settings are not used for these downloads.
 - Set `NEO4J_PASSWORD` before deploying Compose. For an existing Neo4j volume, rotate the database password through Neo4j itself; changing `.env` alone does not rotate it.
 - Disable the previously published Honeycomb key and revoke any matching historical OpenAI key in the provider consoles. Removing source text cannot revoke credentials or erase old clones, releases, and Git history.
```

**File**: `tests/security/test_app_smoke.py` (modified, +37/-1)
```diff
@@ -6,6 +6,13 @@
 from starlette.testclient import TestClient
 
 
+def test_package_contains_ui_and_prompt_resources():
+    from importlib.resources import files
+    package = files("ragbuilder")
+    for path in ["templates/index.html", "templates/chat.html", "static/main.js", "generation/prompts.yaml"]:
+        assert package.joinpath(path).read_bytes()
+
+
 def test_sdk_generation_with_current_langchain():
     from ragbuilder import RAGBuilder
     from ragbuilder.generation.pipeline import GenerationPipeline
@@ -78,14 +85,17 @@ def test_legacy_evaluation_preserves_database_fields_and_averages_scores(monkeyp
     import inspect
     import math
     from datasets import Dataset
-    from ragas import EvaluationDataset, EvaluationResult, evaluate
+    from ragas import EvaluationDataset, evaluate
+    from ragas.dataset_schema import EvaluationResult
+    from ragas.callbacks import ChainRun
     from ragbuilder import eval as legacy
 
     rows = [{"question": "q", "answer": "a", "contexts": ["c"], "ground_truth": "a",
              "eval_id": 1, "run_id": 2, "eval_ts": 3, "latency": 4, "tokens": 5, "cost": 6}]
     current_result = EvaluationResult(
         dataset=EvaluationDataset.from_list([{"user_input": "q", "response": "a", "retrieved_contexts": ["c"], "reference": "a"}]),
         scores=[{"answer_correctness": 0.75}],
+        ragas_traces={"test": ChainRun(run_id="test", parent_run_id=None, name="evaluation", inputs={}, metadata={})},
     )
     def evaluate_without_model_calls(*args, **kwargs):
         inspect.signature(evaluate).bind(*args, **kwargs)
@@ -104,3 +114,29 @@ def evaluate_without_model_calls(*args, **kwargs):
     assert math.isnan(legacy.answer_correctness_score(SimpleNamespace(scores=[{"answer_correctness": None}])))
     partial = SimpleNamespace(scores=[{"answer_correctness": n} for n in [1, 0.5, 1, 0.5, None]])
     assert legacy.answer_correctness_score(partial) == 0.75
+
+
+def test_hybrid_template_runs_with_local_test_components(monkeypatch):
+    from langchain_classic import hub
+    from langchain_core.prompts import ChatPromptTemplate
+    from langchain_core.retrievers import BaseRetriever
+    import langchain_chroma
+    from ragbuilder.rag_templates.sota.hybrid_rag import code
+
+    docs = [Document(page_content="test document with context")]
+    class Retriever(BaseRetriever):
+        def _get_relevant_documents(self, query, *, run_manager):
+            return docs
+    class VectorStore:
+        @classmethod
+        def from_documents(cls, **kwargs):
+            return cls()
+        def as_retriever(self, **kwargs):
+            return Retriever()
+    monkeypatch.setattr(langchain_chroma, "Chroma", VectorStore)
+    monkeypatch.setattr(hub, "pull", lambda name: ChatPromptTemplate.from_template("{context}\n{question}"))
+    code = code.replace("{llm_class}", "llm = test_llm").replace("{loader_class}", "docs = test_docs").replace("{embedding_class}", "embedding = None")
+    namespace = {"test_llm": FakeListChatModel(responses=["test answer"]), "test_docs": docs}
+    exec(code, namespace)
+    pipeline = namespace["rag_pipeline"]()
+    assert pipeline.invoke("test")["answer"] == "test answer"
```

---

### Incident Patch 4: `6a87d2b3` (2026-10-01)
**Commit Message**: Harden public usage telemetry and local application security

**File**: `.env-Sample` (modified, +9/-3)
```diff
@@ -1,7 +1,6 @@
 # Description: Environment variables for the project. Rename to .env file for use
 OPENAI_API_KEY=XXXXXXXXX
 MISTRAL_API_KEY=XXXXXXXXX
-MIXPANEL_TOKEN=XXXXXXXXX
 HUGGINGFACEHUB_API_TOKEN=XXXXXXXXX
 COHERE_API_KEY=XXXXXXXXX
 JINA_API_KEY=XXXXXXXXX
@@ -25,8 +24,15 @@ RUN_CONFIG_MAX_RETRIES=10
 RUN_CONFIG_IS_ASYNC="true"
 NEO4J_URI=bolt://localhost:7687## use bolt://neo4j:7687 if using docker for ragbuilder
 NEO4J_USERNAME=neo4j
-NEO4J_PASSWORD=ragbuilder
+NEO4J_PASSWORD=
 NEO4J_LOAD=true # set to false if graph is already loaded and you don't want to reload
 SAMPLING_RATIO=0.10 # Sampling ratio: If set to 0.10, ~10% of original data will be sampled, and used for RAG building.
 SAMPLING_SIZE_THRESHOLD=750_000 # If your source data is larger than this threshold, RAGBuilder will default to sampling.
-SAMPLING_FILE_SIZE_THRESHOLD=500_000 # When sampling directories, individual files that are larger this threshold, will be sampled at file level.
\ No newline at end of file
+SAMPLING_FILE_SIZE_THRESHOLD=500_000 # When sampling directories, individual files that are larger this threshold, will be sampled at file level.
+# Local server defaults. Network binding requires a random token of at least 32 characters.
+RAGBUILDER_HOST=127.0.0.1
+RAGBUILDER_API_TOKEN=
+# UI file access is confined to this directory (defaults to the working directory).
+RAGBUILDER_DATA_ROOT=
+# Usage telemetry is enabled by default. Set false to disable it.
+# The collector URL is built into the released package; override only for self-hosting.
```

**File**: `.github/workflows/security.yml` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+name: Security checks
+
+on:
+  pull_request:
+  push:
+    branches: [main]
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+jobs:
+  python:
+    runs-on: macos-latest
+    strategy:
+      matrix:
+        python: ['3.10', '3.12']
+    env:
+      ENABLE_ANALYTICS: 'false'
+      RAGAS_DO_NOT_TRACK: 'true'
+      ANONYMIZED_TELEMETRY: 'false'
+      HF_HUB_OFFLINE: '1'
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
+      - uses: actions/setup-python@a26af69be951a213d495a4c3e4e4022e16d87065 # v5
+        with:
+          python-version: ${{ matrix.python }}
+      - run: python -m pip install -r requirements.lock -e . pytest pip-audit
+      - run: python -m pytest -c tests/security/pytest.ini tests/security
+      - run: python scripts/audit_dependencies.py
+  collector:
+    runs-on: ubuntu-latest
+    defaults:
+      run:
+        working-directory: telemetry-collector
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
+      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
+        with:
+          node-version: '22'
+      - run: npm ci
+      - run: npm test
+      - run: npm run check
+      - run: npm audit --audit-level=high
+  secrets:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
+      - name: Scan current source for secrets
+        run: |
+          curl -fsSL -o /tmp/gitleaks.tar.gz https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz
+          echo '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  /tmp/gitleaks.tar.gz' | sha256sum --check
+          tar -xzf /tmp/gitleaks.tar.gz -C /tmp gitleaks
+          /tmp/gitleaks dir . --redact --no-banner
```

**File**: `.gitignore` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+.env
+.env.*
+!.env-Sample
+*.pem
+*.key
+__pycache__/
+*.py[cod]
+.venv/
+venv/
+.pytest_cache/
+*.egg-info/
+build/
+dist/
+logs/
+*.db
+*.sqlite*
+output/
+src/ragbuilder/_version.py
+node_modules/
+.wrangler/
+.dev.vars
+.dev.vars.*
```

**File**: `Dockerfile` (modified, +6/-50)
```diff
@@ -1,53 +1,9 @@
-# Use an official Python runtime as a parent image
-FROM python:3.12.3-slim
-
-# Install required system dependencies
-RUN apt-get update && apt-get install -y \
-    build-essential \
-    libjpeg-dev \
-    libmagic-dev \
-    zlib1g-dev \
-    libopenjp2-7-dev \
-    libpng-dev \
-    libpoppler-cpp-dev \
-    pkg-config \
-    gcc \
-    git \
-    libqpdf-dev \
-    libgl1-mesa-glx \
-    libglib2.0-0 \
-    && rm -rf /var/lib/apt/lists/*
-
-# Set the working directory in the container
+FROM python:3.12-slim
 WORKDIR /ragbuilder
-
-# Copy the current directory contents into the container at /ragbuilder
-COPY . /ragbuilder
-
- 
-# Install pip and upgrade setuptools and wheel
-RUN pip install --upgrade pip setuptools wheel
-
-# RUN pip install --use-pep517 -r requirements.txt
-# RUN python3 -m build 
-RUN pip install dist/*.gz
-# Delete all files in the current directory
-WORKDIR /
-
-# Optionally, you can delete hidden files and directories as well
-RUN rm -rf /ragbuilder/*
-
-WORKDIR /ragbuilder
-
-COPY LICENSE /ragbuilder/LICENSE
-COPY .env-Sample /ragbuilder/.env-Sample
-COPY README.md /ragbuilder/README.md
-
-
-
-# Make port 80 available to the world outside this container
+COPY pyproject.toml requirements.lock README.md LICENSE ./
+COPY src ./src
+ARG SETUPTOOLS_SCM_PRETEND_VERSION=0.0.0
+RUN pip install --no-cache-dir -r requirements.lock . && useradd --create-home --uid 10001 ragbuilder && chown -R ragbuilder:ragbuilder /ragbuilder
+USER ragbuilder
 EXPOSE 8005
-
-
-# Run app.py when the container launches
 CMD ["ragbuilder"]
```

**File**: `README.md` (modified, +15/-6)
```diff
@@ -1,3 +1,5 @@
+> **Maintenance status:** RAGBuilder is no longer actively maintained. This repository is kept for reference. Ongoing updates and support are not planned.
+
 ![RagBuilder logo](./assets/ragbuilder_dark.png#gh-dark-mode-only)
 ![RagBuilder logo](./assets/ragbuilder_light.png#gh-light-mode-only)
 
@@ -320,16 +322,23 @@ generator = builder.generation.get_generator()
 
 ## Usage Analytics
 
-We collect anonymous usage metrics to improve RAGBuilder:
-- Number of optimization runs
-- Success/failure rates
-- No personal or business data is collected
+Basic usage telemetry is enabled by default. It sends the event type, RAGBuilder version, component name, and a random installation ID through our Cloudflare collector to Honeycomb. It does not send documents, prompts, model responses, file paths, API keys, or exception messages. Cloudflare receives the connection IP address to apply traffic limits; the collector does not forward it to Honeycomb. Telemetry is best effort and does not affect a run if unavailable.
+
+To opt out, set `ENABLE_ANALYTICS=false` in your environment or `.env` before starting RAGBuilder.
+
+## Security and local use
+
+Python 3.10 or newer is required. The UI and SDK server listen on `127.0.0.1` by default. To bind another address, set `RAGBUILDER_API_TOKEN` to a random value of at least 32 characters. The browser prompts for username `ragbuilder` and that token as the password; API clients can use `Authorization: Bearer <token>`. Use TLS through a trusted reverse proxy for remote access. This is a tool for trusted operators, not a public service.
+
+The UI only accepts local files inside `RAGBUILDER_DATA_ROOT` (the working directory by default). Use a dedicated data directory. URL inputs allow only public HTTP(S) addresses on ports 80/443, validate redirects, and limit downloads to 20 MiB. Local LLM and database integrations are separate from document URL inputs.
+
+Docker Compose builds this checkout, binds published ports to localhost, and requires `NEO4J_PASSWORD` and `RAGBUILDER_API_TOKEN`. Set those values in `.env` before running `docker compose up --build`. Changing the Neo4j environment variable does not rotate the password in an existing database volume.
 
-To opt-out set `ENABLE_ANALYTICS=False` in `.env`:
+See [SECURITY.md](SECURITY.md) for remaining dependency risks and [collector deployment instructions](telemetry-collector/README.md). Older installations must be upgraded; changing this repository cannot patch them.
 
 ## Contributing
 
-We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
+The source remains available for reference and forks. There is no commitment to review contributions or provide support.
 
 ## License
 
```

**File**: `SECURITY.md` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+# Security and maintenance
+
+RAGBuilder is no longer actively maintained. Ongoing fixes and support are not guaranteed. Use it only with trusted operators and data. Do not expose the UI, an unauthenticated API, or a database directly to the internet.
+
+## Security patch
+
+This patch removes the shared Honeycomb and Mixpanel credentials, routes minimal usage events through a bounded collector, escapes generated Python arguments and displayed chat content, restricts document downloads, confines UI file access, and requires authentication for network access. It also upgrades vulnerable dependencies and moves legacy LangChain imports to `langchain-classic`.
+
+Python 3.10 or newer is required. Use `requirements.lock` for the tested dependency set. Existing saved Python pipelines, databases, notebooks, vector stores, and caches remain trusted executable inputs. Do not load artifacts supplied by an untrusted party. These changes do not retrofit previously generated Python pipelines or already installed releases.
+
+## Remaining upstream advisories
+
+As of October 1, 2026, the dependency audit still reports the advisories below with no published fixed version. They are not claimed to be fixed by this patch. CI records these specific exceptions and fails on other findings.
+
+| Dependency | Advisory | Exposure and mitigation |
+| --- | --- | --- |
+| Ragas 0.4.3 | [CVE-2026-6587](https://github.com/advisories/GHSA-95ww-475f-pr4f) | The affected multimodal faithfulness collection is not used by RAGBuilder's text evaluation paths. Do not add or invoke multimodal metrics on untrusted inputs. |
+| DiskCache 5.6.3, a Ragas dependency | [CVE-2025-69872](https://github.com/advisories/GHSA-w8v5-vhqr-4h9v) | Pickle deserialization is unsafe if another user can write the cache. RAGBuilder does not configure a DiskCache backend. Keep all cache directories private and do not import untrusted caches. |
+| ChromaDB | [CVE-2026-45829](https://github.com/advisories/GHSA-f4j7-r4q5-qw2c), [CVE-2026-45833](https://github.com/advisories/GHSA-36p7-vc44-83pf), [CVE-2026-45831](https://github.com/advisories/GHSA-xph7-9rjv-w5fr), [CVE-2026-45830](https://github.com/advisories/GHSA-2wm9-hf6c-p5cr) | These affect the Chroma server and authorization boundary. The default RAGBuilder integration uses local Chroma, not a hosted Chroma server. Do not expose a Chroma server, enable `trust_remote_code`, or rely on its affected authorization for tenant isolation. |
+
+`langchain-community` is pinned to 0.4.1 because 0.4.2 removes a VertexAI compatibility module still imported by Ragas 0.4.3. The pinned version includes the XXE fix identified in the repository audit. Re-run the audit when changing this pin.
+
+## Deployment boundaries
+
+- Keep the default localhost binding. For remote access use a strong `RAGBUILDER_API_TOKEN` and HTTPS through a trusted reverse proxy. The token grants operator access, not isolated access for multiple tenants.
+- Set `RAGBUILDER_DATA_ROOT` to a dedicated directory containing only documents intended for processing. The SDK is a local programming interface and retains caller-directed filesystem access.
+- Document and prompt URL downloads use public IP addresses only, pin the resolved address, validate each redirect, verify TLS, and cap decoded response size at 20 MiB. HTTP proxy environment settings are not used for these downloads.
+- Set `NEO4J_PASSWORD` before deploying Compose. For an existing Neo4j volume, rotate the database password through Neo4j itself; changing `.env` alone does not rotate it.
+- Disable the previously published Honeycomb key and revoke any matching historical OpenAI key in the provider consoles. Removing source text cannot revoke credentials or erase old clones, releases, and Git history.
+- Keep secrets out of commits, images, notebooks, and logs. GitHub secret scanning and push protection should stay enabled.
+
+## Verification
+
+Run `python -m pytest -c tests/security/pytest.ini tests/security` and `npm test --prefix telemetry-collector`. The tests use synthetic data and do not call paid model APIs or send real telemetry. Run `python scripts/audit_dependencies.py` after installing `pip-audit`; its explicit exceptions are the unresolved advisories above.
```

**File**: `docker-compose.yml` (modified, +12/-11)
```diff
@@ -1,28 +1,29 @@
-version: "3.8"
-
 services:
   neo4j:
     build: ./neo4j
     ports:
-      - "7474:7474"
-      - "7687:7687"
+      - "127.0.0.1:7474:7474"
+      - "127.0.0.1:7687:7687"
     environment:
-      NEO4J_AUTH: "neo4j/ragbuilder"
-      NEO4J_apoc_export_file_enabled: "true"
-      NEO4J_apoc_import_file_enabled: "true"
+      NEO4J_AUTH: "neo4j/${NEO4J_PASSWORD:?Set a strong NEO4J_PASSWORD}"
+      NEO4J_apoc_export_file_enabled: "false"
+      NEO4J_apoc_import_file_enabled: "false"
       NEO4J_apoc_import_file_use__neo4j__config: "true"
-      NEO4J_dbms_security_procedures_unrestricted: "apoc.*"
     volumes:
       - ./data:/data
     networks:
       - custom-network
 
   ragbuilder:
-    image: ashwinzyx/ragbuilder:latest
+    build: .
+    environment:
+      RAGBUILDER_HOST: "0.0.0.0"
+      RAGBUILDER_API_TOKEN: "${RAGBUILDER_API_TOKEN:?Set a random token of at least 32 characters}"
     ports:
-      - "55003:8005"
+      - "127.0.0.1:55003:8005"
     volumes:
-      - .:/ragbuilder
+      - ./data:/ragbuilder/data
+      - ./output:/ragbuilder/output
     env_file:
       - .env
     depends_on:
```

**File**: `neo4j/Dockerfile` (modified, +0/-1)
```diff
@@ -2,7 +2,6 @@ FROM neo4j:5.22.0
 
 
 ENV NEO4JLABS_PLUGINS '[ "apoc" ]'
-ENV NEO4J_dbms_security_procedures_unrestricted apoc.*
 
 COPY ./apoc-5.22.0-core.jar /var/lib/neo4j/plugins
 
```

---

### Incident Patch 5: `5b084512` (2025-05-12)
**Commit Message**: Merge pull request #87 from KruxAI/ragbuilder_v2

Ragbuilder v2

**File**: `SampleInputFiles/docs-get_started-quickstart.md` (removed, +0/-804)
```diff
@@ -1,804 +0,0 @@
-# Quickstart
-
-In this quickstart we'll show you how to:
-
-* Get setup with LangChain, LangSmith and LangServe
-* Use the most basic and common components of LangChain: prompt templates, models, and output parsers
-* Use LangChain Expression Language, the protocol that LangChain is built on and which facilitates component chaining
-* Build a simple application with LangChain
-* Trace your application with LangSmith
-* Serve your application with LangServe
-
-That's a fair amount to cover! Let's dive in.
-
-## Setup[​](#setup "Direct link to Setup")
-
-### Jupyter Notebook[​](#jupyter-notebook "Direct link to Jupyter Notebook")
-
-This guide (and most of the other guides in the documentation) uses [Jupyter notebooks](https://jupyter.org/) and assumes the reader is as well. Jupyter notebooks are perfect for learning how to work with LLM systems because oftentimes things can go wrong (unexpected output, API down, etc) and going through guides in an interactive environment is a great way to better understand them.
-
-You do not NEED to go through the guide in a Jupyter Notebook, but it is recommended. See [here](https://jupyter.org/install) for instructions on how to install.
-
-### Installation[​](#installation "Direct link to Installation")
-
-To install LangChain run:
-
-* Pip
-* Conda
-
-
-```
-pip install langchain  
-
-```
-
-```
-conda install langchain -c conda-forge  
-
-```
-For more details, see our [Installation guide](/docs/get_started/installation/).
-
-### LangSmith[​](#langsmith "Direct link to LangSmith")
-
-Many of the applications you build with LangChain will contain multiple steps with multiple invocations of LLM calls.
-As these applications get more and more complex, it becomes crucial to be able to inspect what exactly is going on inside your chain or agent.
-The best way to do this is with [LangSmith](https://smith.langchain.com).
-
-Note that LangSmith is not needed, but it is helpful.
-If you do want to use LangSmith, after you sign up at the link above, make sure to set your environment variables to start logging traces:
-
-
-```
-export LANGCHAIN_TRACING_V2="true"  
-export LANGCHAIN_API_KEY="..."  
-
-```
-## Building with LangChain[​](#building-with-langchain "Direct link to Building with LangChain")
-
-LangChain enables building application that connect external sources of data and computation to LLMs.
-In this quickstart, we will walk through a few different ways of doing that.
-We will start with a simple LLM chain, which just relies on information in the prompt template to respond.
-Next, we will build a retrieval chain, which fetches data from a separate database and passes that into the prompt template.
-We will then add in chat history, to create a conversation retrieval chain. This allows you to interact in a chat manner with this LLM, so it remembers previous questions.
-Finally, we will build an agent - which utilizes an LLM to determine whether or not it needs to fetch data to answer questions.
-We will cover these at a high level, but there are lot of details to all of these!
-We will link to relevant docs.
-
-## LLM Chain[​](#llm-chain "Direct link to LLM Chain")
-
-We'll show how to use models available via API, like OpenAI, and local open source models, using integrations like Ollama.
-
-* OpenAI
-* Local (using Ollama)
-* Anthropic
-* Cohere
-
-First we'll need to import the LangChain x OpenAI integration package.
-
-
-```
-pip install langchain-openai  
-
-```
-Accessing the API requires an API key, which you can get by creating an account and heading [here](https://platform.openai.com/account/api-keys). Once we have a key we'll want to set it as an environment variable by running:
-
-
-```
-export OPENAI_API_KEY="..."  
-
-```
-We can then initialize the model:
-
-
-```
-from langchain_openai import ChatOpenAI  
-  
-llm = ChatOpenAI()  
-
-```
-#### API Reference:
-
-* [ChatOpenAI](https://api.python.langchain.com/en/latest/chat_models/langchain_openai.chat_models.base.ChatOpenAI.html)
-If you'd prefer not to set an environment variable you can pass the key in directly via the `api_key` named parameter when initiating the OpenAI LLM class:
-
-
-```
-from langchain_openai import ChatOpenAI  
-  
-llm = ChatOpenAI(api_key="...")  
-
-```
-#### API Reference:
-
-* [ChatOpenAI](https://api.python.langchain.com/en/latest/chat_models/langchain_openai.chat_models.base.ChatOpenAI.html)
-[Ollama](https://ollama.ai/) allows you to run open-source large language models, such as Llama 2, locally.
-
-First, follow [these instructions](https://github.com/jmorganca/ollama) to set up and run a local Ollama instance:
-
-* [Download](https://ollama.ai/download)
-* Fetch a model via `ollama pull llama2`
-
-Then, make sure the Ollama server is running. After that, you can do:
-
-
-```
-from langchain_community.llms import Ollama  
-llm = Ollama(model="llama2")  
-
-```
-#### API Reference:
-
-* [Ollama](https://api.python.langchain.com/en/latest/llms/langchain_
```

**File**: `SampleInputFiles/docs-langsmith-walkthrough.md` (removed, +0/-532)
```diff
@@ -1,532 +0,0 @@
-# LangSmith Walkthrough
-
-[![](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/langchain-ai/langchain/blob/master/docs/docs/langsmith/walkthrough.ipynb)
-
-Open In Colab
-
-LangChain makes it easy to prototype LLM applications and Agents.
-However, delivering LLM applications to production can be deceptively
-difficult. You will have to iterate on your prompts, chains, and other
-components to build a high-quality product.
-
-LangSmith makes it easy to debug, test, and continuously improve your
-LLM applications.
-
-When might this come in handy? You may find it useful when you want to:
-
-* Quickly debug a new chain, agent, or set of tools
-* Create and manage datasets for fine-tuning, few-shot prompting, and
-evaluation
-* Run regression tests on your application to confidently develop
-* Capture production analytics for product insights and continuous
-improvements
-
-## Prerequisites[​](#prerequisites "Direct link to Prerequisites")
-
-**[Create a LangSmith account](https://smith.langchain.com/) and create
-an API key (see bottom left corner). Familiarize yourself with the
-platform by looking through the
-[docs](https://docs.smith.langchain.com/)**
-
-Note LangSmith is in closed beta; we’re in the process of rolling it out
-to more users. However, you can fill out the form on the website for
-expedited access.
-
-Now, let’s get started!
-
-## Log runs to LangSmith[​](#log-runs-to-langsmith "Direct link to Log runs to LangSmith")
-
-First, configure your environment variables to tell LangChain to log
-traces. This is done by setting the `LANGCHAIN_TRACING_V2` environment
-variable to true. You can tell LangChain which project to log to by
-setting the `LANGCHAIN_PROJECT` environment variable (if this isn’t set,
-runs will be logged to the `default` project). This will automatically
-create the project for you if it doesn’t exist. You must also set the
-`LANGCHAIN_ENDPOINT` and `LANGCHAIN_API_KEY` environment variables.
-
-For more information on other ways to set up tracing, please reference
-the [LangSmith documentation](https://docs.smith.langchain.com/docs/).
-
-**NOTE:** You can also use a context manager in python to log traces
-using
-
-
-```
-from langchain_core.tracers.context import tracing_v2_enabled  
-  
-with tracing_v2_enabled(project_name="My Project"):  
-    agent.run("How many people live in canada as of 2023?")  
-
-```
-#### API Reference:
-
-* [tracing\_v2\_enabled](https://api.python.langchain.com/en/latest/tracers/langchain_core.tracers.context.tracing_v2_enabled.html)
-However, in this example, we will use environment variables.
-
-
-```
-%pip install --upgrade --quiet  langchain langsmith langchainhub  
-%pip install --upgrade --quiet  langchain-openai tiktoken pandas duckduckgo-search  
-
-```
-
-```
-import os  
-from uuid import uuid4  
-  
-unique_id = uuid4().hex[0:8]  
-os.environ["LANGCHAIN_TRACING_V2"] = "true"  
-os.environ["LANGCHAIN_PROJECT"] = f"Tracing Walkthrough - {unique_id}"  
-os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"  
-os.environ["LANGCHAIN_API_KEY"] = "<YOUR-API-KEY>"  # Update to your API key  
-  
-# Used by the agent in this tutorial  
-os.environ["OPENAI_API_KEY"] = "<YOUR-OPENAI-API-KEY>"  
-
-```
-Create the langsmith client to interact with the API
-
-
-```
-from langsmith import Client  
-  
-client = Client()  
-
-```
-Create a LangChain component and log runs to the platform. In this
-example, we will create a ReAct-style agent with access to a general
-search tool (DuckDuckGo). The agent’s prompt can be viewed in the [Hub
-here](https://smith.langchain.com/hub/wfh/langsmith-agent-prompt).
-
-
-```
-from langchain import hub  
-from langchain.agents import AgentExecutor  
-from langchain.agents.format_scratchpad.openai_tools import (  
-    format_to_openai_tool_messages,  
-)  
-from langchain.agents.output_parsers.openai_tools import OpenAIToolsAgentOutputParser  
-from langchain_community.tools import DuckDuckGoSearchResults  
-from langchain_openai import ChatOpenAI  
-  
-# Fetches the latest version of this prompt  
-prompt = hub.pull("wfh/langsmith-agent-prompt:5d466cbc")  
-  
-llm = ChatOpenAI(  
-    model="gpt-3.5-turbo-16k",  
-    temperature=0,  
-)  
-  
-tools = [  
-    DuckDuckGoSearchResults(  
-        name="duck_duck_go"  
-    ),  # General internet search using DuckDuckGo  
-]  
-  
-llm_with_tools = llm.bind_tools(tools)  
-  
-runnable_agent = (  
-    {  
-        "input": lambda x: x["input"],  
-        "agent_scratchpad": lambda x: format_to_openai_tool_messages(  
-            x["intermediate_steps"]  
-        ),  
-    }  
-    | prompt  
-    | llm_with_tools  
-    | OpenAIToolsAgentOutputParser()  
-)  
-  
-agent_executor = AgentExecutor(  
-    agent=runnable_agent, tools=tools, handle_parsing_errors=True  
-)  
-
-```
-#### API Reference:
-
-* [AgentExecutor](https://api.python.langchain.com/en/latest/agents/langc
```

**File**: `SampleInputFiles/docs-modules-agents-quick_start.md` (removed, +0/-484)
```diff
@@ -1,484 +0,0 @@
-# Quickstart
-
-To best understand the agent framework, let’s build an agent that has
-two tools: one to look things up online, and one to look up specific
-data that we’ve loaded into a index.
-
-This will assume knowledge of [LLMs](/docs/modules/model_io/) and
-[retrieval](/docs/modules/data_connection/) so if you haven’t already
-explored those sections, it is recommended you do so.
-
-## Setup: LangSmith[​](#setup-langsmith "Direct link to Setup: LangSmith")
-
-By definition, agents take a self-determined, input-dependent sequence
-of steps before returning a user-facing output. This makes debugging
-these systems particularly tricky, and observability particularly
-important. [LangSmith](/docs/langsmith/) is especially useful for such
-cases.
-
-When building with LangChain, all steps will automatically be traced in
-LangSmith. To set up LangSmith we just need set the following
-environment variables:
-
-
-```
-export LANGCHAIN_TRACING_V2="true"  
-export LANGCHAIN_API_KEY="<your-api-key>"  
-
-```
-## Define tools[​](#define-tools "Direct link to Define tools")
-
-We first need to create the tools we want to use. We will use two tools:
-[Tavily](/docs/integrations/tools/tavily_search/) (to search online) and
-then a retriever over a local index we will create
-
-### [Tavily](/docs/integrations/tools/tavily_search/)[​](#tavily "Direct link to tavily")
-
-We have a built-in tool in LangChain to easily use Tavily search engine
-as tool. Note that this requires an API key - they have a free tier, but
-if you don’t have one or don’t want to create one, you can always ignore
-this step.
-
-Once you create your API key, you will need to export that as:
-
-
-```
-export TAVILY_API_KEY="..."  
-
-```
-
-```
-from langchain_community.tools.tavily_search import TavilySearchResults  
-
-```
-#### API Reference:
-
-* [TavilySearchResults](https://api.python.langchain.com/en/latest/tools/langchain_community.tools.tavily_search.tool.TavilySearchResults.html)
-
-```
-search = TavilySearchResults()  
-
-```
-
-```
-search.invoke("what is the weather in SF")  
-
-```
-
-```
-[{'url': 'https://www.weatherapi.com/',  
-  'content': "{'location': {'name': 'San Francisco', 'region': 'California', 'country': 'United States of America', 'lat': 37.78, 'lon': -122.42, 'tz_id': 'America/Los_Angeles', 'localtime_epoch': 1712847697, 'localtime': '2024-04-11 8:01'}, 'current': {'last_updated_epoch': 1712847600, 'last_updated': '2024-04-11 08:00', 'temp_c': 11.1, 'temp_f': 52.0, 'is_day': 1, 'condition': {'text': 'Partly cloudy', 'icon': '//cdn.weatherapi.com/weather/64x64/day/116.png', 'code': 1003}, 'wind_mph': 2.2, 'wind_kph': 3.6, 'wind_degree': 10, 'wind_dir': 'N', 'pressure_mb': 1015.0, 'pressure_in': 29.98, 'precip_mm': 0.0, 'precip_in': 0.0, 'humidity': 97, 'cloud': 25, 'feelslike_c': 11.5, 'feelslike_f': 52.6, 'vis_km': 14.0, 'vis_miles': 8.0, 'uv': 4.0, 'gust_mph': 2.8, 'gust_kph': 4.4}}"},  
- {'url': 'https://www.yahoo.com/news/april-11-2024-san-francisco-122026435.html',  
-  'content': "2024 NBA Mock Draft 6.0: Projections for every pick following March Madness With the NCAA tournament behind us, here's an updated look at Yahoo Sports' first- and second-round projections for the ..."},  
- {'url': 'https://world-weather.info/forecast/usa/san_francisco/april-2024/',  
-  'content': 'Extended weather forecast in San Francisco. Hourly Week 10 days 14 days 30 days Year. Detailed ⚡ San Francisco Weather Forecast for April 2024 - day/night 🌡️ temperatures, precipitations - World-Weather.info.'},  
- {'url': 'https://www.wunderground.com/hourly/us/ca/san-francisco/94144/date/date/2024-4-11',  
-  'content': 'Personal Weather Station. Inner Richmond (KCASANFR1685) Location: San Francisco, CA. Elevation: 207ft. Nearby Weather Stations. Hourly Forecast for Today, Thursday 04/11Hourly for Today, Thu 04/11 ...'},  
- {'url': 'https://weatherspark.com/h/y/557/2024/Historical-Weather-during-2024-in-San-Francisco-California-United-States',  
-  'content': 'San Francisco Temperature History 2024\nHourly Temperature in 2024 in San Francisco\nCompare San Francisco to another city:\nCloud Cover in 2024 in San Francisco\nDaily Precipitation in 2024 in San Francisco\nObserved Weather in 2024 in San Francisco\nHours of Daylight and Twilight in 2024 in San Francisco\nSunrise & Sunset with Twilight and Daylight Saving Time in 2024 in San Francisco\nSolar Elevation and Azimuth in 2024 in San Francisco\nMoon Rise, Set & Phases in 2024 in San Francisco\nHumidity Comfort Levels in 2024 in San Francisco\nWind Speed in 2024 in San Francisco\nHourly Wind Speed in 2024 in San Francisco\nHourly Wind Direction in 2024 in San Francisco\nAtmospheric Pressure in 2024 in San Francisco\nData Sources\n See all nearby weather stations\nLatest Report — 3:56 PM\nWed, Jan 24, 2024\xa0\xa0\xa0\xa013 min ago\xa0\xa0\xa0\xa0UTC 23:56\nCall Sign KSFO\nTemp.\n60.1°F\nPrecipitation\nNo Report\nWind\n6.9 mph\nCloud Cover\nMostly Cloudy\n1,800 ft\nR
```

**File**: `pyproject.toml` (modified, +6/-6)
```diff
@@ -15,19 +15,19 @@ dependencies = [
     "datasets>=2.18.0",
     "fastapi>=0.100.0",
     "jinja2",
-    "langchain>=0.1.0",
-    "langchain-community==0.2.7",
-    "langchain-core==0.2.20",
-    "langchain-huggingface==0.0.3",
-    "langchain-openai==0.1.17",
+    "langchain>=0.3.24",
+    "langchain-community==0.3.22",
+    "langchain-core==0.3.55",
+    "langchain-huggingface==0.1.2",
+    "langchain-openai==0.3.14",
     "opentelemetry-api>=1.23.0",
     "opentelemetry-sdk>=1.23.0",
     "opentelemetry-exporter-otlp>=1.23.0",
     "optuna",
     "platformdirs",
     "pydantic>=2.0.0",
     "python-dotenv",
-    "ragas==0.1.7",
+    "ragas==0.2.14",
     "rerankers",
     "rich>=13.0.0",
     "sentence-transformers",
```

**File**: `src/ragbuilder/config/base.py` (modified, +14/-12)
```diff
@@ -82,20 +82,22 @@ def model_post_init(self, *args, **kwargs):
         if self.study_name is None:
             # Get the caller module name (data_ingest or retriever)
             frame = inspect.currentframe()
+            caller_module = 'unknown'
+            
             while frame:
-                module_name = inspect.getmodule(frame).__name__
-                if 'data_ingest' in module_name:
-                    caller_module = 'data_ingest'
-                    break
-                elif 'retriever' in module_name:
-                    caller_module = 'retriever'
-                    break
-                elif 'generation' in module_name:
-                    caller_module = 'generation'
-                    break
+                module = inspect.getmodule(frame)
+                if module is not None:  # Check if module is not None
+                    module_name = module.__name__
+                    if 'data_ingest' in module_name:
+                        caller_module = 'data_ingest'
+                        break
+                    elif 'retriever' in module_name:
+                        caller_module = 'retriever'
+                        break
+                    elif 'generation' in module_name:
+                        caller_module = 'generation'
+                        break
                 frame = frame.f_back
-            else:
-                caller_module = 'unknown'
                 
             timestamp = int(time.time()*1000 + random.randint(1, 1000))
             self.study_name = f"{caller_module}_{timestamp}"
```

**File**: `src/ragbuilder/config/components.py` (modified, +51/-16)
```diff
@@ -35,6 +35,7 @@ class LLMType(str, Enum):
     CUSTOM = "custom"
 
 class ParserType(str, Enum):
+    TEXT = "text"
     UNSTRUCTURED = "unstructured"
     PYMUPDF = "pymupdf"
     PYPDF = "pypdf"
@@ -54,6 +55,13 @@ class ChunkingStrategy(str, Enum):
     SEMANTIC = "SemanticChunker"
     CUSTOM = "custom"
 
+NO_CHUNK_SIZE_STRATEGIES = [
+    ChunkingStrategy.MARKDOWN,
+    ChunkingStrategy.HTML,
+    ChunkingStrategy.SEMANTIC,
+    ChunkingStrategy.CUSTOM
+]
+
 class EmbeddingType(str, Enum):
     OPENAI = "openai"
     AZURE_OPENAI = "azure_openai"
@@ -123,7 +131,7 @@ def get_class():
 LLM_MAP = {
     LLMType.OPENAI: lazy_load("langchain_openai", "ChatOpenAI"),
     LLMType.AZURE_OPENAI: lazy_load("langchain_openai", "AzureChatOpenAI"),
-    LLMType.HUGGINGFACE: lazy_load("langchain_huggingface", "HuggingFaceHub"),
+    LLMType.HUGGINGFACE: lazy_load("langchain_huggingface", "HuggingFaceEndpoint"),
     LLMType.OLLAMA: lazy_load("langchain_ollama", "OllamaChat"),
     LLMType.COHERE: lazy_load("langchain_community.llms", "Cohere"),
     LLMType.VERTEXAI: lazy_load("langchain_google_vertexai", "VertexAI"),
@@ -132,6 +140,8 @@ def get_class():
 }
 
 LOADER_MAP = {
+    # ParserType.UNSTRUCTURED: lazy_load("langchain_unstructured", "UnstructuredLoader"),
+    ParserType.TEXT: lazy_load("langchain.document_loaders", "TextLoader"),
     ParserType.UNSTRUCTURED: lazy_load("langchain_community.document_loaders", "UnstructuredFileLoader"),
     ParserType.PYMUPDF: lazy_load("langchain_community.document_loaders", "PyMuPDFLoader"),
     ParserType.PYPDF: lazy_load("langchain_community.document_loaders", "PyPDFLoader"),
@@ -163,18 +173,18 @@ def get_class():
 }
 
 VECTORDB_MAP = {
-    VectorDatabase.FAISS: lazy_load("langchain.vectorstores", "FAISS"),
-    VectorDatabase.CHROMA: lazy_load("langchain.vectorstores", "Chroma"),
-    VectorDatabase.PINECONE: lazy_load("langchain.vectorstores", "Pinecone"),
-    VectorDatabase.WEAVIATE: lazy_load("langchain.vectorstores", "Weaviate"),
-    VectorDatabase.QDRANT: lazy_load("langchain.vectorstores", "Qdrant"),
-    VectorDatabase.MILVUS: lazy_load("langchain.vectorstores", "Milvus"),
-    VectorDatabase.PGVECTOR: lazy_load("langchain.vectorstores", "PGVector"),
-    VectorDatabase.ELASTICSEARCH: lazy_load("langchain.vectorstores", "ElasticsearchStore"),
+    VectorDatabase.FAISS: lazy_load("langchain_community.vectorstores", "FAISS"),
+    VectorDatabase.CHROMA: lazy_load("langchain_chroma", "Chroma"),
+    VectorDatabase.PINECONE: lazy_load("langchain_pinecone", "PineconeVectorStore"),
+    VectorDatabase.WEAVIATE: lazy_load("langchain_weaviate.vectorstores", "WeaviateVectorStore"),
+    VectorDatabase.QDRANT: lazy_load("langchain_qdrant", "QdrantVectorStore"),
+    VectorDatabase.MILVUS: lazy_load("langchain_milvus", "Milvus"),
+    VectorDatabase.PGVECTOR: lazy_load("langchain_postgres", "PGVector"),
+    VectorDatabase.ELASTICSEARCH: lazy_load("langchain-elasticsearch", "ElasticsearchStore"),
 }
 
 RETRIEVER_MAP = {
-    RetrieverType.BM25: lazy_load("langchain.retrievers", "BM25Retriever"),
+    RetrieverType.BM25: lazy_load("langchain_community.retrievers", "BM25Retriever"),
 }
 
 RERANKER_MAP = {
@@ -226,6 +236,12 @@ def get_class():
 
 # Environment variable requirements for components
 COMPONENT_ENV_REQUIREMENTS = {
+    # Unstructured
+    ParserType.UNSTRUCTURED: {
+        "required": [],
+        "optional": [],
+        "packages": [_PkgSpec("langchain-unstructured")]
+    },
     # Embedding Models
     EmbeddingType.AZURE_OPENAI: {
         "required": ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
@@ -350,40 +366,59 @@ def get_class():
     VectorDatabase.PINECONE: {
         "required": ["PINECONE_API_KEY", "PINECONE_ENVIRONMENT"],
         "optional": [],
-        "packages": [_PkgSpec("pinecone-client", "pinecone")]
+        "packages": [
+            _PkgSpec("langchain-pinecone"),
+            _PkgSpec("pinecone-client", "pinecone")
+        ]
     },
     VectorDatabase.WEAVIATE: {
         "required": ["WEAVIATE_URL", "WEAVIATE_API_KEY"],
         "optional": [],
-        "packages": [_PkgSpec("weaviate-client", "weaviate")]
+        "packages": [
+            _PkgSpec("weaviate-client", "weaviate"),
+            _PkgSpec("langchain-weaviate")
+        ]
     },
     VectorDatabase.QDRANT: {
         "required": ["QDRANT_URL"],
         "optional": ["QDRANT_API_KEY"],
-        "packages": [_PkgSpec("qdrant-client", "qdrant")]
+        "packages": [
+            _PkgSpec("qdrant-client", "qdrant"),
+            _PkgSpec("langchain-qdrant")
+        ]
     },
     VectorDatabase.MILVUS: {
         "required": ["MILVUS_HOST", "MILVUS_PORT"],
         "optional": [],
-        "packages": [_PkgSpec("pymilvus")]
+        "packages": [
+            _PkgSpec("pymilvus"),
+            _PkgSpec("langchain-milvus")
+        ]
     },
     VectorDatabase.PGVECTOR: {
         "required": ["PGVECTOR_CONNECTION_STRING"],
         "optional": [],
         
```

**File**: `src/ragbuilder/config/generation.py` (modified, +7/-7)
```diff
@@ -17,8 +17,8 @@ class PromptTemplate(BaseModel):
 
 # Define the Execution Model for Each Question
 class QuestionContext(BaseModel):
-    question: str
-    ground_truth: str
+    user_input: str
+    reference: str
 
 
 
@@ -40,23 +40,23 @@ class ExecutionResult(BaseModel):
 
 
 class EvalDatasetItem(BaseModel):
-    question: str
-    ground_truth: str
+    user_input: str
+    reference: str
     contexts: Optional[str] = None  # Optional field
     evolution_type: Optional[str] = None
     metadata: Optional[str] = None
     episode_done: Optional[bool] = None
 
-    @field_validator('question', mode='before')
+    @field_validator('user_input', mode='before')
     def check_question(cls, v):
         if not v.strip():
             raise ValueError('Question is required and cannot be empty.')
         return v
     
-    @field_validator('ground_truth', mode='before')
+    @field_validator('reference', mode='before')
     def check_ground_truth(cls, v):
         if not v.strip():
-            raise ValueError('Ground truth is required and cannot be empty.')
+            raise ValueError('Reference is required and cannot be empty.')
         return v
 
 class EvalDataset(BaseModel):
```

**File**: `src/ragbuilder/core/callbacks.py` (modified, +71/-51)
```diff
@@ -219,7 +219,7 @@ def _log_trial(self, trial: Trial=None, results: Dict[str, Any]=None, eval_resul
                     elif self.module_type == "data_ingest":
                         self._log_data_ingest_trial(cursor, eval_id, trial, results)
                     elif self.module_type == "generation":
-                        self._log_generation_trial(cursor,eval_id,eval_results,final_results)
+                        self._log_generation_trial(cursor, eval_id, trial, results)
                     
                     conn.commit()
                     return eval_id
@@ -330,12 +330,41 @@ def _log_data_ingest_trial(self, cursor, eval_id: int, trial: Trial, results: Di
                 for idx, detail in enumerate(results['question_details'])
             ]
         )
-    def _log_generation_trial(self, cursor, eval_id: int, eval_results: Dataset, final_results: Dataset):
+
+    def _log_generation_trial(self, cursor, eval_id: int, trial: Trial, results: Dict[str, Any]):
         """Log generation trial results."""
         try:
-            # Assuming eval_results has fields that match your database schema
-            for record in eval_results:
-                cursor.execute(
+            # Extract prompt_key and prompt based on summary type
+            summary = results.get('summary', {})
+            prompt_key = summary.get('prompt_key', '')
+            prompt = summary.get('prompt', '')
+            
+            # Log summary metrics
+            cursor.execute(
+                """
+                INSERT INTO generation_eval_summary (
+                    run_id,
+                    eval_id,
+                    prompt_key,
+                    prompt,
+                    config,
+                    average_correctness
+                ) VALUES (?, ?, ?, ?, ?, ?)
+                """,
+                (
+                    self.run_id,
+                    eval_id,
+                    prompt_key,
+                    prompt,
+                    json.dumps(results.get('config', {})),
+                    results.get('score', 0.0)
+                )
+            )
+            
+            # Log detailed results if available
+            detailed_results = results.get('detailed_results', [])
+            if detailed_results:
+                cursor.executemany(
                     """
                     INSERT INTO generation_eval_details (
                         eval_id,
@@ -348,63 +377,54 @@ def _log_generation_trial(self, cursor, eval_id: int, eval_results: Dataset, fin
                         answer_correctness
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     """,
-                    (
-                        eval_id,
-                        record['question_id'],  # Adjust according to your Dataset structure
-                        record['question'],      # Adjust according to your Dataset structure
-                        record['answer'], 
-                        record.get('ground_truth', ''),  # Adjust according to your Dataset structure
-                        record.get('prompt_key', ''),
-                        record.get('prompt', ''),          # Adjust according to your Dataset structure
-                        record.get('answer_correctness', None)  # Optional field
-                        # record.get('error', None),          # Optional field
-                        # record['eval_timestamp']  # Adjust according to your Dataset structure
-                    )
-                )
-            results_df = eval_results.to_pandas()
-            grouped_results = (
-                results_df.groupby('prompt_key')
-                .agg(
-                    prompt=('prompt', 'first'),
-                    config=('config', 'first'),
-                    average_correctness=('answer_correctness', 'mean')
+                    [
+                        (
+                            eval_id,
+                            idx,
+                            detail.get('user_input', ''),
+                            detail.get('response', ''),
+                            detail.get('reference', ''),
+                            prompt_key,
+                            prompt,
+                            detail.get('answer_correctness', 0.0)
+                        )
+                        for idx, detail in enumerate(detailed_results)
+                    ]
                 )
-                .reset_index())
-            for record in Dataset.from_pandas(grouped_results):
-                cursor.execute(
-                    """
-                    INSERT INTO generation_eval_summary (
-                        run_id,
-                        eval_id,
-                        prompt_key,
-                        prompt,
-                        config,
-                        average_correctness
-                    ) VALUES (?, ?, ?, ?, ?, ?)
-                    """,
-                    (
-                        self.run_i
```

---

### Incident Patch 6: `da135a5b` (2025-04-30)
**Commit Message**: Testing scripts + Minor fixes

**File**: `SampleInputFiles/docs-get_started-quickstart.md` (removed, +0/-804)
```diff
@@ -1,804 +0,0 @@
-# Quickstart
-
-In this quickstart we'll show you how to:
-
-* Get setup with LangChain, LangSmith and LangServe
-* Use the most basic and common components of LangChain: prompt templates, models, and output parsers
-* Use LangChain Expression Language, the protocol that LangChain is built on and which facilitates component chaining
-* Build a simple application with LangChain
-* Trace your application with LangSmith
-* Serve your application with LangServe
-
-That's a fair amount to cover! Let's dive in.
-
-## Setup[​](#setup "Direct link to Setup")
-
-### Jupyter Notebook[​](#jupyter-notebook "Direct link to Jupyter Notebook")
-
-This guide (and most of the other guides in the documentation) uses [Jupyter notebooks](https://jupyter.org/) and assumes the reader is as well. Jupyter notebooks are perfect for learning how to work with LLM systems because oftentimes things can go wrong (unexpected output, API down, etc) and going through guides in an interactive environment is a great way to better understand them.
-
-You do not NEED to go through the guide in a Jupyter Notebook, but it is recommended. See [here](https://jupyter.org/install) for instructions on how to install.
-
-### Installation[​](#installation "Direct link to Installation")
-
-To install LangChain run:
-
-* Pip
-* Conda
-
-
-```
-pip install langchain  
-
-```
-
-```
-conda install langchain -c conda-forge  
-
-```
-For more details, see our [Installation guide](/docs/get_started/installation/).
-
-### LangSmith[​](#langsmith "Direct link to LangSmith")
-
-Many of the applications you build with LangChain will contain multiple steps with multiple invocations of LLM calls.
-As these applications get more and more complex, it becomes crucial to be able to inspect what exactly is going on inside your chain or agent.
-The best way to do this is with [LangSmith](https://smith.langchain.com).
-
-Note that LangSmith is not needed, but it is helpful.
-If you do want to use LangSmith, after you sign up at the link above, make sure to set your environment variables to start logging traces:
-
-
-```
-export LANGCHAIN_TRACING_V2="true"  
-export LANGCHAIN_API_KEY="..."  
-
-```
-## Building with LangChain[​](#building-with-langchain "Direct link to Building with LangChain")
-
-LangChain enables building application that connect external sources of data and computation to LLMs.
-In this quickstart, we will walk through a few different ways of doing that.
-We will start with a simple LLM chain, which just relies on information in the prompt template to respond.
-Next, we will build a retrieval chain, which fetches data from a separate database and passes that into the prompt template.
-We will then add in chat history, to create a conversation retrieval chain. This allows you to interact in a chat manner with this LLM, so it remembers previous questions.
-Finally, we will build an agent - which utilizes an LLM to determine whether or not it needs to fetch data to answer questions.
-We will cover these at a high level, but there are lot of details to all of these!
-We will link to relevant docs.
-
-## LLM Chain[​](#llm-chain "Direct link to LLM Chain")
-
-We'll show how to use models available via API, like OpenAI, and local open source models, using integrations like Ollama.
-
-* OpenAI
-* Local (using Ollama)
-* Anthropic
-* Cohere
-
-First we'll need to import the LangChain x OpenAI integration package.
-
-
-```
-pip install langchain-openai  
-
-```
-Accessing the API requires an API key, which you can get by creating an account and heading [here](https://platform.openai.com/account/api-keys). Once we have a key we'll want to set it as an environment variable by running:
-
-
-```
-export OPENAI_API_KEY="..."  
-
-```
-We can then initialize the model:
-
-
-```
-from langchain_openai import ChatOpenAI  
-  
-llm = ChatOpenAI()  
-
-```
-#### API Reference:
-
-* [ChatOpenAI](https://api.python.langchain.com/en/latest/chat_models/langchain_openai.chat_models.base.ChatOpenAI.html)
-If you'd prefer not to set an environment variable you can pass the key in directly via the `api_key` named parameter when initiating the OpenAI LLM class:
-
-
-```
-from langchain_openai import ChatOpenAI  
-  
-llm = ChatOpenAI(api_key="...")  
-
-```
-#### API Reference:
-
-* [ChatOpenAI](https://api.python.langchain.com/en/latest/chat_models/langchain_openai.chat_models.base.ChatOpenAI.html)
-[Ollama](https://ollama.ai/) allows you to run open-source large language models, such as Llama 2, locally.
-
-First, follow [these instructions](https://github.com/jmorganca/ollama) to set up and run a local Ollama instance:
-
-* [Download](https://ollama.ai/download)
-* Fetch a model via `ollama pull llama2`
-
-Then, make sure the Ollama server is running. After that, you can do:
-
-
-```
-from langchain_community.llms import Ollama  
-llm = Ollama(model="llama2")  
-
-```
-#### API Reference:
-
-* [Ollama](https://api.python.langchain.com/en/latest/llms/langchain_
```

**File**: `SampleInputFiles/docs-langsmith-walkthrough.md` (removed, +0/-532)
```diff
@@ -1,532 +0,0 @@
-# LangSmith Walkthrough
-
-[![](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/langchain-ai/langchain/blob/master/docs/docs/langsmith/walkthrough.ipynb)
-
-Open In Colab
-
-LangChain makes it easy to prototype LLM applications and Agents.
-However, delivering LLM applications to production can be deceptively
-difficult. You will have to iterate on your prompts, chains, and other
-components to build a high-quality product.
-
-LangSmith makes it easy to debug, test, and continuously improve your
-LLM applications.
-
-When might this come in handy? You may find it useful when you want to:
-
-* Quickly debug a new chain, agent, or set of tools
-* Create and manage datasets for fine-tuning, few-shot prompting, and
-evaluation
-* Run regression tests on your application to confidently develop
-* Capture production analytics for product insights and continuous
-improvements
-
-## Prerequisites[​](#prerequisites "Direct link to Prerequisites")
-
-**[Create a LangSmith account](https://smith.langchain.com/) and create
-an API key (see bottom left corner). Familiarize yourself with the
-platform by looking through the
-[docs](https://docs.smith.langchain.com/)**
-
-Note LangSmith is in closed beta; we’re in the process of rolling it out
-to more users. However, you can fill out the form on the website for
-expedited access.
-
-Now, let’s get started!
-
-## Log runs to LangSmith[​](#log-runs-to-langsmith "Direct link to Log runs to LangSmith")
-
-First, configure your environment variables to tell LangChain to log
-traces. This is done by setting the `LANGCHAIN_TRACING_V2` environment
-variable to true. You can tell LangChain which project to log to by
-setting the `LANGCHAIN_PROJECT` environment variable (if this isn’t set,
-runs will be logged to the `default` project). This will automatically
-create the project for you if it doesn’t exist. You must also set the
-`LANGCHAIN_ENDPOINT` and `LANGCHAIN_API_KEY` environment variables.
-
-For more information on other ways to set up tracing, please reference
-the [LangSmith documentation](https://docs.smith.langchain.com/docs/).
-
-**NOTE:** You can also use a context manager in python to log traces
-using
-
-
-```
-from langchain_core.tracers.context import tracing_v2_enabled  
-  
-with tracing_v2_enabled(project_name="My Project"):  
-    agent.run("How many people live in canada as of 2023?")  
-
-```
-#### API Reference:
-
-* [tracing\_v2\_enabled](https://api.python.langchain.com/en/latest/tracers/langchain_core.tracers.context.tracing_v2_enabled.html)
-However, in this example, we will use environment variables.
-
-
-```
-%pip install --upgrade --quiet  langchain langsmith langchainhub  
-%pip install --upgrade --quiet  langchain-openai tiktoken pandas duckduckgo-search  
-
-```
-
-```
-import os  
-from uuid import uuid4  
-  
-unique_id = uuid4().hex[0:8]  
-os.environ["LANGCHAIN_TRACING_V2"] = "true"  
-os.environ["LANGCHAIN_PROJECT"] = f"Tracing Walkthrough - {unique_id}"  
-os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"  
-os.environ["LANGCHAIN_API_KEY"] = "<YOUR-API-KEY>"  # Update to your API key  
-  
-# Used by the agent in this tutorial  
-os.environ["OPENAI_API_KEY"] = "<YOUR-OPENAI-API-KEY>"  
-
-```
-Create the langsmith client to interact with the API
-
-
-```
-from langsmith import Client  
-  
-client = Client()  
-
-```
-Create a LangChain component and log runs to the platform. In this
-example, we will create a ReAct-style agent with access to a general
-search tool (DuckDuckGo). The agent’s prompt can be viewed in the [Hub
-here](https://smith.langchain.com/hub/wfh/langsmith-agent-prompt).
-
-
-```
-from langchain import hub  
-from langchain.agents import AgentExecutor  
-from langchain.agents.format_scratchpad.openai_tools import (  
-    format_to_openai_tool_messages,  
-)  
-from langchain.agents.output_parsers.openai_tools import OpenAIToolsAgentOutputParser  
-from langchain_community.tools import DuckDuckGoSearchResults  
-from langchain_openai import ChatOpenAI  
-  
-# Fetches the latest version of this prompt  
-prompt = hub.pull("wfh/langsmith-agent-prompt:5d466cbc")  
-  
-llm = ChatOpenAI(  
-    model="gpt-3.5-turbo-16k",  
-    temperature=0,  
-)  
-  
-tools = [  
-    DuckDuckGoSearchResults(  
-        name="duck_duck_go"  
-    ),  # General internet search using DuckDuckGo  
-]  
-  
-llm_with_tools = llm.bind_tools(tools)  
-  
-runnable_agent = (  
-    {  
-        "input": lambda x: x["input"],  
-        "agent_scratchpad": lambda x: format_to_openai_tool_messages(  
-            x["intermediate_steps"]  
-        ),  
-    }  
-    | prompt  
-    | llm_with_tools  
-    | OpenAIToolsAgentOutputParser()  
-)  
-  
-agent_executor = AgentExecutor(  
-    agent=runnable_agent, tools=tools, handle_parsing_errors=True  
-)  
-
-```
-#### API Reference:
-
-* [AgentExecutor](https://api.python.langchain.com/en/latest/agents/langc
```

**File**: `SampleInputFiles/docs-modules-agents-quick_start.md` (removed, +0/-484)
```diff
@@ -1,484 +0,0 @@
-# Quickstart
-
-To best understand the agent framework, let’s build an agent that has
-two tools: one to look things up online, and one to look up specific
-data that we’ve loaded into a index.
-
-This will assume knowledge of [LLMs](/docs/modules/model_io/) and
-[retrieval](/docs/modules/data_connection/) so if you haven’t already
-explored those sections, it is recommended you do so.
-
-## Setup: LangSmith[​](#setup-langsmith "Direct link to Setup: LangSmith")
-
-By definition, agents take a self-determined, input-dependent sequence
-of steps before returning a user-facing output. This makes debugging
-these systems particularly tricky, and observability particularly
-important. [LangSmith](/docs/langsmith/) is especially useful for such
-cases.
-
-When building with LangChain, all steps will automatically be traced in
-LangSmith. To set up LangSmith we just need set the following
-environment variables:
-
-
-```
-export LANGCHAIN_TRACING_V2="true"  
-export LANGCHAIN_API_KEY="<your-api-key>"  
-
-```
-## Define tools[​](#define-tools "Direct link to Define tools")
-
-We first need to create the tools we want to use. We will use two tools:
-[Tavily](/docs/integrations/tools/tavily_search/) (to search online) and
-then a retriever over a local index we will create
-
-### [Tavily](/docs/integrations/tools/tavily_search/)[​](#tavily "Direct link to tavily")
-
-We have a built-in tool in LangChain to easily use Tavily search engine
-as tool. Note that this requires an API key - they have a free tier, but
-if you don’t have one or don’t want to create one, you can always ignore
-this step.
-
-Once you create your API key, you will need to export that as:
-
-
-```
-export TAVILY_API_KEY="..."  
-
-```
-
-```
-from langchain_community.tools.tavily_search import TavilySearchResults  
-
-```
-#### API Reference:
-
-* [TavilySearchResults](https://api.python.langchain.com/en/latest/tools/langchain_community.tools.tavily_search.tool.TavilySearchResults.html)
-
-```
-search = TavilySearchResults()  
-
-```
-
-```
-search.invoke("what is the weather in SF")  
-
-```
-
-```
-[{'url': 'https://www.weatherapi.com/',  
-  'content': "{'location': {'name': 'San Francisco', 'region': 'California', 'country': 'United States of America', 'lat': 37.78, 'lon': -122.42, 'tz_id': 'America/Los_Angeles', 'localtime_epoch': 1712847697, 'localtime': '2024-04-11 8:01'}, 'current': {'last_updated_epoch': 1712847600, 'last_updated': '2024-04-11 08:00', 'temp_c': 11.1, 'temp_f': 52.0, 'is_day': 1, 'condition': {'text': 'Partly cloudy', 'icon': '//cdn.weatherapi.com/weather/64x64/day/116.png', 'code': 1003}, 'wind_mph': 2.2, 'wind_kph': 3.6, 'wind_degree': 10, 'wind_dir': 'N', 'pressure_mb': 1015.0, 'pressure_in': 29.98, 'precip_mm': 0.0, 'precip_in': 0.0, 'humidity': 97, 'cloud': 25, 'feelslike_c': 11.5, 'feelslike_f': 52.6, 'vis_km': 14.0, 'vis_miles': 8.0, 'uv': 4.0, 'gust_mph': 2.8, 'gust_kph': 4.4}}"},  
- {'url': 'https://www.yahoo.com/news/april-11-2024-san-francisco-122026435.html',  
-  'content': "2024 NBA Mock Draft 6.0: Projections for every pick following March Madness With the NCAA tournament behind us, here's an updated look at Yahoo Sports' first- and second-round projections for the ..."},  
- {'url': 'https://world-weather.info/forecast/usa/san_francisco/april-2024/',  
-  'content': 'Extended weather forecast in San Francisco. Hourly Week 10 days 14 days 30 days Year. Detailed ⚡ San Francisco Weather Forecast for April 2024 - day/night 🌡️ temperatures, precipitations - World-Weather.info.'},  
- {'url': 'https://www.wunderground.com/hourly/us/ca/san-francisco/94144/date/date/2024-4-11',  
-  'content': 'Personal Weather Station. Inner Richmond (KCASANFR1685) Location: San Francisco, CA. Elevation: 207ft. Nearby Weather Stations. Hourly Forecast for Today, Thursday 04/11Hourly for Today, Thu 04/11 ...'},  
- {'url': 'https://weatherspark.com/h/y/557/2024/Historical-Weather-during-2024-in-San-Francisco-California-United-States',  
-  'content': 'San Francisco Temperature History 2024\nHourly Temperature in 2024 in San Francisco\nCompare San Francisco to another city:\nCloud Cover in 2024 in San Francisco\nDaily Precipitation in 2024 in San Francisco\nObserved Weather in 2024 in San Francisco\nHours of Daylight and Twilight in 2024 in San Francisco\nSunrise & Sunset with Twilight and Daylight Saving Time in 2024 in San Francisco\nSolar Elevation and Azimuth in 2024 in San Francisco\nMoon Rise, Set & Phases in 2024 in San Francisco\nHumidity Comfort Levels in 2024 in San Francisco\nWind Speed in 2024 in San Francisco\nHourly Wind Speed in 2024 in San Francisco\nHourly Wind Direction in 2024 in San Francisco\nAtmospheric Pressure in 2024 in San Francisco\nData Sources\n See all nearby weather stations\nLatest Report — 3:56 PM\nWed, Jan 24, 2024\xa0\xa0\xa0\xa013 min ago\xa0\xa0\xa0\xa0UTC 23:56\nCall Sign KSFO\nTemp.\n60.1°F\nPrecipitation\nNo Report\nWind\n6.9 mph\nCloud Cover\nMostly Cloudy\n1,800 ft\nR
```

**File**: `pyproject.toml` (modified, +5/-5)
```diff
@@ -15,11 +15,11 @@ dependencies = [
     "datasets>=2.18.0",
     "fastapi>=0.100.0",
     "jinja2",
-    "langchain>=0.1.0",
-    "langchain-community==0.2.7",
-    "langchain-core==0.2.20",
-    "langchain-huggingface==0.0.3",
-    "langchain-openai==0.1.17",
+    "langchain>=0.3.24",
+    "langchain-community==0.3.22",
+    "langchain-core==0.3.55",
+    "langchain-huggingface==0.1.2",
+    "langchain-openai==0.3.14",
     "opentelemetry-api>=1.23.0",
     "opentelemetry-sdk>=1.23.0",
     "opentelemetry-exporter-otlp>=1.23.0",
```

**File**: `run_tests.py` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
+#!/usr/bin/env python3
+"""
+Test runner for RAGBuilder v2 testing suite.
+Runs all tests and generates a summary report.
+"""
+
+import os
+import sys
+import unittest
+import time
+from datetime import datetime
+import json
+from pathlib import Path
+import argparse
+import importlib.util
+
+def import_module(module_name, file_path):
+    """Safely import a module, returning None if import fails"""
+    try:
+        spec = importlib.util.spec_from_file_location(module_name, file_path)
+        if not spec:
+            print(f"Could not find module {module_name} at {file_path}")
+            return None
+        
+        module = importlib.util.module_from_spec(spec)
+        spec.loader.exec_module(module)
+        return module
+    except Exception as e:
+        print(f"Error importing {module_name}: {e}")
+        return None
+
+def load_test_modules():
+    """Load available test modules"""
+    current_dir = Path.cwd()
+    modules = []
+    
+    # Check for test_minimal.py
+    minimal_path = current_dir / "test_minimal.py"
+    if minimal_path.exists():
+        minimal_module = import_module("test_minimal", minimal_path)
+        if minimal_module:
+            modules.append(minimal_module)
+    
+    # Check for test_ragbuilder.py
+    basic_path = current_dir / "test_ragbuilder.py"
+    if basic_path.exists():
+        basic_module = import_module("test_ragbuilder", basic_path)
+        if basic_module:
+            modules.append(basic_module)
+    
+    # Check for test_ragbuilder_advanced.py
+    adv_path = current_dir / "test_ragbuilder_advanced.py"
+    if adv_path.exists():
+        adv_module = import_module("test_ragbuilder_advanced", adv_path)
+        if adv_module:
+            modules.append(adv_module)
+    
+    # Check for test_ragbuilder_edge_cases.py
+    edge_path = current_dir / "test_ragbuilder_edge_cases.py"
+    if edge_path.exists():
+        edge_module = import_module("test_ragbuilder_edge_cases", edge_path)
+        if edge_module:
+            modules.append(edge_module)
+    
+    return modules
+
+def run_tests(test_modules, verbosity=2, output_dir=None):
+    """Run the specified test modules and generate a report"""
+    if not test_modules:
+        print("No test modules were successfully loaded.")
+        return 1
+    
+    # Set up output directory
+    if output_dir:
+        os.makedirs(output_dir, exist_ok=True)
+    
+    # Initialize results dictionary for storing test outcomes
+    results = {
+        "timestamp": datetime.now().isoformat(),
+        "summary": {
+            "total": 0,
+            "passed": 0,
+            "failed": 0,
+            "errors": 0,
+            "skipped": 0
+        },
+        "modules": {}
+    }
+    
+    # Run each test module and collect results
+    start_time = time.time()
+    for module in test_modules:
+        module_name = module.__name__
+        print(f"\n--- Running tests in {module_name} ---\n")
+        
+        # Create a test suite from the module
+        suite = unittest.TestLoader().loadTestsFromModule(module)
+        
+        # Run the tests and collect results
+        module_result = unittest.TextTestRunner(verbosity=verbosity).run(suite)
+        
+        # Store results for this module
+        results["modules"][module_name] = {
+            "total": module_result.testsRun,
+            "passed": module_result.testsRun - len(module_result.failures) - len(module_result.errors) - len(module_result.skipped),
+            "failed": len(module_result.failures),
+            "errors": len(module_result.errors),
+            "skipped": len(module_result.skipped),
+            "failures": [f"{failure[0]}: {str(failure[1])}" for failure in module_result.failures],
+            "error_details": [f"{error[0]}: {str(error[1])}" for error in module_result.errors]
+        }
+        
+        # Update summary stats
+        results["summary"]["total"] += module_result.testsRun
+        results["summary"]["passed"] += (module_result.testsRun - len(module_result.failures) - 
+                                        len(module_result.errors) - len(module_result.skipped))
+        results["summary"]["failed"] += len(module_result.failures)
+        results["summary"]["errors"] += len(module_result.errors)
+        results["summary"]["skipped"] += len(module_result.skipped)
+    
+    # Calculate total runtime
+    end_time = time.time()
+    results["runtime_seconds"] = round(end_time - start_time, 2)
+    
+    # Print summary
+    print("\n--- Test Summary ---")
+    print(f"Total tests: {results['summary']['total']}")
+    print(f"Passed: {results['summary']['passed']}")
+    print(f"Failed: {results['summary']['failed']}")
+    print(f"Errors: {results['summary']['errors']}")
+    print(f"Skipped: {results['summary']['skipped']}")
+    print(f"Runtime: {results['runtime_seconds']} seconds")
+    
+    # Save results to file if output directory is specified
+    if output_dir:
```

**File**: `src/ragbuilder/config/base.py` (modified, +14/-12)
```diff
@@ -82,20 +82,22 @@ def model_post_init(self, *args, **kwargs):
         if self.study_name is None:
             # Get the caller module name (data_ingest or retriever)
             frame = inspect.currentframe()
+            caller_module = 'unknown'
+            
             while frame:
-                module_name = inspect.getmodule(frame).__name__
-                if 'data_ingest' in module_name:
-                    caller_module = 'data_ingest'
-                    break
-                elif 'retriever' in module_name:
-                    caller_module = 'retriever'
-                    break
-                elif 'generation' in module_name:
-                    caller_module = 'generation'
-                    break
+                module = inspect.getmodule(frame)
+                if module is not None:  # Check if module is not None
+                    module_name = module.__name__
+                    if 'data_ingest' in module_name:
+                        caller_module = 'data_ingest'
+                        break
+                    elif 'retriever' in module_name:
+                        caller_module = 'retriever'
+                        break
+                    elif 'generation' in module_name:
+                        caller_module = 'generation'
+                        break
                 frame = frame.f_back
-            else:
-                caller_module = 'unknown'
                 
             timestamp = int(time.time()*1000 + random.randint(1, 1000))
             self.study_name = f"{caller_module}_{timestamp}"
```

**File**: `src/ragbuilder/config/components.py` (modified, +51/-16)
```diff
@@ -35,6 +35,7 @@ class LLMType(str, Enum):
     CUSTOM = "custom"
 
 class ParserType(str, Enum):
+    TEXT = "text"
     UNSTRUCTURED = "unstructured"
     PYMUPDF = "pymupdf"
     PYPDF = "pypdf"
@@ -54,6 +55,13 @@ class ChunkingStrategy(str, Enum):
     SEMANTIC = "SemanticChunker"
     CUSTOM = "custom"
 
+NO_CHUNK_SIZE_STRATEGIES = [
+    ChunkingStrategy.MARKDOWN,
+    ChunkingStrategy.HTML,
+    ChunkingStrategy.SEMANTIC,
+    ChunkingStrategy.CUSTOM
+]
+
 class EmbeddingType(str, Enum):
     OPENAI = "openai"
     AZURE_OPENAI = "azure_openai"
@@ -123,7 +131,7 @@ def get_class():
 LLM_MAP = {
     LLMType.OPENAI: lazy_load("langchain_openai", "ChatOpenAI"),
     LLMType.AZURE_OPENAI: lazy_load("langchain_openai", "AzureChatOpenAI"),
-    LLMType.HUGGINGFACE: lazy_load("langchain_huggingface", "HuggingFaceHub"),
+    LLMType.HUGGINGFACE: lazy_load("langchain_huggingface", "HuggingFaceEndpoint"),
     LLMType.OLLAMA: lazy_load("langchain_ollama", "OllamaChat"),
     LLMType.COHERE: lazy_load("langchain_community.llms", "Cohere"),
     LLMType.VERTEXAI: lazy_load("langchain_google_vertexai", "VertexAI"),
@@ -132,6 +140,8 @@ def get_class():
 }
 
 LOADER_MAP = {
+    # ParserType.UNSTRUCTURED: lazy_load("langchain_unstructured", "UnstructuredLoader"),
+    ParserType.TEXT: lazy_load("langchain.document_loaders", "TextLoader"),
     ParserType.UNSTRUCTURED: lazy_load("langchain_community.document_loaders", "UnstructuredFileLoader"),
     ParserType.PYMUPDF: lazy_load("langchain_community.document_loaders", "PyMuPDFLoader"),
     ParserType.PYPDF: lazy_load("langchain_community.document_loaders", "PyPDFLoader"),
@@ -163,18 +173,18 @@ def get_class():
 }
 
 VECTORDB_MAP = {
-    VectorDatabase.FAISS: lazy_load("langchain.vectorstores", "FAISS"),
-    VectorDatabase.CHROMA: lazy_load("langchain.vectorstores", "Chroma"),
-    VectorDatabase.PINECONE: lazy_load("langchain.vectorstores", "Pinecone"),
-    VectorDatabase.WEAVIATE: lazy_load("langchain.vectorstores", "Weaviate"),
-    VectorDatabase.QDRANT: lazy_load("langchain.vectorstores", "Qdrant"),
-    VectorDatabase.MILVUS: lazy_load("langchain.vectorstores", "Milvus"),
-    VectorDatabase.PGVECTOR: lazy_load("langchain.vectorstores", "PGVector"),
-    VectorDatabase.ELASTICSEARCH: lazy_load("langchain.vectorstores", "ElasticsearchStore"),
+    VectorDatabase.FAISS: lazy_load("langchain_community.vectorstores", "FAISS"),
+    VectorDatabase.CHROMA: lazy_load("langchain_chroma", "Chroma"),
+    VectorDatabase.PINECONE: lazy_load("langchain_pinecone", "PineconeVectorStore"),
+    VectorDatabase.WEAVIATE: lazy_load("langchain_weaviate.vectorstores", "WeaviateVectorStore"),
+    VectorDatabase.QDRANT: lazy_load("langchain_qdrant", "QdrantVectorStore"),
+    VectorDatabase.MILVUS: lazy_load("langchain_milvus", "Milvus"),
+    VectorDatabase.PGVECTOR: lazy_load("langchain_postgres", "PGVector"),
+    VectorDatabase.ELASTICSEARCH: lazy_load("langchain-elasticsearch", "ElasticsearchStore"),
 }
 
 RETRIEVER_MAP = {
-    RetrieverType.BM25: lazy_load("langchain.retrievers", "BM25Retriever"),
+    RetrieverType.BM25: lazy_load("langchain_community.retrievers", "BM25Retriever"),
 }
 
 RERANKER_MAP = {
@@ -226,6 +236,12 @@ def get_class():
 
 # Environment variable requirements for components
 COMPONENT_ENV_REQUIREMENTS = {
+    # Unstructured
+    ParserType.UNSTRUCTURED: {
+        "required": [],
+        "optional": [],
+        "packages": [_PkgSpec("langchain-unstructured")]
+    },
     # Embedding Models
     EmbeddingType.AZURE_OPENAI: {
         "required": ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"],
@@ -350,40 +366,59 @@ def get_class():
     VectorDatabase.PINECONE: {
         "required": ["PINECONE_API_KEY", "PINECONE_ENVIRONMENT"],
         "optional": [],
-        "packages": [_PkgSpec("pinecone-client", "pinecone")]
+        "packages": [
+            _PkgSpec("langchain-pinecone"),
+            _PkgSpec("pinecone-client", "pinecone")
+        ]
     },
     VectorDatabase.WEAVIATE: {
         "required": ["WEAVIATE_URL", "WEAVIATE_API_KEY"],
         "optional": [],
-        "packages": [_PkgSpec("weaviate-client", "weaviate")]
+        "packages": [
+            _PkgSpec("weaviate-client", "weaviate"),
+            _PkgSpec("langchain-weaviate")
+        ]
     },
     VectorDatabase.QDRANT: {
         "required": ["QDRANT_URL"],
         "optional": ["QDRANT_API_KEY"],
-        "packages": [_PkgSpec("qdrant-client", "qdrant")]
+        "packages": [
+            _PkgSpec("qdrant-client", "qdrant"),
+            _PkgSpec("langchain-qdrant")
+        ]
     },
     VectorDatabase.MILVUS: {
         "required": ["MILVUS_HOST", "MILVUS_PORT"],
         "optional": [],
-        "packages": [_PkgSpec("pymilvus")]
+        "packages": [
+            _PkgSpec("pymilvus"),
+            _PkgSpec("langchain-milvus")
+        ]
     },
     VectorDatabase.PGVECTOR: {
         "required": ["PGVECTOR_CONNECTION_STRING"],
         "optional": [],
         
```

**File**: `src/ragbuilder/core/utils.py` (modified, +6/-3)
```diff
@@ -5,9 +5,10 @@
 from dotenv import load_dotenv
 from langchain_community.document_loaders import (
     DirectoryLoader, 
-    WebBaseLoader, 
+    WebBaseLoader,
     UnstructuredFileLoader
 )
+# from langchain_unstructured import UnstructuredLoader
 from langchain_core.documents import Document
 from ragbuilder.config.components import COMPONENT_ENV_REQUIREMENTS, ParserType
 from ragbuilder.config.data_ingest import DataIngestOptionsConfig
@@ -185,7 +186,9 @@ def validate_component_env(component_value: str) -> Tuple[List[str], List[str]]:
             nltk_resources = ['punkt', 'punkt_tab', 'averaged_perceptron_tagger']
             for resource in nltk_resources:
                 try:
-                    nltk.data.find(f'tokenizers/{resource}')
+                    # Determine the correct path prefix based on resource type
+                    path_prefix = "taggers" if resource == "averaged_perceptron_tagger" else "tokenizers"
+                    nltk.data.find(f'{path_prefix}/{resource}')
                 except LookupError:
                     try:
                         logger.info(f"Downloading required NLTK data '{resource}' for unstructured parser...")
@@ -198,7 +201,7 @@ def validate_component_env(component_value: str) -> Tuple[List[str], List[str]]:
             missing_packages.append("nltk")
         except Exception as e:
             logger.warning(f"Failed to validate/download NLTK data: {str(e)}")
-            missing_packages.extend([f"nltk[{resource}]" for resource in nltk_resources])
+            missing_packages.extend([f"nltk[{res}]" for res in nltk_resources])
     
     return missing_env, missing_packages
 
```

---

### Incident Patch 7: `108e4a1e` (2025-02-03)
**Commit Message**: Merge pull request #86 from KruxAI/data-ingest-sdk

Demo - Friends transcripts

**File**: `demo/Friends/friends_golden_data_generator.py` (added, +676/-0)
```diff
@@ -0,0 +1,676 @@
+import logging
+from dataclasses import dataclass
+from pathlib import Path
+import typing as t
+import re
+import pandas as pd
+import numpy as np
+from tqdm import tqdm
+from sklearn.metrics.pairwise import cosine_similarity
+from tenacity import (
+    retry,
+    stop_after_attempt,
+    wait_exponential,
+    retry_if_exception_type
+)
+import json
+import copy
+
+from ragas.testset import TestsetGenerator, TestsetSample, Testset
+from ragas.testset.synthesizers import default_query_distribution
+from ragas.testset.persona import Persona
+from ragas.testset.graph import KnowledgeGraph, Node, NodeType
+from ragas.testset.transforms.extractors import NERExtractor, SummaryExtractor, ThemesExtractor, EmbeddingExtractor
+from ragas.embeddings.base import BaseRagasEmbeddings
+from ragas.llms.base import BaseRagasLLM
+
+from openai import OpenAI, RateLimitError, APIError
+from nemo_curator import OpenAIClient
+from ragas.testset.transforms import apply_transforms, Parallel
+from ragas.testset.transforms.relationship_builders.traditional import JaccardSimilarityBuilder
+from ragas.testset.synthesizers import SingleHopSpecificQuerySynthesizer
+from ragas.testset.synthesizers.multi_hop import (
+    MultiHopAbstractQuerySynthesizer,
+    MultiHopSpecificQuerySynthesizer
+)
+from ragas.testset.transforms.relationship_builders.traditional import OverlapScoreBuilder
+from ragas.testset.transforms.relationship_builders.cosine import SummaryCosineSimilarityBuilder
+from ragas.testset.transforms.filters import CustomNodeFilter
+from ragas.run_config import RunConfig
+from ragas.testset.synthesizers.single_hop.prompts import QueryAnswerGenerationPrompt as SingleHopPrompt
+from ragas.testset.synthesizers.multi_hop.prompts import QueryAnswerGenerationPrompt as MultiHopPrompt
+
+
+logger = logging.getLogger(__name__)
+
+run_config = RunConfig(
+    timeout=180,
+    max_retries=10,
+    max_wait=60,
+    exception_types=(Exception, RateLimitError), 
+    log_tenacity=True 
+)
+
+@dataclass
+class SyntheticDataConfig:
+    """Configuration for synthetic data generation"""
+    initial_testset_size: int = 10
+    quality_threshold: float = 1.5  # Minimum average score to keep a Q&A pair
+    semantic_similarity_threshold: float = 0.85  # Threshold for deduplication
+    batch_size: int = 10
+    cache_dir: Path = Path("cache")
+    reward_model_name: str = "nvidia/nemotron-4-340b-reward"
+    output_dir: Path = Path("output")
+
+@dataclass
+class EvaluatedSample:
+    """Wrapper class to hold TestsetSample with its evaluation metrics"""
+    sample: TestsetSample
+    scores: dict
+    avg_score: float
+
+    @property
+    def question(self) -> str:
+        return self.sample.eval_sample.user_input
+        
+    @property
+    def answer(self) -> str:
+        return self.sample.eval_sample.reference
+
+    def to_dict(self) -> dict:
+        """Convert to dictionary for DataFrame creation"""
+        return {
+            "question": self.question,
+            "answer": self.answer,
+            "synthesizer": self.sample.synthesizer_name,
+            "avg_score": self.avg_score,
+            **self.scores  # Unpack individual scores
+        }
+
+def parse_episode_info(filename: str) -> tuple[int, list[int]]:
+    """Extract season and episode numbers from filename"""
+    # Remove file extension
+    filename = Path(filename).stem
+    
+    # Extract season number (first two digits)
+    season = int(filename[:2])
+    
+    # Extract episode number(s)
+    episode_part = filename[2:]
+    episodes = []
+    
+    # Handle multi-episode files (e.g., "0212-0213")
+    if '-' in episode_part:
+        start, end = episode_part.split('-')
+        episodes = list(range(int(start), int(end) + 1))
+    else:
+        episodes = [int(episode_part)]
+        
+    return season, episodes
+
+@dataclass
+class RLConfig:
+    """Configuration for RL loop"""
+    num_iterations: int = 3
+    min_samples_per_iteration: int = 10
+    exemplar_score_threshold: float = 1.6
+    max_exemplars_per_iteration: int = 3
+#     exemplar_template: str = """
+# High-quality example Q&A pairs to learn from:
+
+# {exemplars}
+
+# Additional Instructions:
+# 1. Learn from the style and depth of these examples
+# 2. Focus on {focus_area} while maintaining similar quality
+# 3. Ensure questions are diverse and non-repetitive
+# 4. Maintain factual accuracy based on the show's content
+# """
+    exemplar_template: str = """
+High-quality example Q&A pairs to learn from:
+
+{exemplars}
+
+Additional Instructions:
+1. Learn from the style and depth of these examples
+2. Ensure questions are diverse and non-repetitive
+3. Maintain factual accuracy based on the show's content
+"""
+
+class RAGSyntheticDataGenerator:
+    def __init__(
+        self,
+        llm: BaseRagasLLM,
+        embedding_model: BaseRagasEmbeddings,
+        reward_api_key: str,
+        config: SyntheticDataConfig = None,
+        rl_config: RLConfig = N
```

**File**: `demo/Friends/test/0101.html` (added, +926/-0)
```diff
@@ -0,0 +1,926 @@
+<html>
+
+<head>
+<title>The One Where Monica Gets a New Roomate (The Pilot-The Uncut Version)</title>
+</head>
+
+<body bgcolor="white" text="black" link="green" vlink="black" alink="yellow">
+
+<h1 align="center">The One Where Monica Gets a New Roommate (The Pilot-The Uncut Version)</h1>
+
+<hr align="center">
+<font size="3">
+
+<p>Written by: Marta Kauffman &amp; David Crane</font><br>
+Transcribed by: <a href="mailto:shadelet@easynet.co.uk">guineapig</a><br>
+Additional transcribing by: <a href="mailto:Ericaasen1@aol.com">Eric Aasen</a><br>
+(Note: The previously unseen parts of this episode are shown in <font color="#0000FF">blue</font><font
+color="#000000"> text.)</font></p>
+
+<hr>
+<font size="3"><b>
+
+<p align="left"></b>[Scene: Central Perk, Chandler, Joey, Phoebe, and Monica are there.]</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> There's nothing to tell! He's just some guy
+I work with!</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> C'mon, you're going out with the guy! There's
+gotta be something wrong with him!</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> <font color="#0000FF">All right Joey, be
+nice.&nbsp; </font>So does he have a hump? A hump and a hairpiece?</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> Wait, does he eat chalk?</font></p>
+
+<p align="left"><font size="3">(They all stare, bemused.)</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> Just, 'cause, I don't want her to go through
+what I went through with Carl- oh!</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> Okay, everybody relax. This is not even a
+date. It's just two people going out to dinner and- not having sex.</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Sounds like a date to me.</font></p>
+
+<p align="left"><font size="3">[Time Lapse]</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Alright, so I'm back in high school, I'm
+standing in the middle of the cafeteria, and I realize I am totally naked.</font></p>
+
+<p align="left"><font size="3"><strong>All:</strong> Oh, yeah. Had that dream.</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Then I look down, and I realize there's a
+phone... there.</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> Instead of...?</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> That's right.</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> Never had that dream.</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> No.</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> All of a sudden, the phone starts to ring.
+<font color="#0000FF">Now I don't know what to do, everybody starts looking at me. </font></font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Monica:</b> And they weren't looking at
+you before?!</font></p>
+
+<p align="left"><font size="3"><font color="#0000FF"><b>Chandler:</b> Finally, I figure
+I'd better answer it, </font><font color="#000000">a</font>nd it turns out it's my mother,
+which is very-very weird, because- she never calls me!</font></p>
+
+<p align="left"><font size="3">[Time Lapse, Ross has entered.]</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> (mortified) Hi.</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> This guy says hello, I wanna kill myself.</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> Are you okay, sweetie?</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> I just feel like someone reached down my
+throat, grabbed my small intestine, pulled it out of my mouth and tied it around my
+neck...</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Cookie?</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> (explaining to the others) Carol moved her
+stuff out today. </font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Joey:</b> Ohh.</font></p>
+
+<p align="left"><font size="3"><font color="#000000"><b>Monica:</b></font><font
+color="#0000FF"> </font>(to Ross) Let me get you some coffee.</font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Ross:</b> Thanks.</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> Ooh! Oh! (She starts to pluck at the air
+just in front of Ross.)</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> No, no don't! Stop cleansing my aura! No, just
+leave my aura alone, okay?</font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Phoebe:</b> Fine!&nbsp; Be murky!</font></p>
+
+<p align="left"><font size="3"><font color="#000000"><b>Ross:</b> </font>I'll be fine,
+alright? Really, everyone. I hope she'll be very happy.</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> No you don't.</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> No I don't, to hell with her, she left me!</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> And you never knew she was a lesbian...</font></p>
+
+<p align="left"><font size="3"><b>R
```

**File**: `demo/Friends/test/0102.html` (added, +656/-0)
```diff
@@ -0,0 +1,656 @@
+<html>
+
+<head>
+<title>The One With The Sonogram at the End</title>
+</head>
+
+<body bgcolor="white" text="black" link="green" vlink="black" alink="yellow">
+
+<h1 align="center">The One With the Sonogram at the End</h1>
+
+<hr align="center">
+<font size="3"><b>
+
+<p></b>Written by: Marta Kauffman &amp; David Crane</font> <br>
+<font size="3">Transcribed by: <a href="mailto:Ericaasen1@aol.com">guineapig</a></font></p>
+
+<hr>
+<font size="3">
+
+<p align="left">[Scene Central Perk, everyone's there.]</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> What you guys don't understand is, for us,
+kissing is as important as any part of it. </p>
+
+<p><b>Joey:</b> Yeah, right!.......Y'serious? </p>
+
+<p><b>Phoebe:</b> Oh, yeah! </p>
+
+<p><b>Rachel:</b> Everything you need to know is in that first kiss. </p>
+
+<p><b>Monica:</b> Absolutely. </p>
+
+<p><b>Chandler:</b> Yeah, I think for us, kissing is pretty much like an opening act,
+y'know? I mean it's like the stand-up comedian you have to sit through before Pink Floyd
+comes out. </p>
+
+<p><b>Ross:</b> Yeah, and-and it's not that we don't like the comedian, it's that-that...
+that's not why we bought the ticket. </p>
+
+<p><b>Chandler:</b> The problem is, though, after the concert's over, no matter how great
+the show was, you girls are always looking for the comedian again, y'know? I mean, we're
+in the car, we're fighting traffic... basically just trying to stay awake. </p>
+
+<p><b>Rachel:</b> Yeah, well, word of advice: Bring back the comedian. Otherwise next time
+you're gonna find yourself sitting at home, listening to that album alone. </p>
+
+<p><b>Joey:</b> (pause)....Are we still talking about sex?</font></p>
+
+<p align="center"><b>Opening Credits</b></p>
+
+<p align="left"><font size="3">[Scene: Museum of Prehistoric History, Ross and a co-worker
+(Marsha) are setting up an exhibit which includes some mannequins of cave people.] </p>
+
+<p><b>Ross:</b> No, it's good, it is good, it's just that- mm- doesn't she seem a little
+angry? </p>
+
+<p><b>Marsha:</b> Well, she has issues. </p>
+
+<p><b>Ross:</b> Does she. </p>
+
+<p><b>Marsha:</b> He's out banging other women over the head with a club, while she sits
+at home trying to get the mastodon smell out of the carpet! </p>
+
+<p><b>Ross:</b> Marsha, these are cave people. Okay? They have issues like 'Gee, that
+glacier's getting kinda close.' See? </p>
+
+<p><b>Marsha:</b> Speaking of issues, isn't that your ex-wife? </p>
+
+<p>(Carol, Ross's ex-wife, has entered behind them and is standing outstide the exhibit.) </p>
+
+<p><b>Ross:</b> (trying to ignore her) No. No. </p>
+
+<p><b>Marsha:</b> Yes, it is. Carol! Hi! </p>
+
+<p><b>Ross:</b> Okay, okay, yes, it is. (waves) How about I'll, uh, catch up with you in
+the Ice Age. </p>
+
+<p>(Marsha extis and Ross waves Carol into the exhibit.) </p>
+
+<p><b>Ross:</b>Hi. </p>
+
+<p><b>Carol:</b> So. </p>
+
+<p><b>Ross:</b> You look great. I, uh... I hate that. </p>
+
+<p><b>Carol:</b> Sorry. You look good too. </p>
+
+<p><b>Ross:</b> Ah, well, in here, anyone who... stands erect... So what's new? Still,
+uh... </p>
+
+<p><b>Carol:</b> A lesbian? </p>
+
+<p><b>Ross:</b> Well... you never know. How's, um.. how's the family? </p>
+
+<p><b>Carol:</b> Marty's still totally paranoid. Oh, and, uh- </p>
+
+<p><b>Ross:</b> Why- why are you here, Carol? </p>
+
+<p><b>Carol:</b> I'm pregnant. </p>
+
+<p><b>Ross:</b> Pregnant?! </p>
+
+<p>[Scene: Monica and Rachel's, Chandler, Joey, Phoebe, and Monica are watching <em>Three's
+Company</em>.]</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Oh, I think this is the episode of Three's
+Company where there's some kind of misunderstanding. </p>
+
+<p><b>Phoebe:</b>...Then I've already seen this one! (Turns off the TV.) </p>
+
+<p><b>Monica:</b> (taking a drink from Joey) Are you through with that? </p>
+
+<p><b>Joey:</b> Yeah, sorry, the swallowing slowed me down. </p>
+
+<p><b>Monica:</b> Whose little ball of paper is this?! </p>
+
+<p><b>Chandler:</b> Oh, uh, that would be mine. See, I wrote a note to myself, and then I
+realised I didn't need it, so I balled it up and... (sees that Monica is glaring at him)
+...now I wish I was dead. </p>
+
+<p>(Monica starts to fluff a pillow.) </p>
+
+<p><b>Phoebe:</b> She's already fluffed that pillow... Monica, you know, you've already
+fluffed that- (Monica glares at her.) -but, it's fine! </p>
+
+<p><b>Monica:</b> Look , I'm sorry, guys, I just don't wanna give them any more ammunition
+than they already have. </p>
+
+<p><b>Chandler:</b> Yes, and we all know how cruel a parent can be about the flatness of a
+child's pillow. </p>
+
+<p><b>Phoebe:</b> Monica- Hi! Um, Monica, you're scaring me. I mean, you're like, you're
+like all chaotic and twirly. And not-not in a good way. </p>
+
+<p><b>Joey:</b> Yeah, calm down. You don't see Ross getting all chaotic and twirly every
+time they come. </p>
+
+<p><b>Monica:</b> That's because as fa
```

**File**: `demo/Friends/test/07outtakes.html` (added, +735/-0)
```diff
@@ -0,0 +1,735 @@
+<html>
+
+<head>
+<title>Friends: The Stuff You&#146;ve Never Seen</title>
+<meta HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=windows-1252">
+<meta NAME="GENERATOR" CONTENT="Microsoft FrontPage 3.0">
+<meta NAME="Template" CONTENT="C:\Program Files\Microsoft Office\Templates\FRIENDS.dot">
+</head>
+
+<body bgcolor="#FFFFFF" link="#008000">
+
+<h1 align="center">Friends: The Stuff You&#146;ve Never Seen</h1>
+
+<hr>
+
+<p>Hosted by: Conan O&#146;Brien<br>
+Transcribed by: <a href="mailto:Ericaasen1@aol.com">Eric Aasen</a></p>
+
+<p>This is a special out takes episode. The cast and Conan are sitting around the set of
+Central Perk, talking about the stuff we&#146;ve never seen. </p>
+
+<p>Transcriber&#146;s Note: This is stuff we never saw from all of the seasons, so for all
+of the scene settings I will be using the current arrangements. Even though some of the
+out takes take place when Chandler was living with Joey and Rachel was living with Monica,
+when Joey and Chandler were living in Monica and Rachel&#146;s, and the current
+arrangements.</p>
+
+<hr>
+
+<p>[Scene: Central Perk, the cast of Friends along with Conan O&#146;Brien are sitting and
+talking.]</p>
+
+<p><b>Conan:</b> It&#146;s a tradition here on <i>Friends</i> after every taping for me to
+hang out with you guys, (They all laugh) talk down the episode umm&#133; The point of this
+whole thing is what people see in America is: they see <i>Friends</i>, they love the show,
+it looks like a smooth running machine, but behind the scenes there&#146;s deceit,
+mistrust, and hate. And I thought, I thought we&#146;d actually take a look at uh,
+y&#146;know some of these moments where you guys are&#151;there are mistakes. You make
+mistakes.</p>
+
+<p><b>Jennifer:</b> Once and a while.</p>
+
+<p><b>Lisa:</b> From time to time.</p>
+
+<p><b>Conan:</b> For example, I don&#146;t have to memorize lines. You guys actually have
+to remember what to say and you probably forget from time to time. Yes?</p>
+
+<p><b>Matthew:</b> Our energy just comes way up when there&#146;s an audience here and
+when that happens, something happens between your brain and your mouth sometimes and it
+just doesn&#146;t, it just doesn&#146;t work.</p>
+
+<p>[Cut to Central Perk, Ross, Phoebe, Monica, and Chandler are there. I think it&#146;s
+The One With The Joke.]</p>
+
+<p><b>Ross:</b> Uh, oh-oh, umm no you didn&#146;t. I did.</p>
+
+<p><b>Chandler:</b> Oh uh-uh, no-no-no-no-uh-uh. (He starts laughing, causing everyone
+else to laugh.)</p>
+
+<p>[Cut to Joey and Rachel's, Phoebe is talking. It looks like when Rachel and Monica
+lived in this apartment.]</p>
+
+<p><b>Phoebe:</b> So, we realize that&#151;Oh no&#133; (She resets herself) I&#146;m
+telling it! I&#146;m telling it&#133; (She loses it.)</p>
+
+<p>[Cut to Monica and Chandler's, Joey is talking to Monica and Chandler.]</p>
+
+<p><b>Joey:</b> Ha-ha. Look&#151;Come on, I don&#146;t know what to do&#133;or say. (He
+laughs.)</p>
+
+<p>[Reset]</p>
+
+<p><b>Joey:</b> Ha-ha, very funny. I don&#146;t know what to do! Y&#146;know? Holy crud!</p>
+
+<p>[Reset]</p>
+
+<p><b>Joey:</b> Ha-ha-ha, very funny. Look, I don&#146;t know what to do! (Long pause, as
+everyone cracks up.)</p>
+
+<p><b>Courtney:</b> It is one of those days!</p>
+
+<p>[Cut to Monica and Chandler's, Phoebe is speaking Italian to Joey&#146;s grandmother.
+I&#146;m spelling phonetically.]</p>
+
+<p><b>Phoebe:</b> &#145;Xcusa seniora, voulez-bere quakay&#151;[Beep]&#151;uck it!</p>
+
+<p><b>Matt:</b> Wow Pheebs, you-you speak gutter?</p>
+
+<p>[Cut back to the cast and Conan.]</p>
+
+<p><b>Conan:</b> You still get nervous everybody just before a show?</p>
+
+<p><b>Matthew:</b> Absolutely.</p>
+
+<p><b>Lisa:</b> Everybody.</p>
+
+<p><b>Courtney:</b> It&#146;s amazing like all week long we&#146;ve-we&#146;ve been saying
+the same lines and then the audience is here and we will mess up, and if you mess up once,
+then you&#146;ll get nervous because you&#146;ll&#151;you know you&#146;ll probably mess
+up again.</p>
+
+<p>[Cut to Central Perk, first season Monica is talking.]</p>
+
+<p><b>The Director:</b> Action!</p>
+
+<p><b>Monica:</b> (holding her hand in front of her face) When you were little you slept
+through-through the Grand Canyon.</p>
+
+<p><b>The Director:</b> Watch again that hand.</p>
+
+<p><b>Courtney:</b> This&#146;ll be five/ten takes.</p>
+
+<p><b>The Director:</b> Okay.</p>
+
+<p><b>Courtney:</b> Okay. You know it&#146;s gonna happen.</p>
+
+<p><b>The Director:</b> Once again, and action!</p>
+
+<p><b>Monica:</b> (the hand&#146;s still there) When-when you were little you slept
+through the Grand Canyon. (She actually itches her nose this time.)</p>
+
+<p><b>Courtney:</b> Oh! Okay! I&#146;m gonna try it without the coffee cup &#145;cause I
+think it&#146;s the left hand that&#146;s messing me up.</p>
+
+<p>[Reset]</p>
+
+<p><b>Monica:</b> When you were little you slept through the Grand&#151;(Pointing
+again)&#151;Oh 
```

**File**: `demo/Friends/transcript_preprocessor.py` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+from bs4 import BeautifulSoup
+import re
+from pathlib import Path
+import logging
+import chardet
+
+logging.basicConfig(level=logging.INFO)
+logger = logging.getLogger(__name__)
+
+class TranscriptCleaner:
+    def __init__(self, input_dir: str, output_dir: str):
+        self.input_dir = Path(input_dir)
+        self.output_dir = Path(output_dir)
+        self.output_dir.mkdir(parents=True, exist_ok=True)
+    
+    def clean_text(self, text: str) -> str:
+        """Clean individual text segments."""
+        # Remove extra whitespace
+        text = ' '.join(text.split())
+        # Remove any remaining HTML entities
+        text = re.sub(r'&amp;', '&', text)
+        text = re.sub(r'&nbsp;', ' ', text)
+        return text.strip()
+    
+    def get_specified_encoding(self, file_path: Path) -> str | None:
+        """Extract charset from meta tag if specified."""
+        try:
+            # First read a small portion of the file to check for meta charset
+            with open(file_path, 'rb') as f:
+                # Read first 1024 bytes which typically contain the head section
+                raw_content = f.read(1024)
+                
+            # Look for charset in meta tag in raw bytes
+            charset_match = re.search(br'charset=([\w-]+)', raw_content, re.IGNORECASE)
+            if charset_match:
+                return charset_match.group(1).decode('ascii').lower()
+            
+            return None
+                
+        except Exception as e:
+            logger.warning(f"Error reading charset from {file_path.name}: {str(e)}")
+            return None
+
+    def get_file_encoding(self, file_path: Path) -> str:
+        """Get file encoding, first from meta tag, then using chardet."""
+        # Try to get specified encoding first
+        specified_encoding = self.get_specified_encoding(file_path)
+        if specified_encoding:
+            logger.info(f"Using specified encoding for {file_path.name}: {specified_encoding}")
+            return specified_encoding
+        
+        # Fallback to chardet
+        logger.info(f"No encoding specified in {file_path.name}, detecting encoding...")
+        with open(file_path, 'rb') as f:
+            raw_data = f.read()
+        
+        result = chardet.detect(raw_data)
+        encoding = result['encoding']
+        confidence = result['confidence']
+        
+        logger.info(f"Detected encoding for {file_path.name}: {encoding} (confidence: {confidence:.2f})")
+        return encoding
+    
+    def process_file(self, file_path: Path) -> str:
+        """Process single transcript file."""
+        encoding = self.get_file_encoding(file_path)
+
+        with open(file_path, 'r', encoding=encoding) as f:
+            soup = BeautifulSoup(f, 'html.parser')
+            
+        # Extract title
+        title = soup.title.string if soup.title else file_path.stem
+        cleaned_content = [f"Episode: {title}\n\n"]
+        
+        # Process all paragraphs
+        for p in soup.find_all('p'):
+            text = p.get_text(strip=True)
+            if not text:
+                continue
+                
+            # Skip transcriber information
+            if any(skip in text.lower() for skip in ['transcribed by:', 'written by:']):
+                continue
+            
+            # Clean and format the text
+            text = self.clean_text(text)
+            
+            # Handle scene descriptions
+            if text.startswith('[') and text.endswith(']'):
+                cleaned_content.append(f"\n{text}\n")
+            
+            # Handle dialogue
+            elif ':' in text:
+                speaker, dialogue = text.split(':', 1)
+                cleaned_content.append(f"{speaker.strip()}: {dialogue.strip()}")
+            
+            # Handle other content
+            else:
+                cleaned_content.append(text)
+        
+        return '\n'.join(cleaned_content)
+    
+    def process_all_files(self):
+        """Process all transcript files in the input directory."""
+        for file_path in self.input_dir.glob('*.html'):
+            try:
+                logger.info(f"Processing {file_path.name}")
+                cleaned_content = self.process_file(file_path)
+                
+                # Save cleaned content
+                output_file = self.output_dir / f"{file_path.stem}.txt"
+                with open(output_file, 'w', encoding='utf-8') as f:
+                    f.write(cleaned_content)
+                    
+            except Exception as e:
+                logger.error(f"Error processing {file_path.name}: {str(e)}")
+
+if __name__ == "__main__":
+    cleaner = TranscriptCleaner(
+        input_dir="path/to/friends/transcripts",
+        output_dir="path/to/output/cleaned_transcripts"
+    )
+    cleaner.process_all_files()
\ No newline at end of file
```

**File**: `demo/Friends/transcripts/0101.html` (added, +926/-0)
```diff
@@ -0,0 +1,926 @@
+<html>
+
+<head>
+<title>The One Where Monica Gets a New Roomate (The Pilot-The Uncut Version)</title>
+</head>
+
+<body bgcolor="white" text="black" link="green" vlink="black" alink="yellow">
+
+<h1 align="center">The One Where Monica Gets a New Roommate (The Pilot-The Uncut Version)</h1>
+
+<hr align="center">
+<font size="3">
+
+<p>Written by: Marta Kauffman &amp; David Crane</font><br>
+Transcribed by: <a href="mailto:shadelet@easynet.co.uk">guineapig</a><br>
+Additional transcribing by: <a href="mailto:Ericaasen1@aol.com">Eric Aasen</a><br>
+(Note: The previously unseen parts of this episode are shown in <font color="#0000FF">blue</font><font
+color="#000000"> text.)</font></p>
+
+<hr>
+<font size="3"><b>
+
+<p align="left"></b>[Scene: Central Perk, Chandler, Joey, Phoebe, and Monica are there.]</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> There's nothing to tell! He's just some guy
+I work with!</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> C'mon, you're going out with the guy! There's
+gotta be something wrong with him!</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> <font color="#0000FF">All right Joey, be
+nice.&nbsp; </font>So does he have a hump? A hump and a hairpiece?</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> Wait, does he eat chalk?</font></p>
+
+<p align="left"><font size="3">(They all stare, bemused.)</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> Just, 'cause, I don't want her to go through
+what I went through with Carl- oh!</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> Okay, everybody relax. This is not even a
+date. It's just two people going out to dinner and- not having sex.</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Sounds like a date to me.</font></p>
+
+<p align="left"><font size="3">[Time Lapse]</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Alright, so I'm back in high school, I'm
+standing in the middle of the cafeteria, and I realize I am totally naked.</font></p>
+
+<p align="left"><font size="3"><strong>All:</strong> Oh, yeah. Had that dream.</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Then I look down, and I realize there's a
+phone... there.</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> Instead of...?</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> That's right.</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> Never had that dream.</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> No.</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> All of a sudden, the phone starts to ring.
+<font color="#0000FF">Now I don't know what to do, everybody starts looking at me. </font></font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Monica:</b> And they weren't looking at
+you before?!</font></p>
+
+<p align="left"><font size="3"><font color="#0000FF"><b>Chandler:</b> Finally, I figure
+I'd better answer it, </font><font color="#000000">a</font>nd it turns out it's my mother,
+which is very-very weird, because- she never calls me!</font></p>
+
+<p align="left"><font size="3">[Time Lapse, Ross has entered.]</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> (mortified) Hi.</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> This guy says hello, I wanna kill myself.</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> Are you okay, sweetie?</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> I just feel like someone reached down my
+throat, grabbed my small intestine, pulled it out of my mouth and tied it around my
+neck...</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Cookie?</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> (explaining to the others) Carol moved her
+stuff out today. </font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Joey:</b> Ohh.</font></p>
+
+<p align="left"><font size="3"><font color="#000000"><b>Monica:</b></font><font
+color="#0000FF"> </font>(to Ross) Let me get you some coffee.</font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Ross:</b> Thanks.</font></p>
+
+<p align="left"><font size="3"><b>Phoebe:</b> Ooh! Oh! (She starts to pluck at the air
+just in front of Ross.)</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> No, no don't! Stop cleansing my aura! No, just
+leave my aura alone, okay?</font></p>
+
+<p align="left"><font size="3" color="#0000FF"><b>Phoebe:</b> Fine!&nbsp; Be murky!</font></p>
+
+<p align="left"><font size="3"><font color="#000000"><b>Ross:</b> </font>I'll be fine,
+alright? Really, everyone. I hope she'll be very happy.</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> No you don't.</font></p>
+
+<p align="left"><font size="3"><b>Ross:</b> No I don't, to hell with her, she left me!</font></p>
+
+<p align="left"><font size="3"><b>Joey:</b> And you never knew she was a lesbian...</font></p>
+
+<p align="left"><font size="3"><b>R
```

**File**: `demo/Friends/transcripts/0102.html` (added, +656/-0)
```diff
@@ -0,0 +1,656 @@
+<html>
+
+<head>
+<title>The One With The Sonogram at the End</title>
+</head>
+
+<body bgcolor="white" text="black" link="green" vlink="black" alink="yellow">
+
+<h1 align="center">The One With the Sonogram at the End</h1>
+
+<hr align="center">
+<font size="3"><b>
+
+<p></b>Written by: Marta Kauffman &amp; David Crane</font> <br>
+<font size="3">Transcribed by: <a href="mailto:Ericaasen1@aol.com">guineapig</a></font></p>
+
+<hr>
+<font size="3">
+
+<p align="left">[Scene Central Perk, everyone's there.]</font></p>
+
+<p align="left"><font size="3"><b>Monica:</b> What you guys don't understand is, for us,
+kissing is as important as any part of it. </p>
+
+<p><b>Joey:</b> Yeah, right!.......Y'serious? </p>
+
+<p><b>Phoebe:</b> Oh, yeah! </p>
+
+<p><b>Rachel:</b> Everything you need to know is in that first kiss. </p>
+
+<p><b>Monica:</b> Absolutely. </p>
+
+<p><b>Chandler:</b> Yeah, I think for us, kissing is pretty much like an opening act,
+y'know? I mean it's like the stand-up comedian you have to sit through before Pink Floyd
+comes out. </p>
+
+<p><b>Ross:</b> Yeah, and-and it's not that we don't like the comedian, it's that-that...
+that's not why we bought the ticket. </p>
+
+<p><b>Chandler:</b> The problem is, though, after the concert's over, no matter how great
+the show was, you girls are always looking for the comedian again, y'know? I mean, we're
+in the car, we're fighting traffic... basically just trying to stay awake. </p>
+
+<p><b>Rachel:</b> Yeah, well, word of advice: Bring back the comedian. Otherwise next time
+you're gonna find yourself sitting at home, listening to that album alone. </p>
+
+<p><b>Joey:</b> (pause)....Are we still talking about sex?</font></p>
+
+<p align="center"><b>Opening Credits</b></p>
+
+<p align="left"><font size="3">[Scene: Museum of Prehistoric History, Ross and a co-worker
+(Marsha) are setting up an exhibit which includes some mannequins of cave people.] </p>
+
+<p><b>Ross:</b> No, it's good, it is good, it's just that- mm- doesn't she seem a little
+angry? </p>
+
+<p><b>Marsha:</b> Well, she has issues. </p>
+
+<p><b>Ross:</b> Does she. </p>
+
+<p><b>Marsha:</b> He's out banging other women over the head with a club, while she sits
+at home trying to get the mastodon smell out of the carpet! </p>
+
+<p><b>Ross:</b> Marsha, these are cave people. Okay? They have issues like 'Gee, that
+glacier's getting kinda close.' See? </p>
+
+<p><b>Marsha:</b> Speaking of issues, isn't that your ex-wife? </p>
+
+<p>(Carol, Ross's ex-wife, has entered behind them and is standing outstide the exhibit.) </p>
+
+<p><b>Ross:</b> (trying to ignore her) No. No. </p>
+
+<p><b>Marsha:</b> Yes, it is. Carol! Hi! </p>
+
+<p><b>Ross:</b> Okay, okay, yes, it is. (waves) How about I'll, uh, catch up with you in
+the Ice Age. </p>
+
+<p>(Marsha extis and Ross waves Carol into the exhibit.) </p>
+
+<p><b>Ross:</b>Hi. </p>
+
+<p><b>Carol:</b> So. </p>
+
+<p><b>Ross:</b> You look great. I, uh... I hate that. </p>
+
+<p><b>Carol:</b> Sorry. You look good too. </p>
+
+<p><b>Ross:</b> Ah, well, in here, anyone who... stands erect... So what's new? Still,
+uh... </p>
+
+<p><b>Carol:</b> A lesbian? </p>
+
+<p><b>Ross:</b> Well... you never know. How's, um.. how's the family? </p>
+
+<p><b>Carol:</b> Marty's still totally paranoid. Oh, and, uh- </p>
+
+<p><b>Ross:</b> Why- why are you here, Carol? </p>
+
+<p><b>Carol:</b> I'm pregnant. </p>
+
+<p><b>Ross:</b> Pregnant?! </p>
+
+<p>[Scene: Monica and Rachel's, Chandler, Joey, Phoebe, and Monica are watching <em>Three's
+Company</em>.]</font></p>
+
+<p align="left"><font size="3"><b>Chandler:</b> Oh, I think this is the episode of Three's
+Company where there's some kind of misunderstanding. </p>
+
+<p><b>Phoebe:</b>...Then I've already seen this one! (Turns off the TV.) </p>
+
+<p><b>Monica:</b> (taking a drink from Joey) Are you through with that? </p>
+
+<p><b>Joey:</b> Yeah, sorry, the swallowing slowed me down. </p>
+
+<p><b>Monica:</b> Whose little ball of paper is this?! </p>
+
+<p><b>Chandler:</b> Oh, uh, that would be mine. See, I wrote a note to myself, and then I
+realised I didn't need it, so I balled it up and... (sees that Monica is glaring at him)
+...now I wish I was dead. </p>
+
+<p>(Monica starts to fluff a pillow.) </p>
+
+<p><b>Phoebe:</b> She's already fluffed that pillow... Monica, you know, you've already
+fluffed that- (Monica glares at her.) -but, it's fine! </p>
+
+<p><b>Monica:</b> Look , I'm sorry, guys, I just don't wanna give them any more ammunition
+than they already have. </p>
+
+<p><b>Chandler:</b> Yes, and we all know how cruel a parent can be about the flatness of a
+child's pillow. </p>
+
+<p><b>Phoebe:</b> Monica- Hi! Um, Monica, you're scaring me. I mean, you're like, you're
+like all chaotic and twirly. And not-not in a good way. </p>
+
+<p><b>Joey:</b> Yeah, calm down. You don't see Ross getting all chaotic and twirly every
+time they come. </p>
+
+<p><b>Monica:</b> That's because as fa
```

**File**: `demo/Friends/transcripts/0103.html` (added, +713/-0)
```diff
@@ -0,0 +1,713 @@
+<html>
+
+<head>
+<title>The One With The Thumb</title>
+</head>
+
+<body bgcolor="white" text="black" link="green" vlink="black" alink="yellow">
+
+<h1 align="center">The One With the Thumb</h1>
+
+<hr align="center">
+<font size="3"><i>
+
+<p></i>Written by: Jeffrey Astrof &amp; Mike Sikowitz. <br>
+Transcribed by: <a href="mailto:Ericaasen1@aol.com">guineapig</a></font></p>
+
+<hr>
+<font size="3"><b>
+
+<p align="left"></b>[Scene: Central Perk, everyone but Phoebe is there.] </p>
+
+<p><b>Phoebe:</b> (entering) Hi guys! </p>
+
+<p><b>All:</b> Hey, Pheebs! Hi! </p>
+
+<p><b>Ross:</b> Hey. Oh, oh, how'd it go? </p>
+
+<p><b>Phoebe:</b> Um, not so good. He walked me to the subway and said 'We should do this
+again!' </p>
+
+<p><b>All:</b> Ohh. Ouch. </p>
+
+<p><b>Rachel:</b> What? He said 'we should do it again', that's good, right? </p>
+
+<p><b>Monica:</b> Uh, no. Loosely translated 'We should do this again' means 'You will
+never see me naked'. </p>
+
+<p><b>Rachel:</b> Since when? </p>
+
+<p><b>Joey:</b> Since always. It's like dating language. Y'know, like 'It's not you' means
+'It is you'. </p>
+
+<p><b>Chandler:</b> Or 'You're such a nice guy' means 'I'm gonna be dating leather-wearing
+alcoholics and complaining about them to you'. </p>
+
+<p><b>Phoebe:</b> Or, or, y'know, um, 'I think we should see other people' means 'Ha, ha,
+I already am'. </p>
+
+<p><b>Rachel:</b> And everybody knows this? </p>
+
+<p><b>Joey:</b> Yeah. Cushions the blow. </p>
+
+<p><b>Chandler:</b> Yeah, it's like when you're a kid, and your parents put your dog to
+sleep, and they tell you it went off to live on some farm. </p>
+
+<p><b>Ross:</b> That's funny, that, no, because, uh, our parents actually did, uh, send
+our dog off to live on a farm. </p>
+
+<p><b>Monica:</b> Uh, Ross. </p>
+
+<p><b>Ross:</b> What? Wh- hello? The Millners' farm in Connecticut? The Millners, they had
+this unbelievable farm, they had horses, and, and rabbits that he could chase and it was-
+it w- .....Oh my God, Chi Chi! </p>
+
+<p align="center"><b>Opening Credits</b> </p>
+
+<p>[Scene: Chandler and Joey's, Chandler is helping Joey rehearse for a part.]</p>
+
+<p><b>Chandler:</b> &quot;So how does it feel knowing you're about to die?&quot; </p>
+
+<p><b>Joey:</b> &quot;Warden, in five minutes my pain will be over. But you'll have to
+live with the knowledge that you sent an honest man to die.&quot; </p>
+
+<p><b>Chandler:</b> Hey, that was really good! </p>
+
+<p><b>Joey:</b> Thanks! Let's keep going. </p>
+
+<p><b>Chandler:</b> Okay. &quot;So. Whaddya want from me, Damone, huh?&quot; </p>
+
+<p><b>Joey:</b> &quot;I just wanna go back to my cell. 'Cause in my cell, I can
+smoke.&quot; </p>
+
+<p><b>Chandler:</b> &quot;Smoke away.&quot; </p>
+
+<p>(Joey takes out a pack of cigarettes and a lighter.&nbsp; He fumbles and drops the
+lighter.&nbsp; Then he lights a cigarett, takes a drag, and coughs.)</p>
+
+<p><b>Chandler:</b> I think this is probably why Damone smokes in his cell alone. </p>
+
+<p><b>Joey:</b> What? </p>
+
+<p><b>Chandler:</b> Relax your hand! </p>
+
+<p>(Joey lets his wrist go limp.) </p>
+
+<p><b>Chandler:</b> Not so much! </p>
+
+<p><b>Joey:</b> Whoah! </p>
+
+<p><b>Chandler:</b> Hey! </p>
+
+<p><b>Joey:</b> Hey! </p>
+
+<p><b>Chandler:</b> Alright, now try taking a puff. </p>
+
+<p>(Joey tries and visibly winces.) </p>
+
+<p><b>Chandler:</b> Alright.. okay. No. Give it to me. </p>
+
+<p><b>Joey:</b> No no no, I am not giving you a cigarette. </p>
+
+<p><b>Chandler:</b> It's fine, it's fine. Look, do you wanna get this part, or not? Here. </p>
+
+<p>(Joey reluctantly gives him the cigarette.) </p>
+
+<p><b>Chandler:</b> Don't think of it as a cigarette. Think of it as the thing that's been
+missing from your hand. When you're holding it, you feel right. You feel complete. </p>
+
+<p><b>Joey:</b> Y'miss it? </p>
+
+<p><b>Chandler:</b> Nah, not so much. Alright, now we smoke. (Takes a puff.) Oh.. my..
+God. (He continues to smoke.) </p>
+
+<p>[Scene, Central Perk, everyone except Phoebe and Rachel is there.] </p>
+
+<p><b>Monica:</b> No, no, no. They say it's the same as the distance from the tip of a
+guy's thumb to the tip of his index finger. </p>
+
+<p>(The guys stretch out their fingers.) </p>
+
+<p><b>Joey:</b> That's ridiculous! </p>
+
+<p><b>Ross:</b> Can I use.. either thumb? </p>
+
+<p><b>Rachel:</b> (carrying a tray of drinks) Alright, don't tell me, don't tell me!
+(Starts handing them out.) Decaf cappucino for Joey.. Coffee black.. Late.. And an iced
+tea. I'm getting pretty good at this! </p>
+
+<p><b>All:</b> Yeah. Yeah, excellent. </p>
+
+<p><b>Rachel:</b> (leaving to serve others) Good for me! </p>
+
+<p>(The gang swaps all the drinks for what they ordered as Phoebe enters.&nbsp; She sits
+down without saying hi.)</p>
+
+<p><b>Joey:</b> Y'okay, Phoebe? </p>
+
+<p><b>Phoebe:</b> Yeah- no- I'm just- it's, I haven't worked- It's my bank. </p>
+
+<p><b>Monica:</b> What did they do to you? </p>
+
+<
```

---

### Incident Patch 8: `ce5f2622` (2024-12-31)
**Commit Message**: Merge pull request #76 from KruxAI/data-ingest-sdk

SDK Library v0

**File**: `Brewfile` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-brew "qpdf"
-brew "libheif"
-brew "libmagic"
\ No newline at end of file
```

**File**: `README.md` (modified, +283/-175)
```diff
@@ -4,225 +4,333 @@
 # 
 
 [![made-with-python](https://img.shields.io/badge/Made%20with-Python-1f425f.svg)](https://www.python.org/)
-[![GitHub release](https://img.shields.io/github/release/KruxAI/ragbuilder.svg)](https://GitHub.com/KruxAI/ragbuilder/releases/)
+[![GitHub release](https://img.shields.io/github/release/KruxAI/ragbuilder.svg)](https://github.com/KruxAI/ragbuilder/releases/)
 [![GitHub license](https://badgen.net/github/license/KruxAI/ragbuilder)](https://github.com/KruxAI/ragbuilder/blob/master/LICENSE)
-[![GitHub commits](https://badgen.net/github/commits/KruxAI/ragbuilder)](https://GitHub.com/KruxAI/ragbuilder/commit/)
-[![GitHub forks](https://img.shields.io/github/forks/KruxAI/ragbuilder.svg?style=social&label=Fork&maxAge=2592000)](https://GitHub.com/KruxAI/ragbuilder/network/)
-[![GitHub stars](https://img.shields.io/github/stars/KruxAI/ragbuilder.svg?style=social&label=Star&maxAge=2592000)](https://GitHub.com/KruxAI/ragbuilder/stargazers/)
+[![GitHub commits](https://badgen.net/github/commits/KruxAI/ragbuilder)](https://github.com/KruxAI/ragbuilder/commit/)
 
 
 ![11926](https://github.com/user-attachments/assets/af9e241a-b648-4b2f-ab2a-3c268c7f1ca8)
 
 RagBuilder is a toolkit that helps you create optimal Production-ready Retrieval-Augmented-Generation (RAG) setup for your data automatically. By performing hyperparameter tuning on various RAG parameters (Eg: chunking strategy: semantic, character etc., chunk size: 1000, 2000 etc.), RagBuilder evaluates these configurations against a test dataset to identify the best-performing setup for your data. Additionally, RagBuilder includes several state-of-the-art, pre-defined RAG templates that have shown strong performance across diverse datasets. So just bring your data, and RagBuilder will generate a production-grade RAG setup in just minutes.
 
 
-https://github.com/user-attachments/assets/8b4a5013-b1b7-40ee-820b-32c46fd99a2a
-
-## Table of Contents
-
-- [Features](#features)
-- [Installation](#installation)
-- [Set your OpenAI API key](#set-your-openai-api-key)
-- [Quickstart Guide](#quickstart-guide)
-
 ## Features
-    
-- **Hyperparameter Tuning**: Efficiently identify optimal RAG configurations (combination of granular parameters like chunking strategy, chunking size, embedding models, retriever types etc.) using Bayesian optimization
-- **Pre-defined RAG Templates**: Use state-of-the-art templates that have demonstrated strong performance across various datasets.
-- **Evaluation Dataset Options**: Choose to generate a synthetic test dataset or provide your own.
-- **Automatic Reuse**: Automatically re-use previously generated synthetic test data when applicable.
-- **Easy-to-use Interface**: Intuitive UI to guide you through setting up, configuring, and reviewing your RAG configurations.
+
+- **Hyperparameter Tuning**: Efficiently optimize your RAG configurations using Bayesian optimization
+- **Pre-defined RAG Templates**: Use state-of-the-art templates that have demonstrated strong performance Eg: Graph retriever, Contextual chunker etc.)
+- **Evaluation Dataset Options**: Generate synthetic test dataset or provide your own
+- **Component Access**: Direct access to vectorstore, retriever, and generator components
+- **API Deployment**: Easily deploy as an API service
+- **Project Persistence**: Save and load optimized RAG pipelines
 
 
 ## Installation
 
-### Option 1: Install using install script:
-Note: For GraphRAG, Neo4J Graph Database details must be added in the .env file. For spinning up a local Neo4J Graph Database refer to repo https://github.com/KruxAI/neo4j-docker
-#### Mac
+```bash
+# Create a new venv
+uv venv ragbuilder
 
-``` sh
-curl -fsSL https://install.ragbuilder.io/mac | bash
-```
+# Activate the new venv
+source ragbuilder/bin/activate
 
-#### Windows
-``` sh
-curl -fsSL https://install.ragbuilder.io/win
+# Install
+uv pip install ragbuilder
 ```
 
-Run Install.bat from the command prompt
-```
-install.bat
-```
+See other installation options here ([link](https://docs.ragbuilder.io/quickstart/#installation))
 
+## Quick Start
 
+```python
+from ragbuilder import RAGBuilder
 
-#### Set your OpenAI API key
+# Initialize and optimize with defaults
+builder = RAGBuilder.from_source_with_defaults(input_source='https://lilianweng.github.io/posts/2023-06-23-agent/')
+results = builder.optimize()
 
-Make sure your OpenAI API key is available by setting it as an environment variable. In MacOS and Linux, this is the command:
+# Run a query through the complete pipeline
+response = results.invoke("What is HNSW?")
 
-```
-export OPENAI_API_KEY=XXXXX
+# View optimization summary
+print(results.summary())
 ```
 
-and on Windows it is
+### Setting Default Models
 
-```
-set OPENAI_API_KEY=XXXXX
-```
+You can specify default LLM and embedding models that will be used throughout the pipeline:
 
-Now, run ragbuilder on your command line:
+`````python
+from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
 
-``` s
```

**File**: `pyproject.toml` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+[project]
+name = "ragbuilder"
+dynamic = ["version"] 
+description = "RagBuilder SDK - Create optimal Production-ready RAG pipelines"
+authors = [
+    {name = "Ashwin Aravind", email = "ashwin@krux.ai"},
+    {name = "Aravind Parameswaran", email = "aravind@krux.ai"},
+]
+requires-python = ">=3.7"
+readme = "README.md"
+license = {text = "Apache-2.0"}
+
+dependencies = [
+    "chromadb",
+    "datasets>=2.18.0",
+    "fastapi>=0.100.0",
+    "jinja2",
+    "langchain>=0.1.0",
+    "langchain-community==0.2.7",
+    "langchain-core==0.2.20",
+    "langchain-huggingface==0.0.3",
+    "langchain-openai==0.1.17",
+    "opentelemetry-api>=1.23.0",
+    "opentelemetry-sdk>=1.23.0",
+    "opentelemetry-exporter-otlp>=1.23.0",
+    "optuna",
+    "platformdirs",
+    "pydantic>=2.0.0",
+    "python-dotenv",
+    "ragas==0.1.7",
+    "rerankers",
+    "rich>=13.0.0",
+    "sentence-transformers",
+    "tenacity==8.4.2",
+    "rank-bm25",
+    "uvicorn>=0.30.0",    
+]
+
+# Optional dependencies
+[project.optional-dependencies]
+graph = [
+    "neo4j>=5.23.0",
+    "langchain-community[neo4j]"
+]
+
+vectorstores = [
+    "elasticsearch>=8.0.0",
+    "faiss-cpu>=1.7.4",
+    "pinecone-client>=3.0.0",
+    "pymilvus>=2.3.0",
+    "qdrant-client>=1.7.0",
+    "weaviate-client>=3.25.0",    
+]
+
+# Document processing
+document_processors = [
+    "pymupdf>=1.23.0",
+    "python-docx>=1.0.0",
+    "pikepdf>=8.11.0",
+    "pandoc>=2.3",
+    "pypdf>=3.17.0",
+    "markdown>=3.5.0",
+    "beautifulsoup4>=4.12.0",
+    "unstructured[all-docs]>=0.11.0",
+]
+
+all = [
+    "ragbuilder[graph]",
+    "ragbuilder[vectorstores]",
+    "ragbuilder[document_processors]",
+]
+
+[project.scripts]
+ragbuilder = "ragbuilder.ragbuilder:main"
+
+[build-system]
+requires = ["setuptools>=45", "setuptools_scm[toml]>=6.2"]
+build-backend = "setuptools.build_meta"
+
+[tool.setuptools_scm]
+write_to = "src/ragbuilder/_version.py"
+version_scheme = "python-simplified-semver"
+
```

**File**: `requirements.txt` (removed, +0/-89)
```diff
@@ -1,89 +0,0 @@
-pytest==7.2.1
-pytest-xdist~=3.2.0
-coverage~=7.1.0
-black>=24.3.0
-pytest-timeout~=2.1.0
-pytest-env~= 0.8.1
-python-dotenv
-langchain
-langchain-community
-langchainhub
-langchain-openai 
-langchain-chroma
-bs4
-langchain-core==0.2.13
-unstructured
-pdf2image
-pdfminer.six
-langchain_experimental
-scikit-learn
-ragas==0.1.7
-inquirer
-llama_index
-chromadb
-sentence-transformers
-llama-index 
-llama-index-vector-stores-chroma
-llama-index-readers-web
-IPython
-llama-index-retrievers-bm25
-rake_nltk
-llama-index-embeddings-langchain
-llama-index-vector-stores-faiss
-faiss-cpu
-llama-index-llms-mistralai
-llama-index-embeddings-mistralai
-llama-index-embeddings-openai
-llama-index-postprocessor-longllmlingua 
-llmlingua
-llama_index-postprocessor-cohere_rerank
-llama_index-postprocessor-jinaai_rerank
-llama-index-postprocessor-rankgpt-rerank
-llama-index-postprocessor-colbert-rerank
-llama-index-postprocessor-rankllm-rerank
-llama-index-llms-openai
-langchain-huggingface
-rank_bm25
-ragas
-flask
-pandas
-opencv-python
-# unstructured-inference
-unstructured
-# unstructured[all-docs]
-mixpanel
-langchain-mistralai==0.1.9
-langchain_community==0.2.7
-huggingface_hub
-datasets
-langchain_text_splitters
-llama-index-core
-requests
-markdown
-langchain_pinecone
-singlestoredb
-fastapi
-pydantic==2.8.0
-uvicorn==0.30.0
-scikit-optimize
-pinecone-client
-pystemmer
-langchain_groq
-langchain-google-genai
-langchain-google-vertexai
-langchain-ollama
-langchain_postgres
-psycopg[binary,pool]
-langchain_milvus
-langsmith
-neo4j
-optuna
-tenacity==8.4.2
-rerankers
-rerankers[flashrank]
-rerankers[gpt]
-gensim
-ragatouille
-langchain-qdrant
-fastembed
-langchain-weaviate
\ No newline at end of file
```

**File**: `sample_data.txt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+# sample_data.txt
+This is a sample document for testing the RAGBuilder data ingestion pipeline.
+It contains multiple sentences to demonstrate chunking.
+We'll use this to test our parser, chunker, embedder, and indexer components.
+The goal is to ensure that our pipeline works end-to-end with a simple configuration.
```

**File**: `sample_questions.txt` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+What is the purpose of this document?
+What does this document show?
+What all components will we test?
```

**File**: `setup.py` (removed, +0/-121)
```diff
@@ -1,121 +0,0 @@
-from setuptools import setup, find_packages
-from setuptools import setup, find_packages
-with open("README.md", "r", encoding="utf-8") as fh:
-    long_description = fh.read()
-setup(
-    name='ragbuilder',
-    version='0.0.23',
-    author='Ashwin Aravind, Aravind Parameswaran',
-    author_email='ashwin@krux.ai, aravind@krux.ai',
-    description='RagBuilder is a toolkit designed to help you create optimal Production-ready Retrieval-Augmented Generation (RAG) pipeline for your data',
-    long_description=long_description,
-    long_description_content_type="text/markdown",
-    url='https://github.com/kruxai/ragbuilder',
-    license='Apache 2.0',
-    license_files=('LICENSE',),
-    package_dir={'': 'src'},
-    packages=find_packages(where='src'),
-    include_package_data=True,
-    python_requires='>=3.7',
-    package_data={
-        'ragbuilder': ['templates/*','static/*', 'eval.db'],
-    },
-    entry_points={
-        'console_scripts': [
-            'ragbuilder=ragbuilder.ragbuilder:main',
-        ],
-    },
-    install_requires=[
-        'fastapi',
-        'pytest==7.2.1',
-        'pytest-xdist~=3.2.0',
-        'coverage~=7.1.0',
-        'black>=24.3.0',
-        'pytest-timeout~=2.1.0',
-        'pytest-env~= 0.8.1',
-        'python-dotenv',
-        'langchain',
-        'langchain-community',
-        'langchainhub',
-        'langchain-openai',
-        'langchain-chroma',
-        'bs4',
-        'langchain-core==0.2.20',
-        'unstructured',
-        'pdf2image',
-        'pdfminer.six',
-        'langchain_experimental',
-        'scikit-learn',
-        'ragas==0.1.7',
-        'inquirer',
-        'chromadb',
-        'sentence-transformers',
-        'IPython',
-        'rake_nltk',
-        'faiss-cpu',
-        'llmlingua',
-        'langchain-huggingface',
-        'rank_bm25',
-        'ragas',
-        'pandas',
-        'pillow_heif',
-        'opencv-python',
-        'onnx==1.16.0',
-        'pikepdf',
-        'unstructured-inference',
-        'pytesseract',
-        'unstructured',
-        'unstructured[all-docs]',
-        'mixpanel',
-        'langchain-mistralai==0.1.9',
-        'langchain_community==0.2.7',
-        'huggingface_hub',
-        'datasets',
-        'langchain_text_splitters',
-        'requests',
-        'markdown',
-        'singlestoredb',
-        'langchain_pinecone',
-        'scikit-optimize',
-        'pydantic==2.8.0',
-        'uvicorn==0.30.0',
-        'pinecone-client',
-        'setuptools',
-        'langchain_groq',
-        'langchain-google-genai',
-        'langchain-google-vertexai',
-        'langchain-ollama',
-        'langchain_postgres',
-        'psycopg[binary,pool]',
-        'langchain_milvus',
-        'langsmith',
-        'optuna',
-        'tenacity==8.4.2',
-        'rerankers',
-        'rerankers[flashrank]',
-        'rerankers[gpt]',
-        'gensim',
-        'ragatouille',
-        'langchain-qdrant',
-        'fastembed',
-        'langchain-weaviate'
-        # 'llama-index',
-        # 'llama-index-vector-stores-chroma',
-        # 'llama-index-readers-web',
-        # 'llama-index-retrievers-bm25',
-        # 'llama-index-embeddings-langchain',
-        # 'llama-index-vector-stores-faiss',
-        # 'llama-index-llms-mistralai',
-        # 'llama-index-embeddings-mistralai',
-        # 'llama-index-embeddings-openai',
-        # 'llama-index-postprocessor-longllmlingua',
-        # 'llama_index-postprocessor-cohere_rerank',
-        # 'llama_index-postprocessor-jinaai_rerank',
-        # 'llama-index-postprocessor-rankgpt-rerank',
-        # 'llama-index-postprocessor-colbert-rerank',
-        # 'llama-index-postprocessor-rankllm-rerank',
-        # 'llama-index-llms-openai',
-        # 'llama-index-core',
-        # other dependencies
-    ],
-)
```

**File**: `src/ragbuilder/__init__.py` (modified, +8/-0)
```diff
@@ -0,0 +1,8 @@
+from .core.builder import RAGBuilder
+
+try:
+    from ._version import version as __version__
+except ImportError:
+    __version__ = "unknown version"
+
+__all__ = ['RAGBuilder', '__version__']
```

---

### Incident Patch 9: `d1f044f0` (2024-12-28)
**Commit Message**: Fix default getting overridden to None

**File**: `src/ragbuilder/core/builder.py` (modified, +9/-7)
```diff
@@ -44,9 +44,9 @@ def __init__(
             n_trials: Optional[int] = None,
             log_config: Optional[LogConfig] = None
         ):
-        ConfigStore.set_default_llm(default_llm)
-        ConfigStore.set_default_embeddings(default_embeddings)
-        ConfigStore.set_default_n_trials(n_trials)
+        ConfigStore.set_default_llm(default_llm) if default_llm else None
+        ConfigStore.set_default_embeddings(default_embeddings) if default_embeddings else None
+        ConfigStore.set_default_n_trials(n_trials) if n_trials else None
         self._log_config = log_config or LogConfig()
         self.data_ingest_config = data_ingest_config
         self.retrieval_config = retrieval_config
@@ -61,7 +61,9 @@ def __init__(
         self._optimization_results = OptimizationResults()
         self._test_dataset_manager = TestDatasetManager(
             self._log_config,
-            db_path=self.data_ingest_config.database_path if self.data_ingest_config else DEFAULT_DB_PATH
+            db_path=(self.data_ingest_config.database_path 
+                     if self.data_ingest_config and self.data_ingest_config.database_path 
+                     else DEFAULT_DB_PATH)
         )
 
     @classmethod
@@ -74,9 +76,9 @@ def from_source_with_defaults(cls,
                          log_config: Optional[LogConfig] = None
                          ) -> 'RAGBuilder':
         """Create RAGBuilder instance with default configuration"""
-        ConfigStore.set_default_llm(default_llm)
-        ConfigStore.set_default_embeddings(default_embeddings)
-        ConfigStore.set_default_n_trials(n_trials)
+        ConfigStore.set_default_llm(default_llm) if default_llm else None
+        ConfigStore.set_default_embeddings(default_embeddings) if default_embeddings else None
+        ConfigStore.set_default_n_trials(n_trials) if n_trials else None
         
         data_ingest_config = DataIngestOptionsConfig.with_defaults(
             input_source=input_source,
```

**File**: `src/ragbuilder/core/config_store.py` (modified, +2/-6)
```diff
@@ -32,9 +32,7 @@ def __new__(cls):
     @classmethod
     def set_default_llm(cls, llm_config: Optional[Union[Dict[str, Any], LLMConfig, BaseChatModel, BaseLLM]]) -> None:
         """Store default LLM configuration or instance"""
-        if llm_config is None:
-            cls._default_llm = None
-        elif isinstance(llm_config, dict):
+        if isinstance(llm_config, dict):
             cls._default_llm = LLMConfig(
                 type=LLMType.OPENAI,
                 model_kwargs=llm_config
@@ -55,9 +53,7 @@ def get_default_llm(cls) -> LLMConfig:
     @classmethod
     def set_default_embeddings(cls, embedding_config: Optional[Union[Dict[str, Any], EmbeddingConfig, Embeddings]]) -> None:
         """Store default Embedding configuration or instance"""
-        if embedding_config is None:
-            cls._default_embeddings = None
-        elif isinstance(embedding_config, dict):
+        if isinstance(embedding_config, dict):
             cls._default_embeddings = EmbeddingConfig(
                 type=EmbeddingType.OPENAI,
                 model_kwargs=embedding_config
```

---

### Incident Patch 10: `d848fc6c` (2024-12-28)
**Commit Message**: Minor fixes to synthetic eval data gen

**File**: `src/ragbuilder/core/builder.py` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ def _ensure_eval_dataset(self, config: Union[DataIngestOptionsConfig, RetrievalO
             raise ValueError("input_source is required when test_dataset is not provided")
             
         with console.status("Generating eval dataset..."):
-            test_dataset = self._test_dataset_manager.get_or_generate_dataset(
+            test_dataset = self._test_dataset_manager.get_or_generate_eval_dataset(
                 source_data=source_data
             )
         config.evaluation_config.test_dataset = test_dataset
```

**File**: `src/ragbuilder/generate_data.py` (modified, +3/-3)
```diff
@@ -186,11 +186,11 @@ def get_or_generate_eval_dataset(
             
             # Use default models if not provided
             generator_model = (eval_data_generation_config.generator_model if eval_data_generation_config and eval_data_generation_config.generator_model
-                            else ConfigStore.get_default_llm())
+                            else ConfigStore.get_default_llm().llm)
             critic_model = (eval_data_generation_config.critic_model if eval_data_generation_config and eval_data_generation_config.critic_model
-                          else ConfigStore.get_default_llm())
+                          else ConfigStore.get_default_llm().llm)
             embedding_model = (eval_data_generation_config.embedding_model if eval_data_generation_config and eval_data_generation_config.embedding_model
-                            else ConfigStore.get_default_embeddings())
+                            else ConfigStore.get_default_embeddings().embeddings)
             
             # Extract model info for telemetry
             generator_model_name = getattr(generator_model, 'model', None) or getattr(generator_model, 'model_name', '')
```

---

### Incident Patch 11: `ae243031` (2024-12-26)
**Commit Message**: Minor fix to retrieval results

**File**: `src/ragbuilder/core/results.py` (modified, +1/-1)
```diff
@@ -102,7 +102,7 @@ def invoke(self, question: str) -> Dict[str, Any]:
         if not all([self.retrieval, self.generation]):
             raise ValueError("Both retrieval and generation optimization required for querying")
 
-        retrieved_docs = self.retrieval.retrieve(question)
+        retrieved_docs = self.retrieval.invoke(question)
         result = self.generation.invoke(question)
 
         return {
```

---

### Incident Patch 12: `331f9281` (2024-12-26)
**Commit Message**: repr fix

**File**: `src/ragbuilder/core/results.py` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ def summary(self) -> Dict[str, Dict[str, Any]]:
             if result := getattr(self, module):
                 summary[module] = {
                     "score": result.best_score,
-                    "optimization_time": result.optimization_time,
+                    "optimization_time": result.optimization_time.total_seconds(),
                     "config": result.get_config_summary(),
                     "metrics": {
                         "avg_latency": result.avg_latency,
```

---

### Incident Patch 13: `0e1160c9` (2024-12-24)
**Commit Message**: Merge branch 'data-ingest-sdk' of https://github.com/KruxAI/ragbuilder into overall-sdk

**File**: `src/ragbuilder/_version.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+# file generated by setuptools_scm
+# don't change, don't track in version control
+TYPE_CHECKING = False
+if TYPE_CHECKING:
+    from typing import Tuple, Union
+    VERSION_TUPLE = Tuple[Union[int, str], ...]
+else:
+    VERSION_TUPLE = object
+
+version: str
+__version__: str
+__version_tuple__: VERSION_TUPLE
+version_tuple: VERSION_TUPLE
+
+__version__ = version = '0.1.1.dev15+g6bffeea.d20241224'
+__version_tuple__ = version_tuple = (0, 1, 1, 'dev15', 'g6bffeea.d20241224')
```

**File**: `src/ragbuilder/config/__init__.py` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 from .data_ingest import DataIngestConfig, DataIngestOptionsConfig
 from .retriever import RetrievalConfig, RetrievalOptionsConfig, BaseRetrieverConfig, RerankerConfig
-from .generator import GenerationConfig, GenerationOptionsConfig
+from .generation import GenerationConfig, GenerationOptionsConfig
 from .base import LogConfig
 
 __all__ = [
```

**File**: `src/ragbuilder/config/base.py` (modified, +3/-0)
```diff
@@ -39,6 +39,9 @@ def model_post_init(self, *args, **kwargs):
                 elif 'retriever' in module_name:
                     caller_module = 'retriever'
                     break
+                elif 'generation' in module_name:
+                    caller_module = 'generation'
+                    break
                 frame = frame.f_back
             else:
                 caller_module = 'unknown'
```

**File**: `src/ragbuilder/config/data_ingest.py` (modified, +1/-1)
```diff
@@ -140,7 +140,7 @@ def with_defaults(cls, input_source: str, test_dataset: Optional[str] = None) ->
             ],
             vector_databases=[VectorDBConfig(type=VectorDatabase.CHROMA, vectordb_kwargs={'collection_metadata': {'hnsw:space': 'cosine'}})],
             optimization=OptimizationConfig(
-                n_trials=10,
+                n_trials=1,
                 n_jobs=1,
                 optimization_direction="maximize"
             ),
```

**File**: `src/ragbuilder/config/generation.py` (renamed, +12/-2)
```diff
@@ -3,6 +3,7 @@
 import pandas as pd
 from ragbuilder.config.components import lazy_load
 from ragbuilder.config.base import ConfigMetadata
+from .base import OptimizationConfig, EvaluationConfig, ConfigMetadata
 import yaml
 # Define Pydantic Model for the Prompt Template
 class PromptTemplate(BaseModel):
@@ -146,6 +147,7 @@ class GenerationConfig(BaseConfig):
     model_name: Optional[str] = None
     model_kwargs: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Model-specific parameters")
     prompt_template: Optional[str] = None
+    prompt_key: Optional[str] = None
     eval_data_set_path: Optional[str] = None
     local_prompt_template_path: Optional[str] = None
     read_local_only: Optional[bool] = False
@@ -158,6 +160,12 @@ class GenerationOptionsConfig(BaseConfig):
     local_prompt_template_path: Optional[str] = None
     read_local_only: Optional[bool] = False
     retriever: Optional[Any]=None
+    database_logging: Optional[bool] = Field(default=True, description="Whether to log results to the DB")
+    database_path: Optional[str] = Field(default="eval.db", description="Path to the SQLite database file")
+    optimization: Optional[OptimizationConfig] = Field(
+        default_factory=OptimizationConfig,
+        description="Optimization configuration"
+    )
 
     @classmethod
     def with_defaults(cls) -> 'GenerationOptionsConfig':
@@ -174,7 +182,9 @@ def with_defaults(cls) -> 'GenerationOptionsConfig':
                 llms=[
                     LLMConfig(type=LLM.AZURE_OPENAI, model_kwargs={"model": "gpt-4o-mini", "temperature": 0.2}),  
                 ],
+                optimization=OptimizationConfig(
+                    n_trials=1,
+                    n_jobs=1,
+                optimization_direction="maximize"),
                 metadata=ConfigMetadata(is_default=True)
-
-
             )
\ No newline at end of file
```

**File**: `src/ragbuilder/config/retriever.py` (modified, +1/-1)
```diff
@@ -83,7 +83,7 @@ def with_defaults(cls) -> 'RetrievalOptionsConfig':
             rerankers=[RerankerConfig(type=RerankerType.BGE_BASE)],
             top_k=[3, 5],
             optimization=OptimizationConfig(
-                n_trials=10,
+                n_trials=1,
                 n_jobs=1,
                 optimization_direction="maximize"
             ),
```

**File**: `src/ragbuilder/core/builder.py` (modified, +8/-8)
```diff
@@ -1,7 +1,7 @@
 from typing import Optional, Any, Dict, Union
 from ragbuilder.config.data_ingest import DataIngestOptionsConfig 
 from ragbuilder.config.retriever import RetrievalOptionsConfig
-from ragbuilder.config.generator import GenerationOptionsConfig
+from ragbuilder.config.generation import GenerationOptionsConfig
 
 from ragbuilder.config.base import LogConfig
 from ragbuilder.data_ingest.optimization import run_data_ingest_optimization
@@ -285,7 +285,7 @@ def optimize_generation(
         
         self._ensure_eval_dataset(self._generation_config)
         
-        with telemetry.optimization_span("generator", self._generation_config.model_dump()) as span:
+        with telemetry.optimization_span("generation", self._generation_config.model_dump()) as span:
             try:
                 results = run_generation_optimization(
                     self._generation_config, 
@@ -296,12 +296,12 @@ def optimize_generation(
                 # Store results and update telemetry
                 self._optimization_results["generation"] = results
                 self._optimized_generation = results["best_pipeline"]
-                telemetry.update_optimization_results(span, results, "generator")
+                telemetry.update_optimization_results(span, results, "generation")
                 return results
                 
             except Exception as e:
                 telemetry.track_error(
-                    "generator",
+                    "generation",
                     e,
                     context={
                         "config_type": "default" if not config else "custom",
@@ -446,7 +446,7 @@ def save(self, path: str, include_vectorstore: bool = True) -> None:
                 yaml.dump(json.loads(serialize_config(self._retrieval_config)), f)
             
         if self._generation_config:
-            with open(save_path / "configs" / "generator.yaml", "w") as f:
+            with open(save_path / "configs" / "generation.yaml", "w") as f:
                 yaml.dump(json.loads(serialize_config(self._generation_config)), f)
 
         # Save optimization results
@@ -496,7 +496,7 @@ def save(self, path: str, include_vectorstore: bool = True) -> None:
             "components": {
                 "data_ingest": bool(self._data_ingest_config),
                 "retriever": bool(self._retrieval_config),
-                "generator": bool(self._generation_config)
+                "generation": bool(self._generation_config)
             },
             "vectorstore": {
                 "included": include_vectorstore,
@@ -545,8 +545,8 @@ def load(cls, path: str) -> 'RAGBuilder':
             with open(load_path / "configs" / "retriever.yaml", "r") as f:
                 retrieval_config = RetrievalOptionsConfig(**yaml.safe_load(f))
                 
-        if manifest["components"]["generator"]:
-            with open(load_path / "configs" / "generator.yaml", "r") as f:
+        if manifest["components"]["generation"]:
+            with open(load_path / "configs" / "generation.yaml", "r") as f:
                 generation_config = GenerationOptionsConfig(**yaml.safe_load(f))
 
         # Create builder instance
```

**File**: `src/ragbuilder/core/callbacks.py` (modified, +103/-12)
```diff
@@ -10,8 +10,9 @@
 from optuna.trial import Trial
 from ragbuilder.config.data_ingest import DataIngestOptionsConfig
 from ragbuilder.config.retriever import RetrievalOptionsConfig
+from ragbuilder.config.generation import GenerationOptionsConfig
 from .utils import serialize_config
-
+from datasets import Dataset
 logger = logging.getLogger(__name__)
 
 
@@ -20,13 +21,13 @@ class DBLoggerCallback(Protocol):
     
     def __init__(self, 
                  study_name: str,
-                 config: Union[DataIngestOptionsConfig, RetrievalOptionsConfig],
+                 config: Union[DataIngestOptionsConfig, RetrievalOptionsConfig, GenerationOptionsConfig],
                  module_type: str):
         """
         Args:
             study_name: Name of the optimization study
             config: Configuration for optimization
-            module_type: Type of module ('data_ingest' or 'retriever')
+            module_type: Type of module ('data_ingest' or 'retriever' or 'generation')
         """
         self.study_name = study_name
         self.config = config
@@ -127,6 +128,28 @@ def _init_tables(self):
                 error             TEXT,
                 eval_ts           BIGINT
             )
+            """,
+            """
+            CREATE TABLE IF NOT EXISTS generation_eval_details (
+                eval_id             BIGINT,
+                question_id         BIGINT,
+                question            TEXT,
+                answer              TEXT,
+                ground_truth        TEXT,
+                prompt_key          TEXT,
+                prompt              TEXT,
+                answer_correctness  FLOAT
+            )
+            """,
+                        """
+            CREATE TABLE IF NOT EXISTS generation_eval_summary (
+                run_id              BIGINT,
+                eval_id             BIGINT,
+                prompt_key          BIGINT,
+                prompt              TEXT,
+                config              TEXT,
+                average_correctness FLOAT
+            )
             """
         ]
         
@@ -183,7 +206,7 @@ def _update_run_status(self, status: str):
         except Exception as e:
             logger.error(f"Failed to update run status: {e}")
 
-    def _log_trial(self, trial: Trial, results: Dict[str, Any]) -> Optional[int]:
+    def _log_trial(self, trial: Trial=None, results: Dict[str, Any]=None, eval_results: Dataset=None, final_results: Dataset=None) -> Optional[int]:
         """Log trial results to database."""
         try:
             eval_id = int(time.time()*1000 + random.randint(1, 1000))
@@ -193,8 +216,10 @@ def _log_trial(self, trial: Trial, results: Dict[str, Any]) -> Optional[int]:
                 try:
                     if self.module_type == "retriever":
                         self._log_retriever_trial(cursor, eval_id, trial, results)
-                    else:
+                    elif self.module_type == "data_ingest":
                         self._log_data_ingest_trial(cursor, eval_id, trial, results)
+                    elif self.module_type == "generation":
+                        self._log_generation_trial(cursor,eval_id,eval_results,final_results)
                     
                     conn.commit()
                     return eval_id
@@ -209,7 +234,6 @@ def _log_trial(self, trial: Trial, results: Dict[str, Any]) -> Optional[int]:
 
     def _log_retriever_trial(self, cursor, eval_id: int, trial: Trial, results: Dict[str, Any]):
         """Log retriever trial results."""
-        # Log Summary
         cursor.execute(
             """
             INSERT INTO retriever_eval_summary (
@@ -262,7 +286,6 @@ def _log_retriever_trial(self, cursor, eval_id: int, trial: Trial, results: Dict
 
     def _log_data_ingest_trial(self, cursor, eval_id: int, trial: Trial, results: Dict[str, Any]):
         """Log data ingest trial results."""
-        # Existing data ingest logging implementation
         cursor.execute(
             """
             INSERT INTO data_ingest_eval_summary (
@@ -307,13 +330,81 @@ def _log_data_ingest_trial(self, cursor, eval_id: int, trial: Trial, results: Di
                 for idx, detail in enumerate(results['question_details'])
             ]
         )
+    def _log_generation_trial(self, cursor, eval_id: int, eval_results: Dataset, final_results: Dataset):
+        """Log generation trial results."""
+        try:
+            # Assuming eval_results has fields that match your database schema
+            for record in eval_results:
+                cursor.execute(
+                    """
+                    INSERT INTO generation_eval_details (
+                        eval_id,
+                        question_id, 
+                        question,
+                        answer, 
+                        ground_truth, 
+                        prompt_key,
+                        prompt, 
+                        answer_correctness
+             
```

---

### Incident Patch 14: `2d80dea3` (2024-12-23)
**Commit Message**: version & telemetry fix- AA

**File**: `src/ragbuilder/core/builder.py` (modified, +3/-3)
```diff
@@ -337,9 +337,9 @@ def optimize(self) -> Dict[str, Dict[str, Any]]:
                     "retrieval": retrieval_results,
                     "generation": generation_results
                 }
-                span.set_attribute("data_ingest_score", data_ingest_results.get("best_score", 0))
-                span.set_attribute("retrieval_score", retrieval_results.get("best_score", 0))
-                span.set_attribute("generation_score", generation_results.get("best_score", 0))
+                # span.set_attribute("data_ingest_score", data_ingest_results.get("best_score", 0))
+                # span.set_attribute("retrieval_score", retrieval_results.get("best_score", 0))
+                # span.set_attribute("generation_score", generation_results.get("best_score", 0))
 
                 return self._optimization_results
                 
```

**File**: `src/ragbuilder/core/telemetry.py` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
 from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
 from opentelemetry.sdk.resources import Resource
-from ragbuilder._version import __version__
+# from ragbuilder._version import __version__
 import logging
 from contextlib import contextmanager
 from datetime import datetime
```

---

### Incident Patch 15: `860bc271` (2024-12-22)
**Commit Message**: Merge branch 'data-ingest-sdk' of https://github.com/KruxAI/ragbuilder into overall-sdk

**File**: `call_invoke.ipynb` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+{
+ "cells": [
+  {
+   "cell_type": "code",
+   "execution_count": 1,
+   "metadata": {},
+   "outputs": [
+    {
+     "name": "stdout",
+     "output_type": "stream",
+     "text": [
+      "{\"response\":{\"answer\":\"Answer: Joey's roommate was Chandler Bing. This is a well-known aspect of the show \\\"Friends,\\\" where Joey and Chandler share an apartment together throughout much of the series.\",\"context\":\"The One Where Monica Gets a New Roommate (The Pilot-The Uncut Version)\\n\\nTranscribed by: guineapig Additional transcribing by: Eric Aasen (Note: The previously unseen parts of this episode are shown in\\n\\nFrannie: Hey, Monica!\\n\\nMonica: Hey Frannie, welcome back! How was Florida?\\n\\nFrannie: You had sex, didn't you?\\n\\nMonica: How do you do that?\\n\\nSo? Who?\\n\\nMonica: You know Paul?\\n\\nFrannie: Paul the Wine Guy? Oh yeah, I know Paul.\\n\\nMonica: You mean you know Paul like I know Paul?\\n\\nFrannie: Are you kidding? I take credit for Paul. Y'know before me, there was no snap in his turtle for two years.\\n\\n[Scene: Central Perk, everyone but Rachel is there.]\\n\\nJoey: (sitting on the arm of the couch)Of course it was a line!\\n\\nMonica: Why?! Why? Why, why would anybody do something like that?\\n\\nRoss: I assume we're looking for an answer more sophisticated than 'to get you into bed'.\\n\\nPhoebe: All right, c'mere, gimme your feet. (She starts massaging them.)\\n\\nMonica: I just thought he was nice, y'know?\\n\\nJoey: (bursts out laughing again) I can't believe you didn't know it was a line!\\n\\n(Monica pushes him off of the sofa as Rachel enters with a shopping bag.)\\n\\nRachel: Guess what?\\n\\nRoss: You got a job?\\n\\nRachel: Are you kidding? I'm trained for nothing! I was laughed out of twelve interviews today.\\n\\nChandler: And yet you're surprisingly upbeat.\\n\\nRachel: You would be too if you found John and David boots on sale, fifty percent off!\\n\\nChandler: Oh, how well you know me...\\n\\nRachel: They're my new 'I don't need a job, I don't need my parents, I've got great boots' boots!\\n\\nMonica: How'd you pay for them?\\n\\nRachel: Uh, credit card.\\n\\nMonica: And who pays for that?\\n\\nRachel: Um... my... father.\\n\\n[Scene: Monica and Rachel's, everyone is sitting around the kitchen table. Rachel's credit cards are spread out on the table along with a pair of scissors.]\\n\\nMonica: C'mon, you can't live off your parents your whole life.\\n\\nRachel: I know that. That's why I was getting married.\\nJennifer: With Operation.\\n\\nConan: It was a little game. Yeah, with an electric buzzer.\\n\\n[Cut to Monica and Chandler's, The One With George Stephanopoulos, Phoebe is showing Monica and Rachel that she brought Operation to their slumber party.]\\n\\nPhoebe: Oh-ooh, and I brought Operation, but umm I lost the umm (It starts buzzing) Its making a noise.\\n\\n[Cut back to the cast and Conan.]\\n\\nLisa: But le Blanc really doesnt mess up much.\\n\\nConan: You dont verbally mess up, but sometimes physically? You mess up.\\n\\nMatt: I have had some clumsy moments I guess you can call em.\\n\\n[Cut to Central Perk, to the theme from The Dick Van Dyke show Joey runs into Central Perk carrying a stack of Soap Opera Digests and falls on the step. He does bounce right back up making it all that much funnier.]\\n\\n[Cut back to the cast and Conan.]\\n\\nLisa: He fell down once! And we re-did it and we went back. And he(laughs)he was afraid he was gonna fall down\\n\\nConan: You could actually see him trying not to fall down.\\n\\n[Cut to Central Perk, same as before Joey is entering.]\\n\\nJoey: Pheebs! (He looks down as he goes down the step to make sure he didnt fall again.) Check it out! (He starts laughing when he realized what he did.)\\n\\n[Cut back to the cast and Conan.]\\n\\nCourtney: This particular time when he continued to fall or yknow, try not to fall, I was in the room with Matthew and Matthew was like, \\\"Should I do it?\\\"\\n\\n[Reset from before, Matt doesnt fall or look down.]\\n\\nJoey: Pheebs! Check it out! Check it out! Check it out! Check it out! (Hands her one.)\\n\\nPhoebe: Ooh, Soap Opera Digest!\\n\\n(As shes saying that Joey is to pull out a chair and sit down, only Matthew comes running in from off camera and dives for the same chair.)\\n\\n[Cut back to the cast and Conan.]\\n\\nConan: Matthew, you have a reputation with the rest of the cast that sometimes you like to, you like to fool around a bit. I mean like if somethings naturally going wrong you like to get in there and juice it a little bit. True or false?\\n[Cut to Joey and Rachel's, Joey and Ross are giving Phoebe and Rachel the brides maid test.]\\n\\nJoey: Okay, the next situation is for Rachel. The wedding is about to start you walk into the back room and you find Monica taking a nap with Ross. (Ross lies on the floor.) Ill be Monica. Go! (He jumps down and cuddles up with Ross.)\\n\\nRoss: (jumping up) No! No! No!\\n\\n(David and 
```

**File**: `src/ragbuilder/core/builder.py` (modified, +2/-1)
```diff
@@ -16,6 +16,7 @@
 from fastapi import FastAPI, HTTPException
 from pydantic import BaseModel
 import uvicorn
+import asyncio
 
 DEFAULT_DB_PATH = "eval.db"
 
@@ -408,7 +409,7 @@ async def invoke(request: QueryRequest) -> Dict[str, Any]:
                 raise HTTPException(status_code=500, detail=str(e))
                 
         self.logger.info(f"Starting RAG server on http://{host}:{port}")
-        uvicorn.run(app, host=host, port=port)
+        asyncio.run(uvicorn.run(app, host=host, port=port))
 
 class QueryRequest(BaseModel):
     query: str
```

#### Recent Merged Pull Requests:
- **PR #92** (2026-10-02): Harden RAGBuilder security and prepare private-key usage collector (@aravind10x)
- **PR #87** (2025-05-12): Ragbuilder v2 (@aravind10x)
- **PR #86** (2025-02-03): Demo - Friends transcripts (@aravind10x)
- **PR #82** (2024-11-15): milvus index fix (@ashwinzyx)
- **PR #81** (2024-11-05): Fix retriever duplication (@aravind10x)
- **PR #78** (2024-10-25): Update README.md (@aravind10x)
- **PR #77** (2024-10-24): Bug fixes (@aravind10x)
- **PR #76** (2024-12-31): SDK Library v0 (@aravind10x)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
