# Forensic Learning Record (Deep Inspection): eosphoros-ai/DB-GPT

> **Canonical Artifact**: `07_PROJECT_LEARNING/eosphoros-ai-db-gpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/eosphoros-ai/DB-GPT](https://github.com/eosphoros-ai/DB-GPT))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:45:19.967Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `eosphoros-ai/DB-GPT`
- **Description**: open-source agentic AI data assistant for the next generation of AI + Data products.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 20072 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/examples/metadata/duckdb2mysql.py`
```
import duckdb
import pymysql

""" migrate duckdb to mysql"""

mysql_config = {
    "host": "127.0.0.1",
    "user": "root",
    "password": "your_password",
    "db": "dbgpt",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

duckdb_files_to_tables = {
    "pilot/message/chat_history.db": "chat_history",
    "pilot/message/connect_config.db": "connect_config",
}

conn_mysql = pymysql.connect(**mysql_config)


def migrate_table(duckdb_file_path, source_table, destination_table, conn_mysql):
    conn_duckdb = duckdb.connect(duckdb_file_path)
    try:
        cursor = conn_duckdb.cursor()
        cursor.execute(f"SELECT * FROM {source_table}")
        column_names = [
            desc[0] for desc in cursor.description if desc[0].lower() != "id"
        ]
        select_columns = ", ".join(column_names)

        cursor.execute(f"SELECT {select_columns} FROM {source_table}")
        results = cursor.fetchall()

        with conn_mysql.cursor() as cursor_mysql:
            for row in results:
                placeholders = ", ".join(["%s"] * len(row))
                insert_query = f"INSERT INTO {destination_table} ({', '.join(column_names)}) VALUES ({placeholders})"
                cursor_mysql.execute(insert_query, row)
        conn_mysql.commit()
    finally:
        conn_duckdb.close()


try:
    for duckdb_file, table in duckdb_files_to_tables.items():
        print(f"Migrating table {table} from {duckdb_file}...")
        migrate_table(duckdb_file, table, table, conn_mysql)
        print(f"Table {table} migrated successfully.")
finally:
    conn_mysql.close()

print("Migration completed.")

```

### Core Architecture Module: `docker/examples/metadata/duckdb2sqlite.py`
```
import sqlite3

import duckdb

""" migrate duckdb to sqlite"""

duckdb_files_to_tables = {
    "pilot/message/chat_history.db": "chat_history",
    "pilot/message/connect_config.db": "connect_config",
}

sqlite_db_path = "pilot/meta_data/dbgpt.db"

conn_sqlite = sqlite3.connect(sqlite_db_path)


def migrate_table(duckdb_file_path, source_table, destination_table, conn_sqlite):
    conn_duckdb = duckdb.connect(duckdb_file_path)
    try:
        cursor_duckdb = conn_duckdb.cursor()
        cursor_duckdb.execute(f"SELECT * FROM {source_table}")
        column_names = [
            desc[0] for desc in cursor_duckdb.description if desc[0].lower() != "id"
        ]
        select_columns = ", ".join(column_names)

        cursor_duckdb.execute(f"SELECT {select_columns} FROM {source_table}")
        results = cursor_duckdb.fetchall()

        cursor_sqlite = conn_sqlite.cursor()
        for row in results:
            placeholders = ", ".join(["?"] * len(row))
            insert_query = f"INSERT INTO {destination_table} ({', '.join(column_names)}) VALUES ({placeholders})"
            cursor_sqlite.execute(insert_query, row)
        conn_sqlite.commit()
        cursor_sqlite.close()
    finally:
        conn_duckdb.close()


try:
    for duckdb_file, table in duckdb_files_to_tables.items():
        print(f"Migrating table {table} from {duckdb_file} to SQLite...")
        migrate_table(duckdb_file, table, table, conn_sqlite)
        print(f"Table {table} migrated to SQLite successfully.")
finally:
    conn_sqlite.close()

print("Migration to SQLite completed.")

```

### Core Architecture Module: `examples/__main__.py`
```
# TODO add example run code here

import asyncio

# Agents examples
from .agents.auto_plan_agent_dialogue_example import main as auto_plan_main
from .agents.awel_layout_agents_chat_examples import main as awel_layout_main
from .agents.custom_tool_agent_example import main as custom_tool_main
from .agents.plugin_agent_dialogue_example import main as plugin_main
from .agents.retrieve_summary_agent_dialogue_example import (
    main as retrieve_summary_main,
)
from .agents.sandbox_code_agent_example import main as sandbox_code_main
from .agents.single_agent_dialogue_example import main as single_agent_main
from .agents.sql_agent_dialogue_example import main as sql_main

if __name__ == "__main__":
    # Run the examples

    ## Agent examples
    asyncio.run(auto_plan_main())
    asyncio.run(awel_layout_main())
    asyncio.run(custom_tool_main())
    asyncio.run(retrieve_summary_main())
    asyncio.run(plugin_main())
    asyncio.run(sandbox_code_main())
    asyncio.run(single_agent_main())
    asyncio.run(sql_main())

    ## awel examples
    print("hello world!")

```

### Core Architecture Module: `examples/agents/auto_plan_agent_dialogue_example.py`
```
"""Agents: auto plan agents example?

Examples:

    Execute the following command in the terminal:
    Set env params.
    .. code-block:: shell

        export SILICONFLOW_API_KEY=sk-xx
        export SILICONFLOW_API_BASE=https://xx:80/v1

    run example.
    ..code-block:: shell
        python examples/agents/auto_plan_agent_dialogue_example.py
"""

import asyncio
import os

from dbgpt.agent import (
    AgentContext,
    AgentMemory,
    AutoPlanChatManager,
    LLMConfig,
    UserProxyAgent,
)
from dbgpt.agent.expand.code_assistant_agent import CodeAssistantAgent
from dbgpt.util.tracer import initialize_tracer

initialize_tracer(
    "/tmp/agent_auto_plan_agent_dialogue_example_trace.jsonl", create_system_app=True
)


async def main():
    from dbgpt.model.proxy.llms.siliconflow import SiliconFlowLLMClient

    llm_client = SiliconFlowLLMClient(
        model_alias=os.getenv(
            "SILICONFLOW_MODEL_VERSION", "Qwen/Qwen2.5-Coder-32B-Instruct"
        ),
    )

    context: AgentContext = AgentContext(
        conv_id="test456", gpts_app_name="代码分析助手", max_new_tokens=2048
    )
    agent_memory = AgentMemory()
    agent_memory.gpts_memory.init(conv_id="test456")
    try:
        coder = (
            await CodeAssistantAgent()
            .bind(context)
            .bind(LLMConfig(llm_client=llm_client))
            .bind(agent_memory)
            .build()
        )

        manager = (
            await AutoPlanChatManager()
            .bind(context)
            .bind(agent_memory)
            .bind(LLMConfig(llm_client=llm_client))
            .build()
        )
        manager.hire([coder])

        user_proxy = await UserProxyAgent().bind(context).bind(agent_memory).build()

        await user_proxy.initiate_chat(
            recipient=manager,
            reviewer=user_proxy,
            message="Obtain simple information about issues in the repository 'eosphoros-ai/DB-GPT' in the past three days and analyze the data. Create a Markdown table grouped by day and status.",
            # message="Find papers on gpt-4 in the past three weeks on arxiv, and organize their titles, authors, and links into a markdown table",
            # message="find papers on LLM applications from arxiv in the last month, create a markdown table of different domains.",
        )
    finally:
        agent_memory.gpts_memory.clear(conv_id="test456")


if __name__ == "__main__":
    ## dbgpt-vis message infos
    asyncio.run(main())

```

### Core Architecture Module: `examples/agents/auto_search_agent_example.py`
```
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from dbgpt.agent import AgentContext, AgentMemory, LLMConfig, UserProxyAgent
from dbgpt.agent.expand.data_scientist_agent import DataScientistAgent
from dbgpt.agent.expand.web_assistant_agent import WebSearchAgent
from dbgpt.agent.resource import RDBMSConnectorResource
from dbgpt.model.proxy import TongyiLLMClient
from dbgpt_ext.datasource.rdbms.conn_sqlite import SQLiteConnector

api_base = "https://dashscope.aliyuncs.com/compatible-mode/v1"
api_key = "sk-xxx"
model = "qwen3-32b"


def read_excel_headers_and_data(
    file_path: str,
) -> Tuple[List[str], List[Dict[str, Any]]]:
    """
    读取Excel文件，返回表头信息和结构化数据

    参数:
        file_path: Excel文件路径（.xlsx格式）

    返回:
        Tuple[表头列表, 数据列表]
        - 表头列表: 从Excel第一行读取的列名
        - 数据列表: 每个元素是一个字典，键为表头，值为对应单元格数据（空单元格转为None）
    """
    if not Path(file_path).exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    if Path(file_path).suffix.lower() != ".xlsx":
        raise ValueError(f"不支持的文件格式: {Path(file_path).suffix}，仅支持.xlsx")

    try:
        df = pd.read_excel(
            file_path, sheet_name=0, engine="openpyxl", keep_default_na=False
        )
    except Exception as e:
        raise RuntimeError(f"读取Excel失败: {str(e)}")

    headers = list(df.columns)
    if not headers:
        raise ValueError("Excel文件没有表头信息（第一行为空）")

    data = []
    for _, row in df.iterrows():
        row_data = {}
        for header in headers:
            value = row[header]
            row_data[header] = value if value != "" else None
        data.append(row_data)

    return headers, data


def data2md(headers, table_data):
    md_lines = []

    md_lines.append("| " + " | ".join(headers) + " |")
    md_lines.append("| " + " | ".join(["---"] * len(headers)) + " |")

    for row in table_data:
        values = []
        for h in headers:
            val = row.get(h, "")
            if hasattr(val, "strftime"):
                values.append(val.strftime("%Y-%m-%d"))
            else:
                values.append(str(val))
        md_lines.append("| " + " | ".join(values) + " |")

    markdown_table = "\n".join(md_lines)
    return markdown_table


async def main():
    llm_client = TongyiLLMClient(api_base=api_base, api_key=api_key, model=model)
    context: AgentContext = AgentContext(
        conv_id="test123", language="zh", temperature=0.5, max_new_tokens=2048
    )
    agent_memory = AgentMemory()
    agent_memory.gpts_memory.init(conv_id="test123")

    user_proxy = await UserProxyAgent().bind(agent_memory).bind(context).build()

    sql_boy = (
        await WebSearchAgent()
        .bind(context)
        .bind(LLMConfig(llm_client=llm_client))
        .bind(agent_memory)
        .build()
    )

    await user_proxy.initiate_chat(
        recipient=sql_boy, reviewer=user_proxy, message=f"今年的中秋节是多久？"
    )
    print(await agent_memory.gpts_memory.app_link_chat_message("test123"))


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/agents/awel_layout_agents_chat_examples.py`
```
"""Agents: auto plan agents example?

Examples:

    Execute the following command in the terminal:
    Set env params.
    .. code-block:: shell

        export SILICONFLOW_API_KEY=sk-xx
        export SILICONFLOW_API_BASE=https://xx:80/v1

    run example.
    ..code-block:: shell
        python examples/agents/awel_layout_agents_chat_examples.py
"""

import asyncio
import os

from dbgpt.agent import (
    AgentContext,
    AgentMemory,
    LLMConfig,
    UserProxyAgent,
    WrappedAWELLayoutManager,
)
from dbgpt.agent.expand.resources.search_tool import baidu_search
from dbgpt.agent.expand.summary_assistant_agent import SummaryAssistantAgent
from dbgpt.agent.expand.tool_assistant_agent import ToolAssistantAgent
from dbgpt.agent.resource import ToolPack
from dbgpt.util.tracer import initialize_tracer

initialize_tracer("/tmp/agent_trace.jsonl", create_system_app=True)


async def main():
    agent_memory = AgentMemory()
    agent_memory.gpts_memory.init(conv_id="test456")
    try:
        from dbgpt.model.proxy.llms.siliconflow import SiliconFlowLLMClient

        llm_client = SiliconFlowLLMClient(
            model_alias=os.getenv(
                "SILICONFLOW_MODEL_VERSION", "Qwen/Qwen2.5-Coder-32B-Instruct"
            ),
        )

        context: AgentContext = AgentContext(
            conv_id="test456", gpts_app_name="信息析助手"
        )

        tools = ToolPack([baidu_search])
        tool_engineer = (
            await ToolAssistantAgent()
            .bind(context)
            .bind(LLMConfig(llm_client=llm_client))
            .bind(agent_memory)
            .bind(tools)
            .build()
        )
        summarizer = (
            await SummaryAssistantAgent()
            .bind(context)
            .bind(agent_memory)
            .bind(LLMConfig(llm_client=llm_client))
            .build()
        )

        manager = (
            await WrappedAWELLayoutManager()
            .bind(context)
            .bind(agent_memory)
            .bind(LLMConfig(llm_client=llm_client))
            .build()
        )
        manager.hire([tool_engineer, summarizer])

        user_proxy = await UserProxyAgent().bind(context).bind(agent_memory).build()

        await user_proxy.initiate_chat(
            recipient=manager,
            reviewer=user_proxy,
            message="查询北京今天天气",
            # message="查询今天的最新热点财经新闻",
            # message="Find papers on gpt-4 in the past three weeks on arxiv, and organize their titles, authors, and links into a markdown table",
            # message="find papers on LLM applications from arxiv in the last month, create a markdown table of different domains.",
        )

    finally:
        agent_memory.gpts_memory.clear(conv_id="test456")


if __name__ == "__main__":
    ## dbgpt-vis message infos
    asyncio.run(main())

```

### Core Architecture Module: `examples/agents/claude_skill_example.py`
```
"""
Example: Using Claude-style SKILL files with DB-GPT agents.

This demonstrates how to use the Claude SKILL mechanism
where skills are defined in Markdown files.
"""

import asyncio
import os

from dbgpt.agent import AgentContext, AgentMemory, LLMConfig
from dbgpt.agent.claude_skill import (
    ClaudeSkillAgent,
    get_registry,
    load_skills_from_dir,
)
from dbgpt.model.proxy.llms.siliconflow import SiliconFlowLLMClient


async def main():
    """Main function demonstrating Claude SKILL usage."""

    # Load skills from directory
    skill_dir = os.path.join(os.path.dirname(__file__), "../skills/claude")

    load_skills_from_dir(skill_dir, recursive=True)

    # List available skills
    registry = get_registry()
    print("Loaded skills:")
    for skill_metadata in registry.list_skills():
        print(f"  - {skill_metadata.name}: {skill_metadata.description}")

    # Create LLM client
    llm_client = SiliconFlowLLMClient(
        model_alias=os.getenv(
            "SILICONFLOW_MODEL_VERSION", "Qwen/Qwen2.5-Coder-32B-Instruct"
        ),
    )

    # Create agent context
    agent_memory = AgentMemory()
    agent_memory.gpts_memory.init(conv_id="claude_skill_test")

    context: AgentContext = AgentContext(
        conv_id="claude_skill_test",
        gpts_app_name="Claude Skill Agent",
    )

    # Create Claude Skill Agent
    agent = ClaudeSkillAgent()

    # Bind necessary components
    await (
        agent.bind(context)
        .bind(LLMConfig(llm_client=llm_client))
        .bind(agent_memory)
        .build()
    )

    print("\n" + "=" * 60)
    print("Claude Skill Agent Ready!")
    print("=" * 60)

    # Example interactions
    test_inputs = [
        "Can you explain how this code works?",
        "My code isn't working, can you help debug it?",
        "Write a function to sort a list",
        "Simplify this complex code for me",
    ]

    print("\nTest inputs and skill detection:")
    print("-" * 60)

    for user_input in test_inputs:
        agent.detect_and_apply_skill(user_input)

        if agent.current_skill:
            print(f"Input: {user_input}")
            print(f"Matched Skill: {agent.current_skill.metadata.name}")
            print(f"Description: {agent.current_skill.metadata.description}")
            print(f"Instructions preview: {agent.current_skill.instructions[:100]}...")
            print()

    # Show available skills
    print("\nAvailable skills:")
    for skill_name in agent.get_available_skills():
        print(f"  - {skill_name}")

    # Manual skill selection example
    print("\n" + "-" * 60)
    print("Manual skill selection:")
    agent.set_skill("explain-code")
    print(f"Current skill: {agent.current_skill.metadata.name}")

    agent.clear_skill()
    print(f"After clearing: {agent.current_skill}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/agents/custom_tool_agent_example.py`
```
import asyncio
import logging
import os
import sys

from typing_extensions import Annotated, Doc

from dbgpt.agent import AgentContext, AgentMemory, LLMConfig, UserProxyAgent
from dbgpt.agent.expand.tool_assistant_agent import ToolAssistantAgent
from dbgpt.agent.resource import ToolPack, tool

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


@tool
def simple_calculator(first_number: int, second_number: int, operator: str) -> float:
    """Simple calculator tool. Just support +, -, *, /."""
    if isinstance(first_number, str):
        first_number = int(first_number)
    if isinstance(second_number, str):
        second_number = int(second_number)
    if operator == "+":
        return first_number + second_number
    elif operator == "-":
        return first_number - second_number
    elif operator == "*":
        return first_number * second_number
    elif operator == "/":
        return first_number / second_number
    else:
        raise ValueError(f"Invalid operator: {operator}")


@tool
def count_directory_files(path: Annotated[str, Doc("The directory path")]) -> int:
    """Count the number of files in a directory."""
    if not os.path.isdir(path):
        raise ValueError(f"Invalid directory path: {path}")
    return len(os.listdir(path))


async def main():
    from dbgpt.model.proxy.llms.siliconflow import SiliconFlowLLMClient

    llm_client = SiliconFlowLLMClient(
        model_alias=os.getenv(
            "SILICONFLOW_MODEL_VERSION", "Qwen/Qwen2.5-Coder-32B-Instruct"
        ),
    )
    agent_memory = AgentMemory()
    agent_memory.gpts_memory.init(conv_id="test456")

    context: AgentContext = AgentContext(conv_id="test456", gpts_app_name="工具助手")

    tools = ToolPack([simple_calculator, count_directory_files])

    user_proxy = await UserProxyAgent().bind(agent_memory).bind(context).build()

    tool_engineer = (
        await ToolAssistantAgent()
        .bind(context)
        .bind(LLMConfig(llm_client=llm_client))
        .bind(agent_memory)
        .bind(tools)
        .build()
    )

    await user_proxy.initiate_chat(
        recipient=tool_engineer,
        reviewer=user_proxy,
        message="Calculate the product of 10 and 99",
    )

    await user_proxy.initiate_chat(
        recipient=tool_engineer,
        reviewer=user_proxy,
        message="Count the number of files in /tmp",
    )

    # dbgpt-vis message infos
    print(await agent_memory.gpts_memory.app_link_chat_message("test456"))


if __name__ == "__main__":
    asyncio.run(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3193** (2026-08-16): **[Bug] [dbgpt-client] update_flow omits the required flow UID from the request path**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  MacOS(M1, M2...)  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [ ] Chat Data - [ ] Chat Excel - [ ] Chat DB - [ ] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [ ] Plugins  ### Installation Information  - [x] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  apple silicon arm64  This issue is device-independent because it occurs in the Python client's  HTTP request path construction.  ### Models information  No LLM or embedding model is involved. The issue occurs before any model interaction.  ### What happened  `dbgpt_client.flow.update_flow()` sends the update request to the collection URL without the flow UID:  ```http PUT /api/v2/serve/awel/flows ``` But the server only registers the update endpoint with a required path parameter: ```http PUT /api/v2/serve/awel/flows
  **Post-Mortem & Fix Analysis**:
  > I'd be happy to follow up on this issue, and I've already submitted a PR

- **Issue #3181** (2026-08-08): **[Bug] [Agent] Final answer leaks references payload and script source into visible content**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  MacOS(M1, M2...)  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [x] Chat Data - [ ] Chat Excel - [ ] Chat DB - [ ] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [x] Plugins  ### Installation Information  - [x] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  Device: CPU (Apple Silicon / macOS development environment) GPU: Not required to reproduce  ### Models information  LLM: Model-independent Embedding model: Model-independent  The issue occurs in the ReAct final-answer assembly and frontend rendering path, after the model/tool execution has already completed.  ### What happened  After a ReAct/Chat Data task finishes and the HTML report plus summary are already available, the visible assistant answer continues streaming a literal `<references>` payload.  The payload ca
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this issue. We've noted the problem you described and will look into it for an upcoming release. If you can provide additional details such as the exact version, environment, and minimal reproduction steps, it would help us diagnose faster. Feel free to submit a PR if you'd like to contribute a fix.  Documentation: http://docs.dbgpt.cn/docs/next/overview/

- **Issue #3115** (2026-08-08): **[Bug] [Module Name] Bug title**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  Linux  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [ ] Chat Data - [ ] Chat Excel - [ ] Chat DB - [ ] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [ ] Plugins  ### Installation Information  - [ ] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [x] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  ubuntu24.04   ### Models information  xinference  ### What happened  assets/schema/dbgpt.sql： When creating the three tables connector_instance, dbgpt_serve_scheduled_task, and dbgpt_serve_scheduled_run in the dbgpt database, the database was accidentally switched to a different one. failed to start.🤯  ### What you expected to happen  assets/schema/dbgpt.sql： Move the creation of the users table to the bottom.  -- connector_instance, Persist MCP connector instances (encrypted credentials, transport/extra config, lifecycle stat
  **Post-Mortem & Fix Analysis**:
  > Thanks for reaching out. To help us better understand your issue, could you please provide: - Your DB-GPT version - Your environment details (OS, Python version, etc.) - Minimal reproduction steps  You can also check our documentation at http://docs.dbgpt.cn/docs/next/overview/ for guidance.

- **Issue #3110** (2026-07-26): **[Vulnerability] [Core] Remote code execution through malicious skill.md**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  MacOS(M1, M2...)  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [ ] Chat Data - [ ] Chat Excel - [ ] Chat DB - [x] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [x] Plugins  ### Installation Information  - [ ] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [x] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  MacOS M5 with Docker Compose Container running DB-GPT in the main branch  ### Models information  This vulnerability does not require any specific model to reproduce as it executes the code in the process of the rendering the prompt template.  ### What happened  An injected code in the SKILL.md was executed in the docker and wrote a file.  ### What you expected to happen  The app should use a sandbox environment to stop the malicious remote code execution instead of letting it run on the container.  ### How to reprod

- **Issue #3104** (2026-08-08): **[Bug] [dbgpt-app] Unauthenticated path-traversal arbitrary file write via the user_id header in the python file-upload endpoint**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  Linux  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [ ] Chat Data - [ ] Chat Excel - [ ] Chat DB - [ ] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [ ] Plugins  ### Installation Information  - [ ] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  -  ### Models information  -  ### What happened  ### Summary  The DB-GPT python file-upload endpoint builds the destination directory from an HTTP `user_id` header without validation, and the server has no real authentication (its auth dependency is a mock that returns an admin user for every request). A `user_id` header containing parent-directory segments escapes the intended upload directory, so an unauthenticated client can write attacker-controlled file content to an arbitrary location on the server, which escalates to rem
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report! We've reviewed the code and can confirm this is a real issue.  The vulnerability stems from the `user_id` HTTP header being used as a path component without validation in `python_upload_api.py`:  ```python upload_dir = os.path.join(base_dir, "python_uploads", user_id) ```  While PR #3064 previously addressed **filename** traversal (escaped via `../../` in the uploaded filename), the `_resolve_upload_path` check it introduced only validates that the `filename` stays within the resolved `upload_dir`. It does not validate that `upload_dir` itself stays within the intended `base_dir` — so a `user_id` header containing `../` sequences escapes the upload directory entirely, and the filename check passes trivially since it's relative to the already-escaped directory.  Additionally, `get_user_from_headers` in `auth.py` accepts any `user_id` header value with no authentication, making this exploitable without credentials.  We'll follow up and aim to address this 
  > I've opened PR #3118 to fix this path traversal: it validates `user_id` as a single, contained path segment (rejecting absolute / multi-segment / `..` values) and verifies the resolved directory stays inside the `python_uploads` root, plus regression tests. Please take a look when you have time, thanks!
  > looks good! 

- **Issue #3082** (2026-06-17): **[Bug] [Module Name] Sandbox API silently falls back to LocalRuntime and executes code on host**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  Windows  ### Python version information  >=3.11  ### DB-GPT version  latest release  ### Related scenes  - [ ] Chat Data - [ ] Chat Excel - [ ] Chat DB - [ ] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [x] Plugins  ### Installation Information  - [x] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  Device: CPU  ### Models information  LLM: vicuna-13b-v1.5 Embedding model: text2vec-large-chinese   ### What happened  The DB-GPT sandbox service can silently use `LocalRuntime` as the execution backend. In the tested source snapshot, `SANDBOX_RUNTIME` defaults to `"local"`:  ```python # packages/dbgpt-sandbox/src/dbgpt_sandbox/sandbox/config.py SANDBOX_RUNTIME = os.getenv("SANDBOX_RUNTIME", "local") ```  Then `RuntimeFactory.create()` returns `LocalRuntime()` when the runtime preference is local, or when no contain

- **Issue #3060** (2026-05-17): **[Bug] [dbgpt-ext] StarRocks field type conversion issue**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  Linux  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [ ] Chat Data - [ ] Chat Excel - [ ] Chat DB - [x] Chat Knowledge - [x] Model Management - [x] Dashboard - [x] Plugins  ### Installation Information  - [ ] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [ ] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [x] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  Mac M2  ### Models information  LLM:deepseek-3.2 Embeddings:gemini-embedding-001  ### What happened  Since version 3.x, StarRocks has introduced the BINARY/VARBINARY data types for storing binary data in bytes. However, these types are not supported in the datatype.py script.  web-server log => dbgpt_ext.datasource.rdbms.dialect.starrocks.sqlalchemy.datatype[1] WARNING Did not recognize type 'varbinary'   StarRockes : <img width="1153" height="431" alt="Image" src="https://github.com/user-attachments/assets/b6e2544c-451d-4b5c-8

- **Issue #3054** (2026-05-14): **[Bug] [gb-gpt] gpts_messages table's content column type is too small**
  *Symptoms*: ### Search before asking  - [x] I had searched in the [issues](https://github.com/eosphoros-ai/DB-GPT/issues?q=is%3Aissue) and found no similar issues.   ### Operating system information  MacOS(M1, M2...)  ### Python version information  >=3.11  ### DB-GPT version  main  ### Related scenes  - [ ] Chat Data - [x] Chat Excel - [x] Chat DB - [ ] Chat Knowledge - [ ] Model Management - [ ] Dashboard - [ ] Plugins  ### Installation Information  - [ ] [Installation From Source](https://db-gpt.readthedocs.io/en/latest/getting_started/install/deploy/deploy.html)  - [x] [Docker Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [x] [Docker Compose Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/docker/docker.html)  - [ ] [Cluster Installation](https://db-gpt.readthedocs.io/en/latest/getting_started/install/llm/cluster/model_cluster.html)  - [ ] AutoDL Image - [ ] Other  ### Device information  CPU MAC M2  ### Models information  LLM:deepseek-v3.2  ### What happened  I deployed the environment via Docker and launched the first demo for Walmart sales data analysis. The local service started up normally, but an error occurred when writing data into the content column of the gpts_messages table due to insufficient column length.  <img width="944" height="772" alt="Image" src="https://github.com/user-attachments/assets/028bc47f-faaa-4a9f-9a52-4425c6944d30" />  ### What you expected to happen  table's colunm typ

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

### Incident Patch 1: `d1d398eb` (2026-09-28)
**Commit Message**: fix: fix knowledge space scoping and benchmark security (#3271)

Co-authored-by: alan.cl <alan.cl@antgroup.com>
Co-authored-by: Claude <noreply@anthropic.com>

**File**: `packages/dbgpt-app/src/dbgpt_app/knowledge/_cli/knowledge_client.py` (modified, +4/-2)
```diff
@@ -97,8 +97,10 @@ def chunk_list(self, space_name: str, query_request: ChunkQueryRequest):
         url = f"/knowledge/{space_name}/chunk/list"
         return self._post(url, data=query_request)
 
-    def similar_query(self, vector_name: str, query_request: KnowledgeQueryRequest):
-        url = f"/knowledge/{vector_name}/query"
+    def similar_query(self, space_name: str, query_request: KnowledgeQueryRequest):
+        # The space comes from the URL path and must name an
+        # existing knowledge space.
+        url = f"/knowledge/{space_name}/query"
         return self._post(url, data=query_request)
 
 
```

**File**: `packages/dbgpt-app/src/dbgpt_app/knowledge/api.py` (modified, +60/-3)
```diff
@@ -577,6 +577,27 @@ def chunk_list(
 ):
     print(f"/chunk/list params: {space_name}, {query_request}")
     try:
+        # space_name is the authorization boundary for this endpoint: the
+        # chunk table has no space column, so the listing must be scoped
+        # through the named space's document ids. Never leave the query
+        # unrestricted here.
+        space = service.get({"name": space_name})
+        if space is None:
+            return Result.failed(
+                code="E000X",
+                msg=f"knowledge_space {space_name} can not be found",
+            )
+        doc_query = {"space": space.name}
+        if query_request.document_id is not None:
+            doc_query["id"] = query_request.document_id
+        documents = service.get_document_list(doc_query)
+        doc_ids = [doc.id for doc in documents]
+        if not doc_ids:
+            # No documents in this space (or the requested document id
+            # belongs to a different space): nothing can be listed.
+            return Result.succ(
+                ChunkQueryResponse(data=[], total=0, page=query_request.page)
+            )
         query = {
             "id": query_request.id,
             "document_id": query_request.document_id,
@@ -585,7 +606,10 @@ def chunk_list(
             "content": query_request.content,
         }
         chunk_res = service.get_chunk_list_page(
-            query, query_request.page, query_request.page_size
+            query,
+            query_request.page,
+            query_request.page_size,
+            document_ids=doc_ids,
         )
         res = ChunkQueryResponse(
             data=chunk_res.items,
@@ -605,16 +629,49 @@ def chunk_edit(
 ):
     print(f"/chunk/edit params: {space_name}, {edit_request}")
     try:
+        if not edit_request.chunk_id:
+            # A {"id": None} chunk query would list the whole chunk
+            # table — reject before touching the DAO.
+            return Result.failed(code="E000X", msg="chunk_id can not be empty")
+        # The target chunk must belong to the named space, otherwise a
+        # caller could modify chunks of any space by passing an arbitrary
+        # space_name in the path.
+        found = service.get_chunk_list({"id": edit_request.chunk_id})
+        if not found:
+            return Result.failed(
+                code="E000X",
+                msg=f"chunk {edit_request.chunk_id} can not be found",
+            )
+        document = service.get_document({"id": found[0].document_id})
+        if document is None or document.space != space_name:
+            return Result.failed(
+                code="E000X",
+                msg=f"chunk {edit_request.chunk_id} does not belong to "
+                f"knowledge_space {space_name}",
+            )
         serve_request = ChunkServeRequest(**edit_request.dict())
         serve_request.id = edit_request.chunk_id
         return Result.succ(service.update_chunk(request=serve_request))
     except Exception as e:
         return Result.failed(code="E000X", msg=f"document chunk edit error {e}")
 
 
-@router.post("/knowledge/{vector_name}/query")
-def similarity_query(space_name: str, query_request: KnowledgeQueryRequest):
+@router.post("/knowledge/{space_name}/query")
+def similarity_query(
+    space_name: str,
+    query_request: KnowledgeQueryRequest,
+    service: Service = Depends(get_rag_service),
+):
     print(f"Received params: {space_name}, {query_request}")
+    # The route historically declared {vector_name} while the handler
+    # read a *query* parameter named space_name, silently discarding the
+    # path value. The space in the path is authoritative and must exist.
+    space = service.get({"name": space_name})
+    if space is None:
+        return Result.failed(
+            code="E000X",
+            msg=f"knowledge_space {space_name} can not be found",
+        )
     storage_manager = StorageManager.get_instance(CFG.SYSTEM_APP)
     vector_store_connect
```

**File**: `packages/dbgpt-app/src/dbgpt_app/tests/test_knowledge_space_scoping.py` (added, +328/-0)
```diff
@@ -0,0 +1,328 @@
+"""Space-scoping tests for the v1 knowledge endpoints.
+
+Locks two security-relevant behaviors:
+
+1. ``/knowledge/{space_name}/chunk/list`` and ``/chunk/edit`` must only
+   see/modify chunks belonging to ``space_name`` — the path parameter is
+   the authorization boundary, not a decoration.
+2. ``/knowledge/{space_name}/query`` must take the space from the URL
+   path. The historic route declared ``{vector_name}`` while the handler
+   signature expected a ``space_name`` query parameter, silently
+   dropping the path value.
+
+``{space_name}``-scoped responses must keep their existing envelope
+(``Result.succ``/``Result.failed`` and ``ChunkQueryResponse`` shapes)
+so the web UI (which always sends a real space name in the path) keeps
+working unchanged.
+"""
+
+from types import SimpleNamespace
+from unittest.mock import Mock
+
+from fastapi import FastAPI
+from fastapi.testclient import TestClient
+
+import dbgpt_app.knowledge.api as knowledge_api
+from dbgpt.util import PaginationResult
+from dbgpt_app.knowledge.api import (
+    chunk_edit,
+    chunk_list,
+    get_rag_service,
+)
+from dbgpt_app.knowledge.api import (
+    router as knowledge_router,
+)
+from dbgpt_app.knowledge.request.request import (
+    ChunkEditRequest,
+    ChunkQueryRequest,
+)
+from dbgpt_serve.rag.api.schemas import ChunkServeResponse
+
+
+def _space(name="space_a", space_id=1):
+    return SimpleNamespace(id=space_id, name=name)
+
+
+def _fake_service(
+    *,
+    space=None,
+    documents=(),
+    chunk_page=None,
+    chunk=None,
+    chunk_document=None,
+    updated=Mock(),
+):
+    """Build a fake rag Service covering the methods the endpoints use."""
+
+    def get_document_list(req):
+        docs = list(documents)
+        if req.get("id") is not None:
+            docs = [d for d in docs if d.id == req["id"]]
+        return docs
+
+    service = Mock()
+    service.get = lambda req: (
+        space if (req or {}).get("name") == (space and space.name) else None
+    )
+    service.get_document_list = get_document_list
+    service.get_chunk_list_page = Mock(return_value=chunk_page)
+    service.get_chunk_list = lambda req: [chunk] if chunk else []
+    service.get_document = lambda req: chunk_document
+    service.update_chunk = updated
+    return service
+
+
+class TestChunkListScoping:
+    def test_unknown_space_name_is_rejected(self):
+        service = _fake_service(space=None)
+
+        result = chunk_list(
+            "no_such_space",
+            ChunkQueryRequest(page=1, page_size=20),
+            service,
+        )
+
+        assert result.success is False
+        service.get_chunk_list_page.assert_not_called()
+
+    def test_chunks_are_scoped_to_the_space_documents(self):
+        documents = [SimpleNamespace(id=11), SimpleNamespace(id=22)]
+        chunk_page = PaginationResult(
+            items=[ChunkServeResponse(id=1, document_id=11, content="chunk of doc 11")],
+            total_count=1,
+            total_pages=1,
+            page=1,
+            page_size=20,
+        )
+        service = _fake_service(
+            space=_space(), documents=documents, chunk_page=chunk_page
+        )
+
+        result = chunk_list("space_a", ChunkQueryRequest(page=1, page_size=20), service)
+
+        assert result.success is True
+        assert result.data.total == 1
+        kwargs = service.get_chunk_list_page.call_args.kwargs
+        assert kwargs["document_ids"] == [11, 22]
+
+    def test_document_id_from_another_space_returns_no_chunks(self):
+        # space_a contains doc 11 only; a caller asking for doc 99
+        # (belonging to another space) must get an empty result, not the
+        # other space's chunks.
+        documents = [SimpleNamespace(id=11)]
+        service = _fake_service(space=_space(), documents=documents)
+
+        result = chunk_list(
+            "space_a",
+            ChunkQueryRequest(document_id=99, page=1, page_size=20),
+            service,
+        )
+

```

**File**: `packages/dbgpt-serve/src/dbgpt_serve/evaluate/service/benchmark/benchmark_service.py` (modified, +50/-7)
```diff
@@ -66,6 +66,50 @@
 BENCHMARK_OUTPUT_RESULT_PATH = os.path.join(BENCHMARK_DATA_ROOT_PATH, "result")
 
 
+def generate_confined_output_path(
+    output_file_path: str,
+    evaluate_code: str,
+    root: Optional[str] = None,
+) -> str:
+    """Build the benchmark result path, confined under ``root``.
+
+    ``output_file_path`` and ``evaluate_code`` both come from the HTTP
+    request; unconfined they flow into ``mkdir(parents=True)`` +
+    ``workbook.save`` and give an arbitrary directory writer (VULN
+    5515). The final path must therefore resolve strictly under the
+    benchmark result root, and ``evaluate_code`` may only contribute a
+    single path component.
+
+    Raises:
+        ValueError: when either input is empty, ``evaluate_code`` is a
+            path-escape token, or the joined path resolves outside
+            ``root`` (``root`` defaults to
+            ``BENCHMARK_OUTPUT_RESULT_PATH``).
+    """
+    if not (output_file_path and output_file_path.strip()) or not (
+        evaluate_code and evaluate_code.strip()
+    ):
+        raise ValueError("output_file_path and evaluate_code must be non-empty")
+
+    safe_evaluate_code = os.path.basename(evaluate_code.strip())
+    if safe_evaluate_code in ("", ".", ".."):
+        raise ValueError(
+            f"evaluate_code is not a usable path component: {evaluate_code!r}"
+        )
+
+    confine_root = Path(root or BENCHMARK_OUTPUT_RESULT_PATH).resolve()
+    output_base_file_name = (
+        f"{datetime.now().strftime('%Y%m%d%H%M')}_multi_round_benchmark_result.xlsx"
+    )
+    candidate = Path(output_file_path) / safe_evaluate_code / output_base_file_name
+    resolved = candidate.resolve()
+    if confine_root not in resolved.parents:
+        raise ValueError(
+            f"benchmark output path must stay under {confine_root}, got: {resolved}"
+        )
+    return str(resolved)
+
+
 def get_rag_service(system_app) -> RagService:
     return system_app.get_component("dbgpt_rag_service", RagService)
 
@@ -199,7 +243,11 @@ def _generate_output_file_full_path(
     ) -> str:
         """
         Generate the complete output file path,
-        including the evaluate_code subfolder and default filename
+        including the evaluate_code subfolder and default filename.
+
+        Both parameters originate from the HTTP request, so the result
+        is confined under BENCHMARK_OUTPUT_RESULT_PATH by
+        generate_confined_output_path.
 
         Args:
             output_file_path: Base path of the output file
@@ -211,12 +259,7 @@ def _generate_output_file_full_path(
         if not output_file_path or not evaluate_code:
             return output_file_path
 
-        base_path = Path(output_file_path)
-        output_base_file_name = (
-            f"{datetime.now().strftime('%Y%m%d%H%M')}_multi_round_benchmark_result.xlsx"
-        )
-        new_path = base_path / evaluate_code / output_base_file_name
-        return str(new_path)
+        return generate_confined_output_path(output_file_path, evaluate_code)
 
     async def run_dataset_benchmark(
         self,
```

**File**: `packages/dbgpt-serve/src/dbgpt_serve/evaluate/service/benchmark/sql_guard.py` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+"""Read-only SQL guard for the benchmark pipeline.
+
+The benchmark flow extracts a SQL statement from an LLM/agent HTTP
+response (``_post_sql_query``) and executes it against the benchmark
+SQLite database. That text is attacker-influenceable — in AGENT mode
+the attacker controls the HTTP response outright — so it must never be
+trusted as arbitrary SQL. Previously verified exploitation paths
+included
+
+* stacked statements via a second statement after a ``;``,
+* ``ATTACH DATABASE '/any/path' AS x`` creating/opening arbitrary
+  SQLite files (the attachment persists on the pooled connection, so a
+  follow-up statement can write through it),
+* plain DDL/DML against the shared benchmark database,
+* ``WITH``-prefixed DML: SQLite's grammar allows ``WITH ... INSERT /
+  UPDATE / DELETE / REPLACE INTO`` — starting with ``WITH`` does NOT
+  make a statement read-only.
+
+The guard therefore applies two independent checks on the top-level
+token stream (string literals and comments excluded): the first
+keyword must be ``SELECT`` or ``WITH``, and no top-level token may be a
+write keyword (``REPLACE`` is only rejected in its ``REPLACE INTO``
+DML form — ``REPLACE(...)`` is a legit string function).
+"""
+
+import logging
+from typing import Iterator, List
+
+logger = logging.getLogger(__name__)
+
+_ALLOWED_FIRST_KEYWORDS = frozenset({"SELECT", "WITH"})
+
+_WRITE_KEYWORDS = frozenset(
+    {
+        "INSERT",
+        "UPDATE",
+        "DELETE",
+        "CREATE",
+        "DROP",
+        "ROLLBACK",
+        "ALTER",
+        "ATTACH",
+        "DETACH",
+        "PRAGMA",
+        "VACUUM",
+        "REINDEX",
+        "ANALYZE",
+        "EXPLAIN",
+        "BEGIN",
+        "COMMIT",
+        "SAVEPOINT",
+        "RELEASE",
+    }
+)
+# REPLACE(...) is a string function; only the DML form is a write.
+_WRITE_KEYWORD_PAIRS = {("REPLACE", "INTO")}
+
+
+def _iter_top_level(sql: str) -> Iterator[str]:
+    """Yield characters of ``sql`` that are top-level SQL tokens.
+
+    Skips comments and the contents of quoted literals/identifiers
+    (honoring doubled-quote escapes). Characters inside quotes therefore
+    never contribute keywords or statement separators. Removed comments
+    yield a space: SQLite treats a comment as a token boundary, so
+    ``REPLACE/**/INTO`` must tokenize as two words — not merge into
+    ``REPLACEINTO`` (which would bypass the multi-word write check).
+    """
+    i, n = 0, len(sql)
+    while i < n:
+        c = sql[i]
+        # line comment
+        if c == "-" and i + 1 < n and sql[i + 1] == "-":
+            j = sql.find("\n", i)
+            i = n if j == -1 else j + 1
+            yield " "
+            continue
+        # block comment
+        if c == "/" and i + 1 < n and sql[i + 1] == "*":
+            j = sql.find("*/", i + 2)
+            i = n if j == -1 else j + 2
+            yield " "
+            continue
+        # quoted literal / quoted identifier / bracketed identifier
+        if c in ("'", '"', "`", "["):
+            closer = "]" if c == "[" else c
+            i += 1
+            while i < n:
+                if sql[i] == closer:
+                    # doubled quote inside the literal = escaped quote
+                    if i + 1 < n and sql[i + 1] == closer:
+                        i += 2
+                        continue
+                    i += 1
+                    break
+                i += 1
+            continue
+        yield c
+        i += 1
+
+
+def validate_read_only_sql(sql: str) -> str:
+    """Validate that ``sql`` is a single read-only statement.
+
+    Only a leading ``SELECT``/``WITH`` is allowed, no top-level write
+    keyword may occur anywhere in the statement (catches
+    ``WITH ... INSERT``), and no second statement may follow the
+    (optional, trailing) semicolon. Returns ``sql`` unchanged on success
+    so callers can log the validated statement; raises ``ValueError``
+    otherwise.
+    """
+    if not isinstan
```

---

### Incident Patch 2: `fc6a5017` (2026-09-28)
**Commit Message**: fix: fix skills upload security (#3270)

Co-authored-by: alan.cl <alan.cl@antgroup.com>
Co-authored-by: Claude <noreply@anthropic.com>

**File**: `packages/dbgpt-app/src/dbgpt_app/openapi/api_v1/agentic_data_api.py` (modified, +47/-5)
```diff
@@ -8,7 +8,7 @@
 import tempfile
 import uuid
 import zipfile
-from pathlib import Path
+from pathlib import Path, PurePosixPath, PureWindowsPath
 from typing import TYPE_CHECKING, Any, AsyncGenerator, Dict, List, Optional, Tuple
 from urllib.parse import urlparse
 
@@ -77,6 +77,23 @@
 )
 
 
+def _validate_upload_filename(filename: str) -> str:
+    if "\x00" in filename:
+        raise ValueError("filename must not contain null bytes")
+
+    posix_path = PurePosixPath(filename)
+    windows_path = PureWindowsPath(filename)
+    if (
+        posix_path.is_absolute()
+        or windows_path.is_absolute()
+        or len(posix_path.parts) != 1
+        or len(windows_path.parts) != 1
+        or filename in {"", ".", ".."}
+    ):
+        raise ValueError("filename must be a plain file name")
+    return filename
+
+
 async def _resolve_model_context_tokens(
     llm_client: Any, model_name: Optional[str]
 ) -> Optional[int]:
@@ -574,7 +591,11 @@ async def skill_upload(
     user_dir = skills_dir / "user"
     user_dir.mkdir(parents=True, exist_ok=True)
 
-    filename = file.filename
+    try:
+        filename = _validate_upload_filename(file.filename)
+    except ValueError as exc:
+        return Result.failed(code="E4002", msg=str(exc))
+
     suffix = Path(filename).suffix.lower()
     stem = Path(filename).stem
 
@@ -757,7 +778,8 @@ def _extract_skill_from_zip(
         the top-level archive directory name.
 
     Raises:
-        ValueError: If the archive contains path-traversal sequences.
+        ValueError: If the archive contains path-traversal or absolute
+            entries.
         ValueError: If no ``SKILL.md`` is found after extraction (only when
             ``strict=True``).
         ValueError: If the archive root contains multiple sub-directories with
@@ -767,10 +789,23 @@ def _extract_skill_from_zip(
     with zipfile.ZipFile(zip_path, "r") as zf:
         all_names = zf.namelist()
 
-        # Security: reject any path-traversal entries
+        # Security: reject any path-traversal or absolute entries
         for name in all_names:
             normalized = os.path.normpath(name)
-            if normalized.startswith("..") or ".." in normalized.split(os.sep):
+            if (
+                normalized.startswith("..")
+                or ".." in normalized.split(os.sep)
+                # Absolute entry names ("/tmp/x", "C:\x"): "dest_dir / rel"
+                # discards the base entirely for absolute paths (pathlib
+                # semantics), giving an arbitrary file write.
+                or PurePosixPath(name).is_absolute()
+                or PureWindowsPath(name).is_absolute()
+                # "top//tmp/x" collapses under normpath, but the raw member is
+                # sliced on skill_prefix below, leaving a leading "/" in rel.
+                or "//" in name
+                # Windows separators must not leak into host path joins.
+                or "\\" in name
+            ):
                 raise ValueError(f"Unsafe path in archive: {name!r}")
 
         # Filter out macOS metadata artifacts before analysing structure
@@ -840,6 +875,13 @@ def _extract_skill_from_zip(
             if not rel:
                 continue
             target = dest_dir / rel
+            try:
+                # Containment guard: even if a member name slipped past the
+                # scan above, an entry whose join escapes dest_dir must be
+                # rejected before anything is written.
+                target.relative_to(dest_dir)
+            except ValueError:
+                raise ValueError(f"Unsafe path in archive: {member!r}") from None
             if member.endswith("/"):
                 target.mkdir(parents=True, exist_ok=True)
             else:
```

**File**: `packages/dbgpt-app/src/dbgpt_app/tests/test_skill_upload_api.py` (modified, +103/-0)
```diff
@@ -1,3 +1,6 @@
+import io
+import zipfile
+
 import pytest
 
 from dbgpt_serve.utils.auth import UserRequest
@@ -13,6 +16,15 @@ async def read(self) -> bytes:
         return self._content
 
 
+def _zip_bytes(members: dict) -> bytes:
+    """Build an in-memory zip archive from {entry_name: content}."""
+    buf = io.BytesIO()
+    with zipfile.ZipFile(buf, "w") as zf:
+        for name, content in members.items():
+            zf.writestr(name, content)
+    return buf.getvalue()
+
+
 def _configure_skill_paths(tmp_path, monkeypatch):
     from dbgpt_app.openapi.api_v1 import agentic_data_api
 
@@ -87,3 +99,94 @@ async def test_skill_upload_accepts_plain_filename(tmp_path, monkeypatch):
     assert (
         skills_dir / "user" / "hello" / "hello.py"
     ).read_bytes() == b"print('hello')"
+
+
+@pytest.mark.asyncio
+async def test_skill_upload_accepts_valid_zip_package(tmp_path, monkeypatch):
+    agentic_data_api, _, skills_dir = _configure_skill_paths(tmp_path, monkeypatch)
+
+    result = await agentic_data_api.skill_upload(
+        FakeUploadFile(
+            "demo.zip",
+            _zip_bytes(
+                {
+                    "demo/SKILL.md": "# demo skill",
+                    "demo/notes/usage.md": "usage notes",
+                }
+            ),
+        ),
+        UserRequest(user_id="alice"),
+    )
+
+    assert result.success is True
+    assert result.data["file_path"] == "user/demo"
+    assert (skills_dir / "user" / "demo" / "SKILL.md").exists()
+    assert (skills_dir / "user" / "demo" / "notes" / "usage.md").exists()
+
+
+@pytest.mark.asyncio
+async def test_skill_upload_rejects_absolute_zip_entry(tmp_path, monkeypatch):
+    agentic_data_api, _, _ = _configure_skill_paths(tmp_path, monkeypatch)
+    outside_path = tmp_path / "pwned.py"
+
+    result = await agentic_data_api.skill_upload(
+        FakeUploadFile(
+            "evil.zip",
+            _zip_bytes(
+                {
+                    "demo/SKILL.md": "# demo skill",
+                    str(outside_path): "PWNED",  # absolute entry name
+                }
+            ),
+        ),
+        UserRequest(user_id="alice"),
+    )
+
+    assert result.success is False
+    assert not outside_path.exists()
+
+
+@pytest.mark.asyncio
+async def test_skill_upload_rejects_double_slash_zip_entry(tmp_path, monkeypatch):
+    agentic_data_api, _, _ = _configure_skill_paths(tmp_path, monkeypatch)
+    outside_path = tmp_path / "pwned.py"
+
+    result = await agentic_data_api.skill_upload(
+        FakeUploadFile(
+            "evil.zip",
+            _zip_bytes(
+                {
+                    "demo/SKILL.md": "# demo skill",
+                    # "demo//<abs path>" passes normpath (".."-free) but the
+                    # raw member sliced at "demo/" leaves a leading "/".
+                    f"demo//{outside_path}": "PWNED",
+                }
+            ),
+        ),
+        UserRequest(user_id="alice"),
+    )
+
+    assert result.success is False
+    assert not outside_path.exists()
+
+
+@pytest.mark.asyncio
+async def test_skill_upload_rejects_windows_sep_zip_entry(tmp_path, monkeypatch):
+    agentic_data_api, _, _ = _configure_skill_paths(tmp_path, monkeypatch)
+    outside_path = tmp_path / "pwned.py"
+
+    result = await agentic_data_api.skill_upload(
+        FakeUploadFile(
+            "evil.zip",
+            _zip_bytes(
+                {
+                    "demo/SKILL.md": "# demo skill",
+                    f"demo/..\\..\\{outside_path.name}": "PWNED",  # win separators
+                }
+            ),
+        ),
+        UserRequest(user_id="alice"),
+    )
+
+    assert result.success is False
+    assert not outside_path.exists()
```

---

### Incident Patch 3: `3e7333a4` (2026-09-26)
**Commit Message**: fix(skills): add the missing imports to the skill implementation guide (#3226)

Signed-off-by: Anai-Guo <antai12232931@outlook.com>

**File**: `skills/skill_implementation_guide.py` (modified, +4/-0)
```diff
@@ -8,9 +8,13 @@
 # 1. Basic Skill Definition
 # ============================================================================
 
+import asyncio
+from typing import Dict, List, Optional
+
 from dbgpt.agent.skill import (
     Skill,
     SkillBuilder,
+    SkillMetadata,
     SkillType,
 )
 from dbgpt.core import PromptTemplate
```

---

### Incident Patch 4: `fbea7ba9` (2026-09-26)
**Commit Message**: fix(serve): require API key on connector confirm endpoints (#3264)

**File**: `packages/dbgpt-serve/src/dbgpt_serve/connector/api/endpoints.py` (modified, +68/-3)
```diff
@@ -1,9 +1,11 @@
 """REST API endpoints for connector management."""
 
 import logging
+from functools import cache
 from typing import Any, Dict, List, Optional
 
-from fastapi import APIRouter, Depends, HTTPException, Query
+from fastapi import APIRouter, Depends, HTTPException, Query, Request
+from fastapi.security.http import HTTPAuthorizationCredentials, HTTPBearer
 from pydantic import BaseModel
 
 from dbgpt.component import SystemApp
@@ -32,6 +34,69 @@ def get_service() -> ConnectorService:
     )
 
 
+get_bearer_token = HTTPBearer(auto_error=False)
+
+
+@cache
+def _parse_api_keys(api_keys: str) -> List[str]:
+    """Parse the string api keys to a list
+
+    Args:
+        api_keys (str): The string api keys
+
+    Returns:
+        List[str]: The list of api keys
+    """
+    if not api_keys:
+        return []
+    return [key.strip() for key in api_keys.split(",")]
+
+
+async def check_api_key(
+    auth: Optional[HTTPAuthorizationCredentials] = Depends(get_bearer_token),
+    request: Request = None,
+    service: ConnectorService = Depends(get_service),
+) -> Optional[str]:
+    """Check the api key
+
+    If the api key is not set, allow all.
+
+    Your can pass the token in you request header like this:
+
+    .. code-block:: python
+
+        import requests
+
+        client_api_key = "your_api_key"
+        headers = {"Authorization": "Bearer " + client_api_key}
+        res = requests.get("http://test/hello", headers=headers)
+        assert res.status_code == 200
+
+    """
+    if request.url.path.startswith("/api/v1"):
+        return None
+
+    # for api_version in serve.serve_versions():
+    if service.config.api_keys:
+        api_keys = _parse_api_keys(service.config.api_keys)
+        if auth is None or (token := auth.credentials) not in api_keys:
+            raise HTTPException(
+                status_code=401,
+                detail={
+                    "error": {
+                        "message": "",
+                        "type": "invalid_request_error",
+                        "param": None,
+                        "code": "invalid_api_key",
+                    }
+                },
+            )
+        return token
+    else:
+        # api_keys not set; allow all
+        return None
+
+
 # Synthetic catalog entry for user-defined custom MCP servers.
 # Kept in sync with CustomMcpForm (Task F) on the frontend.
 # Note: auth_fields here include extra keys (`options`, `default`) beyond the
@@ -166,14 +231,14 @@ class ConfirmRequest(BaseModel):
 # IMPORTANT: keep these fixed-path routes BEFORE any "/{connector_id}" routes,
 # otherwise FastAPI matches /{connector_id} first and treats "pending-confirms" /
 # "confirm" as a connector_id value.
-@router.get("/pending-confirms")
+@router.get("/pending-confirms", dependencies=[Depends(check_api_key)])
 async def list_pending_confirms() -> List[dict]:
     from dbgpt.agent.resource.connector.confirmation import _PENDING_CONFIRMATIONS
 
     return list(_PENDING_CONFIRMATIONS.values())
 
 
-@router.post("/confirm")
+@router.post("/confirm", dependencies=[Depends(check_api_key)])
 async def confirm_action(request: ConfirmRequest) -> Dict[str, str]:
     from dbgpt.agent.resource.connector.manager import ConnectorManager as _CM
 
```

**File**: `packages/dbgpt-serve/src/dbgpt_serve/connector/tests/test_endpoints.py` (added, +122/-0)
```diff
@@ -0,0 +1,122 @@
+import pytest
+from fastapi import FastAPI
+from httpx import AsyncClient
+
+from dbgpt.agent.resource.connector.confirmation import _PENDING_CONFIRMATIONS
+from dbgpt.component import SystemApp
+from dbgpt.storage.metadata import db
+from dbgpt_serve.core import BaseServeConfig
+from dbgpt_serve.core.tests.conftest import asystem_app, client  # noqa: F401
+
+from ..api.endpoints import init_endpoints, router
+from ..config import ServeConfig
+
+_APP_CONFIG = {"app_config": {"dbgpt.app.global.encrypt_key": "test_encrypt_key"}}
+
+_PENDING_ENTRY = {
+    "confirm_id": "confirm-1",
+    "connector_id": "conn-1",
+    "tool_name": "delete_repo",
+    "args_summary": "repo='dbgpt'",
+}
+
+_INVALID_API_KEY = {
+    "detail": {
+        "error": {
+            "message": "",
+            "type": "invalid_request_error",
+            "param": None,
+            "code": "invalid_api_key",
+        }
+    }
+}
+
+
+@pytest.fixture(autouse=True)
+def setup_and_teardown():
+    db.init_db("sqlite:///:memory:")
+    db.create_all()
+    _PENDING_CONFIRMATIONS.clear()
+    _PENDING_CONFIRMATIONS["confirm-1"] = dict(_PENDING_ENTRY)
+
+    yield
+
+    _PENDING_CONFIRMATIONS.clear()
+
+
+@pytest.fixture
+def config(request):
+    param = getattr(request, "param", {})
+    return ServeConfig(api_keys=param.get("api_keys"))
+
+
+def client_init_caller(app: FastAPI, system_app: SystemApp, config: BaseServeConfig):
+    app.include_router(router)
+    init_endpoints(system_app, config)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "client, asystem_app, config, has_auth",
+    [
+        (
+            {"app_caller": client_init_caller},
+            _APP_CONFIG,
+            {"api_keys": "secret1"},
+            False,
+        ),
+        (
+            {"app_caller": client_init_caller, "client_api_key": "wrong_token"},
+            _APP_CONFIG,
+            {"api_keys": "secret1"},
+            False,
+        ),
+        (
+            {"app_caller": client_init_caller, "client_api_key": "secret1"},
+            _APP_CONFIG,
+            {"api_keys": "secret1"},
+            True,
+        ),
+    ],
+    indirect=["client", "asystem_app", "config"],
+)
+async def test_pending_confirms_requires_api_key(
+    client: AsyncClient, asystem_app, config, has_auth: bool
+):
+    response = await client.get("/pending-confirms")
+    if has_auth:
+        assert response.status_code == 200
+        assert response.json() == [_PENDING_ENTRY]
+    else:
+        assert response.status_code == 401
+        assert response.json() == _INVALID_API_KEY
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "client, asystem_app, config",
+    [({"app_caller": client_init_caller}, _APP_CONFIG, {"api_keys": "secret1"})],
+    indirect=["client", "asystem_app", "config"],
+)
+async def test_confirm_requires_api_key(client: AsyncClient, asystem_app, config):
+    response = await client.post(
+        "/confirm", json={"confirm_id": "confirm-1", "approved": True}
+    )
+    assert response.status_code == 401
+    assert response.json() == _INVALID_API_KEY
+    # The request must be rejected before the handler touches the queue.
+    assert "confirm-1" in _PENDING_CONFIRMATIONS
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "client, asystem_app, config",
+    [({"app_caller": client_init_caller}, _APP_CONFIG, {})],
+    indirect=["client", "asystem_app", "config"],
+)
+async def test_pending_confirms_allows_all_without_api_keys(
+    client: AsyncClient, asystem_app, config
+):
+    response = await client.get("/pending-confirms")
+    assert response.status_code == 200
+    assert response.json() == [_PENDING_ENTRY]
```

---

### Incident Patch 5: `0db3d68f` (2026-09-26)
**Commit Message**: fix(rag): load formula results instead of formulas from Excel files (#3266)

**File**: `packages/dbgpt-ext/src/dbgpt_ext/rag/knowledge/excel.py` (modified, +3/-1)
```diff
@@ -126,7 +126,9 @@ def _load(self) -> List[Document]:
         try:
             import openpyxl
 
-            workbook = openpyxl.load_workbook(self._path)
+            # data_only reads the result Excel saved for a formula cell, not the
+            # formula text, the same as pandas.read_excel.
+            workbook = openpyxl.load_workbook(self._path, data_only=True)
         except Exception as e:
             raise IOError(f"Could not load Excel file with openpyxl: {e}")
 
```

**File**: `packages/dbgpt-ext/src/dbgpt_ext/rag/knowledge/tests/test_excel.py` (modified, +42/-0)
```diff
@@ -1,3 +1,6 @@
+import re
+import zipfile
+
 import openpyxl
 import pytest
 
@@ -31,6 +34,37 @@ def numeric_only_xlsx(tmp_path):
     return str(path)
 
 
+@pytest.fixture
+def formula_xlsx(tmp_path):
+    """A workbook as Excel saves it: a formula cell also stores its result."""
+    raw = tmp_path / "raw.xlsx"
+    wb = openpyxl.Workbook()
+    ws = wb.active
+    ws.title = "Prices"
+    ws.append(["item", "price", "with tax"])
+    ws.append(["apple", 3, "=B2*1.2"])
+    ws.append(["total", "=SUM(B2:B2)", "=C2"])
+    wb.save(raw)
+    # openpyxl writes formulas without a result, so add the <v> Excel writes.
+    results = {"C2": "3.6", "B3": "3", "C3": "3.6"}
+    path = tmp_path / "formulas.xlsx"
+    with zipfile.ZipFile(raw) as src, zipfile.ZipFile(path, "w") as dst:
+        for item in src.infolist():
+            data = src.read(item.filename)
+            if item.filename == "xl/worksheets/sheet1.xml":
+                xml = data.decode()
+                for ref, value in results.items():
+                    xml, count = re.subn(
+                        rf'(<c r="{ref}"[^>]*><f>[^<]*</f>)(<v\s*/>|<v></v>)?',
+                        rf"\1<v>{value}</v>",
+                        xml,
+                    )
+                    assert count == 1
+                data = xml.encode()
+            dst.writestr(item, data)
+    return str(path)
+
+
 def test_load_reads_all_sheets(multi_sheet_xlsx):
     knowledge = ExcelKnowledge(file_path=multi_sheet_xlsx)
     docs = knowledge._load()
@@ -42,3 +76,11 @@ def test_load_does_not_crash_without_header_row(numeric_only_xlsx):
     knowledge = ExcelKnowledge(file_path=numeric_only_xlsx)
     docs = knowledge._load()
     assert len(docs) == 6
+
+
+def test_load_reads_formula_results_not_formulas(formula_xlsx):
+    docs = ExcelKnowledge(file_path=formula_xlsx)._load()
+    assert [doc.content for doc in docs] == [
+        "item: apple\nprice: 3\nwith tax: 3.6",
+        "item: total\nprice: 3\nwith tax: 3.6",
+    ]
```

---

### Incident Patch 6: `ad2faacc` (2026-09-26)
**Commit Message**: fix(app): restrict agent file download to the agent output directory (#3257)

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `packages/dbgpt-app/src/dbgpt_app/openapi/api_v1/agentic_data_api.py` (modified, +8/-5)
```diff
@@ -3745,6 +3745,7 @@ async def delete_share_link(
 @router.get("/v1/agent/files/download")
 async def download_agent_file(
     file_path: str = Query(..., description="Absolute path to the file to download"),
+    user_token: UserRequest = Depends(get_user_from_headers),
 ):
     """Download a file created by agent tools (shell_interpreter, code_interpreter).
 
@@ -3754,11 +3755,14 @@ async def download_agent_file(
     from fastapi import HTTPException
     from fastapi.responses import FileResponse
 
-    from dbgpt.configs.model_config import PILOT_PATH, ROOT_PATH
+    from dbgpt.configs.model_config import PILOT_PATH
+
+    # Agent tools write their output here, so relative paths resolve against it
+    # rather than against the installation root.
+    agent_tmp_dir = os.path.join(PILOT_PATH, "tmp")
 
-    # If path is not absolute, resolve relative to ROOT_PATH (sandbox working dir)
     if not os.path.isabs(file_path):
-        file_path = os.path.join(ROOT_PATH, file_path)
+        file_path = os.path.join(agent_tmp_dir, file_path)
 
     # Resolve to absolute path and prevent path traversal
     try:
@@ -3769,8 +3773,7 @@ async def download_agent_file(
     # Allowed base directories for agent-created files
     allowed_dirs = [
         os.path.realpath("/tmp"),
-        os.path.realpath(os.path.join(PILOT_PATH, "tmp")),
-        os.path.realpath(ROOT_PATH),
+        os.path.realpath(agent_tmp_dir),
     ]
 
     if not any(resolved.startswith(d + os.sep) or resolved == d for d in allowed_dirs):
```

---

### Incident Patch 7: `933be0eb` (2026-09-26)
**Commit Message**: docs(rag): fix the excel knowledge docstring parameter name (#3248)

### Description

The `ExcelKnowledge` docstring documents `source_column(str, optional)`
but the parameter is `source_columns` (used at line 47). Docstring-only
fix, AST-verified.

**File**: `packages/dbgpt-ext/src/dbgpt_ext/rag/knowledge/excel.py` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ def __init__(
         Args:
             file_path(str,  optional): file path
             knowledge_type(KnowledgeType, optional): knowledge type
-            source_column(str, optional): source column
+            source_columns (str, optional): source column
             encoding(str, optional): csv encoding
             loader(Any, optional): loader
         """
```

---

### Incident Patch 8: `3427483c` (2026-09-26)
**Commit Message**: docs(cookbook): fix the stale community_summary import path (#3254)

**File**: `docs/docs/cookbook/rag/graph_rag_app_develop.md` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ We created a knowledge graph with graph community summaries based on `CommunityS
 
 ```python
 from dbgpt.model.proxy.llms.chatgpt import OpenAILLMClient
-from dbgpt.storage.knowledge_graph.community_summary import (
+from dbgpt_ext.storage.knowledge_graph.community_summary import (
     CommunitySummaryKnowledgeGraph,
     CommunitySummaryKnowledgeGraphConfig,
 )
```

---

### Incident Patch 9: `560f909a` (2026-09-26)
**Commit Message**: docs(agent): fix evaluation docstrings documenting non-existent parameters (#3253)

**File**: `packages/dbgpt-serve/src/dbgpt_serve/agent/evaluation/evaluation.py` (modified, +2/-3)
```diff
@@ -27,8 +27,7 @@ class AgentOutputOperator(MapOperator):
     def __init__(self, app_code: str, **kwargs):
         """
         Args:
-            space_name (str): The space name.
-            recall_score (Optional[float], optional): The recall score. Defaults to 0.3.
+            app_code (str): The app code of the agent to evaluate.
         """
         self.app_code = app_code
         super().__init__(**kwargs)
@@ -94,7 +93,7 @@ async def _do_evaluation(
 
         Args:
             query(str): The query string.
-            prediction(List[str]): The retrieved chunks from the retriever.
+            prediction_result(dict): The prediction result returned by the agent.
             contexts(List[str]): The contexts from dataset.
             raw_dataset(Any): The raw data(single row) from dataset.
         """
```

---

### Incident Patch 10: `adcf4ebc` (2026-09-26)
**Commit Message**: fix(web): correct the garbled double_click_open locale string (#3250)

**File**: `web/locales/en/common.ts` (modified, +1/-1)
```diff
@@ -362,7 +362,7 @@ export const CommonEn = {
   input_tip: 'Please select the model and enter the description to start quickly',
   create_app: 'Create App',
   copy_url: 'Click the Copy Share link',
-  double_click_open: 'Double click on Nail nail to open',
+  double_click_open: 'Double click the DingTalk icon to open',
   construct: ' Construct App',
   Setting: 'Setting',
   chat_online: 'Chat',
```

#### Recent Merged Pull Requests:
- **PR #3271** (2026-09-28): fix: fix knowledge space scoping and benchmark security (@chenliang15405)
- **PR #3270** (2026-09-28): fix: fix skills upload security (@chenliang15405)
- **PR #3266** (2026-09-26): fix(rag): load formula results instead of formulas from Excel files (@L4XB)
- **PR #3264** (2026-09-26): fix(serve): require API key on connector confirm endpoints (@drakeo338)
- **PR #3261** (2026-09-26): docs: fix ReduceStreamOperator docstring parameter name (@yetuge)
- **PR #3260** (2026-09-26): docs: fix add_command docstring parameter name (@yetuge)
- **PR #3257** (2026-09-26): fix(app): restrict agent file download to the agent output directory (@AvAl4nch)
- **PR #3255** (closed): docs(config-reference): drop table rows whose generated pages do not exist (@simpleqt)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
