# Forensic Learning Record (Deep Inspection): datawhalechina/all-in-rag

> **Canonical Artifact**: `07_PROJECT_LEARNING/datawhalechina-all-in-rag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/datawhalechina/all-in-rag](https://github.com/datawhalechina/all-in-rag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:48:06.048Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `datawhalechina/all-in-rag`
- **Description**: 🔍大模型应用开发实战一：RAG 技术全栈指南，在线阅读地址：https://datawhalechina.github.io/all-in-rag/
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11593 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Extra-chapter/PowerRAG-SDK-Text-QA/code/config.py`
```
"""
PowerRAG (RAGFlow) SDK Demo configuration.

This module follows the `code/` directory convention:
- Provide a small config object
- Load `.env` automatically (if present)
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.strip().lower()
    if raw in {"1", "true", "yes", "y", "on"}:
        return True
    if raw in {"0", "false", "no", "n", "off"}:
        return False
    return default


@dataclass(frozen=True)
class PowerRAGDemoConfig:
    base_url: str = os.getenv("RAGFLOW_BASE_URL", "http://127.0.0.1:9380").strip()
    api_key: str = os.getenv("RAGFLOW_API_KEY", "").strip()
    dataset_name: str = os.getenv("RAGFLOW_DATASET_NAME", "powerrag_text_qa_demo").strip()
    embedding_model: str = os.getenv("RAGFLOW_EMBEDDING_MODEL", "").strip()

    top_k: int = int(os.getenv("RAGFLOW_TOP_K", "5"))
    candidate_k: int = int(os.getenv("RAGFLOW_CANDIDATE_K", "1024"))
    similarity_threshold: float = float(os.getenv("RAGFLOW_SIMILARITY_THRESHOLD", "0.2"))
    vector_similarity_weight: float = float(os.getenv("RAGFLOW_VECTOR_SIMILARITY_WEIGHT", "0.3"))
    keyword: bool = _bool_env("RAGFLOW_KEYWORD", False)


DEFAULT_CONFIG = PowerRAGDemoConfig()


```

### Core Architecture Module: `Extra-chapter/PowerRAG-SDK-Text-QA/code/main.py`
```
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

from config import DEFAULT_CONFIG


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value.strip()


def _require(value: str | None, hint: str) -> str:
    if value is None or value.strip() == "":
        raise SystemExit(hint)
    return value.strip()


def _read_bytes(path: Path) -> bytes:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        raise SystemExit(f"File not found: {path}")


def _safe_get(obj: Any, attr: str, default: Any = None) -> Any:
    try:
        return getattr(obj, attr)
    except Exception:
        return default


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="PowerRAG (RAGFlow) SDK demo: upload Markdown, parse, retrieve top-k chunks.",
    )
    parser.add_argument("--file", type=Path, required=True, help="Markdown file path, e.g. ./data/sample.md")
    parser.add_argument("--question", type=str, required=True, help="User question for retrieval")
    parser.add_argument("--top-k", type=int, default=DEFAULT_CONFIG.top_k, help="How many chunks to return (mapped to page_size)")
    parser.add_argument(
        "--embedding-model",
        type=str,
        default=DEFAULT_CONFIG.embedding_model or _env("RAGFLOW_EMBEDDING_MODEL"),
        help=(
            "Embedding model string in '<model>@<factory>' format. "
            "If omitted, server tenant default is used."
        ),
    )
    parser.add_argument("--candidate-k", type=int, default=DEFAULT_CONFIG.candidate_k, help="RAGFlow.retrieve(top_k=...) candidate pool size")
    parser.add_argument("--similarity-threshold", type=float, default=DEFAULT_CONFIG.similarity_threshold, help="Filter chunks below this similarity")
    parser.add_argument("--vector-similarity-weight", type=float, default=DEFAULT_CONFIG.vector_similarity_weight, help="Weight of vector similarity in hybrid score")
    parser.add_argument("--keyword", action="store_true", default=DEFAULT_CONFIG.keyword, help="Enable keyword matching (hybrid retrieval)")
    parser.add_argument("--dataset-name", type=str, default=DEFAULT_CONFIG.dataset_name, help="Dataset name to create")
    parser.add_argument(
        "--base-url",
        type=str,
        default=DEFAULT_CONFIG.base_url or _env("RAGFLOW_BASE_URL") or _env("POWERRAG_BASE_URL") or _env("BASE_URL"),
        help="RAGFlow/PowerRAG base_url (or env RAGFLOW_BASE_URL / POWERRAG_BASE_URL / BASE_URL)",
    )
    parser.add_argument(
        "--api-key",
        type=str,
        default=DEFAULT_CONFIG.api_key or _env("RAGFLOW_API_KEY") or _env("POWERRAG_API_KEY") or _env("API_KEY"),
        help="RAGFlow/PowerRAG api_key (or env RAGFLOW_API_KEY / POWERRAG_API_KEY / API_KEY)",
    )
    parser.add_argument("--cleanup", action="store_true", help="Delete created dataset after finishing")

    args = parser.parse_args(argv)

    base_url = _require(args.base_url, "Missing base_url. Use --base-url or set env RAGFLOW_BASE_URL.")
    api_key = _require(args.api_key, "Missing api_key. Use --api-key or set env RAGFLOW_API_KEY.")

    if args.top_k <= 0:
        raise SystemExit("--top-k must be > 0")
    if args.candidate_k <= 0:
        raise SystemExit("--candidate-k must be > 0")

    blob = _read_bytes(args.file)
    display_name = args.file.name
    if not display_name.lower().endswith(".md"):
        display_name = f"{display_name}.md"

    try:
        from ragflow_sdk import RAGFlow  # type: ignore
    except Exception as e:
        raise SystemExit(
            "Failed to import ragflow_sdk. Install dependencies first:\n"
            "  pip install -r requirements.txt\n"
            f"Original error: {e}"
        )

    rag = RAGFlow(api_key=api_key, base_url=base_url)

    dataset_kwargs: dict[str, Any] = {"name": args.dataset_name}
    if args.embedding_model:
        dataset_kwargs["embedding_model"] = args.embedding_model
    dataset = rag.create_dataset(**dataset_kwargs)
    try:
        docs = dataset.upload_documents([{"display_name": display_name, "blob": blob}])
        if not docs:
            raise SystemExit("Upload succeeded but no document returned by SDK.")
        doc = docs[0]

        parse_results = dataset.parse_documents([doc.id])
        # parse_results: list[tuple[doc_id, status, success_count, failure_count]] (per API ref)
        print("Parse results:")
        print(parse_results)
        if parse_results and isinstance(parse_results, list):
            statuses = {r[1] for r in parse_results if isinstance(r, (list, tuple)) and len(r) >= 2}
            if statuses and statuses != {"DONE"}:
                raise SystemExit(
                    "Document parsing failed (status not DONE). "
                    "Most common cause is missing/unauthorized embedding model.\n"
                    "Try:\n"
                    "  - set tenant default embedding model in UI or via /v1/user/set_tenant_info, OR\n"
                    "  - rerun with --embedding-model '<model>@<factory>' (must be supported & configured for the tenant)\n"
                    "If it still fails, check PowerRAG logs inside the container (task executor) for the detailed error.\n"
                )

        chunks = rag.retrieve(
            question=args.question,
            dataset_ids=[dataset.id],
            document_ids=[doc.id],
            page=1,
            page_size=args.top_k,
            similarity_threshold=args.similarity_threshold,
            vector_similarity_weight=args.vector_similarity_weight,
            top_k=args.candidate_k,
            keyword=args.keyword,
        )

        print("\nRetrieved chunks:")
        if not chunks:
            print("(empty)")
            return 0

        for i, c in enumerate(chunks, start=1):
            similarity = _safe_get(c, "similarity")
            vector_similarity = _safe_get(c, "vector_similarity")
            term_similarity = _safe_get(c, "term_similarity")
            content = _safe_get(c, "content", "")
            content_preview = (content or "").strip().replace("\n", " ")
            if len(content_preview) > 260:
                content_preview = content_preview[:260] + "…"
            print(f"{i:02d}. similarity={similarity} vector={vector_similarity} term={term_similarity}")
            print(f"    {content_preview}")

        return 0
    finally:
        if args.cleanup:
            try:
                rag.delete_datasets(ids=[dataset.id])
            except Exception as e:
                print(f"Warning: failed to cleanup dataset {dataset.id}: {e}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

```

### Core Architecture Module: `Extra-chapter/multimodal-embedding-omni-practice/code/08_jina_embedding_omni.py`
```
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from transformers import AutoModel, AutoProcessor

SCRIPT_DIR = Path(__file__).resolve().parent
TOPIC_DIR = SCRIPT_DIR.parent
REPO_ROOT = TOPIC_DIR.parent.parent
DATA_DIR = TOPIC_DIR / "data"

MODEL_PATH = REPO_ROOT / "models/jina-embeddings-v5-omni-nano"
MODEL_REPO = "jinaai/jina-embeddings-v5-omni-nano"
SOURCES = {
    "img1": "beach1.jpg",
    "img2": "beach2.jpg",
    "audio": "example-audio-clip.wav",
    "video": "example-video-clip.mp4",
    "pdf": "paper_2506.18902_excerpt_2pages.pdf",
}

model_source = str(MODEL_PATH) if MODEL_PATH.exists() else MODEL_REPO
print(f"model_source={model_source}")

paths = {k: DATA_DIR / v for k, v in SOURCES.items()}
for p in paths.values():
    if not p.exists():
        raise FileNotFoundError(f"Missing local asset: {p}")

device = "mps" if torch.backends.mps.is_available() else "cpu"
raw_model = AutoModel.from_pretrained(
    model_source,
    trust_remote_code=True,
    default_task="retrieval",
    modality="vision",
).eval().to(device)
processor = AutoProcessor.from_pretrained(model_source, trust_remote_code=True)
st_model = SentenceTransformer(model_source, trust_remote_code=True, model_kwargs={"default_task": "retrieval"})

with torch.no_grad():
    docs = raw_model.embed(
        **processor(
            text=[
                "Document: A beautiful sunset over the beach",
                "Document: Un beau coucher de soleil sur la plage",
                "Document: 海滩上美丽的日落",
                "Document: 浜辺に沈む美しい夕日",
            ],
            padding=True,
            return_tensors="pt",
        ).to(device)
    ).float().cpu().numpy()
    img1 = raw_model.embed(**processor(images=[str(paths["img1"])], text="<image>", return_tensors="pt").to(device)).float().cpu().numpy()[0]
    img2 = raw_model.embed(**processor(images=[str(paths["img2"])], text="<image>", return_tensors="pt").to(device)).float().cpu().numpy()[0]

audio = st_model.encode(str(paths["audio"]), convert_to_numpy=True)
video = st_model.encode(str(paths["video"]), convert_to_numpy=True)
pdf = st_model.encode(str(paths["pdf"]), convert_to_numpy=True)

corpus = np.vstack([docs[0], docs[1], docs[2], docs[3], img1, img2, audio, video, pdf])
queries = [
    ("R1", "sunset on the beach"),
    ("R2", "waves and sunset on coast"),
    ("R3", "beach scene with warm orange sky"),
]
all_rounds: dict[str, np.ndarray] = {}

for name, q in queries:
    with torch.no_grad():
        qv = raw_model.embed(**processor(text=f"Query: {q}", return_tensors="pt").to(device)).float().cpu().numpy()[0]
        fusion = raw_model.embed(**processor(images=[str(paths["img1"])], text=q, return_tensors="pt").to(device)).float().cpu().numpy()[0]
    vectors = np.vstack([qv, corpus, fusion])
    all_rounds[name] = vectors
    n = np.linalg.norm(vectors, axis=1, keepdims=True)
    sim = (vectors / n) @ (vectors / n).T
    print(f"\n{name} | shape={vectors.shape} | q_first8={np.array2string(vectors[0,:8], precision=4)}")
    print(np.array2string(sim, precision=4, suppress_small=True))

base = all_rounds["R1"]
for name in ["R2", "R3"]:
    other = all_rounds[name]
    aligned = np.array(
        [
            float((base[i] @ other[i]) / (np.linalg.norm(base[i]) * np.linalg.norm(other[i])))
            for i in range(base.shape[0])
        ]
    )
    scores = np.array(
        [
            float((base[0] @ other[i]) / (np.linalg.norm(base[0]) * np.linalg.norm(other[i])))
            for i in range(1, 1 + corpus.shape[0])
        ]
    )
    print(f"\nR1 -> {name}")
    print(f"aligned={np.array2string(aligned, precision=4)}")
    print(f"best_corpus_idx={1 + int(np.argmax(scores))}, score={scores.max():.4f}")

```

### Core Architecture Module: `code/C1/01_langchain_example.py`
```
import os
# hugging face镜像设置，如果国内环境无法使用启用该设置
# os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
from dotenv import load_dotenv
from langchain_community.document_loaders import UnstructuredMarkdownLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

load_dotenv()

markdown_path = "../../data/C1/markdown/easy-rl-chapter1.md"

# 加载本地markdown文件
loader = UnstructuredMarkdownLoader(markdown_path)
docs = loader.load()

# 文本分块
text_splitter = RecursiveCharacterTextSplitter()
chunks = text_splitter.split_documents(docs)

# 中文嵌入模型
embeddings = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-zh-v1.5",
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': True}
)
  
# 构建向量存储
vectorstore = InMemoryVectorStore(embeddings)
vectorstore.add_documents(chunks)

# 提示词模板
prompt = ChatPromptTemplate.from_template("""请根据下面提供的上下文信息来回答问题。
请确保你的回答完全基于这些上下文。
如果上下文中没有足够的信息来回答问题，请直接告知：“抱歉，我无法根据提供的上下文找到相关信息来回答此问题。”

上下文:
{context}

问题: {question}

回答:"""
                                          )

# 配置大语言模型

# 使用 AIHubmix
llm = ChatOpenAI(
    model="glm-4.7-flash-free",
    temperature=0.7,
    max_tokens=4096,
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://aihubmix.com/v1"
)

# llm = ChatOpenAI(
#     model="deepseek-chat",
#     temperature=0.7,
#     max_tokens=4096,
#     api_key=os.getenv("DEEPSEEK_API_KEY"),
#     base_url="https://api.deepseek.com"
# )

# 用户查询
question = "文中举了哪些例子？"

# 在向量存储中查询相关文档
retrieved_docs = vectorstore.similarity_search(question, k=3)
docs_content = "\n\n".join(doc.page_content for doc in retrieved_docs)

answer = llm.invoke(prompt.format(question=question, context=docs_content))
print(answer)

```

### Core Architecture Module: `code/C1/02_llamaIndex_example.py`
```
import os
# os.environ['HF_ENDPOINT']='https://hf-mirror.com'
from dotenv import load_dotenv
from llama_index.core import VectorStoreIndex, SimpleDirectoryReader, Settings 
from llama_index.llms.openai_like import OpenAILike
from llama_index.embeddings.huggingface import HuggingFaceEmbedding

load_dotenv()

# 使用 AIHubmix
Settings.llm = OpenAILike(
    model="glm-4.7-flash-free",
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    api_base="https://aihubmix.com/v1",
    is_chat_model=True
)

# Settings.llm = OpenAI(
#     model="deepseek-chat",
#     api_key=os.getenv("DEEPSEEK_API_KEY"),
#     api_base="https://api.deepseek.com"
# )
Settings.embed_model = HuggingFaceEmbedding("BAAI/bge-small-zh-v1.5")

docs = SimpleDirectoryReader(input_files=["../../data/C1/markdown/easy-rl-chapter1.md"]).load_data()

index = VectorStoreIndex.from_documents(docs)

query_engine = index.as_query_engine()

print(query_engine.get_prompts())

print(query_engine.query("文中举了哪些例子?"))
```

### Core Architecture Module: `code/C1/fix_nltk.py`
```
import nltk

nltk.download('punkt', force=True)
nltk.download('averaged_perceptron_tagger', force=True)
```

### Core Architecture Module: `code/C2/01_unstructured_example.py`
```
from unstructured.partition.auto import partition

# PDF文件路径
pdf_path = "../../data/C2/pdf/rag.pdf"

# 使用Unstructured加载并解析PDF文档
elements = partition(
    filename=pdf_path,
    content_type="application/pdf"
)

# 打印解析结果
print(f"解析完成: {len(elements)} 个元素, {sum(len(str(e)) for e in elements)} 字符")

# 统计元素类型
from collections import Counter
types = Counter(e.category for e in elements)
print(f"元素类型: {dict(types)}")

# 显示所有元素
print("\n所有元素:")
for i, element in enumerate(elements, 1):
    print(f"Element {i} ({element.category}):")
    print(element)
    print("=" * 60)
```

### Core Architecture Module: `code/C2/02_character_splitter.py`
```
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.document_loaders import TextLoader

# 1. 文档加载
loader = TextLoader("../../data/C2/txt/蜂医.txt", encoding="utf-8")
docs = loader.load()

# 2. 初始化固定大小分块器
text_splitter = CharacterTextSplitter(
    chunk_size=200,    # 每个块的大小
    chunk_overlap=10   # 块之间的重叠大小
)

# 3. 执行分块
chunks = text_splitter.split_documents(docs)

# 4. 打印结果
print(f"文本被切分为 {len(chunks)} 个块。\n")
print("--- 前5个块内容示例 ---")
for i, chunk in enumerate(chunks[:5]):
    print("=" * 60)
    # chunk 是一个 Document 对象，需要访问它的 .page_content 属性来获取文本
    print(f'块 {i+1} (长度: {len(chunk.page_content)}): "{chunk.page_content}"')

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #128** (2026-07-29): **[问题反馈] 简要概述问题**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  docs/chapter4/13_text2sql.md  ### 问题描述  def _build_context(self, knowledge_results: List[Dict[str, Any]]) -> str:     """构建上下文信息"""     # 按类型分组     ddl_info = []        # 表结构信息     qsql_examples = []   # 查询示例     descriptions = []    # 表描述信息          # 分层次组织信息：结构 → 描述 → 示例     if ddl_info:         context += "=== 表结构信息 ===\n"     if descriptions:         context += "=== 表和字段描述 ===\n"     if qsql_examples:         context += "=== 查询示例 ===\n" 这里没有遍历 knowledge_results，三个列表始终为空； 没有初始化 context，直接使用 context += 会报错。  ### 复现步骤  _No response_  ### 最小可复现代码/命令  ```shell def _build_context(     self,     knowledge_results: List[Dict[str, Any]] ) -> str:     """将检索结果按类型整理为供大模型使用的上下文。"""      ddl_info: List[str] = []     qsql_examples: List[str] = []     descriptions: List[str] = []      # 1. 对检索结果进行分类     for item in knowledge_results:         item_type = str(item.get("type", "")).strip().lower()         content = str(item.get("content", "")).strip()          if not content:             continue          if item_type == "ddl":             ddl_info.append(content)         elif item_type == "qsql":             qsql_examples.append(content)         elif item_type == "description":             descriptions.append(content)      # 2. 按“结构 → 描述 → 示例”的顺序组织上下文     context_parts: List[str] = []      if ddl_info:         context_parts.append(             "=== 表结构信息 ===\n"             + "\n\n"
  **Post-Mortem & Fix Analysis**:
  > 感觉反馈，文档已与代码对齐

- **Issue #124** (2026-08-04): **[问题反馈] 第三章节Milvus实战多模态检索输出结果错误。**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  all-in-rag/docs/chapter3 /09_milvus.md  ### 问题描述  --> 正在 'multimodal_demo' 中执行检索 检索结果:   Top 1: ID=459243798403756667, 距离=0.9411, 路径='../../data/C3\dragon\dragon01.png'   Top 2: ID=459243798403756668, 距离=0.5818, 路径='../../data/C3\dragon\dragon02.png'   Top 3: ID=459243798403756671, 距离=0.5731, 路径='../../data/C3\dragon\dragon05.png'   Top 4: ID=459243798403756670, 距离=0.4894, 路径='../../data/C3\dragon\dragon04.png'   Top 5: ID=459243798403756669, 距离=0.4100, 路径='../../data/C3\dragon\dragon03.png' data/C3/dragon/目录下没有dragon01.png图片。  ### 复现步骤  _No response_  ### 最小可复现代码/命令  ```shell  ```  ### 环境信息  _No response_  ### 日志/报错信息与截图  ```bash  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈已对齐文档

- **Issue #123** (2026-07-20): **[问题反馈] search_by_category() 和 get_ingredients_list()**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  code/C8/main.py  ### 问题描述  您好！我最近在仔细学习第八章的代码。在精读 main.py 的源码时，我注意到 search_by_category() 和 get_ingredients_list() 这两个函数似乎在当前的运行流程中并没有被显式调用。不知道是不是我遗漏了某些细节逻辑？想向您请教一下，当初设计和保留这两个函数是出于怎样的考量呢？期待您的解答，非常感谢！  ### 复现步骤  _No response_  ### 最小可复现代码/命令  ```shell  ```  ### 环境信息  _No response_  ### 日志/报错信息与截图  ```bash  ```
  **Post-Mortem & Fix Analysis**:
  > ask_question() 通过查询路由（query_router）+ 过滤条件提取（_extract_filters_from_query）已经覆盖了这两个函数的功能，这俩应该是漏删了，也可能当时是考虑是做成练习

- **Issue #118** (2026-06-05): **[问题反馈] 08 跨运行时 parent_id 不匹配导致 get_parent_documents 返回空列表**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  code/C8/main.py  ### 问题描述  # BUG-001: 跨运行时 parent_id 不匹配导致 get_parent_documents 返回空列表  > **状态**: 已确认 🔴   > **严重级别**: 高 — 影响核心检索链路   > **影响范围**: `main.py` 的问答流程、`DataPreparationModule.get_parent_documents()`   > **发现日期**: 2026-05-30  ---  ## 1. 问题概述  `get_parent_documents()` 在第二次及之后的运行中返回空列表，导致 `ask_question()` 无法获取完整父文档用于生成回答。系统表现为：  - 检索能命中 chunk（向量索引工作正常） - 但无法回溯到原始父文档（`get_parent_documents` 返回 `[]`） - LLM 回答质量下降（缺少完整上下文）  ---  ## 2. 触发条件  以下任一条件均可触发：  | 条件 | 场景 | |------|------| | **重启后第二次运行** | 第一次构建并保存索引，关闭程序后重新运行 | | **多进程/多实例** | 构建索引和问答使用不同的 `DataPreparationModule` 实例 | | **索引已存在 + 重新加载** | `index_module.load_index()` 成功，随后调用 `data_module.load_documents()` |   ### 复现步骤  ## 3. 根本原因  ### 3.1 随机 UUID 导致 parent_id 不稳定  `DataPreparationModule.load_documents()` 在 [data_preparation.py:51](rag_modules/data_preparation.py:51) 为每个文档生成 `parent_id`：  ```python parent_id = str(uuid.uuid4())  # ⚠️ 每次运行都不同！ ```  `uuid.uuid4()` 是纯随机值，同一文件在不同运行中会得到完全不同的 `parent_id`。  ### 3.2 main.py 的流程加剧了问题  `main.py` 的 `build_knowledge_base()` 存在以下流程：  ``` 第1次运行：                          第2次运行（重启后）： ┌─────────────────────┐             ┌─────────────────────┐ │ load_documents()    │             │ load_index()        │  ← 加载旧索引 │ parent_id = uuid-1  │             │ (chunk 含 uuid-1)   │     (chunk 含 uuid-1) │ chunk_documents()   │             │ load_documents()    │  ← ⚠️ 生成新 uuid-2 │ (chunk 含 
  **Post-Mortem & Fix Analysis**:
  > 你好，这个代码是最新的吗，我这边是用hashlib.md5 基于文件相对路径

- **Issue #117** (2026-05-30): **[问题反馈] 简要概述问题**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  code/C8/main.py  ### 问题描述  # BUG-001: 跨运行时 parent_id 不匹配导致 get_parent_documents 返回空列表  > **状态**: 已确认 🔴   > **严重级别**: 高 — 影响核心检索链路   > **影响范围**: `main.py` 的问答流程、`DataPreparationModule.get_parent_documents()`   > **发现日期**: 2026-05-30  ---  ## 1. 问题概述  `get_parent_documents()` 在第二次及之后的运行中返回空列表，导致 `ask_question()` 无法获取完整父文档用于生成回答。系统表现为：  - 检索能命中 chunk（向量索引工作正常） - 但无法回溯到原始父文档（`get_parent_documents` 返回 `[]`） - LLM 回答质量下降（缺少完整上下文）  ---  ## 2. 触发条件  以下任一条件均可触发：  | 条件 | 场景 | |------|------| | **重启后第二次运行** | 第一次构建并保存索引，关闭程序后重新运行 | | **多进程/多实例** | 构建索引和问答使用不同的 `DataPreparationModule` 实例 | | **索引已存在 + 重新加载** | `index_module.load_index()` 成功，随后调用 `data_module.load_documents()` |   ### 复现步骤  **最小复现代码：**  ```python from rag_modules import DataPreparationModule, IndexConstructionModule  # 第1次运行：构建索引 prep1 = DataPreparationModule('data/dishes') prep1.load_documents() chunks1 = prep1.chunk_documents()  idx = IndexConstructionModule(index_save_path='test_index') vs = idx.build_vector_index(chunks1) idx.save_index()  old_parent_id = prep1.documents[0].metadata['parent_id'] old_chunk_id  = chunks1[0].metadata['parent_id']  # 第2次运行：加载索引 + 重新加载文档（模拟 main.py 流程） prep2 = DataPreparationModule('data/dishes') prep2.load_documents() # prep2.documents[0].metadata['parent_id']  ≠  old_parent_id ❌  idx2 = IndexConstructionModule(index_save_path='test_index') vs2 = idx2.load_index()  # 从旧索引中检索 chunk

- **Issue #103** (2026-05-19): **没有17吗，chapter5 16 formatted generation结束之后没有看到17**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  链接失效/资源缺失  ### 位置（章节/文件路径）  docs/chapter5  ### 问题描述  没有17吗，chapter5 16 formatted generation结束之后没有看到17  ### 复现步骤  _No response_  ### 最小可复现代码/命令  ```shell  ```  ### 环境信息  _No response_  ### 日志/报错信息与截图  ```bash  ```
  **Post-Mortem & Fix Analysis**:
  > 对的，暂时没有，之前的17不符合教学节奏就删除了

- **Issue #99** (2026-03-29): **[问题反馈] 简要概述问题**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  code/C1/01_langchain_example.py  ### 问题描述  按教程配置 DEEPSEEK_API_KEY 后运行报错 401 认证失败。  原因：代码中 base_url 使用的是 aihubmix.com，但读取的环境变量是 DEEPSEEK_API_KEY，两者不匹配。（注释的那个是对的，运行的这个有问题）  建议：在注释中说明使用 AIHubMix 时应配置 AIHUBMIX_API_KEY，或将默认配置改为 DeepSeek 官方 API 与教程保持一致。一点点小bug了ww，自己看看报错也能解决但是新手可能有一点点迷茫......  ### 复现步骤  1. 在 .env 中配置 DEEPSEEK_API_KEY 2. 运行 python code/C1/01_langchain_example.py 3. 报错 401 - Invalid token（Aihubmix_api_error）  ### 最小可复现代码/命令  ```shell python code/C1/01_langchain_example.py ```  ### 环境信息  _No response_  ### 日志/报错信息与截图  ```bash openai.AuthenticationError: Error code: 401 - {'error':... ```
  **Post-Mortem & Fix Analysis**:
  > 留存一下罢了

- **Issue #95** (2026-04-27): **[问题反馈] 简要概述问题**
  *Symptoms*: ### 提交前检查  - [x] 我已在 Issues 中搜索，未找到相同问题 - [x] 我已使用仓库最新版（或 `main` 分支）进行复现  ### 问题类型  代码运行错误  ### 位置（章节/文件路径）  code/C3/04_multi_milvus.py  ### 问题描述  文件里步骤三：初始化milvus客户端，uri传localhost连接不成功，127.0.0.1可以。运行环境macos m4，python3.13，milvus版本号：2.6.12 , pymilvus版本号：2.6.10。  ### 复现步骤  _No response_  ### 最小可复现代码/命令  ```shell  ```  ### 环境信息  _No response_  ### 日志/报错信息与截图  <img width="1624" height="1061" alt="Image" src="https://github.com/user-attachments/assets/34f8b14d-c89e-4b1b-8d69-208a96661ae0" />  ```bash  ```
  **Post-Mortem & Fix Analysis**:
  > localhost被解析成ipv6地址了吗

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

### Incident Patch 1: `28907fd9` (2026-05-05)
**Commit Message**: Fix link to Milvus introduction in documentation

**File**: `docs/chapter9/03_index_construction.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 在图RAG系统中，索引构建是连接图数据和向量检索的关键环节。本节介绍如何将图数据转换为可检索的向量索引。
 
-在第三章中，我们已经详细介绍了Milvus的基本概念、部署方式和基础操作。本节将在此基础上，专门针对图RAG场景进行深度应用。如果你对Milvus还不熟悉，建议先阅读[Milvus介绍及多模态检索实践](../chapter3/09_milvus.md)。
+在第三章中，我们已经详细介绍了Milvus的基本概念、部署方式和基础操作。本节将在此基础上，专门针对图RAG场景进行深度应用。如果你对Milvus还不熟悉，建议先阅读[Milvus介绍及多模态检索实践](./chapter3/09_milvus.md)。
 
 > [本节完整代码](https://github.com/datawhalechina/all-in-rag/blob/main/code/C9/rag_modules/milvus_index_construction.py)
 
```

---

### Incident Patch 2: `9e4526af` (2026-05-02)
**Commit Message**: fix(retrieval): RRF 修正同 source 内 chunk 重复加分 + canonical doc 选最佳 rank chunk

  - 原实现 score 累加未按 source 去重，同一 recipe 的多个 chunk 在同一路里
    会被反复加分，违反 RRF "每个 ranker 对每个 doc 贡献一次" 的语义
  - canonical doc 原按"输入顺序首次见到"选取，受 ranked_lists 顺序支配；
    改为按全局最小 rank 选取，rank 相同时按 ranked_lists 顺序优先
  - 同时把每个 source 的 chunk 命中次数另存到 metadata.rrf_chunk_hits，
    便于后续分析
  - _rrf_merge 不再 mutate 输入 Document.metadata，返回新 Document 对象

  更新之后在100 题评测集上 MRR@10 0.898 → 0.939，Faithfulness 0.680 → 0.734。

  Addresses review comment in #106

**File**: `code/C9/rag_modules/hybrid_retrieval.py` (modified, +53/-25)
```diff
@@ -628,55 +628,83 @@ def _rrf_merge(
         k: int = _RRF_K,
     ) -> List[Document]:
         """
-        Reciprocal Rank Fusion: score(d) = Σ_i 1 / (k + rank_i(d))
+        Reciprocal Rank Fusion: score(d) = Σ_i 1 / (k + best_rank_i(d))
 
         Args:
             ranked_lists: 多路 (source_name, ranked_docs) — docs 按相关度降序
             top_k: 最终返回个数
             k: RRF 平滑常数，默认 60（Cormack et al. 2009）
 
         去重 key：node_id 优先，page_content[:200] hash 兜底。
-        合并后 metadata 写入 rrf_score / rrf_sources / final_score。
-        """
-        rrf_scores: Dict[str, float] = {}
-        doc_index: Dict[str, Document] = {}
-        sources: Dict[str, List[str]] = {}
-        ranks_by_source: Dict[str, Dict[str, int]] = {}
 
-        for source_name, ranked_docs in ranked_lists:
+        同 source 内同 doc_id 多次命中（如一道菜的多个 chunk 共享 recipe.nodeId）：
+            - 算分只取该 source 内最佳 rank（最小 rank）一次，避免重复加分
+            - 命中 chunk 数另存到 rrf_chunk_hits，供后续分析
+
+        canonical doc（最终展示给 LLM 的 page_content）：
+            选全局最小 rank 那个 chunk；rank 相同时按 ranked_lists 顺序优先。
+
+        返回的 Document 是新对象，不会 mutate 输入 list 里的 Document。
+        """
+        # doc_id -> source_name -> 该 source 内最小 rank（用于算分）
+        best_rank_per_source: Dict[str, Dict[str, int]] = {}
+        # doc_id -> source_name -> 该 source 内命中 chunk 次数（信息存档）
+        chunk_hits_per_source: Dict[str, Dict[str, int]] = {}
+        # doc_id -> (global_best_rank, source_priority, doc) — 选 canonical doc
+        best_doc_info: Dict[str, Tuple[int, int, Document]] = {}
+
+        for source_priority, (source_name, ranked_docs) in enumerate(ranked_lists):
             for rank, doc in enumerate(ranked_docs, start=1):
                 node_id = doc.metadata.get("node_id")
                 doc_id = (
                     str(node_id) if node_id is not None
                     else f"hash::{hash(doc.page_content[:200])}"
                 )
 
-                contribution = 1.0 / (k + rank)
-                rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + contribution
+                if doc_id not in best_rank_per_source:
+                    best_rank_per_source[doc_id] = {}
+                    chunk_hits_per_source[doc_id] = {}
+
+                curr_best = best_rank_per_source[doc_id].get(source_name)
+                # 如果是第一次出现或者当前rank比记录的更小，则更新
+                if curr_best is None or rank < curr_best:
+                    best_rank_per_source[doc_id][source_name] = rank
+
+                chunk_hits_per_source[doc_id][source_name] = (
+                    chunk_hits_per_source[doc_id].get(source_name, 0) + 1
+                )
 
-                # 第一次见到这个 doc 时记录为 canonical（通常是 rank 较高的那路）
-                if doc_id not in doc_index:
-                    doc_index[doc_id] = doc
-                    sources[doc_id] = []
-                    ranks_by_source[doc_id] = {}
+                new_key = (rank, source_priority)
+                if (
+                    doc_id not in best_doc_info
+                    or new_key < (best_doc_info[doc_id][0], best_doc_info[doc_id][1])
+                ):
+                    best_doc_info[doc_id] = (rank, source_priority, doc)
 
-                if source_name not in sources[doc_id]:
-                    sources[doc_id].append(source_name)
-                    ranks_by_source[doc_id][source_name] = rank
+        # 每个 source 只用 best rank 算一次贡献
+        rrf_scores: Dict[str, float] = {
+            doc_id: sum(1.0 / (k + r) for r in source_ranks.values())
+            for doc_id, source_ranks in best_rank_per_source.items()
+        }
 
-        # 按 RRF score 降序
         sorted_ids = sorted(
             rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True
         )
 
         merged: List[Document] = []
         for doc_id in sorted_ids[:top_k]:
-            doc = doc_index[doc_id]
-            doc.metadata["rrf_score"] = rrf_scores[doc_id]
-            doc.metadata["rrf_sources"] = list(sources[doc_id])
-            doc.met
```

---

### Incident Patch 3: `6a4ca028` (2026-01-28)
**Commit Message**: Merge pull request #77 from pi-dal/fix/issue-71

fix: correct typo in chapter4 image



---

### Incident Patch 4: `5bbf81a7` (2026-01-26)
**Commit Message**: fix: correct typo in image and fix occlusion issue

Fixes #71



#### Recent Merged Pull Requests:
- **PR #142** (2026-09-04): feat: 第七章新增第二节 Agentic RAG (@FutureUnreal)
- **PR #139** (closed): [Extra-chapter] 面向 Agentic RAG 的持久化纠错记忆 (@linhongyu510)
- **PR #138** (2026-09-02): Refine RAG evaluation guidance and tooling docs (@1985312383)
- **PR #136** (closed): Test EvoAgent GitHub webhook (@yaoyahan)
- **PR #135** (closed): [Extra-chapter] 新增 RAG 面试题库（26 题） (@Terminator666666)
- **PR #134** (closed): Test1 (@lrbwhite)
- **PR #133** (closed): [Extra-chapter] RAG 面试题库 (@Terminator666666)
- **PR #116** (closed): [docs] add en docs for english users (@Nanyak)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
