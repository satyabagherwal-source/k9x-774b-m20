# Forensic Learning Record (Deep Inspection): datawhalechina/hello-agents

> **Canonical Artifact**: `07_PROJECT_LEARNING/datawhalechina-hello-agents-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/datawhalechina/hello-agents](https://github.com/datawhalechina/hello-agents))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:31.557Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `datawhalechina/hello-agents`
- **Description**: 📚 《从零开始构建智能体》——从零开始的智能体原理与实践教程
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 81742 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

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
        """处理建议任务"""
        try:
            # 获取用户的历史写作数据
            user_writing_history = await self._get_user_writing_history(user_id)
            
            suggest_prompt = f"""
            请对以下文本提供改进建议：
            
            文本内容：
            {content}
            
            用户写作历史：
            {json.dumps(user_writing_history, ensure_ascii=False, indent=2)}
            
            上下文信息：
            {json.dumps(context, ensure_ascii=False, indent=2)}
            
            请提供：
            1. 整体评价
            2. 具体改进建议（按重要性排序）
            3. 语法和表达问题
            4. 结构优化建议
            5. 学术表达改进
            
            请以JSON格式返回结果。
            """
            
            response = await self.think(suggest_prompt)
            
            try:
                result = json.loads(response)
            except json.JSONDecodeError:
                result = {
                    "overall_evaluation": "文本整体质量良好",
                    "improvement_suggestions": ["建议加强逻辑表达", "可以增加更多细节"],
                    "grammar_issues": ["检查时态一致性"],
                    "structure_suggestions": ["建议优化段落结构"],
                    "academic_improvements": ["使用更正式的学术词汇"]
                }
            
            self._add_to_history(f"完成建议任务: {content[:50]}...")
            return result
            
        except Exception as e:
            self._add_to_history(f"建议任务失败: {str(e)}")
            return {
                "overall_evaluation": f"分析过程中出现错误: {str(e)}",
                "improvement_suggestions": [],
                "grammar_issues": [],
                "structure_suggestions": [],
                "academic_improvements": []
            }
    
    async def _get_user_context(self, user_id: str) -> Dict[str, Any]:
        """获取用户的研究背景"""
        try:
            user = await db_manager.get_user(user_id)
            if user:
                return user.get("profile", {})
            return {}
        except Exception:
            return {}
    
    async def _get_user_wri
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/controller.py`
```
"""
InnoCore AI 智能体控制器
负责四大智能体的协同调度和任务编排
"""

import asyncio
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime
import json
import logging
from enum import Enum

from agents.base import BaseAgent
from agents.hunter import HunterAgent
from agents.miner import MinerAgent
from agents.coach import CoachAgent
from agents.validator import ValidatorAgent
from core.config import get_config
from core.exceptions import AgentException, TimeoutException

logger = logging.getLogger(__name__)

class TaskType(Enum):
    """任务类型枚举"""
    PAPER_HUNTING = "paper_hunting"
    PAPER_ANALYSIS = "paper_analysis"
    WRITING_ASSISTANCE = "writing_assistance"
    CITATION_VALIDATION = "citation_validation"
    FULL_WORKFLOW = "full_workflow"

class TaskStatus(Enum):
    """任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class AgentController:
    """智能体控制器"""
    
    def __init__(self):
        self.config = get_config()
        
        # 初始化智能体
        self.agents = {
            "hunter": HunterAgent(),
            "miner": MinerAgent(),
            "coach": CoachAgent(),
            "validator": ValidatorAgent()
        }
        
        # 任务管理
        self.active_tasks = {}
        self.task_history = []
        self.task_queue = asyncio.Queue()
        
        # 并发控制
        self.semaphore = asyncio.Semaphore(self.config.concurrent_agents)
        
        # 事件回调
        self.event_callbacks = {
            "task_started": [],
            "task_completed": [],
            "task_failed": [],
            "agent_status_changed": []
        }
    
    async def initialize(self):
        """初始化控制器"""
        logger.info("初始化Agent Controller...")
        
        # 这里可以添加智能体的初始化逻辑
        # 例如加载模型、建立连接等
        
        logger.info("Agent Controller初始化完成")
    
    async def submit_task(self, task_type: TaskType, input_data: Dict[str, Any], 
                         priority: int = 0, callback: Callable = None) -> str:
        """提交任务"""
        task_id = f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{len(self.active_tasks)}"
        
        task = {
            "id": task_id,
            "type": task_type,
            "input_data": input_data,
            "status": TaskStatus.PENDING,
            "priority": priority,
            "callback": callback,
            "created_at": datetime.now(),
            "started_at": None,
            "completed_at": None,
            "result": None,
            "error": None,
            "agent_results": {}
        }
        
        self.active_tasks[task_id] = task
        await self.task_queue.put((priority, task))
        
        logger.info(f"任务已提交: {task_id}, 类型: {task_type.value}")
        return task_id
    
    async def execute_task(self, task_id: str) -> Dict[str, Any]:
        """执行单个任务"""
        if task_id not in self.active_tasks:
            raise AgentException(f"任务不存在: {task_id}")
        
        task = self.active_tasks[task_id]
        
        async with self.semaphore:  # 并发控制
            try:
                task["status"] = TaskStatus.RUNNING
                task["started_at"] = datetime.now()
                
                await self._trigger_event("task_started", task)
                
                # 根据任务类型执行相应的逻辑
                if task["type"] == TaskType.PAPER_HUNTING:
                    result = await self._execute_paper_hunting(task)
                elif task["type"] == TaskType.PAPER_ANALYSIS:
                    result = await self._execute_paper_analysis(task)
                elif task["type"] == TaskType.WRITING_ASSISTANCE:
                    result = await self._execute_writing_assistance(task)
                elif task["type"] == TaskType.CITATION_VALIDATION:
                    result = await self._execute_citation_validation(task)
                elif task["type"] == TaskType.FULL_WORKFLOW:
                    result = await self._execute_full_workflow(task)
                else:
                    raise AgentException(f"不支持的任务类型: {task['type']}")
                
                task["status"] = TaskStatus.COMPLETED
                task["completed_at"] = datetime.now()
                task["result"] = result
                
                await self._trigger_event("task_completed", task)
                
                # 执行回调
                if task["callback"]:
                    await task["callback"](task)
                
                return result
                
            except Exception as e:
                task["status"] = TaskStatus.FAILED
                task["completed_at"] = datetime.now()
                task["error"] = str(e)
                
                await self._trigger_event("task_failed", task)
                
                logger.error(f"任务执行失败 {task_id}: {str(e)}")
                raise AgentException(f"任务执行失败: {str(e)}")
            
            finally:
                # 移动到历史记录
                self.task_history.append(task.copy())
                del self.active_tasks[task_id]
    
    async def _execute_paper_hunting(self, task: Dict) -> Dict[str, Any]:
        """执行论文抓取任务"""
        input_data = task["input_data"]
        
        # 调用Hunter Agent
        hunter_result = await self.agents["hunter"].run(input_data)
        task["agent_results"]["hunter"] = hunter_result
        
        return {
            "task_type": "paper_hunting",
            "papers_found": hunter_result.get("downloaded_papers", []),
            "statistics": {
                "total_found": hunter_result.get("total_found", 0),
                "downloaded": hunter_result.get("downloaded_papers", 0)
            }
        }
    
    async def _execute_paper_analysis(self, task: Dict) -> Dict[str, Any]:
        """执行论文分析任务"""
        input_data = task["input_data"]
        
        # 调用Miner Agent
        miner_result = await self.agents["miner"].run(input_data)
        task["agent_results"]["miner"] = miner_result
        
        return {
            "task_type": "paper_analysis",
            "analysis_report": miner_result,
            "paper_id": input_data.get("paper_id")
        }
    
    async def _execute_writing_assistance(self, task: Dict) -> Dict[str, Any]:
        """执行写作辅助任务"""
        input_data = task["input_data"]
        
        # 调用Coach Agent
        coach_result = await self.agents["coach"].run(input_data)
        task["agent_results"]["coach"] = coach_result
        
        return {
            "task_type": "writing_assistance",
            "assistance_result": coach_result,
            "user_id": input_data.get("user_id")
        }
    
    async def _execute_citation_validation(self, task: Dict) -> Dict[str, Any]:
        """执行引用校验任务"""
        input_data = task["input_data"]
        
        # 调用Validator Agent
        validator_result = await self.agents["validator"].run(input_data)
        task["agent_results"]["validator"] = validator_result
        
        return {
            "task_type": "citation_validation",
            "validation_result": validator_result,
            "paper_info": input_data.get("paper_info")
        }
    
    async def _execute_full_workflow(self, task: Dict) -> Dict[str, Any]:
        """执行完整工作流"""
        input_data = task["input_data"]
        user_id = input_data.get("user_id")
        keywords = input_data.get("keywords", [])
        
        workflow_result = {
            "task_type": "full_workflow",
            "stages": {},
            "final_papers": [],
            "analysis_reports": []
        }
        
        try:
            # Stage 1: 论文抓取
            self._add_to_history("开始论文抓取阶段")
            hunting_input = {
                "keywords": keywords,
                "max_papers": input_data.get("max_papers", 10),
                "sources": input_data.get("sources", ["arxiv"])
            }
            
            hunting_result = await self.agents["hunter"].run(hunting_input)
            workflow_result["stages"]["hunting"] = hunting_result
            task["agent_results"]["hunter"] = hunting_result
            
            downloaded_papers = hunting_result.get("papers", [])
            workflow_result["final_papers"] = downloaded_papers
            
            # Stage 2: 论文分析
            self._add_to_history("开始论文分析阶段")
            for paper in downloaded_papers:
                if paper.get("db_id"):
                    analysis_input = {
                        "paper_id": paper["db_id"],
                        "user_id": user_id,
                        "analysis_type": "full"
                    }
                    
                    try:
                        analysis_result = await self.agents["miner"].run(analysis_input)
                        workflow_result["analysis_reports"].append(analysis_result)
                    except Exception as e:
                        self._add_to_history(f"论文分析失败 {paper.get('title', 'Unknown')}: {str(e)}")
            
            # Stage 3: 引用校验（可选）
            if input_data.get("validate_citations", False):
                self._add_to_history("开始引用校验阶段")
                for paper in downloaded_papers:
                    paper_info = {
                        "title": paper.get("title", ""),
                        "authors": paper.get("authors", []),
                        "doi": paper.get("doi", ""),
                        "year": datetime.now().year
                    }
                    
                    validation_input = {
                        "paper_info": paper_info,
                        "formats": ["bibtex", "apa"],
                        "verify_external": True
                    }
                    
                    try:
                        validation_result = await self.agents["validator"].run(validation_input)
                        paper["citations"] = validation_result.get("citations", {})
                    except Exception as e:
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/hunter.py`
```
"""
InnoCore AI 前哨探员 (Hunter Agent)
负责每日根据关键词监控ArXiv/IEEE，初筛并下载PDF
"""

import asyncio
import aiohttp
import feedparser
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import hashlib
import os
from urllib.parse import urljoin, quote

from agents.base import BaseAgent
from core.database import db_manager
from core.exceptions import AgentException, ExternalAPIException

class HunterAgent(BaseAgent):
    """前哨探员智能体"""
    
    def __init__(self, llm=None):
        super().__init__("Hunter", llm)
        self.arxiv_base_url = "http://export.arxiv.org/api/query"
        self.ieee_base_url = "https://ieeexploreapi.ieee.org/api/v1"
        self.download_dir = "downloads/papers"
        
        # 确保下载目录存在
        os.makedirs(self.download_dir, exist_ok=True)
        
        # 添加工具
        self.add_tool("search_arxiv", self._search_arxiv, "搜索ArXiv论文")
        self.add_tool("search_ieee", self._search_ieee, "搜索IEEE论文")
        self.add_tool("download_pdf", self._download_pdf, "下载PDF文件")
        self.add_tool("extract_metadata", self._extract_metadata, "提取论文元数据")
    
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行论文抓取任务"""
        await self.validate_input(input_data)
        
        self.set_state("running")
        
        try:
            keywords = input_data["keywords"]
            max_papers = input_data.get("max_papers", 20)
            sources = input_data.get("sources", ["arxiv", "ieee"])
            days_back = input_data.get("days_back", 1)
            
            all_papers = []
            
            # 搜索不同来源
            if "arxiv" in sources:
                arxiv_papers = await self._search_papers_from_arxiv(keywords, max_papers, days_back)
                all_papers.extend(arxiv_papers)
            
            if "ieee" in sources:
                ieee_papers = await self._search_papers_from_ieee(keywords, max_papers, days_back)
                all_papers.extend(ieee_papers)
            
            # 去重和筛选
            unique_papers = self._deduplicate_papers(all_papers)
            filtered_papers = await self._filter_papers(unique_papers, keywords)
            
            # 下载PDF
            downloaded_papers = []
            for paper in filtered_papers[:max_papers]:
                try:
                    downloaded_paper = await self._download_and_save_paper(paper)
                    if downloaded_paper:
                        downloaded_papers.append(downloaded_paper)
                except Exception as e:
                    self._add_to_history(f"下载论文失败 {paper.get('title', 'Unknown')}: {str(e)}")
            
            self.set_state("completed")
            
            return {
                "status": "success",
                "total_found": len(all_papers),
                "unique_papers": len(unique_papers),
                "filtered_papers": len(filtered_papers),
                "downloaded_papers": len(downloaded_papers),
                "papers": downloaded_papers
            }
            
        except Exception as e:
            self.set_state("error")
            raise AgentException(f"Hunter Agent执行失败: {str(e)}")
    
    def get_required_fields(self) -> List[str]:
        """获取必需的输入字段"""
        return ["keywords"]
    
    async def _search_papers_from_arxiv(self, keywords: List[str], max_papers: int, days_back: int) -> List[Dict]:
        """从ArXiv搜索论文"""
        papers = []
        
        # 构建查询字符串
        query_parts = []
        for keyword in keywords:
            query_parts.append(f'all:"{keyword}"')
        query = " OR ".join(query_parts)
        
        # 添加时间过滤
        date_filter = ""
        if days_back > 0:
            start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y%m%d")
            date_filter = f"submittedDate:[{start_filter}0000 TO {datetime.now().strftime('%Y%m%d')}2359]"
        
        params = {
            "search_query": query,
            "start": 0,
            "max_results": max_papers * 2,  # 获取更多结果以便筛选
            "sortBy": "submittedDate",
            "sortOrder": "descending"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.arxiv_base_url, params=params) as response:
                    if response.status != 200:
                        raise ExternalAPIException(f"ArXiv API请求失败: {response.status}")
                    
                    xml_content = await response.text()
                    feed = feedparser.parse(xml_content)
                    
                    for entry in feed.entries:
                        paper = {
                            "id": entry.id.split("/")[-1],
                            "title": entry.title,
                            "authors": [author.name for author in entry.authors],
                            "abstract": entry.summary,
                            "published": entry.published,
                            "pdf_url": entry.link.replace('/abs/', '/pdf/') + '.pdf',
                            "source": "arxiv",
                            "doi": entry.get('arxiv_doi', ''),
                            "categories": [tag.term for tag in entry.tags]
                        }
                        
                        papers.append(paper)
                        
        except Exception as e:
            self._add_to_history(f"ArXiv搜索失败: {str(e)}")
        
        return papers
    
    async def _search_papers_from_ieee(self, keywords: List[str], max_papers: int, days_back: int) -> List[Dict]:
        """从IEEE搜索论文"""
        papers = []
        
        # IEEE API需要API key，这里提供基础实现框架
        config = self.config.external_apis
        
        if not config.ieee_base_url:
            self._add_to_history("IEEE API配置缺失，跳过IEEE搜索")
            return papers
        
        # 构建查询参数
        query = " OR ".join([f'"All Meta Data:{keyword}"' for keyword in keywords])
        
        params = {
            "apikey": config.ieee_api_key or "",
            "querytext": query,
            "max_records": max_papers * 2,
            "start_record": 1,
            "sort_order": "desc",
            "sort_field": "publication_date"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.ieee_base_url, params=params) as response:
                    if response.status != 200:
                        raise ExternalAPIException(f"IEEE API请求失败: {response.status}")
                    
                    data = await response.json()
                    
                    for article in data.get("articles", []):
                        paper = {
                            "id": article.get("article_number", ""),
                            "title": article.get("title", ""),
                            "authors": [author.get("full_name", "") for author in article.get("authors", {}).get("authors", [])],
                            "abstract": article.get("abstract", ""),
                            "published": article.get("publication_date", ""),
                            "pdf_url": article.get("pdf_url", ""),
                            "source": "ieee",
                            "doi": article.get("doi", ""),
                            "categories": article.get("index_terms", {}).get("ieee_terms", {}).get("terms", [])
                        }
                        
                        papers.append(paper)
                        
        except Exception as e:
            self._add_to_history(f"IEEE搜索失败: {str(e)}")
        
        return papers
    
    def _deduplicate_papers(self, papers: List[Dict]) -> List[Dict]:
        """去重论文"""
        seen_titles = set()
        unique_papers = []
        
        for paper in papers:
            title = paper.get("title", "").lower().strip()
            title_hash = hashlib.md5(title.encode()).hexdigest()
            
            if title_hash not in seen_titles:
                seen_titles.add(title_hash)
                unique_papers.append(paper)
        
        return unique_papers
    
    async def _filter_papers(self, papers: List[Dict], keywords: List[str]) -> List[Dict]:
        """根据关键词筛选论文"""
        filtered_papers = []
        
        for paper in papers:
            title = paper.get("title", "").lower()
            abstract = paper.get("abstract", "").lower()
            combined_text = f"{title} {abstract}"
            
            # 计算关键词匹配分数
            score = 0
            for keyword in keywords:
                keyword_lower = keyword.lower()
                if keyword_lower in title:
                    score += 2  # 标题匹配权重更高
                if keyword_lower in abstract:
                    score += 1
            
            # 设定阈值
            if score >= 1:
                paper["relevance_score"] = score
                filtered_papers.append(paper)
        
        # 按相关性分数排序
        filtered_papers.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        
        return filtered_papers
    
    async def _download_and_save_paper(self, paper: Dict) -> Optional[Dict]:
        """下载并保存论文"""
        pdf_url = paper.get("pdf_url")
        if not pdf_url:
            return None
        
        try:
            # 生成文件名
            safe_title = re.sub(r'[^\w\s-]', '', paper.get("title", "unknown"))[:50]
            filename = f"{paper['id']}_{safe_title}.pdf"
            file_path = os.path.join(self.download_dir, filename)
            
            # 检查文件是否已存在
            if os.path.exists(file_path):
                self._add_to_history(f"论文已存在: {filename}")
                paper["file_path"] = file_path
                return paper
            
            # 下载PDF
            async with aiohttp.ClientSession() as session:
                async with session.get(pdf_url) as response:
                    if response.status == 200:

```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/miner.py`
```
"""
InnoCore AI 洞察专家 (Miner Agent)
核心大脑。负责阅读、理解、检索历史库、对比分析并生成报告
"""

import asyncio
from typing import Dict, List, Optional, Any
import json
import re
from datetime import datetime

from agents.base import BaseAgent
from core.database import db_manager
from core.vector_store import vector_store_manager
from core.exceptions import AgentException

class MinerAgent(BaseAgent):
    """洞察专家智能体"""
    
    def __init__(self, llm=None):
        super().__init__("Miner", llm)
        
        # 添加工具
        self.add_tool("parse_pdf", self._parse_pdf, "解析PDF文件")
        self.add_tool("search_memory", self._search_memory, "搜索记忆库")
        self.add_tool("compare_papers", self._compare_papers, "对比论文")
        self.add_tool("generate_report", self._generate_report, "生成分析报告")
    
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行论文分析和创新点挖掘任务"""
        await self.validate_input(input_data)
        
        self.set_state("running")
        
        try:
            paper_id = input_data["paper_id"]
            user_id = input_data.get("user_id")
            analysis_type = input_data.get("analysis_type", "full")  # full, quick, innovation_only
            
            # 获取论文信息
            paper = await db_manager.get_paper(paper_id)
            if not paper:
                raise AgentException(f"论文不存在: {paper_id}")
            
            self._add_to_history(f"开始分析论文: {paper['title']}")
            
            # 1. 解析PDF内容
            parsed_content = await self._parse_paper_content(paper)
            
            # 2. 检索相关历史论文
            related_papers = await self._find_related_papers(
                paper["title"], 
                paper["abstract"], 
                user_id
            )
            
            # 3. 进行对比分析
            comparison_result = await self._perform_comparison_analysis(
                parsed_content, 
                related_papers
            )
            
            # 4. 生成分析报告
            report = await self._create_analysis_report(
                paper, 
                parsed_content, 
                related_papers, 
                comparison_result,
                user_id
            )
            
            # 5. 保存报告到数据库
            report_id = await self._save_analysis_report(paper_id, report, user_id)
            
            # 6. 更新向量库
            await self._update_vector_store(paper_id, paper, parsed_content, user_id)
            
            self.set_state("completed")
            
            return {
                "status": "success",
                "paper_id": paper_id,
                "report_id": report_id,
                "analysis_type": analysis_type,
                "parsed_content": {
                    "sections": list(parsed_content.get("sections", {}).keys()),
                    "word_count": parsed_content.get("word_count", 0)
                },
                "related_papers_count": len(related_papers),
                "report_summary": {
                    "summary": report.get("summary", "")[:200] + "...",
                    "innovation_points": len(report.get("innovation_points", [])),
                    "limitations": len(report.get("limitations", [])),
                    "future_ideas": len(report.get("future_ideas", []))
                }
            }
            
        except Exception as e:
            self.set_state("error")
            raise AgentException(f"Miner Agent执行失败: {str(e)}")
    
    def get_required_fields(self) -> List[str]:
        """获取必需的输入字段"""
        return ["paper_id"]
    
    async def _parse_paper_content(self, paper: Dict) -> Dict[str, Any]:
        """解析论文内容"""
        file_path = paper.get("file_path")
        if not file_path:
            # 如果没有PDF文件，使用标题和摘要
            return {
                "title": paper.get("title", ""),
                "abstract": paper.get("abstract", ""),
                "sections": {
                    "abstract": paper.get("abstract", ""),
                    "introduction": "",
                    "method": "",
                    "experiment": "",
                    "conclusion": ""
                },
                "word_count": len(paper.get("abstract", "").split()),
                "parsing_method": "metadata_only"
            }
        
        # 这里应该使用专门的PDF解析库
        # 暂时返回模拟的结构化内容
        return await self._extract_structured_content(file_path)
    
    async def _extract_structured_content(self, file_path: str) -> Dict[str, Any]:
        """提取结构化内容"""
        try:
            # 这里应该集成Nougat或PyMuPDF进行深度解析
            # 暂时返回模拟数据
            mock_content = {
                "title": "Sample Paper Title",
                "abstract": "This is a sample abstract...",
                "sections": {
                    "introduction": "In this paper, we propose...",
                    "method": "Our method consists of...",
                    "experiment": "We conducted experiments...",
                    "conclusion": "The results show that..."
                },
                "word_count": 1500,
                "parsing_method": "mock_parser"
            }
            
            self._add_to_history(f"PDF解析完成: {file_path}")
            return mock_content
            
        except Exception as e:
            self._add_to_history(f"PDF解析失败: {str(e)}")
            return {
                "title": "",
                "abstract": "",
                "sections": {},
                "word_count": 0,
                "parsing_method": "failed"
            }
    
    async def _find_related_papers(self, title: str, abstract: str, user_id: str = None) -> List[Dict]:
        """查找相关论文"""
        try:
            # 构建查询
            query = f"{title} {abstract}"
            
            # 执行混合搜索
            search_results = await vector_store_manager.hybrid_search(
                query=query,
                user_id=user_id,
                top_k=10,
                include_l1=True,
                include_l2=bool(user_id)
            )
            
            # 获取详细论文信息
            related_papers = []
            for result in search_results:
                payload = result["payload"]
                paper_id = payload.get("paper_id")
                
                if paper_id:
                    paper_info = await db_manager.get_paper(paper_id)
                    if paper_info:
                        paper_info["similarity_score"] = result["score"]
                        paper_info["collection_type"] = result["collection_type"]
                        related_papers.append(paper_info)
            
            self._add_to_history(f"找到 {len(related_papers)} 篇相关论文")
            return related_papers
            
        except Exception as e:
            self._add_to_history(f"搜索相关论文失败: {str(e)}")
            return []
    
    async def _perform_comparison_analysis(self, current_paper: Dict, related_papers: List[Dict]) -> Dict[str, Any]:
        """执行对比分析"""
        if not related_papers:
            return {
                "comparison_summary": "未找到相关论文进行对比",
                "unique_contributions": [],
                "similar_works": [],
                "gaps_identified": []
            }
        
        # 构建对比分析的prompt
        comparison_prompt = f"""
        请分析当前论文与历史相关论文的对比情况：
        
        当前论文：
        标题：{current_paper.get('title', '')}
        摘要：{current_paper.get('abstract', '')}
        主要内容：{str(current_paper.get('sections', {}))[:1000]}...
        
        相关论文：
        {self._format_related_papers_for_comparison(related_papers[:5])}
        
        请从以下角度进行对比分析：
        1. 方法的创新性和改进点
        2. 实验设计的优势
        3. 与现有工作的区别
        4. 可能的研究空白
        
        请以JSON格式返回分析结果。
        """
        
        try:
            response = await self.think(comparison_prompt)
            
            # 尝试解析JSON响应
            try:
                comparison_result = json.loads(response)
            except json.JSONDecodeError:
                # 如果JSON解析失败，使用文本解析
                comparison_result = self._parse_text_comparison(response)
            
            self._add_to_history("对比分析完成")
            return comparison_result
            
        except Exception as e:
            self._add_to_history(f"对比分析失败: {str(e)}")
            return {
                "comparison_summary": "对比分析过程中出现错误",
                "unique_contributions": [],
                "similar_works": [],
                "gaps_identified": []
            }
    
    def _format_related_papers_for_comparison(self, papers: List[Dict]) -> str:
        """格式化相关论文用于对比"""
        formatted = []
        for i, paper in enumerate(papers, 1):
            formatted.append(f"""
            论文{i}：
            标题：{paper.get('title', '')}
            摘要：{paper.get('abstract', '')[:300]}...
            相似度：{paper.get('similarity_score', 0):.3f}
            """)
        return "\n".join(formatted)
    
    def _parse_text_comparison(self, text: str) -> Dict[str, Any]:
        """解析文本格式的对比结果"""
        # 简单的文本解析逻辑
        return {
            "comparison_summary": text[:500],
            "unique_contributions": ["基于文本分析的创新点"],
            "similar_works": ["相关研究工作"],
            "gaps_identified": ["研究空白识别"]
        }
    
    async def _create_analysis_report(self, paper: Dict, parsed_content: Dict, 
                                    related_papers: List[Dict], comparison_result: Dict,
                                    user_id: str = None) -> Dict[str, Any]:
        """创建分析报告"""
        
        report_prompt = f"""
        基于以下信息，生成一份详细的论文分析报告：
        
        论文信息：
        标题：{paper.get('title', '')}
        作者：{', '.join(paper.get('authors', []))}
        摘要：{paper.get('abstract', '')}
        
        解析内容：
        {str(parsed_content.get('sections', {}))[:1500]}...
        
        对比分析结果：
        {str(comparison_result)[:1000]}...
        
        请生成包含以下部分的报告：
        1. Summary - 论文主要贡献和方法概述
        2. Innovation - 相比相关论文的创新点
        3. Limitation - 当前研究的
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/agents/validator.py`
```
"""
InnoCore AI 校验官 (Validator Agent)
负责生成引用格式并联网校验元数据
"""

import asyncio
import aiohttp
import re
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import hashlib

from agents.base import BaseAgent
from core.database import db_manager
from core.exceptions import AgentException, ExternalAPIException

class ValidatorAgent(BaseAgent):
    """校验官智能体"""
    
    def __init__(self, llm=None):
        super().__init__("Validator", llm)
        
        # API配置
        self.crossref_base_url = "https://api.crossref.org/works"
        self.google_scholar_url = "https://serpapi.com/search"
        
        # 添加工具
        self.add_tool("generate_bibtex", self._generate_bibtex, "生成BibTeX引用")
        self.add_tool("generate_apa", self._generate_apa, "生成APA格式引用")
        self.add_tool("generate_ieee", self._generate_ieee, "生成IEEE格式引用")
        self.add_tool("verify_metadata", self._verify_metadata, "校验元数据")
        self.add_tool("crossref_lookup", self._crossref_lookup, "CrossRef查询")
        self.add_tool("scholar_lookup", self._scholar_lookup, "Google Scholar查询")
    
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """执行引用校验任务"""
        await self.validate_input(input_data)
        
        self.set_state("running")
        
        try:
            paper_info = input_data["paper_info"]
            formats = input_data.get("formats", ["bibtex", "apa", "ieee"])
            verify_external = input_data.get("verify_external", True)
            
            # 1. 生成多种格式的引用
            citations = await self._generate_citations(paper_info, formats)
            
            # 2. 外部校验元数据
            verification_result = {}
            if verify_external:
                verification_result = await self._verify_paper_metadata(paper_info)
            
            # 3. 合并和更新引用信息
            final_citations = await self._merge_citation_data(
                citations, 
                verification_result, 
                paper_info
            )
            
            # 4. 缓存结果
            await self._cache_citation_results(final_citations)
            
            self.set_state("completed")
            
            return {
                "status": "success",
                "paper_info": paper_info,
                "citations": final_citations,
                "verification": verification_result,
                "formats_generated": list(citations.keys()),
                "verification_status": verification_result.get("status", "unknown"),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.set_state("error")
            raise AgentException(f"Validator Agent执行失败: {str(e)}")
    
    def get_required_fields(self) -> List[str]:
        """获取必需的输入字段"""
        return ["paper_info"]
    
    async def _generate_citations(self, paper_info: Dict, formats: List[str]) -> Dict[str, Any]:
        """生成多种格式的引用"""
        citations = {}
        
        for format_type in formats:
            try:
                if format_type.lower() == "bibtex":
                    citations["bibtex"] = await self._generate_bibtex_citation(paper_info)
                elif format_type.lower() == "apa":
                    citations["apa"] = await self._generate_apa_citation(paper_info)
                elif format_type.lower() == "ieee":
                    citations["ieee"] = await self._generate_ieee_citation(paper_info)
                else:
                    self._add_to_history(f"不支持的引用格式: {format_type}")
                    
            except Exception as e:
                self._add_to_history(f"生成{format_type}格式失败: {str(e)}")
                citations[format_type] = f"生成失败: {str(e)}"
        
        return citations
    
    async def _generate_bibtex_citation(self, paper_info: Dict) -> str:
        """生成BibTeX格式引用"""
        # 生成引用键
        first_author = paper_info.get("authors", [""])[0]
        if isinstance(first_author, str):
            last_name = first_author.split()[-1].lower()
        else:
            last_name = "unknown"
        
        year = paper_info.get("year", datetime.now().year)
        title_words = paper_info.get("title", "").split()[:3]
        title_key = "".join([w.lower() for w in title_words if w.isalpha()])
        
        citation_key = f"{last_name}{year}{title_key}"
        
        # 构建BibTeX条目
        entry_type = self._determine_entry_type(paper_info)
        
        bibtex = f"@{entry_type}{{{citation_key},\n"
        
        # 添加作者
        authors = paper_info.get("authors", [])
        if authors:
            bibtex += f"  author = {{{self._format_bibtex_authors(authors)}}},\n"
        
        # 添加标题
        title = paper_info.get("title", "")
        if title:
            bibtex += f"  title = {{{title}}},\n"
        
        # 添加期刊/会议信息
        if entry_type == "article":
            journal = paper_info.get("journal", "")
            if journal:
                bibtex += f"  journal = {{{journal}}},\n"
            
            volume = paper_info.get("volume", "")
            if volume:
                bibtex += f"  volume = {{{volume}}},\n"
            
            number = paper_info.get("number", "")
            if number:
                bibtex += f"  number = {{{number}}},\n"
            
            pages = paper_info.get("pages", "")
            if pages:
                bibtex += f"  pages = {{{pages}}},\n"
        
        elif entry_type == "inproceedings":
            booktitle = paper_info.get("booktitle", "")
            if booktitle:
                bibtex += f"  booktitle = {{{booktitle}}},\n"
            
            pages = paper_info.get("pages", "")
            if pages:
                bibtex += f"  pages = {{{pages}}},\n"
        
        # 添加年份
        if year:
            bibtex += f"  year = {{{year}}},\n"
        
        # 添加DOI
        doi = paper_info.get("doi", "")
        if doi:
            bibtex += f"  doi = {{{doi}}},\n"
        
        # 添加URL
        url = paper_info.get("url", "")
        if url:
            bibtex += f"  url = {{{url}}},\n"
        
        # 移除最后的逗号并关闭
        bibtex = bibtex.rstrip(",\n") + "\n}"
        
        return bibtex
    
    async def _generate_apa_citation(self, paper_info: Dict) -> str:
        """生成APA格式引用"""
        authors = paper_info.get("authors", [])
        year = paper_info.get("year", "")
        title = paper_info.get("title", "")
        
        # 格式化作者
        if len(authors) == 0:
            author_text = ""
        elif len(authors) == 1:
            author_text = authors[0]
        elif len(authors) == 2:
            author_text = f"{authors[0]} & {authors[1]}"
        elif len(authors) <= 7:
            author_text = ", ".join(authors[:-1]) + f", & {authors[-1]}"
        else:
            author_text = ", ".join(authors[:6]) + f", ... {authors[-1]}"
        
        # 构建APA引用
        if year:
            apa_citation = f"{author_text} ({year}). {title}."
        else:
            apa_citation = f"{author_text}. {title}."
        
        # 添加期刊信息
        journal = paper_info.get("journal", "")
        volume = paper_info.get("volume", "")
        number = paper_info.get("number", "")
        pages = paper_info.get("pages", "")
        
        if journal:
            if volume and number:
                apa_citation += f" *{journal}*, *{volume}({number})*"
            elif volume:
                apa_citation += f" *{journal}*, *{volume}*"
            else:
                apa_citation += f" *{journal}*"
            
            if pages:
                apa_citation += f", {pages}."
            else:
                apa_citation += "."
        
        # 添加DOI
        doi = paper_info.get("doi", "")
        if doi:
            apa_citation += f" https://doi.org/{doi}"
        
        return apa_citation
    
    async def _generate_ieee_citation(self, paper_info: Dict) -> str:
        """生成IEEE格式引用"""
        authors = paper_info.get("authors", [])
        year = paper_info.get("year", "")
        title = paper_info.get("title", "")
        
        # 格式化作者（IEEE使用首字母缩写）
        ieee_authors = []
        for author in authors[:3]:  # IEEE通常只列出前3个作者
            if isinstance(author, str):
                parts = author.split()
                if len(parts) >= 2:
                    last_name = parts[-1]
                    initials = " ".join([p[0] + "." for p in parts[:-1]])
                    ieee_authors.append(f"{initials} {last_name}")
                else:
                    ieee_authors.append(author)
        
        if len(authors) > 3:
            ieee_authors.append("et al.")
        
        author_text = ", ".join(ieee_authors)
        
        # 构建IEEE引用
        if title:
            ieee_citation = f'"{title},"'
        else:
            ieee_citation = ""
        
        # 添加期刊信息
        journal = paper_info.get("journal", "")
        volume = paper_info.get("volume", "")
        number = paper_info.get("number", "")
        pages = paper_info.get("pages", "")
        
        if journal:
            if volume and number:
                ieee_citation += f" *{journal}*, vol. {volume}, no. {number}"
            elif volume:
                ieee_citation += f" *{journal}*, vol. {volume}"
            else:
                ieee_citation += f" *{journal}*"
            
            if pages:
                ieee_citation += f", pp. {pages}"
        
        # 添加年份和月份
        if year:
            month = paper_info.get("month", "")
            if month:
                ieee_citation += f", {month}. {year}."
            else:
                ieee_citation += f", {year}."
        
        # 添加DOI
        doi = paper_info.get("doi", "")
        if doi:
            ieee_citation += f" doi: {doi}"
        
        return ieee_citation
    
    def _determine_entry_type(self, paper_info: Dict) -> str:
        """确定BibTeX条目类型"""
        if paper_info.ge
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/api/__init__.py`
```
"""
InnoCore AI API模块
"""

try:
    from .main import app
    from .routes import *
    __all__ = ["app"]
except ImportError:
    # 当直接导入时，避免相对导入错误
    pass
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/api/main.py`
```
"""
InnoCore API 主应用
"""

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import uvicorn

from core.config import get_config
from core.database import db_manager
from core.vector_store import vector_store_manager
from agents.controller import agent_controller
from .routes import papers, users, tasks, analysis, writing, citations, workflow

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    logger.info("正在启动InnoCore AI...")
    
    # 初始化数据库（可选）
    try:
        await db_manager.initialize()
        logger.info("数据库初始化完成")
    except Exception as e:
        logger.warning(f"数据库初始化失败（将以无数据库模式运行）: {str(e)}")
    
    # 初始化向量存储（可选）
    try:
        await vector_store_manager.initialize()
        logger.info("向量存储初始化完成")
    except Exception as e:
        logger.warning(f"向量存储初始化失败（将以无向量存储模式运行）: {str(e)}")
    
    # 初始化智能体控制器（可选）
    try:
        await agent_controller.initialize()
        logger.info("智能体控制器初始化完成")
        
        # 启动任务处理器
        import asyncio
        asyncio.create_task(agent_controller.start_task_processor())
        logger.info("任务处理器已启动")
    except Exception as e:
        logger.warning(f"智能体控制器初始化失败: {str(e)}")
    
    logger.info("InnoCore AI 启动完成")
    
    yield
    
    # 关闭时清理
    logger.info("正在关闭InnoCore AI...")
    await agent_controller.shutdown()
    await db_manager.close()
    await vector_store_manager.close()
    logger.info("InnoCore AI已关闭")

# 创建FastAPI应用
app = FastAPI(
    title="InnoCore AI API",
    description="智能科研创新助手API",
    version="0.1.0",
    lifespan=lifespan
)

# 配置CORS
config = get_config()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(papers.router, prefix="/api/v1/papers", tags=["papers"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(tasks.router, prefix="/api/v1/tasks", tags=["tasks"])
app.include_router(analysis.router, prefix="/api/v1/analysis", tags=["analysis"])
app.include_router(writing.router, prefix="/api/v1/writing", tags=["writing"])
app.include_router(citations.router, prefix="/api/v1/citations", tags=["citations"])
app.include_router(workflow.router, prefix="/api/v1/workflow", tags=["workflow"])

# 挂载静态文件
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# 获取项目根目录
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

# 挂载静态资源
if os.path.exists(os.path.join(FRONTEND_DIR, "static")):
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_DIR, "static")), name="static")

# 根路径 - 返回前端页面
@app.get("/")
async def root():
    """根路径 - 返回前端首页"""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "message": "Welcome to InnoCore AI API",
        "version": "0.1.0",
        "status": "running"
    }

# 健康检查
@app.get("/health")
async def health_check():
    """健康检查"""
    try:
        # 检查各组件状态
        agent_status = await agent_controller.get_agent_status()
        
        return {
            "status": "healthy",
            "timestamp": "2024-01-01T00:00:00Z",
            "components": {
                "database": "connected",
                "vector_store": "connected",
                "agents": agent_status
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    logger.error(f"全局异常: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": str(exc) if config.debug else "Something went wrong"
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "innocore_ai.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=config.debug,
        log_level="info"
    )
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/api/routes/__init__.py`
```
"""
API路由模块
"""

from . import papers, users, tasks, analysis, writing, citations, workflow

__all__ = ["papers", "users", "tasks", "analysis", "writing", "citations", "workflow"]
```

### Core Architecture Module: `Co-creation-projects/Apricity-InnocoreAI/api/routes/analysis.py`
```
"""
分析相关API路由
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
import logging
import arxiv
import os
from core.config import get_config
from core.llm_adapter import get_llm_adapter
from utils.pdf_parser import pdf_parser

logger = logging.getLogger(__name__)
router = APIRouter()

# 初始化 LLM 适配器（基于 HelloAgent）
config = get_config()
try:
    llm = get_llm_adapter() if config.llm.api_key else None
except Exception as e:
    logger.warning(f"LLM 初始化失败: {str(e)}")
    llm = None

# Pydantic模型
class AnalysisRequest(BaseModel):
    paper_id: str
    user_id: Optional[str] = None
    analysis_type: str = "full"  # full, quick, innovation_only

class ComparisonRequest(BaseModel):
    paper_ids: List[str]
    user_id: Optional[str] = None
    comparison_aspects: List[str] = ["method", "results", "innovation"]

class InnovationSearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    search_scope: str = "both"  # l1, l2, both
    top_k: int = 10

class PaperAnalysisRequest(BaseModel):
    paper_url: str
    analysis_type: str = "summary"  # summary, innovation, comparison, comprehensive

@router.post("/analyze", response_model=Dict[str, Any])
async def analyze_paper(request: PaperAnalysisRequest):
    """分析论文 - 支持 ArXiv URL 和本地 PDF 文件"""
    try:
        if not llm:
            raise HTTPException(status_code=503, detail="AI 服务未配置，请设置 OPENAI_API_KEY")
        
        import re
        paper_url = request.paper_url.strip()
        
        # 检查是否是本地上传的 PDF 文件
        if paper_url.startswith('/uploads/') or paper_url.endswith('.pdf'):
            logger.info(f"检测到本地 PDF 文件: {paper_url}")
            
            # 构建完整的文件路径
            if paper_url.startswith('/uploads/'):
                # 假设上传的文件在 downloads 目录
                file_path = os.path.join('downloads', paper_url.replace('/uploads/', ''))
            else:
                file_path = paper_url
            
            # 检查文件是否存在
            if not os.path.exists(file_path):
                logger.warning(f"PDF 文件不存在: {file_path}")
                raise HTTPException(status_code=404, detail=f"PDF 文件不存在: {paper_url}")
            
            # 解析 PDF 文件
            logger.info(f"开始解析 PDF 文件: {file_path}")
            pdf_result = await pdf_parser.parse_pdf(file_path)
            
            if not pdf_result.get("success"):
                raise HTTPException(status_code=500, detail=pdf_result.get("error", "PDF 解析失败"))
            
            # 使用解析出的内容进行 AI 分析
            title = pdf_result.get("title", "未知标题")
            authors = pdf_result.get("authors", ["未知作者"])
            abstract = pdf_result.get("abstract", "")
            full_text = pdf_result.get("full_text", "")
            
            # 限制文本长度以避免超出 token 限制
            text_for_analysis = full_text[:8000] if len(full_text) > 8000 else full_text
            
            # 根据分析类型生成提示词
            prompts = {
                "summary": f"""请对以下论文进行摘要分析：

标题：{title}
作者：{', '.join(authors)}
摘要：{abstract}

论文内容（前8000字符）：
{text_for_analysis}

请提供：
1. 研究背景和动机
2. 主要方法
3. 核心贡献
4. 实验结果
5. 研究意义

请用中文回答，保持专业和简洁。""",
                
                "innovation": f"""请分析以下论文的创新点：

标题：{title}
摘要：{abstract}

论文内容：
{text_for_analysis}

请详细分析：
1. 技术创新点
2. 方法论创新
3. 理论贡献
4. 与现有工作的区别
5. 潜在应用价值

请用中文回答。""",
                
                "comparison": f"""请对以下论文进行对比分析：

标题：{title}
摘要：{abstract}

论文内容：
{text_for_analysis}

请分析：
1. 与传统方法的对比
2. 优势和劣势
3. 适用场景
4. 性能提升
5. 局限性

请用中文回答。""",
                
                "comprehensive": f"""请对以下论文进行全面综合分析：

标题：{title}
作者：{', '.join(authors)}
摘要：{abstract}

论文内容：
{text_for_analysis}

请提供全面的分析，包括：
1. 研究背景和意义
2. 技术方法详解
3. 创新点分析
4. 实验验证
5. 优缺点评价
6. 未来研究方向
7. 实际应用价值

请用中文回答，保持专业和深度。"""
            }
            
            prompt = prompts.get(request.analysis_type, prompts["summary"])
            
            # 调用 LLM 进行分析
            logger.info(f"开始 AI 分析，类型: {request.analysis_type}")
            response = await llm.ainvoke(prompt)
            analysis_content = response.content if hasattr(response, 'content') else str(response)
            
            return {
                "success": True,
                "paper_info": {
                    "id": "local_pdf",
                    "title": title,
                    "authors": authors,
                    "published_date": "N/A",
                    "url": paper_url,
                    "categories": ["本地文件"],
                    "page_count": pdf_result.get("page_count", 0),
                    "word_count": pdf_result.get("word_count", 0)
                },
                "analysis_type": request.analysis_type,
                "analysis": analysis_content,
                "abstract": abstract
            }
        
        # ArXiv 论文处理
        arxiv_patterns = [
            r'arxiv\.org/abs/(\d+\.\d+)',
            r'arxiv\.org/pdf/(\d+\.\d+)',
            r'arXiv:(\d+\.\d+)',
            r'\[(\d+\.\d+)v?\d*\]',
            r'^(\d{4}\.\d{4,5})v?\d*$'
        ]
        
        paper_id = None
        for pattern in arxiv_patterns:
            match = re.search(pattern, paper_url, re.IGNORECASE)
            if match:
                paper_id = match.group(1)
                break
        
        if not paper_id:
            raise HTTPException(
                status_code=400, 
                detail=f"无效的输入。支持的格式：\n" +
                       "- ArXiv URL: https://arxiv.org/abs/2511.16672\n" +
                       "- ArXiv ID: 2511.16672\n" +
                       "- 本地 PDF: 上传后自动填充"
            )
        
        logger.info(f"正在分析 ArXiv 论文: {paper_id}")
        
        # 获取论文信息
        search = arxiv.Search(id_list=[paper_id])
        paper = next(search.results(), None)
        
        if not paper:
            raise HTTPException(status_code=404, detail=f"未找到 ArXiv 论文: {paper_id}")
        
        # 根据分析类型生成提示词
        prompts = {
            "summary": f"""请对以下论文进行摘要分析：

标题：{paper.title}
作者：{', '.join([a.name for a in paper.authors])}
摘要：{paper.summary}

请提供：
1. 研究背景和动机
2. 主要方法
3. 核心贡献
4. 实验结果
5. 研究意义

请用中文回答，保持专业和简洁。""",
            
            "innovation": f"""请分析以下论文的创新点：

标题：{paper.title}
摘要：{paper.summary}

请详细分析：
1. 技术创新点
2. 方法论创新
3. 理论贡献
4. 与现有工作的区别
5. 潜在应用价值

请用中文回答。""",
            
            "comparison": f"""请对以下论文进行对比分析：

标题：{paper.title}
摘要：{paper.summary}

请分析：
1. 与传统方法的对比
2. 优势和劣势
3. 适用场景
4. 性能提升
5. 局限性

请用中文回答。""",
            
            "comprehensive": f"""请对以下论文进行全面综合分析：

标题：{paper.title}
作者：{', '.join([a.name for a in paper.authors])}
摘要：{paper.summary}
分类：{', '.join(paper.categories)}

请提供全面的分析，包括：
1. 研究背景和意义
2. 技术方法详解
3. 创新点分析
4. 实验验证
5. 优缺点评价
6. 未来研究方向
7. 实际应用价值

请用中文回答，保持专业和深度。"""
        }
        
        prompt = prompts.get(request.analysis_type, prompts["summary"])
        
        # 调用 LLM 进行分析
        response = await llm.ainvoke(prompt)
        analysis_content = response.content if hasattr(response, 'content') else str(response)
        
        return {
            "success": True,
            "paper_info": {
                "id": paper_id,
                "title": paper.title,
                "authors": [a.name for a in paper.authors],
                "published_date": paper.published.strftime("%Y-%m-%d"),
                "url": paper.entry_id,
                "categories": paper.categories
            },
            "analysis_type": request.analysis_type,
            "analysis": analysis_content,
            "abstract": paper.summary
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"论文分析失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

@router.post("/compare", response_model=Dict[str, Any])
async def compare_papers(request: ComparisonRequest):
    """对比多篇论文"""
    try:
        # 这里需要实现论文对比逻辑
        # 暂时返回模拟结果
        
        comparison_result = {
            "paper_ids": request.paper_ids,
            "comparison_aspects": request.comparison_aspects,
            "similarities": ["相似点1", "相似点2"],
            "differences": ["差异点1", "差异点2"],
            "innovation_gaps": ["创新空白1", "创新空白2"],
            "recommendations": ["建议1", "建议2"]
        }
        
        return {
            "success": True,
            "result": comparison_result
        }
        
    except Exception as e:
        logger.error(f"论文对比失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/innovation/search", response_model=Dict[str, Any])
async def search_innovation_opportunities(request: InnovationSearchRequest):
    """搜索创新机会"""
    try:
        # 这里需要实现创新机会搜索逻辑
        # 暂时返回模拟结果
        
        innovation_results = {
            "query": request.query,
            "opportunities": [
                {
                    "title": "创新机会1",
                    "description": "基于当前研究的创新方向",
                    "related_papers": ["paper1", "paper2"],
                    "confidence": 0.85
                },
                {
                    "title": "创新机会2", 
                    "description": "另一个潜在的研究方向",
                    "related_papers": ["paper3", "paper4"],
                    "confidence": 0.72
                }
            ],
            "research_gaps": ["研究空白1", "研究空白2"],
            "future_directions": ["未来方向1", "未来方向2"]
        }
        
        return {
            "success": True,
            "result": innovation_results
        }
        
    except Exception as e:
        logger.error(f"创新机会搜索失败: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/paper/{paper_id}/summary")
async def get_paper_summary(paper_id: str, user_id: Optional[str] = None):
    """获取论文摘要"""
    try:
        # 这里需要实现论文摘要生成逻辑
        # 暂时返回模拟结果
        
        summary = {
            "paper_id": paper_id,
            "summary": "这是一篇关于...的论文，主要贡献包括...",
            "key_contributions": ["贡献1", "贡献2", "贡献3"],

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
 
-However, this powerful intuitive capability also comes with opacity. Sub-symbolic systems are typically viewed as a **Black Box**. It can identify a cat in a picture with amazing accuracy, but if you ask it "why do you think this is a cat?", it likely cannot provide a logically sound explanation. Additionally, it performs poorly on pure logical reasoning tasks and sometimes produces hallucinations that seem reasonable but are factually incorrect.
+Its main advantage lies in transparency and interpretability. Since reasoning steps are explicit, its decision-making process can be fully traced, which is crucial in high-risk fields such as finance and healthcare. However, its "Achilles' heel" lies in fragility: it relies on a complete rule system, but in the real world full of ambiguity and exceptions, any new situation not covered can lead to system failure, which is the so-called "knowledge acquisition bottleneck."
 
 - **Neuro-Symbolic AI**
 
-For a long time, the two camps of symbolism and su
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
 
-However, this powerful intuitive capability also comes with opacity. Sub-symbolic systems are typically viewed as a **Black Box**. It can identify a cat in a picture with amazing accuracy, but if you ask it "why do you think this is a cat?", it likely cannot provide a logically sound explanation. Additionally, it performs poorly on pure logical reasoning tasks and sometimes produces hallucinations that seem reasonable but are factually incorrect.
+Its main advantage lies in transparency and interpretability. Since reasoning steps are explicit, its decision-making process can be fully traced, which is crucial in high-risk fields such as finance and healthcare. However, its "Achilles' heel" lies in fragility: it relies on a complete rule system, but in the real world full of ambiguity and exceptions, any new situation not covered can lead to system failure, which is the so-called "knowledge acquisition bottleneck."
 
 - **Neuro-Symbolic AI**
 
-For a long time, the two camps of symbolism and su
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

**File**: `code/chapter8/03_WorkingMemory_Implementation.py` (modified, +2/-2)
```diff
@@ -66,7 +66,7 @@ def demonstrate_mixed_retrieval_strategy(self):
         print("-" * 40)
         
         print("混合检索策略包括:")
-        print("• TF-IDF向量化语义检索")
+        print("• TF-IDF 向量化词法检索")
         print("• 关键词匹配检索")
         print("• 时间衰减因子")
         print("• 重要性权重调整")
@@ -301,4 +301,4 @@ def main():
         traceback.print_exc()
 
 if __name__ == "__main__":
-    main()
\ No newline at end of file
+    main()
```

**File**: `code/chapter8/08_Agent_Tool_Integration.py` (modified, +11/-13)
```diff
@@ -36,26 +36,24 @@ def setup_agent(self):
         
         print("✅ MemoryTool和RAGTool初始化完成")
         
+        # 注册工具
+        print("\n2. 注册工具...")
+        self.tool_registry = ToolRegistry()
+        self.tool_registry.register_tool(self.memory_tool)
+        self.tool_registry.register_tool(self.rag_tool)
+        print("✅ 工具注册完成")
+
         # 创建Agent
-        print("\n2. 创建Agent...")
+        print("\n3. 创建Agent...")
         self.llm = HelloAgentsLLM()
         self.agent = SimpleAgent(
             name="智能学习助手",
             llm=self.llm,
-            system_prompt="集成记忆和RAG功能的智能助手"
+            system_prompt="集成记忆和RAG功能的智能助手",
+            tool_registry=self.tool_registry
         )
-        
         print("✅ Agent创建完成")
         
-        # 注册工具
-        print("\n3. 注册工具...")
-        self.tool_registry = ToolRegistry()
-        self.tool_registry.register_tool(self.memory_tool)
-        self.tool_registry.register_tool(self.rag_tool)
-        self.agent.tool_registry = self.tool_registry
-        
-        print("✅ 工具注册完成")
-        
         # 显示Agent状态
         print(f"\n📊 Agent状态:")
         print(f"  名称: {self.agent.name}")
@@ -465,4 +463,4 @@ def main():
         traceback.print_exc()
 
 if __name__ == "__main__":
-    main()
\ No newline at end of file
+    main()
```

**File**: `code/chapter8/09_Memory_Types_Deep_Dive.py` (modified, +6/-6)
```diff
@@ -149,35 +149,35 @@ def demonstrate_episodic_memory(self):
         learning_session = [
             {
                 "content": "开始学习Python机器学习",
-                "context": "学习开始",
+                "context": {"stage": "学习开始"},
                 "location": "家里书房",
                 "mood": "专注",
                 "importance": 0.7
             },
             {
                 "content": "学习了线性回归的数学原理",
-                "context": "理论学习",
+                "context": {"stage": "理论学习"},
                 "chapter": "第3章",
                 "difficulty": "中等",
                 "importance": 0.8
             },
             {
                 "content": "实现了第一个线性回归模型",
-                "context": "实践编程",
+                "context": {"stage": "实践编程"},
                 "code_lines": 45,
                 "bugs_fixed": 2,
                 "importance": 0.9
             },
             {
                 "content": "完成了课后练习题",
-                "context": "练习巩固",
+                "context": {"stage": "练习巩固"},
                 "exercises_completed": 5,
                 "accuracy": 0.8,
                 "importance": 0.6
             },
             {
                 "content": "总结今天的学习收获",
-                "context": "学习总结",
+                "context": {"stage": "学习总结"},
                 "key_concepts": ["线性回归", "梯度下降", "损失函数"],
                 "importance": 0.8
             }
@@ -741,4 +741,4 @@ def main():
         traceback.print_exc()
 
 if __name__ == "__main__":
-    main()
\ No newline at end of file
+    main()
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

**File**: `code/chapter8/03_WorkingMemory_Implementation.py` (modified, +2/-2)
```diff
@@ -66,7 +66,7 @@ def demonstrate_mixed_retrieval_strategy(self):
         print("-" * 40)
         
         print("混合检索策略包括:")
-        print("• TF-IDF向量化语义检索")
+        print("• TF-IDF 向量化词法检索")
         print("• 关键词匹配检索")
         print("• 时间衰减因子")
         print("• 重要性权重调整")
@@ -301,4 +301,4 @@ def main():
         traceback.print_exc()
 
 if __name__ == "__main__":
-    main()
\ No newline at end of file
+    main()
```

**File**: `code/chapter8/08_Agent_Tool_Integration.py` (modified, +11/-13)
```diff
@@ -36,26 +36,24 @@ def setup_agent(self):
         
         print("✅ MemoryTool和RAGTool初始化完成")
         
+        # 注册工具
+        print("\n2. 注册工具...")
+        self.tool_registry = ToolRegistry()
+        self.tool_registry.register_tool(self.memory_tool)
+        self.tool_registry.register_tool(self.rag_tool)
+        print("✅ 工具注册完成")
+
         # 创建Agent
-        print("\n2. 创建Agent...")
+        print("\n3. 创建Agent...")
         self.llm = HelloAgentsLLM()
         self.agent = SimpleAgent(
             name="智能学习助手",
             llm=self.llm,
-            system_prompt="集成记忆和RAG功能的智能助手"
+            system_prompt="集成记忆和RAG功能的智能助手",
+            tool_registry=self.tool_registry
         )
-        
         print("✅ Agent创建完成")
         
-        # 注册工具
-        print("\n3. 注册工具...")
-        self.tool_registry = ToolRegistry()
-        self.tool_registry.register_tool(self.memory_tool)
-        self.tool_registry.register_tool(self.rag_tool)
-        self.agent.tool_registry = self.tool_registry
-        
-        print("✅ 工具注册完成")
-        
         # 显示Agent状态
         print(f"\n📊 Agent状态:")
         print(f"  名称: {self.agent.name}")
@@ -465,4 +463,4 @@ def main():
         traceback.print_exc()
 
 if __name__ == "__main__":
-    main()
\ No newline at end of file
+    main()
```

**File**: `code/chapter8/09_Memory_Types_Deep_Dive.py` (modified, +6/-6)
```diff
@@ -149,35 +149,35 @@ def demonstrate_episodic_memory(self):
         learning_session = [
             {
                 "content": "开始学习Python机器学习",
-                "context": "学习开始",
+                "context": {"stage": "学习开始"},
                 "location": "家里书房",
                 "mood": "专注",
                 "importance": 0.7
             },
             {
                 "content": "学习了线性回归的数学原理",
-                "context": "理论学习",
+                "context": {"stage": "理论学习"},
                 "chapter": "第3章",
                 "difficulty": "中等",
                 "importance": 0.8
             },
             {
                 "content": "实现了第一个线性回归模型",
-                "context": "实践编程",
+                "context": {"stage": "实践编程"},
                 "code_lines": 45,
                 "bugs_fixed": 2,
                 "importance": 0.9
             },
             {
                 "content": "完成了课后练习题",
-                "context": "练习巩固",
+                "context": {"stage": "练习巩固"},
                 "exercises_completed": 5,
                 "accuracy": 0.8,
                 "importance": 0.6
             },
             {
                 "content": "总结今天的学习收获",
-                "context": "学习总结",
+                "context": {"stage": "学习总结"},
                 "key_concepts": ["线性回归", "梯度下降", "损失函数"],
                 "importance": 0.8
             }
@@ -741,4 +741,4 @@ def main():
         traceback.print_exc()
 
 if __name__ == "__main__":
-    main()
\ No newline at end of file
+    main()
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

---

### Incident Patch 11: `92e6891c` (2026-08-07)
**Commit Message**: Merge pull request #774 from datawhalechina/codex/fix-reviewed-issues

fix: resolve reviewed documentation issues

**File**: `docs/chapter11/第十一章 Agentic-RL.md` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ rl_tool = RLTrainingTool()
 
 # 1. 快速测试:SFT训练(10个样本，1个epoch)
 sft_result_str = rl_tool.run({
-    "action": "train"，
+    "action": "train",
     "algorithm": "sft",
     "model_name": "Qwen/Qwen3-0.6B",
     "output_dir": "./models/quick_test_sft",
```

**File**: `docs/chapter3/Chapter3-Fundamentals-of-Large-Language-Models.md` (modified, +1/-1)
```diff
@@ -1003,7 +1003,7 @@ This chapter's LLM foundations mainly help everyone better understand large mode
 
 [10] Hoffmann, J., Borgeaud, E., Mensch, A., Buchatskaya, E., Cai, T., Rutherford, R., ... & Sifre, L. (2022). Training Compute-Optimal Large Language Models. arXiv preprint arXiv:2203.07678.
 
-[11] Ji, Z., Lee, N., Fries, R., Yu, T., & Su, D. (2023). Survey of Hallucination in Large Language Models.
+[11] Huang, L., Yu, W., Ma, W., Zhong, W., Feng, Z., Wang, H., ... & Liu, T. (2023). A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions. *arXiv preprint arXiv:2311.05232*.
 
 [12] Bender, E. M., Gebru, T., McMillan-Major, A., & Mitchell, M. (2021). On the Dangers of Stochastic Parrots: Can Language Models Be Too Big? .
 
```

**File**: `docs/chapter3/第三章 大语言模型基础.md` (modified, +1/-1)
```diff
@@ -1013,7 +1013,7 @@ print(response)
 
 [10] Hoffmann, J., Borgeaud, E., Mensch, A., Buchatskaya, E., Cai, T., Rutherford, R., ... & Sifre, L. (2022). Training Compute-Optimal Large Language Models. arXiv preprint arXiv:2203.07678.
 
-[11] Ji, Z., Lee, N., Fries, R., Yu, T., & Su, D. (2023). Survey of Hallucination in Large Language Models.
+[11] Huang, L., Yu, W., Ma, W., Zhong, W., Feng, Z., Wang, H., ... & Liu, T. (2023). A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions. *arXiv preprint arXiv:2311.05232*.
 
 [12] Bender, E. M., Gebru, T., McMillan-Major, A., & Mitchell, M. (2021). On the Dangers of Stochastic Parrots: Can Language Models Be Too Big? .
 
```

**File**: `docs/chapter5/Chapter5-Building-Agents-with-Low-Code-Platforms.md` (modified, +1/-1)
```diff
@@ -1103,7 +1103,7 @@ You are a 24/7 on-call, professional and efficient AI email assistant. Your task
 For the `Simple Vector Store` tool, we need to perform key configurations to ensure it can correctly "read" the knowledge we stored earlier:
 
 - **Operation Mode**: `Retrieve Documents (As Tool for AI Agent)` (read mode as a tool).
-- **Memory Key**: Must fill in the **exact same** Key as in the first part, i.e., `my_private_knowledge`.
+- **Memory Key**: Must fill in the **exact same** Key as in the first part, i.e., `my-dailytime`.
 - **Embeddings**: Must use the **exact same** `Embeddings Google Gemini` model as in the first part.
 
 Only when the `Memory Key` and `Embeddings` model are completely consistent can the Agent use the correct "key" and "language" to access the knowledge base, as shown in Figure 5.62.
```

**File**: `docs/chapter5/第五章 基于低代码平台的智能体搭建.md` (modified, +1/-1)
```diff
@@ -1107,7 +1107,7 @@ return [
 对于 `Simple Vector Store` 工具，我们需要进行关键配置，以确保它能正确“读取”我们之前存入的知识：
 
 - <strong>Operation Mode</strong>: `Retrieve Documents (As Tool for AI Agent)` (作为工具的读取模式)。
-- <strong>Memory Key</strong>: 必须填写与第一部分<strong>完全相同</strong>的 Key，即 `my_private_knowledge`。
+- <strong>Memory Key</strong>: 必须填写与第一部分<strong>完全相同</strong>的 Key，即 `my-dailytime`。
 - <strong>Embeddings</strong>: 必须使用与第一部分<strong>完全相同</strong>的 `Embeddings Google Gemini` 模型。
 
 只有 `Memory Key` 和 `Embeddings` 模型完全一致，Agent 才能用正确的“钥匙”和“语言”来访问知识库,如图5.62所示。
```

**File**: `docs/index.html` (modified, +3/-1)
```diff
@@ -222,9 +222,11 @@
             alias: {
                 // 英文路径映射
                 '/en/README.md': '/README_EN.md',
+                '/en/README_EN.md': '/README_EN.md',
+                '/en/Preface.md': '/Preface.md',
                 '/en/_sidebar.md': '/_sidebar_en.md',
                 '/en/.*/_sidebar.md': '/_sidebar_en.md',
-                '/en/chapter(\\d+)/Chapter(.*)': '/chapter$1/Chapter$2',
+                '/en/(.*)': '/$1',
 
                 // 默认中文侧边栏
                 '/_sidebar.md': '/_sidebar.md',
```

---

### Incident Patch 12: `64941461` (2026-08-07)
**Commit Message**: fix: address reviewed documentation issues

**File**: `docs/chapter11/第十一章 Agentic-RL.md` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ rl_tool = RLTrainingTool()
 
 # 1. 快速测试:SFT训练(10个样本，1个epoch)
 sft_result_str = rl_tool.run({
-    "action": "train"，
+    "action": "train",
     "algorithm": "sft",
     "model_name": "Qwen/Qwen3-0.6B",
     "output_dir": "./models/quick_test_sft",
```

**File**: `docs/chapter3/Chapter3-Fundamentals-of-Large-Language-Models.md` (modified, +1/-1)
```diff
@@ -1003,7 +1003,7 @@ This chapter's LLM foundations mainly help everyone better understand large mode
 
 [10] Hoffmann, J., Borgeaud, E., Mensch, A., Buchatskaya, E., Cai, T., Rutherford, R., ... & Sifre, L. (2022). Training Compute-Optimal Large Language Models. arXiv preprint arXiv:2203.07678.
 
-[11] Ji, Z., Lee, N., Fries, R., Yu, T., & Su, D. (2023). Survey of Hallucination in Large Language Models.
+[11] Huang, L., Yu, W., Ma, W., Zhong, W., Feng, Z., Wang, H., ... & Liu, T. (2023). A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions. *arXiv preprint arXiv:2311.05232*.
 
 [12] Bender, E. M., Gebru, T., McMillan-Major, A., & Mitchell, M. (2021). On the Dangers of Stochastic Parrots: Can Language Models Be Too Big? .
 
```

**File**: `docs/chapter3/第三章 大语言模型基础.md` (modified, +1/-1)
```diff
@@ -1013,7 +1013,7 @@ print(response)
 
 [10] Hoffmann, J., Borgeaud, E., Mensch, A., Buchatskaya, E., Cai, T., Rutherford, R., ... & Sifre, L. (2022). Training Compute-Optimal Large Language Models. arXiv preprint arXiv:2203.07678.
 
-[11] Ji, Z., Lee, N., Fries, R., Yu, T., & Su, D. (2023). Survey of Hallucination in Large Language Models.
+[11] Huang, L., Yu, W., Ma, W., Zhong, W., Feng, Z., Wang, H., ... & Liu, T. (2023). A Survey on Hallucination in Large Language Models: Principles, Taxonomy, Challenges, and Open Questions. *arXiv preprint arXiv:2311.05232*.
 
 [12] Bender, E. M., Gebru, T., McMillan-Major, A., & Mitchell, M. (2021). On the Dangers of Stochastic Parrots: Can Language Models Be Too Big? .
 
```

**File**: `docs/chapter5/Chapter5-Building-Agents-with-Low-Code-Platforms.md` (modified, +1/-1)
```diff
@@ -1103,7 +1103,7 @@ You are a 24/7 on-call, professional and efficient AI email assistant. Your task
 For the `Simple Vector Store` tool, we need to perform key configurations to ensure it can correctly "read" the knowledge we stored earlier:
 
 - **Operation Mode**: `Retrieve Documents (As Tool for AI Agent)` (read mode as a tool).
-- **Memory Key**: Must fill in the **exact same** Key as in the first part, i.e., `my_private_knowledge`.
+- **Memory Key**: Must fill in the **exact same** Key as in the first part, i.e., `my-dailytime`.
 - **Embeddings**: Must use the **exact same** `Embeddings Google Gemini` model as in the first part.
 
 Only when the `Memory Key` and `Embeddings` model are completely consistent can the Agent use the correct "key" and "language" to access the knowledge base, as shown in Figure 5.62.
```

**File**: `docs/chapter5/第五章 基于低代码平台的智能体搭建.md` (modified, +1/-1)
```diff
@@ -1107,7 +1107,7 @@ return [
 对于 `Simple Vector Store` 工具，我们需要进行关键配置，以确保它能正确“读取”我们之前存入的知识：
 
 - <strong>Operation Mode</strong>: `Retrieve Documents (As Tool for AI Agent)` (作为工具的读取模式)。
-- <strong>Memory Key</strong>: 必须填写与第一部分<strong>完全相同</strong>的 Key，即 `my_private_knowledge`。
+- <strong>Memory Key</strong>: 必须填写与第一部分<strong>完全相同</strong>的 Key，即 `my-dailytime`。
 - <strong>Embeddings</strong>: 必须使用与第一部分<strong>完全相同</strong>的 `Embeddings Google Gemini` 模型。
 
 只有 `Memory Key` 和 `Embeddings` 模型完全一致，Agent 才能用正确的“钥匙”和“语言”来访问知识库,如图5.62所示。
```

**File**: `docs/index.html` (modified, +3/-1)
```diff
@@ -222,9 +222,11 @@
             alias: {
                 // 英文路径映射
                 '/en/README.md': '/README_EN.md',
+                '/en/README_EN.md': '/README_EN.md',
+                '/en/Preface.md': '/Preface.md',
                 '/en/_sidebar.md': '/_sidebar_en.md',
                 '/en/.*/_sidebar.md': '/_sidebar_en.md',
-                '/en/chapter(\\d+)/Chapter(.*)': '/chapter$1/Chapter$2',
+                '/en/(.*)': '/$1',
 
                 // 默认中文侧边栏
                 '/_sidebar.md': '/_sidebar.md',
```

---

### Incident Patch 13: `4dcb1c63` (2026-08-07)
**Commit Message**: Merge pull request #771 from Meredith2328/fix/chapter11-grpo-learning-rate

docs(chapter11): 为 GRPO 学习率补充策略坍塌提示（注释与说明）

**File**: `code/chapter11/00_quick_test.py` (modified, +3/-0)
```diff
@@ -83,6 +83,9 @@ def quick_test():
     # ========================================================================
     print("\n测试3: GRPO训练")
     print("-"*80)
+
+    # 注意：GRPO 对学习率比较敏感，默认 5e-5 在小模型（如 Qwen3-0.6B）上
+    # 可能导致策略坍塌（准确率大幅下降），如需更稳定可显式设置 learning_rate=1e-6。
     
     grpo_config = {
         "action": "train",
```

**File**: `code/chapter11/05_grpo_training.py` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ def standard_grpo_training():
         # 训练配置
         "num_epochs": 3,
         "batch_size": 2,  # GRPO需要更多显存
-        "learning_rate": 1e-5,  # 比SFT小10倍
+        "learning_rate": 1e-5,  # 比SFT小10倍；注意：5e-5 在小模型上可能导致策略坍塌，必要时可调至 1e-6
         
         # LoRA配置
         "use_lora": True,
```

**File**: `docs/chapter11/Chapter11-Agentic-RL.md` (modified, +1/-1)
```diff
@@ -1258,7 +1258,7 @@ GRPO has some specific parameters that need to be understood and tuned.
 
 **Optimization Parameters**:
 
-- `learning_rate`: GRPO's learning rate is usually smaller than SFT because we don't want to deviate too far from the SFT model. Recommend 1e-5 to 5e-5.
+- `learning_rate`: GRPO's learning rate is usually smaller than SFT because we don't want to deviate too far from the SFT model. Recommend 1e-6 to 1e-5; too large a learning rate (e.g., 5e-5) on small models may cause policy collapse.
 - `kl_coef`: KL divergence penalty coefficient, controls magnitude of policy updates. Too small (0.01) may cause policy to deviate too far, too large (0.5) may limit learning. Recommend 0.05-0.1.
 - `clip_range`: Policy ratio clipping range, similar to PPO's epsilon. Recommend 0.2.
 
```

**File**: `docs/chapter11/第十一章 Agentic-RL.md` (modified, +1/-1)
```diff
@@ -1254,7 +1254,7 @@ GRPO 有一些特定的参数需要理解和调优。
 
 <strong>优化参数</strong>:
 
-- `learning_rate`: GRPO 的学习率通常比 SFT 小，因为我们不想偏离 SFT 模型太远。建议 1e-5 到 5e-5。
+- `learning_rate`: GRPO 的学习率通常比 SFT 小，因为我们不想偏离 SFT 模型太远。建议 1e-6 到 1e-5；小模型上学习率过大（如 5e-5）可能导致策略坍塌。
 - `kl_coef`: KL 散度惩罚系数，控制策略更新的幅度。太小(0.01)可能导致策略偏离太远，太大(0.5)可能限制学习。建议 0.05-0.1。
 - `clip_range`: 策略比率裁剪范围，类似 PPO 的 epsilon。建议 0.2。
 
```

---

### Incident Patch 14: `4426bbc6` (2026-08-03)
**Commit Message**: Replace 'execute' with 'run' in memory_tool calls

Refactor memory_tool examples for consistency

Updated memory_tool examples to use 'run' method.

Replace execute() with run() and clarify add operation

Updated the execute interface to run() in hello_agents.tools and clarified the add operation's role in the memory system.

Update Chapter8-Memory-and-Retrieval.md

Update Chapter8-Memory-and-Retrieval.md

**File**: `docs/chapter8/Chapter8-Memory-and-Retrieval.md` (modified, +9/-9)
```diff
@@ -340,25 +340,25 @@ agent.tool_registry = tool_registry
 print("=== Adding Multiple Memories ===")
 
 # Add first memory
-result1 = memory_tool.execute("add", content="User Zhang San is a Python developer focusing on machine learning and data analysis", memory_type="semantic", importance=0.8)
+result1 = memory_tool.run("add", content="User Zhang San is a Python developer focusing on machine learning and data analysis", memory_type="semantic", importance=0.8)
 print(f"Memory 1: {result1}")
 
 # Add second memory
-result2 = memory_tool.execute("add", content="Li Si is a frontend engineer skilled in React and Vue.js development", memory_type="semantic", importance=0.7)
+result2 = memory_tool.run("add", content="Li Si is a frontend engineer skilled in React and Vue.js development", memory_type="semantic", importance=0.7)
 print(f"Memory 2: {result2}")
 
 # Add third memory
-result3 = memory_tool.execute("add", content="Wang Wu is a product manager responsible for user experience design and requirements analysis", memory_type="semantic", importance=0.6)
+result3 = memory_tool.run("add", content="Wang Wu is a product manager responsible for user experience design and requirements analysis", memory_type="semantic", importance=0.6)
 print(f"Memory 3: {result3}")
 
 print("\n=== Searching Specific Memories ===")
 # Search for frontend-related memories
 print("🔍 Searching 'frontend engineer':")
-result = memory_tool.execute("search", query="frontend engineer", limit=3)
+result = memory_tool.run("search", query="frontend engineer", limit=3)
 print(result)
 
 print("\n=== Memory Summary ===")
-result = memory_tool.execute("summary")
+result = memory_tool.run("summary")
 print(result)
 ```
 
@@ -445,14 +445,14 @@ For each memory type, we provide different usage examples:
 
 ```python
 # 1. Working Memory - Temporary information, limited capacity
-memory_tool.execute("add",
+memory_tool.run("add",
     content="User just asked a question about Python functions",
     memory_type="working",
     importance=0.6
 )
 
 # 2. Episodic Memory - Specific events and experiences
-memory_tool.execute("add",
+memory_tool.run("add",
     content="On March 15, 2024, user Zhang San completed their first Python project",
     memory_type="episodic",
     importance=0.8,
@@ -461,15 +461,15 @@ memory_tool.execute("add",
 )
 
 # 3. Semantic Memory - Abstract knowledge and concepts
-memory_tool.execute("add",
+memory_tool.run("add",
     content="Python is an interpreted, object-oriented programming language",
     memory_type="semantic",
     importance=0.9,
     knowledge_type="factual"
 )
 
 # 4. Perceptual Memory - Multimodal information
-memory_tool.execute("add",
+memory_tool.run("add",
     content="User uploaded a Python code screenshot containing function definitions",
     memory_type="perceptual",
     importance=0.7,
```

**File**: `docs/chapter8/第八章 记忆与检索.md` (modified, +9/-9)
```diff
@@ -341,25 +341,25 @@ agent.tool_registry = tool_registry
 print("=== 添加多个记忆 ===")
 
 # 添加第一个记忆
-result1 = memory_tool.execute("add", content="用户张三是一名Python开发者，专注于机器学习和数据分析", memory_type="semantic", importance=0.8)
+result1 = memory_tool.run("add", content="用户张三是一名Python开发者，专注于机器学习和数据分析", memory_type="semantic", importance=0.8)
 print(f"记忆1: {result1}")
 
 # 添加第二个记忆
-result2 = memory_tool.execute("add", content="李四是前端工程师，擅长React和Vue.js开发", memory_type="semantic", importance=0.7)
+result2 = memory_tool.run("add", content="李四是前端工程师，擅长React和Vue.js开发", memory_type="semantic", importance=0.7)
 print(f"记忆2: {result2}")
 
 # 添加第三个记忆
-result3 = memory_tool.execute("add", content="王五是产品经理，负责用户体验设计和需求分析", memory_type="semantic", importance=0.6)
+result3 = memory_tool.run("add", content="王五是产品经理，负责用户体验设计和需求分析", memory_type="semantic", importance=0.6)
 print(f"记忆3: {result3}")
 
 print("\n=== 搜索特定记忆 ===")
 # 搜索前端相关的记忆
 print("🔍 搜索 '前端工程师':")
-result = memory_tool.execute("search", query="前端工程师", limit=3)
+result = memory_tool.run("search", query="前端工程师", limit=3)
 print(result)
 
 print("\n=== 记忆摘要 ===")
-result = memory_tool.execute("summary")
+result = memory_tool.run("summary")
 print(result)
 ```
 
@@ -446,14 +446,14 @@ def _add_memory(
 
 ```python
 # 1. 工作记忆 - 临时信息，容量有限
-memory_tool.execute("add",
+memory_tool.run("add",
     content="用户刚才问了关于Python函数的问题",
     memory_type="working",
     importance=0.6
 )
 
 # 2. 情景记忆 - 具体事件和经历
-memory_tool.execute("add",
+memory_tool.run("add",
     content="2024年3月15日，用户张三完成了第一个Python项目",
     memory_type="episodic",
     importance=0.8,
@@ -462,15 +462,15 @@ memory_tool.execute("add",
 )
 
 # 3. 语义记忆 - 抽象知识和概念
-memory_tool.execute("add",
+memory_tool.run("add",
     content="Python是一种解释型、面向对象的编程语言",
     memory_type="semantic",
     importance=0.9,
     knowledge_type="factual"
 )
 
 # 4. 感知记忆 - 多模态信息
-memory_tool.execute("add",
+memory_tool.run("add",
     content="用户上传了一张Python代码截图，包含函数定义",
     memory_type="perceptual",
     importance=0.7,
```

---

### Incident Patch 15: `5640aeb4` (2026-07-31)
**Commit Message**: fix bug

**File**: `Co-creation-projects/BitSecret-GPSAgent/README.md` (modified, +2/-3)
```diff
@@ -16,10 +16,9 @@
 
 ## 🛠️ 技术栈
 
-- Reflection + ReAct + Plan-and-Solve 融合的智能体框架
+- 使用 [Hello-Agents](https://github.com/datawhalechina/hello-agents) API 实现 Reflection + ReAct + Plan-and-Solve 融合的智能体框架
 - [FormalGeo](https://github.com/FormalGeo/FormalGeo) 形式化系统与求解器
-- [SymPy](https://github.com/sympy/sympy) 符号计算库
-- [OpenAI API](https://github.com/openai/openai-python)
+- 符号计算库 [SymPy](https://github.com/sympy/sympy)
 
 ## 🚀 快速开始
 
```

**File**: `Co-creation-projects/BitSecret-GPSAgent/requirements.txt` (modified, +2/-1)
```diff
@@ -3,4 +3,5 @@ dotenv==0.9.9
 matplotlib==3.10.8
 numpy==2.3.5
 sympy==1.14.0
-func-timeout==4.3.5
\ No newline at end of file
+func-timeout==4.3.5
+hello-agents==1.0.0
\ No newline at end of file
```

**File**: `Co-creation-projects/BitSecret-GPSAgent/src/gps/agent_loop.py` (modified, +4/-5)
```diff
@@ -1,8 +1,8 @@
 from symbolic_solver import SymbolicSolver
 from utils import parse_gdl, parse_cdl, load_json, save_json, get_theorems, make_train_val_test_split
 from multiprocessing import Process, Queue
-from openai import OpenAI
 from dotenv import load_dotenv
+from hello_agents import HelloAgentsLLM
 import time
 import os
 import json
@@ -21,7 +21,7 @@ def dprint(msg):
 
 class Agent:
     def __init__(self, api_key, base_url, model_name):
-        self.client = OpenAI(api_key=api_key, base_url=base_url)
+        self.hello_agents_llm = HelloAgentsLLM(model=model_name, api_key=api_key, base_url=base_url)
         self.model_name = model_name
         self.history = []
         self.memory = []
@@ -35,11 +35,10 @@ def run(self, time_sleep=15, max_epoch=6):
         while epoch < max_epoch:
             epoch += 1
             try:
-                response = self.client.chat.completions.create(
-                    model=self.model_name,
+                response = self.hello_agents_llm.invoke(
                     messages=self.memory,
                     response_format={'type': 'json_object'}
-                ).choices[0].message.content
+                ).content
                 if len(response) == 0:
                     max_epoch += 1
                     raise Exception('模型输出内容为空，服务器负载过大，不计入调用次数。')
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
