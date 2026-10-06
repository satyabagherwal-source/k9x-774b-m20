# Forensic Learning Record (Deep Inspection): xerrors/Yuxi

> **Canonical Artifact**: `07_PROJECT_LEARNING/xerrors-yuxi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xerrors/Yuxi](https://github.com/xerrors/Yuxi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:49:33.859Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerrors/Yuxi`
- **Description**: 可私有部署的多租户知识智能体平台：统一 RAG、知识图谱、多智能体、MCP/Skills、沙盒与权限管理。Yuxi = Cloud Agents + Knowledge RAG, Self-hosted knowledge agent platform for RAG, knowledge graphs and multi-agent workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7283 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/package/yuxi/agents/state.py`
```
"""Define the state structures for the agent."""

from __future__ import annotations

from typing import Annotated, TypedDict

from langchain.agents import AgentState


def merge_artifacts(existing: list[str] | None, new: list[str] | None) -> list[str]:
    """Merge artifact file paths while preserving order and removing duplicates."""
    if existing is None:
        return new or []
    if new is None:
        return existing
    return list(dict.fromkeys(existing + new))


class BaseState(AgentState):
    """Shared state fields for Yuxi agents."""

    artifacts: Annotated[list[str], merge_artifacts]


class AgentStatePayload(TypedDict):
    """Serialized agent state payload consumed by the frontend."""

    todos: list
    files: dict
    artifacts: list[str]
    subagent_runs: list[dict]
    token_usage: dict | None

```

### Core Architecture Module: `backend/package/yuxi/agents/toolkits/utils.py`
```
import traceback
from typing import Any

from yuxi.utils import logger


def get_tool_info(tools) -> list[dict[str, Any]]:
    """获取所有工具的信息（用于前端展示）"""
    tools_info = []

    try:
        # 获取注册的工具信息
        for tool_obj in tools:
            try:
                metadata = getattr(tool_obj, "metadata", {}) or {}
                info = {
                    "id": tool_obj.name,
                    "name": metadata.get("name", tool_obj.name),
                    "description": tool_obj.description,
                    "metadata": metadata,
                    "args": [],
                    # "is_async": is_async  # Include async information
                }

                if hasattr(tool_obj, "args_schema") and tool_obj.args_schema:
                    if isinstance(tool_obj.args_schema, dict):
                        schema = tool_obj.args_schema
                    else:
                        schema = tool_obj.args_schema.schema()

                    for arg_name, arg_info in schema.get("properties", {}).items():
                        info["args"].append(
                            {
                                "name": arg_name,
                                "type": arg_info.get("type", ""),
                                "description": arg_info.get("description", ""),
                            }
                        )

                tools_info.append(info)
                # logger.debug(f"Successfully processed tool info for {tool_obj.name}")

            except Exception as e:
                logger.error(
                    f"Failed to process tool {getattr(tool_obj, 'name', 'unknown')}: {e}\n{traceback.format_exc()}. "
                    f"Details: {dict(tool_obj.__dict__)}"
                )
                continue

    except Exception as e:
        logger.error(f"Failed to get tools info: {e}\n{traceback.format_exc()}")
        return []

    logger.info(f"Successfully extracted info for {len(tools_info)} tools")
    return tools_info

```

### Core Architecture Module: `backend/package/yuxi/knowledge/chunking/ragflow_like/utils/md_parser_utils.py`
```
from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from .semantic_utils import semantic_chunking_with_auto_clusters


def infer_heading_level(title: str) -> int:
    """
    根据标题文本推断其层级级别（1-6级）。

    逻辑说明：
    1. 数字序号推断：
       - 匹配如 "1.", "1.1", "1.2.3" 等格式。
       - 根据点号分隔的数量确定层级，例如 "1.1" 为 2 级，"1.2.3" 为 3 级。
       - 层级限制在 1-6 之间。
    2. 中文序号推断：
       - 匹配如 "一、", "二." 等中文数字序号。
       - 统一归类为 1 级标题。
    3. 默认处理：
       - 若不匹配以上规则，默认返回 1 级。
    """
    m = re.match(r"^\s*(\d+(?:\.\d+)*)[.)、]?\s*", title)
    if m:
        return max(1, min(len(m.group(1).split(".")), 6))
    m_zh = re.match(r"^\s*[一二三四五六七八九十百千]+[、.]\s*", title)
    if m_zh:
        return 1
    return 1


def get_title_path(stack: list[str]) -> str:
    """
    根据标题栈生成标题路径，用"|"分隔。
    """
    return "|".join([t for t in stack if t])


def extract_table_block(tokens: list[Any], i: int, original_lines: list[str]) -> tuple[int, str]:
    """
    从token流和原始文本中提取完整的表格块。

    逻辑说明：
    1. 定位起始：通过当前 token (i) 的 `map` 属性获取表格在原始行中的起始行号 `table_start`。
    2. 查找结束 token：遍历后续 tokens 直到找到 `table_close`。
    3. 确定结束行号 (`table_end`)：
       - 优先使用 `table_close` token 的 `map` 属性。
       - 若不存在，则尝试查找下一个带有 `map` 信息的 token 的起始行作为当前表格的结束。
       - 若上述均失败（如文件末尾或解析异常），则回退到基于文本内容的启发式扫描：
         从 `table_start` 开始向下扫描，直到遇到不符合 Markdown 表格特征（不以 '|' 开头且不含 '|'）的行为止。
    4. 返回结果：返回 `table_close` 的索引 `j` 以及拼接后的表格原始字符串。
    """
    token = tokens[i]
    table_start = token.map[0] if token.map else 0
    j = i + 1
    while j < len(tokens) and tokens[j].type != "table_close":
        j += 1
    if j < len(tokens):
        end_token = tokens[j]
        if end_token.map and end_token.map[1] is not None:
            table_end = end_token.map[1]
        else:
            table_end = None
            for k in range(j + 1, len(tokens)):
                if tokens[k].map and tokens[k].map[0] is not None:
                    table_end = tokens[k].map[0]
                    break
            if table_end is None:
                table_end = table_start + 1
                for line_idx in range(table_start, len(original_lines)):
                    line = original_lines[line_idx].strip()
                    if not line or not (line.startswith("|") or "|" in line):
                        table_end = line_idx
                        break
    else:
        table_end = table_start + 1
        for line_idx in range(table_start, len(original_lines)):
            line = original_lines[line_idx].strip()
            if not line or not (line.startswith("|") or "|" in line):
                table_end = line_idx
                break
    return j, "\n".join(original_lines[table_start:table_end])


def split_text_by_length_and_newline(
    text: str, max_length: int, embed_fn: Callable[[list[str]], Any] | None, token_count_fn: Callable[[str], int]
) -> list[str]:
    """
    层次化文本切分策略。
    """
    chunks = []

    paragraphs = text.split("\n\n")

    for paragraph in paragraphs:
        paragraph = paragraph.strip()
        if not paragraph:
            continue

        paragraph_token_count = token_count_fn(paragraph)

        # 如果当前段落长度未超过最大 Token 数量，直接作为独立分块放入chunks
        # 否则继续尝试按行切分
        if paragraph_token_count <= max_length:
            chunks.append(paragraph)
            continue

        # 把段落进一步使用换行符进行切分为行
        lines = paragraph.split("\n")
        current_chunk_lines = []
        current_chunk_tokens = 0

        for line in lines:
            line = line.strip()
            if not line:  # 跳过空行
                continue

            line_token_count = token_count_fn(line)  # 计算当前行的 Token 数量
            # 为了考虑行之间的空格，需要在计算 Token 数量时加 1（如果当前行不是第一行，需要添加一个换行符的Token数量）
            added_tokens = line_token_count + (1 if current_chunk_lines else 0)
            # 如果当前行的 Token 数量超过最大 Token 数量，直接作为独立分块放入chunks
            if line_token_count > max_length:
                if current_chunk_lines:
                    chunks.append("\n".join(current_chunk_lines))
                    current_chunk_lines = []
                    current_chunk_tokens = 0

                sub_chunks = semantic_chunking_with_auto_clusters(
                    line, embed_fn=embed_fn, token_count_fn=token_count_fn, max_chunk_size=max_length
                )
                chunks.extend(sub_chunks)
            # 如果当前行的 Token 数量与当前分块的 Token 数量合并后超过最大 Token 数量，直接作为独立分块放入chunks
            elif current_chunk_tokens + added_tokens > max_length:
                # 把之前的分块内容放入chunks
                chunks.append("\n".join(current_chunk_lines))
                # 重置当前分块为当前行的内容
                current_chunk_lines = [line]
                # 更新当前分块的 Token 数量
                current_chunk_tokens = line_token_count
            # 如果当前行的内容加入当前分块后不会超过最大 Token 数量，直接加入当前分块
            else:
                current_chunk_lines.append(line)
                current_chunk_tokens += added_tokens  # 更新当前分块的 Token 数量
        # 最后的收尾，把最后一行内容放入chunks
        if current_chunk_lines:
            chunks.append("\n".join(current_chunk_lines))

    return chunks

```

### Core Architecture Module: `backend/package/yuxi/knowledge/chunking/ragflow_like/utils/semantic_utils.py`
```
from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from sklearn.cluster import AgglomerativeClustering

_ENGLISH_ABBREVIATIONS = {
    "approx.",
    "dept.",
    "dr.",
    "e.g.",
    "etc.",
    "i.e.",
    "jr.",
    "mr.",
    "mrs.",
    "ms.",
    "no.",
    "prof.",
    "rev.",
    "sr.",
    "st.",
    "vs.",
}
_ENGLISH_TITLE_ABBREVIATIONS = {"dr.", "jr.", "mr.", "mrs.", "ms.", "prof.", "rev.", "sr.", "st."}
_ENGLISH_SENTENCE_STARTERS = {
    "he",
    "however",
    "i",
    "it",
    "meanwhile",
    "next",
    "she",
    "that",
    "then",
    "these",
    "this",
    "those",
    "they",
    "we",
    "you",
}


def semantic_chunking_with_auto_clusters(
    text: str,
    embed_fn: Callable[[list[str]], Any] | None,
    token_count_fn: Callable[[str], int],
    max_chunk_size: int = 512,
) -> list[str]:
    """
    对传入的文本进行语义切分，过程中会自动选择最佳的聚集数量。

    逻辑：
    - 先将文本中的句子按语言进行分发，英文/混合文本使用标准库分句，中文文本使用split_sentences_chinese。
    - 对每个句子进行嵌入向量化。
    - 确定最佳的聚类数量（根据轮廓系数）。
    - 对句子进行聚类后，按原文顺序遍历：当聚类标签变化或达到长度上限时切分，形成连续分块。
    - 如果嵌入模型缺失，则退化为原始切分方式
    """
    sentences = split_mixed_sentences(text)
    if len(sentences) < 2:
        return [text.strip()]

    # 计算每个句子的token数量
    sentence_token_counts = [token_count_fn(s) for s in sentences]
    total_tokens = sum(sentence_token_counts)

    # 如果没有提供向量化函数，或者整体未超长，则直接进行简单合并/返回
    if embed_fn is None or total_tokens <= max_chunk_size:
        chunks = []
        current_chunk = ""
        current_chunk_tokens = 0
        for s, cnt in zip(sentences, sentence_token_counts):
            if current_chunk_tokens + cnt > max_chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = s
                current_chunk_tokens = cnt
            else:
                current_chunk += s
                current_chunk_tokens += cnt
        if current_chunk:
            chunks.append(current_chunk.strip())
        return chunks

    # 向量化每个句子, 得到他们的嵌入向量
    embeddings = embed_fn(sentences)

    # 决定合适的聚集数量：超长时按上限向上取整，避免整除时多切一块
    best_k = (total_tokens + max_chunk_size - 1) // max_chunk_size
    best_k = min(best_k, len(sentences))

    # 根据指定的聚集数量、相似度判断方式、联动方式，对句子进行聚类
    # labels 是每个句子的聚类标签列表（如 [0,0,1,2,2]），后续会按原文顺序在标签变化处切分连续分块
    labels = AgglomerativeClustering(n_clusters=best_k, metric="cosine", linkage="average").fit_predict(embeddings)

    chunks = []
    current_chunk = ""
    current_chunk_tokens = 0
    current_label = labels[0]

    for sentence, label, token_count in zip(sentences, labels, sentence_token_counts):
        if label != current_label or current_chunk_tokens + token_count > max_chunk_size:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = sentence
            current_chunk_tokens = token_count
            current_label = label
        else:
            current_chunk += sentence
            current_chunk_tokens += token_count

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def split_mixed_sentences(text: str) -> list[str]:
    """
    处理中英文混合文本的分句逻辑，支持按物理段落分发不同的分句策略。

    该函数采用“分而治之”的策略来处理复杂的混合文本：
    1. **物理分块**：首先按换行符 (`\\n+`) 将原始文本切分为多个物理段落（chunks），确保物理结构不被破坏。
    2. **语言检测与分发**：
       - **英文/混合路径**：若段落中包含英文字母 (`[A-Za-z]`)，则视为英文或混合文本，
         使用标准库按句末标点分句，并保留常见英文缩写、数字和引号边界。
       - **中文路径**：若段落不含字母，则视为纯中文文本，调用 `split_sentences_chinese`。
         该方法通过正则精准匹配中文标点及后续引号。
       - **兜底方案**：若上述方法未产生结果，则使用简单的正则表达式按中文标点强制分割。
    3. **清洗与过滤**：汇总所有子句，去除两端空白字符，并过滤掉空字符串。

    Args:
        text: 待分句的原始字符串。

    Returns:
        List[str]: 分割后的句子列表。
    """
    chunks = re.split(r"(\n+)", text)
    sentences = []

    for ch in chunks:
        if not ch.strip():
            continue
        if re.search(r"[A-Za-z]", ch):
            parts = _split_english_sentences(ch)
            sentences.extend([p.strip() for p in parts if p.strip()])
        else:
            sents = split_sentences_chinese(ch)
            if sents:
                sentences.extend([s.strip() for s in sents if s.strip()])
            else:
                parts = re.split(r"(?<=[。！？])", ch)
                sentences.extend([p.strip() for p in parts if p.strip()])
    return sentences


def split_sentences_chinese(text: str) -> list[str]:
    """
    使用正则表达式将中文文本分割成句子。

    逻辑：
    - 匹配中文句号、感叹号、问号（。！？）作为分隔点。
    - 使用正向/反向预查处理引号：确保如果标点后面紧跟引号（”’"），该引号会被保留在当前句子末尾，而不是被切分到下一句。
    - 返回去除两端空格且非空的句子列表。
    """
    pattern = r'(?<=[。！？][”’"])|(?<=[。！？])(?![”’"])'
    sentences = re.split(pattern, text)
    return [s.strip() for s in sentences if s.strip()]


def _split_english_sentences(text: str) -> list[str]:
    """使用标准库按英文句末标点分句，并保留常见缩写。"""
    sentences: list[str] = []
    start = 0
    index = 0
    closing_chars = "\"'”’)]}"

    while index < len(text):
        if text[index] not in ".!?。！？":
            index += 1
            continue

        punctuation_end = index + 1
        while punctuation_end < len(text) and text[punctuation_end] in ".!?。！？":
            punctuation_end += 1
        boundary_end = punctuation_end
        while boundary_end < len(text) and text[boundary_end] in closing_chars:
            boundary_end += 1

        is_boundary = boundary_end == len(text) or text[boundary_end].isspace()
        if text[index] == "." and _is_english_abbreviation(text, start, index):
            is_boundary = False
        if is_boundary:
            sentence = text[start:boundary_end].strip()
            if sentence:
                sentences.append(sentence)
            start = boundary_end
        index = boundary_end

    remainder = text[start:].strip()
    if remainder:
        sentences.append(remainder)
    return sentences


def _is_english_abbreviation(text: str, start: int, punctuation: int) -> bool:
    """判断句点是否属于常见英文缩写或单字母首字母。"""
    prefix = text[start : punctuation + 1].rstrip()
    match = re.search(r"([A-Za-z](?:[A-Za-z.]*)\.)$", prefix)
    if match is None:
        return False

    token = match.group(1).lower()
    letters = token.replace(".", "")
    if token in _ENGLISH_TITLE_ABBREVIATIONS:
        return True
    next_index = punctuation + 1
    while next_index < len(text) and text[next_index].isspace():
        next_index += 1
    next_character = text[next_index] if next_index < len(text) else ""
    if token in _ENGLISH_ABBREVIATIONS:
        return bool(next_character) and next_character.islower()
    if len(letters) == 1:
        return True
    if re.fullmatch(r"(?:[A-Z]\.){2,}", match.group(1)):
        next_word = re.match(r"[A-Za-z]+", text[next_index:])
        return next_word is not None and next_word.group(0).lower() not in _ENGLISH_SENTENCE_STARTERS
    if re.fullmatch(r"(?:[a-z]\.){2,}", token):
        return next_index == len(text) or text[next_index].islower()
    return False

```

### Core Architecture Module: `backend/package/yuxi/knowledge/chunking/ragflow_like/utils/table_utils.py`
```
from __future__ import annotations

from bs4 import BeautifulSoup


def html_table_to_key_value(html: str) -> list[str]:
    """
    将HTML表格转换为键值对格式的列表，为了应对过长的表格的切分问题。

    处理逻辑：
    1. **网格重建**：由于 HTML 表格可能包含 `rowspan` 和 `colspan`（合并单元格），
       函数首先构建一个完整的二维网格（grid）。
    2. **单元格展开**：遍历 HTML 行和列，遇到合并单元格时，将其内容填充到网格中受影响的所有坐标点。
       这确保了原本被合并的区域在逻辑网格中每个点都有对应的值。
    3. **键值对转换**：
       - 将网格的第一行视为表头（Key）。
       - 从第二行开始，将每一行与表头对应，生成 "键：值" 形式的字符串。

    例如：
    - 输入：HTML表格，包含姓名、年龄、性别三列。
    - 输出：['姓名：张三；年龄：25；性别：男', '姓名：李四；年龄：30；性别：女']
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        return []

    rows = table.find_all("tr")
    if not rows:
        return []

    grid = []

    for r_idx, row in enumerate(rows):
        while len(grid) <= r_idx:
            grid.append([])

        cells = row.find_all(["td", "th"])
        c_idx = 0

        for cell in cells:
            while c_idx < len(grid[r_idx]) and grid[r_idx][c_idx] is not None:
                c_idx += 1

            text = cell.get_text(strip=True)
            rowspan = int(cell.get("rowspan", 1))
            colspan = int(cell.get("colspan", 1))

            for r in range(rowspan):
                target_r = r_idx + r
                while len(grid) <= target_r:
                    grid.append([])

                for c in range(colspan):
                    target_c = c_idx + c
                    while len(grid[target_r]) <= target_c:
                        grid[target_r].append(None)
                    grid[target_r][target_c] = text
            c_idx += colspan

    if not grid:
        return []

    headers = grid[0]
    headers = [h if h is not None else "" for h in headers]

    kv_lines = []
    for row_values in grid[1:]:
        min_len = min(len(headers), len(row_values))
        row_parts = []
        for i in range(min_len):
            key = headers[i]
            val = row_values[i] if row_values[i] is not None else ""
            if key:
                row_parts.append(f"{key}：{val}")
        if row_parts:
            kv_lines.append("；".join(row_parts) + "；")

    return kv_lines

```

### Core Architecture Module: `backend/package/yuxi/knowledge/graphs/graph_utils.py`
```
"""图谱构建相关的纯函数工具集。

将数据变换逻辑从 MilvusGraphService 中抽离，
使 service 类专注于 I/O 和业务编排。
"""

from __future__ import annotations

from typing import Any

from yuxi.utils import hashstr


def normalize_entity_name(text: str) -> str:
    """统一实体名称：去首尾空白、小写化、压缩内部连续空白。"""
    return " ".join(text.strip().lower().split())


def compute_entity_id(kb_id: str, normalized_name: str, label: str) -> str:
    return hashstr(f"{kb_id}:{normalized_name}:{label}", length=32)


def compute_triple_id(
    kb_id: str,
    source_normalized_name: str,
    source_label: str,
    relation_type: str,
    target_normalized_name: str,
    target_label: str,
) -> str:
    return hashstr(
        f"{kb_id}:{source_normalized_name}:{source_label}:{relation_type}:{target_normalized_name}:{target_label}",
        length=32,
    )


def graph_entity_collection_name(kb_id: str) -> str:
    return f"{kb_id}_entity"


def graph_triple_collection_name(kb_id: str) -> str:
    return f"{kb_id}_triple"


def build_graph_payload(normalized_result: dict[str, Any]) -> dict[str, Any]:
    """将抽取器产出的标准化结果转换为 Neo4j 写入所需的图结构。

    返回的 entities 已完成去重合并：同名同 label 的实体只保留一份，
    属性（attributes）取并集。
    """
    entities: list[dict[str, Any]] = []
    entity_by_key: dict[tuple[str, str], dict[str, Any]] = {}

    def add_entity(entity: dict[str, Any]) -> str:
        key = (normalize_entity_name(entity["text"]), entity.get("label") or "Entity")
        existing = entity_by_key.get(key)
        if existing is not None:
            known_attributes = {(attr["text"], attr["label"]) for attr in existing.get("attributes") or []}
            for attribute in entity.get("attributes") or []:
                attribute_key = (attribute["text"], attribute["label"])
                if attribute_key not in known_attributes:
                    existing.setdefault("attributes", []).append(attribute)
                    known_attributes.add(attribute_key)
            return existing["id"]

        graph_entity = {
            "id": f"e{len(entities) + 1}",
            "text": entity["text"],
            "label": entity.get("label") or "Entity",
            "attributes": list(entity.get("attributes") or []),
        }
        entities.append(graph_entity)
        entity_by_key[key] = graph_entity
        return graph_entity["id"]

    for entity in normalized_result["entities"]:
        add_entity(entity)

    relations = []
    for relation in normalized_result["relations"]:
        relations.append(
            {
                "source": add_entity(relation["source"]),
                "target": add_entity(relation["target"]),
                "text": relation["text"],
                "label": relation.get("label") or "RELATED_TO",
            }
        )

    return {"entities": entities, "relations": relations, "metadata": normalized_result["metadata"]}


# ─── Cypher 模板 ────────────────────────────────────────────────
# 将大段 Cypher 字符串集中管理，提升 write_chunk_graph 的可读性。


def cypher_merge_chunk(db_label: str) -> str:
    """MERGE Chunk 节点并写入元数据。"""
    return f"""
    MERGE (c:Chunk:MilvusKB:`{db_label}` {{chunk_id: $chunk_id}})
    SET c.file_id = $file_id,
        c.kb_id = $kb_id,
        c.chunk_index = $chunk_index,
        c.content_preview = $content_preview,
        c.start_char_pos = $start_char_pos,
        c.end_char_pos = $end_char_pos
    """


def cypher_merge_entity_mention(db_label: str) -> str:
    """MERGE Entity 节点并创建 Chunk → Entity 的 MENTIONS 关系。"""
    return f"""
    MATCH (c:Chunk:MilvusKB:`{db_label}` {{chunk_id: $chunk_id}})
    MERGE (e:Entity:MilvusKB:`{db_label}` {{
        kb_id: $kb_id,
        normalized_name: $normalized_name,
        label: $entity_label
    }})
    SET e.entity_id = $entity_id,
        e.name = $name,
        e.attributes = $attributes
    MERGE (c)-[m:MENTIONS {{chunk_id: $chunk_id, file_id: $file_id, kb_id: $kb_id}}]->(e)
    """


def cypher_merge_relation(db_label: str) -> str:
    """MERGE 两个 Entity 之间的 RELATION 边。"""
    return f"""
    MATCH (source:Entity:MilvusKB:`{db_label}` {{
        kb_id: $kb_id,
        normalized_name: $source_name,
        label: $source_label
    }})
    MATCH (target:Entity:MilvusKB:`{db_label}` {{
        kb_id: $kb_id,
        normalized_name: $target_name,
        label: $target_label
    }})
    MERGE (source)-[r:RELATION {{
        kb_id: $kb_id,
        chunk_id: $chunk_id,
        source_name: $source_name,
        target_name: $target_name,
        type: $relation_type
    }}]->(target)
    SET r.triple_id = $triple_id,
        r.text = $text,
        r.file_id = $file_id,
        r.extractor_type = $extractor_type
    """

```

### Core Architecture Module: `backend/package/yuxi/knowledge/parser/zip_utils.py`
```
import asyncio
import os
import re
import time
import zipfile
from pathlib import Path

from yuxi.knowledge.utils.kb_utils import build_kb_image_proxy_url
from yuxi.storage.minio import get_minio_client
from yuxi.utils import logger

DEFAULT_IMAGE_BUCKET = "kb-images"
DEFAULT_IMAGE_PREFIX = "unknown/kb-images"


def _normalize_object_prefix(prefix: str | None) -> str:
    normalized = (prefix or DEFAULT_IMAGE_PREFIX).strip("/")
    return normalized or DEFAULT_IMAGE_PREFIX


async def process_zip_file(
    zip_path: str,
    image_bucket: str = DEFAULT_IMAGE_BUCKET,
    image_prefix: str = DEFAULT_IMAGE_PREFIX,
) -> str:
    """
    处理ZIP文件，提取markdown内容和图片

    Args:
        zip_path: ZIP文件路径
        image_bucket: 图片上传的目标 bucket
        image_prefix: 图片上传对象前缀

    Returns:
        str: 处理后的 Markdown 文本。
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if name.startswith("/") or name.startswith("\\"):
                raise ValueError(f"ZIP 包含不安全路径: {name}")
            if ".." in Path(name).parts:
                raise ValueError(f"ZIP 路径包含上级引用: {name}")

        md_files = [n for n in zf.namelist() if n.lower().endswith(".md")]
        if not md_files:
            raise ValueError("压缩包中未找到 .md 文件")

        md_file = next((n for n in md_files if Path(n).name == "full.md"), md_files[0])

        with zf.open(md_file) as f:
            markdown_content = f.read().decode("utf-8")

        images_info = []
        images_dir = find_images_directory(zf, md_file)
        normalized_prefix = _normalize_object_prefix(image_prefix)

        if images_dir:
            images_info = await process_images(
                zf,
                images_dir,
                image_bucket=image_bucket,
                image_prefix=normalized_prefix,
            )
            markdown_content = replace_image_links(markdown_content, images_info)

    return markdown_content


def process_zip_file_sync(
    zip_path: str,
    image_bucket: str = DEFAULT_IMAGE_BUCKET,
    image_prefix: str = DEFAULT_IMAGE_PREFIX,
) -> str:
    """同步调用 ZIP 处理，供同步解析器使用。"""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(process_zip_file(zip_path, image_bucket=image_bucket, image_prefix=image_prefix))

    result: str | None = None
    error: Exception | None = None

    def runner() -> None:
        nonlocal result, error
        try:
            result = asyncio.run(process_zip_file(zip_path, image_bucket=image_bucket, image_prefix=image_prefix))
        except Exception as exc:  # pragma: no cover - pass through outer raise
            error = exc

    import threading

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    thread.join()

    if error is not None:
        raise error

    if result is None:
        raise RuntimeError("ZIP 处理失败: 未返回结果")

    return result


def find_images_directory(zip_file: zipfile.ZipFile, md_file_path: str) -> str | None:
    """查找images目录"""
    md_parent = Path(md_file_path).parent

    candidates = []
    if str(md_parent) != ".":
        candidates.extend([str(md_parent / "images"), str(md_parent.parent / "images")])
    candidates.append("images")

    for cand in candidates:
        cand_clean = cand.rstrip("/")
        if any(n.startswith(cand_clean + "/") for n in zip_file.namelist()):
            return cand_clean

    return None


async def process_images(
    zip_file: zipfile.ZipFile,
    images_dir: str,
    image_bucket: str,
    image_prefix: str,
) -> list[dict]:
    """处理图片：上传到MinIO并返回信息"""
    supported_extensions = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}

    images = []
    image_names = [n for n in zip_file.namelist() if n.startswith(images_dir + "/")]
    normalized_prefix = _normalize_object_prefix(image_prefix)

    minio_client = get_minio_client()
    await asyncio.to_thread(minio_client.ensure_bucket_exists, image_bucket)

    for img_name in image_names:
        suffix = Path(img_name).suffix.lower()
        if suffix not in supported_extensions:
            continue

        try:
            with zip_file.open(img_name) as f:
                data = f.read()

            timestamp = int(time.time() * 1000000)
            object_name = f"{normalized_prefix}/{timestamp}_{Path(img_name).name}"

            await minio_client.aupload_file(
                bucket_name=image_bucket,
                object_name=object_name,
                data=data,
            )

            img_info = {
                "name": Path(img_name).name,
                "url": build_kb_image_proxy_url(object_name),
                "path": f"images/{Path(img_name).name}",
            }
            images.append(img_info)

            logger.debug(f"图片上传成功: {Path(img_name).name} -> {img_info['url']}")

        except Exception as e:
            logger.error(f"上传图片失败 {Path(img_name).name}: {e}")
            continue

    return images


def replace_image_links(markdown_content: str, images: list[dict]) -> str:
    """替换markdown中的图片链接为MinIO URL"""
    if not images:
        return markdown_content

    image_map = {}
    for img in images:
        path = img["path"]
        url = img["url"]
        image_map[path] = url
        image_map[f"/{path}"] = url
        image_map[img["name"]] = url

    def replace_link(match):
        alt_text = match.group(1) or ""
        img_path = match.group(2)

        for pattern, url in image_map.items():
            if img_path.endswith(pattern) or img_path == pattern:
                return f"![{alt_text}]({url})"

        filename = os.path.basename(img_path)
        if filename in image_map:
            return f"![{alt_text}]({image_map[filename]})"

        return match.group(0)

    pattern = r"!\[([^\]]*)\]\(([^)]+)\)"
    return re.sub(pattern, replace_link, markdown_content)

```

### Core Architecture Module: `backend/package/yuxi/knowledge/utils/__init__.py`
```
"""知识库工具模块。"""

from .kb_utils import (
    calculate_content_hash,
    is_minio_url,
    merge_processing_params,
    params_for_uploaded_document,
    parse_minio_url,
    prepare_item_metadata,
    resolve_processing_params,
    sanitize_processing_params,
)

__all__ = [
    "calculate_content_hash",
    "is_minio_url",
    "merge_processing_params",
    "params_for_uploaded_document",
    "parse_minio_url",
    "prepare_item_metadata",
    "resolve_processing_params",
    "sanitize_processing_params",
]

```

### Core Architecture Module: `backend/package/yuxi/knowledge/utils/kb_utils.py`
```
import hashlib
import time
from urllib.parse import quote

from yuxi.knowledge.chunking.ragflow_like.presets import resolve_chunk_processing_params
from yuxi.utils import hashstr, logger
from yuxi.utils.datetime_utils import utc_isoformat

_DROPPED_PROCESSING_PARAM_KEYS = {
    "_preprocessed_map",
    "auto_index",
    "content_hashes",
    "file_sizes",
    "enable_ocr",
    "ocr_engine_config",
}


def sanitize_processing_params(params: dict | None) -> dict | None:
    """移除不应写入单文件元数据的参数。"""
    if not params:
        return None

    return {key: value for key, value in params.items() if key not in _DROPPED_PROCESSING_PARAM_KEYS}


def params_for_uploaded_document(item: str, params: dict) -> dict:
    """将批量上传参数收敛为单个文档的处理参数。"""
    source_paths = params.get("source_paths")
    item_params = dict(params)
    item_params.pop("source_paths", None)
    if isinstance(source_paths, dict) and source_paths.get(item):
        item_params["source_path"] = source_paths[item]
    return item_params


def resolve_processing_params(
    kb_additional_params: dict | None,
    file_processing_params: dict | None,
    request_params: dict | None = None,
) -> dict:
    """合并文件、请求中的 OCR 和分块参数。"""

    merged_params = sanitize_processing_params(merge_processing_params(file_processing_params, request_params)) or {}
    chunk_params = resolve_chunk_processing_params(
        kb_additional_params=kb_additional_params,
        file_processing_params=file_processing_params,
        request_params=request_params,
    )
    merged_params.update(chunk_params)
    return merged_params


async def calculate_content_hash(data: bytes | bytearray) -> str:
    """计算文件内容的 SHA-256 哈希值。"""
    sha256 = hashlib.sha256()
    sha256.update(data)
    return sha256.hexdigest()


async def prepare_item_metadata(item: str, content_type: str, kb_id: str, params: dict | None = None) -> dict:
    """
    准备 MinIO 文件元数据；URL 导入需先通过 fetch-url 预处理为 MinIO 文件。

    Args:
        item: MinIO URL
        content_type: 内容类型，目前仅支持 "file"
        kb_id: 数据库ID
        params: 处理参数，可选
    """
    # 检查是否有预处理信息 (针对 URL 转 HTML 文件的情况)
    if params and "_preprocessed_map" in params and item in params["_preprocessed_map"]:
        pre_info = params["_preprocessed_map"][item]

        # 使用预处理信息
        filename = pre_info.get("filename", item)  # 通常是原始 URL

        # 截断文件名以适应数据库限制 (512 chars)，保留部分后缀信息如果可能
        if len(filename) > 500:
            filename_display = filename[:400] + "..." + filename[-90:]
        else:
            filename_display = filename

        file_type = "html"  # 强制转换为 html 类型，以便后续作为文件处理
        item_path = pre_info["path"]  # MinIO path
        content_hash = pre_info["content_hash"]

        # 使用 item(url) 生成 ID，保证同一 URL 即使多次添加 ID 也不同（配合 time）
        # 或者我们应该基于 hash？不，基于 time 更符合上传逻辑
        file_id = f"file_{hashstr(item + str(time.time()), 6)}"

        metadata = {
            "kb_id": kb_id,
            "filename": filename_display,
            "path": item_path,
            "file_type": file_type,
            "status": "indexing",
            "created_at": utc_isoformat(),
            "file_id": file_id,
            "content_hash": content_hash,
            "size": pre_info.get("file_size"),
            "parent_id": params.get("parent_id"),
        }

        if params:
            safe_params = sanitize_processing_params(params) or {}
            # 覆盖 content_type 为 file，确保后续解析走文件流程（MinIO 下载 -> HTML 解析）
            # 而不是再次尝试作为 URL 抓取
            safe_params["content_type"] = "file"
            safe_params["original_source"] = item  # 保存完整 URL 到 JSON 字段，避免数据库字段长度限制
            metadata["processing_params"] = safe_params

        return metadata

    if content_type == "file":
        if not is_minio_url(item):
            raise ValueError(f"File source must be a MinIO URL: {item}")

        logger.debug(f"Processing MinIO file: {item}")
        _, object_name = parse_minio_url(item)
        filename = object_name.rsplit("/", 1)[-1]

        import re

        timestamp_pattern = r"^(.+)_(\d{13})(\.[^.]+)$"
        match = re.match(timestamp_pattern, filename)
        filename_display = match.group(1) + match.group(3) if match else filename
        source_path = _normalize_source_path(params.get("source_path")) if params else None
        if source_path:
            filename_display = source_path

        file_type = filename_display.rsplit(".", 1)[-1].lower() if "." in filename_display else ""
        item_path = item

        content_hash = None
        if params and "content_hashes" in params and isinstance(params["content_hashes"], dict):
            content_hash = params["content_hashes"].get(item)

        if not content_hash:
            raise ValueError(f"Missing content_hash for file: {item}")

        file_sizes = params.get("file_sizes") if params else None
        if not isinstance(file_sizes, dict):
            file_sizes = {}
        file_size = file_sizes.get(item)
        file_id = f"file_{hashstr(str(item_path) + str(time.time()), 6)}"

    else:
        raise ValueError(f"Unsupported content_type: {content_type}")

    metadata = {
        "kb_id": kb_id,
        "filename": filename_display,  # 使用显示用的文件名
        "path": item_path,
        "file_type": file_type,
        "status": "indexing",
        "created_at": utc_isoformat(),
        "file_id": file_id,
        "content_hash": content_hash,
        "size": file_size,
        "parent_id": params.get("parent_id") if params else None,
    }

    # 保存处理参数到元数据
    if params:
        metadata["processing_params"] = sanitize_processing_params(params)

    return metadata


def _normalize_source_path(value: object) -> str | None:
    """归一化客户端传入的上传源路径，仅用于知识库文件树中的展示文件名。

    source_path 用来保留 CLI 目录上传时的相对层级。这里不会把它当作真实
    存储路径使用：反斜杠会转成斜杠，开头的 "./" 会被去掉，绝对路径和
    ".." 父目录跳转会被拒绝。
    """
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if not normalized or normalized.startswith("/"):
        return None
    parts = [part for part in normalized.split("/") if part and part != "."]
    if not parts or any(part == ".." for part in parts):
        return None
    display_path = "/".join(parts)
    if len(display_path) > 512:
        raise ValueError("source_path is too long")
    return display_path


def merge_processing_params(metadata_params: dict | None, request_params: dict | None) -> dict:
    """
    合并处理参数：优先使用请求参数，缺失时使用元数据中的参数

    Args:
        metadata_params: 元数据中保存的参数
        request_params: 请求中提供的参数

    Returns:
        dict: 合并后的参数
    """
    merged_params = {}

    # 首先使用元数据中的参数作为默认值
    if metadata_params:
        merged_params.update(metadata_params)

    # 然后使用请求参数覆盖（如果提供）
    if request_params:
        merged_params.update(request_params)

    logger.debug(
        "Merged processing params: "
        f"metadata_keys={list(metadata_params.keys()) if metadata_params else []}, "
        f"request_keys={list(request_params.keys()) if request_params else []}, "
        f"merged_keys={list(merged_params.keys())}"
    )
    return merged_params


def build_kb_image_proxy_url(object_name: str) -> str:
    """构建知识库图片的后端鉴权代理 URL。

    图片存放在私有 bucket，前端通过该 URL 请求后端鉴权后读取图片。
    对象名格式为 ``{kb_id}/kb-images/{timestamp}_{filename}``，kb_id 即首段；
    路径参数只保留 ``kb-images/...`` 部分（保留斜杠、编码其余字符）。
    """
    kb_id, separator, relative_path = object_name.partition("/")
    if not kb_id or not separator or not relative_path.startswith("kb-images/"):
        raise ValueError("知识库图片对象名必须符合 {kb_id}/kb-images/{filename} 格式")
    return f"/api/knowledge/databases/{kb_id}/images/{quote(relative_path, safe='/')}"


def is_minio_url(file_path: str) -> bool:
    """检测是否是本系统生成的 MinIO 存储 URL。"""
    from urllib.parse import urlparse

    parsed_url = urlparse(file_path)
    if parsed_url.scheme == "minio":
        return bool(parsed_url.netloc and parsed_url.path.lstrip("/"))

    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        return False

    path_parts = parsed_url.path.lstrip("/").split("/", 1)
    if len(path_parts) != 2:
        return False

    from yuxi.storage.minio.client import MinIOClient

    known_buckets = set(MinIOClient.KB_BUCKETS.values()) | MinIOClient.PUBLIC_READ_BUCKETS
    return path_parts[0] in known_buckets


def parse_minio_url(file_path: str) -> tuple[str, str]:
    """
    解析MinIO URL，提取bucket名称和对象名称

    支持标准 HTTP/HTTPS URL 格式：
    - http(s)://host/bucket-name/path/to/object

    Args:
        file_path: MinIO文件URL (http:// 或 https://)

    Returns:
        tuple[str, str]: (bucket_name, object_name)

    Raises:
        ValueError: 如果无法解析URL
    """
    try:
        from urllib.parse import unquote, urlparse

        # 解析URL
        parsed_url = urlparse(file_path)

        # 对于 minio:// 协议，bucket名称在netloc中
        if parsed_url.scheme == "minio":
            bucket_name = parsed_url.netloc
            object_name = unquote(parsed_url.path.lstrip("/"))
        else:
            # 对于 http/https 协议，bucket名称在path的第一部分
            object_name = parsed_url.path.lstrip("/")
            path_parts = object_name.split("/", 1)
            if len(path_parts) > 1:
                bucket_name = path_parts[0]
                object_name = unquote(path_parts[1])
            else:
                raise ValueError(f"无法解析MinIO URL中的bucket名称: {file_path}")

        logger.debug(f"Parsed MinIO URL: bucket_name={bucket_name}, object_name={object_name}")
        return bucket_name, object_name

    except Exception as e:
        logger.error(f"Failed to parse MinIO URL {file_path}: {e}")
        raise ValueError(f"无法解析MinIO URL: {file_path}")

```

### Core Architecture Module: `backend/package/yuxi/knowledge/utils/mindmap_utils.py`
```
"""思维导图工具函数。"""

import copy
import json
import textwrap
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException

from yuxi.config.options import system_options
from yuxi.knowledge.runtime import knowledge_base
from yuxi.models import select_model
from yuxi.repositories.knowledge_base_repository import KnowledgeBaseRepository
from yuxi.utils import logger

MINDMAP_FILE_PAGE_SIZE = 500
MINDMAP_GENERATION_FILE_LIMIT = 200

MINDMAP_SYSTEM_PROMPT = """你是一个专业的知识整理助手。

你的任务是分析用户提供的文件列表，生成一个层次分明的思维导图结构。

**核心规则：每个文件名只能出现一次！不允许重复！**

要求：
1. 思维导图要有清晰的层级结构（2-4层）
2. 根节点是知识库名称
3. 第一层是主要分类（如：技术文档、规章制度、数据资源等）
4. 第二层是子分类
5. **叶子节点必须是具体的文件名称**
6. **每个文件名在整个思维导图中只能出现一次，不得重复！**
7. 如果一个文件可能属于多个分类，只选择最合适的一个分类放置
8. 使用合适的emoji图标增强可读性
9. 返回JSON格式，遵循以下结构：

```json
{
  "content": "知识库名称",
  "children": [
    {
      "content": "🎯 主分类1",
      "children": [
        {
          "content": "子分类1.1",
          "children": [
            {"content": "文件名1.txt", "children": []},
            {"content": "文件名2.pdf", "children": []}
          ]
        }
      ]
    },
    {
      "content": "💻 主分类2",
      "children": [
        {"content": "文件名3.docx", "children": []},
        {"content": "文件名4.md", "children": []}
      ]
    }
  ]
}
```

**重要约束：**
- 每个文件名在整个JSON中只能出现一次
- 不要按多个维度分类导致文件重复
- 选择最主要、最合适的分类维度
- 每个叶子节点的children必须是空数组[]
- 分类名称要简洁明了
- 使用emoji增强视觉效果
"""

MINDMAP_INCREMENTAL_SYSTEM_PROMPT = """你是一个专业的知识整理助手。

你的任务是将新文件整合到已有的思维导图结构中。

**核心规则：**
1. 保留现有思维导图的分类结构不变
2. 将新文件添加到最合适的已有分类下
3. 如果新文件不属于任何现有分类，可以创建新的分类节点
4. 每个文件名只能出现一次，不允许重复
5. 如果已有分类名称需要微调以容纳新文件，可以适当调整
6. 返回完整的思维导图JSON（包含原有结构 + 新文件）

返回JSON格式同标准思维导图结构。
"""


def build_database_file_list(files: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "file_id": file_id,
            "filename": file_info.get("filename", ""),
            "type": file_info.get("type", ""),
            "status": file_info.get("status", ""),
            "created_at": file_info.get("created_at", ""),
        }
        for file_id, file_info in files.items()
    ]


def _file_record_to_mindmap_file(record: Any) -> dict[str, Any]:
    created_at = getattr(record, "created_at", None)
    return {
        "file_id": getattr(record, "file_id"),
        "filename": getattr(record, "filename", None) or "",
        "type": getattr(record, "file_type", None) or "",
        "status": getattr(record, "status", None) or "",
        "created_at": created_at.isoformat() if created_at else "",
    }


async def _list_mindmap_files_page(
    kb_id: str, *, page_size: int = MINDMAP_FILE_PAGE_SIZE
) -> tuple[dict[str, dict], int]:
    from yuxi.repositories.knowledge_file_repository import KnowledgeFileRepository

    records, total = await KnowledgeFileRepository().search_files(
        kb_id=kb_id,
        offset=0,
        limit=page_size,
        files_only=True,
    )
    return {record.file_id: _file_record_to_mindmap_file(record) for record in records}, total


async def _load_mindmap_current_files(kb_id: str, tracked_file_ids: list[str]) -> tuple[dict[str, dict], int]:
    from yuxi.repositories.knowledge_file_repository import KnowledgeFileRepository

    current_files, total = await _list_mindmap_files_page(kb_id)
    tracked_ids = [file_id for file_id in tracked_file_ids if file_id]
    if not tracked_ids:
        return current_files, total

    tracked_records = await KnowledgeFileRepository().list_by_file_ids(tracked_ids)
    for record in tracked_records:
        if record.kb_id == kb_id and not record.is_folder:
            current_files[record.file_id] = _file_record_to_mindmap_file(record)
    return current_files, total


def collect_mindmap_files(all_files: dict[str, dict[str, Any]], file_ids: list[str]) -> list[dict[str, str]]:
    return [
        {
            "filename": all_files[file_id].get("filename", ""),
            "type": all_files[file_id].get("type", ""),
        }
        for file_id in file_ids
        if file_id in all_files
    ]


def build_mindmap_user_message(db_name: str, files_info: list[dict[str, str]], user_prompt: str = "") -> str:
    files_text = "\n".join([f"- {file_info['filename']} ({file_info['type']})" for file_info in files_info])
    return textwrap.dedent(f"""请为知识库\"{db_name}\"生成思维导图结构。

        文件列表（共{len(files_info)}个文件）：
        {files_text}

        {f"用户补充说明：{user_prompt}" if user_prompt else ""}

        **重要提醒：**
        1. 这个知识库共有{len(files_info)}个文件
        2. 每个文件名只能在思维导图中出现一次
        3. 不要让同一个文件出现在多个分类下
        4. 为每个文件选择最合适的唯一分类

        请生成合理的思维导图结构。""")


def build_mindmap_incremental_user_message(
    db_name: str, mindmap_data: dict[str, Any], added_files: list[dict[str, str]], user_prompt: str = ""
) -> str:
    existing_structure = json.dumps(mindmap_data, ensure_ascii=False, indent=2)
    files_text = "\n".join([f"- {f['filename']} ({f['type']})" for f in added_files])
    return textwrap.dedent(f"""请将以下新文件整合到知识库\"{db_name}\"的现有思维导图中。

        现有思维导图结构：
        {existing_structure}

        新增文件列表（共{len(added_files)}个文件）：
        {files_text}

        {f"用户补充说明：{user_prompt}" if user_prompt else ""}

        **重要提醒：**
        1. 保留现有分类结构，将新文件添加到最合适的已有分类下
        2. 如果新文件不适合任何现有分类，创建新的分类节点
        3. 每个文件名只能出现一次
        4. 返回完整的思维导图JSON（包含原有结构 + 新文件）

        请整合新文件到现有结构中。""")


def parse_mindmap_content(content: str) -> dict[str, Any]:
    if "```json" in content:
        json_start = content.find("```json") + 7
        json_end = content.find("```", json_start)
        content = content[json_start:json_end].strip()
    elif "```" in content:
        json_start = content.find("```") + 3
        json_end = content.find("```", json_start)
        content = content[json_start:json_end].strip()

    mindmap_data = json.loads(content)
    if not isinstance(mindmap_data, dict) or "content" not in mindmap_data:
        raise ValueError("思维导图结构不正确")
    return mindmap_data


def detect_mindmap_changes(
    mindmap_data: dict[str, Any] | None,
    mindmap_file_ids: dict[str, str] | None,
    current_files: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """对比思维导图追踪的文件与知识库当前文件，返回变更信息。"""
    # 兼容旧数据：如果存在思维导图但缺少追踪的 file_ids，通过叶子节点反向重建映射
    if mindmap_data and not mindmap_file_ids:
        leaf_filenames = _collect_leaf_filenames(mindmap_data)
        mindmap_file_ids = {
            fid: info.get("filename", "")
            for fid, info in current_files.items()
            if info.get("filename", "") in leaf_filenames
        }

    if not mindmap_data or not mindmap_file_ids:
        added_files = [
            {"file_id": fid, "filename": info.get("filename", ""), "type": info.get("type", "")}
            for fid, info in current_files.items()
        ]
        return {
            "has_mindmap": mindmap_data is not None,
            "tracked_files": list(mindmap_file_ids.keys()) if mindmap_file_ids else [],
            "current_files": list(current_files.keys()),
            "added_files": added_files,
            "removed_file_ids": [],
            "unchanged_count": 0,
            "needs_update": len(added_files) > 0,
        }

    tracked_ids = set(mindmap_file_ids.keys())
    current_ids = set(current_files.keys())

    removed_file_ids = list(tracked_ids - current_ids)
    added_file_ids = current_ids - tracked_ids
    added_files = [
        {"file_id": fid, "filename": current_files[fid].get("filename", ""), "type": current_files[fid].get("type", "")}
        for fid in sorted(added_file_ids)
        if fid in current_files
    ]
    unchanged_count = len(tracked_ids & current_ids)

    return {
        "has_mindmap": True,
        "tracked_files": list(tracked_ids),
        "current_files": list(current_ids),
        "added_files": added_files,
        "removed_file_ids": removed_file_ids,
        "unchanged_count": unchanged_count,
        "needs_update": len(added_files) > 0 or len(removed_file_ids) > 0,
    }


def _prune_mindmap_node(node: dict[str, Any], removed_filenames: set[str], root_name: str) -> dict[str, Any] | None:
    """递归修剪思维导图节点，移除指定文件名的叶子节点。"""
    content = node.get("content", "")
    children = node.get("children", [])

    if not children:
        if content in removed_filenames:
            return None
        return node

    pruned_children = []
    for child in children:
        result = _prune_mindmap_node(child, removed_filenames, root_name)
        if result is not None:
            pruned_children.append(result)

    if not pruned_children:
        if content == root_name:
            node["children"] = []
            return node
        return None

    node["children"] = pruned_children
    return node


def remove_files_from_mindmap(mindmap_data: dict[str, Any], removed_filenames: set[str]) -> dict[str, Any]:
    """从思维导图树中移除指定文件名的叶子节点，无需 AI 调用。"""
    if not removed_filenames:
        return mindmap_data

    mindmap_copy = copy.deepcopy(mindmap_data)
    root_name = mindmap_copy.get("content", "")
    result = _prune_mindmap_node(mindmap_copy, removed_filenames, root_name)
    return result if result is not None else {"content": root_name, "children": []}


async def get_mindmap_database_files(kb_id: str) -> dict[str, Any]:
    kb = await KnowledgeBaseRepository().get_by_kb_id(kb_id)
    if kb is None:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    current_files, total = await _list_mindmap_files_page(kb_id)
    return {
        "message": "success",
        "kb_id": kb_id,
        "slug": kb_id,
        "db_name": kb.name,
        "files": build_database_file_list(current_files),
        "total": total,
        "truncated": total > len(current_files),
    }


async def get_mindmap_diff(kb_id: str) -> dict[str, Any]:
    """获取思维导图变更检测结果。"""
    kb = await KnowledgeBaseRepository().get_by_kb_id(kb_id)
    if kb is None:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    current_files, total = await _load_mindmap_current_files(kb_id, list((kb.mindmap_file_ids or {}).keys()))

    cha
```

### Core Architecture Module: `backend/package/yuxi/knowledge/utils/pdf_utils.py`
```
"""PDF 解析前置检查。

本模块在文档进入 MinerU、pypdf 等解析器之前，
先用 Yuxi 已有的 pypdfium2 依赖检查 PDF 页面树是否能逐页加载。
它只负责识别明显的 PDF 结构异常，例如页树中存在 null 页槽、非 Page 对象或循环引用；
不负责修复 PDF，也不能被当作内容 OCR 或页数统计的业务事实源。
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pypdfium2 as pdfium

from yuxi.knowledge.parser.base import DocumentParserException


@dataclass(slots=True)
class PDFPageLoadIssue:
    """PDF 页面加载异常位置。"""

    page_number: int
    message: str


def _format_page_numbers(page_numbers: list[int], *, limit: int = 8) -> str:
    """格式化页码列表，避免异常信息过长。"""

    visible = page_numbers[:limit]
    result = "、".join(str(page_number) for page_number in visible)
    if len(page_numbers) > limit:
        result = f"{result} 等 {len(page_numbers)} 个"
    return result


def validate_pdf_page_tree_loadable(file_path: str | Path) -> None:
    """校验 PDF 页树中的每一个页槽都能作为页面加载。"""

    path = Path(file_path)

    try:
        doc = pdfium.PdfDocument(str(path))
    except Exception as exc:  # noqa: BLE001
        # pypdfium2 打开加密 PDF 时抛 PdfiumError（消息含 password），无独立加密属性。
        if isinstance(exc, pdfium.PdfiumError) and "password" in str(exc).lower():
            raise DocumentParserException(
                "PDF 文件已加密或需要密码，无法进入文档解析流程",
                "pdf_preflight",
                "encrypted_pdf",
            ) from exc
        raise DocumentParserException(
            f"PDF 文件结构异常，无法打开页面目录: {exc}",
            "pdf_preflight",
            "invalid_pdf_structure",
        ) from exc

    try:
        page_count = len(doc)
        if page_count <= 0:
            raise DocumentParserException(
                "PDF 文件没有可解析页面",
                "pdf_preflight",
                "empty_pdf",
            )

        issues: list[PDFPageLoadIssue] = []
        for page_index in range(page_count):
            try:
                page = doc[page_index]
                # 访问页面尺寸会触发页面对象基础解析，能提前暴露 null/非 Page 页槽。
                _ = page.get_size()
            except Exception as exc:  # noqa: BLE001
                issues.append(PDFPageLoadIssue(page_number=page_index + 1, message=str(exc)))

        if issues:
            bad_pages = _format_page_numbers([issue.page_number for issue in issues])
            first_error = issues[0].message or "页面对象无法加载"
            raise DocumentParserException(
                "PDF 页面结构异常："
                f"声明页数为 {page_count}，但第 {bad_pages} 个页槽不是可加载页面对象。"
                f"底层错误：{first_error}。请先用 Acrobat、打印为 PDF、qpdf 或 mutool 等工具重写 PDF 后再上传。",
                "pdf_preflight",
                "invalid_pdf_page_tree",
            )
    finally:
        doc.close()

```

### Core Architecture Module: `backend/package/yuxi/knowledge/utils/sample_question_utils.py`
```
"""知识库示例问题生成工具。"""

import json
import textwrap
from typing import Any

from fastapi import HTTPException

from yuxi.config.options import system_options
from yuxi.knowledge.factory import KnowledgeBaseFactory
from yuxi.knowledge.runtime import knowledge_base
from yuxi.models import select_model
from yuxi.repositories.knowledge_base_repository import KnowledgeBaseRepository
from yuxi.utils import logger

SAMPLE_QUESTIONS_SYSTEM_PROMPT = """你是一个专业的知识库问答测试专家。

你的任务是根据知识库中的文件列表，生成有价值的测试问题。

要求：
1. 问题要具体、有针对性，基于文件名称和类型推测可能的内容
2. 问题要涵盖不同方面和难度
3. 问题要简洁明了，适合用于检索测试
4. 问题要多样化，包括事实查询、概念解释、操作指导等
5. 问题长度控制在10-30字之间
6. 直接返回JSON数组格式，不要其他说明

返回格式：
```json
{
  "questions": [
    "问题1？",
    "问题2？",
    "问题3？"
  ]
}
```
"""


def build_sample_question_file_list(files: dict[str, dict[str, Any]]) -> list[dict[str, str]]:
    return [
        {
            "filename": file_info.get("filename", ""),
            "type": file_info.get("type") or file_info.get("file_type", ""),
        }
        for file_info in files.values()
    ]


def build_sample_questions_user_message(db_name: str, files_info: list[dict[str, str]], count: int) -> str:
    files_text = "\n".join([f"- {file_info['filename']} ({file_info['type']})" for file_info in files_info[:20]])
    file_count_text = f"（共{len(files_info)}个文件）" if len(files_info) > 20 else ""

    return textwrap.dedent(f"""请为知识库\"{db_name}\"生成{count}个测试问题。

        知识库文件列表{file_count_text}：
        {files_text}

        请根据这些文件的名称和类型，生成{count}个有价值的测试问题。""")


def parse_sample_questions_content(content: str) -> list[str]:
    if "```json" in content:
        json_start = content.find("```json") + 7
        json_end = content.find("```", json_start)
        if json_end == -1:
            raise ValueError("AI返回的JSON代码块不完整")
        content = content[json_start:json_end].strip()
    elif "```" in content:
        json_start = content.find("```") + 3
        json_end = content.find("```", json_start)
        if json_end == -1:
            raise ValueError("AI返回的代码块不完整")
        content = content[json_start:json_end].strip()

    questions_data = json.loads(content)
    questions = questions_data.get("questions", []) if isinstance(questions_data, dict) else []
    if not questions or not isinstance(questions, list):
        raise ValueError("AI返回的问题格式不正确")
    return questions


async def generate_database_sample_questions(kb_id: str, count: int = 10) -> dict[str, Any]:
    db_info = await knowledge_base.get_database_info(kb_id, include_files=True)
    if not db_info:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    kb_type = db_info.kb_type.lower()
    if not KnowledgeBaseFactory.get_kb_class(kb_type).supports_documents:
        raise HTTPException(status_code=400, detail=f"{db_info.name or kb_type} 不支持基于文件生成测试问题")

    db_name = db_info.name
    all_files = db_info.files or {}
    if not all_files:
        raise HTTPException(status_code=400, detail="知识库中没有文件")

    files_info = build_sample_question_file_list(all_files)
    logger.info(f"开始生成知识库问题，知识库: {db_name}, 文件数量: {len(files_info)}, 问题数量: {count}")

    model = select_model(model_spec=(await system_options.get())["default_model"])
    messages = [
        {"role": "system", "content": SAMPLE_QUESTIONS_SYSTEM_PROMPT},
        {"role": "user", "content": build_sample_questions_user_message(db_name, files_info, count)},
    ]
    response = await model.call(messages, stream=False)
    content = response.content if hasattr(response, "content") else str(response)

    try:
        questions = parse_sample_questions_content(content)
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"AI返回的JSON解析失败: {e}, 原始内容: {content}")
        raise HTTPException(status_code=500, detail=f"AI返回格式错误: {str(e)}") from e

    logger.info(f"成功生成{len(questions)}个问题")

    saved = await KnowledgeBaseRepository().update(kb_id, {"sample_questions": questions})
    if saved is None:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")
    logger.info(f"成功保存 {len(questions)} 个问题到知识库 {kb_id}")

    return {
        "message": "success",
        "questions": questions,
        "count": len(questions),
        "kb_id": kb_id,
        "db_name": db_name,
    }


async def get_database_sample_questions(kb_id: str) -> dict[str, Any]:
    kb = await KnowledgeBaseRepository().get_by_kb_id(kb_id)
    if kb is None:
        raise HTTPException(status_code=404, detail=f"知识库 {kb_id} 不存在")

    questions = kb.sample_questions or []
    return {
        "message": "success",
        "questions": questions,
        "count": len(questions),
        "kb_id": kb_id,
    }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1078** (2026-09-28): **Question: CPU占用100%**
  *Symptoms*: 空闲中占用： CONTAINER ID   NAME                                                    CPU %     MEM USAGE / LIMIT    MEM %     NET I/O           BLOCK I/O         PIDS 350554679db3   yuxi-worker-1                                           7.46%     472.8MiB / 10.7GiB   4.32%     6.97MB / 20.8MB   49.2kB / 0B       139 71259ba3cb56   yuxi-web-1                                              16.07%    1.273GiB / 10.7GiB   11.90%    10.4MB / 109MB    318MB / 581MB     43 73103e8ba291   yuxi-api-1                                              0.74%     487.6MiB / 10.7GiB   4.45%     20.3MB / 8.97MB   69MB / 25.3MB     49 6a96fd1c8b74   yuxi-sandbox-provisioner-1                              1.34%     65.43MiB / 10.7GiB   0.60%     33.6kB / 21.7kB   22.7MB / 0B       10 febf02b9e8a9   yuxi-milvus-1                                           1.42%     128.6MiB / 10.7GiB   1.17%     3.15MB / 5MB      269MB / 3.23MB    35 116829e9576c   yuxi-postgres-1                                         0.74%     53.11MiB / 10.7GiB   0.48%     14MB / 17.8MB     51.5MB / 4.25MB   4 a9f0a05901f2   yuxi-redis-1                                            0.38%     7.152MiB / 10.7GiB   0.07%     54.8MB / 29.6MB   6.36MB / 0B       6 CONTAINER ID   NAME                                                    CPU %     MEM USAGE / LIMIT    MEM %     NET I/O           BLOCK I/O         PIDS 350554679db3   yuxi-worker-1                                           7.46%     472.8MiB / 10.7GiB   4.32%     6.97MB / 20.8MB   4

- **Issue #1062** (2026-09-23): **[bug] 子智能体因 ModelRetryMiddleware 合成错误 AIMessage 导致 save_messages 一致性检查失败，主运行连锁崩溃**
  *Symptoms*: ## 现象  主智能体派发多个子智能体并行调研，其中一个子智能体因模型 provider 429 TPM 限流而失败（`ModelRetryMiddleware` 重试 3 次都 429），其失败状态触发 `save_messages_from_langgraph_state` 的一致性检查 raise，导致子运行失败、主运行 `execution tree 尚未完成 runtime cleanup`、重试 2 次耗尽、主运行彻底崩溃。  ## 直接错误  ``` ERROR chat_service.py:1251: Error saving messages from LangGraph state: 最终 State AIMessage 无法与当前 Run 的 Model lifecycle 事实关联 ValueError: 最终 State AIMessage 无法与当前 Run 的 Model lifecycle 事实关联 ```  随后： ``` ERROR manager.py:1498: PostgreSQL async operation failed: Run <主run_id> 的 execution tree 尚未完成 runtime cleanup <主run_id> max retries 2 exceeded ```  ## 复现条件  - Yuxi 版本：`0.7.3`（commit d633378 及之后） - 模型：`doubao:glm-5-3-flash-260828`（豆包，TPM 限制 1000K） - Agent 配置：主智能体派 5 个子智能体并行调研（`research-explorer` 等） - 触发条件：5 个子智能体并发调同一个模型 + 长输出 → 触发豆包 `ModelAccountTpmRateLimitExceeded` (429) - 子智能体里 `model_retry_times=2`，`ModelRetryMiddleware` 重试 3 次都 429 后耗尽  ## 根因  `ModelRetryMiddleware._format_failure_message`（`langchain/agents/middleware/model_retry.py:179-195`）在重试耗尽时合成一条 AIMessage：  ```python content = f"Model call failed after {attempts_made} {attempt_word} with {exc_type}: {exc_msg}" return AIMessage(content=content) ```  这条 AIMessage 的特征： - `id` 是普通 UUID（如 `8cab698c-25d7-4a8e-ad34-76e0b19a9514`），**不是 `lc_run-...` 格式** - `content` 是 string（不是 list） - 内容以 `Model call failed after` 开头 - `response_metadata`、`additional_kwargs`、`tool_calls` 全空 - **没有经过 model lifecycle 事件流**（无 `message-start`/`message-finish`），因此 `model_message_audits` 表无对应 operation_id 记录  `save_m

- **Issue #1046** (2026-09-28): **Feat: 上下文自动压缩失败时不要把错误文本写成记忆**
  *Symptoms*: **问题**  长对话会自动压缩发给模型的上下文。自动摘要失败时，Error generating summary: ... 会写入 checkpoint，主模型继续用这段错误当历史。手动点「压缩上下文」失败则会中止，两条路径不一致。  另外，summary_threshold 固定约 100K，不看模型真实窗口；summary_keep_messages 按条数保留，最近几条很大时摘要后仍可能超限。摘要是有损的，模型看不到 outputs/conversation_history/ 里的原文路径。  **期望**  自动压缩在历史文件写失败、摘要为空或报错时，不更新 _summarization_event，这次调用直接失败。PostgreSQL 里的聊天记录不删除。 触发阈值改为 min(配置阈值, 模型上下文窗口的 70%)；未配置窗口时仍用现有配置。保留段按 token 预算从新到旧截取。 默认摘要只保留未完成任务、约束、文件路径和已确认结论，并带上历史文件路径，需要时用 read_file 回读。 摘要调用关闭思考模式，token 计入该次 Run 的用量。 不改  85% 仍然只提示手动压缩，不提前自动摘要。工具结果完整内容仍先写入工作目录。
  **Post-Mortem & Fix Analysis**:
  > 我想认领这个问题。考虑到当前 Issue 同时包含失败原子性、动态触发阈值、按 Token 保留消息、摘要 Prompt 和用量统计，我建议先提交一个最小阶段，只处理自动压缩失败的原子性：  1. 历史文件写入失败时，中止当前调用，不生成或更新 `_summarization_event`； 2. 摘要模型调用失败或返回空内容时，中止当前调用，不把错误文本写入 checkpoint； 3. 补充同步和异步自动压缩路径的回归测试； 4. 不改变当前主动压缩行为。  动态模型窗口阈值、按 Token 保留消息、摘要 Prompt 和 usage 统计暂不包含在这个 PR 中，避免一次改动跨越过多运行时语义。  如果这个拆分范围可以，我会基于最新 main 实现并提交 PR。
  > @OUAO-FRANK 可以的，👍

- **Issue #1045** (2026-09-24): **Error: 知识图谱 LLM 抽取在思考模式模型上 60 秒超时**
  *Symptoms*: **现象** 用百炼 Qwen3 系列做知识图谱抽取时，单个文本块经常在模型还没返回 JSON 时失败。Qwen3 默认开启思考模式，思考过程加上抽取结果，非流式请求很容易超过 60 秒。  **复现** 知识库使用 Milvus，图谱抽取器选 LLM。 抽取模型选百炼 Qwen3（默认 enable_thinking=true）。 模型参数留空，开始索引。 抽取阶段超时失败。 相关代码在 backend/package/yuxi/knowledge/graphs/extractors/llm.py：LLMGraphExtractor.extract() 调用 select_model(..., timeout=60.0)，再用 model.call(prompt, stream=False)。超时写死为 60 秒，页面上不能改，也没有流式输出。  已验证的规避方式 图谱配置里的「模型参数 JSON」写成：  {"extra_body":{"enable_thinking":false}} 关闭思考后，同样的文档可以抽完。  下面这种写法会直接报错，而不是关掉思考：  {"enable_thinking":false} model_params 会被展开成 ChatOpenAI 的参数，enable_thinking 进了 AsyncCompletions.create()，接口不接受这个顶层参数。它必须放在 extra_body 里。页面没有说明这一点。  在模型管理里用 request_body_overrides 关闭思考也能生效，但会影响该模型的所有对话，不只是图谱抽取。  **期望** 抽取超时可配置，或对思考模式模型不要固定卡在 60 秒。 百炼这类默认开思考的模型，抽取时能关闭思考，且不要误伤 OpenAI、Anthropic、Gemini。 「模型参数 JSON」说明 enable_thinking 必须放在 extra_body 中；写在顶层时应提示配置错误，而不是把异常关键字传给接口。

- **Issue #998** (2026-09-07): **Error: 点击生成api key无反应**
  *Symptoms*: 1️⃣ 描述一下问题 我想向外部调用智能体接口，在点击生成api key的时候没有任何反应，本地日志也看不到对应内容。 <!-- 简单描述一下问题（如何产生的，什么情况下，进行什么操作的时候）-->    2️⃣ 报错日志  <img width="2549" height="1242" alt="Image" src="https://github.com/user-attachments/assets/10da880c-cda3-4d9d-846b-6ac9e705673e" />   3️⃣ 相关截图  <img width="2549" height="1242" alt="Image" src="https://github.com/user-attachments/assets/8e0fdb40-0b90-4410-af14-e65e90f0cf45" />    #️⃣ 其他相关信息   ✅ 如果问题与模型调用相关，请尝试切换到其他在线模型 
  **Post-Mortem & Fix Analysis**:
  > 问题出在创建弹窗时调用了 `crypto.randomUUID()`，该方法在普通 HTTP 环境下不可用，因此请求尚未发出就报错了。  改用 HTTP 环境也支持的 `crypto.getRandomValues()` 生成请求 ID 即可。后端接受 32 位十六进制字符串，已有请求 ID 和失败重试逻辑保持不变。  ```diff diff --git a/web/src/components/ApiKeyManagementComponent.vue b/web/src/components/ApiKeyManagementComponent.vue --- a/web/src/components/ApiKeyManagementComponent.vue +++ b/web/src/components/ApiKeyManagementComponent.vue @@ -223,7 +223,10 @@ const showCreateModal = () => {    createForm.name = ''    createForm.expires_at = null    createRequestId.value = -    sessionStorage.getItem(CREATE_REQUEST_STORAGE_KEY) || globalThis.crypto.randomUUID() +    sessionStorage.getItem(CREATE_REQUEST_STORAGE_KEY) || +    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => +      byte.toString(16).padStart(2, '0') +    ).join('')    sessionStorage.setItem(CREATE_REQUEST_STORAGE_KEY, createRequestId.value)    createModalVisible.value = true  } ```   后续会在主仓库修复更新
  > 感谢作者喵 😘

- **Issue #997** (2026-09-09): **Error: [Bug] 知识库 additional_params.stats 与真实索引状态不一致：chunk_count=0、pending_index_count=N，但文件实际已全部 indexed**
  *Symptoms*: ## 环境  - Yuxi 版本：v0.7.2.beta1（部署分支，含 ARQ worker 异步索引链路；代码中已存在 `knowledge_chunks.tags` jsonb 列） - 部署：docker compose（api + worker + postgres + redis + minio + milvus） - 向量库：Milvus（默认库，非 `yuxi` db） - 数据库：PostgreSQL 库 `yuxi`，表 `knowledge_bases.additional_params`（jsonb，内含 `stats`）  ## 现象  知识库（kb_id=`kb_u452jh75s0`）上传 8 篇 PDF 并全部完成索引后，`additional_params.stats` 缓存与真实数据严重不一致：  | 统计项 | stats 缓存（错误） | 真实数据 | |---|---|---| | `chunk_count` | 0 | 158（`knowledge_chunks` 计数） | | `pending_index_count` | 8 | 0（`knowledge_files` 全部 `indexed`） | | `token_count` | 0 | > 0 |  真实数据核验（均可复现）：  - `knowledge_files`：8 个文件 status 全部为 `indexed` - `knowledge_chunks`：158 行 - Milvus collection `kb_u452jh75s0`：flush 后 `num_entities = 158`，与 PG 一致 - 语义检索正常（评估运行 recall@5 = 1.0）  即：**数据层完全健康，只有 stats 投影过期**。该缓存被 UI 列表 / 依赖库状态的逻辑读取，导致界面显示"待索引/0 分块"，并会让依赖库状态的功能（如评估基准生成前的状态判断）产生误判。  ## 根因分析（基于源码定位，供参考）  1. `manager.py` 已有刷新封装 `_refresh_database_stats()`（`KnowledgeBaseRepository.update_stats` 行锁内写回 `additional_params["stats"]`）以及 `_run_with_stats_refresh()`（执行文件操作并刷新，异常路径也刷新）——但这些服务的是**同步文件操作**（删除/改名/更新等）。 2. 上传 → MinerU/OCR 解析 → 切块 → 向量化 → 写 `knowledge_chunks` + Milvus 是 **ARQ worker 异步链路**（`run_worker.py`）。从调用点检索看，这条异步路径在任务完成后**没有保证触发** `_refresh_database_stats`；一旦 worker 任务中断、异常、或批量处理部分失败，stats 就永远停在旧值，且无自愈机制。 3. 维护者已知该缺口：`base.py` / `manager.py` 提供了 `repair_missing_file_stats(kb_id)`（逐文件重算 chunk/token 并写回 + 刷新库级 stats），说明存在"修复"入口，但索引完成路径未自动调用，UI 也无该入口。  ## 期望行为  - 索引链路完成后 `additional_params.stats` 与 `knowledge_
  **Post-Mortem & Fix Analysis**:
  > 已修复

- **Issue #988** (2026-09-10): **Error: 知识库-文件管理-时间的时区问题**
  *Symptoms*: 1️⃣ 描述一下问题  知识库的创建时间显示的是UTC时间，不是北京时间。 查询了数据库存储的数据：2026-09-01T03:33:33.718140+08:00 如果是+8：00，那就是写入的时间有问题，应该在现在的03:33基础上+8 
  **Post-Mortem & Fix Analysis**:
  > 已修复

- **Issue #866** (2026-08-10): **[安全][多租户] 部门管理员可跨部门读取/删除/下载其他部门知识库文档（对象级越权）**
  *Symptoms*: 标题: [安全][多租户] 部门管理员可跨部门读取/删除/下载其他部门知识库文档（对象级越权）  正文:  ## 问题  `backend/server/routers/knowledge_router.py` 中，**除列表类接口**（`get_databases` 走 `get_databases_by_user` 按 `share_config` 过滤）外，所有文档级操作（如 `delete_document`、`download_document`、`parse_documents` 等）只调用 `_ensure_database_supports_documents`，该函数**仅校验知识库存在与类型，不校验当前用户对该 `kb_id` 的访问权限**；接口仅用 `get_admin_user` 检查角色，不校验部门归属。  ```python async def _ensure_database_supports_documents(kb_id, operation):     db_info, supports = await knowledge_base.get_database_document_support(kb_id)     # 无 access 检查  @knowledge.delete("/databases/{kb_id}/documents/{doc_id}") async def delete_document(kb_id, doc_id, current_user=Depends(get_admin_user)):     await _ensure_database_supports_documents(kb_id, "文档删除") ```  结果：**任意部门管理员只要猜到/枚举 `kb_id` 与 `doc_id`，即可读取、删除、下载其他部门知识库的文档**，破坏多租户部门隔离。  ## 建议  1. 所有文档级接口统一加对象级权限校验：确认当前用户所属部门对 `kb_id` 有访问权限（复用列表接口的过滤逻辑，抽成公共 `_ensure_database_access(kb_id, user)`）； 2. 为所有按 id 操作的接口补充越权测试（其他部门用户访问 → 403）； 3. 审计现有 `knowledge_router.py` 全部按 kb_id/doc_id 操作的路由，逐一补校验。 
  **Post-Mortem & Fix Analysis**:
  > 这个已经验证修复，最近会推送到 GitHub

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

### Incident Patch 1: `cc03eca4` (2026-09-28)
**Commit Message**: fix: 合并资源选择决策并补齐个人 Skill 自动可用

**File**: `backend/package/yuxi/agents/context.py` (modified, +4/-4)
```diff
@@ -265,7 +265,7 @@ def update(self, data: dict):
         metadata={
             "name": "Skills",
             "options": [],
-            "description": "可选 Skill 拓展列表，默认选择当前用户可用的全部 Skill 拓展。"
+            "description": "选择共享和内置 Skill，默认全部；个人 Skill 始终可用，无需选择。"
             "Skill 的本地工具和 MCP 依赖在激活后开放；预加载 Skill 从首轮开放依赖。",
             "type": "list",
             "kind": "skills",
@@ -278,7 +278,7 @@ def update(self, data: dict):
             "name": "预加载 Skills",
             "options": [],
             "description": "创建 Agent Graph 时加载完整 Skill 说明，并从首轮开放其依赖工具。"
-            "默认不预加载；选择全部时预加载当前已启用的全部 Skill。",
+            "默认不预加载；选择全部时预加载当前已选的共享 Skill。",
             "type": "list",
             "kind": "skills",
         },
@@ -460,9 +460,9 @@ async def resolve_agent_resource_options(
             if server.slug in enabled_slugs
         ]
     if "skills" in fields_to_load:
-        from yuxi.agents.skills.service import list_accessible_skills
+        from yuxi.agents.skills.service import list_accessible_shared_skills
 
-        skills = await list_accessible_skills(db, user)
+        skills = await list_accessible_shared_skills(db, user)
         options["skills"] = [
             _resource_option(skill.slug, skill.name, skill.description) for skill in skills if skill.slug
         ]
```

**File**: `backend/package/yuxi/agents/skills/runtime.py` (modified, +6/-3)
```diff
@@ -90,15 +90,18 @@ async def resolve_runtime_skills_for_context(
     db: AsyncSession,
     user: User,
 ) -> dict:
-    """从已授权 Skill 派生当前 Agent Run 的运行时 scope 与预加载快照。"""
+    """合并已选共享与全部个人 Skill，派生运行范围和预加载快照。"""
     skill_items = [item for item in await list_accessible_skills(db, user) if item.slug]
     runtime_skills = build_runtime_skills(skill_items)
     available = set(runtime_skills)
     selected = normalize_string_list(getattr(context, "skills", None))
-    context_skills = [slug for slug in selected if slug in available]
+    shared_skills = [slug for slug in selected if slug in available]
+    context_skills = normalize_string_list(
+        [*shared_skills, *(item.slug for item in skill_items if item.source_scope == "personal")]
+    )
     effective_skills = expand_skill_closure(context_skills, runtime_skills)
     configured_preloads = normalize_string_list(getattr(context, "preload_skills", None))
-    context_preload_skills = [slug for slug in configured_preloads if slug in context_skills]
+    context_preload_skills = [slug for slug in configured_preloads if slug in shared_skills]
     preloaded_skills = expand_skill_closure(context_preload_skills, runtime_skills)
     items_by_slug = {item.slug: item for item in skill_items}
     preloaded_contents = (
```

**File**: `backend/package/yuxi/agents/skills/service.py` (modified, +5/-44)
```diff
@@ -23,7 +23,6 @@
 from sqlalchemy import select, text
 from sqlalchemy.ext.asyncio import AsyncSession
 
-from yuxi.agents.context import validate_resource_selection
 from yuxi.agents.mcp.service import get_enabled_mcp_server_slugs
 from yuxi.agents.skills.buildin import BUILTIN_SKILLS_DIR
 from yuxi.agents.skills.repository import SkillRepository
@@ -362,7 +361,7 @@ async def refresh_user_skill_projection_async(uid: str) -> dict[str, str]:
         else:
             source_dirs = {
                 item.slug: str(_resolve_skill_dir(item))
-                for item in await _list_accessible_shared_skills(db, user)
+                for item in await list_accessible_shared_skills(db, user)
                 if item.slug
             }
         await sync_user_accessible_skills_async(normalized_uid, source_dirs)
@@ -594,7 +593,7 @@ async def list_accessible_skills(
 ) -> list[ResolvedSkill]:
     """返回当前用户最终生效的共享与个人 Skill。"""
     shared_items, personal_items = await asyncio.gather(
-        _list_accessible_shared_skills(db, user, require_enabled=require_enabled),
+        list_accessible_shared_skills(db, user, require_enabled=require_enabled),
         list_personal_skills(str(user.uid)),
     )
     personal_by_slug = {item.slug: item for item in personal_items}
@@ -680,7 +679,7 @@ def get_tools():
     }
 
 
-async def _list_accessible_shared_skills(
+async def list_accessible_shared_skills(
     db: AsyncSession,
     user: User,
     *,
@@ -694,7 +693,7 @@ async def _list_accessible_shared_skills(
 
 async def _list_shared_skill_slugs(db: AsyncSession, user: User) -> list[str]:
     """返回依赖配置可引用的共享 Skill slug。"""
-    return [item.slug for item in await _list_accessible_shared_skills(db, user) if isinstance(item.slug, str)]
+    return [item.slug for item in await list_accessible_shared_skills(db, user) if isinstance(item.slug, str)]
 
 
 def _get_all_tool_names() -> list[str]:
@@ -754,7 +753,7 @@ async def update_skill_dependencies(
     item = await get_manageable_skill_or_raise(db, operator, slug)
     _ensure_non_builtin(item)
     repo = SkillRepository(db)
-    skill_items = await _list_accessible_shared_skills(db, operator)
+    skill_items = await list_accessible_shared_skills(db, operator)
     available_skills = {skill.slug: skill for skill in skill_items}
     tools, mcps, skills = await _validate_dependencies(
         parent=item,
@@ -965,44 +964,6 @@ async def delete_personal_skill(uid: str, slug: str) -> None:
     await asyncio.to_thread(shutil.rmtree, skill_dir)
 
 
-async def enable_personal_skills_for_agent_config(
-    db: AsyncSession,
-    *,
-    thread_id: str,
-    uid: str,
-    skill_slugs: list[str],
-) -> bool:
-    """为显式 Skill 白名单追加个人 Skill；全部模式无需写入。"""
-    from yuxi.repositories.agent_repository import AgentRepository
-    from yuxi.repositories.conversation_repository import ConversationRepository
-
-    conversation = await ConversationRepository(db).get_conversation_by_thread_id(thread_id)
-    if not conversation or str(conversation.uid) != str(uid):
-        return False
-    agent_repo = AgentRepository(db)
-    agent = await agent_repo.get_by_slug(conversation.agent_id)
-    if not agent or agent.created_by != str(uid):
-        return False
-
-    context = (agent.config_json or {}).get("context") or {}
-    configured_skills = validate_resource_selection("skills", context.get("skills", "all"))
-    if configured_skills == "all":
-        return True
-
-    selected_skills = configured_skills
-    updated_skills = normalize_string_list([*selected_skills, *skill_slugs])
-    if updated_skills == selected_skills:
-        return True
-
-    await agent_repo.update(
-        agent,
-        config_json={"context": {"skills": updated_skills}},
-        config_resource_access={"skills": set(skill_slugs)},
-        updated_by=str(uid),
-    )
-    return True
-
-
 def _resolved_shared_skill(item: Skill, *, shadowed_by_personal: bool = False) -> ResolvedSkill:
     """将数据库 Skill 适配为统一的有效 Skill 描述。"""
     source_scope = "builtin" if is_builtin_skill(item) else "shared"
```

**File**: `backend/package/yuxi/agents/toolkits/buildin/install_skill.py` (modified, +1/-14)
```diff
@@ -13,7 +13,6 @@
 from yuxi.agents.backends.paths import VIRTUAL_PATH_PREFIX, VIRTUAL_PERSONAL_SKILLS_PATH
 from yuxi.agents.backends.sandbox.download import download_sandbox_directory
 from yuxi.agents.toolkits.registry import tool
-from yuxi.storage.postgres.manager import pg_manager
 from yuxi.utils.logging_config import logger
 
 SANDBOX_PATH_HINT = "请使用当前 Project Workdir 下的目录，或 /home/gem/user-data/..."
@@ -107,14 +106,10 @@ async def _run_install_task(
         )
 
     try:
-        from yuxi.agents.skills.service import (
-            enable_personal_skills_for_agent_config,
-            install_personal_skill_dir,
-        )
+        from yuxi.agents.skills.service import install_personal_skill_dir
 
         installed_slugs: list[str] = []
         failed_items: list[dict] = []
-        config_success = True
 
         if source.startswith("/"):
             with tempfile.TemporaryDirectory(prefix=".skill-install-") as tmp:
@@ -159,12 +154,6 @@ async def _run_install_task(
             finally:
                 await preparation.cleanup()
 
-        if installed_slugs:
-            async with pg_manager.get_async_session_context() as db:
-                config_success = await enable_personal_skills_for_agent_config(
-                    db, thread_id=thread_id, uid=uid, skill_slugs=installed_slugs
-                )
-
         lines = []
         if installed_slugs:
             lines.append(f"已安装 Skill: {', '.join(installed_slugs)}")
@@ -173,8 +162,6 @@ async def _run_install_task(
         if failed_items:
             for item in failed_items:
                 lines.append(f"安装失败 ({item['slug']}): {item.get('error', '未知错误')}")
-        if not config_success:
-            lines.append("Skill 已安装，但当前 Agent 配置未更新，请手动启用")
         if not installed_slugs and not failed_items:
             lines.append("未发现需要安装的 Skill")
 
```

**File**: `backend/test/e2e/test_personal_skill_agent_e2e.py` (modified, +14/-5)
```diff
@@ -1,19 +1,20 @@
 from __future__ import annotations
 
+import json
 import uuid
 from typing import Any
 
+import asyncpg
 import httpx
 import pytest
 
-from e2e_helpers import cancel_run, consume_events, skip_if_external_quota, wait_for_run
+from e2e_helpers import cancel_run, consume_events, postgres_dsn, skip_if_external_quota, wait_for_run
 from test.live_api_cleanup import (
     make_test_conversation_metadata,
     make_test_conversation_title,
     remove_e2e_thread_storage,
 )
 from yuxi.agents.skills.service import get_personal_skills_root_dir, get_user_skills_root_dir
-from yuxi.agents.backends.paths import VIRTUAL_PERSONAL_SKILLS_PATH
 
 pytestmark = [pytest.mark.asyncio, pytest.mark.e2e, pytest.mark.slow]
 
@@ -23,7 +24,7 @@ async def test_main_agent_reads_personal_skill_directly_from_user_workspace(
     e2e_headers: dict[str, str],
     e2e_agent_context: dict[str, str],
 ):
-    """真实主 Agent 应从 UserWorkspace 直接读取个人 SKILL.md。"""
+    """共享选择为空时，真实主 Agent 仍发现并读取个人 SKILL.md。"""
     uid = e2e_agent_context["uid"]
     marker = f"PERSONAL_SKILL_E2E_{uuid.uuid4().hex[:10].upper()}"
     slug = f"pytest-personal-agent-{uuid.uuid4().hex[:8]}"
@@ -56,13 +57,13 @@ async def test_main_agent_reads_personal_skill_directly_from_user_workspace(
         default_context = ((default_response.json().get("agent") or {}).get("config_json") or {}).get("context") or {}
         context: dict[str, Any] = {
             "system_prompt": (
-                f"收到请求后必须先读取 {VIRTUAL_PERSONAL_SKILLS_PATH}/{slug}/SKILL.md，"
+                f"收到请求后从可用 Skills 中找到 {slug} 并读取其 SKILL.md，"
                 "然后严格遵循其中的 Verification 指令，不要添加解释。"
             ),
             "tools": [],
             "knowledges": [],
             "mcps": [],
-            "skills": [slug],
+            "skills": [],
             "subagents": [],
         }
         if default_context.get("model"):
@@ -124,6 +125,14 @@ async def test_main_agent_reads_personal_skill_directly_from_user_workspace(
         assert result_response.status_code == 200, result_response.text
         assert marker in str(result_response.json().get("output") or ""), result_response.text
 
+        conn = await asyncpg.connect(postgres_dsn())
+        try:
+            raw_manifest = await conn.fetchval("SELECT manifest FROM agent_runs WHERE id = $1", run_id)
+            manifest = json.loads(raw_manifest) if isinstance(raw_manifest, str) else raw_manifest
+            assert slug in {item["slug"] for item in manifest["resources"]["skills"]}
+        finally:
+            await conn.close()
+
         personal_skill = get_personal_skills_root_dir(uid) / slug / "SKILL.md"
         assert personal_skill.read_text(encoding="utf-8") == skill_md
         projected_skill = get_user_skills_root_dir(uid) / slug / "SKILL.md"
```

**File**: `backend/test/integration/api/test_agent_config_resource_authorization.py` (modified, +100/-0)
```diff
@@ -384,6 +384,106 @@ async def _read_agent_config(conn, slug: str) -> dict:
     return json.loads(value) if isinstance(value, str) else value
 
 
+async def test_personal_skills_are_automatic_and_absent_from_agent_options(test_client, standard_user):
+    """真实 HTTP 选项只含共享，个人文件自动进入空、固定和全部运行范围。"""
+    from types import SimpleNamespace
+
+    from yuxi.agents.skills.runtime import resolve_runtime_skills_for_context
+
+    uid = str(standard_user["user"]["uid"])
+    headers = standard_user["headers"]
+    suffix = uuid.uuid4().hex[:10]
+    shared_slug, personal_slug = f"pytest-shared-{suffix}", f"pytest-personal-{suffix}"
+    agent_slug = f"pytest-personal-agent-{suffix}"
+    conn = await asyncpg.connect(os.environ["POSTGRES_URL"].replace("+asyncpg", ""))
+    engine = create_async_engine(os.environ["POSTGRES_URL"])
+    installed = []
+    try:
+        for slug in (shared_slug, personal_slug):
+            body = f"---\nname: {slug}\ndescription: Personal description\n---\n# Personal body\n"
+            prepared = await test_client.post(
+                "/api/skills/import/prepare",
+                headers=headers,
+                files={"file": ("SKILL.md", body.encode(), "text/markdown")},
+            )
+            assert prepared.status_code == 200, prepared.text
+            draft_id = prepared.json()["data"]["draft_id"]
+            confirmed = await test_client.post(
+                f"/api/skills/personal/install-drafts/{draft_id}/confirm",
+                headers=headers,
+                json={"slugs": [slug]},
+            )
+            assert confirmed.status_code == 200, confirmed.text
+            installed.append(slug)
+
+        await conn.execute(
+            """INSERT INTO skills (slug, name, description, source_type, dir_path, share_config,
+                enabled, created_by, updated_by, tool_dependencies, mcp_dependencies, skill_dependencies)
+                VALUES ($1, 'Shared title', 'Shared description', 'upload', $1, $2::jsonb,
+                true, $3, $3, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)""",
+            shared_slug,
+            _user_share_config(uid),
+            uid,
+        )
+
+        created = await test_client.post(
+            "/api/agent",
+            headers=headers,
+            json={
+                "name": "Personal skills test",
+                "slug": agent_slug,
+                "backend_id": "ChatbotAgent",
+                "config_json": {"context": {"skills": [], "tools": [], "knowledges": [], "subagents": []}},
+            },
+        )
+        assert created.status_code == 200, created.text
+        response = await test_client.get(f"/api/agent/{agent_slug}", headers=headers)
+        assert response.status_code == 200, response.text
+        items = response.json()["agent"]["configurable_items"]
+        for field in ("skills", "preload_skills"):
+            options = {item["key"]: item for item in items[field]["options"]}
+            assert personal_slug not in options
+            assert options[shared_slug]["name"] == "Shared title"
+
+        for selection in ([], [shared_slug], "all"):
+            saved = await test_client.put(
+                f"/api/agent/{agent_slug}",
+                headers=headers,
+                json={"config_json": {"context": {"skills": selection}}},
+            )
+            assert saved.status_code == 200, saved.text
+            config = await _read_agent_config(conn, agent_slug)
+            assert config["context"]["skills"] == selection
+            async with async_sessionmaker(engine, expire_on_commit=False)() as db:
+                user = await db.scalar(select(User).where(User.uid == uid))
+                normalized = await normalize_agent_context_config(
+                    config["context"],
+                    db=db,
+                    user=user,
+                    context_schema=ChatBotContext,
+                )
+                scope = await resolve_runtime_skills_for_context(SimpleNamespace(**normalized), db=db, user=user)
+            assert {shared_slug, personal_slug}.issubset(scope["effective_skills"])
+            assert scope["skill_metadata"][shared_slug]["source_scope"] == "personal"
+            assert scope["skill_metadata"][personal_slug]["source_scope"] == "personal"
+            assert await _read_agent_config(conn, agent_slug) == config
+
+        rejected = await test_client.put(
+            f"/api/agent/{agent_slug}",
+            headers=headers,
+            json={"config_json": {"context": {"skills": [personal_slug]}}},
+        )
+        assert rejected.status_code == 422, rejected.text
+        assert await _read_agent_config(conn, agent_slug) == config
+    finally:
+        await engine.dispose()
+        await test_client.delete(f"/api/agent/{agent_slug}", headers=headers)
+        for slug in installed:
+            await test_client.delete(f"/api/skills/personal/{slug}", headers=headers)
+        await conn.execute("DELETE FROM skills 
```

**File**: `backend/test/unit/agents/skills/test_skill_runtime.py` (modified, +109/-2)
```diff
@@ -6,6 +6,94 @@
 from yuxi.agents.skills.runtime import build_dependency_bundle, expand_skill_closure, resolve_runtime_skills_for_context
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("selection", [[], ["shared"], "all"])
+@pytest.mark.parametrize("preloads", [[], "all"])
+async def test_personal_skills_are_available_independently_of_shared_selection(
+    tmp_path, monkeypatch, selection, preloads
+):
+    """真实个人目录始终参与运行，选项仅共享且其他用户目录不可见。"""
+    from yuxi.agents.context import normalize_agent_context_config, resolve_agent_resource_options
+    from yuxi.agents.skills import service
+    from yuxi.storage.postgres.models_business import Skill
+    from yuxi.workspace import paths
+
+    monkeypatch.setattr(paths, "get_user_data_dir", lambda: tmp_path / "user-data")
+    monkeypatch.setattr(service, "get_skill_data_dir", lambda: tmp_path / "shared")
+    shared_dir = tmp_path / "shared" / "extra"
+    shared_dir.mkdir(parents=True)
+    (shared_dir / "SKILL.md").write_text("# Extra shared body", encoding="utf-8")
+    shared = Skill(
+        id=1,
+        slug="shared",
+        name="Shared title",
+        description="shared description",
+        source_type="upload",
+        dir_path="shared",
+        enabled=True,
+        created_by="user-a",
+        share_config={"version": 2, "read_scope": {"access_level": "global"}, "manage_scope": None},
+        tool_dependencies=[],
+        mcp_dependencies=[],
+        skill_dependencies=[],
+    )
+    extra = Skill(
+        id=2,
+        slug="extra",
+        name="Extra",
+        description="extra shared",
+        source_type="upload",
+        dir_path="extra",
+        enabled=True,
+        created_by="user-a",
+        share_config=shared.share_config,
+        tool_dependencies=[],
+        mcp_dependencies=[],
+        skill_dependencies=[],
+    )
+
+    class SkillRepository:
+        """提供共享记录，个人来源由真实目录扫描。"""
+
+        def __init__(self, db):
+            """接收测试会话。"""
+
+        async def list_enabled(self):
+            """返回测试共享记录。"""
+            return [shared, extra]
+
+    monkeypatch.setattr(service, "SkillRepository", SkillRepository)
+    for uid, slug in [("user-a", "personal"), ("user-a", "shared"), ("user-b", "other-user")]:
+        directory = service.get_personal_skills_root_dir(uid) / slug
+        directory.mkdir(parents=True)
+        (directory / "SKILL.md").write_text(
+            f"---\nname: {slug}\ndescription: personal {slug}\n---\nPersonal body", encoding="utf-8"
+        )
+    user = SimpleNamespace(uid="user-a", role="user", department_id=None)
+    options = await resolve_agent_resource_options({"skills"}, db=None, user=user)
+    assert options["skills"] == [
+        {"key": "shared", "name": "Shared title", "description": "shared description"},
+        {"key": "extra", "name": "Extra", "description": "extra shared"},
+    ]
+    config = {"tools": [], "knowledges": [], "skills": selection, "preload_skills": preloads}
+    normalized = await normalize_agent_context_config(config, db=None, user=user)
+    assert normalized["skills"] == (["shared", "extra"] if selection == "all" else selection)
+    scope = await resolve_runtime_skills_for_context(SimpleNamespace(**normalized), db=None, user=user)
+    expected = {"shared", "personal", "extra"} if selection == "all" else {"shared", "personal"}
+    assert set(scope["context_skills"]) == expected
+    assert set(scope["effective_skills"]) == expected
+    assert scope["runtime_skills"]["shared"]["description"] == "personal shared"
+    assert scope["runtime_skills"]["shared"]["path"] == "/home/gem/user-data/agents/skills/shared/SKILL.md"
+    assert "other-user" not in scope["runtime_skills"]
+    expected_contents = {}
+    if preloads == "all" and selection:
+        expected_contents["shared"] = "---\nname: shared\ndescription: personal shared\n---\nPersonal body"
+        if selection == "all":
+            expected_contents["extra"] = "# Extra shared body"
+    assert scope["preloaded_skill_contents"] == expected_contents
+    assert config["skills"] == selection
+
+
 def _skill(tmp_path, slug: str, *, dependencies: list[str] | None = None, content: str | None = None):
     source_dir = tmp_path / slug
     source_dir.mkdir()
@@ -24,6 +112,25 @@ def _skill(tmp_path, slug: str, *, dependencies: list[str] | None = None, conten
     )
 
 
+@pytest.mark.asyncio
+async def test_personal_skill_is_not_a_direct_preload_candidate(tmp_path, monkeypatch):
+    """自动加入的个人 Skill 不扩大显式预加载范围。"""
+    personal = _skill(tmp_path, "personal")
+    personal.source_scope = "personal"
+
+    async def accessible(_db, _user):
+        return [personal]
+
+    monkeypatch.setattr(skill_runtime, "list_accessible_skills", accessible)
+    scope = await resolve_runtime_skills_for_context(
+        SimpleNamespace(skills=[], preload_skills=["personal"]), db=None, user=None
+    )
+
+    assert scope["context_skills"] == ["personal"]
+    assert scope["context_preload_sk
```

**File**: `backend/test/unit/agents/test_context_auth.py` (modified, +2/-2)
```diff
@@ -226,7 +226,7 @@ async def list_visible_subagents(self, *, user):
     monkeypatch.setitem(
         sys.modules,
         "yuxi.agents.skills.service",
-        types.SimpleNamespace(list_accessible_skills=fake_list_skills),
+        types.SimpleNamespace(list_accessible_shared_skills=fake_list_skills),
     )
     monkeypatch.setitem(
         sys.modules,
@@ -440,7 +440,7 @@ async def list_visible_subagents(self, *, user):
     monkeypatch.setitem(
         sys.modules,
         "yuxi.agents.skills.service",
-        types.SimpleNamespace(list_accessible_skills=fake_list_skills),
+        types.SimpleNamespace(list_accessible_shared_skills=fake_list_skills),
     )
     monkeypatch.setitem(
         sys.modules,
```

---

### Incident Patch 2: `a72c0438` (2026-09-28)
**Commit Message**: fix: 降低 worker 健康检查与前端轮询的空闲开销 (#1086)

**File**: `backend/package/yuxi/services/readiness_service.py` (modified, +1/-2)
```diff
@@ -11,8 +11,6 @@
 
 from sqlalchemy import text
 from yuxi.services.run_queue_service import (
-    WORKER_HEALTH_KEY,
-    WORKER_HEALTH_MAX_TTL_MS,
     WORKER_RECONCILIATION_HEALTH_KEY,
     WORKER_RECONCILIATION_HEALTH_TTL_SECONDS,
     get_redis_client,
@@ -21,6 +19,7 @@
     TASK_RECONCILIATION_HEALTH_KEY,
     TASK_RECONCILIATION_HEALTH_TTL_SECONDS,
 )
+from yuxi.services.worker_health import WORKER_HEALTH_KEY, WORKER_HEALTH_MAX_TTL_MS
 from yuxi.storage.postgres.manager import pg_manager
 
 READINESS_PROBE_TIMEOUT_SECONDS = float(os.getenv("READINESS_PROBE_TIMEOUT_SECONDS", "2"))
```

**File**: `backend/package/yuxi/services/run_queue_service.py` (modified, +1/-6)
```diff
@@ -7,18 +7,13 @@
 import os
 from datetime import UTC, datetime
 
+from yuxi.services.worker_health import WORKER_HEALTH_KEY
 from yuxi.storage.redis import close_async_redis_client, create_arq_redis_pool, get_async_redis_client
 from yuxi.utils.logging_config import logger
 
 RUN_CANCEL_KEY_TTL_SECONDS = int(os.getenv("RUN_CANCEL_KEY_TTL_SECONDS", "1800"))
 RUN_EVENTS_STREAM_TTL_SECONDS = int(os.getenv("RUN_EVENTS_STREAM_TTL_SECONDS", "7200"))
 RUN_EVENTS_STREAM_MAXLEN = int(os.getenv("RUN_EVENTS_STREAM_MAXLEN", "0"))
-WORKER_HEALTH_CONTRACT = "agent-run-v1"
-WORKER_HEALTH_KEY = f"yuxi:worker:health:{WORKER_HEALTH_CONTRACT}"
-WORKER_HEALTH_INTERVAL_SECONDS = float(os.getenv("WORKER_HEALTH_INTERVAL_SECONDS", "5"))
-if not 0 < WORKER_HEALTH_INTERVAL_SECONDS <= 10:
-    raise ValueError("WORKER_HEALTH_INTERVAL_SECONDS 必须大于 0 且不超过 10")
-WORKER_HEALTH_MAX_TTL_MS = int((WORKER_HEALTH_INTERVAL_SECONDS + 1) * 1000)
 RUN_RECONCILIATION_SECONDS = 30
 WORKER_RECONCILIATION_HEALTH_KEY = f"{WORKER_HEALTH_KEY}:lease-reconciliation"
 WORKER_RECONCILIATION_HEALTH_TTL_SECONDS = RUN_RECONCILIATION_SECONDS * 2 + 5
```

**File**: `backend/package/yuxi/services/run_worker.py` (modified, +1/-2)
```diff
@@ -33,8 +33,6 @@
 from yuxi.services.input_message_service import restore_chat_input_message
 from yuxi.services.run_queue_service import (
     RUN_RECONCILIATION_SECONDS,
-    WORKER_HEALTH_INTERVAL_SECONDS,
-    WORKER_HEALTH_KEY,
     WORKER_RECONCILIATION_HEALTH_KEY,
     WORKER_RECONCILIATION_HEALTH_TTL_SECONDS,
     append_run_stream_event,
@@ -59,6 +57,7 @@
     resolve_authorized_workdir,
     resolve_conversation_workdir_path,
 )
+from yuxi.services.worker_health import WORKER_HEALTH_INTERVAL_SECONDS, WORKER_HEALTH_KEY
 from yuxi.storage.postgres.manager import pg_manager
 from yuxi.storage.postgres.models_business import AgentRun, Conversation, Message, User
 from yuxi.storage.redis import get_arq_redis_settings
```

**File**: `backend/package/yuxi/services/worker_health.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""ARQ 消费心跳契约与轻量 Compose 健康检查。"""
+
+import os
+import sys
+
+from yuxi.storage.redis import RedisConfig, sync_redis_client
+
+WORKER_HEALTH_CONTRACT = "agent-run-v1"
+WORKER_HEALTH_KEY = f"yuxi:worker:health:{WORKER_HEALTH_CONTRACT}"
+WORKER_HEALTH_INTERVAL_SECONDS = float(os.getenv("WORKER_HEALTH_INTERVAL_SECONDS", "5"))
+if not 0 < WORKER_HEALTH_INTERVAL_SECONDS <= 10:
+    raise ValueError("WORKER_HEALTH_INTERVAL_SECONDS 必须大于 0 且不超过 10")
+WORKER_HEALTH_MAX_TTL_MS = int((WORKER_HEALTH_INTERVAL_SECONDS + 1) * 1000)
+
+
+def main() -> int:
+    """读取有界心跳租约，失败时仅输出错误类型以避免泄露连接凭据。"""
+    try:
+        config = RedisConfig.from_env(socket_timeout=2, socket_connect_timeout=2)
+        with sync_redis_client(config, ping=False) as client:
+            with client.pipeline() as pipeline:
+                pipeline.get(WORKER_HEALTH_KEY)
+                pipeline.pttl(WORKER_HEALTH_KEY)
+                value, ttl_ms = pipeline.execute()
+        if not value or not 0 < ttl_ms <= WORKER_HEALTH_MAX_TTL_MS:
+            print("worker health lease missing or invalid", file=sys.stderr)
+            return 1
+    except Exception as exc:
+        print(f"worker health check failed: {type(exc).__name__}", file=sys.stderr)
+        return 1
+    return 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `backend/test/integration/services/test_worker_health_redis.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+"""使用真实 ARQ 心跳和 Redis 验证轻量探针。"""
+
+import asyncio
+import uuid
+
+import pytest
+import pytest_asyncio
+from arq import create_pool
+from arq.worker import Worker
+from yuxi.services import worker_health
+from yuxi.storage.redis import get_arq_redis_settings
+
+pytestmark = [pytest.mark.asyncio, pytest.mark.integration]
+
+
+async def unused_job(ctx):
+    """满足 ARQ 注册约束，健康检查测试不投递任务。"""
+
+
+@pytest_asyncio.fixture
+async def health_redis(monkeypatch):
+    """健康键和队列仅属于本测试，清理不影响共享 worker。"""
+    redis = await create_pool(get_arq_redis_settings())
+    key = f"pytest-worker-health:{uuid.uuid4().hex}"
+    monkeypatch.setattr(worker_health, "WORKER_HEALTH_KEY", key)
+    try:
+        yield redis, key
+    finally:
+        await redis.delete(key)
+        await redis.aclose()
+
+
+async def test_arq_heartbeat_expires_without_renewal(health_redis):
+    """ARQ 原生心跳可通过探针，停止续租后由 Redis 过期事实拒绝。"""
+    redis, key = health_redis
+    worker = Worker(
+        functions=[unused_job],
+        redis_pool=redis,
+        queue_name=f"{key}:queue",
+        health_check_key=key,
+        health_check_interval=0.1,
+        handle_signals=False,
+    )
+    await worker.record_health()
+    assert await redis.get(key)
+    assert 0 < await redis.pttl(key) <= 1100
+    assert worker_health.main() == 0
+    await asyncio.sleep(1.2)
+    assert await redis.get(key) is None
+    assert worker_health.main() == 1
+
+
+@pytest.mark.parametrize("state", ["missing", "empty", "persistent", "excessive"])
+async def test_invalid_redis_leases_fail(health_redis, state):
+    """Redis 中的非法心跳不能维持健康状态。"""
+    redis, key = health_redis
+    if state == "empty":
+        await redis.set(key, b"", px=1000)
+    elif state == "persistent":
+        await redis.set(key, b"alive")
+    elif state == "excessive":
+        await redis.set(key, b"alive", px=worker_health.WORKER_HEALTH_MAX_TTL_MS + 60000)
+    assert worker_health.main() == 1
+
+
+async def test_unreachable_redis_fails(monkeypatch):
+    """连接拒绝产生非零结果。"""
+    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1/0")
+    assert worker_health.main() == 1
```

**File**: `backend/test/unit/config/test_docker_compose_checkpointer.py` (modified, +4/-2)
```diff
@@ -130,8 +130,10 @@ def test_worker_healthcheck_uses_arq_health_contract_in_development_and_producti
         compose = yaml.safe_load((project_root / filename).read_text())
 
         assert compose["services"]["worker"]["healthcheck"]["test"] == [
-            "CMD-SHELL",
-            "uv run --no-sync --no-dev arq --check server.worker_main.WorkerSettings",
+            "CMD",
+            "python",
+            "-m",
+            "yuxi.services.worker_health",
         ]
 
 
```

**File**: `backend/test/unit/services/test_worker_health.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+"""轻量健康探针的失败边界和导入隔离。"""
+
+import os
+import subprocess
+import sys
+from unittest.mock import MagicMock
+
+import pytest
+
+
+@pytest.mark.parametrize(
+    "value,ttl,expected",
+    [
+        (b"alive", 1000, 0),
+        (b"alive", 6000, 0),
+        (None, -2, 1),
+        (b"", 1000, 1),
+        (b"alive", -1, 1),
+        (b"alive", 0, 1),
+        (b"alive", 6001, 1),
+    ],
+)
+def test_health_requires_live_bounded_lease(monkeypatch, value, ttl, expected):
+    """缺失、空值、永久或超长租约不能被视为健康。"""
+    from yuxi.services import worker_health
+
+    client = MagicMock()
+    client.pipeline.return_value.__enter__.return_value.execute.return_value = (value, ttl)
+    context = MagicMock()
+    context.__enter__.return_value = client
+    monkeypatch.setattr(worker_health, "sync_redis_client", lambda *args, **kwargs: context)
+    monkeypatch.setattr(worker_health, "WORKER_HEALTH_MAX_TTL_MS", 6000)
+    assert worker_health.main() == expected
+
+
+def test_health_connection_error_does_not_expose_credentials(monkeypatch, capsys):
+    """连接失败返回非零且不输出异常中的凭据。"""
+    from yuxi.services import worker_health
+
+    context = MagicMock()
+    context.__enter__.side_effect = ConnectionError("redis://user:secret@host/0")
+    monkeypatch.setattr(worker_health, "sync_redis_client", lambda *args, **kwargs: context)
+    assert worker_health.main() == 1
+    assert "secret" not in capsys.readouterr().err
+
+
+def test_health_import_does_not_load_business_runtime():
+    """干净解释器在禁止业务运行时导入时仍可加载探针。"""
+    script = """
+import importlib.abc
+import sys
+class BlockBusiness(importlib.abc.MetaPathFinder):
+    def find_spec(self, fullname, path=None, target=None):
+        blocked = ('yuxi.services.run_worker', 'yuxi.services.run_queue_service',
+                   'langgraph', 'sqlalchemy', 'tiktoken')
+        if fullname.startswith(blocked):
+            raise AssertionError('health probe imported business runtime: ' + fullname)
+sys.meta_path.insert(0, BlockBusiness())
+import yuxi.services.worker_health
+"""
+    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, env=os.environ.copy())
+    assert result.returncode == 0, result.stderr
```

**File**: `docker-compose.prod.yml` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ services:
     command: uv run --no-sync --no-dev python -m server.worker_main
     restart: unless-stopped
     healthcheck:
-      test: ["CMD-SHELL", "uv run --no-sync --no-dev arq --check server.worker_main.WorkerSettings"]
+      test: ["CMD", "python", "-m", "yuxi.services.worker_health"]
       interval: 10s
       timeout: 10s
       retries: 6
```

---

### Incident Patch 3: `41ed2735` (2026-09-28)
**Commit Message**: fix(web): 组合输入状态下按回车不再误发送 (#1085)

**File**: `web/src/components/AgentInputArea.vue` (modified, +5/-0)
```diff
@@ -257,6 +257,11 @@ const handleKeyDown = (e) => {
     return
   }
 
+  // 输入法仍在组合状态时，回车用于确认候选词，不应触发发送
+  if (e.isComposing || e.keyCode === 229) {
+    return
+  }
+
   if (e.key === 'Enter' && !e.shiftKey) {
     e.preventDefault()
     handleSend()
```

**File**: `web/test/unit/agentInputAreaCompositionGuard.test.js` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+import test from 'node:test'
+
+const source = readFileSync(
+  new URL('../../src/components/AgentInputArea.vue', import.meta.url),
+  'utf8'
+)
+
+const handleKeyDown = source.slice(
+  source.indexOf('const handleKeyDown'),
+  source.indexOf('defineExpose')
+)
+
+test('输入法还在组合状态时，回车不触发发送', () => {
+  assert.ok(handleKeyDown.includes('isComposing'), 'handleKeyDown 缺少 e.isComposing 判据')
+  assert.ok(handleKeyDown.includes('229'), 'handleKeyDown 缺少 keyCode 229 兜底判据')
+  assert.ok(
+    handleKeyDown.indexOf('isComposing') < handleKeyDown.indexOf("e.key === 'Enter'"),
+    '组合输入判据必须排在回车发送分支之前'
+  )
+})
```

---

### Incident Patch 4: `8bfc2e88` (2026-09-28)
**Commit Message**: fix: preserve auto-summary failure atomicity (#1082)

**File**: `backend/package/yuxi/agents/middlewares/summary.py` (modified, +20/-33)
```diff
@@ -2,11 +2,9 @@
 
 from __future__ import annotations
 
-import asyncio
 import hashlib
 import json
 import re
-import warnings
 from collections.abc import Awaitable, Callable, Iterable
 from contextvars import ContextVar
 from typing import Any
@@ -215,7 +213,7 @@ def _wrap_model_call_with_compaction(
         offloaded_messages, failed_media = self._offload_inline_media(self._backend, messages_to_summarize)
         session_id = self._get_session_id(request.state)
         file_path = self._offload_to_backend(self._backend, offloaded_messages, session_id)
-        self._report_offload_result(file_path, failed_media)
+        self._require_offload_result(file_path, failed_media)
 
         summary = self._create_summary(offloaded_messages)
         new_messages = self._build_new_messages_with_path(summary, file_path)
@@ -283,12 +281,10 @@ async def _awrap_model_call_with_compaction(
             messages_to_summarize,
         )
         session_id = self._get_session_id(request.state)
-        file_path, summary = await asyncio.gather(
-            self._aoffload_to_backend(self._backend, offloaded_messages, session_id),
-            self._acreate_summary(offloaded_messages),
-        )
-        self._report_offload_result(file_path, failed_media)
+        file_path = await self._aoffload_to_backend(self._backend, offloaded_messages, session_id)
+        self._require_offload_result(file_path, failed_media)
 
+        summary = await self._acreate_summary(offloaded_messages)
         new_messages = self._build_new_messages_with_path(summary, file_path)
         new_event = self._build_summary_event(request.state, cutoff_index, new_messages[0], file_path)
         response = await handler(request.override(messages=[*new_messages, *preserved_messages]))
@@ -358,27 +354,23 @@ def _build_summary_prompt(self, messages: list[AnyMessage]) -> str | None:
         return self._lc_helper.summary_prompt.format(messages=get_buffer_string(trimmed, format="xml")).rstrip()
 
     def _create_summary(self, messages: list[AnyMessage]) -> str:
-        if not messages:
-            return "No previous conversation history."
-        prompt = self._build_summary_prompt(messages)
+        prompt = self._build_summary_prompt(messages) if messages else None
         if prompt is None:
-            return "Previous conversation was too long to summarize."
-        try:
-            return self.model.invoke(prompt, config=self._SUMMARY_INVOKE_CONFIG).text.strip()
-        except Exception as exc:
-            return f"Error generating summary: {exc!s}"
+            raise RuntimeError("没有可供自动压缩的对话历史")
+        summary = self.model.invoke(prompt, config=self._SUMMARY_INVOKE_CONFIG).text.strip()
+        if not summary:
+            raise RuntimeError("摘要模型返回空内容")
+        return summary
 
     async def _acreate_summary(self, messages: list[AnyMessage]) -> str:
-        if not messages:
-            return "No previous conversation history."
-        prompt = self._build_summary_prompt(messages)
+        prompt = self._build_summary_prompt(messages) if messages else None
         if prompt is None:
-            return "Previous conversation was too long to summarize."
-        try:
-            response = await self.model.ainvoke(prompt, config=self._SUMMARY_INVOKE_CONFIG)
-            return response.text.strip()
-        except Exception as exc:
-            return f"Error generating summary: {exc!s}"
+            raise RuntimeError("没有可供自动压缩的对话历史")
+        response = await self.model.ainvoke(prompt, config=self._SUMMARY_INVOKE_CONFIG)
+        summary = response.text.strip()
+        if not summary:
+            raise RuntimeError("摘要模型返回空内容")
+        return summary
 
     async def _acreate_summary_or_raise(self, messages: list[AnyMessage]) -> str:
         prompt = self._build_summary_prompt(messages) if messages else None
@@ -426,15 +418,10 @@ def _build_state_update(
         return update
 
     @staticmethod
-    def _report_offload_result(file_path: str | None, failed_media: int) -> None:
+    def _require_offload_result(file_path: str | None, failed_media: int) -> None:
         if file_path is None:
-            message = (
-                "Offloading conversation history to backend failed during summarization. "
-                "Older messages will not be recoverable."
-            )
-            logger.error(message)
-            warnings.warn(message, stacklevel=3)
-        elif failed_media:
+            raise RuntimeError("自动压缩无法保存可恢复的对话历史")
+        if failed_media:
             logger.warning(
                 "Conversation history offloaded to %s, but %d media block(s) could not be offloaded.",
                 file_path,
```

**File**: `backend/test/unit/middlewares/test_summary_middleware.py` (modified, +107/-2)
```diff
@@ -47,6 +47,18 @@ def invoke(self, prompt: str, config: dict | None = None) -> SimpleNamespace:
         return SimpleNamespace(text="summary")
 
 
+class _FailingSummaryModel(_RecordingModel):
+    def invoke(self, prompt: str, config: dict | None = None) -> SimpleNamespace:
+        self.prompts.append(prompt)
+        raise RuntimeError("summary failed")
+
+
+class _EmptySummaryModel(_RecordingModel):
+    def invoke(self, prompt: str, config: dict | None = None) -> SimpleNamespace:
+        self.prompts.append(prompt)
+        return SimpleNamespace(text="  ")
+
+
 class _MemoryBackend:
     def __init__(self) -> None:
         self.writes: list[tuple[str, str]] = []
@@ -86,6 +98,13 @@ def write(self, path: str, content: str) -> SimpleNamespace:
         return SimpleNamespace(error="disk full")
 
 
+class _FailingHistoryWriteBackend(_MemoryBackend):
+    def write(self, path: str, content: str) -> SimpleNamespace:
+        if path.startswith(VIRTUAL_PATH_CONVERSATION_HISTORY):
+            return SimpleNamespace(error="disk full")
+        return super().write(path, content)
+
+
 def _scoped_backend(memory: _MemoryBackend | None = None) -> CompositeBackend:
     """按 Yuxi 契约构造 outputs 根的 CompositeBackend，验证前缀自动派生。"""
     return CompositeBackend(
@@ -921,10 +940,14 @@ def test_offload_history_uses_tool_messages_with_replaced_content() -> None:
     assert "TOOL_RESULT_SHOULD_NOT_BE_SUMMARIZED" not in history_content
 
 
-def _make_compressing_middleware(backend: _MemoryBackend) -> tuple[YuxiSummarizationMiddleware, str]:
+def _make_compressing_middleware(
+    backend: _MemoryBackend,
+    *,
+    model: _DummyModel | None = None,
+) -> tuple[YuxiSummarizationMiddleware, str]:
     large_result = "BEGIN\n" + ("raw result payload\n" * 200)
     middleware = YuxiSummarizationMiddleware(
-        model=_RecordingModel(),
+        model=model or _RecordingModel(),
         backend=backend,
         trigger=("tokens", 100),
         keep=("messages", 3),
@@ -979,6 +1002,88 @@ def handler(request: ModelRequest) -> ModelResponse:
     assert completed.get("file_path") is not None
 
 
+@pytest.mark.unit
+@pytest.mark.parametrize("async_call", [False, True], ids=["sync", "async"])
+async def test_auto_summary_fails_when_history_cannot_be_saved(
+    compression_events: list[dict],
+    async_call: bool,
+) -> None:
+    backend = _FailingHistoryWriteBackend()
+    model = _RecordingModel()
+    middleware, large_result = _make_compressing_middleware(backend, model=model)
+    messages = _compressing_messages(large_result)
+    handler_calls = 0
+
+    if async_call:
+
+        async def handler(request: ModelRequest) -> ModelResponse:
+            nonlocal handler_calls
+            handler_calls += 1
+            return ModelResponse(result=[AIMessage(content="ok")])
+
+        with pytest.raises(RuntimeError, match="无法保存可恢复的对话历史"):
+            await middleware.awrap_model_call(_model_request(messages), handler)
+    else:
+
+        def handler(request: ModelRequest) -> ModelResponse:
+            nonlocal handler_calls
+            handler_calls += 1
+            return ModelResponse(result=[AIMessage(content="ok")])
+
+        with pytest.raises(RuntimeError, match="无法保存可恢复的对话历史"):
+            middleware.wrap_model_call(_model_request(messages), handler)
+
+    assert handler_calls == 0
+    assert model.prompts == []
+    assert [event["status"] for event in compression_events] == ["started", "failed"]
+
+
+@pytest.mark.unit
+@pytest.mark.parametrize("async_call", [False, True], ids=["sync", "async"])
+@pytest.mark.parametrize(
+    ("model_type", "error_match"),
+    [
+        pytest.param(_FailingSummaryModel, "summary failed", id="model_error"),
+        pytest.param(_EmptySummaryModel, "摘要模型返回空内容", id="empty_summary"),
+    ],
+)
+async def test_auto_summary_propagates_summary_failure(
+    compression_events: list[dict],
+    async_call: bool,
+    model_type: type[_RecordingModel],
+    error_match: str,
+) -> None:
+    backend = _MemoryBackend()
+    model = model_type()
+    middleware, large_result = _make_compressing_middleware(backend, model=model)
+    messages = _compressing_messages(large_result)
+    handler_calls = 0
+
+    if async_call:
+
+        async def handler(request: ModelRequest) -> ModelResponse:
+            nonlocal handler_calls
+            handler_calls += 1
+            return ModelResponse(result=[AIMessage(content="ok")])
+
+        with pytest.raises(RuntimeError, match=error_match):
+            await middleware.awrap_model_call(_model_request(messages), handler)
+    else:
+
+        def handler(request: ModelRequest) -> ModelResponse:
+            nonlocal handler_calls
+            handler_calls += 1
+            return ModelResponse(result=[AIMessage(content="ok")])
+
+        with pytest.raises(RuntimeError, match=error_match):
+            middleware.wrap_model_call(_model_request(messages), handler)
+
+    assert handler_calls == 0
+    assert len(model.prom
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-27-auto-summary-failure-atomicity.md` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+# 自动摘要失败保持 checkpoint 原子性
+
+状态：implemented
+类型：bug-fix
+Owner：backend/package/yuxi/agents/middlewares/summary.py
+
+## 问题
+
+自动摘要把模型异常转换为 `Error generating summary: ...` 文本，并在历史文件写入失败时只记录警告。主模型随后会把错误文本当作对话历史继续运行，checkpoint 也可能保存无法回读原文的 `_summarization_event`。异步路径并发执行历史落盘和摘要调用，落盘失败时仍可能产生无用的摘要请求。
+
+## 决策
+
+自动摘要采用 fail-closed 边界。历史文件写入失败、摘要模型抛出异常或摘要内容为空时，当前模型调用直接失败，不调用主模型，也不构造新的 `_summarization_event`。PostgreSQL 中的聊天消息和 checkpoint 中已有的摘要事件保持不变。
+
+### 实现方案
+
+同步路径先保存待摘要历史并校验文件路径，再调用摘要模型和校验非空结果。异步路径按相同顺序串行执行，只有两个步骤都成功后才构造模型消息和 checkpoint update。外围 `wrap_model_call` / `awrap_model_call` 继续负责发送 `failed` 压缩事件并传播原异常。主动压缩已有的严格失败行为不变。
+
+本决定只处理自动压缩失败原子性，不改变动态模型窗口阈值、按 token 保留消息、摘要 prompt、usage 统计或 85% 手动压缩提示。
+
+## 替代方案
+
+- 保留警告并继续主模型调用：会把不可恢复或错误的摘要视图当成有效历史，拒绝采用。
+- 历史落盘和摘要继续并发，在汇总结果后统一失败：可以阻止 checkpoint 更新，但落盘失败时仍会产生无效的摘要调用。
+- 失败后回退到未压缩历史调用主模型：上下文已经达到压缩条件或发生 overflow，回退不能保证请求可执行，并会掩盖压缩失败。
+
+## 后果
+
+自动压缩失败会使当前 Run 进入既有错误通道，调用方可以观察真实失败原因；成功路径仍保存可恢复历史、生成摘要并更新 checkpoint。异步摘要失去一次与文件写入并行的延迟优化，以换取明确的先决条件和避免无效模型调用。
+
+## 验证
+
+| 验收主张 | 失败面 | 语义 Owner | 直接证据 / 命令 | 负向案例 | 当前结果 |
+|---|---|---|---|---|---|
+| 历史落盘失败不调用摘要模型或主模型 | 警告后继续并发布 event | summary.py | summary middleware unit | 同步和异步历史写入返回 `disk full` | Passed |
+| 摘要异常或空内容不进入模型历史 | 错误文本或空摘要进入 checkpoint | summary.py | summary middleware unit | 同步和异步摘要分别抛错、返回空白 | Passed |
+| 成功、overflow 和主动压缩路径保持原行为 | fail-closed 误伤正常调用 | summary.py | `test_summary_middleware.py` 全文件 35 passed | 既有成功与主动压缩用例 | Passed |
+
+最小回归命令：`docker compose exec -T api uv run --no-sync --no-dev pytest test/unit/middlewares/test_summary_middleware.py -q`。本地隔离依赖环境执行同一测试文件通过；完整 Compose gate 和真实模型 integration 由 PR 验证记录说明。
```

**File**: `docs/mechanisms/context-compression.md` (modified, +3/-1)
```diff
@@ -44,6 +44,8 @@ token 数使用近似计算，只用于压力判断和预览长度，不是计
 
 成功后，`_summarization_event` 保存累计 cutoff、摘要消息和历史文件路径。后续请求根据这个事件跳过已摘要区间，只发送当前摘要和 cutoff 之后的原始消息。再次压缩时，局部 cutoff 会换算成完整 state 的位置。
 
+自动压缩先保存历史文件，再调用摘要模型。只有历史文件和非空摘要都成功生成后，系统才构造新的 `_summarization_event`；任一步失败都会中止当前模型调用，并保留 checkpoint 中已有的摘要事件。
+
 checkpoint 只拥有模型继续运行所需的压缩视图；PostgreSQL Message 继续保存完整聊天记录。system prompt 和 tool schemas 由每次运行的当前 Agent 配置重新装配，不存入摘要 event。
 
 ## 主动压缩
@@ -87,7 +89,7 @@ Summary 触发使用近似 token 统计；主模型返回的 `usage_metadata` 
 
 ## 失败和恢复
 
-自动摘要无法保存历史文件时会记录错误，较早原文可能无法从 Workdir 恢复；摘要模型失败时错误文本会进入摘要视图，主模型调用仍可能继续。主动压缩要求历史文件和摘要都成功，失败时返回错误且不发布新的摘要 event。
+自动摘要无法保存历史文件、摘要模型报错或返回空内容时，当前模型调用失败并发送 `failed` 事件。系统不会把错误文本写入摘要视图，也不会创建或更新 `_summarization_event`。主动压缩保持相同的失败边界：历史文件和摘要都成功后才发布新的摘要 event。
 
 | 现象 | 先检查 |
 | --- | --- |
```

---

### Incident Patch 5: `7bd90b17` (2026-09-28)
**Commit Message**: fix: 统一供应商启用与保存交互 Fix: #1076

**File**: `web/src/components/model-management/ModelProviderManagePanel.vue` (modified, +81/-27)
```diff
@@ -58,6 +58,8 @@ const REQUEST_BODY_OVERRIDES_PLACEHOLDER = '{\n  "enable_thinking": false\n}'
 // Provider form state
 const showProviderModal = ref(false)
 const editingProviderId = ref(null) // null = creating, string = editing
+const originalProviderEnabled = ref(null)
+const originalProviderFields = ref('')
 const providerForm = reactive({
   provider_id: '',
   display_name: '',
@@ -77,6 +79,10 @@ const providerForm = reactive({
   headers_text: '{}',
   extra_text: '{}'
 })
+// 启用状态由标题栏独立保存，不计入其他字段的未保存判断。
+const hasUnsavedProviderFields = computed(
+  () => JSON.stringify({ ...providerForm, is_enabled: null }) !== originalProviderFields.value
+)
 
 // Model form state
 const showModelModal = ref(false)
@@ -325,6 +331,7 @@ function getProviderStatus(provider) {
 
 const openCreateProviderModal = () => {
   editingProviderId.value = null
+  originalProviderEnabled.value = null
   Object.assign(providerForm, {
     provider_id: '',
     display_name: '',
@@ -349,6 +356,7 @@ const openCreateProviderModal = () => {
 
 const openEditProviderModal = (provider) => {
   editingProviderId.value = provider.provider_id
+  originalProviderEnabled.value = provider.is_enabled !== false
   Object.assign(providerForm, {
     provider_id: provider.provider_id,
     display_name: provider.display_name,
@@ -368,6 +376,7 @@ const openEditProviderModal = (provider) => {
     headers_text: formatJsonText(provider.headers_json),
     extra_text: formatJsonText(provider.extra_json)
   })
+  originalProviderFields.value = JSON.stringify({ ...providerForm, is_enabled: null })
   showProviderModal.value = true
 }
 
@@ -428,21 +437,48 @@ const saveProvider = async () => {
   }
 }
 
-const saveProviderAndEnable = async () => {
+/** 只提交供应商启用状态，并在停用成功后关闭编辑弹窗。 */
+const applyProviderEnabled = async (enabled) => {
   saving.value = true
   try {
-    const payload = { ...buildProviderPayload(), is_enabled: true }
-    await modelProviderApi.updateProvider(providerForm.provider_id, payload)
-    message.success('供应商已保存并启用')
-    showProviderModal.value = false
+    await modelProviderApi.updateProvider(providerForm.provider_id, { is_enabled: enabled })
+    originalProviderEnabled.value = enabled
+    providerForm.is_enabled = enabled
+    if (!enabled) showProviderModal.value = false
     await loadProviders()
+    message.success(`供应商已${enabled ? '启用' : '停用'}`)
   } catch (error) {
-    message.error(error.message || '保存失败')
+    message.error(error?.response?.data?.detail || error.message || '切换供应商状态失败')
   } finally {
     saving.value = false
   }
 }
 
+/** 切换启用状态前保护默认模型与未保存的其他配置。 */
+const toggleProviderEnabled = (enabled) => {
+  if (saving.value) return
+  if (!editingProviderId.value) {
+    providerForm.is_enabled = enabled
+    return
+  }
+  if (!enabled && providerContainsDefaultModel(providerForm.provider_id)) {
+    warnDefaultModelProtected()
+    return
+  }
+  if (!enabled && hasUnsavedProviderFields.value) {
+    Modal.confirm({
+      title: '停用供应商？',
+      content: '弹窗内未保存的其他修改将丢弃；此操作只保存启用状态。',
+      okText: '停用',
+      okType: 'danger',
+      cancelText: '继续编辑',
+      onOk: () => applyProviderEnabled(enabled)
+    })
+    return
+  }
+  applyProviderEnabled(enabled)
+}
+
 const deleteProvider = async (provider) => {
   if (providerContainsDefaultModel(provider.provider_id)) {
     warnDefaultModelProtected()
@@ -476,6 +512,7 @@ const deleteProvider = async (provider) => {
 }
 
 const deleteProviderFromEdit = async () => {
+  if (saving.value) return
   const provider = providers.value.find((p) => p.provider_id === editingProviderId.value)
   if (provider) {
     deleteProvider(provider)
@@ -831,42 +868,52 @@ defineExpose({
     <!-- Provider Edit Modal -->
     <a-modal
       v-model:open="showProviderModal"
-      :title="editingProviderId ? '编辑供应商' : '新增供应商'"
       :width="560"
-      :confirm-loading="saving"
+      :closable="false"
+      :mask-closable="!saving"
+      :keyboard="!saving"
     >
+      <template #title>
+        <div class="provider-modal-titlebar">
+          <span>{{ editingProviderId ? '编辑供应商' : '新增供应商' }}</span>
+          <div class="provider-modal-status">
+            <span>启用</span>
+            <a-switch
+              :checked="editingProviderId ? originalProviderEnabled : providerForm.is_enabled"
+              :loading="saving"
+              :disabled="saving"
+              :aria-label="editingProviderId ? (originalProviderEnabled ? '停用供应商' : '启用供应商') : '创建时启用供应商'"
+              @change="toggleProviderEnabled"
+            />
+          </div>
+        </div>
+      </template>
       <template #footer>
         <div class="provider-modal-footer">
           <a-button
             v-if="editingProviderId"
             danger
             class="lucide-icon-btn"
+            :disabled="saving"
             @click="deleteProviderFromEdit"
           >
             <Trash2 :size="14" />
             删除供应商
           </a-button>
           <span v-else></span>
           
```

**File**: `web/test/unit/modelProviderSaveActions.test.js` (added, +235/-0)
```diff
@@ -0,0 +1,235 @@
+import assert from 'node:assert/strict'
+import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
+import { pid } from 'node:process'
+import { setImmediate } from 'node:timers'
+import { fileURLToPath, pathToFileURL } from 'node:url'
+import test from 'node:test'
+
+import { compileScript, parse } from 'vue/compiler-sfc'
+import { createRenderer, nextTick } from 'vue'
+
+const componentPath = fileURLToPath(
+  new URL('../../src/components/model-management/ModelProviderManagePanel.vue', import.meta.url)
+)
+const compiledPath = fileURLToPath(
+  new URL(`../../.model-provider-actions-test-${pid}.mjs`, import.meta.url)
+)
+const source = readFileSync(componentPath, 'utf8')
+const requests = []
+const confirmations = []
+const notices = []
+const configStore = { config: { default_model: 'other:model' }, refreshConfig: async () => {} }
+let updateProvider = async () => ({})
+
+globalThis.__modelProviderActionsTestDeps = {
+  message: {
+    success: (value) => notices.push(['success', value]),
+    error: (value) => notices.push(['error', value]),
+    warning: (value) => notices.push(['warning', value])
+  },
+  Modal: { confirm: (options) => confirmations.push(options) },
+  useConfigStore: () => configStore,
+  modelProviderApi: {
+    getProviders: async () => ({ data: [provider] }),
+    updateProvider: (id, payload) => {
+      requests.push([id, payload])
+      return updateProvider(id, payload)
+    }
+  },
+  TextInitial: null,
+  Image: null,
+  Video: null,
+  AudioLines: null,
+  FileText: null
+}
+
+const { descriptor } = parse(source)
+const compiled = compileScript(descriptor, { id: 'model-provider-actions-test' }).content
+const executable = compiled
+  .replace(/^import(?:\s*\{[\s\S]*?\}|\s+[A-Za-z]\w*)\s+from\s+'[^']+'\n/gm, (line) =>
+    line.includes("from 'vue'") ? line : ''
+  )
+  .replace(
+    /const __returned__ = \{[\s\S]*?\}\nObject\.defineProperty/,
+    'const __returned__ = { showProviderModal, originalProviderEnabled, providerForm, saving, openCreateProviderModal, openEditProviderModal, toggleProviderEnabled, deleteProviderFromEdit }\nObject.defineProperty'
+  )
+  .replace(
+    "import { computed, onMounted, reactive, ref } from 'vue'",
+    "import { computed, onMounted, reactive, ref } from 'vue'\nconst { message, Modal, useConfigStore, modelProviderApi, TextInitial, Image, Video, AudioLines, FileText } = globalThis.__modelProviderActionsTestDeps"
+  )
+writeFileSync(compiledPath, executable)
+let ProviderPanel
+try {
+  ;({ default: ProviderPanel } = await import(pathToFileURL(compiledPath).href))
+} finally {
+  unlinkSync(compiledPath)
+}
+ProviderPanel.render = () => null
+
+const makeNode = (type) => ({ type, children: [], props: {}, parent: null, text: '' })
+const renderer = createRenderer({
+  createElement: makeNode,
+  createText: (value) => ({ ...makeNode('text'), text: value }),
+  createComment: (value) => ({ ...makeNode('comment'), text: value }),
+  insert(child, parent) {
+    child.parent = parent
+    parent.children.push(child)
+  },
+  remove(child) {
+    const index = child.parent?.children.indexOf(child) ?? -1
+    if (index >= 0) child.parent.children.splice(index, 1)
+  },
+  setText(node, value) {
+    node.text = value
+  },
+  setElementText(node, value) {
+    node.text = value
+    node.children = []
+  },
+  parentNode: (node) => node.parent,
+  nextSibling: () => null,
+  patchProp(node, key, _previous, value) {
+    node.props[key] = value
+  }
+})
+
+function mountPanel() {
+  requests.length = 0
+  confirmations.length = 0
+  notices.length = 0
+  updateProvider = async () => ({})
+  configStore.config.default_model = 'other:model'
+  const app = renderer.createApp(ProviderPanel)
+  app.mount(makeNode('root'))
+  return { panel: app._instance.setupState, unmount: () => app.unmount() }
+}
+
+const provider = { provider_id: 'sample', display_name: 'Sample', is_enabled: true }
+const flushAsync = () => new Promise((resolve) => setImmediate(resolve))
+
+test('供应商弹窗以标题栏开关替代关闭叉号和保存并启用', () => {
+  const modal = source.slice(
+    source.indexOf('<!-- Provider Edit Modal -->'),
+    source.indexOf('</a-modal>', source.indexOf('<!-- Provider Edit Modal -->'))
+  )
+  const title = modal.slice(modal.indexOf('<template #title>'), modal.indexOf('</template>'))
+  const footerActions = modal.slice(
+    modal.indexOf('<div class="provider-modal-footer-actions">'),
+    modal.indexOf('</div>', modal.indexOf('<div class="provider-modal-footer-actions">'))
+  )
+
+  assert.match(modal, /:closable="false"/)
+  assert.match(title, /<a-switch[\s\S]*@change="toggleProviderEnabled"/)
+  assert.match(modal, /class="modal-form"[^>]*:inert="saving"/)
+  assert.match(modal, /:disabled="saving"[^>]*@click="deleteProviderFromEdit"/)
+  assert.doesNotMatch(modal, /<span>状态<\/span>|仅保存|保存并启用/)
+  assert.equal((footerActions.match(/<a-button/g) || []).length, 2)
+})
+
+test('停用只提交启用状态，成功关闭；启用成功保持打开', async () => {
+  const { panel, unmoun
```

---

### Incident Patch 6: `255edc3e` (2026-09-27)
**Commit Message**: fix: 收敛聊天多图消息交接并完善回归验证

**File**: `.github/workflows/system-tests.yml` (modified, +5/-0)
```diff
@@ -200,6 +200,11 @@ jobs:
             buildkit-minio-${{ runner.os }}-
       - name: Build topology images with cached layers
         run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner /tmp/yuxi-buildkit-cache/minio
+      # 冷 runner 的镜像下载属于环境准备，不能消耗单个 Run 的执行预算。
+      - name: Pull sandbox runtime image before timed E2E runs
+        run: |
+          sandbox_runtime_image=$(docker compose config --format json | python3 -c 'import json, sys; print(json.load(sys.stdin)["services"]["sandbox-provisioner"]["environment"]["SANDBOX_IMAGE"])')
+          docker pull "$sandbox_runtime_image"
       - name: Start focused runtime topology
         run: docker compose up -d postgres redis minio sandbox-provisioner api worker
       - name: Wait for truthful readiness
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-25-chat-multi-image.md` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@
 类型：feature
 Owner：backend/package/yuxi/services/input_message_service.py
 
+前端排队与派发的消息归属由[聊天多图的本地消息归属](./2026-09-27-chat-image-message-ownership.md)进一步收敛。
+
 ## 问题
 
 聊天输入框原先一次只能携带**一张**图片，限制写在四层：前端 file input 单选、前端单值状态、请求体 `image_content: str | None`、消息构造单参数。模型侧不是瓶颈——`deepseek-flash` 单请求上限 600 张，且实测能直读图片。
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-27-chat-image-message-ownership.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# 聊天多图的本地消息归属
+
+状态：implemented
+类型：simplification
+Owner：web/src/components/AgentChatComponent.vue
+
+## 问题
+
+多图消息在 sending → queued → 队列同步 → run_created 之间重新构造，图片字段会被只含文字的队列投影覆盖。派发后请求从服务端队列消失，而对应 SSE 事件可能尚未到达。按 request ID 单独保存图片又需要另一套清理生命周期。
+
+## 决策
+
+发送时只构造一次乐观用户消息。等待派发时由队列项的本地 message 持有；请求流在首个 await 前接住同一消息引用，在队列同步或主动派发前建立订阅。派发后将消息交给现有 msgChunks，请求流关闭时清理引用。队列快照只更新服务端协议字段，仍以 PostgreSQL 队列状态为准。
+
+直接运行与排队运行共享消息构造。SSE init 使用现有图片补齐；历史读取继续使用持久化投影。本决定收敛[多图输入决定](./2026-09-25-chat-multi-image.md)中的前端派发路径，不改变 HTTP、持久化、数量与体积契约。
+
+## 替代方案
+
+- keep：保留逐次重建，运行期间图片展示缺失。
+- narrow：逐次复制 image_contents；每次扩充用户消息都需维护额外字段清单。
+- replace：队列与请求流携带同一用户消息，派发时交接，采用。
+- remove：移除专门的乐观消息插入包装和队列图片字段重建。历史和旧单值 API 兼容仍有消费者，保留。
+
+## 后果
+
+本地消息引用沿现有队列、订阅和消息区生命周期移动。取消、失败与派发复用请求流的清理。页面重载依赖服务端历史，浏览器内的引用不承担持久化职责。
+
+## 验证
+
+- Web unit 组装队列快照、请求 SSE 与 Run init，验证单图、多图顺序和派发时附件保留；修改前图片断言失败，修改后通过。
+- 空快照先于 run_created 到达的测试覆盖恢复订阅、继续队列与 steer，三条用例在修复前均失败。
+- 取消测试验证只释放目标请求；占位上传测试保留并发数量与顺序约束。
+- 浏览器探针使用真实 Vue 消息组件与队列模块、受控接口响应，检查派发和 init 后图片 DOM；不替代真实模型和后端 E2E。
+- 旧能力不存在：运行时代码搜索 sentImagesByRequest、insertOptimisticHumanMessage 均无命中，队列派发不再拼装 image_contents/image_content 字段；无新增 export、配置、wire 字段、迁移或依赖。
+- 重新引入条件：出现无法由用户消息生命周期承载的独立图片业务时，再评估专用缓存。
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-27-ci-sandbox-image-preparation.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# 确定性 E2E 的沙盒镜像准备
+
+状态：implemented
+类型：testing
+Owner：.github/workflows/system-tests.yml
+
+## 问题
+
+Runtime System Tests 的冷 runner 只预先构建 API、provisioner 和 MinIO 镜像。首次 execute 创建沙盒时，Docker SDK 在镜像不存在的情况下同步拉取镜像，下载时间计入 E2E 的 240 秒 Run 预算。审批恢复测试在 main 与多图 PR 上均出现等待 SSE 超时，清理后执行请求返回 sandbox not found。
+
+## 决策
+
+focused runtime job 在启动拓扑前，读取 Compose 解析后的 SANDBOX_IMAGE 并执行 docker pull。下载失败归属环境准备步骤。Run 超时、断言、测试选择器和真实沙盒调用保持不变。
+
+## 替代方案
+
+- 延长 Run 超时：混淆环境下载与执行耗时，不采用。
+- 跳过 execute 或改为 mock：无法验证审批恢复后的真实工具审计与落盘，不采用。
+- 在 workflow 硬编码镜像：与 Compose 事实源重复，不采用。
+
+## 后果
+
+首次镜像下载仍需时间，但位于独立可诊断步骤。该改动只影响 CI；shipping runtime 继续惰性创建沙盒。
+
+## 验证
+
+Docker SDK 的 ImageNotFound 分支确实执行同步 images.pull；CI 使用解析后的 Compose 镜像。原失败用例仍由同一 workflow 执行，最终结果以该提交实际 CI 为准，镜像预拉取本身不证明业务正确。
```

**File**: `web/src/components/AgentChatComponent.vue` (modified, +14/-48)
```diff
@@ -2535,27 +2535,13 @@ const buildOptimisticHumanMessage = ({
   }
 
   if (imageContents.length) {
-    // 必须用列表键：用单值键时 2..10 张在乐观阶段只显示第一张
     message.image_contents = imageContents
     message.image_content = imageContents[0]
   }
 
   return message
 }
 
-// 发送 runs 前先在前端插入一条用户消息，避免等待 worker 轮询后消息才出现。
-const insertOptimisticHumanMessage = (
-  threadState,
-  { requestId, text, imageContents = [], attachments = [] }
-) => {
-  if (!threadState || !requestId) return
-  threadState.pendingRequestId = requestId
-  threadState.replyLoadingVisible = false
-  threadState.onGoingConv.msgChunks[requestId] = [
-    buildOptimisticHumanMessage({ requestId, text, imageContents, attachments })
-  ]
-}
-
 const markAttachmentsRequestId = (threadId, attachments, requestId) => {
   if (!threadId || !attachments.length) return null
   const previousAttachments = threadAttachmentsMap.value[threadId] || []
@@ -3375,28 +3361,24 @@ const handleSendMessage = async ({ images = [], queuePolicy = 'enqueue' } = {})
 
   const requestId = createClientRequestId()
   const previousAttachments = markAttachmentsRequestId(threadId, pendingAttachments, requestId)
+  const inputMessage = buildOptimisticHumanMessage({
+    requestId,
+    text,
+    imageContents,
+    attachments: pendingAttachments.map((attachment) => ({ ...attachment, request_id: requestId }))
+  })
   if (!hadActiveRun) {
     resetOnGoingConv(threadId)
-    insertOptimisticHumanMessage(threadState, {
-      requestId,
-      text,
-      imageContents,
-      attachments: pendingAttachments.map((attachment) => ({
-        ...attachment,
-        request_id: requestId
-      }))
-    })
+    threadState.pendingRequestId = requestId
+    threadState.onGoingConv.msgChunks[requestId] = [inputMessage]
     threadState.isStreaming = true
   } else {
     threadState.queuedRequests.push({
       request_id: requestId,
       status: 'sending',
       content: text,
-      created_at: new Date().toISOString(),
-      // 图片必须一并记住：这条本地排队项会在派发时被用来重建用户消息
-      ...(imageContents.length
-        ? { message_type: 'multimodal_image', image_contents: imageContents, image_content: imageContents[0] }
-        : {})
+      created_at: inputMessage.created_at,
+      message: inputMessage
     })
   }
 
@@ -3416,9 +3398,6 @@ const handleSendMessage = async ({ images = [], queuePolicy = 'enqueue' } = {})
     })
     const status = runResp?.status
     const runId = runResp?.run_id
-    const sendingRequest = threadState.queuedRequests.find(
-      (request) => request.request_id === requestId
-    )
     threadState.queuedRequests = threadState.queuedRequests.filter(
       (request) => request.request_id !== requestId
     )
@@ -3430,37 +3409,24 @@ const handleSendMessage = async ({ images = [], queuePolicy = 'enqueue' } = {})
       }
     }
     if (status === 'queued' || (!runId && status !== 'rejected')) {
-      for (const msg of threadState.onGoingConv.msgChunks[requestId] || []) {
-        if (msg.type === 'human') msg.delivery_status = 'queued'
-      }
+      inputMessage.delivery_status = 'queued'
       threadState.queuedRequests = threadState.queuedRequests || []
       threadState.queuedRequests.push({
         request_id: requestId,
         status: 'queued',
         queue_policy: runResp?.queue_policy || queuePolicy,
         queue_position: runResp?.queue_position || 1,
         content: text,
-        created_at: sendingRequest?.created_at
+        created_at: inputMessage.created_at,
+        message: inputMessage
       })
       if (!hadActiveRun) {
         threadState.isStreaming = false
         threadState.replyLoadingVisible = false
       }
       await resumeQueuedRequests(threadId, resolveAgentSlugForThread(threadId))
     } else if (runId) {
-      if (sendingRequest) {
-        threadState.onGoingConv.msgChunks[requestId] = [
-          {
-            ...buildOptimisticHumanMessage({
-              requestId,
-              text,
-              imageContents,
-              attachments: pendingAttachments
-            }),
-            created_at: sendingRequest.created_at
-          }
-        ]
-      }
+      threadState.onGoingConv.msgChunks[requestId] = [inputMessage]
       threadState.pendingRequestId = requestId
       await startRunStream(threadId, runId, 0, { requestId })
     } else {
```

**File**: `web/src/components/AgentInputArea.vue` (modified, +1/-2)
```diff
@@ -140,8 +140,7 @@ const emit = defineEmits([
 ])
 
 const inputRef = ref(null)
-// 已上传成功的图片（每项就是 uploadMultimodalImage 的返回值 + localId）。
-// 只放成功项：上传中与失败由 message 提示承担，避免列表里出现不可用的空卡片。
+// 按选择顺序保存上传占位和成功结果，上传中的项也占用名额。
 const currentImages = ref([])
 let localIdSeed = 0
 const nextLocalId = () => `image-${(localIdSeed += 1)}`
```

**File**: `web/src/composables/useAgentRequestQueue.js` (modified, +28/-24)
```diff
@@ -63,7 +63,13 @@ export function useAgentRequestQueue({
       const requests = resp?.requests || []
       const knownIds = new Set(requests.map((request) => request.request_id))
       ts.queuedRequests = [
-        ...requests,
+        ...requests.map((request) => {
+          const localMessage = ts.queuedRequests?.find(
+            (item) => item.request_id === request.request_id
+          )?.message
+          // 队列接口只投影状态与文字，本地用户消息随队列项保留到派发或取消。
+          return localMessage ? { ...request, message: localMessage } : request
+        }),
         ...(ts.queuedRequests || []).filter(
           (request) => request.status === 'sending' && !knownIds.has(request.request_id)
         )
@@ -74,31 +80,37 @@ export function useAgentRequestQueue({
     }
   }
 
-  /** 同步线程队列后恢复仍在途的请求流。 */
-  const resumeQueuedRequests = async (threadId, agentSlug) => {
-    if (!threadId || !agentSlug) return
-
-    await syncQueuedRequests(threadId, agentSlug)
-    const latestTs = getThreadState(threadId)
-    if (!latestTs) return
-
-    for (const request of latestTs.queuedRequests || []) {
+  /** 为已接入请求建立订阅，在队列快照移除已派发项前接住本地消息。 */
+  const subscribeQueuedRequests = (threadId) => {
+    for (const request of getThreadState(threadId)?.queuedRequests || []) {
       if (request?.request_id && request.status !== 'sending') {
         void startRequestStream(threadId, request.request_id)
       }
     }
   }
 
+  /** 同步前保留本地请求，同步后订阅服务端新增项。 */
+  const resumeQueuedRequests = async (threadId, agentSlug) => {
+    if (!threadId || !agentSlug) return
+    subscribeQueuedRequests(threadId)
+    await syncQueuedRequests(threadId, agentSlug)
+    subscribeQueuedRequests(threadId)
+  }
+
   const startRequestStream = async (threadId, requestId) => {
     if (!threadId || !requestId) return
     const ts = getThreadState(threadId)
     if (!ts) return
 
     ts.requestStreams = ts.requestStreams || {}
-    if (ts.requestStreams[requestId]) return
+    const message = ts.queuedRequests?.find((request) => request.request_id === requestId)?.message
+    if (ts.requestStreams[requestId]) {
+      ts.requestStreams[requestId].message ||= message
+      return
+    }
 
     const controller = new AbortController()
-    const entry = { controller, position: 0, status: 'queued' }
+    const entry = { controller, position: 0, status: 'queued', message }
     ts.requestStreams[requestId] = entry
 
     try {
@@ -123,27 +135,17 @@ export function useAgentRequestQueue({
           entry.status = 'dispatched'
           if (data.run_id) {
             const request = tsInner.queuedRequests?.find((item) => item.request_id === requestId)
-            // 派发时若本地已无该请求的消息（发送时的乐观消息可能已被重置清掉），
-            // 就用请求重新拼一条；图片来自排队记录自带的 image_contents，
-            // 不另设缓存——独立缓存需要覆盖所有终态清理，容易漏。
-            const localImages = request?.image_contents || []
             const requestMessages =
               tsInner.onGoingConv?.msgChunks?.[requestId] ||
+              (innerEntry.message ? [innerEntry.message] : null) ||
               (request
                 ? [
                     {
                       id: request.input_message_id || requestId,
                       type: 'human',
                       request_id: requestId,
                       content: request.content,
-                      created_at: request.created_at,
-                      ...(localImages.length
-                        ? {
-                            message_type: 'multimodal_image',
-                            image_contents: localImages,
-                            image_content: request?.image_content || localImages[0]
-                          }
-                        : {})
+                      created_at: request.created_at
                     }
                   ]
                 : null)
@@ -194,6 +196,7 @@ export function useAgentRequestQueue({
     if (!ts || !threadId || !agentSlug || ts.continueQueueInFlight) return false
 
     ts.continueQueueInFlight = true
+    subscribeQueuedRequests(threadId)
     try {
       const response = await agentApi.continueThreadQueue(threadId, agentSlug)
       await syncQueuedRequests(threadId, agentSlug)
@@ -213,6 +216,7 @@ export function useAgentRequestQueue({
     const ts = getThreadState(threadId)
     if (!ts || !threadId || !agentSlug || !requestId) return false
 
+    void startRequestStream(threadId, requestId)
     try {
       await agentApi.steerRequest(requestId)
       await syncQueuedRequests(threadId, agentSlug)
```

**File**: `web/test/browser/chatMultiImage.js` (modified, +60/-36)
```diff
@@ -22,7 +22,25 @@ async (page) => {
 
   const previews = () => page.locator('.image-preview-list img')
   const attachmentCards = () => page.locator('.attachment-file-card')
-  const composer = page.locator('.input-box')
+  // 使用真实 FileList 构造拖拽事件，避免依赖 CLI 专有 drop 命令。
+  const dropFile = async (path) => {
+    await page.evaluate(() => {
+      const input = document.createElement('input')
+      input.type = 'file'
+      input.id = 'test-drop-file'
+      input.hidden = true
+      document.body.append(input)
+    })
+    await page.locator('#test-drop-file').setInputFiles(path)
+    await page.locator('#test-drop-file').evaluate((input) => {
+      const dataTransfer = new DataTransfer()
+      for (const file of input.files) dataTransfer.items.add(file)
+      document.querySelector('.input-box').dispatchEvent(
+        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer })
+      )
+      input.remove()
+    })
+  }
 
   // toast 生命周期只有 3 秒，而工具往返更久，所以先记账再触发
   await page.evaluate(() => {
@@ -39,45 +57,23 @@ async (page) => {
   // ---- 1. 菜单多选：一次投两张 ----
   await page.getByRole('button', { name: '添加内容' }).click()
   await page.waitForTimeout(600)
-  await page.getByText('上传图片', { exact: true }).click()
-  await page.waitForTimeout(400)
-  const chooser = await page.waitForEvent('filechooser')
+  const [chooser] = await Promise.all([
+    page.waitForEvent('filechooser'),
+    page.getByText('上传图片', { exact: true }).click()
+  ])
   check(chooser.isMultiple(), '菜单里的图片选择器不是多选，一次只能选一张')
   await chooser.setFiles([`${FIXTURES}/imgA.png`, `${FIXTURES}/imgB.png`])
   await page.waitForTimeout(6000)
   check((await previews().count()) === 2, '两张图片没有同时出现在输入区')
   check((await attachmentCards().count()) === 0, '图片被误当成附件')
 
-  // ---- 2. 运行开始后用户消息必须一直带着图片 ----
-  // 回归守卫：运行开始时的消息重建只认得服务端请求对象（其中没有图片字段），
-  // 一旦重建路径丢图，运行期间用户消息会只剩文字、运行结束后才被历史刷新补回。
-  await page.evaluate(() => {
-    window.__imgSamples = []
-    const timer = setInterval(() => {
-      const humans = Array.from(document.querySelectorAll('.message-box.human'))
-      window.__imgSamples.push({
-        humanBoxes: humans.length,
-        msgImgs: document.querySelectorAll('.message-image img').length
-      })
-    }, 150)
-    window.__stopImgSampling = () => clearInterval(timer)
-  })
-  await page.waitForTimeout(15000)
-  await page.evaluate(() => window.__stopImgSampling && window.__stopImgSampling())
-  const imgSamples = await page.evaluate(() => window.__imgSamples || [])
-  const strandedWithoutImages = imgSamples.filter((s) => s.humanBoxes > 0 && s.msgImgs === 0).length
-  check(
-    strandedWithoutImages === 0,
-    `运行期间有 ${strandedWithoutImages} 次采样显示用户消息没有图片（运行中丢图）`
-  )
-
   // ---- 3. 拖拽分流：图片进 vision，PDF 进附件 ----
-  await composer.drop({ files: `${FIXTURES}/imgA.png` })
+  await dropFile(`${FIXTURES}/imgA.png`)
   await page.waitForTimeout(5000)
   check((await previews().count()) === 3, '拖入图片没有进入图片通道')
   check((await attachmentCards().count()) === 0, '拖入图片被误当成附件')
 
-  await composer.drop({ files: `${FIXTURES}/sample.pdf` })
+  await dropFile(`${FIXTURES}/sample.pdf`)
   await page.waitForTimeout(4000)
   check((await page.locator('.ant-modal-wrap:visible').count()) === 1, '拖入 PDF 没有打开附件弹窗')
   check((await previews().count()) === 3, '拖入 PDF 被误当成图片')
@@ -101,10 +97,36 @@ async (page) => {
   })
 
   await page.locator('.input-box textarea, .user-input.mention-editor').first().click()
-  await page.keyboard.type('这两张图分别写了什么字？只回答图片上的文字。')
+  await page.keyboard.type('这三张图分别写了什么字？只回答图片上的文字。')
   await page.waitForTimeout(500)
+  // 发送前开始采样，发送后检查本次消息的全部图片。
+  // 回归守卫：运行开始时的消息重建只认得服务端请求对象（其中没有图片字段），
+  // 一旦重建路径丢图，运行期间用户消息会只剩文字、运行结束后才被历史刷新补回。
+  await page.evaluate(() => {
+    window.__imgSamples = []
+    const timer = setInterval(() => {
+      const humans = Array.from(document.querySelectorAll('.message-box.human')).filter(
+        (element) => element.textContent.includes('这三张图分别写了什么字')
+      )
+      window.__imgSamples.push({
+        humanBoxes: humans.length,
+        msgImgs: humans[0]?.previousElementSibling?.querySelectorAll('img').length || 0
+      })
+    }, 150)
+    window.__stopImgSampling = () => clearInterval(timer)
+  })
   await page.keyboard.press('Enter')
   await page.waitForTimeout(45000)
+  await page.evaluate(() => window.__stopImgSampling && window.__stopImgSampling())
+  const imgSamples = await page.evaluate(() => window.__imgSamples || [])
+  check(imgSamples.some((s) => s.humanBoxes > 0), '采样期间未观察到本次用户消息')
+  const strandedWithoutImages = imgSamples.filter((s) => s.humanBoxes > 0 && s.msgImgs !== 3).length
+  check(
+    strandedWithoutImages === 0,
+    `运行期间有 ${strandedWithoutImages} 次采样显示用户消息没有图片（运行中丢图）`
+  )
+
+
 
   const sent = posted.at(-1)
   check(Array.isArray(sent) && sent.length === 3, `请求体里的 image_content 不是 3 张的数组：${JSON.stringify(sent)?.slice(0, 60)}`)
@@ -153,9 +175,10 @@ async (page) => {
   const runsBefore = posted.length
   await page.getByRole('button', { nam
```

---

### Incident Patch 7: `23576378` (2026-09-27)
**Commit Message**: fix(deploy): MinIO 镜像改为仓库内构建 (#1077)

MinIO 官方镜像的三个来源都已不可用：Docker Hub 于 2026-09-11 前后移除
minio/minio 与 minio/mc，quay.io 自 2026-09-24 起拒绝匿名拉取，dl.min.io
返回 410。两份 Compose 在新机器上因此无法启动，CI 的两条 system-tests job
也恒定失败（main 自身同样失败，所有 PR 都拿不到这两条绿色检查）。

新增 docker/minio/Dockerfile 与入口脚本：构建参数固定 MinIO 版本与两个架构
各自的 sha256，运行时按 TARGETARCH 选择对应的官方 GitHub Release 资产、下载
后校验，校验不通过即构建失败。下架前镜像内的 /opt/bin/minio 与该 Release 的
amd64 资产逐字节相同，因此重建后的运行时内容不变。

两份 Compose 的 MinIO 服务改为本地构建，环境变量、卷、健康检查与 command
保持不变；离线导出脚本与 init 预热脚本改为构建后再导出/预热；CI 的预构建
脚本与层缓存纳入该镜像。

验证：三方 sha256 一致（镜像内文件、Release 声明、下架前镜像）；同一数据
目录下下架前镜像写入 → 自建镜像读出并写回 → 下架前镜像读回均成功；
docker compose up -d minio 后 healthcheck 达到 healthy，容器内
/minio/health/live 可达，9001 控制台仍在监听；以 TARGETARCH=arm64 构建成功，
以 s390x 与错误的 sha256 各验证一次显式失败；全仓符号搜索无遗留外部引用；
工程契约检查、62 项契约单测、docs build 与 git diff --check 通过。

独立 Review 后修正：quay.io 的失效归因改为「minio/minio 这个仓库不再公开」
（同 registry 的 coreos/etcd 匿名拉取仍正常，实测 token 授予 pull 且 manifest 200）；
离线导出脚本改为从 compose 解析镜像名，避免与写在 .env 里的 COMPOSE_PROJECT_NAME
漂移，并保持「尽力拉取、由 docker save 把关」的容错；curl 增加 --retry-all-errors；
被实测证伪的负向案例与不成立的绝对化表述改为如实说明。

未验证：本 PR 自身的 CI 结果；arm64 主机上的实际运行；CI 的 buildx 路径
（本机未安装 buildx）；两个 PowerShell 脚本仅静态审阅（本机无 pwsh）。



**File**: `.github/workflows/system-tests.yml` (modified, +16/-2)
```diff
@@ -81,8 +81,15 @@ jobs:
           key: buildkit-sandbox-provisioner-${{ runner.os }}-${{ hashFiles('docker/sandbox_provisioner/requirements.txt', 'docker/sandbox_provisioner/Dockerfile') }}
           restore-keys: |
             buildkit-sandbox-provisioner-${{ runner.os }}-
+      - name: Restore minio image layer cache
+        uses: actions/cache@v4
+        with:
+          path: /tmp/yuxi-buildkit-cache/minio
+          key: buildkit-minio-${{ runner.os }}-${{ hashFiles('docker/minio/Dockerfile', 'docker/minio/docker-entrypoint.sh') }}
+          restore-keys: |
+            buildkit-minio-${{ runner.os }}-
       - name: Build topology images with cached layers
-        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner
+        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner /tmp/yuxi-buildkit-cache/minio
       - name: Start durable-task runtime topology
         run: docker compose up -d postgres redis minio etcd milvus sandbox-provisioner api worker
       - name: Wait for durable-task topology readiness
@@ -184,8 +191,15 @@ jobs:
           key: buildkit-sandbox-provisioner-${{ runner.os }}-${{ hashFiles('docker/sandbox_provisioner/requirements.txt', 'docker/sandbox_provisioner/Dockerfile') }}
           restore-keys: |
             buildkit-sandbox-provisioner-${{ runner.os }}-
+      - name: Restore minio image layer cache
+        uses: actions/cache@v4
+        with:
+          path: /tmp/yuxi-buildkit-cache/minio
+          key: buildkit-minio-${{ runner.os }}-${{ hashFiles('docker/minio/Dockerfile', 'docker/minio/docker-entrypoint.sh') }}
+          restore-keys: |
+            buildkit-minio-${{ runner.os }}-
       - name: Build topology images with cached layers
-        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner
+        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner /tmp/yuxi-buildkit-cache/minio
       - name: Start focused runtime topology
         run: docker compose up -d postgres redis minio sandbox-provisioner api worker
       - name: Wait for truthful readiness
```

**File**: `docker-compose.prod.yml` (modified, +4/-1)
```diff
@@ -298,10 +298,13 @@ services:
     restart: unless-stopped
 
   minio:
+    build:
+      context: ./docker/minio
+      dockerfile: Dockerfile
     ports:
       - "127.0.0.1:${YUXI_MINIO_API_PORT:-10000}:9000"
       - "127.0.0.1:${YUXI_MINIO_CONSOLE_PORT:-10001}:9001"
-    image: quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z
+    image: ${COMPOSE_PROJECT_NAME:-yuxi}-minio:RELEASE.2023-03-20T20-16-18Z
     environment:
       MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:?Set MINIO_ACCESS_KEY in .env.prod}
       MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:?Set MINIO_SECRET_KEY in .env.prod}
```

**File**: `docker-compose.yml` (modified, +4/-1)
```diff
@@ -355,7 +355,10 @@ services:
     restart: unless-stopped
 
   minio:
-    image: quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z
+    build:
+      context: ./docker/minio
+      dockerfile: Dockerfile
+    image: ${COMPOSE_PROJECT_NAME:-yuxi}-minio:RELEASE.2023-03-20T20-16-18Z
     environment:
       MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
       MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
```

**File**: `docker/minio/Dockerfile` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+# MinIO 的官方镜像已不再公开分发：Docker Hub 于 2026-09-11 前后移除 minio/minio 与
+# minio/mc，quay.io 上 minio/minio 这个仓库自 2026-09-24 起不再对匿名用户公开（同一
+# registry 上其他镜像仍可匿名拉取），dl.min.io 返回 410。此处按官方 GitHub Release
+# 发布的二进制重建镜像：版本与 sha256 都取自 release 资产并在构建时校验，运行的是与
+# 下架前镜像逐字节相同的 MinIO 二进制（基础镜像与镜像内附带文件不同，见部署文档）。
+FROM alpine:3.20
+
+ARG MINIO_VERSION=RELEASE.2023-03-20T20-16-18Z
+# 来源：https://github.com/minio/minio/releases/download/<版本>/minio.linux-<arch>.<版本>.sha256sum
+ARG MINIO_SHA256_AMD64=df0de9982c4ae440d2c9617bc1da805cf71eb7d9ce5b106b3fdb036fa27ba163
+ARG MINIO_SHA256_ARM64=d9c80afe0455f30726457ed7af0af28e1dc8a506ebaf2418ed7d89d763674ff2
+ARG TARGETARCH
+
+# curl 供 Compose 的健康检查使用
+RUN apk add --no-cache ca-certificates curl
+
+RUN set -eux; \
+    arch="${TARGETARCH:-$(apk --print-arch)}"; \
+    case "$arch" in \
+        amd64|x86_64) sha256="${MINIO_SHA256_AMD64}"; asset="minio.linux-amd64.${MINIO_VERSION}";; \
+        arm64|aarch64) sha256="${MINIO_SHA256_ARM64}"; asset="minio.linux-arm64.${MINIO_VERSION}";; \
+        *) echo "MinIO 未提供该架构的二进制: ${arch}" >&2; exit 1;; \
+    esac; \
+    mkdir -p /opt/bin; \
+    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors -o /opt/bin/minio \
+        "https://github.com/minio/minio/releases/download/${MINIO_VERSION}/${asset}"; \
+    echo "${sha256}  /opt/bin/minio" | sha256sum -c -; \
+    chmod +x /opt/bin/minio
+
+# 与原镜像保持一致：二进制位于 /opt/bin，且该目录在 PATH 中
+ENV PATH="/opt/bin:${PATH}"
+
+COPY docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
+RUN chmod 0755 /usr/bin/docker-entrypoint.sh
+
+EXPOSE 9000 9001
+
+ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
+CMD ["minio"]
```

**File**: `docker/minio/docker-entrypoint.sh` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+#!/bin/sh
+# 与原镜像的 /usr/bin/docker-entrypoint.sh 保持同一语义：命令首项不是 minio 时自动前置，
+# 因此 `command: minio server ...` 与 `docker run <镜像> server ...` 都能工作。
+# 原脚本另支持用 MINIO_USERNAME/MINIO_GROUPNAME 切换运行用户；仓库两份 Compose 都未使用，
+# 故不引入 useradd/setpriv 依赖。
+if [ "${1}" != "minio" ] && [ -n "${1}" ]; then
+    set -- minio "$@"
+fi
+
+exec "$@"
```

**File**: `docker/save_docker_images.ps1` (modified, +18/-2)
```diff
@@ -1,5 +1,8 @@
 # PowerShell脚本，用于在Windows系统上打包Docker镜像
 
+# 输出目录与 docker/minio 都相对仓库根；从别处调用时先切过去。
+Set-Location (Split-Path -Parent $PSScriptRoot)
+
 # 创建输出目录
 $OutputDir = "docker_images_backup"
 if (!(Test-Path $OutputDir)) {
@@ -21,12 +24,25 @@ $Images = @(
     "nginx:alpine",
     "neo4j:5.26.29",
     "quay.io/coreos/etcd:v3.5.5",
-    "quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z",
     "milvusdb/milvus:v2.5.6",
     # "lmsysorg/sglang:v0.4.9.post3-cu126",
     # "ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlex/paddlex:paddlex3.0.1-paddlepaddle3.0.0-gpu-cuda11.8-cudnn8.9-trt8.6"
 )
 
+# MinIO 的官方镜像已不再公开分发，改为按仓库内 Dockerfile 构建后再导出。
+# 镜像名从 Compose 解析而不是拼装：它跟随 .env 里的 COMPOSE_PROJECT_NAME，与 docker compose up 实际
+# 使用的名字一致；硬编码会在用户改过项目名时导出另一个 tag，目标机器上只能现场构建，离线环境直接失败。
+docker compose build minio
+if ($LASTEXITCODE -ne 0) {
+    Write-Host "❌ MinIO 镜像构建失败" -ForegroundColor Red
+    exit 1
+}
+$MinioImage = docker compose config --images | Where-Object { $_ -match '-minio:RELEASE' } | Select-Object -First 1
+if (-not $MinioImage) {
+    Write-Host "❌ 未能从 Compose 配置解析出 MinIO 镜像名" -ForegroundColor Red
+    exit 1
+}
+
 # 确保所有镜像都已下载
 foreach ($Image in $Images) {
     Write-Host "正在拉取镜像: $Image" -ForegroundColor Yellow
@@ -35,7 +51,7 @@ foreach ($Image in $Images) {
 
 # 保存所有镜像到单个tar文件
 Write-Host "正在保存镜像到tar文件..." -ForegroundColor Yellow
-docker save $Images -o $OutputFile
+docker save ($Images + $MinioImage) -o $OutputFile
 
 # 计算文件大小
 $FileInfo = Get-Item $OutputFile
```

**File**: `docker/save_docker_images.sh` (modified, +17/-4)
```diff
@@ -1,4 +1,8 @@
 #!/bin/bash
+set -euo pipefail
+
+# 输出目录与 docker/minio 都相对仓库根；从别处调用时先切过去。
+cd "$(dirname "$0")/.."
 
 # 创建输出目录
 OUTPUT_DIR="docker_images_backup"
@@ -18,19 +22,28 @@ IMAGES=(
     "nginx:alpine",
     "neo4j:5.26.29",
     "quay.io/coreos/etcd:v3.5.5",
-    "quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z",
     "milvusdb/milvus:v2.5.6",
 )
 
-# 确保所有镜像都已下载
+# MinIO 的官方镜像已不再公开分发，改为按仓库内 Dockerfile 构建后再导出。
+# 镜像名从 Compose 解析而不是拼装：它跟随 .env 里的 COMPOSE_PROJECT_NAME，与 docker compose up 实际
+# 使用的名字一致；硬编码会在用户改过项目名时导出另一个 tag，目标机器上只能现场构建，离线环境直接失败。
+docker compose build minio
+MINIO_IMAGE=$(docker compose config --images | grep -- '-minio:RELEASE') || {
+    echo "❌ 未能从 Compose 配置解析出 MinIO 镜像名（需要可用的 .env）"
+    exit 1
+}
+
+# 确保所有基础镜像都已下载。拉取失败不中止：导出机常已通过 scripts/pull_image.sh 的镜像源备好镜像，
+# 此时直连 Docker Hub 会失败，而能否导出由最后的 docker save 把关。
 for IMAGE in "${IMAGES[@]}"; do
     echo "正在拉取镜像: $IMAGE"
-    docker pull $IMAGE
+    docker pull "$IMAGE" || echo "⚠️ ${IMAGE} 拉取失败，继续使用本地镜像"
 done
 
 # 保存所有镜像到单个 tar 文件
 echo "正在保存镜像到 tar 文件..."
-docker save ${IMAGES[@]} -o $OUTPUT_FILE
+docker save ${IMAGES[@]} "$MINIO_IMAGE" -o $OUTPUT_FILE
 
 # 计算文件大小
 FILE_SIZE=$(du -h $OUTPUT_FILE | cut -f1)
```

**File**: `docs/advanced/deployment.md` (modified, +3/-1)
```diff
@@ -235,13 +235,15 @@ Yuxi 本体使用 MIT License。Compose 依赖以独立进程运行，Yuxi 通
 | 组件 | 镜像引用 | 许可证 |
 | --- | --- | --- |
 | Neo4j Community | `neo4j:5.26.29` | GPL-3.0-only |
-| MinIO | `quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z` | AGPL-3.0 |
+| MinIO | 本地构建：`<项目名>-minio:RELEASE.2023-03-20T20-16-18Z`（`docker/minio/Dockerfile`；项目名取 `COMPOSE_PROJECT_NAME`，默认 `yuxi`） | AGPL-3.0 |
 | Milvus | `milvusdb/milvus:v2.5.6` | Apache-2.0 |
 | etcd | `quay.io/coreos/etcd:v3.5.5` | Apache-2.0 |
 | PostgreSQL | `postgres:16` | PostgreSQL License |
 | Redis | `redis:7.4.10-alpine` | RSALv2 / SSPLv1（均非 OSI 许可证） |
 | MinerU / PaddleX（可选） | `mineru-vllm:latest` / `paddlex:latest` | 以各自 Dockerfile 和上游声明为准 |
 
+MinIO 的镜像由本仓库构建：MinIO 在 Docker Hub 与 quay.io 上的镜像已不再公开分发（同一 registry 上其他镜像仍可匿名拉取），`dl.min.io` 返回 410。Compose 按 `docker/minio/Dockerfile` 构建该镜像，构建时从官方 GitHub Release 下载固定版本的二进制并校验 sha256；它运行与下架前镜像逐字节相同的 MinIO 二进制，基础镜像与镜像内附带文件则不同（不再包含 `mc`、`minisig` 与 `*_FILE` 变量默认值）。
+
 这张表只覆盖 Compose 的主要镜像本体，不是完整的软件物料清单，也不承诺 `latest` 镜像的内容固定。镜像还可能包含各自的基础系统和传递依赖，离线交付前要按实际 digest 核对许可证、版权声明和对应源码。
 
 如果通过 `docker/save_docker_images.sh` 或其他方式向第三方再分发包含 GPL/AGPL 软件的镜像，需要保留许可证文本和上游声明，并按对应许可证第 6 节提供匹配的完整对应源码或有效的书面源码要约。通过网络提供服务、修改 AGPL 组件或把组件集成进同一程序时，义务可能不同，不能只附一个上游链接就视为完成。
```

---

### Incident Patch 8: `4eeecf86` (2026-09-24)
**Commit Message**: fix(sandbox): 合并原生 grep 搜索修复

合并 feat/sandbox-grep-nul-fix，保留 main 既有提交，无冲突。

验证：完整 main 挂载至隔离 yuxi-api:0.7.3 测试容器，pytest test/unit -m not-slow 对应选择器通过 2357 项（6 warnings）；工程契约与其 62 项单测通过；此前真实沙盒 HTTP/ToolMessage 集成与独立 Review 已通过。

环境限制：Compose uv run 被已安装 editable 包写权限阻断；直接 python 的 Compose 测试有 2 项沙盒 profile 预期失败及 58 项仓库文件缺失跳过，完整仓库隔离测试全部通过。完整 Agent/worker E2E 未执行。

**File**: `backend/package/yuxi/agents/backends/sandbox/backend.py` (modified, +70/-1)
```diff
@@ -13,6 +13,7 @@
 
 import httpx
 from deepagents.backends.protocol import (
+    ASYNC_GREP_TIMEOUT,
     EditResult,
     ExecuteResponse,
     FileDownloadResponse,
@@ -714,6 +715,52 @@ def edit(
 
         return EditResult(path=normalized_path, occurrences=count if replace_all else 1)
 
+    def _grep_root(self, pattern: str, path: str, glob: str | None, max_count: int | None) -> GrepResult:
+        """调用沙盒原生文件搜索并映射结构化结果。"""
+        if glob and ".." in glob.replace("\\", "/").split("/"):
+            return GrepResult(error="Invalid glob pattern: path traversal is not allowed")
+        kwargs: dict[str, Any] = {
+            "path": path,
+            "pattern": pattern,
+            "fixed_strings": True,
+            "recursive": True,
+        }
+        if glob:
+            # 原生 include 按完整路径匹配，目录 glob 必须锚定到当前搜索根。
+            escaped_root = "".join("\\" + char if char in "\\*?[]{}" else char for char in path.rstrip("/"))
+            kwargs["include"] = [f"{escaped_root}/{glob.lstrip('/')}" if "/" in glob else glob]
+        if max_count is not None:
+            kwargs["max_results"] = max_count
+        try:
+            from agent_sandbox.types import FileGrepResult
+
+            connection = self._get_connection()
+            # SDK 0.0.30 把失败响应也解码为成功模型，HTTP 边界先区分两者。
+            response = httpx.post(
+                f"{connection.sandbox_url.rstrip('/')}/v1/file/grep",
+                json=kwargs,
+                headers={"Authorization": f"Bearer {sandbox_provisioner_token()}"},
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+            response.raise_for_status()
+            payload = response.json()
+            if payload.get("success") is not True:
+                if (payload.get("data") or {}).get("error_type") == "not_found":
+                    return GrepResult(matches=[])
+                return GrepResult(error=payload.get("message") or "Sandbox grep failed")
+            data = FileGrepResult.model_validate(payload["data"])
+            if data.truncated is None:
+                return GrepResult(error="Invalid sandbox grep result")
+            matches = [
+                {"path": match.file, "line": match.line_number, "text": match.line_content}
+                for match in data.matches or []
+            ]
+            if len(json.dumps(matches, ensure_ascii=False).encode("utf-8")) > self._max_output_bytes:
+                return GrepResult(error="grep output exceeded sandbox limit")
+            return GrepResult(matches=matches, truncated=data.truncated)
+        except Exception as exc:  # noqa: BLE001
+            return GrepResult(error=str(exc) or "Sandbox grep failed")
+
     def grep(
         self,
         pattern: str,
@@ -742,7 +789,7 @@ def grep(
                     break
             else:
                 remaining = None
-            result = super().grep(pattern=pattern, path=search_path, glob=glob, max_count=remaining)
+            result = self._grep_root(pattern, search_path, glob, remaining)
             if result.error:
                 return result
             matches.extend(result.matches or [])
@@ -753,6 +800,28 @@ def grep(
             truncated = True
         return GrepResult(matches=self._filter_readable_matches(matches), truncated=truncated)
 
+    async def agrep(
+        self,
+        pattern: str,
+        path: str | None = None,
+        glob: str | None = None,
+        *,
+        max_count: int | None = None,
+    ) -> GrepResult:
+        """在线程中执行同一授权搜索，避免阻塞 Agent 事件循环。"""
+        try:
+            return await asyncio.wait_for(
+                asyncio.to_thread(self.grep, pattern, path, glob, max_count=max_count),
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+        except TimeoutError:
+            return GrepResult(
+                error=(
+                    f"Error: grep timed out after {ASYNC_GREP_TIMEOUT}s. "
+                    "Try a more specific pattern or a narrower path."
+                )
+            )
+
     def glob(self, pattern: str, path: str = "/") -> GlobResult:
         """Return files matching a glob pattern under allowed sandbox paths."""
         try:
```

**File**: `backend/test/integration/backends/test_sandbox_native_grep.py` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+"""通过独立沙盒 HTTP 验证原生 grep 与模型工具结果。"""
+
+import os
+import uuid
+from types import SimpleNamespace
+
+import pytest
+from agent_sandbox import Sandbox
+from deepagents.backends import CompositeBackend
+from langgraph.prebuilt.tool_node import ToolRuntime
+
+import yuxi.agents.backends.sandbox.backend as backend_module
+from yuxi.agents.backends.sandbox.backend import ProvisionerSandboxBackend
+from yuxi.agents.backends.composite import create_agent_filesystem_middleware
+
+
+@pytest.mark.asyncio
+async def test_native_grep_http_and_model_tool(monkeypatch):
+    """回读真实文件匹配与 ToolMessage，覆盖传输、过滤和沙盒路径语义。"""
+    url = os.environ.get("TEST_SANDBOX_URL")
+    if not url:
+        pytest.skip("TEST_SANDBOX_URL requires an isolated sandbox")
+    client = Sandbox(base_url=url)
+    root = f"/tmp/yuxi-grep-{uuid.uuid4().hex}"
+    user_root, skills_root = f"{root}/user-data", f"{root}/skills"
+    client.shell.exec_command(command=f"mkdir -p {user_root}/nested {skills_root} {root}/outside")
+    try:
+        for path, content in {
+            f"{user_root}/note:one.txt": "PEARL one\nPEARL two\n",
+            f"{user_root}/nested/code.py": "a.b\naXb\n",
+            f"{user_root}/.hidden": "HIDDEN pearl\n",
+            f"{user_root}/long.txt": "LONG " + "x" * 31000 + "\n",
+            f"{skills_root}/skill.md": "PEARL skill\n",
+            f"{root}/outside/secret": "CONTAINER target\n",
+        }.items():
+            client.file.write_file(file=path, content=content)
+        client.shell.exec_command(command=f"ln -s {root}/outside {user_root}/link")
+        monkeypatch.setattr(backend_module, "_USER_DATA_ROOT", user_root)
+        monkeypatch.setattr(backend_module, "_SKILLS_ROOT", skills_root)
+        monkeypatch.setattr(backend_module, "get_sandbox_provider", lambda: object())
+        backend = ProvisionerSandboxBackend(thread_id="probe", uid="probe")
+        monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url=url))
+        monkeypatch.setattr(backend_module, "sandbox_provisioner_token", lambda: "probe-token")
+
+        result = backend.grep("PEARL", max_count=3)
+        assert result.error is None
+        assert {(m["path"], m["line"], m["text"]) for m in result.matches} == {
+            (f"{user_root}/note:one.txt", 1, "PEARL one"),
+            (f"{user_root}/note:one.txt", 2, "PEARL two"),
+            (f"{skills_root}/skill.md", 1, "PEARL skill"),
+        }
+        capped = backend.grep("PEARL", max_count=1)
+        assert len(capped.matches) == 1 and capped.truncated
+        literal = await backend.agrep("a.b", path=user_root, glob="nested/**/*.py")
+        assert literal.matches == [{"path": f"{user_root}/nested/code.py", "line": 1, "text": "a.b"}]
+        special_root = f"{user_root}/special[1]{{a,b}}*?"
+        client.shell.exec_command(command=f"mkdir -p '{special_root}/nested'")
+        client.file.write_file(file=f"{special_root}/nested/code.py", content="SPECIAL match\n")
+        special = backend.grep("SPECIAL", path=special_root, glob="nested/**/*.py")
+        assert special.matches == [{"path": f"{special_root}/nested/code.py", "line": 1, "text": "SPECIAL match"}]
+        assert backend.grep("ABSENT").matches == []
+        assert backend.grep("a.b", path=user_root, glob="*.py").matches == literal.matches
+        client.file.write_file(file=f"{user_root}/many.txt", content="MANY match\n" * 501)
+        default_cap = backend.grep("MANY", path=user_root)
+        assert len(default_cap.matches) == 500 and default_cap.truncated
+        explicit_cap = backend.grep("MANY", path=user_root, max_count=501)
+        assert len(explicit_cap.matches) == 501
+        assert backend.grep("HIDDEN", path=user_root).matches == []
+        assert backend.grep("HIDDEN", path=user_root, glob=".*").matches
+        assert backend.grep("LONG", path=user_root).matches[0]["text"] == "LONG " + "x" * 31000
+        assert backend.grep("CONTAINER", path=f"{user_root}/link").matches[0]["text"] == "CONTAINER target"
+        assert backend.grep("CONTAINER", path=f"{root}/outside").error
+        assert backend.grep("CONTAINER", path=user_root, glob="../outside/*").error
+        backend._max_output_bytes = 128
+        assert backend.grep("LONG", path=user_root).error == "grep output exceeded sandbox limit"
+        backend._max_output_bytes = 262144
+        middleware = create_agent_filesystem_middleware(
+            backend=CompositeBackend(default=backend, routes={}, artifacts_root=f"{user_root}/outputs")
+        )
+        tool = next(tool for tool in middleware.tools if tool.name == "grep")
+        runtime = ToolRuntime(
+            state={}, context=None, config={}, stream_writer=lambda _: None, tool_call_id="grep-probe", store=None
+        )
+        message = await tool.coroutine(pattern="PEARL", output_mode="content", max_count=1, runtime=runtime)
+        assert message.status == "success"
+        assert "PEARL" in message.conten
```

**File**: `backend/test/unit/backends/test_sandbox_backends.py` (modified, +128/-2)
```diff
@@ -9,6 +9,7 @@
 import weakref
 from types import MethodType, SimpleNamespace
 
+import httpx
 import pytest
 import yuxi.agents.backends.sandbox.backend as sandbox_backend_module
 from deepagents.backends import CompositeBackend
@@ -1350,7 +1351,7 @@ def test_provisioner_grep_applies_global_max_count_across_roots(monkeypatch) ->
     backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
     grep_calls: list[dict] = []
 
-    def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
+    def _grep_root(pattern, path, glob, max_count):
         grep_calls.append({"path": path, "max_count": max_count})
         count = 3 if path == "/home/gem/user-data" else 2
         matches = [{"path": f"{path}/file-{index}.md", "line": 1, "text": pattern} for index in range(count)]
@@ -1360,7 +1361,7 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
             truncated = True
         return GrepResult(matches=matches, truncated=truncated)
 
-    monkeypatch.setattr(sandbox_backend_module.BaseSandbox, "grep", _super_grep)
+    monkeypatch.setattr(backend, "_grep_root", _grep_root)
 
     result = backend.grep("NEEDLE", path="/", max_count=4)
 
@@ -1369,6 +1370,131 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
     assert result.truncated is True
 
 
+@pytest.fixture
+def native_grep_backend(monkeypatch):
+    """装配只替换 HTTP 传输的原生搜索后端。"""
+    monkeypatch.setattr(sandbox_backend_module, "get_sandbox_provider", lambda: object())
+    monkeypatch.setattr(sandbox_backend_module, "sandbox_provisioner_token", lambda: "test-token")
+    backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
+    monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url="http://sandbox.test"))
+    return backend
+
+
+@pytest.mark.asyncio
+async def test_provisioner_grep_maps_native_results_for_sync_and_async(monkeypatch, native_grep_backend) -> None:
+    """原生搜索的字段、过滤参数与异步入口保持一致。"""
+    backend = native_grep_backend
+    calls = []
+
+    def post(url, **kwargs):
+        calls.append(kwargs["json"])
+        assert url == "http://sandbox.test/v1/file/grep"
+        return httpx.Response(
+            200,
+            request=httpx.Request("POST", url),
+            json={
+                "success": True,
+                "data": {
+                    "path": "/home/gem/user-data",
+                    "pattern": "a.b",
+                    "matches": [
+                        {"file": "/home/gem/user-data/nested/note:one.py", "line_number": 2, "line_content": "a.b"}
+                    ],
+                    "truncated": True,
+                },
+            },
+        )
+
+    monkeypatch.setattr(sandbox_backend_module.httpx, "post", post)
+    for result in (
+        backend.grep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+        await backend.agrep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+    ):
+        assert result.error is None
+        assert result.matches == [{"path": "/home/gem/user-data/nested/note:one.py", "line": 2, "text": "a.b"}]
+        assert result.truncated is True
+    assert all(call["fixed_strings"] is True and call["recursive"] is True for call in calls)
+    assert all(call["include"] == ["/home/gem/user-data/nested/**/*.py"] for call in calls)
+    assert all(call["max_results"] == 1 for call in calls)
+
+
+@pytest.mark.parametrize("failure", ["remote", "exception", "malformed", "oversize", "missing", "http"])
+def test_provisioner_grep_handles_native_failures(monkeypatch, native_grep_backend, failure) -> None:
+    """缺失可读根返回空结果，其他失败不能伪装成无匹配。"""
+    backend = native_grep_backend
+
+    def post(url, **kwargs):
+        if failure == "exception":
+            raise httpx.ReadTimeout("request timed out")
+        payload = {
+            "success": True,
+            "data": {
+                "path": "/home/gem/user-data",
+                "pattern": "x",
+                "matches": [
+                    {
+                        "file": "/home/gem/user-data/a",
+                        "line_number": 1,
+                        "line_content": "x" * (backend._max_output_bytes + 1),
+                    }
+                ],
+                "truncated": None if failure == "malformed" else False,
+            },
+        }
+        if failure in {"remote", "missing"}:
+            payload = {
+                "success": False,
+                "message": "read failed",
+                "data": {"error_type": "not_found" if failure == "missing" else "permission_denied"},
+            }
+        return httpx.Response(503 if failure == "http" else 200, request=httpx.Request("POST", url), json=payload)
+
+    monkeypatch.setattr(sandbox_backend_module.httpx, "post", post)
+    result = backend.grep("x", path="/home/gem/user-data")
+    if failure == "missing":
+        assert result.error is None
+        assert r
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-24-sandbox-grep-nul-transport.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# 沙盒原生文件搜索适配
+
+状态：implemented
+类型：simplification
+Owner：backend/package/yuxi/agents/backends/sandbox/backend.py
+
+## 问题
+
+DeepAgents 的 grep 结果以 NUL 分隔文件名与行号，sandbox shell 文本通道丢失 NUL 后导致命中结果解析失败。自建 Python 搜索脚本会重复承担遍历、glob、文件打开和匹配职责。Sandbox 1.11.0 已提供结构化文件搜索 API。
+
+## 决策
+
+Yuxi 直接调用 `/v1/file/grep`，使用 `fixed_strings=true`，把原生路径、行号、文本和截断标志映射为 `GrepResult`。请求使用现有 sandbox connection 与 provisioner 凭据；搜索根和跨根全局 `max_count` 由 backend 拥有。同步和异步入口使用同一搜索流程，HTTP 请求与异步等待均有超时。目录 glob 转为以当前搜索根锚定的完整路径过滤，路径前缀中的 glob 元字符按原生规则转义。
+
+agent-sandbox 0.0.30 把 HTTP 200 下的 `success=false` 错误也解析为成功模型，缺失目录因此触发 `data.pattern` 校验异常。HTTP 适配先检查状态与 success，只有成功数据交给 SDK 的 `FileGrepResult` 校验。`not_found` 返回空结果，其他失败明确返回错误；不解析异常字符串判断缺失目录。
+
+用户明确接受原生搜索的容器内符号链接行为。请求路径仍必须位于可读根，glob 拒绝 `..`；显式根内链接可以读取容器内目标，结果路径过滤不被视为 no-follow 授权。跨用户隔离仍由 provisioner 的 uid、挂载与独立容器执行。宿主 Workspace 的 no-follow 契约保持独立。
+
+## 替代方案
+
+保留或收窄内嵌搜索脚本仍需维护遍历与文件读取；Base64 包装保留了 shell 传输及第三方命令模板耦合；严格 no-follow 搜索需要执行端能力与镜像交付改造。原生 API 薄适配删除重复搜索实现，接受原生语义。移除 grep 会破坏现有模型文件工具 consumer。
+
+## 后果
+
+原生服务默认不搜索隐藏文件，可通过显式 glob 选择。未指定 `max_count` 时采用 1.11.0 每根 500 条的原生默认限额并透传截断标志；显式限额按剩余额度传给各根。结果顺序由服务拥有。单根匹配序列化后的 UTF-8 大小超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回错误，该限制在收到响应后检查，不是远端内存限制。异步等待或 HTTP 超时不承诺终止远端搜索进程。
+
+## 验证
+
+旧能力不存在：`_GREP_SCRIPT`、`shlex` 和 grep 专用 shell `truncate` 参数均已删除。
+重新引入条件：原生 API 出现无法在薄适配内解决的已复现缺陷，并重新评估执行端 Owner 与交付成本。
+
+- Passed：`docker run --rm --user 0 --entrypoint python -v "$PWD:/workspace" -w /workspace/backend yuxi-api:0.7.3 -m pytest test/unit -m 'not slow' -q -p no:cacheprovider --disable-warnings --tb=short`，2355 项通过，6 项警告。独立工作树无 Compose 槽位，使用开发镜像加载目标代码执行 unit。
+- Passed：临时启动无用户数据挂载、`--network none` 的 sandbox 1.11.0，测试容器使用 `--network container:yuxi-grep-native-probe` 和 `TEST_SANDBOX_URL=http://127.0.0.1:8080`，执行 `python -m pytest test/integration/backends/test_sandbox_native_grep.py --confcutdir=test/integration/backends -q -p no:cacheprovider --tb=short`。回读真实 HTTP 匹配与模型 `ToolMessage`，覆盖字面量、冒号文件名、glob、多根限额、空结果、缺失 Skills 根、隐藏文件、长行、输出上限、特殊目录名及显式链接行为。`--confcutdir` 隔离不相关的全站账户和 provisioner 清理；测试自行清理唯一临时目录。
+- Passed：`python3 scripts/verify_engineering_contracts.py` 与 `python3 -m unittest scripts.test_verify_engineering_contracts`；后者 62 项通过。
+- Passed：`uv tool run ruff check` 与 `uv tool run ruff format --check` 覆盖 backend、unit 与 integration 三个修改文件；`cd docs && pnpm run build` 通过（构建产物体积提示）；`git diff --check HEAD` 通过。
+- Passed：独立 Reviewer 审查最终 diff；审查发现的路径前缀 glob 元字符漏匹配已修复，修复后沙盒 unit 93 项与真实 HTTP 集成 1 项均通过。
+- Not run：完整 Agent/API/worker assembled-path E2E；目标工作树未启动独立完整 Compose 槽位。真实沙盒 HTTP 与模型工具探针不替代 Run 生命周期验证。
```

**File**: `docs/mechanisms/sandbox.md` (modified, +4/-0)
```diff
@@ -56,6 +56,10 @@ Conversation 通过 `project_id` 绑定 Project；Project 拥有这项绑定和
 
 文件访问使用相对路径和 no-follow 原语，拒绝 `..`、符号链接、特殊文件和跨用户根目录。普通运行服务以 `1000:1000` 访问数据；storage migrator 只在停机迁移中承担一次性 root 文件操作。
 
+Agent 的 `grep` 通过沙盒原生文件搜索 API 执行字面量匹配，未指定路径时搜索当前用户的 UserWorkspace 与已授权共享 Skill。结果包含路径、行号、文本和截断标志，并受跨根全局 `max_count` 限制；未指定限额时采用原生服务默认值（1.11.0 每根 500 条），达到限额会标记截断。默认搜索不包含隐藏文件，可通过显式 glob 选择；目录 glob 相对于搜索根。单根结构化结果超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回明确错误。
+
+搜索请求路径必须属于可读根，glob 拒绝 `..`。原生搜索允许显式指定的根内符号链接指向容器内其他位置；grep 不提供容器内部的 no-follow 隔离。用户之间的隔离由 provisioner 的 uid、挂载与独立容器边界执行，Agent 的 shell 也使用同一容器边界。宿主 Workspace 文件访问继续执行上述 no-follow 契约。
+
 ## Docker 和 Kubernetes
 
 Docker backend 为每个 runtime 创建独立 bridge 网络，不发布沙盒端口，也不加入应用 `app-network`。网络只连接 provisioner 和对应沙盒，因此沙盒不能互访，也不能直接访问 PostgreSQL、Redis、MinIO、Milvus 或 Neo4j。provisioner 复用实例前会检查 uid、Workdir、挂载和网络身份。
```

---

### Incident Patch 9: `7f4bc171` (2026-09-24)
**Commit Message**: fix(sandbox): 使用原生文件搜索修复 grep 结果传输

**File**: `backend/package/yuxi/agents/backends/sandbox/backend.py` (modified, +70/-1)
```diff
@@ -13,6 +13,7 @@
 
 import httpx
 from deepagents.backends.protocol import (
+    ASYNC_GREP_TIMEOUT,
     EditResult,
     ExecuteResponse,
     FileDownloadResponse,
@@ -714,6 +715,52 @@ def edit(
 
         return EditResult(path=normalized_path, occurrences=count if replace_all else 1)
 
+    def _grep_root(self, pattern: str, path: str, glob: str | None, max_count: int | None) -> GrepResult:
+        """调用沙盒原生文件搜索并映射结构化结果。"""
+        if glob and ".." in glob.replace("\\", "/").split("/"):
+            return GrepResult(error="Invalid glob pattern: path traversal is not allowed")
+        kwargs: dict[str, Any] = {
+            "path": path,
+            "pattern": pattern,
+            "fixed_strings": True,
+            "recursive": True,
+        }
+        if glob:
+            # 原生 include 按完整路径匹配，目录 glob 必须锚定到当前搜索根。
+            escaped_root = "".join("\\" + char if char in "\\*?[]{}" else char for char in path.rstrip("/"))
+            kwargs["include"] = [f"{escaped_root}/{glob.lstrip('/')}" if "/" in glob else glob]
+        if max_count is not None:
+            kwargs["max_results"] = max_count
+        try:
+            from agent_sandbox.types import FileGrepResult
+
+            connection = self._get_connection()
+            # SDK 0.0.30 把失败响应也解码为成功模型，HTTP 边界先区分两者。
+            response = httpx.post(
+                f"{connection.sandbox_url.rstrip('/')}/v1/file/grep",
+                json=kwargs,
+                headers={"Authorization": f"Bearer {sandbox_provisioner_token()}"},
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+            response.raise_for_status()
+            payload = response.json()
+            if payload.get("success") is not True:
+                if (payload.get("data") or {}).get("error_type") == "not_found":
+                    return GrepResult(matches=[])
+                return GrepResult(error=payload.get("message") or "Sandbox grep failed")
+            data = FileGrepResult.model_validate(payload["data"])
+            if data.truncated is None:
+                return GrepResult(error="Invalid sandbox grep result")
+            matches = [
+                {"path": match.file, "line": match.line_number, "text": match.line_content}
+                for match in data.matches or []
+            ]
+            if len(json.dumps(matches, ensure_ascii=False).encode("utf-8")) > self._max_output_bytes:
+                return GrepResult(error="grep output exceeded sandbox limit")
+            return GrepResult(matches=matches, truncated=data.truncated)
+        except Exception as exc:  # noqa: BLE001
+            return GrepResult(error=str(exc) or "Sandbox grep failed")
+
     def grep(
         self,
         pattern: str,
@@ -742,7 +789,7 @@ def grep(
                     break
             else:
                 remaining = None
-            result = super().grep(pattern=pattern, path=search_path, glob=glob, max_count=remaining)
+            result = self._grep_root(pattern, search_path, glob, remaining)
             if result.error:
                 return result
             matches.extend(result.matches or [])
@@ -753,6 +800,28 @@ def grep(
             truncated = True
         return GrepResult(matches=self._filter_readable_matches(matches), truncated=truncated)
 
+    async def agrep(
+        self,
+        pattern: str,
+        path: str | None = None,
+        glob: str | None = None,
+        *,
+        max_count: int | None = None,
+    ) -> GrepResult:
+        """在线程中执行同一授权搜索，避免阻塞 Agent 事件循环。"""
+        try:
+            return await asyncio.wait_for(
+                asyncio.to_thread(self.grep, pattern, path, glob, max_count=max_count),
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+        except TimeoutError:
+            return GrepResult(
+                error=(
+                    f"Error: grep timed out after {ASYNC_GREP_TIMEOUT}s. "
+                    "Try a more specific pattern or a narrower path."
+                )
+            )
+
     def glob(self, pattern: str, path: str = "/") -> GlobResult:
         """Return files matching a glob pattern under allowed sandbox paths."""
         try:
```

**File**: `backend/test/integration/backends/test_sandbox_native_grep.py` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+"""通过独立沙盒 HTTP 验证原生 grep 与模型工具结果。"""
+
+import os
+import uuid
+from types import SimpleNamespace
+
+import pytest
+from agent_sandbox import Sandbox
+from deepagents.backends import CompositeBackend
+from langgraph.prebuilt.tool_node import ToolRuntime
+
+import yuxi.agents.backends.sandbox.backend as backend_module
+from yuxi.agents.backends.sandbox.backend import ProvisionerSandboxBackend
+from yuxi.agents.backends.composite import create_agent_filesystem_middleware
+
+
+@pytest.mark.asyncio
+async def test_native_grep_http_and_model_tool(monkeypatch):
+    """回读真实文件匹配与 ToolMessage，覆盖传输、过滤和沙盒路径语义。"""
+    url = os.environ.get("TEST_SANDBOX_URL")
+    if not url:
+        pytest.skip("TEST_SANDBOX_URL requires an isolated sandbox")
+    client = Sandbox(base_url=url)
+    root = f"/tmp/yuxi-grep-{uuid.uuid4().hex}"
+    user_root, skills_root = f"{root}/user-data", f"{root}/skills"
+    client.shell.exec_command(command=f"mkdir -p {user_root}/nested {skills_root} {root}/outside")
+    try:
+        for path, content in {
+            f"{user_root}/note:one.txt": "PEARL one\nPEARL two\n",
+            f"{user_root}/nested/code.py": "a.b\naXb\n",
+            f"{user_root}/.hidden": "HIDDEN pearl\n",
+            f"{user_root}/long.txt": "LONG " + "x" * 31000 + "\n",
+            f"{skills_root}/skill.md": "PEARL skill\n",
+            f"{root}/outside/secret": "CONTAINER target\n",
+        }.items():
+            client.file.write_file(file=path, content=content)
+        client.shell.exec_command(command=f"ln -s {root}/outside {user_root}/link")
+        monkeypatch.setattr(backend_module, "_USER_DATA_ROOT", user_root)
+        monkeypatch.setattr(backend_module, "_SKILLS_ROOT", skills_root)
+        monkeypatch.setattr(backend_module, "get_sandbox_provider", lambda: object())
+        backend = ProvisionerSandboxBackend(thread_id="probe", uid="probe")
+        monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url=url))
+        monkeypatch.setattr(backend_module, "sandbox_provisioner_token", lambda: "probe-token")
+
+        result = backend.grep("PEARL", max_count=3)
+        assert result.error is None
+        assert {(m["path"], m["line"], m["text"]) for m in result.matches} == {
+            (f"{user_root}/note:one.txt", 1, "PEARL one"),
+            (f"{user_root}/note:one.txt", 2, "PEARL two"),
+            (f"{skills_root}/skill.md", 1, "PEARL skill"),
+        }
+        capped = backend.grep("PEARL", max_count=1)
+        assert len(capped.matches) == 1 and capped.truncated
+        literal = await backend.agrep("a.b", path=user_root, glob="nested/**/*.py")
+        assert literal.matches == [{"path": f"{user_root}/nested/code.py", "line": 1, "text": "a.b"}]
+        special_root = f"{user_root}/special[1]{{a,b}}*?"
+        client.shell.exec_command(command=f"mkdir -p '{special_root}/nested'")
+        client.file.write_file(file=f"{special_root}/nested/code.py", content="SPECIAL match\n")
+        special = backend.grep("SPECIAL", path=special_root, glob="nested/**/*.py")
+        assert special.matches == [{"path": f"{special_root}/nested/code.py", "line": 1, "text": "SPECIAL match"}]
+        assert backend.grep("ABSENT").matches == []
+        assert backend.grep("a.b", path=user_root, glob="*.py").matches == literal.matches
+        client.file.write_file(file=f"{user_root}/many.txt", content="MANY match\n" * 501)
+        default_cap = backend.grep("MANY", path=user_root)
+        assert len(default_cap.matches) == 500 and default_cap.truncated
+        explicit_cap = backend.grep("MANY", path=user_root, max_count=501)
+        assert len(explicit_cap.matches) == 501
+        assert backend.grep("HIDDEN", path=user_root).matches == []
+        assert backend.grep("HIDDEN", path=user_root, glob=".*").matches
+        assert backend.grep("LONG", path=user_root).matches[0]["text"] == "LONG " + "x" * 31000
+        assert backend.grep("CONTAINER", path=f"{user_root}/link").matches[0]["text"] == "CONTAINER target"
+        assert backend.grep("CONTAINER", path=f"{root}/outside").error
+        assert backend.grep("CONTAINER", path=user_root, glob="../outside/*").error
+        backend._max_output_bytes = 128
+        assert backend.grep("LONG", path=user_root).error == "grep output exceeded sandbox limit"
+        backend._max_output_bytes = 262144
+        middleware = create_agent_filesystem_middleware(
+            backend=CompositeBackend(default=backend, routes={}, artifacts_root=f"{user_root}/outputs")
+        )
+        tool = next(tool for tool in middleware.tools if tool.name == "grep")
+        runtime = ToolRuntime(
+            state={}, context=None, config={}, stream_writer=lambda _: None, tool_call_id="grep-probe", store=None
+        )
+        message = await tool.coroutine(pattern="PEARL", output_mode="content", max_count=1, runtime=runtime)
+        assert message.status == "success"
+        assert "PEARL" in message.conten
```

**File**: `backend/test/unit/backends/test_sandbox_backends.py` (modified, +128/-2)
```diff
@@ -9,6 +9,7 @@
 import weakref
 from types import MethodType, SimpleNamespace
 
+import httpx
 import pytest
 import yuxi.agents.backends.sandbox.backend as sandbox_backend_module
 from deepagents.backends import CompositeBackend
@@ -1350,7 +1351,7 @@ def test_provisioner_grep_applies_global_max_count_across_roots(monkeypatch) ->
     backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
     grep_calls: list[dict] = []
 
-    def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
+    def _grep_root(pattern, path, glob, max_count):
         grep_calls.append({"path": path, "max_count": max_count})
         count = 3 if path == "/home/gem/user-data" else 2
         matches = [{"path": f"{path}/file-{index}.md", "line": 1, "text": pattern} for index in range(count)]
@@ -1360,7 +1361,7 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
             truncated = True
         return GrepResult(matches=matches, truncated=truncated)
 
-    monkeypatch.setattr(sandbox_backend_module.BaseSandbox, "grep", _super_grep)
+    monkeypatch.setattr(backend, "_grep_root", _grep_root)
 
     result = backend.grep("NEEDLE", path="/", max_count=4)
 
@@ -1369,6 +1370,131 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
     assert result.truncated is True
 
 
+@pytest.fixture
+def native_grep_backend(monkeypatch):
+    """装配只替换 HTTP 传输的原生搜索后端。"""
+    monkeypatch.setattr(sandbox_backend_module, "get_sandbox_provider", lambda: object())
+    monkeypatch.setattr(sandbox_backend_module, "sandbox_provisioner_token", lambda: "test-token")
+    backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
+    monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url="http://sandbox.test"))
+    return backend
+
+
+@pytest.mark.asyncio
+async def test_provisioner_grep_maps_native_results_for_sync_and_async(monkeypatch, native_grep_backend) -> None:
+    """原生搜索的字段、过滤参数与异步入口保持一致。"""
+    backend = native_grep_backend
+    calls = []
+
+    def post(url, **kwargs):
+        calls.append(kwargs["json"])
+        assert url == "http://sandbox.test/v1/file/grep"
+        return httpx.Response(
+            200,
+            request=httpx.Request("POST", url),
+            json={
+                "success": True,
+                "data": {
+                    "path": "/home/gem/user-data",
+                    "pattern": "a.b",
+                    "matches": [
+                        {"file": "/home/gem/user-data/nested/note:one.py", "line_number": 2, "line_content": "a.b"}
+                    ],
+                    "truncated": True,
+                },
+            },
+        )
+
+    monkeypatch.setattr(sandbox_backend_module.httpx, "post", post)
+    for result in (
+        backend.grep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+        await backend.agrep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+    ):
+        assert result.error is None
+        assert result.matches == [{"path": "/home/gem/user-data/nested/note:one.py", "line": 2, "text": "a.b"}]
+        assert result.truncated is True
+    assert all(call["fixed_strings"] is True and call["recursive"] is True for call in calls)
+    assert all(call["include"] == ["/home/gem/user-data/nested/**/*.py"] for call in calls)
+    assert all(call["max_results"] == 1 for call in calls)
+
+
+@pytest.mark.parametrize("failure", ["remote", "exception", "malformed", "oversize", "missing", "http"])
+def test_provisioner_grep_handles_native_failures(monkeypatch, native_grep_backend, failure) -> None:
+    """缺失可读根返回空结果，其他失败不能伪装成无匹配。"""
+    backend = native_grep_backend
+
+    def post(url, **kwargs):
+        if failure == "exception":
+            raise httpx.ReadTimeout("request timed out")
+        payload = {
+            "success": True,
+            "data": {
+                "path": "/home/gem/user-data",
+                "pattern": "x",
+                "matches": [
+                    {
+                        "file": "/home/gem/user-data/a",
+                        "line_number": 1,
+                        "line_content": "x" * (backend._max_output_bytes + 1),
+                    }
+                ],
+                "truncated": None if failure == "malformed" else False,
+            },
+        }
+        if failure in {"remote", "missing"}:
+            payload = {
+                "success": False,
+                "message": "read failed",
+                "data": {"error_type": "not_found" if failure == "missing" else "permission_denied"},
+            }
+        return httpx.Response(503 if failure == "http" else 200, request=httpx.Request("POST", url), json=payload)
+
+    monkeypatch.setattr(sandbox_backend_module.httpx, "post", post)
+    result = backend.grep("x", path="/home/gem/user-data")
+    if failure == "missing":
+        assert result.error is None
+        assert r
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-24-sandbox-grep-nul-transport.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# 沙盒原生文件搜索适配
+
+状态：implemented
+类型：simplification
+Owner：backend/package/yuxi/agents/backends/sandbox/backend.py
+
+## 问题
+
+DeepAgents 的 grep 结果以 NUL 分隔文件名与行号，sandbox shell 文本通道丢失 NUL 后导致命中结果解析失败。自建 Python 搜索脚本会重复承担遍历、glob、文件打开和匹配职责。Sandbox 1.11.0 已提供结构化文件搜索 API。
+
+## 决策
+
+Yuxi 直接调用 `/v1/file/grep`，使用 `fixed_strings=true`，把原生路径、行号、文本和截断标志映射为 `GrepResult`。请求使用现有 sandbox connection 与 provisioner 凭据；搜索根和跨根全局 `max_count` 由 backend 拥有。同步和异步入口使用同一搜索流程，HTTP 请求与异步等待均有超时。目录 glob 转为以当前搜索根锚定的完整路径过滤，路径前缀中的 glob 元字符按原生规则转义。
+
+agent-sandbox 0.0.30 把 HTTP 200 下的 `success=false` 错误也解析为成功模型，缺失目录因此触发 `data.pattern` 校验异常。HTTP 适配先检查状态与 success，只有成功数据交给 SDK 的 `FileGrepResult` 校验。`not_found` 返回空结果，其他失败明确返回错误；不解析异常字符串判断缺失目录。
+
+用户明确接受原生搜索的容器内符号链接行为。请求路径仍必须位于可读根，glob 拒绝 `..`；显式根内链接可以读取容器内目标，结果路径过滤不被视为 no-follow 授权。跨用户隔离仍由 provisioner 的 uid、挂载与独立容器执行。宿主 Workspace 的 no-follow 契约保持独立。
+
+## 替代方案
+
+保留或收窄内嵌搜索脚本仍需维护遍历与文件读取；Base64 包装保留了 shell 传输及第三方命令模板耦合；严格 no-follow 搜索需要执行端能力与镜像交付改造。原生 API 薄适配删除重复搜索实现，接受原生语义。移除 grep 会破坏现有模型文件工具 consumer。
+
+## 后果
+
+原生服务默认不搜索隐藏文件，可通过显式 glob 选择。未指定 `max_count` 时采用 1.11.0 每根 500 条的原生默认限额并透传截断标志；显式限额按剩余额度传给各根。结果顺序由服务拥有。单根匹配序列化后的 UTF-8 大小超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回错误，该限制在收到响应后检查，不是远端内存限制。异步等待或 HTTP 超时不承诺终止远端搜索进程。
+
+## 验证
+
+旧能力不存在：`_GREP_SCRIPT`、`shlex` 和 grep 专用 shell `truncate` 参数均已删除。
+重新引入条件：原生 API 出现无法在薄适配内解决的已复现缺陷，并重新评估执行端 Owner 与交付成本。
+
+- Passed：`docker run --rm --user 0 --entrypoint python -v "$PWD:/workspace" -w /workspace/backend yuxi-api:0.7.3 -m pytest test/unit -m 'not slow' -q -p no:cacheprovider --disable-warnings --tb=short`，2355 项通过，6 项警告。独立工作树无 Compose 槽位，使用开发镜像加载目标代码执行 unit。
+- Passed：临时启动无用户数据挂载、`--network none` 的 sandbox 1.11.0，测试容器使用 `--network container:yuxi-grep-native-probe` 和 `TEST_SANDBOX_URL=http://127.0.0.1:8080`，执行 `python -m pytest test/integration/backends/test_sandbox_native_grep.py --confcutdir=test/integration/backends -q -p no:cacheprovider --tb=short`。回读真实 HTTP 匹配与模型 `ToolMessage`，覆盖字面量、冒号文件名、glob、多根限额、空结果、缺失 Skills 根、隐藏文件、长行、输出上限、特殊目录名及显式链接行为。`--confcutdir` 隔离不相关的全站账户和 provisioner 清理；测试自行清理唯一临时目录。
+- Passed：`python3 scripts/verify_engineering_contracts.py` 与 `python3 -m unittest scripts.test_verify_engineering_contracts`；后者 62 项通过。
+- Passed：`uv tool run ruff check` 与 `uv tool run ruff format --check` 覆盖 backend、unit 与 integration 三个修改文件；`cd docs && pnpm run build` 通过（构建产物体积提示）；`git diff --check HEAD` 通过。
+- Passed：独立 Reviewer 审查最终 diff；审查发现的路径前缀 glob 元字符漏匹配已修复，修复后沙盒 unit 93 项与真实 HTTP 集成 1 项均通过。
+- Not run：完整 Agent/API/worker assembled-path E2E；目标工作树未启动独立完整 Compose 槽位。真实沙盒 HTTP 与模型工具探针不替代 Run 生命周期验证。
```

**File**: `docs/mechanisms/sandbox.md` (modified, +4/-0)
```diff
@@ -56,6 +56,10 @@ Conversation 通过 `project_id` 绑定 Project；Project 拥有这项绑定和
 
 文件访问使用相对路径和 no-follow 原语，拒绝 `..`、符号链接、特殊文件和跨用户根目录。普通运行服务以 `1000:1000` 访问数据；storage migrator 只在停机迁移中承担一次性 root 文件操作。
 
+Agent 的 `grep` 通过沙盒原生文件搜索 API 执行字面量匹配，未指定路径时搜索当前用户的 UserWorkspace 与已授权共享 Skill。结果包含路径、行号、文本和截断标志，并受跨根全局 `max_count` 限制；未指定限额时采用原生服务默认值（1.11.0 每根 500 条），达到限额会标记截断。默认搜索不包含隐藏文件，可通过显式 glob 选择；目录 glob 相对于搜索根。单根结构化结果超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回明确错误。
+
+搜索请求路径必须属于可读根，glob 拒绝 `..`。原生搜索允许显式指定的根内符号链接指向容器内其他位置；grep 不提供容器内部的 no-follow 隔离。用户之间的隔离由 provisioner 的 uid、挂载与独立容器边界执行，Agent 的 shell 也使用同一容器边界。宿主 Workspace 文件访问继续执行上述 no-follow 契约。
+
 ## Docker 和 Kubernetes
 
 Docker backend 为每个 runtime 创建独立 bridge 网络，不发布沙盒端口，也不加入应用 `app-network`。网络只连接 provisioner 和对应沙盒，因此沙盒不能互访，也不能直接访问 PostgreSQL、Redis、MinIO、Milvus 或 Neo4j。provisioner 复用实例前会检查 uid、Workdir、挂载和网络身份。
```

---

### Incident Patch 10: `7e0fdc96` (2026-09-24)
**Commit Message**: fix(graph): 图谱抽取配置拒绝顶层 enable_thinking，提示写在 extra_body 中 (#1070)

* fix(graph): 顶层 enable_thinking 在保存图谱配置时直接报错

model_params 会展开成 ChatOpenAI 的构造参数，顶层 enable_thinking
最终传给 AsyncCompletions.create()，接口不接受这个参数，每个分块的
抽取都会失败。保存配置时就提示应写在 extra_body 中。

Refs #1045

* docs(web): 图谱模型参数说明补充 extra_body 写法

说明关闭思考模式时 enable_thinking 需要放在 extra_body 中。

Refs #1045

**File**: `backend/package/yuxi/knowledge/graphs/extractors/llm.py` (modified, +9/-1)
```diff
@@ -69,8 +69,16 @@ def validate_options(self) -> None:
         # 注意：timeout_seconds 不能通过 model_params 设置——select_model 会把显式的
         # timeout 参数覆盖到 model_params 之上，所以只能在这里读取并显式传入。
         self._resolve_timeout_seconds()
-        if self.options.get("model_params") is not None and not isinstance(self.options["model_params"], dict):
+        model_params = self.options.get("model_params")
+        if model_params is not None and not isinstance(model_params, dict):
             raise ValueError("LLM 抽取器 model_params 必须是对象")
+        # model_params 会展开成 ChatOpenAI 的构造参数，顶层 enable_thinking 最终落到
+        # AsyncCompletions.create() 上，接口直接报未知参数，每块抽取都失败。
+        if model_params and "enable_thinking" in model_params:
+            raise ValueError(
+                "LLM 抽取器 model_params 不支持顶层 enable_thinking，请写在 extra_body 中，"
+                '例如 {"extra_body": {"enable_thinking": false}}'
+            )
 
     async def extract(self, text: str, *, chunk_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
         self.validate_options()
```

**File**: `backend/test/unit/graphs/test_milvus_graph_build.py` (modified, +16/-0)
```diff
@@ -357,6 +357,22 @@ def test_llm_graph_extractor_rejects_invalid_timeout(bad_value):
         extractor.validate_options()
 
 
+def test_llm_graph_extractor_rejects_top_level_enable_thinking():
+    """顶层 enable_thinking 会被当成 create() 的未知参数，保存配置时就要报错。"""
+    extractor = LLMGraphExtractor({"model_spec": "test/model", "model_params": {"enable_thinking": False}})
+
+    with pytest.raises(ValueError, match="extra_body"):
+        extractor.validate_options()
+
+
+def test_llm_graph_extractor_accepts_enable_thinking_in_extra_body():
+    extractor = LLMGraphExtractor(
+        {"model_spec": "test/model", "model_params": {"extra_body": {"enable_thinking": False}}}
+    )
+
+    extractor.validate_options()
+
+
 def test_llm_graph_extractor_appends_schema_to_fixed_prompt():
     extractor = LLMGraphExtractor(
         {
```

**File**: `web/src/components/KnowledgeGraphSection.vue` (modified, +2/-1)
```diff
@@ -329,7 +329,8 @@
             placeholder='例如 {"temperature":0.1}'
           />
           <div class="form-item-hint">
-            输入的 JSON 对象会作为 model_params 传给抽取模型调用；如需设置超时，请使用上方字段。
+            输入的 JSON 对象会作为 model_params 传给抽取模型调用；如需设置超时，请使用上方字段。关闭百炼等模型的思考模式需写在
+            extra_body 中，例如 {"extra_body":{"enable_thinking":false}}。
           </div>
         </a-form-item>
       </a-form>
```

---

### Incident Patch 11: `834d7249` (2026-09-23)
**Commit Message**: fix(agent): 隔离工具异常并修正 SSE 终态通知游标

工具执行异常转换为同调用的错误结果，保留取消与 interrupt 传播。数据库补发 end 不再复用 Redis 事件 ID，避免前端去重丢弃终态通知。

同步最新 main 后相关单测 117 项通过，工程检查通过；前端 354 项、lint/build 和文档构建通过。独立审查覆盖全部 13 个文件。全量后端仍有两项沙盒配置测试失败；E2E 业务断言通过但共享 Workdir 清理失败，真实流尾重连探针通过。

**File**: `backend/package/yuxi/agents/buildin/chatbot/graph.py` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
     NetworkRetryMiddleware,
     SteerMiddleware,
     TokenUsageMiddleware,
+    ToolErrorGuardMiddleware,
     create_memory_middleware,
     create_summary_middleware_from_context,
 )
@@ -34,6 +35,8 @@
 async def _build_middlewares(context, backend):
     """构建中间件列表"""
     middlewares = [
+        # 最外层隔离普通工具异常，保留取消与 interrupt 的传播。
+        ToolErrorGuardMiddleware(),
         SteerMiddleware(),
         create_agent_filesystem_middleware(
             getattr(context, "tool_token_limit", DEFAULT_TOOL_RESULT_EVICTION_K_TOKENS) * 1024,
```

**File**: `backend/package/yuxi/agents/buildin/subagent/graph.py` (modified, +3/-0)
```diff
@@ -21,6 +21,7 @@
     ImageInputCompatibilityMiddleware,
     NetworkRetryMiddleware,
     TokenUsageMiddleware,
+    ToolErrorGuardMiddleware,
     create_summary_middleware_from_context,
 )
 from yuxi.agents.middlewares.skills import SkillsMiddleware
@@ -90,6 +91,8 @@ async def _build_middlewares(context, backend, tool_approval_mode: str):
     # tool_approval_mode is normalized once by the caller (get_graph / SubAgentBackend.get_graph).
 
     return [
+        # 子 Agent 的工具异常也在最外层隔离，避免打断父对话。
+        ToolErrorGuardMiddleware(),
         create_agent_filesystem_middleware(
             getattr(context, "tool_token_limit", DEFAULT_TOOL_RESULT_EVICTION_K_TOKENS) * 1024,
             backend=backend,
```

**File**: `backend/package/yuxi/agents/middlewares/__init__.py` (modified, +2/-0)
```diff
@@ -6,13 +6,15 @@
 from .steer import SteerMiddleware
 from .summary import create_summary_middleware, create_summary_middleware_from_context
 from .token_usage import TokenUsageMiddleware
+from .tool_error_guard import ToolErrorGuardMiddleware
 
 __all__ = [
     "DynamicToolMiddleware",
     "ImageInputCompatibilityMiddleware",
     "NetworkRetryMiddleware",
     "SteerMiddleware",
     "TokenUsageMiddleware",
+    "ToolErrorGuardMiddleware",
     "context_aware_prompt",
     "context_based_model",
     "create_memory_middleware",
```

**File**: `backend/package/yuxi/agents/middlewares/tool_error_guard.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+from __future__ import annotations
+
+import asyncio
+import logging
+from collections.abc import Awaitable, Callable
+from typing import Any
+
+from langchain.agents.middleware.types import (
+    AgentMiddleware,
+    ToolCallRequest,
+)
+from langchain_core.messages import ToolMessage
+from langgraph.errors import GraphBubbleUp
+
+logger = logging.getLogger(__name__)
+
+_RETHROW_EXCEPTIONS = (GraphBubbleUp, asyncio.CancelledError, KeyboardInterrupt, SystemExit)
+
+_ERROR_HINT = (
+    "请分析报错原因后继续：参数问题请修正后重试；该工具不支持当前输入"
+    "（如路径域不匹配、文件不可达）时改用其它合适的工具或方法；"
+    "同一调用连续两次同因失败后停止重试，如实向用户说明情况。"
+)
+
+
+class ToolErrorGuardMiddleware(AgentMiddleware):
+    """把工具执行异常隔离为工具结果消息（对话不中断）。"""
+
+    def wrap_tool_call(
+        self,
+        request: ToolCallRequest,
+        handler: Callable[[ToolCallRequest], Any],
+    ) -> Any:
+        try:
+            return handler(request)
+        except _RETHROW_EXCEPTIONS:
+            raise
+        except Exception as exc:
+            return self._error_tool_message(request, exc)
+
+    async def awrap_tool_call(
+        self,
+        request: ToolCallRequest,
+        handler: Callable[[ToolCallRequest], Awaitable[Any]],
+    ) -> Any:
+        try:
+            return await handler(request)
+        except _RETHROW_EXCEPTIONS:
+            raise
+        except Exception as exc:
+            return self._error_tool_message(request, exc)
+
+    @staticmethod
+    def _error_tool_message(request: ToolCallRequest, exc: Exception) -> ToolMessage:
+        tool_call = request.tool_call or {}
+        name = str(tool_call.get("name") or "unknown")
+        tool_call_id = str(tool_call.get("id") or "")
+        # 工具异常文本可能包含凭据或私有路径，不能进入模型上下文或日志。
+        error_type = type(exc).__name__
+        logger.warning("[tool-error-guard] 工具 %s 执行异常：%s", name, error_type)
+        content = f"工具 {name} 执行失败：{error_type}\n{_ERROR_HINT}"
+        return ToolMessage(content=content, name=name, tool_call_id=tool_call_id, status="error")
```

**File**: `backend/package/yuxi/services/agent_run_service.py` (modified, +1/-7)
```diff
@@ -43,7 +43,6 @@
 from yuxi.services.run_queue_service import (
     build_run_event_envelope,
     get_arq_pool,
-    get_last_run_stream_seq,
     list_recent_run_stream_events,
     list_run_stream_events,
     normalize_after_seq,
@@ -999,11 +998,7 @@ async def stream_agent_run_events(
                 and not bool(getattr(run, "runtime_cleanup_pending", False))
                 and not events
             ):
-                terminal_seq = last_seq
-                if terminal_seq in {"", "0-0"}:
-                    terminal_seq = await get_last_run_stream_seq(run_id)
-                if terminal_seq in {"", "0-0"}:
-                    terminal_seq = None
+                # 数据库补发通知没有 Redis ID，不能复用已消费事件的游标。
                 terminal_envelope = build_run_event_envelope(
                     run_id=run_id,
                     thread_id=run.conversation_thread_id,
@@ -1016,7 +1011,6 @@ async def stream_agent_run_events(
                 yield format_sse(
                     terminal_envelope,
                     event="end",
-                    event_id=terminal_seq,
                 )
                 return
 
```

**File**: `backend/package/yuxi/storage/postgres/manager.py` (modified, +1/-1)
```diff
@@ -391,7 +391,7 @@ def initialize(self):
             )
 
             self._initialized = True
-            logger.info(f"PostgreSQL manager initialized for knowledge base: {db_url.split('@')[0]}://***")
+            logger.info("PostgreSQL manager initialized for knowledge base")
         except Exception as e:
             logger.error(f"Failed to initialize PostgreSQL manager: {e}")
             # 不抛出异常，允许应用启动，但在使用时会报错
```

**File**: `backend/server/routers/system_router.py` (modified, +2/-0)
```diff
@@ -208,6 +208,8 @@ async def load_info_config():
 
         return config
 
+    except HTTPException:
+        raise
     except Exception as e:
         logger.error(f"Failed to load info config: {e}")
         return {}
```

**File**: `backend/test/e2e/test_agent_async_e2e.py` (modified, +18/-0)
```diff
@@ -236,6 +236,24 @@ async def test_async_agent_run_stream_result_and_persistence(
             agent_slug=agent_slug,
             uid=uid,
         )
+
+        replay = await e2e_client.get(f"/api/agent/runs/{run_id}/events", headers=e2e_headers)
+        assert replay.status_code == 200, replay.text
+        event_ids = [line.removeprefix("id: ") for line in replay.text.splitlines() if line.startswith("id: ")]
+        assert event_ids, "真实 worker 事件必须携带 Redis 游标"
+        for _ in range(2):
+            resumed = await e2e_client.get(
+                f"/api/agent/runs/{run_id}/events",
+                headers={**e2e_headers, "Last-Event-ID": event_ids[-1]},
+            )
+            assert resumed.status_code == 200, resumed.text
+            assert resumed.text.count("event: end\n") == 1
+            assert "\nid:" not in resumed.text
+            data = next(line.removeprefix("data: ") for line in resumed.text.splitlines() if line.startswith("data: "))
+            terminal = json.loads(data)
+            assert terminal["run_id"] == run_id
+            assert terminal["payload"]["status"] == "completed"
+            assert terminal["payload"]["request_id"] == request_id
         run_completed = True
     finally:
         if not run_completed:
```

---

### Incident Patch 12: `9b789ca4` (2026-09-23)
**Commit Message**: fix(agents): 模型重试耗尽后保留真实失败语义 (#1069)

* fix(agents): 模型重试耗尽后保留真实失败语义

* docs: 同步重试耗尽决策并标明部分取代关系

**File**: `backend/package/yuxi/agents/middlewares/network_retry.py` (modified, +4/-3)
```diff
@@ -2,7 +2,7 @@
 
 断网/APIC 连接抖动恢复后任务应自动继续(对标 Claude Code 的行为)：
 网络类异常(连接拒绝/超时/DNS)按指数退避持续重试，总预算内不向 graph 抛错；
-预算耗尽显式抛出，Run 以 failed 结束，不再出现"假完成"。
+网络预算或次数重试耗尽时显式抛出，由 Run 失败通道记录错误。
 
 网络重试通过 handler 包装实现：wrapped handler 在预算内吞掉网络异常退避重试，
 预算耗尽或非网络异常原样抛出，交给父类的 wrap_model_call/awrap_model_call 按
@@ -51,7 +51,7 @@ class NetworkRetryMiddleware(ModelRetryMiddleware):
     """网络错误按预算重试、非网络错误按次数重试的统一中间件。
 
     网络重试通过 handler 包装实现，非网络错误复用父类 ``ModelRetryMiddleware`` 的
-    ``max_retries``/``retry_on``/``on_failure`` 语义。网络预算起点在包装创建时固定，
+    ``max_retries``/``retry_on`` 语义，耗尽后保留原异常。网络预算起点在包装创建时固定，
     跨父类的非网络重试保持，不会被放大成多份。
     """
 
@@ -64,7 +64,8 @@ def __init__(
         network_max_delay: float = 30.0,
         **kwargs,
     ) -> None:
-        super().__init__(max_retries=max_retries, retry_on=_retry_non_network_errors, **kwargs)
+        # Run 失败由 worker 持久化；合成 AIMessage 没有对应的 model lifecycle 审计。
+        super().__init__(max_retries=max_retries, retry_on=_retry_non_network_errors, on_failure="error", **kwargs)
         self._network_budget = (
             network_budget_seconds
             if network_budget_seconds is not None
```

**File**: `backend/test/e2e/test_deterministic_agent_path_e2e.py` (modified, +119/-0)
```diff
@@ -35,6 +35,125 @@
 MODEL_SPEC = f"{PROVIDER_ID}:deterministic-chat"
 
 
+@pytest.mark.parametrize("subagent", [False, True])
+@pytest.mark.parametrize("first_call", [False, True])
+async def test_model_retry_exhaustion_preserves_failure_and_parent_recovers(
+    e2e_client, e2e_headers, subagent, first_call
+):
+    """真实 429 耗尽后保留失败原因，父任务可消费失败且线程仍可继续。"""
+    uid = str((await e2e_client.get("/api/auth/me", headers=e2e_headers)).json()["uid"])
+    await _create_provider(e2e_client, e2e_headers)
+    agents, child_threads, run_ids = [], [], []
+    thread_id = None
+    marker = "DETERMINISTIC_RATE_LIMIT"
+    query = f"{EXPECTED_OUTPUT} {marker} SUBAGENT_PATH:/tmp/not-written"
+    if first_call:
+        query += " RATE_LIMIT_FIRST_CALL"
+    try:
+        child = None
+        if subagent:
+            child = await _create_agent(
+                e2e_client, e2e_headers, uid, is_subagent=True, system_prompt_suffix="DETERMINISTIC_SUBAGENT_CHILD"
+            )
+            agents.append(child)
+        agent = await _create_agent(
+            e2e_client,
+            e2e_headers,
+            uid,
+            subagents=[child] if child else [],
+            system_prompt_suffix=f"DETERMINISTIC_SUBAGENT_PARENT:{child}" if child else "",
+        )
+        agents.append(agent)
+        response = await e2e_client.post(
+            "/api/chat/thread",
+            headers=e2e_headers,
+            json={
+                "agent_id": agent,
+                "title": make_test_conversation_title("model-retry-failure"),
+                "metadata": make_test_conversation_metadata("model-retry-failure", e2e=True),
+            },
+        )
+        assert response.status_code == 200, response.text
+        thread_id = response.json()["id"]
+        # 同一线程连续提交两次，第二次证明上一次失败没有遗留清理或队列阻塞。
+        for _ in range(2):
+            response = await e2e_client.post(
+                "/api/agent/runs",
+                headers=e2e_headers,
+                json={
+                    "agent_slug": agent,
+                    "thread_id": thread_id,
+                    "query": query,
+                    "tool_approval_mode": "default",
+                    "meta": {"request_id": str(uuid.uuid4())},
+                },
+            )
+            assert response.status_code == 200, response.text
+            run_id = response.json()["run_id"]
+            run_ids.append(run_id)
+            final = await wait_for_run(e2e_client, e2e_headers, run_id)
+            assert final["status"] == ("completed" if subagent else "failed"), final
+            failed_id = run_id
+            conn = await asyncpg.connect(postgres_dsn())
+            try:
+                if subagent:
+                    children = await conn.fetch(
+                        "SELECT id, conversation_thread_id FROM agent_runs WHERE created_by_run_id = $1", run_id
+                    )
+                    assert len(children) == 1, children
+                    failed_id = children[0]["id"]
+                    child_threads.append(children[0]["conversation_thread_id"])
+                    tool_content = await conn.fetchval(
+                        "SELECT content FROM messages WHERE run_id = $1 AND message_type = 'tool_audit' "
+                        "AND operation_id = 'await-call-subagent-start'",
+                        run_id,
+                    )
+                    observed = json.loads(tool_content)
+                    assert observed["status"] == "failed", observed
+                    assert marker in observed["result"]["error"]["message"], observed
+                    parent_result = await e2e_client.get(f"/api/agent/runs/{run_id}/result", headers=e2e_headers)
+                    assert parent_result.json()["output"] == EXPECTED_OUTPUT, parent_result.text
+                failed = await conn.fetchrow(
+                    "SELECT status, error_message, output_message_id FROM agent_runs WHERE id = $1", failed_id
+                )
+                assert failed["status"] == "failed", failed
+                assert marker in failed["error_message"], failed
+                assert "Model lifecycle" not in failed["error_message"], failed
+                assert await conn.fetchval("SELECT COUNT(*) FROM agent_run_attempts WHERE run_id = $1", failed_id) == 1
+                # 失败通道允许保存同 Run 的部分输出，但必须携带明确错误元数据。
+                output = await conn.fetchrow(
+                    "SELECT run_id, content, extra_metadata FROM messages WHERE id = $1",
+                    failed["output_message_id"],
+                )
+                assert output["run_id"] == failed_id, output
+                metadata = json.loads(output["extra_metadata"])
+                assert metadata["is_error"] is True, metadata
+                assert marker in metadata["error_message"], metadata
+                assert "Model call failed after" not in output["content"], output
+            finally:
+                await conn.close()
+            result = a
```

**File**: `backend/test/support/openai_replay_server.py` (modified, +19/-2)
```diff
@@ -238,7 +238,24 @@ def do_POST(self) -> None:  # noqa: N802
             self._write_json(422, {"error": request_error})
             return
 
-        serialized_messages = json.dumps(request["messages"], ensure_ascii=False)
+        messages = request["messages"]
+        serialized_messages = json.dumps(messages, ensure_ascii=False)
+        if "DETERMINISTIC_RATE_LIMIT" in serialized_messages:
+            last_user = max(index for index, message in enumerate(messages) if message.get("role") == "user")
+            messages = [message for message in messages[:last_user] if message.get("role") == "system"] + messages[
+                last_user:
+            ]
+            is_parent = (
+                "DETERMINISTIC_SUBAGENT_PARENT:" in serialized_messages
+                and "DETERMINISTIC_SUBAGENT_CHILD" not in serialized_messages
+            )
+            has_tool_result = any(message.get("role") == "tool" for message in messages)
+            if not is_parent and (has_tool_result or "RATE_LIMIT_FIRST_CALL" in serialized_messages):
+                self._write_json(
+                    429,
+                    {"error": {"message": "DETERMINISTIC_RATE_LIMIT exhausted", "type": "rate_limit_error"}},
+                )
+                return
         gate = re.search(r"SUBAGENT_OBSERVATION_GATE:([0-9a-f-]+)", serialized_messages)
         if gate and "DETERMINISTIC_SUBAGENT_CHILD" in serialized_messages and "SUBAGENT_SLOW" in serialized_messages:
             with BLOCKING_REQUEST_TOKENS_LOCK:
@@ -248,7 +265,7 @@ def do_POST(self) -> None:  # noqa: N802
                 return
         blocking_match = re.search(rf"{BLOCK_BEFORE_RESPONSE_MARKER}:([0-9a-f-]+)", serialized_messages)
         model = str(request["model"])
-        payloads = _stream_payloads(model, request["messages"])
+        payloads = _stream_payloads(model, messages)
         self.send_response(200)
         self.send_header("Content-Type", "text/event-stream")
         self.send_header("Cache-Control", "no-cache")
```

**File**: `backend/test/unit/agents/test_network_retry.py` (modified, +29/-12)
```diff
@@ -7,7 +7,6 @@
 
 import pytest
 from langchain_core.exceptions import ModelError
-from langchain_core.messages import AIMessage
 
 from yuxi.agents.middlewares.network_retry import NetworkRetryMiddleware, _is_network_error
 
@@ -88,21 +87,39 @@ async def handler(request):
         await mw.awrap_model_call(object(), handler)
 
 
+@pytest.mark.parametrize("sync", [False, True])
+@pytest.mark.parametrize("max_retries", [0, 2])
 @pytest.mark.asyncio
-async def test_non_network_error_retried_by_max_retries_then_continue():
-    """非网络错误仍按 max_retries 次数重试，耗尽后 on_failure=continue 返回错误 AIMessage。"""
-    mw = NetworkRetryMiddleware(max_retries=2, initial_delay=0.0, jitter=False)
-    calls = {"n": 0}
+async def test_rate_limit_exhaustion_preserves_original_error(sync, max_retries):
+    """429 按配置重试，耗尽后保留原异常供 Run 失败通道处理。"""
+    import httpx
+    import openai
 
-    async def handler(request):
-        calls["n"] += 1
-        raise FakeError("AuthenticationError: invalid api key")
+    error = openai.RateLimitError(
+        "rate limit exhausted",
+        response=httpx.Response(429, request=httpx.Request("POST", "https://example.invalid/v1/chat/completions")),
+        body=None,
+    )
+    mw = NetworkRetryMiddleware(max_retries=max_retries, initial_delay=0, jitter=False)
+    calls = 0
 
-    result = await mw.awrap_model_call(object(), handler)
+    def handler(_request):
+        """重复抛出同一个 provider 异常。"""
+        nonlocal calls
+        calls += 1
+        raise error
 
-    # max_retries=2 → 1 次初始 + 2 次重试 = 3 次调用
-    assert calls["n"] == 3
-    assert isinstance(result.result[0], AIMessage)
+    async def async_handler(request):
+        """异步入口保留同一异常对象。"""
+        return handler(request)
+
+    with pytest.raises(openai.RateLimitError) as raised:
+        if sync:
+            mw.wrap_model_call(object(), handler)
+        else:
+            await mw.awrap_model_call(object(), async_handler)
+    assert raised.value is error
+    assert calls == max_retries + 1
 
 
 @pytest.mark.asyncio
```

**File**: `docs/agents/middleware.md` (modified, +3/-1)
```diff
@@ -29,13 +29,15 @@
 | 6 | `YuxiSummarizationMiddleware` | 先确定性压缩工具结果，仍达到同一阈值时生成摘要 |
 | 7 | `TodoListMiddleware` | 保存待办，供状态面板展示 |
 | 8 | `PatchToolCallsMiddleware` | 修正部分工具调用消息形态 |
-| 9 | `ModelRetryMiddleware` | 按配置重试模型调用失败 |
+| 9 | `NetworkRetryMiddleware` | 网络错误按预算、其他可重试模型错误按次数重试，耗尽后抛出异常 |
 | 10 | `ImageInputCompatibilityMiddleware` | 桥接工具读取图片与模型输入格式；必要时回退 OCR |
 | 11 | `TokenUsageMiddleware` | 记录近似上下文和主模型实际用量 |
 | 12 | 工具审批 middleware | 默认模式下拦截写文件、编辑文件和执行命令 |
 
 `SubAgentBackend` 复用文件、Skills、Summary、待办、重试和用量等能力，但不挂载子智能体 middleware，并过滤不适合子智能体的敏感或交互工具。
 
+模型重试耗尽后，异常进入 Run 失败通道，持久化 `failed` 状态与错误原因；已有部分输出保留错误元数据。子 Run 的失败通过 `subagent_await` / `subagent_status` 返回给父智能体，由父智能体决定后续处理。最终正常回答仍须满足同 Run 的 model lifecycle 审计关联。
+
 ## Skills 和知识库
 
 Skills middleware 将 Skill 说明按模型请求注入：预加载 Skill 从首轮开放依赖，普通 Skill 在模型读取对应 `SKILL.md` 后激活，再开放声明的工具和 MCP。
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-10-network-retry-budget-ownership.md` (modified, +6/-4)
```diff
@@ -15,10 +15,12 @@ Owner：backend/package/yuxi/agents/middlewares/network_retry.py
 
 ## 决策
 
+本记录拥有网络预算与异常分类规则；次数重试耗尽策略由[模型重试耗尽保留失败语义](./2026-09-23-model-retry-failure.md)部分取代，统一使用 `on_failure="error"`。网络预算的归属与计时规则继续有效。
+
 网络类错误和非网络类错误的重试维度不同（前者预算、后者次数），必须分开处理，但**不拆成两个中间件**——拆分会因为装配顺序和外层重试网络错误而放大预算。改为让 `NetworkRetryMiddleware` 继承 `ModelRetryMiddleware`，用 **handler 包装**区分两类错误，不复制父类的重试逻辑：
 
 - 网络错误：`_wrap_network_retry`/`_awrap_network_retry` 用闭包包装 handler，在 `network_budget_seconds`（默认 600s，环境变量 `YUXI_NETWORK_RETRY_BUDGET_SECONDS`）预算内吞掉网络异常退避重试，耗尽后**显式抛出**（保留 `error_type`/`error_message` 归因，Run 以 `failed` 结束）；
-- 非网络错误：wrapped handler 原样抛出，交给父类 `wrap_model_call`/`awrap_model_call` 按 `retry_on=_retry_non_network_errors`（排除网络异常、`ModelError.is_retryable` 判定）+ `max_retries`/`on_failure` 处理，与原来 `ModelRetryMiddleware` 行为一致。
+- 非网络错误：wrapped handler 原样抛出，交给父类 `wrap_model_call`/`awrap_model_call` 按 `retry_on=_retry_non_network_errors`（排除网络异常、`ModelError.is_retryable` 判定）和 `max_retries` 处理，耗尽后通过显式配置的 `on_failure="error"` 抛出原异常。
 
 预算起点（`started`）和退避进度（`delay`）在闭包创建时固定，跨父类的非网络重试保持，不会因外层重试而放大成多份。`retry_on` 排除网络异常，保证预算耗尽后的网络错误直接抛出、不被父类再次重试或吞成错误消息。
 
@@ -30,7 +32,7 @@ Owner：backend/package/yuxi/agents/middlewares/network_retry.py
 
 ## 后果
 
-网络错误的唯一重试入口是 `NetworkRetryMiddleware` 自身的预算循环，`network_budget_seconds` 是真实上限，不再有外层放大。非网络错误重试语义与 `ModelRetryMiddleware` 一致（`default_retry_on` 的 `ModelError.is_retryable` 判定保留）。
+网络错误的唯一重试入口是 `NetworkRetryMiddleware` 自身的预算循环，`network_budget_seconds` 是真实上限，不再有外层放大。非网络错误复用父类的次数重试与 `ModelError.is_retryable` 判定，耗尽后抛出原异常。
 
 网络重试参数用 `network_` 前缀（`network_budget_seconds`/`network_initial_delay`/`network_max_delay`）与父类非网络重试的 `initial_delay`/`max_delay` 区分。`_is_network_error` 与 `_retry_non_network_errors` 均为模块私有（不再从 `__init__.py` 导出），且依赖公开的 LangChain 模型异常与 HTTPX 异常，不再 import `langchain.agents.middleware._retry` 私有模块。
 
@@ -39,7 +41,7 @@ Owner：backend/package/yuxi/agents/middlewares/network_retry.py
 `backend/test/unit/agents/test_network_retry.py`：
 
 - `test_network_budget_honored_and_fails_explicitly`：虚拟时钟下持续 `ConnectionError`，累计等待受单次 600s 预算约束，最终**抛出**异常而非返回含错误文本的响应；
-- `test_non_network_error_retried_by_max_retries_then_continue`：非网络错误按 `max_retries` 重试后 `on_failure=continue` 返回错误 AIMessage；
+- `test_rate_limit_exhaustion_preserves_original_error`：同步/异步调用在零次或两次重试配置下，429 耗尽后抛出同一个原异常，调用次数为 `max_retries + 1`；
 - `test_non_retryable_model_error_propagates`：`ModelError.is_retryable=False` 立即抛出，不消耗重试次数；
 - `test_non_network_error_retry_succeeds_after_backoff`：非网络错误重试成功后正常返回；
 - `test_network_then_non_network_error_routes_to_parent_retry`：网络异常重试后遇到非网络异常，交给父类按 `max_retries` 重试成功；
@@ -49,6 +51,6 @@ Owner：backend/package/yuxi/agents/middlewares/network_retry.py
 
 `_is_network_error` 沿异常链优先读取 HTTP 4xx/5xx、LangChain 标准模型异常与 HTTPX 传输异常。4xx 保持非网络重试语义；5xx、连接、超时及远端流式协议中断进入网络预算。标准 `ModelError` 的其他类型保持非网络语义，未知包装的文本不能覆盖内层明确的分类。仅在整条链都没有结构化分类时使用原有文本兜底。
 
-只扩充关键词会继续依赖供应商响应措辞，无法可靠区分非法 `timeout` 参数与请求超时；逐个接入供应商 SDK 会增加重复映射。因此复用已有 LangChain/HTTPX 依赖和 SDK 的 HTTP 状态，不引入依赖或配置。该修复闭合既有网络错误契约，直接更新 implemented 记录；总预算计时规则和非网络错误的父类处理策略保持原语义。
+只扩充关键词会继续依赖供应商响应措辞，无法可靠区分非法 `timeout` 参数与请求超时；逐个接入供应商 SDK 会增加重复映射。因此复用已有 LangChain/HTTPX 依赖和 SDK 的 HTTP 状态，不引入依赖或配置。异常分类遵循本记录，次数重试耗尽遵循[显式失败策略](./2026-09-23-model-retry-failure.md)。
 
 回归证据由 `test_network_retry.py` 中真实 SDK 状态码、标准模型错误、同步/异步预算耗尽与非法参数测试提供。恢复关键词优先实现时，这些案例因错误分类、返回错误 AIMessage 或重复执行非法请求失败。真实 worker 断网恢复、最终 Run 状态与用户取消仍需 E2E 验证，分类单测不证明这些结果。
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-23-model-retry-failure.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# 模型重试耗尽保留失败语义
+
+状态：implemented
+类型：bug-fix
+Owner：backend/package/yuxi/agents/middlewares/network_retry.py
+
+## 问题
+
+模型重试中间件默认把耗尽异常合成为 AIMessage。该消息没有 model lifecycle 审计，终态持久化无法关联当前 Run；跳过一致性检查又会使无输出的失败 Run 成为 completed。子任务失败还需要通过真实 worker 链路证明父任务可读取失败并完成清理。
+
+## 决策
+
+本决定部分取代[网络重试预算](./2026-09-10-network-retry-budget-ownership.md)中的次数重试耗尽策略；该记录拥有的网络预算、退避计时与异常分类规则继续有效。
+
+统一中间件使用上游的 on_failure="error"，保留次数重试和网络预算，耗尽后抛出原异常。Run service/worker 拥有失败终态、错误与清理，chat_service 保留输出关联检查。已有部分输出由失败通道保存，带 is_error 和当前错误元数据。范围不含限流调度、并发配额或历史 checkpoint 迁移。
+
+## 替代方案
+
+- 为合成消息打标记并豁免审计：仍需另建失败到 Run 的映射，直接完成会丢失错误语义。
+- 关闭重试：失去瞬时故障恢复能力。
+- 在重试边界抛出异常：复用已有失败通道，改动最小。
+
+## 后果
+
+父智能体通过子 Run 结果读取真实模型失败原因并决定后续操作；默认继续策略的合成错误回答不进入 checkpoint。无需新增消息标记、持久化豁免或 Run 状态。真实 provider 漂移仍需外部探针校准。网络异常的既有分类、预算与取消行为保持原有实现。
+
+## 验证
+
+| 验收主张 | 失败面 | 语义 Owner | 直接证据 / 命令 | 负向案例 | 当前结果 |
+|---|---|---|---|---|---|
+| 重试耗尽抛出原异常，恢复后正常返回 | 合成错误回答或关闭重试 | network_retry.py | 同步/异步 unit；相关集合 70 passed | 修改前四个耗尽断言均因 DID NOT RAISE 失败 | Passed |
+| 429 Run 失败且父任务可处理、清理、继续请求 | 空成功或级联失败 | run_worker.py / Run repository | deterministic E2E 四种场景、HTTP / SSE / PG 回读 | 恢复 continue 后父任务读取的错误为持久化失败，原始 429 断言失败 | Passed |
+
+最小回归命令：`docker compose exec -T api uv run --no-sync --no-dev pytest test/unit/agents/test_network_retry.py test/unit/services/test_chat_service_sync.py -q`；真实链路：`docker compose exec -T api uv run --no-sync --no-dev pytest test/e2e/test_deterministic_agent_path_e2e.py -k model_retry_exhaustion -q`。E2E 位于现有 `system-tests.yml` 整文件 gate 中。
+
+真实豆包限流、五子任务并发与历史 execution tree 清理崩溃未复现；验证覆盖正常装配的首次/工具调用后失败、普通/子 Run 和相同线程重复请求。
```

**File**: `docs/develop-guides/postmortems/2026-09-23-model-retry-failure.md` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+# 模型重试耗尽合成回答破坏终态关联
+
+日期：2026-09-23
+Owner：backend/package/yuxi/agents/middlewares/network_retry.py
+关联决策：[模型重试耗尽保留失败语义](../decisions/implemented/2026-09-23-model-retry-failure.md)
+
+## 影响
+
+[Issue #1062](https://github.com/xerrors/Yuxi/issues/1062) 报告子智能体 429 重试耗尽后发生输出一致性异常，并连锁出现主运行清理失败。确定性回放确认模型错误被替换为输出持久化错误；历史五子任务并发下的清理崩溃尚未复现。普通和子智能体共用同一个重试中间件，均受失败语义影响。
+
+## 事实时间线
+
+- 2026-09-23，PR #1068 提议给合成 AIMessage 打标记并豁免终态审计关联。
+- 2026-09-23，隔离 Compose 的确定性回放确认旧 continue 行为使父智能体读取到“最终输出持久化或绑定失败”；切换 error 策略后，同一链路保留 429 原因并完成父任务和清理。
+
+## 因果链
+
+provider 持续限流 → 模型次数重试耗尽 → 上游默认 continue 合成 AIMessage → 消息没有真实 model lifecycle 审计 → chat_service 无法关联当前 Run 的最终消息 → 输出持久化错误覆盖真实模型失败。豁免关联并写 completed 又会产生成功状态与实际失败不一致的问题。
+
+## 安全网为何漏过
+
+既有次数重试单测明确期待错误 AIMessage，验证了上游默认行为，却没有检查它与 Yuxi 的 Run / audit 契约是否兼容。网络预算测试只覆盖显式抛出路径，无法发现次数重试的另一种耗尽结果。
+
+## 修正与验证
+
+统一中间件显式配置 on_failure="error"。`test_rate_limit_exhaustion_preserves_original_error` 验证同步/异步、零次/两次重试保留原异常。`test_model_retry_exhaustion_preserves_failure_and_parent_recovers` 通过真实 API、worker、HTTP / SSE 与 PostgreSQL，验证首次/工具调用后 429、普通/子 Run、父任务读取失败及重复请求。
+
+命令与结果见[决策记录](../decisions/implemented/2026-09-23-model-retry-failure.md#验证)。恢复旧策略后，unit 四项失败；子任务 E2E 在“父任务收到真实 429 原因”断言处失败。
+
+## 防复发措施
+
+耗尽错误的 oracle 由真实异常、Run 失败字段、部分输出错误元数据与父任务工具结果共同组成。单元测试与现有 Runtime System Tests 的确定性 E2E gate 拒绝合成回答、错误原因丢失及失败后无法继续运行的回归。
+
+## 未解决风险
+
+真实 provider 限流节奏、五子任务并发以及历史清理崩溃仍需现场或外部探针验证；本修复不宣称解决所有 runtime cleanup 故障。
```

---

### Incident Patch 13: `cd3252a0` (2026-09-23)
**Commit Message**: fix(knowledge): 知识库入库改为 PG 先行 + Milvus upsert 幂等重试 (#1065)

按 #893 Phase 1 口径修复 #878：消除 gather 并发双写与 best-effort
回滚产生的单边数据。

- PG 为权威源先行落库，Milvus 只作为派生索引
- Milvus 写入由 insert 改为 upsert（按 chunk 主键幂等），失败有限次
  重试，重试耗尽抛错由上层标记文件状态
- 移除双写失败后的 PG/Milvus 双向回滚：PG 事实保留，重新索引时
  两侧写入均幂等，重跑即可收敛

**File**: `backend/package/yuxi/knowledge/implementations/milvus.py` (modified, +25/-18)
```diff
@@ -39,6 +39,11 @@
 VECTOR_METRIC_TYPE = "COSINE"
 MILVUS_CHUNK_EMBED_BATCH_SIZE = 200
 MILVUS_QUERY_OFFLOAD_LIMIT = 8
+# Milvus 为派生索引：PG 先行落库（权威源），Milvus upsert 失败有限次重试，
+# 重试耗尽则抛错由上层标记文件状态；不回滚 PG（避免单边数据）。
+# 重新索引时 PG batch_upsert 与 Milvus upsert 均按主键幂等，重跑即可收敛。
+MILVUS_CHUNK_UPSERT_ATTEMPTS = 3
+MILVUS_CHUNK_UPSERT_RETRY_DELAY_SECONDS = 1.0
 _milvus_query_offload_semaphore_refs: dict[
     int,
     tuple[weakref.ReferenceType[asyncio.AbstractEventLoop], weakref.ReferenceType[asyncio.Semaphore]],
@@ -564,26 +569,28 @@ async def _insert_chunks_to_stores(
         ]
         chunk_repo = KnowledgeChunkRepository()
 
-        def _insert_milvus_records():
-            collection.insert(entities)
+        def _upsert_milvus_records():
+            collection.upsert(entities)
 
-        pg_task = chunk_repo.batch_upsert(self._build_chunk_pg_records(kb_id, chunks))
-        milvus_task = asyncio.to_thread(_insert_milvus_records)
-        results = await asyncio.gather(pg_task, milvus_task, return_exceptions=True)
-        errors = [result for result in results if isinstance(result, Exception)]
-        if not errors:
-            return
+        # PG 为权威源，先落 chunk 事实；Milvus 只是派生索引，失败不回滚 PG。
+        await chunk_repo.batch_upsert(self._build_chunk_pg_records(kb_id, chunks))
 
-        logger.error(f"Chunk double-write failed for file {file_id}, rolling back PostgreSQL and Milvus chunks")
-        try:
-            await chunk_repo.delete_by_file_id(file_id)
-        except Exception as cleanup_error:
-            logger.error(f"Failed to rollback PostgreSQL chunks for {file_id}: {cleanup_error}")
-        try:
-            await self._delete_file_chunks_from_milvus(collection, file_id)
-        except Exception as cleanup_error:
-            logger.error(f"Failed to rollback Milvus chunks for {file_id}: {cleanup_error}")
-        raise errors[0]
+        last_error: Exception | None = None
+        for attempt in range(MILVUS_CHUNK_UPSERT_ATTEMPTS):
+            try:
+                await asyncio.to_thread(_upsert_milvus_records)
+                return
+            except Exception as e:
+                last_error = e
+                logger.warning(
+                    f"Milvus chunk upsert failed for file {file_id} "
+                    f"(attempt {attempt + 1}/{MILVUS_CHUNK_UPSERT_ATTEMPTS}): {e}"
+                )
+                if attempt + 1 < MILVUS_CHUNK_UPSERT_ATTEMPTS:
+                    await asyncio.sleep(MILVUS_CHUNK_UPSERT_RETRY_DELAY_SECONDS)
+
+        assert last_error is not None
+        raise last_error
 
     async def _embed_and_store_chunks(
         self,
```

**File**: `backend/test/unit/plugins/test_milvus_kb.py` (modified, +83/-15)
```diff
@@ -44,6 +44,7 @@ def __init__(self, distance: float = 0.8):
         self.search_calls = []
         self.hybrid_calls = []
         self.insert_calls = []
+        self.upsert_calls = []
         self.distance = distance
 
     def search(self, **kwargs):
@@ -57,6 +58,9 @@ def hybrid_search(self, **kwargs):
     def insert(self, entities):
         self.insert_calls.append(entities)
 
+    def upsert(self, entities):
+        self.upsert_calls.append(entities)
+
 
 def make_kb(collection: FakeCollection) -> MilvusKB:
     kb = MilvusKB.__new__(MilvusKB)
@@ -583,7 +587,40 @@ def delete(self, _expr):
     assert all(thread_id != event_loop_thread for thread_id in call_threads)
 
 
-async def test_insert_chunks_to_stores_inserts_current_batch(monkeypatch):
+async def test_insert_chunks_to_stores_writes_pg_first_then_milvus_upsert(monkeypatch):
+    event_log = []
+
+    class FakeChunkRepo:
+        async def batch_upsert(self, chunks):
+            event_log.append("pg")
+            return []
+
+    monkeypatch.setattr("yuxi.knowledge.implementations.milvus.KnowledgeChunkRepository", FakeChunkRepo)
+    kb = MilvusKB.__new__(MilvusKB)
+    collection = FakeCollection()
+
+    original_upsert = collection.upsert
+
+    def upsert(entities):
+        event_log.append("milvus")
+        original_upsert(entities)
+
+    collection.upsert = upsert
+    chunks = [make_chunk(index) for index in range(3)]
+    embeddings = [[0.1, 0.2] for _ in chunks]
+
+    await kb._insert_chunks_to_stores("db", "file-1", collection, chunks, embeddings)
+
+    # PG 为权威源先行落库，Milvus 只做派生索引
+    assert event_log == ["pg", "milvus"]
+    assert len(collection.upsert_calls) == 1
+    assert collection.upsert_calls[0][0] == ["id-0", "id-1", "id-2"]
+    assert collection.upsert_calls[0][5] == embeddings
+    assert collection.insert_calls == []
+
+
+async def test_insert_chunks_to_stores_retries_milvus_upsert_and_keeps_pg_facts(monkeypatch):
+    monkeypatch.setattr(milvus_module, "MILVUS_CHUNK_UPSERT_RETRY_DELAY_SECONDS", 0)
     repos = []
 
     class FakeChunkRepo:
@@ -602,20 +639,32 @@ async def delete_by_file_id(self, file_id):
 
     monkeypatch.setattr("yuxi.knowledge.implementations.milvus.KnowledgeChunkRepository", FakeChunkRepo)
     kb = MilvusKB.__new__(MilvusKB)
-    collection = FakeCollection()
-    chunks = [make_chunk(index) for index in range(3)]
+
+    class FlakyCollection(FakeCollection):
+        def __init__(self):
+            super().__init__()
+            self.attempts = 0
+
+        def upsert(self, entities):
+            self.attempts += 1
+            if self.attempts == 1:
+                raise RuntimeError("milvus transient")
+            self.upsert_calls.append(entities)
+
+    collection = FlakyCollection()
+    chunks = [make_chunk(index) for index in range(2)]
     embeddings = [[0.1, 0.2] for _ in chunks]
 
     await kb._insert_chunks_to_stores("db", "file-1", collection, chunks, embeddings)
 
-    assert len(collection.insert_calls) == 1
-    assert collection.insert_calls[0][0] == ["id-0", "id-1", "id-2"]
-    assert collection.insert_calls[0][5] == embeddings
-    assert len(repos[0].upsert_calls) == 1
-    assert [record["chunk_id"] for record in repos[0].upsert_calls[0]] == ["chunk-0", "chunk-1", "chunk-2"]
+    # 重试成功即收敛：PG 事实保留，不触发回滚
+    assert collection.attempts == 2
+    assert len(collection.upsert_calls) == 1
+    assert repos[0].delete_calls == []
 
 
-async def test_insert_chunks_to_stores_rolls_back_file_when_milvus_insert_fails(monkeypatch):
+async def test_insert_chunks_to_stores_raises_after_retry_exhaustion_without_rollback(monkeypatch):
+    monkeypatch.setattr(milvus_module, "MILVUS_CHUNK_UPSERT_RETRY_DELAY_SECONDS", 0)
     repos = []
 
     class FakeChunkRepo:
@@ -632,13 +681,13 @@ async def delete_by_file_id(self, file_id):
             self.delete_calls.append(file_id)
             return 0
 
+    monkeypatch.setattr("yuxi.knowledge.implementations.milvus.KnowledgeChunkRepository", FakeChunkRepo)
+    kb = MilvusKB.__new__(MilvusKB)
+
     class FailingCollection(FakeCollection):
-        def insert(self, entities):
-            super().insert(entities)
+        def upsert(self, entities):
             raise RuntimeError("milvus boom")
 
-    monkeypatch.setattr("yuxi.knowledge.implementations.milvus.KnowledgeChunkRepository", FakeChunkRepo)
-    kb = MilvusKB.__new__(MilvusKB)
     collection = FailingCollection()
     milvus_delete_calls = []
 
@@ -652,8 +701,27 @@ async def delete_file_chunks_from_milvus(collection_arg, file_id):
     with pytest.raises(RuntimeError, match="milvus boom"):
         await kb._insert_chunks_to_stores("db", "file-1", collection, chunks, embeddings)
 
-    assert repos[0].delete_calls == ["file-1"]
-    assert milvus_delete_calls == [(collection, "file-1")]
+    # 重试耗尽后抛错且不回滚：PG 事实保留，等待重新索引幂等收敛
+    assert repos[0].delete_calls == []
+    assert milvus_delete_calls == []
+
+
+async def test_insert_chunks_to_stores_propagates_pg_failure
```

---

### Incident Patch 14: `719fe7a4` (2026-09-21)
**Commit Message**: fix(web): 完善智能体管理页加载提示并调整标签页结构

列表加载与刷新失败时给出明确错误提示，不再静默吞掉异常；
定时任务标签固定排在模型供应商之后，并精简统计条只保留总量与可管理数。

**File**: `web/src/components/model-management/AgentManagePanel.vue` (modified, +24/-6)
```diff
@@ -85,13 +85,27 @@ const loadAgents = async () => {
   try {
     const response = await agentApi.getAgents({ includeSubagents: true })
     managedAgents.value = (response.agents || []).map(normalizeAgent)
-  } catch (error) {
-    message.error(error.message || '加载智能体失败')
   } finally {
     agentLoading.value = false
   }
 }
 
+const refreshAgents = async () => {
+  try {
+    await loadAgents()
+  } catch (error) {
+    message.error(error.message || '加载智能体失败')
+  }
+}
+
+const handleAgentSaved = async () => {
+  try {
+    await refreshAgentLists()
+  } catch (error) {
+    message.error(error.message || '刷新智能体列表失败')
+  }
+}
+
 const openCreateAgentModal = () => {
   agentEditModalRef.value?.openCreate()
 }
@@ -134,13 +148,17 @@ const deleteAgent = async (agent) => {
 }
 
 onMounted(async () => {
-  await Promise.all([loadAgentBackends(), loadAgents()])
+  const results = await Promise.allSettled([loadAgentBackends(), loadAgents()])
+  const failedLoad = results.find((result) => result.status === 'rejected')
+  if (failedLoad) {
+    message.error(failedLoad.reason?.message || '加载智能体失败')
+  }
 })
 
 defineExpose({
   loading: agentLoading,
   stats: agentStats,
-  refresh: loadAgents
+  refresh: refreshAgents
 })
 </script>
 
@@ -150,7 +168,7 @@ defineExpose({
       <template #actions>
         <a-button
           class="lucide-icon-btn"
-          @click="loadAgents"
+          @click="refreshAgents"
           :disabled="agentLoading"
           aria-label="刷新智能体"
         >
@@ -243,7 +261,7 @@ defineExpose({
     <AgentEditModal
       ref="agentEditModalRef"
       :backend-options="agentBackendOptions"
-      @saved="refreshAgentLists"
+      @saved="handleAgentSaved"
     />
   </div>
 </template>
```

**File**: `web/src/views/AgentManageView.vue` (modified, +1/-4)
```diff
@@ -20,9 +20,9 @@ const schedulePanelRef = ref(null)
 const modelManageTabs = computed(() => {
   const tabs = [
     { key: 'agents', label: '智能体' },
-    { key: 'schedules', label: '定时任务 (beta)' }
   ]
   if (userStore.isAdmin) tabs.push({ key: 'providers', label: '模型供应商' })
+  tabs.push({ key: 'schedules', label: '定时任务 (beta)' })
   return tabs
 })
 
@@ -78,12 +78,9 @@ onBeforeRouteUpdate((to) => canChangeTab(normalizeTab(to.query.tab)))
       <template #info>
         <div v-if="activeTab === 'agents'" class="summary-strip">
           <span>{{ activeStats.total || 0 }} 个智能体</span>
-          <span>{{ activeStats.global || 0 }} 个全局</span>
-          <span v-if="activeStats.builtin">{{ activeStats.builtin }} 个内置</span>
           <span>{{ activeStats.manageable || 0 }} 个可管理</span>
         </div>
         <div v-else-if="activeTab === 'providers'" class="summary-strip">
-          <span>{{ activeStats.total || 0 }} 个供应商</span>
           <span>{{ activeStats.enabled || 0 }} 个启用</span>
           <span v-if="activeStats.warning > 0" class="warning-count">
             {{ activeStats.warning }} 个凭证缺失
```

---

### Incident Patch 15: `7c96688b` (2026-09-23)
**Commit Message**: fix(knowledge): URL 抓取修复 DNS rebinding 型 SSRF (#1057)

* fix(dashboard): 审计接口时间字段补充时区标识

dashboard 模块 7 处时间字段使用裸 isoformat() 序列化，输出无时区后缀，
违反 datetime_utils.py 中对外暴露带时区标识 ISO 字符串的约定，导致
前端按本地时间解析后把 UTC 原样显示（#1051）。

统一改走 format_utc_datetime()，与 conversation_service.py 等现有用法
一致，空值语义不变，前端无需改动。

* fix(knowledge): URL 抓取修复 DNS rebinding 型 SSRF

is_private_ip 校验与 httpx 连接各自独立解析 DNS，存在 TOCTOU 窗口；
解析失败时返回 False 直接放行；未覆盖云元数据等特殊网段。

改为在 httpcore network backend 的 connect_tcp 内单次解析、校验全部
解析结果并连接到已校验 IP（TLS SNI 与证书校验仍使用原始域名），
解析失败默认拒绝，并显式封禁 AWS/GCP/Azure/阿里云元数据地址。(#881)

* fix(knowledge): 建连支持已校验地址回退并显式约束 httpcore 版本

按 review 意见调整：
- connect_tcp 在全部解析地址完成校验后按统一超时预算依次尝试，
  保留 IPv6/IPv4 与多 A 记录的可用性回退；回退范围严格限制在
  已校验地址集合内
- package 显式依赖 httpcore>=1.0.9,<1.1，约束 network_backend
  接线所用实现的兼容版本
- 新增回退、超时预算均分、接线（transport -> connect_tcp）测试，
  共 27 passed

**File**: `backend/package/pyproject.toml` (modified, +3/-0)
```diff
@@ -27,6 +27,9 @@ dependencies = [
     "docling-slim[format-office,format-pdf-pypdfium2]==2.122.0",
     "docx2txt>=0.9",
     "httpx>=0.27.0",
+    # SSRFGuardTransport 依赖 httpcore 的 pool network_backend 接线，
+    # 显式约束兼容版本（httpx 0.28 本身也锁定 httpcore==1.0.*）
+    "httpcore>=1.0.9,<1.1",
     "json-repair>=0.54.0",
     "langchain>=1.3.15",
     "langchain-core>=1.6.0",
```

**File**: `backend/package/yuxi/knowledge/utils/url_fetcher.py` (modified, +115/-28)
```diff
@@ -1,8 +1,12 @@
+import asyncio
 import ipaddress
 import socket
-from urllib.parse import urljoin, urlparse
+import typing
+from urllib.parse import urljoin
 
+import httpcore
 import httpx
+from httpcore._backends.base import SOCKET_OPTION, AsyncNetworkStream
 
 from yuxi.knowledge.utils.url_validator import is_url_parsing_enabled, validate_url
 from yuxi.utils import logger
@@ -12,26 +16,115 @@
 # 允许的 Content-Type
 ALLOWED_CONTENT_TYPES = ["text/html", "application/xhtml+xml"]
 
+# DNS rebinding 防护：解析、校验与连接必须使用同一次解析结果。
+# is_global 已排除 loopback/私网/链路本地等地址；云元数据服务所在的
+# 特殊网段在此显式补充，不依赖 ipaddress 版本行为。
+EXTRA_BLOCKED_ADDRESSES = frozenset(
+    ipaddress.ip_address(ip)
+    for ip in (
+        "169.254.169.254",  # AWS/GCP/Azure metadata
+        "100.100.200.200",  # Alibaba Cloud metadata (CGNAT 段)
+        "fd00:ec2::254",  # AWS IPv6 metadata
+    )
+)
 
-async def is_private_ip(hostname: str) -> bool:
-    """Check if the hostname resolves to a private IP address."""
-    import asyncio
+ResolvedAddresses = list[ipaddress.IPv4Address | ipaddress.IPv6Address]
 
+
+async def resolve_hostname_addresses(hostname: str) -> ResolvedAddresses:
+    """Resolve a hostname to deduped IP addresses, failing closed on errors."""
     try:
-        # Resolve hostname to IP in a separate thread to avoid blocking the event loop
-        ip_list = await asyncio.to_thread(socket.getaddrinfo, hostname, None)
-        for item in ip_list:
-            ip_addr = item[4][0]
-            ip_obj = ipaddress.ip_address(ip_addr)
-            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
-                return True
-        return False
+        infos = await asyncio.to_thread(socket.getaddrinfo, hostname, None)
     except Exception as e:
-        logger.warning(f"Failed to resolve hostname {hostname}: {e}")
-        # If resolution fails, assume it's unsafe or let the connection fail naturally,
-        # but to be safe we can return True to block it if strict mode is preferred.
-        # For now, we return False assuming standard DNS failure handling.
-        return False
+        raise ValueError(f"DNS resolution failed for {hostname}: {e}") from e
+
+    addresses: ResolvedAddresses = []
+    for info in infos:
+        try:
+            address = ipaddress.ip_address(info[4][0])
+        except ValueError:
+            continue
+        if address not in addresses:
+            addresses.append(address)
+
+    if not addresses:
+        raise ValueError(f"DNS resolution returned no usable address for {hostname}")
+    return addresses
+
+
+def is_blocked_address(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
+    """True for any non-public address, including known cloud metadata ranges."""
+    return not address.is_global or address in EXTRA_BLOCKED_ADDRESSES
+
+
+def assert_no_blocked_address(addresses: ResolvedAddresses) -> None:
+    blocked = [str(address) for address in addresses if is_blocked_address(address)]
+    if blocked:
+        raise ValueError(f"Access to private IP addresses is forbidden: {', '.join(blocked)}")
+
+
+class SSRFGuardBackend(httpcore.AsyncNetworkBackend):
+    """Network backend that connects only to pre-validated public IPs.
+
+    Resolution happens once inside connect_tcp; the same resolved IP is used
+    for the connection, closing the DNS rebinding window. TLS SNI and
+    certificate verification keep using the original hostname because
+    httpcore takes the server_hostname from request extensions, not from the
+    socket address.
+    """
+
+    def __init__(self, default_backend: httpcore.AsyncNetworkBackend | None = None):
+        # httpcore 的默认 backend 未在公共 API 暴露，AutoBackend 是
+        # AsyncConnectionPool 缺省使用的实现。
+        self._default = default_backend or _create_default_backend()
+
+    async def connect_tcp(
+        self,
+        host: str,
+        port: int,
+        timeout: float | None = None,
+        local_address: str | None = None,
+        socket_options: typing.Iterable[SOCKET_OPTION] | None = None,
+    ) -> AsyncNetworkStream:
+        addresses = await resolve_hostname_addresses(host)
+        assert_no_blocked_address(addresses)
+
+        # 所有解析地址都已完成安全校验，按统一超时预算依次尝试，
+        # 保留多地址（IPv6/IPv4、多 A 记录）的可用性回退。
+        per_attempt_timeout = timeout / len(addresses) if timeout is not None else None
+        last_error: OSError | None = None
+        for address in addresses:
+            try:
+                return await self._default.connect_tcp(
+                    str(address),
+                    port,
+                    timeout=per_attempt_timeout,
+                    local_address=local_address,
+                    socket_options=socket_options,
+                )
+            except OSError as e:
+                last_error = e
+
+        assert last_error is not None
+        raise last_error
+
+
+def _create_default_backend() -> httpcore.AsyncNetworkBackend:
+    from httpcore._backends.auto impor
```

**File**: `backend/package/yuxi/repositories/dashboard_repository.py` (modified, +4/-4)
```diff
@@ -19,7 +19,7 @@
     ToolCall,
     User,
 )
-from yuxi.utils.datetime_utils import UTC, ensure_shanghai, shanghai_now, utc_now
+from yuxi.utils.datetime_utils import UTC, ensure_shanghai, format_utc_datetime, shanghai_now, utc_now
 
 
 class DashboardRepository:
@@ -164,8 +164,8 @@ async def list_conversations(
                     "message_count": stats.message_count if stats else 0,
                     "total_tokens": usage.total_tokens,
                     "token_usage_complete": bool(usage.complete),
-                    "created_at": conversation.created_at.isoformat() if conversation.created_at else "",
-                    "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else "",
+                    "created_at": format_utc_datetime(conversation.created_at) or "",
+                    "updated_at": format_utc_datetime(conversation.updated_at) or "",
                 }
             )
         return {
@@ -981,7 +981,7 @@ async def get_thread_analytics(
                 "avatar": normalize_public_minio_url(row.avatar) if row.avatar else None,
                 "thread_count": int(row.thread_count or 0),
                 "message_count": int(row.message_count or 0),
-                "last_active_at": row.last_active_at.isoformat() if row.last_active_at else None,
+                "last_active_at": format_utc_datetime(row.last_active_at),
             }
             for row in user_rows
         ]
```

**File**: `backend/package/yuxi/services/dashboard_service.py` (modified, +5/-4)
```diff
@@ -9,6 +9,7 @@
 from yuxi.repositories.conversation_repository import ConversationRepository
 from yuxi.repositories.dashboard_repository import DashboardRepository
 from yuxi.storage.minio.client import normalize_public_minio_url
+from yuxi.utils.datetime_utils import format_utc_datetime
 
 
 class DashboardService:
@@ -47,7 +48,7 @@ async def get_feedbacks(self, *, rating: str | None = None, agent_id: str | None
                 "avatar": normalize_public_minio_url(user.avatar) if user else None,
                 "rating": feedback.rating,
                 "reason": feedback.reason,
-                "created_at": feedback.created_at.isoformat() if feedback.created_at else "",
+                "created_at": format_utc_datetime(feedback.created_at) or "",
                 "message_content": message.content if message else "",
                 "conversation_title": conversation.title if conversation else None,
                 "agent_id": conversation.agent_id if conversation else "",
@@ -116,7 +117,7 @@ async def get_conversation_detail(self, thread_id: str) -> dict[str, Any] | None
                 "role": message.role,
                 "content": message.content,
                 "message_type": message.message_type,
-                "created_at": message.created_at.isoformat() if message.created_at else "",
+                "created_at": format_utc_datetime(message.created_at) or "",
                 "token_count": message.token_count,
             }
             if message.tool_calls:
@@ -147,8 +148,8 @@ async def get_conversation_detail(self, thread_id: str) -> dict[str, Any] | None
             "status": conversation.status,
             "is_pinned": bool(conversation.is_pinned),
             "message_count": stats.message_count if stats else len(message_list),
-            "created_at": conversation.created_at.isoformat() if conversation.created_at else "",
-            "updated_at": conversation.updated_at.isoformat() if conversation.updated_at else "",
+            "created_at": format_utc_datetime(conversation.created_at) or "",
+            "updated_at": format_utc_datetime(conversation.updated_at) or "",
             **await self.repo.get_conversation_token_usage(conversation.id),
             "messages": message_list,
         }
```

**File**: `backend/test/unit/knowledge/test_url_fetcher.py` (added, +215/-0)
```diff
@@ -0,0 +1,215 @@
+"""SSRF 防护（DNS rebinding）相关测试。"""
+
+import ipaddress
+import socket
+
+import httpcore
+import httpx
+import pytest
+from yuxi.knowledge.utils import url_fetcher
+from yuxi.knowledge.utils.url_fetcher import (
+    SSRFGuardBackend,
+    assert_no_blocked_address,
+    is_blocked_address,
+    resolve_hostname_addresses,
+)
+
+
+class RecordingBackend(httpcore.AsyncNetworkBackend):
+    """记录 connect_tcp 目标的假 backend，不发起真实连接。
+
+    fail_hosts 中的地址会抛出 ConnectionError，用于模拟不可达。
+    """
+
+    def __init__(self, fail_hosts: set[str] | None = None):
+        self.calls: list[tuple[str, int, float | None]] = []
+        self.fail_hosts = fail_hosts or set()
+
+    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
+        self.calls.append((host, port, timeout))
+        if host in self.fail_hosts:
+            raise ConnectionError(f"unreachable: {host}")
+        return object()
+
+
+def _addr_infos(*addresses: str) -> list:
+    infos = []
+    for address in addresses:
+        ip = ipaddress.ip_address(address)
+        family = socket.AF_INET if ip.version == 4 else socket.AF_INET6
+        if ip.version == 4:
+            sockaddr = (address, 0)
+        else:
+            sockaddr = (address, 0, 0, 0)
+        infos.append((family, socket.SOCK_STREAM, 6, "", sockaddr))
+    return infos
+
+
+@pytest.fixture
+def recording_backend():
+    return RecordingBackend()
+
+
+def _patch_getaddrinfo(monkeypatch, result):
+    def fake_getaddrinfo(host, port, *args, **kwargs):
+        if isinstance(result, Exception):
+            raise result
+        return result
+
+    monkeypatch.setattr(url_fetcher.socket, "getaddrinfo", fake_getaddrinfo)
+
+
+async def test_resolve_dedupes_addresses(monkeypatch):
+    _patch_getaddrinfo(
+        monkeypatch,
+        _addr_infos("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946", "93.184.216.34"),
+    )
+    resolved = await resolve_hostname_addresses("example.com")
+    assert resolved == [
+        ipaddress.ip_address("93.184.216.34"),
+        ipaddress.ip_address("2606:2800:220:1:248:1893:25c8:1946"),
+    ]
+
+
+async def test_resolve_fails_closed_on_dns_error(monkeypatch):
+    _patch_getaddrinfo(monkeypatch, socket.gaierror("boom"))
+    with pytest.raises(ValueError, match="DNS resolution failed"):
+        await resolve_hostname_addresses("example.com")
+
+
+async def test_resolve_fails_closed_on_empty_result(monkeypatch):
+    _patch_getaddrinfo(monkeypatch, [])
+    with pytest.raises(ValueError, match="no usable address"):
+        await resolve_hostname_addresses("example.com")
+
+
+@pytest.mark.parametrize(
+    "address",
+    [
+        "127.0.0.1",
+        "10.0.0.5",
+        "172.16.0.9",
+        "192.168.1.1",
+        "0.0.0.0",
+        "169.254.169.254",
+        "100.100.200.200",
+        "fe80::1",
+        "::1",
+        "fc00::1",
+        "fd00:ec2::254",
+    ],
+)
+def test_is_blocked_address_rejects_non_public(address):
+    assert is_blocked_address(ipaddress.ip_address(address)) is True
+
+
+@pytest.mark.parametrize("address", ["93.184.216.34", "8.8.8.8", "2606:2800:220:1:248:1893:25c8:1946"])
+def test_is_blocked_address_allows_public(address):
+    assert is_blocked_address(ipaddress.ip_address(address)) is False
+
+
+def test_assert_no_blocked_address_reports_offender():
+    with pytest.raises(ValueError, match="10.0.0.5"):
+        assert_no_blocked_address([ipaddress.ip_address("93.184.216.34"), ipaddress.ip_address("10.0.0.5")])
+
+
+async def test_backend_connects_to_resolved_public_ip(monkeypatch, recording_backend):
+    _patch_getaddrinfo(monkeypatch, _addr_infos("93.184.216.34"))
+    backend = SSRFGuardBackend(default_backend=recording_backend)
+
+    await backend.connect_tcp("example.com", 443)
+
+    # 连接目标必须是校验过的 IP，而不是再解析一次 hostname
+    assert recording_backend.calls == [("93.184.216.34", 443, None)]
+
+
+async def test_backend_blocks_private_resolution_without_connecting(monkeypatch, recording_backend):
+    _patch_getaddrinfo(monkeypatch, _addr_infos("10.0.0.5"))
+    backend = SSRFGuardBackend(default_backend=recording_backend)
+
+    with pytest.raises(ValueError, match="private IP"):
+        await backend.connect_tcp("internal.example.com", 443)
+
+    assert recording_backend.calls == []
+
+
+async def test_backend_fails_closed_when_resolution_fails(monkeypatch, recording_backend):
+    _patch_getaddrinfo(monkeypatch, socket.gaierror("boom"))
+    backend = SSRFGuardBackend(default_backend=recording_backend)
+
+    with pytest.raises(ValueError, match="DNS resolution failed"):
+        await backend.connect_tcp("example.com", 443)
+
+    assert recording_backend.calls == []
+
+
+async def test_backend_blocks_metadata_address(monkeypatch, recording_backend):
+    _patch_getaddrinfo(monkeypatch, _addr_infos("169.254.169.254"))
+    backend = SSRFGuardBackend(default_backend=recording_backend)
+
+    with pytest.raises(ValueError, match="priv
```

**File**: `backend/test/unit/services/test_dashboard_service.py` (modified, +23/-0)
```diff
@@ -448,6 +448,29 @@ async def test_dashboard_service_list_conversations_search(dashboard_db):
     assert next(item for item in options["agents"] if item["agent_id"] == "removed-agent")["is_deleted"] is True
 
 
+async def test_dashboard_audit_timestamps_carry_timezone_designator(dashboard_db):
+    """审计接口对外时间必须带时区标识（约定 UTC + Z 后缀），否则前端会按本地时间误读。"""
+    service = DashboardService(dashboard_db)
+
+    conversations = await service.list_conversations(limit=20)
+    assert conversations["items"]
+    for item in conversations["items"]:
+        assert item["created_at"].endswith("Z")
+        assert item["updated_at"].endswith("Z")
+
+    detail = await service.get_conversation_detail("thread-102")
+    assert detail is not None
+    assert detail["created_at"].endswith("Z")
+    assert detail["updated_at"].endswith("Z")
+    for message in detail["messages"]:
+        assert message["created_at"].endswith("Z")
+
+    feedbacks = await service.get_feedbacks()
+    assert feedbacks
+    for feedback in feedbacks:
+        assert feedback["created_at"].endswith("Z")
+
+
 async def test_dashboard_service_conversation_detail(dashboard_db):
     service = DashboardService(dashboard_db)
     detail = await service.get_conversation_detail("thread-102")
```

**File**: `backend/uv.lock` (modified, +10/-8)
```diff
@@ -3,8 +3,8 @@ revision = 3
 requires-python = ">=3.12, <3.14"
 resolution-markers = [
     "python_full_version >= '3.13' and sys_platform != 'darwin'",
-    "python_full_version < '3.13' and sys_platform != 'darwin'",
     "python_full_version >= '3.13' and sys_platform == 'darwin'",
+    "python_full_version < '3.13' and sys_platform != 'darwin'",
     "python_full_version < '3.13' and sys_platform == 'darwin'",
 ]
 
@@ -3302,10 +3302,10 @@ resolution-markers = [
     "python_full_version < '3.13' and sys_platform == 'darwin'",
 ]
 dependencies = [
-    { name = "annotated-doc", marker = "sys_platform == 'darwin'" },
-    { name = "click", marker = "sys_platform == 'darwin'" },
-    { name = "rich", marker = "sys_platform == 'darwin'" },
-    { name = "shellingham", marker = "sys_platform == 'darwin'" },
+    { name = "annotated-doc" },
+    { name = "click" },
+    { name = "rich" },
+    { name = "shellingham" },
 ]
 sdist = { url = "https://pypi.tuna.tsinghua.edu.cn/packages/f2/1e/a27cc02a0cd715118c71fa2aef2c687fdefc3c28d90fd0dd789c5118154c/typer-0.21.2.tar.gz", hash = "sha256:1abd95a3b675e17ff61b0838ac637fe9478d446d62ad17fa4bb81ea57cc54028", size = 120426, upload-time = "2026-02-10T19:33:46.182Z" }
 wheels = [
@@ -3321,10 +3321,10 @@ resolution-markers = [
     "python_full_version < '3.13' and sys_platform != 'darwin'",
 ]
 dependencies = [
-    { name = "annotated-doc", marker = "sys_platform != 'darwin'" },
+    { name = "annotated-doc" },
     { name = "colorama", marker = "sys_platform == 'win32'" },
-    { name = "rich", marker = "sys_platform != 'darwin'" },
-    { name = "shellingham", marker = "sys_platform != 'darwin'" },
+    { name = "rich" },
+    { name = "shellingham" },
 ]
 sdist = { url = "https://pypi.tuna.tsinghua.edu.cn/packages/7c/f7/68adc395201b20b872d68e975386832e8005ffeacedd43a1d837a32815be/typer-0.26.8.tar.gz", hash = "sha256:c244a6bd558886fe3f8780efb6bdd28bb9aff005a94eedebaa5cb32926fe2f7e", size = 202097, upload-time = "2026-06-26T09:22:45.705Z" }
 wheels = [
@@ -3778,6 +3778,7 @@ dependencies = [
     { name = "deepagents" },
     { name = "docling-slim", extra = ["format-office", "format-pdf-pypdfium2"] },
     { name = "docx2txt" },
+    { name = "httpcore" },
     { name = "httpx" },
     { name = "json-repair" },
     { name = "langchain" },
@@ -3849,6 +3850,7 @@ requires-dist = [
     { name = "deepagents", specifier = ">=0.7.7,<0.8" },
     { name = "docling-slim", extras = ["format-office", "format-pdf-pypdfium2"], specifier = "==2.122.0" },
     { name = "docx2txt", specifier = ">=0.9" },
+    { name = "httpcore", specifier = ">=1.0.9,<1.1" },
     { name = "httpx", specifier = ">=0.27.0" },
     { name = "json-repair", specifier = ">=0.54.0" },
     { name = "langchain", specifier = ">=1.3.15" },
```

#### Recent Merged Pull Requests:
- **PR #1092** (closed): feat: 升级 Milvus 3.0.2 并支持文本检索 (@xerrors)
- **PR #1090** (closed): 同步上游更新 (@Zaelindra)
- **PR #1088** (2026-09-29): feat: 支持共享 Skill 编辑并收敛安装服务边界 (@xerrors)
- **PR #1087** (closed): feat: 统一 Public v1 Agent 会话与 Knowledge 查询接口 (@xerrors)
- **PR #1086** (2026-09-28): fix: 降低 worker 健康检查与前端轮询的空闲开销 (@xerrors)
- **PR #1085** (2026-09-28): fix(web): 组合输入状态下按回车不再误发送 (@sososhuo)
- **PR #1083** (closed): docs: add one-click deploy button (@cosark)
- **PR #1082** (2026-09-28): fix: 保持自动摘要失败的 checkpoint 原子性 (@OUAO-FRANK)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
