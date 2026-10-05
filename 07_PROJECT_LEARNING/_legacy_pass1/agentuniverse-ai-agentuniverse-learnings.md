# Forensic Learning Record (Deep Inspection): agentuniverse-ai/agentUniverse

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentuniverse-ai-agentuniverse-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentuniverse-ai/agentUniverse](https://github.com/agentuniverse-ai/agentUniverse))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:19:30.937Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentuniverse-ai/agentUniverse`
- **Description**: agentUniverse is a LLM multi-agent framework that allows developers to easily build multi-agent applications. 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2374 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agentuniverse/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/4/2 11:11
# @Author  : jerry.zzw 
# @Email   : jerry.zzw@antgroup.com
# @FileName: __init__.py

```

### Core Architecture Module: `agentuniverse/agent/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/4/2 15:19
# @Author  : jerry.zzw 
# @Email   : jerry.zzw@antgroup.com
# @FileName: __init__.py

```

### Core Architecture Module: `agentuniverse/agent/action/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/4/2 17:05
# @Author  : wangchongshi
# @Email   : wangchongshi.wcs@antgroup.com
# @FileName: __init__.py

```

### Core Architecture Module: `agentuniverse/agent/action/knowledge/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/4/2 17:06
# @Author  : wangchongshi
# @Email   : wangchongshi.wcs@antgroup.com
# @FileName: __init__.py

```

### Core Architecture Module: `agentuniverse/agent/action/knowledge/doc_processor/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/7/23 13:59
# @Author  : fanen.lhy
# @Email   : fanen.lhy@antgroup.com
# @FileName: __init__.py

```

### Core Architecture Module: `agentuniverse/agent/action/knowledge/doc_processor/academic_paper_fragmenter.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/12/04 00:00
# @Author  : AI Assistant
# @Email   : ai@example.com
# @FileName: academic_paper_fragmenter.py

import re
import logging
from typing import List, Optional, Dict, Set, Tuple
from dataclasses import dataclass
from datetime import datetime

from agentuniverse.agent.action.knowledge.doc_processor.doc_processor import DocProcessor
from agentuniverse.agent.action.knowledge.store.document import Document
from agentuniverse.agent.action.knowledge.store.query import Query
from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger

logger = logging.getLogger(__name__)


@dataclass
class PaperSection:
    """Represents a section in an academic paper.

    Attributes:
        name: Section name (e.g., 'Abstract', 'Introduction').
        text: Content of the section.
        start_pos: Starting position in original text.
        end_pos: Ending position in original text.
    """
    name: str
    text: str
    start_pos: int
    end_pos: int


@dataclass
class Argument:
    """Represents an argument or claim in the paper.

    Attributes:
        text: The argument text.
        argument_type: Type of argument (thesis, evidence, conclusion).
        section: Section containing this argument.
        citations: List of citations supporting this argument.
        position: Position in the section.
    """
    text: str
    argument_type: str
    section: str
    citations: List[str]
    position: int


class AcademicPaperFragmenter(DocProcessor):
    """Fragment academic papers by arguments and evidence.

    This processor analyzes academic papers and fragments them by:
    1. Detecting paper structure (Abstract, Introduction, Methods, Results, Discussion)
    2. Identifying thesis statements vs supporting evidence
    3. Extracting citations and linking them to evidence
    4. Creating documents with rich metadata about argument types and relationships

    Attributes:
        detect_sections: Whether to detect and parse paper sections.
        extract_citations: Whether to extract citation information.
        link_evidence: Whether to link evidence to claims.
        section_patterns: Dictionary of regex patterns for section detection.
        min_argument_length: Minimum length for a valid argument (characters).
        skip_on_error: Whether to skip documents that fail processing.
    """

    detect_sections: bool = True
    extract_citations: bool = True
    link_evidence: bool = True
    section_patterns: Optional[Dict[str, str]] = None
    min_argument_length: int = 20  # Lowered from 50 to capture shorter arguments
    skip_on_error: bool = True

    def __init__(self, **data):
        super().__init__(**data)
        if self.section_patterns is None:
            self.section_patterns = {
                'abstract': r'^(Abstract|ABSTRACT|摘\s*要)',
                'introduction': r'^(Introduction|INTRODUCTION|1\.?\s*Introduction|引\s*言|绪\s*论|1\.?\s*引言)',
                'related_work': r'^(Related\s+Work|RELATED\s+WORK|Literature\s+Review|2\.?\s*Related\s+Work|相关工作)',
                'methods': r'^(Methods?|METHODS?|Methodology|METHODOLOGY|3\.?\s*Method|方\s*法|实验方法)',
                'results': r'^(Results?|RESULTS?|Experiments?|EXPERIMENTS?|4\.?\s*Results?|实\s*验|结\s*果)',
                'discussion': r'^(Discussion|DISCUSSION|Analysis|ANALYSIS|5\.?\s*Discussion|讨\s*论|分\s*析)',
                'conclusion': r'^(Conclusions?|CONCLUSIONS?|6\.?\s*Conclusion|结\s*论)',
                'references': r'^(References|REFERENCES|Bibliography|参考文献)',
            }

    def _process_docs(self, origin_docs: List[Document], query: Query = None) -> List[Document]:
        """Fragment academic papers into argument-based documents.

        Args:
            origin_docs: List of academic paper documents to fragment.
            query: Optional query object (not used in this processor).

        Returns:
            List of argument documents with metadata.
        """
        if not origin_docs:
            return []

        logger.info(f"Starting academic paper fragmentation of {len(origin_docs)} documents")

        all_argument_docs = []

        for doc in origin_docs:
            try:
                argument_docs = self._fragment_document(doc)
                all_argument_docs.extend(argument_docs)
                logger.info(f"Fragmented paper {doc.id} into {len(argument_docs)} arguments")
            except Exception as e:
                logger.error(f"Failed to fragment document {doc.id}: {e}")
                if not self.skip_on_error:
                    raise
                # Pass through original document if skip_on_error is True
                all_argument_docs.append(doc)

        logger.info(f"Total argument fragments created: {len(all_argument_docs)}")
        return all_argument_docs

    def _fragment_document(self, doc: Document) -> List[Document]:
        """Fragment a single academic paper into arguments.

        Args:
            doc: Academic paper document to fragment.

        Returns:
            List of argument documents.
        """
        text = doc.text

        # Step 1: Detect sections if enabled
        sections = []
        if self.detect_sections:
            sections = self._identify_sections(text)
            logger.debug(f"Detected {len(sections)} sections")

        # If no sections detected, treat as single section
        if not sections:
            sections = [PaperSection('full_text', text, 0, len(text))]

        # Step 2: Extract arguments from each section
        all_arguments = []
        for section in sections:
            arguments = self._extract_arguments(section)
            all_arguments.extend(arguments)

        # Step 3: Extract citations if enabled
        citations = []
        if self.extract_citations:
            citations = self._parse_citations(text)
            logger.debug(f"Extracted {len(citations)} citations")

        # Step 4: Link evidence to claims if enabled
        if self.link_evidence and citations:
            self._link_evidence_to_claims(all_arguments, citations)

        # Step 5: Create documents for each argument
        argument_docs = self._create_argument_documents(doc, all_arguments)

        return argument_docs

    def _identify_sections(self, text: str) -> List[PaperSection]:
        """Identify sections in the academic paper.

        Args:
            text: Full paper text.

        Returns:
            List of PaperSection objects.
        """
        sections = []
        lines = text.split('\n')
        current_pos = 0

        section_boundaries = []  # List of (line_idx, section_name, start_pos)

        # Find section headers
        for line_idx, line in enumerate(lines):
            line_stripped = line.strip()

            if not line_stripped:
                current_pos += len(line) + 1
                continue

            # Check against section patterns
            matched = False
            for section_name, pattern in self.section_patterns.items():
                if re.match(pattern, line_stripped, re.IGNORECASE):
                    section_boundaries.append((line_idx, section_name, current_pos))
                    logger.debug(f"Found section '{section_name}' at line {line_idx}")
                    matched = True
                    break

            # Additional detection for numbered sections (e.g., "1. ", "1.1 ", "1. Introduction")
            if not matched:
                # Match patterns like "1. Introduction", "1.1 Background", "2. Methods"
                numbered_match = re.match(r'^(\d+(\.\d+)*\.?)\s+([A-Za-z\u4e00-\u9fa5][A-Za-z\u4e00-\u9fa5\s]+)$', line_stripped)
                if numbered_match:
                    section_number = numbered_match.group(1)
                    section_title = numbered_match.group(3).strip().lower()
                    # Try to map to known sections
                    section_name = self._map
```

### Core Architecture Module: `agentuniverse/agent/action/knowledge/doc_processor/character_text_splitter.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/8/5 14:37
# @Author  : fanen.lhy
# @Email   : fanen.lhy@antgroup.com
# @FileName: character_text_splitter.py
from typing import List, Optional
from langchain.text_splitter import CharacterTextSplitter as Splitter

from agentuniverse.agent.action.knowledge.doc_processor.doc_processor import \
    DocProcessor
from agentuniverse.agent.action.knowledge.store.document import Document
from agentuniverse.agent.action.knowledge.store.query import Query
from agentuniverse.base.config.component_configer.component_configer import \
    ComponentConfiger


class CharacterTextSplitter(DocProcessor):
    """Character-based text splitter for document processing.
    
    This class splits documents into smaller chunks based on character separators,
    with configurable chunk size and overlap parameters.
    
    Attributes:
        chunk_size: The size of each text chunk.
        chunk_overlap: The number of characters to overlap between chunks.
        separator: The character sequence used to split text.
        splitter: The underlying LangChain text splitter instance.
    """
    chunk_size: int = 200
    chunk_overlap: int = 20
    separator: str = "/n/n"
    __splitter: Optional[Splitter] = None


    @property
    def splitter(self) -> Splitter:
        if not self.__splitter:
            self.__splitter = Splitter(separator=self.separator,
                                 chunk_size=self.chunk_size,
                                 chunk_overlap=self.chunk_overlap)
        return self.__splitter


    def _process_docs(self, origin_docs: List[Document], query: Query = None) -> \
            List[Document]:
        """Process documents by splitting them into smaller chunks.
        
        Args:
            origin_docs: List of original documents to be processed.
            query: Optional query object that may influence the processing.
            
        Returns:
            List[Document]: List of processed document chunks.
        """
        lc_doc_list = self.splitter.split_documents(Document.as_langchain_list(
            origin_docs
        ))
        return Document.from_langchain_list(lc_doc_list)

    def _initialize_by_component_configer(self,
                                         doc_processor_configer: ComponentConfiger) -> 'DocProcessor':
        """Initialize the splitter using configuration from a ComponentConfiger.
        
        Args:
            doc_processor_configer: Configuration object containing splitter parameters.
            
        Returns:
            DocProcessor: The initialized document processor instance.
        """
        super()._initialize_by_component_configer(doc_processor_configer)
        if hasattr(doc_processor_configer, "chunk_size"):
            self.chunk_size = doc_processor_configer.chunk_size
        if hasattr(doc_processor_configer, "chunk_overlap"):
            self.chunk_overlap = doc_processor_configer.chunk_overlap
        if hasattr(doc_processor_configer, "separator"):
            self.separator = doc_processor_configer.separator
        return self

```

### Core Architecture Module: `agentuniverse/agent/action/knowledge/doc_processor/code_ast_processor.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2025/03/04 14:09
# @Author  : hiro
# @Email   : hiromesh@qq.com
# @FileName: code_ast_processor.py
import json
from typing import List, Dict, Any, Optional, cast

from agentuniverse.agent.action.knowledge.doc_processor.types.ast_types import AstNode, AstNodePoint, CodeBoundary
from agentuniverse.agent.action.knowledge.doc_processor.types.code_types import CodeFeatures, CodeRepresentation, ChunkRepresentation
from agentuniverse.agent.action.knowledge.doc_processor.types.metrics_types import CodeMetrics

from agentuniverse.agent.action.knowledge.doc_processor.doc_processor import DocProcessor
from agentuniverse.agent.action.knowledge.store.document import Document
from agentuniverse.agent.action.knowledge.store.query import Query
from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger


class CodeAstProcessor(DocProcessor):

    max_depth: int = 8
    language_dir: str = None
    chunk_size: int = 1000
    chunk_overlap: int = 200
    max_node_len: int = 100
    _parser: Optional[Any] = None
    _languages: Dict[str, Any] = {}

    def _process_docs(self, origin_docs: List[Document], query: Query = None) -> List[Document]:
        result_docs = []
        for doc in origin_docs:
            code = doc.text
            language = doc.metadata.get('language', 'unknown') if doc.metadata else 'unknown'
            metadata = doc.metadata.copy() if doc.metadata else {}
            metadata['document_type'] = 'code_ast'
            result_docs.extend(self._process_with_tree_sitter(code, language, metadata))
        return result_docs

    def _process_with_tree_sitter(self, code: str, language: str,
                                  metadata: Dict[str, Any]) -> List[Document]:
        def _ensure_language() -> None:
            if language not in self._languages:
                try:
                    from tree_sitter import Language
                    from importlib import import_module
                    module_name = f'tree_sitter_{language}'
                    lang_module = import_module(module_name)
                    self._languages[language] = Language(lang_module.language())
                except ImportError:
                    raise ImportError(
                        f"Could not import {module_name}. Install with: pip install {module_name}")
        _ensure_language()

        result_docs: List[Document] = []
        self._parser.language = self._languages[language]
        tree = self._parser.parse(bytes(code, "utf8"))
        ast_json: AstNode = self._convert_tree_to_json(tree.root_node, code)
        features: CodeFeatures = self._extract_features(tree.root_node, code, language)
        repr: CodeRepresentation = {
            "ast": ast_json,
            "features": features,
            "language": language,
            "code_length": len(code)
        }
        metadata['processing_method'] = 'tree_sitter'
        ast_doc: Document = Document(
            text=json.dumps(repr),
            metadata=metadata
        )
        result_docs.append(ast_doc)
        if len(code) > self.chunk_size:
            chunk_docs = self._generate_code_chunks(
                code, tree.root_node, language, metadata)
            result_docs.extend(chunk_docs)
        return result_docs

    def _convert_tree_to_json(self, node, code: str, depth: int = 0) -> AstNode:
        if depth > self.max_depth:
            return cast(AstNode, {"type": "max_depth_reached"})
        if not node:
            return cast(AstNode, {})

        start_byte, end_byte = node.start_byte, node.end_byte
        text = code[start_byte:end_byte] if end_byte <= len(code) else ""

        start_point: AstNodePoint = {"row": node.start_point[0], "column": node.start_point[1]}
        end_point: AstNodePoint = {"row": node.end_point[0], "column": node.end_point[1]}

        result: AstNode = {
            "type": node.type,
            "start_point": start_point,
            "end_point": end_point,
            "start_byte": start_byte,
            "end_byte": end_byte
        }

        if len(text) < self.max_node_len or node.child_count == 0:
            result["text"] = text

        if node.child_count > 0:
            children = []
            for child in node.children:
                child_json = self._convert_tree_to_json(child, code, depth + 1)
                if child_json:
                    children.append(child_json)
            result["children"] = children

        return result

    def _extract_features(self, node: Any, code: str, language: str) -> CodeFeatures:

        features: CodeFeatures = {
            "node_counts": self._count_node_types(node),
            "code_metrics": self._calculate_code_metrics(code, language),
            "identifier_count": 0,
            "function_count": 0,
            "class_count": 0,
            "statement_count": 0
        }

        cursor = node.walk()

        def _visit():
            nonlocal features
            current_node = cursor.node

            if current_node.type == "identifier":
                features["identifier_count"] += 1
            elif current_node.type in ("function_definition", "method_definition", "function_declaration"):
                features["function_count"] += 1
            elif current_node.type in ("class_definition", "class_declaration"):
                features["class_count"] += 1
            elif "statement" in current_node.type:
                features["statement_count"] += 1

            if cursor.goto_first_child():
                _visit()
                cursor.goto_parent()
            if cursor.goto_next_sibling():
                _visit()

        _visit()
        return features

    def _count_node_types(self, root_node) -> Dict[str, int]:
        counts = {}

        def _traverse(node):
            if node.type not in counts:
                counts[node.type] = 0
            counts[node.type] += 1

            for child in node.children:
                _traverse(child)

        _traverse(root_node)
        return counts

    def _calculate_code_metrics(self, code: str, language: str) -> CodeMetrics:

        lines = code.splitlines()
        code_lines = [line.strip() for line in lines if line.strip(
        ) and not line.strip().startswith(('#', '//', '/*', '*', '*/'))]

        metrics: CodeMetrics = {
            "line_count": len(lines),
            "code_line_count": len(code_lines),
            "avg_line_length": sum(len(line) for line in code_lines) / max(len(code_lines), 1),
            "max_line_length": max([len(line) for line in code_lines]) if code_lines else 0,
            "character_count": len(code)
        }
        return metrics

    def _generate_code_chunks(
            self,
            code: str,
            root_node,
            language: str,
            metadata: Dict[str, Any]) -> List[Document]:
        chunks = []
        lines = code.splitlines()
        boundaries = []

        def _collect_declarations(node, path=""):

            if node.type in ("function_definition", "method_definition", "class_definition",
                             "function_declaration", "method_declaration", "class_declaration"):
                start_line = node.start_point[0]
                end_line = node.end_point[0]

                if end_line - start_line >= 3:
                    node_type = "function" if "function" in node.type else "class"
                    name = None

                    for child in node.children:
                        if child.type == "identifier":
                            name = code[child.start_byte:child.end_byte]
                            break

                    boundary: CodeBoundary = {
                        "start": start_line,
                        "end": end_line,
                        "type": node_type,
                        "name": name,
                        "node": node
                    }
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #583** (2026-07-09): **🐞 [Bug] 在service中请求入参 非str类型，会报错，希望支持list和dict**
  *Symptoms*: ### Version  agentUniverse>=0.0.19  ### System  linux  ### Actions  请求参数 如果是数组则报错 {   "service_id": "red_blue_game_orchestrator_service",   "params": {     "input": []    -- 只支持str类型， 不支持 list dict    } }  ### Problem  错误信息：  dji-docchecker-agent  | 2026-06-16 16:26:57.509 | ERROR    | ["trace_id": "ced7e00772517ba922a89bb5b4cbd1ca", "span_id": "209b25305b665f76"] | agentuniverse.agent_serve.web.flask_server:handle_exception:224 | Traceback (most recent call last): dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/flask/app.py", line 1484, in full_dispatch_request dji-docchecker-agent  |     rv = self.dispatch_request() dji-docchecker-agent  |          ^^^^^^^^^^^^^^^^^^^^^^^ dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/flask/app.py", line 1469, in dispatch_request dji-docchecker-agent  |     return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args) dji-docchecker-agent  |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/agentuniverse/agent_serve/web/web_util.py", line 68, in wrapper dji-docchecker-agent  |     return func(*args, **kwargs) dji-docchecker-agent  |            ^^^^^^^^^^^^^^^^^^^^^ dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/agentuniverse/agent_serve/web/flask_server.py", line 125, in service_run dji-docchecker-agent  |     request_task = RequestTask(ServiceInst

- **Issue #540** (2026-07-09): **🐞 [Bug] <同一个agent中，使用多个prompt模板，第一次之后组装prompt会报错>**
  *Symptoms*: ### Version  version:0.0.18  ### System  mac  ### Actions  _No response_  ### Problem   <img width="2262" height="938" alt="Image" src="https://github.com/user-attachments/assets/ac7fe564-b481-4ed3-8303-40cc8f71ec90" />  这里agent_input.pop('audio_url')使用了pop，会移出agent_input中这个key，并且没有带默认值，第二次调用则会抛出异常  ### Expected  pop带上默认值可以修复。 但是为什么用pop，理论上不应该删掉agent_input中的key吧。  ### reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > > ### Version > version:0.0.18 >  > ### System > mac >  > ### Actions > _No response_ >  > ### Problem > <img alt="Image" width="2000" height="938" src="https://private-user-images.githubusercontent.com/13903189/525222753-ac7fe564-b481-4ed3-8303-40cc8f71ec90.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjYzNzU1MjQsIm5iZiI6MTc2NjM3NTIyNCwicGF0aCI6Ii8xMzkwMzE4OS81MjUyMjI3NTMtYWM3ZmU1NjQtYjQ4MS00ZWQzLTgzMDMtNDBjYzhmNzFlYzkwLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTEyMjIlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUxMjIyVDAzNDcwNFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWM2Y2FiMjc2NjBjZWU5ODljZTdlYmJmOTUyMWQ4M2E4ZTViMTY0NGIwMzI4ZmI4Y2U0OGY4Y2Y4YzA1MzhjNGMmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.Th10qvgPeMbJbNV1-2W0HQmN9Z1YAxyVpaPRl1NSYdw"> > 这里agent_input.pop('audio_url')使用了pop，会移出agent_input中这个key，并且没有带默

- **Issue #483** (2025-10-29): **🐞 [Bug] No module named 'agentuniverse.agent.action.knowledge.store.faiss_store'**
  *Symptoms*: ### Version  agentUniverse==0.0.18  ### System  MacBook Pro M3  ### Actions  按照文档 [docs/guidebook/zh/开始使用/2.运行第一个教程案例.md](https://github.com/agentuniverse-ai/agentUniverse/blob/master/docs/guidebook/zh/%E5%BC%80%E5%A7%8B%E4%BD%BF%E7%94%A8/2.%E8%BF%90%E8%A1%8C%E7%AC%AC%E4%B8%80%E4%B8%AA%E6%95%99%E7%A8%8B%E6%A1%88%E4%BE%8B.md) 运行第一个案例  ### Problem  ```python 2025-10-28 21:17:57.633 | ERROR    | ["trace_id": "0a9d32773b61720acec7a129792bc0d3", "span_id": "0e2af6c72e027793"] | agentuniverse.base.component.component_configer_util:get_component_object_clz_by_component_configer:142 | Please check your config file, load configer module error! module name: agentuniverse.agent.action.knowledge.store.faiss_store,error info: No module named 'agentuniverse.agent.action.knowledge.store.faiss_store'      AgentUniverse().start(config_path='/Users/llnancy/workspace/open-projects/agentUniverse/examples/sample_standard_app/config/config.toml', core_mode=True)   File "/Users/llnancy/.pyenv/versions/py3.11/lib/python3.11/site-packages/agentuniverse/base/agentuniverse.py", line 136, in start     self.__scan_and_register(self.__config_container.app_configer)   File "/Users/llnancy/.pyenv/versions/py3.11/lib/python3.11/site-packages/agentuniverse/base/agentuniverse.py", line 221, in __scan_and_register     self.__register(component_enum, component_configer_list)   File "/Users/llnancy/.pyenv/versions/py3.11/lib/python3.11/site-packages/agentuniverse/base/agentuniverse.py", line 323, in __register   
  **Post-Mortem & Fix Analysis**:
  > 这个 commit 9e780ad 修复了该问题，我 git clone 仓库时还没有这个 commit.

- **Issue #430** (2025-08-07): ** No module named 'sample_standard_app'**
  *Symptoms*: ### Version  verion 0.0.18  ### System  win10  problems:  when I run the demo  in [https://github.com/agentuniverse-ai/agentUniverse/blob/master/docs/guidebook/zh/%E5%BC%80%E5%A7%8B%E4%BD%BF%E7%94%A8/2.%E8%BF%90%E8%A1%8C%E7%AC%AC%E4%B8%80%E4%B8%AA%E6%95%99%E7%A8%8B%E6%A1%88%E4%BE%8B.md](url)     I met a problems:  `File "<frozen importlib._bootstrap>", line 1050, in _gcd_import   File "<frozen importlib._bootstrap>", line 1027, in _find_and_load   File "<frozen importlib._bootstrap>", line 992, in _find_and_load_unlocked   File "<frozen importlib._bootstrap>", line 241, in _call_with_frames_removed   File "<frozen importlib._bootstrap>", line 1050, in _gcd_import   File "<frozen importlib._bootstrap>", line 1027, in _find_and_load   File "<frozen importlib._bootstrap>", line 992, in _find_and_load_unlocked   File "<frozen importlib._bootstrap>", line 241, in _call_with_frames_removed   File "<frozen importlib._bootstrap>", line 1050, in _gcd_import   File "<frozen importlib._bootstrap>", line 1027, in _find_and_load   File "<frozen importlib._bootstrap>", line 1004, in _find_and_load_unlocked ModuleNotFoundError: No module named 'sample_standard_app'`       thx 
  **Post-Mortem & Fix Analysis**:
  > <img width="1295" height="502" alt="Image" src="https://github.com/user-attachments/assets/4013db66-f202-4b2f-921d-ebfe89cc4d5a" />   this is the error when I run the script: run_demo_agent.py
  > 问题定位到config.toml中的 [PACKAGE_PATH_INFO] ROOT_PACKAGE = 'sample_standard_app'   在windows下用的conda虚拟环境，这里有什么问题么
  > 一般的类vscode的IDE需要进行以下的一些设置 `{   "python.pythonPath": "/Users/jerry.zzw/miniforge3/envs/py310_v009_test/bin/python3.10",   "python.terminal.executeInFileDir": true,   "terminal.integrated.env.osx": {       "PYTHONPATH": "/Users/jerry.zzw/Documents/workspace/github/agentUniverse/",     },     "terminal.integrated.env.linux": {       "PYTHONPATH": "/Users/jerry.zzw/Documents/workspace/github/agentUniverse/",     },     "terminal.integrated.env.windows": {       "PYTHONPATH": "/Users/jerry.zzw/Documents/workspace/github/agentUniverse/",     },   "files.exclude": {         "**/__pycache__": true     } }`      经过这些设置可以正常运行

- **Issue #394** (2025-05-14): **🐞 [Bug] Mac系统下，执行pip install agentuniverse出现问题**
  *Symptoms*: ### Version  Python 3.13  ### System  Mac  ### Actions  pip install agentuniverse   ### Problem  出现了如图问题  ![Image](https://github.com/user-attachments/assets/fde5d746-45f6-4f40-8530-be41b1e51fb0)  ### Expected  _No response_  ### reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > 已经解决要用特定的Python版本，我的版本太高了

- **Issue #389** (2025-04-30): **🐞 [Bug] 启用 gunicorn 后请求2～3次就出现报错**
  *Symptoms*: ### Version  0.0.15  ### System  Mac  ### Actions  调用 service_run 若干次：   ``` curl --location --request POST 'http://127.0.0.1:8888/service_run' \ --header 'Content-Type: application/json' \ --data-raw '{     "service_id": "todo_create_agent",     "params": {         "input": "明天你好",         "background": "今天是2025年04月29日",         "session_id":"s1"     } }' ```  ### Problem  前几次（2～5次）都正常返回，后面几次就会报错，而且报错概率很高：   ``` 2025-04-29 18:16:10.489 | ERROR    | ["trace_id": "15666e6cb2b748faa0df5477c17c99ef", "span_id": "0"] | agentuniverse.agent_serve.web.flask_server:handle_exception:214 | Traceback (most recent call last):   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/flask/app.py", line 1484, in full_dispatch_request     rv = self.dispatch_request()   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/flask/app.py", line 1469, in dispatch_request     return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args)   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/agentuniverse/agent_serve/web/web_util.py", line 68, in wrapper     return func(*args, **kwargs)   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/agentuniverse/agent_serve/web/flask_server.py", line 121, in service_run     result = future.result(timeout=FlaskServerManager().sync_service_timeout)   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/concurrent/futures/_ba
  **Post-Mortem & Fix Analysis**:
  > 该问题已在0.0.16版本中修复。
  > > 该问题已在0.0.16版本中修复。  麻烦请问升级到 0.0.16 怎么做？pyproject.toml 要改些什么东西？

- **Issue #369** (2025-06-16): **🐞 [Bug]  can you loose your version requirement for dependency modules**
  *Symptoms*: ### Version  0.0.15  ### System  windows11  ### Actions  integration agentuniverse with our running project  ### Problem  the current agentuniverse 0.0.15 requires some python module with specific version, such as tiktoken = '0.5.2' and pydantic = "~2.6.4", which conflict with our current running project. some new features we required for these modules, such as tiktoken new versions support o200k_base encoding model.  So it is quite hard to integrate and develop cross teams. After manually installed the new versions tiktoken==0.9.0 and pydantic==2.7.4, agentuniverse works fine though, so can you guys help to loose those the dependency requirement for the convince of integration with existing projects, thanks    ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts. agentuniverse 0.0.15 requires tiktoken==0.5.2, but you have tiktoken 0.9.0 which is incompatible.  ### Expected  _No response_  ### reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > > ### Version > 0.0.15 >  > ### System > windows11 >  > ### Actions > integration agentuniverse with our running project >  > ### Problem > the current agentuniverse 0.0.15 requires some python module with specific version, such as tiktoken = '0.5.2' and pydantic = "~2.6.4", which conflict with our current running project. some new features we required for these modules, such as tiktoken new versions support o200k_base encoding model. So it is quite hard to integrate and develop cross teams. After manually installed the new versions tiktoken==0.9.0 and pydantic==2.7.4, agentuniverse works fine though, so can you guys help to loose those the dependency requirement for the convince of integration with existing projects, thanks >  > ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts. agentuniverse 0.0.15 requires tiktoken==0.5.2, but you have tiktoken 0.9.0 which is i
  > > ### Version > 0.0.15 >  > ### System > windows11 >  > ### Actions > integration agentuniverse with our running project >  > ### Problem > the current agentuniverse 0.0.15 requires some python module with specific version, such as tiktoken = '0.5.2' and pydantic = "~2.6.4", which conflict with our current running project. some new features we required for these modules, such as tiktoken new versions support o200k_base encoding model. So it is quite hard to integrate and develop cross teams. After manually installed the new versions tiktoken==0.9.0 and pydantic==2.7.4, agentuniverse works fine though, so can you guys help to loose those the dependency requirement for the convince of integration with existing projects, thanks >  > ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts. agentuniverse 0.0.15 requires tiktoken==0.5.2, but you have tiktoken 0.9.0 which is i

- **Issue #337** (2025-03-03): **fix: regression test bug fixes before new release**
  *Symptoms*: **When submitting a PR, please confirm the following points and put [x] in the boxes one by one.** | **在提出pr时，请确认了以下几点，并逐一使用[x]符号确认勾选。**   **Checklist | 检查项** - [x] I have read and understood the [contributor guidelines](https://github.com/antgroup/agentUniverse/blob/master/CONTRIBUTING.md). | 我已阅读并理解[贡献者指南](https://github.com/antgroup/agentUniverse/blob/master/CONTRIBUTING_zh.md) 。 - [x] I have checked for any duplicate features related to this request and communicated with the project maintainers. | 我已检查没有与此请求重复的功能并与项目维护者进行了沟通。 - [x] I accept the suggestion of the maintainers to make changes to or close this PR. | 我接受此PR配合维护人员的建议进行修改或关闭。 - [ ] I have submitted the test files and can provide screenshots of the test results (required for feature or bug fixes) | 我已经提交了测试文件并可提供测试结果截图(功能修改、BUG修复类PR必须提供，其他按需) - [ ] I have added or modified the documentation related to this PR | 我已经添加或修改了本次pr对应的文档说明(非必要，根据实际PR内容按需添加) - [ ] I have added examples and notes if needed | 我已经添加了使用案例代码与文档说明(非必要，根据实际PR内容按需添加)  **Please fill in the specific details of this PR:** | **请详细填写本次PR的内容:**  - - -  **Please provide the path of test files and submit screenshots or files of the test results(fill in as needed):** | **请填写测试文件路径并提供测试结果截图或文件(按需填写):**  -  **Please list the names of the docs that were added or modified in this PR (fill in as needed):** | **请列出本次PR新增或修改的文档名称(按需填写):**  -

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

### Incident Patch 1: `254ecd28` (2026-07-28)
**Commit Message**: Merge pull request #834 from messere1/codex/fix-output-object-isolation

fix(agent): isolate output object mappings

**File**: `agentuniverse/agent/output_object.py` (modified, +3/-3)
```diff
@@ -9,12 +9,12 @@
 
 class OutputObject(object):
     def __init__(self, params: dict):
-        self.__params = params
-        for k, v in params.items():
+        self.__params = params.copy()
+        for k, v in self.__params.items():
             self.__dict__[k] = v
 
     def to_dict(self):
-        return self.__params
+        return self.__params.copy()
 
     def to_json_str(self):
         return json.dumps(self.__params, ensure_ascii=False)
```

**File**: `tests/test_agentuniverse/unit/agent/test_output_object.py` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+from agentuniverse.agent.output_object import OutputObject
+
+
+def test_output_object_copies_constructor_params():
+    params = {"output": "original"}
+    output_object = OutputObject(params)
+
+    params["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
+
+
+def test_to_dict_returns_an_independent_mapping():
+    output_object = OutputObject({"output": "original"})
+
+    exported = output_object.to_dict()
+    exported["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
```

---

### Incident Patch 2: `ded1e21c` (2026-07-28)
**Commit Message**: Merge pull request #833 from messere1/codex/fix-log-context-isolation

fix(context): isolate log metadata across contexts

**File**: `agentuniverse/base/context/framework_context_manager.py` (modified, +4/-8)
```diff
@@ -119,11 +119,7 @@ def clear_all_contexts(self):
         self.__context_dict.set({})
 
     def set_log_context(self, context_key: str, context_value: Any):
-        log_context = self.get_context("LOG_CONTEXT")
-        if not log_context:
-            log_context = {
-                context_key: context_value
-            }
-            self.set_context("LOG_CONTEXT", log_context)
-        else:
-            log_context[context_key] = context_value
+        current_context = self.get_context("LOG_CONTEXT")
+        log_context = current_context.copy() if isinstance(current_context, dict) else {}
+        log_context[context_key] = context_value
+        self.set_context("LOG_CONTEXT", log_context)
```

**File**: `tests/test_agentuniverse/unit/base/context/test_framework_context.py` (modified, +24/-2)
```diff
@@ -7,13 +7,14 @@
 
 import asyncio
 import queue
-import time
 import threading
+import time
+from contextvars import copy_context
 
 import pytest
 
-from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 from agentuniverse.base.context.framework_context import FrameworkContext
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 
 context_manager: FrameworkContextManager = FrameworkContextManager()
 
@@ -76,5 +77,26 @@ def test_set_all_contexts_returns_tokens_for_restoration():
     context_manager.clear_all_contexts()
 
 
+def test_log_context_isolated_across_copied_contexts():
+    context_manager.clear_all_contexts()
+    context_manager.set_log_context("request_id", "parent")
+    child_context = copy_context()
+
+    def update_child_context():
+        context_manager.set_log_context("worker_id", "child")
+        return context_manager.get_context("LOG_CONTEXT")
+
+    child_log_context = child_context.run(update_child_context)
+
+    assert child_log_context == {
+        "request_id": "parent",
+        "worker_id": "child",
+    }
+    assert context_manager.get_context("LOG_CONTEXT") == {
+        "request_id": "parent",
+    }
+    context_manager.clear_all_contexts()
+
+
 if __name__ == "__main__":
     pytest.main([__file__, "-s"])
```

---

### Incident Patch 3: `dc4c8a09` (2026-07-28)
**Commit Message**: Merge pull request #832 from yaodong-shen/fix-secure-archive-member-lookup

fix(tool): preserve archive member lookup names

**File**: `agentuniverse/agent/action/tool/common_tool/secure_archive_tool.py` (modified, +13/-3)
```diff
@@ -128,6 +128,7 @@ def _safe_member_name(raw: str) -> str:
         return path.as_posix().rstrip("/")
 
     def _entries(self, path: str) -> list[dict[str, Any]]:
+        """Return safe public names alongside private archive lookup names."""
         entries: list[dict[str, Any]] = []
         if self._kind(path) == "zip":
             try:
@@ -141,6 +142,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.filename),
+                                "_source_name": item.filename,
                                 "size": item.file_size,
                                 "compressed_size": item.compress_size,
                                 "is_dir": item.is_dir(),
@@ -157,6 +159,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.name),
+                                "_source_name": item.name,
                                 "size": item.size,
                                 "compressed_size": None,
                                 "is_dir": item.isdir(),
@@ -269,7 +272,14 @@ def _create(self, path: str, values: Any, overwrite: Any, compression: Any) -> d
 
     @staticmethod
     def _list(path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
-        return {"status": "success", "mode": "list", "file_path": path, "entries": entries, "entry_count": len(entries)}
+        public_entries = [{key: item[key] for key in ("name", "size", "compressed_size", "is_dir")} for item in entries]
+        return {
+            "status": "success",
+            "mode": "list",
+            "file_path": path,
+            "entries": public_entries,
+            "entry_count": len(entries),
+        }
 
     def _info(self, path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
         return {
@@ -319,7 +329,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    with archive.open(item["name"]) as source:
+                    with archive.open(item["_source_name"]) as source:
                         self._atomic_copy(source, destination, item["size"])
                     extracted.append(destination)
         else:
@@ -328,7 +338,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    source = archive.extractfile(item["name"])
+                    source = archive.extractfile(item["_source_name"])
                     if source is None:
                         raise ValueError(f"unable to read archive member: {item['name']}")
                     with source:
```

**File**: `tests/test_agentuniverse/unit/agent/action/tool/test_secure_archive_tool.py` (modified, +31/-0)
```diff
@@ -1,5 +1,7 @@
+import io
 import os
 import stat
+import tarfile
 import tempfile
 import unittest
 import zipfile
@@ -60,6 +62,35 @@ def test_selective_extract(self):
         self.assertEqual(len(result["output_paths"]), 1)
         self.assertFalse(os.path.exists(os.path.join(self.directory.name, "out/a.txt")))
 
+    def test_extracts_zip_member_with_backslashes(self):
+        with zipfile.ZipFile(os.path.join(self.directory.name, "windows.zip"), "w") as archive:
+            archive.writestr("nested\\file.txt", b"payload")
+
+        listed = self.tool.execute(mode="list", file_path="windows.zip")
+        self.assertEqual(listed["status"], "success")
+        self.assertEqual(listed["entries"][0]["name"], "nested/file.txt")
+        self.assertEqual(
+            set(listed["entries"][0]),
+            {"name", "size", "compressed_size", "is_dir"},
+        )
+
+        result = self.tool.execute(mode="extract", file_path="windows.zip", output_dir="windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), b"payload")
+
+    def test_extracts_tar_member_with_backslashes(self):
+        payload = b"payload"
+        with tarfile.open(os.path.join(self.directory.name, "windows.tar"), "w") as archive:
+            info = tarfile.TarInfo("nested\\file.txt")
+            info.size = len(payload)
+            archive.addfile(info, io.BytesIO(payload))
+
+        result = self.tool.execute(mode="extract", file_path="windows.tar", output_dir="tar-windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "tar-windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), payload)
+
     def test_create_refuses_overwrite(self):
         self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["a.txt"])
         result = self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["nested/b.txt"])
```

---

### Incident Patch 4: `15ef9238` (2026-07-28)
**Commit Message**: Merge pull request #830 from messere1/fix/store-init-bugs

fix(store): fix init bugs in MilvusStore, ChromaStore, and FAISSStore

**File**: `agentuniverse/agent/action/knowledge/store/chroma_store.py` (modified, +9/-3)
```diff
@@ -41,20 +41,26 @@ class ChromaStore(Store):
 
     def _new_client(self) -> Any:
         """Initialize the chroma client."""
-        if self.persist_path.startswith('http') or \
-                self.persist_path.startswith('https'):
+        if self.persist_path and (
+            self.persist_path.startswith('http') or
+            self.persist_path.startswith('https')
+        ):
             # Remote database URL
             parsed_url = urlparse(self.persist_path)
             settings = Settings(
                 chroma_api_impl="chromadb.api.fastapi.FastAPI",
                 chroma_server_host=parsed_url.hostname,
                 chroma_server_http_port=str(parsed_url.port)
             )
-        else:
+        elif self.persist_path:
+            # Local persistent database
             settings = Settings(
                 is_persistent=True,
                 persist_directory=self.persist_path
             )
+        else:
+            # In-memory only (no persistence path configured)
+            settings = Settings()
 
         client = chromadb.Client(settings)
         if self.collection is None:
```

**File**: `agentuniverse/agent/action/knowledge/store/faiss_store.py` (modified, +18/-9)
```diff
@@ -17,6 +17,11 @@
 from agentuniverse.agent.action.knowledge.store.store import Store
 from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger
 
+# Module-level placeholders for optional dependencies; populated lazily
+# by _new_client so that importing this module never requires faiss/numpy.
+faiss = None
+np = None
+
 # Default configuration for FAISS index types
 DEFAULT_INDEX_CONFIG = {
     "index_type": "IndexFlatL2",
@@ -72,15 +77,19 @@ def __init__(self, **kwargs):
 
     def _new_client(self) -> Any:
         """Initialize the FAISS index and load existing data if available."""
-        try:
-            import faiss
-            import numpy as np
-        except ImportError as e:
-            FAISS_NOT_INSTALLED_MSG = (
-                "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
-                "for CPU version or 'pip install faiss-gpu' for GPU version."
-            )
-            raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+        global faiss, np
+        if faiss is None or np is None:
+            try:
+                import faiss as _faiss
+                import numpy as _np
+            except ImportError as e:
+                FAISS_NOT_INSTALLED_MSG = (
+                    "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
+                    "for CPU version or 'pip install faiss-gpu' for GPU version."
+                )
+                raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+            faiss = _faiss
+            np = _np
         self._load_index_and_metadata()
         return self.faiss_index
 
```

**File**: `agentuniverse/agent/action/knowledge/store/milvus_store.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def _initialize_by_component_configer(self,
         if hasattr(milvus_store_configer, "similarity_top_k"):
             self.similarity_top_k = milvus_store_configer.similarity_top_k
         if hasattr(milvus_store_configer, "query_embedding"):
-            self.similarity_top_k = milvus_store_configer.query_embedding
+            self.query_embedding = milvus_store_configer.query_embedding
         return self
 
     def _create_or_load_collection(self,
```

**File**: `tests/test_agentuniverse/unit/agent/action/knowledge/store/test_store_init_fixes.py` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# !/usr/bin/env python3
+# -*- coding:utf-8 -*-
+
+"""Unit tests for store initialization bug fixes.
+
+Covers three critical bugs:
+1. MilvusStore: query_embedding config was assigned to similarity_top_k (typo)
+2. ChromaStore: _new_client crashed with AttributeError when persist_path=None
+3. FAISSStore: faiss/np module-level names were not set by lazy import in _new_client
+"""
+
+import unittest
+from unittest.mock import MagicMock, patch
+
+# ------------------------------------------------------------------ #
+# Detect optional dependencies
+# ------------------------------------------------------------------ #
+try:
+    import chromadb  # noqa: F401
+    CHROMA_AVAILABLE = True
+except ImportError:
+    CHROMA_AVAILABLE = False
+
+try:
+    import pymilvus  # noqa: F401
+    PYMILVUS_AVAILABLE = True
+except ImportError:
+    PYMILVUS_AVAILABLE = False
+
+try:
+    import faiss  # noqa: F401
+    import numpy as np  # noqa: F401
+    FAISS_AVAILABLE = True
+except ImportError:
+    FAISS_AVAILABLE = False
+
+
+# ------------------------------------------------------------------ #
+# 1. MilvusStore — query_embedding config assignment typo
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(PYMILVUS_AVAILABLE, "pymilvus not available")
+class TestMilvusStoreQueryEmbeddingConfig(unittest.TestCase):
+    """Verify that query_embedding config is correctly assigned."""
+
+    def test_query_embedding_config_assigned_correctly(self):
+        """query_embedding=True should set self.query_embedding, not similarity_top_k."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        configer.query_embedding = True
+        configer.similarity_top_k = 42
+
+        store._initialize_by_component_configer(configer)
+
+        # query_embedding should be True (was previously ignored due to typo)
+        self.assertTrue(store.query_embedding)
+        # similarity_top_k should remain 42, not overwritten by the boolean True
+        self.assertEqual(store.similarity_top_k, 42)
+
+    def test_query_embedding_defaults_to_false(self):
+        """When query_embedding is not in configer, default should be False."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        # Don't set query_embedding attribute → hasattr returns False
+        del configer.query_embedding
+
+        store._initialize_by_component_configer(configer)
+
+        self.assertFalse(store.query_embedding)
+
+
+# ------------------------------------------------------------------ #
+# 2. ChromaStore — persist_path=None guard
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(CHROMA_AVAILABLE, "chromadb not available")
+class TestChromaStorePersistPathNone(unittest.TestCase):
+    """Verify that _new_client handles persist_path=None gracefully."""
+
+    def test_new_client_with_none_persist_path(self):
+        """_new_client should not crash with AttributeError when persist_path is None."""
+        from agentuniverse.agent.action.knowledge.store.chroma_store import ChromaStore
+
+        store = ChromaStore(persist_path=None)
+        # This should not raise AttributeError: 'NoneType' object has no attribute 'startswith'
+        try:
+            client = store._new_client()
+            self.assertIsNotNone(client)
+        except AttributeError as e:
+            if "'NoneType'" in str(e) and "startswith" in str(e):
+                self.fail(f"_new_client crashed on persist_path=None: {e}")
+            raise  # re-raise if it's a different AttributeError
+
+
+# ------------------------------------------------------------------ #
+# 3. FAISSStore — module-level faiss/np after _new_client
+# -----------------------------------------------------------
```

---

### Incident Patch 5: `cd88a43c` (2026-07-28)
**Commit Message**: Merge pull request #705 from messere1/codex/fix-async-agent-trace-chain

fix(trace): preserve parent chain for async agents

**File**: `agentuniverse/base/annotation/trace.py` (modified, +0/-1)
```diff
@@ -209,7 +209,6 @@ async def _default_agent_wrapper_async(func, *args, **kwargs):
                                                          result,
                                                          start_info,
                                                          pair_id)
-        Monitor.pop_invocation_chain()
         return result
 
 
```

**File**: `tests/test_agentuniverse/unit/base/annotation/test_trace.py` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import asyncio
+import importlib
+
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
+
+
+class _StubConversationMemoryModule:
+    def add_agent_input_info(self, *args, **kwargs):
+        pass
+
+    def add_agent_result_info(self, *args, **kwargs):
+        pass
+
+
+class _StubAgent:
+    agent_model = None
+
+
+async def _run_agent(self, **kwargs):
+    return "done"
+
+
+def test_async_agent_wrapper_restores_parent_invocation_chain(monkeypatch):
+    trace_module = importlib.import_module("agentuniverse.base.annotation.trace")
+    monkeypatch.setattr(
+        trace_module,
+        "ConversationMemoryModule",
+        _StubConversationMemoryModule,
+    )
+
+    async def run_in_parent_context():
+        context_manager = FrameworkContextManager()
+        context_manager.clear_all_contexts()
+        parent = {"source": "parent-agent", "type": "agent"}
+        trace_module.Monitor.init_invocation_chain()
+        trace_module.Monitor.add_invocation_chain(parent)
+
+        try:
+            result = await trace_module._default_agent_wrapper_async(
+                _run_agent,
+                _StubAgent(),
+            )
+
+            assert result == "done"
+            assert trace_module.Monitor.get_invocation_chain() == [parent]
+        finally:
+            trace_module.Monitor.clear_invocation_chain()
+            context_manager.clear_all_contexts()
+
+    asyncio.run(run_in_parent_context())
```

---

### Incident Patch 6: `88b66fad` (2026-07-28)
**Commit Message**: Merge pull request #704 from messere1/codex/fix-monitor-input-mutation

fix(monitor): preserve LLM inputs during token counting

**File**: `agentuniverse/base/util/monitor/monitor.py` (modified, +1/-1)
```diff
@@ -291,7 +291,7 @@ def get_llm_token_usage(llm_obj: object, llm_input: dict, output: LLMOutput) ->
 
             if llm_obj is None or llm_input is None:
                 return {}
-            messages = llm_input.get('kwargs', {}).pop('messages', None)
+            messages = llm_input.get('kwargs', {}).get('messages')
 
             input_str = ''
             if messages is not None and isinstance(messages, list):
```

**File**: `tests/test_agentuniverse/unit/base/util/monitor/test_monitor.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+from copy import deepcopy
+
+from agentuniverse.base.util.monitor.monitor import Monitor
+from agentuniverse.llm.llm_output import LLMOutput
+
+
+class _StubLLM:
+    @staticmethod
+    def get_num_tokens(text: str) -> int:
+        return len(text)
+
+
+def test_get_llm_token_usage_preserves_llm_input():
+    llm_input = {
+        "kwargs": {
+            "messages": [
+                {"role": "user", "content": "hello"},
+            ]
+        }
+    }
+    original_input = deepcopy(llm_input)
+
+    usage = Monitor.get_llm_token_usage(
+        _StubLLM(),
+        llm_input,
+        LLMOutput(text="response"),
+    )
+
+    assert usage["total_tokens"] > 0
+    assert llm_input == original_input
```

---

### Incident Patch 7: `729b08a5` (2026-07-28)
**Commit Message**: fix(agent): isolate output object mappings

**File**: `agentuniverse/agent/output_object.py` (modified, +3/-3)
```diff
@@ -9,12 +9,12 @@
 
 class OutputObject(object):
     def __init__(self, params: dict):
-        self.__params = params
-        for k, v in params.items():
+        self.__params = params.copy()
+        for k, v in self.__params.items():
             self.__dict__[k] = v
 
     def to_dict(self):
-        return self.__params
+        return self.__params.copy()
 
     def to_json_str(self):
         return json.dumps(self.__params, ensure_ascii=False)
```

**File**: `tests/test_agentuniverse/unit/agent/test_output_object.py` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+from agentuniverse.agent.output_object import OutputObject
+
+
+def test_output_object_copies_constructor_params():
+    params = {"output": "original"}
+    output_object = OutputObject(params)
+
+    params["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
+
+
+def test_to_dict_returns_an_independent_mapping():
+    output_object = OutputObject({"output": "original"})
+
+    exported = output_object.to_dict()
+    exported["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
```

---

### Incident Patch 8: `e3f21ad2` (2026-07-28)
**Commit Message**: fix(context): isolate log metadata across contexts

**File**: `agentuniverse/base/context/framework_context_manager.py` (modified, +4/-8)
```diff
@@ -119,11 +119,7 @@ def clear_all_contexts(self):
         self.__context_dict.set({})
 
     def set_log_context(self, context_key: str, context_value: Any):
-        log_context = self.get_context("LOG_CONTEXT")
-        if not log_context:
-            log_context = {
-                context_key: context_value
-            }
-            self.set_context("LOG_CONTEXT", log_context)
-        else:
-            log_context[context_key] = context_value
+        current_context = self.get_context("LOG_CONTEXT")
+        log_context = current_context.copy() if isinstance(current_context, dict) else {}
+        log_context[context_key] = context_value
+        self.set_context("LOG_CONTEXT", log_context)
```

**File**: `tests/test_agentuniverse/unit/base/context/test_framework_context.py` (modified, +24/-2)
```diff
@@ -7,13 +7,14 @@
 
 import asyncio
 import queue
-import time
 import threading
+import time
+from contextvars import copy_context
 
 import pytest
 
-from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 from agentuniverse.base.context.framework_context import FrameworkContext
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 
 context_manager: FrameworkContextManager = FrameworkContextManager()
 
@@ -76,5 +77,26 @@ def test_set_all_contexts_returns_tokens_for_restoration():
     context_manager.clear_all_contexts()
 
 
+def test_log_context_isolated_across_copied_contexts():
+    context_manager.clear_all_contexts()
+    context_manager.set_log_context("request_id", "parent")
+    child_context = copy_context()
+
+    def update_child_context():
+        context_manager.set_log_context("worker_id", "child")
+        return context_manager.get_context("LOG_CONTEXT")
+
+    child_log_context = child_context.run(update_child_context)
+
+    assert child_log_context == {
+        "request_id": "parent",
+        "worker_id": "child",
+    }
+    assert context_manager.get_context("LOG_CONTEXT") == {
+        "request_id": "parent",
+    }
+    context_manager.clear_all_contexts()
+
+
 if __name__ == "__main__":
     pytest.main([__file__, "-s"])
```

---

### Incident Patch 9: `b07b55b4` (2026-07-27)
**Commit Message**: fix: preserve archive member lookup names

**File**: `agentuniverse/agent/action/tool/common_tool/secure_archive_tool.py` (modified, +13/-3)
```diff
@@ -128,6 +128,7 @@ def _safe_member_name(raw: str) -> str:
         return path.as_posix().rstrip("/")
 
     def _entries(self, path: str) -> list[dict[str, Any]]:
+        """Return safe public names alongside private archive lookup names."""
         entries: list[dict[str, Any]] = []
         if self._kind(path) == "zip":
             try:
@@ -141,6 +142,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.filename),
+                                "_source_name": item.filename,
                                 "size": item.file_size,
                                 "compressed_size": item.compress_size,
                                 "is_dir": item.is_dir(),
@@ -157,6 +159,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.name),
+                                "_source_name": item.name,
                                 "size": item.size,
                                 "compressed_size": None,
                                 "is_dir": item.isdir(),
@@ -269,7 +272,14 @@ def _create(self, path: str, values: Any, overwrite: Any, compression: Any) -> d
 
     @staticmethod
     def _list(path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
-        return {"status": "success", "mode": "list", "file_path": path, "entries": entries, "entry_count": len(entries)}
+        public_entries = [{key: item[key] for key in ("name", "size", "compressed_size", "is_dir")} for item in entries]
+        return {
+            "status": "success",
+            "mode": "list",
+            "file_path": path,
+            "entries": public_entries,
+            "entry_count": len(entries),
+        }
 
     def _info(self, path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
         return {
@@ -319,7 +329,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    with archive.open(item["name"]) as source:
+                    with archive.open(item["_source_name"]) as source:
                         self._atomic_copy(source, destination, item["size"])
                     extracted.append(destination)
         else:
@@ -328,7 +338,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    source = archive.extractfile(item["name"])
+                    source = archive.extractfile(item["_source_name"])
                     if source is None:
                         raise ValueError(f"unable to read archive member: {item['name']}")
                     with source:
```

**File**: `tests/test_agentuniverse/unit/agent/action/tool/test_secure_archive_tool.py` (modified, +31/-0)
```diff
@@ -1,5 +1,7 @@
+import io
 import os
 import stat
+import tarfile
 import tempfile
 import unittest
 import zipfile
@@ -60,6 +62,35 @@ def test_selective_extract(self):
         self.assertEqual(len(result["output_paths"]), 1)
         self.assertFalse(os.path.exists(os.path.join(self.directory.name, "out/a.txt")))
 
+    def test_extracts_zip_member_with_backslashes(self):
+        with zipfile.ZipFile(os.path.join(self.directory.name, "windows.zip"), "w") as archive:
+            archive.writestr("nested\\file.txt", b"payload")
+
+        listed = self.tool.execute(mode="list", file_path="windows.zip")
+        self.assertEqual(listed["status"], "success")
+        self.assertEqual(listed["entries"][0]["name"], "nested/file.txt")
+        self.assertEqual(
+            set(listed["entries"][0]),
+            {"name", "size", "compressed_size", "is_dir"},
+        )
+
+        result = self.tool.execute(mode="extract", file_path="windows.zip", output_dir="windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), b"payload")
+
+    def test_extracts_tar_member_with_backslashes(self):
+        payload = b"payload"
+        with tarfile.open(os.path.join(self.directory.name, "windows.tar"), "w") as archive:
+            info = tarfile.TarInfo("nested\\file.txt")
+            info.size = len(payload)
+            archive.addfile(info, io.BytesIO(payload))
+
+        result = self.tool.execute(mode="extract", file_path="windows.tar", output_dir="tar-windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "tar-windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), payload)
+
     def test_create_refuses_overwrite(self):
         self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["a.txt"])
         result = self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["nested/b.txt"])
```

---

### Incident Patch 10: `91e2e1ba` (2026-07-26)
**Commit Message**: fix(store): fix init bugs in MilvusStore, ChromaStore, and FAISSStore

- MilvusStore: fix typo that assigned query_embedding config to
  similarity_top_k instead of query_embedding (L95)
- ChromaStore: add None guard for persist_path in _new_client to
  prevent AttributeError when persist_path is not configured
- FAISSStore: fix import scope so faiss and numpy are assigned to
  module-level variables, preventing NameError in methods outside
  _new_client that reference them

Signed-off-by: 123123213weqw <wangjian3214567@gmail.com>
Signed-off-by: messere1 <189848840+messere1@users.noreply.github.com>

**File**: `agentuniverse/agent/action/knowledge/store/chroma_store.py` (modified, +9/-3)
```diff
@@ -41,20 +41,26 @@ class ChromaStore(Store):
 
     def _new_client(self) -> Any:
         """Initialize the chroma client."""
-        if self.persist_path.startswith('http') or \
-                self.persist_path.startswith('https'):
+        if self.persist_path and (
+            self.persist_path.startswith('http') or
+            self.persist_path.startswith('https')
+        ):
             # Remote database URL
             parsed_url = urlparse(self.persist_path)
             settings = Settings(
                 chroma_api_impl="chromadb.api.fastapi.FastAPI",
                 chroma_server_host=parsed_url.hostname,
                 chroma_server_http_port=str(parsed_url.port)
             )
-        else:
+        elif self.persist_path:
+            # Local persistent database
             settings = Settings(
                 is_persistent=True,
                 persist_directory=self.persist_path
             )
+        else:
+            # In-memory only (no persistence path configured)
+            settings = Settings()
 
         client = chromadb.Client(settings)
         if self.collection is None:
```

**File**: `agentuniverse/agent/action/knowledge/store/faiss_store.py` (modified, +18/-9)
```diff
@@ -17,6 +17,11 @@
 from agentuniverse.agent.action.knowledge.store.store import Store
 from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger
 
+# Module-level placeholders for optional dependencies; populated lazily
+# by _new_client so that importing this module never requires faiss/numpy.
+faiss = None
+np = None
+
 # Default configuration for FAISS index types
 DEFAULT_INDEX_CONFIG = {
     "index_type": "IndexFlatL2",
@@ -72,15 +77,19 @@ def __init__(self, **kwargs):
 
     def _new_client(self) -> Any:
         """Initialize the FAISS index and load existing data if available."""
-        try:
-            import faiss
-            import numpy as np
-        except ImportError as e:
-            FAISS_NOT_INSTALLED_MSG = (
-                "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
-                "for CPU version or 'pip install faiss-gpu' for GPU version."
-            )
-            raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+        global faiss, np
+        if faiss is None or np is None:
+            try:
+                import faiss as _faiss
+                import numpy as _np
+            except ImportError as e:
+                FAISS_NOT_INSTALLED_MSG = (
+                    "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
+                    "for CPU version or 'pip install faiss-gpu' for GPU version."
+                )
+                raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+            faiss = _faiss
+            np = _np
         self._load_index_and_metadata()
         return self.faiss_index
 
```

**File**: `agentuniverse/agent/action/knowledge/store/milvus_store.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def _initialize_by_component_configer(self,
         if hasattr(milvus_store_configer, "similarity_top_k"):
             self.similarity_top_k = milvus_store_configer.similarity_top_k
         if hasattr(milvus_store_configer, "query_embedding"):
-            self.similarity_top_k = milvus_store_configer.query_embedding
+            self.query_embedding = milvus_store_configer.query_embedding
         return self
 
     def _create_or_load_collection(self,
```

**File**: `tests/test_agentuniverse/unit/agent/action/knowledge/store/test_store_init_fixes.py` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# !/usr/bin/env python3
+# -*- coding:utf-8 -*-
+
+"""Unit tests for store initialization bug fixes.
+
+Covers three critical bugs:
+1. MilvusStore: query_embedding config was assigned to similarity_top_k (typo)
+2. ChromaStore: _new_client crashed with AttributeError when persist_path=None
+3. FAISSStore: faiss/np module-level names were not set by lazy import in _new_client
+"""
+
+import unittest
+from unittest.mock import MagicMock, patch
+
+# ------------------------------------------------------------------ #
+# Detect optional dependencies
+# ------------------------------------------------------------------ #
+try:
+    import chromadb  # noqa: F401
+    CHROMA_AVAILABLE = True
+except ImportError:
+    CHROMA_AVAILABLE = False
+
+try:
+    import pymilvus  # noqa: F401
+    PYMILVUS_AVAILABLE = True
+except ImportError:
+    PYMILVUS_AVAILABLE = False
+
+try:
+    import faiss  # noqa: F401
+    import numpy as np  # noqa: F401
+    FAISS_AVAILABLE = True
+except ImportError:
+    FAISS_AVAILABLE = False
+
+
+# ------------------------------------------------------------------ #
+# 1. MilvusStore — query_embedding config assignment typo
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(PYMILVUS_AVAILABLE, "pymilvus not available")
+class TestMilvusStoreQueryEmbeddingConfig(unittest.TestCase):
+    """Verify that query_embedding config is correctly assigned."""
+
+    def test_query_embedding_config_assigned_correctly(self):
+        """query_embedding=True should set self.query_embedding, not similarity_top_k."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        configer.query_embedding = True
+        configer.similarity_top_k = 42
+
+        store._initialize_by_component_configer(configer)
+
+        # query_embedding should be True (was previously ignored due to typo)
+        self.assertTrue(store.query_embedding)
+        # similarity_top_k should remain 42, not overwritten by the boolean True
+        self.assertEqual(store.similarity_top_k, 42)
+
+    def test_query_embedding_defaults_to_false(self):
+        """When query_embedding is not in configer, default should be False."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        # Don't set query_embedding attribute → hasattr returns False
+        del configer.query_embedding
+
+        store._initialize_by_component_configer(configer)
+
+        self.assertFalse(store.query_embedding)
+
+
+# ------------------------------------------------------------------ #
+# 2. ChromaStore — persist_path=None guard
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(CHROMA_AVAILABLE, "chromadb not available")
+class TestChromaStorePersistPathNone(unittest.TestCase):
+    """Verify that _new_client handles persist_path=None gracefully."""
+
+    def test_new_client_with_none_persist_path(self):
+        """_new_client should not crash with AttributeError when persist_path is None."""
+        from agentuniverse.agent.action.knowledge.store.chroma_store import ChromaStore
+
+        store = ChromaStore(persist_path=None)
+        # This should not raise AttributeError: 'NoneType' object has no attribute 'startswith'
+        try:
+            client = store._new_client()
+            self.assertIsNotNone(client)
+        except AttributeError as e:
+            if "'NoneType'" in str(e) and "startswith" in str(e):
+                self.fail(f"_new_client crashed on persist_path=None: {e}")
+            raise  # re-raise if it's a different AttributeError
+
+
+# ------------------------------------------------------------------ #
+# 3. FAISSStore — module-level faiss/np after _new_client
+# -----------------------------------------------------------
```

#### Recent Merged Pull Requests:
- **PR #3287** (closed): feat: add a TAR reader (default_tar_reader) for .tar/.tar.gz/.tgz knowledge ingestion (@Metastarx)
- **PR #1302** (closed): docs: add docstring to query in redis_vector_store.py (@123123213weqw)
- **PR #1301** (closed): docs: add docstring to get_single_embedding in ollama_embedding.py (@yyqdbngt)
- **PR #1300** (closed): docs: add docstring to batched in dashscope_embedding.py (@btlqql)
- **PR #1299** (closed): docs: add docstring to async_get_embeddings in doubao_embedding.py (@123123213weqw)
- **PR #1298** (closed): docs: add docstring to splitter in token_text_splitter.py (@yyqdbngt)
- **PR #1297** (closed): docs: add docstring to splitter in recursive_character_text_splitter.py (@btlqql)
- **PR #1296** (closed): docs: add docstring to splitter in character_text_splitter.py (@123123213weqw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
