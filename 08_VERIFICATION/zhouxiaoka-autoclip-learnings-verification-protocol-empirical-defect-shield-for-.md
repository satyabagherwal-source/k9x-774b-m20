# Verification Protocol: Verification Protocol: Empirical Defect Shield for zhouxiaoka-autoclip-learnings

<!-- PROVENANCE_START
{
  "source_repository": "zhouxiaoka-autoclip-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T13:26:49.855Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zhouxiaoka-autoclip-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zhouxiaoka-autoclip-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T13:26:49.855Z`  
> **Learning ID**: `LEARN-EVO-zhouxiaoka-autoclip-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `zhouxiaoka-autoclip-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zhouxiaoka-autoclip-learnings.md`  
> **Source**: github ([https://github.com/zhouxiaoka/autoclip](https://github.com/zhouxiaoka/autoclip))  
> **Source Version**: `2f511907`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T13:26:27.334Z  
> **Learning ID**: `learn-github-zhouxiaoka-autoclip`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zhouxiaoka/autoclip

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhouxiaoka-autoclip-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhouxiaoka/autoclip](https://github.com/zhouxiaoka/autoclip))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-26T13:26:27.163Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zhouxiaoka/autoclip`
- **Description**: The open-source OpusClip alternative — local-first AI clipping & MCP server, zero subscriptions. AutoClip｜一个链接，一键出片。开源 AI 视频剪辑桌面工具，将播客、访谈、课程等长视频自动剪成短视频，生成字幕、封面和发布文案，适配抖音、小红书、TikTok、Reels 与 YouTube Shorts。
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 16677 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/api/upload_queue.py`
```
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from ..core.database import get_db
from ..services.upload_queue_service import UploadQueueService, TaskPriority
# from ..utils.auth import get_current_user  # 暂时注释掉，如需要可以实现

router = APIRouter(prefix="/api/upload-queue", tags=["upload-queue"])

# 请求模型
class UploadTaskRequest(BaseModel):
    video_path: str
    title: str
    description: str = ""
    tags: str = ""
    account_id: Optional[int] = None
    priority: str = "normal"  # low, normal, high, urgent

class BatchUploadRequest(BaseModel):
    tasks: List[UploadTaskRequest]

class TaskResponse(BaseModel):
    task_id: str
    video_path: str
    title: str
    description: str
    tags: str
    account_id: Optional[int]
    priority: int
    status: str
    created_at: str
    updated_at: str
    progress: int
    error_message: Optional[str]
    retry_count: int
    max_retries: int
    celery_task_id: Optional[str]

class QueueStatusResponse(BaseModel):
    queued_tasks: int
    processing_tasks: int
    max_concurrent: int
    queue_details: List[Dict[str, Any]]
    processing_details: List[Dict[str, Any]]

# 全局队列服务实例
queue_services: Dict[int, UploadQueueService] = {}

def get_queue_service(db: Session = Depends(get_db)) -> UploadQueueService:
    """获取队列服务实例"""
    # 暂时使用默认用户ID，后续可以添加认证
    user_id = 1
    
    if user_id not in queue_services:
        queue_services[user_id] = UploadQueueService(db)
    
    return queue_services[user_id]

@router.post("/add-task", response_model=Dict[str, str])
async def add_upload_task(
    request: UploadTaskRequest,
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """添加单个上传任务"""
    try:
        # 转换优先级
        priority_map = {
            "low": TaskPriority.LOW,
            "normal": TaskPriority.NORMAL,
            "high": TaskPriority.HIGH,
            "urgent": TaskPriority.URGENT
        }
        priority = priority_map.get(request.priority.lower(), TaskPriority.NORMAL)
        
        task_id = queue_service.add_task(
            video_path=request.video_path,
            title=request.title,
            description=request.description,
            tags=request.tags,
            account_id=request.account_id,
            priority=priority
        )
        
        return {"task_id": task_id, "message": "任务已添加到队列"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/add-batch-tasks", response_model=Dict[str, Any])
async def add_batch_upload_tasks(
    request: BatchUploadRequest,
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """批量添加上传任务"""
    try:
        # 转换任务数据
        tasks_data = []
        priority_map = {
            "low": TaskPriority.LOW,
            "normal": TaskPriority.NORMAL,
            "high": TaskPriority.HIGH,
            "urgent": TaskPriority.URGENT
        }
        
        for task_req in request.tasks:
            priority = priority_map.get(task_req.priority.lower(), TaskPriority.NORMAL)
            tasks_data.append({
                "video_path": task_req.video_path,
                "title": task_req.title,
                "description": task_req.description,
                "tags": task_req.tags,
                "account_id": task_req.account_id,
                "priority": priority
            })
        
        task_ids = queue_service.add_batch_tasks(tasks_data)
        
        return {
            "task_ids": task_ids,
            "count": len(task_ids),
            "message": f"已添加 {len(task_ids)} 个任务到队列"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/task/{task_id}", response_model=Optional[TaskResponse])
async def get_task_status(
    task_id: str,
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """获取任务状态"""
    try:
        task_status = queue_service.get_task_status(task_id)
        if not task_status:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        return task_status
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/task/{task_id}")
async def cancel_task(
    task_id: str,
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """取消任务"""
    try:
        success = queue_service.cancel_task(task_id)
        if not success:
            raise HTTPException(status_code=404, detail="任务不存在或无法取消")
        
        return {"message": "任务已取消"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status", response_model=QueueStatusResponse)
async def get_queue_status(
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """获取队列状态"""
    try:
        status = queue_service.get_queue_status()
        return status
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retry/{task_id}")
async def retry_failed_task(
    task_id: str,
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """重试失败的任务"""
    try:
        # 获取任务状态
        task_status = queue_service.get_task_status(task_id)
        if not task_status:
            raise HTTPException(status_code=404, detail="任务不存在")
        
        if task_status["status"] != "failed":
            raise HTTPException(status_code=400, detail="只能重试失败的任务")
        
        # 重新添加任务
        new_task_id = queue_service.add_task(
            video_path=task_status["video_path"],
            title=task_status["title"],
            description=task_status["description"],
            tags=task_status["tags"],
            account_id=task_status["account_id"],
            priority=TaskPriority(task_status["priority"])
        )
        
        return {
            "new_task_id": new_task_id,
            "message": "任务已重新添加到队列"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_upload_history(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    # current_user = Depends(get_current_user)  # 暂时移除认证
):
    """获取上传历史记录"""
    try:
        from ..models.bilibili import BilibiliUploadRecord
        
        query = db.query(BilibiliUploadRecord)
        
        if status:
            query = query.filter(BilibiliUploadRecord.status == status)
        
        # 按创建时间倒序
        records = query.order_by(BilibiliUploadRecord.created_at.desc()).offset(offset).limit(limit).all()
        
        return {
            "records": [
                {
                    "id": record.id,
                    "task_id": record.task_id,
                    "title": record.title,
                    "bv_id": record.bv_id,
                    "status": record.status,
                    "account_id": record.account_id,
                    "created_at": record.created_at.isoformat(),
                    "updated_at": record.updated_at.isoformat() if record.updated_at else None,
                    "error_message": record.error_message
                }
                for record in records
            ],
            "total": query.count()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear-completed")
async def clear_completed_tasks(
    queue_service: UploadQueueService = Depends(get_queue_service)
):
    """清理已完成的任务"""
    try:
        # 这里可以添加清理逻辑
        # 由于任务完成后会自动从内存队列中移除，主要是清理数据库中的旧记录
        return {"message": "已完成任务清理"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/statistics")
async def get_upload_statistics(
    days: int = 7,
    db: Session = Depends(get_db),
    # current_user = Depends(get_current_user)  # 暂时移除认证
):
    """获取上传统计信息"""
    try:
        from ..models.bilibili import BilibiliUploadRecord
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        # 计算时间范围
        start_date = datetime.now() - timedelta(days=days)
        
        # 总体统计
        total_uploads = db.query(BilibiliUploadRecord).filter(
            BilibiliUploadRecord.created_at >= start_date
        ).count()
        
        successful_uploads = db.query(BilibiliUploadRecord).filter(
            BilibiliUploadRecord.created_at >= start_date,
            BilibiliUploadRecord.status == 'completed'
        ).count()
        
        failed_uploads = db.query(BilibiliUploadRecord).filter(
            BilibiliUploadRecord.created_at >= start_date,
            BilibiliUploadRecord.status == 'failed'
        ).count()
        
        # 按账号统计
        account_stats = db.query(
            BilibiliUploadRecord.account_id,
            func.count(BilibiliUploadRecord.id).label('count'),
            func.sum(func.case([(BilibiliUploadRecord.status == 'completed', 1)], else_=0)).label('successful')
        ).filter(
            BilibiliUploadRecord.created_at >= start_date
        ).group_by(BilibiliUploadRecord.account_id).all()
        
        return {
            "period_days": days,
            "total_uploads": total_uploads,
            "successful_uploads": successful_uploads,
            "failed_uploads": failed_uploads,
            "success_rate": round(successful_uploads / total_uploads * 100, 2) if total_uploads > 0 else 0,
            "account_statistics": [
                {
                    "account_id": stat.account_id,
                    "total_uploads": stat.count,
                    "successful_uploads": stat.successful,
                    "success_
```

### Core Architecture Module: `backend/core/__init__.py`
```
"""
Core configuration and utilities for AutoClip backend.
""" 
```

### Core Architecture Module: `backend/core/asr_model_catalog.py`
```
"""Verified ASR routing, 2026-09-29. Only timestamp-capable adapters are selectable.

Sources and intentionally unsupported integrations: docs/AI_MODEL_CONFIGURATION.md.
The public/account catalog still determines availability, not this routing table.
"""
# 88API: https://88api.ai/zh/docs/api/audio/openai-audio/
MODELS = {
    'api88': ['whisper-1'],
    'openai': ['whisper-1', 'gpt-4o-transcribe-diarize', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'],
    'dashscope': ['qwen-audio-3.1-asr-flash', 'qwen-audio-3.0-asr-flash', 'fun-asr-flash-2026-06-15',
                  'qwen-audio-3.1-asr-flash-filetrans', 'qwen-audio-3.0-asr-flash-filetrans',
                  'qwen3-asr-flash-filetrans', 'qwen3-asr-flash', 'fun-asr', 'paraformer-v2'],
    'glm': ['glm-asr-2512'],
    'siliconflow': ['FunAudioLLM/SenseVoiceSmall'],
}
DASHSCOPE_SYNC = frozenset(MODELS['dashscope'][:3])


def adapter(provider, model):
    if provider == 'api88':
        return 'openai' if model == 'whisper-1' else None
    if provider == 'dashscope' and model in DASHSCOPE_SYNC:
        return 'dashscope'
    if provider in {'openai', 'infistar', 'compatible'}:
        if model == 'gpt-4o-transcribe-diarize':
            return 'diarized'
        if model == 'whisper-1' or provider == 'compatible' and model not in MODELS['openai'][2:]:
            return 'openai'
    return None


def metadata(provider, model, endpoints=()):
    known = model in MODELS.get(provider, []) or 'audio-transcription' in endpoints or '/v1/audio/transcriptions' in endpoints
    route = adapter(provider, model)
    reason = None
    if known and not route:
        reason = ('需要公网音频地址，暂未接入' if 'filetrans' in model or model in {'fun-asr', 'paraformer-v2'} else
                  '实时转写接口，暂未接入' if 'streaming' in model else
                  '字幕时间戳接口尚未适配')
    return {'asr': bool(known or (route and provider != 'compatible')), 'asr_supported': bool(route), 'asr_note': reason}

```

### Core Architecture Module: `backend/core/celery_app.py`
```
"""
Celery应用配置
任务队列配置和初始化
"""

import logging
import os
from celery import Celery
from celery.schedules import crontab
from pathlib import Path

from backend.core.log_redaction import install_celery_log_redaction

install_celery_log_redaction()

# 设置默认配置模块
# os.environ.setdefault('CELERY_CONFIG_MODULE', 'backend.core.celery_app')

# 创建Celery应用
celery_app = Celery('autoclip')

# 配置Celery
class CeleryConfig:
    """Celery配置类"""
    
    # 任务序列化格式
    task_serializer = 'json'
    accept_content = ['json']
    result_serializer = 'json'
    timezone = 'Asia/Shanghai'
    enable_utc = True
    
    # Redis配置
    broker_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    result_backend = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    
    # 任务配置
    task_always_eager = os.getenv('CELERY_ALWAYS_EAGER', 'False').lower() == 'true'  # 生产环境异步执行
    task_eager_propagates = True
    
    # 工作进程配置
    worker_prefetch_multiplier = 1
    worker_max_tasks_per_child = 1000
    worker_disable_rate_limits = True
    worker_concurrency = 1  # 强制设置并发数为1，防止重复处理
    
    # 任务路由
    task_routes = {
        'backend.tasks.processing.*': {'queue': 'processing'},
        'backend.tasks.video.*': {'queue': 'video'},
        'backend.tasks.notification.*': {'queue': 'notification'},
        'backend.tasks.upload.*': {'queue': 'upload'},  # 添加upload任务路由
        'backend.tasks.import_processing.*': {'queue': 'processing'},  # 导入任务路由
    }
    
    # 定时任务配置
    beat_schedule = {
        'cleanup-expired-tasks': {
            'task': 'backend.tasks.maintenance.cleanup_expired_tasks',
            'schedule': crontab(hour=2, minute=0),  # 每天凌晨2点
        },
        'health-check': {
            'task': 'backend.tasks.maintenance.health_check',
            'schedule': crontab(minute='*/5'),  # 每5分钟
        },
    }
    
    # 结果配置
    result_expires = 3600  # 1小时
    task_ignore_result = False
    
    # 日志配置
    worker_log_format = '[%(asctime)s: %(levelname)s/%(processName)s] %(message)s'
    worker_task_log_format = '[%(asctime)s: %(levelname)s/%(processName)s] [%(task_name)s(%(task_id)s)] %(message)s'

# 应用配置
celery_app.config_from_object(CeleryConfig)


def _is_desktop_mode() -> bool:
    return os.getenv("AUTOCLIP_DESKTOP_MODE", "").lower() in {"1", "true", "yes"}


class _LocalAsyncResult:
    """轻量级 AsyncResult 替身，桌面模式本地线程执行时返回。"""

    def __init__(self, task_id: str):
        self.id = task_id
        self.task_id = task_id
        self.state = "PENDING"

    def get(self, *args, **kwargs):
        return None

    def ready(self) -> bool:
        return False


class DesktopAwareTask(celery_app.Task):
    """桌面安装包里没有 Redis broker，生产 core.celery_app 又指向 redis://localhost。

    所有端点都用 `task.delay(...)` / `apply_async(...)` 派发任务，默认会把任务塞进
    Redis 队列 —— 桌面模式下没人消费，于是永远卡在 0%「初始化中」。

    这里在桌面模式下把 apply_async 改成「在后台守护线程里同步执行 apply()」：
    不依赖任何 broker，立即返回，进度照常写库供前端轮询。生产模式行为不变。
    """

    def apply_async(self, args=None, kwargs=None, task_id=None, **options):
        if _is_desktop_mode():
            import threading
            import uuid

            tid = task_id or str(uuid.uuid4())
            call_args = list(args) if args else []
            call_kwargs = dict(kwargs) if kwargs else {}

            def _run():
                try:
                    self.apply(args=call_args, kwargs=call_kwargs, task_id=tid)
                except Exception as exc:  # noqa: BLE001
                    import logging
                    logging.getLogger(__name__).error(
                        f"桌面模式本地执行任务失败 {self.name} ({tid}): {exc}", exc_info=True
                    )

            threading.Thread(target=_run, name=f"task-{self.name}", daemon=True).start()
            return _LocalAsyncResult(tid)

        return super().apply_async(args=args, kwargs=kwargs, task_id=task_id, **options)

    def update_state(self, task_id=None, state=None, meta=None, **kwargs):
        # 桌面模式没有 Redis 结果后端；任务里的 self.update_state() 会直接 ConnectionRefused，
        # 把整条导入任务拖死。用户可见进度走 simple_progress，这里丢弃即可
        if _is_desktop_mode():
            return None
        return super().update_state(task_id=task_id, state=state, meta=meta, **kwargs)


# 桌面模式下让所有 @celery_app.task 使用上面的本地执行基类
celery_app.Task = DesktopAwareTask

# 自动发现任务
celery_app.autodiscover_tasks([
    'backend.tasks.processing',
    'backend.tasks.video', 
    'backend.tasks.notification',
    'backend.tasks.maintenance',
    'backend.tasks.import_processing'  # 添加导入处理任务
])

if __name__ == '__main__':
    celery_app.start()
```

### Core Architecture Module: `backend/core/celery_simple_fixed.py`
```
"""
修复的简化Celery应用配置
解决任务路由和状态更新问题
"""

import os
from celery import Celery

# 创建Celery应用
celery_app = Celery('autoclip')

# 基本配置
celery_app.conf.update(
    # 序列化格式
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    
    # Redis配置
    broker_url='redis://localhost:6379/0',
    result_backend='redis://localhost:6379/0',
    
    # Broker配置
    broker_transport='redis',
    broker_transport_options={},
    
    # 队列配置
    task_default_queue='processing',
    task_default_exchange='processing',
    task_default_routing_key='processing',
    
    # 时区
    timezone='Asia/Shanghai',
    enable_utc=True,
    
    # 任务配置
    task_always_eager=False,
    task_eager_propagates=True,
    
    # 工作进程配置
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    worker_disable_rate_limits=True,
    
    # 结果配置
    result_expires=3600,
    task_ignore_result=False,
    
    # 任务路由配置
    task_routes={
        'backend.tasks.processing.*': {'queue': 'processing'},
        'backend.tasks.video.*': {'queue': 'upload'},
        'backend.tasks.notification.*': {'queue': 'notification'},
        'backend.tasks.maintenance.*': {'queue': 'maintenance'},
        'backend.tasks.upload.*': {'queue': 'upload'},
    },
    
    # 禁用自动发现，手动注册任务
    autodiscover_tasks=False,
)

# 手动注册任务，避免自动发现
@celery_app.task(bind=True, name='tasks.processing.process_video_pipeline')
def process_video_pipeline(self, project_id: str, input_video_path: str, input_srt_path: str, *args, **kwargs):
    """视频处理流水线任务"""
    # 直接调用有进度更新服务的版本
    return backend_process_video_pipeline(self, project_id, input_video_path, input_srt_path, *args, **kwargs)

@celery_app.task(bind=True, name='tasks.processing.process_single_step')
def process_single_step(self, project_id: str, step: str, config: dict, *args, **kwargs):
    """单个步骤处理任务"""
    print(f"🔧 开始处理项目 {project_id} 的步骤: {step}")
    if args:
        print(f"⚠️  额外位置参数: {args}")
    if kwargs:
        print(f"⚠️  额外关键字参数: {kwargs}")
    
    # 模拟处理过程
    import time
    time.sleep(3)
    
    print(f"✅ 步骤 {step} 处理完成")
    return {
        "success": True,
        "project_id": project_id,
        "step": step,
        "message": f"步骤 {step} 处理完成"
    }

# 兼容性任务名称
@celery_app.task(bind=True, name='backend.tasks.processing.process_video_pipeline')
def backend_process_video_pipeline(self, project_id: str, input_video_path: str, input_srt_path: str, *args, **kwargs):
    """后端视频处理流水线任务（兼容性）"""
    # 直接实现任务逻辑，避免函数引用问题
    print(f"🎬 开始处理项目: {project_id}")
    print(f"📹 视频路径: {input_video_path}")
    print(f"📝 字幕路径: {input_srt_path}")
    if args:
        print(f"⚠️  额外位置参数: {args}")
    if kwargs:
        print(f"⚠️  额外关键字参数: {kwargs}")
    
    # 获取任务ID
    task_id = self.request.id
    print(f"🔑 Celery任务ID: {task_id}")
    
    # 模拟处理过程
    import time
    steps = [
        "大纲提取",
        "时间定位", 
        "内容评分",
        "标题生成",
        "主题聚类",
        "视频切割"
    ]
    
    for i, step in enumerate(steps):
        progress = (i + 1) * 16  # 每步16%
        print(f"📊 步骤 {i+1}/6: {step} - {progress}%")
        
        # 更新任务状态
        try:
            self.update_state(
                state='PROGRESS',
                meta={
                    'current': i + 1,
                    'total': 6,
                    'status': f'正在执行: {step}',
                    'progress': progress
                }
            )
        except Exception as e:
            print(f"⚠️  更新任务状态失败: {e}")
        
        time.sleep(2)  # 模拟处理时间
    
    print(f"✅ 项目 {project_id} 处理完成")
    
    # 尝试更新数据库中的任务和项目状态
    try:
        from ..core.database import SessionLocal
        from ..models.task import Task, TaskStatus
        from ..models.project import Project, ProjectStatus
        from datetime import datetime
        
        # 直接更新数据库，避免异步调用问题
        db = SessionLocal()
        try:
            # 更新任务状态
            task = db.query(Task).filter(Task.id == task_id).first()
            if task:
                task.status = TaskStatus.COMPLETED
                task.progress = 100.0
                task.current_step = '完成'
                task.completed_at = datetime.utcnow()
                task.updated_at = datetime.utcnow()
                print(f"✅ 任务状态已更新到数据库")
            else:
                print(f"⚠️  找不到任务: {task_id}")
            
            # 更新项目状态
            project = db.query(Project).filter(Project.id == project_id).first()
            if project:
                project.status = ProjectStatus.COMPLETED
                project.completed_at = datetime.utcnow()
                project.updated_at = datetime.utcnow()
                print(f"✅ 项目状态已更新为已完成: {project_id}")
            else:
                print(f"⚠️  找不到项目: {project_id}")
            
            db.commit()
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"⚠️  更新数据库状态失败: {e}")
    
    return {
        "success": True,
        "project_id": project_id,
        "message": "视频处理完成",
        "steps": steps
    }

@celery_app.task(bind=True, name='backend.tasks.processing.process_single_step')
def backend_process_single_step(self, project_id: str, step: str, config: dict, *args, **kwargs):
    """后端单个步骤处理任务（兼容性）"""
    return process_single_step(self, project_id, step, config, *args, **kwargs)

if __name__ == '__main__':
    celery_app.start()

```

### Core Architecture Module: `backend/core/cloud_presets.py`
```
"""
云端 OpenAI 兼容预设：DeepSeek / Seed / Kimi / GLM / Grok / Infistar / 88API / APIMart（赞助）。

底层仍是 openai + 官方 base_url，和 Ollama 预设同一套路，但必须带各家自己的 key，
不能复用用户的 OpenAI key。设置页、CLI、MCP 都用 `--provider deepseek` 这种名字。

产品语义（地址、默认模型、显示名）来自 ``backend/presets/provider_presets.json``。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from backend.core.provider_presets import get_catalog, get_provider, resolve_provider_id
from backend.core.provider_quality import quality_for


@dataclass(frozen=True)
class CloudPreset:
    key: str
    display_name: str
    base_url: str
    default_model: str
    api_key_setting: str
    docs_url: str
    hint: str
    success_tier: Optional[str] = None
    latency_tier: Optional[str] = None
    caveat_key: Optional[str] = None


def _cloud_presets() -> Dict[str, CloudPreset]:
    presets: Dict[str, CloudPreset] = {}
    for item in get_catalog().providers.values():
        if not item.openai_compat_remap:
            continue
        measured = quality_for(item.id)
        presets[item.id] = CloudPreset(
            key=item.id,
            display_name=item.display_name,
            base_url=item.base_url,
            default_model=item.default_model,
            api_key_setting=item.api_key_setting,
            docs_url=item.docs_url,
            hint=item.cloud_hint,
            success_tier=measured.success_tier if measured else None,
            latency_tier=measured.latency_tier if measured else None,
            caveat_key=measured.caveat_key if measured else None,
        )
    return presets


CLOUD_PRESETS: Dict[str, CloudPreset] = _cloud_presets()

# Official 88API host lives in the JSON catalog. Saved configs may still use the
# previous host; both stay valid. Do not rewrite a stored URL to the new host.
_api88 = get_provider("api88")
API88_HOSTS = frozenset(_api88.accepted_hosts if _api88 else ())


def is_api88_host(host: Optional[str]) -> bool:
    return (host or "").lower() in API88_HOSTS


def normalize_cloud_preset_key(name: Optional[str]) -> Optional[str]:
    key = resolve_provider_id(name)
    return key if key in CLOUD_PRESETS else None


def resolve_cloud_preset(provider: Optional[str], base_url: Optional[str] = None) -> Optional[Tuple[str, str, CloudPreset]]:
    """
    若 provider 是 deepseek / seed / kimi / glm / grok / infistar / api88（或别名），返回 (openai, base_url, preset)。
    不是云端预设则返回 None。
    """
    key = normalize_cloud_preset_key(provider)
    if not key:
        return None
    preset = CLOUD_PRESETS[key]
    return "openai", (base_url or "").strip() or preset.base_url, preset


def cloud_preset_display_name(key: Optional[str]) -> Optional[str]:
    p = CLOUD_PRESETS.get(key or "")
    return p.display_name if p else None


def sponsor_topup_url(provider: Optional[str]) -> Optional[str]:
    """X3: sponsor recharge URL (topup_url, else register_url). None if not a sponsor."""
    key = normalize_cloud_preset_key(provider)
    if key not in {"api88", "apimart"}:
        return None
    row = get_provider(key)
    if not row or not row.sponsor:
        return None
    return (row.sponsor.get("topup_url") or row.sponsor.get("register_url") or "").strip() or None


```

### Core Architecture Module: `backend/core/config.py`
```
"""
统一配置管理
集中管理应用的所有配置项
"""

import os
from pathlib import Path
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict

class APISettings(BaseModel):
    """API配置"""
    dashscope_api_key: str = Field(default='', validation_alias=AliasChoices('API_DASHSCOPE_API_KEY'))
    model_name: str = Field(default='qwen-plus', validation_alias=AliasChoices('API_MODEL_NAME'))
    max_tokens: int = Field(default=4096, validation_alias=AliasChoices('API_MAX_TOKENS'))
    timeout: int = Field(default=30, validation_alias=AliasChoices('API_TIMEOUT'))

class DatabaseSettings(BaseModel):
    """数据库配置"""
    url: str = Field(default='sqlite:///./data/autoclip.db', validation_alias=AliasChoices('DATABASE_URL'))

class RedisSettings(BaseModel):
    """Redis配置"""
    url: str = Field(default='redis://localhost:6379/0', validation_alias=AliasChoices('REDIS_URL'))

class ProcessingSettings(BaseModel):
    """处理配置"""
    chunk_size: int = Field(default=5000, validation_alias=AliasChoices('PROCESSING_CHUNK_SIZE'))
    min_score_threshold: float = Field(default=0.7, validation_alias=AliasChoices('PROCESSING_MIN_SCORE_THRESHOLD'))
    max_clips_per_collection: int = Field(default=5, validation_alias=AliasChoices('PROCESSING_MAX_CLIPS_PER_COLLECTION'))
    max_retries: int = Field(default=3, validation_alias=AliasChoices('PROCESSING_MAX_RETRIES'))

class LoggingSettings(BaseModel):
    """日志配置"""
    level: str = Field(default='INFO', validation_alias=AliasChoices('LOG_LEVEL'))
    fmt: str = Field(default='%(asctime)s - %(name)s - %(levelname)s - %(message)s', validation_alias=AliasChoices('LOG_FORMAT'))
    file: str = Field(default='backend.log', validation_alias=AliasChoices('LOG_FILE'))

class Settings(BaseSettings):
    """应用设置"""
    # 允许 .env + 忽略未声明的键，避免"Extra inputs are not permitted"
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    environment: str = Field(default='development', validation_alias=AliasChoices('ENVIRONMENT'))
    debug: bool = Field(default=True, validation_alias=AliasChoices('DEBUG'))
    encryption_key: str = Field(default='', validation_alias=AliasChoices('ENCRYPTION_KEY'))

    # 直接定义字段，不使用嵌套的BaseModel
    database_url: str = Field(default='sqlite:///./data/autoclip.db', validation_alias=AliasChoices('DATABASE_URL'))
    redis_url: str = Field(default='redis://localhost:6379/0', validation_alias=AliasChoices('REDIS_URL'))
    api_dashscope_api_key: str = Field(default='', validation_alias=AliasChoices('API_DASHSCOPE_API_KEY'))
    api_model_name: str = Field(default='qwen-plus', validation_alias=AliasChoices('API_MODEL_NAME'))
    api_max_tokens: int = Field(default=4096, validation_alias=AliasChoices('API_MAX_TOKENS'))
    api_timeout: int = Field(default=30, validation_alias=AliasChoices('API_TIMEOUT'))
    processing_chunk_size: int = Field(default=5000, validation_alias=AliasChoices('PROCESSING_CHUNK_SIZE'))
    processing_min_score_threshold: float = Field(default=0.7, validation_alias=AliasChoices('PROCESSING_MIN_SCORE_THRESHOLD'))
    processing_max_clips_per_collection: int = Field(default=5, validation_alias=AliasChoices('PROCESSING_MAX_CLIPS_PER_COLLECTION'))
    processing_max_retries: int = Field(default=3, validation_alias=AliasChoices('PROCESSING_MAX_RETRIES'))
    log_level: str = Field(default='INFO', validation_alias=AliasChoices('LOG_LEVEL'))
    log_format: str = Field(default='%(asctime)s - %(name)s - %(levelname)s - %(message)s', validation_alias=AliasChoices('LOG_FORMAT'))
    log_file: str = Field(default='backend.log', validation_alias=AliasChoices('LOG_FILE'))

# 全局配置实例
settings = Settings()

def get_project_root() -> Path:
    """获取项目根目录"""
    # 使用新的路径工具
    from ..core.path_utils import get_project_root as get_root
    return get_root()

def get_data_directory() -> Path:
    """获取数据目录"""
    from ..core.path_utils import get_data_directory as get_dir
    return get_dir()

def get_uploads_directory() -> Path:
    """获取上传文件目录"""
    from ..core.path_utils import get_uploads_directory as get_dir
    return get_dir()

def get_temp_directory() -> Path:
    """获取临时文件目录"""
    from ..core.path_utils import get_temp_directory as get_dir
    return get_dir()

def get_output_directory() -> Path:
    """获取输出文件目录"""
    from ..core.path_utils import get_output_directory as get_dir
    return get_dir()

def get_database_url() -> str:
    """获取数据库URL"""
    return settings.database_url

def get_redis_url() -> str:
    """获取Redis URL"""
    return settings.redis_url

def get_api_key() -> Optional[str]:
    """获取API密钥"""
    return settings.api_dashscope_api_key if settings.api_dashscope_api_key else None

def get_model_config() -> Dict[str, Any]:
    """获取模型配置"""
    return {
        "model_name": settings.api_model_name,
        "max_tokens": settings.api_max_tokens,
        "timeout": settings.api_timeout
    }

def get_processing_config() -> Dict[str, Any]:
    """获取处理配置"""
    return {
        "chunk_size": settings.processing_chunk_size,
        "min_score_threshold": settings.processing_min_score_threshold,
        "max_clips_per_collection": settings.processing_max_clips_per_collection,
        "max_retries": settings.processing_max_retries
    }

def get_logging_config() -> Dict[str, Any]:
    """获取日志配置"""
    log_format = settings.log_format
    if log_format.lower() == "json":
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    return {
        "level": settings.log_level,
        "format": log_format,
        "file": settings.log_file
    }

# 初始化路径配置
def init_paths():
    """初始化路径配置"""
    project_root = get_project_root()
    data_dir = get_data_directory()
    uploads_dir = get_uploads_directory()
    temp_dir = get_temp_directory()
    output_dir = get_output_directory()
    
    print(f"项目根目录: {project_root}")
    print(f"数据目录: {data_dir}")
    print(f"上传目录: {uploads_dir}")
    print(f"临时目录: {temp_dir}")
    print(f"输出目录: {output_dir}")

if __name__ == "__main__":
    # 测试配置加载
    init_paths()
    print(f"数据库URL: {get_database_url()}")
    print(f"Redis URL: {get_redis_url()}")
    print(f"API配置: {get_model_config()}")
    print(f"处理配置: {get_processing_config()}") 

```

### Core Architecture Module: `backend/core/custom_request_options.py`
```
"""Validated optional settings for an OpenAI-compatible gateway.

Transport headers are secrets; framing/routing headers and application-owned
request fields cannot be overridden by provider options.
"""
from __future__ import annotations

import copy
import json
import re
from typing import Literal, Mapping

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator

HEADER_NAME = re.compile(r"^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$")
BLOCKED_HEADERS = frozenset({'host', 'content-length', 'transfer-encoding', 'connection',
                             'proxy-authorization', 'proxy-connection', 'trailer', 'te', 'upgrade'})
RESERVED_BODY_FIELDS = frozenset({'model', 'messages', 'stream', 'stream_options', 'max_tokens',
                                  'max_completion_tokens', 'max_output_tokens', 'response_format',
                                  'api_key', 'base_url', 'timeout', 'headers', 'http_headers',
                                  'extra_headers', 'extra_body', 'reasoning_effort'})
ReasoningEffort = Literal['none', 'minimal', 'low', 'medium', 'high', 'xhigh']


class CustomRequestOptions(BaseModel):
    model_config = ConfigDict(hide_input_in_errors=True)
    # None means keep the previously saved secret; an empty map explicitly clears it.
    http_headers: dict[str, str] | None = Field(default=None, max_length=32, repr=False)
    reasoning_effort: ReasoningEffort | None = None
    extra_body: dict[str, JsonValue] = Field(default_factory=dict, max_length=64, repr=False)

    @field_validator('http_headers')
    @classmethod
    def valid_headers(cls, value):
        if value is None:
            return None
        seen = set()
        for name, text in value.items():
            lower = name.lower()
            if not HEADER_NAME.fullmatch(name) or lower in BLOCKED_HEADERS or lower in seen:
                raise ValueError('Invalid custom HTTP headers')
            if len(text) > 4096 or any(ord(c) < 32 or ord(c) > 126 for c in text):
                raise ValueError('Invalid custom HTTP header value')
            seen.add(lower)
        return value

    @field_validator('extra_body')
    @classmethod
    def valid_body(cls, value):
        if RESERVED_BODY_FIELDS.intersection(value):
            raise ValueError('Provider parameters cannot override application request fields')
        try:
            encoded = json.dumps(value, ensure_ascii=False, allow_nan=False).encode('utf-8')
        except (ValueError, TypeError, RecursionError):
            raise ValueError('Provider parameters must be a finite JSON object') from None
        if len(encoded) > 16384:
            raise ValueError('Provider parameters must be at most 16 KB')
        return value


def request_options(config) -> dict:
    """Omit defaults so legacy endpoints and callers retain their exact contract."""
    get = config.get if isinstance(config, Mapping) else lambda key: getattr(config, key, None)
    return {key: copy.deepcopy(get(key)) for key in ('http_headers', 'reasoning_effort', 'extra_body') if get(key)}


def merge_headers(defaults: Mapping[str, str], custom: Mapping[str, str] | None = None) -> dict[str, str]:
    headers = dict(defaults)
    for name, value in (custom or {}).items():
        headers = {key: text for key, text in headers.items() if key.lower() != name.lower()}
        headers[name] = value
    return headers


def apply_chat_options(payload: dict, config) -> dict:
    """Explicit call arguments win; the SDK flattens extra_body, raw HTTP must too."""
    options = request_options(config)
    body = dict(payload)
    if options.get('reasoning_effort'):
        body.setdefault('reasoning_effort', options['reasoning_effort'])
    if options.get('extra_body'):
        extra = {**options['extra_body'], **(body.get('extra_body') or {})}
        # The SDK merges extra_body LAST, unlike raw HTTP. Remove top-level collisions
        # here so explicit call fields win identically on both transports.
        body['extra_body'] = {key: value for key, value in extra.items() if key not in body}
    return body


def no_redirect_open(request, *, timeout):
    """urllib otherwise forwards custom secret headers on redirects."""
    import urllib.request
    from backend.core.llm_providers import is_local_url

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    proxy = urllib.request.ProxyHandler({}) if is_local_url(request.full_url) else urllib.request.ProxyHandler()
    return urllib.request.build_opener(proxy, NoRedirect()).open(request, timeout=timeout)

```

### Core Architecture Module: `backend/core/database.py`
```
"""
数据库配置
包含数据库连接、会话管理和依赖注入
"""

import logging
import os
import sqlite3
from contextlib import contextmanager
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool, NullPool
from sqlalchemy.engine import make_url
from typing import Generator
from backend.models.base import Base

# 数据库配置
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "sqlite:///autoclip.db"
)

# 如果没有设置环境变量，使用配置函数获取数据库URL
if DATABASE_URL == "sqlite:///autoclip.db":
    try:
        from .config import get_database_url
        DATABASE_URL = get_database_url()
    except ImportError:
        # 如果导入失败，保持默认值
        pass

def is_memory_sqlite(database_url: str) -> bool:
    url = make_url(database_url)
    return url.get_backend_name() == 'sqlite' and (not url.database or url.database == ':memory:' or url.query.get('mode') == 'memory')


def sqlite_engine_kwargs(database_url: str) -> dict:
    return {'poolclass': StaticPool if is_memory_sqlite(database_url) else NullPool}


# File-backed databases use separate connections; in-memory databases keep one.
def create_database_engine(database_url):
    url = make_url(database_url)
    if url.get_backend_name() != 'sqlite':
        return create_engine(database_url, pool_pre_ping=True, pool_recycle=300, echo=False)
    in_memory = is_memory_sqlite(database_url)
    database_engine = create_engine(
        database_url,
        connect_args={'check_same_thread': False, 'timeout': 30},
        **sqlite_engine_kwargs(database_url),
        pool_pre_ping=True,
        echo=False,
    )
    if not in_memory:
        @event.listens_for(database_engine, 'connect')
        def sqlite_pragmas(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            try:
                # Even reading journal_mode can encounter an exclusive legacy lock.
                # Defer optional WAL setup and leave normal queries their busy timeout.
                cursor.execute('PRAGMA busy_timeout=0')
                try:
                    mode = cursor.execute('PRAGMA journal_mode').fetchone()[0]
                    if str(mode).lower() != 'wal':
                        cursor.execute('PRAGMA journal_mode=WAL').fetchone()
                except sqlite3.OperationalError as error:
                    code = getattr(error, 'sqlite_errorcode', 0) & 0xff
                    if code not in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED, sqlite3.SQLITE_READONLY):
                        raise
                    logging.getLogger(__name__).info('SQLite WAL initialization deferred (code=%s)', code)
            finally:
                try:
                    cursor.execute('PRAGMA busy_timeout=30000')
                finally:
                    cursor.close()
    return database_engine


engine = create_database_engine(DATABASE_URL)

# 创建会话工厂
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_db() -> Generator[Session, None, None]:
    """
    数据库会话依赖注入
    用于FastAPI的依赖注入系统
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """短生命周期会话。不要用 next(get_db())：生成器被丢掉时 finally 不会马上执行，连接不归还。"""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()

def create_tables():
    """创建所有数据库表，并清洗项目表里当前代码无法识别的枚举值。"""
    Base.metadata.create_all(bind=engine)
    _normalize_project_enums()


def _normalize_project_enums():
    try:
        from backend.core.project_enum_migration import normalize_legacy_project_enums
        normalize_legacy_project_enums(engine)
    except Exception:
        logging.getLogger(__name__).exception("清洗项目枚举旧值失败")


def drop_tables():
    """删除所有数据库表"""
    Base.metadata.drop_all(bind=engine)

def reset_database():
    """重置数据库"""
    drop_tables()
    create_tables()

from sqlalchemy import text

def test_connection() -> bool:
    """测试数据库连接"""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1")).fetchone()
        return True
    except Exception as e:
        print(f"数据库连接测试失败: {e}")
        return False

# 数据库初始化
def init_database():
    """初始化数据库"""
    print("正在初始化数据库...")
    
    # 测试连接
    if not test_connection():
        print("❌ 数据库连接失败")
        return False
    
    # 创建表
    try:
        create_tables()
        print("✅ 数据库表创建成功")
        return True
    except Exception as e:
        print(f"❌ 数据库表创建失败: {e}")
        return False

if __name__ == "__main__":
    # 直接运行此文件时初始化数据库
    init_database()

```

### Core Architecture Module: `backend/core/dependencies.py`
```
"""
依赖注入配置
提供FastAPI的依赖注入服务
"""

from typing import Generator
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..services.project_service import ProjectService
from ..services.clip_service import ClipService
from ..services.collection_service import CollectionService
from ..services.task_service import TaskService


def get_project_service(db: Session) -> ProjectService:
    """Get project service with database dependency."""
    return ProjectService(db)


def get_clip_service(db: Session) -> ClipService:
    """Get clip service with database dependency."""
    return ClipService(db)


def get_collection_service(db: Session) -> CollectionService:
    """Get collection service with database dependency."""
    return CollectionService(db)


def get_task_service(db: Session) -> TaskService:
    """Get task service with database dependency."""
    return TaskService(db) 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #591** (2026-11-23): **[反馈] Kimi K3 thinking-only models fail trial run (Context ✗ Outpu**
  *Symptoms*: 来自应用内反馈，由自动收件写入。  反馈编号：78bf5a97-520e-4c5f-ab99-b77a81237cb8 <!-- feedback-id:78bf5a97-520e-4c5f-ab99-b77a81237cb8 -->  Kimi K3 thinking-only models fail trial run (Context ✗ Output format ✗)  环境 - 版本：1.5.8 - 系统：windows / x86_64 - 来源：settings - 转写模型：whisper_local / base  邮箱留在维护者的收件记录里，不写在这条公开帖上。
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v1.5.9**: thinking/reasoning model probes now allocate sufficient token budget, strip `<think>` blocks cleanly, and handle relay endpoints without failing trial runs. Please upgrade to [v1.5.9](https://github.com/zhouxiaoka/autoclip/releases/tag/v1.5.9) and feel free to reopen if you still hit this.

- **Issue #580** (2026-11-22): **[反馈] 你好，为什么视频生产出来共有10个，前三个是原画像大小9-16竖屏的，后面的都会被缩小视频，完全不可以使用**
  *Symptoms*: 来自应用内反馈，由自动收件写入。  反馈编号：10bc88dc-2cd9-470b-bb77-55603377277d <!-- feedback-id:10bc88dc-2cd9-470b-bb77-55603377277d -->  你好，为什么视频生产出来共有10个，前三个是原画像大小9-16竖屏的，后面的都会被缩小视频，完全不可以使用  环境 - 版本：1.5.8 - 系统：windows / x86_64 - 来源：settings - 转写模型：whisper_local / base - 模型：deepseek / deepseek-flash  邮箱留在维护者的收件记录里，不写在这条公开帖上。

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

### Incident Patch 1: `99728616` (2026-11-24)
**Commit Message**: fix(sentry): guard optional numpy in dissolve cuts, closed SSE peek, Proactor shutdown OSError, and LeaveGuard blocker (#6K, #70, #78, FRONTEND-P)

**File**: `backend/core/llm_stream.py` (modified, +8/-1)
```diff
@@ -702,7 +702,14 @@ def _lines(response: Any):
         yield from text.splitlines()
         return
     while True:
-        line = readline()
+        try:
+            line = readline()
+        except AttributeError as error:
+            # CPython http.client.HTTPResponse._peek_chunked raises AttributeError
+            # ('NoneType' object has no attribute 'peek') if the stream closes mid-read.
+            if getattr(response, "fp", True) is None:
+                raise ConnectionError("HTTP stream closed mid-read") from error
+            raise
         if not line:
             break
         yield line
```

**File**: `backend/core/windows_asyncio.py` (modified, +21/-3)
```diff
@@ -11,9 +11,25 @@
 Revisit this private-API compatibility shim when upgrading bundled Python.
 """
 
+import errno
 import socket
 import sys
 
+_BENIGN_SHUTDOWN_ERRNOS = frozenset({
+    errno.ENOTCONN,
+    errno.EBADF,
+    10038,  # WSAENOTSOCK
+    10053,  # WSAECONNABORTED
+    10054,  # WSAECONNRESET
+    10057,  # WSAENOTCONN
+})
+
+
+def _is_benign_shutdown_error(exc: OSError) -> bool:
+    if isinstance(exc, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
+        return True
+    return exc.errno in _BENIGN_SHUTDOWN_ERRNOS or getattr(exc, "winerror", None) in _BENIGN_SHUTDOWN_ERRNOS
+
 
 def _call_connection_lost(self, exc):
     if self._called_connection_lost:
@@ -24,9 +40,11 @@ def _call_connection_lost(self, exc):
         if hasattr(self._sock, "shutdown") and self._sock.fileno() != -1:
             try:
                 self._sock.shutdown(socket.SHUT_RDWR)
-            except ConnectionResetError:
-                # The peer is already gone. Still close the local socket and
-                # detach from the server so wait_closed() can finish.
+            except OSError as shutdown_exc:
+                if not _is_benign_shutdown_error(shutdown_exc):
+                    raise
+                # The peer or socket is already gone (e.g. WinError 10054 / 10057 / 10038).
+                # Still close the local socket and detach from the server so wait_closed() finishes.
                 pass
         self._sock.close()
         self._sock = None
```

**File**: `backend/services/studio/framing.py` (modified, +4/-1)
```diff
@@ -517,6 +517,10 @@ def _dissolve_cuts(video: Path, start: float, length: float) -> list[float]:
     """Crossfades the hard-cut detector misses, as seconds relative to `start`."""
     if length < 0.8:
         return []
+    try:
+        import numpy as np
+    except ImportError:
+        return []
     width, height = 96, 54
     rate = f"{1 / DISSOLVE_STEP:.4g}"
     cmd = [get_ffmpeg_path(), "-v", "error", "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", str(video),
@@ -530,7 +534,6 @@ def _dissolve_cuts(video: Path, start: float, length: float) -> list[float]:
     count = len(raw) // size
     if proc.returncode != 0 or count < 4:
         return []
-    import numpy as np
     frames = []
     times = []
     for index in range(count):
```

**File**: `backend/tests/test_sentry_160_regressions.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+"""Regression tests for v1.6.0 Sentry issues: PYTHON-FASTAPI-6K, -70, -78."""
+from __future__ import annotations
+
+import builtins
+from pathlib import Path
+from unittest.mock import MagicMock
+
+import pytest
+
+from backend.core import llm_stream, windows_asyncio
+from backend.services.studio import framing
+
+
+def test_python_fastapi_6k_dissolve_cuts_skips_cleanly_without_numpy(monkeypatch, tmp_path):
+    """PYTHON-FASTAPI-6K: Windows portable bundle without optional numpy must not crash detect_cuts."""
+    real_import = builtins.__import__
+
+    def no_numpy(name, *args, **kwargs):
+        if name == "numpy" or name.startswith("numpy."):
+            raise ModuleNotFoundError("No module named 'numpy'")
+        return real_import(name, *args, **kwargs)
+
+    monkeypatch.setattr(builtins, "__import__", no_numpy)
+    dummy_video = tmp_path / "sample.mp4"
+    dummy_video.write_bytes(b"")
+    assert framing._dissolve_cuts(dummy_video, 0.0, 5.0) == []
+
+
+def test_python_fastapi_70_windows_proactor_tolerates_shutdown_oserror():
+    """PYTHON-FASTAPI-70: socket.shutdown() raising OSError (e.g. WSAENOTCONN 10057) must still close & detach."""
+    sock = MagicMock()
+    sock.fileno.return_value = 42
+    sock.shutdown.side_effect = OSError(10057, "Socket is not connected")
+    server = MagicMock()
+    protocol = MagicMock()
+
+    class _FakeTransport:
+        _called_connection_lost = False
+        _sock = sock
+        _server = server
+        _protocol = protocol
+
+    transport = _FakeTransport()
+    windows_asyncio._call_connection_lost(transport, None)
+
+    protocol.connection_lost.assert_called_once_with(None)
+    sock.close.assert_called_once()
+    server._detach.assert_called_once_with(transport)
+    assert transport._sock is None
+    assert transport._server is None
+    assert transport._called_connection_lost is True
+
+
+def test_python_fastapi_78_closed_chunked_response_converts_attribute_error_to_connection_error():
+    """PYTHON-FASTAPI-78: HTTPResponse._peek_chunked raising AttributeError on closed fp becomes ConnectionError."""
+    class _ClosedChunkedResponse:
+        fp = None
+
+        def readline(self):
+            raise AttributeError("'NoneType' object has no attribute 'peek'")
+
+    with pytest.raises(ConnectionError, match="HTTP stream closed mid-read"):
+        list(llm_stream._lines(_ClosedChunkedResponse()))
+
+
+def test_python_fastapi_78_unrelated_attribute_error_still_propagates():
+    class _BrokenResponse:
+        fp = object()
+
+        def readline(self):
+            raise AttributeError("unexpected bug")
+
+    with pytest.raises(AttributeError, match="unexpected bug"):
+        list(llm_stream._lines(_BrokenResponse()))
```

**File**: `frontend/src/features/settings/ModelSettingsLeaveGuard.tsx` (modified, +21/-5)
```diff
@@ -1,4 +1,4 @@
-import type { RefObject } from 'react'
+import { useRef, type RefObject } from 'react'
 import { useBlocker } from 'react-router-dom'
 import { t } from '../../i18n'
 import { Btn, Dialog } from '../../ui'
@@ -9,15 +9,31 @@ export default function ModelSettingsLeaveGuard({ dirty, saving, onSave }: {
   onSave: () => Promise<boolean>
 }) {
   const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty.current === true && currentLocation.pathname !== nextLocation.pathname)
+  const blockerRef = useRef(blocker)
+  blockerRef.current = blocker
+  const busyRef = useRef(false)
   if (blocker.state !== 'blocked') return null
-  const stay = () => { if (!saving) blocker.reset() }
+  const safeReset = () => {
+    if (blockerRef.current.state === 'blocked') blockerRef.current.reset()
+  }
+  const safeProceed = () => {
+    if (blockerRef.current.state === 'blocked') blockerRef.current.proceed()
+  }
+  const stay = () => { if (!saving && !busyRef.current) safeReset() }
   const saveAndLeave = async () => {
-    if (await onSave()) blocker.proceed()
-    else blocker.reset()
+    if (busyRef.current) return
+    busyRef.current = true
+    try {
+      const ok = await onSave()
+      if (ok) safeProceed()
+      else safeReset()
+    } finally {
+      busyRef.current = false
+    }
   }
   return <Dialog open onClose={stay} title={t('有未保存的更改')} footer={<>
     <Btn disabled={saving} onClick={stay}>{t('继续编辑')}</Btn>
-    <Btn disabled={saving} onClick={() => blocker.proceed()}>{t('放弃更改')}</Btn>
+    <Btn disabled={saving} onClick={safeProceed}>{t('放弃更改')}</Btn>
     <Btn variant="cta" loading={saving} onClick={() => void saveAndLeave()}>{t('保存并离开')}</Btn>
   </>} />
 }
```

---

### Incident Patch 2: `6535dda0` (2026-11-23)
**Commit Message**: fix(export): retain completed renders when temp cleanup is busy

**File**: `backend/services/publish_export.py` (modified, +4/-3)
```diff
@@ -341,10 +341,11 @@ def export_clip(req: ExportRequest) -> Dict[str, Any]:
     font = resolve_cjk_font()
     if req.title_card and not studio and not font:
         warnings.append("没找到中文字体，已跳过标题卡")
-    # Keep the rendered file on the destination filesystem for atomic finalization.
+    # Stage the render on the destination volume and keep cleanup best-effort.
+    # A temporary file lock must not change the outcome of an already-finished export.
     with (
-        tempfile.TemporaryDirectory(prefix="ac-export-") as scratch,
-        tempfile.TemporaryDirectory(prefix=".ac-export-", dir=out_dir) as staged,
+        tempfile.TemporaryDirectory(prefix="ac-export-", ignore_cleanup_errors=True) as scratch,
+        tempfile.TemporaryDirectory(prefix=".ac-export-", dir=out_dir, ignore_cleanup_errors=True) as staged,
     ):
         tmpdir = Path(scratch)
         srt_file = None
```

**File**: `backend/tests/test_publish_export.py` (modified, +13/-1)
```diff
@@ -116,7 +116,8 @@ def forbidden(*_):
 
 
 @pytest.mark.skipif(not shutil.which("ffmpeg"), reason="本机没有 ffmpeg")
-def test_export_finalizes_atomically_on_project_volume(data_dir, tmp_path, monkeypatch):
+@pytest.mark.parametrize("cleanup_denied", [False, True])
+def test_export_finalizes_atomically_on_project_volume(data_dir, tmp_path, monkeypatch, cleanup_denied):
     import errno
 
     from backend.services import output_branding
@@ -131,6 +132,17 @@ def test_export_finalizes_atomically_on_project_volume(data_dir, tmp_path, monke
     monkeypatch.setattr(export, "load_clip_meta", lambda *_: {
         "id": "1", "start_time": "00:00:00,000", "end_time": "00:00:01,000",
     })
+    if cleanup_denied:
+        temporary_directory = export.tempfile.TemporaryDirectory
+
+        class BusyTemporaryDirectory(temporary_directory):
+            @classmethod
+            def _rmtree(cls, path, ignore_errors=False, repeated=False):
+                if not ignore_errors:
+                    raise PermissionError(errno.EACCES, "temporary directory is busy", path)
+                return super()._rmtree(path, ignore_errors=ignore_errors, repeated=repeated)
+
+        monkeypatch.setattr(export.tempfile, "TemporaryDirectory", BusyTemporaryDirectory)
     replace = output_branding.os.replace
 
     def replace_on_project_volume(source, destination):
```

---

### Incident Patch 3: `79fb00d0` (2026-11-24)
**Commit Message**: fix(packaging_html): treat Playwright TimeoutError as over_budget downgrade (PYTHON-FASTAPI-79)

**File**: `backend/services/studio/packaging_html.py` (modified, +3/-0)
```diff
@@ -703,6 +703,9 @@ def remaining() -> float:
         report_overlay_failure(error)
         return finish(_downgrade('missing_runtime' if error.reason == 'runtime' else 'none', failure=error.reason, requested=template))
     except Exception as error:  # noqa: BLE001 - a capture failure must not fail the export
+        # Playwright's TimeoutError inherits from playwright.Error, not builtin TimeoutError.
+        if type(error).__name__ == 'TimeoutError' or remaining() <= 0:
+            return finish(_downgrade('over_budget', requested=template))
         report_overlay_failure(error)
         return finish(_downgrade('none', failure='capture', requested=template))
     if not _cached_overlay_fits(dest, frames, fps):
```

**File**: `backend/tests/test_sentry_160_regressions.py` (modified, +31/-0)
```diff
@@ -72,3 +72,34 @@ def readline(self):
 
     with pytest.raises(AttributeError, match="unexpected bug"):
         list(llm_stream._lines(_BrokenResponse()))
+
+
+def test_python_fastapi_79_playwright_timeout_downgrades_as_over_budget_without_sentry_error(monkeypatch, tmp_path):
+    """PYTHON-FASTAPI-79: playwright._impl._errors.TimeoutError does not subclass builtin TimeoutError."""
+    from backend.services.studio import packaging_html
+
+    class _PlaywrightTimeoutError(Exception):
+        pass
+
+    _PlaywrightTimeoutError.__name__ = "TimeoutError"
+
+    reported = []
+    monkeypatch.setattr(packaging_html, "report_overlay_failure", lambda err: reported.append(err))
+    monkeypatch.setattr(packaging_html, "overlay_cache_path", lambda *a, **kw: tmp_path / "overlay.mkv")
+    monkeypatch.setattr(packaging_html, "load_project_word_timing", lambda _pid: [])
+    monkeypatch.setattr(packaging_html, "load_project_transcript", lambda _pid: [])
+
+    async def boom(_frames, _fps):
+        raise _PlaywrightTimeoutError("Page.screenshot: Timeout 30000ms exceeded.")
+
+    job = packaging_html.prepare_overlay(
+        project_id="p1",
+        packaging={"title": "Demo", "captions": []},
+        duration=2.0,
+        template="editorial",
+        features={"html_packaging": True},
+        capture=boom,
+    )
+    assert job.downgraded is True
+    assert job.downgrade_reason == "over_budget"
+    assert reported == []
```

#### Recent Merged Pull Requests:
- **PR #703** (closed): feat: remember the default desktop export directory (@YxYL6125)
- **PR #702** (closed): feat: import multiple local videos as independent projects (@YxYL6125)
- **PR #699** (closed): fix(vision): identify provider HTTP requests (@TimLuo465)
- **PR #693** (2026-11-25): release(1.6.1-rc): DeepSeek Flash vision (#692), 11 bug fixes (#669, #678–#687) & settings UX (#668, #643) (@zhouxiaoka)
- **PR #691** (2026-11-24): chore: organize repository root into clean single-screen layout (@zhouxiaoka)
- **PR #690** (2026-11-24): docs: refresh README for v1.6.0 live replays & set English as default (@zhouxiaoka)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. sentry): guard optional numpy in dissolve cuts, closed SSE peek, Proactor shutdo

**RULE**:
When implementing operations in `backend/core/llm_stream.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zhouxiaoka/autoclip. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `99728616`: sentry): guard optional numpy in dissolve cuts, closed SSE peek, Proactor shutdown OSError, and LeaveGuard blocker (#6K, #70, #78, FRONTEND-P). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `backend/core/llm_stream.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
        try:
            line = readline()
        except AttributeError as error:
            # CPython http.client.HTTPResponse._peek_chunked raises AttributeError
            # ('NoneType' object has no attribute 'peek') if the stream closes mid-read.
            if getattr(response, "fp", True) is None:
                raise ConnectionError("HTTP stream closed mid-read") from error
            raise
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
        line = readline()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `99728616` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
