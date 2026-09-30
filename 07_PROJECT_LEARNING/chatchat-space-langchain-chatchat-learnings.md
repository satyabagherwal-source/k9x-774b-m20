# Forensic Learning Record (Deep Inspection): chatchat-space/Langchain-Chatchat

> **Canonical Artifact**: `07_PROJECT_LEARNING/chatchat-space-langchain-chatchat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chatchat-space/Langchain-Chatchat](https://github.com/chatchat-space/Langchain-Chatchat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:38.141Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chatchat-space/Langchain-Chatchat`
- **Description**: Langchain-Chatchat（原Langchain-ChatGLM）基于 Langchain 与 ChatGLM, Qwen 与 Llama 等语言模型的 RAG 与 Agent 应用 | Langchain-Chatchat (formerly langchain-ChatGLM), local knowledge based LLM (like ChatGLM, Qwen and Llama) RAG and Agent app with langchain 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 38667 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libs/chatchat-server/chatchat/__init__.py`
```
__version__ = "0.3.1.3"

```

### Core Architecture Module: `libs/chatchat-server/chatchat/cli.py`
```
import click
from pathlib import Path
import shutil
import typing as t

from chatchat.startup import main as startup_main
from chatchat.init_database import main as kb_main, create_tables, folder2db
from chatchat.settings import Settings
from chatchat.utils import build_logger
from chatchat.server.utils import get_default_embedding


logger = build_logger()


@click.group(help="chatchat 命令行工具")
def main():
    ...


@main.command("init", help="项目初始化")
@click.option("-x", "--xinference-endpoint", "xf_endpoint",
              help="指定Xinference API 服务地址。默认为 http://127.0.0.1:9997/v1")
@click.option("-l", "--llm-model",
              help="指定默认 LLM 模型。默认为 glm4-chat")
@click.option("-e", "--embed-model",
              help="指定默认 Embedding 模型。默认为 bge-large-zh-v1.5")
@click.option("-r", "--recreate-kb",
              is_flag=True,
              show_default=True,
              default=False,
              help="同时重建知识库（必须确保指定的 embed model 可用）。")
@click.option("-k", "--kb-names", "kb_names",
              show_default=True,
              default="samples",
              help="要重建知识库的名称。可以指定多个知识库名称，以 , 分隔。")
def init(
    xf_endpoint: str = "",
    llm_model: str = "",
    embed_model: str = "",
    recreate_kb: bool = False,
    kb_names: str = "",
):
    Settings.set_auto_reload(False)
    bs = Settings.basic_settings
    kb_names = [x.strip() for x in kb_names.split(",")]
    logger.success(f"开始初始化项目数据目录：{Settings.CHATCHAT_ROOT}")
    Settings.basic_settings.make_dirs()
    logger.success("创建所有数据目录：成功。")
    if(bs.PACKAGE_ROOT / "data/knowledge_base/samples" != Path(bs.KB_ROOT_PATH) / "samples"):
        shutil.copytree(bs.PACKAGE_ROOT / "data/knowledge_base/samples", Path(bs.KB_ROOT_PATH) / "samples", dirs_exist_ok=True)
    logger.success("复制 samples 知识库文件：成功。")
    create_tables()
    logger.success("初始化知识库数据库：成功。")

    if xf_endpoint:
        Settings.model_settings.MODEL_PLATFORMS[0].api_base_url = xf_endpoint
    if llm_model:
        Settings.model_settings.DEFAULT_LLM_MODEL = llm_model
    if embed_model:
        Settings.model_settings.DEFAULT_EMBEDDING_MODEL = embed_model

    Settings.createl_all_templates()
    Settings.set_auto_reload(True)

    logger.success("生成默认配置文件：成功。")
    logger.success("请先检查确认 model_settings.yaml 里模型平台、LLM模型和Embed模型信息已经正确")

    if recreate_kb:
        folder2db(kb_names=kb_names,
                  mode="recreate_vs",
                  vs_type=Settings.kb_settings.DEFAULT_VS_TYPE,
                  embed_model=get_default_embedding())
        logger.success("<green>所有初始化已完成，执行 chatchat start -a 启动服务。</green>")
    else:
        logger.success("执行 chatchat kb -r 初始化知识库，然后 chatchat start -a 启动服务。")


main.add_command(startup_main, "start")
main.add_command(kb_main, "kb")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `libs/chatchat-server/chatchat/init_database.py`
```
# Description: 初始化数据库，包括创建表、导入数据、更新向量空间等操作
from datetime import datetime
import multiprocessing as mp
import sys
import time
from typing import Dict

import click

from chatchat.settings import Settings
from chatchat.server.knowledge_base.migrate import (
    create_tables,
    folder2db,
    import_from_db,
    prune_db_docs,
    prune_folder_files,
    reset_tables,
)
from chatchat.utils import build_logger
from chatchat.server.utils import get_default_embedding


logger = build_logger()


def worker(args: dict):
    start_time = datetime.now()

    try:
        if args.get("create_tables"):
            create_tables()  # confirm tables exist

        if args.get("clear_tables"):
            reset_tables()
            print("database tables reset")

        if args.get("recreate_vs"):
            create_tables()
            print("recreating all vector stores")
            folder2db(
                kb_names=args.get("kb_name"), mode="recreate_vs", embed_model=args.get("embed_model")
            )
        elif args.get("import_db"):
            import_from_db(args.get("import_db"))
        elif args.get("update_in_db"):
            folder2db(
                kb_names=args.get("kb_name"), mode="update_in_db", embed_model=args.get("embed_model")
            )
        elif args.get("increment"):
            folder2db(
                kb_names=args.get("kb_name"), mode="increment", embed_model=args.get("embed_model")
            )
        elif args.get("prune_db"):
            prune_db_docs(args.get("kb_name"))
        elif args.get("prune_folder"):
            prune_folder_files(args.get("kb_name"))

        end_time = datetime.now()
        print(f"总计用时\t：{end_time-start_time}\n")
    except Exception as e:
        logger.exception(e)


@click.command(help="知识库相关功能")
@click.option(
        "-r",
        "--recreate-vs",
        is_flag=True,
        help=(
            """
            recreate vector store.
            use this option if you have copied document files to the content folder, but vector store has not been populated or DEFAUL_VS_TYPE/DEFAULT_EMBEDDING_MODEL changed.
            """
        ),
)
@click.option(
        "--create-tables",
        is_flag=True,
        help=("create empty tables if not existed"),
)
@click.option(
        "--clear-tables",
        is_flag=True,
        help=(
            "create empty tables, or drop the database tables before recreate vector stores"
        ),
)
@click.option(
        "-u",
        "--update-in-db",
        is_flag=True,
        help=(
            """
            update vector store for files exist in database.
            use this option if you want to recreate vectors for files exist in db and skip files exist in local folder only.
            """
        ),
)
@click.option(
        "-i",
        "--increment",
        is_flag=True,
        help=(
            """
            update vector store for files exist in local folder and not exist in database.
            use this option if you want to create vectors incrementally.
            """
        ),
)
@click.option(
        "--prune-db",
        is_flag=True,
        help=(
            """
            delete docs in database that not existed in local folder.
            it is used to delete database docs after user deleted some doc files in file browser
            """
        ),
)
@click.option(
        "--prune-folder",
        is_flag=True,
        help=(
            """
            delete doc files in local folder that not existed in database.
            is is used to free local disk space by delete unused doc files.
            """
        ),
)
@click.option(
        "-n",
        "--kb-name",
        multiple=True,
        default=[],
        help=(
            "specify knowledge base names to operate on. default is all folders exist in KB_ROOT_PATH."
        ),
)
@click.option(
        "-e",
        "--embed-model",
        type=str,
        default=get_default_embedding(),
        help=("specify embeddings model."),
)
@click.option(
        "--import-db",
        help="import tables from specified sqlite database"
)
def main(**kwds):
    p = mp.Process(target=worker, args=(kwds,), daemon=True)
    p.start()
    while p.is_alive():
        try:
            time.sleep(0.1)
        except KeyboardInterrupt:
            logger.warning("Caught KeyboardInterrupt! Setting stop event...")
            p.terminate()
            sys.exit()


if __name__ == "__main__":
    mp.set_start_method("spawn")
    main()

```

### Core Architecture Module: `libs/chatchat-server/chatchat/pydantic_settings_file.py`
```
from __future__ import annotations

from functools import cached_property
from io import StringIO
import os
from pathlib import Path
import typing as t

from memoization import cached, CachingAlgorithmFlag
from pydantic import BaseModel, Field, ConfigDict, computed_field
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, YamlConfigSettingsSource, SettingsConfigDict
import ruamel.yaml
from ruamel.yaml.comments import CommentedBase, TaggedScalar


__all__ = ["YamlTemplate", "MyBaseModel", "BaseFileSettings", "Field",
           "SubModelComment", "SettingsConfigDict",
           "computed_field", "cached_property", "settings_property"]


def import_yaml() -> ruamel.yaml.YAML:
    def text_block_representer(dumper, data):
        style = None
        if len(data.splitlines()) > 1: # check for multilines
            style = "|"
        return dumper.represent_scalar("tag.yaml.org,2002:str", data, style=style)

    yaml = ruamel.yaml.YAML()
    yaml.block_seq_indent = 2
    yaml.map_indent = 2
    yaml.sequence_dash_offset = 2
    yaml.sequence_indent = 4

    # this representer makes all OrderedDict to TaggedScalar
    # yaml.representer.add_representer(str, text_block_representer)
    return yaml


class SubModelComment(t.TypedDict):
    """parameter defines howto create template for sub model"""
    model_obj: BaseModel
    dump_kwds: t.Dict
    is_entire_comment: bool = False # share comment for complex field such as list
    sub_comments: t.Dict[str, "SubModelComment"]


class YamlTemplate:
    """create yaml configuration template for pydantic model object"""
    def __init__(
        self,
        model_obj: BaseModel,
        dump_kwds: t.Dict={},
        sub_comments: t.Dict[str, SubModelComment]={},
    ):
        self.model_obj = model_obj
        self.dump_kwds = dump_kwds
        self.sub_comments = sub_comments

    @cached_property
    def model_cls(self):
        return self.model_obj.__class__

    def _create_yaml_object(
        self,
    ) -> CommentedBase:
        """helper method to convert settings instance to ruamel.YAML object"""
        # # exclude computed fields
        # exclude = set(self.dump_kwds.get("exclude", []))
        # exclude |= set(self.model_cls.model_computed_fields)
        # self.dump_kwds["exclude"] = list(exclude)

        data = self.model_obj.model_dump(**self.dump_kwds)
        yaml = import_yaml()
        buffer = StringIO()
        yaml.dump(data, buffer)
        buffer.seek(0)
        obj = yaml.load(buffer)
        return obj

    def get_class_comment(self, model_cls: t.Type[BaseModel] | BaseModel=None) -> str | None:
        """
        you can override this to customize class comments
        """
        if model_cls is None:
            model_cls = self.model_cls
        return model_cls.model_json_schema().get("description")

    def get_field_comment(self, field_name: str, model_obj: BaseModel=None) -> str | None:
        """
        you can override this to customize field comments
        model_obj is the instance that field_name belongs to
        """
        if model_obj is None:
            schema = self.model_cls.model_json_schema().get("properties", {})
        else:
            fields_schema = model_obj.model_json_schema().get("properties", {})
        if field := fields_schema.get(field_name):
            lines = [field.get("description", "")]
            if enum := field.get("enum"):
                lines.append(f"可选值：{enum}")
            return "\n".join(lines)

    def create_yaml_template(
        self,
        write_to: str | Path | bool = False,
        indent: int = 0,
    ) -> str:
        """
        generate yaml template with default object
        sub_comments indicate how to populate comments for sub models, it could be nested.
        """
        cls = self.model_cls
        obj = self._create_yaml_object()

        # add start comment for class
        cls_comment = self.get_class_comment()
        if cls_comment:
            obj.yaml_set_start_comment(cls_comment + "\n\n", indent)
        
        sub_comments = self.sub_comments
        # add comments for fields
        def _set_subfield_comment(
            o: CommentedBase,
            m: BaseModel,
            n: str,
            sub_comment: SubModelComment,
            indent: int,
        ):
            if sub_comment:
                if sub_comment.get("is_entire_comment"):
                    comment = (YamlTemplate(sub_comment["model_obj"],
                                            dump_kwds=sub_comment.get("dump_kwds", {}),
                                            sub_comments=sub_comment.get("sub_comments", {}),)
                                .create_yaml_template()
                            )
                    if comment:
                        o.yaml_set_comment_before_after_key(n, "\n"+comment, indent=indent)
                elif sub_model_obj := sub_comment.get("model_obj"):
                    comment = self.get_field_comment(n, m) or self.get_class_comment(sub_model_obj)
                    if comment:
                        o.yaml_set_comment_before_after_key(n, "\n"+comment, indent=indent)
                    for f in sub_model_obj.model_fields:
                        s = sub_comment.get("sub_comments", {}).get(f, {})
                        _set_subfield_comment(o[n], sub_model_obj, f, s, indent+2)
            else:
                comment = self.get_field_comment(n, m)
                if comment:
                    o.yaml_set_comment_before_after_key(n, "\n"+comment, indent=indent)

        for n in cls.model_fields:
            _set_subfield_comment(obj, self.model_obj, n, sub_comments.get(n, {}), indent)

        yaml = import_yaml()
        buffer = StringIO()
        yaml.dump(obj, buffer)
        template = buffer.getvalue()

        if write_to is True:
            write_to = self.model_cls.model_config.get("yaml_file")
        if write_to:
            with open(write_to, "w", encoding="utf-8") as fp:
                fp.write(template)

        return template


class MyBaseModel(BaseModel):
    model_config = ConfigDict(
        use_attribute_docstrings=True,
        extra="allow",
        env_file_encoding="utf-8",
    )


class BaseFileSettings(BaseSettings):
    model_config = SettingsConfigDict(
        use_attribute_docstrings=True,
        extra="ignore",
        yaml_file_encoding="utf-8",
        env_file_encoding="utf-8",
    )

    def model_post_init(self, __context: os.Any) -> None:
        self._auto_reload = True
        return super().model_post_init(__context)

    @property
    def auto_reload(self) -> bool:
        return self._auto_reload
    
    @auto_reload.setter
    def auto_reload(self, val: bool):
        self._auto_reload = val

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return init_settings, env_settings, dotenv_settings, YamlConfigSettingsSource(settings_cls)

    def create_template_file(
        self,
        model_obj: BaseFileSettings=None,
        dump_kwds: t.Dict={},
        sub_comments: t.Dict[str, SubModelComment]={},
        write_file: bool | str | Path = False,
        file_format: t.Literal["yaml", "json"] = "yaml",
    ) -> str:
        if model_obj is None:
            model_obj = self
        if file_format == "yaml":
            template = YamlTemplate(model_obj=model_obj, dump_kwds=dump_kwds, sub_comments=sub_comments)
            return template.create_yaml_template(write_to=write_file)
        else:
            dump_kwds.setdefault("indent", 4)
            data = model_obj.model_dump_json(**dump_kwds)
            if write_file:
                write_file = self.model_config.get("
```

### Core Architecture Module: `libs/chatchat-server/chatchat/server/agent/tools_factory/__init__.py`
```
from .arxiv import arxiv
from .calculate import calculate
from .search_internet import search_internet
from .search_local_knowledgebase import search_local_knowledgebase
from .search_youtube import search_youtube
from .shell import shell
from .text2image import text2images
from .text2sql import text2sql
from .weather_check import weather_check
from .wolfram import wolfram
from .amap_poi_search import amap_poi_search
from .amap_weather import amap_weather
from .wikipedia_search import wikipedia_search
from .text2promql import text2promql
from .url_reader import url_reader

```

### Core Architecture Module: `libs/chatchat-server/chatchat/server/agent/tools_factory/amap_poi_search.py`
```
import requests
from chatchat.server.pydantic_v1 import Field
from .tools_registry import regist_tool

from langchain_chatchat.agent_toolkits.all_tools.tool import (
    BaseToolOutput,
)
from chatchat.server.utils import get_tool_config

BASE_URL = "https://restapi.amap.com/v5/place/text"

def amap_poi_search_engine(keywords: str,types: str,config: dict):
    API_KEY = config["api_key"]
    params = {
        "keywords": keywords,
        "types": types,
        "key": API_KEY
    }
    response = requests.get(BASE_URL, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": "API request failed"}



@regist_tool(title="高德地图POI搜索")
def amap_poi_search(location: str = Field(description="'实际地名'或者'具体的地址',不能使用简称或者别称"),
                types: str = Field(description="POI类型，比如商场、学校、医院等等")):
    """ A wrapper that uses Amap to search."""
    tool_config = get_tool_config("amap")
    return BaseToolOutput(amap_poi_search_engine(keywords=location,types=types,config=tool_config))

```

### Core Architecture Module: `libs/chatchat-server/chatchat/server/agent/tools_factory/amap_weather.py`
```
import requests
from chatchat.server.pydantic_v1 import Field
from .tools_registry import regist_tool

from langchain_chatchat.agent_toolkits.all_tools.tool import (
    BaseToolOutput,
)
from chatchat.server.utils import get_tool_config

BASE_DISTRICT_URL = "https://restapi.amap.com/v3/config/district"
BASE_WEATHER_URL = "https://restapi.amap.com/v3/weather/weatherInfo"

def get_adcode(city: str, config: dict) -> str:
    """Get the adcode"""
    API_KEY = config["api_key"]
    params = {
        "keywords": city,
        "subdistrict": 0, 
        "extensions": "base",
        "key": API_KEY
    }
    response = requests.get(BASE_DISTRICT_URL, params=params)
    if response.status_code == 200:
        data = response.json()
        return data["districts"][0]["adcode"]
    else:
        return None

def get_weather(adcode: str, config: dict) -> dict:
    """Get  weather information."""
    API_KEY = config["api_key"]
    params = {
        "city": adcode,
        "extensions": "all",
        "key": API_KEY
    }
    response = requests.get(BASE_WEATHER_URL, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": "API request failed"}

@regist_tool(title="高德地图天气查询")
def amap_weather(city: str = Field(description="城市名")):
    """A wrapper that uses Amap to get weather information."""
    tool_config = get_tool_config("amap")
    adcode = get_adcode(city, tool_config)
    if adcode:
        weather_data = get_weather(adcode, tool_config)
        return BaseToolOutput(weather_data)
    else:
        return BaseToolOutput({"error": "无法获取城市编码"})


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

### Incident Patch 1: `ba7bd259` (2025-09-03)
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

### Incident Patch 2: `620de3be` (2025-04-06)
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
+                elif isinstance(item, PlatformT
```

---

### Incident Patch 3: `d092597e` (2025-04-06)
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
+
```

---

### Incident Patch 4: `e5ad085b` (2025-04-03)
**Commit Message**: bug

**File**: `libs/chatchat-server/chatchat/settings.py` (modified, +2/-25)
```diff
@@ -670,33 +670,10 @@ class PromptSettings(BaseFileSettings):
         },
         "openai-functions": {
             "SYSTEM_PROMPT": (
-                "Answer the following questions as best you can. You have access to the following tools:\n"
-                "The way you use the tools is by specifying a json blob.\n"
-                "Specifically, this json should have a `action` key (with the name of the tool to use) and a `action_input` key (with the input to the tool going here).\n"
-                'The only values that should be in the "action" field are: {tool_names}\n'
-                "The $JSON_BLOB should only contain a SINGLE action, do NOT return a list of multiple actions. Here is an example of a valid $JSON_BLOB:\n"
-                "```\n\n"
-                "{{{{\n"
-                '  "action": $TOOL_NAME,\n'
-                '  "action_input": $INPUT\n'
-                "}}}}\n"
-                "```\n\n"
-                "ALWAYS use the following format:\n"
-                "Question: the input question you must answer\n"
-                "Thought: you should always think about what to do\n"
-                "Action:\n"
-                "```\n\n"
-                "$JSON_BLOB"
-                "```\n\n"
-                "Observation: the result of the action\n"
-                "... (this Thought/Action/Observation can repeat N times)\n"
-                "Thought: I now know the final answer\n"
-                "Final Answer: the final answer to the original input question\n"
-                "Begin! Reminder to always use the exact characters `Final Answer` when responding.\n"
+                "You are a helpful assistant"
             ),
             "HUMAN_MESSAGE": (
-                "Question:{input}\n"
-                "Thought:{agent_scratchpad}\n"
+                "{input}"
             )
         },
         "glm3": {
```

**File**: `libs/chatchat-server/langchain_chatchat/callbacks/agent_callback_handler.py` (modified, +6/-6)
```diff
@@ -165,12 +165,12 @@ async def on_tool_start(
 
         if self.approval_method is ApprovalMethod.CLI:
 
-            self.done.clear()
-            self.queue.put_nowait(dumps(data))
-            if not await _adefault_approve(input_str):
-                raise HumanRejectedException(
-                    f"Inputs {input_str} to tool {serialized} were rejected."
-                )
+            # self.done.clear()
+            # self.queue.put_nowait(dumps(data))
+            # if not await _adefault_approve(input_str):
+            #     raise HumanRejectedException(
+            #         f"Inputs {input_str} to tool {serialized} were rejected."
+            #     )
             pass
         elif self.approval_method is ApprovalMethod.BACKEND:
             pass
```

**File**: `libs/chatchat-server/tests/integration_tests/mcp_platform_tools/test_mcp_platform_tools.py` (modified, +60/-4)
```diff
@@ -1,6 +1,6 @@
 # -*- coding: utf-8 -*-
-from mcp import ClientSession, StdioServerParameters
-from mcp.client.stdio import stdio_client
+from mcp import ClientSession, StdioServerParameters, stdio_client
+
 from chatchat.server.agents_registry.agents_registry import agents_registry
 from chatchat.server.utils import get_ChatPlatformAIParams
 from langchain_chatchat import ChatPlatformAI
@@ -20,7 +20,6 @@
 
 @pytest.mark.asyncio
 async def test_mcp_stdio_tools(logging_conf):
-
     server_params = StdioServerParameters(
         command="python",
         # Make sure to update to the full absolute path to your math_server.py file
@@ -37,7 +36,7 @@ async def test_mcp_stdio_tools(logging_conf):
 
             # Create and run the agent
             llm_params = get_ChatPlatformAIParams(
-                model_name="glm-4-plus",
+                model_name="fun-lora",
                 temperature=0.01,
                 max_tokens=100,
             )
@@ -64,3 +63,60 @@ async def test_mcp_stdio_tools(logging_conf):
                 elif isinstance(item, PlatformToolsLLMStatus):
                     if item.status == AgentStatus.llm_end:
                         print("llm_end:" + item.text)
+
+
+@pytest.mark.asyncio
+async def test_mcp_multi_tools(logging_conf):
+    async with MultiServerMCPClient(
+            {
+                "math": {
+                    "command": "python",
+                    # Make sure to update to the full absolute path to your math_server.py file
+                    "args": [f"D:/project/Langchain-Chatchat/libs/chatchat-server/tests/integration_tests/mcp_platform_tools/math_server.py"],
+                    "transport": "stdio",
+                    "env": {
+                        **os.environ,
+                        "PYTHONHASHSEED": "0",
+                    },
+                },
+                # "playwright": {
+                #     # make sure you start your weather server on port 8000
+                #     "url": "http://localhost:8931/sse",
+                #     "transport": "sse",
+                # },
+            }
+    ) as client:
+
+        # Get tools
+        tools = client.get_tools()
+
+        # Create and run the agent
+        llm_params = get_ChatPlatformAIParams(
+            model_name="glm-4-plus",
+            temperature=0.01,
+            max_tokens=1280000,
+        )
+        llm = ChatPlatformAI(**llm_params)
+        agent_executor = PlatformToolsRunnable.create_agent_executor(
+            agent_type="openai-functions",
+            agents_registry=agents_registry,
+            llm=llm,
+            tools=tools,
+        )
+        chat_iterator = agent_executor.invoke(chat_input="下载项目到本地 https://github.com/microsoft/playwright-mcp")
+        async for item in chat_iterator:
+            if isinstance(item, PlatformToolsAction):
+                print("PlatformToolsAction:" + str(item.to_json()))
+
+            elif isinstance(item, PlatformToolsFinish):
+                print("PlatformToolsFinish:" + str(item.to_json()))
+
+            elif isinstance(item, PlatformToolsActionToolStart):
+                print("PlatformToolsActionToolStart:" + str(item.to_json()))
+
+            elif isinstance(item, PlatformToolsActionToolEnd):
+                print("PlatformToolsActionToolEnd:" + str(item.to_json()))
+            elif isinstance(item, PlatformToolsLLMStatus):
+                print(item.text)
+                if item.status == AgentStatus.llm_end:
+                    print("llm_end:" + item.text)
```

---

### Incident Patch 5: `8c470f82` (2024-10-31)
**Commit Message**: fix: wrong parameters when recreate vectorstore (#5043)

**File**: `libs/chatchat-server/chatchat/server/knowledge_base/kb_doc_api.py` (modified, +5/-3)
```diff
@@ -400,8 +400,8 @@ def download_doc(
 def recreate_vector_store(
         knowledge_base_name: str = Body(..., examples=["samples"]),
         allow_empty_kb: bool = Body(True),
-        vs_type: str = Body(Settings.kb_settings.DEFAULT_VS_TYPE),
-        embed_model: str = Body(get_default_embedding()),
+        vs_type: str = Body(Settings.kb_settings.DEFAULT_VS_TYPE, description="为空知识库指定向量库类型。已有知识库默认使用原向量库类型。"),
+        embed_model: str = Body(get_default_embedding(), description="为空知识库指定Embedding模型。已有知识库默认使用原Embedding模型。"),
         chunk_size: int = Body(Settings.kb_settings.CHUNK_SIZE, description="知识库中单段文本最大长度"),
         chunk_overlap: int = Body(Settings.kb_settings.OVERLAP_SIZE, description="知识库中相邻文本重合长度"),
         zh_title_enhance: bool = Body(Settings.kb_settings.ZH_TITLE_ENHANCE, description="是否开启中文标题加强"),
@@ -416,7 +416,9 @@ def recreate_vector_store(
 
     def output():
         try:
-            kb = KBServiceFactory.get_service(knowledge_base_name, vs_type, embed_model)
+            kb = KBServiceFactory.get_service_by_name(knowledge_base_name)
+            if kb is None:
+                kb = KBServiceFactory.get_service(knowledge_base_name, vs_type, embed_model)
             if not kb.exists() and not allow_empty_kb:
                 yield {"code": 404, "msg": f"未找到知识库 ‘{knowledge_base_name}’"}
             else:
```

---

### Incident Patch 6: `93e2c878` (2024-08-29)
**Commit Message**: fix(components): [ensemble.py] The top_k value of the retriever cannot be specified (#4705)

Co-authored-by: Zhengyunlong <lonson@MBP-HHFQL4RXM1-0213.local>

**File**: `libs/chatchat-server/chatchat/server/file_rag/retrievers/ensemble.py` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ def from_vectorstore(
         ensemble_retriever = EnsembleRetriever(
             retrievers=[bm25_retriever, faiss_retriever], weights=[0.5, 0.5]
         )
-        return EnsembleRetrieverService(retriever=ensemble_retriever)
+        return EnsembleRetrieverService(retriever=ensemble_retriever, top_k=top_k)
 
     def get_relevant_documents(self, query: str):
         return self.retriever.get_relevant_documents(query)[: self.top_k]
```

**File**: `libs/chatchat-server/chatchat/server/file_rag/retrievers/vectorstore.py` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ def from_vectorstore(
             search_type="similarity_score_threshold",
             search_kwargs={"score_threshold": score_threshold, "k": top_k},
         )
-        return VectorstoreRetrieverService(retriever=retriever)
+        return VectorstoreRetrieverService(retriever=retriever, top_k=top_k)
 
     def get_relevant_documents(self, query: str):
         return self.retriever.get_relevant_documents(query)[: self.top_k]
```

---

### Incident Patch 7: `8dd3c6b7` (2024-08-18)
**Commit Message**: fix nltk_data path problem (#4832)

* fix nltk_data path problem

* fix: logger.warn error

**File**: `libs/chatchat-server/chatchat/settings.py` (modified, +1/-2)
```diff
@@ -64,7 +64,7 @@ def IMG_DIR(self) -> Path:
     @cached_property
     def NLTK_DATA_PATH(self) -> Path:
         """nltk 模型存储路径"""
-        p = self.DATA_PATH / "nltk_data"
+        p = self.PACKAGE_ROOT / "data/nltk_data"
         return p
 
     # @computed_field
@@ -117,7 +117,6 @@ def make_dirs(self):
         '''创建所有数据目录'''
         for p in [
             self.DATA_PATH,
-            self.NLTK_DATA_PATH,
             self.MEDIA_PATH,
             self.LOG_PATH,
             self.BASE_TEMP_DIR,
```

**File**: `libs/chatchat-server/chatchat/utils.py` (modified, +1/-0)
```diff
@@ -35,6 +35,7 @@ def build_logger(log_file: str = "chatchat"):
     loguru.logger._core.handlers[0]._filter = _filter_logs
     logger = loguru.logger.opt(colors=True)
     logger.opt = partial(loguru.logger.opt, colors=True)
+    logger.warn = logger.warning
     # logger.error = partial(logger.exception)
 
     if log_file:
```

---

### Incident Patch 8: `ef466414` (2024-08-08)
**Commit Message**: fix (#4700)

fix

**File**: `README.md` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ OpenAI GPT API 的调用，并将在后续持续扩充对各类模型及模型 A
 | 功能        | 0.2.x                            | 0.3.x                                                               |
 |-----------|----------------------------------|---------------------------------------------------------------------|
 | 模型接入      | 本地：fastchat<br>在线：XXXModelWorker | 本地：model_provider,支持大部分主流模型加载框架<br>在线：oneapi<br>所有模型接入均兼容openai sdk |
-| Agent     | ❌不稳定                             | ✅针对ChatGLM3和QWen进行优化,Agent能力显著提升                                    ||
+| Agent     | ❌不稳定                             | ✅针对ChatGLM3和Qwen进行优化,Agent能力显著提升                                    ||
 | LLM对话     | ✅                                | ✅                                                                   ||
 | 知识库对话     | ✅                                | ✅                                                                   ||
 | 搜索引擎对话    | ✅                                | ✅                                                                   ||
```

---

### Incident Patch 9: `86d4e825` (2024-08-07)
**Commit Message**: fix:如果模型输出不是str，会导致ret=OpenAIChatOutput报错 (#4649)

**File**: `libs/chatchat-server/chatchat/server/chat/chat.py` (modified, +3/-2)
```diff
@@ -213,11 +213,12 @@ async def chat_iterator() -> AsyncIterable[OpenAIChatOutput]:
                             data["message_type"] = message_type
                     except:
                         ...
-
+                text_value = data.get("text", "")
+                content = text_value if isinstance(text_value, str) else str(text_value)
                 ret = OpenAIChatOutput(
                     id=f"chat{uuid.uuid4()}",
                     object="chat.completion.chunk",
-                    content=data.get("text", ""),
+                    content=content,
                     role="assistant",
                     tool_calls=data["tool_calls"],
                     model=models["llm_model"].model_name,
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
