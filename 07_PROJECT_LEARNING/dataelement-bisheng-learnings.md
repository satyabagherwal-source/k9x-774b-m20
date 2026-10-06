# Forensic Learning Record (Deep Inspection): dataelement/bisheng

> **Canonical Artifact**: `07_PROJECT_LEARNING/dataelement-bisheng-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dataelement/bisheng](https://github.com/dataelement/bisheng))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:37:10.807Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dataelement/bisheng`
- **Description**: BISHENG is an open LLM devops platform for next generation Enterprise AI applications. Powerful and comprehensive features include: GenAI workflow, RAG, Agent, Unified model management, Evaluation, SFT, Dataset Management, Enterprise-level System Management, Observability and more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12025 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/backend/bisheng/api/services/utils.py`
```
from bisheng.template.field.base import TemplateField
from bisheng.template.template.base import Template
from pydantic import BaseModel
from langchain_core.language_models import BaseLanguageModel


def set_flow_knowledge_id(graph_data: dict, knowledge_id: int):

    for node in graph_data['nodes']:
        if 'VectorStore' in node['data']['node']['base_classes']:
            if 'collection_name' in node['data'].get('node').get('template').keys():
                node['data']['node']['template']['collection_name']['collection_id'] = knowledge_id
            if 'index_name' in node['data'].get('node').get('template').keys():
                node['data']['node']['template']['index_name']['collection_id'] = knowledge_id
    return graph_data


def replace_flow_llm(graph_data: dict, llm: BaseLanguageModel, llm_param: dict):
    # Ganticlass, Gantitemplate， Others do not move.
    for node in graph_data['nodes']:
        if 'BaseLanguageModel' in node['data']['node']['base_classes']:
            node['data']['type'] = type(llm).__name__
            node['data']['node']['template'] = trans_obj_to_json(llm, llm_param)

    return graph_data


def trans_obj_to_json(obj: BaseModel, llm_param: dict):
    # template Build.
    template = []
    field_json = obj.__dict__
    for k, v in field_json.items():
        if k in llm_param:
            template.append(
                TemplateField(field_type=type(v).__name__, name=k,
                              value=llm_param.get(k)).to_dict())
    return Template(type_name=type(obj).__name__, fields=template).to_dict()

```

### Core Architecture Module: `src/backend/bisheng/api/utils.py`
```
import aiohttp


async def get_url_content(url: str) -> str:
    """ Get the returned of the interfacebodyContents """
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise Exception(f'Failed to download content, HTTP status code: {response.status}')
            res = await response.read()
            return res.decode('utf-8')

```

### Core Architecture Module: `src/backend/bisheng/chat_session/utils.py`
```
from bisheng.common.constants.enums.telemetry import ApplicationTypeEnum
from bisheng.database.models.flow import FlowType


def get_session_app_type(flow_type: int) -> ApplicationTypeEnum:
    """Convert flow_type int to ApplicationTypeEnum."""
    if flow_type == FlowType.WORKFLOW.value:
        return ApplicationTypeEnum.WORKFLOW
    if flow_type == FlowType.ASSISTANT.value:
        return ApplicationTypeEnum.ASSISTANT
    if flow_type == FlowType.LINSIGHT.value:
        return ApplicationTypeEnum.LINSIGHT
    return ApplicationTypeEnum.DAILY_CHAT

```

### Core Architecture Module: `src/backend/bisheng/common/chat/utils.py`
```
import ast
import json
import re
from enum import Enum
from typing import Dict, List
from urllib.parse import unquote, urlparse

from langchain_classic.chains import LLMChain
from langchain_classic.prompts import PromptTemplate
from langchain_classic.schema.document import Document
from loguru import logger

from bisheng.core.database import get_async_db_session, get_sync_db_session
from bisheng.database.models.message import ChatMessageDao
from bisheng.database.models.recall_chunk import RecallChunk
from bisheng.llm.domain.services import LLMService


class SourceType(Enum):
    """
    source type
    """

    NOT_SUPPORT = 0
    FILE = 1
    NO_PERMISSION = 2
    LINK = 3
    QA = 4


prompt_template = """Analyze givenQuestionEkstrakQuestionContained inKeyWords, output list format

Examples:
Question: The current ratios of Damon over the past three years are as follows:2021Year:3.74x2020Year:2.82x2019Year:2.05x
KeyWords: ['Past three years', 'Current ratio', '2021', '3.74', '2020', '2.82', '2019', '2.05']

----------------
Question: {question}"""


def extract_answer_keys(answer, llm):
    """
    EkstrakanswerKeywords in
    """
    llm_chain = None
    if llm:
        llm_chain = LLMChain(llm=llm, prompt=PromptTemplate.from_template(prompt_template))
    try:
        keywords_str = llm_chain.run(answer)
        keywords_str = re.sub("<think>.*</think>", "", keywords_str, flags=re.S).strip()
        keywords = ast.literal_eval(keywords_str[9:])
    except Exception:
        import jieba.analyse

        logger.warning("llm extract_not_support, change to jieba")
        keywords = jieba.analyse.extract_tags(answer, topK=100, withWeight=False)

    return keywords


async def extract_answer_keys_async(answer, llm):
    """
    EkstrakanswerKeywords in
    """
    llm_chain = None
    if llm:
        llm_chain = LLMChain(llm=llm, prompt=PromptTemplate.from_template(prompt_template))
    try:
        keywords_str = await llm_chain.arun(answer)
        keywords_str = re.sub("<think>.*</think>", "", keywords_str, flags=re.S).strip()
        keywords = ast.literal_eval(keywords_str[9:])
    except Exception:
        import jieba.analyse

        logger.warning("llm extract_not_support, change to jieba")
        keywords = jieba.analyse.extract_tags(answer, topK=100, withWeight=False)

    return keywords


def sync_judge_source(result, source_document, chat_id, extra: Dict):
    source = SourceType.NOT_SUPPORT.value
    if isinstance(result, Document):
        metadata = result.metadata
        question = result.page_content
        result = json.loads(metadata.get("extra", "{}")).get("answer")
        if result:
            source = SourceType.QA.value
            extra.update({
                "qa": question,
                "url": json.loads(metadata.get("extra", "{}")).get("url"),
            })
            return source, result
        source_document = [source_document]
    if source_document and chat_id:
        if any(not doc.metadata.get("right", True) for doc in source_document):
            source = SourceType.NO_PERMISSION.value
        elif all(
                doc.metadata.get("user_metadata") and doc.metadata.get("user_metadata", {}).get("url")
                for doc in source_document
        ):
            source = SourceType.LINK.value
            repeat_doc = {}
            doc = []
            for one in source_document:
                title = one.metadata.get("source") or one.metadata.get("document_name")
                url = one.metadata.get("user_metadata", {}).get("url")
                repeat_key = (title, url)
                if repeat_doc.get(repeat_key):
                    continue
                doc.append({"title": title, "url": url})
                repeat_doc[repeat_key] = 1
            extra.update({"doc": doc})
        else:
            source = SourceType.FILE.value
            for one in source_document:
                if not one.metadata.get("knowledge_id") or not one.metadata.get("document_id"):
                    source = SourceType.NOT_SUPPORT.value
                    break
                try:
                    int(one.metadata.get("knowledge_id"))
                    int(one.metadata.get("file_id") or one.metadata.get("document_id"))
                except Exception:
                    source = SourceType.NOT_SUPPORT.value
                    break

    return source, result


async def judge_source(result, source_document, chat_id, extra: Dict):
    return sync_judge_source(result, source_document, chat_id, extra)


def sync_process_source_document(source_document: List[Document], chat_id, message_id, answer):
    if not source_document or not message_id:
        return

    message_info = ChatMessageDao.get_message_by_id(message_id)
    if not message_info:
        return
    llm = LLMService.get_knowledge_source_llm(message_info.user_id)

    answer_keywords = extract_answer_keys(answer, llm)

    batch_insert = []
    for doc in source_document:
        if "bbox" in doc.metadata:
            content = doc.page_content
            recall_chunk = RecallChunk(
                chat_id=chat_id,
                keywords=json.dumps(answer_keywords),
                chunk=content,
                file_id=doc.metadata.get("file_id") or doc.metadata.get("document_id"),
                meta_data=json.dumps(doc.metadata),
                message_id=message_id,
            )
            batch_insert.append(recall_chunk)
    if batch_insert:
        with get_sync_db_session() as db_session:
            db_session.add_all(batch_insert)
            db_session.commit()


async def process_source_document(source_document: List[Document], chat_id, message_id, answer):
    logger.debug(f"process_source_document: {len(source_document)} message_id: {message_id}")

    if not source_document or not message_id:
        return
    message_info = await ChatMessageDao.aget_message_by_id(message_id)
    if not message_info:
        return
    llm = await LLMService.get_knowledge_source_llm_async(message_info.user_id)

    answer_keywords = await extract_answer_keys_async(answer, llm)

    batch_insert = []
    for doc in source_document:
        if "bbox" in doc.metadata:
            content = doc.page_content
            recall_chunk = RecallChunk(
                chat_id=chat_id,
                keywords=json.dumps(answer_keywords),
                chunk=content,
                file_id=doc.metadata.get("file_id") or doc.metadata.get("document_id"),
                meta_data=json.dumps(doc.metadata),
                message_id=message_id,
            )
            batch_insert.append(recall_chunk)
    if batch_insert:
        logger.debug(f"batch_insert: {len(batch_insert)} message_id: {message_id}")
        async with get_async_db_session() as db_session:
            db_session.add_all(batch_insert)
            await db_session.commit()
    logger.debug(f"process_source_document_over: {len(source_document)} message_id: {message_id}")


def process_node_data(node_data: List[Dict]) -> Dict:
    tweak = {}
    for nd in node_data:
        if nd.get("id") not in tweak:
            tweak[nd.get("id")] = {}
        if "InputFile" in nd.get("id", ""):
            file_path = nd.get("file_path")
            url_path = urlparse(file_path)
            if url_path.netloc:
                file_name = unquote(url_path.path.split("/")[-1])
            else:
                file_name = file_path.split("_", 1)[1] if "_" in file_path else ""
            nd["value"] = file_name
            tweak[nd.get("id")] = {"file_path": file_path, "value": file_name}
        elif "VariableNode" in nd.get("id", ""):
            variables = nd.get("name")
            variable_value = nd.get("value")
            variables_list = tweak[nd.get("id")].get("variables", [])
            if not variables_list:
                tweak[nd.get("id")]["variables"] = variables_list
                tweak[nd.get("id")]["variable_value"] = []
            variables_list.append(variables)
            variables_value_list = tweak[nd.get("id")].get("variable_value", [])
            variables_value_list.append(variable_value)
    return tweak

```

### Core Architecture Module: `src/backend/bisheng/common/dependencies/core_deps.py`
```
from typing import Generator, Any, AsyncGenerator

from sqlmodel.ext.asyncio.session import AsyncSession, Session


# db session
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session"""
    from bisheng.core.database import get_database_connection
    db_manager = await get_database_connection()
    async with db_manager.async_session() as session:
        yield session


# sync db session
def get_sync_db_session() -> Generator[Session, None, None]:
    """Get a synchronous database session"""
    from bisheng.core.database.manager import sync_get_database_connection

    db_manager = sync_get_database_connection()
    with db_manager.create_session() as session:
        yield session

```

### Core Architecture Module: `src/backend/bisheng/common/utils/markdown_cmpnt/md_to_docx/config/default_style.py`
```
#  Parameter explanation. Note that colon or dash must be followed by a space and cannot be omitted.
#
#  font:
#    default: Western fonts, default [Times New Roman]
#    east-asia: Chinese font, default [Song Ti]
#    size: Font Size (Default) [12]<g id="Bold">Employer: </g>pt
#    color: RGBColorful 16 Metric value, must be a string, default ["000000"] pure black
#    extra: Extra styles, do not add these styles by default. The following styles are supported, effective if there is, ignored if there is none
#    - bold bolded
#    - italic Italic
#    - underline LOW LINE
#    - strike Strikethrough
#  first-line-indent: First line indent, default [0], unit: times
#  line-spacing: Line spacing, default [1.2] Unit: times, indicates line spacing is set to 1.2 Double row height,
#  space:
#    before Space before paragraph, default [0] pt
#    after: Space after paragraph, default [0] pt

# h1~h4Show1to4Level Title
style_conf = {
    "h1":
        {
            "font":
                {
                    "default": "黑体",
                    "east-asia": "黑体",
                    "size": 22
                },
            "line-spacing": 1.2,
            "space":
                {
                    "before": 11,
                    "after": 11
                }
        },
    "h2":
        {
            "font":
                {
                    "default": "黑体",
                    "east-asia": "黑体",
                    "size": 18
                },
            "line-spacing": 1.2,
            "space":
                {
                    "before": 11,
                    "after": 11
                }
        },
    "h3":
        {
            "font":
                {
                    "default": "黑体",
                    "east-asia": "黑体",
                    "size": 14
                },
            "line-spacing": 1.2,
            "space":
                {
                    "before": 11,
                    "after": 11
                }
        },
    "h4":
        {
            "font":
                {
                    "default": "Times New Roman",
                    "east-asia": "楷体",
                    "size": 12,
                    "extra":
                        [
                            "bold"
                        ]
                },
            "line-spacing": 1.2,
            "space":
                {
                    "before": 11,
                    "after": 11
                }
        },
    "normal":
        {
            "font":
                {
                    "default": "Times New Roman",
                    "east-asia": "宋体",
                    "size": 12,
                    "color": "000000"
                },
            "line-spacing": 1.3,
            "space":
                {
                    "before": 7,
                    "after": 7
                }
        }
}

```

### Core Architecture Module: `src/backend/bisheng/common/utils/markdown_cmpnt/md_to_docx/markdocx.py`
```
from bisheng.common.utils.markdown_cmpnt.md_to_pdf import sanitize_html_for_pdf
from bisheng.common.utils.markdown_cmpnt.md_to_docx.config.default_style import style_conf
from bisheng.common.utils.markdown_cmpnt.md_to_docx.parser.md_parser import md2html
from bisheng.common.utils.markdown_cmpnt.md_to_docx.provider.docx_processor import DocxProcessor


class MarkDocx:
    def __init__(self):
        self.docx_processor = DocxProcessor(style_conf=style_conf)

    def __call__(self, md_input: str):
        """
        Convert markdown file to docx file
        :param md_input:
        :return:
        """

        html_text = sanitize_html_for_pdf(md2html(md_input))

        # BuatdocxDoc.
        docx_file_byte, title_text = self.docx_processor.html2docx(html_text)

        return docx_file_byte, title_text

```

### Core Architecture Module: `src/backend/bisheng/common/utils/markdown_cmpnt/md_to_docx/parser/ext_md_syntax.py`
```
from markdown.inlinepatterns import SimpleTagInlineProcessor
from markdown.extensions import Extension


class ExtMdSyntax(Extension):
    """
    Extended Format Parsing
    """
    def extendMarkdown(self, md):
        # ==With Highlighted Text==
        md.inlinePatterns.register(SimpleTagInlineProcessor(r'()==(.+?)==', 'highlight'), 'highlight', 175)
        # ~~Strikethrough~~
        md.inlinePatterns.register(SimpleTagInlineProcessor(r'()~~(.+?)~~', 'strike'), 'strike', 2)
        # ^Subscript and superscript^
        md.inlinePatterns.register(SimpleTagInlineProcessor(r'()\^(.+?)\^', 'sup'), 'sup', 188)
        # ~Subscript~
        md.inlinePatterns.register(SimpleTagInlineProcessor(r'()~(.+?)~', 'sub'), 'sub', 1)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2442** (2026-09-29): **fix(workflow): isolate telemetry failures on 3.0-beta2**
  *Symptoms*: Port of #2436 onto feat/3.0.0-beta2. The original author is preserved in the cherry-picked commit. Resolves the #2435 telemetry failure without replacing beta2's workflow authorization and execution-context handling. Verification: 8 focused tests passed; ruff format/check passed. The broader workflow suite has the same 14 pre-existing failures as the beta2 baseline and adds 2 passing regression cases.

- **Issue #2441** (2026-09-30): **fix(select): don't crash when a scroll-loading MultiSelect unmounts while open**
  *Symptoms*: This PR proposes fixing the `TypeError: Failed to execute 'unobserve' on 'IntersectionObserver': parameter 1 is not of type 'Element'` crash in the platform `MultiSelect` scroll-load cleanup (Fixes #1676). We include this PR work along with a full history of your repo at https://eastagiletracker.com/projects/668. You can sign in with your GitHub ID to claim ownership of the project.  ## What was wrong  `src/frontend/platform/src/components/bs-ui/select/multi.tsx` starts an `IntersectionObserver` on the list footer when a scroll-loading select opens, and its effect cleanup was `return () => observer.unobserve(footerRef.current)`. When the select unmounts while its dropdown is open, React has already detached the ref before the cleanup runs, so the cleanup calls `unobserve(null)`. This component is the knowledge-base picker in workflow nodes (`KnowledgeSelectItem`) and in `bs-comp/selectComponent/knowledge.tsx`, which is where #1676 reports the error. Browsers throw on that, and the error lands in the app's error boundary. #2209 reports the same message, without steps. Your own hooks lint had flagged this line ("The ref value 'footerRef.current' will likely have changed by the time this effect cleanup function runs"), and it was one of the two `react-hooks/exhaustive-deps` entries frozen for this file in `eslint-suppressions.json`.  There is a second, quieter effect: when the dropdown closes, Radix re-renders the items into a detached fragment, so `footerRef.current` is by then
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution. The code has been merged via cherry-pick.[e2ab414](https://github.com/dataelement/bisheng/commit/e2ab41488eda5fabae0c56f9bda038a2970634c0)

- **Issue #2439** (2026-09-23): **Feat 2.5.0 sg up**
  *Symptoms*: ## What  简要描述做了什么改动。  ## Why  为什么需要这个改动？  ## How  实现方式、设计决策（如有）。  ## Test  - [ ] 本地测试通过 - [ ] 114 测试服务器验证通过  ## Related  - Issue/ticket: 

- **Issue #2438** (2026-09-23): **Feat/3.0.0 beta2 pre**
  *Symptoms*: ## What  简要描述做了什么改动。  ## Why  为什么需要这个改动？  ## How  实现方式、设计决策（如有）。  ## Test  - [ ] 本地测试通过 - [ ] 114 测试服务器验证通过  ## Related  - Issue/ticket: 

- **Issue #2437** (2026-09-23): **Feat/3.0.0 beta2**
  *Symptoms*: ## What  简要描述做了什么改动。  ## Why  为什么需要这个改动？  ## How  实现方式、设计决策（如有）。  ## Test  - [ ] 本地测试通过 - [ ] 114 测试服务器验证通过  ## Related  - Issue/ticket: 

- **Issue #2436** (2026-09-29): **fix(workflow): isolate telemetry failures**
  *Symptoms*: ## Summary  - keep workflow execution and continuation outcomes authoritative when best-effort telemetry metadata lookup fails - share telemetry construction and submission between both Celery task wrappers - log telemetry failures with traceback instead of letting them escape the task - add deterministic regression coverage for initial and continued workflow runs  Fixes #2435.  ## Testing  - `pytest test/workflow/test_workflow_tasks.py -q` — **2 passed** - `pytest test/workflow -q` — **108 passed, 4 environment-dependent failures**: missing `template.docx`, missing `/tmp/bisheng` fixture directory (2), and unavailable MinIO at `minio:9000` - `ruff format --check bisheng/worker/workflow/tasks.py test/workflow/test_workflow_tasks.py` - `ruff check test/workflow/test_workflow_tasks.py` - `git diff --check`
  **Post-Mortem & Fix Analysis**:
  > Thank you for your contribution. The code has been merged, and the release version is 3.0.0-beta3 https://github.com/dataelement/bisheng/commit/448b0aa8e89dddfa1b663c4954103841532279c6

- **Issue #2435** (2026-09-29): **Workflow Celery tasks fail after successful execution when telemetry metadata lookup raises**
  *Symptoms*: ## Description  `execute_workflow` and `continue_workflow` perform workflow execution inside a `try` block, then query workflow metadata and submit telemetry from an unguarded `finally` block. If `WorkFlowService.get_one_workflow_simple_info_sync()` raises after the workflow runner has completed successfully, the exception escapes the Celery task.  This changes an already-completed workflow into a Celery failure and can make task-level retries or monitoring report the wrong outcome. For workflows with side effects, a retry at this boundary can also repeat work even though Redis already contains a terminal workflow status.  ## Reproduction  1. Stub `_execute_workflow` (or `_continue_workflow`) to return successfully. 2. Stub `WorkFlowService.get_one_workflow_simple_info_sync` to raise `RuntimeError`. 3. Invoke the corresponding Celery task body.  On current `main` (`2456ec17c`), the telemetry metadata exception escapes the task after the workflow runner has returned. Both initial execution and continuation use the same pattern.  ## Expected behavior  Telemetry is best-effort and must not change the workflow task outcome. Failures while constructing or submitting telemetry should be logged with their traceback, while the completed workflow result remains authoritative.  ## Proposed fix  Move the shared telemetry block into a small best-effort helper used by both task wrappers, log telemetry exceptions, and add deterministic regression coverage for the initial and continuation p
  **Post-Mortem & Fix Analysis**:
  > Thank you for your contribution. The code has been merged, and the release version is 3.0.0-beta3

- **Issue #2434** (2026-09-22): **fix(dsh): show seat failures in a transient toast with actionable reasons**
  *Symptoms*: 席位重新分配失败时，确认操作后用单个 toast 展示“用户名 + 具体原因”，约 4 秒自动消失。操作表格保持原列宽；同一操作的同一失败只提示一次，新操作可再次提示，超时请求继续沿用原操作 ID 查询结果。  模型额度保存遇到已撤销席位时，提供前往“授权与席位”重新分配的具体指引。批量选择同时存在容量不足和已撤销成员时，配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6) 优先返回席位不足，该 Gateway 修复已部署到 109。  验证：39 文件 / 333 项 DSH 前端回归通过；平台全量 lint、467 文件严格类型检查、生产构建、i18n 和架构检查通过。实际 React 组件配合模拟接口的浏览器验收确认：确认后 toast 出现并自动消失，7 列宽度保持一致。109 根部门和子部门的满席保存校验均返回 seat_limit_reached，席位及额度保持原值；toast 版本的现场满席点击复验为 NOT_RUN，验收时现场由测试同事调整为 8/10，发布后为 9/10 席。  部署：109:13001 前端已更新至 26d23c62e，登录态页面、Nginx、关键资源摘要及 4 条路由 HTTP 200 校验通过；其余容器保持运行状态。该提交的 Frontend Quality CI 已通过。 

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

### Incident Patch 1: `202ed879` (2026-09-22)
**Commit Message**: fix(dsh): show seat failures in a transient toast with actionable reasons (#2434)

席位重新分配失败时，确认操作后用单个 toast 展示“用户名 + 具体原因”，约 4
秒自动消失。操作表格保持原列宽；同一操作的同一失败只提示一次，新操作可再次提示，超时请求继续沿用原操作 ID 查询结果。

模型额度保存遇到已撤销席位时，提供前往“授权与席位”重新分配的具体指引。批量选择同时存在容量不足和已撤销成员时，配套 [Gateway
#6](https://github.com/dataelement/bisheng-gateway/pull/6) 优先返回席位不足，该
Gateway 修复已部署到 109。

验证：39 文件 / 333 项 DSH 前端回归通过；平台全量 lint、467 文件严格类型检查、生产构建、i18n 和架构检查通过。实际
React 组件配合模拟接口的浏览器验收确认：确认后 toast 出现并自动消失，7 列宽度保持一致。109 根部门和子部门的满席保存校验均返回
seat_limit_reached，席位及额度保持原值；toast 版本的现场满席点击复验为 NOT_RUN，验收时现场由测试同事调整为
8/10，发布后为 9/10 席。

部署：109:13001 前端已更新至 26d23c62e，登录态页面、Nginx、关键资源摘要及 4 条路由 HTTP 200
校验通过；其余容器保持运行状态。该提交的 Frontend Quality CI 已通过。

**File**: `docs/STATUS.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：跟进 #2433 的席位反馈验收。确认“重新分配”后，失败原因以“用户名 + 原因”的单个 toast 展示，约 4 秒自动消失；每次操作的同一失败只提示一次，新操作可再次提示。表格保持原列宽。已撤销席位的管理提示提供明确的重新分配步骤。批量容量错误配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
+  - 自动化：39 文件 / 333 项 DSH 前端回归、平台全量 lint、467 文件严格类型检查、生产构建、i18n 校验和架构守卫通过。
+  - 浏览器：实际 React 组件配合模拟失败回执，确认后显示 toast，随后自动消失；7 列宽度在显示前、显示中和消失后完全一致。
+  - 109：此前 Gateway 容量修复已部署，根部门及子部门保存均返回 seat_limit_reached，席位和额度保持原值；本条提交时 toast 前端发布待执行，现场席位为 8/10，真实满席点击复验为 NOT_RUN。
+
 - 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
   - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
   - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-0)
```diff
@@ -2405,6 +2405,7 @@
     "userMonthlyLimit": "Monthly token quota for {{name}}",
     "seatLimitTitle": "Insufficient seats",
     "seatLimitGrantHelp": "Not enough seats. This authorization was not applied. Add seats or release existing seats, then try again.",
+    "seatRevokedGrantHelp": "Selected members include revoked seats. Reassign their seats in License & seats, then save the authorization.",
     "goToLicenseAndSeats": "Go to license & seats",
     "userUsage": "Usage statistics",
     "usageScope": "Select a user in the current tenant to view token usage, messages, and completed Q&A over a time range.",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} の月間トークン上限",
     "seatLimitTitle": "シート不足",
     "seatLimitGrantHelp": "シート数が不足しているため、権限は反映されませんでした。シートを追加するか、既存のシートを解放して再試行してください。",
+    "seatRevokedGrantHelp": "選択したメンバーに取り消されたシートがあります。「ライセンスとシート」で再割り当てしてから、権限を保存してください。",
     "goToLicenseAndSeats": "ライセンスとシートへ",
     "userUsage": "使用統計",
     "usageScope": "現在のテナントからユーザーを選択し、期間内のトークン使用量、メッセージ数、完了した Q&A を確認します。",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} 每月 Token 额度",
     "seatLimitTitle": "席位不足",
     "seatLimitGrantHelp": "席位不足，本次授权未生效。请扩充席位或释放已有席位后重试。",
+    "seatRevokedGrantHelp": "所选成员包含已撤销席位，请先在“授权与席位”中重新分配，再保存授权。",
     "goToLicenseAndSeats": "前往授权与席位",
     "userUsage": "使用统计",
     "usageScope": "选择当前租户的用户，查看指定时间范围内的 Token 用量、消息数和问答次数。",
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessErrors.test.tsx` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ afterEach(() => {
 
 it.each([
     [26112, 'dsh.seatLimitGrantHelp'],
+    [26113, 'dsh.seatRevokedGrantHelp'],
     [11001, 'api_errors:11001'],
     [26115, 'api_errors:26115'],
     [26125, 'api_errors:26125'],
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/SeatsView.tsx` (modified, +24/-28)
```diff
@@ -1,5 +1,6 @@
 import { Button } from '@/components/bs-ui/button'
 import { Input } from '@/components/bs-ui/input'
+import { message } from '@/components/bs-ui/toast/use-toast'
 import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import {
     Table,
@@ -22,7 +23,7 @@ import type {
     DshSeat,
     DshSeatQuery,
 } from '@/types/dsh'
-import { useEffect, useRef, useState } from 'react'
+import { useCallback, useEffect, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { createDshOperationId } from '@/util/dshOperationId'
 import { DshChoice, DshPager, dshTime } from './common'
@@ -44,18 +45,26 @@ export function SeatsView({
     const [data, setData] = useState<DshPage<DshSeat> | null>(null)
     const [error, setError] = useState(false)
     const [pending, setPending] = useState<Record<string, string>>({})
-    const [commandErrors, setCommandErrors] = useState<Record<string, string>>({})
+    const commandFeedback = useRef(new Map<string, { name: string; errors: Set<string> }>())
+    const notifyCommandError = useCallback((operationId: string, errorKey: string) => {
+        const feedback = commandFeedback.current.get(operationId)
+        if (!feedback || feedback.errors.has(errorKey)) return
+        feedback.errors.add(errorKey)
+        message({ variant: 'error', description: `${feedback.name}: ${t(errorKey)}` })
+    }, [t])
     const commandLocks = useRef(new Set<string>())
     useEffect(() => {
         for (const [seatId, operationId] of Object.entries(pending)) {
-            if (
-                ['SUCCEEDED', 'FAILED'].includes(
-                    operations[operationId]?.status,
-                )
-            )
+            const operation = operations[operationId]
+            if (operation?.status === 'FAILED') {
+                notifyCommandError(operationId, getDshRequestErrorKey(operation) ?? 'dsh.FAILED')
+            }
+            if (['SUCCEEDED', 'FAILED'].includes(operation?.status)) {
                 commandLocks.current.delete(seatId)
+                commandFeedback.current.delete(operationId)
+            }
         }
-    }, [pending, operations])
+    }, [pending, operations, notifyCommandError])
     useEffect(() => {
         const normalizedKeyword = keyword.trim() || undefined
         if (normalizedKeyword === query.keyword) return
@@ -101,18 +110,17 @@ export function SeatsView({
                     return
                 }
                 const operationId = createDshOperationId()
+                commandFeedback.current.set(operationId, {
+                    name: item.display_name || item.username || item.user_id,
+                    errors: new Set(),
+                })
                 commandLocks.current.add(item.seat_id)
                 setPending((old) => ({ ...old, [item.seat_id]: operationId }))
                 const ref: DshOperationRef = {
                     operation_id: operationId,
                     tenant_id: item.tenant_id,
                 }
                 ref.retry = async () => {
-                    setCommandErrors((old) => {
-                        const nextErrors = { ...old }
-                        delete nextErrors[item.seat_id]
-                        return nextErrors
-                    })
                     try {
                         onOperation(
                             ref,
@@ -128,14 +136,12 @@ export function SeatsView({
                         const rejected = isDshRequestRejected(failure)
                         const errorKey = getDshRequestErrorKey(failure)
                         if (errorKey || rejected) {
-                            setCommandErrors((old) => ({
-                                ...old,
-                                [item.seat_id]: errorKey ?? 'dsh.rejected',
-                            }))
+                            notifyCommandError(operationId, errorKey ?? 'dsh.rejected')
                         }
                         if (rejected) {
                             onOperation({ ...ref, rejected: true })
                             commandLocks.current.delete(item.seat_id)
+                            commandFeedback.current.delete(operationId)
                             setPending((old) => {
                                 const nextPending = { ...old }
                                 delete nextPending[item.seat_id]
@@ -151,7 +157,7 @@ export function SeatsView({
         })
     }
     return (
-        <section className="space-y-4">
+        <section className="min-w-0 space-y-4">
             <div className="flex items-center justify-end gap-2">
                 <Input
                     boxClassName="w-56 shrink-0"
@@ -217,11 +223,6 @@ export function SeatsView({
                             {data.items.map((item) => {
                                 const operation =
                                     operations[pending[item.seat_id]]
-                                const command
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSeats.test.tsx` (modified, +39/-9)
```diff
@@ -1,6 +1,8 @@
 import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import { SeatsView } from './SeatsView'
+import { message } from '@/components/bs-ui/toast/use-toast'
+import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import { useState } from 'react'
 import {
     getDshSeats,
@@ -16,9 +18,9 @@ vi.mock('@/controllers/API/dsh', async (importOriginal) => ({
     commandDshSeat: vi.fn(),
 }))
 vi.mock('@/components/bs-ui/alertDialog/useConfirm', () => ({
-    bsConfirm: ({ onOk }: { onOk: (next: () => void) => void }) =>
-        onOk(() => {}),
+    bsConfirm: vi.fn(),
 }))
+vi.mock('@/components/bs-ui/toast/use-toast', () => ({ message: vi.fn() }))
 function seat(id: number): DshSeat {
     return {
         seat_id: `seat${id}`,
@@ -40,6 +42,7 @@ function seat(id: number): DshSeat {
 beforeEach(() => {
     vi.resetAllMocks()
     vi.useRealTimers()
+    vi.mocked(bsConfirm).mockImplementation(({ onOk }) => onOk?.(() => {}))
 })
 afterEach(() => vi.unstubAllGlobals())
 describe('DSH seat pagination and commands', () => {
@@ -211,7 +214,7 @@ function SeatCommandHarness() {
 }
 
 it.each(['receipt', 'http', 'business'])(
-    'shows seat capacity from a %s failure beside the seat and unlocks a fresh retry',
+    'shows seat capacity from a %s failure in a toast and unlocks a fresh retry',
     async (source) => {
         vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
         if (source === 'receipt') {
@@ -224,20 +227,26 @@ it.each(['receipt', 'http', 'business'])(
         }
         const { unmount } = render(<SeatCommandHarness />)
         fireEvent.click(await screen.findByRole('button', { name: 'dsh.reassign' }))
-        expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
-        expect(screen.getByRole('alert').closest('tr')).toHaveTextContent('dsh.REVOKED')
+        await waitFor(() => expect(message).toHaveBeenCalledExactlyOnceWith({ variant: 'error', description: 'User 1: dsh.seatLimitGrantHelp' }))
+        expect(screen.queryByRole('alert')).toBeNull()
+        expect(screen.getByRole('table')).not.toHaveTextContent('dsh.seatLimitGrantHelp')
         expect(screen.getByRole('button', { name: 'dsh.reassign' })).toBeEnabled()
         const previousId = vi.mocked(commandDshSeat).mock.calls[0][3]
         vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'SUCCEEDED', result_code: null } as DshOperation)
         fireEvent.click(screen.getByRole('button', { name: 'dsh.reassign' }))
         await waitFor(() => expect(commandDshSeat).toHaveBeenCalledTimes(2))
         expect(vi.mocked(commandDshSeat).mock.calls[1][3]).not.toBe(previousId)
+        expect(message).toHaveBeenCalledTimes(1)
         expect(screen.queryByRole('alert')).toBeNull()
+        vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation)
+        fireEvent.click(screen.getByRole('button', { name: 'dsh.reassign' }))
+        await waitFor(() => expect(message).toHaveBeenCalledTimes(2))
+        expect(vi.mocked(commandDshSeat).mock.calls[2][3]).not.toBe(previousId)
         unmount()
     },
 )
 
-it('shows a capacity failure delivered after an operation was accepted', async () => {
+it('toasts a delayed capacity failure once across polling and page refreshes', async () => {
     vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
     vi.mocked(commandDshSeat).mockResolvedValue({ status: 'PROCESSING' } as DshOperation)
     const onOperation = vi.fn()
@@ -247,24 +256,45 @@ it('shows a capacity failure delivered after an operation was accepted', async (
     expect(screen.queryByRole('alert')).toBeNull()
     const id = vi.mocked(commandDshSeat).mock.calls[0][3]
     rerender(<SeatsView operations={{ [id]: { status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation }} revision={0} onOperation={onOperation} />)
-    expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
+    await waitFor(() => expect(message).toHaveBeenCalledExactlyOnceWith({ variant: 'error', description: 'User 1: dsh.seatLimitGrantHelp' }))
     expect(screen.getByRole('button', { name: 'dsh.reassign' })).toBeEnabled()
+    rerender(<SeatsView operations={{ [id]: { status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation }} revision={1} onOperation={onOperation} />)
+    await screen.findByText('User 1')
+    expect(message).toHaveBeenCalledTimes(1)
+    expect(screen.queryByRole('alert')).toBeNull()
     unmount()
 })
 
-it('shows a service error while preserving the pending operation and clears it on confirmed success', async () => {
+it('toasts a service error once while preserving the pending operation until confirmed success'
```

**File**: `src/frontend/platform/src/utils/dshRequestError.test.ts` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ vi.mock('@/controllers/request', () => ({ default: {} }))
 describe('DSH management error messages', () => {
     it.each([
         [26112, 'dsh.seatLimitGrantHelp'],
+        [26113, 'dsh.seatRevokedGrantHelp'],
         [11001, 'api_errors:11001'],
         [26115, 'api_errors:26115'],
         [26125, 'api_errors:26125'],
@@ -16,6 +17,7 @@ describe('DSH management error messages', () => {
     })
     it.each([
         ['seat_limit_reached', 'dsh.seatLimitGrantHelp'],
+        ['seat_revoked', 'dsh.seatRevokedGrantHelp'],
         ['license_expired', 'api_errors:26115'],
         ['authorization_unavailable', 'api_errors:26125'],
         ['authorization_conflict', 'api_errors:26120'],
```

---

### Incident Patch 2: `26d23c62` (2026-09-22)
**Commit Message**: fix(dsh): show seat command failures in a transient toast

**File**: `docs/STATUS.md` (modified, +4/-3)
```diff
@@ -1,8 +1,9 @@
 # DSH 企业后台交付状态
 
-- 2026-09-22：跟进 #2433 的布局与提示验收反馈。席位操作错误移至表格上方并在滚动时保持可见，附用户名称，操作列保持按钮宽度；已撤销席位的管理提示改为明确的重新分配步骤。批量容量错误需配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
-  - 验证：DSH 前端回归、全量平台 lint、467 文件严格类型检查和生产构建通过；实际 React 组件模拟接口的浏览器验收中，7 列宽度在提示前后完全一致，滚动到底部仍能看到提示。
-  - 本条提交时：109 后续部署和真实登录态验收待执行。
+- 2026-09-22：跟进 #2433 的席位反馈验收。确认“重新分配”后，失败原因以“用户名 + 原因”的单个 toast 展示，约 4 秒自动消失；每次操作的同一失败只提示一次，新操作可再次提示。表格保持原列宽。已撤销席位的管理提示提供明确的重新分配步骤。批量容量错误配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
+  - 自动化：39 文件 / 333 项 DSH 前端回归、平台全量 lint、467 文件严格类型检查、生产构建、i18n 校验和架构守卫通过。
+  - 浏览器：实际 React 组件配合模拟失败回执，确认后显示 toast，随后自动消失；7 列宽度在显示前、显示中和消失后完全一致。
+  - 109：此前 Gateway 容量修复已部署，根部门及子部门保存均返回 seat_limit_reached，席位和额度保持原值；本条提交时 toast 前端发布待执行，现场席位为 8/10，真实满席点击复验为 NOT_RUN。
 
 - 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
   - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/SeatsView.tsx` (modified, +23/-36)
```diff
@@ -1,5 +1,6 @@
 import { Button } from '@/components/bs-ui/button'
 import { Input } from '@/components/bs-ui/input'
+import { message } from '@/components/bs-ui/toast/use-toast'
 import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import {
     Table,
@@ -22,7 +23,7 @@ import type {
     DshSeat,
     DshSeatQuery,
 } from '@/types/dsh'
-import { useEffect, useRef, useState } from 'react'
+import { useCallback, useEffect, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { createDshOperationId } from '@/util/dshOperationId'
 import { DshChoice, DshPager, dshTime } from './common'
@@ -44,18 +45,26 @@ export function SeatsView({
     const [data, setData] = useState<DshPage<DshSeat> | null>(null)
     const [error, setError] = useState(false)
     const [pending, setPending] = useState<Record<string, string>>({})
-    const [commandErrors, setCommandErrors] = useState<Record<string, string>>({})
+    const commandFeedback = useRef(new Map<string, { name: string; errors: Set<string> }>())
+    const notifyCommandError = useCallback((operationId: string, errorKey: string) => {
+        const feedback = commandFeedback.current.get(operationId)
+        if (!feedback || feedback.errors.has(errorKey)) return
+        feedback.errors.add(errorKey)
+        message({ variant: 'error', description: `${feedback.name}: ${t(errorKey)}` })
+    }, [t])
     const commandLocks = useRef(new Set<string>())
     useEffect(() => {
         for (const [seatId, operationId] of Object.entries(pending)) {
-            if (
-                ['SUCCEEDED', 'FAILED'].includes(
-                    operations[operationId]?.status,
-                )
-            )
+            const operation = operations[operationId]
+            if (operation?.status === 'FAILED') {
+                notifyCommandError(operationId, getDshRequestErrorKey(operation) ?? 'dsh.FAILED')
+            }
+            if (['SUCCEEDED', 'FAILED'].includes(operation?.status)) {
                 commandLocks.current.delete(seatId)
+                commandFeedback.current.delete(operationId)
+            }
         }
-    }, [pending, operations])
+    }, [pending, operations, notifyCommandError])
     useEffect(() => {
         const normalizedKeyword = keyword.trim() || undefined
         if (normalizedKeyword === query.keyword) return
@@ -101,18 +110,17 @@ export function SeatsView({
                     return
                 }
                 const operationId = createDshOperationId()
+                commandFeedback.current.set(operationId, {
+                    name: item.display_name || item.username || item.user_id,
+                    errors: new Set(),
+                })
                 commandLocks.current.add(item.seat_id)
                 setPending((old) => ({ ...old, [item.seat_id]: operationId }))
                 const ref: DshOperationRef = {
                     operation_id: operationId,
                     tenant_id: item.tenant_id,
                 }
                 ref.retry = async () => {
-                    setCommandErrors((old) => {
-                        const nextErrors = { ...old }
-                        delete nextErrors[item.seat_id]
-                        return nextErrors
-                    })
                     try {
                         onOperation(
                             ref,
@@ -128,14 +136,12 @@ export function SeatsView({
                         const rejected = isDshRequestRejected(failure)
                         const errorKey = getDshRequestErrorKey(failure)
                         if (errorKey || rejected) {
-                            setCommandErrors((old) => ({
-                                ...old,
-                                [item.seat_id]: errorKey ?? 'dsh.rejected',
-                            }))
+                            notifyCommandError(operationId, errorKey ?? 'dsh.rejected')
                         }
                         if (rejected) {
                             onOperation({ ...ref, rejected: true })
                             commandLocks.current.delete(item.seat_id)
+                            commandFeedback.current.delete(operationId)
                             setPending((old) => {
                                 const nextPending = { ...old }
                                 delete nextPending[item.seat_id]
@@ -150,15 +156,6 @@ export function SeatsView({
             },
         })
     }
-    const feedback = (data?.items ?? []).flatMap((item) => {
-        const operation = operations[pending[item.seat_id]]
-        const errorKey = operation?.status === 'FAILED'
-            ? getDshRequestErrorKey(operation) ?? 'dsh.FAILED'
-            : operation?.status === 'SUCCEEDED'
-                ? undefined
-                : commandErrors[item.seat_id]
-        return errorKey ? [{ item, errorKey }] : []
-    })
     return (
         <section className="min-w-0 space-y-4">
         
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSeats.test.tsx` (modified, +38/-10)
```diff
@@ -1,6 +1,8 @@
 import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import { SeatsView } from './SeatsView'
+import { message } from '@/components/bs-ui/toast/use-toast'
+import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import { useState } from 'react'
 import {
     getDshSeats,
@@ -16,9 +18,9 @@ vi.mock('@/controllers/API/dsh', async (importOriginal) => ({
     commandDshSeat: vi.fn(),
 }))
 vi.mock('@/components/bs-ui/alertDialog/useConfirm', () => ({
-    bsConfirm: ({ onOk }: { onOk: (next: () => void) => void }) =>
-        onOk(() => {}),
+    bsConfirm: vi.fn(),
 }))
+vi.mock('@/components/bs-ui/toast/use-toast', () => ({ message: vi.fn() }))
 function seat(id: number): DshSeat {
     return {
         seat_id: `seat${id}`,
@@ -40,6 +42,7 @@ function seat(id: number): DshSeat {
 beforeEach(() => {
     vi.resetAllMocks()
     vi.useRealTimers()
+    vi.mocked(bsConfirm).mockImplementation(({ onOk }) => onOk?.(() => {}))
 })
 afterEach(() => vi.unstubAllGlobals())
 describe('DSH seat pagination and commands', () => {
@@ -211,7 +214,7 @@ function SeatCommandHarness() {
 }
 
 it.each(['receipt', 'http', 'business'])(
-    'shows seat capacity from a %s failure above the table and unlocks a fresh retry',
+    'shows seat capacity from a %s failure in a toast and unlocks a fresh retry',
     async (source) => {
         vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
         if (source === 'receipt') {
@@ -224,22 +227,26 @@ it.each(['receipt', 'http', 'business'])(
         }
         const { unmount } = render(<SeatCommandHarness />)
         fireEvent.click(await screen.findByRole('button', { name: 'dsh.reassign' }))
-        expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
-        expect(screen.getByRole('alert')).toHaveTextContent('User 1')
-        expect(screen.getByRole('alert').closest('table')).toBeNull()
+        await waitFor(() => expect(message).toHaveBeenCalledExactlyOnceWith({ variant: 'error', description: 'User 1: dsh.seatLimitGrantHelp' }))
+        expect(screen.queryByRole('alert')).toBeNull()
         expect(screen.getByRole('table')).not.toHaveTextContent('dsh.seatLimitGrantHelp')
         expect(screen.getByRole('button', { name: 'dsh.reassign' })).toBeEnabled()
         const previousId = vi.mocked(commandDshSeat).mock.calls[0][3]
         vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'SUCCEEDED', result_code: null } as DshOperation)
         fireEvent.click(screen.getByRole('button', { name: 'dsh.reassign' }))
         await waitFor(() => expect(commandDshSeat).toHaveBeenCalledTimes(2))
         expect(vi.mocked(commandDshSeat).mock.calls[1][3]).not.toBe(previousId)
+        expect(message).toHaveBeenCalledTimes(1)
         expect(screen.queryByRole('alert')).toBeNull()
+        vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation)
+        fireEvent.click(screen.getByRole('button', { name: 'dsh.reassign' }))
+        await waitFor(() => expect(message).toHaveBeenCalledTimes(2))
+        expect(vi.mocked(commandDshSeat).mock.calls[2][3]).not.toBe(previousId)
         unmount()
     },
 )
 
-it('shows a capacity failure delivered after an operation was accepted', async () => {
+it('toasts a delayed capacity failure once across polling and page refreshes', async () => {
     vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
     vi.mocked(commandDshSeat).mockResolvedValue({ status: 'PROCESSING' } as DshOperation)
     const onOperation = vi.fn()
@@ -249,24 +256,45 @@ it('shows a capacity failure delivered after an operation was accepted', async (
     expect(screen.queryByRole('alert')).toBeNull()
     const id = vi.mocked(commandDshSeat).mock.calls[0][3]
     rerender(<SeatsView operations={{ [id]: { status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation }} revision={0} onOperation={onOperation} />)
-    expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
+    await waitFor(() => expect(message).toHaveBeenCalledExactlyOnceWith({ variant: 'error', description: 'User 1: dsh.seatLimitGrantHelp' }))
     expect(screen.getByRole('button', { name: 'dsh.reassign' })).toBeEnabled()
+    rerender(<SeatsView operations={{ [id]: { status: 'FAILED', result_code: 'seat_limit_reached' } as DshOperation }} revision={1} onOperation={onOperation} />)
+    await screen.findByText('User 1')
+    expect(message).toHaveBeenCalledTimes(1)
+    expect(screen.queryByRole('alert')).toBeNull()
     unmount()
 })
 
-it('shows a service error while preserving the pending operation and clears it on confirmed success', async () => {
+it('toasts a service error once while prese
```

---

### Incident Patch 3: `8a5e541a` (2026-09-22)
**Commit Message**: fix(dsh): keep seat feedback outside table columns

**File**: `docs/STATUS.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：跟进 #2433 的布局与提示验收反馈。席位操作错误移至表格上方并在滚动时保持可见，附用户名称，操作列保持按钮宽度；已撤销席位的管理提示改为明确的重新分配步骤。批量容量错误需配套 [Gateway #6](https://github.com/dataelement/bisheng-gateway/pull/6)：新增和待恢复成员统一计入所需席位，容量不足统一返回 seat_limit_reached。
+  - 验证：DSH 前端回归、全量平台 lint、467 文件严格类型检查和生产构建通过；实际 React 组件模拟接口的浏览器验收中，7 列宽度在提示前后完全一致，滚动到底部仍能看到提示。
+  - 本条提交时：109 后续部署和真实登录态验收待执行。
+
 - 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
   - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
   - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-0)
```diff
@@ -2405,6 +2405,7 @@
     "userMonthlyLimit": "Monthly token quota for {{name}}",
     "seatLimitTitle": "Insufficient seats",
     "seatLimitGrantHelp": "Not enough seats. This authorization was not applied. Add seats or release existing seats, then try again.",
+    "seatRevokedGrantHelp": "Selected members include revoked seats. Reassign their seats in License & seats, then save the authorization.",
     "goToLicenseAndSeats": "Go to license & seats",
     "userUsage": "Usage statistics",
     "usageScope": "Select a user in the current tenant to view token usage, messages, and completed Q&A over a time range.",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} の月間トークン上限",
     "seatLimitTitle": "シート不足",
     "seatLimitGrantHelp": "シート数が不足しているため、権限は反映されませんでした。シートを追加するか、既存のシートを解放して再試行してください。",
+    "seatRevokedGrantHelp": "選択したメンバーに取り消されたシートがあります。「ライセンスとシート」で再割り当てしてから、権限を保存してください。",
     "goToLicenseAndSeats": "ライセンスとシートへ",
     "userUsage": "使用統計",
     "usageScope": "現在のテナントからユーザーを選択し、期間内のトークン使用量、メッセージ数、完了した Q&A を確認します。",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-0)
```diff
@@ -2350,6 +2350,7 @@
     "userMonthlyLimit": "{{name}} 每月 Token 额度",
     "seatLimitTitle": "席位不足",
     "seatLimitGrantHelp": "席位不足，本次授权未生效。请扩充席位或释放已有席位后重试。",
+    "seatRevokedGrantHelp": "所选成员包含已撤销席位，请先在“授权与席位”中重新分配，再保存授权。",
     "goToLicenseAndSeats": "前往授权与席位",
     "userUsage": "使用统计",
     "usageScope": "选择当前租户的用户，查看指定时间范围内的 Token 用量、消息数和问答次数。",
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessErrors.test.tsx` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@ afterEach(() => {
 
 it.each([
     [26112, 'dsh.seatLimitGrantHelp'],
+    [26113, 'dsh.seatRevokedGrantHelp'],
     [11001, 'api_errors:11001'],
     [26115, 'api_errors:26115'],
     [26125, 'api_errors:26125'],
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/SeatsView.tsx` (modified, +20/-11)
```diff
@@ -150,8 +150,17 @@ export function SeatsView({
             },
         })
     }
+    const feedback = (data?.items ?? []).flatMap((item) => {
+        const operation = operations[pending[item.seat_id]]
+        const errorKey = operation?.status === 'FAILED'
+            ? getDshRequestErrorKey(operation) ?? 'dsh.FAILED'
+            : operation?.status === 'SUCCEEDED'
+                ? undefined
+                : commandErrors[item.seat_id]
+        return errorKey ? [{ item, errorKey }] : []
+    })
     return (
-        <section className="space-y-4">
+        <section className="min-w-0 space-y-4">
             <div className="flex items-center justify-end gap-2">
                 <Input
                     boxClassName="w-56 shrink-0"
@@ -189,6 +198,16 @@ export function SeatsView({
                     }
                 />
             </div>
+            {feedback.length > 0 && (
+                <div className="sticky top-0 z-10 space-y-2">
+                    {feedback.map(({ item, errorKey }) => (
+                        <div key={item.seat_id} role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950">
+                            <span className="break-words font-medium">{item.display_name || item.username || item.user_id}: </span>
+                            {t(errorKey)}
+                        </div>
+                    ))}
+                </div>
+            )}
             {!data ? (
                 <p role="status">
                     {t(error ? 'dsh.unavailable' : 'dsh.loading')}
@@ -217,11 +236,6 @@ export function SeatsView({
                             {data.items.map((item) => {
                                 const operation =
                                     operations[pending[item.seat_id]]
-                                const commandError = operation?.status === 'FAILED'
-                                    ? getDshRequestErrorKey(operation) ?? 'dsh.FAILED'
-                                    : operation?.status === 'SUCCEEDED'
-                                        ? undefined
-                                        : commandErrors[item.seat_id]
                                 const busy =
                                     !!pending[item.seat_id] &&
                                     (!operation ||
@@ -279,11 +293,6 @@ export function SeatsView({
                                                     )}
                                                 </Button>
                                             </div>
-                                            {commandError && (
-                                                <p role="alert" className="mt-1 max-w-xs text-xs text-red-600">
-                                                    {t(commandError)}
-                                                </p>
-                                            )}
                                         </TableCell>
                                     </TableRow>
                                 )
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSeats.test.tsx` (modified, +4/-2)
```diff
@@ -211,7 +211,7 @@ function SeatCommandHarness() {
 }
 
 it.each(['receipt', 'http', 'business'])(
-    'shows seat capacity from a %s failure beside the seat and unlocks a fresh retry',
+    'shows seat capacity from a %s failure above the table and unlocks a fresh retry',
     async (source) => {
         vi.mocked(getDshSeats).mockResolvedValue({ items: [{ ...seat(1), state: 'REVOKED' }], has_more: false, next_cursor: null })
         if (source === 'receipt') {
@@ -225,7 +225,9 @@ it.each(['receipt', 'http', 'business'])(
         const { unmount } = render(<SeatCommandHarness />)
         fireEvent.click(await screen.findByRole('button', { name: 'dsh.reassign' }))
         expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
-        expect(screen.getByRole('alert').closest('tr')).toHaveTextContent('dsh.REVOKED')
+        expect(screen.getByRole('alert')).toHaveTextContent('User 1')
+        expect(screen.getByRole('alert').closest('table')).toBeNull()
+        expect(screen.getByRole('table')).not.toHaveTextContent('dsh.seatLimitGrantHelp')
         expect(screen.getByRole('button', { name: 'dsh.reassign' })).toBeEnabled()
         const previousId = vi.mocked(commandDshSeat).mock.calls[0][3]
         vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'SUCCEEDED', result_code: null } as DshOperation)
```

**File**: `src/frontend/platform/src/utils/dshRequestError.test.ts` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ vi.mock('@/controllers/request', () => ({ default: {} }))
 describe('DSH management error messages', () => {
     it.each([
         [26112, 'dsh.seatLimitGrantHelp'],
+        [26113, 'dsh.seatRevokedGrantHelp'],
         [11001, 'api_errors:11001'],
         [26115, 'api_errors:26115'],
         [26125, 'api_errors:26125'],
@@ -16,6 +17,7 @@ describe('DSH management error messages', () => {
     })
     it.each([
         ['seat_limit_reached', 'dsh.seatLimitGrantHelp'],
+        ['seat_revoked', 'dsh.seatRevokedGrantHelp'],
         ['license_expired', 'api_errors:26115'],
         ['authorization_unavailable', 'api_errors:26125'],
         ['authorization_conflict', 'api_errors:26120'],
```

---

### Incident Patch 4: `862511ba` (2026-09-22)
**Commit Message**: fix(dsh): 修正授权失败反馈和用户名搜索提示 (#2433)

满席恢复授权时，Gateway 会返回 HTTP 200 内的 `FAILED / seat_limit_reached`
操作回执。席位列表此前只更新内部状态，模型额度弹窗统一显示“授权未完成，请重试”，具体失败原因没有展示。部门和个人额度保存也会把授权过期、服务不可用等已知错误归为“保存失败”。

本 PR：
- “重新分配”和“重新授权”在对应用户旁显示明确的席位不足提示，给出扩容或释放已有席位的处理方式。
- 部门/个人额度保存与恢复授权共用错误码解析，显示已知的授权过期、服务异常、版本冲突等原因；文案复用共享错误码目录。
- 确定失败后允许新操作 ID 重试；结果待确认时保留原操作 ID，后续查询到成功时清除旧错误。
- 模型额度搜索框改为“搜索用户名”，同步中英日文案。
- 更新状态记录及回归用例，并同步现有 `silent` 请求参数的测试断言。

验证：
- 32 个测试文件、283 项 DSH 回归通过，覆盖即时/延迟回执、连接中断后确认、确定失败后的成功重试和服务错误。
- 部门保存用例经过实际 API 函数和 HTTP 拦截器，验证席位不足、软件/DSH 授权过期、授权服务异常和版本冲突的提示。
- 管理端 lint、严格类型检查、生产构建，以及 i18n、生成文案、架构守卫和 diff 检查通过。客户端与共享包的
lint、类型检查也已在本 PR 中通过。
- 基线：`feat/3.0.0-beta2-pre@a0bd8c7684c01f3d66adc0a2b1b5c86b3b5a1048`。

验收边界：部署、登录态浏览器及真实 Gateway 联调为 `NOT_RUN`。同事测试环境的部门保存失败请求实际响应待采集，具体原因待确认。


提测：占满席位后分别恢复已撤销用户，确认显示席位不足且授权状态保持；释放席位后重试，确认成功、提示消失、统计刷新。另验证部门保存时的过期/服务异常提示及“搜索用户名”文案。

**File**: `docs/STATUS.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
+  - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
+  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
+
 - 2026-09-20：上游 PR 候选基于 `feat/3.0.0-beta2-pre@dff62d251`，完整保留企业后台整合，并纳入授权树加载稳定性与模型展示名称修复。753 项相关测试、双前端构建及定向检查通过；管理端全量类型检查有两项上游既有错误，真库与登录态验收为 `NOT_RUN`。完整范围、来源和迁移说明见 [上游交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/upstream-pr-delivery.md)。
 
 - 2026-09-20：模型目录和管理端共用展示名称规则，优先采用管理员配置的 `name`，空白名称使用调用名称 `model_name`。内部模型 ID 继续用于调用、权限和额度。定向回归 48 项通过、2 项 Redis 用例按环境跳过，16 项外部数据库变体排除；Ruff 和架构守卫通过。执行方式与环境边界见 [模型名称修复验证](../features/v3.0.0-beta2/062-dsh-desktop-model-access/model-display-verification.md)。
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-1)
```diff
@@ -2116,7 +2116,7 @@
     "noWebSnapshot": "No web snapshot yet — check the stored text or open the source page."
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "Search department, user or ID",
+    "searchUsername": "Search username",
     "departmentAndMember": "Department / member",
     "configuredQuota": "Quota (Token/month)",
     "configuredQuotaWan": "Quota (10k Token/month)",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "ウェブスナップショットがありません。登録テキストを確認するか、元のページを開いてください。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "部門・ユーザー・IDを検索",
+    "searchUsername": "ユーザー名で検索",
     "departmentAndMember": "部門 / メンバー",
     "configuredQuota": "設定枠（Token/月）",
     "configuredQuotaWan": "設定枠（万 Token/月）",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "暂无网页快照，请查看入库文本或打开原网页。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "搜索部门、用户或 ID",
+    "searchUsername": "搜索用户名",
     "departmentAndMember": "部门 / 成员",
     "configuredQuota": "设置额度（Token/月）",
     "configuredQuotaWan": "设置额度（万 Token/月）",
```

**File**: `src/frontend/platform/src/controllers/API/dsh.test.ts` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ describe('DSH API contract boundaries', () => {
         expect(request.put).toHaveBeenLastCalledWith(
             '/api/v1/dsh/admin/models/7/subjects/DEPARTMENT/10/policy',
             body,
-            { params: { tenant_id: 2 }, preserveError: true },
+            { params: { tenant_id: 2 }, preserveError: true, silent: true },
         )
     })
     it('validates effective user permission sources and sends department membership filters', async () => {
```

**File**: `src/frontend/platform/src/controllers/API/dsh.ts` (modified, +3/-0)
```diff
@@ -703,6 +703,7 @@ export async function getDshOperation(
 }
 
 export function isDshRequestRejected(error: unknown): boolean {
+    if (isDshSeatLimitReached(error)) return true
     if (!error || typeof error !== 'object' || !('response' in error))
         return false
     const response = error.response
@@ -733,6 +734,8 @@ export function isDshSeatLimitReached(error: unknown): boolean {
         ? response.data : error
     if (!data || typeof data !== 'object') return false
     if ('status_code' in data && Number(data.status_code) === 26112) return true
+    if ('status' in data && data.status === 'FAILED' && 'result_code' in data)
+        return data.result_code === 'seat_limit_reached'
     const failure = 'error' in data ? data.error : data
     return !!failure && typeof failure === 'object'
         && 'code' in failure && failure.code === 'seat_limit_reached'
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatError.test.ts` (modified, +12/-1)
```diff
@@ -1,6 +1,6 @@
 import { describe, expect, it, vi } from 'vitest'
 vi.mock('@/controllers/request', () => ({ default: {} }))
-import { isDshSeatLimitReached } from './dsh'
+import { isDshRequestRejected, isDshSeatLimitReached } from './dsh'
 describe('seat capacity HTTP contract', () => {
     it('recognizes the DSH real HTTP error envelope', () => {
         expect(isDshSeatLimitReached({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
@@ -11,10 +11,21 @@ describe('seat capacity HTTP contract', () => {
     })
     it('recognizes a failed durable allocation receipt', () => {
         expect(isDshSeatLimitReached({ code: 'seat_limit_reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status: 'FAILED', result_code: 'seat_limit_reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status: 'FAILED', result_code: 'license_expired' })).toBe(false)
+        expect(isDshSeatLimitReached({ status: 'SUCCEEDED', result_code: null })).toBe(false)
     })
     it('distinguishes unrelated errors and supports the legacy envelope', () => {
         expect(isDshSeatLimitReached({ response: { data: { error: { code: 'license_expired' } } } })).toBe(false)
         expect(isDshSeatLimitReached({ response: { data: { status_code: 26112 } } })).toBe(true)
         expect(isDshSeatLimitReached(null)).toBe(false)
     })
+    it('treats capacity rejection as definitive while retaining uncertain requests', () => {
+        expect(isDshRequestRejected({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
+        expect(isDshRequestRejected({ status_code: 26112 })).toBe(true)
+        expect(isDshRequestRejected({ response: { status: 200, data: { status_code: 26112 } } })).toBe(true)
+        expect(isDshRequestRejected(new Error('connection lost'))).toBe(false)
+        expect(isDshRequestRejected({ response: { status: 503 } })).toBe(false)
+        expect(isDshRequestRejected({ response: { status: 403, data: { error: { code: 'permission_denied' } } } })).toBe(false)
+    })
 })
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatTransport.test.ts` (modified, +18/-1)
```diff
@@ -1,9 +1,26 @@
 import { describe, expect, it, vi } from 'vitest'
 vi.mock('@/components/bs-ui/toast/use-toast', () => ({ toast: vi.fn() }))
 import request from '@/controllers/request'
-import { isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
+import { commandDshSeat, isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
 
 describe('seat errors through the platform HTTP interceptor', () => {
+    it('exposes a failed reassign receipt from a successful HTTP response', async () => {
+        vi.stubGlobal('localStorage', { getItem: () => null })
+        const previous = request.defaults.adapter
+        const receipt = { operation_id: 'reassign-full', status: 'FAILED', result_code: 'seat_limit_reached' }
+        request.defaults.adapter = async (config) => ({
+            status: 200, statusText: 'OK', headers: {}, config,
+            data: { status_code: 200, data: receipt },
+        })
+        try {
+            const result = await commandDshSeat('20', '2', 'reassign', receipt.operation_id, 4)
+            expect(result).toEqual(receipt)
+            expect(isDshSeatLimitReached(result)).toBe(true)
+        } finally {
+            request.defaults.adapter = previous
+            vi.unstubAllGlobals()
+        }
+    })
     it('preserves capacity rejection from an HTTP 200 business response', async () => {
         vi.stubGlobal('localStorage', { getItem: () => null })
         const previous = request.defaults.adapter
```

---

### Incident Patch 5: `970efd0d` (2026-09-22)
**Commit Message**: fix(dsh): preserve management failure reasons and clarify username search

**File**: `docs/STATUS.md` (modified, +3/-3)
```diff
@@ -1,8 +1,8 @@
 # DSH 企业后台交付状态
 
-- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
-  - 自动化：30 个测试文件、260 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
-  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。
+- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。模型额度搜索框改为“搜索用户名”。部门和个人额度保存、重新授权统一按服务端错误码展示席位不足、授权过期、授权服务异常等原因，并在请求结果待确认时保留原操作 ID。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
+  - 自动化：32 个测试文件、283 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
+  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。测试环境的部门保存失败请求实际响应待采集，具体原因待确认。
 
 - 2026-09-20：上游 PR 候选基于 `feat/3.0.0-beta2-pre@dff62d251`，完整保留企业后台整合，并纳入授权树加载稳定性与模型展示名称修复。753 项相关测试、双前端构建及定向检查通过；管理端全量类型检查有两项上游既有错误，真库与登录态验收为 `NOT_RUN`。完整范围、来源和迁移说明见 [上游交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/upstream-pr-delivery.md)。
 
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-1)
```diff
@@ -2116,7 +2116,7 @@
     "noWebSnapshot": "No web snapshot yet — check the stored text or open the source page."
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "Search department, user or ID",
+    "searchUsername": "Search username",
     "departmentAndMember": "Department / member",
     "configuredQuota": "Quota (Token/month)",
     "configuredQuotaWan": "Quota (10k Token/month)",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "ウェブスナップショットがありません。登録テキストを確認するか、元のページを開いてください。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "部門・ユーザー・IDを検索",
+    "searchUsername": "ユーザー名で検索",
     "departmentAndMember": "部門 / メンバー",
     "configuredQuota": "設定枠（Token/月）",
     "configuredQuotaWan": "設定枠（万 Token/月）",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-1)
```diff
@@ -2061,7 +2061,7 @@
     "noWebSnapshot": "暂无网页快照，请查看入库文本或打开原网页。"
   },
   "dsh": {
-    "searchDepartmentsAndUsers": "搜索部门、用户或 ID",
+    "searchUsername": "搜索用户名",
     "departmentAndMember": "部门 / 成员",
     "configuredQuota": "设置额度（Token/月）",
     "configuredQuotaWan": "设置额度（万 Token/月）",
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/DepartmentAccessTree.test.tsx` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ it('selects another department and fetches its direct members', async () => {
 it('searches users across departments and shows their department names', async () => {
     render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
     await screen.findByText('Alice')
-    fireEvent.change(screen.getByLabelText('dsh.searchDepartmentsAndUsers'), { target: { value: 'Alice' } })
+    fireEvent.change(screen.getByLabelText('dsh.searchUsername'), { target: { value: 'Alice' } })
     await waitFor(() => expect(getDshModelUserPermissions).toHaveBeenCalledWith(7, expect.objectContaining({ keyword: 'Alice', department_id: undefined }), expect.any(AbortSignal)))
     expect(screen.getByRole('heading', { name: 'dsh.quotaSearchResults' })).toBeTruthy()
     expect(await screen.findByText('Alice')).toBeTruthy()
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessDialog.tsx` (modified, +7/-6)
```diff
@@ -3,7 +3,8 @@ import { Button, LoadButton } from '@/components/bs-ui/button'
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/bs-ui/dialog'
 import { Input } from '@/components/bs-ui/input'
 import { useToast } from '@/components/bs-ui/toast/use-toast'
-import { getDshModelSubjects, getDshModelUserPermissions, isDshSeatLimitReached, saveDshSubjectPolicy } from '@/controllers/API/dsh'
+import { getDshModelSubjects, getDshModelUserPermissions, saveDshSubjectPolicy } from '@/controllers/API/dsh'
+import { getDshRequestErrorKey } from '@/utils/dshRequestError'
 import type { DshModelUserPermission, DshSubjectPolicyInventory, DshSubjectPolicy } from '@/types/dsh'
 import { useCallback, useEffect, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
@@ -151,7 +152,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
                 description: t(complete ? 'dsh.policySaved' : 'dsh.policySaveFailed'),
             })
         } catch (error) {
-            const errorKey = isDshSeatLimitReached(error) ? 'dsh.seatLimitGrantHelp' : 'dsh.policySaveFailed'
+            const errorKey = getDshRequestErrorKey(error) ?? 'dsh.policySaveFailed'
             setSaveError(errorKey)
             setMembersVersion((value) => value + 1)
             message({ variant: 'error', description: t(errorKey) })
@@ -169,8 +170,8 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
             setInventory(await withinSaveDeadline(getDshModelSubjects(modelId)))
             setMembersVersion((value) => value + 1)
             setSaveError(null)
-        } catch {
-            setSaveError('dsh.policySaveFailed')
+        } catch (error) {
+            setSaveError(getDshRequestErrorKey(error) ?? 'dsh.policySaveFailed')
         } finally {
             busy.current = false
             setSaving(false)
@@ -206,8 +207,8 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
                         <div className="flex shrink-0 justify-end gap-2">
                             <Input
                                 boxClassName="w-72"
-                                aria-label={t('dsh.searchDepartmentsAndUsers')}
-                                placeholder={t('dsh.searchDepartmentsAndUsers')}
+                                aria-label={t('dsh.searchUsername')}
+                                placeholder={t('dsh.searchUsername')}
                                 value={query}
                                 disabled={saving}
                                 onChange={(event) => setQuery(event.target.value)}
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessErrors.test.tsx` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { fireEvent, render, screen, waitFor } from '@testing-library/react'
+import { afterEach, beforeEach, expect, it, vi } from 'vitest'
+import request from '@/controllers/request'
+import { getDshModelSubjects, getDshModelUserPermissions, getDshOperation, saveDshPolicy } from '@/controllers/API/dsh'
+import { ModelAccessDialog } from './ModelAccessDialog'
+
+vi.mock('@/components/bs-icons/loading/Load.svg?react', () => ({ default: () => <svg /> }))
+vi.mock('@/components/bs-ui/toast/use-toast', () => ({ useToast: () => ({ message: vi.fn() }), toast: vi.fn() }))
+vi.mock('@/controllers/API/dsh', async (importOriginal) => ({
+    ...await importOriginal<typeof import('@/controllers/API/dsh')>(),
+    getDshModelSubjects: vi.fn(), getDshModelUserPermissions: vi.fn(),
+    getDshOperation: vi.fn(), saveDshPolicy: vi.fn(),
+}))
+const model = { id: 7, name: 'Model' }
+const originalAdapter = request.defaults.adapter
+
+beforeEach(() => {
+    vi.resetAllMocks()
+    vi.stubGlobal('localStorage', { getItem: () => null })
+    vi.mocked(getDshModelSubjects).mockResolvedValue({
+        tenant_id: 2, model_id: 7, roles: [],
+        departments: [{
+            subject_type: 'DEPARTMENT', subject_id: 31, name: 'Organization',
+            parent_id: null, depth: 0, version: 1, enabled: false, monthly_token_limit: 0,
+        }],
+    })
+    vi.mocked(getDshModelUserPermissions).mockResolvedValue({
+        tenant_id: 2, model: { ...model, is_root_shared: false }, next_cursor: null, has_more: false,
+        items: [{
+            user_id: 20, user_name: 'Alice', direct_version: 0, direct_enabled: false,
+            direct_monthly_token_limit: 0, direct_pending_operation_id: null,
+            departments: [{ id: 31, name: 'Organization', is_primary: true }],
+            roles: [], authorized: false, monthly_token_limit: 0, sources: [], department_match: 'DIRECT',
+        }],
+    })
+})
+afterEach(() => {
+    request.defaults.adapter = originalAdapter
+    vi.unstubAllGlobals()
+})
+
+it.each([
+    [26112, 'dsh.seatLimitGrantHelp'],
+    [11001, 'api_errors:11001'],
+    [26115, 'api_errors:26115'],
+    [26125, 'api_errors:26125'],
+    [26130, 'api_errors:26130'],
+])('shows department save error %s through the real API and interceptor', async (code, key) => {
+    const adapter = vi.fn(async (config) => ({
+        status: 200, statusText: 'OK', headers: {}, config,
+        data: { status_code: code, status_message: 'Service rejected the request' },
+    }))
+    request.defaults.adapter = adapter
+    render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
+    fireEvent.click(await screen.findByRole('button', { name: 'Organization · dsh.editQuota' }))
+    const input = screen.getByLabelText('Organization · dsh.configuredQuotaWan')
+    fireEvent.change(input, { target: { value: '10000' } })
+    fireEvent.click(screen.getByRole('button', { name: 'save' }))
+    expect(await screen.findByRole('alert')).toHaveTextContent(key)
+    expect(adapter).toHaveBeenCalledOnce()
+    expect(adapter.mock.calls[0][0]).toMatchObject({
+        url: '/api/v1/dsh/admin/models/7/subjects/DEPARTMENT/31/policy',
+        method: 'put', silent: true,
+    })
+    expect(input).toHaveValue('10000')
+    expect(screen.getByRole('button', { name: 'save' })).toBeEnabled()
+})
+
+it('preserves an uncertain user operation while surfacing its service error', async () => {
+    const failure = { response: { status: 503, data: { error: { code: 'authorization_unavailable' } } } }
+    vi.mocked(saveDshPolicy).mockRejectedValue(failure)
+    vi.mocked(getDshOperation).mockRejectedValue(failure)
+    render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
+    fireEvent.click(await screen.findByRole('button', { name: 'Alice · dsh.editQuota' }))
+    fireEvent.change(screen.getByLabelText('Alice · dsh.configuredQuotaWan'), { target: { value: '1' } })
+    fireEvent.click(screen.getByRole('button', { name: 'save' }))
+    expect(await screen.findByRole('alert')).toHaveTextContent('api_errors:26125')
+    const operationId = vi.mocked(saveDshPolicy).mock.calls[0][3].operation_id
+    fireEvent.click(screen.getByRole('button', { name: 'save' }))
+    await waitFor(() => expect(getDshOperation).toHaveBeenCalledWith(operationId, '2', expect.any(AbortSignal)))
+    expect(await screen.findByRole('alert')).toHaveTextContent('api_errors:26125')
+    expect(saveDshPolicy).toHaveBeenCalledOnce()
+})
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessLayout.test.tsx` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ describe('model access layout', () => {
         )
         fireEvent.click(root)
         expect(screen.queryByText('Engineering')).toBeNull()
-        fireEvent.change(screen.getByRole('textbox', { name: 'dsh.searchDepartmentsAndUsers' }), {
+        fireEvent.change(screen.getByRole('textbox', { name: 'dsh.searchUsername' }), {
             target: { value: 'Platform' },
         })
         expect(screen.getByText('Organization')).toBeTruthy()
```

---

### Incident Patch 6: `80eee7c9` (2026-09-22)
**Commit Message**: fix(dsh): show seat capacity failures when restoring authorization

**File**: `docs/STATUS.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # DSH 企业后台交付状态
 
+- 2026-09-22：基于 `feat/3.0.0-beta2-pre@a0bd8c768` 修复满席恢复授权的反馈。席位列表“重新分配”和模型额度“重新授权”统一识别持久化操作回执的 `FAILED / seat_limit_reached`，在对应用户旁显示席位不足及扩容、释放席位的处理提示；确定失败后支持使用新操作 ID 重试，请求结果待确认时沿用原操作 ID 查询。新增回归覆盖即时回执、延迟结果、连接中断后确认、HTTP/业务错误和成功重试。
+  - 自动化：30 个测试文件、260 项 DSH 回归通过；前端工作区 lint、类型检查，管理端生产构建、i18n 校验和架构守卫通过。模型额度保存测试已同步当前 `silent` 请求参数。
+  - 真实环境：本次部署、登录态浏览器及真实 Gateway 满席/释放后重新授权验收为 `NOT_RUN`。
+
 - 2026-09-20：上游 PR 候选基于 `feat/3.0.0-beta2-pre@dff62d251`，完整保留企业后台整合，并纳入授权树加载稳定性与模型展示名称修复。753 项相关测试、双前端构建及定向检查通过；管理端全量类型检查有两项上游既有错误，真库与登录态验收为 `NOT_RUN`。完整范围、来源和迁移说明见 [上游交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/upstream-pr-delivery.md)。
 
 - 2026-09-20：模型目录和管理端共用展示名称规则，优先采用管理员配置的 `name`，空白名称使用调用名称 `model_name`。内部模型 ID 继续用于调用、权限和额度。定向回归 48 项通过、2 项 Redis 用例按环境跳过，16 项外部数据库变体排除；Ruff 和架构守卫通过。执行方式与环境边界见 [模型名称修复验证](../features/v3.0.0-beta2/062-dsh-desktop-model-access/model-display-verification.md)。
```

**File**: `src/frontend/platform/src/controllers/API/dsh.test.ts` (modified, +1/-1)
```diff
@@ -191,7 +191,7 @@ describe('DSH API contract boundaries', () => {
         expect(request.put).toHaveBeenLastCalledWith(
             '/api/v1/dsh/admin/models/7/subjects/DEPARTMENT/10/policy',
             body,
-            { params: { tenant_id: 2 }, preserveError: true },
+            { params: { tenant_id: 2 }, preserveError: true, silent: true },
         )
     })
     it('validates effective user permission sources and sends department membership filters', async () => {
```

**File**: `src/frontend/platform/src/controllers/API/dsh.ts` (modified, +3/-0)
```diff
@@ -703,6 +703,7 @@ export async function getDshOperation(
 }
 
 export function isDshRequestRejected(error: unknown): boolean {
+    if (isDshSeatLimitReached(error)) return true
     if (!error || typeof error !== 'object' || !('response' in error))
         return false
     const response = error.response
@@ -733,6 +734,8 @@ export function isDshSeatLimitReached(error: unknown): boolean {
         ? response.data : error
     if (!data || typeof data !== 'object') return false
     if ('status_code' in data && Number(data.status_code) === 26112) return true
+    if ('status' in data && data.status === 'FAILED' && 'result_code' in data)
+        return data.result_code === 'seat_limit_reached'
     const failure = 'error' in data ? data.error : data
     return !!failure && typeof failure === 'object'
         && 'code' in failure && failure.code === 'seat_limit_reached'
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatError.test.ts` (modified, +12/-1)
```diff
@@ -1,6 +1,6 @@
 import { describe, expect, it, vi } from 'vitest'
 vi.mock('@/controllers/request', () => ({ default: {} }))
-import { isDshSeatLimitReached } from './dsh'
+import { isDshRequestRejected, isDshSeatLimitReached } from './dsh'
 describe('seat capacity HTTP contract', () => {
     it('recognizes the DSH real HTTP error envelope', () => {
         expect(isDshSeatLimitReached({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
@@ -11,10 +11,21 @@ describe('seat capacity HTTP contract', () => {
     })
     it('recognizes a failed durable allocation receipt', () => {
         expect(isDshSeatLimitReached({ code: 'seat_limit_reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status: 'FAILED', result_code: 'seat_limit_reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status: 'FAILED', result_code: 'license_expired' })).toBe(false)
+        expect(isDshSeatLimitReached({ status: 'SUCCEEDED', result_code: null })).toBe(false)
     })
     it('distinguishes unrelated errors and supports the legacy envelope', () => {
         expect(isDshSeatLimitReached({ response: { data: { error: { code: 'license_expired' } } } })).toBe(false)
         expect(isDshSeatLimitReached({ response: { data: { status_code: 26112 } } })).toBe(true)
         expect(isDshSeatLimitReached(null)).toBe(false)
     })
+    it('treats capacity rejection as definitive while retaining uncertain requests', () => {
+        expect(isDshRequestRejected({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
+        expect(isDshRequestRejected({ status_code: 26112 })).toBe(true)
+        expect(isDshRequestRejected({ response: { status: 200, data: { status_code: 26112 } } })).toBe(true)
+        expect(isDshRequestRejected(new Error('connection lost'))).toBe(false)
+        expect(isDshRequestRejected({ response: { status: 503 } })).toBe(false)
+        expect(isDshRequestRejected({ response: { status: 403, data: { error: { code: 'permission_denied' } } } })).toBe(false)
+    })
 })
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatTransport.test.ts` (modified, +18/-1)
```diff
@@ -1,9 +1,26 @@
 import { describe, expect, it, vi } from 'vitest'
 vi.mock('@/components/bs-ui/toast/use-toast', () => ({ toast: vi.fn() }))
 import request from '@/controllers/request'
-import { isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
+import { commandDshSeat, isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
 
 describe('seat errors through the platform HTTP interceptor', () => {
+    it('exposes a failed reassign receipt from a successful HTTP response', async () => {
+        vi.stubGlobal('localStorage', { getItem: () => null })
+        const previous = request.defaults.adapter
+        const receipt = { operation_id: 'reassign-full', status: 'FAILED', result_code: 'seat_limit_reached' }
+        request.defaults.adapter = async (config) => ({
+            status: 200, statusText: 'OK', headers: {}, config,
+            data: { status_code: 200, data: receipt },
+        })
+        try {
+            const result = await commandDshSeat('20', '2', 'reassign', receipt.operation_id, 4)
+            expect(result).toEqual(receipt)
+            expect(isDshSeatLimitReached(result)).toBe(true)
+        } finally {
+            request.defaults.adapter = previous
+            vi.unstubAllGlobals()
+        }
+    })
     it('preserves capacity rejection from an HTTP 200 business response', async () => {
         vi.stubGlobal('localStorage', { getItem: () => null })
         const previous = request.defaults.adapter
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ReauthorizeSeat.test.tsx` (modified, +47/-1)
```diff
@@ -5,7 +5,10 @@ import { resolveOperation } from './useUserPolicyDrafts'
 import { ReauthorizeSeat, SeatRestoreContext } from './ReauthorizeSeat'
 vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
 vi.mock('@/components/bs-ui/alertDialog/useConfirm', () => ({ bsConfirm: ({onOk}: {onOk:(done:()=>void)=>void}) => onOk(()=>{}) }))
-vi.mock('@/controllers/API/dsh', () => ({ commandDshSeat: vi.fn(), getDshSeats: vi.fn(), isDshRequestRejected: () => false }))
+vi.mock('@/controllers/API/dsh', async (importOriginal) => ({
+    ...await importOriginal<typeof import('@/controllers/API/dsh')>(),
+    commandDshSeat: vi.fn(), getDshSeats: vi.fn(),
+}))
 vi.mock('./useUserPolicyDrafts', () => ({ resolveOperation: vi.fn(), withinSaveDeadline: (promise: Promise<unknown>) => promise }))
 const seat = { user_id: '20', tenant_id: '2', state: 'REVOKED', grant_version: 4 }
 function mount() {
@@ -40,3 +43,46 @@ it('resolves the original operation after an ambiguous response instead of issui
     expect(commandDshSeat).toHaveBeenCalledOnce()
     expect(resolveOperation).toHaveBeenCalledWith(vi.mocked(commandDshSeat).mock.calls[0][3],2)
 })
+
+it.each(['command', 'poll', 'recovery', 'http'])(
+    'shows capacity guidance from the %s response and permits a fresh authorization after failure',
+    async (source) => {
+        const failure = { status: 'FAILED', result_code: 'seat_limit_reached' }
+        vi.mocked(getDshSeats).mockResolvedValue({ items: [seat], has_more: false, next_cursor: null } as never)
+        if (source === 'command') vi.mocked(commandDshSeat).mockResolvedValueOnce(failure as never)
+        if (source === 'poll') {
+            vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'PROCESSING' } as never)
+            vi.mocked(resolveOperation).mockResolvedValueOnce(failure as never)
+        }
+        if (source === 'recovery') {
+            vi.mocked(commandDshSeat).mockRejectedValueOnce(new Error('connection lost'))
+            vi.mocked(resolveOperation).mockResolvedValueOnce(failure as never)
+        }
+        if (source === 'http') {
+            vi.mocked(commandDshSeat).mockRejectedValueOnce({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })
+        }
+        const done = mount()
+        fireEvent.click(screen.getByRole('button'))
+        if (source === 'recovery') {
+            await screen.findByText('dsh.reauthorizeFailed')
+            fireEvent.click(screen.getByRole('button'))
+        }
+        expect(await screen.findByRole('alert')).toHaveTextContent('dsh.seatLimitGrantHelp')
+        expect(screen.queryByText('dsh.reauthorizeFailed')).toBeNull()
+        expect(done).toHaveBeenCalledTimes(0)
+        const previousId = vi.mocked(commandDshSeat).mock.calls[0][3]
+        vi.mocked(commandDshSeat).mockResolvedValueOnce({ status: 'SUCCEEDED' } as never)
+        fireEvent.click(screen.getByRole('button'))
+        await waitFor(() => expect(done).toHaveBeenCalledOnce())
+        expect(vi.mocked(commandDshSeat).mock.calls[1][3]).not.toBe(previousId)
+        expect(screen.queryByRole('alert')).toBeNull()
+    },
+)
+it('keeps other authorization failures distinct from seat capacity', async () => {
+    vi.mocked(getDshSeats).mockResolvedValue({ items: [seat], has_more: false, next_cursor: null } as never)
+    vi.mocked(commandDshSeat).mockResolvedValue({ status: 'FAILED', result_code: 'license_expired' } as never)
+    const done = mount()
+    fireEvent.click(screen.getByRole('button'))
+    expect(await screen.findByRole('alert')).toHaveTextContent('dsh.reauthorizeFailed')
+    expect(done).toHaveBeenCalledTimes(0)
+})
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ReauthorizeSeat.tsx` (modified, +13/-7)
```diff
@@ -1,25 +1,31 @@
 import { bsConfirm } from '@/components/bs-ui/alertDialog/useConfirm'
 import { Button } from '@/components/bs-ui/button'
-import { commandDshSeat, getDshSeats, isDshRequestRejected } from '@/controllers/API/dsh'
+import { commandDshSeat, getDshSeats, isDshRequestRejected, isDshSeatLimitReached } from '@/controllers/API/dsh'
 import { createDshOperationId } from '@/util/dshOperationId'
 import { createContext, useContext, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { resolveOperation, withinSaveDeadline } from './useUserPolicyDrafts'
 
 export const SeatRestoreContext = createContext<{ tenantId: number; onRestored: () => void } | null>(null)
 
-export function ReauthorizeSeat({ userId, name, disabled }: { userId: number; name: string; disabled: boolean }) {
+interface ReauthorizeSeatProps {
+    userId: number
+    name: string
+    disabled: boolean
+}
+
+export function ReauthorizeSeat({ userId, name, disabled }: ReauthorizeSeatProps) {
     const { t } = useTranslation()
     const scope = useContext(SeatRestoreContext)
     const operation = useRef<string | null>(null)
     const locked = useRef(false)
     const [busy, setBusy] = useState(false)
-    const [error, setError] = useState(false)
+    const [error, setError] = useState<string | null>(null)
     async function restore() {
         if (!scope || locked.current) return
         locked.current = true
         setBusy(true)
-        setError(false)
+        setError(null)
         try {
             let result
             if (operation.current) {
@@ -38,10 +44,10 @@ export function ReauthorizeSeat({ userId, name, disabled }: { userId: number; na
             }
             operation.current = null
             if (result.status === 'SUCCEEDED') scope.onRestored()
-            else setError(true)
+            else setError(isDshSeatLimitReached(result) ? 'dsh.seatLimitGrantHelp' : 'dsh.reauthorizeFailed')
         } catch (failure) {
             if (isDshRequestRejected(failure)) operation.current = null
-            setError(true)
+            setError(isDshSeatLimitReached(failure) ? 'dsh.seatLimitGrantHelp' : 'dsh.reauthorizeFailed')
         } finally {
             locked.current = false
             setBusy(false)
@@ -60,7 +66,7 @@ export function ReauthorizeSeat({ userId, name, disabled }: { userId: number; na
             <Button size="sm" variant="outline" className="h-6 py-0 leading-none" disabled={disabled || busy || !scope} onClick={handleRestore}>
                 {t(busy ? 'dsh.reauthorizePending' : 'dsh.reauthorize')}
             </Button>
-            {error && <p role="alert" className="text-xs text-red-600">{t('dsh.reauthorizeFailed')}</p>}
+            {error && <p role="alert" className="text-xs text-red-600">{t(error)}</p>}
         </div>
     )
 }
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/SeatsView.tsx` (modified, +23/-0)
```diff
@@ -13,6 +13,7 @@ import {
     commandDshSeat,
     getDshSeats,
     isDshRequestRejected,
+    isDshSeatLimitReached,
 } from '@/controllers/API/dsh'
 import type {
     DshOperation,
@@ -43,6 +44,7 @@ export function SeatsView({
     const [data, setData] = useState<DshPage<DshSeat> | null>(null)
     const [error, setError] = useState(false)
     const [pending, setPending] = useState<Record<string, string>>({})
+    const [commandErrors, setCommandErrors] = useState<Record<string, string>>({})
     const commandLocks = useRef(new Set<string>())
     useEffect(() => {
         for (const [seatId, operationId] of Object.entries(pending)) {
@@ -100,6 +102,11 @@ export function SeatsView({
                 }
                 const operationId = createDshOperationId()
                 commandLocks.current.add(item.seat_id)
+                setCommandErrors((old) => {
+                    const nextErrors = { ...old }
+                    delete nextErrors[item.seat_id]
+                    return nextErrors
+                })
                 setPending((old) => ({ ...old, [item.seat_id]: operationId }))
                 const ref: DshOperationRef = {
                     operation_id: operationId,
@@ -119,6 +126,12 @@ export function SeatsView({
                         )
                     } catch (failure) {
                         if (isDshRequestRejected(failure)) {
+                            setCommandErrors((old) => ({
+                                ...old,
+                                [item.seat_id]: isDshSeatLimitReached(failure)
+                                    ? 'dsh.seatLimitGrantHelp'
+                                    : 'dsh.rejected',
+                            }))
                             onOperation({ ...ref, rejected: true })
                             commandLocks.current.delete(item.seat_id)
                             setPending((old) => {
@@ -202,6 +215,11 @@ export function SeatsView({
                             {data.items.map((item) => {
                                 const operation =
                                     operations[pending[item.seat_id]]
+                                const commandError = operation?.status === 'FAILED'
+                                    ? isDshSeatLimitReached(operation)
+                                        ? 'dsh.seatLimitGrantHelp'
+                                        : 'dsh.FAILED'
+                                    : commandErrors[item.seat_id]
                                 const busy =
                                     !!pending[item.seat_id] &&
                                     (!operation ||
@@ -259,6 +277,11 @@ export function SeatsView({
                                                     )}
                                                 </Button>
                                             </div>
+                                            {commandError && (
+                                                <p role="alert" className="mt-1 max-w-xs text-xs text-red-600">
+                                                    {t(commandError)}
+                                                </p>
+                                            )}
                                         </TableCell>
                                     </TableRow>
                                 )
```

---

### Incident Patch 7: `98a1f441` (2026-09-22)
**Commit Message**: fix(dsh): finish quota editing after restoring saved value

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessDialog.tsx` (modified, +7/-3)
```diff
@@ -81,6 +81,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
         )
     })
     const hasChanges = dirty.length > 0 || users.hasChanges
+    const canSave = hasChanges || users.hasPending || Object.keys(drafts).length > 0
     const valid = users.valid && dirty.every((item) => quotaValid(drafts[policyKey(item)].limit))
     const changeDepartment = (item: DshSubjectPolicy, value: string) => {
         setSaveError(null)
@@ -104,7 +105,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
         else onClose()
     }
     async function save() {
-        if (!modelId || !inventory || busy.current || !valid || (!hasChanges && !users.hasPending)) return
+        if (!modelId || !inventory || busy.current || !valid || !canSave) return
         busy.current = true
         setSaving(true)
         setSaveError(null)
@@ -140,7 +141,10 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
                 })
             }
             setMembersVersion((value) => value + 1)
-            if (complete) setSavedRevision((value) => value + 1)
+            if (complete) {
+                setDrafts({})
+                setSavedRevision((value) => value + 1)
+            }
             setSaveError(complete ? null : 'dsh.policySaveFailed')
             message({
                 variant: complete ? 'success' : 'error',
@@ -210,7 +214,7 @@ export function ModelAccessDialog({ model, onClose }: { model: DshAccessModel |
                             />
                             <LoadButton
                                 loading={saving}
-                                disabled={(!hasChanges && !users.hasPending) || !valid}
+                                disabled={!canSave || !valid}
                                 onClick={save}
                             >
                                 {t(saving ? 'dsh.savingPolicies' : 'save')}
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/ModelAccessLayout.test.tsx` (modified, +16/-0)
```diff
@@ -5,6 +5,7 @@ import {
     getDshModelUserPermissions,
     getDshOperation,
     saveDshPolicy,
+    saveDshSubjectPolicy,
 } from '@/controllers/API/dsh'
 import { ModelAccessDialog } from './ModelAccessDialog'
 import type { DshSubjectPolicyInventory, DshModelUserPermissionPage } from '@/types/dsh'
@@ -119,6 +120,21 @@ describe('model access layout', () => {
         expect(screen.getByText('Engineering')).toBeTruthy()
         expect(screen.getByText('Platform')).toBeTruthy()
     })
+    it('finishes editing after a rejected grant is changed back to zero', async () => {
+        vi.mocked(saveDshSubjectPolicy).mockRejectedValue({ status_code: 26112 })
+        render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
+        fireEvent.click(await screen.findByRole('button', { name: 'Organization · dsh.editQuota' }))
+        const input = screen.getByRole('textbox', { name: 'Organization · dsh.configuredQuotaWan' })
+        fireEvent.change(input, { target: { value: '1000' } })
+        fireEvent.click(screen.getByRole('button', { name: 'save' }))
+        await waitFor(() => expect(saveDshSubjectPolicy).toHaveBeenCalledTimes(1))
+        await waitFor(() => expect(screen.getByRole('button', { name: 'save' })).toBeEnabled())
+        fireEvent.change(input, { target: { value: '0' } })
+        fireEvent.click(screen.getByRole('button', { name: 'save' }))
+        await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Organization · dsh.configuredQuotaWan' })).toBeNull())
+        expect(saveDshSubjectPolicy).toHaveBeenCalledTimes(1)
+        expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
+    })
     it('keeps the single scrolling tree inside the bounded dialog', async () => {
         render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
         await screen.findByText('Engineering')
```

---

### Incident Patch 8: `e0266602` (2026-09-22)
**Commit Message**: fix(dsh): refresh seat totals on section navigation

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSettings.test.tsx` (modified, +13/-0)
```diff
@@ -65,6 +65,19 @@ describe('DSH deployment and business settings', () => {
         expect(screen.queryByText('seat-content')).toBeNull()
     })
 
+    it('refreshes assigned seats when returning from model authorization', async () => {
+        vi.mocked(getDshBrowserConfig).mockResolvedValue({ management_enabled: true, enabled: true, download_url: null, launch_url: 'dsh-desktop://login' })
+        const snapshot = { status: 'active', seat_limit: 10, assigned: 2, available: 8, as_of: '', expires_at: null, license_id: 'test' }
+        vi.mocked(getDshLicense).mockResolvedValue(snapshot)
+        const view = render(<DshManagement section="license" />)
+        expect(await screen.findByText('Seats 2 / 10')).toBeInTheDocument()
+        view.rerender(<DshManagement section="models" />)
+        await screen.findByText('model-content')
+        vi.mocked(getDshLicense).mockResolvedValue({ ...snapshot, assigned: 3, available: 7 })
+        view.rerender(<DshManagement section="license" />)
+        expect(await screen.findByText('Seats 3 / 10')).toBeInTheDocument()
+    })
+
     it('keeps settings accessible while business is disabled and avoids license/seat calls', async () => {
         render(<DshManagement />)
         await screen.findByRole('textbox', { name: /dsh.launchAddress/ })
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/index.tsx` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ function DshManagementContent({
                 if (!abort.signal.aborted) setLicenseError(true)
             })
         return () => abort.abort()
-    }, [config.enabled, revision])
+    }, [config.enabled, revision, activeSection])
 
     const handleOperation = useCallback(
         (ref: DshOperationRef, result?: DshOperation) => {
```

---

### Incident Patch 9: `4a52649b` (2026-09-22)
**Commit Message**: fix(dsh): recognize silent seat capacity errors

**File**: `src/frontend/platform/src/controllers/API/dsh.ts` (modified, +10/-8)
```diff
@@ -725,15 +725,17 @@ export function isDshRequestRejected(error: unknown): boolean {
 }
 
 export function isDshSeatLimitReached(error: unknown): boolean {
-    if (error && typeof error === 'object' && 'code' in error && error.code === 'seat_limit_reached') return true
-    if (!error || typeof error !== 'object' || !('response' in error)) return false
-    const response = error.response
-    if (!response || typeof response !== 'object' || !('data' in response)) return false
-    const data = response.data
+    if (!error || typeof error !== 'object') return false
+    // Silent requests reject HTTP 200 business envelopes directly; HTTP errors
+    // retain the Axios response. Decode the business payload in either case.
+    const response = 'response' in error ? error.response : undefined
+    const data = response && typeof response === 'object' && 'data' in response
+        ? response.data : error
     if (!data || typeof data !== 'object') return false
-    if ('error' in data && data.error && typeof data.error === 'object'
-        && 'code' in data.error && data.error.code === 'seat_limit_reached') return true
-    return 'status_code' in data && Number(data.status_code) === 26112
+    if ('status_code' in data && Number(data.status_code) === 26112) return true
+    const failure = 'error' in data ? data.error : data
+    return !!failure && typeof failure === 'object'
+        && 'code' in failure && failure.code === 'seat_limit_reached'
 }
 
 export async function getDshModelPolicy(
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatError.test.ts` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ describe('seat capacity HTTP contract', () => {
     it('recognizes the DSH real HTTP error envelope', () => {
         expect(isDshSeatLimitReached({ response: { status: 403, data: { error: { code: 'seat_limit_reached' } } } })).toBe(true)
     })
+    it('recognizes the direct business envelope rejected by silent requests', () => {
+        expect(isDshSeatLimitReached({ status_code: 26112, status_message: 'DSH seat limit reached' })).toBe(true)
+        expect(isDshSeatLimitReached({ status_code: 26101 })).toBe(false)
+    })
     it('recognizes a failed durable allocation receipt', () => {
         expect(isDshSeatLimitReached({ code: 'seat_limit_reached' })).toBe(true)
     })
```

**File**: `src/frontend/platform/src/controllers/API/dshSeatTransport.test.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { describe, expect, it, vi } from 'vitest'
+vi.mock('@/components/bs-ui/toast/use-toast', () => ({ toast: vi.fn() }))
+import request from '@/controllers/request'
+import { isDshSeatLimitReached, saveDshSubjectPolicy } from './dsh'
+
+describe('seat errors through the platform HTTP interceptor', () => {
+    it('preserves capacity rejection from an HTTP 200 business response', async () => {
+        vi.stubGlobal('localStorage', { getItem: () => null })
+        const previous = request.defaults.adapter
+        request.defaults.adapter = async (config) => ({
+            status: 200, statusText: 'OK', headers: {}, config,
+            data: { status_code: 26112, status_message: 'DSH seat limit reached; contact an administrator' },
+        })
+        try {
+            const failure = await saveDshSubjectPolicy(6, 'DEPARTMENT', 18, 1, {
+                expected_version: 2, enabled: true, monthly_token_limit: 10000000,
+            }).catch((error: unknown) => error)
+            expect(isDshSeatLimitReached(failure)).toBe(true)
+        } finally {
+            request.defaults.adapter = previous
+            vi.unstubAllGlobals()
+        }
+    })
+})
```

---

### Incident Patch 10: `f3f1e599` (2026-09-21)
**Commit Message**: fix(dsh): show the provider model name and translate the catalog table

The shared display rule preferred the administrator-configured alias over
the provider's own model name, so a placeholder alias such as "model 1"
reached the Desktop catalog and the administration pages instead of
"qwen2.5-72b-instruct". Swap the precedence and keep the alias as the
fallback for models whose call name is blank.

The DSH model table also rendered raw i18n keys for its status, badge,
actions and permission-button labels, plus the empty-state hint; add the
five missing keys to the model namespace in all three languages.

**File**: `features/v3.0.0-beta2/062-dsh-desktop-model-access/client-api.md` (modified, +2/-2)
```diff
@@ -296,15 +296,15 @@ Content-Type: application/json
     "object":"model",
     "created":1788919200,
     "owned_by":"bisheng",
-    "display_name":"百炼 / 通义千问 Max",
+    "display_name":"百炼 / qwen-max",
     "capabilities":{"streaming":true,"tools":true,"reasoning_content":false}
   }]
 }
 ```
 
 上述字段均必返；created 为 Unix 秒。capabilities 三项为布尔值，`reasoning_content` 表示该适配器已验证的 DeepSeek 兼容扩展能力；不依据模型名推断。模型列表必须已经过现有模型可访问性与 DSH 白名单过滤；合法共享模型的物理 tenant_id 不返回给客户端作为过滤依据。
 
-`display_name` 与毕昇管理端共用展示规则：`提供方名称 / 管理员配置的模型展示名称`。模型展示名称优先使用 `name`，去除首尾空白后为空时使用调用名称 `model_name`；提供方名称为空时使用提供方类型。两部分均去除首尾空白。`id` 使用稳定的 `bisheng:<model.id>`，用于权限、额度与请求路由；`owned_by` 为 `bisheng`。修改展示名称后，客户端在下一次目录刷新时获取新名称。
+`display_name` 与毕昇管理端共用展示规则：`提供方名称 / 供应商调用名称`。模型部分优先使用调用名称 `model_name`，去除首尾空白后为空时回落到管理员配置的展示名称 `name`；提供方名称为空时使用提供方类型。两部分均去除首尾空白。`id` 使用稳定的 `bisheng:<model.id>`，用于权限、额度与请求路由；`owned_by` 为 `bisheng`。修改模型调用名称或展示名称后，客户端在下一次目录刷新时获取新名称。
 
 列表一次返回当前用户全部可用模型，本期无分页参数。空数组为成功结果，展示“管理员尚未开放可用企业模型”。模型名只用于展示，调用必须原样使用 id（`bisheng:<model_id>`），不传供应商原始模型名或自行拼接名称。
 
```

**File**: `src/backend/bisheng/dsh/domain/services/model_display.py` (modified, +2/-2)
```diff
@@ -2,7 +2,7 @@
 
 
 def model_display_name(model, server) -> str:
-    """Prefer the configured display name while keeping the provider visible."""
+    """Prefer the provider's own model name while keeping the provider visible."""
     provider = server.name.strip() or server.type
-    name = model.name.strip() or model.model_name.strip()
+    name = model.model_name.strip() or model.name.strip()
     return f"{provider} / {name}"
```

**File**: `src/backend/test/dsh/test_model_service.py` (modified, +5/-5)
```diff
@@ -133,17 +133,17 @@ async def test_models_empty_policy_and_immediate_offline(service_setup):
 @pytest.mark.parametrize(
     ("provider_name", "provider_type", "model_name", "alias", "expected"),
     [
-        ("百炼", "aliyun", "qwen-max", "通义千问 Max", "百炼 / 通义千问 Max"),
-        ("DeepSeek", "openai", "deepseek-chat", "DeepSeek V3", "DeepSeek / DeepSeek V3"),
-        ("  百炼  ", "aliyun", "  qwen-max  ", "  通义千问 Max  ", "百炼 / 通义千问 Max"),
-        ("", "openai", "qwen-max", "通义千问 Max", "openai / 通义千问 Max"),
+        ("百炼", "aliyun", "qwen-max", "通义千问 Max", "百炼 / qwen-max"),
+        ("DeepSeek", "openai", "deepseek-chat", "DeepSeek V3", "DeepSeek / deepseek-chat"),
+        ("  百炼  ", "aliyun", "  qwen-max  ", "  通义千问 Max  ", "百炼 / qwen-max"),
+        ("", "openai", "qwen-max", "通义千问 Max", "openai / qwen-max"),
         ("百炼", "aliyun", "  qwen-max  ", "", "百炼 / qwen-max"),
         ("百炼", "aliyun", "  qwen-max  ", "   ", "百炼 / qwen-max"),
         ("   ", "openai", "", "Custom model", "openai / Custom model"),
         ("OpenAI", "openai", "   ", "Custom model", "OpenAI / Custom model"),
     ],
 )
-async def test_catalog_and_admin_share_configured_display_name_and_route_id(
+async def test_catalog_and_admin_share_provider_model_name_and_route_id(
     service_setup, provider_name, provider_type, model_name, alias, expected
 ):
     from bisheng.dsh.admin_runtime import read_available_models
```

**File**: `src/frontend/platform/public/locales/en-US/model.json` (modified, +5/-0)
```diff
@@ -101,6 +101,11 @@
     "systemConfigInheritedBadge": "Inherited from Root",
     "systemConfigFallbackBlockedBanner": "Root sharing is off. Ask the super admin to enable sharing or configure this tenant directly.",
     "supportsImages": "Image input",
+    "status": "Status",
+    "available": "Available",
+    "actions": "Actions",
+    "configureDshPermission": "Configure permissions",
+    "noOnlineDshModels": "No online models available yet",
     "visionRetry": "Load or save failed. Retry",
     "loading": "Loading"
   },
```

**File**: `src/frontend/platform/public/locales/ja/model.json` (modified, +5/-0)
```diff
@@ -99,6 +99,11 @@
     "systemConfigInheritedBadge": "Root から継承",
     "systemConfigFallbackBlockedBanner": "Root 共有が無効です。スーパー管理者に共有を有効化してもらうか、このテナントで個別に設定してください。",
     "supportsImages": "画像入力",
+    "status": "ステータス",
+    "available": "利用可能",
+    "actions": "操作",
+    "configureDshPermission": "権限を設定",
+    "noOnlineDshModels": "利用可能なオンラインモデルがありません",
     "visionRetry": "読み込みまたは保存に失敗。再試行",
     "loading": "読み込み中"
   },
```

**File**: `src/frontend/platform/public/locales/zh-Hans/model.json` (modified, +5/-0)
```diff
@@ -99,6 +99,11 @@
     "systemConfigInheritedBadge": "继承自 Root",
     "systemConfigFallbackBlockedBanner": "Root 已关闭共享。请联系超管开启共享或在此为本租户独立配置。",
     "supportsImages": "支持图片",
+    "status": "状态",
+    "available": "可用",
+    "actions": "操作",
+    "configureDshPermission": "配置权限",
+    "noOnlineDshModels": "暂无已上线的可用模型",
     "visionRetry": "读取或保存失败，重试",
     "loading": "加载中"
   },
```

---

### Incident Patch 11: `89526ef8` (2026-09-21)
**Commit Message**: fix(dsh): show guidance after desktop launch attempt

**File**: `src/frontend/client/src/components/dsh/DshDesktopDialog.test.tsx` (modified, +23/-0)
```diff
@@ -42,6 +42,29 @@ it('uses the configured download link', async () => {
   fireEvent.click(screen.getByRole('button', { name: 'dsh_download' }));
   expect(launch).toHaveBeenCalledWith('https://downloads.example.org/dsh.dmg', '_blank', 'noopener,noreferrer');
 });
+it.each([
+  ['https://downloads.example.org/dsh.dmg', 'dsh.launchHelp'],
+  [null, 'dsh.launchHelpNoDownload'],
+])('offers launch guidance with download URL %s without opening a download automatically', async (downloadUrl, helpKey) => {
+  const originalLocation = window.location;
+  const assign = jest.fn();
+  const openWindow = jest.spyOn(window, 'open').mockImplementation(() => null);
+  Object.defineProperty(window, 'location', {
+    configurable: true,
+    value: { origin: 'http://localhost:3080', assign },
+  });
+  try {
+    show(downloadUrl);
+    await screen.findByRole('list');
+    expect(screen.queryByText(helpKey!)).toBeNull();
+    fireEvent.click(screen.getByRole('button', { name: 'dsh_open' }));
+    expect(assign).toHaveBeenCalledWith('dsh-desktop://login?server=http%3A%2F%2Flocalhost%3A3080');
+    expect(screen.getByRole('status')).toHaveTextContent(helpKey!);
+    expect(openWindow).not.toHaveBeenCalled();
+  } finally {
+    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
+  }
+});
 it('keeps usage unavailable distinct from zero', async () => {
   const unknown = { ...metrics, total_tokens: null, input_tokens: null, output_tokens: null, recorded_usage_count: 0, missing_usage_count: 2 };
   jest.mocked(getDshUsageSummary).mockResolvedValue({ ...summary, totals: unknown, points: [{ ...summary.points[0], ...unknown }] });
```

**File**: `src/frontend/client/src/components/dsh/DshDesktopDialog.tsx` (modified, +11/-1)
```diff
@@ -1,5 +1,6 @@
 import { Button } from '@bisheng/ui';
 import { useQuery } from '@tanstack/react-query';
+import { useEffect, useState } from 'react';
 import { dshLaunchUrl } from '~/utils/dshLaunch';
 import { getDshUsageSummary } from '~/api/dsh';
 import { Dialog, DialogContent, DialogTitle } from '~/components/ui/Dialog';
@@ -16,6 +17,12 @@ interface DshDesktopDialogProps {
 export function DshDesktopDialog({ open, onOpenChange, downloadUrl, launchUrl }: DshDesktopDialogProps) {
   const t = useLocalize();
   const { user } = useAuthContext();
+  const [launchAttempted, setLaunchAttempted] = useState(false);
+  useEffect(() => { if (!open) setLaunchAttempted(false); }, [open]);
+  const handleOpenDesktop = () => {
+    setLaunchAttempted(true);
+    window.location.assign(dshLaunchUrl(launchUrl));
+  };
   const usage = useQuery({
     queryKey: ['dsh-self-usage-summary', user?.id], enabled: open && Boolean(user?.id), retry: false, staleTime: 0,
     queryFn: ({ signal }) => getDshUsageSummary(signal),
@@ -24,9 +31,12 @@ export function DshDesktopDialog({ open, onOpenChange, downloadUrl, launchUrl }:
     <DialogContent aria-describedby={undefined} className="w-[calc(100vw-32px)] max-w-5xl max-h-[85dvh] overflow-y-auto rounded-2xl sm:rounded-2xl text-text-1">
       <DialogTitle>{t('dsh_title')}</DialogTitle>
       <div className="flex flex-wrap gap-2">
-        <Button onClick={() => window.location.assign(dshLaunchUrl(launchUrl))}>{t('dsh_open')}</Button>
+        <Button onClick={handleOpenDesktop}>{t('dsh_open')}</Button>
         {downloadUrl && <Button color="secondary" variant="outline" onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}>{t('dsh_download')}</Button>}
       </div>
+      {launchAttempted && <p role="status" className="text-body-sm text-text-2">
+        {t(downloadUrl ? 'dsh.launchHelp' : 'dsh.launchHelpNoDownload')}
+      </p>}
       {usage.isLoading ? <p role="status">{t('dsh_loading')}</p> : usage.isError ?
         <p role="alert">{t('dsh_load_error')} <Button variant="link" onClick={() => void usage.refetch()}>{t('dsh_retry')}</Button></p> :
         usage.data && <DshUsageCalendar summary={usage.data} />}
```

**File**: `src/frontend/client/src/locales/en/translation.json` (modified, +2/-0)
```diff
@@ -2258,6 +2258,8 @@
   "dsh_source_unavailable": "Usage unavailable",
   "dsh_unknown_usage": "Usage was not received for {{count}} calls.",
   "dsh": {
+    "launchHelp": "If DSH Desktop did not open, click “Download DSH Desktop” to install it. If already installed, allow your browser to open the app or start it manually.",
+    "launchHelpNoDownload": "If DSH Desktop did not open and is already installed, allow your browser to open the app or start it manually. If not installed, contact your administrator for a download link.",
     "heatmapFuture": "Upcoming interval",
     "heatmapMessageValue": "{{value}} messages",
     "heatmapOutside": "Outside selected range",
```

**File**: `src/frontend/client/src/locales/ja/translation.json` (modified, +2/-0)
```diff
@@ -2181,6 +2181,8 @@
   "dsh_source_unavailable": "使用量を取得できません",
   "dsh_unknown_usage": "{{count}} 回の呼び出しの使用量が未取得です。",
   "dsh": {
+    "launchHelp": "DSH Desktop が開かない場合は、「DSH Desktop をダウンロード」からインストールしてください。インストール済みの場合は、ブラウザーでアプリを開くことを許可するか、手動で起動してください。",
+    "launchHelpNoDownload": "DSH Desktop が開かず、インストール済みの場合は、ブラウザーでアプリを開くことを許可するか、手動で起動してください。未インストールの場合は、管理者にダウンロード先を確認してください。",
     "heatmapFuture": "まだ到達していない時間",
     "heatmapMessageValue": "{{value}} 件のメッセージ",
     "heatmapOutside": "選択範囲外",
```

**File**: `src/frontend/client/src/locales/zh-Hans/translation.json` (modified, +2/-0)
```diff
@@ -2187,6 +2187,8 @@
   "dsh_source_unavailable": "用量暂不可用",
   "dsh_unknown_usage": "有 {{count}} 次调用未获取到用量。",
   "dsh": {
+    "launchHelp": "若 DSH Desktop 未打开，请点击“下载 DSH Desktop”安装客户端；已安装时，请允许浏览器打开应用，或手动启动客户端。",
+    "launchHelpNoDownload": "若 DSH Desktop 未打开，已安装时请允许浏览器打开应用，或手动启动客户端；未安装时请联系管理员获取下载地址。",
     "heatmapFuture": "未到时间",
     "heatmapMessageValue": "{{value}} 条消息",
     "heatmapOutside": "筛选范围外",
```

---

### Incident Patch 12: `29f696f3` (2026-09-21)
**Commit Message**: fix(dsh): hide seat login sessions entry

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/SeatsView.tsx` (modified, +0/-13)
```diff
@@ -25,7 +25,6 @@ import { useEffect, useRef, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { createDshOperationId } from '@/util/dshOperationId'
 import { DshChoice, DshPager, dshTime } from './common'
-import { SeatSessions } from './SeatSessions'
 
 interface SeatsViewProps {
     onOperation: (operation: DshOperationRef, result?: DshOperation) => void
@@ -43,7 +42,6 @@ export function SeatsView({
     const [cursors, setCursors] = useState<string[]>([''])
     const [data, setData] = useState<DshPage<DshSeat> | null>(null)
     const [error, setError] = useState(false)
-    const [seat, setSeat] = useState<DshSeat | null>(null)
     const [pending, setPending] = useState<Record<string, string>>({})
     const commandLocks = useRef(new Set<string>())
     useEffect(() => {
@@ -72,7 +70,6 @@ export function SeatsView({
         const abort = new AbortController()
         setData(null)
         setError(false)
-        setSeat(null)
         getDshSeats(
             { ...query, cursor: cursors.at(-1) || undefined, limit: 50 },
             abort.signal,
@@ -239,15 +236,6 @@ export function SeatsView({
                                         </TableCell>
                                         <TableCell>
                                             <div className="flex gap-2">
-                                                <Button
-                                                    size="sm"
-                                                    variant="outline"
-                                                    onClick={() =>
-                                                        setSeat(item)
-                                                    }
-                                                >
-                                                    {t('dsh.sessions')}
-                                                </Button>
                                                 <Button
                                                     size="sm"
                                                     variant={
@@ -294,7 +282,6 @@ export function SeatsView({
                     setCursors((old) => [...old, data.next_cursor!])
                 }
             />
-            {seat && <SeatSessions key={seat.seat_id} seat={seat} onClose={() => setSeat(null)} />}
         </section>
     )
 }
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/dshSeats.test.tsx` (modified, +3/-17)
```diff
@@ -95,7 +95,7 @@ describe('DSH seat pagination and commands', () => {
         expect(screen.queryByRole('button', { name: 'dsh.next' })).toBeNull()
         unmount()
     })
-    it('renders one page from ten thousand seats and loads sessions independently', async () => {
+    it('renders one page from ten thousand seats without a session entry', async () => {
         const fixtures = Array.from({ length: 10000 }, (_, i) => seat(i + 1))
         vi.mocked(getDshSeats).mockImplementation(async (query) => ({
             items: fixtures.slice(
@@ -105,11 +105,6 @@ describe('DSH seat pagination and commands', () => {
             next_cursor: query.cursor ? '100' : '50',
             has_more: true,
         }))
-        vi.mocked(getDshSessions).mockResolvedValue({
-            items: [],
-            next_cursor: null,
-            has_more: false,
-        })
         const { unmount } = render(
             <SeatsView operations={{}} revision={0} onOperation={vi.fn()} />,
         )
@@ -119,17 +114,8 @@ describe('DSH seat pagination and commands', () => {
         expect(screen.queryByLabelText('dsh.department')).toBeNull()
         expect(vi.mocked(getDshSeats).mock.calls[0][0]).not.toHaveProperty('department_id')
         expect(vi.mocked(getDshSeats).mock.calls[0][0].limit).toBe(50)
-        fireEvent.click(screen.getAllByText('dsh.sessions')[0])
-        await waitFor(() =>
-            expect(getDshSessions).toHaveBeenCalledWith(
-                '1',
-                '1',
-                undefined,
-                expect.any(AbortSignal),
-            ),
-        )
-        expect(screen.getByRole('dialog')).toBeTruthy()
-        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
+        expect(screen.queryByRole('button', { name: 'dsh.sessions' })).toBeNull()
+        expect(getDshSessions).not.toHaveBeenCalled()
         expect(screen.queryByRole('dialog')).toBeNull()
         fireEvent.click(screen.getAllByText('dsh.next')[0])
         await waitFor(() => expect(screen.getByText('User 51')).toBeTruthy())
```

---

### Incident Patch 13: `fb56b6b6` (2026-09-21)
**Commit Message**: fix(dsh): align free license display and terminal operation status

**File**: `features/v3.0.0-beta2/062-dsh-desktop-model-access/design.md` (modified, +8/-0)
```diff
@@ -9,6 +9,14 @@
 **状态**：用户已确认官方链路边界、单 Nginx 入口、接口冻结规则与逐模型修订；当前客户端契约为 `0.5.0`（本次解绑不升版）；逐模型额度、取消未知用量冻结及部门同步/筛选修订已实现；完整发布验收仍独立保留
 **最后更新**：2026-09-11
 
+### 2026-09-21：免费席位与管理接口对齐
+
+本修订覆盖下文“免费席位也必须由签名授权提供”的旧约定。Gateway 内置免费 10 席；商业 License 用于提高席位上限，未配置、无效或过期时的实际授权以 Gateway 有效快照为准，BiSheng 不自行推算或补发席位。
+
+`GET /api/v1/dsh/admin/license` 接收并透传 Gateway 的 `source`（`builtin` / `signed`）与 `signed_license_status`（`active` / `not_granted` / `license_invalid` / `license_expired`）。`status` 仍表示当前有效能力状态；免费基线正常时为 `active`，`seat_limit=10`，`expires_at=null`。`signed_license_status` 单独描述商业签名授权，不覆盖当前有效状态。缺少新增字段的旧响应保留原展示，字段返回 `null`；不得根据席位数为 10 推断免费版。
+
+管理页及商业授权申请弹窗在 `status=active` 且 `source=builtin` 时，原状态标签显示“免费版”；商业授权与其他状态保留原展示。页面结构、按钮、席位操作不变。Gateway 不可达或响应无效时继续报不可用，不得伪造免费 10 席。此次变更不影响桌面客户端登录、令牌或模型调用契约。
+
 ## 1. 目标与非目标
 
 DSH Desktop 完成 BiSheng 用户登录后，用平台已配置的模型驱动客户端 Agent。Gateway 项目中的闭源 DSH 模块管理 License、固定席位和 DSH 会话；BiSheng 提供模型调用、治理和统一管理界面。
```

**File**: `src/backend/bisheng/dsh/domain/schemas/admin.py` (modified, +2/-0)
```diff
@@ -50,6 +50,8 @@ def timestamp(cls, value):
 
 class LicenseSnapshot(DshContract):
     status: Literal["active", "license_invalid", "license_expired", "dsh_disabled"]
+    source: Literal["builtin", "signed"] | None = None
+    signed_license_status: Literal["active", "not_granted", "license_invalid", "license_expired"] | None = None
     seat_limit: NonnegativeInt
     assigned: NonnegativeInt
     available: NonnegativeInt
```

**File**: `src/backend/test/dsh/test_admin_service.py` (modified, +41/-0)
```diff
@@ -83,6 +83,47 @@ async def test_gateway_failure_is_unavailable_not_zero(operation_scope):  # noqa
         await service.license(90)
 
 
+@pytest.mark.parametrize(
+    "source,signed_status,seat_limit",
+    [
+        ("builtin", "not_granted", 10),
+        ("builtin", "license_expired", 10),
+        ("builtin", "license_invalid", 10),
+        ("signed", "active", 50),
+        (None, None, 10),
+    ],
+)
+async def test_license_preserves_gateway_entitlement_source(source, signed_status, seat_limit):
+    snapshot = {
+        "status": "active",
+        "seat_limit": seat_limit,
+        "assigned": 3,
+        "available": seat_limit - 3,
+        "as_of": "2026-09-21T00:00:00Z",
+        "license_id": "builtin-dsh-10" if source == "builtin" else "commercial-license",
+        "expires_at": None if source == "builtin" else "2027-09-21T00:00:00Z",
+    }
+    if source is not None:
+        snapshot.update(source=source, signed_license_status=signed_status)
+    service, _, _ = build(None, SimpleNamespace(request=AsyncMock(return_value=snapshot)))
+    result = await service.license(90)
+    assert result["source"] == source
+    assert result["signed_license_status"] == signed_status
+    assert result["status"] == "active"
+    assert result["seat_limit"] == result["limit"] == seat_limit
+    assert result["assigned"] == result["used"] == 3
+    assert result["available"] == seat_limit - 3
+    assert result["valid_until"] == snapshot["expires_at"]
+
+
+async def test_malformed_license_is_not_replaced_by_free_entitlement():
+    from bisheng.common.errcode.dsh import DshAuthorizationUnavailableError
+
+    service, _, _ = build(None, SimpleNamespace(request=AsyncMock(return_value={"source": "builtin"})))
+    with pytest.raises(DshAuthorizationUnavailableError):
+        await service.license(90)
+
+
 async def test_subject_policy_management_stays_in_authorized_tenant(operation_scope):  # noqa: F811
     gateway = SimpleNamespace(
         request=AsyncMock(
```

**File**: `src/frontend/platform/public/locales/en-US/bs.json` (modified, +1/-0)
```diff
@@ -2293,6 +2293,7 @@
     "applicationInfoCopied": "Application details copied",
     "close": "Close",
     "licenseStatus": {
+      "free": "Free edition",
       "active": "Licensed",
       "expired": "Expired",
       "invalid": "Invalid",
```

**File**: `src/frontend/platform/public/locales/ja/bs.json` (modified, +1/-0)
```diff
@@ -2238,6 +2238,7 @@
     "applicationInfoCopied": "申請情報をコピーしました",
     "close": "閉じる",
     "licenseStatus": {
+      "free": "無料版",
       "active": "ライセンス済み",
       "expired": "期限切れ",
       "invalid": "無効",
```

**File**: `src/frontend/platform/public/locales/zh-Hans/bs.json` (modified, +1/-0)
```diff
@@ -2238,6 +2238,7 @@
     "applicationInfoCopied": "申请信息已复制",
     "close": "关闭",
     "licenseStatus": {
+      "free": "免费版",
       "active": "已授权",
       "expired": "已过期",
       "invalid": "无效",
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/CommercialLicenseDialog.tsx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ export function CommercialLicenseDialog({
     const deploymentAddress = window.location.origin
     const normalizedStatus = license?.status?.toLocaleLowerCase() || 'unknown'
     const licenseStatus = license
-        ? t(`dsh.licenseStatus.${normalizedStatus}`, {
+        ? t(`dsh.licenseStatus.${normalizedStatus === 'active' && license.source === 'builtin' ? 'free' : normalizedStatus}`, {
               defaultValue: license.status,
           })
         : t('dsh.notConfigured')
```

**File**: `src/frontend/platform/src/pages/SystemPage/dsh/OperationStatus.tsx` (modified, +2/-2)
```diff
@@ -82,9 +82,9 @@ export function OperationStatus({
                         ? 'dsh.rejected'
                         : `dsh.${operation?.status || 'PROCESSING'}`,
                 )}
-                {unavailable && ` · ${t('dsh.unavailable')}`}
+                {!terminal && unavailable && ` · ${t('dsh.unavailable')}`}
             </p>
-            {paused && <p>{t('dsh.pollPaused')}</p>}
+            {!terminal && paused && <p>{t('dsh.pollPaused')}</p>}
             {!terminal && (
                 <Button
                     variant="outline"
```

---

### Incident Patch 14: `928ed9f4` (2026-09-20)
**Commit Message**: fix(dsh): prefer configured model display names

**File**: `docs/STATUS.md` (modified, +1/-0)
```diff
@@ -1,5 +1,6 @@
 # DSH 企业后台交付状态
 
+- 2026-09-20：模型目录和管理端共用展示名称规则，优先采用管理员配置的 `name`，空白名称使用调用名称 `model_name`。内部模型 ID 继续用于调用、权限和额度。定向回归 48 项通过、2 项 Redis 用例按环境跳过，16 项外部数据库变体排除；Ruff 和架构守卫通过。执行方式与环境边界见 [模型名称修复验证](../features/v3.0.0-beta2/062-dsh-desktop-model-access/model-display-verification.md)。
 - 2026-09-17：`codex/dsh-enterprise-beta2` 已归并最新看板、部门额度、导航、个人年度用量和隐藏审计入口，进入提测候选。
 - 实现、来源、确定性检查和真实环境验收边界见 [提测交付记录](../features/v3.0.0-beta2/062-dsh-desktop-model-access/enterprise-beta2-delivery.md)。
 - 当前组合分支保持原 beta2 基线；真实数据库与登录态端到端验收由提测执行。
```

**File**: `features/v3.0.0-beta2/062-dsh-desktop-model-access/client-api.md` (modified, +2/-2)
```diff
@@ -296,15 +296,15 @@ Content-Type: application/json
     "object":"model",
     "created":1788919200,
     "owned_by":"bisheng",
-    "display_name":"百炼 / qwen-max",
+    "display_name":"百炼 / 通义千问 Max",
     "capabilities":{"streaming":true,"tools":true,"reasoning_content":false}
   }]
 }
 ```
 
 上述字段均必返；created 为 Unix 秒。capabilities 三项为布尔值，`reasoning_content` 表示该适配器已验证的 DeepSeek 兼容扩展能力；不依据模型名推断。模型列表必须已经过现有模型可访问性与 DSH 白名单过滤；合法共享模型的物理 tenant_id 不返回给客户端作为过滤依据。
 
-`display_name` 与毕昇管理端保持一致：`提供方名称 / 实际模型名`。两部分先去除首尾空白；提供方名称为空时使用提供方类型，实际模型名为空时回退模型配置名称。不新增 provider 字段，`owned_by` 仍为 `bisheng`。
+`display_name` 与毕昇管理端共用展示规则：`提供方名称 / 管理员配置的模型展示名称`。模型展示名称优先使用 `name`，去除首尾空白后为空时使用调用名称 `model_name`；提供方名称为空时使用提供方类型。两部分均去除首尾空白。`id` 使用稳定的 `bisheng:<model.id>`，用于权限、额度与请求路由；`owned_by` 为 `bisheng`。修改展示名称后，客户端在下一次目录刷新时获取新名称。
 
 列表一次返回当前用户全部可用模型，本期无分页参数。空数组为成功结果，展示“管理员尚未开放可用企业模型”。模型名只用于展示，调用必须原样使用 id（`bisheng:<model_id>`），不传供应商原始模型名或自行拼接名称。
 
```

**File**: `features/v3.0.0-beta2/062-dsh-desktop-model-access/design.md` (modified, +1/-1)
```diff
@@ -722,7 +722,7 @@ DSH Token 的 JOSE header 固定 typ=bisheng-dsh-access+jwt、alg=HS256、kid=ds
 | BiSheng `GET /api/v1/dsh/admin/users/{id}/policy` | 管理员 JWT、同租户 | 指定用户的模型策略、额度及 source/as_of 用量，供用户用量只读视图；保存后单行刷新使用新增模型策略 GET |
 | BiSheng `GET /api/v1/dsh/admin/users/{id}/sessions` | 管理员 JWT、同租户 | cursor/limit 的设备会话列表，内部复用 Gateway management/read |
 
-管理 `GET /api/v1/dsh/admin/users/{id}/policy` 的已实现补充字段：`tenant_id` 是后端授权解析的真实目标，单模型管理接口同样返回/使用该目标，不能从 simple 用户列表或管理员登录租户猜测。`available_models` 为 `{id:int,name:string,is_root_shared:boolean}[]`，其中 name 展示“提供方名称 / 实际 model_name”，不使用自动生成的模型配置标签；由目标租户原模型强读筛选在线 LLM 后逐模型强校验；`available_models_source=live|unavailable` 区分无候选与依赖失败。`last_call` 为最近 SQL 投影的 `{request_id,model_id,status,started_at,finished_at,total_tokens,projected_at}` 或 null，`last_call_source=persisted|unavailable` 区分无历史和读取失败；未知用量为 null，记录允许投影延迟。以上只补普通管理员接口，7 个 Desktop 客户端接口及 0.3.0 不变。
+管理 `GET /api/v1/dsh/admin/users/{id}/policy` 的已实现补充字段：`tenant_id` 是后端授权解析的真实目标，单模型管理接口同样返回/使用该目标，不能从 simple 用户列表或管理员登录租户猜测。`available_models` 为 `{id:int,name:string,is_root_shared:boolean}[]`，其中 name 与 Desktop 目录共用展示规则：“提供方名称 / 管理员配置的模型展示名称”；模型展示名称 `name` 去除首尾空白后为空时使用调用名称 `model_name`，提供方名称为空时使用提供方类型；由目标租户原模型强读筛选在线 LLM 后逐模型强校验；`available_models_source=live|unavailable` 区分无候选与依赖失败。`last_call` 为最近 SQL 投影的 `{request_id,model_id,status,started_at,finished_at,total_tokens,projected_at}` 或 null，`last_call_source=persisted|unavailable` 区分无历史和读取失败；未知用量为 null，记录允许投影延迟。以上只补普通管理员接口，7 个 Desktop 客户端接口及 0.3.0 不变。
 
 ### 6.2 内部接口与权限
 
```

**File**: `features/v3.0.0-beta2/062-dsh-desktop-model-access/model-display-verification.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# 模型展示名称修复验证
+
+基线：`codex/dsh-enterprise-beta2@7374d699a6815cef7451bfa94e88deee9f2fcbb6`。本次修改 `DshModelService.list_models` 与管理端 `read_available_models`，通过同一格式函数优先读取管理员填写的展示名称；接口字段结构、路由 ID 和授权规则沿用现有实现。
+
+## 验证结果
+
+- `test_model_service.py`、`test_models_api.py`、`test_admin_service.py`：48 项通过，2 项 Redis 依赖用例按环境跳过，16 项外部数据库变体排除。
+- 参数化用例覆盖管理员名称、首尾空白、空名称回退和提供方类型回退，并同时断言 Desktop 目录、管理接口名称及稳定 ID。
+- 改动 Python 文件的 Ruff check/format 和架构守卫通过。
+- MySQL/DM8 真库、Redis 集成、Desktop 真实登录与调用验收：`NOT_RUN`。
+- 扩展尝试 `test_model_snapshot.py` 受本地 MinIO 等依赖缺失阻断，记为 `NOT_RUN`；目标展示名称路径由上述三组测试覆盖。
+
+## 本地复现
+
+从 `src/backend` 执行。共享测试 fixture 会预先替换 `bisheng.common.services` 包，因此单独运行这一组用例时先加载实际的 `metric_log.py`，再启动 pytest。测试环境包含项目所需的 pytest、pytest-asyncio、SQLModel、LangChain Core 和 OpenAI 依赖。
+
+```python
+import importlib.util
+import sys
+from pathlib import Path
+
+import pytest
+
+name = "bisheng.common.services.metric_log"
+spec = importlib.util.spec_from_file_location(name, Path("bisheng/common/services/metric_log.py"))
+module = importlib.util.module_from_spec(spec)
+sys.modules[name] = module
+spec.loader.exec_module(module)
+raise SystemExit(pytest.main([
+    "test/dsh/test_model_service.py",
+    "test/dsh/test_models_api.py",
+    "test/dsh/test_admin_service.py",
+    "-q", "-k", "not external",
+]))
+```
```

**File**: `src/backend/bisheng/dsh/admin_runtime.py` (modified, +2/-1)
```diff
@@ -324,6 +324,7 @@ async def read_available_models(model_ids, model_loader):
     from bisheng.common.errcode.dsh import DshModelNotAllowedError
     from bisheng.dsh.domain.repositories.admin_operation import require_tenant
     from bisheng.dsh.domain.schemas.admin import AvailableModel
+    from bisheng.dsh.domain.services.model_display import model_display_name
 
     tenant_id = require_tenant()
     result = []
@@ -335,7 +336,7 @@ async def read_available_models(model_ids, model_loader):
         result.append(
             AvailableModel(
                 id=model.id,
-                name=f"{server.name.strip() or server.type} / {model.model_name.strip() or model.name}",
+                name=model_display_name(model, server),
                 is_root_shared=model.tenant_id == 1 and tenant_id != 1,
             ).model_dump()
         )
```

**File**: `src/backend/bisheng/dsh/domain/services/model.py` (modified, +2/-1)
```diff
@@ -23,6 +23,7 @@
 from bisheng.dsh.domain.schemas.contracts import DshTokenUsage
 from bisheng.dsh.domain.schemas.usage import UsageEvent
 from bisheng.dsh.domain.services.access import DshPrincipal, principal_scope
+from bisheng.dsh.domain.services.model_display import model_display_name
 from bisheng.dsh.infrastructure.chat_adapter import DshChatAdapter
 from bisheng.dsh.infrastructure.quota_redis import QuotaRejected
 from bisheng.dsh.infrastructure.telemetry import record_settlement, request_trace
@@ -95,7 +96,7 @@ async def list_models(self, principal: DshPrincipal) -> dict:
                         "object": "model",
                         "created": created,
                         "owned_by": "bisheng",
-                        "display_name": f"{server.name.strip() or server.type} / {model.model_name.strip() or model.name}",
+                        "display_name": model_display_name(model, server),
                         "capabilities": capabilities.client_fields(),
                     }
                 )
```

**File**: `src/backend/bisheng/dsh/domain/services/model_display.py` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+"""Model labels shared by the Desktop catalog and its administration pages."""
+
+
+def model_display_name(model, server) -> str:
+    """Prefer the configured display name while keeping the provider visible."""
+    provider = server.name.strip() or server.type
+    name = model.name.strip() or model.model_name.strip()
+    return f"{provider} / {name}"
```

**File**: `src/backend/test/dsh/test_model_service.py` (modified, +7/-5)
```diff
@@ -133,15 +133,17 @@ async def test_models_empty_policy_and_immediate_offline(service_setup):
 @pytest.mark.parametrize(
     ("provider_name", "provider_type", "model_name", "alias", "expected"),
     [
-        ("百炼", "aliyun", "qwen-max", "model 2", "百炼 / qwen-max"),
-        ("DeepSeek", "openai", "deepseek-chat", "model 3", "DeepSeek / deepseek-chat"),
-        ("  百炼  ", "aliyun", "  qwen-max  ", "model 2", "百炼 / qwen-max"),
-        ("", "openai", "qwen-max", "model 2", "openai / qwen-max"),
+        ("百炼", "aliyun", "qwen-max", "通义千问 Max", "百炼 / 通义千问 Max"),
+        ("DeepSeek", "openai", "deepseek-chat", "DeepSeek V3", "DeepSeek / DeepSeek V3"),
+        ("  百炼  ", "aliyun", "  qwen-max  ", "  通义千问 Max  ", "百炼 / 通义千问 Max"),
+        ("", "openai", "qwen-max", "通义千问 Max", "openai / 通义千问 Max"),
+        ("百炼", "aliyun", "  qwen-max  ", "", "百炼 / qwen-max"),
+        ("百炼", "aliyun", "  qwen-max  ", "   ", "百炼 / qwen-max"),
         ("   ", "openai", "", "Custom model", "openai / Custom model"),
         ("OpenAI", "openai", "   ", "Custom model", "OpenAI / Custom model"),
     ],
 )
-async def test_models_display_provider_and_actual_name_with_existing_fallbacks(
+async def test_catalog_and_admin_share_configured_display_name_and_route_id(
     service_setup, provider_name, provider_type, model_name, alias, expected
 ):
     from bisheng.dsh.admin_runtime import read_available_models
```

---

### Incident Patch 15: `f4ba04d0` (2026-09-20)
**Commit Message**: fix(dsh): stabilize authorization tree loading and reuse member reads

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/DepartmentAccessTree.test.tsx` (modified, +40/-0)
```diff
@@ -221,3 +221,43 @@ it('uses the same search to find a user and preserves the department path', asyn
     expect(await screen.findByText('Alice')).toBeTruthy()
     expect(screen.getByRole('button', { name: 'Organization' })).toBeTruthy()
 })
+
+it('keeps loading feedback inside the department row and reuses results after reopening', async () => {
+    let complete!: (value: Awaited<ReturnType<typeof getDshModelUserPermissions>>) => void
+    vi.mocked(getDshModelUserPermissions).mockReturnValueOnce(
+        new Promise((resolve) => {
+            complete = resolve
+        }),
+    )
+    render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
+    const departmentButton = await screen.findByRole('button', { name: 'Organization' })
+    const indicator = await screen.findByRole('status')
+    expect(departmentButton.contains(indicator)).toBe(true)
+    expect(indicator.tagName.toLowerCase()).toBe('svg')
+    complete({
+        tenant_id: 2,
+        model: { ...model, is_root_shared: false },
+        items: [],
+        has_more: false,
+        next_cursor: null,
+    })
+    await waitFor(() => expect(departmentButton).toHaveAttribute('aria-busy', 'false'))
+    fireEvent.click(departmentButton)
+    fireEvent.click(departmentButton)
+    await waitFor(() => expect(departmentButton).toHaveAttribute('aria-busy', 'false'))
+    expect(getDshModelUserPermissions).toHaveBeenCalledTimes(1)
+})
+
+it('keeps existing member rows visible and read-only while refreshing after a save', async () => {
+    render(<ModelAccessDialog model={model} onClose={vi.fn()} />)
+    const memberQuota = await screen.findByLabelText('Alice · dsh.configuredQuotaWan')
+    vi.mocked(getDshModelUserPermissions).mockReturnValue(new Promise(() => {}))
+    fireEvent.change(screen.getByLabelText('Organization · dsh.configuredQuotaWan'), {
+        target: { value: '20' },
+    })
+    fireEvent.click(screen.getByRole('button', { name: 'save' }))
+    await waitFor(() => expect(getDshModelUserPermissions).toHaveBeenCalledTimes(2))
+    expect(screen.getByText('Alice')).toBeTruthy()
+    expect(memberQuota).toBeDisabled()
+    expect(screen.getByRole('button', { name: 'Organization' })).toHaveAttribute('aria-busy', 'true')
+})
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/DepartmentAccessTree.tsx` (modified, +85/-135)
```diff
@@ -1,19 +1,14 @@
 import { Badge } from '@/components/bs-ui/badge'
 import { Button } from '@/components/bs-ui/button'
-import { getDshModelUserPermissions } from '@/controllers/API/dsh'
-import type {
-    DshDepartmentPolicy,
-    DshModelUserPermission,
-    DshModelUserPermissionPage,
-    DshSubjectPolicy,
-} from '@/types/dsh'
-import { Building2, ChevronDown, ChevronRight, UserRound } from 'lucide-react'
-import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
+import type { DshDepartmentPolicy, DshModelUserPermission, DshSubjectPolicy } from '@/types/dsh'
+import { Building2, ChevronDown, ChevronRight, Loader2, UserRound } from 'lucide-react'
+import { useEffect, useMemo, useState } from 'react'
 import { useTranslation } from 'react-i18next'
 import { policyKey, type PolicyDrafts } from './SubjectPolicyControls'
 import { useUserPolicyDrafts, userDraftOf } from './useUserPolicyDrafts'
 import { QuotaInput } from './QuotaInput'
 import { formatWanQuota } from './quotaUnits'
+import { AccessMembersProvider, useAccessMembers, useDelayedMemberLoading } from './useAccessMembers'
 
 type UserDrafts = ReturnType<typeof useUserPolicyDrafts>
 interface Props {
@@ -29,73 +24,6 @@ interface Props {
 type Node = { item: DshDepartmentPolicy; children: Node[] }
 const columns = 'grid grid-cols-[minmax(280px,1fr)_200px_200px_160px] items-center gap-3 px-3'
 
-function useMembers(
-    modelId: number,
-    departmentId: number | undefined,
-    keyword: string | undefined,
-    refresh: number,
-    remember: UserDrafts['remember'],
-) {
-    const [page, setPage] = useState<DshModelUserPermissionPage | null>(null)
-    const [loading, setLoading] = useState(false)
-    const [error, setError] = useState(false)
-    const [retry, setRetry] = useState(0)
-    const active = useRef<AbortController>()
-    const pageRef = useRef(page)
-    pageRef.current = page
-    const load = useCallback(
-        async (append: boolean, abort: AbortController) => {
-            setLoading(true)
-            setError(false)
-            try {
-                const next = await getDshModelUserPermissions(
-                    modelId,
-                    {
-                        limit: 50,
-                        include_seats: true,
-                        membership: 'DIRECT',
-                        ...(departmentId === 0 ? { unassigned_only: true } : { department_id: departmentId }),
-                        keyword: keyword || undefined,
-                        cursor: append ? (pageRef.current?.next_cursor ?? undefined) : undefined,
-                    },
-                    abort.signal,
-                )
-                if (abort.signal.aborted) return
-                remember(next.items)
-                setPage((current) => ({
-                    ...next,
-                    items: append ? [...(current?.items ?? []), ...next.items] : next.items,
-                }))
-            } catch {
-                if (!abort.signal.aborted) setError(true)
-            } finally {
-                if (!abort.signal.aborted) setLoading(false)
-            }
-        },
-        [modelId, departmentId, keyword, remember],
-    )
-    useEffect(() => {
-        const abort = new AbortController()
-        active.current = abort
-        setPage(null)
-        setLoading(true)
-        const timer = setTimeout(() => void load(false, abort), keyword ? 250 : 0)
-        return () => {
-            clearTimeout(timer)
-            abort.abort()
-        }
-    }, [keyword, refresh, retry, load])
-    return {
-        page,
-        loading,
-        error,
-        retry: () => setRetry((value) => value + 1),
-        more: () => {
-            if (!loading && page?.has_more && active.current) void load(true, active.current)
-        },
-    }
-}
-
 function MemberRows({
     items,
     users,
@@ -165,26 +93,34 @@ function MemberRows({
 function MemberList({
     modelId,
     departmentId,
-    refresh,
     users,
     saving,
     depth,
+    onLoadingChange,
 }: {
     modelId: number
     departmentId: number
-    refresh: number
     users: UserDrafts
     saving: boolean
     depth: number
+    onLoadingChange: (loading: boolean) => void
 }) {
     const { t } = useTranslation()
-    const state = useMembers(modelId, departmentId, undefined, refresh, users.remember)
+    const state = useAccessMembers(modelId, departmentId, undefined, users.remember)
+    useEffect(() => {
+        onLoadingChange(state.loading)
+        return () => onLoadingChange(false)
+    }, [state.loading, onLoadingChange])
     return (
         <>
-            <MemberRows items={state.page?.items ?? []} users={users} saving={saving} depth={depth} />
-            {(state.loading || state.error || state.page?.has_more) && (
+            <MemberRows
+                items={state.page?.items ?? []}
+                users={users}
+                saving={saving || state.loading || state.error}
+                depth={depth
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/useAccessMembers.test.tsx` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+import { act, fireEvent, render, screen } from '@testing-library/react'
+import { StrictMode, useState } from 'react'
+import { afterEach, beforeEach, expect, it, vi } from 'vitest'
+import { getDshModelUserPermissions } from '@/controllers/API/dsh'
+import type { DshModelUserPermissionPage } from '@/types/dsh'
+import { AccessMembersProvider, useAccessMembers, useDelayedMemberLoading } from './useAccessMembers'
+
+vi.mock('@/controllers/API/dsh', () => ({ getDshModelUserPermissions: vi.fn() }))
+const remember = vi.fn()
+const empty: DshModelUserPermissionPage = {
+    tenant_id: 1,
+    model: { id: 7, name: 'Model', is_root_shared: false },
+    items: [],
+    has_more: false,
+    next_cursor: null,
+}
+function Members({ modelId }: { modelId: number }) {
+    const state = useAccessMembers(modelId, 31, undefined, remember)
+    const indicator = useDelayedMemberLoading(state.loading)
+    return (
+        <>
+            <span data-testid="page">{state.page ? state.page.items.length : 'pending'}</span>
+            {indicator && <span role="status">Loading</span>}
+            {state.error && <button onClick={state.retry}>Retry</button>}
+            {state.page?.has_more && <button onClick={state.more}>More</button>}
+        </>
+    )
+}
+function Harness({ refresh = 0, modelId = 7 }: { refresh?: number; modelId?: number }) {
+    const [open, setOpen] = useState(true)
+    return (
+        <AccessMembersProvider modelId={modelId} refresh={refresh}>
+            <button onClick={() => setOpen((value) => !value)}>Toggle</button>
+            {open && <Members modelId={modelId} />}
+        </AccessMembersProvider>
+    )
+}
+const advance = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms))
+beforeEach(() => {
+    vi.useFakeTimers()
+    vi.resetAllMocks()
+    vi.mocked(getDshModelUserPermissions).mockResolvedValue(empty)
+})
+afterEach(() => {
+    vi.useRealTimers()
+})
+
+it('reuses an empty result when a department is collapsed and reopened', async () => {
+    render(<Harness />)
+    await advance()
+    expect(screen.getByTestId('page')).toHaveTextContent('0')
+    fireEvent.click(screen.getByText('Toggle'))
+    fireEvent.click(screen.getByText('Toggle'))
+    expect(screen.getByTestId('page')).toHaveTextContent('0')
+    await advance()
+    expect(getDshModelUserPermissions).toHaveBeenCalledTimes(1)
+    expect(screen.queryByRole('status')).toBeNull()
+})
+
+it('shares an in-flight request across collapse and reopen and cancels it on dialog close', async () => {
+    vi.mocked(getDshModelUserPermissions).mockReturnValue(new Promise(() => {}))
+    const view = render(<Harness />)
+    await advance()
+    const signal = vi.mocked(getDshModelUserPermissions).mock.calls[0][2]!
+    fireEvent.click(screen.getByText('Toggle'))
+    expect(signal.aborted).toBe(false)
+    fireEvent.click(screen.getByText('Toggle'))
+    await advance()
+    expect(getDshModelUserPermissions).toHaveBeenCalledTimes(1)
+    view.unmount()
+    expect(signal.aborted).toBe(true)
+})
+
+it('invalidates pages after a save and when model context changes', async () => {
+    const view = render(<Harness />)
+    await advance()
+    view.rerender(<Harness refresh={1} />)
+    await advance()
+    expect(getDshModelUserPermissions).toHaveBeenCalledTimes(2)
+    view.rerender(<Harness refresh={1} modelId={8} />)
+    await advance()
+    expect(getDshModelUserPermissions).toHaveBeenCalledTimes(3)
+    expect(getDshModelUserPermissions).toHaveBeenLastCalledWith(8, expect.anything(), expect.any(AbortSignal))
+})
+
+it('discards an old response when the save generation changes', async () => {
+    let complete!: (page: DshModelUserPermissionPage) => void
+    vi.mocked(getDshModelUserPermissions).mockReturnValueOnce(
+        new Promise((resolve) => {
+            complete = resolve
+        }),
+    )
+    const view = render(<Harness />)
+    await advance()
+    view.rerender(<Harness refresh={1} />)
+    await advance()
+    await act(async () => {
+        complete({ ...empty, has_more: true, next_cursor: '99' })
+    })
+    expect(screen.queryByText('More')).toBeNull()
+    expect(screen.getByTestId('page')).toHaveTextContent('0')
+})
+
+it('shows a delayed inline indicator for slow reads and keeps it visible for 300ms', async () => {
+    let complete!: (page: DshModelUserPermissionPage) => void
+    vi.mocked(getDshModelUserPermissions).mockReturnValueOnce(
+        new Promise((resolve) => {
+            complete = resolve
+        }),
+    )
+    render(<Harness />)
+    await advance(299)
+    expect(screen.queryByRole('status')).toBeNull()
+    await advance(1)
+    expect(screen.getByRole('status')).toBeTruthy()
+    await act(async () => {
+        complete(empty)
+    })
+    await advance(299)
+    expect(screen.getByRole('status')).toBeTruthy()
+    await advance(1)
+    expect(screen.queryByRole('status')).toBeNull()
+})
+
+it('retries a failed read without caching the error', a
```

**File**: `src/frontend/platform/src/pages/ModelPage/manage/dsh/useAccessMembers.tsx` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+import { getDshModelUserPermissions } from '@/controllers/API/dsh'
+import type { DshModelUserPermissionPage } from '@/types/dsh'
+import {
+    createContext,
+    useCallback,
+    useContext,
+    useEffect,
+    useMemo,
+    useRef,
+    useState,
+    type ReactNode,
+} from 'react'
+import type { useUserPolicyDrafts } from './useUserPolicyDrafts'
+
+type Page = DshModelUserPermissionPage
+type Entry = { page: Page | null; pending?: Promise<Page>; abort?: AbortController }
+type MembersScope = { modelId: number; refresh: number; pages: Map<string, Entry> }
+const MembersContext = createContext<MembersScope | null>(null)
+
+interface AccessMembersProviderProps {
+    modelId: number
+    refresh: number
+    children: ReactNode
+}
+
+export function AccessMembersProvider({ modelId, refresh, children }: AccessMembersProviderProps) {
+    // Keep pages and in-flight reads for this dialog only. Saving invalidates them.
+    const scope = useMemo(() => ({ modelId, refresh, pages: new Map<string, Entry>() }), [modelId, refresh])
+    useEffect(
+        () => () => {
+            scope.pages.forEach((entry) => entry.abort?.abort())
+            scope.pages.clear()
+        },
+        [scope],
+    )
+    return <MembersContext.Provider value={scope}>{children}</MembersContext.Provider>
+}
+
+export function useAccessMembers(
+    modelId: number,
+    departmentId: number | undefined,
+    keyword: string | undefined,
+    remember: ReturnType<typeof useUserPolicyDrafts>['remember'],
+) {
+    const scope = useContext(MembersContext)
+    if (!scope) throw new Error('AccessMembersProvider is required')
+    const cache = scope.pages
+    const key = JSON.stringify([modelId, departmentId, keyword || ''])
+    const [result, setResult] = useState<{ cache: typeof cache; key: string; page: Page | null }>(() => ({
+        cache,
+        key,
+        page: cache.get(key)?.page ?? null,
+    }))
+    const page = result.key === key ? result.page : (cache.get(key)?.page ?? null)
+    const [loading, setLoading] = useState(false)
+    const [error, setError] = useState(false)
+    const [retry, setRetry] = useState(0)
+    const generation = useRef(0)
+
+    const load = useCallback(
+        async (append: boolean, current: number) => {
+            const entry = cache.get(key) ?? { page: null }
+            cache.set(key, entry)
+            setError(false)
+            if (entry.page && !append && !entry.pending) {
+                remember(entry.page.items)
+                setResult({ cache, key, page: entry.page })
+                setLoading(false)
+                return
+            }
+            setLoading(true)
+            if (!entry.pending) {
+                const abort = new AbortController()
+                entry.abort = abort
+                entry.pending = getDshModelUserPermissions(
+                    modelId,
+                    {
+                        limit: 50,
+                        include_seats: true,
+                        membership: 'DIRECT',
+                        ...(departmentId === 0 ? { unassigned_only: true } : { department_id: departmentId }),
+                        keyword: keyword || undefined,
+                        cursor: append ? (entry.page?.next_cursor ?? undefined) : undefined,
+                    },
+                    abort.signal,
+                )
+                    .then((next) => {
+                        if (abort.signal.aborted) throw new Error('Member read cancelled')
+                        entry.page = {
+                            ...next,
+                            items: append ? [...(entry.page?.items ?? []), ...next.items] : next.items,
+                        }
+                        return entry.page
+                    })
+                    .finally(() => {
+                        entry.pending = undefined
+                    })
+            }
+            try {
+                const next = await entry.pending
+                if (generation.current !== current) return
+                remember(next.items)
+                setResult({ cache, key, page: next })
+            } catch {
+                if (generation.current === current) setError(true)
+            } finally {
+                if (generation.current === current) setLoading(false)
+            }
+        },
+        [cache, key, modelId, departmentId, keyword, remember],
+    )
+
+    useEffect(() => {
+        const current = ++generation.current
+        setLoading(!cache.get(key)?.page || Boolean(cache.get(key)?.pending))
+        setError(false)
+        const timer = setTimeout(() => void load(false, current), keyword ? 250 : 0)
+        // Collapsing preserves the request; closing the dialog cancels it in the provider.
+        return () => {
+            clearTimeout(timer)
+            generation.current += 1
+        }
+    }, [cache, key, keyword, retry, load])
+
+    return {
+        page,
+        loading,
+        er
```

#### Recent Merged Pull Requests:
- **PR #2442** (2026-09-29): fix(workflow): isolate telemetry failures on 3.0-beta2 (@dolphin0618)
- **PR #2441** (closed): fix(select): don't crash when a scroll-loading MultiSelect unmounts while open (@eastagiletracker)
- **PR #2439** (2026-09-23): Feat 2.5.0 sg up (@likaiaki)
- **PR #2438** (2026-09-23): Feat/3.0.0 beta2 pre (@zgqgit)
- **PR #2437** (closed): Feat/3.0.0 beta2 (@zgqgit)
- **PR #2436** (closed): fix(workflow): isolate telemetry failures (@luochen211)
- **PR #2434** (2026-09-22): fix(dsh): show seat failures in a transient toast with actionable reasons (@SuperstructureJH)
- **PR #2433** (2026-09-22): fix(dsh): 修正授权失败反馈和用户名搜索提示 (@SuperstructureJH)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
