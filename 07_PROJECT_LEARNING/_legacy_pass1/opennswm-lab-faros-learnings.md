# Forensic Learning Record (Deep Inspection): OpenNSWM-Lab/FAROS

> **Canonical Artifact**: `07_PROJECT_LEARNING/opennswm-lab-faros-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/OpenNSWM-Lab/FAROS](https://github.com/OpenNSWM-Lab/FAROS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:28.059Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `OpenNSWM-Lab/FAROS`
- **Description**: A blueprint-driven AutoResearch runtime for orchestrating AI research workflows from idea generation and experiments to paper writing and peer review.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3041 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/_faros_syntax_check.py`
```
import py_compile, os
ok = fail = 0
for root, dirs, files in os.walk('.'):
  for f in files:
    if f.endswith('.py') and '_faros_' not in f:
      fp = os.path.join(root, f)
      try:
        py_compile.compile(fp, doraise=True)
        ok += 1
        print('OK', fp)
      except py_compile.PyCompileError as e:
        fail += 1
        print('FAIL', fp, str(e))
print(f'\nSyntax check done: {ok} OK, {fail} FAIL')

```

### Core Architecture Module: `backend/alembic/env.py`
```
"""
Alembic Environment Configuration

Configures Alembic to work with SQLModel and our database engine.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import SQLModel
from app.db.models import (
    CodeProject, RepoContextDB, CodeSessionDB, CodeCandidateDB,
    CodeJob, EvalReportDB, TraceLogDB, ArtifactDB
)

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# SQLModel metadata for autogenerate
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

```

### Core Architecture Module: `backend/alembic/versions/001_initial_schema.py`
```
"""Initial schema for Phase 2.1

Revision ID: 001_initial
Revises: 
Create Date: 2026-02-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # code_projects
    op.create_table(
        'code_projects',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('repo_path', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('task_goal', sa.Text(), nullable=True),
        sa.Column('constraints', sa.Text(), nullable=True),
        sa.Column('expected_commands', sa.String(), nullable=True),
        sa.Column('acceptance_criteria', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_code_projects_name', 'code_projects', ['name'])

    # repo_contexts
    op.create_table(
        'repo_contexts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=False),
        sa.Column('repo_path', sa.String(), nullable=False),
        sa.Column('file_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_lines', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('languages', sa.String(), nullable=True),
        sa.Column('scan_duration_ms', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['code_projects.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_repo_contexts_project_id', 'repo_contexts', ['project_id'])

    # code_sessions
    op.create_table(
        'code_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), nullable=True),
        sa.Column('repo_context_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('goal', sa.Text(), nullable=False),
        sa.Column('provider_name', sa.String(), nullable=False, server_default='moonshot'),
        sa.Column('model', sa.String(), nullable=False, server_default='moonshot-v1-8k'),
        sa.Column('max_candidates', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('max_iterations', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('constraints', sa.Text(), nullable=True),
        sa.Column('target_files', sa.String(), nullable=True),
        sa.Column('current_step', sa.String(), nullable=True),
        sa.Column('iteration_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('selected_candidate_id', sa.String(), nullable=True),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('duration_sec', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['code_projects.id']),
        sa.ForeignKeyConstraint(['repo_context_id'], ['repo_contexts.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_code_sessions_project_id', 'code_sessions', ['project_id'])

    # code_candidates
    op.create_table(
        'code_candidates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('approach', sa.Text(), nullable=False),
        sa.Column('rationale', sa.Text(), nullable=True),
        sa.Column('patch', sa.Text(), nullable=False, server_default=''),
        sa.Column('files_modified', sa.String(), nullable=True),
        sa.Column('testing_notes', sa.Text(), nullable=True),
        sa.Column('run_commands', sa.String(), nullable=True),
        sa.Column('score_correctness', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('score_completeness', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('score_efficiency', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('score_readability', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('score_safety', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('overall_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('rank', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['code_sessions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_code_candidates_session_id', 'code_candidates', ['session_id'])

    # code_jobs
    op.create_table(
        'code_jobs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('candidate_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('mode', sa.String(), nullable=False, server_default='quick'),
        sa.Column('command', sa.String(), nullable=False),
        sa.Column('env_vars', sa.String(), nullable=True),
        sa.Column('cwd_rel', sa.String(), nullable=True),
        sa.Column('timeout_sec', sa.Integer(), nullable=False, server_default='300'),
        sa.Column('workspace_path', sa.String(), nullable=True),
        sa.Column('pid', sa.Integer(), nullable=True),
        sa.Column('exit_code', sa.Integer(), nullable=True),
        sa.Column('stdout_path', sa.String(), nullable=True),
        sa.Column('stderr_path', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('duration_sec', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['code_sessions.id']),
        sa.ForeignKeyConstraint(['candidate_id'], ['code_candidates.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_code_jobs_session_id', 'code_jobs', ['session_id'])
    op.create_index('ix_code_jobs_candidate_id', 'code_jobs', ['candidate_id'])

    # eval_reports
    op.create_table(
        'eval_reports',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('job_id', sa.String(), nullable=False),
        sa.Column('candidate_id', sa.String(), nullable=True),
        sa.Column('syntax_valid', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('lint_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('risk_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('lint_issues', sa.String(), nullable=True),
        sa.Column('test_passed', sa.Boolean(), nullable=True),
        sa.Column('test_output', sa.Text(), nullable=True),
        sa.Column('test_duration_ms', sa.Integer(), nullable=True),
        sa.Column('scores', sa.String(), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('grade', sa.String(), nullable=False, server_default='F'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
```

### Core Architecture Module: `backend/alembic/versions/7570e1707d14_add_code_project_files_and_exports.py`
```
"""add code project files and exports

Revision ID: 7570e1707d14
Revises: 001_initial
Create Date: 2026-02-25 13:21:09.462952

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '7570e1707d14'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

```

### Core Architecture Module: `backend/app/__init__.py`
```
"""
Backend application package.
"""

```

### Core Architecture Module: `backend/app/agents/__init__.py`
```
"""Agent runtime package.

This package hosts lower-level agent execution code. In the current cleaned
skeleton it is primarily an implementation detail of the code module.
"""

```

### Core Architecture Module: `backend/app/agents/codegen/kernel.py`
```
"""
AgentKernel — OpenClaw-like orchestration for code generation.

Components:
- Planner: breaks task into steps based on plan context
- ToolRouter: chooses skills/tools for each step
- MemoryStore: persists intermediate artifacts
- Verifier: enforces constraints and quality gates
- PatchApplier: applies file diffs for repair cycles

The kernel runs a multi-phase pipeline:
1. Research & Context Gathering (web search, github, summarize)
2. Architecture Planning (file tree, module design)
3. Code Synthesis (batch + individual file generation)
4. Verification (compile check, structure validation, import sanity)
5. Repair Loop (detect issues → patch → re-verify, max 2 cycles)
6. Persist (write files, index, finalize)
"""

import json
import os
import re
import ast
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

from app.llm.provider_client import get_provider_client, ChatMessage, ProviderClient
from app.core.paths import get_data_dir
from app.agents.codegen.skills.registry import SkillsRegistry, SkillResult

logger = logging.getLogger(__name__)

# Storage for session traces and resumable generation checkpoints.
_SESSIONS_DIR = str(get_data_dir() / "codegen_sessions")
_CHECKPOINTS_DIR = os.path.join(_SESSIONS_DIR, "checkpoints")
os.makedirs(_SESSIONS_DIR, exist_ok=True)
os.makedirs(_CHECKPOINTS_DIR, exist_ok=True)
_GENERATION_BATCH_SIZE = max(2, int(os.getenv("FAROS_CODEGEN_BATCH_SIZE", "4")))


@dataclass
class StepResult:
    name: str
    status: str  # "pending" | "running" | "ok" | "failed" | "skipped"
    detail: str = ""
    durationMs: int = 0
    toolCalls: List[Dict[str, Any]] = field(default_factory=list)
    artifacts: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MemoryStore:
    """Persists intermediate artifacts across agent steps."""
    references: List[Dict] = field(default_factory=list)
    github_repos: List[Dict] = field(default_factory=list)
    summaries: List[str] = field(default_factory=list)
    design_doc: Optional[str] = None
    file_tree: Optional[Dict] = None
    generated_files: Dict[str, str] = field(default_factory=dict)
    verification_results: List[Dict] = field(default_factory=list)
    verification_summary: Dict[str, Any] = field(default_factory=dict)
    execution_result: Dict[str, Any] = field(default_factory=dict)
    patches_applied: int = 0

    def to_dict(self) -> Dict:
        return {
            "referenceCount": len(self.references),
            "githubRepoCount": len(self.github_repos),
            "summaryCount": len(self.summaries),
            "hasDesignDoc": self.design_doc is not None,
            "fileTreePlanned": self.file_tree is not None,
            "generatedFileCount": len(self.generated_files),
            "verificationCount": len(self.verification_results),
            "verificationSummary": self.verification_summary,
            "executionStatus": self.execution_result.get("status", "not_run"),
            "executionTestStatus": self.execution_result.get("testStatus", "not_run"),
            "executionCommand": self.execution_result.get("command"),
            "executionDurationMs": self.execution_result.get("durationMs", 0),
            "patchesApplied": self.patches_applied,
        }

    def to_checkpoint_dict(self) -> Dict:
        return {
            "references": self.references,
            "githubRepos": self.github_repos,
            "summaries": self.summaries,
            "designDoc": self.design_doc,
            "fileTree": self.file_tree,
            "generatedFiles": self.generated_files,
            "verificationResults": self.verification_results,
            "verificationSummary": self.verification_summary,
            "executionResult": self.execution_result,
            "patchesApplied": self.patches_applied,
        }

    @staticmethod
    def from_checkpoint_dict(data: Dict) -> "MemoryStore":
        return MemoryStore(
            references=list(data.get("references") or []),
            github_repos=list(data.get("githubRepos") or []),
            summaries=list(data.get("summaries") or []),
            design_doc=data.get("designDoc"),
            file_tree=data.get("fileTree"),
            generated_files=dict(data.get("generatedFiles") or {}),
            verification_results=list(data.get("verificationResults") or []),
            verification_summary=dict(data.get("verificationSummary") or {}),
            execution_result=dict(data.get("executionResult") or {}),
            patches_applied=int(data.get("patchesApplied") or 0),
        )

    @staticmethod
    def from_dict(d: Dict) -> "MemoryStore":
        """Reconstruct MemoryStore from saved dict."""
        m = MemoryStore()
        m.references = [{} for _ in range(d.get("referenceCount", 0))]
        m.github_repos = [{} for _ in range(d.get("githubRepoCount", 0))]
        m.summaries = ["" for _ in range(d.get("summaryCount", 0))]
        m.design_doc = "(restored)" if d.get("hasDesignDoc") else None
        m.file_tree = {"files": []} if d.get("fileTreePlanned") else None
        m.generated_files = {f"file_{i}": "" for i in range(d.get("generatedFileCount", 0))}
        m.verification_results = [{} for _ in range(d.get("verificationCount", 0))]
        m.verification_summary = dict(d.get("verificationSummary") or {})
        m.execution_result = {"status": d.get("executionStatus", "not_run")}
        m.patches_applied = d.get("patchesApplied", 0)
        return m


@dataclass
class CodeGenSession:
    """Tracks a single code generation run."""
    id: str
    projectId: str
    planLinkId: Optional[str]
    providerName: str
    model: str
    status: str = "pending"  # pending | running | completed | failed
    steps: List[StepResult] = field(default_factory=list)
    memory: MemoryStore = field(default_factory=MemoryStore)
    config: Dict[str, Any] = field(default_factory=dict)
    createdAt: str = ""
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    errorMessage: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "projectId": self.projectId,
            "planLinkId": self.planLinkId,
            "providerName": self.providerName,
            "model": self.model,
            "status": self.status,
            "steps": [
                {
                    "name": s.name,
                    "status": s.status,
                    "detail": s.detail,
                    "durationMs": s.durationMs,
                    "toolCalls": s.toolCalls,
                }
                for s in self.steps
            ],
            "memory": self.memory.to_dict(),
            "config": self.config,
            "createdAt": self.createdAt,
            "startedAt": self.startedAt,
            "completedAt": self.completedAt,
            "errorMessage": self.errorMessage,
        }


# In-memory session store (also persisted to JSON files)
_sessions: Dict[str, CodeGenSession] = {}


def _gen_id() -> str:
    import uuid
    return f"cgs_{uuid.uuid4().hex[:12]}"


def _write_json_atomic(path: str, payload: Dict) -> None:
    temp_path = f"{path}.{os.getpid()}.tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, default=str)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp_path, path)


def _save_session(session: CodeGenSession):
    """Persist the public trace and private resumable memory atomically."""
    path = os.path.join(_SESSIONS_DIR, f"{session.id}.json")
    checkpoint_path = os.path.join(_CHECKPOINTS_DIR, f"{session.id}.json")
    _write_json_atomic(path, session.to_dict())
    _write_json_atomic(checkpoint_path, session.memory.to_checkpoint_dict())


def get_session(session_id: str) -> Optional[CodeGenSession]:
    """Get session from memory or load from disk."""
    if session_id in _sessio
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #42** (2026-08-12): **feat(paper): 重构 FAROS paper 写作流程，引入 compile/review 多 agent 反馈循环**
  *Symptoms*: ## 概述  本 PR 重构了 FAROS paper 模块的论文写作流程和前端页面，引入了多 agent 协作的论文生成与反馈修改循环。  新的 paper writing 流程中，三个 agent 分工如下：  - Writing agent：负责论文撰写和根据反馈进行局部修改 - LaTeX compile agent：负责 LaTeX 编译，并只返回编译反馈 - Simple review agent：负责格式、规范、图表、artifact 使用情况等非原理性审查，并只返回审查反馈  Compile agent 和 review agent 不直接修改论文内容。所有修改都由 writing agent 根据反馈进行。  ## 主要改动  ### 后端  - 使用独立的 LaTeX compile agent 替代原有 compile 步骤。 - 移除旧的 `compile_pdf` / 通用 figure 生成路径。 - 删除 `figure_generate`，避免论文中引入通用占位图表。 - 引入反馈修改循环：   - Writing -> Compile   - Compile 失败或有问题时，反馈给 Writing 修改   - Compile 通过后，交给 Simple review   - Review 有修改意见时，反馈给 Writing 修改   - Writing 修改后进入下一轮 Compile - 细化论文最终状态：   - 只有 LaTeX 编译成功且 simple review 通过时，才标记为完成   - 区分编译失败和 review 后仍有问题 - 完善 code evidence 收集：   - 支持收集 CART 结构下的代码成果、实验指标、实验结果、图表和分析   - Brief 中不直接拷贝 code artifact 的图表内容，而是通过 label、文件名、位置和分析信息进行关联 - 重整 paper artifacts：   - artifact 改为 JSON-only   - feedback artifact 按 loop round 组织：     - `artifacts/feedback/round_XX/compile.json`     - `artifacts/feedback/round_XX/review.json`     - `artifacts/feedback/round_XX/rewrite_compile.json`     - `artifacts/feedback/round_XX/rewrite_review.json`  ### 前端  - 将 paper writing 前端重构为 4 步流程：   1. 起始阶段：paper、template、模块链接和 evidence 展示   2. Brief 阶段：paper brief 和 section brief 编辑   3. Feedback writing 阶段：展示 agent 交互、步骤计时和反馈循环   4. 结果展示阶段：展示论文文件和 PDF 预览 - 点击 new paper 后直接进入 4 步 writing 页面。 - Template 决定论文模板和 venue，不再单独选择 venue。 - 在 paper 列表中增加删除论文功能。 - 改进 agent feedback 展示：

- **Issue #41** (2026-08-11): **feat(code): 完善科学执行评估、可复现实验证据与结果导入流程**
  *Symptoms*: ## 变更概述  本 PR 根据挑战杯统一开发任务书完善 FAROS Code 模块，将原有代码生成功能扩展为“科学任务可执行性判断—真实实验执行—证据留存—结果反馈”的完整流程，同时修复 PlanPackage 生成代码和成品样例加载问题。  ## 主要改动  ### 1. 科学执行评估与门禁  - 从 PlanPackage/ResearchDossier 生成 ExecutionAssessment。 - 支持以下七类执行判定：   - computational_ready   - simulation_ready   - data_required   - instrument_required   - ethics_review_required   - proof_required   - protocol_only - 在进入 Blueprint/沙箱前执行科学可执行性 Gate。 - 缺少数据、仪器、伦理审批或属于证明/协议任务时，不再错误进入代码执行。  ### 2. 可复现实验证据  - 新增 ExperimentEvidence 生成与校验。 - 记录并校验：   - 代码 Hash   - 环境 Hash   - 数据和配置 Hash   - 指标   - 日志与 ArtifactRef - 只有真实产物完整存在时才输出 executed。 - 产物缺失、执行失败或 Cart 未正常结束时自动降级为 failed。 - 将指标、异常和失败原因转换成结构化计划反馈。  ### 3. Generate from Plan Bug 修复  - 修复前端传入 `ppkg_*` PlanPackage，而后端仅识别旧版 `psess_* / cplan_*` 的兼容问题。 - CodeGen 现在可以正确读取 PlanPackage 中的：   - 标题   - 研究问题   - 研究方法   - Gap 分析   - Idea Session/Candidate 关联 - 无法解析计划时返回明确的 422 错误，不再静默使用默认上下文。  ### 4. 成品样例 ZIP 导入  - 新增安全的完整样例包导入与项目注册。 - 导入后自动完成：   - 创建 CodeProject 数据库记录   - 复制并索引项目代码   - 注册 PlanPackage   - 写入 cart_artifacts   - 关联 project_id、package_id 和 cart_id - 支持路径穿越、符号链接、文件数量、解压大小、Checksum 和 JSON 结构校验。 - 前端新增 Import Bundle 按钮，可通过系统文件管理器直接选择 ZIP。 - 导入成功后自动跳转到 Code 项目详情页。  ### 5. 代表性案例  新增两个可重复运行的案例：  1. UCI Iris 真实数据分析：    - 固定数据 Hash 和随机种子    - 最近质心分类器    - 多数类基线对比    - 输出真实指标、预测结果、日志和证据  2. Monte Carlo 仿真：    - 固定随机种子    - 多组样本预算参数比较    - 输出误差、参数结果和可复现证据  ## 新增接口  - `POST /api/v1/code/research/assess` - `POST 

- **Issue #36** (2026-08-04): **Devtzb paper**
  *Symptoms*: 1. 模版风格引导 2. 小节粒度写作控制 3. idea阶段材料整理，evidence支持writing 4. latex编译错误校正

- **Issue #25** (2026-08-11): **feat(idea): 搜索源扩充 + seed预检 + 公共契约对齐 + Review Gate修复 + 前端Dossier查看器**
  *Symptoms*: ## Idea 模块 P0 公共契约对齐 + Review Gate 修复 + 前端 Dossier 查看器  ### 提交历史 1. `849efcc` feat: 对齐公共契约，实现ResearchDossier全流程 2. `969cfc1` fix: session.config.seedQuery访问修复 + confounders回退 + 降级fixture测试 3. `7285fb3` fix: Review Gate refSupport阈值过高导致候选被误拒 4. `c0f1b0d` feat: 添加child-run API端点 + 前端Dossier查看器 + 文档更新  ### 功能清单 - **搜索源扩充**: Crossref/DBLP/CORE 三个免费源适配器 - **Seed预检**: POST /ideas/seed-check API + 前端检查按钮 + CJK分词修复 - **公共契约对齐**: ResearchDossier全流程 (problem_framing + research_dossier + budget_modes) - **Review Gate修复**: refSupport阈值4.5->3.5，解决候选被误拒问题 - **Child Run API**: POST /dossier/child-run 端点，支持Review反馈触发child run - **前端Dossier查看器**: 展示ProblemFrame/EvidenceMap/Hypotheses/ResearchPlan - **MODULE_HANDOFF文档**: 更新head commit/测试数/cap值/验收结果 - **百炼调用trace**: 阿里云百炼provider验证通过 (qwen-turbo, 3.7s)  ### 验收结果 (11/11 ALL PASS) - >=2候选假设: PASS (2个final候选, 1 strict + 1 relaxed) - >=1反证: PASS (19条counter evidence) - ProblemFrame: PASS - ResearchPlan: PASS (3步) - Qwen trace: PASS (provider=qwen, model=qwen-turbo) - 证伪条件: PASS - 混杂因素: PASS - 61个测试全通过 (含13个公共契约测试)  ### 文件变更 - `backend/app/modules/idea/problem_framing.py` -- ProblemFrame 生成 - `backend/app/modules/idea/research_dossier.py` -- ResearchDossier 构建器 - `backend/app/modules/idea/budget_modes.py` -- 预算配置 + 降级状态 - `backend/app/modules/idea/service.py` -- Review Gate refSupport阈值修复 - `backend/app/modules/idea/ideas_api.py` -- Dossier API + Child Run API端点 - `backend/app/contracts/MODULE_HANDOFF_idea.md` -- 模块交接文档 - `frontend/src/components/id

- **Issue #24** (2026-07-14): **feat: Idea Pipeline性能优化 + 强制多方向探索**
  *Symptoms*: ## 改动概述  对Idea生成Pipeline进行两类改进（5文件, +647/-117行）：  ### P0/P1 性能优化 - **搜索并行化**: ThreadPoolExecutor 5源并行查询 (190s→12s, 16x加速) - **BFTS语义评分**: n-gram token overlap替换关键词启发式 - **BFTS去重剪枝**: Jaccard阈值0.82自动跳过近重复节点 - **Ranking并行化**: ThreadPoolExecutor并行LLM评分 (FAROS_RANKING_CONCURRENCY) - **BFTS方向并行**: 多方向BFTS树并行执行 (FAROS_BFTS_DIRECTION_CONCURRENCY) - **RAG增强**: expandQuery/gapAnalysis注入文献上下文  ### 强制多方向探索 - GAP_ANALYSIS prompt要求>=3个独立研究方向(2维差异) - SEED_DIRECTION_DECOMPOSITION prompt强化方向独立性约束 - _enforce_min_opportunities: n-gram Jaccard去重 + typed fallback补充 - _deduplicate_research_directions_by_focus: 跨方向语义去重  ### 验证 - 方向多样性: 1→5个独立方向 - 候选方向覆盖: 0/5→5/5 - literatureSearch: 190.9s→12.4s (16x加速)  ### 环境变量 | 变量 | 默认值 | 说明 | |------|--------|------| | FAROS_SEARCH_PARALLELISM | 5 | 搜索源并行度 | | FAROS_RANKING_CONCURRENCY | 4 | Ranking并行度 | | FAROS_BFTS_DIRECTION_CONCURRENCY | 3 | BFTS方向并行度 | 

- **Issue #22** (2026-07-12): **fix: 修复中文(CJK)Topic系统性偏差 — 9个Bug修复 + 学术搜索增强**
  *Symptoms*: ## 问题 FAROS Idea 模块处理中文(CJK)研究主题时存在系统性偏差： Pipeline 候选 100% 偏离为 ML/工程领域主题，CJK 误报 30+。  ## 修复内容(9个Bug) - Bug1-3: fallback硬编码ML词汇 + 2处CJK正则 - Bug4-7: 本地语料库CJK支持+扩展15篇、RAG信号词条件化、repair跳过CJK、fallback模板领域无关 - Bug8: Idea Review Gate Jaccard CJK误判 → 传递englishSearchQueries扩充seed_tokens - Bug8b: 长文本Jaccard稀释 → containment fallback(≥2区分性token重叠即跳过) - Bug9: candidate_topic_drift_issues CJK误报 → 传递英文查询扩充seed_text  ## 学术搜索增强 - expandQuery: CJK查询自动翻译为英文，生成双路检索 - OpenAlex免费搜索源(20篇) + CNKI/万方接口预留 - 25+模型支持(前端provider配置扩展)

- **Issue #21** (2026-07-12): **Devtzb**
  *Symptoms*: 

- **Issue #19** (2026-07-06): **优化 Code 模块 PlanPackage 执行链路与智能体进度展示**
  *Symptoms*: ## 变更概述  本 PR 优化 Code 模块从 PlanPackage 到 Blueprint/Cart 执行的完整链路，并改善 Claude Code 智能体执行过程中的前端展示体验。  ## 主要改动  - 增强 PlanPackage 与 Code 模块的衔接能力，支持 Code 侧发现、加载并执行 PlanPackage。 - 完善 Blueprint/Cart 执行状态同步，支持节点执行状态、事件日志和历史状态恢复。 - 优化 Claude Code 调用逻辑，统一读取配置中的模型/API 设置。 - 降低智能体运行时前端日志噪音，仅展示启动、读取/生成、运行、完成/失败等关键节点信息。 - 在 prompt 层面约束 Claude/LLM 输出，减少冗长解释、长日志和不必要 token 消耗。 - 更新 Code 前端页面，支持 Cart Pipeline 进度展示、轮询兜底和执行结果恢复。

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

### Incident Patch 1: `4e4e96fd` (2026-09-05)
**Commit Message**: fix: harden literature TLS and sanitize deployment templates

**File**: `README.md` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@
 <p align="center">
   <a href="https://github.com/OpenNSWM-Lab/FAROS/stargazers"><img src="https://img.shields.io/github/stars/OpenNSWM-Lab/FAROS?style=for-the-badge&color=FFB300&label=Stars" alt="GitHub Stars" /></a>
   <img src="https://img.shields.io/badge/Release-1.1.0--rc1-0891B2?style=for-the-badge" alt="Release 1.1.0-rc1" />
-  <img src="https://img.shields.io/badge/Backend_Tests-644_passed-16A34A?style=for-the-badge" alt="644 backend tests passed" />
-  <img src="https://img.shields.io/badge/Frontend_Tests-35_passed-2563EB?style=for-the-badge" alt="35 frontend tests passed" />
+  <img src="https://img.shields.io/badge/Backend_Tests-685_passed-16A34A?style=for-the-badge" alt="685 backend tests passed" />
+  <img src="https://img.shields.io/badge/Frontend_Tests-41_passed-2563EB?style=for-the-badge" alt="41 frontend tests passed" />
   <img src="https://img.shields.io/badge/Qwen-Ready-FFB300?style=for-the-badge" alt="Qwen Ready" />
 </p>
 
```

**File**: `backend/app/code/context/chunker.py` (modified, +1/-1)
```diff
@@ -89,7 +89,7 @@ def __init__(
     def _generate_chunk_id(self, file_path: str, start_line: int, content: str) -> str:
         """Generate unique chunk ID."""
         hash_input = f"{file_path}:{start_line}:{content[:100]}"
-        hash_val = hashlib.md5(hash_input.encode()).hexdigest()[:12]
+        hash_val = hashlib.md5(hash_input.encode(), usedforsecurity=False).hexdigest()[:12]
         return f"chunk_{hash_val}"
     
     def _estimate_tokens(self, text: str) -> int:
```

**File**: `backend/app/modules/idea/research_dossier.py` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ def _utcnow() -> datetime:
 
 
 def _short_id(prefix: str, seed: str) -> str:
-    return f"{prefix}_{hashlib.md5(seed.encode()).hexdigest()[:12]}"
+    return f"{prefix}_{hashlib.md5(seed.encode(), usedforsecurity=False).hexdigest()[:12]}"
 
 
 def _score_to_01(value: float, scale: float = 10.0) -> float:
```

**File**: `backend/app/services/plan_package_specificity.py` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ def hypothesis_is_falsifiable(hypothesis: str) -> bool:
 
 def _issue(section_path: str, message: str) -> PlanReviewerIssue:
     digest = hashlib.sha1(
-        f"{section_path}|{message}".encode("utf-8")
+        f"{section_path}|{message}".encode("utf-8"), usedforsecurity=False
     ).hexdigest()[:12]
     return PlanReviewerIssue(
         id=f"specificity:{digest}",
```

**File**: `backend/app/services/ranking_service.py` (modified, +4/-1)
```diff
@@ -394,7 +394,10 @@ def _heuristic_score_single(
         weights = PAPER_TYPE_WEIGHTS.get(paper_type, PAPER_TYPE_WEIGHTS["default"])
         
         # Generate deterministic but varied scores based on candidate content
-        seed_hash = int(hashlib.md5(candidate.id.encode()).hexdigest()[:8], 16)
+        seed_hash = int(
+            hashlib.md5(candidate.id.encode(), usedforsecurity=False).hexdigest()[:8],
+            16,
+        )
         random.seed(seed_hash)
         
         # Base scores: always generate fresh heuristic scores for unscored candidates
```

---

### Incident Patch 2: `178c9a91` (2026-09-04)
**Commit Message**: fix(reviewx): handle unavailable saved audits

**File**: `frontend/src/pages/Review/ConsistencyChecker.test.tsx` (modified, +13/-0)
```diff
@@ -50,6 +50,7 @@ describe('ConsistencyChecker', () => {
         }] })
       }
       if (url.endsWith('/review-1/findings')) return response([])
+      if (url.includes('/review-missing')) return response({ detail: 'Review not found' }, false)
       if (url.endsWith('/reviewx/review-1')) {
         return response({
           id: 'review-1',
@@ -88,4 +89,16 @@ describe('ConsistencyChecker', () => {
     expect(screen.getByRole('button', { name: /实验反馈闭环与人工签核/ })).toHaveAttribute('aria-expanded', 'false')
     expect(screen.queryByText('Feedback panel content')).not.toBeInTheDocument()
   })
+
+  it('recovers when a deep-linked saved review no longer exists', async () => {
+    render(
+      <MemoryRouter initialEntries={['/review/consistency?paperId=paper-1&reviewId=review-missing']}>
+        <ConsistencyChecker />
+      </MemoryRouter>,
+    )
+
+    expect(await screen.findByText('保存的审计记录已不可用')).toBeInTheDocument()
+    expect(screen.getByText('当前论文选择已保留。请刷新历史记录，或点击“加载最新结果”继续。')).toBeInTheDocument()
+    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
+  })
 })
```

**File**: `frontend/src/pages/Review/ConsistencyChecker.tsx` (modified, +29/-1)
```diff
@@ -412,6 +412,7 @@ export function ConsistencyChecker() {
   const [selectedHistoryId, setSelectedHistoryId] = useState<string>('')
   const [historyFindings, setHistoryFindings] = useState<ReviewFinding[] | null>(null)
   const [historyFindingsLoading, setHistoryFindingsLoading] = useState(false)
+  const [historyLoadError, setHistoryLoadError] = useState(false)
   const [runDetail, setRunDetail] = useState<ReviewXRunDetail | null>(null)
   const [runDetailLoading, setRunDetailLoading] = useState(false)
   const [revisionRequests, setRevisionRequests] = useState<ImprovementRequest[]>([])
@@ -455,21 +456,35 @@ export function ConsistencyChecker() {
   const loadHistoryFindings = async (reviewId: string) => {
     setSelectedHistoryId(reviewId)
     setLatestResultsEnabled(false)
+    setHistoryLoadError(false)
     setHistoryFindingsLoading(true)
     setRunDetailLoading(true)
     try {
       const [findingsResp, detailResp] = await Promise.all([
         fetch(`${API_BASE_URL}/api/v1/reviews/reviewx/${reviewId}/findings`),
         fetch(`${API_BASE_URL}/api/v1/reviews/reviewx/${reviewId}`),
       ])
+      if (!findingsResp.ok || !detailResp.ok) {
+        throw new Error('Saved ReviewX run is unavailable')
+      }
       const findingsData = await findingsResp.json()
       const detailData = await detailResp.json()
-      setHistoryFindings(findingsData || [])
+      if (!Array.isArray(findingsData) || !detailData?.id || !detailData?.paperId) {
+        throw new Error('Saved ReviewX run returned an invalid response')
+      }
+      setHistoryFindings(findingsData)
       setRunDetail(detailData)
       setSelectedActionIndexes(new Set())
       setApplyMessage('')
       void loadRevisionRequests(detailData.id)
       void loadComparison(detailData.paperId, detailData.id)
+    } catch {
+      setSelectedHistoryId('')
+      setHistoryFindings(null)
+      setRunDetail(null)
+      setRevisionRequests([])
+      setComparison(null)
+      setHistoryLoadError(true)
     } finally {
       setHistoryFindingsLoading(false)
       setRunDetailLoading(false)
@@ -503,6 +518,7 @@ export function ConsistencyChecker() {
 
   const loadLatestReviewX = async (paperId: string) => {
     if (!paperId) return
+    setHistoryLoadError(false)
     setSelectedHistoryId('')
     setHistoryFindings(null)
     setLatestResultsEnabled(true)
@@ -611,6 +627,7 @@ export function ConsistencyChecker() {
     setSelectedActionIndexes(new Set())
     setApplyMessage('')
     setComparison(null)
+    setHistoryLoadError(false)
     setLatestResultsEnabled(false)
     setSearchQuery('')
     setSeverityFilter('all')
@@ -980,6 +997,17 @@ export function ConsistencyChecker() {
                   </div>
                 </div>
               )}
+              {historyLoadError && (
+                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
+                  <div className="font-semibold">{text('保存的审计记录已不可用', 'Saved audit record unavailable')}</div>
+                  <div className="mt-1 text-xs leading-5">
+                    {text(
+                      '当前论文选择已保留。请刷新历史记录，或点击“加载最新结果”继续。',
+                      'The current paper selection was kept. Refresh history or choose Load Latest to continue.',
+                    )}
+                  </div>
+                </div>
+              )}
             </CardContent>
           </Card>
 
```

---

### Incident Patch 3: `f1f04b5b` (2026-09-04)
**Commit Message**: fix(reviewx): apply evaluator feedback

**File**: `backend/app/modules/platform/verified_histories_api.py` (modified, +16/-1)
```diff
@@ -12,6 +12,7 @@
 import mimetypes
 from pathlib import Path
 from typing import Any
+from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
 
 from fastapi import APIRouter, HTTPException
 from fastapi.responses import FileResponse
@@ -70,6 +71,16 @@ def _stage_entity_path(data_dir: Path, stage: dict[str, Any]) -> Path | None:
     return paths.get(stage_id)
 
 
+def _stage_url(stage_id: str, value: Any) -> str:
+    url = str(value or "")
+    if stage_id not in {"idea", "plan"} or not url.startswith("/research/pipeline"):
+        return url
+    parts = urlsplit(url)
+    query = dict(parse_qsl(parts.query, keep_blank_values=True))
+    query["phase"] = stage_id
+    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
+
+
 def _public_manifest(data_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
     stages = payload.get("stages") or []
     stage_by_id = {
@@ -88,7 +99,11 @@ def _public_manifest(data_dir: Path, payload: dict[str, Any]) -> dict[str, Any]:
         exists = bool(entity_path and entity_path.exists())
         if not exists:
             broken_stages.append(stage_id)
-        public_stages.append({**stage, "status": "passed" if exists else "missing"})
+        public_stages.append({
+            **stage,
+            "url": _stage_url(stage_id, stage.get("url")),
+            "status": "passed" if exists else "missing",
+        })
 
     broken_artifacts: list[str] = []
     public_artifacts: list[dict[str, Any]] = []
```

**File**: `backend/tests/test_verified_histories_api.py` (modified, +12/-1)
```diff
@@ -41,7 +41,15 @@ def test_verified_history_checks_stages_and_artifact_digests(tmp_path: Path):
         "id": history_id,
         "completedAt": "2026-09-04T00:00:00+00:00",
         "stages": [
-            {"id": stage_id, "entityId": entity_id, "url": f"/{stage_id}/{entity_id}"}
+            {
+                "id": stage_id,
+                "entityId": entity_id,
+                "url": (
+                    f"/research/pipeline?ideaSessionId=idea_1&ideaCandidateId=candidate_1"
+                    if stage_id in {"idea", "plan"}
+                    else f"/{stage_id}/{entity_id}"
+                ),
+            }
             for stage_id, entity_id in entity_ids.items()
         ],
         "artifacts": [{
@@ -59,6 +67,9 @@ def test_verified_history_checks_stages_and_artifact_digests(tmp_path: Path):
     assert len(histories) == 1
     assert histories[0]["integrity"]["status"] == "verified"
     assert all(stage["status"] == "passed" for stage in histories[0]["stages"])
+    stage_urls = {stage["id"]: stage["url"] for stage in histories[0]["stages"]}
+    assert stage_urls["idea"].endswith("&phase=idea")
+    assert stage_urls["plan"].endswith("&phase=plan")
     assert histories[0]["artifacts"][0]["verified"] is True
     assert "path" not in histories[0]["artifacts"][0]
 
```

**File**: `frontend/src/pages/Research/Pipeline.test.tsx` (modified, +39/-2)
```diff
@@ -1,6 +1,7 @@
-import { render, screen } from '@testing-library/react'
+import { act, render, screen } from '@testing-library/react'
+import userEvent from '@testing-library/user-event'
 import type { ReactNode } from 'react'
-import { MemoryRouter } from 'react-router-dom'
+import { MemoryRouter, useNavigate } from 'react-router-dom'
 import { describe, expect, it, vi } from 'vitest'
 
 import { ResearchPipeline } from './Pipeline'
@@ -29,6 +30,25 @@ vi.mock('@/components/plans/PlanGenerationPanel', () => ({
   ),
 }))
 
+vi.mock('@/components/research/VerifiedResearchHistories', () => ({
+  VerifiedResearchHistories: () => null,
+}))
+
+function PipelineWithHistoryNavigation() {
+  const navigate = useNavigate()
+  return (
+    <>
+      <button
+        type="button"
+        onClick={() => navigate('/research/pipeline?ideaSessionId=idea_002&ideaCandidateId=cand_002&ideaCandidateTitle=Climate+Evidence&phase=plan')}
+      >
+        Open verified plan
+      </button>
+      <ResearchPipeline />
+    </>
+  )
+}
+
 describe('ResearchPipeline', () => {
   it('restores the selected candidate and Plan stage from the URL after refresh', async () => {
     render(
@@ -42,4 +62,21 @@ describe('ResearchPipeline', () => {
     expect(screen.getByText('Idea panel')).toBeInTheDocument()
     expect(await screen.findByText('Plan restored: idea_001 / cand_001 / Reliable RAG')).toBeInTheDocument()
   })
+
+  it('updates the visible workflow when a history link changes URL parameters in place', async () => {
+    const user = userEvent.setup()
+    render(
+      <MemoryRouter initialEntries={[
+        '/research/pipeline?ideaSessionId=idea_001&ideaCandidateId=cand_001&ideaCandidateTitle=Reliable+RAG',
+      ]}>
+        <PipelineWithHistoryNavigation />
+      </MemoryRouter>,
+    )
+
+    expect(await screen.findByText('Plan restored: idea_001 / cand_001 / Reliable RAG')).toBeInTheDocument()
+    await act(async () => {
+      await user.click(screen.getByRole('button', { name: 'Open verified plan' }))
+    })
+    expect(await screen.findByText('Plan restored: idea_002 / cand_002 / Climate Evidence')).toBeInTheDocument()
+  })
 })
```

**File**: `frontend/src/pages/Research/Pipeline.tsx` (modified, +37/-15)
```diff
@@ -1,4 +1,4 @@
-import { useState, useCallback } from 'react'
+import { useState, useCallback, useEffect } from 'react'
 import { useSearchParams } from 'react-router-dom'
 import { AppPageLayout } from '@/components/layout/AppPageLayout'
 import { IdeaGenerationPanel } from '@/components/ideas/IdeaGenerationPanel'
@@ -14,19 +14,44 @@ interface CandidateSelection {
   ideaSeedQuery: string
 }
 
+const candidateFromParams = (searchParams: URLSearchParams): CandidateSelection | null => {
+  const ideaSessionId = searchParams.get('ideaSessionId')?.trim() || ''
+  if (!ideaSessionId) return null
+  return {
+    ideaSessionId,
+    ideaCandidateId: searchParams.get('ideaCandidateId')?.trim() || '',
+    ideaCandidateTitle: searchParams.get('ideaCandidateTitle')?.trim() || '',
+    ideaSeedQuery: searchParams.get('ideaSeedQuery')?.trim() || '',
+  }
+}
+
 export function ResearchPipeline() {
   const { text } = useReviewLocale()
   const [searchParams, setSearchParams] = useSearchParams()
-  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSelection | null>(() => {
-    const ideaSessionId = searchParams.get('ideaSessionId')?.trim() || ''
-    if (!ideaSessionId) return null
-    return {
-      ideaSessionId,
-      ideaCandidateId: searchParams.get('ideaCandidateId')?.trim() || '',
-      ideaCandidateTitle: searchParams.get('ideaCandidateTitle')?.trim() || '',
-      ideaSeedQuery: searchParams.get('ideaSeedQuery')?.trim() || '',
-    }
-  })
+  const [selectedCandidate, setSelectedCandidate] = useState<CandidateSelection | null>(() => candidateFromParams(searchParams))
+  const requestedPhase = searchParams.get('phase') === 'idea' ? 'idea' : searchParams.get('phase') === 'plan' ? 'plan' : ''
+  const selectedIdeaSessionId = selectedCandidate?.ideaSessionId || ''
+
+  useEffect(() => {
+    const nextCandidate = candidateFromParams(searchParams)
+    setSelectedCandidate((current) => {
+      if (!current || !nextCandidate) return nextCandidate
+      const unchanged = current.ideaSessionId === nextCandidate.ideaSessionId
+        && current.ideaCandidateId === nextCandidate.ideaCandidateId
+        && current.ideaCandidateTitle === nextCandidate.ideaCandidateTitle
+        && current.ideaSeedQuery === nextCandidate.ideaSeedQuery
+      return unchanged ? current : nextCandidate
+    })
+  }, [searchParams])
+
+  useEffect(() => {
+    if (!requestedPhase || (requestedPhase === 'plan' && !selectedIdeaSessionId)) return
+    const timer = window.setTimeout(() => {
+      document.getElementById(`pipeline-phase-${requestedPhase === 'idea' ? '1' : '2'}`)
+        ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
+    }, 80)
+    return () => window.clearTimeout(timer)
+  }, [requestedPhase, selectedIdeaSessionId])
 
   const handleCandidateSelected = useCallback((data: CandidateSelection) => {
     setSelectedCandidate(data)
@@ -35,11 +60,8 @@ export function ResearchPipeline() {
     next.set('ideaCandidateId', data.ideaCandidateId)
     next.set('ideaCandidateTitle', data.ideaCandidateTitle)
     if (data.ideaSeedQuery) next.set('ideaSeedQuery', data.ideaSeedQuery)
+    next.set('phase', 'plan')
     setSearchParams(next, { replace: true })
-    // scroll to plan section
-    setTimeout(() => {
-      document.getElementById('pipeline-phase-2')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
-    }, 100)
   }, [searchParams, setSearchParams])
 
   return (
```

**File**: `frontend/src/pages/Review/ConsistencyChecker.test.tsx` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import { StrictMode, type ReactNode } from 'react'
+import { render, screen } from '@testing-library/react'
+import { MemoryRouter } from 'react-router-dom'
+import { beforeEach, describe, expect, it, vi } from 'vitest'
+
+import { ConsistencyChecker } from './ConsistencyChecker'
+
+vi.mock('@/components/layout/AppPageLayout', () => ({
+  AppPageLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
+}))
+
+vi.mock('@/components/review/ExperimentFeedbackPanel', () => ({
+  ExperimentFeedbackPanel: () => <div>Feedback panel content</div>,
+}))
+
+vi.mock('@/lib/hooks/useApi', () => ({
+  usePapers: () => ({
+    data: [{ id: 'paper-1', title: 'ReviewX fixture paper' }],
+    isLoading: false,
+  }),
+  useReviewFindings: () => ({ data: [], isLoading: false }),
+  useRunConsistencyCheck: () => ({
+    mutate: vi.fn(),
+    isPending: false,
+    isError: false,
+    error: null,
+  }),
+}))
+
+const response = (payload: unknown, ok = true) => ({
+  ok,
+  json: async () => payload,
+}) as Response
+
+describe('ConsistencyChecker', () => {
+  beforeEach(() => {
+    window.localStorage.setItem('faros.review.locale', 'zh-CN')
+    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
+      const url = String(input)
+      if (url.includes('/history?paperId=paper-1')) {
+        return response({ reviews: [{
+          id: 'review-1',
+          paperId: 'paper-1',
+          status: 'completed',
+          budgetMode: 'balanced',
+          findingCount: 0,
+          claimCount: 3,
+          evidenceCount: 8,
+          verificationCount: 4,
+        }] })
+      }
+      if (url.endsWith('/review-1/findings')) return response([])
+      if (url.endsWith('/reviewx/review-1')) {
+        return response({
+          id: 'review-1',
+          paperId: 'paper-1',
+          scoreSuggestion: 8,
+          claims: [{ id: 'claim-1' }, { id: 'claim-2' }, { id: 'claim-3' }],
+          jsonReport: { summary: { claimCount: 3, evidenceCount: 8, verificationCount: 4 } },
+          actionItems: [],
+          riskTree: [],
+          mismatchReport: {
+            aggregate: { meanMismatch: 0.2, maxMismatch: 0.2, highMismatchClaimCount: 0, dimensionMax: {} },
+            method: { formula: 'M(c,E)=max(coverage_gap,numeric_contradiction)' },
+            claimScores: [],
+          },
+          evidenceGraph: { nodes: [], edges: [], nodeCount: 0, edgeCount: 0 },
+          modelTrace: { routingMode: 'balanced', llmCalls: [] },
+        })
+      }
+      if (url.includes('/reviews/requests?reviewId=review-1')) return response({ requests: [] })
+      if (url.includes('/reviewx/compare?')) return response({}, false)
+      return response({})
+    }))
+  })
+
+  it('keeps a deep-linked saved review loaded under React strict effects', async () => {
+    render(
+      <StrictMode>
+        <MemoryRouter initialEntries={['/review/consistency?paperId=paper-1&reviewId=review-1']}>
+          <ConsistencyChecker />
+        </MemoryRouter>
+      </StrictMode>,
+    )
+
+    expect(await screen.findByText('本次审计概览')).toBeInTheDocument()
+    expect(screen.getByText('已审计 3 条主张，未发现证据矛盾。')).toBeInTheDocument()
+    expect(screen.getByRole('button', { name: /实验反馈闭环与人工签核/ })).toHaveAttribute('aria-expanded', 'false')
+    expect(screen.queryByText('Feedback panel content')).not.toBeInTheDocument()
+  })
+})
```

---

### Incident Patch 4: `dc2b6203` (2026-09-04)
**Commit Message**: fix(ui): polish verified history navigation

**File**: `frontend/src/components/research/VerifiedResearchHistories.tsx` (modified, +46/-36)
```diff
@@ -15,11 +15,12 @@ import {
   ShieldCheck,
 } from 'lucide-react'
 import { Badge } from '@/components/ui/badge'
-import { Button } from '@/components/ui/button'
+import { Button, buttonVariants } from '@/components/ui/button'
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
 import { Skeleton } from '@/components/ui/skeleton'
 import { API_BASE_URL } from '@/lib/api'
 import { useReviewLocale } from '@/lib/reviewLocale'
+import { cn } from '@/lib/utils'
 
 interface VerifiedStage {
   id: 'idea' | 'plan' | 'code' | 'experiment' | 'paper' | 'reviewx'
@@ -159,7 +160,9 @@ export function VerifiedResearchHistories() {
         </div>
       ) : (
         <div className="grid gap-4 lg:grid-cols-2">
-          {histories.map((history) => {
+          {[...histories]
+            .sort((left, right) => right.primaryMetric.delta - left.primaryMetric.delta)
+            .map((history) => {
             const isUpdate = history.decision.code === 'apply_revision'
             const initialBlockers = history.reviewTrail.initial.severityCounts?.blocker || 0
             const finalBlockers = history.reviewTrail.final.severityCounts?.blocker || 0
@@ -169,7 +172,7 @@ export function VerifiedResearchHistories() {
 
             return (
               <Card key={history.id} className="border-slate-200 shadow-sm">
-                <CardHeader className="space-y-3 pb-3">
+                <CardHeader className="space-y-3 p-4 pb-3 sm:p-6 sm:pb-3">
                   <div className="flex flex-wrap items-center justify-between gap-2">
                     <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                       <FlaskConical className="h-4 w-4" />
@@ -190,25 +193,25 @@ export function VerifiedResearchHistories() {
                   </CardTitle>
                   <p className="text-sm leading-6 text-slate-600">{text(history.summaryZh, history.summaryEn)}</p>
                 </CardHeader>
-                <CardContent className="space-y-4">
-                  <div className="grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-200 py-3 text-center">
-                    <div className="px-2">
-                      <div className="text-lg font-bold text-slate-950">{history.provenance.testPairs.toLocaleString()}</div>
-                      <div className="text-xs text-slate-500">{text('留出测试对', 'held-out pairs')}</div>
+                <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
+                  <div className="grid grid-cols-2 border-y border-slate-200 py-3 text-center sm:grid-cols-3">
+                    <div className="border-r border-slate-200 px-2">
+                      <div className="whitespace-nowrap text-base font-bold text-slate-950 sm:text-lg">{history.provenance.testPairs.toLocaleString()}</div>
+                      <div className="text-[11px] leading-4 text-slate-500 sm:text-xs">{text('留出测试对', 'held-out pairs')}</div>
                     </div>
                     <div className="px-2">
-                      <div className={`text-lg font-bold ${history.primaryMetric.delta > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
+                      <div className={`whitespace-nowrap text-base font-bold sm:text-lg ${history.primaryMetric.delta > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                         {formatSigned(history.primaryMetric.delta)}
                       </div>
-                      <div className="text-xs text-slate-500">{history.primaryMetric.name}</div>
+                      <div className="text-[11px] leading-4 text-slate-500 sm:text-xs">{history.primaryMetric.name}</div>
                     </div>
-                    <div className="px-2">
-                      <div className="text-lg font-bold text-slate-950">{initialBlockers} → {finalBlockers}</div>
-                      <div className="text-xs text-slate-500">Blockers</div>
+                    <div className="col-span-2 mt-3 
```

---

### Incident Patch 5: `3cf4a3f1` (2026-09-03)
**Commit Message**: fix(reviewx): align verified visual evidence

**File**: `backend/app/modules/review/visual_evidence.py` (modified, +18/-5)
```diff
@@ -223,12 +223,25 @@ def _select_figures(figures: Any, mode: str, *, data_root: Optional[str]) -> Lis
     if not isinstance(figures, list):
         return []
     limit = 3 if mode == "deep" else 1
-    valid = [item for item in figures if isinstance(item, dict) and _image_payload(item, data_root=data_root)]
-    valid.sort(key=lambda item: (
-        0 if str(item.get("source", "")).startswith("paper") else 1,
-        0 if _NUMERIC_OR_RESULT_RE.search(f"{item.get('caption', '')} {item.get('title', '')}") else 1,
-        str(item.get("sourcePath") or ""),
+    valid_with_digests = []
+    for item in figures:
+        if not isinstance(item, dict):
+            continue
+        payload = _image_payload(item, data_root=data_root)
+        if payload:
+            valid_with_digests.append((item, payload["sha256"]))
+    valid_with_digests.sort(key=lambda entry: (
+        0 if str(entry[0].get("source", "")).startswith("paper") else 1,
+        0 if _NUMERIC_OR_RESULT_RE.search(f"{entry[0].get('caption', '')} {entry[0].get('title', '')}") else 1,
+        str(entry[0].get("sourcePath") or ""),
     ))
+    seen_digests: set[str] = set()
+    valid: List[Dict[str, Any]] = []
+    for item, digest in valid_with_digests:
+        if digest in seen_digests:
+            continue
+        seen_digests.add(digest)
+        valid.append(item)
     return valid[:limit]
 
 
```

**File**: `backend/tests/test_reviewx_visual_evidence.py` (modified, +47/-0)
```diff
@@ -189,6 +189,53 @@ def test_clean_visual_audit_adds_support_without_a_finding(tmp_path: Path):
     assert weak_result.findings[0].supportStatus == "needs_human_verification"
 
 
+def test_visual_audit_deduplicates_identical_images(tmp_path: Path):
+    claim = _claim()
+    first, evidence = _visual_fixture(tmp_path)
+    duplicate_path = tmp_path / "figures" / "copied-result.png"
+    duplicate_path.parent.mkdir(parents=True, exist_ok=True)
+    duplicate_path.write_bytes(PNG_BYTES)
+    duplicate = {
+        **first,
+        "id": "fig_result_copy",
+        "source": "experiment",
+        "sourcePath": "data/figures/copied-result.png",
+        "absolutePath": str(duplicate_path),
+    }
+    client = FakeVisionClient({
+        "chartType": "bar",
+        "readable": True,
+        "observations": ["Values are readable."],
+        "captionStatus": "consistent",
+        "captionRationale": "The values match.",
+        "claimAssessments": [{
+            "claimId": claim.id,
+            "status": "supported",
+            "verdict": "The figure supports the claim.",
+            "confidence": 0.9,
+        }],
+        "anomalies": [],
+    })
+
+    result = audit_visual_evidence(
+        paper={"id": claim.paperId, "title": "Duplicate visual fixture"},
+        claims=[claim],
+        evidence=[evidence],
+        links={claim.id: [evidence.id]},
+        artifacts={"visualFigures": [duplicate, first]},
+        provider_name="qwen",
+        visual_model="qwen3-vl-plus",
+        budget_mode="deep",
+        enabled=True,
+        client=client,
+        data_root=str(tmp_path),
+    )
+
+    assert result.trace["selectedFigureCount"] == 1
+    assert result.trace["auditedFigureCount"] == 1
+    assert len(client.calls) == 1
+
+
 def test_related_visual_mismatches_are_collapsed_into_one_action(tmp_path: Path):
     result, _client = _run(tmp_path, {
         "chartType": "bar",
```

**File**: `scripts/seed_verified_judge_histories.py` (modified, +26/-8)
```diff
@@ -802,6 +802,14 @@ def _seed_run_and_experiment(
         f"- Held-out accuracy: {values['beforeAccuracy']:.4f} -> {values['afterAccuracy']:.4f}\n\n"
         "The threshold proposal and gate use disjoint claim groups. The test labels were opened only after the "
         "UPDATE/KEEP decision had been frozen. Accuracy and Macro F1 are reported together to expose trade-offs.\n"
+        + (
+            f"The candidate threshold {values['proposedThreshold']:.3f} passed the independent gate and replaced "
+            f"the round-one threshold with {values['appliedThreshold']:.3f}.\n"
+            if values["gateDecision"] == "apply_revision"
+            else f"The candidate threshold {values['proposedThreshold']:.3f} failed the independent gate and was "
+            f"not applied. The retained {values['appliedThreshold']:.3f} threshold makes the authorized-policy "
+            "metric equal to round one by design; this is a successful non-update, not a failed execution.\n"
+        )
     )
     _write_json(experiment_dir / "experiment.json", experiment)
     _write_json(experiment_dir / "metrics.json", metrics)
@@ -860,15 +868,19 @@ def _seed_figure(
     axes[1].set_xlabel("Validation Macro F1 delta")
     axes[1].set_title("Claim-cluster bootstrap 95% CI", fontsize=13, fontweight="bold")
     axes[1].grid(axis="x", alpha=0.2)
-    axes[1].text(0.02, 0.08, definition["decision"].upper(), transform=axes[1].transAxes, fontsize=12, fontweight="bold", color="#0F766E" if values["gateDecision"] == "apply_revision" else "#B45309")
+    decision_label = "UPDATE" if values["gateDecision"] == "apply_revision" else "KEEP"
+    axes[1].text(0.02, 0.08, decision_label, transform=axes[1].transAxes, fontsize=12, fontweight="bold", color="#0F766E" if values["gateDecision"] == "apply_revision" else "#B45309")
+    axes[1].text(values["ciLow"], -0.16, f"{values['ciLow']:.4f}", ha="center", va="top", fontsize=10)
+    axes[1].text(values["ciHigh"], -0.16, f"{values['ciHigh']:.4f}", ha="center", va="top", fontsize=10)
     fig.suptitle(definition["titleEn"], fontsize=15, fontweight="bold", y=1.01)
     fig.tight_layout()
     fig.savefig(figure_path, dpi=180, bbox_inches="tight")
     plt.close(fig)
 
     caption = (
         f"Real-data result for {definition['dataset']}. Left: held-out Macro F1 under round one and the "
-        f"gate-authorized policy. Right: validation claim-cluster bootstrap interval; decision={values['gateDecision']}."
+        f"gate-authorized policy. Right: validation claim-cluster bootstrap interval "
+        f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}]; decision={decision_label}."
     )
     spec = {
         "id": ids["figure"],
@@ -893,12 +905,15 @@ def _seed_figure(
 def _paper_sources(definition: dict[str, Any], values: dict[str, Any], *, revised: bool) -> tuple[str, list[dict[str, str]], str]:
     references = _references(definition["dataset"])
     primary_key = references[0]["key"]
+    decision_label = "UPDATE" if values["gateDecision"] == "apply_revision" else "KEEP"
     decision_sentence = (
         f"The independent gate authorized UPDATE because its claim-cluster 95\\% interval "
         f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}] remained above zero."
         if values["gateDecision"] == "apply_revision"
         else f"The independent gate returned KEEP because its claim-cluster 95\\% interval "
-        f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}] crossed zero."
+        f"[{values['ciLow']:.4f}, {values['ciHigh']:.4f}] crossed zero. The proposed threshold "
+        f"{values['proposedThreshold']:.3f} was therefore rejected and the preregistered threshold "
+        f"{values['appliedThreshold']:.3f} remained active."
     )
     if revised:
         if values["gateDecision"] == "apply_revision":
@@ -911,9 +926,10 @@ def _paper_sources(definition: dict[str, Any], values: dict[str, Any], *, revise
             )
         else:
             result_claim = (
-               
```

---

### Incident Patch 6: `d6e7f660` (2026-09-03)
**Commit Message**: fix(reviewx): calibrate visual support gaps

**File**: `backend/app/modules/review/visual_evidence.py` (modified, +42/-7)
```diff
@@ -43,6 +43,7 @@
     "uncertainty_missing",
     "unreadable_figure",
     "claim_mismatch",
+    "claim_support_gap",
     "other",
 }
 _NUMERIC_OR_RESULT_RE = re.compile(
@@ -385,9 +386,18 @@ def _build_prompt(paper: Dict[str, Any], figure: Dict[str, Any], claims: List[Cl
 - A candidate claim may come from nearby paper text, but this one figure may not be intended to prove it.
 - If the figure simply does not discuss a candidate claim, omit that claim from claimAssessments.
 - Absence from one figure is not a contradiction or an unsupported scientific claim.
+- Captions may legitimately state sample size, provenance, or analysis that is not printed in the plot area.
+- Only report caption_mismatch when a visible label, value, direction, or legend directly conflicts with the caption.
 - Use "contradicted" only when visible content directly conflicts with a value, direction, label, or caption.
 - Ignore filenames and storage paths; they are not scientific evidence.
 
+Audit checklist:
+1. Read explicit values, labels, legend mappings, and uncertainty marks.
+2. Compare numeric magnitude and direction with each genuinely related candidate claim.
+3. Check the axis minimum and displayed range; flag axis_issue when truncation visually exaggerates a small effect.
+4. Use claim_support_gap when the visible result is directionally compatible but too weak for wording such as
+   "large", "substantial", or "significant".
+
 Paper title: {_clip(paper.get('title', 'Untitled'), 240)}
 Figure caption: {_clip(figure.get('caption', ''), 1200)}
 Candidate claims:
@@ -410,7 +420,7 @@ def _build_prompt(paper: Dict[str, Any], figure: Dict[str, Any], claims: List[Cl
   ],
   "anomalies": [
     {{
-      "type": "caption_mismatch | numeric_mismatch | trend_reversal | legend_mismatch | axis_issue | uncertainty_missing | unreadable_figure | claim_mismatch | other",
+      "type": "caption_mismatch | numeric_mismatch | trend_reversal | legend_mismatch | axis_issue | uncertainty_missing | unreadable_figure | claim_mismatch | claim_support_gap | other",
       "claimId": "supplied claimId or null",
       "severity": "blocker | major | minor | info",
       "description": "specific visible mismatch",
@@ -475,6 +485,10 @@ def _normalize_assessment(payload: Dict[str, Any], *, valid_claim_ids: set[str])
         anomaly_type = str(item.get("type") or "other").lower()
         claim_id = str(item.get("claimId") or "") or None
         severity = str(item.get("severity") or "minor").lower()
+        if anomaly_type == "caption_mismatch" and not claim_id and caption_status != "contradicted":
+            continue
+        if anomaly_type == "uncertainty_missing" and not claim_id and severity in {"blocker", "major"}:
+            severity = "minor"
         anomalies.append({
             "type": anomaly_type if anomaly_type in _ANOMALY_TYPES else "other",
             "claimId": claim_id if claim_id in valid_claim_ids else None,
@@ -569,20 +583,38 @@ def _append_assessment(
         )
 
     for item in assessment.get("claimAssessments", []):
-        if item["status"] != "contradicted" or item["claimId"] in anomaly_claims:
+        if item["claimId"] in anomaly_claims:
+            continue
+        claim = claims_by_id.get(item["claimId"])
+        if item["status"] == "contradicted":
+            anomaly_type = "claim_mismatch"
+            severity = "major"
+            suggested_fix = "Correct the figure, regenerate it from the audited metrics, or revise the paper claim."
+            acceptance = "The regenerated figure and exact claim agree on direction, values, labels, and uncertainty."
+        elif (
+            item["status"] == "weakly_supported"
+            and item["confidence"] >= 0.6
+            and claim
+            and (claim.importance == "high" or claim.claimType == "performance")
+        ):
+            anomaly_type = "claim_support_gap"
+            severity = "minor"
+            suggested_fix = "Report the visible effect siz
```

**File**: `backend/experiments/reviewx_visual_cem/run.py` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ class VisualCase:
         "truncated_axis", "bar", 0.80, 0.81,
         "The proposed method delivers a large held-out F1 improvement over the baseline.",
         "A large performance gain is visible for Proposed over Baseline.",
-        True, ("axis_issue", "claim_mismatch", "caption_mismatch"), narrow_axis=True,
+        True, ("axis_issue", "claim_mismatch", "claim_support_gap", "caption_mismatch"), narrow_axis=True,
     ),
     VisualCase(
         "clean_legend", "line", 0.70, 0.82,
```

**File**: `backend/tests/test_reviewx_visual_evidence.py` (modified, +47/-1)
```diff
@@ -42,7 +42,7 @@ def _claim() -> Claim:
 
 def _visual_fixture(tmp_path: Path):
     image = tmp_path / "papers" / "paper_visual" / "latex" / "figures" / "result.png"
-    image.parent.mkdir(parents=True)
+    image.parent.mkdir(parents=True, exist_ok=True)
     image.write_bytes(PNG_BYTES)
     figure = {
         "id": "fig_result",
@@ -142,6 +142,52 @@ def test_clean_visual_audit_adds_support_without_a_finding(tmp_path: Path):
     assert result.findings == []
     assert result.trace["anomalyCount"] == 0
 
+    metadata_result, _client = _run(tmp_path, {
+        "chartType": "bar",
+        "readable": True,
+        "observations": ["The bars are readable."],
+        "captionStatus": "partially_consistent",
+        "captionRationale": "The sample size is stated only in the caption.",
+        "claimAssessments": [],
+        "anomalies": [
+            {
+                "type": "caption_mismatch",
+                "claimId": None,
+                "severity": "major",
+                "description": "The sample size is not printed in the plot.",
+                "confidence": 0.9,
+            },
+            {
+                "type": "uncertainty_missing",
+                "claimId": None,
+                "severity": "major",
+                "description": "No uncertainty marker is visible.",
+                "confidence": 0.85,
+            },
+        ],
+    })
+    assert len(metadata_result.findings) == 1
+    assert metadata_result.findings[0].riskType == "visual_uncertainty_missing"
+    assert metadata_result.findings[0].severity == "minor"
+
+    weak_result, _client = _run(tmp_path, {
+        "chartType": "bar",
+        "readable": True,
+        "observations": ["The visible improvement is 0.01."],
+        "captionStatus": "partially_consistent",
+        "captionRationale": "The direction agrees but the effect is small.",
+        "claimAssessments": [{
+            "claimId": "claim_001",
+            "status": "weakly_supported",
+            "verdict": "The visible effect is too small for the strength of the claim.",
+            "confidence": 0.8,
+        }],
+        "anomalies": [],
+    })
+    assert len(weak_result.findings) == 1
+    assert weak_result.findings[0].riskType == "visual_claim_support_gap"
+    assert weak_result.findings[0].supportStatus == "needs_human_verification"
+
 
 def test_related_visual_mismatches_are_collapsed_into_one_action(tmp_path: Path):
     result, _client = _run(tmp_path, {
```

---

### Incident Patch 7: `f8ff427a` (2026-09-03)
**Commit Message**: fix(reviewx): resolve migrated figure paths

**File**: `backend/app/modules/review/artifact_collector.py` (modified, +34/-23)
```diff
@@ -91,20 +91,26 @@ def _valid_visual_path(path: str) -> tuple[str, str] | None:
     return (real, mime) if mime else None
 
 
-def _resolve_visual_path(candidate: str, roots: List[str]) -> tuple[str, str] | None:
-    value = str(candidate or "").strip()
-    if not value:
-        return None
-    possibilities = [value] if os.path.isabs(value) else [os.path.join(root, value) for root in roots]
-    expanded: List[str] = []
-    for path in possibilities:
-        expanded.append(path)
-        if not os.path.splitext(path)[1]:
-            expanded.extend(path + suffix for suffix in _VISUAL_SUFFIXES)
-    for path in expanded:
-        resolved = _valid_visual_path(path)
-        if resolved:
-            return resolved
+def _resolve_visual_path(candidates: Any, roots: List[str]) -> tuple[str, str] | None:
+    values = candidates if isinstance(candidates, (list, tuple)) else [candidates]
+    for candidate in values:
+        value = str(candidate or "").strip()
+        if not value:
+            continue
+        possibilities = [value] if os.path.isabs(value) else [os.path.join(root, value) for root in roots]
+        expanded: List[str] = []
+        for path in possibilities:
+            stem, suffix = os.path.splitext(path)
+            if suffix.lower() in _VISUAL_SUFFIXES:
+                expanded.append(path)
+            elif suffix:
+                expanded.extend(stem + visual_suffix for visual_suffix in _VISUAL_SUFFIXES)
+            else:
+                expanded.extend(path + visual_suffix for visual_suffix in _VISUAL_SUFFIXES)
+        for path in expanded:
+            resolved = _valid_visual_path(path)
+            if resolved:
+                return resolved
     return None
 
 
@@ -131,7 +137,7 @@ def _collect_visual_figures(
     by_path: Dict[str, Dict[str, Any]] = {}
 
     def add(
-        candidate: str,
+        candidate: Any,
         *,
         roots: List[str],
         caption: str = "",
@@ -177,7 +183,12 @@ def add(
             figure_id = figure.get("id")
             fallback_root = os.path.join(_DATA_DIR, "figures", str(figure_id or ""))
             add(
-                str(figure.get("pathPng") or figure.get("fileNamePng") or ""),
+                [
+                    figure.get("pathPng"),
+                    figure.get("fileNamePng"),
+                    figure.get("fileName"),
+                    figure.get("pathPdf"),
+                ],
                 roots=[fallback_root, latex_root],
                 caption=str(figure.get("caption") or ""),
                 title=str(figure.get("title") or figure.get("figureType") or ""),
@@ -189,13 +200,13 @@ def add(
     for figure in paper.get("selectedFigures", []) or []:
         if not isinstance(figure, dict):
             continue
-        candidate = str(
-            figure.get("pngPath")
-            or figure.get("pathPng")
-            or figure.get("path")
-            or figure.get("fileNamePng")
-            or ""
-        )
+        candidate = [
+            figure.get("pngPath"),
+            figure.get("pathPng"),
+            figure.get("path"),
+            figure.get("fileNamePng"),
+            figure.get("filename"),
+        ]
         add(
             candidate,
             roots=[latex_root, os.path.join(latex_root, "figures"), os.path.join(latex_root, "Figures")],
```

**File**: `backend/tests/test_reviewx_visual_evidence.py` (modified, +18/-3)
```diff
@@ -276,6 +276,18 @@ def test_artifact_collector_discovers_latex_figure_and_rejects_fake_image(monkey
     figures_dir.mkdir(parents=True)
     (figures_dir / "result.png").write_bytes(PNG_BYTES)
     (figures_dir / "fake.png").write_text("not an image", encoding="utf-8")
+    experiment_figure_dir = tmp_path / "figures" / "fig_migrated"
+    experiment_figure_dir.mkdir(parents=True)
+    (experiment_figure_dir / "migrated.png").write_bytes(PNG_BYTES)
+    experiment_dir = tmp_path / "experiments" / "exp_migrated"
+    experiment_dir.mkdir(parents=True)
+    (experiment_dir / "experiment.json").write_text("{}", encoding="utf-8")
+    (experiment_dir / "figures.json").write_text(json.dumps([{
+        "id": "fig_migrated",
+        "pathPng": "/retired/developer/workspace/migrated.png",
+        "fileNamePng": "migrated.png",
+        "caption": "Migrated experiment figure.",
+    }]), encoding="utf-8")
     tex = r"""
     \begin{figure}
       \includegraphics{Figures/result.png}
@@ -288,7 +300,7 @@ def test_artifact_collector_discovers_latex_figure_and_rejects_fake_image(monkey
     monkeypatch.setattr(artifact_collector, "_BASE_DIR", str(tmp_path.parent))
     monkeypatch.setattr(artifact_collector, "get_paper", lambda _paper_id: {
         "id": paper_id,
-        "experimentIds": [],
+        "experimentIds": ["exp_migrated"],
         "selectedFigures": [],
     })
     monkeypatch.setattr(artifact_collector, "list_paper_files", lambda _paper_id: [{
@@ -300,9 +312,12 @@ def test_artifact_collector_discovers_latex_figure_and_rejects_fake_image(monkey
 
     artifacts = artifact_collector.collect_reviewx_artifacts(paper_id)
 
-    assert len(artifacts["visualFigures"]) == 1
-    visual = artifacts["visualFigures"][0]
+    assert len(artifacts["visualFigures"]) == 2
+    visual = next(item for item in artifacts["visualFigures"] if item["source"] == "paper_latex")
     assert visual["source"] == "paper_latex"
     assert visual["mimeType"] == "image/png"
     assert visual["caption"] == "F1 comparison on the held-out set."
     assert visual["sourcePath"].endswith("Figures/result.png")
+    migrated = next(item for item in artifacts["visualFigures"] if item["source"] == "experiment")
+    assert migrated["sourcePath"].endswith("figures/fig_migrated/migrated.png")
+    assert migrated["caption"] == "Migrated experiment figure."
```

---

### Incident Patch 8: `9c5942de` (2026-09-03)
**Commit Message**: fix(code): validate complete generated artifacts

**File**: `backend/app/modules/code/codegen_sessions_api.py` (modified, +5/-6)
```diff
@@ -26,6 +26,7 @@
     get_plan_session_storage,
 )
 from app.services.code_project_service import create_project
+from app.db import crud
 from app.db.engine import get_session_context
 from app.core.settings import get_settings
 from app.core.user_context import call_with_current_context
@@ -325,17 +326,15 @@ async def validate_codegen_repo(session_id: str):
     if session.status != "completed":
         raise HTTPException(status_code=400, detail="Session not completed yet")
 
-    # Load files from project
+    # Read the complete persisted file index.  The tree API only returns one
+    # directory level, which would under-count generated repositories.
     project_id = session.projectId
     try:
-        from app.services.code_project_service import get_file_tree, read_file_content
-        from app.db.engine import get_session_context
         with get_session_context() as db:
-            tree = get_file_tree(db, project_id)
+            files = crud.list_project_files(db, project_id)
+            paths = [str(record.path) for record in files if not bool(record.is_dir)]
     except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to load project files: {e}")
-
-    paths = [n.get("path", "") for n in (tree or []) if not n.get("is_dir")]
     issues = []
     required = ["README.md"]
     for req in required:
```

**File**: `backend/app/modules/code/tests/test_challenge_cup_code.py` (modified, +41/-0)
```diff
@@ -3,7 +3,9 @@
 import asyncio
 import json
 import zipfile
+from contextlib import contextmanager
 from pathlib import Path
+from types import SimpleNamespace
 
 import pytest
 from fastapi import HTTPException
@@ -178,6 +180,45 @@ def get_by_idea_session(self, idea_session_id):
     assert context["method"] == package.principle.mechanism
 
 
+def test_codegen_validation_reads_complete_persisted_file_index(monkeypatch):
+    session = SimpleNamespace(status="completed", projectId="cproj_validation")
+    records = [
+        SimpleNamespace(path="README.md", is_dir=False),
+        SimpleNamespace(path="docs/method.md", is_dir=False),
+        SimpleNamespace(path="tests/test_pipeline.py", is_dir=False),
+        SimpleNamespace(path=".github/workflows/ci.yml", is_dir=False),
+        SimpleNamespace(path="src/model.py", is_dir=False),
+    ]
+    records.extend(
+        SimpleNamespace(path=f"src/components/component_{index}.py", is_dir=False)
+        for index in range(35)
+    )
+
+    @contextmanager
+    def fake_session_context():
+        yield object()
+
+    monkeypatch.setattr(codegen_sessions_api, "get_session", lambda _session_id: session)
+    monkeypatch.setattr(codegen_sessions_api, "get_session_context", fake_session_context)
+    monkeypatch.setattr(
+        codegen_sessions_api.crud,
+        "list_project_files",
+        lambda _db, project_id: records if project_id == session.projectId else [],
+    )
+
+    result = asyncio.run(codegen_sessions_api.validate_codegen_repo("cgs_validation"))
+
+    assert result["fileCount"] == 40
+    assert result["qualityScore"] == 100
+    assert result["passed"] is True
+    assert result["categories"] == {
+        "tests": True,
+        "ci": True,
+        "db": True,
+        "docs": 2,
+    }
+
+
 def test_evidence_requires_existing_reproducibility_artifacts(tmp_path):
     cart = _build_cart(tmp_path)
     first = build_experiment_evidence(cart, _ready_assessment())
```

**File**: `backend/app/modules/review/artifact_collector.py` (modified, +31/-5)
```diff
@@ -13,6 +13,14 @@
 
 _BASE_DIR = str(get_data_dir().parent)
 _DATA_DIR = str(get_data_dir())
+_REVIEWABLE_CODE_SUFFIXES = {
+    ".cfg", ".ini", ".json", ".md", ".py", ".sh", ".toml", ".txt", ".yaml", ".yml",
+}
+_REVIEWABLE_CODE_NAMES = {"Dockerfile", "LICENSE", "Makefile"}
+_IGNORED_CODE_DIRS = {
+    ".git", ".mypy_cache", ".pytest_cache", ".ruff_cache", ".venv",
+    "__pycache__", "node_modules", "venv",
+}
 
 
 def _read_json(path: str, fallback: Any) -> Any:
@@ -84,16 +92,17 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
             for root, _dirs, files in os.walk(exports_dir):
                 for name in files:
                     abs_path = os.path.join(root, name)
-                    if os.path.getsize(abs_path) > 250_000:
-                        continue
+                    size_bytes = os.path.getsize(abs_path)
                     content = ""
-                    if name.endswith((".json", ".md", ".txt", ".py", ".yaml", ".yml")):
+                    if size_bytes <= 250_000 and name.endswith((".json", ".md", ".txt", ".py", ".yaml", ".yml")):
                         with open(abs_path, encoding="utf-8", errors="replace") as f:
                             content = f.read()[:5000]
                     code_artifacts.append({
                         "path": _safe_rel(abs_path),
                         "name": name,
                         "content": content,
+                        "sizeBytes": size_bytes,
+                        "contentOmitted": bool(size_bytes > 250_000),
                     })
         repo_dir = os.path.join(project_dir, "repo")
         evidence_dir = os.path.join(repo_dir, "artifacts", "evidence")
@@ -103,9 +112,10 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
         experiment_evidence = _read_json(
             os.path.join(evidence_dir, "experiment_evidence.json"), {}
         )
-        reviewable_paths = [
+        preferred_paths = [
             "src/main.py",
             "configs/experiment.json",
+            "configs/experiment.yaml",
             "metrics.json",
             "evaluation_records.json",
             "experiment_report.md",
@@ -116,7 +126,21 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
             "artifacts/evidence/experiment_evidence.json",
         ]
         seen_paths = {item["path"] for item in code_artifacts}
-        for rel_path in reviewable_paths:
+        reviewable_paths = list(preferred_paths)
+        if os.path.isdir(repo_dir):
+            discovered: List[str] = []
+            for root, dirs, files in os.walk(repo_dir):
+                dirs[:] = sorted(item for item in dirs if item not in _IGNORED_CODE_DIRS)
+                for name in sorted(files):
+                    suffix = os.path.splitext(name)[1].lower()
+                    if suffix not in _REVIEWABLE_CODE_SUFFIXES and name not in _REVIEWABLE_CODE_NAMES:
+                        continue
+                    discovered.append(os.path.relpath(os.path.join(root, name), repo_dir))
+            reviewable_paths.extend(discovered)
+
+        for rel_path in dict.fromkeys(reviewable_paths):
+            if len(code_artifacts) >= 80:
+                break
             abs_path = os.path.join(repo_dir, rel_path)
             safe_path = _safe_rel(abs_path)
             if safe_path in seen_paths or not os.path.isfile(abs_path) or os.path.getsize(abs_path) > 250_000:
@@ -127,6 +151,8 @@ def collect_reviewx_artifacts(paper_id: str) -> Dict[str, Any]:
                 "path": safe_path,
                 "name": os.path.basename(abs_path),
                 "content": content,
+                "sizeBytes": os.path.getsize(abs_path),
+                "contentOmitted": False,
             })
             seen_paths.add(safe_path)
 
```

**File**: `backend/tests/test_reviewx_cem.py` (modified, +40/-0)
```diff
@@ -1,5 +1,6 @@
 from app.modules.review.cem_guidance import annotate_risk_tree_with_mismatch
 from app.modules.review.cem_guidance import build_cem_budget_plan
+from app.modules.review import artifact_collector
 from app.modules.review.evidence_verifier import verify_claim_evidence
 from app.modules.review.mismatch_scorer import build_mismatch_report
 from app.modules.review.model_router import (
@@ -49,6 +50,45 @@ def _finding(**updates) -> Finding:
     return Finding(**data)
 
 
+def test_artifact_collector_keeps_large_export_and_discovers_nested_source(monkeypatch, tmp_path):
+    project_id = "cproj_artifacts"
+    project_dir = tmp_path / "code_projects" / project_id
+    exports_dir = project_dir / "exports"
+    repo_dir = project_dir / "repo"
+    exports_dir.mkdir(parents=True)
+    (exports_dir / "project.zip").write_bytes(b"x" * 250_001)
+    (repo_dir / "src" / "package").mkdir(parents=True)
+    (repo_dir / "src" / "package" / "model.py").write_text("def run():\n    return 1\n", encoding="utf-8")
+    (repo_dir / "configs").mkdir()
+    (repo_dir / "configs" / "experiment.yaml").write_text("seed: 42\n", encoding="utf-8")
+    (repo_dir / ".venv").mkdir()
+    (repo_dir / ".venv" / "ignored.py").write_text("secret = True\n", encoding="utf-8")
+
+    monkeypatch.setattr(artifact_collector, "_DATA_DIR", str(tmp_path))
+    monkeypatch.setattr(artifact_collector, "_BASE_DIR", str(tmp_path.parent))
+    monkeypatch.setattr(
+        artifact_collector,
+        "get_paper",
+        lambda _paper_id: {
+            "id": "paper_artifacts",
+            "projectId": project_id,
+            "experimentIds": [],
+        },
+    )
+    monkeypatch.setattr(artifact_collector, "list_paper_files", lambda _paper_id: [])
+
+    result = artifact_collector.collect_reviewx_artifacts("paper_artifacts")
+    names = {item["name"] for item in result["codeArtifacts"]}
+    paths = {item["path"] for item in result["codeArtifacts"]}
+
+    assert {"project.zip", "model.py", "experiment.yaml"} <= names
+    assert not any(".venv" in path for path in paths)
+    export = next(item for item in result["codeArtifacts"] if item["name"] == "project.zip")
+    assert export["content"] == ""
+    assert export["contentOmitted"] is True
+    assert export["sizeBytes"] == 250_001
+
+
 def test_mismatch_report_keeps_raw_and_calibrated_scores():
     claim = _claim()
     evidence = Evidence(
```

---

### Incident Patch 9: `921b0e66` (2026-09-03)
**Commit Message**: fix(reviewx): honor official dossier release

**File**: `backend/app/modules/review/reviews_api.py` (modified, +12/-1)
```diff
@@ -1874,6 +1874,7 @@ async def get_experiment_signoffs_endpoint(feedback_id: str) -> HumanSignoffResp
 )
 async def get_experiment_signoff_dossier_endpoint(
     feedback_id: str,
+    release: Literal["draft", "official"] = "draft",
     response: Response = None,
 ) -> SignoffDossier:
     record = get_experiment_feedback(feedback_id)
@@ -1882,7 +1883,17 @@ async def get_experiment_signoff_dossier_endpoint(
     if response is not None:
         response.headers["Cache-Control"] = "no-store"
         response.headers["X-Content-Type-Options"] = "nosniff"
-    return build_signoff_dossier(record, release="draft")
+    try:
+        return build_signoff_dossier(record, release=release)
+    except ValueError as exc:
+        raise HTTPException(
+            status_code=409,
+            detail={
+                "code": "OFFICIAL_DOSSIER_LOCKED",
+                "message": str(exc),
+                "nextStep": "Complete all current ReviewX signoffs and resolve every blocker.",
+            },
+        ) from exc
 
 
 @router.get(
```

**File**: `backend/tests/test_reviewx_signoff_dossier.py` (modified, +24/-0)
```diff
@@ -148,6 +148,30 @@ def test_official_html_requires_publication_ready(monkeypatch, tmp_path: Path):
     assert response.headers["cache-control"] == "no-store"
 
 
+def test_official_json_requires_publication_ready_and_preserves_release(monkeypatch, tmp_path: Path):
+    monkeypatch.setattr(experiment_feedback_storage, "_STORAGE_DIR", tmp_path)
+    stored = experiment_feedback_storage.create_experiment_feedback(_record())
+    with pytest.raises(HTTPException) as blocked:
+        asyncio.run(reviews_api.get_experiment_signoff_dossier_endpoint(
+            stored["id"], "official"
+        ))
+    assert blocked.value.status_code == 409
+
+    _approve(stored, "plan")
+    _approve(stored, "conclusion")
+    experiment_feedback_storage.update_experiment_feedback(
+        stored["id"], {"humanSignoffs": stored["humanSignoffs"]}
+    )
+    response = Response()
+    dossier = asyncio.run(reviews_api.get_experiment_signoff_dossier_endpoint(
+        stored["id"], "official", response
+    ))
+    assert dossier.release == "official"
+    assert dossier.watermark is None
+    assert response.headers["cache-control"] == "no-store"
+    assert response.headers["x-content-type-options"] == "nosniff"
+
+
 def test_raw_bundle_remains_backward_compatible(monkeypatch, tmp_path: Path):
     monkeypatch.setattr(experiment_feedback_storage, "_STORAGE_DIR", tmp_path)
     stored = experiment_feedback_storage.create_experiment_feedback(_record())
```

---

### Incident Patch 10: `665da59c` (2026-09-02)
**Commit Message**: fix(reviewx): harden production signoff gates

**File**: `backend/app/modules/review/audit_chain.py` (modified, +33/-1)
```diff
@@ -90,7 +90,39 @@ def record_audit_integrity(record: Dict[str, Any]) -> Dict[str, Any]:
                     }
         streams[f"signoff:{stage}"] = state
     for condition_id, item in (record.get("humanFeedbackVerifications") or {}).items():
-        streams[f"condition:{condition_id}"] = verify_history((item or {}).get("history") or [])
+        verification = item or {}
+        history = verification.get("history") or []
+        state = verify_history(history)
+        status = str(verification.get("status") or "pending")
+        if state["valid"] and status != "pending":
+            if not history:
+                state = {**state, "valid": False, "reason": "decision_missing_from_history"}
+            else:
+                head = history[-1]
+                sealed_fields = (
+                    "verificationId",
+                    "status",
+                    "subjectHash",
+                    "verifierRole",
+                    "verifierId",
+                    "actorAccountId",
+                    "actorRole",
+                    "authAssurance",
+                    "rationale",
+                    "evidenceArtifactIds",
+                    "decidedAt",
+                )
+                mismatches = [
+                    field for field in sealed_fields if verification.get(field) != head.get(field)
+                ]
+                if mismatches:
+                    state = {
+                        **state,
+                        "valid": False,
+                        "reason": "stored_state_differs_from_history_head",
+                        "mismatchedFields": mismatches,
+                    }
+        streams[f"condition:{condition_id}"] = state
     invalid = [name for name, state in streams.items() if not state["valid"]]
     return {
         "valid": not invalid,
```

**File**: `backend/app/modules/review/human_feedback_verification.py` (modified, +6/-0)
```diff
@@ -111,6 +111,9 @@ def decide_human_condition_verification(
     verifier_id: str,
     rationale: str,
     evidence_artifact_ids: Iterable[str] = (),
+    actor_account_id: str | None = None,
+    actor_role: str | None = None,
+    auth_assurance: str = "self_reported",
 ) -> Dict[str, Any]:
     if status not in VERIFICATION_STATUSES or status == "pending":
         raise ValueError("Verification must be passed, failed, or waived")
@@ -146,6 +149,9 @@ def decide_human_condition_verification(
         "subjectHash": current["subjectHash"],
         "verifierRole": verifier_role.strip(),
         "verifierId": verifier_id.strip(),
+        "actorAccountId": (actor_account_id or verifier_id).strip(),
+        "actorRole": (actor_role or "legacy_verifier").strip(),
+        "authAssurance": auth_assurance.strip() or "self_reported",
         "rationale": rationale.strip(),
         "evidenceArtifactIds": evidence_ids,
         "decidedAt": decided_at,
```

**File**: `backend/app/modules/review/human_signoff.py` (modified, +11/-0)
```diff
@@ -267,6 +267,8 @@ def require_human_signoff(record: Dict[str, Any], stage: str) -> Dict[str, Any]:
 
 
 def publication_ready(record: Dict[str, Any]) -> bool:
+    if record.get("reviewPurpose") == "technical_test":
+        return False
     if record.get("publicationEligible", True) is not True:
         return False
     if not record_audit_integrity(record)["valid"]:
@@ -283,6 +285,7 @@ def publication_ready(record: Dict[str, Any]) -> bool:
             require_human_signoff(record, "repair")
         require_human_signoff(record, "conclusion")
         from app.modules.review.human_feedback_verification import (
+            human_condition_verification_state,
             require_human_conditions_resolved,
         )
 
@@ -307,5 +310,13 @@ def publication_ready(record: Dict[str, Any]) -> bool:
                 set(item.get("acknowledgements") or [])
             ):
                 return False
+        condition_state = human_condition_verification_state(record)
+        for item in condition_state.get("conditions") or []:
+            if item.get("status") not in {"passed", "waived"}:
+                return False
+            if item.get("authAssurance") != "trusted_proxy_basic_auth":
+                return False
+            if not stored_actor_is_authorized(str(item.get("actorAccountId") or "")):
+                return False
     gate = str((record.get("qualityAssessment") or {}).get("gateStatus") or "").lower()
     return gate != "fail" and _blocker_count(record) == 0
```

**File**: `backend/app/modules/review/reviews_api.py` (modified, +4/-1)
```diff
@@ -2171,7 +2171,7 @@ async def decide_human_condition_verification_endpoint(
     if record is None:
         raise HTTPException(status_code=404, detail=f"Experiment feedback '{feedback_id}' not found")
     try:
-        authorize_reviewer(
+        principal = authorize_reviewer(
             stage="condition",
             reviewer_role=req.verifierRole,
             reviewer_id=req.verifierId,
@@ -2186,6 +2186,9 @@ async def decide_human_condition_verification_endpoint(
             verifier_id=req.verifierId,
             rationale=req.rationale,
             evidence_artifact_ids=req.evidenceArtifactIds,
+            actor_account_id=str(principal.get("actorAccountId") or ""),
+            actor_role=str(principal.get("actorRole") or ""),
+            auth_assurance=str(principal.get("authAssurance") or principal.get("assurance") or ""),
         )
     except ReviewAuthenticationError as exc:
         raise HTTPException(status_code=401, detail=str(exc)) from exc
```

**File**: `backend/tests/test_reviewx_human_signoff.py` (modified, +35/-1)
```diff
@@ -169,7 +169,9 @@ def test_inherited_human_conditions_require_current_evidence_before_conclusion()
 def test_technical_test_record_can_never_become_publication_ready():
     record = _record(decision="accept_results")
     record["reviewPurpose"] = "technical_test"
-    record["publicationEligible"] = False
+    # The purpose itself is a hard gate even if an upstream producer sets the
+    # eligibility flag incorrectly.
+    record["publicationEligible"] = True
     record["humanSignoffs"] = initialize_human_signoffs(record)
 
     for stage in ("plan", "conclusion"):
@@ -186,6 +188,38 @@ def test_technical_test_record_can_never_become_publication_ready():
     assert publication_ready(record) is False
 
 
+def test_condition_state_tampering_revokes_publication():
+    record = _record(decision="accept_results")
+    record["inheritedHumanFeedback"] = {
+        "feedbackHash": "sha256:human-feedback",
+        "items": [{
+            "decisionId": "hsd_parent",
+            "stage": "plan",
+            "status": "changes_requested",
+            "conditions": ["Record the leakage check as an artifact"],
+        }],
+    }
+    _approve(record, "plan")
+    condition_id = human_condition_verification_state(record)["conditions"][0]["conditionId"]
+    record["humanFeedbackVerifications"] = decide_human_condition_verification(
+        record,
+        condition_id=condition_id,
+        status="passed",
+        verifier_role="domain_expert",
+        verifier_id="expert@example.com",
+        rationale="Leakage report checked against the experiment evidence.",
+        evidence_artifact_ids=["artifact-1"],
+    )
+    _approve(record, "conclusion")
+    assert publication_ready(record) is True
+
+    record["humanFeedbackVerifications"][condition_id]["rationale"] = "tampered"
+    integrity = record_audit_integrity(record)
+    assert integrity["valid"] is False
+    assert integrity["invalidStreams"] == [f"condition:{condition_id}"]
+    assert publication_ready(record) is False
+
+
 def test_formal_conclusion_requires_a_different_reviewer_from_plan():
     record = _record(decision="accept_results")
     record["enforceReviewerSeparation"] = True
```

#### Recent Merged Pull Requests:
- **PR #42** (2026-08-12): feat(paper): 重构 FAROS paper 写作流程，引入 compile/review 多 agent 反馈循环 (@Ironknory)
- **PR #41** (2026-08-11): feat(code): 完善科学执行评估、可复现实验证据与结果导入流程 (@Eg4m1)
- **PR #36** (2026-08-04): Devtzb paper (@Ironknory)
- **PR #25** (2026-08-11): feat(idea): 搜索源扩充 + seed预检 + 公共契约对齐 + Review Gate修复 + 前端Dossier查看器 (@ryry12345ryry)
- **PR #24** (2026-07-14): feat: Idea Pipeline性能优化 + 强制多方向探索 (@ryry12345ryry)
- **PR #22** (2026-07-12): fix: 修复中文(CJK)Topic系统性偏差 — 9个Bug修复 + 学术搜索增强 (@ryry12345ryry)
- **PR #21** (closed): Devtzb (@ryry12345ryry)
- **PR #19** (2026-07-06): 优化 Code 模块 PlanPackage 执行链路与智能体进度展示 (@Eg4m1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
