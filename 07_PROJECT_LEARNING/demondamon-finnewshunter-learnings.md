# Forensic Learning Record (Deep Inspection): DemonDamon/FinnewsHunter

> **Canonical Artifact**: `07_PROJECT_LEARNING/demondamon-finnewshunter-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/DemonDamon/FinnewsHunter](https://github.com/DemonDamon/FinnewsHunter))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:35.645Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `DemonDamon/FinnewsHunter`
- **Description**: FinnewsHunter: Multi-agent financial intelligence platform powered by AgenticX. Real-time news analysis, sentiment fusion, and alpha factor mining.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1495 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/app/alpha_mining/utils.py`
```
"""
Alpha Mining 工具函数

提供模拟数据生成、数据预处理等工具函数。
"""

import torch
import numpy as np
from typing import Tuple, Optional
import logging

from .config import AlphaMiningConfig, DEFAULT_CONFIG

logger = logging.getLogger(__name__)


def generate_mock_data(
    num_samples: int = 100,
    num_features: int = 6,
    time_steps: int = 252,
    seed: Optional[int] = 42,
    device: Optional[torch.device] = None
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    生成模拟行情数据用于测试
    
    Args:
        num_samples: 样本数（股票数）
        num_features: 特征数
        time_steps: 时间步数（交易日数）
        seed: 随机种子
        device: 设备
        
    Returns:
        features: [num_samples, num_features, time_steps]
        returns: [num_samples, time_steps]
    """
    if seed is not None:
        torch.manual_seed(seed)
        np.random.seed(seed)
    
    device = device or DEFAULT_CONFIG.torch_device
    
    # 生成模拟收益率（正态分布）
    returns = torch.randn(num_samples, time_steps, device=device) * 0.02
    
    # 生成模拟价格（累积收益）
    prices = torch.exp(returns.cumsum(dim=1))
    
    # 生成模拟特征
    features_list = []
    
    # Feature 0: RET - 收益率
    ret = returns.clone()
    features_list.append(ret)
    
    # Feature 1: VOL - 波动率（滚动 20 日标准差）
    vol = _rolling_std(returns, window=20)
    features_list.append(vol)
    
    # Feature 2: VOLUME_CHG - 成交量变化（模拟）
    volume = torch.abs(torch.randn(num_samples, time_steps, device=device))
    volume_chg = _pct_change(volume)
    features_list.append(volume_chg)
    
    # Feature 3: TURNOVER - 换手率（模拟）
    turnover = torch.abs(torch.randn(num_samples, time_steps, device=device)) * 0.05
    features_list.append(turnover)
    
    # Feature 4: SENTIMENT - 情感分数（模拟）
    sentiment = torch.randn(num_samples, time_steps, device=device) * 0.5
    features_list.append(sentiment)
    
    # Feature 5: NEWS_COUNT - 新闻数量（模拟）
    news_count = torch.abs(torch.randn(num_samples, time_steps, device=device)) * 5
    features_list.append(news_count)
    
    # 如果需要更多特征，填充随机噪声
    while len(features_list) < num_features:
        noise = torch.randn(num_samples, time_steps, device=device)
        features_list.append(noise)
    
    # 截取到指定特征数
    features_list = features_list[:num_features]
    
    # Stack features: [num_samples, num_features, time_steps]
    features = torch.stack(features_list, dim=1)
    
    # 标准化特征
    features = _robust_normalize(features)
    
    logger.debug(
        f"Generated mock data: features {features.shape}, returns {returns.shape}"
    )
    
    return features, returns


def _rolling_std(x: torch.Tensor, window: int = 20) -> torch.Tensor:
    """
    计算滚动标准差
    
    Args:
        x: [batch, time_steps]
        window: 窗口大小
        
    Returns:
        滚动标准差 [batch, time_steps]
    """
    batch_size, time_steps = x.shape
    device = x.device
    
    # Padding
    pad = torch.zeros((batch_size, window - 1), device=device)
    x_padded = torch.cat([pad, x], dim=1)
    
    # 使用 unfold 计算滚动窗口
    result = x_padded.unfold(1, window, 1).std(dim=-1)
    
    return result


def _pct_change(x: torch.Tensor) -> torch.Tensor:
    """
    计算百分比变化
    
    Args:
        x: [batch, time_steps]
        
    Returns:
        百分比变化 [batch, time_steps]
    """
    prev = torch.roll(x, 1, dims=1)
    prev[:, 0] = x[:, 0]  # 第一个值不变
    
    pct = (x - prev) / (prev + 1e-8)
    return pct


def _robust_normalize(x: torch.Tensor) -> torch.Tensor:
    """
    稳健标准化（使用中位数和 MAD）
    
    Args:
        x: [batch, num_features, time_steps]
        
    Returns:
        标准化后的张量
    """
    # 计算每个特征的中位数
    median = x.median(dim=2, keepdim=True).values
    
    # 计算 MAD (Median Absolute Deviation)
    mad = (x - median).abs().median(dim=2, keepdim=True).values + 1e-6
    
    # 标准化
    normalized = (x - median) / mad
    
    # 裁剪极端值
    normalized = torch.clamp(normalized, -5.0, 5.0)
    
    return normalized


def set_random_seed(seed: int):
    """设置随机种子以确保可复现性"""
    torch.manual_seed(seed)
    np.random.seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def get_device() -> torch.device:
    """获取最佳可用设备"""
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")

```

### Core Architecture Module: `backend/app/core/__init__.py`
```
"""
核心模块
"""
from .config import settings, get_settings
from .database import get_db, init_database

__all__ = ["settings", "get_settings", "get_db", "init_database"]


```

### Core Architecture Module: `backend/app/core/celery_app.py`
```
"""
Celery 应用配置
"""
from celery import Celery
from celery.schedules import crontab
from .config import settings

# 创建 Celery 应用
celery_app = Celery(
    "finnews",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.crawl_tasks"]  # 导入任务模块
)

# Celery 配置
celery_app.conf.update(
    # 时区设置
    timezone="Asia/Shanghai",
    enable_utc=True,
    
    # 任务结果配置
    result_expires=3600,  # 结果保存1小时
    result_backend_transport_options={
        'master_name': 'mymaster'
    },
    
    # 任务执行配置
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_time_limit=30 * 60,  # 30分钟超时
    task_soft_time_limit=25 * 60,  # 25分钟软超时
    
    # Worker 配置
    worker_prefetch_multiplier=1,  # 每次只拿一个任务
    worker_max_tasks_per_child=1000,  # 每个 worker 处理1000个任务后重启
    
    # Beat 调度配置
    beat_schedule={
        # 每1分钟爬取新浪财经
        "crawl-sina-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("sina",),
        },
        # 每1分钟爬取腾讯财经
        "crawl-tencent-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("tencent",),
        },
        # 每1分钟爬取中新经纬
        "crawl-jwview-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("jwview",),
        },
        # 每1分钟爬取经济观察网
        "crawl-eeo-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("eeo",),
        },
        # 每1分钟爬取财经网
        "crawl-caijing-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("caijing",),
        },
        # 每1分钟爬取21经济网
        "crawl-jingji21-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("jingji21",),
        },
        # 每1分钟爬取每日经济新闻
        "crawl-nbd-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("nbd",),
        },
        # 每1分钟爬取第一财经
        "crawl-yicai-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("yicai",),
        },
        # 每1分钟爬取网易财经
        "crawl-163-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("163",),
        },
        # 每1分钟爬取东方财富
        "crawl-eastmoney-every-1min": {
            "task": "app.tasks.crawl_tasks.realtime_crawl_task",
            "schedule": crontab(minute="*/1"),
            "args": ("eastmoney",),
        },
    },
)

# 任务路由（可选，用于任务分发）
# 注释掉自定义路由，使用默认的 celery 队列
# celery_app.conf.task_routes = {
#     "app.tasks.crawl_tasks.*": {"queue": "crawl"},
#     "app.tasks.analysis_tasks.*": {"queue": "analysis"},
# }


if __name__ == "__main__":
    celery_app.start()


```

### Core Architecture Module: `backend/app/core/config.py`
```
"""
FinnewsHunter 核心配置模块
使用 Pydantic Settings 管理环境变量和配置
"""
from typing import Optional, List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置类"""
    
    # 应用基础配置
    APP_NAME: str = "FinnewsHunter"
    APP_VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = Field(default=True)
    
    # 服务器配置
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    
    # CORS 配置
    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000"]
    )
    
    # PostgreSQL 数据库配置
    POSTGRES_USER: str = Field(default="finnews")
    POSTGRES_PASSWORD: str = Field(default="finnews_dev_password")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)
    POSTGRES_DB: str = Field(default="finnews_db")
    
    @property
    def DATABASE_URL(self) -> str:
        """异步数据库连接 URL"""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    @property
    def SYNC_DATABASE_URL(self) -> str:
        """同步数据库连接 URL（用于初始化）"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
    
    # Redis 配置
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_DB: int = Field(default=0)
    REDIS_PASSWORD: Optional[str] = Field(default=None)
    
    @property
    def REDIS_URL(self) -> str:
        """Redis 连接 URL"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # Milvus 配置
    MILVUS_HOST: str = Field(default="localhost")
    MILVUS_PORT: int = Field(default=19530)
    MILVUS_COLLECTION_NAME: str = Field(default="finnews_embeddings")
    MILVUS_DIM: int = Field(default=1536)  # OpenAI embedding dimension
    
    # Neo4j 知识图谱配置
    NEO4J_URI: str = Field(default="bolt://localhost:7687", description="Neo4j 连接URI")
    NEO4J_USER: str = Field(default="neo4j", description="Neo4j 用户名")
    NEO4J_PASSWORD: str = Field(default="finnews_neo4j_password", description="Neo4j 密码")
    
    # LLM 配置
    LLM_PROVIDER: str = Field(default="bailian")  # 默认提供商
    LLM_MODEL: str = Field(default="qwen-plus")
    LLM_TEMPERATURE: float = Field(default=0.7)
    LLM_MAX_TOKENS: int = Field(default=2000)
    LLM_TIMEOUT: int = Field(default=180)  # LLM 调用超时时间（秒），百炼建议180秒
    
    # 各厂商 API Key 配置
    DASHSCOPE_API_KEY: Optional[str] = Field(default=None, description="阿里云百炼 API Key")
    DASHSCOPE_BASE_URL: str = Field(
        default="https://dashscope.aliyuncs.com/compatible-mode/v1",
        description="阿里云百炼 Base URL"
    )
    BAILIAN_API_KEY: Optional[str] = Field(default=None, description="百炼 API Key（与DASHSCOPE相同）")
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API Key")
    DEEPSEEK_API_KEY: Optional[str] = Field(default=None, description="DeepSeek API Key")
    MOONSHOT_API_KEY: Optional[str] = Field(default=None, description="Moonshot (Kimi) API Key")
    ZHIPU_API_KEY: Optional[str] = Field(default=None, description="智谱 API Key")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, description="Anthropic API Key")
    
    # 各厂商可用模型列表（逗号分隔）
    BAILIAN_MODELS: str = Field(
        default="qwen-plus,qwen-max,qwen-turbo,qwen-long",
        description="百炼可用模型（逗号分隔）"
    )
    OPENAI_MODELS: str = Field(
        default="gpt-4,gpt-4-turbo,gpt-3.5-turbo",
        description="OpenAI可用模型（逗号分隔）"
    )
    DEEPSEEK_MODELS: str = Field(
        default="deepseek-chat",
        description="DeepSeek可用模型（逗号分隔）"
    )
    MOONSHOT_MODELS: str = Field(
        default="moonshot-v1-8k,moonshot-v1-32k,moonshot-v1-128k",
        description="Moonshot可用模型（逗号分隔）"
    )
    ZHIPU_MODELS: str = Field(
        default="glm-4,glm-4-plus,glm-4-air,glm-3-turbo",
        description="智谱可用模型（逗号分隔）"
    )
    
    # Base URL 配置（用于第三方 API 转发）
    OPENAI_BASE_URL: Optional[str] = Field(default=None, description="OpenAI Base URL")
    DEEPSEEK_BASE_URL: Optional[str] = Field(default="https://api.deepseek.com/v1", description="DeepSeek Base URL")
    MOONSHOT_BASE_URL: Optional[str] = Field(default="https://api.moonshot.cn/v1", description="Moonshot Base URL")
    ZHIPU_BASE_URL: Optional[str] = Field(default="https://open.bigmodel.cn/api/paas/v4", description="智谱 Base URL")
    ANTHROPIC_BASE_URL: Optional[str] = Field(default=None, description="Anthropic Base URL")
    QWEN_BASE_URL: Optional[str] = Field(default=None, description="Qwen Base URL (deprecated)")
    BAILIAN_ACCESS_KEY_ID: Optional[str] = Field(default=None, description="百炼 Access Key ID")
    BAILIAN_ACCESS_KEY_SECRET: Optional[str] = Field(default=None, description="百炼 Access Key Secret")
    BAILIAN_AGENT_CODE: Optional[str] = Field(default=None, description="百炼 Agent Code")
    BAILIAN_REGION_ID: str = Field(default="cn-beijing", description="百炼 Region ID")
    
    # BochaAI 搜索 API 配置
    BOCHAAI_API_KEY: Optional[str] = Field(default=None, description="BochaAI Web Search API Key")
    BOCHAAI_ENDPOINT: str = Field(default="https://api.bochaai.com/v1/web-search", description="BochaAI API Endpoint")
    
    # Embedding 配置
    EMBEDDING_PROVIDER: str = Field(default="openai")  # openai, huggingface
    EMBEDDING_MODEL: str = Field(default="text-embedding-ada-002")
    EMBEDDING_BATCH_SIZE: int = Field(default=100)
    EMBEDDING_BASE_URL: Optional[str] = Field(default=None)  # 自定义 Embedding API 端点
    EMBEDDING_TIMEOUT: int = Field(default=30, description="Embedding API 超时时间（秒），建议设置为20-30秒")
    EMBEDDING_MAX_RETRIES: int = Field(default=2, description="Embedding API 最大重试次数，建议设置为1-2次以避免等待太久")
    
    # 爬虫配置
    CRAWLER_USER_AGENT: str = Field(
        default="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    )
    CRAWLER_TIMEOUT: int = Field(default=30)
    CRAWLER_MAX_RETRIES: int = Field(default=3)
    CRAWLER_DELAY: float = Field(default=1.0)  # 请求间隔（秒）
    
    # Phase 2: 实时爬取与缓存配置（多源支持）
    CACHE_TTL: int = Field(default=1800, description="缓存过期时间（秒），默认30分钟")
    CRAWL_INTERVAL_SINA: int = Field(default=60, description="新浪财经爬取间隔（秒），默认60秒")
    CRAWL_INTERVAL_TENCENT: int = Field(default=60, description="腾讯财经爬取间隔（秒），默认60秒")
    CRAWL_INTERVAL_JWVIEW: int = Field(default=60, description="中新经纬爬取间隔（秒），默认60秒")
    CRAWL_INTERVAL_EEO: int = Field(default=60, description="经济观察网爬取间隔（秒），默认60秒")
    CRAWL_INTERVAL_CAIJING: int = Field(default=60, description="财经网爬取间隔（秒），默认60秒")
    CRAWL_INTERVAL_JINGJI21: int = Field(default=60, description="21经济网爬取间隔（秒），默认60秒")
    CRAWL_INTERVAL_JRJ: int = Field(default=600, description="金融界爬取间隔（秒），默认10分钟")
    NEWS_RETENTION_HOURS: int = Field(default=72000, description="新闻保留时间（小时），临时设置为72000小时（约8年）以包含所有爬取的新闻")
    FRONTEND_REFETCH_INTERVAL: int = Field(default=180, description="前端自动刷新间隔（秒），默认3分钟")
    
    # 日志配置
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FILE: Optional[str] = Field(default="logs/finnews.log")
    
    # 安全配置
    SECRET_KEY: str = Field(default="your-secret-key-here-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60 * 24 * 7)  # 7 days
    
    # 业务配置
    MAX_NEWS_PER_REQUEST: int = Field(default=50)
    NEWS_CACHE_TTL: int = Field(default=3600)  # 1 hour
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
        env_ignore_empty=True,
    )


# 全局配置实例
settings = Settings()


# 便捷访问函数
def get_settings() -> Settings:
    """获取配置实例（用于依赖注入）"""
    return settings


```

### Core Architecture Module: `backend/app/core/database.py`
```
"""
数据库连接和依赖注入
"""
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.database import (
    AsyncSessionLocal,
    init_db as create_tables,
    Base,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI 依赖注入：获取数据库会话
    
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    
    Yields:
        AsyncSession: 数据库会话
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def init_database():
    """
    初始化数据库
    创建所有表结构
    """
    print("=" * 50)
    print("Initializing FinnewsHunter Database...")
    print("=" * 50)
    
    try:
        create_tables()
        print("\n✓ Database initialization completed successfully!")
    except Exception as e:
        print(f"\n✗ Database initialization failed: {e}")
        raise


if __name__ == "__main__":
    # 直接运行此文件以初始化数据库
    init_database()


```

### Core Architecture Module: `backend/app/core/neo4j_client.py`
```
"""
Neo4j 图数据库客户端
用于存储和查询公司知识图谱
"""
import logging
from typing import Optional, Dict, List, Any
from neo4j import GraphDatabase, Driver
from contextlib import contextmanager

from .config import settings

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Neo4j 客户端封装"""
    
    def __init__(
        self,
        uri: str = None,
        user: str = None,
        password: str = None
    ):
        """
        初始化 Neo4j 客户端
        
        Args:
            uri: Neo4j URI（如 bolt://localhost:7687）
            user: 用户名
            password: 密码
        """
        self.uri = uri or settings.NEO4J_URI or "bolt://localhost:7687"
        self.user = user or settings.NEO4J_USER or "neo4j"
        self.password = password or settings.NEO4J_PASSWORD or "finnews_neo4j_password"
        
        self._driver: Optional[Driver] = None
        self._connected = False
    
    def connect(self):
        """建立连接"""
        if self._connected:
            return
        
        try:
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password)
            )
            # 测试连接
            self._driver.verify_connectivity()
            self._connected = True
            logger.info(f"✅ Neo4j 连接成功: {self.uri}")
        except Exception as e:
            logger.error(f"❌ Neo4j 连接失败: {e}")
            raise
    
    def close(self):
        """关闭连接"""
        if self._driver:
            self._driver.close()
            self._connected = False
            logger.info("Neo4j 连接已关闭")
    
    @contextmanager
    def session(self):
        """获取会话（上下文管理器）"""
        if not self._connected:
            self.connect()
        
        session = self._driver.session()
        try:
            yield session
        finally:
            session.close()
    
    def execute_query(
        self,
        query: str,
        parameters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        执行 Cypher 查询
        
        Args:
            query: Cypher 查询语句
            parameters: 查询参数
            
        Returns:
            查询结果列表
        """
        with self.session() as session:
            result = session.run(query, parameters or {})
            return [dict(record) for record in result]
    
    def execute_write(
        self,
        query: str,
        parameters: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """
        执行写入操作
        
        Args:
            query: Cypher 写入语句
            parameters: 参数
            
        Returns:
            写入结果
        """
        with self.session() as session:
            result = session.run(query, parameters or {})
            return [dict(record) for record in result]
    
    def is_connected(self) -> bool:
        """检查连接状态"""
        return self._connected
    
    def health_check(self) -> bool:
        """健康检查"""
        try:
            if not self._connected:
                self.connect()
            
            with self.session() as session:
                result = session.run("RETURN 1 as health")
                return result.single()["health"] == 1
        except Exception as e:
            logger.error(f"Neo4j 健康检查失败: {e}")
            return False


# 全局单例
_neo4j_client: Optional[Neo4jClient] = None


def get_neo4j_client() -> Neo4jClient:
    """获取 Neo4j 客户端单例"""
    global _neo4j_client
    if _neo4j_client is None:
        _neo4j_client = Neo4jClient()
        _neo4j_client.connect()
    return _neo4j_client


def close_neo4j_client():
    """关闭 Neo4j 客户端"""
    global _neo4j_client
    if _neo4j_client:
        _neo4j_client.close()
        _neo4j_client = None


```

### Core Architecture Module: `backend/app/core/redis_client.py`
```
"""
Redis Client for Caching and Task Queue
"""
import json
import logging
from typing import Optional, Any
from datetime import datetime, timedelta

import redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client wrapper with JSON serialization support"""
    
    def __init__(self):
        try:
            self.client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
                decode_responses=True,  # 自动解码为字符串
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # 测试连接
            self.client.ping()
            logger.info(f"✅ Redis connected: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            self.client = None
    
    def is_available(self) -> bool:
        """检查 Redis 是否可用"""
        try:
            if self.client:
                self.client.ping()
                return True
        except:
            pass
        return False
    
    def get_json(self, key: str) -> Optional[Any]:
        """获取 JSON 数据"""
        if not self.is_available():
            return None
        
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Redis get_json error: {e}")
        return None
    
    def set_json(self, key: str, value: Any, ttl: int = None) -> bool:
        """存储 JSON 数据"""
        if not self.is_available():
            return False
        
        try:
            json_str = json.dumps(value, ensure_ascii=False, default=str)
            if ttl:
                self.client.setex(key, ttl, json_str)
            else:
                self.client.set(key, json_str)
            return True
        except Exception as e:
            logger.error(f"Redis set_json error: {e}")
            return False
    
    def get(self, key: str) -> Optional[str]:
        """获取字符串数据"""
        if not self.is_available():
            return None
        
        try:
            return self.client.get(key)
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    def set(self, key: str, value: str, ttl: int = None) -> bool:
        """存储字符串数据"""
        if not self.is_available():
            return False
        
        try:
            if ttl:
                self.client.setex(key, ttl, value)
            else:
                self.client.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """删除键"""
        if not self.is_available():
            return False
        
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """检查键是否存在"""
        if not self.is_available():
            return False
        
        try:
            return self.client.exists(key) > 0
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return False
    
    def get_cache_metadata(self, key: str) -> Optional[dict]:
        """获取缓存元数据（时间戳）"""
        time_key = f"{key}:timestamp"
        timestamp_str = self.get(time_key)
        
        if timestamp_str:
            try:
                return {
                    "timestamp": datetime.fromisoformat(timestamp_str),
                    "age_seconds": (datetime.now() - datetime.fromisoformat(timestamp_str)).total_seconds()
                }
            except:
                pass
        return None
    
    def set_with_metadata(self, key: str, value: Any, ttl: int = None) -> bool:
        """存储数据并记录时间戳"""
        success = self.set_json(key, value, ttl)
        if success:
            time_key = f"{key}:timestamp"
            self.set(time_key, datetime.now().isoformat(), ttl)
        return success
    
    def clear_pattern(self, pattern: str) -> int:
        """清除匹配模式的所有键"""
        if not self.is_available():
            return 0
        
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
        except Exception as e:
            logger.error(f"Redis clear_pattern error: {e}")
        return 0


# 全局单例
redis_client = RedisClient()


```

### Core Architecture Module: `backend/app/tools/search_engine_crawler.py`
```
"""
搜索引擎爬虫工具
直接爬取搜索引擎结果页面（Bing/Baidu）
"""
import logging
import re
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from urllib.parse import quote_plus
from bs4 import BeautifulSoup
import time

logger = logging.getLogger(__name__)


class SearchEngineCrawler:
    """
    搜索引擎爬虫
    直接爬取 Bing/Baidu 搜索结果
    """
    
    def __init__(self):
        """初始化搜索引擎爬虫"""
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        
        logger.info("🔧 搜索引擎爬虫已初始化")
    
    def _fetch_url(self, url: str, timeout: int = 10) -> Optional[str]:
        """
        爬取URL内容
        
        Args:
            url: 目标URL
            timeout: 超时时间
            
        Returns:
            HTML内容
        """
        try:
            response = self.session.get(url, timeout=timeout)
            response.raise_for_status()
            
            # 尝试检测编码
            if response.encoding == 'ISO-8859-1':
                # 对于中文网站，尝试使用 gb2312 或 utf-8
                encodings = ['utf-8', 'gb2312', 'gbk']
                for enc in encodings:
                    try:
                        response.encoding = enc
                        _ = response.text
                        break
                    except:
                        continue
            
            return response.text
            
        except Exception as e:
            logger.error(f"❌ 爬取失败 {url}: {e}")
            return None
    
    def search_with_engine(
        self,
        query: str,
        engine: str = "bing",
        days: int = 30,
        max_results: int = 50
    ) -> List[Dict[str, Any]]:
        """
        使用搜索引擎搜索新闻
        
        Args:
            query: 搜索关键词
            engine: 搜索引擎 (bing/baidu)
            days: 时间范围（天）
            max_results: 最大结果数
            
        Returns:
            新闻列表
        """
        if engine not in self.search_engines:
            logger.error(f"❌ 不支持的搜索引擎: {engine}")
            return []
        
        # 构建搜索URL
        search_query = self._build_search_query(query, days)
        search_url = self.search_engines[engine].format(query=quote_plus(search_query))
        
        logger.info(f"🔍 搜索引擎爬取: {engine} - {search_query}")
        logger.info(f"    URL: {search_url}")
        
        # 创建临时输出目录
        with tempfile.TemporaryDirectory() as temp_dir:
            # 爬取搜索结果页面
            result = self._call_mcp_crawl(search_url, temp_dir)
            
            if not result:
                logger.warning(f"⚠️ 搜索引擎爬取失败: {search_url}")
                return []
            
            # 解析搜索结果
            news_items = self._parse_search_results(
                content=result.get("content", ""),
                engine=engine,
                max_results=max_results
            )
            
            logger.info(f"✅ 从 {engine} 提取到 {len(news_items)} 条结果")
            return news_items
    
    def _build_search_query(self, query: str, days: int) -> str:
        """
        构建搜索查询字符串（添加时间限制）
        
        Args:
            query: 原始查询
            days: 时间范围
            
        Returns:
            增强的搜索查询
        """
        # 添加时间范围（对于 Bing 和 Baidu）
        # Bing: 支持 "query site:xxx.com"
        # 可以添加新闻源限制
        
        # 可选：限制到新闻网站
        news_sites = [
            "sina.com.cn",
            "163.com",
            "eastmoney.com",
            "cnstock.com",
            "stcn.com",
            "caijing.com.cn",
            "yicai.com",
        ]
        
        # 构建基础查询
        enhanced_query = f"{query} 新闻"
        
        # 添加时间提示词
        if days <= 7:
            enhanced_query += " 最近一周"
        elif days <= 30:
            enhanced_query += " 最近一个月"
        
        return enhanced_query
    
    def _parse_search_results(
        self,
        content: str,
        engine: str,
        max_results: int
    ) -> List[Dict[str, Any]]:
        """
        解析搜索引擎返回的内容，提取新闻链接和标题
        
        Args:
            content: 爬取的页面内容（Markdown格式）
            engine: 搜索引擎类型
            max_results: 最大结果数
            
        Returns:
            新闻条目列表
        """
        news_items = []
        
        # 从 Markdown 内容中提取链接
        # 格式：[标题](URL)
        link_pattern = r'\[([^\]]+)\]\(([^\)]+)\)'
        matches = re.findall(link_pattern, content)
        
        for title, url in matches[:max_results]:
            # 过滤掉搜索引擎自身的链接
            if engine in url.lower():
                continue
            
            # 过滤掉非新闻链接
            if not self._is_news_url(url):
                continue
            
            news_items.append({
                "title": title.strip(),
                "url": url.strip(),
                "snippet": "",  # 暂时为空，后续可以从 content 中提取
                "source": self._extract_source_from_url(url),
                "engine": engine
            })
        
        return news_items
    
    def _is_news_url(self, url: str) -> bool:
        """判断是否为新闻URL"""
        news_domains = [
            "sina.com", "163.com", "eastmoney.com", "cnstock.com",
            "stcn.com", "caijing.com", "yicai.com", "nbd.com",
            "jwview.com", "eeo.com.cn", "finance.qq.com"
        ]
        return any(domain in url.lower() for domain in news_domains)
    
    def _extract_source_from_url(self, url: str) -> str:
        """从URL提取来源"""
        domain_mapping = {
            "sina.com": "新浪财经",
            "163.com": "网易财经",
            "eastmoney.com": "东方财富",
            "cnstock.com": "中国证券网",
            "stcn.com": "证券时报",
            "caijing.com": "财经网",
            "yicai.com": "第一财经",
            "nbd.com": "每日经济新闻",
            "jwview.com": "金融界",
            "eeo.com.cn": "经济观察网",
            "qq.com": "腾讯财经",
        }
        
        for domain, source in domain_mapping.items():
            if domain in url.lower():
                return source
        
        return "未知来源"
    
    def search_stock_news(
        self,
        stock_name: str,
        stock_code: str,
        days: int = 30,
        engines: Optional[List[str]] = None,
        max_per_engine: int = 30
    ) -> List[Dict[str, Any]]:
        """
        搜索股票新闻（多搜索引擎）
        
        Args:
            stock_name: 股票名称
            stock_code: 股票代码
            days: 时间范围
            engines: 搜索引擎列表，默认 ["bing"]
            max_per_engine: 每个搜索引擎最大结果数
            
        Returns:
            新闻列表
        """
        if engines is None:
            engines = ["bing"]  # 默认只用 Bing（Baidu 可能需要处理反爬）
        
        all_news = []
        
        # 构建搜索关键词
        queries = [
            stock_name,
            f"{stock_name} {stock_code}",
            f"{stock_name} 公告",
        ]
        
        for engine in engines:
            for query in queries:
                try:
                    news = self.search_with_engine(
                        query=query,
                        engine=engine,
                        days=days,
                        max_results=max_per_engine
                    )
                    all_news.extend(news)
                except Exception as e:
                    logger.error(f"❌ 搜索失败 [{engine}] {query}: {e}")
        
        # 去重（按URL）
        seen_urls = set()
        unique_news = []
        for news in all_news:
            url = news.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                unique_news.append(news)
        
        logger.info(f"✅ 多引擎搜索完成: 总计 {len(unique_news)} 条（去重后）")
        return unique_news


# 便捷函数
def create_search_engine_crawler(mcp_server_path: Optional[str] = None) -> SearchEngineCrawler:
    """创建搜索引擎爬虫实例"""
    return SearchEngineCrawler(mcp_server_path)


# 测试代码
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    crawler = create_search_engine_crawler()
    
    # 测试搜索
    results = crawler.search_stock_news(
        stock_name="深振业A",
        stock_code="000006",
        days=7,
        engines=["bing"],
        max_per_engine=10
    )
    
    print(f"\n✅ 搜索到 {len(results)} 条新闻:")
    for i, news in enumerate(results[:5], 1):
        print(f"{i}. {news['title']}")
        print(f"   来源: {news['source']}")
        print(f"   URL: {news['url']}")


```

### Core Architecture Module: `frontend/src/hooks/useDebounce.ts`
```
import { useState, useEffect } from 'react'

/**
 * useDebounce Hook
 * 
 * 用于延迟处理快速变化的值（如搜索输入），避免频繁触发计算或API请求
 * 
 * @param value - 需要防抖的值
 * @param delay - 延迟时间（毫秒），默认 500ms
 * @returns 防抖后的值
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearchTerm = useDebounce(searchTerm, 300)
 * 
 * useEffect(() => {
 *   // 只有当用户停止输入 300ms 后才会执行
 *   fetchSearchResults(debouncedSearchTerm)
 * }, [debouncedSearchTerm])
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // 设置定时器，在delay后更新debouncedValue
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // 清理函数：如果value在delay时间内再次变化，清除上一个定时器
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}


```

### Core Architecture Module: `frontend/src/lib/utils.ts`
```
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export interface TimeI18n {
  justNow: string
  minutesAgo: string
  hoursAgo: string
  daysAgo: string
}

const defaultTimeI18n: TimeI18n = {
  justNow: '刚刚',
  minutesAgo: '分钟前',
  hoursAgo: '小时前',
  daysAgo: '天前',
}

export function formatRelativeTime(date: string | Date, i18n?: TimeI18n): string {
  const t = i18n || defaultTimeI18n
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return t.justNow
  if (diffMins < 60) return `${diffMins}${t.minutesAgo}`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}${t.hoursAgo}`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}${t.daysAgo}`
  
  return formatDate(d)
}


```

### Core Architecture Module: `legacy_v1/src/Gon/realtime_starter_redis_queue.py`
```
import __init__

import redis

from Kite import config

from Killua.buildstocknewsdb import GenStockNewsDB


redis_client = redis.StrictRedis(config.REDIS_IP,
                                 port=config.REDIS_PORT,
                                 db=config.CACHE_RECORED_OPENED_PYTHON_PROGRAM_DB_ID)
redis_client.lpush(config.CACHE_RECORED_OPENED_PYTHON_PROGRAM_VAR, "realtime_starter_redis_queue.py")

gen_stock_news_db = GenStockNewsDB()
gen_stock_news_db.listen_redis_queue()
```

### Core Architecture Module: `legacy_v1/src/Kite/utils.py`
```
import re
import datetime
import requests
import numpy as np
from bs4 import BeautifulSoup
from scipy.sparse import csr_matrix


def generate_pages_list(total_pages, range, init_page_id):
    page_list = list()
    k = init_page_id

    while k + range - 1 <= total_pages:
        page_list.append((k, k + range -1))
        k += range

    if k + range - 1 < total_pages:
        page_list.append((k, total_pages))

    return page_list


def count_chn(string):
    '''Count Chinese numbers and calculate the frequency of Chinese occurrence.

    # Arguments:
        string: Each part of crawled website analyzed by BeautifulSoup.
    '''
    pattern = re.compile(u'[\u1100-\uFFFDh]+?')
    result = pattern.findall(string)
    chn_num = len(result)
    possible = chn_num / len(str(string))

    return chn_num, possible


def get_date_list_from_range(begin_date, end_date):
    '''Get date list from 'begin_date' to 'end_date' on the calendar.
    '''
    date_list = list()
    begin_date = datetime.datetime.strptime(begin_date, "%Y-%m-%d")
    end_date = datetime.datetime.strptime(end_date, "%Y-%m-%d")
    while begin_date <= end_date:
        date_str = begin_date.strftime("%Y-%m-%d")
        date_list.append(date_str)
        begin_date += datetime.timedelta(days=1)

    return date_list


def gen_dates_list(date_list, date_range):
    date_list_latest = list()
    k = 0
    while k < len(date_list):
        if k + date_range >= len(date_list):
            break
        else:
            date_list_latest.append(date_list[k: k + date_range])
            k += date_range
    date_list_latest.append(date_list[k:])

    return date_list_latest


def get_date_before(n_days):
    """
    获取前n_days天的日期，如今天是2020-12-25，当n_days=1，返回"2020-12-24"
    :param n_days: 前n_days天数，如n_days=1，即前1天
    """
    today = datetime.datetime.now()
    # 计算偏移量
    offset = datetime.timedelta(days=-n_days)
    # 获取想要的日期的时间
    re_date = (today + offset).strftime('%Y-%m-%d')
    return re_date


def search_max_pages_num(first_url, date):
    """
    主要针对金融界网站
    通过日期搜索新闻，比如2020年1月1日的新闻，下面链接
    http://stock.jrj.com.cn/xwk/202001/20200101_1.shtml
    为搜索返回的第一个网页，通过这个网页可以发现，数据库
    返回的最大页数是4，即2020年1月1日共有4页的新闻列表
    :param first_url: 搜索该日期返回的第一个网址，如'http://stock.jrj.com.cn/xwk/202001/20200101_1.shtml'
    :param date: 日期，如'2020-01-01'
    """
    respond = requests.get(first_url)
    respond.encoding = BeautifulSoup(respond.content, "lxml").original_encoding
    bs = BeautifulSoup(respond.text, "lxml")
    a_list = bs.find_all("a")
    max_pages_num = 1
    for a in a_list:
        if "href" in a.attrs and "target" in a.attrs:
            if a["href"].find(date.replace("-", "") + "_") != -1 \
                    and a.text.isdigit():
                max_pages_num += 1

    return max_pages_num


def html_parser(url):
    resp = requests.get(url)
    resp.encoding = BeautifulSoup(resp.content, "lxml").original_encoding
    bs = BeautifulSoup(resp.text, "lxml")

    return bs


def get_chn_stop_words(path):
    '''Load the stop words txt file.
    '''
    stopwords = [line.strip() for line in open(path, 'r').readlines()]

    return stopwords


def convert_to_csr_matrix(model_vector):
    """
    Convert LDA(LSI) model vector to CSR sparse matrix, that could be accepted by Scipy and Numpy.

    # Arguments:
        modelVec: Transformation model vector, such as LDA model vector, tfidf model vector or lsi model vector.
    """
    data = []
    rows = []
    cols = []
    _line_count = 0
    for line in model_vector:  # line=[(int, float), (int, float), ...]
        for elem in line:  # elem=(int, float)
            rows.append(_line_count)
            cols.append(elem[0])
            data.append(elem[1])
        _line_count += 1
    sparse_matrix = csr_matrix((data, (rows, cols)))
    matrix = sparse_matrix.toarray()  # <class 'numpy.ndarray'>

    return matrix


def generate_training_set(x, y, split=0.8):
    rand = np.random.random(size=x.shape[0])
    train_x = []
    train_y = []
    test_x = []
    test_y = []
    for i in range(x.shape[0]):
        if rand[i] < split:
            train_x.append(x[i, :])
            train_y.append(y[i])
        else:
            test_x.append(x[i, :])
            test_y.append(y[i])
    return train_x, train_y, test_x, test_y


def is_contain_chn(word):
    """
    判断传入字符串是否包含中文
    :param word: 待判断字符串
    :return: True:包含中文  False:不包含中文
    """
    zh_pattern = re.compile(u'[\u4e00-\u9fa5]+')
    if zh_pattern.search(word):
        return True
    else:
        return False


def batch_lpop(client, key, n):
    p = client.pipeline()
    p.lrange(key, 0, n-1)
    p.ltrim(key, n, -1)
    p.execute()

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
Co-authored-by: Cursor <[REDACTED_EMAIL]>

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
+                        df = df.rename(columns={df.columns[0]: "代码", df.columns[1]: "名称"})
+
+                if df is None or df.empty:
+                    raise RuntimeError("akshare returned empty stock list")
+
+                stocks: List[Dict[str, str]] = []
+                for _, row in df.iterrows():
+                    normalized = _normalize_stock_row(str(row["代码"]), str(row["名称"]))
+                    if normalized:
+                        stocks.append(normalized)
+                if stocks:
+                    logger.info("Fetched %s stocks from akshare", len(stocks))
+                    return stocks
+                raise RuntimeError("akshare returned no valid stock rows")
+            except Exception as exc:
+                last_error = exc
+                logger.warning("Fetch A-share stocks attempt %s/3 failed: %s", attempt + 1, exc)
+
+    if use_fallback:
+        logger.warning("Using fallback stock list (%s items)", len(FALLBACK_A_SHARE_STOCKS))
+        return list(FALLB
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

### Incident Patch 3: `e8e2653f` (2026-01-13)
**Commit Message**: refactor(analysis): use async embedding methods to avoid event loop issues

- Replace synchronous embed_text with async aembed_text
- Run vectorization in background task to avoid blocking analysis
- Improve error handling and timeout control

**File**: `backend/app/services/analysis_service.py` (modified, +46/-16)
```diff
@@ -8,6 +8,7 @@
 from sqlalchemy.ext.asyncio import AsyncSession
 from sqlalchemy import select
 from starlette.concurrency import run_in_threadpool
+from ..models.database import AsyncSessionLocal
 
 from ..agents import create_news_analyst
 from ..models.news import News
@@ -114,24 +115,53 @@ async def analyze_news(
             news.sentiment_score = structured_data.get("sentiment_score")
             
             # 5. 向量化新闻内容（如果尚未向量化）
+            # 注意：embedding是可选功能，失败不应影响分析结果
+            # 在后台异步执行，不阻塞分析流程
             if not news.is_embedded:
-                try:
-                    # 组合标题和内容进行向量化
-                    text_to_embed = f"{news.title}\n{news.content[:1000]}"
-                    embedding = self.embedding_service.embed_text(text_to_embed)
-                    
-                    # 存储到 Milvus
-                    self.vector_storage.store_embedding(
-                        news_id=news_id,
-                        embedding=embedding,
-                        text=text_to_embed
-                    )
-                    
-                    news.is_embedded = 1
-                    logger.info(f"Vectorized news: {news_id}")
+                # 使用 asyncio.create_task 在后台执行，不等待结果
+                # 这样即使embedding超时或失败，也不会影响分析结果的返回
+                import asyncio
                 
-                except Exception as e:
-                    logger.warning(f"Failed to vectorize news {news_id}: {e}")
+                async def vectorize_in_background():
+                    try:
+                        # 组合标题和内容进行向量化
+                        text_to_embed = f"{news.title}\n{news.content[:1000]}"
+                        
+                        # 使用异步方法，避免事件循环问题
+                        embedding = await asyncio.wait_for(
+                            self.embedding_service.aembed_text(text_to_embed),
+                            timeout=20.0  # 20秒超时，避免等待太久
+                        )
+                        
+                        # 存储到 Milvus（也在线程池中执行）
+                        await run_in_threadpool(
+                            self.vector_storage.store_embedding,
+                            news_id=news_id,
+                            embedding=embedding,
+                            text=text_to_embed
+                        )
+                        
+                        # 更新数据库中的is_embedded标志（需要新的数据库会话）
+                        async with AsyncSessionLocal() as update_db:
+                            try:
+                                result = await update_db.execute(
+                                    select(News).where(News.id == news_id)
+                                )
+                                update_news = result.scalar_one_or_none()
+                                if update_news:
+                                    update_news.is_embedded = 1
+                                    await update_db.commit()
+                                    logger.info(f"Vectorized news: {news_id}")
+                            except Exception as e:
+                                logger.warning(f"Failed to update is_embedded flag for news {news_id}: {e}")
+                                await update_db.rollback()
+                    except asyncio.TimeoutError:
+                        logger.warning(f"Embedding timeout for news {news_id} (20s), skipping vectorization")
+                    except Exception as e:
+                        logger.warning(f"Failed to vectorize news {news_id}: {e}")
+                
+                # 在后台执行，不等待完成
+                asyncio.create_task(vectorize_in_background())
             
             await db.commit()
             await db.refresh(analysis)
```

---

### Incident Patch 4: `7a90773e` (2026-01-12)
**Commit Message**: test(alpha-mining): add Alpha Mining test suite

- Add integration tests (test_integration_p2.py)
- Add smoke tests (test_smoke_p0.py, test_smoke_p1.py)
- Test factor mining, evaluation, and sentiment comparison
- Test AgenticX integration and API endpoints

**File**: `backend/tests/test_alpha_mining/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Alpha Mining 测试模块"""
```

**File**: `backend/tests/test_alpha_mining/test_integration_p2.py` (added, +464/-0)
```diff
@@ -0,0 +1,464 @@
+"""
+P2 集成测试 - Alpha Mining 完整集成
+
+测试覆盖：
+- F18: QuantitativeAgent 集成
+- F19: REST API 端点
+- 完整工作流测试
+"""
+
+import pytest
+import sys
+from pathlib import Path
+from unittest.mock import AsyncMock, MagicMock, patch
+import asyncio
+
+# 添加项目路径
+project_root = Path(__file__).parent.parent.parent
+sys.path.insert(0, str(project_root))
+
+
+# ============================================================================
+# F18: QuantitativeAgent 集成测试
+# ============================================================================
+
+class TestQuantitativeAgent:
+    """量化分析智能体测试"""
+    
+    def test_agent_import(self):
+        """测试 Agent 可导入"""
+        from app.agents.quantitative_agent import QuantitativeAgent, create_quantitative_agent
+        
+        assert QuantitativeAgent is not None
+        assert create_quantitative_agent is not None
+    
+    def test_agent_init_without_llm(self):
+        """测试不使用 LLM 初始化"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        agent = QuantitativeAgent(
+            llm_provider=None,
+            enable_alpha_mining=True
+        )
+        
+        assert agent.enable_alpha_mining is True
+        assert agent._alpha_mining_initialized is False
+    
+    def test_agent_lazy_init(self):
+        """测试延迟初始化"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        agent = QuantitativeAgent(enable_alpha_mining=True)
+        
+        # 初始时未初始化
+        assert agent._generator is None
+        assert agent._vm is None
+        
+        # 调用 _init_alpha_mining
+        agent._init_alpha_mining()
+        
+        # 现在应该已初始化
+        assert agent._alpha_mining_initialized is True
+        assert agent._generator is not None
+        assert agent._vm is not None
+    
+    @pytest.mark.asyncio
+    async def test_agent_mine_factors(self):
+        """测试因子挖掘功能"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        agent = QuantitativeAgent(enable_alpha_mining=True)
+        
+        result = await agent._mine_factors(
+            stock_code="000001",
+            stock_name="测试股票",
+            market_data=None,
+            sentiment_data=None
+        )
+        
+        assert "factors" in result
+        assert "stats" in result
+        assert isinstance(result["factors"], list)
+    
+    @pytest.mark.asyncio
+    async def test_agent_full_analysis(self):
+        """测试完整分析流程（无 LLM）"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        agent = QuantitativeAgent(
+            llm_provider=None,
+            enable_alpha_mining=True
+        )
+        
+        result = await agent.analyze(
+            stock_code="000001",
+            stock_name="平安银行",
+            market_data=None,
+            sentiment_data=None,
+            context=""
+        )
+        
+        assert result["success"] is True
+        assert result["stock_code"] == "000001"
+        assert "factors_discovered" in result
+    
+    @pytest.mark.asyncio
+    async def test_agent_with_mock_llm(self):
+        """测试使用 Mock LLM"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        # 创建 Mock LLM
+        mock_llm = AsyncMock()
+        mock_llm.chat = AsyncMock(return_value='{"trend": "上涨", "confidence": 0.7}')
+        
+        agent = QuantitativeAgent(
+            llm_provider=mock_llm,
+            enable_alpha_mining=True
+        )
+        
+        # 准备模拟数据
+        import torch
+        market_data = {
+            "close": torch.randn(100).abs() * 100 + 50,
+            "volume": torch.randn(100).abs() * 1e6
+        }
+        
+        result = await agent.analyze(
+            stock_code="000001",
+            stock_name="平安银行",
+            market_data=market_data,
+            context="测试上下文"
+        )
+        
+        assert result["success"] is True
+        assert len(result["factors_discovered"]) >= 0
+    
+    def test_agent_evaluate_factor(self):
+        """测试因子评估"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        agent = QuantitativeAgent(enable_alpha_mining=True)
+        
+        # 同步包装异步调用
+        loop = asyncio.get_event_loop()
+        result = loop.run_until_complete(
+            agent.evaluate_factor("ADD RET VOL")
+        )
+        
+        # 可能成功或失败，取决于公式解析
+        assert "success" in result
+    
+    def test_agent_get_best_factors(self):
+        """测试获取最优因子"""
+        from app.agents.quantitative_agent import QuantitativeAgent
+        
+        agent = QuantitativeAgent(enable_alpha_mining=True)
+        
+        # 手动添加一些因子
+        agent.discovered_factors = [
+            {"formula_str": "ADD(RET, VOL)", "sortino": 1.5},
+            {"formula_str": "MUL(RET, MA5(VOL))", "sortino": 0.8},
+            {"formula_str": "SUB(RET, DELTA1(VOL))", "sortino": 2.0},
+        ]
+        
+        best = 
```

**File**: `backend/tests/test_alpha_mining/test_smoke_p0.py` (added, +476/-0)
```diff
@@ -0,0 +1,476 @@
+"""
+P0 冒烟测试 - Alpha Mining 核心机制
+
+测试覆盖：
+- F02: 配置模块
+- F03-F04: 操作符和时序函数
+- F05: 词汇表
+- F06-F07: FactorVM 执行和解码
+- F08-F09: AlphaGenerator 模型和生成
+- F10: AlphaTrainer 训练
+- F11: 模拟数据生成
+"""
+
+import pytest
+import torch
+import sys
+from pathlib import Path
+
+# 添加项目路径
+project_root = Path(__file__).parent.parent.parent
+sys.path.insert(0, str(project_root))
+
+from app.alpha_mining.config import AlphaMiningConfig, DEFAULT_CONFIG
+from app.alpha_mining.dsl.ops import (
+    OPS_CONFIG, ts_delay, ts_delta, ts_mean, ts_std, get_op_names
+)
+from app.alpha_mining.dsl.vocab import FactorVocab, FEATURES, DEFAULT_VOCAB
+from app.alpha_mining.vm.factor_vm import FactorVM
+from app.alpha_mining.model.alpha_generator import AlphaGenerator
+from app.alpha_mining.model.trainer import AlphaTrainer
+from app.alpha_mining.utils import generate_mock_data
+
+
+# ============================================================================
+# F02: 配置模块测试
+# ============================================================================
+
+class TestConfig:
+    """配置模块测试"""
+    
+    def test_default_config_exists(self):
+        """测试默认配置存在"""
+        assert DEFAULT_CONFIG is not None
+        assert isinstance(DEFAULT_CONFIG, AlphaMiningConfig)
+    
+    def test_config_device(self):
+        """测试设备配置"""
+        config = AlphaMiningConfig()
+        assert config.device in ["cpu", "cuda", "mps"]
+        assert isinstance(config.torch_device, torch.device)
+    
+    def test_config_features(self):
+        """测试特征配置"""
+        config = AlphaMiningConfig()
+        assert len(config.market_features) >= 4
+        assert len(config.all_features) >= 4
+        assert config.num_features > 0
+
+
+# ============================================================================
+# F03-F04: 操作符测试
+# ============================================================================
+
+class TestOps:
+    """操作符测试"""
+    
+    @pytest.fixture
+    def sample_tensor(self):
+        """创建测试张量"""
+        return torch.randn(10, 100)  # [batch=10, time=100]
+    
+    def test_ts_delay(self, sample_tensor):
+        """测试时序延迟"""
+        result = ts_delay(sample_tensor, d=1)
+        assert result.shape == sample_tensor.shape
+        # 第一列应该是 0
+        assert (result[:, 0] == 0).all()
+        # 后续应该是原始值的延迟
+        assert torch.allclose(result[:, 1:], sample_tensor[:, :-1])
+    
+    def test_ts_delta(self, sample_tensor):
+        """测试时序差分"""
+        result = ts_delta(sample_tensor, d=1)
+        assert result.shape == sample_tensor.shape
+        # 差分 = x[t] - x[t-1]
+        expected = sample_tensor - ts_delay(sample_tensor, 1)
+        assert torch.allclose(result, expected)
+    
+    def test_ts_mean(self, sample_tensor):
+        """测试滑动平均"""
+        result = ts_mean(sample_tensor, window=5)
+        assert result.shape == sample_tensor.shape
+        # 值应该在合理范围内
+        assert not torch.isnan(result).any()
+    
+    def test_ts_std(self, sample_tensor):
+        """测试滑动标准差"""
+        result = ts_std(sample_tensor, window=5)
+        assert result.shape == sample_tensor.shape
+        # 标准差应该非负
+        assert (result >= 0).all()
+    
+    def test_ops_config_complete(self):
+        """测试操作符配置完整性"""
+        assert len(OPS_CONFIG) >= 10
+        for name, func, arity in OPS_CONFIG:
+            assert isinstance(name, str)
+            assert callable(func)
+            assert arity in [1, 2, 3]
+    
+    def test_all_ops_executable(self, sample_tensor):
+        """测试所有操作符可执行"""
+        y = torch.randn_like(sample_tensor)
+        z = torch.randn_like(sample_tensor)
+        
+        for name, func, arity in OPS_CONFIG:
+            try:
+                if arity == 1:
+                    result = func(sample_tensor)
+                elif arity == 2:
+                    result = func(sample_tensor, y)
+                elif arity == 3:
+                    result = func(sample_tensor, y, z)
+                
+                assert result.shape == sample_tensor.shape, f"{name} shape mismatch"
+                assert not torch.isnan(result).all(), f"{name} all NaN"
+            except Exception as e:
+                pytest.fail(f"Operator {name} failed: {e}")
+
+
+# ============================================================================
+# F05: 词汇表测试
+# ============================================================================
+
+class TestVocab:
+    """词汇表测试"""
+    
+    def test_default_vocab_exists(self):
+        """测试默认词汇表存在"""
+        assert DEFAULT_VOCAB is not None
+        assert DEFAULT_VOCAB.vocab_size > 0
+    
+    def test_vocab_token_mapping(self):
+        """测试 token 映射"""
+        vocab = FactorVocab()
+        
+        # 测试特征映射
+        assert vocab.token_to_name(0) == FEATURES[0]
+        assert vocab.name_to_token(FEATURES[0]) == 0
+        
+        # 测试操作符映射
+        op_names = get_op_names()
+        first_op_token = vocab.num_features
+        assert vocab.t
```

**File**: `backend/tests/test_alpha_mining/test_smoke_p1.py` (added, +403/-0)
```diff
@@ -0,0 +1,403 @@
+"""
+P1 冒烟测试 - Alpha Mining 数据集成
+
+测试覆盖：
+- F13: MarketFeatureBuilder
+- F14: SentimentFeatureBuilder
+- F15: FactorEvaluator
+- F16: AlphaMiningTool
+"""
+
+import pytest
+import torch
+import pandas as pd
+import numpy as np
+import sys
+from pathlib import Path
+from datetime import datetime, timedelta
+
+# 添加项目路径
+project_root = Path(__file__).parent.parent.parent
+sys.path.insert(0, str(project_root))
+
+from app.alpha_mining.config import AlphaMiningConfig, DEFAULT_CONFIG
+from app.alpha_mining.features.market import MarketFeatureBuilder
+from app.alpha_mining.features.sentiment import SentimentFeatureBuilder
+from app.alpha_mining.backtest.evaluator import FactorEvaluator
+from app.alpha_mining.utils import generate_mock_data
+
+
+# ============================================================================
+# F13: MarketFeatureBuilder 测试
+# ============================================================================
+
+class TestMarketFeatureBuilder:
+    """行情特征构建器测试"""
+    
+    @pytest.fixture
+    def builder(self):
+        return MarketFeatureBuilder()
+    
+    @pytest.fixture
+    def sample_df(self):
+        """创建示例 DataFrame"""
+        dates = pd.date_range("2024-01-01", periods=100, freq="D")
+        np.random.seed(42)
+        
+        return pd.DataFrame({
+            "date": dates,
+            "close": 100 * np.exp(np.cumsum(np.random.randn(100) * 0.02)),
+            "volume": np.abs(np.random.randn(100)) * 1e6 + 1e6,
+            "turnover": np.abs(np.random.randn(100)) * 0.05,
+        }).set_index("date")
+    
+    def test_build_from_dataframe(self, builder, sample_df):
+        """测试从 DataFrame 构建特征"""
+        features = builder.build(sample_df)
+        
+        assert features.dim() == 3  # [batch, features, time]
+        assert features.size(0) == 1  # batch=1
+        assert features.size(1) == 4  # 4 个特征
+        assert features.size(2) == 100  # time_steps
+    
+    def test_build_from_tensors(self, builder):
+        """测试从张量字典构建特征"""
+        data = {
+            "close": torch.randn(10, 100).abs() * 100 + 50,
+            "volume": torch.randn(10, 100).abs() * 1e6,
+        }
+        
+        features = builder.build(data)
+        
+        assert features.shape == (10, 4, 100)
+    
+    def test_features_normalized(self, builder, sample_df):
+        """测试特征被正确标准化"""
+        features = builder.build(sample_df)
+        
+        # 检查值在合理范围内
+        assert features.max() <= 5.0
+        assert features.min() >= -5.0
+    
+    def test_no_nan_in_features(self, builder, sample_df):
+        """测试特征无 NaN"""
+        features = builder.build(sample_df)
+        
+        assert not torch.isnan(features).any()
+        assert not torch.isinf(features).any()
+    
+    def test_feature_names(self, builder):
+        """测试特征名称"""
+        names = builder.get_feature_names()
+        
+        assert "RET" in names
+        assert "VOL" in names
+        assert "VOLUME_CHG" in names
+        assert "TURNOVER" in names
+
+
+# ============================================================================
+# F14: SentimentFeatureBuilder 测试
+# ============================================================================
+
+class TestSentimentFeatureBuilder:
+    """情感特征构建器测试"""
+    
+    @pytest.fixture
+    def builder(self):
+        return SentimentFeatureBuilder()
+    
+    @pytest.fixture
+    def sample_df(self):
+        """创建示例 DataFrame"""
+        dates = pd.date_range("2024-01-01", periods=50, freq="D")
+        np.random.seed(42)
+        
+        return pd.DataFrame({
+            "date": dates,
+            "sentiment": np.random.randn(50) * 0.3,
+            "news_count": np.abs(np.random.randn(50)) * 5 + 1,
+        }).set_index("date")
+    
+    def test_build_from_dataframe(self, builder, sample_df):
+        """测试从 DataFrame 构建特征"""
+        features = builder.build(sample_df)
+        
+        assert features.dim() == 3
+        assert features.size(0) == 1
+        assert features.size(1) == 2  # SENTIMENT, NEWS_COUNT
+        assert features.size(2) == 50
+    
+    def test_build_from_dict(self, builder):
+        """测试从字典构建特征"""
+        data = {
+            "sentiment": [0.1, -0.2, 0.3, 0.0, -0.1],
+            "news_count": [5, 3, 8, 2, 4]
+        }
+        
+        features = builder.build(data)
+        
+        assert features.shape == (1, 2, 5)
+    
+    def test_build_from_list(self, builder):
+        """测试从列表构建特征"""
+        data = [
+            {"sentiment": 0.1, "news_count": 5},
+            {"sentiment": -0.2, "news_count": 3},
+            {"sentiment": 0.3, "news_count": 8},
+        ]
+        
+        features = builder.build(data)
+        
+        assert features.shape == (1, 2, 3)
+    
+    def test_time_alignment(self, builder):
+        """测试时间步对齐"""
+        data = {"sentiment": [0.1, 0.2, 0.3], "news_count": [1, 2, 3]}
+        
+        features = builder.build(data, time_steps=10)
```

**File**: `backend/tests/test_smoke_alpha_mining.py` (added, +381/-0)
```diff
@@ -0,0 +1,381 @@
+"""
+Alpha Mining 模块冒烟测试
+
+测试覆盖：
+1. DSL 操作符执行
+2. 因子虚拟机（FactorVM）
+3. 因子生成模型（AlphaGenerator）
+4. RL 训练器（AlphaTrainer）
+5. 因子评估器（FactorEvaluator）
+6. REST API 端点
+"""
+
+import pytest
+import torch
+import numpy as np
+from typing import List
+
+# 确保可以导入模块
+import sys
+from pathlib import Path
+sys.path.insert(0, str(Path(__file__).parent.parent / "app"))
+
+
+class TestDSLOperators:
+    """测试 DSL 操作符"""
+    
+    def test_ops_config_exists(self):
+        """操作符配置存在"""
+        from app.alpha_mining.dsl.ops import OPS_CONFIG, get_op_names
+        
+        assert len(OPS_CONFIG) == 21, f"Expected 21 operators, got {len(OPS_CONFIG)}"
+        
+        names = get_op_names()
+        assert 'ADD' in names
+        assert 'SUB' in names
+        assert 'MUL' in names
+        assert 'DIV' in names
+        assert 'MA5' in names
+        assert 'DELAY1' in names
+    
+    def test_arithmetic_ops(self):
+        """算术操作符测试"""
+        from app.alpha_mining.dsl.ops import get_op_by_name
+        
+        x = torch.tensor([1.0, 2.0, 3.0])
+        y = torch.tensor([2.0, 3.0, 4.0])
+        
+        # ADD
+        add_fn, add_arity = get_op_by_name('ADD')
+        assert add_arity == 2
+        result = add_fn(x, y)
+        assert torch.allclose(result, torch.tensor([3.0, 5.0, 7.0]))
+        
+        # MUL
+        mul_fn, mul_arity = get_op_by_name('MUL')
+        result = mul_fn(x, y)
+        assert torch.allclose(result, torch.tensor([2.0, 6.0, 12.0]))
+        
+        # DIV (safe division)
+        div_fn, _ = get_op_by_name('DIV')
+        result = div_fn(x, y)
+        assert result.shape == x.shape
+        assert not torch.any(torch.isinf(result))
+    
+    def test_timeseries_ops(self):
+        """时序操作符测试"""
+        from app.alpha_mining.dsl.ops import ts_delay, ts_mean, ts_std
+        
+        x = torch.tensor([[1.0, 2.0, 3.0, 4.0, 5.0]])
+        
+        # Delay
+        delayed = ts_delay(x, 1)
+        assert delayed[0, 0] == 0  # 填充 0
+        assert delayed[0, 1] == 1  # 原来的第一个值
+        
+        # MA
+        ma = ts_mean(x, 3)
+        assert ma.shape == x.shape
+        
+        # STD
+        std = ts_std(x, 3)
+        assert std.shape == x.shape
+
+
+class TestFactorVM:
+    """测试因子虚拟机"""
+    
+    @pytest.fixture
+    def vm(self):
+        from app.alpha_mining.vm.factor_vm import FactorVM
+        from app.alpha_mining.dsl.vocab import DEFAULT_VOCAB
+        return FactorVM(vocab=DEFAULT_VOCAB)
+    
+    @pytest.fixture
+    def sample_features(self):
+        """[batch=2, features=4, time=10]"""
+        return torch.randn(2, 4, 10)
+    
+    def test_execute_simple_formula(self, vm, sample_features):
+        """执行简单因子表达式"""
+        # RET + VOL (假设 RET=0, VOL=1, ADD=某个 token)
+        formula = [0, 1, vm.vocab.name_to_token('ADD')]
+        
+        result = vm.execute(formula, sample_features)
+        assert result is not None
+        assert result.shape == (2, 10)  # [batch, time]
+    
+    def test_execute_invalid_formula(self, vm, sample_features):
+        """无效表达式返回 None"""
+        # 不完整的表达式
+        formula = [0]  # 只有一个特征，没有操作
+        result = vm.execute(formula, sample_features)
+        # 只有一个操作数，应该返回该操作数（有效）
+        assert result is not None
+        
+        # 操作符参数不足
+        formula = [vm.vocab.name_to_token('ADD')]  # 二元操作符但没有操作数
+        result = vm.execute(formula, sample_features)
+        assert result is None
+    
+    def test_decode_formula(self, vm):
+        """解码因子表达式为字符串"""
+        formula = [0, 1, vm.vocab.name_to_token('ADD')]
+        decoded = vm.decode(formula)
+        assert decoded is not None
+        assert 'ADD' in decoded or '+' in decoded
+
+
+class TestAlphaGenerator:
+    """测试因子生成模型"""
+    
+    @pytest.fixture
+    def generator(self):
+        from app.alpha_mining.model.alpha_generator import AlphaGenerator
+        from app.alpha_mining.dsl.vocab import DEFAULT_VOCAB
+        from app.alpha_mining.config import AlphaMiningConfig
+        
+        config = AlphaMiningConfig()
+        return AlphaGenerator(vocab=DEFAULT_VOCAB, config=config)
+    
+    def test_generate_batch(self, generator):
+        """生成一批因子表达式"""
+        formulas, log_probs = generator.generate(batch_size=5, max_len=8)
+        
+        assert len(formulas) == 5
+        for formula in formulas:
+            assert len(formula) <= 8
+            assert all(isinstance(t, int) for t in formula)
+    
+    def test_generate_with_training(self, generator):
+        """训练模式生成"""
+        sequences, log_probs_list, values = generator.generate_with_training(
+            batch_size=3, device='cpu'
+        )
+        
+        assert sequences.shape[0] == 3
+        assert len(log_probs_list) > 0
+
+
+class TestAlphaTrainer:
+    """测试 RL 训练器"""
+    
+    @pytest.fixture
+    def trainer(self):
+        from app.alpha_mining.model.trainer import AlphaTrainer
+        from app.alpha_mining.config import AlphaMiningConfig
```

---

### Incident Patch 5: `86a18373` (2026-01-12)
**Commit Message**: feat(ui): add tabs component for Alpha Mining page navigation

- Add reusable tabs component for tab-based navigation
- Support active tab highlighting and click handlers

**File**: `frontend/src/components/ui/tabs.tsx` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import * as React from "react"
+import * as TabsPrimitive from "@radix-ui/react-tabs"
+import { cn } from "@/lib/utils"
+
+const Tabs = TabsPrimitive.Root
+
+const TabsList = React.forwardRef<
+  React.ElementRef<typeof TabsPrimitive.List>,
+  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
+>(({ className, ...props }, ref) => (
+  <TabsPrimitive.List
+    ref={ref}
+    className={cn(
+      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
+      className
+    )}
+    {...props}
+  />
+))
+TabsList.displayName = TabsPrimitive.List.displayName
+
+const TabsTrigger = React.forwardRef<
+  React.ElementRef<typeof TabsPrimitive.Trigger>,
+  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
+>(({ className, ...props }, ref) => (
+  <TabsPrimitive.Trigger
+    ref={ref}
+    className={cn(
+      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
+      className
+    )}
+    {...props}
+  />
+))
+TabsTrigger.displayName = TabsPrimitive.Trigger.displayName
+
+const TabsContent = React.forwardRef<
+  React.ElementRef<typeof TabsPrimitive.Content>,
+  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
+>(({ className, ...props }, ref) => (
+  <TabsPrimitive.Content
+    ref={ref}
+    className={cn(
+      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
+      className
+    )}
+    {...props}
+  />
+))
+TabsContent.displayName = TabsPrimitive.Content.displayName
+
+export { Tabs, TabsList, TabsTrigger, TabsContent }
```

---

### Incident Patch 6: `a1f67061` (2026-01-12)
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

### Incident Patch 7: `47cb6e65` (2026-01-10)
**Commit Message**: feat(frontend): 添加搜索计划UI展示和历史会话功能支持

**File**: `frontend/src/components/DebateChatRoom.tsx` (modified, +251/-33)
```diff
@@ -1,12 +1,39 @@
-import React, { useState, useRef, useEffect } from 'react'
-import { Send, User, TrendingUp, TrendingDown, Briefcase, Loader2, Bot } from 'lucide-react'
+import React, { useState, useRef, useEffect, useCallback } from 'react'
+import { 
+  Send, User, TrendingUp, TrendingDown, Briefcase, 
+  Loader2, Bot, History, Trash2, Search, ChevronDown,
+  CheckCircle2, Clock, ListChecks, PlayCircle, XCircle
+} from 'lucide-react'
 import { Button } from '@/components/ui/button'
 import ReactMarkdown from 'react-markdown'
 import remarkGfm from 'remark-gfm'
 import { cn } from '@/lib/utils'
+import MentionInput, { MentionTarget } from './MentionInput'
+import type { DebateSession } from '@/store/useDebateStore'
+import { agentApi, SSEDebateEvent } from '@/lib/api-client'
+import { toast } from 'sonner'
 
 // 消息角色类型
-export type ChatRole = 'user' | 'bull' | 'bear' | 'manager' | 'system' | 'data_collector'
+export type ChatRole = 'user' | 'bull' | 'bear' | 'manager' | 'system' | 'data_collector' | 'search'
+
+// 搜索计划类型
+export interface SearchTask {
+  id: string
+  source: string
+  query: string
+  description: string
+  icon: string
+  estimated_time: number
+}
+
+export interface SearchPlan {
+  plan_id: string
+  stock_code: string
+  stock_name: string
+  user_query: string
+  tasks: SearchTask[]
+  total_estimated_time: number
+}
 
 // 聊天消息类型
 export interface ChatMessage {
@@ -16,6 +43,8 @@ export interface ChatMessage {
   timestamp: Date
   round?: number
   isStreaming?: boolean
+  searchPlan?: SearchPlan // 关联的搜索计划
+  searchStatus?: 'pending' | 'executing' | 'completed' | 'cancelled'
 }
 
 // 角色配置
@@ -74,21 +103,114 @@ const ROLE_CONFIG: Record<ChatRole, {
     textColor: 'text-white',
     borderColor: 'border-gray-200',
     align: 'left'
+  },
+  search: {
+    name: '搜索结果',
+    icon: <Bot className="w-4 h-4" />,
+    bgColor: 'bg-cyan-500',
+    textColor: 'text-white',
+    borderColor: 'border-cyan-300',
+    align: 'left'
   }
 }
 
 interface DebateChatRoomProps {
   messages: ChatMessage[]
-  onSendMessage: (content: string) => void
+  onSendMessage: (content: string, mentions?: MentionTarget[]) => void
   isDebating: boolean
   currentRound?: { round: number; maxRounds: number } | null
   activeAgent?: string | null
   stockName?: string
   disabled?: boolean
+  // 历史相关
+  historySessions?: DebateSession[]
+  onLoadSession?: (sessionId: string) => void
+  onClearHistory?: () => void
+  showHistory?: boolean
+  // 搜索计划相关
+  onConfirmSearch?: (plan: SearchPlan, msgId: string) => void
+  onCancelSearch?: (msgId: string) => void
+}
+
+// 搜索计划展示组件
+const SearchPlanCard: React.FC<{ 
+  plan: SearchPlan, 
+  status: string,
+  onConfirm: (plan: SearchPlan) => void,
+  onCancel: () => void
+}> = ({ plan, status, onConfirm, onCancel }) => {
+  const isPending = status === 'pending'
+  const isExecuting = status === 'executing'
+  
+  return (
+    <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300">
+      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
+        <ListChecks className="w-5 h-5 text-indigo-500" />
+        <h4 className="font-semibold text-slate-800 text-sm">📋 搜索计划确认</h4>
+      </div>
+      
+      <div className="space-y-2 mb-4">
+        {plan.tasks.map((task, index) => (
+          <div key={task.id} className="flex items-start gap-3 text-xs text-slate-600">
+            <span className="mt-0.5">{task.icon || '🔍'}</span>
+            <div className="flex-1">
+              <p className="font-medium text-slate-700">{index + 1}. {task.description}</p>
+              <p className="text-[10px] text-slate-400">关键词: "{task.query}"</p>
+            </div>
+          </div>
+        ))}
+      </div>
+      
+      <div className="flex items-center justify-between pt-2">
+        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
+          <Clock className="w-3 h-3" />
+          预计耗时: {plan.total_estimated_time}s
+        </div>
+        
+        {isPending && (
+          <div className="flex gap-2">
+            <Button 
+              size="sm" 
+              variant="outline" 
+              className="h-7 text-[10px] px-3 py-0"
+              onClick={onCancel}
+            >
+              取消
+            </Button>
+            <Button 
+              size="sm" 
+              className="h-7 text-[10px] px-3 py-0 bg-indigo-500 hover:bg-indigo-600"
+              onClick={() => onConfirm(plan)}
+            >
+              确认执行
+            </Button>
+          </div>
+        )}
+        
+        {isExecuting && (
+          <div className="flex items-center gap-2 text-[10px] text-indigo-600 animate-pulse">
+            <Loader2 className="w-3 h-3 animate-spin" />
+            正在搜索中...
+          </div>
+        )}
+        
+        {status === 'completed' && (
+          <div className="flex items-center gap-1 text-[10px] text-emerald-600 fon
```

---

### Incident Patch 8: `0db32440` (2025-12-27)
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
