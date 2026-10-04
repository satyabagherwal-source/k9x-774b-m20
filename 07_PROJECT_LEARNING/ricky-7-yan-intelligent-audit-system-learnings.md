# Forensic Learning Record (Deep Inspection): Ricky-7-Yan/intelligent-audit-system

> **Canonical Artifact**: `07_PROJECT_LEARNING/ricky-7-yan-intelligent-audit-system-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Ricky-7-Yan/intelligent-audit-system](https://github.com/Ricky-7-Yan/intelligent-audit-system))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:39:11.413Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Ricky-7-Yan/intelligent-audit-system`
- **Description**: AuditPilot: auditable enterprise AI agents for evidence-grounded workflows, governed tools, evaluation harnesses, human review, and remediation delivery.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1172 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/audit_agent.py`
```
"""Enterprise audit Agent orchestration.

The agent follows a practical audit workflow:
scope planning -> RAG evidence retrieval -> control mapping -> risk scoring ->
audit program generation -> quality gate -> findings and remediation planning.
It keeps deterministic fallbacks so the product remains usable without external
LLM, database, graph, or embedding services.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import AUDIT_CONFIG, LLM_CONFIG, MYSQL_CONFIG, NEO4J_CONFIG
from services.llm_client import LLMClient
from services.security import current_tenant_id

try:
    import pymysql
except Exception:  # pragma: no cover
    pymysql = None

try:
    from neo4j import GraphDatabase
except Exception:  # pragma: no cover
    GraphDatabase = None


logger = logging.getLogger(__name__)


AUDIT_STANDARDS: Dict[str, Dict[str, Any]] = {
    "COBIT": {
        "name": "COBIT 2019",
        "focus": "企业 IT 治理、价值交付、风险优化、资源优化和绩效度量",
        "controls": ["治理目标映射", "流程责任矩阵", "绩效指标", "风险场景管理"],
    },
    "ISO27001": {
        "name": "ISO/IEC 27001",
        "focus": "信息安全管理体系、风险评估、控制措施选择和持续改进",
        "controls": ["访问控制", "资产管理", "事件响应", "供应商安全", "备份与恢复"],
    },
    "SOX": {
        "name": "Sarbanes-Oxley Act",
        "focus": "财务报告相关内部控制、ITGC、变更审批、职责分离和审计证据",
        "controls": ["职责分离", "变更管理", "日志留存", "财务数据完整性", "管理层复核"],
    },
    "数据安全法": {
        "name": "数据安全法 / 个人信息保护相关要求",
        "focus": "数据分类分级、重要数据保护、个人信息处理、风险监测和应急处置",
        "controls": ["分类分级", "最小权限", "数据加密", "共享审批", "应急预案"],
    },
}


RISK_KEYWORDS: Dict[str, Dict[str, Any]] = {
    "权限": {"score": 0.84, "risk": "权限滥用、越权访问或职责分离不足", "domain": "访问控制"},
    "账号": {"score": 0.78, "risk": "账号生命周期和特权账号管理不足", "domain": "身份治理"},
    "财务": {"score": 0.86, "risk": "财务数据完整性、审批链路和报表可靠性风险", "domain": "财务内控"},
    "变更": {"score": 0.75, "risk": "系统变更未经过充分审批、测试或上线后复核", "domain": "变更管理"},
    "备份": {"score": 0.69, "risk": "备份不可恢复或恢复目标不清晰", "domain": "业务连续性"},
    "日志": {"score": 0.66, "risk": "审计日志不完整、不可追溯或缺少告警", "domain": "监控审计"},
    "数据": {"score": 0.77, "risk": "敏感数据泄露、过度使用或共享不合规", "domain": "数据安全"},
    "接口": {"score": 0.71, "risk": "接口鉴权、限流、对账和异常处置不足", "domain": "接口安全"},
}


CONTROL_LIBRARY: List[Dict[str, Any]] = [
    {
        "id": "AC-01",
        "domain": "访问控制",
        "keywords": ["权限", "账号", "访问", "ERP", "身份"],
        "objective": "确保用户仅拥有完成岗位职责所需的最小权限。",
        "test_procedure": "抽样检查用户权限、角色授权、审批记录和最近一次权限复核结果。",
        "evidence_required": ["权限清单", "授权审批单", "角色矩阵", "定期复核记录"],
        "standards": ["ISO27001", "SOX", "COBIT"],
    },
    {
        "id": "AC-02",
        "domain": "职责分离",
        "keywords": ["权限", "财务", "职责", "审批", "制单"],
        "objective": "防止同一人员同时拥有发起、审批和复核关键交易的权限。",
        "test_procedure": "识别互斥权限组合，核查例外审批、补偿性控制和整改闭环。",
        "evidence_required": ["职责分离规则", "冲突权限报表", "例外审批", "补偿性控制记录"],
        "standards": ["SOX", "COBIT"],
    },
    {
        "id": "CM-01",
        "domain": "变更管理",
        "keywords": ["变更", "上线", "发布", "系统"],
        "objective": "确保生产变更经过授权、测试、回退设计和上线后复核。",
        "test_procedure": "抽样检查变更单、测试证据、审批链、上线记录和回退方案。",
        "evidence_required": ["变更单", "测试报告", "上线审批", "回退方案", "上线后复核"],
        "standards": ["ISO27001", "SOX", "COBIT"],
    },
    {
        "id": "BC-01",
        "domain": "业务连续性",
        "keywords": ["备份", "恢复", "灾备", "RPO", "RTO"],
        "objective": "确保关键系统和数据可在既定恢复目标内恢复。",
        "test_procedure": "检查备份策略、备份成功率、恢复演练记录和问题整改闭环。",
        "evidence_required": ["备份策略", "备份日志", "恢复演练报告", "RPO/RTO 定义"],
        "standards": ["ISO27001", "COBIT"],
    },
    {
        "id": "LOG-01",
        "domain": "监控审计",
        "keywords": ["日志", "监控", "告警", "审计轨迹"],
        "objective": "确保关键操作可记录、可追溯、可告警。",
        "test_procedure": "检查日志范围、留存周期、防篡改机制、告警规则和处置记录。",
        "evidence_required": ["日志策略", "日志样本", "告警规则", "事件处置单"],
        "standards": ["ISO27001", "数据安全法"],
    },
    {
        "id": "DATA-01",
        "domain": "数据安全",
        "keywords": ["数据", "敏感", "个人信息", "加密", "脱敏"],
        "objective": "确保敏感数据分类分级、授权使用、加密脱敏和共享审批。",
        "test_procedure": "检查数据目录、分类分级、访问授权、加密脱敏和共享审批记录。",
        "evidence_required": ["数据目录", "分类分级规则", "访问授权", "加密配置", "共享审批"],
        "standards": ["数据安全法", "ISO27001"],
    },
    {
        "id": "API-01",
        "domain": "接口安全",
        "keywords": ["接口", "API", "对账", "鉴权", "限流"],
        "objective": "确保接口调用有鉴权、限流、监控、对账和异常处置。",
        "test_procedure": "检查接口台账、密钥管理、调用日志、限流策略和对账记录。",
        "evidence_required": ["接口台账", "鉴权配置", "调用日志", "限流规则", "对账记录"],
        "standards": ["ISO27001", "COBIT"],
    },
]


@dataclass
class ServiceStatus:
    llm: bool = False
    mysql: bool = False
    neo4j: bool = False


@dataclass
class AgentMessage:
    role: str
    content: str
    rag: bool = False


class OptionalAuditTools:
    def __init__(self, connect: bool = True) -> None:
        self.mysql_connection = None
        self.neo4j_driver = None
        self.status = ServiceStatus()
        if connect:
            self._connect_mysql()
            self._connect_neo4j()

    def _connect_mysql(self) -> None:
        if not pymysql or not MYSQL_CONFIG.get("password"):
            return
        try:
            self.mysql_connection = pymysql.connect(**MYSQL_CONFIG)
            self.status.mysql = True
        except Exception as exc:
            logger.info("MySQL unavailable, using built-in standards: %s", exc)

    def _connect_neo4j(self) -> None:
        if not GraphDatabase or not NEO4J_CONFIG.get("password"):
            return
        driver = None
        try:
            driver = GraphDatabase.driver(
                NEO4J_CONFIG["uri"],
                auth=(NEO4J_CONFIG["user"], NEO4J_CONFIG["password"]),
                connection_timeout=NEO4J_CONFIG.get("timeout", 3),
            )
            driver.verify_connectivity()
            self.neo4j_driver = driver
            self.status.neo4j = True
        except Exception as exc:
            logger.info("Neo4j unavailable, using local graph fallback: %s", exc)
            if driver:
                driver.close()
            self.neo4j_driver = None

    def close(self) -> None:
        if self.mysql_connection:
            self.mysql_connection.close()
        if self.neo4j_driver:
            self.neo4j_driver.close()

    def query_knowledge_graph(self, query: str) -> List[Dict[str, Any]]:
        if not self.neo4j_driver:
            return []
        cypher = """
        MATCH (n)-[r]->(m)
        WHERE toLower(coalesce(n.text, n.name, '')) CONTAINS toLower($query)
           OR toLower(coalesce(m.text, m.name, '')) CONTAINS toLower($query)
        RETURN coalesce(n.text, n.name) AS source,
               labels(n) AS source_labels,
               type(r) AS relation,
               coalesce(m.text, m.name) AS target,
               labels(m) AS target_labels
        LIMIT 12
        """
        try:
            with self.neo4j_driver.session() as session:
                return [dict(record) for record in session.run(cypher, query=query)]
        except Exception as exc:
            logger.warning("Knowledge graph query failed: %s", exc)
            return []

    def get_standards(self, standard_type: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.mysql_connection:
            try:
                with self.mysql_connection.cursor() as cursor:
                    if standard_type:
                        cursor.execute(
                            """
                            SELECT standard_name, standard_type, version, description, requirements
                            FROM audit_standards
                            WHERE standard_type = %s
                            """,
                            (standard_type,),
                        )
                    else:
                        cursor.execute(
                            """
                            SELECT standard_name, standard_type, version, description, requirements
                            FROM audit_standards
                            """
                        )
                    rows = cursor.fetchall()
                return [
                    {
                        "name": row[0],
                        "type": row[1],
                        "version": row[2],
                        "description": row[3],
                        "requirements": json.loads(row[4]) if row[4] else {},
                    }
                    for row in rows
                ]
            except Exception as exc:
                logger.warning("Audit standards query failed: %s", exc)

        if standard_type:
            standard = AUDIT_STANDARDS.get(standard_type)
            return [{**standard, "type": standard_type}] if standard else []
        return [{**value, "type": key} for key, value in AUDIT_STANDARDS.items()]


class AuditAgent:
    def __init__(
        self,
        rag_pipeline: Any = None,
        enable_llm: Optional[bool] = None,
        enable_external_tools: bool = True,
    ) -> None:
        self.tools = OptionalAuditTools(connect=enable_external_tools)
        self.rag_pipeline = rag_pipeline
        self.session_memory: Dict[str, List[AgentMessage]] = {}
        self.llm = self._init_llm() if enable_llm is not False else None
        logger.info(
            "AuditAgent initialized. LLM=%s MySQL=%s Neo4j=%s",
            bool(self.llm),
            self.tools.status.mysql,
            self.tools.status.neo4j,
        )

    def _init_llm(self) -> Any:
        if os.getenv("AUDIT_DISABLE_LLM", "1").lower() in {"1", "true", "yes"}:
            return None
        if not LLM_CONFIG.get("enabled"):
            return None
        try:
            return LLMClient(
                api_key=LLM_CONFIG["api_key"],
                base_url=LLM_CONFIG["base_url"],
                model=LLM_CONFIG["model"],
  
```

### Core Architecture Module: `config.py`
```
"""
Application configuration for the Intelligent Audit System.

The module intentionally keeps secrets outside source control. Runtime values are
loaded from ``config.env`` when present, then from the process environment.
"""

import ipaddress
import json
import os
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / "config.env")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _list_env(name: str, default: str = "") -> List[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


def _json_env(name: str, default: Any) -> Any:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return default


PATHS: Dict[str, Path] = {
    "data": PROJECT_ROOT / "data",
    "training_data": PROJECT_ROOT / "data" / "training",
    "models": PROJECT_ROOT / "models",
    "logs": PROJECT_ROOT / "logs",
    "static": PROJECT_ROOT / "static",
    "templates": PROJECT_ROOT / "templates",
    "uploads": PROJECT_ROOT / "data" / "uploads",
    "rag_store": PROJECT_ROOT / "data" / "rag_store",
    "evaluation_runs": PROJECT_ROOT / "data" / "evaluation_runs",
    "evidence_analyses": PROJECT_ROOT / "data" / "evidence_analyses",
    "agent_runtime": PROJECT_ROOT / "data" / "agent_runtime",
    "audit_events": PROJECT_ROOT / "data" / "audit_events",
    "quarantine": PROJECT_ROOT / "data" / "quarantine",
}

for path in PATHS.values():
    path.mkdir(parents=True, exist_ok=True)


MYSQL_CONFIG: Dict[str, Any] = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "port": _int_env("MYSQL_PORT", 3306),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "audit_system"),
    "charset": "utf8mb4",
    "connect_timeout": _int_env("MYSQL_CONNECT_TIMEOUT", 3),
}

NEO4J_CONFIG: Dict[str, Any] = {
    "uri": os.getenv("NEO4J_URI", "bolt://localhost:7687"),
    "user": os.getenv("NEO4J_USER", "neo4j"),
    "password": os.getenv("NEO4J_PASSWORD", ""),
    "timeout": _int_env("NEO4J_CONNECT_TIMEOUT", 3),
}

LLM_CONFIG: Dict[str, Any] = {
    "provider": os.getenv("LLM_PROVIDER", "deepseek"),
    "api_key": os.getenv("DEEPSEEK_API_KEY") or os.getenv("QWEN_API_KEY") or os.getenv("OPENAI_API_KEY") or "",
    "base_url": os.getenv(
        "LLM_BASE_URL",
        os.getenv("DEEPSEEK_BASE_URL", os.getenv("QWEN_BASE_URL", "https://api.deepseek.com")),
    ),
    "model": os.getenv("LLM_MODEL", os.getenv("DEEPSEEK_MODEL", os.getenv("QWEN_MODEL", "deepseek-chat"))),
    "max_tokens": _int_env("MAX_TOKENS", 2048),
    "temperature": _float_env("TEMPERATURE", 0.2),
    "top_p": _float_env("TOP_P", 0.9),
}
LLM_CONFIG["enabled"] = bool(LLM_CONFIG["api_key"])

WEB_CONFIG: Dict[str, Any] = {
    "host": os.getenv("WEB_HOST", "127.0.0.1"),
    "port": _int_env("PORT", _int_env("WEB_PORT", 8000)),
    "debug": _bool_env("DEBUG", False),
    "cors_origins": _list_env("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000"),
}

SECURITY_CONFIG: Dict[str, Any] = {
    # local keeps the zero-config desktop experience. Set enforced in any shared deployment.
    "mode": os.getenv("SECURITY_MODE", "local").strip().lower(),
    "default_tenant": os.getenv("DEFAULT_TENANT_ID", "local"),
    "default_subject": os.getenv("DEFAULT_SUBJECT", "local-admin"),
    "api_tokens": _json_env("AUDITPILOT_API_TOKENS_JSON", {}),
    "rate_limit_per_minute": _int_env("API_RATE_LIMIT_PER_MINUTE", 180),
    "tenant_isolation": _bool_env("TENANT_ISOLATION", True),
    "audit_log_signing_key": os.getenv("AUDIT_LOG_SIGNING_KEY", ""),
}

UPLOAD_CONFIG: Dict[str, Any] = {
    "knowledge_max_bytes": _int_env("KNOWLEDGE_UPLOAD_MAX_BYTES", 5 * 1024 * 1024),
    "evidence_max_bytes": _int_env("EVIDENCE_UPLOAD_MAX_BYTES", 5 * 1024 * 1024),
    "chunk_bytes": _int_env("UPLOAD_CHUNK_BYTES", 64 * 1024),
    "reject_prompt_injection": _bool_env("REJECT_PROMPT_INJECTION", True),
}

AUDIT_CONFIG: Dict[str, Any] = {
    "max_session_messages": _int_env("MAX_SESSION_MESSAGES", 20),
    "risk_threshold_high": _float_env("RISK_THRESHOLD_HIGH", 0.72),
    "risk_threshold_medium": _float_env("RISK_THRESHOLD_MEDIUM", 0.42),
}

RAG_CONFIG: Dict[str, Any] = {
    "chunk_size": _int_env("RAG_CHUNK_SIZE", 700),
    "chunk_overlap": _int_env("RAG_CHUNK_OVERLAP", 120),
    "top_k": _int_env("RAG_TOP_K", 5),
    "store_file": PATHS["rag_store"] / "documents.json",
    "embedding_model": os.getenv(
        "RAG_EMBEDDING_MODEL",
        str(PATHS["models"] / "sentence-transformers" / "paraphrase-multilingual-MiniLM-L12-v2"),
    ),
    "enable_tfidf": _bool_env("RAG_ENABLE_TFIDF", True),
    "enable_embeddings": _bool_env("RAG_ENABLE_EMBEDDINGS", False),
}

TRAINING_CONFIG: Dict[str, Any] = {
    "batch_size": _int_env("TRAINING_BATCH_SIZE", 8),
    "learning_rate": _float_env("TRAINING_LEARNING_RATE", 2e-5),
    "num_epochs": _int_env("TRAINING_EPOCHS", 3),
    "max_grad_norm": _float_env("TRAINING_MAX_GRAD_NORM", 1.0),
}


def runtime_configuration_issues() -> List[str]:
    """Return unsafe runtime combinations that block readiness and startup."""

    issues: List[str] = []
    mode = str(SECURITY_CONFIG.get("mode") or "local").lower()
    host = str(WEB_CONFIG.get("host") or "")
    try:
        is_loopback = ipaddress.ip_address(host).is_loopback
    except ValueError:
        is_loopback = host.lower() == "localhost"
    if mode == "local" and not is_loopback:
        issues.append("SECURITY_MODE=local 只能绑定 127.0.0.1、::1 或 localhost")
    if mode == "enforced":
        if not SECURITY_CONFIG.get("api_tokens"):
            issues.append("SECURITY_MODE=enforced 必须配置至少一个 API token")
        if WEB_CONFIG.get("debug"):
            issues.append("SECURITY_MODE=enforced 禁止启用 DEBUG")
        if "*" in set(WEB_CONFIG.get("cors_origins") or []):
            issues.append("SECURITY_MODE=enforced 禁止使用通配 CORS")
        if not SECURITY_CONFIG.get("audit_log_signing_key"):
            issues.append("SECURITY_MODE=enforced 必须配置 AUDIT_LOG_SIGNING_KEY")
    return issues


def validate_runtime_configuration() -> None:
    issues = runtime_configuration_issues()
    if issues:
        raise RuntimeError("；".join(issues))

```

### Core Architecture Module: `database/init_db.py`
```
"""
数据库初始化脚本
Database Initialization Script
"""

import pymysql
from config import MYSQL_CONFIG
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_database():
    """创建数据库"""
    try:
        # 连接MySQL服务器（不指定数据库）
        connection = pymysql.connect(
            host=MYSQL_CONFIG['host'],
            port=MYSQL_CONFIG['port'],
            user=MYSQL_CONFIG['user'],
            password=MYSQL_CONFIG['password'],
            charset=MYSQL_CONFIG['charset']
        )

        with connection.cursor() as cursor:
            # 创建数据库
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS {MYSQL_CONFIG['database']} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            logger.info(f"数据库 {MYSQL_CONFIG['database']} 创建成功")

        connection.close()

    except Exception as e:
        logger.error(f"创建数据库失败: {e}")
        raise


def create_tables():
    """创建所有必要的表"""
    try:
        connection = pymysql.connect(**MYSQL_CONFIG)

        with connection.cursor() as cursor:
            # 1. 审计项目表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_items (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    item_name VARCHAR(255) NOT NULL COMMENT '审计项目名称',
                    item_type ENUM('IT系统', '业务流程', '财务数据', '合规性', '风险控制') NOT NULL COMMENT '审计项目类型',
                    description TEXT COMMENT '项目描述',
                    risk_level ENUM('低', '中', '高', '极高') DEFAULT '中' COMMENT '风险等级',
                    status ENUM('待审计', '审计中', '已完成', '需整改') DEFAULT '待审计' COMMENT '审计状态',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                    UNIQUE KEY uniq_item_name (item_name),
                    INDEX idx_item_type (item_type),
                    INDEX idx_risk_level (risk_level),
                    INDEX idx_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计项目表'
            """)

            # 2. 审计标准表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_standards (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    standard_name VARCHAR(255) NOT NULL COMMENT '标准名称',
                    standard_type ENUM('COBIT', 'ISO27001', 'SOX', 'GDPR', '数据安全法', '网络安全法') NOT NULL COMMENT '标准类型',
                    version VARCHAR(50) COMMENT '版本号',
                    description TEXT COMMENT '标准描述',
                    requirements JSON COMMENT '具体要求（JSON格式）',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                    UNIQUE KEY uniq_standard_name (standard_name),
                    INDEX idx_standard_type (standard_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计标准表'
            """)

            # 3. 审计结果表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_results (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    audit_item_id INT NOT NULL COMMENT '审计项目ID',
                    standard_id INT NOT NULL COMMENT '标准ID',
                    compliance_score DECIMAL(5,2) COMMENT '合规性评分(0-100)',
                    risk_score DECIMAL(5,2) COMMENT '风险评分(0-100)',
                    findings TEXT COMMENT '发现的问题',
                    recommendations TEXT COMMENT '整改建议',
                    evidence_files JSON COMMENT '证据文件列表',
                    auditor_id INT COMMENT '审计员ID',
                    audit_date DATE COMMENT '审计日期',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                    FOREIGN KEY (audit_item_id) REFERENCES audit_items(id) ON DELETE CASCADE,
                    FOREIGN KEY (standard_id) REFERENCES audit_standards(id) ON DELETE CASCADE,
                    INDEX idx_audit_item (audit_item_id),
                    INDEX idx_compliance_score (compliance_score),
                    INDEX idx_risk_score (risk_score)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计结果表'
            """)

            # 4. 知识图谱实体表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_entities (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    entity_id VARCHAR(100) UNIQUE NOT NULL COMMENT '实体ID',
                    entity_name VARCHAR(255) NOT NULL COMMENT '实体名称',
                    entity_type ENUM('组织', '系统', '流程', '风险', '控制', '标准', '法规') NOT NULL COMMENT '实体类型',
                    properties JSON COMMENT '实体属性（JSON格式）',
                    description TEXT COMMENT '实体描述',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                    INDEX idx_entity_type (entity_type),
                    INDEX idx_entity_name (entity_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识图谱实体表'
            """)

            # 5. 知识图谱关系表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS knowledge_relations (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    source_entity_id VARCHAR(100) NOT NULL COMMENT '源实体ID',
                    target_entity_id VARCHAR(100) NOT NULL COMMENT '目标实体ID',
                    relation_type VARCHAR(100) NOT NULL COMMENT '关系类型',
                    properties JSON COMMENT '关系属性（JSON格式）',
                    confidence DECIMAL(5,4) DEFAULT 1.0000 COMMENT '置信度',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
                    FOREIGN KEY (source_entity_id) REFERENCES knowledge_entities(entity_id) ON DELETE CASCADE,
                    FOREIGN KEY (target_entity_id) REFERENCES knowledge_entities(entity_id) ON DELETE CASCADE,
                    INDEX idx_source_entity (source_entity_id),
                    INDEX idx_target_entity (target_entity_id),
                    INDEX idx_relation_type (relation_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识图谱关系表'
            """)

            # 6. 训练数据表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS training_data (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    data_type ENUM('SFT', 'RLHF', 'EVALUATION') NOT NULL COMMENT '数据类型',
                    input_text TEXT NOT NULL COMMENT '输入文本',
                    output_text TEXT COMMENT '输出文本',
                    label_score DECIMAL(5,2) COMMENT '标签评分',
                    metadata JSON COMMENT '元数据',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    INDEX idx_data_type (data_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='训练数据表'
            """)

            # 7. 模型评估结果表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS model_evaluations (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    model_name VARCHAR(255) NOT NULL COMMENT '模型名称',
                    evaluation_type ENUM('BENCHMARK', 'CUSTOM', 'ABLATION') NOT NULL COMMENT '评估类型',
                    metrics JSON NOT NULL COMMENT '评估指标（JSON格式）',
                    test_data_size INT COMMENT '测试数据大小',
                    evaluation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '评估时间',
                    notes TEXT COMMENT '备注',
                    INDEX idx_model_name (model_name),
                    INDEX idx_evaluation_type (evaluation_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='模型评估结果表'
            """)

            # 8. 审计对话记录表
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_conversations (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    session_id VARCHAR(100) NOT NULL COMMENT '会话ID',
                    user_input TEXT NOT NULL COMMENT '用户输入',
                    agent_response TEXT NOT NULL COMMENT 'Agent响应',
                    context JSON COMMENT '上下文信息',
                    confidence DECIMAL(5,4) COMMENT '置信度',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                    INDEX idx_session_id (session_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审计对话记录表'
            """)

            connection.commit()
            logger.info("所有表创建成功")

        connection.close()

    except Exception as e:
        logger.error(f"创建表失败: {e}")
        raise


def insert_initial_data():
    """插入初始数据"""
    try:
        connection = pymysql.connect(**MYSQL_CONFIG)

        with connection.cursor() as cursor:
            # 插入审计标准数据
            standards_data = [
                ('COBIT 2019', 'COBIT', '2019', 'COBIT 2019框架为IT治理和管理提供全面的指导',
                 '{"domains": ["治理", "管理"], "processes": 40, "principles": 5}'),
                ('ISO/IEC 27001:2022', 'ISO27001', '2022', '信息安全管理体系国际标准',
                 '{"controls": 93, "categories": 4, "annexes": 14}'),
                ('SOX法案', 'SOX', '2002', '萨班斯-奥克斯利法案，规范上市公司财务报告',
                 '{"sections": 11, "requirements": ["内部控制", "财务报告", "审计委员会"]}'),
                ('数据安全法', '数据安全法', '2021', '中华人民共和国数据安全法',
                 '{"chapters": 7, "articles": 55, "focus": ["数据分类", "数据保
```

### Core Architecture Module: `knowledge_graph/neo4j_init.py`
```
"""
Neo4j知识图谱初始化脚本
Neo4j Knowledge Graph Initialization Script
"""

from neo4j import GraphDatabase
from config import NEO4J_CONFIG
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Neo4jManager:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            NEO4J_CONFIG['uri'],
            auth=(NEO4J_CONFIG['user'], NEO4J_CONFIG['password'])
        )

    def close(self):
        self.driver.close()

    def create_constraints(self):
        """创建约束和索引"""
        with self.driver.session() as session:
            # 创建唯一性约束
            constraints = [
                "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE",
                "CREATE CONSTRAINT standard_id_unique IF NOT EXISTS FOR (s:Standard) REQUIRE s.id IS UNIQUE",
                "CREATE CONSTRAINT process_id_unique IF NOT EXISTS FOR (p:Process) REQUIRE p.id IS UNIQUE",
                "CREATE CONSTRAINT risk_id_unique IF NOT EXISTS FOR (r:Risk) REQUIRE r.id IS UNIQUE",
                "CREATE CONSTRAINT control_id_unique IF NOT EXISTS FOR (c:Control) REQUIRE c.id IS UNIQUE"
            ]

            for constraint in constraints:
                try:
                    session.run(constraint)
                    logger.info(f"约束创建成功: {constraint}")
                except Exception as e:
                    logger.warning(f"约束创建失败（可能已存在）: {e}")

    def create_indexes(self):
        """创建索引"""
        with self.driver.session() as session:
            indexes = [
                "CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)",
                "CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type)",
                "CREATE INDEX standard_name_index IF NOT EXISTS FOR (s:Standard) ON (s.name)",
                "CREATE INDEX process_name_index IF NOT EXISTS FOR (p:Process) ON (p.name)",
                "CREATE INDEX risk_level_index IF NOT EXISTS FOR (r:Risk) ON (r.level)"
            ]

            for index in indexes:
                try:
                    session.run(index)
                    logger.info(f"索引创建成功: {index}")
                except Exception as e:
                    logger.warning(f"索引创建失败（可能已存在）: {e}")

    def create_initial_nodes(self):
        """创建初始节点"""
        with self.driver.session() as session:
            # 创建审计标准节点
            standards = [
                {
                    'id': 'cobit_2019',
                    'name': 'COBIT 2019',
                    'type': 'COBIT',
                    'version': '2019',
                    'description': 'COBIT 2019框架为IT治理和管理提供全面的指导',
                    'domains': ['治理', '管理'],
                    'processes': 40,
                    'principles': 5
                },
                {
                    'id': 'iso27001_2022',
                    'name': 'ISO/IEC 27001:2022',
                    'type': 'ISO27001',
                    'version': '2022',
                    'description': '信息安全管理体系国际标准',
                    'controls': 93,
                    'categories': 4,
                    'annexes': 14
                },
                {
                    'id': 'sox_2002',
                    'name': 'SOX法案',
                    'type': 'SOX',
                    'version': '2002',
                    'description': '萨班斯-奥克斯利法案，规范上市公司财务报告',
                    'sections': 11,
                    'requirements': ['内部控制', '财务报告', '审计委员会']
                },
                {
                    'id': 'data_security_law',
                    'name': '数据安全法',
                    'type': '数据安全法',
                    'version': '2021',
                    'description': '中华人民共和国数据安全法',
                    'chapters': 7,
                    'articles': 55,
                    'focus': ['数据分类', '数据保护', '数据跨境']
                },
                {
                    'id': 'cybersecurity_law',
                    'name': '网络安全法',
                    'type': '网络安全法',
                    'version': '2017',
                    'description': '中华人民共和国网络安全法',
                    'chapters': 7,
                    'articles': 79,
                    'focus': ['网络运行安全', '网络信息安全', '监测预警']
                }
            ]

            for standard in standards:
                # 为每个标准分别处理，只设置存在的字段
                query = """
                    MERGE (s:Standard {id: $id})
                    SET s.name = $name,
                        s.type = $type,
                        s.version = $version,
                        s.description = $description
                """

                # 添加可选字段
                if 'domains' in standard:
                    query += ", s.domains = $domains"
                if 'processes' in standard:
                    query += ", s.processes = $processes"
                if 'principles' in standard:
                    query += ", s.principles = $principles"
                if 'controls' in standard:
                    query += ", s.controls = $controls"
                if 'categories' in standard:
                    query += ", s.categories = $categories"
                if 'annexes' in standard:
                    query += ", s.annexes = $annexes"
                if 'sections' in standard:
                    query += ", s.sections = $sections"
                if 'requirements' in standard:
                    query += ", s.requirements = $requirements"
                if 'chapters' in standard:
                    query += ", s.chapters = $chapters"
                if 'articles' in standard:
                    query += ", s.articles = $articles"
                if 'focus' in standard:
                    query += ", s.focus = $focus"

                session.run(query, **standard)

            # 创建业务流程节点
            processes = [
                {
                    'id': 'proc_001',
                    'name': '用户权限管理',
                    'description': '管理用户账户的创建、修改、删除和权限分配',
                    'risk_level': '中',
                    'category': 'IT管理'
                },
                {
                    'id': 'proc_002',
                    'name': '财务报告流程',
                    'description': '财务数据的收集、处理、审核和报告生成',
                    'risk_level': '高',
                    'category': '财务管理'
                },
                {
                    'id': 'proc_003',
                    'name': '数据备份与恢复',
                    'description': '定期备份重要数据并建立恢复机制',
                    'risk_level': '中',
                    'category': 'IT运维'
                },
                {
                    'id': 'proc_004',
                    'name': '变更管理',
                    'description': 'IT系统和应用程序的变更控制流程',
                    'risk_level': '高',
                    'category': 'IT管理'
                },
                {
                    'id': 'proc_005',
                    'name': '事件响应',
                    'description': '安全事件的检测、分析和响应流程',
                    'risk_level': '高',
                    'category': '安全管理'
                }
            ]

            for process in processes:
                session.run("""
                    MERGE (p:Process {id: $id})
                    SET p.name = $name,
                        p.description = $description,
                        p.risk_level = $risk_level,
                        p.category = $category
                """, **process)

            # 创建风险节点
            risks = [
                {
                    'id': 'risk_001',
                    'name': '数据泄露风险',
                    'description': '敏感数据被未授权访问或泄露的风险',
                    'level': '高',
                    'category': '信息安全'
                },
                {
                    'id': 'risk_002',
                    'name': '系统可用性风险',
                    'description': '关键系统不可用导致业务中断的风险',
                    'level': '高',
                    'category': '运营风险'
                },
                {
                    'id': 'risk_003',
                    'name': '合规性风险',
                    'description': '违反相关法律法规和行业标准的风险',
                    'level': '中',
                    'category': '合规风险'
                },
                {
                    'id': 'risk_004',
                    'name': '财务报告风险',
                    'description': '财务报告不准确或存在重大错报的风险',
                    'level': '高',
                    'category': '财务风险'
                },
                {
                    'id': 'risk_005',
                    'name': '第三方风险',
                    'description': '第三方供应商或合作伙伴带来的风险',
                    'level': '中',
                    'category': '供应链风险'
                }
            ]

            for risk in risks:
                session.run("""
                    MERGE (r:Risk {id: $id})
                    SET r.name = $name,
                        r.description = $description,
                        r.level = $level,
                        r.category = $category
                """, **risk)

            # 创建控制措施节点
            controls = [
                {
                    'id': 'ctrl_001',
                    'name': '访问控制',
                    'description': '通过身份认证和授权机制控制用户访问',
                    'type': '预防性控制',
                    'effectiveness': '高'
                },
                {
                    'id': 'ctrl_002',
                    'name': '数据加密',
                    'description': '对敏感数据进行加密保护',
                    'type': '预防性控制',
                    'effectiveness': '高'
                },
                {
                    'id': 'ctrl_003',
                    'name': '审计日志',
                    'description': '记录系统操作和用户行为日志',
                    'type': '检测性控制',
                    'effectiveness': '中'
                },
                {
                    'id': 'ctrl_004',
                    'name': '备份恢复',
                    'description': '定期备份数据并建立恢复机制',
                    'type': '纠正性控制',
              
```

### Core Architecture Module: `rag/agentic_rag.py`
```
"""Agentic RAG implementation for audit knowledge."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from config import LLM_CONFIG, RAG_CONFIG
from services.llm_client import LLMClient
from services.security import current_principal, current_tenant_id

TfidfVectorizer = None
cosine_similarity = None

logger = logging.getLogger(__name__)


AUDIT_QUERY_SYNONYMS: Dict[str, List[str]] = {
    "权限": ["访问控制", "账号授权", "职责分离", "最小权限", "privileged access", "access review"],
    "访问": ["身份认证", "授权审批", "定期复核", "用户生命周期"],
    "备份": ["恢复演练", "灾备", "RPO", "RTO", "data recovery"],
    "日志": ["审计轨迹", "操作留痕", "监控告警", "audit log"],
    "财务": ["财务报告", "凭证", "SOX", "内部控制", "ITGC"],
    "数据": ["数据分类分级", "敏感数据", "加密", "脱敏", "personal information"],
    "变更": ["上线审批", "回退方案", "测试验证", "change management"],
    "合规": ["控制要求", "法规", "标准", "审计证据", "compliance"],
    "Agent": ["tool calling", "planning", "memory", "RAG", "evaluation", "MCP", "Skill"],
    "RAG": ["retrieval", "citation", "faithfulness", "answer relevance", "检索增强"],
}


BUILTIN_KNOWLEDGE = [
    {
        "source": "builtin:COBIT2019",
        "text": "COBIT 2019 关注企业 IT 治理和管理目标，强调价值交付、风险优化、资源优化、绩效度量和责任分工。审计时应将业务目标映射到治理目标，并检查流程责任、关键控制、指标和证据。",
        "type": "standard",
    },
    {
        "source": "builtin:ISO27001",
        "text": "ISO/IEC 27001 要求组织建立信息安全管理体系，围绕风险评估、控制选择、运行监控和持续改进形成闭环。常见审计证据包括资产清单、访问权限复核、风险处置计划、事件记录和管理评审。",
        "type": "standard",
    },
    {
        "source": "builtin:SOX",
        "text": "SOX 审计重点关注财务报告相关内部控制，包括职责分离、变更管理、访问控制、日志留存、接口对账和管理层复核。审计结论需要能追溯到抽样、审批和复核证据。",
        "type": "standard",
    },
    {
        "source": "builtin:DataSecurity",
        "text": "数据安全审计应检查数据分类分级、敏感数据访问授权、传输和存储加密、脱敏处理、共享审批、日志审计和应急处置机制，确保数据处理活动有制度、有记录、可追溯。",
        "type": "standard",
    },
]


@dataclass
class Document:
    page_content: str
    metadata: Dict[str, Any]


@dataclass
class StoredChunk:
    id: str
    content: str
    metadata: Dict[str, Any]


def _looks_corrupt(text: Any) -> bool:
    value = str(text or "")
    if "?" * 3 in value:
        return True
    return any(mark in value for mark in ["\u93c1", "\u7487", "\u20ac", "\ufffd", "\u6d93", "\u6942", "\u6d63"])


class DocumentProcessor:
    def __init__(self, chunk_size: int = RAG_CONFIG["chunk_size"], chunk_overlap: int = RAG_CONFIG["chunk_overlap"]) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = min(chunk_overlap, max(0, chunk_size // 2))

    def process_text(self, text: str, metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
        metadata = dict(metadata or {})
        metadata.setdefault("source", "manual")
        metadata.setdefault("tenant_id", current_tenant_id())
        metadata["processed_at"] = datetime.now().isoformat()
        return [
            Document(page_content=chunk, metadata={**metadata, "chunk_id": index, "chunk_size": len(chunk)})
            for index, chunk in enumerate(self._split_text(text))
        ]

    def process_file(self, file_path: str) -> List[Document]:
        path = Path(file_path)
        content = path.read_text(encoding="utf-8", errors="ignore")
        return self.process_text(
            content,
            {
                "source": f"upload:{path.name}",
                "file_name": path.name,
                "file_type": path.suffix.lower(),
                "file_size": path.stat().st_size,
            },
        )

    def _split_text(self, text: str) -> List[str]:
        text = re.sub(r"\r\n?", "\n", text).strip()
        if not text:
            return []
        paragraphs = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
        chunks: List[str] = []
        current = ""
        for paragraph in paragraphs:
            if len(current) + len(paragraph) + 2 <= self.chunk_size:
                current = f"{current}\n\n{paragraph}".strip()
                continue
            if current:
                chunks.append(current)
            if len(paragraph) <= self.chunk_size:
                current = paragraph
            else:
                chunks.extend(self._window_split(paragraph))
                current = ""
        if current:
            chunks.append(current)
        return chunks

    def _window_split(self, text: str) -> List[str]:
        chunks = []
        step = max(1, self.chunk_size - self.chunk_overlap)
        for start in range(0, len(text), step):
            chunk = text[start : start + self.chunk_size].strip()
            if chunk:
                chunks.append(chunk)
        return chunks


class PersistentDocumentStore:
    def __init__(self, store_file: Path = RAG_CONFIG["store_file"]) -> None:
        self.store_file = store_file
        self.store_file.parent.mkdir(parents=True, exist_ok=True)
        self.chunks: List[StoredChunk] = []
        self.load()
        self._ensure_seed_knowledge()

    def load(self) -> None:
        if not self.store_file.exists():
            self.chunks = []
            return
        try:
            payload = json.loads(self.store_file.read_text(encoding="utf-8"))
            self.chunks = [StoredChunk(**item) for item in payload.get("chunks", [])]
        except Exception as exc:
            logger.warning("Failed to load RAG store, starting empty: %s", exc)
            self.chunks = []

    def persist(self) -> None:
        payload = {"chunks": [asdict(chunk) for chunk in self.chunks], "updated_at": datetime.now().isoformat()}
        self.store_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def add_documents(self, documents: Iterable[Document], persist: bool = True) -> int:
        existing_ids = {chunk.id for chunk in self.chunks}
        added = 0
        for document in documents:
            chunk_id = self._document_id(document)
            if chunk_id in existing_ids:
                continue
            metadata = dict(document.metadata or {})
            metadata.setdefault("source", "manual")
            self.chunks.append(StoredChunk(id=chunk_id, content=document.page_content, metadata=metadata))
            existing_ids.add(chunk_id)
            added += 1
        if added and persist:
            self.persist()
        return added

    def _ensure_seed_knowledge(self) -> None:
        builtin_sources = {item["source"] for item in BUILTIN_KNOWLEDGE}
        before = len(self.chunks)
        self.chunks = [
            chunk
            for chunk in self.chunks
            if not (chunk.metadata.get("source") in builtin_sources and _looks_corrupt(chunk.content))
        ]
        seed_items = list(BUILTIN_KNOWLEDGE)
        seed_dir = self.store_file.parents[1] / "seed_knowledge"
        for path in sorted(seed_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("Failed to load seed knowledge %s: %s", path, exc)
                continue
            if isinstance(payload, list):
                seed_items.extend(item for item in payload if isinstance(item, dict))

        documents = []
        for item in seed_items:
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            documents.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": item.get("source", "seed"),
                        "type": item.get("type", "seed"),
                        "title": item.get("title", ""),
                        "tenant_id": "*",
                        "visibility": "public_seed",
                        "authority_level": item.get("authority_level", "reference"),
                        "seed": True,
                    },
                )
            )
        added = self.add_documents(documents, persist=False)
        if added or len(self.chunks) != before:
            self.persist()

    def _document_id(self, document: Document) -> str:
        metadata = document.metadata or {}
        identity = {
            "tenant_id": metadata.get("tenant_id") or current_tenant_id(),
            "project_id": metadata.get("project_id") or "",
            "source": metadata.get("source") or "manual",
            "document_version": metadata.get("document_version") or metadata.get("version") or "1",
            "page": metadata.get("page"),
            "section": metadata.get("section"),
            "chunk_id": metadata.get("chunk_id"),
            "content": document.page_content,
        }
        raw = json.dumps(identity, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()[:24]


class HybridRetriever:
    def __init__(self, store: PersistentDocumentStore) -> None:
        self.store = store
        self.embedding_model = self._load_embedding_model()
        self.embedding_matrix = None
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None
        self.rebuild()

    def _load_embedding_model(self) -> Any:
        if not RAG_CONFIG.get("enable_embeddings"):
            logger.info("Embedding model disabled; TF-IDF + keyword hybrid retrieval enabled")
            return None
        model_name = str(RAG_CONFIG["embedding_model"])
        if "\\" in model_name or "/" in model_name:
            path = Path(model_name)
            if not path.exists():
                logger.info("Local embedding model not found: %s", path)
                return None
        try:
            from sentence_transformers import SentenceTransformer

            return SentenceTransformer(model_name)
        except Exception as exc:
            logger.info("Embedding model unavailable, fallback retrieval enabled: %s", exc)
            return None


```

### Core Architecture Module: `scripts/audit_repro.py`
```
"""Audit repro probes for AuditPilot findings.

Run from the project root with the venv interpreter:

    & "$env:TEMP\auditpilot_venv\Scripts\python.exe" scripts/audit_repro.py

Each probe asserts a contract that the README / docs promise and verifies
that the current implementation honors it. When the contract is broken the
probe prints FAIL and the script exits with a non-zero status.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from agents.audit_agent import AuditAgent, RISK_KEYWORDS  # noqa: E402
from services.agent_runtime import AgentRuntime  # noqa: E402
from services.evaluation_repository import EvaluationRunRepository  # noqa: E402
from services.skill_registry import SkillRegistry  # noqa: E402
from services.safety_gate import SafetyGate  # noqa: E402


SEPARATOR = "=" * 72
_RESULTS: list[tuple[str, bool, str]] = []


def banner(title: str) -> None:
    print(SEPARATOR)
    print(title)
    print(SEPARATOR)


def expect(condition: bool, message: str, detail: str = "") -> None:
    status = "OK" if condition else "FAIL"
    print(f"  [{status}] {message}")
    if detail:
        print(f"         {detail}")
    _RESULTS.append((message, condition, detail))


def probe_p0_1_dead_code() -> None:
    """AuditAgent._compose_response must surface the executive summary
    AND the structured risk/remediation tables."""
    banner("P0-1  compose_response surfaces the full summary + tables")
    agent = AuditAgent(enable_llm=False, enable_external_tools=False)
    result = agent.process_audit_query("请对 ERP 系统进行权限审计", prefer_llm=False)
    response = result.get("response", "")
    expect("审计对象" in response, "审计对象 字段应出现在摘要",
           f"response starts with: {response[:80]!r}")
    expect("优先动作" in response, "应包含 ‘优先动作’ 字段",
           "missing '优先动作' segment; reported bug: dead code after return")
    expect("高风险控制缺陷" in response, "应包含高风险控制缺陷表",
           "tables dropped from deterministic response")
    expect("整改动作计划" in response, "应包含整改动作计划表",
           "tables dropped from deterministic response")


def probe_p0_6_redact_overreach() -> None:
    """SkillRegistry._redact should not treat 'sk-001' as a credential,
    but should still redact real OpenAI keys and Bearer tokens."""
    banner("P0-6  redact is precise about credentials")
    with tempfile.TemporaryDirectory() as tmp:
        registry = SkillRegistry()
        registry.log_file = Path(tmp) / "runs.jsonl"
        redacted = registry._redact(
            {
                "criteria": "设备编号 sk-001",
                "note": "Bearer token should still be redacted",
                "real_key": "sk-" + ("A" * 24),
                "sk_artifact": "sk-001",
            }
        )
        expect(redacted["criteria"] == "设备编号 sk-001",
               "非凭据字符串 sk-001 不应被 [REDACTED]",
               f"actual: {redacted['criteria']!r}")
        expect(redacted["real_key"] == "[REDACTED]",
               "真实凭据仍应被 [REDACTED]",
               f"actual: {redacted['real_key']!r}")
        expect(redacted["note"] == "Bearer token should still be redacted",
               "Bearer 字样不应导致整段被脱敏",
               f"actual: {redacted['note']!r}")
        expect(redacted["sk_artifact"] == "sk-001",
               "短前缀 'sk-001' 是业务编号不是凭据",
               f"actual: {redacted['sk_artifact']!r}")


def probe_p0_8_baseline_meaning() -> None:
    """EvaluationRunRepository should support a locked baseline distinct
    from 'previous run'."""
    banner("P0-8  baseline supports a locked reference run")
    with tempfile.TemporaryDirectory() as tmp:
        repo = EvaluationRunRepository(Path(tmp) / "evals")
        first = repo.create_run(
            "task_component",
            {},
            {
                "summary": {
                    "overall_score": 0.90,
                    "total_tests": 6,
                    "pass_rate": 0.95,
                    "critical_failures": [],
                }
            },
        )
        second = repo.create_run(
            "task_component",
            {},
            {
                "summary": {
                    "overall_score": 0.78,
                    "total_tests": 6,
                    "pass_rate": 0.78,
                    "critical_failures": [],
                }
            },
        )
        expect(
            (second.get("comparison") or {}).get("baseline_run_id") == first["run_id"],
            "首次 baseline_created 时不能回环到自身",
            f"baseline_run_id: {(second.get('comparison') or {}).get('baseline_run_id')}",
        )
        repo.mark_as_baseline(first["run_id"])
        third = repo.create_run(
            "task_component",
            {},
            {
                "summary": {
                    "overall_score": 0.86,
                    "total_tests": 6,
                    "pass_rate": 0.90,
                    "critical_failures": [],
                }
            },
        )
        expect(
            (third.get("comparison") or {}).get("baseline_locked") is True,
            "锁定基线应被识别为 locked",
            f"baseline_locked: {(third.get('comparison') or {}).get('baseline_locked')}",
        )
        expect(
            (third.get("comparison") or {}).get("baseline_run_id") == first["run_id"],
            "锁定基线应覆盖 'previous run' 决策",
            f"baseline_run_id: {(third.get('comparison') or {}).get('baseline_run_id')}",
        )


def probe_p0_9_integrity_digest_self_reference() -> None:
    """episode_package integrity digest should be a stable hash of the
    canonical payload without the integrity field itself."""
    banner("P0-9  integrity digest is self-consistent")
    with tempfile.TemporaryDirectory() as tmp:
        registry = SkillRegistry()
        registry.log_file = Path(tmp) / "runs.jsonl"
        runtime = AgentRuntime(registry, SafetyGate())
        runtime.runtime_dir = Path(tmp) / "runtime"
        runtime.runtime_dir.mkdir()
        task = runtime.create_task("生成 ERP 权限审计计划", {"audit_item": "ERP 权限"})
        episode = runtime.episode_package(task["task_id"])
        integrity = episode.get("integrity", {})
        digest = integrity.get("digest")
        algorithm = integrity.get("algorithm")
        cleaned = {key: value for key, value in episode.items() if key != "integrity"}
        canonical = json.dumps(cleaned, ensure_ascii=False, sort_keys=True, default=str)
        expected_digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        expect(
            isinstance(digest, str) and len(digest) == 64,
            "digest is a sha256 hex string",
            f"algorithm={algorithm!r}, len={len(digest) if isinstance(digest, str) else 'n/a'}",
        )
        expect(
            digest == expected_digest,
            "digest 等于基于去掉 integrity 字段的稳定散列",
            f"plain digest: {digest!r}; expected: {expected_digest!r}",
        )


def probe_p1_3_risk_columns_meaningful() -> None:
    """Deterministic response renders 'impact/likelihood/control_gap'
    with non-placeholder content."""
    banner("P1-3  risk table columns are populated")
    agent = AuditAgent(enable_llm=False, enable_external_tools=False)
    result = agent.process_audit_query("请对 ERP 权限管理进行审计", prefer_llm=False)
    response = result.get("response", "")
    expect(
        RISK_KEYWORDS and all("score" in entry and "risk" in entry for entry in RISK_KEYWORDS.values()),
        "RISK_KEYWORDS schema 已包含 score/risk/domain",
        f"keys={list(next(iter(RISK_KEYWORDS.values())).keys())}",
    )
    expect(
        "影响" in response and "可能性" in response and "控制缺口" in response,
        "风险表格应包含影响/可能性/控制缺口三维",
        "schema/模板尚未填充这些字段",
    )
    risk_assessment = result.get("risk_assessment", {})
    identified = risk_assessment.get("identified_risks", [])
    expect(
        bool(identified) and all(
            isinstance(item.get("impact"), str) and "-" not in item.get("impact", "")
            for item in identified
        ),
        "identified_risks 每个条目都应包含 impact 文案",
        f"first item: {identified[0] if identified else 'n/a'}",
    )


def probe_p3_3_database_seed_duplication() -> None:
    """database/init_db.py should be idempotent across reruns."""
    banner("P3-3  database/init_db idempotent seeds")
    init_path = PROJECT_ROOT / "database" / "init_db.py"
    text = init_path.read_text(encoding="utf-8")
    executemany_block = "INSERT INTO audit_standards"
    expect(
        "INSERT IGNORE" in text,
        "INSERT IGNORE 已加入种子插入",
        "重复执行 init_db 会持续向 audit_standards 插入 5 条种子",
    )
    expect(
        "UNIQUE KEY" in text and "uniq_standard_name" in text,
        "audit_standards 已设置 uniq_standard_name 唯一键",
        "缺少唯一键会导致 INSERT IGNORE 在历史脏数据上失效",
    )
    expect(
        executemany_block not in text or "INSERT IGNORE INTO audit_standards" in text,
        "审计标准 stats 写入不再是 INSERT ... VALUES",
        "executor must use INSERT IGNORE for audit_standards",
    )


def main() -> int:
    os.environ.setdefault("AUDIT_DISABLE_LLM", "1")
    os.environ.setdefault("RAG_DISABLE_LLM", "1")
    os.environ.setdefault("RAG_DISABLE_EMBEDDINGS", "1")
    os.environ.setdefault("RAG_LIGHT_MODE", "0")

    probe_p0_1_dead_code()
    probe_p0_6_redact_overreach()
    probe_p0_8_baseline_meaning()
    probe_p0_9_integrity_digest_self_reference()
    probe_p1_3_risk_columns_meaningful()
    probe_p3_3_database_seed_duplication()

    print(SEPARATOR)
    total = len(_RESULTS)
    failed = sum(1 for _, ok, _ in _RESULTS if not ok)
    print(f"summary: {total - failed}/{total} assertions passed")
    if failed:
        print("failed probes:")
        for message, ok, detail in _RESULTS:
            if not ok:
                print(f"  - {message}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `services/agent_quality.py`
```
"""Trace-driven Agent quality diagnostics for production delivery.

The service turns runtime, retrieval, tool, memory and release requirements
into executable diagnostics. It reads persisted runtime state rather than
returning static capability claims.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from services.agent_runtime import AgentRuntime
from services.conversation_memory import ConversationMemory
from services.evaluation_repository import EvaluationRunRepository
from services.harness_control import HarnessControlPlane
from services.skill_registry import SkillRegistry


@dataclass(frozen=True)
class QualityDimension:
    dimension_id: str
    name: str
    interview_signal: str
    design_answer: str


DIMENSIONS = [
    QualityDimension(
        "agent_runtime",
        "Agent 架构与长任务执行",
        "确认系统具备可回放的规划、执行、反思与失败恢复链路，而不是一次性文本生成。",
        "采用轻量 Plan/Execute/Reflect Runtime，而不是把业务逻辑藏在框架里；生产可迁移 LangGraph/Temporal。",
    ),
    QualityDimension(
        "rag_grounding",
        "RAG 召回、错召/漏召与幻觉控制",
        "确认切块、混合检索、重排和证据不足降级均有可验证记录。",
        "审计场景需要标准编号和控制 ID 精确匹配，因此采用混合检索、来源置信度、质量门和补证任务。",
    ),
    QualityDimension(
        "tool_mcp",
        "Tool Use / MCP / Skill 治理",
        "确认工具 Schema、权限、缓存、熔断与调用日志满足受控执行要求。",
        "SkillRegistry 把工具升级为治理单元，包含 Schema、权限、TTL、熔断、日志和 MCP-style 描述。",
    ),
    QualityDimension(
        "evaluation_harness",
        "评测、发布门禁与自进化 Harness",
        "确认效果能够被量化，变更不会绕过回归门禁，badcase 能持续沉淀。",
        "锁定评测器与可编辑面分离，候选必须通过 Held-in/Held-out 双集门禁和人工审批，拒绝样例保留且不会自动上线。",
    ),
    QualityDimension(
        "memory_context",
        "Memory 与上下文压缩",
        "确认短期与长期记忆分层、上下文压缩、污染防护和删除策略边界清晰。",
        "记忆分为 Working、Episodic、Profile、Related，分别处理顺序、摘要、画像和相关历史召回。",
    ),
    QualityDimension(
        "production_engineering",
        "生产化工程质量",
        "确认持久化、异步任务、性能、日志与降级机制具备可迁移的生产边界。",
        "当前保持本地可运行和透明持久化，生产可替换为数据库、对象存储、任务队列、Redis 与日志检索。",
    ),
]


class AgentQualityDiagnostics:
    """Build one executable quality report for release-critical areas."""

    def __init__(
        self,
        evaluation_repository: EvaluationRunRepository,
        agent_runtime: AgentRuntime,
        skill_registry: SkillRegistry,
        conversation_memory: ConversationMemory,
        harness_control: Optional[HarnessControlPlane] = None,
    ) -> None:
        self.evaluation_repository = evaluation_repository
        self.agent_runtime = agent_runtime
        self.skill_registry = skill_registry
        self.conversation_memory = conversation_memory
        self.harness_control = harness_control

    def report(self, rag_stats: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        observability = self.agent_runtime.observability()
        skill_metrics = self.skill_registry.metrics()
        memory_stats = self.conversation_memory.stats()
        eval_runs = self.evaluation_repository.list_runs(limit=50)
        rag_stats = rag_stats or {"total_documents": 0}

        dimensions = [
            self._agent_runtime_dimension(observability),
            self._rag_dimension(eval_runs, rag_stats),
            self._tool_dimension(skill_metrics),
            self._evaluation_dimension(eval_runs, self.harness_control.summary() if self.harness_control else None),
            self._memory_dimension(memory_stats),
            self._production_dimension(observability, skill_metrics, eval_runs, rag_stats),
        ]
        overall_score = round(sum(item["score"] for item in dimensions) / max(len(dimensions), 1), 1)

        return {
            "overall_score": overall_score,
            "readiness_label": self._label(overall_score),
            "dimensions": dimensions,
            "badcase_diagnostics": self._badcases(eval_runs, observability, skill_metrics),
            "tool_use_diagnostics": self._tool_use(skill_metrics),
            "rag_diagnostics": self._rag_diagnostics(eval_runs, rag_stats),
            "production_readiness": self._production_readiness(observability, skill_metrics, memory_stats, rag_stats),
            "interview_pitch": self._pitch(dimensions),
        }

    def _agent_runtime_dimension(self, observability: Dict[str, Any]) -> Dict[str, Any]:
        task_count = int(observability.get("tasks") or 0)
        tool_calls = int(observability.get("tool_calls") or 0)
        reflections = int(observability.get("reflections") or 0)
        score = 45 + min(task_count, 10) * 3 + min(tool_calls, 20) * 1.2 + min(reflections, 20) * 1.1
        gaps = []
        if task_count == 0:
            gaps.append("缺少可回放的 Agent Runtime 任务，无法验证多步骤执行链路。")
        if reflections == 0:
            gaps.append("缺少反思记录，建议运行任务或制造失败样例验证恢复链路。")
        return self._dimension(
            "agent_runtime",
            score,
            [
                f"任务数 {task_count}",
                f"工具调用 {tool_calls}",
                f"反思记录 {reflections}",
                f"P95 延迟 {observability.get('p95_latency_ms', 0)}ms",
            ],
            gaps,
            ["演示 /skills 里的任务计划、步骤、工具调用和反思。", "准备说明生产可迁移 LangGraph/Temporal。"],
        )

    def _rag_dimension(self, eval_runs: List[Dict[str, Any]], rag_stats: Dict[str, Any]) -> Dict[str, Any]:
        doc_count = int(rag_stats.get("total_documents") or rag_stats.get("total_chunks") or 0)
        latest_rag = next((run for run in eval_runs if run.get("run_type") == "rag"), None)
        score = 40 + min(doc_count, 20) * 1.5
        evidence = [f"RAG 文档/切片 {doc_count}"]
        gaps = []
        if latest_rag:
            metrics = latest_rag.get("metrics", {})
            score += float(metrics.get("overall_score") or 0) * 35
            evidence.append(f"最近 RAG 评测 {latest_rag.get('run_id')}，得分 {metrics.get('overall_score', 0)}")
            gate = latest_rag.get("release_gate", {})
            evidence.append(f"发布门禁 {gate.get('label') or gate.get('status')}")
            if gate.get("blockers"):
                gaps.extend(gate.get("blockers", []))
        else:
            gaps.append("缺少最近 RAG 评测，无法量化错召与漏召处理效果。")
        if doc_count == 0:
            gaps.append("知识库为空，RAG 只能讲设计，不能现场证明召回。")
        return self._dimension(
            "rag_grounding",
            score,
            evidence,
            gaps,
            ["补充 golden set 并运行 /api/evaluation/rag。", "为高频审计标准补充控制编号和证据样本。"],
        )

    def _tool_dimension(self, skill_metrics: Dict[str, Any]) -> Dict[str, Any]:
        total_runs = int(skill_metrics.get("total_runs") or 0)
        success_rate = float(skill_metrics.get("success_rate") or 0)
        open_circuits = int(skill_metrics.get("open_circuits") or 0)
        score = 45 + success_rate * 35 + min(total_runs, 30) * 0.7 - open_circuits * 8
        gaps = []
        if total_runs == 0:
            gaps.append("缺少工具运行日志，建议现场触发 RAG/报告/控制映射等 Skill。")
        if success_rate < 0.9 and total_runs:
            gaps.append("工具成功率低于 90%，需要定位失败 Skill。")
        if open_circuits:
            gaps.append("存在打开的熔断器，说明工具可靠性需要恢复。")
        evidence = [
            f"Skill 运行 {total_runs}",
            f"成功率 {round(success_rate * 100)}%",
            f"缓存命中 {skill_metrics.get('cache_hits', 0)}",
            f"打开熔断 {open_circuits}",
        ]
        return self._dimension(
            "tool_mcp",
            score,
            evidence,
            gaps,
            ["演示 /api/mcp/tools 的 inputSchema 与权限声明。", "解释 TTL 缓存和熔断如何降低延迟与故障放大。"],
        )

    def _evaluation_dimension(
        self,
        eval_runs: List[Dict[str, Any]],
        harness: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        run_count = len(eval_runs)
        blocked = [run for run in eval_runs if (run.get("release_gate") or {}).get("status") == "blocked"]
        review = [run for run in eval_runs if (run.get("release_gate") or {}).get("status") == "review"]
        surfaces = (harness or {}).get("surfaces") or {}
        policy = surfaces.get("policy") or {}
        locked_count = len(surfaces.get("locked") or [])
        harness_ready = bool(harness and locked_count and policy.get("automatic_promotion") is False)
        score = 42 + min(run_count, 20) * 1.5 - min(len(blocked), 5) * 3 - min(len(review), 5)
        if harness_ready:
            score += 26
        gaps = []
        if run_count == 0:
            gaps.append("缺少评测历史，无法验证效果和回归控制。")
        if blocked:
            gaps.append(f"存在 {len(blocked)} 个 blocked release gate，需要优先处理。")
        if not harness_ready:
            gaps.append("缺少独立 Harness 控制面或人工推广边界。")
        evidence = [
            f"评测记录 {run_count}",
            f"review 门禁 {len(review)}",
            f"blocked 门禁 {len(blocked)}",
        ]
        if harness_ready:
            evidence.extend(
                [
                    f"锁定评测表面 {locked_count}",
                    "Held-in / Held-out 双集无回归",
                    "严格提升 + 人工审批，禁止自动推广",
                    f"Harness 候选 {(harness or {}).get('candidate_count', 0)}，事件 {(harness or {}).get('event_count', 0)}",
                ]
            )
        return self._dimension(
            "evaluation_harness",
            score,
            evidence,
            gaps,
            ["把最新 blocker 转成 badcase，再运行双集回归评测。", "通过门禁后由人工复核候选，再决定推广或回滚。"],
        )

    def _memory_dimension(self, memory_stats: Dict[str, Any]) -> Dict[str, Any]:
        sessions = int(memory_stats.get("sessions") or 0)
        turns = int(memory_stats.get("turns") or 0)
        episodes = int(memory_stats.get("episodes") or 0)
        score = 45 + min(sessions, 10) * 2 + min(turns, 50) * 0.5 + min(episodes, 20) * 1.2
        gaps = []
        if sessions == 0:
            gaps.append("缺少会话记忆样本，无法验证上下文保留与压缩。")
        if turns > 20 and episodes == 0:
            gaps.append("会话轮次较多但没有 episode，建议触发压缩验证上下文治理。")
        evidence = [f"会话 {sessions}", f"轮次 {turns}", f"工作消息 {memory_stats.get('working_messages', 0)}", f"episodes {episodes}"]
        return self._dimension(
            "memory_context",
          
```

### Core Architecture Module: `services/agent_runtime.py`
```
"""Persistent audit Agent runtime with A2A-style task envelopes."""

from __future__ import annotations

import json
import hashlib
import statistics
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import PATHS
from services.evaluation_calibration import beta_posterior_mean, wilson_lower_bound
from services.record_store import SQLiteRecordStore
from services.safety_gate import SafetyGate
from services.skill_registry import SkillRegistry
from services.security import current_tenant_id, record_visible


class AgentRuntime:
    """Coordinates task planning, tool execution, artifacts, and observability."""

    def __init__(self, skill_registry: SkillRegistry, safety_gate: Optional[SafetyGate] = None) -> None:
        self.skill_registry = skill_registry
        self.safety_gate = safety_gate or SafetyGate()
        self.runtime_dir = PATHS["data"] / "agent_runtime"
        self.runtime_dir.mkdir(parents=True, exist_ok=True)
        self.event_log = self.runtime_dir / "events.jsonl"
        self._record_stores: Dict[str, SQLiteRecordStore] = {}

    def create_task(self, objective: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        context = context or {}
        task_id = f"AGT-{uuid.uuid4().hex[:10].upper()}"
        now = datetime.now().isoformat()
        plan = self._plan(objective, context)
        safety = self.safety_gate.inspect({"objective": objective, "context": context}, stage="runtime")
        status = "blocked" if safety["status"] == "blocked" else "planned"
        task = {
            "task_id": task_id,
            "tenant_id": current_tenant_id(),
            "protocol": "audit-agent-task-v1",
            "objective": objective,
            "context": context,
            "applied_lessons": [
                item
                for item in context.get("experience_lessons", [])
                if isinstance(item, dict) and item.get("status") == "approved"
            ],
            "status": status,
            "plan": plan,
            "steps": [],
            "artifacts": [],
            "tool_calls": [],
            "reflections": [],
            "budgets": {"max_tool_calls": 10, "max_retries_per_step": 1},
            "loop": {
                "strategy": "bounded_dependency_loop",
                "iterations": 0,
                "termination_reason": "not_started",
                "last_started_at": None,
                "last_finished_at": None,
            },
            "safety_gate": safety,
            "metrics": {
                "tool_calls": 0,
                "successful_tool_calls": 0,
                "failed_tool_calls": 0,
                "avg_latency_ms": 0,
                "estimated_cost": 0,
            },
            "created_at": now,
            "updated_at": now,
        }
        self._write_task(task)
        self._append_event(task_id, "task_created", {"status": status, "plan_steps": len(plan)})
        if status != "blocked":
            self.run_next_step(task_id)
        return self.get_task(task_id) or task

    def run_until_pause(self, task_id: str, max_steps: int = 6) -> Dict[str, Any]:
        """Run a bounded loop until completion, review, blocking, or step budget."""

        task = self.get_task(task_id)
        if not task:
            raise KeyError(task_id)
        bounded_steps = max(1, min(int(max_steps or 1), 12))
        loop = task.setdefault("loop", {})
        loop.update(
            {
                "strategy": "bounded_dependency_loop",
                "last_started_at": datetime.now().isoformat(),
                "termination_reason": "running",
            }
        )
        self._write_task(task)
        self._append_event(task_id, "loop_started", {"max_steps": bounded_steps})

        executed = 0
        while executed < bounded_steps:
            before = self.get_task(task_id) or task
            if before.get("status") in {"completed", "blocked", "needs_review"}:
                break
            before_steps = len(before.get("steps", []))
            task = self.run_next_step(task_id)
            executed += max(0, len(task.get("steps", [])) - before_steps)
            if task.get("status") in {"completed", "blocked", "needs_review"}:
                break
            if len(task.get("steps", [])) == before_steps:
                break

        task = self.get_task(task_id) or task
        if task.get("status") == "completed":
            reason = "task_completed"
        elif task.get("status") == "blocked":
            reason = "safety_blocked"
        elif task.get("status") == "needs_review":
            reason = "human_review_required"
        elif executed >= bounded_steps:
            reason = "step_budget_reached"
        else:
            reason = "no_progress"
        loop = task.setdefault("loop", {})
        loop["iterations"] = int(loop.get("iterations") or 0) + executed
        loop["last_finished_at"] = datetime.now().isoformat()
        loop["termination_reason"] = reason
        task["updated_at"] = datetime.now().isoformat()
        self._write_task(task)
        self._append_event(
            task_id,
            "loop_finished",
            {"executed_steps": executed, "termination_reason": reason, "status": task.get("status")},
        )
        return task

    def list_tasks(self, limit: int = 30) -> List[Dict[str, Any]]:
        self._migrate_legacy_tasks()
        return self._record_store().list("agent_task", limit=max(1, limit))

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        task = self._record_store().get("agent_task", task_id)
        if task is not None:
            return task
        path = self._path(task_id)
        if not path.exists():
            return None
        task = self._read(path)
        if not record_visible(task):
            return None
        task.setdefault("tenant_id", current_tenant_id())
        self._write_task(task)
        return task

    def delete_task(self, task_id: str) -> bool:
        path = self._path(task_id)
        if self.get_task(task_id) is None:
            return False
        removed = self._record_store().delete("agent_task", task_id)
        if path.exists():
            path.unlink()
        return removed

    def episode_package(self, task_id: str) -> Dict[str, Any]:
        """Build a trace-based, auditable episode without exposing raw secrets."""
        task = self.get_task(task_id)
        if not task:
            raise KeyError(task_id)
        events = self._events_for_task(task_id)
        context = task.get("context") or {}
        reflections = task.get("reflections") or []
        failed_steps = [step for step in task.get("steps", []) if step.get("status") != "success"]
        confidence_values = [
            float(item.get("confidence"))
            for item in reflections
            if isinstance(item.get("confidence"), (int, float))
        ]
        package = {
            "schema": "audit-agent-episode-v1",
            "task_id": task_id,
            "task_specification": {
                "objective": task.get("objective"),
                "protocol": task.get("protocol"),
                "plan_steps": len(task.get("plan", [])),
                "budgets": task.get("budgets", {}),
            },
            "context_evidence": {
                "context_hash": self._hash_payload(context),
                "available_fields": sorted(context.keys()),
                "raw_context_included": False,
            },
            "action_evidence": task.get("role_traces", []),
            "tool_evidence": task.get("tool_calls", []),
            "verification_evidence": {
                "task_safety_gate": task.get("safety_gate", {}),
                "step_safety_gates": [
                    {"step_id": step.get("step_id"), "gate": step.get("safety_gate", {})}
                    for step in task.get("steps", [])
                ],
                "reflections": reflections,
            },
            "failure_attribution": [
                {
                    "step_id": step.get("step_id"),
                    "skill": step.get("skill"),
                    "status": step.get("status"),
                    "error": (step.get("output") or {}).get("error")
                    if isinstance(step.get("output"), dict)
                    else str(step.get("output") or ""),
                }
                for step in failed_steps
            ],
            "intervention_record": [
                event for event in events if event.get("event_type") in {"budget_exhausted", "manual_step_added", "human_review"}
            ],
            "entropy_audit": {
                "reflection_count": len(reflections),
                "mean_confidence": round(statistics.mean(confidence_values), 3) if confidence_values else None,
                "retry_count": task.get("metrics", {}).get("retry_count", 0),
                "cache_hits": task.get("metrics", {}).get("cache_hits", 0),
            },
            "outcome": {
                "status": task.get("status"),
                "metrics": task.get("metrics", {}),
                "artifact_refs": [item.get("artifact_id") for item in task.get("artifacts", [])],
                "completed_steps": sum(1 for step in task.get("steps", []) if step.get("status") == "success"),
            },
            "event_log": events,
            "generated_at": datetime.now().isoformat(),
        }
        package["integrity"] = {
            "algorithm": "sha256",
            "digest": self._package_digest(package),
        }
        return package

    def run_next_step(self, task_id: str) -> Dict[str, Any]:
        task = self.get_task(task_id)
        if not task:
            raise KeyError(task_id)
        if task["status"] == "blocked":
            return task

        max_calls = int(task.get("budgets", {}).get("max_tool_calls", 10))
        if len(task.get("tool_calls", [])) >= max_calls:
```

### Core Architecture Module: `services/audit_delivery.py`
```
"""Audit-industry delivery package generation."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from services.audit_repository import AuditRunRepository


class AuditDeliveryService:
    def __init__(self, repository: AuditRunRepository) -> None:
        self.repository = repository

    def build_package(self, run_id: str) -> Optional[Dict[str, Any]]:
        record = self.repository.get_run(run_id)
        if not record:
            return None
        result = record.get("result", {})
        request = record.get("request", {})
        controls = result.get("control_matrix", [])
        procedures = result.get("audit_program", [])
        findings = result.get("findings", [])
        tasks = record.get("remediation_tasks", [])

        return {
            "run_id": run_id,
            "generated_at": datetime.now().isoformat(),
            "engagement": {
                "audit_item": request.get("audit_item"),
                "audit_type": request.get("audit_type"),
                "standard": request.get("standard_type"),
                "risk_level": request.get("risk_level"),
                "status": record.get("status"),
                "lifecycle_stage": record.get("lifecycle_stage"),
                "business_context": request.get("business_context"),
                "audit_scope": request.get("audit_scope"),
                "audit_period": request.get("audit_period"),
                "key_questions": request.get("key_questions"),
                "existing_evidence": request.get("existing_evidence"),
            },
            "workpaper_index": self._workpaper_index(result, record),
            "evidence_request_list": self._evidence_request_list(record, result),
            "control_test_plan": self._control_test_plan(record, controls, procedures),
            "evidence_analysis_index": record.get("evidence_analyses", []),
            "finding_tracker": self._finding_tracker(findings, tasks),
            "interview_plan": self._interview_plan(result),
            "fieldwork_calendar": self._fieldwork_calendar(result),
            "quality_review": result.get("quality_gate", {}),
            "event_log": record.get("events", []),
            "signoff": {
                "prepared_by": "智能审计 Agent",
                "reviewer": "审计经理",
                "review_required": bool(result.get("quality_gate", {}).get("escalation_required")),
                "reviews": record.get("reviews", []),
            },
        }

    def _workpaper_index(self, result: Dict[str, Any], record: Dict[str, Any]) -> List[Dict[str, Any]]:
        rows = [
            {"ref": "WP-00", "name": "审计范围与目标", "source": "task_plan", "owner": "审计经理"},
            {"ref": "WP-10", "name": "RAG 证据检索记录", "source": "evidence_pack", "owner": "审计员"},
            {"ref": "WP-20", "name": "控制矩阵", "source": "control_matrix", "owner": "控制测试员"},
            {"ref": "WP-30", "name": "审计程序与抽样计划", "source": "audit_program", "owner": "审计员"},
            {"ref": "WP-40", "name": "审计发现与整改计划", "source": "findings", "owner": "审计经理"},
            {"ref": "WP-50", "name": "质量门与复核记录", "source": "quality_gate", "owner": "复核人"},
        ]
        for index, control in enumerate(result.get("control_matrix", []), start=1):
            rows.append(
                {
                    "ref": f"WP-20-{index:02d}",
                    "name": f"{control.get('control_id')} {control.get('domain')} 控制测试",
                    "source": control.get("control_id"),
                    "owner": "控制测试员",
                }
            )
        for item in record.get("evidence_analyses", []):
            rows.append(
                {
                    "ref": item.get("workpaper_ref") or item.get("analysis_id"),
                    "name": f"证据文件分析 - {item.get('file_name', '')}",
                    "source": item.get("analysis_id"),
                    "owner": "审计员",
                }
            )
        return rows

    def _evidence_request_list(self, record: Dict[str, Any], result: Dict[str, Any]) -> List[Dict[str, Any]]:
        requests = []
        for item in record.get("evidence_requests", []):
            requests.append(
                {
                    "id": item.get("request_id"),
                    "source": item.get("source"),
                    "summary": item.get("evidence"),
                    "usage": item.get("usage"),
                    "owner": item.get("owner"),
                    "priority": item.get("priority"),
                    "status": item.get("status"),
                }
            )
        if requests:
            return requests
        for index, item in enumerate(result.get("evidence_pack", []), start=1):
            requests.append(
                {
                    "id": f"EV-{index:02d}",
                    "source": item.get("source"),
                    "summary": item.get("summary"),
                    "usage": item.get("usage"),
                    "owner": "审计员",
                    "priority": "中",
                    "status": "已获取" if item.get("type") != "heuristic" else "待补充",
                }
            )
        return requests

    def _control_test_plan(self, record: Dict[str, Any], controls: List[Dict[str, Any]], procedures: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if record.get("control_tests"):
            return record["control_tests"]
        procedure_by_control = {item.get("control_id"): item for item in procedures}
        rows = []
        for control in controls:
            procedure = procedure_by_control.get(control.get("control_id"), {})
            rows.append(
                {
                    "control_id": control.get("control_id"),
                    "domain": control.get("domain"),
                    "test_procedure": control.get("test_procedure"),
                    "assertion": procedure.get("assertion"),
                    "sample_method": procedure.get("method"),
                    "evidence_required": control.get("evidence_required", []),
                    "workpaper_ref": procedure.get("workpaper_ref"),
                    "result": "待执行",
                    "exception_rule": "发现重大例外时扩大样本并升级复核。",
                }
            )
        return rows

    def _finding_tracker(self, findings: List[Dict[str, Any]], tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        rows = []
        for finding in findings:
            related_tasks = [task for task in tasks if finding.get("finding_id", "") in task.get("description", "")] or tasks[:2]
            rows.append(
                {
                    "finding_id": finding.get("finding_id"),
                    "title": finding.get("title"),
                    "severity": finding.get("severity"),
                    "condition": finding.get("condition"),
                    "recommendation": finding.get("recommendation"),
                    "tasks": [{"task_id": task.get("task_id"), "status": task.get("status"), "owner": task.get("owner")} for task in related_tasks],
                }
            )
        return rows

    def _interview_plan(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        domains = []
        for control in result.get("control_matrix", []):
            domain = control.get("domain")
            if domain and domain not in domains:
                domains.append(domain)
        return [
            {
                "topic": domain,
                "interviewee": "流程负责人 / 系统管理员 / 控制责任人",
                "questions": [
                    f"{domain} 控制的责任边界和审批链路是什么？",
                    "关键例外如何审批、记录和复核？",
                    "最近一次控制执行证据存放在哪里？",
                ],
            }
            for domain in domains[:6]
        ]

    def _fieldwork_calendar(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        tasks = result.get("task_plan", [])
        calendar = []
        for index, task in enumerate(tasks, start=1):
            calendar.append(
                {
                    "day": f"D+{index}",
                    "activity": task.get("name"),
                    "owner": task.get("owner"),
                    "output": task.get("objective"),
                }
            )
        return calendar

```

### Core Architecture Module: `services/audit_repository.py`
```
"""Persistent audit run storage and report rendering."""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import PATHS
from services.security import current_principal, current_tenant_id, project_visible, record_visible
from services.record_store import SQLiteRecordStore


TASK_STATUSES = ["未开始", "进行中", "待验证", "已完成", "已关闭"]
RUN_LIFECYCLE = ["立项", "取证", "测试", "复核", "报告", "整改跟踪", "关闭"]


class AuditRunRepository:
    def __init__(self, root: Optional[Path] = None) -> None:
        self.root = root or (PATHS["data"] / "audit_runs")
        self.root.mkdir(parents=True, exist_ok=True)
        self.store = SQLiteRecordStore(self.root / ".records.sqlite3")
        self._migrate_legacy_records()

    def create_run(self, request: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
        run_id = f"AR-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        record = {
            "run_id": run_id,
            "project_id": run_id,
            "tenant_id": current_tenant_id(),
            "members": {current_principal().subject: "project_manager"},
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "待复核" if result.get("quality_gate", {}).get("escalation_required") else "待现场验证",
            "lifecycle_stage": "取证",
            "request": request,
            "result": result,
            "remediation_tasks": self._build_remediation_tasks(run_id, result),
            "evidence_requests": self._build_evidence_requests(run_id, result),
            "control_tests": self._build_control_tests(result),
            "evidence_analyses": [],
            "reviews": [],
            "events": [{"at": datetime.now().isoformat(), "type": "created", "message": "审计项目已创建"}],
        }
        self._write(record)
        return record

    def list_runs(self, limit: int = 20) -> List[Dict[str, Any]]:
        records = []
        for record in self.iter_records(limit=1000):
            result = record.get("result", {})
            records.append(
                {
                    "run_id": record.get("run_id"),
                    "created_at": record.get("created_at"),
                    "updated_at": record.get("updated_at"),
                    "status": self._clean_legacy(record.get("status")),
                    "lifecycle_stage": self._clean_legacy(record.get("lifecycle_stage", "取证")),
                    "audit_item": self._display_text(record.get("request", {}).get("audit_item"), "历史审计档案"),
                    "audit_type": self._display_text(record.get("request", {}).get("audit_type"), "综合审计"),
                    "risk_level": self._clean_legacy(result.get("risk_assessment", {}).get("risk_level")),
                    "risk_score": result.get("risk_assessment", {}).get("risk_score"),
                    "quality_confidence": result.get("quality_gate", {}).get("confidence"),
                    "compliance_score": result.get("compliance_check", {}).get("compliance_score"),
                }
            )
        records.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return records[:limit]

    def iter_records(self, limit: int = 200) -> List[Dict[str, Any]]:
        records = [
            self._normalize_record(record)
            for record in self.store.list("audit_run", limit=max(limit, 1))
            if project_visible(record)
        ]
        records.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return records[:limit]

    def task_summary(self) -> Dict[str, Any]:
        status_counts: Dict[str, int] = {}
        open_tasks = 0
        overdue_tasks = 0
        for record in self.iter_records(limit=1000):
            created_at = self._parse_date(record.get("created_at"))
            for task in record.get("remediation_tasks", []):
                status = self._clean_legacy(task.get("status", "未知"))
                status_counts[status] = status_counts.get(status, 0) + 1
                if status not in {"已完成", "已关闭", "done", "closed"}:
                    open_tasks += 1
                    due_days = int(task.get("due_days") or 0)
                    if created_at and due_days >= 0 and (datetime.now() - created_at).days > due_days:
                        overdue_tasks += 1
        return {"open_tasks": open_tasks, "overdue_tasks": overdue_tasks, "status_distribution": status_counts}

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        path = self._path(run_id)
        record = self.store.get("audit_run", run_id)
        if record is None and path.exists():
            record = json.loads(path.read_text(encoding="utf-8"))
            if record_visible(record):
                record.setdefault("tenant_id", current_tenant_id())
                self.store.put("audit_run", run_id, record)
        if record is None:
            return None
        record = self._normalize_record(record)
        return record if project_visible(record) else None

    def delete_run(self, run_id: str) -> bool:
        path = self._path(run_id)
        if self.get_run(run_id) is None:
            return False
        removed = self.store.delete("audit_run", run_id)
        if path.exists():
            path.unlink()
        return removed

    def add_review(self, run_id: str, reviewer: str, decision: str, comment: str) -> Optional[Dict[str, Any]]:
        record = self.get_run(run_id)
        if not record:
            return None
        review = {
            "reviewer": reviewer or "复核人",
            "decision": decision,
            "comment": comment,
            "created_at": datetime.now().isoformat(),
        }
        record.setdefault("reviews", []).append(review)
        record["status"] = "已通过" if decision == "approve" else "需整改" if decision == "reject" else "待补充证据"
        record["lifecycle_stage"] = "报告" if decision == "approve" else "复核"
        self._append_event(record, "review", f"{review['reviewer']} 提交复核结论：{record['status']}")
        self._write(record)
        return record

    def update_task(self, run_id: str, task_id: str, status: str, owner: str = "", note: str = "") -> Optional[Dict[str, Any]]:
        record = self.get_run(run_id)
        if not record:
            return None
        for task in record.get("remediation_tasks", []):
            if task.get("task_id") == task_id:
                task["status"] = self._clean_legacy(status)
                if owner:
                    task["owner"] = owner
                if note:
                    task.setdefault("notes", []).append({"note": note, "at": datetime.now().isoformat()})
                task["updated_at"] = datetime.now().isoformat()
                record["lifecycle_stage"] = "整改跟踪"
                self._append_event(record, "task_update", f"整改任务 {task_id} 更新为 {task['status']}")
                self._write(record)
                return record
        return None

    def update_evidence_request(self, run_id: str, request_id: str, status: str, owner: str = "", note: str = "") -> Optional[Dict[str, Any]]:
        record = self.get_run(run_id)
        if not record:
            return None
        for item in record.get("evidence_requests", []):
            if item.get("request_id") == request_id:
                item["status"] = self._clean_legacy(status)
                if owner:
                    item["owner"] = owner
                if note:
                    item.setdefault("notes", []).append({"note": note, "at": datetime.now().isoformat()})
                item["updated_at"] = datetime.now().isoformat()
                record["lifecycle_stage"] = "取证"
                self._append_event(record, "evidence_update", f"证据请求 {request_id} 更新为 {item['status']}")
                self._write(record)
                return record
        return None

    def update_control_test(self, run_id: str, control_id: str, result: str, tester: str = "", exception: str = "") -> Optional[Dict[str, Any]]:
        record = self.get_run(run_id)
        if not record:
            return None
        for item in record.get("control_tests", []):
            if item.get("control_id") == control_id:
                item["result"] = result
                if tester:
                    item["tester"] = tester
                if exception:
                    item.setdefault("exceptions", []).append({"exception": exception, "at": datetime.now().isoformat()})
                item["updated_at"] = datetime.now().isoformat()
                record["lifecycle_stage"] = "测试"
                self._append_event(record, "control_test", f"控制 {control_id} 测试结果更新为 {result}")
                self._write(record)
                return record
        return None

    def attach_evidence_analysis(self, run_id: str, analysis: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        record = self.get_run(run_id)
        if not record:
            return None
        analysis_id = analysis.get("analysis_id")
        if not analysis_id:
            return record

        attached = record.setdefault("evidence_analyses", [])
        if not any(item.get("analysis_id") == analysis_id for item in attached):
            attached.append(
                {
                    "analysis_id": analysis_id,
                    "file_name": analysis.get("file_name"),
                    "created_at": analysis.get("created_at"),
                    "risk_count": len(analysis.get("risk_signals", [])),
                    "control_count": len(analysis.get("mapped_controls", [])),
                    "quality_gate": analysis.get("quality_gate", {}),
                    "workpaper_ref": f"WP-EA-{len(attached) + 1:02d}",
                }
            )

        existing_evidence = {item.get("evidence") for item in record.get("evidence_requests", [])}
        for request in analysis.get("evidence_re
```

### Core Architecture Module: `services/audit_templates.py`
```
"""Audit engagement templates for common industry scenarios."""

from __future__ import annotations

from typing import Any, Dict, List


AUDIT_TEMPLATES: List[Dict[str, Any]] = [
    {
        "template_id": "tpl-itgc-sox",
        "name": "SOX ITGC 财务系统审计",
        "audit_type": "内部控制审计",
        "standard": "SOX",
        "risk_level": "高",
        "scope": ["访问控制", "变更管理", "作业调度", "备份恢复", "接口对账"],
        "evidence": ["用户清单", "权限复核记录", "变更单", "测试报告", "上线审批", "备份日志", "批处理监控记录"],
        "deliverables": ["ITGC 控制矩阵", "抽样底稿", "例外清单", "管理层整改计划", "复核签字页"],
    },
    {
        "template_id": "tpl-erp-access",
        "name": "ERP 权限与职责分离审计",
        "audit_type": "安全审计",
        "standard": "ISO27001",
        "risk_level": "高",
        "scope": ["账号生命周期", "角色权限", "职责分离", "特权账号", "定期复核"],
        "evidence": ["账号导出", "角色矩阵", "授权审批", "冲突权限报表", "复核记录", "离职人员清单"],
        "deliverables": ["权限风险清单", "SoD 冲突清单", "权限整改计划", "复核底稿"],
    },
    {
        "template_id": "tpl-data-security",
        "name": "数据安全与个人信息处理审计",
        "audit_type": "合规审计",
        "standard": "数据安全法",
        "risk_level": "中",
        "scope": ["数据分类分级", "敏感数据访问", "加密脱敏", "共享审批", "日志审计", "应急响应"],
        "evidence": ["数据目录", "分类分级规则", "访问审批", "加密配置", "脱敏规则", "共享台账", "日志样本"],
        "deliverables": ["数据处理活动审计表", "敏感数据风险清单", "合规缺口分析", "整改路线图"],
    },
    {
        "template_id": "tpl-change-release",
        "name": "生产变更与发布管理审计",
        "audit_type": "风险评估",
        "standard": "COBIT",
        "risk_level": "中",
        "scope": ["需求审批", "开发测试", "上线审批", "回退方案", "紧急变更", "上线后复核"],
        "evidence": ["变更单", "需求审批", "测试证据", "上线记录", "回退方案", "紧急变更审批"],
        "deliverables": ["变更样本测试表", "紧急变更清单", "发布风险评估", "流程优化建议"],
    },
    {
        "template_id": "tpl-backup-recovery",
        "name": "备份恢复与业务连续性审计",
        "audit_type": "风险评估",
        "standard": "ISO27001",
        "risk_level": "中",
        "scope": ["备份策略", "备份成功率", "恢复演练", "RPO/RTO", "灾备切换", "问题整改"],
        "evidence": ["备份策略", "备份日志", "恢复演练报告", "RPO/RTO 定义", "灾备预案", "整改记录"],
        "deliverables": ["备份恢复测试底稿", "业务连续性缺口清单", "恢复能力评估", "整改计划"],
    },
    {
        "template_id": "tpl-third-party",
        "name": "第三方服务与外包安全审计",
        "audit_type": "合规审计",
        "standard": "ISO27001",
        "risk_level": "中",
        "scope": ["供应商准入", "合同安全条款", "数据访问", "服务级别", "退出机制", "安全评估"],
        "evidence": ["供应商台账", "合同条款", "权限清单", "SLA 报告", "安全评估报告", "退出交接记录"],
        "deliverables": ["供应商风险评级", "外包访问清单", "合同合规缺口", "退出风险清单"],
    },
]


def list_audit_templates() -> List[Dict[str, Any]]:
    return AUDIT_TEMPLATES

```

### Core Architecture Module: `services/component_contracts.py`
```
"""Executable component boundaries for the AuditPilot agent platform.

The catalog is intentionally business-facing.  It documents ownership,
inputs, outputs, invariants, and evaluation responsibilities without tying
the product to a specific orchestration framework.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List


_COMPONENTS: List[Dict[str, Any]] = [
    {
        "id": "task_specification",
        "name": "任务规格",
        "owner": "Agent Runtime",
        "purpose": "把审计目标转换为可执行、可停止、可复核的任务契约。",
        "inputs": ["objective", "audit_context", "budgets"],
        "outputs": ["task_envelope", "success_criteria", "stop_conditions"],
        "invariants": ["目标不能为空", "工具与重试预算必须有上限", "任务必须具备人工复核出口"],
        "does_not_own": ["模型回答生成", "证据内容判定", "发布审批"],
        "evaluators": ["objective_clarity", "budget_bounded", "review_exit"],
        "weight": 0.10,
        "critical": True,
    },
    {
        "id": "agent_loop",
        "name": "任务编排",
        "owner": "Bounded Agent Loop",
        "purpose": "按依赖执行计划步骤，并在完成、阻断、需复核或预算耗尽时停止。",
        "inputs": ["task_envelope", "plan", "step_results"],
        "outputs": ["trajectory", "termination_reason", "artifacts"],
        "invariants": ["不得绕过依赖", "不得无限循环", "失败后不得静默继续"],
        "does_not_own": ["工具内部实现", "知识库索引", "人工审批结论"],
        "evaluators": ["dependency_conformance", "termination_safety", "step_completion"],
        "weight": 0.14,
        "critical": True,
    },
    {
        "id": "tool_runtime",
        "name": "工具执行",
        "owner": "Skill Registry",
        "purpose": "校验输入、执行受权限约束的工具，并记录延迟、重试、缓存和熔断。",
        "inputs": ["tool_name", "validated_arguments", "permission_context"],
        "outputs": ["tool_result", "execution_span", "recovery_signal"],
        "invariants": ["输入必须通过 Schema 校验", "敏感字段必须脱敏", "失败必须结构化返回"],
        "does_not_own": ["任务拆解", "业务结论", "发布门禁"],
        "evaluators": ["schema_validity", "tool_success", "retry_discipline", "latency"],
        "weight": 0.13,
        "critical": True,
    },
    {
        "id": "evidence_grounding",
        "name": "检索与证据",
        "owner": "RAG / Evidence Services",
        "purpose": "召回可引用的制度、底稿与系统证据，并保留来源和证据缺口。",
        "inputs": ["audit_question", "scope", "source_policy"],
        "outputs": ["ranked_sources", "citations", "evidence_gaps"],
        "invariants": ["来源必须可追溯", "低置信度不得输出绝对结论", "缺失证据必须显式呈现"],
        "does_not_own": ["整改责任分配", "工具授权", "模型版本发布"],
        "evaluators": ["source_coverage", "authority", "faithfulness", "gap_visibility"],
        "weight": 0.14,
        "critical": True,
    },
    {
        "id": "evidence_graph",
        "name": "证据关系图",
        "owner": "Evidence Graph",
        "purpose": "连接任务、计划、工具、产物与复核，形成可验证的审计血缘。",
        "inputs": ["episode_package", "control_dependencies", "artifact_refs"],
        "outputs": ["nodes", "edges", "lineage_metrics"],
        "invariants": ["产物必须有来源", "依赖边必须指向存在节点", "关键步骤不得成为孤点"],
        "does_not_own": ["通用向量召回", "图数据库运维", "最终审计意见"],
        "evaluators": ["provenance_coverage", "broken_dependency_rate", "orphan_rate"],
        "weight": 0.10,
        "critical": False,
    },
    {
        "id": "safety_governance",
        "name": "安全与权限",
        "owner": "Safety Gate",
        "purpose": "在任务和步骤边界执行输入检查、权限约束和人工升级。",
        "inputs": ["task_payload", "tool_permissions", "stage"],
        "outputs": ["gate_decision", "findings", "required_intervention"],
        "invariants": ["阻断项不得执行", "高风险动作必须留下复核记录", "凭据不得进入轨迹"],
        "does_not_own": ["业务风险评分", "模型推理", "知识内容维护"],
        "evaluators": ["blocked_action_prevention", "review_trigger", "secret_redaction"],
        "weight": 0.13,
        "critical": True,
    },
    {
        "id": "memory_context",
        "name": "上下文与记忆",
        "owner": "Context / Memory",
        "purpose": "管理任务上下文、检查点和经批准的经验，避免无边界记忆污染。",
        "inputs": ["working_context", "task_events", "approved_lessons"],
        "outputs": ["bounded_context", "checkpoint", "relevant_lessons"],
        "invariants": ["原始敏感上下文不得进入评测包", "经验必须有来源", "未批准经验不得自动应用"],
        "does_not_own": ["工具执行", "知识源权威性", "审批决策"],
        "evaluators": ["context_minimization", "checkpoint_presence", "lesson_governance"],
        "weight": 0.08,
        "critical": False,
    },
    {
        "id": "audit_delivery",
        "name": "审计交付",
        "owner": "Audit Delivery",
        "purpose": "将控制、证据、发现和整改转换为可下载、可复核的交付包。",
        "inputs": ["validated_artifacts", "findings", "review_decision"],
        "outputs": ["workpaper_index", "report", "remediation_tracker"],
        "invariants": ["结论必须关联证据", "发现必须包含整改动作", "未复核结论不得标记为最终"],
        "does_not_own": ["模型调用", "工具注册", "经验推广"],
        "evaluators": ["artifact_coverage", "remediation_actionability", "review_state"],
        "weight": 0.10,
        "critical": False,
    },
    {
        "id": "improvement_governance",
        "name": "持续改进",
        "owner": "Evaluation Harness",
        "purpose": "把失败和反思沉淀为候选经验，经回归评测和人工批准后再复用。",
        "inputs": ["traces", "component_scores", "human_feedback"],
        "outputs": ["experience_candidate", "regression_result", "promotion_decision"],
        "invariants": ["评测器不可被候选修改", "必须同时通过基线与留出集", "推广必须人工审批"],
        "does_not_own": ["在线任务执行", "原始证据存储", "模型训练平台"],
        "evaluators": ["failure_attribution", "heldout_gate", "human_approval"],
        "weight": 0.08,
        "critical": False,
    },
]


def component_catalog() -> List[Dict[str, Any]]:
    """Return an isolated copy so callers cannot mutate platform contracts."""

    return deepcopy(_COMPONENTS)


def component_by_id(component_id: str) -> Dict[str, Any]:
    for component in _COMPONENTS:
        if component["id"] == component_id:
            return deepcopy(component)
    raise KeyError(component_id)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- *No recent closed bug issues fetched.*

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

### Incident Patch 1: `70014d6e` (2026-07-06)
**Commit Message**: Upgrade agent runtime memory routing and governance

**File**: `agents/audit_agent.py` (modified, +37/-8)
```diff
@@ -277,14 +277,28 @@ def _init_llm(self) -> Any:
             logger.warning("LLM client initialization failed: %s", exc)
             return None
 
-    def process_audit_query(self, user_input: str, session_id: Optional[str] = None) -> Dict[str, Any]:
+    def process_audit_query(
+        self,
+        user_input: str,
+        session_id: Optional[str] = None,
+        external_context: Optional[Dict[str, Any]] = None,
+    ) -> Dict[str, Any]:
         session_id = session_id or f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
         self.session_memory.setdefault(session_id, [])
         self.session_memory[session_id].append(HumanMessage(content=user_input))
         self._trim_session(session_id)
 
         trace: List[Dict[str, Any]] = []
-        audit_context = self._extract_context(user_input)
+        audit_context = self._extract_context(user_input, external_context)
+        if external_context and external_context.get("memory_layers"):
+            layers = external_context["memory_layers"]
+            trace.append(
+                self._trace(
+                    "memory",
+                    "loaded",
+                    f"工作记忆 {layers.get('working', 0)} 条，情景记忆 {layers.get('episodic', 0)} 条",
+                )
+            )
         task_plan = self._create_task_plan(audit_context)
         trace.append(self._trace("planner", "generated", f"生成 {len(task_plan)} 个审计任务"))
 
@@ -342,25 +356,40 @@ def _trim_session(self, session_id: str) -> None:
         max_messages = AUDIT_CONFIG["max_session_messages"]
         self.session_memory[session_id] = self.session_memory[session_id][-max_messages:]
 
-    def _extract_context(self, text: str) -> Dict[str, Any]:
-        normalized = text.upper()
+    def _extract_context(self, text: str, external_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
+        external_context = external_context or {}
+        profile = external_context.get("profile") or {}
+        memory_text = " ".join(
+            [
+                str(external_context.get("summary") or ""),
+                " ".join(str(item.get("content") or "") for item in external_context.get("related_messages", [])),
+                " ".join(str(item) for item in profile.get("standards", [])),
+                " ".join(str(item) for item in profile.get("risk_topics", [])),
+                " ".join(str(item) for item in profile.get("systems", [])),
+            ]
+        )
+        enriched_text = f"{text} {memory_text}".strip()
+        normalized = enriched_text.upper()
         standards = [key for key in AUDIT_STANDARDS if key.upper() in normalized]
         if "ISO" in normalized and "ISO27001" not in standards:
             standards.append("ISO27001")
 
         audit_types = []
         for keyword in ["安全审计", "合规审计", "风险评估", "内部控制审计", "数据审计", "财务审计"]:
-            if keyword in text:
+            if keyword in enriched_text:
                 audit_types.append(keyword)
 
         item = self._guess_audit_item(text)
-        topics = [key for key in RISK_KEYWORDS if key in text or key in item]
+        if item == "待审计对象" and profile.get("systems"):
+            item = str(profile["systems"][-1])
+        topics = [key for key in RISK_KEYWORDS if key in enriched_text or key in item]
         return {
             "audit_item": item,
             "audit_types": audit_types or ["综合审计分析"],
-            "standards": standards or self._infer_standards(text),
+            "standards": standards or self._infer_standards(enriched_text),
             "key_risk_topics": topics,
-            "business_domain": self._business_domain(text, topics),
+            "business_domain": self._business_domain(enriched_text, topics),
+            "memory_grounded": bool(memory_text),
             "generated_at": datetime.now().isoformat(),
         }
 
```

**File**: `services/agent_runtime.py` (modified, +71/-14)
```diff
@@ -40,6 +40,8 @@ def create_task(self, objective: str, context: Optional[Dict[str, Any]] = None)
             "steps": [],
             "artifacts": [],
             "tool_calls": [],
+            "reflections": [],
+            "budgets": {"max_tool_calls": 10, "max_retries_per_step": 1},
             "safety_gate": safety,
             "metrics": {
                 "tool_calls": 0,
@@ -100,30 +102,45 @@ def run_next_step(self, task_id: str) -> Dict[str, Any]:
             self._write_task(task)
             return task
 
-        run = self.skill_registry.execute(next_plan["skill"], payload)
+        runs = [self.skill_registry.execute(next_plan["skill"], payload)]
+        retry_budget = int(task.get("budgets", {}).get("max_retries_per_step", 1))
+        if runs[-1]["status"] != "success" and retry_budget > 0:
+            runs.append(self.skill_registry.execute(next_plan["skill"], payload))
+        run = runs[-1]
         step_record.update(
             {
                 "status": run["status"],
                 "finished_at": run["finished_at"],
                 "run_id": run["run_id"],
                 "output": run.get("output"),
                 "duration_ms": run.get("duration_ms", 0),
+                "attempts": len(runs),
             }
         )
         task["steps"].append(step_record)
-        task["tool_calls"].append(
-            {
-                "run_id": run["run_id"],
-                "skill": next_plan["skill"],
-                "status": run["status"],
-                "duration_ms": run.get("duration_ms", 0),
-                "input_size": run.get("input_size", 0),
-                "output_size": run.get("output_size", 0),
-            }
-        )
-        task["artifacts"].extend(self._artifacts_from_run(next_plan, run))
+        for attempt, item in enumerate(runs, start=1):
+            task["tool_calls"].append(
+                {
+                    "run_id": item["run_id"],
+                    "skill": next_plan["skill"],
+                    "status": item["status"],
+                    "duration_ms": item.get("duration_ms", 0),
+                    "input_size": item.get("input_size", 0),
+                    "output_size": item.get("output_size", 0),
+                    "attempt": attempt,
+                    "cache_hit": item.get("cache_hit", False),
+                    "circuit_state": item.get("circuit_state", "closed"),
+                }
+            )
+        reflection = self._reflect(next_plan, run, len(runs))
+        task.setdefault("reflections", []).append(reflection)
+        if run["status"] == "success":
+            task["artifacts"].extend(self._artifacts_from_run(next_plan, run))
         task["metrics"] = self._metrics(task)
-        task["status"] = "completed" if len(task["steps"]) >= len(task.get("plan", [])) else "running"
+        if run["status"] != "success":
+            task["status"] = "needs_review"
+        else:
+            task["status"] = "completed" if len(completed) + 1 >= len(task.get("plan", [])) else "running"
         task["updated_at"] = datetime.now().isoformat()
         self._write_task(task)
         return task
@@ -151,7 +168,7 @@ def observability(self) -> Dict[str, Any]:
         latencies = [float(call.get("duration_ms") or 0) for call in tool_calls]
         success = [call for call in tool_calls if call.get("status") == "success"]
         blocked = [task for task in tasks if task.get("status") == "blocked"]
-        active = [task for task in tasks if task.get("status") in {"planned", "running"}]
+        active = [task for task in tasks if task.get("status") in {"planned", "running", "needs_review"}]
         return {
             "tasks": len(tasks),
             "active_tasks": len(active),
@@ -164,6 +181,9 @@ def observability(self) -> Dict[str, Any]:
                 sum(1 for task in tasks if task.get("safety_gate", {}).get("status") == "review") / max(len(tasks), 1),
                 3,
             ),
+            "reflections": sum(len(task.get("reflections", [])) for task in tasks),
+            "retry_count": sum(max(0, int(step.get("attempts", 1)) - 1) for task in tasks for step in task.get("steps", [])),
+            "memory": {"task_checkpoints": len(tasks), "artifact_count": sum(len(task.get("artifacts", [])) for task in tasks)},
             "latest_tasks": tasks[:8],
             "skill_metrics": self.skill_registry.metrics(),
         }
@@ -177,6 +197,8 @@ def _plan(self, objective: str, context: Dict[str, Any]) -> List[Dict[str, Any]]
                 "name": "审计范围规划",
                 "stage": "audit",
                 "skill": "audit.scope_planner",
+                "agent_role": "planning_agent",
+                "depends_on": [],
                 "purpose": "Clarify audit scope, standard, and deliverables.",
                 "input_hint": {"audit_item": audit_item, "risk_topics": risk_topics},
             },
@@ -185,6 +207,8 @@ def _plan(self, objective: str, context: Dict[str, Any]
```

**File**: `services/conversation_memory.py` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+"""File-backed working, episodic, and profile memory for audit conversations."""
+
+from __future__ import annotations
+
+import json
+import re
+import threading
+from datetime import datetime
+from pathlib import Path
+from typing import Any, Dict, List, Optional
+
+from config import PATHS
+
+
+class ConversationMemory:
+    """Persist conversation context without requiring Redis or a vector service."""
+
+    def __init__(self, base_dir: Optional[Path] = None, compress_at: int = 18, retain_recent: int = 8) -> None:
+        self.base_dir = base_dir or PATHS["data"] / "conversation_memory"
+        self.base_dir.mkdir(parents=True, exist_ok=True)
+        self.compress_at = compress_at
+        self.retain_recent = retain_recent
+        self._lock = threading.RLock()
+
+    def context_for(self, session_id: str, message: str) -> Dict[str, Any]:
+        session = self.get_session(session_id) or self._empty(session_id)
+        related = self._related(session.get("messages", []), message)
+        prompt_parts = []
+        if session.get("summary"):
+            prompt_parts.append(f"[会话摘要]\n{session['summary']}")
+        if session.get("profile"):
+            prompt_parts.append(f"[审计画像]\n{json.dumps(session['profile'], ensure_ascii=False)}")
+        if related:
+            prompt_parts.append("[相关历史]\n" + "\n".join(f"- {item['content'][:240]}" for item in related))
+        recent = session.get("messages", [])[-6:]
+        if recent:
+            prompt_parts.append(
+                "[最近对话]\n" + "\n".join(f"{item['role']}: {item['content'][:360]}" for item in recent)
+            )
+        return {
+            "session_id": session_id,
+            "summary": session.get("summary", ""),
+            "profile": session.get("profile", {}),
+            "related_messages": related,
+            "recent_messages": recent,
+            "prompt_text": "\n\n".join(prompt_parts),
+            "memory_layers": {
+                "working": len(session.get("messages", [])),
+                "episodic": len(session.get("episodes", [])),
+                "profile_fields": len(session.get("profile", {})),
+            },
+        }
+
+    def record_turn(
+        self,
+        session_id: str,
+        user_message: str,
+        assistant_message: str,
+        metadata: Optional[Dict[str, Any]] = None,
+    ) -> Dict[str, Any]:
+        with self._lock:
+            session = self.get_session(session_id) or self._empty(session_id)
+            now = datetime.now().isoformat()
+            session["messages"].extend(
+                [
+                    {"role": "user", "content": user_message, "at": now},
+                    {"role": "assistant", "content": assistant_message, "at": now},
+                ]
+            )
+            session["profile"] = self._update_profile(session.get("profile", {}), user_message, metadata or {})
+            session["turns"] = int(session.get("turns", 0)) + 1
+            session["updated_at"] = now
+            if len(session["messages"]) >= self.compress_at:
+                self._compress(session)
+            self._write(session)
+            return self._summary(session)
+
+    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
+        path = self._path(session_id)
+        if not path.exists():
+            return None
+        try:
+            return json.loads(path.read_text(encoding="utf-8"))
+        except (OSError, json.JSONDecodeError):
+            return None
+
+    def list_sessions(self, limit: int = 20) -> List[Dict[str, Any]]:
+        files = sorted(self.base_dir.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True)
+        sessions = []
+        for path in files[: max(limit, 1)]:
+            try:
+                sessions.append(self._summary(json.loads(path.read_text(encoding="utf-8"))))
+            except (OSError, json.JSONDecodeError):
+                continue
+        return sessions
+
+    def stats(self) -> Dict[str, Any]:
+        sessions = self.list_sessions(limit=1000)
+        return {
+            "sessions": len(sessions),
+            "turns": sum(int(item.get("turns", 0)) for item in sessions),
+            "working_messages": sum(int(item.get("working_messages", 0)) for item in sessions),
+            "episodes": sum(int(item.get("episodes", 0)) for item in sessions),
+        }
+
+    def _empty(self, session_id: str) -> Dict[str, Any]:
+        now = datetime.now().isoformat()
+        return {
+            "session_id": session_id,
+            "summary": "",
+            "profile": {},
+            "messages": [],
+            "episodes": [],
+            "turns": 0,
+            "created_at": now,
+            "updated_at": now,
+        }
+
+    def _compress(self, session: Dict[str, Any]) -> None:
+        archived = session["messages"][:-self.retain_recent]
+        if not archived:
+            return
+        user_points = [item["content"] for item in archiv
```

**File**: `services/evaluation_repository.py` (modified, +36/-2)
```diff
@@ -19,13 +19,15 @@ def __init__(self, base_dir: Path | None = None) -> None:
     def create_run(self, run_type: str, payload: Dict[str, Any], results: Dict[str, Any]) -> Dict[str, Any]:
         run_id = f"EV-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
         metrics = self._extract_metrics(run_type, results)
+        comparison = self._compare_with_baseline(run_type, metrics)
         record = {
             "run_id": run_id,
             "run_type": run_type,
             "created_at": datetime.now().isoformat(),
             "payload_summary": self._payload_summary(payload),
             "metrics": metrics,
-            "release_gate": self._release_gate(metrics),
+            "comparison": comparison,
+            "release_gate": self._release_gate(metrics, comparison),
             "results": results,
         }
         self._path(run_id).write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
@@ -46,6 +48,7 @@ def list_runs(self, limit: int = 20) -> List[Dict[str, Any]]:
                     "created_at": record.get("created_at"),
                     "payload_summary": record.get("payload_summary", {}),
                     "metrics": record.get("metrics", {}),
+                    "comparison": record.get("comparison", {}),
                     "release_gate": record.get("release_gate", {}),
                 }
             )
@@ -106,7 +109,34 @@ def _extract_metrics(self, run_type: str, results: Dict[str, Any]) -> Dict[str,
             "avg_latency_ms": metrics.get("avg_latency_ms"),
         }
 
-    def _release_gate(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
+    def _compare_with_baseline(self, run_type: str, metrics: Dict[str, Any]) -> Dict[str, Any]:
+        baseline = next((item for item in self.list_runs(limit=100) if item.get("run_type") == run_type), None)
+        if not baseline:
+            return {"baseline_run_id": None, "deltas": {}, "regressions": [], "status": "baseline_created"}
+        previous = baseline.get("metrics", {})
+        deltas: Dict[str, Any] = {}
+        regressions = []
+        for key in ("overall_score", "pass_rate"):
+            current_value = float(metrics.get(key) or 0)
+            previous_value = float(previous.get(key) or 0)
+            delta = round(current_value - previous_value, 4)
+            deltas[key] = delta
+            if previous_value and delta < -0.05:
+                regressions.append(f"{key} 较基线下降 {abs(delta):.1%}")
+        current_latency = metrics.get("avg_latency_ms")
+        previous_latency = previous.get("avg_latency_ms")
+        if isinstance(current_latency, (int, float)) and isinstance(previous_latency, (int, float)):
+            deltas["avg_latency_ms"] = round(float(current_latency) - float(previous_latency), 2)
+            if previous_latency and current_latency > previous_latency * 1.25:
+                regressions.append("平均延迟较基线上升超过 25%")
+        return {
+            "baseline_run_id": baseline.get("run_id"),
+            "deltas": deltas,
+            "regressions": regressions,
+            "status": "regression" if regressions else "stable",
+        }
+
+    def _release_gate(self, metrics: Dict[str, Any], comparison: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
         score = float(metrics.get("overall_score") or 0)
         pass_rate = float(metrics.get("pass_rate") or 0)
         regressions = int(metrics.get("regression_count") or 0)
@@ -117,6 +147,8 @@ def _release_gate(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
             blockers.append("通过率低于 70%。")
         if regressions > 0:
             blockers.append("存在需要处理的回归风险。")
+        if comparison and comparison.get("regressions"):
+            blockers.extend(comparison["regressions"])
         if not blockers:
             status = "pass"
             label = "可发布"
@@ -130,5 +162,7 @@ def _release_gate(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
             "status": status,
             "label": label,
             "blockers": blockers,
+            "baseline_run_id": (comparison or {}).get("baseline_run_id"),
+            "deltas": (comparison or {}).get("deltas", {}),
             "thresholds": {"overall_score": 0.75, "pass_rate": 0.7, "regression_count": 0},
         }
```

**File**: `services/intent_router.py` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+"""Deterministic hybrid intent routing for enterprise audit workflows.
+
+The router combines domain patterns with a local character n-gram similarity
+signal.  It remains available when no external model is configured and exposes
+the component scores so routing decisions are auditable.
+"""
+
+from __future__ import annotations
+
+import math
+import re
+from collections import Counter
+from dataclasses import dataclass
+from typing import Any, Dict, Iterable, List
+
+
+@dataclass(frozen=True)
+class IntentDefinition:
+    name: str
+    agent: str
+    keywords: tuple[str, ...]
+    examples: tuple[str, ...]
+
+
+INTENTS: tuple[IntentDefinition, ...] = (
+    IntentDefinition(
+        "scope_planning",
+        "planning_agent",
+        ("范围", "计划", "审计对象", "审计期间", "重点问题", "立项"),
+        ("为系统制定审计范围和执行计划", "如何启动一次审计项目"),
+    ),
+    IntentDefinition(
+        "evidence_analysis",
+        "evidence_agent",
+        ("证据", "取证", "日志", "样本", "底稿", "材料", "上传"),
+        ("分析审计证据并识别缺口", "需要收集哪些日志和审批材料"),
+    ),
+    IntentDefinition(
+        "control_testing",
+        "control_agent",
+        ("控制", "测试", "抽样", "穿行", "职责分离", "ITGC"),
+        ("设计控制测试和抽样程序", "检查职责分离控制是否有效"),
+    ),
+    IntentDefinition(
+        "risk_assessment",
+        "risk_agent",
+        ("风险", "异常", "高风险", "影响", "可能性", "缺陷"),
+        ("评估剩余风险和业务影响", "识别系统中的关键风险"),
+    ),
+    IntentDefinition(
+        "compliance_mapping",
+        "compliance_agent",
+        ("ISO27001", "SOX", "COBIT", "合规", "标准", "条款", "数据安全法"),
+        ("把审计事项映射到合规标准", "依据 ISO27001 检查访问控制"),
+    ),
+    IntentDefinition(
+        "finding_remediation",
+        "remediation_agent",
+        ("发现", "整改", "责任人", "到期", "关闭", "复核", "建议"),
+        ("形成审计发现并推进整改闭环", "如何验证整改是否可以关闭"),
+    ),
+    IntentDefinition(
+        "knowledge_query",
+        "research_agent",
+        ("什么是", "怎么做", "查询", "知识", "制度", "历史", "参考"),
+        ("查询制度知识和历史审计经验", "检索相关审计依据"),
+    ),
+)
+
+
+class HybridIntentRouter:
+    """Route audit requests with explainable pattern and semantic signals."""
+
+    pattern_weight = 0.62
+    semantic_weight = 0.38
+
+    def classify(self, message: str) -> Dict[str, Any]:
+        normalized = self._normalize(message)
+        scored: List[Dict[str, Any]] = []
+        for definition in INTENTS:
+            matched = [keyword for keyword in definition.keywords if keyword.lower() in normalized]
+            pattern = min(1.0, len(matched) / 2)
+            semantic = max(
+                (self._cosine(self._vector(normalized), self._vector(example)) for example in definition.examples),
+                default=0.0,
+            )
+            score = self.pattern_weight * pattern + self.semantic_weight * semantic
+            scored.append(
+                {
+                    "intent": definition.name,
+                    "agent": definition.agent,
+                    "score": round(score, 4),
+                    "signals": {"pattern": round(pattern, 4), "semantic": round(semantic, 4)},
+                    "matched_keywords": matched,
+                }
+            )
+
+        scored.sort(key=lambda item: item["score"], reverse=True)
+        primary = scored[0]
+        if primary["score"] < 0.14:
+            primary = {
+                "intent": "general_audit",
+                "agent": "audit_agent",
+                "score": 0.35,
+                "signals": {"pattern": 0.0, "semantic": 0.0},
+                "matched_keywords": [],
+            }
+
+        collaboration_floor = max(0.25, primary["score"] * 0.68)
+        selected = [
+            item for item in scored
+            if item["score"] >= collaboration_floor and item["intent"] != primary["intent"]
+        ][:2]
+        agents = [primary["agent"], *[item["agent"] for item in selected]]
+        confidence = min(0.98, 0.42 + primary["score"] * 0.54)
+        return {
+            "intent": primary["intent"],
+            "confidence": round(confidence, 3),
+            "urgency": self._urgency(message),
+            "agents": agents,
+            "multi_agent": len(agents) > 1,
+            "entities": self._entities(message),
+            "decision": primary,
+            "alternatives": scored[1:4],
+            "strategy": "pattern+local_ngram_similarity",
+        }
+
+    def _normalize(self, text: str) -> str:
+        return re.sub(r"\s+", "", text.lower())
+
+    def _vector(self, text: str) -> Counter[str]:
+        compact = self._normalize(text)
+        features: Counter[str] = Counter()
+        for token in re.findall(r"[a-z0-9_]+|[\u4e00-\u9fff]", compact):
+            features[f"t:{token}"] += 1
+        for size in (2, 3):
+            for index in range(max(0, len(compact) - size + 1)):
+                features[f"g{size}:{compact[index:index + size]}"] += 1
+        return features
+
+    def _cosine(self, left: Counter[str], right: Counter[str]) -> float:
+        if not left or not right:
+            retur
```

**File**: `services/skill_registry.py` (modified, +109/-5)
```diff
@@ -6,9 +6,10 @@
 import statistics
 import time
 import uuid
+from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
 from dataclasses import dataclass
 from datetime import datetime
-from typing import Any, Callable, Dict, List
+from typing import Any, Callable, Dict, List, Tuple
 
 from config import PATHS
 
@@ -22,13 +23,19 @@ class Skill:
     permissions: List[str]
     handler: Callable[[Dict[str, Any]], Dict[str, Any]]
     version: str = "1.1.0"
+    timeout_seconds: float = 8.0
+    cache_ttl_seconds: int = 0
+    failure_threshold: int = 3
 
 
 class SkillRegistry:
     def __init__(self) -> None:
         self.skills: Dict[str, Skill] = {}
         self.log_file = PATHS["data"] / "skill_runs" / "runs.jsonl"
         self.log_file.parent.mkdir(parents=True, exist_ok=True)
+        self._executor = ThreadPoolExecutor(max_workers=6, thread_name_prefix="audit-skill")
+        self._cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
+        self._circuits: Dict[str, Dict[str, Any]] = {}
         self._register_builtin_skills()
 
     def list_skills(self) -> List[Dict[str, Any]]:
@@ -40,7 +47,14 @@ def mcp_tools(self) -> List[Dict[str, Any]]:
                 "name": skill.name,
                 "description": skill.description,
                 "inputSchema": skill.input_schema,
-                "annotations": {"title": skill.title, "permissions": skill.permissions, "version": skill.version},
+                "annotations": {
+                    "title": skill.title,
+                    "permissions": skill.permissions,
+                    "version": skill.version,
+                    "timeoutSeconds": skill.timeout_seconds,
+                    "cacheTtlSeconds": skill.cache_ttl_seconds,
+                    "failureThreshold": skill.failure_threshold,
+                },
             }
             for skill in self.skills.values()
         ]
@@ -53,13 +67,44 @@ def execute(self, name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
         started = datetime.now().isoformat()
         start_monotonic = time.perf_counter()
         error_type = ""
-        try:
-            result = skill.handler(payload)
+        cache_hit = False
+        validation_errors = self._validate(payload, skill.input_schema)
+        circuit = self._circuits.setdefault(name, {"failures": 0, "state": "closed", "open_until": 0.0})
+        cache_key = self._cache_key(name, payload)
+
+        if validation_errors:
+            result = {"error": "input validation failed", "details": validation_errors}
+            status = "failed"
+            error_type = "InputValidationError"
+        elif circuit["state"] == "open" and time.time() < float(circuit["open_until"]):
+            result = {"error": "tool circuit is open", "retry_after": round(float(circuit["open_until"]) - time.time(), 2)}
+            status = "failed"
+            error_type = "CircuitOpenError"
+        elif self._cached(cache_key):
+            result = self._cache[cache_key][1]
             status = "success"
+            cache_hit = True
+        else:
+            if circuit["state"] == "open":
+                circuit["state"] = "half_open"
+        try:
+            if not validation_errors and not cache_hit and error_type != "CircuitOpenError":
+                future = self._executor.submit(skill.handler, payload)
+                result = future.result(timeout=skill.timeout_seconds)
+                status = "success"
+                circuit.update({"failures": 0, "state": "closed", "open_until": 0.0})
+                if skill.cache_ttl_seconds > 0:
+                    self._cache[cache_key] = (time.time() + skill.cache_ttl_seconds, result)
+        except FutureTimeoutError:
+            result = {"error": f"tool execution exceeded {skill.timeout_seconds}s"}
+            status = "failed"
+            error_type = "ToolTimeoutError"
+            self._record_failure(skill, circuit)
         except Exception as exc:
             result = {"error": str(exc)}
             status = "failed"
             error_type = exc.__class__.__name__
+            self._record_failure(skill, circuit)
         finished = datetime.now().isoformat()
         duration_ms = round((time.perf_counter() - start_monotonic) * 1000, 2)
         input_size = len(json.dumps(payload, ensure_ascii=False, default=str))
@@ -77,8 +122,12 @@ def execute(self, name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
             "output_size": output_size,
             "error_type": error_type,
             "estimated_cost": 0,
+            "cache_hit": cache_hit,
+            "circuit_state": circuit["state"],
+            "validation_errors": validation_errors,
         }
-        self.log_file.open("a", encoding="utf-8").write(json.dumps(record, ensure_ascii=False) + "\n")
+        with self.log_file.open("a", encoding="utf-8") as stream:
+            stream.write(json.dumps(record, ensure_ascii=False) + "\n")
         return record
 

```

**File**: `tests/test_agent_platform.py` (added, +117/-0)
```diff
@@ -0,0 +1,117 @@
+from __future__ import annotations
+
+import tempfile
+import unittest
+from pathlib import Path
+
+from services.agent_runtime import AgentRuntime
+from services.conversation_memory import ConversationMemory
+from services.evaluation_repository import EvaluationRunRepository
+from services.intent_router import HybridIntentRouter
+from services.safety_gate import SafetyGate
+from services.skill_registry import Skill, SkillRegistry
+
+
+class IntentRouterTests(unittest.TestCase):
+    def test_routes_cross_domain_request_to_specialists(self) -> None:
+        result = HybridIntentRouter().classify("请分析 ERP 权限日志证据，识别高风险并生成整改计划")
+        self.assertIn(result["intent"], {"evidence_analysis", "risk_assessment", "finding_remediation"})
+        self.assertGreater(result["confidence"], 0.5)
+        self.assertTrue(result["agents"])
+        self.assertIn("ERP", " ".join(result["entities"]["systems"]).upper())
+
+
+class ConversationMemoryTests(unittest.TestCase):
+    def test_compacts_working_memory_and_builds_profile(self) -> None:
+        with tempfile.TemporaryDirectory() as tmp:
+            memory = ConversationMemory(Path(tmp), compress_at=6, retain_recent=2)
+            for index in range(3):
+                memory.record_turn(
+                    "audit-session",
+                    f"第{index}轮：检查 ERP 权限，参考 ISO27001",
+                    "已记录证据和控制测试要求。",
+                    {"intent": "control_testing", "agents": ["control_agent"]},
+                )
+            session = memory.get_session("audit-session")
+            self.assertIsNotNone(session)
+            assert session is not None
+            self.assertEqual(len(session["messages"]), 2)
+            self.assertEqual(len(session["episodes"]), 1)
+            self.assertIn("ISO27001", session["profile"]["standards"])
+            context = memory.context_for("audit-session", "继续检查权限证据")
+            self.assertIn("会话摘要", context["prompt_text"])
+
+
+class SkillRegistryTests(unittest.TestCase):
+    def test_validation_cache_and_runtime_reflection(self) -> None:
+        with tempfile.TemporaryDirectory() as tmp:
+            registry = SkillRegistry()
+            registry.log_file = Path(tmp) / "runs.jsonl"
+            calls = {"count": 0}
+
+            def handler(payload):
+                calls["count"] += 1
+                return {"value": payload["value"]}
+
+            registry._register(
+                Skill(
+                    name="test.cached",
+                    title="测试缓存",
+                    description="验证输入治理和 TTL 缓存。",
+                    input_schema={
+                        "type": "object",
+                        "properties": {"value": {"type": "string"}},
+                        "required": ["value"],
+                    },
+                    permissions=["read:test"],
+                    handler=handler,
+                    cache_ttl_seconds=60,
+                )
+            )
+            invalid = registry.execute("test.cached", {})
+            self.assertEqual(invalid["error_type"], "InputValidationError")
+            first = registry.execute("test.cached", {"value": "ok"})
+            second = registry.execute("test.cached", {"value": "ok"})
+            self.assertEqual(first["status"], "success")
+            self.assertTrue(second["cache_hit"])
+            self.assertEqual(calls["count"], 1)
+
+            runtime = AgentRuntime(registry, SafetyGate())
+            runtime.runtime_dir = Path(tmp) / "runtime"
+            runtime.runtime_dir.mkdir()
+            task = runtime.create_task("生成 ERP 权限审计计划", {"audit_item": "ERP 权限"})
+            self.assertTrue(task["reflections"])
+            self.assertIn(task["reflections"][0]["verdict"], {"pass", "review"})
+
+
+class EvaluationRepositoryTests(unittest.TestCase):
+    def test_compares_new_run_with_previous_baseline(self) -> None:
+        with tempfile.TemporaryDirectory() as tmp:
+            repository = EvaluationRunRepository(Path(tmp))
+            baseline = {
+                "overall_metrics": {
+                    "overall_score": 0.86,
+                    "total_tests": 5,
+                    "pass_rate": 0.8,
+                    "regression_count": 0,
+                    "avg_latency_ms": 800,
+                }
+            }
+            repository.create_run("agent", {}, baseline)
+            current = {
+                "overall_metrics": {
+                    "overall_score": 0.72,
+                    "total_tests": 5,
+                    "pass_rate": 0.6,
+                    "regression_count": 0,
+                    "avg_latency_ms": 1200,
+                }
+            }
+            run = repository.create_run("agent", {}, current)
+            self.assertEqual(run["comparison"]["status"], "regression")
+            self.assertEqual(run["release_gate"]["status"], "review")
+            self.assertTrue(run["release_gate"]["blockers"])
+
+
+if __name__ == "__main__":
+    unit
```

**File**: `web/main.py` (modified, +66/-5)
```diff
@@ -24,8 +24,10 @@
 from services.audit_delivery import AuditDeliveryService
 from services.audit_repository import AuditRunRepository
 from services.audit_templates import list_audit_templates
+from services.conversation_memory import ConversationMemory
 from services.evaluation_repository import EvaluationRunRepository
 from services.evidence_analyzer import EvidenceAnalyzer
+from services.intent_router import HybridIntentRouter
 from services.product_insights import ProductInsights
 from services.rag_evaluator import RAGEvaluator
 from services.research_agent import AuditResearchAgent
@@ -47,6 +49,8 @@
 audit_delivery = AuditDeliveryService(audit_repository)
 evaluation_repository = EvaluationRunRepository()
 evidence_analyzer = EvidenceAnalyzer()
+conversation_memory = ConversationMemory()
+intent_router = HybridIntentRouter()
 
 
 @asynccontextmanager
@@ -66,7 +70,7 @@ async def lifespan(app: FastAPI):
 app = FastAPI(
     title="审脉 AuditPilot",
     description="面向审计交付场景的 Agentic RAG、风险评估、控制测试和整改闭环系统",
-    version="3.0.0",
+    version="4.0.0",
     lifespan=lifespan,
 )
 
@@ -88,6 +92,10 @@ class ChatRequest(BaseModel):
     context: Optional[Dict[str, Any]] = None
 
 
+class RoutePreviewRequest(BaseModel):
+    message: str = Field(..., min_length=1, max_length=8000)
+
+
 class AuditRequest(BaseModel):
     audit_item: str = Field(..., min_length=1, max_length=500)
     audit_type: str = Field(..., min_length=1, max_length=200)
@@ -242,8 +250,29 @@ async def skills_page(request: Request):
 @app.post("/api/chat")
 async def chat_api(request: ChatRequest, agent: AuditAgent = Depends(get_audit_agent)):
     session_id = request.session_id or str(uuid.uuid4())
-    result = agent.process_audit_query(request.message, session_id=session_id)
-    return {"success": True, "session_id": session_id, "timestamp": datetime.now().isoformat(), **result}
+    routing = intent_router.classify(request.message)
+    memory_context = conversation_memory.context_for(session_id, request.message)
+    if request.context:
+        memory_context["request_context"] = request.context
+        memory_context["prompt_text"] = (
+            f"{memory_context.get('prompt_text', '')}\n\n[请求上下文]\n"
+            f"{json.dumps(request.context, ensure_ascii=False)}"
+        ).strip()
+    result = agent.process_audit_query(request.message, session_id=session_id, external_context=memory_context)
+    memory = conversation_memory.record_turn(
+        session_id,
+        request.message,
+        result.get("response", ""),
+        {"intent": routing["intent"], "agents": routing["agents"]},
+    )
+    return {
+        "success": True,
+        "session_id": session_id,
+        "routing": routing,
+        "memory": memory,
+        "timestamp": datetime.now().isoformat(),
+        **result,
+    }
 
 
 @app.post("/api/audit")
@@ -431,6 +460,29 @@ async def agent_observability_api():
     return {"success": True, "observability": agent_runtime.observability(), "timestamp": datetime.now().isoformat()}
 
 
+@app.post("/api/agent/route")
+async def agent_route_preview_api(request: RoutePreviewRequest):
+    return {"success": True, "routing": intent_router.classify(request.message), "timestamp": datetime.now().isoformat()}
+
+
+@app.get("/api/memory/sessions")
+async def memory_sessions_api(limit: int = 20):
+    return {
+        "success": True,
+        "sessions": conversation_memory.list_sessions(limit),
+        "stats": conversation_memory.stats(),
+        "timestamp": datetime.now().isoformat(),
+    }
+
+
+@app.get("/api/memory/sessions/{session_id}")
+async def memory_session_detail_api(session_id: str):
+    session = conversation_memory.get_session(session_id)
+    if not session:
+        raise HTTPException(status_code=404, detail="会话记忆不存在")
+    return {"success": True, "session": session, "timestamp": datetime.now().isoformat()}
+
+
 @app.get("/api/audit/runs")
 async def audit_runs_api(limit: int = 20):
     return {"success": True, "runs": audit_repository.list_runs(limit=limit), "timestamp": datetime.now().isoformat()}
@@ -678,7 +730,14 @@ async def evaluation_run_detail_api(run_id: str):
 
 @app.get("/api/session/history/{session_id}")
 async def get_session_history(session_id: str, agent: AuditAgent = Depends(get_audit_agent)):
-    return {"success": True, "session_id": session_id, "history": agent.get_session_history(session_id), "timestamp": datetime.now().isoformat()}
+    persistent = conversation_memory.get_session(session_id)
+    return {
+        "success": True,
+        "session_id": session_id,
+        "history": agent.get_session_history(session_id),
+        "persistent_memory": persistent,
+        "timestamp": datetime.now().isoformat(),
+    }
 
 
 @app.get("/api/health")
@@ -691,12 +750,14 @@ async def health_check():
         "rag_documents": 0,
         "agent_runtime": True,
         "skills": len(skill_registry.skills),
+        "intent_router": True,
+        "memory": conversation_mem
```

---

### Incident Patch 2: `8d5118cb` (2026-06-16)
**Commit Message**: Persist evaluation runs and hide JD UI

**File**: `config.py` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ def _list_env(name: str, default: str = "") -> List[str]:
     "templates": PROJECT_ROOT / "templates",
     "uploads": PROJECT_ROOT / "data" / "uploads",
     "rag_store": PROJECT_ROOT / "data" / "rag_store",
+    "evaluation_runs": PROJECT_ROOT / "data" / "evaluation_runs",
 }
 
 for path in PATHS.values():
```

**File**: `services/evaluation_repository.py` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+"""Persistent evaluation run storage and release-gate decisions."""
+
+from __future__ import annotations
+
+import json
+import uuid
+from datetime import datetime
+from pathlib import Path
+from typing import Any, Dict, List, Optional
+
+from config import PATHS
+
+
+class EvaluationRunRepository:
+    def __init__(self, base_dir: Path | None = None) -> None:
+        self.base_dir = base_dir or PATHS["evaluation_runs"]
+        self.base_dir.mkdir(parents=True, exist_ok=True)
+
+    def create_run(self, run_type: str, payload: Dict[str, Any], results: Dict[str, Any]) -> Dict[str, Any]:
+        run_id = f"EV-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
+        metrics = self._extract_metrics(run_type, results)
+        record = {
+            "run_id": run_id,
+            "run_type": run_type,
+            "created_at": datetime.now().isoformat(),
+            "payload_summary": self._payload_summary(payload),
+            "metrics": metrics,
+            "release_gate": self._release_gate(metrics),
+            "results": results,
+        }
+        self._path(run_id).write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
+        return record
+
+    def list_runs(self, limit: int = 20) -> List[Dict[str, Any]]:
+        files = sorted(self.base_dir.glob("*.json"), key=lambda path: path.stat().st_mtime, reverse=True)
+        records = []
+        for path in files[: max(limit, 1)]:
+            try:
+                record = json.loads(path.read_text(encoding="utf-8"))
+            except (OSError, json.JSONDecodeError):
+                continue
+            records.append(
+                {
+                    "run_id": record.get("run_id"),
+                    "run_type": record.get("run_type"),
+                    "created_at": record.get("created_at"),
+                    "payload_summary": record.get("payload_summary", {}),
+                    "metrics": record.get("metrics", {}),
+                    "release_gate": record.get("release_gate", {}),
+                }
+            )
+        return records
+
+    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
+        path = self._path(run_id)
+        if not path.exists():
+            return None
+        try:
+            return json.loads(path.read_text(encoding="utf-8"))
+        except json.JSONDecodeError:
+            return None
+
+    def _path(self, run_id: str) -> Path:
+        safe_id = "".join(ch for ch in run_id if ch.isalnum() or ch in {"-", "_"})
+        return self.base_dir / f"{safe_id}.json"
+
+    def _payload_summary(self, payload: Dict[str, Any]) -> Dict[str, Any]:
+        cases = payload.get("test_cases") or payload.get("cases") or []
+        return {
+            "model_path": payload.get("model_path", "current-agent"),
+            "case_count": len(cases) if isinstance(cases, list) else 0,
+            "customized": bool(cases),
+        }
+
+    def _extract_metrics(self, run_type: str, results: Dict[str, Any]) -> Dict[str, Any]:
+        if run_type == "rag":
+            total = int(results.get("total_cases") or 0)
+            regressions = sum(
+                1
+                for item in results.get("results", [])
+                for mode in item.get("failure_modes", [])
+                if "未发现" not in str(mode)
+            )
+            return {
+                "overall_score": float(results.get("overall_score") or 0),
+                "total_tests": total,
+                "pass_rate": round(sum(1 for item in results.get("results", []) if float(item.get("overall") or 0) >= 0.7) / total, 3) if total else 0,
+                "regression_count": regressions,
+                "avg_latency_ms": None,
+            }
+        if run_type == "research":
+            evaluation = results.get("evaluation", {})
+            return {
+                "overall_score": float(evaluation.get("faithfulness") or 0),
+                "total_tests": len(results.get("query_rewrites", [])),
+                "pass_rate": 0 if evaluation.get("requires_human_review") else 1,
+                "regression_count": 1 if evaluation.get("requires_human_review") else 0,
+                "avg_latency_ms": None,
+            }
+        metrics = results.get("overall_metrics", {})
+        return {
+            "overall_score": float(metrics.get("overall_score") or 0),
+            "total_tests": int(metrics.get("total_tests") or 0),
+            "pass_rate": float(metrics.get("pass_rate") or 0),
+            "regression_count": int(metrics.get("regression_count") or 0),
+            "avg_latency_ms": metrics.get("avg_latency_ms"),
+        }
+
+    def _release_gate(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
+        score = float(metrics.get("overall_score") or 0)
+        pass_rate = float(metrics.get("pass_rate") or 0)
+        regressions = int(metrics.get("regression_count") or 0)
+        blockers = []
+        if score < 0.75:

```

**File**: `static/training.js` (modified, +48/-44)
```diff
@@ -180,6 +180,39 @@ function renderRagResults(results) {
   (results.closed_loop_suggestions || []).forEach((text) => node.appendChild(el("div", { class: "item compact" }, [el("strong", { text: "闭环建议" }), el("p", { class: "muted", text })])));
 }
 
+function renderRunGate(run) {
+  const gate = run.release_gate || {};
+  const status = gate.status || "review";
+  const cls = status === "pass" ? "pass" : status === "blocked" ? "blocked" : "review";
+  return el("span", { class: `badge ${cls}`, text: gate.label || "需复核" });
+}
+
+function renderEvaluationRuns(runs) {
+  const node = qs("#evaluationRuns");
+  clearNode(node);
+  if (!runs.length) {
+    node.appendChild(el("p", { class: "muted", text: "暂无评测记录。" }));
+    return;
+  }
+  runs.forEach((run) => {
+    const metrics = run.metrics || {};
+    const gate = run.release_gate || {};
+    node.appendChild(el("div", { class: "item eval-card" }, [
+      el("div", { class: "item-head" }, [
+        el("strong", { text: `${run.run_id} · ${run.run_type}` }),
+        renderRunGate(run),
+      ]),
+      el("div", { class: "trace-summary" }, [
+        el("span", { text: `得分 ${scoreText(metrics.overall_score)}` }),
+        el("span", { text: `通过率 ${percentText(metrics.pass_rate)}` }),
+        el("span", { text: `回归 ${metrics.regression_count ?? 0}` }),
+        el("span", { text: run.created_at || "" }),
+      ]),
+      el("p", { class: "muted", text: (gate.blockers || []).join("；") || "满足当前发布门禁。" }),
+    ]));
+  });
+}
+
 function avg(values) {
   const clean = values.filter((item) => item !== undefined && item !== null);
   return clean.length ? clean.reduce((sum, item) => sum + Number(item), 0) / clean.length : null;
@@ -231,33 +264,6 @@ function renderEvaluationPlan(plan) {
   }
 }
 
-function renderJdCoverage(coverage) {
-  const node = qs("#jdCoverage");
-  clearNode(node);
-  node.appendChild(el("div", { class: "item compact" }, [
-    el("strong", { text: "来源" }),
-    el("p", { class: "muted", text: coverage.source || "" }),
-  ]));
-  (coverage.official_tencent_posts || []).forEach((post) => {
-    node.appendChild(el("div", { class: "item eval-card" }, [
-      el("div", { class: "item-head" }, [
-        el("strong", { text: post.post }),
-        el("span", { class: "badge", text: post.updated }),
-      ]),
-      el("p", { class: "muted", text: `PostId: ${post.post_id}` }),
-      el("div", { class: "tag-row" }, (post.requirements || []).map((item) => el("span", { class: "badge", text: item }))),
-    ]));
-  });
-  (coverage.capabilities || []).forEach((capability) => {
-    node.appendChild(el("div", { class: "item eval-card" }, [
-      el("strong", { text: capability.jd_requirement }),
-      el("p", { class: "muted", text: `已实现：${(capability.implemented || []).join(" / ")}` }),
-      el("p", { class: "muted", text: `产品入口：${(capability.project_surface || []).join(" / ")}` }),
-      el("p", { class: "muted", text: `下一步：${capability.next_step || ""}` }),
-    ]));
-  });
-}
-
 async function runAgentEval(cases) {
   setBusy("Agent 评测运行中...");
   const data = await apiFetch("/api/training/evaluate", {
@@ -266,6 +272,7 @@ async function runAgentEval(cases) {
     body: JSON.stringify({ model_path: "current-agent", test_cases: cases }),
   });
   renderEvalResults(data.results);
+  await loadEvaluationRuns();
 }
 
 async function runRagEval(cases) {
@@ -276,6 +283,7 @@ async function runRagEval(cases) {
     body: JSON.stringify({ cases }),
   });
   renderRagResults(data.results);
+  await loadEvaluationRuns();
 }
 
 async function runResearchEval() {
@@ -284,9 +292,10 @@ async function runResearchEval() {
   const data = await apiFetch("/api/research/answer", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
-    body: JSON.stringify({ question: testCase.question, context: { standard_type: qs("#caseCategory").value } }),
+    body: JSON.stringify({ question: testCase.question, context: { standard_type: qs("#caseCategory").value }, persist_evaluation: true }),
   });
   renderResearch(data.result);
+  await loadEvaluationRuns();
 }
 
 async function loadEvaluationPlan() {
@@ -299,12 +308,15 @@ async function loadEvaluationPlan() {
   }
 }
 
-async function loadJdCoverage() {
-  const node = qs("#jdCoverage");
-  clearNode(node);
-  node.appendChild(el("p", { class: "muted", text: "正在加载 JD 能力覆盖..." }));
-  const data = await apiFetch("/api/research/jd-coverage");
-  renderJdCoverage(data.coverage || {});
+async function loadEvaluationRuns() {
+  try {
+    const data = await apiFetch("/api/evaluation/runs?limit=12");
+    renderEvaluationRuns(data.runs || []);
+  } catch (error) {
+    const node = qs("#evaluationRuns");
+    clearNode(node);
+    node.appendChild(el("p", { class: "muted", text: `评测历史加载失败：${error.message}` }));
+  }
 }
 
 function setMode(mode) {
@@ -316,6 +328,7 @@ function bindTrainingPage() {
   renderMetricToggles();
   renderCustomCases();
   loadEvaluationPlan();
+  loadEvaluationRuns()
```

**File**: `templates/training.html` (modified, +4/-5)
```diff
@@ -41,7 +41,7 @@ <h2 class="hero-title">&#20174;&#8220;&#33021;&#22238;&#31572;&#8221;&#21319;&#3
             <button class="btn primary" id="runEval">&#36816;&#34892; Agent &#35780;&#20272;</button>
             <button class="btn" id="runRagEval">RAG &#35780;&#27979;</button>
             <button class="btn" id="runResearchEval">Deep Research</button>
-            <button class="btn" id="loadJdCoverage">JD &#33021;&#21147;&#35206;&#30422;</button>
+            <button class="btn" id="refreshEvalRuns">&#21047;&#26032;&#35780;&#27979;&#21382;&#21490;</button>
           </div>
         </div>
         <aside class="panel">
@@ -68,7 +68,6 @@ <h2 class="panel-title">&#35780;&#27979;&#22330;&#26223;&#35774;&#35745;</h2>
               <button class="seg active" data-mode="agent">Agent</button>
               <button class="seg" data-mode="rag">RAG</button>
               <button class="seg" data-mode="research">Research</button>
-              <button class="seg" data-mode="jd">JD</button>
             </div>
           </div>
           <div class="grid grid-3">
@@ -99,7 +98,7 @@ <h2 class="panel-title">&#33258;&#23450;&#20041;&#29992;&#20363;&#38598;</h2>
         <div class="card metric"><div class="metric-value" id="toolScore">-</div><div class="metric-label">Tool / Trace</div></div>
         <div class="card metric"><div class="metric-value" id="authorityScore">-</div><div class="metric-label">&#26435;&#23041;&#24615;</div></div>
         <div class="card metric"><div class="metric-value" id="latencyScore">-</div><div class="metric-label">&#24179;&#22343;&#32791;&#26102;</div></div>
-        <div class="card metric"><div class="metric-value">2.6.0</div><div class="metric-label">&#35780;&#27979;&#29256;&#26412;</div></div>
+        <div class="card metric"><div class="metric-value">2.7.0</div><div class="metric-label">&#35780;&#27979;&#29256;&#26412;</div></div>
       </section>
 
       <section class="grid layout-2 mt-16">
@@ -114,8 +113,8 @@ <h2 class="panel-title">&#25351;&#26631;&#26706;&#26550;</h2>
       </section>
 
       <section class="panel mt-16">
-        <h2 class="panel-title">&#33150;&#35759;&#12289;&#23383;&#33410;&#31561; Agent JD &#33021;&#21147;&#35206;&#30422;</h2>
-        <div id="jdCoverage" class="list dense"><p class="muted">&#28857;&#20987; JD &#33021;&#21147;&#35206;&#30422;&#21518;&#23637;&#31034;&#26469;&#28304;&#12289;&#35201;&#27714;&#19982;&#39033;&#30446;&#23545;&#24212;&#12290;</p></div>
+        <h2 class="panel-title">&#35780;&#27979;&#21382;&#21490;&#19982;&#21457;&#24067;&#38376;&#31105;</h2>
+        <div id="evaluationRuns" class="list dense"><p class="muted">&#26242;&#26080;&#35780;&#27979;&#35760;&#24405;&#12290;</p></div>
       </section>
     </main>
   </div>
```

**File**: `web/main.py` (modified, +26/-5)
```diff
@@ -23,6 +23,7 @@
 from services.audit_delivery import AuditDeliveryService
 from services.audit_repository import AuditRunRepository
 from services.audit_templates import list_audit_templates
+from services.evaluation_repository import EvaluationRunRepository
 from services.product_insights import ProductInsights
 from services.rag_evaluator import RAGEvaluator
 from services.research_agent import AuditResearchAgent
@@ -39,6 +40,7 @@
 skill_registry = SkillRegistry()
 product_insights = ProductInsights(audit_repository, skill_registry)
 audit_delivery = AuditDeliveryService(audit_repository)
+evaluation_repository = EvaluationRunRepository()
 
 
 @asynccontextmanager
@@ -58,7 +60,7 @@ async def lifespan(app: FastAPI):
 app = FastAPI(
     title="审脉 AuditPilot",
     description="面向审计交付场景的 Agentic RAG、风险评估、控制测试和整改闭环系统",
-    version="2.6.0",
+    version="2.7.0",
     lifespan=lifespan,
 )
 
@@ -109,6 +111,7 @@ class RAGEvaluationRequest(BaseModel):
 class ResearchRequest(BaseModel):
     question: str = Field(..., min_length=1, max_length=8000)
     context: Optional[Dict[str, Any]] = None
+    persist_evaluation: bool = False
 
 
 class SkillRunRequest(BaseModel):
@@ -277,7 +280,10 @@ async def agent_capabilities_api():
 @app.post("/api/research/answer")
 async def research_answer_api(request: ResearchRequest, research: AuditResearchAgent = Depends(get_research_agent)):
     result = research.answer(request.question, request.context)
-    return {"success": True, "result": result, "timestamp": datetime.now().isoformat()}
+    run = None
+    if request.persist_evaluation:
+        run = evaluation_repository.create_run("research", request.model_dump(), result)
+    return {"success": True, "result": result, "run": run, "timestamp": datetime.now().isoformat()}
 
 
 @app.get("/api/research/jd-coverage")
@@ -500,13 +506,28 @@ async def knowledge_stats_api(rag=Depends(get_rag_pipeline)):
 async def evaluate_model_api(request: EvaluationRequest, benchmark=Depends(get_evaluator)):
     test_cases = request.test_cases or benchmark.create_test_cases()
     results = benchmark.evaluate_agent(test_cases)
-    return {"success": True, "results": results, "timestamp": datetime.now().isoformat()}
+    run = evaluation_repository.create_run("agent", request.model_dump(), results)
+    return {"success": True, "run": run, "results": results, "timestamp": datetime.now().isoformat()}
 
 
 @app.post("/api/evaluation/rag")
 async def evaluate_rag_api(request: RAGEvaluationRequest, rag=Depends(get_rag_pipeline)):
     results = RAGEvaluator(rag).evaluate(request.cases)
-    return {"success": True, "results": results, "timestamp": datetime.now().isoformat()}
+    run = evaluation_repository.create_run("rag", request.model_dump(), results)
+    return {"success": True, "run": run, "results": results, "timestamp": datetime.now().isoformat()}
+
+
+@app.get("/api/evaluation/runs")
+async def evaluation_runs_api(limit: int = 20):
+    return {"success": True, "runs": evaluation_repository.list_runs(limit), "timestamp": datetime.now().isoformat()}
+
+
+@app.get("/api/evaluation/runs/{run_id}")
+async def evaluation_run_detail_api(run_id: str):
+    record = evaluation_repository.get_run(run_id)
+    if not record:
+        raise HTTPException(status_code=404, detail="评测记录不存在")
+    return {"success": True, "run": record, "timestamp": datetime.now().isoformat()}
 
 
 @app.get("/api/session/history/{session_id}")
@@ -521,7 +542,7 @@ async def health_check():
         services.update(audit_agent.get_service_status())
     if rag_pipeline is not None:
         services["rag_documents"] = rag_pipeline.get_statistics().get("total_documents", 0)
-    return JSONResponse(content={"status": "healthy", "timestamp": datetime.now().isoformat(), "version": "2.6.0", "services": services})
+    return JSONResponse(content={"status": "healthy", "timestamp": datetime.now().isoformat(), "version": "2.7.0", "services": services})
 
 
 if __name__ == "__main__":
```

---

### Incident Patch 3: `cb3babd8` (2026-06-16)
**Commit Message**: Fix audit workspace interactions

**File**: `agents/audit_agent.py` (modified, +2/-0)
```diff
@@ -535,6 +535,8 @@ def _assess_risk(
         evidence_boost = 0.03 if (retrieved.get("rag") or {}).get("confidence", 0) > 0.5 else 0
         raw_score = min(sum(scores) / len(scores) + evidence_boost, 1.0)
         residual_score = max(raw_score - control_reduction / 2, 0.05)
+        if requested_high:
+            residual_score = max(residual_score, AUDIT_CONFIG["risk_threshold_high"])
         high = AUDIT_CONFIG["risk_threshold_high"]
         medium = AUDIT_CONFIG["risk_threshold_medium"]
         risk_level = "高" if residual_score >= high else "中" if residual_score >= medium else "低"
```

**File**: `scripts/render_audit_page.py` (modified, +7/-35)
```diff
@@ -61,6 +61,7 @@ def write() -> None:
           <div class="toolbar mt-16">
             <button class="btn primary" id="runAudit">{ent('运行 Agent 审计')}</button>
             <button class="btn" id="loadControls">{ent('查看控制库')}</button>
+            <button class="btn" id="runResearch">{ent('Deep Research')}</button>
             <a class="btn" id="downloadReport" href="#" target="_blank">{ent('下载报告')}</a>
             <a class="btn" id="downloadDelivery" href="#" target="_blank">{ent('下载交付包')}</a>
           </div>
@@ -86,6 +87,11 @@ def write() -> None:
         <div class="panel"><h2 class="panel-title">{ent('质量门')}</h2><div id="qualityPanel" class="muted">{ent('等待结果')}</div></div>
       </section>
 
+      <section class="panel mt-16">
+        <h2 class="panel-title">{ent('Deep Research 推理')}</h2>
+        <div id="researchPanel" class="list dense"><p class="muted">{ent('点击 Deep Research 后展示查询改写、来源融合、推理轨迹和答案评测。')}</p></div>
+      </section>
+
       <section class="panel mt-16">
         <h2 class="panel-title">{ent('审计交付包预览')}</h2>
         <div id="deliveryPreview" class="delivery-grid"><p class="muted">{ent('选择或运行审计档案后展示底稿、证据、访谈、现场日程和复核轨迹。')}</p></div>
@@ -114,41 +120,7 @@ def write() -> None:
     </main>
   </div>
   <script src="../static/app.js"></script>
-  <script>
-    let currentRunId = null;
-    function statusBadge(status) {{ return el("span", {{ class: `badge ${{status}}`, text: status || "-" }}); }}
-    function renderTrace(trace) {{ const node = qs("#tracePanel"); clearNode(node); (trace || []).forEach((item) => node.appendChild(el("div", {{ class: "trace-item" }}, [el("div", {{ class: "trace-stage", text: item.stage }}), el("div", {{}}, [el("strong", {{ text: item.status }}), el("div", {{ class: "muted", text: item.detail || "" }})])]))) ; if (!node.childElementCount) node.appendChild(el("p", {{ class: "muted", text: "暂无执行轨迹" }})); }}
-    function renderTaskPlan(tasks) {{ const node = qs("#taskPlan"); clearNode(node); (tasks || []).forEach((task, index) => node.appendChild(el("div", {{ class: "timeline-step" }}, [el("div", {{ class: "step-index", text: String(index + 1) }}), el("div", {{ class: "item compact" }}, [el("strong", {{ text: task.name }}), el("div", {{ class: "muted", text: task.objective }}), el("div", {{ class: "mt-12", text: `负责人：${{task.owner}}` }})])]))); }}
-    function renderEvidence(items) {{ const node = qs("#evidencePack"); clearNode(node); (items || []).forEach((item) => node.appendChild(el("div", {{ class: "item compact" }}, [el("strong", {{ text: `${{item.id}} · ${{item.source}}` }}), el("p", {{ class: "muted", text: item.summary }}), el("div", {{ text: `用途：${{item.usage}}` }})]))); }}
-    function renderQuality(quality) {{ const node = qs("#qualityPanel"); clearNode(node); const percent = Math.round((quality.confidence || 0) * 100); const ring = el("div", {{ class: "quality-ring" }}, [el("span", {{ text: `${{percent}}%` }})]); ring.style.setProperty("--score", percent); node.appendChild(el("div", {{ class: "quality" }}, [ring, el("div", {{}}, [statusBadge(quality.status || "review"), el("p", {{ class: "muted", text: quality.review_note || "" }}), el("div", {{ text: `证据扎实度：${{quality.groundedness || 0}} · 控制覆盖：${{quality.control_coverage || 0}}` }}), el("div", {{ class: "mt-12 muted", text: `缺失证据：${{(quality.missing_evidence || []).join("、") || "无"}}` }})])]))); }}
-    function renderMatrix(rows) {{ const node = qs("#controlMatrix"); clearNode(node); const table = el("table"); table.appendChild(el("thead", {{}}, [el("tr", {{}}, ["控制", "领域", "测试程序", "证据要求", "成熟度", "状态"].map((text) => el("th", {{ text }})))])); const body = el("tbody"); (rows || []).forEach((row) => body.appendChild(el("tr", {{}}, [el("td", {{ text: row.control_id || row.id }}), el("td", {{ text: row.domain }}), el("td", {{ text: row.test_procedure || row.objective }}), el("td", {{ text: (row.evidence_required || []).join("、") }}), el("td", {{ text: String(row.maturity_level ?? "-") }}), el("td", {{ text: row.status || "" }})]))); table.appendChild(body); node.appendChild(table); }}
-    function renderAuditProgram(items) {{ const node = qs("#auditProgram"); clearNode(node); if (!(items || []).length) return node.appendChild(el("p", {{ class: "muted", text: "暂无审计程序" }})); items.forEach((item) => node.appendChild(el("div", {{ class: "item compact" }}, [el("strong", {{ text: `${{item.step_id}} · ${{item.control_id}}` }}), el("div", {{ class: "muted", text: item.procedure }}), el("div", {{ class: "mt-12", text: `认定：${{item.assertion}}` }}), el("div", {{ class: "muted", text: `底稿：${{item.workpaper_ref}}` }})]))); }}
-    function renderSamplingPlan(plan) {{ const node = qs("#samplingPlan"); clearNode(node); if (!plan || !plan.population) return node.appendChild(el("p", {{ class: "muted", text: "暂无抽样计划" }})); [["总体", plan.population], ["期间", plan.period], ["方法", plan.method], ["样本量", plan.sample_size], ["分层", (plan.strata || []).join("、")], ["例外处理", plan.exception_handling]].forEach(([label, v
```

**File**: `static/audit.js` (added, +423/-0)
```diff
@@ -0,0 +1,423 @@
+let currentRunId = null;
+
+function badge(status) {
+  return el("span", { class: `badge ${status || ""}`, text: status || "-" });
+}
+
+function renderTrace(trace) {
+  const node = qs("#tracePanel");
+  clearNode(node);
+  (trace || []).forEach((item) => {
+    node.appendChild(el("div", { class: "trace-item" }, [
+      el("div", { class: "trace-stage", text: item.stage }),
+      el("div", {}, [el("strong", { text: item.status }), el("div", { class: "muted", text: item.detail || "" })]),
+    ]));
+  });
+  if (!node.childElementCount) node.appendChild(el("p", { class: "muted", text: "暂无执行轨迹" }));
+}
+
+function renderTaskPlan(tasks) {
+  const node = qs("#taskPlan");
+  clearNode(node);
+  (tasks || []).forEach((task, index) => {
+    node.appendChild(el("div", { class: "timeline-step" }, [
+      el("div", { class: "step-index", text: String(index + 1) }),
+      el("div", { class: "item compact" }, [
+        el("strong", { text: task.name }),
+        el("div", { class: "muted", text: task.objective }),
+        el("div", { class: "mt-12", text: `负责人：${task.owner}` }),
+      ]),
+    ]));
+  });
+}
+
+function renderEvidence(items) {
+  const node = qs("#evidencePack");
+  clearNode(node);
+  (items || []).forEach((item) => {
+    node.appendChild(el("div", { class: "item compact" }, [
+      el("strong", { text: `${item.id} · ${item.source}` }),
+      el("p", { class: "muted", text: item.summary }),
+      el("div", { text: `用途：${item.usage}` }),
+    ]));
+  });
+}
+
+function renderQuality(quality) {
+  const node = qs("#qualityPanel");
+  clearNode(node);
+  const percent = Math.round((quality.confidence || 0) * 100);
+  const ring = el("div", { class: "quality-ring" }, [el("span", { text: `${percent}%` })]);
+  ring.style.setProperty("--score", percent);
+  node.appendChild(el("div", { class: "quality" }, [
+    ring,
+    el("div", {}, [
+      badge(quality.status || "review"),
+      el("p", { class: "muted", text: quality.review_note || "" }),
+      el("div", { text: `证据扎实度：${quality.groundedness || 0} · 控制覆盖：${quality.control_coverage || 0}` }),
+      el("div", { class: "mt-12 muted", text: `缺失证据：${(quality.missing_evidence || []).join("、") || "无"}` }),
+    ]),
+  ]));
+}
+
+function renderMatrix(rows) {
+  const node = qs("#controlMatrix");
+  clearNode(node);
+  const table = el("table");
+  table.appendChild(el("thead", {}, [el("tr", {}, ["控制", "领域", "测试程序", "证据要求", "成熟度", "状态"].map((text) => el("th", { text })))]));
+  const body = el("tbody");
+  (rows || []).forEach((row) => {
+    body.appendChild(el("tr", {}, [
+      el("td", { text: row.control_id || row.id }),
+      el("td", { text: row.domain }),
+      el("td", { text: row.test_procedure || row.objective || "" }),
+      el("td", { text: (row.evidence_required || []).join("、") }),
+      el("td", { text: String(row.maturity_level ?? "-") }),
+      el("td", { text: row.status || "" }),
+    ]));
+  });
+  table.appendChild(body);
+  node.appendChild(table);
+}
+
+function renderListCard(node, items, emptyText, build) {
+  clearNode(node);
+  if (!(items || []).length) {
+    node.appendChild(el("p", { class: "muted", text: emptyText }));
+    return;
+  }
+  items.forEach((item) => node.appendChild(build(item)));
+}
+
+function renderAuditProgram(items) {
+  renderListCard(qs("#auditProgram"), items, "暂无审计程序", (item) => el("div", { class: "item compact" }, [
+    el("strong", { text: `${item.step_id} · ${item.control_id}` }),
+    el("div", { class: "muted", text: item.procedure }),
+    el("div", { class: "mt-12", text: `认定：${item.assertion}` }),
+    el("div", { class: "muted", text: `底稿：${item.workpaper_ref}` }),
+  ]));
+}
+
+function renderSamplingPlan(plan) {
+  const node = qs("#samplingPlan");
+  clearNode(node);
+  if (!plan || !plan.population) {
+    node.appendChild(el("p", { class: "muted", text: "暂无抽样计划" }));
+    return;
+  }
+  [["总体", plan.population], ["期间", plan.period], ["方法", plan.method], ["样本量", plan.sample_size], ["分层", (plan.strata || []).join("、")], ["例外处理", plan.exception_handling]].forEach(([label, value]) => {
+    node.appendChild(el("div", { class: "item compact" }, [el("strong", { text: label }), el("div", { class: "muted", text: String(value || "") })]));
+  });
+}
+
+function renderFindings(items) {
+  renderListCard(qs("#findings"), items, "当前未形成重大审计发现草稿", (finding) => el("div", { class: "card" }, [
+    el("strong", { text: `${finding.finding_id} · ${finding.title}` }),
+    el("p", { class: "muted", text: `严重程度：${finding.severity}` }),
+    el("div", { text: finding.condition }),
+    el("p", { class: "muted", text: `影响：${finding.effect || ""}` }),
+    el("div", { text: `建议：${finding.recommendation}` }),
+  ]));
+}
+
+function renderRecommendations(items) {
+  renderListCard(qs("#recommendations"), items, "暂无整改建议", (rec) => el("div", { class: "card" }, [
+    el("strong", { text: `${rec.type} · ${rec.priority}` }),
+    el("p", { class: "muted", text: rec.descript
```

**File**: `templates/audit.html` (modified, +7/-35)
```diff
@@ -52,6 +52,7 @@ <h2 class="panel-title">&#23457;&#35745;&#25351;&#25381;&#26639;</h2>
           <div class="toolbar mt-16">
             <button class="btn primary" id="runAudit">&#36816;&#34892; Agent &#23457;&#35745;</button>
             <button class="btn" id="loadControls">&#26597;&#30475;&#25511;&#21046;&#24211;</button>
+            <button class="btn" id="runResearch">Deep Research</button>
             <a class="btn" id="downloadReport" href="#" target="_blank">&#19979;&#36733;&#25253;&#21578;</a>
             <a class="btn" id="downloadDelivery" href="#" target="_blank">&#19979;&#36733;&#20132;&#20184;&#21253;</a>
           </div>
@@ -77,6 +78,11 @@ <h2 class="panel-title">&#25191;&#34892;&#36712;&#36857;</h2>
         <div class="panel"><h2 class="panel-title">&#36136;&#37327;&#38376;</h2><div id="qualityPanel" class="muted">&#31561;&#24453;&#32467;&#26524;</div></div>
       </section>
 
+      <section class="panel mt-16">
+        <h2 class="panel-title">Deep Research &#25512;&#29702;</h2>
+        <div id="researchPanel" class="list dense"><p class="muted">&#28857;&#20987; Deep Research &#21518;&#23637;&#31034;&#26597;&#35810;&#25913;&#20889;&#12289;&#26469;&#28304;&#34701;&#21512;&#12289;&#25512;&#29702;&#36712;&#36857;&#21644;&#31572;&#26696;&#35780;&#27979;&#12290;</p></div>
+      </section>
+
       <section class="panel mt-16">
         <h2 class="panel-title">&#23457;&#35745;&#20132;&#20184;&#21253;&#39044;&#35272;</h2>
         <div id="deliveryPreview" class="delivery-grid"><p class="muted">&#36873;&#25321;&#25110;&#36816;&#34892;&#23457;&#35745;&#26723;&#26696;&#21518;&#23637;&#31034;&#24213;&#31295;&#12289;&#35777;&#25454;&#12289;&#35775;&#35848;&#12289;&#29616;&#22330;&#26085;&#31243;&#21644;&#22797;&#26680;&#36712;&#36857;&#12290;</p></div>
@@ -105,40 +111,6 @@ <h2 class="panel-title">&#23457;&#35745;&#20132;&#20184;&#21253;&#39044;&#35272;
     </main>
   </div>
   <script src="../static/app.js"></script>
-  <script>
-    let currentRunId = null;
-    function statusBadge(status) { return el("span", { class: `badge ${status}`, text: status || "-" }); }
-    function renderTrace(trace) { const node = qs("#tracePanel"); clearNode(node); (trace || []).forEach((item) => node.appendChild(el("div", { class: "trace-item" }, [el("div", { class: "trace-stage", text: item.stage }), el("div", {}, [el("strong", { text: item.status }), el("div", { class: "muted", text: item.detail || "" })])]))) ; if (!node.childElementCount) node.appendChild(el("p", { class: "muted", text: "暂无执行轨迹" })); }
-    function renderTaskPlan(tasks) { const node = qs("#taskPlan"); clearNode(node); (tasks || []).forEach((task, index) => node.appendChild(el("div", { class: "timeline-step" }, [el("div", { class: "step-index", text: String(index + 1) }), el("div", { class: "item compact" }, [el("strong", { text: task.name }), el("div", { class: "muted", text: task.objective }), el("div", { class: "mt-12", text: `负责人：${task.owner}` })])]))); }
-    function renderEvidence(items) { const node = qs("#evidencePack"); clearNode(node); (items || []).forEach((item) => node.appendChild(el("div", { class: "item compact" }, [el("strong", { text: `${item.id} · ${item.source}` }), el("p", { class: "muted", text: item.summary }), el("div", { text: `用途：${item.usage}` })]))); }
-    function renderQuality(quality) { const node = qs("#qualityPanel"); clearNode(node); const percent = Math.round((quality.confidence || 0) * 100); const ring = el("div", { class: "quality-ring" }, [el("span", { text: `${percent}%` })]); ring.style.setProperty("--score", percent); node.appendChild(el("div", { class: "quality" }, [ring, el("div", {}, [statusBadge(quality.status || "review"), el("p", { class: "muted", text: quality.review_note || "" }), el("div", { text: `证据扎实度：${quality.groundedness || 0} · 控制覆盖：${quality.control_coverage || 0}` }), el("div", { class: "mt-12 muted", text: `缺失证据：${(quality.missing_evidence || []).join("、") || "无"}` })])]))); }
-    function renderMatrix(rows) { const node = qs("#controlMatrix"); clearNode(node); const table = el("table"); table.appendChild(el("thead", {}, [el("tr", {}, ["控制", "领域", "测试程序", "证据要求", "成熟度", "状态"].map((text) => el("th", { text })))])); const body = el("tbody"); (rows || []).forEach((row) => body.appendChild(el("tr", {}, [el("td", { text: row.control_id || row.id }), el("td", { text: row.domain }), el("td", { text: row.test_procedure || row.objective }), el("td", { text: (row.evidence_required || []).join("、") }), el("td", { text: String(row.maturity_level ?? "-") }), el("td", { text: row.status || "" })]))); table.appendChild(body); node.appendChild(table); }
-    function renderAuditProgram(items) { const node = qs("#auditProgram"); clearNode(node); if (!(items || []).length) return node.appendChild(el("p", { class: "muted", text: "暂无审计程序" })); items.forEach((item) => node.appendChild(el("div", { class: "item compact" }, [el("strong", { text: `${item.step_id} · ${item.control_id}` }), el("div
```

**File**: `web/main.py` (modified, +4/-0)
```diff
@@ -219,6 +219,10 @@ async def audit_api(request: AuditRequest, agent: AuditAgent = Depends(get_audit
     if request.risk_level:
         audit_query += f"，关注 {request.risk_level} 风险"
     result = agent.process_audit_query(audit_query)
+    if str(request.risk_level).lower() in {"高", "high", "critical"}:
+        result["risk_assessment"]["risk_level"] = "高"
+        result["risk_assessment"]["risk_score"] = max(float(result["risk_assessment"].get("risk_score") or 0), 0.72)
+        result["quality_gate"]["escalation_required"] = True
     run = audit_repository.create_run(request.model_dump(), result)
     return {
         "success": True,
```

---

### Incident Patch 4: `15bf93e1` (2026-06-14)
**Commit Message**: Fix Windows one-click startup

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -38,3 +38,5 @@ Thumbs.db
 
 # Generated outputs
 docx_output.txt
+homepage-screenshot.png
+.edge-profile-shot/
```

**File**: `start.bat` (modified, +36/-43)
```diff
@@ -1,71 +1,64 @@
 @echo off
 chcp 65001 >nul
+setlocal
+
+cd /d "%~dp0"
+
 echo ================================================
-echo 智能审计决策系统启动脚本
+echo 智能审计 Agent 平台启动脚本
 echo ================================================
 
-REM 检查Python是否安装
 python --version >nul 2>&1
 if errorlevel 1 (
-    echo [错误] 未找到Python，请先安装Python 3.8+
+    echo [错误] 未找到 Python，请先安装 Python 3.10+ 并加入 PATH。
     pause
     exit /b 1
 )
 
-echo [信息] Python环境检查通过
-
-REM 检查虚拟环境
-if not exist "venv" (
-    echo [信息] 创建虚拟环境...
-    python -m venv venv
-    if errorlevel 1 (
-        echo [错误] 虚拟环境创建失败
-        pause
-        exit /b 1
+set "VENV_DIR=.venv"
+if not exist "%VENV_DIR%\Scripts\activate.bat" (
+    if exist "venv\Scripts\activate.bat" (
+        set "VENV_DIR=venv"
+    ) else (
+        echo [信息] 创建虚拟环境 .venv ...
+        python -m venv .venv
+        if errorlevel 1 (
+            echo [错误] 虚拟环境创建失败。
+            pause
+            exit /b 1
+        )
     )
 )
 
-REM 激活虚拟环境
-echo [信息] 激活虚拟环境...
-call venv\Scripts\activate.bat
+echo [信息] 使用虚拟环境: %VENV_DIR%
+call "%VENV_DIR%\Scripts\activate.bat"
 
-REM 检查关键依赖
-echo [信息] 检查依赖包...
-pip list | findstr "fastapi" >nul
+python -c "import fastapi, uvicorn, langchain_openai, sklearn" >nul 2>&1
 if errorlevel 1 (
-    echo [信息] 安装依赖包...
-    pip install -r requirements.txt
+    echo [信息] 安装或补齐依赖 ...
+    python -m pip install -r requirements.txt
     if errorlevel 1 (
-        echo [警告] 依赖包安装失败，请手动安装: pip install -r requirements.txt
+        echo [错误] 依赖安装失败，请检查网络后重试。
+        pause
+        exit /b 1
     )
 )
 
-REM 检查配置文件
 if not exist "config.env" (
-    echo [信息] 创建配置文件...
-    if exist "config.env.example" (
-        copy config.env.example config.env
-    ) else (
-        echo MYSQL_HOST=localhost > config.env
-        echo MYSQL_PORT=3306 >> config.env
-        echo MYSQL_USER=root >> config.env
-        echo MYSQL_PASSWORD=123456 >> config.env
-        echo MYSQL_DATABASE=audit_system >> config.env
-        echo NEO4J_URI=bolt://localhost:7687 >> config.env
-        echo NEO4J_USER=neo4j >> config.env
-        echo NEO4J_PASSWORD=12345678 >> config.env
-        echo QWEN_API_KEY=sk-484fb339d2274307b3aa3fd6400964ae >> config.env
-    )
-    echo [信息] 请编辑config.env文件，配置数据库和API信息
-    pause
+    echo [信息] 创建 config.env ...
+    copy config.env.example config.env >nul
 )
 
-REM 启动系统
+set "WEB_HOST=127.0.0.1"
+if "%WEB_PORT%"=="" set "WEB_PORT=8000"
+
 echo ================================================
-echo 正在启动智能审计决策系统...
-echo 访问地址: http://localhost:8000
-echo 按 Ctrl+C 可停止系统
+echo 正在启动服务，请保持此窗口打开。
+echo 访问地址: http://127.0.0.1:%WEB_PORT%
+echo 停止服务: 在此窗口按 Ctrl+C
 echo ================================================
+
+start "" "http://127.0.0.1:%WEB_PORT%"
 python start.py
 
 pause
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
