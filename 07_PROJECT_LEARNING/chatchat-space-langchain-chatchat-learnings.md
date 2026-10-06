# Forensic Learning Record (Deep Inspection): chatchat-space/Langchain-Chatchat

> **Canonical Artifact**: `07_PROJECT_LEARNING/chatchat-space-langchain-chatchat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chatchat-space/Langchain-Chatchat](https://github.com/chatchat-space/Langchain-Chatchat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:25:03.535Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chatchat-space/Langchain-Chatchat`
- **Description**: Langchain-Chatchat（原Langchain-ChatGLM）基于 Langchain 与 ChatGLM, Qwen 与 Llama 等语言模型的 RAG 与 Agent 应用 | Langchain-Chatchat (formerly langchain-ChatGLM), local knowledge based LLM (like ChatGLM, Qwen and Llama) RAG and Agent app with langchain 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 38672 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libs/chatchat-server/chatchat/server/chat/utils.py`
```
import logging
from functools import lru_cache
from typing import Dict, List, Tuple, Union

from langchain.prompts.chat import ChatMessagePromptTemplate

from chatchat.server.pydantic_v2 import BaseModel, Field
from chatchat.utils import build_logger


logger = build_logger()


class History(BaseModel):
    """
    对话历史
    可从dict生成，如
    h = History(**{"role":"user","content":"你好"})
    也可转换为tuple，如
    h.to_msy_tuple = ("human", "你好")
    """

    role: str = Field(...)
    content: str = Field(...)

    def to_msg_tuple(self):
        return "ai" if self.role == "assistant" else "human", self.content

    def to_msg_template(self, is_raw=True) -> ChatMessagePromptTemplate:
        role_maps = {
            "ai": "assistant",
            "human": "user",
        }
        role = role_maps.get(self.role, self.role)
        if is_raw:  # 当前默认历史消息都是没有input_variable的文本。
            content = "{% raw %}" + self.content + "{% endraw %}"
        else:
            content = self.content

        return ChatMessagePromptTemplate.from_template(
            content,
            "jinja2",
            role=role,
        )

    @classmethod
    def from_data(cls, h: Union[List, Tuple, Dict]) -> "History":
        if isinstance(h, (list, tuple)) and len(h) >= 2:
            h = cls(role=h[0], content=h[1])
        elif isinstance(h, dict):
            h = cls(**h)

        return h

```

### Core Architecture Module: `libs/chatchat-server/chatchat/server/file_rag/utils.py`
```
from chatchat.server.file_rag.retrievers import (
    BaseRetrieverService,
    EnsembleRetrieverService,
    VectorstoreRetrieverService,
    MilvusVectorstoreRetrieverService,
)

Retrivals = {
    "milvusvectorstore": MilvusVectorstoreRetrieverService,
    "vectorstore": VectorstoreRetrieverService,
    "ensemble": EnsembleRetrieverService,
}


def get_Retriever(type: str = "vectorstore") -> BaseRetrieverService:
    return Retrivals[type]

```

### Core Architecture Module: `libs/chatchat-server/chatchat/server/knowledge_base/utils.py`
```
import importlib
import json
import os
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlencode
from typing import Dict, Generator, List, Tuple, Union

import chardet
import langchain_community.document_loaders
from langchain.docstore.document import Document
from langchain.text_splitter import MarkdownHeaderTextSplitter, TextSplitter
from langchain_community.document_loaders import JSONLoader, TextLoader

from chatchat.settings import Settings
from chatchat.server.file_rag.text_splitter import (
    zh_title_enhance as func_zh_title_enhance,
)
from chatchat.server.utils import run_in_process_pool, run_in_thread_pool
from chatchat.utils import build_logger


logger = build_logger()


def validate_kb_name(knowledge_base_id: str) -> bool:
    # 检查是否包含预期外的字符或路径攻击关键字
    if "../" in knowledge_base_id:
        return False
    return True


def get_kb_path(knowledge_base_name: str):
    return os.path.join(Settings.basic_settings.KB_ROOT_PATH, knowledge_base_name)


def get_doc_path(knowledge_base_name: str):
    return os.path.join(get_kb_path(knowledge_base_name), "content")


def get_vs_path(knowledge_base_name: str, vector_name: str):
    return os.path.join(get_kb_path(knowledge_base_name), "vector_store", vector_name)


def get_file_path(knowledge_base_name: str, doc_name: str):
    doc_path = Path(get_doc_path(knowledge_base_name)).resolve()
    file_path = (doc_path / doc_name).resolve()
    if str(file_path).startswith(str(doc_path)):
        return str(file_path)


def list_kbs_from_folder():
    return [
        f
        for f in os.listdir(Settings.basic_settings.KB_ROOT_PATH)
        if os.path.isdir(os.path.join(Settings.basic_settings.KB_ROOT_PATH, f))
    ]


def list_files_from_folder(kb_name: str):
    doc_path = get_doc_path(kb_name)
    result = []

    def is_skiped_path(path: str):
        tail = os.path.basename(path).lower()
        for x in ["temp", "tmp", ".", "~$"]:
            if tail.startswith(x):
                return True
        return False

    def process_entry(entry):
        if is_skiped_path(entry.path):
            return

        if entry.is_symlink():
            target_path = os.path.realpath(entry.path)
            with os.scandir(target_path) as target_it:
                for target_entry in target_it:
                    process_entry(target_entry)
        elif entry.is_file():
            file_path = Path(
                os.path.relpath(entry.path, doc_path)
            ).as_posix()  # 路径统一为 posix 格式
            result.append(file_path)
        elif entry.is_dir():
            with os.scandir(entry.path) as it:
                for sub_entry in it:
                    process_entry(sub_entry)

    with os.scandir(doc_path) as it:
        for entry in it:
            process_entry(entry)

    return result


LOADER_DICT = {
    "UnstructuredHTMLLoader": [".html", ".htm"],
    "MHTMLLoader": [".mhtml"],
    "TextLoader": [".md"],
    "UnstructuredMarkdownLoader": [".md"],
    "JSONLoader": [".json"],
    "JSONLinesLoader": [".jsonl"],
    "CSVLoader": [".csv"],
    # "FilteredCSVLoader": [".csv"], 如果使用自定义分割csv
    "RapidOCRPDFLoader": [".pdf"],
    "RapidOCRDocLoader": [".docx"],
    "RapidOCRPPTLoader": [
        ".ppt",
        ".pptx",
    ],
    "RapidOCRLoader": [".png", ".jpg", ".jpeg", ".bmp"],
    "UnstructuredFileLoader": [
        ".eml",
        ".msg",
        ".rst",
        ".rtf",
        ".txt",
        ".xml",
        ".epub",
        ".odt",
        ".tsv",
    ],
    "UnstructuredEmailLoader": [".eml", ".msg"],
    "UnstructuredEPubLoader": [".epub"],
    "UnstructuredExcelLoader": [".xlsx", ".xls", ".xlsd"],
    "NotebookLoader": [".ipynb"],
    "UnstructuredODTLoader": [".odt"],
    "PythonLoader": [".py"],
    "UnstructuredRSTLoader": [".rst"],
    "UnstructuredRTFLoader": [".rtf"],
    "SRTLoader": [".srt"],
    "TomlLoader": [".toml"],
    "UnstructuredTSVLoader": [".tsv"],
    "UnstructuredWordDocumentLoader": [".docx"],
    "UnstructuredXMLLoader": [".xml"],
    "UnstructuredPowerPointLoader": [".ppt", ".pptx"],
    "EverNoteLoader": [".enex"],
}
SUPPORTED_EXTS = [ext for sublist in LOADER_DICT.values() for ext in sublist]


# patch json.dumps to disable ensure_ascii
def _new_json_dumps(obj, **kwargs):
    kwargs["ensure_ascii"] = False
    return _origin_json_dumps(obj, **kwargs)


if json.dumps is not _new_json_dumps:
    _origin_json_dumps = json.dumps
    json.dumps = _new_json_dumps


class JSONLinesLoader(JSONLoader):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._json_lines = True


langchain_community.document_loaders.JSONLinesLoader = JSONLinesLoader


def get_LoaderClass(file_extension):
    for LoaderClass, extensions in LOADER_DICT.items():
        if file_extension in extensions:
            return LoaderClass


def get_loader(loader_name: str, file_path: str, loader_kwargs: Dict = None):
    """
    根据loader_name和文件路径或内容返回文档加载器。
    """
    loader_kwargs = loader_kwargs or {}
    try:
        if loader_name in [
            "RapidOCRPDFLoader",
            "RapidOCRLoader",
            "FilteredCSVLoader",
            "RapidOCRDocLoader",
            "RapidOCRPPTLoader",
        ]:
            document_loaders_module = importlib.import_module(
                "chatchat.server.file_rag.document_loaders"
            )
        else:
            document_loaders_module = importlib.import_module(
                "langchain_community.document_loaders"
            )
        DocumentLoader = getattr(document_loaders_module, loader_name)
    except Exception as e:
        msg = f"为文件{file_path}查找加载器{loader_name}时出错：{e}"
        logger.error(f"{e.__class__.__name__}: {msg}")
        document_loaders_module = importlib.import_module(
            "langchain_community.document_loaders"
        )
        DocumentLoader = getattr(document_loaders_module, "UnstructuredFileLoader")

    if loader_name == "UnstructuredFileLoader":
        loader_kwargs.setdefault("autodetect_encoding", True)
    elif loader_name == "CSVLoader":
        if not loader_kwargs.get("encoding"):
            # 如果未指定 encoding，自动识别文件编码类型，避免langchain loader 加载文件报编码错误
            with open(file_path, "rb") as struct_file:
                encode_detect = chardet.detect(struct_file.read())
            if encode_detect is None:
                encode_detect = {"encoding": "utf-8"}
            loader_kwargs["encoding"] = encode_detect["encoding"]

    elif loader_name == "JSONLoader":
        loader_kwargs.setdefault("jq_schema", ".")
        loader_kwargs.setdefault("text_content", False)
    elif loader_name == "JSONLinesLoader":
        loader_kwargs.setdefault("jq_schema", ".")
        loader_kwargs.setdefault("text_content", False)

    loader = DocumentLoader(file_path, **loader_kwargs)
    return loader


@lru_cache()
def make_text_splitter(splitter_name, chunk_size, chunk_overlap):
    """
    根据参数获取特定的分词器
    """
    splitter_name = splitter_name or "SpacyTextSplitter"
    try:
        if (
            splitter_name == "MarkdownHeaderTextSplitter"
        ):  # MarkdownHeaderTextSplitter特殊判定
            headers_to_split_on = Settings.kb_settings.text_splitter_dict[splitter_name][
                "headers_to_split_on"
            ]
            text_splitter = MarkdownHeaderTextSplitter(
                headers_to_split_on=headers_to_split_on, strip_headers=False
            )
        else:
            try:  # 优先使用用户自定义的text_splitter
                text_splitter_module = importlib.import_module("chatchat.server.file_rag.text_splitter")
                TextSplitter = getattr(text_splitter_module, splitter_name)
            except:  # 否则使用langchain的text_splitter
                text_splitter_module = importlib.import_module(
                    "langchain.text_splitter"
                )
                TextSplitter = getattr(text_splitter_module, splitter_name)

            if (
                Settings.kb_settings.text_splitter_dict[splitter_name]["source"] == "tiktoken"
            ):  # 从tiktoken加载
                try:
                    text_splitter = TextSplitter.from_tiktoken_encoder(
                        encoding_name=Settings.kb_settings.text_splitter_dict[splitter_name][
                            "tokenizer_name_or_path"
                        ],
                        pipeline="zh_core_web_sm",
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                    )
                except:
                    text_splitter = TextSplitter.from_tiktoken_encoder(
                        encoding_name=Settings.kb_settings.text_splitter_dict[splitter_name][
                            "tokenizer_name_or_path"
                        ],
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                    )
            elif (
                Settings.kb_settings.text_splitter_dict[splitter_name]["source"] == "huggingface"
            ):  # 从huggingface加载
                if (
                    Settings.kb_settings.text_splitter_dict[splitter_name]["tokenizer_name_or_path"]
                    == "gpt2"
                ):
                    from langchain.text_splitter import CharacterTextSplitter
                    from transformers import GPT2TokenizerFast

                    tokenizer = GPT2TokenizerFast.from_pretrained("gpt2")
                else:  # 字符长度加载
                    from transformers import AutoTokenizer

                    tokenizer = AutoTokenizer.from_pretrained(
                        Settings.kb_settings.text_splitter_dict[splitter_name]["tokenizer_name_or_path"],
                        trust_remote_code=True,
                    )
                text_splitter = TextSplitter.from_huggingface_tokenizer(
                    tokenizer=tokenizer,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )
```

### Core Architecture Module: `libs/chatchat-server/chatchat/server/utils.py`
```
import asyncio
import multiprocessing as mp
import os
import socket
import sys
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse
from typing import (
    Any,
    Awaitable,
    Callable,
    Dict,
    Generator,
    List,
    Literal,
    Optional,
    Tuple,
    Union,
)

import httpx
import openai
from fastapi import FastAPI
from langchain.tools import BaseTool
from langchain_core.embeddings import Embeddings
from langchain_openai.chat_models import ChatOpenAI
from langchain_openai.llms import OpenAI
from memoization import cached, CachingAlgorithmFlag

from chatchat.settings import Settings, XF_MODELS_TYPES
from chatchat.server.pydantic_v2 import BaseModel, Field
from chatchat.utils import build_logger
import requests

from langchain_chatchat.embeddings.zhipuai import ZhipuAIEmbeddings

logger = build_logger()


async def wrap_done(fn: Awaitable, event: asyncio.Event):
    """Wrap an awaitable with a event to signal when it's done or an exception is raised."""
    try:
        await fn
    except Exception as e:
        msg = f"Caught exception: {e}"
        logger.error(f"{e.__class__.__name__}: {msg}")
    finally:
        # Signal the aiter to stop.
        event.set()


def get_base_url(url):
    parsed_url = urlparse(url)  # 解析url
    base_url = '{uri.scheme}://{uri.netloc}/'.format(uri=parsed_url)  # 格式化基础url
    return base_url.rstrip('/')


def get_config_platforms() -> Dict[str, Dict]:
    """
    获取配置的模型平台，会将 pydantic model 转换为字典。
    """
    platforms = [m.model_dump() for m in Settings.model_settings.MODEL_PLATFORMS]
    return {m["platform_name"]: m for m in platforms}


@cached(max_size=10, ttl=60, algorithm=CachingAlgorithmFlag.LRU)
def detect_xf_models(xf_url: str) -> Dict[str, List[str]]:
    '''
    use cache for xinference model detecting to avoid:
    - too many requests in short intervals
    - multiple requests to one platform for every model
    the cache will be invalidated after one minute
    '''
    xf_model_type_maps = {
        "llm_models": lambda xf_models: [k for k, v in xf_models.items()
                                         if "LLM" == v["model_type"]
                                         and "vision" not in v["model_ability"]],
        "embed_models": lambda xf_models: [k for k, v in xf_models.items()
                                           if "embedding" == v["model_type"]],
        "text2image_models": lambda xf_models: [k for k, v in xf_models.items()
                                                if "image" == v["model_type"]],
        "image2image_models": lambda xf_models: [k for k, v in xf_models.items()
                                                 if "image" == v["model_type"]],
        "image2text_models": lambda xf_models: [k for k, v in xf_models.items()
                                                if "LLM" == v["model_type"]
                                                and "vision" in v["model_ability"]],
        "rerank_models": lambda xf_models: [k for k, v in xf_models.items()
                                            if "rerank" == v["model_type"]],
        "speech2text_models": lambda xf_models: [k for k, v in xf_models.items()
                                                 if v.get(list(XF_MODELS_TYPES["speech2text"].keys())[0])
                                                 in XF_MODELS_TYPES["speech2text"].values()],
        "text2speech_models": lambda xf_models: [k for k, v in xf_models.items()
                                                 if v.get(list(XF_MODELS_TYPES["text2speech"].keys())[0])
                                                 in XF_MODELS_TYPES["text2speech"].values()],
    }
    models = {}
    try:
        from xinference_client import RESTfulClient as Client
        xf_client = Client(xf_url)
        xf_models = xf_client.list_models()
        for m_type, filter in xf_model_type_maps.items():
            models[m_type] = filter(xf_models)
    except ImportError:
        logger.warning('auto_detect_model needs xinference-client installed. '
                       'Please try "pip install xinference-client". ')
    except requests.exceptions.ConnectionError:
        logger.warning(f"cannot connect to xinference host: {xf_url}, please check your configuration.")
    except Exception as e:
        logger.warning(f"error when connect to xinference server({xf_url}): {e}")
    return models


def get_config_models(
        model_name: str = None,
        model_type: Optional[Literal[
            "llm", "embed", "text2image", "image2image", "image2text", "rerank", "speech2text", "text2speech"
        ]] = None,
        platform_name: str = None,
) -> Dict[str, Dict]:
    """
    获取配置的模型列表，返回值为:
    {model_name: {
        "platform_name": xx,
        "platform_type": xx,
        "model_type": xx,
        "model_name": xx,
        "api_base_url": xx,
        "api_key": xx,
        "api_proxy": xx,
    }}
    """
    result = {}
    if model_type is None:
        model_types = [
            "llm_models",
            "embed_models",
            "text2image_models",
            "image2image_models",
            "image2text_models",
            "rerank_models",
            "speech2text_models",
            "text2speech_models",
        ]
    else:
        model_types = [f"{model_type}_models"]

    for m in list(get_config_platforms().values()):
        if platform_name is not None and platform_name != m.get("platform_name"):
            continue

        if m.get("auto_detect_model"):
            if not m.get("platform_type") == "xinference":  # TODO：当前仅支持 xf 自动检测模型
                logger.warning(f"auto_detect_model not supported for {m.get('platform_type')} yet")
                continue
            xf_url = get_base_url(m.get("api_base_url"))
            xf_models = detect_xf_models(xf_url)
            for m_type in model_types:
                # if m.get(m_type) != "auto":
                #     continue
                m[m_type] = xf_models.get(m_type, [])

        for m_type in model_types:
            models = m.get(m_type, [])
            if models == "auto":
                logger.warning("you should not set `auto` without auto_detect_model=True")
                continue
            elif not models:
                continue
            for m_name in models:
                if model_name is None or model_name == m_name:
                    result[m_name] = {
                        "platform_name": m.get("platform_name"),
                        "platform_type": m.get("platform_type"),
                        "model_type": m_type.split("_")[0],
                        "model_name": m_name,
                        "api_base_url": m.get("api_base_url"),
                        "api_key": m.get("api_key"),
                        "api_proxy": m.get("api_proxy"),
                    }
    return result


def get_model_info(
        model_name: str = None, platform_name: str = None, multiple: bool = False
) -> Dict:
    """
    获取配置的模型信息，主要是 api_base_url, api_key
    如果指定 multiple=True，则返回所有重名模型；否则仅返回第一个
    """
    result = get_config_models(model_name=model_name, platform_name=platform_name)
    if len(result) > 0:
        if multiple:
            return result
        else:
            return list(result.values())[0]
    else:
        return {}


def get_default_llm():
    available_llms = list(get_config_models(model_type="llm").keys())
    if Settings.model_settings.DEFAULT_LLM_MODEL in available_llms:
        return Settings.model_settings.DEFAULT_LLM_MODEL
    else:
        logger.warning(f"default llm model {Settings.model_settings.DEFAULT_LLM_MODEL} is not found in available llms, "
                       f"using {available_llms[0]} instead")
        return available_llms[0]


def get_default_embedding():
    available_embeddings = list(get_config_models(model_type="embed").keys())
    if Settings.model_settings.DEFAULT_EMBEDDING_MODEL in available_embeddings:
        return Settings.model_settings.DEFAULT_EMBEDDING_MODEL
    else:
        logger.warning(f"default embedding model {Settings.model_settings.DEFAULT_EMBEDDING_MODEL} is not found in "
                       f"available embeddings, using {available_embeddings[0]} instead")
        return available_embeddings[0]


def get_history_len() -> int:
    return (Settings.model_settings.HISTORY_LEN or
            Settings.model_settings.LLM_MODEL_CONFIG["action_model"]["history_len"])


def get_ChatOpenAI(
        model_name: str = get_default_llm(),
        temperature: float = Settings.model_settings.TEMPERATURE,
        max_tokens: int = Settings.model_settings.MAX_TOKENS,
        streaming: bool = True,
        callbacks: List[Callable] = [],
        verbose: bool = True,
        local_wrap: bool = False,  # use local wrapped api
        **kwargs: Any,
) -> ChatOpenAI:
    model_info = get_model_info(model_name)
    params = dict(
        streaming=streaming,
        verbose=verbose,
        callbacks=callbacks,
        model_name=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
        **kwargs,
    )
    # remove paramters with None value to avoid openai validation error
    for k in list(params):
        if params[k] is None:
            params.pop(k)

    try:
        if local_wrap:
            params.update(
                openai_api_base=f"{api_address()}/v1",
                openai_api_key="EMPTY",
            )
        else:
            params.update(
                openai_api_base=model_info.get("api_base_url"),
                openai_api_key=model_info.get("api_key"),
                openai_proxy=model_info.get("api_proxy"),
            )
        model = ChatOpenAI(**params)
    except Exception as e:
        logger.exception(f"failed to create ChatOpenAI for model: {model_name}.")
        model = None
    return model


def get_ChatPlatformAIParams(
        model_name: str = get_default_llm(),
        temperature: 
```

### Core Architecture Module: `libs/chatchat-server/chatchat/utils.py`
```
from functools import partial
import logging
import os
import time
import typing as t

import loguru
import loguru._logger
from memoization import cached, CachingAlgorithmFlag
from chatchat.settings import Settings


def _filter_logs(record: dict) -> bool:
    # hide debug logs if Settings.basic_settings.log_verbose=False 
    if record["level"].no <= 10 and not Settings.basic_settings.log_verbose:
        return False
    # hide traceback logs if Settings.basic_settings.log_verbose=False 
    if record["level"].no == 40 and not Settings.basic_settings.log_verbose:
        record["exception"] = None
    return True


# 默认每调用一次 build_logger 就会添加一次 hanlder，导致 chatchat.log 里重复输出
@cached(max_size=100, algorithm=CachingAlgorithmFlag.LRU)
def build_logger(log_file: str = "chatchat"):
    """
    build a logger with colorized output and a log file, for example:

    logger = build_logger("api")
    logger.info("<green>some message</green>")

    user can set basic_settings.log_verbose=True to output debug logs
    use logger.exception to log errors with exceptions
    """
    loguru.logger._core.handlers[0]._filter = _filter_logs
    logger = loguru.logger.opt(colors=True)
    logger.opt = partial(loguru.logger.opt, colors=True)
    logger.warn = logger.warning
    # logger.error = partial(logger.exception)

    if log_file:
        if not log_file.endswith(".log"):
            log_file = f"{log_file}.log"
        if not os.path.isabs(log_file):
            log_file = str((Settings.basic_settings.LOG_PATH / log_file).resolve())
        logger.add(log_file, colorize=False, filter=_filter_logs)

    return logger


logger = logging.getLogger(__name__)


class LoggerNameFilter(logging.Filter):
    def filter(self, record):
        # return record.name.startswith("{}_core") or record.name in "ERROR" or (
        #         record.name.startswith("uvicorn.error")
        #         and record.getMessage().startswith("Uvicorn running on")
        # )
        return True


def get_log_file(log_path: str, sub_dir: str):
    """
    sub_dir should contain a timestamp.
    """
    log_dir = os.path.join(log_path, sub_dir)
    # Here should be creating a new directory each time, so `exist_ok=False`
    os.makedirs(log_dir, exist_ok=False)
    return os.path.join(log_dir, f"{sub_dir}.log")


def get_config_dict(
        log_level: str, log_file_path: str, log_backup_count: int, log_max_bytes: int
) -> dict:
    # for windows, the path should be a raw string.
    log_file_path = (
        log_file_path.encode("unicode-escape").decode()
        if os.name == "nt"
        else log_file_path
    )
    log_level = log_level.upper()
    config_dict = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "formatter": {
                "format": (
                    "%(asctime)s %(name)-12s %(process)d %(levelname)-8s %(message)s"
                )
            },
        },
        "filters": {
            "logger_name_filter": {
                "()": __name__ + ".LoggerNameFilter",
            },
        },
        "handlers": {
            "stream_handler": {
                "class": "logging.StreamHandler",
                "formatter": "formatter",
                "level": log_level,
                # "stream": "ext://sys.stdout",
                # "filters": ["logger_name_filter"],
            },
            "file_handler": {
                "class": "logging.handlers.RotatingFileHandler",
                "formatter": "formatter",
                "level": log_level,
                "filename": log_file_path,
                "mode": "a",
                "maxBytes": log_max_bytes,
                "backupCount": log_backup_count,
                "encoding": "utf8",
            },
        },
        "loggers": {
            "chatchat_core": {
                "handlers": ["stream_handler", "file_handler"],
                "level": log_level,
                "propagate": False,
            }
        },
        "root": {
            "level": log_level,
            "handlers": ["stream_handler", "file_handler"],
        },
    }
    return config_dict


def get_timestamp_ms():
    t = time.time()
    return int(round(t * 1000))

```

### Core Architecture Module: `libs/chatchat-server/chatchat/webui_pages/dialogue/utils.py`
```
import base64
import os
from io import BytesIO

import streamlit as st


def encode_file_to_base64(file):
    # 将文件内容转换为 Base64 编码
    buffer = BytesIO()
    buffer.write(file.read())
    return base64.b64encode(buffer.getvalue()).decode()


def process_files(files):
    result = {"videos": [], "images": [], "audios": []}
    for file in files:
        file_extension = os.path.splitext(file.name)[1].lower()

        # 检测文件类型并进行相应的处理
        if file_extension in [".mp4", ".avi"]:
            # 视频文件处理
            video_base64 = encode_file_to_base64(file)
            result["videos"].append(video_base64)
        elif file_extension in [".jpg", ".png", ".jpeg"]:
            # 图像文件处理
            image_base64 = encode_file_to_base64(file)
            result["images"].append(image_base64)
        elif file_extension in [".mp3", ".wav", ".ogg", ".flac"]:
            # 音频文件处理
            audio_base64 = encode_file_to_base64(file)
            result["audios"].append(audio_base64)

    return result

```

### Core Architecture Module: `libs/chatchat-server/chatchat/webui_pages/utils.py`
```
# 该文件封装了对api.py的请求，可以被不同的webui使用
# 通过ApiRequest和AsyncApiRequest支持同步/异步调用

import base64
import contextlib
import json
import logging
import os
from io import BytesIO
from pathlib import Path
from typing import *

import httpx

from chatchat.settings import Settings
from chatchat.server.utils import api_address, get_httpx_client, set_httpx_config, get_default_embedding
from chatchat.utils import build_logger


logger = build_logger()

set_httpx_config()


class ApiRequest:
    """
    api.py调用的封装（同步模式）,简化api调用方式
    """

    def __init__(
        self,
        base_url: str = api_address(),
        timeout: float = Settings.basic_settings.HTTPX_DEFAULT_TIMEOUT,
    ):
        self.base_url = base_url
        self.timeout = timeout
        self._use_async = False
        self._client = None

    @property
    def client(self):
        if self._client is None or self._client.is_closed:
            self._client = get_httpx_client(
                base_url=self.base_url, use_async=self._use_async, timeout=self.timeout
            )
        return self._client

    def get(
        self,
        url: str,
        params: Union[Dict, List[Tuple], bytes] = None,
        retry: int = 3,
        stream: bool = False,
        **kwargs: Any,
    ) -> Union[httpx.Response, Iterator[httpx.Response], None]:
        while retry > 0:
            try:
                if stream:
                    return self.client.stream("GET", url, params=params, **kwargs)
                else:
                    return self.client.get(url, params=params, **kwargs)
            except Exception as e:
                msg = f"error when get {url}: {e}"
                logger.error(f"{e.__class__.__name__}: {msg}")
                retry -= 1

    def post(
        self,
        url: str,
        data: Dict = None,
        json: Dict = None,
        retry: int = 3,
        stream: bool = False,
        **kwargs: Any,
    ) -> Union[httpx.Response, Iterator[httpx.Response], None]:
        while retry > 0:
            try:
                # print(kwargs)
                if stream:
                    return self.client.stream(
                        "POST", url, data=data, json=json, **kwargs
                    )
                else:
                    return self.client.post(url, data=data, json=json, **kwargs)
            except Exception as e:
                msg = f"error when post {url}: {e}"
                logger.error(f"{e.__class__.__name__}: {msg}")
                retry -= 1

    def delete(
        self,
        url: str,
        data: Dict = None,
        json: Dict = None,
        retry: int = 3,
        stream: bool = False,
        **kwargs: Any,
    ) -> Union[httpx.Response, Iterator[httpx.Response], None]:
        while retry > 0:
            try:
                if stream:
                    return self.client.stream(
                        "DELETE", url, data=data, json=json, **kwargs
                    )
                else:
                    return self.client.delete(url, data=data, json=json, **kwargs)
            except Exception as e:
                msg = f"error when delete {url}: {e}"
                logger.error(f"{e.__class__.__name__}: {msg}")
                retry -= 1

    def put(
        self,
        url: str,
        data: Dict = None,
        json: Dict = None,
        retry: int = 3,
        stream: bool = False,
        **kwargs: Any,
    ) -> Union[httpx.Response, Iterator[httpx.Response], None]:
        while retry > 0:
            try:
                if stream:
                    return self.client.stream(
                        "PUT", url, data=data, json=json, **kwargs
                    )
                else:
                    return self.client.put(url, data=data, json=json, **kwargs)
            except Exception as e:
                msg = f"error when put {url}: {e}"
                logger.error(f"{e.__class__.__name__}: {msg}")
                retry -= 1

    def _httpx_stream2generator(
        self,
        response: contextlib._GeneratorContextManager,
        as_json: bool = False,
    ):
        """
        将httpx.stream返回的GeneratorContextManager转化为普通生成器
        """

        async def ret_async(response, as_json):
            try:
                async with response as r:
                    chunk_cache = ""
                    async for chunk in r.aiter_text(None):
                        if not chunk:  # fastchat api yield empty bytes on start and end
                            continue
                        if as_json:
                            try:
                                if chunk.startswith("data: "):
                                    data = json.loads(chunk_cache + chunk[6:-2])
                                elif chunk.startswith(":"):  # skip sse comment line
                                    continue
                                else:
                                    data = json.loads(chunk_cache + chunk)

                                chunk_cache = ""
                                yield data
                            except Exception as e:
                                msg = f"接口返回json错误： ‘{chunk}’。错误信息是：{e}。"
                                logger.error(f"{e.__class__.__name__}: {msg}")

                                if chunk.startswith("data: "):
                                    chunk_cache += chunk[6:-2]
                                elif chunk.startswith(":"):  # skip sse comment line
                                    continue
                                else:
                                    chunk_cache += chunk
                                continue
                        else:
                            # print(chunk, end="", flush=True)
                            yield chunk
            except httpx.ConnectError as e:
                msg = f"无法连接API服务器，请确认 ‘api.py’ 已正常启动。({e})"
                logger.error(msg)
                yield {"code": 500, "msg": msg}
            except httpx.ReadTimeout as e:
                msg = f"API通信超时，请确认已启动FastChat与API服务（详见Wiki '5. 启动 API 服务或 Web UI'）。（{e}）"
                logger.error(msg)
                yield {"code": 500, "msg": msg}
            except Exception as e:
                msg = f"API通信遇到错误：{e}"
                logger.error(f"{e.__class__.__name__}: {msg}")
                yield {"code": 500, "msg": msg}

        def ret_sync(response, as_json):
            try:
                with response as r:
                    chunk_cache = ""
                    for chunk in r.iter_text(None):
                        if not chunk:  # fastchat api yield empty bytes on start and end
                            continue
                        if as_json:
                            try:
                                if chunk.startswith("data: "):
                                    data = json.loads(chunk_cache + chunk[6:-2])
                                elif chunk.startswith(":"):  # skip sse comment line
                                    continue
                                else:
                                    data = json.loads(chunk_cache + chunk)

                                chunk_cache = ""
                                yield data
                            except Exception as e:
                                msg = f"接口返回json错误： ‘{chunk}’。错误信息是：{e}。"
                                logger.error(f"{e.__class__.__name__}: {msg}")

                                if chunk.startswith("data: "):
                                    chunk_cache += chunk[6:-2]
                                elif chunk.startswith(":"):  # skip sse comment line
                                    continue
                                else:
                                    chunk_cache += chunk
                                continue
                        else:
                            # print(chunk, end="", flush=True)
                            yield chunk
            except httpx.ConnectError as e:
                msg = f"无法连接API服务器，请确认 ‘api.py’ 已正常启动。({e})"
                logger.error(msg)
                yield {"code": 500, "msg": msg}
            except httpx.ReadTimeout as e:
                msg = f"API通信超时，请确认已启动FastChat与API服务（详见Wiki '5. 启动 API 服务或 Web UI'）。（{e}）"
                logger.error(msg)
                yield {"code": 500, "msg": msg}
            except Exception as e:
                msg = f"API通信遇到错误：{e}"
                logger.error(f"{e.__class__.__name__}: {msg}")
                yield {"code": 500, "msg": msg}

        if self._use_async:
            return ret_async(response, as_json)
        else:
            return ret_sync(response, as_json)

    def _get_response_value(
        self,
        response: httpx.Response,
        as_json: bool = False,
        value_func: Callable = None,
    ):
        """
        转换同步或异步请求返回的响应
        `as_json`: 返回json
        `value_func`: 用户可以自定义返回值，该函数接受response或json
        """

        def to_json(r):
            try:
                return r.json()
            except Exception as e:
                msg = "API未能返回正确的JSON。" + str(e)
                logger.error(f"{e.__class__.__name__}: {msg}")
                return {"code": 500, "msg": msg, "data": None}

        if value_func is None:
            value_func = lambda r: r

        async def ret_async(response):
            if as_json:
                return value_func(to_json(await response))
            else:
                return value_func(await response)

        if self._use_async:
            return ret_async(response)
        else:
            if as_json:
                return value_func(to_json(response))
            else:
                return value_func(response)

    # 服务器信息
    def get_server_configs(self, **kwargs) -> Dict:
        response = self.post("/server/configs", **kwargs)
        return self._get_response_value(response, as_json=True)

    def get_prompt_template(
        self,
        type: str = "llm_chat",
    
```

### Core Architecture Module: `libs/chatchat-server/langchain_chatchat/agents/output_parsers/tools_output/_utils.py`
```
# -*- coding: utf-8 -*-
# Function to find positions of object() instances
def find_object_positions(log_chunk, obj):
    return [i for i, x in enumerate(log_chunk) if x == obj]


# Function to concatenate segments based on object positions
def concatenate_segments(log_chunk, positions):
    segments = []
    start = 0
    for pos in positions:
        segments.append("".join(map(str, log_chunk[start:pos])))
        start = pos + 1
    return segments

```

### Core Architecture Module: `libs/chatchat-server/langchain_chatchat/callbacks/core/protocol.py`
```
from __future__ import annotations
from typing import Generic, Iterable, TypeVar

from pydantic import BaseModel, field_validator

from datetime import datetime

class FunctionCall(BaseModel):
    run_id: str
    call_id: str


class FunctionCallStatus(BaseModel):
    requested_at: datetime | None = None
    responded_at: datetime | None = None
    approved: bool | None = None
    comment: str | None = None
    reject_option_name: str | None = None
    slack_message_ts: str | None = None


class AgentStore:
    """
    allows for creating and checking the status of
    """

    def add(self, item: FunctionCall) -> FunctionCall:
        raise NotImplementedError()

    def get(self, call_id: str) -> FunctionCall:
        raise NotImplementedError()

    def respond(self, call_id: str, status: FunctionCallStatus) -> FunctionCall:
        raise NotImplementedError()


class AgentBackend:
    def functions(self) -> AgentStore:
        raise NotImplementedError()

```

### Core Architecture Module: `libs/chatchat-server/langchain_chatchat/utils/__init__.py`
```
# -*- coding: utf-8 -*-
from langchain_chatchat.utils.history import History
import pydantic
PYDANTIC_V2 = pydantic.VERSION.startswith("2.")

__all__ = ["History", "PYDANTIC_V2"]
```

### Core Architecture Module: `libs/chatchat-server/langchain_chatchat/utils/history.py`
```
# -*- coding: utf-8 -*-
import logging
from functools import lru_cache
from typing import Any, Dict, List, Tuple, Union

from langchain.prompts.chat import ChatMessagePromptTemplate
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    BaseMessageChunk,
    ChatMessage,
    ChatMessageChunk,
    FunctionMessage,
    FunctionMessageChunk,
    HumanMessage,
    HumanMessageChunk,
    SystemMessage,
    SystemMessageChunk,
    ToolMessage,
    ToolMessageChunk,
)
from openai import BaseModel

logger = logging.getLogger()


def _convert_message_to_dict(message: BaseMessage) -> dict:
    """Convert a LangChain message to a dictionary.

    Args:
        message: The LangChain message.

    Returns:
        The dictionary.
    """
    message_dict: Dict[str, Any]
    if isinstance(message, ChatMessage):
        message_dict = {"role": message.role, "content": message.content}
    elif isinstance(message, HumanMessage):
        message_dict = {"role": "user", "content": message.content}
    elif isinstance(message, AIMessage):
        message_dict = {"role": "assistant", "content": message.content}
        if "function_call" in message.additional_kwargs:
            message_dict["function_call"] = message.additional_kwargs["function_call"]
            # If function call only, content is None not empty string
            if message_dict["content"] == "":
                message_dict["content"] = None
        if "tool_calls" in message.additional_kwargs:
            message_dict["tool_calls"] = message.additional_kwargs["tool_calls"]
            # If tool calls only, content is None not empty string
            if message_dict["content"] == "":
                message_dict["content"] = None
    elif isinstance(message, SystemMessage):
        message_dict = {"role": "system", "content": message.content}
    elif isinstance(message, FunctionMessage):
        message_dict = {
            "role": "function",
            "content": message.content,
            "name": message.name,
        }
    elif isinstance(message, ToolMessage):
        message_dict = {
            "role": "tool",
            "content": message.content,
            "tool_call_id": message.tool_call_id,
        }
    else:
        raise TypeError(f"Got unknown type {message}")
    if "name" in message.additional_kwargs:
        message_dict["name"] = message.additional_kwargs["name"]
    return message_dict


class History(BaseModel):
    """
    对话历史
    可从dict生成，如
    h = History(**{"role":"user","content":"你好"})
    也可转换为tuple，如
    h.to_msy_tuple = ("human", "你好")
    """

    role: str
    content: str

    def to_msg_tuple(self):
        return "ai" if self.role == "assistant" else "human", self.content

    def to_msg_template(self, is_raw=True) -> ChatMessagePromptTemplate:
        role_maps = {
            "ai": "assistant",
            "human": "user",
        }
        role = role_maps.get(self.role, self.role)
        if is_raw:  # 当前默认历史消息都是没有input_variable的文本。
            content = "{% raw %}" + self.content + "{% endraw %}"
        else:
            content = self.content

        return ChatMessagePromptTemplate.from_template(
            content,
            "jinja2",
            role=role,
        )

    @classmethod
    def from_data(cls, h: Union[List, Tuple, Dict]) -> "History":
        if isinstance(h, (list, tuple)) and len(h) >= 2:
            h = cls(role=h[0], content=h[1])
        elif isinstance(h, dict):
            h = cls(**h)

        return h

    @classmethod
    def from_message(cls, message: BaseMessage) -> "History":
        return cls.from_data(_convert_message_to_dict(message=message))

```

### Core Architecture Module: `libs/chatchat-server/langchain_chatchat/utils/try_parse_json_object.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Utility functions for the OpenAI API."""

import json
import logging
import re
import ast

from json_repair import repair_json

log = logging.getLogger(__name__)


def try_parse_ast_to_json(function_string: str) -> tuple[str, dict]:
    """
     # 示例函数字符串
    function_string = "tool_call(first_int={'title': 'First Int', 'type': 'integer'}, second_int={'title': 'Second Int', 'type': 'integer'})"
    :return:
    """

    tree = ast.parse(str(function_string).strip())
    ast_info = ""
    json_result = {}
    # 查找函数调用节点并提取信息
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            function_name = node.func.id
            args = {kw.arg: kw.value for kw in node.keywords}
            ast_info += f"Function Name: {function_name}\r\n"
            for arg, value in args.items():
                ast_info += f"Argument Name: {arg}\n"
                ast_info += f"Argument Value: {ast.dump(value)}\n"
                json_result[arg] = ast.literal_eval(value)

    return ast_info, json_result


def try_parse_json_object(input: str) -> tuple[str, dict]:
    """JSON cleaning and formatting utilities."""
    # Sometimes, the LLM returns a json string with some extra description, this function will clean it up.

    result = None
    try:
        # Try parse first
        result = json.loads(input)
    except json.JSONDecodeError:
        log.info("Warning: Error decoding faulty json, attempting repair")

    if result:
        return input, result

    _pattern = r"\{(.*)\}"
    _match = re.search(_pattern, input)
    input = "{" + _match.group(1) + "}" if _match else input

    # Clean up json string.
    input = (
        input.replace("{{", "{")
        .replace("}}", "}")
        .replace('"[{', "[{")
        .replace('}]"', "}]")
        .replace("\\", " ")
        .replace("\\n", " ")
        .replace("\n", " ")
        .replace("\r", "")
        .strip()
    )

    # Remove JSON Markdown Frame
    if input.startswith("```"):
        input = input[len("```"):]
    if input.startswith("```json"):
        input = input[len("```json"):]
    if input.endswith("```"):
        input = input[: len(input) - len("```")]

    try:
        result = json.loads(input)
    except json.JSONDecodeError:
        # Fixup potentially malformed json string using json_repair.
        json_info = str(repair_json(json_str=input, return_objects=False))

        # Generate JSON-string output using best-attempt prompting & parsing techniques.
        try:

            if len(json_info) < len(input):
                json_info, result = try_parse_ast_to_json(input)
            else:
                result = json.loads(json_info)

        except json.JSONDecodeError:
            log.exception("error loading json, json=%s", input)
            return json_info, {}
        else:
            if not isinstance(result, dict):
                log.exception("not expected dict type. type=%s:", type(result))
                return json_info, {}
            return json_info, result
    else:
        return input, result

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5490** (2026-08-26): **[BUG] 简洁阐述问题 / Unauthenticated recursive directory deletion**
  *Symptoms*: 问题描述 / Problem Description  Langchain-Chatchat does not properly restrict knowledge_base_name to the configured KB_ROOT_PATH.  The validation only rejects the literal substring ../. It does not reject absolute paths or verify that the resolved path remains inside KB_ROOT_PATH. When an absolute path is supplied, os.path.join() ignores the configured root.  An unauthenticated user can therefore register an absolute path as a knowledge-base name and subsequently invoke the knowledge-base deletion operation. With the FAISS backend, this reaches shutil.rmtree(self.kb_path) and recursively deletes the selected directory.  The impact is limited to files and directories that the Langchain-Chatchat service account has permission to remove. This report does not claim arbitrary file reading or remote code execution.  复现问题的步骤 / Steps to Reproduce  Safety requirement: perform this test only in an isolated local environment. Use a newly created disposable directory outside KB_ROOT_PATH. Do not use a production system, shared directory, home directory, application directory, or filesystem root.  Configure an isolated Langchain-Chatchat instance with the FAISS vector backend and a disposable KB_ROOT_PATH.  Create a separate disposable victim directory outside KB_ROOT_PATH. Add a marker file and nested directory to it.  Example structure:  <TEST_ROOT>/ ├── kb-root/ └── disposable-victim/     ├── marker.txt     └── nested/         └── test.txt Verify that the victim directory is not contained 
  **Post-Mortem & Fix Analysis**:
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

- **Issue #5483** (2026-07-24): **[BUG] /tools/call 接口未鉴权导致越权及任意系统命令执行 (RCE)**
  *Symptoms*: 问题描述 / Problem Description 项目中的工具调用 API 路由存在未授权访问漏洞。tool_routes.py 中的 /tools/call POST 接口缺乏身份验证机制，允许任意外部请求访问。同时，shell.py 中注册的 shell 工具直接封装了 ShellTool，未对外部输入进行安全过滤。攻击者可以通过未鉴权的 API 越权调用 shell 工具，传入恶意载荷，从而在服务器宿主机上执行任意系统命令，获取服务器控制权。  复现问题的步骤 / Steps to Reproduce  1. 部署并启动 Langchain-Chatchat 服务（需包含系统命令工具配置）。  2. 在未经任何身份认证的情况下，向服务器发送如下构造的恶意 POST 请求： POST /tools/call HTTP/1.1 Content-Type: application/json  {   "name": "shell",   "tool_input": {     "query": "whoami && id"    } }  3. 检查服务器端状态以及接口返回的响应数据。  4. 问题出现：由于缺乏鉴权，API 成功接纳请求，并将 query 参数传递给 ShellTool 执行。  预期的结果 / Expected Result 敏感的 API 接口（特别是涉及工具调用的 /tools/call）应当受到严格的身份鉴权保护（如 Token 校验）。未经授权的访问应当被拒绝（返回 HTTP 401/403 状态码）。此外，高危工具（如系统命令执行）不应直接暴露，或应对输入参数进行严格的沙箱隔离和过滤。  实际结果 / Actual Result 接口无需任何凭证即可调用。通过 tool_input 传入的系统命令被宿主机直接执行，且执行结果会明文返回在响应包的 data 字段中，造成严重的安全风险（RCE）。
  **Post-Mortem & Fix Analysis**:
  > <!-- Answer --> This is a confirmed and previously reported vulnerability. Two earlier issues reported the same Pre-Auth RCE:  - [#5456 - Security: Unauthenticated RCE via /tools/call shell endpoint (CVSS 10.0)](https://github.com/chatchat-space/Langchain-Chatchat/issues/5456) [[1]](https://github.com/chatchat-space/Langchain-Chatchat/issues/5456) - [#5460 - Pre-Auth RCE via Unauthenticated Shell Tool Invocation](https://github.com/chatchat-space/Langchain-Chatchat/issues/5460) [[2]](https://github.com/chatchat-space/Langchain-Chatchat/issues/5460)  Both were closed by the stale bot without a fix being merged.  From reviewing the code, the root causes are confirmed:  1. **No authentication on `/tools/call`** — The endpoint in `tool_routes.py` accepts `name` and `tool_input` with no auth checks, decorators, or middleware [[3]](https://github.com/chatchat-space/Langchain-Chatchat/blob/9ac1918aad52f3aa82649673dbd32efcf6450071/libs/chatchat-server/chatchat/server/api_server/tool_routes.py#
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

- **Issue #5482** (2026-07-24): **[BUG] openai_routes.py 存在路径穿越导致任意文件读取与删除漏洞 (基于代码静态分析) / Path Traversal leading to Arbitrary File Read/Delete in openai_routes.py (Static Analysis)**
  *Symptoms*: 问题描述 / Problem Description 在 openai_routes.py 的 _get_file_path 函数逻辑中存在路径穿越风险。函数对用户传入的 file_id 进行 Base64 解码后，未进行任何路径合法性校验（如过滤 / 或 ..），直接传递给 os.path.join 拼接。由于 Python os.path.join 的机制，当遇到绝对路径时会直接丢弃前缀目录。攻击者可利用此特性构造包含绝对路径的恶意 file_id，绕过目录限制。  复现问题的步骤 / Steps to Reproduce  1. 审计 openai_routes.py 中的 _get_file_path 函数代码逻辑。  2. 构造 Payload：将目标文件的绝对路径（例如 /etc/passwd）进行 Base64 URL 编码，生成恶意 file_id（如 L2V0Yy9wYXNzd2Q=）。  3. 理论触发读取：调用 GET /v1/files/{Payload}/content，os.path.join 会直接返回 /etc/passwd，并由 FileResponse 读取该文件。  4. 理论触发删除：调用 DELETE /v1/files/{Payload}，将直接触发 os.remove('/etc/passwd')。   预期的结果 / Expected Result 程序应对 Base64 解码后的 file_id 字符串进行严格的安全清洗与校验。例如，拒绝任何包含路径分隔符（/ 或 \）及相对路径符号（..）的输入，确保最终拼接出的文件路径严格被限制在 Settings.basic_settings.BASE_TEMP_DIR/openai_files 目录层级之内。  实际结果 / Actual Result 由于缺乏路径规范化处理，安全边界失效。攻击者可以通过 API 越权访问或恶意删除宿主机操作系统上的任意敏感文件。
  **Post-Mortem & Fix Analysis**:
  > <!-- Answer --> This vulnerability has already been reported in detail in [issue #5474](https://github.com/chatchat-space/Langchain-Chatchat/issues/5474) [[1]](https://github.com/chatchat-space/Langchain-Chatchat/issues/5474), which covers the same path traversal in `_get_file_path` (arbitrary file read/delete) along with additional findings (arbitrary file write via upload filename and missing authentication on all endpoints).  Your analysis is correct. The vulnerable code at lines 255-257 of `openai_routes.py` [[2]](https://github.com/chatchat-space/Langchain-Chatchat/blob/9ac1918aad52f3aa82649673dbd32efcf6450071/libs/chatchat-server/chatchat/server/api_server/openai_routes.py#L255-L257):  ```python def _get_file_path(file_id: str) -> str:     file_id = base64.urlsafe_b64decode(file_id).decode()     return os.path.join(Settings.basic_settings.BASE_TEMP_DIR, "openai_files", file_id) ```  performs no sanitization — no filtering of `../`, no rejection of absolute paths, and no `os.path.
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

- **Issue #5475** (2026-07-25): **[BUG] RCE/shell tool exposed without auth**
  *Symptoms*: **Problem Description** POST /tools/call is exposed without any authentication, authorization, or tool-level allowlist. Combined with the default-registered shell tool, any unauthenticated network attacker who can reach the API port can execute arbitrary OS commands as the service user.  **Steps to Reproduce** 1.Start Langchain-Chatchat v0.3.1 following the official docs, with the API listening address. 2.Without any authentication or credentials, query the tool listing endpoint: curl -s http:// x.x x.x:x /tools Confirm that a shell tool entry is present in the response. 3.Without any authentication or credentials, send a POST request to /tools/call invoking the shell tool with a command that produces a persistent side effect on the server (e.g. writing a marker file under /tmp). The full exploit payload has been disclosed privately via GitHub Security Advisory and is intentionally omitted from this public issue. 4.SSH (or otherwise log in) to the server running the service. Verify that the marker file specified in step 3 was created and inspect its contents. 5.Inspect the server logs for an Executing command: ... entry corresponding to the request.  **Expected Result** 1./tools/call should enforce authentication and authorization before invoking any tool. Unauthenticated requests should be rejected with 401 Unauthorized or 403 Forbidden. 2.High-risk tools such as shell (which execute arbitrary OS commands) should not be exposed through an unauthenticated HTTP endpoint. They 
  **Post-Mortem & Fix Analysis**:
  > CVE Request We kindly request CVE assignment for the vulnerabilities documented in this issue:  This an Unauthorised remote command execution vulnerability— CWE-78, CWE-306  Considering that deployment instances are directly exposed on the public network, when the vulnerability is exploited, the impact will be large. Arbitrary system commands can be executed through service permissions, which may lead to privacy information leakage.
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。  

- **Issue #5468** (2026-06-03): **[BUG] Path Traversal Vulnerability in File Upload for OpenAI-Compatible API**
  *Symptoms*: **问题描述 / Problem Description** Langchain-Chatchat 的 OpenAI 兼容文件上传接口 `/v1/files` 存在路径遍历漏洞。攻击者可以通过构造恶意文件名，将文件写入到 `openai_files` 目录之外的任意位置。  **漏洞类型**: 路径遍历 (Path Traversal)   **CVSS评分**: 9.1 (Critical)   **影响范围**: 任意文件写入  **复现问题的步骤 / Steps to Reproduce** 1. 启动 Langchain-Chatchat 服务     ```bash    python startup.py -a    ```  2. 使用 OpenAI 兼容 API 上传文件，文件名包含路径遍历：     ```bash    curl -X POST "http://127.0.0.1:7861/v1/files" \      -F "purpose=assistants" \      -F "file=@test.txt;filename=../../../../../malicious.txt"    ```  3. 观察文件被写入到运行时根目录  4. 服务器返回成功响应，文件已逃逸预期目录  **预期的结果 / Expected Result** - 文件应该被写入到 `{DATA_PATH}/openai_files/assistants/{date}/` 目录下 - 文件名应该经过路径规范化 - 包含 `..` 的文件名应该被拒绝或清理  **实际结果 / Actual Result** - 文件被写入  - 成功逃逸了 `openai_files` 子树  - 服务器返回 HTTP 200 成功响应：    ```json   {     "id": "YXNzaXN0YW50cy8yMDI2LTA0LTEyLy4uLy4uLy4uLy4uLy4uL29wZW5haS1maWxlcy1lc2NhcGUudHh0",     "filename": "../../../../../openai-files-escape.txt",     "bytes": 58,     "created_at": 1776004764,     "object": "file",     "purpose": "assistants"   }   ``` **漏洞根因 / Root Cause**  **受影响文件**: `libs/chatchat-server/chatchat/server/api_server/openai_routes.py:270`   **受影响函数**: `files` (POST handler)  该函数直接使用用户提供的文件名构造路径，未进行边界检查：  ```python @router.post("/v1/files") async def files(     file: UploadFile = File(...),     purpose: str = Form(...) ):     filename = file.filename  # 直接使用用户输入     file_path = os.path.join(base_dir, purpose, date_str, filename)  # 未检查边界     # ... 写入文件 ```  **安全影响 / Security
  **Post-Mortem & Fix Analysis**:
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

- **Issue #5467** (2026-06-03): **[BUG] Knowledge Base Name Path Traversal Vulnerability**
  *Symptoms*: **问题描述 / Problem Description** Langchain-Chatchat 的知识库创建和文档上传接口存在路径遍历漏洞。攻击者可以通过在 `knowledge_base_name` 参数中注入路径遍历序列（如 `..\\`），将知识库内容写入到配置的知识库根目录之外的任意位置。  **漏洞类型**: 路径遍历 (Path Traversal)   **CVSS评分**: 9.1 (Critical)   **影响范围**: 任意目录创建和文件写入  **复现问题的步骤 / Steps to Reproduce** 1. 启动 Langchain-Chatchat 服务     ```bash    python startup.py -a    ```  2. 创建包含路径遍历的知识库：     ```bash    curl -X POST "http://127.0.0.1:7861/knowledge_base/create_knowledge_base" \      -H "Content-Type: application/json" \      -d '{        "knowledge_base_name": "..\\malicious-kb",        "vector_store_type": "faiss",        "embed_model": "bge-large-zh-v1.5"      }'    ```  3. 上传文档到该知识库：     ```bash    curl -X POST "http://127.0.0.1:7861/knowledge_base/upload_docs" \      -F "knowledge_base_name=..\\malicious-kb" \      -F "files=@test.txt"    ```  4. 观察文件被写入到知识库根目录外   **预期的结果 / Expected Result** - 知识库应该被创建在 `{KB_ROOT_PATH}/{knowledge_base_name}/` 下 - `knowledge_base_name` 应该经过路径规范化 - 包含 `..` 或绝对路径的名称应该被拒绝  **实际结果 / Actual Result** - 文件被写入到 `D:\Project\Dataset\Langchain-Chatchat\.runtime-full-root\data\kb-name-escape-1776004764\content\kb-name-upload.txt`  - 成功逃逸了配置的知识库根目录  - 虽然向量库加载失败（返回 500 错误），但文件上传仍然成功（返回 200）  - 创建响应：    ```json   {     "code": 500,     "msg": "创建知识库出错： 向量库 ..\\kb-name-escape-1776004764 加载失败。"   }   ```  - 上传响应：    ```json   {     "code": 200,     "msg": "文件上传与向量化完成",     "data": {"failed_files": {}}   }   ```  ## 漏洞根因 / Root Cause  **受影响文件**: `libs/chatchat-server/chatchat/server/know
  **Post-Mortem & Fix Analysis**:
  > <!-- Answer --> Thanks for the detailed report. I can confirm this vulnerability is real. The current `validate_kb_name` function in `libs/chatchat-server/chatchat/server/knowledge_base/utils.py` only checks for the literal `"../"` substring [[1]](https://github.com/chatchat-space/Langchain-Chatchat/blob/9ac1918aad52f3aa82649673dbd32efcf6450071/libs/chatchat-server/chatchat/server/knowledge_base/utils.py#L26-L30):  ```python def validate_kb_name(knowledge_base_id: str) -> bool:     if "../" in knowledge_base_id:         return False     return True ```  This means backslash-based traversal sequences like `..\` (as in your PoC) completely bypass the check. The validation is applied at API entry points like `create_knowledge_base` [[2]](https://github.com/chatchat-space/Langchain-Chatchat/blob/9ac1918aad52f3aa82649673dbd32efcf6450071/libs/chatchat-server/chatchat/server/knowledge_base/kb_api.py#L28-L29) and `upload_docs` [[3]](https://github.com/chatchat-space/Langchain-Chatchat/blob/9ac
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

- **Issue #5466** (2026-06-03): **[BUG] Temporary Document Upload Path Traversal Vulnerability**
  *Symptoms*: ## 问题描述 / Problem Description  Langchain-Chatchat 的临时文档上传接口 `/knowledge_base/upload_temp_docs` 存在路径遍历漏洞。攻击者可以通过构造恶意文件名，将文件写入到服务器任意位置，突破预期的临时目录限制。  **漏洞类型**: 路径遍历 (Path Traversal / Directory Traversal)   **CVSS评分**: 9.1 (Critical)   **影响范围**: 任意文件写入，可能导致服务器完全沦陷  ## 复现问题的步骤 / Steps to Reproduce  1. 启动 Langchain-Chatchat 服务     ```bash    python startup.py -a    ```  2. 构造恶意 multipart/form-data 请求，文件名包含路径遍历序列：     ```bash    curl -X POST "http://127.0.0.1:7861/knowledge_base/upload_temp_docs" \      -F "files=@test.json;filename=..\\..\\..\\malicious.json"    ```  3. 观察文件被写入到运行时根目录外  4. 漏洞触发，文件成功逃逸临时目录  ## 预期的结果 / Expected Result  - 文件应该被写入到 `{temp_dir}/{request_id}/` 目录下 - 文件名应该经过路径规范化和边界检查 - 包含 `..` 的文件名应该被拒绝或清理  ## 实际结果 / Actual Result  - 文件被写入到 `D:\Project\Dataset\Langchain-Chatchat\.runtime-full-root\file-chat-escape.json`  - 成功逃逸了预期的临时目录边界  - 服务器返回 HTTP 200，虽然后续解析失败，但文件已经写入  - 响应内容：    ```json   {     "code": 200,     "msg": "success",     "data": {       "id": "19c24fe39aa94219bc7125cc913c4a33",       "failed_files": [         {           "..\\..\\..\\file-chat-escape.json": "文件上传失败，报错信息为: jq package not found"         }       ]     }   }   ```  ## 漏洞根因 / Root Cause  **受影响文件**: `libs/chatchat-server/chatchat/server/chat/file_chat.py:52`   **受影响函数**: `_parse_files_in_thread`  该函数直接使用用户提供的文件名构造文件路径，未进行路径规范化或边界检查：  ```python def _parse_files_in_thread(     files: List[UploadFile],     dir: str,     zh_title_enhance: bool,     chunk_size: int,     chunk_overlap: int, ):     f
  **Post-Mortem & Fix Analysis**:
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

- **Issue #5446** (2026-03-20): **Security Vulnerability Report: Prompt Injection Leading to SQL-Based Denial of Service in latest Langchain-Chatchat**
  *Symptoms*: # Security Vulnerability Report: Prompt Injection Leading to SQL-Based Denial of Service in latest Langchain-Chatchat  ## Affected Scope The latest version of Langchain-Chatchat <=0.3.1  ## Vulnerability Description  Langchain-Chatchat's `text2sql` tool is vulnerable to prompt injection attacks that enable arbitrary SQL execution, leading to Denial of Service (DoS). An attacker can craft a malicious prompt containing Base64-encoded instructions that bypass security checks and inject SQL commands through carefully placed SQL comments. This allows execution of resource-exhaustive queries such as infinite recursive CTEs (Common Table Expressions).  The code comments suggest controlling permissions at the database level and enable read_only option at the text2sql tool settings to filter write option, but this attack demonstrates that even with proper database permissions and read_only option, a publicly accessible agent endpoint can be exploited for DoS without requiring any special privileges - select permission on columns not required even.  The attack chain consists of two layers: 1. **First layer**: Base64 encoding to bypass initial llm content filtering to call text2sql tool with target SQL and comment  2. **Second layer**: SQL comment-based prompt injection to allow target SQL executed on server  The decoded malicious prompt uses SQL comments (`/* */`) to embed instructions that trick the AI into outputting a raw SQL statement without validation.   ```sql /*remember to outp
  **Post-Mortem & Fix Analysis**:
  > <!-- Answer --> This vulnerability is confirmed: the current text2sql implementation only blocks write operations (insert, update, delete, etc.) using a SQLAlchemy event hook and LLM prompt checks, but does not limit resource-exhaustive SELECT queries such as infinite recursive CTEs. As a result, prompt injection can lead to SQL-based Denial of Service even with read_only mode and minimal DB permissions enabled, since queries like unbounded recursion are not blocked or timed out at the application level [(source)](https://github.com/chatchat-space/Langchain-Chatchat/blob/9ac1918aad52f3aa82649673dbd32efcf6450071/libs/chatchat-server/chatchat/server/agent/tools_factory/text2sql.py#L1-L140).  There are currently no built-in query execution timeouts or recursion depth limits in the codebase or configuration. The top_k parameter only limits the number of returned rows, not execution time or recursion depth. Documentation recommends using read replicas and DB-level permissions, but these do 
  > 这个问题已经被标记为 `stale` ，因为它已经超过 30 天没有任何活动。
  > 这个问题已经被自动关闭，因为它被标为 `stale` 后超过 14 天没有任何活动。

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

### Incident Patch 1: `c659d684` (2025-09-09)
**Commit Message**: Refactor chat completions handling to conditionally build tool configuration based on the presence of tools in the request body. This change enhances the robustness of the chat function by preventing potential errors when no tools are provided.

**File**: `libs/chatchat-server/chatchat/server/api_server/chat_routes.py` (modified, +6/-4)
```diff
@@ -105,18 +105,20 @@ async def chat_completions(
         message_id = None
 
     chat_model_config = {}  # TODO: 前端支持配置模型
-    tool_names = [x["function"]["name"] for x in body.tools]
-    tool_config = {name: get_tool_config(name) for name in tool_names}
+    tool_config = {}
+    if body.tools:
+        tool_names = [x["function"]["name"] for x in body.tools]
+        tool_config = {name: get_tool_config(name) for name in tool_names}
+
     result = await chat(
         query=body.messages[-1]["content"],
         metadata=extra.get("metadata", {}),
         conversation_id=extra.get("conversation_id", ""),
         message_id=message_id,
         history_len=-1,
-        history=body.messages[:-1],
         stream=body.stream,
         chat_model_config=extra.get("chat_model_config", chat_model_config),
-        tool_config=extra.get("tool_config", tool_config),
+        tool_config=tool_config,
         use_mcp=extra.get("use_mcp", False),
         max_tokens=body.max_tokens,
     )
```

---

### Incident Patch 2: `88348e3b` (2025-09-09)
**Commit Message**: Refactor chat handling to streamline message ID retrieval and enhance MCP connection support. Update chat function to include use_mcp parameter, allowing for dynamic MCP connection management. Adjust web UI to incorporate MCP usage toggle, improving user experience and flexibility in agent interactions.

**File**: `libs/chatchat-server/chatchat/server/api_server/chat_routes.py` (modified, +30/-117)
```diff
@@ -89,122 +89,35 @@ async def chat_completions(
                     }
 
     conversation_id = extra.get("conversation_id")
-
-    # chat based on result from one choiced tool
-    if body.tool_choice:
-        tool = get_tool(body.tool_choice["function"]["name"])
-        if not body.tools:
-            body.tools = [
-                {
-                    "type": "function",
-                    "function": {
-                        "name": tool.name,
-                        "description": tool.description,
-                        "parameters": tool.args,
-                    },
-                }
-            ]
-        if tool_input := extra.get("tool_input"):
-            try:
-                message_id = (
-                    add_message_to_db(
-                        chat_type="tool_call",
-                        query=body.messages[-1]["content"],
-                        conversation_id=conversation_id,
-                    )
-                    if conversation_id
-                    else None
-                )
-            except Exception as e:
-                logger.warning(f"failed to add message to db: {e}")
-                message_id = None
-
-            tool_result = await tool.ainvoke(tool_input)
-            prompt_template = PromptTemplate.from_template(
-                get_prompt_template("rag", "default"), template_format="jinja2"
-            )
-            body.messages[-1]["content"] = prompt_template.format(
-                context=tool_result, question=body.messages[-1]["content"]
-            )
-            del body.tools
-            del body.tool_choice
-            extra_json = {
-                "message_id": message_id,
-                "status": None,
-                "model": body.model,
-            }
-            header = [
-                {
-                    **extra_json,
-                    "content": f"{tool_result}",
-                    "tool_call": tool.get_name(),
-                    "tool_output": tool_result.data,
-                    "is_ref": False if tool.return_direct else True,
-                }
-            ]
-            if tool.return_direct:
-                def temp_gen():
-                    yield OpenAIChatOutput(**header[0]).model_dump_json()
-                return EventSourceResponse(temp_gen())
-            else:
-                return await openai_request(
-                    client.chat.completions.create,
-                    body,
-                    extra_json=extra_json,
-                    header=header,
-                )
-
-    # agent chat with tool calls
-    if body.tools:
-        try:
-            message_id = (
-                add_message_to_db(
-                    chat_type="agent_chat",
-                    query=body.messages[-1]["content"],
-                    conversation_id=conversation_id,
-                )
-                if conversation_id
-                else None
-            )
-        except Exception as e:
-            logger.warning(f"failed to add message to db: {e}")
-            message_id = None
-
-        chat_model_config = {}  # TODO: 前端支持配置模型
-        tool_names = [x["function"]["name"] for x in body.tools]
-        tool_config = {name: get_tool_config(name) for name in tool_names}
-        result = await chat(
-            query=body.messages[-1]["content"],
-            metadata=extra.get("metadata", {}),
-            conversation_id=extra.get("conversation_id", ""),
-            message_id=message_id,
-            history_len=-1,
-            history=body.messages[:-1],
-            stream=body.stream,
-            chat_model_config=extra.get("chat_model_config", chat_model_config),
-            tool_config=extra.get("tool_config", tool_config),
-            max_tokens=body.max_tokens,
-        )
-        return result
-    else:  # LLM chat directly
-        try: # query is complex object that unable add to db when using qwen-vl-chat 
-            message_id = (
-                add_message_to_db(
-                    chat_type="llm_chat",
-                    query=body.messages[-1]["content"],
-                    conversation_id=conversation_id,
-                )
-                if conversation_id
-                else None
+  
+    try:
+        message_id = (
+            add_message_to_db(
+                chat_type="agent_chat",
+                query=body.messages[-1]["content"],
+                conversation_id=conversation_id,
             )
-        except Exception as e:
-            logger.warning(f"failed to add message to db: {e}")
-            message_id = None
-
-        extra_json = {
-            "message_id": message_id,
-            "status": None,
-        }
-        return await openai_request(
-            client.chat.completions.create, body, extra_json=extra_json
+            if conversation_id
+            else None
         )
+    except Exception as e:
+        logger.warning(f"failed to add message to db: {e}")
+        message_id = None
+
```

**File**: `libs/chatchat-server/chatchat/server/chat/chat.py` (modified, +30/-20)
```diff
@@ -13,6 +13,7 @@
 from chatchat.server.agents_registry.agents_registry import agents_registry
 from sse_starlette.sse import EventSourceResponse
 
+from chatchat.server.db.repository.mcp_connection_repository import get_enabled_mcp_connections
 from chatchat.settings import Settings
 from chatchat.server.api_server.api_schemas import OpenAIChatOutput
 from langchain_chatchat.callbacks.agent_callback_handler import (
@@ -73,7 +74,7 @@ def create_models_from_config(configs, callbacks, stream, max_tokens):
 
 
 def create_models_chains(
-    history_len, prompts, models, tools, callbacks, conversation_id, metadata
+    history_len, prompts, models, tools, callbacks, conversation_id, metadata,  use_mcp: bool = False
 ):
 
     # 从数据库获取conversation_id对应的 intermediate_steps 、 mcp_connections
@@ -90,22 +91,39 @@ def create_models_chains(
     intermediate_steps = loads(messages[-1].get("metadata", {}).get("intermediate_steps"), valid_namespaces=["langchain_chatchat", "agent_toolkits", "all_tools", "tool"] )  if len(messages)>0 and messages[-1].get("metadata") is not None else []
     llm = models["action_model"]
     llm.callbacks = callbacks
+    connections = get_enabled_mcp_connections()
+    
+    # 转换为MCP连接格式，支持StdioConnection和SSEConnection类型
+    mcp_connections = {}
+    for conn in connections:
+        if conn["transport"] == "stdio":
+            # StdioConnection类型
+            mcp_connections[conn["server_name"]] = {
+                "transport": "stdio",
+                "command": conn["config"].get("command", conn["args"][0] if conn["args"] else ""),
+                "args": conn["args"][1:] if len(conn["args"]) > 1 else [],
+                "env": conn["env"],
+                "encoding": "utf-8",
+                "encoding_error_handler": "strict"
+            }
+        elif conn["transport"] == "sse":
+            # SSEConnection类型
+            mcp_connections[conn["server_name"]] = {
+                "transport": "sse",
+                "url": conn["config"].get("url", ""),
+                "headers": conn["config"].get("headers", {}),
+                "timeout": conn.get("timeout", 30.0),
+                "sse_read_timeout": conn.get("sse_read_timeout", 60.0)
+            }
+    
     agent_executor = PlatformToolsRunnable.create_agent_executor(
         agent_type="platform-knowledge-mode",
         agents_registry=agents_registry,
         llm=llm,
         tools=tools,
         history=history,
         intermediate_steps=intermediate_steps,
-        mcp_connections={
-            "playwright": {
-                "command": "npx",
-                "args": [
-                    "@playwright/mcp@latest"
-                ],
-                "transport": "stdio",
-            },
-        }
+        mcp_connections=mcp_connections if use_mcp else {}
     )
 
     full_chain = {"chat_input": lambda x: x["input"]} | agent_executor
@@ -119,19 +137,10 @@ async def chat(
         conversation_id: str = Body("", description="对话框ID"),
         message_id: str = Body(None, description="数据库消息ID"),
         history_len: int = Body(-1, description="从数据库中取历史消息的数量"),
-        history: List[History] = Body(
-            [],
-            description="历史对话，设为一个整数可以从数据库中读取历史消息",
-            examples=[
-                [
-                    {"role": "user", "content": "我们来玩成语接龙，我先来，生龙活虎"},
-                    {"role": "assistant", "content": "虎头虎脑"},
-                ]
-            ],
-        ),
         stream: bool = Body(True, description="流式输出"),
         chat_model_config: dict = Body({}, description="LLM 模型配置", examples=[]),
         tool_config: dict = Body({}, description="工具配置", examples=[]),
+        use_mcp: bool = Body(False, description="使用MCP"),
         max_tokens: int = Body(None, description="LLM最大token数配置", example=4096),
 ):
     """Agent 对话"""
@@ -167,6 +176,7 @@ async def chat_iterator_event() -> AsyncIterable[OpenAIChatOutput]:
                 callbacks=callbacks,
                 history_len=history_len,
                 metadata=metadata,
+                use_mcp = use_mcp
             )
             message_id = add_message_to_db(
                     chat_type="llm_chat",
```

**File**: `libs/chatchat-server/chatchat/webui_pages/dialogue/dialogue.py` (modified, +4/-15)
```diff
@@ -206,12 +206,12 @@ def rename_conversation():
             use_agent = st.checkbox(
                 "启用Agent", help="请确保选择的模型具备Agent能力", key="use_agent"
             )
-            output_agent = st.checkbox("显示 Agent 过程", key="output_agent")
 
             # 选择工具
             tools = list_tools(api)
             tool_names = ["None"] + list(tools)
             if use_agent:
+                use_mcp = st.checkbox("使用MCP", key="use_mcp")
                 # selected_tools = sac.checkbox(list(tools), format_func=lambda x: tools[x]["title"], label="选择工具",
                 # check_all=True, key="selected_tools")
                 selected_tools = st.multiselect(
@@ -222,14 +222,8 @@ def rename_conversation():
                 )
             else:
                 # selected_tool = sac.buttons(list(tools), format_func=lambda x: tools[x]["title"], label="选择工具",
-                # key="selected_tool")
-                selected_tool = st.selectbox(
-                    "选择工具",
-                    tool_names,
-                    format_func=lambda x: tools.get(x, {"title": "None"})["title"],
-                    key="selected_tool",
-                )
-                selected_tools = [selected_tool]
+             
+                selected_tools = []
             selected_tool_configs = {
                 name: tool["config"]
                 for name, tool in tools.items()
@@ -422,6 +416,7 @@ def on_conv_change():
             conversation_id=conversation_id,
             tool_input=tool_input,
             upload_image=upload_image,
+            use_mcp=use_mcp,
         )
         stream = not is_vision_chat
         params = dict(
@@ -455,20 +450,14 @@ def on_conv_change():
                     if d.status == AgentStatus.error:
                         st.error(d.choices[0].delta.content)
                     elif d.status == AgentStatus.llm_start:
-                        if not output_agent:
-                            continue
                         chat_box.insert_msg("正在解读工具输出结果...")
                         text = d.choices[0].delta.content or ""
                     elif d.status == AgentStatus.llm_new_token:
-                        if not output_agent:
-                            continue
                         text += d.choices[0].delta.content or ""
                         chat_box.update_msg(
                             text.replace("\n", "\n\n"), streaming=True, metadata=metadata
                         )
                     elif d.status == AgentStatus.llm_end:
-                        if not output_agent:
-                            continue
                         text += d.choices[0].delta.content or ""
                         chat_box.update_msg(
                             text.replace("\n", "\n\n"), streaming=False, metadata=metadata
```

---

### Incident Patch 3: `256d6dd9` (2025-09-09)
**Commit Message**: Refactor MCP connection management by removing the command field from schemas and API requests, consolidating it within the config dictionary. Update related functions and the web UI to enhance clarity and maintainability, while improving session state handling for timeout and working directory settings.

**File**: `libs/chatchat-server/chatchat/server/api_server/api_schemas.py` (modified, +2/-2)
```diff
@@ -187,7 +187,7 @@ class MCPConnectionCreate(BaseModel):
     timeout: int = Field(default=30, ge=1, le=300, description="连接超时时间（秒）")
     enabled: bool = Field(default=True, description="是否启用")
     description: Optional[str] = Field(None, max_length=1000, description="连接描述")
-    config: Dict = Field(default={}, description="连接配置，包含 command 等字段")
+    config: Dict = Field(default={}, description="连接配置")
 
 
 class MCPConnectionUpdate(BaseModel):
@@ -200,7 +200,7 @@ class MCPConnectionUpdate(BaseModel):
     timeout: Optional[int] = Field(None, ge=1, le=300, description="连接超时时间（秒）")
     enabled: Optional[bool] = Field(None, description="是否启用")
     description: Optional[str] = Field(None, max_length=1000, description="连接描述")
-    config: Optional[Dict] = Field(None, description="连接配置，包含 command 等字段")
+    config: Optional[Dict] = Field(None, description="连接配置")
 
 
 class MCPConnectionResponse(BaseModel):
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (modified, +0/-5)
```diff
@@ -104,7 +104,6 @@ def get_mcp_connection_by_id(session, connection_id: str) -> Optional[dict]:
         return {
             "id": mcp_connection.id,
             "server_name": mcp_connection.server_name,
-            "command": mcp_connection.command,
             "args": mcp_connection.args,
             "env": mcp_connection.env,
             "cwd": mcp_connection.cwd,
@@ -133,7 +132,6 @@ def get_mcp_connections_by_server_name(session, server_name: str) -> List[dict]:
         {
             "id": conn.id,
             "server_name": conn.server_name,
-            "command": conn.command,
             "args": conn.args,
             "env": conn.env,
             "cwd": conn.cwd,
@@ -163,7 +161,6 @@ def get_all_mcp_connections(session, enabled_only: bool = False) -> List[dict]:
         {
             "id": conn.id,
             "server_name": conn.server_name,
-            "command": conn.command,
             "args": conn.args,
             "env": conn.env,
             "cwd": conn.cwd,
@@ -194,7 +191,6 @@ def get_enabled_mcp_connections(session) -> List[dict]:
         {
             "id": conn.id,
             "server_name": conn.server_name,
-            "command": conn.command,
             "args": conn.args,
             "env": conn.env,
             "cwd": conn.cwd,
@@ -282,7 +278,6 @@ def search_mcp_connections(
         {
             "id": conn.id,
             "server_name": conn.server_name,
-            "command": conn.command,
             "args": conn.args,
             "env": conn.env,
             "cwd": conn.cwd,
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +30/-50)
```diff
@@ -388,6 +388,8 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                         
                         if result:
                             st.success("通用设置已保存")
+                            st.session_state.mcp_profile['timeout'] = timeout_value
+                            st.session_state.mcp_profile['working_dir'] = working_dir
                             st.session_state.mcp_profile_loaded = False  # 重新加载
                         else:
                             st.error("保存失败，请检查配置")
@@ -448,14 +450,6 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                 icon_letter = "S" if transport == "stdio" else "E"
                 icon_bg = icon_colors.get("stdio", "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)") if transport == "stdio" else icon_colors.get("sse", "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)")
                 
-                # 状态指示器
-                status_html = """
-                    <div class="status-indicator">
-                        <div class="status-dot" style="background: #6B7280;"></div>
-                        <span style="color: #6B7280; font-size: 12px; font-weight: 500;">手动连接</span>
-                    </div>
-                """
-                
                 # 连接器卡片
                 with st.container():
                     col1, col2, col3 = st.columns([3, 1, 1])
@@ -471,7 +465,10 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                                         <div class="connector-info">
                                             <h3>{connection.get('server_name', '')}</h3>
                                             <p>{json.dumps(connection.get('config', {}), ensure_ascii=False, indent=2)}</p>
-                                            {status_html}
+                                            <div class="status-indicator">
+                                                <div class="status-dot" style="background: #6B7280;"></div>
+                                                <span style="color: #6B7280; font-size: 12px; font-weight: 500;">连接</span>
+                                            </div>
                                         </div>
                                     </div>
                                 </div>
@@ -579,7 +576,7 @@ def add_new_connection_form(api: "ApiRequest"):
         st.session_state.connection_args = []
     if "connection_env_vars" not in st.session_state:
         # 形如 [{"key":"FOO","value":"bar"}]
-        st.session_state.connection_env_vars = []
+        st.session_state.connection_env_vars = st.session_state.env_vars_list or []
 
     st.subheader("新连接器配置")
 
@@ -651,43 +648,28 @@ def add_new_connection_form(api: "ApiRequest"):
                 key="conn_sse_headers",
             )
             
-            col_timeout1, col_timeout2 = st.columns(2)
-            with col_timeout1:
-                sse_timeout = st.number_input(
-                    "HTTP 超时时间（秒）",
-                    min_value=1,
-                    max_value=300,
-                    value=30,
-                    help="HTTP 请求超时时间",
-                    key="conn_sse_timeout",
+            col_ti1, col_ti2 = st.columns(2)
+            with col_ti1:
+                
+                sse_encoding_error_handler = st.selectbox(
+                    "编码错误处理",
+                    options=["strict", "ignore", "replace"],
+                    index=0,
+                    help="编码错误处理方式",
+                    key="conn_sse_encoding_error_handler",
                 )
-            with col_timeout2:
-                sse_read_timeout = st.number_input(
-                    "SSE 读取超时时间（秒）",
-                    min_value=1,
-                    max_value=300,
-                    value=30,
-                    help="SSE 流读取超时时间",
-                    key="conn_sse_read_timeout",
+
+            with col_ti2:
+                
+                # SSE 编码配置
+                sse_encoding = st.selectbox(
+                    "文本编码",
+                    options=["utf-8", "gbk", "ascii", "latin-1"],
+                    index=0,
+                    help="文本编码格式",
+                    key="conn_sse_encoding",
                 )
             
-            # SSE 编码配置
-            sse_encoding = st.selectbox(
-                "文本编码",
-                options=["utf-8", "gbk", "ascii", "latin-1"],
-                index=0,
-                help="文本编码格式",
-                key="conn_sse_encoding",
-            )
-            
-            sse_encoding_error_handler = st.selectbox(
-                "编码错误处理",
-                options=["strict", "ignore", "replace"],
-                index=0,
-                help="编码错误处理方式",
-                key="conn_sse_encoding_error_handler",
-            )
-
         # ===== 命令参数（可选） =====
         st.write("命令参数（可选）：")
         # 展示已添加的参数
@@ -753,13 +735,13 @@ def add_new_connection_form(api: "ApiRequest"):
          
```

**File**: `libs/chatchat-server/chatchat/webui_pages/utils.py` (modified, +0/-5)
```diff
@@ -766,7 +766,6 @@ def delete_mcp_profile(self, **kwargs) -> Dict:
     def add_mcp_connection(
         self,
         server_name: str,
-        command: str,
         args: List[str] = None,
         env: Dict[str, str] = None,
         cwd: Optional[str] = None,
@@ -788,7 +787,6 @@ def add_mcp_connection(
             config = {}
         data = {
             "server_name": server_name,
-            "command": command,
             "args": args,
             "env": env,
             "cwd": cwd,
@@ -820,7 +818,6 @@ def update_mcp_connection(
         self,
         connection_id: str,
         server_name: Optional[str] = None,
-        command: Optional[str] = None,
         args: Optional[List[str]] = None,
         env: Optional[Dict[str, str]] = None,
         cwd: Optional[str] = None,
@@ -837,8 +834,6 @@ def update_mcp_connection(
         data = {}
         if server_name is not None:
             data["server_name"] = server_name
-        if command is not None:
-            data["command"] = command
         if args is not None:
             data["args"] = args
         if env is not None:
```

---

### Incident Patch 4: `984ab845` (2025-09-09)
**Commit Message**: Refactor MCP connection management by removing the command field from schemas, API routes, and database models. Update related functions to store command within the config dictionary, enhancing configuration clarity. Adjust web UI to reflect these changes, improving user experience and maintainability.

**File**: `libs/chatchat-server/chatchat/server/api_server/api_schemas.py` (modified, +2/-5)
```diff
@@ -180,36 +180,33 @@ class OpenAIChatOutput(OpenAIBaseOutput):
 class MCPConnectionCreate(BaseModel):
     """创建 MCP 连接的请求体"""
     server_name: str = Field(..., min_length=1, max_length=100, description="服务器名称")
-    command: str = Field(..., max_length=500, description="启动命令")
     args: List[str] = Field(default=[], description="命令参数")
     env: Dict[str, str] = Field(default={}, description="环境变量")
     cwd: Optional[str] = Field(None, description="工作目录")
     transport: str = Field(default="stdio", pattern="^(stdio|sse)$", description="传输方式")
     timeout: int = Field(default=30, ge=1, le=300, description="连接超时时间（秒）")
     enabled: bool = Field(default=True, description="是否启用")
     description: Optional[str] = Field(None, max_length=1000, description="连接描述")
-    config: Dict = Field(default={}, description="额外配置")
+    config: Dict = Field(default={}, description="连接配置，包含 command 等字段")
 
 
 class MCPConnectionUpdate(BaseModel):
     """更新 MCP 连接的请求体"""
     server_name: Optional[str] = Field(None, min_length=1, max_length=100, description="服务器名称")
-    command: Optional[str] = Field(None, max_length=500, description="启动命令")
     args: Optional[List[str]] = Field(None, description="命令参数")
     env: Optional[Dict[str, str]] = Field(None, description="环境变量")
     cwd: Optional[str] = Field(None, description="工作目录")
     transport: Optional[str] = Field(None, pattern="^(stdio|sse)$", description="传输方式")
     timeout: Optional[int] = Field(None, ge=1, le=300, description="连接超时时间（秒）")
     enabled: Optional[bool] = Field(None, description="是否启用")
     description: Optional[str] = Field(None, max_length=1000, description="连接描述")
-    config: Optional[Dict] = Field(None, description="额外配置")
+    config: Optional[Dict] = Field(None, description="连接配置，包含 command 等字段")
 
 
 class MCPConnectionResponse(BaseModel):
     """MCP 连接响应体"""
     id: str
     server_name: str
-    command: str
     args: List[str]
     env: Dict[str, str]
     cwd: Optional[str]
```

**File**: `libs/chatchat-server/chatchat/server/api_server/mcp_routes.py` (modified, +0/-8)
```diff
@@ -186,7 +186,6 @@ def model_to_response(model) -> MCPConnectionResponse:
     return MCPConnectionResponse(
         id=model.id,
         server_name=model.server_name,
-        command=model.command,
         args=model.args,
         env=model.env,
         cwd=model.cwd,
@@ -218,7 +217,6 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
         
         connection_id = add_mcp_connection(
             server_name=connection_data.server_name,
-            command=connection_data.command,
             args=connection_data.args,
             env=connection_data.env,
             cwd=connection_data.cwd,
@@ -234,7 +232,6 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
         return MCPConnectionResponse(
             id=connection["id"],
             server_name=connection["server_name"],
-            command=connection["command"],
             args=connection["args"],
             env=connection["env"],
             cwd=connection["cwd"],
@@ -269,7 +266,6 @@ async def list_mcp_connections(
         response_connections = [MCPConnectionResponse(
             id=conn["id"],
             server_name=conn["server_name"],
-            command=conn["command"],
             args=conn["args"],
             env=conn["env"],
             cwd=conn["cwd"],
@@ -353,7 +349,6 @@ async def update_mcp_connection_by_id(
         updated_id = update_mcp_connection(
             connection_id=connection_id,
             server_name=update_data.server_name,
-            command=update_data.command,
             args=update_data.args,
             env=update_data.env,
             cwd=update_data.cwd,
@@ -527,7 +522,6 @@ async def search_mcp_connections_endpoint(search_request: MCPConnectionSearchReq
         response_connections = [MCPConnectionResponse(
             id=conn["id"],
             server_name=conn["server_name"],
-            command=conn["command"],
             args=conn["args"],
             env=conn["env"],
             cwd=conn["cwd"],
@@ -562,7 +556,6 @@ async def get_connections_by_server_name(server_name: str):
         response_connections = [MCPConnectionResponse(
             id=conn["id"],
             server_name=conn["server_name"],
-            command=conn["command"],
             args=conn["args"],
             env=conn["env"],
             cwd=conn["cwd"],
@@ -597,7 +590,6 @@ async def list_enabled_mcp_connections():
         response_connections = [MCPConnectionResponse(
             id=conn["id"],
             server_name=conn["server_name"],
-            command=conn["command"],
             args=conn["args"],
             env=conn["env"],
             cwd=conn["cwd"],
```

**File**: `libs/chatchat-server/chatchat/server/db/models/mcp_connection_model.py` (modified, +1/-75)
```diff
@@ -16,7 +16,6 @@ class MCPConnectionModel(Base):
     id = Column(String(32), primary_key=True, comment="MCP连接ID")
     server_name = Column(String(100), unique=True, nullable=False, comment="服务器名称")
     transport = Column(String(20), nullable=False, comment="传输方式: stdio, sse")
-    command = Column(String(500), nullable=True, comment="启动命令")
     args = Column(JSON, default=[], comment="命令参数列表")
     env = Column(JSON, default={}, comment="环境变量字典")
     cwd = Column(String(500), nullable=True, comment="工作目录")
@@ -27,7 +26,7 @@ class MCPConnectionModel(Base):
     description = Column(Text, nullable=True, comment="连接器描述")
     
     # 传输特定配置
-    config = Column(JSON, default={}, comment="传输特定配置")
+    config = Column(JSON, default={}, comment="传输特定配置，包含 command 等字段")
     
     # 元数据
     last_connected_at = Column(DateTime, nullable=True, comment="最后连接时间")
@@ -46,7 +45,6 @@ def to_dict(self) -> Dict:
             "id": self.id,
             "server_name": self.server_name,
             "transport": self.transport,
-            "command": self.command,
             "args": self.args or [],
             "env": self.env or {},
             "cwd": self.cwd,
@@ -61,78 +59,6 @@ def to_dict(self) -> Dict:
             "update_time": self.update_time.isoformat() if self.update_time else None,
         }
 
-    def get_stdio_config(self) -> Dict[str, Union[str, List[str], Dict[str, str]]]:
-        """获取 stdio 传输配置"""
-        if self.transport != "stdio":
-            raise ValueError("Not a stdio connection")
-        
-        return {
-            "transport": "stdio",
-            "command": self.command or "",
-            "args": self.args or [],
-            "env": self.env or {},
-            "cwd": self.cwd or "",
-            "encoding": self.config.get("encoding", "utf-8") if self.config else "utf-8",
-            "encoding_error_handler": self.config.get("encoding_error_handler", "strict") if self.config else "strict",
-        }
-
-    def get_sse_config(self) -> Dict[str, Union[str, Dict[str, str], float]]:
-        """获取 SSE 传输配置"""
-        if self.transport != "sse":
-            raise ValueError("Not an SSE connection")
-        
-        config = self.config or {}
-        return {
-            "transport": "sse",
-            "url": config.get("url", ""),
-            "headers": config.get("headers", None),
-            "timeout": config.get("timeout", 30),
-            "sse_read_timeout": config.get("sse_read_timeout", 30),
-            "encoding": config.get("encoding", "utf-8"),
-            "encoding_error_handler": config.get("encoding_error_handler", "strict"),
-        }
-
-    def set_stdio_config(
-        self,
-        encoding: str = "utf-8",
-        encoding_error_handler: str = "strict",
-    ):
-        """设置 stdio 传输配置"""
-        if self.transport != "stdio":
-            raise ValueError("Not a stdio connection")
-        
-        if not self.config:
-            self.config = {}
-        
-        self.config.update({
-            "encoding": encoding,
-            "encoding_error_handler": encoding_error_handler,
-        })
-
-    def set_sse_config(
-        self,
-        url: str,
-        headers: Optional[Dict[str, str]] = None,
-        timeout: float = 30.0,
-        sse_read_timeout: float = 30.0,
-        encoding: str = "utf-8",
-        encoding_error_handler: str = "strict",
-    ):
-        """设置 SSE 传输配置"""
-        if self.transport != "sse":
-            raise ValueError("Not an SSE connection")
-        
-        if not self.config:
-            self.config = {}
-        
-        self.config.update({
-            "url": url,
-            "headers": headers,
-            "timeout": timeout,
-            "sse_read_timeout": sse_read_timeout,
-            "encoding": encoding,
-            "encoding_error_handler": encoding_error_handler,
-        })
 
 
 class MCPProfileModel(Base):
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (modified, +0/-5)
```diff
@@ -9,7 +9,6 @@
 def add_mcp_connection(
     session,
     server_name: str,
-    command: str,
     args: List[str] = None,
     env: Dict[str, str] = None,
     cwd: str = None,
@@ -36,7 +35,6 @@ def add_mcp_connection(
     mcp_connection = MCPConnectionModel(
         id=connection_id,
         server_name=server_name,
-        command=command,
         args=args,
         env=env,
         cwd=cwd,
@@ -56,7 +54,6 @@ def update_mcp_connection(
     session,
     connection_id: str,
     server_name: str = None,
-    command: str = None,
     args: List[str] = None,
     env: Dict[str, str] = None,
     cwd: str = None,
@@ -74,8 +71,6 @@ def update_mcp_connection(
     if mcp_connection is not None:
         if server_name is not None:
             mcp_connection.server_name = server_name
-        if command is not None:
-            mcp_connection.command = command
         if args is not None:
             mcp_connection.args = args
         if env is not None:
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +3/-7)
```diff
@@ -470,7 +470,7 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                                         </div>
                                         <div class="connector-info">
                                             <h3>{connection.get('server_name', '')}</h3>
-                                            <p>{connection.get('description', '') or connection.get('transport', '').upper()}</p>
+                                            <p>{json.dumps(connection.get('config', {}), ensure_ascii=False, indent=2)}</p>
                                             {status_html}
                                         </div>
                                     </div>
@@ -481,10 +481,6 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                     with col2:
                         if st.button("🔄 禁用", key=f"toggle_disable_{connection.get('id', i)}", use_container_width=True):
                             toggle_connection_status(api, connection.get('id', i), False)
-                    
-                    with col3:
-                        if st.button("🗑️ 删除", key=f"del_conn_{connection.get('id', i)}", use_container_width=True):
-                            delete_connection(api, connection.get('id', i))
         else:
             st.info("暂无已启用的连接器")
         
@@ -838,13 +834,13 @@ def add_new_connection_form(api: "ApiRequest"):
             )
 
             if transport == "stdio":
-                payload["command"] = command
+                # Add command to config instead of payload root
+                payload["config"]["command"] = command
                 # Add stdio-specific config
                 payload["config"]["encoding"] = encoding
                 payload["config"]["encoding_error_handler"] = encoding_error_handler
             else:
                 # SSE transport - store SSE-specific fields in config
-                payload["command"] = ""
                 payload["config"]["url"] = sse_url
                 payload["config"]["timeout"] = sse_timeout
                 payload["config"]["sse_read_timeout"] = sse_read_timeout
```

---

### Incident Patch 5: `1a8515b8` (2025-09-09)
**Commit Message**: Remove auto_connect field from MCP connection schemas, API routes, and database models to streamline connection management. Update related functions and UI components to reflect this change, enhancing clarity and maintainability.

**File**: `libs/chatchat-server/chatchat/server/api_server/api_schemas.py` (modified, +0/-4)
```diff
@@ -186,7 +186,6 @@ class MCPConnectionCreate(BaseModel):
     cwd: Optional[str] = Field(None, description="工作目录")
     transport: str = Field(default="stdio", pattern="^(stdio|sse)$", description="传输方式")
     timeout: int = Field(default=30, ge=1, le=300, description="连接超时时间（秒）")
-    auto_connect: bool = Field(default=False, description="是否自动连接")
     enabled: bool = Field(default=True, description="是否启用")
     description: Optional[str] = Field(None, max_length=1000, description="连接描述")
     config: Dict = Field(default={}, description="额外配置")
@@ -201,7 +200,6 @@ class MCPConnectionUpdate(BaseModel):
     cwd: Optional[str] = Field(None, description="工作目录")
     transport: Optional[str] = Field(None, pattern="^(stdio|sse)$", description="传输方式")
     timeout: Optional[int] = Field(None, ge=1, le=300, description="连接超时时间（秒）")
-    auto_connect: Optional[bool] = Field(None, description="是否自动连接")
     enabled: Optional[bool] = Field(None, description="是否启用")
     description: Optional[str] = Field(None, max_length=1000, description="连接描述")
     config: Optional[Dict] = Field(None, description="额外配置")
@@ -217,7 +215,6 @@ class MCPConnectionResponse(BaseModel):
     cwd: Optional[str]
     transport: str
     timeout: int
-    auto_connect: bool
     enabled: bool
     description: Optional[str]
     config: Dict
@@ -241,7 +238,6 @@ class MCPConnectionSearchRequest(BaseModel):
     keyword: Optional[str] = Field(None, description="搜索关键词")
     transport: Optional[str] = Field(None, description="传输方式过滤")
     enabled: Optional[bool] = Field(None, description="启用状态过滤")
-    auto_connect: Optional[bool] = Field(None, description="自动连接状态过滤")
     limit: int = Field(default=50, ge=1, le=100, description="返回数量限制")
 
 
```

**File**: `libs/chatchat-server/chatchat/server/api_server/mcp_routes.py` (modified, +1/-95)
```diff
@@ -22,11 +22,9 @@
     get_mcp_connections_by_server_name,
     get_all_mcp_connections,
     get_enabled_mcp_connections,
-    get_auto_connect_mcp_connections,
     delete_mcp_connection,
     enable_mcp_connection,
     disable_mcp_connection,
-    set_auto_connect,
     search_mcp_connections,
     get_mcp_profile,
     create_mcp_profile,
@@ -194,7 +192,6 @@ def model_to_response(model) -> MCPConnectionResponse:
         cwd=model.cwd,
         transport=model.transport,
         timeout=model.timeout,
-        auto_connect=model.auto_connect,
         enabled=model.enabled,
         description=model.description,
         config=model.config,
@@ -227,7 +224,6 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
             cwd=connection_data.cwd,
             transport=connection_data.transport,
             timeout=connection_data.timeout,
-            auto_connect=connection_data.auto_connect,
             enabled=connection_data.enabled,
             description=connection_data.description,
             config=connection_data.config,
@@ -244,7 +240,6 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
             cwd=connection["cwd"],
             transport=connection["transport"],
             timeout=connection["timeout"],
-            auto_connect=connection["auto_connect"],
             enabled=connection["enabled"],
             description=connection["description"],
             config=connection["config"],
@@ -280,7 +275,6 @@ async def list_mcp_connections(
             cwd=conn["cwd"],
             transport=conn["transport"],
             timeout=conn["timeout"],
-            auto_connect=conn["auto_connect"],
             enabled=conn["enabled"],
             description=conn["description"],
             config=conn["config"],
@@ -365,7 +359,6 @@ async def update_mcp_connection_by_id(
             cwd=update_data.cwd,
             transport=update_data.transport,
             timeout=update_data.timeout,
-            auto_connect=update_data.auto_connect,
             enabled=update_data.enabled,
             description=update_data.description,
             config=update_data.config,
@@ -515,76 +508,31 @@ async def disable_mcp_connection_endpoint(connection_id: str):
         raise HTTPException(status_code=500, detail=str(e))
 
 
-@mcp_router.post("/{connection_id}/auto_connect", response_model=MCPConnectionStatusResponse, summary="设置自动连接")
-async def set_mcp_connection_auto_connect(
-    connection_id: str, 
-    auto_connect: bool
-):
-    """
-    设置 MCP 连接的自动连接状态
-    """
-    logger.info(f"设置 MCP 连接自动连接: {connection_id}, auto_connect={auto_connect}")
-    try:
-        # 检查连接是否存在
-        existing = get_mcp_connection_by_id(connection_id)
-        if not existing:
-            logger.error(f"连接 ID '{connection_id}' 不存在")
-            raise HTTPException(
-                status_code=404,
-                detail=f"连接 ID '{connection_id}' 不存在"
-            )
-        
-        success = set_auto_connect(connection_id, auto_connect)
-        if success:
-            status = "自动连接已启用" if auto_connect else "自动连接已禁用"
-            logger.info(f"成功设置 MCP 连接自动连接: {connection_id}, {status}")
-            return MCPConnectionStatusResponse(
-                success=True,
-                message=status,
-                connection_id=connection_id
-            )
-        else:
-            logger.error(f"设置 MCP 连接自动连接失败: {connection_id}")
-            return MCPConnectionStatusResponse(
-                success=False,
-                message="自动连接设置失败",
-                connection_id=connection_id
-            )
-    
-    except HTTPException:
-        raise
-    except Exception as e:
-        logger.error(f"设置 MCP 连接自动连接失败: {str(e)}")
-        raise HTTPException(status_code=500, detail=str(e))
 
 
 @mcp_router.post("/search", response_model=MCPConnectionListResponse, summary="搜索 MCP 连接")
 async def search_mcp_connections_endpoint(search_request: MCPConnectionSearchRequest):
     """
     根据条件搜索 MCP 连接配置
     """
-    logger.info(f"搜索 MCP 连接: keyword={search_request.keyword}, transport={search_request.transport}, enabled={search_request.enabled}, auto_connect={search_request.auto_connect}, limit={search_request.limit}")
+    logger.info(f"搜索 MCP 连接: keyword={search_request.keyword}, transport={search_request.transport}, enabled={search_request.enabled}, limit={search_request.limit}")
     try:
         connections = search_mcp_connections(
             keyword=search_request.keyword,
             transport=search_request.transport,
             enabled=search_request.enabled,
-            auto_connect=search_request.auto_connect,
             limit=search_request.limit,
         )
         
         response_connections = [MCPConnectionResponse(
             id=conn["id"],
-            name=conn["name"],
-            server_type=conn["server_type"],
             server_name=conn["server_name"],
             command=conn["command"],
        
```

**File**: `libs/chatchat-server/chatchat/server/db/models/mcp_connection_model.py` (modified, +0/-2)
```diff
@@ -23,7 +23,6 @@ class MCPConnectionModel(Base):
     
     # 连接状态
     timeout = Column(Integer, default=30, comment="连接超时时间（秒）")
-    auto_connect = Column(Boolean, default=False, comment="是否自动连接")
     enabled = Column(Boolean, default=True, comment="是否启用")
     description = Column(Text, nullable=True, comment="连接器描述")
     
@@ -52,7 +51,6 @@ def to_dict(self) -> Dict:
             "env": self.env or {},
             "cwd": self.cwd,
             "timeout": self.timeout,
-            "auto_connect": self.auto_connect,
             "enabled": self.enabled,
             "description": self.description,
             "config": self.config or {},
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (modified, +0/-56)
```diff
@@ -15,7 +15,6 @@ def add_mcp_connection(
     cwd: str = None,
     transport: str = "stdio",
     timeout: int = 30,
-    auto_connect: bool = False,
     enabled: bool = True,
     description: str = "",
     config: Dict = None,
@@ -43,7 +42,6 @@ def add_mcp_connection(
         cwd=cwd,
         transport=transport,
         timeout=timeout,
-        auto_connect=auto_connect,
         enabled=enabled,
         description=description,
         config=config,
@@ -64,7 +62,6 @@ def update_mcp_connection(
     cwd: str = None,
     transport: str = None,
     timeout: int = None,
-    auto_connect: bool = None,
     enabled: bool = None,
     description: str = None,
     config: Dict = None,
@@ -89,8 +86,6 @@ def update_mcp_connection(
             mcp_connection.transport = transport
         if timeout is not None:
             mcp_connection.timeout = timeout
-        if auto_connect is not None:
-            mcp_connection.auto_connect = auto_connect
         if enabled is not None:
             mcp_connection.enabled = enabled
         if description is not None:
@@ -120,7 +115,6 @@ def get_mcp_connection_by_id(session, connection_id: str) -> Optional[dict]:
             "cwd": mcp_connection.cwd,
             "transport": mcp_connection.transport,
             "timeout": mcp_connection.timeout,
-            "auto_connect": mcp_connection.auto_connect,
             "enabled": mcp_connection.enabled,
             "description": mcp_connection.description,
             "config": mcp_connection.config,
@@ -150,7 +144,6 @@ def get_mcp_connections_by_server_name(session, server_name: str) -> List[dict]:
             "cwd": conn.cwd,
             "transport": conn.transport,
             "timeout": conn.timeout,
-            "auto_connect": conn.auto_connect,
             "enabled": conn.enabled,
             "description": conn.description,
             "config": conn.config,
@@ -181,7 +174,6 @@ def get_all_mcp_connections(session, enabled_only: bool = False) -> List[dict]:
             "cwd": conn.cwd,
             "transport": conn.transport,
             "timeout": conn.timeout,
-            "auto_connect": conn.auto_connect,
             "enabled": conn.enabled,
             "description": conn.description,
             "config": conn.config,
@@ -213,7 +205,6 @@ def get_enabled_mcp_connections(session) -> List[dict]:
             "cwd": conn.cwd,
             "transport": conn.transport,
             "timeout": conn.timeout,
-            "auto_connect": conn.auto_connect,
             "enabled": conn.enabled,
             "description": conn.description,
             "config": conn.config,
@@ -224,36 +215,6 @@ def get_enabled_mcp_connections(session) -> List[dict]:
     ]
 
 
-@with_session
-def get_auto_connect_mcp_connections(session) -> List[dict]:
-    """
-    获取所有自动连接的 MCP 连接配置
-    """
-    connections = (
-        session.query(MCPConnectionModel)
-        .filter_by(enabled=True, auto_connect=True)
-        .order_by(MCPConnectionModel.create_time.desc())
-        .all()
-    )
-    return [
-        {
-            "id": conn.id,
-            "server_name": conn.server_name,
-            "command": conn.command,
-            "args": conn.args,
-            "env": conn.env,
-            "cwd": conn.cwd,
-            "transport": conn.transport,
-            "timeout": conn.timeout,
-            "auto_connect": conn.auto_connect,
-            "enabled": conn.enabled,
-            "description": conn.description,
-            "config": conn.config,
-            "create_time": conn.create_time.isoformat() if conn.create_time else None,
-            "update_time": conn.update_time.isoformat() if conn.update_time else None,
-        }
-        for conn in connections
-    ]
 
 
 @with_session
@@ -297,26 +258,13 @@ def disable_mcp_connection(session, connection_id: str) -> bool:
     return False
 
 
-@with_session
-def set_auto_connect(session, connection_id: str, auto_connect: bool) -> bool:
-    """
-    设置 MCP 连接的自动连接状态
-    """
-    mcp_connection = session.query(MCPConnectionModel).filter_by(id=connection_id).first()
-    if mcp_connection is not None:
-        mcp_connection.auto_connect = auto_connect
-        session.add(mcp_connection)
-        session.commit()
-        return True
-    return False
 
 
 @with_session
 def search_mcp_connections(
     session,
     keyword: str = None,
     enabled: bool = None,
-    auto_connect: bool = None,
     limit: int = 50,
 ) -> List[dict]:
     """
@@ -334,9 +282,6 @@ def search_mcp_connections(
     if enabled is not None:
         query = query.filter_by(enabled=enabled)
     
-    if auto_connect is not None:
-        query = query.filter_by(auto_connect=auto_connect)
-    
     connections = query.order_by(MCPConnectionModel.create_time.desc()).limit(limit).all()
     return [
         {
@@ -348,7 +293,6 @@ def search_mcp_connections(
             "cwd": conn.cwd,
             "transport": conn.transport,
             "timeout": conn.timeou
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +6/-22)
```diff
@@ -449,21 +449,12 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                 icon_bg = icon_colors.get("stdio", "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)") if transport == "stdio" else icon_colors.get("sse", "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)")
                 
                 # 状态指示器
-                status_html = ""
-                if connection.get("auto_connect", False):
-                    status_html = f"""
-                        <div class="status-indicator">
-                            <div class="status-dot" style="background: #22C55E;"></div>
-                            <span style="color: #22C55E; font-size: 12px; font-weight: 500;">自动连接</span>
-                        </div>
-                    """
-                else:
-                    status_html = f"""
-                        <div class="status-indicator">
-                            <div class="status-dot" style="background: #6B7280;"></div>
-                            <span style="color: #6B7280; font-size: 12px; font-weight: 500;">手动连接</span>
-                        </div>
-                    """
+                status_html = """
+                    <div class="status-indicator">
+                        <div class="status-dot" style="background: #6B7280;"></div>
+                        <span style="color: #6B7280; font-size: 12px; font-weight: 500;">手动连接</span>
+                    </div>
+                """
                 
                 # 连接器卡片
                 with st.container():
@@ -778,12 +769,6 @@ def add_new_connection_form(api: "ApiRequest"):
                     key="conn_cwd",
                 )
             with col_adv2:
-                auto_connect = st.checkbox(
-                    "自动连接",
-                    value=False,
-                    help="启动时自动连接此服务器",
-                    key="conn_auto_connect",
-                )
                 enabled = st.checkbox(
                     "启用连接器",
                     value=False,
@@ -847,7 +832,6 @@ def add_new_connection_form(api: "ApiRequest"):
                 cwd=cwd or "",
                 transport=transport,
                 timeout=timeout,               # 传递整数
-                auto_connect=bool(auto_connect),
                 enabled=bool(enabled),
                 description=description or None,
                 config={},                     # 预留
```

**File**: `libs/chatchat-server/chatchat/webui_pages/utils.py` (modified, +2/-27)
```diff
@@ -772,7 +772,6 @@ def add_mcp_connection(
         cwd: Optional[str] = None,
         transport: str = "stdio",
         timeout: int = 30,
-        auto_connect: bool = False,
         enabled: bool = True,
         description: Optional[str] = None,
         config: Dict = None,
@@ -795,7 +794,6 @@ def add_mcp_connection(
             "cwd": cwd,
             "transport": transport,
             "timeout": timeout,
-            "auto_connect": auto_connect,
             "enabled": enabled,
             "description": description,
             "config": config,
@@ -828,7 +826,6 @@ def update_mcp_connection(
         cwd: Optional[str] = None,
         transport: Optional[str] = None,
         timeout: Optional[int] = None,
-        auto_connect: Optional[bool] = None,
         enabled: Optional[bool] = None,
         description: Optional[str] = None,
         config: Optional[Dict] = None,
@@ -852,8 +849,6 @@ def update_mcp_connection(
             data["transport"] = transport
         if timeout is not None:
             data["timeout"] = timeout
-        if auto_connect is not None:
-            data["auto_connect"] = auto_connect
         if enabled is not None:
             data["enabled"] = enabled
         if description is not None:
@@ -885,25 +880,12 @@ def disable_mcp_connection(self, connection_id: str, **kwargs) -> Dict:
         resp = self.post(f"/api/v1/mcp_connections/{connection_id}/disable", **kwargs)
         return self._get_response_value(resp, as_json=True)
 
-    def set_mcp_connection_auto_connect(
-        self, 
-        connection_id: str, 
-        auto_connect: bool,
-        **kwargs
-    ) -> Dict:
-        """
-        设置 MCP 连接自动连接状态
-        """
-        data = {"auto_connect": auto_connect}
-        resp = self.post(f"/api/v1/mcp_connections/{connection_id}/auto_connect", json=data, **kwargs)
-        return self._get_response_value(resp, as_json=True)
-
+    
     def search_mcp_connections(
         self,
         keyword: Optional[str] = None,
         server_type: Optional[str] = None,
         enabled: Optional[bool] = None,
-        auto_connect: Optional[bool] = None,
         limit: int = 50,
         **kwargs
     ) -> Dict:
@@ -914,7 +896,6 @@ def search_mcp_connections(
             "keyword": keyword,
             "server_type": server_type,
             "enabled": enabled,
-            "auto_connect": auto_connect,
             "limit": limit,
         }
         resp = self.post("/api/v1/mcp_connections/search", json=data, **kwargs)
@@ -934,13 +915,7 @@ def get_enabled_mcp_connections(self, **kwargs) -> Dict:
         resp = self.get("/api/v1/mcp_connections/enabled/list", **kwargs)
         return self._get_response_value(resp, as_json=True)
 
-    def get_auto_connect_mcp_connections(self, **kwargs) -> Dict:
-        """
-        获取自动连接的 MCP 连接
-        """
-        resp = self.get("/api/v1/mcp_connections/auto_connect/list", **kwargs)
-        return self._get_response_value(resp, as_json=True)
-
+    
 
 class AsyncApiRequest(ApiRequest):
     def __init__(
```

---

### Incident Patch 6: `c31cb8e3` (2025-09-09)
**Commit Message**: Refactor MCP connection update API to return consistent status responses instead of HTTP exceptions. Update related database retrieval logic and enhance web UI with toggle functionality for enabling/disabling connections, improving user experience and error handling.

**File**: `libs/chatchat-server/chatchat/server/api_server/mcp_routes.py` (modified, +28/-27)
```diff
@@ -323,7 +323,7 @@ async def get_mcp_connection(connection_id: str):
         raise HTTPException(status_code=500, detail=str(e))
 
 
-@mcp_router.put("/{connection_id}", response_model=MCPConnectionResponse, summary="更新 MCP 连接")
+@mcp_router.put("/{connection_id}", response_model=MCPConnectionStatusResponse, summary="更新 MCP 连接")
 async def update_mcp_connection_by_id(
     connection_id: str, 
     update_data: MCPConnectionUpdate
@@ -337,20 +337,24 @@ async def update_mcp_connection_by_id(
         existing = get_mcp_connection_by_id(connection_id)
         if not existing:
             logger.error(f"连接 ID '{connection_id}' 不存在")
-            raise HTTPException(
-                status_code=404,
-                detail=f"连接 ID '{connection_id}' 不存在"
-            )
+         
+            return MCPConnectionStatusResponse(
+                    connection_id=connection_id,
+                    success=False,
+                    message=f"连接 ID '{connection_id}' 不存在"
+            )   
+        
         
         # 如果更新名称，检查是否与其他连接冲突
         if update_data.server_name and update_data.server_name != existing.server_name:
-            name_existing = get_mcp_connection_by_name(name=update_data.server_name)
+            name_existing = get_connections_by_server_name(server_name=update_data.server_name)
             if name_existing:
                 logger.error(f"服务器名称 '{update_data.server_name}' 已存在")
-                raise HTTPException(
-                    status_code=400,
-                    detail=f"服务器名称 '{update_data.server_name}' 已存在"
-                )
+                return MCPConnectionStatusResponse(
+                    connection_id=connection_id,
+                    success=False,
+                    message=f"服务器名称 '{update_data.server_name}' 已存在"
+                )   
         
         updated_id = update_mcp_connection(
             connection_id=connection_id,
@@ -370,31 +374,28 @@ async def update_mcp_connection_by_id(
         if updated_id:
             connection = get_mcp_connection_by_id(connection_id)
             logger.info(f"成功更新 MCP 连接: {connection_id}")
-            return MCPConnectionResponse(
-                id=connection["id"],
-                server_name=connection["server_name"],
-                command=connection["command"],
-                args=connection["args"],
-                env=connection["env"],
-                cwd=connection["cwd"],
-                transport=connection["transport"],
-                timeout=connection["timeout"],
-                auto_connect=connection["auto_connect"],
-                enabled=connection["enabled"],
-                description=connection["description"],
-                config=connection["config"],
-                create_time=connection["create_time"],
-                update_time=connection["update_time"],
+            return MCPConnectionStatusResponse(
+                connection_id=connection["id"],
+                success=True,
+                message="成功更新",
             )
         else:
             logger.error("更新 MCP 连接失败")
-            raise HTTPException(status_code=400, detail="更新失败")
+            return MCPConnectionStatusResponse(
+                connection_id=connection_id,
+                success=False,
+                message=f"更新 MCP 连接失败",
+            )
     
     except HTTPException:
         raise
     except Exception as e:
         logger.error(f"更新 MCP 连接失败: {str(e)}")
-        raise HTTPException(status_code=500, detail=str(e))
+        return MCPConnectionStatusResponse(
+                connection_id=connection_id,
+                success=False,
+                message=f"更新 MCP 连接失败: {str(e)}",
+        )
 
 
 @mcp_router.delete("/{connection_id}", response_model=MCPConnectionStatusResponse, summary="删除 MCP 连接")
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (modified, +2/-1)
```diff
@@ -72,7 +72,8 @@ def update_mcp_connection(
     """
     更新 MCP 连接配置
     """
-    mcp_connection = get_mcp_connection_by_id(connection_id)
+    mcp_connection = session.query(MCPConnectionModel).filter_by(id=connection_id).first()
+
     if mcp_connection is not None:
         if server_name is not None:
             mcp_connection.server_name = server_name
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +27/-13)
```diff
@@ -420,8 +420,8 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
         if not st.session_state.mcp_connections_loaded:
             try:
                 connections_data = api.get_all_mcp_connections()
-                if connections_data and connections_data.get("code") == 200:
-                    st.session_state.mcp_connections = connections_data.get("data", {}).get("connections", [])
+                if connections_data:
+                    st.session_state.mcp_connections = connections_data.get("connections", [])
                     st.session_state.mcp_connections_loaded = True
                 else:
                     st.session_state.mcp_connections = []
@@ -439,14 +439,8 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
             for connection in enabled_connections:
                 # 生成连接器图标颜色
                 icon_colors = {
-                    "github": "#111827",
-                    "canva": "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
-                    "gmail": "#EF4444",
-                    "slack": "#7E22CE",
-                    "box": "#3B82F6",
-                    "notion": "#22C55E",
-                    "twitter": "#F97316",
-                    "google_drive": "#A855F7"
+                    "stdio": "#111827",
+                    "sse": "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)"
                 }
                 
                 # 获取传输类型作为图标标识
@@ -494,9 +488,8 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                         """, unsafe_allow_html=True)
                     
                     with col2:
-                        # if st.button("✏️ 编辑", key=f"edit_conn_{connection.get('id', i)}", use_container_width=True):
-                            # edit_connection_form(api, connection)
-                        pass
+                        if st.button("🔄 禁用", key=f"toggle_disable_{connection.get('id', i)}", use_container_width=True):
+                            toggle_connection_status(api, connection.get('id', i), False)
                     
                     with col3:
                         if st.button("🗑️ 删除", key=f"del_conn_{connection.get('id', i)}", use_container_width=True):
@@ -534,6 +527,9 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                             <h3>{connection.get('server_name', '')}</h3>
                         </div>
                     """, unsafe_allow_html=True)
+                    
+                    if st.button("🔄 启用", key=f"toggle_enable_{connection.get('id', i)}", use_container_width=True):
+                        toggle_connection_status(api, connection.get('id', i), True)
         else:
             st.info("暂无其他连接器")
     
@@ -898,6 +894,24 @@ def add_new_connection_form(api: "ApiRequest"):
             except Exception as e:
                 st.error(f"创建连接器时出错：{e}")
 
+def toggle_connection_status(api: ApiRequest, connection_id: str, enabled: bool):
+    """
+    切换连接器启用/禁用状态
+    """
+    try:
+        result = api.update_mcp_connection(connection_id=connection_id, enabled=enabled)
+        if result and result.get("success"):
+            status = "启用" if enabled else "禁用"
+            st.success(f"连接器{status}成功！")
+            st.session_state.mcp_connections_loaded = False  # 重新加载连接列表
+            st.rerun()
+        else:
+            status = "启用" if enabled else "禁用"
+            st.error(f"{status}失败：{result.get('message', '未知错误')}")
+    except Exception as e:
+        status = "启用" if enabled else "禁用"
+        st.error(f"{status}连接器时出错：{str(e)}")
+
 def delete_connection(api: ApiRequest, connection_id: str):
     """
     删除连接器
```

---

### Incident Patch 7: `d38a1f72` (2025-09-09)
**Commit Message**: Refactor connection form submission process in MCP management page by replacing `st.experimental_rerun()` with `st.rerun()` for improved session state handling and consistency in UI behavior.

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +8/-7)
```diff
@@ -613,7 +613,7 @@ def add_new_connection_form(api: "ApiRequest"):
         with col2:
             transport = st.selectbox(
                 "传输方式 *",
-                options=["stdio", "sse"],
+                options=["sse", "stdio"],
                 help="连接传输协议",
                 key="conn_transport",
             )
@@ -723,12 +723,12 @@ def add_new_connection_form(api: "ApiRequest"):
                 # 注意：表单内的按钮也会触发表单提交，这里使用不同的 key 且仅做状态修改
                 if st.form_submit_button(f"🗑️ 删除_{i}", use_container_width=True):
                     st.session_state.connection_args.pop(i)
-                    st.experimental_rerun()
+                    st.rerun()
 
         # 添加参数按钮（表单内）
         if st.form_submit_button("➕ 添加参数", use_container_width=False):
             st.session_state.connection_args.append("")
-            st.experimental_rerun()
+            st.rerun()
 
         # ===== 环境变量（可选） =====
         st.write("环境变量（可选）：")
@@ -753,14 +753,14 @@ def add_new_connection_form(api: "ApiRequest"):
             with col_del:
                 if st.form_submit_button(f"🗑️ 删ENV_{i}", use_container_width=True):
                     st.session_state.connection_env_vars.pop(i)
-                    st.experimental_rerun()
+                    st.rerun()
             # 同步修改
             st.session_state.connection_env_vars[i] = {"key": new_k, "value": new_v}
 
         # 添加 ENV 按钮
         if st.form_submit_button("➕ 添加环境变量"):
             st.session_state.connection_env_vars.append({"key": "", "value": ""})
-            st.experimental_rerun()
+            st.rerun()
 
         # ===== 高级设置 =====
         with st.expander("高级设置", expanded=False):
@@ -816,7 +816,7 @@ def add_new_connection_form(api: "ApiRequest"):
             st.session_state.connection_args = []
             st.session_state.connection_env_vars = []
             st.session_state.show_add_conn = False
-            st.experimental_rerun()
+            st.rerun()
 
         if submitted:
             # 校验
@@ -891,7 +891,8 @@ def add_new_connection_form(api: "ApiRequest"):
                     st.session_state.connection_args = []
                     st.session_state.connection_env_vars = []
                     st.session_state.mcp_connections_loaded = False
-                    st.experimental_rerun()
+                    st.session_state.show_add_conn = False
+                    st.rerun()
                 else:
                     st.error(f"创建失败：{getattr(result,'msg', None) or (result.get('msg') if isinstance(result, dict) else '未知错误')}")
             except Exception as e:
```

---

### Incident Patch 8: `fd7d52ea` (2025-09-09)
**Commit Message**: Refactor MCP connection schema and API to remove server_type and name fields, replacing them with server_name and transport. Update related CRUD operations and logging for consistency. Enhance database model to support additional connection configurations and improve web UI for better user experience.

**File**: `libs/chatchat-server/chatchat/server/api_server/api_schemas.py` (modified, +1/-7)
```diff
@@ -179,8 +179,6 @@ class OpenAIChatOutput(OpenAIBaseOutput):
 # MCP Connection 相关 Schema
 class MCPConnectionCreate(BaseModel):
     """创建 MCP 连接的请求体"""
-    name: str = Field(..., min_length=1, max_length=100, description="连接名称")
-    server_type: str = Field(..., min_length=1, max_length=50, description="服务器类型")
     server_name: str = Field(..., min_length=1, max_length=100, description="服务器名称")
     command: str = Field(..., min_length=1, max_length=500, description="启动命令")
     args: List[str] = Field(default=[], description="命令参数")
@@ -196,8 +194,6 @@ class MCPConnectionCreate(BaseModel):
 
 class MCPConnectionUpdate(BaseModel):
     """更新 MCP 连接的请求体"""
-    name: Optional[str] = Field(None, min_length=1, max_length=100, description="连接名称")
-    server_type: Optional[str] = Field(None, min_length=1, max_length=50, description="服务器类型")
     server_name: Optional[str] = Field(None, min_length=1, max_length=100, description="服务器名称")
     command: Optional[str] = Field(None, min_length=1, max_length=500, description="启动命令")
     args: Optional[List[str]] = Field(None, description="命令参数")
@@ -214,8 +210,6 @@ class MCPConnectionUpdate(BaseModel):
 class MCPConnectionResponse(BaseModel):
     """MCP 连接响应体"""
     id: str
-    name: str
-    server_type: str
     server_name: str
     command: str
     args: List[str]
@@ -245,7 +239,7 @@ class MCPConnectionListResponse(BaseModel):
 class MCPConnectionSearchRequest(BaseModel):
     """MCP 连接搜索请求体"""
     keyword: Optional[str] = Field(None, description="搜索关键词")
-    server_type: Optional[str] = Field(None, description="服务器类型过滤")
+    transport: Optional[str] = Field(None, description="传输方式过滤")
     enabled: Optional[bool] = Field(None, description="启用状态过滤")
     auto_connect: Optional[bool] = Field(None, description="自动连接状态过滤")
     limit: int = Field(default=50, ge=1, le=100, description="返回数量限制")
```

**File**: `libs/chatchat-server/chatchat/server/api_server/mcp_routes.py` (modified, +12/-24)
```diff
@@ -188,8 +188,6 @@ def model_to_response(model) -> MCPConnectionResponse:
     """将数据库模型转换为响应对象"""
     return MCPConnectionResponse(
         id=model.id,
-        name=model.name,
-        server_type=model.server_type,
         server_name=model.server_name,
         command=model.command,
         args=model.args,
@@ -211,20 +209,18 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
     """
     创建新的 MCP 连接配置
     """
-    logger.info(f"创建 MCP 连接: {connection_data.name}")
+    logger.info(f"创建 MCP 连接: {connection_data.server_name}")
     try:
-        # 检查名称是否已存在
-        existing = get_mcp_connection_by_name(name=connection_data.name)
+        # 检查服务器名称是否已存在
+        existing = get_mcp_connection_by_name(name=connection_data.server_name)
         if existing:
-            logger.error(f"连接名称 '{connection_data.name}' 已存在")
+            logger.error(f"服务器名称 '{connection_data.server_name}' 已存在")
             raise HTTPException(
                 status_code=400,
-                detail=f"连接名称 '{connection_data.name}' 已存在"
+                detail=f"服务器名称 '{connection_data.server_name}' 已存在"
             )
         
         connection_id = add_mcp_connection(
-            name=connection_data.name,
-            server_type=connection_data.server_type,
             server_name=connection_data.server_name,
             command=connection_data.command,
             args=connection_data.args,
@@ -239,11 +235,9 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
         )
         
         connection = get_mcp_connection_by_id(connection_id)
-        logger.info(f"成功创建 MCP 连接: {connection_data.name}, ID: {connection_id}")
+        logger.info(f"成功创建 MCP 连接: {connection_data.server_name}, ID: {connection_id}")
         return MCPConnectionResponse(
             id=connection["id"],
-            name=connection["name"],
-            server_type=connection["server_type"],
             server_name=connection["server_name"],
             command=connection["command"],
             args=connection["args"],
@@ -280,8 +274,6 @@ async def list_mcp_connections(
         
         response_connections = [MCPConnectionResponse(
             id=conn["id"],
-            name=conn["name"],
-            server_type=conn["server_type"],
             server_name=conn["server_name"],
             command=conn["command"],
             args=conn["args"],
@@ -352,19 +344,17 @@ async def update_mcp_connection_by_id(
             )
         
         # 如果更新名称，检查是否与其他连接冲突
-        if update_data.name and update_data.name != existing.name:
-            name_existing = get_mcp_connection_by_name(name=update_data.name)
+        if update_data.server_name and update_data.server_name != existing.server_name:
+            name_existing = get_mcp_connection_by_name(name=update_data.server_name)
             if name_existing:
-                logger.error(f"连接名称 '{update_data.name}' 已存在")
+                logger.error(f"服务器名称 '{update_data.server_name}' 已存在")
                 raise HTTPException(
                     status_code=400,
-                    detail=f"连接名称 '{update_data.name}' 已存在"
+                    detail=f"服务器名称 '{update_data.server_name}' 已存在"
                 )
         
         updated_id = update_mcp_connection(
             connection_id=connection_id,
-            name=update_data.name,
-            server_type=update_data.server_type,
             server_name=update_data.server_name,
             command=update_data.command,
             args=update_data.args,
@@ -383,8 +373,6 @@ async def update_mcp_connection_by_id(
             logger.info(f"成功更新 MCP 连接: {connection_id}")
             return MCPConnectionResponse(
                 id=connection["id"],
-                name=connection["name"],
-                server_type=connection["server_type"],
                 server_name=connection["server_name"],
                 command=connection["command"],
                 args=connection["args"],
@@ -575,11 +563,11 @@ async def search_mcp_connections_endpoint(search_request: MCPConnectionSearchReq
     """
     根据条件搜索 MCP 连接配置
     """
-    logger.info(f"搜索 MCP 连接: keyword={search_request.keyword}, server_type={search_request.server_type}, enabled={search_request.enabled}, auto_connect={search_request.auto_connect}, limit={search_request.limit}")
+    logger.info(f"搜索 MCP 连接: keyword={search_request.keyword}, transport={search_request.transport}, enabled={search_request.enabled}, auto_connect={search_request.auto_connect}, limit={search_request.limit}")
     try:
         connections = search_mcp_connections(
             keyword=search_request.keyword,
-            server_type=search_request.server_type,
+            transport=search_request.transport,
             enabled=search_request.enabled,
             auto_connect=search_request.auto_connect,
             limit=search_request.limit,
```

**File**: `libs/chatchat-server/chatchat/server/db/models/mcp_connection_model.py` (modified, +119/-13)
```diff
@@ -1,34 +1,140 @@
-from sqlalchemy import JSON, Column, DateTime, Integer, String, func, Boolean, Text
+from datetime import datetime
+from typing import Dict, List, Optional, Union
+from sqlalchemy import Boolean, Column, DateTime, Integer, String, JSON, Text, func
 
 from chatchat.server.db.base import Base
 
 
 class MCPConnectionModel(Base):
     """
-    MCP 连接配置模型
+    MCP 连接配置模型 - 支持 StdioConnection 和 SSEConnection 类型
     """
 
     __tablename__ = "mcp_connection"
 
+    # 基本信息
     id = Column(String(32), primary_key=True, comment="MCP连接ID")
-    name = Column(String(100), nullable=False, comment="连接名称")
-    server_type = Column(String(50), nullable=False, comment="服务器类型")
-    server_name = Column(String(100), nullable=False, comment="服务器名称")
-    command = Column(String(500), nullable=False, comment="启动命令")
-    args = Column(JSON, default=[], comment="命令参数")
-    env = Column(JSON, default={}, comment="环境变量")
-    cwd = Column(String(500), comment="工作目录")
-    transport = Column(String(20), default="stdio", comment="传输方式：stdio 或 sse")
+    server_name = Column(String(100), unique=True, nullable=False, comment="服务器名称")
+    transport = Column(String(20), nullable=False, comment="传输方式: stdio, sse")
+    command = Column(String(500), nullable=True, comment="启动命令")
+    args = Column(JSON, default=[], comment="命令参数列表")
+    env = Column(JSON, default={}, comment="环境变量字典")
+    cwd = Column(String(500), nullable=True, comment="工作目录")
+    
+    # 连接状态
     timeout = Column(Integer, default=30, comment="连接超时时间（秒）")
     auto_connect = Column(Boolean, default=False, comment="是否自动连接")
     enabled = Column(Boolean, default=True, comment="是否启用")
-    description = Column(Text, comment="连接描述")
-    config = Column(JSON, default={}, comment="额外配置")
+    description = Column(Text, nullable=True, comment="连接器描述")
+    
+    # 传输特定配置
+    config = Column(JSON, default={}, comment="传输特定配置")
+    
+    # 元数据
+    last_connected_at = Column(DateTime, nullable=True, comment="最后连接时间")
+    connection_status = Column(String(50), default="disconnected", comment="连接状态")
+    error_message = Column(Text, nullable=True, comment="错误信息")
+    
     create_time = Column(DateTime, default=func.now(), comment="创建时间")
     update_time = Column(DateTime, default=func.now(), onupdate=func.now(), comment="更新时间")
 
     def __repr__(self):
-        return f"<MCPConnection(id='{self.id}', name='{self.name}', server_type='{self.server_type}', server_name='{self.server_name}', enabled={self.enabled}, create_time='{self.create_time}')>"
+        return f"<MCPConnection(id='{self.id}', server_name='{self.server_name}', transport='{self.transport}', enabled={self.enabled})>"
+
+    def to_dict(self) -> Dict:
+        """转换为字典格式"""
+        return {
+            "id": self.id,
+            "server_name": self.server_name,
+            "transport": self.transport,
+            "command": self.command,
+            "args": self.args or [],
+            "env": self.env or {},
+            "cwd": self.cwd,
+            "timeout": self.timeout,
+            "auto_connect": self.auto_connect,
+            "enabled": self.enabled,
+            "description": self.description,
+            "config": self.config or {},
+            "last_connected_at": self.last_connected_at.isoformat() if self.last_connected_at else None,
+            "connection_status": self.connection_status,
+            "error_message": self.error_message,
+            "create_time": self.create_time.isoformat() if self.create_time else None,
+            "update_time": self.update_time.isoformat() if self.update_time else None,
+        }
+
+    def get_stdio_config(self) -> Dict[str, Union[str, List[str], Dict[str, str]]]:
+        """获取 stdio 传输配置"""
+        if self.transport != "stdio":
+            raise ValueError("Not a stdio connection")
+        
+        return {
+            "transport": "stdio",
+            "command": self.command or "",
+            "args": self.args or [],
+            "env": self.env or {},
+            "cwd": self.cwd or "",
+            "encoding": self.config.get("encoding", "utf-8") if self.config else "utf-8",
+            "encoding_error_handler": self.config.get("encoding_error_handler", "strict") if self.config else "strict",
+        }
+
+    def get_sse_config(self) -> Dict[str, Union[str, Dict[str, str], float]]:
+        """获取 SSE 传输配置"""
+        if self.transport != "sse":
+            raise ValueError("Not an SSE connection")
+        
+        config = self.config or {}
+        return {
+            "transport": "sse",
+            "url": config.get("url", ""),
+            "headers": config.get("headers", None),
+            "timeout": config.get("timeout", 30),
+            "sse_read_timeout": config.get("sse_read_timeout", 30),
+            "encoding": config.get("encoding", "utf-8"),
+            "encoding_error_handler": config.get("encoding_error_handler", "strict"),
+        }
+
+    def set_stdio_config(
+     
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (modified, +3/-34)
```diff
@@ -8,8 +8,6 @@
 @with_session
 def add_mcp_connection(
     session,
-    name: str,
-    server_type: str,
     server_name: str,
     command: str,
     args: List[str] = None,
@@ -38,8 +36,6 @@ def add_mcp_connection(
     
     mcp_connection = MCPConnectionModel(
         id=connection_id,
-        name=name,
-        server_type=server_type,
         server_name=server_name,
         command=command,
         args=args,
@@ -61,8 +57,6 @@ def add_mcp_connection(
 def update_mcp_connection(
     session,
     connection_id: str,
-    name: str = None,
-    server_type: str = None,
     server_name: str = None,
     command: str = None,
     args: List[str] = None,
@@ -80,10 +74,6 @@ def update_mcp_connection(
     """
     mcp_connection = get_mcp_connection_by_id(connection_id)
     if mcp_connection is not None:
-        if name is not None:
-            mcp_connection.name = name
-        if server_type is not None:
-            mcp_connection.server_type = server_type
         if server_name is not None:
             mcp_connection.server_name = server_name
         if command is not None:
@@ -122,8 +112,6 @@ def get_mcp_connection_by_id(session, connection_id: str) -> Optional[dict]:
     if mcp_connection:
         return {
             "id": mcp_connection.id,
-            "name": mcp_connection.name,
-            "server_type": mcp_connection.server_type,
             "server_name": mcp_connection.server_name,
             "command": mcp_connection.command,
             "args": mcp_connection.args,
@@ -142,16 +130,14 @@ def get_mcp_connection_by_id(session, connection_id: str) -> Optional[dict]:
 
 
 @with_session
-def get_mcp_connection_by_name(session, name: str) -> Optional[dict]:
+def get_mcp_connection_by_server_name(session, server_name: str) -> Optional[dict]:
     """
-    根据名称查询 MCP 连接配置
+    根据服务器名称查询 MCP 连接配置
     """
-    mcp_connection = session.query(MCPConnectionModel).filter_by(name=name).first()
+    mcp_connection = session.query(MCPConnectionModel).filter_by(server_name=server_name).first()
     if mcp_connection:
         return {
             "id": mcp_connection.id,
-            "name": mcp_connection.name,
-            "server_type": mcp_connection.server_type,
             "server_name": mcp_connection.server_name,
             "command": mcp_connection.command,
             "args": mcp_connection.args,
@@ -182,8 +168,6 @@ def get_mcp_connections_by_server_name(session, server_name: str) -> List[dict]:
     return [
         {
             "id": conn.id,
-            "name": conn.name,
-            "server_type": conn.server_type,
             "server_name": conn.server_name,
             "command": conn.command,
             "args": conn.args,
@@ -215,8 +199,6 @@ def get_all_mcp_connections(session, enabled_only: bool = False) -> List[dict]:
     return [
         {
             "id": conn.id,
-            "name": conn.name,
-            "server_type": conn.server_type,
             "server_name": conn.server_name,
             "command": conn.command,
             "args": conn.args,
@@ -249,8 +231,6 @@ def get_enabled_mcp_connections(session) -> List[dict]:
     return [
         {
             "id": conn.id,
-            "name": conn.name,
-            "server_type": conn.server_type,
             "server_name": conn.server_name,
             "command": conn.command,
             "args": conn.args,
@@ -283,8 +263,6 @@ def get_auto_connect_mcp_connections(session) -> List[dict]:
     return [
         {
             "id": conn.id,
-            "name": conn.name,
-            "server_type": conn.server_type,
             "server_name": conn.server_name,
             "command": conn.command,
             "args": conn.args,
@@ -362,7 +340,6 @@ def set_auto_connect(session, connection_id: str, auto_connect: bool) -> bool:
 def search_mcp_connections(
     session,
     keyword: str = None,
-    server_type: str = None,
     enabled: bool = None,
     auto_connect: bool = None,
     limit: int = 50,
@@ -375,14 +352,10 @@ def search_mcp_connections(
     if keyword:
         keyword = f"%{keyword}%"
         query = query.filter(
-            MCPConnectionModel.name.like(keyword) |
             MCPConnectionModel.server_name.like(keyword) |
             MCPConnectionModel.description.like(keyword)
         )
     
-    if server_type:
-        query = query.filter_by(server_type=server_type)
-    
     if enabled is not None:
         query = query.filter_by(enabled=enabled)
     
@@ -393,8 +366,6 @@ def search_mcp_connections(
     return [
         {
             "id": conn.id,
-            "name": conn.name,
-            "server_type": conn.server_type,
             "server_name": conn.server_name,
             "command": conn.command,
             "args": conn.args,
@@ -508,8 +479,6 @@ def reset_mcp_profile(session):
     profile = session.query(MCPProfileModel).first()
     if profile is not None:
         profile.timeout = 30
-        profile.transport = "stdio"
-     
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +88/-43)
```diff
@@ -449,11 +449,10 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                     "google_drive": "#A855F7"
                 }
                 
-                # 获取连接器名称首字母作为图标
-                name = connection.get("name", "")
-                server_type = connection.get("server_type", "").lower()
-                icon_letter = name[0].upper() if name else "C"
-                icon_bg = icon_colors.get(server_type, "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)")
+                # 获取传输类型作为图标标识
+                transport = connection.get("transport", "stdio").lower()
+                icon_letter = "S" if transport == "stdio" else "E"
+                icon_bg = icon_colors.get("stdio", "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)") if transport == "stdio" else icon_colors.get("sse", "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)")
                 
                 # 状态指示器
                 status_html = ""
@@ -485,8 +484,8 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                                             <span>{icon_letter}</span>
                                         </div>
                                         <div class="connector-info">
-                                            <h3>{connection.get('name', '')}</h3>
-                                            <p>{connection.get('description', '') or connection.get('server_type', '')}</p>
+                                            <h3>{connection.get('server_name', '')}</h3>
+                                            <p>{connection.get('description', '') or connection.get('transport', '').upper()}</p>
                                             {status_html}
                                         </div>
                                     </div>
@@ -519,26 +518,20 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                 with cols[i % 3]:
                     # 生成连接器图标
                     icon_emojis = {
-                        "github": "🐙",
-                        "canva": "🎨",
-                        "gmail": "📧",
-                        "slack": "💬",
-                        "box": "📦",
-                        "notion": "📝",
-                        "twitter": "🐦",
-                        "google_drive": "🗄️"
+                        "stdio": "💻",
+                        "sse": "🌐"
                     }
                     
-                    server_type = connection.get("server_type", "").lower()
-                    icon_emoji = icon_emojis.get(server_type, "🔗")
+                    transport = connection.get("transport", "stdio").lower()
+                    icon_emoji = icon_emojis.get(transport, "🔗")
                     
                     # 连接器卡片
                     st.markdown(f"""
                         <div class="browse-card">
                             <div class="browse-icon" style="background: rgba(107, 114, 128, 0.1);">
                                 <span style="color: #6B7280; font-size: 24px;">{icon_emoji}</span>
                             </div>
-                            <h3>{connection.get('name', '')}</h3>
+                            <h3>{connection.get('server_name', '')}</h3>
                         </div>
                     """, unsafe_allow_html=True)
         else:
@@ -611,21 +604,9 @@ def add_new_connection_form(api: "ApiRequest"):
         # ===== 基本信息 =====
         col1, col2 = st.columns(2)
         with col1:
-            name = st.text_input(
-                "连接器名称 *",
-                placeholder="例如：我的GitHub",
-                help="连接器的显示名称",
-                key="conn_name",
-            )
-            server_type = st.selectbox(
-                "服务器类型 *",
-                options=["github", "canva", "gmail", "slack", "box", "notion", "twitter", "google_drive"],
-                help="选择连接器类型",
-                key="conn_server_type",
-            )
             server_name = st.text_input(
                 "服务器名称 *",
-                placeholder="例如：github-server",
+                placeholder="例如：my-server",
                 help="服务器的唯一标识符",
                 key="conn_server_name",
             )
@@ -638,17 +619,35 @@ def add_new_connection_form(api: "ApiRequest"):
             )
 
         # ===== 启动命令 / SSE 配置 =====
-        st.subheader("启动命令 / 连接参数")
+        st.subheader("传输配置")
         # 统一给 command 一个默认值，避免未定义
         command = ""
 
         if transport == "stdio":
             command = st.text_input(
                 "启动命令 *",
                 placeholder="例如：python -m mcp_server",
-                help="启动 MCP 服务器的命令（stdio）",
+                help="启动 MCP 服务器的命令",
                 key="conn_command",
             )
+            
+            # Stdio 特定配置
+            st.subheader("Stdio 传输配置")
+            encoding = st.selectbox(
+                "文本编码",
+                options=["utf-8", "gbk", "ascii", "latin-1"],
+                index=
```

**File**: `libs/chatchat-server/chatchat/webui_pages/utils.py` (modified, +0/-10)
```diff
@@ -765,8 +765,6 @@ def delete_mcp_profile(self, **kwargs) -> Dict:
     # MCP Connection Methods
     def add_mcp_connection(
         self,
-        name: str,
-        server_type: str,
         server_name: str,
         command: str,
         args: List[str] = None,
@@ -790,8 +788,6 @@ def add_mcp_connection(
         if config is None:
             config = {}
         data = {
-            "name": name,
-            "server_type": server_type,
             "server_name": server_name,
             "command": command,
             "args": args,
@@ -825,8 +821,6 @@ def get_mcp_connection(self, connection_id: str, **kwargs) -> Dict:
     def update_mcp_connection(
         self,
         connection_id: str,
-        name: Optional[str] = None,
-        server_type: Optional[str] = None,
         server_name: Optional[str] = None,
         command: Optional[str] = None,
         args: Optional[List[str]] = None,
@@ -844,10 +838,6 @@ def update_mcp_connection(
         更新 MCP 连接
         """
         data = {}
-        if name is not None:
-            data["name"] = name
-        if server_type is not None:
-            data["server_type"] = server_type
         if server_name is not None:
             data["server_name"] = server_name
         if command is not None:
```

---

### Incident Patch 9: `1f1a0870` (2025-09-07)
**Commit Message**: Enhance MCP connection management by adding detailed logging for CRUD operations and refactoring database interaction to return dictionaries instead of model instances. This improves error handling and response consistency across the API, while also updating the web UI to support editing and deleting connections with better user feedback.

**File**: `libs/chatchat-server/chatchat/server/api_server/mcp_routes.py` (modified, +205/-21)
```diff
@@ -48,16 +48,19 @@ async def get_mcp_profile_endpoint():
     """
     获取 MCP 通用配置
     """
+    logger.info("获取 MCP 通用配置")
     try:
         profile = get_mcp_profile()
         if profile:
+            logger.info("成功获取 MCP 通用配置")
             return MCPProfileResponse(
-                timeout=profile.timeout,
-                working_dir=profile.working_dir,
-                env_vars=profile.env_vars,
-                update_time=profile.update_time.isoformat() if profile.update_time else None
+                timeout=profile["timeout"],
+                working_dir=profile["working_dir"],
+                env_vars=profile["env_vars"],
+                update_time=profile["update_time"]
             )
         else:
+            logger.info("MCP 通用配置不存在，返回默认配置")
             # 如果不存在配置，返回默认配置
             return MCPProfileResponse(
                 timeout=30,
@@ -71,6 +74,7 @@ async def get_mcp_profile_endpoint():
             )
     
     except Exception as e:
+        logger.error(f"获取 MCP 通用配置失败: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))
 
 
@@ -79,6 +83,7 @@ async def create_or_update_mcp_profile(profile_data: MCPProfileCreate):
     """
     创建或更新 MCP 通用配置
     """
+    logger.info(f"创建/更新 MCP 通用配置: timeout={profile_data.timeout}, working_dir={profile_data.working_dir}")
     try:
         profile_id = create_mcp_profile(
             timeout=profile_data.timeout,
@@ -87,15 +92,16 @@ async def create_or_update_mcp_profile(profile_data: MCPProfileCreate):
         )
         
         profile = get_mcp_profile()
+        logger.info(f"成功创建/更新 MCP 通用配置，ID: {profile_id}")
         return MCPProfileResponse(
-            timeout=profile.timeout,
-            working_dir=profile.working_dir,
-            env_vars=profile.env_vars,
-            update_time=profile.update_time.isoformat() if profile.update_time else None
+            timeout=profile["timeout"],
+            working_dir=profile["working_dir"],
+            env_vars=profile["env_vars"],
+            update_time=profile["update_time"]
         )
     
     except Exception as e:
-        logger.error(e)
+        logger.error(f"创建/更新 MCP 通用配置失败: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))
 
 
@@ -104,6 +110,7 @@ async def update_mcp_profile_endpoint(profile_data: MCPProfileCreate):
     """
     更新 MCP 通用配置
     """
+    logger.info(f"更新 MCP 通用配置: timeout={profile_data.timeout}, working_dir={profile_data.working_dir}")
     try:
         profile_id = update_mcp_profile(
             timeout=profile_data.timeout,
@@ -112,15 +119,16 @@ async def update_mcp_profile_endpoint(profile_data: MCPProfileCreate):
         )
         
         profile = get_mcp_profile()
+        logger.info(f"成功更新 MCP 通用配置，ID: {profile_id}")
         return MCPProfileResponse(
-            timeout=profile.timeout,
-            working_dir=profile.working_dir,
-            env_vars=profile.env_vars,
-            update_time=profile.update_time.isoformat() if profile.update_time else None
+            timeout=profile["timeout"],
+            working_dir=profile["working_dir"],
+            env_vars=profile["env_vars"],
+            update_time=profile["update_time"]
         )
     
     except Exception as e:
-        logger.error(e)
+        logger.error(f"更新 MCP 通用配置失败: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))
 
 
@@ -129,20 +137,24 @@ async def reset_mcp_profile_endpoint():
     """
     重置 MCP 通用配置为默认值
     """
+    logger.info("重置 MCP 通用配置为默认值")
     try:
         success = reset_mcp_profile()
         if success:
+            logger.info("成功重置 MCP 通用配置")
             return MCPProfileStatusResponse(
                 success=True,
                 message="MCP 通用配置已重置为默认值"
             )
         else:
+            logger.error("重置 MCP 通用配置失败")
             return MCPProfileStatusResponse(
                 success=False,
                 message="重置 MCP 通用配置失败"
             )
     
     except Exception as e:
+        logger.error(f"重置 MCP 通用配置失败: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))
 
 
@@ -151,20 +163,24 @@ async def delete_mcp_profile_endpoint():
     """
     删除 MCP 通用配置
     """
+    logger.info("删除 MCP 通用配置")
     try:
         success = delete_mcp_profile()
         if success:
+            logger.info("成功删除 MCP 通用配置")
             return MCPProfileStatusResponse(
                 success=True,
                 message="MCP 通用配置已删除"
             )
         else:
+            logger.error("删除 MCP 通用配置失败")
             return MCPProfileStatusResponse(
                 success=False,
                 message="删除 MCP 通用配置失败"
             )
     
     except Exception as e:
+        logger.error(f"删除 MCP 通用配置失败: {str(e)}")
         raise HTTPException(status_code=500, detail=str(e))
 
 
@@ -195,10 +211,12 @@ async def create_mcp_connection(connection_data: MCPConnectionCreate):
     """
     创建新的 MCP 连接配置
     """
+    logger.info(f"创建 MC
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (modified, +173/-25)
```diff
@@ -78,7 +78,7 @@ def update_mcp_connection(
     """
     更新 MCP 连接配置
     """
-    mcp_connection = get_mcp_connection_by_id(session, connection_id)
+    mcp_connection = get_mcp_connection_by_id(connection_id)
     if mcp_connection is not None:
         if name is not None:
             mcp_connection.name = name
@@ -114,25 +114,63 @@ def update_mcp_connection(
 
 
 @with_session
-def get_mcp_connection_by_id(session, connection_id: str) -> Optional[MCPConnectionModel]:
+def get_mcp_connection_by_id(session, connection_id: str) -> Optional[dict]:
     """
     根据 ID 查询 MCP 连接配置
     """
     mcp_connection = session.query(MCPConnectionModel).filter_by(id=connection_id).first()
-    return mcp_connection
+    if mcp_connection:
+        return {
+            "id": mcp_connection.id,
+            "name": mcp_connection.name,
+            "server_type": mcp_connection.server_type,
+            "server_name": mcp_connection.server_name,
+            "command": mcp_connection.command,
+            "args": mcp_connection.args,
+            "env": mcp_connection.env,
+            "cwd": mcp_connection.cwd,
+            "transport": mcp_connection.transport,
+            "timeout": mcp_connection.timeout,
+            "auto_connect": mcp_connection.auto_connect,
+            "enabled": mcp_connection.enabled,
+            "description": mcp_connection.description,
+            "config": mcp_connection.config,
+            "create_time": mcp_connection.create_time.isoformat() if mcp_connection.create_time else None,
+            "update_time": mcp_connection.update_time.isoformat() if mcp_connection.update_time else None,
+        }
+    return None
 
 
 @with_session
-def get_mcp_connection_by_name(session, name: str) -> Optional[MCPConnectionModel]:
+def get_mcp_connection_by_name(session, name: str) -> Optional[dict]:
     """
     根据名称查询 MCP 连接配置
     """
     mcp_connection = session.query(MCPConnectionModel).filter_by(name=name).first()
-    return mcp_connection
+    if mcp_connection:
+        return {
+            "id": mcp_connection.id,
+            "name": mcp_connection.name,
+            "server_type": mcp_connection.server_type,
+            "server_name": mcp_connection.server_name,
+            "command": mcp_connection.command,
+            "args": mcp_connection.args,
+            "env": mcp_connection.env,
+            "cwd": mcp_connection.cwd,
+            "transport": mcp_connection.transport,
+            "timeout": mcp_connection.timeout,
+            "auto_connect": mcp_connection.auto_connect,
+            "enabled": mcp_connection.enabled,
+            "description": mcp_connection.description,
+            "config": mcp_connection.config,
+            "create_time": mcp_connection.create_time.isoformat() if mcp_connection.create_time else None,
+            "update_time": mcp_connection.update_time.isoformat() if mcp_connection.update_time else None,
+        }
+    return None
 
 
 @with_session
-def get_mcp_connections_by_server_name(session, server_name: str) -> List[MCPConnectionModel]:
+def get_mcp_connections_by_server_name(session, server_name: str) -> List[dict]:
     """
     根据服务器名称查询 MCP 连接配置列表
     """
@@ -141,11 +179,31 @@ def get_mcp_connections_by_server_name(session, server_name: str) -> List[MCPCon
         .filter_by(server_name=server_name)
         .all()
     )
-    return connections
+    return [
+        {
+            "id": conn.id,
+            "name": conn.name,
+            "server_type": conn.server_type,
+            "server_name": conn.server_name,
+            "command": conn.command,
+            "args": conn.args,
+            "env": conn.env,
+            "cwd": conn.cwd,
+            "transport": conn.transport,
+            "timeout": conn.timeout,
+            "auto_connect": conn.auto_connect,
+            "enabled": conn.enabled,
+            "description": conn.description,
+            "config": conn.config,
+            "create_time": conn.create_time.isoformat() if conn.create_time else None,
+            "update_time": conn.update_time.isoformat() if conn.update_time else None,
+        }
+        for conn in connections
+    ]
 
 
 @with_session
-def get_all_mcp_connections(session, enabled_only: bool = False) -> List[MCPConnectionModel]:
+def get_all_mcp_connections(session, enabled_only: bool = False) -> List[dict]:
     """
     获取所有 MCP 连接配置
     """
@@ -154,11 +212,31 @@ def get_all_mcp_connections(session, enabled_only: bool = False) -> List[MCPConn
         query = query.filter_by(enabled=True)
     
     connections = query.order_by(MCPConnectionModel.create_time.desc()).all()
-    return connections
+    return [
+        {
+            "id": conn.id,
+            "name": conn.name,
+            "server_type": conn.server_type,
+            "server_name": conn.server_name,
+            "command": conn.command,
+            "args": conn.args,
+            "env": conn.env,
+            "cwd": conn.cwd,
+            "transport": con
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/dialogue.py` (modified, +307/-30)
```diff
@@ -240,8 +240,8 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
             if not st.session_state.mcp_profile_loaded:
                 try:
                     profile_data = api.get_mcp_profile()
-                    if profile_data and profile_data.get("code") == 200:
-                        st.session_state.mcp_profile = profile_data.get("data", {})
+                    if profile_data:
+                        st.session_state.mcp_profile = profile_data
                         # 初始化环境变量列表
                         env_vars = st.session_state.mcp_profile.get("env_vars", {})
                         st.session_state.env_vars_list = [
@@ -278,6 +278,12 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                 help="设置MCP连接器的默认超时时间，范围：10-300秒"
             )
             
+            # 工作目录设置
+            working_dir = st.text_input(
+                "默认工作目录",
+                value=st.session_state.mcp_profile.get("working_dir", str(Settings.CHATCHAT_ROOT)),
+                help="设置MCP连接器的默认工作目录"
+            )
             # 环境变量设置
             st.subheader("环境变量配置")
             
@@ -303,7 +309,7 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                         key=f"env_key_{i}",
                         placeholder="例如：PATH"
                     )
-                
+                    env_var["key"] = key
                 with col2:
                     value = st.text_input(
                         "变量值",
@@ -312,15 +318,30 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                         placeholder="例如：/usr/bin"
                     )
                 
+                    env_var["value"] = value
                 with col3:
                     if st.button("🗑️", key=f"env_delete_{i}", help="删除此环境变量"):
                         st.session_state.env_vars_list.pop(i)
+                        # 删除后立即保存到数据库
+                        try:
+                            env_vars_dict = {}
+                            for env_var in st.session_state.env_vars_list:
+                                if env_var["key"] and env_var["value"]:
+                                    env_vars_dict[env_var["key"]] = env_var["value"]
+                            
+                            result = api.update_mcp_profile(
+                                timeout=timeout_value,
+                                working_dir=working_dir,
+                                env_vars=env_vars_dict
+                            )
+                             
+                            # 更新值
+                            if key != env_var["key"] or value != env_var["value"]:
+                                st.session_state.env_vars_list[i] = {"key": key, "value": value}
+                        except Exception as e:
+                            st.error(f"删除失败: {str(e)}")
                         st.rerun()
                 
-                # 更新值
-                if key != env_var["key"] or value != env_var["value"]:
-                    st.session_state.env_vars_list[i] = {"key": key, "value": value}
-            
             # 添加新环境变量按钮
             if st.button("➕ 添加环境变量", key="add_env_var"):
                 st.session_state.env_vars_list.append({"key": "", "value": ""})
@@ -342,12 +363,6 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
             else:
                 st.info("暂无配置的环境变量")
             
-            # 工作目录设置
-            working_dir = st.text_input(
-                "默认工作目录",
-                value=st.session_state.mcp_profile.get("working_dir", str(Settings.CHATCHAT_ROOT)),
-                help="设置MCP连接器的默认工作目录"
-            )
             
             # 保存设置按钮
             col1, col2 = st.columns([1, 2])
@@ -368,7 +383,7 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                             env_vars=env_vars_dict
                         )
                         
-                        if result and result.get("code") == 200:
+                        if result:
                             st.success("通用设置已保存")
                             st.session_state.mcp_profile_loaded = False  # 重新加载
                         else:
@@ -380,7 +395,7 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                 if st.button("🔄 重置默认", use_container_width=True):
                     try:
                         result = api.reset_mcp_profile()
-                        if result and result.get("code") == 200:
+                        if result and result.get("success"):
                             # 重置UI状态
                             st.session_state.env_vars_list = [
                                 {"key": "PATH", "value": "/usr/local/bin:/usr/bin:/bin"},
@@ -456,23 +471,33 @@ def mcp_management_page(api: ApiRequest, is_lite: bool = False):
                 
                 # 连接器卡片
                 with st.container():
-      
```

---

### Incident Patch 10: `aef412dc` (2025-09-05)
**Commit Message**: Add MCP connection management functionality including API routes, database models, and web UI integration. Implement CRUD operations for MCP connections and profiles, enhancing the overall system for managing connections with detailed configurations and settings.

**File**: `libs/chatchat-server/chatchat/server/api_server/api_schemas.py` (modified, +103/-0)
```diff
@@ -174,3 +174,106 @@ def model_dump_json(self):
 
 class OpenAIChatOutput(OpenAIBaseOutput):
     ...
+
+
+# MCP Connection 相关 Schema
+class MCPConnectionCreate(BaseModel):
+    """创建 MCP 连接的请求体"""
+    name: str = Field(..., min_length=1, max_length=100, description="连接名称")
+    server_type: str = Field(..., min_length=1, max_length=50, description="服务器类型")
+    server_name: str = Field(..., min_length=1, max_length=100, description="服务器名称")
+    command: str = Field(..., min_length=1, max_length=500, description="启动命令")
+    args: List[str] = Field(default=[], description="命令参数")
+    env: Dict[str, str] = Field(default={}, description="环境变量")
+    cwd: Optional[str] = Field(None, description="工作目录")
+    transport: str = Field(default="stdio", pattern="^(stdio|sse)$", description="传输方式")
+    timeout: int = Field(default=30, ge=1, le=300, description="连接超时时间（秒）")
+    auto_connect: bool = Field(default=False, description="是否自动连接")
+    enabled: bool = Field(default=True, description="是否启用")
+    description: Optional[str] = Field(None, max_length=1000, description="连接描述")
+    config: Dict = Field(default={}, description="额外配置")
+
+
+class MCPConnectionUpdate(BaseModel):
+    """更新 MCP 连接的请求体"""
+    name: Optional[str] = Field(None, min_length=1, max_length=100, description="连接名称")
+    server_type: Optional[str] = Field(None, min_length=1, max_length=50, description="服务器类型")
+    server_name: Optional[str] = Field(None, min_length=1, max_length=100, description="服务器名称")
+    command: Optional[str] = Field(None, min_length=1, max_length=500, description="启动命令")
+    args: Optional[List[str]] = Field(None, description="命令参数")
+    env: Optional[Dict[str, str]] = Field(None, description="环境变量")
+    cwd: Optional[str] = Field(None, description="工作目录")
+    transport: Optional[str] = Field(None, pattern="^(stdio|sse)$", description="传输方式")
+    timeout: Optional[int] = Field(None, ge=1, le=300, description="连接超时时间（秒）")
+    auto_connect: Optional[bool] = Field(None, description="是否自动连接")
+    enabled: Optional[bool] = Field(None, description="是否启用")
+    description: Optional[str] = Field(None, max_length=1000, description="连接描述")
+    config: Optional[Dict] = Field(None, description="额外配置")
+
+
+class MCPConnectionResponse(BaseModel):
+    """MCP 连接响应体"""
+    id: str
+    name: str
+    server_type: str
+    server_name: str
+    command: str
+    args: List[str]
+    env: Dict[str, str]
+    cwd: Optional[str]
+    transport: str
+    timeout: int
+    auto_connect: bool
+    enabled: bool
+    description: Optional[str]
+    config: Dict
+    create_time: str
+    update_time: Optional[str]
+
+    class Config:
+        json_encoders = {
+            # 处理 datetime 类型
+        }
+
+
+class MCPConnectionListResponse(BaseModel):
+    """MCP 连接列表响应体"""
+    connections: List[MCPConnectionResponse]
+    total: int
+
+
+class MCPConnectionSearchRequest(BaseModel):
+    """MCP 连接搜索请求体"""
+    keyword: Optional[str] = Field(None, description="搜索关键词")
+    server_type: Optional[str] = Field(None, description="服务器类型过滤")
+    enabled: Optional[bool] = Field(None, description="启用状态过滤")
+    auto_connect: Optional[bool] = Field(None, description="自动连接状态过滤")
+    limit: int = Field(default=50, ge=1, le=100, description="返回数量限制")
+
+
+class MCPConnectionStatusResponse(BaseModel):
+    """MCP 连接状态响应体"""
+    success: bool
+    message: str
+    connection_id: Optional[str] = None
+
+
+class MCPProfileCreate(BaseModel):
+    """MCP 通用配置创建请求体"""
+    timeout: int = Field(default=30, ge=10, le=300, description="默认连接超时时间（秒）")
+    working_dir: str = Field(default="/tmp", description="默认工作目录")
+    env_vars: Dict[str, str] = Field(default={}, description="默认环境变量")
+
+
+class MCPProfileResponse(BaseModel):
+    """MCP 通用配置响应体"""
+    timeout: int
+    working_dir: str
+    env_vars: Dict[str, str]
+    update_time: str
+
+
+class MCPProfileStatusResponse(BaseModel):
+    """MCP 通用配置状态响应体"""
+    success: bool
+    message: str
```

**File**: `libs/chatchat-server/chatchat/server/api_server/mcp_routes.py` (added, +551/-0)
```diff
@@ -0,0 +1,551 @@
+from datetime import datetime
+from typing import List
+
+from fastapi import APIRouter, Depends, HTTPException, Query
+from fastapi.responses import JSONResponse
+
+from chatchat.server.api_server.api_schemas import (
+    MCPConnectionCreate,
+    MCPConnectionUpdate,
+    MCPConnectionResponse,
+    MCPConnectionListResponse,
+    MCPConnectionSearchRequest,
+    MCPConnectionStatusResponse,
+    MCPProfileCreate,
+    MCPProfileResponse,
+    MCPProfileStatusResponse,
+)
+from chatchat.server.db.repository.mcp_connection_repository import (
+    add_mcp_connection,
+    update_mcp_connection,
+    get_mcp_connection_by_id,
+    get_mcp_connection_by_name,
+    get_mcp_connections_by_server_name,
+    get_all_mcp_connections,
+    get_enabled_mcp_connections,
+    get_auto_connect_mcp_connections,
+    delete_mcp_connection,
+    enable_mcp_connection,
+    disable_mcp_connection,
+    set_auto_connect,
+    search_mcp_connections,
+    get_mcp_profile,
+    create_mcp_profile,
+    update_mcp_profile,
+    reset_mcp_profile,
+    delete_mcp_profile,
+)
+
+mcp_router = APIRouter(prefix="/api/v1/mcp_connections", tags=["MCP Connections"])
+
+
+def model_to_response(model) -> MCPConnectionResponse:
+    """将数据库模型转换为响应对象"""
+    return MCPConnectionResponse(
+        id=model.id,
+        name=model.name,
+        server_type=model.server_type,
+        server_name=model.server_name,
+        command=model.command,
+        args=model.args,
+        env=model.env,
+        cwd=model.cwd,
+        transport=model.transport,
+        timeout=model.timeout,
+        auto_connect=model.auto_connect,
+        enabled=model.enabled,
+        description=model.description,
+        config=model.config,
+        create_time=model.create_time.isoformat() if model.create_time else None,
+        update_time=model.update_time.isoformat() if model.update_time else None,
+    )
+
+
+@mcp_router.post("/", response_model=MCPConnectionResponse, summary="创建 MCP 连接")
+async def create_mcp_connection(connection_data: MCPConnectionCreate):
+    """
+    创建新的 MCP 连接配置
+    """
+    try:
+        # 检查名称是否已存在
+        existing = get_mcp_connection_by_name(name=connection_data.name)
+        if existing:
+            raise HTTPException(
+                status_code=400,
+                detail=f"连接名称 '{connection_data.name}' 已存在"
+            )
+        
+        connection_id = add_mcp_connection(
+            name=connection_data.name,
+            server_type=connection_data.server_type,
+            server_name=connection_data.server_name,
+            command=connection_data.command,
+            args=connection_data.args,
+            env=connection_data.env,
+            cwd=connection_data.cwd,
+            transport=connection_data.transport,
+            timeout=connection_data.timeout,
+            auto_connect=connection_data.auto_connect,
+            enabled=connection_data.enabled,
+            description=connection_data.description,
+            config=connection_data.config,
+        )
+        
+        connection = get_mcp_connection_by_id(connection_id)
+        return model_to_response(connection)
+    
+    except Exception as e:
+        raise HTTPException(status_code=500, detail=str(e))
+
+
+@mcp_router.get("/", response_model=MCPConnectionListResponse, summary="获取 MCP 连接列表")
+async def list_mcp_connections(
+    enabled_only: bool = Query(False, description="仅返回启用的连接")
+):
+    """
+    获取所有 MCP 连接配置列表
+    """
+    try:
+        if enabled_only:
+            connections = get_enabled_mcp_connections()
+        else:
+            connections = get_all_mcp_connections()
+        
+        response_connections = [model_to_response(conn) for conn in connections]
+        return MCPConnectionListResponse(
+            connections=response_connections,
+            total=len(response_connections)
+        )
+    
+    except Exception as e:
+        raise HTTPException(status_code=500, detail=str(e))
+
+
+@mcp_router.get("/{connection_id}", response_model=MCPConnectionResponse, summary="获取 MCP 连接详情")
+async def get_mcp_connection(connection_id: str):
+    """
+    根据 ID 获取 MCP 连接配置详情
+    """
+    try:
+        connection = get_mcp_connection_by_id(connection_id)
+        if not connection:
+            raise HTTPException(
+                status_code=404,
+                detail=f"连接 ID '{connection_id}' 不存在"
+            )
+        
+        return model_to_response(connection)
+    
+    except HTTPException:
+        raise
+    except Exception as e:
+        raise HTTPException(status_code=500, detail=str(e))
+
+
+@mcp_router.put("/{connection_id}", response_model=MCPConnectionResponse, summary="更新 MCP 连接")
+async def update_mcp_connection_by_id(
+    connection_id: str, 
+    update_data: MCPConnectionUpdate
+):
+    """
+    更新 MCP 连接配置
+    """
+    try:
+        # 检查连接是否存在
+        existing = get_mcp_connection_by_id(connection_id)
+        if not existing:
+            raise HTT
```

**File**: `libs/chatchat-server/chatchat/server/api_server/server_app.py` (modified, +2/-0)
```diff
@@ -12,6 +12,7 @@
 from chatchat.settings import Settings
 from chatchat.server.api_server.chat_routes import chat_router
 from chatchat.server.api_server.kb_routes import kb_router
+from chatchat.server.api_server.mcp_routes import mcp_router
 from chatchat.server.api_server.openai_routes import openai_router
 from chatchat.server.api_server.server_routes import server_router
 from chatchat.server.api_server.tool_routes import tool_router
@@ -43,6 +44,7 @@ async def document():
     app.include_router(tool_router)
     app.include_router(openai_router)
     app.include_router(server_router)
+    app.include_router(mcp_router)
 
     # 其它接口
     app.post(
```

**File**: `libs/chatchat-server/chatchat/server/db/models/mcp_connection_model.py` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+from sqlalchemy import JSON, Column, DateTime, Integer, String, func, Boolean, Text
+
+from chatchat.server.db.base import Base
+
+
+class MCPConnectionModel(Base):
+    """
+    MCP 连接配置模型
+    """
+
+    __tablename__ = "mcp_connection"
+
+    id = Column(String(32), primary_key=True, comment="MCP连接ID")
+    name = Column(String(100), nullable=False, comment="连接名称")
+    server_type = Column(String(50), nullable=False, comment="服务器类型")
+    server_name = Column(String(100), nullable=False, comment="服务器名称")
+    command = Column(String(500), nullable=False, comment="启动命令")
+    args = Column(JSON, default=[], comment="命令参数")
+    env = Column(JSON, default={}, comment="环境变量")
+    cwd = Column(String(500), comment="工作目录")
+    transport = Column(String(20), default="stdio", comment="传输方式：stdio 或 sse")
+    timeout = Column(Integer, default=30, comment="连接超时时间（秒）")
+    auto_connect = Column(Boolean, default=False, comment="是否自动连接")
+    enabled = Column(Boolean, default=True, comment="是否启用")
+    description = Column(Text, comment="连接描述")
+    config = Column(JSON, default={}, comment="额外配置")
+    create_time = Column(DateTime, default=func.now(), comment="创建时间")
+    update_time = Column(DateTime, default=func.now(), onupdate=func.now(), comment="更新时间")
+
+    def __repr__(self):
+        return f"<MCPConnection(id='{self.id}', name='{self.name}', server_type='{self.server_type}', server_name='{self.server_name}', enabled={self.enabled}, create_time='{self.create_time}')>"
+
+
+class MCPProfileModel(Base):
+    """
+    MCP 通用配置模型
+    """
+
+    __tablename__ = "mcp_profile"
+
+    id = Column(Integer, primary_key=True, autoincrement=True, comment="配置ID")
+    timeout = Column(Integer, default=30, nullable=False, comment="默认连接超时时间（秒）")
+    working_dir = Column(String(500), default="/tmp", nullable=False, comment="默认工作目录")
+    env_vars = Column(JSON, default={}, nullable=False, comment="默认环境变量配置")
+    create_time = Column(DateTime, default=func.now(), comment="创建时间")
+    update_time = Column(DateTime, default=func.now(), onupdate=func.now(), comment="更新时间")
+
+    def __repr__(self):
+        return f"<MCPProfile(id={self.id}, timeout={self.timeout}, working_dir='{self.working_dir}', update_time='{self.update_time}')>"
\ No newline at end of file
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/mcp_connection_repository.py` (added, +390/-0)
```diff
@@ -0,0 +1,390 @@
+import uuid
+from typing import Dict, List, Optional
+
+from chatchat.server.db.models.mcp_connection_model import MCPConnectionModel, MCPProfileModel
+from chatchat.server.db.session import with_session
+
+
+@with_session
+def add_mcp_connection(
+    session,
+    name: str,
+    server_type: str,
+    server_name: str,
+    command: str,
+    args: List[str] = None,
+    env: Dict[str, str] = None,
+    cwd: str = None,
+    transport: str = "stdio",
+    timeout: int = 30,
+    auto_connect: bool = False,
+    enabled: bool = True,
+    description: str = "",
+    config: Dict = None,
+    connection_id: str = None,
+):
+    """
+    新增 MCP 连接配置
+    """
+    if not connection_id:
+        connection_id = uuid.uuid4().hex
+    
+    if args is None:
+        args = []
+    if env is None:
+        env = {}
+    if config is None:
+        config = {}
+    
+    mcp_connection = MCPConnectionModel(
+        id=connection_id,
+        name=name,
+        server_type=server_type,
+        server_name=server_name,
+        command=command,
+        args=args,
+        env=env,
+        cwd=cwd,
+        transport=transport,
+        timeout=timeout,
+        auto_connect=auto_connect,
+        enabled=enabled,
+        description=description,
+        config=config,
+    )
+    session.add(mcp_connection)
+    session.commit()
+    return mcp_connection.id
+
+
+@with_session
+def update_mcp_connection(
+    session,
+    connection_id: str,
+    name: str = None,
+    server_type: str = None,
+    server_name: str = None,
+    command: str = None,
+    args: List[str] = None,
+    env: Dict[str, str] = None,
+    cwd: str = None,
+    transport: str = None,
+    timeout: int = None,
+    auto_connect: bool = None,
+    enabled: bool = None,
+    description: str = None,
+    config: Dict = None,
+):
+    """
+    更新 MCP 连接配置
+    """
+    mcp_connection = get_mcp_connection_by_id(session, connection_id)
+    if mcp_connection is not None:
+        if name is not None:
+            mcp_connection.name = name
+        if server_type is not None:
+            mcp_connection.server_type = server_type
+        if server_name is not None:
+            mcp_connection.server_name = server_name
+        if command is not None:
+            mcp_connection.command = command
+        if args is not None:
+            mcp_connection.args = args
+        if env is not None:
+            mcp_connection.env = env
+        if cwd is not None:
+            mcp_connection.cwd = cwd
+        if transport is not None:
+            mcp_connection.transport = transport
+        if timeout is not None:
+            mcp_connection.timeout = timeout
+        if auto_connect is not None:
+            mcp_connection.auto_connect = auto_connect
+        if enabled is not None:
+            mcp_connection.enabled = enabled
+        if description is not None:
+            mcp_connection.description = description
+        if config is not None:
+            mcp_connection.config = config
+        
+        session.add(mcp_connection)
+        session.commit()
+        return mcp_connection.id
+    return None
+
+
+@with_session
+def get_mcp_connection_by_id(session, connection_id: str) -> Optional[MCPConnectionModel]:
+    """
+    根据 ID 查询 MCP 连接配置
+    """
+    mcp_connection = session.query(MCPConnectionModel).filter_by(id=connection_id).first()
+    return mcp_connection
+
+
+@with_session
+def get_mcp_connection_by_name(session, name: str) -> Optional[MCPConnectionModel]:
+    """
+    根据名称查询 MCP 连接配置
+    """
+    mcp_connection = session.query(MCPConnectionModel).filter_by(name=name).first()
+    return mcp_connection
+
+
+@with_session
+def get_mcp_connections_by_server_name(session, server_name: str) -> List[MCPConnectionModel]:
+    """
+    根据服务器名称查询 MCP 连接配置列表
+    """
+    connections = (
+        session.query(MCPConnectionModel)
+        .filter_by(server_name=server_name)
+        .all()
+    )
+    return connections
+
+
+@with_session
+def get_all_mcp_connections(session, enabled_only: bool = False) -> List[MCPConnectionModel]:
+    """
+    获取所有 MCP 连接配置
+    """
+    query = session.query(MCPConnectionModel)
+    if enabled_only:
+        query = query.filter_by(enabled=True)
+    
+    connections = query.order_by(MCPConnectionModel.create_time.desc()).all()
+    return connections
+
+
+@with_session
+def get_enabled_mcp_connections(session) -> List[MCPConnectionModel]:
+    """
+    获取所有启用的 MCP 连接配置
+    """
+    connections = (
+        session.query(MCPConnectionModel)
+        .filter_by(enabled=True)
+        .order_by(MCPConnectionModel.create_time.desc())
+        .all()
+    )
+    return connections
+
+
+@with_session
+def get_auto_connect_mcp_connections(session) -> List[MCPConnectionModel]:
+    """
+    获取所有自动连接的 MCP 连接配置
+    """
+    connections = (
+        session.query(MCPConnectionModel)
+        .filter_by(enabled=True, auto_connect=True)
+        .order_by(MCPConnectionModel.cr
```

**File**: `libs/chatchat-server/chatchat/server/knowledge_base/migrate.py` (modified, +4/-0)
```diff
@@ -16,6 +16,10 @@
 from chatchat.server.db.repository.knowledge_metadata_repository import (
     add_summary_to_db,
 )
+# ensure Models are imported
+from chatchat.server.db.repository.mcp_connection_repository import (
+    create_mcp_profile,
+)
 from chatchat.server.db.session import session_scope
 from chatchat.server.knowledge_base.kb_service.base import (
     KBServiceFactory,
```

**File**: `libs/chatchat-server/chatchat/webui.py` (modified, +4/-0)
```diff
@@ -7,6 +7,7 @@
 from chatchat.server.utils import api_address
 from chatchat.webui_pages.dialogue.dialogue import  dialogue_page
 from chatchat.webui_pages.kb_chat import kb_chat
+from chatchat.webui_pages.mcp import mcp_management_page
 from chatchat.webui_pages.knowledge_base.knowledge_base import knowledge_base_page
 from chatchat.webui_pages.utils import *
 
@@ -58,6 +59,7 @@
                 sac.MenuItem("多功能对话", icon="chat"),
                 sac.MenuItem("RAG 对话", icon="database"),
                 sac.MenuItem("知识库管理", icon="hdd-stack"),
+                sac.MenuItem("MCP 管理", icon="hdd-stack"),
             ],
             key="selected_page",
             open_index=0,
@@ -69,5 +71,7 @@
         knowledge_base_page(api=api, is_lite=is_lite)
     elif selected_page == "RAG 对话":
         kb_chat(api=api)
+    elif selected_page == "MCP 管理":
+        mcp_management_page(api=api)
     else:
         dialogue_page(api=api, is_lite=is_lite)
```

**File**: `libs/chatchat-server/chatchat/webui_pages/mcp/__init__.py` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+"""
+MCP管理页面模块
+"""
+
+from .dialogue import mcp_management_page
+
+__all__ = ["mcp_management_page"]
\ No newline at end of file
```

---

### Incident Patch 11: `ba7bd259` (2025-09-03)
**Commit Message**: Refactor chat functionality to integrate message filtering and database operations. Replace the conversation memory handling with direct database interactions for message retrieval and updates. Remove unused conversation buffer memory class to streamline the codebase.

**File**: `libs/chatchat-server/chatchat/server/chat/chat.py` (modified, +31/-11)
```diff
@@ -2,8 +2,8 @@
 import json
 import uuid
 import os
-import sys
-from typing import AsyncIterable, List
+from chatchat.server.db.repository.message_repository import filter_message
+from typing import AsyncIterable, List, Union, Tuple
 
 from fastapi import Body
 from langchain.chains import LLMChain
@@ -21,9 +21,8 @@
 from langchain_chatchat.agents.platform_tools import PlatformToolsAction, PlatformToolsFinish, \
     PlatformToolsActionToolStart, PlatformToolsActionToolEnd, PlatformToolsLLMStatus
 from chatchat.server.chat.utils import History
-from chatchat.server.memory.conversation_db_buffer_memory import (
-    ConversationBufferDBMemory,
-)
+from chatchat.server.db.repository import add_message_to_db, update_message
+
 from langchain_chatchat import ChatPlatformAI, PlatformToolsRunnable
 from chatchat.server.utils import (
     MsgType,
@@ -73,11 +72,21 @@ def create_models_from_config(configs, callbacks, stream, max_tokens):
 
 
 def create_models_chains(
-        history, history_len, prompts, models, tools, callbacks, conversation_id, metadata
+    history_len, prompts, models, tools, callbacks, conversation_id, metadata
 ):
 
     # 从数据库获取conversation_id对应的 intermediate_steps 、 mcp_connections
-   
+    messages = filter_message(
+        conversation_id=conversation_id, limit=history_len
+    )
+    # 返回的记录按时间倒序，转为正序
+    messages = list(reversed(messages))
+    history: List[Union[List, Tuple]] = []
+    for message in messages:
+        history.append({"role": "user", "content": message["query"]}) 
+        history.append({"role": "assistant", "content":  message["response"]}) 
+ 
+
     llm = models["action_model"]
     llm.callbacks = callbacks
     agent_executor = PlatformToolsRunnable.create_agent_executor(
@@ -99,7 +108,7 @@ def create_models_chains(
 
     full_chain = {"chat_input": lambda x: x["input"]} | agent_executor
 
-    return full_chain
+    return full_chain, agent_executor
 
 
 async def chat(
@@ -148,17 +157,20 @@ async def chat_iterator_event() -> AsyncIterable[OpenAIChatOutput]:
             all_tools = get_tool().values()
             tools = [tool for tool in all_tools if tool.name in tool_config]
             tools = [t.copy(update={"callbacks": callbacks}) for t in tools]
-            full_chain = create_models_chains(
+            full_chain, agent_executor = create_models_chains(
                 prompts=prompts,
                 models=models,
                 conversation_id=conversation_id,
                 tools=tools,
                 callbacks=callbacks,
-                history=history,
                 history_len=history_len,
                 metadata=metadata,
             )
-
+            message_id = add_message_to_db(
+                    chat_type="llm_chat",
+                    query=query,
+                    conversation_id=conversation_id,
+            )
             chat_iterator = full_chain.invoke({
                 "input": query
             })
@@ -250,6 +262,14 @@ async def chat_iterator_event() -> AsyncIterable[OpenAIChatOutput]:
                 )
                 yield ret.model_dump_json()
 
+            update_message(
+                message_id, 
+                agent_executor.history[-1].get("content"),
+                metadata = {
+                    "intermediate_steps": agent_executor.intermediate_steps 
+                }
+            )
+             
         except asyncio.exceptions.CancelledError:
             logger.warning("streaming progress has been interrupted by user.")
             return
```

**File**: `libs/chatchat-server/chatchat/server/db/repository/message_repository.py` (modified, +1/-1)
```diff
@@ -88,5 +88,5 @@ def filter_message(session, conversation_id: str, limit: int = 10):
     # 直接返回 List[MessageModel] 报错
     data = []
     for m in messages:
-        data.append({"query": m.query, "response": m.response})
+        data.append({"query": m.query, "response": m.response, "metadata": m.meta_data})
     return data
```

**File**: `libs/chatchat-server/chatchat/server/memory/conversation_db_buffer_memory.py` (removed, +0/-78)
```diff
@@ -1,78 +0,0 @@
-import logging
-from typing import Any, Dict, List
-
-from langchain.memory.chat_memory import BaseChatMemory
-from langchain.schema import AIMessage, BaseMessage, HumanMessage, get_buffer_string
-from langchain.schema.language_model import BaseLanguageModel
-
-from chatchat.server.db.models.message_model import MessageModel
-from chatchat.server.db.repository.message_repository import filter_message
-
-
-class ConversationBufferDBMemory(BaseChatMemory):
-    conversation_id: str
-    human_prefix: str = "Human"
-    ai_prefix: str = "Assistant"
-    llm: BaseLanguageModel
-    memory_key: str = "history"
-    max_token_limit: int = 2000
-    message_limit: int = 10
-
-    @property
-    def buffer(self) -> List[BaseMessage]:
-        """String buffer of memory."""
-        # fetch limited messages desc, and return reversed
-
-        messages = filter_message(
-            conversation_id=self.conversation_id, limit=self.message_limit
-        )
-        # 返回的记录按时间倒序，转为正序
-        messages = list(reversed(messages))
-        chat_messages: List[BaseMessage] = []
-        for message in messages:
-            chat_messages.append(HumanMessage(content=message["query"]))
-            chat_messages.append(AIMessage(content=message["response"]))
-
-        if not chat_messages:
-            return []
-
-        # prune the chat message if it exceeds the max token limit
-        curr_buffer_length = self.llm.get_num_tokens(get_buffer_string(chat_messages))
-        if curr_buffer_length > self.max_token_limit:
-            pruned_memory = []
-            while curr_buffer_length > self.max_token_limit and chat_messages:
-                pruned_memory.append(chat_messages.pop(0))
-                curr_buffer_length = self.llm.get_num_tokens(
-                    get_buffer_string(chat_messages)
-                )
-
-        return chat_messages
-
-    @property
-    def memory_variables(self) -> List[str]:
-        """Will always return list of memory variables.
-
-        :meta private:
-        """
-        return [self.memory_key]
-
-    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
-        """Return history buffer."""
-        buffer: Any = self.buffer
-        if self.return_messages:
-            final_buffer: Any = buffer
-        else:
-            final_buffer = get_buffer_string(
-                buffer,
-                human_prefix=self.human_prefix,
-                ai_prefix=self.ai_prefix,
-            )
-        return {self.memory_key: final_buffer}
-
-    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
-        """Nothing should be saved or changed"""
-        pass
-
-    def clear(self) -> None:
-        """Nothing to clear, got a memory like a vault."""
-        pass
```

---

### Incident Patch 12: `2e63ff67` (2025-09-03)
**Commit Message**: Enhance prompt settings with critical rules for tool usage and formatting. Update parameter validation in knowledge tools to emphasize required fields. Add a new README file for project documentation, detailing installation, configuration, and usage instructions.

**File**: `libs/chatchat-server/chatchat/settings.py` (modified, +3/-1)
```diff
@@ -738,6 +738,8 @@ class PromptSettings(BaseFileSettings):
                 "You are ChatChat,  a content manager, you are familiar with how to find data from complex projects and better respond to users\n"
                 "\n"
                 "\n"
+                "CRITICAL: THINKING RULES: In <thinking> tags, assess what information you already have and what information you need to proceed with the task. Include detailed output description text within <thinking> tags and always specify the `TOOL USE` next action to take.\n"
+                "CRITICAL: TOOL RULES: All tool usage MUST ` Tool Use Formatting` the specified structured format. \n"
                 "CRITICAL: MCP TOOL RULES: All MCP tool usage MUST strictly follow the Output Structure rules defined for `use_mcp_tool`. The output will always be returned within <use_mcp_tool> tags with the specified structured format.\n"
                 "IMPORTANT: This tool usage process will be repeated multiple times throughout task completion. Each and every MCP tool call MUST follow the Output Structure rules without exception. The structured format must be applied consistently across all iterations to ensure proper parsing and execution.\n"
                 "\n"
@@ -751,7 +753,7 @@ class PromptSettings(BaseFileSettings):
                 "\n"
                 "# Tool Use Formatting\n"
                 "\n"
-                "Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:\n"
+                "CRITICAL: TOOL USE FORMATTING: Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. This format is MANDATORY for proper parsing and execution. Here's the structure:\n"
                 "\n"
                 "<tool_name>\n"
                 "<parameter1_name>value1</parameter1_name>\n"
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/structured_chat/platform_knowledge_bind.py` (modified, +7/-3)
```diff
@@ -67,11 +67,15 @@ def render_knowledge_tools(tools: List[BaseTool]) -> str:
         params = []
         if hasattr(t, "args") and t.args:  # 确保有参数定义
             for arg_name, arg_def in t.args.items():
-                arg_type = arg_def.get("type", "string")
+                # 获取字段信息
                 required = arg_def.get("required", True)
                 required_str = "(required)" if required else "(optional)"
-                arg_desc = arg_def.get("description", "").strip()
-                params.append(f"- {arg_name}: {required_str} {arg_desc}")
+                arg_desc = arg_def.get("description", "").strip() 
+                # 强调 required 属性
+                if required:
+                    params.append(f"- {arg_name}: {required_str} CRITICAL: Must provide actual content, empty/null forbidden. {arg_desc}")
+                else:
+                    params.append(f"- {arg_name}: {required_str} {arg_desc}")
 
         # 拼接最终文本
         text = (
```

**File**: `libs/chatchat-server/tests/data/knowledge_base/test_kb_for_migrate/content/readme.md` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+### 项目简介
+![](https://github.com/chatchat-space/Langchain-Chatchat/blob/master/docs/img/logo-long-chatchat-trans-v2.png)
+
+[![pypi badge](https://img.shields.io/pypi/v/langchain-chatchat.svg)](https://shields.io/)
+[![Generic badge](https://img.shields.io/badge/python-3.8%7C3.9%7C3.10%7C3.11-blue.svg)](https://pypi.org/project/pypiserver/)
+
+🌍 [READ THIS IN ENGLISH](README_en.md)
+
+📃 **LangChain-Chatchat** (原 Langchain-ChatGLM)
+
+基于 ChatGLM 等大语言模型与 Langchain 等应用框架实现，开源、可离线部署的 RAG 与 Agent 应用项目。
+
+点击[这里](https://github.com/chatchat-space/Langchain-Chatchat)了解项目详情。
+
+
+### 安装
+
+1. PYPI 安装
+
+```shell
+pip install langchain-chatchat
+
+# or if you use xinference to provide model API:
+# pip install langchain-chatchat[xinference]
+
+# if you update from an old version, we suggest to run init again to update yaml templates:
+# pip install -U langchain-chatchat
+# chatchat init
+```
+
+详见这里的[安装指引](https://github.com/chatchat-space/Langchain-Chatchat/tree/master?tab=readme-ov-file#%E5%BF%AB%E9%80%9F%E4%B8%8A%E6%89%8B)。
+
+> 注意：chatchat请放在独立的虚拟环境中，比如conda，venv，virtualenv等
+> 
+> 已知问题，不能跟xinference一起安装，会让一些插件出bug，例如文件无法上传
+
+2. 源码安装
+
+除了通过pypi安装外，您也可以选择使用[源码启动](https://github.com/chatchat-space/Langchain-Chatchat/blob/master/docs/contributing/README_dev.md)。(Tips:
+源码配置可以帮助我们更快的寻找bug，或者改进基础设施。我们不建议新手使用这个方式)
+
+3. Docker
+
+```shell
+docker pull chatimage/chatchat:0.3.1.2-2024-0720
+
+docker pull ccr.ccs.tencentyun.com/chatchat/chatchat:0.3.1.2-2024-0720 # 国内镜像
+```
+
+> [!important]
+> 强烈建议: 使用 docker-compose 部署, 具体参考 [README_docker](https://github.com/chatchat-space/Langchain-Chatchat/blob/master/docs/install/README_docker.md)
+
+4. AudoDL
+
+🌐 [AutoDL 镜像](https://www.codewithgpu.com/i/chatchat-space/Langchain-Chatchat/Langchain-Chatchat) 中 `0.3.1`
+版本所使用代码已更新至本项目 `v0.3.1` 版本。
+
+### 初始化与配置
+
+项目运行需要特定的数据目录和配置文件，执行下列命令可以生成默认配置（您可以随时修改 yaml 配置文件）：
+```shell
+# set the root path where storing data.
+# will use current directory if not set
+export CHATCHAT_ROOT=/path/to/chatchat_data
+
+# initialize data and yaml configuration templates
+chatchat init
+```
+
+在 `CHATCHAT_ROOT` 或当前目录可以找到 `*_settings.yaml` 文件，修改这些文件选择合适的模型配置，详见[初始化](https://github.com/chatchat-space/Langchain-Chatchat/tree/master?tab=readme-ov-file#3-%E5%88%9D%E5%A7%8B%E5%8C%96%E9%A1%B9%E7%9B%AE%E9%85%8D%E7%BD%AE%E4%B8%8E%E6%95%B0%E6%8D%AE%E7%9B%AE%E5%BD%95)
+
+### 启动服务
+
+确保所有配置正确后（特别是 LLM 和 Embedding Model），执行下列命令创建默认知识库、启动服务：
+```shell
+chatchat kb -r
+chatchat start -a
+```
+如无错误将自动弹出浏览器页面。
+
+更多命令可以通过 `chatchat --help` 查看。
+
+### 更新日志：
+
+#### 0.3.1.3 (2024-07-23)
+- 修复：
+  - 修复 nltk_data 未能在项目初始化时复制的问题
+  - 在项目依赖包中增加 python-docx 以满足知识库初始化时 docx 格式文件处理需求
+
+#### 0.3.1.2 (2024-07-20)
+- 新功能：
+    - Model Platform 支持配置代理 by @liunux4odoo (#4492)
+    - 给定一个默认可用的 searx 服务器 by @liunux4odoo (#4504)
+    - 更新 docker 镜像 by @yuehua-s @imClumsyPanda (#4511)
+    - 新增URL内容阅读器：通过jina-ai/reader项目，将url内容处理为llm易于理解的文本形式 by @ganwumeng @imClumsyPanda (#4547)
+    - 优化qwen模型下对tools的json修复成功率 by @ganwumeng (#4554)
+    - 允许用户在 basic_settings.API_SERVER 中配置 public_host,public_port，以便使用云服务器或反向代理时生成正确的公网 API
+      地址 by @liunux4odoo (#4567)
+    - 添加模型和服务自动化脚本 by @glide-the (#4573)
+    - 添加单元测试 by @glide-the (#4573)
+- 修复：
+    - WEBUI 中设置 System message 无效 by @liunux4odoo (#4491)
+    - 移除无效的 vqa_processor & aqa_processor 工具 by @liunux4odoo (#4498)
+    - KeyError of 'template' 错误 by @liunux4odoo (#4501)
+    - 执行 chatchat init 时 nltk_data 目录设置错误 by @liunux4odoo (#4523)
+    - 执行 chatchat init 时 出现 xinference-client 连接错误 by @imClumsyPanda (#4573)
+    - xinference 自动检测模型使用缓存，提高 UI 响应速度 by @liunux4odoo (#4510)
+    - chatchat.log 中重复记录 by @liunux4odoo (#4517)
+    - 优化错误信息的传递和前端显示 by @liunux4odoo (#4531)
+    - 修正 openai.chat.completions.create 参数构造方式，提高兼容性  by @liunux4odoo (#4540)
+    - Milvus retriever NotImplementedError by @kwunhang (#4536)
+    - Fix bug of ChromaDB Collection as retriever by @kwunhang (#4541)
+    - langchain 版本升级后，DocumentWithVsId 出现 id 重复问题 by @liunux4odoo (#4548)
+    - 重建知识库时只处理了一个知识库 by @liunux4odoo (#4549)
+    - chat api error because openapi set max_tokens to 0 by default by @liunux4odoo (#4564)
+
+#### 0.3.1.1 (2024-07-15)
+- 修复：
+  - WEBUI 中设置 system message 无效([#4491](https://github.com/chatchat-space/Langchain-Chatchat/pull/4491))
+  - 模型平台不支持代理([#4492](https://github.com/chatchat-space/Langchain-Chatchat/pull/4492))
+  - 移除失效的 vqa_processor & aqa_processor 工具([#4498](https://github.com/chatchat-space/Langchain-Chatchat/pull/4498))
+  - prompt settings 错误导致 `KeyError: 'template'`([#4501](https://github.com/chatchat-space/Langchain-Chatchat/pull/4501))
+  - searx 搜索引擎不支持中文([#4504](https://github.com/chatchat-space/Langchain-Chatchat/pull/4504))
+  - init时默认去连 xinference，若默认 xinference 服务不存在会报错([#4508](https://github.com/chatchat-space/Langchain-Chatchat/issues/4508))
+  - init时，调用shutil.copytree，当src与dst一样时shutil报错的问题（[#4507](https://github.com/chatchat-space/Langchain-Chatchat/pull/4507))
+
+### 项目里程碑
+

```

**File**: `libs/chatchat-server/tests/integration_tests/mcp_platform_tools/test_mcp_platform_tools.py` (modified, +1/-1)
```diff
@@ -145,7 +145,7 @@ async def test_mcp_tools(logging_conf):
             },
         },
     )
-    chat_iterator = agent_executor.invoke(chat_input="计算下 2 乘以 5,之后计算 100*2,然后获取这个链接https://mp.weixin.qq.com/s/YCHHY6mA8-1o7hbXlyEyEQ 的文本")
+    chat_iterator = agent_executor.invoke(chat_input="计算下 2 乘以 5,之后计算 100*2,然后获取这个链接https://mp.weixin.qq.com/s/YCHHY6mA8-1o7hbXlyEyEQ 的文本,接着 使用浏览器下载项目到本地 https://github.com/microsoft/playwright-mcp")
     async for item in chat_iterator:
         if isinstance(item, PlatformToolsAction):
             print("PlatformToolsAction:" + str(item.to_json()))
```

---

### Incident Patch 13: `d8b56a9f` (2025-09-03)
**Commit Message**: Refactor MCP tool integration by enhancing prompt settings with critical usage rules and improving parameter validation in Pydantic models. Update tool descriptions to emphasize required fields and ensure proper execution format. Streamline chat functionality to support new agent configurations and improve overall tool handling.

**File**: `libs/chatchat-server/chatchat/server/chat/chat.py` (modified, +12/-4)
```diff
@@ -1,6 +1,8 @@
 import asyncio
 import json
 import uuid
+import os
+import sys
 from typing import AsyncIterable, List
 
 from fastapi import Body
@@ -100,11 +102,20 @@ def create_models_chains(
         llm = models["action_model"]
         llm.callbacks = callbacks
         agent_executor = PlatformToolsRunnable.create_agent_executor(
-            agent_type="platform-agent",
+            agent_type="platform-knowledge-mode",
             agents_registry=agents_registry,
             llm=llm,
             tools=tools,
             history=history,
+            mcp_connections={
+                "playwright": {
+                    "command": "npx",
+                    "args": [
+                        "@playwright/mcp@latest"
+                    ],
+                    "transport": "stdio",
+                },
+            }
         )
 
         full_chain = {"chat_input": lambda x: x["input"]} | agent_executor
@@ -201,7 +212,6 @@ async def chat_iterator_event() -> AsyncIterable[OpenAIChatOutput]:
                     data["tool_calls"].append(tool_call)
 
                 elif isinstance(item, PlatformToolsFinish):
-                    logger.info("PlatformToolsFinish:" + str(item.to_json()))
                     data["text"] = item.log
 
                     last_tool.update(
@@ -299,8 +309,6 @@ async def chat_iterator_event() -> AsyncIterable[OpenAIChatOutput]:
 
         return ret.model_dump()
 
-
-async def chat_with_mcp():
     llm_params = get_ChatPlatformAIParams(
         model_name="glm-4-plus",
         temperature=0.01,
```

**File**: `libs/chatchat-server/chatchat/settings.py` (modified, +49/-32)
```diff
@@ -736,13 +736,19 @@ class PromptSettings(BaseFileSettings):
         "platform-knowledge-mode": {
             "SYSTEM_PROMPT": (
                 "You are ChatChat,  a content manager, you are familiar with how to find data from complex projects and better respond to users\n"
-                "  \n"
+                "\n"
+                "\n"
+                "CRITICAL: MCP TOOL RULES: All MCP tool usage MUST strictly follow the Output Structure rules defined for `use_mcp_tool`. The output will always be returned within <use_mcp_tool> tags with the specified structured format.\n"
+                "IMPORTANT: This tool usage process will be repeated multiple times throughout task completion. Each and every MCP tool call MUST follow the Output Structure rules without exception. The structured format must be applied consistently across all iterations to ensure proper parsing and execution.\n"
                 "\n"
                 "====\n"
                 "\n"
                 "TOOL USE\n"
                 "You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.\n"
                 "\n"
+                "CRITICAL: MCP TOOL RULES: All MCP tool usage MUST strictly follow the Output Structure rules defined for `use_mcp_tool`. The output will always be returned within <use_mcp_tool> tags with the specified structured format.\n"
+                "IMPORTANT: This tool usage process will be repeated multiple times throughout task completion. Each and every MCP tool call MUST follow the Output Structure rules without exception. The structured format must be applied consistently across all iterations to ensure proper parsing and execution.\n"
+                "\n"
                 "# Tool Use Formatting\n"
                 "\n"
                 "Tool use is formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:\n"
@@ -759,8 +765,7 @@ class PromptSettings(BaseFileSettings):
                 "<path>src/main.js</path>\n"
                 "</read_file>\n"
                 "\n"
-                "Always adhere to this format for the tool use to ensure proper parsing and execution.\n"
-                " \n"
+                "\n"
                 "# Tools\n"
                 "\n" 
                 "{tools}\n"
@@ -771,6 +776,7 @@ class PromptSettings(BaseFileSettings):
                 "- server_name: (required) The name of the MCP server providing the tool\n"
                 "- tool_name: (required) The name of the tool to execute\n"
                 "- arguments: (required) A JSON object containing the tool's input parameters, following the tool's input schema\n"
+                "\n"
                 "Usage:\n"
                 "<use_mcp_tool>\n"
                 "<server_name>server name here</server_name>\n"
@@ -783,6 +789,17 @@ class PromptSettings(BaseFileSettings):
                 "</arguments>\n"
                 "</use_mcp_tool>\n"
                 "\n"
+                "Output Structure:\n"
+                "The tool will return a structured response within <use_mcp_tool> tags containing:\n"
+                "<use_mcp_tool>\n"
+                "- success: boolean indicating if the tool execution succeeded\n"
+                "- result: the actual output data from the tool execution\n"
+                "- error: error message if the execution failed (null if successful)\n"
+                "- server_name: the name of the MCP server that executed the tool\n"
+                "- tool_name: the name of the tool that was executed\n"
+                "</use_mcp_tool>\n"
+                "\n"
+                "\n"
                 "## access_mcp_resource\n"
                 "Description: Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.\n"
                 "Parameters:\n"
@@ -795,6 +812,8 @@ class PromptSettings(BaseFileSettings):
                 "</access_mcp_resource>\n"
                 "\n"
                 "\n"
+                "====\n"
+                "\n"
                 "# Tool Use Examples\n"
                 "\n"
                 "## Example 1: Requesting to use an MCP tool\n"
@@ -818,39 +837,20 @@ class PromptSettings(BaseFileSettings):
                 "</access_mcp_resource>\n"
                 "\n"
                 "\n"
-                "# Tool Use Guidelines\n"
-                "\n"
-                "1. In <thinking> tags, assess what information you already have and what information you need to proceed with the task.\n"
-                "2. Choose the most appropriate tool based on the task and the tool desc
```

**File**: `libs/chatchat-server/langchain_chatchat/agent_toolkits/mcp_kit/tools.py` (modified, +34/-3)
```diff
@@ -27,12 +27,28 @@ class MCPStructuredTool(StructuredTool):
 
 
 def schema_dict_to_model(schema: Dict[str, Any]) -> Any:
+    """
+    Convert JSON schema to Pydantic model with required field validation.
+    
+    Args:
+        schema: JSON schema dictionary containing tool parameter definitions
+        
+    Returns:
+        Dynamic Pydantic model class with proper field validation
+        
+    Note:
+        Required fields are marked with required=True to ensure they have actual content,
+        empty or null values are strictly prohibited for required parameters.
+    """
     fields = schema.get('properties', {})
     required_fields = schema.get('required', [])
 
     model_fields = {}
     for field_name, details in fields.items():
         field_type_str = details['type']
+        
+        # Add field description if available
+        field_description = details.get('description', '')
 
         if field_type_str == 'integer':
             field_type = int
@@ -45,10 +61,25 @@ def schema_dict_to_model(schema: Dict[str, Any]) -> Any:
         else:
             field_type = Any  # 可扩展更多类型
 
+        # For required fields, use Field with required=True
         if field_name in required_fields:
-            model_fields[field_name] = (field_type, ...)
+            # Ensure required fields have actual content and cannot be empty/null
+            if field_type == str:
+                model_fields[field_name] = (field_type, Field(..., min_length=1, required=True, 
+                    description=field_description or f"Required string parameter: {field_name}"))
+            elif field_type in (int, float):
+                model_fields[field_name] = (field_type, Field(..., required=True, 
+                    description=field_description or f"Required numeric parameter: {field_name}"))
+            elif field_type == bool:
+                model_fields[field_name] = (field_type, Field(..., required=True, 
+                    description=field_description or f"Required boolean parameter: {field_name}"))
+            else:
+                model_fields[field_name] = (field_type, Field(..., required=True, 
+                    description=field_description or f"Required parameter: {field_name}"))
         else:
-            model_fields[field_name] = (field_type, None)
+            # Optional fields can be None
+            model_fields[field_name] = (field_type, Field(None, required=False, 
+                description=field_description or f"Optional parameter: {field_name}"))
 
     DynamicSchema = create_model(schema.get('title', 'DynamicSchema'), **model_fields)
     return DynamicSchema
@@ -72,7 +103,7 @@ def _convert_call_tool_result(
     if call_tool_result.isError:
         raise ToolException(tool_content)
 
-    return tool_content, non_text_contents or None
+    return tool_content
 
 
 def convert_mcp_tool_to_langchain_tool(
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/structured_chat/platform_knowledge_bind.py` (modified, +19/-1)
```diff
@@ -23,9 +23,27 @@ def render_knowledge_mcp_tools(tools: List[MCPStructuredTool]) -> str:
 
     for t in tools:
         desc = re.sub(r"\n+", " ", t.description)
+        
+        # 构建参数描述，强调 required=True 属性
+        params = []
+        if hasattr(t, "args") and t.args:
+            for arg_name, arg_def in t.args.items():
+                # 获取字段信息
+                required = arg_def.get("required", True)
+                required_str = "(required)" if required else "(optional)"
+                arg_desc = arg_def.get("description", "").strip() 
+                # 强调 required 属性
+                if required:
+                    params.append(f"- {arg_name}: {required_str} CRITICAL: Must provide actual content, empty/null forbidden. {arg_desc}")
+                else:
+                    params.append(f"- {arg_name}: {required_str} {arg_desc}")
+        
+        # 拼接工具描述
+        params_text = "\n".join(params) if params else "- None"
         text = (
             f"- {t.name}: {desc}  \n"
-            f"  Input Schema: {t.args}"
+            f"  Input Schema:\n"
+            f"  {params_text}"
         )
         grouped_tools[t.server_name].append(text)
 
```

---

### Incident Patch 14: `620de3be` (2025-04-06)
**Commit Message**: bug

**File**: `libs/chatchat-server/chatchat/server/agents_registry/agents_registry.py` (modified, +6/-0)
```diff
@@ -215,6 +215,7 @@ def agents_registry(
         agent = create_platform_knowledge_agent(llm=llm,
                                                 tools=tools,
                                                 mcp_tools=mcp_tools,
+                                                llm_with_platform_tools=llm_with_platform_tools,
                                                 prompt=prompt)
 
         agent_executor = PlatformToolsAgentExecutor(
@@ -242,6 +243,11 @@ async def create_mcp_client() -> MultiServerMCPClient:
                     "url": "http://localhost:8931/sse",
                     "transport": "sse",
                 },
+                # "ufn-mcp-server": {
+                #     # make sure you start your weather server on port 8000
+                #     "url": "http://localhost:8932/sse",
+                #     "transport": "sse",
+                # },
             }
     ) as client:
         return client
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/output_parsers/platform_knowledge_output_parsers.py` (modified, +17/-6)
```diff
@@ -8,6 +8,7 @@
 from typing import Any, List, Sequence, Tuple, Union
 
 from langchain.agents.agent import AgentExecutor, RunnableAgent
+from langchain.agents.output_parsers import ToolsAgentOutputParser
 from langchain.agents.structured_chat.output_parser import StructuredChatOutputParser
 from langchain.prompts.chat import BaseChatPromptTemplate
 from langchain.schema import (
@@ -17,14 +18,21 @@
 
 import xml.etree.ElementTree as ET
 
+from langchain_core.outputs import Generation
 
-class PlatformKnowledgeOutputParserCustom(StructuredChatOutputParser):
+
+class PlatformKnowledgeOutputParserCustom(ToolsAgentOutputParser):
     """Output parser with retries for the structured chat agent with custom Knowledge prompt."""
 
-    def parse(self, text: str) -> Union[AgentAction, AgentFinish]:
+    def parse_result(
+            self, result: List[Generation], *, partial: bool = False
+    ) -> Union[List[AgentAction], AgentFinish]:
 
+        """Parse a list of candidate model Generations into a specific format."""
+        tools = super().parse_result(result, partial=partial)
+        message = result[0].message
         try:
-            wrapped_xml = f"<root>{text}</root>"
+            wrapped_xml = f"<root>{str(message.content)}</root>"
             # 解析mcp_use标签
             root = ET.fromstring(wrapped_xml)
 
@@ -38,13 +46,16 @@ def parse(self, text: str) -> Union[AgentAction, AgentFinish]:
                     # 提取并解析 arguments 中的 JSON 字符串
                     arguments_raw = elem.find("arguments").text.strip()
 
-                    return AgentAction(
+                    act =  AgentAction(
                         f"{server_name}: {tool_name}",
                         arguments_raw,
-                        log=text,
+                        log=str(message.content),
                     )
+                    tools.append(act)
+
         except Exception as e:
-            return AgentFinish(return_values={"output": text}, log=text)
+            return AgentFinish(return_values={"output": str(message.content)}, log=str(message.content))
+        return tools
 
     @property
     def _type(self) -> str:
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/output_parsers/platform_tools.py` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ def parse_result(
             message = result[0].message
             return parse_ai_message_to_platform_tool_action(message)
         elif self.instance_type == "platform-knowledge-mode":
-            return self.knowledge_parser.parse(result[0].text)
+            return self.knowledge_parser.parse_result(result, partial=partial)
         else:
             return self.base_parser.parse(result[0].text)
 
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/structured_chat/platform_knowledge_bind.py` (modified, +3/-1)
```diff
@@ -43,6 +43,8 @@ def create_platform_knowledge_agent(
         tools: Sequence[BaseTool],
         mcp_tools: Sequence[MCPStructuredTool],
         prompt: ChatPromptTemplate,
+        *,
+        llm_with_platform_tools: List[Dict[str, Any]] = [],
 ) -> Runnable:
     """Create an agent that uses tools.
 
@@ -64,7 +66,7 @@ def create_platform_knowledge_agent(
         mcp_tools=render_knowledge_mcp_tools(list(mcp_tools)),
     )
     llm_with_stop = llm.bind(
-        tools=tools
+        tools=llm_with_platform_tools
     )
     agent = (
             RunnablePassthrough.assign(
```

**File**: `libs/chatchat-server/tests/integration_tests/mcp_platform_tools/test_mcp_platform_tools.py` (modified, +46/-31)
```diff
@@ -39,18 +39,18 @@ async def test_mcp_stdio_tools(logging_conf):
 
             # Create and run the agent
             llm_params = get_ChatPlatformAIParams(
-                model_name="fun-lora",
+                model_name="glm-4-plus",
                 temperature=0.01,
                 max_tokens=120000,
             )
             llm = ChatPlatformAI(**llm_params)
             agent_executor = PlatformToolsRunnable.create_agent_executor(
-                agent_type="qwen",
+                agent_type="platform-agent",
                 agents_registry=agents_registry,
                 llm=llm,
                 tools=tools,
             )
-            chat_iterator = agent_executor.invoke(chat_input="计算下 2 乘以 5")
+            chat_iterator = agent_executor.invoke(chat_input="计算下 2 乘以 5,之后计算 100*2")
             async for item in chat_iterator:
                 if isinstance(item, PlatformToolsAction):
                     print("PlatformToolsAction:" + str(item.to_json()))
@@ -128,32 +128,47 @@ async def test_mcp_multi_tools(logging_conf):
 @pytest.mark.asyncio
 async def test_mcp_tools(logging_conf):
     logging.config.dictConfig(logging_conf)  # type: ignore
-
-    # Create and run the agent
-    llm_params = get_ChatPlatformAIParams(
-        model_name="glm-4-plus",
-        temperature=0.01,
-        max_tokens=120000,
-    )
-    llm = ChatPlatformAI(**llm_params)
-    agent_executor = PlatformToolsRunnable.create_agent_executor(
-        agent_type="platform-knowledge-mode",
-        agents_registry=agents_registry,
-        llm=llm,
+    logging.config.dictConfig(logging_conf)  # type: ignore
+    server_params = StdioServerParameters(
+        command="python",
+        # Make sure to update to the full absolute path to your math_server.py file
+        args=[f"{os.path.dirname(__file__)}/math_server.py"],
     )
-    chat_iterator = agent_executor.invoke(chat_input="使用浏览器下载项目到本地 https://github.com/microsoft/playwright-mcp")
-    async for item in chat_iterator:
-        if isinstance(item, PlatformToolsAction):
-            print("PlatformToolsAction:" + str(item.to_json()))
-
-        elif isinstance(item, PlatformToolsFinish):
-            print("PlatformToolsFinish:" + str(item.to_json()))
-
-        elif isinstance(item, PlatformToolsActionToolStart):
-            print("PlatformToolsActionToolStart:" + str(item.to_json()))
-
-        elif isinstance(item, PlatformToolsActionToolEnd):
-            print("PlatformToolsActionToolEnd:" + str(item.to_json()))
-        elif isinstance(item, PlatformToolsLLMStatus):
-            if item.status == AgentStatus.llm_end:
-                print("llm_end:" + item.text)
+
+    async with stdio_client(server_params) as (read, write):
+        async with ClientSession(read, write) as session:
+            # Initialize the connection
+            await session.initialize()
+
+            # Get tools
+            tools = await load_mcp_tools("test",session)
+
+            # Create and run the agent
+            llm_params = get_ChatPlatformAIParams(
+                model_name="glm-4-plus",
+                temperature=0.01,
+                max_tokens=120000,
+            )
+            llm = ChatPlatformAI(**llm_params)
+            agent_executor = PlatformToolsRunnable.create_agent_executor(
+                agent_type="platform-knowledge-mode",
+                agents_registry=agents_registry,
+                llm=llm,
+                tools=tools,
+            )
+            chat_iterator = agent_executor.invoke(chat_input="计算下 2 乘以 5,之后计算 100*2,然后获取这个链接https://mp.weixin.qq.com/s/YCHHY6mA8-1o7hbXlyEyEQ 的文本")
+            async for item in chat_iterator:
+                if isinstance(item, PlatformToolsAction):
+                    print("PlatformToolsAction:" + str(item.to_json()))
+
+                elif isinstance(item, PlatformToolsFinish):
+                    print("PlatformToolsFinish:" + str(item.to_json()))
+
+                elif isinstance(item, PlatformToolsActionToolStart):
+                    print("PlatformToolsActionToolStart:" + str(item.to_json()))
+
+                elif isinstance(item, PlatformToolsActionToolEnd):
+                    print("PlatformToolsActionToolEnd:" + str(item.to_json()))
+                elif isinstance(item, PlatformToolsLLMStatus):
+                    if item.status == AgentStatus.llm_end:
+                        print("llm_end:" + item.text)
```

---

### Incident Patch 15: `d092597e` (2025-04-06)
**Commit Message**: bug

**File**: `libs/chatchat-server/chatchat/server/agents_registry/agents_registry.py` (modified, +40/-19)
```diff
@@ -1,11 +1,15 @@
 # -*- coding: utf-8 -*-
+import asyncio
+import sys
+from contextlib import AsyncExitStack
+
 from langchain.agents.agent import RunnableMultiActionAgent
 from langchain_core.messages import SystemMessage, AIMessage
 from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate, MessagesPlaceholder
 from pydantic import BaseModel
 
 from chatchat.server.utils import get_prompt_template_dict
-from langchain_chatchat.agent_toolkits.mcp_kit.tools import MCPStructuredTool
+from langchain_chatchat.agent_toolkits.mcp_kit.client import MultiServerMCPClient
 from langchain_chatchat.agents.all_tools_agent import PlatformToolsAgentExecutor
 from langchain_chatchat.agents.react.create_prompt_template import create_prompt_glm3_template, \
     create_prompt_structured_react_template, create_prompt_platform_template, create_prompt_gpt_tool_template, \
@@ -191,24 +195,21 @@ def agents_registry(
         )
         return agent_executor
 
-    else:
-        raise ValueError(
-            f"Agent type {agent_type} not supported at the moment. Must be one of "
-            "'tool-calling', 'openai-tools', 'openai-functions', "
-            "'default','ChatGLM3','structured-chat-agent','platform-agent','qwen','glm3'"
-        )
-
-
-def chatchat_context_registry(
-        agent_type: str,
-        llm: BaseLanguageModel,
-        mcp_tools: Sequence[MCPStructuredTool],
-        tools: Sequence[Union[Dict[str, Any], Type[BaseModel], Callable, BaseTool]] = [],
-        callbacks: List[BaseCallbackHandler] = [],
-        verbose: bool = False,
-        **kwargs: Any,
-):
-    if "platform-knowledge-mode" == agent_type:
+    elif "platform-knowledge-mode" == agent_type:
+        import nest_asyncio
+        nest_asyncio.apply()
+        if sys.version_info < (3, 10):
+            loop = asyncio.get_event_loop()
+        else:
+            try:
+                loop = asyncio.get_running_loop()
+            except RuntimeError:
+                loop = asyncio.new_event_loop()
+
+            asyncio.set_event_loop(loop)
+        client = loop.run_until_complete(create_mcp_client())
+        # Get tools
+        mcp_tools = client.get_tools()
         template = get_prompt_template_dict("action_model", agent_type)
         prompt = create_prompt_platform_knowledge_mode_template(agent_type, template=template)
         agent = create_platform_knowledge_agent(llm=llm,
@@ -224,3 +225,23 @@ def chatchat_context_registry(
             return_intermediate_steps=True,
         )
         return agent_executor
+
+    else:
+        raise ValueError(
+            f"Agent type {agent_type} not supported at the moment. Must be one of "
+            "'tool-calling', 'openai-tools', 'openai-functions', "
+            "'default','ChatGLM3','structured-chat-agent','platform-agent','qwen','glm3'"
+        )
+
+
+async def create_mcp_client() -> MultiServerMCPClient:
+    async with MultiServerMCPClient(
+            {
+                "playwright": {
+                    # make sure you start your weather server on port 8000
+                    "url": "http://localhost:8931/sse",
+                    "transport": "sse",
+                },
+            }
+    ) as client:
+        return client
```

**File**: `libs/chatchat-server/chatchat/settings.py` (modified, +4/-4)
```diff
@@ -774,10 +774,10 @@ class PromptSettings(BaseFileSettings):
                 "<server_name>server name here</server_name>\n"
                 "<tool_name>tool name here</tool_name>\n"
                 "<arguments>\n"
-                "{\n"
+                "{{\n"
                 "  \"param1\": \"value1\",\n"
                 "  \"param2\": \"value2\"\n"
-                "}\n"
+                "}}\n"
                 "</arguments>\n"
                 "</use_mcp_tool>\n"
                 "\n"
@@ -801,10 +801,10 @@ class PromptSettings(BaseFileSettings):
                 "<server_name>weather-server</server_name>\n"
                 "<tool_name>get_forecast</tool_name>\n"
                 "<arguments>\n"
-                "{\n"
+                "{{\n"
                 "  \"city\": \"San Francisco\",\n"
                 "  \"days\": 5\n"
-                "}\n"
+                "}}\n"
                 "</arguments>\n"
                 "</use_mcp_tool>\n"
                 "\n"
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/output_parsers/platform_tools.py` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ class PlatformToolsAgentOutputParser(MultiActionAgentOutputParser):
 
     If one is not passed, then the AIMessage is assumed to be the final output.
     """
-    instance_type: Literal["GPT-4", "glm3", "qwen", "platform-agent", "base"] = "platform-agent"
+    instance_type: Literal["GPT-4", "glm3", "qwen", "platform-agent", "platform-knowledge-mode", "base"] = "platform-agent"
     """
     instance type of the agent， parser platform return chunk to agent action
     """
```

**File**: `libs/chatchat-server/langchain_chatchat/agents/structured_chat/platform_knowledge_bind.py` (modified, +2/-9)
```diff
@@ -1,4 +1,5 @@
 # -*- coding: utf-8 -*-
+from datetime import datetime
 from typing import Sequence, Union, List, Dict, Any
 
 from langchain_core.language_models import BaseLanguageModel
@@ -45,15 +46,6 @@ def create_platform_knowledge_agent(
 ) -> Runnable:
     """Create an agent that uses tools.
 
-    Args:
-
-        llm: LLM to use as the agent.
-        tools: Tools this agent has access to.
-        prompt: The prompt to use, must have input keys
-            `tools`: contains descriptions for each tool.
-            `agent_scratchpad`: contains previous agent actions and tool outputs.
-        mcp_tools:
-
     Returns:
         A Runnable sequence representing an agent. It takes as input all the same input
         variables as the prompt passed in does. It returns as output either an
@@ -68,6 +60,7 @@ def create_platform_knowledge_agent(
         raise ValueError(f"Prompt missing required variables: {missing_vars}")
 
     prompt = prompt.partial(
+        datetime=datetime.now().isoformat(),
         mcp_tools=render_knowledge_mcp_tools(list(mcp_tools)),
     )
     llm_with_stop = llm.bind(
```

**File**: `libs/chatchat-server/tests/integration_tests/mcp_platform_tools/test_mcp_platform_tools.py` (modified, +29/-52)
```diff
@@ -1,7 +1,7 @@
 # -*- coding: utf-8 -*-
 from mcp import ClientSession, StdioServerParameters, stdio_client
 
-from chatchat.server.agents_registry.agents_registry import agents_registry, chatchat_context_registry
+from chatchat.server.agents_registry.agents_registry import agents_registry
 from chatchat.server.utils import get_ChatPlatformAIParams
 from langchain_chatchat import ChatPlatformAI
 from langchain_chatchat.agent_toolkits.mcp_kit.client import MultiServerMCPClient
@@ -128,55 +128,32 @@ async def test_mcp_multi_tools(logging_conf):
 @pytest.mark.asyncio
 async def test_mcp_tools(logging_conf):
     logging.config.dictConfig(logging_conf)  # type: ignore
-    async with MultiServerMCPClient(
-            {
-                "math": {
-                    "command": "python",
-                    # Make sure to update to the full absolute path to your math_server.py file
-                    "args": [f"{os.path.dirname(__file__)}/math_server.py"],
-                    "transport": "stdio",
-                    "env": {
-                        **os.environ,
-                        "PYTHONHASHSEED": "0",
-                    },
-                },
-                "playwright": {
-                    # make sure you start your weather server on port 8000
-                    "url": "http://localhost:8931/sse",
-                    "transport": "sse",
-                },
-            }
-    ) as client:
 
-        # Get tools
-        tools = client.get_tools()
-
-        # Create and run the agent
-        llm_params = get_ChatPlatformAIParams(
-            model_name="fun-lora",
-            temperature=0.01,
-            max_tokens=120000,
-        )
-        llm = ChatPlatformAI(**llm_params)
-        agent_executor = PlatformToolsRunnable.create_agent_executor(
-            agent_type="platform-knowledge-mode",
-            agents_registry=chatchat_context_registry,
-            llm=llm,
-            tools=tools,
-        )
-        chat_iterator = agent_executor.invoke(chat_input="使用浏览器下载项目到本地 https://github.com/microsoft/playwright-mcp")
-        async for item in chat_iterator:
-            if isinstance(item, PlatformToolsAction):
-                print("PlatformToolsAction:" + str(item.to_json()))
-
-            elif isinstance(item, PlatformToolsFinish):
-                print("PlatformToolsFinish:" + str(item.to_json()))
-
-            elif isinstance(item, PlatformToolsActionToolStart):
-                print("PlatformToolsActionToolStart:" + str(item.to_json()))
-
-            elif isinstance(item, PlatformToolsActionToolEnd):
-                print("PlatformToolsActionToolEnd:" + str(item.to_json()))
-            elif isinstance(item, PlatformToolsLLMStatus):
-                if item.status == AgentStatus.llm_end:
-                    print("llm_end:" + item.text)
+    # Create and run the agent
+    llm_params = get_ChatPlatformAIParams(
+        model_name="glm-4-plus",
+        temperature=0.01,
+        max_tokens=120000,
+    )
+    llm = ChatPlatformAI(**llm_params)
+    agent_executor = PlatformToolsRunnable.create_agent_executor(
+        agent_type="platform-knowledge-mode",
+        agents_registry=agents_registry,
+        llm=llm,
+    )
+    chat_iterator = agent_executor.invoke(chat_input="使用浏览器下载项目到本地 https://github.com/microsoft/playwright-mcp")
+    async for item in chat_iterator:
+        if isinstance(item, PlatformToolsAction):
+            print("PlatformToolsAction:" + str(item.to_json()))
+
+        elif isinstance(item, PlatformToolsFinish):
+            print("PlatformToolsFinish:" + str(item.to_json()))
+
+        elif isinstance(item, PlatformToolsActionToolStart):
+            print("PlatformToolsActionToolStart:" + str(item.to_json()))
+
+        elif isinstance(item, PlatformToolsActionToolEnd):
+            print("PlatformToolsActionToolEnd:" + str(item.to_json()))
+        elif isinstance(item, PlatformToolsLLMStatus):
+            if item.status == AgentStatus.llm_end:
+                print("llm_end:" + item.text)
```

#### Recent Merged Pull Requests:
- **PR #5496** (closed): docs: note OpenAI client base_url for multi-model gateways (@seven7763)
- **PR #5493** (closed): docs: add SECURITY.md for private vulnerability reporting (@Solaris-star)
- **PR #5451** (closed): fix: prevent SQL-based DoS via prompt injection in text2sql (@weiguangli-io)
- **PR #5408** (2025-11-10): Refactor tool message formatting   (@glide-the)
- **PR #5407** (2025-11-10): Refactor imports to use pydantic directly and update PYDANTIC_V2 defi… (@glide-the)
- **PR #5399** (2025-10-30): Mcp kit (@glide-the)
- **PR #5369** (closed): fix：修复代码相对路径错误的问题 (@MilesTin)
- **PR #5290** (closed): 更新了README.md和README_en.md (@KPCOFGS)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
