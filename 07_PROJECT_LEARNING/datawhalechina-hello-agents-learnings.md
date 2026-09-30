# Forensic Learning Record (Deep Inspection): datawhalechina/hello-agents

> **Canonical Artifact**: `07_PROJECT_LEARNING/datawhalechina-hello-agents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/datawhalechina/hello-agents](https://github.com/datawhalechina/hello-agents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:36:25.463Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `datawhalechina/hello-agents`
- **Description**: 📚 《从零开始构建智能体》——从零开始的智能体原理与实践教程
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 81427 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Co-creation-projects/939147533-DatabaseAgent/main.py`
```
"""
数据库Agent助手 - 主程序
演示如何使用DatabaseAgent进行自然语言查询
"""
import os
from dotenv import load_dotenv
from hello_agents import HelloAgentsLLM
from react_agent import DatabaseAgent, DatabaseConfig

load_dotenv()


def main():
    print("=" * 60)
    print("🤖 数据库Agent助手")
    print("=" * 60)
    
    llm = HelloAgentsLLM()
    
    db_config = DatabaseConfig()
    
    if not db_config.validate():
        print("❌ 数据库配置不完整，请检查.env文件")
        print("需要配置: DB_HOST, DB_PORT, DB_SERVICE_NAME, DB_USERNAME, DB_PASSWORD")
        return
    
    agent = DatabaseAgent(
        name="DatabaseAssistant",
        llm=llm,
        db_config=db_config,
        max_steps=5
    )
    
    print("\n📝 示例查询:")
    print("1. 查询所有员工信息")
    print("2. 查询工资大于5000的员工")
    print("3. 统计各部门的员工数量")
    print("4. 查询最近入职的5名员工")
    print("5. 退出")
    
    while True:
        print("\n" + "=" * 60)
        user_input = input("请输入您的查询 (或输入 '5' 退出): ").strip()
        
        if user_input.lower() in ['5', 'exit', 'quit', '退出']:
            print("👋 感谢使用数据库Agent助手！")
            break

        if not user_input:
            print("⚠️ 请输入有效的查询")
            continue
        
        try:
            result = agent.run(user_input)
            print("\n" + "=" * 60)
            print("📊 查询结果:")
            print("=" * 60)
            print(result)
        except Exception as e:
            print(f"❌ 执行查询时出错: {e}")


if __name__ == "__main__":
    main()
```

### Core Architecture Module: `Co-creation-projects/939147533-DatabaseAgent/src/config.py`
```
"""
数据库配置管理
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


class DatabaseConfig:
    """Oracle数据库配置类"""
    
    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        service_name: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None
    ):
        self.host = host or os.getenv("DB_HOST", "localhost")
        self.port = port or int(os.getenv("DB_PORT", "1521"))
        self.service_name = service_name or os.getenv("DB_SERVICE_NAME", "ORCL")
        self.username = username or os.getenv("DB_USERNAME", "system")
        self.password = password or os.getenv("DB_PASSWORD", "")
        
    def get_connection_string(self) -> str:
        """获取Oracle连接字符串"""
        return f"{self.username}/{self.password}@{self.host}:{self.port}/{self.service_name}"
    
    def validate(self) -> bool:
        """验证配置是否完整"""
        return all([self.host, self.port, self.service_name, self.username, self.password])
```

### Core Architecture Module: `Co-creation-projects/939147533-DatabaseAgent/src/react_agent.py`
```
"""
数据库Agent - 基于ReAct框架的智能数据库查询助手
"""
import re
from typing import Optional, List
from hello_agents import ReActAgent, HelloAgentsLLM, Config, Message, ToolRegistry
from tools import OracleQueryTool, SQLGeneratorTool, format_query_result
from config import DatabaseConfig


DATABASE_AGENT_PROMPT = """你是一个专业的数据库查询助手。你可以理解用户的自然语言查询，将其转换为SQL语句，从Oracle数据库中获取数据并格式化输出。

## 可用工具
{tools}

## 工作流程
请严格按照以下格式进行回应：

Thought: 你的思考过程，分析用户需求并规划下一步行动。
Action: 你决定采取的行动，必须是以下格式之一：
- `{{tool_name}}[{{tool_input}}]` - 调用指定工具
- `Finish[最终答案]` - 当你有足够信息给出最终答案时

## 使用指南
1. 当用户提出查询需求时，首先使用 GetSchema 工具获取数据库表结构
2. 使用 GenerateSQL 工具将自然语言转换为SQL语句
3. 使用 ExecuteQuery 工具执行SQL并获取结果

## 当前任务
**Question:** {question}

## 执行历史
{history}

现在开始你的推理和行动：
"""


class DatabaseAgent(ReActAgent):
    """数据库查询Agent"""
    
    def __init__(
        self,
        name: str,
        llm: HelloAgentsLLM,
        db_config: DatabaseConfig,
        system_prompt: Optional[str] = None,
        config: Optional[Config] = None,
        max_steps: int = 5
    ):
        super().__init__(name, llm, system_prompt, config)
        
        self.db_config = db_config
        self.max_steps = max_steps
        self.current_history: List[str] = []
        self.prompt_template = DATABASE_AGENT_PROMPT
        
        self.oracle_tool = OracleQueryTool(db_config)
        self.sql_generator = SQLGeneratorTool(llm)
        
        self.tool_registry = ToolRegistry()
        self.tool_registry.register_function(
            "GetSchema",
            "获取数据库表结构信息，包括所有表名和字段定义。",
            self._get_schema
        )
        self.tool_registry.register_function(
            "GenerateSQL",
            "将自然语言查询转换为Oracle SQL语句。",
            self._generate_sql
        )
        self.tool_registry.register_function(
            "ExecuteQuery",
            "执行SQL查询并返回结果。",
            self._execute_query
        )
        
        self.schema_cache = None
        print(f"✅ {name} 初始化完成，最大步数: {max_steps}")
    
    def _get_schema(self, input_text: str) -> str:
        """获取数据库表结构信息，包括所有表名和字段定义"""
        schema_info = self.oracle_tool.get_schema_info()
        self.schema_cache = schema_info
        return schema_info
    
    def _generate_sql(self, input_text: str) -> str:
        """将自然语言查询转换为Oracle SQL语句"""
        if not self.schema_cache:
            self.schema_cache = self.oracle_tool.get_schema_info()
        
        sql = self.sql_generator.generate_sql(input_text, self.schema_cache)
        
        is_valid, msg = self.sql_generator.validate_sql(sql)
        if not is_valid:
            return f"SQL生成失败: {msg}"
        
        return f"生成的SQL: {sql}"
    
    def _execute_query(self, input_text: str) -> str:
        """执行SQL查询并返回结果"""
        sql = input_text.strip()
        
        if sql.startswith("生成的SQL: "):
            sql = sql.replace("生成的SQL: ", "")
        
        result = self.oracle_tool.execute_query(sql)
        
        if not result["success"]:
            return f"查询执行失败: {result['error']}"
        
        formatted_result = format_query_result(result)
        return formatted_result
    
    def run(self, input_text: str, **kwargs) -> str:
        """运行数据库Agent"""
        self.current_history = []
        current_step = 0
        
        print(f"\n🤖 {self.name} 开始处理问题: {input_text}")
        
        while current_step < self.max_steps:
            current_step += 1
            print(f"\n--- 第 {current_step} 步 ---")
            # 1. 构建提示词
            tools_desc = self.tool_registry.get_tools_description()
            history_str = "\n".join(self.current_history)
            prompt = self.prompt_template.format(
                tools=tools_desc,
                question=input_text,
                history=history_str
            )
            # 2. 调用LLM
            messages = [{"role": "user", "content": prompt}]
            response_text = self.llm.invoke(messages, **kwargs)
            # 3. 解析输出
            thought, action = self._parse_output(response_text)
            
            if thought:
                print(f"🤔 思考: {thought}")
            
            if action and action.startswith("Finish"):
                final_answer = self._parse_action_input(action)
                self.add_message(Message(input_text, "user"))
                self.add_message(Message(final_answer, "assistant"))
                return final_answer
            
            if action:
                tool_name, tool_input = self._parse_action(action)
                observation = self.tool_registry.execute_tool(tool_name, tool_input)
                print(f"🎬 行动: {tool_name}[{tool_input}]")
                print(f"👀 观察: {observation}")
                self.current_history.append(f"Action: {action}")
                self.current_history.append(f"Observation: {observation}")
        
        final_answer = "抱歉，我无法在限定步数内完成这个任务。"
        self.add_message(Message(input_text, "user"))
        self.add_message(Message(final_answer, "assistant"))
        return final_answer
    
    def _parse_output(self, text: str):
        thought_match = re.search(r"Thought:\s*(.*?)(?=\nAction:|$)", text, re.DOTALL)
        action_match = re.search(r"Action:\s*(.*?)$", text, re.DOTALL)
        thought = thought_match.group(1).strip() if thought_match else None
        action = action_match.group(1).strip() if action_match else None
        return thought, action
    
    def _parse_action(self, action_text: str):
        match = re.match(r"(\w+)\[(.*)\]", action_text, re.DOTALL)
        return (match.group(1), match.group(2)) if match else (None, None)
    
    def _parse_action_input(self, action_text: str):
        match = re.match(r"\w+\[(.*)\]", action_text, re.DOTALL)
        return match.group(1) if match else ""
```

### Core Architecture Module: `Co-creation-projects/939147533-DatabaseAgent/src/tools.py`
```
"""
数据库查询工具集
"""
import oracledb
from typing import Dict, Any
from config import DatabaseConfig
from hello_agents import HelloAgentsLLM


class OracleQueryTool:
    """Oracle数据库查询工具"""
    
    def __init__(self, config: DatabaseConfig):
        self.config = config
        self.connection = None
        
    def connect(self) -> bool:
        """连接到Oracle数据库"""
        try:
            self.connection = oracledb.connect(
                user=self.config.username,
                password=self.config.password,
                host=self.config.host,
                port=self.config.port,
                service_name=self.config.service_name
            )
            return True
        except Exception as e:
            print(f"数据库连接失败: {e}")
            return False
    
    def disconnect(self):
        """断开数据库连接"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    def execute_query(self, sql: str) -> Dict[str, Any]:
        """执行SQL查询并返回结果"""
        if not self.connection:
            if not self.connect():
                return {"success": False, "error": "无法连接到数据库"}
        
        try:
            cursor = self.connection.cursor()
            cursor.execute(sql)
            
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            
            cursor.close()
            
            return {
                "success": True,
                "columns": columns,
                "rows": rows,
                "row_count": len(rows),
                "sql": sql
            }
        except Exception as e:
            return {"success": False, "error": str(e), "sql": sql}
    
    def get_schema_info(self) -> str:
        """获取数据库表结构信息"""
        if not self.connection:
            if not self.connect():
                return "无法连接到数据库"
        
        try:
            cursor = self.connection.cursor()
            
            cursor.execute("""
                SELECT table_name 
                FROM user_tables 
                ORDER BY table_name
            """)
            tables = [row[0] for row in cursor.fetchall()]
            
            schema_info = []
            for table in tables:
                cursor.execute(f"""
                    SELECT column_name, data_type, nullable
                    FROM user_tab_columns
                    WHERE table_name = UPPER('{table}')
                    ORDER BY column_id
                """)
                columns = cursor.fetchall()
                
                col_desc = ", ".join([
                    f"{col[0]} ({col[1]})" 
                    for col in columns
                ])
                schema_info.append(f"表 {table}: {col_desc}")
            
            cursor.close()
            return "\n".join(schema_info)
        except Exception as e:
            return f"获取表结构失败: {e}"


class SQLGeneratorTool:
    """SQL生成工具 - 使用LLM将自然语言转换为SQL"""
    
    def __init__(self, llm: HelloAgentsLLM):
        self.llm = llm
        self.system_prompt = """你是一个专业的SQL查询生成助手。你的任务是将用户的自然语言查询转换为准确的Oracle SQL语句。

# 规则:
1. 只返回SQL语句，不要包含任何解释或额外文字
2. 使用Oracle SQL语法
3. 表名和字段名使用大写
4. 日期格式使用 'YYYY-MM-DD'
5. 字符串使用单引号
6. 确保SQL语句安全，避免SQL注入

# 数据库表结构:
{schema_info}

# 示例:
用户输入: 查询所有员工信息
输出: SELECT * FROM EMPLOYEES

用户输入: 查询工资大于5000的员工
输出: SELECT * FROM EMPLOYEES WHERE SALARY > 5000

现在，请根据用户的自然语言输入生成对应的SQL语句。
"""
    
    def generate_sql(self, natural_query: str, schema_info: str) -> str:
        """生成SQL语句"""
        prompt = self.system_prompt.format(schema_info=schema_info)
        
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": natural_query}
        ]
        
        response = self.llm.invoke(messages)
        
        sql = response.strip()
        
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.startswith("```"):
            sql = sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
        
        return sql.strip()
    
    def validate_sql(self, sql: str) -> tuple[bool, str]:
        """验证SQL语句的基本语法"""
        sql_upper = sql.upper().strip()
        
        if not sql_upper.startswith(("SELECT", "WITH")):
            return False, "只允许SELECT查询语句"
        
        dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE"]
        for keyword in dangerous_keywords:
            if keyword in sql_upper:
                return False, f"不允许使用 {keyword} 语句"
        
        return True, "SQL语句验证通过"


def format_query_result(result: Dict[str, Any]) -> str:
    """格式化查询结果为表格"""
    if not result["success"]:
        return f"查询失败: {result['error']}"
    
    if result["row_count"] == 0:
        return "查询成功，但没有找到匹配的数据。"
    
    columns = result["columns"]
    rows = result["rows"]
    
    col_widths = []
    for i, col in enumerate(columns):
        max_width = max(len(str(col)), max(len(str(row[i])) for row in rows))
        col_widths.append(max_width + 2)
    
    separator = "+" + "+".join("-" * width for width in col_widths) + "+"
    
    header = "|" + "|".join(
        str(col).center(width) for col, width in zip(columns, col_widths)
    ) + "|"
    
    data_rows = []
    for row in rows:
        data_row = "|" + "|".join(
            str(cell).center(width) for cell, width in zip(row, col_widths)
        ) + "|"
        data_rows.append(data_row)
    
    table = [separator, header, separator] + data_rows + [separator]
    
    return "\n".join(table)
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/__init__.py`
```
"""
InnoCore AI - 研创·智核
Intelligent Research Innovation Assistant
"""

__version__ = "1.0.0"
__author__ = "InnoCore AI Team"
__description__ = "AI-powered research innovation assistant based on HelloAgent framework"

__all__ = [
    "__version__",
    "__author__", 
    "__description__"
]
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/__init__.py`
```
"""
InnoCore AI 智能体模块
"""

from .base import BaseAgent
from .hunter import HunterAgent
from .miner import MinerAgent
from .coach import CoachAgent
from .validator import ValidatorAgent
from .controller import AgentController

__all__ = [
    "BaseAgent",
    "HunterAgent",
    "MinerAgent", 
    "CoachAgent",
    "ValidatorAgent",
    "AgentController"
]
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/base.py`
```
"""
InnoCore AI 基础智能体类
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import json
import logging

from core.config import get_config
from core.llm_adapter import get_llm_adapter
from core.exceptions import AgentException, TimeoutException

logger = logging.getLogger(__name__)

class BaseAgent(ABC):
    """基础智能体抽象类"""
    
    def __init__(self, name: str, llm = None, 
                 max_steps: int = None, timeout: int = None):
        self.name = name
        self.config = get_config()
        self.llm = llm or get_llm_adapter()
        
        self.max_steps = max_steps or self.config.agent_max_steps
        self.timeout = timeout or self.config.agent_timeout
        
        self.history = []
        self.tools = {}
        self.state = "idle"
        self.created_at = datetime.now()
        
    @abstractmethod
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行智能体任务"""
        pass
    
    def add_tool(self, tool_name: str, tool_func: Callable, description: str = ""):
        """添加工具"""
        self.tools[tool_name] = {
            "function": tool_func,
            "description": description
        }
    
    def get_tools_description(self) -> str:
        """获取工具描述"""
        if not self.tools:
            return "暂无可用工具"
        
        descriptions = []
        for name, tool_info in self.tools.items():
            descriptions.append(f"- {name}: {tool_info['description']}")
        
        return "\n".join(descriptions)
    
    async def call_tool(self, tool_name: str, tool_input: Any) -> Any:
        """调用工具"""
        if tool_name not in self.tools:
            raise AgentException(f"工具 '{tool_name}' 不存在")
        
        try:
            tool_func = self.tools[tool_name]["function"]
            if asyncio.iscoroutinefunction(tool_func):
                result = await asyncio.wait_for(
                    tool_func(tool_input), 
                    timeout=self.timeout
                )
            else:
                result = await asyncio.wait_for(
                    asyncio.to_thread(tool_func, tool_input),
                    timeout=self.timeout
                )
            
            self._add_to_history(f"Tool {tool_name} called with input: {tool_input}")
            self._add_to_history(f"Tool {tool_name} result: {result}")
            
            return result
            
        except asyncio.TimeoutError:
            raise TimeoutException(f"工具 '{tool_name}' 执行超时")
        except Exception as e:
            raise AgentException(f"工具 '{tool_name}' 执行失败: {str(e)}")
    
    async def think(self, prompt: str, context: Dict = None) -> str:
        """调用LLM进行思考"""
        try:
            # 构建完整的提示词
            full_prompt = prompt
            
            # 添加上下文信息
            if context:
                context_str = json.dumps(context, ensure_ascii=False, indent=2)
                full_prompt = f"上下文信息:\n{context_str}\n\n任务:\n{prompt}"
            
            # 添加历史记录
            if self.history:
                history_str = "\n".join(self.history[-10:])  # 只保留最近10条
                full_prompt += f"\n\n历史记录:\n{history_str}"
            
            # 调用 HelloAgent LLM
            response = await asyncio.wait_for(
                self.llm.ainvoke(full_prompt),
                timeout=self.timeout
            )
            
            response_text = response.content if hasattr(response, 'content') else str(response)
            
            self._add_to_history(f"LLM prompt: {prompt}")
            self._add_to_history(f"LLM response: {response_text}")
            
            return response_text
            
        except asyncio.TimeoutError:
            raise TimeoutException("LLM思考超时")
        except Exception as e:
            raise AgentException(f"LLM思考失败: {str(e)}")
    
    def _add_to_history(self, message: str):
        """添加到历史记录"""
        timestamp = datetime.now().isoformat()
        self.history.append(f"[{timestamp}] {message}")
        
        # 限制历史记录长度
        if len(self.history) > 100:
            self.history = self.history[-50:]
    
    def get_history(self, limit: int = 10) -> List[str]:
        """获取历史记录"""
        return self.history[-limit:]
    
    def clear_history(self):
        """清空历史记录"""
        self.history = []
    
    def set_state(self, state: str):
        """设置智能体状态"""
        self.state = state
        logger.info(f"Agent {self.name} state changed to: {state}")
    
    def get_status(self) -> Dict[str, Any]:
        """获取智能体状态"""
        return {
            "name": self.name,
            "state": self.state,
            "created_at": self.created_at.isoformat(),
            "history_count": len(self.history),
            "tools_count": len(self.tools),
            "max_steps": self.max_steps,
            "timeout": self.timeout
        }
    
    async def validate_input(self, input_data: Dict[str, Any]) -> bool:
        """验证输入数据"""
        required_fields = self.get_required_fields()
        
        for field in required_fields:
            if field not in input_data:
                raise AgentException(f"缺少必需字段: {field}")
        
        return True
    
    @abstractmethod
    def get_required_fields(self) -> List[str]:
        """获取必需的输入字段"""
        pass
    
    def __str__(self) -> str:
        return f"{self.__class__.__name__}(name='{self.name}', state='{self.state}')"
    
    def __repr__(self) -> str:
        return self.__str__()
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/coach.py`
```
"""
InnoCore AI 写作助教 (Coach Agent)
负责风格迁移、实时润色、解释复杂概念
"""

import asyncio
import json
from typing import Dict, List, Optional, Any
from datetime import datetime

from agents.base import BaseAgent
from core.database import db_manager
from core.vector_store import vector_store_manager
from core.exceptions import AgentException

class CoachAgent(BaseAgent):
    """写作助教智能体"""
    
    def __init__(self, llm=None):
        super().__init__("Coach", llm)
        
        # 添加工具
        self.add_tool("explain_concept", self._explain_concept, "解释复杂概念")
        self.add_tool("polish_text", self._polish_text, "润色文本")
        self.add_tool("mimic_style", self._mimic_style, "模仿写作风格")
        self.add_tool("get_user_style", self._get_user_style, "获取用户写作风格")
        self.add_tool("suggest_improvements", self._suggest_improvements, "建议改进")
    
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行写作助教任务"""
        await self.validate_input(input_data)
        
        self.set_state("running")
        
        try:
            user_id = input_data["user_id"]
            task_type = input_data["task_type"]  # explain, polish, mimic, suggest
            content = input_data["content"]
            context = input_data.get("context", {})
            
            result = None
            
            if task_type == "explain":
                result = await self._handle_explain_task(user_id, content, context)
            elif task_type == "polish":
                result = await self._handle_polish_task(user_id, content, context)
            elif task_type == "mimic":
                result = await self._handle_mimic_task(user_id, content, context)
            elif task_type == "suggest":
                result = await self._handle_suggest_task(user_id, content, context)
            else:
                raise AgentException(f"不支持的任务类型: {task_type}")
            
            self.set_state("completed")
            
            return {
                "status": "success",
                "task_type": task_type,
                "user_id": user_id,
                "result": result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.set_state("error")
            raise AgentException(f"Coach Agent执行失败: {str(e)}")
    
    def get_required_fields(self) -> List[str]:
        """获取必需的输入字段"""
        return ["user_id", "task_type", "content"]
    
    async def _handle_explain_task(self, user_id: str, content: str, context: Dict) -> Dict[str, Any]:
        """处理解释任务"""
        try:
            # 获取用户的历史论文作为上下文
            user_context = await self._get_user_context(user_id)
            
            explain_prompt = f"""
            请用通俗易懂的语言解释以下内容：
            
            需要解释的内容：
            {content}
            
            上下文信息：
            {json.dumps(context, ensure_ascii=False, indent=2)}
            
            用户研究领域背景：
            {json.dumps(user_context, ensure_ascii=False, indent=2)}
            
            请提供：
            1. 简单易懂的解释
            2. 相关的例子或类比
            3. 在该领域的重要性
            4. 可能的应用场景
            
            请以JSON格式返回结果。
            """
            
            response = await self.think(explain_prompt)
            
            try:
                result = json.loads(response)
            except json.JSONDecodeError:
                result = {
                    "explanation": response,
                    "examples": ["需要补充具体例子"],
                    "importance": "在相关领域具有重要意义",
                    "applications": ["潜在应用场景"]
                }
            
            self._add_to_history(f"完成解释任务: {content[:50]}...")
            return result
            
        except Exception as e:
            self._add_to_history(f"解释任务失败: {str(e)}")
            return {
                "explanation": f"解释过程中出现错误: {str(e)}",
                "examples": [],
                "importance": "",
                "applications": []
            }
    
    async def _handle_polish_task(self, user_id: str, content: str, context: Dict) -> Dict[str, Any]:
        """处理润色任务"""
        try:
            # 获取用户的写作风格偏好
            user_style = await self._get_user_writing_style(user_id)
            
            # 获取相关的风格参考
            style_references = await self._get_style_references(user_id, content)
            
            polish_prompt = f"""
            请将以下文本润色为地道的学术英语：
            
            原文：
            {content}
            
            用户写作风格偏好：
            {json.dumps(user_style, ensure_ascii=False, indent=2)}
            
            风格参考：
            {json.dumps(style_references, ensure_ascii=False, indent=2)}
            
            上下文信息：
            {json.dumps(context, ensure_ascii=False, indent=2)}
            
            请提供：
            1. 润色后的英文文本
            2. 主要修改说明
            3. 风格改进建议
            4. 参考的论文句式来源
            
            要求：
            - 保持原意不变
            - 使用地道的学术表达
            - 符合目标期刊/会议的写作风格
            - 在注释中说明参考了哪些历史论文的句式
            
            请以JSON格式返回结果。
            """
            
            response = await self.think(polish_prompt)
            
            try:
                result = json.loads(response)
            except json.JSONDecodeError:
                result = {
                    "polished_text": response,
                    "modifications": ["语法修正", "词汇优化"],
                    "style_suggestions": ["建议使用更正式的表达"],
                    "references": ["基于学术写作规范"]
                }
            
            self._add_to_history(f"完成润色任务: {content[:50]}...")
            return result
            
        except Exception as e:
            self._add_to_history(f"润色任务失败: {str(e)}")
            return {
                "polished_text": content,
                "modifications": [f"润色过程中出现错误: {str(e)}"],
                "style_suggestions": [],
                "references": []
            }
    
    async def _handle_mimic_task(self, user_id: str, content: str, context: Dict) -> Dict[str, Any]:
        """处理模仿任务"""
        try:
            # 获取目标风格参考
            target_style = context.get("target_style", "formal_academic")
            reference_papers = context.get("reference_papers", [])
            
            # 如果没有指定参考论文，从用户库中获取
            if not reference_papers:
                reference_papers = await self._get_user_top_papers(user_id, limit=3)
            
            mimic_prompt = f"""
            请基于以下参考论文的写作风格，重写给定内容：
            
            原文：
            {content}
            
            目标风格：
            {target_style}
            
            参考论文：
            {json.dumps(reference_papers, ensure_ascii=False, indent=2)}
            
            上下文信息：
            {json.dumps(context, ensure_ascii=False, indent=2)}
            
            请提供：
            1. 重写后的文本
            2. 风格分析（说明如何体现目标风格）
            3. 具体的模仿技巧
            4. 参考的句式结构
            
            请以JSON格式返回结果。
            """
            
            response = await self.think(mimic_prompt)
            
            try:
                result = json.loads(response)
            except json.JSONDecodeError:
                result = {
                    "rewritten_text": response,
                    "style_analysis": "基于学术写作风格进行重写",
                    "mimic_techniques": ["句式结构模仿", "词汇选择"],
                    "reference_structures": ["学术表达方式"]
                }
            
            self._add_to_history(f"完成模仿任务: {content[:50]}...")
            return result
            
        except Exception as e:
            self._add_to_history(f"模仿任务失败: {str(e)}")
            return {
                "rewritten_text": content,
                "style_analysis": f"模仿过程中出现错误: {str(e)}",
                "mimic_techniques": [],
                "reference_structures": []
            }
    
    async def _handle_suggest_task(self, user_id: str, content: str, context: Dict) -> Dict[str, Any]:
        """
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #938** (2026-09-29): **fix(PaperGraph): 修复检索、阅读和数据一致性，补充论文 Skills**
  *Symptoms*: 本 PR 补充 #921，目标分支为其恢复分支 `codex/recover-pr-614-squashed`。恢复后的项目存在阅读接口/记忆源码缺失、PDF 显示与生产构建问题；进一步的完整功能自检还复现了跨论文/会话污染、重复保存丢失信息、推荐反馈失效和慢请求阻塞等问题。本 PR 修复这些行为，并为阅读助手加入四个按需加载的论文技能。维护者合入本 PR 后，#921 会包含这些改动。  参考作者原项目 [DeLunnLi/PaperGraph@2b6c81b](https://github.com/DeLunnLi/PaperGraph/tree/2b6c81bc34865df1b55dd1a1ef30da2c7f45ee5b)，改动仅限 `Co-creation-projects/DeLunnLi-PaperGraph/`。  ### 功能修复  - **阅读、引用与记忆：**补回被全局忽略规则遗漏的记忆源码。每次阅读/分类/图谱任务拥有独立模型历史和证据，纠错重试不重放超长错误输出；读取最近对话。导读随元数据/PDF 变化同步更新缓存和导读历史，失败导读不缓存。PDF 缓存不重复提取；保留表格数据行和章节号，修正书目边界；引用卡片与原文书目核验。记忆压缩仅删除确已提交并成功摘要的条目，长偏好保留有界片段。 - **检索与每日推荐：**意图缓存使用完整请求、隔离返回对象，明确传递当前历史与 Tavily 开关。请求期限覆盖意图解析/精排，区分提供方故障与真实空结果。候选和模型选择去重，arXiv 无结果时使用 OpenAlex 回退；反馈 ID 在前后端统一并兼容旧记录，画像/排除项随反馈更新，修复跨日日期与 SQLite 日期/行读取问题。 - **文献库、PDF 与图谱：**筛选/标签/总数在分页前一致；重复保存保留未提供的旧元数据，事务保证并发查重与标签合并。仅以稳定身份合并作者。慢下载移出异步事件循环，下载使用独立临时文件并原子发布，支持来源 PDF 与后缀范围请求。图谱获取已下载的 PDF 证据，失败可重试，分类先于限额，删除论文不会留下占据查询限额的关系。 - **前端与阅读记录：**搜索结果回写发起会话，新筛选/图谱节点/论文不会被迟到响应覆盖。每日刷新显示实际新结果。阅读器等待初始历史后启动自动导读，防止 PDF 先加载时丢失对话，且不覆盖用户新问题。阅读时长定期及离开页面补交，后端按会话累计最大值去重，兼容旧表与旧客户端。 - **论文 Skills 与 PDF 显示：**增加精读、对比、综述、复现检查四个应用内技能，通过 HelloAgents `PaperSkill` 按需加载，保留用户自定义 `Skill` 和配置开关。PDF.js canvas/文字层支持翻页、缩放、取消旧任务和配置的后端来源；构建生成字体/CMap 资源，修复正式构建空白页。  ### 验证  | 检查 | 结果 | | --- | --- | | Python 3.11.15，`python -m pytest -q tests` | **130 passed** | | Node 24.18.0，`npm run typecheck` | 通过 | | `npm test` | **34 项 Vue 测试 + 2 项 PDF.js/资源测试通过** | | `npm run build` | 通过，仍有较大依赖分块的性能提示 | | 差异格式、改动范围与密钥/运行产物检查 | 通过；不提交密钥、数据库、依赖目录或生成资源 |  回归使用临时 

- **Issue #930** (2026-09-25): **fix(chapter 6):  migrate AgentScopeDemo to AgentScope 2.0**
  *Symptoms*: ## 问题  #912 #402   AgentScope 版本太老了，老版本已经无法运行 直接运行会因为 mcp 版本不兼容报错  ``` Traceback (most recent call last):   File "C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\main_cn.py", line 11, in <module>     from agentscope.agent import ReActAgent   File "C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\.venv\Lib\site-packages\agentscope\__init__.py", line 11, in <module>     from . import tool   File "C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\.venv\Lib\site-packages\agentscope\tool\__init__.py", line 25, in <module>     from ._toolkit import Toolkit   File "C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\.venv\Lib\site-packages\agentscope\tool\_toolkit.py", line 35, in <module>     from ..mcp import (     ...<3 lines>...     )   File "C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\.venv\Lib\site-packages\agentscope\mcp\__init__.py", line 9, in <module>     from ._http_stateless_client import HttpStatelessClient   File "C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\.venv\Lib\site-packages\agentscope\mcp\_http_stateless_client.py", line 9, in <module>     from mcp.client.streamable_http import streamablehttp_client ImportError: cannot import name 'streamablehttp_client' from 'mcp.client.streamable_http' (C:\Users\ASUS\Desktop\hello-agents-main\code\chapter6\AgentScopeDemo\.venv\Lib\site-packages\mcp\client\streamable_http.py) ```
  **Post-Mortem & Fix Analysis**:
  > Friend, you can directly configure the environment based on the provided requirements.txt file, ensuring that the versions are correct. This eliminates the need to modify libraries and code.

- **Issue #929** (2026-09-22): **docs: update Chapter 5 Coze tutorial for latest interface and correct the table number**
  *Symptoms*: ## Description  Update Chapter 5 tutorial to adapt to the latest Coze platform interface.  ## Changes  - Added instructions for the updated Coze homepage and workspace entry - Added screenshots for:   - Coze homepage update   - Workflow creation   - System prompt configuration   - RSS plugin update   - Rename updated images in 5-figures - Updated figure numbering after adding new images in Section 5.2.2  - correct the Summary table number 2 to 1 （only have one table but write table 5.2 hhh）  ## Motivation  The Coze interface has changed since the original tutorial was written. Some steps and screenshots were outdated, which could cause confusion for readers following the tutorial.  This update improves the reproducibility of the tutorial with the latest Coze interface.  ## Related Section  Chapter 5 - 5.2.2 构建“每日AI简报”助手  ——  5.5.5 n8n 的优势与局限性分析 both chinese and English 
  **Post-Mortem & Fix Analysis**:
  > 感谢，非常有价值的工作，LGTM~

- **Issue #928** (2026-09-21): **update chapter code files**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > pass

- **Issue #922** (2026-09-20): **[毕业设计] MADF - 多智能体讨论框架**
  *Symptoms*: ## 项目信息  - **项目名称**：MADF - 多智能体讨论框架（Multi-Agent Discussion Framework） - **作者**：@dongyu23 - **项目类型**：多智能体应用  ## 项目简介  MADF 是参考 HelloAgents 教程开发的多智能体讨论框架，通过多角色模拟与动态交互，构建可评估并具备实时互动能力的智能体讨论系统。  ## 核心功能  - [x] 基于真实人物资料生成具有独立价值观和语言风格的角色 - [x] 私有记忆与共享讨论记忆组成的双层记忆系统 - [x] 主持人智能体动态引导讨论并调节发言节奏 - [x] 从逻辑性、一致性、创新性、协作度和情感共鸣进行质量评估 - [x] Vue 3、FastAPI 与 WebSocket 组成的实时交互界面  ## 技术亮点  - 基于 HelloAgents 组织多智能体角色和工具调用 - 支持动态主持、双层记忆和五维讨论质量评估 - 前后端分离并支持实时消息同步  ## 演示效果  原 PR 未附截图或 GIF，待代码审核时结合项目 README 和运行说明核对。  ## 自检清单  - [ ] 代码能够正常运行 - [ ] README 文档完整 - [ ] requirements.txt 完整 - [ ] 有清晰的使用示例 - [ ] 代码有适当的注释  以上自检项在原 PR 中没有勾选，本次恢复未代替作者作运行验证。  ## 其他说明  ### 恢复说明  - 本 PR 由维护者代为恢复原毕业设计 PR #462；原讨论和历史记录继续保留在原 PR。 - 将原作者的 2 个独有提交整理为 1 个提交，保留原作者署名；本 PR 由维护者发起。 - 恢复内容仅限 `Co-creation-projects/dongyu23-MADF/`，项目目录文件树与原源分支一致；未包含其他项目或旧基底变更。 - 已检查 `hello-agents` 依赖声明、代码中的 `hello_agents` 实际导入，以及 1 MB 文件上限。 - 当前为草稿，本次只验证恢复完整性，尚未完成运行测试和代码审核。 
  **Post-Mortem & Fix Analysis**:
  > 感谢整理和恢复，也理解仓库维护中出现的异常，辛苦了！  我已核对过新 PR 的内容：  - 逐文件对比了本 PR 与我 fork 分支（dongyu23:main）上 `Co-creation-projects/dongyu23-MADF/` 的文件树，171 个文件内容完全一致，确认恢复完整，无缺失、无改动。 - 原 PR 中 `.github/workflows/deploy.yml` 本就是我 fork 中不存在的文件（原 diff 里为删除态），不恢复没有问题。 - 标题与说明按第 16 章模板整理后比我原来的版本更规范，谢谢！  自检清单部分我也验证过：代码可正常运行，README 完整，依赖与使用示例齐全（演示截图我稍后补上）。另外一个小建议：恢复的文件里包含 `frontend/coverage/` 测试覆盖率构建产物，审核时可以考虑清理掉。  确认无误后，可以转 Ready for review 了，后续审核意见我在这个 PR 里跟进。再次感谢！
  > 可以，感谢，LGTM~应该没什么问题了！

- **Issue #921** (2026-09-29): **[毕业设计] PaperGraph - 一个面向科研阅读与文献管理的智能论文助手**
  *Symptoms*: ## 项目信息    - **项目名称**: PaperGraph 知脉  - **作者**: @DeLunnLi  - **项目类型**: 生产力工具 / 学习辅助    ## 项目简介    PaperGraph 是一个面向科研阅读与文献管理的智能论文助手。项目整合了论文搜索、每日推荐、文献库管理、论文阅读助手和知识图谱，帮助用户更高效地发现、保存、阅读和关联学术论文。    ## 核心功能    - [x] 多源论文搜索：支持 arXiv、DBLP、OpenAlex 与 Tavily 辅助检索  - [x] 每日论文推荐：根据文献库内容与阅读偏好推荐相关论文  - [x] 文献库管理：支持论文保存、分类、标签与 PDF 管理  - [x] 论文阅读助手：从文献库打开论文后进入阅读页面，支持 PDF 阅读、AI 导读和论文问答  - [x] 知识图谱：展示论文、作者、关键词与相关文献之间的关联    ## 技术亮点    - 使用了 Agent + RAG 风格的论文检索与阅读辅助范式  - 实现了多源论文召回、LLM 意图解析、论文精排和阅读问答功能  - 优化了会议论文召回、作者检索、PDF 解析和搜索结果去重流程  - 将运行数据统一收敛到项目目录内，便于项目迁移、展示和复现    ## 演示效果    - 文献搜索页面  <img width="1467" height="761" alt="截屏2026-05-21 13 11 46" src="https://github.com/user-attachments/assets/330c9fa6-097c-4d04-8047-680a9b7f17ee" />    - 每日论文推荐页面  <img width="1446" height="832" alt="截屏2026-05-21 12 38 22" src="https://github.com/user-attachments/assets/d3d9e7e5-5f56-401b-b6ff-1b1cd95bb176" />    - 我的文献库页面  <img width="1446" height="832" alt="截屏2026-05-21 12 38 37" src="https://github.com/user-attachments/assets/97be1475-5cab-4eb7-8881-61d704b5f23d" />    - 从文献库打开论文后的论文阅读助手页面  <img width="1467" height="761" alt="截屏2026-05-21 13 12 00" src="https://github.com/user-attachments/assets/bb06e03a-7359-4222-a69e-47e666606c40" />    - 知识图谱页面  <img width="1467" height="761" alt="截屏2026-05-21 13 10 44" src="https://github.com/user-attachments/assets/a257e19a-21bb-4627-af63-f39b7fa80076" />    ## 自检清单    - [x] 代码能够正常运行  - [x] README 文档完整  - [x] requirements.txt 完整  - [x] 有清晰的使用示例  - [x] 代码有适当的注释    ## 其他说明
  **Post-Mortem & Fix Analysis**:
  > @jjyaoao 感谢帮忙恢复项目！我已核对，#921 中 PaperGraph 目录的文件树与原 #614 一致，项目说明也已确认。后续统一在本 PR 下沟通，我先停止继续修改，请您按项目流程安排后续审核和合并；如还需要我补充材料或调整，请在这里指出具体要求。  此前完成的修复已整理为[单提交版本](https://github.com/DeLunnLi/hello-agents/tree/codex/papergraph-single-commit)，提交为 `c05716b`，供审核时参考。它包含原项目及全部修复，文件内容与已测试版本一致。如决定采用，希望本 PR 仍保持一个项目提交，具体更新方式请您处理。  修复分支的离线验证结果为：后端 130 项、前端 36 项测试通过，类型检查和正式构建通过。这些结果对应上述修复分支，并非当前 #921；真实模型及外部检索效果尚未验收。  补充 PR #938 已关闭，保留 #921 作为后续审核入口。谢谢！ 
  > 好的，感谢，很好的项目，LGTM~

- **Issue #919** (2026-09-26): **[毕业设计] ThinkFlow - AI智能思维教练**
  *Symptoms*: ## 项目信息  - **项目名称**: ThinkFlow-AI智能思维教练  - **作者**: @alan-6-6-6  - **项目类型**: 生产力AI智能体工具    ## 项目简介  本项目基于Hello-Agents框架搭建结构化思考智能体，融合麦肯锡MECE、WBS、决策矩阵专业咨询方法论，通过澄清、决策、拆解三段式黄金三角流程引导用户梳理模糊需求，支持多智能体递归联动，完整实现需求澄清、方案对比、任务分层拆解全链路。当前版本本地全流程自测通过，已完成工程快照封装并推送至feature/thinkflow分支。    ## 核心功能  - [x] ClarifyAgent需求澄清智能体：基于5W1H+黄金圈法则收敛模糊需求，锁定项目目标与约束条件  - [x] DecideAgent决策评估智能体：多维度决策矩阵对比备选方案，输出最优选择  - [x] DecomposeAgent任务拆解智能体：WBS分层拆解，内置MECE完整性校验  - [x] 智能体递归联动机制：检测分支决策时自动中断分解、完成选择后恢复任务拆解上下文  - [ ] 底层模型切换适配（待迭代优化）  - [ ] 前端可视化交互页面（待迭代开发）  - [ ] LLM流式文字输出改造（待迭代优化）  - [ ] 交互响应速度性能优化（待迭代优化）    ## 技术亮点  1. 专业咨询方法论落地，将MECE、WBS、决策矩阵固化为AI智能体能力，区别于通用对话大模型  2. 自定义多智能体状态流转协议，支持递归跳转，贴合真实项目管理思考逻辑  3. 完整工程化封装，提供.env配置、运行脚本、使用示例，开箱即用  4. 模块化代码结构，低耦合便于后续新增思维工具、扩展前端页面    ## 演示效果  (Al_Agent) kusunoki@MacBook-Air-2 alan-6-6-6-ThinkFlow % Python main.py    ============================================================        ThinkFlow - AI 思维教练  ============================================================    请选择运行模式:  1. 交互模式（完整工作流）  2. 演示模式（预定义示例）    请输入选择 (1/2): 1    ============================================================        ThinkFlow - AI 思维教练  ============================================================    您好！我是您的思维教练，帮助您理清思路、拆解任务。  请告诉我您目前遇到的困惑或想要实现的目标...    >>> 提升客户留存率      === [澄清期] ===    ClarifyAgent: 您好，我是您的思维教练。为了帮您把“提升客户留存率”这个目标清晰化，我需要先聚焦两个核心问题：    **1. 核心动机（Why）**：您做这件事最根本的驱动力是什么？是为了增加长期收入、降低获客成本、提升品牌口碑，还是应对近期客户流失的紧急危机？    **2. 量化目标（What）**：您对这个“提升”有具体衡量标准吗？比如希望将月留存率从当前的X%提升到Y%，或者降低流失率至某个绝对值？
  **Post-Mortem & Fix Analysis**:
  > 感谢，LGTM~

- **Issue #918** (2026-09-29): **[毕业设计] Way_to_Engineer - AI学习助手**
  *Symptoms*: # Way to Engineer — AI 辅助编程学习平台    ## 项目信息    - **项目名称**: Way to Engineer — AI 辅助编程学习平台  - **作者**: @Max3753  - **项目类型**: 教育科技    ---    ## 项目简介    AI 驱动的编程学习平台，后端 FastAPI + 前端 Vue 3，通过多 Agent LLM 编排实现交互式编程教学。系统提供三条结构化学习路径（前端/后端/全栈），由 5 个专业化 AI Agent 自动路由响应，支持嵌入式交互测验、沙箱代码执行、AI 水平评估和游戏化激励体系，覆盖从概念讲解到代码审查的完整学习闭环。    ---    ## 核心功能    - **多 Agent 智能对话** — LLM 驱动的意图路由，自动分配导师/调试/审查/架构/教练 5 个 Agent，支持 `## 二级标题` 结构化回答自动折叠展开，`<details>` 手风琴交互，嵌入式 Quiz 测验和代码练习块  - **结构化学习路径** — 前端（16 课时）、后端（14 课时）、全栈（10 课时）三条路径，模块化分章节，自动解锁下一课，进度持久化  - **AI 交互式测验** — Agent 在教学中通过 ` ```quiz ` JSON 格式嵌入选择题，前端 MarkdownRenderer 实时渲染成交互式 QuizWidget，可查看解析和正确答案  - **代码练习与沙箱执行** — 聊天中代码块一键运行（` ▶ 运行`），右侧 Monaco 编辑器提供完整编码环境，支持 Python/JavaScript/TypeScript/Bash 四语言沙箱执行，安全过滤危险模块  - **AI 水平评估** — LLM 实时生成 10 道测试题（含选择题/输出预测/填空/找 Bug 四种题型），按分类评分并推荐学习起点  - **游戏化激励体系** — XP 经验值 + 等级系统（100 XP/级）、10 种徽章（含连续学习🔥、完美主义💯、开拓者🏆）、每日连击追踪  - **运行时 LLM 配置切换** — 页面内直接修改 API Base URL / Model ID / API Key，即时生效无需重启服务  - **暗色主题与中英文切换** — 支持暗色/亮色主题（`data-theme` 属性），中英文界面即时切换，本地存储持久化偏好    ---    ## 技术亮点    - **多 Agent 编排架构** — 5 个专业化 Agent 通过 LLM 意图分类路由，每个 Agent 拥有独立 system prompt 和上下文注入（用户等级、技能水平、课程进度、下一课推荐），非简单的关键词匹配  - **无数据库轻量持久化** — 纯 JSON 文件存储（4 个文件），内存 Dict 缓存 + 写入同步，零依赖，支持 datetime 序列化和 API 运行时覆写  - **安全沙箱代码执行** — 每语言独立安全策略：Python 禁止 os/subprocess/socket/exec/eval 等 8 类危险模块/函数，JS 禁止 fs/child_process，Bash 白名单模式仅允许 echo/ls/cat 等基础命令，10 秒超时 + 5KB 输出截断  - **问答式认证系统** — 无密码仅用户名登录，自动注册，`user_id` 查询参数跨接口传递，无状态轻量设计  - **Markdown 流式渲染** —
  **Post-Mortem & Fix Analysis**:
  > 非常完善的项目，LGTM~

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

### Incident Patch 1: `b4aca1af` (2026-09-17)
**Commit Message**: Merge pull request #895 from fancyboi999/fix/ch7-stream-run-duplicate-print

fix(ch7): resolve duplicate stream print in MySimpleAgent and docs

**File**: `code/chapter7/my_simple_agent.py` (modified, +0/-1)
```diff
@@ -214,7 +214,6 @@ def stream_run(self, input_text: str, **kwargs) -> Iterator[str]:
         print("📝 实时响应: ", end="")
         for chunk in self.llm.stream_invoke(messages, **kwargs):
             full_response += chunk
-            print(chunk, end="", flush=True)
             yield chunk
 
         print()  # 换行
```

**File**: `docs/chapter7/Chapter7-Building-Your-Agent-Framework.md` (modified, +0/-1)
```diff
@@ -856,7 +856,6 @@ class MySimpleAgent(SimpleAgent):
         print("📝 Real-time response: ", end="")
         for chunk in self.llm.stream_invoke(messages, **kwargs):
             full_response += chunk
-            print(chunk, end="", flush=True)
             yield chunk
 
         print()  # New line
```

**File**: `docs/chapter7/第七章 构建你的Agent框架.md` (modified, +0/-1)
```diff
@@ -856,7 +856,6 @@ class MySimpleAgent(SimpleAgent):
         print("📝 实时响应: ", end="")
         for chunk in self.llm.stream_invoke(messages, **kwargs):
             full_response += chunk
-            print(chunk, end="", flush=True)
             yield chunk
 
         print()  # 换行
```

---

### Incident Patch 2: `2cef303c` (2026-09-17)
**Commit Message**: fix(ch7): resolve duplicate stream print in MySimpleAgent and docs

**File**: `code/chapter7/my_simple_agent.py` (modified, +0/-1)
```diff
@@ -214,7 +214,6 @@ def stream_run(self, input_text: str, **kwargs) -> Iterator[str]:
         print("📝 实时响应: ", end="")
         for chunk in self.llm.stream_invoke(messages, **kwargs):
             full_response += chunk
-            print(chunk, end="", flush=True)
             yield chunk
 
         print()  # 换行
```

**File**: `docs/chapter7/Chapter7-Building-Your-Agent-Framework.md` (modified, +0/-1)
```diff
@@ -856,7 +856,6 @@ class MySimpleAgent(SimpleAgent):
         print("📝 Real-time response: ", end="")
         for chunk in self.llm.stream_invoke(messages, **kwargs):
             full_response += chunk
-            print(chunk, end="", flush=True)
             yield chunk
 
         print()  # New line
```

**File**: `docs/chapter7/第七章 构建你的Agent框架.md` (modified, +0/-1)
```diff
@@ -856,7 +856,6 @@ class MySimpleAgent(SimpleAgent):
         print("📝 实时响应: ", end="")
         for chunk in self.llm.stream_invoke(messages, **kwargs):
             full_response += chunk
-            print(chunk, end="", flush=True)
             yield chunk
 
         print()  # 换行
```

---

### Incident Patch 3: `4f7682ce` (2026-09-04)
**Commit Message**: Merge pull request #844 from 1-fdf/fix/extra02-typos

fix(docs): 修正 Extra02 拼写错误与失效链接

**File**: `Extra-Chapter/Extra02-上下文工程补充知识.md` (modified, +5/-5)
```diff
@@ -2,14 +2,14 @@
 
 ## 引入
 
-为什么上下文工程最近又再次火热起来？源自 Chroma 创始人兼 CEOJeff 在 Len Space [播客](https://youware.app/project/7529x70z4p)的对话，
+为什么上下文工程最近又再次火热起来？源自 Chroma 创始人兼 CEO Jeff 在 Len Space [播客](https://youware.app/project/7529x70z4p)的对话，
 Chroma 向量数据库领域的开源霸主。连大名鼎鼎的 Voyager 论文里用的都是它。
-CEOJeff 对话的标题就是关于“RAG is dead”的观念，在视频中很明显的说明了原本的RAG的局限性和现在context engnieer的重要性，
+CEO Jeff 对话的标题就是关于“RAG is dead”的观念，在视频中很明显的说明了原本的RAG的局限性和现在context engineering的重要性，
 
 ![alt text](./images/Extra02-figures/image-1.png)
 
 
-本章我们先全面讲解一下“上下文工程”的（context engnieer）概念， 
+本章我们先全面讲解一下“上下文工程”的（context engineering）概念， 
 并在文章最后谈一下对 Rag is dead 的看法
 
 
@@ -38,7 +38,7 @@ _"上下文工程是...在上下文窗口中为下一步填充恰到好处信息
 
 
 
-## [上下文工程的概念](https://blog.langchain.com/context-engineering-for-agents/`)
+## [上下文工程的概念](https://blog.langchain.com/context-engineering-for-agents/)
 
 ![alt text](./images/Extra02-figures/image-2.png)
 
@@ -240,7 +240,7 @@ Agent 让 AI 从一个“问答机器人”进化成一个<strong>能思考、
 
 ### Context Poisoning: When a Hallucination Makes It into the Context
 
-上下文毒化（Context Poisoning）指的是幻觉（hallucination，即模型生成的错误或虚构信息）或其它错误进入上下文窗口，并被反复引用，从而嵌入错误信息，导致代理（agent）性能脱轨。这种情况会“毒化”关键部分，如目标或摘要，使得模型固执于不可能或无关的目标，导致重复的、无意义的的行为。
+上下文毒化（Context Poisoning）指的是幻觉（hallucination，即模型生成的错误或虚构信息）或其它错误进入上下文窗口，并被反复引用，从而嵌入错误信息，导致代理（agent）性能脱轨。这种情况会“毒化”关键部分，如目标或摘要，使得模型固执于不可能或无关的目标，导致重复的、无意义的行为。
 
 ### Context Distraction: When the Context Overwhelms the Training
 
```

---

### Incident Patch 4: `01f624b4` (2026-08-25)
**Commit Message**: fix(docs): 修正 Extra02 拼写错误与失效链接

**File**: `Extra-Chapter/Extra02-上下文工程补充知识.md` (modified, +5/-5)
```diff
@@ -2,14 +2,14 @@
 
 ## 引入
 
-为什么上下文工程最近又再次火热起来？源自 Chroma 创始人兼 CEOJeff 在 Len Space [播客](https://youware.app/project/7529x70z4p)的对话，
+为什么上下文工程最近又再次火热起来？源自 Chroma 创始人兼 CEO Jeff 在 Len Space [播客](https://youware.app/project/7529x70z4p)的对话，
 Chroma 向量数据库领域的开源霸主。连大名鼎鼎的 Voyager 论文里用的都是它。
-CEOJeff 对话的标题就是关于“RAG is dead”的观念，在视频中很明显的说明了原本的RAG的局限性和现在context engnieer的重要性，
+CEO Jeff 对话的标题就是关于“RAG is dead”的观念，在视频中很明显的说明了原本的RAG的局限性和现在context engineering的重要性，
 
 ![alt text](./images/Extra02-figures/image-1.png)
 
 
-本章我们先全面讲解一下“上下文工程”的（context engnieer）概念， 
+本章我们先全面讲解一下“上下文工程”的（context engineering）概念， 
 并在文章最后谈一下对 Rag is dead 的看法
 
 
@@ -38,7 +38,7 @@ _"上下文工程是...在上下文窗口中为下一步填充恰到好处信息
 
 
 
-## [上下文工程的概念](https://blog.langchain.com/context-engineering-for-agents/`)
+## [上下文工程的概念](https://blog.langchain.com/context-engineering-for-agents/)
 
 ![alt text](./images/Extra02-figures/image-2.png)
 
@@ -240,7 +240,7 @@ Agent 让 AI 从一个“问答机器人”进化成一个<strong>能思考、
 
 ### Context Poisoning: When a Hallucination Makes It into the Context
 
-上下文毒化（Context Poisoning）指的是幻觉（hallucination，即模型生成的错误或虚构信息）或其它错误进入上下文窗口，并被反复引用，从而嵌入错误信息，导致代理（agent）性能脱轨。这种情况会“毒化”关键部分，如目标或摘要，使得模型固执于不可能或无关的目标，导致重复的、无意义的的行为。
+上下文毒化（Context Poisoning）指的是幻觉（hallucination，即模型生成的错误或虚构信息）或其它错误进入上下文窗口，并被反复引用，从而嵌入错误信息，导致代理（agent）性能脱轨。这种情况会“毒化”关键部分，如目标或摘要，使得模型固执于不可能或无关的目标，导致重复的、无意义的行为。
 
 ### Context Distraction: When the Context Overwhelms the Training
 
```

---

### Incident Patch 5: `45dd84e6` (2026-08-18)
**Commit Message**: Merge pull request #818 from datawhalechina/feature/fix-issue-799-neuro-symbolic-order

docs: update star history stats image

**File**: `README.md` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@
 ## Star History
 
 <div align='center'>
-    <img src="./docs/images/0803-hello-agents-stats.png" alt="Datawhale" width="90%">
+    <img src="./docs/images/0818-hello-agents-stats.png" alt="Datawhale" width="90%">
 </div>
 
 <div align="center">
```

**File**: `README_EN.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ We are an open-source community and welcome any form of contribution!
 ## Star History
 
 <div align='center'>
-    <img src="./docs/images/0803-hello-agents-stats.png" alt="Datawhale" width="90%">
+    <img src="./docs/images/0818-hello-agents-stats.png" alt="Datawhale" width="90%">
 </div>
 
 <div align="center">
```

**File**: `docs/README.md` (modified, +1/-1)
```diff
@@ -165,7 +165,7 @@
 ## Star History
 
 <div align='center'>
-    <img src="./images/0803-hello-agents-stats.png" alt="Datawhale" width="90%">
+    <img src="./images/0818-hello-agents-stats.png" alt="Datawhale" width="90%">
 </div>
 
 <div align="center">
```

**File**: `docs/README_EN.md` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ We are an open-source community and welcome any form of contribution!
 ## Star History
 
 <div align='center'>
-    <img src="./images/0803-hello-agents-stats.png" alt="Datawhale" width="90%">
+    <img src="./images/0818-hello-agents-stats.png" alt="Datawhale" width="90%">
 </div>
 
 <div align="center">
```

---

### Incident Patch 6: `606a07d3` (2026-08-14)
**Commit Message**: Merge pull request #810 from datawhalechina/feature/fix-issue-799-neuro-symbolic-order

fix(chapter1): align dual-system explanation with Figure 1.4

**File**: `docs/chapter1/Chapter1-Introduction-to-Agents.md` (modified, +12/-11)
```diff
@@ -111,33 +111,34 @@ Through this approach, the agent decomposes a grand task requiring long-term pla
 
 This is a more fundamental classification dimension that explores what form the knowledge used by agents for decision-making exists in their "minds." This question is at the core of a debate that has lasted more than half a century in the field of artificial intelligence and has shaped two distinctly different AI cultures.
 
-- **Symbolic AI**
+- **Sub-symbolic AI**
 
-Symbolism, often called traditional artificial intelligence, has a core belief: intelligence stems from logical operations on symbols. The symbols here are human-readable entities (such as words, concepts), and operations follow strict logical rules, as shown on the left side of Figure 1.4. This is like a meticulous librarian organizing world knowledge into clear rule bases and knowledge graphs.
+Sub-symbolism, or connectionism, holds that knowledge does not take the form of explicit rules. Instead, it is implicitly distributed across a complex network of neurons as statistical patterns learned from massive amounts of data. Neural networks and deep learning are its representative approaches.
 
-Its main advantage lies in transparency and interpretability. Since reasoning steps are explicit, its decision-making process can be fully traced, which is crucial in high-risk fields such as finance and healthcare. However, its "Achilles' heel" lies in fragility: it relies on a complete rule system, but in the real world full of ambiguity and exceptions, any new situation not covered can lead to system failure, which is the so-called "knowledge acquisition bottleneck."
+As shown on the left side of Figure 1.4, sub-symbolic AI is like a babbling child. It does not learn to recognize cats from rules such as "cats have four legs, are furry, and meow." Instead, after seeing thousands of cat images, its neural network learns the visual patterns associated with the concept of a cat. This approach is powerful in pattern recognition and robust to noisy data. It can readily process unstructured data such as images and sounds, tasks that are often difficult for systems that rely on explicit rules.
 
-- **Sub-symbolic AI**
+However, this powerful intuitive capability also comes with opacity. Sub-symbolic systems are typically viewed as a **Black Box**. It can identify a cat in a picture with amazing accuracy, but if you ask it "why do you think this is a cat?", it likely cannot provide a logically sound explanation. Additionally, it performs poorly on pure logical reasoning tasks and sometimes produces hallucinations that seem reasonable but are factually incorrect.
 
-Sub-symbolism, or connectionism, provides a completely different picture. Here, knowledge is not explicit rules but implicitly distributed in a complex network composed of numerous neurons, representing statistical patterns learned from massive data. Neural networks and deep learning are its representatives.
+- **Symbolic AI**
 
-As shown in the middle of Figure 1.4, if symbolic AI is a librarian, then sub-symbolic AI is like a babbling child. They don't learn to recognize cats by learning rules like "cats have four legs, are furry, and meow," but after seeing thousands of cat pictures, the neural network in their brain can identify the visual pattern of the concept "cat." The power of this approach lies in its pattern recognition capability and robustness to noisy data. It can easily handle unstructured data such as images and sounds, which are extremely difficult tasks for symbolic AI.
+In contrast to sub-symbolic AI, symbolism, often called traditional artificial intelligence, holds that intelligence stems from logical operations on symbols. These symbols are human-readable entities such as words and concepts, and the operations follow strict logical rules, as shown in the middle of Figure 1.4. This is like a meticulous librarian organizing world knowledge into clear rule bases and knowledge graphs.
 
-However
```

**File**: `docs/chapter1/第一章 初识智能体.md` (modified, +12/-11)
```diff
@@ -112,33 +112,34 @@
 
 这是一个更根本的分类维度，它探究智能体用以决策的知识，究竟是以何种形式存于其“思想”之中。这个问题是人工智能领域一场持续半个多世纪的辩论核心，并塑造了两种截然不同的 AI 文化。
 
-- <strong>符号主义 AI（Symbolic AI）</strong>
+- <strong>亚符号主义 AI（Sub-symbolic AI）</strong>
 
-符号主义，常被称为传统人工智能，其核心信念是：智能源于对符号的逻辑操作。这里的符号是人类可读的实体（如词语、概念），操作则遵循严格的逻辑规则，如图 1.4 左侧所示。这好比一位一丝不苟的图书管理员，将世界知识整理为清晰的规则库和知识图谱。
+亚符号主义，或称连接主义，认为知识并非显式的规则，而是内隐地分布在一个由大量神经元组成的复杂网络中，是从海量数据中学习到的统计模式。神经网络和深度学习是其代表。
 
-其主要优势在于透明和可解释。由于推理步骤明确，其决策过程可以被完整追溯，这在金融、医疗等高风险领域至关重要。然而，其“阿喀琉斯之踵”在于脆弱性：它依赖于一个完备的规则体系，但在充满模糊和例外的现实世界中，任何未被覆盖的新情况都可能导致系统失灵，这就是所谓的“知识获取瓶颈”。
+如图 1.4 左侧所示，亚符号主义 AI 就像一个牙牙学语的孩童。他不是通过学习“猫有四条腿、毛茸茸、会喵喵叫”这样的规则来认识猫的，而是在看过成千上万张猫的图片后，大脑中的神经网络能辨识出“猫”这个概念的视觉模式。这种方法的强大之处在于其模式识别能力和对噪声数据的鲁棒性。它能够轻松处理图像、声音等非结构化数据，而这类任务对于依赖明确规则的系统往往非常困难。
 
-- <strong>亚符号主义 AI（Sub-symbolic AI）</strong>
+然而，这种强大的直觉能力也伴随着不透明性。亚符号主义系统通常被视为一个<strong>黑箱（Black Box）</strong>。它能以惊人的准确率识别出图片中的猫，但你若问它“为什么你认为这是猫？”，它很可能无法给出一个合乎逻辑的解释。此外，它在纯粹的逻辑推理任务上表现不佳，有时会产生看似合理却事实错误的幻觉。
 
-亚符号主义，或称连接主义，则提供了一幅截然不同的图景。在这里，知识并非显式的规则，而是内隐地分布在一个由大量神经元组成的复杂网络中，是从海量数据中学习到的统计模式。神经网络和深度学习是其代表。
+- <strong>符号主义 AI（Symbolic AI）</strong>
 
-如图 1.4 中间所示，如果说符号主义 AI 是图书管理员，那么亚符号主义 AI 就像一个牙牙学语的孩童 。他不是通过学习“猫有四条腿、毛茸茸、会喵喵叫”这样的规则来认识猫的，而是在看过成千上万张猫的图片后，大脑中的神经网络能辨识出“猫”这个概念的视觉模式 。这种方法的强大之处在于其模式识别能力和对噪声数据的鲁棒性 。它能够轻松处理图像、声音等非结构化数据，这在符号主义 AI 看来是极其困难的任务。
+与亚符号主义不同，符号主义常被称为传统人工智能，其核心信念是：智能源于对符号的逻辑操作。这里的符号是人类可读的实体（如词语、概念），操作则遵循严格的逻辑规则，如图 1.4 中间所示。这好比一位一丝不苟的图书管理员，将世界知识整理为清晰的规则库和知识图谱。
 
-然而，这种强大的直觉能力也伴随着不透明性。亚符号主义系统通常被视为一个<strong>黑箱（Black Box）</strong>。它能以惊人的准确率识别出图片中的猫，但你若问它“为什么你认为这是猫？”，它很可能无法给出一个合乎逻辑的解释。此外，它在纯粹的逻辑推理任务上表现不佳，有时会产生看似合理却事实错误的幻觉 。
+其主要优势在于透明和可解释。由于推理步骤明确，其决策过程可以被完整追溯，这在金融、医疗等高风险领域至关重要。然而，其“阿喀琉斯之踵”在于脆弱性：它依赖于一个完备的规则体系，但在充满模糊和例外的现实世界中，任何未被覆盖的新情况都可能导致系统失灵，这就是所谓的“知识获取瓶颈”。
 
 - <strong>神经符号主义 AI（Neuro-Symbolic AI）</strong>
 
-长久以来，符号主义和亚符号主义这两大阵营如同两条平行线，各自发展。为克服上述两种范式的局限，一种“大和解”的思想开始兴起，这就是神经符号主义 AI，也称神经符号混合主义。它的目标，是融合两大范式的优点，创造出一个既能像神经网络一样从数据中学习，又能像符号系统一样进行逻辑推理的混合智能体。它试图弥合感知与认知、直觉与理性之间的鸿沟。诺贝尔经济学奖得主丹尼尔·卡尼曼（Daniel Kahneman）在其著作《思考，快与慢》（Thinking, Fast and Slow）中提出的双系统理论，为我们理解神经符号主义提供了一个绝佳的类比<sup>[2]</sup>，如图 1.4 所示：
+长久以来，亚符号主义和符号主义这两大阵营如同两条平行线，各自发展。为克服上述两种范式的局限，一种“大和解”的思想开始兴起，这就是神经符号主义 AI，也称神经符号混合主义。它的目标，是融合两大范式的优点，创造出一个既能像神经网络一样从数据中学习，又能像符号系统一样进行逻辑推理的混合智能体。换言之，它试图将亚符号主义擅长的模式识别与符号主义擅长的逻辑推理结合起来。诺贝尔经济学奖得主丹尼尔·卡尼曼（Daniel Kahneman）在其著作《思考，快与慢》（Thinking, Fast and Slow）中提出的双系统理论，为我们理解神经符号主义提供了一个绝佳的类比<sup>[2]</sup>。按照图 1.4 从左到右的展示顺序，这种对应关系可以概括为：
 
 - <strong>系统 1</strong>是快速、凭直觉、并行的思维模式，类似于亚符号主义 AI 强大的模式识别能力。
 - <strong>系统 2</strong>是缓慢、有条理、基于逻辑的审慎思维，恰如符号主义 AI 的推理过程。
+- <strong>神经符号主义 AI</strong>则将系统 1 的模式识别与系统 2 的逻辑推理结合起来，使二者协同工作。
 
 <div align="center">
-  <img src="https://raw.githubusercontent.com/datawhalechina/Hello-Agents/main/docs/images/1-figures/1757242319667-4.png" alt="图片描述" width="90%"/>
-  <p>图 1.4 符号主义、亚符号主义与神经符号混合主义的知识表示范式</p>
+  <img src="https://raw.githubusercontent.com/datawhalechina/Hello-Agents/main/docs/images/1-figures/1757242319667-4.png" alt="亚符号主义、符号主义与神经符号主义的关系示意图" width="90%"/>
+  <p>图 1.4 亚符号主义、符号主义与神经符号混合主义的知识表示范式</p>
 </div>
 
-人类的智能，正源于这两个系统的协同工作。同样，一个真正鲁棒的 AI，也需要兼具二者之长。大语言模型驱动的智能体是神经符号主义的一个极佳实践范例。其内核是一个巨大的神经网络，使其具备模式识别和语言生成能力。然而，当它工作时，它会生成一系列结构化的中间步骤，如思想、计划或 API 调用，这些都是明确的、可操作的符号。通过这种方式，它实现了感知与认知、直觉与理性的初步融合。
+人类的智能，正源于这两个系统的协同工作。同样，一个真正鲁棒的 AI，也需要兼具二者之长。大语言模型驱动的智能体是神经符号主义的一个极佳实践范例：其内核是一个巨大的神经网络，使其具备模式识别和语言生成能力；在工作过程中，它又会生成一系列结构化的中间步骤，如思想、计划或 API 调用，这些都是明确的、可操作的符号。通过这种方式，它将基于神经网络的模式识别与基于符号的逻辑推理结合起来。
 
 
 
```

---

### Incident Patch 7: `0a33789e` (2026-08-14)
**Commit Message**: fix: align neuro-symbolic explanation and figure

**File**: `docs/chapter1/Chapter1-Introduction-to-Agents.md` (modified, +12/-11)
```diff
@@ -111,33 +111,34 @@ Through this approach, the agent decomposes a grand task requiring long-term pla
 
 This is a more fundamental classification dimension that explores what form the knowledge used by agents for decision-making exists in their "minds." This question is at the core of a debate that has lasted more than half a century in the field of artificial intelligence and has shaped two distinctly different AI cultures.
 
-- **Symbolic AI**
+- **Sub-symbolic AI**
 
-Symbolism, often called traditional artificial intelligence, has a core belief: intelligence stems from logical operations on symbols. The symbols here are human-readable entities (such as words, concepts), and operations follow strict logical rules, as shown on the left side of Figure 1.4. This is like a meticulous librarian organizing world knowledge into clear rule bases and knowledge graphs.
+Sub-symbolism, or connectionism, holds that knowledge does not take the form of explicit rules. Instead, it is implicitly distributed across a complex network of neurons as statistical patterns learned from massive amounts of data. Neural networks and deep learning are its representative approaches.
 
-Its main advantage lies in transparency and interpretability. Since reasoning steps are explicit, its decision-making process can be fully traced, which is crucial in high-risk fields such as finance and healthcare. However, its "Achilles' heel" lies in fragility: it relies on a complete rule system, but in the real world full of ambiguity and exceptions, any new situation not covered can lead to system failure, which is the so-called "knowledge acquisition bottleneck."
+As shown on the left side of Figure 1.4, sub-symbolic AI is like a babbling child. It does not learn to recognize cats from rules such as "cats have four legs, are furry, and meow." Instead, after seeing thousands of cat images, its neural network learns the visual patterns associated with the concept of a cat. This approach is powerful in pattern recognition and robust to noisy data. It can readily process unstructured data such as images and sounds, tasks that are often difficult for systems that rely on explicit rules.
 
-- **Sub-symbolic AI**
+However, this powerful intuitive capability also comes with opacity. Sub-symbolic systems are typically viewed as a **Black Box**. It can identify a cat in a picture with amazing accuracy, but if you ask it "why do you think this is a cat?", it likely cannot provide a logically sound explanation. Additionally, it performs poorly on pure logical reasoning tasks and sometimes produces hallucinations that seem reasonable but are factually incorrect.
 
-Sub-symbolism, or connectionism, provides a completely different picture. Here, knowledge is not explicit rules but implicitly distributed in a complex network composed of numerous neurons, representing statistical patterns learned from massive data. Neural networks and deep learning are its representatives.
+- **Symbolic AI**
 
-As shown in the middle of Figure 1.4, if symbolic AI is a librarian, then sub-symbolic AI is like a babbling child. They don't learn to recognize cats by learning rules like "cats have four legs, are furry, and meow," but after seeing thousands of cat pictures, the neural network in their brain can identify the visual pattern of the concept "cat." The power of this approach lies in its pattern recognition capability and robustness to noisy data. It can easily handle unstructured data such as images and sounds, which are extremely difficult tasks for symbolic AI.
+In contrast to sub-symbolic AI, symbolism, often called traditional artificial intelligence, holds that intelligence stems from logical operations on symbols. These symbols are human-readable entities such as words and concepts, and the operations follow strict logical rules, as shown in the middle of Figure 1.4. This is like a meticulous librarian organizing world knowledge into clear rule bases and knowledge graphs.
 
-However
```

**File**: `docs/chapter1/第一章 初识智能体.md` (modified, +12/-11)
```diff
@@ -112,33 +112,34 @@
 
 这是一个更根本的分类维度，它探究智能体用以决策的知识，究竟是以何种形式存于其“思想”之中。这个问题是人工智能领域一场持续半个多世纪的辩论核心，并塑造了两种截然不同的 AI 文化。
 
-- <strong>符号主义 AI（Symbolic AI）</strong>
+- <strong>亚符号主义 AI（Sub-symbolic AI）</strong>
 
-符号主义，常被称为传统人工智能，其核心信念是：智能源于对符号的逻辑操作。这里的符号是人类可读的实体（如词语、概念），操作则遵循严格的逻辑规则，如图 1.4 左侧所示。这好比一位一丝不苟的图书管理员，将世界知识整理为清晰的规则库和知识图谱。
+亚符号主义，或称连接主义，认为知识并非显式的规则，而是内隐地分布在一个由大量神经元组成的复杂网络中，是从海量数据中学习到的统计模式。神经网络和深度学习是其代表。
 
-其主要优势在于透明和可解释。由于推理步骤明确，其决策过程可以被完整追溯，这在金融、医疗等高风险领域至关重要。然而，其“阿喀琉斯之踵”在于脆弱性：它依赖于一个完备的规则体系，但在充满模糊和例外的现实世界中，任何未被覆盖的新情况都可能导致系统失灵，这就是所谓的“知识获取瓶颈”。
+如图 1.4 左侧所示，亚符号主义 AI 就像一个牙牙学语的孩童。他不是通过学习“猫有四条腿、毛茸茸、会喵喵叫”这样的规则来认识猫的，而是在看过成千上万张猫的图片后，大脑中的神经网络能辨识出“猫”这个概念的视觉模式。这种方法的强大之处在于其模式识别能力和对噪声数据的鲁棒性。它能够轻松处理图像、声音等非结构化数据，而这类任务对于依赖明确规则的系统往往非常困难。
 
-- <strong>亚符号主义 AI（Sub-symbolic AI）</strong>
+然而，这种强大的直觉能力也伴随着不透明性。亚符号主义系统通常被视为一个<strong>黑箱（Black Box）</strong>。它能以惊人的准确率识别出图片中的猫，但你若问它“为什么你认为这是猫？”，它很可能无法给出一个合乎逻辑的解释。此外，它在纯粹的逻辑推理任务上表现不佳，有时会产生看似合理却事实错误的幻觉。
 
-亚符号主义，或称连接主义，则提供了一幅截然不同的图景。在这里，知识并非显式的规则，而是内隐地分布在一个由大量神经元组成的复杂网络中，是从海量数据中学习到的统计模式。神经网络和深度学习是其代表。
+- <strong>符号主义 AI（Symbolic AI）</strong>
 
-如图 1.4 中间所示，如果说符号主义 AI 是图书管理员，那么亚符号主义 AI 就像一个牙牙学语的孩童 。他不是通过学习“猫有四条腿、毛茸茸、会喵喵叫”这样的规则来认识猫的，而是在看过成千上万张猫的图片后，大脑中的神经网络能辨识出“猫”这个概念的视觉模式 。这种方法的强大之处在于其模式识别能力和对噪声数据的鲁棒性 。它能够轻松处理图像、声音等非结构化数据，这在符号主义 AI 看来是极其困难的任务。
+与亚符号主义不同，符号主义常被称为传统人工智能，其核心信念是：智能源于对符号的逻辑操作。这里的符号是人类可读的实体（如词语、概念），操作则遵循严格的逻辑规则，如图 1.4 中间所示。这好比一位一丝不苟的图书管理员，将世界知识整理为清晰的规则库和知识图谱。
 
-然而，这种强大的直觉能力也伴随着不透明性。亚符号主义系统通常被视为一个<strong>黑箱（Black Box）</strong>。它能以惊人的准确率识别出图片中的猫，但你若问它“为什么你认为这是猫？”，它很可能无法给出一个合乎逻辑的解释。此外，它在纯粹的逻辑推理任务上表现不佳，有时会产生看似合理却事实错误的幻觉 。
+其主要优势在于透明和可解释。由于推理步骤明确，其决策过程可以被完整追溯，这在金融、医疗等高风险领域至关重要。然而，其“阿喀琉斯之踵”在于脆弱性：它依赖于一个完备的规则体系，但在充满模糊和例外的现实世界中，任何未被覆盖的新情况都可能导致系统失灵，这就是所谓的“知识获取瓶颈”。
 
 - <strong>神经符号主义 AI（Neuro-Symbolic AI）</strong>
 
-长久以来，符号主义和亚符号主义这两大阵营如同两条平行线，各自发展。为克服上述两种范式的局限，一种“大和解”的思想开始兴起，这就是神经符号主义 AI，也称神经符号混合主义。它的目标，是融合两大范式的优点，创造出一个既能像神经网络一样从数据中学习，又能像符号系统一样进行逻辑推理的混合智能体。它试图弥合感知与认知、直觉与理性之间的鸿沟。诺贝尔经济学奖得主丹尼尔·卡尼曼（Daniel Kahneman）在其著作《思考，快与慢》（Thinking, Fast and Slow）中提出的双系统理论，为我们理解神经符号主义提供了一个绝佳的类比<sup>[2]</sup>，如图 1.4 所示：
+长久以来，亚符号主义和符号主义这两大阵营如同两条平行线，各自发展。为克服上述两种范式的局限，一种“大和解”的思想开始兴起，这就是神经符号主义 AI，也称神经符号混合主义。它的目标，是融合两大范式的优点，创造出一个既能像神经网络一样从数据中学习，又能像符号系统一样进行逻辑推理的混合智能体。换言之，它试图将亚符号主义擅长的模式识别与符号主义擅长的逻辑推理结合起来。诺贝尔经济学奖得主丹尼尔·卡尼曼（Daniel Kahneman）在其著作《思考，快与慢》（Thinking, Fast and Slow）中提出的双系统理论，为我们理解神经符号主义提供了一个绝佳的类比<sup>[2]</sup>。按照图 1.4 从左到右的展示顺序，这种对应关系可以概括为：
 
 - <strong>系统 1</strong>是快速、凭直觉、并行的思维模式，类似于亚符号主义 AI 强大的模式识别能力。
 - <strong>系统 2</strong>是缓慢、有条理、基于逻辑的审慎思维，恰如符号主义 AI 的推理过程。
+- <strong>神经符号主义 AI</strong>则将系统 1 的模式识别与系统 2 的逻辑推理结合起来，使二者协同工作。
 
 <div align="center">
-  <img src="https://raw.githubusercontent.com/datawhalechina/Hello-Agents/main/docs/images/1-figures/1757242319667-4.png" alt="图片描述" width="90%"/>
-  <p>图 1.4 符号主义、亚符号主义与神经符号混合主义的知识表示范式</p>
+  <img src="https://raw.githubusercontent.com/datawhalechina/Hello-Agents/main/docs/images/1-figures/1757242319667-4.png" alt="亚符号主义、符号主义与神经符号主义的关系示意图" width="90%"/>
+  <p>图 1.4 亚符号主义、符号主义与神经符号混合主义的知识表示范式</p>
 </div>
 
-人类的智能，正源于这两个系统的协同工作。同样，一个真正鲁棒的 AI，也需要兼具二者之长。大语言模型驱动的智能体是神经符号主义的一个极佳实践范例。其内核是一个巨大的神经网络，使其具备模式识别和语言生成能力。然而，当它工作时，它会生成一系列结构化的中间步骤，如思想、计划或 API 调用，这些都是明确的、可操作的符号。通过这种方式，它实现了感知与认知、直觉与理性的初步融合。
+人类的智能，正源于这两个系统的协同工作。同样，一个真正鲁棒的 AI，也需要兼具二者之长。大语言模型驱动的智能体是神经符号主义的一个极佳实践范例：其内核是一个巨大的神经网络，使其具备模式识别和语言生成能力；在工作过程中，它又会生成一系列结构化的中间步骤，如思想、计划或 API 调用，这些都是明确的、可操作的符号。通过这种方式，它将基于神经网络的模式识别与基于符号的逻辑推理结合起来。
 
 
 
```

---

### Incident Patch 8: `4318ebf3` (2026-08-12)
**Commit Message**: Merge pull request #800 from datawhalechina/feature/reviewed-fixes-batch

fix: 修复 #745 至 #642 已审核的代码问题

**File**: `code/chapter10/14_weather_agent.py` (modified, +9/-3)
```diff
@@ -16,14 +16,21 @@ def create_weather_assistant():
         name="天气助手",
         llm=llm,
         system_prompt="""你是天气助手，可以查询城市天气。
-使用 get_weather 工具查询天气，支持中文城市名。
+使用 mcp_get_weather 工具查询天气，支持中文城市名。
 """
     )
 
     # 添加天气 MCP 工具
     server_script = os.path.join(os.path.dirname(__file__), "14_weather_mcp_server.py")
     weather_tool = MCPTool(server_command=["python", server_script])
-    assistant.add_tool(weather_tool)
+
+    # 显式展开并注册 MCP 子工具
+    expanded_tools = weather_tool.get_expanded_tools()
+    if not expanded_tools:
+        raise RuntimeError("未发现天气 MCP 子工具，请检查服务脚本、依赖和启动日志。")
+
+    for expanded_tool in expanded_tools:
+        assistant.add_tool(expanded_tool)
 
     return assistant
 
@@ -55,4 +62,3 @@ def interactive():
         demo()
     else:
         interactive()
-
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/src/env.d.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+/// <reference types="vite/client" />
+
+interface ImportMetaEnv {
+  readonly VITE_API_BASE_URL?: string
+  readonly VITE_AMAP_WEB_JS_KEY: string
+}
+
+interface ImportMeta {
+  readonly env: ImportMetaEnv
+}
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/src/views/Home.vue` (modified, +6/-1)
```diff
@@ -216,7 +216,12 @@ const loading = ref(false)
 const loadingProgress = ref(0)
 const loadingStatus = ref('')
 
-const formData = reactive<TripFormData & { start_date: Dayjs | null; end_date: Dayjs | null }>({
+type TripFormState = Omit<TripFormData, 'start_date' | 'end_date'> & {
+  start_date: Dayjs | null
+  end_date: Dayjs | null
+}
+
+const formData = reactive<TripFormState>({
   city: '',
   start_date: null,
   end_date: null,
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/src/views/Result.vue` (modified, +0/-43)
```diff
@@ -786,49 +786,6 @@ const exportAsPDF = async () => {
   }
 }
 
-// 截取地图图片
-const captureMapImage = async () => {
-  if (!map) return
-
-  try {
-    // 获取地图容器
-    const mapContainer = document.getElementById('amap-container')
-    if (!mapContainer) return
-
-    // 使用高德地图的截图功能
-    const mapCanvas = mapContainer.querySelector('canvas')
-    if (mapCanvas) {
-      // 创建一个img元素替换地图容器
-      const img = document.createElement('img')
-      img.src = mapCanvas.toDataURL('image/png')
-      img.style.width = '100%'
-      img.style.height = '500px'
-      img.style.objectFit = 'cover'
-      img.id = 'map-snapshot'
-
-      // 隐藏原地图,显示截图
-      mapContainer.style.display = 'none'
-      mapContainer.parentElement?.appendChild(img)
-    }
-  } catch (error) {
-    console.error('截取地图失败:', error)
-  }
-}
-
-// 恢复地图
-const restoreMap = () => {
-  const mapContainer = document.getElementById('amap-container')
-  const snapshot = document.getElementById('map-snapshot')
-
-  if (mapContainer) {
-    mapContainer.style.display = 'block'
-  }
-
-  if (snapshot) {
-    snapshot.remove()
-  }
-}
-
 // 初始化地图
 const initMap = async () => {
   try {
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/tsconfig.json` (modified, +1/-1)
```diff
@@ -27,6 +27,6 @@
       "@/*": ["src/*"]
     }
   },
-  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
+  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "src/**/*.d.ts"]
 }
 
```

---

### Incident Patch 9: `6acdf952` (2026-08-12)
**Commit Message**: fix: address reviewed issues 642 through 745

**File**: `code/chapter10/14_weather_agent.py` (modified, +9/-3)
```diff
@@ -16,14 +16,21 @@ def create_weather_assistant():
         name="天气助手",
         llm=llm,
         system_prompt="""你是天气助手，可以查询城市天气。
-使用 get_weather 工具查询天气，支持中文城市名。
+使用 mcp_get_weather 工具查询天气，支持中文城市名。
 """
     )
 
     # 添加天气 MCP 工具
     server_script = os.path.join(os.path.dirname(__file__), "14_weather_mcp_server.py")
     weather_tool = MCPTool(server_command=["python", server_script])
-    assistant.add_tool(weather_tool)
+
+    # 显式展开并注册 MCP 子工具
+    expanded_tools = weather_tool.get_expanded_tools()
+    if not expanded_tools:
+        raise RuntimeError("未发现天气 MCP 子工具，请检查服务脚本、依赖和启动日志。")
+
+    for expanded_tool in expanded_tools:
+        assistant.add_tool(expanded_tool)
 
     return assistant
 
@@ -55,4 +62,3 @@ def interactive():
         demo()
     else:
         interactive()
-
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/src/env.d.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+/// <reference types="vite/client" />
+
+interface ImportMetaEnv {
+  readonly VITE_API_BASE_URL?: string
+  readonly VITE_AMAP_WEB_JS_KEY: string
+}
+
+interface ImportMeta {
+  readonly env: ImportMetaEnv
+}
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/src/views/Home.vue` (modified, +6/-1)
```diff
@@ -216,7 +216,12 @@ const loading = ref(false)
 const loadingProgress = ref(0)
 const loadingStatus = ref('')
 
-const formData = reactive<TripFormData & { start_date: Dayjs | null; end_date: Dayjs | null }>({
+type TripFormState = Omit<TripFormData, 'start_date' | 'end_date'> & {
+  start_date: Dayjs | null
+  end_date: Dayjs | null
+}
+
+const formData = reactive<TripFormState>({
   city: '',
   start_date: null,
   end_date: null,
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/src/views/Result.vue` (modified, +0/-43)
```diff
@@ -786,49 +786,6 @@ const exportAsPDF = async () => {
   }
 }
 
-// 截取地图图片
-const captureMapImage = async () => {
-  if (!map) return
-
-  try {
-    // 获取地图容器
-    const mapContainer = document.getElementById('amap-container')
-    if (!mapContainer) return
-
-    // 使用高德地图的截图功能
-    const mapCanvas = mapContainer.querySelector('canvas')
-    if (mapCanvas) {
-      // 创建一个img元素替换地图容器
-      const img = document.createElement('img')
-      img.src = mapCanvas.toDataURL('image/png')
-      img.style.width = '100%'
-      img.style.height = '500px'
-      img.style.objectFit = 'cover'
-      img.id = 'map-snapshot'
-
-      // 隐藏原地图,显示截图
-      mapContainer.style.display = 'none'
-      mapContainer.parentElement?.appendChild(img)
-    }
-  } catch (error) {
-    console.error('截取地图失败:', error)
-  }
-}
-
-// 恢复地图
-const restoreMap = () => {
-  const mapContainer = document.getElementById('amap-container')
-  const snapshot = document.getElementById('map-snapshot')
-
-  if (mapContainer) {
-    mapContainer.style.display = 'block'
-  }
-
-  if (snapshot) {
-    snapshot.remove()
-  }
-}
-
 // 初始化地图
 const initMap = async () => {
   try {
```

**File**: `code/chapter13/helloagents-trip-planner/frontend/tsconfig.json` (modified, +1/-1)
```diff
@@ -27,6 +27,6 @@
       "@/*": ["src/*"]
     }
   },
-  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
+  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "src/**/*.d.ts"]
 }
 
```

---

### Incident Patch 10: `486679fc` (2026-08-10)
**Commit Message**: Merge pull request #729 from mvanhorn/fix/703-aitown-env-load

fix(chapter15): load backend .env so LLM_API_KEY is read at startup

**File**: `code/chapter15/Helloagents-AI-Town/backend/config.py` (modified, +4/-1)
```diff
@@ -3,6 +3,10 @@
 import os
 from typing import Optional
 
+from dotenv import load_dotenv
+
+load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
+
 class Settings:
     """应用配置"""
     
@@ -39,4 +43,3 @@ def validate(cls):
         return True
 
 settings = Settings()
-
```

**File**: `code/chapter15/Helloagents-AI-Town/backend/requirements.txt` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ fastapi>=0.104.0
 uvicorn[standard]>=0.24.0
 pydantic>=2.0.0
 requests>=2.31.0
+python-dotenv>=1.0.0
 
 # CORS支持
 python-multipart>=0.0.6
```

#### Recent Merged Pull Requests:
- **PR #938** (closed): fix(PaperGraph): 修复检索、阅读和数据一致性，补充论文 Skills (@DeLunnLi)
- **PR #930** (closed): fix(chapter 6):  migrate AgentScopeDemo to AgentScope 2.0 (@raychenfj)
- **PR #929** (2026-09-22): docs: update Chapter 5 Coze tutorial for latest interface and correct the table number (@yimengzhiyan)
- **PR #928** (closed): update chapter code files (@boyun02)
- **PR #922** (2026-09-20): [毕业设计] MADF - 多智能体讨论框架 (@jjyaoao)
- **PR #921** (2026-09-29): [毕业设计] PaperGraph - 一个面向科研阅读与文献管理的智能论文助手 (@jjyaoao)
- **PR #919** (2026-09-26): [毕业设计] ThinkFlow - AI智能思维教练 (@jjyaoao)
- **PR #918** (2026-09-29): [毕业设计] Way_to_Engineer - AI学习助手 (@jjyaoao)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
