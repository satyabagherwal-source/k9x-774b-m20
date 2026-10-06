# Forensic Learning Record (Deep Inspection): aiming-lab/SimpleMem

> **Canonical Artifact**: `07_PROJECT_LEARNING/aiming-lab-simplemem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aiming-lab/SimpleMem](https://github.com/aiming-lab/SimpleMem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:13:12.190Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aiming-lab/SimpleMem`
- **Description**: [ICML'26] SimpleMem: Efficient Lifelong Memory for LLM Agents — Text & Multimodal
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 3821 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `EvolveMem/evolvemem/upgrade_worker.py`
```
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .config import EvolveMemConfig
from .promotion import MemoryPromotionCriteria
from .self_upgrade import MemorySelfUpgradeOrchestrator

logger = logging.getLogger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class MemoryUpgradeWorker:
    """Background worker that runs bounded memory self-upgrade cycles."""

    def __init__(
        self,
        config: EvolveMemConfig,
        window_check: Callable[[], bool] | None = None,
    ):
        self.config = config
        self.window_check = window_check
        self._stop = asyncio.Event()
        self._last_processed_mtime: float = 0.0
        self.state_path = Path(self.config.memory_dir).expanduser() / "upgrade_worker_state.json"
        self.alerts_path = Path(self.config.memory_dir).expanduser() / "upgrade_alerts.json"
        self.alerts_history_path = Path(self.config.memory_dir).expanduser() / "upgrade_alerts_history.jsonl"
        self.health_history_path = Path(self.config.memory_dir).expanduser() / "upgrade_health_history.jsonl"
        self._load_state()

    async def run(self) -> None:
        self._write_state("running", detail="worker started")
        logger.info(
            "[MemoryUpgradeWorker] started enabled=%s interval=%ss require_review=%s stale_after=%sh",
            self.config.memory_auto_upgrade_enabled,
            self.config.memory_auto_upgrade_interval_seconds,
            self.config.memory_auto_upgrade_require_review,
            self.config.memory_review_stale_after_hours,
        )
        while not self._stop.is_set():
            try:
                await self.run_once()
            except Exception as exc:
                self._write_state("error", detail=str(exc))
                logger.warning("[MemoryUpgradeWorker] cycle failed: %s", exc, exc_info=True)
            try:
                await asyncio.wait_for(
                    self._stop.wait(),
                    timeout=max(self.config.memory_auto_upgrade_interval_seconds, 30),
                )
            except asyncio.TimeoutError:
                continue
        self._write_state("stopped", detail="worker stopped")

    async def run_once(self) -> bool:
        if not self.config.memory_auto_upgrade_enabled:
            self._write_alerts([])
            self._write_health_snapshot({"level": "healthy", "reasons": []}, state="idle")
            self._write_state("idle", detail="auto upgrade disabled")
            return False
        if self.window_check is not None and not self.window_check():
            self._write_alerts([])
            self._write_health_snapshot({"level": "healthy", "reasons": []}, state="waiting_window")
            self._write_state("waiting_window", detail="no upgrade window open")
            logger.debug("[MemoryUpgradeWorker] skipped: no upgrade window open")
            return False

        records_path = Path(self.config.record_dir).expanduser() / "conversations.jsonl"
        if not records_path.exists() or records_path.stat().st_size <= 0:
            self._write_alerts([])
            self._write_health_snapshot({"level": "healthy", "reasons": []}, state="idle")
            self._write_state("idle", detail="no replay records")
            logger.debug("[MemoryUpgradeWorker] skipped: no replay records")
            return False

        mtime = records_path.stat().st_mtime
        if mtime <= self._last_processed_mtime:
            self._write_alerts([])
            self._write_health_snapshot({"level": "healthy", "reasons": []}, state="idle")
            self._write_state("idle", detail="records unchanged")
            logger.debug("[MemoryUpgradeWorker] skipped: records unchanged")
            return False

        orchestrator = MemorySelfUpgradeOrchestrator(
            self.config,
            history_path=str(Path(self.config.memory_dir).expanduser() / "upgrade_history.jsonl"),
        )
        review_summary = orchestrator.summarize_review_queue(
            stale_after_hours=self.config.memory_review_stale_after_hours
        )
        health = orchestrator.summarize_operational_health(
            stale_after_hours=self.config.memory_review_stale_after_hours
        )
        if review_summary["pending_count"] > 0:
            state = "waiting_review_stale" if review_summary["stale_count"] > 0 else "waiting_review"
            self._write_alerts(self._build_review_alerts(review_summary))
            self._write_health_snapshot(health, state=state)
            self._write_state(
                state,
                detail=(
                    "pending review queue is not empty "
                    f"(pending={review_summary['pending_count']} stale={review_summary['stale_count']} "
                    f"threshold_h={review_summary['stale_after_hours']})"
                ),
            )
            logger.info("[MemoryUpgradeWorker] skipped: pending review queue is not empty")
            return False
        # Run maintenance (expire TTL-stale, consolidate, cleanup) before upgrade cycle.
        try:
            from .manager import MemoryManager
            manager = MemoryManager.from_config(self.config)
            maint = manager.run_maintenance(self.config.memory_scope)
            expired = maint.get("expired", 0)
            if expired:
                logger.info("[MemoryUpgradeWorker] expired %d TTL-stale memories", expired)
            consolidated = maint.get("consolidated", {}).get("merged", 0)
            if consolidated:
                logger.info("[MemoryUpgradeWorker] consolidated %d near-duplicate memories", consolidated)
            manager.close()
        except Exception as exc:
            logger.debug("[MemoryUpgradeWorker] maintenance skipped: %s", exc)

        self._write_alerts([])
        self._write_health_snapshot(health, state="processing")
        self._write_state("processing", detail="running auto-upgrade cycle")
        decisions = orchestrator.run_auto_upgrade_cycle(
            replay_records_path=str(records_path),
            criteria=MemoryPromotionCriteria(min_sample_count=1),
            require_review=self.config.memory_auto_upgrade_require_review,
        )
        promoted = sum(1 for decision in decisions if decision.promoted)
        pending = sum(1 for decision in decisions if decision.reason == "pending_review")
        logger.info(
            "[MemoryUpgradeWorker] processed=%d promoted=%d pending_review=%d",
            len(decisions),
            promoted,
            pending,
        )
        self._last_processed_mtime = mtime
        self._write_state(
            "idle",
            detail=f"processed={len(decisions)} promoted={promoted} pending_review={pending}",
        )
        refreshed_health = orchestrator.summarize_operational_health(
            stale_after_hours=self.config.memory_review_stale_after_hours
        )
        self._write_health_snapshot(refreshed_health, state="idle")
        if pending > 0:
            refreshed_summary = orchestrator.summarize_review_queue(
                stale_after_hours=self.config.memory_review_stale_after_hours
            )
            self._write_alerts(self._build_review_alerts(refreshed_summary))
        else:
            self._write_alerts([])
        return True

    def stop(self) -> None:
        self._stop.set()

    def _write_state(self, state: str, detail: str = "") -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "updated_at": _utc_now_iso(),
            "state": state,
            "detail": detail,
            "enabled": self.config.memory_auto_upgrade_enabled,
            "interval_seconds": self.config.memory_auto_upgrade_interval_seconds,
            "require_review": self.config.memory_auto_upgrade_require_review,
            "review_stale_after_hours": self.config.memory_review_stale_after_hours,
            "last_processed_mtime": self._last_processed_mtime,
        }
        self.state_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )

    def _load_state(self) -> None:
        if not self.state_path.exists():
            return
        try:
            payload = json.loads(self.state_path.read_text(encoding="utf-8"))
        except Exception:
            return
        try:
            self._last_processed_mtime = float(payload.get("last_processed_mtime", 0.0) or 0.0)
        except (TypeError, ValueError):
            self._last_processed_mtime = 0.0

    def _write_alerts(self, alerts: list[dict]) -> None:
        self.alerts_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "updated_at": _utc_now_iso(),
            "alerts": alerts,
        }
        self.alerts_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )
        with self.alerts_history_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")

    def read_alert_history(self, limit: int = 20) -> list[dict]:
        if not self.alerts_history_path.exists():
            return []
        items: list[dict] = []
        for line in self.alerts_history_path.read_text(encoding="utf-8").splitlines()[-limit:]:
            line = line.strip()
            if not line:
                continue
            try:
                items.append(json.loads(line))
            except Exception:
                continue
        return items

    def summarize_alert_history(self) -> dict:
        items = self.read_alert_history(limit=1000000)
        now = datetime.now(timezone.utc)
        recent_window_hours = 168
        summary = {
            "total_snapshots": len(items),
            "nonempt
```

### Core Architecture Module: `MCP/reference/core/__init__.py`
```
"""
Core package
"""
from .memory_builder import MemoryBuilder
from .hybrid_retriever import HybridRetriever
from .answer_generator import AnswerGenerator

__all__ = ['MemoryBuilder', 'HybridRetriever', 'AnswerGenerator']

```

### Core Architecture Module: `MCP/reference/core/answer_generator.py`
```
"""
Answer Generator - Final synthesis from retrieved atomic contexts

Paper Reference: Section 3.3 - Reconstructive Synthesis (Read Path)
Generates answers from the final context C_final synthesized by query-aware retrieval
"""
from typing import List
from models.memory_entry import MemoryEntry
from utils.llm_client import LLMClient
import config


class AnswerGenerator:
    """
    Answer Generator - Reconstructive Synthesis from Atomic Contexts

    Paper Reference: Section 3.3 - Eq. (10)
    Synthesizes final answer from pruned, query-specific context:
    C_final = ⊕_{m ∈ Top-k_dyn(S)} [t_m: Content(m)]

    Features:
    1. Receive query and retrieved atomic entries
    2. Generate answers from disambiguated, self-contained facts
    3. Ensure accuracy through atomic context independence
    """
    def __init__(self, llm_client: LLMClient):
        self.llm_client = llm_client

    def generate_answer(self, query: str, contexts: List[MemoryEntry]) -> str:
        """
        Generate answer

        Args:
        - query: User question
        - contexts: List of retrieved relevant MemoryEntry

        Returns:
        - Generated answer (concise phrase)
        """
        if not contexts:
            return "No relevant information found"

        # Build context string
        context_str = self._format_contexts(contexts)

        # Build prompt
        prompt = self._build_answer_prompt(query, context_str)

        # Call LLM to generate answer
        messages = [
            {
                "role": "system",
                "content": "You are a professional Q&A assistant. Extract concise answers from context. You must output valid JSON format."
            },
            {
                "role": "user",
                "content": prompt
            }
        ]

        # Retry up to 3 times
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Use JSON format if configured
                response_format = None
                if hasattr(config, 'USE_JSON_FORMAT') and config.USE_JSON_FORMAT:
                    response_format = {"type": "json_object"}

                response = self.llm_client.chat_completion(
                    messages,
                    temperature=0.1,
                    response_format=response_format
                )

                # Parse JSON response
                result = self.llm_client.extract_json(response)
                # Return the answer from JSON
                return result.get("answer", response.strip())

            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Answer generation attempt {attempt + 1}/{max_retries} failed: {e}. Retrying...")
                else:
                    print(f"Warning: Failed to parse JSON response after {max_retries} attempts: {e}")
                    # Fallback to raw response
                    if 'response' in locals():
                        return response.strip()
                    else:
                        return "Failed to generate answer"

    def _format_contexts(self, contexts: List[MemoryEntry]) -> str:
        """
        Format contexts to readable text
        """
        formatted = []
        for i, entry in enumerate(contexts, 1):
            parts = [f"[Context {i}]"]
            parts.append(f"Content: {entry.lossless_restatement}")

            if entry.timestamp:
                parts.append(f"Time: {entry.timestamp}")

            if entry.location:
                parts.append(f"Location: {entry.location}")

            if entry.persons:
                parts.append(f"Persons: {', '.join(entry.persons)}")

            if entry.entities:
                parts.append(f"Related Entities: {', '.join(entry.entities)}")

            if entry.topic:
                parts.append(f"Topic: {entry.topic}")

            formatted.append("\n".join(parts))

        return "\n\n".join(formatted)

    def _build_answer_prompt(self, query: str, context_str: str) -> str:
        """
        Build answer generation prompt
        """
        return f"""
Answer the user's question based on the provided context.

User Question: {query}

Relevant Context:
{context_str}

Requirements:
1. First, think through the reasoning process
2. Then provide a very CONCISE answer (short phrase about core information)
3. Answer must be based ONLY on the provided context
4. All dates in the response must be formatted as 'DD Month YYYY' but you can output more or less details if needed
5. Return your response in JSON format

Output Format:
```json
{{
  "reasoning": "Brief explanation of your thought process",
  "answer": "Concise answer in a short phrase"
}}
```

Example:
Question: "When will they meet?"
Context: "Alice suggested meeting Bob at 2025-11-16T14:00:00..."

Output:
```json
{{
  "reasoning": "The context explicitly states the meeting time as 2025-11-16T14:00:00",
  "answer": "16 November 2025 at 2:00 PM"
}}
```

Now answer the question. Return ONLY the JSON, no other text.
"""

```

### Core Architecture Module: `MCP/reference/core/hybrid_retriever.py`
```
"""
Hybrid Retriever - Stage 3: Adaptive Query-Aware Retrieval with Pruning (Section 3.3)

Paper Reference: Section 3.3 - Adaptive Query-Aware Retrieval with Pruning
Implements:
- Hybrid scoring function S(q, m_k) aggregating semantic, lexical, and symbolic signals
- Query Complexity estimation C_q for adaptive retrieval depth
- Dynamic retrieval depth k_dyn = k_base · (1 + δ · C_q)
- Complexity-Aware Pruning to minimize token usage while maximizing accuracy
"""
from typing import List, Optional, Dict, Any
from models.memory_entry import MemoryEntry
from utils.llm_client import LLMClient
from database.vector_store import VectorStore
import config
import re
from datetime import datetime, timedelta
import dateparser
import concurrent.futures


class HybridRetriever:
    """
    Hybrid Retriever - Stage 3: Adaptive Query-Aware Retrieval with Pruning

    Paper Reference: Section 3.3 - Adaptive Query-Aware Retrieval with Pruning

    Core Components:
    1. Query-aware retrieval across three structured layers:
       - Semantic Layer: Dense vector similarity
       - Lexical Layer: Sparse keyword matching (BM25)
       - Symbolic Layer: Metadata filtering
    2. Hybrid Scoring Function S(q, m_k): aggregates multi-layer signals
    3. Complexity-Aware Pruning: dynamic depth based on C_q
    4. Planning-based multi-query decomposition for comprehensive retrieval
    """
    def __init__(
        self,
        llm_client: LLMClient,
        vector_store: VectorStore,
        semantic_top_k: int = None,
        keyword_top_k: int = None,
        structured_top_k: int = None,
        enable_planning: bool = True,
        enable_reflection: bool = True,
        max_reflection_rounds: int = 2,
        enable_parallel_retrieval: bool = True,
        max_retrieval_workers: int = 3
    ):
        self.llm_client = llm_client
        self.vector_store = vector_store
        self.semantic_top_k = semantic_top_k or config.SEMANTIC_TOP_K
        self.keyword_top_k = keyword_top_k or config.KEYWORD_TOP_K
        self.structured_top_k = structured_top_k or config.STRUCTURED_TOP_K
        
        # Use config values as default if not explicitly provided
        self.enable_planning = enable_planning if enable_planning is not None else getattr(config, 'ENABLE_PLANNING', True)
        self.enable_reflection = enable_reflection if enable_reflection is not None else getattr(config, 'ENABLE_REFLECTION', True)
        self.max_reflection_rounds = max_reflection_rounds if max_reflection_rounds is not None else getattr(config, 'MAX_REFLECTION_ROUNDS', 2)
        self.enable_parallel_retrieval = enable_parallel_retrieval if enable_parallel_retrieval is not None else getattr(config, 'ENABLE_PARALLEL_RETRIEVAL', True)
        self.max_retrieval_workers = max_retrieval_workers if max_retrieval_workers is not None else getattr(config, 'MAX_RETRIEVAL_WORKERS', 3)

    def retrieve(self, query: str, enable_reflection: Optional[bool] = None) -> List[MemoryEntry]:
        """
        Execute retrieval with planning and optional reflection

        Args:
        - query: Search query
        - enable_reflection: Override the global reflection setting for this query
                           (useful for adversarial questions that shouldn't use reflection)

        Returns: List of relevant MemoryEntry
        """
        if self.enable_planning:
            return self._retrieve_with_planning(query, enable_reflection)
        else:
            # Fallback to simple semantic search
            return self._semantic_search(query)
    
    def _retrieve_with_planning(self, query: str, enable_reflection: Optional[bool] = None) -> List[MemoryEntry]:
        """
        Execute retrieval with intelligent planning process
        
        Args:
        - query: Search query  
        - enable_reflection: Override reflection setting for this query
        """
        print(f"\n[Planning] Analyzing information requirements for: {query}")
        
        # Step 1: Intelligent analysis of what information is needed
        information_plan = self._analyze_information_requirements(query)
        print(f"[Planning] Identified {len(information_plan['required_info'])} information requirements")
        
        # Step 2: Generate minimal necessary queries based on the plan
        search_queries = self._generate_targeted_queries(query, information_plan)
        print(f"[Planning] Generated {len(search_queries)} targeted queries")
        
        # Step 3: Execute searches for all queries (parallel or sequential)
        if self.enable_parallel_retrieval and len(search_queries) > 1:
            all_results = self._execute_parallel_searches(search_queries)
        else:
            all_results = []
            for i, search_query in enumerate(search_queries, 1):
                print(f"[Search {i}] {search_query}")
                results = self._semantic_search(search_query)
                all_results.extend(results)
        
        # Step 4: Merge and deduplicate results
        merged_results = self._merge_and_deduplicate_entries(all_results)
        print(f"[Planning] Found {len(merged_results)} unique results")
        
        # Step 5: Optional reflection-based additional retrieval
        # Use override parameter if provided, otherwise use global setting
        should_use_reflection = enable_reflection if enable_reflection is not None else self.enable_reflection
        
        if should_use_reflection:
            merged_results = self._retrieve_with_intelligent_reflection(query, merged_results, information_plan)
        
        return merged_results
    
    def _retrieve_with_reflection(self, query: str, initial_results: List[MemoryEntry]) -> List[MemoryEntry]:
        """
        Execute reflection-based additional retrieval
        """
        current_results = initial_results
        
        for round_num in range(self.max_reflection_rounds):
            print(f"\n[Reflection Round {round_num + 1}] Checking if results are sufficient...")
            
            # Quick answer attempt with current results
            if not current_results:
                answer_status = "no_results"
            else:
                answer_status = self._check_answer_adequacy(query, current_results)
            
            if answer_status == "sufficient":
                print(f"[Reflection Round {round_num + 1}] Information is sufficient")
                break
            elif answer_status == "insufficient":
                print(f"[Reflection Round {round_num + 1}] Information is insufficient, generating additional queries...")
                
                # Generate additional targeted queries based on what's missing
                additional_queries = self._generate_additional_queries(query, current_results)
                print(f"[Reflection Round {round_num + 1}] Generated {len(additional_queries)} additional queries")
                
                # Execute additional searches (parallel or sequential)
                if self.enable_parallel_retrieval and len(additional_queries) > 1:
                    print(f"[Reflection Round {round_num + 1}] Executing {len(additional_queries)} additional queries in parallel")
                    additional_results = self._execute_parallel_additional_searches(additional_queries, round_num + 1)
                else:
                    additional_results = []
                    for i, add_query in enumerate(additional_queries, 1):
                        print(f"[Additional Search {i}] {add_query}")
                        results = self._semantic_search(add_query)
                        additional_results.extend(results)
                
                # Merge with existing results
                all_results = current_results + additional_results
                current_results = self._merge_and_deduplicate_entries(all_results)
                print(f"[Reflection Round {round_num + 1}] Total results: {len(current_results)}")
                
            else:  # "no_results"
                print(f"[Reflection Round {round_num + 1}] No results found, cannot continue reflection")
                break
        
        return current_results

    def _analyze_query(self, query: str) -> Dict[str, Any]:
        """
        Use LLM to analyze query intent and extract structured information
        """
        prompt = f"""
Analyze the following query and extract key information:

Query: {query}

Please extract:
1. keywords: List of keywords (names, places, topic words, etc.)
2. persons: Person names mentioned
3. time_expression: Time expression (if any)
4. location: Location (if any)
5. entities: Entities (companies, products, etc.)

Return in JSON format:
```json
{{
  "keywords": ["keyword1", "keyword2", ...],
  "persons": ["name1", "name2", ...],
  "time_expression": "time expression or null",
  "location": "location or null",
  "entities": ["entity1", ...]
}}
```

Return ONLY JSON, no other content.
"""

        messages = [
            {"role": "system", "content": "You are a query analysis assistant. You must output valid JSON format."},
            {"role": "user", "content": prompt}
        ]

        # Retry up to 3 times
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Use JSON format if configured
                response_format = None
                if hasattr(config, 'USE_JSON_FORMAT') and config.USE_JSON_FORMAT:
                    response_format = {"type": "json_object"}

                response = self.llm_client.chat_completion(
                    messages,
                    temperature=0.1,
                    response_format=response_format
                )
                analysis = self.llm_client.extract_json(response)
                return analysis
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"Query analysis attempt {attempt + 1}/{max_retries} failed: {e}. Retr
```

### Core Architecture Module: `MCP/reference/utils/__init__.py`
```
"""
Utils package
"""
from .llm_client import LLMClient
from .embedding import EmbeddingModel

__all__ = ['LLMClient', 'EmbeddingModel']

```

### Core Architecture Module: `MCP/reference/utils/embedding.py`
```
"""
Embedding utilities - Generate vector embeddings using SentenceTransformers
Supports Qwen3 Embedding models through SentenceTransformers interface
"""
from typing import List, Optional, Dict, Any
import numpy as np
import config
import os


class EmbeddingModel:
    """
    Embedding model using SentenceTransformers (supports Qwen3 and other models)
    """
    def __init__(self, model_name: str = None, use_optimization: bool = True):
        self.model_name = model_name or config.EMBEDDING_MODEL
        self.use_optimization = use_optimization
        
        print(f"Loading embedding model: {self.model_name}")
        
        # Check if it's a Qwen3 model (through SentenceTransformers)
        if self.model_name.startswith("qwen3"):
            self._init_qwen3_sentence_transformer()
        else:
            self._init_standard_sentence_transformer()

    def _init_qwen3_sentence_transformer(self):
        """Initialize Qwen3 model using SentenceTransformers"""
        try:
            from sentence_transformers import SentenceTransformer
            
            # Map model names to actual model paths
            qwen3_models = {
                "qwen3-0.6b": "Qwen/Qwen3-Embedding-0.6B",
                "qwen3-4b": "Qwen/Qwen3-Embedding-4B", 
                "qwen3-8b": "Qwen/Qwen3-Embedding-8B"
            }
            
            model_path = qwen3_models.get(self.model_name, self.model_name)
            print(f"Loading Qwen3 model via SentenceTransformers: {model_path}")
            
            # Initialize with optimization settings
            if self.use_optimization:
                try:
                    # Try to use flash_attention_2 and left padding for better performance
                    self.model = SentenceTransformer(
                        model_path,
                        model_kwargs={
                            "attn_implementation": "flash_attention_2", 
                            "device_map": "auto"
                        },
                        tokenizer_kwargs={"padding_side": "left"},
                        trust_remote_code=True
                    )
                    print("Qwen3 loaded with flash_attention_2 optimization")
                except Exception as e:
                    print(f"Flash attention failed ({e}), using standard loading...")
                    self.model = SentenceTransformer(model_path, trust_remote_code=True)
            else:
                self.model = SentenceTransformer(model_path, trust_remote_code=True)
            
            self.dimension = self.model.get_sentence_embedding_dimension()
            self.model_type = "qwen3_sentence_transformer"
            
            # Check if Qwen3 supports query prompts
            self.supports_query_prompt = hasattr(self.model, 'prompts') and 'query' in getattr(self.model, 'prompts', {})
            
            print(f"Qwen3 model loaded successfully with dimension: {self.dimension}")
            if self.supports_query_prompt:
                print("Query prompt support detected")
                
        except Exception as e:
            print(f"Failed to load Qwen3 model: {e}")
            print("Falling back to default SentenceTransformers model...")
            self._fallback_to_sentence_transformer()

    def _init_standard_sentence_transformer(self):
        """Initialize standard SentenceTransformer model"""
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
            self.dimension = self.model.get_sentence_embedding_dimension()
            self.model_type = "sentence_transformer"
            self.supports_query_prompt = False
            print(f"SentenceTransformer model loaded with dimension: {self.dimension}")
        except Exception as e:
            print(f"Failed to load SentenceTransformer model: {e}")
            raise

    def _fallback_to_sentence_transformer(self):
        """Fallback to default SentenceTransformer model"""
        fallback_model = "sentence-transformers/all-MiniLM-L6-v2"
        print(f"Using fallback model: {fallback_model}")
        self.model_name = fallback_model
        self._init_standard_sentence_transformer()

    def encode(self, texts: List[str], is_query: bool = False) -> np.ndarray:
        """
        Encode list of texts to vectors
        
        Args:
        - texts: List of texts to encode
        - is_query: Whether these are query texts (for Qwen3 prompt optimization)
        """
        if isinstance(texts, str):
            texts = [texts]
        
        # Use query prompt for Qwen3 models when encoding queries
        if self.model_type == "qwen3_sentence_transformer" and self.supports_query_prompt and is_query:
            return self._encode_with_query_prompt(texts)
        else:
            return self._encode_standard(texts)

    def encode_single(self, text: str, is_query: bool = False) -> np.ndarray:
        """
        Encode single text
        
        Args:
        - text: Text to encode
        - is_query: Whether this is a query text (for Qwen3 prompt optimization)
        """
        return self.encode([text], is_query=is_query)[0]
    
    def encode_query(self, queries: List[str]) -> np.ndarray:
        """
        Encode queries with optimal settings for Qwen3
        """
        return self.encode(queries, is_query=True)
    
    def encode_documents(self, documents: List[str]) -> np.ndarray:
        """
        Encode documents (no query prompt)
        """
        return self.encode(documents, is_query=False)
    
    def _encode_with_query_prompt(self, texts: List[str]) -> np.ndarray:
        """Encode texts using Qwen3 query prompt"""
        try:
            embeddings = self.model.encode(
                texts, 
                prompt_name="query",  # Use Qwen3's query prompt
                show_progress_bar=False,
                normalize_embeddings=True
            )
            return embeddings
        except Exception as e:
            print(f"Query prompt encoding failed: {e}, falling back to standard encoding")
            return self._encode_standard(texts)
    
    def _encode_standard(self, texts: List[str]) -> np.ndarray:
        """Encode texts using standard method"""
        embeddings = self.model.encode(
            texts, 
            show_progress_bar=False,
            normalize_embeddings=True
        )
        return embeddings

```

### Core Architecture Module: `MCP/reference/utils/llm_client.py`
```
"""
LLM Client - Handles all LLM interactions
"""
import json
from typing import List, Dict, Any, Optional
from openai import OpenAI
import config


class LLMClient:
    """
    Unified LLM client interface
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        enable_thinking: Optional[bool] = None,
        use_streaming: Optional[bool] = None
    ):
        self.api_key = api_key or config.OPENAI_API_KEY
        self.model = model or config.LLM_MODEL
        self.base_url = base_url or config.OPENAI_BASE_URL
        self.enable_thinking = enable_thinking if enable_thinking is not None else config.ENABLE_THINKING
        self.use_streaming = use_streaming if use_streaming is not None else config.USE_STREAMING

        # Initialize OpenAI client with optional base_url
        client_kwargs = {"api_key": self.api_key}
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
            print(f"Using custom OpenAI base URL: {self.base_url}")

        if self.enable_thinking:
            print(f"Deep thinking mode enabled")

        self.client = OpenAI(**client_kwargs)

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.2,
        response_format: Optional[Dict[str, str]] = None,
        max_retries: int = 3
    ) -> str:
        """
        Standard chat completion with optional thinking mode and retry mechanism
        """
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }

        if response_format:
            kwargs["response_format"] = response_format

        # Enable thinking mode if configured (for Qwen and compatible models only)
        # Only add enable_thinking parameter for Qwen API (identified by base_url)
        is_qwen_api = self.base_url and "dashscope.aliyuncs.com" in self.base_url
        
        if is_qwen_api:
            # Qwen API requires explicit enable_thinking parameter
            # - Streaming + thinking: enable_thinking=True
            # - Non-streaming: enable_thinking=False (required, not optional)
            # - JSON format: enable_thinking=False (incompatible with thinking mode)
            if self.use_streaming and self.enable_thinking and not response_format:
                kwargs["extra_body"] = {"enable_thinking": True}
            else:
                # Explicitly set to False for non-streaming calls or JSON format
                kwargs["extra_body"] = {"enable_thinking": False}
        # For OpenAI and other APIs, don't add extra_body parameters

        # Retry mechanism
        last_exception = None
        for attempt in range(max_retries):
            try:
                # Use streaming if configured
                if self.use_streaming:
                    kwargs["stream"] = True
                    return self._handle_streaming_response(**kwargs)
                else:
                    response = self.client.chat.completions.create(**kwargs)
                    return response.choices[0].message.content
                    
            except Exception as e:
                last_exception = e
                if attempt < max_retries - 1:
                    import time
                    wait_time = (2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                    print(f"LLM API call failed (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    print(f"LLM API call failed after {max_retries} attempts: {e}")
        
        # If all retries failed, raise the last exception
        raise last_exception

    def _handle_streaming_response(self, **kwargs) -> str:
        """
        Handle streaming response and collect full content
        """
        full_content = []
        stream = self.client.chat.completions.create(**kwargs)

        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                content = chunk.choices[0].delta.content
                full_content.append(content)
                # Optional: print streaming content in real-time
                # print(content, end='', flush=True)

        return ''.join(full_content)

    def extract_json(self, text: str) -> Any:
        """
        Extract JSON from LLM response with robust parsing
        Supports multiple formats:
        1. Pure JSON
        2. ```json ... ```
        3. ``` ... ``` (generic code block)
        4. JSON embedded in text with common prefixes
        5. Multiple JSON objects (returns first valid one)
        """
        if not text or not text.strip():
            raise ValueError("Empty response received")

        text = text.strip()

        # Remove common LLM prefixes/suffixes
        common_prefixes = [
            "Here's the JSON:",
            "Here is the JSON:",
            "The JSON is:",
            "JSON:",
            "Result:",
            "Output:",
            "Answer:",
        ]
        for prefix in common_prefixes:
            if text.lower().startswith(prefix.lower()):
                text = text[len(prefix):].strip()

        # Try direct parsing first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from ```json ... ``` block
        if "```json" in text.lower():
            # Case insensitive search for ```json
            start_marker = "```json"
            start_idx = text.lower().find(start_marker)
            if start_idx != -1:
                start = start_idx + len(start_marker)
                # Find the closing ```
                end = text.find("```", start)
                if end != -1:
                    json_str = text[start:end].strip()
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError as e:
                        # Try to clean up common issues
                        json_str = self._clean_json_string(json_str)
                        try:
                            return json.loads(json_str)
                        except json.JSONDecodeError:
                            pass

        # Try extracting from generic ``` ... ``` code block
        if "```" in text:
            start = text.find("```") + 3
            # Skip language identifier if present
            newline = text.find("\n", start)
            if newline != -1 and newline - start < 20:
                start = newline + 1
            end = text.find("```", start)
            if end != -1:
                json_str = text[start:end].strip()
                try:
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    # Try to clean up
                    json_str = self._clean_json_string(json_str)
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        pass

        # Try finding balanced JSON object/array by scanning for { or [
        for start_char in ['{', '[']:
            result = self._extract_balanced_json(text, start_char)
            if result is not None:
                return result

        # Last resort: try to find any JSON-like structure and clean it
        for start_char in ['{', '[']:
            start_idx = text.find(start_char)
            if start_idx != -1:
                # Extract a large chunk and try to parse
                chunk = text[start_idx:]
                cleaned = self._clean_json_string(chunk)
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass

        raise ValueError(f"Failed to extract valid JSON from response. First 300 chars: {text[:300]}...")

    def _clean_json_string(self, json_str: str) -> str:
        """
        Clean common issues in JSON strings from LLM output
        """
        # Remove trailing commas before } or ]
        import re
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)

        # Remove comments (// and /* */)
        json_str = re.sub(r'//.*?$', '', json_str, flags=re.MULTILINE)
        json_str = re.sub(r'/\*.*?\*/', '', json_str, flags=re.DOTALL)

        return json_str.strip()

    def _extract_balanced_json(self, text: str, start_char: str) -> Any:
        """
        Extract a balanced JSON object or array starting with start_char
        """
        end_char = '}' if start_char == '{' else ']'
        start_idx = text.find(start_char)

        if start_idx == -1:
            return None

        # Track depth to find matching closing bracket
        depth = 0
        in_string = False
        escape_next = False

        for i in range(start_idx, len(text)):
            char = text[i]

            # Handle string escaping
            if escape_next:
                escape_next = False
                continue

            if char == '\\':
                escape_next = True
                continue

            # Handle strings (don't count brackets inside strings)
            if char == '"':
                in_string = not in_string
                continue

            if in_string:
                continue

            # Count depth
            if char == start_char:
                depth += 1
            elif char == end_char:
                depth -= 1
                if depth == 0:
                    json_str = text[start_idx:i+1]
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError:
                        # Try cleaning and parsing again
                        cleaned = self._clean_json_string(json_str)
                        try:
                        
```

### Core Architecture Module: `MCP/server/core/__init__.py`
```
"""Core processing modules for SimpleMem"""

from .memory_builder import MemoryBuilder
from .retriever import Retriever
from .answer_generator import AnswerGenerator

__all__ = ["MemoryBuilder", "Retriever", "AnswerGenerator"]

```

### Core Architecture Module: `MCP/server/core/answer_generator.py`
```
"""
Answer Generator - Final Synthesis Module

Synthesizes answers from retrieved memory contexts using LLM.
"""

from typing import List, Optional

from ..auth.models import MemoryEntry

# Type alias for LLM client (supports both OpenRouter and Ollama)
LLMClient = object  # Duck-typed: can be OpenRouterClient or OllamaClient


class AnswerGenerator:
    """
    Generates answers from retrieved memory contexts.
    """

    def __init__(
        self,
        llm_client: LLMClient,
        temperature: float = 0.1,
    ):
        self.client = llm_client
        self.temperature = temperature

    async def generate_answer(
        self,
        query: str,
        contexts: List[MemoryEntry],
    ) -> dict:
        """
        Generate an answer from retrieved contexts

        Args:
            query: User's question
            contexts: Retrieved MemoryEntry objects

        Returns:
            Dict with answer and reasoning
        """
        if not contexts:
            return {
                "answer": "I don't have any relevant memories to answer this question.",
                "reasoning": "No relevant context was found in the memory store.",
                "confidence": "low",
            }

        # Format contexts
        context_str = self._format_contexts(contexts)

        # Build prompt
        prompt = self._build_answer_prompt(query, context_str)

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant that answers questions based on provided context. "
                    "Always base your answers on the given context. "
                    "If the context doesn't contain enough information, say so."
                ),
            },
            {"role": "user", "content": prompt},
        ]

        # Retry mechanism
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = await self.client.chat_completion(
                    messages=messages,
                    temperature=self.temperature,
                    response_format={"type": "json_object"},
                )

                data = self.client.extract_json(response)
                if data:
                    return {
                        "answer": data.get("answer", "Unable to generate answer."),
                        "reasoning": data.get("reasoning", ""),
                        "confidence": data.get("confidence", "medium"),
                    }

            except Exception as e:
                print(f"Answer generation attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    return {
                        "answer": "An error occurred while generating the answer.",
                        "reasoning": f"Error: {str(e)}",
                        "confidence": "low",
                    }

        return {
            "answer": "Unable to generate answer after multiple attempts.",
            "reasoning": "JSON parsing failed.",
            "confidence": "low",
        }

    def _format_contexts(self, contexts: List[MemoryEntry]) -> str:
        """Format memory entries into readable context"""
        formatted = []

        for i, entry in enumerate(contexts[:30], 1):  # Limit to 30 entries
            parts = [f"[{i}] {entry.lossless_restatement}"]

            metadata = []
            if entry.timestamp:
                metadata.append(f"Time: {entry.timestamp}")
            if entry.location:
                metadata.append(f"Location: {entry.location}")
            if entry.persons:
                metadata.append(f"Persons: {', '.join(entry.persons)}")
            if entry.entities:
                metadata.append(f"Entities: {', '.join(entry.entities)}")
            if entry.topic:
                metadata.append(f"Topic: {entry.topic}")

            if metadata:
                parts.append(f"   ({'; '.join(metadata)})")

            formatted.append("\n".join(parts))

        return "\n\n".join(formatted)

    def _build_answer_prompt(self, query: str, context_str: str) -> str:
        """Build the answer generation prompt"""
        return f"""Answer the user's question based on the provided context.

## User Question:
{query}

## Relevant Context:
{context_str}

## Requirements:
1. Think through the reasoning process step by step
2. Base your answer ONLY on the provided context
3. Provide a CONCISE answer (short phrase or 1-2 sentences)
4. Format dates as 'DD Month YYYY' (e.g., "15 January 2025")
5. If context is insufficient, clearly state that

## Confidence Levels:
- "high": Context directly answers the question
- "medium": Context provides partial or indirect information
- "low": Context is insufficient or answer requires inference

## Output Format (JSON only):
{{
  "reasoning": "Brief explanation of how you derived the answer",
  "answer": "Concise answer to the question",
  "confidence": "high/medium/low"
}}

Return ONLY valid JSON. No other text."""

    async def generate_summary(
        self,
        entries: List[MemoryEntry],
        topic: Optional[str] = None,
    ) -> str:
        """
        Generate a summary of memory entries

        Args:
            entries: MemoryEntry objects to summarize
            topic: Optional topic focus

        Returns:
            Summary text
        """
        if not entries:
            return "No memories to summarize."

        # Format entries
        entries_text = "\n".join([
            f"- {entry.lossless_restatement}"
            for entry in entries[:50]
        ])

        topic_str = f" about {topic}" if topic else ""

        prompt = f"""Summarize the following memories{topic_str}:

{entries_text}

Provide a concise summary (2-4 sentences) that captures the key information.

Return ONLY the summary text, no JSON or formatting."""

        messages = [
            {"role": "system", "content": "You are a helpful summarization assistant."},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await self.client.chat_completion(
                messages=messages,
                temperature=self.temperature,
            )
            return response.strip()
        except Exception as e:
            return f"Error generating summary: {e}"

```

### Core Architecture Module: `MCP/server/core/retriever.py`
```
"""
Retriever - Stage 3: Adaptive Query-Aware Retrieval

Performs intelligent retrieval through:
- Query complexity analysis
- Multi-query planning
- Hybrid search (semantic + lexical + symbolic)
- Reflection-based iterative refinement

Refactored: Removed parallel processing for simplicity and stability.
"""

from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from ..auth.models import MemoryEntry
from ..database.vector_store import MultiTenantVectorStore

# Type alias for LLM client (supports both OpenRouter and Ollama)
LLMClient = object  # Duck-typed: can be OpenRouterClient or OllamaClient


@dataclass
class RetrievalPlan:
    """Query analysis and retrieval plan"""
    question_type: str
    key_entities: List[str]
    required_info: List[Dict[str, Any]]
    relationships: List[str]
    minimal_queries_needed: int
    complexity_score: float  # 0-1


class Retriever:
    """
    Adaptive retriever with intelligent query planning.
    Sequential processing for stability.
    """

    def __init__(
        self,
        llm_client: LLMClient,
        vector_store: MultiTenantVectorStore,
        table_name: str,
        semantic_top_k: int = 25,
        keyword_top_k: int = 5,
        enable_planning: bool = True,
        enable_reflection: bool = True,
        max_reflection_rounds: int = 2,
        temperature: float = 0.1,
    ):
        self.client = llm_client
        self.vector_store = vector_store
        self.table_name = table_name
        self.semantic_top_k = semantic_top_k
        self.keyword_top_k = keyword_top_k
        self.enable_planning = enable_planning
        self.enable_reflection = enable_reflection
        self.max_reflection_rounds = max_reflection_rounds
        self.temperature = temperature

    async def retrieve(
        self,
        query: str,
        enable_reflection: Optional[bool] = None,
    ) -> List[MemoryEntry]:
        """
        Retrieve relevant memory entries for a query

        Args:
            query: User's question
            enable_reflection: Override reflection setting

        Returns:
            List of relevant MemoryEntry objects
        """
        use_reflection = (
            enable_reflection
            if enable_reflection is not None
            else self.enable_reflection
        )

        if self.enable_planning:
            return await self._retrieve_with_planning(query, use_reflection)
        else:
            return await self._simple_retrieve(query)

    async def _simple_retrieve(self, query: str) -> List[MemoryEntry]:
        """Simple semantic search without planning"""
        query_embedding = await self.client.create_single_embedding(query)
        return await self.vector_store.semantic_search(
            self.table_name,
            query_embedding,
            top_k=self.semantic_top_k,
        )

    async def _retrieve_with_planning(
        self,
        query: str,
        enable_reflection: bool,
    ) -> List[MemoryEntry]:
        """Retrieve with intelligent planning and optional reflection"""

        # Step 1: Analyze information requirements
        plan = await self._analyze_information_requirements(query)

        # Step 2: Generate targeted queries
        search_queries = await self._generate_targeted_queries(query, plan)

        # Step 3: Execute searches sequentially
        all_results = await self._execute_searches(search_queries)

        # Step 4: Merge and deduplicate
        merged_results = self._merge_and_deduplicate(all_results)

        # Step 5: Optional reflection
        if enable_reflection and plan.complexity_score > 0.5:
            merged_results = await self._retrieve_with_reflection(
                query,
                merged_results,
                plan,
            )

        return merged_results

    async def _analyze_information_requirements(
        self,
        query: str,
    ) -> RetrievalPlan:
        """Analyze query to determine information requirements"""

        prompt = f"""Analyze the following question and determine retrieval requirements.

Question: {query}

Analyze:
1. What type of question is this? (factual, temporal, relational, comparative, etc.)
2. What key entities/events need to be identified?
3. What information types are required? (with priority: high/medium/low)
4. What relationships need to be established?
5. How many minimal search queries are needed? (1-4)
6. Complexity score (0.0-1.0): simple facts=0.2, multi-hop=0.6, complex reasoning=0.8+

Return JSON:
{{
  "question_type": "type",
  "key_entities": ["entity1", "entity2"],
  "required_info": [
    {{"type": "info_type", "priority": "high/medium/low"}}
  ],
  "relationships": ["relationship1"],
  "minimal_queries_needed": 1-4,
  "complexity_score": 0.0-1.0
}}

Return ONLY valid JSON."""

        messages = [
            {"role": "system", "content": "You are a query analysis expert."},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await self.client.chat_completion(
                messages=messages,
                temperature=self.temperature,
            )

            data = self.client.extract_json(response)
            if data:
                return RetrievalPlan(
                    question_type=data.get("question_type", "factual"),
                    key_entities=data.get("key_entities", []),
                    required_info=data.get("required_info", []),
                    relationships=data.get("relationships", []),
                    minimal_queries_needed=min(data.get("minimal_queries_needed", 1), 4),
                    complexity_score=min(max(data.get("complexity_score", 0.5), 0.0), 1.0),
                )
        except Exception as e:
            print(f"Query analysis error: {e}")

        # Default plan
        return RetrievalPlan(
            question_type="factual",
            key_entities=[],
            required_info=[],
            relationships=[],
            minimal_queries_needed=1,
            complexity_score=0.5,
        )

    async def _generate_targeted_queries(
        self,
        original_query: str,
        plan: RetrievalPlan,
    ) -> List[str]:
        """Generate targeted search queries based on analysis"""

        if plan.minimal_queries_needed <= 1:
            return [original_query]

        prompt = f"""Based on the analysis, generate {plan.minimal_queries_needed} targeted search queries.

Original Question: {original_query}

Analysis:
- Question Type: {plan.question_type}
- Key Entities: {plan.key_entities}
- Required Information: {plan.required_info}
- Relationships: {plan.relationships}

Requirements:
1. Generate {plan.minimal_queries_needed} distinct queries
2. Each query should target specific information
3. Together they should cover all required information
4. Keep queries concise and focused

Return JSON:
{{
  "queries": ["query1", "query2", ...]
}}

Return ONLY valid JSON."""

        messages = [
            {"role": "system", "content": "You are a search query generator."},
            {"role": "user", "content": prompt},
        ]

        try:
            response = await self.client.chat_completion(
                messages=messages,
                temperature=self.temperature,
            )

            data = self.client.extract_json(response)
            if data and "queries" in data:
                queries = data["queries"][:4]  # Max 4 queries
                if queries:
                    return queries
        except Exception as e:
            print(f"Query generation error: {e}")

        return [original_query]

    async def _execute_searches(
        self,
        queries: List[str],
    ) -> List[List[MemoryEntry]]:
        """Execute searches sequentially"""
        all_results = []

        for query in queries:
            # Semantic search
            query_embedding = await self.client.create_single_embedding(query)
            semantic_results = await self.vector_store.semantic_search(
                self.table_name,
                query_embedding,
                top_k=self.semantic_top_k,
            )
            all_results.append(semantic_results)

            # Keyword search
            keywords = self._extract_keywords(query)
            if keywords:
                keyword_results = await self.vector_store.keyword_search(
                    self.table_name,
                    keywords,
                    top_k=self.keyword_top_k,
                )
                all_results.append(keyword_results)

        return all_results

    def _extract_keywords(self, query: str) -> List[str]:
        """Extract keywords from query for lexical search"""
        # Simple keyword extraction
        stop_words = {
            "a", "an", "the", "is", "are", "was", "were", "be", "been",
            "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "may", "might", "must", "shall",
            "can", "need", "dare", "ought", "used", "to", "of", "in",
            "for", "on", "with", "at", "by", "from", "as", "into",
            "through", "during", "before", "after", "above", "below",
            "between", "under", "again", "further", "then", "once",
            "here", "there", "when", "where", "why", "how", "all",
            "each", "few", "more", "most", "other", "some", "such",
            "no", "nor", "not", "only", "own", "same", "so", "than",
            "too", "very", "just", "and", "but", "if", "or", "because",
            "until", "while", "what", "which", "who", "whom", "this",
            "that", "these", "those", "am", "i", "me", "my", "myself",
            "we", "our", "ours", "ourselves", "you", "your", "yours",
            "yourself", "yourselves", "he", "him", "his", "himself",
            "she", "her", "hers", "herself", "it", "its", "itself",
            "they", "them", "their", "theirs", "themselves",
        }

        words = query.lower().split()
        k
```

### Core Architecture Module: `OmniSimpleMem/omni_memory/core/__init__.py`
```
"""
Core data structures for Omni-Memory system.
"""

from omni_memory.core.mau import MultimodalAtomicUnit, ModalityType
from omni_memory.core.event import EventNode, EventLevel
from omni_memory.core.config import OmniMemoryConfig

__all__ = [
    "MultimodalAtomicUnit",
    "ModalityType",
    "EventNode",
    "EventLevel",
    "OmniMemoryConfig",
]

```

### Core Architecture Module: `OmniSimpleMem/omni_memory/core/config.py`
```
"""
Configuration management for Omni-Memory system.
"""

import os
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from pathlib import Path
import json


@dataclass
class EntropyTriggerConfig:
    """Configuration for modal entropy triggers."""

    # Visual trigger settings
    visual_similarity_threshold_high: float = 0.9  # Above this = static, discard
    visual_similarity_threshold_low: float = 0.7   # Below this = significant change, trigger
    visual_encoder: str = "clip"  # Options: clip, siglip, dinov2
    visual_model_name: str = "UCSC-VLAA/openvision-vit-large-patch14-224"

    # Audio trigger settings
    audio_energy_threshold: float = 0.01  # Minimum energy to consider
    audio_vad_threshold: float = 0.5      # Voice activity detection threshold
    audio_min_speech_duration_ms: int = 500  # Minimum speech duration to trigger

    # General settings
    enable_visual_trigger: bool = True
    enable_audio_trigger: bool = True


@dataclass
class StorageConfig:
    """Configuration for storage management."""

    # Base directories
    base_dir: str = "./omni_memory_data"
    cold_storage_dir: str = "./omni_memory_data/cold_storage"
    index_dir: str = "./omni_memory_data/index"

    # Storage backends
    use_s3: bool = False
    s3_bucket: Optional[str] = None
    s3_prefix: str = "omni_memory/"

    # File organization
    organize_by_date: bool = True
    organize_by_modality: bool = True

    # Cleanup settings
    max_storage_gb: float = 100.0
    auto_cleanup_enabled: bool = False


@dataclass
class RetrievalConfig:
    """Configuration for pyramid retrieval system."""

    # Coarse retrieval (Step 1)
    default_top_k: int = 10
    max_summaries_in_context: int = 20

    # Fine retrieval (Step 2)
    max_expanded_items: int = 5
    max_raw_content_tokens: int = 2000

    # Token budgets
    summary_token_budget: int = 500
    details_token_budget: int = 1500
    evidence_token_budget: int = 3000

    # Retrieval modes
    enable_hybrid_search: bool = True
    enable_graph_traversal: bool = True

    # Expansion settings
    auto_expand_threshold: float = 0.85  # Auto-expand if relevance > threshold


@dataclass
class EmbeddingConfig:
    """Configuration for embedding models."""

    model_name: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    batch_size: int = 32

    # For visual embeddings
    visual_embedding_model: str = "UCSC-VLAA/openvision-vit-large-patch14-224"
    visual_embedding_dim: int = 768

    def apply_backend_preset(self, preset: str) -> None:
        """Apply a named visual embedding preset."""
        presets = {
            "openvision": ("UCSC-VLAA/openvision-vit-base-patch16-224", 768),
            "openvision-large": ("UCSC-VLAA/openvision-vit-large-patch14-224", 768),
            "openvision-large-336": ("UCSC-VLAA/openvision-vit-large-patch14-336", 768),
            "openvision-huge": ("UCSC-VLAA/openvision-vit-huge-patch14-224", 1024),
        }
        if preset in presets:
            self.visual_embedding_model, self.visual_embedding_dim = presets[preset]


@dataclass
class LLMConfig:
    """Configuration for LLM interactions."""

    # API settings
    api_base_url: Optional[str] = None
    api_key: Optional[str] = None

    # Model selection
    summary_model: str = "gpt-4o-mini"
    query_model: str = "gpt-4o-mini"
    caption_model: str = "gpt-4o"

    # Generation settings
    temperature: float = 0.0
    max_tokens: int = 1000

    # Whisper settings
    whisper_model: str = "whisper-1"


@dataclass
class EventConfig:
    """Configuration for event management."""

    # Event creation
    auto_create_events: bool = True
    event_time_window_seconds: float = 300.0  # 5 minutes default
    min_maus_per_event: int = 1

    # Event summarization
    summarize_on_close: bool = True
    max_maus_for_summary: int = 20


@dataclass
class OmniMemoryConfig:
    """
    Main configuration class for Omni-Memory system.

    Combines all sub-configurations into a unified config object.
    """

    # Sub-configurations
    entropy_trigger: EntropyTriggerConfig = field(default_factory=EntropyTriggerConfig)
    storage: StorageConfig = field(default_factory=StorageConfig)
    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig)
    llm: LLMConfig = field(default_factory=LLMConfig)
    event: EventConfig = field(default_factory=EventConfig)

    # Self-evolution configuration (lazy import to avoid circular deps)
    evolution: Optional[Any] = None  # EvolutionConfig, set via enable_evolution()

    # Global settings
    enable_self_evolution: bool = False
    debug_mode: bool = False
    log_level: str = "INFO"

    def __post_init__(self):
        """Initialize from environment variables if not set."""
        if self.llm.api_base_url is None:
            self.llm.api_base_url = os.getenv("OPENAI_API_BASE")
        if self.llm.api_key is None:
            self.llm.api_key = os.getenv("OPENAI_API_KEY")

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary."""
        from dataclasses import asdict
        return asdict(self)

    def to_json(self) -> str:
        """Serialize config to JSON."""
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OmniMemoryConfig":
        """Create config from dictionary."""
        return cls(
            entropy_trigger=EntropyTriggerConfig(**data.get("entropy_trigger", {})),
            storage=StorageConfig(**data.get("storage", {})),
            retrieval=RetrievalConfig(**data.get("retrieval", {})),
            embedding=EmbeddingConfig(**data.get("embedding", {})),
            llm=LLMConfig(**data.get("llm", {})),
            event=EventConfig(**data.get("event", {})),
            debug_mode=data.get("debug_mode", False),
            log_level=data.get("log_level", "INFO"),
        )

    @classmethod
    def from_json(cls, json_str: str) -> "OmniMemoryConfig":
        """Create config from JSON string."""
        return cls.from_dict(json.loads(json_str))

    @classmethod
    def from_file(cls, file_path: str) -> "OmniMemoryConfig":
        """Load config from JSON file."""
        with open(file_path, "r", encoding="utf-8") as f:
            return cls.from_json(f.read())

    def save_to_file(self, file_path: str) -> None:
        """Save config to JSON file."""
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(self.to_json())

    def ensure_directories(self) -> None:
        """Create necessary directories."""
        Path(self.storage.base_dir).mkdir(parents=True, exist_ok=True)
        Path(self.storage.cold_storage_dir).mkdir(parents=True, exist_ok=True)
        Path(self.storage.index_dir).mkdir(parents=True, exist_ok=True)

    def enable_evolution(self, evolution_config=None) -> "OmniMemoryConfig":
        """Enable self-evolution with optional custom config."""
        if evolution_config is None:
            from omni_memory.evolution.evolution_config import EvolutionConfig
            evolution_config = EvolutionConfig()
        self.evolution = evolution_config
        self.enable_self_evolution = True
        return self

    def set_unified_model(self, model_name: str) -> None:
        """Set all LLM models to the same model name."""
        self.llm.query_model = model_name
        self.llm.summary_model = model_name
        self.llm.caption_model = model_name

    @classmethod
    def create_default(cls) -> "OmniMemoryConfig":
        """Create default configuration."""
        config = cls()
        config.ensure_directories()
        return config

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #76** (2026-07-24): **refactor: extract vector store backend interface**
  *Symptoms*: ## Summary  - introduce a provider-neutral `VectorStoreBackend` contract covering insertion, semantic search, full-text search, structured filtering, counting, enumeration, optimization, and clearing - move the existing LanceDB dense search, Tantivy/native FTS, and structured SQL filtering behavior into the default `LanceDBVectorStoreBackend` - keep embedding generation in the `VectorStore` facade and let a backend factory receive the resolved vector dimension - add focused contract tests with both the real LanceDB backend and a custom in-memory backend that owns all three retrieval paths  ## Rationale  The earlier dense-only boundary still left keyword search, structured retrieval, and empty-store checks tied directly to LanceDB. A second provider would therefore have needed to dual-write every record into LanceDB, creating hidden coupling and synchronization risk. This broader boundary makes one backend responsible for the complete multi-view index while keeping SimpleMem's existing hybrid retrieval orchestration unchanged.  ## Scope  This remains the abstraction-only first step discussed in #72. It adds no new storage provider, dependency, configuration key, or default behavior change. LanceDB and Tantivy remain the default implementation.  ## Validation  - `python -m pytest tests/test_vector_store_backend.py -q` — 8 passed - `ruff check` and `ruff format --check` on all changed Python files - `python -m compileall -q simplemem/core/database tests/test_vector_store_backend
  **Post-Mortem & Fix Analysis**:
  > Hi @Jiaaqiliu, I updated this PR after tracing the follow-up provider path more deeply. A dense-only boundary would still leave FTS, structured retrieval, empty-store checks, and lifecycle operations tied directly to LanceDB, so an external provider would need hidden dual writes and synchronization.  The PR now extracts a complete `VectorStoreBackend` covering semantic, keyword/FTS, structured retrieval, and lifecycle operations. `LanceDBVectorStoreBackend` preserves the current LanceDB/Tantivy behavior as the default, and SimpleMem's existing hybrid retrieval orchestration is unchanged.  Validation now includes 8 focused tests, a custom backend test proving all three retrieval paths work without creating a LanceDB store, and a real hosted embedding/completion end-to-end run. A review when you have a chance would be appreciated.
  > Merged — thanks, this is exactly the scoped first step we discussed in #72, and the execution is clean.  I verified it rather than taking the "no behavior change" claim on faith. What I checked:  **Behavior parity.** I built a differential harness that drives the public `VectorStore` API with a deterministic 3-dim embedder and ran it on `main` and on this branch: `semantic_search`, `keyword_search`, `structured_search` (persons / location / entities / timestamp range / no-filter), and `get_all_entries`. Results are byte-identical across both branches. The only diff in the whole output was the ordering of two informational log lines, because the FTS index is now created at a slightly different point.  **Security posture.** `simplemem/core/database/vector_store.py` had a filter-injection fix landed recently (#53), and a 194-line rewrite of that file was the thing I most wanted to confirm didn't regress. It doesn't — and it's actually tightened. `persons`, `entities` and the timestamp bou

- **Issue #74** (2026-07-22): **基于qwen2.5-3B的SimpleMem复现效果疑问**
  *Symptoms*: 作者您好， 最近在复现SimpleMem，LLM采用的qwen2.5-3B，滑动窗口按照论文中实现细节设置的W=20，k=20。 但是，实际复现出的效果和论文中的差距较大。请问是复现的过程中，哪个超参数设置或者步骤有问题吗？ 最后，十分感谢您的开源，静候您的回复。 <img width="307" height="112" alt="Image" src="https://github.com/user-attachments/assets/1806e153-ef0f-4915-b281-1e24a23f24f5" /> 

- **Issue #73** (2026-07-18): **docs: fix PACKAGE_USAGE.md to match current public API**
  *Symptoms*: ### What  `docs/PACKAGE_USAGE.md` documented a public API that no longer exists. Every code sample imported `SimpleMemSystem`, `SimpleMemConfig`, `set_config`, `create_system`, `Dialogue` and `MemoryEntry` straight from the top-level `simplemem` package, but the package now exports only:  ```python __all__ = ["SimpleMem", "create", "list_modes", "optimize", "Config", "load_config"] ```  So the guide first example (`from simplemem import SimpleMemSystem`) raises `ImportError`, and the `SimpleMemConfig` / `set_config` configuration pattern is gone entirely.  The Environment Variables section also listed variables the package never reads (`SIMPLEMEM_MODEL`, `SIMPLEMEM_EMBEDDING_MODEL`, `SIMPLEMEM_DB_PATH`). The settings loader (`simplemem/core/settings.py`) actually resolves `LLM_MODEL`, `EMBEDDING_MODEL` and `LANCEDB_PATH`.  ### Changes  - Rewrite all snippets to the current API: `SimpleMem()` (auto mode) and `create(mode="text"|"omni", ...)`. - Replace the removed `SimpleMemConfig` / `set_config` section with the real configuration model (constructor kwargs, `config.py`, env vars) and document the resolution order. - Fix the environment-variable table to the names actually honored by `settings.py`. - Point `Dialogue` / `MemoryEntry` imports at `simplemem.core.models.memory_entry`. - Keep the optimized-retrieval flow (`optimize` -> `Config` -> `load_config`) consistent with the README.  Docs-only; no code changes.

- **Issue #72** (2026-07-18): **Proposal: pluggable dense vector backend and optional Milvus support**
  *Symptoms*: Hi maintainers,  I was looking at SimpleMem's database layer and noticed that the current `VectorStore` path appears to combine dense vector search, full-text search, and structured metadata handling around LanceDB / Tantivy / SQL metadata.  Would you be open to a pluggable vector-storage boundary so users can keep the SimpleMem APIs while choosing a different dense vector backend, such as Milvus?  A possible scoped shape:  1. Keep the current LanceDB/Tantivy path as the default implementation. 2. Split a narrow dense-vector backend contract from the higher-level memory/search logic. 3. Add an optional Milvus backend for dense vector storage and retrieval. 4. Keep structured metadata and FTS behavior aligned with the current product semantics. 5. Support Milvus Lite for local development and Milvus server / Zilliz Cloud for larger deployments. 6. Add focused tests for insert/search/filter behavior and score ordering.  Would this kind of backend abstraction be a good fit for SimpleMem, or is the current storage design intended to stay tightly coupled to LanceDB/Tantivy?
  **Post-Mortem & Fix Analysis**:
  > Thanks for the thoughtful proposal — this is a reasonable direction.  You're reading the current design correctly: the storage layer is presently coupled to LanceDB (dense vectors + FTS) with structured metadata handled around it, rather than sitting behind a narrow, swappable dense-vector contract. There's nothing philosophically opposed to a pluggable backend; the current coupling is just how it grew, not a deliberate lock-in.  The scoped shape you outlined is sensible — in particular:  1. Keep the LanceDB/Tantivy path as the default. 2. Extract a small dense-vector backend interface (insert / search / filter / score-ordering) from the higher-level memory + hybrid-retrieval logic. 3. Add an optional Milvus backend (Milvus Lite for local, server/Zilliz for scale) behind that interface. 4. Keep structured metadata + FTS semantics aligned with today's behavior.  The main things I'd want to preserve are (a) the hybrid retrieval semantics (vector + keyword + structured filters must stay c

- **Issue #71** (2026-07-18): **Add Requesty as an LLM provider**
  *Symptoms*: Adds Requesty as an LLM/embedding provider alongside the existing OpenRouter and Ollama integrations.  Requesty (https://router.requesty.ai/v1) is an OpenAI-compatible router, so the integration mirrors the existing OpenRouter provider: - New `RequestyClient` / `RequestyClientManager` in `server/integrations/requesty.py` (async httpx client, `Bearer REQUESTY_API_KEY` auth, same `provider/model` naming e.g. `openai/gpt-4.1-mini`, same JSON-extraction helpers). `verify_api_key` uses the OpenAI-compatible `/models` endpoint. - Registered in `integrations/__init__.py` exports, `config/settings.py` (`LLM_PROVIDER=requesty`, `REQUESTY_BASE_URL`, default https://router.requesty.ai/v1), and the `http_server` client-manager factory + `/api/auth/register` validation branch. - Added a synchronous skill util (`SKILL/simplemem-skill/src/utils/requesty.py`) and `references/requesty-guide.md` mirroring the OpenRouter skill files. - Documented in `.env.example`, README, and the skill READMEs. - Changes are applied to both the top-level `MCP/` + `SKILL/` trees and their `simplemem/integrations/` mirrors to keep them in sync.  Set `LLM_PROVIDER=requesty` and register with a Requesty API key (https://app.requesty.ai/api-keys) to use it. Docs: https://docs.requesty.ai  Verification: - `py_compile` passes on all new/edited Python files. - Live test against https://router.requesty.ai/v1 through the new `RequestyClient`: `verify_api_key()` returned True, and `chat_completion(openai/gpt-4o-mini)` re

- **Issue #70** (2026-07-24): **Mcp for omnisimplemem**
  *Symptoms*: Any update on omnisimplemem for all mcp tool update? 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for the interest.  Could you say a bit more about what you're after? To clarify the current state:  - The MCP server (multi-tenant memory over Streamable HTTP + a legacy SSE transport) lives under `MCP/` and its mirror `simplemem/integrations/`, and exposes the memory tools (`memory_add`, `memory_query`, etc.). - `OmniSimpleMem/` is the multimodal (text/image) memory package.  If you're asking for the full Omni/multimodal memory pipeline to be exposed through the MCP tool interface (i.e. multimodal `memory_add`/`memory_query` over MCP), that isn't wired up yet. If that's the ask, let me know your concrete use case and I'll track it as a feature request — otherwise, please share which specific tools you need and I'm happy to point you to the right entry points. 
  > Thanks for your reponse. I have been waiting for the full mcp version of omnisimplemem as currently multi modal are python only. I have been waiting for full mcp support for it with url support for minio and s3 and Google drive direct link sipport and file upload as input for image, audio, video and doc for memory and seperate isolated memory cluster for agents. And advance mem search to segmenting object, characters etc in multiframe image like segment anything meta to map graph search for similar objects, person etc from image search. Along with art style search to know like retro, anime etc. Similarly advance audio search and video search.   In previous version I had worked on sampling In my custom simplemem but have been eagerly waiting for full mcp support with these features. 
  > Any update? 

- **Issue #69** (2026-07-18): **Question about the "Omni" claim: how were audio/video modules actually discovered and evaluated without corresponding benchmarks?**
  *Symptoms*: Hi, Omini-SimpleMem Team:   The paper claims support for text, image, audio and video memory. However, the reported benchmarks (LoCoMo and Mem-Gallery) appear to evaluate only text and image modalities. How were the audio and video components optimized and validated during the autoresearch process?  Thanks!
  **Post-Mortem & Fix Analysis**:
  > Good question, and a fair one to ask.  To be precise about what is and isn't benchmarked:  - **Architecturally**, the system defines all four modalities (`ModalityType.TEXT/IMAGE/AUDIO/VIDEO`) and has the corresponding ingestion machinery — e.g. entropy-based triggers for audio and visual streams (`triggers/audio_trigger.py`, `triggers/visual_trigger.py`) and a Whisper-based transcription path in the config. So the pipeline can ingest and store audio/video-derived memory units. - **Quantitatively**, the reported benchmarks (LoCoMo and Mem-Gallery) exercise the **text and image** modalities. There isn't a corresponding audio/video benchmark in the repo, and I don't want to claim quantitative validation we didn't run — the audio/video support is architectural/qualitative at this point, not something with head-to-head benchmark numbers behind it.  I think the honest fix here is documentation: I'll make the README clear about which modalities have quantitative benchmark results versus whic
  > Thanks for your clarification! 

- **Issue #68** (2026-07-18): **Doubt about Omini-SimpleMem SOTA adapters cheating Mem-Gallery with category-conditioned retrieval routing**
  *Symptoms*: Thanks for your impressive work!    Several high-scoring Mem-Gallery reproductions (e.g., Omni-SimpleMem) route retrieval differently per task category. Questions carry oracle labels such as `[FR]`, `[TR]`, `[KR]` (or equivalent category metadata). Adapters parse these labels and apply **hard-coded, category-specific retrieval rules** on top of the memory backend.  This is not general-purpose memory retrieval — it is **benchmark-tuned routing that requires knowing the task type at test time**. Reported F1 numbers may therefore overstate deployable memory capability.  The adapter applies the following rules (example: Omni-SimpleMem `benchmarks/memgallery/adapter.py`): | Category | Heuristic behavior | |----------|-------------------| | **FR** | Larger `top_k` (30; up to 40 for “list all / how many” questions) | | **KR** |  extra BM25 merge to surface both old and updated facts | | **TR / CD** | Post-retrieval **chronological reordering** by `session_id` + `dialogue_id` | | **VS / VR** | Separate visual path using an **image catalog BM25** over caption text | | **TTL** | Additional image-catalog lookup when `image_caption:` appears in the query |  Please clarify whether category-conditioned retrieval is part of the intended Omini-SimpleMem design. If not, please: 1. Document this behavior explicitly in the benchmark README 2. Report scores without category-aware retrieval routing  Looking forward to your reply! @Jiaaqiliu 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed and fair critique — I want to answer it straight rather than defensively.  You've described the current `benchmarks/memgallery/adapter.py` accurately. It does parse the category markers from the questions (`[FR]`, `[TR]`, `[KR]`, `[VS]`, `[VR]`, `[CD]`, `[TTL]`, etc.) and apply category-conditioned retrieval on top of the memory backend, specifically:  - category-dependent `top_k` (`_get_dynamic_top_k`, with a larger budget for `FR`, and up to 40 for "list all / how many" questions), - an extra BM25 merge for `KR` (and for `FR` list questions), - a separate image-catalog BM25 path for `VS`/`VR`, - and category-influenced handling for the time/detail categories.  So your core observation is correct: as written, that adapter uses the task-category label at retrieval time, which means those specific numbers reflect category-aware routing rather than a single category-agnostic retrieval policy. That's an important distinction for anyone interpreting the scores, and 

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

### Incident Patch 1: `836ce971` (2026-07-24)
**Commit Message**: feat(omni): add MCP server for Omni-SimpleMem multimodal memory (#70)

Exposes the Omni-Memory pipeline to any MCP client over the stdio transport,
so the multimodal memory is no longer reachable only from Python.

Tools (12): omni_add_text / omni_add_image / omni_add_audio / omni_add_video /
omni_add_document, omni_query / omni_answer, plus omni_stats, omni_list_events,
omni_consolidate, omni_list_namespaces and omni_delete_namespace.

Highlights:
- Isolated per-agent memory clusters. Every tool takes an optional 'namespace';
  each one gets its own storage, MAU store, vector index and event store.
  Namespace names are validated so they cannot traverse the filesystem.
  Orchestrators load lazily behind an LRU cache and reload transparently.
- Media references resolve from local paths, file://, http(s)://, Google Drive
  share links, s3:// (S3 or MinIO via S3_ENDPOINT_URL) and gs://, with a
  download size cap and an option to disable remote fetching entirely.
- Documents (.txt/.md/.json/.csv/.yaml/.pdf/.docx) are text-extracted and stored.
- Media type is validated before ingestion, so passing a .txt to the video tool
  errors instead of storing a meaningless memory unit.
- The s

**File**: `OmniSimpleMem/README.md` (modified, +21/-0)
```diff
@@ -91,12 +91,33 @@ python examples/api_server.py
 
 </details>
 
+<details>
+<summary>🔌 MCP Server (use Omni-SimpleMem from any MCP client)</summary>
+
+Expose multimodal memory to Claude Desktop or any MCP client over stdio:
+
+```bash
+python -m omni_mcp --data-dir ~/.omni_simplemem/mcp
+```
+
+Provides 12 tools — `omni_add_text` / `omni_add_image` / `omni_add_audio` /
+`omni_add_video` / `omni_add_document`, `omni_query` / `omni_answer`, plus
+namespace management. Media arguments accept local paths, `http(s)://`, Google
+Drive share links, `s3://` (S3 or MinIO) and `gs://`. Every tool takes an
+optional `namespace` giving each agent a fully isolated memory cluster.
+
+See [`omni_mcp/README.md`](omni_mcp/README.md) for setup, tool reference and
+configuration.
+
+</details>
+
 <details>
 <summary>📝 More examples</summary>
 
 - [`examples/quickstart.py`](examples/quickstart.py) — Basic text memory
 - [`examples/multimodal_memory.py`](examples/multimodal_memory.py) — Multimodal content
 - [`examples/api_server.py`](examples/api_server.py) — FastAPI REST server
+- [`omni_mcp/`](omni_mcp/) — MCP server (multimodal memory over stdio)
 
 </details>
 
```

**File**: `OmniSimpleMem/omni_mcp/README.md` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+# Omni-SimpleMem MCP Server
+
+Exposes the Omni-SimpleMem multimodal memory pipeline (text, image, audio, video,
+documents) to any MCP client over the **stdio transport**, with **isolated
+per-agent memory namespaces**.
+
+This complements the existing text-oriented MCP server under `MCP/`: that one is
+a multi-tenant HTTP service, this one is a local stdio server built directly on
+`OmniMemoryOrchestrator`, so it can reach the multimodal processors and the local
+filesystem (needed for image/audio/video/document ingestion).
+
+## Install
+
+```bash
+cd OmniSimpleMem
+pip install -r requirements.txt          # core Omni-Memory dependencies
+
+# Optional, only if you use the matching feature:
+pip install boto3                        # s3:// (AWS S3 or MinIO)
+pip install google-cloud-storage         # gs:// (Google Cloud Storage)
+pip install pypdf                        # .pdf documents
+pip install python-docx                  # .docx documents
+```
+
+## Run
+
+```bash
+python -m omni_mcp --data-dir ~/.omni_simplemem/mcp
+```
+
+The server speaks newline-delimited JSON-RPC 2.0 on stdin/stdout. It is normally
+launched by an MCP client rather than by hand.
+
+### Claude Desktop
+
+Add to `claude_desktop_config.json`:
+
+```json
+{
+  "mcpServers": {
+    "omni-simplemem": {
+      "command": "python",
+      "args": ["-m", "omni_mcp", "--data-dir", "~/.omni_simplemem/mcp"],
+      "cwd": "/absolute/path/to/SimpleMem/OmniSimpleMem",
+      "env": {
+        "OPENAI_API_KEY": "sk-...",
+        "PYTHONPATH": "/absolute/path/to/SimpleMem/OmniSimpleMem"
+      }
+    }
+  }
+}
+```
+
+## Tools
+
+| Tool | Purpose |
+|------|---------|
+| `omni_add_text` | Store text as an atomic memory unit |
+| `omni_add_image` | Store an image (captioned + embedded, entropy-triggered) |
+| `omni_add_audio` | Store audio (transcribed, VAD-triggered) |
+| `omni_add_video` | Store a video (only visually significant frames) |
+| `omni_add_document` | Extract text from `.txt/.md/.json/.csv/.yaml/.pdf/.docx` and store it |
+| `omni_query` | Retrieve relevant memory summaries |
+| `omni_answer` | Retrieval-augmented answer over memory |
+| `omni_stats` | Memory statistics for a namespace |
+| `omni_list_events` | List event nodes (grouped memories) |
+| `omni_consolidate` | Run importance-based consolidation |
+| `omni_list_namespaces` | List all isolated memory clusters |
+| `omni_delete_namespace` | Permanently delete a namespace (needs `confirm: true`) |
+
+### Isolated memory clusters
+
+Every tool takes an optional `namespace`. Each namespace is a **fully separate
+memory cluster** — its own storage directory, MAU store, vector index and event
+store — so multiple agents can share one server without seeing each other's
+memories.
+
+```jsonc
+{"name": "omni_add_text",
+ "arguments": {"text": "Design review moved to Friday.", "namespace": "agent_planner"}}
+```
+
+Namespace names are restricted to `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`; anything
+that could traverse the filesystem (`../`, `/`, absolute paths) is rejected.
+
+Orchestrators are loaded lazily and kept in an LRU cache
+(`--max-open-namespaces`, default 8); evicted namespaces are saved to disk and
+transparently reloaded on next use.
+
+### Media references
+
+Any media argument accepts:
+
+| Form | Example |
+|------|---------|
+| Local path | `/data/photo.png` |
+| File URI | `file:///data/photo.png` |
+| HTTP(S) | `https://example.com/clip.mp4` |
+| Google Drive share link | `https://drive.google.com/file/d/<id>/view` |
+| S3 / MinIO | `s3://bucket/key` |
+| Google Cloud Storage | `gs://bucket/object` |
+
+For **MinIO** (or any S3-compatible store) set the endpoint and credentials in
+the server's environment:
+
+```bash
+export S3_ENDPOINT_URL=https://minio.internal:9000
+export AWS_ACCESS_KEY_ID=...
+export AWS_SECRET_ACCESS_KEY=...
+```
+
+Remote objects are downloaded to a temp file, ingested, then deleted. Local
+files are never modified or removed.
+
+## Configuration
+
+| Variable | Default | Meaning |
+|----------|---------|---------|
+| `OMNI_MCP_DATA_DIR` | `~/.omni_simplemem/mcp` | Base dir holding namespaces |
+| `OMNI_MCP_MAX_OPEN_NAMESPACES` | `8` | Orchestrators kept loaded |
+| `OMNI_MCP_MAX_DOWNLOAD_BYTES` | `536870912` (512 MB) | Remote download cap |
+| `OMNI_MCP_DISABLE_REMOTE` | unset | Set to `1` to forbid all remote fetching |
+| `OMNI_MCP_LOG_LEVEL` | `INFO` | Log level (logs go to stderr) |
+| `OPENAI_API_KEY` | — | Required for captioning, transcription, query/answer |
+| `OPENAI_API_BASE` | — | Optional OpenAI-compatible gateway |
+
+### What works without an API key
+
+`omni_add_text`, `omni_add_document`, `omni_stats`, `omni_list_events`,
+`omni_list_namespaces`, `omni_consolidate` and `omni_delete_namespace` run fully
+offline. Image/audio/video captioning and `omni_query`/`omni_answer` call an LLM
+and require a key; without one they return a clear, actionable error rather than
+failing silently.
+
+## Tests
+
+```ba
```

**File**: `OmniSimpleMem/omni_mcp/__init__.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+"""
+Omni-SimpleMem MCP server.
+
+Exposes the Omni-Memory multimodal memory pipeline (text, image, audio, video,
+documents) to any MCP client over the stdio transport, with isolated per-agent
+memory namespaces.
+
+Run it with::
+
+    python -m omni_mcp --data-dir ~/.omni_simplemem/mcp
+"""
+
+from .media import MediaError, resolve_media
+from .namespaces import DEFAULT_NAMESPACE, NamespaceError, NamespaceManager
+from .server import OmniMCPServer, main
+from .tools import ToolExecutor, tool_definitions
+
+__version__ = "1.0.0"
+
+__all__ = [
+    "OmniMCPServer",
+    "NamespaceManager",
+    "NamespaceError",
+    "DEFAULT_NAMESPACE",
+    "ToolExecutor",
+    "tool_definitions",
+    "resolve_media",
+    "MediaError",
+    "main",
+]
```

**File**: `OmniSimpleMem/omni_mcp/__main__.py` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+"""Entry point so the server can be started with ``python -m omni_mcp``."""
+
+from .server import main
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `OmniSimpleMem/omni_mcp/media.py` (added, +362/-0)
```diff
@@ -0,0 +1,362 @@
+"""
+Media resolution for the Omni-SimpleMem MCP server.
+
+Turns a user-supplied media reference into a local file path that the
+Omni-Memory processors can consume. Supported reference forms:
+
+    /abs/path/img.png            local file
+    file:///abs/path/img.png     local file (URI form)
+    https://host/img.png         HTTP(S) download
+    https://drive.google.com/... Google Drive share link (converted to direct download)
+    s3://bucket/key              S3 / MinIO / any S3-compatible endpoint (boto3)
+    gs://bucket/key              Google Cloud Storage
+
+Remote backends are imported lazily so the server runs without boto3 or
+google-cloud-storage installed; a missing backend produces a clear,
+actionable error instead of an import crash at startup.
+"""
+
+from __future__ import annotations
+
+import os
+import re
+import shutil
+import tempfile
+from dataclasses import dataclass
+from pathlib import Path
+from typing import Optional
+from urllib.parse import urlparse, parse_qs
+
+# Maximum number of bytes we will pull from a remote source. Guards against a
+# mistyped URL streaming a multi-GB object into the agent's temp dir.
+DEFAULT_MAX_BYTES = 512 * 1024 * 1024  # 512 MB
+DEFAULT_TIMEOUT = 60  # seconds
+
+
+class MediaError(Exception):
+    """Raised when a media reference cannot be resolved."""
+
+
+@dataclass
+class ResolvedMedia:
+    """A media reference resolved to a local file."""
+
+    path: str
+    source: str
+    is_temporary: bool
+
+    def cleanup(self) -> None:
+        """Delete the file if we created it in a temp dir."""
+        if self.is_temporary:
+            try:
+                os.unlink(self.path)
+            except OSError:
+                pass
+
+
+def _max_bytes() -> int:
+    raw = os.getenv("OMNI_MCP_MAX_DOWNLOAD_BYTES")
+    if raw:
+        try:
+            return int(raw)
+        except ValueError:
+            pass
+    return DEFAULT_MAX_BYTES
+
+
+def _remote_enabled() -> bool:
+    """Remote fetching can be disabled entirely for locked-down deployments."""
+    return os.getenv("OMNI_MCP_DISABLE_REMOTE", "").strip().lower() not in ("1", "true", "yes")
+
+
+def _tempfile_for(suffix: str) -> str:
+    fd, path = tempfile.mkstemp(prefix="omni_mcp_", suffix=suffix)
+    os.close(fd)
+    return path
+
+
+def _suffix_from(name: str, default: str = "") -> str:
+    suffix = Path(urlparse(name).path).suffix
+    return suffix or default
+
+
+# --- Google Drive -----------------------------------------------------------
+
+_GDRIVE_FILE_RE = re.compile(r"/file/d/([A-Za-z0-9_-]+)")
+
+
+def _gdrive_direct_url(url: str) -> Optional[str]:
+    """Convert a Google Drive share link into a direct-download URL."""
+    parsed = urlparse(url)
+    if "drive.google.com" not in parsed.netloc and "docs.google.com" not in parsed.netloc:
+        return None
+
+    match = _GDRIVE_FILE_RE.search(parsed.path)
+    file_id = match.group(1) if match else None
+    if not file_id:
+        file_id = (parse_qs(parsed.query).get("id") or [None])[0]
+    if not file_id:
+        return None
+    return f"https://drive.google.com/uc?export=download&id={file_id}"
+
+
+# --- Backends ---------------------------------------------------------------
+
+def _fetch_http(url: str) -> ResolvedMedia:
+    try:
+        import requests
+    except ImportError as exc:  # pragma: no cover - requests is a base dependency
+        raise MediaError("HTTP downloads require the 'requests' package.") from exc
+
+    direct = _gdrive_direct_url(url)
+    target = direct or url
+
+    limit = _max_bytes()
+    try:
+        response = requests.get(target, stream=True, timeout=DEFAULT_TIMEOUT, allow_redirects=True)
+        response.raise_for_status()
+    except Exception as exc:
+        raise MediaError(f"Failed to download {url}: {exc}") from exc
+
+    suffix = _suffix_from(target)
+    if not suffix:
+        content_type = (response.headers.get("content-type") or "").split(";")[0].strip()
+        suffix = {
+            "image/png": ".png",
+            "image/jpeg": ".jpg",
+            "image/gif": ".gif",
+            "image/webp": ".webp",
+            "audio/mpeg": ".mp3",
+            "audio/wav": ".wav",
+            "audio/x-wav": ".wav",
+            "video/mp4": ".mp4",
+            "application/pdf": ".pdf",
+            "text/plain": ".txt",
+        }.get(content_type, "")
+
+    path = _tempfile_for(suffix)
+    written = 0
+    try:
+        with open(path, "wb") as handle:
+            for chunk in response.iter_content(chunk_size=1024 * 256):
+                if not chunk:
+                    continue
+                written += len(chunk)
+                if written > limit:
+                    raise MediaError(
+                        f"Remote object exceeds the {limit} byte limit "
+                        "(raise OMNI_MCP_MAX_DOWNLOAD_BYTES to allow larger files)."
+                    )
+                handle.write(chunk)
+    except Exception
```

**File**: `OmniSimpleMem/omni_mcp/namespaces.py` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+"""
+Isolated memory namespaces for the Omni-SimpleMem MCP server.
+
+Each namespace is a fully independent memory cluster: its own data directory,
+its own cold storage, MAU store, vector index and event store. Two agents using
+different namespaces cannot see or affect each other's memories.
+
+Orchestrators are created lazily on first use (loading one is expensive) and
+cached, with an LRU bound so a long-running server with many namespaces does
+not grow without limit.
+"""
+
+from __future__ import annotations
+
+import os
+import re
+import threading
+from collections import OrderedDict
+from pathlib import Path
+from typing import Any, Dict, List, Optional
+
+DEFAULT_NAMESPACE = "default"
+
+# A namespace becomes a directory name, so it must not be able to escape the
+# base directory or collide with path syntax.
+_VALID_NAMESPACE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
+
+
+class NamespaceError(Exception):
+    """Raised for invalid namespace names or namespace management failures."""
+
+
+def validate_namespace(name: Optional[str]) -> str:
+    """Validate and normalize a namespace name.
+
+    Rejects anything that could traverse outside the base directory
+    (``..``, ``/``, ``\\``, absolute paths, NUL bytes, etc.).
+    """
+    if name is None or str(name).strip() == "":
+        return DEFAULT_NAMESPACE
+
+    candidate = str(name).strip()
+
+    if not _VALID_NAMESPACE.match(candidate):
+        raise NamespaceError(
+            f"Invalid namespace {candidate!r}. Namespaces must be 1-64 characters, "
+            "start with a letter or digit, and contain only letters, digits, "
+            "'.', '_' or '-'."
+        )
+    # Defense in depth: reject dot-only names that normalize to a parent dir.
+    if candidate in (".", "..") or set(candidate) == {"."}:
+        raise NamespaceError(f"Invalid namespace {candidate!r}.")
+    return candidate
+
+
+class NamespaceManager:
+    """Owns the lifecycle of one Omni-Memory orchestrator per namespace."""
+
+    def __init__(self, base_dir: str, max_open: int = 8):
+        self.base_dir = os.path.abspath(os.path.expanduser(base_dir))
+        self.max_open = max(1, int(max_open))
+        self._open: "OrderedDict[str, Any]" = OrderedDict()
+        self._lock = threading.RLock()
+        os.makedirs(self.base_dir, exist_ok=True)
+
+    # -- paths -------------------------------------------------------------
+
+    def data_dir_for(self, namespace: str) -> str:
+        namespace = validate_namespace(namespace)
+        path = os.path.join(self.base_dir, namespace)
+        # Final guard: the resolved path must stay inside base_dir.
+        resolved = os.path.realpath(path)
+        base = os.path.realpath(self.base_dir)
+        if resolved != base and not resolved.startswith(base + os.sep):
+            raise NamespaceError(f"Namespace path escapes the base directory: {namespace!r}")
+        return path
+
+    # -- orchestrators -----------------------------------------------------
+
+    def get(self, namespace: Optional[str] = None):
+        """Return (creating if needed) the orchestrator for a namespace."""
+        namespace = validate_namespace(namespace)
+
+        with self._lock:
+            if namespace in self._open:
+                self._open.move_to_end(namespace)
+                return self._open[namespace]
+
+            data_dir = self.data_dir_for(namespace)
+            os.makedirs(data_dir, exist_ok=True)
+
+            # Imported lazily: pulls in the heavy Omni-Memory stack, and we only
+            # want that cost when a tool actually touches memory.
+            from omni_memory import OmniMemoryOrchestrator
+
+            orchestrator = OmniMemoryOrchestrator(data_dir=data_dir)
+            self._open[namespace] = orchestrator
+            self._evict_if_needed()
+            return orchestrator
+
+    def _evict_if_needed(self) -> None:
+        while len(self._open) > self.max_open:
+            name, orchestrator = self._open.popitem(last=False)
+            self._safe_close(orchestrator, name)
+
+    @staticmethod
+    def _safe_close(orchestrator: Any, name: str) -> None:
+        for method in ("save", "close"):
+            try:
+                getattr(orchestrator, method)()
+            except Exception:
+                # Never let teardown of one namespace break the server.
+                pass
+
+    # -- introspection -----------------------------------------------------
+
+    def list_namespaces(self) -> List[Dict[str, Any]]:
+        """List namespaces that exist on disk, with basic metadata."""
+        results: List[Dict[str, Any]] = []
+        base = Path(self.base_dir)
+        if not base.is_dir():
+            return results
+
+        for entry in sorted(base.iterdir()):
+            if not entry.is_dir():
+                continue
+            try:
+                validate_namespace(entry.name)
+            except NamespaceError:
+                continue  # 
```

**File**: `OmniSimpleMem/omni_mcp/server.py` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+"""
+Omni-SimpleMem MCP server (JSON-RPC 2.0 over stdio).
+
+Implements the MCP stdio transport: newline-delimited JSON-RPC on stdin/stdout.
+
+A note on stdout discipline: the stdio transport owns stdout exclusively, and
+the Omni-Memory stack prints diagnostics (model fallbacks, progress) with plain
+``print()``. Those writes would corrupt the JSON-RPC stream, so at startup we
+swap ``sys.stdout`` for ``sys.stderr`` and keep a private handle to the real
+stdout that only protocol frames are written to.
+"""
+
+from __future__ import annotations
+
+import json
+import logging
+import os
+import sys
+import traceback
+from typing import Any, Dict, Optional
+
+from .namespaces import NamespaceError, NamespaceManager
+from .tools import ToolExecutor, format_result, humanize_error, tool_definitions
+
+MCP_PROTOCOL_VERSION = "2024-11-05"
+SERVER_NAME = "omni-simplemem"
+SERVER_VERSION = "1.0.0"
+
+# JSON-RPC error codes
+PARSE_ERROR = -32700
+INVALID_REQUEST = -32600
+METHOD_NOT_FOUND = -32601
+INVALID_PARAMS = -32602
+INTERNAL_ERROR = -32603
+
+logger = logging.getLogger("omni_mcp")
+
+INSTRUCTIONS = """Omni-SimpleMem is a multimodal long-term memory for agents.
+
+STORE
+  omni_add_text      remember text
+  omni_add_image     remember an image (local path, http(s), Google Drive, s3://, gs://)
+  omni_add_audio     remember audio (transcribed)
+  omni_add_video     remember a video (significant frames only)
+  omni_add_document  remember a .txt/.md/.json/.csv/.yaml/.pdf/.docx file
+
+RECALL
+  omni_query   retrieve relevant memory summaries
+  omni_answer  synthesized answer over memory (needs an LLM API key)
+
+MANAGE
+  omni_stats, omni_list_events, omni_consolidate
+  omni_list_namespaces, omni_delete_namespace
+
+ISOLATION
+  Every tool takes an optional `namespace`. Each namespace is a separate memory
+  cluster with its own storage, so different agents cannot read each other's
+  memories. Omit it to use the 'default' namespace.
+"""
+
+
+class OmniMCPServer:
+    """MCP protocol server exposing Omni-Memory over stdio."""
+
+    def __init__(self, base_dir: str, max_open_namespaces: int = 8):
+        self.manager = NamespaceManager(base_dir, max_open=max_open_namespaces)
+        self.executor = ToolExecutor(self.manager)
+        self.initialized = False
+        self._stdout = sys.stdout
+
+    # -- protocol plumbing -------------------------------------------------
+
+    def _write(self, payload: Dict[str, Any]) -> None:
+        try:
+            self._stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
+            self._stdout.flush()
+        except (BrokenPipeError, ValueError):
+            raise SystemExit(0)
+
+    @staticmethod
+    def _error(request_id: Any, code: int, message: str) -> Dict[str, Any]:
+        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}
+
+    @staticmethod
+    def _result(request_id: Any, result: Any) -> Dict[str, Any]:
+        return {"jsonrpc": "2.0", "id": request_id, "result": result}
+
+    # -- request handling --------------------------------------------------
+
+    def handle_request(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
+        """Handle one JSON-RPC message. Returns None for notifications."""
+        request_id = message.get("id")
+        method = message.get("method")
+        params = message.get("params") or {}
+        is_notification = "id" not in message
+
+        if not method:
+            return None if is_notification else self._error(
+                request_id, INVALID_REQUEST, "Missing 'method'."
+            )
+
+        try:
+            if method == "initialize":
+                result = self._handle_initialize(params)
+            elif method in ("notifications/initialized", "initialized"):
+                self.initialized = True
+                return None
+            elif method in ("notifications/cancelled", "notifications/progress"):
+                return None
+            elif method == "ping":
+                result = {}
+            elif method == "tools/list":
+                result = {"tools": tool_definitions()}
+            elif method == "tools/call":
+                result = self._handle_tools_call(params)
+            elif method == "resources/list":
+                result = {"resources": self._resources()}
+            elif method == "resources/read":
+                result = self._handle_resources_read(params)
+            elif method == "prompts/list":
+                result = {"prompts": []}
+            elif method == "shutdown":
+                result = {}
+            else:
+                if is_notification:
+                    return None
+                return self._error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")
+        except NamespaceError as exc:
+            if is_notification:
+                return None
+            return self._error(request_id, INVALID_PARAMS, str(exc))
+  
```

**File**: `OmniSimpleMem/omni_mcp/tools.py` (added, +534/-0)
```diff
@@ -0,0 +1,534 @@
+"""
+Tool definitions and dispatch for the Omni-SimpleMem MCP server.
+
+Every tool accepts an optional ``namespace`` argument that selects an isolated
+memory cluster, so multiple agents can share one server without seeing each
+other's memories.
+"""
+
+from __future__ import annotations
+
+import json
+import os
+from typing import Any, Dict, List, Optional
+
+from .media import MediaError, ensure_kind, extract_document_text, resolve_media
+from .namespaces import DEFAULT_NAMESPACE, NamespaceError, NamespaceManager
+
+_NAMESPACE_PROP = {
+    "namespace": {
+        "type": "string",
+        "description": (
+            "Isolated memory cluster to use. Each namespace has its own storage and "
+            f"is invisible to other namespaces. Defaults to '{DEFAULT_NAMESPACE}'."
+        ),
+    }
+}
+
+_TAGS_PROP = {
+    "tags": {
+        "type": "array",
+        "items": {"type": "string"},
+        "description": "Optional tags stored with the memory, usable as retrieval filters.",
+    }
+}
+
+_MEDIA_DESCRIPTION = (
+    "Local file path, or a remote reference: http(s):// URL, a Google Drive share "
+    "link, s3://bucket/key (S3 or MinIO, via S3_ENDPOINT_URL), or gs://bucket/object."
+)
+
+
+def tool_definitions() -> List[Dict[str, Any]]:
+    """MCP tool schemas advertised via tools/list."""
+    return [
+        {
+            "name": "omni_add_text",
+            "description": (
+                "Store text in multimodal memory. The text is compressed into an atomic "
+                "memory unit with entity extraction and temporal anchoring."
+            ),
+            "inputSchema": {
+                "type": "object",
+                "properties": {
+                    "text": {"type": "string", "description": "Text content to remember."},
+                    "session_id": {"type": "string", "description": "Optional session identifier."},
+                    "force": {
+                        "type": "boolean",
+                        "description": "Store even if the content looks redundant.",
+                    },
+                    **_TAGS_PROP,
+                    **_NAMESPACE_PROP,
+                },
+                "required": ["text"],
+            },
+        },
+        {
+            "name": "omni_add_image",
+            "description": (
+                "Store an image in multimodal memory. The image is captioned and embedded; "
+                "entropy triggering skips frames that are near-duplicates of recent ones."
+            ),
+            "inputSchema": {
+                "type": "object",
+                "properties": {
+                    "image": {"type": "string", "description": _MEDIA_DESCRIPTION},
+                    "session_id": {"type": "string", "description": "Optional session identifier."},
+                    "force": {
+                        "type": "boolean",
+                        "description": "Store even if visually similar to the previous image.",
+                    },
+                    **_TAGS_PROP,
+                    **_NAMESPACE_PROP,
+                },
+                "required": ["image"],
+            },
+        },
+        {
+            "name": "omni_add_audio",
+            "description": (
+                "Store audio in multimodal memory. Speech is transcribed and stored as a "
+                "searchable atomic memory unit; silence is skipped by VAD triggering."
+            ),
+            "inputSchema": {
+                "type": "object",
+                "properties": {
+                    "audio": {"type": "string", "description": _MEDIA_DESCRIPTION},
+                    "session_id": {"type": "string", "description": "Optional session identifier."},
+                    "force": {"type": "boolean", "description": "Store even if no speech detected."},
+                    **_TAGS_PROP,
+                    **_NAMESPACE_PROP,
+                },
+                "required": ["audio"],
+            },
+        },
+        {
+            "name": "omni_add_video",
+            "description": (
+                "Store a video in multimodal memory. Frames are sampled with entropy "
+                "triggering so only visually significant frames become memories."
+            ),
+            "inputSchema": {
+                "type": "object",
+                "properties": {
+                    "video": {"type": "string", "description": _MEDIA_DESCRIPTION},
+                    "session_id": {"type": "string", "description": "Optional session identifier."},
+                    "max_frames": {
+                        "type": "integer",
+                        "description": "Maximum frames to sample (default 100).",
+                    },
+                    **_TAGS_PROP,
+                    **_NAMESPACE_PROP,
+                },
+                "required": ["video"],
+            },
+        },
+        {
+            "name": "omni_add_document",
+            "description":
```

---

### Incident Patch 2: `8cd1bcac` (2026-07-18)
**Commit Message**: security: drop unused vulnerable langchain-openai dependency (#57)

langchain-openai==1.1.0 carried a known SSRF/DNS-rebinding advisory but is
not imported anywhere in the codebase and is not a transitive dependency
of any package we use, so it added attack surface for no benefit. Remove
the pin to eliminate the advisory.

**File**: `requirements.txt` (modified, +0/-1)
```diff
@@ -55,7 +55,6 @@ lancedb==0.25.3
 langchain==1.1.0
 langchain-anthropic==1.2.0
 langchain-core==1.1.0
-langchain-openai==1.1.0
 langgraph==1.0.4
 langgraph-checkpoint==3.0.1
 langgraph-prebuilt==1.0.5
```

---

### Incident Patch 3: `3792908b` (2026-07-18)
**Commit Message**: security: never combine wildcard CORS origin with credentials (#51)

allow_origins=['*'] together with allow_credentials=True let any site
make credentialed cross-origin calls (Starlette reflects the Origin).
Make origins configurable via CORS_ALLOWED_ORIGINS: with the default
wildcard, credentials are now disabled; credentials are only enabled when
an explicit origin allow-list is provided.

**File**: `MCP/server/http_server.py` (modified, +19/-2)
```diff
@@ -282,10 +282,27 @@ async def lifespan(app: FastAPI):
     lifespan=lifespan,
 )
 
+# CORS configuration.
+#
+# Combining a wildcard origin ("*") with allow_credentials=True is invalid per
+# the CORS spec (browsers reject it) and, when Starlette reflects the request
+# Origin, it effectively lets any site make credentialed cross-origin calls.
+# To avoid that, credentials are only enabled when an explicit allow-list of
+# origins is configured via CORS_ALLOWED_ORIGINS (comma-separated). With the
+# default wildcard, credentials are disabled so cross-origin credential theft
+# is not possible.
+_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "*").strip()
+if _cors_origins_env == "*":
+    _cors_allow_origins = ["*"]
+    _cors_allow_credentials = False
+else:
+    _cors_allow_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
+    _cors_allow_credentials = True
+
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["*"],
-    allow_credentials=True,
+    allow_origins=_cors_allow_origins,
+    allow_credentials=_cors_allow_credentials,
     allow_methods=["*"],
     allow_headers=["*"],
 )
```

**File**: `simplemem/integrations/server/http_server.py` (modified, +19/-2)
```diff
@@ -282,10 +282,27 @@ async def lifespan(app: FastAPI):
     lifespan=lifespan,
 )
 
+# CORS configuration.
+#
+# Combining a wildcard origin ("*") with allow_credentials=True is invalid per
+# the CORS spec (browsers reject it) and, when Starlette reflects the request
+# Origin, it effectively lets any site make credentialed cross-origin calls.
+# To avoid that, credentials are only enabled when an explicit allow-list of
+# origins is configured via CORS_ALLOWED_ORIGINS (comma-separated). With the
+# default wildcard, credentials are disabled so cross-origin credential theft
+# is not possible.
+_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "*").strip()
+if _cors_origins_env == "*":
+    _cors_allow_origins = ["*"]
+    _cors_allow_credentials = False
+else:
+    _cors_allow_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
+    _cors_allow_credentials = True
+
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["*"],
-    allow_credentials=True,
+    allow_origins=_cors_allow_origins,
+    allow_credentials=_cors_allow_credentials,
     allow_methods=["*"],
     allow_headers=["*"],
 )
```

---

### Incident Patch 4: `9a11b0ad` (2026-07-18)
**Commit Message**: security: warn when default JWT/encryption secrets are in use (#50)

The MCP server shipped with hardcoded default JWT and API-key encryption
secrets. Deploying without overriding them lets anyone read the source,
forge tokens and decrypt stored keys. Emit a prominent startup warning
(stderr + warnings) when either default is still active, so operators are
told to set JWT_SECRET_KEY / ENCRYPTION_KEY before exposing the server.
Kept non-fatal to avoid breaking local development.

**File**: `MCP/config/settings.py` (modified, +23/-0)
```diff
@@ -3,6 +3,8 @@
 """
 
 import os
+import sys
+import warnings
 from pathlib import Path
 from dataclasses import dataclass, field
 from typing import Optional
@@ -130,6 +132,27 @@ def __post_init__(self):
                 "In Docker, use a named volume for data (see docker-compose.yml) or ensure the mounted dir is writable by the container user."
             ) from e
 
+        # Warn loudly if the built-in default secrets are still in use. These
+        # defaults are only meant for local development; running with them in a
+        # shared/production deployment lets anyone who reads the source forge
+        # JWT tokens or decrypt stored API keys.
+        _default_jwt = "simplemem-secret-key-change-in-production"
+        _default_enc = "simplemem-encryption-key-32bytes!"
+        insecure = []
+        if self.jwt_secret_key == _default_jwt:
+            insecure.append("JWT_SECRET_KEY")
+        if self.encryption_key == _default_enc:
+            insecure.append("ENCRYPTION_KEY")
+        if insecure:
+            msg = (
+                "SECURITY WARNING: using built-in default value(s) for "
+                f"{', '.join(insecure)}. Set {' and '.join(insecure)} to strong, "
+                "unique secret(s) via environment variables before exposing this "
+                "server to any untrusted network."
+            )
+            warnings.warn(msg, stacklevel=2)
+            print(f"[SimpleMem] {msg}", file=sys.stderr)
+
 
 @lru_cache()
 def get_settings() -> Settings:
```

**File**: `simplemem/integrations/config/settings.py` (modified, +23/-0)
```diff
@@ -3,6 +3,8 @@
 """
 
 import os
+import sys
+import warnings
 from pathlib import Path
 from dataclasses import dataclass, field
 from typing import Optional
@@ -130,6 +132,27 @@ def __post_init__(self):
                 "In Docker, use a named volume for data (see docker-compose.yml) or ensure the mounted dir is writable by the container user."
             ) from e
 
+        # Warn loudly if the built-in default secrets are still in use. These
+        # defaults are only meant for local development; running with them in a
+        # shared/production deployment lets anyone who reads the source forge
+        # JWT tokens or decrypt stored API keys.
+        _default_jwt = "simplemem-secret-key-change-in-production"
+        _default_enc = "simplemem-encryption-key-32bytes!"
+        insecure = []
+        if self.jwt_secret_key == _default_jwt:
+            insecure.append("JWT_SECRET_KEY")
+        if self.encryption_key == _default_enc:
+            insecure.append("ENCRYPTION_KEY")
+        if insecure:
+            msg = (
+                "SECURITY WARNING: using built-in default value(s) for "
+                f"{', '.join(insecure)}. Set {' and '.join(insecure)} to strong, "
+                "unique secret(s) via environment variables before exposing this "
+                "server to any untrusted network."
+            )
+            warnings.warn(msg, stacklevel=2)
+            print(f"[SimpleMem] {msg}", file=sys.stderr)
+
 
 @lru_cache()
 def get_settings() -> Settings:
```

---

### Incident Patch 5: `80e3ebb4` (2026-07-18)
**Commit Message**: security: escape person/entity/timestamp filters in structured_search (#53)

structured_search interpolated person and entity names straight into the
LanceDB where() clause, letting a crafted name (e.g. "Alice')) OR true--")
break out of make_array() and bypass the filter to leak all rows. Apply
the same single-quote escaping already used for the location field to
persons, entities and timestamp bounds.

**File**: `SKILL/simplemem-skill/src/database/vector_store.py` (modified, +4/-2)
```diff
@@ -213,19 +213,21 @@ def structured_search(
             conditions = []
 
             if persons:
-                values = ", ".join([f"'{p}'" for p in persons])
+                values = ", ".join(["'" + str(p).replace("'", "''") + "'" for p in persons])
                 conditions.append(f"array_has_any(persons, make_array({values}))")
 
             if location:
                 safe_location = location.replace("'", "''")
                 conditions.append(f"location LIKE '%{safe_location}%'")
 
             if entities:
-                values = ", ".join([f"'{e}'" for e in entities])
+                values = ", ".join(["'" + str(e).replace("'", "''") + "'" for e in entities])
                 conditions.append(f"array_has_any(entities, make_array({values}))")
 
             if timestamp_range:
                 start_time, end_time = timestamp_range
+                start_time = str(start_time).replace("'", "''")
+                end_time = str(end_time).replace("'", "''")
                 conditions.append(f"timestamp >= '{start_time}' AND timestamp <= '{end_time}'")
 
             where_clause = " AND ".join(conditions)
```

**File**: `simplemem/core/database/vector_store.py` (modified, +4/-2)
```diff
@@ -204,19 +204,21 @@ def structured_search(
             conditions = []
 
             if persons:
-                values = ", ".join([f"'{p}'" for p in persons])
+                values = ", ".join(["'" + str(p).replace("'", "''") + "'" for p in persons])
                 conditions.append(f"array_has_any(persons, make_array({values}))")
 
             if location:
                 safe_location = location.replace("'", "''")
                 conditions.append(f"location LIKE '%{safe_location}%'")
 
             if entities:
-                values = ", ".join([f"'{e}'" for e in entities])
+                values = ", ".join(["'" + str(e).replace("'", "''") + "'" for e in entities])
                 conditions.append(f"array_has_any(entities, make_array({values}))")
 
             if timestamp_range:
                 start_time, end_time = timestamp_range
+                start_time = str(start_time).replace("'", "''")
+                end_time = str(end_time).replace("'", "''")
                 conditions.append(f"timestamp >= '{start_time}' AND timestamp <= '{end_time}'")
 
             where_clause = " AND ".join(conditions)
```

**File**: `simplemem/integrations/simplemem-skill/src/database/vector_store.py` (modified, +4/-2)
```diff
@@ -213,19 +213,21 @@ def structured_search(
             conditions = []
 
             if persons:
-                values = ", ".join([f"'{p}'" for p in persons])
+                values = ", ".join(["'" + str(p).replace("'", "''") + "'" for p in persons])
                 conditions.append(f"array_has_any(persons, make_array({values}))")
 
             if location:
                 safe_location = location.replace("'", "''")
                 conditions.append(f"location LIKE '%{safe_location}%'")
 
             if entities:
-                values = ", ".join([f"'{e}'" for e in entities])
+                values = ", ".join(["'" + str(e).replace("'", "''") + "'" for e in entities])
                 conditions.append(f"array_has_any(entities, make_array({values}))")
 
             if timestamp_range:
                 start_time, end_time = timestamp_range
+                start_time = str(start_time).replace("'", "''")
+                end_time = str(end_time).replace("'", "''")
                 conditions.append(f"timestamp >= '{start_time}' AND timestamp <= '{end_time}'")
 
             where_clause = " AND ".join(conditions)
```

---

### Incident Patch 6: `49152d55` (2026-07-18)
**Commit Message**: security: use ast.literal_eval instead of eval for benchmark data (#52)

The MMLongBench-Doc loader parsed evidence_pages/evidence_sources with
eval(), which executes arbitrary code if the dataset is tampered with.
Switch to ast.literal_eval(), which only parses Python literals. The
surrounding try/except still falls back to [] on malformed input, so
behavior for valid data is unchanged.

**File**: `OmniSimpleMem/omni_memory/evaluation/benchmarks.py` (modified, +3/-2)
```diff
@@ -9,6 +9,7 @@
 """
 
 import logging
+import ast
 import json
 import time
 from pathlib import Path
@@ -1032,15 +1033,15 @@ def load_data(self) -> None:
             evidence_pages = item.get("evidence_pages", "[]")
             if isinstance(evidence_pages, str):
                 try:
-                    evidence_pages = eval(evidence_pages)
+                    evidence_pages = ast.literal_eval(evidence_pages)
                 except:
                     evidence_pages = []
             
             # Parse evidence_sources (can be string or list)
             evidence_sources = item.get("evidence_sources", "[]")
             if isinstance(evidence_sources, str):
                 try:
-                    evidence_sources = eval(evidence_sources)
+                    evidence_sources = ast.literal_eval(evidence_sources)
                 except:
                     evidence_sources = []
             
```

**File**: `simplemem/multimodal/evaluation/benchmarks.py` (modified, +3/-2)
```diff
@@ -9,6 +9,7 @@
 """
 
 import logging
+import ast
 import json
 import time
 from pathlib import Path
@@ -1032,15 +1033,15 @@ def load_data(self) -> None:
             evidence_pages = item.get("evidence_pages", "[]")
             if isinstance(evidence_pages, str):
                 try:
-                    evidence_pages = eval(evidence_pages)
+                    evidence_pages = ast.literal_eval(evidence_pages)
                 except:
                     evidence_pages = []
             
             # Parse evidence_sources (can be string or list)
             evidence_sources = item.get("evidence_sources", "[]")
             if isinstance(evidence_sources, str):
                 try:
-                    evidence_sources = eval(evidence_sources)
+                    evidence_sources = ast.literal_eval(evidence_sources)
                 except:
                     evidence_sources = []
             
```

---

### Incident Patch 7: `05c7c42b` (2026-07-18)
**Commit Message**: fix(omni): add missing omni_memory.core.config module (#49)

The omni_memory package (and its tests/examples) import
`from omni_memory.core.config import OmniMemoryConfig`, but the module
file was missing, so `import omni_memory` failed with ModuleNotFoundError.
Restore config.py (mirrors simplemem/multimodal/core/config.py) with the
lazy evolution import pointed at the omni_memory namespace.

**File**: `OmniSimpleMem/omni_memory/core/config.py` (added, +236/-0)
```diff
@@ -0,0 +1,236 @@
+"""
+Configuration management for Omni-Memory system.
+"""
+
+import os
+from dataclasses import dataclass, field
+from typing import Optional, Dict, Any
+from pathlib import Path
+import json
+
+
+@dataclass
+class EntropyTriggerConfig:
+    """Configuration for modal entropy triggers."""
+
+    # Visual trigger settings
+    visual_similarity_threshold_high: float = 0.9  # Above this = static, discard
+    visual_similarity_threshold_low: float = 0.7   # Below this = significant change, trigger
+    visual_encoder: str = "clip"  # Options: clip, siglip, dinov2
+    visual_model_name: str = "UCSC-VLAA/openvision-vit-large-patch14-224"
+
+    # Audio trigger settings
+    audio_energy_threshold: float = 0.01  # Minimum energy to consider
+    audio_vad_threshold: float = 0.5      # Voice activity detection threshold
+    audio_min_speech_duration_ms: int = 500  # Minimum speech duration to trigger
+
+    # General settings
+    enable_visual_trigger: bool = True
+    enable_audio_trigger: bool = True
+
+
+@dataclass
+class StorageConfig:
+    """Configuration for storage management."""
+
+    # Base directories
+    base_dir: str = "./omni_memory_data"
+    cold_storage_dir: str = "./omni_memory_data/cold_storage"
+    index_dir: str = "./omni_memory_data/index"
+
+    # Storage backends
+    use_s3: bool = False
+    s3_bucket: Optional[str] = None
+    s3_prefix: str = "omni_memory/"
+
+    # File organization
+    organize_by_date: bool = True
+    organize_by_modality: bool = True
+
+    # Cleanup settings
+    max_storage_gb: float = 100.0
+    auto_cleanup_enabled: bool = False
+
+
+@dataclass
+class RetrievalConfig:
+    """Configuration for pyramid retrieval system."""
+
+    # Coarse retrieval (Step 1)
+    default_top_k: int = 10
+    max_summaries_in_context: int = 20
+
+    # Fine retrieval (Step 2)
+    max_expanded_items: int = 5
+    max_raw_content_tokens: int = 2000
+
+    # Token budgets
+    summary_token_budget: int = 500
+    details_token_budget: int = 1500
+    evidence_token_budget: int = 3000
+
+    # Retrieval modes
+    enable_hybrid_search: bool = True
+    enable_graph_traversal: bool = True
+
+    # Expansion settings
+    auto_expand_threshold: float = 0.85  # Auto-expand if relevance > threshold
+
+
+@dataclass
+class EmbeddingConfig:
+    """Configuration for embedding models."""
+
+    model_name: str = "text-embedding-3-small"
+    embedding_dim: int = 1536
+    batch_size: int = 32
+
+    # For visual embeddings
+    visual_embedding_model: str = "UCSC-VLAA/openvision-vit-large-patch14-224"
+    visual_embedding_dim: int = 768
+
+    def apply_backend_preset(self, preset: str) -> None:
+        """Apply a named visual embedding preset."""
+        presets = {
+            "openvision": ("UCSC-VLAA/openvision-vit-base-patch16-224", 768),
+            "openvision-large": ("UCSC-VLAA/openvision-vit-large-patch14-224", 768),
+            "openvision-large-336": ("UCSC-VLAA/openvision-vit-large-patch14-336", 768),
+            "openvision-huge": ("UCSC-VLAA/openvision-vit-huge-patch14-224", 1024),
+        }
+        if preset in presets:
+            self.visual_embedding_model, self.visual_embedding_dim = presets[preset]
+
+
+@dataclass
+class LLMConfig:
+    """Configuration for LLM interactions."""
+
+    # API settings
+    api_base_url: Optional[str] = None
+    api_key: Optional[str] = None
+
+    # Model selection
+    summary_model: str = "gpt-4o-mini"
+    query_model: str = "gpt-4o-mini"
+    caption_model: str = "gpt-4o"
+
+    # Generation settings
+    temperature: float = 0.0
+    max_tokens: int = 1000
+
+    # Whisper settings
+    whisper_model: str = "whisper-1"
+
+
+@dataclass
+class EventConfig:
+    """Configuration for event management."""
+
+    # Event creation
+    auto_create_events: bool = True
+    event_time_window_seconds: float = 300.0  # 5 minutes default
+    min_maus_per_event: int = 1
+
+    # Event summarization
+    summarize_on_close: bool = True
+    max_maus_for_summary: int = 20
+
+
+@dataclass
+class OmniMemoryConfig:
+    """
+    Main configuration class for Omni-Memory system.
+
+    Combines all sub-configurations into a unified config object.
+    """
+
+    # Sub-configurations
+    entropy_trigger: EntropyTriggerConfig = field(default_factory=EntropyTriggerConfig)
+    storage: StorageConfig = field(default_factory=StorageConfig)
+    retrieval: RetrievalConfig = field(default_factory=RetrievalConfig)
+    embedding: EmbeddingConfig = field(default_factory=EmbeddingConfig)
+    llm: LLMConfig = field(default_factory=LLMConfig)
+    event: EventConfig = field(default_factory=EventConfig)
+
+    # Self-evolution configuration (lazy import to avoid circular deps)
+    evolution: Optional[Any] = None  # EvolutionConfig, set via enable_evolution()
+
+    # Global settings
+    enable_self_evolution: bool = False
+    debug_mode: bool = False
+    log_level: str = "INFO"
+
+    def __post_init__(self):
+        """
```

---

### Incident Patch 8: `f6dded53` (2026-07-18)
**Commit Message**: Merge pull request #56 from msaidbilgehan/fix/keyword-search-numpy-truth-value

fix: avoid numpy truth-value ambiguity in keyword/structured search

**File**: `MCP/server/database/vector_store.py` (modified, +6/-3)
```diff
@@ -190,7 +190,8 @@ async def keyword_search(
             scores = []
             for idx, row in df.iterrows():
                 score = 0
-                entry_keywords = set(k.lower() for k in (row["keywords"] or []))
+                row_keywords = row["keywords"] if row["keywords"] is not None else []
+                entry_keywords = set(k.lower() for k in row_keywords)
                 entry_text = row["lossless_restatement"].lower()
 
                 for kw in keywords:
@@ -267,7 +268,8 @@ async def structured_search(
             if persons:
                 persons_lower = set(p.lower() for p in persons)
                 for i, row in df.iterrows():
-                    row_persons = set(p.lower() for p in (row["persons"] or []))
+                    persons_val = row["persons"] if row["persons"] is not None else []
+                    row_persons = set(p.lower() for p in persons_val)
                     if not persons_lower.intersection(row_persons):
                         mask[i] = False
 
@@ -284,7 +286,8 @@ async def structured_search(
                 entities_lower = set(e.lower() for e in entities)
                 for i, row in df.iterrows():
                     if mask[i]:
-                        row_entities = set(e.lower() for e in (row["entities"] or []))
+                        entities_val = row["entities"] if row["entities"] is not None else []
+                        row_entities = set(e.lower() for e in entities_val)
                         if not entities_lower.intersection(row_entities):
                             mask[i] = False
 
```

---

### Incident Patch 9: `27d06beb` (2026-07-18)
**Commit Message**: Merge pull request #73 from FBISiri/docs/fix-package-usage-api

docs: fix PACKAGE_USAGE.md to match current public API

**File**: `docs/PACKAGE_USAGE.md` (modified, +248/-183)
```diff
@@ -2,6 +2,10 @@
 
 This guide provides comprehensive documentation for using SimpleMem as a pip-installable Python package.
 
+> **Public API.** The package exposes a small, stable surface:
+> `SimpleMem`, `create`, `list_modes`, `optimize`, `Config`, and `load_config`
+> (see `simplemem.__all__`). All examples below use these names.
+
 ---
 
 ## Table of Contents
@@ -62,195 +66,264 @@ pip install simplemem[all]
 ### Minimal Example
 
 ```python
-from simplemem import SimpleMemSystem
+from simplemem import SimpleMem
 
-# Initialize the system with your API key
-system = SimpleMemSystem(
-    api_key="your-openai-api-key",
-    clear_db=True  # Start fresh
-)
+# Initialize the system. mode="auto" (default): the backend is chosen
+# by the first method you call — add_dialogue() selects the text backend.
+mem = SimpleMem()
 
 # Add dialogues with timestamps
-system.add_dialogue("Alice", "Let's meet at Starbucks tomorrow at 2pm", "2025-01-15T14:30:00")
-system.add_dialogue("Bob", "Sure, I'll bring the report", "2025-01-15T14:31:00")
+mem.add_dialogue("Alice", "Let's meet at Starbucks tomorrow at 2pm", "2025-01-15T14:30:00")
+mem.add_dialogue("Bob", "Sure, I'll bring the report", "2025-01-15T14:31:00")
 
 # Finalize memory encoding
-system.finalize()
+mem.finalize()
 
 # Query the memory
-answer = system.ask("When and where will Alice and Bob meet?")
+answer = mem.ask("When and where will Alice and Bob meet?")
 print(answer)
 # Output: "Alice and Bob will meet at Starbucks on January 16, 2025 at 2:00 PM"
 ```
 
+Provide the API key via the `OPENAI_API_KEY` environment variable, a top-level
+`config.py` (see [`config.py.example`](../config.py.example)), or by passing it
+explicitly (see [Using Custom LLM Endpoints](#using-custom-llm-endpoints)).
+
 ### Using Environment Variables
 
 ```python
 import os
-from simplemem import SimpleMemSystem
+from simplemem import SimpleMem
 
 # Set API key via environment variable
 os.environ["OPENAI_API_KEY"] = "your-api-key"
 
-# Initialize without explicit api_key parameter
-system = SimpleMemSystem(clear_db=True)
+# Initialize (reads OPENAI_API_KEY from the environment)
+mem = SimpleMem()
 ```
 
+### Choosing a Backend Explicitly
+
+`SimpleMem()` auto-selects a backend, but you can request one directly with
+`create()`:
+
+```python
+from simplemem import create, list_modes
+
+# Single-modal text memory
+mem = create(mode="text", clear_db=True)
+
+# Multimodal memory (text, image, audio, video)
+mem = create(mode="omni", data_dir="./my_memory")
+
+# Inspect the available backends
+print(list_modes())
+# {'text': 'Single-modal text memory ...', 'omni': 'Multimodal memory ...'}
+```
+
+`create(mode="text", ...)` returns the text memory system directly, exposing the
+full text API (`add_dialogue`, `add_dialogues`, `finalize`, `ask`,
+`get_all_memories`, `print_memories`).
+
 ---
 
 ## Configuration
 
-SimpleMem offers flexible configuration through three priority levels:
+SimpleMem resolves runtime settings in the following order (highest priority first):
+
+1. **Constructor parameters** passed to `SimpleMem(...)` / `create(...)`
+2. **A top-level `config.py`** on the Python path (copy from `config.py.example`)
+3. **Environment variables** of the same name (e.g. `OPENAI_API_KEY`, `LLM_MODEL`)
+4. **Built-in defaults**
 
-1. **Constructor Parameters** (highest priority)
-2. **Environment Variables**
-3. **Default Values** (lowest priority)
+### Using `config.py`
 
-### Using SimpleMemConfig
+The simplest way to configure a local checkout is to copy the template and edit it:
+
+```bash
+cp config.py.example config.py
+# Edit config.py with your API key, base URL, and model preferences
+```
 
 ```python
-from simplemem import SimpleMemConfig, set_config, SimpleMemSystem
-
-# Create custom configuration
-config = SimpleMemConfig(
-    openai_api_key="your-api-key",
-    llm_model="gpt-4.1-mini",
-    embedding_model="Qwen/Qwen3-Embedding-0.6B",
-    lancedb_path="./my_memory_db",
+# config.py
+OPENAI_API_KEY = "your-api-key"
+OPENAI_BASE_URL = None            # or a custom OpenAI-compatible endpoint
+LLM_MODEL = "gpt-4.1-mini"
+EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-0.6B"
+```
+
+### Constructor Parameters (text backend)
+
+When you use the text backend, the constructor accepts:
+
+| Parameter | Type | Default | Description |
+|-----------|------|---------|-------------|
+| `api_key` | str | `$OPENAI_API_KEY` | OpenAI-compatible API key |
+| `model` | str | `"gpt-4.1-mini"` | LLM model name |
+| `base_url` | str | None | Custom API endpoint |
+| `db_path` | str | `"./lancedb_data"` | LanceDB storage path |
+| `table_name` | str | `"memory_entries"` | Memory table name |
+| `clear_db` | bool | False | Clear existing database on start |
+| `enable_thinking` | bool | None | Deep-thinking mode (Qwen-compatible models) |
+| `use_streaming` | bool | None | Stream LLM responses |
+| `enable_planning` | bool | None | Multi-query retrieval planning |
+| `enable_reflection` | bool | None 
```

---

### Incident Patch 10: `467e6de6` (2026-05-21)
**Commit Message**: docs: correct Python requirement to 3.10+ in Installation

setup.py declares python_requires=">=3.10" and the package is verified on 3.12,
so the README should say 3.10+, not pin to 3.10.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -396,14 +396,14 @@ EvolveMem closes a blind spot shared by almost every memory system: the stored c
 
 ### 📝 Notes for First-Time Users
 
-- Ensure you are using **Python 3.10 in your active environment**, not just installed globally.
+- Ensure you are using **Python 3.10+ in your active environment**, not just installed globally.
 - An OpenAI-compatible API key must be configured **before running any memory construction or retrieval**, otherwise initialization may fail.
 - When using non-OpenAI providers (e.g., Qwen or Azure OpenAI), verify both the model name and `OPENAI_BASE_URL` in `config.py`.
 - For large dialogue datasets, enabling parallel processing can significantly reduce memory construction time.
 
 ### 📋 Requirements
 
-- 🐍 Python 3.10
+- 🐍 Python 3.10+
 - 🔑 OpenAI-compatible API (OpenAI, Qwen, Azure OpenAI, etc.)
 
 ### 🛠️ Setup
```

---

### Incident Patch 11: `e8c35a06` (2026-05-21)
**Commit Message**: docs: move SimpleMem text-memory deep-dive to docs/text-memory.md

Makes the three pillars symmetric: each now links from the Overview to its own
detailed doc (SimpleMem -> docs/text-memory.md, Omni -> OmniSimpleMem/,
EvolveMem -> EvolveMem/), instead of SimpleMem alone keeping a long deep-dive
section inline. Main README drops to the conceptual Overview plus Results;
removed the now-dead TOC entry.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-77)
```diff
@@ -133,7 +133,6 @@
 - [🚀 Quick Start](#-quick-start)
 - [🌟 Overview](#-overview)
 - [📈 Results](#-results)
-- [📝 SimpleMem: Text Memory](#-simplemem-text-memory)
 - [📦 Installation](#-installation)
 - [🐳 Docker](#-run-with-docker)
 - [🔌 MCP Server](#-mcp-server-text-memory)
@@ -292,7 +291,7 @@ Most memory systems force a bad trade-off. They either passively accumulate raw
 | **2. Online Semantic Synthesis** | Merges related context within a session into unified abstract representations, removing redundancy as memory is built rather than at query time. |
 | **3. Intent-Aware Retrieval Planning** | Infers the search intent behind a query to decide *what* to retrieve and assemble a precise, compact context. |
 
-On the LoCoMo benchmark this delivers a 26.4% average F1 gain over prior systems while cutting inference-time token consumption by roughly 30x.
+On the LoCoMo benchmark this delivers a 26.4% average F1 gain over prior systems while cutting inference-time token consumption by roughly 30x. Mechanism details (hybrid index layers, compression examples, retrieval planning): [**SimpleMem text memory →**](docs/text-memory.md).
 
 ### 🧠 Omni-SimpleMem: multimodal memory (text, image, audio, video)
 
@@ -393,81 +392,6 @@ EvolveMem closes a blind spot shared by almost every memory system: the stored c
 
 ---
 
-## 📝 SimpleMem: Text Memory
-
-### 1️⃣ Semantic Structured Compression
-
-SimpleMem applies an **implicit semantic density gating** mechanism integrated into the LLM generation process to filter redundant interaction content. The system reformulates raw dialogue streams into **compact memory units** — self-contained facts with resolved coreferences and absolute timestamps. Each unit is indexed through three complementary representations for flexible retrieval:
-
-<div align="center">
-
-| 🔍 Layer | 📊 Type | 🎯 Purpose | 🛠️ Implementation |
-|---------|---------|------------|-------------------|
-| **Semantic** | Dense | Conceptual similarity | Vector embeddings (1024-d) |
-| **Lexical** | Sparse | Exact term matching | BM25-style keyword index |
-| **Symbolic** | Metadata | Structured filtering | Timestamps, entities, persons |
-
-</div>
-
-**✨ Example Transformation:**
-```diff
-- Input:  "He'll meet Bob tomorrow at 2pm"  [❌ relative, ambiguous]
-+ Output: "Alice will meet Bob at Starbucks on 2025-11-16T14:00:00"  [✅ absolute, atomic]
-```
-
----
-
-### 2️⃣ Online Semantic Synthesis
-
-Unlike traditional systems that rely on asynchronous background maintenance, SimpleMem performs synthesis **on-the-fly during the write phase**. Related memory units are synthesized into higher-level abstract representations within the current session scope, allowing repetitive or structurally similar experiences to be **denoised and compressed immediately**.
-
-**✨ Example Synthesis:**
-```diff
-- Fragment 1: "User wants coffee"
-- Fragment 2: "User prefers oat milk"
-- Fragment 3: "User likes it hot"
-+ Consolidated: "User prefers hot coffee with oat milk"
-```
-
-This proactive synthesis ensures the memory topology remains compact and free of redundant fragmentation.
-
----
-
-### 3️⃣ Intent-Aware Retrieval Planning
-
-Instead of fixed-depth retrieval, SimpleMem leverages the reasoning capabilities of the LLM to generate a **comprehensive retrieval plan**. Given a query, the planning module infers **latent search intent** to dynamically determine retrieval scope and depth:
-
-$$\{ q_{\text{sem}}, q_{\text{lex}}, q_{\text{sym}}, d \} \sim \mathcal{P}(q, H)$$
-
-The system then executes **parallel multi-view retrieval** across semantic, lexical, and symbolic indexes, and merges results through ID-based deduplication:
-
-<table>
-<tr>
-<td width="50%">
-
-**🔹 Simple Queries**
-- Direct fact lookup via single memory unit
-- Minimal retrieval depth
-- Fast response time
-
-</td>
-<td width="50%">
-
-**🔸 Complex Queries**
-- Aggregation across multiple events
-- Expanded retrieval depth
-- Comprehensive coverage
-
-</td>
-</tr>
-</table>
-
-**📈 Result**: 43.24% F1 score with **30× fewer tokens** than full-context methods.
-
-> 🧠 **Multimodal** (Omni-SimpleMem) and 🧬 **self-evolving retrieval** (EvolveMem) are summarized in the [Overview](#-overview); full architecture and benchmarks live in [`OmniSimpleMem/`](OmniSimpleMem/) and [`EvolveMem/`](EvolveMem/).
-
----
-
 ## 📦 Installation
 
 ### 📝 Notes for First-Time Users
```

**File**: `docs/text-memory.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# SimpleMem: Text Memory
+
+How the text backend turns raw dialogue into compact, retrievable memory. For the high-level summary and where this fits the unified package, see the [main README Overview](../README.md#-overview).
+
+## 1. Semantic Structured Compression
+
+SimpleMem applies an **implicit semantic density gating** mechanism integrated into the LLM generation process to filter redundant interaction content. The system reformulates raw dialogue streams into **compact memory units**, self-contained facts with resolved coreferences and absolute timestamps. Each unit is indexed through three complementary representations for flexible retrieval:
+
+| 🔍 Layer | 📊 Type | 🎯 Purpose | 🛠️ Implementation |
+|---------|---------|------------|-------------------|
+| **Semantic** | Dense | Conceptual similarity | Vector embeddings (1024-d) |
+| **Lexical** | Sparse | Exact term matching | BM25-style keyword index |
+| **Symbolic** | Metadata | Structured filtering | Timestamps, entities, persons |
+
+**Example transformation:**
+
+```diff
+- Input:  "He'll meet Bob tomorrow at 2pm"  [relative, ambiguous]
++ Output: "Alice will meet Bob at Starbucks on 2025-11-16T14:00:00"  [absolute, atomic]
+```
+
+## 2. Online Semantic Synthesis
+
+Unlike traditional systems that rely on asynchronous background maintenance, SimpleMem performs synthesis **on-the-fly during the write phase**. Related memory units are synthesized into higher-level abstract representations within the current session scope, allowing repetitive or structurally similar experiences to be **denoised and compressed immediately**.
+
+**Example synthesis:**
+
+```diff
+- Fragment 1: "User wants coffee"
+- Fragment 2: "User prefers oat milk"
+- Fragment 3: "User likes it hot"
++ Consolidated: "User prefers hot coffee with oat milk"
+```
+
+This proactive synthesis keeps the memory topology compact and free of redundant fragmentation.
+
+## 3. Intent-Aware Retrieval Planning
+
+Instead of fixed-depth retrieval, SimpleMem leverages the reasoning capabilities of the LLM to generate a **comprehensive retrieval plan**. Given a query, the planning module infers **latent search intent** to dynamically determine retrieval scope and depth:
+
+$$\{ q_{\text{sem}}, q_{\text{lex}}, q_{\text{sym}}, d \} \sim \mathcal{P}(q, H)$$
+
+The system then executes **parallel multi-view retrieval** across semantic, lexical, and symbolic indexes, and merges results through ID-based deduplication:
+
+| 🔹 Simple Queries | 🔸 Complex Queries |
+|:--|:--|
+| Direct fact lookup via single memory unit | Aggregation across multiple events |
+| Minimal retrieval depth | Expanded retrieval depth |
+| Fast response time | Comprehensive coverage |
+
+**Result:** 43.24% F1 score with **30x fewer tokens** than full-context methods.
```

---

### Incident Patch 12: `33d97f13` (2026-05-21)
**Commit Message**: docs: move Optimize Retrieval Config before Parallel Processing in Quick Start

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +21/-21)
```diff
@@ -234,27 +234,6 @@ mem.close()
 
 ---
 
-### 🚄 Advanced: Parallel Processing
-
-For large-scale dialogue processing, enable parallel mode:
-
-```python
-from simplemem import create
-
-mem = create(
-    mode="text",
-    clear_db=True,
-    enable_parallel_processing=True,  # ⚡ Parallel memory building
-    max_parallel_workers=8,
-    enable_parallel_retrieval=True,   # 🔍 Parallel query execution
-    max_retrieval_workers=4
-)
-```
-
-> **💡 Pro Tip**: Parallel processing significantly reduces latency for batch operations!
-
----
-
 ### 🧬 Advanced: Optimize Retrieval Config
 
 Tune retrieval hyperparameters offline on your own dev set, then deploy the resulting `Config` for inference. This is a thin wrapper around EvolveMem's self-evolution loop:
@@ -280,6 +259,27 @@ mem = SimpleMem(config=config)
 
 ---
 
+### 🚄 Advanced: Parallel Processing
+
+For large-scale dialogue processing, enable parallel mode:
+
+```python
+from simplemem import create
+
+mem = create(
+    mode="text",
+    clear_db=True,
+    enable_parallel_processing=True,  # ⚡ Parallel memory building
+    max_parallel_workers=8,
+    enable_parallel_retrieval=True,   # 🔍 Parallel query execution
+    max_retrieval_workers=4
+)
+```
+
+> **💡 Pro Tip**: Parallel processing significantly reduces latency for batch operations!
+
+---
+
 ## 🌟 Overview
 
 **SimpleMem** is a family of efficient memory frameworks — **SimpleMem** for text and **Omni-SimpleMem** for multimodal (text, image, audio, video) — based on **semantic lossless compression** that addresses the fundamental challenge of **efficient long-term memory for LLM agents**. Unlike existing systems that either passively accumulate redundant context or rely on expensive iterative reasoning loops, SimpleMem maximizes **information density** and **token utilization** through a three-stage pipeline:
```

---

### Incident Patch 13: `43dade43` (2026-05-21)
**Commit Message**: docs: add simplemem.optimize() example to Quick Start

The News entry announced simplemem.optimize but the restored canonical Quick
Start (which predates the optimize wrapper) never demonstrated it. Adds an
"Advanced: Optimize Retrieval Config" block. Parallel-processing kwargs in the
preceding block verified working end-to-end.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +25/-0)
```diff
@@ -255,6 +255,31 @@ mem = create(
 
 ---
 
+### 🧬 Advanced: Optimize Retrieval Config
+
+Tune retrieval hyperparameters offline on your own dev set, then deploy the resulting `Config` for inference. This is a thin wrapper around EvolveMem's self-evolution loop:
+
+```python
+import simplemem
+from simplemem import SimpleMem, load_config
+
+# mem is a finalized SimpleMem instance with memories already built
+dev_questions = [
+    ("When is the meeting?", "2pm tomorrow at Starbucks"),
+    ("What should Bob prepare?", "market analysis report"),
+]
+config = simplemem.optimize(mem, dev_questions, max_rounds=3)
+config.save("my_config.json")
+
+# Later, deploy with the optimized config
+config = load_config("my_config.json")
+mem = SimpleMem(config=config)
+```
+
+> EvolveMem runs an LLM-driven Evaluate → Diagnose → Propose → Guard cycle over your dev questions, adjusting global retrieval flags (top_k, fusion mode, answer verification, reflection rounds, ...). For the full standalone version with benchmark adapters and per-category overrides, see [`EvolveMem/`](EvolveMem/).
+
+---
+
 ## 🌟 Overview
 
 **SimpleMem** is a family of efficient memory frameworks — **SimpleMem** for text and **Omni-SimpleMem** for multimodal (text, image, audio, video) — based on **semantic lossless compression** that addresses the fundamental challenge of **efficient long-term memory for LLM agents**. Unlike existing systems that either passively accumulate redundant context or rely on expensive iterative reasoning loops, SimpleMem maximizes **information density** and **token utilization** through a three-stage pipeline:
```

---

### Incident Patch 14: `dc658bfa` (2026-05-21)
**Commit Message**: chore: gitignore omni_memory_data/ and evolution_results/ runtime dirs

These are created at runtime by the Omni-SimpleMem backend (StorageConfig
base_dir default) and the EvolveMem optimization loop, mirroring the existing
lancedb_data/ entry.

Co-Authored-By: Claude Opus 4.7 (1M context) <[REDACTED_EMAIL]>

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -67,6 +67,8 @@ env/
 *.sqlite
 *.sqlite3
 lancedb_data/
+omni_memory_data/
+evolution_results/
 
 # Log files
 *.log
```

---

### Incident Patch 15: `5621b0a0` (2026-05-19)
**Commit Message**: fix: update LoCoMo benchmark imports to use simplemem.multimodal

Repoint OmniSimpleMem/benchmarks/locomo/run_locomo.py from
omni_memory.* to simplemem.multimodal.* so it runs against
the refactored unified package. Verified on LoCoMo (1 conv,
199 QA, gpt-5.1): F1=0.615, matching baseline.

**File**: `OmniSimpleMem/benchmarks/locomo/run_locomo.py` (modified, +4/-3)
```diff
@@ -44,7 +44,8 @@
 # ---- Path setup ----
 _THIS_DIR = Path(__file__).resolve().parent
 _PROJECT_ROOT = _THIS_DIR.parent.parent
-sys.path.insert(0, str(_PROJECT_ROOT))
+_REPO_ROOT = _PROJECT_ROOT.parent  # simplemem-refactor root
+sys.path.insert(0, str(_REPO_ROOT))
 
 logging.basicConfig(
     level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
@@ -414,8 +415,8 @@ def main():
     logger.info("Loaded %d conversations from %s", len(samples), data_path)
 
     # ---- Configure OmniMem ----
-    from omni_memory.core.config import OmniMemoryConfig
-    from omni_memory.orchestrator import OmniMemoryOrchestrator
+    from simplemem.multimodal.core.config import OmniMemoryConfig
+    from simplemem.multimodal.orchestrator import OmniMemoryOrchestrator
 
     config = OmniMemoryConfig()
     # API credentials
```

#### Recent Merged Pull Requests:
- **PR #76** (2026-07-24): refactor: extract vector store backend interface (@zc277584121)
- **PR #73** (2026-07-18): docs: fix PACKAGE_USAGE.md to match current public API (@FBISiri)
- **PR #71** (2026-07-18): Add Requesty as an LLM provider (@Thibaultjaigu)
- **PR #66** (closed): feat: add PostgreSQL/pgvector storage backend (@isc-tdyar)
- **PR #65** (closed): feat: add PostgreSQL/pgvector storage backend (@isc-tdyar)
- **PR #56** (2026-07-18): fix: avoid numpy truth-value ambiguity in keyword/structured search (@msaidbilgehan)
- **PR #39** (2026-02-26): feat: Add Docker support with configuration files and documentation (@pmzi)
- **PR #38** (2026-02-19): feat: Implement window overlap and online semantic synthesis (Stage 2) (@akatekhanh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
