# Forensic Learning Record (Deep Inspection): DemonDamon/FinnewsHunter

> **Canonical Artifact**: `07_PROJECT_LEARNING/demondamon-finnewshunter-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DemonDamon/FinnewsHunter](https://github.com/DemonDamon/FinnewsHunter))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:19:07.397Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DemonDamon/FinnewsHunter`
- **Description**: FinnewsHunter: Multi-agent financial intelligence platform powered by AgenticX. Real-time news analysis, sentiment fusion, and alpha factor mining.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1496 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/add_raw_html_column.py`
```
"""
数据库迁移：添加 raw_html 字段
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

# 构建数据库 URL
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "finnews_db")

DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

from sqlalchemy import create_engine, text

def add_raw_html_column():
    """添加 raw_html 字段到 news 表"""
    print("🔧 正在添加 raw_html 字段...")
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        # 检查字段是否已存在
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'news' AND column_name = 'raw_html'
        """))
        
        if result.fetchone():
            print("✅ raw_html 字段已存在，无需迁移")
            return
        
        # 添加字段
        conn.execute(text("""
            ALTER TABLE news ADD COLUMN raw_html TEXT
        """))
        conn.commit()
        
        print("✅ raw_html 字段已添加成功！")

if __name__ == "__main__":
    print("=" * 50)
    print("📦 数据库迁移：添加 raw_html 字段")
    print("=" * 50)
    add_raw_html_column()


```

### Core Architecture Module: `backend/app/__init__.py`
```
"""
FinnewsHunter Backend Application
"""
__version__ = "0.1.0"


```

### Core Architecture Module: `backend/app/agents/__init__.py`
```
"""
智能体模块
"""
from .news_analyst import NewsAnalystAgent, create_news_analyst
from .debate_agents import (
    BullResearcherAgent,
    BearResearcherAgent,
    InvestmentManagerAgent,
    DebateWorkflow,
    create_debate_workflow,
)
from .data_collector_v2 import DataCollectorAgentV2, QuickAnalystAgent, create_data_collector
from .orchestrator import DebateOrchestrator, create_orchestrator
from .quantitative_agent import QuantitativeAgent, create_quantitative_agent

__all__ = [
    "NewsAnalystAgent",
    "create_news_analyst",
    "BullResearcherAgent",
    "BearResearcherAgent",
    "InvestmentManagerAgent",
    "DebateWorkflow",
    "create_debate_workflow",
    "DataCollectorAgentV2",
    "QuickAnalystAgent",
    "create_data_collector",
    "DebateOrchestrator",
    "create_orchestrator",
    "QuantitativeAgent",
    "create_quantitative_agent",
]


```

### Core Architecture Module: `backend/app/agents/data_collector.py`
```
"""
数据专员智能体

负责在辩论前搜集和整理相关数据资料，包括：
- 新闻数据（从数据库或BochaAI搜索）
- 财务数据（从AkShare获取）
- 行情数据（实时行情、K线等）
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from agenticx.core.agent import Agent
from ..services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)


class DataCollectorAgent(Agent):
    """数据专员智能体"""
    
    def __init__(self, llm_provider=None, organization_id: str = "finnews"):
        super().__init__(
            name="DataCollector",
            role="数据专员",
            goal="搜集和整理股票相关的新闻、财务和行情数据，为辩论提供全面的信息支持",
            backstory="""你是一位专业的金融数据分析师，擅长从多个数据源搜集和整理信息。
你的职责是在辩论开始前，为Bull/Bear研究员提供全面、准确、及时的数据支持。
你需要：
1. 搜集最新的相关新闻
2. 获取关键财务指标
3. 分析资金流向
4. 整理行情数据
你的工作质量直接影响辩论的深度和专业性。""",
            organization_id=organization_id
        )
        if llm_provider is None:
            llm_provider = get_llm_provider()
        object.__setattr__(self, '_llm_provider', llm_provider)
        logger.info(f"Initialized {self.name} agent")
    
    async def collect_data(
        self,
        stock_code: str,
        stock_name: str,
        data_requirements: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        搜集股票相关数据
        
        Args:
            stock_code: 股票代码
            stock_name: 股票名称
            data_requirements: 数据需求配置
            
        Returns:
            包含各类数据的字典
        """
        logger.info(f"📊 DataCollector: 开始搜集 {stock_name}({stock_code}) 的数据...")
        
        result = {
            "stock_code": stock_code,
            "stock_name": stock_name,
            "collected_at": datetime.utcnow().isoformat(),
            "news": [],
            "financial": {},
            "fund_flow": {},
            "realtime_quote": {},
            "summary": ""
        }
        
        try:
            # 1. 搜集新闻数据
            news_data = await self._collect_news(stock_code, stock_name)
            result["news"] = news_data
            logger.info(f"📰 DataCollector: 搜集到 {len(news_data)} 条新闻")
            
            # 2. 搜集财务数据
            financial_data = await self._collect_financial(stock_code)
            result["financial"] = financial_data
            logger.info(f"💰 DataCollector: 搜集到财务数据")
            
            # 3. 搜集资金流向
            fund_flow = await self._collect_fund_flow(stock_code)
            result["fund_flow"] = fund_flow
            logger.info(f"💸 DataCollector: 搜集到资金流向数据")
            
            # 4. 搜集实时行情
            realtime = await self._collect_realtime_quote(stock_code)
            result["realtime_quote"] = realtime
            logger.info(f"📈 DataCollector: 搜集到实时行情")
            
            # 5. 生成数据摘要
            result["summary"] = await self._generate_summary(result)
            logger.info(f"📋 DataCollector: 数据摘要生成完成")
            
        except Exception as e:
            logger.error(f"DataCollector 搜集数据时出错: {e}", exc_info=True)
            result["error"] = str(e)
        
        return result
    
    async def _collect_news(self, stock_code: str, stock_name: str) -> List[Dict[str, Any]]:
        """搜集新闻数据"""
        from ..services.news_service import news_service
        
        try:
            # 从数据库获取已有新闻
            news_list = await news_service.get_news_by_stock(stock_code, limit=20)
            return [
                {
                    "title": news.title,
                    "content": news.content[:500] if news.content else "",
                    "source": news.source,
                    "published_at": news.published_at.isoformat() if news.published_at else None,
                    "sentiment": news.sentiment
                }
                for news in news_list
            ]
        except Exception as e:
            logger.warning(f"从数据库获取新闻失败: {e}")
            return []
    
    async def _collect_financial(self, stock_code: str) -> Dict[str, Any]:
        """搜集财务数据"""
        from ..services.stock_data_service import stock_data_service
        
        try:
            return await stock_data_service.get_financial_indicators(stock_code) or {}
        except Exception as e:
            logger.warning(f"获取财务数据失败: {e}")
            return {}
    
    async def _collect_fund_flow(self, stock_code: str) -> Dict[str, Any]:
        """搜集资金流向数据"""
        from ..services.stock_data_service import stock_data_service
        
        try:
            return await stock_data_service.get_fund_flow(stock_code) or {}
        except Exception as e:
            logger.warning(f"获取资金流向失败: {e}")
            return {}
    
    async def _collect_realtime_quote(self, stock_code: str) -> Dict[str, Any]:
        """搜集实时行情"""
        from ..services.stock_data_service import stock_data_service
        
        try:
            return await stock_data_service.get_realtime_quote(stock_code) or {}
        except Exception as e:
            logger.warning(f"获取实时行情失败: {e}")
            return {}
    
    async def _generate_summary(self, data: Dict[str, Any]) -> str:
        """使用LLM生成数据摘要"""
        try:
            # 准备摘要内容
            news_summary = ""
            if data.get("news"):
                news_titles = [n["title"] for n in data["news"][:5]]
                news_summary = f"最新新闻（{len(data['news'])}条）:\n" + "\n".join(f"- {t}" for t in news_titles)
            
            financial_summary = ""
            if data.get("financial"):
                f = data["financial"]
                financial_summary = f"""财务指标:
- PE: {f.get('pe', 'N/A')}
- PB: {f.get('pb', 'N/A')}
- ROE: {f.get('roe', 'N/A')}
- 净利润增长率: {f.get('net_profit_growth', 'N/A')}"""
            
            fund_flow_summary = ""
            if data.get("fund_flow"):
                ff = data["fund_flow"]
                fund_flow_summary = f"""资金流向:
- 主力净流入: {ff.get('main_net_inflow', 'N/A')}
- 散户净流入: {ff.get('retail_net_inflow', 'N/A')}"""
            
            realtime_summary = ""
            if data.get("realtime_quote"):
                rt = data["realtime_quote"]
                realtime_summary = f"""实时行情:
- 当前价: {rt.get('price', 'N/A')}
- 涨跌幅: {rt.get('change_pct', 'N/A')}%
- 成交量: {rt.get('volume', 'N/A')}"""
            
            summary = f"""## {data['stock_name']}({data['stock_code']}) 数据摘要

{realtime_summary}

{financial_summary}

{fund_flow_summary}

{news_summary}

数据搜集时间: {data['collected_at']}"""
            
            return summary
            
        except Exception as e:
            logger.error(f"生成数据摘要失败: {e}")
            return f"数据搜集完成，但生成摘要时出错: {e}"
    
    async def analyze_data_quality(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """分析数据质量和完整性"""
        quality = {
            "score": 0,
            "max_score": 100,
            "details": [],
            "recommendations": []
        }
        
        # 检查新闻数据
        news_count = len(data.get("news", []))
        if news_count >= 10:
            quality["score"] += 30
            quality["details"].append(f"✅ 新闻数据充足（{news_count}条）")
        elif news_count >= 5:
            quality["score"] += 20
            quality["details"].append(f"⚠️ 新闻数据较少（{news_count}条）")
            quality["recommendations"].append("建议搜集更多新闻以支持分析")
        elif news_count > 0:
            quality["score"] += 10
            quality["details"].append(f"⚠️ 新闻数据不足（{news_count}条）")
            quality["recommendations"].append("新闻数据偏少，分析可能不够全面")
        else:
            quality["details"].append("❌ 无新闻数据")
            quality["recommendations"].append("缺少新闻数据，建议先进行定向爬取")
        
        # 检查财务数据
        if data.get("financial"):
            quality["score"] += 25
            quality["details"].append("✅ 财务数据完整")
        else:
            quality["details"].append("❌ 缺少财务数据")
            quality["recommendations"].append("无法获取财务指标")
        
        # 检查资金流向
        if data.get("fund_flow"):
            quality["score"] += 20
            quality["details"].append("✅ 资金流向数据完整")
        else:
            quality["details"].append("⚠️ 缺少资金流向数据")
 
```

### Core Architecture Module: `backend/app/agents/data_collector_v2.py`
```
"""
数据专员智能体 V2 (DataCollectorAgent)

统一负责所有数据获取任务，支持：
- 辩论前的初始数据收集
- 辩论中的动态数据补充
- 用户追问时的按需搜索

核心特性：
1. 计划/执行分离：先生成搜索计划，用户确认后再执行
2. 多数据源支持：AkShare、BochaAI、网页搜索、知识库
3. 智能意图识别：根据用户问题自动选择数据源
"""
import logging
import re
import asyncio
from typing import Dict, Any, List, Optional, ClassVar, Pattern
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

from agenticx.core.agent import Agent
from ..services.llm_service import get_llm_provider
from ..services.stock_data_service import stock_data_service
from ..tools.bochaai_search import bochaai_search, SearchResult
from ..tools.interactive_crawler import InteractiveCrawler

logger = logging.getLogger(__name__)


class SearchSource(str, Enum):
    """搜索数据源类型"""
    AKSHARE = "akshare"           # AkShare 财务/行情数据
    BOCHAAI = "bochaai"           # BochaAI Web搜索
    BROWSER = "browser"           # 交互式浏览器搜索
    KNOWLEDGE_BASE = "kb"         # 内部知识库
    ALL = "all"                   # 所有来源


class SearchTask(BaseModel):
    """单个搜索任务"""
    id: str = Field(..., description="任务ID")
    source: SearchSource = Field(..., description="数据源")
    query: str = Field(..., description="搜索查询")
    description: str = Field("", description="任务描述（用于展示给用户）")
    data_type: Optional[str] = Field(None, description="数据类型（如 financial, news, kline）")
    icon: str = Field("🔍", description="图标（用于UI展示）")
    estimated_time: int = Field(3, description="预计耗时（秒）")


class SearchPlan(BaseModel):
    """搜索计划"""
    plan_id: str = Field(..., description="计划ID")
    stock_code: str = Field(..., description="股票代码")
    stock_name: str = Field("", description="股票名称")
    user_query: str = Field(..., description="用户原始问题")
    tasks: List[SearchTask] = Field(default_factory=list, description="搜索任务列表")
    total_estimated_time: int = Field(0, description="总预计耗时（秒）")
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    status: str = Field("pending", description="状态：pending, confirmed, executing, completed, cancelled")


class SearchResult(BaseModel):
    """搜索结果"""
    task_id: str
    source: str
    success: bool
    data: Dict[str, Any] = Field(default_factory=dict)
    summary: str = ""
    error: Optional[str] = None
    execution_time: float = 0


class DataCollectorAgentV2(Agent):
    """
    数据专员智能体 V2
    
    支持"确认优先"模式：
    1. 用户 @数据专员 提问
    2. 生成搜索计划（不执行）
    3. 用户确认后执行
    4. 返回结果
    """
    
    # 关键词到数据源的映射
    KEYWORD_SOURCE_MAP: ClassVar[Dict[str, tuple]] = {
        # 财务相关 -> AkShare
        "财务": (SearchSource.AKSHARE, "financial", "📊"),
        "pe": (SearchSource.AKSHARE, "financial", "📊"),
        "pb": (SearchSource.AKSHARE, "financial", "📊"),
        "roe": (SearchSource.AKSHARE, "financial", "📊"),
        "利润": (SearchSource.AKSHARE, "financial", "📊"),
        "营收": (SearchSource.AKSHARE, "financial", "📊"),
        "估值": (SearchSource.AKSHARE, "financial", "📊"),
        "市盈": (SearchSource.AKSHARE, "financial", "📊"),
        "市净": (SearchSource.AKSHARE, "financial", "📊"),
        "报表": (SearchSource.AKSHARE, "financial", "📊"),
        
        # 资金/行情 -> AkShare
        "资金": (SearchSource.AKSHARE, "fund_flow", "💰"),
        "主力": (SearchSource.AKSHARE, "fund_flow", "💰"),
        "流入": (SearchSource.AKSHARE, "fund_flow", "💰"),
        "流出": (SearchSource.AKSHARE, "fund_flow", "💰"),
        "行情": (SearchSource.AKSHARE, "realtime", "📈"),
        "价格": (SearchSource.AKSHARE, "realtime", "📈"),
        "涨跌": (SearchSource.AKSHARE, "realtime", "📈"),
        "k线": (SearchSource.AKSHARE, "kline", "📈"),
        "走势": (SearchSource.AKSHARE, "kline", "📈"),
        
        # 新闻相关 -> BochaAI
        "新闻": (SearchSource.BOCHAAI, "news", "📰"),
        "资讯": (SearchSource.BOCHAAI, "news", "📰"),
        "报道": (SearchSource.BOCHAAI, "news", "📰"),
        "公告": (SearchSource.BOCHAAI, "news", "📰"),
        "消息": (SearchSource.BOCHAAI, "news", "📰"),
        
        # 上下游/产业链 -> 多源搜索
        "上下游": (SearchSource.BROWSER, "industry", "🔗"),
        "供应链": (SearchSource.BROWSER, "industry", "🔗"),
        "客户": (SearchSource.BROWSER, "industry", "🔗"),
        "供应商": (SearchSource.BROWSER, "industry", "🔗"),
        "合作": (SearchSource.BROWSER, "industry", "🔗"),
        "产业链": (SearchSource.BROWSER, "industry", "🔗"),
    }
    
    def __init__(self, llm_provider=None, organization_id: str = "finnews"):
        super().__init__(
            name="DataCollector",
            role="数据专员",
            goal="根据用户需求，从多个数据源搜集和整理相关信息，支持辩论前准备和辩论中追问",
            backstory="""你是一位专业的金融数据专家，精通各类金融数据源的使用。
你的职责是：
1. 理解用户的数据需求
2. 制定合理的搜索计划
3. 从多个数据源获取数据
4. 整理并格式化数据

你能够访问的数据源包括：
- AkShare: 股票财务指标、K线行情、资金流向等
- BochaAI: 实时新闻搜索、财经报道
- 网页搜索: 百度资讯、搜狗等
- 知识库: 历史新闻和分析数据""",
            organization_id=organization_id
        )
        
        if llm_provider is None:
            llm_provider = get_llm_provider()
        object.__setattr__(self, '_llm_provider', llm_provider)
        
        # 初始化搜索工具
        self._interactive_crawler = InteractiveCrawler(timeout=20)
        
        logger.info(f"✅ Initialized DataCollectorV2 with multi-source search capabilities")
    
    async def generate_search_plan(
        self,
        query: str,
        stock_code: str,
        stock_name: str = ""
    ) -> SearchPlan:
        """
        生成搜索计划（不执行）
        
        根据用户问题分析需要哪些数据，生成待确认的搜索计划
        
        Args:
            query: 用户问题
            stock_code: 股票代码
            stock_name: 股票名称
            
        Returns:
            SearchPlan 对象
        """
        logger.info(f"📋 DataCollector: 为 '{query}' 生成搜索计划...")
        
        plan_id = f"plan_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{stock_code}"
        
        plan = SearchPlan(
            plan_id=plan_id,
            stock_code=stock_code,
            stock_name=stock_name or stock_code,
            user_query=query,
            tasks=[],
            status="pending"
        )
        
        query_lower = query.lower()
        
        # 1. 基于关键词匹配生成任务
        matched_sources = set()
        for keyword, (source, data_type, icon) in self.KEYWORD_SOURCE_MAP.items():
            if keyword in query_lower:
                if (source, data_type) not in matched_sources:
                    matched_sources.add((source, data_type))
                    task = self._create_task(
                        source=source,
                        data_type=data_type,
                        icon=icon,
                        query=query,
                        stock_code=stock_code,
                        stock_name=stock_name
                    )
                    plan.tasks.append(task)
        
        # 2. 如果没有匹配到任何关键词，使用 LLM 分析
        if not plan.tasks:
            plan.tasks = await self._analyze_with_llm(query, stock_code, stock_name)
        
        # 3. 如果还是没有任务，添加默认的综合搜索
        if not plan.tasks:
            plan.tasks = [
                SearchTask(
                    id=f"task_{plan_id}_1",
                    source=SearchSource.BOCHAAI,
                    query=f"{stock_name or stock_code} {query}",
                    description=f"搜索 {stock_name} 相关新闻",
                    icon="📰",
                    estimated_time=3
                ),
                SearchTask(
                    id=f"task_{plan_id}_2",
                    source=SearchSource.AKSHARE,
                    query=query,
                    description="获取最新财务和行情数据",
                    data_type="overview",
                    icon="📊",
                    estimated_time=2
                )
            ]
        
        # 计算总耗时
        plan.total_estimated_time = sum(t.estimated_time for t in plan.tasks)
        
        logger.info(f"✅ 生成搜索计划: {len(plan.tasks)} 个任务，预计耗时 {plan.total_estimated_time}s")
        
        return plan
    
    def _create_task(
        self,
        source: SearchSource,
        data_type: str,
        icon: str,
        query: str,
        stock_code: str,
        stock_name: st
```

### Core Architecture Module: `backend/app/agents/debate_agents.py`
```
"""
辩论智能体 - Phase 2
实现 Bull vs Bear 多智能体辩论机制

支持动态搜索：智能体可以在发言中请求额外数据
格式: [SEARCH: "查询内容" source:数据源]
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from agenticx import Agent

from ..services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

# 数据请求提示词片段（用于启用动态搜索的场景）
DATA_REQUEST_HINT = """
【数据请求】如果需要更多数据支撑你的论点，可以在发言末尾添加搜索请求：
- [SEARCH: "具体数据需求" source:akshare]  -- 财务/行情数据
- [SEARCH: "新闻关键词" source:bochaai]  -- 最新新闻
- [SEARCH: "搜索内容"]  -- 自动选择最佳数据源
请只在确实需要时使用，每次最多1-2个请求。"""


class BullResearcherAgent(Agent):
    """
    看多研究员智能体
    职责：基于新闻和数据，生成看多观点和投资建议
    支持在辩论中请求额外数据
    """
    
    def __init__(self, llm_provider=None, organization_id: str = "finnews"):
        # 先调用父类初始化（Pydantic BaseModel）
        super().__init__(
            name="BullResearcher",
            role="看多研究员",
            goal="从积极角度分析股票，发现投资机会和增长潜力",
            backstory="""你是一位乐观但理性的股票研究员，擅长发现被低估的投资机会。
你善于从新闻和数据中提取正面信息，分析公司的增长潜力、竞争优势和市场机遇。
你的分析注重长期价值，但也关注短期催化剂。
当你发现数据不足以支撑论点时，你会主动请求补充数据。""",
            organization_id=organization_id
        )
        
        # 在 super().__init__() 之后设置 _llm_provider（避免被 Pydantic 清除）
        if llm_provider is None:
            llm_provider = get_llm_provider()
        object.__setattr__(self, '_llm_provider', llm_provider)
        
        logger.info(f"Initialized {self.name} agent")
    
    def analyze(
        self,
        stock_code: str,
        stock_name: str,
        news_list: List[Dict[str, Any]],
        context: str = ""
    ) -> Dict[str, Any]:
        """
        生成看多分析报告
        """
        news_summary = self._summarize_news(news_list)
        
        # 获取当前系统时间
        current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M")
        
        prompt = f"""你是一位看多研究员，请从积极角度分析以下股票：

【当前时间】
{current_time}

【股票信息】
代码：{stock_code}
名称：{stock_name}

【相关新闻摘要】
{news_summary}

【分析背景】
{context if context else "无额外背景信息"}

请从以下角度进行看多分析：

## 1. 核心看多逻辑
- 列出3-5个看多的核心理由
- 每个理由需要有数据或新闻支撑

## 2. 增长催化剂
- 短期催化剂（1-3个月内可能发生的利好）
- 中长期催化剂（3-12个月的增长驱动力）

## 3. 估值分析
- 当前估值是否具有吸引力
- 与同行业对比的优势

## 4. 目标预期
- 给出合理的预期收益空间
- 说明达成条件

## 5. 风险提示
- 虽然看多，但也需要指出可能的风险

请确保分析客观、有理有据，避免盲目乐观。
"""
        
        try:
            response = self._llm_provider.invoke([
                {"role": "system", "content": f"你是{self.role}，{self.backstory}"},
                {"role": "user", "content": prompt}
            ])
            
            analysis_text = response.content if hasattr(response, 'content') else str(response)
            
            return {
                "success": True,
                "agent_name": self.name,
                "agent_role": self.role,
                "stance": "bull",
                "analysis": analysis_text,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Bull analysis failed: {e}")
            return {
                "success": False,
                "agent_name": self.name,
                "stance": "bull",
                "error": str(e)
            }
    
    async def debate_round(self, prompt: str, enable_data_request: bool = True) -> str:
        """
        辩论回合发言（用于实时辩论模式）
        
        Args:
            prompt: 辩论提示词
            enable_data_request: 是否启用数据请求功能
            
        Returns:
            发言内容（可能包含数据请求标记）
        """
        system_content = f"""你是{self.role}，{self.backstory}
你正在参与一场多空辩论，请用专业但有说服力的语气发言。

作为看多方，你的核心任务是：
1. 挖掘公司的增长潜力和投资价值
2. 用数据和事实支撑你的乐观观点
3. 反驳看空方提出的风险点
4. 识别被市场低估的机会"""

        if enable_data_request:
            system_content += DATA_REQUEST_HINT
        
        try:
            response = self._llm_provider.invoke([
                {"role": "system", "content": system_content},
                {"role": "user", "content": prompt}
            ])
            return response.content if hasattr(response, 'content') else str(response)
        except Exception as e:
            logger.error(f"Bull debate round failed: {e}")
            return f"[发言出错: {e}]"
    
    def _summarize_news(self, news_list: List[Dict[str, Any]]) -> str:
        """汇总新闻信息"""
        if not news_list:
            return "暂无相关新闻"
        
        summaries = []
        for i, news in enumerate(news_list[:5], 1):
            title = news.get("title", "")
            sentiment = news.get("sentiment_score")
            sentiment_text = ""
            if sentiment is not None:
                if sentiment > 0.1:
                    sentiment_text = "（利好）"
                elif sentiment < -0.1:
                    sentiment_text = "（利空）"
                else:
                    sentiment_text = "（中性）"
            summaries.append(f"{i}. {title} {sentiment_text}")
        
        return "\n".join(summaries)


class BearResearcherAgent(Agent):
    """
    看空研究员智能体
    职责：基于新闻和数据，识别风险和潜在问题
    支持在辩论中请求额外数据
    """
    
    def __init__(self, llm_provider=None, organization_id: str = "finnews"):
        # 先调用父类初始化（Pydantic BaseModel）
        super().__init__(
            name="BearResearcher",
            role="看空研究员",
            goal="从风险角度分析股票，识别潜在问题和下行风险",
            backstory="""你是一位谨慎的股票研究员，擅长发现被忽视的风险。
你善于从新闻和数据中提取负面信号，分析公司的潜在问题、竞争威胁和市场风险。
你的分析注重风险控制，帮助投资者避免损失。
当你发现数据不足以支撑风险判断时，你会主动请求补充数据。""",
            organization_id=organization_id
        )
        
        # 在 super().__init__() 之后设置 _llm_provider（避免被 Pydantic 清除）
        if llm_provider is None:
            llm_provider = get_llm_provider()
        object.__setattr__(self, '_llm_provider', llm_provider)
        
        logger.info(f"Initialized {self.name} agent")
    
    def analyze(
        self,
        stock_code: str,
        stock_name: str,
        news_list: List[Dict[str, Any]],
        context: str = ""
    ) -> Dict[str, Any]:
        """
        生成看空分析报告
        """
        news_summary = self._summarize_news(news_list)
        
        # 获取当前系统时间
        current_time = datetime.now().strftime("%Y年%m月%d日 %H:%M")
        
        prompt = f"""你是一位看空研究员，请从风险角度分析以下股票：

【当前时间】
{current_time}

【股票信息】
代码：{stock_code}
名称：{stock_name}

【相关新闻摘要】
{news_summary}

【分析背景】
{context if context else "无额外背景信息"}

请从以下角度进行风险分析：

## 1. 核心风险因素
- 列出3-5个主要风险点
- 每个风险需要有数据或新闻支撑

## 2. 负面催化剂
- 短期可能出现的利空事件
- 中长期的结构性风险

## 3. 估值风险
- 当前估值是否过高
- 与同行业对比的劣势

## 4. 下行空间
- 分析可能的下跌幅度
- 触发下跌的条件

## 5. 反驳看多观点
- 针对常见的看多逻辑提出质疑
- 指出乐观预期的不确定性

请确保分析客观、有理有据，避免无根据的悲观。
"""
        
        try:
            response = self._llm_provider.invoke([
                {"role": "system", "content": f"你是{self.role}，{self.backstory}"},
                {"role": "user", "content": prompt}
            ])
            
            analysis_text = response.content if hasattr(response, 'content') else str(response)
            
            return {
                "success": True,
                "agent_name": self.name,
                "agent_role": self.role,
                "stance": "bear",
                "analysis": analysis_text,
                "timestamp": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Bear analysis failed: {e}")
            return {
                "success": False,
                "agent_name": self.name,
                "stance": "bear",
                "error": str(e)
            }
    
    def _summarize_news(self, news_list: List[Dict[str, Any]]) -> str:
        """汇总新闻信息"""
        if not news_list:
            return "暂无相关新闻"
        
        summaries = []
        for i, news in enumerate(news_list[:5], 1):
            title = news.get("title", "")
            sentiment = news.get("sentiment_score")
            sentiment_text = ""
            if sentiment is not None:
                if sentiment > 0.1:
                    sentiment_text = "（利好）"
                elif sentiment < -0.1:
                    sentiment_text = "（利空）"
                else:
                    sentiment_text = "（中性）"
            summaries.append(f"{i}. {title} {se
```

### Core Architecture Module: `backend/app/agents/news_analyst.py`
```
"""
新闻分析师智能体
"""
import logging
from typing import List, Dict, Any, Optional
from agenticx import Agent, Task, BaseTool
from agenticx.core.agent_executor import AgentExecutor

from ..services.llm_service import get_llm_provider
from ..tools import TextCleanerTool

logger = logging.getLogger(__name__)


class NewsAnalystAgent(Agent):
    """
    新闻分析师智能体
    职责：分析金融新闻的情感、影响和关键信息
    """
    
    def __init__(
        self,
        llm_provider=None,
        tools: Optional[List[BaseTool]] = None,
        organization_id: str = "finnews",
        **kwargs
    ):
        """
        初始化新闻分析师智能体
        
        Args:
            llm_provider: LLM 提供者
            tools: 工具列表
            organization_id: 组织ID（用于多租户隔离），默认 "finnews"
            **kwargs: 额外参数
        """
        # 如果没有提供 LLM，使用默认的
        if llm_provider is None:
            llm_provider = get_llm_provider()
        
        # 如果没有提供工具，使用默认工具
        if tools is None:
            tools = [TextCleanerTool()]
        
        # 保存 LLM 和工具供后续使用（在 super().__init__ 之前保存）
        self._llm_provider = llm_provider
        self._tools = tools
        
        # 定义智能体属性（Agent 基类）
        super().__init__(
            name="NewsAnalyst",
            role="金融新闻分析师",
            goal="深度分析金融新闻，提取关键信息，评估市场影响",
            backstory="""你是一位经验丰富的金融新闻分析专家，具有10年以上的证券市场分析经验。
你擅长从新闻中提取关键信息，准确判断新闻对股票市场的影响，并能够识别潜在的投资机会和风险。
你的分析报告准确、专业，深受投资者信赖。""",
            organization_id=organization_id,
            **kwargs
        )
        
        # 创建 AgentExecutor（在 super().__init__ 之后）
        self._executor = None
        self._init_executor(llm_provider, tools)
        
        logger.info(f"Initialized {self.name} agent")
    
    def _init_executor(self, llm_provider=None, tools=None):
        """初始化 AgentExecutor（延迟初始化）"""
        if self._executor is None:
            if llm_provider is None:
                llm_provider = getattr(self, '_llm_provider', None) or get_llm_provider()
            if tools is None:
                tools = getattr(self, '_tools', None) or [TextCleanerTool()]
            
            self._llm_provider = llm_provider
            self._tools = tools
            self._executor = AgentExecutor(
                llm_provider=llm_provider,
                tools=tools
            )
    
    @property
    def executor(self):
        """获取 AgentExecutor（延迟初始化）"""
        if self._executor is None:
            self._init_executor()
        return self._executor
    
    def analyze_news(
        self,
        news_title: str,
        news_content: str,
        news_url: str = "",
        stock_codes: List[str] = None
    ) -> Dict[str, Any]:
        """
        分析单条新闻
        
        Args:
            news_title: 新闻标题
            news_content: 新闻内容
            news_url: 新闻URL
            stock_codes: 关联股票代码
            
        Returns:
            分析结果字典
        """
        # 构建分析提示词
        prompt = f"""你是一位经验丰富的金融新闻分析专家，具有10年以上的证券市场分析经验。
你擅长从新闻中提取关键信息，准确判断新闻对股票市场的影响，并能够识别潜在的投资机会和风险。

请深度分析以下金融新闻，并提供结构化的分析报告：

【新闻标题】
{news_title}

【新闻内容】
{news_content[:2000]}

【关联股票】
{', '.join(stock_codes) if stock_codes else '无'}

请按照以下结构进行专业分析，并严格使用 Markdown 格式输出：

## 摘要

结构性分析，长期利好市场生态**

### 正面影响：
- 核心要点1
- 核心要点2
- 核心要点3

### 潜在挑战：
- 挑战点1
- 挑战点2

---

## 1. 情感倾向：[中性偏利好] （评分：X.X）

**情感判断**：[中性偏利好/利好/利空/中性]**
**综合评分**：+X.X （范围：-1 至 +1）**

**理由说明：**
详细说明评分依据，包括：
- 政策影响分析
- 市场短期/长期影响
- 预期收益/风险评估

---

## 2. 关键信息提取

**请使用标准 Markdown 表格格式，确保表格清晰易读：**

| 类别 | 内容 |
|------|------|
| 公司名称 | XXX公司（全称，股票代码：XXXXXX） |
| 事件时间 | 新闻发布时间：YYYY年MM月DD日；关键事件时间线涵盖YYYY年QXXX |
| 股价变动 | 详细描述股价变化趋势和数据 |
| 财务表现（YYYY年QX） | 关键财务指标（使用具体数字和增长率） |
| 驱动因素 | • 因素1<br>• 因素2<br>• 因素3 |
| 分析师观点 | • 机构1（分析师）：观点内容<br>• 机构2（分析师）：观点内容 |
| 市场情绪指标 | 具体指标和数据 |

**重要说明（表格严格规范）**：
- **禁止跨行**：同一类别下的所有内容必须在**同一行**的单元格内
- **强制换行**：如果同一单元格有多条内容，**必须**使用 `<br>` 分隔，**严禁**使用 Markdown 列表（- 或 1.）或直接换行
- **错误示例**（绝对禁止）：
  | 驱动因素 | • 因素1 |
  |          | • 因素2 |  <-- 错误！不能另起一行
- **正确示例**：
  | 驱动因素 | • 因素1<br>• 因素2 |
- 表头和内容之间用 `|------|------|` 分隔
- 数据要准确，有具体数字时必须标注

---

## 3. 市场影响分析

### 短期影响（1-3个月）
- 影响点1：具体分析
- 影响点2：具体分析

### 中期影响（3-12个月）
- 影响点1：具体分析
- 影响点2：具体分析

### 长期影响（1年以上）
- 影响点1：具体分析
- 影响点2：具体分析

---

## 4. 投资建议

**投资评级**：[推荐买入/谨慎持有/观望/减持]

**建议理由**：
1. 核心逻辑1
2. 核心逻辑2
3. 核心逻辑3

**风险提示**：
- 风险1
- 风险2

---

**格式要求（重要）**：
1. 必须使用标准 Markdown 语法
2. **表格内容严禁跨行**，单元格内换行只能用 `<br>`
3. 标题层级清晰：使用 ##、### 等
4. 列表使用 - 或数字编号（表格外）
5. 加粗使用 **文本**
6. 分隔线使用 ---
7. 评分必须精确到小数点后1位
8. 所有数据必须真实、准确，来源于新闻内容

请确保分析报告专业、准确、结构清晰，特别注意表格格式的规范性，避免表格行错位。
"""
        
        try:
            # 确保 LLM provider 已初始化
            if not hasattr(self, '_llm_provider') or self._llm_provider is None:
                self._llm_provider = get_llm_provider()
            
            logger.info(f"Calling LLM provider: {type(self._llm_provider).__name__}, model: {getattr(self._llm_provider, 'model', 'unknown')}")
            
            # 直接调用 LLM（不使用 AgentExecutor，避免审批暂停）
            response = self._llm_provider.invoke([
                {"role": "system", "content": f"你是{self.role}，{self.backstory}"},
                {"role": "user", "content": prompt}
            ])
            
            logger.info("LLM response received")
            
            # 获取分析结果
            analysis_text = response.content if hasattr(response, 'content') else str(response)
            
            # 修复 Markdown 表格格式
            analysis_text = self._repair_markdown_table(analysis_text)
            
            # 尝试提取结构化信息
            structured_result = self._extract_structured_info(analysis_text)
            
            return {
                "success": True,
                "analysis_result": analysis_text,
                "structured_data": structured_result,
                "agent_name": self.name,
                "agent_role": self.role,
            }
        
        except Exception as e:
            logger.error(f"News analysis failed: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "agent_name": self.name,
            }
    
    def _repair_markdown_table(self, text: str) -> str:
        """
        修复 Markdown 表格格式问题
        主要解决：多行内容被错误拆分为多行单元格，导致首列为空的问题
        """
        import re
        
        lines = text.split('\n')
        new_lines = []
        in_table = False
        last_table_line_idx = -1
        
        for line in lines:
            stripped = line.strip()
            
            # 检测表格行
            is_table_row = stripped.startswith('|') and stripped.endswith('|')
            is_separator = '---' in stripped and '|' in stripped
            
            if is_table_row:
                if not in_table:
                    in_table = True
                
                # 如果是分隔行，直接添加
                if is_separator:
                    new_lines.append(line)
                    last_table_line_idx = len(new_lines) - 1
                    continue
                
                # 检查是否是"坏行"（首列为空）
                # 匹配模式：| 空白 | 内容 |
                parts = [p.strip() for p in stripped.strip('|').split('|')]
                
                # 如果首列为空，且不是第一行，且上一行也是表格行
                if len(parts) >= 2 and not parts[0] and last_table_line_idx >= 0:
                    # 获取上一行
                    prev_line = new_lines[last_table_line_idx]
                    prev_parts = [p.strip() for p in prev_line.strip().strip('|').split('|')]
                    
                    # 确保列数匹配
                    if len(parts) == len(prev_parts):
                        # 将内容合并到上一行的对应列
                        for i in range(1, len(parts)):
                            if parts[i]:
                                prev_parts[i] = f"{prev_parts[i]}<br>• {parts[i]}" if parts[i].startswith('•') else f"{prev_parts[i]}<br>{parts[i]}"
                        
                        # 重建上一行
                        new_prev_line = '| ' + ' | '.join(prev_parts) + ' |'
                        new_lines[last_table_line_idx] = ne
```

### Core Architecture Module: `backend/app/agents/orchestrator.py`
```
"""
协作编排器

负责管理多智能体协作流程，支持：
- 并行分析模式（parallel）
- 实时辩论模式（realtime_debate）
- 快速分析模式（quick_analysis）
- 动态搜索模式（在辩论过程中按需获取数据）
"""
import logging
import asyncio
from typing import Dict, Any, List, Optional, Callable, AsyncGenerator
from datetime import datetime
from enum import Enum

from ..config import get_mode_config, get_default_mode, DebateModeConfig
from ..services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)


class DebatePhase(Enum):
    """辩论阶段"""
    INITIALIZING = "initializing"
    DATA_COLLECTION = "data_collection"
    OPENING = "opening"
    DEBATE = "debate"
    CLOSING = "closing"
    COMPLETED = "completed"
    FAILED = "failed"


class DebateEvent:
    """辩论事件（用于实时流式输出）"""
    def __init__(
        self,
        event_type: str,
        agent_name: str,
        content: str,
        phase: DebatePhase,
        round_number: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.event_type = event_type
        self.agent_name = agent_name
        self.content = content
        self.phase = phase
        self.round_number = round_number
        self.metadata = metadata or {}
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "agent_name": self.agent_name,
            "content": self.content,
            "phase": self.phase.value,
            "round_number": self.round_number,
            "metadata": self.metadata,
            "timestamp": self.timestamp
        }


class DebateOrchestrator:
    """辩论编排器"""
    
    def __init__(
        self,
        mode: str = None,
        llm_provider=None,
        enable_dynamic_search: bool = True
    ):
        """
        初始化辩论编排器
        
        Args:
            mode: 辩论模式 (parallel, realtime_debate, quick_analysis)
            llm_provider: LLM 提供者
            enable_dynamic_search: 是否启用动态搜索（辩论中按需获取数据）
        """
        self.mode = mode or get_default_mode()
        self.config = get_mode_config(self.mode)
        if not self.config:
            raise ValueError(f"未知的辩论模式: {self.mode}")
        
        self.llm_provider = llm_provider or get_llm_provider()
        self.current_phase = DebatePhase.INITIALIZING
        self.current_round = 0
        self.start_time: Optional[datetime] = None
        self.events: List[DebateEvent] = []
        self.is_interrupted = False
        
        # 动态搜索配置
        self.enable_dynamic_search = enable_dynamic_search
        self._search_analyst = None
        
        # 搜索统计
        self.search_stats = {
            "total_requests": 0,
            "successful_searches": 0,
            "data_supplements": []
        }
        
        # 事件回调
        self._event_callbacks: List[Callable[[DebateEvent], None]] = []
        
        logger.info(f"🎭 初始化辩论编排器，模式: {self.mode}, 动态搜索: {enable_dynamic_search}")
    
    def _get_search_analyst(self):
        """懒加载搜索分析师"""
        if self._search_analyst is None and self.enable_dynamic_search:
            from .search_analyst import SearchAnalystAgent
            self._search_analyst = SearchAnalystAgent(self.llm_provider)
        return self._search_analyst
    
    def on_event(self, callback: Callable[[DebateEvent], None]):
        """注册事件回调"""
        self._event_callbacks.append(callback)
    
    def _emit_event(self, event: DebateEvent):
        """触发事件"""
        self.events.append(event)
        for callback in self._event_callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"事件回调出错: {e}")
    
    def interrupt(self, reason: str = "manager_decision"):
        """打断辩论"""
        self.is_interrupted = True
        self._emit_event(DebateEvent(
            event_type="interrupt",
            agent_name="InvestmentManager",
            content=f"辩论被打断: {reason}",
            phase=self.current_phase
        ))
        logger.info(f"⚡ 辩论被打断: {reason}")
    
    async def run(
        self,
        stock_code: str,
        stock_name: str,
        context: str = "",
        news_list: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """运行辩论流程"""
        self.start_time = datetime.utcnow()
        result = {
            "success": False,
            "mode": self.mode,
            "stock_code": stock_code,
            "stock_name": stock_name,
            "trajectory": [],
            "events": []
        }
        
        try:
            self._emit_event(DebateEvent(
                event_type="start",
                agent_name="Orchestrator",
                content=f"开始 {self.config.name}",
                phase=DebatePhase.INITIALIZING
            ))
            
            # 根据模式选择执行流程
            if self.config.flow.type == "parallel_then_summarize":
                result = await self._run_parallel_mode(stock_code, stock_name, context, news_list)
            elif self.config.flow.type == "orchestrated_debate":
                result = await self._run_realtime_debate_mode(stock_code, stock_name, context, news_list)
            elif self.config.flow.type == "single_agent":
                result = await self._run_quick_mode(stock_code, stock_name, context)
            else:
                raise ValueError(f"未知的流程类型: {self.config.flow.type}")
            
            self.current_phase = DebatePhase.COMPLETED
            self._emit_event(DebateEvent(
                event_type="complete",
                agent_name="Orchestrator",
                content="辩论完成",
                phase=DebatePhase.COMPLETED
            ))
            
        except Exception as e:
            logger.error(f"辩论执行失败: {e}", exc_info=True)
            self.current_phase = DebatePhase.FAILED
            result["error"] = str(e)
            self._emit_event(DebateEvent(
                event_type="error",
                agent_name="Orchestrator",
                content=f"辩论失败: {e}",
                phase=DebatePhase.FAILED
            ))
        
        result["events"] = [e.to_dict() for e in self.events]
        result["execution_time"] = (datetime.utcnow() - self.start_time).total_seconds()
        
        return result
    
    async def _run_parallel_mode(
        self,
        stock_code: str,
        stock_name: str,
        context: str,
        news_list: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """运行并行分析模式"""
        from .debate_agents import BullResearcherAgent, BearResearcherAgent, InvestmentManagerAgent
        
        logger.info("🔄 执行并行分析模式")
        
        # 初始化智能体
        bull_agent = BullResearcherAgent(self.llm_provider)
        bear_agent = BearResearcherAgent(self.llm_provider)
        manager_agent = InvestmentManagerAgent(self.llm_provider)
        
        # 准备新闻摘要
        news_summary = self._prepare_news_summary(news_list)
        full_context = f"{context}\n\n{news_summary}" if context else news_summary
        
        self.current_phase = DebatePhase.DEBATE
        
        # 并行执行Bull和Bear分析
        self._emit_event(DebateEvent(
            event_type="analysis_start",
            agent_name="BullResearcher",
            content="开始看多分析",
            phase=self.current_phase
        ))
        self._emit_event(DebateEvent(
            event_type="analysis_start",
            agent_name="BearResearcher",
            content="开始看空分析",
            phase=self.current_phase
        ))
        
        bull_task = asyncio.create_task(
            bull_agent.analyze(stock_code, stock_name, full_context)
        )
        bear_task = asyncio.create_task(
            bear_agent.analyze(stock_code, stock_name, full_context)
        )
        
        bull_analysis, bear_analysis = await asyncio.gather(bull_task, bear_task)
        
        self._emit_event(DebateEvent(
            event_type="analysis_complete",
            agent_name="BullResearcher",
            content=bull_analysis.get("analysis", "")[:200] + "..."
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10** (2024-06-21): **Merge pull request #9 from DemonDamon/main**
  *Symptoms*: remove：删除临时文件

- **Issue #9** (2024-06-21): **remove：删除临时文件**
  *Symptoms*: 

- **Issue #2** (2019-01-10): **爬取长时间历史新闻**
  *Symptoms*: 请教一下，比如新浪，只能看到23页，更久的数据浏览器都不显示，更不用说爬。不知道您是怎么解决的？
  **Post-Mortem & Fix Analysis**:
  > > 请教一下，比如新浪，只能看到23页，更久的数据浏览器都不显示，更不用说爬。不知道您是怎么解决的？  这个应该没法解决，服务端做了限制，爬取前提是有数据respond。

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

### Incident Patch 1: `eb13a7fd` (2026-07-05)
**Commit Message**: fix(stocks,frontend): 改善 A 股初始化与模型选择器后端不可达提示

FR:
- akshare 拉取 A 股时绕过 shell 代理，失败时回落备用列表并给出可读错误
- init_stock_data 复用 fetch_all_a_share_stocks，避免重复解析逻辑
- ModelSelector 区分「后端未连接」与「未配置 LLM」两种空态

AC:
- 代理导致 ProxyError 时返回可操作的中文提示
- 前端后端不可达时展示 backendUnreachable 文案

Made-with: Damon Li
Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `backend/app/api/v1/stocks.py` (modified, +37/-40)
```diff
@@ -6,6 +6,7 @@
 import logging
 from datetime import datetime, timedelta
 from typing import List, Optional
+import asyncio
 from fastapi import APIRouter, Depends, HTTPException, Query
 from pydantic import BaseModel, Field
 from sqlalchemy.ext.asyncio import AsyncSession
@@ -17,7 +18,11 @@
 from ...models.stock import Stock
 from ...models.analysis import Analysis
 from ...models.crawl_task import CrawlTask, CrawlMode, TaskStatus
-from ...services.stock_data_service import stock_data_service
+from ...services.stock_data_service import (
+    stock_data_service,
+    fetch_all_a_share_stocks,
+    FALLBACK_A_SHARE_STOCKS,
+)
 from ...tasks.crawl_tasks import targeted_stock_crawl_task
 
 logger = logging.getLogger(__name__)
@@ -160,59 +165,51 @@ async def init_stock_data(
     初始化股票数据（从 akshare 获取全部 A 股并存入数据库）
     """
     try:
-        import akshare as ak
-        from datetime import datetime
         from sqlalchemy import delete
-        
+
         logger.info("Starting stock data initialization...")
-        
-        df = ak.stock_zh_a_spot_em()
-        
-        if df is None or df.empty:
-            return StockInitResponse(success=False, message="Failed to fetch stocks from akshare", count=0)
-        
+
+        stocks_data = await asyncio.to_thread(fetch_all_a_share_stocks)
+        used_fallback = len(stocks_data) == len(FALLBACK_A_SHARE_STOCKS)
+
         await db.execute(delete(Stock))
-        
+
         count = 0
-        for _, row in df.iterrows():
-            code = str(row['代码'])
-            name = str(row['名称'])
-            
-            if not code or not name or name in ['N/A', 'nan', '']:
-                continue
-            
-            if code.startswith('6'):
-                market = "SH"
-                full_code = f"SH{code}"
-            elif code.startswith('0') or code.startswith('3'):
-                market = "SZ"
-                full_code = f"SZ{code}"
-            else:
-                market = "OTHER"
-                full_code = code
-            
+        now = datetime.utcnow()
+        for item in stocks_data:
             stock = Stock(
-                code=code,
-                name=name,
-                full_code=full_code,
-                market=market,
+                code=item["code"],
+                name=item["name"],
+                full_code=item["full_code"],
+                market=item["market"],
                 status="active",
-                created_at=datetime.utcnow(),
-                updated_at=datetime.utcnow(),
+                created_at=now,
+                updated_at=now,
             )
             db.add(stock)
             count += 1
-        
+
         await db.commit()
-        
-        return StockInitResponse(success=True, message=f"Successfully initialized {count} stocks", count=count)
-        
+
+        message = f"Successfully initialized {count} stocks"
+        if used_fallback:
+            message += " (akshare unavailable, loaded fallback list — check network/proxy)"
+
+        return StockInitResponse(success=True, message=message, count=count)
+
     except ImportError:
         return StockInitResponse(success=False, message="akshare not installed", count=0)
     except Exception as e:
-        logger.error(f"Failed to init stocks: {e}")
+        logger.error(f"Failed to init stocks: {e}", exc_info=True)
         await db.rollback()
-        raise HTTPException(status_code=500, detail=str(e))
+        detail = str(e)
+        if "ProxyError" in detail or "proxy" in detail.lower():
+            detail = (
+                "拉取 A 股数据失败：当前 shell 代理无法访问东方财富。"
+                "请临时关闭 HTTP_PROXY/HTTPS_PROXY 后重试，或使用命令 "
+                "`python -m app.scripts.init_stocks` 初始化。"
+            )
+        raise HTTPException(status_code=500, detail=detail)
 
 
 @router.get("/count")
```

**File**: `backend/app/services/stock_data_service.py` (modified, +102/-1)
```diff
@@ -2,23 +2,124 @@
 股票数据服务 - 使用 akshare 获取真实股票数据
 """
 import logging
+import os
+from contextlib import contextmanager
 from datetime import datetime, timedelta
-from typing import List, Optional, Dict, Any
+from typing import List, Optional, Dict, Any, Iterator
 from functools import lru_cache
 import asyncio
 
 logger = logging.getLogger(__name__)
 
+PROXY_ENV_VARS = (
+    "http_proxy",
+    "https_proxy",
+    "HTTP_PROXY",
+    "HTTPS_PROXY",
+    "all_proxy",
+    "ALL_PROXY",
+)
+
+FALLBACK_A_SHARE_STOCKS: List[Dict[str, str]] = [
+    {"code": "600519", "name": "贵州茅台", "full_code": "SH600519", "market": "SH"},
+    {"code": "000001", "name": "平安银行", "full_code": "SZ000001", "market": "SZ"},
+    {"code": "601318", "name": "中国平安", "full_code": "SH601318", "market": "SH"},
+    {"code": "000858", "name": "五粮液", "full_code": "SZ000858", "market": "SZ"},
+    {"code": "002594", "name": "比亚迪", "full_code": "SZ002594", "market": "SZ"},
+    {"code": "600036", "name": "招商银行", "full_code": "SH600036", "market": "SH"},
+    {"code": "601166", "name": "兴业银行", "full_code": "SH601166", "market": "SH"},
+    {"code": "000333", "name": "美的集团", "full_code": "SZ000333", "market": "SZ"},
+    {"code": "002415", "name": "海康威视", "full_code": "SZ002415", "market": "SZ"},
+    {"code": "600276", "name": "恒瑞医药", "full_code": "SH600276", "market": "SH"},
+    {"code": "000002", "name": "万科A", "full_code": "SZ000002", "market": "SZ"},
+    {"code": "600887", "name": "伊利股份", "full_code": "SH600887", "market": "SH"},
+    {"code": "000725", "name": "京东方A", "full_code": "SZ000725", "market": "SZ"},
+    {"code": "600000", "name": "浦发银行", "full_code": "SH600000", "market": "SH"},
+    {"code": "000063", "name": "中兴通讯", "full_code": "SZ000063", "market": "SZ"},
+    {"code": "600104", "name": "上汽集团", "full_code": "SH600104", "market": "SH"},
+    {"code": "002304", "name": "洋河股份", "full_code": "SZ002304", "market": "SZ"},
+    {"code": "600585", "name": "海螺水泥", "full_code": "SH600585", "market": "SH"},
+    {"code": "000876", "name": "新希望", "full_code": "SZ000876", "market": "SZ"},
+    {"code": "600309", "name": "万华化学", "full_code": "SH600309", "market": "SH"},
+]
+
+
 # 尝试导入 akshare
 try:
     import akshare as ak
     import pandas as pd
     AKSHARE_AVAILABLE = True
 except ImportError:
+    ak = None  # type: ignore[assignment]
+    pd = None  # type: ignore[assignment]
     AKSHARE_AVAILABLE = False
     logger.warning("akshare not installed, using mock data")
 
 
+@contextmanager
+def akshare_direct_connection() -> Iterator[None]:
+    """akshare 访问国内数据源时需绕过 shell 代理，否则易 ProxyError。"""
+    saved = {key: os.environ.pop(key, None) for key in PROXY_ENV_VARS}
+    try:
+        yield
+    finally:
+        for key, value in saved.items():
+            if value is not None:
+                os.environ[key] = value
+
+
+def _normalize_stock_row(code: str, name: str) -> Optional[Dict[str, str]]:
+    if not code or not name or name in {"N/A", "nan", ""}:
+        return None
+    if code.startswith("6"):
+        market, full_code = "SH", f"SH{code}"
+    elif code.startswith(("0", "3")):
+        market, full_code = "SZ", f"SZ{code}"
+    else:
+        market, full_code = "OTHER", code
+    return {"code": code, "name": name, "full_code": full_code, "market": market}
+
+
+def fetch_all_a_share_stocks(use_fallback: bool = True) -> List[Dict[str, str]]:
+    """从 akshare 拉取 A 股列表；失败时可回落到常用股票。"""
+    if not AKSHARE_AVAILABLE:
+        raise ImportError("akshare not installed")
+
+    last_error: Optional[Exception] = None
+    with akshare_direct_connection():
+        for attempt in range(3):
+            try:
+                try:
+                    df = ak.stock_zh_a_spot_em()
+                except Exception as primary_error:
+                    logger.warning("stock_zh_a_spot_em failed: %s", primary_error)
+                    df = ak.stock_info_a_code_name()
+                    if df is not None and not df.empty:
+                    
```

**File**: `frontend/src/components/ModelSelector.tsx` (modified, +16/-2)
```diff
@@ -78,7 +78,7 @@ export default function ModelSelector() {
   const [config, setConfig] = useState<ModelConfig>(DEFAULT_CONFIG)
   
   // 从后端 API 动态加载可用厂商和模型
-  const { data: llmConfig, isLoading } = useQuery({
+  const { data: llmConfig, isLoading, isError } = useQuery({
     queryKey: ['llm-config'],
     queryFn: llmApi.getConfig,
     staleTime: 5 * 60 * 1000, // 缓存 5 分钟
@@ -147,7 +147,21 @@ export default function ModelSelector() {
     )
   }
 
-  // 无可用厂商
+  // 后端未启动或接口不可达（与 API Key 是否配置无关）
+  if (isError || (providers.length === 0 && !llmConfig)) {
+    return (
+      <div className="flex items-center">
+        <Button variant="outline" size="sm" disabled className="gap-2 h-10 rounded-lg px-3 border-orange-300">
+          <AlertCircle className="h-4 w-4 text-orange-500" />
+          <span className="text-sm text-orange-600">
+            {isError ? t.model.backendUnreachable : t.model.notConfigured}
+          </span>
+        </Button>
+      </div>
+    )
+  }
+
+  // 无可用厂商（后端返回空列表，通常是 .env 未配置任何模型厂商）
   if (providers.length === 0) {
     return (
       <div className="flex items-center">
```

**File**: `frontend/src/store/useLanguageStore.ts` (modified, +2/-0)
```diff
@@ -182,6 +182,7 @@ export const globalI18n = {
     model: {
       loading: '加载中...',
       notConfigured: '未配置LLM',
+      backendUnreachable: '后端未连接',
       selectModel: '选择模型',
       selectTip: '选择模型 · 兼顾质量与成本',
       noApiKey: '未配置API Key',
@@ -697,6 +698,7 @@ export const globalI18n = {
     model: {
       loading: 'Loading...',
       notConfigured: 'LLM not configured',
+      backendUnreachable: 'Backend unreachable',
       selectModel: 'Select Model',
       selectTip: 'Select Model - Balance quality & cost',
       noApiKey: 'API Key not configured',
```

---

### Incident Patch 2: `a5a88964` (2026-01-13)
**Commit Message**: fix(frontend): reset analyzing state when switching news

- Add useEffect to reset analyzing state when newsId changes
- Fix issue where analyzing state persists when switching between news items
- Improve user experience by ensuring clean state transitions

**File**: `frontend/src/components/NewsDetailDrawer.tsx` (modified, +6/-1)
```diff
@@ -1,5 +1,5 @@
 import { useQuery } from '@tanstack/react-query'
-import { useState } from 'react'
+import { useState, useEffect } from 'react'
 import { toast } from 'sonner'
 import ReactMarkdown from 'react-markdown'
 import remarkGfm from 'remark-gfm'
@@ -122,6 +122,11 @@ export default function NewsDetailDrawer({
     enabled: !!newsId && open && showRawHtml,
   })
 
+  // 当切换到新新闻时，重置分析状态
+  useEffect(() => {
+    setAnalyzing(false)
+  }, [newsId])
+
   // 处理分享
   const handleShare = async () => {
     if (!news) return
```

---

### Incident Patch 3: `a1f67061` (2026-01-12)
**Commit Message**: fix(i18n): fix K-line chart language switching bug

- Add dynamic locale registration based on language state
- Fix chart not displaying after language switch
- Reset initialization state properly on language change
- Apply chart data immediately after initialization
- Support both Chinese and English locales for chart labels

**File**: `frontend/src/components/KLineChart.tsx` (modified, +65/-6)
```diff
@@ -8,8 +8,37 @@ import { init, dispose, registerLocale } from 'klinecharts'
 import type { Chart } from 'klinecharts'
 import type { KLineDataPoint } from '@/types/api'
 import { cn } from '@/lib/utils'
+import { useLanguageStore } from '@/store/useLanguageStore'
 
-// 注册中文语言包
+// 注册语言包（使用动态语言）
+const registerKLineLocales = () => {
+  const { lang } = useLanguageStore.getState();
+  const t = globalI18n[lang];
+  
+  registerLocale('zh-CN', {
+    time: `${t.stockDetail.timeLabel}：`,
+    open: `${t.stockDetail.openLabel}：`,
+    high: `${t.stockDetail.highLabel}：`,
+    low: `${t.stockDetail.lowLabel}：`,
+    close: `${t.stockDetail.closeLabel}：`,
+    volume: `${t.stockDetail.volumeLabel}：`,
+    turnover: '额：',
+    change: '涨跌：',
+  })
+
+  registerLocale('en-US', {
+    time: `${t.stockDetail.timeLabel}: `,
+    open: `${t.stockDetail.openLabel}: `,
+    high: `${t.stockDetail.highLabel}: `,
+    low: `${t.stockDetail.lowLabel}: `,
+    close: `${t.stockDetail.closeLabel}: `,
+    volume: `${t.stockDetail.volumeLabel}: `,
+    turnover: 'Turnover: ',
+    change: 'Change: ',
+  })
+}
+
+// 初始化注册
 registerLocale('zh-CN', {
   time: '时间：',
   open: '开：',
@@ -21,6 +50,17 @@ registerLocale('zh-CN', {
   change: '涨跌：',
 })
 
+registerLocale('en-US', {
+  time: 'Time: ',
+  open: 'Open: ',
+  high: 'High: ',
+  low: 'Low: ',
+  close: 'Close: ',
+  volume: 'Volume: ',
+  turnover: 'Turnover: ',
+  change: 'Change: ',
+})
+
 interface KLineChartProps {
   data: KLineDataPoint[]
   height?: number
@@ -42,6 +82,7 @@ export default function KLineChart({
   theme = 'light',
   period = 'daily',
 }: KLineChartProps) {
+  const { lang } = useLanguageStore()
   const containerRef = useRef<HTMLDivElement>(null)
   const chartRef = useRef<Chart | null>(null)
   const [isInitialized, setIsInitialized] = useState(false)
@@ -63,6 +104,9 @@ export default function KLineChart({
   useEffect(() => {
     if (!containerRef.current) return
 
+    // 重置初始化状态
+    setIsInitialized(false)
+
     // 销毁旧图表
     if (chartRef.current) {
       dispose(chartRef.current)
@@ -286,7 +330,7 @@ export default function KLineChart({
 
     // 创建图表
     const chart = init(containerRef.current, {
-      locale: 'zh-CN',
+      locale: lang === 'zh' ? 'zh-CN' : 'en-US',
       styles,
     })
 
@@ -333,23 +377,38 @@ export default function KLineChart({
         chart.createIndicator('MACD')
       }
 
+      // 如果有数据，立即应用
+      if (data && data.length > 0) {
+        try {
+          const formattedData = formatData(data)
+          chart.applyNewData(formattedData)
+        } catch (error) {
+          console.error('Failed to apply initial chart data:', error)
+        }
+      }
+
       setIsInitialized(true)
     }
 
     return () => {
+      setIsInitialized(false)
       if (chartRef.current) {
         dispose(chartRef.current)
         chartRef.current = null
       }
     }
-  }, [theme, showVolume, showMA, showMACD, period])
+  }, [theme, showVolume, showMA, showMACD, period, lang, data, formatData])
 
-  // 更新数据
+  // 更新数据 - 当图表初始化完成且有数据时应用
   useEffect(() => {
     if (!chartRef.current || !isInitialized || !data || data.length === 0) return
 
-    const formattedData = formatData(data)
-    chartRef.current.applyNewData(formattedData)
+    try {
+      const formattedData = formatData(data)
+      chartRef.current.applyNewData(formattedData)
+    } catch (error) {
+      console.error('Failed to apply chart data:', error)
+    }
   }, [data, isInitialized, formatData])
 
   return (
```

---

### Incident Patch 4: `0db32440` (2025-12-27)
**Commit Message**: fix(news): 修复新闻无法显示原始HTML内容的问题

- 移除交互式爬虫的内容和HTML截断限制，保留完整内容
- BochaAI搜索结果自动爬取页面获取完整HTML（前15条）
- 新增重新爬取新闻内容的API端点，支持补充缺失的HTML

修复了新闻详情页显示"该新闻暂无原始HTML内容"的问题

**File**: `backend/app/api/v1/news_v2.py` (modified, +69/-0)
```diff
@@ -270,6 +270,75 @@ async def get_news_detail(
         raise HTTPException(status_code=500, detail=str(e))
 
 
+class RecrawlResponse(BaseModel):
+    """重新爬取响应"""
+    success: bool
+    message: str
+    content_length: int = 0
+    html_length: int = 0
+
+
+@router.post("/{news_id}/recrawl", response_model=RecrawlResponse, summary="重新爬取新闻内容")
+async def recrawl_news(
+    news_id: int,
+    db: AsyncSession = Depends(get_db)
+):
+    """
+    重新爬取指定新闻的完整内容
+    
+    用于补充缺失的原始 HTML 或更新被截断的正文
+    """
+    try:
+        # 获取新闻
+        query = select(News).where(News.id == news_id)
+        result = await db.execute(query)
+        news = result.scalar_one_or_none()
+        
+        if not news:
+            raise HTTPException(status_code=404, detail="新闻不存在")
+        
+        if not news.url:
+            raise HTTPException(status_code=400, detail="新闻缺少 URL，无法重新爬取")
+        
+        # 使用交互式爬虫重新爬取
+        from ...tools.interactive_crawler import create_interactive_crawler
+        
+        crawler = create_interactive_crawler()
+        page_data = crawler.crawl_page(news.url)
+        
+        if not page_data:
+            return RecrawlResponse(
+                success=False,
+                message="爬取失败，页面可能需要 JS 渲染或已失效",
+            )
+        
+        # 更新数据库
+        new_content = page_data.get('content', '') or page_data.get('text', '')
+        new_html = page_data.get('html', '')
+        
+        if new_content:
+            news.content = new_content
+        if new_html:
+            news.raw_html = new_html
+        
+        await db.commit()
+        
+        return RecrawlResponse(
+            success=True,
+            message="重新爬取成功",
+            content_length=len(new_content) if new_content else 0,
+            html_length=len(new_html) if new_html else 0,
+        )
+        
+    except HTTPException:
+        raise
+    except ImportError:
+        raise HTTPException(status_code=500, detail="交互式爬虫模块不可用")
+    except Exception as e:
+        logger.error(f"重新爬取失败: {e}", exc_info=True)
+        raise HTTPException(status_code=500, detail=str(e))
+
+
 @router.get("/", response_model=List[NewsResponse], summary="获取新闻列表（带筛选）")
 async def get_news_list(
     source: Optional[str] = Query(None, description="新闻源筛选"),
```

**File**: `backend/app/tasks/crawl_tasks.py` (modified, +21/-2)
```diff
@@ -707,14 +707,33 @@ def targeted_stock_crawl_task(
             logger.debug(f"[Task {task_record.id}] ✅ 匹配核心词 '{matched_keyword}': {result.title[:40]}...")
             
             bochaai_matched += 1
+            
+            # 尝试爬取页面获取完整 HTML（只对前 15 条匹配结果爬取，避免任务太慢）
+            raw_html = None
+            crawled_content = None
+            if bochaai_matched <= 15:
+                try:
+                    from ..tools.interactive_crawler import InteractiveCrawler
+                    page_crawler = InteractiveCrawler(timeout=10)
+                    page_data = page_crawler.crawl_page(result.url)
+                    if page_data:
+                        raw_html = page_data.get('html')
+                        crawled_content = page_data.get('content') or page_data.get('text')
+                        logger.debug(f"[Task {task_record.id}] 📄 爬取成功: {result.url[:50]}... | HTML {len(raw_html) if raw_html else 0}字符")
+                except Exception as e:
+                    logger.debug(f"[Task {task_record.id}] ⚠️ 爬取页面失败 {result.url[:50]}...: {e}")
+            
+            # 优先使用爬取的完整内容
+            final_content = crawled_content if crawled_content and len(crawled_content) > len(full_content) else full_content
+            
             news_item = NewsItem(
                 title=result.title,
-                content=full_content,
+                content=final_content,
                 url=result.url,
                 source=result.site_name or "web_search",
                 publish_time=publish_time,
                 stock_codes=[pure_code, code],
-                raw_html=None,
+                raw_html=raw_html,
             )
             all_news.append(news_item)
             
```

**File**: `backend/app/tools/interactive_crawler.py` (modified, +6/-3)
```diff
@@ -765,14 +765,17 @@ def crawl_page(self, url: str) -> Optional[Dict[str, Any]]:
             
             # 清理文本
             text_content = re.sub(r'\n{3,}', '\n\n', text_content)
-            text_content = text_content[:5000]  # 限制长度，但保留更多内容
+            # 不再截断内容，保留完整正文（数据库字段应该支持长文本）
+            # text_content = text_content[:5000]  # 移除截断
+            
+            logger.debug(f"📄 爬取完成: {title[:40]}... | 正文{len(text_content)}字符 | HTML{len(raw_html) if raw_html else 0}字符")
             
             return {
                 "url": url,
                 "title": title,
-                "content": text_content,
+                "content": text_content,  # 完整正文
                 "text": text_content,  # 兼容字段
-                "html": raw_html[:50000] if raw_html else None  # 原始 HTML（限制大小）
+                "html": raw_html if raw_html else None  # 完整原始 HTML
             }
             
         except requests.exceptions.Timeout:
```

#### Recent Merged Pull Requests:
- **PR #10** (2024-06-21): Merge pull request #9 from DemonDamon/main (@DemonDamon)
- **PR #9** (2024-06-21): remove：删除临时文件 (@DemonDamon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
